import { Table, EMPTY_NAME, Name } from "proton-tsc";

@table("orders")
export class OrderTable extends Table {
  constructor(
    public order_id: u64 = 0,
    public account: Name = EMPTY_NAME,
    public outcome_id: u8 = 0, // which outcome this order is for (0=Yes for binary, 1=No for binary)
    public isBid: boolean = true,
    public price: u64 = 0, // price in smallest units (e.g., 0.30 XUSDC -> 300000 if 6 decimals)
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
