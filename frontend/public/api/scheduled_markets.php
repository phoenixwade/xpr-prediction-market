<?php
/**
 * Scheduled Markets API
 * Stores and retrieves scheduled markets that will be created automatically at a future time
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/logger.php';

$dbPath = __DIR__ . '/../data/scheduled_markets.db';
$dbDir = dirname($dbPath);

if (!is_dir($dbDir)) {
    mkdir($dbDir, 0755, true);
}

try {
    $db = new SQLite3($dbPath);
    $db->busyTimeout(5000);
    
    $db->exec('
        CREATE TABLE IF NOT EXISTS scheduled_markets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            creator TEXT NOT NULL,
            question TEXT NOT NULL,
            description TEXT NOT NULL,
            outcomes TEXT NOT NULL,
            category TEXT DEFAULT "general",
            resolution_criteria TEXT,
            scheduled_open_time INTEGER NOT NULL,
            scheduled_close_time INTEGER NOT NULL,
            auto_resolve INTEGER DEFAULT 0,
            resolution_source TEXT,
            status TEXT DEFAULT "pending",
            created_at INTEGER NOT NULL,
            processed_at INTEGER,
            market_id INTEGER,
            error_message TEXT
        )
    ');
    
    $db->exec('CREATE INDEX IF NOT EXISTS idx_status ON scheduled_markets(status)');
    $db->exec('CREATE INDEX IF NOT EXISTS idx_scheduled_open ON scheduled_markets(scheduled_open_time)');
    $db->exec('CREATE INDEX IF NOT EXISTS idx_creator ON scheduled_markets(creator)');
    
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        // Validate required fields
        $required = ['creator', 'question', 'description', 'outcomes', 'scheduled_open_time', 'scheduled_close_time'];
        foreach ($required as $field) {
            if (!isset($data[$field]) || (is_string($data[$field]) && empty(trim($data[$field])))) {
                http_response_code(400);
                echo json_encode(['error' => "Missing required field: $field"]);
                exit;
            }
        }
        
        // Validate outcomes
        $outcomes = $data['outcomes'];
        if (!is_array($outcomes) || count($outcomes) < 2) {
            http_response_code(400);
            echo json_encode(['error' => 'At least 2 outcomes are required']);
            exit;
        }
        
        // Validate times
        $openTime = intval($data['scheduled_open_time']);
        $closeTime = intval($data['scheduled_close_time']);
        $now = time();
        
        if ($openTime <= $now) {
            http_response_code(400);
            echo json_encode(['error' => 'Scheduled open time must be in the future']);
            exit;
        }
        
        if ($closeTime <= $openTime) {
            http_response_code(400);
            echo json_encode(['error' => 'Close time must be after open time']);
            exit;
        }
        
        // Minimum 24 hour market duration
        if ($closeTime - $openTime < 86400) {
            http_response_code(400);
            echo json_encode(['error' => 'Market must be open for at least 24 hours']);
            exit;
        }
        
        $stmt = $db->prepare('
            INSERT INTO scheduled_markets (
                creator, question, description, outcomes, category, 
                resolution_criteria, scheduled_open_time, scheduled_close_time,
                auto_resolve, resolution_source, created_at
            ) VALUES (
                :creator, :question, :description, :outcomes, :category,
                :resolution_criteria, :scheduled_open_time, :scheduled_close_time,
                :auto_resolve, :resolution_source, :created_at
            )
        ');
        
        $stmt->bindValue(':creator', $data['creator'], SQLITE3_TEXT);
        $stmt->bindValue(':question', $data['question'], SQLITE3_TEXT);
        $stmt->bindValue(':description', $data['description'], SQLITE3_TEXT);
        $stmt->bindValue(':outcomes', json_encode($outcomes), SQLITE3_TEXT);
        $stmt->bindValue(':category', $data['category'] ?? 'general', SQLITE3_TEXT);
        $stmt->bindValue(':resolution_criteria', $data['resolution_criteria'] ?? '', SQLITE3_TEXT);
        $stmt->bindValue(':scheduled_open_time', $openTime, SQLITE3_INTEGER);
        $stmt->bindValue(':scheduled_close_time', $closeTime, SQLITE3_INTEGER);
        $stmt->bindValue(':auto_resolve', $data['auto_resolve'] ? 1 : 0, SQLITE3_INTEGER);
        $stmt->bindValue(':resolution_source', $data['resolution_source'] ?? '', SQLITE3_TEXT);
        $stmt->bindValue(':created_at', $now, SQLITE3_INTEGER);
        
        $stmt->execute();
        $id = $db->lastInsertRowID();
        
        logApiRequest('scheduled_markets', 'POST', ['id' => $id, 'creator' => $data['creator']]);
        echo json_encode([
            'success' => true,
            'id' => $id,
            'message' => 'Market scheduled successfully. It will be created automatically at the scheduled time.'
        ]);
        
    } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $creator = $_GET['creator'] ?? '';
        $status = $_GET['status'] ?? '';
        $limit = intval($_GET['limit'] ?? 50);
        
        $query = 'SELECT * FROM scheduled_markets WHERE 1=1';
        $params = [];
        
        if (!empty($creator)) {
            $query .= ' AND creator = :creator';
            $params[':creator'] = $creator;
        }
        
        if (!empty($status)) {
            $query .= ' AND status = :status';
            $params[':status'] = $status;
        }
        
        $query .= ' ORDER BY scheduled_open_time ASC LIMIT :limit';
        
        $stmt = $db->prepare($query);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value, SQLITE3_TEXT);
        }
        $stmt->bindValue(':limit', $limit, SQLITE3_INTEGER);
        
        $result = $stmt->execute();
        $markets = [];
        
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $markets[] = [
                'id' => intval($row['id']),
                'creator' => $row['creator'],
                'question' => $row['question'],
                'description' => $row['description'],
                'outcomes' => json_decode($row['outcomes'], true),
                'category' => $row['category'],
                'resolution_criteria' => $row['resolution_criteria'],
                'scheduled_open_time' => intval($row['scheduled_open_time']),
                'scheduled_close_time' => intval($row['scheduled_close_time']),
                'auto_resolve' => boolval($row['auto_resolve']),
                'resolution_source' => $row['resolution_source'],
                'status' => $row['status'],
                'created_at' => intval($row['created_at']),
                'processed_at' => $row['processed_at'] ? intval($row['processed_at']) : null,
                'market_id' => $row['market_id'] ? intval($row['market_id']) : null,
                'error_message' => $row['error_message']
            ];
        }
        
        logApiRequest('scheduled_markets', 'GET', ['count' => count($markets)]);
        echo json_encode(['scheduled_markets' => $markets]);
        
    } elseif ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($data['id']) || !isset($data['creator'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields: id and creator']);
            exit;
        }
        
        // Only allow deletion of pending markets by the creator
        $stmt = $db->prepare('
            DELETE FROM scheduled_markets 
            WHERE id = :id AND creator = :creator AND status = "pending"
        ');
        $stmt->bindValue(':id', intval($data['id']), SQLITE3_INTEGER);
        $stmt->bindValue(':creator', $data['creator'], SQLITE3_TEXT);
        $stmt->execute();
        
        $changes = $db->changes();
        
        if ($changes > 0) {
            logApiRequest('scheduled_markets', 'DELETE', ['id' => $data['id']]);
            echo json_encode(['success' => true, 'message' => 'Scheduled market deleted']);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Scheduled market not found or cannot be deleted']);
        }
    }
    
    $db->close();
} catch (Exception $e) {
    logApiRequest('scheduled_markets', $_SERVER['REQUEST_METHOD'], ['error' => $e->getMessage()]);
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
