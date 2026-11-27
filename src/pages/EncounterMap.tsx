/**
 * An encounter's battle map: the GM's Map tab (pick a map, place and move tokens, fog, show it to the players), and the
 * players' page for it (/map/:encounterId), where each player moves their own character's token.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import MapBoard, { type MapTool, type Ping } from "../components/MapBoard.tsx";
import { useSession } from "../lib/session.tsx";
import type { Combatant, Encounter } from "../lib/encounter.ts";
import {
  allCells, announceMap, clampCell, getEncounterMap, gridBounds, listMaps, moveToken, onMapChange, paintFog, sameTokens, saveEncounterMap, syncTokens,
  useMapImage, viewEncounterMap, type CampaignMap, type EncounterMap, type MapFog, type MapToken, type MapView,
} from "../lib/maps.ts";

type Info = (c: Combatant) => { name: string; size: number; out: boolean };

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
      if (p.encounterId !== eid || !p.move) return;
      const mv = p.move;
      const cur = latest.current;
      if (cur) { latest.current = { ...cur, tokens: cur.tokens.map((t) => (t.uid === mv.uid ? { ...t, x: mv.x, y: mv.y } : t)) }; setEm(latest.current); }
    });
  }, [cid, eid]);

  return { em, maps, error, update, start, campaignId: cid };
}

type MapState = ReturnType<typeof useEncounterMap>;

const TOOLS: { id: MapTool; label: string; icon: string; tip: string }[] = [
  { id: "move", label: "Move", icon: "✋", tip: "Drag tokens; drag the map to pan" },
  { id: "reveal", label: "Reveal", icon: "☀", tip: "Uncover fog" },
  { id: "cover", label: "Cover", icon: "☁", tip: "Cover with fog" },
  { id: "measure", label: "Measure", icon: "📏", tip: "Drag from one square to another" },
  { id: "ping", label: "Point", icon: "◎", tip: "Point at a spot for everyone" },
];

/** The GM's Map tab. */
export function EncounterMapTab({ e, st }: { e: Encounter; st: MapState }) {
  const session = useSession();
  const { em, maps, update, start } = st;
  const map = em?.mapId ? maps.find((m) => m.id === em.mapId) : undefined;
  const url = useMapImage(map?.path);
  const [tool, setTool] = useState<MapTool>("move");
  const [brush, setBrush] = useState<number | "box">(1);
  const [sel, setSel] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [undo, setUndo] = useState<MapFog[]>([]);
  const [pings, addPing] = usePings();
  const me = colorOf(session.user?.id);

  useEffect(() => {
    if (!st.campaignId) return;
    return onMapChange(st.campaignId, (p) => { if (p.encounterId === e.id && p.ping) addPing(p.ping.px, p.ping.py, colorOf(p.ping.who)); });
  }, [st.campaignId, e.id, addPing]);

  if (!e.campaignId) return <div className="spanel"><p className="note" style={{ margin: 0 }}>Maps belong to a campaign. Put this encounter in a campaign (at the top of the page) to give it a map.</p></div>;
  if (em === undefined) return <div className="spanel"><p className="note" style={{ margin: 0 }}>Loading…</p></div>;

  const picker = (
    <select value={em?.mapId || ""} aria-label="Map" onChange={(ev) => start(ev.target.value || null)}>
      <option value="">{maps.length ? "No map" : "No maps in this campaign yet"}</option>
      {maps.map((m) => <option key={m.id} value={m.id}>{m.name || "Unnamed map"}</option>)}
    </select>
  );
  if (!em || !map) {
    return (
      <div className="spanel stack">
        <p className="note" style={{ margin: 0 }}>Pick a battle map for this encounter. Everyone in the fight gets a token you can place on it.</p>
        <div className="maprow">{picker}<Link className="btn small" to={`/campaigns/${e.campaignId}`}>Upload or edit maps</Link></div>
        {st.error && <p className="note">{st.error}</p>}
      </div>
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

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="mapbar">
        {picker}
        <label className="mchk" title="Players in the campaign see the map, without hidden tokens or anything under the fog, and can move their own token">
          <input type="checkbox" checked={em.shown} onChange={(ev) => update((m) => ({ ...m, shown: ev.target.checked }))} /> Show to players
        </label>
        {em.shown && <Link className="btn small" to={`/map/${e.id}`} target="_blank">Players’ view</Link>}
        <span style={{ flex: 1 }} />
        <label className="mchk" title="Cover the map with fog; uncover what the players can see">
          <input type="checkbox" checked={em.fog.on} onChange={(ev) => update((m) => ({ ...m, fog: { ...m.fog, on: ev.target.checked } }))} /> Fog
        </label>
        <Link className="btn small" to={`/campaigns/${e.campaignId}/maps/${map.id}`}>Edit grid</Link>
      </div>
      {st.error && <p className="note">{st.error}</p>}
      <div className="mapplay">
        <div className="mapstage">
          <MapBoard url={url} width={map.width} height={map.height} grid={g} tokens={em.tokens} fog={em.fog} gm tool={tool} brush={brush} turn={em.turn} selected={sel}
            color={me} pings={pings} canDrag={() => true}
            onMove={(uid, x, y) => place(uid, x, y)}
            onSelect={(uid) => { setSel(uid); setPick(null); }}
            onCell={(x, y) => { if (pick) { place(pick, x, y); setPick(null); } }}
            onFog={(cells, reveal) => fogDo((f) => paintFog(f, cells, reveal))}
            onPing={(px, py) => { addPing(px, py, me); announceMap(st.campaignId, { encounterId: e.id, ping: { px, py, who: session.user?.id || "" } }); }} />
          <div className="maprail" role="toolbar" aria-label="Map tools">
            {TOOLS.filter((t) => em.fog.on || (t.id !== "reveal" && t.id !== "cover")).map((t) => (
              <button key={t.id} className={`mrbtn ${tool === t.id ? "on" : ""}`} title={`${t.label}: ${t.tip}`} aria-label={t.label} aria-pressed={tool === t.id} onClick={() => setTool(t.id)}>{t.icon}</button>
            ))}
            {em.fog.on && <>
              <hr />
              <button className="mrbtn" title="Undo the last fog change" aria-label="Undo fog" disabled={!undo.length} onClick={() => { const last = undo[undo.length - 1]; setUndo((u) => u.slice(0, -1)); update((m) => ({ ...m, fog: last })); }}>↶</button>
            </>}
          </div>
          {pick && <div className="maphint">Click a square to put {em.tokens.find((t) => t.uid === pick)?.name} there.</div>}
        </div>
        <aside className="mapside stack">
          {(tool === "reveal" || tool === "cover") && (
            <div className="spanel stack">
              <b>{tool === "reveal" ? "Reveal" : "Cover"}</b>
              <div className="chipsrow" style={{ margin: 0 }}>
                {([0, 1, 2, "box"] as const).map((b) => <button key={b} className={brush === b ? "on" : ""} onClick={() => setBrush(b)}>{b === "box" ? "Box" : `${b * 2 + 1} sq`}</button>)}
              </div>
              <div className="maprow">
                <button className="sbtn ghost" onClick={() => fogDo((f) => ({ ...f, cells: allCells(g, map.width, map.height) }))}>Reveal all</button>
                <button className="sbtn ghost" onClick={() => fogDo((f) => ({ ...f, cells: [] }))}>Cover all</button>
              </div>
            </div>
          )}
          {selTok && (
            <div className="spanel stack">
              <b>{selTok.name}</b>
              <label className="mchk"><input type="checkbox" checked={!!selTok.hidden} onChange={(ev) => setTok(selTok.uid, { hidden: ev.target.checked })} /> Hidden from players</label>
              <div className="maprow">
                <span className="note">Size</span>
                {[1, 2, 3, 4].map((n) => <button key={n} className={`sbtn ${selTok.size === n ? "gold" : "ghost"}`} onClick={() => setTok(selTok.uid, { size: n, sized: true })}>{n}×{n}</button>)}
              </div>
              <button className="sbtn ghost" onClick={() => { setTok(selTok.uid, { x: undefined, y: undefined }); setSel(null); }}>Take off the map</button>
            </div>
          )}
          <div className="spanel stack">
            <div className="maprow"><b style={{ flex: 1 }}>Not on the map</b>{tray.length > 1 && <button className="sbtn ghost" onClick={placeAll}>Place all</button>}</div>
            {tray.length === 0 ? <p className="note" style={{ margin: 0 }}>{em.tokens.length ? "Everyone’s on the map." : "Nobody’s in this fight yet. Add monsters and characters on the Build tab."}</p> : (
              <div className="maptray">
                {tray.map((t) => <button key={t.uid} className={`mtray k-${t.kind} ${pick === t.uid ? "on" : ""}`} onClick={() => { setPick(pick === t.uid ? null : t.uid); setTool("move"); }} title="Pick, then click a square on the map">{t.name}</button>)}
              </div>
            )}
          </div>
          <p className="note" style={{ margin: 0 }}>{em.shown ? "Players can see this map and move their own tokens." : "Players can’t see this map yet."} Hidden tokens{em.fog.on ? " and monsters under the fog" : ""} never reach their screens.</p>
        </aside>
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

  const load = useCallback(() => { if (id) viewEncounterMap(id).then(setV, (e) => setErr(e.message)); }, [id]);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  const reload = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!v?.campaignId) return;
    return onMapChange(v.campaignId, (p) => {
      if (p.encounterId !== id) return;
      if (p.ping) { addPing(p.ping.px, p.ping.py, colorOf(p.ping.who)); return; }
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
  const canDrag = (t: MapToken) => v.gm || (t.kind === "pc" && !!t.char && mine.has(t.char) && !t.out);
  const turnName = v.tokens.find((t) => t.uid === v.turn)?.name;

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="mapbar">
        <h1 style={{ margin: 0, fontSize: 22 }}>{v.title || "Map"}</h1>
        <span className="faint">{v.round ? `Round ${v.round}` : ""}{turnName ? ` · ${turnName}’s turn` : ""}</span>
        <span style={{ flex: 1 }} />
        {v.gm && <Link className="btn small" to={`/encounters/${v.encounterId}?tab=map`}>Open in Encounters</Link>}
      </div>
      {err && <p className="faint">{err}</p>}
      <div className="mapstage full">
        <MapBoard url={url} width={map.width} height={map.height} grid={map.grid} tokens={v.tokens} fog={v.fog} gm={false} tool={tool} turn={v.turn} color={me} pings={pings}
          canDrag={canDrag}
          onMove={async (uid, x, y) => {
            const before = v.tokens;
            setV((cur) => cur && { ...cur, tokens: cur.tokens.map((t) => (t.uid === uid ? { ...t, x, y } : t)) });
            try {
              if (!(await moveToken(v.encounterId, uid, x, y))) throw new Error("The GM has stopped showing this map, or that token isn’t yours.");
              announceMap(v.campaignId, { encounterId: v.encounterId, move: { uid, x, y } });
              setErr("");
            } catch (e) { setErr((e as Error).message); setV((cur) => cur && { ...cur, tokens: before }); }
          }}
          onPing={(px, py) => { addPing(px, py, me); announceMap(v.campaignId, { encounterId: v.encounterId, ping: { px, py, who: session.user?.id || "" } }); }} />
        <div className="maprail" role="toolbar" aria-label="Map tools">
          {TOOLS.filter((t) => t.id === "move" || t.id === "measure" || t.id === "ping").map((t) => (
            <button key={t.id} className={`mrbtn ${tool === t.id ? "on" : ""}`} title={`${t.label}: ${t.id === "move" ? "Drag your token; drag the map to pan" : t.tip}`} aria-label={t.label} aria-pressed={tool === t.id} onClick={() => setTool(t.id)}>{t.icon}</button>
          ))}
        </div>
      </div>
      <p className="faint" style={{ margin: 0, fontSize: 13 }}>Drag your character’s token to move it. Every square is {map.grid.feet} feet, diagonals too.</p>
    </div>
  );
}
