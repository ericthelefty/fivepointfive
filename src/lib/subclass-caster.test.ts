import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseFile, type Entry } from "./parse.ts";
import { newCharacter, type Character } from "./rules.ts";
import { casterEntry, casterInfoOf, casterKindOf, classInfos, spellListClass, spellSlots } from "./multiclass.ts";

const SRD = join(__dirname, "../../content/srd-5.2.1");
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : f.endsWith(".md") ? [join(d, f)] : []));
const srd: Entry[] = walk(SRD).flatMap((f) => parseFile(readFileSync(f, "utf8"), "srd", f));

/** An Eldritch Knight written the way the PHB pack will be (2024 table), with slot columns in either form. */
const table = (bare: boolean) => {
  const head = bare ? "| Fighter Level | Spells Prepared | 1 | 2 | 3 | 4 |" : "| Fighter Level | Spells Prepared | Spell Slots per Spell Level 1 | Spell Slots per Spell Level 2 | Spell Slots per Spell Level 3 | Spell Slots per Spell Level 4 |";
  const rows = [
    [3, 3, 2, 0, 0, 0], [4, 4, 3, 0, 0, 0], [5, 4, 3, 0, 0, 0], [6, 4, 3, 0, 0, 0], [7, 5, 4, 2, 0, 0], [8, 6, 4, 2, 0, 0], [9, 6, 4, 2, 0, 0],
    [10, 7, 4, 3, 0, 0], [11, 8, 4, 3, 0, 0], [12, 8, 4, 3, 0, 0], [13, 9, 4, 3, 2, 0], [14, 10, 4, 3, 2, 0], [15, 10, 4, 3, 2, 0],
    [16, 11, 4, 3, 3, 0], [17, 11, 4, 3, 3, 0], [18, 11, 4, 3, 3, 0], [19, 12, 4, 3, 3, 1], [20, 13, 4, 3, 3, 1],
  ].map((r) => `| ${r.map((x, i) => (i > 1 && !x ? "—" : x)).join(" | ")} |`);
  return [head, "| --- | --- | --- | --- | --- | --- |", ...rows].join("\n");
};
const ek = (bare = false) => parseFile(`# Eldritch Knight
**Type:** Subclass
**Parent:** Fighter

## Level 3: Spellcasting

You have learned to cast spells.

## Effects
\`\`\`yaml
- spellcasting: { ability: int, progression: third, list: wizard, cantrips: "steps(3: 2, 10: 3)" }
\`\`\`

### Eldritch Knight Spellcasting

${table(bare)}

## Level 7: War Magic

When you take the Attack action, you can replace one of the attacks with a casting of one of your Wizard cantrips.
`, "phb", "eldritch-knight.md")[0];

const world = (sub: Entry) => {
  const all = [...srd, sub];
  const idx = new Map(all.map((e) => [e.id, e]));
  return { all, byId: (id?: string) => (id ? idx.get(id) : undefined) };
};
const knight = (sub: Entry, level: number, extra: Partial<Character> = {}): Character => ({
  ...newCharacter(), level, classId: "srd:class/fighter", subclassId: sub.id, speciesId: "srd:species/human", backgroundId: "srd:background/soldier", ...extra,
});

describe("spellcasting from a subclass (Eldritch Knight)", () => {
  it("starts at the subclass feature's level, with slots from the subclass table and spells from the Wizard list", () => {
    const sub = ek();
    const { all, byId } = world(sub);
    expect(casterEntry(classInfos(knight(sub, 2), byId)[0])).toBeUndefined();
    const i3 = classInfos(knight(sub, 3), byId)[0];
    expect(casterEntry(i3)?.id).toBe(sub.id);
    expect(casterKindOf(i3)).toBe("third");
    expect(casterInfoOf(i3)).toEqual({ cantrips: 2, prepared: 3, maxSpellLevel: 1, slots: [{ level: 1, count: "2" }] });
    expect(spellListClass(i3, all).name).toBe("Wizard");
    const i10 = classInfos(knight(sub, 10), byId)[0];
    expect(casterInfoOf(i10)).toMatchObject({ cantrips: 3, prepared: 7, maxSpellLevel: 2 });
    expect(spellSlots([i10], all)).toEqual([{ level: 1, max: 4, pact: false }, { level: 2, max: 3, pact: false }]);
  });

  it("reads the table with bare 1–4 slot columns too (the book's layout)", () => {
    const sub = ek(true);
    const { byId } = world(sub);
    expect(casterInfoOf(classInfos(knight(sub, 19), byId)[0])).toMatchObject({ maxSpellLevel: 4, slots: [{ level: 1, count: "4" }, { level: 2, count: "3" }, { level: 3, count: "3" }, { level: 4, count: "1" }] });
  });

  it("counts as a third caster when multiclassing (Fighter 9 + Wizard 3 = caster level 6)", () => {
    const sub = ek();
    const { all, byId } = world(sub);
    const c = knight(sub, 12, { multiclass: [{ classId: "srd:class/wizard", level: 3, skills: [], cantrips: [], spells: [] }] } as Partial<Character>);
    const infos = classInfos(c, byId);
    expect(infos.map((i) => [i.cls.name, i.level])).toEqual([["Fighter", 9], ["Wizard", 3]]);
    expect(spellSlots(infos, all).map((s) => [s.level, s.max])).toEqual([[1, 4], [2, 3], [3, 3]]);
  });

  it("classes that cast on their own are unchanged", () => {
    const { all, byId } = world(ek());
    const wiz = classInfos({ ...newCharacter(), level: 5, classId: "srd:class/wizard" }, byId)[0];
    expect(casterEntry(wiz)?.name).toBe("Wizard");
    expect(casterInfoOf(wiz)).toMatchObject({ cantrips: 4, prepared: 9, maxSpellLevel: 3 });
    expect(spellListClass(wiz, all).name).toBe("Wizard");
  });
});
