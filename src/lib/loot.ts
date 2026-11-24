/**
 * Loot after an encounter: the equipment defeated monsters carried (their stat block's Gear entry, which the SRD
 * says "can be given away or retrieved"), priced from the SRD's Equipment tables and Magic Item values, for the GM
 * to review and send to the players.
 */
import { addCoins, findCatalog, itemFrom, newItemId, NO_COINS, type CatalogItem, type Coins, type Item } from "./inventory.ts";
import type { ArmorRow } from "./rules.ts";
import type { Weapon } from "./play.ts";

/** What the GM set for an item that isn't in the catalog (an Ankheg Claw): its value and weight. */
export interface CustomDetails { valueCp?: number; weight?: number }
/** The catalog and weapon and armor tables loot is priced from, plus the GM's details for custom items (by lower-case name). */
export interface LootTables { catalog: CatalogItem[]; weapons: Weapon[]; armor: ArmorRow[]; custom?: Record<string, CustomDetails> }
export const customKey = (name: string) => name.trim().toLowerCase();
/** True when a name has no match in the catalog, so it becomes a custom item. */
export const isCustomName = (name: string, catalog: CatalogItem[]) => !parseCoins(name) && !findCatalog(parseGear(name).name, catalog);

/** One kind of item in the GM's review list: every copy of it from every defeated monster. */
export interface LootGroup {
  /** What identifies it in the list (its name, lower case). */
  key: string;
  name: string;
  qty: number;
  /** One copy's value in copper pieces, when known. */
  valueCp?: number;
  /** One copy's weight in pounds, when known. */
  weight?: number;
  /** A short line of what it is: "1d6 Slashing · Finesse, Light", "AC 11 + Dex". */
  detail: string;
  /** Which monsters had it, one name per copy ("Bandit Captain", "Bandit", "Bandit"). */
  sources: string[];
  /** The inventory item a player gets (quantity 1). */
  item: Item;
  /** Not in the catalog: the GM's own item. */
  custom?: boolean;
}

/** One copy on the players' list. */
export interface LootLine {
  name: string;
  detail: string;
  valueCp?: number;
  weight?: number;
  source: string;
  item: Item;
}

const RARITY_GP: Record<string, number> = { common: 100, uncommon: 400, rare: 4000, "very rare": 40000, legendary: 200000 };

/** "25 GP", "5 SP", "2 CP" → copper pieces. */
export function costCp(cost?: string): number | undefined {
  const m = cost?.replace(/,/g, "").match(/([\d.]+)\s*(PP|GP|EP|SP|CP)/i);
  if (!m) return undefined;
  const per: Record<string, number> = { pp: 1000, gp: 100, ep: 50, sp: 10, cp: 1 };
  return Math.round(+m[1] * per[m[2].toLowerCase()]);
}

/** Copper pieces as the coin a player would say: 2500 → "25 GP", 50 → "5 SP". */
export function cpText(cp?: number): string {
  if (cp === undefined) return "—";
  if (cp >= 100 && cp % 100 === 0) return `${(cp / 100).toLocaleString()} GP`;
  if (cp >= 100) return `${(cp / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })} GP`;
  if (cp % 10 === 0) return `${cp / 10} SP`;
  return `${cp} CP`;
}

/** "Javelins (6)" → Javelins × 6; "Light Hammers (3)" → 3; "Scimitar" → 1. */
export function parseGear(s: string): { name: string; qty: number } {
  const m = s.trim().match(/^(.*?)\s*\((\d+)\)$/);
  return m ? { name: m[1].trim(), qty: +m[2] } : { name: s.trim(), qty: 1 };
}

/**
 * Everything the defeated monsters carried, one entry per kind of item, most valuable first.
 * `magicRarity` looks up a magic item's rarity (for its SRD value); unmatched names become custom items.
 */
export function lootFromMonsters(
  defeated: { name: string; gear: string[] }[],
  tables: LootTables,
  magicRarity: (ref?: string) => string | undefined = () => undefined,
): LootGroup[] {
  const groups = new Map<string, LootGroup>();
  for (const m of defeated) {
    for (const g of m.gear) {
      const { name, qty } = parseGear(g);
      const cat = findCatalog(name, tables.catalog);
      const key = (cat?.name || name).toLowerCase();
      const cur = groups.get(key) || makeGroup(cat, name, tables, magicRarity);
      cur.qty += qty;
      cur.sources.push(...Array(qty).fill(m.name));
      groups.set(key, cur);
    }
  }
  return sortLoot([...groups.values()]);
}

/** A group for an item the GM adds by hand (a chest, a key): from the catalog when it's there, otherwise a custom item. */
export function lootGroupOf(name: string, tables: LootTables, magicRarity: (ref?: string) => string | undefined = () => undefined): LootGroup {
  const g = makeGroup(findCatalog(name, tables.catalog), name, tables, magicRarity);
  return { ...g, key: `added:${g.key}:${newItemId()}`, qty: 1, sources: ["Added by the GM"] };
}

function makeGroup(cat: CatalogItem | undefined, name: string, tables: Omit<LootTables, "catalog">, magicRarity: (ref?: string) => string | undefined): LootGroup {
  if (!cat) {
    const d = tables.custom?.[customKey(name)];
    return { key: name.toLowerCase(), name, qty: 0, valueCp: d?.valueCp, weight: d?.weight, detail: "", sources: [], custom: true, item: { id: newItemId(), name, kind: "custom", qty: 1, weight: d?.weight } };
  }
  const w = cat.kind === "weapon" ? tables.weapons.find((x) => x.name === cat.base) : undefined;
  const a = cat.kind === "armor" || cat.kind === "shield" ? tables.armor.find((x) => x.name === cat.base) : undefined;
  const detail = w ? [w.damage, w.properties].filter((x) => x && x !== "—").join(" · ") : a ? (/shield/i.test(a.category) ? `+${a.ac.replace(/^\+/, "")} AC` : `AC ${a.ac}`) : cat.tagline || "";
  const rarity = cat.kind === "magic" ? magicRarity(cat.ref)?.toLowerCase() : undefined;
  const valueCp = rarity && RARITY_GP[rarity] ? RARITY_GP[rarity] * 100 : costCp(cat.cost);
  const item = { ...itemFrom(cat, 1), equipped: undefined };
  return { key: cat.name.toLowerCase(), name: cat.name, qty: 0, valueCp, weight: cat.weight, detail, sources: [], item };
}

/** Most valuable first; items with no known value last; then by name. */
export function sortLoot<T extends { valueCp?: number; name: string }>(list: T[]): T[] {
  return [...list].sort((x, y) => (y.valueCp ?? -1) - (x.valueCp ?? -1) || x.name.localeCompare(y.name));
}

/** The GM's edits to the list before sending it: removed kinds, lowered quantities and items added by hand. */
export interface LootDraft {
  removed?: string[];
  qty?: Record<string, number>;
  added?: LootGroup[];
}

/** The review list after the GM's edits (removed kinds stay in the list, marked, so they can be put back). */
export function applyDraft(found: LootGroup[], draft: LootDraft = {}): (LootGroup & { removed: boolean; max: number })[] {
  const all = [...found, ...(draft.added || [])];
  return sortLoot(all).map((g) => {
    const max = g.qty;
    const qty = Math.max(0, Math.min(max, draft.qty?.[g.key] ?? max));
    return { ...g, qty, max, removed: !!draft.removed?.includes(g.key) || qty === 0 };
  });
}

/** One line per copy, for the players: what the GM is sending. */
export function linesOf(groups: (LootGroup & { removed?: boolean })[]): LootLine[] {
  const out: LootLine[] = [];
  for (const g of sortLoot(groups.filter((x) => !x.removed && x.qty > 0))) {
    for (let i = 0; i < g.qty; i++) {
      out.push({ name: g.name, detail: g.detail, valueCp: g.valueCp, weight: g.weight, source: g.sources[i] || g.sources[g.sources.length - 1] || "", item: { ...g.item, id: newItemId(), qty: 1 } });
    }
  }
  return out;
}

// ------------------------------------------------------------------ coins and hidden finds

/** What one kind of monster carries in this encounter (each copy carries the same), set by the GM on the Build tab. */
export interface MonsterInv {
  /** Replaces the stat block's Gear when set. */
  gear?: string[];
  coins?: Partial<Coins>;
  /** Found only by searching the body: each tier's finds go to a roll that meets its DC (tiers stack). */
  hidden?: { dc: number; finds: string[] }[];
  /** The check a search uses. */
  check?: "investigation" | "perception";
}

/** A hidden find as sent to the database: coins, or an item line like the ones on the loot list. */
export type HiddenFind = { kind: "coins"; coins: Coins } | { kind: "item"; line: LootLine };

const COIN_CP: Record<keyof Coins, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };
const COIN_ORDER = ["pp", "gp", "ep", "sp", "cp"] as const;

/** "10 GP", "10 GP 5 SP", "3gp, 2 sp" → coins; anything else → undefined. */
export function parseCoins(text: string): Coins | undefined {
  const s = text.trim().replace(/,/g, " ");
  if (!/^(\s*\d+\s*(pp|gp|ep|sp|cp)\b\s*(and\s*)?)+$/i.test(s)) return undefined;
  const out: Coins = { ...NO_COINS };
  for (const m of s.matchAll(/(\d+)\s*(pp|gp|ep|sp|cp)/gi)) out[m[2].toLowerCase() as keyof Coins] += +m[1];
  return out;
}

export const coinsCp = (c?: Partial<Coins>) => COIN_ORDER.reduce((n, k) => n + (c?.[k] || 0) * COIN_CP[k], 0);
export const hasCoins = (c?: Partial<Coins>) => coinsCp(c) > 0;

/** Coins as written: "8 GP 6 SP" (largest first; empty denominations left out). */
export function coinsText(c?: Partial<Coins>): string {
  const parts = COIN_ORDER.filter((k) => (c?.[k] || 0) > 0).map((k) => `${(c![k] || 0).toLocaleString()} ${k.toUpperCase()}`);
  return parts.join(" ") || "0 GP";
}

export function sumCoins(list: (Partial<Coins> | undefined)[]): Coins {
  return list.reduce<Coins>((a, b) => addCoins(a, { ...NO_COINS, ...(b || {}) }), { ...NO_COINS });
}

/** An even split of copper pieces, as a player's share would read: gold, silver and copper. */
export function shareOf(totalCp: number, ways: number): { each: Coins; leftCp: number } {
  if (ways <= 0) return { each: { ...NO_COINS }, leftCp: totalCp };
  const n = Math.floor(totalCp / ways);
  return { each: { ...NO_COINS, gp: Math.floor(n / 100), sp: Math.floor((n % 100) / 10), cp: n % 10 }, leftCp: totalCp - n * ways };
}

/** A hidden find from what the GM typed: coins ("10 GP") or an item (from the catalog when it's there). */
export function hiddenFindOf(text: string, source: string, tables: LootTables, magicRarity: (ref?: string) => string | undefined = () => undefined): HiddenFind {
  const coins = parseCoins(text);
  if (coins) return { kind: "coins", coins };
  const g = makeGroup(findCatalog(text.trim(), tables.catalog), text.trim(), tables, magicRarity);
  return { kind: "item", line: { name: g.name, detail: g.detail, valueCp: g.valueCp, weight: g.weight, source, item: { ...g.item, id: newItemId(), qty: 1 } } };
}

/** How a find reads in a list: "10 GP", "Ring of Protection". */
export function findLabel(f: HiddenFind): string {
  return f.kind === "coins" ? coinsText(f.coins) : f.line.name;
}
