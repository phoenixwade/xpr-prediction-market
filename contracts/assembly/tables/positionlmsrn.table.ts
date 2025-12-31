import { Table, EMPTY_NAME, Name, TimePointSec } from "proton-tsc";

// N-outcome LMSR positions table - stores user's shares for each outcome in a market
// Scoped by market_id, primary key is composite of (user, outcome_id)
// Used for version=3 markets with true N-outcome LMSR
@table("poslmsrn")
export class PositionLmsrNTable extends Table {
  constructor(
    public user: Name = EMPTY_NAME,
    public outcome_id: u8 = 0,           // Outcome ID (0 to N-1)
    public shares: i64 = 0,              // Shares held for this outcome (fixed-point, scaled by SCALE = 1_000_000)
    public collateral_spent: i64 = 0,    // Total collateral spent on this outcome
    public updated_at: TimePointSec = new TimePointSec(0)
  ) {
    super();
  }

  // Composite primary key: (user.N << 8) | outcome_id
  // This allows up to 256 outcomes per market (u8 max)
  @primary()
  get by_user_outcome(): u64 {
    return (this.user.N << 8) | (this.outcome_id as u64);
  }

  set by_user_outcome(value: u64) {
    this.user = Name.fromU64(value >> 8);
    this.outcome_id = (value & 0xFF) as u8;
  }
}
