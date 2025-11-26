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
        echo json_encode(['entries' => []]);
        exit;
    }

    $db = new SQLite3($tradesDbPath);
    
    $timeframe = $_GET['timeframe'] ?? 'all';
    $sortBy = $_GET['sort'] ?? 'volume';
    
    $timeFilter = 0;
    switch ($timeframe) {
        case '24h':
            $timeFilter = time() - 86400;
            break;
        case '7d':
            $timeFilter = time() - 604800;
            break;
        case '30d':
            $timeFilter = time() - 2592000;
            break;
    }
    
    $orderBy = 'total_volume DESC';
    switch ($sortBy) {
        case 'trades':
            $orderBy = 'total_trades DESC';
            break;
        case 'winRate':
            $orderBy = 'win_rate DESC';
            break;
        case 'profitLoss':
            $orderBy = 'profit_loss DESC';
            break;
    }
    
    $stmt = $db->prepare("
        SELECT 
            account,
            SUM(price * quantity) as total_volume,
            COUNT(*) as total_trades,
            COUNT(DISTINCT market_id) as markets_traded
        FROM trades
        WHERE timestamp >= :time_filter
        GROUP BY account
        ORDER BY $orderBy
        LIMIT 100
    ");
    $stmt->bindValue(':time_filter', $timeFilter, SQLITE3_INTEGER);
    
    $result = $stmt->execute();
    $entries = [];
    $rank = 1;
    
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $winRate = 0.5;
        $profitLoss = 0;
        
        $plStmt = $db->prepare('
            SELECT 
                SUM(CASE WHEN side = "buy" THEN -(price * quantity) ELSE (price * quantity) END) as pl
            FROM trades
            WHERE account = :account AND timestamp >= :time_filter
        ');
        $plStmt->bindValue(':account', $row['account'], SQLITE3_TEXT);
        $plStmt->bindValue(':time_filter', $timeFilter, SQLITE3_INTEGER);
        $plResult = $plStmt->execute();
        $plRow = $plResult->fetchArray(SQLITE3_ASSOC);
        if ($plRow) {
            $profitLoss = floatval($plRow['pl'] ?? 0);
        }
        
        $entries[] = [
            'rank' => $rank++,
            'account' => $row['account'],
            'totalVolume' => floatval($row['total_volume']),
            'totalTrades' => intval($row['total_trades']),
            'winRate' => $winRate,
            'profitLoss' => $profitLoss,
            'marketsTraded' => intval($row['markets_traded'])
        ];
    }
    
    logApiRequest('leaderboard', 'GET', ['timeframe' => $timeframe, 'count' => count($entries)]);
    echo json_encode(['entries' => $entries]);
    
    $db->close();
} catch (Exception $e) {
    logApiRequest('leaderboard', 'GET', ['error' => $e->getMessage()]);
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
