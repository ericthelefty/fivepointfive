import { describe, expect, it } from "vitest";
import { attackFor, unarmedStrike } from "./play.ts";
import type { Derived } from "./rules.ts";

const d = { pb: 3, mods: { Strength: 1, Dexterity: 3, Constitution: 2, Intelligence: 0, Wisdom: 3, Charisma: -1 } } as unknown as Derived;
const staff = { name: "Quarterstaff", damage: "1d6 Bludgeoning", properties: "Versatile (1d8)", mastery: "Topple", category: "Simple Melee Weapons" };

describe("attacks with Effects", () => {
  it("Shillelagh: spellcasting ability for hit and damage, d10 die, Force as an option", () => {
    const plain = attackFor(staff, d, true);
    expect([plain.toHit, plain.damage, plain.versatile]).toEqual([4, "1d6+1", "1d8+1"]);
    const sh = attackFor(staff, d, true, { abilities: ["Wisdom"], die: { die: "1d10", ifHigher: false }, types: ["Force"] });
    expect([sh.ability, sh.toHit, sh.damage, sh.type, sh.versatile]).toEqual(["Wisdom", 6, "1d10+3", "Bludgeoning or Force", undefined]);
  });
  it("Martial Arts: Dexterity and the bigger die, Unarmed Strike gets the die", () => {
    const ma = attackFor(staff, d, true, { abilities: ["Dexterity"], die: { die: "1d8", ifHigher: true } });
    expect([ma.toHit, ma.damage, ma.versatile]).toEqual([6, "1d8+3", undefined]);
    const low = attackFor(staff, d, true, { abilities: ["Dexterity"], die: { die: "1d6", ifHigher: true } });
    expect([low.damage, low.versatile]).toEqual(["1d6+3", "1d8+3"]);
    const u = unarmedStrike(d, { abilities: ["Dexterity"], die: { die: "1d6", ifHigher: true } });
    expect([u.toHit, u.damage]).toEqual([6, "1d6+3"]);
    expect(unarmedStrike(d).damage).toBe("2");
  });
});
