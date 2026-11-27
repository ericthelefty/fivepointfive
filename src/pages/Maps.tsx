/**
 * Campaign maps: the GM's library of battle maps for a campaign (on the campaign page), and the grid editor, where the
 * GM draws a grid over a map or lines one up with the grid printed on it.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useSession } from "../lib/session.tsx";
import MapBoard, { type MapTool } from "../components/MapBoard.tsx";
import { addMap, deleteMap, getMap, gridAcross, gridBounds, gridFromBox, liveMaps, listMaps, normGrid, onMapChange, saveMap, useMapImage, type CampaignMap, type MapGrid } from "../lib/maps.ts";

/** A small picture of a map. */
export function MapThumb({ path, className }: { path: string; className?: string }) {
  const url = useMapImage(path);
  return <span className={`mapthumb ${className || ""}`} style={url ? { backgroundImage: `url(${url})` } : undefined} aria-hidden="true" />;
}

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

/** "The GM is showing a map" links, for the campaign page and the Characters page. */
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

/** The campaign page's Maps section: everyone sees what's live; the GM uploads and edits the library. */
export function CampaignMaps({ campaignId, gm }: { campaignId: string; gm: boolean }) {
  const [maps, setMaps] = useState<CampaignMap[]>();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const nav = useNavigate();
  useEffect(() => {
    if (!gm) return;
    listMaps(campaignId).then(setMaps, (e) => setMsg(e.message));
  }, [campaignId, gm]);

  const upload = async (f?: File) => {
    if (!f) return;
    setBusy(true); setMsg("");
    try {
      const m = await addMap(campaignId, f, "");
      nav(`/campaigns/${campaignId}/maps/${m.id}`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  };

  return (
    <section className="panel stack">
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, flex: 1 }}>Maps</h2>
        {gm && <>
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
          <button className="btn small primary" disabled={busy} onClick={() => file.current?.click()}>{busy ? "Uploading…" : "Upload a map"}</button>
        </>}
      </div>
      <LiveMapLinks campaignId={campaignId} />
      <p className="faint" style={{ margin: 0 }}>{gm
        ? "Battle maps for this campaign’s encounters. Upload an image, then draw a grid over it or line one up with the grid printed on it. Pick a map for an encounter on its Map tab."
        : "When the GM shows a map, it appears here. You can move your own character’s token on it."}</p>
      {msg && <div className="inset" role="status">{msg}</div>}
      {gm && maps && (maps.length === 0 ? <p className="muted" style={{ margin: 0 }}>No maps yet.</p> : (
        <div className="mapgrid">
          {maps.map((m) => (
            <div key={m.id} className="mapcard">
              <Link to={`/campaigns/${campaignId}/maps/${m.id}`}><MapThumb path={m.path} /></Link>
              <div className="mapcard-b">
                <b>{m.name || "Unnamed map"}</b>
                <span className="faint">{(() => { const b = gridBounds(m.grid, m.width, m.height); return `${b.x1 - b.x0 + 1} × ${b.y1 - b.y0 + 1} squares`; })()}</span>
              </div>
              <div className="mapcard-b" style={{ flexDirection: "row", gap: 6 }}>
                <Link className="btn small" to={`/campaigns/${campaignId}/maps/${m.id}`}>Edit grid</Link>
                <button className="btn small" onClick={async () => {
                  if (!confirm(`Delete the map “${m.name || "Unnamed map"}”? Encounters using it lose their map (their tokens and fog stay, ready for another).`)) return;
                  try { await deleteMap(m); setMaps((l) => l?.filter((x) => x.id !== m.id)); } catch (e) { setMsg((e as Error).message); }
                }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

/** The grid editor: /campaigns/:id/maps/:mapId */
export function MapEditor() {
  const { id, mapId } = useParams();
  const session = useSession();
  const [m, setM] = useState<CampaignMap | null>();
  const [grid, setGrid] = useState<MapGrid>();
  const [name, setName] = useState("");
  const [tool, setTool] = useState<MapTool>("move");
  const [msg, setMsg] = useState("");
  const [saved, setSaved] = useState(true);
  const url = useMapImage(m?.path);
  useEffect(() => {
    if (!mapId) return;
    getMap(mapId).then((x) => { setM(x); if (x) { setGrid(x.grid); setName(x.name); } }, (e) => setMsg(e.message));
  }, [mapId]);

  if (m === undefined) return <div className="panel">{msg || "Loading…"}</div>;
  if (!m || !grid || !id || !session.isGm(m.campaignId)) return <div className="panel">This map doesn’t exist, or you’re not its campaign’s GM. <Link to={`/campaigns/${id}`}>Back to the campaign</Link></div>;

  const set = (g: Partial<MapGrid>) => { setGrid((cur) => normGrid({ ...cur!, ...g })); setSaved(false); };
  const b = gridBounds(grid, m.width, m.height);
  const across = b.x1 - b.x0 + 1, down = b.y1 - b.y0 + 1;
  const save = async () => {
    try { await saveMap({ id: m.id, name: name.trim(), grid }); setSaved(true); setMsg("Saved."); setTimeout(() => setMsg(""), 1500); }
    catch (e) { setMsg((e as Error).message); }
  };
  const num = (v: string) => (v === "" ? NaN : Number(v));

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div><Link to={`/campaigns/${id}`} className="faint">← {session.campaignName(m.campaignId) || "Campaign"}</Link></div>
      <div className="mapedit">
        <div className="mapstage">
          <MapBoard url={url} width={m.width} height={m.height} grid={grid} tokens={[]} fog={{ on: false, cells: [] }} gm tool={tool}
            canDrag={() => false} onBox={(ax, ay, bx, by) => { set(gridFromBox(grid, ax, ay, bx, by)); setTool("move"); }} />
          {tool === "align" && <div className="maphint">Drag a box from one corner of a printed square to the opposite corner.</div>}
        </div>
        <aside className="panel stack mapside">
          <label className="mfield"><span>Name</span><input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} placeholder="Unnamed map" /></label>
          <label className="mchk"><input type="checkbox" checked={grid.show} onChange={(e) => set({ show: e.target.checked })} /> Draw the grid</label>
          <p className="faint" style={{ margin: 0, fontSize: 13 }}>{grid.show ? "Lines are drawn over the map." : "No lines are drawn: use this when the map has its own grid printed on it, and line these squares up with it."}</p>

          <h3 style={{ margin: "6px 0 0" }}>Line it up</h3>
          <button className={`btn small ${tool === "align" ? "primary" : ""}`} onClick={() => setTool(tool === "align" ? "move" : "align")}>{tool === "align" ? "Cancel" : "Fit to one printed square"}</button>
          <label className="mfield"><span>Squares across</span>
            <input type="number" min={1} max={200} value={across} onChange={(e) => { const n = num(e.target.value); if (n >= 1) set(gridAcross(grid, m.width, n)); }} />
          </label>
          <label className="mfield"><span>Square size (pixels)</span>
            <div className="maprow">
              <button className="btn small" aria-label="Smaller" onClick={() => set({ size: grid.size - 0.5 })}>−</button>
              <input type="number" step={0.5} min={8} value={Math.round(grid.size * 100) / 100} onChange={(e) => { const n = num(e.target.value); if (n >= 8) set({ size: n }); }} />
              <button className="btn small" aria-label="Larger" onClick={() => set({ size: grid.size + 0.5 })}>+</button>
            </div>
          </label>
          <label className="mfield"><span>Nudge the grid</span>
            <div className="maprow nudge">
              <button className="btn small" aria-label="Left" onClick={() => set({ ox: grid.ox - 1 })}>←</button>
              <button className="btn small" aria-label="Up" onClick={() => set({ oy: grid.oy - 1 })}>↑</button>
              <button className="btn small" aria-label="Down" onClick={() => set({ oy: grid.oy + 1 })}>↓</button>
              <button className="btn small" aria-label="Right" onClick={() => set({ ox: grid.ox + 1 })}>→</button>
            </div>
          </label>
          <p className="faint" style={{ margin: 0, fontSize: 13 }}>{across} × {down} squares · {across * grid.feet} × {down * grid.feet} feet</p>

          <h3 style={{ margin: "6px 0 0" }}>Look</h3>
          <div className="maprow">
            <label className="mfield" style={{ flex: "0 0 auto" }}><span>Colour</span><input type="color" value={grid.color} onChange={(e) => set({ color: e.target.value })} /></label>
            <label className="mfield" style={{ flex: 1 }}><span>Strength</span><input type="range" min={0.05} max={1} step={0.05} value={grid.opacity} onChange={(e) => set({ opacity: Number(e.target.value) })} /></label>
          </div>
          <label className="mfield"><span>Feet per square</span><input type="number" min={1} max={100} value={grid.feet} onChange={(e) => { const n = num(e.target.value); if (n >= 1) set({ feet: n }); }} /></label>

          <div className="maprow" style={{ marginTop: 8 }}>
            <button className="btn primary" disabled={saved} onClick={save}>{saved ? "Saved" : "Save"}</button>
            <Link className="btn" to={`/campaigns/${id}`}>Done</Link>
          </div>
          {msg && <div className="faint" role="status">{msg}</div>}
        </aside>
      </div>
    </div>
  );
}
