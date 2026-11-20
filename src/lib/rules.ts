/**
 * 5.5e rules used by the builder, derived from content entries.
 * Everything that varies by class/species/background is read from the
 * entry's fields and tables, so imported content works the same as the SRD.
 */
import { features, parseTables, spellInfo, stripMd, type Entry, type Table } from "./parse.ts";
import { ABILITIES, SKILLS } from "./fix.ts";

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
  if (!found) {
    for (const sp of spells) {
      const info = spellInfo(sp);
      if (info && info.classes.includes(cls.name)) add(info.level, sp);
    }
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

export interface ArmorRow { name: string; ac: string; category: string; stealth: string; strength: string }

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
    out.push({ name: r[0], ac: r[1], strength: r[2], stealth: r[3], category });
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
}

export function finalScores(c: Character): Scores {
  const out: Scores = {};
  for (const a of ABILITIES) out[a] = Math.min(20, (c.base[a] ?? 10) + (c.bonus[a] ?? 0));
  return out;
}

export function derive(
  c: Character,
  lib: { cls?: Entry; species?: Entry; background?: Entry; armor: ArmorRow[] },
): Derived {
  const scores = finalScores(c);
  const mods = Object.fromEntries(ABILITIES.map((a) => [a, mod(scores[a])]));
  const pb = profBonus(c.level);
  const saveProf = abilityList(lib.cls?.fields["saving throw proficiencies"]);
  const saves = Object.fromEntries(
    ABILITIES.map((a) => [a, { prof: saveProf.includes(a), value: mods[a] + (saveProf.includes(a) ? pb : 0) }]),
  );
  const bgSkills = listOf(lib.background?.fields["skill proficiencies"] || "").filter((s) => SKILLS.includes(s));
  const prof = new Set([...bgSkills, ...c.classSkills, ...c.extraSkills]);
  const skills = Object.fromEntries(
    SKILLS.map((s) => [s, { prof: prof.has(s), value: mods[SKILL_ABILITY[s]] + (prof.has(s) ? pb : 0) }]),
  );
  const hd = hitDie(lib.cls);
  const hp = Math.max(1, hd + mods.Constitution + (c.level - 1) * (hd / 2 + 1 + mods.Constitution));

  // AC: armor from starting equipment, else class Unarmored Defense, else 10 + Dex
  const gear = [
    equipmentOptions(lib.cls?.fields["starting equipment"]).find((o) => o.key === (c.equipClass || "A"))?.text || "",
    equipmentOptions(lib.background?.fields["equipment"]).find((o) => o.key === (c.equipBackground || "A"))?.text || "",
  ].join(", ");
  const shield = /\bShield\b/.test(gear) ? 2 : 0;
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const worn = lib.armor.find((a) => !/shield/i.test(a.category) && new RegExp(`\\b${esc(a.name)}\\b`).test(gear));
  let ac = 10 + mods.Dexterity;
  let acNote = "10 + Dex";
  const feats = lib.cls ? features(lib.cls).filter((f) => f.level <= c.level).map((f) => f.name) : [];
  if (worn) {
    const base = +(worn.ac.match(/^(\d+)/)?.[1] || 10);
    const dex = /Dex modifier \(max 2\)/.test(worn.ac) ? Math.min(2, mods.Dexterity) : /Dex/.test(worn.ac) ? mods.Dexterity : 0;
    ac = base + dex;
    acNote = worn.name;
  } else if (feats.includes("Unarmored Defense") && lib.cls?.name === "Barbarian") {
    ac = 10 + mods.Dexterity + mods.Constitution;
    acNote = "Unarmored Defense (10 + Dex + Con)";
  } else if (feats.includes("Unarmored Defense") && lib.cls?.name === "Monk" && !shield) {
    ac = 10 + mods.Dexterity + mods.Wisdom;
    acNote = "Unarmored Defense (10 + Dex + Wis)";
  }
  if (shield) {
    ac += 2;
    acNote += " + Shield";
  }
  return {
    scores, mods, pb, saves, skills, hp, ac, acNote,
    initiative: mods.Dexterity,
    speed: speedOf(lib.species),
    passivePerception: 10 + skills.Perception.value,
    hitDie: hd,
  };
}

export function pointBuyUsed(base: Scores): number {
  return ABILITIES.reduce((n, a) => n + (POINT_COST[base[a]] ?? 99), 0);
}

export { ABILITIES, SKILLS };
