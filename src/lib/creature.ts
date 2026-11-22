/**
 * Creature stat blocks read from Creature entries (SRD animals, Monster Manual pack, homebrew), and what a
 * form (Wild Shape) does to the sheet while you're in it.
 */
import { parseTables, stripMd, type Entry } from "./parse.ts";
import { ABILITIES } from "./fix.ts";
import { mod, type Derived } from "./rules.ts";
import type { FormSpec } from "./modif.ts";

export interface CreatureDamage { expr: string; type: string }
export interface CreatureAction {
  name: string;
  text: string;
  toHit?: number;
  /** Hit damage (attacks) or failed-save damage (saves); the first part is the main one. */
  damage: CreatureDamage[];
  save?: { ability: string; dc: number; half: boolean };
}
export interface CreatureStats {
  id: string;
  name: string;
  size: string;
  /** "Beast", "Fey"… (lower case for matching). */
  type: string;
  tagline: string;
  cr: number;
  crText: string;
  ac: number;
  hp: number;
  hpText: string;
  speedText: string;
  walk: number;
  fly: number;
  swim: number;
  climb: number;
  burrow: number;
  swarm: boolean;
  scores: Record<string, number>;
  saves: Record<string, number>;
  skills: Record<string, number>;
  senses: string;
  languages: string;
  defenses: string[];
  traits: { name: string; text: string }[];
  actions: CreatureAction[];
  bonusActions: CreatureAction[];
  reactions: CreatureAction[];
  /** Legendary Actions, with the uses line (Legendary Action Uses: 3...). */
  legendary?: CreatureAction[];
  legendaryUses?: string;
  /** XP for defeating it (from the CR line: 1/4 (XP 50; PB +2)). */
  xp?: number;
  /** Initiative modifier (the Initiative line: +2 (12)), else its Dexterity modifier. */
  initiative?: number;
}

const SIZES = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];
const ABBR: Record<string, string> = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };

export function crValue(text: string): number {
  const t = text.trim().split(/[\s(]/)[0];
  const fr = t.match(/^(\d+)\/(\d+)$/);
  if (fr) return +fr[1] / +fr[2];
  const n = parseFloat(t);
  return Number.isNaN(n) ? 0 : n;
}
export const crLabel = (n: number) => (n === 0.125 ? "1/8" : n === 0.25 ? "1/4" : n === 0.5 ? "1/2" : String(n));

const num = (s: string) => +s.replace(/[−–]/g, "-").replace(/\s+/g, "");
/** "1d4 − 1" -> "1d4-1" */
const expr = (s: string) => s.replace(/[−–]/g, "-").replace(/\s+/g, "");

/** Split a section's Markdown into its `***Name.*** text` paragraphs (continuation paragraphs join the one above). */
function runIns(md: string): { name: string; text: string }[] {
  const out: { name: string; text: string }[] = [];
  for (const para of md.split(/\n\s*\n/)) {
    const p = para.trim();
    if (!p) continue;
    const m = p.match(/^\*\*\*(.+?)\.?\*\*\*\s*([\s\S]*)$/) || p.match(/^\*\*(.+?)\.\*\*\s*([\s\S]*)$/);
    if (m) out.push({ name: m[1].replace(/\.$/, "").trim(), text: m[2].trim() });
    else if (out.length) out[out.length - 1].text += `\n\n${p}`;
  }
  return out;
}

export function parseAction(name: string, md: string): CreatureAction {
  const text = stripMd(md).replace(/\s+/g, " ").trim();
  const a: CreatureAction = { name, text, damage: [] };
  const hit = text.match(/Attack Roll:\s*([+\-−]\s*\d+)/);
  if (hit) a.toHit = num(hit[1]);
  const save = text.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) Saving Throw:\s*DC (\d+)/);
  if (save) a.save = { ability: save[1], dc: +save[2], half: /Success:\s*Half damage/i.test(text) };
  // the damage after "Hit:" (attacks) or "Failure:" (saves), with any "plus 7 (2d6) Fire damage" riders
  const from = text.search(a.toHit !== undefined ? /Hit:/ : /Failure:/);
  if (from >= 0) {
    const tail = text.slice(from).split(/(?:Hit or Miss|Success|Failure or Success|Miss):/)[0];
    // the first damage, then only riders added with "plus" ("or 1d4 if Bloodied" is an alternative, not more)
    for (const m of tail.matchAll(/(plus\s+)?\d+ \(([\dd\s+\-−–]+)\) (\w+) damage/gi)) {
      if (a.damage.length && !m[1]) continue;
      a.damage.push({ expr: expr(m[2]), type: m[3] });
    }
    if (!a.damage.length) {
      // worked-out formulas (summoned spirits): "Hit: 1d8 + 4 + 3 Piercing damage", "Hit: 1d8 + 2 + 3 Bludgeoning, Piercing, or Slashing damage"
      const f = tail.match(/(?:Hit|Failure):\s*([\dd\s+\-−–]+?)\s+((?:[A-Z][a-z]+)(?:(?:,\s*|,?\s+or\s+)[A-Z][a-z]+)*)\s+damage/);
      if (f && /\d/.test(f[1])) a.damage.push({ expr: expr(f[1]), type: f[2] });
    }
  }
  return a;
}

export function parseCreature(e: Entry): CreatureStats {
  const f = e.fields;
  const tagline = e.tagline || "";
  const size = SIZES.find((s) => tagline.startsWith(s)) || "Medium";
  const typeWord = tagline.replace(/^(Tiny|Small|Medium|Large|Huge|Gargantuan)(\s+or\s+\w+)?\s+/i, "").split(/[\s,(]/)[0] || "";
  const speedText = stripMd(f["speed"] || "");
  const sp = (k: string) => {
    const m = speedText.match(new RegExp(`${k}\\s+(\\d+)\\s*ft`, "i"));
    return m ? +m[1] : 0;
  };
  const walkM = speedText.match(/^(\d+)\s*ft/);
  const scores: Record<string, number> = {};
  const saves: Record<string, number> = {};
  for (const t of parseTables(e.body)) {
    // "| | Score | Mod | Save |", or summoned spirits' "|  |  | MOD | SAVE |" (split in two halves)
    if (!t.rows.some((r) => ABBR[(r[0] || "").trim().slice(0, 3).toLowerCase()])) continue;
    for (const r of t.rows) {
      const ab = ABBR[(r[0] || "").trim().slice(0, 3).toLowerCase()];
      if (!ab) continue;
      scores[ab] = num(r[1] || "10") || 10;
      if (r[3] !== undefined && r[3].trim()) saves[ab] = num(r[3]);
    }
    break;
  }
  for (const a of ABILITIES) if (scores[a] === undefined) scores[a] = 10;
  const skills: Record<string, number> = {};
  for (const part of stripMd(f["skills"] || "").split(",")) {
    const m = part.trim().match(/^(.+?)\s*([+\-−]\s*\d+)$/);
    if (m) skills[m[1].trim()] = num(m[2]);
  }
  const crText = stripMd(f["cr"] || f["challenge"] || "0").split(/\s/)[0];
  const sec = (title: string) => e.sections.find((s) => s.title.toLowerCase() === title.toLowerCase())?.md || "";
  const acts = (title: string) => runIns(sec(title)).map((x) => parseAction(x.name, x.text));
  const defenses = ["vulnerabilities", "resistances", "immunities"].filter((k) => f[k]).map((k) => `${k[0].toUpperCase()}${k.slice(1)}: ${stripMd(f[k])}`);
  return {
    id: e.id, name: e.name, size, type: typeWord.toLowerCase(), tagline,
    cr: crValue(crText), crText,
    ac: parseInt(stripMd(f["ac"] || "10"), 10) || 10,
    hp: parseInt(stripMd(f["hp"] || "1"), 10) || 1,
    hpText: stripMd(f["hp"] || ""),
    speedText, walk: walkM ? +walkM[1] : sp("walk"), fly: sp("fly"), swim: sp("swim"), climb: sp("climb"), burrow: sp("burrow"),
    swarm: /^swarm\b/i.test(e.name) || /swarm of/i.test(tagline),
    scores, saves, skills,
    senses: stripMd(f["senses"] || ""),
    languages: stripMd(f["languages"] || ""),
    defenses,
    traits: runIns(sec("Traits")).map((x) => ({ name: x.name, text: stripMd(x.text) })),
    actions: acts("Actions"),
    bonusActions: acts("Bonus Actions"),
    reactions: acts("Reactions"),
    legendary: acts("Legendary Actions"),
    // "Legendary Action Uses: 3 (4 in Lair)…": written just above or under the Legendary Actions heading
    legendaryUses: stripMd(e.body.match(/Legendary Action Uses:[^\n]*/i)?.[0] || "").replace(/\*+/g, "").trim() || undefined,
    xp: (() => { const m = stripMd(f["cr"] || f["challenge"] || "").match(/XP\s*([\d,]+)/i); return m ? +m[1].replace(/,/g, "") : undefined; })(),
    initiative: (() => { const m = stripMd(f["initiative"] || "").match(/^([+\-−]?\s*\d+)/); return m ? num(m[1]) : Math.floor(((scores.Dexterity ?? 10) - 10) / 2); })(),
  };
}

/** Creatures a form can become: right type, CR at or under the cap, no Fly Speed unless allowed, no swarms. */
export function formEligible(cr: CreatureStats, spec: FormSpec): boolean {
  if (spec.type && cr.type !== spec.type.toLowerCase()) return false;
  if (cr.cr > spec.crMax) return false;
  if (!spec.fly && cr.fly > 0) return false;
  return !cr.swarm;
}

/** Why a creature isn't eligible, in words (for the tooltip on a greyed-out form). */
export function formWhyNot(cr: CreatureStats, spec: FormSpec): string | undefined {
  if (spec.type && cr.type !== spec.type.toLowerCase()) return `Only ${spec.type} forms.`;
  if (cr.cr > spec.crMax) return `Challenge Rating ${cr.crText} is above your maximum of ${crLabel(spec.crMax)}.`;
  if (!spec.fly && cr.fly > 0) return "You can’t take a form with a Fly Speed yet.";
  if (cr.swarm) return "Swarms can’t be chosen.";
  return undefined;
}

export const SKILL_OF: Record<string, string> = {
  Acrobatics: "Dexterity", "Animal Handling": "Wisdom", Arcana: "Intelligence", Athletics: "Strength", Deception: "Charisma",
  History: "Intelligence", Insight: "Wisdom", Intimidation: "Charisma", Investigation: "Intelligence", Medicine: "Wisdom",
  Nature: "Intelligence", Perception: "Wisdom", Performance: "Charisma", Persuasion: "Charisma", Religion: "Intelligence",
  "Sleight of Hand": "Dexterity", Stealth: "Dexterity", Survival: "Wisdom",
};
const PHYSICAL = ["Strength", "Dexterity", "Constitution"];

/**
 * Your numbers while in a form (2024 Wild Shape): Strength, Dexterity and Constitution, AC, Speed and size come
 * from the creature; you keep your HP, Int/Wis/Cha and proficiencies, and for each skill and save you use the
 * higher of your own modifier (with the creature's physical scores) or the creature's.
 */
export function applyForm(d: Derived, cr: CreatureStats, spec: FormSpec): Derived {
  const scores = { ...d.scores };
  for (const a of PHYSICAL) scores[a] = cr.scores[a];
  const mods = Object.fromEntries(ABILITIES.map((a) => [a, mod(scores[a])]));
  const saves: Derived["saves"] = {};
  for (const a of ABILITIES) {
    const s = d.saves[a];
    const own = s.value - d.mods[a] + mods[a];
    const theirs = cr.saves[a] ?? mods[a];
    saves[a] = { prof: s.prof, value: Math.max(own, theirs) };
  }
  const skills: Derived["skills"] = {};
  for (const [k, s] of Object.entries(d.skills)) {
    const ab = SKILL_OF[k];
    const own = ab ? s.value - d.mods[ab] + mods[ab] : s.value;
    skills[k] = { prof: s.prof, value: Math.max(own, cr.skills[k] ?? -99) };
  }
  const acMin = spec.acMin ?? 0;
  const ac = Math.max(cr.ac, acMin);
  return {
    ...d,
    scores, mods, saves, skills, ac,
    acNote: ac > cr.ac && spec.acMinSource ? spec.acMinSource : `${cr.name}`,
    initiative: d.initiative - d.mods.Dexterity + mods.Dexterity,
    speed: cr.walk,
    passivePerception: 10 + (skills.Perception?.value ?? mods.Wisdom),
  };
}


// ------------------------------------------------------------ stat blocks inside other entries (summons)

/** What a summoned creature's formulas read: "the spell's level", "your spell attack modifier", "your Ranger level"… */
export interface SummonContext {
  level?: number;
  spellAttack?: number;
  spellDc?: number;
  pb: number;
  mods: Record<string, number>;
  classLevels: Record<string, number>;
  /** The chosen version ("Air", "Land"…): traits and numbers marked "(Air only)" follow it. */
  variant?: string;
}

const TIMES: Record<string, number> = { twice: 2, "two times": 2, "three times": 3, "four times": 4, "five times": 5, "ten times": 10 };

/** Put the character's numbers into a summoned creature's formulas. */
export function fillFormulas(md: string, x: SummonContext): string {
  const L = x.level ?? 0;
  let t = md.replace(/[’]/g, "'").replace(/[−–]/g, "-");
  t = t.replace(/half (?:this|the) spell's level \(round down\)/gi, String(Math.floor(L / 2)));
  t = t.replace(/(?:this|the) spell's level/gi, String(L));
  if (x.spellAttack !== undefined) {
    t = t.replace(/Bonus equals your spell attack modifier/gi, `${x.spellAttack >= 0 ? "+" : ""}${x.spellAttack}`);
    t = t.replace(/your spell attack modifier/gi, `${x.spellAttack >= 0 ? "+" : ""}${x.spellAttack}`);
  }
  if (x.spellDc !== undefined) {
    t = t.replace(/DC equals your spell save DC/gi, `DC ${x.spellDc}`);
    t = t.replace(/your spell save DC/gi, String(x.spellDc));
  }
  t = t.replace(/(twice|two times|three times|four times|five times|ten times) your (\w+) level/gi, (_, m: string, cls: string) => String(TIMES[m.toLowerCase()] * (x.classLevels[cls.toLowerCase()] ?? 0)));
  t = t.replace(/your (\w+) level/gi, (all, cls: string) => (x.classLevels[cls.toLowerCase()] !== undefined ? String(x.classLevels[cls.toLowerCase()]) : all));
  t = t.replace(/(plus )?your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) modifier/gi, (_, plus: string, ab: string) => {
    const m = x.mods[ab[0].toUpperCase() + ab.slice(1).toLowerCase()] ?? 0;
    return plus ? `+ ${m}` : String(m);
  });
  t = t.replace(/your Proficiency Bonus/gi, String(x.pb));
  // "13 plus 3" -> "13 + 3"
  for (let i = 0; i < 3; i++) t = t.replace(/(\d)\s+plus\s+(\d)/gi, "$1 + $2");
  return t;
}

/** "11 + 3", "20 (Air only) or 30 (Land and Water only) + 5 for each spell level above 2" -> a number. */
export function evalStat(text: string, x: SummonContext): number | undefined {
  let t = stripMd(text).replace(/[−–]/g, "-");
  const opts = [...t.matchAll(/(\d+)\s*\(([^)]*?)\s+only\)/gi)];
  if (opts.length) {
    const v = (x.variant || "").toLowerCase();
    const pick = opts.find((m) => v && m[2].toLowerCase().includes(v)) || opts[0];
    const start = opts[0].index!, last = opts[opts.length - 1];
    t = `${t.slice(0, start)}${pick[1]}${t.slice(last.index! + last[0].length)}`;
  }
  let extra = 0;
  t = t.replace(/\+\s*(\d+)\s+for each (?:spell )?level above (\d+)/gi, (_, n: string, base: string) => {
    extra += +n * Math.max(0, (x.level ?? +base) - +base);
    return "";
  });
  const m = t.match(/^\s*(-?\d+(?:\s*[+-]\s*\d+)*)/);
  if (!m) return undefined;
  const total = m[1].replace(/\s+/g, "").split(/(?=[+-])/).reduce((n, p) => n + +p, 0);
  return total + extra;
}

/** The Markdown of a stat block headed `anchor` ("Bestial Spirit", "beast-of-the-land") inside an entry. */
export function statBlockMd(e: Entry, anchor: string): { name: string; md: string } | undefined {
  const lines = e.body.split("\n");
  const want = anchor.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^(#{1,6})\s+(.+?)\s*$/);
    if (!h) continue;
    const name = h[2];
    if (name.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") !== want) continue;
    const lvl = h[1].length;
    let j = i + 1;
    while (j < lines.length && !(lines[j].match(/^(#{1,6})\s/) && lines[j].match(/^(#{1,6})\s/)![1].length <= lvl)) j++;
    return { name, md: lines.slice(i + 1, j).join("\n") };
  }
  return undefined;
}

/** A stat block written inside another entry (a summon spell's spirit, a Ranger's beast), with your numbers in it. */
export function parseStatBlockMd(id: string, name: string, md: string, x: SummonContext): CreatureStats {
  const filled = fillFormulas(md, x);
  const lines = filled.split("\n");
  const fields: Record<string, string> = {};
  let tagline = "";
  const body: string[] = [];
  const sections: { title: string; md: string }[] = [];
  let cur: { title: string; lines: string[] } | undefined;
  for (const l of lines) {
    const s = l.trim();
    const head = s.match(/^\*\*\*(Traits|Actions|Bonus Actions|Reactions|Legendary Actions)\*\*\*$/i) || s.match(/^#{2,6}\s+(Traits|Actions|Bonus Actions|Reactions|Legendary Actions)$/i);
    if (head) {
      if (cur) sections.push({ title: cur.title, md: cur.lines.join("\n") });
      cur = { title: head[1].replace(/\b\w/g, (c) => c.toUpperCase()), lines: [] };
      continue;
    }
    if (cur) { cur.lines.push(l); continue; }
    if (!tagline && /^\*[^*].*\*$/.test(s)) { tagline = s.slice(1, -1); continue; }
    const f = s.match(/^\*\*([A-Za-z ]+)\*\*:?\s+(.*)$/);
    if (f && !s.startsWith("***")) { fields[f[1].toLowerCase()] = f[2]; continue; }
    body.push(l);
  }
  if (cur) sections.push({ title: cur.title, md: cur.lines.join("\n") });
  const v = (x.variant || "").toLowerCase();
  // traits and actions marked "(Air Only)" belong to that version
  const fits = (n: string) => {
    const m = n.match(/\(([^)]+?)\s+only\)/i);
    return !m || !v || m[1].toLowerCase().includes(v);
  };
  for (const sec of sections) {
    sec.md = sec.md.split(/\n\s*\n/).filter((p) => {
      const m = p.trim().match(/^\*\*\*(.+?)\*\*\*/);
      return !m || fits(m[1]);
    }).join("\n\n");
  }
  const ac = fields["ac"] ? evalStat(fields["ac"], x) : undefined;
  const hp = fields["hp"] ? evalStat(fields["hp"], x) : undefined;
  if (fields["speed"] && v) {
    // "30 ft.; Climb 30 ft. (Land only); Fly 60 ft. (Air only)": keep the parts for this version
    fields["speed"] = fields["speed"].split(";").map((p) => p.trim()).filter((p) => fits(p)).map((p) => p.replace(/\s*\([^)]*only\)/i, "")).join(", ");
  }
  const entry = { id, pack: "", type: "Creature", name, tags: [], tagline, fields: { ...fields, ac: String(ac ?? fields["ac"] ?? 10), hp: String(hp ?? fields["hp"] ?? 1) }, body: body.join("\n"), sections } as unknown as Entry;
  const cr = parseCreature(entry);
  if (cr.crText === "None") cr.cr = 0;
  // "Add your Proficiency Bonus to any ability check or saving throw it makes" (the vestige's Pact Bond): into its saves and listed skills
  const bond = cr.traits.map((t) => stripMd(t.text).match(/\badd (\d+) to any ability check or saving throw\b/i) || stripMd(t.text).match(/\badd (\d+) to (?:any|all) (?:of its )?saving throws\b/i)).find(Boolean);
  if (bond) {
    const n = +bond[1];
    const checksToo = /ability check/i.test(bond[0]);
    for (const ab of ABILITIES) cr.saves[ab] = (cr.saves[ab] ?? Math.floor((cr.scores[ab] - 10) / 2)) + n;
    if (checksToo) for (const k of Object.keys(cr.skills)) cr.skills[k] += n;
  }
  return cr;
}
