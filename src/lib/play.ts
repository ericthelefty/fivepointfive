/**
 * At-the-table state and rules: HP, slots, resources, conditions, attacks.
 * Everything is derived from content entries so imported content plays too.
 */
import { features, parseTables, spellInfo, stripMd, type Entry } from "./parse.ts";
import { casterInfo, classTable, equipmentOptions, tableRow, type Character, type Derived } from "./rules.ts";

export interface LogEntry {
  id: string;
  t: string;
  title: string;
  total: string;
  detail: string; // trusted HTML built by the app (escaped user text)
  cls: "atk" | "test" | "dmg" | "heal" | "info" | "crit" | "fumble" | "event";
}

export interface PlayState {
  hpCur?: number; // undefined = full
  hpTemp: number;
  hdUsed: number;
  deathS: number;
  deathF: number;
  slotsUsed: Record<string, number>;
  resUsed: Record<string, number>;
  conditions: string[];
  exhaustion: number;
  concentration?: string;
  inspiration: boolean;
  gear: string;
  log: LogEntry[];
}

export function playOf(c: Character): PlayState {
  return {
    hpTemp: 0, hdUsed: 0, deathS: 0, deathF: 0, slotsUsed: {}, resUsed: {}, conditions: [], exhaustion: 0,
    inspiration: false, gear: "", log: [],
    ...(c.play || {}),
  };
}

export const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

// ------------------------------------------------------------- conditions
/** What each condition does to rolls the sheet makes (2024 rules). */
export const CONDITION_EFFECTS: Record<string, { attackDis?: boolean; checkDis?: boolean; saveDis?: string[]; autoFailSave?: string[]; speed0?: boolean; note?: string }> = {
  Blinded: { attackDis: true, note: "Attack rolls against you have Advantage." },
  Charmed: { note: "Can’t attack the charmer; the charmer has Advantage on social checks against you." },
  Deafened: { note: "You can’t hear." },
  Frightened: { attackDis: true, checkDis: true, note: "Only while the source of fear is in line of sight." },
  Grappled: { speed0: true, note: "Disadvantage on attacks against anyone other than the grappler." },
  Incapacitated: { note: "No actions, Bonus Actions or Reactions; Disadvantage on Initiative." },
  Invisible: { note: "Advantage on Initiative and attack rolls; attacks against you have Disadvantage." },
  Paralyzed: { speed0: true, autoFailSave: ["Strength", "Dexterity"], note: "Incapacitated. Attacks against you have Advantage; hits within 5 ft are critical." },
  Petrified: { speed0: true, autoFailSave: ["Strength", "Dexterity"], note: "Incapacitated; Resistance to all damage." },
  Poisoned: { attackDis: true, checkDis: true },
  Prone: { attackDis: true, note: "Attacks within 5 ft against you have Advantage; others have Disadvantage." },
  Restrained: { speed0: true, attackDis: true, saveDis: ["Dexterity"] },
  Stunned: { autoFailSave: ["Strength", "Dexterity"], note: "Incapacitated. Attacks against you have Advantage." },
  Unconscious: { speed0: true, autoFailSave: ["Strength", "Dexterity"], note: "Incapacitated and Prone. Hits within 5 ft are critical." },
};

export interface RollContext {
  kind: "check" | "save" | "attack" | "init" | "death";
  ability?: string;
}

/** Advantage/Disadvantage sources from conditions, and the exhaustion penalty. */
export function conditionMods(p: PlayState, ctx: RollContext): { adv: string[]; dis: string[]; penalty: number; autoFail?: string } {
  const adv: string[] = [];
  const dis: string[] = [];
  for (const k of p.conditions) {
    const e = CONDITION_EFFECTS[k];
    if (!e) continue;
    if (ctx.kind === "attack" && e.attackDis) dis.push(k);
    if ((ctx.kind === "check") && e.checkDis) dis.push(k);
    if (ctx.kind === "save" && ctx.ability && e.saveDis?.includes(ctx.ability)) dis.push(k);
    if (ctx.kind === "save" && ctx.ability && e.autoFailSave?.includes(ctx.ability)) return { adv, dis, penalty: 0, autoFail: k };
    if (ctx.kind === "init" && k === "Invisible") adv.push(k);
    if (ctx.kind === "init" && k === "Incapacitated") dis.push(k);
    if (ctx.kind === "attack" && k === "Invisible") adv.push(k);
  }
  return { adv, dis, penalty: 2 * (p.exhaustion || 0) };
}

// ---------------------------------------------------------------- weapons
export interface Weapon {
  name: string;
  damage: string; // "1d8 Slashing"
  properties: string;
  mastery: string;
  category: string; // "Simple Melee Weapons" etc.
}

export function weaponTable(entries: Entry[]): Weapon[] {
  const e = entries.find((x) => x.type === "Rule" && x.name === "Weapons");
  if (!e) return [];
  const out: Weapon[] = [];
  for (const t of parseTables(e.body)) {
    if (!/^name$/i.test(t.header[0]) || !/damage/i.test(t.header[1] || "")) continue;
    let category = "";
    for (const r of t.rows) {
      if (r.slice(1).every((c) => !c)) {
        category = r[0];
        continue;
      }
      out.push({ name: r[0], damage: r[1], properties: r[2], mastery: r[3], category });
    }
  }
  return out;
}

const escRx = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function carriedGear(c: Character, cls?: Entry, bg?: Entry): string {
  return [
    equipmentOptions(cls?.fields["starting equipment"]).find((o) => o.key === (c.equipClass || "A"))?.text,
    equipmentOptions(bg?.fields["equipment"]).find((o) => o.key === (c.equipBackground || "A"))?.text,
    playOf(c).gear,
  ].filter(Boolean).join(", ");
}

export function weaponsCarried(gear: string, table: Weapon[]): Weapon[] {
  return table.filter((w) => new RegExp(`\\b${escRx(w.name)}s?\\b`, "i").test(gear));
}

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

export interface Attack {
  name: string;
  toHit: number;
  damage: string; // dice expression including modifier
  type: string;
  note: string;
  versatile?: string;
}

export function attackFor(w: Weapon, d: Derived, cls?: Entry): Attack {
  const ranged = /ranged/i.test(w.category);
  const finesse = /finesse/i.test(w.properties);
  const str = d.mods.Strength;
  const dex = d.mods.Dexterity;
  const abil = ranged ? dex : finesse ? Math.max(str, dex) : str;
  const prof = proficientWith(w, cls);
  const [dice, ...typeParts] = w.damage.split(" ");
  const sign = (n: number) => (n === 0 ? "" : n > 0 ? `+${n}` : `${n}`);
  const vers = w.properties.match(/Versatile \((\d+d\d+)\)/);
  return {
    name: w.name,
    toHit: abil + (prof ? d.pb : 0),
    damage: /^\d+d\d+$/.test(dice) ? `${dice}${sign(abil)}` : dice,
    type: typeParts.join(" "),
    note: [w.properties !== "—" && w.properties, w.mastery && `Mastery: ${w.mastery}`, !prof && "not proficient"].filter(Boolean).join(" · "),
    versatile: vers ? `${vers[1]}${sign(abil)}` : undefined,
  };
}

export function unarmedStrike(d: Derived): Attack {
  return { name: "Unarmed Strike", toHit: d.mods.Strength + d.pb, damage: `${Math.max(0, 1 + d.mods.Strength)}`, type: "Bludgeoning", note: "1 + Strength modifier" };
}

// --------------------------------------------------------------- resources
export interface Resource {
  key: string;
  name: string;
  max: number;
  recover: "short" | "shortOne" | "long"; // all back on a Short Rest, one back, or Long Rest only
}

const SKIP_COLS = /^(level|proficiency bonus|class features|cantrips|prepared spells|spell slots|slot level|.*spell level \d+|.*die|martial arts|sneak attack|unarmored movement|eldritch invocations|weapon mastery|favored enemy)$/i;

/** Class resources from numeric columns in the class table (Rages, Second Wind, ...). */
export function classResources(c: Character, cls?: Entry): Resource[] {
  if (!cls) return [];
  const row = tableRow(classTable(cls), c.level);
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

// ------------------------------------------------------------------ spells
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

export function castingAbility(cls?: Entry): string | null {
  if (!cls) return null;
  for (const f of features(cls)) {
    const m = f.md.match(/(Intelligence|Wisdom|Charisma) is your spellcasting ability/);
    if (m) return m[1];
  }
  return null;
}

export function slotTotals(c: Character, cls?: Entry): { level: number; max: number; pact: boolean }[] {
  const ci = casterInfo(cls, c.level);
  if (!ci) return [];
  const pact = !!cls && /Slot Level/.test((classTable(cls)?.header || []).join("|"));
  return ci.slots.map((s) => ({ level: s.level, max: +s.count || 0, pact }));
}

export function timeNow(): string {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
