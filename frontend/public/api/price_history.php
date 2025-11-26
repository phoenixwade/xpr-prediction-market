<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/logger.php';

$dbPath = __DIR__ . '/../data/price_history.db';
$dbDir = dirname($dbPath);

if (!is_dir($dbDir)) {
    mkdir($dbDir, 0755, true);
}

try {
    $db = new SQLite3($dbPath);
    
    $db->exec('
        CREATE TABLE IF NOT EXISTS price_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            market_id INTEGER NOT NULL,
            outcome_id INTEGER NOT NULL,
            price REAL NOT NULL,
            volume INTEGER NOT NULL,
            timestamp INTEGER NOT NULL
        )
    ');
    
    $db->exec('CREATE INDEX IF NOT EXISTS idx_market_outcome ON price_snapshots(market_id, outcome_id)');
    $db->exec('CREATE INDEX IF NOT EXISTS idx_timestamp ON price_snapshots(timestamp)');
    
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $marketId = intval($_GET['market_id'] ?? 0);
        $outcomeId = intval($_GET['outcome_id'] ?? 0);
        $range = $_GET['range'] ?? '24h';
        
        if ($marketId <= 0 || $outcomeId < 0) {
            logApiRequest('price_history', 'GET', ['error' => 'Invalid parameters']);
            http_response_code(400);
            echo json_encode(['error' => 'Invalid parameters']);
            exit;
        }
        
        $timeFilter = time();
        switch ($range) {
            case '1h':
                $timeFilter -= 3600;
                break;
            case '24h':
                $timeFilter -= 86400;
                break;
            case '7d':
                $timeFilter -= 604800;
                break;
            case 'all':
                $timeFilter = 0;
                break;
        }
        
        $stmt = $db->prepare('
            SELECT price, volume, timestamp 
            FROM price_snapshots 
            WHERE market_id = :market_id 
            AND outcome_id = :outcome_id 
            AND timestamp >= :time_filter
            ORDER BY timestamp ASC
        ');
        
        $stmt->bindValue(':market_id', $marketId, SQLITE3_INTEGER);
        $stmt->bindValue(':outcome_id', $outcomeId, SQLITE3_INTEGER);
        $stmt->bindValue(':time_filter', $timeFilter, SQLITE3_INTEGER);
        
        $result = $stmt->execute();
        $prices = [];
        
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $prices[] = [
                'price' => floatval($row['price']),
                'volume' => intval($row['volume']),
                'timestamp' => intval($row['timestamp'])
            ];
        }
        
        logApiRequest('price_history', 'GET', ['market_id' => $marketId, 'outcome_id' => $outcomeId, 'count' => count($prices)]);
        echo json_encode(['prices' => $prices]);
    }
    
    $db->close();
} catch (Exception $e) {
    logApiRequest('price_history', $_SERVER['REQUEST_METHOD'], ['error' => $e->getMessage()]);
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
