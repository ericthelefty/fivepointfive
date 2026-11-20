/**
 * Build step: parse the bundled content packs into JSON chunks the app loads.
 * Runs before `vite` and `vite build` (see package.json).
 */
import { readdirSync, readFileSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parseFile, type Entry } from "../src/lib/parse.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const PACKS = [{ id: "srd", dir: "content/srd-5.2.1", name: "SRD 5.2.1" }];
const OUT = join(ROOT, "public/data");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : n.endsWith(".md") ? [p] : [];
  });
}

/** Which chunk an entry goes in: the builder needs "core" up front. */
function chunkOf(e: Entry, rel: string): string {
  if (["Class", "Subclass", "Species", "Background", "Feat", "Gear", "Tool"].includes(e.type)) return "core";
  if (rel.startsWith("rules/equipment/") || rel.startsWith("rules/character-creation/")) return "core";
  if (e.type === "Spell") return "spells";
  if (e.type === "Magic Item") return "items";
  if (e.type === "Creature" || e.type === "Creature Group") return "creatures";
  return "rules";
}

mkdirSync(OUT, { recursive: true });
const manifest: Record<string, unknown>[] = [];
for (const pack of PACKS) {
  const base = join(ROOT, pack.dir);
  const chunks: Record<string, Entry[]> = {};
  let n = 0;
  for (const f of walk(base)) {
    const rel = relative(base, f);
    if (rel === "pack.md" || rel === "LICENSE.md") continue;
    for (const e of parseFile(readFileSync(f, "utf8"), pack.id, rel)) {
      (chunks[chunkOf(e, rel)] ||= []).push(e);
      n++;
    }
  }
  const files: Record<string, string> = {};
  for (const [c, list] of Object.entries(chunks)) {
    list.sort((a, b) => a.name.localeCompare(b.name));
    const name = `${pack.id}-${c}.json`;
    writeFileSync(join(OUT, name), JSON.stringify(list));
    files[c] = name;
  }
  manifest.push({ id: pack.id, name: pack.name, entries: n, files });
  console.log(`${pack.name}: ${n} entries ->`, Object.fromEntries(Object.entries(chunks).map(([k, v]) => [k, v.length])));
}
writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 1));
