import {
  Contract,
  Asset,
  Name,
  TableStore,
  print,
  check,
  requireAuth,
  Symbol,
  TimePointSec,
  EMPTY_NAME,
  InlineAction,
  PermissionLevel
} from "proton-tsc";
import { Market2Table, OrderTable, PositionTable, PositionV2Table, PositionLmsrTable, OutcomeTable, BalanceTable, Config2Table, ResolverTable } from "./tables";
import { currentTimeSec } from "proton-tsc";
import {
  SCALE,
  lmsr_compute_shares_from_budget,
  lmsr_buy_cost,
  lmsr_fee,
  lmsr_probability_yes,
  DEFAULT_B,
  DEFAULT_FEE_BPS
} from "./lmsr";

const USDTEST_SYMBOL = new Symbol("USDTEST", 6);
const ONE_USDTEST: i64 = 1000000; // 1 USDTEST = 1,000,000 base units (6 decimals)

@packer
class Transfer {
  constructor(
    public from: Name = EMPTY_NAME,
    public to: Name = EMPTY_NAME,
    public quantity: Asset = new Asset(),
    public memo: string = ""
  ) {}
}

@contract
export class PredictionMarketContract extends Contract {
  markets2Table: TableStore<Market2Table>;
  balancesTable: TableStore<BalanceTable>;
  config2Table: TableStore<Config2Table>;
  resolversTable: TableStore<ResolverTable>;

  constructor(receiver: Name, firstReceiver: Name, action: Name) {
    super(receiver, firstReceiver, action);
    this.markets2Table = new TableStore<Market2Table>(this.receiver, this.receiver);
    this.balancesTable = new TableStore<BalanceTable>(this.receiver, this.receiver);
    this.config2Table = new TableStore<Config2Table>(this.receiver, this.receiver);
    this.resolversTable = new TableStore<ResolverTable>(this.receiver, this.receiver);
  }

  @action("transfer", notify)
  onTransfer(from: Name, to: Name, quantity: Asset, memo: string): void {
    if (to != this.receiver) return;
    
    check(
      quantity.symbol.code == USDTEST_SYMBOL.code && quantity.symbol.precision == USDTEST_SYMBOL.precision,
      "Only USDTEST token deposits allowed"
    );
    check(quantity.amount > 0, "Deposit amount must be positive");

    // Check if this is an LMSR buy transaction
    // Memo format: "buy:<market_id>:<outcome>:<min_shares>"
    // outcome: "yes" or "no" (or 0/1)
    // min_shares: minimum shares expected (for slippage protection), in whole units
    if (memo.startsWith("buy:")) {
      this.handleLmsrBuy(from, quantity, memo);
      return;
    }

    // Regular deposit to balance
    let bal = this.balancesTable.get(from.N);
    if (bal == null) {
      bal = new BalanceTable(from, quantity);
    } else {
      bal.funds = new Asset(bal.funds.amount + quantity.amount, quantity.symbol);
    }
    this.balancesTable.set(bal, this.receiver);
    
    print(`Deposited ${quantity.toString()} for ${from.toString()}`);
  }

  // Handle LMSR buy transaction from transfer memo
  private handleLmsrBuy(from: Name, quantity: Asset, memo: string): void {
    // Parse memo: "buy:<market_id>:<outcome>:<min_shares>"
    const parts = memo.split(":");
    check(parts.length >= 3, "Invalid buy memo format. Use: buy:<market_id>:<outcome>:<min_shares>");
    
    const market_id = U64.parseInt(parts[1]);
    const outcome_str = parts[2].toLowerCase();
    const min_shares_str = parts.length >= 4 ? parts[3] : "0";
    const min_shares = I64.parseInt(min_shares_str) * SCALE; // Convert to fixed-point
    
    // Determine outcome (YES = true, NO = false)
    let outcome_is_yes: boolean;
    if (outcome_str == "yes" || outcome_str == "0") {
      outcome_is_yes = true;
    } else if (outcome_str == "no" || outcome_str == "1") {
      outcome_is_yes = false;
    } else {
      check(false, "Invalid outcome. Use 'yes', 'no', '0', or '1'");
      return;
    }
    
    // Load market
    const market = this.markets2Table.get(market_id);
    check(market != null, "Market not found");
    check(!market!.resolved, "Market is already resolved");
    check(market!.version >= 2, "Market does not support LMSR trading");
    
    const now = currentTimeSec();
    check(i32(now) < market!.expire.secSinceEpoch(), "Market has expired");
    
    // USDTEST has 6 decimals, so quantity.amount is already in SCALE units (1 USDTEST = 1,000,000 base units = SCALE)
    // No need to multiply by SCALE again - they are equivalent
    const budget_micro: i64 = quantity.amount;
    
    // Compute shares using binary search
    const delta_q = lmsr_compute_shares_from_budget(
      market!.q_yes,
      market!.q_no,
      market!.b,
      outcome_is_yes,
      budget_micro,
      market!.fee_bps
    );
    
    // Slippage protection
    check(delta_q >= min_shares, "Slippage too high: shares received less than minimum");
    
    // Compute actual cost and fee
    const raw_cost = lmsr_buy_cost(market!.q_yes, market!.q_no, market!.b, outcome_is_yes, delta_q);
    const fee = lmsr_fee(market!.q_yes, market!.q_no, market!.b, outcome_is_yes, delta_q, market!.fee_bps);
    const total_charge = raw_cost + fee;
    
    // Refund excess if any
    // refund_micro is already in USDTEST base units (same as SCALE), so use directly
    const refund_micro = budget_micro - total_charge;
    if (refund_micro > SCALE) { // Only refund if more than 1 USDTEST worth (1,000,000 base units)
      const refundAsset = new Asset(refund_micro, USDTEST_SYMBOL);
      
      // Send refund
      const transferAction = new InlineAction<Transfer>("transfer");
      const action = transferAction.act(Name.fromString("tokencreate"), new PermissionLevel(this.receiver));
      const transferParams = new Transfer(this.receiver, from, refundAsset, "LMSR buy refund");
      action.send(transferParams);
    }
    
    // Update market state
    if (outcome_is_yes) {
      market!.q_yes += delta_q;
    } else {
      market!.q_no += delta_q;
    }
    market!.collected_fees += fee;
    market!.total_collateral_in += total_charge;
    this.markets2Table.update(market!, this.receiver);
    
    // Update user position
    const positionsLmsrTable = new TableStore<PositionLmsrTable>(this.receiver, Name.fromU64(market_id));
    let pos = positionsLmsrTable.get(from.N);
    
    if (pos == null) {
      pos = new PositionLmsrTable(from, 0, 0, 0, new TimePointSec(now));
    }
    
    if (outcome_is_yes) {
      pos.shares_yes += delta_q;
    } else {
      pos.shares_no += delta_q;
    }
    pos.collateral_spent += total_charge;
    pos.updated_at = new TimePointSec(now);
    positionsLmsrTable.set(pos, this.receiver);
    
    // Log the purchase
    const shares_display = delta_q / SCALE;
    const outcome_name = outcome_is_yes ? "YES" : "NO";
    print(`LMSR Buy: ${from.toString()} bought ${shares_display} ${outcome_name} shares in market ${market_id}`);
  }

  @action("withdraw")
  withdraw(to: Name, quantity: Asset): void {
    requireAuth(to);
    check(quantity.amount > 0, "Must withdraw positive amount");

    let bal = this.balancesTable.get(to.N);
    check(bal != null, "No balance found for user");
    check(quantity.amount <= bal!.funds.amount, "Insufficient balance");

    bal!.funds = new Asset(bal!.funds.amount - quantity.amount, bal!.funds.symbol);
    this.balancesTable.update(bal!, to);

    const transferAction = new InlineAction<Transfer>("transfer");
    const action = transferAction.act(Name.fromString("tokencreate"), new PermissionLevel(this.receiver));
    const transferParams = new Transfer(this.receiver, to, quantity, "Withdrawal from prediction market");
    action.send(transferParams);
    
    print(`Withdrew ${quantity.toString()} for ${to.toString()}`);
  }

  @action("createmkt")
  createMarket(admin: Name, question: string, category: string, expireTime: u32, image_url: string = "", outcomes: string = ""): void {
    requireAuth(admin);
    check(question.length > 0, "Question cannot be empty");
    check(category.length > 0, "Category cannot be empty");
    check(image_url.length <= 512, "Image URL too long (max 512 characters)");
    
    // Ensure expiry is at least 24 hours in the future
    const now = currentTimeSec();
    const minExpire = now + 24 * 60 * 60; // 24 hours in seconds
    check(expireTime >= minExpire, "Market expiry must be at least 24 hours in the future");

    const newId = this.getNextMarketId();
    
    let outcomesCount: u8 = 2;
    let outcomeNames: string[] = [];
    
    if (outcomes.length > 0) {
      outcomeNames = outcomes.split(",");
      check(outcomeNames.length >= 2 && outcomeNames.length <= 255, "Must have 2-255 outcomes");
      outcomesCount = outcomeNames.length as u8;
    } else {
      outcomeNames = ["Yes", "No"];
    }
    
    // Create market with LMSR fields initialized
    // For LMSR v2 markets: version=2, b=DEFAULT_B, fee_bps=DEFAULT_FEE_BPS, q_yes=0, q_no=0
    const market = new Market2Table(
      newId,
      question,
      category,
      new TimePointSec(expireTime),
      false,
      255, // unresolved
      image_url,
      outcomesCount,
      new TimePointSec(0),
      1, // status = OPEN
      EMPTY_NAME, // suggested_by
      EMPTY_NAME, // approved_by
      now, // created_at
      2, // version = 2 (LMSR)
      DEFAULT_B, // b = 500 * SCALE
      DEFAULT_FEE_BPS, // fee_bps = 100 (1%)
      0, // q_yes = 0
      0, // q_no = 0
      0, // collected_fees = 0
      0, // total_collateral_in = 0
      0  // total_collateral_out = 0
    );
    this.markets2Table.set(market, this.receiver);
    
    const outcomesTable = new TableStore<OutcomeTable>(this.receiver, Name.fromU64(newId));
    for (let i = 0; i < outcomeNames.length; i++) {
      const outcome = new OutcomeTable(i as u8, outcomeNames[i].trim(), i as u8);
      outcomesTable.set(outcome, this.receiver);
    }
    
      print(`Created market ${newId} with ${outcomesCount} outcomes: ${question}`);
    }

    @action("editmarket")
    editMarket(admin: Name, market_id: u64, question: string, category: string, image_url: string): void {
      requireAuth(admin);
      // Only contract owner can edit markets
      check(admin == this.receiver, "Only contract owner can edit markets");
    
      const market = this.markets2Table.get(market_id);
      check(market != null, "Market not found");
      check(!market!.resolved, "Cannot edit resolved market");
    
      // Validate inputs
      check(question.length > 0, "Question cannot be empty");
      check(category.length > 0, "Category cannot be empty");
      check(image_url.length <= 512, "Image URL too long (max 512 characters)");
    
      // Update market fields
      market!.question = question;
      market!.category = category;
      market!.image_url = image_url;
    
      this.markets2Table.update(market!, this.receiver);
    
      print(`Updated market ${market_id}: ${question}`);
    }

    @action("placeorder")
  placeOrder(
    account: Name,
    market_id: u64,
    outcome_id: u8,
    bid: boolean,
    price: Asset,
    quantity: u32
  ): void {
    requireAuth(account);
    check(price.amount > 0 && quantity > 0, "Price and quantity must be positive");

    const market = this.markets2Table.get(market_id);
    check(market != null, "Market not found");
    check(!market!.resolved, "Market is already resolved, cannot trade");
    check(outcome_id < market!.outcomes_count, "Invalid outcome_id");

    const priceInt = price.amount;
    let cost: i64 = 0;

    if (bid) {
      cost = priceInt * quantity;
      let bal = this.balancesTable.get(account.N);
      check(bal != null && bal.funds.amount >= cost, "Insufficient balance to place buy order");
      
      bal!.funds = new Asset(bal!.funds.amount - cost, bal!.funds.symbol);
      this.balancesTable.update(bal!, account);
    } else {
      const positionsV2Table = new TableStore<PositionV2Table>(this.receiver, Name.fromU64(market_id));
      const compositeKey = (account.N << 8) | outcome_id;
      let pos = positionsV2Table.get(compositeKey);
      
      if (pos != null && pos.shares >= i64(quantity)) {
        pos.shares -= i64(quantity);
        positionsV2Table.update(pos, this.receiver);
      } else {
        const heldShares = pos != null ? pos.shares : 0;
        const shortedShares = quantity - heldShares;
        cost = ONE_USDTEST * shortedShares;
        
        let bal = this.balancesTable.get(account.N);
        check(bal != null && bal.funds.amount >= cost, "Insufficient balance for short sell collateral");
        
        bal!.funds = new Asset(bal!.funds.amount - cost, bal!.funds.symbol);
        this.balancesTable.update(bal!, account);
        
        if (pos == null) {
          pos = new PositionV2Table(compositeKey, account, outcome_id, 0 - i64(shortedShares), new TimePointSec(0));
          positionsV2Table.set(pos, this.receiver);
        } else {
          pos.shares -= i64(quantity);
          positionsV2Table.update(pos, this.receiver);
        }
      }
    }

    const orderId = this.getNextOrderId();
    const order = new OrderTable(orderId, account, outcome_id, bid, priceInt, quantity);
    
    const ordersTable = new TableStore<OrderTable>(this.receiver, Name.fromU64(market_id));
    ordersTable.set(order, this.receiver);

    this.matchOrders(market_id, order, outcome_id);
    
    print(`Placed order ${orderId} for market ${market_id}, outcome ${outcome_id}`);
  }

  @action("cancelorder")
  cancelOrder(account: Name, market_id: u64, order_id: u64): void {
    requireAuth(account);
    
    const ordersTable = new TableStore<OrderTable>(this.receiver, Name.fromU64(market_id));
    const order = ordersTable.get(order_id);
    
    check(order != null, "Order not found");
    check(order!.account == account, "Not your order");

    const outcome_id = order!.outcome_id;
    ordersTable.remove(order!);

    if (order!.isBid) {
      const refundAmount = order!.price * order!.quantity;
      let bal = this.balancesTable.get(account.N);
      if (bal == null) {
        bal = new BalanceTable(account, new Asset(refundAmount, USDTEST_SYMBOL));
        this.balancesTable.set(bal, account);
      } else {
        bal.funds = new Asset(bal.funds.amount + refundAmount, bal.funds.symbol);
        this.balancesTable.update(bal, account);
      }
    } else {
      const positionsV2Table = new TableStore<PositionV2Table>(this.receiver, Name.fromU64(market_id));
      const compositeKey = (account.N << 8) | outcome_id;
      let pos = positionsV2Table.get(compositeKey);
      
      if (pos != null && pos.shares < 0) {
        const shortedShares = 0 - pos.shares;
        if (shortedShares >= i64(order!.quantity)) {
          const refund = ONE_USDTEST * i64(order!.quantity);
          pos.shares += i64(order!.quantity);
          positionsV2Table.update(pos, this.receiver);
          
          let bal = this.balancesTable.get(account.N);
          if (bal == null) {
            bal = new BalanceTable(account, new Asset(refund, USDTEST_SYMBOL));
            this.balancesTable.set(bal, account);
          } else {
            bal.funds = new Asset(bal.funds.amount + refund, bal.funds.symbol);
            this.balancesTable.update(bal, account);
          }
        } else {
          pos.shares += i64(order!.quantity);
          positionsV2Table.update(pos, this.receiver);
        }
      }
    }
    
    print(`Cancelled order ${order_id} for market ${market_id}`);
  }

  @action("resolve")
  resolveMarket(admin: Name, market_id: u64, winning_outcome_id: u8): void {
    requireAuth(admin);
    
    this.doResolve(market_id, winning_outcome_id);
    
    print(`Resolved market ${market_id} with winning outcome: ${winning_outcome_id}`);
  }

  @action("claim")
  claim(market_id: u64, user: Name): void {
    requireAuth(user);
    
    const market = this.markets2Table.get(market_id);
    check(market != null && market!.resolved, "Market not resolved yet");
    check(market!.outcome < 255, "Market outcome not set");

    const winning_outcome_id = market!.outcome;
    let payout: i64 = 0;

    // Check if this is an LMSR market (version >= 2)
    if (market!.version >= 2) {
      // LMSR claim logic
      const positionsLmsrTable = new TableStore<PositionLmsrTable>(this.receiver, Name.fromU64(market_id));
      let pos = positionsLmsrTable.get(user.N);
      
      check(pos != null, "No position found for user in this market");
      
      // Determine winning shares based on outcome
      // outcome 0 = YES wins, outcome 1 = NO wins
      let winning_shares: i64 = 0;
      if (winning_outcome_id == 0) {
        winning_shares = pos!.shares_yes;
      } else {
        winning_shares = pos!.shares_no;
      }
      
      check(winning_shares > 0, "No winning position for user in this market");
      
      // Payout: 1 share = 1 USDTEST
      // winning_shares is already in SCALE units (same as USDTEST base units), so use directly
      payout = winning_shares;
      
      // Zero out the winning shares
      if (winning_outcome_id == 0) {
        pos!.shares_yes = 0;
      } else {
        pos!.shares_no = 0;
      }
      positionsLmsrTable.update(pos!, this.receiver);
      
      // Update market total_collateral_out
      market!.total_collateral_out += winning_shares;
      this.markets2Table.update(market!, this.receiver);
    } else {
      // Legacy order-book claim logic
      const positionsV2Table = new TableStore<PositionV2Table>(this.receiver, Name.fromU64(market_id));
      const compositeKey = (user.N << 8) | winning_outcome_id;
      let pos = positionsV2Table.get(compositeKey);
      
      check(pos != null && pos.shares > 0, "No winning position for user in this market");

      payout = ONE_USDTEST * pos!.shares;
      pos!.shares = 0;
      positionsV2Table.update(pos!, this.receiver);
    }

    // Transfer payout to user's balance
    let bal = this.balancesTable.get(user.N);
    if (bal == null) {
      bal = new BalanceTable(user, new Asset(payout, USDTEST_SYMBOL));
      this.balancesTable.set(bal, user);
    } else {
      bal.funds = new Asset(bal.funds.amount + payout, bal.funds.symbol);
      this.balancesTable.update(bal, user);
    }
    
    print(`Claimed ${payout} for user ${user.toString()} in market ${market_id}`);
  }

  @action("collectfees")
  collectFees(admin: Name, to: Name): void {
    requireAuth(admin);
    
    let feeBal = this.balancesTable.get(this.receiver.N);
    if (feeBal != null && feeBal.funds.amount > 0) {
      const amount = feeBal.funds;
      feeBal.funds = new Asset(0, USDTEST_SYMBOL);
      this.balancesTable.update(feeBal, this.receiver);

      const transferAction = new InlineAction<Transfer>("transfer");
      const action = transferAction.act(Name.fromString("tokencreate"), new PermissionLevel(this.receiver));
      const transferParams = new Transfer(this.receiver, to, amount, "Fee collection");
      action.send(transferParams);
    }
    
    print(`Collected fees to ${to.toString()}`);
  }

  // ============================================
  // Phase 20: Multisig Resolution Actions
  // ============================================

  @action("updateres")
  updateResolvers(admin: Name, resolvers: Name[], balances: u64[]): void {
    requireAuth(admin);
    check(resolvers.length <= 21, "Maximum 21 resolvers allowed");
    check(resolvers.length == balances.length, "Resolvers and balances arrays must have same length");

    let existing = this.resolversTable.first();
    while (existing != null) {
      const toRemove = existing;
      existing = this.resolversTable.next(existing);
      this.resolversTable.remove(toRemove);
    }

    for (let i = 0; i < resolvers.length; i++) {
      const resolver = new ResolverTable(resolvers[i], (i + 1) as u8, balances[i]);
      this.resolversTable.set(resolver, this.receiver);
    }

    print(`Updated ${resolvers.length} resolvers`);
  }

  @action("resolvemkt")
  resolveMarketMsig(market_id: u64, winning_outcome_id: u8): void {
    requireAuth(this.receiver);
    
    this.doResolve(market_id, winning_outcome_id);
    
    print(`Resolved market ${market_id} via multisig with winning outcome: ${winning_outcome_id}`);
  }

  private doResolve(market_id: u64, winning_outcome_id: u8): void {
    let market = this.markets2Table.get(market_id);
    check(market != null, "Market not found");
    check(!market!.resolved, "Market already resolved");
    check(winning_outcome_id < market!.outcomes_count, "Invalid winning outcome_id");

    market!.resolved = true;
    market!.outcome = winning_outcome_id;
    market!.resolved_at = new TimePointSec(0);
    this.markets2Table.update(market!, this.receiver);
  }

  private matchOrders(market_id: u64, newOrder: OrderTable, outcome_id: u8): void {
    const ordersTable = new TableStore<OrderTable>(this.receiver, Name.fromU64(market_id));
    
    let currentOrder = ordersTable.first();
    
    while (currentOrder != null && newOrder.quantity > 0) {
      if (currentOrder!.outcome_id != outcome_id) {
        currentOrder = ordersTable.next(currentOrder!);
        continue;
      }
      
      if (newOrder.isBid) {
        if (!currentOrder!.isBid && currentOrder!.price <= newOrder.price) {
          const tradePrice = currentOrder!.price;
          const tradeQty = currentOrder!.quantity < newOrder.quantity ? currentOrder!.quantity : newOrder.quantity;
          
          this.executeTrade(market_id, outcome_id, newOrder.account, currentOrder!.account, tradePrice, tradeQty);
          
          currentOrder!.quantity -= tradeQty;
          newOrder.quantity -= tradeQty;
          
          if (currentOrder!.quantity == 0) {
            const toRemove = currentOrder!;
            currentOrder = ordersTable.next(currentOrder!);
            ordersTable.remove(toRemove);
          } else {
            ordersTable.update(currentOrder!, this.receiver);
            currentOrder = ordersTable.next(currentOrder!);
          }
        } else {
          currentOrder = ordersTable.next(currentOrder!);
        }
      } else {
        if (currentOrder!.isBid && currentOrder!.price >= newOrder.price) {
          const tradePrice = currentOrder!.price;
          const tradeQty = currentOrder!.quantity < newOrder.quantity ? currentOrder!.quantity : newOrder.quantity;
          
          this.executeTrade(market_id, outcome_id, currentOrder!.account, newOrder.account, tradePrice, tradeQty);
          
          currentOrder!.quantity -= tradeQty;
          newOrder.quantity -= tradeQty;
          
          if (currentOrder!.quantity == 0) {
            const toRemove = currentOrder!;
            currentOrder = ordersTable.next(currentOrder!);
            ordersTable.remove(toRemove);
          } else {
            ordersTable.update(currentOrder!, this.receiver);
            currentOrder = ordersTable.next(currentOrder!);
          }
        } else {
          currentOrder = ordersTable.next(currentOrder!);
        }
      }
    }
    
    if (newOrder.quantity == 0) {
      ordersTable.remove(newOrder);
    }
  }

  private executeTrade(
    market_id: u64,
    outcome_id: u8,
    buyer: Name,
    seller: Name,
    priceInt: u64,
    qty: u32
  ): void {
    const total = priceInt * qty;
    const fee = total / 10000;
    const payout = total - fee;

    const positionsV2Table = new TableStore<PositionV2Table>(this.receiver, Name.fromU64(market_id));
    
    const buyerKey = (buyer.N << 8) | outcome_id;
    let buyerPos = positionsV2Table.get(buyerKey);
    if (buyerPos == null) {
      buyerPos = new PositionV2Table(buyerKey, buyer, outcome_id, i64(qty), new TimePointSec(0));
      positionsV2Table.set(buyerPos, this.receiver);
    } else {
      buyerPos.shares += i64(qty);
      positionsV2Table.update(buyerPos, this.receiver);
    }

    let sellerBal = this.balancesTable.get(seller.N);
    if (sellerBal == null) {
      sellerBal = new BalanceTable(seller, new Asset(payout, USDTEST_SYMBOL));
      this.balancesTable.set(sellerBal, seller);
    } else {
      sellerBal.funds = new Asset(sellerBal.funds.amount + payout, sellerBal.funds.symbol);
      this.balancesTable.update(sellerBal, seller);
    }

    let feeBal = this.balancesTable.get(this.receiver.N);
    if (feeBal == null) {
      feeBal = new BalanceTable(this.receiver, new Asset(fee, USDTEST_SYMBOL));
      this.balancesTable.set(feeBal, this.receiver);
    } else {
      feeBal.funds = new Asset(feeBal.funds.amount + fee, feeBal.funds.symbol);
      this.balancesTable.update(feeBal, this.receiver);
    }
  }

  private getConfig(): Config2Table {
    let config = this.config2Table.get(0);
    if (config == null) {
      config = new Config2Table(
        0, 1, 1,
        this.receiver, this.receiver, EMPTY_NAME,
        0, 0,
        100000, 1000000000000, 10,
        false, false,
        1, 0, 0
      );
      this.config2Table.set(config, this.receiver);
    }
    return config;
  }

  private getNextMarketId(): u64 {
    let config = this.config2Table.get(0);
    if (config == null) {
      config = new Config2Table(0, 101, 1);
      this.config2Table.set(config, this.receiver);
      return 100;
    }
    const id = config.nextMarketId;
    config.nextMarketId += 1;
    this.config2Table.update(config, this.receiver);
    return id;
  }

  private getNextOrderId(): u64 {
    let config = this.config2Table.get(0);
    if (config == null) {
      config = new Config2Table(0, 1, 2);
      this.config2Table.set(config, this.receiver);
      return 1;
    }
    const id = config.nextOrderId;
    config.nextOrderId += 1;
    this.config2Table.update(config, this.receiver);
    return id;
  }
}
