/**
 * Encounters: the DM's encounter builder and combat tracker. An encounter holds the monsters and characters in a fight,
 * their initiative, whose turn it is, and a roll log. Monsters keep their own HP here; characters' HP stays on their
 * sheets (see pcCombat and pcHp).
 */
import { parseTables, type Entry } from "./parse.ts";
import { type Character, derive, wornGear, armorTable, type Derived } from "./rules.ts";
import { classInfos, casterEntry, casterKindOf } from "./multiclass.ts";
import { computeModif, spellcastingOf, type ModifCtx } from "./modif.ts";
import { catalog, inventoryOf, isActive, magicInfo, type Item } from "./inventory.ts";
import { playOf, timeNow, weaponTable, type LogEntry } from "./play.ts";
import type { CreatureStats } from "./creature.ts";

export interface Combatant {
  uid: string;
  kind: "monster" | "pc" | "other";
  /** A Creature entry id (monster) or a character id (pc). */
  ref?: string;
  /** What the tracker calls it ("Goblin Warrior 2"); a pc uses its character's name. */
  name: string;
  /** Initiative rolled or typed in; unset until rolled. */
  init?: number;
  /** Monsters and others: their Hit Points here. Characters' HP lives on their sheets. */
  hp?: number;
  maxHp?: number;
  temp?: number;
  /** Others (no stat block): what the DM typed in. */
  ac?: number;
  initBonus?: number;
  conditions?: string[];
  note?: string;
  /** Out of the fight (dead, fled): skipped when the turn moves on. */
  out?: boolean;
}

export interface Encounter {
  id: string;
  name: string;
  notes?: string;
  combatants: Combatant[];
  /** 0 before the fight starts. */
  round: number;
  /** Whose turn it is (a combatant uid). */
  turn?: string;
  log: LogEntry[];
  updated: number;
}

export function newEncounter(id: string, name = "New encounter"): Encounter {
  return { id, name, combatants: [], round: 0, log: [], updated: Date.now() };
}

export const newUid = () => Math.random().toString(36).slice(2, 10);

// ------------------------------------------------------------------ difficulty

export type Budget = Record<number, { low: number; moderate: number; high: number }>;

/** The XP Budget per Character table from the rules (SRD: Combat Encounters), by character level. */
export function xpBudgetTable(entries: Entry[]): Budget {
  const out: Budget = {};
  for (const e of entries.filter((x) => x.type === "Rule")) {
    for (const t of parseTables(e.body)) {
      const h = t.header.map((x) => x.toLowerCase());
      const lo = h.findIndex((x) => /\blow\b/.test(x));
      const mo = h.findIndex((x) => /moderate/.test(x));
      const hi = h.findIndex((x) => /\bhigh\b/.test(x));
      if (lo < 0 || mo < 0 || hi < 0 || !/level/.test(h[0] || "")) continue;
      for (const r of t.rows) {
        const lvl = parseInt(r[0], 10);
        const n = (s: string) => parseInt((s || "").replace(/,/g, ""), 10) || 0;
        if (lvl >= 1 && lvl <= 20) out[lvl] = { low: n(r[lo]), moderate: n(r[mo]), high: n(r[hi]) };
      }
      if (Object.keys(out).length) return out;
    }
  }
  return out;
}

export interface Difficulty {
  xp: number;
  budget: { low: number; moderate: number; high: number };
  /** "Low", "Moderate", "High" or "Above High"; "" with no characters or no monsters. */
  label: string;
}

/** Total monster XP against the party's summed budget (each character's own level). */
export function difficulty(monsterXp: number[], levels: number[], table: Budget): Difficulty {
  const xp = monsterXp.reduce((a, b) => a + b, 0);
  const budget = levels.reduce(
    (b, l) => {
      const row = table[Math.min(20, Math.max(1, l))];
      return row ? { low: b.low + row.low, moderate: b.moderate + row.moderate, high: b.high + row.high } : b;
    },
    { low: 0, moderate: 0, high: 0 },
  );
  // a Low encounter spends up to the Low budget, a Moderate one up to the Moderate budget, and so on
  const label = !levels.length || !budget.low || !xp ? "" : xp > budget.high ? "Above High" : xp > budget.moderate ? "High" : xp > budget.low ? "Moderate" : "Low";
  return { xp, budget, label };
}

// ------------------------------------------------------------------ turn order

/** Initiative order: highest first; ties go to the higher initiative bonus, then by name. Unrolled ones go last. */
export function turnOrder(list: Combatant[], bonusOf: (c: Combatant) => number): Combatant[] {
  return [...list].sort((a, b) => {
    if (a.init === undefined || b.init === undefined) return a.init === undefined ? (b.init === undefined ? a.name.localeCompare(b.name) : 1) : -1;
    return b.init - a.init || bonusOf(b) - bonusOf(a) || a.name.localeCompare(b.name);
  });
}

/** The next turn: the next combatant still in the fight, wrapping to the top as a new round. */
export function nextTurn(order: Combatant[], cur: string | undefined, round: number): { turn?: string; round: number } {
  const live = order.filter((c) => !c.out);
  if (!live.length) return { turn: undefined, round };
  if (!cur || round === 0) return { turn: live[0].uid, round: Math.max(1, round) };
  const i = order.findIndex((c) => c.uid === cur);
  for (let k = 1; k <= order.length; k++) {
    const j = i + k;
    const c = order[j % order.length];
    if (!c.out) return { turn: c.uid, round: j >= order.length ? round + 1 : round };
  }
  return { turn: cur, round };
}

/** The previous turn, stepping back a round past the top. */
export function prevTurn(order: Combatant[], cur: string | undefined, round: number): { turn?: string; round: number } {
  if (!cur || round <= 1 && order.findIndex((c) => c.uid === cur) <= order.findIndex((c) => !c.out)) return { turn: cur, round };
  const i = order.findIndex((c) => c.uid === cur);
  for (let k = 1; k <= order.length; k++) {
    const j = i - k;
    const c = order[(j + order.length * 2) % order.length];
    if (!c.out) return { turn: c.uid, round: j < 0 ? Math.max(1, round - 1) : round };
  }
  return { turn: cur, round };
}

/** A name for the next copy of a monster: "Goblin Warrior", then "Goblin Warrior 2"… (the first becomes "… 1"). */
export function numberedName(base: string, list: Combatant[]): { name: string; renameFirst?: string } {
  const same = list.filter((c) => c.kind === "monster" && (c.name === base || c.name.startsWith(`${base} `) && /^\d+$/.test(c.name.slice(base.length + 1))));
  if (!same.length) return { name: base };
  const nums = same.map((c) => (c.name === base ? 1 : +c.name.slice(base.length + 1)));
  return { name: `${base} ${Math.max(...nums) + 1}`, renameFirst: same.find((c) => c.name === base)?.uid };
}

// ------------------------------------------------------------------ characters

export interface PcCombat {
  ac: number;
  hpMax: number;
  hpCur: number;
  temp: number;
  init: number;
  passivePerception: number;
  speed: number;
  conditions: string[];
  deathS: number;
  deathF: number;
  concentration?: string;
  level: number;
  d: Derived;
}

/** Tables a character's numbers need, built once per content set. */
export function combatTables(entries: Entry[]) {
  const armor = armorTable(entries);
  const weapons = weaponTable(entries);
  return { armor, weapons, catalog: catalog(entries, weapons, armor) };
}

/** A character's numbers for the tracker, worked out the way the sheet does (armor, magic items, features). */
export function pcCombat(c: Character, content: { entries: Entry[]; byId: (id?: string) => Entry | undefined }, tables: ReturnType<typeof combatTables>): PcCombat {
  const { byId, entries } = content;
  const cls = byId(c.classId), bg = byId(c.backgroundId), sp = byId(c.speciesId);
  const infos = classInfos(c, byId);
  const inv = inventoryOf(c, cls, bg, tables.catalog);
  const p = playOf(c);
  const infoOf = (it: Item) => {
    const e = it.kind === "magic" && it.ref ? byId(it.ref) : undefined;
    return e ? magicInfo(e, tables.weapons, tables.armor) : undefined;
  };
  const gear = wornGear(c, { cls, background: bg, armor: tables.armor, items: inv.items });
  const ctx: ModifCtx = {
    c, classes: infos, species: sp, background: bg, entries, byId,
    items: inv.items.flatMap((it) => {
      const e = (it.kind === "magic" || it.kind === "weapon") && it.ref ? byId(it.ref) : undefined;
      if (e && it.kind === "weapon") return it.qty > 0 && e.effects?.length ? [{ item: it, entry: e, active: !!it.equipped }] : [];
      return e && it.qty > 0 ? [{ item: it, entry: e, active: isActive(it, infoOf(it)) }] : [];
    }),
    gear: { armor: gear.category, shield: gear.shield > 0 },
    active: (p.active || []).map((x) => ({ key: x.key, slot: x.slot, onSelf: x.onSelf })),
    conditions: p.conditions,
  };
  const lib = { cls, background: bg, species: sp, armor: tables.armor, items: inv.items, classes: infos };
  const fx0 = computeModif(ctx);
  const d0 = derive(c, { ...lib, modif: fx0 });
  const caster = infos.find((i) => casterKindOf(i));
  const ab = caster ? spellcastingOf(casterEntry(caster))?.ability ?? null : null;
  const fx = ab ? computeModif({ ...ctx, spell: { mod: d0.mods[ab], dc: 8 + d0.pb + d0.mods[ab], attack: d0.pb + d0.mods[ab] } }) : fx0;
  const d = fx === fx0 ? d0 : derive(c, { ...lib, modif: fx });
  const hpMax = d.hp;
  return {
    ac: d.ac, hpMax, hpCur: Math.min(hpMax, p.hpCur ?? hpMax), temp: p.hpTemp || 0, init: d.initiative,
    passivePerception: d.passivePerception, speed: d.speed, conditions: p.conditions, deathS: p.deathS, deathF: p.deathF,
    concentration: p.concentration, level: c.level, d,
  };
}

/**
 * Damage or healing the DM applies to a character, written to their sheet: Temporary Hit Points take damage first;
 * healing a character at 0 HP clears their death saves. A line goes into the character's own log too.
 */
export function pcHp(c: Character, amount: number, kind: "damage" | "heal", hpMax: number, from: string): Character {
  const p = playOf(c);
  const cur = Math.min(hpMax, p.hpCur ?? hpMax);
  let hpCur = cur, hpTemp = p.hpTemp || 0, detail: string;
  if (kind === "damage") {
    const soaked = Math.min(hpTemp, amount);
    hpTemp -= soaked;
    hpCur = Math.max(0, cur - (amount - soaked));
    detail = `HP ${cur} → ${hpCur} / ${hpMax}${soaked ? ` (${soaked} from Temporary Hit Points)` : ""}${hpCur === 0 && cur > 0 ? "<div>Drops to 0 Hit Points.</div>" : ""}`;
  } else {
    hpCur = Math.min(hpMax, cur + amount);
    detail = `HP ${cur} → ${hpCur} / ${hpMax}`;
  }
  const entry: LogEntry = {
    id: Math.random().toString(36).slice(2, 9), t: timeNow(), cls: kind === "damage" ? "dmg" : "heal",
    title: `${kind === "damage" ? "Took damage" : "Healed"} (${from})`, total: kind === "damage" ? `−${amount}` : `+${hpCur - cur}`, detail,
  };
  const revived = kind === "heal" && cur === 0 && hpCur > 0;
  return { ...c, play: { ...p, hpCur, hpTemp, ...(revived ? { deathS: 0, deathF: 0 } : {}), log: [entry, ...p.log].slice(0, 150) } };
}

/** A monster's or other combatant's HP after damage or healing (temporary HP first). */
export function npcHp(cb: Combatant, amount: number, kind: "damage" | "heal", max: number): Combatant {
  const cur = Math.min(max, cb.hp ?? max);
  if (kind === "heal") return { ...cb, hp: Math.min(max, cur + amount) };
  const soaked = Math.min(cb.temp || 0, amount);
  return { ...cb, temp: (cb.temp || 0) - soaked || undefined, hp: Math.max(0, cur - (amount - soaked)) };
}

/** A monster's numbers in the tracker: its stat block, with HP from the encounter. */
export function monsterMax(cb: Combatant, st?: CreatureStats): number {
  return cb.maxHp ?? st?.hp ?? 1;
}
