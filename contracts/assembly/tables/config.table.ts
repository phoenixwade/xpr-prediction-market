import { Table } from "proton-tsc";

@table("config")
export class ConfigTable extends Table {
  constructor(
    public id: u64 = 0,
    public nextMarketId: u64 = 1,
    public nextOrderId: u64 = 1
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
