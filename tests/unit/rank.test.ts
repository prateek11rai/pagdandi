import { describe, expect, it } from "vitest";
import { rrf } from "@/lib/rank";

describe("reciprocal rank fusion", () => {
  it("rewards items both lists agree on", () => {
    const fullText = ["triund", "kedarkantha", "kalsubai"];
    const vector = ["kedarkantha", "brahmatal", "triund"];
    const order = rrf([fullText, vector]).map((r) => r.id);
    expect(order.slice(0, 2)).toEqual(["kedarkantha", "triund"]);
    expect(order).toHaveLength(4);
  });

  it("keeps a single list's order", () => {
    expect(rrf([["a", "b", "c"], []]).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("breaks ties by id so results are stable", () => {
    expect(rrf([["b"], ["a"]]).map((r) => r.id)).toEqual(["a", "b"]);
  });
});
