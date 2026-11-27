/**
 * A battle map: the image with its grid, the fog, and the tokens, which you can pan (drag the empty map, or two
 * fingers) and zoom (wheel, pinch, or the buttons). What a drag does depends on the tool: move tokens, uncover or cover
 * fog, measure, or point at a spot for everyone.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { brushCells, cellAt, cellKey, cellRect, clampCell, feetBetween, gridBounds, rectCells, sizeH, tokenLabel, type MapFog, type MapGrid, type MapToken } from "../lib/maps.ts";

export type MapTool = "move" | "reveal" | "cover" | "measure" | "ping" | "align";
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
  /** Fog brush radius in squares (0 is one square); "box" drags a rectangle. */
  brush?: number | "box";
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
    | { kind: "box"; ax: number; ay: number } | { kind: "token"; uid: string; ox: number; oy: number; from: { x: number; y: number } } | { kind: "fog"; from: { x: number; y: number }; last: { x: number; y: number }; cells: Set<string> } | { kind: "measure"; from: { x: number; y: number } }>(null);
  const [drag, setDrag] = useState<{ uid: string; px: number; py: number } | null>(null);
  const [paint, setPaint] = useState<{ cells: string[]; box?: [{ x: number; y: number }, { x: number; y: number }] } | null>(null);
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
    if (e.button === 2) return;
    wrap.current!.setPointerCapture(e.pointerId);
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
    if (p.tool === "move" && tok && tok.x != null && tok.y != null) {
      p.onSelect?.(tok.uid);
      if (p.canDrag(tok)) {
        const r = cellRect(g, tok.x, tok.y, tok.size);
        gesture.current = { kind: "token", uid: tok.uid, ox: px - r.left, oy: py - r.top, from: { x: tok.x, y: tok.y } };
        setDrag({ uid: tok.uid, px: r.left, py: r.top });
        return;
      }
    }
    if ((p.tool === "reveal" || p.tool === "cover") && p.onFog) {
      const cells = new Set(brushAt(c));
      gesture.current = { kind: "fog", from: c, last: c, cells };
      setPaint({ cells: [...cells], box: p.brush === "box" ? [c, c] : undefined });
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
    if (p.onCell && p.tool === "move" && px >= 0 && py >= 0 && px <= W && py <= H) p.onCell(c.x, c.y);
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
    if (gs.kind === "box") setBox({ ax: gs.ax, ay: gs.ay, bx: px, by: py });
    else if (gs.kind === "token") setDrag({ uid: gs.uid, px: px - gs.ox, py: py - gs.oy });
    else if (gs.kind === "fog") {
      if (p.brush === "box") { const cells = rectCells(gs.from, c); gs.cells = new Set(cells); setPaint({ cells, box: [gs.from, c] }); }
      else {
        // fill in every square between this point and the last one, so a quick stroke leaves no gaps
        const n = Math.max(Math.abs(c.x - gs.last.x), Math.abs(c.y - gs.last.y));
        for (let i = 1; i <= n; i++) brushAt({ x: Math.round(gs.last.x + ((c.x - gs.last.x) * i) / n), y: Math.round(gs.last.y + ((c.y - gs.last.y) * i) / n) }).forEach((k) => gs.cells.add(k));
        gs.last = c;
        setPaint({ cells: [...gs.cells] });
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
    } else if (gs.kind === "fog") {
      p.onFog?.([...gs.cells], p.tool === "reveal");
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
              {paint.cells.map((k) => { const [x, y] = k.split(",").map(Number); const c = cellRect(g, x, y); return <rect key={k} x={c.left} y={c.top} width={c.w} height={c.h} fill={p.tool === "reveal" ? "rgba(242,205,133,.28)" : "rgba(8,6,12,.5)"} />; })}
            </g>
          )}
          {placed.map((t) => {
            const r = tokFor(t);
            const cx = r.left + r.w / 2, cy = r.top + r.h / 2, rad = Math.min(r.w, r.h) * 0.44;
            const turn = p.turn === t.uid, sel = p.selected === t.uid;
            return (
              <g key={t.uid} data-token={t.uid} className={`mtok ${p.canDrag(t) ? "can" : ""} ${t.out ? "out" : ""} ${t.hidden ? "hid" : ""} ${drag?.uid === t.uid ? "drag" : ""}`}>
                {(turn || sel) && <circle cx={cx} cy={cy} r={rad + u * 0.07} fill="none" stroke={turn ? "#f2cd85" : "#fff"} strokeWidth={u * 0.06} strokeDasharray={sel && !turn ? `${u * 0.12} ${u * 0.08}` : undefined} />}
                <circle cx={cx} cy={cy} r={rad} fill={KIND_FILL[t.kind]} stroke="#0b090d" strokeWidth={u * 0.04} />
                <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(rad * 0.82, u * 0.36 * Math.min(t.size, 2))} fill="#fff8ea" fontWeight={700}>{tokenLabel(t.name)}</text>
                {t.out && <path d={`M ${cx - rad * 0.6} ${cy - rad * 0.6} L ${cx + rad * 0.6} ${cy + rad * 0.6} M ${cx + rad * 0.6} ${cy - rad * 0.6} L ${cx - rad * 0.6} ${cy + rad * 0.6}`} stroke="#0b090d" strokeWidth={u * 0.08} strokeLinecap="round" />}
                <title>{t.name}{t.hidden ? " (hidden from players)" : ""}{t.out ? " (out of the fight)" : ""}</title>
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
        <button className="mrbtn" aria-label="Zoom in" onClick={() => { const r = wrap.current!.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.25); }}>+</button>
        <button className="mrbtn" aria-label="Zoom out" onClick={() => { const r = wrap.current!.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 0.8); }}>−</button>
        <button className="mrbtn" aria-label="Fit the map" title="Fit the map" onClick={fit}>⤢</button>
      </div>
    </div>
  );
}
