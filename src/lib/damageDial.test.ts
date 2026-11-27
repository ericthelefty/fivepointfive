import { describe, expect, it } from "vitest";
import { damageChoices, damageName, damageTypeOf } from "./damageDial.ts";

describe("damageChoices", () => {
  it("lists the types a roll lets the player choose between, in order", () => {
    expect(damageChoices("Bludgeoning or Necrotic or Psychic or Radiant")).toEqual(["bludgeoning", "necrotic", "psychic", "radiant"]);
    expect(damageChoices("Acid, Cold, Fire, Lightning, Poison, or Thunder")).toEqual(["acid", "cold", "fire", "lightning", "poison", "thunder"]);
  });
  it("ignores extra damage after ', plus'", () => {
    expect(damageChoices("Slashing or Radiant, plus 1d6 Necrotic")).toEqual(["slashing", "radiant"]);
    expect(damageChoices("Slashing, plus 1d6 Necrotic or Radiant")).toEqual([]);
  });
  it("is empty when there's no choice", () => {
    expect(damageChoices("Fire")).toEqual([]);
    expect(damageChoices("")).toEqual([]);
  });
});

describe("damageTypeOf and damageName", () => {
  it("finds the first type mentioned and names it as the SRD does", () => {
    expect(damageTypeOf("Slashing, plus 2d6 Fire")).toBe("slashing");
    expect(damageName("radiant")).toBe("Radiant");
  });
});
