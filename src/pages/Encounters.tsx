/**
 * Encounters: the GM builds a fight (monsters from the Library, characters from the instance) and runs it:
 * initiative order, whose turn it is, HP for everyone in one place, and clickable stat blocks.
 * Only the admin (the GM) sees encounters on an instance; in local mode they're yours.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import "../sheet.css";
import { useContent } from "../lib/store.tsx";
import { useCharacters } from "../lib/characters.tsx";
import { useEncounters } from "../lib/encounters.tsx";
import { cloud } from "../lib/backend.ts";
import { parseCreature, crValue, type CreatureStats } from "../lib/creature.ts";
import { d20, describeRolled, roll, type Mode } from "../lib/dice.ts";
import { esc, playOf, timeNow, type LogEntry } from "../lib/play.ts";
import { applyDraft, coinsText, cpText, hasCoins, hiddenFindOf, linesOf, lootFromMonsters, lootGroupOf, sumCoins, type MonsterInv } from "../lib/loot.ts";
import { invSummary, MonsterInvEditor } from "./MonsterInv.tsx";
import { sendLoot, useLoot } from "../lib/lootStore.tsx";
import { classInfos, classLabel } from "../lib/multiclass.ts";
import {
  combatTables, difficulty, monsterMax, newEncounter, newUid, nextTurn, npcHp, numberedName, pcCombat, pcHp, prevTurn, turnOrder, xpBudgetTable,
  type Combatant, type Encounter, type PcCombat,
} from "../lib/encounter.ts";
import { StatBlock, type Roller } from "../components/StatBlock.tsx";

const fmt = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`);

function NotAllowed() {
  return (
    <div className="panel">
      <h2 style={{ marginTop: 0 }}>Encounters</h2>
      <p>Encounters are the GM’s tools: only the instance’s admin can build and run them.</p>
      <Link to="/">Back to characters</Link>
    </div>
  );
}

/** Monsters from every loaded pack, parsed once per content set. */
function useCreatures() {
  const content = useContent();
  useEffect(() => { content.ensure("creatures", "rules", "items"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return useMemo(() => {
    const map = new Map<string, CreatureStats>();
    for (const e of content.byType("Creature")) {
      try { map.set(e.id, parseCreature(e)); } catch { /* a stat block the parser can't read */ }
    }
    return map;
  }, [content.entries]); // eslint-disable-line react-hooks/exhaustive-deps
}

function summary(e: Encounter, name: (c: Combatant) => string): string {
  const counts = new Map<string, number>();
  for (const c of e.combatants.filter((x) => x.kind !== "pc")) {
    const k = c.kind === "monster" ? name(c) : c.name;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const pcs = e.combatants.filter((x) => x.kind === "pc").length;
  const mons = [...counts].map(([k, n]) => (n > 1 ? `${n} ${k}` : k)).join(", ");
  return [mons || "No monsters yet", pcs ? `${pcs} character${pcs > 1 ? "s" : ""}` : ""].filter(Boolean).join(" · ");
}

// ===================================================================== the list
export function EncounterList() {
  const enc = useEncounters();
  const nav = useNavigate();
  const creatures = useCreatures();
  if (!enc.allowed) return <NotAllowed />;
  const make = async () => {
    const e = newEncounter(newUid() + newUid());
    await enc.create(e);
    nav(`/encounters/${e.id}`);
  };
  const copy = async (src: Encounter) => {
    const e: Encounter = { ...src, id: newUid() + newUid(), name: `${src.name} (copy)`, round: 0, turn: undefined, log: [], combatants: src.combatants.map((c) => ({ ...c, uid: newUid(), init: undefined, out: false, hp: c.kind === "pc" ? undefined : c.maxHp ?? c.hp })), updated: Date.now() };
    await enc.create(e);
  };
  const monsterName = (c: Combatant) => (c.ref && creatures.get(c.ref)?.name) || c.name.replace(/\s\d+$/, "");
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1>Encounters</h1>
        <button className="btn primary" onClick={make}>New encounter</button>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Build a fight from the Library’s monsters and your characters, then run it: initiative, turns, HP and stat blocks in one place.
        {cloud ? " Only you (the admin) can see encounters." : ""}
      </p>
      {enc.error && <div className="panel warnline">{enc.error}</div>}
      {!enc.ready ? <p className="muted">Loading…</p> : enc.list.length === 0 ? (
        <div className="panel">No encounters yet. Choose <b>New encounter</b> to build one.</div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {[...enc.list].sort((a, b) => b.updated - a.updated).map((e) => (
            <div key={e.id} className="panel" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center", margin: 0 }}>
              <div>
                <Link to={`/encounters/${e.id}`}><b style={{ fontSize: 17 }}>{e.name || "Untitled encounter"}</b></Link>
                <div className="faint">{summary(e, monsterName)}{e.round > 0 ? ` · running, round ${e.round}` : ""}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <Link className="btn small" to={`/encounters/${e.id}?tab=run`}>Run</Link>
                <button className="btn small" onClick={() => copy(e)}>Copy</button>
                <button className="btn small" onClick={() => { if (confirm(`Delete “${e.name}”?`)) enc.remove(e.id); }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================================================================== one encounter
export function EncounterView() {
  const { id } = useParams();
  const enc = useEncounters();
  const content = useContent();
  const chars = useCharacters();
  const creatures = useCreatures();
  const [tab, setTabState] = useState<"build" | "run" | "loot">(() => { const t = new URLSearchParams(location.search).get("tab"); return t === "run" || t === "loot" ? t : "build"; });
  // keep the open tab in the address, so a reload (or a link) comes back to it
  const setTab = (t: "build" | "run" | "loot") => {
    setTabState(t);
    history.replaceState(history.state, "", `${location.pathname}${t !== "build" ? `?tab=${t}` : ""}`);
  };
  const [lootQ, setLootQ] = useState("");
  const [invOpen, setInvOpen] = useState<string>();
  const [sending, setSending] = useState(false);
  const [q, setQ] = useState("");
  const [crMax, setCrMax] = useState("");
  const [preview, setPreview] = useState<string>();
  const [sel, setSel] = useState<string>();
  const [mode, setMode] = useState<Mode>("normal");
  const [other, setOther] = useState({ name: "", init: "", ac: "", hp: "" });
  // lines for the characters' own game logs, saved together after each click (see `log`)
  const pcLines = useRef<Record<string, LogEntry[]>>({});
  const pcTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const charsRef = useRef(chars);
  charsRef.current = chars;

  const tables = useMemo(() => combatTables(content.entries), [content.entries]);
  const budget = useMemo(() => xpBudgetTable(content.entries), [content.entries]);
  const conditionNames = useMemo(() => content.byType("Rule").filter((e) => e.tags.includes("Condition")).map((e) => e.name).sort(), [content]);

  // characters' changes arrive live; as a fallback (Realtime off, a dropped connection), look again now and then
  useEffect(() => {
    if (!cloud || tab !== "run") return;
    const t = setInterval(() => { if (!chars.saving) chars.reload(); }, 60000);
    return () => clearInterval(t);
  }, [tab, chars.saving]); // eslint-disable-line react-hooks/exhaustive-deps

  const e = enc.get(id);
  const sent = useLoot(e?.lootId);
  if (!enc.allowed) return <NotAllowed />;
  if (!enc.ready) return <p className="muted">Loading…</p>;
  if (!e) return <div className="panel">Encounter not found. <Link to="/encounters">Back to encounters</Link></div>;

  // every change goes through the store's latest copy, so several changes in one click all land
  const put = (patch: Partial<Encounter> | ((x: Encounter) => Partial<Encounter>)) => enc.update(e.id, typeof patch === "function" ? patch : () => patch);
  const setCb = (uid: string, patch: Partial<Combatant>) => put((x) => ({ combatants: x.combatants.map((c) => (c.uid === uid ? { ...c, ...patch } : c)) }));

  // --------------------------------------------------------------- who's who
  const pcCache = new Map<string, PcCombat | undefined>();
  const pcOf = (cb: Combatant) => {
    if (cb.kind !== "pc" || !cb.ref) return undefined;
    if (!pcCache.has(cb.ref)) {
      const row = chars.get(cb.ref);
      let v: PcCombat | undefined;
      try { v = row ? pcCombat(row.c, content, tables) : undefined; } catch { v = undefined; }
      pcCache.set(cb.ref, v);
    }
    return pcCache.get(cb.ref);
  };
  const stOf = (cb: Combatant) => (cb.kind === "monster" && cb.ref ? creatures.get(cb.ref) : undefined);
  const nameOf = (cb: Combatant) => (cb.kind === "pc" ? chars.get(cb.ref)?.c.name || cb.name || "Unnamed" : cb.name);
  const bonusOf = (cb: Combatant) => (cb.kind === "pc" ? pcOf(cb)?.init ?? 0 : cb.kind === "monster" ? stOf(cb)?.initiative ?? 0 : cb.initBonus ?? 0);
  const acOf = (cb: Combatant) => (cb.kind === "pc" ? pcOf(cb)?.ac : cb.kind === "monster" ? stOf(cb)?.ac : cb.ac);
  const hpOf = (cb: Combatant): { cur: number; max: number; temp: number } | undefined => {
    if (cb.kind === "pc") { const p = pcOf(cb); return p ? { cur: p.hpCur, max: p.hpMax, temp: p.temp } : undefined; }
    if (cb.kind === "monster") { const max = monsterMax(cb, stOf(cb)); return { cur: Math.min(max, cb.hp ?? max), max, temp: cb.temp || 0 }; }
    return cb.maxHp ? { cur: Math.min(cb.maxHp, cb.hp ?? cb.maxHp), max: cb.maxHp, temp: cb.temp || 0 } : undefined;
  };
  const order = turnOrder(e.combatants, bonusOf);

  // --------------------------------------------------------------- the roll log
  /**
   * A line in the encounter's log, also added to the game log of every character in the fight, so players see what
   * happens around them. `except` skips characters whose sheet this same action already wrote to (damage, conditions).
   * Lines for each character are queued and saved together once the click is done, so two lines from one click
   * (initiative, then "The fight begins") don't overwrite each other.
   */
  const log = (entry: Omit<LogEntry, "id" | "t">, except: (string | undefined)[] = []) => {
    const line: LogEntry = { ...entry, id: newUid(), t: timeNow() };
    put((x) => ({ log: [line, ...x.log].slice(0, 100) }));
    for (const ref of new Set(e.combatants.filter((cb) => cb.kind === "pc" && cb.ref && !except.includes(cb.ref)).map((cb) => cb.ref!))) {
      const mine: LogEntry = { ...line, id: newUid(), detail: `${line.detail}<div class="enctag">In ${esc(e.name || "the encounter")}</div>` };
      (pcLines.current[ref] ||= []).unshift(mine);
    }
    if (!pcTimer.current) pcTimer.current = setTimeout(() => {
      pcTimer.current = undefined;
      const q = pcLines.current;
      pcLines.current = {};
      for (const [ref, lines] of Object.entries(q)) {
        const row = charsRef.current.get(ref);
        if (!row) continue;
        const p = playOf(row.c);
        charsRef.current.save({ ...row.c, play: { ...p, log: [...lines, ...p.log].slice(0, 150) } });
      }
    }, 0);
  };
  const roller: Roller = {
    test: (title, bonus) => {
      const r = d20(bonus, mode);
      const dice = r.rolls.length > 1 ? `d20 [${r.rolls.map((x) => (x === r.kept ? `<b>${x}</b>` : x)).join(", ")}]` : `d20 [${r.kept}]`;
      log({ title, total: String(r.total), cls: "test", detail: `${dice} ${fmt(bonus)}${mode !== "normal" ? `<div>${mode === "adv" ? "Advantage" : "Disadvantage"}</div>` : ""}` });
    },
    attack: (title, toHit, damage) => {
      const r = d20(toHit, mode);
      const crit = r.kept === 20;
      let detail = `d20 [${r.rolls.map((x) => (r.rolls.length > 1 && x === r.kept ? `<b>${x}</b>` : x)).join(", ")}] ${fmt(toHit)}${mode !== "normal" ? `<div>${mode === "adv" ? "Advantage" : "Disadvantage"}</div>` : ""}`;
      if (crit) detail += `<div class="vd crit">Critical hit</div>`;
      if (r.fumble) detail += `<div class="vd bad">Natural 1: a miss</div>`;
      // roll the damage with it (doubled dice on a critical hit), so the GM sees both at once
      const dmg = damage.length && !r.fumble ? roll(damage.map((x) => x.expr).join("+"), { doubleDice: crit }) : null;
      if (dmg) detail += `<div>Damage if it hits: <b>${Math.max(0, dmg.total)}</b> ${esc(damage.map((x) => x.type).join(" + "))} · ${esc(describeRolled(dmg))}</div>`;
      log({ title: `${title}: attack`, total: String(r.total), cls: crit ? "crit" : r.fumble ? "fumble" : "atk", detail });
    },
    damage: (title, expr, type) => {
      const r = roll(expr);
      if (r) log({ title: `${title}: damage`, total: String(Math.max(0, r.total)), cls: "dmg", detail: `${esc(describeRolled(r))}${type ? ` · ${esc(type)}` : ""}` });
    },
  };

  // --------------------------------------------------------------- building
  const addMonster = (st: CreatureStats) => {
    put((x) => {
      const n = numberedName(st.name, x.combatants);
      const list = n.renameFirst ? x.combatants.map((c) => (c.uid === n.renameFirst ? { ...c, name: `${st.name} 1` } : c)) : x.combatants;
      return { combatants: [...list, { uid: newUid(), kind: "monster", ref: st.id, name: n.name, hp: st.hp, maxHp: st.hp }] };
    });
  };
  const removeOne = (ref: string) => put((x) => {
    const same = x.combatants.filter((c) => c.kind === "monster" && c.ref === ref);
    const last = same[same.length - 1];
    return { combatants: x.combatants.filter((c) => c !== last) };
  });
  const togglePc = (cid: string) => put((x) => (x.combatants.some((c) => c.kind === "pc" && c.ref === cid)
    ? { combatants: x.combatants.filter((c) => !(c.kind === "pc" && c.ref === cid)) }
    : { combatants: [...x.combatants, { uid: newUid(), kind: "pc", ref: cid, name: chars.get(cid)?.c.name || "" }] }));
  const addOther = () => {
    if (!other.name.trim()) return;
    const hp = parseInt(other.hp, 10);
    put((x) => ({ combatants: [...x.combatants, { uid: newUid(), kind: "other", name: other.name.trim(), initBonus: parseInt(other.init, 10) || 0, ac: parseInt(other.ac, 10) || undefined, maxHp: hp > 0 ? hp : undefined, hp: hp > 0 ? hp : undefined }] }));
    setOther({ name: "", init: "", ac: "", hp: "" });
  };
  const rollHp = (cb: Combatant) => {
    const st = stOf(cb);
    const expr = st?.hpText.match(/\(([^)]+)\)/)?.[1];
    const r = expr ? roll(expr.replace(/\s+/g, "")) : null;
    if (r) setCb(cb.uid, { maxHp: Math.max(1, r.total), hp: Math.max(1, r.total) });
  };

  const pcs = e.combatants.filter((c) => c.kind === "pc");
  const levels = pcs.map((c) => chars.get(c.ref)?.c.level || 1);
  const xps = e.combatants.filter((c) => c.kind === "monster").map((c) => stOf(c)?.xp ?? 0);
  const diff = difficulty(xps, levels, budget);

  // --------------------------------------------------------------- running
  /** Roll initiative (dice rolled here, outside the update, so each roll happens once). */
  const rollInit = (which: "monsters" | "all" | "missing" | string): Map<string, number> => {
    const got = new Map<string, number>();
    const lines: string[] = [];
    for (const c of e.combatants) {
      if (which === "monsters" && c.kind === "pc") continue;
      if (which === "missing" && c.init !== undefined) continue;
      if (!["monsters", "all", "missing"].includes(which) && c.uid !== which) continue;
      const b = bonusOf(c);
      const r = d20(b, "normal");
      got.set(c.uid, r.total);
      lines.push(`${esc(nameOf(c))}: <b>${r.total}</b> (d20 [${r.kept}] ${fmt(b)})`);
    }
    if (got.size) {
      put((x) => ({ combatants: x.combatants.map((c) => (got.has(c.uid) ? { ...c, init: got.get(c.uid) } : c)) }));
      log({ title: "Initiative", total: "", cls: "event", detail: lines.map((l) => `<div>${l}</div>`).join("") });
    }
    return got;
  };
  /**
   * Roll initiative for everyone, monsters and characters. Asks first when it would replace initiative already
   * rolled; mid-fight the round number stays and the turn goes to whoever is first in the new order.
   */
  const reroll = () => {
    const had = e.combatants.some((c) => c.init !== undefined);
    if (had && !confirm(e.round > 0
      ? "Re-roll initiative for everyone, monsters and characters? Everyone’s current initiative is replaced. The round number stays; the turn goes to whoever is first in the new order."
      : "Re-roll initiative for everyone, monsters and characters? Everyone’s current initiative is replaced.")) return;
    const got = rollInit("all");
    if (e.round === 0) return;
    put((x) => {
      const list = x.combatants.map((c) => (got.has(c.uid) ? { ...c, init: got.get(c.uid) } : c));
      const first = turnOrder(list, bonusOf).find((c) => !c.out && !c.surrendered);
      return { combatants: list, turn: first?.uid ?? x.turn };
    });
  };
  const start = () => {
    rollInit("missing");
    put((x) => nextTurn(turnOrder(x.combatants, bonusOf), undefined, 0));
    log({ title: "The fight begins", total: "", cls: "event", detail: "Round 1." });
  };
  const next = () => {
    const n = nextTurn(order, e.turn, e.round);
    put(n);
    if (n.round > e.round) log({ title: `Round ${n.round}`, total: "", cls: "event", detail: "" });
  };
  const prev = () => put((x) => prevTurn(turnOrder(x.combatants, bonusOf), x.turn, x.round));
  /** Start the fight over: round, turn and initiative cleared, monsters back to full HP with no conditions. */
  const restart = () => {
    if (!confirm("Restart the encounter? The round counter, turn and everyone’s initiative are cleared, and monsters and others go back to full Hit Points with no conditions. Characters’ HP and conditions stay as they are on their sheets. The log is kept.")) return;
    put((x) => ({
      round: 0, turn: undefined, lootDraft: undefined, lootId: undefined,
      combatants: x.combatants.map((c) => (c.kind === "pc" ? { ...c, init: undefined } : { ...c, init: undefined, out: false, surrendered: false, temp: undefined, conditions: [], hp: c.maxHp ?? c.hp })),
    }));
    log({ title: "The encounter restarts", total: "", cls: "event", detail: "Monsters are back to full Hit Points." });
  };
  const endFight = () => {
    if (!confirm("End the fight? Initiative and the round counter are cleared; HP stays as it is.")) return;
    put((x) => ({ round: 0, turn: undefined, combatants: x.combatants.map((c) => ({ ...c, init: undefined })) }));
    log({ title: "The fight ends", total: "", cls: "event", detail: "" });
    if ((lootGroups.some((g) => !g.removed) || fallen.length > 0) && !e.lootId) setTab("loot");
  };

  const applyHp = (cb: Combatant, kind: "damage" | "heal") => {
    const el = document.getElementById(`amt-${cb.uid}`) as HTMLInputElement | null;
    const n = Math.max(0, Math.floor(+(el?.value || 0)));
    if (!n) return;
    if (el) el.value = "";
    const h = hpOf(cb);
    if (cb.kind === "pc") {
      const row = chars.get(cb.ref);
      const p = pcOf(cb);
      if (!row || !p) return;
      chars.save(pcHp(row.c, n, kind, p.hpMax, "from the GM"));
    } else if (h) {
      setCb(cb.uid, npcHp(cb, n, kind, h.max));
    }
    const after = cb.kind === "pc" ? undefined : h && npcHp(cb, n, kind, h.max).hp;
    log({
      title: `${nameOf(cb)} ${kind === "damage" ? "took damage" : "healed"}`, total: kind === "damage" ? `−${n}` : `+${n}`, cls: kind === "damage" ? "dmg" : "heal",
      detail: h ? `HP ${h.cur} → ${after ?? (kind === "damage" ? Math.max(0, h.cur - Math.max(0, n - h.temp)) : Math.min(h.max, h.cur + n))} / ${h.max}${cb.kind === "pc" ? " · on their sheet" : ""}` : "",
    }, [cb.kind === "pc" ? cb.ref : undefined]);
  };

  const condsOf = (cb: Combatant) => (cb.kind === "pc" ? pcOf(cb)?.conditions || [] : cb.conditions || []);
  const toggleCond = (cb: Combatant, k: string) => {
    const had = condsOf(cb).includes(k);
    if (cb.kind === "pc") {
      const row = chars.get(cb.ref);
      if (!row) return;
      const p = playOf(row.c);
      const next = had ? p.conditions.filter((x) => x !== k) : [...p.conditions, k];
      // a line in the character's own log, so the player sees what changed and who changed it
      const line: LogEntry = { id: newUid(), t: timeNow(), cls: "info", title: `${k} ${had ? "removed" : "added"} by the GM`, total: "", detail: "" };
      chars.save({ ...row.c, play: { ...p, conditions: next, log: [line, ...p.log].slice(0, 150) } });
    } else {
      const cur = cb.conditions || [];
      setCb(cb.uid, { conditions: had ? cur.filter((x) => x !== k) : [...cur, k] });
    }
    log({ title: `${nameOf(cb)}: ${k} ${had ? "removed" : "added"}`, total: "", cls: "info", detail: cb.kind === "pc" ? "On their sheet." : "" }, [cb.kind === "pc" ? cb.ref : undefined]);
  };

  // --------------------------------------------------------------- views
  const q2 = q.trim().toLowerCase();
  const results = [...creatures.values()]
    .filter((c) => (!q2 || c.name.toLowerCase().includes(q2) || c.type.includes(q2)) && (crMax === "" || c.cr <= crValue(crMax)))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 60);
  const groups = new Map<string, Combatant[]>();
  for (const c of e.combatants.filter((x) => x.kind === "monster")) groups.set(c.ref || c.name, [...(groups.get(c.ref || c.name) || []), c]);
  const previewSt = preview ? creatures.get(preview) : undefined;

  const diffColor = { Low: "var(--s-grn)", Moderate: "var(--s-gold)", High: "#f0a196", "Above High": "var(--s-red)", "": "var(--s-mut)" }[diff.label];

  const buildTab = (
    <div className="encgrid">
      <div>
        <div className="spanel">
          <h3>Difficulty (2024 rules)</h3>
          {pcs.length === 0 ? <p className="note" style={{ margin: 0 }}>Add the characters who’ll fight to rate it. Monster XP so far: <b>{diff.xp.toLocaleString()}</b>.</p> : (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                <span className="disp" style={{ fontSize: 24, color: diffColor }}>{diff.label || "No monsters yet"}</span>
                <span className="mut">{diff.xp.toLocaleString()} XP for {pcs.length} character{pcs.length > 1 ? "s" : ""} (level{levels.length > 1 ? "s" : ""} {levels.join(", ")})</span>
              </div>
              <div className="budget">
                {(["low", "moderate", "high"] as const).map((k) => (
                  <div key={k} className={diff.xp > (k === "low" ? 0 : k === "moderate" ? diff.budget.low : diff.budget.moderate) ? "on" : ""}>
                    <span>{k[0].toUpperCase() + k.slice(1)}</span><b>{diff.budget[k].toLocaleString()}</b>
                  </div>
                ))}
              </div>
              <p className="note" style={{ margin: "6px 0 0" }}>The party’s XP budget for each difficulty. A Low encounter spends up to the Low budget, and so on.</p>
            </>
          )}
        </div>

        <div className="spanel">
          <h3>In this encounter</h3>
          {e.combatants.length === 0 && <p className="note" style={{ margin: 0 }}>Nothing yet. Add monsters from the list, and pick the characters below.</p>}
          {[...groups].map(([ref, list]) => {
            const st = creatures.get(ref);
            const editing = invOpen === ref;
            return (
              <div key={ref} className={`crowwrap ${editing ? "on" : ""}`}>
              <div className="crow">
                <div className="ctext">
                  <button className="linkish" onClick={() => setPreview(ref)}><b>{st?.name || list[0].name}</b></button>{" "}
                  <span className="note">CR {st?.crText ?? "?"} · {((st?.xp ?? 0) * list.length).toLocaleString()} XP · HP {list.map((c) => monsterMax(c, st)).join(", ")}</span>
                  <div><button className="linkish note invtog" aria-expanded={editing} onClick={() => setInvOpen(editing ? undefined : ref)}>{editing ? "Done with inventory ▴" : `Inventory: ${invSummary(e.inv?.[ref], st?.gear || [])} ▾`}</button></div>
                </div>
                <div className="rowbtn">
                  {st?.hpText.includes("(") && <button className="sbtn sm ghost" title="Roll each one’s Hit Points instead of using the average" onClick={() => list.forEach(rollHp)}>Roll HP</button>}
                  <button className="sbtn sm ghost" aria-label={`One fewer ${st?.name}`} onClick={() => removeOne(ref)}>−</button>
                  <b style={{ minWidth: 18, textAlign: "center", alignSelf: "center" }}>{list.length}</b>
                  {st && <button className="sbtn sm ghost" aria-label={`One more ${st.name}`} onClick={() => addMonster(st)}>+</button>}
                </div>
              </div>
              {editing && <MonsterInvEditor name={st?.name || list[0].name} statGear={st?.gear || []} inv={e.inv?.[ref]} count={list.length} catalog={tables.catalog}
                onChange={(inv) => put((x) => ({ inv: { ...(x.inv || {}), [ref]: inv } }))} />}
              </div>
            );
          })}
          {e.combatants.filter((c) => c.kind === "other").map((c) => (
            <div key={c.uid} className="crow">
              <div className="ctext"><b>{c.name}</b> <span className="note">{[c.ac ? `AC ${c.ac}` : "", c.maxHp ? `HP ${c.maxHp}` : "", `Initiative ${fmt(c.initBonus ?? 0)}`].filter(Boolean).join(" · ")}</span></div>
              <button className="sbtn sm ghost" onClick={() => put((x) => ({ combatants: x.combatants.filter((y) => y.uid !== c.uid) }))}>Remove</button>
            </div>
          ))}
        </div>

        <div className="spanel">
          <h3>Characters</h3>
          {chars.rows.length === 0 ? <p className="note" style={{ margin: 0 }}>No characters yet.</p> : (
            <div className="stack" style={{ gap: 4 }}>
              {[...chars.rows].sort((a, b) => (a.c.name || "").localeCompare(b.c.name || "")).map((r) => {
                const on = pcs.some((c) => c.ref === r.c.id);
                const cls = content.byId(r.c.classId);
                return (
                  <label key={r.c.id} className="radio" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="checkbox" checked={on} onChange={() => togglePc(r.c.id)} />
                    <span><b>{r.c.name || "Unnamed"}</b> <span className="note">Level {r.c.level} {r.c.multiclass?.length ? classLabel(classInfos(r.c, content.byId)) : cls?.name || ""}</span></span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="spanel">
          <h3>Someone else</h3>
          <p className="note" style={{ marginTop: 0 }}>An NPC or creature without a stat block in the Library.</p>
          <div className="rowbtn" style={{ alignItems: "flex-end" }}>
            <label className="field" style={{ flex: "2 1 160px" }}>Name<input type="text" value={other.name} onChange={(x) => setOther({ ...other, name: x.target.value })} /></label>
            <label className="field" style={{ flex: "1 1 70px" }}>Initiative<input type="number" value={other.init} placeholder="+0" onChange={(x) => setOther({ ...other, init: x.target.value })} /></label>
            <label className="field" style={{ flex: "1 1 60px" }}>AC<input type="number" value={other.ac} onChange={(x) => setOther({ ...other, ac: x.target.value })} /></label>
            <label className="field" style={{ flex: "1 1 60px" }}>HP<input type="number" value={other.hp} onChange={(x) => setOther({ ...other, hp: x.target.value })} /></label>
            <button className="sbtn" disabled={!other.name.trim()} onClick={addOther}>Add</button>
          </div>
        </div>
      </div>

      <div>
        <div className="spanel">
          <h3>Monsters</h3>
          <div className="rowbtn">
            <input type="search" placeholder="Search by name or type (dragon, undead…)" value={q} onChange={(x) => setQ(x.target.value)} style={{ flex: 1, minWidth: 180 }} aria-label="Search monsters" />
            <select value={crMax} onChange={(x) => setCrMax(x.target.value)} aria-label="Highest challenge rating">
              <option value="">Any CR</option>
              {["0", "1/8", "1/4", "1/2", ...Array.from({ length: 30 }, (_, i) => String(i + 1))].map((c) => <option key={c} value={c}>CR {c} or lower</option>)}
            </select>
          </div>
          {creatures.size === 0 ? <p className="note">Loading monsters…</p> : (
            <div className="monlist">
              {results.map((c) => (
                <div key={c.id} className={`crow ${preview === c.id ? "sel" : ""}`}>
                  <div className="ctext">
                    <button className="linkish" onClick={() => setPreview(c.id)}><b>{c.name}</b></button>{" "}
                    <span className="note">CR {c.crText} · {c.size} {c.type}{c.xp !== undefined ? ` · ${c.xp.toLocaleString()} XP` : ""}</span>
                  </div>
                  <button className="sbtn sm" onClick={() => addMonster(c)}>Add</button>
                </div>
              ))}
              {results.length === 0 && <p className="note">No monsters match.</p>}
            </div>
          )}
        </div>
        {previewSt && <StatBlock st={previewSt} head={<span className="rowbtn"><button className="sbtn sm" onClick={() => addMonster(previewSt)}>Add</button><button className="sbtn sm ghost" onClick={() => setPreview(undefined)}>Close</button></span>} />}
      </div>
    </div>
  );

  // --------------------------------------------------------------- run view
  const selCb = e.combatants.find((c) => c.uid === (sel || e.turn)) || order[0];
  const pcPanel = (cb: Combatant, p: PcCombat) => (
    <div className="formblock">
      <div className="fbhead">
        <div><b className="fbname">{nameOf(cb)}</b> <span className="mut">Level {p.level}</span></div>
        <Link className="sbtn sm ghost" to={`/sheet/${cb.ref}`} target="_blank" style={{ textDecoration: "none" }}>Open sheet ↗</Link>
      </div>
      <div className="fbtags" style={{ margin: "6px 0" }}>
        <span className="tag plain">AC {p.ac}</span>
        <span className="tag plain">HP {p.hpCur}/{p.hpMax}{p.temp ? ` + ${p.temp} temp` : ""}</span>
        <span className="tag plain">Speed {p.speed} ft.</span>
        <span className="tag plain">Passive Perception {p.passivePerception}</span>
        <button className="sbtn sm ghost" onClick={() => roller.test(`${nameOf(cb)}: Initiative`, p.init)}>Initiative {fmt(p.init)}</button>
        {p.concentration && <span className="tag plain">Concentrating: {p.concentration}</span>}
      </div>
      {p.hpCur === 0 && <p className="note">At 0 Hit Points · death saves: {p.deathS} successes, {p.deathF} failures (tracked on their sheet).</p>}
      <div className="fbabil" style={{ marginTop: 8 }}>
        {Object.entries(p.d.saves).map(([a, s]) => (
          <div key={a} className="fbab">
            <div className="sl">{a.slice(0, 3)}</div>
            <div className="mut" style={{ fontSize: 11 }}>{p.d.scores[a]}</div>
            <button className="sbtn sm ghost" onClick={() => roller.test(`${nameOf(cb)}: ${a} save`, s.value)}>Save {fmt(s.value)}</button>
          </div>
        ))}
      </div>
      <p className="note" style={{ marginTop: 8 }}>Damage, healing and conditions you set here go to {nameOf(cb)}’s sheet: the player sees them within a second or two, with a line in their game log.</p>
    </div>
  );
  // --------------------------------------------------------------- loot
  /** Only the fallen give up their gear: monsters at 0 Hit Points, and any that surrendered. */
  const fallen = e.combatants.filter((c) => c.kind === "monster" && (c.surrendered || hpOf(c)?.cur === 0));
  const rarityOf = (ref?: string) => content.byId(ref)?.tagline?.match(/\b(very rare|uncommon|common|rare|legendary|artifact)\b/i)?.[1];
  const invOf = (c: Combatant): MonsterInv => e.inv?.[c.ref || c.name] || {};
  const found = lootFromMonsters(fallen.map((c) => ({ name: stOf(c)?.name || c.name, gear: invOf(c).gear ?? stOf(c)?.gear ?? [] })), tables, rarityOf);
  const lootCoins = sumCoins(fallen.map((c) => invOf(c).coins));
  const hiddenTiers = fallen.reduce((n, c) => n + (invOf(c).hidden?.filter((t) => t.finds.length).length || 0), 0);
  const lootGroups = applyDraft(found, e.lootDraft);
  const draft = e.lootDraft || {};
  const setDraft = (d: Partial<NonNullable<typeof e.lootDraft>>) => put((x) => ({ lootDraft: { ...(x.lootDraft || {}), ...d } }));
  const lootPlayers = [...new Set(e.combatants.filter((c) => c.kind === "pc" && c.ref).map((c) => c.ref!))];
  const lootLines = linesOf(lootGroups);
  const canSend = (lootLines.length > 0 || hasCoins(lootCoins) || fallen.length > 0) && lootPlayers.length > 0;
  const send = async () => {
    if (!canSend) return;
    const what = [lootLines.length ? `${lootLines.length} item${lootLines.length > 1 ? "s" : ""}` : "", hasCoins(lootCoins) ? coinsText(lootCoins) : ""].filter(Boolean).join(" and ") || "the bodies to search";
    if (!confirm(`Send ${what} to ${lootPlayers.map((r) => chars.get(r)?.c.name || "a character").join(", ")}? Each of them gets a pop-up to claim their loot.`)) return;
    setSending(true);
    try {
      const bodies = fallen.map((c) => ({ id: c.uid, name: c.name, status: c.surrendered ? "Surrendered" : "At 0 HP", check: invOf(c).check || "investigation" as const }));
      const hidden = fallen.map((c) => ({
        bodyId: c.uid,
        tiers: (invOf(c).hidden || []).filter((t) => t.finds.length).map((t) => ({ dc: t.dc, finds: t.finds.map((f) => hiddenFindOf(f, c.name, tables, rarityOf)) })),
      })).filter((h) => h.tiers.length);
      const lid = await sendLoot({ encounterId: e.id, name: e.name, players: lootPlayers, lines: lootLines, coins: lootCoins, bodies, hidden });
      put({ lootId: lid });
      log({ title: "Loot sent to the players", total: "", cls: "event", detail: what }, lootPlayers);
    } catch (err) {
      alert(`Couldn’t send the loot: ${(err as Error).message}`);
    }
    setSending(false);
  };
  const lootMatches = lootQ.trim().length >= 2 ? tables.catalog.filter((c) => c.name.toLowerCase().includes(lootQ.trim().toLowerCase())).slice(0, 8) : [];
  const addLoot = (name: string) => {
    if (!name.trim()) return;
    setDraft({ added: [...(draft.added || []), lootGroupOf(name.trim(), tables, rarityOf)] });
    setLootQ("");
  };
  const lootTab = e.lootId ? (
    <div className="spanel lootgm">
      <div className="lootgmh"><span className="disp">Loot sent</span><span className="note">{sent.loot?.status === "closed" ? "Closed" : "The players are choosing."}</span>
        <Link className="sbtn sm ghost" to={`/loot/${e.lootId}`} style={{ marginLeft: "auto", textDecoration: "none" }}>Open the loot page</Link>
        {sent.loot?.status === "open" && <button className="sbtn sm gold" onClick={() => { if (confirm("Close the loot? Items still waiting on answers are settled now: no answer counts as Leave.")) sent.close(); }}>Close loot</button>}
      </div>
      <table className="lt">
        <thead><tr><th>Item</th><th>From</th><th>Wants it</th><th>Result</th></tr></thead>
        <tbody>
          {sent.items.map((it) => {
            const w = sent.choices.filter((c) => c.item_id === it.id && c.choice === "want").map((c) => chars.get(c.character_id)?.c.name || "?");
            const last = it.rolls?.[it.rolls.length - 1];
            return (
              <tr key={it.id}>
                <td><b>{it.item.name}</b> <span className="note">{cpText(it.item.valueCp)}</span></td>
                <td className="note">{it.item.source}</td>
                <td className="note">{w.join(", ") || "—"}</td>
                <td>{it.status === "won" ? <span className="lootwon">{chars.get(it.winner || "")?.c.name || "?"}{last ? ` · d20 ${Object.values(last).sort((a, b) => b - a).join(" vs ")}` : ""}</span> : it.status === "left" ? <span className="note">Nobody took it</span> : <span className="note">Choosing</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sent.loot && (hasCoins(sent.loot.coins) || hasCoins(sent.loot.shared_coins)) && (
        <p className="note"><b>Coins</b> {coinsText(sumCoins([sent.loot.coins, sent.loot.shared_coins]))}{hasCoins(sent.loot.shared_coins) ? ` (${coinsText(sent.loot.shared_coins)} shared from searches)` : ""} · {sent.payouts.length ? `paid out: ${sent.payouts.map((p) => `${chars.get(p.character_id)?.c.name || "?"} ${coinsText(p.coins)}`).join(", ")}` : "split evenly when the loot closes"}</p>
      )}
      {sent.searches.length > 0 && (
        <div className="note">
          <b>Searches</b>
          {sent.searches.map((x) => (
            <div key={x.id}>{chars.get(x.character_id)?.c.name || "?"} searched {sent.loot?.bodies.find((b) => b.id === x.body_id)?.name || "a body"} ({x.total}): {x.finds.length ? x.finds.map((f) => `${f.kind === "coins" ? coinsText(f.coins) : f.line.name}${f.choice ? ` (${f.choice === "keep" ? "kept" : "shared"})` : ""}`).join(", ") : "nothing"}</div>
          ))}
        </div>
      )}
      <p className="note" style={{ marginBottom: 0 }}>Restart the encounter to clear this and loot again.</p>
    </div>
  ) : (
    <div className="spanel lootgm">
      <div className="lootgmh"><span className="disp">Review loot</span><span className="note">Gear from monsters at 0 HP or that surrendered, most valuable first. Players see this list only after you send it.</span></div>
      {(hasCoins(lootCoins) || hiddenTiers > 0) && (
        <div className="lootcoins">
          {hasCoins(lootCoins) && <span><b>Coins</b> {coinsText(lootCoins)} <span className="note">from {fallen.filter((c) => hasCoins(invOf(c).coins)).map((c) => c.name).join(", ")} · split evenly between the characters when the loot closes</span></span>}
          {hiddenTiers > 0 && <span><b className="hidl">Hidden</b> <span className="note">{hiddenTiers} tier{hiddenTiers > 1 ? "s" : ""} on {fallen.filter((c) => invOf(c).hidden?.some((t) => t.finds.length)).map((c) => c.name).join(", ")}: players find {hiddenTiers > 1 ? "them" : "it"} by searching the bodies. Edit coins and hidden finds on the Build tab.</span></span>}
        </div>
      )}
      {lootGroups.length === 0 ? (
        <p className="note">{fallen.length ? "No gear to hand out." : "Nothing to loot yet."} A monster gives up the gear on its stat block when it drops to 0 Hit Points or surrenders (tick Surrendered on the Run tab).</p>
      ) : (
        <table className="lt">
          <thead><tr><th>Item</th><th>From</th><th>Qty</th><th style={{ textAlign: "right" }}>Value</th><th style={{ textAlign: "right" }}>Weight</th><th></th></tr></thead>
          <tbody>
            {lootGroups.map((g) => {
              const fromText = [...new Set(g.sources)].map((n) => { const k = g.sources.filter((x) => x === n).length; return k > 1 ? `${n} ×${k}` : n; }).join(", ");
              return (
                <tr key={g.key} className={g.removed ? "gone" : ""}>
                  <td><b>{g.name}</b><div className="note">{g.detail}</div></td>
                  <td className="note">{fromText}</td>
                  <td>
                    <span className="step">
                      <button aria-label={`One fewer ${g.name}`} disabled={g.removed || g.qty <= 1} onClick={() => setDraft({ qty: { ...(draft.qty || {}), [g.key]: g.qty - 1 } })}>−</button>
                      <span>{g.removed ? 0 : g.qty}</span>
                      <button aria-label={`One more ${g.name}`} disabled={g.removed || g.qty >= g.max} onClick={() => setDraft({ qty: { ...(draft.qty || {}), [g.key]: g.qty + 1 } })}>+</button>
                    </span>
                    {!g.removed && g.qty < g.max && <span className="note"> of {g.max}</span>}
                  </td>
                  <td style={{ textAlign: "right" }}><b>{cpText(g.valueCp)}</b>{g.qty > 1 && g.valueCp !== undefined && !g.removed && <div className="note">{cpText(g.valueCp * g.qty)} total</div>}</td>
                  <td style={{ textAlign: "right" }} className="note">{g.weight ? `${g.weight} lb.` : "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    {g.removed
                      ? <button className="sbtn sm ghost" onClick={() => setDraft({ removed: (draft.removed || []).filter((k) => k !== g.key), qty: { ...(draft.qty || {}), [g.key]: g.max } })}>Undo</button>
                      : <button className="sbtn sm ghost" onClick={() => setDraft({ removed: [...(draft.removed || []), g.key] })}>Remove</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div className="lootadd">
        <input value={lootQ} placeholder="Add an item that isn’t on a stat block (a chest, a key…)" onChange={(x) => setLootQ(x.target.value)} onKeyDown={(x) => { if (x.key === "Enter") addLoot(lootMatches[0]?.name || lootQ); }} />
        <button className="sbtn ghost" onClick={() => addLoot(lootMatches[0]?.name || lootQ)}>Add</button>
      </div>
      {lootMatches.length > 0 && <div className="rowbtn" style={{ flexWrap: "wrap" }}>{lootMatches.map((c) => <button key={c.name} className="sbtn sm ghost" onClick={() => addLoot(c.name)}>{c.name}</button>)}</div>}
      <div className="lootgmf">
        <span className="note">{lootLines.length} item{lootLines.length === 1 ? "" : "s"} · {cpText(lootLines.reduce((n, l) => n + (l.valueCp || 0), 0))} in all{hasCoins(lootCoins) ? ` · ${coinsText(lootCoins)} in coins, split evenly` : ""}{hiddenTiers ? ` · ${hiddenTiers} hidden tier${hiddenTiers > 1 ? "s" : ""} to search for` : ""} · going to <b>{lootPlayers.map((r) => chars.get(r)?.c.name || "?").join(", ") || "no one (add characters on the Build tab)"}</b></span>
        {!cloud && <span className="note">Players claim loot from their own devices, so sending it needs a shared instance.</span>}
        <button className="sbtn gold" disabled={!cloud || sending || !canSend} onClick={send}>Send to players</button>
      </div>
    </div>
  );

  const runTab = (
    <div className="encgrid run">
      <div>
        <div className="spanel enctool">
          <div className="encround">
            <span className="sl">Round</span><b className="disp">{e.round || "–"}</b>
            <span className="sl" style={{ marginLeft: 10 }}>Turn</span><b>{e.turn ? nameOf(e.combatants.find((c) => c.uid === e.turn) || order[0]) : "Not started"}</b>
          </div>
          <div className="rowbtn">
            {e.round === 0 ? (
              <>
                <button className="sbtn ghost" disabled={!e.combatants.length} onClick={() => rollInit("monsters")}>Roll initiative for monsters</button>
                <button className="sbtn ghost" disabled={!e.combatants.length} onClick={reroll}>Roll initiative for everyone</button>
                <button className="sbtn gold" disabled={!e.combatants.length} onClick={start}>Start</button>
                <button className="sbtn ghost" disabled={!e.combatants.length} onClick={restart}>Restart</button>
              </>
            ) : (
              <>
                <button className="sbtn ghost" onClick={prev}>Previous</button>
                <button className="sbtn gold" onClick={next}>Next turn</button>
                <button className="sbtn ghost" onClick={reroll}>Roll initiative</button>
                <button className="sbtn ghost" onClick={restart}>Restart</button>
                <button className="sbtn ghost" onClick={endFight}>End fight</button>
              </>
            )}
          </div>
        </div>

        {e.combatants.length === 0 ? <div className="spanel"><p className="note" style={{ margin: 0 }}>Nobody’s in this fight yet. Add monsters and characters on the <button className="linkish" onClick={() => setTab("build")}>Build</button> tab.</p></div> : (
          <div className="spanel tracker">
            {order.map((cb) => {
              const h = hpOf(cb);
              const conds = condsOf(cb);
              const isTurn = cb.uid === e.turn;
              const down = h && h.cur === 0;
              return (
                <div key={cb.uid} className={`trow ${isTurn ? "turn" : ""} ${selCb?.uid === cb.uid ? "sel" : ""} ${cb.out || cb.surrendered ? "out" : ""}`}>
                  <div className="initcell">
                  <input className="initbox" type="number" inputMode="numeric" aria-label={`Initiative for ${nameOf(cb)}`} value={cb.init ?? ""} placeholder="–"
                    onChange={(x) => setCb(cb.uid, { init: x.target.value === "" ? undefined : +x.target.value })} />
                  <button className="initroll" aria-label={`Roll initiative for ${nameOf(cb)}`} title={`Roll initiative: d20 ${fmt(bonusOf(cb))}`} onClick={() => rollInit(cb.uid)}>d20</button>
                  </div>
                  <div className="tmain">
                    <button className="tname linkish" onClick={() => setSel(cb.uid)}>
                      {isTurn && <span aria-label="Their turn">▶ </span>}<b>{nameOf(cb)}</b>
                    </button>
                    <span className="note">
                      {cb.kind === "pc" ? "Character" : cb.kind === "monster" ? `CR ${stOf(cb)?.crText ?? "?"}` : "Other"}
                      {acOf(cb) !== undefined ? ` · AC ${acOf(cb)}` : ""} · Init {fmt(bonusOf(cb))}
                    </span>
                    {conds.length > 0 && (
                      <div className="rowbtn" style={{ marginTop: 3 }}>
                        {conds.map((k) => <button key={k} className="tag warn" title="Remove" onClick={() => toggleCond(cb, k)}>{k} ✕</button>)}
                      </div>
                    )}
                  </div>
                  {h ? (
                    <div className="thp">
                      <div className="hpbar" aria-hidden="true"><i style={{ width: `${Math.round((h.cur / h.max) * 100)}%`, background: down ? "var(--s-red)" : h.cur <= h.max / 2 ? "var(--s-gold)" : "var(--s-grn)" }} /></div>
                      <span><b>{h.cur}</b>/{h.max}{h.temp ? ` +${h.temp}` : ""}{down ? " · down" : h.cur <= h.max / 2 ? " · bloodied" : ""}</span>
                      <div className="rowbtn">
                        <input id={`amt-${cb.uid}`} type="number" min={0} inputMode="numeric" placeholder="HP" aria-label={`Damage or healing for ${nameOf(cb)}`} style={{ width: 62 }}
                          onKeyDown={(x) => { if (x.key === "Enter") applyHp(cb, "damage"); }} />
                        <button className="sbtn sm red" onClick={() => applyHp(cb, "damage")}>Dmg</button>
                        <button className="sbtn sm grn" onClick={() => applyHp(cb, "heal")}>Heal</button>
                      </div>
                    </div>
                  ) : <div className="thp note">No HP tracked</div>}
                  <div className="tside">
                    <select className="optpick" value="" aria-label={`Add a condition to ${nameOf(cb)}`} onChange={(x) => { if (x.target.value) toggleCond(cb, x.target.value); }}>
                      <option value="">+ Condition</option>
                      {conditionNames.filter((k) => !conds.includes(k)).map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <label className="note" style={{ display: "flex", gap: 4, alignItems: "center" }} title="Out of the fight (dead, fled): skipped when the turn moves on.">
                        <input type="checkbox" checked={!!cb.out} onChange={(x) => setCb(cb.uid, { out: x.target.checked })} /> Out
                      </label>
                      {cb.kind !== "pc" && (
                        <label className="note" style={{ display: "flex", gap: 4, alignItems: "center" }} title="Gave up: skipped when the turn moves on, and its gear can be looted.">
                          <input type="checkbox" checked={!!cb.surrendered} onChange={(x) => { setCb(cb.uid, { surrendered: x.target.checked }); if (x.target.checked) log({ title: `${nameOf(cb)} surrenders`, total: "", cls: "event", detail: "" }); }} /> Surrendered
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="spanel" style={{ padding: 10 }}>
          <div className="rowbtn" role="group" aria-label="Roll mode">
            {(["normal", "adv", "dis"] as const).map((m) => <button key={m} className={`sbtn sm ${mode === m ? "gold" : "ghost"}`} aria-pressed={mode === m} onClick={() => setMode(m)}>{m === "normal" ? "Normal" : m === "adv" ? "Advantage" : "Disadvantage"}</button>)}
          </div>
        </div>
        {selCb && (selCb.kind === "monster" && stOf(selCb) ? (
          <StatBlock st={stOf(selCb)!} roll={roller} head={<span className="mut">{nameOf(selCb)}{selCb.uid === e.turn ? " · their turn" : ""}</span>} />
        ) : selCb.kind === "pc" && pcOf(selCb) ? pcPanel(selCb, pcOf(selCb)!) : selCb.kind === "pc" ? (
          <div className="formblock"><p className="note">This character isn’t available (deleted, or hidden from you).</p></div>
        ) : (
          <div className="formblock">
            <div className="fbhead"><b className="fbname">{selCb.name}</b></div>
            <div className="rowbtn" style={{ marginTop: 6 }}>
              <button className="sbtn sm ghost" onClick={() => roller.test(`${selCb.name}: Initiative`, selCb.initBonus ?? 0)}>Initiative {fmt(selCb.initBonus ?? 0)}</button>
              <button className="sbtn sm ghost" onClick={() => roller.test(`${selCb.name}: d20`, 0)}>Roll d20</button>
            </div>
            <label className="field" style={{ marginTop: 8 }}>Notes<textarea rows={3} value={selCb.note || ""} onChange={(x) => setCb(selCb.uid, { note: x.target.value || undefined })} /></label>
          </div>
        ))}
        <div className="spanel enclog">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Roll log</h3>
            {e.log.length > 0 && <button className="sbtn sm ghost" onClick={() => { if (confirm("Clear the roll log?")) put({ log: [] }); }}>Clear</button>}
          </div>
          <div className="cards" style={{ padding: "10px 0 0" }}>
            {e.log.length === 0 ? <div className="empty">Rolls from the stat blocks, initiative, damage and healing show up here.</div> : e.log.map((x, i) => (
              <div key={x.id} className={`lc ${x.cls} ${i > 0 ? "old" : ""}`}>
                <div className="ch"><span className="ct">{x.title}</span><span className="tm">{x.t}</span></div>
                <div className="cb">
                  {x.total !== "" && <div className="big">{x.total}</div>}
                  <div className="det" dangerouslySetInnerHTML={{ __html: x.detail }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="sheetv encv">
      <div className="enchead">
        <div style={{ flex: 1, minWidth: 220 }}>
          <Link to="/encounters" className="note">← Encounters</Link>
          <input className="encname disp" value={e.name} aria-label="Encounter name" onChange={(x) => put({ name: x.target.value })} onBlur={(x) => { if (!x.target.value.trim()) put({ name: "Untitled encounter" }); }} />
          <div className="note">{summary(e, (c) => stOf(c)?.name || c.name)}{diff.label ? ` · ${diff.label} difficulty` : ""}</div>
        </div>
        <div className="rowbtn" role="tablist" aria-label="Encounter view">
          <button role="tab" className={`sbtn ${tab === "build" ? "gold" : "ghost"}`} aria-selected={tab === "build"} onClick={() => setTab("build")}>Build</button>
          <button role="tab" className={`sbtn ${tab === "run" ? "gold" : "ghost"}`} aria-selected={tab === "run"} onClick={() => setTab("run")}>Run{e.round ? ` · round ${e.round}` : ""}</button>
          <button role="tab" className={`sbtn ${tab === "loot" ? "gold" : "ghost"}`} aria-selected={tab === "loot"} onClick={() => setTab("loot")}>Loot{!e.lootId && lootGroups.some((g) => !g.removed) ? ` · ${lootLines.length}` : ""}</button>
        </div>
      </div>
      {enc.error && <div className="spanel warnline">{enc.error}</div>}
      {tab === "build" ? buildTab : tab === "loot" ? lootTab : runTab}
    </div>
  );
}
