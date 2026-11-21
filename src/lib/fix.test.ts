import { describe, expect, it } from "vitest";
import { checkFile, applySuggestion } from "./fix.ts";
import { parseFile, features, parseTables, spellInfo } from "./parse.ts";

const KNOWN = { classes: ["Fighter", "Paladin", "Wizard"] };

describe("parser", () => {
  it("reads heading, fields, tagline, body and tags", () => {
    const [e] = parseFile("# Blinded [Condition]\n**Type:** Rule\n*Condition*\n\nYou can't see.\n", "t");
    expect(e.name).toBe("Blinded");
    expect(e.tags).toEqual(["Condition"]);
    expect(e.tagline).toBe("Condition");
    expect(e.body).toBe("You can't see.");
    expect(e.id).toBe("t:rule/blinded");
  });

  it("splits many entries per file and ignores # inside code fences", () => {
    const es = parseFile("# A\n**Type:** Feat\n\n```\n# not a heading\n```\n# B\n**Type:** Spell\n", "t");
    expect(es.map((e) => e.name)).toEqual(["A", "B"]);
  });

  it("reads features, tables and spell taglines", () => {
    const [e] = parseFile(
      "# Oath\n**Type:** Subclass\n**Parent:** Paladin\n\n## Level 3: Guard\nText.\n\n### Guard Table\n| A | B |\n|---|---|\n| 1 | 2 |\n\n## Level 7: Aura\nMore.\n",
      "t",
    );
    expect(features(e).map((f) => [f.level, f.name])).toEqual([[3, "Guard"], [7, "Aura"]]);
    expect(parseTables(features(e)[0].md)[0]).toEqual({ header: ["A", "B"], rows: [["1", "2"]] });
    const [s] = parseFile("# Bolt\n**Type:** Spell\n*Level 2 Evocation (Sorcerer, Wizard)*\n", "t");
    expect(spellInfo(s)).toEqual({ level: 2, school: "Evocation", classes: ["Sorcerer", "Wizard"] });
  });
});

describe("import checks", () => {
  it("rejects non-.md, empty and binary files", () => {
    expect(checkFile("map.png", "x", "p").rejected).toMatch(/Only .md/);
    expect(checkFile("a.md", "   \n", "p").rejected).toMatch(/empty/);
    expect(checkFile("a.md", "abc\u0000def", "p").rejected).toMatch(/text file/);
  });

  it("auto-fixes heading spaces, colons, blank lines in the header", () => {
    const r = checkFile("f.md", "#Fire Bolt\n**Type**: Spell\n\n**Range**: 60 feet\n\nZap.", "p");
    expect(r.rejected).toBeUndefined();
    expect(r.fixed).toBe("# Fire Bolt\n**Type:** Spell\n**Range:** 60 feet\n\nZap.");
    expect(r.entries[0].fields["range"]).toBe("60 feet");
    expect(r.fixes.map((f) => f.reason)).toEqual(
      expect.arrayContaining([
        "Added the space after #",
        "Moved the colon inside the bold label",
        "Removed a blank line inside the field block",
      ]),
    );
  });

  it("infers a missing Type and keeps later entries' line numbers right", () => {
    const r = checkFile("f.md", "# Zap\n**Casting Time:** Action\n\nText\n# Thing\n**Type:** Spel\n", "p");
    expect(r.entries[0].type).toBe("Spell");
    const s = r.suggestions.find((x) => /Did you mean Spell/.test(x.message))!;
    expect(r.fixed.split("\n")[s.line - 1]).toBe("**Type:** Spel");
    const r2 = applySuggestion(r, s, "p");
    expect(r2.entries[1].type).toBe("Spell");
  });

  it("wraps a file with no heading as one entry", () => {
    const r = checkFile("my-house-rules.md", "Just some notes.", "p");
    expect(r.entries[0].name).toBe("My House Rules");
  });

  it("checks Modif Effects blocks, old phrasebook bullets, and unknown parents", () => {
    const r = checkFile(
      "f.md",
      "# Ironhide\n**Type:** Feat\n\n## Effects\n```yaml\n- bonus: { to: ac, value: 1 }\n- bonuss: { to: hp:per-level, value: 1 }\n```\n\n" +
        "# Old Style\n**Type:** Feat\n\n## Effects\n- +1 AC while not wearing armor\n\n" +
        "# Rulebook\n**Type:** Rule\n\n## Effects\nThis heading is just rules text.\n\n" +
        "# Oath\n**Type:** Subclass\n**Parent:** Fightr\n",
      "p",
      KNOWN,
    );
    const msgs = r.suggestions.map((s) => s.message);
    const typo = r.suggestions.find((s) => /Did you mean bonus/.test(s.message))!;
    expect(typo.line).toBe(7);
    expect(typo.replacement).toBe("- bonus: { to: hp:per-level, value: 1 }");
    expect(msgs.filter((m) => /yaml fence/.test(m))).toHaveLength(1);
    expect(msgs.some((m) => /Did you mean Fighter/.test(m))).toBe(true);
    expect(r.suggestions).toHaveLength(3);
    expect(r.entries[0].effects).toHaveLength(1);
  });
});

import core from "../../public/data/srd-core.json";
import { speciesChoice, traits, classTable, casterInfo, skillChoice, equipmentOptions } from "./rules.ts";
import type { Entry } from "./parse.ts";

describe("rules on SRD data", () => {
  const E = core as unknown as Entry[];
  const get = (t: string, n: string) => E.find((e) => e.type === t && e.name === n)!;
  it("reads species choices, including side-by-side tables", () => {
    expect(speciesChoice(get("Species", "Elf"))!.table.rows.map((r) => r[0])).toEqual(["Drow", "High Elf", "Wood Elf"]);
    expect(speciesChoice(get("Species", "Dragonborn"))!.table.rows).toHaveLength(10);
  });
  it("finds traits after a table", () => {
    expect(traits(get("Species", "Dragonborn")).map((t) => t.name)).toContain("Draconic Flight");
    expect(traits(get("Species", "Goliath")).map((t) => t.name)).toEqual(["Giant Ancestry", "Large Form", "Powerful Build"]);
  });
  it("reads class tables, casting, skills and equipment", () => {
    expect(classTable(get("Class", "Fighter"))!.rows).toHaveLength(20);
    expect(casterInfo(get("Class", "Warlock"), 5)).toMatchObject({ cantrips: 3, prepared: 6, maxSpellLevel: 3 });
    expect(skillChoice(get("Class", "Rogue").fields["skill proficiencies"]).count).toBe(4);
    expect(equipmentOptions(get("Class", "Fighter").fields["starting equipment"]).map((o) => o.key)).toEqual(["A", "B", "C"]);
  });
});
