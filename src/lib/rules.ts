/**
 * 5.5e rules used by the builder, derived from content entries.
 * Everything that varies by class/species/background is read from the
 * entry's fields and tables, so imported content works the same as the SRD.
 */
import { features, parseTables, spellInfo, stripMd, type Entry, type Table } from "./parse.ts";
import { ABILITIES, SKILLS } from "./fix.ts";
import { evalNumber, type ModifResult } from "./modif.ts";

export const ABBR: Record<string, string> = {
  Strength: "Str", Dexterity: "Dex", Constitution: "Con", Intelligence: "Int", Wisdom: "Wis", Charisma: "Cha",
};
export const SKILL_ABILITY: Record<string, string> = {
  Acrobatics: "Dexterity", "Animal Handling": "Wisdom", Arcana: "Intelligence", Athletics: "Strength",
  Deception: "Charisma", History: "Intelligence", Insight: "Wisdom", Intimidation: "Charisma",
  Investigation: "Intelligence", Medicine: "Wisdom", Nature: "Intelligence", Perception: "Wisdom",
  Performance: "Charisma", Persuasion: "Charisma", Religion: "Intelligence", "Sleight of Hand": "Dexterity",
  Stealth: "Dexterity", Survival: "Wisdom",
};
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
export const POINT_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

export type Scores = Record<string, number>;

export interface Character {
  id: string;
  name: string;
  level: number;
  classId?: string;
  subclassId?: string;
  speciesId?: string;
  speciesChoice?: string;
  backgroundId?: string;
  method: "standard" | "pointbuy" | "manual";
  base: Scores;
  bonusMode: "2-1" | "1-1-1";
  bonus: Scores;
  classSkills: string[];
  extraSkills: string[]; // e.g. Elf Keen Senses, Human Skillful
  equipClass?: string;
  equipBackground?: string;
  cantrips: string[];
  spells: string[];
  notes: string;
  updated: number;
  play?: Partial<import("./play.ts").PlayState>;
  /** Classes after the starting one (see multiclass.ts). `level` is the total character level. */
  multiclass?: import("./multiclass.ts").ClassLevel[];
  /** Set once the inventory has been edited; until then it comes from starting equipment. */
  inventory?: import("./inventory.ts").Item[];
  coins?: import("./inventory.ts").Coins;
  /** Answers to Modif `choose` blocks, keyed "<entry id>#<choice id>" (see modif.ts). */
  choices?: Record<string, string[]>;
}

export function newCharacter(): Character {
  return {
    id: Math.random().toString(36).slice(2, 10),
    name: "",
    level: 1,
    method: "standard",
    base: Object.fromEntries(ABILITIES.map((a) => [a, 10])),
    bonusMode: "2-1",
    bonus: {},
    classSkills: [],
    extraSkills: [],
    cantrips: [],
    spells: [],
    notes: "",
    updated: Date.now(),
  };
}

export const mod = (score: number) => Math.floor((score - 10) / 2);
export const fmt = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);
export const profBonus = (level: number) => 2 + Math.floor((Math.max(1, level) - 1) / 4);

/** Split "A, B, and C" / "A and B" / "A, B, or C" into items. */
export function listOf(s: string): string[] {
  return stripMd(s)
    .replace(/\s*\(see [^)]*\)/g, "")
    .split(/,\s*(?:and\s+|or\s+)?|\s+and\s+|\s+or\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function abilityList(s?: string): string[] {
  if (!s) return [];
  return listOf(s).filter((a) => ABILITIES.includes(a));
}

/** "Choose 2: Athletics, ... or Survival" / "Choose any 3 skills" */
export function skillChoice(s?: string): { count: number; from: string[] } {
  if (!s) return { count: 0, from: [] };
  const t = stripMd(s);
  const m = t.match(/Choose (?:any )?(\d+)(?: skills)?(?::\s*(.*))?/i);
  if (!m) return { count: 0, from: [] };
  const from = m[2] ? listOf(m[2]).filter((x) => SKILLS.includes(x)) : [...SKILLS];
  return { count: +m[1], from };
}

/** "(A) items; (B) items; or (C) 155 GP" */
export function equipmentOptions(s?: string): { key: string; text: string }[] {
  if (!s) return [];
  const t = stripMd(s).replace(/^Choose [^:]*:\s*/i, "");
  const parts = [...t.matchAll(/\(([A-Z])\)\s*([^;]+?)(?=;\s*(?:or\s*)?\([A-Z]\)|$)/g)];
  if (!parts.length) return [{ key: "A", text: t }];
  return parts.map((p) => ({ key: p[1], text: p[2].trim().replace(/;?\s*or$/, "") }));
}

export function classTable(cls: Entry): Table | null {
  for (const s of cls.sections) {
    for (const t of parseTables(s.md)) if (/^level$/i.test(t.header[0] || "")) return t;
  }
  return null;
}

export function tableRow(t: Table | null, level: number): Record<string, string> {
  if (!t) return {};
  const row = t.rows.find((r) => +r[0] === level);
  if (!row) return {};
  return Object.fromEntries(t.header.map((h, i) => [h, row[i]]));
}

export function hitDie(cls?: Entry): number {
  const m = (cls?.fields["hit point die"] || "").match(/D(\d+)/i);
  return m ? +m[1] : 8;
}

export interface Caster {
  cantrips: number;
  prepared: number;
  maxSpellLevel: number;
  slots: { level: number; count: string }[];
}

export function casterInfo(cls: Entry | undefined, level: number): Caster | null {
  if (!cls) return null;
  const row = tableRow(classTable(cls), level);
  if (!("Prepared Spells" in row)) return null;
  const num = (v?: string) => (v && /^\d+$/.test(v) ? +v : 0);
  const slots: { level: number; count: string }[] = [];
  let maxSpellLevel = 0;
  for (const [h, v] of Object.entries(row)) {
    const m = h.match(/Spell Level (\d+)$/);
    if (m && num(v)) {
      slots.push({ level: +m[1], count: v });
      maxSpellLevel = Math.max(maxSpellLevel, +m[1]);
    }
  }
  if ("Slot Level" in row) {
    maxSpellLevel = num(row["Slot Level"]);
    slots.push({ level: maxSpellLevel, count: row["Spell Slots"] });
  }
  return { cantrips: num(row["Cantrips"]), prepared: num(row["Prepared Spells"]), maxSpellLevel, slots };
}

/** Spells on a class list: from the class's spell list tables, else spell taglines. */
export function classSpells(cls: Entry, spells: Entry[]): Map<number, Entry[]> {
  const byName = new Map(spells.map((s) => [s.name.toLowerCase(), s]));
  const out = new Map<number, Entry[]>();
  const add = (lvl: number, e?: Entry) => {
    if (!e) return;
    const arr = out.get(lvl) || [];
    if (!arr.includes(e)) arr.push(e);
    out.set(lvl, arr);
  };
  let found = false;
  for (const s of cls.sections) {
    const m = s.title.match(/^Cantrips|^Level (\d+) .* Spells$/);
    if (!m) continue;
    const lvl = s.title.startsWith("Cantrips") ? 0 : +m[1];
    for (const t of parseTables(s.md)) for (const r of t.rows) {
      found = true;
      add(lvl, byName.get(r[0].toLowerCase()));
    }
  }
  // Spells name their classes in the tagline. Without a spell list table that's
  // the whole list; with one, it still adds spells from other packs (homebrew).
  for (const sp of spells) {
    if (found && sp.pack === cls.pack) continue;
    const info = spellInfo(sp);
    if (info && info.classes.some((c) => c.toLowerCase() === cls.name.toLowerCase())) add(info.level, sp);
  }
  return out;
}

/** A species choice table (Elven Lineages, Draconic Ancestors, ...). */
export function speciesChoice(sp?: Entry): { title: string; table: Table } | null {
  if (!sp) return null;
  for (const s of sp.sections) {
    const t = parseTables(s.md)[0];
    if (t && t.rows.length > 1) return { title: s.title, table: unfold(t) };
  }
  return null;
}

/** Two tables printed side by side (Dragon | Type | Dragon | Type) -> one. */
export function unfold(t: Table): Table {
  const n = t.header.length;
  if (n % 2 || n < 4) return t;
  const half = n / 2;
  if (t.header.slice(0, half).join("|") !== t.header.slice(half).join("|")) return t;
  const rows = [...t.rows.map((r) => r.slice(0, half)), ...t.rows.map((r) => r.slice(half))].filter((r) => r[0]);
  return { header: t.header.slice(0, half), rows };
}

/** Run-in traits (***Name.*** text) anywhere in an entry, skipping tables and headings. */
export function traits(e?: Entry): { name: string; md: string }[] {
  if (!e) return [];
  const out: { name: string; md: string }[] = [];
  let open = false;
  for (const para of e.body.split(/\n\s*\n/)) {
    const p = para.trim();
    if (!p) continue;
    if (/^#{2,6}\s/.test(p) || p.startsWith("|")) {
      open = false;
      continue;
    }
    const m = p.match(/^\*\*\*(.+?)\.?\*\*\*\.?\s*([\s\S]*)$/);
    if (m) {
      out.push({ name: m[1].replace(/\.$/, ""), md: m[2] });
      open = true;
    } else if (open && out.length) out[out.length - 1].md += "\n\n" + p;
  }
  // Entries converted to Modif write each trait as its own heading (Modif §2.4)
  if (e.effects?.length && e.type !== "Class" && e.type !== "Subclass") {
    for (const s of e.sections) if (s.level === 2 && !/^Level \d+:/.test(s.title)) out.push({ name: s.title, md: s.md });
  }
  return out;
}

/** Leading paragraphs before the first trait or heading. */
export function intro(e?: Entry): string {
  if (!e) return "";
  const out: string[] = [];
  for (const para of e.body.split(/\n\s*\n/)) {
    const p = para.trim();
    if (/^\*\*\*/.test(p) || /^#{2,6}\s/.test(p) || p.startsWith("|")) break;
    if (p) out.push(p);
  }
  return out.join("\n\n");
}

export function featName(s?: string): string {
  return stripMd(s || "").replace(/\s*\(see [^)]*\)/g, "").trim();
}

export function speedOf(sp?: Entry): number {
  const m = (sp?.fields["speed"] || "").match(/(\d+)/);
  return m ? +m[1] : 30;
}

export interface ArmorRow { name: string; ac: string; category: string; stealth: string; strength: string; weight?: string; cost?: string }

export function armorTable(rulesEntries: Entry[]): ArmorRow[] {
  const e = rulesEntries.find((x) => x.name === "Armor" && x.type === "Rule");
  if (!e) return [];
  const t = parseTables(e.body).find((x) => /^armor$/i.test(x.header[0]));
  if (!t) return [];
  const out: ArmorRow[] = [];
  let category = "";
  for (const r of t.rows) {
    if (r.slice(1).every((c) => !c)) {
      category = r[0].replace(/\s*\(.*$/, "");
      continue;
    }
    out.push({ name: r[0], ac: r[1], strength: r[2], stealth: r[3], category, weight: r[4], cost: r[5] });
  }
  return out;
}

export interface Derived {
  scores: Scores;
  mods: Scores;
  pb: number;
  saves: Record<string, { prof: boolean; value: number }>;
  skills: Record<string, { prof: boolean; value: number }>;
  hp: number;
  ac: number;
  acNote: string;
  initiative: number;
  speed: number;
  passivePerception: number;
  hitDie: number;
  /** Lowest d20 roll that is a Critical Hit with weapons (Improved Critical: 19). */
  critRange: number;
  /** Attacks per Attack action (Extra Attack). */
  attacksPerAction: number;
  /** What the Modif engine worked out, when any entry has Effects. */
  modif?: ModifResult;
}

export function finalScores(c: Character): Scores {
  const out: Scores = {};
  for (const a of ABILITIES) out[a] = Math.min(20, (c.base[a] ?? 10) + (c.bonus[a] ?? 0));
  return out;
}

export function derive(
  c: Character,
  lib: {
    cls?: Entry; species?: Entry; background?: Entry; armor: ArmorRow[];
    items?: import("./inventory.ts").Item[];
    /** All classes with their levels (from multiclass.classInfos); defaults to the one class. */
    classes?: { cls: Entry; level: number; starting: boolean; skills: string[] }[];
    /** From modif.computeModif: entries with Effects are read from their blocks, not their text. */
    modif?: ModifResult;
  },
): Derived {
  // ability scores after feats (Ability Score Improvement, Boons) when Modif has read them
  const scores = lib.modif?.scores && Object.keys(lib.modif.scores).length ? lib.modif.scores : finalScores(c);
  const mods = Object.fromEntries(ABILITIES.map((a) => [a, mod(scores[a])]));
  const pb = profBonus(c.level);
  const fx = lib.modif;
  const saveProf = fx && lib.cls && fx.encoded.has(lib.cls.id) ? [...fx.saves] : abilityList(lib.cls?.fields["saving throw proficiencies"]);
  const saves = Object.fromEntries(
    ABILITIES.map((a) => [a, { prof: saveProf.includes(a), value: mods[a] + (saveProf.includes(a) ? pb : 0) }]),
  );
  const bgSkills = listOf(lib.background?.fields["skill proficiencies"] || "").filter((s) => SKILLS.includes(s));
  const classes = lib.classes?.length ? lib.classes : lib.cls ? [{ cls: lib.cls, level: c.level, starting: true, skills: c.classSkills }] : [];
  const prof = new Set([...bgSkills, ...c.classSkills, ...c.extraSkills, ...classes.filter((k) => !k.starting).flatMap((k) => k.skills), ...(fx?.skills || [])]);
  const skills = Object.fromEntries(
    SKILLS.map((s) => [s, { prof: prof.has(s), value: mods[SKILL_ABILITY[s]] + (prof.has(s) ? pb : 0) }]),
  );
  // HP: the starting class's full die at level 1, then each class's average per level
  const hd = hitDie(lib.cls);
  const hp = classes.length
    ? Math.max(1, classes.reduce((n, k) => {
        const d = hitDie(k.cls);
        const avg = d / 2 + 1 + mods.Constitution;
        return n + (k.starting ? d + mods.Constitution + (k.level - 1) * avg : k.level * avg);
      }, 0))
    : Math.max(1, hd + mods.Constitution + (c.level - 1) * (hd / 2 + 1 + mods.Constitution));

  // AC: equipped armor and shield, else class Unarmored Defense, else 10 + Dex.
  // Without an inventory (older callers), armor is found in the starting equipment text.
  const gear = [
    equipmentOptions(lib.cls?.fields["starting equipment"]).find((o) => o.key === (c.equipClass || "A"))?.text || "",
    equipmentOptions(lib.background?.fields["equipment"]).find((o) => o.key === (c.equipBackground || "A"))?.text || "",
  ].join(", ");
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const isShieldRow = (a: ArmorRow) => /shield/i.test(a.category);
  let shield = 0;
  let worn: ArmorRow | undefined;
  let wornLabel = "";
  if (lib.items) {
    const on = lib.items.filter((i) => i.equipped && i.qty > 0 && i.base);
    const bodyItem = on.find((i) => lib.armor.some((a) => a.name === i.base && !isShieldRow(a)));
    worn = bodyItem && lib.armor.find((a) => a.name === bodyItem.base);
    wornLabel = bodyItem ? bodyItem.name : "";
    shield = on.some((i) => lib.armor.some((a) => a.name === i.base && isShieldRow(a))) ? 2 : 0;
  } else {
    shield = /\bShield\b/.test(gear) ? 2 : 0;
    worn = lib.armor.find((a) => !isShieldRow(a) && new RegExp(`\\b${esc(a.name)}\\b`).test(gear));
    wornLabel = worn?.name || "";
  }
  let ac = 10 + mods.Dexterity;
  let acNote = "10 + Dex";
  // Unarmored Defense from whichever class has it (only one way to calculate AC applies)
  const hasFeature = (className: string, feature: string) =>
    classes.some((k) => k.cls.name === className && features(k.cls).some((f) => f.name === feature && f.level <= k.level));
  if (worn) {
    const base = +(worn.ac.match(/^(\d+)/)?.[1] || 10);
    const dex = /Dex modifier \(max 2\)/.test(worn.ac) ? Math.min(2, mods.Dexterity) : /Dex/.test(worn.ac) ? mods.Dexterity : 0;
    ac = base + dex;
    acNote = wornLabel || worn.name;
  } else if (hasFeature("Barbarian", "Unarmored Defense")) {
    ac = 10 + mods.Dexterity + mods.Constitution;
    acNote = "Unarmored Defense (10 + Dex + Con)";
  } else if (hasFeature("Monk", "Unarmored Defense") && !shield) {
    ac = 10 + mods.Dexterity + mods.Wisdom;
    acNote = "Unarmored Defense (10 + Dex + Wis)";
  }
  // Modif: alternative AC formulas (best one wins) and AC bonuses
  if (fx && !worn) {
    const env = { level: c.level, total: c.level, pb, mods, scores, classLevels: {}, table: {} };
    for (const b of fx.acBases) {
      if (b.noShield && shield) continue;
      const n = evalNumber(b.expr, env);
      if (n !== null && n > ac) {
        ac = n;
        acNote = b.source;
      }
    }
  }
  if (shield) {
    ac += 2;
    acNote += " + Shield";
  }
  if (fx) {
    const wornCat = worn ? worn.category.toLowerCase() : "";
    for (const b of fx.acBonuses) {
      if (b.noShield && shield) continue;
      if (b.unarmored && worn) continue;
      if (b.armor && !b.armor.some((k) => wornCat.startsWith(k))) continue;
      ac += b.value;
      acNote += ` + ${b.source.replace(/ \(.*\)$/, "")}`;
    }
  }
  const plus = (to: string) => (fx?.bonuses || []).filter((b) => b.to === to).reduce((n, b) => n + b.value, 0);
  return {
    scores, mods, pb, saves, skills,
    hp: hp + plus("hp:max") + plus("hp:per-level") * c.level,
    ac, acNote,
    initiative: mods.Dexterity + plus("initiative"),
    speed: speedOf(lib.species) + plus("speed:walk"),
    passivePerception: 10 + skills.Perception.value + plus("passive:perception"),
    hitDie: hd,
    critRange: fx?.critRange ?? 20,
    attacksPerAction: fx?.attacksPerAction ?? 1,
    modif: fx,
  };
}

export function pointBuyUsed(base: Scores): number {
  return ABILITIES.reduce((n, a) => n + (POINT_COST[base[a]] ?? 99), 0);
}

export { ABILITIES, SKILLS };
