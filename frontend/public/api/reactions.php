<?php
require_once __DIR__ . '/logger.php';

Logger::init();
Logger::info('Reactions API request started');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    Logger::debug('OPTIONS request - returning CORS headers');
    exit(0);
}

// Valid reaction types with their display emojis
$validReactions = [
    'like' => '👍',
    'love' => '❤️',
    'sad' => '😢',
    'angry' => '😠',
    'wow' => '😮',
    'fire' => '💯'
];

$dbPath = getenv('REACTIONS_DB_PATH') ?: __DIR__ . '/../data/reactions.db';
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
    
    // Create reactions table with unique constraint on comment_id + user_account
    // One reaction per user per comment
    $db->exec("CREATE TABLE IF NOT EXISTS comment_reactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        comment_id INTEGER NOT NULL,
        market_id INTEGER NOT NULL,
        user_account TEXT NOT NULL,
        reaction_type TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(comment_id, user_account)
    )");
    
    $db->exec("CREATE INDEX IF NOT EXISTS idx_reactions_comment_id ON comment_reactions(comment_id)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_reactions_market_id ON comment_reactions(market_id)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_reactions_user ON comment_reactions(user_account)");
    
} catch (PDOException $e) {
    Logger::error('Database initialization failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
    http_response_code(500);
    echo json_encode(['error' => 'Database initialization failed: ' . $e->getMessage()]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Support two modes:
    // 1. Batch mode: market_id - returns all reactions for all comments in a market (keyed by comment_id)
    // 2. Single mode: comment_id - returns reactions for a single comment
    $marketId = isset($_GET['market_id']) ? intval($_GET['market_id']) : 0;
    $commentId = isset($_GET['comment_id']) ? intval($_GET['comment_id']) : 0;
    $userAccount = isset($_GET['user_account']) ? trim($_GET['user_account']) : '';
    
    Logger::info('GET request', ['market_id' => $marketId, 'comment_id' => $commentId, 'user_account' => $userAccount]);
    
    if ($marketId <= 0 && $commentId <= 0) {
        Logger::warning('Invalid request - need market_id or comment_id');
        http_response_code(400);
        echo json_encode(['error' => 'Either market_id or comment_id is required']);
        exit;
    }
    
    try {
        if ($marketId > 0) {
            // Batch mode: Get all reactions for all comments in this market
            $stmt = $db->prepare("SELECT id, comment_id, market_id, user_account, reaction_type, created_at
                                  FROM comment_reactions 
                                  WHERE market_id = :market_id 
                                  ORDER BY created_at ASC");
            $stmt->bindParam(':market_id', $marketId, PDO::PARAM_INT);
            $stmt->execute();
            
            $reactions = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Group reactions by comment_id, then by type
            $byComment = [];
            $userReactions = []; // Track user's reaction per comment
            
            foreach ($reactions as $reaction) {
                $cid = $reaction['comment_id'];
                $type = $reaction['reaction_type'];
                
                if (!isset($byComment[$cid])) {
                    $byComment[$cid] = [];
                    foreach ($validReactions as $rtype => $emoji) {
                        $byComment[$cid][$rtype] = [
                            'emoji' => $emoji,
                            'count' => 0,
                            'users' => []
                        ];
                    }
                }
                
                if (isset($byComment[$cid][$type])) {
                    $byComment[$cid][$type]['count']++;
                    $byComment[$cid][$type]['users'][] = $reaction['user_account'];
                }
                
                // Track user's reaction for this comment
                if ($userAccount && $reaction['user_account'] === $userAccount) {
                    $userReactions[$cid] = $type;
                }
            }
            
            Logger::info('Batch reactions fetched successfully', ['market_id' => $marketId, 'total' => count($reactions)]);
            echo json_encode([
                'success' => true,
                'reactions_by_comment' => $byComment,
                'user_reactions' => $userReactions,
                'reaction_types' => $validReactions
            ]);
            
        } else {
            // Single comment mode
            $stmt = $db->prepare("SELECT id, comment_id, market_id, user_account, reaction_type, created_at
                                  FROM comment_reactions 
                                  WHERE comment_id = :comment_id 
                                  ORDER BY created_at ASC");
            $stmt->bindParam(':comment_id', $commentId, PDO::PARAM_INT);
            $stmt->execute();
            
            $reactions = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Group reactions by type with counts
            $grouped = [];
            foreach ($validReactions as $type => $emoji) {
                $grouped[$type] = [
                    'emoji' => $emoji,
                    'count' => 0,
                    'users' => []
                ];
            }
            
            $userReaction = null;
            
            foreach ($reactions as $reaction) {
                $type = $reaction['reaction_type'];
                if (isset($grouped[$type])) {
                    $grouped[$type]['count']++;
                    $grouped[$type]['users'][] = $reaction['user_account'];
                    
                    if ($userAccount && $reaction['user_account'] === $userAccount) {
                        $userReaction = $type;
                    }
                }
            }
            
            $totalReactions = count($reactions);
            
            Logger::info('Reactions fetched successfully', ['comment_id' => $commentId, 'total' => $totalReactions]);
            echo json_encode([
                'success' => true,
                'reactions' => $grouped,
                'total' => $totalReactions,
                'user_reaction' => $userReaction,
                'reaction_types' => $validReactions
            ]);
        }
        
    } catch (PDOException $e) {
        Logger::error('Failed to fetch reactions', ['error' => $e->getMessage()]);
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch reactions: ' . $e->getMessage()]);
    }
    
} elseif ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    
    $commentId = isset($input['comment_id']) ? intval($input['comment_id']) : 0;
    $marketId = isset($input['market_id']) ? intval($input['market_id']) : 0;
    $userAccount = isset($input['user_account']) ? trim($input['user_account']) : '';
    $reactionType = isset($input['reaction_type']) ? trim($input['reaction_type']) : '';
    
    Logger::info('POST request', ['comment_id' => $commentId, 'market_id' => $marketId, 'user' => $userAccount, 'reaction_type' => $reactionType]);
    
    if ($commentId <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid comment_id']);
        exit;
    }
    
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
    
    if (empty($reactionType) || !isset($validReactions[$reactionType])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid reaction type. Valid types: ' . implode(', ', array_keys($validReactions))]);
        exit;
    }
    
    try {
        // Check if user already has a reaction on this comment
        $checkStmt = $db->prepare("SELECT id, reaction_type FROM comment_reactions WHERE comment_id = :comment_id AND user_account = :user_account");
        $checkStmt->bindParam(':comment_id', $commentId, PDO::PARAM_INT);
        $checkStmt->bindParam(':user_account', $userAccount, PDO::PARAM_STR);
        $checkStmt->execute();
        $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);
        
        if ($existing) {
            if ($existing['reaction_type'] === $reactionType) {
                // Same reaction - remove it (toggle off)
                $deleteStmt = $db->prepare("DELETE FROM comment_reactions WHERE id = :id");
                $deleteStmt->bindParam(':id', $existing['id'], PDO::PARAM_INT);
                $deleteStmt->execute();
                
                Logger::info('Reaction removed (toggle)', ['comment_id' => $commentId, 'user' => $userAccount, 'reaction_type' => $reactionType]);
                echo json_encode([
                    'success' => true,
                    'action' => 'removed',
                    'message' => 'Reaction removed'
                ]);
            } else {
                // Different reaction - update it
                $updateStmt = $db->prepare("UPDATE comment_reactions SET reaction_type = :reaction_type, created_at = :created_at WHERE id = :id");
                $createdAt = time();
                $updateStmt->bindParam(':reaction_type', $reactionType, PDO::PARAM_STR);
                $updateStmt->bindParam(':created_at', $createdAt, PDO::PARAM_INT);
                $updateStmt->bindParam(':id', $existing['id'], PDO::PARAM_INT);
                $updateStmt->execute();
                
                Logger::info('Reaction updated', ['comment_id' => $commentId, 'user' => $userAccount, 'old_type' => $existing['reaction_type'], 'new_type' => $reactionType]);
                echo json_encode([
                    'success' => true,
                    'action' => 'updated',
                    'message' => 'Reaction updated',
                    'reaction' => [
                        'id' => $existing['id'],
                        'comment_id' => $commentId,
                        'market_id' => $marketId,
                        'user_account' => $userAccount,
                        'reaction_type' => $reactionType,
                        'created_at' => $createdAt
                    ]
                ]);
            }
        } else {
            // No existing reaction - create new one
            $createdAt = time();
            $stmt = $db->prepare("INSERT INTO comment_reactions (comment_id, market_id, user_account, reaction_type, created_at) 
                                  VALUES (:comment_id, :market_id, :user_account, :reaction_type, :created_at)");
            $stmt->bindParam(':comment_id', $commentId, PDO::PARAM_INT);
            $stmt->bindParam(':market_id', $marketId, PDO::PARAM_INT);
            $stmt->bindParam(':user_account', $userAccount, PDO::PARAM_STR);
            $stmt->bindParam(':reaction_type', $reactionType, PDO::PARAM_STR);
            $stmt->bindParam(':created_at', $createdAt, PDO::PARAM_INT);
            $stmt->execute();
            
            $reactionId = $db->lastInsertId();
            Logger::info('Reaction saved successfully', ['reaction_id' => $reactionId, 'comment_id' => $commentId, 'user' => $userAccount]);
            
            echo json_encode([
                'success' => true,
                'action' => 'added',
                'message' => 'Reaction added',
                'reaction' => [
                    'id' => $reactionId,
                    'comment_id' => $commentId,
                    'market_id' => $marketId,
                    'user_account' => $userAccount,
                    'reaction_type' => $reactionType,
                    'created_at' => $createdAt
                ]
            ]);
        }
        
    } catch (PDOException $e) {
        Logger::error('Failed to save reaction', ['comment_id' => $commentId, 'user' => $userAccount, 'error' => $e->getMessage()]);
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save reaction: ' . $e->getMessage()]);
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
    
    try {
        $stmt = $db->prepare("DELETE FROM comment_reactions WHERE comment_id = :comment_id AND user_account = :user_account");
        $stmt->bindParam(':comment_id', $commentId, PDO::PARAM_INT);
        $stmt->bindParam(':user_account', $userAccount, PDO::PARAM_STR);
        $stmt->execute();
        
        $rowsDeleted = $stmt->rowCount();
        
        if ($rowsDeleted > 0) {
            Logger::info('Reaction deleted successfully', ['comment_id' => $commentId, 'user' => $userAccount]);
            echo json_encode([
                'success' => true,
                'message' => 'Reaction removed'
            ]);
        } else {
            Logger::info('No reaction found to delete', ['comment_id' => $commentId, 'user' => $userAccount]);
            echo json_encode([
                'success' => true,
                'message' => 'No reaction found'
            ]);
        }
        
    } catch (PDOException $e) {
        Logger::error('Failed to delete reaction', ['comment_id' => $commentId, 'user' => $userAccount, 'error' => $e->getMessage()]);
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete reaction: ' . $e->getMessage()]);
    }
    
} else {
    Logger::warning('Method not allowed', ['method' => $method]);
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
