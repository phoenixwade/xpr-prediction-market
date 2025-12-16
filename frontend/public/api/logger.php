<?php
/**
 * Simple logging utility for API endpoints
 * Logs to ~/logs/api.log with timestamps and context
 */

class Logger {
    private static $logFile = null;
    
    /**
     * Initialize logger with log file path
     */
    public static function init($logFile = null) {
        if ($logFile === null) {
            $homeDir = getenv('HOME') ?: '/home/' . get_current_user();
            $logDir = $homeDir . '/logs';
            
            if (!file_exists($logDir)) {
                mkdir($logDir, 0750, true);
            }
            
            $logFile = $logDir . '/api.log';
        }
        
        self::$logFile = $logFile;
    }
    
    /**
     * Log a message with level and context
     */
    public static function log($level, $message, $context = []) {
        if (self::$logFile === null) {
            self::init();
        }
        
        $timestamp = date('Y-m-d H:i:s');
        $requestUri = $_SERVER['REQUEST_URI'] ?? 'CLI';
        $requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'CLI';
        $remoteAddr = $_SERVER['REMOTE_ADDR'] ?? 'local';
        
        $logEntry = sprintf(
            "[%s] [%s] [%s %s] [%s] %s",
            $timestamp,
            strtoupper($level),
            $requestMethod,
            $requestUri,
            $remoteAddr,
            $message
        );
        
        if (!empty($context)) {
            $logEntry .= ' | Context: ' . json_encode($context);
        }
        
        $logEntry .= PHP_EOL;
        
        file_put_contents(self::$logFile, $logEntry, FILE_APPEND | LOCK_EX);
    }
    
    public static function debug($message, $context = []) {
        self::log('debug', $message, $context);
    }
    
    public static function info($message, $context = []) {
        self::log('info', $message, $context);
    }
    
    public static function warning($message, $context = []) {
        self::log('warning', $message, $context);
    }
    
    public static function error($message, $context = []) {
        self::log('error', $message, $context);
    }
}

/**
 * Helper function for logging API requests
 * Used by various API endpoints for consistent logging
 */
function logApiRequest($endpoint, $method, $context = []) {
    Logger::info("API Request: $endpoint ($method)", $context);
}
