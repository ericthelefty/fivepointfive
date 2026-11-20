import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "../sheet.css";
import { loadCharacters, saveCharacter, useContent } from "../lib/store.tsx";
import { Md } from "../lib/md.tsx";
import { features, spellInfo, stripMd, type Entry } from "../lib/parse.ts";
import {
  ABBR, ABILITIES, SKILLS, SKILL_ABILITY, armorTable, casterInfo, derive, featName, fmt, speciesChoice, traits,
  type Character,
} from "../lib/rules.ts";
import { combineModes, d20, describeRolled, roll, type Mode } from "../lib/dice.ts";
import {
  CONDITION_EFFECTS, attackFor, carriedGear, castingAbility, classResources, conditionMods, esc, playOf, slotTotals,
  spellDamage, spellRoll, timeNow, unarmedStrike, weaponTable, weaponsCarried, type Attack, type LogEntry,
  type PlayState, type RollContext,
} from "../lib/play.ts";

type Tab = "actions" | "spells" | "features" | "conditions" | "notes";
type CardAction = { label: string; run: () => void };

export default function Sheet() {
  const { id } = useParams();
  const content = useContent();
  const [c, setC] = useState<Character | undefined>(() => loadCharacters().find((x) => x.id === id));
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
  const caster = casterInfo(cls, c?.level || 1);
  useEffect(() => {
    content.ensure("rules", ...(caster ? (["spells"] as const) : []));
  }, [!!caster]); // eslint-disable-line react-hooks/exhaustive-deps

  const armor = useMemo(() => armorTable(content.entries), [content.entries]);
  const weapons = useMemo(() => weaponTable(content.entries), [content.entries]);
  const conditionEntries = useMemo(
    () => content.byType("Rule").filter((e) => e.tags.includes("Condition")).sort((a, b) => a.name.localeCompare(b.name)),
    [content],
  );

  if (!c) return <div className="panel">Character not found. <Link to="/">Back to characters</Link></div>;

  const p = playOf(c);
  const d = derive(c, { cls, background: bg, species: sp, armor });
  const hpMax = d.hp;
  const hpCur = Math.min(hpMax, p.hpCur ?? hpMax);
  const speed = p.conditions.some((k) => CONDITION_EFFECTS[k]?.speed0) ? 0 : d.speed;
  const castAb = castingAbility(cls);
  const castMod = castAb ? d.mods[castAb] : 0;
  const spellDC = 8 + d.pb + castMod;
  const spellAtk = d.pb + castMod;
  const slots = slotTotals(c, cls);
  const resources = classResources(c, cls);
  const gear = carriedGear(c, cls, bg);
  const attacks: Attack[] = [...weaponsCarried(gear, weapons).map((w) => attackFor(w, d, cls)), unarmedStrike(d)];

  // ------------------------------------------------------------ state io
  const setPlay = (patch: Partial<PlayState> | ((p: PlayState) => Partial<PlayState>)) =>
    setC((prev) => {
      if (!prev) return prev;
      const cur = playOf(prev);
      const next = { ...prev, play: { ...cur, ...(typeof patch === "function" ? patch(cur) : patch) } };
      saveCharacter(next);
      return next;
    });

  const log = (e: Omit<LogEntry, "id" | "t">, acts?: CardAction[]) => {
    const entry: LogEntry = { ...e, id: Math.random().toString(36).slice(2, 9), t: timeNow() };
    if (acts?.length) actions.current[entry.id] = acts;
    setPlay((cur) => ({ log: [entry, ...cur.log].slice(0, 150) }));
    setFlash(entry.id);
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
  const spendHitDie = () => {
    if (p.hdUsed >= c.level) return;
    const r = roll(`1d${d.hitDie}${d.mods.Constitution >= 0 ? "+" : ""}${d.mods.Constitution}`)!;
    const gain = Math.max(0, r.total);
    const cur = Math.min(hpMax, hpCur + gain);
    setPlay({ hdUsed: p.hdUsed + 1, hpCur: cur });
    log({ title: "Spent a Hit Die", total: `+${cur - hpCur}`, cls: "heal", detail: `${esc(describeRolled(r))} · HP ${hpCur} → ${cur}` });
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
    if (slots.some((s) => s.pact)) { for (const s of slots) slotsUsed[s.level] = 0; back.push("Pact Magic slots"); }
    setPlay({ resUsed, slotsUsed });
    log({ title: "Short rest", total: "", cls: "event", detail: `${back.length ? `Regained ${esc(back.join(", "))}.` : "Nothing to regain."} Spend Hit Dice to heal (${c.level - p.hdUsed} left).` },
      p.hdUsed < c.level ? [{ label: `Spend a Hit Die (d${d.hitDie})`, run: spendHitDie }] : undefined);
  };
  const longRest = () => {
    setPlay({ hpCur: hpMax, hpTemp: 0, hdUsed: 0, deathS: 0, deathF: 0, slotsUsed: {}, resUsed: {}, exhaustion: Math.max(0, p.exhaustion - 1), concentration: undefined });
    log({ title: "Long rest", total: "", cls: "event", detail: `HP restored to ${hpMax}. All Hit Dice, spell slots and class resources regained.${p.exhaustion ? " Exhaustion reduced by 1." : ""}` });
  };

  // -------------------------------------------------------------- spells
  const spells = content.byType("Spell");
  const known = [...c.cantrips, ...c.spells].map((n) => spells.find((s) => s.name === n)).filter(Boolean) as Entry[];
  const slotLeft = (lvl: number) => {
    const s = slots.find((x) => x.level === lvl);
    return s ? s.max - (p.slotsUsed[lvl] || 0) : 0;
  };
  const castSpell = (s: Entry, slot: number) => {
    const info = spellInfo(s);
    const r = spellRoll(s);
    if (info && info.level > 0) {
      if (slotLeft(slot) <= 0) return;
      setPlay((cur) => ({ slotsUsed: { ...cur.slotsUsed, [slot]: (cur.slotsUsed[slot] || 0) + 1 }, ...(r.concentration ? { concentration: s.name } : {}) }));
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
  const classFeats = cls ? features(cls).filter((f) => f.level <= c.level).map((f) => ({ ...f, src: cls.name })) : [];
  const subFeats = sub && c.level >= 3 ? features(sub).filter((f) => f.level <= c.level).map((f) => ({ ...f, src: sub.name })) : [];
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
                Level {c.level} {sp?.name}{c.speciesChoice ? ` (${c.speciesChoice})` : ""} {cls?.name}{sub ? ` · ${sub.name}` : ""}{bg ? ` · ${bg.name}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Link className="sbtn ghost sm" to={`/build/${c.id}`} style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>Edit in builder</Link>
              <button className="sbtn ghost sm" onClick={() => window.print()}>Print</button>
            </div>
          </div>
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
              <div className="sl">Spell Save DC</div><div className="sv2">{spellDC}</div><div className="ss">atk {fmt(spellAtk)} · {ABBR[castAb]}</div>
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
                <span>Hit Dice: <b>{c.level - p.hdUsed}</b>/{c.level} d{d.hitDie}</span>
                <button className="sbtn sm ghost" disabled={p.hdUsed >= c.level || hpCur >= hpMax} onClick={spendHitDie}>Spend Hit Die</button>
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
                    <span className="sl">{slots[0].pact ? "Pact Magic" : "Spell Slots"}</span>
                    <div className="slots">
                      {slots.map((s) => (
                        <div key={s.level} className="slot">
                          <span className="sl">L{s.level}</span>
                          <Pips n={s.max} used={p.slotsUsed[s.level] || 0} onToggle={(i) => setPlay((cur) => ({ slotsUsed: { ...cur.slotsUsed, [s.level]: i < (cur.slotsUsed[s.level] || 0) ? i : i + 1 } }))} />
                        </div>
                      ))}
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
                {([["actions", "Actions"], ["spells", "Spells"], ["features", "Features & Feats"], ["conditions", "Conditions"], ["notes", "Notes & Gear"]] as [Tab, string][])
                  .filter(([k]) => k !== "spells" || caster)
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
                      {attacks.map((a) => (
                        <tr key={a.name}>
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
                  <p className="note" style={{ marginTop: 10 }}>Weapons come from your starting equipment and anything you add under Notes &amp; Gear.</p>
                </div>
              )}

              {tab === "spells" && caster && (
                <div className="spanel">
                  <p className="note" style={{ marginTop: 0 }}>
                    {castAb} · save DC <b>{spellDC}</b> · spell attack <b>{fmt(spellAtk)}</b> · {caster.cantrips ? `${c.cantrips.length}/${caster.cantrips} cantrips, ` : ""}{c.spells.length}/{caster.prepared} prepared.{" "}
                    <Link to={`/build/${c.id}`}>Change spells</Link>
                  </p>
                  {!content.loaded.has("spells") ? <p className="note">Loading spells…</p> : known.length === 0 ? <p className="note">No spells chosen yet.</p> : (
                    known
                      .sort((a, b) => (spellInfo(a)?.level || 0) - (spellInfo(b)?.level || 0))
                      .map((s) => <SpellRow key={s.id} s={s} slots={slots} slotLeft={slotLeft} onCast={castSpell} />)
                  )}
                </div>
              )}

              {tab === "features" && (
                <div>
                  {[...classFeats, ...subFeats].sort((a, b) => a.level - b.level).map((f, i) => (
                    <details key={`f${i}`} className="feat">
                      <summary>{f.name} <span className="mut">· {f.src} {f.level}</span></summary>
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

              {tab === "notes" && (
                <div className="spanel">
                  <h3>Equipment</h3>
                  <p style={{ marginTop: 0 }}>{gear || "No equipment chosen."}</p>
                  <label className="field">
                    Add gear (comma separated; weapons named here show up under Actions)
                    <input type="text" value={p.gear} onChange={(e) => setPlay({ gear: e.target.value })} placeholder="e.g. Longsword, Potion of Healing" />
                  </label>
                  <h3 style={{ marginTop: 16 }}>Notes</h3>
                  <textarea value={c.notes} onChange={(e) => setC((prev) => { if (!prev) return prev; const n = { ...prev, notes: e.target.value }; saveCharacter(n); return n; })} />
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
            <span className="disp">Game Log</span>
            <button className="sbtn sm ghost" onClick={() => setLogOpen(!logOpen)}>{logOpen ? "Collapse" : "Expand"}</button>
            <button className="sbtn sm ghost" onClick={() => { if (confirm("Clear the game log?")) setPlay({ log: [] }); }}>Clear</button>
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
            {p.log.length === 0 ? (
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
