import { Table, EMPTY_NAME, Name, TimePointSec } from "proton-tsc";

// LMSR positions table - stores user's YES and NO shares for each market
// Scoped by market_id, primary key by user
@table("poslmsr")
export class PositionLmsrTable extends Table {
  constructor(
    public user: Name = EMPTY_NAME,
    public shares_yes: i64 = 0,       // YES shares in fixed-point (scaled by SCALE = 1_000_000)
    public shares_no: i64 = 0,        // NO shares in fixed-point (scaled by SCALE = 1_000_000)
    public collateral_spent: i64 = 0, // Total collateral spent (for refund on cancel)
    public updated_at: TimePointSec = new TimePointSec(0)
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
