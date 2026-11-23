import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import "../sheet.css";
import { useContent } from "../lib/store.tsx";
import { useCharacters } from "../lib/characters.tsx";
import { useSession } from "../lib/session.tsx";
import { cloud, supabase } from "../lib/backend.ts";
import { Md } from "../lib/md.tsx";
import { Btn, Tip } from "../lib/tip.tsx";
import { dice3dOn, playDice, setDice3d, setSound, soundOn } from "../lib/sound.ts";
import { applyForm, crLabel, formEligible, parseCreature, parseStatBlockMd, statBlockMd, type CreatureAction, type CreatureStats } from "../lib/creature.ts";
import { features, slug, spellInfo, stripMd, type Entry } from "../lib/parse.ts";
import {
  ABBR, ABILITIES, SKILLS, SKILL_ABILITY, armorTable, derive, featName, fmt, speciesChoice, traits, wornGear,
  type Character,
  intro,
} from "../lib/rules.ts";
import { combineModes, d20, describeRolled, roll, type Mode, type Rolled } from "../lib/dice.ts";
import {
  CONDITION_EFFECTS, attackFor, avgDice, conditionMods, esc, playOf, type Weapon,
  timeNow, unarmedStrike, weaponTable, type Attack, type LogEntry,
  type ActiveEffect, type Companion, type PlayState, type RollContext,
} from "../lib/play.ts";
import { catalog, inventoryOf, isActive, magicInfo, newItemId, type Coins, type Item } from "../lib/inventory.ts";
import InventoryPanel from "./InventoryPanel.tsx";
import { DetailsForm } from "../components/DetailsForm.tsx";
import { ScrollRow } from "../components/ScrollRow.tsx";
import { NARROW, useMedia } from "../lib/useMedia.ts";
import {
  advantageFor, computeModif, type ScrollUse, disadvantageFor, spellcastingOf, spellMinutes, spellPlan as basePlan, statusOf, treatRoll, weaponFits, weaponProficient,
  type ModifConvert, type ConvertSide, type WeaponInfo,
  type ModifAction, type ModifCost, type ModifCtx, type ModifToggle, type ModifTrigger, readBlocks, resolveRef, type ModifSummon, tableRowFor
} from "../lib/modif.ts";
import { casterEntry, casterInfoOf, casterKindOf, classFeatures, classInfos, classLabel, hitDicePools, patchClass, spellSlots, type ClassInfo, type Slot } from "../lib/multiclass.ts";

type Tab = "actions" | "effects" | "spells" | "features" | "conditions" | "inventory" | "background" | "notes";
type CardAction = { label: string; run: () => void };

/** Boxes on the sheet that can be put in a different order on phones (Layout button). */
const BOXES: [string, string][] = [
  ["ident", "Name & conditions"], ["stats", "AC, initiative, speed…"], ["hp", "Hit points"], ["abil", "Ability scores & saves"], ["skills", "Skills"],
  ["profs", "Senses, languages & tools"], ["slots", "Spell slots & uses"], ["tabs", "Actions, Spells & other tabs"], ["rollbar", "Advantage, bonus & rests"],
];
const LAYOUT_KEY = "fpf.layout";
/** The actions everyone can take (SRD 5.2.1 "Actions"), for the Actions tab. */
const COMBAT_ACTIONS: { name: string; text: string }[] = [
  { name: "Attack", text: "Make one attack with a weapon or an Unarmed Strike (more with Extra Attack)." },
  { name: "Dash", text: "For the rest of the turn, give yourself extra movement equal to your Speed." },
  { name: "Disengage", text: "Your movement doesn’t provoke Opportunity Attacks for the rest of the turn." },
  { name: "Dodge", text: "Until the start of your next turn, attack rolls against you have Disadvantage, and you make Dexterity saving throws with Advantage. You lose this benefit if you have the Incapacitated condition or if your Speed is 0." },
  { name: "Help", text: "Help another creature with an ability check, or distract an enemy within 5 feet of you so the next attack roll against it by an ally has Advantage." },
  { name: "Hide", text: "Make a DC 15 Dexterity (Stealth) check while Heavily Obscured or behind Three-Quarters or Total Cover, out of any enemy’s line of sight. On a success you have the Invisible condition." },
  { name: "Influence", text: "Make a Charisma (Deception, Intimidation, Performance or Persuasion) or Wisdom (Animal Handling) check to alter a creature’s attitude." },
  { name: "Magic", text: "Cast a spell, use a magic item, or use a magical feature." },
  { name: "Ready", text: "Prepare to take an action in response to a trigger you define, using your Reaction when it happens." },
  { name: "Search", text: "Make a Wisdom (Insight, Medicine, Perception or Survival) check." },
  { name: "Study", text: "Make an Intelligence (Arcana, History, Investigation, Nature or Religion) check." },
  { name: "Utilize", text: "Use a nonmagical object." },
  { name: "Grapple", text: "An Unarmed Strike option: the target makes a Strength or Dexterity save (DC 8 + Strength modifier + Proficiency Bonus) or has the Grappled condition." },
  { name: "Shove", text: "An Unarmed Strike option: the target makes a Strength or Dexterity save or is pushed 5 feet or knocked Prone." },
];
const STANDARD_LANGUAGES = ["Common Sign Language", "Draconic", "Dwarvish", "Elvish", "Giant", "Gnomish", "Goblin", "Halfling", "Orc"];
const RARE_LANGUAGES = ["Abyssal", "Celestial", "Deep Speech", "Druidic", "Infernal", "Primordial", "Sylvan", "Thieves’ Cant", "Undercommon"];
function loadLayout(): string[] {
  let saved: unknown = null;
  try { saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "null"); } catch { /* ignore */ }
  const def = BOXES.map((b) => b[0]);
  const L = Array.isArray(saved) ? saved.filter((k): k is string => def.includes(k)) : [];
  def.forEach((k) => { if (!L.includes(k)) L.push(k); });
  return L;
}

export default function Sheet() {
  const { id } = useParams();
  const content = useContent();
  const chars = useCharacters();
  const session = useSession();
  const row = chars.get(id);
  const [c, setC] = useState<Character | undefined>(row?.c);
  const dirty = useRef(false);
  const editable = chars.canEdit(id);
  // take in changes made elsewhere (the DM's encounter tracker, this character open on another device, another tab),
  // unless an edit made here is still on its way to being saved
  useEffect(() => {
    if (row && row.c !== c && (!c || c.id !== row.c.id || !dirty.current)) setC(row.c);
  }, [row?.c]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (c && dirty.current) {
      dirty.current = false;
      if (editable) chars.save(c);
    }
  }, [c]); // eslint-disable-line react-hooks/exhaustive-deps
  const sharedLog = cloud && session.settings.shared_log;
  const [logView, setLogView] = useState<"mine" | "table">("mine");
  const [tableLog, setTableLog] = useState<(LogEntry & { who: string })[]>([]);
  const [mode, setMode] = useState<Mode>("normal");
  const [nextBonus, setNextBonus] = useState("");
  const [tab, setTab] = useState<Tab>("actions");
  const [hpAmt, setHpAmt] = useState("");
  const [custom, setCustom] = useState("");
  const [logOpen, setLogOpen] = useState(false);
  /** The trade picked in each Convert row (index into its options). */
  const [convPick, setConvPick] = useState<Record<string, number>>({});
  /** The option picked for each choose-one action (Cunning Action, Patient Defense…). */
  const [actPick, setActPick] = useState<Record<string, number>>({});
  // phones and tablets open with the Game Log hidden (desktop always shows it)
  const narrow = useMedia(NARROW);
  const [logHidden, setLogHidden] = useState(() => typeof window.matchMedia === "function" && window.matchMedia(NARROW).matches);
  const [layout, setLayout] = useState<string[]>(loadLayout);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [toast, setToast] = useState<LogEntry>();
  // Wild Shape and other forms: the picker, the known-forms manager and its search
  const [formPick, setFormPick] = useState(false);
  const [formManage, setFormManage] = useState(false);
  const [formQ, setFormQ] = useState("");
  const formsRef = useRef<HTMLDivElement>(null);
  /** How much to spend on features that let you choose (Lay on Hands HP, Healing Light dice), by action id. */
  const [actAmt, setActAmt] = useState<Record<string, number>>({});
  /** Options picked for a damage rider (Cunning Strike effects for this Sneak Attack), by trigger key. */
  const [riderPick, setRiderPick] = useState<Record<string, string[]>>({});
  const [sound, setSoundState] = useState(soundOn);
  /** A Critical Hit flashes the sheet for a moment. */
  const [critFx, setCritFx] = useState(false);
  /** Dice tumbling onto the sheet after a roll (the "3D dice" toggle). */
  const [dice3d, setDice3dState] = useState(dice3dOn);
  const [diceFx, setDiceFx] = useState<{ key: string; dice: { sides: number; value: number; kept: boolean }[]; crit: boolean; mod: number; tilt: number }>();
  const diceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** The newest roll, while its 3D dice and modifier are still landing: its total stays hidden so the dice reveal it. */
  const [rolling, setRolling] = useState<string>();
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [bookPick, setBookPick] = useState("");
  /** Spells by casting time, for the Actions tab (like D&D Beyond): Bonus Action, Reaction, longer ones, Rituals. */
  const spellChips = (kind: "bonus" | "reaction" | "other" | "ritual", label = kind === "ritual" ? "Ritual Spells" : "Spells") => {
    if (!content.loaded.has("spells")) return null;
    const timeKind = (sp: Entry) => {
      const t = stripMd(sp.fields["casting time"] || "");
      return /^Bonus Action/i.test(t) ? "bonus" : /^Reaction/i.test(t) ? "reaction" : /^Action/i.test(t) ? "action" : "other";
    };
    const seen = new Set<string>();
    const rows = spellRows().filter((r) => {
      if (seen.has(r.sp.id)) return false;
      const hit = kind === "ritual" ? isRitual(r.sp) : !r.book && timeKind(r.sp) === kind;
      if (hit) seen.add(r.sp.id);
      return hit;
    }).sort((a, b) => a.lvl - b.lvl || a.sp.name.localeCompare(b.sp.name));
    if (!rows.length) return null;
    const ord = (L: number) => (L === 0 ? "cantrip" : `${L}${["st", "nd", "rd"][L - 1] || "th"}`);
    return (
      <div className="note spchips">
        <b>{label}:</b> {rows.map((r, j) => (
          <span key={r.sp.id}>{j ? ", " : ""}<button className="linkish" onClick={() => setDrawer({ kind: "spell", id: r.sp.id, via: r.g ? r.g.source : r.k ? `k:${r.k.info.index}` : undefined })}>{r.sp.name}</button> <span className="mut">({ord(r.lvl)})</span></span>
        ))}
      </div>
    );
  };
  /** The slide-out details panel: a spell (with the level to cast it at) or a feature. */
  const [drawer, setDrawer] = useState<{ kind: "spell"; id: string; via?: string; level?: number } | { kind: "feature"; title: string; sub: string; md: string; entryId?: string }>();
  const [spellQ, setSpellQ] = useState("");
  const [spellLvl, setSpellLvl] = useState<string>("all");
  /** Actions tab filter chip. */
  const [featFilter, setFeatFilter] = useState<"all" | "class" | "species" | "feats">("all");
  const [actFilter, setActFilter] = useState<"all" | "attack" | "action" | "bonus" | "reaction" | "other" | "limited">("all");
  const [memPick, setMemPick] = useState<{ out: string; in: string }>({ out: "", in: "" });
  /** Which spell row's cast-level menu is open. */
  const [castMenu, setCastMenu] = useState<{ key: string; x: number; y: number }>();
  useEffect(() => {
    if (!castMenu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !(e.target as HTMLElement).closest?.(".castmenu, .castwrap")) setCastMenu(undefined);
    };
    const gone = () => setCastMenu(undefined);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    window.addEventListener("scroll", gone, true);
    return () => { window.removeEventListener("mousedown", close); window.removeEventListener("keydown", close); window.removeEventListener("scroll", gone, true); };
  }, [castMenu]);
  useEffect(() => {
    if (!drawer) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawer(undefined); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [drawer]);
  const [customDraft, setCustomDraft] = useState<{ name: string; max: string; recover: "short" | "long"; text: string }>({ name: "", max: "1", recover: "long", text: "" });
  const logGone = useRef(false);
  logGone.current = narrow && logHidden;
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(undefined), 2600);
    return () => clearTimeout(t);
  }, [toast]);
  const saveLayout = (L: string[] | null) => {
    try { if (L) localStorage.setItem(LAYOUT_KEY, JSON.stringify(L)); else localStorage.removeItem(LAYOUT_KEY); } catch { /* ignore */ }
    setLayout(L || loadLayout());
  };
  const moveBox = (k: string, d: number) => {
    const L = [...layout];
    const i = L.indexOf(k), j = i + d;
    if (i < 0 || j < 0 || j >= L.length) return;
    [L[i], L[j]] = [L[j], L[i]];
    saveLayout(L);
  };
  /** props that let a box be reordered on phones */
  const bo = (k: string) => ({ "data-box": k, style: { "--o": layout.indexOf(k) } as React.CSSProperties });
  const [flash, setFlash] = useState<string>();
  const actions = useRef<Record<string, CardAction[]>>({});

  const cls = content.byId(c?.classId);
  const sub = content.byId(c?.subclassId);
  const sp = content.byId(c?.speciesId);
  const bg = content.byId(c?.backgroundId);
  const infos: ClassInfo[] = c ? classInfos(c, content.byId) : [];
  const anyCaster = infos.some((i) => casterKindOf(i));
  useEffect(() => {
    // spells are always loaded: feats and items can grant them too
    content.ensure("rules", "items", "spells", "creatures");
  }, [anyCaster]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sharedLog || !supabase) return;
    let alive = true;
    const toCard = (r: { id: number; entry: LogEntry & { who?: string } }) => ({ ...r.entry, id: `t${r.id}`, who: r.entry.who || "" });
    supabase.from("log").select("id, entry").order("id", { ascending: false }).limit(100).then(({ data }) => {
      if (alive) setTableLog((data || []).map(toCard));
    });
    const ch = supabase
      .channel("table-log")
      .on("postgres_changes", { event: "INSERT", schema: "fivepointfive", table: "log" }, (payload) => {
        setTableLog((prev) => [toCard(payload.new as { id: number; entry: LogEntry }), ...prev].slice(0, 150));
      })
      .subscribe();
    return () => {
      alive = false;
      supabase!.removeChannel(ch);
    };
  }, [sharedLog]);

  const armor = useMemo(() => armorTable(content.entries), [content.entries]);
  const weapons = useMemo(() => weaponTable(content.entries), [content.entries]);
  const spellNames = useMemo(() => content.entries.filter((e) => e.type === "Spell").map((e) => e.name).sort(), [content.entries]);
  const itemCatalog = useMemo(() => catalog(content.entries, weapons, armor), [content.entries, weapons, armor]);
  const inv = useMemo(
    () => (c ? inventoryOf(c, cls, bg, itemCatalog) : { items: [] as Item[], coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, fromStart: true }),
    [c?.inventory, c?.coins, c?.equipClass, c?.equipBackground, c?.play?.gear, cls, bg, itemCatalog], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const infoCache = useMemo(() => new Map<string, ReturnType<typeof magicInfo>>(), [content.entries, weapons, armor]);
  const infoOf = (it: Item) => {
    if (it.kind !== "magic" || !it.ref) return undefined;
    if (!infoCache.has(it.ref)) {
      const e = content.byId(it.ref);
      if (!e) return undefined;
      infoCache.set(it.ref, magicInfo(e, weapons, armor));
    }
    return infoCache.get(it.ref);
  };
  const conditionEntries = useMemo(
    () => content.byType("Rule").filter((e) => e.tags.includes("Condition")).sort((a, b) => a.name.localeCompare(b.name)),
    [content],
  );

  if (!c) return chars.ready ? <div className="panel">Character not found. <Link to="/">Back to characters</Link></div> : <p className="muted">Loading…</p>;

  const p = playOf(c);
  const gear = wornGear(c, { cls, background: bg, armor, items: inv.items });
  const fxCtx: ModifCtx = {
    c, classes: infos, species: sp, background: bg, entries: content.entries, byId: content.byId,
    items: inv.items.flatMap((it) => {
      const e = (it.kind === "magic" || it.kind === "weapon") && it.ref ? content.byId(it.ref) : undefined;
      // a pack weapon's own Effects apply while it's equipped
      if (e && it.kind === "weapon") return it.qty > 0 && e.effects?.length ? [{ item: it, entry: e, active: !!it.equipped }] : [];
      return e && it.qty > 0 ? [{ item: it, entry: e, active: isActive(it, infoOf(it)) }] : [];
    }),
    gear: { armor: gear.category, shield: gear.shield > 0 },
    active: (p.active || []).map((x) => ({ key: x.key, slot: x.slot, onSelf: x.onSelf })),
    conditions: p.conditions,
  };
  // read once for ability scores, then again with the spellcasting numbers they give
  const fx0 = computeModif(fxCtx);
  const d0 = derive(c, { cls, background: bg, species: sp, armor, items: inv.items, classes: infos, modif: fx0 });
  const firstCaster = infos.find((i) => casterKindOf(i));
  const ab0 = firstCaster ? spellcastingOf(casterEntry(firstCaster))?.ability ?? null : null;
  const fx = ab0 ? computeModif({ ...fxCtx, spell: { mod: d0.mods[ab0], dc: 8 + d0.pb + d0.mods[ab0], attack: d0.pb + d0.mods[ab0] } }) : fx0;
  /** What a spell does, with bonuses to that spell's damage (Agonizing Blast adds Charisma to each beam). */
  const spellPlan = (sp: Entry, o: Parameters<typeof basePlan>[1]) => {
    const pl = basePlan(sp, o);
    const add = fx.spellDamageBonuses.filter((b) => b.spellId === sp.id).reduce((n, b) => n + b.value, 0);
    if (pl && add && pl.damage[0]) pl.damage[0] = { ...pl.damage[0], dice: `${pl.damage[0].dice}${add > 0 ? "+" : ""}${add}` };
    return pl;
  };
  const dBase = fx === fx0 ? d0 : derive(c, { cls, background: bg, species: sp, armor, items: inv.items, classes: infos, modif: fx });
  // a form (Wild Shape): the creature's stat block replaces your physical numbers while it lasts
  const creatureCache = new Map<string, CreatureStats | undefined>();
  const creatureFor = (id?: string) => {
    if (!id) return undefined;
    if (!creatureCache.has(id)) { const e = content.byId(id); creatureCache.set(id, e?.type === "Creature" ? parseCreature(e) : undefined); }
    return creatureCache.get(id);
  };
  const formTog = fx.toggles.find((t) => t.form && t.active);
  const formCr = formTog ? creatureFor(p.formOf?.[formTog.key]) : undefined;
  const d = formTog?.form && formCr ? applyForm(dBase, formCr, formTog.form) : dBase;
  const fxPlus = (to: string) => fx.bonuses.filter((b) => b.to === to).reduce((n, b) => n + b.value, 0);
  /** "Automated" / "Partly automated" tag for a feature whose Effects the sheet reads. */
  const autoTag = (entryId: string | undefined, feature: string) => {
    const st = entryId ? statusOf(fx, entryId, feature) : undefined;
    if (!st || st === "not automated") return null;
    return <Tip tip={st === "automated" ? "The sheet applies this for you." : "The sheet applies part of this; see “Apply by hand”."}><span className={`tag ${st === "automated" ? "ok" : "plain"}`} style={{ marginLeft: 8 }}>{st === "automated" ? "Automated" : "Partly automated"}</span></Tip>;
  };
  const hpMax = d.hp;
  const hpCur = Math.min(hpMax, p.hpCur ?? hpMax);
  const speed = p.conditions.some((k) => CONDITION_EFFECTS[k]?.speed0) ? 0 : d.speed;
  // spellcasting: each class keeps its own ability, DC and attack
  const casters = infos
    .filter((i) => casterKindOf(i))
    .map((i) => {
      const ab = spellcastingOf(casterEntry(i))?.ability ?? null;
      const m = ab ? d.mods[ab] : 0;
      return { info: i, ab, mod: m, dc: 8 + d.pb + m + fxPlus("spell:dc"), atk: d.pb + m + fxPlus("spell:attack"), ci: casterInfoOf(i) };
    });
  type Caster = (typeof casters)[number];
  const castAb = casters[0]?.ab;
  const spellDC = casters[0]?.dc ?? 0;
  const spellAtk = casters[0]?.atk ?? 0;
  const slots: Slot[] = spellSlots(infos, content.entries);
  const slotKey = (s: Slot) => (s.pact ? `p${s.level}` : String(s.level));
  // limited uses all come from Effects (class features, feats, species, items)
  const resources = [
    ...fx.resources.map((r) => {
      const owner = infos.find((i) => r.entryId === i.cls.id || r.entryId === i.sub?.id);
      return owner && !owner.starting ? { ...r, key: `${owner.cls.name}:${r.key}` } : r;
    }),
    // the player's own tracked features
    ...(c.customFeatures || []).map((f) => ({ key: `custom:${f.id}`, name: f.name, max: f.max, recover: f.recover, entryId: "custom" } as (typeof fx.resources)[number])),
  ];
  // Modif attack and damage bonuses: the item's own (+1 weapon), weapon kind (Archery), ability (Rage)
  function withBonuses(a: Attack, ranged: boolean): Attack {
    const fits = (b: { itemId?: string; ranged?: boolean; melee?: boolean; ability?: string }) =>
      b.itemId ? b.itemId === a.itemId : (!b.ranged || ranged) && (!b.melee || !ranged) && (!b.ability || b.ability === a.ability);
    const hit = fx.attackBonuses.filter(fits);
    const dmg = fx.damageBonuses.filter(fits);
    if (!hit.length && !dmg.length) return a;
    const addDmg = dmg.reduce((n, b) => n + b.value, 0);
    const add = (expr: string) => {
      const m = expr.match(/^(.*?)([+-]\d+)?$/);
      const flat = (m?.[2] ? +m[2] : 0) + addDmg;
      const head = m?.[2] ? m[1] : expr;
      return /d/.test(head) ? `${head}${flat > 0 ? `+${flat}` : flat < 0 ? flat : ""}` : String(Math.max(0, +expr + addDmg));
    };
    return {
      ...a,
      toHit: a.toHit + hit.reduce((n, b) => n + b.value, 0),
      damage: addDmg ? add(a.damage) : a.damage,
      versatile: a.versatile && addDmg ? add(a.versatile) : a.versatile,
      note: [a.note, ...[...hit, ...dmg].map((b) => b.source).filter((x, i, arr) => arr.indexOf(x) === i)].filter(Boolean).join(" · "),
    };
  }
  // Hit Dice, pooled by die size (older characters stored one count)
  const pools = hitDicePools(infos);
  const hdUsedOf = (die: number) => (p.hdUsedBy ? p.hdUsedBy[die] || 0 : die === pools[0]?.die ? p.hdUsed : 0);
  const hdLeft = pools.reduce((n, pl) => n + pl.count - hdUsedOf(pl.die), 0);
  // attacks: weapons that are equipped (magic weapons use their base weapon)
  const wielded = inv.items.flatMap((it) => {
    const w = it.equipped && it.qty > 0 && it.base ? weapons.find((x) => x.name === it.base) : undefined;
    return w ? [{ it, w }] : [];
  });
  const isMonkWeapon = (w: Weapon) => /simple melee/i.test(w.category) || (/martial melee/i.test(w.category) && /\blight\b/i.test(w.properties));
  /** "while unarmed or wielding only Monk weapons" */
  const wieldingOk = (list?: string[]) => !list || wielded.every(({ w }) => (list.includes("monk-weapon") && isMonkWeapon(w)) || list.includes(slug(w.name)));
  /** Weapon rules from Effects (Martial Arts, Shillelagh, Pact of the Blade, Great Weapon Fighting…) for one weapon. */
  const weaponOpts = (wi: WeaponInfo) => {
    const rules = fx.weaponRules.filter((r) => weaponFits(r.scope, wi, r.itemId) && wieldingOk(r.wielding));
    const abilities = rules.filter((r) => r.type === "use-ability").flatMap((r) => (r.abilities || []).map((x) => (x === "spell" ? castAb || "Wisdom" : x)));
    const dies = rules.filter((r) => r.type === "damage-die" && r.die);
    const fixed = dies.find((r) => !r.ifHigher);
    const die = fixed ? { die: fixed.die!, ifHigher: false } : dies.length ? { die: dies.reduce((b, r) => (avgDice(r.die!) > avgDice(b.die!) ? r : b)).die!, ifHigher: true } : undefined;
    const types = rules.filter((r) => r.type === "damage-type").flatMap((r) => r.types || []);
    const floor = rules.find((r) => r.type === "die-floor");
    const max = rules.find((r) => r.type === "maximize");
    const notes = [...new Set(rules.filter((r) => r.type !== "die-floor" && r.type !== "maximize").map((r) => r.source))];
    return {
      opts: { abilities, die, types: types.filter((t, i) => types.indexOf(t) === i), notes },
      dieFloor: floor ? { min: floor.min!, twoHands: !!floor.twoHands && !/two-handed/i.test(wi.properties), source: floor.source } : undefined,
      maximize: max?.source,
    };
  };
  /** A creature's attack as a row in the attacks table (Wild Shape). */
  const creatureAttack = (cr: CreatureStats, a: CreatureAction): Attack => ({
    name: `${a.name} (${cr.name})`, toHit: a.toHit ?? 0,
    damage: a.damage.map((x) => x.expr).join("+") || "0",
    type: a.damage.map((x, i) => (i ? `plus ${x.expr} ${x.type}` : x.type)).join(", "),
    note: a.text.replace(/^.*?Hit:\s*/, "Hit: ").slice(0, 160),
  });
  const attacks: Attack[] = formCr ? formCr.actions.filter((a) => a.toHit !== undefined).map((a) => creatureAttack(formCr, a)) : [
    ...wielded.map(({ it, w }) => {
      const wo = weaponOpts({ id: slug(w.name), name: w.name, category: w.category, properties: w.properties, monk: isMonkWeapon(w), itemId: it.id, tags: it.tags, damage: w.damage });
      return withBonuses({ ...attackFor({ ...w, name: it.name }, d, weaponProficient(fx, { ...w, tags: it.tags }), { ...wo.opts, mastered: fx.masteries.some((m) => slug(m) === slug(w.name)) }), itemId: it.id, dieFloor: wo.dieFloor, maximize: wo.maximize }, /ranged/i.test(w.category));
    }),
    (() => {
      const wo = weaponOpts({ id: "unarmed-strike", name: "Unarmed Strike", category: "Unarmed", properties: "", unarmed: true });
      return withBonuses({ ...unarmedStrike(d, wo.opts), maximize: wo.maximize }, false);
    })(),
  ];
  const setInventory = (items: Item[], coins: Coins) => {
    dirty.current = true;
    setC((prev) => (prev ? { ...prev, inventory: items, coins } : prev));
  };
  const resetInventory = () => {
    dirty.current = true;
    setC((prev) => (prev ? { ...prev, inventory: undefined, coins: undefined, play: { ...playOf(prev), gear: "" } } : prev));
  };

  // ------------------------------------------------------------ state io
  const setPlay = (patch: Partial<PlayState> | ((p: PlayState) => Partial<PlayState>)) =>
    {
      dirty.current = true;
      setC((prev) => {
        if (!prev) return prev;
        const cur = playOf(prev);
        return { ...prev, play: { ...cur, ...(typeof patch === "function" ? patch(cur) : patch) } };
      });
    };

  const log = (e: Omit<LogEntry, "id" | "t">, acts?: CardAction[]) => {
    const entry: LogEntry = { ...e, id: Math.random().toString(36).slice(2, 9), t: timeNow() };
    if (acts?.length) actions.current[entry.id] = acts;
    setPlay((cur) => ({ log: [entry, ...cur.log].slice(0, 150) }));
    setFlash(entry.id);
    let hold = 0;
    if (["test", "atk", "crit", "fumble", "dmg", "heal"].includes(entry.cls)) {
      playDice((entry.detail.match(/\[/g) || []).length || 1);
      if (dice3dOn()) {
        // the dice in the roll's breakdown: "d20 [<b>17</b>, 4]", "2d6 [3, 5]"
        const plain = entry.detail.replace(/<\/?b>/g, "§").replace(/<[^>]+>/g, " ");
        const dice: { sides: number; value: number; kept: boolean }[] = [];
        for (const m of plain.matchAll(/(\d*)d(\d+)\s*\[([^\]]+)\]/g)) {
          const vals = m[3].split(",").map((x) => x.trim());
          const anyKept = vals.some((v) => v.includes("§"));
          for (const v of vals) if (dice.length < 8 && /\d/.test(v)) dice.push({ sides: +m[2], value: parseInt(v.replace(/§/g, ""), 10), kept: !anyKept || v.includes("§") });
        }
        if (dice.length) {
          // the modifier lands beside the dice: what the total adds beyond the dice kept, on a tag at a random slant
          const total = parseInt(entry.total.replace("−", "-"), 10);
          const mod = Number.isFinite(total) ? total - dice.filter((x) => x.kept).reduce((n, x) => n + x.value, 0) : 0;
          const tilt = (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 10);
          setDiceFx({ key: entry.id, dice, crit: entry.cls === "crit", mod, tilt });
          clearTimeout(diceTimer.current);
          diceTimer.current = setTimeout(() => setDiceFx(undefined), 1700);
          // keep the total out of the log until the dice have landed and the modifier has appeared
          if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
            hold = dice.length * 60 + 900;
            setRolling(entry.id);
            clearTimeout(holdTimer.current);
            holdTimer.current = setTimeout(() => setRolling(undefined), hold);
          }
        }
      }
    }
    if (entry.cls === "crit") setTimeout(() => { setCritFx(true); setTimeout(() => setCritFx(false), 700); }, hold);
    // with the log hidden on a phone, show the result briefly so the roll isn't lost
    if (logGone.current) setTimeout(() => setToast(entry), hold);
    if (sharedLog && supabase && editable) {
      supabase.from("log").insert({ character_id: c.id, entry: { ...entry, who: c.name || "Unnamed" } }).then(() => undefined);
    }
  };

  // --------------------------------------------------------------- rolls
  const takeBonus = () => {
    const b = nextBonus.trim();
    if (b) setNextBonus("");
    return b ? (/^[+-]/.test(b) ? b : `+${b}`) : "";
  };

  const test = (title: string, bonus: number, ctx: RollContext, extraNote = ""): ReturnType<typeof d20> | null => {
    const cm = conditionMods(p, ctx);
    if (cm.autoFail) {
      log({ title, total: "—", cls: "test", detail: `<div class="vd bad">Automatic failure</div>${esc(cm.autoFail)} makes you fail ${esc(ctx.ability || "")} saving throws.` });
      return null;
    }
    const bar = mode;
    cm.adv.push(...advantageFor(fx, ctx));
    cm.dis.push(...disadvantageFor(fx, ctx));
    const m = combineModes(bar === "adv" || cm.adv.length > 0, bar === "dis" || cm.dis.length > 0);
    const extra = takeBonus();
    const r = d20(bonus - cm.penalty, m, extra ? extra.replace(/^\+/, "") : undefined);
    // Reliable Talent, Indomitable Might: a low d20 or total is raised
    const ab3 = (ctx.ability || "").slice(0, 3).toLowerCase();
    const floors = fx.rollFloors.filter((f) => (ctx.kind === "check" || ctx.kind === "save") && (!f.proficient || ctx.proficient) &&
      f.rolls.some((x) => x === `${ctx.kind}:all` || x === `${ctx.kind}:${ab3}`));
    const floorNotes: string[] = [];
    for (const f of floors) {
      if (f.die && r.kept < f.die) { r.total += f.die - r.kept; floorNotes.push(`${f.source}: the d20 counts as ${f.die}`); r.kept = f.die; }
      if (f.total !== undefined && r.total < f.total) { r.total = f.total; floorNotes.push(`${f.source}: total raised to ${f.total}`); }
    }
    const why = [
      ...(bar !== "normal" ? [bar === "adv" ? "Advantage (roll bar)" : "Disadvantage (roll bar)"] : []),
      ...cm.adv.map((x) => `Advantage: ${x}`),
      ...cm.dis.map((x) => `Disadvantage: ${x}`),
    ];
    const diceTxt = r.rolls.length > 1 ? `d20 [${r.rolls.map((x) => (x === r.kept ? `<b>${x}</b>` : x)).join(", ")}]` : `d20 [${r.kept}]`;
    const detail = [
      `${diceTxt} ${fmt(bonus)}${cm.penalty ? ` −${cm.penalty} exhaustion` : ""}${r.extra ? ` ${esc(describeRolled(r.extra))}` : ""}`,
      why.length ? `<div>${esc(why.join(" · "))}${m === "normal" && why.length > 1 ? " (cancel out)" : ""}</div>` : "",
      floorNotes.length ? `<div>${esc(floorNotes.join(" · "))}</div>` : "",
      ...fx.rollNotes.filter((n) => n.roll === ctx.kind).map((n) => `<div><b>${esc(n.source)}:</b> ${esc(n.text(r.total))}</div>`),
      extraNote,
    ].join("");
    // ability checks and saving throws don't score Critical Hits, and a 1 isn't an automatic failure (Sage Advice)
    log({ title, total: String(r.total), cls: "test", detail });
    return r;
  };

  /** "dice + modifier" shown beside a roll's total in the game log. */
  const eqHtml = (dice: number, mod: number) =>
    `<span class="eq"><span class="eqd" title="Dice">${dice}</span>${mod ? `<span class="eqo">${mod < 0 ? "−" : "+"}</span><span class="eqm" title="Modifier">${Math.abs(mod)}</span>` : ""}</span>`;
  const eqOf = (r: Rolled) => {
    const dice = r.parts.filter((x) => x.rolls).reduce((n, x) => n + x.value, 0);
    return eqHtml(dice, r.total - dice);
  };
  const rollDamage = (title: string, expr: string, crit: boolean, type = "", heal = false, mods: { minDie?: number; maximize?: string; floorSource?: string } = {}) => {
    const r = roll(expr, { doubleDice: crit, minDie: mods.minDie, maximize: !!mods.maximize });
    if (!r) return;
    const why = [
      mods.maximize ? `${mods.maximize}: dice at their maximum` : "",
      mods.minDie && !mods.maximize ? `${mods.floorSource || "Die floor"}: a 1 or 2 on a damage die counts as ${mods.minDie}` : "",
    ].filter(Boolean);
    log({
      title: `${title} ${heal ? "healing" : "damage"}`,
      total: String(Math.max(0, r.total)),
      cls: heal ? "heal" : "dmg",
      detail: `${eqOf(r)}${esc(describeRolled(r))}${type ? ` · ${esc(type)}` : ""}${why.length ? `<div>${esc(why.join(" · "))}</div>` : ""}${crit ? `<div class="vd crit">Critical hit: dice doubled</div>` : ""}`,
    });
  };

  // ---------------------------------------------------- conversions (convert blocks)
  const titleWords = (k: string) => k.replace(/^.*[:#]/, "").replace(/-/g, " ").replace(/\b\w/g, (x) => x.toUpperCase());
  const actName = (a: string) => ({ action: "Action", bonus: "Bonus Action", reaction: "Reaction" } as Record<string, string>)[a] || a;
  /** The slot a trade means: regular slots first, then Pact Magic. */
  const slotFor = (side: ConvertSide) =>
    side.slot === "pact" ? slots.find((x) => x.pact) : slots.find((x) => !x.pact && x.level === side.slot) || slots.find((x) => x.pact && x.level === side.slot);
  const sideText = (side: ConvertSide) => {
    if (side.slot !== undefined) return side.slot === "pact" ? "Pact slot" : `level ${side.slot} slot`;
    const res = costInfo({ key: side.resource!, amount: side.amount }).res;
    const name = res?.name || titleWords(side.resource!);
    return `${side.amount} ${side.amount === 1 ? name.replace(/(\w)s$/, "$1") : name}`;
  };
  const canTrade = (cv: ModifConvert, o: ModifConvert["options"][number]) => {
    const sp = o.spend, gn = o.gain;
    if (sp.slot !== undefined) {
      const sl = slotFor(sp);
      if (!sl || sl.max - (p.slotsUsed[slotKey(sl)] || 0) < 1) return false;
    } else if (!costInfo({ key: sp.resource!, amount: sp.amount }).res || costInfo({ key: sp.resource!, amount: sp.amount }).left < sp.amount) return false;
    if (gn.slot !== undefined) {
      const sl = slotFor(gn);
      if (!sl || (!cv.expires && (p.slotsUsed[slotKey(sl)] || 0) <= 0)) return false;
    } else {
      const { res, left } = costInfo({ key: gn.resource!, amount: gn.amount });
      if (!res || left >= res.max || (cv.ifEmpty && left > 0)) return false;
    }
    return true;
  };
  const trade = (cv: ModifConvert, o: ModifConvert["options"][number]) => {
    if (!canTrade(cv, o)) return;
    setPlay((cur) => {
      const slotsUsed = { ...cur.slotsUsed }, resUsed = { ...cur.resUsed };
      const move = (side: ConvertSide, dir: 1 | -1) => {
        if (side.slot !== undefined) {
          const sl = slotFor(side)!, k = slotKey(sl);
          slotsUsed[k] = (slotsUsed[k] || 0) + dir;
        } else {
          const res = costInfo({ key: side.resource!, amount: side.amount }).res!;
          resUsed[res.key] = Math.max(0, (resUsed[res.key] || 0) + dir * side.amount);
        }
      };
      move(o.spend, 1);
      move(o.gain, -1);
      if (cv.perLong) resUsed[`convert:${cv.id}`] = 1;
      return { slotsUsed, resUsed };
    });
    log({ title: cv.name, total: "", cls: "event", detail: `Spent ${esc(sideText(o.spend))} for ${esc(sideText(o.gain))}.${cv.expires && o.gain.slot !== undefined ? " The created slot vanishes after a Long Rest." : ""}` });
  };
  /** A better ability a skill can use right now (Primal Knowledge while raging), if any. */
  const skillAlt = (sk: string) => fx.skillAbilities.filter((x) => x.skill === sk && d.mods[x.ability] > d.mods[SKILL_ABILITY[sk]])
    .sort((x, y) => d.mods[y.ability] - d.mods[x.ability])[0];
  const skillValue = (sk: string) => {
    const alt = skillAlt(sk);
    return d.skills[sk].value + (alt ? d.mods[alt.ability] - d.mods[SKILL_ABILITY[sk]] : 0);
  };
  // ---------------------------------------------------- bonus actions
  type BonusRow = {
    key: string; name: string; source: string; detail: string;
    buttons: { label: string; run: () => void; disabled?: boolean; ghost?: boolean; why?: string }[];
    pick?: { label: string; options: string[]; value: number; set: (i: number) => void };
    amount?: ReactNode;
  };
  /** Which option is picked for an action, and whether the character can pay for it. */
  /** The choices an action offers: its choose-one options, or what it can conjure or bond. */
  const optionLabels = (a: ModifAction) => (a.creates?.weapon ? createOptions(a).map((o) => o.label) : a.options);
  const optionOf = (a: ModifAction) => {
    const labels = optionLabels(a) || [];
    // Pact of the Blade: start on the weapon type picked before (older saves), else the current pact weapon's
    const prev = a.creates?.tag ? Object.entries(c?.choices || {}).find(([k]) => k.endsWith(`#${a.creates!.tag}`))?.[1]?.[0] : undefined;
    const cur = taggedItem(a);
    const def = cur?.base ? labels.findIndex((l) => l === `Conjure: ${cur.base}` || l === `Bond: ${cur.name}`) : prev ? labels.findIndex((l) => l === `Conjure: ${prev}`) : -1;
    const i = Math.min(actPick[a.id] ?? Math.max(0, def), Math.max(0, labels.length - 1));
    const cost = a.options && a.optionCosts ? a.optionCosts[i] ?? a.cost : a.cost;
    return { i, ok: costInfo(cost).ok, why: whyNot(cost) };
  };
  /** Why an action's button is greyed out: an unreadable scroll, or no uses left. */
  const actWhy = (a: ModifAction, op?: { why?: string }) =>
    a.cast?.scroll && !scrollUse(a.cast.scroll).readable ? "This spell isn’t on your spell list, so you can’t read the scroll." : op ? op.why : whyNot(a.cost, a.name);
  const isBonus = (act: string) => /bonus action/i.test(act || "");
  const bonusRows = (): BonusRow[] => {
    const rows: BonusRow[] = [];
    // the Light property: one extra attack with a different Light weapon
    const lights = wielded.filter(({ w }) => /(^|,\s*)light\b/i.test(w.properties));
    const pairs = lights.length >= 2 || lights.some(({ it }) => it.qty >= 2);
    if (pairs) {
      for (const { it, w } of lights) {
        const a = attacks.find((x) => x.itemId === it.id);
        if (!a) continue;
        const mod = a.ability ? d.mods[a.ability] : 0;
        // take the ability modifier back out of the flat part, keeping other bonuses (Rage): "1d6+6" → "1d6+2"
        const minusMod = (dm: string) => {
          const m = dm.match(/^(\d+d\d+)([+-]\d+)?(.*)$/);
          if (!m) return `${dm}-${mod}`;
          const flat = Number(m[2] || 0) - mod;
          return `${m[1]}${flat > 0 ? `+${flat}` : flat < 0 ? flat : ""}${m[3]}`;
        };
        const dmg = fx.offhandMod || mod <= 0 ? a.damage : minusMod(a.damage);
        const nick = w.mastery === "Nick" && fx.masteries.some((m) => slug(m) === slug(w.name));
        rows.push({
          key: `light:${it.id}`, name: `${a.name}: extra attack`, source: "Light property",
          detail: `${fmt(a.toHit)} to hit, ${dmg} ${a.type}. After you attack with a different Light weapon using the Attack action.${fx.offhandMod ? ` Adds your modifier to damage (${fx.offhandMod}).` : " No ability modifier to damage unless it’s negative."}${nick ? " Nick: you can make it as part of the Attack action instead, once per turn." : ""}`,
          buttons: [
            { label: "Attack", run: () => attack({ ...a, name: `${a.name} (extra attack)`, damage: dmg }) },
            { label: "Damage", ghost: true, run: () => rollDamage(`${a.name} (extra attack)`, dmg, false, a.type, false, dmgMods(a, false)) },
          ],
        });
      }
    }
    // features and items
    for (const a of fx.actions.filter((x) => isBonus(x.activation))) {
      const { res, left, ok } = costInfo(a.cost);
      const uses = res ? ` ${left} / ${res.max} ${res.name}${a.cost && a.cost.amount > 1 ? ` (costs ${a.cost.amount})` : ""}.` : "";
      if (a.attack?.weapon === "unarmed") {
        const ua = attacks.find((x) => x.name === "Unarmed Strike");
        if (!ua) continue; // not while in a form
        const n = a.attack.count;
        rows.push({
          key: `act:${a.id}`, name: a.name, source: a.source,
          detail: `${n > 1 ? `${n} Unarmed Strikes` : "An Unarmed Strike"}: ${fmt(ua.toHit)} to hit, ${ua.damage} ${ua.type}.${uses}${a.text ? ` ${a.text}` : ""}`,
          buttons: [{ label: n > 1 ? `Attack ×${n}` : "Attack", disabled: !ok, why: whyNot(a.cost, a.name), run: () => {
            if (a.cost) setPlay((cur) => pay(a.cost, cur));
            for (let i = 0; i < n; i++) attack(ua);
          } }],
        });
        continue;
      }
      const labels = optionLabels(a);
      const op = labels ? optionOf(a) : undefined;
      const held = taggedItem(a);
      rows.push({
        key: `act:${a.id}`, name: a.name, source: a.source,
        detail: [held ? `Now: ${held.name}.` : a.creates ? "No weapon conjured or bonded." : "", a.heal ? `Regain ${a.heal} HP.` : "", a.cast ? `Casts ${content.byId(a.cast.spellId)?.name || a.name}.` : "", a.text || "", uses.trim()].filter(Boolean).join(" "),
        pick: labels ? { label: `${a.name}: which option`, options: labels, value: op!.i, set: (i) => setActPick((m) => ({ ...m, [a.id]: i })) } : undefined,
        amount: amountPicker(a.id, op && a.optionCosts ? a.optionCosts[op.i] ?? a.cost : a.cost),
        buttons: [
          { label: a.cast ? "Cast" : a.creates ? (held ? "Replace" : "Use") : "Use", disabled: (op ? !op.ok : !ok) || (!!a.cast?.scroll && !scrollUse(a.cast.scroll).readable), why: actWhy(a, op), run: () => runFeature(a, op?.i) },
          ...(held ? [{ label: "End bond", ghost: true, run: () => releaseItem(a) }] : []),
        ],
      });
    }
    // things to switch on (Rage, items)
    for (const t of fx.toggles.filter((x) => isBonus(x.activation))) {
      const on = isOn(t.key);
      const { res, left, ok } = costInfo(t.cost);
      rows.push({
        key: `tog:${t.key}`, name: t.name, source: t.source,
        detail: [t.lines.join("; "), t.duration ? `Lasts ${t.duration}.` : "", res ? `${left} / ${res.max} ${res.name}.` : ""].filter(Boolean).join(" "),
        buttons: t.form
          ? [{ label: on ? "Change form" : "Choose form", disabled: !on && !ok, why: whyNot(t.cost, t.name), run: () => openForms() }]
          : [{ label: on ? "Active" : "Use", disabled: on || !ok, why: on ? `${t.name} is already active. End it under Effects to use it again.` : whyNot(t.cost, t.name), run: () => switchOn(t) }],
      });
    }
    // spells with a Bonus Action casting time
    const isBonusSpell = (sp: Entry) => /bonus action/i.test(sp.fields["casting time"] || "");
    const lowestSlot = (lvl: number) => [...new Set(slots.map((x) => x.level))].sort((x, y) => x - y).find((L) => L >= lvl && slotLeft(L) > 0);
    for (const { k, list } of knownBy) {
      for (const sp of list.filter(isBonusSpell)) {
        const lvl = spellInfo(sp)?.level || 0;
        const L = lvl ? lowestSlot(lvl) : 0;
        rows.push({
          key: `sp:${k.info.index}:${sp.id}`, name: sp.name, source: `${lvl ? `Level ${lvl}` : "Cantrip"} · ${k.info.cls.name} spell`,
          detail: stripMd(sp.fields["range"] || "") + (sp.fields["duration"] ? ` · ${stripMd(sp.fields["duration"])}` : "") + (lvl && L === undefined ? " · no slots left" : ""),
          buttons: [{ label: lvl && L && L > lvl ? `Cast (level ${L} slot)` : "Cast", disabled: L === undefined, why: L === undefined ? slotWhy(lvl) : undefined, run: () => castSpell(sp, L || 0, k) }],
        });
      }
    }
    for (const [i, g] of fx.grantedSpells.entries()) {
      if (!isBonusSpell(g.spell)) continue;
      const lvl = spellInfo(g.spell)?.level || 0;
      const free = g.free ? resources.find((r) => r.key === g.free) : undefined;
      const freeLeft = free ? free.max - (p.resUsed[free.key] || 0) : 0;
      const ab = g.ability || castAb || undefined;
      const opt = { mod: ab ? d.mods[ab] : 0, dc: g.dc, free: true, via: g.source };
      const L = lvl ? lowestSlot(lvl) : 0;
      const buttons: BonusRow["buttons"] = [];
      if (g.atWill || lvl === 0) buttons.push({ label: "Cast", run: () => castSpell(g.spell, lvl, null, opt) });
      if (free) buttons.push({ label: "Cast free", disabled: freeLeft <= 0, why: freeWhy(free, freeLeft), run: () => castSpell(g.spell, lvl, null, { ...opt, pay: { key: free.key, amount: 1 } }) });
      if (lvl > 0 && !g.atWill && slots.length) buttons.push({ label: "Use a slot", ghost: true, disabled: L === undefined, why: L === undefined ? slotWhy(lvl) : undefined, run: () => L && castSpell(g.spell, L, null, { mod: opt.mod, dc: g.dc, via: g.source }) });
      rows.push({
        key: `gs:${i}:${g.spell.id}`, name: g.spell.name, source: `${lvl ? `Level ${lvl}` : "Cantrip"} · ${g.source}`,
        detail: [stripMd(g.spell.fields["range"] || ""), free ? `${freeLeft} / ${free.max} free` : ""].filter(Boolean).join(" · "),
        buttons,
      });
    }
    // conversions that take a Bonus Action
    for (const cv of fx.converts.filter((x) => x.activation === "bonus")) {
      rows.push({ key: `cv:${cv.id}`, name: cv.name, source: cv.source, detail: `${cv.options.map((o) => `${sideText(o.spend)} → ${sideText(o.gain)}`).slice(0, 3).join("; ")}. Use Convert on the slots bar.`, buttons: [] });
    }
    return rows;
  };
  /** Great Weapon Fighting and maximized dice for an attack's damage roll. */
  const dmgMods = (a: Attack, versatile: boolean) => ({
    minDie: a.dieFloor && (!a.dieFloor.twoHands || versatile) ? a.dieFloor.min : undefined, floorSource: a.dieFloor?.source, maximize: a.maximize,
  });
  const attack = (a: Attack, versatile = false) => {
    const cm = conditionMods(p, { kind: "attack" });
    cm.adv.push(...advantageFor(fx, { kind: "attack", ability: a.ability }));
    cm.dis.push(...disadvantageFor(fx, { kind: "attack", ability: a.ability }));
    const m = combineModes(mode === "adv" || cm.adv.length > 0, mode === "dis" || cm.dis.length > 0);
    const extra = takeBonus();
    const r = d20(a.toHit - cm.penalty, m, extra ? extra.replace(/^\+/, "") : undefined);
    const dmg = versatile && a.versatile ? a.versatile : a.damage;
    // Improved Critical and similar: a lower natural roll is also a Critical Hit
    const crit = r.kept >= d.critRange;
    const critNote = crit && r.kept < 20 ? ` (${d.critRange}–20)` : "";
    const why = [...(mode !== "normal" ? [mode === "adv" ? "Advantage (roll bar)" : "Disadvantage (roll bar)"] : []), ...cm.adv.map((x) => `Advantage: ${x}`), ...cm.dis.map((x) => `Disadvantage: ${x}`)];
    log(
      {
        title: `${a.name}${versatile ? " (two hands)" : ""}: attack`,
        total: String(r.total),
        cls: crit ? "crit" : r.fumble ? "fumble" : "atk",
        detail:
          `${eqHtml(r.kept, r.total - r.kept)}d20 [${r.rolls.map((x) => (r.rolls.length > 1 && x === r.kept ? `<b>${x}</b>` : x)).join(", ")}] ${fmt(a.toHit)}${cm.penalty ? ` −${cm.penalty} exhaustion` : ""}${r.extra ? ` ${esc(describeRolled(r.extra))}` : ""}` +
          (why.length ? `<div>${esc(why.join(" · "))}</div>` : "") +
          (crit ? `<div class="vd crit">Critical hit!${critNote}</div>` : r.fumble ? `<div class="vd bad">Natural 1: miss</div>` : ""),
      },
      [{ label: crit ? `Roll crit damage (${dmg})` : `Roll damage (${dmg})`, run: () => rollDamage(a.name, dmg, crit, a.type, false, dmgMods(a, versatile)) }],
    );
  };

  /**
   * A companion's own rolls: the roll bar and a typed bonus apply, but not your conditions, exhaustion or features
   * (those are yours, not your familiar's).
   */
  const companionTest = (title: string, bonus: number) => {
    const extra = takeBonus();
    const r = d20(bonus, mode, extra ? extra.replace(/^\+/, "") : undefined);
    const dice = r.rolls.length > 1 ? `d20 [${r.rolls.map((x) => (x === r.kept ? `<b>${x}</b>` : x)).join(", ")}]` : `d20 [${r.kept}]`;
    log({ title, total: String(r.total), cls: "test", detail: `${dice} ${fmt(bonus)}${r.extra ? ` ${esc(describeRolled(r.extra))}` : ""}${mode !== "normal" ? `<div>${mode === "adv" ? "Advantage" : "Disadvantage"} (roll bar)</div>` : ""}` });
  };
  const companionAttack = (a: Attack) => {
    const extra = takeBonus();
    const r = d20(a.toHit, mode, extra ? extra.replace(/^\+/, "") : undefined);
    const crit = r.kept === 20;
    log(
      {
        title: `${a.name}: attack`, total: String(r.total), cls: crit ? "crit" : r.fumble ? "fumble" : "atk",
        detail: `${eqHtml(r.kept, r.total - r.kept)}d20 [${r.rolls.map((x) => (r.rolls.length > 1 && x === r.kept ? `<b>${x}</b>` : x)).join(", ")}] ${fmt(a.toHit)}${r.extra ? ` ${esc(describeRolled(r.extra))}` : ""}` +
          (mode !== "normal" ? `<div>${mode === "adv" ? "Advantage" : "Disadvantage"} (roll bar)</div>` : "") +
          (crit ? `<div class="vd crit">Critical hit!</div>` : r.fumble ? `<div class="vd bad">Natural 1: miss</div>` : ""),
      },
      [{ label: crit ? `Roll crit damage (${a.damage})` : `Roll damage (${a.damage})`, run: () => rollDamage(a.name, a.damage, crit, a.type) }],
    );
  };

  // ------------------------------------------------------------------ HP
  const amount = () => Math.max(0, Math.floor(+hpAmt || 0));
  /** A Hit Point pool that takes damage for you while its effect is on (Arcane Ward). */
  const wardOf = () => {
    const tail = (k: string) => k.replace(/^.*[:#]/, "");
    const on = activeList.filter((x) => x.kind === "toggle").map((x) => tail(x.key));
    const r = resources.find((x) => x.unit === "hp" && on.includes(tail(x.key)));
    return r ? { r, left: r.max - (p.resUsed[r.key] || 0) } : undefined;
  };
  const takeDamage = () => {
    const n = amount();
    if (!n) return;
    const ward = wardOf();
    const fromWard = ward ? Math.min(ward.left, n) : 0;
    let temp = p.hpTemp;
    const fromTemp = Math.min(temp, n - fromWard);
    temp -= fromTemp;
    const left = n - fromWard - fromTemp;
    const cur = Math.max(0, hpCur - left);
    const notes: string[] = [];
    if (fromWard) notes.push(`${fromWard} absorbed by your ${esc(ward!.r.name)} (${ward!.left - fromWard} left)`);
    if (fromTemp) notes.push(`${fromTemp} absorbed by temporary HP`);
    if (left >= hpCur + hpMax && hpCur > 0) notes.push("<b>Massive damage:</b> the remaining damage equals or exceeds your Hit Point maximum, so you die instantly.");
    else if (cur === 0) notes.push(hpCur === 0 ? "Damage at 0 HP: one failed death save (two on a critical hit)." : "You drop to 0 HP and have the Unconscious condition.");
    // damage absorbed by Temporary Hit Points still counts for the DC (Sage Advice)
    if (p.concentration) notes.push(`Concentration on ${esc(p.concentration)}: make a Constitution save, DC ${Math.min(30, Math.max(10, Math.floor(n / 2)))}.`);
    setPlay({ hpCur: cur, hpTemp: temp, deathF: hpCur === 0 && cur === 0 ? Math.min(3, p.deathF + 1) : p.deathF, ...(fromWard ? { resUsed: { ...p.resUsed, [ward!.r.key]: (p.resUsed[ward!.r.key] || 0) + fromWard } } : {}) });
    log({ title: "Took damage", total: `−${n}`, cls: "dmg", detail: `HP ${hpCur} → ${cur} / ${hpMax}${notes.map((x) => `<div>${x}</div>`).join("")}` },
      p.concentration ? [{ label: "Roll Constitution save", run: () => test("Concentration save", d.saves.Constitution.value, { kind: "save", ability: "Constitution" }) }] : undefined);
    setHpAmt("");
  };
  const heal = () => {
    const n = amount();
    if (!n) return;
    const cur = Math.min(hpMax, hpCur + n);
    setPlay({ hpCur: cur, deathS: 0, deathF: 0 });
    log({ title: "Healed", total: `+${cur - hpCur}`, cls: "heal", detail: `HP ${hpCur} → ${cur} / ${hpMax}` });
    setHpAmt("");
  };
  const addTemp = () => {
    const n = amount();
    if (!n) return;
    const t = Math.max(p.hpTemp, n);
    setPlay({ hpTemp: t });
    log({ title: "Temporary HP", total: String(t), cls: "info", detail: n <= p.hpTemp ? "Temporary HP don’t stack: you keep the higher amount." : `Set to ${t}.` });
    setHpAmt("");
  };
  const spendHitDie = (want?: number) => {
    const pool = pools.find((pl) => (want === undefined || pl.die === want) && hdUsedOf(pl.die) < pl.count);
    if (!pool) return;
    const r = roll(`1d${pool.die}${d.mods.Constitution >= 0 ? "+" : ""}${d.mods.Constitution}`)!;
    const gain = Math.max(0, r.total);
    const cur = Math.min(hpMax, hpCur + gain);
    const by = Object.fromEntries(pools.map((pl) => [pl.die, hdUsedOf(pl.die)]));
    by[pool.die] += 1;
    setPlay({ hdUsedBy: by, hdUsed: Object.values(by).reduce((a, b) => a + b, 0), hpCur: cur });
    log({ title: `Spent a Hit Die (d${pool.die})`, total: `+${cur - hpCur}`, cls: "heal", detail: `${esc(describeRolled(r))} · HP ${hpCur} → ${cur}` });
  };
  const deathSave = () => {
    const extra = takeBonus();
    const adv = advantageFor(fx, { kind: "death" });
    const r = d20(0, combineModes(mode === "adv" || adv.length > 0, mode === "dis"), extra ? extra.replace(/^\+/, "") : undefined);
    let { deathS: s, deathF: f } = p;
    let verdict = adv.length ? `<div>${esc(adv.map((x) => `Advantage: ${x}`).join(" · "))}</div>` : "";
    let hp = hpCur;
    const treat = treatRoll(fx, "death-save", r.kept);
    if (treat) verdict += `<div>${esc(treat.source)}: your ${r.kept} counts as a ${treat.as}</div>`;
    const kept = treat ? treat.as : r.kept;
    if (kept === 20) { hp = 1; s = 0; f = 0; verdict += `<div class="vd crit">${r.kept === 20 ? "Natural 20" : "Counts as a 20"}: you regain 1 HP</div>`; }
    else if (kept === 1) { f = Math.min(3, f + 2); verdict += `<div class="vd bad">Natural 1: two failures</div>`; }
    else if (r.total >= 10) { s = Math.min(3, s + 1); verdict += `<div class="vd ok">Success</div>`; }
    else { f = Math.min(3, f + 1); verdict += `<div class="vd bad">Failure</div>`; }
    if (s >= 3) verdict += `<div class="vd ok">Three successes: you’re Stable</div>`;
    if (f >= 3) verdict += `<div class="vd bad">Three failures: you die</div>`;
    setPlay({ deathS: s >= 3 ? 0 : s, deathF: f, hpCur: hp });
    log({ title: "Death save", total: String(r.total), cls: kept === 20 ? "crit" : kept === 1 ? "fumble" : "test", detail: `d20 [${r.rolls.join(", ")}]${r.extra ? ` ${esc(describeRolled(r.extra))}` : ""}${verdict}` });
  };

  // --------------------------------------------------------------- rests
  const shortRest = () => {
    const resUsed = { ...p.resUsed };
    const back: string[] = [];
    for (const r of resources) {
      if (!resUsed[r.key]) continue;
      if (r.recover === "short") { resUsed[r.key] = 0; back.push(`all ${r.name}`); }
      if (r.recover === "shortOne") { resUsed[r.key] -= 1; back.push(`1 ${r.name}`); }
    }
    const slotsUsed = { ...p.slotsUsed };
    if (slots.some((s) => s.pact)) { for (const s of slots) if (s.pact) slotsUsed[slotKey(s)] = 0; back.push("Pact Magic slots"); }
    // effects lasting an hour or less are over by the end of a Short Rest
    const ended = (p.active || []).filter((x) => x.minutes <= 60);
    if (ended.length) back.push(`(ended: ${ended.map((x) => x.name).join(", ")})`);
    const mem = memorizer();
    setPlay({ resUsed, slotsUsed, active: (p.active || []).filter((x) => x.minutes > 60), ...(ended.some((x) => x.concentration) ? { concentration: undefined } : {}), ...(mem ? { memorize: "ready" as const } : {}) });
    log({ title: "Short rest", total: "", cls: "event", detail: `${back.length ? `Regained ${esc(back.join(", "))}.` : "Nothing to regain."} Spend Hit Dice to heal (${hdLeft} left).${mem ? " Memorize Spell: you can swap one prepared spell for another in your spellbook (Spells tab)." : ""}` },
      hdLeft > 0 ? [{ label: "Spend a Hit Die", run: () => spendHitDie() }] : undefined);
  };
  const longRest = () => {
    const inspire = fx.onLongRest.find((x) => x.regain === "heroic-inspiration");
    // uses come back, except item charges that never recharge; dice recharges are rolled ("1d6+1 at dawn")
    const resUsed: Record<string, number> = {};
    const notes: string[] = [];
    for (const r of resources) {
      const used = p.resUsed[r.key] || 0;
      if (!used) continue;
      if (r.recover === "never") resUsed[r.key] = used;
      else if (r.regain) {
        const rolled = roll(r.regain);
        const back = Math.max(0, rolled?.total ?? used);
        resUsed[r.key] = Math.max(0, used - back);
        notes.push(`${r.name}: regained ${Math.min(back, used)} (${r.regain}${rolled ? ` = ${rolled.total}` : ""})`);
      }
    }
    // dice to keep for later (Portent): each die is its own foretelling roll
    const recorded: NonNullable<PlayState["recorded"]> = {};
    for (const x of fx.onLongRest.filter((y) => y.roll && y.key)) {
      const r = roll(x.roll!);
      const values = r ? r.parts.flatMap((pt) => pt.rolls || []) : [];
      recorded[x.key!] = { source: x.source, values, used: values.map(() => false) };
      notes.push(`${x.source}: rolled ${values.join(", ")}`);
    }
    setPlay({ hpCur: hpMax, hpTemp: 0, hdUsed: 0, hdUsedBy: {}, deathS: 0, deathF: 0, slotsUsed: {}, resUsed, exhaustion: Math.max(0, p.exhaustion - 1), concentration: undefined, active: [], memorize: undefined, ...(inspire ? { inspiration: true } : {}), ...(Object.keys(recorded).length ? { recorded } : {}) });
    log({ title: "Long rest", total: "", cls: "event", detail: `HP restored to ${hpMax}. All Hit Dice, spell slots and class resources regained.${p.exhaustion ? " Exhaustion reduced by 1." : ""}${inspire && !p.inspiration ? ` ${esc(inspire.source)}: you gain Heroic Inspiration.` : ""}${notes.map((x) => `<div>${esc(x)}</div>`).join("")}${(p.active || []).length ? `<div>Ended: ${esc((p.active || []).map((x) => x.name).join(", "))}</div>` : ""}` });
  };

  // ------------------------------------------------------- feature actions
  /** A cost's resource, uses left, and whether it can be paid. */
  const costInfo = (cost?: ModifCost) => {
    const res = cost ? resources.find((r) => r.key === cost.key || r.key.endsWith(`:${cost.key}`)) : undefined;
    const left = res ? res.max - (p.resUsed[res.key] || 0) : Infinity;
    // house rules: the sheet tracks uses but doesn't stop you
    return { res, left, ok: !cost || !res || left >= cost.amount || !!c.houseRules };
  };
  /** How much the player chose to spend on a variable cost, kept within what's allowed and what's left. */
  const spendOf = (id: string, cost: ModifCost) => {
    const { res, left } = costInfo({ ...cost, amount: 0 });
    const max = Math.max(cost.min ?? 1, Math.min(cost.max ?? Infinity, res ? left : Infinity));
    return Math.max(cost.min ?? 1, Math.min(actAmt[id] ?? (cost.min ?? 1), max));
  };
  /** A number box for features where you choose how much to spend. */
  const amountPicker = (id: string, cost?: ModifCost) => {
    if (!cost || (cost.min === undefined && !cost.any)) return null;
    const { res, left } = costInfo({ ...cost, amount: 0 });
    const max = Math.min(cost.max ?? Infinity, res ? left : Infinity);
    return (
      <label className="amtpick">
        <span className="sr-only">How much to spend</span>
        <input type="number" min={cost.min ?? 1} max={Number.isFinite(max) ? max : undefined} value={spendOf(id, cost)} inputMode="numeric"
          onChange={(e) => setActAmt((m) => ({ ...m, [id]: Math.max(cost.min ?? 1, Math.floor(+e.target.value || 0)) }))} />
        <span className="mut">{res?.name || ""}</span>
      </label>
    );
  };
  /** When a use comes back, in words. */
  const refreshText = (r: { recover: string; regain?: string }) =>
    r.recover === "short" ? "It comes back when you finish a Short or Long Rest."
    : r.recover === "shortOne" ? "One use comes back when you finish a Short Rest, and all of them on a Long Rest."
    : r.recover === "long" ? "It comes back when you finish a Long Rest."
    : r.recover === "dawn" ? `It recharges at dawn${r.regain ? ` (${r.regain})` : ""}; the sheet does that when you finish a Long Rest.`
    : "It doesn’t come back on its own.";
  /** Why a feature can't be used right now (shown on hover over its greyed-out button). */
  const whyNot = (cost?: ModifCost, feature?: string): string | undefined => {
    const { res, left, ok } = costInfo(cost);
    if (ok || !res || !cost) return undefined;
    const used = left <= 0
      ? res.max === 1 ? `You’ve already used ${feature || res.name}.` : `No ${res.name} uses left (0 of ${res.max}).`
      : `This costs ${cost.amount} ${res.name}; you have ${left} left.`;
    return `${used} ${refreshText(res)}`;
  };
  const freeWhy = (free: { name: string; max: number; recover: string; regain?: string }, left: number) =>
    left > 0 ? undefined : `You’ve used the free casting${free.max > 1 ? "s" : ""} of ${free.name.replace(/ \(free\)$/, "")}. ${refreshText(free)} You can still cast it with a spell slot if you have one.`;
  const slotWhy = (lvl: number) => `No spell slots of level ${lvl} or higher left. ${casters.some((k) => k.info.cls.name === "Warlock") ? "Pact Magic slots come back on a Short or Long Rest; other slots on a Long Rest." : "They come back when you finish a Long Rest."}`;
  const pay = (cost: ModifCost | undefined, cur: PlayState): Partial<PlayState> => {
    const { res } = costInfo(cost);
    return res && cost ? { resUsed: { ...cur.resUsed, [res.key]: Math.min(res.max, (cur.resUsed[res.key] || 0) + cost.amount) } } : {};
  };
  // ------------------------------------------------- items made or bonded by features (Pact of the Blade)
  type CreateOpt = { label: string; weapon?: Weapon; itemId?: string };
  /** What an action with `creates` can make or bond right now. */
  const createOptions = (a: ModifAction): CreateOpt[] => {
    const cr = a.creates;
    if (!cr?.weapon) return [];
    const fits = (w: Weapon) => (!cr.weapon!.kind || (cr.weapon!.kind === "ranged") === /ranged/i.test(w.category)) &&
      (!cr.weapon!.category || cr.weapon!.category.some((k) => w.category.toLowerCase().includes(k)));
    const conjure = weapons.filter(fits).map((w) => ({ label: `Conjure: ${w.name}`, weapon: w }));
    const bond = cr.bond === "magic-weapon"
      ? inv.items.filter((it) => it.kind === "magic" && it.base && weapons.some((w) => w.name === it.base) && !it.conjured).map((it) => ({ label: `Bond: ${it.name}`, itemId: it.id }))
      : [];
    return [...bond, ...conjure];
  };
  /** The item an action's tag is on now (the current pact weapon), if any. */
  const taggedItem = (a: ModifAction) => (a.creates?.tag ? inv.items.find((it) => it.tags?.includes(a.creates!.tag!)) : undefined);
  /** End the bond: conjured items vanish, bonded ones lose the tag. */
  const endBond = (items: Item[], tag: string) =>
    items.filter((it) => !(it.conjured && it.tags?.includes(tag))).map((it) => (it.tags?.includes(tag) ? { ...it, tags: it.tags.filter((t) => t !== tag) } : it));
  const createItem = (a: ModifAction, o: CreateOpt) => {
    const cr = a.creates!;
    let items = cr.replaces && cr.tag ? endBond(inv.items, cr.tag) : inv.items;
    let what = "";
    if (o.weapon) {
      const name = `${o.weapon.name} (${cr.tag === "pact-weapon" ? "pact weapon" : a.name})`;
      items = [...items, { id: newItemId(), name, kind: "weapon", qty: cr.count, base: o.weapon.name, weight: 0, equipped: true, tags: cr.tag ? [cr.tag] : undefined, conjured: true }];
      what = `Conjured ${name}.`;
    } else if (o.itemId) {
      items = items.map((it) => (it.id === o.itemId ? { ...it, equipped: true, tags: [...(it.tags || []), ...(cr.tag ? [cr.tag] : [])] } : it));
      what = `Bonded with ${inv.items.find((it) => it.id === o.itemId)?.name}.`;
    }
    setInventory(items, inv.coins);
    log({ title: a.name, total: "", cls: "event", detail: [what, a.text || ""].filter(Boolean).map((x) => `<div>${esc(x)}</div>`).join("") });
  };
  const releaseItem = (a: ModifAction) => {
    if (!a.creates?.tag) return;
    const cur = taggedItem(a);
    setInventory(endBond(inv.items, a.creates.tag), inv.coins);
    log({ title: `${a.name} ended`, total: "", cls: "event", detail: cur ? esc(`${cur.name}${cur.conjured ? " disappears" : " is no longer bonded"}.`) : "" });
  };

  /** Can this character read a Spell Scroll, with which ability, and is there a check first? */
  const scrollUse = (sc: ScrollUse) => {
    const rule = fx.scrollRule;
    const ability = rule?.ability || castAb || "Intelligence";
    const highest = Math.max(0, ...slots.filter((x) => x.max > 0).map((x) => x.level));
    const needs = rule?.check ? sc.level >= rule.check.fromLevel : sc.level > highest;
    const ckAbility = rule?.check?.ability || ability;
    const skill = rule?.check?.skill;
    return {
      readable: sc.onList || !!rule,
      ability,
      check: needs ? { ability: ckAbility, skill, bonus: skill && d.skills[skill] ? d.skills[skill].value : d.mods[ckAbility], source: rule?.source } : undefined,
    };
  };
  const runFeature = (a: ModifAction, opt?: number) => {
    if (a.creates?.weapon) {
      const o = createOptions(a)[opt ?? 0];
      if (o) createItem(a, o);
      return;
    }
    // a choose-one option can carry its own cost (Patient Defense: Disengage and Dodge for 1 Focus Point)
    const chosen = opt !== undefined ? a.options?.[opt] : undefined;
    if (opt !== undefined && a.optionCosts) a = { ...a, cost: a.optionCosts[opt] ?? a.cost };
    // spending a chosen amount (Lay on Hands, Healing Light): the healing follows what's spent
    const he = (opt !== undefined ? a.optionHeals?.[opt] : undefined) ?? a.healExpr;
    if (a.cost && (a.cost.min !== undefined || a.cost.any)) {
      const n = spendOf(a.id, a.cost);
      a = { ...a, cost: { ...a.cost, amount: n }, ...(he ? { heal: he.replace(/dice\(cost\.(?:resource|charges),\s*(d\d+)\)/g, `${n}$1`).replace(/cost\.amount/g, String(n)) } : {}) };
    }
    // the chosen option's own roll (Divine Spark: Heal or Harm)
    const ofx = opt !== undefined ? a.optionEffects?.[opt] : undefined;
    if (ofx) a = { ...a, heal: ofx.heal ?? a.heal, damage: ofx.damage ?? a.damage, save: ofx.save ?? a.save };
    if (chosen) a = { ...a, options: undefined, text: [`Chose: ${chosen}.`, a.text].filter(Boolean).join(" ") };
    const { res, left, ok } = costInfo(a.cost);
    if (!ok) {
      log({ title: a.name, total: "—", cls: "info", detail: `Not enough ${esc(res!.name)} left. ${res!.recover === "never" ? "It doesn't recharge." : res!.recover === "dawn" ? "It recharges at dawn." : `It comes back on a ${res!.recover === "long" ? "Long" : "Short or Long"} Rest.`}` });
      return;
    }
    const after = res && a.cost ? ` · ${left - a.cost.amount} of ${res.max} left` : "";
    if (a.cast) {
      const sp = content.byId(a.cast.spellId);
      if (sp) {
        const lvl = a.cast.level ?? (spellInfo(sp)?.level || 0);
        const sc = a.cast.scroll && scrollUse(a.cast.scroll);
        const useUp = () => {
          if (!a.consume) return;
          setInventory(inv.items.map((it) => (it.id === a.consume ? { ...it, qty: it.qty - 1 } : it)).filter((it) => it.qty > 0), inv.coins);
        };
        if (sc && !sc.readable) {
          log({ title: a.name, total: "—", cls: "info", detail: "The spell isn’t on your spell list, so the scroll is unintelligible to you." });
          return;
        }
        if (sc?.check) {
          const ck = sc.check;
          const r = test(`${a.name}: ${ck.skill ? `${ck.ability} (${ck.skill})` : ck.ability} check`, ck.bonus, { kind: "check", ability: ck.ability, skill: ck.skill, proficient: ck.skill ? d.skills[ck.skill]?.prof : false },
            `<div>DC <b>${a.cast.scroll!.checkDc}</b> to cast it${ck.source ? ` (${esc(ck.source)})` : ""}.</div>`);
          if (!r) return;
          if (r.total < a.cast.scroll!.checkDc) {
            useUp();
            log({ title: a.name, total: "✗", cls: "info", detail: `Failed the check: ${ck.source ? "the scroll disintegrates" : "the spell disappears from the scroll"}.` });
            return;
          }
        }
        castSpell(sp, lvl, null, { dc: a.cast.dc, attack: a.cast.attack, mod: sc ? d.mods[sc.ability] : undefined, free: true, pay: a.cost, via: a.name });
        useUp();
        return;
      }
    }
    if (a.rollTable) {
      const rt = a.rollTable;
      const ent = content.byId(rt.entryId);
      const rollOnce = () => {
        const r = roll(rt.dice);
        const n = r?.total ?? 0;
        const row = ent ? tableRowFor(ent, rt.table, n) : undefined;
        return { n, text: row ? row.join(" — ") : "(see the table)" };
      };
      const first = rollOnce();
      const second = rt.keep === "either" ? rollOnce() : undefined;
      setPlay(pay(a.cost, p));
      log({ title: `${rt.table}`, total: second ? `${first.n} / ${second.n}` : String(first.n), cls: "event",
        detail: `<div><b>${first.n}:</b> ${esc(first.text)}</div>${second ? `<div><b>${second.n}:</b> ${esc(second.text)}</div><div>Use either result.</div>` : ""}${after ? `<div>${esc(after.slice(3))}</div>` : ""}` });
      return;
    }
    const patch: Partial<PlayState> = pay(a.cost, p);
    if (a.summon && typeof a.summon === "object") patch.companions = addCompanions(p, [companionFrom(a.summon as Record<string, unknown>, { source: a.name, key: `act:${a.id}`, entryId: a.id, level: undefined })]);
    if (a.consume) {
      const items = inv.items.map((it) => (it.id === a.consume ? { ...it, qty: it.qty - 1 } : it)).filter((it) => it.qty > 0);
      setInventory(items, inv.coins);
    }
    if (a.tempHp && !a.heal) {
      const r = roll(a.tempHp);
      const t = Math.max(p.hpTemp, Math.max(0, r?.total ?? 0));
      patch.hpTemp = t;
      log({ title: a.name, total: String(t), cls: "info", detail: `Temporary HP ${esc(r ? describeRolled(r) : a.tempHp)}${t === p.hpTemp ? " (you keep the higher amount)" : ""}${after}${a.text ? `<div>${esc(a.text)}</div>` : ""}` });
      setPlay(patch);
      return;
    }
    if (a.heal) {
      const r = roll(a.heal);
      if (!r) return;
      const cur = Math.min(hpMax, hpCur + Math.max(0, r.total));
      patch.hpCur = cur;
      log({ title: `${a.name}`, total: `+${cur - hpCur}`, cls: "heal", detail: `${esc(describeRolled(r))} · HP ${hpCur} → ${cur}${after}${a.consume ? " · used up" : ""}` });
    } else {
      const acts: CardAction[] = (a.damage || []).filter((x) => x.dice).map((x) => ({ label: `Roll damage (${x.dice})`, run: () => rollDamage(a.name, x.dice, false, x.type) }));
      // a die spent from a pool (a Superiority Die, Bardic Inspiration): roll it
      if (res?.die && a.cost) {
        const n = a.cost.amount > 1 ? `${a.cost.amount}${res.die.replace(/^1?d/, "d")}` : res.die.replace(/^1d/, "d");
        const expr = /^d/.test(n) ? `1${n}` : n;
        acts.push({ label: `Roll ${n}`, run: () => { const r = roll(expr); if (r) log({ title: `${a.name}: ${res.name}`, total: String(r.total), cls: "info", detail: esc(describeRolled(r)) }); } });
      }
      log({
        title: a.name, total: "", cls: "event",
        detail: [a.save ? `${a.save.dc ? `DC <b>${a.save.dc}</b> ` : ""}${esc(a.save.ability)} save${a.save.success === "half" ? " (half on a success)" : ""}` : "", a.options ? `Choose: ${esc(a.options.join(", "))}` : "", esc(a.text || ""), after.slice(3), a.consume ? "Used up." : ""].filter(Boolean).map((x) => `<div>${x}</div>`).join(""),
      }, acts);
    }
    setPlay(patch);
  };

  // ------------------------------------------------------ active effects
  const activeList: ActiveEffect[] = p.active || [];
  const isOn = (key: string) => activeList.some((x) => x.key === key);
  const switchOn = (t: ModifToggle) => {
    const { res, ok } = costInfo(t.cost);
    if (!ok) {
      log({ title: t.name, total: "—", cls: "info", detail: `No ${esc(res!.name)} left.` });
      return;
    }
    setPlay((cur) => ({ ...pay(t.cost, cur), active: [...(cur.active || []).filter((x) => x.key !== t.key), { key: t.key, name: t.name, kind: "toggle", minutes: t.minutes, since: timeNow() }] }));
    log({ title: `${t.name} on`, total: "", cls: "event", detail: [...t.lines, t.duration ? `Lasts ${t.duration}.` : "", t.ends || ""].filter(Boolean).map((x) => `<div>${esc(x)}</div>`).join("") });
  };
  const endEffect = (x: ActiveEffect) => {
    // a summoning spell ending takes its creatures with it
    setPlay((cur) => ({ active: (cur.active || []).filter((y) => y.key !== x.key), companions: (cur.companions || []).filter((y) => y.key !== x.key), ...(x.concentration ? { concentration: undefined } : {}) }));
    log({ title: `${x.name} ended`, total: "", cls: "event", detail: "" });
  };
  // ------------------------------------------------------------- forms (Wild Shape)
  const openForms = () => {
    setTab("actions");
    setFormPick(true);
    setTimeout(() => formsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  /** Become a creature: spends a use (also when switching from one form to another) and gives the Temporary Hit Points. */
  const transform = (t: ModifToggle, cr: CreatureStats) => {
    const { res, ok } = costInfo(t.cost);
    if (!ok) { log({ title: t.name, total: "—", cls: "info", detail: `No ${esc(res!.name)} left.` }); return; }
    const temp = t.form?.tempHp || 0;
    setPlay((cur) => ({
      ...pay(t.cost, cur),
      active: [...(cur.active || []).filter((x) => x.key !== t.key), { key: t.key, name: `${t.name} (${cr.name})`, kind: "toggle", minutes: t.minutes, since: timeNow() }],
      formOf: { ...(cur.formOf || {}), [t.key]: cr.id },
      // Temporary Hit Points don't stack: keep the higher
      hpTemp: Math.max(cur.hpTemp, temp),
    }));
    log({ title: `${t.name}: ${cr.name}`, total: "", cls: "event",
      detail: [`${cr.size} ${cr.tagline.split(",")[0].replace(/^\S+\s/, "")}, CR ${cr.crText}. AC ${Math.max(cr.ac, t.form?.acMin ?? 0)}, Speed ${cr.speedText}.`,
        temp ? `You gain ${temp} Temporary Hit Points${p.hpTemp > temp ? ` (you keep your ${p.hpTemp}, which is more)` : ""}.` : "",
        t.duration ? `Lasts ${t.duration}.` : "", t.ends || ""].filter(Boolean).map((x) => `<div>${esc(x)}</div>`).join("") });
    setFormPick(false);
  };
  const setKnownForms = (id: string, ids: string[]) => setPlay((cur) => ({ forms: { ...(cur.forms || {}), [id]: ids } }));
  const allCreatures = () => content.byType("Creature").map((e) => creatureFor(e.id)!).filter(Boolean);
  // ------------------------------------------------------- companions (summons, familiars, a Ranger's beast)
  /** "$srd/monsters/wolf", "$phb2024/spells/summon-beast#bestial-spirit" or "$#anchor" -> a ref the panel can read. */
  const summonRef = (ref: string, entryId: string): string | undefined => {
    if (ref.startsWith("$#")) return `${entryId}#${ref.slice(2)}`;
    const base = resolveRef(ref, content);
    if (!base) return undefined;
    const anchor = ref.split("#")[1];
    return anchor ? `${base.id}#${anchor}` : base.id;
  };
  /** A `summon` block -> a companion to add (the player picks the creature or version on its card if there's a choice). */
  const companionFrom = (spec: Record<string, unknown>, o: { source: string; key: string; entryId: string; level?: number }): Companion => {
    const cr = spec.creature as unknown;
    const comp: Companion = { uid: Math.random().toString(36).slice(2, 9), source: o.source, key: o.key, limit: typeof spec.limit === "number" ? spec.limit : undefined };
    comp.for = o.entryId;
    if (typeof cr === "string") {
      if (cr.startsWith("variant:")) { comp.pickAny = true; comp.text = "Pick the creature it becomes (see the item’s description)."; }
      else comp.ref = summonRef(cr, o.entryId);
    } else if (cr && typeof cr === "object") {
      const x = cr as Record<string, unknown>;
      const ch = x.choose as unknown;
      if (Array.isArray(ch)) { comp.options = ch.map((r) => summonRef(String(r), o.entryId)).filter(Boolean) as string[]; comp.ref = comp.options[0]; }
      else if (ch && typeof ch === "object" && (ch as Record<string, unknown>).creature) {
        const f = (ch as Record<string, Record<string, unknown>>).creature;
        comp.filter = { type: typeof f.type === "string" ? f.type : undefined, crMax: typeof f["cr-max"] === "number" ? f["cr-max"] : undefined };
      } else if (typeof x.text === "string") comp.text = x.text;
      else if (x["roll-table"] && typeof x["roll-table"] === "object") {
        const rt = x["roll-table"] as Record<string, unknown>;
        comp.pickAny = true;
        comp.rollDice = typeof rt.dice === "string" ? rt.dice : undefined;
        comp.text = "Roll on the item’s table, then pick the creature it shows.";
      } else if (x["copy-of"]) {
        comp.pickAny = true;
        comp.halfHp = x["hp-max"] === "half";
        comp.text = `A copy of a creature you pick${comp.halfHp ? ", with half its Hit Point maximum" : ""}.`;
      } else comp.text = "A creature (see the description).";
      const to = (x["type-override"] as Record<string, unknown> | undefined)?.choose;
      if (Array.isArray(to)) { comp.types = to.map(String); comp.type = comp.types[0]; }
    }
    const tov = (spec["type-override"] as Record<string, unknown> | undefined)?.choose;
    if (Array.isArray(tov)) { comp.types = tov.map(String); comp.type = comp.types[0]; }
    const vch = (spec.variant as Record<string, unknown> | undefined)?.choose;
    if (Array.isArray(vch)) { comp.variants = vch.map(String); comp.variant = comp.variants[0]; }
    if (spec["stat-level"] === "slot-level") comp.level = o.level;
    if (typeof spec.count === "number") comp.count = spec.count;
    return comp;
  };
  /** Add companions, replacing older ones from the same source when it allows only one. */
  const addCompanions = (cur: PlayState, list: Companion[]): Companion[] => {
    let out = cur.companions || [];
    for (const n of list) out = [...out.filter((x) => !(x.key === n.key && (n.limit === 1 || x.key.startsWith("spell:")))), n];
    return out;
  };
  /** A creature that's only a description ("Large hand: AC 20, HP equal to your HP maximum"): its AC and HP when it gives them. */
  const textCreature = (cp: Companion): CreatureStats | undefined => {
    const t = cp.text || "";
    const ac = t.match(/\bAC\s*(\d+)/i)?.[1];
    const hp = /HP equal to your (?:HP|Hit Point) maximum/i.test(t) ? hpMax : +(t.match(/(\d+)\s*HP\b/i)?.[1] || t.match(/\bHP\s*(\d+)/i)?.[1] || 0);
    if (!ac && !hp) return undefined;
    const name = t.split(/[:;,.]/)[0].trim().replace(/^(Invisible|Illusory|Large|Medium|Small)\s+/i, (m) => m) || cp.source;
    return {
      id: `text:${cp.uid}`, name: name[0].toUpperCase() + name.slice(1), size: "", type: "", tagline: t, cr: 0, crText: "—", ac: ac ? +ac : 10, hp: hp || 1, hpText: "",
      speedText: t.match(/Speed\s*\d+\s*ft\.?/i)?.[0].replace(/^Speed\s*/i, "") || "—", walk: 0, fly: 0, swim: 0, climb: 0, burrow: 0, swarm: false,
      scores: Object.fromEntries(ABILITIES.map((a) => [a, 10])), saves: {}, skills: {}, senses: "", languages: "", defenses: [], traits: [], actions: [], bonusActions: [], reactions: [],
    };
  };
  /** The `summon` blocks in a spell's Effects. */
  const summonsIn = (e: Entry) => (e.effects || []).flatMap((f) => readBlocks(f.yaml).blocks.filter((b) => b.type === "summon").map((b) => b.v as Record<string, unknown>));
  /** A companion's stat block, with your numbers in its formulas (summoned spirits, a Ranger's beast). */
  /** Options other features add to this companion's summon (Pact of the Chain, Investment of the Chain Master). */
  const boostsOf = (cp: Companion) => fx.summonOptions.filter((o) => o.for === cp.for);
  const companionStats = (cp: Companion): CreatureStats | undefined => {
    const base = companionBase(cp);
    if (!base) return undefined;
    const st: CreatureStats = { ...base, actions: base.actions, bonusActions: base.bonusActions, reactions: base.reactions };
    if (cp.halfHp) st.hp = Math.max(1, Math.floor(st.hp / 2));
    for (const b of boostsOf(cp)) {
      if (b.speed) {
        const kind = cp.speedKind && b.speed.kinds.includes(cp.speedKind) ? cp.speedKind : b.speed.kinds[0];
        const label = `${kind[0].toUpperCase()}${kind.slice(1)}`;
        const has = st.speedText.match(new RegExp(`${label}\\s+(\\d+)\\s*ft\\.?`, "i"));
        // a speed it already has stays unless the new one is faster
        if (!has) st.speedText = `${st.speedText}, ${label} ${b.speed.value} ft.`;
        else if (+has[1] < b.speed.value) st.speedText = st.speedText.replace(has[0], `${label} ${b.speed.value} ft.`);
      }
      const k = casters.find((x) => x.info.cls.name === "Warlock") || casters[0];
      const fix = (a: CreatureAction): CreatureAction => {
        let out = a;
        if (b.saveDc && a.save && k) out = { ...out, save: { ...a.save, dc: k.dc }, text: out.text.replace(/DC \d+/, `DC ${k.dc}`) };
        if (b.damageType && cp.dmgType && b.damageType.choose.includes(cp.dmgType)) {
          const to = cp.dmgType[0].toUpperCase() + cp.dmgType.slice(1);
          out = { ...out, damage: out.damage.map((x) => (b.damageType!.replaces.includes(x.type.toLowerCase()) ? { ...x, type: to } : x)) };
        }
        return out;
      };
      st.actions = st.actions.map(fix);
      st.bonusActions = st.bonusActions.map(fix);
      st.reactions = st.reactions.map(fix);
    }
    return st;
  };
  const companionBase = (cp: Companion): CreatureStats | undefined => {
    if (!cp.ref) return cp.text ? textCreature(cp) : undefined;
    const [id, anchor] = cp.ref.split("#");
    if (!anchor) return creatureFor(id);
    const e = content.byId(id);
    const sb = e ? statBlockMd(e, anchor) : undefined;
    if (!e || !sb) return undefined;
    const k = casters.find((x) => e.type === "Spell" ? true : infos.some((i) => (i.cls.id === e.id || i.sub?.id === e.id) && i.cls.id === x.info.cls.id)) || casters[0];
    const classLevels = Object.fromEntries(infos.map((i) => [i.cls.name.toLowerCase(), i.level]));
    return parseStatBlockMd(cp.ref, sb.name, sb.md, { level: cp.level, variant: cp.variant, spellAttack: k?.atk, spellDc: k?.dc, pb: dBase.pb, mods: dBase.mods, classLevels });
  };
  const setCompanion = (uid: string, patch: Partial<Companion>) => setPlay((cur) => ({ companions: (cur.companions || []).map((x) => (x.uid === uid ? { ...x, ...patch } : x)) }));
  const summonFeature = (sm: ModifSummon) => {
    setPlay((cur) => ({ companions: addCompanions(cur, [companionFrom(sm.spec as Record<string, unknown>, { source: sm.source === sm.name ? sm.name : `${sm.name} (${sm.source})`, key: sm.key, entryId: sm.entryId })]) }));
    log({ title: `${sm.name}: summoned`, total: "", cls: "event", detail: "It appears under Companions on the Actions tab." });
  };
  /** One creature action with its roll buttons (attack, damage, or the save it forces). */
  const creatureActionRow = (cr: CreatureStats, a: CreatureAction, i: number, companion = false) => (
    <div key={`${a.name}-${i}`} className="crow">
      <div className="ctext"><b>{a.name}.</b> <span className="note">{a.text}</span></div>
      <div className="rowbtn">
        {a.toHit !== undefined && <button className="sbtn sm" onClick={() => (companion ? companionAttack : attack)(creatureAttack(cr, a))}>{fmt(a.toHit)} to hit</button>}
        {a.save && <span className="tag plain">DC {a.save.dc} {a.save.ability.slice(0, 3)}</span>}
        {a.damage.length > 0 && <button className="sbtn sm ghost" onClick={() => rollDamage(`${a.name} (${cr.name})`, a.damage.map((x) => x.expr).join("+"), false, a.damage.map((x) => x.type).join(" + "))}>{a.damage.map((x) => x.expr).join(" + ")}</button>}
      </div>
    </div>
  );
  /** The stat block you're using while in a form, with your own Int/Wis/Cha and the better skill and save numbers. */
  const formBlock = (t: ModifToggle, cr: CreatureStats) => (
    <div className="formblock">
      <div className="fbhead">
        <div><b className="fbname">{cr.name}</b> <span className="mut">{cr.tagline} · CR {cr.crText}</span></div>
        <div className="fbtags">
          <Tip tip={d.acNote !== cr.name ? `${d.acNote} gives you a higher AC than the ${cr.name}'s ${cr.ac}.` : `The ${cr.name}'s natural armor.`}><span className="tag plain">AC {d.ac}</span></Tip>
          <span className="tag plain">Speed {cr.speedText}</span>
          {cr.senses && <span className="tag plain">{cr.senses}</span>}
        </div>
      </div>
      <p className="note" style={{ margin: "4px 0 8px" }}>
        Your HP: <b>{hpCur}/{hpMax}</b>{p.hpTemp ? <> + <b>{p.hpTemp}</b> temporary</> : null}. Strength, Dexterity and Constitution come from the {cr.name}; Intelligence, Wisdom, Charisma and your proficiencies stay yours, and each skill and save uses the higher of your number or the {cr.name}’s.
        {formTog?.form?.blocksSpells ? " You can’t cast spells in this form." : ""}{cr.defenses.length ? ` ${cr.defenses.join(" · ")}.` : ""}
      </p>
      <div className="fbabil">
        {(["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"] as const).map((a) => (
          <div key={a} className="fbab">
            <div className="sl">{a.slice(0, 3)}</div>
            <button className="sbtn sm" onClick={() => test(`${a} check (${cr.name})`, d.mods[a], { kind: "check", ability: a })}>{fmt(d.mods[a])}</button>
            <div className="mut" style={{ fontSize: 11 }}>{d.scores[a]}{["Intelligence", "Wisdom", "Charisma"].includes(a) ? " (yours)" : ""}</div>
            <button className="sbtn sm ghost" onClick={() => test(`${a} save (${cr.name})`, d.saves[a].value, { kind: "save", ability: a })}>Save {fmt(d.saves[a].value)}</button>
          </div>
        ))}
      </div>
      {Object.keys(cr.skills).length > 0 && (
        <div className="rowbtn" style={{ flexWrap: "wrap", marginTop: 8 }}>
          {Object.keys(cr.skills).filter((k) => d.skills[k]).map((k) => (
            <button key={k} className="sbtn sm ghost" onClick={() => test(`${k} (${cr.name})`, d.skills[k].value, { kind: "check", ability: SKILL_ABILITY[k], skill: k, proficient: d.skills[k].prof } as RollContext)}>{k} {fmt(d.skills[k].value)}</button>
          ))}
        </div>
      )}
      {cr.traits.length > 0 && <div className="fbsec"><h4>Traits</h4>{cr.traits.map((x) => <div key={x.name} className="crow"><div className="ctext"><b>{x.name}.</b> <span className="note">{x.text}</span></div></div>)}</div>}
      <div className="fbsec"><h4>Actions</h4>{cr.actions.map((a, i) => creatureActionRow(cr, a, i))}</div>
      {cr.bonusActions.length > 0 && <div className="fbsec"><h4>Bonus Actions</h4>{cr.bonusActions.map((a, i) => creatureActionRow(cr, a, i))}</div>}
      {cr.reactions.length > 0 && <div className="fbsec"><h4>Reactions</h4>{cr.reactions.map((a, i) => creatureActionRow(cr, a, i))}</div>}
      {t.lines.length > 0 && <div className="note" style={{ marginTop: 8 }}>{t.lines.join(" · ")}</div>}
    </div>
  );
  /**
   * Extra damage you add on a hit (Sneak Attack, Brutal Strike, Divine Strike…), with the effects you can trade dice
   * for or pick (Cunning Strike, Brutal Strike's blows) and their save DC.
   */
  const ridersSection = () => {
    if (formCr) return null;
    const riders = fx.triggers.filter((t) => t.damage?.length && !t.reaction);
    // effects you can add on a hit without extra damage (Stunning Strike), with their save DC
    const plain = fx.triggers.filter((t) => !t.damage?.length && !t.reaction && !t.follows && /^When you hit/.test(t.when) && (t.cost || /save/.test(t.text)));
    if (!riders.length && !plain.length) return null;
    return (
      <>
        <h3 style={{ marginTop: 16 }}>On a hit</h3>
        <table className="atks bonusacts">
          <tbody>
            {riders.map((t) => {
              const followers = fx.triggers.filter((f) => f.follows && t.id && f.follows === t.id && f.options?.length);
              const own = t.options?.length ? [t] : [];
              const groups = [...own, ...followers];
              const picked = riderPick[t.key] || [];
              const opts = groups.flatMap((g) => (g.options || []).map((o) => ({ ...o, group: g })));
              const main = t.damage![0];
              const dm = main.dice.match(/^(\d+)d(\d+)$/);
              const spent = opts.filter((o) => picked.includes(`${o.group.key}:${o.id}`)).reduce((n, o) => n + (o.diceCost || 0), 0);
              const left = dm ? Math.max(0, +dm[1] - spent) : 0;
              const dice = dm ? (left ? `${left}d${dm[2]}` : "") : main.dice;
              const pickMax = (g: (typeof groups)[number]) => g.pick || 1;
              const toggle = (o: (typeof opts)[number]) => {
                const k = `${o.group.key}:${o.id}`;
                setRiderPick((m) => {
                  const cur = m[t.key] || [];
                  return { ...m, [t.key]: cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k] };
                });
              };
              const roll1 = () => {
                const chosen = opts.filter((o) => picked.includes(`${o.group.key}:${o.id}`));
                const lines = chosen.map((o) => `<div><b>${esc(o.group.name)}: ${esc(o.label)}</b>${o.save && o.group.dc ? ` · DC <b>${o.group.dc}</b> ${esc(o.save)} save` : ""}${o.text ? ` · ${esc(o.text)}` : ""}</div>`).join("");
                const extra = t.damage!.slice(1).map((x) => x.dice).join("+");
                const expr = [dice, extra].filter(Boolean).join("+");
                if (expr) {
                  const r = roll(expr);
                  if (r) log({ title: `${t.name} damage`, total: String(r.total), cls: "dmg", detail: `${eqOf(r)}${esc(describeRolled(r))}${main.type && main.type !== "weapon" ? ` · ${esc(main.type)}` : " · the weapon’s damage type"}${spent ? `<div>Traded ${spent}d${dm?.[2]} for the effects below.</div>` : ""}${lines}` });
                } else log({ title: t.name, total: "", cls: "event", detail: `All its dice traded for effects.${lines}` });
                setRiderPick((m) => ({ ...m, [t.key]: [] }));
              };
              return (
                <tr key={t.key}>
                  <td><b>{t.name}</b><div className="note">{t.source !== t.name ? t.source : ""}</div></td>
                  <td className="note">
                    {t.when}.
                    {groups.map((g) => (
                      <div key={g.key} className="rowbtn" style={{ flexWrap: "wrap", marginTop: 4 }}>
                        <span className="mut">{g.name}{g.dc ? ` (DC ${g.dc})` : ""}{pickMax(g) > 1 ? `, up to ${pickMax(g)}` : ""}:</span>
                        {(g.options || []).map((o) => {
                          const k = `${g.key}:${o.id}`;
                          const on = picked.includes(k);
                          const inGroup = picked.filter((x) => x.startsWith(`${g.key}:`)).length;
                          const full = !on && inGroup >= pickMax(g);
                          const broke = !on && !!o.diceCost && dm !== null && o.diceCost > left;
                          return (
                            <Btn key={k} className={`sbtn sm ${on ? "" : "ghost"}`} aria-pressed={on} disabled={full || broke}
                              why={full ? `You can add ${pickMax(g)} effect${pickMax(g) > 1 ? "s" : ""} per ${t.name}.` : broke ? `Costs ${o.diceCost}d${dm?.[2]}; only ${left} left.` : undefined}
                              onClick={() => toggle({ ...o, group: g })}>{o.label}{o.diceCost ? ` (−${o.diceCost}d${dm?.[2] || 6})` : ""}</Btn>
                          );
                        })}
                      </div>
                    ))}
                  </td>
                  <td><div className="rowbtn"><button className="sbtn sm" onClick={roll1}>{dice ? `Roll ${dice}${t.damage!.length > 1 ? " +" : ""}` : "Use"}</button></div></td>
                </tr>
              );
            })}
            {plain.map((t) => {
              const { res, left, ok } = costInfo(t.cost);
              return (
                <tr key={`hit-${t.key}`}>
                  <td><b>{t.name}</b><div className="note">{t.source}</div></td>
                  <td className="note">{t.text}{res ? ` ${left} / ${res.max} ${res.name}.` : ""}</td>
                  <td><div className="rowbtn"><Btn className="sbtn sm" disabled={!ok} why={whyNot(t.cost, t.name)} onClick={() => useTrigger(t)}>Use</Btn></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </>
    );
  };
  /** Dice kept from a Long Rest (Portent): tap one to use it in place of a d20 roll. */
  const recordedSection = () => {
    const rolls = fx.onLongRest.filter((x) => x.roll && x.key);
    if (!rolls.length) return null;
    return rolls.map((x) => {
      const rec = p.recorded?.[x.key!];
      const tail = (k: string) => k.replace(/^.*[:#]/, "");
      const res = resources.find((r) => tail(r.key) === x.key);
      const rollNow = () => {
        const r = roll(x.roll!);
        const values = r ? r.parts.flatMap((pt) => pt.rolls || []) : [];
        setPlay((cur) => ({ recorded: { ...(cur.recorded || {}), [x.key!]: { source: x.source, values, used: values.map(() => false) } } }));
        log({ title: `${x.source}: foretelling rolls`, total: values.join(", "), cls: "event", detail: esc(x.text || "") });
      };
      const use = (i: number) => {
        setPlay((cur) => {
          const r0 = cur.recorded?.[x.key!];
          if (!r0) return {};
          const used = r0.used.map((u, j) => u || j === i);
          return { recorded: { ...cur.recorded, [x.key!]: { ...r0, used } }, ...(res ? { resUsed: { ...cur.resUsed, [res.key]: Math.min(res.max, (cur.resUsed[res.key] || 0) + 1) } } : {}) };
        });
        log({ title: `${x.source}: used a ${rec!.values[i]}`, total: String(rec!.values[i]), cls: "event", detail: "It replaces the d20 roll (yours or a creature’s you can see), before the roll." });
      };
      return (
        <div key={x.key} className="spanel formpanel">
          <div className="fphead">
            <h3 style={{ margin: 0 }}>{x.source}</h3>
            <span className="mut" style={{ fontSize: 12.5 }}>rolled at the end of each Long Rest · tap one to use it in place of a d20 roll</span>
            <span style={{ flex: 1 }} />
            {!rec && <button className="sbtn sm" onClick={rollNow}>Roll {x.roll}</button>}
          </div>
          {rec ? (
            <div className="rowbtn" style={{ flexWrap: "wrap", marginTop: 8 }}>
              {rec.values.map((v, i) => (
                <Btn key={i} className={`sbtn ${rec.used[i] ? "ghost" : ""}`} disabled={rec.used[i]} why={`You’ve used this ${v}. New rolls come at the end of your next Long Rest.`} onClick={() => use(i)}>{v}</Btn>
              ))}
            </div>
          ) : <p className="note" style={{ margin: "6px 0 0" }}>No rolls yet: they’re made when you finish a Long Rest, or roll them now.</p>}
        </div>
      );
    });
  };
  /** Weapon Mastery: which weapons' mastery properties you can use, and what each one does. */
  const masteryText = (prop: string): string | undefined => {
    for (const e of content.byType("Rule")) {
      if (!e.sections.some((x) => /^Mastery Properties$/i.test(x.title))) continue;
      const sec = e.sections.find((x) => x.title.toLowerCase() === prop.toLowerCase());
      return sec ? stripMd(sec.md).replace(/\s+/g, " ").trim() : undefined;
    }
    return undefined;
  };
  const masterySection = () => {
    if (formCr || !fx.masteries.length) return null;
    const mine = new Set(fx.masteries.map((m) => slug(m)));
    const rows = wielded.filter(({ w }) => w.mastery && mine.has(slug(w.name)));
    return (
      <>
        <h3 style={{ marginTop: 16 }}>Weapon Mastery</h3>
        <p className="note" style={{ marginTop: 0 }}>You can use the mastery property of: {fx.masteries.join(", ")}. Change them in the <Link to={`/build/${c.id}`}>builder</Link>.</p>
        {rows.length === 0 ? <p className="note">None of the weapons you’re holding are ones you’ve mastered.</p> : (
          <table className="atks bonusacts">
            <tbody>
              {rows.map(({ it, w }) => (
                <tr key={it.id}><td><b>{it.name}</b><div className="note">{w.mastery}</div></td><td className="note">{masteryText(w.mastery) || "See the Weapons rules."}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </>
    );
  };
  // ------------------------------------------------------------- features tab: uses and actions next to each feature
  const fromFeature = (name: string, source: string, itemName?: string) => {
    const n = name.toLowerCase();
    const s0 = source.toLowerCase();
    return s0 === n || s0.startsWith(`${n} (`) || s0.startsWith(`${n} ·`) || (itemName || "").toLowerCase() === n;
  };
  /** What a feature gives you to use: its actions, switches, "when this happens" options, free spells and uses. */
  const featureBits = (name: string) => ({
    acts: fx.actions.filter((a) => fromFeature(name, a.source, a.name)),
    togs: fx.toggles.filter((t) => fromFeature(name, t.source, t.name)),
    trgs: fx.triggers.filter((t) => fromFeature(name, t.source, t.name)),
    spells: fx.grantedSpells.filter((g) => fromFeature(name, g.source)),
    res: resources.filter((r) => r.name.toLowerCase() === name.toLowerCase() || r.name.toLowerCase().startsWith(`${name.toLowerCase()} `)),
  });
  /** Small action-type labels in a feature's title row ("Bonus Action", "Reaction"). */
  const featureBadges = (name: string) => {
    const b = featureBits(name);
    const kinds = [...new Set([...b.acts.map((a) => a.activation), ...b.togs.map((t) => t.activation), ...b.trgs.map((t) => (t.reaction ? "Reaction" : "Special"))].filter(Boolean))];
    return kinds.length ? <span className="fkinds">{kinds.map((k2) => <span key={k2} className="tag plain">{k2}</span>)}</span> : null;
  };
  /** Under a feature's text: its uses (tappable), Use buttons and the spells it grants (open in the details panel). */
  const featureExtras = (name: string) => {
    const b = featureBits(name);
    const res = [...new Map([...b.res, ...[...b.acts.map((a) => costInfo(a.cost).res), ...b.togs.map((t) => costInfo(t.cost).res), ...b.trgs.map((t) => costInfo(t.cost).res)].filter(Boolean) as typeof resources].map((r) => [r.key, r])).values()];
    if (!res.length && !b.acts.length && !b.togs.length && !b.spells.length) return null;
    return (
      <div className="fextra">
        {res.map((r) => {
          const used = p.resUsed[r.key] || 0;
          return (
            <span key={r.key} className="fuse">
              <span className="mut">{r.name}{r.die ? ` (${r.die})` : ""}:</span>
              {r.max <= 10 ? <Pips n={r.max} used={used} onToggle={(i) => setPlay((cur) => ({ resUsed: { ...cur.resUsed, [r.key]: i < (cur.resUsed[r.key] || 0) ? i : i + 1 } }))} /> : <b>{r.max - used}/{r.max}</b>}
              <span className="mut">/ {r.recover === "short" ? "Short Rest" : r.recover === "shortOne" ? "Long Rest (1 back on a Short Rest)" : r.recover === "dawn" ? "Dawn" : r.recover === "never" ? "doesn’t recharge" : "Long Rest"}</span>
            </span>
          );
        })}
        {b.acts.map((a) => (
          <Btn key={`a-${a.id}`} className="sbtn sm" disabled={optionLabels(a) ? !optionOf(a).ok : !costInfo(a.cost).ok} why={actWhy(a, optionLabels(a) ? optionOf(a) : undefined)} onClick={() => runFeature(a, optionLabels(a) ? optionOf(a).i : undefined)}>
            {a.name === name ? "Use" : a.name}{a.activation ? ` · ${a.activation}` : ""}
          </Btn>
        ))}
        {b.togs.map((t) => (
          <Btn key={`t-${t.key}`} className="sbtn sm" disabled={(!t.form && isOn(t.key)) || !costInfo(t.cost).ok} why={isOn(t.key) ? `${t.name} is already active.` : whyNot(t.cost, t.name)} onClick={() => (t.form ? openForms() : switchOn(t))}>
            {t.form ? "Choose form" : isOn(t.key) ? "Active" : "Use"}{t.activation ? ` · ${t.activation}` : ""}
          </Btn>
        ))}
        {b.spells.map((g) => (
          <button key={`s-${g.spell.id}`} className="sbtn sm ghost" onClick={() => setDrawer({ kind: "spell", id: g.spell.id, via: g.source })}>{g.spell.name} ({spellInfo(g.spell)?.level ? `level ${spellInfo(g.spell)!.level}` : "cantrip"})</button>
        ))}
      </div>
    );
  };
  // ------------------------------------------------------------- actions tab helpers
  /** Activations that use your action (as opposed to No action, special, or longer). */
  const isActionAct = (act: string) => !act || /^(action|magic|utilize|attack|attack-action|replace-attack|(magic|utilize|attack) action|part of the attack action|replaces one attack)$/i.test(act);
  /** Spells you know that make attack rolls, as rows in the attack table (Guiding Bolt +5, 4d6). */
  const spellAttackRows = () => {
    if (formCr || !content.loaded.has("spells")) return null;
    return spellRows().map((r) => {
      const n = castNumbers(r);
      const pl = spellPlan(r.sp, { slot: r.lvl, charLevel: c.level, spell: { mod: n.mod, dc: n.dc, attack: n.atk } });
      if (!pl?.attack) return null;
      const dmg = pl.damage.map((x) => x.dice).join("+") || "0";
      const type = pl.damage.map((x) => x.type).filter(Boolean).join(" + ");
      const st = rowCastState(r);
      return (
        <tr key={`sa-${r.sp.id}-${r.source}`}>
          <td><button className="linkish spname" onClick={() => setDrawer({ kind: "spell", id: r.sp.id, via: r.g ? r.g.source : r.k ? `k:${r.k.info.index}` : undefined })}>{r.sp.name}</button><div className="note">{r.lvl ? `Level ${r.lvl} spell` : "Cantrip"}{r.source ? ` · ${r.source}` : ""}{stripMd(r.sp.fields["range"] || "") ? ` · ${stripMd(r.sp.fields["range"])}` : ""}</div></td>
          <td>{fmt(n.atk)}</td>
          <td>{dmg} {type}{pl.attack.count > 1 ? <div className="note">×{pl.attack.count} beams or attacks</div> : null}</td>
          <td><div className="rowbtn"><Btn className="sbtn sm" disabled={!st.ok} why={st.why} onClick={() => castRow(r)}>{st.label === "Free" ? "Cast free" : "Cast"}</Btn></div></td>
        </tr>
      );
    });
  };
  /** Everything with limited uses in one place: features, items, free spell casts, each with its uses. */
  const limitedSection = () => {
    const rows: { key: string; name: string; source: string; res: (typeof resources)[number]; act?: ReactNode }[] = [];
    const seen = new Set<string>();
    const add = (key: string, name: string, source: string, cost: ModifCost | undefined, act?: ReactNode) => {
      const { res } = costInfo(cost);
      if (!res) return;
      rows.push({ key, name, source, res, act });
      seen.add(res.key);
    };
    for (const a of fx.actions) add(`a:${a.id}`, a.name, `${a.activation || "Use"} · ${a.source}`, a.optionCosts ? a.optionCosts.find(Boolean) ?? a.cost : a.cost, (
      <Btn className="sbtn sm" disabled={optionLabels(a) ? !optionOf(a).ok : !costInfo(a.cost).ok} why={actWhy(a, optionLabels(a) ? optionOf(a) : undefined)} onClick={() => runFeature(a, optionLabels(a) ? optionOf(a).i : undefined)}>{a.cast ? "Cast" : "Use"}</Btn>
    ));
    for (const t of fx.toggles) add(`t:${t.key}`, t.name, `${t.activation || "Use"} · ${t.source}`, t.cost, (
      <Btn className="sbtn sm" disabled={!costInfo(t.cost).ok || (!t.form && isOn(t.key))} why={isOn(t.key) ? `${t.name} is already active.` : whyNot(t.cost, t.name)} onClick={() => (t.form ? openForms() : switchOn(t))}>{t.form ? "Choose form" : "Use"}</Btn>
    ));
    for (const t of fx.triggers) add(`g:${t.key}`, t.name, t.when, t.cost, <Btn className="sbtn sm" disabled={!costInfo(t.cost).ok} why={whyNot(t.cost, t.name)} onClick={() => useTrigger(t)}>Use</Btn>);
    for (const g of fx.grantedSpells) {
      const free = g.free ? resources.find((r) => r.key === g.free) : undefined;
      if (!free) continue;
      const r: SpellRowData = { sp: g.spell, lvl: spellInfo(g.spell)?.level || 0, g, source: g.source };
      const st = rowCastState(r);
      rows.push({ key: `s:${g.spell.id}:${g.source}`, name: g.spell.name, source: `Free cast · ${g.source}`, res: free, act: <Btn className="sbtn sm" disabled={st.label !== "Free"} why={freeWhy(free, free.max - (p.resUsed[free.key] || 0))} onClick={() => castRow(r)}>Cast free</Btn> });
      seen.add(free.key);
    }
    // pools with no button of their own (Lay on Hands HP, item charges), so nothing is missed
    for (const r of resources) if (!seen.has(r.key)) rows.push({ key: `r:${r.key}`, name: r.name, source: "Uses", res: r });
    if (!rows.length) return <p className="note">Nothing with limited uses yet.</p>;
    return (
      <table className="atks bonusacts">
        <tbody>
          {rows.map((x) => {
            const used = p.resUsed[x.res.key] || 0;
            return (
              <tr key={x.key}>
                <td><b>{x.name}</b><div className="note">{x.source}</div></td>
                <td>
                  {x.res.max <= 10
                    ? <Pips n={x.res.max} used={used} onToggle={(i) => setPlay((cur) => ({ resUsed: { ...cur.resUsed, [x.res.key]: i < (cur.resUsed[x.res.key] || 0) ? i : i + 1 } }))} />
                    : <span><b>{x.res.max - used}</b> / {x.res.max}</span>}
                  <div className="note">{refreshText(x.res).replace(/^It /, "").replace(/^comes/, "Comes")}</div>
                </td>
                <td><div className="rowbtn">{x.act}</div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };
  // ------------------------------------------------------------- spells tab (table like D&D Beyond)
  /** `book`: a ritual in a Wizard's spellbook that isn't prepared (it can only be cast as a Ritual). */
  type SpellRowData = { sp: Entry; lvl: number; k?: Caster; g?: (typeof fx.grantedSpells)[number]; source: string; book?: boolean };
  const isRitual = (sp: Entry) => /\britual\b/i.test(sp.fields["casting time"] || "");
  /** The caster with Memorize Spell (swap one prepared spell after a Short Rest), if any. */
  const memorizer = () => casters.find((x) => (casterEntry(x.info)?.effects || []).some((f) => /prepared-extra/.test(f.yaml) && +(f.feature?.match(/Level (\d+)/)?.[1] || 0) <= x.info.level));
  /** The caster whose class lets them cast rituals straight from a spellbook (Ritual Adept), and the book's spells. */
  const ritualBook = () => {
    const k = casters.find((x) => (casterEntry(x.info)?.effects || []).some((f) => /from-spellbook/.test(f.yaml)));
    if (!k) return undefined;
    const names = new Set([...k.info.spells, ...(c.spellbook || []).map((b) => b.name), ...fx.bookSpells.map((b) => b.name)]);
    return { k, names };
  };
  const shortTime = (t: string) => stripMd(t).replace(/^Bonus Action.*/i, "1BA").replace(/^Action.*/i, "1A").replace(/^Reaction.*/i, "1R").replace(/^(\d+) minutes?.*/i, "$1m").replace(/^(\d+) hours?.*/i, "$1h");
  /** "D: 1m, 15 ft. cone, V/S/M", like D&D Beyond's notes column. */
  const spellNotes = (sp: Entry, pl: ReturnType<typeof spellPlan> | undefined) => {
    const dur = stripMd(sp.fields["duration"] || "").replace(/^Concentration,? up to /i, "");
    const unit: Record<string, string> = { minute: "m", hour: "h", day: "d", round: "rd", turn: "turn" };
    const m = dur.match(/^(\d+)\s+(minute|hour|day|round|turn)s?/i);
    const d2 = /instantaneous/i.test(dur) ? "" : m ? `D: ${m[1]}${unit[m[2].toLowerCase()]}` : dur ? `D: ${dur.replace(/Until Dispelled( or Triggered)?/i, "until dispelled")}` : "";
    const comp = stripMd(sp.fields["components"] || "").replace(/\s*\(.*\)/, "").split(/\s*,\s*/).filter(Boolean).join("/");
    return [d2, pl?.area, comp].filter(Boolean).join(", ");
  };
  const castNumbers = (r: SpellRowData) => {
    const ab = r.g?.ability || r.k?.ab || castAb || undefined;
    const m = ab ? d.mods[ab] : 0;
    const k = r.k || casters[0];
    // a granted spell with its own ability (Fiendish Legacy, Magic Initiate) uses that, not the class's
    if (r.g?.ability && !r.k) return { mod: m, dc: r.g.dc ?? 8 + d.pb + m, atk: d.pb + m };
    return { mod: m, dc: r.g?.dc ?? k?.dc ?? 8 + d.pb + m, atk: k?.atk ?? d.pb + m };
  };
  const spellRows = (): SpellRowData[] => {
    const rows: SpellRowData[] = [];
    for (const { k, list } of knownBy) for (const sp of list) rows.push({ sp, lvl: spellInfo(sp)?.level || 0, k, source: casters.length > 1 ? k.info.cls.name : "" });
    for (const g of fx.grantedSpells) {
      if (rows.some((r) => r.sp.id === g.spell.id && !r.g && !g.free && !g.atWill)) continue; // already prepared the usual way
      rows.push({ sp: g.spell, lvl: spellInfo(g.spell)?.level || 0, g, source: g.source });
    }
    const rb = ritualBook();
    if (rb) {
      for (const name of rb.names) {
        const sp = spells.find((x) => x.name === name);
        if (!sp || !isRitual(sp) || rows.some((r) => r.sp.id === sp.id)) continue;
        rows.push({ sp, lvl: spellInfo(sp)?.level || 0, k: rb.k, source: "Spellbook", book: true });
      }
    }
    return rows;
  };
  /** Cast a ritual: no slot, at the spell's own level, 10 minutes longer. */
  const castRitual = (r: SpellRowData) => {
    const n = castNumbers(r);
    castSpell(r.sp, r.lvl, r.k || null, { mod: n.mod, dc: r.g?.dc, via: r.g?.source, free: true, ritual: r.book ? "book" : true });
  };
  /** The levels a row can be cast at, each with what it does there. */
  const castLevels = (r: SpellRowData) => {
    if (r.lvl === 0 || r.g?.atWill || r.book) return [];
    const n = castNumbers(r);
    return [...new Set(slots.map((x) => x.level))].filter((L) => L >= r.lvl).sort((a, b) => a - b).map((L) => {
      const pl = spellPlan(r.sp, { slot: L, charLevel: c.level, spell: { mod: n.mod, dc: n.dc, attack: n.atk } });
      const what = pl ? pl.damage.map((x) => `${x.dice} ${x.type}`.trim()).join(" + ") || (pl.heal ? `heal ${pl.heal}` : "") || pl.lines.find((x) => /^At this level/.test(x))?.replace(/^At this level: /, "") || "" : "";
      return { L, left: slotLeft(L), what };
    });
  };
  /** The Cast button, plus a ▾ menu to pick the slot level or cast it as a Ritual. */
  const castControl = (r: SpellRowData, key: string) => {
    const st = rowCastState(r);
    if (r.book) return <Btn className="sbtn sm" why="" onClick={() => castRitual(r)}>Ritual</Btn>;
    const levels = castLevels(r);
    const ritual = isRitual(r.sp) && r.lvl > 0 && !r.g?.atWill;
    const free = r.g?.free ? resources.find((x) => x.key === r.g!.free) : undefined;
    const freeLeft = free ? free.max - (p.resUsed[free.key] || 0) : 0;
    const menu = levels.length > 1 || ritual || (free && levels.length > 0);
    return (
      <span className="castwrap">
        <Btn className={`sbtn sm${menu ? " split" : ""}`} disabled={!st.ok} why={st.why} onClick={() => castRow(r)}>{st.label}</Btn>
        {menu && <button className="sbtn sm split2" aria-label={`Choose how to cast ${r.sp.name}`} aria-expanded={castMenu?.key === key} onClick={(e) => {
          const rc = (e.currentTarget.parentElement || e.currentTarget).getBoundingClientRect();
          setCastMenu(castMenu?.key === key ? undefined : { key, x: Math.max(8, Math.min(rc.left, window.innerWidth - 248)), y: rc.bottom + 4 });
        }}>▾</button>}
        {menu && castMenu?.key === key && (
          <span className="castmenu" role="menu" style={{ left: castMenu.x, top: Math.max(8, Math.min(castMenu.y, window.innerHeight - 40 - 46 * (levels.length + 2))) }}>
            {free && <button role="menuitem" disabled={freeLeft <= 0} onClick={() => { castRow(r); setCastMenu(undefined); }}><b>Free</b><span>{freeLeft} use{freeLeft === 1 ? "" : "s"} left · {free.name}</span></button>}
            {levels.map((x) => (
              <Tip key={x.L} tip={x.left > 0 ? "" : slotWhy(x.L)}>
                <button role="menuitem" disabled={x.left <= 0} onClick={() => { castRow(r, x.L); setCastMenu(undefined); }}>
                  <b>Level {x.L}</b><span>{x.what ? `${x.what} · ` : ""}{x.left} slot{x.left === 1 ? "" : "s"} left</span>
                </button>
              </Tip>
            ))}
            {ritual && <button role="menuitem" onClick={() => { castRitual(r); setCastMenu(undefined); }}><b>As a Ritual</b><span>No slot · takes 10 minutes longer</span></button>}
          </span>
        )}
      </span>
    );
  };
  /** Cast from a row: free use first, then at will, then the lowest open slot. */
  const castRow = (r: SpellRowData, at?: number) => {
    const n = castNumbers(r);
    const free = r.g?.free ? resources.find((x) => x.key === r.g!.free) : undefined;
    const freeLeft = free ? free.max - (p.resUsed[free.key] || 0) : 0;
    const opt = { mod: n.mod, dc: r.g?.dc, via: r.g?.source };
    if (r.lvl === 0 || r.g?.atWill) return castSpell(r.sp, r.lvl, r.k || null, { ...opt, free: !!r.g });
    if (free && freeLeft > 0 && at === undefined) return castSpell(r.sp, r.lvl, null, { ...opt, free: true, pay: { key: free.key, amount: 1 } });
    const L = at ?? [...new Set(slots.map((x) => x.level))].sort((a, b) => a - b).find((x) => x >= r.lvl && slotLeft(x) > 0);
    if (L !== undefined) castSpell(r.sp, L, r.k || null, opt);
  };
  const rowCastState = (r: SpellRowData) => {
    const free = r.g?.free ? resources.find((x) => x.key === r.g!.free) : undefined;
    const freeLeft = free ? free.max - (p.resUsed[free.key] || 0) : 0;
    if (r.lvl === 0 || r.g?.atWill) return { label: r.g?.atWill && r.lvl ? "At will" : "Cast", ok: true };
    if (free && freeLeft > 0) return { label: "Free", ok: true };
    const open = slots.some((x) => x.level >= r.lvl && slotLeft(x.level) > 0);
    return { label: "Cast", ok: open, why: open ? undefined : free ? `${freeWhy(free, freeLeft)}` : slotWhy(r.lvl) };
  };
  const spellsTable = () => {
    if (!content.loaded.has("spells")) return <div className="spanel"><p className="note">Loading spells…</p></div>;
    const rows = spellRows();
    const q = spellQ.trim().toLowerCase();
    const plans = new Map(rows.map((r) => [r, spellPlan(r.sp, { slot: r.lvl, charLevel: c.level, spell: { mod: castNumbers(r).mod, dc: castNumbers(r).dc, attack: castNumbers(r).atk } })]));
    const shown = rows.filter((r) => {
      if (spellLvl === "ritual" ? !/ritual/i.test(r.sp.fields["casting time"] || "") && !/ritual/i.test(r.sp.tagline || "") : spellLvl !== "all" && String(r.lvl) !== spellLvl) return false;
      if (!q) return true;
      const pl = plans.get(r);
      return `${r.sp.name} ${r.sp.fields["casting time"] || ""} ${r.sp.tagline || ""} ${pl?.damage.map((x) => x.type).join(" ") || ""} ${pl?.lines.join(" ") || ""} ${r.source}`.toLowerCase().includes(q);
    });
    const levels = [...new Set(rows.map((r) => r.lvl))].sort((a, b) => a - b);
    const groups = [...new Set(shown.map((r) => r.lvl))].sort((a, b) => a - b);
    return (
      <div className="spanel">
        <div className="sphead">
          {casters.map((k) => (
            <div key={k.info.index} className="spstat">
              {casters.length > 1 && <div className="mut" style={{ fontSize: 11 }}>{k.info.cls.name}</div>}
              <span><b>{fmt(k.mod)}</b><small>modifier</small></span>
              <span><b>{fmt(k.atk)}</b><small>spell attack</small></span>
              <span><b>{k.dc}</b><small>save DC</small></span>
              {k.ci && <span className="mut" style={{ fontSize: 12 }}>{k.ci.cantrips ? `${k.info.cantrips.length}/${k.ci.cantrips} cantrips · ` : ""}{k.info.spells.length}/{k.ci.prepared} prepared{ritualBook()?.k.info.index === k.info.index ? ` · ${ritualBook()!.names.size} in spellbook` : ""}</span>}
            </div>
          ))}
          {editable && anyCaster && <Link to={`/build/${c.id}`} className="note" style={{ marginLeft: "auto" }}>Change spells</Link>}
        </div>
        <input type="search" className="spsearch" placeholder="Search spell names, casting times, damage types, conditions…" value={spellQ} onChange={(e) => setSpellQ(e.target.value)} aria-label="Search spells" />
        <div className="chipsrow" role="group" aria-label="Spell level">
          <button className={spellLvl === "all" ? "on" : ""} onClick={() => setSpellLvl("all")}>All</button>
          {levels.map((L) => <button key={L} className={spellLvl === String(L) ? "on" : ""} onClick={() => setSpellLvl(String(L))}>{L === 0 ? "Cantrips" : `${L}${["st", "nd", "rd"][L - 1] || "th"}`}</button>)}
          {rows.some((r) => /ritual/i.test(r.sp.fields["casting time"] || "")) && <button className={spellLvl === "ritual" ? "on" : ""} onClick={() => setSpellLvl("ritual")}>Ritual</button>}
        </div>
        {shown.length === 0 && <p className="note">{rows.length ? "No spells match." : "No spells yet."}</p>}
        {groups.map((L) => {
          const levelSlots = slots.filter((x) => x.level === L);
          return (
            <div key={L} className="spgroup">
              <div className="spgh">
                <b>{L === 0 ? "Cantrips" : `Level ${L}`}</b>
                {levelSlots.map((sl) => {
                  const key = slotKey(sl);
                  return (
                    <span key={key} className="spslots">
                      {sl.pact && <span className="mut">Pact</span>}
                      <Pips n={sl.max + Math.max(0, -(p.slotsUsed[key] || 0))} used={Math.max(0, p.slotsUsed[key] || 0)} onToggle={(i) => setPlay((cur) => {
                        const u = cur.slotsUsed[key] || 0, extra = Math.max(0, -u), shownU = Math.max(0, u);
                        return { slotsUsed: { ...cur.slotsUsed, [key]: (i < shownU ? i : i + 1) - extra } };
                      })} />
                    </span>
                  );
                })}
              </div>
              <table className="atks sptable">
                <thead><tr><th></th><th>Name</th><th>Time</th><th>Range</th><th>Hit / DC</th><th>Effect</th><th>Notes</th></tr></thead>
                <tbody>
                  {shown.filter((r) => r.lvl === L).sort((a, b) => a.sp.name.localeCompare(b.sp.name)).map((r, i) => {
                    const pl = plans.get(r);
                    const n = castNumbers(r);
                    const st = rowCastState(r);
                    const dmg = pl?.damage.map((x) => x.dice).join("+");
                    const conc = pl ? pl.concentration : /concentration/i.test(r.sp.fields["duration"] || "");
                    const ritual = /ritual/i.test(r.sp.fields["casting time"] || "");
                    return (
                      <tr key={`${r.sp.id}-${i}`}>
                        <td>{castControl(r, `${r.sp.id}-${r.source}-${i}`)}</td>
                        <td>
                          <button className="linkish spname" onClick={() => setDrawer({ kind: "spell", id: r.sp.id, via: r.g ? r.g.source : r.k ? `k:${r.k.info.index}` : undefined })}>{r.sp.name}</button>
                          {conc && <span className="tagm plain" title="Concentration">C</span>}{ritual && <span className="tagm plain" title="Ritual">R</span>}
                          {r.source && <div className="note">{r.source}</div>}
                        </td>
                        <td>{shortTime(r.sp.fields["casting time"] || "")}</td>
                        <td>{stripMd(r.sp.fields["range"] || "").replace(/ feet/, " ft.")}</td>
                        <td>{pl?.attack ? fmt(n.atk) : pl?.save ? `${pl.save.ability.slice(0, 3).toUpperCase()} ${n.dc}` : "—"}</td>
                        <td>{dmg ? <button className="sbtn sm ghost" onClick={() => rollDamage(r.sp.name, dmg, false, pl!.damage.map((x) => x.type).filter(Boolean).join(" + "))}>{dmg}{pl?.attack && pl.attack.count > 1 ? ` ×${pl.attack.count}` : ""}</button> : pl?.heal ? <button className="sbtn sm ghost" onClick={() => rollDamage(r.sp.name, pl.heal!, false, "", true, { maximize: fx.maxHealing })}>{pl.heal} heal</button> : pl?.tempHp ? <span className="effkind">{pl.tempHp} temp HP</span> : pl?.conditions.length ? <Tip tip={`Targets can end up ${pl.conditions.join(" or ")}.`}><span className="effkind cond">{pl.conditions.join(", ")}</span></Tip> : <span className="effkind">{pl?.kind || "—"}</span>}</td>
                        <td className="note">{spellNotes(r.sp, pl)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    );
  };
  /** The slide-out details panel (spells: cast at a level you pick; features: their text and uses). */
  const drawerPanel = () => {
    if (!drawer) return null;
    let body: ReactNode = null;
    if (drawer.kind === "spell") {
      const sp = content.byId(drawer.id);
      if (!sp) return null;
      const r: SpellRowData = spellRows().find((x) => x.sp.id === sp.id && ((drawer.via?.startsWith("k:") && x.k && `k:${x.k.info.index}` === drawer.via) || (x.g && x.g.source === drawer.via))) || spellRows().find((x) => x.sp.id === sp.id) || { sp, lvl: spellInfo(sp)?.level || 0, source: "" };
      const info = spellInfo(sp);
      const lvl = info?.level || 0;
      const levels = lvl ? [...new Set(slots.map((x) => x.level))].filter((x) => x >= lvl).sort((a, b) => a - b) : [];
      const L = drawer.level ?? levels.find((x) => slotLeft(x) > 0) ?? levels[0] ?? lvl;
      const n = castNumbers(r);
      const pl = spellPlan(sp, { slot: L || lvl, charLevel: c.level, spell: { mod: n.mod, dc: n.dc, attack: n.atk } });
      const st = rowCastState(r);
      const free = r.g?.free ? resources.find((x) => x.key === r.g!.free) : undefined;
      body = (
        <>
          <div className="mut" style={{ fontSize: 12 }}>{r.source || (r.k ? `${r.k.info.cls.name} spell` : "")}</div>
          <h3 className="drtitle">{sp.name}</h3>
          <div className="note" style={{ marginTop: 0 }}>{sp.tagline}</div>
          <div className="drcast">
            {r.book ? (
              <>
                <button className="sbtn" onClick={() => castRitual(r)}>Cast as a Ritual</button>
                <span className="note">It’s in your spellbook but not prepared. Ritual Adept lets you cast it as a Ritual by reading from the book: no slot, 10 minutes longer.</span>
              </>
            ) : <>
            {lvl > 0 && !r.g?.atWill && levels.length > 0 && (
              <span className="lvlstep">
                <button className="sbtn sm ghost" aria-label="Lower level" disabled={L <= levels[0]} onClick={() => setDrawer({ ...drawer, level: levels[Math.max(0, levels.indexOf(L) - 1)] })}>−</button>
                <span>Level <b>{L}</b>{slotLeft(L) >= 0 ? <span className="mut"> · {slotLeft(L)} slot{slotLeft(L) === 1 ? "" : "s"} left</span> : null}</span>
                <button className="sbtn sm ghost" aria-label="Higher level" disabled={L >= levels[levels.length - 1]} onClick={() => setDrawer({ ...drawer, level: levels[Math.min(levels.length - 1, levels.indexOf(L) + 1)] })}>+</button>
              </span>
            )}
            {lvl > 0 && !r.g?.atWill ? (
              <>
                <Btn className="sbtn" disabled={slotLeft(L) <= 0} why={slotWhy(L)} onClick={() => castRow(r, L)}>Cast with a level {L} slot</Btn>
                {free && <Btn className="sbtn ghost" disabled={!st.ok || st.label !== "Free"} why={freeWhy(free, free.max - (p.resUsed[free.key] || 0))} onClick={() => castRow(r)}>Cast free ({free.max - (p.resUsed[free.key] || 0)} left)</Btn>}
              </>
            ) : <button className="sbtn" onClick={() => castRow(r)}>Cast</button>}
            {lvl > 0 && !r.g?.atWill && isRitual(sp) && <Tip tip="No slot used; casting takes 10 minutes longer."><button className="sbtn ghost" onClick={() => castRitual(r)}>Cast as a Ritual</button></Tip>}
            </>}
          </div>
          {pl && (
            <div className="drsum">
              {pl.attack && <span>Spell attack <b>{fmt(n.atk)}</b>{pl.attack.count > 1 ? ` ×${pl.attack.count}` : ""}</span>}
              {pl.save && <span>{pl.save.ability} save DC <b>{n.dc}</b>{pl.save.success === "half" ? " (half on a success)" : ""}</span>}
              {pl.damage.length > 0 && <button className="sbtn sm ghost" onClick={() => rollDamage(sp.name, pl.damage.map((x) => x.dice).join("+"), false, pl.damage.map((x) => x.type).filter(Boolean).join(" + "))}>{pl.damage.map((x) => `${x.dice} ${x.type}`).join(" + ")}</button>}
              {pl.heal && <button className="sbtn sm ghost" onClick={() => rollDamage(sp.name, pl.heal!, false, "", true, { maximize: fx.maxHealing })}>Heal {pl.heal}</button>}
            </div>
          )}
          <dl className="drprops">
            {["casting time", "range", "components", "duration"].filter((k2) => sp.fields[k2]).map((k2) => <div key={k2}><dt>{k2.replace(/\b\w/g, (x) => x.toUpperCase())}</dt><dd>{stripMd(sp.fields[k2])}</dd></div>)}
            {sp.fields["source"] && <div><dt>Source</dt><dd>{stripMd(sp.fields["source"])}</dd></div>}
          </dl>
          <div className="drbody"><Md md={sp.body} /></div>
        </>
      );
    } else {
      body = (
        <>
          <div className="mut" style={{ fontSize: 12 }}>{drawer.sub}</div>
          <h3 className="drtitle">{drawer.title}</h3>
          <div className="drbody"><Md md={drawer.md} /></div>
        </>
      );
    }
    return (
      <>
        <div className="drshade" onClick={() => setDrawer(undefined)} />
        <aside className="drawer" role="dialog" aria-label="Details">
          <button className="sbtn sm ghost drclose" aria-label="Close details" onClick={() => setDrawer(undefined)}>✕</button>
          {body}
        </aside>
      </>
    );
  };
  /**
   * A Wizard's spellbook: the spells in it (prepared ones are always in it), free picks from leveling up, copying
   * found spells in for gold and time, and preparing from the book.
   */
  const spellbookPanel = () => {
    const k = casters.find((x) => (casterEntry(x.info)?.effects || []).some((f) => /spellbook:/.test(f.yaml)));
    if (!k || !spells.length) return null;
    const lvl = k.info.level;
    const free = 6 + 2 * Math.max(0, lvl - 1);
    const listName = k.info.cls.name;
    const book = c.spellbook || [];
    const prepared = k.info.spells.filter((n) => (spellInfo(spells.find((x) => x.name === n) || ({ tagline: "" } as Entry))?.level || 0) > 0);
    const granted = fx.bookSpells.map((b) => b.name);
    const names = [...new Set([...prepared, ...book.map((b) => b.name), ...granted])];
    const inBook = names.map((n) => spells.find((x) => x.name === n)).filter(Boolean) as Entry[];
    // spells a feature wrote in (Evocation Savant) don't use the level-up picks
    const freeUsed = names.filter((n) => !book.some((b) => b.name === n && b.how === "copied") && !(granted.includes(n) && !prepared.includes(n) && !book.some((b) => b.name === n))).length;
    const freeLeft = free - freeUsed;
    const maxL = Math.max(0, ...slots.filter((x) => !x.pact).map((x) => x.level));
    const prepMax = k.ci?.prepared ?? 0;
    const setBook = (next: NonNullable<typeof c.spellbook>) => { dirty.current = true; setC((prev) => (prev ? { ...prev, spellbook: next } : prev)); };
    const setPrepared = (next: string[]) => { dirty.current = true; setC((prev) => (prev ? { ...prev, ...patchClass(prev, k.info.index, { spells: next }) } : prev)); };
    const candidates = spells.filter((x) => {
      const si = spellInfo(x);
      return si && si.level >= 1 && si.level <= maxL && si.classes.includes(listName) && !names.includes(x.name);
    }).sort((a, b) => (spellInfo(a)!.level - spellInfo(b)!.level) || a.name.localeCompare(b.name));
    const pick = bookPick && candidates.some((x) => x.name === bookPick) ? bookPick : "";
    const pickLvl = pick ? spellInfo(spells.find((x) => x.name === pick)!)!.level : 0;
    const gold = inv.coins.gp + inv.coins.pp * 10;
    const copyCost = pickLvl * 50;
    const house = !!c.houseRules;
    const copy = () => {
      let gp = inv.coins.gp - copyCost;
      let pp = inv.coins.pp;
      while (gp < 0 && pp > 0) { pp -= 1; gp += 10; }
      setInventory(inv.items, { ...inv.coins, gp: Math.max(0, gp), pp });
      setBook([...book, { name: pick, how: "copied" }]);
      log({ title: `Copied ${pick} into the spellbook`, total: `−${copyCost} GP`, cls: "event", detail: `${pickLvl * 2} hours of work and ${copyCost} GP of rare inks.` });
      setBookPick("");
    };
    const byLevel = new Map<number, Entry[]>();
    for (const x of inBook) { const L = spellInfo(x)?.level || 0; byLevel.set(L, [...(byLevel.get(L) || []), x]); }
    return (
      <div className="spanel" style={{ marginBottom: 12 }}>
        <div className="fphead">
          <h3 style={{ margin: 0 }}>Spellbook</h3>
          <span className="mut" style={{ fontSize: 12.5 }}>{inBook.length} spells · {prepared.length}/{prepMax} prepared · {Math.max(0, freeLeft)} free pick{freeLeft === 1 ? "" : "s"} left from leveling up</span>
        </div>
        {memorizer()?.info.index === k.info.index && p.memorize === "ready" && editable && (() => {
          const outs = prepared.filter((n) => names.includes(n));
          const ins = inBook.filter((x) => !prepared.includes(x.name) && (spellInfo(x)?.level || 0) >= 1).map((x) => x.name).sort();
          const ok = !!memPick.out && !!memPick.in && outs.includes(memPick.out) && ins.includes(memPick.in);
          return (
            <div className="cfform memswap">
              <Tip tip="Memorize Spell: whenever you finish a Short Rest, you can replace one prepared level 1+ spell with another level 1+ spell from your spellbook."><b>Memorize Spell</b></Tip>
              <select className="optpick" aria-label="Prepared spell to swap out" value={memPick.out} onChange={(e) => setMemPick({ ...memPick, out: e.target.value })}>
                <option value="">Swap out…</option>
                {outs.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <select className="optpick" aria-label="Spellbook spell to prepare" value={memPick.in} onChange={(e) => setMemPick({ ...memPick, in: e.target.value })}>
                <option value="">Prepare instead…</option>
                {ins.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <Btn className="sbtn sm" disabled={!ok} why="Choose a prepared spell and a spell from your book first." onClick={() => {
                const mine = book.some((b) => b.name === memPick.out);
                setPrepared([...k.info.spells.filter((n) => n !== memPick.out), memPick.in]);
                if (!mine) setBook([...book, { name: memPick.out, how: "level" }]);
                setPlay({ memorize: "used" });
                log({ title: "Memorize Spell", total: "", cls: "event", detail: `Swapped ${esc(memPick.out)} for ${esc(memPick.in)}.` });
                setMemPick({ out: "", in: "" });
              }}>Swap</Btn>
              <button className="sbtn sm ghost" onClick={() => setPlay({ memorize: "used" })}>Skip</button>
            </div>
          );
        })()}
        {[...byLevel.keys()].sort((a, b) => a - b).map((L) => (
          <div key={L} className="bookrow">
            <b className="mut">Level {L}</b>
            {byLevel.get(L)!.sort((a, b) => a.name.localeCompare(b.name)).map((x) => {
              const prep = prepared.includes(x.name);
              const mine = book.find((b) => b.name === x.name);
              return (
                <span key={x.id} className={`bk ${prep ? "on" : ""}`}>
                  {x.name}{mine?.how === "copied" ? <span className="mut"> · copied</span> : null}
                  {editable && (
                    <Btn className="sbtn sm ghost" disabled={!prep && !house && prepared.length >= prepMax} why={`You can prepare ${prepMax} spells; unprepare one first. You change prepared spells when you finish a Long Rest.`}
                      onClick={() => {
                        setPrepared(prep ? k.info.spells.filter((n) => n !== x.name) : [...k.info.spells, x.name]);
                        if (prep && !mine) setBook([...book, { name: x.name, how: "level" }]); // it stays in the book
                      }}>{prep ? "Unprepare" : "Prepare"}</Btn>
                  )}
                  {editable && mine && !prep && <button className="sbtn sm ghost" aria-label={`Remove ${x.name} from the spellbook`} onClick={() => setBook(book.filter((b) => b.name !== x.name))}>✕</button>}
                </span>
              );
            })}
          </div>
        ))}
        {editable && (
          <div className="cfform">
            <select className="optpick" aria-label="Spell to add" value={pick} onChange={(e) => setBookPick(e.target.value)}>
              <option value="">Add a {listName} spell…</option>
              {candidates.map((x) => <option key={x.id} value={x.name}>{x.name} (level {spellInfo(x)!.level})</option>)}
            </select>
            <Btn className="sbtn sm" disabled={!pick || (freeLeft <= 0 && !house)} why={!pick ? "Choose a spell first." : `You’ve used all ${free} spells you get from leveling up. Copy a spell you find instead.`}
              onClick={() => { setBook([...book, { name: pick, how: "level" }]); setBookPick(""); }}>Add (level-up pick)</Btn>
            <Btn className="sbtn sm ghost" disabled={!pick || (gold < copyCost && !house)} why={!pick ? "Choose a spell first." : `Copying it costs ${copyCost} GP; you have ${gold}.`}
              onClick={copy}>{pick ? `Copy in (${copyCost} GP, ${pickLvl * 2} h)` : "Copy in"}</Btn>
          </div>
        )}
      </div>
    );
  };
  /** Choices a feature lets you change after a rest (Circle of the Land's land, Hunter's Prey), right on the sheet. */
  const restChoicesPanel = () => {
    const list = fx.pending.filter((pc) => pc.swap?.some((x) => x === "long" || x === "short") && pc.options && pc.options.length <= 60 && !pc.storedIn && !pc.amounts);
    if (!list.length) return null;
    const setChoice = (key: string, vals: string[]) => { dirty.current = true; setC((prev) => (prev ? { ...prev, choices: { ...(prev.choices || {}), [key]: vals } } : prev)); };
    return (
      <div className="spanel" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Change after a rest</h3>
        <p className="note" style={{ marginTop: 0 }}>Features you can switch when you finish a rest. The sheet applies the new choice right away.</p>
        {list.map((pc) => (
          <div key={pc.key} className="crow">
            <div className="ctext">
              <b>{pc.feature}</b> <span className="mut">· {pc.entry.name} · after a {pc.swap!.includes("short") ? "Short or Long" : "Long"} Rest{pc.count > 1 ? ` · choose ${pc.count}` : ""}</span>
            </div>
            {pc.count === 1 ? (
              <select className="optpick" aria-label={pc.feature} disabled={!editable} value={pc.chosen[0] || ""} onChange={(e) => {
                setChoice(pc.key, e.target.value ? [e.target.value] : []);
                if (e.target.value) log({ title: `${pc.feature}: ${pc.options!.find((o) => o.value === e.target.value)?.label || e.target.value}`, total: "", cls: "event", detail: `Changed after a rest (${esc(pc.entry.name)}).` });
              }}>
                <option value="">Choose…</option>
                {pc.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <div className="rowbtn" style={{ flexWrap: "wrap" }}>
                {pc.options!.map((o) => {
                  const on = pc.chosen.includes(o.value);
                  return <Btn key={o.value} className={`sbtn sm ${on ? "" : "ghost"}`} aria-pressed={on} disabled={!editable || (!on && pc.chosen.length >= pc.count)} why={!on && pc.chosen.length >= pc.count ? `You can have ${pc.count}; unpick one first.` : undefined}
                    onClick={() => setChoice(pc.key, on ? pc.chosen.filter((x) => x !== o.value) : [...pc.chosen, o.value])}>{o.label}</Btn>;
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };
  /** Features the player tracks themselves (homebrew, GM boons): name, uses, which rest brings them back. */
  const [cfName, setCfName] = [customDraft.name, (v: string) => setCustomDraft((d0) => ({ ...d0, name: v }))];
  const customFeaturesPanel = () => {
    const list = c.customFeatures || [];
    const setList = (next: NonNullable<typeof c.customFeatures>) => { dirty.current = true; setC((prev) => (prev ? { ...prev, customFeatures: next } : prev)); };
    const add = () => {
      if (!cfName.trim()) return;
      setList([...list, { id: Math.random().toString(36).slice(2, 9), name: cfName.trim(), max: Math.max(1, Math.floor(+customDraft.max || 1)), recover: customDraft.recover, text: customDraft.text.trim() }]);
      setCustomDraft({ name: "", max: "1", recover: "long", text: "" });
    };
    if (!list.length && !editable) return null;
    return (
      <div className="spanel" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Your own features</h3>
        <label className="note" style={{ display: "flex", gap: 6, alignItems: "center", margin: "0 0 8px" }}>
          <input type="checkbox" disabled={!editable} checked={!!c.houseRules} onChange={(e) => { dirty.current = true; const on = e.target.checked; setC((prev) => (prev ? { ...prev, houseRules: on } : prev)); }} />
          House rules: let me go past the sheet’s limits (uses, known forms, spellbook picks). It still counts them.
        </label>
        <p className="note" style={{ marginTop: 0 }}>For anything no content pack covers, like a homebrew ability or a boon from your GM. Their uses appear with your other limited uses and come back on rests.</p>
        {list.map((f) => (
          <div key={f.id} className="crow">
            <div className="ctext"><b>{f.name}</b> <span className="mut">· {f.max} use{f.max > 1 ? "s" : ""} · {f.recover === "short" ? "Short or Long Rest" : "Long Rest"}</span>{f.text ? <div className="note">{f.text}</div> : null}</div>
            {editable && <button className="sbtn sm ghost" onClick={() => setList(list.filter((x) => x.id !== f.id))}>Remove</button>}
          </div>
        ))}
        {editable && (
          <div className="cfform">
            <input placeholder="Feature name" value={cfName} onChange={(e) => setCfName(e.target.value)} aria-label="Feature name" />
            <input type="number" min={1} value={customDraft.max} onChange={(e) => setCustomDraft((d0) => ({ ...d0, max: e.target.value }))} aria-label="Uses" style={{ width: 70 }} />
            <select value={customDraft.recover} onChange={(e) => setCustomDraft((d0) => ({ ...d0, recover: e.target.value as "short" | "long" }))} aria-label="Comes back on">
              <option value="long">Long Rest</option>
              <option value="short">Short or Long Rest</option>
            </select>
            <input placeholder="What it does (optional)" value={customDraft.text} onChange={(e) => setCustomDraft((d0) => ({ ...d0, text: e.target.value }))} aria-label="What it does" style={{ flex: 1, minWidth: 160 }} />
            <button className="sbtn sm" disabled={!cfName.trim()} onClick={add}>Add feature</button>
          </div>
        )}
      </div>
    );
  };
  /** The game log as plain text, for sharing a session or reporting a problem. */
  const copyLog = () => {
    const strip = (h: string) => h.replace(/<\/div>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    const text = [...p.log].reverse().map((e) => `[${e.t}] ${e.title}${e.total ? `: ${e.total}` : ""}${e.detail ? `\n  ${strip(e.detail).replace(/\n+/g, "\n  ")}` : ""}`).join("\n");
    navigator.clipboard?.writeText(`${c.name || "Character"} — game log\n${text}`).then(
      () => log({ title: "Game log copied", total: "", cls: "info", detail: `${p.log.length} entries copied to the clipboard.` }),
      () => log({ title: "Couldn’t copy the log", total: "—", cls: "info", detail: "Your browser blocked the clipboard." }),
    );
  };
  /** Use a "when this happens" option: pay its cost, log it, and offer to roll the die it spends. */
  const useTrigger = (t: ModifTrigger) => {
    const { res, left } = costInfo(t.cost);
    if (t.cost) setPlay((cur) => pay(t.cost, cur));
    const acts: CardAction[] = [];
    if (res?.die) acts.push({ label: `Roll ${res.die}`, run: () => { const r = roll(/^d/.test(res.die!) ? `1${res.die}` : res.die!); if (r) log({ title: `${t.name}: ${res.name}`, total: String(r.total), cls: "info", detail: esc(describeRolled(r)) }); } });
    log({ title: t.name, total: "", cls: "event", detail: `${esc(t.text)}${res && t.cost ? `<div>${left - t.cost.amount} of ${res.max} ${esc(res.name)} left</div>` : ""}` }, acts);
  };
  /** Reactions: an Opportunity Attack, plus every feature, item and trigger that takes your Reaction. */
  const reactionsSection = () => {
    const meleeItem = wielded.find(({ w }) => !/ranged/i.test(w.category));
    const oa = formCr ? attacks[0] : (meleeItem && attacks.find((a) => a.itemId === meleeItem.it.id)) || attacks.find((a) => a.name === "Unarmed Strike");
    const acts = fx.actions.filter((x) => /reaction/i.test(x.activation));
    const trg = fx.triggers.filter((t) => t.reaction);
    return (
      <>
        <h3 style={{ marginTop: 16 }}>Reactions</h3>
        <table className="atks bonusacts">
          <thead><tr><th>Reaction</th><th>Details</th><th></th></tr></thead>
          <tbody>
            <tr>
              <td><b>Opportunity Attack</b><div className="note">Everyone</div></td>
              <td className="note">When a creature you can see leaves your reach, make one melee attack against it{oa ? ` (${oa.name}: ${fmt(oa.toHit)} to hit, ${oa.damage} ${oa.type})` : ""}.</td>
              <td>{oa && <div className="rowbtn"><button className="sbtn sm" onClick={() => attack({ ...oa, name: `${oa.name} (opportunity attack)` })}>Attack</button></div>}</td>
            </tr>
            {acts.map((a) => {
              const op = optionLabels(a) ? optionOf(a) : undefined;
              return (
                <tr key={`ra-${a.id}`}>
                  <td><b>{a.name}</b><div className="note">{a.source}</div></td>
                  <td className="note">{[a.text, a.save ? `${a.save.dc ? `DC ${a.save.dc} ` : ""}${a.save.ability} save` : "", costInfo(a.cost).res ? `${costInfo(a.cost).left} / ${costInfo(a.cost).res!.max} ${costInfo(a.cost).res!.name}.` : ""].filter(Boolean).join(" ")}</td>
                  <td><div className="rowbtn"><Btn className="sbtn sm" disabled={op ? !op.ok : !costInfo(a.cost).ok} why={actWhy(a, op)} onClick={() => runFeature(a, op?.i)}>{a.cast ? "Cast" : "Use"}</Btn></div></td>
                </tr>
              );
            })}
            {trg.map((t) => {
              const { res, left, ok } = costInfo(t.cost);
              return (
                <tr key={`rt-${t.key}`}>
                  <td><b>{t.name}</b><div className="note">{t.source}</div></td>
                  <td className="note">{t.when}: {t.text}{res ? ` ${left} / ${res.max} ${res.name}.` : ""}</td>
                  <td><div className="rowbtn"><Btn className="sbtn sm" disabled={!ok} why={whyNot(t.cost, t.name)} onClick={() => useTrigger(t)}>Use</Btn></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </>
    );
  };
  /** Senses, languages and tool proficiencies, each with where it comes from. */
  const profsPanel = () => {
    const formSenses = formCr?.senses.replace(/;?\s*Passive Perception \d+/i, "").trim();
    const senses = [...fx.senses, ...(formSenses ? [{ text: formSenses, source: `${formCr!.name} form` }] : [])];
    const origin = c.languages || [];
    const featureLangs = fx.languages.filter((l, i, arr) => arr.findIndex((x) => x.name === l.name) === i);
    const known = new Set(["Common", ...origin, ...featureLangs.map((l) => l.name)]);
    const toolName = (k: string) => content.byType("Tool").find((t) => slug(t.name) === slug(k))?.name || k.replace(/-/g, " ").replace(/\b\w/g, (x) => x.toUpperCase());
    // the same tool from two places ("thieves-tools" from the class, "Thieves’ Tools" from the background) is one line
    const toolMap = new Map<string, { name: string; sources: string[] }>();
    for (const k of fx.tools) {
      const name = toolName(k);
      const id = slug(name.replace(/[’']/g, ""));
      const cur = toolMap.get(id) || { name, sources: [] };
      cur.sources.push(...(fx.toolSources[k] || []));
      toolMap.set(id, cur);
    }
    const tools = [...toolMap.values()].sort((a, b) => a.name.localeCompare(b.name));
    const setOrigin = (i: number, v: string) => {
      const next = [...origin];
      next[i] = v;
      dirty.current = true;
      setC((prev) => (prev ? { ...prev, languages: next.filter(Boolean) } : prev));
    };
    return (
      <section className="spanel profs" {...bo("profs")}>
        {(fx.defenses.length > 0 || formCr) && (() => {
          const formDef = formCr?.defenses || [];
          if (!fx.defenses.length && !formDef.length) return null;
          return (
            <>
              <h3>Defenses</h3>
              <ul className="plist">
                {fx.defenses.map((x, i) => <li key={i}>{x.text} <span className="mut">· {x.feature}</span></li>)}
                {formDef.map((t) => <li key={t}>{t} <span className="mut">· {formCr!.name} form</span></li>)}
              </ul>
            </>
          );
        })()}
        <h3>Senses</h3>
        <ul className="plist">
          {senses.map((x, i) => <li key={i}>{x.text} <span className="mut">· {x.source}</span></li>)}
          <li>Passive Perception {d.passivePerception}</li>
          <li>Passive Investigation {10 + (d.skills["Investigation"]?.value ?? d.mods.Intelligence)}</li>
          <li>Passive Insight {10 + (d.skills["Insight"]?.value ?? d.mods.Wisdom)}</li>
        </ul>
        <h3>Languages</h3>
        <ul className="plist">
          <li>Common <span className="mut">· every character</span></li>
          {[0, 1].map((i) => (
            <li key={i}>
              {editable ? (
                <select className="optpick" aria-label={`Origin language ${i + 1}`} value={origin[i] || ""} onChange={(e) => setOrigin(i, e.target.value)}>
                  <option value="">Choose a language…</option>
                  <optgroup label="Standard">{STANDARD_LANGUAGES.filter((l) => l === origin[i] || !known.has(l)).map((l) => <option key={l}>{l}</option>)}</optgroup>
                  <optgroup label="Rare (with your GM’s okay)">{RARE_LANGUAGES.filter((l) => l === origin[i] || !known.has(l)).map((l) => <option key={l}>{l}</option>)}</optgroup>
                </select>
              ) : origin[i] || <span className="mut">Not chosen</span>}{" "}
              <span className="mut">· origin</span>
            </li>
          ))}
          {featureLangs.map((l) => <li key={l.name}>{l.name} <span className="mut">· {l.source}</span></li>)}
        </ul>
        <h3>Tools</h3>
        {tools.length === 0 ? <p className="note">No tool proficiencies.</p> : (
          <ul className="plist">{tools.map((t) => <li key={t.name}>{t.name}{t.sources.length ? <span className="mut"> · {[...new Set(t.sources)].join(", ")}</span> : null}</li>)}</ul>
        )}
      </section>
    );
  };
  /** Companions: summoned creatures, familiars and a Ranger's beast, each with its stat block, HP and rolls. */
  const companionsPanel = () => {
    const list = p.companions || [];
    const ready = fx.summons.filter((sm) => !list.some((x) => x.key === sm.key));
    if (!list.length && !ready.length) return null;
    const stName = (ref: string) => {
      const [id, anchor] = ref.split("#");
      if (!anchor) return content.byId(id)?.name || ref;
      const e = content.byId(id);
      return (e && statBlockMd(e, anchor)?.name) || anchor;
    };
    return (
      <div className="spanel formpanel">
        <div className="fphead">
          <h3 style={{ margin: 0 }}>Companions</h3>
          <span className="mut" style={{ fontSize: 12.5 }}>creatures you’ve summoned or that serve you</span>
          <span style={{ flex: 1 }} />
          {ready.map((sm) => <button key={sm.key} className="sbtn sm" onClick={() => summonFeature(sm)}>Summon: {sm.name}</button>)}
        </div>
        {list.length === 0 && <p className="note" style={{ margin: "6px 0 0" }}>Nobody yet. Casting a summoning spell (Find Familiar, Summon Beast…) or using a feature that summons a creature adds it here.</p>}
        {list.map((cp) => {
          const st = companionStats(cp);
          const pool = cp.filter ? allCreatures().filter((x) => (!cp.filter!.type || x.type === cp.filter!.type) && (cp.filter!.crMax === undefined || x.cr <= cp.filter!.crMax) && !x.swarm).sort((a, b) => a.name.localeCompare(b.name)) : [];
          const max = st?.hp ?? 0;
          const hp = Math.min(max, cp.hp ?? max);
          const amt = (id: string) => Math.max(0, Math.floor(+((document.getElementById(id) as HTMLInputElement | null)?.value || 0)));
          const inputId = `chp-${cp.uid}`;
          return (
            <div key={cp.uid} className="formblock">
              <div className="fbhead">
                <div>
                  <b className="fbname">{st?.name || (cp.text ? "Summoned" : "Choose a creature")}{cp.count && cp.count > 1 ? ` ×${cp.count}` : ""}</b>{" "}
                  <span className="mut">{cp.source}{cp.level ? ` · level ${cp.level}` : ""}{st ? ` · ${st.tagline.replace(/,.*$/, "")}${cp.type ? ` (${cp.type})` : ""}` : ""}</span>
                </div>
                <button className="sbtn sm ghost" onClick={() => setPlay((cur) => ({ companions: (cur.companions || []).filter((x) => x.uid !== cp.uid) }))}>Dismiss</button>
              </div>
              <div className="rowbtn" style={{ flexWrap: "wrap", margin: "6px 0" }}>
                {cp.options && cp.options.length > 1 && (
                  <select className="optpick" aria-label="Which creature" value={cp.ref} onChange={(e) => setCompanion(cp.uid, { ref: e.target.value, hp: undefined })}>
                    {cp.options.map((r) => <option key={r} value={r}>{stName(r)}</option>)}
                  </select>
                )}
                {cp.filter && (
                  <select className="optpick" aria-label="Which creature" value={cp.ref || ""} onChange={(e) => setCompanion(cp.uid, { ref: e.target.value || undefined, hp: undefined })}>
                    <option value="">Choose a form…</option>
                    <optgroup label="Normal forms">{pool.map((x) => <option key={x.id} value={x.id}>{x.name} (CR {x.crText})</option>)}</optgroup>
                    {boostsOf(cp).filter((b) => b.add.length).map((b) => (
                      <optgroup key={b.source} label={`${b.source} forms`}>
                        {b.add.map((id) => creatureFor(id)).filter(Boolean).map((x) => <option key={x!.id} value={x!.id}>{x!.name} (CR {x!.crText})</option>)}
                      </optgroup>
                    ))}
                  </select>
                )}
                {cp.pickAny && (
                  <>
                    {cp.rollDice && <button className="sbtn sm" onClick={() => rollDamage(`${cp.source}: table roll`, cp.rollDice!, false, "")}>Roll {cp.rollDice}</button>}
                    <input list={`cl-${cp.uid}`} className="optpick" placeholder="Type a creature’s name" defaultValue={cp.ref ? creatureFor(cp.ref)?.name : ""} aria-label="Which creature"
                      onChange={(e) => { const hit = allCreatures().find((x) => x.name.toLowerCase() === e.target.value.trim().toLowerCase()); if (hit) setCompanion(cp.uid, { ref: hit.id, hp: undefined }); }} style={{ minWidth: 200 }} />
                    <datalist id={`cl-${cp.uid}`}>{allCreatures().map((x) => <option key={x.id} value={x.name} />)}</datalist>
                  </>
                )}
                {boostsOf(cp).map((b) => (
                  <span key={b.source} className="rowbtn">
                    {b.speed && b.speed.kinds.length > 1 && (
                      <select className="optpick" aria-label={`${b.source}: speed`} value={cp.speedKind || b.speed.kinds[0]} onChange={(e) => setCompanion(cp.uid, { speedKind: e.target.value })}>
                        {b.speed.kinds.map((k) => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)} {b.speed!.value} ft.</option>)}
                      </select>
                    )}
                    {b.damageType && (
                      <select className="optpick" aria-label={`${b.source}: damage type`} value={cp.dmgType || ""} onChange={(e) => setCompanion(cp.uid, { dmgType: e.target.value || undefined })}>
                        <option value="">Normal damage types</option>
                        {b.damageType.choose.map((k) => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)} instead of {b.damageType!.replaces.join("/")}</option>)}
                      </select>
                    )}
                  </span>
                ))}
                {cp.variants && (
                  <select className="optpick" aria-label="Which version" value={cp.variant} onChange={(e) => setCompanion(cp.uid, { variant: e.target.value, hp: undefined })}>
                    {cp.variants.map((v) => <option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>)}
                  </select>
                )}
                {cp.types && (
                  <select className="optpick" aria-label="Creature type" value={cp.type} onChange={(e) => setCompanion(cp.uid, { type: e.target.value })}>
                    {cp.types.map((v) => <option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>)}
                  </select>
                )}
              </div>
              {cp.text && (!st || st.id.startsWith("text:") || cp.pickAny) && <p className="note">{cp.text}</p>}
              {st && (
                <>
                  <div className="fbtags" style={{ marginBottom: 6 }}>
                    <span className="tag plain">AC {st.ac}</span>
                    <span className="tag plain">Speed {st.speedText}</span>
                    {st.senses && <span className="tag plain">{st.senses}</span>}
                    {st.defenses.map((x) => <span key={x} className="tag plain">{x}</span>)}
                  </div>
                  <div className="chp">
                    <span>HP <b>{hp}</b> / {max}</span>
                    <input id={inputId} type="number" min={0} inputMode="numeric" placeholder="Amount" aria-label={`Damage or healing for ${st.name}`} style={{ width: 90 }} />
                    <button className="sbtn sm" onClick={() => { const n = amt(inputId); if (n) { setCompanion(cp.uid, { hp: Math.max(0, hp - n) }); log({ title: `${st.name} took damage`, total: `−${n}`, cls: "dmg", detail: `HP ${hp} → ${Math.max(0, hp - n)} / ${max}${hp - n <= 0 ? "<div>It drops to 0 Hit Points.</div>" : ""}` }); } }}>Damage</button>
                    <button className="sbtn sm ghost" onClick={() => { const n = amt(inputId); if (n) setCompanion(cp.uid, { hp: Math.min(max, hp + n) }); }}>Heal</button>
                  </div>
                  {!st.id.startsWith("text:") && <div className="fbabil" style={{ marginTop: 8 }}>
                    {ABILITIES.map((a) => {
                      const m = Math.floor((st.scores[a] - 10) / 2);
                      const sv = st.saves[a] ?? m;
                      return (
                        <div key={a} className="fbab">
                          <div className="sl">{a.slice(0, 3)}</div>
                          <button className="sbtn sm" onClick={() => companionTest(`${st.name}: ${a} check`, m)}>{fmt(m)}</button>
                          <div className="mut" style={{ fontSize: 11 }}>{st.scores[a]}</div>
                          <button className="sbtn sm ghost" onClick={() => companionTest(`${st.name}: ${a} save`, sv)}>Save {fmt(sv)}</button>
                        </div>
                      );
                    })}
                  </div>}
                  {Object.keys(st.skills).length > 0 && (
                    <div className="rowbtn" style={{ flexWrap: "wrap", marginTop: 8 }}>
                      {Object.entries(st.skills).map(([k, v]) => <button key={k} className="sbtn sm ghost" onClick={() => companionTest(`${st.name}: ${k}`, v)}>{k} {fmt(v)}</button>)}
                    </div>
                  )}
                  {st.traits.length > 0 && <div className="fbsec"><h4>Traits</h4>{st.traits.map((x) => <div key={x.name} className="crow"><div className="ctext"><b>{x.name}.</b> <span className="note">{x.text}</span></div></div>)}</div>}
                  {st.actions.length > 0 && <div className="fbsec"><h4>Actions</h4>{st.actions.map((a, i) => creatureActionRow(st, a, i, true))}</div>}
                  {st.bonusActions.length > 0 && <div className="fbsec"><h4>Bonus Actions</h4>{st.bonusActions.map((a, i) => creatureActionRow(st, a, i, true))}</div>}
                  {st.reactions.length > 0 && <div className="fbsec"><h4>Reactions</h4>{st.reactions.map((a, i) => creatureActionRow(st, a, i, true))}</div>}
                  {boostsOf(cp).filter((b) => b.text).map((b) => <p key={b.source} className="note" style={{ marginTop: 8 }}><b>{b.source}:</b> {b.text}</p>)}
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  };
  /** Wild Shape (and any other `form`): uses, known forms, the picker and the form you're in. */
  const formsPanel = () => fx.toggles.filter((t) => t.form).map((t) => {
    const spec = t.form!;
    const on = t.active;
    const cur = on ? creatureFor(p.formOf?.[t.key]) : undefined;
    const { res, left, ok } = costInfo(t.cost);
    const pool = allCreatures();
    const eligible = pool.filter((x) => (c.houseRules ? !spec.type || x.type === spec.type.toLowerCase() : formEligible(x, spec))).sort((a, b) => b.cr - a.cr || a.name.localeCompare(b.name));
    const knownIds = (p.forms?.[spec.id] || []).filter((id) => eligible.some((x) => x.id === id));
    const known = spec.known ? knownIds.map((id) => eligible.find((x) => x.id === id)!) : eligible;
    const limits = [`max CR ${crLabel(spec.crMax)}`, spec.fly ? "Fly Speed allowed" : "no Fly Speed", spec.tempHp ? `${spec.tempHp} temp HP` : "", t.duration ? `lasts ${t.duration}` : ""].filter(Boolean).join(" · ");
    const q = formQ.trim().toLowerCase();
    return (
      <div key={t.key} ref={formsRef} className="spanel formpanel">
        <div className="fphead">
          <h3 style={{ margin: 0 }}>{t.name}{cur ? `: ${cur.name}` : ""}</h3>
          <span className="mut" style={{ fontSize: 12.5 }}>{res ? `${left}/${res.max} uses · ` : ""}{limits}</span>
          <span style={{ flex: 1 }} />
          {on && <button className="sbtn sm" onClick={() => setFormPick((x) => !x)}>{formPick ? "Close" : "Change form"}</button>}
          {on && <button className="sbtn sm ghost" onClick={() => { const x = (p.active || []).find((y) => y.key === t.key); if (x) endEffect(x); }}>End {t.name}</button>}
          {!on && <button className="sbtn sm" onClick={() => setFormPick((x) => !x)}>{formPick ? "Close" : `${t.name}…`}</button>}
        </div>
        {!on && !formPick && <p className="note" style={{ margin: "6px 0 0" }}>{t.activation ? `${t.activation}: ` : ""}become one of your known forms. You keep your HP, Intelligence, Wisdom, Charisma, features and proficiencies{spec.tempHp ? `, and gain ${spec.tempHp} Temporary Hit Points` : ""}.{spec.blocksSpells ? " You can’t cast spells while transformed." : ""}</p>}
        {formPick && (
          <div className="fppick">
            <div className="fphead" style={{ marginTop: 8 }}>
              <b>{spec.known ? `Known forms ${known.length}/${spec.known}` : "Forms you can take"}</b>
              <span style={{ flex: 1 }} />
              {spec.known > 0 && <button className="sbtn sm ghost" onClick={() => setFormManage((x) => !x)}>{formManage ? "Done choosing" : "Choose known forms…"}</button>}
            </div>
            {!ok && <p className="note" style={{ color: "var(--warn)" }}>{whyNot(t.cost, t.name)}</p>}
            {!formManage && (known.length === 0
              ? <p className="note">You haven’t chosen any known forms yet. Use <b>Choose known forms…</b> to pick up to {spec.known} {spec.type || "creature"} forms{eligible.length ? ` from ${eligible.length} that fit` : ""}.</p>
              : <div className="fpgrid">{known.map((x) => (
                <div key={x.id} className={`fpcard ${cur?.id === x.id ? "on" : ""}`}>
                  <div><b>{x.name}</b> <span className="mut">CR {x.crText}</span></div>
                  <div className="note">AC {x.ac} · HP {x.hp} · {x.speedText}</div>
                  <div className="note">{x.actions.filter((a) => a.toHit !== undefined || a.save).map((a) => a.name).join(", ") || "No attacks"}</div>
                  <Btn className="sbtn sm" disabled={cur?.id === x.id || !ok} why={cur?.id === x.id ? "This is your current form." : whyNot(t.cost, t.name)} onClick={() => transform(t, x)}>{cur?.id === x.id ? "Current form" : on ? "Switch" : "Transform"}</Btn>
                </div>
              ))}</div>)}
            {formManage && (
              <>
                <p className="note">Pick up to {spec.known} forms from {eligible.length} {spec.type || "creature"}s you qualify for (from every pack you’ve imported).{spec.swap ? ` ${spec.swap}` : ""}</p>
                <input type="search" placeholder="Search forms" value={formQ} onChange={(e) => setFormQ(e.target.value)} style={{ maxWidth: 260, marginBottom: 8 }} />
                <div className="fpgrid">
                  {eligible.filter((x) => !q || `${x.name} ${x.speedText} ${x.actions.map((a) => a.name).join(" ")}`.toLowerCase().includes(q)).map((x) => {
                    const k = knownIds.includes(x.id);
                    const full = !k && knownIds.length >= spec.known && !c.houseRules;
                    return (
                      <label key={x.id} className={`fpcard pick ${k ? "on" : ""}`}>
                        <span><input type="checkbox" checked={k} disabled={full} onChange={() => setKnownForms(spec.id, k ? knownIds.filter((y) => y !== x.id) : [...knownIds, x.id])} /> <b>{x.name}</b> <span className="mut">CR {x.crText}</span></span>
                        <span className="note">AC {x.ac} · HP {x.hp} · {x.speedText}</span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
        {cur && formBlock(t, cur)}
      </div>
    );
  });

  // -------------------------------------------------------------- spells
  const spells = content.byType("Spell");
  const knownBy = casters.map((k) => ({
    k,
    list: [...k.info.cantrips, ...k.info.spells].map((n) => spells.find((s) => s.name === n)).filter(Boolean) as Entry[],
  }));
  // regular and Pact Magic slots of the same level both count; regular ones are used first
  const slotLeft = (lvl: number) => slots.filter((x) => x.level === lvl).reduce((n, x) => n + x.max - (p.slotsUsed[slotKey(x)] || 0), 0);
  /**
   * Cast a spell: spends a slot (or a free use / item charges), works out its rolls from its
   * Effects (or its text, for content without Effects), and keeps it as an active effect while it lasts.
   */
  function castSpell(s: Entry, slot: number, k: Caster | null, opt: { dc?: number; attack?: number; mod?: number; free?: boolean; pay?: ModifCost; via?: string; ritual?: boolean | "book" } = {}) {
    if (formTog?.form?.blocksSpells && formCr) {
      log({ title: `Can’t cast ${s.name}`, total: "—", cls: "info", detail: `You can’t cast spells while in ${esc(formCr.name)} form. Concentration on a spell you already cast continues.` });
      return;
    }
    const info = spellInfo(s);
    const castMod = opt.mod ?? k?.mod ?? 0;
    const spellAtk = opt.attack ?? k?.atk ?? d.pb + castMod;
    const spellDC = opt.dc ?? k?.dc ?? 8 + d.pb + castMod;
    const plan = spellPlan(s, { slot, charLevel: c!.level, spell: { mod: castMod, dc: spellDC, attack: spellAtk } });
    const minutes = plan ? plan.minutes : spellMinutes(s.fields["duration"]);
    const conc = plan ? plan.concentration : /concentration/i.test(s.fields["duration"] || "");
    let slotPatch: (cur: PlayState) => Partial<PlayState> = () => ({});
    if (info && info.level > 0 && !opt.free) {
      const use = [...slots].sort((a, b) => Number(a.pact) - Number(b.pact)).find((x) => x.level === slot && x.max - (p.slotsUsed[slotKey(x)] || 0) > 0);
      if (!use) return;
      const key = slotKey(use);
      slotPatch = (cur) => ({ slotsUsed: { ...cur.slotsUsed, [key]: (cur.slotsUsed[key] || 0) + 1 } });
    }
    setPlay((cur) => {
      const patch: Partial<PlayState> = { ...slotPatch(cur), ...pay(opt.pay, cur) };
      if (minutes > 0) {
        // a new concentration spell ends the old one
        const keep = (cur.active || []).filter((x) => x.key !== `spell:${s.id}` && !(conc && x.concentration));
        patch.active = [...keep, { key: `spell:${s.id}`, name: s.name, kind: "spell", slot, concentration: conc, minutes, since: timeNow() }];
      }
      if (conc) patch.concentration = s.name;
      const sm = summonsIn(s);
      if (sm.length) patch.companions = addCompanions(cur, sm.map((x) => companionFrom(x, { source: s.name, key: `spell:${s.id}`, entryId: s.id, level: slot || info?.level })));
      return patch;
    });
    const acts: CardAction[] = [];
    const lines: string[] = [];
    if (plan) {
      const dmg = plan.damage[0];
      const dmgExpr = plan.damage.map((x) => x.dice).join("+");
      const dmgType = plan.damage.map((x) => x.type).filter(Boolean).join(" + ");
      if (plan.attack) acts.push({ label: `Spell attack (${fmt(spellAtk)})${plan.attack.count > 1 ? ` ×${plan.attack.count}` : ""}`, run: () => attack({ name: s.name, toHit: spellAtk, damage: dmgExpr || "0", type: dmgType, note: "" }) });
      if (dmg && !plan.attack) acts.push({ label: `Roll damage (${dmgExpr})`, run: () => rollDamage(s.name, dmgExpr, false, dmgType) });
      if (plan.heal) acts.push({ label: `Roll healing (${plan.heal})`, run: () => rollDamage(s.name, plan.heal!, false, "", true, { maximize: fx.maxHealing }) });
      if (plan.tempHp) lines.push(`Temporary HP: ${plan.tempHp}`);
      if (plan.save) lines.push(`${plan.save.ability} save DC <b>${spellDC}</b>${plan.save.success === "half" ? " (half on a success)" : ""}`);
      lines.push(...plan.lines.map(esc));
    } else {
      // content without Effects: the sheet doesn't read its text, so the player applies it
      lines.push(`Spell attack ${fmt(spellAtk)} · save DC <b>${spellDC}</b>. This spell has no Effects, so apply its rolls from its description.`);
    }
    log({
      title: `Cast ${s.name}${opt.ritual ? " as a Ritual" : ""}`,
      total: "",
      cls: "info",
      detail: [
        `${opt.via ? `${esc(opt.via)} · ` : ""}${opt.ritual ? `Ritual: no slot used, takes 10 minutes longer to cast${opt.ritual === "book" ? " (you read it from your spellbook)" : ""}` : info?.level ? (opt.free ? `Level ${slot}, no slot used` : `Level ${slot} slot${slot > info.level ? ` (upcast from ${info.level})` : ""}`) : "Cantrip"}${conc ? " · Concentration" : ""}${minutes > 0 ? ` · lasts ${stripMd(s.fields["duration"] || "").replace(/^Concentration, /i, "")}` : ""}`,
        ...lines,
      ].map((x) => `<div>${x}</div>`).join(""),
    }, acts);
  }


  // ------------------------------------------------------------ features
  const allFeats = classFeatures(infos);
  const feat = bg ? content.byType("Feat").find((f) => f.name.toLowerCase() === featName(bg.fields["feat"]).replace(/\s*\(.*\)$/, "").toLowerCase()) : undefined;
  const choice = speciesChoice(sp);
  const choiceRow = choice?.table.rows.find((r) => r[0] === c.speciesChoice);

  const skillTag = (s: string) => {
    const ctx: RollContext = { kind: "check", ability: SKILL_ABILITY[s], skill: s, proficient: d.skills[s].prof };
    const cm = conditionMods(p, ctx);
    const adv = advantageFor(fx, ctx);
    const dis = [...cm.dis, ...disadvantageFor(fx, ctx)];
    // inside the skill's roll button, so they can't take a tap of their own: a hover tip, and the roll card says why
    return (
      <>
        {adv.length > 0 && <span className="tagm adv" title={`Advantage: ${adv.join(", ")}`}>A</span>}
        {dis.length > 0 && <span className="tagm dis" title={`Disadvantage: ${dis.join(", ")}`}>D</span>}
      </>
    );
  };

  const Pips = ({ n, used, onToggle, f }: { n: number; used: number; onToggle: (i: number) => void; f?: boolean }) => (
    <span className="pips">
      {Array.from({ length: n }, (_, i) => (
        <button key={i} className={`pip ${f ? "f" : ""} ${i < used ? "used" : ""}`} aria-label={`${i < used ? "Restore" : "Use"} ${i + 1}`} onClick={() => onToggle(i)} />
      ))}
    </span>
  );
  const Marks = ({ n, count, onSet, f, label }: { n: number; count: number; onSet: (v: number) => void; f?: boolean; label: string }) => (
    <span className="pips">
      {Array.from({ length: n }, (_, i) => (
        <button key={i} className={`pip ${f ? "f" : ""} ${i < count ? "" : "used"}`} aria-label={`${label} ${i + 1}`} aria-pressed={i < count} onClick={() => onSet(i < count ? i : i + 1)} />
      ))}
    </span>
  );
  const pct = Math.max(0, Math.min(100, (hpCur / hpMax) * 100));
  // where the headline numbers come from (tooltips on the stat boxes)
  const fromBonuses = (pred: (to: string) => boolean) => fx.bonuses.filter((b) => pred(b.to)).map((b) => `${fmt(b.value)} ${b.source}`);
  const statTip = {
    ac: formCr ? `AC ${d.ac}: ${d.acNote === formCr.name ? `the ${formCr.name}’s natural armor` : d.acNote}.` : `AC ${d.ac}: ${d.acNote.replace(/\bDex\b/, `Dexterity ${fmt(d.mods.Dexterity)}`)}.`,
    init: (() => {
      const isInit = (t: string) => t === "initiative" || t === "init";
      const listed = fx.bonuses.filter((b) => isInit(b.to));
      const other = d.initiative - d.mods.Dexterity - listed.reduce((n, b) => n + b.value, 0);
      return [`Dexterity ${fmt(d.mods.Dexterity)}`, ...listed.map((b) => `${fmt(b.value)} ${b.source}`), ...(other ? [`${fmt(other)} from features`] : [])].join(" · ") + ". Click to roll.";
    })(),
    speed: speed === 0 && d.speed ? `Your conditions drop your Speed to 0 (normally ${d.speed} ft).` : formCr ? `The ${formCr.name}’s Speed: ${formCr.speedText}.` : [`${d.speed - fx.bonuses.filter((b) => b.to.startsWith("speed")).reduce((n, b) => n + b.value, 0)} ft from your species`, ...fromBonuses((t) => t.startsWith("speed")).map((x) => `${x} ft`)].join(" · ") + ".",
    pb: `+${d.pb} at character level ${c.level}. It goes up at levels 5, 9, 13 and 17.`,
    pp: `10 + your Perception modifier (${fmt(d.passivePerception - 10)}).`,
    dc: casters.map((k) => `${k.info.cls.name}: DC ${k.dc} = 8 + Proficiency ${fmt(d.pb)} + ${k.ab || "ability"} ${fmt(k.mod)}${k.dc - 8 - d.pb - k.mod ? ` ${fmt(k.dc - 8 - d.pb - k.mod)} from items and features` : ""}; spell attack ${fmt(k.atk)}`).join(" · ") + ". Click for a spell attack roll.",
  };
  /** How an attack's to-hit adds up. */
  const toHitTip = (a: Attack) => {
    const m = a.ability ? d.mods[a.ability] : 0;
    const rest = a.toHit - m;
    const parts = [`${a.ability || "Ability"} ${fmt(m)}`];
    if (rest >= d.pb) parts.push(`Proficiency ${fmt(d.pb)}`);
    else if (rest < d.pb && rest >= 0 && a.ability) parts.push("not proficient");
    const extra = rest >= d.pb ? rest - d.pb : rest;
    if (extra) parts.push(`${fmt(extra)} from ${a.note || "bonuses"}`);
    return `${fmt(a.toHit)} to hit: ${parts.join(" · ")}.`;
  };

  return (
    <div className={`sheetv ${narrow && logHidden ? "loghid" : ""} ${critFx ? "critfx" : ""}`}>
      {drawerPanel()}
      {diceFx && (
        <div key={diceFx.key} className="dice3d" aria-hidden="true">
          {diceFx.dice.map((x, i) => (
            <div key={i} className={`die3d d${[4, 6, 8, 10, 12, 20].includes(x.sides) ? x.sides : "x"} ${x.kept ? "" : "dropped"} ${diceFx.crit && x.sides === 20 && x.kept ? "crit" : ""}`}
              style={{ animationDelay: `${i * 60}ms`, ["--spin" as string]: `${(i % 2 ? -1 : 1) * (540 + ((i * 97) % 300))}deg` }}>
              <span>{x.value}</span>
            </div>
          ))}
          {diceFx.mod !== 0 && (
            <div className="dmod" style={{ animationDelay: `${diceFx.dice.length * 60 + 450}ms`, ["--tilt" as string]: `${diceFx.tilt.toFixed(1)}deg` }}>
              {diceFx.mod < 0 ? "−" : "+"}{Math.abs(diceFx.mod)}
            </div>
          )}
        </div>
      )}
      <div className="smain">
        <section className="ident" {...bo("ident")}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div>
              <h1 className="disp">{c.name || "Unnamed character"}</h1>
              <div className="sub">
                Level {c.level} {sp?.name}{c.speciesChoice ? ` (${c.speciesChoice})` : ""}{" "}
                {infos.length > 1 ? classLabel(infos) : cls?.name}
                {infos.filter((i) => i.sub).map((i) => ` · ${i.sub!.name}`).join("")}{bg ? ` · ${bg.name}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <button className="sbtn sm" onClick={shortRest}>Short rest</button>
              <button className="sbtn sm" onClick={longRest}>Long rest</button>
              <span className="hsep" aria-hidden="true" />
              {editable && <Link className="sbtn ghost sm" to={`/build/${c.id}`} style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Edit in builder</Link>}
              {editable && (() => {
                // picks still to make (a new feature, or an old pick that's no longer allowed)
                const open = fx.pending.filter((pc) => pc.options && pc.options.length > 0 && pc.chosen.length < Math.min(pc.count, pc.options.length));
                return open.length > 0 && (
                  <Tip tip={`Still to choose: ${open.map((pc) => pc.label).join("; ")}`}>
                    <Link className="tag warn" to={`/build/${c.id}`} style={{ alignSelf: "center", textDecoration: "none" }}>{open.length} choice{open.length > 1 ? "s" : ""} left</Link>
                  </Tip>
                );
              })()}
              {cloud && editable && (
                <button className={`sbtn sm ${row?.hidden ? "" : "ghost"}`} aria-pressed={!!row?.hidden} onClick={() => chars.setHidden(c.id, !row?.hidden)}>
                  {row?.hidden ? "Hidden · show to group" : "Hide from group"}
                </button>
              )}
              <button className="sbtn ghost sm mobonly" title="Change the order of the boxes on the sheet (phone layout)" onClick={() => setLayoutOpen(true)}>Layout</button>
              <button className="sbtn ghost sm" onClick={() => window.print()}>Print</button>
            </div>
          </div>
          {cloud && row?.hidden && (
            <div className="schip" style={{ display: "inline-block", marginTop: 8 }}>
              Hidden: only {row.owner === session.user?.id ? "you" : session.nameOf(row.owner)} and the group’s admins can see this character{sharedLog ? ", and its rolls stay out of everyone else’s table log" : ""}.
            </div>
          )}
          {!editable && (
            <div className="schip conc" style={{ display: "inline-block", marginTop: 8 }}>
              Viewing {session.nameOf(row?.owner)}’s character. Rolls work but changes aren’t saved.
            </div>
          )}
          <div className="chips">
            {p.conditions.map((k) => (
              <button key={k} className="schip bad" title="Click to remove" onClick={() => setPlay({ conditions: p.conditions.filter((x) => x !== k) })}>{k} ✕</button>
            ))}
            {p.exhaustion > 0 && <span className="schip bad">Exhaustion {p.exhaustion}</span>}
            {p.concentration && (
              <button className="schip conc" title="Drop concentration" onClick={() => { setPlay({ concentration: undefined, active: activeList.filter((x) => !x.concentration) }); log({ title: "Concentration ended", total: "", cls: "event", detail: esc(p.concentration!) }); }}>
                ◎ Concentrating: {p.concentration} ✕
              </button>
            )}
            {activeList.filter((x) => !x.concentration).map((x) => (
              <button key={x.key} className="schip" title="Open the Effects tab" onClick={() => setTab("effects")}>● {x.name}</button>
            ))}
            {p.inspiration && <span className="schip gold">★ Heroic Inspiration</span>}
          </div>
        </section>

        <section className="stats" {...bo("stats")}>
          <Tip className="stat frm shield" tip={statTip.ac}><div className="sl">Armor</div><div className="sv2">{d.ac}</div><div className="sl">Class</div></Tip>
          <button className="stat frm notch" title={statTip.init} onClick={() => test("Initiative", d.initiative, { kind: "init", ability: "Dexterity" })}><div className="sl">Initiative</div><div className="sv2">{fmt(d.initiative)}</div><div className="ss">click to roll</div></button>
          <Tip className="stat frm notch" tip={statTip.speed}><div className="sl">Speed</div><div className="sv2">{speed} ft</div><div className="ss">{speed === 0 && d.speed ? "conditions" : ""}</div></Tip>
          <Tip className="stat frm notch" tip={statTip.pb}><div className="sl">Proficiency</div><div className="sv2">{fmt(d.pb)}</div><div className="ss" /></Tip>
          <Tip className="stat frm notch" tip={statTip.pp}><div className="sl">Passive Perception</div><div className="sv2">{d.passivePerception}</div><div className="ss" /></Tip>
          {castAb && (
            <button className="stat spell" title={statTip.dc} onClick={() => attack({ name: "Spell", toHit: spellAtk, damage: "0", type: "", note: "" })}>
              <div className="sl">Spell Save DC</div>{casters.length > 1 && new Set(casters.map((k) => k.dc)).size > 1 ? <div className="sv2">{casters.map((k) => k.dc).join(" / ")}</div> : <div className="sv2 gemv">{spellDC}</div>}
              <div className="ss">{casters.length > 1 && new Set(casters.map((k) => `${k.ab}${k.atk}`)).size > 1 ? casters.map((k) => `${k.info.cls.name} ${fmt(k.atk)}`).join(" · ") : `atk ${fmt(casters[0]?.atk ?? spellAtk)} · ${ABBR[casters[0]?.ab || castAb]}`}</div>
            </button>
          )}
        </section>

        <section className="abil" {...bo("abil")}>
          {ABILITIES.map((a) => (
            <div key={a} className="ab">
              <div className="abf frm cut">
                <div className="abn">{a}</div>
                <button className="abm" title={`Roll ${a} check`} onClick={() => test(`${a} check`, d.mods[a], { kind: "check", ability: a })}>{fmt(d.mods[a])}</button>
              </div>
              <div className="abs" title={`${a} score`}>{d.scores[a]}</div>
              <button className={`sv ${d.saves[a].prof ? "p" : ""}`} title={`Roll ${a} save`} onClick={() => test(`${a} save`, d.saves[a].value, { kind: "save", ability: a })}>
                <span className={`dot ${d.saves[a].prof ? "p1" : ""}`} />Save {fmt(d.saves[a].value)}
              </button>
            </div>
          ))}
        </section>

        <div className="cols">
          <div className="left">
            <section className="spanel skills" {...bo("skills")}>
              <h3>Skills</h3>
              {SKILLS.map((s) => (
                <button key={s} className="sk" title={skillAlt(s) ? `Using ${skillAlt(s)!.ability} (${skillAlt(s)!.source})` : undefined}
                  onClick={() => test(`${s} check`, skillValue(s), { kind: "check", ability: skillAlt(s)?.ability || SKILL_ABILITY[s], skill: s, proficient: d.skills[s].prof })}>
                  <span className={`dot ${d.skills[s].prof ? (fx.expertise.has(s) ? "p1 ex" : "p1") : fx.halfProficiency ? "half" : ""}`} />
                  <span className="skn">{s}{skillTag(s)}</span>
                  <span className="ska">{ABBR[skillAlt(s)?.ability || SKILL_ABILITY[s]]}</span>
                  <span className="skb">{fmt(skillValue(s))}</span>
                </button>
              ))}
            </section>
            {profsPanel()}
          </div>

          <div className="right">
            <section className="spanel hp frm cut" {...bo("hp")}>
              <div className="hpc">
                <button className="sbtn grn" onClick={heal}>Heal</button>
                <input type="number" min={0} placeholder="0" aria-label="Amount" value={hpAmt} onChange={(e) => setHpAmt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && takeDamage()} />
                <button className="sbtn red" onClick={takeDamage}>Damage</button>
                <button className="sbtn sm ghost" onClick={addTemp}>Temp</button>
              </div>
              <div className="hpm">
                <div className="sl">Hit Points</div>
                <div className="hpv">
                  <span className={hpCur === 0 ? "bad" : ""}>{hpCur}</span>
                  <span className="mut">/ {hpMax}</span>
                  {p.hpTemp > 0 && <span className="temp">+{p.hpTemp} temp</span>}
                </div>
                <div className="hbar"><div style={{ width: `${pct}%` }} className={pct < 25 ? "low" : pct < 50 ? "mid" : ""} /></div>
              </div>
              <div className="hpx">
                <span>Hit Dice: {pools.map((pl, i) => <span key={pl.die}>{i ? " · " : ""}<b>{pl.count - hdUsedOf(pl.die)}</b>/{pl.count} d{pl.die}</span>)}</span>
                {pools.length > 1 ? pools.map((pl) => (
                  <button key={pl.die} className="sbtn sm ghost" disabled={hdUsedOf(pl.die) >= pl.count || hpCur >= hpMax} onClick={() => spendHitDie(pl.die)}>Spend d{pl.die}</button>
                )) : (
                  <button className="sbtn sm ghost" disabled={hdLeft <= 0 || hpCur >= hpMax} onClick={() => spendHitDie()}>Spend Hit Die</button>
                )}
                {hpCur === 0 && (
                  <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    Death saves: ✓ <Marks n={3} count={p.deathS} label="success" onSet={(v) => setPlay({ deathS: v })} />
                    ✗ <Marks n={3} f count={p.deathF} label="failure" onSet={(v) => setPlay({ deathF: v })} />
                    <button className="sbtn sm red" onClick={deathSave}>Roll death save</button>
                  </span>
                )}
              </div>
            </section>

            {(slots.length > 0 || resources.length > 0 || fx.converts.length > 0) && (
              <section className="spanel slotbar" {...bo("slots")}>
                {slots.length > 0 && (
                  <>
                    <span className="sl">{slots.every((s) => s.pact) ? "Pact Magic" : "Spell Slots"}</span>
                    <div className="slots">
                      {slots.map((s) => {
                        const key = slotKey(s);
                        return (
                          <div key={key} className="slot">
                            <Tip tip={s.pact ? "Pact Magic: comes back on a Short or Long Rest." : `Level ${s.level} spell slots: they come back on a Long Rest.`}><span className="sl">{s.pact && slots.some((x) => !x.pact) ? "Pact " : ""}L{s.level}</span></Tip>
                            {/* a negative count is extra slots (created with Font of Magic; gone after a Long Rest) */}
                            <Pips n={s.max + Math.max(0, -(p.slotsUsed[key] || 0))} used={Math.max(0, p.slotsUsed[key] || 0)} onToggle={(i) => setPlay((cur) => {
                              const u = cur.slotsUsed[key] || 0, extra = Math.max(0, -u), shown = Math.max(0, u);
                              return { slotsUsed: { ...cur.slotsUsed, [key]: (i < shown ? i : i + 1) - extra } };
                            })} />
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                {resources.map((r) => (
                  <div key={r.key} className="slot">
                    <Tip tip={`${r.die ? `Each is a ${r.die}. ` : ""}${refreshText(r)}`}><span className="sl">{r.name}{r.die ? ` (${r.die})` : ""}</span></Tip>
                    {r.max <= 10 ? (
                      <Pips n={r.max} used={p.resUsed[r.key] || 0} onToggle={(i) => setPlay((cur) => ({ resUsed: { ...cur.resUsed, [r.key]: i < (cur.resUsed[r.key] || 0) ? i : i + 1 } }))} />
                    ) : (
                      <span className="counter" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                        <button className="sbtn sm ghost" aria-label={`Use one ${r.name}`} disabled={(p.resUsed[r.key] || 0) >= r.max} onClick={() => setPlay((cur) => ({ resUsed: { ...cur.resUsed, [r.key]: Math.min(r.max, (cur.resUsed[r.key] || 0) + 1) } }))}>−</button>
                        <b>{r.max - (p.resUsed[r.key] || 0)}</b>/{r.max}
                        <button className="sbtn sm ghost" aria-label={`Restore one ${r.name}`} disabled={!(p.resUsed[r.key] || 0)} onClick={() => setPlay((cur) => ({ resUsed: { ...cur.resUsed, [r.key]: Math.max(0, (cur.resUsed[r.key] || 0) - 1) } }))}>+</button>
                      </span>
                    )}
                  </div>
                ))}
                {fx.converts.map((cv) => {
                  const ok = cv.options.map((o, i) => ({ o, i })).filter(({ o }) => canTrade(cv, o));
                  const pick = ok.find((x) => x.i === convPick[cv.id]) || ok[0];
                  const once = cv.perLong && (p.resUsed[`convert:${cv.id}`] || 0) > 0;
                  return (
                    <div key={cv.id} className="slot conv">
                      <Tip tip={`${cv.source}${cv.activation !== "none" ? ` · ${actName(cv.activation)}` : " · no action"}${cv.perLong ? " · once per Long Rest" : ""}${cv.ifEmpty ? " · only when you have none left" : ""}`}><span className="sl">{cv.name}</span></Tip>
                      {cv.options.length > 1 ? (
                        <select aria-label={`${cv.name}: what to trade`} value={pick?.i ?? ""} disabled={!ok.length || once} onChange={(e) => setConvPick((m) => ({ ...m, [cv.id]: +e.target.value }))}>
                          {!ok.length && <option value="">nothing to trade</option>}
                          {ok.map(({ o, i }) => <option key={i} value={i}>{sideText(o.spend)} → {sideText(o.gain)}</option>)}
                        </select>
                      ) : (
                        <span className="mut" style={{ fontSize: 12 }}>{sideText(cv.options[0].spend)} → {sideText(cv.options[0].gain)}</span>
                      )}
                      <Btn className="sbtn sm ghost" disabled={!pick || once} why={once ? `You’ve used ${cv.name} since your last Long Rest. It comes back when you finish a Long Rest.` : !pick ? "You don’t have anything it can trade right now." : undefined} onClick={() => pick && trade(cv, pick.o)}>{once ? "Used" : "Convert"}</Btn>
                    </div>
                  );
                })}
              </section>
            )}

            <div {...bo("tabs")}>
              <ScrollRow className="stabs" label="Sheet tabs" more="More tabs" active={tab}>
                {([["actions", "Actions"], ["effects", "Effects"], ["spells", "Spells"], ["features", "Features & Feats"], ["conditions", "Conditions"], ["inventory", "Inventory"], ["background", "Background"], ["notes", "Notes"]] as [Tab, string][])
                  .filter(([k]) => k !== "spells" || anyCaster || fx.grantedSpells.length > 0)
                  .map(([k, l]) => (
                    <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
                      {l}{k === "conditions" && p.conditions.length + (p.exhaustion ? 1 : 0) > 0 && <span className="badge">{p.conditions.length + (p.exhaustion ? 1 : 0)}</span>}
                      {k === "effects" && activeList.length > 0 && <span className="badge">{activeList.length}</span>}
                    </button>
                  ))}
              </ScrollRow>

              {tab === "actions" && formsPanel()}
              {tab === "actions" && companionsPanel()}
              {tab === "actions" && recordedSection()}
              {tab === "actions" && (
                <div className="spanel" style={{ overflowX: "auto" }}>
                  <div className="chipsrow" role="group" aria-label="Show">
                    {([["all", "All"], ["attack", "Attack"], ["action", "Action"], ["bonus", "Bonus Action"], ["reaction", "Reaction"], ["other", "Other"], ["limited", "Limited Use"]] as const).map(([k2, l]) => (
                      <button key={k2} className={actFilter === k2 ? "on" : ""} aria-pressed={actFilter === k2} onClick={() => setActFilter(k2)}>{l}</button>
                    ))}
                  </div>
                  {actFilter === "limited" && limitedSection()}
                  {(actFilter === "all" || actFilter === "attack") && <>
                  {d.attacksPerAction > 1 && <p className="note" style={{ marginTop: 0 }}>When you take the Attack action, you attack <b>{d.attacksPerAction} times</b>.</p>}
                  <table className="atks">
                    <thead><tr><th>Attack</th><th>To hit</th><th>Damage</th><th></th></tr></thead>
                    <tbody>
                      {attacks.map((a, i) => (
                        <tr key={`${a.name}-${i}`}>
                          <td><b>{a.name}</b><div className="note">{a.note}</div></td>
                          <td><Tip tip={formCr ? `The ${formCr.name}’s attack bonus.` : toHitTip(a)}>{fmt(a.toHit)}</Tip></td>
                          <td>{a.damage} {a.type}{a.versatile ? <div className="note">two hands {a.versatile}</div> : null}</td>
                          <td>
                            <div className="rowbtn">
                              <button className="sbtn sm" onClick={() => attack(a)}>Attack</button>
                              <button className="sbtn sm ghost" onClick={() => rollDamage(a.name, a.damage, false, a.type, false, dmgMods(a, false))}>Damage</button>
                              {a.versatile && <button className="sbtn sm ghost" onClick={() => attack(a, true)}>Two hands</button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {spellAttackRows()}
                    </tbody>
                  </table>
                  <p className="note" style={{ marginTop: 10 }}>{formCr ? <>In {formCr.name} form you attack with its natural weapons. </> : null}Attacks come from the weapons equipped in your <button className="linkish" onClick={() => setTab("inventory")}>Inventory</button>{formCr ? "" : " and your spells that make attack rolls"}.{d.critRange < 20 ? ` Your weapon attacks score a Critical Hit on a ${d.critRange}–20.` : ""}</p>
                  </>}
                  {(actFilter === "all" || actFilter === "bonus") && (() => {
                    const rows = bonusRows();
                    return (
                      <>
                        <h3 style={{ marginTop: 16 }}>Bonus Actions</h3>
                        {rows.length === 0 ? <p className="note">You have no Bonus Actions yet. They come from features, spells and fighting with two Light weapons.</p> : (
                          <table className="atks bonusacts">
                            <thead><tr><th>Bonus Action</th><th>Details</th><th></th></tr></thead>
                            <tbody>
                              {rows.map((b) => (
                                <tr key={b.key}>
                                  <td><b>{b.name}</b><div className="note">{b.source}</div></td>
                                  <td className="note">
                                    {b.detail}
                                    {b.pick && (
                                      <select className="optpick" aria-label={b.pick.label} value={b.pick.value} onChange={(e) => b.pick!.set(+e.target.value)}>
                                        {b.pick.options.map((o, i) => <option key={i} value={i}>{o}</option>)}
                                      </select>
                                    )}
                                    {b.amount}
                                  </td>
                                  <td><div className="rowbtn">{b.buttons.map((x) => <Btn key={x.label} className={`sbtn sm ${x.ghost ? "ghost" : ""}`} disabled={x.disabled} why={x.why} onClick={x.run}>{x.label}</Btn>)}</div></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        {spellChips("bonus")}
                        <p className="note">You can take one Bonus Action on your turn.</p>
                      </>
                    );
                  })()}
                  {(actFilter === "all" || actFilter === "attack" || actFilter === "other") && ridersSection()}
                  {(actFilter === "all" || actFilter === "attack" || actFilter === "other") && masterySection()}
                  {(actFilter === "all" || actFilter === "reaction") && reactionsSection()}
                  {(actFilter === "all" || actFilter === "reaction") && spellChips("reaction")}
                  {(actFilter === "all" || actFilter === "action") && <h3 style={{ marginTop: 16 }}>Actions</h3>}
                  {(actFilter === "all" || actFilter === "action" || actFilter === "other") && fx.actions.some((x) => !isBonus(x.activation) && !/reaction/i.test(x.activation) && (actFilter === "other" ? !isActionAct(x.activation) : actFilter === "action" ? isActionAct(x.activation) : true)) && (
                    <table className="atks" style={{ marginTop: 14 }}>
                      <thead><tr><th>Feature or item</th><th>Uses</th><th>Effect</th><th></th></tr></thead>
                      <tbody>
                        {fx.actions.filter((x) => !isBonus(x.activation) && !/reaction/i.test(x.activation) && (actFilter === "other" ? !isActionAct(x.activation) : actFilter === "action" ? isActionAct(x.activation) : true)).map((a) => {
                          const { res, left, ok } = costInfo(a.cost);
                          return (
                            <tr key={a.id}>
                              <td><b>{a.name}</b><div className="note">{[a.activation, a.source !== a.name ? a.source : ""].filter(Boolean).join(" · ")}</div></td>
                              <td>{res ? `${left} / ${res.max}${a.cost && a.cost.amount > 1 ? ` (costs ${a.cost.amount})` : ""}` : "—"}</td>
                              <td>
                                {a.heal ? `Regain ${a.heal} HP. ` : a.cast ? `Casts ${content.byId(a.cast.spellId)?.name || a.name}${a.cast.dc ? ` (DC ${a.cast.dc}${a.cast.attack !== undefined ? `, ${fmt(a.cast.attack)} to hit` : ""})` : ""}` : null}
                                {a.cast?.scroll && (() => {
                                  const sc = scrollUse(a.cast.scroll);
                                  return <div className="note">{!sc.readable ? "Not on your spell list: you can’t read it." : sc.check ? `${sc.check.skill ? `${sc.check.ability} (${sc.check.skill})` : sc.check.ability} check DC ${a.cast.scroll.checkDc} first${sc.check.source ? ` (${sc.check.source})` : ""}; the scroll is used up either way.` : "Used up when cast."}</div>;
                                })()}
                                {a.save && <span>{a.save.dc ? `DC ${a.save.dc} ` : ""}{a.save.ability} save{a.damage?.length ? `, ${a.damage.map((x) => `${x.dice} ${x.type}`).join(" + ")}` : ""}</span>}
                                {!a.save && a.damage?.length ? <span>{a.damage.map((x) => `${x.dice} ${x.type}`).join(" + ")}</span> : null}
                                {a.text && <div className="note">{a.text}</div>}
                                {optionLabels(a) && (
                                  <select className="optpick" aria-label={`${a.name}: which option`} value={optionOf(a).i} onChange={(e) => setActPick((m) => ({ ...m, [a.id]: +e.target.value }))}>
                                    {optionLabels(a)!.map((o, i) => <option key={i} value={i}>{o}</option>)}
                                  </select>
                                )}
                                {amountPicker(a.id, optionLabels(a) && a.optionCosts ? a.optionCosts[optionOf(a).i] ?? a.cost : a.cost)}
                              </td>
                              <td><div className="rowbtn"><Btn className="sbtn sm" onClick={() => runFeature(a, optionLabels(a) ? optionOf(a).i : undefined)} disabled={(optionLabels(a) ? !optionOf(a).ok : !ok) || (!!a.cast?.scroll && !scrollUse(a.cast.scroll).readable)} why={actWhy(a, optionLabels(a) ? optionOf(a) : undefined)}>{a.cast ? "Cast" : "Use"}</Btn></div></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                  {(actFilter === "all" || actFilter === "other") && (spellChips("other") || spellChips("ritual")) && (
                    <>
                      <h3 style={{ marginTop: 16 }}>Other</h3>
                      {spellChips("other", "Spells that take longer")}
                      {spellChips("ritual")}
                    </>
                  )}
                  {(actFilter === "all" || actFilter === "action") && (
                    <div className="note" style={{ marginTop: 12 }}>
                      <b>Actions in Combat:</b> {COMBAT_ACTIONS.map((x, j) => (
                        <span key={x.name}>{j ? ", " : ""}<button className="linkish" onClick={() => setDrawer({ kind: "feature", title: x.name, sub: "Action everyone can take", md: x.text })}>{x.name}</button></span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === "spells" && spellbookPanel()}
              {tab === "spells" && (anyCaster || fx.grantedSpells.length > 0) && spellsTable()}

              {tab === "effects" && (
                <div className="stack" style={{ gap: 14 }}>
                  <div className="spanel">
                    <h3 style={{ marginTop: 0 }}>Active now</h3>
                    {activeList.length === 0 ? <p className="note">Nothing active. Use something below, or cast a spell with a duration.</p> : activeList.map((x) => {
                      const t = fx.toggles.find((y) => y.key === x.key);
                      const sp = fx.activeSpells.find((y) => y.key === x.key);
                      const lines = t ? t.lines : sp ? sp.lines : [];
                      return (
                        <div key={x.key} className="feat" style={{ padding: "8px 10px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                            <span><b>{x.name}</b> <span className="mut">· {x.kind === "spell" ? `spell${x.slot ? `, level ${x.slot}` : ""}` : t && t.source !== t.name ? t.source : "on"}{x.concentration ? " · Concentration" : ""} · since {x.since}{t?.duration ? ` · lasts ${t.duration}` : ""}</span></span>
                            <button className="sbtn sm ghost" onClick={() => endEffect(x)}>End</button>
                          </div>
                          {sp?.targetEffects && (
                            <label className="note" style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                              <input type="checkbox" checked={!!x.onSelf} onChange={(e) => setPlay((cur) => ({ active: (cur.active || []).map((y) => (y.key === x.key ? { ...y, onSelf: e.target.checked } : y)) }))} />
                              I'm a target (apply its effects to my sheet)
                            </label>
                          )}
                          {lines.length > 0 && <ul className="note" style={{ margin: "6px 0 0 18px" }}>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>}
                          {t?.ends && <div className="note">{t.ends}</div>}
                        </div>
                      );
                    })}
                  </div>
                  {fx.toggles.filter((t) => !isOn(t.key)).length > 0 && (
                    <div className="spanel">
                      <h3 style={{ marginTop: 0 }}>Ready to use</h3>
                      {fx.toggles.filter((t) => !isOn(t.key)).map((t) => {
                        const { res, left, ok } = costInfo(t.cost);
                        return (
                          <div key={t.key} className="feat" style={{ padding: "8px 10px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                              <span><b>{t.name}</b> <span className="mut">· {[t.activation, t.source !== t.name ? t.source : "", res ? `${left}/${res.max} ${res.name}` : "", t.duration ? `lasts ${t.duration}` : ""].filter(Boolean).join(" · ")}</span></span>
                              <Btn className="sbtn sm" disabled={!ok} why={whyNot(t.cost, t.name)} onClick={() => (t.form ? openForms() : switchOn(t))}>{t.form ? "Choose form" : "Use"}</Btn>
                            </div>
                            {t.lines.length > 0 && <div className="note">{t.lines.join(" · ")}</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {fx.triggers.length > 0 && (
                    <div className="spanel">
                      <h3 style={{ marginTop: 0 }}>When this happens</h3>
                      <table className="atks">
                        <tbody>
                          {fx.triggers.map((t) => {
                            const { res, left, ok } = costInfo(t.cost);
                            return (
                              <tr key={t.key}>
                                <td><b>{t.name}</b><div className="note">{t.when}</div></td>
                                <td>{t.text}{t.auto && <div className="note">Happens automatically.</div>}</td>
                                <td>{res ? `${left} / ${res.max}` : ""}</td>
                                <td>{res && t.cost && (
                                  <Btn className="sbtn sm" disabled={!ok} why={whyNot(t.cost, t.name)} onClick={() => useTrigger(t)}>Use</Btn>
                                )}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {fx.notes.length > 0 && (
                    <div className="spanel">
                      <h3 style={{ marginTop: 0 }}>Always on</h3>
                      <ul className="note" style={{ margin: "0 0 0 18px" }}>{fx.notes.map((n, i) => <li key={i}><b>{n.feature}</b>{n.feature !== n.source ? ` (${n.source})` : ""}: {n.text}</li>)}</ul>
                    </div>
                  )}
                  {fx.reminders.length > 0 && (
                    <div className="spanel">
                      <h3 style={{ marginTop: 0 }}>Apply by hand</h3>
                      <p className="note" style={{ marginTop: 0 }}>Rules the sheet shows but doesn’t track.</p>
                      <ul className="note" style={{ margin: "0 0 0 18px" }}>{fx.reminders.map((r, i) => <li key={i}><b>{r.feature}</b>{r.feature !== r.source ? ` (${r.source})` : ""}: {r.text}</li>)}</ul>
                    </div>
                  )}
                </div>
              )}

              {tab === "features" && (
                <div>
                  <div className="chipsrow" role="group" aria-label="Show">
                    {([["all", "All"], ["class", "Class Features"], ["species", "Species Traits"], ["feats", "Feats"]] as const).map(([k2, l]) => (
                      <button key={k2} className={featFilter === k2 ? "on" : ""} aria-pressed={featFilter === k2} onClick={() => setFeatFilter(k2)}>{l}</button>
                    ))}
                  </div>
                  {featFilter === "all" && restChoicesPanel()}
                  {featFilter === "all" && customFeaturesPanel()}
                  {(featFilter === "all" || featFilter === "class") && allFeats.map((f, i) => (
                    <details key={`f${i}`} className="feat" open={featFilter === "class" || undefined}>
                      <summary>{f.name} <span className="mut">· {f.src === f.classLevel.replace(/ \d+$/, "") ? f.classLevel : `${f.src} · ${f.classLevel}`}</span>{featureBadges(f.name)}{autoTag(infos.flatMap((i) => [i.cls, i.sub]).find((e) => e?.name === f.src)?.id, f.name)}</summary>
                      <Md md={f.md} />
                      {featureExtras(f.name)}
                    </details>
                  ))}
                  {(featFilter === "all" || featFilter === "species") && traits(sp).map((t, i) => (
                    <details key={`t${i}`} className="feat" open={featFilter === "species" || undefined}>
                      <summary>{t.name} <span className="mut">· {sp!.name}</span>{featureBadges(t.name)}{autoTag(sp?.id, t.name)}</summary>
                      <Md md={t.md} />
                      {featureExtras(t.name)}
                    </details>
                  ))}
                  {(featFilter === "all" || featFilter === "species") && choiceRow && (
                    <div className="feat"><b>{c.speciesChoice}</b> <span className="mut">· {choice!.title}</span>
                      <div className="note">{choice!.table.header.slice(1).map((h, i) => `${h}: ${choiceRow[i + 1]}`).join(" · ")}</div>
                    </div>
                  )}
                  {(featFilter === "all" || featFilter === "feats") && feat && (
                    <details className="feat" open={featFilter === "feats" || undefined}>
                      <summary>{feat.name} <span className="mut">· {bg!.name} feat</span>{featureBadges(feat.name)}{autoTag(feat.id, feat.name)}</summary>
                      <Md md={feat.body} />
                      {featureExtras(feat.name)}
                    </details>
                  )}
                  {(featFilter === "all" || featFilter === "feats") && fx.featPicks.filter((fp) => fp.feat.id !== feat?.id).map(({ feat: f, slot, level, className }) => (
                    <details key={slot || f.id} className="feat" open={featFilter === "feats" || undefined}>
                      <summary>{f.name} <span className="mut">· {level ? `${className || ""} ${level} feat`.trim() : "feat"}</span>{featureBadges(f.name)}{autoTag(f.id, f.name)}</summary>
                      <Md md={f.body} />
                      {featureExtras(f.name)}
                    </details>
                  ))}

                </div>
              )}

              {tab === "conditions" && (
                <div className="spanel">
                  <div className="condgrid">
                    {conditionEntries.filter((e) => e.name !== "Exhaustion").map((e) => {
                      const on = p.conditions.includes(e.name);
                      return (
                        <button key={e.id} className="condbtn" aria-pressed={on} onClick={() => {
                          setPlay({ conditions: on ? p.conditions.filter((x) => x !== e.name) : [...p.conditions, e.name] });
                          log({ title: `${on ? "Removed" : "Gained"} ${e.name}`, total: "", cls: "event", detail: on ? "" : esc(CONDITION_EFFECTS[e.name]?.note || "") });
                        }}>{e.name}</button>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
                    <b>Exhaustion</b>
                    <button className="sbtn sm" aria-label="Reduce exhaustion" disabled={!p.exhaustion} onClick={() => setPlay({ exhaustion: p.exhaustion - 1 })}>−</button>
                    <span>{p.exhaustion} / 6</span>
                    <button className="sbtn sm" aria-label="Increase exhaustion" disabled={p.exhaustion >= 6} onClick={() => setPlay({ exhaustion: p.exhaustion + 1 })}>+</button>
                    <span className="note">Each level: −2 to d20 tests and −5 ft Speed. At 6 you die.</span>
                  </div>
                  {p.conditions.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      {p.conditions.map((k) => {
                        const e = conditionEntries.find((x) => x.name === k);
                        return e ? <details key={k} className="feat" open><summary>{k}</summary><Md md={e.body} /></details> : null;
                      })}
                    </div>
                  )}
                  {conditionEntries.length === 0 && <p className="note">Loading conditions…</p>}
                </div>
              )}

              {tab === "inventory" && (
                <InventoryPanel
                  items={inv.items}
                  coins={inv.coins}
                  fromStart={inv.fromStart}
                  editable={editable}
                  catalog={itemCatalog}
                  byId={content.byId}
                  infoOf={infoOf}
                  weapons={weapons}
                  armor={armor}
                  strength={d.scores.Strength}
                  size={fx.size || (sp?.fields["size"] || "Medium").split(/[\s(]/)[0]}
                  carrySize={fx.carrySize}
                  spellNames={spellNames}
                  onChange={setInventory}
                  onReset={resetInventory}
                />
              )}

              {tab === "background" && (
                <div className="spanel">
                  <div className="fphead">
                    <h3 style={{ margin: 0 }}>{bg ? bg.name : "Background"}</h3>
                    {editable && <Link to={`/build/${c.id}?step=details`} className="note">Edit details</Link>}
                  </div>
                  {bg && <p className="note" style={{ marginTop: 6 }}>{intro(bg)}</p>}
                  <DetailsForm c={c} readOnly />
                </div>
              )}
              {tab === "notes" && (
                <div className="spanel">
                  <h3>Notes</h3>
                  <textarea value={c.notes} onChange={(e) => { dirty.current = true; const v = e.target.value; setC((prev) => (prev ? { ...prev, notes: v } : prev)); }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="side">
        <div className="rollbar" {...bo("rollbar")}>
          <div className="seg" role="group" aria-label="Roll mode">
            <button className={mode === "dis" ? "on dis" : ""} onClick={() => setMode("dis")}>Disadvantage</button>
            <button className={mode === "normal" ? "on" : ""} onClick={() => setMode("normal")}>Normal</button>
            <button className={mode === "adv" ? "on adv" : ""} onClick={() => setMode("adv")}>Advantage</button>
          </div>
          <div className="rbrow">
            <label className="nb" title="A one-time modifier for your next d20 roll, like Bardic Inspiration (1d6) or Guidance (1d4). Clears after one roll.">
              <span className="vh">Next roll bonus</span>
              <input value={nextBonus} onChange={(e) => setNextBonus(e.target.value)} placeholder="Next roll: +2 or 1d4" />
            </label>
            <button className="ibtn insp" aria-pressed={!!p.inspiration} aria-label="Heroic Inspiration" title={p.inspiration ? "Heroic Inspiration: you have it. Click to use it." : "Heroic Inspiration: click when you gain it."}
              onClick={() => { setPlay({ inspiration: !p.inspiration }); log({ title: p.inspiration ? "Used Heroic Inspiration" : "Gained Heroic Inspiration", total: "", cls: "event", detail: p.inspiration ? "Reroll any die immediately after rolling it." : "" }); }}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill={p.inspiration ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
            </button>
            <button className="ibtn" aria-pressed={dice3d} aria-label="3D dice" title={dice3d ? "3D dice: on" : "3D dice: off"} onClick={() => { setDice3d(!dice3d); setDice3dState(!dice3d); }}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M12 2.5l8.5 4.9v9.2L12 21.5l-8.5-4.9V7.4z" /><path d="M12 2.5v6.8M3.5 7.4l8.5 1.9 8.5-1.9M12 9.3l-5 8.6M12 9.3l5 8.6M7 17.9h10" /></svg>
            </button>
            <button className="ibtn" aria-pressed={sound} aria-label="Dice sound" title={sound ? "Dice sound: on" : "Dice sound: off"} onClick={() => { setSound(!sound); setSoundState(!sound); if (!sound) setTimeout(() => playDice(2), 0); }}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />{sound ? <path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}</svg>
            </button>
          </div>
        </div>

        {narrow && logHidden && (
          <button className="sbtn sm logshow" title="Show the Game Log" onClick={() => { setLogHidden(false); setToast(undefined); }}>📜 Log</button>
        )}
        {toast && narrow && logHidden && (
          <button key={toast.id} className={`rolltoast ${toast.cls}`} onClick={() => { setLogHidden(false); setToast(undefined); }} aria-live="polite" title="Show the Game Log">
            {toast.total !== "" && <span className="big">{toast.total}</span>}
            <span className="rtt">{toast.title}</span>
          </button>
        )}
        <aside className={`log ${logOpen ? "open" : ""} ${narrow && logHidden ? "hid" : ""}`}>
          <div className="logh">
            <span className="disp">{logView === "table" ? "Table Log" : "Game Log"}</span>
            {sharedLog && (
              <span className="seg" role="group" aria-label="Log view">
                <button className={logView === "mine" ? "on" : ""} onClick={() => setLogView("mine")}>Character</button>
                <button className={logView === "table" ? "on" : ""} onClick={() => setLogView("table")}>Table</button>
              </span>
            )}
            <button className="sbtn sm ghost mobonly" onClick={() => setLogOpen(!logOpen)}>{logOpen ? "Collapse" : "Expand"}</button>
            <button className="sbtn sm ghost mobonly" title="Hide the Game Log" onClick={() => { setLogHidden(true); setLogOpen(false); }}>Hide</button>
            {logView === "mine" && <button className="sbtn sm ghost" onClick={copyLog}>Copy</button>}
            {logView === "mine" && <button className="sbtn sm ghost" onClick={() => { if (confirm("Clear this character’s game log?")) setPlay({ log: [] }); }}>Clear</button>}
          </div>
          <div className="tray">
            <div className="dbtns">
              {[4, 6, 8, 10, 12, 20, 100].map((f) => (
                <button key={f} className="dbtn" onClick={() => {
                  const r = roll(`1d${f}`)!;
                  log({ title: `d${f}`, total: String(r.total), cls: f === 20 && r.total === 20 ? "crit" : "info", detail: esc(describeRolled(r)) });
                }}>d{f}</button>
              ))}
            </div>
            <form className="custom" onSubmit={(e) => {
              e.preventDefault();
              const r = roll(custom);
              if (!r) { log({ title: "Couldn’t read that roll", total: "", cls: "event", detail: `Try something like 2d6+1d4+3.` }); return; }
              log({ title: custom.replace(/\s+/g, ""), total: String(r.total), cls: "info", detail: esc(describeRolled(r)) });
            }}>
              <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. 2d6+1d4+3" aria-label="Custom roll" />
              <button className="sbtn sm">Roll</button>
            </form>
          </div>
          <div className="cards" aria-live="polite">
            {logView === "table" ? (
              tableLog.length === 0 ? <div className="empty">Rolls from everyone in the group show up here live.</div> : tableLog.map((e, i) => (
                <div key={e.id} className={`lc ${e.cls} ${i > 0 ? "old" : ""}`}>
                  <div className="ch"><span className="ct">{e.who}: {e.title}</span><span className="tm">{e.t}</span></div>
                  <div className="cb">
                    {e.total !== "" && <div className="big">{e.total}</div>}
                    <div className="det" dangerouslySetInnerHTML={{ __html: e.detail }} />
                  </div>
                </div>
              ))
            ) : p.log.length === 0 ? (
              <div className="empty">Rolls, damage, healing, conditions and rests are recorded here for this character. Click any ability, save, skill, attack or the dice above to roll.</div>
            ) : (
              p.log.map((e, i) => (
                <div key={e.id} className={`lc ${rolling === e.id ? "rolling" : e.cls} ${i === 0 && flash === e.id ? "flash" : ""} ${i > 0 ? "old" : ""}`}>
                  <div className="ch"><span className="ct">{e.title}</span><span className="tm">{e.t}</span></div>
                  {rolling === e.id ? (
                    <div className="cb"><div className="big">…</div><div className="det">Rolling…</div></div>
                  ) : (
                    <div className="cb">
                      {e.total !== "" && <div className="big">{e.total}</div>}
                      <div className="det" dangerouslySetInnerHTML={{ __html: e.detail }} />
                    </div>
                  )}
                  {rolling !== e.id && actions.current[e.id] && (
                    <div className="cact">
                      {actions.current[e.id].map((a, j) => (
                        <button key={j} className="sbtn sm" onClick={a.run}>{a.label}</button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      {layoutOpen && (
        <div className="smodal" role="dialog" aria-modal="true" aria-label="Layout" onClick={(e) => { if (e.target === e.currentTarget) setLayoutOpen(false); }}>
          <div className="mbox">
            <div className="mhead"><h3 className="disp">Layout</h3><button className="sbtn sm ghost" onClick={() => setLayoutOpen(false)}>✕ Close</button></div>
            <p className="note">Move boxes up or down to change their order on the sheet on this device. Changes apply right away. The wide-screen layout doesn’t change.</p>
            <div className="arrlist">
              {layout.map((k, i) => (
                <div key={k} className="arritem">
                  <span>{BOXES.find((b) => b[0] === k)?.[1] || k}</span>
                  <button className="sbtn sm ghost" aria-label="Move up" disabled={i === 0} onClick={() => moveBox(k, -1)}>▲</button>
                  <button className="sbtn sm ghost" aria-label="Move down" disabled={i === layout.length - 1} onClick={() => moveBox(k, 1)}>▼</button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="sbtn gold" onClick={() => setLayoutOpen(false)}>Done</button>
              <button className="sbtn ghost" onClick={() => saveLayout(null)}>Reset to default</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

