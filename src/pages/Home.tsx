import { Tip } from "../lib/tip.tsx";
import { SAMPLES, makeSample } from "../lib/samples.ts";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { classInfos, classLabel } from "../lib/multiclass.ts";
import { useContent } from "../lib/store.tsx";
import { newId, useCharacters } from "../lib/characters.tsx";
import { useSession } from "../lib/session.tsx";
import { cloud } from "../lib/backend.ts";
import { newCharacter, type Character } from "../lib/rules.ts";

export default function Home() {
  const nav = useNavigate();
  const { byId } = useContent();
  const chars = useCharacters();
  const session = useSession();
  const [filter, setFilter] = useState<"all" | "mine">("all");
  const [msg, setMsg] = useState("");

  const rows = [...chars.rows]
    .filter((r) => filter === "all" || !cloud || r.owner === session.user?.id)
    .sort((a, b) => b.c.updated - a.c.updated);

  const create = async () => {
    const c = newCharacter();
    c.id = newId();
    try {
      await chars.create(c);
      nav(`/build/${c.id}`);
    } catch {
      setMsg("Couldn’t create a character. Check your connection and try again.");
    }
  };

  const [samplesOpen, setSamplesOpen] = useState(false);
  const addSample = async (sm: (typeof SAMPLES)[number]) => {
    const c = makeSample(sm);
    try {
      await chars.create(c);
      nav(`/sheet/${c.id}`);
    } catch {
      setMsg("Couldn’t add the sample character. Check your connection and try again.");
    }
  };

  const copy = async (src: Character) => {
    const c: Character = { ...structuredClone(src), id: newId(), name: `${src.name || "Unnamed"} (copy)`, play: undefined, updated: Date.now() };
    await chars.create(c);
    setMsg(`Made a copy: ${c.name}. It’s yours to edit.`);
  };

  const importFile = async (f: File) => {
    try {
      const c = JSON.parse(await f.text()) as Character;
      if (!c || typeof c !== "object" || !c.base) throw new Error("not a character file");
      c.id = newId();
      c.updated = Date.now();
      await chars.create(c);
      setMsg(`Imported ${c.name || "character"}.`);
    } catch {
      setMsg("That file isn’t a fivepointfive character (.json).");
    }
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1>{cloud ? "Characters" : "Your characters"}</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            {cloud ? "Everyone in this group can see these, except characters their players have hidden. You can edit your own; anyone can make their own copy." : "Saved in this browser. Export a character to move it or send it to a friend."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {cloud && (
            <div role="group" aria-label="Show" style={{ display: "flex", gap: 6 }}>
              <button className="pill" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Everyone</button>
              <button className="pill" aria-pressed={filter === "mine"} onClick={() => setFilter("mine")}>Mine</button>
            </div>
          )}
          <label className="btn">
            Import character
            <input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          </label>
          <button className="btn" aria-expanded={samplesOpen} onClick={() => setSamplesOpen((x) => !x)}>Try a sample</button>
          <button className="btn primary" onClick={create}>New character</button>
        </div>
      </div>
      {samplesOpen && (
        <div className="inset" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className="muted">Ready-made characters from the SRD, to try the sheet. Keep them, change them or delete them:</span>
          {SAMPLES.map((sm) => <button key={sm.label} className="btn small" onClick={() => addSample(sm)}>{sm.label}</button>)}
        </div>
      )}
      {(msg || chars.error) && <div className="inset" role="status">{msg || chars.error}</div>}
      {!chars.ready ? (
        <p className="muted">Loading characters…</p>
      ) : rows.length === 0 ? (
        <div className="panel" style={{ textAlign: "center", padding: 40 }}>
          <h2>No characters yet</h2>
          <p className="muted">Build one from the SRD 5.2.1: 12 classes, 9 species and 4 backgrounds, plus anything you import.</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn primary" onClick={create}>Create your first character</button>
            <button className="btn" onClick={() => setSamplesOpen(true)}>Try a sample character</button>
          </div>
        </div>
      ) : (
        <div className="grid3">
          {rows.map(({ c, owner, hidden }) => {
            const cls = byId(c.classId);
            const sp = byId(c.speciesId);
            const mine = chars.canEdit(c.id);
            return (
              <div key={c.id} className={`panel ${hidden ? "charhidden" : ""}`} style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 600 }}>{c.name || "Unnamed character"}</div>
                  {cloud && hidden && (
                    <Tip tip={owner === session.user?.id ? "Only you and the group’s admins can see this character." : "Hidden by its player: only they and admins can see it."}>
                      <span className="tag warn">Hidden</span>
                    </Tip>
                  )}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {[sp?.name, cls ? classLabel(classInfos(c, byId)) : null].filter(Boolean).join(" · ") || "Not started"}
                </div>
                {cloud && (session.isAdmin && session.members.length > 1 ? (
                  <label className="faint assignrow" title="Give this character to another player. They’ll own it as if they had made it: only they and admins can edit it.">
                    Player:{" "}
                    <select value={owner || ""} aria-label={`Player for ${c.name || "this character"}`}
                      onChange={(e) => { const to = e.target.value; if (to !== owner && confirm(`Give ${c.name || "this character"} to ${to === session.user?.id ? "you" : session.nameOf(to)}? They’ll own it and can edit it.`)) chars.assign(c.id, to); }}>
                      {owner && !session.members.some((m) => m.user_id === owner) && <option value={owner}>{session.nameOf(owner)}</option>}
                      {session.members.map((m) => <option key={m.user_id} value={m.user_id}>{m.user_id === session.user?.id ? "you" : session.nameOf(m.user_id)}</option>)}
                    </select>
                  </label>
                ) : <div className="faint">Player: {owner === session.user?.id ? "you" : session.nameOf(owner)}</div>)}
                <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                  <Link className="btn small primary" to={`/sheet/${c.id}`}>Sheet</Link>
                  {mine && <Link className="btn small" to={`/build/${c.id}`}>Edit</Link>}
                  {cloud && mine && (
                    <button
                      className="btn small"
                      aria-pressed={!!hidden}
                      onClick={() => chars.setHidden(c.id, !hidden)}
                    >
                      {hidden ? "Show to group" : "Hide from group"}
                    </button>
                  )}
                  {cloud && <button className="btn small" onClick={() => copy(c)}>Make a copy</button>}
                  <button
                    className="btn small"
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(c, null, 2)], { type: "application/json" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `${(c.name || "character").replace(/[^\w-]+/g, "-")}.json`;
                      a.click();
                    }}
                  >
                    Export
                  </button>
                  {mine && (
                    <button className="btn small" onClick={() => confirm(`Delete ${c.name || "this character"}?`) && chars.remove(c.id)}>Delete</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
