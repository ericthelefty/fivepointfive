/** Checks that what docs/CONTENT_FORMAT.md promises is what the code does. */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import guide from "../../docs/CONTENT_FORMAT.md?raw";
import { checkFile } from "./fix.ts";
import { parseFile, type Entry } from "./parse.ts";
import { classSpells, newCharacter, speciesChoice, traits } from "./rules.ts";
import { computeModif, skillChoiceOf, spellPlan, weaponProficient } from "./modif.ts";
import { applyReplacements } from "./store.tsx";

const SRD = join(__dirname, "../../content/srd-5.2.1");
const load = (dir: string): Entry[] =>
  readdirSync(join(SRD, dir)).flatMap((f) => parseFile(readFileSync(join(SRD, dir, f), "utf8"), "srd", f));

describe("guide examples", () => {
  it("every markdown example in the guide imports without fixes or warnings", () => {
    const blocks = [...guide.matchAll(/(`{3,4})markdown\n([\s\S]*?)\n\1(?!`)/g)].map((m) => m[2]).filter((b) => !b.includes("←"));
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    for (const b of blocks) {
      const r = checkFile("example.md", b, "t", { classes: [] });
      expect(r.fixes, b.slice(0, 40)).toEqual([]);
      expect(r.suggestions, b.slice(0, 40)).toEqual([]);
    }
  });
});

describe("Replaces", () => {
  it("hides the original and sends lookups of its ID to the replacement", () => {
    const [orig] = parseFile("# Fireball\n**Type:** Spell\n*Level 3 Evocation (Wizard)*\n", "srd");
    const [mine] = parseFile("# Fireball\n**Type:** Spell\n**Replaces:** srd:spell/fireball\n*Level 3 Evocation (Wizard)*\n\nHouse rule.", "eric");
    const { visible, index } = applyReplacements([orig, mine]);
    expect(visible.map((e) => e.id)).toEqual(["eric:spell/fireball"]);
    expect(index.get("srd:spell/fireball")).toBe(mine);
  });
});

describe("spells and classes", () => {
  const classes = load("classes");
  const spells = load("spells");
  const wizard = classes.find((c) => c.name === "Wizard")!;

  it("SRD class lists still come only from the SRD tables", () => {
    const n = [...classSpells(wizard, spells).values()].flat().length;
    const fromTables = wizard.sections.filter((s) => /^Cantrips|^Level \d+ .* Spells$/.test(s.title)).flatMap((s) => s.md.split("\n").filter((l) => /^\| (?!Spell \||---)/.test(l))).length;
    expect(n).toBe(fromTables);
  });

  it("a homebrew spell tagged (Wizard) joins the Wizard list", () => {
    const [hb] = parseFile("# Frost Lance\n**Type:** Spell\n*Level 2 Evocation (Wizard)*\n\nA creature takes 3d8 Cold damage.", "eric");
    const list = classSpells(wizard, [...spells, hb]);
    expect(list.get(2)).toContain(hb);
  });

  it("spell Effects the guide shows become roll buttons (Fireball)", () => {
    const fireball = spells.find((s) => s.name === "Fireball")!;
    expect(spellPlan(fireball, { slot: 4, charLevel: 7, spell: { mod: 3, dc: 14, attack: 6 } })).toMatchObject({
      save: { ability: "Dexterity", success: "half" }, damage: [{ dice: "9d6", type: "fire" }],
    });
  });

  it("a homebrew class's Effects drive saves, its skill choice, weapon proficiency and trackers", () => {
    const [cls] = parseFile(
      "# Warden\n**Type:** Class\n\n## Core Warden Traits\n\n**Hit Point Die:** D8 per Warden level\n\n## Effects\n```yaml\n" +
        "- proficiency: [save:wis, save:con, weapon:simple, { weapon: { category: martial, property: light } }]\n" +
        "- choose: { id: skills, kind: skill, count: 2, grants: proficiency, from: [athletics, history, survival] }\n```\n\n" +
        "## Warden Features\n\n| Level | Proficiency Bonus | Class Features | Vigils |\n|---|---|---|---|\n| 1 | +2 | Vigil | 2 |\n\n" +
        "### Level 1: Vigil\nYou regain all expended uses when you finish a Short or Long Rest.\n\n## Effects\n```yaml\n- resource: { id: vigils, max: table:Vigils, reset: short }\n```\n",
      "t",
    );
    expect(skillChoiceOf(cls)).toEqual({ count: 2, from: ["Athletics", "History", "Survival"] });
    const c = { ...newCharacter(), classId: cls.id, level: 1 };
    const fx = computeModif({ c, classes: [{ cls, level: 1, starting: true, skills: [] }], entries: [cls], byId: (id) => (id === cls.id ? cls : undefined) });
    expect([...fx.saves]).toEqual(["Wisdom", "Constitution"]);
    expect(fx.resources).toEqual([expect.objectContaining({ key: "vigils", name: "Vigil", max: 2, recover: "short" })]);
    const scimitar = { name: "Scimitar", category: "Martial Melee Weapons", properties: "Finesse, Light" };
    const maul = { name: "Maul", category: "Martial Melee Weapons", properties: "Heavy, Two-Handed" };
    expect(weaponProficient(fx, scimitar)).toBe(true);
    expect(weaponProficient(fx, maul)).toBe(false);
  });

  it("without Effects, the class text is shown but nothing is read from it", () => {
    const [cls] = parseFile("# Plain\n**Type:** Class\n\n## Core Plain Traits\n\n**Saving Throw Proficiencies:** Strength and Constitution\n**Skill Proficiencies:** Choose 2: Athletics or History\n", "t");
    const c = { ...newCharacter(), classId: cls.id, level: 1 };
    const fx = computeModif({ c, classes: [{ cls, level: 1, starting: true, skills: [] }], entries: [cls], byId: () => cls });
    expect(fx.saves.size).toBe(0);
    expect(skillChoiceOf(cls).count).toBe(0);
  });
});

describe("species and conditions", () => {
  it("run-ins are traits; ## sections are not; a table under ## is a choice", () => {
    const [sp] = parseFile(
      "# Treefolk\n**Type:** Species\n**Size:** Medium\n**Speed:** 30 feet\n\n***Barkskin.*** Your AC can't be lower than 16.\n\n## Seasons\n\n| Season | Gift |\n|---|---|\n| Spring | Healing |\n| Winter | Cold resistance |\n\n## Old Lore\nNot a trait.\n",
      "t",
    );
    expect(traits(sp).map((t) => t.name)).toEqual(["Barkskin"]);
    expect(speciesChoice(sp)?.title).toBe("Seasons");
  });

  it("[Condition] in the heading or Tags makes a condition; a tagline doesn't", () => {
    const es = parseFile("# Dazed [Condition]\n**Type:** Rule\n\nX\n# Shaken\n**Type:** Rule\n**Tags:** Condition\n\nY\n# Rattled\n**Type:** Rule\n*Condition*\n\nZ\n", "t");
    expect(es.map((e) => e.tags.includes("Condition"))).toEqual([true, true, false]);
  });
});

import { guideMeta } from "./guideMeta.ts";

describe("guide version and publish date", () => {
  it("the guide states a version and a valid publish date, and they're removed from the body", () => {
    const m = guideMeta(guide);
    expect(m.version).toMatch(/^\d+\.\d+/);
    expect(m.published).toBeInstanceOf(Date);
    expect(Number.isNaN(m.published!.getTime())).toBe(false);
    expect(m.body.startsWith("Every piece of game content")).toBe(true);
  });

  it("reads the date as a calendar day, not shifted by time zone", () => {
    const m = guideMeta("# T\n**Version:** 1.0\n**Published:** 2026-01-01\n\nBody");
    expect([m.published!.getFullYear(), m.published!.getMonth(), m.published!.getDate()]).toEqual([2026, 0, 1]);
    expect(m.body).toBe("Body");
  });
});
