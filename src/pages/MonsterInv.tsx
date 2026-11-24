/**
 * The GM's editor for what one kind of monster carries in an encounter: its gear (starting from the stat block's
 * Gear entry), coins, and hidden tiers that a search of the body can turn up.
 */
import { useState } from "react";
import { COIN_KEYS, type CatalogItem } from "../lib/inventory.ts";
import { coinsText, customKey, hasCoins, isCustomName, parseCoins, parseGear, type CustomDetails, type MonsterInv } from "../lib/loot.ts";

/** Value (in GP) and weight boxes for a custom item. */
export function CustomFields({ name, d, onChange }: { name: string; d?: CustomDetails; onChange: (d: CustomDetails) => void }) {
  return (
    <span className="custf">
      <label>Value <input type="number" min={0} step="any" inputMode="decimal" value={d?.valueCp !== undefined ? d.valueCp / 100 : ""} placeholder="—" aria-label={`Value of ${name} in GP`}
        onChange={(e) => onChange({ ...d, valueCp: e.target.value === "" ? undefined : Math.max(0, Math.round(+e.target.value * 100)) })} /> GP</label>
      <label>Weight <input type="number" min={0} step="any" inputMode="decimal" value={d?.weight ?? ""} placeholder="—" aria-label={`Weight of ${name} in pounds`}
        onChange={(e) => onChange({ ...d, weight: e.target.value === "" ? undefined : Math.max(0, +e.target.value) })} /> lb.</label>
    </span>
  );
}

/** The footnote for the asterisk on custom items. */
export function CustomNote({ gm }: { gm?: boolean }) {
  return <p className="note custnote"><b>*</b> Custom item: not in the SRD, so it has no rules of its own.{gm ? " Set its value and weight where it’s listed." : ""}</p>;
}

/** One line for the row in the encounter list: "3 items · 7 GP 4 SP · 2 hidden tiers". */
export function invSummary(inv: MonsterInv | undefined, statGear: string[]): string {
  const gear = inv?.gear ?? statGear;
  const tiers = inv?.hidden?.length || 0;
  return [
    gear.length ? `${gear.length} item${gear.length > 1 ? "s" : ""}` : "no gear",
    hasCoins(inv?.coins) ? coinsText(inv?.coins) : "",
    tiers ? `${tiers} hidden tier${tiers > 1 ? "s" : ""}` : "",
  ].filter(Boolean).join(" · ");
}

function AddBox({ placeholder, catalog, onAdd, coins }: { placeholder: string; catalog: CatalogItem[]; onAdd: (s: string) => void; coins?: boolean }) {
  const [q, setQ] = useState("");
  const t = q.trim();
  const matches = t.length >= 2 && !(coins && parseCoins(t)) ? catalog.filter((c) => c.name.toLowerCase().includes(t.toLowerCase())).slice(0, 6) : [];
  const add = (s: string) => { if (s.trim()) { onAdd(s.trim()); setQ(""); } };
  return (
    <div className="invadd">
      <input value={q} placeholder={placeholder} aria-label={placeholder} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(matches[0]?.name && !(coins && parseCoins(t)) && matches[0].name.toLowerCase() === t.toLowerCase() ? matches[0].name : t); }} />
      <button className="sbtn sm ghost" disabled={!t} onClick={() => add(t)}>Add</button>
      {matches.length > 0 && <div className="invmatch">{matches.map((m) => <button key={m.name} className="sbtn sm ghost" onClick={() => add(m.name)}>{m.name}</button>)}</div>}
    </div>
  );
}

export function MonsterInvEditor({ name, statGear, inv, onChange, catalog, count, custom, onCustom }: {
  name: string; statGear: string[]; inv: MonsterInv | undefined; onChange: (inv: MonsterInv) => void; catalog: CatalogItem[]; count: number;
  custom?: Record<string, CustomDetails>; onCustom: (name: string, d: CustomDetails) => void;
}) {
  const star = (n: string) => (isCustomName(n, catalog) ? "*" : "");
  const cur = inv || {};
  const gear = cur.gear ?? statGear;
  const set = (patch: Partial<MonsterInv>) => onChange({ ...cur, ...patch });
  const tiers = cur.hidden || [];
  const customNames = [...new Map([...gear, ...tiers.flatMap((t) => t.finds)].filter((n) => isCustomName(n, catalog)).map((n) => parseGear(n).name).map((n) => [customKey(n), n])).values()];
  const setTier = (i: number, t: { dc: number; finds: string[] }) => set({ hidden: tiers.map((x, j) => (j === i ? t : x)) });
  return (
    <div className="inved">
      <div className="invsec">
        <div className="sl">Carried{count > 1 ? ` · each ${name} carries the same` : ""}</div>
        <div className="pills">
          {gear.map((g, i) => (
            <span key={`${g}-${i}`} className="pill">{g}{star(g)}<button aria-label={`Remove ${g}`} onClick={() => set({ gear: gear.filter((_, j) => j !== i) })}>✕</button></span>
          ))}
          {!gear.length && <span className="note">Nothing.</span>}
        </div>
        <AddBox placeholder="Add an item" catalog={catalog} onAdd={(s) => set({ gear: [...gear, s] })} />
        {cur.gear && <button className="linkish note" onClick={() => set({ gear: undefined })}>Reset to the stat block’s Gear</button>}
        <div className="coins">
          {COIN_KEYS.map((k) => (
            <label key={k}><input type="number" min={0} inputMode="numeric" value={cur.coins?.[k] || ""} placeholder="0" aria-label={`${k.toUpperCase()} carried`}
              onChange={(e) => set({ coins: { ...(cur.coins || {}), [k]: Math.max(0, parseInt(e.target.value, 10) || 0) } })} /><span>{k.toUpperCase()}</span></label>
          ))}
          {hasCoins(cur.coins) && <span className="note">{count > 1 ? `each · ${count} carry ${coinsText(Object.fromEntries(COIN_KEYS.map((k) => [k, (cur.coins?.[k] || 0) * count])))} in all` : ""}</span>}
        </div>
        <p className="note" style={{ margin: 0 }}>Carried coins go into the party’s shared pot when this monster falls, split evenly when the loot closes.</p>
      </div>
      <div className="invsec hid">
        <div className="invhidh">
          <span className="sl hidl">Hidden · found by searching the body</span>
          <label className="note">Check{" "}
            <select value={cur.check || "investigation"} onChange={(e) => set({ check: e.target.value as MonsterInv["check"] })}>
              <option value="investigation">Intelligence (Investigation)</option>
              <option value="perception">Wisdom (Perception)</option>
            </select>
          </label>
        </div>
        {tiers.map((t, i) => (
          <div key={i} className="tier">
            <div className="tierh">
              <label className="dcb">DC <input type="number" min={1} max={40} value={t.dc} aria-label="DC" onChange={(e) => setTier(i, { ...t, dc: Math.max(1, parseInt(e.target.value, 10) || 1) })} /></label>
              <span className="note">A roll of {t.dc} or higher {i > 0 ? "also " : ""}finds</span>
              <button className="sbtn sm ghost" style={{ marginLeft: "auto" }} onClick={() => set({ hidden: tiers.filter((_, j) => j !== i) })}>Remove tier</button>
            </div>
            <div className="pills">
              {t.finds.map((f, j) => <span key={`${f}-${j}`} className="pill">{f}{star(f)}<button aria-label={`Remove ${f}`} onClick={() => setTier(i, { ...t, finds: t.finds.filter((_, x) => x !== j) })}>✕</button></span>)}
            </div>
            <AddBox coins placeholder="Item or coins (10 GP)" catalog={catalog} onAdd={(s) => setTier(i, { ...t, finds: [...t.finds, s] })} />
          </div>
        ))}
        <button className="sbtn sm ghost" style={{ alignSelf: "flex-start" }} onClick={() => set({ hidden: [...tiers, { dc: tiers.length ? Math.min(40, tiers[tiers.length - 1].dc + 5) : 15, finds: [] }] })}>+ Add a tier</button>
        <p className="note" style={{ margin: 0 }}>Tiers stack: a high roll finds every tier it meets. Players never see the DCs, and each find can be found only once.{count > 1 ? ` Every ${name} hides the same things.` : ""}</p>
      </div>
      {customNames.length > 0 && (
        <div className="invsec">
          <div className="sl">Custom items</div>
          {customNames.map((n) => (
            <div key={n} className="custrow"><b>{n}*</b><CustomFields name={n} d={custom?.[customKey(n)]} onChange={(d) => onCustom(n, d)} /></div>
          ))}
          <CustomNote />
        </div>
      )}
    </div>
  );
}
