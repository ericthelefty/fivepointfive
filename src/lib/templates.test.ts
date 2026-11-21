import { describe, expect, it } from "vitest";
import { TEMPLATES } from "./templates.ts";
import { checkFile } from "./fix.ts";
import { parseFile, features } from "./parse.ts";
import { classTable, equipmentOptions, skillChoice } from "./rules.ts";

const KNOWN = { classes: ["Fighter", "Paladin", "Wizard"] };
const TYPE_OF: Record<string, string> = { Equipment: "Gear" };

describe("format guide templates", () => {
  for (const [name, t] of Object.entries(TEMPLATES)) {
    it(`${name} template imports with the right type and no warnings`, () => {
      const r = checkFile(t.file, t.text, "t", KNOWN);
      expect(r.rejected).toBeUndefined();
      expect(r.fixes).toEqual([]);
      // a template's [placeholders] can trip "unknown parent class" only
      expect(r.suggestions.filter((s) => !/parent|class/i.test(s.message))).toEqual([]);
      const [e] = parseFile(t.text, "t", t.file);
      expect(e.type).toBe(TYPE_OF[name] || name);
    });
  }

  it("a filled-in Class template gives the builder what it needs", () => {
    const text = TEMPLATES.Class.text
      .replaceAll("[Class Name]", "Warden")
      .replace("[Ability]", "Wisdom")
      .replace("[Ability] and [Ability]", "Wisdom and Constitution")
      .replace("[Skill], [Skill], [Skill], or [Skill]", "Athletics, Nature, Perception, or Survival")
      .replace("[Item], [Item], [Pack], and [n] GP; or (B) [n] GP", "Spear, Leather Armor, Explorer’s Pack, and 10 GP; or (B) 50 GP")
      .replaceAll("[Resource]", "Vigil");
    const [cls] = parseFile(text, "t", "class.md");
    expect(cls.fields["hit point die"]).toMatch(/D8 per Warden level/);
    expect(skillChoice(cls.fields["skill proficiencies"])).toEqual({ count: 2, from: ["Athletics", "Nature", "Perception", "Survival"] });
    expect(equipmentOptions(cls.fields["starting equipment"]).map((o) => o.key)).toEqual(["A", "B"]);
    const table = classTable(cls);
    expect(table?.header).toContain("Vigil");
    expect(table?.rows.length).toBe(4);
    expect(features(cls).map((f) => f.level)).toEqual([1, 1, 2, 3, 4]);
  });
});

import guide from "../../docs/CONTENT_FORMAT.md?raw";

describe("format guide worked example", () => {
  it("the Effects example imports with every line understood", () => {
    const m = guide.match(/````markdown\n(# Barkskin Hide[\s\S]*?)\n````/);
    expect(m).toBeTruthy();
    const r = checkFile("feat.md", m![1], "t", KNOWN);
    expect(r.fixes).toEqual([]);
    expect(r.suggestions).toEqual([]);
    expect(r.entries[0].effects?.map((f) => f.feature)).toEqual(["Ability Score Increase", "Bark Armor", "Rooted"]);
  });
});
