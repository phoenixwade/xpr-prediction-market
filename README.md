# Proton Prediction Market Platform

A decentralized prediction market platform built on the Proton (XPR) blockchain, featuring multi-outcome markets with an on-chain order book trading engine.

## Overview

This platform combines the best features of Polymarket, Kalshi, and PredictIt to create a transparent, low-fee prediction market on the Proton blockchain. Users can create markets, trade on outcomes, and claim winnings - all with full on-chain transparency and non-custodial wallet integration.

## Features

### Core Trading Features
- **Multi-Outcome Markets**: Support for binary (Yes/No) and multi-outcome prediction markets
- **Central Limit Order Book (CLOB)**: On-chain order matching engine with automatic trade execution
- **Non-Custodial**: Users maintain full control of funds via Proton WebAuth
- **Minimal Fees**: 0.01% taker fee, 0% maker fee
- **Automated Settlement**: Smart contract handles market resolution and payouts
- **Collateral Management**: Automatic handling of short selling collateral (1 XUSDC per share)

### Market Management
- **Market Approval Workflow**: Admin approval required before markets go live
- **Settings Singleton**: Contract-level configuration management
- **Market Categories**: Organize markets by topic (Politics, Sports, Crypto, etc.)
- **Image Upload**: Market thumbnails for visual appeal
- **Shareable Links**: Direct links to specific markets for social sharing

### User Interface
- **Wallet Integration**: Seamless Proton WebAuth connection
- **Markets List**: Browse and filter markets by category and status (defaults to Active)
- **Order Book Display**: Real-time bid/ask order book visualization
- **Trading Interface**: Place buy/sell orders with limit pricing
- **My Orders Section**: View all your orders across all outcomes in one place
- **Portfolio Management**: View positions, balances, and claim winnings
- **Mobile Responsive**: Optimized for all screen sizes

### Social Features
- **Comments System**: Discussion threads on each market with reply functionality
- **Comment Moderation**: Admin delete capability for inappropriate content
- **Activity Feed**: Real-time stream of market events (trades, orders, resolutions)
- **Social Sharing**: Share markets on Twitter, Telegram, and Facebook

### Admin Features
- **Admin Panel**: Create markets, approve pending markets, and resolve markets
- **Market Approval**: Review and approve user-submitted markets before they go live
- **Market Resolution**: Resolve markets with the correct outcome after expiry
- **Fee Collection**: Withdraw accumulated platform fees

### Technical Features
- **Real-time Updates**: Automatic polling every 5 seconds
- **Comprehensive Logging**: API request logging for debugging and monitoring
- **Automated Backups**: Daily/weekly/monthly backups of database and configuration
- **SQLite Backend**: Persistent storage for comments and activity data

## Technology Stack

- **Blockchain**: Proton (XPR Network) - EOSIO-based with WASM smart contracts
- **Smart Contracts**: TypeScript/AssemblyScript using proton-tsc SDK
- **Frontend**: React 18 with TypeScript
- **Wallet**: Proton WebAuth (@proton/web-sdk)
- **Blockchain Interaction**: @proton/js for RPC queries
- **Backend**: PHP 8.x with SQLite 3
- **Node.js**: v20.x (required for compatibility)

## Project Structure

See the repository for the complete project structure including contracts, frontend components, API files, and automation scripts.

## Smart Contract Architecture

### Data Tables

1. **Markets Table** - Market questions, categories, expiry, resolution status
2. **Outcomes Table** - Outcome names and IDs for multi-outcome support
3. **Orders Table** - Central limit order book with automatic matching
4. **Positions Table** - User holdings of shares per outcome
5. **Balances Table** - Internal ledger for deposited XUSDC funds
6. **Settings Table** - Contract-level configuration

### Contract Actions

1. **transfer (notify)** - Deposit XUSDC tokens
2. **withdraw** - Withdraw XUSDC tokens
3. **createmkt** - Create new prediction market (requires approval)
4. **approvemkt** - Approve pending market (admin only)
5. **placeorder** - Place buy/sell order for outcome shares
6. **cancelorder** - Cancel open order and refund collateral
7. **resolve** - Resolve market with winning outcome (admin only)
8. **claim** - Claim winnings from resolved markets
9. **collectfees** - Collect platform fees (admin only)
10. **updatesettings** - Update contract settings (admin only)

### Trading Mechanics

- **Order Matching**: Automatic on-chain matching of compatible bids and asks
- **Collateral System**: Buyers lock price × quantity in XUSDC; sellers provide shares or lock 1 XUSDC per share
- **Share Creation**: Outcome shares created on-demand when trades execute
- **Fee Structure**: 0.01% taker fee, 0% maker fee
- **Price Discovery**: Market-driven through order book (0-1 XUSDC per share)

## Installation & Setup

### Prerequisites

- **Node.js v20.x** (required for compatibility)
- **npm** (comes with Node.js)
- **Git** for version control
- **Proton Testnet Account** for smart contract deployment
- **Web Server** (Apache/Nginx) for production deployment

### Quick Start

```bash
# Install Node.js 20
nvm install 20 && nvm use 20

# Clone repository
git clone https://github.com/phoenixwade/proton-prediction-market.git
cd proton-prediction-market

# Smart Contract Setup
cd contracts && npm install && npm run build

# Frontend Setup
cd ../frontend
cp .env.example .env
# Edit .env with your configuration
npm install && npm start
```

### Environment Configuration

Copy `.env.example` to `.env` and configure with your contract account, admin accounts, and API settings.

### Production Deployment

```bash
cd frontend && npm run build
cd .. && ./deploy-to-cpanel.sh
```

## Usage Guide

### For Traders

1. Connect wallet with Proton WebAuth
2. Deposit XUSDC to fund trading account
3. Browse markets and filter by category
4. Place orders on outcomes
5. View activity feed for market events
6. Manage portfolio and claim winnings
7. Withdraw funds anytime

### For Market Creators

1. Create markets via Admin panel
2. Add multiple outcomes and optional thumbnail
3. Wait for admin approval before market goes live

### For Admins

1. Approve pending markets
2. Resolve markets after expiry
3. Moderate comments
4. Collect platform fees

## Fee Structure

- **Maker Fee**: 0%
- **Taker Fee**: 0.01%
- **Withdrawal Fee**: None
- **Market Creation**: Free (requires approval)

## Development Roadmap

### ✅ Completed Phases

**Phase 1: Core Platform** (PR #1)
- Multi-outcome markets, CLOB, trading interface, portfolio management

**Phase 2: Settings Singleton** (PR #40)
- Contract-level configuration management

**Phase 3: Market Approval Workflow** (PR #40)
- Admin approval required before markets go live

**Phase 4: Comments System** (PRs #42-#46)
- SQLite backend, reply functionality, moderation

**Phase 5: Activity Feed** (PR #59)
- Real-time activity stream with filtering

**Phase 6 & 7: Market Discovery and Portfolio Enhancements** (PR #62)
- Search functionality across markets
- Category filtering and sorting (newest, expiring soon, popular)
- Watchlist/favorites system with local storage
- Active Orders tab showing all orders across markets
- Bulk order cancellation
- Portfolio P&L tracking and value calculations

**Additional Enhancements**
- Logging system (PR #54)
- Automated backups (PR #54)
- Shareable links (PR #58)
- Test site banner (PR #65-66)
- Legacy market handling (PR #63-64)

**Phase 7: Trade History & Portfolio Enhancements** (PR #67)
- Trade history API with comprehensive tracking
- History tab in portfolio view
- Enhanced P&L tracking with detailed calculations
- Bulk order management and cancellation

**Phase 8: Charts & Analytics** (PR #68)
- Price charts with SVG visualization (1H, 24H, 7D, All time ranges)
- Order book depth visualization with bid/ask spread
- Market statistics dashboard (volume, trades, unique traders)

**Phase 9-10: Market Creation UX & Notifications** (PR #69)
- Market templates for quick creation (Binary, Election, Price Range, Sports, Crypto)
- Scheduled market creation with auto-open times
- Notification center with real-time alerts
- Market subscriptions and watchlist notifications

**Phases 11-16: Advanced Features** (PR #69)
- Advanced trading interface with limit/market orders
- Time-in-force options (GTC, IOC, FOK)
- Stop-loss and take-profit orders
- Mobile-responsive PWA layout with install prompt
- Bottom navigation for mobile users
- Leaderboard with volume, trades, win rate, and P&L rankings
- Enhanced resolution tools with evidence tracking
- Security improvements and webhook integrations

**Phase 17: XPRED Token Whitepaper** (PR #71)
- Comprehensive whitepaper page for XPRED token
- Footer link integration
- Responsive design for all devices

### 💡 Future Enhancements

- Liquidity incentives and market maker rewards
- Community governance and voting
- API documentation and developer tools
- Advanced analytics and reporting

## Cron Jobs & Maintenance

### Required Cron Jobs

Add these to your crontab (`crontab -e`):

```bash
# Backups
5 3 * * * ~/proton-prediction-market/scripts/backup_site.sh daily >> ~/logs/backup.log 2>&1
10 3 * * 0 ~/proton-prediction-market/scripts/backup_site.sh weekly >> ~/logs/backup.log 2>&1
15 3 1 * * ~/proton-prediction-market/scripts/backup_site.sh monthly >> ~/logs/backup.log 2>&1

# Price history snapshots (every 5 minutes for charts)
*/5 * * * * php ~/public_html/api/cron/snapshot_prices.php >> ~/logs/price_snapshot.log 2>&1

# Database cleanup (daily at 4 AM)
0 4 * * * php ~/public_html/api/cron/cleanup.php >> ~/logs/cleanup.log 2>&1
```

### Cron Scripts

Located in `frontend/public/api/cron/`:

- **snapshot_prices.php**: Fetches current prices from blockchain order books and stores snapshots for price chart visualization. Runs every 5 minutes.
- **cleanup.php**: Removes old notifications (30+ days), old price snapshots (7+ days), soft-deleted comments (90+ days), rotates log files, and vacuums SQLite databases.

### Automated Backups

- **Daily**: 3:05 AM (keeps 7)
- **Weekly**: 3:10 AM Sundays (keeps 4)
- **Monthly**: 3:15 AM 1st of month (keeps 3)

Backs up SQLite database, images, .env, API files, and metadata to `~/backups/proton-prediction-market/`

### Logging System

- **API Logs**: `~/logs/api.log`
- **Deployment Logs**: `~/logs/deploy.log`
- **Backup Logs**: `~/logs/backup.log`
- **Price Snapshot Logs**: `~/logs/price_snapshot.log`
- **Cleanup Logs**: `~/logs/cleanup.log`

## Security Considerations

- Non-custodial with full on-chain transparency
- Users maintain wallet control
- Admin authorization required for sensitive actions
- Comment moderation to prevent abuse
- Secure backup storage with owner-only permissions
- API logging for audit trail

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with clear commits
4. Test on testnet
5. Run linting: `cd frontend && npm run lint`
6. Submit pull request

## License

MIT License

## Support

Open issues on GitHub: https://github.com/phoenixwade/proton-prediction-market/issues

## Links

- **Live Platform**: https://pawnline.io
- **GitHub**: https://github.com/phoenixwade/proton-prediction-market
- **Proton Blockchain**: https://www.protonchain.com/
- **ProtonScan**: https://protonscan.io/
