import { describe, expect, it } from "vitest";
import { combineModes, d20, parseExpr, roll, setRng } from "./dice.ts";

const seq = (vals: number[]) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};

describe("dice", () => {
  it("parses expressions and rejects junk", () => {
    expect(parseExpr("2d6+1d4+3")).toHaveLength(3);
    expect(parseExpr("d20 - 1")).toHaveLength(2);
    expect(parseExpr("hello")).toBeNull();
    expect(parseExpr("1000d6")).toBeNull();
  });
  it("rolls totals and doubles dice on a crit", () => {
    setRng(seq([0.99])); // every die rolls max
    expect(roll("2d6+3")!.total).toBe(15);
    expect(roll("1d8+2", { doubleDice: true })!.total).toBe(18);
  });
  it("keeps the right d20 for advantage and disadvantage", () => {
    setRng(seq([0.1, 0.9])); // 3 then 19
    expect(d20(2, "adv").kept).toBe(19);
    setRng(seq([0.1, 0.9]));
    expect(d20(2, "dis").total).toBe(5);
    setRng(seq([0.99]));
    expect(d20(0, "normal").crit).toBe(true);
  });
  it("cancels advantage with disadvantage", () => {
    expect(combineModes(true, true)).toBe("normal");
    expect(combineModes(true, false)).toBe("adv");
  });
});

describe("damage roll options", () => {
  it("maximize and die floors", async () => {
    const { roll, setRng } = await import("./dice.ts");
    setRng(() => 0); // every die rolls 1
    expect(roll("2d6+3", { minDie: 3 })!.total).toBe(9);
    expect(roll("2d6+3", { maximize: true })!.total).toBe(15);
    expect(roll("2d6+3")!.total).toBe(5);
  });
});
