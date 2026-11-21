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
}

/** An attack with a weapon; `prof` comes from the Effects read for the character (modif.weaponProficient). */
export function attackFor(w: Weapon, d: Derived, prof: boolean): Attack {
  const ranged = /ranged/i.test(w.category);
  const finesse = /finesse/i.test(w.properties);
  const str = d.mods.Strength;
  const dex = d.mods.Dexterity;
  const abil = ranged ? dex : finesse ? Math.max(str, dex) : str;
  const [dice, ...typeParts] = w.damage.split(" ");
  const sign = (n: number) => (n === 0 ? "" : n > 0 ? `+${n}` : `${n}`);
  const vers = w.properties.match(/Versatile \((\d+d\d+)\)/);
  return {
    name: w.name,
    ability: ranged ? "Dexterity" : finesse && dex > str ? "Dexterity" : "Strength",
    toHit: abil + (prof ? d.pb : 0),
    damage: /^\d+d\d+$/.test(dice) ? `${dice}${sign(abil)}` : dice,
    type: typeParts.join(" "),
    note: [w.properties !== "—" && w.properties, w.mastery && `Mastery: ${w.mastery}`, !prof && "not proficient"].filter(Boolean).join(" · "),
    versatile: vers ? `${vers[1]}${sign(abil)}` : undefined,
  };
}

export function unarmedStrike(d: Derived): Attack {
  return { name: "Unarmed Strike", ability: "Strength", toHit: d.mods.Strength + d.pb, damage: `${Math.max(0, 1 + d.mods.Strength)}`, type: "Bludgeoning", note: "1 + Strength modifier" };
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
