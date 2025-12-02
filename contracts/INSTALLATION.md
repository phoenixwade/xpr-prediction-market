# Contract Installation Guide

This guide covers deploying the prediction market smart contracts:
- **xpredicting**: Prediction market + Multisig resolution (Phase 20)
- **xpredprofit**: Profit sharing (Phase 19)

## Token Configuration

**Current Token**: TESTIES (2 decimal precision) on `tokencreate` contract

This is a test token for development/testing purposes. The contracts accept TESTIES deposits and handle all balances/payouts in TESTIES instead of XUSDC.

## Prerequisites

- Proton CLI (`proton`) installed and configured
- Access to the `xpredicting` and `xpredprofit` account private keys
- Node.js v20.x for building the contracts

## Building the Contracts

From the `contracts` directory:

```bash
npm install

# Build prediction market contract (for xpredicting)
npm run build

# Build profit sharing contract (for xpredprofit)
npm run build:profitshare

# Or build both at once
npm run build:all
```

This generates:
- `assembly/target/prediction.contract.wasm` and `.abi` (for xpredicting)
- `assembly/target/profitshare.contract.wasm` and `.abi` (for xpredprofit)

## Deploying the Contracts

### Deploy Prediction Market Contract (xpredicting)

```bash
proton contract:set xpredicting assembly/target/prediction.contract
```

Or using cleos:

```bash
cleos -u https://proton.eosusa.io set contract xpredicting assembly/target prediction.contract.wasm prediction.contract.abi
```

### Deploy Profit Sharing Contract (xpredprofit)

```bash
proton contract:set xpredprofit assembly/target/profitshare.contract
```

Or using cleos:

```bash
cleos -u https://proton.eosusa.io set contract xpredprofit assembly/target profitshare.contract.wasm profitshare.contract.abi
```

## Contract Architecture

### xpredicting (Prediction Market + Multisig)

Tables:
| Table | Scope | Description |
|-------|-------|-------------|
| `markets` | `xpredicting` | All prediction markets |
| `balances` | `xpredicting` | User TESTIES balances |
| `resolvers` | `xpredicting` | Top 21 XPRED holders for market resolution |

Key Actions:
- `createmkt` - Create a new market (requires expiry at least 24 hours in future)
- `placeorder` - Place buy/sell orders
- `resolve` - Admin resolves a market (backwards compatible)
- `resolvemkt` - Multisig resolution (5-of-21 threshold)
- `updateres` - Update resolver list

### xpredprofit (Profit Sharing)

Tables:
| Table | Scope | Description |
|-------|-------|-------------|
| `unclaimed` | `xpredprofit` | Tracks unclaimed profit balances per user |
| `profitrounds` | `xpredprofit` | Audit trail of profit distribution rounds |

Key Actions:
- `distribute` - Admin records off-chain computed profit shares
- `claimprofit` - Users withdraw their accumulated profits

## Profit Sharing Actions (xpredprofit)

**distribute** - Admin action to record off-chain computed profit shares

```bash
proton action:push xpredprofit distribute '{
  "admin": "adminaccount",
  "users": ["user1", "user2", "user3"],
  "amounts": [100000, 200000, 150000],
  "round_id": 1
}' -p adminaccount@active
```

Parameters:
- `admin`: Account calling the action (must have authorization)
- `users`: Array of account names to receive profit shares
- `amounts`: Array of amounts in TESTIES (2 decimal precision, so 100 = 1.00 TESTIES)
- `round_id`: Unique identifier for this distribution round

**Important**: Before calling `distribute`, ensure TESTIES funds are deposited to the `xpredprofit` account to cover the total distribution amount.

**claimprofit** - User action to withdraw accumulated profits

```bash
proton action:push xpredprofit claimprofit '{
  "user": "username"
}' -p username@active
```

This transfers the user's unclaimed TESTIES balance from the `xpredprofit` contract to their account.

## Multisig Resolution Actions (xpredicting)

**updateres** - Admin action to update the resolver list (top 21 XPRED holders)

```bash
proton action:push xpredicting updateres '{
  "admin": "adminaccount",
  "resolvers": ["holder1", "holder2", "holder3"],
  "balances": [1000000, 500000, 250000]
}' -p adminaccount@active
```

Parameters:
- `admin`: Account calling the action
- `resolvers`: Array of account names (max 21)
- `balances`: Array of XPRED balances (for display/reference)

**resolvemkt** - Multisig-compatible market resolution

This action requires `xpredicting@resolvers` authorization (5-of-21 threshold). It must be called via `eosio.msig` proposal workflow.

```bash
# Create proposal
proton multisig:propose proposername proposalname '[
  {"actor": "xpredicting", "permission": "resolvers"}
]' '[{
  "account": "xpredicting",
  "name": "resolvemkt",
  "authorization": [{"actor": "xpredicting", "permission": "resolvers"}],
  "data": {"market_id": 1, "winning_outcome_id": 0}
}]'

# Resolvers approve (need 5 of 21)
proton multisig:approve proposername proposalname resolver1@active -p resolver1@active
proton multisig:approve proposername proposalname resolver2@active -p resolver2@active
# ... repeat for 5 resolvers

# Execute after threshold reached
proton multisig:exec proposername proposalname resolver1@active -p resolver1@active
```

## Setting Up Multisig Permissions

After deploying the contract, configure the 5-of-21 multisig permission:

### 1. Create the resolvers permission

```bash
proton permission:set xpredicting resolvers '{
  "threshold": 5,
  "keys": [],
  "accounts": [
    {"permission": {"actor": "resolver1", "permission": "active"}, "weight": 1},
    {"permission": {"actor": "resolver2", "permission": "active"}, "weight": 1},
    {"permission": {"actor": "resolver3", "permission": "active"}, "weight": 1},
    {"permission": {"actor": "resolver4", "permission": "active"}, "weight": 1},
    {"permission": {"actor": "resolver5", "permission": "active"}, "weight": 1},
    {"permission": {"actor": "resolver6", "permission": "active"}, "weight": 1},
    {"permission": {"actor": "resolver7", "permission": "active"}, "weight": 1},
    {"permission": {"actor": "resolver8", "permission": "active"}, "weight": 1},
    {"permission": {"actor": "resolver9", "permission": "active"}, "weight": 1},
    {"permission": {"actor": "resolver10", "permission": "active"}, "weight": 1},
    {"permission": {"actor": "resolver11", "permission": "active"}, "weight": 1},
    {"permission": {"actor": "resolver12", "permission": "active"}, "weight": 1},
    {"permission": {"actor": "resolver13", "permission": "active"}, "weight": 1},
    {"permission": {"actor": "resolver14", "permission": "active"}, "weight": 1},
    {"permission": {"actor": "resolver15", "permission": "active"}, "weight": 1},
    {"permission": {"actor": "resolver16", "permission": "active"}, "weight": 1},
    {"permission": {"actor": "resolver17", "permission": "active"}, "weight": 1},
    {"permission": {"actor": "resolver18", "permission": "active"}, "weight": 1},
    {"permission": {"actor": "resolver19", "permission": "active"}, "weight": 1},
    {"permission": {"actor": "resolver20", "permission": "active"}, "weight": 1},
    {"permission": {"actor": "resolver21", "permission": "active"}, "weight": 1}
  ],
  "waits": []
}' active
```

### 2. Link the resolvemkt action to resolvers permission

```bash
proton permission:link xpredicting resolvemkt resolvers
```

Or using cleos:

```bash
cleos -u https://proton.eosusa.io set action permission xpredicting xpredicting resolvemkt resolvers
```

## Cron Jobs

### Weekly Profit Distribution

Create a cron job that:
1. Queries all XPRED holders from `tokencreate` contract
2. Calculates pro-rata shares based on balances
3. Calls `distribute` action with computed shares

Example cron schedule (every Sunday at midnight):
```
0 0 * * 0 /path/to/profit_distribution_script.sh
```

### Weekly Resolver Update

Create a cron job that:
1. Queries top 21 XPRED holders by balance
2. Calls `updateres` action with the new list
3. Updates `xpredicting@resolvers` permission with new accounts

Example cron schedule (every Sunday at 1 AM):
```
0 1 * * 0 /path/to/update_resolvers_script.sh
```

## Market Creation Validation

The `createmkt` action now enforces that market expiry must be at least 24 hours in the future. This prevents users from creating markets with past or near-future expiry dates.

Error message: "Market expiry must be at least 24 hours in the future"

## Verification

After deployment, verify the tables exist:

```bash
# xpredicting tables
proton table:get xpredicting xpredicting resolvers

# xpredprofit tables
proton table:get xpredprofit xpredprofit unclaimed
proton table:get xpredprofit xpredprofit profitrounds
```

## Frontend Configuration

The frontend uses environment variables to configure contract accounts:

```env
REACT_APP_CONTRACT_NAME=xpredicting
REACT_APP_PROFIT_SHARE_CONTRACT=xpredprofit
```

If not set, defaults are:
- Prediction market: `xpredicting`
- Profit sharing: `xpredprofit`

## Backwards Compatibility

The existing `resolve` action on `xpredicting` is preserved for backwards compatibility. It can be used as an admin escape hatch if the multisig process fails or is unavailable.

```bash
proton action:push xpredicting resolve '{
  "admin": "adminaccount",
  "market_id": 1,
  "winning_outcome_id": 0
}' -p adminaccount@active
```

## Troubleshooting

**"No unclaimed profit for this account"**
- The user has no profit shares recorded. Check if `distribute` was called on `xpredprofit` with their account.

**"Market not found"**
- The market_id doesn't exist. Verify the market exists in the `markets` table on `xpredicting`.

**"Market already resolved"**
- The market has already been resolved. Check the `resolved` field in the market record.

**"Market expiry must be at least 24 hours in the future"**
- The expiry timestamp provided is less than 24 hours from now. Provide a valid future timestamp.

**Multisig proposal not executing**
- Ensure at least 5 resolvers have approved the proposal
- Verify the `resolvers` permission is correctly configured with threshold 5
- Check that `resolvemkt` action is linked to `resolvers` permission

**Profit claim fails with insufficient balance**
- Ensure TESTIES funds are deposited to `xpredprofit` before calling `distribute`
- The contract needs sufficient TESTIES balance to pay out claims
