<?php

function checkRateLimit($identifier, $maxRequests = 100, $windowSeconds = 60) {
    $dbPath = __DIR__ . '/../data/rate_limits.db';
    $dbDir = dirname($dbPath);
    
    if (!is_dir($dbDir)) {
        mkdir($dbDir, 0755, true);
    }
    
    try {
        $db = new SQLite3($dbPath);
        
        $db->exec('
            CREATE TABLE IF NOT EXISTS rate_limits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                identifier TEXT NOT NULL,
                timestamp INTEGER NOT NULL
            )
        ');
        
        $db->exec('CREATE INDEX IF NOT EXISTS idx_identifier ON rate_limits(identifier)');
        $db->exec('CREATE INDEX IF NOT EXISTS idx_timestamp ON rate_limits(timestamp)');
        
        $windowStart = time() - $windowSeconds;
        
        $db->exec("DELETE FROM rate_limits WHERE timestamp < $windowStart");
        
        $stmt = $db->prepare('
            SELECT COUNT(*) as request_count 
            FROM rate_limits 
            WHERE identifier = :identifier 
            AND timestamp >= :window_start
        ');
        $stmt->bindValue(':identifier', $identifier, SQLITE3_TEXT);
        $stmt->bindValue(':window_start', $windowStart, SQLITE3_INTEGER);
        
        $result = $stmt->execute();
        $row = $result->fetchArray(SQLITE3_ASSOC);
        $requestCount = intval($row['request_count']);
        
        if ($requestCount >= $maxRequests) {
            $db->close();
            return [
                'allowed' => false,
                'remaining' => 0,
                'reset' => $windowStart + $windowSeconds
            ];
        }
        
        $stmt = $db->prepare('
            INSERT INTO rate_limits (identifier, timestamp) 
            VALUES (:identifier, :timestamp)
        ');
        $stmt->bindValue(':identifier', $identifier, SQLITE3_TEXT);
        $stmt->bindValue(':timestamp', time(), SQLITE3_INTEGER);
        $stmt->execute();
        
        $db->close();
        
        return [
            'allowed' => true,
            'remaining' => $maxRequests - $requestCount - 1,
            'reset' => $windowStart + $windowSeconds
        ];
        
    } catch (Exception $e) {
        error_log("Rate limit error: " . $e->getMessage());
        return ['allowed' => true, 'remaining' => $maxRequests, 'reset' => time() + $windowSeconds];
    }
}

function getRateLimitIdentifier() {
    if (isset($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ip = $_SERVER['HTTP_X_FORWARDED_FOR'];
    } else {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    }
    
    $account = $_GET['account'] ?? $_POST['account'] ?? '';
    
    return $account ? "account:$account" : "ip:$ip";
}
