import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseFile, type Entry } from "./parse.ts";
import { parseCreature } from "./creature.ts";
import { combatTables } from "./encounter.ts";
import { applyDraft, cpText, linesOf, lootFromMonsters, parseGear } from "./loot.ts";

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
