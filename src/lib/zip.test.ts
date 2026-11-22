import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { readUploads, unzipMarkdown } from "./zip.ts";
import { checkFile } from "./fix.ts";

const zip = (files: Record<string, string>) => zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));

describe("importing a .zip", () => {
  it("unpacks the .md files (folders kept in the name) and skips everything else", () => {
    const data = zip({
      "pack.md": "# My Pack\n**Type:** Pack\n**ID:** mine\n",
      "spells/zap.md": "# Zap\n**Type:** Spell\n*Evocation Cantrip (Wizard)*\n\nZap.",
      "notes.txt": "not content",
      "__MACOSX/spells/._zap.md": "junk",
      ".hidden.md": "junk",
    });
    const r = unzipMarkdown("mine.zip", data);
    expect(r.files.map((f) => f.name)).toEqual(["mine.zip/pack.md", "mine.zip/spells/zap.md"]);
    expect(r.note).toBe("mine.zip: 1 file that isn’t .md skipped.");
    const entries = r.files.flatMap((f) => checkFile(f.name, f.text, "mine").entries);
    expect(entries.map((e) => [e.name, e.type])).toEqual([["My Pack", "Pack"], ["Zap", "Spell"]]);
  });

  it("says so when a zip is broken or has no .md files", () => {
    expect(unzipMarkdown("bad.zip", strToU8("not a zip")).note).toBe("This .zip couldn’t be opened.");
    expect(checkFile("bad.zip", "", "x").rejected).toBe("This .zip couldn’t be opened.");
    expect(unzipMarkdown("empty.zip", zip({ "a.txt": "x" })).note).toBe("empty.zip: 1 file that isn’t .md skipped; no .md files inside.");
  });

  it("reads .md and .zip together, and passes other files on to be rejected", async () => {
    const file = (name: string, body: BlobPart) => new File([body], name);
    const r = await readUploads([file("a.md", "# A\n**Type:** Feat\n"), file("b.zip", zip({ "c.md": "# C\n**Type:** Feat\n" }) as BlobPart), file("d.pdf", "x")]);
    expect(r.files.map((f) => f.name)).toEqual(["a.md", "b.zip/c.md", "d.pdf"]);
    expect(checkFile("d.pdf", "", "x").rejected).toBe("Only .md files (or a .zip of them) are accepted.");
  });
});
