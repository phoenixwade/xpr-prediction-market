<?php
require_once __DIR__ . '/logger.php';
require_once __DIR__ . '/notify_helper.php';

Logger::init();
Logger::info('Comments API request started');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    Logger::debug('OPTIONS request - returning CORS headers');
    exit(0);
}

$commentAdmins = [];
$raw = getenv('COMMENT_ADMINS');
Logger::debug('Checking for COMMENT_ADMINS', ['from_env' => $raw !== false ? 'found' : 'not found']);// Prefer server environment variable if set

if (!$raw) {
    Logger::debug('COMMENT_ADMINS not in env, checking .env files');
    $candidates = [];
    
    $candidates[] = __DIR__ . '/../../../.env';
    $candidates[] = __DIR__ . '/../.env';
    
    $docRoot = $_SERVER['DOCUMENT_ROOT'] ?? null;
    if ($docRoot) {
        $candidates[] = dirname($docRoot) . '/proton-prediction-market/.env';
    }
    
    Logger::debug('Candidate .env paths', ['paths' => $candidates]);
    
    foreach ($candidates as $path) {
        if ($path && file_exists($path)) {
            Logger::debug('.env file found', ['path' => $path]);
            $envContent = file_get_contents($path);
            if (preg_match('/^\s*COMMENT_ADMINS\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^#\r\n]+))/m', $envContent, $matches)) {
                $raw = $matches[1] ?: $matches[2] ?: trim($matches[3]);
                Logger::info('COMMENT_ADMINS found in .env', ['path' => $path, 'raw_value' => $raw]);
                break;
            } else {
                Logger::warning('COMMENT_ADMINS not found in .env file', ['path' => $path]);
            }
        } else {
            Logger::debug('.env file does not exist', ['path' => $path]);
        }
    }
}

if ($raw !== null && $raw !== '') {
    $commentAdmins = array_values(array_filter(array_map('trim', explode('|', $raw))));
    Logger::info('Comment admins parsed', ['admins' => $commentAdmins, 'count' => count($commentAdmins)]);
} else {
    Logger::warning('No COMMENT_ADMINS configured - delete functionality will be disabled');
}

$dbPath = getenv('COMMENTS_DB_PATH') ?: __DIR__ . '/../data/comments.db';
Logger::debug('Database path', ['path' => $dbPath]);

$dataDir = dirname($dbPath);

if (!file_exists($dataDir)) {
    Logger::info('Creating data directory', ['path' => $dataDir]);
    mkdir($dataDir, 0755, true);
}

if (!in_array('sqlite', PDO::getAvailableDrivers())) {
    Logger::error('PDO SQLite driver not available');
    http_response_code(500);
    echo json_encode(['error' => 'PDO SQLite driver not available on this server']);
    exit;
}

try {
    Logger::debug('Connecting to database');
    $db = new PDO('sqlite:' . $dbPath);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    Logger::debug('Database connection established');
    
    $db->exec("CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        market_id INTEGER NOT NULL,
        user_account TEXT NOT NULL,
        comment_text TEXT NOT NULL,
        created_at INTEGER NOT NULL
    )");
    
    $db->exec("CREATE INDEX IF NOT EXISTS idx_comments_market_id ON comments(market_id)");
    
    try {
        $cols = $db->query("PRAGMA table_info(comments)")->fetchAll(PDO::FETCH_ASSOC);
        $columnNames = array_map(function($c) { return $c['name']; }, $cols);
        
        $db->beginTransaction();
        
        if (!in_array('parent_comment_id', $columnNames)) {
            $db->exec("ALTER TABLE comments ADD COLUMN parent_comment_id INTEGER DEFAULT NULL");
        }
        
        if (!in_array('is_deleted', $columnNames)) {
            $db->exec("ALTER TABLE comments ADD COLUMN is_deleted INTEGER DEFAULT 0");
        }
        
        if (!in_array('deleted_by', $columnNames)) {
            $db->exec("ALTER TABLE comments ADD COLUMN deleted_by TEXT DEFAULT NULL");
        }
        
        if (!in_array('deleted_at', $columnNames)) {
            $db->exec("ALTER TABLE comments ADD COLUMN deleted_at INTEGER DEFAULT NULL");
        }
        
        $db->commit();
        
        $db->exec("CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id)");
        
    } catch (PDOException $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        http_response_code(500);
        echo json_encode(['error' => 'Schema migration failed: ' . $e->getMessage()]);
        exit;
    }
    
} catch (PDOException $e) {
    Logger::error('Database initialization failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
    http_response_code(500);
    echo json_encode(['error' => 'Database initialization failed: ' . $e->getMessage()]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $marketId = isset($_GET['market_id']) ? intval($_GET['market_id']) : 0;
    Logger::info('GET request', ['market_id' => $marketId]);
    
    if ($marketId <= 0) {
        Logger::warning('Invalid market_id in GET request', ['market_id' => $marketId]);
        http_response_code(400);
        echo json_encode(['error' => 'Invalid market_id']);
        exit;
    }
    
    try {
        $stmt = $db->prepare("SELECT id, market_id, user_account, comment_text, created_at, 
                                     parent_comment_id, is_deleted, deleted_by, deleted_at
                              FROM comments 
                              WHERE market_id = :market_id 
                              ORDER BY created_at ASC");
        $stmt->bindParam(':market_id', $marketId, PDO::PARAM_INT);
        $stmt->execute();
        
        $comments = $stmt->fetchAll(PDO::FETCH_ASSOC);
        Logger::info('Comments fetched successfully', ['market_id' => $marketId, 'count' => count($comments), 'admins_count' => count($commentAdmins)]);
        echo json_encode(['success' => true, 'comments' => $comments, 'admins' => $commentAdmins]);
        
    } catch (PDOException $e) {
        Logger::error('Failed to fetch comments', ['market_id' => $marketId, 'error' => $e->getMessage()]);
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch comments: ' . $e->getMessage()]);
    }
    
} elseif ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $marketId = isset($input['market_id']) ? intval($input['market_id']) : 0;
    $userAccount = isset($input['user_account']) ? trim($input['user_account']) : '';
    $commentText = isset($input['comment_text']) ? trim($input['comment_text']) : '';
    $parentCommentId = isset($input['parent_comment_id']) ? intval($input['parent_comment_id']) : null;
    
    Logger::info('POST request', ['market_id' => $marketId, 'user' => $userAccount, 'parent_id' => $parentCommentId, 'text_length' => strlen($commentText)]);
    
    if ($marketId <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid market_id']);
        exit;
    }
    
    if (empty($userAccount)) {
        http_response_code(400);
        echo json_encode(['error' => 'User account is required']);
        exit;
    }
    
    if (empty($commentText)) {
        http_response_code(400);
        echo json_encode(['error' => 'Comment text is required']);
        exit;
    }
    
    if (strlen($commentText) > 1000) {
        http_response_code(400);
        echo json_encode(['error' => 'Comment text too long (max 1000 characters)']);
        exit;
    }
    
    try {
        $createdAt = time();
        $stmt = $db->prepare("INSERT INTO comments (market_id, user_account, comment_text, created_at, parent_comment_id) 
                              VALUES (:market_id, :user_account, :comment_text, :created_at, :parent_comment_id)");
        $stmt->bindParam(':market_id', $marketId, PDO::PARAM_INT);
        $stmt->bindParam(':user_account', $userAccount, PDO::PARAM_STR);
        $stmt->bindParam(':comment_text', $commentText, PDO::PARAM_STR);
        $stmt->bindParam(':created_at', $createdAt, PDO::PARAM_INT);
        $stmt->bindParam(':parent_comment_id', $parentCommentId, PDO::PARAM_INT);
        $stmt->execute();
        
        $commentId = $db->lastInsertId();
        Logger::info('Comment saved successfully', ['comment_id' => $commentId, 'market_id' => $marketId, 'user' => $userAccount]);
        
        echo json_encode([
            'success' => true,
            'comment' => [
                'id' => $commentId,
                'market_id' => $marketId,
                'user_account' => $userAccount,
                'comment_text' => $commentText,
                'created_at' => $createdAt,
                'parent_comment_id' => $parentCommentId,
                'is_deleted' => 0
            ]
        ]);
        
        // Create notifications for replies and mentions
        if ($parentCommentId) {
            notifyCommentReply($parentCommentId, $userAccount, $marketId);
        }
        notifyMentions($commentText, $marketId, $userAccount);
        
    } catch (PDOException $e) {
        Logger::error('Failed to save comment', ['market_id' => $marketId, 'user' => $userAccount, 'error' => $e->getMessage()]);
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save comment: ' . $e->getMessage()]);
    }
    
} elseif ($method === 'DELETE') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $commentId = isset($input['comment_id']) ? intval($input['comment_id']) : 0;
    $userAccount = isset($input['user_account']) ? trim($input['user_account']) : '';
    
    Logger::info('DELETE request', ['comment_id' => $commentId, 'user' => $userAccount]);
    
    if ($commentId <= 0) {
        Logger::warning('Invalid comment_id in DELETE request', ['comment_id' => $commentId]);
        http_response_code(400);
        echo json_encode(['error' => 'Invalid comment_id']);
        exit;
    }
    
    if (empty($userAccount)) {
        Logger::warning('Missing user_account in DELETE request');
        http_response_code(400);
        echo json_encode(['error' => 'User account is required']);
        exit;
    }
    
    if (!in_array($userAccount, $commentAdmins)) {
        Logger::warning('Unauthorized delete attempt', ['user' => $userAccount, 'admins' => $commentAdmins]);
        http_response_code(403);
        echo json_encode(['error' => 'Unauthorized: Only comment admins can delete comments']);
        exit;
    }
    
    Logger::info('Delete authorized', ['user' => $userAccount, 'comment_id' => $commentId]);
    
    try {
        $deletedAt = time();
        $stmt = $db->prepare("UPDATE comments 
                              SET is_deleted = 1, deleted_by = :deleted_by, deleted_at = :deleted_at 
                              WHERE id = :comment_id");
        $stmt->bindParam(':deleted_by', $userAccount, PDO::PARAM_STR);
        $stmt->bindParam(':deleted_at', $deletedAt, PDO::PARAM_INT);
        $stmt->bindParam(':comment_id', $commentId, PDO::PARAM_INT);
        $stmt->execute();
        
        Logger::info('Comment deleted successfully', ['comment_id' => $commentId, 'deleted_by' => $userAccount]);
        
        echo json_encode([
            'success' => true,
            'message' => 'Comment deleted successfully'
        ]);
        
    } catch (PDOException $e) {
        Logger::error('Failed to delete comment', ['comment_id' => $commentId, 'error' => $e->getMessage()]);
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete comment: ' . $e->getMessage()]);
    }
    
} else {
    Logger::warning('Method not allowed', ['method' => $method]);
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
