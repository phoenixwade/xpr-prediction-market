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

$tradesDbPath = __DIR__ . '/../data/trades.db';

try {
    if (!file_exists($tradesDbPath)) {
        echo json_encode([
            'totalVolume' => 0,
            'totalTrades' => 0,
            'uniqueTraders' => 0,
            'avgTradeSize' => 0,
            'last24hVolume' => 0,
            'last24hTrades' => 0
        ]);
        exit;
    }

    $db = new SQLite3($tradesDbPath);
    
    $marketId = intval($_GET['market_id'] ?? 0);
    
    if ($marketId <= 0) {
        logApiRequest('market_stats', 'GET', ['error' => 'Invalid market_id']);
        http_response_code(400);
        echo json_encode(['error' => 'Invalid market_id']);
        exit;
    }
    
    $stmt = $db->prepare('
        SELECT 
            COUNT(*) as total_trades,
            SUM(price * quantity) as total_volume,
            COUNT(DISTINCT account) as unique_traders,
            AVG(price * quantity) as avg_trade_size
        FROM trades 
        WHERE market_id = :market_id
    ');
    $stmt->bindValue(':market_id', $marketId, SQLITE3_INTEGER);
    $result = $stmt->execute();
    $row = $result->fetchArray(SQLITE3_ASSOC);
    
    $totalTrades = intval($row['total_trades'] ?? 0);
    $totalVolume = floatval($row['total_volume'] ?? 0);
    $uniqueTraders = intval($row['unique_traders'] ?? 0);
    $avgTradeSize = floatval($row['avg_trade_size'] ?? 0);
    
    $last24h = time() - 86400;
    $stmt = $db->prepare('
        SELECT 
            COUNT(*) as trades_24h,
            SUM(price * quantity) as volume_24h
        FROM trades 
        WHERE market_id = :market_id 
        AND timestamp >= :last_24h
    ');
    $stmt->bindValue(':market_id', $marketId, SQLITE3_INTEGER);
    $stmt->bindValue(':last_24h', $last24h, SQLITE3_INTEGER);
    $result = $stmt->execute();
    $row = $result->fetchArray(SQLITE3_ASSOC);
    
    $last24hTrades = intval($row['trades_24h'] ?? 0);
    $last24hVolume = floatval($row['volume_24h'] ?? 0);
    
    logApiRequest('market_stats', 'GET', ['market_id' => $marketId]);
    echo json_encode([
        'totalVolume' => $totalVolume,
        'totalTrades' => $totalTrades,
        'uniqueTraders' => $uniqueTraders,
        'avgTradeSize' => $avgTradeSize,
        'last24hVolume' => $last24hVolume,
        'last24hTrades' => $last24hTrades
    ]);
    
    $db->close();
} catch (Exception $e) {
    logApiRequest('market_stats', 'GET', ['error' => $e->getMessage()]);
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
