<?php
/**
 * Process Scheduled Markets Cron Job
 * 
 * This script checks for scheduled markets that are due to be created
 * and triggers their creation on the blockchain.
 * 
 * Run every minute: * * * * * php ~/public_html/api/cron/process_scheduled_markets.php >> ~/logs/scheduled_markets.log 2>&1
 */

echo "[" . date('Y-m-d H:i:s') . "] Starting scheduled markets processor\n";

// Prevent overlapping runs with file lock
$lockFile = __DIR__ . '/process_scheduled_markets.lock';
$lockHandle = fopen($lockFile, 'c');

if ($lockHandle === false) {
    echo "[" . date('Y-m-d H:i:s') . "] ERROR: Unable to open lock file\n";
    exit(1);
}

if (!flock($lockHandle, LOCK_EX | LOCK_NB)) {
    echo "[" . date('Y-m-d H:i:s') . "] Another process is already running, exiting.\n";
    exit(0);
}

// Load environment variables
$envFile = __DIR__ . '/../../../.env';
if (!file_exists($envFile)) {
    $envFile = __DIR__ . '/../../.env';
}

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

$contractAccount = $config['CONTRACT_ACCOUNT'] ?? 'xpredicting';
echo "[" . date('Y-m-d H:i:s') . "] Contract account: $contractAccount\n";

// Database path
$dbPath = __DIR__ . '/../../data/scheduled_markets.db';

if (!file_exists($dbPath)) {
    echo "[" . date('Y-m-d H:i:s') . "] No scheduled markets database found, nothing to process\n";
    flock($lockHandle, LOCK_UN);
    fclose($lockHandle);
    exit(0);
}

try {
    $db = new SQLite3($dbPath);
    $db->busyTimeout(5000);
    
    // Get all pending markets that are due to be opened
    $now = time();
    $stmt = $db->prepare('
        SELECT * FROM scheduled_markets 
        WHERE status = "pending" AND scheduled_open_time <= :now
        ORDER BY scheduled_open_time ASC
        LIMIT 10
    ');
    $stmt->bindValue(':now', $now, SQLITE3_INTEGER);
    $result = $stmt->execute();
    
    $processed = 0;
    $errors = 0;
    
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $id = $row['id'];
        $question = $row['question'];
        $creator = $row['creator'];
        
        echo "[" . date('Y-m-d H:i:s') . "] Processing scheduled market #$id: $question\n";
        
        // Mark as processing to prevent duplicate processing
        $updateStmt = $db->prepare('UPDATE scheduled_markets SET status = "processing" WHERE id = :id');
        $updateStmt->bindValue(':id', $id, SQLITE3_INTEGER);
        $updateStmt->execute();
        
        // Prepare market data for creation
        $outcomes = json_decode($row['outcomes'], true);
        $category = $row['category'];
        $description = $row['description'];
        $closeTime = $row['scheduled_close_time'];
        
        // Note: Actual blockchain market creation requires a signed transaction from the creator
        // This cron job prepares the market and notifies the creator that it's ready
        // For full automation, you would need:
        // 1. A server-side signing key with permission to create markets
        // 2. Or a webhook/notification system to prompt the creator to sign
        
        // For now, we'll mark the market as "ready" and create a notification
        // The creator can then manually approve/create it, or an admin can create it on their behalf
        
        $updateStmt = $db->prepare('
            UPDATE scheduled_markets 
            SET status = "ready", processed_at = :processed_at 
            WHERE id = :id
        ');
        $updateStmt->bindValue(':processed_at', $now, SQLITE3_INTEGER);
        $updateStmt->bindValue(':id', $id, SQLITE3_INTEGER);
        $updateStmt->execute();
        
        // Create notification for the creator
        require_once __DIR__ . '/../notify_helper.php';
        createNotification(
            $creator,
            'market',
            'Scheduled market ready',
            "Your scheduled market \"$question\" is now ready to be created. Please visit the Admin panel to finalize it.",
            null,
            '/admin'
        );
        
        echo "[" . date('Y-m-d H:i:s') . "] Market #$id marked as ready, notification sent to $creator\n";
        $processed++;
    }
    
    // Also check for any markets that have been in "processing" state for too long (stuck)
    $stuckStmt = $db->prepare('
        SELECT id FROM scheduled_markets 
        WHERE status = "processing" AND scheduled_open_time < :old_time
    ');
    $stuckStmt->bindValue(':old_time', $now - 3600, SQLITE3_INTEGER); // 1 hour old
    $stuckResult = $stuckStmt->execute();
    
    while ($stuckRow = $stuckResult->fetchArray(SQLITE3_ASSOC)) {
        $stuckId = $stuckRow['id'];
        echo "[" . date('Y-m-d H:i:s') . "] Resetting stuck market #$stuckId back to pending\n";
        
        $resetStmt = $db->prepare('UPDATE scheduled_markets SET status = "pending" WHERE id = :id');
        $resetStmt->bindValue(':id', $stuckId, SQLITE3_INTEGER);
        $resetStmt->execute();
    }
    
    $db->close();
    
    echo "[" . date('Y-m-d H:i:s') . "] Processed $processed scheduled markets\n";
    
} catch (Exception $e) {
    echo "[" . date('Y-m-d H:i:s') . "] ERROR: " . $e->getMessage() . "\n";
}

// Release lock
flock($lockHandle, LOCK_UN);
fclose($lockHandle);

echo "[" . date('Y-m-d H:i:s') . "] Scheduled markets processor completed\n";
