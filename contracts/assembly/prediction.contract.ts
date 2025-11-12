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
import { MarketTable, OrderTable, PositionTable, BalanceTable, ConfigTable } from "./tables";

const XPR_SYMBOL = new Symbol("XPR", 4);
const ONE_XPR: i64 = 10000;

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
  marketsTable: TableStore<MarketTable> = new TableStore<MarketTable>(this.receiver, this.receiver);
  balancesTable: TableStore<BalanceTable> = new TableStore<BalanceTable>(this.receiver, this.receiver);
  configTable: TableStore<ConfigTable> = new TableStore<ConfigTable>(this.receiver, this.receiver);

  constructor(receiver: Name, firstReceiver: Name, action: Name) {
    super(receiver, firstReceiver, action);
  }

  @action("transfer", notify)
  onTransfer(from: Name, to: Name, quantity: Asset, memo: string): void {
    if (to != this.receiver) return;
    
    check(
      quantity.symbol.code == XPR_SYMBOL.code && quantity.symbol.precision == XPR_SYMBOL.precision,
      "Only XPR token deposits allowed"
    );
    check(quantity.amount > 0, "Deposit amount must be positive");

    let bal = this.balancesTable.get(from.N);
    if (bal == null) {
      bal = new BalanceTable(from, quantity);
    } else {
      bal.funds = new Asset(bal.funds.amount + quantity.amount, quantity.symbol);
    }
    this.balancesTable.set(bal, from);
    
    print(`Deposited ${quantity.toString()} for ${from.toString()}`);
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
    const action = transferAction.act(Name.fromString("eosio.token"), new PermissionLevel(this.receiver));
    const transferParams = new Transfer(this.receiver, to, quantity, "Withdrawal from prediction market");
    action.send(transferParams);
    
    print(`Withdrew ${quantity.toString()} for ${to.toString()}`);
  }

  @action("createmkt")
  createMarket(admin: Name, question: string, category: string, expireTime: u32): void {
    requireAuth(admin);
    check(question.length > 0, "Question cannot be empty");
    check(category.length > 0, "Category cannot be empty");

    const newId = this.getNextMarketId();
    const market = new MarketTable(
      newId,
      question,
      category,
      new TimePointSec(expireTime),
      false,
      2
    );
    this.marketsTable.set(market, this.receiver);
    
    print(`Created market ${newId}: ${question}`);
  }

  @action("placeorder")
  placeOrder(
    account: Name,
    market_id: u64,
    outcome: string,
    bid: boolean,
    price: Asset,
    quantity: u32
  ): void {
    requireAuth(account);
    check(price.amount > 0 && quantity > 0, "Price and quantity must be positive");

    const market = this.marketsTable.get(market_id);
    check(market != null, "Market not found");
    check(!market!.resolved, "Market is already resolved, cannot trade");

    let isBid = bid;
    if (outcome == "no") {
      isBid = !bid;
    }

    const priceInt = price.amount;
    let cost: i64 = 0;

    if (isBid) {
      cost = priceInt * quantity;
      let bal = this.balancesTable.get(account.N);
      check(bal != null && bal.funds.amount >= cost, "Insufficient balance to place buy order");
      
      bal!.funds = new Asset(bal!.funds.amount - cost, bal!.funds.symbol);
      this.balancesTable.update(bal!, account);
    } else {
      const positionsTable = new TableStore<PositionTable>(this.receiver, account);
      let pos = positionsTable.get(market_id);
      
      if (outcome == "yes") {
        if (pos != null && pos.yes_shares >= quantity) {
          pos.yes_shares -= quantity;
          positionsTable.update(pos, account);
        } else {
          cost = ONE_XPR * quantity;
          let bal = this.balancesTable.get(account.N);
          check(bal != null && bal.funds.amount >= cost, "Insufficient balance for short sell collateral");
          
          bal!.funds = new Asset(bal!.funds.amount - cost, bal!.funds.symbol);
          this.balancesTable.update(bal!, account);
          
          if (pos == null) {
            pos = new PositionTable(market_id, 0, quantity);
          } else {
            pos.no_shares += quantity;
          }
          positionsTable.set(pos, account);
        }
      } else {
        if (pos != null && pos.no_shares >= quantity) {
          pos.no_shares -= quantity;
          positionsTable.update(pos, account);
        } else {
          cost = ONE_XPR * quantity;
          let bal = this.balancesTable.get(account.N);
          check(bal != null && bal.funds.amount >= cost, "Insufficient balance for short sell (no) collateral");
          
          bal!.funds = new Asset(bal!.funds.amount - cost, bal!.funds.symbol);
          this.balancesTable.update(bal!, account);
          
          if (pos == null) {
            pos = new PositionTable(market_id, quantity, 0);
          } else {
            pos.yes_shares += quantity;
          }
          positionsTable.set(pos, account);
        }
      }
    }

    const orderId = this.getNextOrderId();
    const order = new OrderTable(orderId, account, isBid, priceInt, quantity);
    
    const ordersTable = new TableStore<OrderTable>(this.receiver, Name.fromU64(market_id));
    ordersTable.set(order, this.receiver);

    this.matchOrders(market_id, order, isBid);
    
    print(`Placed order ${orderId} for market ${market_id}`);
  }

  @action("cancelorder")
  cancelOrder(account: Name, market_id: u64, order_id: u64): void {
    requireAuth(account);
    
    const ordersTable = new TableStore<OrderTable>(this.receiver, Name.fromU64(market_id));
    const order = ordersTable.get(order_id);
    
    check(order != null, "Order not found");
    check(order!.account == account, "Not your order");

    ordersTable.remove(order!);

    if (order!.isBid) {
      const refundAmount = order!.price * order!.quantity;
      let bal = this.balancesTable.get(account.N);
      if (bal == null) {
        bal = new BalanceTable(account, new Asset(refundAmount, XPR_SYMBOL));
        this.balancesTable.set(bal, account);
      } else {
        bal.funds = new Asset(bal.funds.amount + refundAmount, bal.funds.symbol);
        this.balancesTable.update(bal, account);
      }
    } else {
      const positionsTable = new TableStore<PositionTable>(this.receiver, account);
      let pos = positionsTable.get(market_id);
      
      if (pos != null) {
        if (pos.no_shares >= order!.quantity) {
          pos.no_shares -= order!.quantity;
          const refund = ONE_XPR * order!.quantity;
          let bal = this.balancesTable.get(account.N);
          if (bal == null) {
            bal = new BalanceTable(account, new Asset(refund, XPR_SYMBOL));
            this.balancesTable.set(bal, account);
          } else {
            bal.funds = new Asset(bal.funds.amount + refund, bal.funds.symbol);
            this.balancesTable.update(bal, account);
          }
        } else {
          pos.yes_shares += order!.quantity;
        }
        positionsTable.update(pos, account);
      }
    }
    
    print(`Cancelled order ${order_id} for market ${market_id}`);
  }

  @action("resolve")
  resolveMarket(admin: Name, market_id: u64, outcome: boolean): void {
    requireAuth(admin);
    
    let market = this.marketsTable.get(market_id);
    check(market != null, "Market not found");
    check(!market!.resolved, "Market already resolved");

    market!.resolved = true;
    market!.outcome = outcome ? 1 : 0;
    this.marketsTable.update(market!, this.receiver);
    
    print(`Resolved market ${market_id} with outcome: ${outcome ? "Yes" : "No"}`);
  }

  @action("claim")
  claim(market_id: u64, user: Name): void {
    requireAuth(user);
    
    const market = this.marketsTable.get(market_id);
    check(market != null && market!.resolved, "Market not resolved yet");

    const positionsTable = new TableStore<PositionTable>(this.receiver, user);
    let pos = positionsTable.get(market_id);
    check(pos != null, "No position for user in this market");

    let payout: i64 = 0;
    if (market!.outcome == 1) {
      if (pos!.yes_shares > 0) {
        payout = ONE_XPR * pos!.yes_shares;
        pos!.yes_shares = 0;
      }
      pos!.no_shares = 0;
    } else if (market!.outcome == 0) {
      if (pos!.no_shares > 0) {
        payout = ONE_XPR * pos!.no_shares;
        pos!.no_shares = 0;
      }
      pos!.yes_shares = 0;
    }

    positionsTable.update(pos!, user);

    if (payout > 0) {
      let bal = this.balancesTable.get(user.N);
      if (bal == null) {
        bal = new BalanceTable(user, new Asset(payout, XPR_SYMBOL));
        this.balancesTable.set(bal, user);
      } else {
        bal.funds = new Asset(bal.funds.amount + payout, bal.funds.symbol);
        this.balancesTable.update(bal, user);
      }
    }
    
    print(`Claimed ${payout} for user ${user.toString()} in market ${market_id}`);
  }

  @action("collectfees")
  collectFees(admin: Name, to: Name): void {
    requireAuth(admin);
    
    let feeBal = this.balancesTable.get(this.receiver.N);
    if (feeBal != null && feeBal.funds.amount > 0) {
      const amount = feeBal.funds;
      feeBal.funds = new Asset(0, XPR_SYMBOL);
      this.balancesTable.update(feeBal, this.receiver);

      const transferAction = new InlineAction<Transfer>("transfer");
      const action = transferAction.act(Name.fromString("eosio.token"), new PermissionLevel(this.receiver));
      const transferParams = new Transfer(this.receiver, to, amount, "Fee collection");
      action.send(transferParams);
    }
    
    print(`Collected fees to ${to.toString()}`);
  }

  private matchOrders(market_id: u64, newOrder: OrderTable, isBid: boolean): void {
    const ordersTable = new TableStore<OrderTable>(this.receiver, Name.fromU64(market_id));
    
    let currentOrder = ordersTable.first();
    
    while (currentOrder != null && newOrder.quantity > 0) {
      if (isBid) {
        if (!currentOrder.isBid && currentOrder.price <= newOrder.price) {
          const tradePrice = currentOrder.price;
          const tradeQty = currentOrder.quantity < newOrder.quantity ? currentOrder.quantity : newOrder.quantity;
          
          this.executeTrade(market_id, newOrder.account, currentOrder.account, tradePrice, tradeQty, true);
          
          currentOrder.quantity -= tradeQty;
          newOrder.quantity -= tradeQty;
          
          if (currentOrder.quantity == 0) {
            const toRemove = currentOrder;
            currentOrder = ordersTable.next(currentOrder);
            ordersTable.remove(toRemove);
          } else {
            ordersTable.update(currentOrder, this.receiver);
            currentOrder = ordersTable.next(currentOrder);
          }
        } else {
          currentOrder = ordersTable.next(currentOrder);
        }
      } else {
        if (currentOrder.isBid && currentOrder.price >= newOrder.price) {
          const tradePrice = currentOrder.price;
          const tradeQty = currentOrder.quantity < newOrder.quantity ? currentOrder.quantity : newOrder.quantity;
          
          this.executeTrade(market_id, currentOrder.account, newOrder.account, tradePrice, tradeQty, false);
          
          currentOrder.quantity -= tradeQty;
          newOrder.quantity -= tradeQty;
          
          if (currentOrder.quantity == 0) {
            const toRemove = currentOrder;
            currentOrder = ordersTable.next(currentOrder);
            ordersTable.remove(toRemove);
          } else {
            ordersTable.update(currentOrder, this.receiver);
            currentOrder = ordersTable.next(currentOrder);
          }
        } else {
          currentOrder = ordersTable.next(currentOrder);
        }
      }
    }
    
    if (newOrder.quantity == 0) {
      ordersTable.remove(newOrder);
    }
  }

  private executeTrade(
    market_id: u64,
    buyer: Name,
    seller: Name,
    priceInt: u64,
    qty: u32,
    buyerIsTaker: boolean
  ): void {
    const total = priceInt * qty;
    const fee = total / 10000; // 0.01% fee
    const payout = total - fee;

    const buyerPosTable = new TableStore<PositionTable>(this.receiver, buyer);
    let buyerPos = buyerPosTable.get(market_id);
    if (buyerPos == null) {
      buyerPos = new PositionTable(market_id, qty, 0);
      buyerPosTable.set(buyerPos, buyer);
    } else {
      buyerPos.yes_shares += qty;
      buyerPosTable.update(buyerPos, buyer);
    }

    let sellerBal = this.balancesTable.get(seller.N);
    if (sellerBal == null) {
      sellerBal = new BalanceTable(seller, new Asset(payout, XPR_SYMBOL));
      this.balancesTable.set(sellerBal, seller);
    } else {
      sellerBal.funds = new Asset(sellerBal.funds.amount + payout, sellerBal.funds.symbol);
      this.balancesTable.update(sellerBal, seller);
    }

    let feeBal = this.balancesTable.get(this.receiver.N);
    if (feeBal == null) {
      feeBal = new BalanceTable(this.receiver, new Asset(fee, XPR_SYMBOL));
      this.balancesTable.set(feeBal, this.receiver);
    } else {
      feeBal.funds = new Asset(feeBal.funds.amount + fee, feeBal.funds.symbol);
      this.balancesTable.update(feeBal, this.receiver);
    }
  }

  private getConfig(): ConfigTable {
    let config = this.configTable.get(0);
    if (config == null) {
      config = new ConfigTable(0, 1, 1);
      this.configTable.set(config, this.receiver);
    }
    return config;
  }

  private getNextMarketId(): u64 {
    const config = this.getConfig();
    const id = config.nextMarketId;
    config.nextMarketId += 1;
    this.configTable.update(config, this.receiver);
    return id;
  }

  private getNextOrderId(): u64 {
    const config = this.getConfig();
    const id = config.nextOrderId;
    config.nextOrderId += 1;
    this.configTable.update(config, this.receiver);
    return id;
  }
}
