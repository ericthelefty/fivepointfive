/**
 * An encounter's battle map: the GM's Map tab (pick a map, place and move tokens, fog, show it to the players), and the
 * players' page for it (/map/:encounterId), where each player moves their own character's token.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { GridEditor } from "./Maps.tsx";
import MapBoard, { type MapTool, type Ping } from "../components/MapBoard.tsx";
import { MapIcon } from "../components/MapIcons.tsx";
import { AreaPanel, defaultAreaSettings, newArea, type AreaSettings } from "../components/AreaPanel.tsx";
import { useAreas } from "../lib/areas.ts";
import { CONDITION_EFFECTS } from "../lib/play.ts";
import { useSession } from "../lib/session.tsx";
import { useMedia } from "../lib/useMedia.ts";
import type { Combatant, Encounter } from "../lib/encounter.ts";
import {
  addMap, allCells, announceMap, normBlock, setBlocks, withFog, deleteMap, clampCell, getEncounterMap, gridBounds, listMaps, moveToken, onMapChange, paintFog, sameTokens, saveEncounterMap, syncTokens,
  NOTE_MAX, condColor, setTokenNote, tokenSeen, useMapImage, viewEncounterMap, type CampaignMap, type EncounterMap, type MapFog, type MapToken, type MapView,
} from "../lib/maps.ts";

type Info = (c: Combatant) => { name: string; size: number; out: boolean };

/** Stop the page behind a full-window map scrolling while it's open. */
function useFullWindow(on: boolean) {
  useEffect(() => {
    if (!on) return;
    document.body.classList.add("mapopen");
    return () => document.body.classList.remove("mapopen");
  }, [on]);
}

/** A colour for someone's pings and measurements. */
const colorOf = (id = "") => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360; return `hsl(${h} 75% 60%)`; };

function usePings() {
  const [pings, setPings] = useState<Ping[]>([]);
  const add = useCallback((px: number, py: number, color: string) => {
    const id = Date.now() + Math.random();
    setPings((l) => [...l, { id, px, py, color }]);
    setTimeout(() => setPings((l) => l.filter((x) => x.id !== id)), 2200);
  }, []);
  return [pings, add] as const;
}

/**
 * The GM's copy of an encounter's map, kept in step with the encounter: everyone in the fight has a token, and the turn
 * and round follow the tracker. Changes save after a moment and are announced to the campaign.
 */
export function useEncounterMap(e: Encounter | undefined, info: Info) {
  const [em, setEm] = useState<EncounterMap | null>();
  const [maps, setMaps] = useState<CampaignMap[]>([]);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef<EncounterMap | null>(null);
  const cid = e?.campaignId || null;
  const eid = e?.id;

  useEffect(() => {
    if (!eid) return;
    let alive = true;
    setEm(undefined);
    getEncounterMap(eid).then((x) => { if (alive) { latest.current = x; setEm(x); } }, (err) => { if (alive) { setError(err.message); setEm(null); } });
    return () => { alive = false; };
  }, [eid]);
  useEffect(() => {
    if (!cid) { setMaps([]); return; }
    listMaps(cid).then(setMaps, (err) => setError(err.message));
  }, [cid]);

  const flush = useCallback(async () => {
    const m = latest.current;
    if (!m) return;
    try { await saveEncounterMap(m); announceMap(cid, { encounterId: m.encounterId }); setError(""); }
    catch (err) { setError((err as Error).message); }
  }, [cid]);
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); flush(); } }, [flush]);

  /** Change the map (and save it soon). */
  const update = useCallback((fn: (m: EncounterMap) => EncounterMap) => {
    const cur = latest.current;
    if (!cur) return;
    const next = fn(cur);
    if (next === cur) return;
    latest.current = next;
    setEm(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = undefined; flush(); }, 350);
  }, [flush]);

  /** Give the encounter a map (its first: make the row). */
  const start = useCallback((mapId: string | null) => {
    if (!e) return;
    const base: EncounterMap = latest.current || { encounterId: e.id, mapId: null, title: e.name, shown: false, tokens: [], fog: { on: false, cells: [] }, turn: e.turn ?? null, round: e.round };
    latest.current = { ...base, mapId };
    setEm(latest.current);
    flush();
  }, [e, flush]);

  // keep the tokens, turn, round and title in step with the encounter
  const synced = em ? syncTokens(em.tokens, e?.combatants || [], info) : null;
  const want = em && e ? { title: e.name, turn: e.turn ?? null, round: e.round } : null;
  const stale = !!(em && synced && want && (!sameTokens(synced, em.tokens) || em.title !== want.title || (em.turn ?? null) !== want.turn || em.round !== want.round));
  useEffect(() => {
    if (stale && synced && want) update((m) => ({ ...m, ...want, tokens: syncTokens(m.tokens, e!.combatants, info) }));
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // a player moving their token: show it at once (it's already saved)
  useEffect(() => {
    if (!cid || !eid) return;
    return onMapChange(cid, (p) => {
      if (p.encounterId !== eid) return;
      const cur = latest.current;
      if (!cur) return;
      if (p.move) { const mv = p.move; latest.current = { ...cur, tokens: cur.tokens.map((t) => (t.uid === mv.uid ? { ...t, x: mv.x, y: mv.y } : t)) }; setEm(latest.current); }
      // a player labelled their token: show it at once (it's already saved)
      if (p.note) { const nt = p.note; latest.current = { ...cur, tokens: cur.tokens.map((t) => (t.uid === nt.uid ? { ...t, note: nt.note || undefined, noteGm: undefined } : t)) }; setEm(latest.current); }
    });
  }, [cid, eid]);

  return { em, maps, setMaps, error, setError, update, start, campaignId: cid };
}

type MapState = ReturnType<typeof useEncounterMap>;

const TOOLS: { id: MapTool; label: string; tip: string }[] = [
  { id: "move", label: "Move", tip: "Drag tokens, or click one to label it; drag the map to pan" },
  { id: "fog", label: "Fog", tip: "Uncover or cover the map, or draw blocks of fog (hold Alt to do the opposite)" },
  { id: "aoe", label: "Area of effect", tip: "Lay out a spell's area to try it; only you see it until you show it" },
  { id: "measure", label: "Measure", tip: "Drag from one square to another" },
  { id: "ping", label: "Point", tip: "Point at a spot for everyone" },
];

/** The GM's Map tab. */
/** The conditions a token can have (the 2024 rules' list), each with its ring colour. */
const CONDITIONS = Object.keys(CONDITION_EFFECTS);

/** A token's conditions: coloured tags; the GM removes one with its × and adds others from a menu. */
function CondChips({ conds, onToggle }: { conds: string[]; onToggle?: (k: string) => void }) {
  if (!conds.length && !onToggle) return null;
  const left = CONDITIONS.filter((k) => !conds.includes(k));
  return (
    <div className="mconds" role="group" aria-label="Conditions">
      {conds.map((k) => (
        <span key={k} className="mcond on" style={{ "--cc": condColor(k) } as React.CSSProperties}>
          {k}
          {onToggle && <button className="mcondx" aria-label={`Remove ${k}`} title={`Remove ${k}`} onClick={() => onToggle(k)}>×</button>}
        </span>
      ))}
      {onToggle && left.length > 0 && (
        <select className="mcondadd" value="" aria-label="Add a condition" onChange={(ev) => { if (ev.target.value) onToggle(ev.target.value); }}>
          <option value="">Add a condition…</option>
          {left.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      )}
    </div>
  );
}

export function EncounterMapTab({ e, st, onExit, onCondition }: { e: Encounter; st: MapState; onExit?: () => void; onCondition?: (uid: string, k: string) => void }) {
  const session = useSession();
  const { em, maps, update, start } = st;
  const map = em?.mapId ? maps.find((m) => m.id === em.mapId) : undefined;
  // the map editor needs a mouse (a computer); players can still open the map on a phone
  const desktop = useMedia("(hover: hover) and (pointer: fine)");
  const [editing, setEditing] = useState<false | "new" | "edit">(false);
  const [uploading, setUploading] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  // a new map for this encounter: upload it, use it, then set its grid
  const upload = async (f?: File) => {
    if (!f || !e.campaignId) return;
    setUploading(true);
    try {
      const m = await addMap(e.campaignId, f, e.name);
      st.setMaps((l) => [m, ...l]);
      start(m.id);
      setEditing("new");
      st.setError("");
    } catch (err) { st.setError((err as Error).message); }
    finally { setUploading(false); if (file.current) file.current.value = ""; }
  };
  const uploader = <>
    <input ref={file} type="file" accept="image/*" hidden onChange={(ev) => upload(ev.target.files?.[0])} />
    <button className="sbtn gold" disabled={uploading} onClick={() => file.current?.click()}>{uploading ? "Uploading…" : "Upload a map"}</button>
  </>;
  const url = useMapImage(map?.path);
  const [tool, setTool] = useState<MapTool>("move");
  const [brush, setBrush] = useState<number | "box">(1);
  const [fogReveal, setFogReveal] = useState(true);
  const [selBlock, setSelBlock] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [undo, setUndo] = useState<MapFog[]>([]);
  const [pings, addPing] = usePings();
  const me = colorOf(session.user?.id);
  useFullWindow(!!(desktop && e.campaignId && em && map && !editing));
  const areas = useAreas(e.id, st.campaignId, session.user?.id, true);
  const [areaSet, setAreaSet] = useState<AreaSettings>(defaultAreaSettings);
  const [selArea, setSelArea] = useState<string | null>(null);
  const [areaHint, setAreaHint] = useState("");
  // Delete or Backspace removes the chosen fog block (not while typing in a box)
  const delKey = useRef<() => void>(undefined);
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== "Delete" && ev.key !== "Backspace") return;
      const t = ev.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      if (delKey.current) { ev.preventDefault(); delKey.current(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  delKey.current = undefined; // set again below while a block is chosen

  useEffect(() => {
    if (!st.campaignId) return;
    return onMapChange(st.campaignId, (p) => { if (p.encounterId === e.id && p.ping) addPing(p.ping.px, p.ping.py, colorOf(p.ping.who)); });
  }, [st.campaignId, e.id, addPing]);

  if (!desktop) {
    return (
      <div className="spanel stack">
        <p className="note" style={{ margin: 0 }}>The map editor works on a computer with a mouse. Open this encounter there to upload a map, set its grid, place tokens and lift the fog.</p>
        {em?.shown && map && <div><Link className="sbtn ghost" to={`/map/${e.id}`}>See what your players see</Link></div>}
      </div>
    );
  }
  if (!e.campaignId) return <div className="spanel"><p className="note" style={{ margin: 0 }}>Put this encounter in a campaign (at the top of the page) to give it a map: the map is shown to that campaign’s players.</p></div>;
  if (em === undefined) return <div className="spanel"><p className="note" style={{ margin: 0 }}>Loading…</p></div>;

  const picker = (
    <select value={em?.mapId || ""} aria-label="Map" onChange={(ev) => start(ev.target.value || null)}>
      <option value="">{maps.length ? "Use a map you’ve uploaded…" : "No maps uploaded yet"}</option>
      {maps.map((m) => <option key={m.id} value={m.id}>{m.name || "Unnamed map"}</option>)}
    </select>
  );
  if (!em || !map) {
    return (
      <div className="spanel stack">
        <p className="note" style={{ margin: 0 }}>Upload a battle map for this encounter, then set its grid. Everyone in the fight gets a token you can place on it. A map you upload can be used again in this campaign’s other encounters.</p>
        <div className="maprow">{uploader}{maps.length > 0 && picker}</div>
        {st.error && <p className="note">{st.error}</p>}
      </div>
    );
  }

  if (editing) {
    return (
      <GridEditor key={map.id} map={map} detectFirst={editing === "new"} onClose={() => setEditing(false)}
        onSaved={(m) => { st.setMaps((l) => l.map((x) => (x.id === m.id ? m : x))); announceMap(st.campaignId, { encounterId: e.id }); }}
        onDelete={async () => {
          try { await deleteMap(map); st.setMaps((l) => l.filter((x) => x.id !== map.id)); update((m) => ({ ...m, mapId: null, shown: false })); setEditing(false); }
          catch (err) { st.setError((err as Error).message); }
        }} />
    );
  }

  const g = map.grid;
  const tray = em.tokens.filter((t) => t.x == null);
  const selTok = em.tokens.find((t) => t.uid === sel);
  const setTok = (uid: string, patch: Partial<MapToken>) => update((m) => ({ ...m, tokens: m.tokens.map((t) => (t.uid === uid ? { ...t, ...patch } : t)) }));
  const fogDo = (fn: (f: MapFog) => MapFog) => update((m) => { const f = fn(m.fog); if (f === m.fog) return m; setUndo((u) => [...u.slice(-30), m.fog]); return { ...m, fog: f }; });
  const place = (uid: string, x: number, y: number) => {
    const t = em.tokens.find((k) => k.uid === uid);
    const c = clampCell(g, map.width, map.height, x, y, t?.size || 1);
    setTok(uid, { x: c.x, y: c.y });
    announceMap(st.campaignId, { encounterId: e.id, move: { uid, x: c.x, y: c.y } });
  };
  // put everyone still in the tray in a row in the middle of the map
  const placeAll = () => {
    const b = gridBounds(g, map.width, map.height);
    const taken = new Set(em.tokens.filter((t) => t.x != null).map((t) => `${t.x},${t.y}`));
    let x = Math.floor((b.x0 + b.x1) / 2) - Math.floor(tray.length / 2), y = Math.floor((b.y0 + b.y1) / 2);
    update((m) => ({ ...m, tokens: m.tokens.map((t) => {
      if (t.x != null) return t;
      while (taken.has(`${x},${y}`)) x++;
      const c = clampCell(g, map.width, map.height, x, y, t.size);
      taken.add(`${c.x},${c.y}`); x += t.size;
      return { ...t, x: c.x, y: c.y };
    }) }));
  };

  const fogTool = tool === "fog";
  const blocks = em.fog.blocks || [];
  const block = blocks.find((b) => b.id === selBlock);
  const dropBlock = (id: string) => { fogDo((f) => setBlocks(f, (f.blocks || []).filter((x) => x.id !== id))); setSelBlock(null); };
  const putBlock = (b: typeof blocks[number]) => fogDo((f) => setBlocks(f, (f.blocks || []).map((x) => (x.id === b.id ? normBlock(b) : x))));
  delKey.current = fogTool && block ? () => dropBlock(block.id) : undefined;
  return (
    <div className="mapfull" role="dialog" aria-label={`Map: ${e.name}`}>
      <div className="maptop">
        {onExit && <button className="mtbtn" onClick={onExit} title="Back to the encounter">← {e.name}</button>}
        {picker}
        <label className="mchk" title="Players in the campaign see the map, without hidden tokens or anything under the fog, and can move their own token">
          <input type="checkbox" checked={em.shown} onChange={(ev) => update((m) => ({ ...m, shown: ev.target.checked }))} /> Show to players
        </label>
        {em.shown && <Link className="mtbtn" to={`/map/${e.id}`} target="_blank">Players’ view</Link>}
        <label className="mchk" title="Cover the map with fog; uncover what the players can see">
          <input type="checkbox" checked={em.fog.on} onChange={(ev) => update((m) => ({ ...m, fog: { ...m.fog, on: ev.target.checked } }))} /> Fog
        </label>
        <span className="mtgrow" />
        {e.round > 0 && <span className="mtinfo">Round {e.round}{em.tokens.find((t) => t.uid === em.turn) ? ` · ${em.tokens.find((t) => t.uid === em.turn)!.name}` : ""}</span>}
        <button className="mtbtn" onClick={() => setEditing("edit")}>Edit map and grid</button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(ev) => upload(ev.target.files?.[0])} />
        <button className="mtbtn" disabled={uploading} onClick={() => file.current?.click()}>{uploading ? "Uploading…" : "Upload a map"}</button>
      </div>
      <div className="mapstage">
        <MapBoard url={url} width={map.width} height={map.height} grid={g} tokens={em.tokens} fog={em.fog} gm tool={tool} brush={brush} fogReveal={fogReveal} blocks={blocks} selBlock={selBlock} turn={em.turn} selected={sel}
          onBlockAdd={(b) => { const id = Date.now().toString(36); fogDo((f) => setBlocks(f, [...(f.blocks || []), normBlock({ ...b, id })])); setSelBlock(id); }}
          onBlockChange={putBlock} onBlockSelect={setSelBlock} onBlockDelete={dropBlock}
          areas={areas.all.map((a) => ({ a, mine: areas.mine(a), shown: areas.isShown(a.id) }))} selArea={selArea} onAreaSelect={(id) => { setSelArea(id); setAreaHint(""); }}
          areaNew={newArea(areaSet)} onAreaAdd={(a) => { areas.add(a); setAreaHint(""); }} onAreaChange={areas.change} onAreaHint={setAreaHint}
          color={me} pings={pings} canDrag={() => true}
          onMove={(uid, x, y) => place(uid, x, y)}
          onSelect={(uid) => { setSel(uid); setPick(null); }}
          onCell={(x, y) => { if (pick) { place(pick, x, y); setPick(null); } }}
          onFog={(cells, reveal) => fogDo((f) => paintFog(f, cells, reveal))}
          onPing={(px, py) => { addPing(px, py, me); announceMap(st.campaignId, { encounterId: e.id, ping: { px, py, who: session.user?.id || "" } }); }} />
        <div className="maprail" role="toolbar" aria-label="Map tools">
          {TOOLS.filter((t) => em.fog.on || t.id !== "fog").map((t) => (
            <button key={t.id} className={`mrbtn ${tool === t.id ? "on" : ""}`} title={`${t.label}: ${t.tip}`} aria-label={t.label} aria-pressed={tool === t.id} onClick={() => setTool(t.id)}><MapIcon name={t.id} /></button>
          ))}
          {em.fog.on && <>
            <hr />
            <button className="mrbtn" title="Undo the last fog change" aria-label="Undo fog" disabled={!undo.length} onClick={() => { const last = undo[undo.length - 1]; setUndo((u) => u.slice(0, -1)); update((m) => ({ ...m, fog: last })); }}><MapIcon name="undo" /></button>
          </>}
        </div>
        {pick && <div className="maphint">Click a square to put {em.tokens.find((t) => t.uid === pick)?.name} there.</div>}
        {st.error && <div className="maphint bad">{st.error}</div>}
        {(fogTool || selTok || tray.length > 0 || tool === "aoe") && (
          <div className="mapfloat">
            {tool === "aoe" && <AreaPanel st={areas} settings={areaSet} setSettings={setAreaSet} selected={selArea} setSelected={setSelArea}
              ctx={{ feet: g.feet, tokens: em.tokens, bounds: gridBounds(g, map.width, map.height) }} nameOf={(uid) => (uid === session.user?.id ? "you" : session.nameOf(uid || ""))} hint={areaHint} />}
            {fogTool && (
              <div className="mfcard">
                <b>Fog</b>
                <div className="maprow" role="group" aria-label="Fog does">
                  <button className={`mtbtn ${fogReveal ? "on" : ""}`} aria-pressed={fogReveal} onClick={() => setFogReveal(true)}>Reveal</button>
                  <button className={`mtbtn ${!fogReveal ? "on" : ""}`} aria-pressed={!fogReveal} onClick={() => setFogReveal(false)}>Cover</button>
                  <span className="mfhint">Alt: the other</span>
                </div>
                <div className="maprow" role="group" aria-label="Shape">
                  {([0, 1, 2] as const).map((r) => <button key={r} className={`mtbtn ${brush === r ? "on" : ""}`} onClick={() => setBrush(r)}>{r * 2 + 1} sq</button>)}
                  <button className={`mtbtn ${brush === "box" ? "on" : ""}`} onClick={() => setBrush("box")} title="Drag a rectangle that snaps to the grid">Rectangle</button>
                </div>
                {brush === "box" && <p className="mfhint" style={{ margin: 0 }}>{fogReveal ? "Drag a rectangle to uncover it." : "Drag a rectangle to make a block of fog. Drag a block to move it, or its corners to resize it."}</p>}
                {block && (
                  <div className="mfsub">
                    <div className="maprow"><b style={{ flex: 1 }}>Fog block</b><span className="mfhint">Delete key</span><button className="mtbtn" onClick={() => dropBlock(block.id)}>Delete</button></div>
                    <div className="maprow">
                      <label className="mfield" style={{ flex: 1 }}><span>Width (squares)</span>
                        <input type="number" min={1} max={200} value={block.w} onChange={(ev) => { const n = Number(ev.target.value); if (n >= 1) putBlock({ ...block, w: n }); }} /></label>
                      <label className="mfield" style={{ flex: 1 }}><span>Length (squares)</span>
                        <input type="number" min={1} max={200} value={block.h} onChange={(ev) => { const n = Number(ev.target.value); if (n >= 1) putBlock({ ...block, h: n }); }} /></label>
                    </div>
                  </div>
                )}
                <div className="maprow">
                  <button className="mtbtn" onClick={() => fogDo((f) => withFog(f, allCells(g, map.width, map.height), f.blocks || []))}>Reveal all</button>
                  <button className="mtbtn" onClick={() => fogDo((f) => withFog(f, [], f.blocks || []))}>Cover all</button>
                  {blocks.length > 0 && <button className="mtbtn" onClick={() => { fogDo((f) => setBlocks(f, [])); setSelBlock(null); }}>Remove blocks</button>}
                </div>
              </div>
            )}
            {selTok && (
              <div className="mfcard">
                <div className="maprow"><b style={{ flex: 1 }}>{selTok.name}</b><button className="mtbtn" aria-label="Close" onClick={() => setSel(null)}>×</button></div>
                <label className="mfield"><span>Text on the token</span>
                  <input type="text" maxLength={NOTE_MAX} value={selTok.note || ""} placeholder="Blessed, Leader, Prone…" onChange={(ev) => setTok(selTok.uid, { note: ev.target.value || undefined })} />
                </label>
                {selTok.note && <label className="mchk"><input type="checkbox" checked={!!selTok.noteGm} onChange={(ev) => setTok(selTok.uid, { noteGm: ev.target.checked || undefined })} /> Only the GM sees the text</label>}
                <span className="mfhint">Conditions{selTok.kind === "pc" ? " (on their sheet too)" : ""}</span>
                <CondChips conds={selTok.conds || []} onToggle={onCondition ? (k) => onCondition(selTok.uid, k) : undefined} />
                <label className="mchk"><input type="checkbox" checked={!!selTok.hidden} onChange={(ev) => setTok(selTok.uid, { hidden: ev.target.checked })} /> Hidden from players</label>
                <div className="maprow">
                  <span>Size</span>
                  {[1, 2, 3, 4].map((n) => <button key={n} className={`mtbtn ${selTok.size === n ? "on" : ""}`} onClick={() => setTok(selTok.uid, { size: n, sized: true })}>{n}×{n}</button>)}
                </div>
                <button className="mtbtn" onClick={() => { setTok(selTok.uid, { x: undefined, y: undefined }); setSel(null); }}>Take off the map</button>
              </div>
            )}
            {tray.length > 0 && (
              <div className="mfcard">
                <div className="maprow"><b style={{ flex: 1 }}>Not on the map</b>{tray.length > 1 && <button className="mtbtn" onClick={placeAll}>Place all</button>}</div>
                <div className="maptray">
                  {tray.map((t) => <button key={t.uid} className={`mtray k-${t.kind} ${pick === t.uid ? "on" : ""}`} onClick={() => { setPick(pick === t.uid ? null : t.uid); setTool("move"); }} title="Pick, then click a square on the map">{t.name}</button>)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** The players' page for an encounter's map: /map/:encounterId */
export function PlayerMap() {
  const { id } = useParams();
  const session = useSession();
  const [v, setV] = useState<MapView | null>();
  const [err, setErr] = useState("");
  const [tool, setTool] = useState<MapTool>("move");
  const [pings, addPing] = usePings();
  const url = useMapImage(v?.map?.path);
  const me = colorOf(session.user?.id);
  useFullWindow(!!v?.map);
  const areas = useAreas(id, v?.campaignId, session.user?.id, !!v?.gm);
  const [areaSet, setAreaSet] = useState<AreaSettings>(defaultAreaSettings);
  const [selArea, setSelArea] = useState<string | null>(null);
  const [areaHint, setAreaHint] = useState("");
  const [selTok, setSelTok] = useState<string | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const load = useCallback(() => { if (id) viewEncounterMap(id).then(setV, (e) => setErr(e.message)); }, [id]);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  const reload = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!v?.campaignId) return;
    return onMapChange(v.campaignId, (p) => {
      if (p.encounterId !== id) return;
      if (p.ping) { addPing(p.ping.px, p.ping.py, colorOf(p.ping.who)); return; }
      if (p.areas) return; // areas look themselves up (useAreas)
      if (p.move) { const mv = p.move; setV((cur) => cur && { ...cur, tokens: cur.tokens.map((t) => (t.uid === mv.uid ? { ...t, x: mv.x, y: mv.y } : t)) }); }
      // fog and hidden tokens are worked out by the database, so look again
      clearTimeout(reload.current);
      reload.current = setTimeout(load, p.move ? 1200 : 150);
    });
  }, [v?.campaignId, id, load, addPing]);

  if (v === undefined) return <div className="panel">{err || "Loading…"}</div>;
  if (!v || !v.map) return <div className="panel">The GM isn’t showing this map right now. <Link to="/">Back to your characters</Link></div>;

  const map = v.map;
  const mine = new Set(v.mine);
  // the GM gets everything from the database; here they see what the players see
  const tokens = v.gm ? v.tokens.filter((t) => tokenSeen(t, v.fog)) : v.tokens;
  const canDrag = (t: MapToken) => v.gm || (t.kind === "pc" && !!t.char && mine.has(t.char) && !t.out);
  const turnName = v.tokens.find((t) => t.uid === v.turn)?.name;
  const picked = tokens.find((t) => t.uid === selTok);

  return (
    <div className="mapfull" role="dialog" aria-label={`Map: ${v.title || "Map"}`}>
      <div className="maptop">
        <Link className="mtbtn" to="/" title="Back to your characters">←</Link>
        <b className="mttitle">{v.title || "Map"}</b>
        {(v.round > 0 || turnName) && <span className="mtinfo">{v.round ? `Round ${v.round}` : ""}{turnName ? ` · ${turnName}’s turn` : ""}</span>}
        <span className="mtgrow" />
        {v.gm && <span className="mtinfo">What your players see</span>}
        {v.gm && <Link className="mtbtn" to={`/encounters/${v.encounterId}?tab=map`}>Open in Encounters</Link>}
      </div>
      <div className="mapstage">
        <MapBoard url={url} width={map.width} height={map.height} grid={map.grid} tokens={tokens} fog={v.fog} gm={false} tool={tool} turn={v.turn} color={me} pings={pings}
          canDrag={canDrag} selected={selTok} onSelect={setSelTok}
          onMove={async (uid, x, y) => {
            const before = v.tokens;
            setV((cur) => cur && { ...cur, tokens: cur.tokens.map((t) => (t.uid === uid ? { ...t, x, y } : t)) });
            try {
              if (!(await moveToken(v.encounterId, uid, x, y))) throw new Error("The GM has stopped showing this map, or that token isn’t yours.");
              announceMap(v.campaignId, { encounterId: v.encounterId, move: { uid, x, y } });
              setErr("");
            } catch (e) { setErr((e as Error).message); setV((cur) => cur && { ...cur, tokens: before }); }
          }}
          onPing={(px, py) => { addPing(px, py, me); announceMap(v.campaignId, { encounterId: v.encounterId, ping: { px, py, who: session.user?.id || "" } }); }}
          areas={areas.all.map((a) => ({ a, mine: areas.mine(a), shown: areas.isShown(a.id) }))} selArea={selArea} onAreaSelect={(i) => { setSelArea(i); setAreaHint(""); }}
          areaNew={newArea(areaSet)} onAreaAdd={(a) => { areas.add(a); setAreaHint(""); }} onAreaChange={areas.change} onAreaHint={setAreaHint} />
        {tool === "move" && picked && (
          <div className="mapfloat">
            <div className="mfcard">
              <div className="maprow"><b style={{ flex: 1 }}>{picked.name}</b><button className="mtbtn" aria-label="Close" onClick={() => setSelTok(null)}>×</button></div>
              {canDrag(picked) ? (
                <label className="mfield"><span>Text on your token</span>
                  <input type="text" maxLength={NOTE_MAX} value={picked.note || ""} placeholder="Raging, Hidden, Concentrating…" onChange={(ev) => {
                    const note = ev.target.value;
                    setV((cur) => cur && { ...cur, tokens: cur.tokens.map((t) => (t.uid === picked.uid ? { ...t, note: note || undefined } : t)) });
                    clearTimeout(noteTimer.current);
                    noteTimer.current = setTimeout(async () => {
                      try {
                        if (!(await setTokenNote(v.encounterId, picked.uid, note))) throw new Error("The GM has stopped showing this map.");
                        announceMap(v.campaignId, { encounterId: v.encounterId, note: { uid: picked.uid, note: note.trim() || undefined } });
                        setErr("");
                      } catch (e) { setErr((e as Error).message); }
                    }, 400);
                  }} />
                </label>
              ) : picked.note ? <span>{picked.note}</span> : null}
              {(picked.conds?.length || 0) > 0 && <><span className="mfhint">Conditions</span><CondChips conds={picked.conds!} /></>}
              {!canDrag(picked) && !picked.note && !picked.conds?.length && <span className="mfhint">Nothing on this token.</span>}
            </div>
          </div>
        )}
        {tool === "aoe" && (
          <div className="mapfloat">
            <AreaPanel st={areas} settings={areaSet} setSettings={setAreaSet} selected={selArea} setSelected={setSelArea}
              ctx={{ feet: map.grid.feet, tokens, bounds: gridBounds(map.grid, map.width, map.height) }} nameOf={(uid) => (uid === session.user?.id ? "you" : session.nameOf(uid || "") || "someone")} hint={areaHint} />
          </div>
        )}
        <div className="maprail" role="toolbar" aria-label="Map tools">
          {TOOLS.filter((t) => t.id === "move" || t.id === "aoe" || t.id === "measure" || t.id === "ping").map((t) => (
            <button key={t.id} className={`mrbtn ${tool === t.id ? "on" : ""}`} title={`${t.label}: ${t.id === "move" ? "Drag your token; drag the map to pan" : t.tip}`} aria-label={t.label} aria-pressed={tool === t.id} onClick={() => setTool(t.id)}><MapIcon name={t.id} /></button>
          ))}
        </div>
        {err && <div className="maphint bad">{err}</div>}
        <div className="mapfoot">Drag your token to move it · every square is {map.grid.feet} feet, diagonals too</div>
      </div>
    </div>
  );
}
