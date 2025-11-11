# Proton Prediction Market Platform

A decentralized prediction market platform built on the Proton (XPR) blockchain, featuring binary Yes/No markets with an on-chain order book trading engine.

## Overview

This platform combines the best features of Polymarket, Kalshi, and PredictIt to create a transparent, low-fee prediction market on the Proton blockchain. Users can create markets, trade on outcomes, and claim winnings - all with full on-chain transparency and non-custodial wallet integration.

## Features

### Smart Contract Features
- **Binary Markets**: Yes/No prediction markets on any topic
- **Central Limit Order Book (CLOB)**: On-chain order matching engine
- **Non-Custodial**: Users maintain full control of funds via Proton WebAuth
- **Minimal Fees**: 0.01% taker fee, 0% maker fee
- **Automated Settlement**: Smart contract handles market resolution and payouts
- **Collateral Management**: Automatic handling of short selling collateral (1 XPR per share)

### Frontend Features
- **Wallet Integration**: Seamless Proton WebAuth connection
- **Markets List**: Browse and filter markets by category and status
- **Order Book Display**: Real-time bid/ask order book visualization
- **Trading Interface**: Place buy/sell orders with limit pricing
- **Portfolio Management**: View positions, balances, and claim winnings
- **Admin Panel**: Create and resolve markets
- **Real-time Updates**: Automatic polling every 5 seconds
- **Mobile Responsive**: Optimized for all screen sizes

## Technology Stack

- **Blockchain**: Proton (XPR Network) - EOSIO-based with WASM smart contracts
- **Smart Contracts**: TypeScript/AssemblyScript using proton-tsc SDK
- **Frontend**: React with TypeScript
- **Wallet**: Proton WebAuth (@proton/web-sdk)
- **Blockchain Interaction**: @proton/js for RPC queries

## Project Structure

```
proton-prediction-market/
├── contracts/                 # Smart contract code
│   ├── assembly/
│   │   ├── tables/           # Data table definitions
│   │   │   ├── market.table.ts
│   │   │   ├── order.table.ts
│   │   │   ├── position.table.ts
│   │   │   ├── balance.table.ts
│   │   │   └── index.ts
│   │   ├── target/           # Compiled WASM output
│   │   │   ├── prediction.contract.wasm
│   │   │   └── prediction.contract.abi
│   │   └── prediction.contract.ts  # Main contract
│   ├── package.json
│   ├── tsconfig.json
│   └── asconfig.json
└── frontend/                  # React frontend
    ├── src/
    │   ├── components/
    │   │   ├── MarketsList.tsx
    │   │   ├── MarketDetail.tsx
    │   │   ├── Portfolio.tsx
    │   │   └── AdminPanel.tsx
    │   ├── App.tsx
    │   └── App.css
    ├── package.json
    └── .env
```

## Smart Contract Architecture

### Data Tables

1. **Markets Table** (`markets`)
   - Stores market questions, categories, expiry times, and resolution status
   - Scoped by contract account

2. **Orders Table** (`orders`)
   - Central limit order book with bids/asks
   - Scoped by market ID for efficient querying

3. **Positions Table** (`positions`)
   - Tracks user holdings of Yes/No shares per market
   - Scoped by user account

4. **Balances Table** (`balances`)
   - Internal ledger for deposited XPR funds
   - Scoped by contract account

### Contract Actions

1. **transfer (notify)** - Deposit XPR tokens into the contract
2. **withdraw** - Withdraw XPR tokens from internal balance
3. **createmkt** - Create a new prediction market (admin only)
4. **placeorder** - Place a buy/sell order for Yes/No shares
5. **cancelorder** - Cancel an open order and refund collateral
6. **resolve** - Resolve a market with Yes/No outcome (admin only)
7. **claim** - Claim winnings from resolved markets
8. **collectfees** - Collect accumulated platform fees (admin only)

### Trading Mechanics

- **Order Matching**: Automatic on-chain matching of compatible bids and asks
- **Collateral System**: 
  - Buyers lock `price × quantity` in XPR
  - Sellers either provide shares or lock 1 XPR per share for short positions
- **Share Creation**: Yes/No shares created on-demand when trades execute
- **Fee Structure**: 0.01% charged to taker, maker receives full amount minus fee
- **Price Discovery**: Market-driven through order book (0-1 XPR per share)

## Installation

For detailed installation, deployment, and configuration instructions, see **[INSTALLATION.md](INSTALLATION.md)**.

The installation guide covers:
- Prerequisites and system requirements (Node.js 22, AlmaLinux packages)
- Smart contract setup and deployment
- Frontend setup and configuration
- **cPanel deployment** (step-by-step with .htaccess configuration)
- Other hosting providers (Vercel, Netlify, GitHub Pages)
- User testing guide (for traders and admins)
- Troubleshooting common issues

### Quick Start

```bash
# Install Node.js 22
nvm install 22 && nvm use 22

# Smart contract
cd contracts && npm install && npm run build

# Frontend - copy example.env and configure
cd ../frontend
cp example.env .env
# Edit .env with your contract account name
npm install && npm start
```

**Environment Configuration:**
- Copy `frontend/example.env` to `frontend/.env`
- Update `REACT_APP_CONTRACT_NAME` with your deployed contract account
- See [INSTALLATION.md](INSTALLATION.md) for detailed configuration options

## Deployment

For production deployment (including cPanel), see [INSTALLATION.md](INSTALLATION.md).

### Automated Deployment Scripts

This project includes automated deployment scripts for cPanel hosting:

**Method 1: Build on Server**
```bash
# Upload project to /home/pawnline/proton-prediction-market/
# Then run:
./deploy-to-cpanel.sh
```

**Method 2: Build Locally**
```bash
# Build locally and create deployment package:
./local-build.sh

# Upload deploy-package/ contents to /home/pawnline/public_html/
```

📖 **See [DEPLOYMENT.md](DEPLOYMENT.md) for additional deployment automation details**, including:
- Automated deployment script usage
- .htaccess configuration for React Router
- Deployment troubleshooting tips

## Usage Guide

### For Traders

1. **Connect Wallet**: Click "Connect Wallet" and authenticate with Proton WebAuth
2. **Deposit Funds**: Transfer XPR to the contract to fund your trading account
3. **Browse Markets**: View available markets and filter by category
4. **Place Orders**: Select a market, choose Yes/No, set price and quantity
5. **Manage Portfolio**: View your positions and available balance
6. **Claim Winnings**: After market resolution, claim payouts for winning shares
7. **Withdraw**: Withdraw XPR from your internal balance back to your wallet

### For Admins

1. **Create Markets**: Use the Admin panel to create new prediction markets
   - Enter question, category, and expiration date
   - Markets become active immediately

2. **Resolve Markets**: After expiry, resolve markets with the correct outcome
   - Select market ID and choose Yes/No outcome
   - Users can then claim winnings

3. **Collect Fees**: Withdraw accumulated platform fees to admin account

## Fee Structure

- **Maker Fee**: 0% (no fee for providing liquidity)
- **Taker Fee**: 0.01% (fee charged when taking liquidity)
- **Withdrawal Fee**: None
- **Market Creation**: Free (admin only)

## Security Considerations

- All funds are held in the smart contract with full transparency
- Users maintain control via their Proton wallet
- No custodial risk - withdraw anytime
- Smart contract handles all collateral and settlement automatically
- Admin actions (create/resolve) require proper authorization

## Future Enhancements

- Trade history and price charts
- Community governance for market creation
- Multi-outcome markets (beyond binary)
- Advanced order types (stop-loss, take-profit)
- Liquidity incentives and market maker rewards
- Mobile app with native wallet integration

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes with clear commit messages
4. Test thoroughly on testnet
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

## Acknowledgments

- Built on the Proton blockchain
- Inspired by Polymarket, Kalshi, and PredictIt
- Uses Proton WebAuth for seamless wallet integration
