/**
 * Guards for two kinds of style bug found by hand in light mode:
 *
 * 1. A rule in sheet.css that isn't scoped to the sheet leaks onto every page. A bare `.pill` rule meant for the
 *    encounter inventory editor turned every pill button in the app dark, in light mode unreadable. Every sheet.css
 *    selector must start with `.sheetv` (or the light theme's `.sheetv`), or name one of the sheet's own components
 *    listed below, and none of those may be a component styles.css defines for the whole app.
 *
 * 2. Text on a coloured background must read in both themes. Every rule that sets both a solid background and a text
 *    colour is checked in the dark theme and in the light theme (with that theme's colours and its overrides for the
 *    same selector), and must reach a contrast ratio of 3:1, the WCAG minimum for large or bold text such as buttons.
 *    The sheet's selected filter was dark text on the light theme's dark gold (3.07:1 with the old colour, 2.7 today).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

interface Rule { selectors: string[]; decls: Record<string, string>; file: string }

/** A selector list split at its top-level commas (not those inside :is(), :not()…). */
function splitSelectors(head: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of head) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && !depth) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

/** The style rules of a stylesheet, flattened out of @media blocks; @keyframes are skipped. */
function rulesOf(file: string): Rule[] {
  const css = read(file).replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Rule[] = [];
  const walk = (s: string) => {
    let i = 0;
    while (i < s.length) {
      const open = s.indexOf("{", i);
      if (open < 0) break;
      const head = s.slice(i, open).trim();
      // the matching close brace
      let depth = 1, j = open + 1;
      while (j < s.length && depth) { if (s[j] === "{") depth++; else if (s[j] === "}") depth--; j++; }
      const body = s.slice(open + 1, j - 1);
      if (head.startsWith("@media") || head.startsWith("@supports")) walk(body);
      else if (!head.startsWith("@")) {
        const decls: Record<string, string> = {};
        for (const d of body.split(";")) {
          const k = d.indexOf(":");
          if (k > 0) decls[d.slice(0, k).trim()] = d.slice(k + 1).trim().replace(/\s*!important$/, "");
        }
        out.push({ selectors: splitSelectors(head), decls, file });
      }
      i = j;
    }
  };
  walk(css);
  return out;
}

const sheet = rulesOf("src/sheet.css");
const app = rulesOf("src/styles.css");
const LIGHT = ':root[data-theme="light"]';

// ------------------------------------------------------------------ 1. scoping
/**
 * The sheet's own components that sheet.css styles without `.sheetv`, because they're also used outside the sheet
 * (the encounter pages and their inventory editor) and named so nothing else clashes. Add to this only for a new
 * component of the sheet's own, with a name no other page uses.
 */
const SHEET_OWN = new Set([
  "invtog", "inved", "invsec", "hidl", "invhidh", "invadd", "invmatch", "pills", "tier", "tierh", "dcb", "lootcoins",
  "custf", "custrow", "custnote", "custstar", "encsave", "sbtn", "sheetbg",
]);

/** Whole selectors sheet.css may set outside the sheet, each with its reason. */
const SHEET_GLOBAL = new Set([
  "body.sheetbg-on", // the page behind a sheet with a background image goes see-through so the image shows
]);

/** The first class a selector names (`.inved .coins input` → inved), ignoring the light theme's prefix. */
const firstClass = (sel: string) => sel.replace(LIGHT, "").trim().match(/^\.([\w-]+)/)?.[1];
const scoped = (sel: string) => /^(:root\[data-theme="light"\]\s+)?\.sheetv\b/.test(sel) || sel === ".sheetv";
/** Components styles.css defines for the whole app (`.btn`, `.pill`, `.panel`…). */
const appClasses = new Set(app.flatMap((r) => r.selectors.map((s) => (/^\.[\w-]+(\[|:|\.|$|\s)/.test(s) ? firstClass(s) : undefined)).filter(Boolean) as string[]));

describe("sheet.css stays on the sheet", () => {
  it("every rule is scoped to .sheetv or names one of the sheet's own components", () => {
    const leaks = sheet.flatMap((r) => r.selectors.filter((s) => !scoped(s) && !SHEET_GLOBAL.has(s) && !SHEET_OWN.has(firstClass(s) || "")));
    expect(leaks, `These sheet.css selectors apply to every page: scope them under .sheetv, or (for a component of the sheet's own) add its class to SHEET_OWN in this test:\n${leaks.join("\n")}`).toEqual([]);
  });

  it("restyles no component the whole app shares", () => {
    const clash = sheet.flatMap((r) => r.selectors.filter((s) => !scoped(s) && appClasses.has(firstClass(s) || "")));
    expect(clash, `These sheet.css selectors restyle a component styles.css defines for every page (scope them under .sheetv or a parent of the sheet's own):\n${clash.join("\n")}`).toEqual([]);
    const shared = [...SHEET_OWN].filter((c) => appClasses.has(c));
    expect(shared, `SHEET_OWN lists classes styles.css also defines: ${shared.join(", ")}`).toEqual([]);
  });
});

// ------------------------------------------------------------------ 2. contrast
type RGB = [number, number, number];

/** The custom properties each theme sets (the app's and the sheet's), dark first, then the light theme's on top. */
function themeVars(theme: "dark" | "light"): Record<string, string> {
  const vars: Record<string, string> = {};
  const take = (rules: Rule[], sel: string) => rules.filter((r) => r.selectors.includes(sel)).forEach((r) => Object.entries(r.decls).forEach(([k, v]) => { if (k.startsWith("--")) vars[k] = v; }));
  take(app, ":root"); take(sheet, ".sheetv");
  if (theme === "light") { take(app, LIGHT); take(sheet, `${LIGHT} .sheetv`); }
  return vars;
}

const HEX = /#([0-9a-f]{3,8})\b/i;
/** A colour value as RGB (and its alpha), following var() with its fallback; the first colour of a gradient. */
function color(v: string | undefined, vars: Record<string, string>, depth = 0): [RGB, number] | null {
  if (!v || depth > 8) return null;
  const vm = v.match(/var\((--[\w-]+)(?:,\s*([^)]+))?\)/);
  if (vm && (/^var\(/.test(v.trim()) || !HEX.test(v.slice(0, vm.index)))) return color(vars[vm[1]] ?? vm[2], vars, depth + 1);
  const rgba = v.match(/rgba?\(([^)]+)\)/);
  const hex = v.match(HEX);
  if (rgba && (!hex || rgba.index! < hex.index!)) {
    const p = rgba[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return [[p[0], p[1], p[2]], p.length > 3 ? p[3] : 1];
  }
  if (hex) {
    let h = hex[1];
    if (h.length <= 4) h = [...h].map((c) => c + c).join("");
    const a = h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1;
    return [[parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)], a];
  }
  return null;
}
const lum = ([r, g, b]: RGB) => {
  const f = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a: RGB, b: RGB) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

/**
 * Rules whose colours aren't text on that background, so contrast doesn't apply (each with the reason). Keep this
 * short: a real button or label belongs in the check.
 */
const MIN = 3.5; // the light theme's gold (#8a5a12) under near-black text is 3.05:1 and reads badly, so a little above WCAG's large-text 3:1
const NOT_TEXT = new Set([
  ".sheetv .sbtn:disabled", // shown at reduced opacity on purpose
]);

describe("text on a coloured background reads in both themes", () => {
  for (const theme of ["dark", "light"] as const) {
    it(`${theme} theme: every rule with a solid background and a text colour reaches ${MIN}:1`, () => {
      const vars = themeVars(theme);
      const all = [...app, ...sheet];
      const fails: string[] = [];
      for (const r of all) {
        for (const sel of r.selectors) {
          if (sel.startsWith(LIGHT) || NOT_TEXT.has(sel)) continue;
          // this selector's colours, then the light theme's overrides for it
          const decls: Record<string, string> = {};
          const apply = (s: string) => all.filter((x) => x.selectors.includes(s)).forEach((x) => Object.assign(decls, x.decls));
          apply(sel);
          if (theme === "light") apply(`${LIGHT} ${sel}`);
          const bgv = decls.background ?? decls["background-color"];
          const fgv = decls.color;
          if (!bgv || !fgv || /url\(|transparent|none|inherit|currentColor/i.test(bgv + fgv)) continue;
          const bg = color(bgv, vars), fg = color(fgv, vars);
          if (!bg || !fg || bg[1] < 1) continue; // a see-through background depends on what's under it
          const fgOn: RGB = [0, 1, 2].map((i) => fg[0][i] * fg[1] + bg[0][i] * (1 - fg[1])) as RGB;
          const cr = contrast(fgOn, bg[0]);
          if (cr < MIN) fails.push(`${cr.toFixed(2)}:1  ${sel}  (${r.file})`);
        }
      }
      expect([...new Set(fails)], `Text too close in colour to its background in the ${theme} theme. Fix the colours, or for the light theme add a ${LIGHT} override for the selector:\n${[...new Set(fails)].join("\n")}`).toEqual([]);
    });
  }
});
