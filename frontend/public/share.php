<?php
/**
 * Share page for social media previews
 * 
 * This script serves dynamic OG meta tags for market pages so that
 * social media crawlers (Twitter, Facebook, etc.) can display proper
 * previews with the market's title and image.
 * 
 * Usage: https://xpredicting.com/share.php?market=123
 * 
 * Crawlers will see the OG tags; browsers will be redirected to the SPA.
 */

$marketId = isset($_GET['market']) ? intval($_GET['market']) : 0;

// Default values
$title = 'XPRedicting - Proton Prediction Markets';
$description = 'Trade on prediction markets powered by Proton blockchain.';
$imageUrl = 'https://xpredicting.com/xpr_logo.png';
$marketUrl = 'https://xpredicting.com/';

if ($marketId > 0) {
    $marketUrl = "https://xpredicting.com/?market={$marketId}";
    
    // Fetch market data from blockchain RPC
    $rpcEndpoint = 'https://proton.eosusa.io';
    $contractName = 'xpredicting';
    
    $payload = json_encode([
        'code' => $contractName,
        'scope' => $contractName,
        'table' => 'markets3',
        'lower_bound' => $marketId,
        'upper_bound' => $marketId,
        'limit' => 1,
        'json' => true
    ]);
    
    $ch = curl_init("{$rpcEndpoint}/v1/chain/get_table_rows");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode === 200 && $response) {
        $data = json_decode($response, true);
        if (isset($data['rows']) && count($data['rows']) > 0) {
            $market = $data['rows'][0];
            
            // Set title from market question
            if (isset($market['question']) && !empty($market['question'])) {
                $title = $market['question'] . ' | XPRedicting';
            }
            
            // Set image from market image_url if available
            if (isset($market['image_url']) && !empty($market['image_url'])) {
                $imageUrl = $market['image_url'];
            }
            
            // Set description from category
            if (isset($market['category']) && !empty($market['category'])) {
                $description = "Prediction market in {$market['category']} category. Trade on XPRedicting.";
            }
        }
    }
    
    // Also try to get description from market_meta database
    $metaDbPath = __DIR__ . '/data/market_meta.db';
    if (file_exists($metaDbPath)) {
        try {
            $db = new SQLite3($metaDbPath);
            $stmt = $db->prepare('SELECT description FROM market_meta WHERE market_id = :market_id');
            $stmt->bindValue(':market_id', $marketId, SQLITE3_INTEGER);
            $result = $stmt->execute();
            $row = $result->fetchArray(SQLITE3_ASSOC);
            if ($row && !empty($row['description'])) {
                $description = substr($row['description'], 0, 200);
                if (strlen($row['description']) > 200) {
                    $description .= '...';
                }
            }
            $db->close();
        } catch (Exception $e) {
            // Ignore database errors, use default description
        }
    }
}

// Escape for HTML output
$title = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
$description = htmlspecialchars($description, ENT_QUOTES, 'UTF-8');
$imageUrl = htmlspecialchars($imageUrl, ENT_QUOTES, 'UTF-8');
$marketUrl = htmlspecialchars($marketUrl, ENT_QUOTES, 'UTF-8');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= $title ?></title>
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="<?= $marketUrl ?>">
    <meta property="og:title" content="<?= $title ?>">
    <meta property="og:description" content="<?= $description ?>">
    <meta property="og:image" content="<?= $imageUrl ?>">
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="<?= $marketUrl ?>">
    <meta name="twitter:title" content="<?= $title ?>">
    <meta name="twitter:description" content="<?= $description ?>">
    <meta name="twitter:image" content="<?= $imageUrl ?>">
    
    <!-- Redirect browsers to the SPA -->
    <meta http-equiv="refresh" content="0;url=<?= $marketUrl ?>">
    
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: #0f172a;
            color: #e2e8f0;
        }
        .loading {
            text-align: center;
        }
        .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #334155;
            border-top-color: #7c3aed;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="loading">
        <div class="spinner"></div>
        <p>Redirecting to market...</p>
    </div>
    <script>
        // Immediate redirect for browsers
        window.location.href = '<?= $marketUrl ?>';
    </script>
</body>
</html>
