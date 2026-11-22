import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseFile, type Entry } from "./parse.ts";
import { armorTable, derive, newCharacter, type Character } from "./rules.ts";
import { classInfos } from "./multiclass.ts";
import { computeModif } from "./modif.ts";
import { applyForm, formEligible, parseCreature } from "./creature.ts";

const SRD = join(__dirname, "../../content/srd-5.2.1");
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : f.endsWith(".md") ? [join(d, f)] : []));
const all: Entry[] = walk(SRD).flatMap((f) => parseFile(readFileSync(f, "utf8"), "srd", f));
const index = new Map(all.map((e) => [e.id, e]));
const byId = (id?: string) => (id ? index.get(id) : undefined);
const armor = armorTable(all);

const druid = (level: number, active = false): Character => ({
  ...newCharacter(),
  name: "Fen", level,
  classId: "srd:class/druid", subclassId: "srd:subclass/circle-of-the-land",
  speciesId: "srd:species/human", backgroundId: "srd:background/sage",
  base: { Strength: 8, Dexterity: 14, Constitution: 13, Intelligence: 10, Wisdom: 15, Charisma: 12 },
  bonus: { Wisdom: 2, Constitution: 1 },
  classSkills: ["Perception", "Nature"],
  ...(active ? ({ play: { active: [{ key: "wild-shape", name: "Wild Shape", kind: "toggle", minutes: 60, since: "" }] } } as Partial<Character>) : {}),
});
const run = (c: Character) => {
  const infos = classInfos(c, byId);
  const fx = computeModif({ c, classes: infos, species: byId(c.speciesId), background: byId(c.backgroundId), entries: all, byId, active: (c.play?.active || []).map((x) => ({ key: x.key })) });
  const d = derive(c, { cls: byId(c.classId), species: byId(c.speciesId), background: byId(c.backgroundId), armor, classes: infos, modif: fx });
  return { fx, d };
};

describe("Wild Shape forms", () => {
  it("reads the Beast Shapes table for known forms, max CR and Fly Speed at each level", () => {
    const at = (L: number) => run(druid(L)).fx.toggles.find((t) => t.form)!.form!;
    expect(at(2)).toMatchObject({ type: "beast", crMax: 0.25, fly: false, known: 4, tempHp: 2, blocksSpells: true });
    expect(at(4)).toMatchObject({ crMax: 0.5, known: 6, tempHp: 4 });
    expect(at(8)).toMatchObject({ crMax: 1, fly: true, known: 8 });
    expect(at(18).blocksSpells).toBe(false); // Beast Spells
  });

  it("picks eligible beasts and swaps your physical numbers for the form's", () => {
    const beasts = all.filter((e) => e.type === "Creature").map(parseCreature);
    const spec = run(druid(2)).fx.toggles.find((t) => t.form)!.form!;
    const ok = beasts.filter((b) => formEligible(b, spec)).map((b) => b.name);
    expect(ok).toContain("Wolf");
    expect(ok).not.toContain("Brown Bear"); // CR 1
    expect(ok).not.toContain("Swarm of Rats");
    expect(ok.some((n) => /Owl|Hawk|Bat/.test(n))).toBe(false); // Fly Speed
    const wolf = beasts.find((b) => b.name === "Wolf")!;
    expect(wolf.actions.find((a) => a.name === "Bite")).toMatchObject({ toHit: 4, damage: [{ expr: "1d6+2", type: "Piercing" }] });
    const { d } = run(druid(2));
    const f = applyForm(d, wolf, spec);
    expect(f.scores.Strength).toBe(14);
    expect(f.scores.Wisdom).toBe(d.scores.Wisdom);
    expect(f.ac).toBe(12);
    expect(f.speed).toBe(40);
    expect(f.hp).toBe(d.hp);
    // the higher of yours (Wisdom 17, proficient: +5) or the wolf's (+5) for Perception; the wolf's Stealth +4 beats yours
    expect(f.skills.Perception.value).toBe(Math.max(d.skills.Perception.value, 5));
    expect(f.skills.Stealth.value).toBe(Math.max(d.skills.Stealth.value - d.mods.Dexterity + 2, 4));
  });
});

describe("Summoned creatures", () => {
  it("fills a spirit's formulas with the spell's level and your numbers", async () => {
    const { evalStat, fillFormulas, parseStatBlockMd, statBlockMd } = await import("./creature.ts");
    const x = { level: 5, spellAttack: 7, spellDc: 15, pb: 3, mods: { Wisdom: 3 }, classLevels: { ranger: 7 }, variant: "Land" };
    expect(evalStat("20 (Air only) or 30 (Land and Water only) + 5 for each spell level above 2", x)).toBe(45);
    expect(evalStat(fillFormulas("13 plus your Wisdom modifier", x), x)).toBe(16);
    expect(evalStat(fillFormulas("5 plus five times your Ranger level", x), x)).toBe(40);
    const dragon = byId("srd:spell/summon-dragon")!;
    const sb = statBlockMd(dragon, "draconic-spirit")!;
    expect(sb).toBeDefined();
    const cr = parseStatBlockMd("d", sb.name, sb.md, { ...x, variant: undefined });
    expect(cr.ac).toBe(19); // 14 + the spell’s level
    expect(cr.hp).toBe(50); // 50 + 10 for each level above 5
    expect(cr.actions.some((a) => a.toHit === 7)).toBe(true);
  });

  it("reads Find Familiar's summon as a pick from CR 0 Beasts", () => {
    const ff = byId("srd:spell/find-familiar")!;
    expect(ff.effects?.some((f) => /summon:/.test(f.yaml))).toBe(true);
  });
});

describe("Pact of the Chain", () => {
  const warlock = (level: number, invocations: string[]): Character => ({
    ...newCharacter(), name: "Vex", level,
    classId: "srd:class/warlock", subclassId: "srd:subclass/fiend-patron",
    speciesId: "srd:species/human", backgroundId: "srd:background/sage",
    base: { Strength: 8, Dexterity: 14, Constitution: 13, Intelligence: 10, Wisdom: 12, Charisma: 15 }, bonus: { Charisma: 2 },
    choices: { "srd:class/warlock#invocations": invocations },
  });
  it("adds the special familiar forms and Find Familiar without a slot", () => {
    const { fx } = run(warlock(3, ["Pact of the Chain"]));
    const opt = fx.summonOptions.find((o) => o.for === "srd:spell/find-familiar")!;
    expect(opt.add).toEqual(expect.arrayContaining(["srd:creature/imp", "srd:creature/pseudodragon", "srd:creature/sphinx-of-wonder", "srd:creature/venomous-snake"]));
    expect(fx.grantedSpells.some((g) => g.spell.id === "srd:spell/find-familiar" && g.atWill)).toBe(true);
  });
  it("Investment of the Chain Master adds a speed, your save DC and a damage type", () => {
    const { fx } = run(warlock(5, ["Pact of the Chain", "Investment of the Chain Master"]));
    const inv = fx.summonOptions.find((o) => o.speed)!;
    expect(inv).toMatchObject({ for: "srd:spell/find-familiar", speed: { kinds: ["fly", "swim"], value: 40 }, saveDc: true, damageType: { choose: ["necrotic", "radiant"] } });
  });
});

describe("Pick-and-spend features", () => {
  const base = (cls: string, sub: string | undefined, level: number): Character => ({
    ...newCharacter(), name: "T", level, classId: `srd:class/${cls}`, subclassId: sub,
    speciesId: "srd:species/human", backgroundId: "srd:background/sage",
    base: { Strength: 15, Dexterity: 16, Constitution: 13, Intelligence: 10, Wisdom: 12, Charisma: 14 }, bonus: {},
  });
  it("Sneak Attack offers its dice, and Cunning Strike follows it with effects that spend dice", () => {
    const { fx } = run(base("rogue", "srd:subclass/thief", 14));
    const sa = fx.triggers.find((t) => t.id === "sneak-attack")!;
    expect(sa.damage).toEqual([{ dice: "7d6", type: "weapon" }]);
    const cs = fx.triggers.find((t) => t.id === "cunning-strike")!;
    expect(cs.follows).toBe("sneak-attack");
    expect(cs.pick).toBe(2); // Improved Cunning Strike
    expect(cs.options!.map((o) => o.label)).toEqual(expect.arrayContaining(["Poison", "Trip", "Withdraw", "Daze", "Knock Out"]));
    expect(cs.options!.find((o) => o.id === "knock-out")!.diceCost).toBe(6);
    expect(cs.dc).toBe(8 + 3 + 5);
  });
  it("Lay on Hands lets you choose how much to spend, and heals that much", () => {
    const { fx } = run(base("paladin", "srd:subclass/oath-of-devotion", 5));
    const loh = fx.actions.find((a) => a.id === "lay-on-hands")!;
    expect(loh.optionCosts![0]).toMatchObject({ any: true, min: 1 });
    expect(loh.optionHeals![0]).toBe("cost.amount");
  });
});

describe("spell rows like D&D Beyond", () => {
  const plan = async (id: string, slot = 1) => (await import("./modif.ts")).spellPlan(byId(id)!, { slot, charLevel: 5, spell: { mod: 4, dc: 15, attack: 7 } })!;
  it("reads area, conditions and a kind for spells that roll nothing", async () => {
    const bh = await plan("srd:spell/burning-hands");
    expect(bh.area).toBe("15 ft. cone");
    expect((await plan("srd:spell/burning-hands", 3)).damage[0].dice).toBe("5d6");
    expect((await plan("srd:spell/charm-person")).conditions).toContain("Charmed");
    const dm = await plan("srd:spell/detect-magic");
    expect(dm.conditions).toEqual([]);
    expect(dm.kind).toBeTruthy();
  });
});
