/**
 * Reading what the player drops on the import page: .md files as they are, and .zip files unpacked in the
 * browser into the .md files inside them (folders kept in the name, other files skipped).
 */
import { unzipSync } from "fflate";

export interface Upload {
  /** "fireball.md", or "my-pack.zip/spells/fireball.md" for a file from a zip */
  name: string;
  /** the text; empty for a file that isn't .md (the importer rejects it with a note) */
  text: string;
}

/** Limits against broken or hostile zips: unpacked size and number of files. */
export const ZIP_LIMITS = { bytes: 64 * 1024 * 1024, files: 3000 };

const isMd = (name: string) => /\.md$/i.test(name);
/** macOS adds __MACOSX/ copies and ._ files to zips; hidden files are never content. */
const junk = (path: string) => path.split("/").some((part) => part.startsWith(".") || part === "__MACOSX");

/** The .md files in a zip, plus a note about anything skipped. */
export function unzipMarkdown(zipName: string, data: Uint8Array): { files: Upload[]; note?: string } {
  let total = 0, count = 0, skipped = 0, tooBig = false;
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(data, {
      filter: (f) => {
        if (f.name.endsWith("/") || junk(f.name)) return false;
        if (!isMd(f.name)) { skipped++; return false; }
        if (count + 1 > ZIP_LIMITS.files || total + f.originalSize > ZIP_LIMITS.bytes) { tooBig = true; return false; }
        count++;
        total += f.originalSize;
        return true;
      },
    });
  } catch {
    return { files: [{ name: zipName, text: "" }], note: "This .zip couldn’t be opened." };
  }
  const dec = new TextDecoder("utf-8");
  const files = Object.keys(entries).sort().map((path) => ({ name: `${zipName}/${path}`, text: dec.decode(entries[path]) }));
  const notes = [
    skipped ? `${skipped} file${skipped === 1 ? "" : "s"} that ${skipped === 1 ? "isn’t" : "aren’t"} .md skipped` : "",
    tooBig ? `stopped at ${ZIP_LIMITS.files} files or ${ZIP_LIMITS.bytes / 1024 / 1024} MB` : "",
    files.length ? "" : "no .md files inside",
  ].filter(Boolean);
  return { files, note: notes.length ? `${zipName}: ${notes.join("; ")}.` : undefined };
}

/** Read dropped or chosen files: .md as text, .zip unpacked, anything else passed on to be rejected. */
export async function readUploads(list: FileList | File[]): Promise<{ files: Upload[]; notes: string[] }> {
  const files: Upload[] = [];
  const notes: string[] = [];
  for (const f of Array.from(list)) {
    if (isMd(f.name)) files.push({ name: f.name, text: await f.text() });
    else if (/\.zip$/i.test(f.name)) {
      const r = unzipMarkdown(f.name, new Uint8Array(await f.arrayBuffer()));
      files.push(...r.files);
      if (r.note) notes.push(r.note);
    } else files.push({ name: f.name, text: "" });
  }
  return { files, notes };
}
