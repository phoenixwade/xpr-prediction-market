<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$dbPath = __DIR__ . '/../data/comments.db';
$dataDir = dirname($dbPath);

if (!file_exists($dataDir)) {
    mkdir($dataDir, 0755, true);
}

if (!in_array('sqlite', PDO::getAvailableDrivers())) {
    http_response_code(500);
    echo json_encode(['error' => 'PDO SQLite driver not available on this server']);
    exit;
}

try {
    $db = new PDO('sqlite:' . $dbPath);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $db->exec("CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        market_id INTEGER NOT NULL,
        user_account TEXT NOT NULL,
        comment_text TEXT NOT NULL,
        created_at INTEGER NOT NULL
    )");
    
    $db->exec("CREATE INDEX IF NOT EXISTS idx_comments_market_id ON comments(market_id)");
    
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database initialization failed: ' . $e->getMessage()]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $marketId = isset($_GET['market_id']) ? intval($_GET['market_id']) : 0;
    
    if ($marketId <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid market_id']);
        exit;
    }
    
    try {
        $stmt = $db->prepare("SELECT id, market_id, user_account, comment_text, created_at 
                              FROM comments 
                              WHERE market_id = :market_id 
                              ORDER BY created_at ASC");
        $stmt->bindParam(':market_id', $marketId, PDO::PARAM_INT);
        $stmt->execute();
        
        $comments = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'comments' => $comments]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch comments: ' . $e->getMessage()]);
    }
    
} elseif ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $marketId = isset($input['market_id']) ? intval($input['market_id']) : 0;
    $userAccount = isset($input['user_account']) ? trim($input['user_account']) : '';
    $commentText = isset($input['comment_text']) ? trim($input['comment_text']) : '';
    
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
        $stmt = $db->prepare("INSERT INTO comments (market_id, user_account, comment_text, created_at) 
                              VALUES (:market_id, :user_account, :comment_text, :created_at)");
        $stmt->bindParam(':market_id', $marketId, PDO::PARAM_INT);
        $stmt->bindParam(':user_account', $userAccount, PDO::PARAM_STR);
        $stmt->bindParam(':comment_text', $commentText, PDO::PARAM_STR);
        $stmt->bindParam(':created_at', $createdAt, PDO::PARAM_INT);
        $stmt->execute();
        
        $commentId = $db->lastInsertId();
        
        echo json_encode([
            'success' => true,
            'comment' => [
                'id' => $commentId,
                'market_id' => $marketId,
                'user_account' => $userAccount,
                'comment_text' => $commentText,
                'created_at' => $createdAt
            ]
        ]);
        
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save comment: ' . $e->getMessage()]);
    }
    
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
