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

import core from "../../public/data/srd-spells.json";
import { spellDamage, spellRoll } from "./play.ts";
import type { Entry } from "./parse.ts";
describe("spell rolls", () => {
  const S = core as unknown as Entry[];
  const g = (n: string) => S.find((s) => s.name === n)!;
  it("reads damage, saves, attacks and scaling", () => {
    expect(spellDamage(g("Magic Missile"), spellRoll(g("Magic Missile")).damage!, 1, 3)).toBe("1d4+1");
    expect(spellDamage(g("Fire Bolt"), "1d10", 0, 11)).toBe("3d10");
    expect(spellDamage(g("Fireball"), "8d6", 5, 9)).toBe("10d6");
    expect(spellRoll(g("Fireball")).save).toBe("Dexterity");
    expect(spellRoll(g("Fire Bolt")).attack).toBe(true);
    expect(spellRoll(g("Cure Wounds")).heal).toBe("2d8");
    expect(spellRoll(g("Bless")).concentration).toBe(true);
  });
});
