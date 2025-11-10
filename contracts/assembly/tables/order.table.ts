import { Table, EMPTY_NAME, Name } from "proton-tsc";

@table("orders")
export class OrderTable extends Table {
  constructor(
    public order_id: u64 = 0,
    public account: Name = EMPTY_NAME,
    public isBid: boolean = true,
    public price: u64 = 0, // price in smallest units (e.g., 0.30 XPR -> 3000 if 4 decimals)
    public quantity: u32 = 0
  ) {
    super();
  }

  @primary()
  get by_id(): u64 {
    return this.order_id;
  }

  set by_id(value: u64) {
    this.order_id = value;
  }

  @secondary()
  get by_price(): u64 {
    return this.price;
  }

  set by_price(value: u64) {
    this.price = value;
  }
}
