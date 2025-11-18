import { Table, EMPTY_NAME, Name, TimePointSec } from "proton-tsc";

@table("positionsv2")
export class PositionV2Table extends Table {
  constructor(
    public composite_key: u64 = 0, // (account.value << 8) | outcome_id
    public account: Name = EMPTY_NAME,
    public outcome_id: u8 = 0,
    public shares: i64 = 0,
    public updated_at: TimePointSec = new TimePointSec(0)
  ) {
    super();
  }

  @primary()
  get by_key(): u64 {
    return this.composite_key;
  }

  set by_key(value: u64) {
    this.composite_key = value;
  }

  @secondary()
  get by_account(): u64 {
    return this.account.N;
  }

  set by_account(value: u64) {
    this.account = Name.fromU64(value);
  }
}
