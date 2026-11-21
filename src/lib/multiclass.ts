/**
 * Multiclassing, read from content: each class's "As a Multiclass Character"
 * text, its Primary Ability field and progression table, and the
 * Multiclass Spellcaster table in the Multiclassing rule.
 *
 * A character keeps its starting class in classId / subclassId / classSkills /
 * cantrips / spells, and any further classes in `multiclass`. `level` is the
 * total character level, so a single-class character is unchanged.
 */
import { features, parseTables, stripMd, type Entry } from "./parse.ts";
import { ABILITIES, SKILLS } from "./fix.ts";
import { casterInfo, classTable, hitDie, listOf, type Character, type Scores } from "./rules.ts";
import { spellcastingOf } from "./modif.ts";

export interface ClassLevel {
  classId: string;
  subclassId?: string;
  level: number;
  skills?: string[]; // the skill a multiclass Bard, Ranger or Rogue grants
  cantrips?: string[];
  spells?: string[];
}

export interface ClassInfo {
  index: number; // 0 = starting class, 1.. = c.multiclass[index - 1]
  starting: boolean;
  cls: Entry;
  sub?: Entry;
  level: number;
  skills: string[];
  cantrips: string[];
  spells: string[];
}

export const MAX_LEVEL = 20;
export const SUBCLASS_LEVEL = 3;

export function extraClasses(c: Character): ClassLevel[] {
  return c.multiclass || [];
}

/** The starting class's own level: total level minus the other classes. */
export function startingLevel(c: Character): number {
  return Math.max(1, c.level - extraClasses(c).reduce((n, x) => n + x.level, 0));
}

export function classInfos(c: Character, byId: (id?: string) => Entry | undefined): ClassInfo[] {
  const out: ClassInfo[] = [];
  const start = byId(c.classId);
  if (start) {
    out.push({ index: 0, starting: true, cls: start, sub: byId(c.subclassId), level: startingLevel(c), skills: c.classSkills, cantrips: c.cantrips, spells: c.spells });
  }
  extraClasses(c).forEach((x, i) => {
    const cls = byId(x.classId);
    if (cls) out.push({ index: i + 1, starting: false, cls, sub: byId(x.subclassId), level: x.level, skills: x.skills || [], cantrips: x.cantrips || [], spells: x.spells || [] });
  });
  return out;
}

/** "Fighter 3 / Wizard 2" (or "Fighter 5" for one class). */
export function classLabel(infos: ClassInfo[], withSub = false): string {
  return infos.map((i) => `${i.cls.name} ${i.level}${withSub && i.sub ? ` (${i.sub.name})` : ""}`).join(" / ");
}

/**
 * The change to a character for setting one class's fields. Level changes keep
 * the total level in step, and never go past level 20.
 */
export function patchClass(c: Character, index: number, patch: Partial<ClassLevel>): Partial<Character> {
  const extras = extraClasses(c);
  if (index === 0) {
    const out: Partial<Character> = {};
    if (patch.classId !== undefined) out.classId = patch.classId;
    if ("subclassId" in patch) out.subclassId = patch.subclassId;
    if (patch.skills) out.classSkills = patch.skills;
    if (patch.cantrips) out.cantrips = patch.cantrips;
    if (patch.spells) out.spells = patch.spells;
    if (patch.level !== undefined) {
      const others = c.level - startingLevel(c);
      out.level = Math.min(MAX_LEVEL, Math.max(1, patch.level) + others);
    }
    return out;
  }
  const i = index - 1;
  const cur = extras[i];
  if (!cur) return {};
  const next = { ...cur, ...patch };
  let level = c.level;
  if (patch.level !== undefined) {
    const room = MAX_LEVEL - (c.level - cur.level);
    next.level = Math.min(room, Math.max(1, patch.level));
    level = c.level - cur.level + next.level;
  }
  return { multiclass: extras.map((x, k) => (k === i ? next : x)), level };
}

export function addClass(c: Character, classId: string): Partial<Character> {
  if (c.level >= MAX_LEVEL) return {};
  return { multiclass: [...extraClasses(c), { classId, level: 1 }], level: c.level + 1 };
}

export function removeClass(c: Character, index: number): Partial<Character> {
  const extras = extraClasses(c);
  const gone = extras[index - 1];
  if (!gone) return {};
  return { multiclass: extras.filter((_, k) => k !== index - 1), level: c.level - gone.level };
}

// --------------------------------------------------------- prerequisites
/** Primary Ability: "Strength or Dexterity" needs either; "Dexterity and Wisdom" needs both. */
export function primaryRequirement(cls: Entry): { mode: "any" | "all"; abilities: string[] } {
  const t = stripMd(cls.fields["primary ability"] || "");
  const abilities = listOf(t).filter((a) => ABILITIES.includes(a));
  return { mode: /\bor\b/i.test(t) ? "any" : "all", abilities };
}

/** Problems with the 13+ primary ability rule, for every class involved. Empty if none. */
export function prerequisiteProblems(classes: Entry[], scores: Scores): string[] {
  if (classes.length < 2) return [];
  const out: string[] = [];
  for (const cls of classes) {
    const r = primaryRequirement(cls);
    if (!r.abilities.length) continue;
    const ok = r.mode === "any" ? r.abilities.some((a) => scores[a] >= 13) : r.abilities.every((a) => scores[a] >= 13);
    if (!ok) {
      const need = r.abilities.join(r.mode === "any" ? " or " : " and ");
      const have = r.abilities.map((a) => `${a} ${scores[a]}`).join(", ");
      out.push(`${cls.name} needs ${need} 13 or higher (you have ${have}).`);
    }
  }
  return out;
}

// ---------------------------------------------------------------- grants


// ------------------------------------------------------------ spellcasting
export type CasterKind = "full" | "half" | "third" | "pact";

/** From the class's `spellcasting` block: full, half, third or pact progression. */
export function casterKind(cls: Entry): CasterKind | null {
  const p = spellcastingOf(cls)?.progression;
  return p === "full" || p === "half" || p === "third" || p === "pact" ? p : null;
}

/** The Multiclass Spellcaster table from the Multiclassing rule: level -> slots by spell level. */
export function multiclassSlotTable(entries: Entry[]): Map<number, number[]> {
  const rule = entries.find((e) => e.type === "Rule" && e.name === "Multiclassing");
  const out = new Map<number, number[]>();
  if (!rule) return out;
  const t = parseTables(rule.body).find((x) => /^level$/i.test(x.header[0]) && x.header.includes("9"));
  for (const r of t?.rows || []) out.set(+r[0], r.slice(1).map((v) => (/^\d+$/.test(v) ? +v : 0)));
  return out;
}

export interface Slot { level: number; max: number; pact: boolean }

/**
 * Spell slots for all classes: one Spellcasting class uses its own table;
 * two or more add up (full levels, half rounded up, a third rounded down) and
 * use the Multiclass Spellcaster table. Pact Magic slots stay separate.
 */
export function spellSlots(infos: ClassInfo[], entries: Entry[]): Slot[] {
  const casting = infos.filter((i) => {
    const k = casterKind(i.cls);
    return k === "full" || k === "half" || k === "third";
  });
  let slots: Slot[] = [];
  if (casting.length === 1) {
    const ci = casterInfo(casting[0].cls, casting[0].level);
    slots = (ci?.slots || []).map((s) => ({ level: s.level, max: +s.count || 0, pact: false }));
  } else if (casting.length > 1) {
    const lvl = casting.reduce((n, i) => {
      const k = casterKind(i.cls);
      return n + (k === "full" ? i.level : k === "half" ? Math.ceil(i.level / 2) : Math.floor(i.level / 3));
    }, 0);
    const row = multiclassSlotTable(entries).get(Math.min(MAX_LEVEL, lvl)) || [];
    slots = row.map((max, k) => ({ level: k + 1, max, pact: false })).filter((s) => s.max > 0);
  }
  const pact = infos
    .filter((i) => casterKind(i.cls) === "pact")
    .flatMap((i) => (casterInfo(i.cls, i.level)?.slots || []).map((s) => ({ level: s.level, max: +s.count || 0, pact: true })));
  return [...slots, ...pact];
}

// ------------------------------------------------------------ hit points
/** Full Hit Point Die at character level 1 (starting class), then the average for every other level. */
export function hitPoints(infos: ClassInfo[], conMod: number): number {
  let hp = 0;
  for (const i of infos) {
    const d = hitDie(i.cls);
    const avg = d / 2 + 1 + conMod;
    hp += i.starting ? d + conMod + (i.level - 1) * avg : i.level * avg;
  }
  return Math.max(1, hp);
}

/** Hit Dice pooled by die size: Fighter 5 / Paladin 5 -> 10 × d10. */
export function hitDicePools(infos: ClassInfo[]): { die: number; count: number }[] {
  const m = new Map<number, number>();
  for (const i of infos) m.set(hitDie(i.cls), (m.get(hitDie(i.cls)) || 0) + i.level);
  return [...m.entries()].sort((a, b) => b[0] - a[0]).map(([die, count]) => ({ die, count }));
}

// -------------------------------------------------------------- features
export function classFeatures(infos: ClassInfo[]): { level: number; name: string; md: string; src: string; classLevel: string }[] {
  return infos.flatMap((i) => [
    ...features(i.cls).filter((f) => f.level <= i.level).map((f) => ({ ...f, src: i.cls.name, classLevel: `${i.cls.name} ${f.level}` })),
    ...(i.sub && i.level >= SUBCLASS_LEVEL ? features(i.sub).filter((f) => f.level <= i.level).map((f) => ({ ...f, src: i.sub!.name, classLevel: `${i.cls.name} ${f.level}` })) : []),
  ]);
}

