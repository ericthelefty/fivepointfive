import { useEffect, useMemo, useState } from "react";
import { useContent } from "../lib/store.tsx";
import { Md } from "../lib/md.tsx";
import type { Entry } from "../lib/parse.ts";

const TYPES = ["Class", "Subclass", "Species", "Background", "Feat", "Spell", "Magic Item", "Creature", "Gear", "Tool", "Rule"];

/** Rebuild an entry's Markdown (for "view as .md" and copying as an example). */
export function entryToMd(e: Entry): string {
  const lines = [`# ${e.name}${e.tags.length && e.type === "Rule" ? ` [${e.tags[0]}]` : ""}`];
  const order = Object.entries(e.fields);
  for (const [k, v] of order) {
    if (k === "source") continue;
    lines.push(`**${k.replace(/\b\w/g, (c) => c.toUpperCase())}:** ${v}`);
  }
  if (e.tagline) lines.splice(2, 0, `*${e.tagline}*`);
  return lines.join("\n") + "\n\n" + e.body + "\n";
}

export default function Library() {
  const content = useContent();
  const [type, setType] = useState("Spell");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string>();
  const [raw, setRaw] = useState(false);

  useEffect(() => {
    content.ensure("spells", "items", "creatures", "rules");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return content
      .byType(type)
      .filter((e) => !needle || e.name.toLowerCase().includes(needle) || (e.tagline || "").toLowerCase().includes(needle) || e.tags.some((t) => t.toLowerCase().includes(needle)))
      .slice(0, 400);
  }, [content, type, q]);
  const e = content.byId(sel);

  return (
    <div className="row">
      <section className="side stack">
        <h1>Library</h1>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TYPES.map((t) => (
            <button key={t} className="pill" aria-pressed={t === type} onClick={() => { setType(t); setSel(undefined); }}>
              {t} <span className="faint">{content.byType(t).length}</span>
            </button>
          ))}
        </div>
        <input type="search" placeholder={`Search ${type.toLowerCase()}…`} value={q} onChange={(ev) => setQ(ev.target.value)} aria-label="Search" />
        <div className="stack" style={{ gap: 6, maxHeight: "70vh", overflowY: "auto" }}>
          {list.map((x) => (
            <button key={x.id} className="card" aria-pressed={x.id === sel} onClick={() => setSel(x.id)} style={{ padding: "8px 12px" }}>
              <strong>{x.name}</strong>{x.pack !== "srd" && <span className="tag plain" style={{ marginLeft: 6 }}>{x.pack}</span>}
              {x.tagline && <div className="faint">{x.tagline}</div>}
            </button>
          ))}
          {list.length === 0 && <p className="muted">{content.loaded.size < 5 ? "Loading…" : "Nothing matches."}</p>}
        </div>
      </section>
      <article className="grow panel">
        {!e ? (
          <p className="muted">Pick an entry to read it.</p>
        ) : (
          <div className="stack">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div className="eyebrow">{e.type}{e.tags.length ? ` · ${e.tags.join(", ")}` : ""}</div>
                <h2 style={{ fontSize: 28, color: "var(--accent-ink)" }}>{e.name}</h2>
                {e.tagline && <div className="muted"><i>{e.tagline}</i></div>}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="pill" aria-pressed={!raw} onClick={() => setRaw(false)}>Rendered</button>
                <button className="pill" aria-pressed={raw} onClick={() => setRaw(true)}>As .md</button>
              </div>
            </div>
            {raw ? (
              <>
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--mono)", fontSize: 12, background: "var(--panel-2)", border: "1px solid var(--line-2)", borderRadius: 10, padding: 12, margin: 0 }}>{entryToMd(e)}</pre>
                <div><button className="btn small" onClick={() => navigator.clipboard?.writeText(entryToMd(e))}>Copy as example</button></div>
              </>
            ) : (
              <>
                <dl className="kv">
                  {Object.entries(e.fields).filter(([k]) => !["type", "source", "id"].includes(k)).map(([k, v]) => (
                    <div key={k} style={{ display: "contents" }}>
                      <dt style={{ textTransform: "capitalize" }}>{k}</dt>
                      <dd><Md md={v} /></dd>
                    </div>
                  ))}
                </dl>
                <Md md={e.body} />
              </>
            )}
            <div className="faint">Source: {e.fields["source"] || e.pack} · <code>{e.id}</code></div>
          </div>
        )}
      </article>
    </div>
  );
}
