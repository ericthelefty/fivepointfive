/**
 * Inventory: items a character carries, what's equipped and attuned, and coins.
 *
 * Modeled on the original app: one item list with quantity, weight, an
 * equipped flag and an attuned flag. An item is "active" (what effects will
 * read) when it's carried, attuned if it requires attunement, and equipped if
 * it's something you wear or wield.
 */
import { stripMd, type Entry } from "./parse.ts";
import { equipmentOptions, type ArmorRow, type Character } from "./rules.ts";
import type { Weapon } from "./play.ts";

export type ItemKind = "weapon" | "armor" | "shield" | "gear" | "tool" | "magic" | "custom";

export interface Item {
  id: string;
  name: string; // display name: the reference name for reference items (a Spell Scroll adds its spell in brackets); custom items are named by the player
  kind: ItemKind;
  qty: number;
  ref?: string; // content entry ID (gear, tool, magic item)
  base?: string; // weapon or armor table name (also the base of a magic weapon/armor)
  weight?: number; // pounds per item
  equipped?: boolean;
  attuned?: boolean;
  note?: string;
  /** Labels a feature put on the item (Pact of the Blade's `pact-weapon`), matched by `weapon: { tag }` scopes. */
  tags?: string[];
  /** Made by a feature; removed when that feature's bond ends or it's used again. */
  conjured?: boolean;
}

export interface Coins { cp: number; sp: number; ep: number; gp: number; pp: number }
export const COIN_KEYS = ["cp", "sp", "ep", "gp", "pp"] as const;
export const NO_COINS: Coins = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
export const ATTUNEMENT_LIMIT = 3;

export interface CatalogItem {
  name: string;
  kind: ItemKind;
  ref?: string;
  base?: string;
  weight?: number;
  cost?: string;
  tagline?: string;
}

export const newItemId = () => Math.random().toString(36).slice(2, 10);

/** "5 lb." -> 5, "1/4 lb." -> 0.25, "—" -> undefined */
export function parseWeight(s?: string): number | undefined {
  const t = stripMd(s || "");
  const frac = t.match(/(\d+)\s*\/\s*(\d+)\s*lb/);
  if (frac) return +frac[1] / +frac[2];
  const m = t.match(/(\d+(?:\.\d+)?)\s*lb/);
  return m ? +m[1] : undefined;
}

// ------------------------------------------------------------ magic items
const WEARABLE = /\b(Amulet|Necklace|Periapt|Medallion|Brooch|Scarab|Cloak|Cape|Mantle|Robes?|Boots|Slippers|Gloves|Gauntlets|Bracers|Belt|Girdle|Helm|Hat|Headband|Circlet|Crown|Diadem|Goggles|Lenses|Spectacles|Eyes|Ioun Stone|Wings|Clothes|Costume|Vestments|Ring|Bracelet|Bands|Mask|Tiara|Stone of Good Luck)\b/i;

export interface MagicInfo {
  category: string; // "Weapon", "Armor", "Wondrous Item", "Ring", "Potion"…
  requiresAttunement: boolean;
  attunementNote?: string; // "by a Wizard"
  /** Magic weapons/armor that are made from a base item, and which bases are allowed. */
  base?: { kind: "weapon" | "armor" | "shield"; options: string[] };
  equippable: boolean;
}

const splitNames = (s: string) => s.split(/,\s*(?:or\s+)?|\s+or\s+/).map((x) => x.trim()).filter(Boolean);

export function magicInfo(e: Entry, weapons: Weapon[], armor: ArmorRow[]): MagicInfo {
  const t = e.tagline || "";
  const head = t.split(/,\s*(?![^()]*\))/)[0] || ""; // "Weapon (Any Simple or Martial)"
  const category = head.replace(/\s*\(.*$/, "").trim();
  const inner = head.match(/\(([^)]*)\)/)?.[1] || "";
  const att = t.match(/Requires Attunement(?:\s+([^)]*))?/i);
  let base: MagicInfo["base"];
  if (category === "Weapon" && inner) {
    let opts: Weapon[];
    if (/^Any/i.test(inner)) {
      if (/Ammunition/i.test(inner)) opts = [];
      else if (/Melee/i.test(inner)) opts = weapons.filter((w) => /Melee/i.test(w.category));
      else if (/Ranged/i.test(inner)) opts = weapons.filter((w) => /Ranged/i.test(w.category));
      else if (/Simple/i.test(inner) && !/Martial/i.test(inner)) opts = weapons.filter((w) => /Simple/i.test(w.category));
      else if (/Martial/i.test(inner) && !/Simple/i.test(inner)) opts = weapons.filter((w) => /Martial/i.test(w.category));
      else opts = weapons;
    } else {
      const names = splitNames(inner).map((n) => n.toLowerCase());
      opts = weapons.filter((w) => names.includes(w.name.toLowerCase()));
    }
    if (opts.length) base = { kind: "weapon", options: opts.map((w) => w.name) };
  } else if (category === "Armor" && inner) {
    if (/shield/i.test(inner)) base = { kind: "shield", options: armor.filter((a) => /shield/i.test(a.category)).map((a) => a.name) };
    else {
      const body = armor.filter((a) => !/shield/i.test(a.category));
      let opts: ArmorRow[];
      if (/^Any/i.test(inner)) {
        const [want, except = ""] = inner.split(/,?\s*Except\s+/i);
        const cats = ["Light", "Medium", "Heavy"].filter((k) => new RegExp(`\\b${k}\\b`, "i").test(want));
        const excluded = splitNames(except).map((n) => n.toLowerCase());
        opts = body.filter((a) => (!cats.length || cats.some((k) => a.category.startsWith(k))) && !excluded.includes(a.name.toLowerCase()));
      } else {
        const names = splitNames(inner).map((n) => n.toLowerCase());
        opts = body.filter((a) => names.includes(a.name.toLowerCase()));
      }
      if (opts.length) base = { kind: "armor", options: opts.map((a) => a.name) };
    }
  }
  const equippable =
    ["Weapon", "Armor", "Ring", "Rod", "Staff", "Wand"].includes(category) ||
    (category === "Wondrous Item" && WEARABLE.test(e.name));
  return {
    category,
    requiresAttunement: !!att,
    attunementNote: att?.[1]?.trim() || undefined,
    base,
    equippable,
  };
}

// --------------------------------------------------------------- catalog
/** Everything a player can add: weapon and armor tables, gear, tools, magic items. */
export function catalog(entries: Entry[], weapons: Weapon[], armor: ArmorRow[]): CatalogItem[] {
  const out: CatalogItem[] = [];
  for (const w of weapons) out.push({ name: w.name, kind: "weapon", base: w.name, ref: w.ref, weight: parseWeight(w.weight), cost: w.cost, tagline: w.category });
  for (const a of armor) {
    const shield = /shield/i.test(a.category);
    out.push({ name: a.name, kind: shield ? "shield" : "armor", base: a.name, weight: parseWeight(a.weight), cost: a.cost, tagline: shield ? "Shield" : `${a.category} Armor`.replace(/Armor Armor$/, "Armor") });
  }
  for (const e of entries) {
    if (e.type === "Gear" || e.type === "Tool")
      out.push({ name: e.name, kind: e.type === "Tool" ? "tool" : "gear", ref: e.id, weight: parseWeight(e.fields["weight"]), cost: e.fields["cost"], tagline: e.type });
    else if (e.type === "Magic Item") out.push({ name: e.name, kind: "magic", ref: e.id, tagline: e.tagline });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

const singulars = (n: string) => {
  const s = n.trim();
  return [s, s.replace(/ies$/i, "y"), s.replace(/es$/i, ""), s.replace(/s$/i, "")];
};

/** Find a catalog item by name, ignoring case, plurals and a parenthetical note. */
export function findCatalog(name: string, cat: CatalogItem[]): CatalogItem | undefined {
  const bare = name.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const byName = new Map(cat.map((c) => [c.name.toLowerCase(), c]));
  for (const cand of [...singulars(name), ...singulars(bare)]) {
    const hit = byName.get(cand.toLowerCase());
    if (hit) return hit;
  }
  return undefined;
}

export function itemFrom(c: CatalogItem, qty = 1, note?: string): Item {
  const wearsByDefault = c.kind === "armor" || c.kind === "shield" || c.kind === "weapon";
  return {
    id: newItemId(),
    name: c.name,
    kind: c.kind,
    qty,
    ref: c.ref,
    base: c.base,
    weight: c.weight,
    equipped: wearsByDefault || undefined,
    note,
  };
}

// ---------------------------------------------------- starting equipment
/**
 * "Chain Mail, Greatsword, 8 Javelins, Dungeoneer’s Pack, and 4 GP" -> items + coins.
 * Unknown names become custom items, so nothing in the text is lost.
 */
export function parseEquipment(text: string, cat: CatalogItem[]): { items: Item[]; coins: Coins } {
  const coins: Coins = { ...NO_COINS };
  const items: Item[] = [];
  const parts = stripMd(text)
    .split(/,\s*(?![^()]*\))(?:and\s+)?|\s+and\s+(?=\d+\s*(?:CP|SP|EP|GP|PP)\b)/i)
    .map((p) => p.trim().replace(/^and\s+/i, "").replace(/\.$/, ""))
    .filter(Boolean);
  for (const part of parts) {
    const coin = part.match(/^(\d+)\s*(CP|SP|EP|GP|PP)$/i);
    if (coin) {
      coins[coin[2].toLowerCase() as keyof Coins] += +coin[1];
      continue;
    }
    const q = part.match(/^(\d+)\s+(.+)$/);
    const qty = q ? +q[1] : 1;
    const name = q ? q[2] : part;
    const note = name.match(/\(([^)]*)\)\s*$/)?.[1];
    const hit = findCatalog(name, cat);
    if (hit) items.push(itemFrom(hit, qty, note));
    else items.push({ id: newItemId(), name, kind: "custom", qty });
  }
  // only one armor and one shield start equipped
  let armorOn = false;
  let shieldOn = false;
  for (const it of items) {
    if (it.kind === "armor") it.equipped = armorOn ? undefined : ((armorOn = true), true);
    if (it.kind === "shield") it.equipped = shieldOn ? undefined : ((shieldOn = true), true);
  }
  return { items, coins };
}

/** Add items into a list, stacking identical ones (same catalog item, no note). */
export function mergeItems(into: Item[], add: Item[]): Item[] {
  const out = into.map((i) => ({ ...i }));
  for (const it of add) {
    const same = out.find((o) => !o.note && !it.note && o.kind === it.kind && o.name === it.name && o.ref === it.ref && o.base === it.base);
    if (same) same.qty += it.qty;
    else out.push({ ...it });
  }
  return out;
}

export function addCoins(a: Coins, b: Coins): Coins {
  return Object.fromEntries(COIN_KEYS.map((k) => [k, (a[k] || 0) + (b[k] || 0)])) as unknown as Coins;
}

// --------------------------------------------------------------- rules
/** The slot an item takes when equipped: one armor and one shield at a time. */
export function slotOf(it: Item, info?: MagicInfo): "armor" | "shield" | "weapon" | "worn" | null {
  if (it.kind === "armor") return "armor";
  if (it.kind === "shield") return "shield";
  if (it.kind === "weapon") return "weapon";
  if (it.kind === "magic" && info) {
    if (info.base?.kind === "armor") return "armor";
    if (info.base?.kind === "shield") return "shield";
    if (info.base?.kind === "weapon" || info.category === "Weapon") return "weapon";
    return info.equippable ? "worn" : null;
  }
  return null;
}

export const needsAttunement = (it: Item, info?: MagicInfo) => it.kind === "magic" && !!info?.requiresAttunement;

/** Carried, attuned if it needs it, and equipped if it's worn or wielded. */
export function isActive(it: Item, info?: MagicInfo): boolean {
  if (it.qty <= 0) return false;
  if (needsAttunement(it, info) && !it.attuned) return false;
  if (slotOf(it, info) && !it.equipped) return false;
  return true;
}

export function attunedCount(items: Item[]): number {
  return items.filter((i) => i.attuned && i.qty > 0).length;
}

/** Equip or unequip; equipping armor or a shield takes off the one already worn. */
export function setEquipped(items: Item[], id: string, on: boolean, infoOf: (it: Item) => MagicInfo | undefined): Item[] {
  const target = items.find((i) => i.id === id);
  if (!target) return items;
  const slot = slotOf(target, infoOf(target));
  return items.map((i) => {
    if (i.id === id) return { ...i, equipped: on || undefined };
    if (on && (slot === "armor" || slot === "shield") && i.equipped && slotOf(i, infoOf(i)) === slot) return { ...i, equipped: undefined };
    return i;
  });
}

/** Attune or end attunement; refuses past the limit. */
export function setAttuned(items: Item[], id: string, on: boolean): { items: Item[]; refused?: string } {
  if (on && attunedCount(items) >= ATTUNEMENT_LIMIT)
    return { items, refused: `You can be attuned to at most ${ATTUNEMENT_LIMIT} magic items. End attunement to one first.` };
  return { items: items.map((i) => (i.id === id ? { ...i, attuned: on || undefined } : i)) };
}

export function totalWeight(items: Item[], coins: Coins): number {
  const goods = items.reduce((n, i) => n + (i.weight || 0) * Math.max(0, i.qty), 0);
  const coinCount = COIN_KEYS.reduce((n, k) => n + (coins[k] || 0), 0);
  return Math.round((goods + coinCount / 50) * 100) / 100; // fifty coins weigh a pound
}

/** Carrying Capacity table: Str × 15 lb. for Small/Medium, ×7.5 Tiny, ×30 Large… */
export function carryingCapacity(strength: number, size = "Medium", stepsUp = 0): number {
  // Small and Medium share a row; "one size larger" (Powerful Build) moves Small to Medium and Medium to Large
  const order = ["tiny", "small", "medium", "large", "huge", "gargantuan"];
  const mults = [7.5, 15, 15, 30, 60, 120];
  const found = order.findIndex((x) => new RegExp(x, "i").test(size));
  const i = Math.min(order.length - 1, Math.max(0, (found < 0 ? 2 : found) + stepsUp));
  return strength * mults[i];
}

// ------------------------------------------------- a character's inventory

/** "Gaming Set (same as above)", "Artisan's Tools or Musical Instrument chosen for the tool proficiency above": the tool picked in the builder. */
function chosenTools(text: string, e: Entry | undefined, c: Character): string {
  if (!e || !/same as above|chosen for the tool proficiency above/i.test(text)) return text;
  const ids = (e.effects || []).flatMap((fx) => [...fx.yaml.matchAll(/id:\s*([\w-]+),\s*kind:\s*tool/g)].map((m) => m[1]));
  const picked = ids.map((id) => c.choices?.[`${e.id}#${id}`]?.[0]).find(Boolean);
  if (!picked) return text;
  return text
    .replace(/[A-Z][^,;()]*?\(same as above\)/g, picked)
    .replace(/[A-Z][^,;()]*? chosen for the tool proficiency above/g, picked);
}

/** Starting equipment (class + background choices) plus any old free-text gear. */
export function startingInventory(c: Character, cls: Entry | undefined, bg: Entry | undefined, cat: CatalogItem[]): { items: Item[]; coins: Coins } {
  const opt = (s: string | undefined, key?: string) => equipmentOptions(s).find((o) => o.key === (key || "A"))?.text || "";
  const parts = [chosenTools(opt(cls?.fields["starting equipment"], c.equipClass), cls, c), chosenTools(opt(bg?.fields["equipment"], c.equipBackground), bg, c), c.play?.gear || ""];
  let items: Item[] = [];
  let coins: Coins = { ...NO_COINS };
  for (const text of parts) {
    if (!text.trim()) continue;
    const r = parseEquipment(text, cat);
    items = mergeItems(items, r.items);
    coins = addCoins(coins, r.coins);
  }
  // stable IDs, so an unsaved starting inventory can be edited in place
  items.forEach((it, i) => (it.id = `start-${i}`));
  return { items, coins };
}

/** The saved inventory, or the starting one until the player edits it. */
export function inventoryOf(c: Character, cls: Entry | undefined, bg: Entry | undefined, cat: CatalogItem[]): { items: Item[]; coins: Coins; fromStart: boolean } {
  if (c.inventory) return { items: c.inventory, coins: { ...NO_COINS, ...(c.coins || {}) }, fromStart: false };
  return { ...startingInventory(c, cls, bg, cat), fromStart: true };
}
