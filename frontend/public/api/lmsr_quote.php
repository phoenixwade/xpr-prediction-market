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

// LMSR Math Constants
define('SCALE', 1000000); // Fixed-point scale: 1.0 = 1,000,000

// Load environment config
function load_env_config() {
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
    return $config;
}

// Fetch market state from blockchain
function fetch_market_state($market_id) {
    $config = load_env_config();
    $rpcEndpoint = $config['PROTON_RPC'] ?? $config['REACT_APP_RPC_ENDPOINT'] ?? 'https://proton.eosusa.io';
    $contractAccount = $config['CONTRACT_ACCOUNT'] ?? $config['REACT_APP_CONTRACT_NAME'] ?? 'xpredicting';
    
    $url = rtrim($rpcEndpoint, '/') . '/v1/chain/get_table_rows';
    
    $postData = json_encode([
        'code' => $contractAccount,
        'scope' => $contractAccount,
        'table' => 'markets3',
        'json' => true,
        'lower_bound' => (string)$market_id,
        'upper_bound' => (string)$market_id,
        'limit' => 1
    ]);
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Accept: application/json'
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    
    if ($curlError) {
        throw new Exception("RPC request failed: " . $curlError);
    }
    
    if ($httpCode !== 200) {
        throw new Exception("RPC HTTP error: " . $httpCode);
    }
    
    $data = json_decode($response, true);
    if (!$data || !isset($data['rows']) || empty($data['rows'])) {
        throw new Exception("Market not found: " . $market_id);
    }
    
    $market = $data['rows'][0];
    
    // Check if this is an LMSR market (version >= 2)
    $version = isset($market['version']) ? intval($market['version']) : 1;
    if ($version < 2) {
        throw new Exception("Market is not an LMSR market (version: $version)");
    }
    
    // Extract LMSR parameters - these are stored as integers already scaled by SCALE
    $result = [
        'q_yes' => isset($market['q_yes']) ? intval($market['q_yes']) : 0,
        'q_no' => isset($market['q_no']) ? intval($market['q_no']) : 0,
        'b' => isset($market['b']) ? intval($market['b']) : 500 * SCALE,
        'fee_bps' => isset($market['fee_bps']) ? intval($market['fee_bps']) : 100,
        'version' => $version,
        'outcomes_count' => isset($market['outcomes_count']) ? intval($market['outcomes_count']) : 2
    ];
    
    // For version=3 markets, fetch outcome states
    if ($version == 3) {
        $result['outcome_states'] = fetch_outcome_states($market_id, $result['outcomes_count']);
    }
    
    return $result;
}

// Fetch outcome states for N-outcome LMSR markets (version=3)
function fetch_outcome_states($market_id, $outcomes_count) {
    $config = load_env_config();
    $rpcEndpoint = $config['PROTON_RPC'] ?? $config['REACT_APP_RPC_ENDPOINT'] ?? 'https://proton.eosusa.io';
    $contractAccount = $config['CONTRACT_ACCOUNT'] ?? $config['REACT_APP_CONTRACT_NAME'] ?? 'xpredicting';
    
    $url = rtrim($rpcEndpoint, '/') . '/v1/chain/get_table_rows';
    
    // OutcomeStateTable is scoped by market_id
    $postData = json_encode([
        'code' => $contractAccount,
        'scope' => (string)$market_id,
        'table' => 'outstate',
        'json' => true,
        'limit' => $outcomes_count
    ]);
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Accept: application/json'
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        return [];
    }
    
    $data = json_decode($response, true);
    if (!$data || !isset($data['rows'])) {
        return [];
    }
    
    $states = [];
    foreach ($data['rows'] as $row) {
        $states[] = [
            'outcome_id' => intval($row['outcome_id'] ?? 0),
            'q' => intval($row['q'] ?? 0),
            'volume' => intval($row['volume'] ?? 0)
        ];
    }
    
    return $states;
}

// Pre-computed exp lookup table for range [-10, 10] with step 0.01
// This matches the contract's LUT for determinism
function getExpLut() {
    // Simplified LUT - key values for interpolation
    // In production, this should match the contract's full LUT
    static $lut = null;
    if ($lut === null) {
        $lut = [];
        for ($i = -1000; $i <= 1000; $i++) {
            $x = $i / 100.0; // Range -10 to 10
            $lut[$i + 1000] = exp($x) * SCALE;
        }
    }
    return $lut;
}

// Fixed-point exponential using lookup table with interpolation
function exp_fixed($x_scaled) {
    // Clamp to range [-10, 10] in real terms
    $x_real = $x_scaled / SCALE;
    if ($x_real < -10) $x_real = -10;
    if ($x_real > 10) $x_real = 10;
    
    // Use PHP's native exp for accuracy (backend doesn't need determinism)
    return exp($x_real) * SCALE;
}

// Fixed-point natural logarithm
function ln_fixed($x_scaled) {
    if ($x_scaled <= 0) return -10 * SCALE;
    $x_real = $x_scaled / SCALE;
    return log($x_real) * SCALE;
}

// LMSR cost function: C(q_yes, q_no) = b * ln(exp(q_yes/b) + exp(q_no/b))
function lmsr_cost($q_yes, $q_no, $b) {
    if ($b <= 0) return 0;
    
    $ratio_yes = ($q_yes * SCALE) / $b;
    $ratio_no = ($q_no * SCALE) / $b;
    
    $exp_yes = exp_fixed($ratio_yes);
    $exp_no = exp_fixed($ratio_no);
    
    $sum_exp = $exp_yes + $exp_no;
    $ln_sum = ln_fixed($sum_exp);
    
    return ($b * $ln_sum) / SCALE;
}

// Compute cost to buy delta_q shares
function lmsr_buy_cost($q_yes, $q_no, $b, $outcome_is_yes, $delta_q) {
    $new_q_yes = $q_yes;
    $new_q_no = $q_no;
    
    if ($outcome_is_yes) {
        $new_q_yes += $delta_q;
    } else {
        $new_q_no += $delta_q;
    }
    
    $cost_before = lmsr_cost($q_yes, $q_no, $b);
    $cost_after = lmsr_cost($new_q_yes, $new_q_no, $b);
    
    return $cost_after - $cost_before;
}

// Compute implied probability for YES
function lmsr_probability_yes($q_yes, $q_no, $b) {
    if ($b <= 0) return SCALE / 2;
    
    $ratio_yes = ($q_yes * SCALE) / $b;
    $ratio_no = ($q_no * SCALE) / $b;
    
    $exp_yes = exp_fixed($ratio_yes);
    $exp_no = exp_fixed($ratio_no);
    
    $sum_exp = $exp_yes + $exp_no;
    if ($sum_exp == 0) return SCALE / 2;
    
    return ($exp_yes * SCALE) / $sum_exp;
}

// Binary search to find shares from budget
function lmsr_compute_shares_from_budget($q_yes, $q_no, $b, $outcome_is_yes, $budget, $fee_bps) {
    if ($budget <= 0) return 0;
    
    // Find upper bound
    $max_delta = SCALE;
    while ($max_delta < $budget * 10) {
        $cost = lmsr_buy_cost($q_yes, $q_no, $b, $outcome_is_yes, $max_delta);
        $fee = ($cost * $fee_bps) / 10000;
        $total = $cost + $fee;
        if ($total > $budget) break;
        $max_delta *= 2;
    }
    
    // Binary search
    $lo = 0;
    $hi = $max_delta;
    
    for ($i = 0; $i < 32; $i++) {
        $mid = intval(($lo + $hi) / 2);
        $cost = lmsr_buy_cost($q_yes, $q_no, $b, $outcome_is_yes, $mid);
        $fee = ($cost * $fee_bps) / 10000;
        $total = $cost + $fee;
        
        if ($total <= $budget) {
            $lo = $mid;
        } else {
            $hi = $mid;
        }
    }
    
    return $lo;
}

// ============================================================================
// N-OUTCOME LMSR FUNCTIONS (Version 3)
// ============================================================================

// N-outcome LMSR cost function: C(q) = b * ln(sum(exp(q_i/b)))
// Uses log-sum-exp trick for numerical stability
function lmsr_cost_n($q_values, $b) {
    if ($b <= 0 || empty($q_values)) return 0;
    
    $n = count($q_values);
    
    // Compute ratios and find max for log-sum-exp trick
    $ratios = [];
    $max_ratio = PHP_INT_MIN;
    foreach ($q_values as $q) {
        $ratio = ($q * SCALE) / $b;
        $ratios[] = $ratio;
        if ($ratio > $max_ratio) $max_ratio = $ratio;
    }
    
    // Compute sum of exp(ratio - max_ratio)
    $sum_exp = 0;
    foreach ($ratios as $ratio) {
        $sum_exp += exp_fixed($ratio - $max_ratio);
    }
    
    // ln(sum(exp(x_i))) = max + ln(sum(exp(x_i - max)))
    $ln_sum = ln_fixed($sum_exp) + $max_ratio;
    
    return ($b * $ln_sum) / SCALE;
}

// N-outcome buy cost
function lmsr_buy_cost_n($q_values, $b, $outcome_id, $delta_q) {
    if ($outcome_id < 0 || $outcome_id >= count($q_values)) return 0;
    
    $new_q = $q_values;
    $new_q[$outcome_id] += $delta_q;
    
    $cost_before = lmsr_cost_n($q_values, $b);
    $cost_after = lmsr_cost_n($new_q, $b);
    
    return $cost_after - $cost_before;
}

// N-outcome probability for a specific outcome
function lmsr_probability_n($q_values, $b, $outcome_id) {
    if ($b <= 0 || empty($q_values) || $outcome_id < 0 || $outcome_id >= count($q_values)) {
        return SCALE / count($q_values);
    }
    
    $n = count($q_values);
    
    // Compute ratios and find max
    $ratios = [];
    $max_ratio = PHP_INT_MIN;
    foreach ($q_values as $q) {
        $ratio = ($q * SCALE) / $b;
        $ratios[] = $ratio;
        if ($ratio > $max_ratio) $max_ratio = $ratio;
    }
    
    // Compute exp values
    $sum_exp = 0;
    $exp_outcome = 0;
    foreach ($ratios as $i => $ratio) {
        $exp_val = exp_fixed($ratio - $max_ratio);
        $sum_exp += $exp_val;
        if ($i == $outcome_id) $exp_outcome = $exp_val;
    }
    
    if ($sum_exp == 0) return SCALE / $n;
    
    return ($exp_outcome * SCALE) / $sum_exp;
}

// N-outcome all probabilities
function lmsr_probabilities_n($q_values, $b) {
    $n = count($q_values);
    $probs = [];
    
    if ($b <= 0 || $n == 0) {
        $equal_prob = SCALE / $n;
        for ($i = 0; $i < $n; $i++) {
            $probs[] = $equal_prob;
        }
        return $probs;
    }
    
    // Compute ratios and find max
    $ratios = [];
    $max_ratio = PHP_INT_MIN;
    foreach ($q_values as $q) {
        $ratio = ($q * SCALE) / $b;
        $ratios[] = $ratio;
        if ($ratio > $max_ratio) $max_ratio = $ratio;
    }
    
    // Compute exp values and sum
    $exp_vals = [];
    $sum_exp = 0;
    foreach ($ratios as $ratio) {
        $exp_val = exp_fixed($ratio - $max_ratio);
        $exp_vals[] = $exp_val;
        $sum_exp += $exp_val;
    }
    
    if ($sum_exp == 0) {
        $equal_prob = SCALE / $n;
        for ($i = 0; $i < $n; $i++) {
            $probs[] = $equal_prob;
        }
        return $probs;
    }
    
    foreach ($exp_vals as $exp_val) {
        $probs[] = ($exp_val * SCALE) / $sum_exp;
    }
    
    return $probs;
}

// N-outcome binary search for shares from budget
function lmsr_compute_shares_from_budget_n($q_values, $b, $outcome_id, $budget, $fee_bps) {
    if ($budget <= 0 || $outcome_id < 0 || $outcome_id >= count($q_values)) return 0;
    
    // Find upper bound
    $max_delta = SCALE;
    while ($max_delta < $budget * 10) {
        $cost = lmsr_buy_cost_n($q_values, $b, $outcome_id, $max_delta);
        $fee = ($cost * $fee_bps) / 10000;
        if ($cost + $fee > $budget) break;
        $max_delta *= 2;
    }
    
    // Binary search
    $lo = 0;
    $hi = $max_delta;
    
    for ($i = 0; $i < 32; $i++) {
        $mid = intval(($lo + $hi) / 2);
        $cost = lmsr_buy_cost_n($q_values, $b, $outcome_id, $mid);
        $fee = ($cost * $fee_bps) / 10000;
        
        if ($cost + $fee <= $budget) {
            $lo = $mid;
        } else {
            $hi = $mid;
        }
    }
    
    return $lo;
}

try {
    // Get parameters
    $market_id = intval($_GET['market_id'] ?? $_POST['market_id'] ?? 0);
    $outcome = strtolower($_GET['outcome'] ?? $_POST['outcome'] ?? 'yes');
    $spend_amount = floatval($_GET['spend_amount'] ?? $_POST['spend_amount'] ?? 0);
    
    // Validate inputs
    if ($market_id <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid market_id']);
        exit;
    }
    
    if ($spend_amount <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'spend_amount must be positive']);
        exit;
    }
    
    // Fetch actual market state from blockchain
    $marketState = null;
    try {
        $marketState = fetch_market_state($market_id);
    } catch (Exception $e) {
        logApiRequest('lmsr_quote_market_fetch_error', 'GET', [
            'market_id' => $market_id,
            'error' => $e->getMessage()
        ]);
        
        // Use defaults for fresh/unfound markets
        $marketState = [
            'q_yes' => 0,
            'q_no' => 0,
            'b' => 500 * SCALE,
            'fee_bps' => 100,
            'version' => 2,
            'outcomes_count' => 2
        ];
    }
    
    $b = $marketState['b'];
    $fee_bps = $marketState['fee_bps'];
    $version = $marketState['version'];
    
    // Convert spend amount to internal fixed-point units
    $budget_micro = intval($spend_amount * SCALE);
    
    // Route to appropriate handler based on market version
    if ($version == 3 && isset($marketState['outcome_states'])) {
        // N-outcome LMSR (version 3)
        $outcome_id = intval($outcome);
        $outcome_states = $marketState['outcome_states'];
        $outcomes_count = $marketState['outcomes_count'];
        
        // Build q_values array from outcome states
        $q_values = array_fill(0, $outcomes_count, 0);
        foreach ($outcome_states as $state) {
            $q_values[$state['outcome_id']] = $state['q'];
        }
        
        // Validate outcome_id
        if ($outcome_id < 0 || $outcome_id >= $outcomes_count) {
            http_response_code(400);
            echo json_encode(['error' => "Invalid outcome_id: $outcome_id (market has $outcomes_count outcomes)"]);
            exit;
        }
        
        // Compute shares
        $delta_q = lmsr_compute_shares_from_budget_n($q_values, $b, $outcome_id, $budget_micro, $fee_bps);
        
        // Compute actual cost and fee
        $raw_cost = lmsr_buy_cost_n($q_values, $b, $outcome_id, $delta_q);
        $fee = ($raw_cost * $fee_bps) / 10000;
        $total_charge = $raw_cost + $fee;
        $refund = $budget_micro - $total_charge;
        
        // Compute current and new probabilities
        $current_probs = lmsr_probabilities_n($q_values, $b);
        
        $new_q = $q_values;
        $new_q[$outcome_id] += $delta_q;
        $new_probs = lmsr_probabilities_n($new_q, $b);
        
        // Convert to display values
        $shares_display = $delta_q / SCALE;
        $cost_display = $raw_cost / SCALE;
        $fee_display = $fee / SCALE;
        $total_display = $total_charge / SCALE;
        $refund_display = max(0, $refund / SCALE);
        $avg_price_display = $delta_q > 0 ? ($total_charge / $delta_q) : 0;
        $min_shares = intval($delta_q * 0.98 / SCALE);
        
        // Build odds arrays
        $current_odds = [];
        $new_odds = [];
        for ($i = 0; $i < $outcomes_count; $i++) {
            $current_odds[$i] = $current_probs[$i] / SCALE * 100;
            $new_odds[$i] = $new_probs[$i] / SCALE * 100;
        }
        
        logApiRequest('lmsr_quote_n', 'GET', [
            'market_id' => $market_id,
            'outcome_id' => $outcome_id,
            'spend_amount' => $spend_amount,
            'shares' => $shares_display
        ]);
        
        echo json_encode([
            'market_id' => $market_id,
            'version' => 3,
            'outcome_id' => $outcome_id,
            'spend_amount' => $spend_amount,
            'estimated_shares' => $shares_display,
            'raw_cost' => $cost_display,
            'fee' => $fee_display,
            'total_charge' => $total_display,
            'refund' => $refund_display,
            'avg_price_per_share' => $avg_price_display,
            'min_shares_for_slippage' => $min_shares,
            'current_odds' => $current_odds,
            'new_odds_after_purchase' => $new_odds,
            'memo_format' => "buy:{$market_id}:{$outcome_id}:{$min_shares}"
        ]);
    } else {
        // Binary LMSR (version 2)
        $outcome_is_yes = ($outcome === 'yes' || $outcome === '0');
        $q_yes = $marketState['q_yes'];
        $q_no = $marketState['q_no'];
        
        // Compute shares
        $delta_q = lmsr_compute_shares_from_budget($q_yes, $q_no, $b, $outcome_is_yes, $budget_micro, $fee_bps);
        
        // Compute actual cost and fee
        $raw_cost = lmsr_buy_cost($q_yes, $q_no, $b, $outcome_is_yes, $delta_q);
        $fee = ($raw_cost * $fee_bps) / 10000;
        $total_charge = $raw_cost + $fee;
        $refund = $budget_micro - $total_charge;
        
        // Compute new odds after purchase
        $new_q_yes = $q_yes;
        $new_q_no = $q_no;
        if ($outcome_is_yes) {
            $new_q_yes += $delta_q;
        } else {
            $new_q_no += $delta_q;
        }
        $new_prob_yes = lmsr_probability_yes($new_q_yes, $new_q_no, $b);
        $new_prob_no = SCALE - $new_prob_yes;
        
        // Current odds
        $current_prob_yes = lmsr_probability_yes($q_yes, $q_no, $b);
        $current_prob_no = SCALE - $current_prob_yes;
        
        // Convert to display values
        $shares_display = $delta_q / SCALE;
        $cost_display = $raw_cost / SCALE;
        $fee_display = $fee / SCALE;
        $total_display = $total_charge / SCALE;
        $refund_display = max(0, $refund / SCALE);
        $avg_price_display = $delta_q > 0 ? ($total_charge / $delta_q) : 0;
        $min_shares = intval($delta_q * 0.98 / SCALE);
        
        logApiRequest('lmsr_quote', 'GET', [
            'market_id' => $market_id,
            'outcome' => $outcome,
            'spend_amount' => $spend_amount,
            'shares' => $shares_display
        ]);
        
        echo json_encode([
            'market_id' => $market_id,
            'version' => 2,
            'outcome' => $outcome_is_yes ? 'yes' : 'no',
            'spend_amount' => $spend_amount,
            'estimated_shares' => $shares_display,
            'raw_cost' => $cost_display,
            'fee' => $fee_display,
            'total_charge' => $total_display,
            'refund' => $refund_display,
            'avg_price_per_share' => $avg_price_display,
            'min_shares_for_slippage' => $min_shares,
            'current_odds' => [
                'yes' => $current_prob_yes / SCALE * 100,
                'no' => $current_prob_no / SCALE * 100
            ],
            'new_odds_after_purchase' => [
                'yes' => $new_prob_yes / SCALE * 100,
                'no' => $new_prob_no / SCALE * 100
            ],
            'memo_format' => "buy:{$market_id}:{$outcome}:{$min_shares}"
        ]);
    }
    
} catch (Exception $e) {
    logApiRequest('lmsr_quote', 'GET', ['error' => $e->getMessage()]);
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
