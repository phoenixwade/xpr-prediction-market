# Implementation Plan: Major Platform Features

## Overview
This document outlines the implementation plan for 6 major features that will transform the Proton Prediction Market platform into a comprehensive prediction market similar to Polymarket.

## Current Architecture

### Smart Contract (AssemblyScript on Proton)
- **Tables:**
  - `markets`: Market definitions (id, question, category, expire, resolved, outcome, image_url)
  - `orders`: Order book entries (order_id, account, isBid, price, quantity) - scoped by market_id
  - `positions`: User positions (market_id, yes_shares, no_shares) - scoped by account
  - `balances`: Internal balance ledger (account, funds)
  - `config`: Global config (id, nextMarketId, nextOrderId)

- **Key Actions:**
  - `createmkt`: Admin creates market
  - `placeorder`: Place buy/sell order
  - `cancelorder`: Cancel order
  - `resolve`: Admin resolves market
  - `claim`: User claims winnings
  - `withdraw`: Withdraw funds to wallet

- **Current Limitations:**
  - Binary markets only (Yes/No)
  - No approval workflow (admin creates directly)
  - No separate resolution account
  - No on-chain activity tracking
  - No comments system
  - Positions table scoped by account (doesn't scale for multi-outcome)

### Frontend (React + WebAuth)
- Market list with filters (All/Active/Resolved)
- Market detail with order book
- Portfolio view
- Admin panel (create market, resolve market)
- Image upload feature

## Features to Implement

### 1. Default to Active Markets Tab ✓ (Quick Win)
**Complexity:** Low  
**Dependencies:** None  
**Implementation:** Change default filter state from 'all' to 'active' in MarketsList.tsx

### 2. Market Approval Workflow
**Complexity:** Medium  
**Dependencies:** Settings singleton  
**Description:** Users propose markets, admins approve before going live

### 3. Market Details Page - Comments, Holders, Activity Tabs
**Complexity:** Medium-High  
**Dependencies:** Off-chain API infrastructure  
**Description:** Add Polymarket-style tabs showing market activity, holder positions, and comments

### 4. Multi-Outcome Markets
**Complexity:** High  
**Dependencies:** Major contract refactor  
**Description:** Support 30+ outcome options (e.g., Super Bowl winner) with different odds

### 5. Separate Resolution Account
**Complexity:** Low  
**Dependencies:** Settings singleton  
**Description:** Different account for resolving markets (not the admin/funds account)

### 6. Notification System
**Complexity:** Medium  
**Dependencies:** Off-chain cron infrastructure  
**Description:** Alert admins for market approvals and resolutions

---

## Implementation Phases

### Phase 0: Scaffolding and Quick Wins (PR #31)
**Estimated Time:** 2-3 hours  
**Goal:** Set up infrastructure and implement easy wins

#### Contract Changes:
1. **Settings Singleton Table**
   ```typescript
   @table("settings")
   export class SettingsTable extends Table {
     constructor(
       public id: u64 = 0,
       public admin_account: Name = EMPTY_NAME,
       public resolution_account: Name = EMPTY_NAME,
       public approval_required: boolean = false,
       public created_at: TimePointSec = new TimePointSec(0),
       public updated_at: TimePointSec = new TimePointSec(0)
     ) {}
   }
   ```

2. **New Action: `setsettings`**
   - Requires auth from current admin
   - Updates settings singleton
   - Validates accounts exist

#### Frontend Changes:
1. **Default to Active Tab**
   - Change `useState('all')` to `useState('active')` in MarketsList.tsx
   - Ensure deep linking still works

2. **Admin Settings View (Read-Only)**
   - Display current admin_account, resolution_account, approval_required
   - Note: Changing settings done via CLI initially

#### Deliverables:
- Settings table in contract
- `setsettings` action
- Default to Active tab
- Admin settings display

---

### Phase 1: Market Approval Workflow + Basic Notifications (PR #32)
**Estimated Time:** 6-8 hours  
**Goal:** Users can propose markets, admins approve them

#### Contract Changes:
1. **Proposals Table**
   ```typescript
   @table("proposals")
   export class ProposalTable extends Table {
     constructor(
       public id: u64 = 0,
       public proposer: Name = EMPTY_NAME,
       public question: string = "",
       public category: string = "",
       public expire: TimePointSec = new TimePointSec(0),
       public image_url: string = "",
       public status: u8 = 0, // 0=pending, 1=approved, 2=rejected, 3=canceled
       public created_at: TimePointSec = new TimePointSec(0),
       public updated_at: TimePointSec = new TimePointSec(0),
       public approved_by: Name = EMPTY_NAME,
       public live_market_id: u64 = 0
     ) {}
   }
   ```

2. **New Actions:**
   - `propose(proposer, question, category, expireTime, image_url)` - Any user can propose
   - `approve(admin, proposal_id)` - Admin approves and creates market atomically
   - `reject(admin, proposal_id, reason)` - Admin rejects proposal
   - `cancel(proposer, proposal_id)` - Proposer cancels their proposal

3. **Update `createmkt`:**
   - Keep as admin-only for direct creation
   - Used internally by `approve` action

#### Frontend Changes:
1. **Propose Market Form**
   - Non-admins see "Propose Market" instead of "Create Market"
   - Admins can still create directly OR propose

2. **Admin Approvals Tab**
   - New tab in AdminPanel
   - List pending proposals
   - Approve/Reject buttons with confirmation
   - Show proposer, question, category, expiry

3. **Proposal Status View**
   - Users can see their proposal status
   - Show pending/approved/rejected state

#### Off-Chain Infrastructure:
1. **Notification Cron Script** (`/public_html/cron/notify.php`)
   - Runs every 5 minutes via cPanel cron
   - Queries proposals table for new pending items
   - Queries markets table for expired unresolved markets
   - Sends email to admin(s)
   - Stores last-processed IDs in `/cron/state.json`

2. **Email Configuration**
   - Use PHP `mail()` or SMTP
   - Admin email stored in cron config

#### Deliverables:
- Proposals table and actions
- Propose/Approve/Reject UI
- Notification cron script
- Email alerts for admins

---

### Phase 2: Market Details Tabs - Holders, Activity, Comments (PR #33)
**Estimated Time:** 8-10 hours  
**Goal:** Rich market detail page with Polymarket-style tabs

#### Frontend Changes:
1. **Tab Navigation Component**
   - Add tabs to MarketDetail: Overview, Holders, Activity, Comments
   - Mobile-responsive tab design
   - Deep linking support (?market=123&tab=comments)

2. **Holders Tab**
   - Query positions table (on-chain)
   - Display table: Account | Yes Shares | No Shares | Total Value
   - Pagination (20 per page)
   - Sort by total value

3. **Activity Tab**
   - Query activity API (off-chain aggregator)
   - Display timeline: Order Placed, Order Canceled, Trade Executed, Market Resolved
   - Show: Time, Account, Action, Details
   - Pagination and infinite scroll

4. **Comments Tab**
   - Query comments API (off-chain)
   - Display threaded comments
   - Add comment form (requires wallet connection)
   - Upvote/downvote (future)
   - Report/moderate (admin only)

#### Off-Chain API Endpoints:
1. **Activity Aggregator** (`/api/activity.php`)
   ```php
   GET /api/activity.php?market_id=123&limit=20&offset=0
   
   Response:
   {
     "events": [
       {
         "id": 1,
         "market_id": 123,
         "account": "alice",
         "action": "placeorder",
         "details": {"outcome": "yes", "price": "0.71", "quantity": 10},
         "timestamp": 1700000000
       }
     ],
     "total": 150,
     "has_more": true
   }
   ```
   
   - Queries Proton RPC for action traces
   - Caches results in SQLite/MySQL
   - Filters by market_id
   - Returns normalized events

2. **Comments API** (`/api/comments.php`)
   ```php
   GET /api/comments.php?market_id=123&limit=20&offset=0
   POST /api/comments.php
   DELETE /api/comments.php?id=456
   
   Database Schema:
   CREATE TABLE comments (
     id INTEGER PRIMARY KEY,
     market_id INTEGER NOT NULL,
     account VARCHAR(13) NOT NULL,
     text TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     updated_at INTEGER,
     deleted BOOLEAN DEFAULT 0,
     parent_id INTEGER,
     INDEX(market_id, deleted, created_at)
   );
   ```
   
   - POST requires signature verification (WebAuth)
   - Rate limiting: 10 comments per hour per account
   - Text sanitization (strip HTML, max 1000 chars)
   - Soft delete for moderation

3. **Database Setup**
   - SQLite database at `/api/data/prediction.db`
   - Tables: comments, activity_cache, rate_limits
   - Automatic schema migration

#### Security Considerations:
- CORS headers for API endpoints
- Input sanitization (SQL injection, XSS)
- Rate limiting per IP and account
- Signature verification for POST requests
- Admin-only delete endpoints

#### Deliverables:
- Tab navigation UI
- Holders tab (on-chain data)
- Activity aggregator API + UI
- Comments API + UI
- SQLite database setup

---

### Phase 3: Multi-Outcome Markets (PR #34 + #35)
**Estimated Time:** 12-16 hours  
**Goal:** Support markets with 30+ outcomes (e.g., Super Bowl winner)

**⚠️ WARNING:** This is the most complex change. Requires careful planning and testing.

#### Contract Changes:

1. **Outcomes Table**
   ```typescript
   @table("outcomes")
   export class OutcomeTable extends Table {
     constructor(
       public outcome_id: u8 = 0,
       public name: string = "",
       public created_at: TimePointSec = new TimePointSec(0)
     ) {}
     
     @primary()
     get by_id(): u64 {
       return this.outcome_id;
     }
   }
   ```
   - Scoped by market_id
   - Max 255 outcomes per market (u8 limit)

2. **Update Markets Table**
   ```typescript
   @table("markets")
   export class MarketTable extends Table {
     constructor(
       public id: u64 = 0,
       public question: string = "",
       public category: string = "",
       public expire: TimePointSec = new TimePointSec(0),
       public resolved: boolean = false,
       public outcome: u8 = 255, // 255 = unresolved, 0-254 = winning outcome_id
       public image_url: string = "",
       public outcomes_count: u8 = 2, // Binary markets = 2, multi-outcome = N
       public resolved_at: TimePointSec = new TimePointSec(0)
     ) {}
   }
   ```

3. **Update Orders Table**
   ```typescript
   @table("orders")
   export class OrderTable extends Table {
     constructor(
       public order_id: u64 = 0,
       public account: Name = EMPTY_NAME,
       public outcome_id: u8 = 0, // NEW: which outcome this order is for
       public isBid: boolean = true,
       public price: u64 = 0,
       public quantity: u32 = 0
     ) {}
   }
   ```

4. **NEW: Positions V2 Table**
   ```typescript
   @table("positionsv2")
   export class PositionV2Table extends Table {
     constructor(
       public composite_key: u64 = 0, // (account.value << 8) | outcome_id
       public account: Name = EMPTY_NAME,
       public outcome_id: u8 = 0,
       public shares: i64 = 0,
       public updated_at: TimePointSec = new TimePointSec(0)
     ) {}
     
     @primary()
     get by_key(): u64 {
       return this.composite_key;
     }
   }
   ```
   - Scoped by market_id
   - Allows efficient queries per outcome
   - Supports negative shares (short positions)

5. **Update Actions:**
   - `createmkt`: Accept outcomes array or count
   - `setoutcome`: Add/edit outcome names for a market
   - `placeorder`: Require outcome_id parameter
   - `cancelorder`: Use outcome_id for position updates
   - `resolve`: Set resolved_outcome (0-254) and resolved_at
   - `claim`: Pay out only winning outcome holders

6. **Migration Strategy:**
   - Keep old `positions` table for backward compatibility
   - Binary markets (outcomes_count=2) use outcome_id 0=Yes, 1=No
   - New multi-outcome markets use positionsv2
   - Frontend detects outcomes_count to render appropriately

#### Frontend Changes:

1. **Create Market - Multi-Outcome**
   - Toggle: Binary vs Multi-Outcome
   - For multi-outcome: Add outcome list UI
   - Add/remove outcomes (up to 30)
   - Validate: min 2, max 30 outcomes

2. **Market Detail - Multi-Outcome Display**
   - Show all outcomes with current odds
   - Separate order book per outcome
   - Tabbed or accordion UI for outcomes
   - Mobile-friendly design

3. **Place Order - Outcome Selection**
   - Dropdown or button group to select outcome
   - Show current price for selected outcome
   - Buy/Sell for that specific outcome

4. **Holders Tab - Multi-Outcome**
   - Show holdings per outcome
   - Table: Account | Outcome 1 | Outcome 2 | ... | Total Value
   - Highlight winning outcome after resolution

5. **Portfolio - Multi-Outcome**
   - Group positions by market
   - Show breakdown by outcome
   - Calculate total value per market

#### Testing Requirements:
- Create binary market (backward compatibility)
- Create 3-outcome market (e.g., Win/Lose/Draw)
- Create 30-outcome market (e.g., Super Bowl)
- Place orders on different outcomes
- Cancel orders
- Resolve market with specific outcome
- Claim winnings
- Verify positions table queries

#### Deliverables:
- Outcomes table and actions
- Updated orders and positions tables
- Multi-outcome market creation UI
- Outcome selection in trading
- Multi-outcome display in all views
- Migration guide

---

### Phase 4: Separate Resolution Account (PR #36)
**Estimated Time:** 2-3 hours  
**Goal:** Use dedicated account for resolving markets

#### Contract Changes:
1. **Update `resolve` Action**
   ```typescript
   @action("resolve")
   resolveMarket(resolver: Name, market_id: u64, outcome: u8): void {
     const settings = this.getSettings();
     requireAuth(settings.resolution_account);
     // ... rest of resolution logic
   }
   ```

2. **Helper Method**
   ```typescript
   private getSettings(): SettingsTable {
     let settings = this.settingsTable.get(0);
     check(settings != null, "Settings not initialized");
     return settings!;
   }
   ```

#### Frontend Changes:
1. **Admin Settings Display**
   - Show resolution_account prominently
   - Warning if resolution_account == admin_account
   - Instructions for setting up separate account

2. **Resolution UI**
   - Check if user is resolution account
   - Show appropriate error if not authorized

#### CLI Setup:
```bash
# Set resolution account (run as admin)
proton action xpredicting setsettings \
  '{"admin_account":"adminacct","resolution_account":"resolver","approval_required":false}' \
  -p adminacct@active
```

#### Deliverables:
- Resolution account enforcement
- Settings display in UI
- CLI setup documentation

---

### Phase 5: Notifications V2 and Polish (PR #37)
**Estimated Time:** 4-6 hours  
**Goal:** Comprehensive notification system and performance improvements

#### Notification Enhancements:
1. **Expanded Cron Worker**
   - New pending proposals → Email admin
   - Market expiring in 24h → Email admin
   - Market expired (needs resolution) → Email admin + resolution account
   - Market resolved → Email proposer (if applicable)
   - Proposal approved/rejected → Email proposer

2. **In-App Notifications**
   - Admin panel: Badge showing pending actions count
   - Notification banner for pending approvals
   - Notification banner for markets needing resolution

3. **Notification Preferences** (Future)
   - Admin can configure which notifications to receive
   - Email vs in-app vs both

#### Performance Improvements:
1. **Pagination**
   - Markets list: Load 20 at a time
   - Order book: Limit to top 50 bids/asks
   - Holders: 20 per page
   - Activity: 20 per page with infinite scroll
   - Comments: 20 per page

2. **Caching**
   - Activity API: Cache for 30 seconds
   - Holders: Cache for 1 minute
   - Market list: Cache for 5 seconds

3. **Indexing**
   - Add indexes to comments table
   - Add indexes to activity_cache table

#### Security Hardening:
1. **API Security**
   - Rate limiting: 100 requests per minute per IP
   - CSRF tokens for POST requests
   - Signature verification for all mutations
   - Input validation and sanitization

2. **Comment Moderation**
   - Admin can delete comments
   - Soft delete (preserve for audit)
   - Report button (future)
   - Spam detection (future)

#### Deliverables:
- Enhanced notification system
- In-app notification UI
- Pagination throughout
- API caching
- Security hardening
- Performance testing

---

## Technical Decisions

### On-Chain vs Off-Chain

| Feature | Storage | Rationale |
|---------|---------|-----------|
| Markets | On-chain | Core data, needs to be trustless |
| Orders | On-chain | Trading logic requires on-chain |
| Positions | On-chain | Ownership must be on-chain |
| Proposals | On-chain | Approval workflow is governance |
| Comments | Off-chain | Too expensive, needs moderation |
| Activity | Off-chain | Aggregated from on-chain traces |
| Notifications | Off-chain | Delivery mechanism, not state |

### Database Choice: SQLite
- **Pros:** Simple, no separate server, file-based, good for read-heavy
- **Cons:** Limited concurrency, not ideal for high write volume
- **Mitigation:** Use WAL mode, connection pooling, caching
- **Alternative:** MySQL if volume grows

### Multi-Outcome Architecture
- **Option A:** Unified table (chosen)
  - Single positions table with outcome_id
  - Simpler queries, easier to extend
  - Composite key for efficient lookups
  
- **Option B:** Separate tables per market type
  - Binary markets use old positions table
  - Multi-outcome use new table
  - More complex, harder to maintain

### Backward Compatibility
- Binary markets represented as 2-outcome markets
- outcome_id 0 = Yes, outcome_id 1 = No
- Old positions table deprecated but still readable
- Gradual migration, no breaking changes

---

## Deployment Strategy

### Phase 0-1 (Settings + Approval)
1. Deploy updated contract
2. Run `setsettings` via CLI
3. Deploy frontend
4. Set up cron job on cPanel
5. Test proposal workflow

### Phase 2 (Tabs)
1. Create SQLite database
2. Deploy API endpoints
3. Deploy frontend
4. Test all tabs

### Phase 3 (Multi-Outcome)
1. **CRITICAL:** Deploy contract with new tables
2. Test extensively on testnet first
3. Create test markets (binary, 3-outcome, 30-outcome)
4. Verify all trading flows
5. Deploy frontend
6. Monitor for issues

### Phase 4-5 (Resolution + Polish)
1. Update settings with resolution account
2. Deploy frontend updates
3. Enhance cron worker
4. Performance testing

---

## Risk Mitigation

### High-Risk Items:
1. **Multi-outcome contract changes**
   - Risk: Breaking existing markets
   - Mitigation: Extensive testing, backward compatibility, testnet deployment

2. **Position table migration**
   - Risk: Data loss or corruption
   - Mitigation: Keep old table, gradual migration, validation queries

3. **Order matching with outcomes**
   - Risk: Incorrect trades, fund loss
   - Mitigation: Unit tests, integration tests, small test trades

### Medium-Risk Items:
1. **Off-chain API security**
   - Risk: Spam, abuse, data breach
   - Mitigation: Rate limiting, input validation, signature verification

2. **Notification reliability**
   - Risk: Missed notifications, spam
   - Mitigation: Idempotency, state tracking, email throttling

### Low-Risk Items:
1. **UI changes**
   - Risk: Bugs, poor UX
   - Mitigation: Incremental rollout, user feedback

---

## Success Criteria

### Phase 0:
- [ ] Settings table deployed
- [ ] Default to Active tab works
- [ ] Admin can view settings

### Phase 1:
- [ ] Users can propose markets
- [ ] Admins can approve/reject proposals
- [ ] Email notifications work
- [ ] Approved proposals become live markets

### Phase 2:
- [ ] Holders tab shows all positions
- [ ] Activity tab shows market events
- [ ] Comments can be posted and viewed
- [ ] All tabs are mobile-responsive

### Phase 3:
- [ ] Can create 30-outcome market
- [ ] Can place orders on any outcome
- [ ] Can resolve multi-outcome market
- [ ] Winners can claim payouts
- [ ] Binary markets still work

### Phase 4:
- [ ] Resolution account can resolve markets
- [ ] Admin account cannot resolve (if different)
- [ ] Settings display shows resolution account

### Phase 5:
- [ ] All notification types work
- [ ] Pagination works throughout
- [ ] API response times < 500ms
- [ ] No security vulnerabilities

---

## Timeline Estimate

| Phase | PRs | Estimated Time | Cumulative |
|-------|-----|----------------|------------|
| Phase 0 | #31 | 2-3 hours | 3 hours |
| Phase 1 | #32 | 6-8 hours | 11 hours |
| Phase 2 | #33 | 8-10 hours | 21 hours |
| Phase 3 | #34-35 | 12-16 hours | 37 hours |
| Phase 4 | #36 | 2-3 hours | 40 hours |
| Phase 5 | #37 | 4-6 hours | 46 hours |

**Total Estimated Time:** 40-46 hours of development work

**Note:** This assumes focused development time. Real-world timeline will depend on:
- Testing and debugging time
- User feedback and iterations
- Deployment and monitoring
- Unexpected issues

---

## Questions for User

Before proceeding, please confirm:

1. **Admin Email:** What email should receive admin notifications?
2. **SMTP Setup:** Do you have SMTP credentials for cPanel, or should we use PHP `mail()`?
3. **Resolution Account:** Do you want to set up a separate resolution account now, or use admin account initially?
4. **Multi-Outcome Priority:** Is multi-outcome markets the highest priority, or should we focus on approval workflow first?
5. **Database:** Is SQLite acceptable, or do you prefer MySQL?
6. **Testing:** Do you want to test each phase on testnet before mainnet, or deploy directly to mainnet?
7. **Backward Compatibility:** Do you have any existing markets that need to remain functional?

---

## Next Steps

Once you approve this plan:

1. I'll start with Phase 0 (Settings + Default Active tab)
2. Create PR #31 with those changes
3. Wait for your review and merge
4. Move to Phase 1 (Approval workflow)
5. Continue through phases sequentially

Each phase will be a separate PR for easier review and testing.
