<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/logger.php';

$dbPath = __DIR__ . '/../data/webhooks.db';
$dbDir = dirname($dbPath);

if (!is_dir($dbDir)) {
    mkdir($dbDir, 0755, true);
}

try {
    $db = new SQLite3($dbPath);
    
    $db->exec('
        CREATE TABLE IF NOT EXISTS webhooks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account TEXT NOT NULL,
            url TEXT NOT NULL,
            events TEXT NOT NULL,
            secret TEXT,
            active INTEGER DEFAULT 1,
            created_at INTEGER NOT NULL
        )
    ');
    
    $db->exec('CREATE INDEX IF NOT EXISTS idx_account ON webhooks(account)');
    
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $account = $_GET['account'] ?? '';
        
        if (empty($account)) {
            http_response_code(400);
            echo json_encode(['error' => 'Account required']);
            exit;
        }
        
        $stmt = $db->prepare('SELECT * FROM webhooks WHERE account = :account AND active = 1');
        $stmt->bindValue(':account', $account, SQLITE3_TEXT);
        
        $result = $stmt->execute();
        $webhooks = [];
        
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $webhooks[] = [
                'id' => intval($row['id']),
                'url' => $row['url'],
                'events' => json_decode($row['events'], true),
                'active' => boolval($row['active']),
                'created_at' => intval($row['created_at'])
            ];
        }
        
        logApiRequest('webhooks', 'GET', ['account' => $account, 'count' => count($webhooks)]);
        echo json_encode(['webhooks' => $webhooks]);
        
    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($data['account']) || !isset($data['url']) || !isset($data['events'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }
        
        $secret = bin2hex(random_bytes(32));
        
        $stmt = $db->prepare('
            INSERT INTO webhooks (account, url, events, secret, created_at)
            VALUES (:account, :url, :events, :secret, :created_at)
        ');
        
        $stmt->bindValue(':account', $data['account'], SQLITE3_TEXT);
        $stmt->bindValue(':url', $data['url'], SQLITE3_TEXT);
        $stmt->bindValue(':events', json_encode($data['events']), SQLITE3_TEXT);
        $stmt->bindValue(':secret', $secret, SQLITE3_TEXT);
        $stmt->bindValue(':created_at', time(), SQLITE3_INTEGER);
        
        $stmt->execute();
        
        logApiRequest('webhooks', 'POST', ['account' => $data['account']]);
        echo json_encode([
            'success' => true,
            'id' => $db->lastInsertRowID(),
            'secret' => $secret
        ]);
        
    } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($data['id']) || !isset($data['account'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }
        
        $stmt = $db->prepare('
            UPDATE webhooks 
            SET active = 0 
            WHERE id = :id AND account = :account
        ');
        $stmt->bindValue(':id', intval($data['id']), SQLITE3_INTEGER);
        $stmt->bindValue(':account', $data['account'], SQLITE3_TEXT);
        
        $stmt->execute();
        
        logApiRequest('webhooks', 'DELETE', ['id' => $data['id']]);
        echo json_encode(['success' => true]);
    }
    
    $db->close();
} catch (Exception $e) {
    logApiRequest('webhooks', $_SERVER['REQUEST_METHOD'], ['error' => $e->getMessage()]);
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

function triggerWebhook($account, $event, $data) {
    $dbPath = __DIR__ . '/../data/webhooks.db';
    
    try {
        $db = new SQLite3($dbPath);
        
        $stmt = $db->prepare('
            SELECT url, secret, events 
            FROM webhooks 
            WHERE account = :account AND active = 1
        ');
        $stmt->bindValue(':account', $account, SQLITE3_TEXT);
        
        $result = $stmt->execute();
        
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $events = json_decode($row['events'], true);
            
            if (in_array($event, $events)) {
                $payload = json_encode([
                    'event' => $event,
                    'data' => $data,
                    'timestamp' => time()
                ]);
                
                $signature = hash_hmac('sha256', $payload, $row['secret']);
                
                $ch = curl_init($row['url']);
                curl_setopt($ch, CURLOPT_POST, 1);
                curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
                curl_setopt($ch, CURLOPT_HTTPHEADER, [
                    'Content-Type: application/json',
                    'X-Webhook-Signature: ' . $signature
                ]);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_TIMEOUT, 5);
                
                curl_exec($ch);
                curl_close($ch);
            }
        }
        
        $db->close();
    } catch (Exception $e) {
        error_log("Webhook trigger error: " . $e->getMessage());
    }
}
