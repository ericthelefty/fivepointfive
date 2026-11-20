import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseFile, type Entry } from "./parse.ts";
import { armorTable, derive, newCharacter, type Character } from "./rules.ts";
import { proficientWith, weaponTable } from "./play.ts";
import {
  addClass, casterKind, classInfos, classLabel, hitDicePools, hitPoints, multiclassGrants, patchClass, prerequisiteProblems,
  removeClass, spellSlots, startingLevel, weaponProficiencyEntry,
} from "./multiclass.ts";

const SRD = join(__dirname, "../../content/srd-5.2.1");
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : f.endsWith(".md") ? [join(d, f)] : []));
const all: Entry[] = walk(SRD).flatMap((f) => parseFile(readFileSync(f, "utf8"), "srd", f));
const index = new Map(all.map((e) => [e.id, e]));
const byId = (id?: string) => (id ? index.get(id) : undefined);
const cls = (n: string) => `srd:class/${n}`;
const char = (start: string, total: number, extras: [string, number][] = [], scores: Partial<Record<string, number>> = {}): Character => ({
  ...newCharacter(),
  method: "manual",
  base: { Strength: 14, Dexterity: 14, Constitution: 14, Intelligence: 14, Wisdom: 14, Charisma: 14, ...scores },
  classId: cls(start),
  level: total,
  multiclass: extras.map(([k, l]) => ({ classId: cls(k), level: l })),
});

describe("levels", () => {
  it("total level is the sum; the starting class gets the rest", () => {
    const c = char("fighter", 5, [["wizard", 2]]);
    expect(startingLevel(c)).toBe(3);
    expect(classLabel(classInfos(c, byId))).toBe("Fighter 3 / Wizard 2");
  });

  it("changing a class's level keeps the total in step and never passes 20", () => {
    const c = char("fighter", 5, [["wizard", 2]]);
    expect(patchClass(c, 1, { level: 4 }).level).toBe(7);
    expect(patchClass(c, 0, { level: 6 }).level).toBe(8);
    const big = char("fighter", 19, [["wizard", 2]]);
    expect(patchClass(big, 1, { level: 9 }).level).toBe(20);
    expect(addClass(char("fighter", 20), cls("rogue"))).toEqual({});
    expect(addClass(char("fighter", 4), cls("rogue")).level).toBe(5);
    expect(removeClass(c, 1)).toEqual({ multiclass: [], level: 3 });
  });
});

describe("prerequisites", () => {
  it("needs 13 in the primary ability of every class; 'or' means either", () => {
    const fighterWizard = [byId(cls("fighter"))!, byId(cls("wizard"))!];
    expect(prerequisiteProblems(fighterWizard, { Strength: 8, Dexterity: 13, Intelligence: 13 })).toEqual([]);
    expect(prerequisiteProblems(fighterWizard, { Strength: 8, Dexterity: 13, Intelligence: 10 })).toEqual(["Wizard needs Intelligence 13 or higher (you have Intelligence 10)."]);
    const monk = [byId(cls("monk"))!, byId(cls("rogue"))!];
    expect(prerequisiteProblems(monk, { Dexterity: 15, Wisdom: 12 })[0]).toMatch(/Monk needs Dexterity and Wisdom/);
    expect(prerequisiteProblems([byId(cls("wizard"))!], { Intelligence: 3 })).toEqual([]);
  });
});

describe("what a multiclass grants", () => {
  it("reads each class's 'As a Multiclass Character' text", () => {
    expect(multiclassGrants(byId(cls("fighter"))!)).toMatchObject({ martial: true, armor: "Light and Medium armor and Shields" });
    expect(multiclassGrants(byId(cls("wizard"))!)).toMatchObject({ martial: false, skill: undefined });
    const rogue = multiclassGrants(byId(cls("rogue"))!);
    expect(rogue.skill?.count).toBe(1);
    expect(rogue.skill?.from).toContain("Stealth");
    expect(rogue.skill?.from).not.toContain("Arcana");
    expect(rogue.tools).toEqual(["Thieves’ Tools"]);
    expect(multiclassGrants(byId(cls("bard"))!).skill?.from.length).toBe(18);
    expect(multiclassGrants(byId(cls("ranger"))!).skill?.from).toContain("Survival");
  });

  it("a Wizard who takes a Fighter level is proficient with martial weapons", () => {
    const infos = classInfos(char("wizard", 3, [["fighter", 1]]), byId);
    const longsword = weaponTable(all).find((w) => w.name === "Longsword")!;
    expect(proficientWith(longsword, byId(cls("wizard")))).toBe(false);
    expect(proficientWith(longsword, weaponProficiencyEntry(infos))).toBe(true);
  });
});

describe("spellcasting", () => {
  it("knows full, half and pact casters from their tables", () => {
    expect(["wizard", "paladin", "warlock", "fighter"].map((k) => casterKind(byId(cls(k))!))).toEqual(["full", "half", "pact", null]);
  });

  it("one Spellcasting class uses its own table", () => {
    const slots = spellSlots(classInfos(char("fighter", 5, [["wizard", 2]]), byId), all);
    expect(slots).toEqual([{ level: 1, max: 3, pact: false }]);
  });

  it("the SRD's own example: Ranger 4 / Sorcerer 3 counts as level 5 (4, 3, 2 slots)", () => {
    const slots = spellSlots(classInfos(char("ranger", 7, [["sorcerer", 3]]), byId), all);
    expect(slots.map((s) => s.max)).toEqual([4, 3, 2]);
  });

  it("Pact Magic slots stay separate", () => {
    const slots = spellSlots(classInfos(char("warlock", 5, [["sorcerer", 2]]), byId), all);
    expect(slots).toEqual([{ level: 1, max: 3, pact: false }, { level: 2, max: 2, pact: true }]);
  });
});

describe("hit points and hit dice", () => {
  it("full die at level 1 from the starting class, then averages; dice pooled by size", () => {
    const infos = classInfos(char("fighter", 5, [["wizard", 2]]), byId);
    expect(hitPoints(infos, 2)).toBe(10 + 2 + 2 * (6 + 2) + 2 * (4 + 2));
    expect(hitDicePools(infos)).toEqual([{ die: 10, count: 3 }, { die: 6, count: 2 }]);
    expect(hitDicePools(classInfos(char("fighter", 10, [["paladin", 5]]), byId))).toEqual([{ die: 10, count: 10 }]);
  });

  it("derive uses every class for HP, and a multiclass skill counts", () => {
    const c = char("fighter", 5, [["rogue", 2]]);
    c.multiclass![0].skills = ["Stealth"];
    const infos = classInfos(c, byId);
    const d = derive(c, { cls: byId(c.classId), armor: armorTable(all), classes: infos });
    expect(d.hp).toBe(hitPoints(infos, 2));
    expect(d.pb).toBe(3);
    expect(d.skills.Stealth.prof).toBe(true);
  });
});
