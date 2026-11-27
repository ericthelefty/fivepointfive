/**
 * The AOE tool's panel on a map: pick a shape and its size, then place it on the map. An area is only on your screen
 * until you press Show; Hide takes it back. Lists your areas, and those others are showing.
 */
import { useState } from "react";
import { AREA_COLORS, SHAPES, areaName, areaSquares, areaTokens, shapeOf, type Area, type AreaCtx, type AreaKind, type AreasState } from "../lib/areas.ts";

export interface AreaSettings { kind: AreaKind; size: number; width?: number; height?: number; color: string; label: string }

export const defaultAreaSettings = (): AreaSettings => ({ kind: "sphere", ...shapeOf("sphere").defaults, color: AREA_COLORS[0], label: "" });

/** The settings for a new area, as the board wants them. */
export const newArea = (s: AreaSettings): Omit<Area, "id" | "x" | "y"> => ({ kind: s.kind, size: s.size, width: s.width, height: s.height, color: s.color, label: s.label.trim() || undefined });

function Num({ label, value, onValue, min = 1, max = 500 }: { label: string; value?: number; onValue: (n: number) => void; min?: number; max?: number }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className="mfield" style={{ flex: 1 }}><span>{label}</span>
      <input type="number" inputMode="numeric" min={min} max={max} value={draft ?? String(value ?? "")} onFocus={(e) => e.target.select()}
        onChange={(e) => { setDraft(e.target.value); const n = Number(e.target.value); if (e.target.value !== "" && n >= min && n <= max) onValue(n); }}
        onBlur={() => setDraft(null)} />
    </label>
  );
}

export function AreaPanel({ st, settings, setSettings, selected, setSelected, ctx, nameOf, hint }: {
  st: AreasState;
  settings: AreaSettings;
  setSettings: (s: AreaSettings) => void;
  selected: string | null;
  setSelected: (id: string | null) => void;
  ctx: AreaCtx;
  nameOf: (uid?: string) => string;
  hint?: string;
}) {
  const sel = st.all.find((a) => a.id === selected);
  const editing = sel && st.mine(sel) ? sel : null;
  // the size, colour and label boxes change the chosen area of yours, or the next one you place
  const cur: AreaSettings = editing ? { kind: editing.kind, size: editing.size, width: editing.width, height: editing.height, color: editing.color, label: editing.label || "" } : settings;
  const put = (patch: Partial<AreaSettings>) => {
    const next = { ...cur, ...patch };
    if (editing) st.change({ ...editing, size: next.size, width: next.width, height: next.height, color: next.color, label: next.label.trim() || undefined });
    else setSettings(next);
  };
  const shape = shapeOf(cur.kind);
  const mineList = st.all.filter((a) => st.mine(a));
  const others = st.all.filter((a) => !st.mine(a));
  const caught = sel ? areaTokens(sel, areaSquares(sel, ctx), ctx) : [];

  return (
    <div className="mfcard">
      <b>Area of effect</b>
      {!editing && (
        <div className="mshapes" role="group" aria-label="Shape">
          {SHAPES.map((s) => (
            <button key={s.kind} className={`mtbtn ${settings.kind === s.kind ? "on" : ""}`} aria-pressed={settings.kind === s.kind}
              onClick={() => { setSelected(null); setSettings({ ...settings, kind: s.kind, ...s.defaults }); }}>{s.name}</button>
          ))}
        </div>
      )}
      {editing && <div className="maprow"><b style={{ flex: 1 }}>{editing.label || areaName(editing)}</b><button className="mtbtn" onClick={() => setSelected(null)}>New area</button></div>}
      <div className="maprow">
        <Num label={`${shape.size} (ft)`} value={cur.size} onValue={(n) => put({ size: n })} />
        {(cur.kind === "line") && <Num label="Width (ft)" value={cur.width} onValue={(n) => put({ width: n })} />}
        {(cur.kind === "wall" || cur.kind === "ring") && <Num label="Thickness (ft)" value={cur.width} onValue={(n) => put({ width: n })} />}
        {(cur.kind === "cylinder" || cur.kind === "wall") && <Num label="Height (ft)" value={cur.height} onValue={(n) => put({ height: n })} />}
      </div>
      <label className="mfield"><span>Name (optional)</span>
        <input type="text" maxLength={40} value={cur.label} placeholder="Fireball, Breath Weapon…" onChange={(e) => put({ label: e.target.value })} />
      </label>
      <div className="mswatches" role="group" aria-label="Colour">
        {AREA_COLORS.map((c) => <button key={c} className={`mswatch ${cur.color === c ? "on" : ""}`} style={{ background: c }} aria-label={`Colour ${c}`} aria-pressed={cur.color === c} onClick={() => put({ color: c })} />)}
      </div>
      <p className="mfhint" style={{ margin: 0 }}>{hint || (editing ? "Drag it to move it, or its white handle to aim it." : `${shape.how} Hold Alt to place it off the grid.`)}</p>

      {sel && (
        <div className="mfsub">
          <div className="maprow">
            <b style={{ flex: 1 }}>{sel.label ? `${sel.label} · ` : ""}{areaName(sel)}</b>
            {st.mine(sel) && (st.isShown(sel.id)
              ? <button className="mtbtn on" onClick={() => st.hide(sel.id)} title="Take it back to only your screen">Hide</button>
              : <button className="mtbtn" onClick={() => st.show(sel.id)} title="Show it to everyone on the map">Show</button>)}
            {st.canRemove(sel) && <button className="mtbtn" aria-label="Remove" title="Remove" onClick={() => { st.remove(sel.id); setSelected(null); }}>×</button>}
          </div>
          <span className="mfhint">{st.isShown(sel.id) ? (st.mine(sel) ? "Everyone on the map can see it." : `Shown by ${nameOf(sel.owner)}.`) : "Only you can see it."}</span>
          <span>{caught.length ? <>Catches <b>{caught.length}</b>: {caught.map((t) => t.name).join(", ")}</> : "Catches no one"}</span>
          <span className="mfhint">A creature is caught if any square of its space is: a square counts when its middle is inside the area. Walls on the map aren’t known here, so leave out anyone behind Total Cover.</span>
        </div>
      )}

      {mineList.length > 0 && (
        <div className="mlist">
          <span className="mfhint">Your areas</span>
          {mineList.map((a) => (
            <div key={a.id} className={`mlistrow ${a.id === selected ? "on" : ""}`}>
              <button className="mlistname" onClick={() => setSelected(a.id)}><span className="mdot" style={{ background: a.color }} />{a.label || areaName(a)}</button>
              {st.isShown(a.id) ? <button className="mtbtn on" onClick={() => st.hide(a.id)}>Hide</button> : <button className="mtbtn" onClick={() => st.show(a.id)}>Show</button>}
            </div>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <div className="mlist">
          <span className="mfhint">Shown by others</span>
          {others.map((a) => (
            <div key={a.id} className={`mlistrow ${a.id === selected ? "on" : ""}`}>
              <button className="mlistname" onClick={() => setSelected(a.id)}><span className="mdot" style={{ background: a.color }} />{a.label || areaName(a)} · {nameOf(a.owner)}</button>
              {st.canRemove(a) && <button className="mtbtn" aria-label="Remove" onClick={() => st.remove(a.id)}>×</button>}
            </div>
          ))}
        </div>
      )}
      {st.error && <span className="mfhint" style={{ color: "#ffb4a8" }}>{st.error}</span>}
    </div>
  );
}
