import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "../sheet.css";
import { useContent } from "../lib/store.tsx";
import { useCharacters } from "../lib/characters.tsx";
import { useSession } from "../lib/session.tsx";
import { cloud, supabase } from "../lib/backend.ts";
import { Md } from "../lib/md.tsx";
import { features, spellInfo, stripMd, type Entry } from "../lib/parse.ts";
import {
  ABBR, ABILITIES, SKILLS, SKILL_ABILITY, armorTable, casterInfo, derive, featName, fmt, speciesChoice, traits,
  type Character,
} from "../lib/rules.ts";
import { combineModes, d20, describeRolled, roll, type Mode } from "../lib/dice.ts";
import {
  CONDITION_EFFECTS, attackFor, castingAbility, classResources, conditionMods, esc, playOf,
  spellDamage, spellRoll, timeNow, unarmedStrike, weaponTable, type Attack, type LogEntry,
  type PlayState, type RollContext,
} from "../lib/play.ts";
import { catalog, inventoryOf, magicInfo, type Coins, type Item } from "../lib/inventory.ts";
import InventoryPanel from "./InventoryPanel.tsx";
import { casterKind, classFeatures, classInfos, classLabel, hitDicePools, spellSlots, weaponProficiencyEntry, type ClassInfo, type Slot } from "../lib/multiclass.ts";

type Tab = "actions" | "spells" | "features" | "conditions" | "inventory" | "notes";
type CardAction = { label: string; run: () => void };

export default function Sheet() {
  const { id } = useParams();
  const content = useContent();
  const chars = useCharacters();
  const session = useSession();
  const row = chars.get(id);
  const [c, setC] = useState<Character | undefined>(row?.c);
  const dirty = useRef(false);
  const editable = chars.canEdit(id);
  useEffect(() => {
    if (row && (!c || c.id !== row.c.id)) setC(row.c);
  }, [row]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const [flash, setFlash] = useState<string>();
  const actions = useRef<Record<string, CardAction[]>>({});

  const cls = content.byId(c?.classId);
  const sub = content.byId(c?.subclassId);
  const sp = content.byId(c?.speciesId);
  const bg = content.byId(c?.backgroundId);
  const infos: ClassInfo[] = c ? classInfos(c, content.byId) : [];
  const anyCaster = infos.some((i) => casterKind(i.cls));
  useEffect(() => {
    content.ensure("rules", "items", ...(anyCaster ? (["spells"] as const) : []));
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
  const d = derive(c, { cls, background: bg, species: sp, armor, items: inv.items, classes: infos });
  const hpMax = d.hp;
  const hpCur = Math.min(hpMax, p.hpCur ?? hpMax);
  const speed = p.conditions.some((k) => CONDITION_EFFECTS[k]?.speed0) ? 0 : d.speed;
  // spellcasting: each class keeps its own ability, DC and attack
  const casters = infos
    .filter((i) => casterKind(i.cls))
    .map((i) => {
      const ab = castingAbility(i.cls);
      const m = ab ? d.mods[ab] : 0;
      return { info: i, ab, mod: m, dc: 8 + d.pb + m, atk: d.pb + m, ci: casterInfo(i.cls, i.level) };
    });
  type Caster = (typeof casters)[number];
  const castAb = casters[0]?.ab;
  const spellDC = casters[0]?.dc ?? 0;
  const spellAtk = casters[0]?.atk ?? 0;
  const slots: Slot[] = spellSlots(infos, content.entries);
  const slotKey = (s: Slot) => (s.pact ? `p${s.level}` : String(s.level));
  const resources = infos.flatMap((i) => classResources(c, i.cls, i.level).map((r) => (i.starting ? r : { ...r, key: `${i.cls.name}:${r.key}` })));
  // Hit Dice, pooled by die size (older characters stored one count)
  const pools = hitDicePools(infos);
  const hdUsedOf = (die: number) => (p.hdUsedBy ? p.hdUsedBy[die] || 0 : die === pools[0]?.die ? p.hdUsed : 0);
  const hdLeft = pools.reduce((n, pl) => n + pl.count - hdUsedOf(pl.die), 0);
  // attacks: weapons that are equipped (magic weapons use their base weapon)
  const attacks: Attack[] = [
    ...inv.items.flatMap((it) => {
      const w = it.equipped && it.qty > 0 && it.base ? weapons.find((x) => x.name === it.base) : undefined;
      return w ? [attackFor({ ...w, name: it.name }, d, weaponProficiencyEntry(infos) || cls)] : [];
    }),
    unarmedStrike(d),
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
    const m = combineModes(bar === "adv" || cm.adv.length > 0, bar === "dis" || cm.dis.length > 0);
    const extra = takeBonus();
    const r = d20(bonus - cm.penalty, m, extra ? extra.replace(/^\+/, "") : undefined);
    const why = [
      ...(bar !== "normal" ? [bar === "adv" ? "Advantage (roll bar)" : "Disadvantage (roll bar)"] : []),
      ...cm.adv.map((x) => `Advantage: ${x}`),
      ...cm.dis.map((x) => `Disadvantage: ${x}`),
    ];
    const diceTxt = r.rolls.length > 1 ? `d20 [${r.rolls.map((x) => (x === r.kept ? `<b>${x}</b>` : x)).join(", ")}]` : `d20 [${r.kept}]`;
    const detail = [
      `${diceTxt} ${fmt(bonus)}${cm.penalty ? ` −${cm.penalty} exhaustion` : ""}${r.extra ? ` ${esc(describeRolled(r.extra))}` : ""}`,
      why.length ? `<div>${esc(why.join(" · "))}${m === "normal" && why.length > 1 ? " (cancel out)" : ""}</div>` : "",
      extraNote,
      r.crit && ctx.kind !== "check" && ctx.kind !== "save" ? `<div class="vd crit">Natural 20!</div>` : "",
      r.fumble ? `<div class="vd bad">Natural 1</div>` : "",
    ].join("");
    log({ title, total: String(r.total), cls: r.crit ? "crit" : r.fumble ? "fumble" : "test", detail });
    return r;
  };

  const rollDamage = (title: string, expr: string, crit: boolean, type = "", heal = false) => {
    const r = roll(expr, { doubleDice: crit });
    if (!r) return;
    log({
      title: `${title} ${heal ? "healing" : "damage"}`,
      total: String(Math.max(0, r.total)),
      cls: heal ? "heal" : "dmg",
      detail: `${esc(describeRolled(r))}${type ? ` · ${esc(type)}` : ""}${crit ? `<div class="vd crit">Critical hit: dice doubled</div>` : ""}`,
    });
  };

  const attack = (a: Attack, versatile = false) => {
    const cm = conditionMods(p, { kind: "attack" });
    const m = combineModes(mode === "adv" || cm.adv.length > 0, mode === "dis" || cm.dis.length > 0);
    const extra = takeBonus();
    const r = d20(a.toHit - cm.penalty, m, extra ? extra.replace(/^\+/, "") : undefined);
    const dmg = versatile && a.versatile ? a.versatile : a.damage;
    const why = [...(mode !== "normal" ? [mode === "adv" ? "Advantage (roll bar)" : "Disadvantage (roll bar)"] : []), ...cm.adv.map((x) => `Advantage: ${x}`), ...cm.dis.map((x) => `Disadvantage: ${x}`)];
    log(
      {
        title: `${a.name}${versatile ? " (two hands)" : ""}: attack`,
        total: String(r.total),
        cls: r.crit ? "crit" : r.fumble ? "fumble" : "atk",
        detail:
          `d20 [${r.rolls.map((x) => (r.rolls.length > 1 && x === r.kept ? `<b>${x}</b>` : x)).join(", ")}] ${fmt(a.toHit)}${cm.penalty ? ` −${cm.penalty} exhaustion` : ""}${r.extra ? ` ${esc(describeRolled(r.extra))}` : ""}` +
          (why.length ? `<div>${esc(why.join(" · "))}</div>` : "") +
          (r.crit ? `<div class="vd crit">Critical hit!</div>` : r.fumble ? `<div class="vd bad">Natural 1: miss</div>` : ""),
      },
      [{ label: r.crit ? `Roll crit damage (${dmg})` : `Roll damage (${dmg})`, run: () => rollDamage(a.name, dmg, r.crit, a.type) }],
    );
  };

  // ------------------------------------------------------------------ HP
  const amount = () => Math.max(0, Math.floor(+hpAmt || 0));
  const takeDamage = () => {
    const n = amount();
    if (!n) return;
    let temp = p.hpTemp;
    const fromTemp = Math.min(temp, n);
    temp -= fromTemp;
    const left = n - fromTemp;
    const cur = Math.max(0, hpCur - left);
    const notes: string[] = [];
    if (fromTemp) notes.push(`${fromTemp} absorbed by temporary HP`);
    if (left >= hpCur + hpMax && hpCur > 0) notes.push("<b>Massive damage:</b> the remaining damage equals or exceeds your Hit Point maximum, so you die instantly.");
    else if (cur === 0) notes.push(hpCur === 0 ? "Damage at 0 HP: one failed death save (two on a critical hit)." : "You drop to 0 HP and have the Unconscious condition.");
    if (p.concentration && left > 0) notes.push(`Concentration on ${esc(p.concentration)}: make a Constitution save, DC ${Math.min(30, Math.max(10, Math.floor(left / 2)))}.`);
    setPlay({ hpCur: cur, hpTemp: temp, deathF: hpCur === 0 && cur === 0 ? Math.min(3, p.deathF + 1) : p.deathF });
    log({ title: "Took damage", total: `−${n}`, cls: "dmg", detail: `HP ${hpCur} → ${cur} / ${hpMax}${notes.map((x) => `<div>${x}</div>`).join("")}` },
      p.concentration && left > 0 ? [{ label: "Roll Constitution save", run: () => test("Concentration save", d.saves.Constitution.value, { kind: "save", ability: "Constitution" }) }] : undefined);
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
    const r = d20(0, mode, extra ? extra.replace(/^\+/, "") : undefined);
    let { deathS: s, deathF: f } = p;
    let verdict = "";
    let hp = hpCur;
    if (r.kept === 20) { hp = 1; s = 0; f = 0; verdict = `<div class="vd crit">Natural 20: you regain 1 HP</div>`; }
    else if (r.kept === 1) { f = Math.min(3, f + 2); verdict = `<div class="vd bad">Natural 1: two failures</div>`; }
    else if (r.total >= 10) { s = Math.min(3, s + 1); verdict = `<div class="vd ok">Success</div>`; }
    else { f = Math.min(3, f + 1); verdict = `<div class="vd bad">Failure</div>`; }
    if (s >= 3) verdict += `<div class="vd ok">Three successes: you’re Stable</div>`;
    if (f >= 3) verdict += `<div class="vd bad">Three failures: you die</div>`;
    setPlay({ deathS: s >= 3 ? 0 : s, deathF: f, hpCur: hp });
    log({ title: "Death save", total: String(r.total), cls: r.kept === 20 ? "crit" : r.kept === 1 ? "fumble" : "test", detail: `d20 [${r.rolls.join(", ")}]${r.extra ? ` ${esc(describeRolled(r.extra))}` : ""}${verdict}` });
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
    setPlay({ resUsed, slotsUsed });
    log({ title: "Short rest", total: "", cls: "event", detail: `${back.length ? `Regained ${esc(back.join(", "))}.` : "Nothing to regain."} Spend Hit Dice to heal (${hdLeft} left).` },
      hdLeft > 0 ? [{ label: "Spend a Hit Die", run: () => spendHitDie() }] : undefined);
  };
  const longRest = () => {
    setPlay({ hpCur: hpMax, hpTemp: 0, hdUsed: 0, hdUsedBy: {}, deathS: 0, deathF: 0, slotsUsed: {}, resUsed: {}, exhaustion: Math.max(0, p.exhaustion - 1), concentration: undefined });
    log({ title: "Long rest", total: "", cls: "event", detail: `HP restored to ${hpMax}. All Hit Dice, spell slots and class resources regained.${p.exhaustion ? " Exhaustion reduced by 1." : ""}` });
  };

  // -------------------------------------------------------------- spells
  const spells = content.byType("Spell");
  const knownBy = casters.map((k) => ({
    k,
    list: [...k.info.cantrips, ...k.info.spells].map((n) => spells.find((s) => s.name === n)).filter(Boolean) as Entry[],
  }));
  // regular and Pact Magic slots of the same level both count; regular ones are used first
  const slotLeft = (lvl: number) => slots.filter((x) => x.level === lvl).reduce((n, x) => n + x.max - (p.slotsUsed[slotKey(x)] || 0), 0);
  const castSpell = (s: Entry, slot: number, k: Caster) => {
    const info = spellInfo(s);
    const r = spellRoll(s);
    const spellAtk = k.atk;
    const spellDC = k.dc;
    const castMod = k.mod;
    if (info && info.level > 0) {
      const use = [...slots].sort((a, b) => Number(a.pact) - Number(b.pact)).find((x) => x.level === slot && x.max - (p.slotsUsed[slotKey(x)] || 0) > 0);
      if (!use) return;
      const key = slotKey(use);
      setPlay((cur) => ({ slotsUsed: { ...cur.slotsUsed, [key]: (cur.slotsUsed[key] || 0) + 1 }, ...(r.concentration ? { concentration: s.name } : {}) }));
    } else if (r.concentration) setPlay({ concentration: s.name });
    const acts: CardAction[] = [];
    const dmgExpr = r.damage ? spellDamage(s, r.damage, slot, c.level) : undefined;
    if (r.attack) acts.push({ label: `Spell attack (${fmt(spellAtk)})`, run: () => attack({ name: s.name, toHit: spellAtk, damage: dmgExpr || "0", type: r.damageType || "", note: "" }) });
    if (dmgExpr && !r.attack) acts.push({ label: `Roll damage (${dmgExpr})`, run: () => rollDamage(s.name, dmgExpr, false, r.damageType) });
    if (r.heal) acts.push({ label: `Roll healing (${r.heal}+${castMod})`, run: () => rollDamage(s.name, `${r.heal}+${castMod}`, false, "", true) });
    log({
      title: `Cast ${s.name}`,
      total: "",
      cls: "info",
      detail: `${info?.level ? `Level ${slot} slot${slot > info.level ? ` (upcast from ${info.level})` : ""}` : "Cantrip"}${r.save ? ` · ${esc(r.save)} save DC <b>${spellDC}</b>` : ""}${r.concentration ? " · Concentration" : ""}`,
    }, acts);
  };

  // ------------------------------------------------------------ features
  const allFeats = classFeatures(infos);
  const feat = bg ? content.byType("Feat").find((f) => f.name.toLowerCase() === featName(bg.fields["feat"]).replace(/\s*\(.*\)$/, "").toLowerCase()) : undefined;
  const choice = speciesChoice(sp);
  const choiceRow = choice?.table.rows.find((r) => r[0] === c.speciesChoice);

  const skillTag = (s: string) => {
    const cm = conditionMods(p, { kind: "check", ability: SKILL_ABILITY[s] });
    return cm.dis.length ? <span className="tagm dis" title={`Disadvantage: ${cm.dis.join(", ")}`}>D</span> : null;
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

  return (
    <div className="sheetv">
      <div>
        <section className="ident">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div>
              <h1 className="disp">{c.name || "Unnamed character"}</h1>
              <div className="sub">
                Level {c.level} {sp?.name}{c.speciesChoice ? ` (${c.speciesChoice})` : ""}{" "}
                {infos.length > 1 ? classLabel(infos) : cls?.name}
                {infos.filter((i) => i.sub).map((i) => ` · ${i.sub!.name}`).join("")}{bg ? ` · ${bg.name}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {editable && <Link className="sbtn ghost sm" to={`/build/${c.id}`} style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Edit in builder</Link>}
              <button className="sbtn ghost sm" onClick={() => window.print()}>Print</button>
            </div>
          </div>
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
              <button className="schip conc" title="Drop concentration" onClick={() => { setPlay({ concentration: undefined }); log({ title: "Concentration ended", total: "", cls: "event", detail: esc(p.concentration!) }); }}>
                ◎ Concentrating: {p.concentration} ✕
              </button>
            )}
            {p.inspiration && <span className="schip gold">★ Heroic Inspiration</span>}
          </div>
        </section>

        <section className="stats">
          <div className="stat"><div className="sl">Armor Class</div><div className="sv2">{d.ac}</div><div className="ss">{d.acNote}</div></div>
          <button className="stat" onClick={() => test("Initiative", d.initiative, { kind: "init", ability: "Dexterity" })}><div className="sl">Initiative</div><div className="sv2">{fmt(d.initiative)}</div><div className="ss">click to roll</div></button>
          <div className="stat"><div className="sl">Speed</div><div className="sv2">{speed} ft</div><div className="ss">{speed === 0 && d.speed ? "conditions" : ""}</div></div>
          <div className="stat"><div className="sl">Proficiency</div><div className="sv2">{fmt(d.pb)}</div><div className="ss" /></div>
          <div className="stat"><div className="sl">Passive Perception</div><div className="sv2">{d.passivePerception}</div><div className="ss" /></div>
          {castAb && (
            <button className="stat" onClick={() => attack({ name: "Spell", toHit: spellAtk, damage: "0", type: "", note: "" })}>
              <div className="sl">Spell Save DC</div><div className="sv2">{casters.length > 1 && new Set(casters.map((k) => k.dc)).size > 1 ? casters.map((k) => k.dc).join(" / ") : spellDC}</div>
              <div className="ss">{casters.length > 1 ? casters.map((k) => `${k.ab ? ABBR[k.ab] : ""} atk ${fmt(k.atk)}`).join(" · ") : `atk ${fmt(spellAtk)} · ${ABBR[castAb]}`}</div>
            </button>
          )}
        </section>

        <div className="cols">
          <div>
            <section className="abil">
              {ABILITIES.map((a) => (
                <div key={a} className="ab">
                  <div className="abn">{a}</div>
                  <button className="abm" title={`Roll ${a} check`} onClick={() => test(`${a} check`, d.mods[a], { kind: "check", ability: a })}>{fmt(d.mods[a])}</button>
                  <div className="abs">{d.scores[a]}</div>
                  <button className={`sv ${d.saves[a].prof ? "p" : ""}`} title={`Roll ${a} save`} onClick={() => test(`${a} save`, d.saves[a].value, { kind: "save", ability: a })}>
                    Save {fmt(d.saves[a].value)}
                  </button>
                </div>
              ))}
            </section>
            <section className="spanel skills">
              <h3>Skills</h3>
              {SKILLS.map((s) => (
                <button key={s} className="sk" onClick={() => test(`${s} check`, d.skills[s].value, { kind: "check", ability: SKILL_ABILITY[s] })}>
                  <span className={`dot ${d.skills[s].prof ? "p1" : ""}`} />
                  <span className="skn">{s}{skillTag(s)}</span>
                  <span className="ska">{ABBR[SKILL_ABILITY[s]]}</span>
                  <span className="skb">{fmt(d.skills[s].value)}</span>
                </button>
              ))}
            </section>
          </div>

          <div>
            <section className="spanel hp">
              <div>
                <div className="sl">Hit Points</div>
                <div className="hpv">
                  <span className={hpCur === 0 ? "bad" : ""}>{hpCur}</span>
                  <span className="mut">/ {hpMax}</span>
                  {p.hpTemp > 0 && <span className="temp">+{p.hpTemp} temp</span>}
                </div>
                <div className="hbar"><div style={{ width: `${pct}%` }} className={pct < 25 ? "low" : pct < 50 ? "mid" : ""} /></div>
              </div>
              <div className="hpc">
                <input type="number" min={0} placeholder="Amount" aria-label="Amount" value={hpAmt} onChange={(e) => setHpAmt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && takeDamage()} />
                <button className="sbtn red" onClick={takeDamage}>Damage</button>
                <button className="sbtn grn" onClick={heal}>Heal</button>
                <button className="sbtn ghost" onClick={addTemp}>Temp</button>
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

            {(slots.length > 0 || resources.length > 0) && (
              <section className="spanel slotbar">
                {slots.length > 0 && (
                  <>
                    <span className="sl">{slots.every((s) => s.pact) ? "Pact Magic" : "Spell Slots"}</span>
                    <div className="slots">
                      {slots.map((s) => {
                        const key = slotKey(s);
                        return (
                          <div key={key} className="slot" title={s.pact ? "Pact Magic: comes back on a Short or Long Rest" : undefined}>
                            <span className="sl">{s.pact && slots.some((x) => !x.pact) ? "Pact " : ""}L{s.level}</span>
                            <Pips n={s.max} used={p.slotsUsed[key] || 0} onToggle={(i) => setPlay((cur) => ({ slotsUsed: { ...cur.slotsUsed, [key]: i < (cur.slotsUsed[key] || 0) ? i : i + 1 } }))} />
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
                {resources.map((r) => (
                  <div key={r.key} className="slot" title={r.recover === "long" ? "Comes back on a Long Rest" : r.recover === "short" ? "All come back on a Short or Long Rest" : "One comes back on a Short Rest, all on a Long Rest"}>
                    <span className="sl">{r.name}</span>
                    <Pips n={r.max} used={p.resUsed[r.key] || 0} onToggle={(i) => setPlay((cur) => ({ resUsed: { ...cur.resUsed, [r.key]: i < (cur.resUsed[r.key] || 0) ? i : i + 1 } }))} />
                  </div>
                ))}
              </section>
            )}

            <div>
              <nav className="stabs">
                {([["actions", "Actions"], ["spells", "Spells"], ["features", "Features & Feats"], ["conditions", "Conditions"], ["inventory", "Inventory"], ["notes", "Notes"]] as [Tab, string][])
                  .filter(([k]) => k !== "spells" || anyCaster)
                  .map(([k, l]) => (
                    <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
                      {l}{k === "conditions" && p.conditions.length + (p.exhaustion ? 1 : 0) > 0 && <span className="badge">{p.conditions.length + (p.exhaustion ? 1 : 0)}</span>}
                    </button>
                  ))}
              </nav>

              {tab === "actions" && (
                <div className="spanel" style={{ overflowX: "auto" }}>
                  <table className="atks">
                    <thead><tr><th>Attack</th><th>To hit</th><th>Damage</th><th></th></tr></thead>
                    <tbody>
                      {attacks.map((a, i) => (
                        <tr key={`${a.name}-${i}`}>
                          <td><b>{a.name}</b><div className="note">{a.note}</div></td>
                          <td>{fmt(a.toHit)}</td>
                          <td>{a.damage} {a.type}{a.versatile ? <div className="note">two hands {a.versatile}</div> : null}</td>
                          <td>
                            <div className="rowbtn">
                              <button className="sbtn sm" onClick={() => attack(a)}>Attack</button>
                              <button className="sbtn sm ghost" onClick={() => rollDamage(a.name, a.damage, false, a.type)}>Damage</button>
                              {a.versatile && <button className="sbtn sm ghost" onClick={() => attack(a, true)}>Two hands</button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="note" style={{ marginTop: 10 }}>Attacks come from the weapons equipped in your <button className="linkish" onClick={() => setTab("inventory")}>Inventory</button>.</p>
                </div>
              )}

              {tab === "spells" && anyCaster && (
                <div className="spanel">
                  {!content.loaded.has("spells") ? <p className="note">Loading spells…</p> : knownBy.map(({ k, list }) => (
                    <div key={k.info.index} style={{ marginBottom: 14 }}>
                      {casters.length > 1 && <h3>{k.info.cls.name} spells</h3>}
                      <p className="note" style={{ marginTop: 0 }}>
                        {k.ab} · save DC <b>{k.dc}</b> · spell attack <b>{fmt(k.atk)}</b>
                        {k.ci ? ` · ${k.ci.cantrips ? `${k.info.cantrips.length}/${k.ci.cantrips} cantrips, ` : ""}${k.info.spells.length}/${k.ci.prepared} prepared` : ""}.{" "}
                        {editable && <Link to={`/build/${c.id}`}>Change spells</Link>}
                      </p>
                      {list.length === 0 ? <p className="note">No spells chosen yet.</p> : (
                        list
                          .sort((a, b) => (spellInfo(a)?.level || 0) - (spellInfo(b)?.level || 0))
                          .map((s) => <SpellRow key={`${k.info.index}-${s.id}`} s={s} slots={slots} slotLeft={slotLeft} onCast={(sp, lvl) => castSpell(sp, lvl, k)} />)
                      )}
                    </div>
                  ))}
                </div>
              )}

              {tab === "features" && (
                <div>
                  {allFeats.map((f, i) => (
                    <details key={`f${i}`} className="feat">
                      <summary>{f.name} <span className="mut">· {f.src === f.classLevel.replace(/ \d+$/, "") ? f.classLevel : `${f.src} · ${f.classLevel}`}</span></summary>
                      <Md md={f.md} />
                    </details>
                  ))}
                  {traits(sp).map((t, i) => (
                    <details key={`t${i}`} className="feat">
                      <summary>{t.name} <span className="mut">· {sp!.name}</span></summary>
                      <Md md={t.md} />
                    </details>
                  ))}
                  {choiceRow && (
                    <div className="feat"><b>{c.speciesChoice}</b> <span className="mut">· {choice!.title}</span>
                      <div className="note">{choice!.table.header.slice(1).map((h, i) => `${h}: ${choiceRow[i + 1]}`).join(" · ")}</div>
                    </div>
                  )}
                  {feat && (
                    <details className="feat">
                      <summary>{feat.name} <span className="mut">· {bg!.name} feat</span></summary>
                      <Md md={feat.body} />
                    </details>
                  )}
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
                  size={(sp?.fields["size"] || "Medium").split(/[\s(]/)[0]}
                  onChange={setInventory}
                  onReset={resetInventory}
                />
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
        <div className="rollbar">
          <div className="seg" role="group" aria-label="Roll mode">
            <button className={mode === "dis" ? "on dis" : ""} onClick={() => setMode("dis")}>Disadvantage</button>
            <button className={mode === "normal" ? "on" : ""} onClick={() => setMode("normal")}>Normal</button>
            <button className={mode === "adv" ? "on adv" : ""} onClick={() => setMode("adv")}>Advantage</button>
          </div>
          <label className="nb" title="A one-time modifier for your next d20 roll, like Bardic Inspiration (1d6) or Guidance (1d4). Clears after one roll.">
            Next roll bonus
            <input value={nextBonus} onChange={(e) => setNextBonus(e.target.value)} placeholder="+2 or 1d4" />
          </label>
          <button className={`sbtn ${p.inspiration ? "gold" : "ghost"}`} onClick={() => { setPlay({ inspiration: !p.inspiration }); log({ title: p.inspiration ? "Used Heroic Inspiration" : "Gained Heroic Inspiration", total: "", cls: "event", detail: p.inspiration ? "Reroll any die immediately after rolling it." : "" }); }}>
            {p.inspiration ? "★ Inspired" : "☆ Inspiration"}
          </button>
          <div className="rests">
            <button className="sbtn ghost" onClick={shortRest}>Short rest</button>
            <button className="sbtn ghost" onClick={longRest}>Long rest</button>
          </div>
        </div>

        <aside className={`log ${logOpen ? "open" : ""}`}>
          <div className="logh">
            <span className="disp">{logView === "table" ? "Table Log" : "Game Log"}</span>
            {sharedLog && (
              <span className="seg" role="group" aria-label="Log view">
                <button className={logView === "mine" ? "on" : ""} onClick={() => setLogView("mine")}>Character</button>
                <button className={logView === "table" ? "on" : ""} onClick={() => setLogView("table")}>Table</button>
              </span>
            )}
            <button className="sbtn sm ghost" onClick={() => setLogOpen(!logOpen)}>{logOpen ? "Collapse" : "Expand"}</button>
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
                <div key={e.id} className={`lc ${e.cls} ${i === 0 && flash === e.id ? "flash" : ""} ${i > 0 ? "old" : ""}`}>
                  <div className="ch"><span className="ct">{e.title}</span><span className="tm">{e.t}</span></div>
                  <div className="cb">
                    {e.total !== "" && <div className="big">{e.total}</div>}
                    <div className="det" dangerouslySetInnerHTML={{ __html: e.detail }} />
                  </div>
                  {actions.current[e.id] && (
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
    </div>
  );
}

function SpellRow({ s, slots, slotLeft, onCast }: {
  s: Entry; slots: { level: number; max: number }[]; slotLeft: (l: number) => number; onCast: (s: Entry, slot: number) => void;
}) {
  const info = spellInfo(s);
  const lvl = info?.level || 0;
  const options = slots.filter((x) => x.level >= lvl).map((x) => x.level);
  const firstOpen = options.find((l) => slotLeft(l) > 0) ?? options[0] ?? lvl;
  const [slot, setSlot] = useState(firstOpen);
  const r = spellRoll(s);
  const canCast = lvl === 0 || slotLeft(slot) > 0;
  return (
    <details className="feat">
      <summary style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ flex: 1 }}>{s.name} <span className="mut">· {lvl ? `Level ${lvl}` : "Cantrip"}{r.concentration ? " · C" : ""}{r.save ? ` · ${r.save.slice(0, 3)} save` : ""}{r.attack ? " · attack" : ""}</span></span>
        {lvl > 0 && options.length > 1 && (
          <select aria-label={`Slot level for ${s.name}`} value={slot} onClick={(e) => e.stopPropagation()} onChange={(e) => setSlot(+e.target.value)} style={{ minHeight: 30, padding: "2px 6px" }}>
            {options.map((l) => <option key={l} value={l}>L{l} ({slotLeft(l)} left)</option>)}
          </select>
        )}
        <button className="sbtn sm" disabled={!canCast} onClick={(e) => { e.preventDefault(); onCast(s, lvl === 0 ? 0 : slot); }}>{canCast ? "Cast" : "No slots"}</button>
      </summary>
      <div className="note" style={{ margin: "6px 0" }}>{["casting time", "range", "components", "duration"].map((k) => stripMd(s.fields[k] || "")).join(" · ")}</div>
      <Md md={s.body} />
    </details>
  );
}
