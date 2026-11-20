import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { deleteCharacter, loadCharacters, saveCharacter, useContent } from "../lib/store.tsx";
import { newCharacter, type Character } from "../lib/rules.ts";

export default function Home() {
  const nav = useNavigate();
  const { byId } = useContent();
  const [chars, setChars] = useState(loadCharacters().sort((a, b) => b.updated - a.updated));
  const [msg, setMsg] = useState("");

  const create = () => {
    const c = newCharacter();
    saveCharacter(c);
    nav(`/build/${c.id}`);
  };

  const importFile = async (f: File) => {
    try {
      const c = JSON.parse(await f.text()) as Character;
      if (!c || typeof c !== "object" || !c.base) throw new Error("not a character file");
      c.id = Math.random().toString(36).slice(2, 10);
      saveCharacter(c);
      setChars(loadCharacters().sort((a, b) => b.updated - a.updated));
      setMsg(`Imported ${c.name || "character"}.`);
    } catch {
      setMsg("That file isn’t a fivepointfive character (.json).");
    }
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1>Your characters</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>Saved in this browser. Export a character to move it or send it to a friend.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label className="btn">
            Import character
            <input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          </label>
          <button className="btn primary" onClick={create}>New character</button>
        </div>
      </div>
      {msg && <div className="inset" role="status">{msg}</div>}
      {chars.length === 0 ? (
        <div className="panel" style={{ textAlign: "center", padding: 40 }}>
          <h2>No characters yet</h2>
          <p className="muted">Build one from the SRD 5.2.1: 12 classes, 9 species and 4 backgrounds, plus anything you import.</p>
          <button className="btn primary" onClick={create}>Create your first character</button>
        </div>
      ) : (
        <div className="grid3">
          {chars.map((c) => {
            const cls = byId(c.classId);
            const sp = byId(c.speciesId);
            return (
              <div key={c.id} className="panel" style={{ padding: 16 }}>
                <div className="t" style={{ fontFamily: "var(--serif)", fontSize: 20, fontWeight: 600 }}>{c.name || "Unnamed character"}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {[sp?.name, cls ? `${cls.name} ${c.level}` : null].filter(Boolean).join(" · ") || "Not started"}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
                  <Link className="btn small primary" to={`/sheet/${c.id}`}>Sheet</Link>
                  <Link className="btn small" to={`/build/${c.id}`}>Edit</Link>
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
                  <button
                    className="btn small"
                    onClick={() => {
                      if (!confirm(`Delete ${c.name || "this character"}?`)) return;
                      deleteCharacter(c.id);
                      setChars(loadCharacters().sort((a, b) => b.updated - a.updated));
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
