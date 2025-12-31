import { Table } from "proton-tsc";

// N-outcome LMSR state table - stores q_i (quantity) for each outcome in a market
// Scoped by market_id, primary key by outcome_id
// Used for version=3 markets with true N-outcome LMSR
@table("outstate")
export class OutcomeStateTable extends Table {
  constructor(
    public outcome_id: u8 = 0,           // Outcome ID (0 to N-1)
    public q: i64 = 0,                   // Quantity of shares outstanding (fixed-point, scaled by SCALE = 1_000_000)
    public volume: i64 = 0               // Total volume traded on this outcome (for display)
  ) {
    super();
  }

  @primary()
  get by_id(): u64 {
    return this.outcome_id;
  }

  set by_id(value: u64) {
    this.outcome_id = value as u8;
  }
}
