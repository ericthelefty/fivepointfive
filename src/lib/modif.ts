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
import { features, parseTables, slug, spellInfo, stripMd, type Entry } from "./parse.ts";
import { CUSTOM_HANDLERS } from "./custom/index.ts";
import { classTable, tableRow, mod, profBonus, finalScores, speciesChoice, type Character } from "./rules.ts";
import { ABILITIES, SKILLS, closest } from "./fix.ts";
import { SUBCLASS_LEVEL, casterInfoOf, classInfos, spellSlots } from "./multiclass.ts";
import type { Item } from "./inventory.ts";

// ------------------------------------------------------------------ vocabulary
/** The 70 block types of Modif 0.6. */
export const BLOCKS = [
  "proficiency", "expertise", "mastery", "language", "half-proficiency", "sense", "speed", "size", "defense", "note",
  "trait", "option", "hit-die", "multiclass", "equipment", "bonus", "set", "base", "advantage", "disadvantage",
  "cancel-advantage", "crit-range", "extra-attack", "damage-die", "use-ability", "damage-type", "ignore-resistance",
  "score", "score-max", "roll-floor", "die-floor", "maximize", "reroll", "save-rule", "treat-roll", "choose",
  "resource", "cast-list", "convert", "action", "toggle", "narrative", "suppress", "aura", "zone", "remove-condition",
  "limit", "grant-spell", "spell-list", "spellcasting", "scaling", "target-effects", "self-effects", "form", "summon", "summon-options",
  "condition", "charges", "variant", "container", "weapon-rule", "craft", "auto-fail", "breaks-concentration", "rest",
  "poison", "weapon-property", "curse", "modify", "replace", "trigger", "custom",
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
export type Val = any;
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
  /** Spellcasting modifier, save DC and attack bonus (for `spell-ability`, `spell:dc`, `spell:attack`). */
  spell?: { mod: number; dc: number; attack: number };
  /** An item's variant values (`variant:plus`, `variant:size.fly`). */
  variants?: Record<string, Val>;
  /** Feature save DCs set by `set: { to: save-dc:<class> }` (Monk's Focus), read as `save-dc:monk`. */
  saveDc?: Record<string, number>;
  /** A cell of a named table in the entry being read (`table:Beast Shapes.Max CR`), at the entry's level. */
  named?: (table: string, col: string) => string | undefined;
  /** The highest spell slot level the character has (`slot-level`: Eldritch Smite with a Pact Magic slot). */
  slotLevel?: number;
}

/** A value as dice plus a flat number: "1d10 + level:fighter" -> { dice: ["1d10"], flat: 5 }. */
export interface Amount { dice: string[]; flat: number }

export function evalAmount(expr: Val, env: Env): Amount | null {
  if (typeof expr === "number") return { dice: [], flat: expr };
  if (expr && typeof expr === "object" && expr.steps) {
    // values that change at levels: numbers or dice ({ 1: 1d10, 5: 2d10 }); `by: level` means character level
    const lvl = expr.by === "level" ? env.total : env.level;
    let best: Val = 0;
    for (const [lv, n] of Object.entries(expr.steps).sort((x, y) => +x[0] - +y[0])) if (lvl >= +lv) best = n;
    return typeof best === "number" ? { dice: [], flat: best } : evalAmount(String(best), env);
  }
  if (typeof expr !== "string") return null;
  // "steps(2: 1d8, 7: 2d8) + mod:wis": work out each steps(...) term first, then the sum
  if (/steps\(/.test(expr) && !/^\s*steps\([^()]*\)\s*$/.test(expr)) {
    let failed = false;
    const flat = expr.replace(/steps\(([^()]*)\)/g, (all) => {
      const v = evalAmount(all, env);
      if (!v) { failed = true; return all; }
      return amountText(v);
    });
    if (failed) return null;
    return evalAmount(flat, env);
  }
  // "steps(1: d8, 5: d10, 11: d12)": the value at the highest level reached (cantrips: character level)
  const st = expr.trim().match(/^steps\((.*)\)$/);
  if (st) {
    const steps: Record<string, string> = {};
    for (const part of st[1].split(",")) {
      const m = part.match(/^\s*(\d+)\s*:\s*(.+?)\s*$/);
      if (!m) return null;
      steps[m[1]] = m[2];
    }
    return evalAmount({ steps }, env);
  }
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
    if (k === "spell-ability" && !arg) return env.spell ? { dice: [], flat: env.spell.mod } : null;
    if (k === "save-dc" && env.saveDc?.[arg] !== undefined) return { dice: [], flat: env.saveDc[arg] };
    if (k === "spell" && (arg === "dc" || arg === "attack")) return env.spell ? { dice: [], flat: env.spell[arg] } : null;
    if (k === "variant") {
      let x: Val = env.variants;
      for (const part of arg.split(".")) x = x == null ? undefined : x[part];
      if (typeof x === "number") return { dice: [], flat: x };
      if (typeof x === "string") return evalAmount(x, { ...env, variants: undefined });
      return null;
    }
    if (k === "level" && !arg) return { dice: [], flat: env.total };
    if (k === "slot-level" && !arg && env.slotLevel) return { dice: [], flat: env.slotLevel };
    if (k === "level") return { dice: [], flat: env.classLevels[slug(arg)] ?? 0 };
    if (k === "mod" && ABBR3[arg]) return { dice: [], flat: env.mods[ABBR3[arg]] };
    if (k === "score" && ABBR3[arg]) return { dice: [], flat: env.scores[ABBR3[arg]] };
    if (k === "table") {
      // "table:Beast Shapes.Max CR": a column of another table in the entry; otherwise a column of the class table
      const dot = arg.lastIndexOf(".");
      const named = dot > 0 && env.named ? env.named(arg.slice(0, dot), arg.slice(dot + 1)) : undefined;
      const col = Object.keys(env.table).find((h) => h.toLowerCase() === arg.toLowerCase());
      const cell = named ?? (col ? env.table[col] : undefined);
      if (cell === undefined) return null;
      const fr = cell.trim().match(/^(\d+)\/(\d+)$/);
      if (fr) return { dice: [], flat: +fr[1] / +fr[2] };
      if (/^yes$/i.test(cell.trim())) return { dice: [], flat: 1 };
      if (/^(no|—|-)$/i.test(cell.trim())) return { dice: [], flat: 0 };
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
    // dice(count, dX): dice whose count is computed ("dice(prof, d4)")
    const dfn = src.slice(pos).match(/^dice\s*\(/);
    if (dfn) {
      pos += dfn[0].length;
      const n = sum();
      if (!n || n.dice.length || peek() !== ",") return null;
      pos++;
      const die = src.slice(pos).match(/^\s*d(\d+)\s*\)/);
      let sides = die?.[1];
      if (die) pos += die[0].length;
      else {
        // a die from a table ("dice(2, table:Martial Arts)")
        const d1 = sum();
        const one = d1 && !d1.flat && d1.dice.length === 1 ? d1.dice[0].match(/^1d(\d+)$/) : null;
        if (!one || peek() !== ")") return null;
        pos++;
        sides = one[1];
      }
      return n.flat > 0 ? { dice: [`${n.flat}d${sides}`], flat: 0 } : { dice: [], flat: 0 };
    }
    const fn = src.slice(pos).match(/^(max|min|floor|ceil|half)\s*\(/);
    if (fn) {
      pos += fn[0].length;
      const args: number[] = [];
      for (;;) {
        const v = sum();
        if (!v) return null;
        // "max(1, 1d8 + mod:wis)": a roll with a minimum; keep the roll (the minimum is in the rules text)
        if (v.dice.length) {
          if (fn[1] !== "max") return null;
          let depth = 0;
          while (pos < src.length && !(depth === 0 && src[pos] === ")")) { if (src[pos] === "(") depth++; if (src[pos] === ")") depth--; pos++; }
          if (src[pos] !== ")") return null;
          pos++;
          return v;
        }
        args.push(v.flat);
        if (peek() === ",") { pos++; continue; }
        if (peek() === ")") { pos++; break; }
        return null;
      }
      const f = fn[1];
      const n = f === "max" ? Math.max(...args) : f === "min" ? Math.min(...args) : f === "floor" ? Math.floor(args[0]) : f === "half" ? Math.floor(args[0] / 2) : Math.ceil(args[0]);
      return { dice: [], flat: n };
    }
    // a word runs to the next operator; table columns may contain spaces
    // a word runs to the next operator; a hyphen between letters is part of it (spell-ability)
    const m = src.slice(pos).match(/^(?:[^+*/(),-]|-(?=[a-z]))+/);
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
  /** Choices fixed by where the entry came from ("Magic Initiate (Wizard)"); the player can't change them. */
  fixedChoices?: Set<string>;
  classes: ClassRef[];
  species?: Entry;
  background?: Entry;
  entries: Entry[];
  byId: (id?: string) => Entry | undefined;
  /** Carried magic items, and whether each is active (equipped/attuned as it needs). */
  items?: { item: Item; entry: Entry; active: boolean }[];
  /** What the character is wearing, for `when: { armor }` (undefined = unknown). */
  gear?: { armor?: string; shield: boolean };
  /** Toggles and spells switched on (keys of ModifToggle / "spell:<id>"), from the play state. */
  active?: { key: string; slot?: number; onSelf?: boolean }[];
  /** Conditions the character has (play state), for `when: { condition }`. */
  conditions?: string[];
  /** Spellcasting numbers for `spell-ability` etc. (the first caster's), when known. */
  spell?: { mod: number; dc: number; attack: number };
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
  storedIn?: "classSkills" | "extraSkills" | "speciesChoice";
  /** The class, subclass, species or background this choice comes from (through any feats). */
  origin: string;
  /** Feat slots (Ability Score Improvement, Epic Boon) and the choices inside the feat taken there share this key. */
  slot?: string;
  /** For a feat slot: the class level it's taken at. */
  level?: number;
  /** For ability increases: how many points, at most how many on one ability, and the score cap. */
  amounts?: { points: number; perAbility: number; max: number; sets: number[][] };
  /** When it can be changed again ("long", "short"): the sheet offers it after a rest (Circle of the Land, Hunter's Prey). */
  swap?: string[];
  /** Fixed by where it came from ("Magic Initiate (Wizard)" on the Sage background). */
  locked?: boolean;
  /** Why there's nothing to pick yet. */
  hint?: string;
}

/** A feat the character has, and the slot it was taken in (if any). */
export interface FeatPick { feat: Entry; slot?: string; level?: number; className?: string }

/** One ability score increase, applied in order after the background's (Modif §6.7). */
export interface ScoreStep { ability: string; amount: number; max: number; source: string; /** "becomes at least" (Belt of Giant Strength) */ set?: number }

export interface ModifResource {
  key: string;
  name: string;
  max: number;
  /** short: all back on a Short Rest; shortOne: one back on a Short Rest; long; dawn (treated as a Long Rest); never. */
  recover: "short" | "shortOne" | "long" | "dawn" | "never";
  /** Dice rolled to regain uses (item charges: "1d6+1" at dawn). Without it, all come back. */
  regain?: string;
  /** "hp" for a pool of Hit Points (Lay on Hands, Arcane Ward). */
  unit?: string;
  /** The die each use is (Superiority Dice d8, Bardic Inspiration d6), worked out for your level. */
  die?: string;
  entryId: string;
  itemId?: string;
}

/** What using something costs: uses of a resource (or item charges), maybe a range the player picks. */
/** What using something costs; `min`/`max` (or `any`) let the player choose how much to spend (Lay on Hands, Healing Light). */
export interface ModifCost { key: string; amount: number; min?: number; max?: number; any?: boolean }

export interface ModifAction {
  id: string;
  name: string;
  source: string;
  activation: string;
  cost?: ModifCost;
  /** @deprecated use cost.key */
  resource?: string;
  heal?: string;
  /** Healing that depends on how much is spent ("dice(cost.resource, d6)", "cost.amount"), worked out on use. */
  healExpr?: string;
  /** Healing for each choose-one option, when it depends on what's spent (Lay on Hands). */
  optionHeals?: (string | undefined)[];
  /** What each choose-one option rolls, when the options differ (Divine Spark: Heal or Harm). */
  optionEffects?: ({ heal?: string; damage?: { dice: string; type: string }[]; save?: { ability: string; dc?: number; success?: string } } | undefined)[];
  tempHp?: string;
  text?: string;
  /** Casting a spell from a feature or item. */
  cast?: { spellId: string; level?: number; dc?: number; attack?: number; scroll?: ScrollUse };
  save?: { ability: string; dc?: number; success?: string };
  damage?: { dice: string; type: string }[];
  /** Using it uses up one of this inventory item (potions, scrolls). */
  consume?: string;
  /** Pick one of these each use. */
  options?: string[];
  /** What each option costs, when it has a cost of its own (Patient Defense: the Focus Point option). */
  optionCosts?: (ModifCost | undefined)[];
  /** It's an attack: "unarmed" or a weapon filter, and how many attacks (Flurry of Blows: 2). */
  attack?: { weapon: string; count: number };
  /** It makes or bonds an item (Pact of the Blade): a weapon of a kind you pick, tagged so effects can find it. */
  creates?: ModifCreates;
  /** It summons a creature (the `summon` block, read by the sheet's Companions panel). */
  summon?: Val;
  /** Using it rolls on a table in its entry (Wild Magic Surge); `keep: either` rolls twice. */
  rollTable?: { dice: string; table: string; entryId: string; keep?: string };
}

/**
 * More for a summon from another feature (Pact of the Chain's special familiar forms; Investment of the Chain
 * Master's speed, save DC and damage type), applied when that spell or feature summons.
 */
export interface ModifSummonOption {
  /** The spell or feature whose summon it changes (an entry id). */
  for: string;
  source: string;
  /** More stat blocks to choose from (Creature entry ids). */
  add: string[];
  /** A speed it gains, with a choice of kind ("Fly or Swim 40 ft."). */
  speed?: { kinds: string[]; value: number };
  /** Its saving throw DCs become your spell save DC. */
  saveDc?: boolean;
  /** Damage types it can deal instead of these. */
  damageType?: { choose: string[]; replaces: string[] };
  text?: string;
}

/** A creature a feature lets you summon (Primal Companion), read by the sheet's Companions panel. */
export interface ModifSummon {
  key: string;
  name: string;
  source: string;
  /** The entry it comes from, for `$#anchor` stat blocks inside it. */
  entryId: string;
  /** The `summon` block as written. */
  spec: Val;
}

/** `creates` on an action: conjure a weapon of your choice (or bond one you have), tagged for `weapon: { tag }` scopes. */
export interface ModifCreates {
  /** weapons you can conjure: melee/ranged and categories */
  weapon?: { kind?: string; category?: string[] };
  /** a specific item to make (content id), e.g. Goodberry */
  item?: string;
  count: number;
  tag?: string;
  /** using it again ends the previous one: conjured items vanish, bonded ones lose the tag */
  replaces: boolean;
  /** you can bond an item you carry instead: "magic-weapon" */
  bond?: string;
}

/** A Spell Scroll: whether the character can read it, and the check before casting a spell above their level. */
export interface ScrollUse {
  level: number;
  /** the spell is on one of the character's class spell lists */
  onList: boolean;
  /** DC of the check, when one is needed (10 + spell level) */
  checkDc: number;
}

/** Something to switch on and off: Rage, Cloak of Invisibility, a form. */
/** What a `form` lets you become (Wild Shape): which creatures, how many known, and what changes. */
export interface FormSpec {
  /** Kept per character so the known forms survive level-ups. */
  id: string;
  /** Creature type the forms must have ("beast"), if any. */
  type?: string;
  crMax: number;
  /** Forms with a Fly Speed are allowed. */
  fly: boolean;
  /** How many forms can be known at once (0 = any eligible creature). */
  known: number;
  /** When known forms can be swapped, in words. */
  swap?: string;
  tempHp: number;
  /** A floor for AC while in the form (Circle Forms: 13 + Wisdom modifier). */
  acMin?: number;
  acMinSource?: string;
  /** Spellcasting is blocked while in the form. */
  blocksSpells: boolean;
}

export interface ModifToggle {
  key: string;
  /** Set when this is a `form` (Wild Shape): the sheet asks which creature to become. */
  form?: FormSpec;
  name: string;
  source: string;
  activation: string;
  cost?: ModifCost;
  duration?: string;
  /** Minutes it can last (for ending it on a rest); Infinity = until ended. */
  minutes: number;
  ends?: string;
  /** What it does, in words. */
  lines: string[];
  active: boolean;
  itemId?: string;
}

/** "When this happens, you can…": reactions and other triggered options. */
export interface ModifTrigger {
  key: string;
  name: string;
  source: string;
  when: string;
  text: string;
  cost?: ModifCost;
  auto: boolean;
  /** It takes your Reaction. */
  reaction?: boolean;
  /** The trigger's own id (`id:`), so other triggers can follow it (Cunning Strike follows Sneak Attack). */
  id?: string;
  /** "use: <id>" events: the trigger that this one follows. */
  follows?: string;
  /** Extra damage it offers (Sneak Attack 3d6, Brutal Strike 1d10), worked out for your level. */
  damage?: { dice: string; type: string }[];
  /** Effects to pick from when it happens, up to `pick` of them (Cunning Strike, Brutal Strike). */
  options?: { id: string; label: string; diceCost?: number; save?: string; text: string }[];
  pick?: number;
  /** Save DC for its options. */
  dc?: number;
}

/** A spell the character can cast through a feat, species trait or item. */
export interface GrantedSpell {
  spell: Entry;
  source: string;
  /** Resource key for its free casts. */
  free?: string;
  atWill?: boolean;
  /** Spellcasting ability for it, when the grant says. */
  ability?: string;
  dc?: number;
  /** Always prepared, cast with your spell slots (domain and oath spells). */
  prepared?: boolean;
}

/** A spell that's in effect (cast with a duration). */
export interface ActiveSpell {
  key: string; spell: Entry; slot?: number; lines: string[]; concentration: boolean;
  /** It has effects on its target (Mage Armor, Bless), which apply to you if you're the target. */
  targetEffects: boolean; onSelf: boolean;
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
  /** Where each tool proficiency comes from (tool name -> sources). */
  toolSources: Record<string, string[]>;
  /** Senses from features, species and items, in words, with where each comes from. */
  senses: { text: string; source: string }[];
  /** Languages from features, species and items (origin languages are the character's own picks). */
  languages: { name: string; source: string }[];
  masteries: string[];
  feats: Entry[];
  featPicks: FeatPick[];
  /** Final ability scores: base + background increase (max 20), then every ScoreStep. */
  scores: Record<string, number>;
  scoreSteps: ScoreStep[];
  size?: string;
  resources: ModifResource[];
  actions: ModifAction[];
  summons: ModifSummon[];
  summonOptions: ModifSummonOption[];
  toggles: ModifToggle[];
  triggers: ModifTrigger[];
  activeSpells: ActiveSpell[];
  grantedSpells: GrantedSpell[];
  /** Always-on traits, defenses, senses and the like, in words. */
  notes: Reminder[];
  /** Resistances, immunities and vulnerabilities, for the Defenses box on the main sheet. */
  defenses: Reminder[];
  acBonuses: { value: number; armor?: string[]; unarmored?: boolean; noShield?: boolean; source: string }[];
  acBases: { expr: Val; noShield: boolean; source: string }[];
  bonuses: { to: string; value: number; source: string }[];
  attackBonuses: { value: number; ranged?: boolean; melee?: boolean; itemId?: string; ability?: string; source: string }[];
  damageBonuses: { value: number; ranged?: boolean; melee?: boolean; itemId?: string; ability?: string; source: string }[];
  /** Bonuses to one spell's damage rolls (Agonizing Blast), by spell id. */
  spellDamageBonuses: { spellId: string; value: number; source: string }[];
  /** Spells a feature writes into a Wizard's spellbook for free (Evocation Savant), outside the level-up picks. */
  bookSpells: { name: string; source: string }[];
  advantages: { roll: string; source: string }[];
  disadvantages: { roll: string; source: string }[];
  /** Weapon proficiencies with a filter (Monk: Martial weapons that have the Light property). */
  weaponFilters: { category?: string; property?: string | string[]; tag?: string }[];
  /** Skills with Expertise (twice the Proficiency Bonus). */
  expertise: Set<string>;
  /** Half the Proficiency Bonus on checks you're not proficient in (Jack of All Trades). */
  halfProficiency?: boolean;
  /** A walking Speed the character has at least (Wood Elf: 35). */
  speedSet?: number;
  /** "AC can't be less than N" (Barkskin). */
  acFloor?: { value: number; source: string };
  critRange: number;
  attacksPerAction: number;
  treatRolls: { roll: string; min: number; max: number; as: number; source: string }[];
  /** Weapon rules the sheet applies per attack: another ability, a bigger die, a die floor, maximum dice, extra damage types. */
  weaponRules: WeaponRule[];
  /** d20 or total floors (Reliable Talent, Indomitable Might). */
  rollFloors: RollFloor[];
  /** Skills that can use another ability (Primal Knowledge while raging). */
  skillAbilities: { skill: string; ability: string; source: string }[];
  /** Dice for healing spells use their maximum (Supreme Healing). */
  maxHealing?: string;
  /** Trade one pool for another: spell slots, Sorcery Points, Wild Shape… (player presses the button). */
  converts: ModifConvert[];
  /** Lines added to a roll's log card (custom handlers, e.g. Thief's Reflexes on Initiative). */
  rollNotes: { roll: string; source: string; text: (total: number) => string }[];
  /** The Light property's extra attack adds the ability modifier to damage (Two-Weapon Fighting). */
  offhandMod?: string;
  /** How this character reads Spell Scrolls when it differs from the item's own rule (Use Magic Device). */
  scrollRule?: { ability: string; check?: { ability: string; skill?: string; fromLevel: number }; source: string };
  /** What a Long Rest does besides the usual: regain something (Heroic Inspiration), or roll dice to keep (Portent). */
  onLongRest: { regain?: string; roll?: string; key?: string; text?: string; source: string }[];
  reminders: Reminder[];
  /** Size steps added for carrying capacity (Powerful Build: one size larger). */
  carrySize: number;
  pending: PendingChoice[];
  features: FeatureStatus[];
  problems: { entry: string; feature: string | null; problem: EffectProblem }[];
}

/** Which weapons a weapon rule covers; read by the sheet with weaponFits(). */
export interface WeaponRule {
  type: "use-ability" | "damage-die" | "die-floor" | "maximize" | "damage-type";
  scope?: Val;
  /** "while unarmed or wielding only Monk weapons": checked by the sheet against what's equipped */
  wielding?: string[];
  /** use-ability: full ability names, or "spell" for the spellcasting ability */
  abilities?: string[];
  die?: string;
  ifHigher?: boolean;
  min?: number;
  /** die-floor on a Versatile weapon: only when it's used with two hands */
  twoHands?: boolean;
  types?: string[];
  itemId?: string;
  source: string;
}

export interface RollFloor {
  /** "check:all", "check:str", "save:str" */
  rolls: string[];
  /** a d20 lower than this counts as this */
  die?: number;
  /** the total can't be lower than this */
  total?: number;
  /** only for checks you're proficient in */
  proficient?: boolean;
  source: string;
}

/** One side of a trade: a spell slot (level, or "pact") or uses of a resource. */
export interface ConvertSide { slot?: number | "pact"; resource?: string; amount: number }
export interface ModifConvert {
  id: string;
  name: string;
  source: string;
  activation: string;
  /** the trades on offer; the sheet hides the ones the character can't make */
  options: { spend: ConvertSide; gain: ConvertSide }[];
  /** only when the gained pool is empty */
  ifEmpty?: boolean;
  /** once per Long Rest */
  perLong?: boolean;
  /** created slots vanish on a Long Rest (they're extra slots) */
  expires?: boolean;
}

/** A weapon the sheet attacks with, as weaponFits() sees it. */
export interface WeaponInfo { id: string; name: string; category: string; properties: string; unarmed?: boolean; monk?: boolean; itemId?: string; twoHands?: boolean; tags?: string[]; damage?: string }

/** Does a Modif weapon scope (`{ weapon: { id, monk, unarmed, kind, hands, property, category } }`, `{ any: [...] }`) cover this weapon? */
export function weaponFits(scope: Val, w: WeaponInfo, itemId?: string): boolean {
  if (!scope) return true;
  if (Array.isArray(scope.any)) return scope.any.some((x: Val) => weaponFits(x, w, itemId));
  if (scope.against || scope.spell || scope.source) return false;
  const q = scope.weapon;
  if (!q || typeof q !== "object") return false;
  const props = w.properties.toLowerCase();
  const ranged = /ranged/i.test(w.category);
  for (const [k, x] of Object.entries(q)) {
    const list = ([] as Val[]).concat(x).map((y) => String(y).toLowerCase());
    if (k === "id") {
      if (list.includes("self")) { if (!itemId || w.itemId !== itemId) return false; continue; }
      if (!list.includes(w.id) && !list.includes(slug(w.name))) return false;
    } else if (k === "unarmed") { if (!!w.unarmed !== !!x) return false; }
    else if (k === "monk") { if (!!w.monk !== !!x) return false; }
    else if (k === "deals") { if (!list.some((t) => (w.damage || (w.unarmed ? "bludgeoning" : "")).toLowerCase().includes(t))) return false; }
    else if (k === "tag") { if (!list.some((t) => w.tags?.includes(t))) return false; }
    else if (k === "kind") { if (w.unarmed ? x !== "melee" : (x === "ranged") !== ranged) return false; }
    else if (k === "category") { if (!list.some((c) => w.category.toLowerCase().includes(c))) return false; }
    else if (k === "property") { if (!list.some((pr) => props.includes(pr.replace(/-/g, " ")) || props.includes(pr))) return false; }
    else if (k === "hands") { if (x === "two" && !(props.includes("two-handed") || props.includes("versatile"))) return false; }
    else return false;
  }
  return true;
}

export function emptyResult(): ModifResult {
  return {
    encoded: new Set(), saves: new Set(), skills: new Set(), weapons: new Set(), armor: new Set(), tools: new Set(), toolSources: {}, senses: [], languages: [],
    masteries: [], defenses: [], feats: [], featPicks: [], scores: {}, scoreSteps: [], resources: [], actions: [], summons: [], summonOptions: [], toggles: [], triggers: [],
    activeSpells: [], grantedSpells: [], notes: [], expertise: new Set(), weaponFilters: [], acBonuses: [], acBases: [], bonuses: [], attackBonuses: [], damageBonuses: [], spellDamageBonuses: [], bookSpells: [],
    advantages: [], disadvantages: [], critRange: 20, attacksPerAction: 1, treatRolls: [], weaponRules: [], rollFloors: [], skillAbilities: [], converts: [], rollNotes: [], onLongRest: [], reminders: [], carrySize: 0, pending: [],
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
  for (const st of steps) {
    if (st.set !== undefined) s[st.ability] = Math.max(s[st.ability], st.set);
    else if (s[st.ability] < st.max) s[st.ability] = Math.min(st.max, s[st.ability] + st.amount);
  }
  return s;
}

/** How each score is built: base, background increase, then every step with what it actually added (D&D Beyond's score calculations). */
export function scoreBreakdown(c: Character, steps: ScoreStep[], bgName?: string): Record<string, { label: string; amount: number; note?: string }[]> {
  const start = finalScores(c);
  const out: Record<string, { label: string; amount: number; note?: string }[]> = {};
  for (const a of ABILITIES) {
    out[a] = [{ label: "Base score", amount: c.base[a] ?? 10 }];
    const bg = start[a] - (c.base[a] ?? 10);
    if (c.bonus[a]) out[a].push({ label: bgName ? `${bgName} (background)` : "Background increase", amount: bg, note: bg < c.bonus[a] ? "capped at 20" : undefined });
  }
  const s = { ...start };
  for (const st of steps) {
    const before = s[st.ability];
    if (st.set !== undefined) s[st.ability] = Math.max(before, st.set);
    else if (before < st.max) s[st.ability] = Math.min(st.max, before + st.amount);
    const got = s[st.ability] - before;
    const list = (out[st.ability] ||= []);
    const last = list[list.length - 1];
    if (last && last.label === st.source && !last.note && st.set === undefined && got === st.amount) { last.amount += got; continue; }
    list.push({ label: st.source, amount: got, note: st.set !== undefined ? `sets it to ${st.set}` : got < st.amount ? `capped at ${st.max}` : undefined });
  }
  return out;
}

const DAMAGE_TYPES = ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder"];

/** Options for a `choose` block, or null when the app can't list them. */
export function choiceOptions(ch: Val, ctx: Pick<ModifCtx, "entries" | "byId"> & Partial<Pick<ModifCtx, "classes">>): ChoiceOption[] | null {
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
      const tool = kinds.includes("tool") ? ctx.entries.find((e) => e.type === "Tool" && slug(e.name) === x) : undefined;
      if (tool) return { value: tool.name, label: tool.name };
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
    // every condition at once ("a skill you're proficient in, out of Arcana, History…"); proficiency is checked by the caller
    if (Array.isArray(from.all)) {
      const lists = from.all.map((x: Val) => choiceOptions({ ...ch, from: typeof x === "string" ? [x] : x }, ctx));
      if (lists.some((l: ChoiceOption[] | null) => l === null)) return null;
      return (lists[0] as ChoiceOption[]).filter((o) => lists.every((l: ChoiceOption[]) => l.some((y) => y.value === o.value)));
    }
    // "one type of Artisan's Tools or Musical Instrument"
    if (Array.isArray(from.any)) {
      const out = from.any.flatMap((x: Val) => choiceOptions({ ...ch, from: typeof x === "string" ? [x] : x }, ctx) || []);
      const seen = new Set<string>();
      return out.length ? out.filter((o: ChoiceOption) => !seen.has(o.value) && seen.add(o.value)) : null;
    }
    if (from.tool?.category && slug(String(from.tool.category)) === "artisans-tools") {
      return ctx.entries
        .filter((e) => e.type === "Tool" && /(tools|supplies|utensils)$/i.test(e.name) && !/^(thieves|navigator)/i.test(e.name))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((e) => ({ value: e.name, label: e.name }));
    }
    if (from.tool?.category) {
      const tool = ctx.entries.find((e) => e.type === "Tool" && slug(e.name) === slug(String(from.tool.category)));
      const variants = (tool?.fields["variants"] || "").split(/,\s*/).map((v) => stripMd(v).replace(/\s*\([^)]*\)\s*$/, "").trim()).filter(Boolean);
      return variants.length ? variants.map((v) => ({ value: titled(v), label: titled(v) })) : null;
    }
    // any spell from a class's list ("two cantrips from the Wizard spell list")
    if (from.spell && !from.known) {
      const f = from.spell;
      // only what the app can check; others ("in your spellbook", "a slot you have") are picked by hand
      if (Object.keys(f).some((k) => !["list", "level", "school", "ritual", "max-level"].includes(k))) return null;
      if (Array.isArray(f.list)) return null;
      const list = typeof f.list === "string" && !f.list.startsWith("choice:") ? slug(f.list) : "";
      if (!list && f.list) return null;
      const levels = f.level === undefined ? null : ([] as Val[]).concat(f.level).map(Number);
      if (levels?.some((n) => Number.isNaN(n))) return null;
      return ctx.entries
        .filter((e) => e.type === "Spell")
        .filter((e) => {
          const t = e.tagline || "";
          const lvl = /cantrip/i.test(t) ? 0 : +(t.match(/^Level (\d+)/)?.[1] || -1);
          if (levels && !levels.includes(lvl)) return false;
          if (f["max-level"] !== undefined && lvl > +f["max-level"]) return false;
          if (f.school && !new RegExp(`\\b${String(f.school)}\\b`, "i").test(t)) return false;
          if (f.ritual && !/ritual/i.test(e.fields["casting time"] || "") && !/ritual/i.test(t)) return false;
          const lists = (t.match(/\(([^)]*)\)\s*$/)?.[1] || "").split(/,\s*/).map((x) => slug(x));
          return !list || lists.includes(list);
        })
        .sort((x, y) => x.name.localeCompare(y.name))
        .map((e) => ({ value: e.id, label: e.name }));
    }
    // one of the character's own spells ("one of your known Warlock cantrips that deals damage")
    if (from.known?.spell) {
      if (!ctx.classes) return null;
      const f = from.known.spell;
      const names = new Set<string>();
      for (const k of ctx.classes as (ClassRef & { cantrips?: string[]; spells?: string[] })[]) {
        if (f.list && slug(k.cls.name) !== slug(String(f.list))) continue;
        for (const n of [...(k.cantrips || []), ...(k.spells || [])]) names.add(n);
      }
      return ctx.entries
        .filter((e) => e.type === "Spell" && names.has(e.name))
        .filter((e) => f.level === undefined || +(e.tagline?.match(/^Level (\d+)/)?.[1] || 0) === +f.level)
        .filter((e) => !f.deals || blocksOf(e).some((b) => b.v && typeof b.v === "object" && b.v.damage))
        .sort((x, y) => x.name.localeCompare(y.name))
        .map((e) => ({ value: e.id, label: e.name }));
    }
    // any damage type, maybe with some left out ("one damage type other than Force")
    if (kinds.length === 1 && kinds[0] === "damage-type" && !Array.isArray(from)) {
      const not = ([] as Val[]).concat(from?.not || []).map(String);
      return DAMAGE_TYPES.filter((t) => !not.includes(t)).map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }));
    }
    // an ability filtered by the character's state ("one in which you lack saving throw proficiency"): all six, the player picks
    if (kinds.length === 1 && kinds[0] === "ability") return ABILITIES.map((a) => ({ value: a, label: a }));
    if (from.proficient === "skill") return SKILLS.map((x) => ({ value: x, label: x }));
    if (from.proficient === "weapon") return choiceOptions({ kind: "weapon", from: { weapon: {} } }, ctx);
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
export function computeModif(ctx0: ModifCtx): ModifResult {
  const ctx = withFixedFeatChoices(ctx0);
  const start = finalScores(ctx.c);
  const first = runModif(ctx, start, start);
  const scores = applyScoreSteps(start, first.scoreSteps);
  // expressions such as mod:con use the scores after feats, so read everything again with them
  const r = ABILITIES.some((a) => scores[a] !== start[a]) ? runModif(ctx, scores, start) : first;
  r.scores = scores;
  return r;
}

/**
 * A background's feat can name its option ("Magic Initiate (Wizard)"): that option is fixed, so the
 * feat's own choice is filled in with it and can't be changed.
 */
function withFixedFeatChoices(ctx: ModifCtx): ModifCtx {
  const field = ctx.background?.fields["feat"];
  const named = field ? stripMd(field).replace(/\s*\(see [^)]*\)/g, "").match(/^(.*?)\s*\(([^)]+)\)\s*$/) : null;
  if (!named) return ctx;
  const feat = ctx.entries.find((x) => x.type === "Feat" && x.name.toLowerCase() === named[1].trim().toLowerCase());
  if (!feat) return ctx;
  const want = slug(named[2]);
  const fixed: Record<string, string[]> = {};
  for (const fx of feat.effects || []) {
    for (const b of readBlocks(fx.yaml).blocks) {
      if (b.type !== "choose" || !Array.isArray(b.v?.options)) continue;
      if (b.v.options.some((o: Val) => String(o?.id) === want)) fixed[`${feat.id}#${b.v.id}`] = [want];
    }
  }
  if (!Object.keys(fixed).length) return ctx;
  return { ...ctx, c: { ...ctx.c, choices: { ...(ctx.c.choices || {}), ...fixed } }, fixedChoices: new Set(Object.keys(fixed)) };
}

function runModif(ctx: ModifCtx, scores: Record<string, number>, prereqScores: Record<string, number>): ModifResult {
  const r = emptyResult();
  const { c } = ctx;
  const mods = Object.fromEntries(ABILITIES.map((a) => [a, mod(scores[a])]));
  const pb = profBonus(c.level);
  const classLevels = Object.fromEntries(ctx.classes.map((k) => [slug(k.cls.name), k.level]));
  let slotLevel = 0;
  try {
    slotLevel = Math.max(0, ...spellSlots(ctx.classes as unknown as Parameters<typeof spellSlots>[0], ctx.entries).filter((x) => x.max > 0).map((x) => x.level));
  } catch { /* no slots */ }
  const baseEnv: Env = { level: c.level, total: c.level, pb, mods, scores, classLevels, table: {}, spell: ctx.spell, saveDc: {}, slotLevel: slotLevel || undefined };
  const seenFeats = new Set<string>();
  const activeKeys = new Set((ctx.active || []).map((x) => x.key));

  type ReadOpts = {
    level: number; table: Record<string, string>; info?: ClassRef; kind: "class" | "subclass" | "species" | "background" | "feat" | "item";
    origin?: string; slot?: string; item?: Item; itemActive?: boolean;
  };
  const readEntry = (e: Entry | undefined, opts: ReadOpts) => {
    if (!e?.effects?.length) return;
    const origin = opts.origin || e.id;
    if (opts.kind !== "item") r.encoded.add(e.id);
    const env: Env = { ...baseEnv, level: opts.level, table: opts.table, named: (t, col) => namedCell(e, t, col, opts.level) };
    if (opts.item) env.variants = itemVariants(e, opts.item);
    const featureList = opts.kind === "class" || opts.kind === "subclass" ? features(e) : [];
    const options = optionChoices(e, ctx, opts.slot);
    for (const fx of e.effects) {
      const { blocks: raw, problems } = readBlocks(fx.yaml);
      for (const p of problems) r.problems.push({ entry: e.name, feature: fx.feature, problem: p });
      const lvl = featureLevel(fx.feature);
      if ((opts.kind === "class" || opts.kind === "subclass") && lvl > opts.level) continue;
      const fname = featureName(fx.feature, e);
      // a section that is one option of a choice (an invocation, a lineage) applies only if it's chosen
      const gate = raw.find((b) => b.type === "option");
      if (gate && typeof gate.v?.of === "string") {
        const info = options.get(String(gate.v.of).replace(/^.*#/, ""));
        if (!info || !info.chosen.includes(optionName(fname))) continue;
      }
      const blocks = raw.map((b) => ({ type: b.type, v: substChoices(b.v, options, ctx, e, opts.slot) }));
      const core = isCore(fx.feature);
      const multiOnly = opts.kind === "class" && core && opts.info && !opts.info.starting;
      let applied = 0;
      let skipped = 0;
      const remind = (text: string) => {
        skipped++;
        r.reminders.push({ source: e.name, feature: fname, text });
      };
      const featText = featureList.find((f) => f.name === fname)?.md || "";
      // ids of picks that other blocks in this section read (`choice:agonizing-cantrip`)
      const readIds = new Set([...fx.yaml.matchAll(/choice:([\w-]+)/g)].map((m) => m[1]));
      for (const b of blocks) {
        if (multiOnly && b.type !== "multiclass" && b.type !== "hit-die" && b.type !== "equipment") continue;
        // an item that isn't active (not equipped or attuned as it needs) only keeps count of its charges
        if (opts.item && !opts.itemActive && b.type !== "charges" && b.type !== "resource") continue;
        const ok = applyBlock(b, {
          e, fname, env, opts, ctx, r, remind, featText, multiOnly: !!multiOnly, origin, slot: opts.slot, featureLevel: lvl,
          readFeat: (f) => readFeat(f, origin),
          featSlot: (id, level, def) => featSlot(e, opts.info, fname, id, level, def, origin),
          item: opts.item, activeKeys, options, readIds,
        });
        if (ok) applied++;
      }
      if (blocks.length && opts.kind !== "item") {
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
      .filter((x) => x.type === "Feat" && (!!ctx.c.ignorePrereqs || featQualifies(x, level, prereqScores, ctx)))
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
    // a fixed Tool Proficiency field ("Thieves' Tools"); "Choose one kind of…" is the background's own choose block
    const tool = stripMd(ctx.background.fields["tool proficiency"] || "").replace(/\s*\(see [^)]*\)/g, "").trim();
    if (tool && !/^choose/i.test(tool)) {
      const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "");
      for (const e of ctx.entries) if (e.type === "Tool" && norm(tool).split(/,\s*|\s+and\s+/).includes(norm(e.name))) r.tools.add(e.name);
    }
  }
  // magic items the character carries (effects only while active; charges always counted)
  for (const ic of ctx.items || []) readEntry(ic.entry, { level: c.level, table: {}, kind: "item", item: ic.item, itemActive: ic.active, origin: ic.entry.id });
  // spells in effect: their self-effects apply; the rest is listed
  for (const act of ctx.active || []) {
    if (!act.key.startsWith("spell:")) continue;
    const sp = ctx.byId(act.key.slice(6));
    if (!sp) continue;
    const lines: string[] = [];
    const env: Env = { ...baseEnv };
    // a spell whose range is Self affects you; for others the player says whether they're the target
    const selfRange = /^self/i.test(stripMd(sp.fields["range"] || ""));
    const onSelf = !!act.onSelf || selfRange;
    let targetEffects = false;
    for (const fx of sp.effects || []) {
      for (const b of readBlocks(fx.yaml).blocks) {
        const mine = b.type === "self-effects" || (b.type === "target-effects" && onSelf);
        if (b.type === "target-effects") targetEffects = true;
        if (mine) {
          for (const inner of toBlocks(b.v?.effects)) {
            lines.push(`On you: ${describeBlock(inner, env)}`);
            applyBlock(inner, {
              e: sp, fname: sp.name, env, opts: { level: c.level, kind: "spell" }, ctx, r, remind: () => undefined, featText: "", multiOnly: false,
              origin: sp.id, featureLevel: 1, readFeat: () => undefined, featSlot: () => undefined, activeKeys, inEffect: true,
            });
          }
        } else if (!["scaling", "narrative", "choose"].includes(b.type)) lines.push(describeBlock(b, env));
      }
    }
    if (!sp.effects?.length) lines.push(firstSentence(sp.body));
    r.activeSpells.push({
      key: act.key, spell: sp, slot: act.slot, lines: lines.filter(Boolean), concentration: /concentration/i.test(sp.fields["duration"] || ""),
      targetEffects: targetEffects && !selfRange, onSelf,
    });
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
  /** The inventory item whose entry this is (scope `self`, charges). */
  item?: Item;
  activeKeys: Set<string>;
  /** ids of picks that other blocks in the same section read */
  readIds?: Set<string>;
  /** Applying the effects of something switched on: they're described there, not in "Always on". */
  inEffect?: boolean;
  /** The entry's option choices (lineages, invocations), by choice id. */
  options?: Map<string, OptionChoice>;
}

interface OptionChoice { key: string; chosen: string[]; objects?: Val[] }

/** A heading as an option name: "Cloud’s Jaunt (Cloud Giant)" -> "Cloud’s Jaunt". */
const optionName = (title: string) => title.replace(/^Level \d+:\s*/, "").replace(/\s*\([^)]*\)\s*$/, "").trim();

/** Headings one level under the named heading: the options of `options: { headings-under }`. */
/** The class level an option section needs (`option: { prerequisite: { level: 5 } }`), 0 when none. */
function optionMinLevel(e: Entry, heading: string): number {
  const fx = (e.effects || []).find((f) => optionName(featureName(f.feature, e)) === optionName(heading));
  const gate = fx ? readBlocks(fx.yaml).blocks.find((b) => b.type === "option") : undefined;
  const lv = gate?.v?.prerequisite?.level;
  if (typeof lv === "number") return lv;
  // "*Prerequisite: Level 12+ Warlock, Thirsting Blade Invocation*" with no Effects to say it
  return +(optionPrereqText(e, heading).match(/Level (\d+)\+/)?.[1] || 0);
}

/** Skills the character is proficient in, and the ones picked for Expertise by other choices than `except`. */
function skillsHeld(ctx: ModifCtx, except: string): { skills: Set<string>; expert: Set<string> } {
  const c = ctx.c;
  const skills = new Set<string>([...(c.classSkills || []), ...(c.extraSkills || [])]);
  const bg = stripMd(ctx.background?.fields["skill proficiencies"] || "");
  for (const s of SKILLS) if (bg.includes(s)) skills.add(s);
  const expert = new Set<string>();
  for (const [k, list] of Object.entries(c.choices || {})) {
    if (k === except) continue;
    const isExpert = /expertise/i.test(k.replace(/^.*#/, ""));
    for (const x of list) if (SKILLS.includes(x)) (isExpert ? expert : skills).add(x);
  }
  return { skills, expert };
}

function optionPrereqText(e: Entry, heading: string): string {
  const sec = e.sections.find((x) => optionName(x.title) === optionName(heading));
  return stripMd(sec?.md.match(/Prerequisite:[^\n]*/i)?.[0] || "");
}

/** Another option this one needs ("Thirsting Blade Invocation", "Pact of the Blade Invocation"). */
function optionNeeds(e: Entry, heading: string, all: string[]): string | undefined {
  const t = optionPrereqText(e, heading);
  return all.find((o) => o !== heading && new RegExp(`\\b${o.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(t));
}

function headingsUnder(e: Entry, title: string): string[] {
  const i = e.sections.findIndex((x) => optionName(x.title) === optionName(title));
  if (i < 0) return [];
  const out: string[] = [];
  for (let k = i + 1; k < e.sections.length && e.sections[k].level > e.sections[i].level; k++) {
    if (e.sections[k].level === e.sections[i].level + 1) out.push(optionName(e.sections[k].title));
  }
  return out;
}

/** Every option-kind `choose` in an entry, with what's chosen (lineage tables use the builder's species choice). */
function optionChoices(e: Entry, ctx: ModifCtx, slot?: string): Map<string, OptionChoice> {
  const out = new Map<string, OptionChoice>();
  for (const fx of e.effects || []) {
    for (const b of readBlocks(fx.yaml).blocks) {
      const v = b.v;
      if (b.type !== "choose" || !v?.id || v.kind !== "option") continue;
      const key = slot ? `${slot}/${e.id}#${v.id}` : `${e.id}#${v.id}`;
      const objects = Array.isArray(v.options) ? v.options : undefined;
      let chosen = ctx.c.choices?.[key] || [];
      if (objects && e.type === "Species") {
        const table = speciesChoice(e);
        const pick = (ctx.c.speciesChoice || "").toLowerCase();
        if (table && pick) {
          const hit = objects.find((o: Val) => String(o.label || o.id).toLowerCase() === pick || String(o.id) === slug(pick));
          if (hit) chosen = [String(hit.id)];
        }
      }
      if (!chosen.length && v.default) chosen = [String(v.default)];
      out.set(String(v.id), { key, chosen, objects });
    }
  }
  return out;
}

/** Replace "choice:<id>" and "choice:<id>.<field>" in a block with what the character chose. */
/** The `choose` block with this id among an entry's effects. */
function chooseIn(e: Entry, id: string): Val | undefined {
  for (const fx of e.effects || []) {
    for (const b of readBlocks(fx.yaml).blocks) if (b.type === "choose" && b.v?.id === id) return b.v;
  }
  return undefined;
}

function substChoices(v: Val, options: Map<string, OptionChoice>, ctx: ModifCtx, e: Entry, slot?: string): Val {
  if (typeof v === "string") {
    const m = v.match(/^choice:([\w-]+)(?:\.([\w-]+))?$/);
    if (!m) {
      // a chosen ability inside an expression: "8 + mod:choice:tk-ability + prof"
      return v.replace(/\b(mod|score):choice:([\w-]+)/g, (all, k, id) => {
        const got = substChoices(`choice:${id}`, options, ctx, e, slot);
        const name = typeof got === "string" && !got.startsWith("choice:") ? got : "";
        const ab = ABBR3[name.toLowerCase()] ? name.toLowerCase() : ABILITIES.includes(name) ? name.slice(0, 3).toLowerCase() : "";
        return ab ? `${k}:${ab}` : all;
      });
    }
    const opt = options.get(m[1]);
    if (opt) {
      const obj = opt.objects?.find((o: Val) => String(o.id) === opt.chosen[0]);
      if (obj && m[2]) return obj[m[2]] ?? v;
      return opt.chosen[0] ?? v;
    }
    const stored = ctx.c.choices?.[slot ? `${slot}/${e.id}#${m[1]}` : `${e.id}#${m[1]}`];
    return !m[2] && stored?.length ? stored[0] : v;
  }
  if (Array.isArray(v)) return v.map((x) => substChoices(x, options, ctx, e, slot));
  if (v && typeof v === "object") {
    // a choose block keeps its own option objects; only values elsewhere are filled in
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "options" ? x : substChoices(x, options, ctx, e, slot)]));
  }
  return v;
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

/** A list of `{ type: value }` maps (a toggle's `effects`) as blocks. */
export function toBlocks(list: Val): Block[] {
  return (Array.isArray(list) ? list : [])
    .filter((x) => x && typeof x === "object" && !Array.isArray(x) && Object.keys(x).length === 1)
    .map((x) => {
      const [type, v] = Object.entries(x)[0];
      return { type, v };
    });
}

/** Variant values chosen by the spell on a scroll (`by: spell-level`). */
function spellLevelVariants(e: Entry, level: number): Record<string, Val> {
  const out: Record<string, Val> = {};
  for (const fx of e.effects || []) {
    for (const b of readBlocks(fx.yaml).blocks) {
      if (b.type === "variant" && b.v?.by === "spell-level" && b.v.values && String(level) in b.v.values) out[b.v.id] = b.v.values[String(level)];
    }
  }
  return out;
}

/** Variant values of an inventory item: "+2 Longsword" picks the rarity whose value is 2; "(hill)" picks by name. */
function itemVariants(e: Entry, item: Item): Record<string, Val> {
  const out: Record<string, Val> = {};
  for (const fx of e.effects || []) {
    for (const b of readBlocks(fx.yaml).blocks) {
      if (b.type !== "variant" || !b.v?.id || !b.v.values || typeof b.v.values !== "object" || Array.isArray(b.v.values)) continue;
      const vals = b.v.values as Record<string, Val>;
      if (b.v.by === "rarity") {
        const plus = item.name.match(/\+(\d)/)?.[1];
        const hit = plus ? Object.values(vals).find((x) => x === +plus) : undefined;
        if (hit !== undefined) out[b.v.id] = hit;
      } else if (b.v.by === "stage") {
        // an evolving item's stage is the first word of its name ("Flowering Blossom Rod"); "" is the unnamed first stage
        const first = item.name.trim().split(/\s+/)[0]?.toLowerCase() || "";
        const key = Object.keys(vals).find((k) => k.toLowerCase() === first) ?? ("" in vals ? "" : undefined);
        if (key !== undefined) out[b.v.id] = vals[key];
      } else if (b.v.by === "name") {
        const q = (item.name.match(/\(([^)]*)\)\s*$/)?.[1] || "").toLowerCase();
        const key = Object.keys(vals).find((k) => k.toLowerCase() === q) ?? (q ? undefined : "");
        if (key !== undefined && key in vals) out[b.v.id] = vals[key];
      }
    }
  }
  // the item's rarity: from its evolving stage, else from its tagline when it names one rarity
  const stage = Object.values(out).find((x) => typeof x === "string" && RARITIES.includes(x as string));
  const tag = (e.tagline || "").toLowerCase().replace(/very rare/g, "very-rare");
  const named = RARITIES.filter((r) => new RegExp(`(?<![\\w-])${r}(?![\\w-])`).test(tag));
  if (stage) out["@rarity"] = stage;
  else if (named.length === 1) out["@rarity"] = named[0];
  return out;
}
const RARITIES = ["common", "uncommon", "rare", "very-rare", "legendary", "artifact"];

/** Key in the play state for a toggle or resource: items keep their own per inventory item. */
function scopedKey(a: ApplyCtx, id: string): string {
  return a.item ? `item:${a.item.id}:${id}` : id;
}

/** The key of a resource named by a cost or reference ("$#rages", "$srd/barbarian#rages", "rages"). */
function resourceKey(a: ApplyCtx, ref: string): string {
  const local = ref.replace(/^\$[^#]*#/, "").replace(/^\$#/, "");
  return ref.startsWith("$#") || !ref.startsWith("$") ? scopedKey(a, local) : local;
}

/** A `convert` block as the trades the sheet can offer (Modif §5: "Trade one pool for another"). */
function convertOf(v: Val, a: ApplyCtx): Omit<ModifConvert, "source"> | null {
  if (!v?.from || !v?.to) return null;
  const { env } = a;
  const withCost = (expr: Val, cost: Record<string, number>): number | null => {
    if (typeof expr === "number") return expr;
    let s = String(expr ?? "");
    for (const [k, n] of Object.entries(cost)) s = s.replace(new RegExp(`cost\\.${k}`, "g"), String(n));
    return evalNumber(s, env);
  };
  const side = (x: Val, cost: Record<string, number>, slotLevel?: number): ConvertSide | null => {
    if (x.resource) {
      const n = x.amount === undefined ? 1 : withCost(x.amount, cost);
      return n === null ? null : { resource: resourceKey(a, String(x.resource)), amount: n };
    }
    if (x.slot !== undefined) {
      if (x.slot === "pact") return { slot: "pact", amount: 1 };
      const lvl = slotLevel ?? withCost(x.slot, cost);
      return lvl === null || lvl < 1 || lvl > 9 ? null : { slot: lvl, amount: 1 };
    }
    return null;
  };
  const options: ModifConvert["options"] = [];
  const f = v.from, t = v.to;
  const maxSlot = typeof t["max-slot"] === "number" ? t["max-slot"] : 9;
  // table-driven: "table:Creating Spell Slots.Sorcery Point Cost"
  const tref = [f.amount, t.slot].map(String).find((x) => /^table:[^.]+\./.test(x));
  if (tref) {
    const tname = tref.slice(6).split(".")[0];
    const want = [f.amount, t.slot].map((x) => String(x).replace(/^table:[^.]+\./, "").toLowerCase());
    const tbl = parseTables(a.e.body).find((tb) => want.every((w) => tb.header.some((h) => h.toLowerCase() === w)));
    void tname;
    if (!tbl) return null;
    const col = (ref: Val) => tbl.header.findIndex((h) => h.toLowerCase() === String(ref).replace(/^table:[^.]+\./, "").toLowerCase());
    const [ci, si, mi] = [col(f.amount), col(t.slot), col(t["min-level"])];
    for (const row of tbl.rows) {
      const cost = parseInt(row[ci]), lvl = parseInt(row[si]), min = mi >= 0 ? parseInt(row[mi]) : 0;
      if (!cost || !lvl || lvl > maxSlot || (min && env.level < min)) continue;
      options.push({ spend: { resource: resourceKey(a, String(f.resource)), amount: cost }, gain: { slot: lvl, amount: 1 } });
    }
  } else if (f.slot !== undefined && f.slot !== "pact" && (f.slot === "any" || typeof f.slot === "number")) {
    const levels = f.slot === "any" ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [f.slot];
    for (const L of levels) {
      const gain = side(t, { slot: L });
      if (gain) options.push({ spend: { slot: L, amount: 1 }, gain });
    }
  } else if (f.resource && (f.amount === "any" || (f.amount && typeof f.amount === "object"))) {
    const lo = typeof f.amount === "object" && f.amount.min ? f.amount.min : 1;
    for (let n = lo; n <= 9; n++) {
      const gain = side(t, { resource: n });
      if (gain && (gain.slot === undefined || (typeof gain.slot === "number" && gain.slot <= maxSlot))) options.push({ spend: { resource: resourceKey(a, String(f.resource)), amount: n }, gain });
    }
  } else {
    const spend = side(f, {}), gain = spend && side(t, { resource: spend.amount, slot: typeof spend.slot === "number" ? spend.slot : 0 });
    if (spend && gain) options.push({ spend, gain });
  }
  if (!options.length) return null;
  return {
    id: `${a.e.id}#${slug(a.fname)}:${options.length}:${JSON.stringify(options[0])}`,
    name: a.fname,
    activation: typeof v.activation === "string" ? v.activation : "none",
    options,
    ifEmpty: !!v["if-empty"],
    perLong: v.per === "long",
    expires: t.expires === "long",
  };
}

function costOf(cost: Val, a: ApplyCtx): ModifCost | undefined {
  if (!cost || typeof cost !== "object") return undefined;
  if (typeof cost.resource === "string") {
    const key = resourceKey(a, cost.resource);
    if (cost.any) return { key, amount: 1, min: 1, any: true };
    if (cost.amount && typeof cost.amount === "object") {
      const min = evalNumber(cost.amount.min ?? 1, a.env) ?? 1;
      const max = cost.amount.max !== undefined ? evalNumber(cost.amount.max, a.env) ?? undefined : undefined;
      return { key, amount: min, min, max };
    }
    return { key, amount: typeof cost.amount === "number" ? cost.amount : 1 };
  }
  if (cost.charges !== undefined && a.item) {
    const ch = cost.charges;
    if (typeof ch === "number") return { key: `item:${a.item.id}`, amount: ch };
    if (ch && typeof ch === "object") return { key: `item:${a.item.id}`, amount: ch.min ?? 1, min: ch.min ?? 1, max: ch.max };
  }
  return undefined;
}

function toggleKey(a: ApplyCtx, id: string): string {
  return a.item ? `item:${a.item.id}#${id}` : `${a.e.id}#${id}`;
}

/** The toggle key a `when: { active: … }` reference means. */
function activeRefKey(a: ApplyCtx, ref: string): string {
  const id = ref.replace(/^.*#/, "");
  if (ref.startsWith("$#") || !ref.startsWith("$")) return toggleKey(a, id);
  const ent = resolveRef(ref.split("#")[0], a.ctx);
  return `${ent?.id || ref.split("#")[0]}#${id}`;
}

const titleCase = (s: string) => String(s ?? "").replace(/(^|[\s-])\w/g, (x) => x.toUpperCase()).replace(/-/g, " ");

/** true / false when the sheet can tell, null when only the player can (Modif §3.5). */
function whenEval(w: Val, a: ApplyCtx): boolean | null {
  if (!w || typeof w !== "object") return null;
  if (Array.isArray(w)) {
    const parts = w.map((x) => whenEval(x, a));
    return parts.includes(false) ? false : parts.includes(null) ? null : true;
  }
  let unknown = false;
  for (const [k, x] of Object.entries(w)) {
    let res: boolean | null = null;
    if (k === "active") res = ([] as Val[]).concat(x).some((ref) => typeof ref === "string" && a.activeKeys.has(activeRefKey(a, ref)));
    else if (k === "not") {
      const n = whenEval(x, a);
      res = n === null ? null : !n;
    } else if (k === "all") res = whenEval(x, a);
    else if (k === "any") {
      const parts = ([] as Val[]).concat(x).map((p) => whenEval(p, a));
      res = parts.includes(true) ? true : parts.includes(null) ? null : false;
    } else if (k === "armor" && a.ctx.gear) {
      const worn = a.ctx.gear.armor;
      res = x === "none" ? !worn : ([] as Val[]).concat(x).includes(worn);
    } else if (k === "shield" && a.ctx.gear) res = a.ctx.gear.shield === !!x;
    else if (k === "condition" && a.ctx.conditions) {
      const have = a.ctx.conditions.map((cn) => cn.toLowerCase());
      res = ([] as Val[]).concat(x).some((cn) => have.includes(String(cn).toLowerCase()));
    } else if ((k === "wielding" || k === "equipped" || k === "attuned") && a.item) res = true;
    else if (/^level(:[\w-]+)?$/.test(k) && typeof x === "string") {
      const m = x.match(/^(>=|<=|>|<|=)?\s*(\d+)$/);
      const lv = k === "level" ? a.env.total : a.env.classLevels[k.slice(6)] ?? 0;
      if (m) res = m[1] === "<=" ? lv <= +m[2] : m[1] === "<" ? lv < +m[2] : m[1] === ">" ? lv > +m[2] : m[1] === "=" ? lv === +m[2] : lv >= +m[2];
    }
    else if (k === "has" && a.item && x && typeof x === "object" && (x as Val).item === "self") res = true;
    else if (k === "rarity" && a.item && a.env.variants?.["@rarity"]) {
      // an evolving item's property: `rarity: ">= rare"` (or an exact rarity)
      const have = RARITIES.indexOf(String(a.env.variants["@rarity"]));
      const m = String(x).match(/^(>=|<=|>|<|=)?\s*([a-z-]+)$/);
      const want = m ? RARITIES.indexOf(m[2]) : -1;
      if (have >= 0 && want >= 0) res = m![1] === ">=" ? have >= want : m![1] === "<=" ? have <= want : m![1] === ">" ? have > want : m![1] === "<" ? have < want : have === want;
    }
    else if (k === "choice" && x && typeof x === "object" && a.options?.has(String((x as Val).id))) {
      // an option picked in this entry's choice ({ id: land, is: arid }, or a list of options)
      const info = a.options.get(String((x as Val).id))!;
      res = ([] as Val[]).concat((x as Val).is).some((v) => info.chosen.includes(String(v)));
    }
    else if (k === "variant" && x && typeof x === "object" && a.env.variants && (x as Val).id in a.env.variants) res = a.env.variants[(x as Val).id] === (x as Val).is;
    if (res === false) return false;
    if (res === null) unknown = true;
  }
  return unknown ? null : true;
}

/** A `when` in words, for reminders. */
function whenText(w: Val): string {
  if (!w || typeof w !== "object") return "";
  if (Array.isArray(w)) return w.map(whenText).filter(Boolean).join("; ");
  return Object.entries(w)
    .map(([k, x]) => {
      if (k === "player" || k === "text") return String(x);
      if (k === "active") return `while ${([] as Val[]).concat(x).map((r) => titleCase(String(r).replace(/^.*#/, ""))).join(" or ")} is active`;
      if (k === "not") return `unless ${whenText(x)}`;
      if (k === "armor") return x === "none" ? "while not wearing armor" : `while wearing ${([] as Val[]).concat(x).join(" or ")} armor`;
      if (k === "condition") return `while ${([] as Val[]).concat(x).map((c) => titleCase(String(c))).join(" or ")}`;
      if (k === "hp") return x === "bloodied" ? "while Bloodied" : `at ${x} HP`;
      if (k === "in-combat") return "in combat";
      if (k === "has" && (x as Val)?.item === "self") return "while you carry it";
      if (k === "variant") return `${titleCase(String((x as Val)?.is ?? ""))} only`;
      return `${k.replace(/-/g, " ")}: ${words(x)}`;
    })
    .join(", ");
}

const ABIL_NAME = (x: string) => ABBR3[x] || titleCase(x);

/** Any small value in words: "radiant", ["fire", "cold"], { light: { bright: 20 } }, "$srd/spells/magic-missile". */
function words(x: Val): string {
  if (x === null || x === undefined) return "";
  if (typeof x === "string") return x.startsWith("$") ? titleCase(x.includes("#") ? x.replace(/^.*#/, "") : x.replace(/^.*\//, "")) : titleCase(x);
  if (typeof x === "number" || typeof x === "boolean") return String(x);
  if (Array.isArray(x)) return x.map(words).filter(Boolean).join(", ");
  if (x.text) return String(x.text);
  if (x.label) return String(x.label);
  return Object.entries(x).map(([k, v]) => (v === true ? titleCase(k) : `${titleCase(k)} ${words(v)}`)).join(", ");
}

function valueText(v: Val, env?: Env): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    const a = env ? evalAmount(v, env) : null;
    return a ? amountText(a) : v;
  }
  if (v.steps && env) {
    const n = evalAmount(v, env);
    return n === null ? "" : amountText(n);
  }
  if (v.dice !== undefined) return valueText(v.dice, env);
  return words(v);
}

function rollText(roll: Val): string {
  return ([] as Val[]).concat(roll).map((x) => {
    const s = String(x);
    const [k, arg] = s.split(":");
    if (s === "initiative") return "Initiative";
    if (s === "death-save") return "Death Saving Throws";
    if (s === "attack") return "attack rolls";
    if (s === "attacks-against-you") return "attack rolls against you";
    if (k === "save") return !arg || arg === "all" ? "saving throws" : `${ABIL_NAME(arg)} saving throws`;
    if (k === "check") return !arg || arg === "all" ? "ability checks" : `${ABIL_NAME(arg)} checks`;
    if (k === "skill") return `${titleCase(arg)} checks`;
    return s.replace(/-/g, " ");
  }).join(" and ");
}

function damageText(d: Val, env?: Env): string {
  return ([] as Val[]).concat(d).filter(Boolean).map((p) => {
    const type = typeof p.type === "string" ? (p.type.startsWith("choice:") ? "chosen-type" : p.type) : p.type?.["choose-on-use"] ? ([] as Val[]).concat(p.type["choose-on-use"]).join("/") : "";
    return `${valueText(p.dice ?? p, env)} ${type === "attack" ? "(the attack's type)" : type}`.trim() + (p.half ? " (half on a success)" : "");
  }).join(" + ");
}

function saveText(sv: Val, env?: Env): string {
  if (!sv || typeof sv !== "object") return "";
  const dc = sv.dc !== undefined ? valueText(sv.dc, env) : "";
  return `${dc ? `DC ${dc} ` : ""}${ABIL_NAME(String(sv.ability || ""))} save${sv.success === "half" ? " (half on a success)" : ""}`;
}

export function durationOf(d: Val, env?: Env): { text: string; minutes: number } {
  if (!d) return { text: "", minutes: Infinity };
  if (typeof d === "string") return { text: d === "spell" ? "while the spell lasts" : d.replace(/-/g, " "), minutes: d === "spell" ? Infinity : 0.1 };
  if (d.until) {
    const max = d.max ? durationOf(d.max) : null;
    return { text: `until ${String(d.until).replace(/-/g, " ")}${d.extend ? ` (extend: ${d.extend})` : ""}${max ? `, up to ${max.text}` : ""}`, minutes: max ? max.minutes : 1 };
  }
  if (d.amount !== undefined) {
    // "half(level:druid)" hours: worked out when the reader can (Wild Shape)
    const v = typeof d.amount === "number" ? d.amount : env ? evalNumber(d.amount, env) : null;
    const n = v ?? 1;
    const unit = String(d.unit || "minute");
    const per: Record<string, number> = { round: 0.1, minute: 1, hour: 60, day: 1440 };
    return { text: `${v ?? d.amount} ${unit}${n === 1 ? "" : "s"}`, minutes: n * (per[unit] ?? 1) };
  }
  return { text: "", minutes: Infinity };
}

/** Header "Duration" of a spell: minutes it lasts (0 = instantaneous). */
export function spellMinutes(field?: string): number {
  const t = stripMd(field || "").toLowerCase();
  if (!t || /instantaneous/.test(t)) return 0;
  const m = t.match(/(\d+)\s*(round|minute|hour|day)/);
  if (m) return +m[1] * ({ round: 0.1, minute: 1, hour: 60, day: 1440 } as Record<string, number>)[m[2]];
  return Infinity; // until dispelled, special
}

function eventText(ev: Val): string {
  if (Array.isArray(ev)) return ev.map(eventText).join(" or ");
  if (typeof ev === "string") {
    const words: Record<string, string> = {
      hit: "When you hit", "hit-first": "The first time you hit a creature on your turn", miss: "When you miss with an attack", crit: "When you score a Critical Hit", attack: "When you attack",
      "start-of-turn": "At the start of your turn", "reduce-to-zero": "When an enemy drops to 0 Hit Points", "end-of-turn": "At the end of your turn", cast: "When you cast a spell",
      "take-damage": "When you take damage", damaged: "When you take damage", "enter-area": "When a creature enters the area",
      initiative: "When you roll Initiative", "hit-by": "When an attack hits you", fall: "When you fall", "deal-damage": "When you deal damage", "zero-hp": "When reduced to 0 Hit Points", targeted: "When an attack or spell targets a creature", "move-through": "When a creature moves through the area", "forced-move": "When you are moved against your will",
    };
    return words[ev] || `On ${ev.replace(/-/g, " ")}`;
  }
  if (ev && typeof ev === "object") {
    if (ev.fail) return `When you fail ${ev.fail === "save" ? "a saving throw" : ev.fail === "check" ? "an ability check" : ev.fail === "d20" ? "a D20 Test" : rollText(ev.fail)}`;
    if (ev.succeed) return `When you succeed on ${ev.succeed === "d20" ? "a D20 Test" : rollText(ev.succeed)}`;
    if (ev.rest) return `When you finish a ${ev.rest === "long" ? "Long" : "Short"} Rest`;
    if (ev.use) return `When you use ${titleCase(String(ev.use).replace(/^.*#/, ""))}`;
    if (ev.roll) return `When you roll ${rollText(ev.roll)}`;
    return `On ${Object.entries(ev).map(([k, x]) => `${k.replace(/-/g, " ")} ${words(x)}`).join(", ")}`;
  }
  return "When it happens";
}

function offerText(o: Val, env?: Env): string {
  if (!o || typeof o !== "object") return "";
  if (o.text) return String(o.text);
  const parts: string[] = [];
  if (o.reroll && typeof o.reroll === "object") parts.push(`Roll the ${o.reroll.roll === "damage" ? "damage dice" : rollText(o.reroll.roll || "die")} again${o.reroll.keep === "either" ? " and use either roll" : o.reroll.keep === "higher" ? " and use the higher roll" : ""}`);
  else if (o.reroll) parts.push(`Reroll${o.bonus ? ` with a bonus of ${valueText(o.bonus, env)}` : ""}${o["must-use-new"] ? " and use the new roll" : ""}`);
  if (o["add-roll"]) {
    const ar = o["add-roll"];
    const neg = typeof ar === "string" && ar.startsWith("-");
    const txt = valueText(neg ? ar.slice(1) : ar, env).replace(/^table:/, "your ");
    parts.push(neg ? `Subtract ${txt} from the roll` : `Add ${txt} to the roll`);
  }
  if (o.move) parts.push(`Move up to ${o.move.distance === "half-speed" ? "half your Speed" : o.move.teleport ? `${o.move.teleport} ft by teleporting` : `${o.move.distance} ft`}${o.move["no-opportunity-attacks"] ? " without provoking Opportunity Attacks" : ""}`);
  if (o.regain) parts.push(`Regain ${titleCase(String(o.regain.resource || "").replace(/^.*#/, ""))}`);
  if (o["damage-taken"] === "half") parts.push("Halve the attack's damage against you");
  if (o["damage-taken"]?.reduce !== undefined) parts.push(`Reduce the damage by ${valueText(o["damage-taken"].reduce, env)}`);
  if (o.heal !== undefined) parts.push(`Regain ${valueText(o.heal, env)} HP`);
  if (o.damage) parts.push(`Deal ${damageText(o.damage, env)} damage`);
  if (o.save) parts.push(saveText(o.save, env));
  if (o["temp-hp"] !== undefined) parts.push(`Gain ${valueText(o["temp-hp"], env)} Temporary Hit Points`);
  if (o.apply?.condition) parts.push(`${o.save ? "On a failed save: " : "The target can be given: "}${titleCase(String(o.apply.condition))}${o.apply.duration?.until ? ` until the ${String(o.apply.duration.until).replace(/-/g, " ")}` : ""}`);
  if (o["on-success"]?.text) parts.push(`On a success: ${o["on-success"].text}`);
  if (o["choose-one"]) parts.push(`Choose: ${([] as Val[]).concat(o["choose-one"]).map((x) => x.label || x.id).join(", ")}`);
  if (o["treat-as"]) parts.push(`Count it as a ${o["treat-as"]}`);
  if (o.refund) parts.push(o.refund === "if-fails" ? "Not spent if it doesn't change the result" : `Refund ${o.refund}`);
  if (o.then && typeof o.then === "object") {
    const t = offerText({ ...o.then, text: undefined }, env);
    const cost = o.then.cost?.resource ? `spend 1 ${titleCase(String(o.then.cost.resource).replace(/^.*#/, ""))}` : "";
    if (t || cost) parts.push(`${o.then.if ? `If ${String(o.then.if).replace(/^The /, "the ")}` : "Then"}, ${[cost, t.replace(/^\w/, (x) => x.toLowerCase())].filter(Boolean).join(": ")}${o.then.text ? ` (${o.then.text})` : ""}`);
  }
  return parts.join(". ");
}

/** One block in words, for the active effects list and reminders. Never throws: content can be anything. */
export function describeBlock(b: Block, env?: Env): string {
  try {
    return describeInner(b, env);
  } catch {
    return b.type.replace(/-/g, " ");
  }
}

function describeInner(b: Block, env?: Env): string {
  const v = b.v;
  const w = v && typeof v === "object" && v.when ? ` (${whenText(v.when)})` : "";
  switch (b.type) {
    case "defense": {
      const p: string[] = [];
      const except = v.except ? ` except ${([] as Val[]).concat(v.except).map(titleCase).join(", ")}` : "";
      if (v.resistance) p.push(`Resistance to ${([] as Val[]).concat(v.resistance).map((x) => (x === "all" ? "all damage" : words(x))).join(", ")}${except}`);
      if (v.immunity) p.push(`Immunity to ${([] as Val[]).concat(v.immunity).map(words).join(", ")}`);
      if (v.vulnerability) p.push(`Vulnerability to ${([] as Val[]).concat(v.vulnerability).map(words).join(", ")}`);
      if (v["condition-immunity"]) p.push(`Immune to ${([] as Val[]).concat(v["condition-immunity"]).map((x) => (x === "magical-sleep" ? "magical sleep" : `the ${words(x)} condition`)).join(" and ")}`);
      return p.join("; ") + w;
    }
    case "bonus": {
      const to = ([] as Val[]).concat(v.to).map((t) => {
        const s = String(t);
        if (s === "ac") return "AC";
        if (s === "attack") return "attack rolls";
        if (s === "damage") return "damage";
        if (s === "initiative") return "Initiative";
        if (s.startsWith("speed")) return "Speed";
        if (s === "hp:max") return "Hit Point maximum";
        if (s === "spell:attack") return "spell attack rolls";
        if (s === "spell:dc") return "spell save DC";
        if (s === "carry:size") return "size for carrying capacity";
        return rollText(s);
      }).join(" and ");
      const val = valueText(v.value, env);
      const scope = v.scope?.ability ? ` (${ABIL_NAME(v.scope.ability)} attacks)` : v.scope?.weapon?.kind ? ` (${v.scope.weapon.kind} weapons)` : "";
      return `${/^-/.test(val) ? val : `+${val}`} to ${to}${scope}${w}`;
    }
    case "advantage":
    case "disadvantage":
      return `${b.type === "advantage" ? "Advantage" : "Disadvantage"} on ${rollText(v.roll)}${v.scope?.ability ? ` (${ABIL_NAME(v.scope.ability)})` : ""}${againstText(v.scope?.against)}${w}`;
    case "base":
      return `${v.to === "ac" ? "AC" : v.to} = ${String(v.value).replace(/mod:(\w+)/g, (_, x) => `${ABIL_NAME(x).slice(0, 3)}`)}${w}`;
    case "set":
      return `${String(v.to).replace(/^score:(\w+)$/, (_, x) => `${ABIL_NAME(x)} score`).replace(/^speed:(all|walk)$/, "Speed").replace(/^attunement:slots$/, "attunement slots")} ${v.mode === "min" ? "at least" : v.mode === "multiply" ? "×" : "becomes"} ${valueText(v.value, env)}${w}`;
    case "size":
      return typeof v === "string" ? `Size becomes ${titleCase(v)}${w}` : `Size changes${w}`;
    case "speed":
      return Object.entries(v).filter(([k]) => k !== "when").map(([k, x]) => `${titleCase(k)} Speed ${valueText(x, env)}${typeof x === "number" ? " ft" : ""}`).join(", ") + w;
    case "sense":
      return Object.entries(v).filter(([k]) => k !== "when").map(([k, x]) => `${k === "devils-sight" ? "See in magical and nonmagical darkness" : titleCase(k)} ${x === "unlimited" ? "(unlimited)" : typeof x === "object" ? words(x) : `${x} ft`}`).join(", ") + w;
    case "save-rule":
      if (!v.ability && v.scope?.spell) {
        // a rule for spells you cast (Potent Cantrip), not for your own saves (Evasion)
        const sp = v.scope.spell, what = sp.level === 0 ? "Your cantrips" : "Your spells";
        const parts = [v.success === "half" ? "a target that succeeds on the save takes half damage" : "", v.miss === "half" ? "a missed attack roll still deals half damage" : ""].filter(Boolean);
        return `${what}: ${parts.join(", and ")}${v.text ? `. ${v.text}` : ""}${w}`;
      }
      return `${ABIL_NAME(String(v.ability))} saves against effects that allow half damage: no damage on a success${v.failure === "half" ? ", half on a failure" : ""}${w}`;
    case "cancel-advantage":
      return `${rollText(v.roll).replace(/^attack rolls against you$/, "Attack rolls against you")} can't have Advantage${w}`;
    case "modify":
      return `Changes ${words(v.target)}${v.text ? `: ${v.text}` : ""}`;
    case "condition":
      return `You have the ${([] as Val[]).concat(v.add ?? v).map(words).join(" and ")} condition${v.duration ? ` (${durationOf(v.duration).text})` : ""}`;
    case "trait":
      return words(v);
    case "summon-options":
      return `Changes what ${typeof v.for === "string" ? words(v.for) : "a summon"} can summon${v.add ? `: also ${([] as Val[]).concat(v.add).map((x) => words(x)).join(", ")}` : ""}`;
    case "summon":
      return `Summons ${v.creature ? words(v.creature) : "a creature"} (see the rules)`;
    case "note":
    case "custom":
      return v?.text || "";
    case "language":
      return `Languages: ${([] as Val[]).concat(v).join(", ")}`;
    case "crit-range":
      return `Critical Hit on ${v.value}–20`;
    case "reroll":
      return `Reroll ${v.if !== undefined ? `a ${v.if} on ` : ""}${v.roll === "d20" ? "the d20" : rollText(v.roll || "the die")}${v["must-use-new"] ? " (you must use the new roll)" : ""}`;
    case "extra-attack":
      return `Attack ${v.total} times with the Attack action`;
    case "damage-die":
      return `Damage die ${valueText(v.die, env)}${w}`;
    case "use-ability":
      return `Use ${ABIL_NAME(v.ability)} for ${([] as Val[]).concat(v.for || []).map((x) => rollText(x)).join(", ")}${w}`;
    case "aura": {
      const inner = toBlocks(v.effects).map((x) => describeBlock(x, env)).join("; ");
      return `Aura (${typeof v.area?.size === "number" ? v.area.size : valueText(v.area?.size, env) || "?"} ft${v.affects ? `, ${([] as Val[]).concat(v.affects).join(" and ")}` : ""}): ${inner}`;
    }
    case "zone": {
      const ev = v.event ? ` ${eventText(v.event).toLowerCase()}` : "";
      return `Area${v.area?.size ? ` (${v.area.size} ft ${v.area.shape || ""})`.replace(/ \)/, ")") : ""}:${ev}${v.save ? `, ${saveText(v.save, env)}` : ""}${v.damage ? `, ${damageText(v.damage, env)} damage` : ""}${v.heal ? `, heal ${valueText(v.heal, env)}` : ""}${v.apply ? `, ${applyText(v.apply)}` : ""}`.replace(/:,/, ":").replace(/:$/, "");
    }
    case "target-effects":
      return `On the target: ${toBlocks(v.effects).map((x) => describeBlock(x, env)).join("; ")}${v["ends-when"] ? ` (ends ${whenText(v["ends-when"]) || "early in some cases"})` : ""}`;
    case "self-effects":
      return `On you: ${toBlocks(v.effects).map((x) => describeBlock(x, env)).join("; ")}`;
    case "trigger":
      return `${eventText(v.event)}: ${offerText(v.offer, env) || "see the rules"}${v.if ? ` (${v.if})` : ""}`;
    case "action": {
      const p: string[] = [];
      if (v.attack) p.push("Attack roll");
      if (v.save) p.push(saveText(v.save, env));
      if (v.damage) p.push(`${damageText(v.damage, env)} damage`);
      if (v.heal !== undefined) p.push(`heal ${valueText(v.heal, env)}`);
      if (v.apply) p.push(applyText(v.apply));
      if (v.text) p.push(String(v.text));
      return p.join(", ");
    }
    case "toggle":
    case "form":
      return toBlocks(v.effects).map((x) => describeBlock(x, env)).join("; ") || v.text || "";
    case "narrative":
      return typeof v === "string" ? v : "";
    default:
      return `${b.type.replace(/-/g, " ")}${v?.text ? `: ${v.text}` : ""}`;
  }
}

function againstText(ag: Val): string {
  if (!ag) return "";
  if (ag.condition) return ` to avoid or end the ${([] as Val[]).concat(ag.condition).map(words).join(" or ")} condition`;
  if (ag.creature) return ` against ${([] as Val[]).concat(ag.creature).map(words).join(", ")}`;
  if (ag.spell || ag.magic) return " against spells and magic";
  return ` (${words(ag)})`;
}

function applyText(ap: Val): string {
  if (!ap) return "";
  const cond = ap.condition ? ([] as Val[]).concat(ap.condition).map(words).join(" and ") : "";
  const dur = ap.duration ? durationOf(ap.duration).text : "";
  return `${cond ? `target is ${cond}` : ap.text || "an effect"}${dur ? ` (${dur})` : ""}${cond && ap.text ? `: ${ap.text}` : ""}`;
}

/** "Once per Long Rest" with no resource named: a use counter of its own. */
function perRest(v: Val, a: ApplyCtx, name: string): ModifCost | undefined {
  const per = v?.per;
  if (per !== "long" && per !== "short" && per !== "dawn") return undefined;
  const key = scopedKey(a, `${a.e.id}#per:${slug(String(name))}`);
  if (!a.r.resources.some((x) => x.key === key)) {
    a.r.resources.push({ key, name: titleOf(slug(String(name))), max: 1, recover: per === "short" ? "short" : per === "dawn" ? "dawn" : "long", entryId: a.e.id, itemId: a.item?.id });
  }
  return { key, amount: 1 };
}

const BONUS_PATHS = ["initiative", "speed:walk", "speed:all", "hp:per-level", "hp:max", "passive:perception", "spell:attack", "spell:dc"];

/** Apply one block. Returns true when the sheet acts on it; otherwise it adds a reminder. */
function applyBlock(b: Block, a: ApplyCtx): boolean {
  const { r, env, e, fname } = a;
  const v = b.v;
  const src = a.item ? a.item.name : `${fname}${e.name !== fname ? ` (${e.name})` : ""}`;
  const shortText = () => firstSentence(a.featText) || fname;
  const note = (text: string) => {
    if (text && !a.inEffect) r.notes.push({ source: a.item ? a.item.name : e.name, feature: fname, text });
    return true;
  };
  // `level: 5` on a block: it starts at that (character or class) level
  if (v && typeof v === "object" && !Array.isArray(v) && typeof v.level === "number" && v.level > a.opts.level) return true;
  // a `when` the sheet can check decides now; one only the player knows becomes a reminder
  const special = ["toggle", "form", "choose", "resource", "charges", "bonus", "trigger", "base", "action"];
  // "while wielding only …" on a weapon rule is checked by the sheet, per attack
  const weaponRule = ["use-ability", "damage-die", "die-floor", "maximize", "damage-type"].includes(b.type);
  const whenNow = v && typeof v === "object" && !Array.isArray(v) && v.when
    ? (weaponRule && !a.item ? Object.fromEntries(Object.entries(v.when).filter(([k]) => k !== "wielding")) : v.when) : undefined;
  if (whenNow && Object.keys(whenNow).length && !special.includes(b.type)) {
    const ok = whenEval(whenNow, a);
    if (ok === false) return true;
    if (ok === null) {
      a.remind(describeBlock(b, env));
      return false;
    }
  }
  switch (b.type) {
    case "proficiency": {
      const items: Val[] = Array.isArray(v) ? v : [v];
      // a filtered weapon proficiency ("Martial weapons that have the Light property") counts for those weapons
      return items.every((x) => {
        if (typeof x === "string") {
          if (x.startsWith("tool:")) (r.toolSources[x.slice(5)] ||= []).push(src);
          return grant(r, x);
        }
        // a saving throw named by a choice ("the chosen ability": Resilient)
        if (x && typeof x === "object" && typeof x.save === "string") {
          const m = x.save.match(/^choice:([\w-]+)$/);
          const picked = m ? a.ctx.c.choices?.[a.slot ? `${a.slot}/${e.id}#${m[1]}` : `${e.id}#${m[1]}`]?.[0] : x.save;
          if (!picked) return true; // not chosen yet
          const ab = ABILITIES.find((n) => n === picked) || ABBR3[picked.toLowerCase()];
          if (ab) r.saves.add(ab);
          return !!ab;
        }
        if (x && typeof x === "object" && x.weapon && typeof x.weapon === "object" && !a.item) {
          r.weaponFilters.push({ category: x.weapon.category, property: x.weapon.property, tag: x.weapon.tag });
          return true;
        }
        return !!x && typeof x === "object" && note(a.item ? `Proficient with this ${Object.keys(x)[0]}` : `Proficient with ${words(x)}`);
      });
    }
    case "multiclass": {
      if (!a.multiOnly) return true; // only matters when this class isn't the first
      for (const x of Array.isArray(v) ? v : []) if (typeof x === "string" && x !== "hit-die") grant(r, x);
      return true;
    }
    case "hit-die":
    case "equipment":
    case "variant":
    case "option": // the section is already gated on its choice
    case "spellcasting": // slots, prepared spells and the casting ability come from the class table and text
      return true; // read from header fields, or used through `variant:` values
    case "choose": {
      if (!v || typeof v !== "object") return false;
      if (v.kind === "subclass") return true; // the class step picks the subclass
      const key = a.slot ? `${a.slot}/${e.id}#${v.id}` : `${e.id}#${v.id}`;
      const kinds: string[] = Array.isArray(v.kind) ? v.kind : [v.kind];
      if (typeof v.at === "number" && v.at > a.opts.level) return true; // a later pick ("at 9th level, two more")
      if (v.when && whenEval(v.when, a) === false) return true;
      // a class's cantrips and prepared spells are picked on the builder's Spells step
      if (kinds[0] === "spell" && (a.opts.kind === "class" || a.opts.kind === "subclass") && /^(Spellcasting|Pact Magic)$/.test(fname)) return true;
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
      if (a.item) return note(`${fname}: ${choiceLabel(v, fname, 1).replace(/^.*?: /, "")} when you use it`);
      if (kinds[0] === "option") {
        const info = a.options?.get(String(v.id));
        const objects: Val[] | undefined = Array.isArray(v.options) ? v.options : undefined;
        const under = v.options?.["headings-under"];
        const opts: ChoiceOption[] = objects
          ? objects.filter((o) => o?.id).map((o) => ({ value: String(o.id), label: String(o.label || titleOf(String(o.id))) }))
          : under ? (() => {
            const all = headingsUnder(e, String(under));
            const picked = a.ctx.c.choices?.[key] || [];
            return all
              .filter((h) => a.ctx.c.ignorePrereqs || optionMinLevel(e, h) <= a.opts.level)
              .filter((h) => { const need = !a.ctx.c.ignorePrereqs && optionNeeds(e, h, all); return !need || picked.includes(need); })
              .map((h) => ({ value: h, label: h }));
          })() : [];
        const count = evalNumber(v.count ?? 1, env) || 1;
        const species = objects && a.opts.kind === "species" && speciesChoice(e);
        if (a.ctx.fixedChoices?.has(key)) {
          const want = a.ctx.c.choices?.[key] || [];
          const only = opts.filter((o) => want.includes(o.value));
          if (only.length) opts.splice(0, opts.length, ...only);
        }
        r.pending.push({
          key, entry: e, feature: fname, label: typeof v.label === "string" ? `${fname}: ${v.label}` : `${fname}: choose ${count > 1 ? count : "one"}`, count, options: opts.length ? opts : null,
          chosen: (info?.chosen || []).filter((x) => !under || a.ctx.c.ignorePrereqs || opts.some((o) => o.value === x)), origin: a.origin, slot: a.slot, storedIn: species ? "speciesChoice" : undefined, locked: a.ctx.fixedChoices?.has(key) || undefined,
          swap: v.swap?.at ? ([] as Val[]).concat(v.swap.at).map(String) : undefined,
        });
        // options written inline carry their own effects (Drow, Wood Elf)
        for (const o of objects || []) {
          if (!info?.chosen.includes(String(o.id))) continue;
          for (const x of toBlocks(o.effects)) applyBlock({ type: x.type, v: a.options ? substChoices(x.v, a.options, a.ctx, e, a.slot) : x.v }, a);
        }
        return true;
      }
      let storedIn: PendingChoice["storedIn"];
      if (a.opts.kind === "class" && v.id === "skills" && kinds[0] === "skill") storedIn = "classSkills";
      if (a.opts.kind === "species" && kinds.length === 1 && kinds[0] === "skill") storedIn = "extraSkills";
      // picks that come with new spell slot levels (Evocation Savant: one more spell each time this class reaches a new slot level)
      const cinfo = a.opts.info;
      const topSlot = (lvl: number) => Math.max(0, ...((cinfo && casterInfoOf({ cls: cinfo.cls, sub: cinfo.sub, level: lvl })?.slots) || []).filter((s) => +s.count > 0).map((s) => s.level));
      const perSlot = v.at === "new-slot-level" ? Math.max(0, topSlot(cinfo?.level ?? 0) - topSlot(a.featureLevel)) : null;
      if (perSlot === 0) return true;
      // `slot: available`: spells of a level you have slots for in this class
      const vs: Val = v.from?.spell?.slot === "available"
        ? { ...v, from: { ...v.from, spell: { ...Object.fromEntries(Object.entries(v.from.spell).filter(([k]) => k !== "slot")), level: Array.from({ length: topSlot(cinfo?.level ?? 0) }, (_, i) => i + 1) } } }
        : v;
      const count = (evalNumber(v.count ?? 1, env) || 1) * (perSlot ?? 1);
      let chosen = chosenFor(key, v, a.ctx, storedIn, a.opts.info);
      // `from: $#skills`: the same list as another choice in this entry (Primal Knowledge: the Barbarian skill list)
      const src = typeof v.from === "string" && v.from.startsWith("$#") ? chooseIn(e, v.from.slice(2)) : undefined;
      let options = choiceOptions(src ? { ...vs, from: src.from } : vs, a.ctx);
      // Expertise: only skills you're proficient in, and not ones you already have Expertise in from another pick
      const needsProf = v.from?.proficient === "skill" || (Array.isArray(v.from?.all) && v.from.all.some((x: Val) => x?.proficient === "skill"));
      if (options && v.grants === "expertise" && needsProf) {
        const prof = skillsHeld(a.ctx, key);
        options = options.filter((o) => prof.skills.has(o.value) && !prof.expert.has(o.value));
        chosen = chosen.filter((x) => options!.some((o) => o.value === x));
      }
      // a spell for the spellbook: not one an earlier pick already put there (Evocation Savant's later picks)
      if (options && v.grants === "spellbook" && r.bookSpells.length) {
        const inBook = new Set(r.bookSpells.map((b) => b.name));
        options = options.filter((o) => !inBook.has(o.label));
        chosen = chosen.filter((x) => options!.some((o) => o.value === x));
      }
      // a new skill proficiency (Skilled, Primal Knowledge): not one you already have from elsewhere
      if (options && v.grants === "proficiency" && !storedIn && kinds.includes("skill")) {
        // fixed sources, plus picks already read (so two picks that share a skill don't cancel each other out)
        const c = a.ctx.c;
        const held = new Set<string>([...(c.classSkills || []), ...(c.extraSkills || []), ...r.pending.filter((p) => p.key !== key).flatMap((p) => p.chosen)]);
        const bg = stripMd(a.ctx.background?.fields["skill proficiencies"] || "");
        for (const s of SKILLS) if (bg.includes(s)) held.add(s);
        options = options.filter((o) => !SKILLS.includes(o.value) || !held.has(o.value));
        chosen = chosen.filter((x) => !SKILLS.includes(x) || !held.has(x));
      }
      const hint = options && options.length < count && needsProf && v.grants === "expertise"
        ? "Only skills you're proficient in can get Expertise: pick your class skills on the Skills & spells step, then come back."
        : options && !options.length && v.from?.known ? `Pick your ${v.from.known.spell?.level === 0 ? "cantrips" : "spells"} first (Spells, on the Skills & spells step); they'll be listed here.` : undefined;
      r.pending.push({ key, entry: e, feature: fname, label: choiceLabel(v, fname, count), count, options, chosen, storedIn, origin: a.origin, slot: a.slot, hint,
        swap: v.swap?.at ? ([] as Val[]).concat(v.swap.at).map(String) : undefined });
      if (kinds.includes("feat")) {
        for (const id of chosen.slice(0, count)) a.readFeat(a.ctx.byId(id) || resolveRef(id, a.ctx));
        return true;
      }
      if (v.grants === "proficiency") {
        for (const x of chosen.slice(0, count)) {
          if (SKILLS.includes(x)) r.skills.add(x);
          else { r.tools.add(x); (r.toolSources[x] ||= []).push(src); }
        }
        return true;
      }
      if (v.grants === "language") {
        for (const x of chosen.slice(0, count)) r.languages.push({ name: x, source: src });
        return true;
      }
      // proficiency, or Expertise if already proficient (Keen Mind, Observant)
      if (v.grants === "proficiency-or-expertise") {
        for (const x of chosen.slice(0, count)) {
          if (!SKILLS.includes(x)) continue;
          if (r.skills.has(x)) r.expertise.add(x);
          else r.skills.add(x);
        }
        return true;
      }
      if (v.grants === "expertise") {
        for (const x of chosen.slice(0, count)) if (SKILLS.includes(x)) r.expertise.add(x);
        return true;
      }
      if (v.grants === "spellbook") {
        for (const id of chosen.slice(0, count)) {
          const sp = a.ctx.byId(id) || resolveRef(id, a.ctx);
          if (sp) r.bookSpells.push({ name: sp.name, source: src });
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
      // a pick recorded for other blocks to read (a list, an ability, a damage type, languages)
      if (["option", "ability", "damage-type", "language"].includes(kinds[0])) return true;
      if (v.id && a.readIds?.has(String(v.id))) return true;
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
      const recover: ModifResource["recover"] = resets.includes("short") || resets.includes("initiative")
        ? "short"
        : v.partial?.at === "short" && (v.partial.amount ?? 1) === 1 ? "shortOne"
        : resets.includes("long") ? "long" : resets.includes("dawn") ? "dawn" : resets.includes("never") ? "never" : "long";
      // the feature's name, unless the pool is named differently (Font of Magic -> Sorcery Points)
      const first = String(v.id).split("-")[0].replace(/s$/, "");
      const name = v.label || (a.item ? a.item.name : slug(fname).includes(first) ? fname : titleOf(String(v.id)));
      const die = v.die !== undefined ? valueText(v.die, env).replace(/\s+/g, "").replace(/^(\d*)d/, (m: string, n: string) => (n === "1" ? "d" : m)) : undefined;
      if (max > 0) r.resources.push({ key: scopedKey(a, v.id), name, max, recover, unit: typeof v.unit === "string" ? v.unit : undefined, die: die && /^\d*d\d+$/.test(die) ? die : undefined, entryId: e.id, itemId: a.item?.id });
      if (resets.includes("initiative") && !resets.includes("short")) a.remind(`${name}: also comes back when you roll Initiative.`);
      return true;
    }
    case "charges": {
      if (!a.item) return false;
      const max = evalNumber(v.max, env);
      if (max === null) {
        a.remind(`${a.item.name}: ${valueText(v.max, env)} charges (track them by hand).`);
        return false;
      }
      const rc = v.recharge;
      const regain = rc?.dice !== undefined ? valueText(rc.dice, env).replace(/\s+/g, "") : undefined;
      const recover: ModifResource["recover"] = !rc ? "never" : rc.at === "short" ? "short" : rc.at === "long" ? "long" : "dawn";
      r.resources.push({ key: `item:${a.item.id}`, name: `${a.item.name} charges`, max, recover, regain, entryId: e.id, itemId: a.item.id });
      if (v["destroy-on"]) note(`${a.item.name}: when the last charge is used, it may be destroyed${v["destroy-on"].roll ? ` (roll ${v["destroy-on"].roll}; ${v["destroy-on"].if} destroys it)` : ""}.`);
      return true;
    }
    case "action": {
      if (v.when && whenEval(v.when, a) === false) return true;
      const heal = v.heal !== undefined ? evalAmount(v.heal, env) : null;
      const cost = costOf(v.cost, a) ?? perRest(v, a, v.id || fname);
      const temp = v["temp-hp"] !== undefined ? evalAmount(v["temp-hp"], env) : null;
      // a Spell Scroll names its spell in brackets: "Spell Scroll (Fireball)"
      let scroll: ScrollUse | undefined;
      let spellRef = typeof v.cast === "string" && v.cast !== "variant:spell" ? resolveRef(v.cast, a.ctx) : undefined;
      if (v.cast === "variant:spell" && a.item) {
        // "Spell Scroll (Fireball)", "Scroll of Fireball" or "Spell Scroll of Fireball" all name the spell (Sage Advice)
        const named = (a.item.name.match(/\(([^)]+)\)\s*$/)?.[1] || a.item.name.match(/^(?:spell\s+)?scroll\s+of\s+(.+)$/i)?.[1])?.trim().toLowerCase();
        spellRef = named ? a.ctx.entries.find((x) => x.type === "Spell" && x.name.toLowerCase() === named) : undefined;
        const info = spellRef ? spellInfo(spellRef) : null;
        if (!spellRef || !info) {
          r.actions.push({ id: `item:${a.item.id}:read`, name: a.item.name, source: src, activation: "", text: "Choose the spell it holds (open it in your Inventory) to read it." });
          return true;
        }
        env.variants = { ...(env.variants || {}), ...spellLevelVariants(e, info.level) };
        // the spell list the class uses: a subclass's own list counts (an Eldritch Knight reads Wizard scrolls)
        const lists = a.ctx.classes.flatMap((k) => [k.cls.name, String((k.sub && spellcastingOf(k.sub)?.list) || "")].filter(Boolean).map((x) => x.toLowerCase().replace(/-/g, " ")));
        scroll = { level: info.level, onList: !v.requires?.["spell-on-list"] || info.classes.some((x) => lists.includes(x.toLowerCase())), checkDc: 10 + info.level };
      }
      const dcRaw = v.dc ?? v.overrides?.dc ?? v.save?.dc;
      const dc = typeof dcRaw === "number" ? dcRaw : typeof dcRaw === "string" && dcRaw.startsWith("variant:") ? evalNumber(dcRaw, env) ?? undefined : dcRaw;
      const atkRaw = v.overrides?.attack;
      const atk = typeof atkRaw === "number" ? atkRaw : typeof atkRaw === "string" ? evalNumber(atkRaw, env) ?? undefined : undefined;
      const name = spellRef ? spellRef.name : v.label || titleOf(v.id) || (a.item ? a.item.name : fname);
      const dmgType = (t: Val) => (typeof t === "string" ? t : t && Array.isArray(t["choose-on-use"]) ? t["choose-on-use"].join("/") : "");
      const dmg = v.damage ? ([] as Val[]).concat(v.damage).map((p) => ({ dice: valueText(p.dice ?? p, env).replace(/\s+/g, ""), type: dmgType(p.type) })) : undefined;
      // options that roll something of their own (Divine Spark: Heal for 1d8 + Wis, or Harm with a Constitution save)
      const optFx = Array.isArray(v["choose-one"]) && v["choose-one"].some((x: Val) => (x?.heal !== undefined && !/cost\./.test(String(x.heal))) || x?.damage)
        ? v["choose-one"].map((x: Val) => {
          if (!x || typeof x !== "object") return undefined;
          const h = x.heal !== undefined && !/cost\./.test(String(x.heal)) ? evalAmount(x.heal, env) : null;
          const d = x.damage ? ([] as Val[]).concat(x.damage).map((p) => ({ dice: valueText(p.dice ?? p, env).replace(/\s+/g, ""), type: dmgType(p.type) })) : undefined;
          const sv = x.save ? { ability: ABIL_NAME(String(x.save.ability)), dc: x.save.dc !== undefined ? evalNumber(x.save.dc, env) ?? undefined : undefined, success: x.save.success } : undefined;
          return h || d || sv ? { heal: h ? amountText(h) : undefined, damage: d, save: sv } : undefined;
        })
        : undefined;
      r.actions.push({
        id: a.item ? `item:${a.item.id}:${v.id || slug(name)}` : v.id || slug(fname), name, source: src, activation: actLabel(v.activation),
        cost, resource: cost?.key,
        heal: heal ? amountText(heal) : undefined,
        healExpr: !heal && typeof v.heal === "string" && /cost\./.test(v.heal) ? v.heal : undefined,
        optionHeals: Array.isArray(v["choose-one"]) && v["choose-one"].some((x: Val) => x?.heal !== undefined) ? v["choose-one"].map((x: Val) => (x?.heal !== undefined ? String(x.heal) : undefined)) : undefined,
        optionEffects: optFx,
        tempHp: temp ? amountText(temp) : undefined,
        cast: spellRef ? { spellId: spellRef.id, level: typeof v["cast-at"] === "number" ? v["cast-at"] : undefined, dc: typeof dc === "number" ? dc : undefined, attack: atk, scroll } : undefined,
        save: v.save ? { ability: ABIL_NAME(String(v.save.ability)), dc: v.save.dc !== undefined ? evalNumber(v.save.dc, env) ?? undefined : typeof dc === "number" ? dc : undefined, success: v.save.success } : undefined,
        damage: dmg,
        consume: v.consume && a.item ? a.item.id : undefined,
        optionCosts: Array.isArray(v["choose-one"]) && v["choose-one"].some((x: Val) => x?.cost) ? v["choose-one"].map((x: Val) => (x?.cost ? costOf(x.cost, a) : undefined)) : undefined,
        options: Array.isArray(v["choose-one"]) ? v["choose-one"].map((x: Val) => {
          // "Disengage and Dodge (1 Focus Point)" reads better than the option's id
          const takes = ([] as Val[]).concat(x.take || []).map((t) => titleCase(String(t))).join(" and ");
          const oc = x.cost ? costOf(x.cost, a) : undefined;
          const rn = oc ? r.resources.find((y) => y.key === oc.key)?.name : undefined;
          const costTxt = oc ? (oc.any || oc.min !== undefined ? ` (spend from ${rn || "the pool"})` : ` (costs ${oc.amount}${rn ? ` ${rn}` : ""})`) : "";
          const fxi = optFx?.[v["choose-one"].indexOf(x)];
          const amt = fxi ? [fxi.heal ? `${fxi.heal} HP` : "", fxi.damage?.map((p) => `${p.dice} ${p.type}`.trim()).join(" + ") || "", fxi.save ? `${fxi.save.dc ? `DC ${fxi.save.dc} ` : ""}${fxi.save.ability.slice(0, 3)} save` : ""].filter(Boolean).join(", ") : "";
          return takes ? `${takes}${costTxt}` : `${String(x.label || titleOf(x.id) || describeBlock({ type: "action", v: x }, env))}${amt ? ` (${amt})` : ""}${costTxt}`;
        }) : undefined,
        creates: v.creates && typeof v.creates === "object" ? {
          weapon: v.creates.item && typeof v.creates.item === "object" && v.creates.item.weapon ? {
            kind: v.creates.item.weapon.kind, category: v.creates.item.weapon.category ? ([] as string[]).concat(v.creates.item.weapon.category) : undefined,
          } : undefined,
          item: typeof v.creates.item === "string" ? (resolveRef(v.creates.item, a.ctx)?.id ?? v.creates.item) : undefined,
          count: typeof v.creates.count === "number" ? v.creates.count : 1,
          tag: typeof v.creates.tag === "string" ? v.creates.tag : undefined,
          replaces: !!v.creates.replaces,
          bond: typeof v.creates.bond === "string" ? v.creates.bond : undefined,
        } : undefined,
        attack: v.attack && typeof v.attack === "object" ? { weapon: typeof v.attack.weapon === "string" ? v.attack.weapon : "weapon", count: typeof v.attack.count === "number" ? v.attack.count : 1 } : undefined,
        summon: v.summon && typeof v.summon === "object" ? v.summon : undefined,
        rollTable: v["roll-table"] && typeof v["roll-table"] === "object" && typeof v["roll-table"].table === "string" && !v["roll-table"].table.startsWith("variant:")
          ? { dice: valueText(v["roll-table"].dice ?? "1d100", env).replace(/\s+/g, ""), table: v["roll-table"].table, entryId: e.id, keep: v["roll-table"].keep } : undefined,
        text: v.text || (heal || spellRef || v.save || v.damage || v["choose-one"] || v.attack ? undefined : a.item ? describeBlock(b, env) : shortText()),
      });
      return true;
    }
    case "summon": {
      // a creature you can call on (Primal Companion); spells with a summon are read when they're cast
      r.summons.push({ key: `${e.id}#${slug(fname) || "summon"}`, name: fname, source: src, entryId: e.id, spec: v });
      return true;
    }
    case "summon-options": {
      const target = typeof v.for === "string" ? resolveRef(v.for, a.ctx) : undefined;
      if (!target) { a.remind(shortText()); return false; }
      const sp = v.speed && typeof v.speed === "object" ? v.speed : null;
      const dt = v["damage-type"] && typeof v["damage-type"] === "object" ? v["damage-type"] : null;
      r.summonOptions.push({
        for: target.id, source: fname,
        add: ([] as Val[]).concat(v.add || []).map((x) => resolveRef(String(x), a.ctx)?.id).filter(Boolean) as string[],
        speed: sp ? { kinds: ([] as Val[]).concat(sp.choose || sp.kind || []).map(String), value: evalNumber(sp.value, env) ?? 0 } : undefined,
        saveDc: v["save-dc"] === "spell",
        damageType: dt ? { choose: ([] as Val[]).concat(dt.choose || []).map(String), replaces: ([] as Val[]).concat(dt.replaces || []).map(String) } : undefined,
        text: typeof v.text === "string" ? v.text : undefined,
      });
      return true;
    }
    case "cast-list": {
      if (!a.item) return false;
      for (const sp of Array.isArray(v.spells) ? v.spells : []) {
        const ref = resolveRef(String(sp.spell || ""), a.ctx);
        if (!ref) continue;
        const n = typeof sp.cost === "number" ? sp.cost : 1;
        r.actions.push({
          id: `item:${a.item.id}:${ref.id}`, name: ref.name, source: src, activation: actLabel(ref.fields["casting time"] ? "" : "magic") || stripMd(ref.fields["casting time"] || ""),
          cost: v["pay-from"] === "charges" ? { key: `item:${a.item.id}`, amount: n } : undefined,
          cast: { spellId: ref.id, level: typeof sp["cast-at"] === "number" ? sp["cast-at"] : undefined, dc: typeof v.dc === "number" ? v.dc : undefined },
          text: `${n} charge${n === 1 ? "" : "s"}`,
        });
      }
      return true;
    }
    case "grant-spell": {
      let refs = ([] as Val[]).concat(v.spell || []).map((x) => resolveRef(String(x), a.ctx)).filter(Boolean) as Entry[];
      // the player picks the spells (Magic Initiate: two cantrips and a level 1 spell from the chosen list)
      if (!refs.length && v.choose && typeof v.choose === "object" && v.choose.id && !v.choose["at-use"] && choiceOptions({ kind: "spell", from: v.choose.from }, a.ctx) !== null) {
        const ch = v.choose;
        const key = a.slot ? `${a.slot}/${e.id}#${ch.id}` : `${e.id}#${ch.id}`;
        const count = evalNumber(ch.count ?? 1, env) || 1;
        let options = choiceOptions({ kind: "spell", from: ch.from }, a.ctx);
        // a cantrip pick leaves out cantrips you already know (High Elf after Magic Initiate); picks read earlier win
        if (options && ch.from?.spell?.level === 0) {
          const c = a.ctx.c;
          const knownNames = new Set<string>([...(c.cantrips || []), ...(c.multiclass || []).flatMap((m) => m.cantrips || []), ...r.grantedSpells.map((g) => g.spell.name)]);
          const knownIds = new Set<string>(r.pending.filter((p) => p.key !== key).flatMap((p) => p.chosen));
          options = options.filter((o) => !knownIds.has(o.value) && !knownNames.has(o.label));
        }
        const listOpen = typeof ch.from?.spell?.list === "string" && ch.from.spell.list.startsWith("choice:");
        const chosen = (a.ctx.c.choices?.[key] || []).filter((x) => !options || options.some((o) => o.value === x)).slice(0, count);
        r.pending.push({
          key, entry: e, feature: fname,
          label: `${fname}: choose ${count > 1 ? count : "one"} ${ch.from?.spell?.level === 0 ? (count > 1 ? "cantrips" : "cantrip") : `level ${ch.from?.spell?.level ?? ""} spell`.replace("level  ", "")}${listOpen ? " (pick the spell list first)" : ""}`,
          count, options: listOpen ? [] : options, chosen, origin: a.origin, slot: a.slot, hint: listOpen ? "Choose the spell list above first." : undefined,
          swap: ch.swap?.at ? ([] as Val[]).concat(ch.swap.at).map(String) : undefined,
        });
        refs = chosen.map((id) => a.ctx.byId(id)).filter(Boolean) as Entry[];
        if (!refs.length) return true;
      }
      if (!refs.length) {
        a.remind(`${fname}: ${v.choose ? "choose the spell(s) it grants" : "grants a spell"}${v.free ? `, cast once per ${v.free.per} Rest without a slot` : ""}.`);
        return false;
      }
      const picked = typeof v.ability === "string" && v.ability.startsWith("choice:") ? a.ctx.c.choices?.[`${a.slot ? `${a.slot}/` : ""}${e.id}#${v.ability.slice(7)}`]?.[0] : undefined;
      const ab = typeof v.ability === "string" && v.ability.startsWith("choice:")
        ? (picked && (ABBR3[picked] || picked))
        : typeof v.ability === "string" ? ABBR3[v.ability] || (ABILITIES.includes(v.ability) ? v.ability : undefined) : undefined;
      for (const sp of refs) {
        let free: string | undefined;
        if (v.free) {
          free = scopedKey(a, `free:${sp.id.replace(/^.*\//, "")}`);
          const per = String(v.free.per || "long");
          r.resources.push({ key: free, name: `${sp.name} (free)`, max: evalNumber(v.free.count ?? 1, env) ?? 1, recover: per === "short" ? "short" : per === "dawn" ? "dawn" : "long", entryId: e.id, itemId: a.item?.id });
        }
        r.grantedSpells.push({ spell: sp, source: src, free, atWill: !!v["at-will"], ability: ab, dc: typeof v.overrides?.dc === "number" ? v.overrides.dc : undefined, prepared: v.prepared === "always" || undefined });
      }
      return true;
    }
    case "modify": {
      // changing a resource of the same entry (Font of Inspiration: Bardic Inspiration comes back on a Short Rest)
      const target = typeof v.target === "string" && v.target.startsWith("$#") ? v.target.slice(2) : null;
      const set = v.set && typeof v.set === "object" ? v.set : null;
      if (target && set && Object.keys(set).every((k) => k === "reset" || k === "max")) {
        const res = r.resources.find((x) => x.key === scopedKey(a, target));
        if (res) {
          if (set.reset) {
            const resets: string[] = [].concat(set.reset);
            res.recover = resets.includes("short") ? "short" : resets.includes("dawn") ? "dawn" : "long";
          }
          if (set.max !== undefined) res.max = evalNumber(set.max, env) ?? res.max;
          return true;
        }
      }
      // a later feature raising a trigger's numbers (Improved Cunning Strike: two effects; Brutal Strike at 17: 2d10)
      const ref = typeof v.target === "string" ? v.target : "";
      if (ref && set) {
        const tid = ref.replace(/^.*#/, "");
        const trg = r.triggers.find((x) => x.id === tid);
        if (trg && Object.keys(set).every((k) => k === "offer.pick" || k === "offer.damage.dice")) {
          if (typeof v.at === "number" && v.at > a.opts.level) return true;
          if (set["offer.pick"] !== undefined) trg.pick = evalNumber(set["offer.pick"], env) ?? trg.pick;
          if (set["offer.damage.dice"] !== undefined && trg.damage?.length) trg.damage = [{ ...trg.damage[0], dice: valueText(set["offer.damage.dice"], env).replace(/\s+/g, "") }, ...trg.damage.slice(1)];
          return true;
        }
      }
      // a later feature changing a form (Circle Forms: higher CR, more Temporary Hit Points; Beast Spells: cast in it)
      const add = v.add && typeof v.add === "object" ? v.add : null;
      const formTog = ref ? r.toggles.find((t) => t.form && t.key === activeRefKey(a, ref)) : undefined;
      if (formTog?.form && (set || add)) {
        const f = formTog.form;
        if (set) {
          const cr = set["choose.from.creature.cr-max"];
          if (cr !== undefined) f.crMax = Math.max(f.crMax, evalNumber(cr, env) ?? f.crMax);
          if (set["temp-hp"] !== undefined) {
            const t = evalNumber(set["temp-hp"], env);
            if (t !== null) {
              formTog.lines = formTog.lines.filter((x) => !/^You gain \d+ Temporary Hit Points\.$/.test(x));
              f.tempHp = t;
              formTog.lines.unshift(`You gain ${t} Temporary Hit Points.`);
            }
          }
          if (set.blocks !== undefined) f.blocksSpells = ([] as Val[]).concat(set.blocks || []).includes("spellcasting");
        }
        for (const x of toBlocks(add?.effects)) {
          if (x.type === "base" && x.v?.to === "ac") {
            const n = evalNumber(x.v.value, env);
            if (n !== null && n > (f.acMin ?? 0)) { f.acMin = n; f.acMinSource = fname; }
          }
        }
        if (v.text) formTog.lines.push(String(v.text));
        if (!add) return true;
      }
      if (ref && add) {
        const tog = r.toggles.find((t) => t.key === activeRefKey(a, ref));
        const id = ref.replace(/^.*#/, "");
        const act = tog ? undefined : r.actions.find((x) => x.id === id);
        const trg = tog || act ? undefined : r.triggers.find((x) => x.id === id || x.key.replace(/^.*#/, "") === id || x.key === id);
        // more options for a trigger (Improved Cunning Strike's Daze and Knock Out; Brutal Strike at 13)
        if (trg && Array.isArray(add["offer.choose-one"])) {
          if (typeof v.at === "number" && v.at > a.opts.level) return true;
          const more = triggerRiders({ offer: { "choose-one": add["offer.choose-one"] } }, env).options || [];
          trg.options = [...(trg.options || []), ...more];
          trg.text = `${trg.text}. Also: ${more.map((o) => o.label).join(", ")}`;
          return true;
        }
        // more damage for an action (Sear Undead: Turn Undead also deals Radiant damage to Undead that fail)
        if (act && add.damage && typeof add.damage === "object") {
          if (typeof v.at === "number" && v.at > a.opts.level) return true;
          const parts = ([] as Val[]).concat(add.damage).map((p) => ({ dice: valueText(p.dice ?? p, env).replace(/\s+/g, ""), type: typeof p.type === "string" ? p.type : "" }));
          act.damage = [...(act.damage || []), ...parts];
          const onFail = ([] as Val[]).concat(add.damage).some((p) => p?.["applies-to"] === "failed-save");
          act.text = [act.text, `${fname}: ${parts.map((p) => `${p.dice} ${p.type}`.trim()).join(" + ")} damage${onFail ? " to each target that fails the save" : ""}.`].filter(Boolean).join(" ");
          return true;
        }
        if (tog || act || trg) {
          const extra = toBlocks(add.effects);
          const words = [...extra.map((x) => describeBlock(x, env)).filter(Boolean), ...(add.text ? [String(add.text)] : [])];
          if (tog) {
            tog.lines.push(...words);
            if (tog.active) for (const x of extra) applyBlock(x, { ...a, inEffect: true });
          } else if (act) {
            act.text = [act.text, ...words].filter(Boolean).join(" ");
            if (act.rollTable && typeof add["roll-table.keep"] === "string") act.rollTable = { ...act.rollTable, keep: add["roll-table.keep"] };
          }
          else if (trg) trg.text = [trg.text, ...words].filter(Boolean).join(" ");
          return true;
        }
      }
      a.remind(shortText());
      return false;
    }
    case "spell-list": {
      const byLevel = v["by-level"];
      if (byLevel && typeof byLevel === "object" && !Array.isArray(byLevel) && v.prepared === "always") {
        // `by: slot-level`: keyed by the highest spell slot level the character has (the school Adept feats)
        const reach = v.by === "slot-level"
          ? Math.max(0, ...spellSlots(a.ctx.classes as unknown as Parameters<typeof spellSlots>[0], a.ctx.entries).filter((x) => x.max > 0).map((x) => x.level))
          : a.opts.level;
        for (const [lv, list] of Object.entries(byLevel)) {
          if (+lv > reach) continue;
          for (const ref of ([] as Val[]).concat(list)) {
            const sp = resolveRef(String(ref), a.ctx);
            if (sp) r.grantedSpells.push({ spell: sp, source: src, prepared: true });
          }
        }
        return true;
      }
      a.remind(`${fname}: ${v["add-to"] ? "adds spells to your class list" : "a list of spells"} (see the rules).`);
      return false;
    }
    case "toggle":
    case "form": {
      const id = v.id || slug(fname) || "toggle";
      const key = toggleKey(a, id);
      const active = a.activeKeys.has(key);
      const dur = durationOf(v.duration, env);
      const inner = toBlocks(v.effects);
      const lines = inner.map((x) => describeBlock(x, env)).filter(Boolean);
      if (v.text) lines.push(String(v.text));
      if (b.type === "form") lines.push("You take another form (see the rules).");
      let form: FormSpec | undefined;
      if (b.type === "form") {
        const from = v.choose?.from?.creature || {};
        form = {
          id: String(v.choose?.id || id),
          type: typeof from.type === "string" ? from.type : undefined,
          crMax: evalNumber(from["cr-max"], env) ?? 0,
          fly: from.fly === undefined ? true : from.fly === true || (evalNumber(from.fly, env) ?? 0) > 0,
          known: evalNumber(v.choose?.count, env) ?? 0,
          swap: v.choose?.swap?.at === "long" ? `You can swap ${v.choose.swap.count === 1 || !v.choose.swap.count ? "one known form" : `${v.choose.swap.count} known forms`} when you finish a Long Rest.` : undefined,
          tempHp: evalNumber(v["temp-hp"], env) ?? 0,
          blocksSpells: ([] as Val[]).concat(v.blocks || []).includes("spellcasting"),
        };
        lines.pop(); // "You take another form": the sheet shows which
        if (form.tempHp) lines.unshift(`You gain ${form.tempHp} Temporary Hit Points.`);
      }
      r.toggles.push({
        key, name: a.item ? a.item.name : v.label || titleOf(v.id) || fname, source: src, activation: actLabel(v.activation),
        cost: costOf(v.cost, a), duration: dur.text || undefined, minutes: dur.minutes,
        ends: v["ends-when"] ? `Ends early: ${whenText(v["ends-when"])}` : undefined, lines, active, itemId: a.item?.id, form,
      });
      if (active) for (const x of inner) applyBlock(x, { ...a, inEffect: true });
      return true;
    }
    case "aura": {
      const affects: Val[] = [].concat(v.affects || ["self"]);
      const off = v["inactive-when"] ? whenEval(v["inactive-when"], a) : false;
      if (affects.includes("self") || affects.includes("allies") || affects.includes("all")) {
        if (off !== true) for (const x of toBlocks(v.effects)) applyBlock(x, a);
      }
      return note(describeBlock(b, env));
    }
    case "trigger": {
      const ev = v.event;
      const regain = v.offer?.regain;
      if (ev && typeof ev === "object" && ev.rest === "long" && v.auto && regain?.resource && !v.when) {
        r.onLongRest.push({ regain: regain.resource, source: src });
        return true;
      }
      // dice rolled at the end of a Long Rest and kept for later (Portent's foretelling rolls)
      if (ev && typeof ev === "object" && ev.rest === "long" && v.auto && v.offer?.roll !== undefined && !v.when) {
        r.onLongRest.push({ roll: valueText(v.offer.roll, env).replace(/\s+/g, ""), key: slug(fname), text: v.offer.text, source: src });
        return true;
      }
      if (v.when && whenEval(v.when, a) === false) return true;
      r.triggers.push({
        key: `${a.item ? `item:${a.item.id}` : e.id}#${fname}#${r.triggers.length}`, name: a.item ? a.item.name : fname, source: src,
        when: eventText(ev) + (v.if ? ` (${v.if})` : "") + (v.when ? ` (${whenText(v.when)})` : ""),
        text: offerText(v.offer, env) || shortText(), cost: costOf(v.offer?.cost ?? v.cost, a) ?? perRest(v, a, fname), auto: !!v.auto, reaction: !!v.reaction,
        ...triggerRiders(v, env),
      });
      return true;
    }
    case "half-proficiency":
      r.halfProficiency = true;
      return true;
    case "save-rule":
    case "cancel-advantage":
      return note(describeBlock(b, env));
    case "reroll":
      r.triggers.push({ key: `${a.item ? `item:${a.item.id}` : e.id}#${fname}#${r.triggers.length}`, name: a.item ? a.item.name : fname, source: src,
        when: v.if !== undefined ? `When you roll a ${v.if} on ${v.roll === "d20" ? "a D20 Test" : rollText(v.roll)}` : `When you roll ${rollText(v.roll)}`,
        text: describeBlock(b, env), auto: false });
      return true;
    case "sense":
      if (!(v && typeof v === "object" && v.when && whenEval(v.when, a) === false)) r.senses.push({ text: describeBlock(b, env), source: src });
      return note(describeBlock(b, env));
    case "language":
      for (const x of ([] as Val[]).concat(v)) if (typeof x === "string") r.languages.push({ name: titleCase(x.replace(/-/g, " ")).replace(/\bCant\b/, "Cant").replace(/^Thieves Cant$/, "Thieves’ Cant"), source: src });
      return note(describeBlock(b, env));
    case "defense": {
      const text = describeBlock(b, env);
      if (text && !a.inEffect && !/choice:/i.test(JSON.stringify(v))) r.defenses.push({ source: a.item ? a.item.name : e.name, feature: fname, text });
      return note(text);
    }
    case "speed":
    case "trait":
    case "note":
    case "condition":
      return note(describeBlock(b, env));
    case "curse":
      note(`Cursed${v.prevents ? `: you can't ${([] as Val[]).concat(v.prevents).join(" or ")} it` : ""}${v.ends?.spell ? ` until ${titleCase(String(v.ends.spell).replace(/^.*\//, ""))}` : ""}`);
      for (const x of toBlocks(v.effects)) applyBlock(x, a);
      return true;
    case "bonus": {
      const value = evalNumber(v.value, env);
      if (value === null || !v.to) return false;
      const when = v.when || {};
      const whenKeys = Object.keys(when);
      const targets: string[] = [].concat(v.to);
      if (targets.length === 1 && targets[0] === "carry:size" && !v.scope && !whenKeys.length) {
        r.carrySize += value;
        return true;
      }
      const selfWeapon = v.scope?.weapon?.id === "self" && a.item;
      const selfItem = v.scope?.item === "self" && a.item;
      // AC with an armor condition keeps the derive() path, which knows what's worn
      if (targets.length === 1 && targets[0] === "ac" && !selfItem) {
        if (v.scope) return false;
        if (whenKeys.every((k) => k === "armor" || k === "shield")) {
          const armor = when.armor === "none" ? undefined : when.armor ? [].concat(when.armor) : undefined;
          r.acBonuses.push({ value, armor, unarmored: when.armor === "none", noShield: when.shield === false, source: src });
          return true;
        }
      }
      if (whenKeys.length) {
        const ok = whenEval(when, a);
        if (ok === false) return true;
        if (ok === null) {
          a.remind(describeBlock(b, env));
          return false;
        }
      }
      let all = true;
      for (const to of targets) {
        if (to === "damage" && v.scope?.spell?.id && typeof v.scope.spell.id === "string" && !v.scope.spell.id.startsWith("choice:")) {
          const sp = resolveRef(String(v.scope.spell.id), a.ctx) || a.ctx.byId(String(v.scope.spell.id));
          if (sp) { r.spellDamageBonuses.push({ spellId: sp.id, value, source: src }); continue; }
          all = false; continue;
        }
        // every spell of a list and school (Empowered Evocation: Wizard evocation spells)
        if (to === "damage" && v.scope?.spell && (v.scope.spell.list || v.scope.spell.school) && !v.scope.spell.id) {
          const f = v.scope.spell;
          const list = f.list ? slug(String(f.list)) : "";
          const school = f.school ? String(f.school).toLowerCase() : "";
          for (const sp of a.ctx.entries) {
            if (sp.type !== "Spell") continue;
            const t = sp.tagline || "";
            if (school && !t.toLowerCase().includes(school)) continue;
            if (list && !(t.match(/\(([^)]*)\)\s*$/)?.[1] || "").split(/,\s*/).map((x) => slug(x)).includes(list)) continue;
            r.spellDamageBonuses.push({ spellId: sp.id, value, source: src });
          }
          continue;
        }
        if (to === "attack" || to === "damage") {
          const kind = v.scope?.weapon?.kind;
          const ability = v.scope?.ability ? ABBR3[v.scope.ability] : undefined;
          const generic = !v.scope || (v.scope.weapon && Object.keys(v.scope.weapon).every((k) => k === "kind")) || (ability && Object.keys(v.scope).length === 1);
          if (!selfWeapon && !generic) { all = false; continue; }
          const entry = { value, ranged: kind === "ranged", melee: kind === "melee", itemId: selfWeapon ? a.item!.id : undefined, ability, source: src };
          (to === "attack" ? r.attackBonuses : r.damageBonuses).push(entry);
        } else if (to === "ac") {
          r.acBonuses.push({ value, source: src });
        } else if (v.scope && !selfItem) {
          all = false;
        } else if (BONUS_PATHS.includes(to) || /^(save|check|skill):/.test(to)) {
          r.bonuses.push({ to: to === "speed:all" ? "speed:walk" : to, value, source: src });
        } else all = false;
      }
      if (!all) a.remind(describeBlock(b, env));
      return all;
    }
    case "set": {
      if (v.to === "damage.ability-mod" && v.scope?.source === "light-extra-attack") { r.offhandMod = src; return true; }
      const n = evalNumber(v.value, env);
      const sm = String(v.to || "").match(/^score:(\w+)$/);
      if (sm && ABBR3[sm[1]] && n !== null && (v.mode ?? "if-higher") === "if-higher") {
        r.scoreSteps.push({ ability: ABBR3[sm[1]], amount: 0, max: 30, set: n, source: src });
        return true;
      }
      const dcm = String(v.to || "").match(/^save-dc:([\w-]+)$/);
      if (dcm && n !== null) {
        if (env.saveDc) env.saveDc[dcm[1]] = n;
        return true;
      }
      if (v.to === "speed:walk" && n !== null && (v.mode ?? "if-higher") === "if-higher") {
        r.speedSet = Math.max(r.speedSet ?? 0, n);
        return true;
      }
      if (v.to === "ac" && v.mode === "min" && n !== null) {
        if (!r.acFloor || n > r.acFloor.value) r.acFloor = { value: n, source: src };
        return true;
      }
      a.remind(describeBlock(b, env));
      return false;
    }
    case "base": {
      if (v.to !== "ac") return false;
      const when = v.when || {};
      if (when.armor !== "none" || Object.keys(when).some((k) => k !== "armor" && k !== "shield")) return false;
      r.acBases.push({ expr: v.value, noShield: when.shield === false || v["allow-shield"] === false, source: src });
      return true;
    }
    case "advantage":
    case "disadvantage": {
      const list = b.type === "advantage" ? r.advantages : r.disadvantages;
      const rolls: string[] = [].concat(v.roll || []);
      const ability = v.scope?.ability;
      const plain = !v.once && (!v.scope || (ability && Object.keys(v.scope).length === 1));
      if (!plain || rolls.some((x) => x === "attacks-against-you" || x.startsWith("checks-to"))) return note(describeBlock(b, env));
      for (const roll of rolls) list.push({ roll: ability && roll === "attack" ? `attack:${ability}` : roll, source: src });
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
    case "use-ability":
    case "damage-die":
    case "die-floor":
    case "maximize":
    case "damage-type": {
      if (!v || typeof v !== "object") return false;
      const wielding = v.when?.wielding !== undefined && !a.item ? ([] as Val[]).concat(v.when.wielding).map(String) : undefined;
      const base = { scope: v.scope, wielding, itemId: a.item?.id, source: src };
      const forList: string[] = [].concat(v.for || []);
      if (b.type === "use-ability") {
        const abilities = ([] as Val[]).concat(v.ability).map((x) => (x === "spell-ability" ? "spell" : ABBR3[String(x)])).filter(Boolean) as string[];
        if (!abilities.length || v.choose) return false;
        const skills = forList.filter((f) => f.startsWith("skill:")).map((f) => skillBySlug(f.slice(6))).filter(Boolean) as string[];
        for (const sk of skills) for (const ab of abilities) r.skillAbilities.push({ skill: sk, ability: ab, source: src });
        const weaponish = forList.length === 0 ? !!v.scope : forList.some((f) => f === "attack" || f === "damage");
        if (weaponish) r.weaponRules.push({ type: "use-ability", abilities, ...base });
        const rest = forList.filter((f) => !f.startsWith("skill:") && f !== "attack" && f !== "damage");
        if (rest.length) a.remind(describeBlock(b, env));
        return !rest.length && (weaponish || skills.length > 0);
      }
      if (b.type === "damage-die") {
        if (v.die === "column") return true; // Versatile: the sheet already offers the two-handed die
        const amt = evalAmount(v.die, env);
        if (!amt || !amt.dice.length || amt.flat) return false;
        r.weaponRules.push({ type: "damage-die", die: amt.dice.join("+"), ifHigher: !!v["if-higher"], types: v.type ? [String(v.type)] : undefined, ...base });
        return true;
      }
      if (b.type === "die-floor") {
        if (typeof v.min !== "number") return false;
        r.weaponRules.push({ type: "die-floor", min: v.min, twoHands: v.scope?.weapon?.hands === "two", ...base });
        return true;
      }
      if (b.type === "maximize") {
        const any: Val[] = v.scope?.any || [v.scope || {}];
        if (any.some((x) => x?.spell?.heals) ) { r.maxHealing = src; return true; }
        if (v.scope?.weapon && !v.scope.against) { r.weaponRules.push({ type: "maximize", ...base }); return true; }
        a.remind(describeBlock(b, env));
        return false;
      }
      // damage-type: types you can pick instead of the weapon's own
      const types = ([] as Val[]).concat(v["add-option"] || v.type || []).map((x) => titleCase(String(x)));
      if (!types.length) return false;
      r.weaponRules.push({ type: "damage-type", types, ...base });
      return true;
    }
    case "roll-floor": {
      const rolls: string[] = [].concat(v?.roll || []);
      const die = typeof v?.min === "number" ? v.min : undefined;
      const total = v?.["total-min"] !== undefined ? evalNumber(v["total-min"], env) ?? undefined : undefined;
      if (!rolls.length || (die === undefined && total === undefined)) return false;
      r.rollFloors.push({ rolls, die, total, proficient: !!v["when-proficient"], source: src });
      return true;
    }
    case "convert": {
      const conv = convertOf(v, a);
      if (!conv) return false;
      r.converts.push({ ...conv, source: src });
      return true;
    }
    case "custom": {
      // hand-coded mechanics (src/lib/custom); an unknown handler shows its text as a reminder
      const h = typeof v?.handler === "string" ? CUSTOM_HANDLERS[v.handler] : undefined;
      if (h && h.apply({ params: v.params || {}, r, env, source: src, feature: fname, entry: e, item: a.item })) return true;
      a.remind(String(v?.text || describeBlock(b, env)));
      return false;
    }
    case "narrative":
      if (v === true) return true; // checked: nothing for a sheet to track
      a.remind(typeof v === "string" ? v : shortText());
      return false;
    default:
      a.remind(a.item ? `${describeBlock(b, env)}` : shortText());
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
  return ({ action: "Action", bonus: "Bonus Action", reaction: "Reaction", none: "No action", free: "No action", magic: "Magic action", utilize: "Utilize action", attack: "Attack action", "attack-action": "Part of the Attack action", "replace-attack": "Replaces one attack" } as Record<string, string>)[act] || String(act);
}

function choiceLabel(v: Val, fname: string, count: number): string {
  const kinds: string[] = Array.isArray(v.kind) ? v.kind : [v.kind];
  if (typeof v.label === "string") return `${fname}: ${v.label}`;
  const what = kinds.map((k) => (count > 1 ? `${k}s` : k)).join(" or ");
  return `${fname}: choose ${count > 1 ? count : "one"} ${what}`;
}

// ------------------------------------------------------------------ rolls
/** Does an Effects block give Advantage on this roll? Returns the sources. */
export function advantageFor(r: ModifResult | undefined, roll: { kind: string; ability?: string; skill?: string }): string[] {
  if (!r) return [];
  const want: string[] = [];
  if (roll.kind === "init") want.push("initiative");
  if (roll.kind === "attack") want.push("attack", ...(roll.ability ? [`attack:${abbr(roll.ability)}`] : []));
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

/** Disadvantage from Effects on this roll (the sources). */
export function disadvantageFor(r: ModifResult | undefined, roll: { kind: string; ability?: string; skill?: string }): string[] {
  if (!r) return [];
  return advantageFor({ ...r, advantages: r.disadvantages }, roll);
}

// ------------------------------------------------------------------ spells
export interface SpellPlan {
  attack?: { count: number };
  save?: { ability: string; success?: string };
  damage: { dice: string; type: string }[];
  heal?: string;
  tempHp?: string;
  /** Everything else it does, in words (conditions, areas, effects on you). */
  lines: string[];
  /** It has effects on you while it lasts (Shield, Mage Armor). */
  selfEffects: boolean;
  /** Minutes it lasts (0 = instantaneous, Infinity = until dispelled). */
  minutes: number;
  concentration: boolean;
  /** Conditions it gives its targets (Charmed, Blinded…). */
  conditions: string[];
  /** Its area, short: "15 ft. cone". */
  area?: string;
  /** What kind of spell it is when it rolls nothing: Summon, Buff, Area… or its school. */
  kind: string;
}

/** Add `add` dice (or a number) `times` times to a dice expression: "8d6" + 1d6 × 2 = "10d6". */
function addDice(expr: string, add: Val, times: number): string {
  if (!times) return expr;
  if (typeof add === "number") return `${expr}+${add * times}`;
  const m = String(add).match(/^(\d*)d(\d+)$/);
  if (!m) return expr;
  const n = (+m[1] || 1) * times;
  const head = expr.match(/^(\d+)d(\d+)/);
  if (head && head[2] === m[2]) return expr.replace(/^\d+d\d+/, `${+head[1] + n}d${m[2]}`);
  return `${expr}+${n}d${m[2]}`;
}

/**
 * What casting a spell does, read from its Effects: attack or save, damage and
 * healing at the slot level (and character level for cantrips), and the rest in words.
 * Returns null for a spell without Effects (the sheet reads its text instead).
 */
export function spellPlan(s: Entry, o: { slot: number; charLevel: number; spell: { mod: number; dc: number; attack: number } }): SpellPlan | null {
  if (!s.effects?.length) return null;
  const blocks = s.effects.flatMap((fx) => readBlocks(fx.yaml).blocks);
  const level = +(s.tagline?.match(/^Level (\d+)/)?.[1] || 0);
  const env: Env = {
    level: o.charLevel, total: o.charLevel, pb: profBonus(o.charLevel), mods: {}, scores: {}, classLevels: {}, table: {}, spell: o.spell,
  };
  const plan: SpellPlan = {
    damage: [], lines: [], selfEffects: false, conditions: [], kind: "",
    minutes: spellMinutes(s.fields["duration"]), concentration: /concentration/i.test(s.fields["duration"] || ""),
  };
  const amt = (x: Val) => {
    const a = evalAmount(x, env);
    return a ? amountText(a) : typeof x === "string" ? x : "";
  };
  const typeOf = (t: Val) => (typeof t === "string" ? (t.startsWith("choice:") ? "chosen type" : t) : t?.["choose-on-use"] ? ([] as Val[]).concat(t["choose-on-use"]).join(" or ") : "");
  const takeDamage = (d: Val) => {
    for (const p of ([] as Val[]).concat(d || [])) {
      const dice = amt(p?.dice ?? p);
      if (!dice) continue;
      // extra damage only some targets take ("+1d8 if it's a Fiend or Undead") stays out of the main roll
      if (p?.if && plan.damage.length) plan.lines.push(`+${dice.replace(/\s+/g, "")} ${typeOf(p?.type)} damage: ${String(p.if).replace(/^The target is/, "if the target is")}`.replace(/\s+damage/, " damage"));
      else plan.damage.push({ dice: dice.replace(/\s+/g, ""), type: typeOf(p?.type) });
    }
  };
  // the main roll: the first action, else a zone or aura that deals damage, else a trigger on you
  let main = blocks.find((b) => b.type === "action")?.v;
  if (!main) main = blocks.find((b) => (b.type === "zone" || b.type === "aura") && (b.v?.damage || b.v?.heal || b.v?.save))?.v;
  if (!main) {
    for (const b of blocks) {
      const inner = b.type === "aura" || b.type === "self-effects" ? toBlocks(b.v?.effects) : [];
      const t = inner.find((x) => x.type === "trigger" && (x.v?.offer?.damage || x.v?.offer?.heal));
      if (t) { main = t.v.offer; break; }
    }
  }
  if (main) {
    if (main.attack) plan.attack = { count: typeof main.attack?.count === "number" ? main.attack.count : 1 };
    if (main.save) plan.save = { ability: ABIL_NAME(String(main.save.ability)), success: main.save.success };
    takeDamage(main.damage);
    if (main.heal !== undefined) plan.heal = amt(main.heal).replace(/\s+/g, "");
    if (main["temp-hp"] !== undefined) plan.tempHp = amt(main["temp-hp"]).replace(/\s+/g, "");
    if (main.apply) plan.lines.push(applyText(main.apply));
    if (main["choose-one"]) plan.lines.push(`Choose one: ${([] as Val[]).concat(main["choose-one"]).map((x) => x.label || titleOf(x.id)).join(", ")}`);
    if (main.text) plan.lines.push(String(main.text));
  }
  for (const b of blocks) {
    if (b.v === main || b.type === "narrative" || b.type === "choose") continue;
    if (b.type === "scaling") {
      const sc = b.v || {};
      let times = 0;
      if (typeof sc["per-slot-above"] === "number") times = Math.max(0, o.slot - sc["per-slot-above"]);
      if (Array.isArray(sc.cantrip)) times = sc.cantrip.filter((l: number) => o.charLevel >= l).length;
      for (const [k, x] of Object.entries(sc.add || {}) as [string, Val][]) {
        if (!times) break;
        if (k === "damage" && plan.damage[0]) plan.damage[0].dice = addDice(plan.damage[0].dice, typeof x === "object" && x ? x.dice : x, times);
        else if (k === "heal" && plan.heal) plan.heal = addDice(plan.heal, x, times);
        else if (k === "temp-hp" && plan.tempHp) plan.tempHp = addDice(plan.tempHp, x, times);
        else if (k === "attack.count" && plan.attack) plan.attack.count += (typeof x === "number" ? x : 1) * times;
        else {
          const what = k.split(".").pop()!.replace(/-/g, " ");
          const dice = typeof x === "object" && x ? x.dice ?? x : x;
          const dm = typeof dice === "string" ? dice.match(/^(\d*)d(\d+)$/) : null;
          const amount = typeof dice === "number" ? String(dice * times) : dm ? `${(+dm[1] || 1) * times}d${dm[2]}` : null;
          plan.lines.push(amount ? `At this level: +${amount} ${what === "size" ? "ft (area)" : what}` : `At higher levels: ${typeof x === "string" ? x : words(x)}`);
        }
      }
      if (sc.slots && typeof sc.slots === "object") {
        for (const [range, x] of Object.entries(sc.slots)) {
          const [lo, hi] = range.replace("+", "-99").split("-").map(Number);
          if (o.slot >= lo && o.slot <= (hi || lo)) plan.lines.push(`At this level: ${describeBlock({ type: "note", v: { text: JSON.stringify(x).replace(/[{}"]/g, "").replace(/,/g, ", ") } })}`);
        }
      }
      continue;
    }
    if (b.type === "self-effects") plan.selfEffects = true;
    if (b.type === "action" && !main) continue;
    plan.lines.push(describeBlock(b, env));
  }
  plan.lines = plan.lines.filter(Boolean);
  // conditions and area, from wherever the blocks put them
  const seenCond = new Set<string>();
  const walk = (v: Val, depth = 0, inApply = false) => {
    if (!v || typeof v !== "object" || depth > 6) return;
    if (Array.isArray(v)) { v.forEach((x) => walk(x, depth + 1, inApply)); return; }
    if (inApply && v.condition) for (const cnd of ([] as Val[]).concat(v.condition)) if (typeof cnd === "string" && !seenCond.has(cnd)) { seenCond.add(cnd); plan.conditions.push(titleOf(cnd)); }
    if (!plan.area && v.area && typeof v.area === "object" && v.area.shape) plan.area = `${v.area.size ?? ""}${v.area.size ? " ft. " : ""}${v.area.shape}`.trim();
    for (const [key, x] of Object.entries(v)) walk(x, depth + 1, inApply || key === "apply" || key === "on-fail");
  };
  for (const b of blocks) if (b.type !== "narrative" && b.type !== "scaling") walk(b.v);
  const types = new Set(blocks.map((b) => b.type));
  plan.kind = types.has("summon") ? "Summon" : types.has("form") ? "Shapechange" : plan.selfEffects ? "Buff" : types.has("zone") || types.has("aura") ? "Area" : types.has("grant-senses") || types.has("sense") ? "Senses" : (s.tagline?.match(/^(?:Level \d+ )?(\w+)/)?.[1] || "").replace(/^Level$/, "");
  if (/cantrip/i.test(plan.kind)) plan.kind = s.tagline?.match(/(\w+) Cantrip/)?.[1] || "";
  void level;
  return plan;
}


// ------------------------------------------------------------------ reading one entry's blocks
/** Every block in an entry's Effects (all features), in order. */
export function blocksOf(e: Entry | undefined, type?: string): Block[] {
  const out = (e?.effects || []).flatMap((fx) => readBlocks(fx.yaml).blocks);
  return type ? out.filter((b) => b.type === type) : out;
}

/**
 * A class's (or subclass's) `spellcasting` block: its ability (full name), progression (full, half, third, pact),
 * the class whose spell list it uses, its cantrips value when the table has no Cantrips column, and the level of
 * the feature that grants it (a subclass's Spellcasting starts at that class level).
 */
export function spellcastingOf(e?: Entry): { ability: string; progression: string; list?: string; cantrips?: Val; level: number } | null {
  for (const fx of e?.effects || []) {
    const b = readBlocks(fx.yaml).blocks.find((x) => x.type === "spellcasting");
    if (!b || !b.v || typeof b.v !== "object") continue;
    const v = b.v;
    const lvl = typeof v.level === "number" ? v.level : +(fx.feature?.match(/^Level (\d+):/)?.[1] || 1);
    return { ability: ABBR3[String(v.ability)] || String(v.ability), progression: String(v.progression || "full"), list: v.list, cantrips: v.cantrips, level: lvl };
  }
  return null;
}

const skillNames = (from: Val): string[] =>
  from === "any" || from === undefined ? [...SKILLS] : ([] as Val[]).concat(from).map((x) => skillBySlug(String(x)) || "").filter(Boolean);

/** A class's skill choice (its `choose` with id `skills`): how many and from which. */
export function skillChoiceOf(cls?: Entry): { count: number; from: string[] } {
  const v = blocksOf(cls, "choose").find((b) => b.v?.id === "skills")?.v;
  return v ? { count: typeof v.count === "number" ? v.count : 1, from: skillNames(v.from) } : { count: 0, from: [] };
}

/** The skill a class grants when it isn't your first class (its `multiclass` block). */
export function multiclassSkillChoice(cls?: Entry): { count: number; from: string[] } | null {
  const list = blocksOf(cls, "multiclass")[0]?.v;
  const ch = (Array.isArray(list) ? list : []).find((x: Val) => x?.choose?.kind === "skill")?.choose;
  if (!ch) return null;
  const from = typeof ch.from === "string" && ch.from.startsWith("$#") ? skillChoiceOf(cls).from : skillNames(ch.from);
  return { count: typeof ch.count === "number" ? ch.count : 1, from };
}

/** A species' skill choice (Human's Skillful, Elf's Keen Senses). */
export function speciesSkillChoice(sp?: Entry): { count: number; from: string[] } | null {
  const v = blocksOf(sp, "choose").find((b) => b.v?.kind === "skill" && b.v?.grants === "proficiency")?.v;
  return v ? { count: typeof v.count === "number" ? v.count : 1, from: skillNames(v.from) } : null;
}

/** Is the character proficient with this weapon (from the Effects read for them)? */
export function weaponProficient(r: ModifResult | undefined, w: { name: string; category: string; properties: string; tags?: string[] }): boolean {
  if (!r) return false;
  const cat = /martial/i.test(w.category) ? "martial" : "simple";
  if (r.weapons.has(cat) || r.weapons.has(slug(w.name))) return true;
  // a list of properties means any of them (Rogue: martial weapons with Finesse or Light)
  return r.weaponFilters.some((f) => (!f.tag || !!w.tags?.includes(f.tag)) && (!f.category || f.category === cat) &&
    (!f.property || ([] as string[]).concat(f.property).some((pr) => new RegExp(`\\b${pr}\\b`, "i").test(w.properties))));
}

/**
 * A cell of a table named by a heading or bold caption in an entry ("#### Beast Shapes" + its table), for the
 * row that applies at `level`: the last row whose first column is at or below it (2, 4, 8 → level 6 reads row 4).
 */
export function namedCell(e: Entry, table: string, col: string, level: number): string | undefined {
  const md = e.body;
  const lines = md.split("\n");
  const want = table.trim().toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    const bare = lines[i].replace(/^#{1,6}\s+/, "").replace(/^\*\*(.+)\*\*$/, "$1").trim();
    if (bare === lines[i].trim() || bare.toLowerCase() !== want) continue; // only headings and bold captions
    let j = i + 1;
    while (j < lines.length && !/^\s*\|/.test(lines[j]) && !/^#{1,6}\s/.test(lines[j]) && j - i < 6) j++;
    const t = parseTables(lines.slice(j).join("\n"))[0];
    if (!t) continue;
    const c = t.header.findIndex((x) => x.trim().toLowerCase() === col.trim().toLowerCase());
    if (c < 0) return undefined;
    let pick: string[] | undefined;
    for (const r of t.rows) {
      const lv = parseInt(r[0], 10);
      if (!Number.isNaN(lv) && lv <= level) pick = r;
    }
    return pick?.[c];
  }
  return undefined;
}


/**
 * The row of a table named by a heading or bold caption in an entry ("**Wild Magic Surge**") that a roll lands on:
 * first-column ranges like "01–04", "5–6", "9" or "00" (100).
 */
export function tableRowFor(e: Entry, table: string, n: number): string[] | undefined {
  const lines = e.body.split("\n");
  const want = table.trim().toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    const bare = lines[i].replace(/^#{1,6}\s+/, "").replace(/^\*\*(.+)\*\*$/, "$1").trim();
    if (bare === lines[i].trim() || bare.toLowerCase() !== want) continue;
    let j = i + 1;
    while (j < lines.length && !/^\s*\|/.test(lines[j]) && j - i < 6) j++;
    const t = parseTables(lines.slice(j).join("\n"))[0];
    if (!t) continue;
    for (const r of t.rows) {
      const cell = (r[0] || "").replace(/[–—]/g, "-").trim();
      const m = cell.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!m) continue;
      const lo = +m[1] === 0 && m[1].length > 1 ? 100 : +m[1];
      const hi = m[2] !== undefined ? (+m[2] === 0 ? 100 : +m[2]) : lo;
      if (n >= lo && n <= hi) return r.slice(1);
    }
  }
  return undefined;
}


/** A trigger's damage and pickable options, as data for the sheet's rider buttons. */
function triggerRiders(v: Val, env: Env): Partial<ModifTrigger> {
  const out: Partial<ModifTrigger> = {};
  if (typeof v.id === "string") out.id = v.id;
  if (v.event && typeof v.event === "object" && typeof v.event.use === "string") out.follows = v.event.use.replace(/^.*#/, "");
  const o = v.offer;
  if (o && typeof o === "object") {
    if (o.damage) out.damage = ([] as Val[]).concat(o.damage).filter((d) => d && typeof d === "object" && d.dice !== undefined)
      .map((d) => ({ dice: valueText(d.dice, env).replace(/\s+/g, ""), type: typeof d.type === "string" ? d.type : "" }));
    if (Array.isArray(o["choose-one"])) {
      out.options = o["choose-one"].filter((x: Val) => x && typeof x === "object").map((x: Val) => ({
        id: String(x.id || x.label || "option"), label: String(x.label || titleCase(String(x.id || "option"))),
        diceCost: x.cost?.["dice-from"] ? (typeof x.cost.count === "number" ? x.cost.count : 1) : undefined,
        save: x.save?.ability ? ABIL_NAME(String(x.save.ability)) : undefined,
        text: [x.text, x.if, x.apply?.condition ? `${titleCase(String(x.apply.condition))}${x.apply.duration ? "" : ""}` : "", x.move ? offerText({ move: x.move }, env) : ""].filter(Boolean).join(". "),
      }));
      out.pick = typeof o.pick === "number" ? o.pick : 1;
    }
  }
  if (v.dc !== undefined) out.dc = evalNumber(v.dc, env) ?? undefined;
  return out;
}
