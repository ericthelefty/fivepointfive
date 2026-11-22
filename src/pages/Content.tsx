import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { entriesForUserPack, packIdFor, useContent, type UserPack } from "../lib/store.tsx";
import { packChanges } from "../lib/packdiff.ts";
import { applySuggestion, checkFile, type FileReport } from "../lib/fix.ts";
import { useSession } from "../lib/session.tsx";
import { cloud } from "../lib/backend.ts";
import { readUploads } from "../lib/zip.ts";


export default function Content() {
  const content = useContent();
  const session = useSession();
  const [reports, setReports] = useState<FileReport[]>([]);
  const [packName, setPackName] = useState("");
  const [over, setOver] = useState(false);
  const [saved, setSaved] = useState("");
  /** Notes about .zip files: what was skipped or couldn't be read. */
  const [zipNotes, setZipNotes] = useState<string[]>([]);
  const classes = content.byType("Class").map((c) => c.name);
  const known = { classes };
  // pack.md's **ID:** wins; otherwise the ID comes from the pack name
  const [packMdId, setPackMdId] = useState("");
  const draftId = useMemo(() => packIdFor(packMdId || packName || "My Homebrew", content.packs.map((p) => p.id)), [packMdId, packName, content.packs]);
  // an imported pack with the same ID can be updated in place instead of added again
  const target = content.userPacks.find((u) => u.id === packIdFor(packMdId || packName || "My Homebrew", []));
  const canUpdate = !!target && (!cloud || target.owner === session.user?.id || session.isAdmin);
  // updating is the default only when a pack.md names the same ID; a name that merely matches defaults to a new pack
  const [modePick, setMode] = useState<"update" | "new" | null>(null);
  const mode = modePick ?? (packMdId ? "update" : "new");
  const updating = canUpdate && mode === "update";

  const addFiles = async (files: FileList | File[]) => {
    setSaved("");
    // .md files as they are; a .zip is unpacked into the .md files inside it
    const { files: uploads, notes } = await readUploads(files);
    setZipNotes(notes);
    const next: FileReport[] = uploads.map((u) => checkFile(u.name, u.text, draftId, known));
    const merged = [...reports.filter((r) => !next.some((n) => n.file === r.file)), ...next];
    setReports(merged);
    // a pack.md names the collection
    const packEntry = merged.flatMap((r) => r.entries).find((e) => e.type === "Pack");
    if (packEntry && !packName) setPackName(packEntry.name);
    if (packEntry?.fields["id"]) setPackMdId(packEntry.fields["id"]);
  };

  const ok = reports.filter((r) => !r.rejected);
  const entries = ok.flatMap((r) => r.entries).filter((e) => e.type !== "Pack");
  const fixes = ok.reduce((n, r) => n + r.fixes.length, 0);
  const suggestions = ok.flatMap((r) => r.suggestions.map((s) => ({ r, s })));

  // what an update changes, by entry ID (IDs stay the same, so characters keep their picks)
  const files = ok.map((r) => ({ file: r.file, text: r.fixed }));
  const changes = useMemo(
    () => (updating && target ? packChanges(entriesForUserPack(target), entriesForUserPack({ ...target, files })) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updating, target, reports],
  );

  const save = async () => {
    const id = updating ? target!.id : draftId;
    const p: UserPack = { id, name: packName || target?.name || "My Homebrew", files, created: updating ? target!.created : Date.now(), owner: updating ? target!.owner : undefined };
    try {
      await content.saveUserPack(p);
    } catch (e) {
      setSaved(`Couldn’t save the pack: ${(e as Error).message}`);
      return;
    }
    setSaved(updating && changes
      ? `Updated “${p.name}”: ${changes.added.length} added, ${changes.changed.length} changed, ${changes.removed.length} removed, ${changes.same} unchanged.`
      : `Imported ${entries.length} entries into “${p.name}”.`);
    setMode(null);
    setReports([]);
    setPackName("");
    setPackMdId("");
  };

  const download = (r: FileReport) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([r.fixed], { type: "text/markdown" }));
    a.download = r.file;
    a.click();
  };

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1>Content packs</h1>
          <p className="muted" style={{ margin: "6px 0 0", maxWidth: 680 }}>
            {cloud
              ? "Add homebrew or material from books you own as Markdown (.md) files. Packs you import are shared with everyone in this group."
              : "Add homebrew or material from books you own as Markdown (.md) files. Imported content is stored in this browser."}
          </p>
        </div>
        <Link className="btn primary" to="/guide">How to format .md files</Link>
      </div>

      <div className="row">
        <section className="side stack">
          {content.packs.map((p) => (
            <div key={p.id} className="panel" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <strong>{p.name}</strong>
                {p.builtIn ? <span className="tag ok">Built in</span> : (!cloud || p.owner === session.user?.id || session.isAdmin) ? (
                  <button className="btn small" onClick={() => confirm(cloud ? `Remove “${p.name}” for everyone in this group?` : `Remove “${p.name}” from this browser?`) && content.deleteUserPack(p.id).catch((e) => setSaved(String(e.message || e)))}>Remove</button>
                ) : null}
              </div>
              <div className="faint">{p.entries} entries · id <code>{p.id}</code>{p.author ? ` · by ${p.author}` : ""}{p.license ? ` · ${p.license}` : ""}{cloud && !p.builtIn ? ` · uploaded by ${p.owner === session.user?.id ? "you" : session.nameOf(p.owner)}` : ""}</div>
              {!p.builtIn && (
                <button className="btn small" style={{ marginTop: 8 }} onClick={() => {
                  const up = content.userPacks.find((u) => u.id === p.id)!;
                  for (const f of up.files) {
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(new Blob([f.text], { type: "text/markdown" }));
                    a.download = f.file;
                    a.click();
                  }
                }}>Download .md files</button>
              )}
            </div>
          ))}
          <label
            className={`drop ${over ? "over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e3b45a" strokeWidth="1.6" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v4h16v-4" /></svg>
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>Drop .md or .zip files here</span>
            <span className="faint">or click to choose files · a .zip is unpacked and its .md files imported</span>
            <input type="file" multiple accept=".md,.zip,text/markdown,application/zip" className="sr-only" onChange={(e) => e.target.files && addFiles(e.target.files)} />
          </label>
          {zipNotes.length > 0 && <div className="inset" role="status">{zipNotes.map((n) => <div key={n}>{n}</div>)}</div>}
          {saved && <div className="inset" role="status">{saved}</div>}
        </section>

        <section className="grow panel">
          {reports.length === 0 ? (
            <div className="stack">
              <h2>Import preview</h2>
              <p className="muted">Drop one or more .md files, or a .zip of them, to see what will be added before anything is saved. Simple formatting problems are fixed for you; anything uncertain is listed for you to decide.</p>
              <p className="faint">New to the format? The <Link to="/guide">guide</Link> has templates for each type, or open any entry in the <Link to="/library">Library</Link> and view it “As .md”.</p>
            </div>
          ) : (
            <div className="stack" style={{ gap: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <h2>Import preview</h2>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className="tag ok">{entries.length} entries</span>
                  {fixes > 0 && <span className="tag plain">{fixes} auto-fixed</span>}
                  {suggestions.length > 0 && <span className="tag warn">{suggestions.length} to review</span>}
                  {reports.some((r) => r.rejected) && <span className="tag warn">{reports.filter((r) => r.rejected).length} skipped</span>}
                </div>
              </div>
              <label className="field" style={{ maxWidth: 420 }}>
                Pack name
                <input type="text" value={packName} onChange={(e) => setPackName(e.target.value)} placeholder="My Homebrew" />
              </label>
              {target && (
                <div className="choice stack" style={{ gap: 8 }} role="group" aria-label="This pack is already imported">
                  <strong>“{target.name}” is already imported (id <code>{target.id}</code>).</strong>
                  {canUpdate ? (
                    <>
                      <label className="radio"><input type="radio" name="packmode" checked={mode === "update"} onChange={() => setMode("update")} /> Update this pack: replace its files with these. Saved characters keep their picks.</label>
                      <label className="radio"><input type="radio" name="packmode" checked={mode === "new"} onChange={() => setMode("new")} /> Add as a new pack (id <code>{draftId}</code>)</label>
                    </>
                  ) : (
                    <div className="faint">It was uploaded by {session.nameOf(target.owner)}, so only they or the admin can update it. Importing adds a new pack (id <code>{draftId}</code>).</div>
                  )}
                  {changes && (
                    <div className="stack" style={{ gap: 4 }}>
                      <div>
                        <span className="tag ok">{changes.added.length} added</span>{" "}
                        <span className="tag plain">{changes.changed.length} changed</span>{" "}
                        <span className={`tag ${changes.removed.length ? "warn" : "plain"}`}>{changes.removed.length} removed</span>{" "}
                        <span className="faint">{changes.same} unchanged</span>
                      </div>
                      {[["Added", changes.added], ["Changed", changes.changed], ["Removed", changes.removed]].map(([label, list]) => (list as string[]).length > 0 && (
                        <details key={label as string}>
                          <summary className="faint">{label as string}: {(list as string[]).length}</summary>
                          <div style={{ fontSize: 13, marginTop: 4 }}>{(list as string[]).join(", ")}</div>
                        </details>
                      ))}
                      {changes.removed.length > 0 && <div className="faint" style={{ color: "var(--warn)" }}>Characters that use a removed entry lose it (a removed subclass or feat shows as missing).</div>}
                    </div>
                  )}
                </div>
              )}

              {reports.map((r) => (
                <div key={r.file} className="inset stack" style={{ gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <code>{r.file}</code>
                    <div style={{ display: "flex", gap: 6 }}>
                      {!r.rejected && r.fixes.length > 0 && <button className="btn small" onClick={() => download(r)}>Download fixed file</button>}
                      <button className="btn small" onClick={() => setReports(reports.filter((x) => x !== r))}>Remove</button>
                    </div>
                  </div>
                  {r.rejected ? (
                    <div className="faint" style={{ color: "var(--warn)" }}>Skipped: {r.rejected}</div>
                  ) : (
                    <>
                      <table className="data">
                        <thead><tr><th>Entry</th><th>Type</th><th>Status</th></tr></thead>
                        <tbody>
                          {r.entries.map((e, i) => {
                            const issues = r.suggestions.filter((s) => s.line >= (e.line || 0) && s.line < (r.entries[i + 1]?.line || 1e9));
                            const auto = !!e.effects?.length;
                            return (
                              <tr key={i}>
                                <td><strong>{e.name}</strong></td>
                                <td className="muted">{e.type}{e.fields["parent"] ? ` · ${e.fields["parent"]}` : ""}</td>
                                <td>{issues.length ? <span className="tag warn">{issues.length} to review</span> : auto ? <span className="tag ok">Has effects</span> : <span className="tag plain">Text</span>}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {r.fixes.length > 0 && (
                        <details>
                          <summary className="faint">{r.fixes.length} fixed automatically</summary>
                          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13 }}>
                            {r.fixes.map((f, i) => (
                              <li key={i}>Line {f.line}: {f.reason}{f.before && f.after && f.before !== "(blank line)" ? <> — <code>{f.before}</code> → <code>{f.after}</code></> : null}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                      {r.suggestions.map((s) => (
                        <div key={s.id} className="choice" style={{ padding: 12 }}>
                          <div style={{ fontWeight: 600, color: "var(--warn)" }}>Line {s.line}</div>
                          <pre style={{ margin: "6px 0", whiteSpace: "pre-wrap", fontFamily: "var(--mono)", fontSize: 12, background: "var(--bg)", borderRadius: 6, padding: "6px 10px" }}>{s.text}</pre>
                          <div style={{ fontSize: 13 }}>{s.message}</div>
                          {s.replacement && (
                            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                              <button className="btn small primary" onClick={() => setReports(reports.map((x) => (x === r ? applySuggestion(r, s, draftId, known) : x)))}>
                                Use: {s.replacement.replace(/^[-*]\s+/, "").replace(/\*\*/g, "")}
                              </button>
                              <button className="btn small" onClick={() => setReports(reports.map((x) => (x === r ? { ...r, suggestions: r.suggestions.filter((y) => y !== s) } : x)))}>Keep as is</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
                <button className="btn" onClick={() => { setReports([]); setPackMdId(""); setMode(null); }}>Cancel</button>
                <button className="btn primary" disabled={entries.length === 0} onClick={save}>{updating ? `Update “${target!.name}”` : `Import ${entries.length} entries`}</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

