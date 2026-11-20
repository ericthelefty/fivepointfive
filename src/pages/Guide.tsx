import { useState } from "react";
import { Link } from "react-router-dom";
import { Md } from "../lib/md.tsx";
import guide from "../../docs/CONTENT_FORMAT.md?raw";
import { TEMPLATES } from "../lib/templates.ts";


export default function Guide() {
  const [tab, setTab] = useState("Spell");
  const [copied, setCopied] = useState(false);
  const t = TEMPLATES[tab];
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1>How to format .md files</h1>
          <p className="muted" style={{ margin: "6px 0 0", maxWidth: 720 }}>
            Write content in Notepad, TextEdit or any editor, save it with the <code>.md</code> extension, and drop it on the{" "}
            <Link to="/content">Content packs</Link> page. In Notepad, choose “All files” when saving so it isn’t saved as .txt.
          </p>
        </div>
      </div>

      <section className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
          <h2>Templates</h2>
          <span className="faint">Copy one, replace the text in [brackets], save as .md</span>
        </div>
        <div role="tablist" aria-label="Content type" style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "12px 0" }}>
          {Object.keys(TEMPLATES).map((k) => (
            <button key={k} role="tab" aria-selected={k === tab} className="pill" aria-pressed={k === tab} onClick={() => { setTab(k); setCopied(false); }}>{k}</button>
          ))}
        </div>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "var(--mono)", fontSize: 13, lineHeight: 1.7, background: "var(--panel-2)", border: "1px solid var(--line-2)", borderRadius: 12, padding: 16 }}>{t.text}</pre>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button className="btn small primary" onClick={() => { navigator.clipboard?.writeText(t.text); setCopied(true); }}>{copied ? "Copied" : "Copy template"}</button>
          <button className="btn small" onClick={() => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([t.text], { type: "text/markdown" }));
            a.download = t.file;
            a.click();
          }}>Download {t.file}</button>
          <Link className="btn small" to="/library">See SRD examples</Link>
        </div>
      </section>

      <section className="panel">
        <Md md={guide.replace(/^# .*\n/, "")} />
      </section>
    </div>
  );
}
