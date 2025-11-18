import { Table, Name, EMPTY_NAME } from "proton-tsc";

@table("config")
export class ConfigTable extends Table {
  constructor(
    public id: u64 = 0,
    public nextMarketId: u64 = 1,
    public nextOrderId: u64 = 1,
    public admin_account: Name = EMPTY_NAME,
    public resolver_account: Name = EMPTY_NAME,
    public approver_account: Name = EMPTY_NAME,
    public trade_fee_bps: u16 = 0,
    public resolution_fee_bps: u16 = 0,
    public min_order_amount: i64 = 100000,
    public max_order_amount: i64 = 1000000000000,
    public max_outcomes_per_market: u8 = 10,
    public require_approval: bool = false,
    public paused: bool = false,
    public version: u8 = 1,
    public created_at: u32 = 0,
    public updated_at: u32 = 0
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
