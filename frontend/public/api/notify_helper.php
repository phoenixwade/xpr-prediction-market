<?php
/**
 * Notification Helper
 * Creates notifications for users when events occur (comments, trades, resolutions)
 */

/**
 * Create a notification for a user
 * 
 * @param string $account The account to notify
 * @param string $type The notification type (comment, trade, resolution, mention)
 * @param string $title The notification title
 * @param string $message The notification message
 * @param int|null $marketId The related market ID (optional)
 * @param string|null $link The link to navigate to (optional)
 * @return bool Success status
 */
function createNotification($account, $type, $title, $message, $marketId = null, $link = null) {
    $dbPath = __DIR__ . '/../data/notifications.db';
    $dbDir = dirname($dbPath);
    
    if (!is_dir($dbDir)) {
        mkdir($dbDir, 0755, true);
    }
    
    try {
        $db = new SQLite3($dbPath);
        $db->busyTimeout(5000);
        
        // Ensure table exists
        $db->exec('
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account TEXT NOT NULL,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                read INTEGER DEFAULT 0,
                market_id INTEGER,
                link TEXT
            )
        ');
        
        $db->exec('CREATE INDEX IF NOT EXISTS idx_account ON notifications(account)');
        $db->exec('CREATE INDEX IF NOT EXISTS idx_timestamp ON notifications(timestamp)');
        
        $stmt = $db->prepare('
            INSERT INTO notifications (account, type, title, message, timestamp, market_id, link)
            VALUES (:account, :type, :title, :message, :timestamp, :market_id, :link)
        ');
        
        $stmt->bindValue(':account', $account, SQLITE3_TEXT);
        $stmt->bindValue(':type', $type, SQLITE3_TEXT);
        $stmt->bindValue(':title', $title, SQLITE3_TEXT);
        $stmt->bindValue(':message', $message, SQLITE3_TEXT);
        $stmt->bindValue(':timestamp', time(), SQLITE3_INTEGER);
        $stmt->bindValue(':market_id', $marketId, SQLITE3_INTEGER);
        $stmt->bindValue(':link', $link, SQLITE3_TEXT);
        
        $stmt->execute();
        $db->close();
        
        return true;
    } catch (Exception $e) {
        error_log("Notification creation error: " . $e->getMessage());
        return false;
    }
}

/**
 * Notify all users who have positions in a market (for resolution notifications)
 * 
 * @param int $marketId The market ID
 * @param string $type The notification type
 * @param string $title The notification title
 * @param string $message The notification message
 * @param string|null $excludeAccount Account to exclude from notifications (e.g., the resolver)
 * @return int Number of notifications created
 */
function notifyMarketParticipants($marketId, $type, $title, $message, $excludeAccount = null) {
    $tradesDbPath = __DIR__ . '/../data/trades.db';
    
    if (!file_exists($tradesDbPath)) {
        return 0;
    }
    
    try {
        $db = new SQLite3($tradesDbPath);
        $db->busyTimeout(5000);
        
        // Get unique accounts that have traded in this market
        $stmt = $db->prepare('
            SELECT DISTINCT account FROM trades WHERE market_id = :market_id
        ');
        $stmt->bindValue(':market_id', $marketId, SQLITE3_INTEGER);
        $result = $stmt->execute();
        
        $count = 0;
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $account = $row['account'];
            if ($excludeAccount && $account === $excludeAccount) {
                continue;
            }
            
            if (createNotification($account, $type, $title, $message, $marketId, "/market/$marketId")) {
                $count++;
            }
        }
        
        $db->close();
        return $count;
    } catch (Exception $e) {
        error_log("Market participant notification error: " . $e->getMessage());
        return 0;
    }
}

/**
 * Check for @mentions in text and create notifications
 * 
 * @param string $text The text to check for mentions
 * @param int $marketId The market ID
 * @param string $fromAccount The account that wrote the text
 * @return int Number of mention notifications created
 */
function notifyMentions($text, $marketId, $fromAccount) {
    // Match @username patterns (XPR accounts are 1-12 chars, a-z, 1-5, and .)
    preg_match_all('/@([a-z1-5.]{1,12})/', strtolower($text), $matches);
    
    if (empty($matches[1])) {
        return 0;
    }
    
    $count = 0;
    $notified = [];
    
    foreach ($matches[1] as $account) {
        // Don't notify the same account twice or the author
        if (in_array($account, $notified) || $account === $fromAccount) {
            continue;
        }
        
        $title = "You were mentioned";
        $message = "@$fromAccount mentioned you in a comment";
        
        if (createNotification($account, 'mention', $title, $message, $marketId, "/market/$marketId")) {
            $count++;
            $notified[] = $account;
        }
    }
    
    return $count;
}

/**
 * Notify the parent comment author when someone replies
 * 
 * @param int $parentCommentId The parent comment ID
 * @param string $replierAccount The account that replied
 * @param int $marketId The market ID
 * @return bool Success status
 */
function notifyCommentReply($parentCommentId, $replierAccount, $marketId) {
    $commentsDbPath = __DIR__ . '/../data/comments.db';
    
    if (!file_exists($commentsDbPath)) {
        return false;
    }
    
    try {
        $db = new PDO('sqlite:' . $commentsDbPath);
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        
        $stmt = $db->prepare('SELECT user_account FROM comments WHERE id = :id');
        $stmt->bindValue(':id', $parentCommentId, PDO::PARAM_INT);
        $stmt->execute();
        
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row || $row['user_account'] === $replierAccount) {
            return false;
        }
        
        $parentAccount = $row['user_account'];
        $title = "New reply to your comment";
        $message = "@$replierAccount replied to your comment";
        
        return createNotification($parentAccount, 'comment', $title, $message, $marketId, "/market/$marketId");
    } catch (Exception $e) {
        error_log("Comment reply notification error: " . $e->getMessage());
        return false;
    }
}
