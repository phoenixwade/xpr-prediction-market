import { Table, EMPTY_NAME, Name } from "proton-tsc";

@table("resolvers")
export class ResolverTable extends Table {
  constructor(
    public account: Name = EMPTY_NAME,
    public rank: u8 = 0,
    public xpred_balance: u64 = 0
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
