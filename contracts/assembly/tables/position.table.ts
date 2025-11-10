import { Table } from "proton-tsc";

@table("positions")
export class PositionTable extends Table {
  constructor(
    public market_id: u64 = 0,
    public yes_shares: u32 = 0,
    public no_shares: u32 = 0
  ) {
    super();
  }

  @primary()
  get by_market(): u64 {
    return this.market_id;
  }

  set by_market(value: u64) {
    this.market_id = value;
  }
}
