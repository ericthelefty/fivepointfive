import { describe, expect, it } from "vitest";
import { trimClassTable } from "./parse.ts";

const md = `Intro text.

#### Warlock Features

| Level | Proficiency Bonus | Class Features | Eldritch Invocations | Cantrips | Prepared Spells | Spell Slots | Slot Level |
|---|---|---|---|---|---|---|---|
| 1 | +2 | Eldritch Invocations, Pact Magic | 1 | 2 | 2 | 1 | 1 |
| 3 | +2 | Warlock Subclass | 3 | 2 | 4 | 2 | 2 |

***Spellcasting Ability.*** Charisma.`;

describe("trimClassTable", () => {
  it("replaces the class table with the character's row", () => {
    const out = trimClassTable(md, "Warlock", 3);
    expect(out).not.toContain("|");
    expect(out).toContain("*At Warlock level 3:* Eldritch Invocations 3 · Cantrips 2 · Prepared Spells 4 · Spell Slots 2 · Slot Level 2");
    expect(out).toContain("Intro text.");
    expect(out).toContain("Spellcasting Ability");
  });
  it("folds per-level spell slot columns into one item", () => {
    const pal = `#### Paladin Features\n\n| Level | Proficiency Bonus | Class Features | Channel Divinity | Prepared Spells | Spell Slots per Spell Level 1 | Spell Slots per Spell Level 2 |\n|---|---|---|---|---|---|---|\n| 5 | +3 | Extra Attack | 2 | 6 | 4 | 2 |`;
    expect(trimClassTable(pal, "Paladin", 5)).toBe("*At Paladin level 5:* Channel Divinity 2 · Prepared Spells 6 · Spell Slots L1 ×4, L2 ×2");
  });
  it("drops the table when no level is known, and leaves other text alone", () => {
    expect(trimClassTable(md, "Warlock")).not.toContain("|");
    expect(trimClassTable("No table here.", "Warlock", 3)).toBe("No table here.");
  });
});
