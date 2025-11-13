import React from 'react';

const HowToUse: React.FC = () => {
  return (
    <div className="how-to-use-container">
      <div className="how-to-use-content">
        <h1 className="how-to-use-title">How to Use {process.env.REACT_APP_NAME || 'Proton Prediction Market'}</h1>
        
        <div className="how-to-use-intro">
          <p>
            Welcome to the prediction market! This platform allows you to trade shares on the outcome of future events.
            You can buy "Yes" or "No" shares for any market, and if your prediction is correct, each share pays out 1.0000 XPR.
          </p>
        </div>

        <div className="how-to-use-section">
          <h2>Getting Started</h2>
          
          <div className="how-to-use-step">
            <h3>Step 1: Connect Your Wallet</h3>
            <p>
              Click the "Connect Wallet" button in the top right corner of the page. You'll need a Proton wallet to use this platform.
              If you don't have one, you can create a free account at <a href="https://www.protonchain.com/" target="_blank" rel="noopener noreferrer">protonchain.com</a>.
            </p>
            <ul>
              <li>Your wallet connection persists across page refreshes</li>
              <li>You can disconnect at any time by clicking "Disconnect"</li>
              <li>Your wallet holds your XPR tokens used for trading</li>
            </ul>
          </div>

          <div className="how-to-use-step">
            <h3>Step 2: Browse Markets</h3>
            <p>
              The home page shows all available prediction markets. Each market has:
            </p>
            <ul>
              <li><strong>Question:</strong> The event being predicted</li>
              <li><strong>Category:</strong> The type of event (sports, politics, crypto, etc.)</li>
              <li><strong>Expiry Date:</strong> When the market closes for trading</li>
              <li><strong>Status:</strong> Whether the market is active or resolved</li>
            </ul>
            <p>
              Click on any market to view details and place orders.
            </p>
          </div>

          <div className="how-to-use-step">
            <h3>Step 3: Understanding the Order Book</h3>
            <p>
              When you click on a market, you'll see the order book with two sides:
            </p>
            <ul>
              <li><strong>Bids (Buy Orders):</strong> Orders to buy "Yes" shares at specific prices</li>
              <li><strong>Asks (Sell Orders):</strong> Orders to sell "Yes" shares at specific prices</li>
            </ul>
            <p>
              Prices are shown as decimals (e.g., 0.65 means 65¢ per share). If you buy a "Yes" share at 0.65 and the outcome is "Yes", 
              you'll receive 1.0000 XPR, making a profit of 0.35 XPR per share.
            </p>
          </div>
        </div>

        <div className="how-to-use-section">
          <h2>Trading</h2>
          
          <div className="how-to-use-step">
            <h3>Step 4: Placing an Order</h3>
            <p>
              To place an order, fill out the order form:
            </p>
            <ol>
              <li><strong>Select Outcome:</strong> Choose "Yes" or "No" for what you think will happen</li>
              <li><strong>Select Order Type:</strong> Choose "Buy" to purchase shares or "Sell" to sell shares</li>
              <li><strong>Enter Price:</strong> The price per share (between 0.0001 and 0.9999)</li>
              <li><strong>Enter Quantity:</strong> How many shares you want to trade</li>
              <li><strong>Click "Place Order":</strong> Confirm the transaction in your wallet</li>
            </ol>
            <p>
              <strong>Important:</strong> When you place an order, the required XPR is automatically transferred from your wallet.
              You don't need to deposit funds separately!
            </p>
            <ul>
              <li><strong>Buy Orders:</strong> You'll transfer (price × quantity) XPR</li>
              <li><strong>Sell Orders:</strong> If you don't own shares, you'll transfer 1.0000 XPR per share as collateral</li>
            </ul>
          </div>

          <div className="how-to-use-step">
            <h3>Step 5: Order Matching</h3>
            <p>
              Orders are matched automatically when:
            </p>
            <ul>
              <li>A buy order price meets or exceeds a sell order price</li>
              <li>Orders are matched at the existing order's price (maker gets priority)</li>
              <li>Partial fills are possible - your order may match multiple existing orders</li>
            </ul>
            <p>
              If your order doesn't match immediately, it stays in the order book until:
            </p>
            <ul>
              <li>Someone places a matching order</li>
              <li>You cancel the order</li>
              <li>The market expires</li>
            </ul>
          </div>

          <div className="how-to-use-step">
            <h3>Step 6: Managing Your Orders</h3>
            <p>
              View your active orders in the "Your Orders" section on the market detail page. You can:
            </p>
            <ul>
              <li><strong>Cancel Orders:</strong> Click "Cancel" to remove an order and get your funds back</li>
              <li><strong>View Order Details:</strong> See the price, quantity, and type of each order</li>
            </ul>
            <p>
              Cancelled orders return funds to your internal balance immediately.
            </p>
          </div>
        </div>

        <div className="how-to-use-section">
          <h2>Portfolio Management</h2>
          
          <div className="how-to-use-step">
            <h3>Step 7: Checking Your Balance</h3>
            <p>
              Click on "Portfolio" in the navigation to view:
            </p>
            <ul>
              <li><strong>Available Balance:</strong> XPR available for trading (from deposits, cancelled orders, and trade profits)</li>
              <li><strong>Your Positions:</strong> Shares you own in each market</li>
            </ul>
            <p>
              Your balance includes:
            </p>
            <ul>
              <li>Funds from inline transfers when placing orders</li>
              <li>Profits from matched trades</li>
              <li>Refunds from cancelled orders</li>
              <li>Payouts from resolved markets</li>
            </ul>
          </div>

          <div className="how-to-use-step">
            <h3>Step 8: Withdrawing Funds</h3>
            <p>
              To withdraw XPR back to your wallet:
            </p>
            <ol>
              <li>Go to your Portfolio</li>
              <li>Enter the amount you want to withdraw</li>
              <li>Click "Withdraw"</li>
              <li>Confirm the transaction in your wallet</li>
            </ol>
            <p>
              Withdrawn funds are sent directly to your connected wallet address.
            </p>
          </div>
        </div>

        <div className="how-to-use-section">
          <h2>Market Resolution & Claiming</h2>
          
          <div className="how-to-use-step">
            <h3>Step 9: Market Resolution</h3>
            <p>
              When a market's expiry date passes, an admin will resolve it by setting the outcome to "Yes" or "No".
              Once resolved:
            </p>
            <ul>
              <li>No more trading is allowed</li>
              <li>Winning shares can be claimed for 1.0000 XPR each</li>
              <li>Losing shares become worthless</li>
            </ul>
          </div>

          <div className="how-to-use-step">
            <h3>Step 10: Claiming Winnings</h3>
            <p>
              If you hold winning shares in a resolved market:
            </p>
            <ol>
              <li>Go to the market detail page</li>
              <li>Click "Claim Winnings"</li>
              <li>Confirm the transaction in your wallet</li>
            </ol>
            <p>
              Your winnings (1.0000 XPR per winning share) will be added to your internal balance.
              You can then withdraw them to your wallet or use them to trade in other markets.
            </p>
          </div>
        </div>

        <div className="how-to-use-section">
          <h2>Tips & Best Practices</h2>
          
          <div className="how-to-use-tips">
            <ul>
              <li><strong>Start Small:</strong> Try trading with small amounts to get familiar with the platform</li>
              <li><strong>Check Expiry Dates:</strong> Make sure you have time to trade before the market closes</li>
              <li><strong>Watch the Order Book:</strong> See what prices others are willing to trade at</li>
              <li><strong>Consider Probability:</strong> A price of 0.65 implies a 65% chance of "Yes"</li>
              <li><strong>Manage Risk:</strong> Don't invest more than you can afford to lose</li>
              <li><strong>Cancel Unwanted Orders:</strong> If the market moves against you, cancel and re-place orders</li>
              <li><strong>Claim Promptly:</strong> Claim your winnings as soon as markets resolve</li>
            </ul>
          </div>
        </div>

        <div className="how-to-use-section">
          <h2>Understanding Fees</h2>
          
          <div className="how-to-use-step">
            <p>
              The platform charges a small fee (0.01%) on matched trades. This fee is deducted from the seller's payout.
              For example:
            </p>
            <ul>
              <li>Buyer pays 0.6500 XPR for 1 share</li>
              <li>Seller receives 0.6499 XPR (0.6500 - 0.01% fee)</li>
              <li>Platform collects 0.0001 XPR as fee</li>
            </ul>
          </div>
        </div>

        <div className="how-to-use-section">
          <h2>Need Help?</h2>
          
          <div className="how-to-use-help">
            <p>
              If you have questions or encounter issues:
            </p>
            <ul>
              <li>Hover over elements with tooltips (ℹ️) for quick help</li>
              <li>Check your wallet connection if transactions fail</li>
              <li>Make sure you have enough XPR in your wallet for trading</li>
              <li>Contact support through our social channels (links in footer)</li>
            </ul>
          </div>
        </div>

        <div className="how-to-use-footer">
          <p>
            Ready to start trading? <a href="/">Browse Markets</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default HowToUse;
