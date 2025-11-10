import { Table, EMPTY_NAME, Name, TimePointSec } from "proton-tsc";

@table("markets")
export class MarketTable extends Table {
  constructor(
    public id: u64 = 0,
    public question: string = "",
    public category: string = "",
    public expire: TimePointSec = new TimePointSec(0),
    public resolved: boolean = false,
    public outcome: u8 = 2 // 2 = unresolved, 1 = Yes, 0 = No
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
