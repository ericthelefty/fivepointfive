/**
 * Import checks for user .md files.
 *
 * - Auto-fix: mechanical problems with one sensible fix (shown to the user).
 * - Suggest: likely mistakes where the app would be guessing; the user decides.
 * - Reject: only when there is nothing usable (not .md, empty, not text).
 */
import { KNOWN_TYPES, parseFile, splitEntries, type Entry } from "./parse.ts";

export interface Fix {
  line: number;
  before: string;
  after: string;
  reason: string;
}

export interface Suggestion {
  id: string;
  line: number;
  text: string; // the original line
  message: string;
  replacement?: string; // full replacement line, if a one-click fix exists
}

export interface FileReport {
  file: string;
  rejected?: string;
  original: string;
  fixed: string;
  fixes: Fix[];
  suggestions: Suggestion[];
  entries: Entry[];
}

export const ABILITIES = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"];
export const SKILLS = [
  "Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History", "Insight",
  "Intimidation", "Investigation", "Medicine", "Nature", "Perception", "Performance",
  "Persuasion", "Religion", "Sleight of Hand", "Stealth", "Survival",
];
const STATS = [...ABILITIES, "AC", "Speed", "Initiative", "HP", "Hit Points", "Passive Perception"];

/** Effects phrasebook (docs/CONTENT_FORMAT.md §4). */
export const EFFECT_PATTERNS: { rx: RegExp; label: string }[] = [
  { rx: /^[+-]\d+ ([A-Za-z ]+?)( \(max \d+\))?$/i, label: "+N stat" },
  { rx: /^proficiency in .+$/i, label: "proficiency" },
  { rx: /^expertise in .+$/i, label: "expertise" },
  { rx: /^(advantage|disadvantage) on .+$/i, label: "advantage" },
  { rx: /^resistance to .+$/i, label: "resistance" },
  { rx: /^AC = .+$/i, label: "AC formula" },
  { rx: /^.+: .+ uses? per (Short|Long|Short or Long) Rest$/i, label: "resource" },
  { rx: /^choose \d+ .+ from .+$/i, label: "choice" },
  { rx: /^grant .+$/i, label: "grant" },
];
const CONDITION_RX = /\s+(while .+|at level \d+)$/i;

export function lev(a: string, b: string): number {
  a = a.toLowerCase();
  b = b.toLowerCase();
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

export function closest(word: string, options: string[], max = 3): string | null {
  let best: string | null = null;
  let bd = Infinity;
  for (const o of options) {
    const d = lev(word, o);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best && bd > 0 && bd <= Math.max(1, Math.min(max, Math.floor(best.length / 3))) ? best : null;
}

/** Guess a missing Type from the fields an entry has. */
export function inferType(fieldKeys: Set<string>, tagline: string | undefined, hasLevelSections: boolean): string | null {
  const has = (k: string) => fieldKeys.has(k);
  if (has("casting time") || /^(Level \d+ \w+|\w+ Cantrip) \(/.test(tagline || "")) return "Spell";
  if (has("hit point die") || has("primary ability")) return "Class";
  if (has("parent") && hasLevelSections) return "Subclass";
  if (has("ability scores") && has("feat")) return "Background";
  if (has("creature type") || (has("size") && has("speed") && !has("ac"))) return "Species";
  if (has("ac") && has("hp")) return "Creature";
  if (/(Origin|General|Fighting Style|Epic Boon) Feat/.test(tagline || "")) return "Feat";
  if (/(Wondrous Item|Weapon|Armor|Ring|Rod|Staff|Wand|Potion|Scroll).*(Common|Uncommon|Rare|Very Rare|Legendary|Artifact)/.test(tagline || ""))
    return "Magic Item";
  return null;
}

const FIELD_LINE = /^\*\*[^*]+\*\*/;

export function checkFile(
  file: string,
  text: string,
  pack: string,
  known: { classes: string[] } = { classes: [] },
): FileReport {
  const base: FileReport = { file, original: text, fixed: text, fixes: [], suggestions: [], entries: [] };
  if (!/\.md$/i.test(file)) return { ...base, rejected: "Only .md files are accepted." };
  if (/\u0000/.test(text) || /[\x01-\x08\x0e-\x1f]/.test(text.slice(0, 2000)))
    return { ...base, rejected: "This doesn’t look like a text file." };
  if (!text.trim()) return { ...base, rejected: "The file is empty." };

  const fixes: Fix[] = [];
  let src = text.replace(/^﻿/, "");
  if (/\r/.test(src)) {
    src = src.replace(/\r\n?/g, "\n");
  }
  let lines = src.split("\n");

  const fix = (i: number, after: string, reason: string) => {
    if (after !== lines[i]) {
      fixes.push({ line: i + 1, before: lines[i], after, reason });
      lines[i] = after;
    }
  };

  // line-level fixes
  let fence = false;
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i];
    if (/^\s*(```|~~~)/.test(l)) fence = !fence;
    if (fence) continue;
    if (/[ \t]+$/.test(l)) l = l.replace(/[ \t]+$/, "");
    if (l.includes("\t")) l = l.replace(/\t/g, "  ");
    if (l !== lines[i]) {
      // whitespace-only change: apply silently (not worth listing)
      lines[i] = l;
    }
    const h = l.match(/^(#{1,6})([^#\s].*)$/);
    if (h) fix(i, `${h[1]} ${h[2]}`, "Added the space after #");
    const f = lines[i].match(/^\*\*([^*:]+)\*\*:\s*(.*)$/);
    if (f) fix(i, `**${f[1].trim()}:** ${f[2]}`, "Moved the colon inside the bold label");
    const f2 = lines[i].match(/^\*\*([^*]+?)\s+:\*\*\s*(.*)$/);
    if (f2) fix(i, `**${f2[1]}:** ${f2[2]}`, "Removed the space before the colon");
  }

  // no heading at all: wrap as one entry named after the file
  if (!lines.some((l) => /^# \S/.test(l))) {
    const name = file.replace(/\.md$/i, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    lines = [`# ${name}`, "**Type:** Rule", "", ...lines];
    fixes.push({ line: 1, before: "", after: `# ${name}`, reason: "No # heading found: imported as one entry named after the file" });
  }

  // header blocks: remove blank lines between field lines
  for (let i = 0; i < lines.length; i++) {
    if (!/^# \S/.test(lines[i])) continue;
    let j = i + 1;
    let seenField = false;
    while (j < lines.length) {
      const l = lines[j].trim();
      const isField = FIELD_LINE.test(l) && !l.startsWith("***");
      const isTag = /^\*[^*\s][^*]*\*$/.test(l);
      if (isField || isTag) {
        seenField = true;
        j++;
        continue;
      }
      const nxt = (lines[j + 1] || "").trim();
      if (l === "" && seenField && FIELD_LINE.test(nxt) && !nxt.startsWith("***")) {
        fixes.push({ line: j + 1, before: "(blank line)", after: "(removed)", reason: "Removed a blank line inside the field block" });
        lines.splice(j, 1);
        continue;
      }
      break;
    }
  }

  // per entry, in order; `shift` tracks lines inserted above the current entry
  const suggestions: Suggestion[] = [];
  let sid = 0;
  const chunks = splitEntries(lines.join("\n"));
  let shift = 0;
  for (let ci = 0; ci < chunks.length; ci++) {
    const c = chunks[ci];
    const e = parseFile(c.md, pack)[0];
    const start = c.line - 1 + shift;
    const end = ci + 1 < chunks.length ? chunks[ci + 1].line - 1 + shift : lines.length;
    const find = (rx: RegExp) => {
      for (let k = start + 1; k < end; k++) if (rx.test(lines[k])) return k;
      return -1;
    };
    if (!e.fields["type"]) {
      const t = inferType(new Set(Object.keys(e.fields)), e.tagline, e.sections.some((s) => /^Level \d+:/.test(s.title)));
      if (t) {
        lines.splice(start + 1, 0, `**Type:** ${t}`);
        shift++;
        fixes.push({ line: start + 2, before: "", after: `**Type:** ${t}`, reason: `No Type given: assumed ${t} from its fields` });
      } else {
        suggestions.push({ id: `s${sid++}`, line: start + 1, text: lines[start], message: "No **Type:** line, so this imports as a Rule (text only). Add one, for example **Type:** Feat." });
      }
      continue;
    }
    const typeLine = find(/^\*\*Type:\*\*/i);
    if (typeLine >= 0 && !KNOWN_TYPES.includes(e.type)) {
      const guess = closest(e.type, KNOWN_TYPES, 3);
      suggestions.push({
        id: `s${sid++}`, line: typeLine + 1, text: lines[typeLine],
        message: guess ? `“${e.type}” isn’t a known type. Did you mean ${guess}?` : `“${e.type}” isn’t a known type, so this imports as text only.`,
        replacement: guess ? `**Type:** ${guess}` : undefined,
      });
    }
    if (e.type === "Subclass" && e.fields["parent"] && known.classes.length) {
      const p = e.fields["parent"].replace(/^[\w-]+:class\//, "");
      if (!known.classes.some((k) => k.toLowerCase() === p.toLowerCase())) {
        const guess = closest(p, known.classes, 3);
        const pl = find(/^\*\*Parent:\*\*/i);
        suggestions.push({
          id: `s${sid++}`, line: pl + 1, text: lines[pl],
          message: guess ? `No class named “${p}”. Did you mean ${guess}?` : `No class named “${p}” is loaded. The subclass will import but won’t appear under a class.`,
          replacement: guess ? `**Parent:** ${guess}` : undefined,
        });
      }
    }
  }
  return finish();

  function finish(): FileReport {
    // Effects lines
    let inEffects = false;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/^#{2,6}\s/.test(l)) inEffects = /^#{2,6}\s+Effects\s*$/i.test(l);
      else if (/^# /.test(l)) inEffects = false;
      if (!inEffects) continue;
      const m = l.match(/^\s*[-*]\s+(.+)$/);
      if (!m) continue;
      const phrase = m[1].trim().replace(CONDITION_RX, "");
      const ok = EFFECT_PATTERNS.some((p) => p.rx.test(phrase));
      const stat = phrase.match(/^[+-]\d+ ([A-Za-z ]+?)( \(max \d+\))?$/);
      if (stat && !STATS.some((s) => s.toLowerCase() === stat[1].toLowerCase())) {
        const guess = closest(stat[1], STATS, 3);
        suggestions.push({
          id: `s${sid++}`, line: i + 1, text: l,
          message: guess ? `“${stat[1]}” isn’t a stat this system knows. Did you mean ${guess}? Until fixed, this line is text only.` : `“${stat[1]}” isn’t a stat this system knows. This line is text only.`,
          replacement: guess ? l.replace(stat[1], guess) : undefined,
        });
      } else if (!ok) {
        suggestions.push({ id: `s${sid++}`, line: i + 1, text: l, message: "Not a phrase the app can automate yet, so it stays as text. See “Automating rules (Effects)” in the Format guide." });
      }
    }
    // duplicate names within the file
    const fixed = lines.join("\n");
    const entries = parseFile(fixed, pack, file);
    const seen = new Map<string, number>();
    for (const e of entries) {
      const k = `${e.type}:${e.name.toLowerCase()}`;
      if (seen.has(k)) suggestions.push({ id: `s${sid++}`, line: e.line || 1, text: `# ${e.name}`, message: `“${e.name}” appears twice in this file. Both will be kept.` });
      seen.set(k, 1);
    }
    return { file, original: text, fixed, fixes, suggestions, entries };
  }
}

/** Apply a one-click suggestion to a report's fixed text and re-check. */
export function applySuggestion(r: FileReport, s: Suggestion, pack: string, known?: { classes: string[] }): FileReport {
  if (!s.replacement) return r;
  const lines = r.fixed.split("\n");
  if (lines[s.line - 1] === s.text) lines[s.line - 1] = s.replacement;
  const next = checkFile(r.file, lines.join("\n"), pack, known);
  next.original = r.original;
  next.fixes = [...r.fixes, { line: s.line, before: s.text, after: s.replacement, reason: "Applied suggestion" }, ...next.fixes];
  return next;
}
