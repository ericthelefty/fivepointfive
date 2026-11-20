import { useMemo, useState } from "react";
import { Md } from "../lib/md.tsx";
import type { Entry } from "../lib/parse.ts";
import type { ArmorRow } from "../lib/rules.ts";
import type { Weapon } from "../lib/play.ts";
import {
  ATTUNEMENT_LIMIT, COIN_KEYS, attunedCount, carryingCapacity, isActive, itemFrom, needsAttunement, newItemId, setAttuned,
  setEquipped, slotOf, totalWeight, type CatalogItem, type Coins, type Item, type MagicInfo,
} from "../lib/inventory.ts";

interface Props {
  items: Item[];
  coins: Coins;
  fromStart: boolean;
  editable: boolean;
  catalog: CatalogItem[];
  byId: (id?: string) => Entry | undefined;
  infoOf: (it: Item) => MagicInfo | undefined;
  weapons: Weapon[];
  armor: ArmorRow[];
  strength: number;
  size?: string;
  onChange: (items: Item[], coins: Coins) => void;
  onReset: () => void;
}

const fmtWt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));

export default function InventoryPanel(p: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string>();
  const [msg, setMsg] = useState("");
  const ro = !p.editable;

  const attuned = attunedCount(p.items);
  const weight = totalWeight(p.items, p.coins);
  const capacity = carryingCapacity(p.strength, p.size);
  const over = weight > capacity;

  const matches = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (n.length < 2) return [];
    return p.catalog.filter((c) => c.name.toLowerCase().includes(n)).slice(0, 8);
  }, [q, p.catalog]);

  const set = (items: Item[], coins = p.coins) => {
    setMsg("");
    p.onChange(items, coins);
  };
  const patch = (id: string, ch: Partial<Item>) => set(p.items.map((i) => (i.id === id ? { ...i, ...ch } : i)));
  const add = (c: CatalogItem) => {
    const it = itemFrom(c);
    // new things go in the pack; the player equips them
    it.equipped = undefined;
    set([...p.items, it]);
    setQ("");
    setOpen(it.id);
  };
  const addCustom = () => {
    const name = q.trim();
    if (!name) return;
    const it: Item = { id: newItemId(), name, kind: "custom", qty: 1 };
    set([...p.items, it]);
    setQ("");
    setOpen(it.id);
  };

  const sorted = [...p.items].sort((a, b) => Number(!!b.equipped) - Number(!!a.equipped));

  return (
    <div className="spanel inv">
      <div className="invhead">
        <div className={`invstat ${attuned >= ATTUNEMENT_LIMIT ? "full" : ""}`} title="Magic items you're attuned to">
          <span className="sl">Attuned</span> <b>{attuned}/{ATTUNEMENT_LIMIT}</b>
        </div>
        <div className={`invstat ${over ? "over" : ""}`} title={`Carrying capacity: Strength ${p.strength} × ${capacity / p.strength} lb. Fifty coins weigh a pound.`}>
          <span className="sl">Carrying</span> <b>{fmtWt(weight)}</b> / {fmtWt(capacity)} lb.
          {over && <span className="warn"> Over capacity</span>}
        </div>
        <div className="coins" role="group" aria-label="Coins">
          {COIN_KEYS.map((k) => (
            <label key={k} className="coin">
              <span>{k.toUpperCase()}</span>
              <input type="number" min={0} inputMode="numeric" value={p.coins[k] || 0} disabled={ro}
                onChange={(e) => set(p.items, { ...p.coins, [k]: Math.max(0, Math.floor(+e.target.value || 0)) })} />
            </label>
          ))}
        </div>
      </div>

      {msg && <div className="note warnline" role="status">{msg}</div>}

      <div className="invwrap">
      <table className="atks invt">
        <thead>
          <tr><th>Item</th><th>Qty</th><th>Wt (lb.)</th><th title="Worn or in hand">Equip</th><th>Attune</th><th></th></tr>
        </thead>
        <tbody>
          {sorted.map((it) => {
            const info = p.infoOf(it);
            const slot = slotOf(it, info);
            const attunes = needsAttunement(it, info);
            const active = isActive(it, info) && (!!slot || attunes);
            const entry = p.byId(it.ref);
            const needsBase = !!info?.base && !it.base;
            return (
              <tr key={it.id} className={open === it.id ? "open" : ""}>
                <td>
                  <button className="iname" onClick={() => setOpen(open === it.id ? undefined : it.id)} aria-expanded={open === it.id}>
                    <b>{it.name}</b>
                  </button>
                  {active && <span className="tagx on" title="Worn or wielded, and attuned if it needs it">Active</span>}
                  {needsBase && <span className="tagx warn">Choose base item</span>}
                  <div className="note">
                    {[it.note, it.base && it.base !== it.name ? it.base : "", info?.category, attunes ? `Requires attunement${info?.attunementNote ? ` ${info.attunementNote}` : ""}` : ""].filter(Boolean).join(" · ")}
                  </div>
                  {open === it.id && (
                    <div className="idet">
                      <div className="irow">
                        <label className="field">Name<input type="text" value={it.name} disabled={ro} onChange={(e) => patch(it.id, { name: e.target.value })} /></label>
                        <label className="field">Note<input type="text" value={it.note || ""} disabled={ro} placeholder="e.g. crystal, engraved" onChange={(e) => patch(it.id, { note: e.target.value || undefined })} /></label>
                        {info?.base && (
                          <label className="field">
                            Base {info.base.kind === "weapon" ? "weapon" : info.base.kind === "shield" ? "shield" : "armor"}
                            <select value={it.base || ""} disabled={ro} onChange={(e) => patch(it.id, { base: e.target.value || undefined })}>
                              <option value="">Choose…</option>
                              {info.base.options.map((o) => <option key={o}>{o}</option>)}
                            </select>
                          </label>
                        )}
                      </div>
                      <ItemText it={it} entry={entry} weapons={p.weapons} armor={p.armor} />
                    </div>
                  )}
                </td>
                <td>
                  <div className="qty">
                    <button className="sbtn sm ghost" disabled={ro || it.qty <= 0} onClick={() => patch(it.id, { qty: Math.max(0, it.qty - 1) })} aria-label={`One fewer ${it.name}`}>−</button>
                    <span>{it.qty}</span>
                    <button className="sbtn sm ghost" disabled={ro} onClick={() => patch(it.id, { qty: it.qty + 1 })} aria-label={`One more ${it.name}`}>+</button>
                  </div>
                </td>
                <td>
                  <input className="wt" type="number" min={0} step="any" value={it.weight ?? ""} placeholder="—" disabled={ro} aria-label={`Weight of one ${it.name}`}
                    onChange={(e) => patch(it.id, { weight: e.target.value === "" ? undefined : Math.max(0, +e.target.value) })} />
                </td>
                <td>
                  {slot && (
                    <input type="checkbox" checked={!!it.equipped} disabled={ro} aria-label={`Equip ${it.name}`}
                      onChange={(e) => set(setEquipped(p.items, it.id, e.target.checked, p.infoOf))} />
                  )}
                </td>
                <td>
                  {attunes && (
                    <input type="checkbox" checked={!!it.attuned} disabled={ro} aria-label={`Attune to ${it.name}`}
                      onChange={(e) => {
                        const r = setAttuned(p.items, it.id, e.target.checked);
                        if (r.refused) setMsg(r.refused);
                        else set(r.items);
                      }} />
                  )}
                </td>
                <td>
                  {!ro && <button className="sbtn sm ghost" title="Remove" aria-label={`Remove ${it.name}`} onClick={() => set(p.items.filter((i) => i.id !== it.id))}>✕</button>}
                </td>
              </tr>
            );
          })}
          {p.items.length === 0 && (
            <tr><td colSpan={6} className="note">Nothing carried. Add items below.</td></tr>
          )}
        </tbody>
      </table>
      </div>

      {!ro && (
        <div className="iadd">
          <label className="field" style={{ flex: 1 }}>
            Add an item
            <input type="search" value={q} placeholder="Search weapons, armor, gear, tools, magic items…" onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (matches[0]) add(matches[0]); else addCustom(); } }} />
          </label>
          {q.trim().length >= 2 && (
            <div className="imatches">
              {matches.map((c) => (
                <button key={`${c.kind}:${c.ref || c.name}`} className="sbtn sm ghost" onClick={() => add(c)}>
                  {c.name} <span className="note">{c.kind === "magic" ? "magic item" : c.kind}{c.weight ? ` · ${fmtWt(c.weight)} lb.` : ""}</span>
                </button>
              ))}
              <button className="sbtn sm" onClick={addCustom}>Add “{q.trim()}” as a custom item</button>
            </div>
          )}
        </div>
      )}

      <p className="note" style={{ marginTop: 12 }}>
        {p.fromStart
          ? "This is your starting equipment. Changes you make here are saved with the character."
          : "Equip armor, a shield and weapons to use them; attune to magic items that require it (up to 3)."}
        {!p.fromStart && !ro && (
          <> <button className="linkish" onClick={() => { if (confirm("Replace the inventory and coins with the starting equipment chosen in the builder?")) p.onReset(); }}>Reset to starting equipment</button></>
        )}
      </p>
    </div>
  );
}

function ItemText({ it, entry, weapons, armor }: { it: Item; entry?: Entry; weapons: Weapon[]; armor: ArmorRow[] }) {
  const w = it.base ? weapons.find((x) => x.name === it.base) : undefined;
  const a = it.base ? armor.find((x) => x.name === it.base) : undefined;
  return (
    <div className="itext">
      {w && <div className="note"><b>{w.name}:</b> {w.damage} · {w.properties || "—"}{w.mastery ? ` · Mastery: ${w.mastery}` : ""}</div>}
      {a && <div className="note"><b>{a.name}:</b> AC {a.ac}{a.strength && a.strength !== "—" ? ` · Strength ${a.strength}` : ""}{a.stealth && a.stealth !== "—" ? ` · Stealth ${a.stealth}` : ""}</div>}
      {entry ? <Md md={entry.body} /> : !w && !a ? <p className="note">{it.kind === "custom" ? "Custom item." : "No description."}</p> : null}
    </div>
  );
}
