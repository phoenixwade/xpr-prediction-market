<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/logger.php';
require_once __DIR__ . '/notify_helper.php';

$dbPath = __DIR__ . '/../data/resolutions.db';
$dbDir = dirname($dbPath);

if (!is_dir($dbDir)) {
    mkdir($dbDir, 0755, true);
}

try {
    $db = new SQLite3($dbPath);
    
    $db->exec('
        CREATE TABLE IF NOT EXISTS resolutions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            market_id INTEGER NOT NULL,
            outcome_id INTEGER NOT NULL,
            resolver TEXT NOT NULL,
            notes TEXT,
            evidence_url TEXT,
            timestamp INTEGER NOT NULL
        )
    ');
    
    $db->exec('CREATE INDEX IF NOT EXISTS idx_market ON resolutions(market_id)');
    
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($data['market_id']) || !isset($data['outcome_id']) || !isset($data['resolver'])) {
            logApiRequest('resolutions', 'POST', ['error' => 'Missing required fields']);
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }
        
        $stmt = $db->prepare('
            INSERT INTO resolutions (market_id, outcome_id, resolver, notes, evidence_url, timestamp)
            VALUES (:market_id, :outcome_id, :resolver, :notes, :evidence_url, :timestamp)
        ');
        
        $stmt->bindValue(':market_id', intval($data['market_id']), SQLITE3_INTEGER);
        $stmt->bindValue(':outcome_id', intval($data['outcome_id']), SQLITE3_INTEGER);
        $stmt->bindValue(':resolver', $data['resolver'], SQLITE3_TEXT);
        $stmt->bindValue(':notes', $data['notes'] ?? '', SQLITE3_TEXT);
        $stmt->bindValue(':evidence_url', $data['evidence_url'] ?? '', SQLITE3_TEXT);
        $stmt->bindValue(':timestamp', intval($data['timestamp']), SQLITE3_INTEGER);
        
        $stmt->execute();
        
        logApiRequest('resolutions', 'POST', ['market_id' => $data['market_id']]);
        echo json_encode(['success' => true, 'id' => $db->lastInsertRowID()]);
        
        // Notify all market participants about the resolution
        $marketId = intval($data['market_id']);
        $outcomeId = intval($data['outcome_id']);
        $resolver = $data['resolver'];
        $title = "Market resolved";
        $message = "A market you participated in has been resolved. Check your positions to claim winnings.";
        notifyMarketParticipants($marketId, 'resolution', $title, $message, $resolver);
        
    } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $marketId = isset($_GET['market_id']) ? intval($_GET['market_id']) : null;
        
        if ($marketId) {
            $stmt = $db->prepare('
                SELECT * FROM resolutions 
                WHERE market_id = :market_id 
                ORDER BY timestamp DESC
            ');
            $stmt->bindValue(':market_id', $marketId, SQLITE3_INTEGER);
        } else {
            $stmt = $db->prepare('
                SELECT * FROM resolutions 
                ORDER BY timestamp DESC 
                LIMIT 100
            ');
        }
        
        $result = $stmt->execute();
        $resolutions = [];
        
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $resolutions[] = $row;
        }
        
        logApiRequest('resolutions', 'GET', ['count' => count($resolutions)]);
        echo json_encode(['resolutions' => $resolutions]);
    }
    
    $db->close();
} catch (Exception $e) {
    logApiRequest('resolutions', $_SERVER['REQUEST_METHOD'], ['error' => $e->getMessage()]);
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
