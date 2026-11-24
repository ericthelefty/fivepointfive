import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseFile, type Entry } from "./parse.ts";
import { parseCreature } from "./creature.ts";
import { combatTables } from "./encounter.ts";
import { applyDraft, coinsText, cpText, hiddenFindOf, linesOf, lootFromMonsters, parseCoins, parseGear, shareOf, sumCoins, coinsCp } from "./loot.ts";

const SRD = join(__dirname, "../../content/srd-5.2.1");
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : f.endsWith(".md") ? [join(d, f)] : []));
const all: Entry[] = walk(SRD).flatMap((f) => parseFile(readFileSync(f, "utf8"), "srd", f));
const creature = (name: string) => parseCreature(all.find((e) => e.type === "Creature" && e.name === name)!);
const tables = combatTables(all);

describe("loot from defeated monsters", () => {
  it("reads a monster's Gear entry", () => {
    expect(creature("Bandit").gear).toEqual(["Leather Armor", "Light Crossbow", "Scimitar"]);
    expect(parseGear("Javelins (6)")).toEqual({ name: "Javelins", qty: 6 });
  });

  it("groups copies, prices them from the SRD tables and puts the most valuable first", () => {
    const fallen = ["Bandit Captain", "Bandit", "Bandit", "Bandit"].map((n) => creature(n));
    const loot = lootFromMonsters(fallen, tables);
    const by = Object.fromEntries(loot.map((g) => [g.name, g]));
    expect(loot[0].name).toBe("Pistol");
    expect(cpText(by["Pistol"].valueCp)).toBe("250 GP");
    expect(by["Scimitar"].qty).toBe(4);
    expect(by["Scimitar"].sources).toEqual(["Bandit Captain", "Bandit", "Bandit", "Bandit"]);
    expect(by["Leather Armor"].detail).toMatch(/^AC 11/);
    expect(by["Scimitar"].detail).toMatch(/1d6 Slashing/);
    expect(by["Scimitar"].item.kind).toBe("weapon");
    expect(by["Scimitar"].item.equipped).toBeUndefined();
  });

  it("turns plural gear with a count into that many copies of the item", () => {
    const loot = lootFromMonsters([creature("Bugbear Stalker")], tables);
    const jav = loot.find((g) => g.name === "Javelin")!;
    expect(jav.qty).toBe(6);
    expect(cpText(jav.valueCp)).toBe("5 SP");
  });

  it("applies the GM's edits and sends one line per copy", () => {
    const loot = lootFromMonsters(["Bandit", "Bandit"].map((n) => creature(n)), tables);
    const reviewed = applyDraft(loot, { removed: ["leather armor"], qty: { "light crossbow": 1 } });
    expect(reviewed.find((g) => g.key === "leather armor")!.removed).toBe(true);
    const lines = linesOf(reviewed);
    expect(lines.map((l) => l.name)).toEqual(["Light Crossbow", "Scimitar", "Scimitar"]);
    expect(new Set(lines.map((l) => l.item.id)).size).toBe(3);
  });
});

describe("coins and hidden finds", () => {
  it("reads coins the GM types", () => {
    expect(parseCoins("10 GP")).toMatchObject({ gp: 10 });
    expect(parseCoins("10 gp 5 sp")).toMatchObject({ gp: 10, sp: 5 });
    expect(parseCoins("Ring of Protection")).toBeUndefined();
    expect(parseCoins("10")).toBeUndefined();
  });
  it("adds, writes and splits coins", () => {
    const pot = sumCoins([{ gp: 6, sp: 14 }, { sp: 4 }, { sp: 4 }, { sp: 4 }, { gp: 10 }]);
    expect(coinsText(pot)).toBe("16 GP 26 SP");
    expect(coinsCp(pot)).toBe(1860);
    expect(shareOf(1860, 3)).toEqual({ each: { cp: 0, sp: 2, ep: 0, gp: 6, pp: 0 }, leftCp: 0 });
    expect(shareOf(1862, 3).leftCp).toBe(2);
  });
  it("turns a hidden find into coins or a priced item", () => {
    expect(hiddenFindOf("10 GP", "Bandit Captain", tables)).toEqual({ kind: "coins", coins: { cp: 0, sp: 0, ep: 0, gp: 10, pp: 0 } });
    const ring = hiddenFindOf("Ring of Protection", "Bandit Captain", tables, () => "rare");
    expect(ring.kind === "item" && ring.line.valueCp).toBe(400000);
    const note = hiddenFindOf("A coded letter", "Bandit Captain", tables);
    expect(note.kind === "item" && note.line.item.kind).toBe("custom");
  });
});

describe("+1, +2 or +3 items", async () => {
  const { itemTitle, plusChoices, plusOf } = await import("./inventory.ts");
  it("take their bonus from the name and go by their base weapon", () => {
    const entry = "Weapon, +1, +2, or +3";
    expect(plusChoices(entry)).toEqual([1, 2, 3]);
    const it0 = { id: "x", name: entry, kind: "magic" as const, qty: 1, base: "Longsword" };
    expect(plusOf(it0, entry)).toBeUndefined();
    expect(itemTitle(it0, undefined, entry)).toBe(entry);
    const it2 = { ...it0, name: "Weapon, +2" };
    expect(plusOf(it2, entry)).toBe(2);
    expect(itemTitle(it2, undefined, entry)).toBe("Longsword, +2");
  });
});
