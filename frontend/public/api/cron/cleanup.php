<?php
/**
 * Database Cleanup Cron Job
 * 
 * Performs maintenance tasks:
 * - Removes old notifications (older than 30 days)
 * - Cleans up old price snapshots (older than 7 days) 
 * - Rotates and cleans API logs
 * - Vacuums SQLite databases to reclaim space
 * 
 * Recommended cron schedule: Daily at 4:00 AM
 * 0 4 * * * php /path/to/public_html/api/cron/cleanup.php >> /path/to/logs/cleanup.log 2>&1
 */

define('CRON_MODE', true);

$dataDir = __DIR__ . '/../../data';
$logDir = dirname(__DIR__) . '/../../../logs';

function log_message($message) {
    echo "[" . date('Y-m-d H:i:s') . "] " . $message . "\n";
}

function cleanup_database($dbPath, $tableName, $timestampColumn, $maxAgeDays, $description) {
    if (!file_exists($dbPath)) {
        log_message("  Skipping $description - database not found");
        return 0;
    }
    
    try {
        $db = new SQLite3($dbPath);
        $cutoffTime = time() - ($maxAgeDays * 24 * 60 * 60);
        
        $stmt = $db->prepare("DELETE FROM $tableName WHERE $timestampColumn < :cutoff");
        $stmt->bindValue(':cutoff', $cutoffTime, SQLITE3_INTEGER);
        $stmt->execute();
        
        $deletedCount = $db->changes();
        
        if ($deletedCount > 0) {
            $db->exec('VACUUM');
            log_message("  $description: Deleted $deletedCount records older than $maxAgeDays days");
        } else {
            log_message("  $description: No old records to clean");
        }
        
        $db->close();
        return $deletedCount;
        
    } catch (Exception $e) {
        log_message("  ERROR cleaning $description: " . $e->getMessage());
        return 0;
    }
}

function cleanup_soft_deleted($dbPath, $tableName, $deletedColumn, $timestampColumn, $maxAgeDays, $description) {
    if (!file_exists($dbPath)) {
        log_message("  Skipping $description - database not found");
        return 0;
    }
    
    try {
        $db = new SQLite3($dbPath);
        $cutoffTime = time() - ($maxAgeDays * 24 * 60 * 60);
        
        $stmt = $db->prepare("DELETE FROM $tableName WHERE $deletedColumn = 1 AND $timestampColumn < :cutoff");
        $stmt->bindValue(':cutoff', $cutoffTime, SQLITE3_INTEGER);
        $stmt->execute();
        
        $deletedCount = $db->changes();
        
        if ($deletedCount > 0) {
            $db->exec('VACUUM');
            log_message("  $description: Permanently removed $deletedCount soft-deleted records");
        } else {
            log_message("  $description: No soft-deleted records to clean");
        }
        
        $db->close();
        return $deletedCount;
        
    } catch (Exception $e) {
        log_message("  ERROR cleaning $description: " . $e->getMessage());
        return 0;
    }
}

function rotate_log_file($logPath, $maxSizeMB = 10, $maxBackups = 5) {
    if (!file_exists($logPath)) {
        return;
    }
    
    $fileSize = filesize($logPath);
    $maxSizeBytes = $maxSizeMB * 1024 * 1024;
    
    if ($fileSize < $maxSizeBytes) {
        return;
    }
    
    log_message("  Rotating log file: " . basename($logPath) . " (size: " . round($fileSize / 1024 / 1024, 2) . "MB)");
    
    for ($i = $maxBackups - 1; $i >= 1; $i--) {
        $oldFile = $logPath . '.' . $i;
        $newFile = $logPath . '.' . ($i + 1);
        if (file_exists($oldFile)) {
            if ($i == $maxBackups - 1) {
                unlink($oldFile);
            } else {
                rename($oldFile, $newFile);
            }
        }
    }
    
    rename($logPath, $logPath . '.1');
    touch($logPath);
    chmod($logPath, 0644);
}

function vacuum_database($dbPath, $description) {
    if (!file_exists($dbPath)) {
        return;
    }
    
    try {
        $sizeBefore = filesize($dbPath);
        
        $db = new SQLite3($dbPath);
        $db->exec('VACUUM');
        $db->close();
        
        clearstatcache(true, $dbPath);
        $sizeAfter = filesize($dbPath);
        
        $saved = $sizeBefore - $sizeAfter;
        if ($saved > 0) {
            log_message("  $description: Vacuumed, saved " . round($saved / 1024, 2) . "KB");
        }
        
    } catch (Exception $e) {
        log_message("  ERROR vacuuming $description: " . $e->getMessage());
    }
}

try {
    log_message("=== Starting cleanup job ===");
    
    $totalDeleted = 0;
    
    log_message("Cleaning old notifications...");
    $totalDeleted += cleanup_database(
        $dataDir . '/notifications.db',
        'notifications',
        'timestamp',
        30,
        'Notifications'
    );
    
    log_message("Cleaning old price snapshots...");
    $totalDeleted += cleanup_database(
        $dataDir . '/price_history.db',
        'price_snapshots',
        'timestamp',
        7,
        'Price snapshots'
    );
    
    log_message("Cleaning soft-deleted comments...");
    $totalDeleted += cleanup_soft_deleted(
        $dataDir . '/comments.db',
        'comments',
        'is_deleted',
        'created_at',
        90,
        'Deleted comments'
    );
    
    log_message("Rotating log files...");
    if (is_dir($logDir)) {
        $logFiles = glob($logDir . '/*.log');
        foreach ($logFiles as $logFile) {
            rotate_log_file($logFile, 10, 5);
        }
        log_message("  Checked " . count($logFiles) . " log files");
    } else {
        log_message("  Log directory not found, skipping rotation");
    }
    
    log_message("Vacuuming databases...");
    $databases = [
        'comments.db' => 'Comments DB',
        'notifications.db' => 'Notifications DB',
        'price_history.db' => 'Price History DB',
        'trades.db' => 'Trades DB'
    ];
    
    foreach ($databases as $dbFile => $description) {
        vacuum_database($dataDir . '/' . $dbFile, $description);
    }
    
    log_message("=== Cleanup completed successfully ===");
    log_message("Total records cleaned: $totalDeleted");
    
} catch (Exception $e) {
    log_message("ERROR: " . $e->getMessage());
    exit(1);
}
