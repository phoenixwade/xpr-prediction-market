import { Table, EMPTY_NAME, Name, TimePointSec } from "proton-tsc";

@table("markets")
export class MarketTable extends Table {
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
    public created_at: u32 = 0
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
