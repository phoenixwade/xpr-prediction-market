<?php
/**
 * Price History Snapshot Cron Job
 * 
 * Fetches current prices from the blockchain order book and stores snapshots
 * for price chart visualization.
 * 
 * Recommended cron schedule: Every 5 minutes
 * */5 * * * * php /path/to/public_html/api/cron/snapshot_prices.php >> /path/to/logs/price_snapshot.log 2>&1
 */

define('CRON_MODE', true);

$envFile = __DIR__ . '/../../../.env';
$config = [];
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        $parts = explode('=', $line, 2);
        if (count($parts) === 2) {
            $key = trim($parts[0]);
            $value = trim($parts[1], " \t\n\r\0\x0B\"'");
            $config[$key] = $value;
        }
    }
}

$rpcEndpoint = $config['PROTON_RPC'] ?? 'https://proton.greymass.com';
$contractAccount = $config['CONTRACT_ACCOUNT'] ?? 'xpredicting';

$priceDbPath = __DIR__ . '/../../data/price_history.db';
$dbDir = dirname($priceDbPath);

if (!is_dir($dbDir)) {
    mkdir($dbDir, 0755, true);
}

function log_message($message) {
    echo "[" . date('Y-m-d H:i:s') . "] " . $message . "\n";
}

function fetch_table_rows($rpcEndpoint, $code, $scope, $table, $limit = 100) {
    $url = $rpcEndpoint . '/v1/chain/get_table_rows';
    
    $postData = json_encode([
        'code' => $code,
        'scope' => $scope,
        'table' => $table,
        'json' => true,
        'limit' => $limit
    ]);
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Accept: application/json'
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    
    if ($curlError) {
        throw new Exception("CURL error: " . $curlError);
    }
    
    if ($httpCode !== 200) {
        throw new Exception("HTTP error: " . $httpCode);
    }
    
    $data = json_decode($response, true);
    if (!$data || !isset($data['rows'])) {
        throw new Exception("Invalid response from RPC");
    }
    
    return $data['rows'];
}

function calculate_mid_price($orders) {
    $bids = [];
    $asks = [];
    
    foreach ($orders as $order) {
        $isBid = isset($order['isBid']) ? $order['isBid'] : (isset($order['is_bid']) ? $order['is_bid'] : false);
        $price = 0;
        
        if (isset($order['price'])) {
            if (is_string($order['price']) && strpos($order['price'], ' ') !== false) {
                $parts = explode(' ', $order['price']);
                $price = floatval($parts[0]) * 1000000;
            } else {
                $price = floatval($order['price']);
            }
        }
        
        if ($isBid) {
            $bids[] = $price;
        } else {
            $asks[] = $price;
        }
    }
    
    rsort($bids);
    sort($asks);
    
    if (!empty($bids) && !empty($asks)) {
        return ($bids[0] + $asks[0]) / 2;
    } elseif (!empty($bids)) {
        return $bids[0];
    } elseif (!empty($asks)) {
        return $asks[0];
    }
    
    return 0;
}

function calculate_volume($orders) {
    $volume = 0;
    foreach ($orders as $order) {
        $quantity = isset($order['quantity']) ? intval($order['quantity']) : 0;
        $volume += $quantity;
    }
    return $volume;
}

try {
    log_message("=== Starting price snapshot ===");
    log_message("RPC Endpoint: " . $rpcEndpoint);
    log_message("Contract: " . $contractAccount);
    
    $db = new SQLite3($priceDbPath);
    
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
    
    $markets = fetch_table_rows($rpcEndpoint, $contractAccount, $contractAccount, 'markets', 100);
    log_message("Found " . count($markets) . " markets");
    
    $activeMarkets = array_filter($markets, function($m) {
        $resolved = isset($m['resolved']) ? $m['resolved'] : false;
        $status = isset($m['status']) ? $m['status'] : 1;
        return !$resolved && $status == 1;
    });
    
    log_message("Active markets: " . count($activeMarkets));
    
    $timestamp = time();
    $snapshotCount = 0;
    
    foreach ($activeMarkets as $market) {
        $marketId = $market['id'] ?? $market['market_id'] ?? 0;
        if ($marketId <= 0) continue;
        
        try {
            $outcomes = fetch_table_rows($rpcEndpoint, $contractAccount, strval($marketId), 'outcomes', 20);
            
            foreach ($outcomes as $outcome) {
                $outcomeId = $outcome['outcome_id'] ?? $outcome['id'] ?? 0;
                
                $orders = fetch_table_rows($rpcEndpoint, $contractAccount, strval($marketId), 'orders', 100);
                
                $outcomeOrders = array_filter($orders, function($o) use ($outcomeId) {
                    return (isset($o['outcome_id']) ? $o['outcome_id'] : 0) == $outcomeId;
                });
                
                $price = calculate_mid_price($outcomeOrders);
                $volume = calculate_volume($outcomeOrders);
                
                if ($price > 0) {
                    $stmt = $db->prepare('
                        INSERT INTO price_snapshots (market_id, outcome_id, price, volume, timestamp)
                        VALUES (:market_id, :outcome_id, :price, :volume, :timestamp)
                    ');
                    $stmt->bindValue(':market_id', $marketId, SQLITE3_INTEGER);
                    $stmt->bindValue(':outcome_id', $outcomeId, SQLITE3_INTEGER);
                    $stmt->bindValue(':price', $price, SQLITE3_FLOAT);
                    $stmt->bindValue(':volume', $volume, SQLITE3_INTEGER);
                    $stmt->bindValue(':timestamp', $timestamp, SQLITE3_INTEGER);
                    $stmt->execute();
                    
                    $snapshotCount++;
                }
            }
            
            usleep(100000);
            
        } catch (Exception $e) {
            log_message("Error processing market $marketId: " . $e->getMessage());
        }
    }
    
    log_message("Created $snapshotCount price snapshots");
    
    $oneWeekAgo = $timestamp - (7 * 24 * 60 * 60);
    $db->exec("DELETE FROM price_snapshots WHERE timestamp < $oneWeekAgo");
    $deletedCount = $db->changes();
    if ($deletedCount > 0) {
        log_message("Cleaned up $deletedCount old snapshots (older than 7 days)");
    }
    
    $db->close();
    
    log_message("=== Price snapshot completed successfully ===");
    
} catch (Exception $e) {
    log_message("ERROR: " . $e->getMessage());
    exit(1);
}
