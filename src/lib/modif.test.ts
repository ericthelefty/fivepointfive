import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { features, parseFile, type Entry } from "./parse.ts";
import { armorTable, derive, newCharacter, traits, intro, type Character } from "./rules.ts";
import { classInfos } from "./multiclass.ts";
import { advantageFor, computeModif, setSlotFeat, evalAmount, evalNumber, readBlocks, treatRoll, type Env, type ModifResult } from "./modif.ts";

const SRD = join(__dirname, "../../content/srd-5.2.1");
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : f.endsWith(".md") ? [join(d, f)] : []));
const all: Entry[] = walk(SRD).flatMap((f) => parseFile(readFileSync(f, "utf8"), "srd", f));
const index = new Map(all.map((e) => [e.id, e]));
const byId = (id?: string) => (id ? index.get(id) : undefined);
const armor = armorTable(all);

/** Fighter (Champion) / Human / Soldier, standard array, +2 Str +1 Con. */
const champion = (level: number, extra: Partial<Character> = {}): Character => ({
  ...newCharacter(),
  name: "Brakka",
  level,
  classId: "srd:class/fighter",
  subclassId: "srd:subclass/champion",
  speciesId: "srd:species/human",
  backgroundId: "srd:background/soldier",
  base: { Strength: 15, Dexterity: 13, Constitution: 14, Intelligence: 8, Wisdom: 12, Charisma: 10 },
  bonus: { Strength: 2, Constitution: 1 },
  classSkills: ["Perception", "Survival"],
  extraSkills: ["Insight"],
  equipClass: "A",
  choices: {
    "srd:feat/skilled#skilled": ["Acrobatics", "History", "Smith’s Tools"],
    "srd:background/soldier#gaming-set": ["Dice"],
  },
  ...extra,
});

function sheet(c: Character): { fx: ModifResult; d: ReturnType<typeof derive> } {
  const infos = classInfos(c, byId);
  const fx = computeModif({ c, classes: infos, species: byId(c.speciesId), background: byId(c.backgroundId), entries: all, byId });
  const d = derive(c, { cls: byId(c.classId), species: byId(c.speciesId), background: byId(c.backgroundId), armor, classes: infos, modif: fx });
  return { fx, d };
}

describe("Modif blocks in pack files", () => {
  it("every Effects block in the SRD pack reads cleanly", () => {
    const withFx = all.filter((e) => e.effects?.length);
    const feats = all.filter((e) => e.type === "Feat");
    expect(feats.every((f) => f.effects?.length)).toBe(true); // every SRD feat
    expect(withFx.filter((e) => e.type !== "Feat").map((e) => e.name).sort()).toEqual(["Champion", "Fighter", "Human", "Soldier"]);
    for (const e of withFx) for (const fx of e.effects!) expect(readBlocks(fx.yaml).problems, `${e.name} / ${fx.feature}`).toEqual([]);
  });

  it("Effects are data: they leave the rules text and attach to their heading", () => {
    const fighter = byId("srd:class/fighter")!;
    expect(fighter.body).not.toMatch(/```yaml|## Effects/);
    expect(fighter.raw).toMatch(/## Effects/);
    expect(fighter.sections.some((s) => s.title === "Effects")).toBe(false);
    expect(fighter.effects!.map((f) => f.feature)).toContain("Level 1: Second Wind");
    const sw = features(fighter).find((f) => f.name === "Second Wind")!;
    expect(sw.md).not.toMatch(/resource:/);
    // the Fighter Features table still nests under Fighting Style
    expect(features(fighter).find((f) => f.name === "Fighting Style")!.md).toMatch(/\| Level \| Proficiency Bonus/);
    expect(fighter.fields["saving throw proficiencies"]).toBe("Strength and Constitution");
  });

  it("species traits written as headings still show as traits", () => {
    const human = byId("srd:species/human")!;
    expect(intro(human)).toBe("As a Human, you have these special traits.");
    expect(traits(human).map((t) => t.name)).toEqual(["Resourceful", "Skillful", "Versatile"]);
    expect(human.effects![0].feature).toBeNull();
  });

  it("flags blocks that aren't Modif", () => {
    expect(readBlocks("- bonuss: { to: ac, value: 1 }\n").problems[0].message).toMatch(/Did you mean bonus/);
    expect(readBlocks("- +1 AC\n").problems[0].message).toMatch(/one block/);
    expect(readBlocks("- bonus: { to: ac, value: 1, on: 3 }\n").problems[0].message).toMatch(/can’t be used as a key/);
    expect(readBlocks("- bonus: { to: ac\n").problems[0].message).toMatch(/valid YAML/);
  });
});

describe("values", () => {
  const env: Env = {
    level: 5, total: 7, pb: 3, mods: { Strength: 3, Constitution: 2, Charisma: -1 }, scores: { Strength: 17 },
    classLevels: { fighter: 5 }, table: { "Second Wind": "3", "Martial Arts": "1d8", "Rage Damage": "+2" },
  };
  it("reads references, tables, steps and arithmetic", () => {
    expect(evalNumber("level:fighter", env)).toBe(5);
    expect(evalNumber("level", env)).toBe(7);
    expect(evalNumber("table:Second Wind", env)).toBe(3);
    expect(evalNumber("table:Rage Damage", env)).toBe(2);
    expect(evalNumber("max(1, mod:cha)", env)).toBe(1);
    expect(evalNumber("5 * level:fighter", env)).toBe(25);
    expect(evalNumber("10 + mod:str + (prof * 2)", env)).toBe(19);
    expect(evalNumber({ steps: { 2: 1, 17: 2 } }, env)).toBe(1);
    expect(evalAmount("1d10 + level:fighter", env)).toEqual({ dice: ["1d10"], flat: 5 });
    expect(evalAmount("table:Martial Arts + mod:str", env)).toEqual({ dice: ["1d8"], flat: 3 });
    expect(evalNumber("level:wizard", env)).toBe(0);
    expect(evalNumber("bogus", env)).toBeNull();
    expect(evalNumber("1d6", env)).toBeNull();
  });
});

describe("Fighter (Champion), Human, Soldier", () => {
  it("level 1: saves, skills, tools, feats, AC, HP and Second Wind come from Effects", () => {
    const { fx, d } = sheet(champion(1));
    expect([...fx.encoded].sort()).toEqual([
      "srd:background/soldier", "srd:class/fighter", "srd:feat/defense", "srd:feat/savage-attacker", "srd:feat/skilled", "srd:species/human",
    ]);
    expect(Object.entries(d.saves).filter(([, s]) => s.prof).map(([a]) => a)).toEqual(["Strength", "Constitution"]);
    expect(d.saves.Strength.value).toBe(5);
    const profSkills = Object.entries(d.skills).filter(([, s]) => s.prof).map(([k]) => k).sort();
    expect(profSkills).toEqual(["Acrobatics", "Athletics", "History", "Insight", "Intimidation", "Perception", "Survival"]);
    expect([...fx.tools].sort()).toEqual(["Dice", "Smith’s Tools"]);
    expect([...fx.weapons]).toEqual(["simple", "martial"]);
    expect([...fx.armor]).toEqual(["light", "medium", "heavy", "shield"]);
    // Fighting Style defaults to Defense; Versatile defaults to Skilled; Soldier grants Savage Attacker
    expect(fx.feats.map((f) => f.name)).toEqual(["Defense", "Skilled", "Savage Attacker"]);
    expect(d.hp).toBe(12);
    expect(d.ac).toBe(17); // Chain Mail 16 + Defense
    expect(d.acNote).toBe("Chain Mail + Defense");
    expect(fx.resources).toEqual([{ key: "second-wind", name: "Second Wind", max: 2, recover: "shortOne", entryId: "srd:class/fighter" }]);
    expect(fx.actions.find((a) => a.id === "second-wind")).toMatchObject({ activation: "Bonus Action", heal: "1d10+1", resource: "second-wind" });
    expect(d.critRange).toBe(20);
    expect(d.attacksPerAction).toBe(1);
    expect(fx.onLongRest).toEqual([{ regain: "heroic-inspiration", source: "Resourceful (Human)" }]);
    expect(fx.size).toBeUndefined();
    const mastery = fx.pending.find((p) => p.key === "srd:class/fighter#mastery")!;
    expect(mastery.count).toBe(3);
    expect(mastery.options!.map((o) => o.value)).toContain("Longsword");
    const style = fx.pending.find((p) => p.key === "srd:class/fighter#fighting-style")!;
    expect(style.options!.map((o) => o.label)).toEqual(["Archery", "Defense", "Great Weapon Fighting", "Two-Weapon Fighting"]);
    expect(fx.pending.find((p) => p.key === "srd:background/soldier#gaming-set")!.options!.map((o) => o.value)).toEqual(["Dice", "Dragonchess", "Playing Cards", "Three Dragon Ante"]);
    expect(fx.pending.find((p) => p.key === "srd:class/fighter#skills")!.storedIn).toBe("classSkills");
    expect(fx.pending.find((p) => p.key === "srd:species/human#skillful")!.storedIn).toBe("extraSkills");
    expect(fx.problems).toEqual([]);
  });

  it("a different Fighting Style changes the sheet", () => {
    const { fx, d } = sheet(champion(1, { choices: { "srd:class/fighter#fighting-style": ["srd:feat/archery"] } }));
    expect(d.ac).toBe(16);
    expect(fx.attackBonuses).toEqual([{ value: 2, ranged: true, melee: false, source: "Archery" }]);
  });

  it("level 3: Champion's Improved Critical and Remarkable Athlete, plus Action Surge", () => {
    const { fx, d } = sheet(champion(3));
    expect(d.critRange).toBe(19);
    expect(advantageFor(fx, { kind: "init" })).toEqual(["Remarkable Athlete (Champion)"]);
    expect(advantageFor(fx, { kind: "check", ability: "Strength", skill: "Athletics" })).toEqual(["Remarkable Athlete (Champion)"]);
    expect(advantageFor(fx, { kind: "check", ability: "Strength" })).toEqual([]);
    expect(fx.resources.map((r) => [r.name, r.max, r.recover])).toEqual([["Second Wind", 2, "shortOne"], ["Action Surge", 1, "short"]]);
    expect(fx.features.find((f) => f.feature === "Remarkable Athlete")!.status).toBe("partly automated");
    expect(fx.features.find((f) => f.feature === "Improved Critical")!.status).toBe("automated");
  });

  it("level 5: Extra Attack and a higher Second Wind heal", () => {
    const { fx, d } = sheet(champion(5));
    expect(d.attacksPerAction).toBe(2);
    expect(d.pb).toBe(3);
    expect(fx.actions.find((a) => a.id === "second-wind")!.heal).toBe("1d10+5");
    expect(fx.resources.find((r) => r.key === "second-wind")!.max).toBe(3);
  });

  it("level 18: Superior Critical, Indomitable, Two Extra Attacks, Survivor", () => {
    const { fx, d } = sheet(champion(18));
    expect(d.critRange).toBe(18);
    expect(d.attacksPerAction).toBe(3);
    expect(fx.resources.map((r) => [r.key, r.max])).toEqual([["second-wind", 4], ["action-surge", 2], ["indomitable", 3]]);
    expect(advantageFor(fx, { kind: "death" })).toEqual(["Defy Death (Champion)"]);
    expect(treatRoll(fx, "death-save", 18)).toEqual({ as: 20, source: "Defy Death (Champion)" });
    expect(treatRoll(fx, "death-save", 17)).toBeNull();
    expect(fx.pending.filter((p) => p.level !== undefined).map((p) => p.key)).toEqual(
      [4, 6, 8, 12, 14, 16].map((l) => `srd:class/fighter#asi@${l}`),
    );
    expect(fx.pending.find((p) => p.key === "srd:subclass/champion#fighting-style-2")!.chosen).toEqual([]);
    expect(fx.reminders.some((r) => r.feature === "Heroic Rally")).toBe(true);
    expect(fx.pending.some((p) => p.key === "srd:class/fighter#epic-boon")).toBe(false);
  });

  it("as a second class, Fighter grants only its multiclass proficiencies", () => {
    const c: Character = {
      ...champion(3),
      classId: "srd:class/wizard", subclassId: undefined, classSkills: ["Arcana", "History"],
      multiclass: [{ classId: "srd:class/fighter", level: 1 }],
    };
    const { fx, d } = sheet(c);
    expect(fx.saves.size).toBe(0);
    expect([...fx.weapons]).toEqual(["martial"]);
    expect([...fx.armor]).toEqual(["light", "medium", "shield"]);
    expect(fx.pending.some((p) => p.key === "srd:class/fighter#skills")).toBe(false);
    // the wizard has no Effects yet, so its saves still come from its text
    expect(d.saves.Intelligence.prof).toBe(true);
    expect(fx.resources.map((r) => r.key)).toEqual(["second-wind"]);
  });
});

describe("Ability Score Improvements", () => {
  const slot = (l: number) => `srd:class/fighter#asi@${l}`;
  const asiPick = (l: number) => `${slot(l)}/srd:feat/ability-score-improvement#asi`;

  it("each ASI level is its own slot, defaulting to the Ability Score Improvement feat", () => {
    const { fx, d } = sheet(champion(4));
    const s4 = fx.pending.find((p) => p.key === slot(4))!;
    expect(s4).toMatchObject({ level: 4, count: 1, chosen: ["srd:feat/ability-score-improvement"], label: "Fighter level 4: Ability Score Improvement" });
    const inc = fx.pending.find((p) => p.key === asiPick(4))!;
    expect(inc.slot).toBe(slot(4));
    expect(inc.amounts).toEqual({ points: 2, perAbility: 2, max: 20, sets: [[2], [1, 1]] });
    expect(inc.chosen).toEqual([]);
    expect(d.scores.Strength).toBe(17); // nothing picked yet
    // boons need level 19; Grappler needs Str or Dex 13 (Str is 17)
    const names = s4.options!.map((o) => o.label);
    expect(names).toContain("Grappler");
    expect(names.some((n) => n.startsWith("Boon"))).toBe(false);
  });

  it("+2 to one score, or +1 to two, raise the sheet's scores, capped at 20", () => {
    const c = champion(6);
    c.choices = { ...c.choices, [asiPick(4)]: ["Strength", "Strength"], [asiPick(6)]: ["Strength", "Constitution"] };
    const { fx, d } = sheet(c);
    expect(d.scores.Strength).toBe(20); // 17 + 2 = 19, then +1
    expect(d.scores.Constitution).toBe(16);
    expect(d.mods.Constitution).toBe(3);
    expect(d.saves.Strength.value).toBe(5 + 3); // +5 mod, +3 proficiency
    expect(d.hp).toBe(10 + 3 + 5 * (6 + 3)); // Con +3 now counts on every level
    expect(fx.scoreSteps.map((x) => x.ability)).toEqual(["Strength", "Strength", "Strength", "Constitution"]);
    // a third +2 to Strength stops at 20
    const c2 = champion(8);
    c2.choices = { ...c.choices, [asiPick(8)]: ["Strength", "Strength"] };
    expect(sheet(c2).d.scores.Strength).toBe(20);
  });

  it("keeps only picks that fit +2 or +1/+1", () => {
    const c = champion(4);
    c.choices = { ...c.choices, [asiPick(4)]: ["Strength", "Dexterity", "Constitution"] };
    const { fx, d } = sheet(c);
    expect(fx.pending.find((p) => p.key === asiPick(4))!.chosen).toEqual(["Strength", "Dexterity"]);
    expect([d.scores.Strength, d.scores.Dexterity, d.scores.Constitution]).toEqual([18, 14, 15]);
  });

  it("another feat can be taken instead, and a feat you can take once isn't offered twice", () => {
    const c = champion(8);
    c.choices = { ...c.choices, [slot(4)]: ["srd:feat/grappler"], [`${slot(4)}/srd:feat/grappler#grappler-asi`]: ["Dexterity"], [slot(6)]: ["srd:feat/alert"] };
    const { fx, d } = sheet(c);
    expect(d.scores.Dexterity).toBe(14);
    expect(d.initiative).toBe(2 + 3); // Dex +2, Alert adds Proficiency Bonus
    expect(fx.featPicks.filter((p) => p.slot).map((p) => [p.level, p.feat.name])).toEqual([[4, "Grappler"], [6, "Alert"], [8, "Ability Score Improvement"]]);
    const s8 = fx.pending.find((p) => p.key === slot(8))!.options!.map((o) => o.label);
    expect(s8).not.toContain("Grappler");
    expect(s8).not.toContain("Alert");
    expect(s8).not.toContain("Defense"); // already the Fighting Style feat
    expect(s8).toContain("Ability Score Improvement"); // repeatable
    expect(fx.pending.find((p) => p.key === slot(4))!.options!.map((o) => o.label)).toContain("Grappler");
  });

  it("level 19 Epic Boon raises a score up to 30", () => {
    const c = champion(19);
    c.choices = {
      ...c.choices, [asiPick(4)]: ["Strength", "Strength"], [asiPick(6)]: ["Strength", "Dexterity"],
      ["srd:class/fighter#epic-boon@19/srd:feat/boon-of-combat-prowess#boon-asi"]: ["Strength"],
    };
    const { fx, d } = sheet(c);
    expect(fx.pending.find((p) => p.key === "srd:class/fighter#epic-boon@19")!.chosen).toEqual(["srd:feat/boon-of-combat-prowess"]);
    expect(d.scores.Strength).toBe(21);
  });

  it("classes not yet converted to Modif get their ASI levels from the class table", () => {
    const c: Character = { ...champion(8), classId: "srd:class/wizard", subclassId: undefined, classSkills: ["Arcana", "History"] };
    c.choices = { ...c.choices, ["srd:class/wizard#asi@4/srd:feat/ability-score-improvement#asi"]: ["Intelligence", "Intelligence"] };
    const { fx, d } = sheet(c);
    expect(fx.pending.filter((p) => p.level !== undefined).map((p) => p.key)).toEqual(["srd:class/wizard#asi@4", "srd:class/wizard#asi@8"]);
    expect(d.scores.Intelligence).toBe(10);
    expect(fx.encoded.has("srd:class/wizard")).toBe(false);
  });

  it("changing a slot's feat drops the picks made for the old one", () => {
    const c = champion(6);
    c.choices = { ...c.choices, [asiPick(4)]: ["Strength", "Strength"], [asiPick(6)]: ["Constitution", "Constitution"] };
    c.choices = setSlotFeat(c.choices, slot(4), "srd:feat/grappler");
    expect(c.choices[slot(4)]).toEqual(["srd:feat/grappler"]);
    expect(c.choices[asiPick(4)]).toBeUndefined();
    expect(c.choices[asiPick(6)]).toEqual(["Constitution", "Constitution"]); // other slots untouched
    expect(c.choices["srd:feat/skilled#skilled"]).toHaveLength(3);
    // switching back starts fresh
    c.choices = setSlotFeat(c.choices, slot(4), "srd:feat/ability-score-improvement");
    const { fx, d } = sheet(c);
    expect(fx.pending.find((p) => p.key === asiPick(4))!.chosen).toEqual([]);
    expect(d.scores.Strength).toBe(17);
    expect(d.scores.Constitution).toBe(17);
  });
});
