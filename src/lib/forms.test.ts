import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseFile, type Entry } from "./parse.ts";
import { armorTable, derive, newCharacter, type Character } from "./rules.ts";
import { classInfos } from "./multiclass.ts";
import { computeModif, evalAmount } from "./modif.ts";
import { carryingCapacity } from "./inventory.ts";
import { applyForm, formEligible, parseCreature, parseStatBlockMd } from "./creature.ts";

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

describe("builder: prerequisites toggle and score breakdown", () => {
  it("lists every feat when prerequisites are off", () => {
    const c = druid(4);
    const slot = (x: Character) => run(x).fx.pending.find((p) => p.slot)!;
    const on = slot(c).options!.length;
    const off = slot({ ...c, ignorePrereqs: true }).options!.length;
    expect(off).toBeGreaterThan(on);
  });
  it("shows each score's sources", async () => {
    const { scoreBreakdown } = await import("./modif.ts");
    const c = druid(4);
    const b = scoreBreakdown(c, [{ ability: "Wisdom", amount: 1, max: 20, source: "Ability Score Improvement" }, { ability: "Wisdom", amount: 1, max: 20, source: "Ability Score Improvement" }], "Sage");
    expect(b.Wisdom).toEqual([{ label: "Base score", amount: 15 }, { label: "Sage (background)", amount: 2, note: undefined }, { label: "Ability Score Improvement", amount: 2, note: undefined }]);
  });
});

describe("Sera: the Paladin 5 / Warlock 2 built side by side with D&D Beyond", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fixture = JSON.parse(readFileSync(join(__dirname, "sera.fixture.json"), "utf8"));
  const sera = (extra: Record<string, unknown> = {}): Character => ({ ...newCharacter(), ...fixture, ...extra });
  it("lists known damage cantrips for Agonizing Blast and adds Charisma to Eldritch Blast", () => {
    const base = sera();
    const p = run(base).fx.pending.find((x) => x.key.endsWith("#agonizing-cantrip"));
    expect(p?.options?.map((o) => o.label)).toEqual(["Eldritch Blast"]);
    const chosen = sera({ choices: { ...fixture.choices, [p!.key]: ["srd:spell/eldritch-blast"] } });
    expect(run(chosen).fx.spellDamageBonuses).toEqual([expect.objectContaining({ spellId: "srd:spell/eldritch-blast", value: 3 })]);
  });
});

describe("invocation prerequisites", () => {
  const fixture = JSON.parse(readFileSync(join(__dirname, "sera.fixture.json"), "utf8"));
  it("offers a Warlock 2 only the invocations of level 2 or lower", () => {
    const opts = run({ ...newCharacter(), ...fixture }).fx.pending.find((x) => x.key === "srd:class/warlock#invocations")!.options!.map((o) => o.label);
    expect(opts).toContain("Agonizing Blast");
    expect(opts).toContain("Pact of the Blade");
    expect(opts).not.toContain("Thirsting Blade");
    expect(opts).not.toContain("Eldritch Smite");
    const off = run({ ...newCharacter(), ...fixture, ignorePrereqs: true }).fx.pending.find((x) => x.key === "srd:class/warlock#invocations")!.options!.map((o) => o.label);
    expect(off).toContain("Thirsting Blade");
  });
});

describe("Magic Initiate from a background", () => {
  it("locks the Sage's list to Wizard and offers Wizard cantrips and level 1 spells", () => {
    const c = druid(3);
    const { fx } = run(c);
    const list = fx.pending.find((p) => p.key.endsWith("#mi-list"))!;
    expect(list.locked).toBe(true);
    expect(list.options!.map((o) => o.value)).toEqual(["wizard"]);
    const can = fx.pending.find((p) => p.key.endsWith("#mi-cantrips"))!;
    expect(can.count).toBe(2);
    expect(can.options!.some((o) => o.label === "Fire Bolt")).toBe(true);
    expect(can.options!.some((o) => o.label === "Guidance")).toBe(false);
    const one = fx.pending.find((p) => p.key.endsWith("#mi-spell"))!;
    expect(one.options!.some((o) => o.label === "Magic Missile")).toBe(true);
    // picking them grants the spells with the chosen ability
    const c2 = { ...c, choices: { [can.key]: ["srd:spell/fire-bolt", "srd:spell/light"], [one.key]: ["srd:spell/magic-missile"], [fx.pending.find((p) => p.key.endsWith("#mi-ability"))!.key]: ["Intelligence"] } };
    const g = run(c2).fx.grantedSpells;
    expect(g.find((x) => x.spell.id === "srd:spell/fire-bolt")?.ability).toBe("Intelligence");
    expect(g.some((x) => x.spell.id === "srd:spell/magic-missile")).toBe(true);
  });
});

describe("checks found by comparing with D&D Beyond", () => {
  const fxOf = (c: Character) => run(c).fx;
  const base = (over: Partial<Character>): Character => ({ ...newCharacter(), base: { Strength: 8, Dexterity: 14, Constitution: 13, Intelligence: 12, Wisdom: 10, Charisma: 15 }, bonus: {}, ...over });

  it("Rogue Expertise lists only proficient skills, minus ones already picked for Expertise", () => {
    const c = base({ level: 6, classId: "srd:class/rogue", backgroundId: "srd:background/criminal", speciesId: "srd:species/human",
      classSkills: ["Acrobatics", "Athletics", "Deception", "Insight"], choices: { "srd:class/rogue#expertise-1": ["Stealth", "Sleight of Hand"] } });
    const p1 = fxOf(c).pending.find((p) => p.key.endsWith("#expertise-1"))!;
    expect(p1.options!.map((o) => o.value).sort()).toEqual(["Acrobatics", "Athletics", "Deception", "Insight", "Sleight of Hand", "Stealth"]);
    const p2 = fxOf(c).pending.find((p) => p.key.endsWith("#expertise-2"))!;
    expect(p2.options!.map((o) => o.value)).not.toContain("Stealth");
    expect(p2.options!.map((o) => o.value)).toContain("Acrobatics");
  });

  it("Invocations check level and the invocation they need (Eldritch Smite needs Pact of the Blade)", () => {
    const c = base({ level: 10, classId: "srd:class/warlock", subclassId: "srd:subclass/fiend-patron", choices: { "srd:class/warlock#invocations": ["Agonizing Blast"] } });
    const opts = () => fxOf(c).pending.find((p) => p.key.endsWith("#invocations"))!.options!.map((o) => o.value);
    expect(opts()).not.toContain("Devouring Blade"); // level 12
    expect(opts()).not.toContain("Eldritch Smite");
    c.choices = { "srd:class/warlock#invocations": ["Pact of the Blade"] };
    expect(opts()).toContain("Eldritch Smite");
  });

  it("Fiendish Resilience offers every damage type but Force; Eldritch Smite rolls 1d8 + slot level", () => {
    const c = base({ level: 10, classId: "srd:class/warlock", subclassId: "srd:subclass/fiend-patron", choices: { "srd:class/warlock#invocations": ["Pact of the Blade", "Eldritch Smite"], "srd:subclass/fiend-patron#resilience": ["fire"] } });
    const fx = fxOf(c);
    const res = fx.pending.find((p) => p.key.endsWith("#resilience"))!;
    expect(res.options!.length).toBe(12);
    expect(res.options!.some((o) => o.value === "force")).toBe(false);
    expect(fx.defenses.some((d) => /Fire/.test(d.text))).toBe(true);
    expect(fx.triggers.find((t) => t.name === "Eldritch Smite")!.damage![0].dice).toBe("6d8");
  });

  it("Wizard Scholar picks from proficient study skills; Evocation Savant spells go in the spellbook", () => {
    const c = base({ level: 10, classId: "srd:class/wizard", subclassId: "srd:subclass/evoker", backgroundId: "srd:background/sage", classSkills: ["Insight", "Investigation"],
      choices: { "srd:subclass/evoker#savant": ["srd:spell/burning-hands", "srd:spell/shatter"] } });
    const fx = fxOf(c);
    expect(fx.pending.find((p) => p.key.endsWith("#scholar"))!.options!.map((o) => o.value)).toEqual(["Arcana", "History", "Investigation"]);
    expect(fx.bookSpells.map((b) => b.name)).toEqual(["Burning Hands", "Shatter"]);
    // Empowered Evocation: Intelligence to Wizard evocation spells' damage
    expect(fx.spellDamageBonuses.some((b) => b.spellId === "srd:spell/fireball" && b.value === 1)).toBe(true);
  });

  it("A pick that another block reads (Agonizing Blast's cantrip) isn't left as an 'apply by hand' line", () => {
    const c = base({ level: 5, classId: "srd:class/warlock", cantrips: ["Eldritch Blast"],
      choices: { "srd:class/warlock#invocations": ["Agonizing Blast"], "srd:class/warlock#agonizing-cantrip": ["srd:spell/eldritch-blast"] } });
    const fx = fxOf(c);
    expect(fx.reminders.some((r) => r.feature === "Agonizing Blast")).toBe(false);
    expect(fx.features.find((f) => f.feature === "Agonizing Blast")?.status).toBe("automated");
  });

  it("Potent Cantrip describes the cantrip rule, not a save of an undefined ability", () => {
    const c = base({ level: 3, classId: "srd:class/wizard", subclassId: "srd:subclass/evoker" });
    const note = fxOf(c).notes.find((n) => n.feature === "Potent Cantrip")!;
    expect(note.text).not.toMatch(/undefined/i);
    expect(note.text).toMatch(/^Your cantrips: a target that succeeds on the save takes half damage/);
  });
  it("Primal Knowledge lists the Barbarian skill list (from: $#skills)", () => {
    const c = base({ level: 3, classId: "srd:class/barbarian", classSkills: ["Animal Handling", "Intimidation"] });
    const p = fxOf(c).pending.find((x) => x.key.endsWith("#primal-skill"))!;
    expect(p.options!.map((o) => o.value).sort()).toEqual(["Athletics", "Nature", "Perception", "Survival"]); // not the class skills you already have
    c.choices = { "srd:class/barbarian#primal-skill": ["Survival"] };
    expect(fxOf(c).skills.has("Survival")).toBe(true);
  });

  it("Powerful Build counts as one size larger for carrying capacity", () => {
    const c = base({ level: 5, classId: "srd:class/barbarian", speciesId: "srd:species/goliath" });
    expect(fxOf(c).carrySize).toBe(1);
    expect(carryingCapacity(18, "Medium", 1)).toBe(540);
    expect(carryingCapacity(18, "Small", 1)).toBe(270);
    expect(carryingCapacity(18, "Medium")).toBe(270);
    expect(fxOf(c).toggles.find((t) => t.name === "Large Form")!.lines.join(" ")).toMatch(/Size becomes Large/);
  });

  it("Sear Undead adds Wis-mod d8s of Radiant damage to Turn Undead; Divine Spark's options roll their own amounts", () => {
    const c = base({ level: 5, classId: "srd:class/cleric", base: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 16, Charisma: 10 } });
    const fx = fxOf(c);
    const turn = fx.actions.find((a) => a.id === "turn-undead")!;
    expect(turn.damage).toEqual([{ dice: "3d8", type: "radiant" }]);
    const spark = fx.actions.find((a) => a.id === "divine-spark")!;
    expect(spark.optionEffects?.[0]?.heal).toBe("1d8+3");
    expect(spark.optionEffects?.[1]?.damage?.[0]).toEqual({ dice: "1d8+3", type: "necrotic/radiant" });
    expect(spark.options?.[1]).toMatch(/^Harm \(1d8\+3 necrotic\/radiant, (DC \d+ )?Con save\)$/);
  });

  it("steps(...) works as one term of a sum", () => {
    const env = { level: 7, total: 7, pb: 3, mods: { Strength: 0, Dexterity: 0, Constitution: 0, Intelligence: 0, Wisdom: 3, Charisma: 0 }, scores: {}, classLevels: {} } as never;
    expect(evalAmount("steps(2: 1d8, 7: 2d8) + mod:wis", env)).toEqual({ dice: ["2d8"], flat: 3 });
  });
  it("Skilled doesn't offer skills you already have", () => {
    const c = base({ level: 1, classId: "srd:class/fighter", speciesId: "srd:species/human", backgroundId: "srd:background/soldier", classSkills: ["Acrobatics", "Perception"] });
    const p = fxOf(c).pending.find((x) => x.key.endsWith("skilled#skilled"))!;
    const opts = p.options!.map((o) => o.value);
    expect(opts).not.toContain("Perception"); // class skill
    expect(opts).not.toContain("Athletics"); // Soldier background
    expect(opts).toContain("Arcana");
    expect(opts.some((o) => /Thieves/.test(o))).toBe(true);
  });
  it("A cantrip pick leaves out cantrips you already know (High Elf and Magic Initiate)", () => {
    const c = base({ level: 1, classId: "srd:class/fighter", speciesId: "srd:species/elf", speciesChoice: "High Elf", backgroundId: "srd:background/sage",
      choices: { "srd:species/elf#high-elf-cantrip": ["srd:spell/ray-of-frost"], "srd:feat/magic-initiate#mi-list": ["wizard"], "srd:feat/magic-initiate#mi-cantrips": ["srd:spell/ray-of-frost", "srd:spell/light"] } } as Partial<Character>);
    const fx = fxOf(c);
    const elf = fx.pending.find((p) => p.key.endsWith("#high-elf-cantrip"))!;
    const mi = fx.pending.find((p) => p.key.endsWith("#mi-cantrips"))!;
    // whichever is read second can't take the other's cantrip
    const both = elf.chosen.includes("srd:spell/ray-of-frost") && mi.chosen.includes("srd:spell/ray-of-frost");
    expect(both).toBe(false);
    expect([...elf.chosen, ...mi.chosen]).toContain("srd:spell/ray-of-frost");
    expect(mi.chosen).toContain("srd:spell/light");
  });
  it("Evocation Savant adds one pick for each new spell slot level, from levels you have slots for", () => {
    const wiz = (level: number) => base({ level, classId: "srd:class/wizard", subclassId: "srd:subclass/evoker" });
    expect(fxOf(wiz(3)).pending.some((p) => p.key.endsWith("#savant-more"))).toBe(false);
    const p6 = fxOf(wiz(6)).pending.find((p) => p.key.endsWith("#savant-more"))!;
    expect(p6.count).toBe(1);
    expect(p6.options!.map((o) => o.label)).toContain("Fireball");
    expect(p6.options!.map((o) => o.label)).not.toContain("Cone of Cold");
    expect(fxOf(wiz(9)).pending.find((p) => p.key.endsWith("#savant-more"))!.count).toBe(3);
    const w = wiz(6);
    w.choices = { "srd:subclass/evoker#savant": ["srd:spell/burning-hands", "srd:spell/shatter"] };
    expect(fxOf(w).pending.find((p) => p.key.endsWith("#savant-more"))!.options!.map((o) => o.label)).not.toContain("Shatter");
  });

  it("A summon's 'add your Proficiency Bonus to any ability check or saving throw' goes into its saves", () => {
    const md = [
      "*Small Celestial, Neutral*", "", "**AC** 13", "", "**HP** 20", "", "**Speed** 30 ft.", "",
      "|  |  | MOD | SAVE |", "| --- | --- | --- | --- |", "| STR | 1 | −5 | −5 |", "| DEX | 14 | +2 | +2 |", "| CON | 10 | +0 | +0 |",
      "|  |  | MOD | SAVE |", "| INT | 15 | +2 | +2 |", "| WIS | 15 | +2 | +2 |", "| CHA | 16 | +3 | +3 |", "",
      "***Traits***", "", "***Pact Bond.*** Add your Proficiency Bonus to any ability check or saving throw the vestige makes.",
    ].join("\n");
    const cr = parseStatBlockMd("x", "Vestige", md, { pb: 3, mods: {}, classLevels: {} });
    expect(cr.saves.Strength).toBe(-2);
    expect(cr.saves.Charisma).toBe(6);
  });
});
