/**
 * A battle map: the image with its grid, the fog, and the tokens, which you can pan (drag the empty map, or two
 * fingers) and zoom (wheel, pinch, or the buttons). What a drag does depends on the tool: move tokens, uncover or cover
 * fog, measure, or point at a spot for everyone.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { MapIcon } from "./MapIcons.tsx";
import { AIMED, aimPoint, areaOutline, areaSquares, areaTokens, snapCenter, type Area, type AreaKind } from "../lib/areas.ts";
import { brushCells, cellAt, cellKey, cellRect, clampCell, feetBetween, gridBounds, normBlock, rectCells, sizeH, tokenLabel, type FogBlock, type MapFog, type MapGrid, type MapToken } from "../lib/maps.ts";

export type MapTool = "select" | "move" | "fog" | "aoe" | "measure" | "ping" | "align";
export interface Ping { id: number; px: number; py: number; color: string }

interface Props {
  url?: string;
  width: number;
  height: number;
  grid: MapGrid;
  tokens: MapToken[];
  fog: MapFog;
  /** The GM sees the fog as a wash and hidden tokens faintly; players see the fog as solid black. */
  gm: boolean;
  tool: MapTool;
  /** Fog brush radius in squares (0 is one square); "box" drags a rectangle that snaps to the grid. */
  brush?: number | "box";
  /** The fog tool uncovers (true) or covers (false); holding Alt while dragging does the other. */
  fogReveal?: boolean;
  /** Fog blocks, shown with handles to move and resize them while the fog tool is out. */
  blocks?: FogBlock[];
  selBlock?: string | null;
  /** A rectangle drawn while covering becomes a fog block. */
  onBlockAdd?: (b: Omit<FogBlock, "id">) => void;
  onBlockChange?: (b: FogBlock) => void;
  onBlockSelect?: (id: string | null) => void;
  onBlockDelete?: (id: string) => void;
  /** Areas of effect to draw: each with whether it's this viewer's own (so they can move and aim it) and shown. */
  areas?: { a: Area; mine: boolean; shown: boolean }[];
  selArea?: string | null;
  onAreaSelect?: (id: string | null) => void;
  /** What a new area looks like (the AOE tool's settings). */
  areaNew?: Omit<Area, "id" | "x" | "y">;
  onAreaAdd?: (a: Area) => void;
  onAreaChange?: (a: Area) => void;
  /** Said when a click can't place the area (an Emanation needs a creature). */
  onAreaHint?: (msg: string) => void;
  turn?: string | null;
  selected?: string | null;
  canDrag: (t: MapToken) => boolean;
  onMove?: (uid: string, x: number, y: number) => void;
  onSelect?: (uid: string | null) => void;
  /** A click on a square (to place the token picked from the tray). */
  onCell?: (x: number, y: number) => void;
  onFog?: (cells: string[], reveal: boolean) => void;
  onPing?: (px: number, py: number) => void;
  /** The align tool: a box dragged over the image, in its pixels. */
  onBox?: (ax: number, ay: number, bx: number, by: number) => void;
  pings?: Ping[];
  /** The colour this viewer's pings and measurements use. */
  color?: string;
}

const KIND_FILL: Record<MapToken["kind"], string> = { pc: "#2f5fa8", monster: "#9a2f25", other: "#5b5560" };

/** Covered or uncovered squares as rows of runs, so a big fog is a few hundred rectangles, not thousands. */
function runs(cells: Set<string>, b: { x0: number; y0: number; x1: number; y1: number }, want: boolean) {
  const out: { x: number; y: number; n: number }[] = [];
  for (let y = b.y0; y <= b.y1; y++) {
    let start: number | null = null;
    for (let x = b.x0; x <= b.x1 + 1; x++) {
      const on = x <= b.x1 && cells.has(cellKey(x, y)) === want;
      if (on && start == null) start = x;
      if (!on && start != null) { out.push({ x: start, y, n: x - start }); start = null; }
    }
  }
  return out;
}

export default function MapBoard(p: Props) {
  const { grid: g, width: W, height: H } = p;
  const gh = sizeH(g);
  /** For things drawn at a square's scale (rings, labels): the smaller side. */
  const u = Math.min(g.size, gh);
  const wrap = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ s: 1, tx: 0, ty: 0 });
  const fitted = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<null | { kind: "pan"; sx: number; sy: number; tx: number; ty: number } | { kind: "pinch"; d: number; cx: number; cy: number; s: number; tx: number; ty: number }
    | { kind: "box"; ax: number; ay: number } | { kind: "token"; uid: string; ox: number; oy: number; from: { x: number; y: number } } | { kind: "fog"; from: { x: number; y: number }; last: { x: number; y: number }; cells: Set<string>; reveal: boolean }
    | { kind: "area"; mode: "new" | "aim" | "move"; area: Area; from: { x: number; y: number }; free: boolean; snap45: boolean }
    | { kind: "block"; orig: FogBlock; mode: "move" | "nw" | "ne" | "sw" | "se"; from: { x: number; y: number } } | { kind: "measure"; from: { x: number; y: number } }>(null);
  const [drag, setDrag] = useState<{ uid: string; px: number; py: number } | null>(null);
  const [paint, setPaint] = useState<{ cells: string[]; reveal: boolean; box?: [{ x: number; y: number }, { x: number; y: number }] } | null>(null);
  const [blockDraft, setBlockDraft] = useState<FogBlock | null>(null);
  const [areaDraft, setAreaDraft] = useState<Area | null>(null);
  /** A point on the image in squares (whole numbers are grid lines). */
  const toSq = (px: number, py: number) => ({ x: (px - g.ox) / g.size, y: (py - g.oy) / gh });
  const [box, setBox] = useState<{ ax: number; ay: number; bx: number; by: number } | null>(null);
  const id = useId().replace(/:/g, "");
  const [measure, setMeasure] = useState<{ a: { x: number; y: number }; b: { x: number; y: number } } | null>(null);

  // fit the map to the box when it first shows (and when the image changes size)
  const fit = () => {
    const el = wrap.current;
    if (!el || !W || !H) return;
    const r = el.getBoundingClientRect();
    const s = Math.min(r.width / W, r.height / H) * 0.96;
    setView({ s, tx: (r.width - W * s) / 2, ty: (r.height - H * s) / 2 });
  };
  useLayoutEffect(() => { if (!fitted.current && W && H) { fitted.current = true; fit(); } }, [W, H]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { fitted.current = false; }, [p.url]);

  const toImage = (cx: number, cy: number) => {
    const r = wrap.current!.getBoundingClientRect();
    return { px: (cx - r.left - view.tx) / view.s, py: (cy - r.top - view.ty) / view.s };
  };
  const zoomAt = (cx: number, cy: number, f: number) => {
    const r = wrap.current!.getBoundingClientRect();
    setView((v) => {
      const s = Math.max(0.05, Math.min(8, v.s * f));
      const k = s / v.s, x = cx - r.left, y = cy - r.top;
      return { s, tx: x - (x - v.tx) * k, ty: y - (y - v.ty) * k };
    });
  };

  // wheel zoom (a listener, not onWheel, so it can stop the page scrolling)
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))); };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const bounds = gridBounds(g, W, H);
  const fogCells = useMemo(() => new Set(p.fog.cells), [p.fog.cells]);
  const brushAt = (c: { x: number; y: number }) => (p.brush === "box" ? [cellKey(c.x, c.y)] : brushCells(c.x, c.y, p.brush ?? 0));

  const down = (e: RPointerEvent<HTMLDivElement>) => {
    wrap.current!.setPointerCapture(e.pointerId);
    if (e.button === 1 || e.button === 2) {
      // the right or middle button always pans, whatever the tool
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      gesture.current = { kind: "pan", sx: e.clientX, sy: e.clientY, tx: view.tx, ty: view.ty };
      return;
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      // two fingers: pinch and pan, whatever the tool (and drop what one finger started)
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: "pinch", d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, ...view };
      setDrag(null); setPaint(null); setMeasure(null);
      return;
    }
    const { px, py } = toImage(e.clientX, e.clientY);
    const c = cellAt(g, px, py);
    const tokEl = (e.target as Element).closest?.("[data-token]");
    const tok = tokEl ? p.tokens.find((t) => t.uid === tokEl.getAttribute("data-token")) : undefined;
    if (p.tool === "select" && tok) {
      // the cursor picks a token without moving it (dragging the map still pans)
      p.onSelect?.(tok.uid);
      return;
    }
    if (p.tool === "move" && tok && tok.x != null && tok.y != null) {
      p.onSelect?.(tok.uid);
      if (p.canDrag(tok)) {
        const r = cellRect(g, tok.x, tok.y, tok.size);
        gesture.current = { kind: "token", uid: tok.uid, ox: px - r.left, oy: py - r.top, from: { x: tok.x, y: tok.y } };
        setDrag({ uid: tok.uid, px: r.left, py: r.top });
        return;
      }
    }
    if (p.tool === "aoe") {
      const at = toSq(px, py), free = false; // a point of origin is always the middle of a square
      const aim = (e.target as Element).closest?.("[data-aim]")?.getAttribute("data-aim");
      const hit = aim || (e.target as Element).closest?.("[data-area]")?.getAttribute("data-area");
      const own = hit ? p.areas?.find((x) => x.a.id === hit && x.mine)?.a : undefined;
      if (own) {
        p.onAreaSelect?.(own.id);
        // an Emanation moves with its creature, so it can't be dragged
        if (aim || own.kind !== "emanation") gesture.current = { kind: "area", mode: aim ? "aim" : "move", area: own, from: at, free, snap45: e.shiftKey };
        return;
      }
      const n = p.areaNew;
      if (n && p.onAreaAdd) {
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        if (n.kind === "emanation") {
          if (!tok || tok.x == null) { p.onAreaHint?.("An Emanation comes from a creature: click a token on the map."); return; }
          const a: Area = { ...n, id, x: 0, y: 0, token: tok.uid };
          p.onAreaAdd(a); p.onAreaSelect?.(id);
          return;
        }
        const o = { x: snapCenter(at.x), y: snapCenter(at.y) };
        const a: Area = { ...n, id, x: o.x, y: o.y, ...(n.kind === "wall" ? { x2: o.x, y2: o.y } : {}) };
        if ((AIMED as AreaKind[]).includes(n.kind) || n.kind === "wall") {
          gesture.current = { kind: "area", mode: "new", area: a, from: at, free, snap45: e.shiftKey };
          setAreaDraft(a);
        } else { p.onAreaAdd(a); p.onAreaSelect?.(id); }
        return;
      }
    }
    if (p.tool === "fog" && p.blocks) {
      const del = (e.target as Element).closest?.("[data-bdel]")?.getAttribute("data-bdel");
      if (del) { p.onBlockDelete?.(del); return; }
      // a block's corner resizes it; anywhere else on it moves it
      const h = (e.target as Element).closest?.("[data-bh]")?.getAttribute("data-bh");
      const bid = h ? h.split(":")[0] : (e.target as Element).closest?.("[data-block]")?.getAttribute("data-block");
      const b = bid ? p.blocks.find((x) => x.id === bid) : undefined;
      if (b) {
        p.onBlockSelect?.(b.id);
        gesture.current = { kind: "block", orig: b, mode: (h?.split(":")[1] as "nw") || "move", from: c };
        setBlockDraft(b);
        return;
      }
    }
    if (p.tool === "fog" && p.onFog) {
      const reveal = !!p.fogReveal !== e.altKey;
      const cells = new Set(brushAt(c));
      gesture.current = { kind: "fog", from: c, last: c, cells, reveal };
      p.onBlockSelect?.(null);
      setPaint({ cells: [...cells], reveal, box: p.brush === "box" ? [c, c] : undefined });
      return;
    }
    if (p.tool === "measure") {
      gesture.current = { kind: "measure", from: c };
      setMeasure({ a: c, b: c });
      return;
    }
    if (p.tool === "align") {
      gesture.current = { kind: "box", ax: px, ay: py };
      setBox({ ax: px, ay: py, bx: px, by: py });
      return;
    }
    if (p.tool === "ping" && p.onPing) {
      p.onPing(px, py);
      return;
    }
    if (!tok) p.onSelect?.(null);
    if (p.onCell && (p.tool === "move" || p.tool === "select") && px >= 0 && py >= 0 && px <= W && py <= H) p.onCell(c.x, c.y);
    gesture.current = { kind: "pan", sx: e.clientX, sy: e.clientY, tx: view.tx, ty: view.ty };
  };

  const move = (e: RPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const gs = gesture.current;
    if (!gs) return;
    if (gs.kind === "pinch") {
      const [a, b] = [...pointers.current.values()];
      if (!b) return;
      const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const r = wrap.current!.getBoundingClientRect();
      const s = Math.max(0.05, Math.min(8, gs.s * (d / gs.d))), k = s / gs.s;
      setView({ s, tx: cx - r.left - (gs.cx - r.left - gs.tx) * k, ty: cy - r.top - (gs.cy - r.top - gs.ty) * k });
      return;
    }
    if (gs.kind === "pan") { setView((v) => ({ ...v, tx: gs.tx + e.clientX - gs.sx, ty: gs.ty + e.clientY - gs.sy })); return; }
    const { px, py } = toImage(e.clientX, e.clientY);
    const c = cellAt(g, px, py);
    if (gs.kind === "area") {
      const at = toSq(px, py), a0 = gs.area;
      let next: Area;
      if (gs.mode === "move") {
        const dx = at.x - gs.from.x, dy = at.y - gs.from.y;
        // moved a whole square at a time, so it stays on a square's middle
        const sx = gs.free ? a0.x + dx : a0.x + Math.round(dx), sy = gs.free ? a0.y + dy : a0.y + Math.round(dy);
        const mx = sx - a0.x, my = sy - a0.y;
        next = { ...a0, x: sx, y: sy, ...(a0.kind === "wall" ? { x2: (a0.x2 ?? a0.x) + mx, y2: (a0.y2 ?? a0.y) + my } : {}) };
      } else if (a0.kind === "wall") {
        next = { ...a0, x2: snapCenter(at.x), y2: snapCenter(at.y) };
      } else {
        let ang = Math.atan2(at.y - a0.y, at.x - a0.x);
        // a Cube lines up with the grid (or the diagonals); Shift does the same for the others
        if (a0.kind === "cube" || gs.snap45 || e.shiftKey) ang = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
        next = { ...a0, angle: ang };
      }
      gs.area = next;
      setAreaDraft(next);
      return;
    }
    if (gs.kind === "block") {
      const dx = c.x - gs.from.x, dy = c.y - gs.from.y, o = gs.orig;
      const b = gs.mode === "move" ? { ...o, x: o.x + dx, y: o.y + dy }
        : { ...o,
          x: gs.mode === "nw" || gs.mode === "sw" ? Math.min(o.x + dx, o.x + o.w - 1) : o.x,
          y: gs.mode === "nw" || gs.mode === "ne" ? Math.min(o.y + dy, o.y + o.h - 1) : o.y,
          w: gs.mode === "nw" || gs.mode === "sw" ? o.w - Math.min(dx, o.w - 1) : o.w + dx,
          h: gs.mode === "nw" || gs.mode === "ne" ? o.h - Math.min(dy, o.h - 1) : o.h + dy };
      setBlockDraft(normBlock(b));
    } else if (gs.kind === "box") setBox({ ax: gs.ax, ay: gs.ay, bx: px, by: py });
    else if (gs.kind === "token") setDrag({ uid: gs.uid, px: px - gs.ox, py: py - gs.oy });
    else if (gs.kind === "fog") {
      if (p.brush === "box") { const cells = rectCells(gs.from, c); gs.cells = new Set(cells); setPaint({ cells, reveal: gs.reveal, box: [gs.from, c] }); }
      else {
        // fill in every square between this point and the last one, so a quick stroke leaves no gaps
        const n = Math.max(Math.abs(c.x - gs.last.x), Math.abs(c.y - gs.last.y));
        for (let i = 1; i <= n; i++) brushAt({ x: Math.round(gs.last.x + ((c.x - gs.last.x) * i) / n), y: Math.round(gs.last.y + ((c.y - gs.last.y) * i) / n) }).forEach((k) => gs.cells.add(k));
        gs.last = c;
        setPaint({ cells: [...gs.cells], reveal: gs.reveal });
      }
    } else if (gs.kind === "measure") setMeasure({ a: gs.from, b: c });
  };

  const up = (e: RPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    const gs = gesture.current;
    if (pointers.current.size > 0) { if (gs?.kind === "pinch") gesture.current = null; return; }
    gesture.current = null;
    if (!gs) return;
    if (gs.kind === "token") {
      const t = p.tokens.find((x) => x.uid === gs.uid);
      const { px, py } = toImage(e.clientX, e.clientY);
      setDrag(null);
      if (!t) return;
      // drop on the square under the token's top-left quarter, so it lands where it looks
      const at = cellAt(g, px - gs.ox + g.size / 2, py - gs.oy + gh / 2);
      const c = clampCell(g, W, H, at.x, at.y, t.size);
      if (c.x !== gs.from.x || c.y !== gs.from.y) p.onMove?.(t.uid, c.x, c.y);
    } else if (gs.kind === "area") {
      if (gs.mode === "new") { p.onAreaAdd?.(gs.area); p.onAreaSelect?.(gs.area.id); }
      else if (JSON.stringify(gs.area) !== JSON.stringify(p.areas?.find((x) => x.a.id === gs.area.id)?.a)) p.onAreaChange?.(gs.area);
      setAreaDraft(null);
    } else if (gs.kind === "block") {
      if (blockDraft && JSON.stringify(blockDraft) !== JSON.stringify(gs.orig)) p.onBlockChange?.(blockDraft);
      setBlockDraft(null);
    } else if (gs.kind === "fog") {
      if (p.brush === "box" && !gs.reveal && p.onBlockAdd) {
        // a rectangle of fog: a block, which can be moved and resized afterwards
        const { x: ax, y: ay } = gs.from, b = cellAt(g, ...(() => { const { px, py } = toImage(e.clientX, e.clientY); return [px, py] as const; })());
        p.onBlockAdd({ x: Math.min(ax, b.x), y: Math.min(ay, b.y), w: Math.abs(b.x - ax) + 1, h: Math.abs(b.y - ay) + 1 });
      } else p.onFog?.([...gs.cells], gs.reveal);
      setPaint(null);
    } else if (gs.kind === "box") {
      const { px, py } = toImage(e.clientX, e.clientY);
      setBox(null);
      p.onBox?.(gs.ax, gs.ay, px, py);
    } else if (gs.kind === "measure") {
      setTimeout(() => setMeasure(null), 1600);
    }
  };

  const lineW = Math.max(1, 1.2 / view.s);
  const tokFor = (t: MapToken) => {
    if (drag?.uid === t.uid) return { left: drag.px, top: drag.py, w: t.size * g.size, h: t.size * gh };
    return cellRect(g, t.x!, t.y!, t.size);
  };
  const placed = p.tokens.filter((t) => t.x != null && t.y != null);
  // which tokens each area catches (any square of their space), so they can be ringed in its colour
  const caughtBy = useMemo(() => {
    const m = new Map<string, { color: string; shown: boolean }[]>();
    const list = (p.areas || []).map((x) => (areaDraft && x.a.id === areaDraft.id ? { ...x, a: areaDraft } : x));
    if (areaDraft && !list.some((x) => x.a.id === areaDraft.id)) list.push({ a: areaDraft, mine: true, shown: false });
    const actx = { feet: g.feet, tokens: p.tokens, bounds };
    for (const { a, shown } of list) for (const t of areaTokens(a, areaSquares(a, actx), actx)) m.set(t.uid, [...(m.get(t.uid) || []), { color: a.color, shown }]);
    return m;
  }, [p.areas, areaDraft, p.tokens, g, W, H]); // eslint-disable-line react-hooks/exhaustive-deps
  const dragged = drag && p.tokens.find((t) => t.uid === drag.uid);
  const dragFeet = (() => {
    if (!drag || !dragged || gesture.current?.kind !== "token") return null;
    const at = cellAt(g, drag.px + g.size / 2, drag.py + gh / 2);
    return feetBetween(gesture.current.from, at, g.feet);
  })();

  // the grid around the map carries on the map's own squares, at the same size and lined up with them
  let cw = g.size * view.s, ch = gh * view.s;
  while (Math.min(cw, ch) < 10) { cw *= 2; ch *= 2; }
  const backdrop = { backgroundSize: `${cw}px ${ch}px`, backgroundPosition: `${view.tx + g.ox * view.s}px ${view.ty + g.oy * view.s}px` };

  return (
    <div className={`mapboard tool-${p.tool}`} ref={wrap} style={backdrop} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onContextMenu={(e) => e.preventDefault()}>
      <svg width="100%" height="100%">
        <defs>
          <pattern id={`mapgrid${id}`} patternUnits="userSpaceOnUse" x={g.ox} y={g.oy} width={g.size} height={gh}>
            <path d={`M ${g.size} 0 L 0 0 0 ${gh}`} fill="none" stroke={g.color} strokeOpacity={g.opacity} strokeWidth={lineW} />
          </pattern>
          {p.fog.on && (
            <mask id={`mapfog${id}`} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
              <rect x={0} y={0} width={W} height={H} fill="#fff" />
              {runs(fogCells, bounds, true).map((r) => { const c = cellRect(g, r.x, r.y); return <rect key={`${r.x},${r.y}`} x={c.left} y={c.top} width={r.n * g.size} height={gh} fill="#000" />; })}
            </mask>
          )}
          <clipPath id={`mapclip${id}`}><rect x={0} y={0} width={W} height={H} /></clipPath>
        </defs>
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.s})`}>
          <rect x={0} y={0} width={W} height={H} fill="#2a2430" />
          {p.url && <image href={p.url} x={0} y={0} width={W} height={H} preserveAspectRatio="none" />}
          {g.show && <rect x={0} y={0} width={W} height={H} fill={`url(#mapgrid${id})`} pointerEvents="none" />}
          {p.fog.on && <rect x={0} y={0} width={W} height={H} fill={p.gm ? "rgba(8,6,12,.55)" : "#08060c"} mask={`url(#mapfog${id})`} pointerEvents="none" />}
          {paint && (
            <g clipPath={`url(#mapclip${id})`} pointerEvents="none">
              {paint.cells.map((k) => { const [x, y] = k.split(",").map(Number); const c = cellRect(g, x, y); return <rect key={k} x={c.left} y={c.top} width={c.w} height={c.h} fill={paint.reveal ? "rgba(242,205,133,.28)" : "rgba(8,6,12,.5)"} />; })}
            </g>
          )}
          {(() => {
            const list = [...(p.areas || []).map((x) => (areaDraft && x.a.id === areaDraft.id ? { ...x, a: areaDraft } : x))];
            if (areaDraft && !list.some((x) => x.a.id === areaDraft.id)) list.push({ a: areaDraft, mine: true, shown: false });
            const X = (x: number) => g.ox + x * g.size, Y = (y: number) => g.oy + y * gh;
            const actx = { feet: g.feet, tokens: p.tokens, bounds };
            return list.map(({ a, mine, shown }) => {
              const o = areaOutline(a, actx);
              if (!o) return null;
              const sel = p.selArea === a.id || areaDraft?.id === a.id;
              const sqs = areaSquares(a, actx);
              const dash = shown ? undefined : `${u * 0.16} ${u * 0.1}`;
              const stroke = { stroke: a.color, strokeWidth: lineW * (sel ? 3 : 2), strokeDasharray: dash, fill: a.color, fillOpacity: 0.12 };
              const shape = o.kind === "circle" ? <ellipse cx={X(o.cx)} cy={Y(o.cy)} rx={o.r * g.size} ry={o.r * gh} {...stroke} />
                : o.kind === "ring" ? <path fillRule="evenodd" d={`M ${X(o.cx) - o.r2 * g.size} ${Y(o.cy)} a ${o.r2 * g.size} ${o.r2 * gh} 0 1 0 ${2 * o.r2 * g.size} 0 a ${o.r2 * g.size} ${o.r2 * gh} 0 1 0 ${-2 * o.r2 * g.size} 0 Z M ${X(o.cx) - o.r1 * g.size} ${Y(o.cy)} a ${o.r1 * g.size} ${o.r1 * gh} 0 1 0 ${2 * o.r1 * g.size} 0 a ${o.r1 * g.size} ${o.r1 * gh} 0 1 0 ${-2 * o.r1 * g.size} 0 Z`} {...stroke} />
                : o.kind === "rrect" ? <rect x={X(o.x)} y={Y(o.y)} width={o.w * g.size} height={o.h * gh} rx={o.r * g.size} ry={o.r * gh} {...stroke} />
                : <polygon points={o.pts.map((q) => `${X(q.x)},${Y(q.y)}`).join(" ")} {...stroke} />;
              const aimAt = mine && sel ? aimPoint(a, actx) : null;
              return (
                <g key={a.id} className={`marea ${mine ? "mine" : ""} ${p.tool === "aoe" && mine ? "can" : ""}`} data-area={a.id} pointerEvents={p.tool === "aoe" ? undefined : "none"}>
                  <g clipPath={`url(#mapclip${id})`} pointerEvents="none">
                    {sqs.map((k) => { const [x, y] = k.split(",").map(Number); return <rect key={k} x={X(x)} y={Y(y)} width={g.size} height={gh} fill={a.color} fillOpacity={shown ? 0.28 : 0.18} />; })}
                  </g>
                  {shape}
                  {a.kind !== "emanation" && <circle cx={X(a.x)} cy={Y(a.y)} r={u * 0.09} fill={a.color} stroke="#141114" strokeWidth={lineW} pointerEvents="none" />}
                  {(a.label || sel) && <text x={X(a.x)} y={Y(a.y) - u * 0.22} textAnchor="middle" className="mlabel" fontSize={u * 0.3} strokeWidth={u * 0.06} pointerEvents="none">{a.label || ""}{!shown && mine ? " (only you)" : ""}</text>}
                  {aimAt && <circle data-aim={a.id} className="maim" cx={X(aimAt.x)} cy={Y(aimAt.y)} r={u * 0.2} fill="#fff8ea" stroke={a.color} strokeWidth={u * 0.06} />}
                </g>
              );
            });
          })()}
          {p.tool === "fog" && p.blocks?.map((b0) => {
            const b = blockDraft?.id === b0.id ? blockDraft : b0;
            const a = cellRect(g, b.x, b.y), sel = p.selBlock === b.id, hs = u * 0.3;
            const W2 = b.w * g.size, H2 = b.h * gh;
            const corners: [string, number, number][] = [["nw", a.left, a.top], ["ne", a.left + W2, a.top], ["sw", a.left, a.top + H2], ["se", a.left + W2, a.top + H2]];
            return (
              <g key={b.id} className={`mblock ${sel ? "sel" : ""}`} data-block={b.id}>
                <rect x={a.left} y={a.top} width={W2} height={H2} fill="rgba(8,6,12,.35)" stroke={sel ? "#f2cd85" : "rgba(242,205,133,.7)"} strokeWidth={lineW * 2} strokeDasharray={`${u * 0.15} ${u * 0.1}`} />
                <text x={a.left + W2 / 2} y={a.top + H2 / 2} textAnchor="middle" dominantBaseline="central" className="mlabel" fontSize={Math.min(u * 0.34, H2 * 0.4)} strokeWidth={u * 0.06}>{b.w} × {b.h}</text>
                {corners.map(([m, x, y]) => <rect key={m} data-bh={`${b.id}:${m}`} className={`mbh ${m}`} x={x - hs / 2} y={y - hs / 2} width={hs} height={hs} rx={hs * 0.2} />)}
                {sel && p.onBlockDelete && (
                  <g data-bdel={b.id} className="mbdel" transform={`translate(${a.left + W2 + hs * 1.1} ${a.top - hs * 1.1})`}>
                    <title>Delete this block (or press Delete)</title>
                    <circle r={hs * 0.9} />
                    <path d={`M ${-hs * 0.35} ${-hs * 0.35} L ${hs * 0.35} ${hs * 0.35} M ${hs * 0.35} ${-hs * 0.35} L ${-hs * 0.35} ${hs * 0.35}`} strokeWidth={hs * 0.18} strokeLinecap="round" />
                  </g>
                )}
              </g>
            );
          })}
          {placed.map((t) => {
            const r = tokFor(t);
            const cx = r.left + r.w / 2, cy = r.top + r.h / 2, rad = Math.min(r.w, r.h) * 0.44;
            const turn = p.turn === t.uid, sel = p.selected === t.uid;
            const hits = caughtBy.get(t.uid) || [];
            return (
              <g key={t.uid} data-token={t.uid} className={`mtok ${hits.length ? "hit" : ""} ${p.canDrag(t) ? "can" : ""} ${t.out ? "out" : ""} ${t.hidden ? "hid" : ""} ${drag?.uid === t.uid ? "drag" : ""}`}>
                {(turn || sel) && <circle cx={cx} cy={cy} r={rad + u * 0.07} fill="none" stroke={turn ? "#f2cd85" : "#fff"} strokeWidth={u * 0.06} strokeDasharray={sel && !turn ? `${u * 0.12} ${u * 0.08}` : undefined} />}
                {hits.map((h, i) => <circle key={i} cx={cx} cy={cy} r={rad + u * (0.12 + i * 0.09)} fill="none" stroke={h.color} strokeWidth={u * 0.07} strokeDasharray={h.shown ? undefined : `${u * 0.1} ${u * 0.07}`} pointerEvents="none" />)}
                <circle cx={cx} cy={cy} r={rad} fill={KIND_FILL[t.kind]} stroke="#0b090d" strokeWidth={u * 0.04} />
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(rad * 0.82, u * 0.36 * Math.min(t.size, 2))} fill="#fff8ea" fontWeight={700}>{tokenLabel(t.name)}</text>
                {t.out && <path d={`M ${cx - rad * 0.6} ${cy - rad * 0.6} L ${cx + rad * 0.6} ${cy + rad * 0.6} M ${cx + rad * 0.6} ${cy - rad * 0.6} L ${cx - rad * 0.6} ${cy + rad * 0.6}`} stroke="#0b090d" strokeWidth={u * 0.08} strokeLinecap="round" />}
                {t.note && <text x={cx} y={r.top + r.h + u * 0.24} textAnchor="middle" dominantBaseline="hanging" className={`mlabel mnote ${t.noteGm ? "gm" : ""}`} fontSize={u * 0.26} strokeWidth={u * 0.06}>{t.note.length > 28 ? `${t.note.slice(0, 27)}…` : t.note}</text>}
                <title>{t.name}{hits.length ? " (in an area of effect)" : ""}{t.note ? ` — ${t.note}${t.noteGm ? " (GM only)" : ""}` : ""}{t.hidden ? " (hidden from players)" : ""}{t.out ? " (out of the fight)" : ""}</title>
              </g>
            );
          })}
          {dragFeet != null && drag && <text x={drag.px + (dragged!.size * g.size) / 2} y={drag.py - u * 0.18} textAnchor="middle" className="mlabel" fontSize={u * 0.34} strokeWidth={u * 0.07}>{dragFeet} ft</text>}
          {measure && (() => {
            const a0 = cellRect(g, measure.a.x, measure.a.y), b0 = cellRect(g, measure.b.x, measure.b.y);
            const a = { x: a0.left + a0.w / 2, y: a0.top + a0.h / 2 }, b = { x: b0.left + b0.w / 2, y: b0.top + b0.h / 2 };
            return (
              <g pointerEvents="none">
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={p.color || "#f2cd85"} strokeWidth={u * 0.08} strokeLinecap="round" />
                <circle cx={a.x} cy={a.y} r={u * 0.12} fill={p.color || "#f2cd85"} />
                <text x={b.x} y={b0.top - u * 0.15} textAnchor="middle" className="mlabel" fontSize={u * 0.38} strokeWidth={u * 0.08}>{feetBetween(measure.a, measure.b, g.feet)} ft</text>
              </g>
            );
          })()}
          {box && <rect x={Math.min(box.ax, box.bx)} y={Math.min(box.ay, box.by)} width={Math.abs(box.bx - box.ax)} height={Math.abs(box.by - box.ay)} fill="rgba(242,205,133,.2)" stroke="#f2cd85" strokeWidth={lineW * 2} pointerEvents="none" />}
          {(p.pings || []).map((pg) => (
            <g key={pg.id} className="mping" pointerEvents="none" style={{ color: pg.color }}>
              <circle cx={pg.px} cy={pg.py} r={u * 0.5} fill="none" stroke="currentColor" strokeWidth={u * 0.08} />
              <circle cx={pg.px} cy={pg.py} r={u * 0.12} fill="currentColor" />
            </g>
          ))}
        </g>
      </svg>
      <div className="mapzoom" onPointerDown={(e) => e.stopPropagation()}>
        <button className="mrbtn" aria-label="Zoom in" onClick={() => { const r = wrap.current!.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.25); }}><MapIcon name="plus" /></button>
        <button className="mrbtn" aria-label="Zoom out" onClick={() => { const r = wrap.current!.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 0.8); }}><MapIcon name="minus" /></button>
        <button className="mrbtn" aria-label="Fit the map" title="Fit the map" onClick={fit}><MapIcon name="fit" /></button>
      </div>
    </div>
  );
}
