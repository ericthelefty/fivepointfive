/**
 * Battle map pieces used outside the board itself: the grid editor (opened from an encounter's Map tab), where the GM
 * draws a grid over a map or lines one up with the grid printed on it, and the "the GM is showing a map" banner.
 */
import { useEffect, useRef, useState } from "react";
import { detectGrid } from "../lib/gridDetect.ts";
import MapBoard, { type MapTool } from "../components/MapBoard.tsx";
import { gridAcross, gridBounds, gridCount, gridDown, gridFromBox, liveMaps, sizeH, normGrid, onMapChange, saveMap, useMapImage, type CampaignMap, type MapGrid } from "../lib/maps.ts";

/** The maps the GM is showing in a campaign right now, as links (kept up to date). */
export function useLiveMaps(campaignId?: string | null) {
  const [live, setLive] = useState<{ encounterId: string; title: string }[]>([]);
  useEffect(() => {
    if (!campaignId) { setLive([]); return; }
    let alive = true;
    const load = () => liveMaps(campaignId).then((l) => { if (alive) setLive(l); });
    load();
    const stop = onMapChange(campaignId, (p) => { if (!p.move && !p.ping && !p.areas) load(); });
    return () => { alive = false; stop(); };
  }, [campaignId]);
  return live;
}

/** "The GM is showing a map" links, on the Characters page and a character's sheet; each opens the map in a new tab. */
export function LiveMapLinks({ campaignId, label }: { campaignId?: string | null; label?: string }) {
  const live = useLiveMaps(campaignId);
  if (!live.length) return null;
  return (
    <div className="livemaps" role="status">
      <span className="livedot" aria-hidden="true" />
      <span>{label || "The GM is showing a map:"}</span>
      {/* in a new tab, so players can go back and forth between their sheet and the map */}
      {live.map((m) => <a key={m.encounterId} className="btn small primary" href={`/map/${m.encounterId}`} target="_blank" rel="noopener" title="Opens in a new tab">{m.title || "Map"} ↗</a>)}
    </div>
  );
}

/**
 * A number box you can clear and type into freely: what you type stays while you type it, a number in range takes effect
 * at once, and leaving the box empty (or out of range) puts back the current value.
 */
function NumBox({ value, onValue, min, max, step }: { value: number; onValue: (n: number) => void; min: number; max: number; step?: number }) {
  const [draft, setDraft] = useState<string | null>(null);
  const ok = (n: number) => Number.isFinite(n) && n >= min && n <= max;
  return (
    <input type="number" inputMode="decimal" min={min} max={max} step={step} value={draft ?? String(value)}
      onFocus={(e) => e.target.select()}
      onChange={(e) => { setDraft(e.target.value); const n = e.target.value === "" ? NaN : Number(e.target.value); if (ok(n)) onValue(n); }}
      onBlur={() => setDraft(null)}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
  );
}

/** The grid editor, in place of the map on an encounter's Map tab. */
export function GridEditor({ map, onSaved, onDelete, onClose, detectFirst }: {
  map: CampaignMap;
  /** Look for a printed grid straight away (a map just uploaded). */
  detectFirst?: boolean;
  onSaved: (m: CampaignMap) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [grid, setGrid] = useState<MapGrid>(map.grid);
  const [name, setName] = useState(map.name);
  const [tool, setTool] = useState<MapTool>("move");
  const [msg, setMsg] = useState("");
  const [saved, setSaved] = useState(true);
  const [step, setStep] = useState(1);
  const url = useMapImage(map.path);
  const [finding, setFinding] = useState(false);
  const tried = useRef(false);

  const find = async () => {
    if (!url) return;
    setFinding(true); setMsg("");
    try {
      const f = await detectGrid(url, map.width, map.height);
      if (!f) { setMsg("Couldn’t find a printed grid on this map. Set the columns and rows yourself."); return; }
      // measuring is good to a pixel or so: a grid that starts a hair from the corner starts at it, and squares a hair
      // from square are square
      let size = f.size, sizeY = f.sizeY;
      if (Math.abs(size - sizeY) / Math.max(size, sizeY) < 0.015) size = sizeY = Math.round(((size + sizeY) / 2) * 100) / 100;
      const snap = (o: number, n: number) => { const m = ((o % n) + n) % n; return m < 2 || n - m < 2 ? 0 : m; };
      const next = normGrid({ ...grid, size, sizeY, ox: snap(f.ox, size), oy: snap(f.oy, sizeY), show: false });
      setGrid(next); setSaved(false);
      const c = gridCount(next, map.width, map.height);
      setMsg(`Found a printed grid: ${c.cols} squares wide × ${c.rows} long. Its lines aren’t drawn over (the map has its own); the blue lines show where the squares are while you edit. Nudge them if they’re off.`);
    } catch (e) { setMsg(`Couldn’t look for a grid: ${(e as Error).message}`); }
    finally { setFinding(false); }
  };
  useEffect(() => { if (detectFirst && url && !tried.current) { tried.current = true; find(); } }, [detectFirst, url]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (g: Partial<MapGrid>) => { setGrid((cur) => normGrid({ ...cur, ...g })); setSaved(false); };
  const b = gridBounds(grid, map.width, map.height);
  const across = b.x1 - b.x0 + 1, down = b.y1 - b.y0 + 1;
  const count = gridCount(grid, map.width, map.height);
  const h = sizeH(grid);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const save = async (close?: boolean) => {
    try {
      const next = { ...map, name: name.trim(), grid };
      await saveMap(next);
      onSaved(next);
      setSaved(true);
      if (close) onClose();
      else { setMsg("Saved."); setTimeout(() => setMsg(""), 1500); }
    } catch (e) { setMsg((e as Error).message); }
  };

  return (
    <div className="mapplay">
      <div className="mapstage">
        <MapBoard url={url} width={map.width} height={map.height} grid={grid.show ? grid : { ...grid, show: true, color: "#38bdf8", opacity: 0.85 }} tokens={[]} fog={{ on: false, cells: [] }} gm tool={tool}
          canDrag={() => false} onBox={(ax, ay, bx, by) => { set(gridFromBox(grid, ax, ay, bx, by)); setTool("move"); }} />
        {tool === "align" && <div className="maphint">Drag a box from one corner of a printed square to the opposite corner.</div>}
        {finding && <div className="maphint">Looking for a grid…</div>}
      </div>
      <aside className="spanel stack mapside">
        <b>Map and grid</b>
        <label className="mfield"><span>Name</span><input type="text" value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} placeholder="Unnamed map" /></label>
        <label className="mchk"><input type="checkbox" checked={grid.show} onChange={(e) => set({ show: e.target.checked })} /> Draw the grid</label>
        <p className="note" style={{ margin: 0 }}>{grid.show ? "Lines are drawn over the map." : "No lines are drawn over the map (it has its own grid printed on it). Here the squares show in blue so you can line them up."}</p>
        {msg && !msg.startsWith("Saved") && <div className="note" role="status">{msg}</div>}

        <b style={{ marginTop: 6 }}>Line it up</b>
        <p className="note" style={{ margin: 0 }}>Detect the grid printed on the map, or set how many squares wide and long it is, then nudge the grid until its lines sit on the map’s.</p>
        <div className="maprow">
          <label className="mfield" style={{ flex: 1 }}><span>Width (squares)</span>
            <NumBox min={1} max={300} value={count.cols} onValue={(n) => set(gridAcross(grid, map.width, n))} />
          </label>
          <label className="mfield" style={{ flex: 1 }}><span>Length (squares)</span>
            <NumBox min={1} max={300} value={count.rows} onValue={(n) => set(gridDown(grid, map.height, n))} />
          </label>
        </div>
        <div className="maprow">
          <button className="sbtn ghost" disabled={finding || !url} onClick={find} title="Find the grid printed on the map">{finding ? "Looking…" : "Detect grid"}</button>
          <button className={`sbtn ${tool === "align" ? "gold" : "ghost"}`} onClick={() => setTool(tool === "align" ? "move" : "align")}>{tool === "align" ? "Cancel" : "Fit to one printed square"}</button>
        </div>
        <div className="mfield"><span>Move the grid</span>
          <div className="maprow">
            <button className="sbtn ghost" aria-label="Left" onClick={() => set({ ox: grid.ox - step })}>←</button>
            <button className="sbtn ghost" aria-label="Up" onClick={() => set({ oy: grid.oy - step })}>↑</button>
            <button className="sbtn ghost" aria-label="Down" onClick={() => set({ oy: grid.oy + step })}>↓</button>
            <button className="sbtn ghost" aria-label="Right" onClick={() => set({ ox: grid.ox + step })}>→</button>
          </div>
        </div>
        <div className="mfield"><span>Stretch the grid</span>
          <div className="maprow">
            <button className="sbtn ghost" title="Narrower squares" onClick={() => set({ size: grid.size - step / 4, sizeY: h })}>↔ −</button>
            <button className="sbtn ghost" title="Wider squares" onClick={() => set({ size: grid.size + step / 4, sizeY: h })}>↔ +</button>
            <button className="sbtn ghost" title="Shorter squares (less long)" onClick={() => set({ sizeY: h - step / 4 })}>↕ −</button>
            <button className="sbtn ghost" title="Longer squares" onClick={() => set({ sizeY: h + step / 4 })}>↕ +</button>
          </div>
        </div>
        <div className="chipsrow" style={{ margin: 0 }} role="group" aria-label="Step">
          {[[0.25, "Fine"], [1, "1 px"], [5, "5 px"]].map(([v, l]) => <button key={v} className={step === v ? "on" : ""} onClick={() => setStep(v as number)}>{l}</button>)}
        </div>
        <div className="maprow">
          <label className="mfield" style={{ flex: 1 }}><span>Square width (px)</span>
            <NumBox step={0.25} min={8} max={1000} value={r2(grid.size)} onValue={(n) => set({ size: n, sizeY: h })} />
          </label>
          <label className="mfield" style={{ flex: 1 }}><span>Square length (px)</span>
            <NumBox step={0.25} min={8} max={1000} value={r2(h)} onValue={(n) => set({ sizeY: n })} />
          </label>
        </div>
        {grid.sizeY != null && <button className="sbtn ghost" onClick={() => set({ sizeY: grid.size })}>Make the squares square</button>}
        <p className="note" style={{ margin: 0 }}>{across} squares wide × {down} long · {across * grid.feet} × {down * grid.feet} feet</p>

        <b style={{ marginTop: 6 }}>Look</b>
        <div className="maprow">
          <label className="mfield" style={{ flex: "0 0 auto" }}><span>Colour</span><input type="color" value={grid.color} onChange={(e) => set({ color: e.target.value })} /></label>
          <label className="mfield" style={{ flex: 1 }}><span>Strength</span><input type="range" min={0.05} max={1} step={0.05} value={grid.opacity} onChange={(e) => set({ opacity: Number(e.target.value) })} /></label>
        </div>
        <label className="mfield"><span>Feet per square</span><NumBox min={1} max={100} value={grid.feet} onValue={(n) => set({ feet: n })} /></label>

        <div className="maprow" style={{ marginTop: 8 }}>
          <button className="sbtn gold" onClick={() => save(true)}>{saved ? "Done" : "Save and close"}</button>
          {!saved && <button className="sbtn ghost" onClick={() => save()}>Save</button>}
          {!saved && <button className="sbtn ghost" onClick={onClose}>Cancel</button>}
        </div>
        <button className="sbtn ghost" onClick={() => {
          if (confirm(`Delete the map “${map.name || "Unnamed map"}”? Any encounter using it loses its map (its tokens and fog stay, ready for another).`)) onDelete();
        }}>Delete this map</button>
        {msg.startsWith("Saved") && <div className="note" role="status">{msg}</div>}
      </aside>
    </div>
  );
}
