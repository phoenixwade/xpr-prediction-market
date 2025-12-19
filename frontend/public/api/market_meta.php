<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Database setup
$dbPath = __DIR__ . '/../data/market_meta.db';
$dbDir = dirname($dbPath);

if (!is_dir($dbDir)) {
    mkdir($dbDir, 0755, true);
}

try {
    $db = new SQLite3($dbPath);
    $db->exec('
        CREATE TABLE IF NOT EXISTS market_meta (
            market_id INTEGER PRIMARY KEY,
            description TEXT,
            resolution_criteria TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
    ');
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Get market metadata by market_id
    $marketId = isset($_GET['market_id']) ? intval($_GET['market_id']) : null;
    
    if ($marketId === null) {
        // Return all market metadata
        $result = $db->query('SELECT * FROM market_meta ORDER BY market_id DESC');
        $metas = [];
        while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
            $metas[] = [
                'market_id' => intval($row['market_id']),
                'description' => $row['description'],
                'resolution_criteria' => $row['resolution_criteria'],
                'created_at' => intval($row['created_at']),
                'updated_at' => intval($row['updated_at'])
            ];
        }
        echo json_encode(['success' => true, 'data' => $metas]);
    } else {
        // Return specific market metadata
        $stmt = $db->prepare('SELECT * FROM market_meta WHERE market_id = :market_id');
        $stmt->bindValue(':market_id', $marketId, SQLITE3_INTEGER);
        $result = $stmt->execute();
        $row = $result->fetchArray(SQLITE3_ASSOC);
        
        if ($row) {
            echo json_encode([
                'success' => true,
                'data' => [
                    'market_id' => intval($row['market_id']),
                    'description' => $row['description'],
                    'resolution_criteria' => $row['resolution_criteria'],
                    'created_at' => intval($row['created_at']),
                    'updated_at' => intval($row['updated_at'])
                ]
            ]);
        } else {
            echo json_encode(['success' => true, 'data' => null]);
        }
    }
} elseif ($method === 'POST' || $method === 'PUT') {
    // Create or update market metadata
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['market_id'])) {
        http_response_code(400);
        echo json_encode(['error' => 'market_id is required']);
        exit;
    }
    
    $marketId = intval($data['market_id']);
    $description = isset($data['description']) ? $data['description'] : '';
    $resolutionCriteria = isset($data['resolution_criteria']) ? $data['resolution_criteria'] : '';
    $now = time();
    
    // Check if record exists
    $stmt = $db->prepare('SELECT market_id FROM market_meta WHERE market_id = :market_id');
    $stmt->bindValue(':market_id', $marketId, SQLITE3_INTEGER);
    $result = $stmt->execute();
    $exists = $result->fetchArray();
    
    if ($exists) {
        // Update existing record
        $stmt = $db->prepare('
            UPDATE market_meta 
            SET description = :description, 
                resolution_criteria = :resolution_criteria, 
                updated_at = :updated_at 
            WHERE market_id = :market_id
        ');
    } else {
        // Insert new record
        $stmt = $db->prepare('
            INSERT INTO market_meta (market_id, description, resolution_criteria, created_at, updated_at)
            VALUES (:market_id, :description, :resolution_criteria, :created_at, :updated_at)
        ');
        $stmt->bindValue(':created_at', $now, SQLITE3_INTEGER);
    }
    
    $stmt->bindValue(':market_id', $marketId, SQLITE3_INTEGER);
    $stmt->bindValue(':description', $description, SQLITE3_TEXT);
    $stmt->bindValue(':resolution_criteria', $resolutionCriteria, SQLITE3_TEXT);
    $stmt->bindValue(':updated_at', $now, SQLITE3_INTEGER);
    
    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'data' => [
                'market_id' => $marketId,
                'description' => $description,
                'resolution_criteria' => $resolutionCriteria
            ]
        ]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save market metadata']);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}

$db->close();
