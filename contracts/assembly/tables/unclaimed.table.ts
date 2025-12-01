import { Table, EMPTY_NAME, Name, Asset, Symbol } from "proton-tsc";

@table("unclaimed")
export class UnclaimedTable extends Table {
  constructor(
    public user: Name = EMPTY_NAME,
    public balance: Asset = new Asset(0, new Symbol("XUSDC", 6))
  ) {
    super();
  }

  @primary()
  get by_user(): u64 {
    return this.user.N;
  }

  set by_user(value: u64) {
    this.user = Name.fromU64(value);
  }
}
