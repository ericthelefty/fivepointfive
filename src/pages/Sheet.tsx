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
  ABBR, ABILITIES, SKILLS, SKILL_ABILITY, armorTable, casterInfo, derive, featName, fmt, speciesChoice, traits, wornGear,
  type Character,
} from "../lib/rules.ts";
import { combineModes, d20, describeRolled, roll, type Mode } from "../lib/dice.ts";
import {
  CONDITION_EFFECTS, attackFor, conditionMods, esc, playOf,
  timeNow, unarmedStrike, weaponTable, type Attack, type LogEntry,
  type ActiveEffect, type PlayState, type RollContext,
} from "../lib/play.ts";
import { catalog, inventoryOf, isActive, magicInfo, type Coins, type Item } from "../lib/inventory.ts";
import InventoryPanel from "./InventoryPanel.tsx";
import {
  advantageFor, computeModif, disadvantageFor, spellcastingOf, spellMinutes, spellPlan, statusOf, treatRoll, weaponProficient,
  type ModifAction, type ModifCost, type ModifCtx, type ModifToggle,
} from "../lib/modif.ts";
import { casterKind, classFeatures, classInfos, classLabel, hitDicePools, spellSlots, type ClassInfo, type Slot } from "../lib/multiclass.ts";

type Tab = "actions" | "effects" | "spells" | "features" | "conditions" | "inventory" | "notes";
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
    // spells are always loaded: feats and items can grant them too
    content.ensure("rules", "items", "spells");
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
  const gear = wornGear(c, { cls, background: bg, armor, items: inv.items });
  const fxCtx: ModifCtx = {
    c, classes: infos, species: sp, background: bg, entries: content.entries, byId: content.byId,
    items: inv.items.flatMap((it) => {
      const e = it.kind === "magic" && it.ref ? content.byId(it.ref) : undefined;
      return e && it.qty > 0 ? [{ item: it, entry: e, active: isActive(it, infoOf(it)) }] : [];
    }),
    gear: { armor: gear.category, shield: gear.shield > 0 },
    active: (p.active || []).map((x) => ({ key: x.key, slot: x.slot, onSelf: x.onSelf })),
    conditions: p.conditions,
  };
  // read once for ability scores, then again with the spellcasting numbers they give
  const fx0 = computeModif(fxCtx);
  const d0 = derive(c, { cls, background: bg, species: sp, armor, items: inv.items, classes: infos, modif: fx0 });
  const firstCaster = infos.find((i) => casterKind(i.cls));
  const ab0 = firstCaster ? spellcastingOf(firstCaster.cls)?.ability ?? null : null;
  const fx = ab0 ? computeModif({ ...fxCtx, spell: { mod: d0.mods[ab0], dc: 8 + d0.pb + d0.mods[ab0], attack: d0.pb + d0.mods[ab0] } }) : fx0;
  const d = fx === fx0 ? d0 : derive(c, { cls, background: bg, species: sp, armor, items: inv.items, classes: infos, modif: fx });
  const fxPlus = (to: string) => fx.bonuses.filter((b) => b.to === to).reduce((n, b) => n + b.value, 0);
  /** "Automated" / "Partly automated" tag for a feature whose Effects the sheet reads. */
  const autoTag = (entryId: string | undefined, feature: string) => {
    const st = entryId ? statusOf(fx, entryId, feature) : undefined;
    if (!st || st === "not automated") return null;
    return <span className={`tag ${st === "automated" ? "ok" : "plain"}`} style={{ marginLeft: 8 }} title={st === "automated" ? "The sheet applies this for you." : "The sheet applies part of this; see “Apply by hand”."}>{st === "automated" ? "Automated" : "Partly automated"}</span>;
  };
  const hpMax = d.hp;
  const hpCur = Math.min(hpMax, p.hpCur ?? hpMax);
  const speed = p.conditions.some((k) => CONDITION_EFFECTS[k]?.speed0) ? 0 : d.speed;
  // spellcasting: each class keeps its own ability, DC and attack
  const casters = infos
    .filter((i) => casterKind(i.cls))
    .map((i) => {
      const ab = spellcastingOf(i.cls)?.ability ?? null;
      const m = ab ? d.mods[ab] : 0;
      return { info: i, ab, mod: m, dc: 8 + d.pb + m + fxPlus("spell:dc"), atk: d.pb + m + fxPlus("spell:attack"), ci: casterInfo(i.cls, i.level) };
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
  const attacks: Attack[] = [
    ...inv.items.flatMap((it) => {
      const w = it.equipped && it.qty > 0 && it.base ? weapons.find((x) => x.name === it.base) : undefined;
      return w ? [withBonuses({ ...attackFor({ ...w, name: it.name }, d, weaponProficient(fx, w)), itemId: it.id }, /ranged/i.test(w.category))] : [];
    }),
    withBonuses(unarmedStrike(d), false),
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
    cm.adv.push(...advantageFor(fx, ctx));
    cm.dis.push(...disadvantageFor(fx, ctx));
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
          `d20 [${r.rolls.map((x) => (r.rolls.length > 1 && x === r.kept ? `<b>${x}</b>` : x)).join(", ")}] ${fmt(a.toHit)}${cm.penalty ? ` −${cm.penalty} exhaustion` : ""}${r.extra ? ` ${esc(describeRolled(r.extra))}` : ""}` +
          (why.length ? `<div>${esc(why.join(" · "))}</div>` : "") +
          (crit ? `<div class="vd crit">Critical hit!${critNote}</div>` : r.fumble ? `<div class="vd bad">Natural 1: miss</div>` : ""),
      },
      [{ label: crit ? `Roll crit damage (${dmg})` : `Roll damage (${dmg})`, run: () => rollDamage(a.name, dmg, crit, a.type) }],
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
    setPlay({ resUsed, slotsUsed, active: (p.active || []).filter((x) => x.minutes > 60), ...(ended.some((x) => x.concentration) ? { concentration: undefined } : {}) });
    log({ title: "Short rest", total: "", cls: "event", detail: `${back.length ? `Regained ${esc(back.join(", "))}.` : "Nothing to regain."} Spend Hit Dice to heal (${hdLeft} left).` },
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
    setPlay({ hpCur: hpMax, hpTemp: 0, hdUsed: 0, hdUsedBy: {}, deathS: 0, deathF: 0, slotsUsed: {}, resUsed, exhaustion: Math.max(0, p.exhaustion - 1), concentration: undefined, active: [], ...(inspire ? { inspiration: true } : {}) });
    log({ title: "Long rest", total: "", cls: "event", detail: `HP restored to ${hpMax}. All Hit Dice, spell slots and class resources regained.${p.exhaustion ? " Exhaustion reduced by 1." : ""}${inspire && !p.inspiration ? ` ${esc(inspire.source)}: you gain Heroic Inspiration.` : ""}${notes.map((x) => `<div>${esc(x)}</div>`).join("")}${(p.active || []).length ? `<div>Ended: ${esc((p.active || []).map((x) => x.name).join(", "))}</div>` : ""}` });
  };

  // ------------------------------------------------------- feature actions
  /** A cost's resource, uses left, and whether it can be paid. */
  const costInfo = (cost?: ModifCost) => {
    const res = cost ? resources.find((r) => r.key === cost.key || r.key.endsWith(`:${cost.key}`)) : undefined;
    const left = res ? res.max - (p.resUsed[res.key] || 0) : Infinity;
    return { res, left, ok: !cost || !res || left >= cost.amount };
  };
  const pay = (cost: ModifCost | undefined, cur: PlayState): Partial<PlayState> => {
    const { res } = costInfo(cost);
    return res && cost ? { resUsed: { ...cur.resUsed, [res.key]: (cur.resUsed[res.key] || 0) + cost.amount } } : {};
  };
  const runFeature = (a: ModifAction) => {
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
        castSpell(sp, lvl, null, { dc: a.cast.dc, attack: a.cast.attack, free: true, pay: a.cost, via: a.name });
        return;
      }
    }
    const patch: Partial<PlayState> = pay(a.cost, p);
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
    setPlay((cur) => ({ active: (cur.active || []).filter((y) => y.key !== x.key), ...(x.concentration ? { concentration: undefined } : {}) }));
    log({ title: `${x.name} ended`, total: "", cls: "event", detail: "" });
  };

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
  function castSpell(s: Entry, slot: number, k: Caster | null, opt: { dc?: number; attack?: number; mod?: number; free?: boolean; pay?: ModifCost; via?: string } = {}) {
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
      if (plan.heal) acts.push({ label: `Roll healing (${plan.heal})`, run: () => rollDamage(s.name, plan.heal!, false, "", true) });
      if (plan.tempHp) lines.push(`Temporary HP: ${plan.tempHp}`);
      if (plan.save) lines.push(`${plan.save.ability} save DC <b>${spellDC}</b>${plan.save.success === "half" ? " (half on a success)" : ""}`);
      lines.push(...plan.lines.map(esc));
    } else {
      // content without Effects: the sheet doesn't read its text, so the player applies it
      lines.push(`Spell attack ${fmt(spellAtk)} · save DC <b>${spellDC}</b>. This spell has no Effects, so apply its rolls from its description.`);
    }
    log({
      title: `Cast ${s.name}`,
      total: "",
      cls: "info",
      detail: [
        `${opt.via ? `${esc(opt.via)} · ` : ""}${info?.level ? (opt.free ? `Level ${slot}, no slot used` : `Level ${slot} slot${slot > info.level ? ` (upcast from ${info.level})` : ""}`) : "Cantrip"}${conc ? " · Concentration" : ""}${minutes > 0 ? ` · lasts ${stripMd(s.fields["duration"] || "").replace(/^Concentration, /i, "")}` : ""}`,
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
                <button key={s} className="sk" onClick={() => test(`${s} check`, d.skills[s].value, { kind: "check", ability: SKILL_ABILITY[s], skill: s })}>
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
                  <div key={r.key} className="slot" title={r.recover === "long" ? "Comes back on a Long Rest" : r.recover === "short" ? "All come back on a Short or Long Rest" : r.recover === "shortOne" ? "One comes back on a Short Rest, all on a Long Rest" : r.recover === "dawn" ? `Recharges at dawn${r.regain ? ` (${r.regain})` : ""}; the sheet does it on a Long Rest` : "Doesn't recharge"}>
                    <span className="sl">{r.name}</span>
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
              </section>
            )}

            <div>
              <nav className="stabs">
                {([["actions", "Actions"], ["effects", "Effects"], ["spells", "Spells"], ["features", "Features & Feats"], ["conditions", "Conditions"], ["inventory", "Inventory"], ["notes", "Notes"]] as [Tab, string][])
                  .filter(([k]) => k !== "spells" || anyCaster || fx.grantedSpells.length > 0)
                  .map(([k, l]) => (
                    <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
                      {l}{k === "conditions" && p.conditions.length + (p.exhaustion ? 1 : 0) > 0 && <span className="badge">{p.conditions.length + (p.exhaustion ? 1 : 0)}</span>}
                      {k === "effects" && activeList.length > 0 && <span className="badge">{activeList.length}</span>}
                    </button>
                  ))}
              </nav>

              {tab === "actions" && (
                <div className="spanel" style={{ overflowX: "auto" }}>
                  {d.attacksPerAction > 1 && <p className="note" style={{ marginTop: 0 }}>When you take the Attack action, you attack <b>{d.attacksPerAction} times</b>.</p>}
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
                  <p className="note" style={{ marginTop: 10 }}>Attacks come from the weapons equipped in your <button className="linkish" onClick={() => setTab("inventory")}>Inventory</button>.{d.critRange < 20 ? ` Your weapon attacks score a Critical Hit on a ${d.critRange}–20.` : ""}</p>
                  {fx.actions.length > 0 && (
                    <table className="atks" style={{ marginTop: 14 }}>
                      <thead><tr><th>Feature or item</th><th>Uses</th><th>Effect</th><th></th></tr></thead>
                      <tbody>
                        {fx.actions.map((a) => {
                          const { res, left, ok } = costInfo(a.cost);
                          return (
                            <tr key={a.id}>
                              <td><b>{a.name}</b><div className="note">{[a.activation, a.source !== a.name ? a.source : ""].filter(Boolean).join(" · ")}</div></td>
                              <td>{res ? `${left} / ${res.max}${a.cost && a.cost.amount > 1 ? ` (costs ${a.cost.amount})` : ""}` : "—"}</td>
                              <td>
                                {a.heal ? `Regain ${a.heal} HP` : a.cast ? `Casts ${a.name}${a.cast.dc ? ` (DC ${a.cast.dc})` : ""}` : null}
                                {a.save && <span>{a.save.dc ? `DC ${a.save.dc} ` : ""}{a.save.ability} save{a.damage?.length ? `, ${a.damage.map((x) => `${x.dice} ${x.type}`).join(" + ")}` : ""}</span>}
                                {!a.save && a.damage?.length ? <span>{a.damage.map((x) => `${x.dice} ${x.type}`).join(" + ")}</span> : null}
                                {(a.text || a.options) && <div className="note">{[a.text, a.options && `Choose: ${a.options.join(", ")}`].filter(Boolean).join(" · ")}</div>}
                              </td>
                              <td><div className="rowbtn"><button className="sbtn sm" onClick={() => runFeature(a)} disabled={!ok}>{a.cast ? "Cast" : "Use"}</button></div></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {tab === "spells" && (anyCaster || fx.grantedSpells.length > 0) && (
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
                  {fx.grantedSpells.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <h3>From features, feats and items</h3>
                      {fx.grantedSpells.map((g, i) => {
                        const free = g.free ? resources.find((r) => r.key === g.free) : undefined;
                        const freeLeft = free ? free.max - (p.resUsed[free.key] || 0) : 0;
                        const lvl = spellInfo(g.spell)?.level || 0;
                        const ab = g.ability || casters[0]?.ab || undefined;
                        const m = ab ? d.mods[ab] : 0;
                        const opt = { mod: m, dc: g.dc, free: true, via: g.source };
                        return (
                          <details key={`${g.spell.id}-${i}`} className="feat">
                            <summary style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                              <span style={{ flex: 1 }}>{g.spell.name} <span className="mut">· {lvl ? `Level ${lvl}` : "Cantrip"} · {g.source}{g.atWill ? " · at will" : ""}{free ? ` · ${freeLeft}/${free.max} free` : ""}</span></span>
                              {(g.atWill || lvl === 0) && <button className="sbtn sm" onClick={(e) => { e.preventDefault(); castSpell(g.spell, lvl, null, opt); }}>Cast</button>}
                              {free && <button className="sbtn sm" disabled={freeLeft <= 0} onClick={(e) => { e.preventDefault(); castSpell(g.spell, lvl, null, { ...opt, pay: { key: free.key, amount: 1 } }); }}>Cast free</button>}
                              {lvl > 0 && !g.atWill && slots.some((x) => x.level >= lvl) && (
                                <button className="sbtn sm ghost" disabled={slotLeft(slots.find((x) => x.level >= lvl && slotLeft(x.level) > 0)?.level ?? lvl) <= 0} onClick={(e) => { e.preventDefault(); const sl = slots.find((x) => x.level >= lvl && slotLeft(x.level) > 0); if (sl) castSpell(g.spell, sl.level, null, { mod: m, dc: g.dc, via: g.source }); }}>Use a slot</button>
                              )}
                            </summary>
                            <div className="note" style={{ margin: "6px 0" }}>{["casting time", "range", "components", "duration"].map((k2) => stripMd(g.spell.fields[k2] || "")).join(" · ")}</div>
                            <Md md={g.spell.body} />
                          </details>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {tab === "effects" && (
                <div className="stack" style={{ gap: 14 }}>
                  <div className="spanel">
                    <h3 style={{ marginTop: 0 }}>Active now</h3>
                    {activeList.length === 0 ? <p className="note">Nothing active. Switch something on below, or cast a spell with a duration.</p> : activeList.map((x) => {
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
                      <h3 style={{ marginTop: 0 }}>Switch on</h3>
                      {fx.toggles.filter((t) => !isOn(t.key)).map((t) => {
                        const { res, left, ok } = costInfo(t.cost);
                        return (
                          <div key={t.key} className="feat" style={{ padding: "8px 10px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                              <span><b>{t.name}</b> <span className="mut">· {[t.activation, t.source !== t.name ? t.source : "", res ? `${left}/${res.max} ${res.name}` : "", t.duration ? `lasts ${t.duration}` : ""].filter(Boolean).join(" · ")}</span></span>
                              <button className="sbtn sm" disabled={!ok} onClick={() => switchOn(t)}>Switch on</button>
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
                                  <button className="sbtn sm" disabled={!ok} onClick={() => { setPlay((cur) => pay(t.cost, cur)); log({ title: t.name, total: "", cls: "event", detail: `${esc(t.text)}<div>${left - t.cost!.amount} of ${res.max} ${esc(res.name)} left</div>` }); }}>Use</button>
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
                  {allFeats.map((f, i) => (
                    <details key={`f${i}`} className="feat">
                      <summary>{f.name} <span className="mut">· {f.src === f.classLevel.replace(/ \d+$/, "") ? f.classLevel : `${f.src} · ${f.classLevel}`}</span>{autoTag(infos.flatMap((i) => [i.cls, i.sub]).find((e) => e?.name === f.src)?.id, f.name)}</summary>
                      <Md md={f.md} />
                    </details>
                  ))}
                  {traits(sp).map((t, i) => (
                    <details key={`t${i}`} className="feat">
                      <summary>{t.name} <span className="mut">· {sp!.name}</span>{autoTag(sp?.id, t.name)}</summary>
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
                      <summary>{feat.name} <span className="mut">· {bg!.name} feat</span>{autoTag(feat.id, feat.name)}</summary>
                      <Md md={feat.body} />
                    </details>
                  )}
                  {fx.featPicks.filter((fp) => fp.feat.id !== feat?.id).map(({ feat: f, slot, level, className }) => (
                    <details key={slot || f.id} className="feat">
                      <summary>{f.name} <span className="mut">· {level ? `${className || ""} ${level} feat`.trim() : "feat"}</span>{autoTag(f.id, f.name)}</summary>
                      <Md md={f.body} />
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
  const plan = spellPlan(s, { slot, charLevel: 1, spell: { mod: 0, dc: 0, attack: 0 } });
  const tags = plan
    ? { c: plan.concentration, save: plan.save?.ability, attack: !!plan.attack, heal: !!plan.heal }
    : { c: /concentration/i.test(s.fields["duration"] || ""), save: undefined, attack: false, heal: false };
  const canCast = lvl === 0 || slotLeft(slot) > 0;
  return (
    <details className="feat">
      <summary style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ flex: 1 }}>{s.name} <span className="mut">· {lvl ? `Level ${lvl}` : "Cantrip"}{tags.c ? " · C" : ""}{tags.save ? ` · ${tags.save.slice(0, 3)} save` : ""}{tags.attack ? " · attack" : ""}{tags.heal ? " · healing" : ""}</span></span>
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
