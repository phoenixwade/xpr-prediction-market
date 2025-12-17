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
    
    $outcome_is_yes = ($outcome === 'yes' || $outcome === '0');
    
    // For now, use default LMSR parameters
    // In production, these should be fetched from the blockchain
    $q_yes = 0;
    $q_no = 0;
    $b = 500 * SCALE; // Default liquidity parameter
    $fee_bps = 100; // 1% fee
    
    // TODO: Fetch actual market state from blockchain
    // This would require an RPC call to the XPR Network
    // For now, we'll use the defaults which represent a fresh market
    
    // Convert spend amount to micro-TESTIES
    // TESTIES has 0 decimals, so 1 TESTIES = 1,000,000 micro-TESTIES
    $budget_micro = intval($spend_amount * SCALE);
    
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
    
    // Compute average price per share
    $avg_price = $delta_q > 0 ? $total_charge / $delta_q : 0;
    
    // Suggested min_shares for slippage protection (2% tolerance)
    $min_shares = intval($delta_q * 0.98 / SCALE);
    
    logApiRequest('lmsr_quote', 'GET', [
        'market_id' => $market_id,
        'outcome' => $outcome,
        'spend_amount' => $spend_amount,
        'shares' => $shares_display
    ]);
    
    echo json_encode([
        'market_id' => $market_id,
        'outcome' => $outcome_is_yes ? 'yes' : 'no',
        'spend_amount' => $spend_amount,
        'estimated_shares' => $shares_display,
        'raw_cost' => $cost_display,
        'fee' => $fee_display,
        'total_charge' => $total_display,
        'refund' => $refund_display,
        'avg_price_per_share' => $avg_price / SCALE,
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
    
} catch (Exception $e) {
    logApiRequest('lmsr_quote', 'GET', ['error' => $e->getMessage()]);
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
