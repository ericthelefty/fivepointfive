import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import "../sheet.css";
import { useContent } from "../lib/store.tsx";
import { useCharacters } from "../lib/characters.tsx";
import { useSession } from "../lib/session.tsx";
import { cloud, supabase } from "../lib/backend.ts";
import { Md } from "../lib/md.tsx";
import { Btn, Tip, TipsOn, fitBubble } from "../lib/tip.tsx";
import { dice3dOn, playDice, setDice3d, setSound, soundOn } from "../lib/sound.ts";
import { applyForm, crLabel, formEligible, parseCreature, parseStatBlockMd, statBlockMd, type CreatureAction, type CreatureStats } from "../lib/creature.ts";
import { features, slug, spellInfo, stripMd, trimClassTable, type Entry } from "../lib/parse.ts";
import {
  ABBR, ABILITIES, SKILLS, SKILL_ABILITY, armorTable, classSpells, derive, featName, fmt, hitDie, speciesChoice, traits, wornGear,
  type Character,
  intro,
} from "../lib/rules.ts";
import { combineModes, d20 as d20Dice, describeRolled, parseExpr, roll as rollDice, type Mode, type Rolled } from "../lib/dice.ts";
import {
  CONDITION_EFFECTS, attackFor, avgDice, conditionMods, esc, playOf, type Weapon,
  timeNow, unarmedStrike, weaponTable, type Attack, type LogEntry,
  type ActiveEffect, type Companion, type PlayState, type RollContext,
} from "../lib/play.ts";
import { baseOf, catalog, inventoryOf, isActive, itemTitle, magicInfo, newItemId, type Coins, type Item } from "../lib/inventory.ts";
import { DamageDial, DIAL_STAGGER } from "../components/DamageDial.tsx";
import { DAMAGE_COLOR, DAMAGE_COLOR_LIGHT, damageChoices, damageName, damageTypeOf, type DamageType } from "../lib/damageDial.ts";
import InventoryPanel from "./InventoryPanel.tsx";
import { DetailsForm } from "../components/DetailsForm.tsx";
import { ScrollRow } from "../components/ScrollRow.tsx";
import { NARROW, useMedia } from "../lib/useMedia.ts";
import { CUSTOM_BACKGROUND, LIBRARY_PREFIX, SHEET_BACKGROUNDS, StoredThumb, libraryBackground, removeBackground, sheetBackground, uploadBackground, useLibraryBackgrounds, useStoredImage } from "../lib/backgrounds.ts";
import {
  advantageFor, computeModif, type ScrollUse, disadvantageFor, spellcastingOf, spellMinutes, spellPlan as basePlan, statusOf, treatRoll, weaponFits, weaponProficient,
  type ModifConvert, type ConvertSide, type WeaponInfo,
  type ModifAction, type ModifCost, type ModifCtx, type ModifToggle, type ModifTrigger, readBlocks, resolveRef, type ModifSummon, tableRowFor
} from "../lib/modif.ts";
import { casterEntry, casterInfoOf, casterKindOf, classFeatures, classInfos, classLabel, hitDicePools, patchClass, spellListClass, spellSlots, type ClassInfo, type Slot } from "../lib/multiclass.ts";

type Tab = "actions" | "effects" | "spells" | "features" | "conditions" | "inventory" | "background" | "notes";
const TAB_KEYS: Tab[] = ["actions", "effects", "spells", "features", "conditions", "inventory", "background", "notes"];
const readMsec = () => { try { return localStorage.getItem("fpf.msec") || ""; } catch { return ""; } };
const GRID_ICON = <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">{[0, 1, 2].flatMap((r) => [0, 1, 2].map((q) => <rect key={`${r}${q}`} x={3 + q * 7} y={3 + r * 7} width="4.6" height="4.6" rx="1" />))}</svg>;
const D20_ICON = <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M12 2.5l8.5 4.9v9.2L12 21.5l-8.5-4.9V7.4z" /><path d="M12 2.5v6.8M3.5 7.4l8.5 1.9 8.5-1.9M12 9.3l-5 8.6M12 9.3l5 8.6M7 17.9h10" /></svg>;
const SCROLL_ICON = <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true"><path d="M7 4h11a2 2 0 012 2v1h-3" /><path d="M17 6v12a2 2 0 01-2 2H6" /><path d="M7 4a2 2 0 00-2 2v11" /><path d="M3 17h10v1a2 2 0 002 2" /><path d="M9 9h5M9 12.5h5" /></svg>;
const CAMP_ICON = <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 3c2 3 4 4.5 4 8a4 4 0 01-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-2-1-4 0-7z" /><path d="M4 20l16-3M20 20L4 17" /></svg>;
type CardAction = { label: string; run: () => void };

/** Rules and controls explained in Explainer Mode (shown on hover; see the sheet's data-title handling). */
/** How long the dice stay alone on a Critical Hit, and how long the sheet takes to fade back in (ms). */
const CRIT_HOLD = 1400;
const CRIT_BACK = 700;

const HOW = {
  modeTail: "If something gives you both Advantage and Disadvantage, they cancel out and you roll one d20. Your pick here applies to every d20 roll until you set it back to Normal; the sheet also adds advantage or disadvantage from your conditions and features on its own.",
  dis: "Disadvantage: roll two d20s and keep the lower one.",
  normal: "Normal: roll one d20.",
  adv: "Advantage: roll two d20s and keep the higher one.",
  rests: "Short Rest: a 1-hour period of downtime. You can spend Hit Point Dice to regain Hit Points, and features that recharge on a Short Rest (like Pact Magic spell slots) come back. Long Rest: at least 8 hours, sleeping for at least 6 of them with no more than 2 hours of light activity. You regain all lost Hit Points and all spent Hit Point Dice, spell slots and features that recharge on a Long Rest come back, and your Exhaustion level decreases by 1. After you finish a Long Rest, you must wait at least 16 hours before starting another one.",
  heal: "Adds the amount you typed to your current Hit Points, up to your maximum. Healing someone at 0 Hit Points brings them back up and clears their Death Saving Throws.",
  damage: "Takes the amount you typed from your Temporary Hit Points first, then your Hit Points. At 0 Hit Points you fall Unconscious and start making Death Saving Throws; if the damage left over after reaching 0 equals or beats your Hit Point maximum, you die outright.",
  temp: "Temporary Hit Points act as a buffer against losing real Hit Points: damage takes them first. They can\u2019t be added together: if you have some and receive more, you decide whether to keep the ones you have or gain the new ones. They last until they\u2019re used up or you finish a Long Rest.",
  amount: "Type a number, then press Heal, Damage or + Temp. Enter takes damage.",
  attack: "Roll a d20 plus this attack bonus. If the total equals or beats the target's Armor Class, it hits. A natural 20 is a Critical Hit (roll the damage dice twice); a natural 1 always misses.",
  dmg: "Roll this weapon's damage. Roll it after the attack hits; on a Critical Hit, use the crit damage button on the attack's card in the game log instead.",
  die: "Roll this die on its own, with no modifier, for anything the sheet doesn't roll for you.",
  custom: "Type any dice, like 2d6+1d4+3, and press Roll.",
};
/** Explainer Mode: how a number on the sheet can be changed, by what it is. */
const CHANGE: Record<string, string> = {
  ab: "Set your scores in the builder (Ability scores step), and your background raises two or three of them. Ability Score Improvement (levels 4, 8, 12, 16 and 19), other feats and some magic items raise them later.",
  sv: "Your first class decides which saves you're proficient in, and that can't be swapped. A feat like Resilient adds one; the rest rises with the ability score.",
  sk: "Proficiencies come from your background, your class skill picks and feats like Skilled, all chosen in the builder. Raising the ability score raises the skill too.",
  pp: "It rises with Wisdom, with proficiency in Perception, and with features like the Observant feat.",
  pb: "It only goes up as your total character level does.",
  init: "Raise your Dexterity, or take the Alert feat, which adds your Proficiency Bonus.",
  speed: "Your species sets it. Conditions, heavy armor you're too weak for and some features change it while they apply.",
  ac: "Equip different armor or a shield in your Inventory, raise your Dexterity, or use a feature like Unarmored Defense. Magic armor and items can add to it.",
  dc: "It rises with your spellcasting ability and your Proficiency Bonus; some magic items add to it.",
  hp: "It goes up each time you level up, and when your Constitution rises (that counts for every level you have). The Tough feat adds 2 per level.",
  insp: "Tap the ★ star (beside the Next roll box, or at the top right on a phone) when you gain it, and again when you spend it. A Long Rest gives it back if a feature says so, like the Human's Resourceful trait.",
  def: "Defenses come from your species, class, feats and magic items, and some only while a feature or spell is active.",
  sense: "Senses come from your species and some features, magic items and spells.",
  passive: "It rises with the ability, with proficiency in the skill, and with features that add to it.",
  lang: "Choose your two origin languages here or in the builder. Your class, background, feats and some magic items can teach you more.",
  tool: "Tool proficiencies come from your background, your class and feats like Skilled, chosen in the builder.",
  atk: "Equip a different weapon in your Inventory. Finesse weapons can use Dexterity instead of Strength, and you only add your Proficiency Bonus with weapons you're trained in.",
};

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

/** Thrown instead of rolling while Explainer Mode is on on a phone or tablet, where a tap only explains. */
class RollBlocked extends Error {}

/** Grow the Notes box to fit everything in it, so it never needs its own scrollbar. */
function fitNotes(el: HTMLTextAreaElement | null) {
  if (!el || !el.offsetParent) return; // hidden (another section is showing): fitted when it's shown
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
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
  // Explainer Mode on a phone or tablet turns every dice roll off, whichever button asked for it
  const noRolls = useRef(false);
  const lastTap = useRef<HTMLElement | null>(null);
  const roll: typeof rollDice = (...a) => { if (noRolls.current) throw new RollBlocked("Dice rolling is off while Explainer Mode is on."); return rollDice(...a); };
  const d20: typeof d20Dice = (...a) => { if (noRolls.current) throw new RollBlocked("Dice rolling is off while Explainer Mode is on."); return d20Dice(...a); };
  useEffect(() => {
    const quiet = (e: ErrorEvent | PromiseRejectionEvent) => {
      const err = "reason" in e ? e.reason : e.error;
      if (!(err instanceof RollBlocked)) return;
      e.preventDefault();
      // say why nothing rolled, in the same bubble, beside what was tapped
      const el = lastTap.current;
      if (el?.isConnected) setExAt({ key: "t:Dice rolling is off while Explainer Mode is on, so a tap only explains. Turn Explainer Mode off to roll.", rect: el.getBoundingClientRect(), el });
    };
    window.addEventListener("error", quiet);
    window.addEventListener("unhandledrejection", quiet);
    return () => { window.removeEventListener("error", quiet); window.removeEventListener("unhandledrejection", quiet); };
  }, []);
  // take in changes made elsewhere (the GM's encounter tracker, this character open on another device, another tab),
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
  const [tab, setTab] = useState<Tab>(() => (TAB_KEYS.includes(readMsec() as Tab) ? readMsec() : "actions") as Tab);
  /** Phone layout: which section fills the screen ("tab" means the current sheet tab), and which bottom sheet is open. */
  const [msec, setMsec] = useState<string>(() => { const v = readMsec(); return TAB_KEYS.includes(v as Tab) ? "tab" : ["abil", "skills", "profs"].includes(v) ? v : "abil"; });
  const [msheet, setMsheet] = useState<"" | "menu" | "dice" | "hp" | "rest">("");
  /** The newest Game Log entry the player has seen, for the unread badge on the phone's log button. */
  const logSeen = useRef<string | undefined>(undefined);
  const tabFirst = useRef(true);
  useEffect(() => { if (tabFirst.current) { tabFirst.current = false; return; } setMsec("tab"); }, [tab]);
  // the Notes box fits its text whenever it's shown or the notes change (a live update, a narrower screen)
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const notesText = c?.notes;
  useEffect(() => {
    const el = notesRef.current;
    if (!el) return;
    fitNotes(el);
    const ro = new ResizeObserver(() => fitNotes(el));
    ro.observe(el.parentElement || el);
    return () => ro.disconnect();
  }, [tab, msec, notesText]);
  useEffect(() => { try { localStorage.setItem("fpf.msec", msec === "tab" ? tab : msec); } catch { /* private browsing */ } }, [msec, tab]);
  const [hpAmt, setHpAmt] = useState("");
  /** Explainer Mode: hovering over a number shows how it's worked out. */
  const [explain, setExplain] = useState(false);
  const [exAt, setExAt] = useState<{ key: string; rect: DOMRect; el: HTMLElement }>();
  const rootRef = useRef<HTMLDivElement>(null);
  // no browser tooltips on the sheet: each title moves to data-title, which Explainer Mode shows in its own bubble
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const stash = (el: Element) => { const t = el.getAttribute("title"); if (t) { el.setAttribute("data-title", t); el.removeAttribute("title"); } };
    root.querySelectorAll("[title]").forEach(stash);
    const mo = new MutationObserver((ms) => ms.forEach((m) => {
      if (m.type === "attributes") stash(m.target as Element);
      else m.addedNodes.forEach((n) => { if (n instanceof Element) { stash(n); n.querySelectorAll("[title]").forEach(stash); } });
    }));
    mo.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["title"] });
    return () => mo.disconnect();
  });
  const [custom, setCustom] = useState("");
  const [logOpen, setLogOpen] = useState(false);
  /** The trade picked in each Convert row (index into its options). */
  const [convPick, setConvPick] = useState<Record<string, number>>({});
  /** The option picked for each choose-one action (Cunning Action, Patient Defense…). */
  const [actPick, setActPick] = useState<Record<string, number>>({});
  const [areaPick, setAreaPick] = useState<Record<string, number>>({});
  /** The attack whose last roll was a critical hit, until the next roll: its Damage button rolls crit damage. */
  const [critFor, setCritFor] = useState<{ name: string; versatile: boolean }>();
  /** After a Critical Hit, until your next attack or d20 roll: what has already had its dice doubled for that hit
   *  (each smite and "On a hit" extra doubles once, as the attack's own extra damage). */
  const [critHit, setCritHit] = useState<{ used: string[] }>();
  /** Whether this extra damage rolls its dice twice for the Critical Hit you just scored (and mark it used). */
  const takeCrit = (key: string) => {
    if (!critHit || critHit.used.includes(key)) return false;
    setCritHit((cur) => (cur ? { used: [...cur.used, key] } : cur));
    return true;
  };
  /** A smite: a spell you cast right after hitting, adding its damage to that hit (Divine Smite, Searing Smite). */
  const isSmite = (sp: Entry) => /smite/i.test(sp.name) && /immediately after hitting/i.test(sp.fields["casting time"] || "");
  // phones and tablets open with the Game Log hidden (desktop always shows it)
  const narrow = useMedia(NARROW);
  noRolls.current = explain && narrow;
  const [logHidden, setLogHidden] = useState(() => typeof window.matchMedia === "function" && window.matchMedia(NARROW).matches);
  // turning a tablet or resizing the window into the phone layout starts with the Game Log put away
  const wasNarrow = useRef(narrow);
  useEffect(() => { if (narrow && !wasNarrow.current) { setLogHidden(true); setLogOpen(false); } wasNarrow.current = narrow; }, [narrow]);
  const [layout, setLayout] = useState<string[]>(loadLayout);
  const [layoutOpen, setLayoutOpen] = useState(false);
  // follow-up rolls waiting their turn (Flurry of Blows' second strike), dropped if the sheet closes
  const later = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => later.current.forEach(clearTimeout), []);

  // the rest menu (desktop): the campfire button opens Short Rest and Long Rest
  const [restOpen, setRestOpen] = useState(false);
  const restRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!restOpen) return;
    const away = (e: Event) => { if (restRef.current && !restRef.current.contains(e.target as Node)) setRestOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setRestOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [restOpen]);
  // the backdrop picker in the sheet's toolbar
  const [bgOpen, setBgOpen] = useState(false);
  const bgRef = useRef<HTMLDivElement>(null);
  // the character's own uploaded backdrop, if any (downloaded from private storage on a shared instance)
  const customUrl = useStoredImage(c?.customBackground);
  // images an admin added to the instance's library, and built-in ones an admin hid
  const library = useLibraryBackgrounds();
  const hiddenBgs = session.settings.hidden_backgrounds || [];
  const libPick = libraryBackground(c?.sheetBackground, library);
  const libUrl = useStoredImage(libPick ? `storage:${libPick.path}` : undefined);
  const backdropUrl = c?.sheetBackground === CUSTOM_BACKGROUND ? customUrl : libPick ? libUrl : sheetBackground(c?.sheetBackground, hiddenBgs)?.image;
  const [bgBusy, setBgBusy] = useState(false);
  const [bgError, setBgError] = useState("");
  const bgFile = useRef<HTMLInputElement>(null);
  // while a backdrop shows, the body's own background would paint over it; the page background stays on <html>
  const hasBackdrop = !!backdropUrl;
  // opened from Print on the Characters tab: print once the sheet has loaded, then go back
  const [params] = useSearchParams();
  const nav = useNavigate();
  const printNow = !!c && content.ready && params.get("print") === "1";
  useEffect(() => {
    if (!printNow) return;
    const back = () => {
      if ((window.history.state as { idx?: number } | null)?.idx) nav(-1);
      else nav(`/sheet/${id}`, { replace: true });
    };
    const t = setTimeout(() => { window.addEventListener("afterprint", back, { once: true }); window.print(); }, 700);
    return () => { clearTimeout(t); window.removeEventListener("afterprint", back); };
  }, [printNow]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!hasBackdrop) return;
    document.body.classList.add("sheetbg-on");
    return () => document.body.classList.remove("sheetbg-on");
  }, [hasBackdrop]);
  useEffect(() => {
    if (!bgOpen) return;
    const away = (e: Event) => { if (bgRef.current && !bgRef.current.contains(e.target as Node)) setBgOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setBgOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [bgOpen]);
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
  // a Critical Hit: "flash" (no dice shown), or the sheet steps aside so only the dice show ("out"), then comes back ("back")
  const [critFx, setCritFx] = useState<false | "flash" | "out" | "back">(false);
  const critTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => critTimers.current.forEach(clearTimeout), []);
  // the boxes that step aside on a Critical Hit: the sheet's top-level pieces, looking through display: contents wrappers
  const critBoxes = useRef<HTMLElement[]>([]);
  useEffect(() => {
    const root = rootRef.current;
    if (critFx === "out" && root) {
      const found: HTMLElement[] = [];
      const walk = (el: Element) => {
        for (const ch of Array.from(el.children)) {
          if (!(ch instanceof HTMLElement) || ch.matches(".dice3d, .sheetbg, input[type=file]")) continue;
          if (getComputedStyle(ch).display === "contents") walk(ch);
          else found.push(ch);
        }
      };
      walk(root);
      critBoxes.current = found;
      found.forEach((el) => { el.classList.remove("critback"); el.classList.add("crithide"); });
    } else if (critFx === "back") {
      critBoxes.current.forEach((el) => { el.classList.add("critback"); el.classList.remove("crithide"); });
    } else if (!critFx) {
      critBoxes.current.forEach((el) => el.classList.remove("crithide", "critback"));
      critBoxes.current = [];
    }
  }, [critFx]);
  /** Dice tumbling onto the sheet after a roll (the "3D dice" toggle). */
  const [dice3d, setDice3dState] = useState(dice3dOn);
  const [diceFx, setDiceFx] = useState<{ key: string; dice: { sides: number; value: number; kept: boolean }[]; crit: boolean; mod: number; tilt: number; dial?: { type: DamageType; total: number }[]; hold?: number; ms?: number }>();
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
          <span key={r.sp.id}>{j ? ", " : ""}<button className="linkish" title={`Opens ${r.sp.name}’s full description, with how to cast it.`} onClick={() => setDrawer({ kind: "spell", id: r.sp.id, via: r.g ? r.g.source : r.k ? `k:${r.k.info.index}` : undefined })}>{r.sp.name}</button> <span className="mut">({ord(r.lvl)})</span></span>
        ))}
      </div>
    );
  };
  /** The slide-out details panel: a spell (with the level to cast it at) or a feature. */
  const [drawer, setDrawer] = useState<{ kind: "spell"; id: string; via?: string; level?: number; back?: number } | { kind: "feature"; title: string; sub: string; md: string; entryId?: string } | { kind: "manage"; k: number }>();
  /** Manage Spells panel: search text, level filter and whether to show only this caster's spells. */
  const [mgr, setMgr] = useState<{ q: string; lvl: number | "all"; view: "all" | "mine" | "book" }>({ q: "", lvl: "all", view: "all" });
  const [spellQ, setSpellQ] = useState("");
  const [spellLvl, setSpellLvl] = useState<string>("all");
  /** Actions tab filter chip. */
  const [featFilter, setFeatFilter] = useState<"all" | "class" | "species" | "feats">("all");
  const [actFilter, setActFilter] = useState<"all" | "attack" | "action" | "bonus" | "reaction" | "other" | "limited">("all");
  const [memPick, setMemPick] = useState<{ out: string; in: string }>({ out: "", in: "" });
  /**
   * The damage type menu: a damage roll that lets the player choose its type ("Bludgeoning or Necrotic or ...") opens
   * this by the button pressed, and picking a type rolls the damage as that type. The type picked last for each
   * weapon or spell is highlighted next time.
   */
  const [dmgPick, setDmgPick] = useState<{ x: number; y: number; above: boolean; title: string; types: DamageType[]; go: (t: DamageType) => void }>();
  const lastDmgType = useRef(new Map<string, DamageType>());
  const lastPress = useRef<DOMRect | undefined>(undefined);
  useEffect(() => {
    const press = (e: PointerEvent) => { const b = (e.target as HTMLElement).closest?.("button"); if (b && !b.closest(".dmgpick")) lastPress.current = b.getBoundingClientRect(); };
    window.addEventListener("pointerdown", press, true);
    return () => window.removeEventListener("pointerdown", press, true);
  }, []);
  useEffect(() => {
    if (!dmgPick) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !(e.target as HTMLElement).closest?.(".dmgpick")) setDmgPick(undefined);
    };
    const gone = () => setDmgPick(undefined);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    window.addEventListener("scroll", gone, true);
    return () => { window.removeEventListener("mousedown", close); window.removeEventListener("keydown", close); window.removeEventListener("scroll", gone, true); };
  }, [dmgPick]);
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
  // whenever a sheet opens (or reloads), a band of light sweeps across everything that rolls
  const cid = c?.id;
  useEffect(() => {
    if (!cid || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const added: HTMLElement[] = [];
    const start = setTimeout(() => {
      const els = Array.from(document.querySelectorAll<HTMLElement>(".sheetv .smain :is(.abm, .ab .sv, .sk, button.stat, table.atks button), .sheetv .dbtn"));
      els.forEach((el, i) => {
        const sh = document.createElement("span");
        sh.className = "shim";
        sh.setAttribute("aria-hidden", "true");
        sh.style.setProperty("--d", `${Math.min(i * 40, 1400)}ms`);
        el.classList.add("shimhost");
        el.appendChild(sh);
        added.push(sh);
      });
    }, 250);
    const end = setTimeout(() => added.forEach((sh) => { sh.parentElement?.classList.remove("shimhost"); sh.remove(); }), 3200);
    return () => { clearTimeout(start); clearTimeout(end); added.forEach((sh) => { sh.parentElement?.classList.remove("shimhost"); sh.remove(); }); };
  }, [cid]);
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
  // which classes the slots come from (Explainer Mode)
  const pactClass = casters.find((k) => casterKindOf(k.info) === "pact")?.info.cls.name;
  const slotClasses = casters.filter((k) => casterKindOf(k.info) !== "pact").map((k) => k.info.cls.name).join(" and ");
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
    const r = withFlatBonuses(a, ranged);
    // damage that every hit adds by itself (Radiant Strikes, a Flame Tongue's fire): rolled with the attack's damage
    const unarmed = /^unarmed strike/i.test(a.name);
    const always = fx.triggers.filter((t) => t.onHit && t.damage?.length && (t.onHit.itemId ? t.onHit.itemId === a.itemId : ranged ? t.onHit.ranged : unarmed ? t.onHit.unarmed : t.onHit.melee));
    if (!always.length) return r;
    const dice = always.flatMap((t) => t.damage!).filter((x) => x.dice);
    const typeOf = (x: { type: string }) => (!x.type || x.type === "weapon" ? r.type.split(",")[0].toLowerCase() : x.type);
    const more = dice.map((x) => `+${x.dice}`).join("");
    return {
      ...r, baseDamage: r.damage, baseVersatile: r.versatile,
      damage: `${r.damage}${more}`, versatile: r.versatile ? `${r.versatile}${more}` : r.versatile,
      extra: dice.map((x) => `${x.dice} ${typeOf(x)}`).join(" + "),
      note: [r.note, ...always.map((t) => t.name)].filter(Boolean).join(" · "),
    };
  }
  function withFlatBonuses(a: Attack, ranged: boolean): Attack {
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
    const bn = baseOf(it, infoOf(it));
    const w = it.equipped && it.qty > 0 && bn ? weapons.find((x) => x.name === bn) : undefined;
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
      return withBonuses({ ...attackFor({ ...w, name: itemTitle(it, undefined, content.byId(it.ref || "")?.name) }, d, weaponProficient(fx, { ...w, tags: it.tags }), { ...wo.opts, mastered: fx.masteries.some((m) => slug(m) === slug(w.name)) }), itemId: it.id, dieFloor: wo.dieFloor, maximize: wo.maximize }, /ranged/i.test(w.category));
    }),
    (() => {
      const wo = weaponOpts({ id: "unarmed-strike", name: "Unarmed Strike", category: "Unarmed", properties: "", unarmed: true });
      return withBonuses({ ...unarmedStrike(d, wo.opts), maximize: wo.maximize }, false);
    })(),
  ];
  /** An item's charges, right on its attack row (Staff of Striking): how many are left, with buttons to spend or restore one. */
  const chargesOf = (itemId?: string) => {
    const r = itemId ? resources.find((x) => x.itemId === itemId && x.key === `item:${itemId}`) : undefined;
    if (!r) return null;
    const used = p.resUsed[r.key] || 0;
    const step = (n: number) => setPlay((cur) => ({ resUsed: { ...cur.resUsed, [r.key]: Math.min(r.max, Math.max(0, (cur.resUsed[r.key] || 0) + n)) } }));
    return (
      <div className="chg" title={`${refreshText(r)}`.trim()}>
        <span className="sl">Charges</span> <b>{r.max - used}</b>/{r.max}
        <button className="sbtn sm ghost" aria-label="Spend a charge" disabled={used >= r.max} onClick={() => step(1)}>−</button>
        <button className="sbtn sm ghost" aria-label="Restore a charge" disabled={!used} onClick={() => step(-1)}>+</button>
      </div>
    );
  };
  const setInventory = (items: Item[], coins: Coins) => {
    dirty.current = true;
    setC((prev) => (prev ? { ...prev, inventory: items, coins } : prev));
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

  const log = (e: Omit<LogEntry, "id" | "t">, acts?: CardAction[], dial?: { type: DamageType; total: number }[]) => {
    const entry: LogEntry = { ...e, id: Math.random().toString(36).slice(2, 9), t: timeNow() };
    // any roll after a critical hit ends it: the Damage button goes back to normal damage
    if (["test", "atk", "crit", "fumble", "dmg", "heal", "roll"].includes(entry.cls)) setCritFor(undefined);
    // a new attack or d20 roll ends the last Critical Hit for smites and "On a hit" extras
    if (["test", "atk", "fumble"].includes(entry.cls)) setCritHit(undefined);
    if (acts?.length) actions.current[entry.id] = acts;
    setPlay((cur) => ({ log: [entry, ...cur.log].slice(0, 150) }));
    setFlash(entry.id);
    let hold = 0;
    let shown = false;
    if (["test", "atk", "crit", "fumble", "dmg", "heal", "roll"].includes(entry.cls)) {
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
          // a damage roll's dice stay a little longer, while the damage dial lights up its types one after another
          const lit = dial?.length ? new Set(dial.map((x) => x.type)).size : 0;
          const land = dice.length * 60 + 450;
          const ms = lit ? land + (lit - 1) * DIAL_STAGGER + 2600 : 1700; // each type's animation, its number, a moment to read it
          setDiceFx({ key: entry.id, dice, crit: entry.cls === "crit", mod, tilt, dial: lit ? dial : undefined, hold: land, ms });
          clearTimeout(diceTimer.current);
          diceTimer.current = setTimeout(() => setDiceFx(undefined), ms);
          // keep the total out of the log until the modifier appears beside the dice (the same moment)
          if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
            shown = true;
            hold = dice.length * 60 + 450;
            setRolling(entry.id);
            clearTimeout(holdTimer.current);
            holdTimer.current = setTimeout(() => setRolling(undefined), hold);
          }
        }
      }
    }
    // a new roll brings the sheet straight back from a Critical Hit
    critTimers.current.forEach(clearTimeout);
    critTimers.current = [];
    if (entry.cls !== "crit") setCritFx(false);
    else if (shown) {
      // once the dice land, every box fades away and only the dice stay, then the sheet fades back in
      const at = (ms: number, f: () => void) => critTimers.current.push(setTimeout(f, ms));
      at(hold, () => setCritFx("out"));
      at(hold + CRIT_HOLD, () => setCritFx("back"));
      at(hold + CRIT_HOLD + CRIT_BACK, () => setCritFx(false));
      clearTimeout(diceTimer.current);
      diceTimer.current = setTimeout(() => setDiceFx(undefined), hold + CRIT_HOLD + CRIT_BACK);
    } else critTimers.current.push(setTimeout(() => { setCritFx("flash"); critTimers.current.push(setTimeout(() => setCritFx(false), 700)); }, hold));
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
  /**
   * Each damage type's share of a roll, for the damage dial. `pieces` (the expression of each type, in order) when the
   * caller knows them; otherwise worked out from the type: "Slashing", or a weapon's "Slashing, plus 2d6 Fire".
   */
  const damageShares = (r: Rolled, type: string, pieces?: { expr: string; type: string }[]) => {
    let ps = pieces;
    if (!ps) {
      const m = type.match(/^(.*?),\s*plus\s+(.*)$/i);
      if (m) {
        const extras = m[2].split(/\s*(?:\+|,|\band\b)\s*(?=\d)/).map((x) => x.trim().match(/^(\d*d\d+(?:\s*[+-]\s*\d+)?)\s+(.*)$/)).filter(Boolean) as RegExpMatchArray[];
        const extraTerms = extras.reduce((n, x) => n + (parseExpr(x[1])?.length || 0), 0);
        const all = parseExpr(r.expr)?.length || 0;
        ps = [{ expr: `${"1+".repeat(Math.max(0, all - extraTerms - 1))}1`, type: m[1] }, ...extras.map((x) => ({ expr: x[1], type: x[2] }))];
      } else ps = [{ expr: r.expr, type }];
    }
    const out: { type: DamageType; total: number }[] = [];
    let i = 0;
    ps.forEach((x, n) => {
      const len = n === ps!.length - 1 ? r.parts.length - i : parseExpr(x.expr)?.length || 0;
      const total = r.parts.slice(i, i + len).reduce((a, b) => a + b.value, 0);
      i += len;
      const t = damageTypeOf(x.type);
      if (t) out.push({ type: t, total: Math.max(0, total) });
    });
    return out;
  };
  type DmgMods = { minDie?: number; maximize?: string; floorSource?: string };
  /** Roll damage; when its type is a choice, open the damage type menu first and roll as the type picked. */
  const rollDamage = (title: string, expr: string, crit: boolean, type = "", heal = false, mods: DmgMods = {}, pieces?: { expr: string; type: string }[]) => {
    const choicePiece = pieces?.findIndex((x) => damageChoices(x.type).length > 1) ?? -1;
    const types = heal ? [] : choicePiece >= 0 ? damageChoices(pieces![choicePiece].type) : damageChoices(type);
    if (types.length < 2) return rollDamageNow(title, expr, crit, type, heal, mods, pieces);
    const r = lastPress.current;
    const h = 46 + 38 * types.length;
    const above = !!r && r.bottom + 4 + h > window.innerHeight - 8;
    const x = r ? Math.max(8, Math.min(r.left, window.innerWidth - 228)) : window.innerWidth / 2 - 110;
    const y = r ? (above ? Math.max(8, r.top - 4 - h) : r.bottom + 4) : window.innerHeight / 2 - h / 2;
    setDmgPick({
      x, y, above, title, types,
      go: (t) => {
        lastDmgType.current.set(title.replace(/ \(two hands\)$/, ""), t);
        setDmgPick(undefined);
        const name = damageName(t);
        if (choicePiece >= 0) {
          const ps = pieces!.map((p, i) => (i === choicePiece ? { ...p, type: name } : p));
          rollDamageNow(title, expr, crit, ps.map((p) => p.type).filter(Boolean).join(" + "), heal, mods, ps);
        } else rollDamageNow(title, expr, crit, type.replace(/^.*?(?=,\s*plus\s+|$)/i, name), heal, mods, pieces);
      },
    });
  };
  const rollDamageNow = (title: string, expr: string, crit: boolean, type = "", heal = false, mods: DmgMods = {}, pieces?: { expr: string; type: string }[]) => {
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
    }, undefined, heal ? undefined : damageShares(r, type, pieces));
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
    buttons: { label: string; run: () => void; disabled?: boolean; ghost?: boolean; why?: string; ex?: string }[];
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
  /** Special attacks from your species, class, subclass or feats (Breath Weapon): they deal damage and take an action or one of your attacks, so they go with your attacks. */
  const isSpecialAttack = (a: ModifAction) => !a.id.startsWith("item:") && !a.cast && !a.heal && !a.creates && !!a.damage?.some((x) => x.dice) && !isBonus(a.activation) && !/reaction/i.test(a.activation);
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
            { label: "Attack", ex: `t:The extra attack from fighting with two Light weapons: after you attack with one Light weapon, you can take a Bonus Action to attack with a different Light weapon in your other hand. ${HOW.attack}`, run: () => attack({ ...a, name: `${a.name} (extra attack)`, damage: dmg }) },
            { label: "Damage", ghost: true, ex: `t:Rolls the extra attack’s damage, ${dmg} ${a.type}. You don’t add your ability modifier to it unless it’s negative (or you have a feature like Two-Weapon Fighting).`, run: () => rollDamage(`${a.name} (extra attack)`, dmg, false, a.type, false, dmgMods(a, false)) },
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
          buttons: [{ label: n > 1 ? `Attack ×${n}` : "Attack", ex: `do:a:${a.id}`, disabled: !ok, why: whyNot(a.cost, a.name), run: () => {
            if (a.cost) setPlay((cur) => pay(a.cost, cur));
            // one strike at a time, so each gets its own dice animation and log entry
            attack(ua);
            const gap = dice3dOn() && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 1800 : 450;
            for (let i = 1; i < n; i++) later.current.push(setTimeout(() => attack(ua), gap * i));
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
          { label: a.cast ? "Cast" : a.creates ? (held ? "Replace" : "Use") : "Use", ex: `do:a:${a.id}`, disabled: (op ? !op.ok : !ok) || (!!a.cast?.scroll && !scrollUse(a.cast.scroll).readable), why: actWhy(a, op), run: () => runFeature(a, op?.i) },
          ...(held ? [{ label: "End bond", ghost: true, ex: `t:Ends the bond with ${held.name}: it stops being your ${a.name} item. You can conjure or bond another later.`, run: () => releaseItem(a) }] : []),
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
          ? [{ label: on ? "Change form" : "Choose form", ex: `do:t:${t.key}`, disabled: !on && !ok, why: whyNot(t.cost, t.name), run: () => openForms() }]
          : [{ label: on ? "Active" : "Use", ex: `do:t:${t.key}`, disabled: on || !ok, why: on ? `${t.name} is already active. End it under Effects to use it again.` : whyNot(t.cost, t.name), run: () => switchOn(t) }],
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
          buttons: [{ label: lvl && L && L > lvl ? `Cast (level ${L} slot)` : "Cast", ex: `do:sp:${lvl && L ? L : "cast"}:${sp.id}`, disabled: L === undefined, why: L === undefined ? slotWhy(lvl) : undefined, run: () => castSpell(sp, L || 0, k) }],
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
      if (g.atWill || lvl === 0) buttons.push({ label: "Cast", ex: `do:sp:${lvl ? "atwill" : "cast"}:${g.spell.id}`, run: () => castSpell(g.spell, lvl, null, opt) });
      if (free) buttons.push({ label: "Cast free", ex: `do:sp:free:${g.spell.id}`, disabled: freeLeft <= 0, why: freeWhy(free, freeLeft), run: () => castSpell(g.spell, lvl, null, { ...opt, pay: { key: free.key, amount: 1 } }) });
      if (lvl > 0 && !g.atWill && slots.length) buttons.push({ label: "Use a slot", ghost: true, ex: `do:sp:${L ?? "slot"}:${g.spell.id}`, disabled: L === undefined, why: L === undefined ? slotWhy(lvl) : undefined, run: () => L && castSpell(g.spell, L, null, { mod: opt.mod, dc: g.dc, via: g.source }) });
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
  /** The attack roll, which is the same however the weapon is held; its card offers the damage one- and two-handed. */
  const attack = (a: Attack) => {
    const cm = conditionMods(p, { kind: "attack" });
    cm.adv.push(...advantageFor(fx, { kind: "attack", ability: a.ability }));
    cm.dis.push(...disadvantageFor(fx, { kind: "attack", ability: a.ability }));
    const m = combineModes(mode === "adv" || cm.adv.length > 0, mode === "dis" || cm.dis.length > 0);
    const extra = takeBonus();
    const r = d20(a.toHit - cm.penalty, m, extra ? extra.replace(/^\+/, "") : undefined);
    // Improved Critical and similar: a lower natural roll is also a Critical Hit
    const crit = r.kept >= d.critRange;
    const critNote = crit && r.kept < 20 ? ` (${d.critRange}–20)` : "";
    const why = [...(mode !== "normal" ? [mode === "adv" ? "Advantage (roll bar)" : "Disadvantage (roll bar)"] : []), ...cm.adv.map((x) => `Advantage: ${x}`), ...cm.dis.map((x) => `Disadvantage: ${x}`)];
    log(
      {
        title: `${a.name}: attack`,
        total: String(r.total),
        cls: crit ? "crit" : r.fumble ? "fumble" : "atk",
        detail:
          `${eqHtml(r.kept, r.total - r.kept)}d20 [${r.rolls.map((x) => (r.rolls.length > 1 && x === r.kept ? `<b>${x}</b>` : x)).join(", ")}] ${fmt(a.toHit)}${cm.penalty ? ` −${cm.penalty} exhaustion` : ""}${r.extra ? ` ${esc(describeRolled(r.extra))}` : ""}` +
          (why.length ? `<div>${esc(why.join(" · "))}</div>` : "") +
          (crit ? `<div class="vd crit">Critical hit!${critNote}</div>` : r.fumble ? `<div class="vd bad">Natural 1: miss</div>` : ""),
      },
      [
        { label: crit ? `Roll crit damage (${a.damage})` : `Roll damage (${a.damage})`, run: () => rollDamage(a.name, a.damage, crit, a.extra ? `${a.type}, plus ${a.extra}` : a.type, false, dmgMods(a, false)) },
        ...(a.versatile ? [{ label: crit ? `Crit, two hands (${a.versatile})` : `Two hands (${a.versatile})`, run: () => rollDamage(`${a.name} (two hands)`, a.versatile!, crit, a.extra ? `${a.type}, plus ${a.extra}` : a.type, false, dmgMods(a, true)) }] : []),
      ],
    );
    if (crit) setCritFor({ name: a.name, versatile: false });
    setCritHit(crit ? { used: [] } : undefined);
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
    log({ title: "Long rest", total: "", cls: "event", detail: `HP restored to ${hpMax}. All Hit Dice, spell slots and class resources regained.${p.exhaustion ? " Exhaustion reduced by 1." : ""}${inspire && !p.inspiration ? ` ${esc(inspire.source)}: you gain Heroic Inspiration.` : ""}${notes.map((x) => `<div>${esc(x)}</div>`).join("")}${(p.active || []).length ? `<div>Ended: ${esc((p.active || []).map((x) => x.name).join(", "))}</div>` : ""}` },
      restSwaps.length ? [{ label: `Change ${restSwaps.map((pc) => pc.feature).filter((x, i, a) => a.indexOf(x) === i).join(", ")}`, run: openRestChoices }] : undefined);
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
  /** Explainer Mode: where a limited use comes from, in a new player's words ("from your Paladin class: Paladin's Smite"). */
  const sourceText = (r: { name: string; entryId: string; itemId?: string }) => {
    if (r.entryId === "custom") return "One of your own features (added under Features & Feats).";
    if (r.itemId) { const it = inv.items.find((x) => x.id === r.itemId); return `From an item you carry: ${it?.name || content.byId(r.entryId)?.name || "a magic item"}.`; }
    const e = content.byId(r.entryId);
    if (!e) return "";
    const base = r.name.replace(/\s*\(.*\)$/, "").toLowerCase();
    const feat = ["Class", "Subclass"].includes(e.type)
      ? features(e).find((f) => f.name.toLowerCase() === base) || features(e).find((f) => f.md.toLowerCase().includes(base))
      : undefined;
    const owner = infos.find((i) => i.cls.id === e.id || i.sub?.id === e.id);
    const what = e.type === "Class" ? `your ${e.name} class`
      : e.type === "Subclass" ? `your ${e.name} subclass${owner ? ` (${owner.cls.name})` : ""}`
      : e.type === "Species" ? `being ${/^[aeiou]/i.test(e.name) ? "an" : "a"} ${e.name}`
      : e.type === "Background" ? `your ${e.name} background`
      : e.type === "Feat" ? `the ${e.name} feat`
      : e.name;
    return `From ${what}${feat && feat.name.toLowerCase() !== base ? `: the ${feat.name} feature` : ""}${feat ? ` (gained at ${owner ? owner.cls.name : e.name} level ${feat.level})` : ""}.`;
  };
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
  const runFeature = (a: ModifAction, opt?: number, now?: { roll?: boolean; area?: string }) => {
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
      const area = now?.area || (a.areas?.length === 1 ? a.areas[0] : "");
      log({
        title: a.name, total: "", cls: "event",
        detail: [area ? esc(area) : "", a.save ? `${a.save.dc ? `DC <b>${a.save.dc}</b> ` : ""}${esc(a.save.ability)} save${a.save.success === "half" ? " (half on a success)" : ""}` : "", a.options ? `Choose: ${esc(a.options.join(", "))}` : "", now?.roll ? "" : esc(a.text || ""), after.slice(3), a.consume ? "Used up." : ""].filter(Boolean).map((x) => `<div>${x}</div>`).join(""),
      }, now?.roll ? [] : acts);
      // used from the Attacks table: roll the damage straight away
      if (now?.roll) for (const x of (a.damage || []).filter((y) => y.dice)) rollDamage(a.name, x.dice, false, x.type);
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
      scores: Object.fromEntries(ABILITIES.map((a) => [a, 10])), saves: {}, skills: {}, senses: "", languages: "", gear: [], defenses: [], traits: [], actions: [], bonusActions: [], reactions: [],
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
        {a.damage.length > 0 && <button className="sbtn sm ghost" title={HOW.dmg} onClick={() => rollDamage(`${a.name} (${cr.name})`, a.damage.map((x) => x.expr).join("+"), false, a.damage.map((x) => x.type).join(" + "), false, {}, a.damage.map((x) => ({ expr: x.expr, type: x.type })))}>{a.damage.map((x) => x.expr).join(" + ")}</button>}
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
  const main0 = (t: (typeof fx.triggers)[number]) => t.damage![0];
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
              // dice paid for with a resource the player picks how much of (Staff of Striking: 1d6 Force per charge, up to 3)
              const perUnit = main0(t).dice.replace(/\s+/g, "").match(/^dice\(cost\.\w+,d(\d+)\)$/);
              const payRes = perUnit && t.cost ? resources.find((r) => r.key === t.cost!.key) : undefined;
              const payLeft = payRes ? payRes.max - (p.resUsed[payRes.key] || 0) : 0;
              const payMax = payRes ? Math.min(t.cost!.max ?? t.cost!.amount, payLeft) : 0;
              const payN = payRes ? Math.max(Math.min(actAmt[t.key] || t.cost!.min || 1, payMax), payMax ? 1 : 0) : 0;
              const main = perUnit ? { ...main0(t), dice: payN ? `${payN}d${perUnit[1]}` : "" } : main0(t);
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
                  const crit = takeCrit(`rider:${t.key}`);
                  const r = roll(expr, { doubleDice: crit });
                  if (perUnit && payRes && payN) setPlay((cur) => ({ resUsed: { ...cur.resUsed, [payRes.key]: Math.min(payRes.max, (cur.resUsed[payRes.key] || 0) + payN) } }));
                  if (r) log({ title: `${t.name} damage`, total: String(r.total), cls: "dmg", detail: `${eqOf(r)}${esc(describeRolled(r))}${main.type && main.type !== "weapon" ? ` · ${esc(main.type)}` : " · the weapon’s damage type"}${spent ? `<div>Traded ${spent}d${dm?.[2]} for the effects below.</div>` : ""}${lines}${crit ? `<div class="vd crit">Critical hit: dice doubled</div>` : ""}` });
                } else log({ title: t.name, total: "", cls: "event", detail: `All its dice traded for effects.${lines}` });
                setRiderPick((m) => ({ ...m, [t.key]: [] }));
              };
              return (
                <tr key={t.key}>
                  <td><b>{t.name}</b><div className="note">{t.source !== t.name ? t.source : ""}</div></td>
                  <td className="note">
                    {t.when}.
                    {perUnit && payRes && (
                      <div className="rowbtn" style={{ flexWrap: "wrap", marginTop: 4, alignItems: "center" }}>
                        <span className="mut">{payRes.name.replace(/^.*? charges$/, "Charges")} to spend:</span>
                        {Array.from({ length: Math.max(1, (t.cost!.max ?? 1) - (t.cost!.min ?? 1) + 1) }, (_, i) => (t.cost!.min ?? 1) + i).map((n) => (
                          <Btn key={n} className={`sbtn sm ${payN === n ? "" : "ghost"}`} aria-pressed={payN === n} disabled={n > payLeft}
                            why={n > payLeft ? `Only ${payLeft} left.` : undefined} onClick={() => setActAmt((m) => ({ ...m, [t.key]: n }))}>{n}</Btn>
                        ))}
                        <span className="mut">{payLeft} of {payRes.max} left</span>
                      </div>
                    )}
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
                            <Btn key={k} data-ex={`do:go:${t.key}:${o.id}`} className={`sbtn sm ${on ? "" : "ghost"}`} aria-pressed={on} disabled={full || broke}
                              why={full ? `You can add ${pickMax(g)} effect${pickMax(g) > 1 ? "s" : ""} per ${t.name}.` : broke ? `Costs ${o.diceCost}d${dm?.[2]}; only ${left} left.` : undefined}
                              onClick={() => toggle({ ...o, group: g })}>{o.label}{o.diceCost ? ` (−${o.diceCost}d${dm?.[2] || 6})` : ""}</Btn>
                          );
                        })}
                      </div>
                    ))}
                  </td>
                  <td><div className="rowbtn"><Btn data-ex={`do:g:${t.key}`} className="sbtn sm" disabled={!!perUnit && !payN} why={perUnit && !payN ? "No charges left." : undefined} onClick={roll1}>{dice ? `Roll ${dice} ${main.type && main.type !== "weapon" ? main.type : ""}`.trim() + (t.damage!.length > 1 ? " +" : "") : "Use"}</Btn></div></td>
                </tr>
              );
            })}
            {plain.map((t) => {
              const { res, left, ok } = costInfo(t.cost);
              return (
                <tr key={`hit-${t.key}`}>
                  <td><b>{t.name}</b><div className="note">{t.source}</div></td>
                  <td className="note">{t.text}{res ? ` ${left} / ${res.max} ${res.name}.` : ""}</td>
                  <td><div className="rowbtn"><Btn data-ex={`do:g:${t.key}`} className="sbtn sm" disabled={!ok} why={whyNot(t.cost, t.name)} onClick={() => useTrigger(t)}>Use</Btn></div></td>
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
        <p className="note" style={{ marginTop: 0 }}>You can use the mastery property of: {fx.masteries.join(", ")}. Whenever you finish a Long Rest you can <button className="linkish" title="Opens the choices you can change after a Long Rest, including which weapons you have mastery with." onClick={openRestChoices}>pick different weapons</button>; you can also change them anytime in the <Link to={`/build/${c.id}`}>builder</Link>.</p>
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
              {r.max <= 10 ? <Pips what={`${r.name}. ${refreshText(r)}`} n={r.max} used={used} onToggle={(i) => setPlay((cur) => ({ resUsed: { ...cur.resUsed, [r.key]: i < (cur.resUsed[r.key] || 0) ? i : i + 1 } }))} /> : <b>{r.max - used}/{r.max}</b>}
              <span className="mut">/ {r.recover === "short" ? "Short Rest" : r.recover === "shortOne" ? "Long Rest (1 back on a Short Rest)" : r.recover === "dawn" ? "Dawn" : r.recover === "never" ? "doesn’t recharge" : "Long Rest"}</span>
            </span>
          );
        })}
        {b.acts.map((a) => (
          <Btn data-ex={`do:a:${a.id}`} key={`a-${a.id}`} className="sbtn sm" disabled={optionLabels(a) ? !optionOf(a).ok : !costInfo(a.cost).ok} why={actWhy(a, optionLabels(a) ? optionOf(a) : undefined)} onClick={() => runFeature(a, optionLabels(a) ? optionOf(a).i : undefined)}>
            {a.name === name ? "Use" : a.name}{a.activation ? ` · ${a.activation}` : ""}
          </Btn>
        ))}
        {b.togs.map((t) => (
          <Btn data-ex={`do:t:${t.key}`} key={`t-${t.key}`} className="sbtn sm" disabled={(!t.form && isOn(t.key)) || !costInfo(t.cost).ok} why={isOn(t.key) ? `${t.name} is already active.` : whyNot(t.cost, t.name)} onClick={() => (t.form ? openForms() : switchOn(t))}>
            {t.form ? "Choose form" : isOn(t.key) ? "Active" : "Use"}{t.activation ? ` · ${t.activation}` : ""}
          </Btn>
        ))}
        {b.spells.map((g) => (
          <button key={`s-${g.spell.id}`} className="sbtn sm ghost" title={`Opens ${g.spell.name}, a spell ${g.source} gives you, with how to cast it.`} onClick={() => setDrawer({ kind: "spell", id: g.spell.id, via: g.source })}>{g.spell.name} ({spellInfo(g.spell)?.level ? `level ${spellInfo(g.spell)!.level}` : "cantrip"})</button>
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
          <td><button className="linkish spname" title={`Opens ${r.sp.name}’s full description, with how to cast it.`} onClick={() => setDrawer({ kind: "spell", id: r.sp.id, via: r.g ? r.g.source : r.k ? `k:${r.k.info.index}` : undefined })}>{r.sp.name}</button><div className="note">{r.lvl ? `Level ${r.lvl} spell` : "Cantrip"}{r.source ? ` · ${r.source}` : ""}{stripMd(r.sp.fields["range"] || "") ? ` · ${stripMd(r.sp.fields["range"])}` : ""}</div></td>
          <td>{fmt(n.atk)}</td>
          <td>{dmg} {type}{pl.attack.count > 1 ? <div className="note">×{pl.attack.count} beams or attacks</div> : null}</td>
          <td>
            {/* a cantrip just rolls; a levelled spell is cast first (spends the slot), then each attack is rolled */}
            <div className="rowbtn">
              {r.lvl > 0 && !r.g?.atWill && <Btn data-ex={`do:sp:${st.label === "Free" ? "free" : st.label === "At will" ? "atwill" : "cast"}:${r.sp.id}`} className="sbtn sm ghost" disabled={!st.ok} why={st.why} title={`Spend ${st.label === "Free" ? "the free use" : "a spell slot"} to cast it, then roll each attack.`} onClick={() => castRow(r)}>{st.label === "Free" ? "Cast free" : "Cast"}</Btn>}
              <button className="sbtn sm" title={`${HOW.attack}${pl.attack.count > 1 ? ` Roll once for each of the ${pl.attack.count} beams or attacks.` : ""}`} onClick={() => attack({ name: r.sp.name, toHit: n.atk, damage: dmg, type, note: "" })}>Attack</button>
              <button className={`sbtn sm ${critFor?.name === r.sp.name ? "critbtn" : "ghost"}`} title={critFor?.name === r.sp.name ? "Your last roll with this spell was a Critical Hit: this rolls its damage dice twice." : `${HOW.dmg}${pl.attack.count > 1 ? " This is one beam's or attack's damage." : ""}`} onClick={() => rollDamage(r.sp.name, dmg, critFor?.name === r.sp.name, type, false, {}, pl.damage.map((x) => ({ expr: x.dice, type: x.type })))}>{critFor?.name === r.sp.name ? "Crit damage" : "Damage"}</button>
            </div>
          </td>
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
      <Btn data-ex={`do:a:${a.id}`} className="sbtn sm" disabled={optionLabels(a) ? !optionOf(a).ok : !costInfo(a.cost).ok} why={actWhy(a, optionLabels(a) ? optionOf(a) : undefined)} onClick={() => runFeature(a, optionLabels(a) ? optionOf(a).i : undefined)}>{a.cast ? "Cast" : "Use"}</Btn>
    ));
    for (const t of fx.toggles) add(`t:${t.key}`, t.name, `${t.activation || "Use"} · ${t.source}`, t.cost, (
      <Btn data-ex={`do:t:${t.key}`} className="sbtn sm" disabled={!costInfo(t.cost).ok || (!t.form && isOn(t.key))} why={isOn(t.key) ? `${t.name} is already active.` : whyNot(t.cost, t.name)} onClick={() => (t.form ? openForms() : switchOn(t))}>{t.form ? "Choose form" : "Use"}</Btn>
    ));
    for (const t of fx.triggers) add(`g:${t.key}`, t.name, t.when, t.cost, <Btn data-ex={`do:g:${t.key}`} className="sbtn sm" disabled={!costInfo(t.cost).ok} why={whyNot(t.cost, t.name)} onClick={() => useTrigger(t)}>Use</Btn>);
    for (const g of fx.grantedSpells) {
      const free = g.free ? resources.find((r) => r.key === g.free) : undefined;
      if (!free) continue;
      const r: SpellRowData = { sp: g.spell, lvl: spellInfo(g.spell)?.level || 0, g, source: g.source };
      const st = rowCastState(r);
      rows.push({ key: `s:${g.spell.id}:${g.source}`, name: g.spell.name, source: `Free cast · ${g.source}`, res: free, act: <Btn data-ex={`do:sp:free:${g.spell.id}`} className="sbtn sm" disabled={st.label !== "Free"} why={freeWhy(free, free.max - (p.resUsed[free.key] || 0))} onClick={() => castRow(r)}>Cast free</Btn> });
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
                    ? <Pips what={`${x.res.name}. ${refreshText(x.res)}`} n={x.res.max} used={used} onToggle={(i) => setPlay((cur) => ({ resUsed: { ...cur.resUsed, [x.res.key]: i < (cur.resUsed[x.res.key] || 0) ? i : i + 1 } }))} />
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
    if (r.book) return <Btn data-ex={`do:sp:${r.book ? "book" : "ritual"}:${r.sp.id}`} className="sbtn sm" why="" onClick={() => castRitual(r)}>Ritual</Btn>;
    const levels = castLevels(r);
    const ritual = isRitual(r.sp) && r.lvl > 0 && !r.g?.atWill;
    const free = r.g?.free ? resources.find((x) => x.key === r.g!.free) : undefined;
    const freeLeft = free ? free.max - (p.resUsed[free.key] || 0) : 0;
    const menu = levels.length > 1 || ritual || (free && levels.length > 0);
    return (
      <span className="castwrap">
        <Btn data-ex={`do:sp:${st.label === "Free" ? "free" : st.label === "At will" ? "atwill" : "cast"}:${r.sp.id}`} className={`sbtn sm${menu ? " split" : ""}`} disabled={!st.ok} why={st.why} onClick={() => castRow(r)}>{st.label}</Btn>
        {menu && <button className="sbtn sm split2" aria-label={`Choose how to cast ${r.sp.name}`} title={`Opens the ways to cast ${r.sp.name}: with a higher level slot, a free use${isRitual(r.sp) ? " or as a Ritual" : ""}.`} aria-expanded={castMenu?.key === key} onClick={(e) => {
          const rc = (e.currentTarget.parentElement || e.currentTarget).getBoundingClientRect();
          setCastMenu(castMenu?.key === key ? undefined : { key, x: Math.max(8, Math.min(rc.left, window.innerWidth - 248)), y: rc.bottom + 4 });
        }}>▾</button>}
        {menu && castMenu?.key === key && (
          <span className="castmenu" role="menu" style={{ left: castMenu.x, top: Math.max(8, Math.min(castMenu.y, window.innerHeight - 40 - 46 * (levels.length + 2))) }}>
            {free && <button data-ex={`do:sp:free:${r.sp.id}`} role="menuitem" disabled={freeLeft <= 0} onClick={() => { castRow(r); setCastMenu(undefined); }}><b>Free</b><span>{freeLeft} use{freeLeft === 1 ? "" : "s"} left · {free.name}</span></button>}
            {levels.map((x) => (
              <Tip key={x.L} tip={x.left > 0 ? "" : slotWhy(x.L)}>
                <button data-ex={`do:sp:${x.L}:${r.sp.id}`} role="menuitem" disabled={x.left <= 0} onClick={() => { castRow(r, x.L); setCastMenu(undefined); }}>
                  <b>Level {x.L}</b><span>{x.what ? `${x.what} · ` : ""}{x.left} slot{x.left === 1 ? "" : "s"} left</span>
                </button>
              </Tip>
            ))}
            {ritual && <button data-ex={`do:sp:ritual:${r.sp.id}`} role="menuitem" onClick={() => { castRitual(r); setCastMenu(undefined); }}><b>As a Ritual</b><span>No slot · takes 10 minutes longer</span></button>}
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
          {editable && anyCaster && <button className="sbtn sm" style={{ marginLeft: "auto" }} title="Search your class's spell list, learn cantrips and choose your prepared spells (Wizards: add spells to your spellbook)." onClick={() => setDrawer({ kind: "manage", k: casters[0]?.info.index ?? 0 })}>Manage Spells</button>}
        </div>
        <input type="search" className="spsearch" placeholder="Search spell names, casting times, damage types, conditions…" value={spellQ} onChange={(e) => setSpellQ(e.target.value)} aria-label="Search spells" />
        <div className="chipsrow" role="group" aria-label="Spell level">
          <button data-exnav className={spellLvl === "all" ? "on" : ""} title="Shows all your spells." onClick={() => setSpellLvl("all")}>All</button>
          {levels.map((L) => <button key={L} data-exnav className={spellLvl === String(L) ? "on" : ""} title={`Shows only your ${L ? `level ${L}` : "cantrip"} spells.`} onClick={() => setSpellLvl(String(L))}>{L === 0 ? "Cantrips" : `${L}${["st", "nd", "rd"][L - 1] || "th"}`}</button>)}
          {rows.some((r) => /ritual/i.test(r.sp.fields["casting time"] || "")) && <button data-exnav className={spellLvl === "ritual" ? "on" : ""} title="Shows only spells you can cast as a Ritual: no spell slot, but it takes 10 minutes longer." onClick={() => setSpellLvl("ritual")}>Ritual</button>}
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
                      <Pips what={`${sl.pact ? "Pact Magic" : `Level ${sl.level}`} spell slots (casting a spell with the sheet’s Cast buttons marks them for you)`} n={sl.max + Math.max(0, -(p.slotsUsed[key] || 0))} used={Math.max(0, p.slotsUsed[key] || 0)} onToggle={(i) => setPlay((cur) => {
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
                          <button className="linkish spname" title={`Opens ${r.sp.name}’s full description, with how to cast it.`} onClick={() => setDrawer({ kind: "spell", id: r.sp.id, via: r.g ? r.g.source : r.k ? `k:${r.k.info.index}` : undefined })}>{r.sp.name}</button>
                          {conc && <span className="tagm plain" title="Concentration">C</span>}{ritual && <span className="tagm plain" title="Ritual">R</span>}
                          {r.source && <div className="note">{r.source}</div>}
                        </td>
                        <td>{shortTime(r.sp.fields["casting time"] || "")}</td>
                        <td>{stripMd(r.sp.fields["range"] || "").replace(/ feet/, " ft.")}</td>
                        <td>{pl?.attack ? fmt(n.atk) : pl?.save ? `${pl.save.ability.slice(0, 3).toUpperCase()} ${n.dc}` : "—"}</td>
                        <td>{dmg ? <button className="sbtn sm ghost" title={`Rolls ${r.sp.name}’s ${dmg} and adds it to the Game Log. It doesn’t spend a slot: use Cast for that.`} onClick={() => rollDamage(r.sp.name, dmg, isSmite(r.sp) && takeCrit(`spell:${r.sp.id}`), pl!.damage.map((x) => x.type).filter(Boolean).join(" + "), false, {}, pl!.damage.map((x) => ({ expr: x.dice, type: x.type })))}>{dmg}{pl?.attack && pl.attack.count > 1 ? ` ×${pl.attack.count}` : ""}</button> : pl?.heal ? <button className="sbtn sm ghost" onClick={() => rollDamage(r.sp.name, pl.heal!, false, "", true, { maximize: fx.maxHealing })}>{pl.heal} heal</button> : pl?.tempHp ? <span className="effkind">{pl.tempHp} temp HP</span> : pl?.conditions.length ? <Tip tip={`Targets can end up ${pl.conditions.join(" or ")}.`}><span className="effkind cond">{pl.conditions.join(", ")}</span></Tip> : <span className="effkind">{pl?.kind || "—"}</span>}</td>
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
  // ------------------------------------------------------------ Manage Spells
  /** The class's own "Changing Your Prepared Spells" rule, word for word from its description. */
  const prepRule = (e?: Entry) => stripMd(e?.body.match(/\*\*\*Changing Your Prepared Spells\.\*\*\*\s*([^\n]+)/)?.[1] || "");
  const managePanel = (kIndex: number): ReactNode => {
    const k = casters.find((x) => x.info.index === kIndex) || casters[0];
    if (!k || !k.ci) return <p className="note">This character doesn’t cast spells from a class.</p>;
    if (!content.loaded.has("spells")) return <p className="note">Loading spells…</p>;
    const ci = k.ci;
    const listCls = spellListClass(k.info, content.entries);
    const byLevel = classSpells(listCls, spells);
    const always = new Map(fx.grantedSpells.filter((g) => g.prepared).map((g) => [g.spell.name, g.source]));
    const knownElsewhere = new Map(fx.grantedSpells.filter((g) => spellInfo(g.spell)?.level === 0).map((g) => [g.spell.name, g.source]));
    const cantrips = k.info.cantrips, prepared = k.info.spells;
    const prepCount = prepared.filter((n) => !always.has(n)).length;
    const house = !!c.houseRules;
    const write = (patch: { cantrips?: string[]; spells?: string[] }) => { dirty.current = true; setC((prev) => (prev ? { ...prev, ...patchClass(prev, k.info.index, patch) } : prev)); };
    // Wizards keep a spellbook: prepare from it; add spells with level-up picks or by copying (50 GP and 2 hours a level)
    const wizard = (casterEntry(k.info)?.effects || []).some((f) => /spellbook:/.test(f.yaml));
    const book = c.spellbook || [];
    const granted = fx.bookSpells.map((b) => b.name);
    const bookNames = new Set([...prepared, ...book.map((b) => b.name), ...granted]);
    const freePicks = 6 + 2 * Math.max(0, k.info.level - 1);
    const freeUsed = [...bookNames].filter((n) => (spellInfo(spells.find((x) => x.name === n) || ({ tagline: "" } as Entry))?.level || 0) > 0 && !book.some((b) => b.name === n && b.how === "copied") && !(granted.includes(n) && !book.some((b) => b.name === n))).length;
    const freeLeft = freePicks - freeUsed;
    const gold = inv.coins.gp + inv.coins.pp * 10;
    const addToBook = (name: string, lvl: number, how: "level" | "copied") => {
      if (how === "copied") {
        const cost = lvl * 50;
        let gp = inv.coins.gp - cost, pp = inv.coins.pp;
        while (gp < 0 && pp > 0) { pp -= 1; gp += 10; }
        setInventory(inv.items, { ...inv.coins, gp: Math.max(0, gp), pp });
        log({ title: `Copied ${name} into the spellbook`, total: `−${cost} GP`, cls: "event", detail: `The transcription takes ${lvl * 2} hours and costs ${cost} GP.` });
      } else log({ title: `Added ${name} to the spellbook`, total: "", cls: "event", detail: "One of the two Wizard spells you add when you gain a Wizard level." });
      dirty.current = true;
      setC((prev) => (prev ? { ...prev, spellbook: [...(prev.spellbook || []), { name, how }] } : prev));
    };
    const q = mgr.q.trim().toLowerCase();
    const levels = [0, ...Array.from({ length: ci.maxSpellLevel }, (_, i) => i + 1)].filter((L) => L > 0 || ci.cantrips > 0);
    const rows = levels.flatMap((L) => (byLevel.get(L) || []).map((sp) => ({ sp, L })))
      .filter(({ sp, L }) => (mgr.lvl === "all" || mgr.lvl === L)
        && (!q || sp.name.toLowerCase().includes(q) || (sp.tagline || "").toLowerCase().includes(q) || stripMd(sp.fields["casting time"] || "").toLowerCase().includes(q))
        && (mgr.view !== "book" || !wizard || (L > 0 && bookNames.has(sp.name)))
        && (mgr.view !== "mine" || (L === 0 ? cantrips.includes(sp.name) || knownElsewhere.has(sp.name) : prepared.includes(sp.name) || always.has(sp.name) || (wizard && bookNames.has(sp.name)))));
    const action = (sp: Entry, L: number): ReactNode => {
      const n = sp.name;
      if (L === 0) {
        if (knownElsewhere.has(n)) return <span className="tag plain">Known · {knownElsewhere.get(n)}</span>;
        const on = cantrips.includes(n);
        return <Btn className={`sbtn sm ${on ? "gold" : ""}`} aria-pressed={on} disabled={!on && cantrips.length >= ci.cantrips && !house} why={`You know ${ci.cantrips} ${k.info.cls.name} cantrips; remove one first.`}
          onClick={() => write({ cantrips: on ? cantrips.filter((x) => x !== n) : [...cantrips, n] })}>{on ? "✓ Known" : "Choose"}</Btn>;
      }
      if (always.has(n)) return <span className="tag ok">Always prepared · {always.get(n)}</span>;
      if (wizard && !bookNames.has(n)) {
        return freeLeft > 0
          ? <button className="sbtn sm ghost" title="One of the two Wizard spells you add to your spellbook when you gain a Wizard level. It costs nothing." onClick={() => addToBook(n, L, "level")}>Add to spellbook</button>
          : <Btn title={`Copies ${n} into your spellbook from a scroll or book you found: ${L * 2} hours and ${L * 50} GP (the sheet takes the gold).`} className="sbtn sm ghost" disabled={gold < L * 50 && !house} why={`Copying a level ${L} spell costs ${L * 50} GP; you have ${gold} GP.`}
              onClick={() => { if (confirm(`Copy ${n} into your spellbook?\n\nCopying a Spell into the Book: for each level of the spell, the transcription takes 2 hours and costs 50 GP. For this level ${L} spell that's ${L * 2} hours and ${L * 50} GP, taken from your coins.\n\nYou can copy a Wizard spell you find, such as on a Spell Scroll. Your GM decides which spells you find.`)) addToBook(n, L, "copied"); }}>Copy · {L * 50} GP</Btn>;
      }
      const on = prepared.includes(n);
      return <Btn title={on ? `${n} is prepared, so you can cast it. Press it to unprepare it and free up a place (${prepCount} of ${ci.prepared} prepared).` : `Prepares ${n} so you can cast it (${prepCount} of ${ci.prepared} prepared). You change prepared spells when you finish a Long Rest.`} className={`sbtn sm ${on ? "gold" : ""}`} aria-pressed={on} disabled={!on && prepCount >= ci.prepared && !house} why={`You can prepare ${ci.prepared} spells; unprepare one first.`}
        onClick={() => write({ spells: on ? prepared.filter((x) => x !== n) : [...prepared, n] })}>{on ? "✓ Prepared" : "Prepare"}</Btn>;
    };
    return (
      <>
        <h3 className="drtitle">Manage Spells</h3>
        {casters.length > 1 && (
          <div className="chipsrow" role="group" aria-label="Class">
            {casters.map((x) => <button key={x.info.index} className={x.info.index === k.info.index ? "on" : ""} aria-pressed={x.info.index === k.info.index} onClick={() => setDrawer({ kind: "manage", k: x.info.index })}>{x.info.cls.name}</button>)}
          </div>
        )}
        <div className="mgrcount">
          {ci.cantrips > 0 && <span><b>{cantrips.length}</b>/{ci.cantrips} cantrips</span>}
          <span><b>{prepCount}</b>/{ci.prepared} prepared</span>
          {wizard && <span><b>{[...bookNames].length}</b> in spellbook · {Math.max(0, freeLeft)} to add from Wizard levels</span>}
          <span className="mut">up to level {ci.maxSpellLevel}</span>
        </div>
        {wizard && (
          <details className="mgrfree">
            <summary>How many spells can I add from Wizard levels?</summary>
            <div>Your spellbook starts with six level 1 Wizard spells, and whenever you gain a Wizard level after 1 you add two more: 6 + 2 × {k.info.level - 1} = <b>{freePicks}</b>. Every level 1+ spell in your book that you didn’t copy counts toward them, including the ones you picked in the builder: <b>{freeUsed}</b> added, <b>{Math.max(0, freeLeft)}</b> left. Spells a feature adds for you (like Evocation Savant) don’t count.</div>
          </details>
        )}
        {wizard && editable && (freeLeft > 0 || prepCount < ci.prepared || cantrips.length < ci.cantrips) && (
          <ol className="mgrsteps">
            <li className={cantrips.length >= ci.cantrips ? "done" : ""}>Choose your cantrips: <b>{cantrips.length}</b> of {ci.cantrips}. <button className="linkish" onClick={() => setMgr({ q: "", lvl: 0, view: "all" })}>Show cantrips</button></li>
            <li className={freeLeft <= 0 ? "done" : ""}>Add spells to your spellbook: <b>{Math.max(0, freeLeft)}</b> left from your Wizard levels. Use <i>Add to spellbook</i> on any spell below. <button className="linkish" onClick={() => setMgr({ q: "", lvl: "all", view: "all" })}>Show all spells</button></li>
            <li className={prepCount >= ci.prepared ? "done" : ""}>Prepare spells from your spellbook: <b>{prepCount}</b> of {ci.prepared}. <button className="linkish" onClick={() => setMgr({ q: "", lvl: "all", view: "book" })}>Show my spellbook</button></li>
          </ol>
        )}
        <div className="mgrhelp">
          <p><b>Cantrips and prepared spells.</b> You know your cantrips and can cast them at will, without expending a spell slot. A level 1+ spell must be on your list of prepared spells for you to cast it, and casting it expends a spell slot. In play you can cast only your cantrips and prepared spells, including spells you always have prepared (from a subclass or feat); those are the spells on your Spells and Actions tabs. Everything else listed here is a spell you could prepare instead.</p>
          {wizard && <p><b>Spellbook.</b> Your spellbook holds your Wizard spells, and you prepare spells from it. Whenever you gain a Wizard level after 1, you add two Wizard spells of your choice to it. <b>Copying a Spell into the Book:</b> when you find a level 1+ Wizard spell, such as on a Spell Scroll, you can copy it in if it’s of a level you can prepare; for each level of the spell, the transcription takes 2 hours and costs 50 GP. The cost is a rule; which spells you find is up to your GM.</p>}
        </div>
        <p className="note" style={{ margin: "4px 0 8px" }}>
          {prepRule(casterEntry(k.info)) ? <><b>Changing Your Prepared Spells.</b> {prepRule(casterEntry(k.info))}</> : null}

        </p>
        <input className="mgrsearch" value={mgr.q} onChange={(e) => setMgr({ ...mgr, q: e.target.value })} placeholder="Search names, schools or casting times" aria-label="Search spells" />
        <div className="chipsrow" role="group" aria-label="Spell level" style={{ marginTop: 8 }}>
          <button data-exnav className={mgr.lvl === "all" ? "on" : ""} title="Shows spells of every level to pick from." onClick={() => setMgr({ ...mgr, lvl: "all" })}>All</button>
          {levels.map((L) => <button key={L} data-exnav className={mgr.lvl === L ? "on" : ""} title={`Shows ${L ? `level ${L}` : "cantrip"} spells to pick from.`} onClick={() => setMgr({ ...mgr, lvl: L })}>{L ? `${L}${["st", "nd", "rd"][L - 1] || "th"}` : "Cantrips"}</button>)}
          {wizard && <button className={mgr.view === "book" ? "on" : ""} aria-pressed={mgr.view === "book"} onClick={() => setMgr({ ...mgr, view: mgr.view === "book" ? "all" : "book" })}>Spellbook</button>}
          <button className={mgr.view === "mine" ? "on" : ""} aria-pressed={mgr.view === "mine"} onClick={() => setMgr({ ...mgr, view: mgr.view === "mine" ? "all" : "mine" })}>{wizard ? "Known & prepared" : "Mine only"}</button>
        </div>
        <div className="mgrlist">
          {rows.length === 0 && <p className="note">No spells match.</p>}
          {levels.filter((L) => rows.some((r) => r.L === L)).map((L) => (
            <div key={L}>
              <div className="mgrlvl">{L ? `Level ${L}` : "Cantrips"}</div>
              {rows.filter((r) => r.L === L).map(({ sp }) => (
                <div key={sp.id} className="mgrrow">
                  <div style={{ minWidth: 0 }}>
                    <button className="linkish spname" title={`Opens ${sp.name}’s full description.`} onClick={() => setDrawer({ kind: "spell", id: sp.id, back: k.info.index })}>{sp.name}</button>
                    <div className="note" style={{ margin: 0 }}>{wizard && L > 0 && bookNames.has(sp.name) && <span className="tag plain inbook">{prepared.includes(sp.name) ? "In your book · prepared" : "In your book"}</span>}{[spellInfo(sp)?.school, stripMd(sp.fields["casting time"] || ""), stripMd(sp.fields["range"] || ""), /concentration/i.test(sp.fields["duration"] || "") ? "Concentration" : "", isRitual(sp) ? "Ritual" : ""].filter(Boolean).join(" · ")}</div>
                  </div>
                  {editable ? action(sp, L) : null}
                </div>
              ))}
            </div>
          ))}
        </div>
      </>
    );
  };
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
          {drawer.back !== undefined && <button className="linkish" style={{ marginBottom: 6 }} onClick={() => setDrawer({ kind: "manage", k: drawer.back! })}>‹ Back to Manage Spells</button>}
          <div className="mut" style={{ fontSize: 12 }}>{r.source || (r.k ? `${r.k.info.cls.name} spell` : "")}</div>
          <h3 className="drtitle">{sp.name}</h3>
          <div className="note" style={{ marginTop: 0 }}>{sp.tagline}</div>
          <div className="drcast">
            {r.book ? (
              <>
                <button data-ex={`do:sp:${r.book ? "book" : "ritual"}:${r.sp.id}`} className="sbtn" onClick={() => castRitual(r)}>Cast as a Ritual</button>
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
                <Btn data-ex={`do:sp:${L}:${r.sp.id}`} className="sbtn" disabled={slotLeft(L) <= 0} why={slotWhy(L)} onClick={() => castRow(r, L)}>Cast with a level {L} slot</Btn>
                {free && <Btn data-ex={`do:sp:free:${r.sp.id}`} className="sbtn ghost" disabled={!st.ok || st.label !== "Free"} why={freeWhy(free, free.max - (p.resUsed[free.key] || 0))} onClick={() => castRow(r)}>Cast free ({free.max - (p.resUsed[free.key] || 0)} left)</Btn>}
              </>
            ) : <button data-ex={`do:sp:${st.label === "Free" ? "free" : st.label === "At will" ? "atwill" : "cast"}:${r.sp.id}`} className="sbtn" onClick={() => castRow(r)}>Cast</button>}
            {lvl > 0 && !r.g?.atWill && isRitual(sp) && <Tip tip="No slot used; casting takes 10 minutes longer."><button data-ex={`do:sp:${r.book ? "book" : "ritual"}:${r.sp.id}`} className="sbtn ghost" onClick={() => castRitual(r)}>Cast as a Ritual</button></Tip>}
            </>}
          </div>
          {pl && (
            <div className="drsum">
              {pl.attack && <span>Spell attack <b>{fmt(n.atk)}</b>{pl.attack.count > 1 ? ` ×${pl.attack.count}` : ""}</span>}
              {pl.save && <span>{pl.save.ability} save DC <b>{n.dc}</b>{pl.save.success === "half" ? " (half on a success)" : ""}</span>}
              {pl.damage.length > 0 && <button className="sbtn sm ghost" title={HOW.dmg} onClick={() => rollDamage(sp.name, pl.damage.map((x) => x.dice).join("+"), isSmite(sp) && takeCrit(`spell:${sp.id}`), pl.damage.map((x) => x.type).filter(Boolean).join(" + "), false, {}, pl.damage.map((x) => ({ expr: x.dice, type: x.type })))}>{pl.damage.map((x) => `${x.dice} ${x.type}`).join(" + ")}</button>}
              {pl.heal && <button className="sbtn sm ghost" title={`Rolls the healing (${pl.heal}) and adds it to the Game Log, to give to whoever you healed.`} onClick={() => rollDamage(sp.name, pl.heal!, false, "", true, { maximize: fx.maxHealing })}>Heal {pl.heal}</button>}
            </div>
          )}
          <dl className="drprops">
            {["casting time", "range", "components", "duration"].filter((k2) => sp.fields[k2]).map((k2) => <div key={k2}><dt>{k2.replace(/\b\w/g, (x) => x.toUpperCase())}</dt><dd>{stripMd(sp.fields[k2])}</dd></div>)}
            {sp.fields["source"] && <div><dt>Source</dt><dd>{stripMd(sp.fields["source"])}</dd></div>}
          </dl>
          <div className="drbody"><Md md={sp.body} /></div>
        </>
      );
    } else if (drawer.kind === "manage") {
      body = managePanel(drawer.k);
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
        <aside className={`drawer ${drawer.kind === "manage" ? "wide" : ""}`} role="dialog" aria-label={drawer.kind === "manage" ? "Manage Spells" : "Details"}>
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
    const freeUsed = names.filter((n) => !book.some((b) => b.name === n && b.how === "copied") && !(granted.includes(n) && !book.some((b) => b.name === n))).length;
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
      log({ title: `Copied ${pick} into the spellbook`, total: `−${copyCost} GP`, cls: "event", detail: `The transcription takes ${pickLvl * 2} hours and costs ${copyCost} GP.` });
      setBookPick("");
    };
    const byLevel = new Map<number, Entry[]>();
    for (const x of inBook) { const L = spellInfo(x)?.level || 0; byLevel.set(L, [...(byLevel.get(L) || []), x]); }
    return (
      <div className="spanel" style={{ marginBottom: 12 }}>
        <div className="fphead">
          <h3 style={{ margin: 0 }}>Spellbook</h3>
          <span className="mut" style={{ fontSize: 12.5 }}>{inBook.length} spells · {prepared.length}/{prepMax} prepared · {Math.max(0, freeLeft)} to add from Wizard levels</span>
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
                    <Btn title={prep ? `Unprepares ${x.name}; it stays in your spellbook.` : `Prepares ${x.name} from your spellbook so you can cast it (${prepared.length} of ${prepMax} prepared).`} className="sbtn sm ghost" disabled={!prep && !house && prepared.length >= prepMax} why={`You can prepare ${prepMax} spells; unprepare one first. You change prepared spells when you finish a Long Rest.`}
                      onClick={() => {
                        setPrepared(prep ? k.info.spells.filter((n) => n !== x.name) : [...k.info.spells, x.name]);
                        if (prep && !mine) setBook([...book, { name: x.name, how: "level" }]); // it stays in the book
                      }}>{prep ? "Unprepare" : "Prepare"}</Btn>
                  )}
                  {editable && mine && !prep && <button className="sbtn sm ghost" aria-label={`Remove ${x.name} from the spellbook`} title={`Removes ${x.name} from your spellbook (for a spell added by mistake).`} onClick={() => setBook(book.filter((b) => b.name !== x.name))}>✕</button>}
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
            <Btn title="Adds the spell picked beside it to your spellbook as one of the two free Wizard spells you get each Wizard level." className="sbtn sm" disabled={!pick || (freeLeft <= 0 && !house)} why={!pick ? "Choose a spell first." : `You’ve added all ${free} spells your Wizard levels give you. Copy a spell you find instead.`}
              onClick={() => { setBook([...book, { name: pick, how: "level" }]); setBookPick(""); }}>Add to spellbook</Btn>
            <Btn title={`Copies the spell picked beside it into your spellbook from a scroll or book you found: 2 hours and 50 GP per spell level (the sheet takes the gold).`} className="sbtn sm ghost" disabled={!pick || (gold < copyCost && !house)} why={!pick ? "Choose a spell first." : `Copying it costs ${copyCost} GP; you have ${gold}.`}
              onClick={() => { if (confirm(`Copy ${pick} into your spellbook?\n\nCopying a Spell into the Book: for each level of the spell, the transcription takes 2 hours and costs 50 GP. For this level ${pickLvl} spell that's ${pickLvl * 2} hours and ${copyCost} GP, taken from your coins.\n\nYou can copy a Wizard spell you find, such as on a Spell Scroll. Your GM decides which spells you find.`)) copy(); }}>{pick ? `Copy (${copyCost} GP, ${pickLvl * 2} hours)` : "Copy"}</Btn>
          </div>
        )}
      </div>
    );
  };
  /** Choices a feature lets you change after a rest (Circle of the Land's land, Hunter's Prey), right on the sheet. */
  /** Open Features & Feats at "Change after a rest" (Weapon Mastery, prepared options…). */
  const openRestChoices = () => { setTab("features"); setTimeout(() => document.getElementById("restchoices")?.scrollIntoView({ behavior: "smooth", block: "center" }), 60); };
  const restSwaps = fx.pending.filter((pc) => pc.swap?.some((x) => x === "long" || x === "short") && pc.options && pc.options.length <= 60 && !pc.storedIn && !pc.amounts);
  const restChoicesPanel = () => {
    const list = fx.pending.filter((pc) => pc.swap?.some((x) => x === "long" || x === "short") && pc.options && pc.options.length <= 60 && !pc.storedIn && !pc.amounts);
    if (!list.length) return null;
    const setChoice = (key: string, vals: string[]) => { dirty.current = true; setC((prev) => (prev ? { ...prev, choices: { ...(prev.choices || {}), [key]: vals } } : prev)); };
    return (
      <div className="spanel" id="restchoices" style={{ marginBottom: 12 }}>
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
                  return <Btn key={o.value} title={`${on ? `${o.label} is picked for ${pc.feature}. Press to unpick it.` : `Picks ${o.label} for ${pc.feature}`} (${pc.chosen.length} of ${pc.count} picked). You can change this when you finish a Long Rest.`} className={`sbtn sm ${on ? "" : "ghost"}`} aria-pressed={on} disabled={!editable || (!on && pc.chosen.length >= pc.count)} why={!on && pc.chosen.length >= pc.count ? `You can have ${pc.count}; unpick one first.` : undefined}
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
      <div className="spanel" style={{ marginTop: 16 }}>
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
            <button className="sbtn sm" title="Adds a feature of your own (from your GM or a book the app doesn’t have) with the name and text you typed. You can give it uses that the sheet tracks." disabled={!cfName.trim()} onClick={add}>Add feature</button>
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
              <td>{oa && <div className="rowbtn"><button className="sbtn sm" title={`An Opportunity Attack with ${oa.name}: when a creature you can see leaves your reach, you can take your Reaction to make one melee attack against it. ${HOW.attack}`} onClick={() => attack({ ...oa, name: `${oa.name} (opportunity attack)` })}>Attack</button></div>}</td>
            </tr>
            {acts.map((a) => {
              const op = optionLabels(a) ? optionOf(a) : undefined;
              return (
                <tr key={`ra-${a.id}`}>
                  <td><b>{a.name}</b><div className="note">{a.source}</div></td>
                  <td className="note">{[a.text, a.save ? `${a.save.dc ? `DC ${a.save.dc} ` : ""}${a.save.ability} save` : "", costInfo(a.cost).res ? `${costInfo(a.cost).left} / ${costInfo(a.cost).res!.max} ${costInfo(a.cost).res!.name}.` : ""].filter(Boolean).join(" ")}</td>
                  <td><div className="rowbtn"><Btn data-ex={`do:a:${a.id}`} className="sbtn sm" disabled={op ? !op.ok : !costInfo(a.cost).ok} why={actWhy(a, op)} onClick={() => runFeature(a, op?.i)}>{a.cast ? "Cast" : "Use"}</Btn></div></td>
                </tr>
              );
            })}
            {trg.map((t) => {
              const { res, left, ok } = costInfo(t.cost);
              return (
                <tr key={`rt-${t.key}`}>
                  <td><b>{t.name}</b><div className="note">{t.source}</div></td>
                  <td className="note">{t.when}: {t.text}{res ? ` ${left} / ${res.max} ${res.name}.` : ""}</td>
                  <td><div className="rowbtn"><Btn data-ex={`do:g:${t.key}`} className="sbtn sm" disabled={!ok} why={whyNot(t.cost, t.name)} onClick={() => useTrigger(t)}>Use</Btn></div></td>
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
                {fx.defenses.map((x, i) => <li key={i} data-ex={`def:${i}`}>{x.text} <span className="mut">· {x.feature}</span></li>)}
                {formDef.map((t) => <li key={t} data-ex={`def:form:${t}`}>{t} <span className="mut">· {formCr!.name} form</span></li>)}
              </ul>
            </>
          );
        })()}
        <h3>Senses</h3>
        <ul className="plist">
          {senses.map((x, i) => <li key={i} data-ex={`sense:${i}`}>{x.text} <span className="mut">· {x.source}</span></li>)}
          <li data-ex="passive:Perception">Passive Perception {d.passivePerception}</li>
          <li data-ex="passive:Investigation">Passive Investigation {10 + (d.skills["Investigation"]?.value ?? d.mods.Intelligence)}</li>
          <li data-ex="passive:Insight">Passive Insight {10 + (d.skills["Insight"]?.value ?? d.mods.Wisdom)}</li>
        </ul>
        <h3>Languages</h3>
        <ul className="plist">
          <li data-ex="lang:common:Common">Common <span className="mut">· every character</span></li>
          {[0, 1].map((i) => (
            <li key={i} data-ex={`lang:origin:${origin[i] || ""}`}>
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
          {featureLangs.map((l) => <li key={l.name} data-ex={`lang:${l.source}:${l.name}`}>{l.name} <span className="mut">· {l.source}</span></li>)}
        </ul>
        <h3>Tools</h3>
        {tools.length === 0 ? <p className="note">No tool proficiencies.</p> : (
          <ul className="plist">{tools.map((t) => <li key={t.name} data-ex={`tool:${t.name}`}>{t.name}{t.sources.length ? <span className="mut"> · {[...new Set(t.sources)].join(", ")}</span> : null}</li>)}</ul>
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
                    {cp.rollDice && <button className="sbtn sm" title={`Rolls ${cp.rollDice} on its table and adds the result to the Game Log.`} onClick={() => rollDamage(`${cp.source}: table roll`, cp.rollDice!, false, "")}>Roll {cp.rollDice}</button>}
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
      if (dmg && !plan.attack) acts.push({ label: `Roll damage (${dmgExpr})`, run: () => rollDamage(s.name, dmgExpr, isSmite(s) && takeCrit(`spell:${s.id}`), dmgType, false, {}, plan.damage.map((x) => ({ expr: x.dice, type: x.type }))) });
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

  const Pips = ({ n, used, onToggle, f, what }: { n: number; used: number; onToggle: (i: number) => void; f?: boolean; what?: string }) => (
    <span className="pips">
      {Array.from({ length: n }, (_, i) => (
        <button key={i} className={`pip ${f ? "f" : ""} ${i < used ? "used" : ""}`} aria-label={`${i < used ? "Restore" : "Use"} ${i + 1}`} onClick={() => onToggle(i)}
          title={what ? `${what}: ${n - used} of ${n} left. ${i < used ? "This one is used: press it to get it back (and any used after it)." : "Press it to mark it used (and any before it), for when you spend one outside the sheet’s buttons."}` : undefined} />
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

  // ------------------------------------------------------------ explain mode
  type Ex = { title: string; rows: { label: string; value: string }[]; total: string; notes: string[] };
  /** The opening of an SRD entry as plain text, for explanations. */
  const plain = (md: string) => md.replace(/\*\*?|_|`/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\s+/g, " ").trim();
  // cross-references to other chapters ("See also “Playing the Game”…") mean nothing on the sheet, so they're left out
  const firstPara = (md: string) => plain(md.split(/\n\s*\n/).map((x) => x.trim()).find((x) => x && !/^(#|\*\*\w[^*]*:\*\*|```|\|)/.test(x)) || "").replace(/\s*See (also )?“[^.]*\.\s*$/, "").trim();
  /** The SRD's own words for a rule in the glossary (Darkvision, Resistance, Heroic Inspiration…). */
  const ruleText = (name: string) => { const e = content.byType("Rule").find((x) => x.name.toLowerCase() === name.toLowerCase()); return e ? firstPara(e.body) : ""; };
  const ab3 = (a: string) => a.slice(0, 3).toLowerCase();
  const exBonus = (pred: (to: string) => boolean) => fx.bonuses.filter((b) => pred(b.to)).map((b) => ({ label: b.source, value: fmt(b.value) }));
  /** Adds an "other" row when the listed parts don't add up to the number on the sheet. */
  const settle = (rows: Ex["rows"], total: number, otherLabel = "Other features and items") => {
    const sum = rows.reduce((n, r) => n + (parseInt(r.value.replace("−", "-"), 10) || 0), 0);
    return total !== sum ? [...rows, { label: otherLabel, value: fmt(total - sum) }] : rows;
  };
  const rollNotes = (ctx: RollContext) => {
    const cm = conditionMods(p, ctx);
    const adv = [...cm.adv, ...advantageFor(fx, ctx)], dis = [...cm.dis, ...disadvantageFor(fx, ctx)];
    return [...adv.map((x) => `Advantage: ${x}`), ...dis.map((x) => `Disadvantage: ${x}`), ...(cm.penalty ? [`−${cm.penalty} from Exhaustion on the roll`] : []), ...(cm.autoFail ? [`Automatically fails: ${cm.autoFail}`] : [])];
  };
  const scoreNote = (a: string) => {
    const base = c.base?.[a] ?? 10, bg = c.bonus?.[a] ?? 0, rest = d.scores[a] - base - bg;
    const how = { standard: "standard array", pointbuy: "point buy", "point-buy": "point buy", roll: "rolled", manual: "entered" }[c.method as string] || c.method;
    return `Score ${d.scores[a]} = ${base} (${how})${bg ? ` + ${bg} background` : ""}${rest ? ` ${rest > 0 ? "+" : "−"} ${Math.abs(rest)} from feats and features` : ""}. Modifier = (score − 10) ÷ 2, rounded down.`;
  };
  /** Explainer Mode for buttons that do something (Use, Cast, Use a slot…): what it is, then what pressing it does. */
  const explainDo = (key: string): Ex | undefined => {
    const rest = key.slice(3);
    const what = rest.slice(0, rest.indexOf(":") < 0 ? rest.length : rest.indexOf(":"));
    const id = rest.slice(what.length + 1);
    const firstLines = (t?: string, n = 2) => {
      // the first paragraph only, so a list of options doesn't end up as the summary
      const para = (t || "").split(/\n\s*\n/).map((x) => x.trim()).find((x) => x && !/^(#|\||[-*] |```)/.test(x)) || "";
      const txt = plain(stripMd(para)).replace(/\s+/g, " ").trim();
      const sents = txt.match(/[^.!?]+[.!?]+(\s|$)/g) || (txt ? [txt] : []);
      return sents.slice(0, n).join("").trim();
    };
    const costLine = (cost?: ModifCost) => {
      const { res, left } = costInfo(cost);
      if (!cost || !res) return "";
      return `Spends ${cost.min !== undefined || cost.any ? "the amount you choose of your" : `${cost.amount}`} ${res.name} (you have ${left} of ${res.max}). ${refreshText(res)}`;
    };
    const takes = (act?: string) => (act && !/^(none|special|free)$/i.test(act) ? `Takes your ${act.replace(/^(an?|your) /i, "")}.` : "");
    const out = (title: string, about: string[], does: string[]): Ex => ({
      title, rows: [], total: "",
      notes: [...about.filter(Boolean), ...(does.filter(Boolean).length ? [`Pressing it: ${does.filter(Boolean).join(" ")}`] : []), "What happens goes in the Game Log."],
    });
    if (what === "a") {
      const a = fx.actions.find((x) => x.id === id);
      if (!a) return undefined;
      const sp = a.cast ? content.byId(a.cast.spellId) : undefined;
      const labels = optionLabels(a);
      const dmg = (a.damage || []).filter((x) => x.dice).map((x) => `${x.dice} ${x.type}`.trim()).join(" + ");
      return out(a.name, [`From ${a.source}.`, firstLines(a.text) || (sp ? firstLines(sp.body) : "")], [
        takes(a.activation),
        labels ? `It uses the option picked in the menu beside it (${labels.slice(0, 4).join(", ")}${labels.length > 4 ? "…" : ""}).` : "",
        costLine(a.optionCosts && labels ? a.optionCosts[optionOf(a).i] ?? a.cost : a.cost),
        sp ? `Casts ${sp.name}${a.cast?.level ? ` at level ${a.cast.level}` : ""}${a.cast?.dc ? ` (save DC ${a.cast.dc})` : ""}${a.cast?.scroll ? " from the scroll" : ""}.` : "",
        a.attack ? `Makes ${a.attack.count > 1 ? `${a.attack.count} attacks` : "an attack"}${a.attack.weapon === "unarmed" ? " with Unarmed Strikes" : ""}, rolling each one.` : "",
        a.heal || a.healExpr ? `Rolls ${a.heal || "the healing"} and adds it to your Hit Points.` : "",
        a.tempHp ? `Gives you ${a.tempHp} Temporary Hit Points.` : "",
        dmg ? `Rolls ${dmg} damage.` : "",
        a.save ? `Targets make ${/^[aeiou]/i.test(a.save.ability) ? "an" : "a"} ${a.save.ability} saving throw${a.save.dc ? ` against DC ${a.save.dc}` : ""}${a.save.success ? `; ${a.save.success.toLowerCase()} on a success` : ""}.` : "",
        a.areas?.length ? `Covers a ${a.areas.join(" or ")}.` : "",
        a.consume ? `Uses up one ${a.consume} from your Inventory.` : "",
        a.creates ? "Conjures or bonds the item you pick, which shows in your Inventory." : "",
        a.summon ? "Summons the creature, which shows under Companions." : "",
        a.rollTable ? `Rolls ${a.rollTable.dice} on the ${a.rollTable.table} table${a.rollTable.keep === "either" ? " twice, and you keep either result" : ""}.` : "",
      ]);
    }
    if (what === "t") {
      const t = fx.toggles.find((x) => x.key === id);
      if (!t) return undefined;
      const on = isOn(t.key);
      return out(t.name, [`From ${t.source}.`, t.lines.length ? `While it’s on: ${t.lines.join("; ")}.` : ""], t.form ? [
        takes(t.activation), costLine(t.cost), "Opens the list of forms to choose from, then turns you into the one you pick: the sheet switches to its statistics until it ends.",
      ] : on ? [`It’s already on. End it under Effects (or Active now) to use it again.`] : [
        takes(t.activation), costLine(t.cost),
        `Turns it on: it shows under Active now and its effects apply to your sheet${t.duration ? ` ${/^(until|for|while)\b/i.test(t.duration) ? "" : "for "}${t.duration}` : ""}.`,
        t.ends ? `It ends ${t.ends.replace(/^ends? /i, "")}.` : Number.isFinite(t.minutes) ? "Rests end it when its time is up." : "",
      ]);
    }
    if (what === "g" || what === "go") {
      const [tk, optId] = what === "go" ? [id.slice(0, id.lastIndexOf(":")), id.slice(id.lastIndexOf(":") + 1)] : [id, ""];
      const t = fx.triggers.find((x) => x.key === tk);
      if (!t) return undefined;
      if (what === "go") {
        const o = t.options?.find((x) => x.id === optId);
        if (!o) return undefined;
        return out(`${t.name}: ${o.label}`, [firstLines(o.text, 3)], [
          `Adds this effect to your next ${t.name}${o.diceCost ? `, trading ${o.diceCost} of its damage dice for it` : ""}${o.save ? `; the target makes ${/^[aeiou]/i.test(o.save) ? "an" : "a"} ${o.save} saving throw${t.dc ? ` against DC ${t.dc}` : ""}` : ""}.`,
          `You can pick up to ${t.pick || 1} per use. Press it again to take it off.`,
        ]);
      }
      const dmg = (t.damage || []).filter((x) => x.dice).map((x) => `${x.dice} ${x.type}`.trim()).join(" + ");
      return out(t.name, [`From ${t.source}.`, t.when ? `When: ${t.when.replace(/\.$/, "")}.` : "", firstLines(t.text)], [
        t.reaction ? "Takes your Reaction." : "", costLine(t.cost),
        dmg ? `Rolls ${dmg} extra damage.` : "Notes that you used it.",
        t.options?.length ? `Any effects you picked beside it (up to ${t.pick || 1}) go with it.` : "",
      ]);
    }
    if (what === "cv") {
      const cv = fx.converts.find((x) => x.id === id);
      if (!cv) return undefined;
      return out(cv.name, [`From ${cv.source}.`], [takes(cv.activation),
        `Trades one thing for another: ${cv.options.map((o) => `${sideText(o.spend)} for ${sideText(o.gain)}`).slice(0, 4).join("; ")}.`,
        cv.perLong ? "Once per Long Rest." : "", cv.expires ? "Slots made this way vanish when you finish a Long Rest." : ""]);
    }
    if (what === "sp") {
      const how = id.slice(0, id.indexOf(":"));
      const sp = content.byId(id.slice(how.length + 1));
      if (!sp) return undefined;
      const lvl = spellInfo(sp)?.level || 0;
      const g = fx.grantedSpells.find((x) => x.spell.id === sp.id);
      const free = g?.free ? resources.find((r) => r.key === g.free) : undefined;
      const freeLeft = free ? free.max - (p.resUsed[free.key] || 0) : 0;
      const dur = stripMd(sp.fields["duration"] || "");
      const conc = /concentration/i.test(dur);
      const lowest = [...new Set(slots.map((x) => x.level))].sort((x, y) => x - y).find((L) => L >= lvl && slotLeft(L) > 0);
      const slotText = (L: number) => `Uses one of your level ${L} spell slots (you have ${slotLeft(L)} left)${L > lvl ? `, casting it at a higher level than its own (${lvl})` : ""}.`;
      const uses = how === "ritual" ? "Casts it as a Ritual: it takes 10 minutes longer and uses no spell slot."
        : how === "book" ? "Casts it as a Ritual straight from your spellbook: it takes 10 minutes longer and uses no spell slot."
        : how === "atwill" ? "You can cast it at will: no spell slot or use is spent."
        : how === "free" ? `Uses the free casting from ${g?.source || "your feature"} (${freeLeft} left), not a spell slot. ${free ? refreshText(free) : ""}`
        : /^\d+$/.test(how) ? slotText(+how)
        : lvl === 0 ? "It’s a cantrip, so it uses no spell slot."
        : lowest !== undefined ? slotText(lowest) : slotWhy(lvl);
      return out(sp.name, [
        `${sp.tagline || (lvl ? `Level ${lvl} spell` : "Cantrip")}. Casting time ${stripMd(sp.fields["casting time"] || "—")}, range ${stripMd(sp.fields["range"] || "—")}, duration ${dur || "—"}.`,
        firstLines(sp.body),
      ], [uses,
        "The sheet rolls what the spell calls for (attack rolls, damage, healing or the saving throw targets make) and adds anything it does to you under Active now.",
        conc ? "Starts Concentration, which ends any other spell you’re concentrating on." : "",
      ]);
    }
    return undefined;
  };
  const explainOf = (key: string): Ex | undefined => {
    if (key.startsWith("t:")) return { title: "", rows: [], total: "", notes: [key.slice(2)] };
    if (key.startsWith("do:")) return explainDo(key);
    const [kind, arg] = key.split(":");
    if (kind === "ab") {
      const a = arg;
      const rows = settle([{ label: `${a} modifier`, value: fmt(d.mods[a]) }, ...exBonus((t) => t === `check:${ab3(a)}` || t === "check:all")], d.mods[a] + fxPlus(`check:${ab3(a)}`) + fxPlus("check:all"));
      return { title: `${a} check`, rows, total: fmt(rows.reduce((n, r) => n + (parseInt(r.value.replace("−", "-"), 10) || 0), 0)), notes: [scoreNote(a), ...rollNotes({ kind: "check", ability: a })] };
    }
    if (kind === "sv") {
      const a = arg, sv = d.saves[a];
      const rows = settle([
        { label: `${a} modifier`, value: fmt(d.mods[a]) },
        ...(sv.prof ? [{ label: `Proficiency (${infos.find((i) => i.starting)?.cls.name || "class"} saving throw)`, value: fmt(d.pb) }] : []),
        ...exBonus((t) => t === `save:${ab3(a)}` || t === "save:all"),
      ], sv.value);
      return { title: `${a} saving throw`, rows, total: fmt(sv.value), notes: [...(sv.prof ? [] : ["Not proficient in this save."]), ...rollNotes({ kind: "save", ability: a })] };
    }
    if (kind === "sk") {
      const sk = arg, alt = skillAlt(sk), ab = alt?.ability || SKILL_ABILITY[sk], prof = d.skills[sk].prof;
      const bgHas = (bg?.fields["skill proficiencies"] || "").includes(sk);
      // a pick made in the builder (College of Lore's Bonus Proficiencies, Skilled…): name what it came from
      const picked = Object.entries(c.choices || {}).find(([k, v]) => v.includes(sk) && !/expertise/i.test(k))?.[0];
      const pickedFrom = picked ? content.byId(picked.split("#")[0])?.name || titleWords(picked.split("#")[0]) : undefined;
      const src = bgHas ? `${bg!.name} background` : c.classSkills.includes(sk) ? `${infos.find((i) => i.starting)?.cls.name || "class"} skill` : c.extraSkills.includes(sk) ? "chosen extra skill" : pickedFrom || "a feat or feature";
      const rows = settle([
        { label: `${ab} modifier${alt ? ` (${alt.source})` : ""}`, value: fmt(d.mods[ab]) },
        ...(prof ? [{ label: `Proficiency (${src})`, value: fmt(d.pb) }] : []),
        ...(prof && fx.expertise.has(sk) ? [{ label: "Expertise (proficiency again)", value: fmt(d.pb) }] : []),
        ...(!prof && fx.halfProficiency ? [{ label: `Half proficiency${infos.some((i) => i.cls.name === "Bard") ? " (Jack of All Trades)" : ""}: half of ${fmt(d.pb)}, rounded down`, value: fmt(Math.floor(d.pb / 2)) }] : []),
        ...exBonus((t) => t === `skill:${sk.toLowerCase().replace(/ /g, "-")}` || t === `check:${ab3(ab)}` || t === "check:all"),
      ], skillValue(sk));
      return { title: `${sk} check`, rows, total: fmt(skillValue(sk)), notes: [...(prof || fx.halfProficiency ? [] : ["Not proficient: just the ability modifier."]), ...rollNotes({ kind: "check", ability: ab, skill: sk, proficient: prof })] };
    }
    if (kind === "pp") {
      const rows = settle([{ label: "Base", value: "10" }, { label: "Perception check modifier", value: fmt(skillValue("Perception")) }], d.passivePerception, "Advantage, disadvantage or features");
      return { title: "Passive Perception", rows, total: String(d.passivePerception), notes: ["What you notice without rolling. Advantage adds 5, disadvantage takes 5 away."] };
    }
    if (kind === "pb") return { title: "Proficiency Bonus", rows: [{ label: `Character level ${c.level}`, value: fmt(d.pb) }], total: fmt(d.pb), notes: ["Set by your total level: +2 at levels 1–4, +3 at 5–8, +4 at 9–12, +5 at 13–16, +6 at 17–20. It's added to everything you're proficient in."] };
    if (kind === "init") {
      const listed = [{ label: "Dexterity modifier", value: fmt(d.mods.Dexterity) }, ...exBonus((t) => t === "initiative" || t === "init")];
      const gap = d.initiative - listed.reduce((n, r) => n + (parseInt(r.value.replace("−", "-"), 10) || 0), 0);
      const rows = settle(fx.halfProficiency && gap === Math.floor(d.pb / 2) ? [...listed, { label: `Half proficiency${infos.some((i) => i.cls.name === "Bard") ? " (Jack of All Trades)" : ""}`, value: fmt(gap) }] : listed, d.initiative);
      return { title: "Initiative", rows, total: fmt(d.initiative), notes: ["Rolled at the start of a fight to set the turn order.", ...rollNotes({ kind: "init", ability: "Dexterity" })] };
    }
    if (kind === "speed") return { title: "Speed", rows: [], total: `${speed} ft`, notes: [statTip.speed] };
    if (kind === "ac") {
      if (formCr) return { title: "Armor Class", rows: [], total: String(d.ac), notes: [statTip.ac] };
      const rows = d.acParts.map((x, i) => ({ label: x.label, value: i === 0 && x.value >= 0 ? String(x.value) : fmt(x.value) }));
      return { title: "Armor Class", rows: settle(rows, d.ac), total: String(d.ac), notes: ["An attack hits you if its roll equals or beats this."] };
    }
    if (kind === "dc") {
      const k = casters[0];
      if (!k) return undefined;
      const dcRows = settle([{ label: "Base", value: "8" }, { label: "Proficiency Bonus", value: fmt(d.pb) }, { label: `${k.ab} modifier`, value: fmt(k.mod) }], k.dc);
      return { title: `Spell save DC (${k.info.cls.name})`, rows: dcRows, total: String(k.dc), notes: [`Spell attack ${fmt(k.atk)} = Proficiency ${fmt(d.pb)} + ${k.ab} ${fmt(k.mod)}${k.atk - d.pb - k.mod ? ` ${fmt(k.atk - d.pb - k.mod)} from items and features` : ""}.`, ...casters.slice(1).map((x) => `${x.info.cls.name}: DC ${x.dc}, spell attack ${fmt(x.atk)} (${x.ab}).`)] };
    }
    if (kind === "hp") {
      const con = d.mods.Constitution;
      const rows = infos.flatMap((i) => {
        const die = hitDie(i.cls), avg = die / 2 + 1;
        return i.starting
          ? [{ label: `${i.cls.name} level 1: d${die} at its maximum ${die}, Con ${fmt(con)}`, value: fmt(die + con) },
             ...(i.level > 1 ? [{ label: `${i.cls.name} levels 2–${i.level}: ${i.level - 1} × (${avg} average + Con ${fmt(con)})`, value: fmt((i.level - 1) * (avg + con)) }] : [])]
          : [{ label: `${i.cls.name} ${i.level} level${i.level > 1 ? "s" : ""}: ${i.level} × (${avg} average + Con ${fmt(con)})`, value: fmt(i.level * (avg + con)) }];
      });
      return { title: "Hit Point maximum", rows: settle(rows, hpMax, "Feats and features (Tough, Dwarven Toughness…)"), total: String(hpMax), notes: [`Now ${hpCur} of ${hpMax}${p.hpTemp ? `, plus ${p.hpTemp} temporary` : ""}.`] };
    }
    if (kind === "atk") {
      const a = attacks[+arg];
      if (!a) return undefined;
      if (formCr) return { title: `${a.name}: attack`, rows: [], total: fmt(a.toHit), notes: [`The ${formCr.name}’s attack bonus.`] };
      const m = a.ability ? d.mods[a.ability] : 0;
      const rest = a.toHit - m, prof = rest >= d.pb && a.ability;
      const rows = settle([{ label: `${a.ability || "Ability"} modifier`, value: fmt(m) }, ...(prof ? [{ label: "Proficiency (you're trained with it)", value: fmt(d.pb) }] : [])], a.toHit, a.note || "Bonuses");
      return { title: `${a.name}: to hit`, rows, total: fmt(a.toHit), notes: [...(prof ? [] : a.ability ? ["Not proficient with this weapon, so no Proficiency Bonus."] : []), `Damage: ${a.damage} ${a.type}.`, ...rollNotes({ kind: "attack" })] };
    }
    const rest = key.slice(kind.length + 1);
    if (kind === "rest") {
      const pact = slots.some((x) => x.pact);
      const shortBits = [
        "features that recharge on a Short Rest come back",
        ...(pact ? ["your Pact Magic spell slots come back"] : []),
        "effects that last 1 hour or less end",
        `the Game Log offers Spend a Hit Die (you have ${hdLeft} left)`,
      ];
      const longBits = [
        `your Hit Points go back to ${hpMax} and Temporary Hit Points go away`,
        "all Hit Point Dice and spell slots come back",
        "features that recharge on a Long Rest come back",
        ...(p.exhaustion ? [`your Exhaustion level goes down to ${p.exhaustion - 1}`] : []),
        "active effects and Concentration end",
      ];
      const tidy = (xs: string[]) => `On this sheet, ${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}.`;
      if (arg === "short") return { title: "Short Rest", rows: [], total: "", notes: [ruleText("Short Rest"), tidy(shortBits)].filter(Boolean) };
      if (arg === "long") return { title: "Long Rest", rows: [], total: "", notes: [ruleText("Long Rest"), tidy(longBits), "After you finish a Long Rest, you must wait at least 16 hours before starting another one."].filter(Boolean) };
      return {
        title: "Rest", rows: [], total: "",
        notes: [
          `Opens Short Rest and Long Rest.${narrow ? " Turn Explainer Mode off to use it." : ""}`,
          `Short Rest: ${ruleText("Short Rest") || "a 1-hour period of downtime."}`,
          `Long Rest: ${ruleText("Long Rest") || "at least 8 hours of extended downtime."}`,
        ],
      };
    }
    if (kind === "insp") {
      const auto = fx.onLongRest.filter((x) => x.regain === "heroic-inspiration").map((x) => x.source);
      return {
        title: "Heroic Inspiration", rows: [], total: "",
        notes: [
          p.inspiration ? "You have it right now." : "You don't have it right now.",
          ruleText("Heroic Inspiration") || "If you have Heroic Inspiration, you can expend it to reroll any die immediately after rolling it, and you must use the new roll.",
          "You gain it when your GM awards it, or from a feature." + (auto.length ? ` You regain it on a Long Rest from ${auto.join(", ")}.` : ""),
          "Spending it here switches it off and notes it in your game log; roll the die again yourself.",
        ],
      };
    }
    if (kind === "def") {
      const x = rest.startsWith("form:") ? { text: rest.slice(5), feature: `${formCr?.name || "Wild Shape"} form` } : fx.defenses[+rest];
      if (!x) return undefined;
      const term = /immun/i.test(x.text) ? "Immunity" : /resist/i.test(x.text) ? "Resistance" : /vulnerab/i.test(x.text) ? "Vulnerability" : undefined;
      const cond = conditionEntries.find((e) => new RegExp(`\\b${e.name}\\b`, "i").test(x.text));
      return { title: x.text, rows: [], total: "", notes: [`From: ${x.feature}.`, ...(term ? [ruleText(term)] : []), ...(!term && /advantage/i.test(x.text) ? [ruleText("Advantage")] : []), ...(cond ? [`${cond.name}: ${firstPara(cond.body)}`] : [])].filter(Boolean) };
    }
    if (kind === "sense") {
      const all = [...fx.senses, ...(formCr?.senses ? [{ text: formCr.senses.replace(/;?\s*Passive Perception \d+/i, "").trim(), source: `${formCr.name} form` }] : [])];
      const x = all[+rest];
      if (!x) return undefined;
      const name = ["Blindsight", "Darkvision", "Tremorsense", "Truesight"].find((n) => new RegExp(n, "i").test(x.text));
      const range = x.text.match(/(\d+)\s*(?:ft|feet|foot)/i)?.[1];
      return { title: x.text, rows: [], total: "", notes: [`From: ${x.source}.`, ...(name ? [ruleText(name)] : []), ...(range ? [`Range: ${range} feet.`] : [])].filter(Boolean) };
    }
    if (kind === "passive") {
      const sk = rest, v = d.skills[sk]?.value ?? 0;
      const rows = [{ label: "Base", value: "10" }, { label: `${sk} check modifier`, value: fmt(v) }];
      const what = { Perception: "noticing things without searching for them, like a hidden creature or a trap", Investigation: "spotting clues and working things out without searching", Insight: "reading a creature's mood or catching a lie without trying" }[sk] || "";
      return { title: `Passive ${sk}`, rows, total: String(10 + v), notes: [`A passive check is a check made with no roll: 10 + the modifier. The GM uses it for ${what}. Advantage adds 5, Disadvantage takes 5 away.`] };
    }
    if (kind === "lang") {
      const [how, name] = [rest.split(":")[0], rest.split(":").slice(1).join(":")];
      const src = how === "common" ? "Every player character knows Common." : how === "origin" ? "One of the two languages you choose when you create your character (from the Standard Languages table, or a rare one with your GM's okay)." : `From: ${how}.`;
      return { title: name || "Language", rows: [], total: "", notes: [src, "Knowing a language means you can speak it, read it and write it."] };
    }
    if (kind === "tool") {
      const name = rest;
      const ent = content.byType("Tool").find((t) => slug(t.name.replace(/[’']/g, "")) === slug(name.replace(/[’']/g, "")));
      const srcs = Object.entries(fx.toolSources).filter(([k]) => slug(k.replace(/[’']/g, "")) === slug(name.replace(/[’']/g, "")) || slug(content.byType("Tool").find((t) => slug(t.name) === slug(k))?.name || "") === slug(name)).flatMap(([, v]) => v);
      const ab = ent?.fields["ability"];
      const abMod = ab && d.mods[ab] !== undefined ? d.mods[ab] : undefined;
      return {
        title: name, rows: abMod !== undefined ? [{ label: `${ab} modifier`, value: fmt(abMod) }, { label: "Proficiency Bonus", value: fmt(d.pb) }] : [], total: abMod !== undefined ? fmt(abMod + d.pb) : "",
        notes: [
          ...(srcs.length ? [`From: ${[...new Set(srcs)].join(", ")}.`] : []),
          ...(ent?.fields["utilize"] ? [`Use it to: ${plain(ent.fields["utilize"])}.`] : []),
          ...(ent?.fields["craft"] ? [`You can craft: ${plain(ent.fields["craft"])}.`] : []),
          "With proficiency you add your Proficiency Bonus to any ability check that uses the tool. If you're also proficient in the skill used for that check, you have Advantage on it too.",
        ],
      };
    }
    return undefined;
  };
  const exInfo = (() => {
    const ex = explain && exAt ? explainOf(exAt.key) : undefined;
    const how = exAt && CHANGE[exAt.key.split(":")[0]];
    const why = exAt?.el?.dataset.why;
    const ex2 = ex && why ? { ...ex, notes: [...ex.notes, `Right now you can’t: ${why}`] } : ex;
    return ex2 && how ? { ...ex2, notes: [...ex2.notes, `How to change it: ${how}`] } : ex2;
  })();
  // a control with no explanation of its own (or only its section's) still says what pressing it does
  const exFind = (t: EventTarget | null) => {
    if (!(t instanceof Element)) return null;
    const tagged = t.closest("[data-ex], [data-title]") as HTMLElement | null;
    const ctl = t.closest("button, summary, a[href], [role=button], [role=switch]") as HTMLElement | null;
    if (!ctl || !ctl.closest(".sheetv")) return tagged;
    const own = tagged && (tagged === ctl || ctl.contains(tagged) || (tagged.contains(ctl) && tagged.querySelectorAll("button, summary, a[href]").length <= 1));
    return own ? tagged : ctl;
  };
  const autoEx = (el: HTMLElement) => {
    const label = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").replace(/[▾✕]/g, "").trim();
    if (!label) return "";
    if (el.tagName === "SUMMARY") return `Shows or hides the full text of ${label.replace(/(Automated|Partly automated|Not automated)$/i, "").trim()}.`;
    if (el.tagName === "A") return `Opens ${label}.`;
    if (el.getAttribute("aria-pressed") !== null) return `${label}: press it to turn it ${el.getAttribute("aria-pressed") === "true" ? "off" : "on"}.`;
    if (el.getAttribute("aria-expanded") !== null) return `${label}: opens or closes it.`;
    return `Press “${label}” to use it.`;
  };
  const exKey = (el: HTMLElement) => el.dataset.ex ?? (el.dataset.title ? `t:${el.dataset.title}` : `t:${autoEx(el)}`);
  const exShow = (el: HTMLElement | null) => { if (el && exKey(el) !== "t:") setExAt({ key: exKey(el), rect: el.getBoundingClientRect(), el }); };

  const toggleInsp = () => { setPlay({ inspiration: !p.inspiration }); log({ title: p.inspiration ? "Used Heroic Inspiration" : "Gained Heroic Inspiration", total: "", cls: "event", detail: p.inspiration ? "Reroll any die immediately after rolling it." : "" }); };
  const trayEl = (
    <div className="tray">
      <div className="dbtns">
        {[4, 6, 8, 10, 12, 20, 100].map((f) => (
          <button key={f} className="dbtn" title={HOW.die} onClick={() => {
            const r = roll(`1d${f}`)!;
            log({ title: `d${f}`, total: String(r.total), cls: f === 20 && r.total === 20 ? "crit" : "roll", detail: esc(describeRolled(r)) });
          }}>d{f}</button>
        ))}
      </div>
      <form className="custom" onSubmit={(e) => {
        e.preventDefault();
        const r = roll(custom);
        if (!r) { log({ title: "Couldn’t read that roll", total: "", cls: "event", detail: `Try something like 2d6+1d4+3.` }); return; }
        log({ title: custom.replace(/\s+/g, ""), total: String(r.total), cls: "roll", detail: `${eqOf(r)}${esc(describeRolled(r))}` });
      }}>
        <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. 2d6+1d4+3" aria-label="Custom roll" title={HOW.custom} />
        <button className="sbtn sm" title={HOW.custom}>Roll</button>
      </form>
    </div>
  );
  const chipsEl = (
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
      {p.inspiration && <span className="schip gold" data-ex="insp">★ Heroic Inspiration</span>}
    </div>
  );
  // ---------- phone layout: one section at a time under a header that stays on screen ----------
  const MSECS: [string, string, number?][] = [
    ["abil", "Abilities & Saves"], ["skills", "Skills"], ["tab:actions", "Actions"],
    ...(anyCaster || fx.grantedSpells.length > 0 ? [["tab:spells", "Spells"] as [string, string]] : []),
    ["tab:inventory", "Inventory"], ["tab:features", "Features & Feats"],
    ["tab:effects", "Effects", activeList.length], ["tab:conditions", "Conditions", p.conditions.length + (p.exhaustion ? 1 : 0)],
    ["profs", "Defenses, Senses, Languages & Tools"], ["tab:background", "Background"], ["tab:notes", "Notes"], ["log", "Game Log"],
  ];
  const msecKey = msec === "tab" ? `tab:${tab}` : msec;
  const msecLabel = MSECS.find((m) => m[0] === msecKey)?.[1] || "Sections";
  const goSec = (k: string) => {
    setMsheet("");
    if (k === "log") { openLog(); return; }
    if (k.startsWith("tab:")) { setTab(k.slice(4) as Tab); setMsec("tab"); } else setMsec(k);
    window.scrollTo(0, 0);
  };
  if (logSeen.current === undefined) logSeen.current = p.log[0]?.id ?? "";
  const unread = (() => { const i = p.log.findIndex((e) => e.id === logSeen.current); return i === -1 ? p.log.length : i; })();
  const openLog = () => { logSeen.current = p.log[0]?.id ?? ""; setLogHidden(false); setLogOpen(true); setToast(undefined); setMsheet(""); };
  const closeLog = () => { logSeen.current = p.log[0]?.id ?? ""; setLogHidden(true); setLogOpen(false); };
  const pickBackdrop = (id: string) => { dirty.current = true; setC((prev) => (prev ? { ...prev, sheetBackground: id || undefined } : prev)); };
  /** Upload the character's own backdrop (replacing the last one) and switch to it. */
  const uploadBackdrop = async (file: File) => {
    setBgError("");
    setBgBusy(true);
    try {
      const stored = await uploadBackground(c.id, file, c.customBackground);
      dirty.current = true;
      setC((prev) => (prev ? { ...prev, customBackground: stored, sheetBackground: CUSTOM_BACKGROUND } : prev));
    } catch (e) {
      setBgError(e instanceof Error ? e.message : String(e));
    } finally {
      setBgBusy(false);
    }
  };
  const removeBackdrop = async () => {
    setBgError("");
    const old = c.customBackground;
    dirty.current = true;
    setC((prev) => (prev ? { ...prev, customBackground: undefined, sheetBackground: prev.sheetBackground === CUSTOM_BACKGROUND ? undefined : prev.sheetBackground } : prev));
    await removeBackground(old);
  };
  /** The backdrop choices (None, each image, then the character's own), for the toolbar menu and the phone Sections menu. */
  const bgOptions = (done: () => void) => (
    <>
      {[{ id: "", name: "None", thumb: "" }, ...SHEET_BACKGROUNDS.filter((b) => !hiddenBgs.includes(b.id))].map((b) => {
        const on = (c.sheetBackground || "") === b.id;
        return (
          <button key={b.id || "none"} role="menuitemradio" aria-checked={on} className={`bgopt ${on ? "on" : ""}`} onClick={() => { pickBackdrop(b.id); done(); }}>
            <span className="bgthumb" style={b.thumb ? { backgroundImage: `url(${b.thumb})` } : undefined}>{!b.thumb && "—"}</span>
            <span>{b.name}</span>
          </button>
        );
      })}
      {library.map((b) => {
        const id = LIBRARY_PREFIX + b.id, on = c.sheetBackground === id;
        return (
          <button key={id} role="menuitemradio" aria-checked={on} className={`bgopt ${on ? "on" : ""}`} onClick={() => { pickBackdrop(id); done(); }}>
            <StoredThumb className="bgthumb" stored={`storage:${b.thumb || b.path}`} />
            <span>{b.name}</span>
          </button>
        );
      })}
      {c.customBackground ? (
        <button role="menuitemradio" aria-checked={c.sheetBackground === CUSTOM_BACKGROUND} className={`bgopt ${c.sheetBackground === CUSTOM_BACKGROUND ? "on" : ""}`}
          onClick={() => { pickBackdrop(CUSTOM_BACKGROUND); done(); }}>
          <span className="bgthumb" style={customUrl ? { backgroundImage: `url("${customUrl}")` } : undefined}>{!customUrl && "…"}</span>
          <span>Your image</span>
        </button>
      ) : (
        <button role="menuitem" className="bgopt" disabled={bgBusy} onClick={() => bgFile.current?.click()}>
          <span className="bgthumb bgup">{bgBusy ? "…" : "+"}</span>
          <span>{bgBusy ? "Uploading…" : "Upload"}</span>
        </button>
      )}
      <div className="bgfoot">
        {c.customBackground && (
          <>
            <button className="sbtn ghost sm" disabled={bgBusy} onClick={() => bgFile.current?.click()}>{bgBusy ? "Uploading…" : "Replace your image"}</button>
            <button className="sbtn ghost sm" disabled={bgBusy} onClick={removeBackdrop}>Remove it</button>
          </>
        )}
        <span className="faint">One image of your own per character. It’s resized and saved as a small WebP file.</span>
        {bgError && <span className="bgerr" role="alert">{bgError}</span>}
      </div>
    </>
  );
  const bgInput = (
    <input ref={bgFile} type="file" accept="image/*" hidden aria-label="Upload a background image"
      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadBackdrop(f); }} />
  );

  const phoneTop = narrow && (
    <div className="mtop">
      <div className="mhd">
        <div className="mname">
          <div className="mrow1">
            <h1 className="disp">{c.name || "Unnamed character"}</h1>
            {editable && <Link className="medit" title="Change your species, class, ability scores, feats and other choices in the character builder." to={`/build/${c.id}`}>Edit</Link>}
          </div>
          <div className="msub">{sp?.name} · {infos.length > 1 ? classLabel(infos) : `${cls?.name} ${c.level}`}</div>
        </div>
        <button className="mib" data-ex="rest" aria-label="Short or Long Rest" onClick={() => setMsheet("rest")}>{CAMP_ICON}</button>
        <button className={`mib ${p.inspiration ? "on" : ""}`} data-ex="insp" aria-pressed={!!p.inspiration} aria-label="Heroic Inspiration" title={p.inspiration ? "Heroic Inspiration: you have it. Tap to use it." : "Heroic Inspiration: tap when you gain it."} onClick={toggleInsp}>★</button>
      </div>
      <div className="mstat">
        <span className="stat frm shield" data-ex="ac"><div className="sl">AC</div><div className="sv2">{d.ac}</div></span>
        <button className="stat frm notch" data-ex="init" onClick={() => test("Initiative", d.initiative, { kind: "init", ability: "Dexterity" })}><div className="sl">Init</div><div className="sv2">{fmt(d.initiative)}</div></button>
        <span className="stat frm notch" data-ex="speed"><div className="sl">Speed</div><div className="sv2">{speed}</div></span>
        <div className="mhp" data-ex="hp" onClick={() => setMsheet("hp")}>
          <div className="mhpn">
            <div><span className="sl">HP</span> <b className={hpCur === 0 ? "bad" : ""}>{hpCur}</b><span className="mut">/{hpMax}</span>{p.hpTemp > 0 && <span className="temp"> +{p.hpTemp}</span>}</div>
            <div className="hbar"><div style={{ width: `${pct}%` }} className={pct < 25 ? "low" : pct < 50 ? "mid" : ""} /></div>
          </div>
          <div className="mhpb">
            <button className="sbtn grn" title={`Opens the Hit Points panel to heal. ${HOW.heal}`} onClick={(e) => { e.stopPropagation(); setMsheet("hp"); }}>Heal</button>
            <button className="sbtn red" title={`Opens the Hit Points panel to take damage. ${HOW.damage}`} onClick={(e) => { e.stopPropagation(); setMsheet("hp"); }}>Damage</button>
          </div>
        </div>
      </div>
      <div className="mcond">
        {p.conditions.length + activeList.length + (p.exhaustion ? 1 : 0) + (p.concentration ? 1 : 0) + (p.inspiration ? 1 : 0) === 0
          ? <button className="schip" title="You have no conditions or effects on you. Press it to open Conditions and add one (Poisoned, Prone, Exhaustion…)." onClick={() => goSec("tab:conditions")}>Conditions: none · add</button>
          : chipsEl}
        {castAb && <span className="mdc" data-ex="dc">DC {casters.length > 1 && new Set(casters.map((k) => k.dc)).size > 1 ? casters.map((k) => k.dc).join("/") : spellDC} · atk {fmt(casters[0]?.atk ?? spellAtk)}</span>}
      </div>
      {!editable && <div className="schip conc">Viewing {session.nameOf(row?.owner)}’s character. Rolls work but changes aren’t saved.</div>}
      {cloud && row?.hidden && <div className="schip">Hidden from the group</div>}
      <button className="msecbar" data-exnav aria-haspopup="dialog" title="Opens the list of sections (Skills, Actions, Spells, Inventory…) to jump to another part of the sheet." onClick={() => setMsheet("menu")}>
        <span className="mgrid">{GRID_ICON}</span><span className="msl">{msecLabel}</span><span aria-hidden="true" className="mchev">▾</span>
      </button>
    </div>
  );
  const phoneBits = narrow && (
    <>
      {msheet && <div className="mback" onClick={() => setMsheet("")} />}
      {msheet === "menu" && (
        <div className="msheet mmenu" role="dialog" aria-label="Sections">
          <div className="mshh"><span className="mgrid">{GRID_ICON}</span><span className="disp">Sections</span><button className="mx" aria-label="Close" onClick={() => setMsheet("")}>✕</button></div>
          {MSECS.map(([k, l, n]) => (
            <button key={k} className={`mitem ${k === msecKey ? "on" : ""}`} onClick={() => goSec(k)}>
              <span className={`dot ${k === msecKey ? "p1" : ""}`} />{l}{!!n && <span className="badge">{n}</span>}
            </button>
          ))}
        </div>
      )}
      {msheet === "rest" && (
        <div className="msheet" role="dialog" aria-label="Rest">
          <div className="mshh"><span className="disp">Rest</span><button className="mx" aria-label="Close" onClick={() => setMsheet("")}>✕</button></div>
          <button className="sbtn" data-ex="rest:short" onClick={() => { setMsheet(""); shortRest(); }}>Short Rest</button>
          <button className="sbtn" data-ex="rest:long" onClick={() => { setMsheet(""); longRest(); }}>Long Rest</button>
          <p className="note">{HOW.rests}</p>
        </div>
      )}
      {!msheet && (logHidden || !logOpen) && (
        <>
          <button className="mfab dice" aria-label="Dice and roll options" onClick={() => setMsheet("dice")}>{D20_ICON}</button>
          <button className="mfab logb" aria-label="Open the Game Log" onClick={openLog}>{SCROLL_ICON}{unread > 0 && <span className="mbadge">{unread > 9 ? "9+" : unread}</span>}</button>
        </>
      )}
    </>
  );
  const phoneStats = narrow && (
    <section className="spanel mstats">
      <span className="mst" data-ex="pb"><span className="sl">Proficiency Bonus</span><b>{fmt(d.pb)}</b></span>
      <span className="mst" data-ex="pp"><span className="sl">Passive Perception</span><b>{d.passivePerception}</b></span>
      {castAb && <button className="mst" data-ex="dc" onClick={() => attack({ name: "Spell", toHit: spellAtk, damage: "0", type: "", note: "" })}><span className="sl">Spell Save DC</span><b>{spellDC}</b></button>}
    </section>
  );

  return (
    <TipsOn.Provider value={explain}>
    <div ref={rootRef} data-msec={msec} data-tab={tab} className={`sheetv ${narrow ? `phone ms-${msheet || "none"}` : ""} ${narrow && logHidden ? "loghid" : ""} ${critFx === "flash" ? "critfx" : critFx ? `crit-${critFx}` : ""} ${explain ? "explain" : ""}`}
      onMouseOver={explain && !narrow ? (e) => { const el = exFind(e.target); if (el && el !== exAt?.el) exShow(el); } : undefined}
      onMouseLeave={explain && !narrow ? () => setExAt(undefined) : undefined}
      onMouseOut={explain && !narrow ? (e) => { if (!exFind(e.relatedTarget)) setExAt(undefined); } : undefined}
      onClickCapture={explain && narrow ? (e) => {
        // phones and tablets have no hover: a tap explains instead of rolling
        // getting around (tabs, filters, the section menu, the Explainer Mode switch) and controls with no explanation of their own still work
        const el = exFind(e.target);
        lastTap.current = e.target instanceof Element ? (e.target.closest("button, a, [role=button]") as HTMLElement | null) : null;
        if (el && (el.dataset.ex || el.dataset.title) && !el.closest("[data-exnav]")) { e.preventDefault(); e.stopPropagation(); exShow(el); } else setExAt(undefined);
      } : undefined}>
      {editable && bgInput}
      {backdropUrl && <div className="sheetbg" aria-hidden="true" style={{ backgroundImage: `url("${backdropUrl}")` }} />}
      {drawerPanel()}
      {dmgPick && (
        <div className="castmenu dmgpick" role="menu" aria-label={`Choose the damage type for ${dmgPick.title}`} style={{ left: dmgPick.x, top: dmgPick.y }}>
          <div className="dmgpickhd">{dmgPick.title}: damage type</div>
          {dmgPick.types.map((t) => (
            <button key={t} role="menuitem" className={lastDmgType.current.get(dmgPick.title.replace(/ \(two hands\)$/, "")) === t ? "on" : ""} data-ex={`t:Rolls ${dmgPick.title}’s damage as ${damageName(t)} damage.`} onClick={() => dmgPick.go(t)}>
              <b><span className="dmgdot" style={{ background: (document.documentElement.dataset.theme === "light" ? DAMAGE_COLOR_LIGHT : DAMAGE_COLOR)[t] }} />{damageName(t)}</b>
            </button>
          ))}
        </div>
      )}
      {diceFx && (
        <div key={diceFx.key} className={`dice3d ${critFx === "out" || critFx === "back" ? "critd" : ""}`} aria-hidden="true" style={diceFx.ms && diceFx.ms !== 1700 ? { animationDuration: `${diceFx.ms}ms` } : undefined}>
          {diceFx.crit && <div className="critlab">Critical Hit</div>}
          {/* the dice sit in their own row so the damage dial centres on them, not on the modifier beside them */}
          <div className="dicerow">
          {diceFx.dial && <DamageDial parts={diceFx.dial} delay={diceFx.hold || 0} />}
          {diceFx.dice.map((x, i) => (
            <div key={i} className="diewrap" style={{ animationDelay: `${i * 60}ms` }}>
            <div className={`die3d d${[4, 6, 8, 10, 12, 20].includes(x.sides) ? x.sides : "x"} ${x.kept ? "" : "dropped"} ${diceFx.crit && x.sides === 20 && x.kept ? "crit" : ""}`}
              style={{ animationDelay: `${i * 60}ms`, ["--spin" as string]: `${(i % 2 ? -1 : 1) * (540 + ((i * 97) % 300))}deg` }}>
              <span style={{ animationDelay: `${i * 60}ms` }}>{x.value}</span>
            </div>
            </div>
          ))}
          </div>
          {diceFx.mod !== 0 && (
            <div className="dmod" style={{ animationDelay: `${diceFx.dice.length * 60 + 450}ms`, ["--tilt" as string]: `${diceFx.tilt.toFixed(1)}deg` }}>
              {diceFx.mod < 0 ? "−" : "+"}{Math.abs(diceFx.mod)}
            </div>
          )}
        </div>
      )}
      <div className="smain">
        {phoneTop}
        <section className="ident" {...bo("ident")}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <h1 className="disp">{c.name || "Unnamed character"}</h1>
                {editable && <Link className="sbtn ghost sm" title="Change your species, class, ability scores, feats and other choices in the character builder." to={`/build/${c.id}`} style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Edit in builder</Link>}
                {editable && (() => {
                  // picks still to make (a new feature, or an old pick that's no longer allowed)
                  const open = fx.pending.filter((pc) => pc.options && pc.options.length > 0 && pc.chosen.length < Math.min(pc.count, pc.options.length));
                  return open.length > 0 && (
                    <Tip tip={`Still to choose: ${open.map((pc) => pc.label).join("; ")}`}>
                      <Link className="tag warn" to={`/build/${c.id}`} style={{ alignSelf: "center", textDecoration: "none" }}>{open.length} choice{open.length > 1 ? "s" : ""} left</Link>
                    </Tip>
                  );
                })()}
              </div>
              <div className="sub">
                Level {c.level} {sp?.name}{c.speciesChoice ? ` (${c.speciesChoice})` : ""}{" "}
                {infos.length > 1 ? classLabel(infos) : cls?.name}
                {infos.filter((i) => i.sub).map((i) => ` · ${i.sub!.name}`).join("")}{bg ? ` · ${bg.name}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <div className="restpick" ref={restRef}>
                <button className={`restbtn ${restOpen ? "on" : ""}`} data-ex="rest" aria-label="Short or Long Rest" aria-haspopup="true" aria-expanded={restOpen} onClick={() => setRestOpen((o) => !o)}>{CAMP_ICON}</button>
                {restOpen && (
                  <div className="restmenu" role="menu" aria-label="Rest">
                    <button role="menuitem" className="sbtn" data-ex="rest:short" onClick={() => { setRestOpen(false); shortRest(); }}>Short Rest</button>
                    <button role="menuitem" className="sbtn" data-ex="rest:long" onClick={() => { setRestOpen(false); longRest(); }}>Long Rest</button>
                  </div>
                )}
              </div>
              <span className="hsep mobonly" aria-hidden="true" />
              <button className="sbtn ghost sm mobonly" title="Change the order of the boxes on the sheet (phone layout)" onClick={() => setLayoutOpen(true)}>Change layout</button>
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
          {chipsEl}
        </section>

        <section className="stats" {...bo("stats")}>
          <span className="stat frm shield" data-ex="ac"><div className="sl">Armor</div><div className="sv2">{d.ac}</div><div className="sl">Class</div></span>
          <button className="stat frm notch" data-ex="init" onClick={() => test("Initiative", d.initiative, { kind: "init", ability: "Dexterity" })}><div className="sl">Initiative</div><div className="sv2">{fmt(d.initiative)}</div></button>
          <span className="stat frm notch" data-ex="speed"><div className="sl">Speed</div><div className="sv2">{speed} ft</div><div className="ss">{speed === 0 && d.speed ? "conditions" : ""}</div></span>
          <span className="stat frm notch" data-ex="pb"><div className="sl">Proficiency</div><div className="sv2">{fmt(d.pb)}</div><div className="ss" /></span>
          <span className="stat frm notch" data-ex="pp"><div className="sl">Passive Perception</div><div className="sv2">{d.passivePerception}</div><div className="ss" /></span>
          {castAb && (
            <button className="stat spell" data-ex="dc" onClick={() => attack({ name: "Spell", toHit: spellAtk, damage: "0", type: "", note: "" })}>
              <div className="sl">Spell Save DC</div>{casters.length > 1 && new Set(casters.map((k) => k.dc)).size > 1 ? <div className="sv2">{casters.map((k) => k.dc).join(" / ")}</div> : <div className="sv2 gemv">{spellDC}</div>}
              <div className="ss">{casters.length > 1 && new Set(casters.map((k) => `${k.ab}${k.atk}`)).size > 1 ? casters.map((k) => `${k.info.cls.name} ${fmt(k.atk)}`).join(" · ") : `atk ${fmt(casters[0]?.atk ?? spellAtk)} · ${ABBR[casters[0]?.ab || castAb]}`}</div>
            </button>
          )}
        </section>

        <section className="abil" {...bo("abil")}>
          {ABILITIES.map((a) => (
            <div key={a} className="ab">
              <div className="abf frm cut">
                <div className="abn" title={a}>{a.slice(0, 3)}</div>
                <button className="abm" data-ex={`ab:${a}`} title={`Roll ${a} check`} onClick={() => test(`${a} check`, d.mods[a], { kind: "check", ability: a })}>{fmt(d.mods[a])}</button>
              </div>
              <div className="abs" title={`${a} score`}>{d.scores[a]}</div>
              <button className={`sv ${d.saves[a].prof ? "p" : ""}`} data-ex={`sv:${a}`} title={`Roll ${a} save`} onClick={() => test(`${a} save`, d.saves[a].value, { kind: "save", ability: a })}>
                <span className={`dot ${d.saves[a].prof ? "p1" : ""}`} />Save {fmt(d.saves[a].value)}
              </button>
            </div>
          ))}
        </section>

        {phoneStats}

        <div className="cols">
          <div className="left">
            <section className="spanel skills" {...bo("skills")}>
              <h3>Skills</h3>
              {SKILLS.map((s) => (
                <button key={s} className="sk" data-ex={`sk:${s}`} title={skillAlt(s) ? `Using ${skillAlt(s)!.ability} (${skillAlt(s)!.source})` : undefined}
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
                            <Tip tip={s.pact ? `Pact Magic, from your ${pactClass || "Warlock"} class (gained at level 1): these slots come back on a Short or Long Rest.` : `Level ${s.level} spell slots, from your ${slotClasses || "class's"} spellcasting: they come back on a Long Rest.`}><span className="sl">{s.pact && slots.some((x) => !x.pact) ? "Pact " : ""}L{s.level}</span></Tip>
                            {/* a negative count is extra slots (created with Font of Magic; gone after a Long Rest) */}
                            <Pips what={`${s.pact ? "Pact Magic" : `Level ${s.level}`} spell slots (casting a spell with the sheet’s Cast buttons marks them for you)`} n={s.max + Math.max(0, -(p.slotsUsed[key] || 0))} used={Math.max(0, p.slotsUsed[key] || 0)} onToggle={(i) => setPlay((cur) => {
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
                    <Tip tip={`${sourceText(r)} ${r.die ? `Each is a ${r.die}. ` : ""}${refreshText(r)}`.trim()}><span className="sl">{r.name}{r.die ? ` (${r.die})` : ""}</span></Tip>
                    {r.max <= 10 ? (
                      <Pips what={`${r.name}. ${refreshText(r)}`} n={r.max} used={p.resUsed[r.key] || 0} onToggle={(i) => setPlay((cur) => ({ resUsed: { ...cur.resUsed, [r.key]: i < (cur.resUsed[r.key] || 0) ? i : i + 1 } }))} />
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
                    <button key={k} data-exnav className={tab === k ? "on" : ""} title={`Shows the ${l} tab.`} onClick={() => setTab(k)}>
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
                      <button key={k2} data-exnav className={actFilter === k2 ? "on" : ""} aria-pressed={actFilter === k2} title={k2 === "all" ? "Shows everything you can do." : k2 === "limited" ? "Shows the features you can only use a few times, with the uses you have left." : `Shows only what takes ${k2 === "attack" ? "an attack" : k2 === "other" ? "no action, or something other than an Action, Bonus Action or Reaction" : `${k2 === "action" ? "an" : "a"} ${l}`}.`} onClick={() => setActFilter(k2)}>{l}</button>
                    ))}
                  </div>
                  {actFilter === "limited" && limitedSection()}
                  {(actFilter === "all" || actFilter === "attack") && <>
                  {d.attacksPerAction > 1 && <p className="note" style={{ marginTop: 0 }}>When you take the Attack action, you attack <b>{d.attacksPerAction} times</b>.</p>}
                  <table className="atks atkmain">
                    <thead><tr><th>Attack</th><th>Hit / DC</th><th>Damage</th><th></th></tr></thead>
                    <tbody>
                      {attacks.map((a, i) => (
                        <tr key={`${a.name}-${i}`}>
                          <td><b>{a.name}</b><div className="note">{a.note}</div>{chargesOf(a.itemId)}</td>
                          <td><span data-ex={`atk:${i}`}>{fmt(a.toHit)}</span></td>
                          <td>{a.baseDamage ?? a.damage} {a.type}{a.extra ? ` + ${a.extra}` : ""}{a.versatile ? <div className="note">two hands {a.baseVersatile ?? a.versatile}{a.extra ? ` + ${a.extra}` : ""}</div> : null}</td>
                          <td>
                            <div className="rowbtn">
                              <button className="sbtn sm" title={HOW.attack} onClick={() => attack(a)}>Attack</button>
                              {(() => {
                                const c = critFor?.name === a.name;
                                const type = a.extra ? `${a.type}, plus ${a.extra}` : a.type;
                                return (
                                  <>
                                    <button className={`sbtn sm ${c ? "critbtn" : "ghost"}`} title={c ? "Your last roll with this attack was a Critical Hit: this rolls its damage dice twice." : HOW.dmg}
                                      onClick={() => rollDamage(a.name, a.damage, c, type, false, dmgMods(a, false))}>{c ? "Crit damage" : "Damage"}</button>
                                    {/* Versatile: the attack roll is the same either way; held in two hands it deals more damage */}
                                    {a.versatile && <button className={`sbtn sm ${c ? "critbtn" : "ghost"}`} title={`${c ? "Your last roll with this attack was a Critical Hit: this rolls the two-handed damage dice twice. " : ""}Rolls ${a.name}’s damage held in two hands (Versatile): ${a.versatile} instead of ${a.damage}, and adds it to the Game Log.`}
                                      onClick={() => rollDamage(`${a.name} (two hands)`, a.versatile!, c, type, false, dmgMods(a, true))}>{c ? "Crit, two hands" : "Two hands"}</button>}
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {fx.actions.filter(isSpecialAttack).map((a) => {
                        const { res, left, ok } = costInfo(a.cost);
                        const ai = Math.min(areaPick[a.id] ?? 0, (a.areas?.length || 1) - 1);
                        return (
                          <tr key={`sa-${a.id}`}>
                            <td><b>{a.name}</b><div className="note">{[a.activation, a.source !== a.name ? a.source : ""].filter(Boolean).join(" · ")}</div>{res && <div className="note">{left} / {res.max} use{res.max === 1 ? "" : "s"} · {res.recover === "short" ? "Short or Long Rest" : res.recover === "long" ? "Long Rest" : res.recover === "dawn" ? "dawn" : "no recharge"}</div>}</td>
                            <td>{a.save ? <span title={a.save.success === "half" ? "Targets take half damage on a success" : undefined}>{a.save.ability.slice(0, 3).toUpperCase()} {a.save.dc ?? ""}</span> : "—"}</td>
                            <td>
                              {a.damage!.map((x) => `${x.dice} ${x.type}`.trim()).join(" + ")}
                              {a.areas && a.areas.length > 1 ? (
                                <div><select className="optpick" aria-label={`${a.name}: shape`} value={ai} onChange={(e) => setAreaPick((m) => ({ ...m, [a.id]: +e.target.value }))}>
                                  {a.areas.map((o, i) => <option key={o} value={i}>{o}</option>)}
                                </select></div>
                              ) : a.areas?.[0] ? <div className="note">{a.areas[0]}</div> : null}
                              {a.save?.success === "half" && <div className="note">Half damage on a successful save</div>}
                            </td>
                            <td><div className="rowbtn"><Btn data-ex={`do:a:${a.id}`} className="sbtn sm" disabled={!ok} why={actWhy(a)} onClick={() => runFeature(a, undefined, { roll: true, area: a.areas?.[ai] })}>Use</Btn></div></td>
                          </tr>
                        );
                      })}
                      {spellAttackRows()}
                    </tbody>
                  </table>
                  <p className="note" style={{ marginTop: 10 }}>{formCr ? <>In {formCr.name} form you attack with its natural weapons. </> : null}Attacks come from the weapons equipped in your <button className="linkish" title="Shows the Inventory tab, where you equip weapons and armor." onClick={() => setTab("inventory")}>Inventory</button>{formCr ? "" : " and your spells that make attack rolls"}.{d.critRange < 20 ? ` Your weapon attacks score a Critical Hit on a ${d.critRange}–20.` : ""}</p>
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
                                  <td><div className="rowbtn">{b.buttons.map((x) => <Btn key={x.label} data-ex={x.ex} className={`sbtn sm ${x.ghost ? "ghost" : ""}`} disabled={x.disabled} why={x.why} onClick={x.run}>{x.label}</Btn>)}</div></td>
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
                  {(actFilter === "all" || actFilter === "action" || actFilter === "other") && fx.actions.some((x) => !isSpecialAttack(x) && !isBonus(x.activation) && !/reaction/i.test(x.activation) && (actFilter === "other" ? !isActionAct(x.activation) : actFilter === "action" ? isActionAct(x.activation) : true)) && (
                    <table className="atks" style={{ marginTop: 14 }}>
                      <thead><tr><th>Feature or item</th><th>Uses</th><th>Effect</th><th></th></tr></thead>
                      <tbody>
                        {fx.actions.filter((x) => !isSpecialAttack(x) && !isBonus(x.activation) && !/reaction/i.test(x.activation) && (actFilter === "other" ? !isActionAct(x.activation) : actFilter === "action" ? isActionAct(x.activation) : true)).map((a) => {
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
                              <td><div className="rowbtn"><Btn data-ex={`do:a:${a.id}`} className="sbtn sm" onClick={() => runFeature(a, optionLabels(a) ? optionOf(a).i : undefined)} disabled={(optionLabels(a) ? !optionOf(a).ok : !ok) || (!!a.cast?.scroll && !scrollUse(a.cast.scroll).readable)} why={actWhy(a, optionLabels(a) ? optionOf(a) : undefined)}>{a.cast ? "Cast" : "Use"}</Btn></div></td>
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
                        <span key={x.name}>{j ? ", " : ""}<button className="linkish" title={`${x.name}: ${x.text} Press it for more.`} onClick={() => setDrawer({ kind: "feature", title: x.name, sub: "Action everyone can take", md: x.text })}>{x.name}</button></span>
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
                              <Btn data-ex={`do:t:${t.key}`} className="sbtn sm" disabled={!ok} why={whyNot(t.cost, t.name)} onClick={() => (t.form ? openForms() : switchOn(t))}>{t.form ? "Choose form" : "Use"}</Btn>
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
                                <td>{t.text}{t.auto && <div className="note">{t.onHit ? "Already added to your attacks' damage." : "Happens automatically."}</div>}</td>
                                <td>{res ? `${left} / ${res.max}` : ""}</td>
                                <td>{res && t.cost && (
                                  <Btn data-ex={`do:g:${t.key}`} className="sbtn sm" disabled={!ok} why={whyNot(t.cost, t.name)} onClick={() => useTrigger(t)}>Use</Btn>
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
                      <button key={k2} data-exnav className={featFilter === k2 ? "on" : ""} aria-pressed={featFilter === k2} title={k2 === "all" ? "Shows all your features, traits and feats." : `Shows only your ${l.toLowerCase()}.`} onClick={() => setFeatFilter(k2)}>{l}</button>
                    ))}
                  </div>
                  {featFilter === "all" && restChoicesPanel()}
                  {(featFilter === "all" || featFilter === "class") && allFeats.map((f, i) => (
                    <details key={`f${i}`} className="feat" open={featFilter === "class" || undefined}>
                      <summary data-exnav title="Shows or hides this feature’s full text and anything you can use from it. The tag says whether the sheet applies it for you (Automated) or you track it yourself.">{f.name} <span className="mut">· {f.src === f.classLevel.replace(/ \d+$/, "") ? f.classLevel : `${f.src} · ${f.classLevel}`}</span>{featureBadges(f.name)}{autoTag(infos.flatMap((i) => [i.cls, i.sub]).find((e) => e?.name === f.src)?.id, f.name)}</summary>
                      <Md md={(() => { const k = infos.find((x) => x.cls.name === f.src || x.sub?.name === f.src); return k ? trimClassTable(f.md, k.cls.name, k.level) : f.md; })()} />
                      {featureExtras(f.name)}
                    </details>
                  ))}
                  {(featFilter === "all" || featFilter === "species") && traits(sp).map((t, i) => (
                    <details key={`t${i}`} className="feat" open={featFilter === "species" || undefined}>
                      <summary data-exnav title="Shows or hides this feature’s full text and anything you can use from it. The tag says whether the sheet applies it for you (Automated) or you track it yourself.">{t.name} <span className="mut">· {sp!.name}</span>{featureBadges(t.name)}{autoTag(sp?.id, t.name)}</summary>
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
                      <summary data-exnav title="Shows or hides this feature’s full text and anything you can use from it. The tag says whether the sheet applies it for you (Automated) or you track it yourself.">{feat.name} <span className="mut">· {bg!.name} feat</span>{featureBadges(feat.name)}{autoTag(feat.id, feat.name)}</summary>
                      <Md md={feat.body} />
                      {featureExtras(feat.name)}
                    </details>
                  )}
                  {(featFilter === "all" || featFilter === "feats") && fx.featPicks.filter((fp) => fp.feat.id !== feat?.id).map(({ feat: f, slot, level, className }) => (
                    <details key={slot || f.id} className="feat" open={featFilter === "feats" || undefined}>
                      <summary data-exnav title="Shows or hides this feature’s full text and anything you can use from it. The tag says whether the sheet applies it for you (Automated) or you track it yourself.">{f.name} <span className="mut">· {level ? `${className || ""} ${level} feat`.trim() : "feat"}</span>{featureBadges(f.name)}{autoTag(f.id, f.name)}</summary>
                      <Md md={f.body} />
                      {featureExtras(f.name)}
                    </details>
                  ))}
                  {featFilter === "all" && customFeaturesPanel()}
                </div>
              )}

              {tab === "conditions" && (
                <div className="spanel">
                  <div className="condgrid">
                    {conditionEntries.filter((e) => e.name !== "Exhaustion").map((e) => {
                      const on = p.conditions.includes(e.name);
                      return (
                        <button key={e.id} className="condbtn" aria-pressed={on} title={`${on ? "You’re" : "Press to mark yourself"} ${e.name}. ${CONDITION_EFFECTS[e.name]?.note || ruleText(e.name) || ""}${on ? " Press again to remove it." : ""} The sheet applies its effects to your rolls.`} onClick={() => {
                          setPlay({ conditions: on ? p.conditions.filter((x) => x !== e.name) : [...p.conditions, e.name] });
                          log({ title: `${on ? "Removed" : "Gained"} ${e.name}`, total: "", cls: "event", detail: on ? "" : esc(CONDITION_EFFECTS[e.name]?.note || "") });
                        }}>{e.name}</button>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
                    <b>Exhaustion</b>
                    <button className="sbtn sm" aria-label="Reduce exhaustion" title="Lowers your Exhaustion level by 1 (finishing a Long Rest does this too)." disabled={!p.exhaustion} onClick={() => setPlay({ exhaustion: p.exhaustion - 1 })}>−</button>
                    <span>{p.exhaustion} / 6</span>
                    <button className="sbtn sm" aria-label="Increase exhaustion" title="Raises your Exhaustion level by 1. Each level gives −2 to your d20 Tests and −5 feet of Speed; at level 6 you die." disabled={p.exhaustion >= 6} onClick={() => setPlay({ exhaustion: p.exhaustion + 1 })}>+</button>
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
                  <textarea ref={notesRef} value={c.notes} onInput={(e) => fitNotes(e.currentTarget)} onChange={(e) => { dirty.current = true; const v = e.target.value; setC((prev) => (prev ? { ...prev, notes: v } : prev)); }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="side">
        <section className="spanel hp frm cut" {...bo("hp")}>
          {narrow && <button className="mx mhpx" aria-label="Close" onClick={() => setMsheet("")}>✕</button>}
          <div className="hpc">
            <button className="sbtn grn" title={HOW.heal} onClick={heal}>Heal</button>
            <input type="number" min={0} placeholder="0" aria-label="Amount" title={HOW.amount} value={hpAmt} onChange={(e) => setHpAmt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && takeDamage()} />
            <button className="sbtn red" title={HOW.damage} onClick={takeDamage}>Damage</button>
          </div>
          <div className="hpm">
            <div className="sl">Hit Points</div>
            <div className="hpv" data-ex="hp">
              <span className={hpCur === 0 ? "bad" : ""}>{hpCur}</span>
              <span className="mut">/ {hpMax}</span>
              {p.hpTemp > 0 && <span className="temp">+{p.hpTemp} temp</span>}
            </div>
            <div className="hbar"><div style={{ width: `${pct}%` }} className={pct < 25 ? "low" : pct < 50 ? "mid" : ""} /></div>
          </div>
          <div className="hpx">
            <button className="sbtn sm ghost" onClick={addTemp} title={HOW.temp}>+ Temp</button>
            <span>Hit Dice: {pools.map((pl, i) => <span key={pl.die}>{i ? " · " : ""}<b>{pl.count - hdUsedOf(pl.die)}</b>/{pl.count} d{pl.die}</span>)}</span>
            {pools.length > 1 ? pools.map((pl) => (
              hdUsedOf(pl.die) < pl.count && hpCur < hpMax && <Btn key={pl.die} className="sbtn sm ghost" title={`Spend a Hit Die: roll a d${pl.die} plus your Constitution modifier and regain that many Hit Points (usually during a Short Rest)`} onClick={() => spendHitDie(pl.die)}>Spend d{pl.die}</Btn>
            )) : (
              hdLeft > 0 && hpCur < hpMax && <Btn className="sbtn sm ghost" title={`Spend a Hit Die: roll a d${pools[0]?.die} plus your Constitution modifier and regain that many Hit Points (usually during a Short Rest)`} onClick={() => spendHitDie()}>Spend d{pools[0]?.die}</Btn>
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
        <div className="rollbar" {...bo("rollbar")}>
          {narrow && <div className="mshh"><span className="disp">Dice</span><button className="mx" aria-label="Close" onClick={() => setMsheet("")}>✕</button></div>}
          <div className="seg" role="group" aria-label="Roll mode">
            <button className={mode === "dis" ? "on dis" : ""} title={`${HOW.dis} ${HOW.modeTail}`} onClick={() => setMode("dis")}>Disadvantage</button>
            <button className={mode === "normal" ? "on" : ""} title={`${HOW.normal} ${HOW.modeTail}`} onClick={() => setMode("normal")}>Normal</button>
            <button className={mode === "adv" ? "on adv" : ""} title={`${HOW.adv} ${HOW.modeTail}`} onClick={() => setMode("adv")}>Advantage</button>
          </div>
          <div className="rbrow">
            <label className="nb" title="A one-time modifier for your next d20 roll, like Bardic Inspiration (1d6) or Guidance (1d4). Clears after one roll.">
              <span className="vh">Next roll bonus</span>
              <input value={nextBonus} onChange={(e) => setNextBonus(e.target.value)} placeholder="Next roll: +2 or 1d4" />
            </label>
            <button className="ibtn insp" data-ex="insp" aria-pressed={!!p.inspiration} aria-label="Heroic Inspiration" title={p.inspiration ? "Heroic Inspiration: you have it. Click to use it." : "Heroic Inspiration: click when you gain it."}
              onClick={toggleInsp}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill={p.inspiration ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></svg>
            </button>
            <button className="ibtn" aria-pressed={dice3d} aria-label="3D dice" title={dice3d ? "3D dice: on" : "3D dice: off"} onClick={() => { setDice3d(!dice3d); setDice3dState(!dice3d); }}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M12 2.5l8.5 4.9v9.2L12 21.5l-8.5-4.9V7.4z" /><path d="M12 2.5v6.8M3.5 7.4l8.5 1.9 8.5-1.9M12 9.3l-5 8.6M12 9.3l5 8.6M7 17.9h10" /></svg>
            </button>
            <button className="ibtn" aria-pressed={sound} aria-label="Dice sound" title={sound ? "Dice sound: on" : "Dice sound: off"} onClick={() => { setSound(!sound); setSoundState(!sound); if (!sound) setTimeout(() => playDice(2), 0); }}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />{sound ? <path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}</svg>
            </button>
          </div>
          {narrow && trayEl}
        </div>

        {toast && narrow && logHidden && (
          <button key={toast.id} className={`rolltoast ${toast.cls}`} onClick={openLog} aria-live="polite" title="Show the Game Log">
            {toast.total !== "" && <span className="big">{toast.total}</span>}
            <span className="rtt">{toast.title}</span>
          </button>
        )}
        <aside className={`log ${logOpen ? "open" : ""} ${narrow && logHidden ? "hid" : ""}`}>
          <div className="logh">
            {narrow && <span className="mgrid">{SCROLL_ICON}</span>}
            <span className="disp">{logView === "table" ? "Table Log" : "Game Log"}</span>
            {sharedLog && (
              <span className="seg" role="group" aria-label="Log view">
                <button className={logView === "mine" ? "on" : ""} onClick={() => setLogView("mine")}>Character</button>
                <button className={logView === "table" ? "on" : ""} onClick={() => setLogView("table")}>Table</button>
              </span>
            )}
            {logView === "mine" && <button className="sbtn sm ghost" title="Copy this character’s game log as text." onClick={copyLog}>Copy</button>}
            {logView === "mine" && <button className="sbtn sm ghost" title="Delete everything in this character’s game log." onClick={() => { if (confirm("Clear this character’s game log?")) setPlay({ log: [] }); }}>Clear</button>}
            {narrow && <button className="mx" aria-label="Close the Game Log" onClick={closeLog}>✕</button>}
          </div>
          {!narrow && trayEl}
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
                    <div className="cb"><div className="big dots" aria-label="Rolling"><i>.</i><i>.</i><i>.</i></div><div className="det">Rolling</div></div>
                  ) : (
                    <div className="cb">
                      {e.total !== "" && <div className="big">{e.total}</div>}
                      <div className="det" dangerouslySetInnerHTML={{ __html: e.detail }} />
                    </div>
                  )}
                  {rolling !== e.id && actions.current[e.id] && (
                    <div className="cact">
                      {actions.current[e.id].map((a, j) => (
                        <button key={j} className="sbtn sm" title={`${a.label}: rolls it and adds the result to the Game Log.`} onClick={a.run}>{a.label}</button>
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
      {phoneBits}
      <div className="explainbar">
        <button className={`exsw ${explain ? "on" : ""}`} data-exnav role="switch" aria-checked={explain} title="Explainer Mode: point at (or tap) anything on the sheet to see what it means and how it's worked out. Rolling is off while it's on. Press this to turn it off." onClick={() => { setExplain(!explain); setExAt(undefined); }}>
          <span className="knob" aria-hidden="true" /> Explainer Mode
        </button>
        <p>{narrow ? "Enable Explainer Mode to tap items on the sheet and see what they are, how each number is worked out, and how you can change it. While it’s on, dice rolling is turned off, so tapping only explains." : "Enable Explainer Mode to hover over items on the sheet and see what they are, how each number is worked out, and how you can change it. Clicking still rolls as usual."}</p>
      </div>
      {editable && (
        <div className="bgbar">
          <div className="bgpick" ref={bgRef}>
            <button className="sbtn ghost sm" aria-haspopup="true" aria-expanded={bgOpen} title="Pick a background image for this character’s sheet." onClick={() => setBgOpen((o) => !o)}>Background Image</button>
            {bgOpen && (
              <div className="bgmenu" role="menu" aria-label="Background Image">
                {bgOptions(() => setBgOpen(false))}
              </div>
            )}
          </div>
        </div>
      )}
      {explain && (
        <button className="explainpill" onClick={() => { setExplain(false); setExAt(undefined); }}>Explainer Mode is on · <b>Turn off</b></button>
      )}
      {exInfo && exAt && (() => {
        // the same bubble as the sheet's other tooltips: above the number, lined up with its nearer edge
        const r = exAt.rect, vw = window.innerWidth, vh = window.innerHeight;
        const x = r.left + r.width / 2 > vw / 2 ? { right: Math.max(8, vw - r.right) } : { left: Math.max(8, r.left) };
        const above = r.top > 110;
        return (
          <span role="tooltip" ref={(el) => fitBubble(el)} className={`tipbox open exbox ${above ? "" : "below"} ${"left" in x ? "left" : ""}`}
            style={{ position: "fixed", ...x, ...(above ? { bottom: vh - r.top + 8 } : { top: r.bottom + 8 }) }}>
            {exInfo.title && <b className="exh">{exInfo.title}</b>}
            {exInfo.rows.map((row, i) => <span key={i} className="exr"><span>{row.label}</span><b>{row.value}</b></span>)}
            {exInfo.rows.length > 0 && <span className="exr tot"><span>Total</span><b>{exInfo.total}</b></span>}
            {exInfo.rows.length === 0 && exInfo.total !== "" && <span className="exr"><span>Total</span><b>{exInfo.total}</b></span>}
            {exInfo.notes.filter(Boolean).map((n, i) => <span key={i} className={exInfo.title ? "exn" : ""}>{n}</span>)}
          </span>
        );
      })()}
    </div>
    </TipsOn.Provider>
  );
}

