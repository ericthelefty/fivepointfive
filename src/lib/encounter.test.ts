import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseFile, type Entry } from "./parse.ts";
import { parseCreature } from "./creature.ts";
import { newCharacter, type Character } from "./rules.ts";
import { playOf } from "./play.ts";
import { combatTables, difficulty, nextTurn, npcHp, numberedName, pcCombat, pcHp, prevTurn, turnOrder, xpBudgetTable, type Combatant } from "./encounter.ts";

const SRD = join(__dirname, "../../content/srd-5.2.1");
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : f.endsWith(".md") ? [join(d, f)] : []));
const all: Entry[] = walk(SRD).flatMap((f) => parseFile(readFileSync(f, "utf8"), "srd", f));
const index = new Map(all.map((e) => [e.id, e]));
const byId = (id?: string) => (id ? index.get(id) : undefined);
const creature = (name: string) => parseCreature(all.find((e) => e.type === "Creature" && e.name === name)!);

describe("encounter builder", () => {
  it("reads the XP Budget per Character table from the SRD", () => {
    const t = xpBudgetTable(all);
    expect(t[1]).toEqual({ low: 50, moderate: 75, high: 100 });
    expect(t[5]).toEqual({ low: 500, moderate: 750, high: 1100 });
    expect(t[20]).toEqual({ low: 6400, moderate: 13200, high: 22000 });
  });

  it("rates difficulty against the party's summed budget (the SRD's own examples)", () => {
    const t = xpBudgetTable(all);
    // Example 1: four level 1 characters, low budget 200 XP
    expect(difficulty([50, 50, 50, 50], [1, 1, 1, 1], t)).toMatchObject({ xp: 200, budget: { low: 200 }, label: "Low" });
    // up to each budget counts as that difficulty: 300 XP is Moderate (budget 300), 350 is High (budget 400)
    expect(difficulty([100, 100, 100], [1, 1, 1, 1], t).label).toBe("Moderate");
    expect(difficulty([350], [1, 1, 1, 1], t).label).toBe("High");
    expect(difficulty([450], [1, 1, 1, 1], t).label).toBe("Above High");
    // mixed levels: each character's own budget
    expect(difficulty([0], [1, 5], t).budget).toEqual({ low: 550, moderate: 825, high: 1200 });
    expect(difficulty([], [], t).label).toBe("");
  });

  it("monsters carry their XP and initiative", () => {
    const g = creature("Goblin Warrior");
    expect(g.xp).toBe(50);
    expect(g.initiative).toBe(2);
    const dragon = creature("Adult Red Dragon");
    expect(dragon.legendary?.length).toBeGreaterThan(0);
    expect(dragon.legendaryUses).toMatch(/Legendary Action Uses: 3/);
  });

  it("numbers copies of the same monster", () => {
    const list: Combatant[] = [{ uid: "a", kind: "monster", ref: "x", name: "Goblin Warrior" }];
    expect(numberedName("Goblin Warrior", list)).toEqual({ name: "Goblin Warrior 2", renameFirst: "a" });
    expect(numberedName("Goblin Warrior", [{ uid: "a", kind: "monster", name: "Goblin Warrior 1" }, { uid: "b", kind: "monster", name: "Goblin Warrior 2" }]).name).toBe("Goblin Warrior 3");
    expect(numberedName("Bugbear Warrior", list)).toEqual({ name: "Bugbear Warrior" });
  });
});

describe("combat tracker", () => {
  const cb = (uid: string, init?: number, extra: Partial<Combatant> = {}): Combatant => ({ uid, kind: "monster", name: uid, init, ...extra });

  it("orders by initiative, ties by bonus then name, unrolled last", () => {
    const bonus: Record<string, number> = { a: 1, b: 3, c: 0, d: 0 };
    const order = turnOrder([cb("a", 15), cb("b", 15), cb("c"), cb("d", 20)], (c) => bonus[c.uid]);
    expect(order.map((c) => c.uid)).toEqual(["d", "b", "a", "c"]);
  });

  it("moves the turn on, skipping anyone out of the fight, and counts rounds", () => {
    const order = [cb("a", 20), cb("b", 15, { out: true }), cb("c", 10)];
    expect(nextTurn(order, undefined, 0)).toEqual({ turn: "a", round: 1 });
    expect(nextTurn(order, "a", 1)).toEqual({ turn: "c", round: 1 });
    expect(nextTurn(order, "c", 1)).toEqual({ turn: "a", round: 2 });
    expect(prevTurn(order, "a", 2)).toEqual({ turn: "c", round: 1 });
    expect(prevTurn(order, "c", 1)).toEqual({ turn: "a", round: 1 });
  });

  it("monster damage takes temporary HP first and stops at 0; healing caps at the maximum", () => {
    expect(npcHp({ ...cb("a"), hp: 10, temp: 3 }, 5, "damage", 10)).toMatchObject({ hp: 8, temp: undefined });
    expect(npcHp({ ...cb("a"), hp: 4 }, 9, "damage", 10).hp).toBe(0);
    expect(npcHp({ ...cb("a"), hp: 4 }, 9, "heal", 10).hp).toBe(10);
  });

  it("a character's numbers come from their sheet, and the GM's damage goes back to it", () => {
    const c: Character = {
      ...newCharacter(), id: "pc1", name: "Bram", level: 5, classId: "srd:class/fighter", subclassId: "srd:subclass/champion", speciesId: "srd:species/dwarf", backgroundId: "srd:background/soldier",
      base: { Strength: 15, Dexterity: 14, Constitution: 13, Intelligence: 8, Wisdom: 10, Charisma: 12 }, bonus: { Strength: 2, Constitution: 1 }, classSkills: ["Perception", "Survival"], equipClass: "A", equipBackground: "A",
    } as Character;
    const p = pcCombat(c, { entries: all, byId }, combatTables(all));
    expect(p.hpMax).toBeGreaterThan(40);
    expect(p.hpCur).toBe(p.hpMax);
    expect(p.ac).toBeGreaterThanOrEqual(16);
    const hurt = pcHp({ ...c, play: { ...playOf(c), hpTemp: 4 } }, 10, "damage", p.hpMax, "from the GM");
    expect(playOf(hurt).hpTemp).toBe(0);
    expect(playOf(hurt).hpCur).toBe(p.hpMax - 6);
    expect(playOf(hurt).log[0].title).toMatch(/from the GM/);
    const down = pcHp(c, 999, "damage", p.hpMax, "from the GM");
    expect(playOf(down).hpCur).toBe(0);
    const up = pcHp({ ...down, play: { ...playOf(down), deathF: 2 } }, 5, "heal", p.hpMax, "from the GM");
    expect(playOf(up)).toMatchObject({ hpCur: 5, deathF: 0, deathS: 0 });
  });
});
