# Contract Installation Guide

This guide covers deploying the updated `xpredicting` smart contract with Phase 19 (Profit Sharing) and Phase 20 (Multisig Resolution) features.

## Prerequisites

- Proton CLI (`proton`) installed and configured
- Access to the `xpredicting` account private key
- Node.js v20.x for building the contract

## Building the Contract

From the `contracts` directory:

```bash
npm install
npm run build
```

This generates:
- `assembly/target/prediction.contract.wasm`
- `assembly/target/prediction.contract.abi`

## Deploying the Contract

Deploy the updated contract to the `xpredicting` account:

```bash
proton contract:set xpredicting assembly/target/prediction.contract
```

Or using cleos:

```bash
cleos -u https://proton.eosusa.io set contract xpredicting assembly/target prediction.contract.wasm prediction.contract.abi
```

## New Tables

After deployment, the following new tables will be available:

| Table | Scope | Description |
|-------|-------|-------------|
| `unclaimed` | `xpredicting` | Tracks unclaimed profit balances per user |
| `profitrounds` | `xpredicting` | Audit trail of profit distribution rounds |
| `resolvers` | `xpredicting` | Top 21 XPRED holders for market resolution |

## New Actions

### Phase 19 - Profit Sharing

**distribute** - Admin action to record off-chain computed profit shares

```bash
proton action:push xpredicting distribute '{
  "admin": "adminaccount",
  "users": ["user1", "user2", "user3"],
  "amounts": [100000, 200000, 150000],
  "round_id": 1
}' -p adminaccount@active
```

Parameters:
- `admin`: Account calling the action (must have authorization)
- `users`: Array of account names to receive profit shares
- `amounts`: Array of amounts in XUSDC (6 decimal precision, so 100000 = 0.100000 XUSDC)
- `round_id`: Unique identifier for this distribution round

**claimprofit** - User action to withdraw accumulated profits

```bash
proton action:push xpredicting claimprofit '{
  "user": "username"
}' -p username@active
```

This transfers the user's unclaimed XUSDC balance from the contract to their account.

### Phase 20 - Multisig Resolution

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

## Verification

After deployment, verify the new tables exist:

```bash
# Check unclaimed table
proton table:get xpredicting xpredicting unclaimed

# Check profitrounds table
proton table:get xpredicting xpredicting profitrounds

# Check resolvers table
proton table:get xpredicting xpredicting resolvers
```

## Backwards Compatibility

The existing `resolve` action is preserved for backwards compatibility. It can be used as an admin escape hatch if the multisig process fails or is unavailable.

```bash
proton action:push xpredicting resolve '{
  "admin": "adminaccount",
  "market_id": 1,
  "winning_outcome_id": 0
}' -p adminaccount@active
```

## Troubleshooting

**"No unclaimed profit for this account"**
- The user has no profit shares recorded. Check if `distribute` was called with their account.

**"Market not found"**
- The market_id doesn't exist. Verify the market exists in the `markets` table.

**"Market already resolved"**
- The market has already been resolved. Check the `resolved` field in the market record.

**Multisig proposal not executing**
- Ensure at least 5 resolvers have approved the proposal
- Verify the `resolvers` permission is correctly configured with threshold 5
- Check that `resolvemkt` action is linked to `resolvers` permission
