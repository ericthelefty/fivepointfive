/**
 * Battle maps: a campaign's map images with their grids, and each encounter's map state (where the tokens stand, which
 * squares the fog covers, whether the players can see it). See supabase/migrations/0014_maps.sql.
 *
 * Positions are in grid squares. Square (x, y) covers the image from (ox + x·size, oy + y·size), one `size` wide, so
 * squares can start left of or above the image when the grid doesn't line up with its edge.
 */
import { useEffect, useState } from "react";
import { supabase } from "./backend.ts";
import { MAX_UPLOAD_BYTES, shrinkImage } from "./backgrounds.ts";
import type { Combatant } from "./encounter.ts";

export const MAP_BUCKET = "fivepointfive-maps";
/** Map images are kept up to this many pixels on their long side (big enough for a 60-square map at 70 px a square). */
export const MAP_MAX_SIDE = 4096;

export interface MapGrid {
  /** Draw the lines (off when the image has its own grid printed on it, and this one just lines up with it). */
  show: boolean;
  /** A square's width in the image's own pixels. */
  size: number;
  /** Its height, when that differs (a printed grid that isn't quite square); unset: the same as the width. */
  sizeY?: number;
  /** Where the grid's lines start (0 ≤ ox < size, 0 ≤ oy < height). */
  ox: number;
  oy: number;
  color: string;
  /** 0–1 */
  opacity: number;
  /** Feet per square. */
  feet: number;
}

export interface CampaignMap {
  id: string;
  campaignId: string;
  name: string;
  path: string;
  width: number;
  height: number;
  grid: MapGrid;
}

export interface MapToken {
  /** The combatant's uid. */
  uid: string;
  name: string;
  kind: "monster" | "pc" | "other";
  /** A character's id (pc tokens), so its player can move it. */
  char?: string;
  /** Top-left square; unset while the token waits in the tray. */
  x?: number;
  y?: number;
  /** Squares across: Tiny–Medium 1, Large 2, Huge 3, Gargantuan 4. */
  size: number;
  /** The GM set its size by hand (otherwise it follows the creature's size). */
  sized?: boolean;
  /** The GM hid it from the players. */
  hidden?: boolean;
  /** Out of the fight (dead, fled, gave up). */
  out?: boolean;
  /** A line of text the GM put on the token ("Blessed", "Leader"). */
  note?: string;
  /** Only the GM sees the text (the database leaves it out for players). */
  noteGm?: boolean;
}

/** The longest text a token carries. */
export const NOTE_MAX = 40;

export interface MapFog {
  on: boolean;
  /** Squares the players can see, as "x,y": what the GM uncovered, less any fog blocks. The database and the players'
   * map go by this alone. */
  cells: string[];
  /** The squares the GM uncovered with the brush (unset on older maps: the same as `cells`). */
  revealed?: string[];
  /** Rectangles of fog the GM drew, which cover whatever is under them; they can be moved and resized. */
  blocks?: FogBlock[];
}

/** A rectangle of fog, in grid squares. */
export interface FogBlock { id: string; x: number; y: number; w: number; h: number }

/** An encounter's map, as the GM keeps it. */
export interface EncounterMap {
  encounterId: string;
  mapId: string | null;
  title: string;
  shown: boolean;
  tokens: MapToken[];
  fog: MapFog;
  turn?: string | null;
  round: number;
}

/** What encounter_map() gives: a player's view (or the GM's, with everything). */
export interface MapView extends Omit<EncounterMap, "mapId"> {
  campaignId: string;
  gm: boolean;
  map: Omit<CampaignMap, "campaignId"> | null;
  /** The characters this member plays. */
  mine: string[];
}

export const DEFAULT_GRID: MapGrid = { show: true, size: 70, ox: 0, oy: 0, color: "#000000", opacity: 0.35, feet: 5 };
export const gridOf = (g: Partial<MapGrid> | undefined): MapGrid => ({ ...DEFAULT_GRID, ...(g || {}) });

// ------------------------------------------------------------------ grid maths
const mod = (a: number, n: number) => ((a % n) + n) % n;

/** A square's height (its width is `size`). */
export const sizeH = (g: MapGrid) => g.sizeY ?? g.size;

/** Keep a grid's sizes sensible and its offset inside one square, so the same grid has one way to write it. */
export function normGrid(g: MapGrid): MapGrid {
  const size = Math.max(8, Math.min(1000, g.size));
  const h = Math.max(8, Math.min(1000, g.sizeY ?? size));
  const out: MapGrid = { ...g, size, ox: mod(g.ox, size), oy: mod(g.oy, h) };
  if (Math.abs(h - size) > 0.001) out.sizeY = h; else delete out.sizeY;
  return out;
}

/** The square a point on the image falls in. */
export function cellAt(g: MapGrid, px: number, py: number): { x: number; y: number } {
  return { x: Math.floor((px - g.ox) / g.size), y: Math.floor((py - g.oy) / sizeH(g)) };
}

/** Where a square (or a token `n` squares across) sits on the image: its left and top, width and height. */
export function cellRect(g: MapGrid, x: number, y: number, n = 1) {
  const h = sizeH(g);
  return { left: g.ox + x * g.size, top: g.oy + y * h, w: n * g.size, h: n * h };
}

/** The squares that touch the image: x from x0 to x1, y from y0 to y1 (inclusive). */
export function gridBounds(g: MapGrid, w: number, h: number) {
  const a = cellAt(g, 0, 0), b = cellAt(g, w - 0.001, h - 0.001);
  return { x0: a.x, y0: a.y, x1: b.x, y1: b.y };
}

/** Keep a token on the map. */
export function clampCell(g: MapGrid, w: number, h: number, x: number, y: number, n = 1) {
  const b = gridBounds(g, w, h);
  return { x: Math.max(b.x0, Math.min(b.x1 - n + 1, x)), y: Math.max(b.y0, Math.min(b.y1 - n + 1, y)) };
}

/**
 * A grid that fits one square drawn over the image (from the GM dragging a box round one printed square): the box is
 * the square, and its corner is where grid lines cross.
 */
export function gridFromBox(g: MapGrid, ax: number, ay: number, bx: number, by: number): MapGrid {
  const w = Math.abs(bx - ax), h = Math.abs(by - ay);
  if (w < 8 || h < 8) return g;
  return normGrid({ ...g, size: w, sizeY: h, ox: Math.min(ax, bx), oy: Math.min(ay, by) });
}

/** A grid with `n` columns across the image's width (it stays where it is: nudge it to fit). */
export function gridAcross(g: MapGrid, w: number, n: number): MapGrid {
  if (!(n >= 1)) return g;
  return normGrid({ ...g, size: w / n, sizeY: sizeH(g) });
}

/** A grid with `n` rows down the image's height. */
export function gridDown(g: MapGrid, h: number, n: number): MapGrid {
  if (!(n >= 1)) return g;
  return normGrid({ ...g, sizeY: h / n });
}

/** How many columns and rows fit the image (rounded, for showing). */
export function gridCount(g: MapGrid, w: number, h: number) {
  return { cols: Math.round(w / g.size), rows: Math.round(h / sizeH(g)) };
}

/** Squares across for a creature size. */
export function sizeSquares(size?: string): number {
  return size === "Large" ? 2 : size === "Huge" ? 3 : size === "Gargantuan" ? 4 : 1;
}

/** Distance in feet between two squares, the 2024 way: every square counts as 5 feet, diagonals too. */
export function feetBetween(a: { x: number; y: number }, b: { x: number; y: number }, feet = 5): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) * feet;
}

// ------------------------------------------------------------------ fog
export const cellKey = (x: number, y: number) => `${x},${y}`;

/** The squares a brush `r` squares from its centre covers (a round brush; r 0 is one square). */
export function brushCells(x: number, y: number, r: number): string[] {
  const out: string[] = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r) out.push(cellKey(x + dx, y + dy));
  return out;
}

/** The squares in a box from one square to another. */
export function rectCells(a: { x: number; y: number }, b: { x: number; y: number }): string[] {
  const out: string[] = [];
  for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) out.push(cellKey(x, y));
  return out;
}

/** What the GM uncovered with the brush. */
export const fogRevealed = (f: MapFog) => f.revealed ?? f.cells;

/** The squares a fog block covers. */
export const blockCells = (b: FogBlock) => rectCells({ x: b.x, y: b.y }, { x: b.x + b.w - 1, y: b.y + b.h - 1 });

/** A fog with these uncovered squares and blocks, and what the players see worked out from them. */
export function withFog(f: MapFog, revealed: string[], blocks: FogBlock[]): MapFog {
  const hidden = new Set(blocks.flatMap(blockCells));
  const out: MapFog = { ...f, revealed, cells: revealed.filter((c) => !hidden.has(c)) };
  if (blocks.length) out.blocks = blocks; else delete out.blocks;
  return out;
}

/** Uncover (or cover) some squares. */
export function paintFog(fog: MapFog, cells: string[], reveal: boolean): MapFog {
  const s = new Set(fogRevealed(fog));
  let changed = false;
  for (const c of cells) {
    if (reveal ? !s.has(c) : s.has(c)) { changed = true; if (reveal) s.add(c); else s.delete(c); }
  }
  return changed ? withFog(fog, [...s], fog.blocks || []) : fog;
}

/** Add, change or remove fog blocks. */
export const setBlocks = (fog: MapFog, blocks: FogBlock[]): MapFog => withFog(fog, fogRevealed(fog), blocks);

/** A block kept at least one square each way. */
export function normBlock(b: FogBlock): FogBlock {
  return { ...b, w: Math.max(1, Math.round(b.w)), h: Math.max(1, Math.round(b.h)), x: Math.round(b.x), y: Math.round(b.y) };
}

/** Every square of the map, uncovered. */
export function allCells(g: MapGrid, w: number, h: number): string[] {
  const b = gridBounds(g, w, h);
  return rectCells({ x: b.x0, y: b.y0 }, { x: b.x1, y: b.y1 });
}

/** Can the players see a token (the same rule as token_seen() in the database). */
export function tokenSeen(t: MapToken, fog: MapFog): boolean {
  if (t.hidden) return false;
  if (t.kind === "pc" || t.x == null || t.y == null || !fog.on) return true;
  const s = new Set(fog.cells);
  for (let dy = 0; dy < t.size; dy++) for (let dx = 0; dx < t.size; dx++) if (s.has(cellKey(t.x + dx, t.y! + dy))) return true;
  return false;
}

// ------------------------------------------------------------------ tokens
/**
 * The encounter's tokens from its combatants: everyone in the fight gets one, keeping where it stood and whether the GM
 * hid it; anyone taken out of the encounter loses theirs.
 */
export function syncTokens(prev: MapToken[], combatants: Combatant[], info: (c: Combatant) => { name: string; size: number; out: boolean }): MapToken[] {
  const old = new Map(prev.map((t) => [t.uid, t]));
  return combatants.map((c) => {
    const o = old.get(c.uid);
    const i = info(c);
    const t: MapToken = { uid: c.uid, name: i.name, kind: c.kind, size: o?.sized ? o.size : i.size };
    if (o?.sized) t.sized = true;
    if (c.kind === "pc" && c.ref) t.char = c.ref;
    if (o?.x != null && o.y != null) { t.x = o.x; t.y = o.y; }
    if (o?.hidden) t.hidden = true;
    if (o?.note) { t.note = o.note; if (o.noteGm) t.noteGm = true; }
    if (i.out || c.out || c.surrendered) t.out = true;
    return t;
  });
}

export const sameTokens = (a: MapToken[], b: MapToken[]) => JSON.stringify(a) === JSON.stringify(b);

/** Two or three letters for a token: "Goblin Warrior 2" → "GW2". */
export function tokenLabel(name: string): string {
  const num = name.match(/\s(\d+)$/)?.[1] || "";
  const words = name.replace(/\s\d+$/, "").split(/[\s-]+/).filter(Boolean);
  const letters = words.length > 1 ? words.slice(0, num ? 2 : 3).map((w) => w[0]).join("") : (words[0] || "?").slice(0, num ? 1 : 2);
  return (letters.toUpperCase() + num).slice(0, 4);
}

// ------------------------------------------------------------------ database
type Row = Record<string, unknown>;
const toMap = (r: Row): CampaignMap => ({
  id: r.id as string, campaignId: r.campaign_id as string, name: (r.name as string) || "", path: r.path as string,
  width: r.width as number, height: r.height as number, grid: gridOf(r.grid as Partial<MapGrid>),
});
const toEncMap = (r: Row): EncounterMap => ({
  encounterId: r.encounter_id as string, mapId: (r.map_id as string) || null, title: (r.title as string) || "", shown: !!r.shown,
  tokens: (r.tokens as MapToken[]) || [], fog: { on: false, cells: [], ...((r.fog as Partial<MapFog>) || {}) }, turn: (r.turn as string) || null, round: (r.round as number) || 0,
});
const need = (msg: string) => (msg.includes("maps") || msg.includes("encounter_map") ? "Maps need a database update: run supabase/migrations/0014_maps.sql (see docs/SELF_HOSTING.md)." : msg);

export async function listMaps(campaignId: string): Promise<CampaignMap[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("maps").select("*").eq("campaign_id", campaignId).order("created_at", { ascending: false });
  if (error) throw new Error(need(error.message));
  return (data || []).map(toMap);
}

export async function getMap(id: string): Promise<CampaignMap | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("maps").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(need(error.message));
  return data ? toMap(data) : null;
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Upload a map image to a campaign's library. */
export async function addMap(campaignId: string, file: File, name: string): Promise<CampaignMap> {
  if (!supabase) throw new Error("Maps need a shared instance.");
  if (!file.type.startsWith("image/")) throw new Error("That file isn’t an image.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("That image is over 20 MB. Pick a smaller one.");
  const img = await shrinkImage(file, MAP_MAX_SIDE, 0.86);
  const bmp = await createImageBitmap(img);
  const [width, height] = [bmp.width, bmp.height];
  bmp.close?.();
  const id = newId();
  const path = `${campaignId}/${id}.${img.type === "image/webp" ? "webp" : "jpg"}`;
  const up = await supabase.storage.from(MAP_BUCKET).upload(path, img, { contentType: img.type, upsert: false });
  if (up.error) throw new Error(`Couldn’t upload the map: ${up.error.message}`);
  // a first guess at the grid: squares about 1/20 of the long side, drawn (the GM sets the columns and rows next)
  const grid: MapGrid = { ...DEFAULT_GRID, size: Math.max(24, Math.round(Math.max(width, height) / 20)) };
  const { data, error } = await supabase.from("maps").insert({ id, campaign_id: campaignId, name: name || file.name.replace(/\.\w+$/, ""), path, width, height, grid }).select("*").single();
  if (error) {
    await supabase.storage.from(MAP_BUCKET).remove([path]);
    throw new Error(need(error.message));
  }
  return toMap(data);
}

export async function saveMap(m: Pick<CampaignMap, "id" | "name" | "grid">): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("maps").update({ name: m.name, grid: normGrid(m.grid), updated_at: new Date().toISOString() }).eq("id", m.id);
  if (error) throw new Error(`Couldn’t save the map: ${error.message}`);
}

export async function deleteMap(m: CampaignMap): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("maps").delete().eq("id", m.id);
  if (error) throw new Error(`Couldn’t delete the map: ${error.message}`);
  await supabase.storage.from(MAP_BUCKET).remove([m.path]);
}

/** The GM's copy of an encounter's map (null if it has none yet). */
export async function getEncounterMap(encounterId: string): Promise<EncounterMap | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("encounter_maps").select("*").eq("encounter_id", encounterId).maybeSingle();
  if (error) throw new Error(need(error.message));
  return data ? toEncMap(data) : null;
}

export async function saveEncounterMap(m: EncounterMap): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("encounter_maps").upsert({
    encounter_id: m.encounterId, map_id: m.mapId, title: m.title, shown: m.shown, tokens: m.tokens, fog: m.fog,
    turn: m.turn ?? null, round: m.round, updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Couldn’t save the map: ${need(error.message)}`);
}

/** An encounter's map as this member may see it (null: none, or not shown to players). */
export async function viewEncounterMap(encounterId: string): Promise<MapView | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("encounter_map", { eid: encounterId });
  if (error) throw new Error(need(error.message));
  if (!data) return null;
  const v = data as MapView;
  return { ...v, fog: { on: false, cells: [], ...((v.fog as Partial<MapFog>) || {}) }, map: v.map ? { ...v.map, grid: gridOf(v.map.grid) } : null, mine: v.mine || [] };
}

export async function moveToken(encounterId: string, uid: string, x: number, y: number): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("move_token", { eid: encounterId, tuid: uid, nx: x, ny: y });
  if (error) throw new Error(error.message);
  return !!data;
}

/** The maps the GM is showing in a campaign now. */
export async function liveMaps(campaignId: string): Promise<{ encounterId: string; title: string }[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("live_maps", { cid: campaignId });
  if (error) return [];
  return (data || []).map((r: Row) => ({ encounterId: r.encounter_id as string, title: (r.title as string) || "Map" }));
}

// ------------------------------------------------------------------ live updates
type Chan = ReturnType<NonNullable<typeof supabase>["channel"]>;
const chans = new Map<string, { ch: Chan; subs: Set<(p: MapPing) => void> }>();
export interface MapPing {
  encounterId: string;
  /** A token moved: the others can move it at once, before they reload. */
  move?: { uid: string; x: number; y: number };
  /** Someone pointed at a spot (image pixels), with their colour. */
  ping?: { px: number; py: number; who: string };
  /** Someone showed, changed or hid an area of effect. */
  areas?: boolean;
}

/** Listen for map changes in a campaign. Returns the function that stops listening. */
export function onMapChange(campaignId: string, fn: (p: MapPing) => void): () => void {
  if (!supabase) return () => {};
  const topic = `fivepointfive:m:${campaignId}`;
  let c = chans.get(topic);
  if (!c) {
    const subs = new Set<(p: MapPing) => void>();
    const ch = supabase.channel(topic, { config: { private: true, broadcast: { self: false } } })
      .on("broadcast", { event: "map" }, ({ payload }) => subs.forEach((f) => f(payload as MapPing)))
      .subscribe();
    c = { ch, subs };
    chans.set(topic, c);
  }
  c.subs.add(fn);
  return () => {
    c!.subs.delete(fn);
    if (!c!.subs.size) { supabase!.removeChannel(c!.ch); chans.delete(topic); }
  };
}

/** Tell everyone looking at a campaign's maps that one changed. */
export function announceMap(campaignId: string | null | undefined, p: MapPing): void {
  if (!supabase || !campaignId) return;
  const topic = `fivepointfive:m:${campaignId}`;
  const c = chans.get(topic);
  const ch = c?.ch || supabase.channel(topic, { config: { private: true, broadcast: { self: false } } });
  ch.send({ type: "broadcast", event: "map", payload: p }).catch(() => { /* the others catch up when they reload */ });
  if (!c) setTimeout(() => supabase!.removeChannel(ch), 4000);
}

// ------------------------------------------------------------------ images
const urls = new Map<string, Promise<string | undefined>>();
/** A URL the page can show for a map image (downloaded once). */
export function useMapImage(path?: string): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let live = true;
    setUrl(undefined);
    if (!path || !supabase) return;
    let p = urls.get(path);
    if (!p) {
      p = supabase.storage.from(MAP_BUCKET).download(path).then(({ data }) => (data ? URL.createObjectURL(data) : undefined));
      urls.set(path, p);
      p.then((u) => { if (!u) urls.delete(path); });
    }
    p.then((u) => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [path]);
  return url;
}
