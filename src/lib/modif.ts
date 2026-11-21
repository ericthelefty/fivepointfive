/**
 * Modif engine: reads the YAML blocks under each entry's `## Effects` heading
 * and works out what they do to a character (see docs/MODIF.md).
 *
 * This first version covers the blocks the sheet can act on today:
 * proficiencies, choices, resources, actions, AC/initiative/speed bonuses,
 * alternative AC, Advantage on rolls, critical range, Extra Attack and
 * death-save rules. Every other block is listed as a reminder for the player,
 * so nothing written in an entry is silently lost.
 *
 * Entries without Effects keep working the old way (rules.ts reads their text).
 */
import { parse as parseYaml, YAMLParseError } from "yaml";
import { features, slug, stripMd, type Entry } from "./parse.ts";
import { classTable, tableRow, mod, profBonus, finalScores, type Character } from "./rules.ts";
import { ABILITIES, SKILLS, closest } from "./fix.ts";
import { SUBCLASS_LEVEL, classInfos } from "./multiclass.ts";

// ------------------------------------------------------------------ vocabulary
/** The 70 block types of Modif 0.6. */
export const BLOCKS = [
  "proficiency", "expertise", "mastery", "language", "half-proficiency", "sense", "speed", "size", "defense", "note",
  "trait", "option", "hit-die", "multiclass", "equipment", "bonus", "set", "base", "advantage", "disadvantage",
  "cancel-advantage", "crit-range", "extra-attack", "damage-die", "use-ability", "damage-type", "ignore-resistance",
  "score", "score-max", "roll-floor", "die-floor", "maximize", "reroll", "save-rule", "treat-roll", "choose",
  "resource", "cast-list", "convert", "action", "toggle", "narrative", "suppress", "aura", "zone", "remove-condition",
  "limit", "grant-spell", "spell-list", "spellcasting", "scaling", "target-effects", "self-effects", "form", "summon",
  "condition", "charges", "variant", "container", "weapon-rule", "craft", "auto-fail", "breaks-concentration", "rest",
  "poison", "weapon-property", "curse", "modify", "replace", "trigger",
];
const BLOCK_SET = new Set(BLOCKS);
const RESERVED_KEYS = new Set(["on", "off", "yes", "no", "y", "n", "true", "false"]);

export const ABBR3: Record<string, string> = {
  str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma",
};
let skillMap: Map<string, string> | null = null;
const skillBySlug = (x: string) => (skillMap ||= new Map(SKILLS.map((s) => [slug(s), s]))).get(x);

// ------------------------------------------------------------------ parsing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Val = any;
export interface Block { type: string; v: Val }
export interface EffectProblem { line?: number; message: string; found?: string; suggestion?: string }

const cache = new Map<string, { blocks: Block[]; problems: EffectProblem[] }>();

/** Parse and check one Effects YAML text. Results are cached by text. */
export function readBlocks(yaml: string): { blocks: Block[]; problems: EffectProblem[] } {
  const hit = cache.get(yaml);
  if (hit) return hit;
  const problems: EffectProblem[] = [];
  const blocks: Block[] = [];
  let doc: Val;
  try {
    doc = parseYaml(yaml, { uniqueKeys: true });
  } catch (err) {
    const e = err as YAMLParseError;
    problems.push({ line: e.linePos?.[0]?.line, message: `This isn’t valid YAML: ${String(e.message).split("\n")[0]}` });
    doc = null;
  }
  if (doc != null && !Array.isArray(doc)) problems.push({ message: "Effects must be a list: start each block with “- ”." });
  for (const item of Array.isArray(doc) ? doc : []) {
    if (!item || typeof item !== "object" || Array.isArray(item) || Object.keys(item).length !== 1) {
      problems.push({ message: `Each list item must be one block, like “- bonus: { to: ac, value: 1 }”. Found: ${JSON.stringify(item).slice(0, 60)}` });
      continue;
    }
    const [type, v] = Object.entries(item)[0];
    if (!BLOCK_SET.has(type)) {
      const guess = closest(type, BLOCKS, 3);
      problems.push({ message: guess ? `“${type}” isn’t a Modif block. Did you mean ${guess}?` : `“${type}” isn’t a Modif block.`, found: type, suggestion: guess || undefined });
      continue;
    }
    const bad = reservedKey(v);
    if (bad) problems.push({ message: `“${bad}” can’t be used as a key (YAML reads it as true/false). See Modif §2.2.` });
    blocks.push({ type, v });
  }
  const out = { blocks, problems };
  cache.set(yaml, out);
  return out;
}

function reservedKey(v: Val): string | null {
  if (!v || typeof v !== "object") return null;
  if (Array.isArray(v)) {
    for (const x of v) {
      const r = reservedKey(x);
      if (r) return r;
    }
    return null;
  }
  for (const [k, x] of Object.entries(v)) {
    if (RESERVED_KEYS.has(k.toLowerCase())) return k;
    const r = reservedKey(x);
    if (r) return r;
  }
  return null;
}

// ------------------------------------------------------------------ values
export interface Env {
  /** Level of the class whose entry is being read (total level for other entries). */
  level: number;
  total: number;
  pb: number;
  mods: Record<string, number>;
  scores: Record<string, number>;
  classLevels: Record<string, number>; // slug(class name) -> level
  table: Record<string, string>; // the entry's class-table row at `level`
}

/** A value as dice plus a flat number: "1d10 + level:fighter" -> { dice: ["1d10"], flat: 5 }. */
export interface Amount { dice: string[]; flat: number }

export function evalAmount(expr: Val, env: Env): Amount | null {
  if (typeof expr === "number") return { dice: [], flat: expr };
  if (expr && typeof expr === "object" && expr.steps) {
    let best = 0;
    for (const [lv, n] of Object.entries(expr.steps)) if (env.level >= +lv) best = +(n as number);
    return { dice: [], flat: best };
  }
  if (typeof expr !== "string") return null;
  const src = expr.trim();
  let pos = 0;
  const peek = () => {
    while (src[pos] === " ") pos++;
    return src[pos];
  };
  const ref = (word: string): Amount | null => {
    const [k, ...rest] = word.split(":");
    const arg = rest.join(":").trim();
    if (k === "prof" && !arg) return { dice: [], flat: env.pb };
    if (k === "level" && !arg) return { dice: [], flat: env.total };
    if (k === "level") return { dice: [], flat: env.classLevels[slug(arg)] ?? 0 };
    if (k === "mod" && ABBR3[arg]) return { dice: [], flat: env.mods[ABBR3[arg]] };
    if (k === "score" && ABBR3[arg]) return { dice: [], flat: env.scores[ABBR3[arg]] };
    if (k === "table") {
      const col = Object.keys(env.table).find((h) => h.toLowerCase() === arg.toLowerCase());
      const cell = col ? env.table[col] : undefined;
      if (cell === undefined) return null;
      const dm = cell.match(/^(\d*)d(\d+)$/i);
      if (dm) return { dice: [`${dm[1] || 1}d${dm[2]}`], flat: 0 };
      const n = cell.replace(/[+,]/g, "").match(/^-?\d+/);
      return n ? { dice: [], flat: +n[0] } : { dice: [], flat: 0 };
    }
    const dm = word.match(/^(\d*)d(\d+)$/);
    if (dm) return { dice: [`${dm[1] || 1}d${dm[2]}`], flat: 0 };
    if (/^\d+(\.\d+)?$/.test(word)) return { dice: [], flat: +word };
    return null;
  };
  const add = (a: Amount, b: Amount, sign: 1 | -1): Amount | null =>
    sign === -1 && b.dice.length ? null : { dice: [...a.dice, ...b.dice], flat: a.flat + sign * b.flat };
  const atom = (): Amount | null => {
    const ch = peek();
    if (ch === "(") {
      pos++;
      const v = sum();
      if (peek() !== ")") return null;
      pos++;
      return v;
    }
    if (ch === "-") {
      pos++;
      const v = atom();
      return v && !v.dice.length ? { dice: [], flat: -v.flat } : null;
    }
    const fn = src.slice(pos).match(/^(max|min|floor|ceil)\s*\(/);
    if (fn) {
      pos += fn[0].length;
      const args: number[] = [];
      for (;;) {
        const v = sum();
        if (!v || v.dice.length) return null;
        args.push(v.flat);
        if (peek() === ",") { pos++; continue; }
        if (peek() === ")") { pos++; break; }
        return null;
      }
      const f = fn[1];
      const n = f === "max" ? Math.max(...args) : f === "min" ? Math.min(...args) : f === "floor" ? Math.floor(args[0]) : Math.ceil(args[0]);
      return { dice: [], flat: n };
    }
    // a word runs to the next operator; table columns may contain spaces
    const m = src.slice(pos).match(/^[^+*/(),-]+/);
    if (!m) return null;
    pos += m[0].length;
    return ref(m[0].trim());
  };
  const product = (): Amount | null => {
    let v = atom();
    while (v) {
      const ch = peek();
      if (ch !== "*" && ch !== "/") break;
      pos++;
      const w = atom();
      if (!w || w.dice.length || v.dice.length) return null;
      v = { dice: [], flat: ch === "*" ? v.flat * w.flat : Math.floor(v.flat / w.flat) };
    }
    return v;
  };
  const sum = (): Amount | null => {
    let v = product();
    while (v) {
      const ch = peek();
      if (ch !== "+" && ch !== "-") break;
      pos++;
      const w = product();
      if (!w) return null;
      v = add(v, w, ch === "+" ? 1 : -1);
    }
    return v;
  };
  const v = sum();
  return v && pos >= src.length ? v : null;
}

export function evalNumber(expr: Val, env: Env): number | null {
  const a = evalAmount(expr, env);
  return a && !a.dice.length ? a.flat : null;
}

/** "1d10+5" for display and rolling. */
export function amountText(a: Amount): string {
  const parts = [...a.dice];
  if (a.flat || !parts.length) parts.push(String(a.flat));
  return parts.join("+").replace(/\+-/g, "-");
}

// ------------------------------------------------------------------ the character
export interface ClassRef { cls: Entry; sub?: Entry; level: number; starting: boolean; skills: string[] }

export interface ModifCtx {
  c: Character;
  classes: ClassRef[];
  species?: Entry;
  background?: Entry;
  entries: Entry[];
  byId: (id?: string) => Entry | undefined;
}

export interface ChoiceOption { value: string; label: string }

export interface PendingChoice {
  key: string; // `${entry id}#${choice id}`, the key in Character.choices
  entry: Entry;
  feature: string;
  label: string;
  count: number;
  options: ChoiceOption[] | null; // null: the app can't list them; pick by hand
  chosen: string[];
  /** Where the answer is stored when it isn't Character.choices (existing builder fields). */
  storedIn?: "classSkills" | "extraSkills";
  /** The class, subclass, species or background this choice comes from (through any feats). */
  origin: string;
  /** Feat slots (Ability Score Improvement, Epic Boon) and the choices inside the feat taken there share this key. */
  slot?: string;
  /** For a feat slot: the class level it's taken at. */
  level?: number;
  /** For ability increases: how many points, at most how many on one ability, and the score cap. */
  amounts?: { points: number; perAbility: number; max: number; sets: number[][] };
}

/** A feat the character has, and the slot it was taken in (if any). */
export interface FeatPick { feat: Entry; slot?: string; level?: number; className?: string }

/** One ability score increase, applied in order after the background's (Modif §6.7). */
export interface ScoreStep { ability: string; amount: number; max: number; source: string }

export interface ModifResource {
  key: string;
  name: string;
  max: number;
  recover: "short" | "shortOne" | "long";
  entryId: string;
}

export interface ModifAction {
  id: string;
  name: string;
  source: string;
  activation: string;
  resource?: string;
  heal?: string;
  text?: string;
}

export interface Reminder { source: string; feature: string; text: string }

export interface FeatureStatus { entryId: string; feature: string; status: "automated" | "partly automated" | "not automated" }

export interface ModifResult {
  /** Entries whose Effects were read: rules.ts trusts them over text reading. */
  encoded: Set<string>;
  saves: Set<string>;
  skills: Set<string>;
  weapons: Set<string>;
  armor: Set<string>;
  tools: Set<string>;
  masteries: string[];
  feats: Entry[];
  featPicks: FeatPick[];
  /** Final ability scores: base + background increase (max 20), then every ScoreStep. */
  scores: Record<string, number>;
  scoreSteps: ScoreStep[];
  size?: string;
  resources: ModifResource[];
  actions: ModifAction[];
  acBonuses: { value: number; armor?: string[]; unarmored?: boolean; noShield?: boolean; source: string }[];
  acBases: { expr: Val; noShield: boolean; source: string }[];
  bonuses: { to: string; value: number; source: string }[];
  attackBonuses: { value: number; ranged?: boolean; melee?: boolean; source: string }[];
  advantages: { roll: string; source: string }[];
  critRange: number;
  attacksPerAction: number;
  treatRolls: { roll: string; min: number; max: number; as: number; source: string }[];
  onLongRest: { regain: string; source: string }[];
  reminders: Reminder[];
  pending: PendingChoice[];
  features: FeatureStatus[];
  problems: { entry: string; feature: string | null; problem: EffectProblem }[];
}

export function emptyResult(): ModifResult {
  return {
    encoded: new Set(), saves: new Set(), skills: new Set(), weapons: new Set(), armor: new Set(), tools: new Set(),
    masteries: [], feats: [], featPicks: [], scores: {}, scoreSteps: [], resources: [], actions: [], acBonuses: [], acBases: [], bonuses: [], attackBonuses: [],
    advantages: [], critRange: 20, attacksPerAction: 1, treatRolls: [], onLongRest: [], reminders: [], pending: [],
    features: [], problems: [],
  };
}

const featureLevel = (title: string | null): number => {
  const m = title?.match(/^Level (\d+):/);
  return m ? +m[1] : 1;
};
const featureName = (title: string | null, e: Entry) => (title ? title.replace(/^Level \d+:\s*/, "") : e.name);
const isCore = (title: string | null) => !!title && /^Core .+ Traits$/i.test(title);

/** Resolve "$srd/feats/defense" (or "srd:feat/defense") to a loaded entry. */
export function resolveRef(ref: string, ctx: Pick<ModifCtx, "entries" | "byId">): Entry | undefined {
  if (!ref) return undefined;
  if (!ref.startsWith("$")) return ctx.byId(ref);
  const parts = ref.slice(1).split("#")[0].split("/");
  const pack = parts[0];
  const name = parts[parts.length - 1];
  const folder = parts.length > 2 ? parts[1].replace(/s$/, "") : "";
  const hits = ctx.entries.filter((e) => e.pack === pack && e.id.endsWith(`/${name}`));
  return hits.find((e) => slug(e.type) === folder) || hits[0];
}

function featCategory(e: Entry): string {
  const f = e.fields["category"];
  if (f) return slug(stripMd(f));
  const t = e.tagline?.match(/^(.+?) Feat\b/);
  return t ? slug(t[1]) : "";
}

/** "Repeatable" header field or run-in label. */
export function featRepeatable(e: Entry): boolean {
  return !!e.fields["repeatable"] || /^\*\*\*Repeatable\.\*\*\*/m.test(e.body);
}

/** Does the character qualify for a feat taken at this level? Unknown prerequisites count as met. */
export function featQualifies(e: Entry, level: number, scores: Record<string, number>, ctx: Pick<ModifCtx, "classes">): boolean {
  const pre = (e.tagline?.match(/\(Prerequisite:\s*([^)]*)\)/)?.[1] || stripMd(e.fields["prerequisite"] || "")).trim();
  if (!pre) return true;
  for (const part of pre.split(/,\s*/)) {
    const lv = part.match(/^Level (\d+)\+$/i);
    if (lv && level < +lv[1]) return false;
    const ab = part.match(/^(.+?) (\d+)\+$/);
    if (ab && !lv) {
      const names = ab[1].split(/\s+or\s+/).map((x) => x.trim()).filter((x) => ABILITIES.includes(x));
      if (names.length && !names.some((n) => (scores[n] ?? 0) >= +ab[2])) return false;
    }
    const feature = part.match(/^(.+?) Feature$/i);
    if (feature) {
      const want = feature[1].split(/\s+or\s+/).map((x) => x.toLowerCase());
      const has = ctx.classes.some((k) => [k.cls, k.sub].some((en) => en && features(en).some((f) => f.level <= k.level && want.includes(f.name.toLowerCase()))));
      if (!has) return false;
    }
  }
  return true;
}

/** Ability-increase amounts of a `choose` block: `[1]`, or `{ choose-one: [[2], [1, 1]] }`. */
function amountSets(v: Val): number[][] | null {
  const a = v.amounts;
  if (Array.isArray(a) && a.every((n) => typeof n === "number")) return [a];
  if (a && Array.isArray(a["choose-one"])) return a["choose-one"].filter((x: Val) => Array.isArray(x));
  return null;
}

/** Keep the picks that fit one of the amount sets (each pick is +1 to that ability). */
export function validIncreases(picks: string[], sets: number[][]): string[] {
  const out: string[] = [];
  for (const p of picks) {
    const next = [...out, p];
    const counts = Object.values(next.reduce<Record<string, number>>((m, x) => ((m[x] = (m[x] || 0) + 1), m), {})).sort((x, y) => y - x);
    const fits = sets.some((set) => {
      const sorted = [...set].sort((x, y) => y - x);
      return counts.length <= sorted.length && counts.every((n, i) => n <= sorted[i]) && next.length <= sorted.reduce((x, y) => x + y, 0);
    });
    if (fits) out.push(p);
  }
  return out;
}

export function applyScoreSteps(start: Record<string, number>, steps: ScoreStep[]): Record<string, number> {
  const s = { ...start };
  for (const st of steps) if (s[st.ability] < st.max) s[st.ability] = Math.min(st.max, s[st.ability] + st.amount);
  return s;
}

/** Options for a `choose` block, or null when the app can't list them. */
export function choiceOptions(ch: Val, ctx: Pick<ModifCtx, "entries" | "byId">): ChoiceOption[] | null {
  const kinds: string[] = Array.isArray(ch.kind) ? ch.kind : [ch.kind];
  const from = ch.from;
  const titled = (s: string) => s.replace(/-/g, " ").replace(/\b\w/g, (x) => x.toUpperCase());
  const skillOpts = () => SKILLS.map((s) => ({ value: s, label: s }));
  const toolOpts = () => ctx.entries.filter((e) => e.type === "Tool").map((e) => ({ value: e.name, label: e.name }));
  if (from === "any") {
    const out: ChoiceOption[] = [];
    if (kinds.includes("skill")) out.push(...skillOpts());
    if (kinds.includes("tool")) out.push(...toolOpts());
    if (kinds.includes("ability")) out.push(...ABILITIES.map((a) => ({ value: a, label: a })));
    return out.length ? out : null;
  }
  if (!from && Array.isArray(ch.options)) {
    return ch.options.filter((o: Val) => o && o.id).map((o: Val) => ({ value: String(o.id), label: o.label || titled(String(o.id)) }));
  }
  if (Array.isArray(from)) {
    return from.filter((x) => typeof x === "string").map((x: string) => {
      const sk = skillBySlug(x);
      if (sk) return { value: sk, label: sk };
      const ab = ABBR3[x];
      if (ab) return { value: ab, label: ab };
      return { value: x, label: titled(x) };
    });
  }
  if (from && typeof from === "object") {
    if (from.feat) {
      const cat = from.feat.category ? slug(String(from.feat.category)) : "";
      return ctx.entries
        .filter((e) => e.type === "Feat" && (!cat || featCategory(e) === cat))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((e) => ({ value: e.id, label: e.name }));
    }
    if (from.tool?.category) {
      const tool = ctx.entries.find((e) => e.type === "Tool" && slug(e.name) === slug(String(from.tool.category)));
      const variants = (tool?.fields["variants"] || "").split(/,\s*/).map((v) => stripMd(v).replace(/\s*\([^)]*\)\s*$/, "").trim()).filter(Boolean);
      return variants.length ? variants.map((v) => ({ value: titled(v), label: titled(v) })) : null;
    }
    if (from.weapon) {
      const cats: string[] = [].concat(from.weapon.category || []);
      const rule = ctx.entries.find((x) => x.type === "Rule" && x.name === "Weapons");
      if (!rule) return null;
      const names: ChoiceOption[] = [];
      let category = "";
      for (const line of rule.body.split("\n")) {
        const cells = line.split("|").slice(1, -1).map((x) => x.trim());
        if (cells.length < 4 || /^[-: ]+$/.test(cells[0]) || /^name$/i.test(cells[0])) continue;
        if (cells.slice(1).every((x) => !x)) { category = cells[0]; continue; }
        if (!cats.length || cats.some((k) => category.toLowerCase().startsWith(k))) names.push({ value: cells[0], label: cells[0] });
      }
      return names.length ? names : null;
    }
  }
  return null;
}

/** What the character has picked for a choice: stored answer, else the block's default. */
function chosenFor(key: string, ch: Val, ctx: ModifCtx, storedIn?: PendingChoice["storedIn"], info?: ClassRef): string[] {
  if (storedIn === "classSkills") return info?.skills || [];
  if (storedIn === "extraSkills") return ctx.c.extraSkills || [];
  const stored = ctx.c.choices?.[key];
  if (stored?.length) return stored;
  if (ch.default) {
    const d = resolveRef(String(ch.default), ctx);
    return d ? [d.id] : [String(ch.default)];
  }
  return [];
}

// ------------------------------------------------------------------ main
/**
 * Read the Effects of every entry the character has (classes, subclasses,
 * species, background, and the feats those grant) and combine them.
 */
export function computeModif(ctx: ModifCtx): ModifResult {
  const start = finalScores(ctx.c);
  const first = runModif(ctx, start, start);
  const scores = applyScoreSteps(start, first.scoreSteps);
  // expressions such as mod:con use the scores after feats, so read everything again with them
  const r = ABILITIES.some((a) => scores[a] !== start[a]) ? runModif(ctx, scores, start) : first;
  r.scores = scores;
  return r;
}

function runModif(ctx: ModifCtx, scores: Record<string, number>, prereqScores: Record<string, number>): ModifResult {
  const r = emptyResult();
  const { c } = ctx;
  const mods = Object.fromEntries(ABILITIES.map((a) => [a, mod(scores[a])]));
  const pb = profBonus(c.level);
  const classLevels = Object.fromEntries(ctx.classes.map((k) => [slug(k.cls.name), k.level]));
  const baseEnv: Env = { level: c.level, total: c.level, pb, mods, scores, classLevels, table: {} };
  const seenFeats = new Set<string>();

  type ReadOpts = { level: number; table: Record<string, string>; info?: ClassRef; kind: "class" | "subclass" | "species" | "background" | "feat"; origin?: string; slot?: string };
  const readEntry = (e: Entry | undefined, opts: ReadOpts) => {
    if (!e?.effects?.length) return;
    const origin = opts.origin || e.id;
    r.encoded.add(e.id);
    const env: Env = { ...baseEnv, level: opts.level, table: opts.table };
    const featureList = opts.kind === "class" || opts.kind === "subclass" ? features(e) : [];
    for (const fx of e.effects) {
      const { blocks, problems } = readBlocks(fx.yaml);
      for (const p of problems) r.problems.push({ entry: e.name, feature: fx.feature, problem: p });
      const lvl = featureLevel(fx.feature);
      if ((opts.kind === "class" || opts.kind === "subclass") && lvl > opts.level) continue;
      const fname = featureName(fx.feature, e);
      const core = isCore(fx.feature);
      const multiOnly = opts.kind === "class" && core && opts.info && !opts.info.starting;
      let applied = 0;
      let skipped = 0;
      const remind = (text: string) => {
        skipped++;
        r.reminders.push({ source: e.name, feature: fname, text });
      };
      const featText = featureList.find((f) => f.name === fname)?.md || "";
      for (const b of blocks) {
        if (multiOnly && b.type !== "multiclass" && b.type !== "hit-die" && b.type !== "equipment") continue;
        const ok = applyBlock(b, {
          e, fname, env, opts, ctx, r, remind, featText, multiOnly: !!multiOnly, origin, slot: opts.slot, featureLevel: lvl,
          readFeat: (f) => readFeat(f, origin),
          featSlot: (id, level, def) => featSlot(e, opts.info, fname, id, level, def, origin),
        });
        if (ok) applied++;
      }
      if (blocks.length) {
        r.features.push({
          entryId: e.id, feature: fname,
          status: skipped === 0 ? "automated" : applied > 0 ? "partly automated" : "not automated",
        });
      }
    }
  };

  const readFeat = (f: Entry | undefined, origin: string, slot?: string, level?: number, className?: string) => {
    if (!f) return;
    // a repeatable feat (Ability Score Improvement) counts once per slot; others once in all
    const k = featRepeatable(f) && slot ? `${slot}|${f.id}` : f.id;
    if (seenFeats.has(k)) return;
    seenFeats.add(k);
    r.feats.push(f);
    r.featPicks.push({ feat: f, slot, level, className });
    readEntry(f, { level: c.level, table: {}, kind: "feat", origin, slot });
  };

  /** One feat taken at a class level (Ability Score Improvement, Epic Boon). */
  const featSlot = (e: Entry, info: ClassRef | undefined, fname: string, id: string, level: number, def: string | undefined, origin: string) => {
    const key = `${e.id}#${id}@${level}`;
    const stored = c.choices?.[key];
    const d = def ? resolveRef(def, ctx) : undefined;
    const chosen = stored?.length ? stored.slice(0, 1) : d ? [d.id] : [];
    const options = ctx.entries
      .filter((x) => x.type === "Feat" && featQualifies(x, level, prereqScores, ctx))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((x) => ({ value: x.id, label: x.name }));
    r.pending.push({
      key, entry: e, feature: fname, label: `${info ? `${info.cls.name} level ${level}` : `Level ${level}`}: ${fname}`, count: 1,
      options, chosen, origin, slot: key, level,
    });
    readFeat(ctx.byId(chosen[0]) || resolveRef(chosen[0] || "", ctx), origin, key, level, info?.cls.name);
  };

  for (const k of ctx.classes) {
    const row = tableRow(classTable(k.cls), k.level);
    readEntry(k.cls, { level: k.level, table: row, info: k, kind: "class" });
    if (!k.cls.effects?.length) {
      // classes not converted to Modif yet: their table's "Class Features" column says where feats come
      for (const r0 of classTable(k.cls)?.rows || []) {
        const lv = +r0[0];
        if (!(lv <= k.level)) continue;
        const feats = r0.join(" ");
        if (/Ability Score Improvement/.test(feats)) featSlot(k.cls, k, "Ability Score Improvement", "asi", lv, "$srd/feats/ability-score-improvement", k.cls.id);
        if (/Epic Boon/.test(feats)) featSlot(k.cls, k, "Epic Boon", "epic-boon", lv, undefined, k.cls.id);
      }
    }
    if (k.sub && k.level >= SUBCLASS_LEVEL) readEntry(k.sub, { level: k.level, table: { ...row, ...tableRow(classTable(k.sub), k.level) }, info: k, kind: "subclass" });
  }
  readEntry(ctx.species, { level: c.level, table: {}, kind: "species" });
  readEntry(ctx.background, { level: c.level, table: {}, kind: "background" });
  // a background's Feat header field grants that feat (header fields are data, Modif §2.3)
  const bgFeat = ctx.background?.fields["feat"];
  if (bgFeat && ctx.background?.effects?.length) {
    const name = stripMd(bgFeat).replace(/\s*\(see [^)]*\)/g, "").replace(/\s*\(.*\)$/, "").trim().toLowerCase();
    readFeat(ctx.entries.find((x) => x.type === "Feat" && x.name.toLowerCase() === name), ctx.background.id);
  }
  if (ctx.background?.effects?.length) {
    for (const s of (ctx.background.fields["skill proficiencies"] || "").split(/,\s*|\s+and\s+/)) {
      const sk = SKILLS.find((x) => x === stripMd(s).trim());
      if (sk) r.skills.add(sk);
    }
  }
  // a feat you can take only once isn't offered again in another slot
  for (const p of r.pending) {
    if (p.level === undefined || !p.options) continue;
    p.options = p.options.filter((o) => {
      const f = ctx.byId(o.value);
      return !f || featRepeatable(f) || !r.featPicks.some((fp) => fp.feat.id === o.value && fp.slot !== p.key);
    });
  }
  return r;
}

/**
 * Put a feat in a slot. Picks made for the feat that was there before
 * (keys "<slot>/…") are dropped, so they can't come back if it's chosen again.
 */
export function setSlotFeat(choices: Record<string, string[]> | undefined, slot: string, featId: string | undefined): Record<string, string[]> {
  const out = Object.fromEntries(Object.entries(choices || {}).filter(([k]) => !k.startsWith(`${slot}/`)));
  if (featId) out[slot] = [featId];
  else delete out[slot];
  return out;
}

/** Everything for one character, from the loaded content. */
export function modifFor(c: Character, content: { entries: Entry[]; byId: (id?: string) => Entry | undefined }): ModifResult {
  return computeModif({
    c, classes: classInfos(c, content.byId), species: content.byId(c.speciesId), background: content.byId(c.backgroundId),
    entries: content.entries, byId: content.byId,
  });
}

interface ApplyCtx {
  e: Entry;
  fname: string;
  env: Env;
  opts: { level: number; info?: ClassRef; kind: string };
  ctx: ModifCtx;
  r: ModifResult;
  readFeat: (f: Entry | undefined) => void;
  featSlot: (id: string, level: number, def?: string) => void;
  remind: (text: string) => void;
  featText: string;
  multiOnly: boolean;
  origin: string;
  /** Set inside a feat taken in a slot: its choices are kept per slot. */
  slot?: string;
  featureLevel: number;
}

function grant(r: ModifResult, item: string): boolean {
  const [k, v] = item.split(":");
  if (!v) return false;
  if (k === "save") {
    if (v === "all") ABILITIES.forEach((a) => r.saves.add(a));
    else if (ABBR3[v]) r.saves.add(ABBR3[v]);
    else return false;
  } else if (k === "skill") {
    const s = skillBySlug(v);
    if (!s) return false;
    r.skills.add(s);
  } else if (k === "weapon") r.weapons.add(v);
  else if (k === "armor") r.armor.add(v);
  else if (k === "tool") r.tools.add(v);
  else return false;
  return true;
}

/** Apply one block. Returns true when the sheet acts on it; otherwise it adds a reminder. */
function applyBlock(b: Block, a: ApplyCtx): boolean {
  const { r, env, e, fname } = a;
  const v = b.v;
  const src = `${fname}${e.name !== fname ? ` (${e.name})` : ""}`;
  const shortText = () => firstSentence(a.featText) || fname;
  switch (b.type) {
    case "proficiency": {
      const items: Val[] = Array.isArray(v) ? v : [v];
      return items.every((x) => typeof x === "string" && grant(r, x));
    }
    case "multiclass": {
      if (!a.multiOnly) return true; // only matters when this class isn't the first
      for (const x of Array.isArray(v) ? v : []) if (typeof x === "string" && x !== "hit-die") grant(r, x);
      return true;
    }
    case "hit-die":
    case "equipment":
      return true; // the builder reads hit dice and starting equipment from the header fields
    case "choose": {
      if (!v || typeof v !== "object") return false;
      if (v.kind === "subclass") return true; // the class step picks the subclass
      const key = a.slot ? `${a.slot}/${e.id}#${v.id}` : `${e.id}#${v.id}`;
      const kinds: string[] = Array.isArray(v.kind) ? v.kind : [v.kind];
      // feats taken at class levels (Ability Score Improvement, Epic Boon): one slot per level
      if (kinds.includes("feat") && v.from?.feat?.qualify) {
        const levels: number[] = Array.isArray(v.at) ? v.at : [a.featureLevel];
        for (const L of levels) if (L <= a.opts.level) a.featSlot(v.id, L, v.default ? String(v.default) : undefined);
        return true;
      }
      const sets = kinds.length === 1 && kinds[0] === "ability" ? amountSets(v) : null;
      if (sets) {
        const options = choiceOptions(v, a.ctx);
        const points = Math.max(...sets.map((x) => x.reduce((m, n) => m + n, 0)));
        const max = typeof v.max === "number" ? v.max : 20;
        const picks = validIncreases(a.ctx.c.choices?.[key] || [], sets).filter((x) => !options || options.some((o) => o.value === x));
        r.pending.push({
          key, entry: e, feature: fname, label: `${fname}: ${sets.map((x) => x.map((n) => `+${n}`).join(" and ")).join(" or ")}`,
          count: points, options, chosen: picks, origin: a.origin, slot: a.slot,
          amounts: { points, perAbility: Math.max(...sets.flat()), max, sets },
        });
        for (const ab of picks) r.scoreSteps.push({ ability: ab, amount: 1, max, source: e.name });
        return true;
      }
      let storedIn: PendingChoice["storedIn"];
      if (a.opts.kind === "class" && v.id === "skills" && kinds[0] === "skill") storedIn = "classSkills";
      if (a.opts.kind === "species" && kinds.length === 1 && kinds[0] === "skill") storedIn = "extraSkills";
      const count = evalNumber(v.count ?? 1, env) || 1;
      const chosen = chosenFor(key, v, a.ctx, storedIn, a.opts.info);
      const options = choiceOptions(v, a.ctx);
      r.pending.push({ key, entry: e, feature: fname, label: choiceLabel(v, fname, count), count, options, chosen, storedIn, origin: a.origin, slot: a.slot });
      if (kinds.includes("feat")) {
        for (const id of chosen.slice(0, count)) a.readFeat(a.ctx.byId(id) || resolveRef(id, a.ctx));
        return true;
      }
      if (v.grants === "proficiency") {
        for (const x of chosen.slice(0, count)) {
          if (SKILLS.includes(x)) r.skills.add(x);
          else r.tools.add(x);
        }
        return true;
      }
      if (v.grants === "mastery") {
        r.masteries.push(...chosen.slice(0, count));
        return true;
      }
      if (kinds[0] === "size") {
        r.size = chosen[0];
        return true;
      }
      a.remind(`${choiceLabel(v, fname, count)}${chosen.length ? ` (${chosen.join(", ")})` : ""}.`);
      return false;
    }
    case "score": {
      if (!v || typeof v !== "object") return false;
      const max = typeof v.max === "number" ? v.max : 20;
      for (const [k, n] of Object.entries(v)) {
        if (k === "max" || typeof n !== "number") continue;
        const abs = k === "all" ? ABILITIES : ABBR3[k] ? [ABBR3[k]] : [];
        for (const ab of abs) r.scoreSteps.push({ ability: ab, amount: n, max, source: e.name });
      }
      return true;
    }
    case "resource": {
      const max = evalNumber(v.max, env);
      if (max === null || !v.id) return false;
      const resets: string[] = [].concat(v.reset || "long");
      const recover: ModifResource["recover"] = resets.includes("short")
        ? "short"
        : v.partial?.at === "short" && (v.partial.amount ?? 1) === 1 ? "shortOne" : "long";
      if (max > 0) r.resources.push({ key: v.id, name: v.label || fname, max, recover, entryId: e.id });
      if (resets.some((x) => !["short", "long"].includes(x))) a.remind(`${v.label || fname}: also resets on ${resets.join(", ")}.`);
      return true;
    }
    case "action": {
      const heal = v.heal !== undefined ? evalAmount(v.heal, env) : null;
      const res = typeof v.cost === "object" ? v.cost?.resource : undefined;
      r.actions.push({
        id: v.id || slug(fname), name: titleOf(v.id) || fname, source: src, activation: actLabel(v.activation),
        resource: typeof res === "string" ? res.replace(/^\$#/, "").replace(/^.*#/, "") : undefined,
        heal: heal ? amountText(heal) : undefined,
        text: v.text || (heal ? undefined : shortText()),
      });
      return true;
    }
    case "bonus": {
      const value = evalNumber(v.value, env);
      if (value === null || !v.to) return false;
      const when = v.when || {};
      const whenKeys = Object.keys(when);
      if (v.to === "ac") {
        if (v.scope) return false;
        if (whenKeys.every((k) => k === "armor" || k === "shield")) {
          const armor = when.armor === "none" ? undefined : when.armor ? [].concat(when.armor) : undefined;
          r.acBonuses.push({ value, armor, unarmored: when.armor === "none", noShield: when.shield === false, source: src });
          return true;
        }
        return false;
      }
      if (whenKeys.length) return false;
      if (v.to === "attack") {
        const kind = v.scope?.weapon?.kind;
        if (v.scope && !kind) return false;
        r.attackBonuses.push({ value, ranged: kind === "ranged", melee: kind === "melee", source: src });
        return true;
      }
      if (v.scope) return false;
      if (["initiative", "speed:walk", "hp:per-level", "hp:max", "passive:perception"].includes(v.to)) {
        r.bonuses.push({ to: v.to, value, source: src });
        return true;
      }
      return false;
    }
    case "base": {
      if (v.to !== "ac") return false;
      const when = v.when || {};
      if (when.armor !== "none" || Object.keys(when).some((k) => k !== "armor" && k !== "shield")) return false;
      r.acBases.push({ expr: v.value, noShield: when.shield === false || v["allow-shield"] === false, source: src });
      return true;
    }
    case "advantage": {
      if (v.when || v.scope || v.once) return false;
      for (const roll of [].concat(v.roll || [])) r.advantages.push({ roll, source: src });
      return true;
    }
    case "crit-range": {
      const n = evalNumber(v.value, env);
      const any = v.scope?.any;
      const weaponsOnly = !v.scope || (Array.isArray(any) && any.every((x: Val) => x.weapon && Object.keys(x.weapon).every((k) => k === "unarmed")));
      if (n === null || !weaponsOnly) return false;
      r.critRange = Math.min(r.critRange, n);
      return true;
    }
    case "extra-attack": {
      const n = evalNumber(v.total, env);
      if (n === null || v.scope) return false;
      r.attacksPerAction = Math.max(r.attacksPerAction, n);
      return true;
    }
    case "treat-roll": {
      const range = v.range;
      if (!Array.isArray(range) || typeof v.as !== "number" || v.optional) return false;
      r.treatRolls.push({ roll: v.roll, min: range[0], max: range[1], as: v.as, source: src });
      return true;
    }
    case "trigger": {
      const ev = v.event;
      const regain = v.offer?.regain;
      if (ev && typeof ev === "object" && ev.rest === "long" && v.auto && regain?.resource && !v.when) {
        r.onLongRest.push({ regain: regain.resource, source: src });
        return true;
      }
      a.remind(shortText());
      return false;
    }
    case "narrative":
      a.remind(typeof v === "string" ? v : shortText());
      return false;
    default:
      a.remind(shortText());
      return false;
  }
}

function firstSentence(md: string): string {
  const p = stripMd(md.split(/\n\s*\n/).find((x) => x.trim() && !x.trim().startsWith("|") && !x.trim().startsWith("#")) || "");
  return p.length > 240 ? p.slice(0, 237).replace(/\s+\S*$/, "") + "…" : p;
}

function titleOf(id?: string): string {
  return id ? id.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ") : "";
}

function actLabel(act: Val): string {
  if (!act) return "";
  if (typeof act === "object") return `${act.amount ?? 1} ${act.unit ?? ""}`.trim();
  return ({ action: "Action", bonus: "Bonus Action", reaction: "Reaction", none: "No action", free: "No action" } as Record<string, string>)[act] || String(act);
}

function choiceLabel(v: Val, fname: string, count: number): string {
  const kinds: string[] = Array.isArray(v.kind) ? v.kind : [v.kind];
  const what = kinds.map((k) => (count > 1 ? `${k}s` : k)).join(" or ");
  return `${fname}: choose ${count > 1 ? count : "one"} ${what}`;
}

// ------------------------------------------------------------------ rolls
/** Does an Effects block give Advantage on this roll? Returns the sources. */
export function advantageFor(r: ModifResult | undefined, roll: { kind: string; ability?: string; skill?: string }): string[] {
  if (!r) return [];
  const want: string[] = [];
  if (roll.kind === "init") want.push("initiative");
  if (roll.kind === "death") want.push("death-save");
  if (roll.kind === "check" && roll.skill) want.push(`skill:${slug(roll.skill)}`);
  if (roll.kind === "check" && roll.ability) want.push(`check:${abbr(roll.ability)}`, "check:all");
  if (roll.kind === "save" && roll.ability) want.push(`save:${abbr(roll.ability)}`, "save:all");
  return r.advantages.filter((x) => want.includes(x.roll)).map((x) => x.source);
}

const abbr = (ability: string) => ability.slice(0, 3).toLowerCase();

/** "Treat 18–20 on a death save as a 20" and similar. */
export function treatRoll(r: ModifResult | undefined, roll: string, kept: number): { as: number; source: string } | null {
  const t = r?.treatRolls.find((x) => x.roll === roll && kept >= x.min && kept <= x.max);
  return t ? { as: t.as, source: t.source } : null;
}

/** The feature status, for "Automated" tags on the sheet. */
export function statusOf(r: ModifResult | undefined, entryId: string, feature: string): FeatureStatus["status"] | undefined {
  const exact = r?.features.find((f) => f.entryId === entryId && f.feature === feature)?.status;
  if (exact || !r) return exact;
  // a whole entry (a feat with several headings): automated only if every part is
  const parts = r.features.filter((f) => f.entryId === entryId);
  if (!parts.length) return undefined;
  if (parts.every((f) => f.status === "automated")) return "automated";
  return parts.some((f) => f.status !== "not automated") ? "partly automated" : "not automated";
}
