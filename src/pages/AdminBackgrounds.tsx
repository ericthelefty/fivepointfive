import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  CUSTOM_BACKGROUND, LIBRARY_PREFIX, SHEET_BACKGROUNDS, StoredThumb, addLibraryBackground, deleteLibraryBackground,
  listUploadedFiles, refreshLibrary, removeBackground, renameLibraryBackground, useLibraryBackgrounds,
  type LibraryBackground, type StoredFile,
} from "../lib/backgrounds.ts";
import { useCharacters, type CharRow } from "../lib/characters.tsx";
import { useSession } from "../lib/session.tsx";

const kb = (n?: number) => (n === undefined ? "" : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

/** One image in the list, wherever it came from. */
interface Row {
  key: string;
  thumb: ReactNode;
  name: ReactNode;
  source: ReactNode;
  usedBy: CharRow[];
  /** Shown in the "Used by" column when nobody uses it. */
  unused?: string;
  actions: ReactNode;
}

/**
 * Admins: every sheet background on the instance (built in, the shared library, and each character's upload),
 * which characters use each one, and adding, renaming, hiding or deleting them.
 */
export default function AdminBackgrounds() {
  const session = useSession();
  const chars = useCharacters();
  const library = useLibraryBackgrounds();
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string }>();
  const fileRef = useRef<HTMLInputElement>(null);
  const hidden = session.settings.hidden_backgrounds || [];

  const loadFiles = useCallback(async () => {
    try {
      setFiles(await listUploadedFiles());
    } catch (e) {
      setMsg(`Couldn’t list uploaded images: ${e instanceof Error ? e.message : e}`);
    }
  }, []);
  useEffect(() => {
    loadFiles();
    refreshLibrary();
  }, [loadFiles]);

  const run = async (key: string, f: () => Promise<void>) => {
    setMsg("");
    setBusy(key);
    try {
      await f();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };

  const using = (id: string) => chars.rows.filter((r) => r.c.sheetBackground === id);
  const names = (rs: CharRow[]) => rs.map((r) => r.c.name || "Unnamed").join(", ");

  const add = (file: File) =>
    run("add", async () => {
      await addLibraryBackground(file, name);
      setName("");
    });

  const toggleHidden = (id: string) =>
    run(id, () => session.setSetting("hidden_backgrounds", hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id]));

  const deleteLibrary = (b: LibraryBackground) => {
    const users = using(LIBRARY_PREFIX + b.id);
    const warn = users.length ? `\n\nIn use by ${names(users)}. Their sheets will go back to no background.` : "";
    if (!confirm(`Delete “${b.name}” from the library? This can’t be undone.${warn}`)) return;
    run(b.id, async () => {
      await deleteLibraryBackground(b);
      for (const r of users) chars.save({ ...r.c, sheetBackground: undefined });
    });
  };

  const deleteUpload = (f: StoredFile, owner?: CharRow) => {
    const isToken = owner?.c.tokenImage === `storage:${f.path}`;
    const who = owner ? `${owner.c.name || "this character"}’s ${isToken ? "token picture" : "uploaded image"}` : "this leftover image";
    const warn = isToken ? ` ${owner!.c.name || "The character"}’s token goes back to initials.` : owner?.c.sheetBackground === CUSTOM_BACKGROUND ? ` ${owner.c.name || "The character"}’s sheet will go back to no background.` : "";
    if (!confirm(`Delete ${who}? This can’t be undone.${warn}`)) return;
    run(f.path, async () => {
      await removeBackground(`storage:${f.path}`);
      if (owner) {
        const c = owner.c;
        if (isToken) chars.save({ ...c, tokenImage: undefined });
        else chars.save({ ...c, customBackground: undefined, sheetBackground: c.sheetBackground === CUSTOM_BACKGROUND ? undefined : c.sheetBackground });
      }
      await loadFiles();
    });
  };

  const saveName = () => {
    if (!renaming) return;
    const r = renaming;
    run(r.id, async () => {
      await renameLibraryBackground(r.id, r.name);
      setRenaming(undefined);
    });
  };

  const builtIn: Row[] = SHEET_BACKGROUNDS.map((b) => {
    const off = hidden.includes(b.id);
    return {
      key: b.id,
      thumb: <span className="admbg-thumb" style={{ backgroundImage: `url(${b.thumb})` }} />,
      name: <>{b.name}{off && <span className="faint"> · hidden</span>}</>,
      source: "Built in",
      usedBy: using(b.id),
      unused: off ? "Hidden from the picker" : undefined,
      actions: (
        <button className="btn small" disabled={busy === b.id} onClick={() => toggleHidden(b.id)}
          title={off ? "Offer this image in the sheet background picker again." : "Take this image out of the picker. Built-in images can’t be deleted, only hidden."}>
          {off ? "Show in picker" : "Hide"}
        </button>
      ),
    };
  });

  const lib: Row[] = library.map((b) => ({
    key: b.id,
    thumb: <StoredThumb className="admbg-thumb" stored={`storage:${b.thumb || b.path}`} />,
    name: renaming?.id === b.id ? (
      <form style={{ display: "flex", gap: 6 }} onSubmit={(e) => { e.preventDefault(); saveName(); }}>
        <input type="text" value={renaming.name} autoFocus aria-label="New name" onChange={(e) => setRenaming({ id: b.id, name: e.target.value })} style={{ minWidth: 0 }} />
        <button className="btn small" type="submit">Save</button>
        <button className="btn small" type="button" onClick={() => setRenaming(undefined)}>Cancel</button>
      </form>
    ) : b.name,
    source: <>Library · added by {session.nameOf(b.created_by || undefined)}{b.created_at && <span className="faint"> · {new Date(b.created_at).toLocaleDateString()}</span>}</>,
    usedBy: using(LIBRARY_PREFIX + b.id),
    actions: (
      <>
        <button className="btn small" disabled={!!busy} onClick={() => setRenaming({ id: b.id, name: b.name })}>Rename</button>{" "}
        <button className="btn small" disabled={busy === b.id} onClick={() => deleteLibrary(b)}>Delete</button>
      </>
    ),
  }));

  const uploads: Row[] = files.map((f) => {
    const owner = chars.rows.find((r) => r.c.customBackground === `storage:${f.path}` || r.c.tokenImage === `storage:${f.path}`);
    const isToken = owner?.c.tokenImage === `storage:${f.path}`;
    const folderChar = chars.get(f.path.split("/")[0]);
    return {
      key: f.path,
      thumb: <StoredThumb className="admbg-thumb" stored={`storage:${f.path}`} />,
      name: owner ? (
        <>{isToken ? "Token picture" : "Image"} for <Link to={`/sheet/${owner.c.id}`}>{owner.c.name || "Unnamed"}</Link></>
      ) : (
        <>Leftover image{folderChar ? <> from <Link to={`/sheet/${folderChar.c.id}`}>{folderChar.c.name || "Unnamed"}</Link></> : <span className="faint"> · its character was deleted</span>}</>
      ),
      source: <>Uploaded{owner?.owner ? <> · {session.nameOf(owner.owner)}’s character</> : ""}<span className="faint"> · {kb(f.size)}{f.created_at ? ` · ${new Date(f.created_at).toLocaleDateString()}` : ""}</span></>,
      usedBy: owner && (isToken || owner.c.sheetBackground === CUSTOM_BACKGROUND) ? [owner] : [],
      unused: owner ? "Uploaded, but not picked" : "Not attached to any character",
      actions: <button className="btn small" disabled={busy === f.path} onClick={() => deleteUpload(f, owner)}>Delete</button>,
    };
  });

  const inUse = [...builtIn, ...lib, ...uploads].filter((r) => r.usedBy.length).length;

  const group = (title: string, rows: Row[], empty: string) => (
    <>
      <tr className="admbg-group"><th colSpan={5}>{title}</th></tr>
      {rows.length === 0 && <tr><td colSpan={5} className="muted">{empty}</td></tr>}
      {rows.map((r) => (
        <tr key={r.key}>
          <td>{r.thumb}</td>
          <td>{r.name}</td>
          <td>{r.source}</td>
          <td>
            {r.usedBy.length ? (
              <span className="admbg-used">
                <span className="admbg-dot" aria-hidden="true" />
                <span>
                  {r.usedBy.map((u, i) => (
                    <span key={u.c.id}>{i > 0 && ", "}<Link to={`/sheet/${u.c.id}`}>{u.c.name || "Unnamed"}</Link></span>
                  ))}
                </span>
              </span>
            ) : (
              <span className="faint">{r.unused || "Not in use"}</span>
            )}
          </td>
          <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>{r.actions}</td>
        </tr>
      ))}
    </>
  );

  return (
    <section className="panel stack">
      <h2>Sheet backgrounds</h2>
      <p className="muted" style={{ margin: 0 }}>
        Images in the library show up in every member’s Sheet background picker. Each character can also upload one image of its own.
        {" "}{inUse} of {builtIn.length + lib.length + uploads.length} images are in use.
      </p>
      {msg && <div className="inset" role="status">{msg}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" aria-label="Name for the new image" />
        <button className="btn primary small" disabled={busy === "add"} onClick={() => fileRef.current?.click()}>{busy === "add" ? "Uploading…" : "Add an image to the library"}</button>
        <input ref={fileRef} type="file" accept="image/*" hidden aria-label="Image to add to the library"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) add(f); }} />
        <span className="faint">It’s resized and saved as a WebP file.</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="data admbg">
          <thead><tr><th style={{ width: 84 }}></th><th>Image</th><th>Source</th><th>Used by</th><th></th></tr></thead>
          <tbody>
            {group("Built in", builtIn, "")}
            {group("Library", lib, "No library images yet.")}
            {group("Character uploads", uploads, "No character has uploaded an image.")}
          </tbody>
        </table>
      </div>
    </section>
  );
}
