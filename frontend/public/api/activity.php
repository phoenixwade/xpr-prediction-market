<?php
/**
 * Activity Feed API Endpoint
 * Fetches and normalizes blockchain activity from Hyperion History API
 * Supports filtering by market_id, event type, and user wallet
 */

require_once __DIR__ . '/logger.php';

Logger::init();
Logger::info('Activity API request started');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    Logger::debug('OPTIONS request - returning CORS headers');
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Logger::warning('Method not allowed', ['method' => $_SERVER['REQUEST_METHOD']]);
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$envFile = __DIR__ . '/../../.env';
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

$hyperionEndpoint = 'https://proton.eosusa.io';
$contractAccount = $config['CONTRACT_ACCOUNT'] ?? 'xpredicting';

Logger::debug('Configuration loaded', [
    'hyperion' => $hyperionEndpoint,
    'contract' => $contractAccount
]);

$marketId = isset($_GET['market_id']) ? intval($_GET['market_id']) : 0;
$eventType = isset($_GET['event_type']) ? trim($_GET['event_type']) : '';
$userFilter = isset($_GET['user']) ? trim($_GET['user']) : '';
$limit = isset($_GET['limit']) ? min(intval($_GET['limit']), 100) : 50;
$skip = isset($_GET['skip']) ? intval($_GET['skip']) : 0;

if ($marketId === 0) {
    Logger::warning('Missing market_id parameter');
    http_response_code(400);
    echo json_encode(['error' => 'market_id parameter is required']);
    exit;
}

Logger::info('Processing activity request', [
    'market_id' => $marketId,
    'event_type' => $eventType,
    'user' => $userFilter,
    'limit' => $limit,
    'skip' => $skip
]);

$hyperionUrl = $hyperionEndpoint . '/v2/history/get_actions';
$params = [
    'account' => $contractAccount,
    'limit' => $limit,
    'skip' => $skip,
    'sort' => 'desc'
];

if ($eventType) {
    $actionMap = [
        'createmkt' => 'createmkt',
        'placeorder' => 'placeorder',
        'resolve' => 'resolve'
    ];
    
    if (isset($actionMap[$eventType])) {
        $params['filter'] = $contractAccount . ':' . $actionMap[$eventType];
    }
}

$queryString = http_build_query($params);
$fullUrl = $hyperionUrl . '?' . $queryString;

Logger::debug('Calling Hyperion API', ['url' => $fullUrl]);

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $fullUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Accept: application/json'
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    Logger::error('Hyperion API request failed', ['error' => $curlError]);
    http_response_code(502);
    echo json_encode(['error' => 'Failed to fetch activity from blockchain']);
    exit;
}

if ($httpCode !== 200) {
    Logger::error('Hyperion API returned error', ['http_code' => $httpCode, 'response' => substr($response, 0, 500)]);
    http_response_code(502);
    echo json_encode(['error' => 'Blockchain API returned error']);
    exit;
}

$data = json_decode($response, true);
if (!$data || !isset($data['actions'])) {
    Logger::error('Invalid response from Hyperion', ['response' => substr($response, 0, 500)]);
    http_response_code(502);
    echo json_encode(['error' => 'Invalid response from blockchain API']);
    exit;
}

Logger::info('Hyperion API response received', ['action_count' => count($data['actions'])]);

$activities = [];
foreach ($data['actions'] as $action) {
    $actData = $action['act']['data'] ?? [];
    $actName = $action['act']['name'] ?? '';
    
    $actionMarketId = isset($actData['market_id']) ? intval($actData['market_id']) : 0;
    if ($actionMarketId !== $marketId) {
        continue;
    }
    
    $actor = $action['act']['authorization'][0]['actor'] ?? '';
    if ($userFilter && $actor !== $userFilter) {
        continue;
    }
    
    $activity = [
        'type' => $actName,
        'market_id' => $actionMarketId,
        'user' => $actor,
        'timestamp' => $action['timestamp'] ?? '',
        'block_num' => $action['block_num'] ?? 0,
        'trx_id' => $action['trx_id'] ?? '',
    ];
    
    switch ($actName) {
        case 'createmkt':
            $activity['question'] = $actData['question'] ?? '';
            $activity['category'] = $actData['category'] ?? '';
            break;
            
        case 'placeorder':
            $activity['outcome_id'] = $actData['outcome_id'] ?? 0;
            $activity['side'] = isset($actData['bid']) && $actData['bid'] ? 'buy' : 'sell';
            $activity['price'] = $actData['price'] ?? '';
            $activity['quantity'] = $actData['quantity'] ?? 0;
            break;
            
        case 'resolve':
            $activity['outcome'] = $actData['outcome'] ?? 0;
            break;
    }
    
    $activities[] = $activity;
}

Logger::info('Activity feed processed', [
    'total_actions' => count($data['actions']),
    'filtered_activities' => count($activities)
]);

echo json_encode([
    'success' => true,
    'activities' => $activities,
    'total' => count($activities),
    'has_more' => count($data['actions']) >= $limit
]);
