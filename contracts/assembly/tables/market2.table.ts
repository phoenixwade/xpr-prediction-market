import { Table, EMPTY_NAME, Name, TimePointSec } from "proton-tsc";

@table("markets2")
export class Market2Table extends Table {
  constructor(
    public id: u64 = 0,
    public question: string = "",
    public category: string = "",
    public expire: TimePointSec = new TimePointSec(0),
    public resolved: boolean = false,
    public outcome: u8 = 255,
    public image_url: string = "",
    public outcomes_count: u8 = 2,
    public resolved_at: TimePointSec = new TimePointSec(0),
    public status: u8 = 1,
    public suggested_by: Name = EMPTY_NAME,
    public approved_by: Name = EMPTY_NAME,
    public created_at: u32 = 0,
    // LMSR AMM fields (version 2+)
    public version: u8 = 2,           // 1 = legacy order-book, 2 = LMSR AMM
    public b: i64 = 500000000,        // Liquidity parameter (500 * SCALE, where SCALE = 1_000_000)
    public fee_bps: u16 = 100,        // Fee in basis points (100 = 1%)
    public q_yes: i64 = 0,            // YES shares outstanding (fixed-point, scaled by SCALE)
    public q_no: i64 = 0,             // NO shares outstanding (fixed-point, scaled by SCALE)
    public collected_fees: i64 = 0,   // Accumulated fees in internal fixed-point units
    public total_collateral_in: i64 = 0,  // Total collateral deposited (internal units)
    public total_collateral_out: i64 = 0  // Total collateral withdrawn (internal units)
  ) {
    super();
  }

  @primary()
  get by_id(): u64 {
    return this.id;
  }

  set by_id(value: u64) {
    this.id = value;
  }
}
