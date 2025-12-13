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

$dbPath = __DIR__ . '/../data/trades.db';
$dbDir = dirname($dbPath);

if (!is_dir($dbDir)) {
    mkdir($dbDir, 0755, true);
}

try {
    $db = new SQLite3($dbPath);
    
    $db->exec('
        CREATE TABLE IF NOT EXISTS trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account TEXT NOT NULL,
            market_id INTEGER NOT NULL,
            outcome_id INTEGER NOT NULL,
            side TEXT NOT NULL,
            price REAL NOT NULL,
            quantity INTEGER NOT NULL,
            fee REAL NOT NULL,
            timestamp INTEGER NOT NULL,
            tx_id TEXT,
            order_id INTEGER
        )
    ');
    
    $db->exec('CREATE INDEX IF NOT EXISTS idx_account ON trades(account)');
    $db->exec('CREATE INDEX IF NOT EXISTS idx_market ON trades(market_id)');
    $db->exec('CREATE INDEX IF NOT EXISTS idx_timestamp ON trades(timestamp)');
    
    $db->exec('
        CREATE TABLE IF NOT EXISTS positions_snapshot (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account TEXT NOT NULL,
            market_id INTEGER NOT NULL,
            outcome_id INTEGER NOT NULL,
            shares INTEGER NOT NULL,
            avg_entry_price REAL NOT NULL,
            total_cost REAL NOT NULL,
            fees_paid REAL NOT NULL,
            last_updated INTEGER NOT NULL,
            UNIQUE(account, market_id, outcome_id)
        )
    ');
    
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input) {
            logApiRequest('trades', 'POST', ['error' => 'Invalid JSON']);
            http_response_code(400);
            echo json_encode(['error' => 'Invalid JSON']);
            exit;
        }
        
        $account = $input['account'] ?? '';
        $marketId = $input['market_id'] ?? 0;
        $outcomeId = $input['outcome_id'] ?? 0;
        $side = $input['side'] ?? '';
        $price = $input['price'] ?? 0;
        $quantity = $input['quantity'] ?? 0;
        $fee = $input['fee'] ?? 0;
        $timestamp = $input['timestamp'] ?? time();
        $txId = $input['tx_id'] ?? null;
        $orderId = $input['order_id'] ?? null;
        
        if (empty($account) || $marketId <= 0 || $outcomeId < 0 || empty($side) || $price <= 0 || $quantity <= 0) {
            logApiRequest('trades', 'POST', ['error' => 'Missing required fields', 'input' => $input]);
            http_response_code(400);
            echo json_encode(['error' => 'Missing required fields']);
            exit;
        }
        
        $stmt = $db->prepare('
            INSERT INTO trades (account, market_id, outcome_id, side, price, quantity, fee, timestamp, tx_id, order_id)
            VALUES (:account, :market_id, :outcome_id, :side, :price, :quantity, :fee, :timestamp, :tx_id, :order_id)
        ');
        
        $stmt->bindValue(':account', $account, SQLITE3_TEXT);
        $stmt->bindValue(':market_id', $marketId, SQLITE3_INTEGER);
        $stmt->bindValue(':outcome_id', $outcomeId, SQLITE3_INTEGER);
        $stmt->bindValue(':side', $side, SQLITE3_TEXT);
        $stmt->bindValue(':price', $price, SQLITE3_FLOAT);
        $stmt->bindValue(':quantity', $quantity, SQLITE3_INTEGER);
        $stmt->bindValue(':fee', $fee, SQLITE3_FLOAT);
        $stmt->bindValue(':timestamp', $timestamp, SQLITE3_INTEGER);
        $stmt->bindValue(':tx_id', $txId, SQLITE3_TEXT);
        $stmt->bindValue(':order_id', $orderId, SQLITE3_INTEGER);
        
        $result = $stmt->execute();
        
        if ($result) {
            $tradeId = $db->lastInsertRowID();
            
            $stmt = $db->prepare('
                SELECT * FROM positions_snapshot 
                WHERE account = :account AND market_id = :market_id AND outcome_id = :outcome_id
            ');
            $stmt->bindValue(':account', $account, SQLITE3_TEXT);
            $stmt->bindValue(':market_id', $marketId, SQLITE3_INTEGER);
            $stmt->bindValue(':outcome_id', $outcomeId, SQLITE3_INTEGER);
            $posResult = $stmt->execute();
            $position = $posResult->fetchArray(SQLITE3_ASSOC);
            
            if ($position) {
                $newShares = $position['shares'] + ($side === 'buy' ? $quantity : -$quantity);
                $newTotalCost = $position['total_cost'] + ($side === 'buy' ? ($price * $quantity) : -($price * $quantity));
                $newFeesPaid = $position['fees_paid'] + $fee;
                $newAvgPrice = $newShares > 0 ? $newTotalCost / $newShares : 0;
                
                $stmt = $db->prepare('
                    UPDATE positions_snapshot 
                    SET shares = :shares, avg_entry_price = :avg_price, total_cost = :total_cost, 
                        fees_paid = :fees_paid, last_updated = :timestamp
                    WHERE account = :account AND market_id = :market_id AND outcome_id = :outcome_id
                ');
                $stmt->bindValue(':shares', $newShares, SQLITE3_INTEGER);
                $stmt->bindValue(':avg_price', $newAvgPrice, SQLITE3_FLOAT);
                $stmt->bindValue(':total_cost', $newTotalCost, SQLITE3_FLOAT);
                $stmt->bindValue(':fees_paid', $newFeesPaid, SQLITE3_FLOAT);
                $stmt->bindValue(':timestamp', $timestamp, SQLITE3_INTEGER);
                $stmt->bindValue(':account', $account, SQLITE3_TEXT);
                $stmt->bindValue(':market_id', $marketId, SQLITE3_INTEGER);
                $stmt->bindValue(':outcome_id', $outcomeId, SQLITE3_INTEGER);
                $stmt->execute();
            } else {
                $shares = $side === 'buy' ? $quantity : -$quantity;
                $totalCost = $side === 'buy' ? ($price * $quantity) : -($price * $quantity);
                $avgPrice = $shares > 0 ? $totalCost / $shares : 0;
                
                $stmt = $db->prepare('
                    INSERT INTO positions_snapshot (account, market_id, outcome_id, shares, avg_entry_price, total_cost, fees_paid, last_updated)
                    VALUES (:account, :market_id, :outcome_id, :shares, :avg_price, :total_cost, :fees_paid, :timestamp)
                ');
                $stmt->bindValue(':account', $account, SQLITE3_TEXT);
                $stmt->bindValue(':market_id', $marketId, SQLITE3_INTEGER);
                $stmt->bindValue(':outcome_id', $outcomeId, SQLITE3_INTEGER);
                $stmt->bindValue(':shares', $shares, SQLITE3_INTEGER);
                $stmt->bindValue(':avg_price', $avgPrice, SQLITE3_FLOAT);
                $stmt->bindValue(':total_cost', $totalCost, SQLITE3_FLOAT);
                $stmt->bindValue(':fees_paid', $fee, SQLITE3_FLOAT);
                $stmt->bindValue(':timestamp', $timestamp, SQLITE3_INTEGER);
                $stmt->execute();
            }
            
            logApiRequest('trades', 'POST', ['success' => true, 'trade_id' => $tradeId]);
            echo json_encode(['success' => true, 'trade_id' => $tradeId]);
            
            // Create notification for the trader
            $sideText = $side === 'buy' ? 'bought' : 'sold';
            $title = "Trade executed";
            $message = "You $sideText $quantity shares at $price each";
            createNotification($account, 'trade', $title, $message, $marketId, "/market/$marketId");
        } else {
            logApiRequest('trades', 'POST', ['error' => 'Failed to insert trade']);
            http_response_code(500);
            echo json_encode(['error' => 'Failed to insert trade']);
        }
    } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $account = $_GET['account'] ?? '';
        $marketId = $_GET['market_id'] ?? null;
        $limit = intval($_GET['limit'] ?? 100);
        $offset = intval($_GET['offset'] ?? 0);
        $format = $_GET['format'] ?? 'json';
        
        if (empty($account)) {
            logApiRequest('trades', 'GET', ['error' => 'Account required']);
            http_response_code(400);
            echo json_encode(['error' => 'Account required']);
            exit;
        }
        
        $query = 'SELECT * FROM trades WHERE account = :account';
        $params = [':account' => $account];
        
        if ($marketId !== null) {
            $query .= ' AND market_id = :market_id';
            $params[':market_id'] = intval($marketId);
        }
        
        $query .= ' ORDER BY timestamp DESC LIMIT :limit OFFSET :offset';
        
        $stmt = $db->prepare($query);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->bindValue(':limit', $limit, SQLITE3_INTEGER);
        $stmt->bindValue(':offset', $offset, SQLITE3_INTEGER);
        
        $result = $stmt->execute();
        $trades = [];
        
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $trades[] = $row;
        }
        
        if ($format === 'csv') {
            header('Content-Type: text/csv');
            header('Content-Disposition: attachment; filename="trade_history.csv"');
            
            $output = fopen('php://output', 'w');
            fputcsv($output, ['ID', 'Account', 'Market ID', 'Outcome ID', 'Side', 'Price', 'Quantity', 'Fee', 'Timestamp', 'TX ID', 'Order ID']);
            
            foreach ($trades as $trade) {
                fputcsv($output, [
                    $trade['id'],
                    $trade['account'],
                    $trade['market_id'],
                    $trade['outcome_id'],
                    $trade['side'],
                    $trade['price'],
                    $trade['quantity'],
                    $trade['fee'],
                    date('Y-m-d H:i:s', $trade['timestamp']),
                    $trade['tx_id'] ?? '',
                    $trade['order_id'] ?? ''
                ]);
            }
            
            fclose($output);
            exit;
        }
        
        $stmt = $db->prepare('SELECT * FROM positions_snapshot WHERE account = :account');
        $stmt->bindValue(':account', $account, SQLITE3_TEXT);
        $result = $stmt->execute();
        $positions = [];
        
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $positions[] = $row;
        }
        
        logApiRequest('trades', 'GET', ['account' => $account, 'trade_count' => count($trades)]);
        echo json_encode([
            'trades' => $trades,
            'positions' => $positions,
            'total' => count($trades)
        ]);
    }
    
    $db->close();
} catch (Exception $e) {
    logApiRequest('trades', $_SERVER['REQUEST_METHOD'], ['error' => $e->getMessage()]);
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
