/**
 * Areas of effect on a battle map: the six shapes the SRD defines (Sphere, Cylinder, Emanation, Cone, Line, Cube; SRD
 * 5.2.1 p. 177) and the two its wall spells use (a straight Wall and a ringed one), seen from above.
 *
 * Positions are in grid squares, where whole numbers are grid lines (square (i, j) runs from i to i + 1), and sizes are
 * in feet. An area is private to whoever placed it until they show it; shown areas are kept in fivepointfive.map_areas
 * (see supabase/migrations/0016_map_areas.sql) so everyone on the map sees them.
 *
 * The SRD doesn't say which squares on a grid an area catches, so a square counts when its centre is inside the shape;
 * thin walls and rings catch every square they pass through.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./backend.ts";
import { announceMap, onMapChange, type MapToken } from "./maps.ts";

export type AreaKind = "sphere" | "cylinder" | "emanation" | "cone" | "line" | "cube" | "wall" | "ring";

export interface Area {
  id: string;
  kind: AreaKind;
  /** The point of origin: a Sphere's, Cylinder's or Ring's centre; where a Cone, Line or Cube starts; a Wall's first end. */
  x: number;
  y: number;
  /** A Wall's other end. */
  x2?: number;
  y2?: number;
  /** Which way a Cone, Line or Cube points (radians, 0 is to the right, clockwise). */
  angle?: number;
  /** Feet: a Sphere's, Cylinder's radius; an Emanation's distance; a Cone's or Line's length; a Cube's side; a Wall's
   * longest length; a Ring's diameter. */
  size: number;
  /** Feet: a Line's width; a Wall's or Ring's thickness. */
  width?: number;
  /** Feet: a Cylinder's or Wall's height (shown, not drawn). */
  height?: number;
  /** An Emanation's creature: the token it moves with. */
  token?: string;
  color: string;
  /** What it is: "Fireball". */
  label?: string;
  /** Who placed it (filled in from the database). */
  owner?: string;
}

export interface Shape { kind: AreaKind; name: string; size: string; defaults: Pick<Area, "size" | "width" | "height">; how: string }

export const SHAPES: Shape[] = [
  { kind: "sphere", name: "Sphere", size: "Radius", defaults: { size: 20 }, how: "Click its centre." },
  { kind: "cylinder", name: "Cylinder", size: "Radius", defaults: { size: 10, height: 40 }, how: "Click its centre." },
  { kind: "emanation", name: "Emanation", size: "Distance", defaults: { size: 15 }, how: "Click the creature it comes from; it moves with them." },
  { kind: "cone", name: "Cone", size: "Length", defaults: { size: 15 }, how: "Press where it starts and drag the way it points." },
  { kind: "line", name: "Line", size: "Length", defaults: { size: 60, width: 5 }, how: "Press where it starts and drag the way it points." },
  { kind: "cube", name: "Cube", size: "Side", defaults: { size: 15 }, how: "Press the middle of the side it starts from and drag the way it points." },
  { kind: "wall", name: "Wall", size: "Longest", defaults: { size: 60, width: 1, height: 20 }, how: "Press one end and drag to the other." },
  { kind: "ring", name: "Ring", size: "Diameter", defaults: { size: 20, width: 1 }, how: "Click its centre." },
];
export const shapeOf = (k: AreaKind) => SHAPES.find((s) => s.kind === k)!;

/** Shapes aimed by dragging. */
export const AIMED: AreaKind[] = ["cone", "line", "cube"];

export const AREA_COLORS = ["#e5533d", "#f08a24", "#e3b25e", "#6cbf7d", "#4fa3e0", "#9b6fe0", "#e05aa8", "#e8e2d6"];

type P = { x: number; y: number };
export interface AreaCtx {
  /** Feet per square. */
  feet: number;
  tokens: MapToken[];
}

const sq = (ft: number, c: AreaCtx) => ft / (c.feet || 5);
const dirOf = (a: Area): P => ({ x: Math.cos(a.angle ?? 0), y: Math.sin(a.angle ?? 0) });

/** An Emanation's creature's space (in squares), or none if its token isn't on the map. */
function tokenBox(a: Area, c: AreaCtx) {
  const t = c.tokens.find((k) => k.uid === a.token);
  return t && t.x != null && t.y != null ? { x0: t.x, y0: t.y, x1: t.x + t.size, y1: t.y + t.size } : null;
}

/** A Wall's ends, kept to its longest length. */
export function wallEnds(a: Area, c: AreaCtx): [P, P] {
  const b = { x: a.x2 ?? a.x + sq(a.size, c), y: a.y2 ?? a.y };
  const len = Math.hypot(b.x - a.x, b.y - a.y), max = sq(a.size, c);
  if (len <= max || len === 0) return [{ x: a.x, y: a.y }, b];
  const k = max / len;
  return [{ x: a.x, y: a.y }, { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }];
}

/** Is a point (in squares) inside the area? */
export function inArea(a: Area, p: P, c: AreaCtx): boolean {
  const r = sq(a.size, c);
  switch (a.kind) {
    case "sphere":
    case "cylinder":
      return Math.hypot(p.x - a.x, p.y - a.y) <= r + 1e-9;
    case "emanation": {
      const b = tokenBox(a, c);
      if (!b) return false;
      if (p.x > b.x0 && p.x < b.x1 && p.y > b.y0 && p.y < b.y1) return false; // not the creature itself
      const dx = Math.max(b.x0 - p.x, 0, p.x - b.x1), dy = Math.max(b.y0 - p.y, 0, p.y - b.y1);
      return Math.hypot(dx, dy) <= r + 1e-9;
    }
    case "ring": {
      const d = Math.hypot(p.x - a.x, p.y - a.y);
      return Math.abs(d - r / 2) <= sq(a.width ?? 1, c) / 2 + 1e-9;
    }
    case "wall": {
      // flat ends: along the wall from one end to the other, and no further across than half its thickness
      const [e1, e2] = wallEnds(a, c), len = Math.hypot(e2.x - e1.x, e2.y - e1.y);
      if (!len) return false;
      const ux = (e2.x - e1.x) / len, uy = (e2.y - e1.y) / len, vx = p.x - e1.x, vy = p.y - e1.y;
      const along = vx * ux + vy * uy, across = Math.abs(-vx * uy + vy * ux);
      return along >= -1e-9 && along <= len + 1e-9 && across <= sq(a.width ?? 1, c) / 2 + 1e-9;
    }
    default: {
      // Cone, Line, Cube: measured along the way it points, and across
      const d = dirOf(a), vx = p.x - a.x, vy = p.y - a.y;
      const along = vx * d.x + vy * d.y, across = Math.abs(-vx * d.y + vy * d.x);
      if (along <= 1e-9 || along > r + 1e-9) return false;
      if (a.kind === "cone") return across <= along / 2 + 1e-9; // as wide as it is far from the point of origin
      if (a.kind === "line") return across <= sq(a.width ?? 5, c) / 2 + 1e-9;
      return across <= r / 2 + 1e-9; // cube: its point of origin is the middle of the side it starts from
    }
  }
}

/** Roughly where the area reaches, to look for squares in. */
function reach(a: Area, c: AreaCtx) {
  const r = sq(a.size, c) + sq(a.width ?? 0, c) + 1;
  if (a.kind === "emanation") { const b = tokenBox(a, c); return b ? { x0: b.x0 - r, y0: b.y0 - r, x1: b.x1 + r, y1: b.y1 + r } : null; }
  if (a.kind === "wall") { const [e1, e2] = wallEnds(a, c); const t = sq(a.width ?? 1, c) + 1; return { x0: Math.min(e1.x, e2.x) - t, y0: Math.min(e1.y, e2.y) - t, x1: Math.max(e1.x, e2.x) + t, y1: Math.max(e1.y, e2.y) + t }; }
  return { x0: a.x - r, y0: a.y - r, x1: a.x + r, y1: a.y + r };
}

/** The squares an area catches, as "x,y". */
export function areaSquares(a: Area, c: AreaCtx): string[] {
  const b = reach(a, c);
  if (!b) return [];
  const thin = a.kind === "wall" || a.kind === "ring";
  const out: string[] = [];
  for (let y = Math.floor(b.y0); y <= Math.ceil(b.y1); y++) {
    for (let x = Math.floor(b.x0); x <= Math.ceil(b.x1); x++) {
      let hit = inArea(a, { x: x + 0.5, y: y + 0.5 }, c);
      // a wall or ring thinner than a square catches every square it passes through
      if (!hit && thin) for (let i = 0; i < 5 && !hit; i++) for (let j = 0; j < 5 && !hit; j++) hit = inArea(a, { x: x + 0.1 + i * 0.2, y: y + 0.1 + j * 0.2 }, c);
      if (hit) out.push(`${x},${y}`);
    }
  }
  return out;
}

/** The tokens an area catches: any of their squares is in it (not an Emanation's own creature). */
export function areaTokens(a: Area, squares: string[], c: AreaCtx): MapToken[] {
  const s = new Set(squares);
  return c.tokens.filter((t) => {
    if (t.x == null || t.y == null || (a.kind === "emanation" && t.uid === a.token)) return false;
    for (let dy = 0; dy < t.size; dy++) for (let dx = 0; dx < t.size; dx++) if (s.has(`${t.x + dx},${t.y + dy}`)) return true;
    return false;
  });
}

export type Outline =
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "ring"; cx: number; cy: number; r1: number; r2: number }
  | { kind: "rrect"; x: number; y: number; w: number; h: number; r: number }
  | { kind: "poly"; pts: P[] };

/** The area's outline, in squares. */
export function areaOutline(a: Area, c: AreaCtx): Outline | null {
  const r = sq(a.size, c);
  switch (a.kind) {
    case "sphere":
    case "cylinder":
      return { kind: "circle", cx: a.x, cy: a.y, r };
    case "ring": {
      const t = sq(a.width ?? 1, c) / 2;
      return { kind: "ring", cx: a.x, cy: a.y, r1: Math.max(0, r / 2 - t), r2: r / 2 + t };
    }
    case "emanation": {
      const b = tokenBox(a, c);
      return b ? { kind: "rrect", x: b.x0 - r, y: b.y0 - r, w: b.x1 - b.x0 + 2 * r, h: b.y1 - b.y0 + 2 * r, r } : null;
    }
    case "wall": {
      const [e1, e2] = wallEnds(a, c), t = sq(a.width ?? 1, c) / 2;
      const len = Math.hypot(e2.x - e1.x, e2.y - e1.y) || 1, nx = -(e2.y - e1.y) / len * t, ny = (e2.x - e1.x) / len * t;
      return { kind: "poly", pts: [{ x: e1.x + nx, y: e1.y + ny }, { x: e2.x + nx, y: e2.y + ny }, { x: e2.x - nx, y: e2.y - ny }, { x: e1.x - nx, y: e1.y - ny }] };
    }
    default: {
      const d = dirOf(a), n = { x: -d.y, y: d.x }, o = { x: a.x, y: a.y };
      const half = a.kind === "cone" ? r / 2 : a.kind === "line" ? sq(a.width ?? 5, c) / 2 : r / 2;
      const end = { x: o.x + d.x * r, y: o.y + d.y * r };
      if (a.kind === "cone") return { kind: "poly", pts: [o, { x: end.x + n.x * half, y: end.y + n.y * half }, { x: end.x - n.x * half, y: end.y - n.y * half }] };
      return { kind: "poly", pts: [{ x: o.x + n.x * half, y: o.y + n.y * half }, { x: end.x + n.x * half, y: end.y + n.y * half }, { x: end.x - n.x * half, y: end.y - n.y * half }, { x: o.x - n.x * half, y: o.y - n.y * half }] };
    }
  }
}

/** Where to grab an area to aim it (the far end of a Cone, Line or Cube; a Wall's second end). */
export function aimPoint(a: Area, c: AreaCtx): P | null {
  if (a.kind === "wall") return wallEnds(a, c)[1];
  if (!AIMED.includes(a.kind)) return null;
  const d = dirOf(a), r = sq(a.size, c);
  return { x: a.x + d.x * r, y: a.y + d.y * r };
}

/** A point of origin on a grid line or a square's middle (every half square), unless placed freely. */
export const snapHalf = (v: number) => Math.round(v * 2) / 2;

/** "20-foot Sphere", "60 × 5-foot Line". */
export function areaName(a: Area): string {
  const s = shapeOf(a.kind);
  if (a.kind === "line") return `${a.size} × ${a.width ?? 5}-foot ${s.name}`;
  if (a.kind === "cylinder") return `${a.size}-foot-radius ${s.name}${a.height ? `, ${a.height} feet high` : ""}`;
  if (a.kind === "sphere") return `${a.size}-foot-radius ${s.name}`;
  if (a.kind === "ring") return `${a.size}-foot ${s.name}`;
  if (a.kind === "wall") return `${a.size}-foot ${s.name}`;
  return `${a.size}-foot ${s.name}`;
}

// ------------------------------------------------------------------ saving and sharing
type Row = { id: string; owner: string; area: Area };
const fromRow = (r: Row): Area => ({ ...r.area, id: r.id, owner: r.owner });

/**
 * An encounter's areas: everyone's shown ones (from the database) and this person's own, which stay on this device
 * until shown. Changes to a shown area save after a moment and are announced to the campaign.
 */
export function useAreas(encounterId: string | undefined, campaignId: string | null | undefined, me: string | undefined, gm: boolean) {
  const key = `fpf.areas.${encounterId}.${me}`;
  const [shown, setShown] = useState<Area[]>([]);
  const read = (k: string): Area[] => { try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch { return []; } };
  const [drafts, setDrafts] = useState<Area[]>(() => read(key));
  const [error, setError] = useState("");
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // your unshown areas stay on this device (per encounter and person); a new encounter or sign-in loads its own
  const loaded = useRef(key);
  useEffect(() => {
    if (loaded.current !== key) { loaded.current = key; setDrafts(read(key)); return; }
    try { localStorage.setItem(key, JSON.stringify(drafts)); } catch { /* storage full */ }
  }, [key, drafts]);

  const load = useCallback(async () => {
    if (!supabase || !encounterId) return;
    const { data, error: e } = await supabase.from("map_areas").select("id, owner, area").eq("encounter_id", encounterId);
    if (e) { setError(e.message.includes("map_areas") ? "Areas of effect need a database update: run supabase/migrations/0016_map_areas.sql." : e.message); return; }
    setShown((data as Row[] || []).map(fromRow));
  }, [encounterId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!campaignId || !encounterId) return;
    return onMapChange(campaignId, (p) => { if (p.encounterId === encounterId && p.areas) load(); });
  }, [campaignId, encounterId, load]);

  const tell = () => announceMap(campaignId, { encounterId: encounterId!, areas: true });
  const isShown = (id: string) => shown.some((a) => a.id === id);

  /** Add a new area of your own (private until shown). */
  const add = (a: Area) => setDrafts((l) => [...l, { ...a, owner: me }]);
  /** Change one of your areas (a shown one saves and the others see it). */
  const change = (a: Area) => {
    if (isShown(a.id)) {
      setShown((l) => l.map((x) => (x.id === a.id ? a : x)));
      clearTimeout(timers.current[a.id]);
      timers.current[a.id] = setTimeout(async () => {
        const { owner: _o, id, ...area } = a; // eslint-disable-line @typescript-eslint/no-unused-vars
        const { error: e } = await supabase!.from("map_areas").update({ area, updated_at: new Date().toISOString() }).eq("id", id);
        if (e) setError(`Couldn’t save the area: ${e.message}`); else tell();
      }, 250);
    } else setDrafts((l) => l.map((x) => (x.id === a.id ? a : x)));
  };
  /** Show one of your areas to everyone on the map. */
  const show = async (id: string) => {
    const a = drafts.find((x) => x.id === id);
    if (!a || !supabase || !encounterId) return;
    const { owner: _o, ...area } = a; // eslint-disable-line @typescript-eslint/no-unused-vars
    const { error: e } = await supabase.from("map_areas").insert({ id, encounter_id: encounterId, area });
    if (e) { setError(`Couldn’t show the area: ${e.message.includes("row-level") ? "the GM isn’t showing this map right now." : e.message}`); return; }
    setDrafts((l) => l.filter((x) => x.id !== id));
    setShown((l) => [...l, { ...a, owner: me }]);
    setError("");
    tell();
  };
  /** Take a shown area of yours back to your own screen. */
  const hide = async (id: string) => {
    const a = shown.find((x) => x.id === id);
    if (!a || !supabase) return;
    const { error: e } = await supabase.from("map_areas").delete().eq("id", id);
    if (e) { setError(`Couldn’t hide the area: ${e.message}`); return; }
    setShown((l) => l.filter((x) => x.id !== id));
    setDrafts((l) => [...l, a]);
    tell();
  };
  /** Remove an area: yours, or (for the GM) anyone's shown one. */
  const remove = async (id: string) => {
    if (!isShown(id)) { setDrafts((l) => l.filter((x) => x.id !== id)); return; }
    const { error: e } = await supabase!.from("map_areas").delete().eq("id", id);
    if (e) { setError(`Couldn’t remove the area: ${e.message}`); return; }
    setShown((l) => l.filter((x) => x.id !== id));
    tell();
  };

  const all = [...shown, ...drafts.filter((d) => !shown.some((s) => s.id === d.id))];
  return { all, drafts, shown, isShown, add, change, show, hide, remove, error, mine: (a: Area) => a.owner === me, canRemove: (a: Area) => a.owner === me || gm };
}

export type AreasState = ReturnType<typeof useAreas>;
