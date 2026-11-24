/**
 * The loot page, and the "battle is over" pop-up that leads to it. Every player with a character in the fight
 * marks each item "I want it" or "Leave" (an item someone else already wants shows "Roll for it"). Once everyone
 * has answered an item, or the GM closes the loot, it goes to its only taker or the takers roll a d20 for it.
 */
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { cloud } from "../lib/backend.ts";
import { useSession } from "../lib/session.tsx";
import { useCharacters } from "../lib/characters.tsx";
import { cpText } from "../lib/loot.ts";
import { ignoreLoot, markSeen, useLoot, useLootWatch, type LootItemRow } from "../lib/lootStore.tsx";

/** The pop-up on every player's screen when the GM sends the loot. */
export function LootPopup() {
  const watch = useLootWatch();
  const nav = useNavigate();
  const here = useLocation().pathname;
  // no pop-up for the loot you're already looking at: its page has a character picker
  const shown = watch.popups.filter((x) => here !== `/loot/${x.loot.id}`);
  const p = shown[0];
  if (!p) return null;
  return (
    <div className="lootpop" role="dialog" aria-modal="true" aria-label="The battle is over">
      <div className="lootpop-box">
        <div className="lootpop-icon" aria-hidden="true">⚔</div>
        <div className="lootpop-title">The battle is over</div>
        <div className="lootpop-sub">{p.loot.name}{shown.length > 1 || p.loot.players.length > 1 ? ` · for ${p.characterName}` : ""}</div>
        <button className="lootpop-claim" onClick={() => { markSeen(p.loot.id, p.characterId); watch.dismiss(p.loot.id, p.characterId); nav(`/loot/${p.loot.id}?c=${p.characterId}`); }}>Claim your loot</button>
        <button className="lootpop-ignore" onClick={async () => { watch.dismiss(p.loot.id, p.characterId); await ignoreLoot(p.loot.id, p.characterId); }}>Ignore</button>
        <div className="lootpop-note">Ignore leaves the loot to the rest of the party.</div>
      </div>
    </div>
  );
}

export default function LootPage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const session = useSession();
  const chars = useCharacters();
  const L = useLoot(id);
  const me = session.user?.id;
  const isGm = session.isAdmin;
  const players0 = L.loot?.players || [];
  const mine = players0.filter((cid) => chars.get(cid)?.owner === me);
  // the GM can choose for any player in the loot (theirs first), e.g. for someone who isn't at the table
  const choosable = isGm ? [...mine, ...players0.filter((x) => !mine.includes(x))] : mine;
  const asked = params.get("c");
  const cid = asked && choosable.includes(asked) ? asked : asked === "" ? undefined : mine[0];
  const nameOf = (c?: string | null) => (c ? chars.get(c)?.c.name || "Someone" : "Someone");
  const [now, setNow] = useState(0);
  useEffect(() => { if (cid && L.loot) markSeen(L.loot.id, cid); }, [cid, L.loot]);
  useEffect(() => { const t = setInterval(() => setNow((n) => n + 1), 30000); return () => clearInterval(t); }, []);
  void now;

  if (!cloud) return <div className="panel">Loot is shared between players, so it needs a shared instance.</div>;
  if (!L.ready) return <p className="muted">Loading the loot…</p>;
  if (!L.loot) return <div className="panel">This loot isn’t here anymore. <Link to="/">Back to characters</Link></div>;

  const players = L.loot.players;
  const wants = (it: LootItemRow) => L.choices.filter((c) => c.item_id === it.id && c.choice === "want").map((c) => c.character_id);
  const myChoice = (it: LootItemRow) => L.choices.find((c) => c.item_id === it.id && c.character_id === cid)?.choice;
  const waiting = players.filter((p) => L.items.some((it) => it.status === "open" && !L.choices.some((c) => c.item_id === it.id && c.character_id === p)));
  const mineWon = L.items.filter((it) => it.status === "won" && it.winner === cid);
  const lastRoll = [...L.items].filter((it) => it.status === "won" && it.rolls?.length).pop();
  const rollText = (it: LootItemRow) => {
    const last = it.rolls?.[it.rolls.length - 1];
    if (!last) return "";
    const entries = Object.entries(last).sort((a, b) => b[1] - a[1]);
    return `d20 ${entries.map(([k, v]) => `${v} ${k === cid ? "(you)" : `(${nameOf(k)})`}`).join(" vs ")}`;
  };

  return (
    <div className="lootv">
      <div className="lootmain panel">
        <div className="loothead">
          <h1>Loot · {L.loot.name}</h1>
          {isGm || choosable.length > 1 ? (
            <label className="faint">{cid ? "Choosing for" : "GM view"}{" "}
              <select value={cid || ""} onChange={(e) => setParams({ c: e.target.value })}>
                {isGm && <option value="">Just watching</option>}
                {choosable.map((m) => <option key={m} value={m}>{nameOf(m)}{isGm && !mine.includes(m) ? " (player)" : ""}</option>)}
              </select>
            </label>
          ) : cid ? <span className="faint">Choosing for <b>{nameOf(cid)}</b></span>
            : <span className="faint">None of your characters were in this fight.</span>}
          {L.loot.status === "closed" && <span className="tag">Closed</span>}
        </div>
        {cid && L.loot.status === "open" && (
          <p className="faint" style={{ margin: "4px 0 10px" }}>
            Mark each item <b className="gold">I want it</b> or <b>Leave</b>. If someone else already wants an item, its button reads <b className="gold">Roll for it</b>: tap it to roll them for it. When everyone has chosen, an item with one taker goes to them; with more takers, they roll a d20.
          </p>
        )}
        {L.error && <div className="inset" role="status">{L.error}</div>}
        <div className="lootlist">
          {L.items.map((it) => {
            const w = wants(it);
            const choice = myChoice(it);
            const others = w.filter((x) => x !== cid);
            const won = it.status === "won", left = it.status === "left";
            return (
              <div key={it.id} className={`lootrow ${won || left ? "done" : ""}`}>
                <div className="lootname">
                  <b>{it.item.name}</b> <span className="lootval">{cpText(it.item.valueCp)}</span>
                  <div className="faint">{[it.item.detail, it.item.weight ? `${it.item.weight} lb.` : "", it.item.source].filter(Boolean).join(" · ")}</div>
                </div>
                <div className="lootwho">
                  {w.length ? w.map((x) => <span key={x} className={`chipx ${x === cid ? "me" : ""}`}>{x === cid ? "You" : nameOf(x)}</span>) : !won && !left && <span className="chipx none">No one yet</span>}
                </div>
                <div className="lootact">
                  {won ? (
                    it.winner === cid
                      ? <span className="lootwon">Yours · {it.rolls?.length ? rollText(it) : "the only taker"}</span>
                      : <span className="lootlost">{nameOf(it.winner)} {it.rolls?.length ? `won it · ${rollText(it)}` : "took it"}</span>
                  ) : left ? <span className="lootlost">Nobody took it</span>
                    : cid && L.loot!.status === "open" ? (
                      <>
                        <button className={`lbtn want ${choice === "want" ? "on" : others.length ? "claimed" : ""}`} aria-pressed={choice === "want"}
                          title={choice !== "want" && others.length ? `${others.map(nameOf).join(" and ")} want${others.length > 1 ? "" : "s"} this. Tap to roll a d20 against them for it.` : undefined}
                          onClick={() => L.choose(it.id, cid, "want")}>{choice !== "want" && others.length ? "Roll for it" : "I want it"}</button>
                        <button className={`lbtn leave ${choice === "leave" ? "on" : ""}`} aria-pressed={choice === "leave"} onClick={() => L.choose(it.id, cid, "leave")}>Leave</button>
                      </>
                    ) : <span className="faint">Waiting</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="lootfoot">
          {L.loot.status === "open"
            ? (waiting.length ? <>Waiting on <b>{waiting.map(nameOf).join(", ")}</b>. {isGm ? "" : "The GM can close the loot to settle the rest."}</> : "Everyone has chosen.")
            : "The loot is closed: anything still unanswered went to whoever wanted it, or stayed behind."}
          {cid && L.loot.status === "open" && L.items.some((it) => it.status === "open" && !myChoice(it)) && (
            <button className="btn small" onClick={() => L.ignore(cid)}>Leave the rest to the party</button>
          )}
          {isGm && L.loot.status === "open" && (
            <button className="btn small primary" onClick={() => { if (confirm("Close the loot? Items still waiting on answers are settled now: no answer counts as Leave.")) L.close(); }}>Close loot</button>
          )}
        </div>
      </div>
      <div className="lootside">
        {lastRoll && (
          <div className="lootroll">
            <div className="lab">Contested roll · {lastRoll.item.name}</div>
            <div className="lootdice">
              {Object.entries(lastRoll.rolls![lastRoll.rolls!.length - 1]).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <div key={k} className="lootdie"><span className={`dd ${k === lastRoll.winner ? "" : "lo"}`}>{v}</span><div className={k === lastRoll.winner ? "gold" : ""}>{k === cid ? "You" : nameOf(k)}</div></div>
              ))}
            </div>
            <div style={{ textAlign: "center" }}>{lastRoll.winner === cid ? "You take" : `${nameOf(lastRoll.winner)} takes`} the {lastRoll.item.name}.</div>
          </div>
        )}
        {cid && (
          <div className="panel" style={{ padding: 12 }}>
            <div className="lab">Yours so far</div>
            {mineWon.length ? mineWon.map((it) => <div key={it.id} style={{ marginTop: 6 }}>{it.item.name} <span className="lootwon">· {it.rolls?.length ? "won the roll" : "only taker"}</span></div>) : <div className="faint" style={{ marginTop: 6 }}>Nothing yet.</div>}
            <div className="faint" style={{ marginTop: 8, fontSize: 12 }}>Items you get go into your Inventory, unequipped, with a line in your game log.</div>
            <Link className="btn small" style={{ marginTop: 10 }} to={`/sheet/${cid}`}>Back to {nameOf(cid)}’s sheet</Link>
          </div>
        )}
      </div>
    </div>
  );
}
