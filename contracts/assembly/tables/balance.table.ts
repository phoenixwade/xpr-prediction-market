import { Table, EMPTY_NAME, Name, Asset, Symbol } from "proton-tsc";

@table("balances")
export class BalanceTable extends Table {
  constructor(
    public account: Name = EMPTY_NAME,
    public funds: Asset = new Asset(0, new Symbol("XPR", 4))
  ) {
    super();
  }

  @primary()
  get by_account(): u64 {
    return this.account.N;
  }

  set by_account(value: u64) {
    this.account = Name.fromU64(value);
  }
}
