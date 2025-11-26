<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/logger.php';

$dbPath = __DIR__ . '/../data/notifications.db';
$dbDir = dirname($dbPath);

if (!is_dir($dbDir)) {
    mkdir($dbDir, 0755, true);
}

try {
    $db = new SQLite3($dbPath);
    
    $db->exec('
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account TEXT NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            read INTEGER DEFAULT 0,
            market_id INTEGER,
            link TEXT
        )
    ');
    
    $db->exec('CREATE INDEX IF NOT EXISTS idx_account ON notifications(account)');
    $db->exec('CREATE INDEX IF NOT EXISTS idx_timestamp ON notifications(timestamp)');
    
    $db->exec('
        CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account TEXT NOT NULL,
            market_id INTEGER NOT NULL,
            notify_trades INTEGER DEFAULT 1,
            notify_comments INTEGER DEFAULT 1,
            notify_resolution INTEGER DEFAULT 1,
            UNIQUE(account, market_id)
        )
    ');
    
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $account = $_GET['account'] ?? '';
        
        if (empty($account)) {
            http_response_code(400);
            echo json_encode(['error' => 'Account required']);
            exit;
        }
        
        $stmt = $db->prepare('
            SELECT * FROM notifications 
            WHERE account = :account 
            ORDER BY timestamp DESC 
            LIMIT 100
        ');
        $stmt->bindValue(':account', $account, SQLITE3_TEXT);
        
        $result = $stmt->execute();
        $notifications = [];
        
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $notifications[] = [
                'id' => intval($row['id']),
                'type' => $row['type'],
                'title' => $row['title'],
                'message' => $row['message'],
                'timestamp' => intval($row['timestamp']),
                'read' => boolval($row['read']),
                'marketId' => $row['market_id'] ? intval($row['market_id']) : null,
                'link' => $row['link']
            ];
        }
        
        logApiRequest('notifications', 'GET', ['account' => $account, 'count' => count($notifications)]);
        echo json_encode(['notifications' => $notifications]);
        
    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($data['account']) || !isset($data['type']) || !isset($data['title'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }
        
        $stmt = $db->prepare('
            INSERT INTO notifications (account, type, title, message, timestamp, market_id, link)
            VALUES (:account, :type, :title, :message, :timestamp, :market_id, :link)
        ');
        
        $stmt->bindValue(':account', $data['account'], SQLITE3_TEXT);
        $stmt->bindValue(':type', $data['type'], SQLITE3_TEXT);
        $stmt->bindValue(':title', $data['title'], SQLITE3_TEXT);
        $stmt->bindValue(':message', $data['message'] ?? '', SQLITE3_TEXT);
        $stmt->bindValue(':timestamp', intval($data['timestamp'] ?? time()), SQLITE3_INTEGER);
        $stmt->bindValue(':market_id', $data['market_id'] ?? null, SQLITE3_INTEGER);
        $stmt->bindValue(':link', $data['link'] ?? null, SQLITE3_TEXT);
        
        $stmt->execute();
        
        logApiRequest('notifications', 'POST', ['account' => $data['account']]);
        echo json_encode(['success' => true, 'id' => $db->lastInsertRowID()]);
        
    } elseif ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (isset($data['mark_all_read']) && isset($data['account'])) {
            $stmt = $db->prepare('UPDATE notifications SET read = 1 WHERE account = :account');
            $stmt->bindValue(':account', $data['account'], SQLITE3_TEXT);
            $stmt->execute();
            
            logApiRequest('notifications', 'PUT', ['action' => 'mark_all_read']);
            echo json_encode(['success' => true]);
        } elseif (isset($data['notification_id'])) {
            $stmt = $db->prepare('UPDATE notifications SET read = :read WHERE id = :id');
            $stmt->bindValue(':read', intval($data['read'] ?? 1), SQLITE3_INTEGER);
            $stmt->bindValue(':id', intval($data['notification_id']), SQLITE3_INTEGER);
            $stmt->execute();
            
            logApiRequest('notifications', 'PUT', ['notification_id' => $data['notification_id']]);
            echo json_encode(['success' => true]);
        } else {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid request']);
        }
    }
    
    $db->close();
} catch (Exception $e) {
    logApiRequest('notifications', $_SERVER['REQUEST_METHOD'], ['error' => $e->getMessage()]);
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
