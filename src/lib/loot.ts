/**
 * Loot after an encounter: the equipment defeated monsters carried (their stat block's Gear entry, which the SRD
 * says "can be given away or retrieved"), priced from the SRD's Equipment tables and Magic Item values, for the GM
 * to review and send to the players.
 */
import { findCatalog, itemFrom, newItemId, type CatalogItem, type Item } from "./inventory.ts";
import type { ArmorRow } from "./rules.ts";
import type { Weapon } from "./play.ts";

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
  tables: { catalog: CatalogItem[]; weapons: Weapon[]; armor: ArmorRow[] },
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
export function lootGroupOf(name: string, tables: { catalog: CatalogItem[]; weapons: Weapon[]; armor: ArmorRow[] }, magicRarity: (ref?: string) => string | undefined = () => undefined): LootGroup {
  const g = makeGroup(findCatalog(name, tables.catalog), name, tables, magicRarity);
  return { ...g, key: `added:${g.key}:${newItemId()}`, qty: 1, sources: ["Added by the GM"] };
}

function makeGroup(cat: CatalogItem | undefined, name: string, tables: { weapons: Weapon[]; armor: ArmorRow[] }, magicRarity: (ref?: string) => string | undefined): LootGroup {
  if (!cat) {
    return { key: name.toLowerCase(), name, qty: 0, detail: "", sources: [], item: { id: newItemId(), name, kind: "custom", qty: 1 } };
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
