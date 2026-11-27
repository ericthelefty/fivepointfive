/**
 * Battle map pieces used outside the board itself: the grid editor (opened from an encounter's Map tab), where the GM
 * draws a grid over a map or lines one up with the grid printed on it, and the "the GM is showing a map" banner.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import MapBoard, { type MapTool } from "../components/MapBoard.tsx";
import { gridAcross, gridBounds, gridFromBox, liveMaps, normGrid, onMapChange, saveMap, useMapImage, type CampaignMap, type MapGrid } from "../lib/maps.ts";

/** The maps the GM is showing in a campaign right now, as links (kept up to date). */
export function useLiveMaps(campaignId?: string | null) {
  const [live, setLive] = useState<{ encounterId: string; title: string }[]>([]);
  useEffect(() => {
    if (!campaignId) { setLive([]); return; }
    let alive = true;
    const load = () => liveMaps(campaignId).then((l) => { if (alive) setLive(l); });
    load();
    const stop = onMapChange(campaignId, (p) => { if (!p.move && !p.ping) load(); });
    return () => { alive = false; stop(); };
  }, [campaignId]);
  return live;
}

/** "The GM is showing a map" links, on the Characters page. */
export function LiveMapLinks({ campaignId, label }: { campaignId?: string | null; label?: string }) {
  const live = useLiveMaps(campaignId);
  if (!live.length) return null;
  return (
    <div className="livemaps" role="status">
      <span className="livedot" aria-hidden="true" />
      <span>{label || "The GM is showing a map:"}</span>
      {live.map((m) => <Link key={m.encounterId} className="btn small primary" to={`/map/${m.encounterId}`}>{m.title || "Map"}</Link>)}
    </div>
  );
}

/** The grid editor, in place of the map on an encounter's Map tab. */
export function GridEditor({ map, onSaved, onDelete, onClose }: {
  map: CampaignMap;
  onSaved: (m: CampaignMap) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [grid, setGrid] = useState<MapGrid>(map.grid);
  const [name, setName] = useState(map.name);
  const [tool, setTool] = useState<MapTool>("move");
  const [msg, setMsg] = useState("");
  const [saved, setSaved] = useState(true);
  const url = useMapImage(map.path);

  const set = (g: Partial<MapGrid>) => { setGrid((cur) => normGrid({ ...cur, ...g })); setSaved(false); };
  const b = gridBounds(grid, map.width, map.height);
  const across = b.x1 - b.x0 + 1, down = b.y1 - b.y0 + 1;
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
  const num = (v: string) => (v === "" ? NaN : Number(v));

  return (
    <div className="mapplay">
      <div className="mapstage">
        <MapBoard url={url} width={map.width} height={map.height} grid={grid} tokens={[]} fog={{ on: false, cells: [] }} gm tool={tool}
          canDrag={() => false} onBox={(ax, ay, bx, by) => { set(gridFromBox(grid, ax, ay, bx, by)); setTool("move"); }} />
        {tool === "align" && <div className="maphint">Drag a box from one corner of a printed square to the opposite corner.</div>}
      </div>
      <aside className="spanel stack mapside">
        <b>Map and grid</b>
        <label className="mfield"><span>Name</span><input type="text" value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} placeholder="Unnamed map" /></label>
        <label className="mchk"><input type="checkbox" checked={grid.show} onChange={(e) => set({ show: e.target.checked })} /> Draw the grid</label>
        <p className="note" style={{ margin: 0 }}>{grid.show ? "Lines are drawn over the map." : "No lines are drawn: use this when the map has its own grid printed on it, and line these squares up with it."}</p>

        <b style={{ marginTop: 6 }}>Line it up</b>
        <button className={`sbtn ${tool === "align" ? "gold" : "ghost"}`} onClick={() => setTool(tool === "align" ? "move" : "align")}>{tool === "align" ? "Cancel" : "Fit to one printed square"}</button>
        <label className="mfield"><span>Squares across</span>
          <input type="number" min={1} max={200} value={across} onChange={(e) => { const n = num(e.target.value); if (n >= 1) set(gridAcross(grid, map.width, n)); }} />
        </label>
        <label className="mfield"><span>Square size (pixels)</span>
          <div className="maprow">
            <button className="sbtn ghost" aria-label="Smaller" onClick={() => set({ size: grid.size - 0.5 })}>−</button>
            <input type="number" step={0.5} min={8} value={Math.round(grid.size * 100) / 100} onChange={(e) => { const n = num(e.target.value); if (n >= 8) set({ size: n }); }} />
            <button className="sbtn ghost" aria-label="Larger" onClick={() => set({ size: grid.size + 0.5 })}>+</button>
          </div>
        </label>
        <label className="mfield"><span>Nudge the grid</span>
          <div className="maprow">
            <button className="sbtn ghost" aria-label="Left" onClick={() => set({ ox: grid.ox - 1 })}>←</button>
            <button className="sbtn ghost" aria-label="Up" onClick={() => set({ oy: grid.oy - 1 })}>↑</button>
            <button className="sbtn ghost" aria-label="Down" onClick={() => set({ oy: grid.oy + 1 })}>↓</button>
            <button className="sbtn ghost" aria-label="Right" onClick={() => set({ ox: grid.ox + 1 })}>→</button>
          </div>
        </label>
        <p className="note" style={{ margin: 0 }}>{across} × {down} squares · {across * grid.feet} × {down * grid.feet} feet</p>

        <b style={{ marginTop: 6 }}>Look</b>
        <div className="maprow">
          <label className="mfield" style={{ flex: "0 0 auto" }}><span>Colour</span><input type="color" value={grid.color} onChange={(e) => set({ color: e.target.value })} /></label>
          <label className="mfield" style={{ flex: 1 }}><span>Strength</span><input type="range" min={0.05} max={1} step={0.05} value={grid.opacity} onChange={(e) => set({ opacity: Number(e.target.value) })} /></label>
        </div>
        <label className="mfield"><span>Feet per square</span><input type="number" min={1} max={100} value={grid.feet} onChange={(e) => { const n = num(e.target.value); if (n >= 1) set({ feet: n }); }} /></label>

        <div className="maprow" style={{ marginTop: 8 }}>
          <button className="sbtn gold" onClick={() => save(true)}>{saved ? "Done" : "Save and close"}</button>
          {!saved && <button className="sbtn ghost" onClick={() => save()}>Save</button>}
          {!saved && <button className="sbtn ghost" onClick={onClose}>Cancel</button>}
        </div>
        <button className="sbtn ghost" onClick={() => {
          if (confirm(`Delete the map “${map.name || "Unnamed map"}”? Any encounter using it loses its map (its tokens and fog stay, ready for another).`)) onDelete();
        }}>Delete this map</button>
        {msg && <div className="note" role="status">{msg}</div>}
      </aside>
    </div>
  );
}
