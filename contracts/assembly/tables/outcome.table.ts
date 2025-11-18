import { Table } from "proton-tsc";

@table("outcomes")
export class OutcomeTable extends Table {
  constructor(
    public outcome_id: u8 = 0,
    public name: string = "",
    public display_order: u8 = 0
  ) {
    super();
  }

  @primary()
  get by_id(): u64 {
    return this.outcome_id;
  }

  set by_id(value: u64) {
    this.outcome_id = value;
  }
}
