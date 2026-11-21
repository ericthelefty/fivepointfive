/**
 * Text-reading rules: the code that read a class's or spell's prose to work out
 * numbers, before every SRD entry had Modif Effects.
 *
 * NOT USED BY THE APP. The sheet and builder read only Effects blocks now (see
 * modif.ts). This is kept in case reading text is wanted again later, for
 * example as a fallback for homebrew content that has no Effects. Nothing in
 * src/pages or the other src/lib modules imports it; its tests keep it working.
 */
import { features, spellInfo, stripMd, type Entry } from "../parse.ts";
import { abilityList, classTable, listOf, tableRow, type Character } from "../rules.ts";
import { SKILLS } from "../fix.ts";
import type { Resource, Weapon } from "../play.ts";
import type { ClassInfo } from "../multiclass.ts";

const escRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---- from play.ts
export function proficientWith(w: Weapon, cls?: Entry): boolean {
  const t = stripMd(cls?.fields["weapon proficiencies"] || "");
  if (/simple/i.test(w.category) && /Simple/i.test(t)) return true;
  if (/martial/i.test(w.category)) {
    const m = t.match(/Martial weapons(?: that have the (.+?) propert)?/i);
    if (!m) return false;
    if (!m[1]) return true;
    return m[1].split(/ or | and |, /).some((p) => new RegExp(`\\b${escRx(p.trim())}\\b`, "i").test(w.properties));
  }
  return false;
}

// ---- from play.ts
const SKIP_COLS = /^(level|proficiency bonus|class features|cantrips|prepared spells|spell slots|slot level|.*spell level \d+|.*die|martial arts|sneak attack|unarmored movement|eldritch invocations|weapon mastery|favored enemy)$/i;

// ---- from play.ts
/** Class resources from numeric columns in the class table (Rages, Second Wind, ...). */
export function classResources(c: Character, cls?: Entry, level = c.level): Resource[] {
  if (!cls) return [];
  const row = tableRow(classTable(cls), level);
  const feats = features(cls);
  const out: Resource[] = [];
  for (const [col, v] of Object.entries(row)) {
    if (SKIP_COLS.test(col) || !/^\d+$/.test(v || "") || +v === 0) continue;
    const word = col.split(" ")[0].toLowerCase().replace(/s$/, "");
    const f = feats.find((x) => x.name.toLowerCase().includes(word));
    const txt = f?.md || "";
    const recover: Resource["recover"] = /regain one expended use when you finish a Short Rest/i.test(txt)
      ? "shortOne"
      : /regain all expended[^.]*Short or Long Rest/i.test(txt) ? "short" : "long";
    out.push({ key: col, name: f ? f.name : col, max: +v, recover });
  }
  return out;
}

// ---- from play.ts
export interface SpellRoll {
  attack: boolean;
  save?: string; // ability name
  damage?: string; // base dice
  damageFlat: number; // e.g. Magic Missile's + 1
  damageType?: string;
  heal?: string;
  perSlot?: { dice: string; above: number };
  cantripScales: boolean;
  concentration: boolean;
}

// ---- from play.ts
export function spellRoll(s: Entry): SpellRoll {
  const body = s.body;
  const dmg = body.match(/(\d+d\d+)(?:\s*\+\s*(\d+))?(?:\s*(?:\+|plus)\s*your spellcasting ability modifier)?\s+(\w+) damage/);
  const heal = body.match(/regains? (?:a number of )?Hit Points equal to (\d+d\d+)/);
  const save = body.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throw/);
  const per = body.match(/increases by (\d+d\d+) for each spell slot level above (\d+)/);
  return {
    attack: /(?:make|Make) (?:a |one )?(?:ranged|melee) spell attack/i.test(body) || /spell attack/i.test(body.slice(0, 400)),
    save: save?.[1],
    damage: dmg?.[1],
    damageFlat: dmg?.[2] ? +dmg[2] : 0,
    damageType: dmg?.[3],
    heal: heal?.[1],
    perSlot: per ? { dice: per[1], above: +per[2] } : undefined,
    cantripScales: /Cantrip Upgrade/.test(body),
    concentration: /Concentration/i.test(s.fields["duration"] || ""),
  };
}

// ---- from play.ts
/** Damage dice for a spell cast at a slot level by a character of a given level. */
export function spellDamage(s: Entry, base: string, slot: number, charLevel: number): string {
  const info = spellInfo(s);
  const r = spellRoll(s);
  const m = base.match(/^(\d+)d(\d+)$/);
  if (!m) return base;
  let n = +m[1];
  if (info?.level === 0 && r.cantripScales) n *= charLevel >= 17 ? 4 : charLevel >= 11 ? 3 : charLevel >= 5 ? 2 : 1;
  let expr = `${n}d${m[2]}`;
  if (r.perSlot && info && slot > r.perSlot.above) {
    const pm = r.perSlot.dice.match(/^(\d+)d(\d+)$/)!;
    const extra = +pm[1] * (slot - r.perSlot.above);
    expr = pm[2] === m[2] ? `${n + extra}d${m[2]}` : `${expr}+${extra}d${pm[2]}`;
  }
  return r.damageFlat ? `${expr}+${r.damageFlat}` : expr;
}

// ---- from play.ts
export function castingAbility(cls?: Entry): string | null {
  if (!cls) return null;
  for (const f of features(cls)) {
    const m = f.md.match(/(Intelligence|Wisdom|Charisma) is your spellcasting ability/);
    if (m) return m[1];
  }
  return null;
}

// ---- from multiclass.ts
export interface MulticlassGrants {
  text: string; // the class's own wording
  martial: boolean;
  skill?: { count: number; from: string[] };
  armor?: string;
  tools: string[];
}

// ---- from multiclass.ts
/** What a class gives when it isn't your starting class ("As a Multiclass Character"). */
export function multiclassGrants(cls: Entry): MulticlassGrants {
  const sec = cls.sections.find((s) => /^As a Multiclass Character$/i.test(s.title));
  const first = (sec?.md || "").split("\n").find((l) => /^\s*-\s*Gain/.test(l)) || "";
  const text = first.replace(/^\s*-\s*/, "").trim();
  const skillM = text.match(/proficiency in (one|two|\d+) skills? of your choice(?: from the [^’']+[’']s skill list)?/i);
  let skill: MulticlassGrants["skill"];
  if (skillM) {
    const count = /two/i.test(skillM[1]) ? 2 : /^\d+$/.test(skillM[1]) ? +skillM[1] : 1;
    const fromList = /skill list/i.test(skillM[0]);
    skill = { count, from: fromList ? skillChoice(cls.fields["skill proficiencies"]).from : [...SKILLS] };
  }
  const armor = text.match(/training with ([^.]+?)(?:\.|$)/i)?.[1];
  const tools = [...text.matchAll(/proficiency with ((?:one )?[A-Z][^,.]*?(?:Tools|Instrument[^,.]*))/g)].map((m) => m[1].trim());
  return { text, martial: /proficiency with Martial weapons/i.test(text), skill, armor, tools };
}

// ---- from multiclass.ts
/** Weapon proficiencies across classes: the starting class's, plus Martial weapons a multiclass grants. */
export function weaponProficiencyEntry(infos: ClassInfo[]): Entry | undefined {
  const start = infos.find((i) => i.starting)?.cls;
  if (!start) return undefined;
  const martial = infos.some((i) => !i.starting && multiclassGrants(i.cls).martial);
  if (!martial) return start;
  const base = start.fields["weapon proficiencies"] || "";
  return { ...start, fields: { ...start.fields, "weapon proficiencies": `${base}${base ? ", " : ""}Martial weapons` } };
}

// ---- from rules.ts
/** "Choose 2: Athletics, ... or Survival" / "Choose any 3 skills" */
export function skillChoice(s?: string): { count: number; from: string[] } {
  if (!s) return { count: 0, from: [] };
  const t = stripMd(s);
  const m = t.match(/Choose (?:any )?(\d+)(?: skills)?(?::\s*(.*))?/i);
  if (!m) return { count: 0, from: [] };
  const from = m[2] ? listOf(m[2]).filter((x) => SKILLS.includes(x)) : [...SKILLS];
  return { count: +m[1], from };
}

// ---- from rules.ts derive(): Unarmored Defense found by class and feature name
/** AC from a Barbarian's or Monk's Unarmored Defense, found by name in the class text. */
export function legacyUnarmoredDefense(
  classes: { cls: Entry; level: number }[], mods: Record<string, number>, shield: boolean,
): { ac: number; note: string } | null {
  const hasFeature = (className: string, feature: string) =>
    classes.some((k) => k.cls.name === className && features(k.cls).some((f) => f.name === feature && f.level <= k.level));
  if (hasFeature("Barbarian", "Unarmored Defense")) return { ac: 10 + mods.Dexterity + mods.Constitution, note: "Unarmored Defense (10 + Dex + Con)" };
  if (hasFeature("Monk", "Unarmored Defense") && !shield) return { ac: 10 + mods.Dexterity + mods.Wisdom, note: "Unarmored Defense (10 + Dex + Wis)" };
  return null;
}

// ---- from rules.ts derive(): saving throw proficiencies from the class's text field
export function legacySaveProficiencies(cls?: Entry): string[] {
  return abilityList(cls?.fields["saving throw proficiencies"]);
}
