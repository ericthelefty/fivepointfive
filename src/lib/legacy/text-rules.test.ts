/** Keeps the archived text-reading rules working (they're not used by the app; see text-rules.ts). */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseFile, type Entry } from "../parse.ts";
import { newCharacter } from "../rules.ts";
import { weaponTable } from "../play.ts";
import { classInfos } from "../multiclass.ts";
import {
  classResources, legacySaveProficiencies, legacyUnarmoredDefense, multiclassGrants, proficientWith, skillChoice, spellDamage, spellRoll,
  weaponProficiencyEntry,
} from "./text-rules.ts";

const SRD = join(__dirname, "../../../content/srd-5.2.1");
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : f.endsWith(".md") ? [join(d, f)] : []));
const all: Entry[] = walk(SRD).flatMap((f) => parseFile(readFileSync(f, "utf8"), "srd", f));
const index = new Map(all.map((e) => [e.id, e]));
const byId = (id?: string) => (id ? index.get(id) : undefined);
const cls = (n: string) => byId(`srd:class/${n}`)!;
const spell = (n: string) => all.find((e) => e.type === "Spell" && e.name === n)!;

describe("spell wording", () => {
  it("reads damage, saves, attacks, healing and scaling", () => {
    expect(spellDamage(spell("Magic Missile"), spellRoll(spell("Magic Missile")).damage!, 1, 3)).toBe("1d4+1");
    expect(spellDamage(spell("Fire Bolt"), "1d10", 0, 11)).toBe("3d10");
    expect(spellDamage(spell("Fireball"), "8d6", 5, 9)).toBe("10d6");
    expect(spellRoll(spell("Fireball"))).toMatchObject({ damage: "8d6", save: "Dexterity", perSlot: { dice: "1d6", above: 3 } });
    expect(spellRoll(spell("Fire Bolt")).attack).toBe(true);
    expect(spellRoll(spell("Cure Wounds")).heal).toBe("2d8");
    expect(spellRoll(spell("Bless")).concentration).toBe(true);
  });
});

describe("class wording", () => {
  it("skill choice wordings", () => {
    expect(skillChoice("Choose 2: Athletics, History, or Survival")).toEqual({ count: 2, from: ["Athletics", "History", "Survival"] });
    expect(skillChoice("Choose any 3 skills").count).toBe(3);
    expect(skillChoice(cls("rogue").fields["skill proficiencies"]).count).toBe(4);
  });

  it("weapon proficiency wordings", () => {
    const c = (w: string) => parseFile(`# X\n**Type:** Class\n**Weapon Proficiencies:** ${w}\n`, "t")[0];
    const dagger = { name: "Dagger", category: "Simple Melee Weapons", properties: "Finesse, Light, Thrown" } as never;
    const scimitar = { name: "Scimitar", category: "Martial Melee Weapons", properties: "Finesse, Light" } as never;
    const maul = { name: "Maul", category: "Martial Melee Weapons", properties: "Heavy, Two-Handed" } as never;
    expect(proficientWith(dagger, c("Simple weapons"))).toBe(true);
    expect(proficientWith(maul, c("Simple weapons"))).toBe(false);
    expect(proficientWith(maul, c("Simple and Martial weapons"))).toBe(true);
    const light = c("Simple weapons and Martial weapons that have the Light property");
    expect(proficientWith(scimitar, light)).toBe(true);
    expect(proficientWith(maul, light)).toBe(false);
  });

  it("a numeric class column becomes a tracker that recovers as its feature says", () => {
    const [warden] = parseFile(
      "# Warden\n**Type:** Class\n\n## Warden Features\n\n| Level | Proficiency Bonus | Class Features | Vigils | Martial Arts |\n|---|---|---|---|---|\n| 1 | +2 | Vigil | 2 | 1d6 |\n\n## Level 1: Vigil\nYou regain all expended uses when you finish a Short or Long Rest.\n",
      "t",
    );
    expect(classResources({ ...newCharacter(), level: 1 }, warden)).toEqual([{ key: "Vigils", name: "Vigil", max: 2, recover: "short" }]);
  });

  it("saves and Unarmored Defense from the class text", () => {
    expect(legacySaveProficiencies(cls("fighter"))).toEqual(["Strength", "Constitution"]);
    expect(legacyUnarmoredDefense([{ cls: cls("monk"), level: 1 }], { Dexterity: 3, Wisdom: 2, Constitution: 1 }, false)).toEqual({ ac: 15, note: "Unarmored Defense (10 + Dex + Wis)" });
  });

  it("reads each class's 'As a Multiclass Character' text", () => {
    expect(multiclassGrants(cls("fighter"))).toMatchObject({ martial: true, armor: "Light and Medium armor and Shields" });
    const rogue = multiclassGrants(cls("rogue"));
    expect(rogue.skill?.count).toBe(1);
    expect(rogue.tools).toEqual(["Thieves’ Tools"]);
    const c = { ...newCharacter(), classId: "srd:class/wizard", level: 3, multiclass: [{ classId: "srd:class/fighter", level: 1 }] };
    const longsword = weaponTable(all).find((w) => w.name === "Longsword")!;
    expect(proficientWith(longsword, cls("wizard"))).toBe(false);
    expect(proficientWith(longsword, weaponProficiencyEntry(classInfos(c, byId)))).toBe(true);
  });
});
