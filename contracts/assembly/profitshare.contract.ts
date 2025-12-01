import {
  Contract,
  Asset,
  Name,
  TableStore,
  print,
  check,
  requireAuth,
  Symbol,
  EMPTY_NAME,
  InlineAction,
  PermissionLevel
} from "proton-tsc";
import { UnclaimedTable, ProfitRoundTable } from "./tables";

const XUSDC_SYMBOL = new Symbol("XUSDC", 6);

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
export class ProfitShareContract extends Contract {
  unclaimedTable: TableStore<UnclaimedTable>;
  profitRoundsTable: TableStore<ProfitRoundTable>;

  constructor(receiver: Name, firstReceiver: Name, action: Name) {
    super(receiver, firstReceiver, action);
    this.unclaimedTable = new TableStore<UnclaimedTable>(this.receiver, this.receiver);
    this.profitRoundsTable = new TableStore<ProfitRoundTable>(this.receiver, this.receiver);
  }

  @action("distribute")
  distribute(admin: Name, users: Name[], amounts: i64[], round_id: u64): void {
    requireAuth(admin);
    check(users.length == amounts.length, "Users and amounts arrays must have same length");
    check(users.length > 0, "Must distribute to at least one user");

    let totalDistributed: i64 = 0;

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const amount = amounts[i];
      
      if (amount <= 0) continue;

      let unclaimed = this.unclaimedTable.get(user.N);
      if (unclaimed == null) {
        unclaimed = new UnclaimedTable(user, new Asset(amount, XUSDC_SYMBOL));
        this.unclaimedTable.set(unclaimed, this.receiver);
      } else {
        unclaimed.balance = new Asset(unclaimed.balance.amount + amount, XUSDC_SYMBOL);
        this.unclaimedTable.update(unclaimed, this.receiver);
      }
      
      totalDistributed += amount;
    }

    const round = new ProfitRoundTable(round_id, 0, new Asset(totalDistributed, XUSDC_SYMBOL));
    this.profitRoundsTable.set(round, this.receiver);

    print(`Distributed ${totalDistributed} to ${users.length} users for round ${round_id}`);
  }

  @action("claimprofit")
  claimProfit(user: Name): void {
    requireAuth(user);

    const unclaimed = this.unclaimedTable.get(user.N);
    check(unclaimed != null, "No unclaimed profit for this account");
    check(unclaimed!.balance.amount > 0, "No profit to claim");

    const amount = unclaimed!.balance;

    this.unclaimedTable.remove(unclaimed!);

    const transferAction = new InlineAction<Transfer>("transfer");
    const action = transferAction.act(Name.fromString("xtokens"), new PermissionLevel(this.receiver));
    const transferParams = new Transfer(this.receiver, user, amount, "Profit share claim");
    action.send(transferParams);

    print(`Claimed ${amount.toString()} for user ${user.toString()}`);
  }
}
