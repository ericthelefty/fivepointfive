/**
 * Content parser: Markdown entry files -> structured entries.
 *
 * Used at build time (SRD pack -> JSON) and in the browser (user imports),
 * so both follow exactly the same rules. See docs/CONTENT_FORMAT.md.
 */

export interface Section {
  title: string;
  level: number; // 2..6 (relative to the entry heading)
  md: string; // text under the heading, excluding nested sections
}

export interface Entry {
  id: string;
  pack: string;
  type: string;
  name: string;
  tags: string[];
  tagline?: string;
  /** lower-cased label -> value (Markdown inline) */
  fields: Record<string, string>;
  /** Markdown of the whole entry without the title and header block */
  body: string;
  sections: Section[];
  file?: string;
  line?: number;
}

export interface Table {
  header: string[];
  rows: string[][];
}

export const KNOWN_TYPES = [
  "Class", "Subclass", "Species", "Background", "Feat", "Spell",
  "Magic Item", "Creature", "Creature Group", "Rule", "Gear", "Tool",
  "Weapon", "Armor", "Pack",
];

const FIELD_RX = /^\*\*([^*][^*]*?):?\*\*:?\s*(.*)$/;
const TAGLINE_RX = /^\*([^*\s][^*]*?)\*$/;

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled";
}

export function stripMd(s: string): string {
  return s.replace(/\*+/g, "").replace(/`/g, "").trim();
}

/** Split a file into raw entry chunks at each level-1 heading. */
export function splitEntries(text: string): { md: string; line: number }[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: { md: string; line: number }[] = [];
  let cur: string[] | null = null;
  let start = 0;
  let fence = false;
  lines.forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) fence = !fence;
    if (!fence && /^# \S/.test(l)) {
      if (cur) out.push({ md: cur.join("\n"), line: start + 1 });
      cur = [l];
      start = i;
    } else if (cur) {
      cur.push(l);
    }
  });
  if (cur) out.push({ md: (cur as string[]).join("\n"), line: start + 1 });
  return out;
}

export function parseEntry(md: string, pack: string, file?: string, line?: number): Entry {
  const lines = md.split("\n");
  let title = lines[0].replace(/^#\s+/, "").trim();
  const tags: string[] = [];
  title = title.replace(/\s*\[([^\]]+)\]\s*$/, (_, t) => {
    tags.push(t.trim());
    return "";
  });

  const fields: Record<string, string> = {};
  let tagline: string | undefined;
  let i = 1;
  // header block: field lines and one tagline, no blank lines in between
  for (; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) break;
    const f = l.match(FIELD_RX);
    if (f && !l.startsWith("***")) {
      const key = f[1].trim().toLowerCase();
      if (!(key in fields)) fields[key] = f[2].trim();
      continue;
    }
    const t = l.match(TAGLINE_RX);
    if (t && tagline === undefined) {
      tagline = t[1].trim();
      continue;
    }
    break;
  }
  const bodyLines = lines.slice(i);
  const body = bodyLines.join("\n").trim();

  // sections
  const sections: Section[] = [];
  let curSec: Section | null = null;
  let fence = false;
  const topLines: string[] = [];
  for (const l of bodyLines) {
    if (/^\s*(```|~~~)/.test(l)) fence = !fence;
    const h = !fence && l.match(/^(#{2,6})\s+(.+?)\s*$/);
    if (h) {
      curSec = { title: h[2], level: h[1].length, md: "" };
      sections.push(curSec);
      continue;
    }
    if (curSec) curSec.md += l + "\n";
    else topLines.push(l);
  }
  for (const s of sections) s.md = s.md.trim();

  // creature-style fields after a stat table, and "Core X Traits" fields
  const scanFields = (text: string) => {
    for (const raw of text.split("\n")) {
      const l = raw.trim();
      if (l.startsWith("***")) continue;
      const f = l.match(FIELD_RX);
      if (f) {
        const key = f[1].trim().toLowerCase();
        if (!(key in fields) && key.length <= 40) fields[key] = f[2].trim();
      }
    }
  };
  const type0 = fields["type"] || "";
  if (type0 === "Creature") scanFields(topLines.join("\n"));
  for (const s of sections) if (/^Core .+ Traits$/i.test(s.title)) scanFields(s.md);

  if (fields["tags"]) tags.push(...fields["tags"].split(",").map((t) => t.trim()).filter(Boolean));

  const type = fields["type"] ? stripMd(fields["type"]) : "Rule";
  const id = `${pack}:${slug(type)}/${fields["id"] ? slug(fields["id"]) : slug(title)}`;
  return { id, pack, type, name: title, tags, tagline, fields, body, sections, file, line };
}

export function parseFile(text: string, pack: string, file?: string): Entry[] {
  return splitEntries(text).map((c) => parseEntry(c.md, pack, file, c.line));
}

/** Parse every Markdown pipe table in a block of text. */
export function parseTables(md: string): Table[] {
  const lines = md.split("\n");
  const out: Table[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^\s*\|/.test(lines[i]) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const header = cells(lines[i]);
      const rows: string[][] = [];
      let j = i + 2;
      for (; j < lines.length && /^\s*\|/.test(lines[j]); j++) rows.push(cells(lines[j]));
      out.push({ header, rows });
      i = j - 1;
    }
  }
  return out;
}

function cells(l: string): string[] {
  const s = l.trim().replace(/^\|/, "").replace(/\|$/, "");
  const out: string[] = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && s[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (s[i] === "|") {
      out.push(cur.trim());
      cur = "";
    } else cur += s[i];
  }
  out.push(cur.trim());
  return out;
}

/** "Level 3: Feature Name" headings (class and subclass features). */
export function features(e: Entry): { level: number; name: string; md: string }[] {
  const out: { level: number; name: string; md: string }[] = [];
  e.sections.forEach((s, idx) => {
    const m = s.title.match(/^Level (\d+):\s*(.+)$/);
    if (!m) return;
    // include nested sub-sections (e.g. a table under the feature)
    let md = s.md;
    for (let k = idx + 1; k < e.sections.length && e.sections[k].level > s.level; k++) {
      md += `\n\n${"#".repeat(Math.min(6, e.sections[k].level + 1))} ${e.sections[k].title}\n\n${e.sections[k].md}`;
    }
    out.push({ level: +m[1], name: m[2], md });
  });
  return out;
}

/** Spell tagline: "Level 3 Evocation (Sorcerer, Wizard)" or "Evocation Cantrip (Wizard)". */
export function spellInfo(e: Entry): { level: number; school: string; classes: string[] } | null {
  const t = e.tagline || "";
  let m = t.match(/^Level (\d+) (\w+) \(([^)]*)\)/);
  if (m) return { level: +m[1], school: m[2], classes: m[3].split(",").map((c) => c.trim()) };
  m = t.match(/^(\w+) Cantrip \(([^)]*)\)/);
  if (m) return { level: 0, school: m[1], classes: m[2].split(",").map((c) => c.trim()) };
  return null;
}
