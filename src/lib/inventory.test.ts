import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseFile, type Entry } from "./parse.ts";
import { armorTable, derive, newCharacter } from "./rules.ts";
import { weaponTable } from "./play.ts";
import {
  attunedCount, carryingCapacity, catalog, inventoryOf, isActive, magicInfo, parseEquipment, setAttuned, setEquipped, totalWeight, type Item,
} from "./inventory.ts";

const SRD = join(__dirname, "../../content/srd-5.2.1");
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : f.endsWith(".md") ? [join(d, f)] : []));
const all: Entry[] = walk(SRD).flatMap((f) => parseFile(readFileSync(f, "utf8"), "srd", f));
const weapons = weaponTable(all);
const armor = armorTable(all);
const cat = catalog(all, weapons, armor);
const byName = (n: string) => all.find((e) => e.name === n)!;
const info = (it: Item) => (it.ref ? magicInfo(all.find((e) => e.id === it.ref)!, weapons, armor) : undefined);

describe("catalog", () => {
  it("has weapons, armor, gear, tools and magic items with weights where the SRD gives them", () => {
    const get = (n: string) => cat.find((c) => c.name === n)!;
    expect(get("Longsword")).toMatchObject({ kind: "weapon", weight: 3 });
    expect(get("Plate Armor")).toMatchObject({ kind: "armor", weight: 65 });
    expect(get("Shield")).toMatchObject({ kind: "shield", weight: 6 });
    expect(get("Rope").kind).toBe("gear");
    expect(get("Thieves’ Tools").kind).toBe("tool");
    expect(get("Cloak of Protection").kind).toBe("magic");
  });
});

describe("magic items", () => {
  it("reads attunement and base items from the tagline", () => {
    const m = (n: string) => magicInfo(byName(n), weapons, armor);
    expect(m("Cloak of Protection")).toMatchObject({ category: "Wondrous Item", requiresAttunement: true, equippable: true });
    expect(m("Bag of Holding")).toMatchObject({ requiresAttunement: false, equippable: false });
    expect(m("Weapon, +1, +2, or +3").base?.kind).toBe("weapon");
    expect(m("Weapon, +1, +2, or +3").base?.options).toContain("Longsword");
    expect(m("Armor, +1, +2, or +3").base?.options).toContain("Plate Armor");
    expect(m("Armor, +1, +2, or +3").base?.options).not.toContain("Shield");
    expect(m("Shield, +1, +2, or +3").base).toEqual({ kind: "shield", options: ["Shield"] });
    expect(m("Flame Tongue").base?.options.length).toBeGreaterThan(5);
  });
  it("reads `wield-as` for items whose tagline names no weapon", () => {
    const m = (n: string) => magicInfo(byName(n), weapons, armor);
    expect(m("Staff of Striking").base).toEqual({ kind: "weapon", options: ["Quarterstaff"] });
    expect(m("Rod of Lordly Might").base).toEqual({ kind: "weapon", options: ["Mace"] });
    expect(m("Staff of Fire").base).toBeUndefined();
    // and it doesn't come from the description: the same words without the block give no weapon
    const e = byName("Staff of Striking");
    expect(magicInfo({ ...e, effects: [] }, weapons, armor).base).toBeUndefined();
  });
});

describe("starting equipment", () => {
  it("turns the Fighter's option A into items and coins", () => {
    const r = parseEquipment("Chain Mail, Greatsword, Flail, 8 Javelins, Dungeoneer’s Pack, and 4 GP", cat);
    expect(r.coins.gp).toBe(4);
    expect(r.items.map((i) => [i.name, i.qty, i.kind, !!i.equipped])).toEqual([
      ["Chain Mail", 1, "armor", true], ["Greatsword", 1, "weapon", true], ["Flail", 1, "weapon", true],
      ["Javelin", 8, "weapon", true], ["Dungeoneer’s Pack", 1, "gear", false],
    ]);
  });

  it("keeps notes and unknown items", () => {
    const r = parseEquipment("2 Daggers, Arcane Focus (crystal), Musical Instrument of your choice, 2 Pouches, Parchment (10 sheets), 8 GP", cat);
    expect(r.items.map((i) => [i.name, i.qty, i.note || ""])).toEqual([
      ["Dagger", 2, ""], ["Arcane Focus", 1, "crystal"], ["Musical Instrument of your choice", 1, ""], ["Pouch", 2, ""], ["Parchment", 1, "10 sheets"],
    ]);
    expect(r.coins.gp).toBe(8);
  });

  it("every SRD class and background option parses with nothing lost", () => {
    for (const e of all.filter((x) => x.type === "Class" || x.type === "Background")) {
      const t = e.fields["starting equipment"] || e.fields["equipment"];
      const a = t.match(/\(A\)\s*([^;]+)/)![1];
      const r = parseEquipment(a, cat);
      expect(r.items.length, e.name).toBeGreaterThan(0);
      expect(r.coins.gp, e.name).toBeGreaterThan(0);
    }
  });

  it("a new character's inventory comes from class + background choices, merged", () => {
    const c = { ...newCharacter(), classId: "srd:class/fighter", backgroundId: "srd:background/soldier", equipClass: "A", equipBackground: "A" };
    const inv = inventoryOf(c, byName("Fighter"), byName("Soldier"), cat);
    expect(inv.fromStart).toBe(true);
    expect(inv.items.find((i) => i.name === "Chain Mail")?.equipped).toBe(true);
    expect(inv.coins.gp).toBe(4 + 14);
  });

  it("the Soldier's gaming set and the Monk's tool are the ones picked, and gear has weight", () => {
    const c = { ...newCharacter(), classId: "srd:class/monk", backgroundId: "srd:background/soldier", equipClass: "A", equipBackground: "A",
      choices: { "srd:background/soldier#gaming-set": ["Dice"], "srd:class/monk#tool": ["Smith’s Tools"] } };
    const inv = inventoryOf(c, byName("Monk"), byName("Soldier"), cat);
    const names = inv.items.map((i) => i.name);
    expect(names).toContain("Dice");
    expect(names).toContain("Smith’s Tools");
    expect(names.some((n) => /same as above|chosen for/i.test(n))).toBe(false);
    expect(inv.items.find((i) => i.name === "Explorer’s Pack")?.weight).toBe(55);
  });
});

describe("equip, attune and active", () => {
  const items: Item[] = [
    { id: "a", name: "Chain Mail", kind: "armor", base: "Chain Mail", qty: 1, equipped: true },
    { id: "b", name: "Plate Armor", kind: "armor", base: "Plate Armor", qty: 1 },
    { id: "s", name: "Shield", kind: "shield", base: "Shield", qty: 1, equipped: true },
    { id: "c", name: "Cloak of Protection", kind: "magic", ref: "srd:magic-item/cloak-of-protection", qty: 1 },
    { id: "r", name: "Ring of Protection", kind: "magic", ref: "srd:magic-item/ring-of-protection", qty: 1 },
    { id: "w", name: "Wand of Magic Missiles", kind: "magic", ref: "srd:magic-item/wand-of-magic-missiles", qty: 1 },
    { id: "h", name: "Bag of Holding", kind: "magic", ref: "srd:magic-item/bag-of-holding", qty: 1 },
  ];

  it("equipping armor takes off the armor already worn, but leaves the shield", () => {
    const next = setEquipped(items, "b", true, info);
    expect(next.filter((i) => i.equipped).map((i) => i.id)).toEqual(["b", "s"]);
  });

  it("an attunement item is active only when attuned and worn; a bag is active when carried", () => {
    const cloak = items.find((i) => i.id === "c")!;
    expect(isActive(cloak, info(cloak))).toBe(false);
    expect(isActive({ ...cloak, attuned: true }, info(cloak))).toBe(false);
    expect(isActive({ ...cloak, attuned: true, equipped: true }, info(cloak))).toBe(true);
    const bag = items.find((i) => i.id === "h")!;
    expect(isActive(bag, info(bag))).toBe(true);
  });

  it("refuses a fourth attunement", () => {
    let list = items.map((i) => (["c", "r", "w"].includes(i.id) ? { ...i, attuned: true } : i));
    expect(attunedCount(list)).toBe(3);
    const r = setAttuned(list, "h", true);
    expect(r.refused).toMatch(/at most 3/);
    list = setAttuned(list, "c", false).items;
    expect(setAttuned(list, "h", true).refused).toBeUndefined();
  });

  it("weight and carrying capacity, with fifty coins to the pound", () => {
    expect(totalWeight([{ id: "x", name: "Javelin", kind: "weapon", qty: 8, weight: 2 }], { cp: 0, sp: 0, ep: 0, gp: 100, pp: 0 })).toBe(18);
    expect(carryingCapacity(15)).toBe(225);
    expect(carryingCapacity(15, "Small")).toBe(225);
    expect(carryingCapacity(10, "Tiny")).toBe(75);
  });
});

describe("AC from equipped items", () => {
  const base = { ...newCharacter(), method: "manual" as const, base: { Strength: 15, Dexterity: 14, Constitution: 14, Intelligence: 10, Wisdom: 10, Charisma: 10 }, classId: "srd:class/fighter" };
  const lib = (items: Item[]) => ({ cls: byName("Fighter"), armor, items });

  it("Chain Mail and a Shield: 16 + 2", () => {
    const d = derive(base, lib([
      { id: "a", name: "Chain Mail", kind: "armor", base: "Chain Mail", qty: 1, equipped: true },
      { id: "s", name: "Shield", kind: "shield", base: "Shield", qty: 1, equipped: true },
    ]));
    expect(d.ac).toBe(18);
  });

  it("unequipped armor doesn't count; a magic armor uses its base", () => {
    expect(derive(base, lib([{ id: "a", name: "Chain Mail", kind: "armor", base: "Chain Mail", qty: 1 }])).ac).toBe(10 + 2);
    const d = derive(base, lib([{ id: "m", name: "+1 Studded Leather", kind: "magic", ref: "srd:magic-item/armor-1-2-or-3", base: "Studded Leather Armor", qty: 1, equipped: true }]));
    expect(d.ac).toBe(12 + 2);
    expect(d.acNote).toBe("+1 Studded Leather");
  });
});

describe("weapons from content packs", () => {
  const pack = parseFile(`# Laser Pistol
**Type:** Weapon
*Martial Ranged Weapon (Futuristic)*
**Damage:** 3d6 Radiant
**Properties:** Ammunition (Range 40/120; Energy Cell), Reload (50 shots)
**Mastery:** Vex
**Weight:** 2 lb.
**Cost:** —

# Longsword
**Type:** Weapon
**Category:** Martial Melee Weapons
**Damage:** 1d10 Slashing
**Properties:** Versatile (1d12)
**Mastery:** Sap
**Weight:** 3 lb.
**Cost:** 15 GP
`, "home", "weapons.md");
  const all2 = [...all, ...pack];
  const table = weaponTable(all2);
  it("adds pack weapons to the weapons table and the inventory catalog", () => {
    const laser = table.find((w) => w.name === "Laser Pistol")!;
    expect(laser).toMatchObject({ damage: "3d6 Radiant", category: "Martial Ranged Weapon", mastery: "Vex", weight: "2 lb.", ref: "home:weapon/laser-pistol" });
    const hit = catalog(all2, table, armor).find((c) => c.name === "Laser Pistol")!;
    expect(hit).toMatchObject({ kind: "weapon", base: "Laser Pistol", ref: "home:weapon/laser-pistol", weight: 2 });
  });
  it("a pack weapon with an SRD weapon's name replaces that row", () => {
    expect(table.filter((w) => w.name === "Longsword")).toEqual([expect.objectContaining({ damage: "1d10 Slashing", properties: "Versatile (1d12)", category: "Martial Melee Weapons" })]);
    expect(weaponTable(all).find((w) => w.name === "Longsword")!.damage).toBe("1d8 Slashing");
  });
});
