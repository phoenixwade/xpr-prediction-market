import { Table, Asset, Symbol } from "proton-tsc";

@table("profitrounds")
export class ProfitRoundTable extends Table {
  constructor(
    public round_id: u64 = 0,
    public timestamp: u64 = 0,
    public total_profit: Asset = new Asset(0, new Symbol("XUSDC", 6))
  ) {
    super();
  }

  @primary()
  get by_round_id(): u64 {
    return this.round_id;
  }

  set by_round_id(value: u64) {
    this.round_id = value;
  }
}
