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
  /** Hit Dice spent, by die size (multiclass characters can have several). */
  hdUsedBy?: Record<string, number>;
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
  /** Effects switched on (Modif toggles) and spells in effect, until ended or a rest. */
  active?: ActiveEffect[];
  /** Known forms (Wild Shape), by the form's choose id: Creature entry ids. */
  forms?: Record<string, string[]>;
  /** The creature each form is using right now, by toggle key. */
  formOf?: Record<string, string>;
  /** Dice rolled at a Long Rest and kept to use later (Portent), by feature: the values and which are used. */
  recorded?: Record<string, { source: string; values: number[]; used: boolean[] }>;
  /** Memorize Spell (Wizard 5): a swap of one prepared spell is open after a Short Rest. */
  memorize?: "ready" | "used";
  /** Creatures you've summoned or that serve you (familiars, a Ranger's beast, summoned spirits). */
  companions?: Companion[];
}

/** A summoned creature, as the Companions panel keeps it. */
export interface Companion {
  uid: string;
  /** What summoned it: the spell or feature name. */
  source: string;
  /** The spell or feature's key ("spell:<id>", a summon key): ending that ends the companion; same key replaces when limited to one. */
  key: string;
  limit?: number;
  /** A Creature entry id, or "<entry id>#<stat block anchor>" for a stat block inside a spell or feature. */
  ref?: string;
  /** Stat blocks to pick from, in the same form as `ref`. */
  options?: string[];
  /** Pick from creatures like this instead (Find Familiar: CR 0 Beasts). */
  filter?: { type?: string; crMax?: number };
  variants?: string[];
  variant?: string;
  types?: string[];
  type?: string;
  /** The spell's level, for spirits whose numbers grow with it. */
  level?: number;
  count?: number;
  /** A creature with no stat block (Mage Hand, an illusory double): what it is. */
  text?: string;
  hp?: number;
  /** The spell or feature it came from (an entry id), for options other features add (Pact of the Chain). */
  for?: string;
  /** Pick any creature (an item that becomes a creature, a random creature, a copy of one). */
  pickAny?: boolean;
  /** Dice to roll on the item's table before picking (Bag of Tricks). */
  rollDice?: string;
  /** A copy with half the original's Hit Point maximum (Simulacrum). */
  halfHp?: boolean;
  /** Choices from options other features add: a speed kind ("fly"), a damage type ("radiant"). */
  speedKind?: string;
  dmgType?: string;
}

export interface ActiveEffect {
  key: string; // ModifToggle.key, or "spell:<entry id>"
  name: string;
  kind: "toggle" | "spell";
  slot?: number;
  concentration?: boolean;
  /** How long it can last, in minutes (a Short Rest ends anything of an hour or less). */
  minutes: number;
  since: string;
  /** A spell cast on yourself: its effects on the target apply to your sheet. */
  onSelf?: boolean;
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
  skill?: string;
  /** the roll adds the Proficiency Bonus (Reliable Talent) */
  proficient?: boolean;
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
  weight?: string;
  cost?: string;
  /** the content entry, for a weapon from a pack (its Effects apply while it's equipped) */
  ref?: string;
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
      out.push({ name: r[0], damage: r[1], properties: r[2], mastery: r[3], category, weight: r[4], cost: r[5] });
    }
  }
  // weapons from content packs: one Weapon entry each, with Damage, Properties, Mastery, Weight and Cost
  // fields; the category comes from a Category field or the tagline ("*Martial Ranged Weapon (Modern)*").
  // An entry with an SRD weapon's name replaces that row (a house-ruled version).
  for (const x of entries) {
    if (x.type !== "Weapon" || !x.fields["damage"]) continue;
    const field = (k: string) => stripMd(x.fields[k] || "").trim();
    const category = field("category") || stripMd(x.tagline || "").replace(/\s*\([^)]*\)\s*$/, "").trim() || "Simple Melee Weapon";
    const w: Weapon = { name: x.name, damage: field("damage"), properties: field("properties") || "—", mastery: field("mastery"), category, weight: field("weight"), cost: field("cost"), ref: x.id };
    const at = out.findIndex((y) => y.name.toLowerCase() === x.name.toLowerCase());
    if (at >= 0) out[at] = w;
    else out.push(w);
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


export interface Attack {
  name: string;
  /** The ability the attack uses (for Rage, Reckless Attack and other ability-scoped effects). */
  ability?: string;
  /** The inventory item it comes from (for that item's own bonuses). */
  itemId?: string;
  toHit: number;
  damage: string; // dice expression including modifier
  type: string;
  note: string;
  versatile?: string;
  /** Damage dice lower than this count as this (Great Weapon Fighting); `twoHands`: only with two hands. */
  dieFloor?: { min: number; twoHands: boolean; source: string };
  /** Damage dice use their maximum. */
  maximize?: string;
}

/** What Effects change about one attack (from modif weapon rules). */
export interface AttackOpts {
  /** abilities it may use besides its own; the best one is picked */
  abilities?: string[];
  /** a damage die to use instead of the weapon's; `ifHigher`: only when it's bigger */
  die?: { die: string; ifHigher: boolean };
  /** damage types it can deal instead */
  types?: string[];
  notes?: string[];
  /** Weapon Mastery lets you use this weapon's mastery property (shown only then). */
  mastered?: boolean;
}

/** Average of a dice expression ("1d8", "2d6", "1"), to compare dice. */
export function avgDice(expr: string): number {
  return expr.split("+").reduce((n, t) => {
    const m = t.trim().match(/^(\d*)d(\d+)$/);
    return n + (m ? (+(m[1] || 1) * (+m[2] + 1)) / 2 : +t || 0);
  }, 0);
}

const sign = (n: number) => (n === 0 ? "" : n > 0 ? `+${n}` : `${n}`);
const bestAbility = (d: Derived, list: string[]) => list.reduce((best, a) => (d.mods[a] > d.mods[best] ? a : best), list[0]);

/** An attack with a weapon; `prof` comes from the Effects read for the character (modif.weaponProficient). */
export function attackFor(w: Weapon, d: Derived, prof: boolean, o: AttackOpts = {}): Attack {
  const ranged = /ranged/i.test(w.category);
  const finesse = /finesse/i.test(w.properties);
  const own = ranged ? ["Dexterity"] : finesse ? ["Strength", "Dexterity"] : ["Strength"];
  const ability = bestAbility(d, [...own, ...(o.abilities || [])]);
  const abil = d.mods[ability];
  const [dice0, ...typeParts] = w.damage.split(" ");
  const vers0 = w.properties.match(/Versatile \((\d+d\d+)\)/)?.[1];
  let dice = dice0, vers = vers0;
  if (o.die && /^\d+d\d+/.test(dice0)) {
    if (!o.die.ifHigher) { dice = o.die.die; vers = undefined; }
    else {
      if (avgDice(o.die.die) > avgDice(dice0)) dice = o.die.die;
      if (vers && avgDice(o.die.die) >= avgDice(vers)) vers = undefined;
    }
  }
  const type = [typeParts.join(" "), ...(o.types || [])].filter(Boolean).join(" or ");
  return {
    name: w.name,
    ability,
    toHit: abil + (prof ? d.pb : 0),
    damage: /^\d+d\d+/.test(dice) ? `${dice}${sign(abil)}` : dice,
    type,
    note: [w.properties !== "—" && w.properties, o.mastered && w.mastery && `Mastery: ${w.mastery}`, !prof && "not proficient", ...(o.notes || [])].filter(Boolean).join(" · "),
    versatile: vers ? `${vers}${sign(abil)}` : undefined,
  };
}

export function unarmedStrike(d: Derived, o: AttackOpts = {}): Attack {
  const ability = bestAbility(d, ["Strength", ...(o.abilities || [])]);
  const m = d.mods[ability];
  return {
    name: "Unarmed Strike",
    ability,
    toHit: m + d.pb,
    damage: o.die ? `${o.die.die}${sign(m)}` : `${Math.max(0, 1 + m)}`,
    type: ["Bludgeoning", ...(o.types || [])].join(" or "),
    note: [o.die ? "" : `1 + ${ability} modifier`, ...(o.notes || [])].filter(Boolean).join(" · "),
  };
}

// --------------------------------------------------------------- resources
export interface Resource {
  key: string;
  name: string;
  max: number;
  recover: "short" | "shortOne" | "long" | "dawn" | "never"; // all back on a Short Rest, one back, Long Rest only, at dawn, or not at all
  /** Dice rolled to regain uses at dawn (item charges); without it, all come back. */
  regain?: string;
}



// ------------------------------------------------------------------ spells




export function slotTotals(c: Character, cls?: Entry): { level: number; max: number; pact: boolean }[] {
  const ci = casterInfo(cls, c.level);
  if (!ci) return [];
  const pact = !!cls && /Slot Level/.test((classTable(cls)?.header || []).join("|"));
  return ci.slots.map((s) => ({ level: s.level, max: +s.count || 0, pact }));
}

export function timeNow(): string {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
