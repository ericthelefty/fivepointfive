import { Btn } from "../lib/tip.tsx";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ScrollRow } from "../components/ScrollRow.tsx";
import { DetailsForm } from "../components/DetailsForm.tsx";
import { Link, useNavigate, useParams } from "react-router-dom";
import { weaponTable } from "../lib/play.ts";
import { catalog, inventoryOf } from "../lib/inventory.ts";
import {
  MAX_LEVEL, SUBCLASS_LEVEL, addClass, casterInfoOf, casterKindOf, classInfos, spellListClass, extraClasses, patchClass, prerequisiteProblems, removeClass, startingLevel,
} from "../lib/multiclass.ts";
import { useContent } from "../lib/store.tsx";
import { useCharacters } from "../lib/characters.tsx";
import { modifFor, scoreBreakdown, multiclassSkillChoice, setSlotFeat, skillChoiceOf, speciesSkillChoice, validIncreases, type PendingChoice } from "../lib/modif.ts";
import { Md, MdInline } from "../lib/md.tsx";
import { features, stripMd, type Entry } from "../lib/parse.ts";
import {
  ABBR, ABILITIES, POINT_COST, SKILLS, STANDARD_ARRAY, abilityList, armorTable, classSpells,
  derive, equipmentOptions, featName, finalScores, fmt, listOf, mod, pointBuyUsed, speciesChoice,
  traits, intro, type Character,
} from "../lib/rules.ts";

const STEPS = ["Class", "Species", "Background", "Ability scores", "Skills & spells", "Equipment", "Details"] as const;

export default function Builder() {
  const { id } = useParams();
  const nav = useNavigate();
  const content = useContent();
  const chars = useCharacters();
  const row = chars.get(id);
  const [c, setC] = useState<Character | undefined>(row?.c);
  const [step, setStep] = useState(() => {
    const want = new URLSearchParams(window.location.search).get("step");
    const i = want ? STEPS.findIndex((x) => x.toLowerCase().startsWith(want.toLowerCase())) : -1;
    return Math.max(0, i);
  });
  const dirty = useRef(false);
  useEffect(() => {
    if (row && (!c || c.id !== row.c.id)) setC(row.c);
  }, [row]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (c && dirty.current) {
      dirty.current = false;
      chars.save(c);
    }
  }, [c]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (patch: Partial<Character>) => {
    dirty.current = true;
    setC((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const cls = content.byId(c?.classId);
  const anyCaster = !!c && classInfos(c, content.byId).some((i) => casterKindOf(i));
  // spells are also needed for non-casters: Magic Initiate, species spells, invocations
  const needSpells = anyCaster || !!c?.backgroundId || !!c?.speciesId;
  useEffect(() => {
    if (needSpells) content.ensure("spells");
  }, [needSpells]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!c) return chars.ready ? <div className="panel">Character not found. <Link to="/">Back to characters</Link></div> : <p className="muted">Loading…</p>;
  if (!chars.canEdit(c.id))
    return <div className="panel">Only this character’s player or an admin can edit it. <Link to={`/sheet/${c.id}`}>View the sheet</Link> or make your own copy from the Characters page.</div>;

  const done = [
    !!c.classId,
    !!c.speciesId,
    !!c.backgroundId,
    Object.keys(c.bonus).length > 0,
    // a class without a skill choice in its Effects (homebrew without Effects) has nothing to pick
    !!cls && c.classSkills.length >= skillChoiceOf(cls).count,
    // option A is the default, as on the sheet
    !!c.classId && !!c.backgroundId,
    !!c.name,
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <h1>{c.name || "New character"}</h1>
        <Link className="btn" to={`/sheet/${c.id}`}>View sheet</Link>
      </div>
      <ScrollRow className="steps" label="Builder steps" more="More steps" active={step}>
        {STEPS.map((s, i) => (
          <button key={s} className={`${i === step ? "on" : ""} ${done[i] && i !== step ? "done" : ""}`} onClick={() => setStep(i)} aria-current={i === step ? "step" : undefined}>
            <span className="n">{done[i] && i !== step ? "✓" : i + 1}</span>
            {s}
          </button>
        ))}
      </ScrollRow>
      <div className="stepcap">Step {step + 1} of {STEPS.length} · swipe the steps for more</div>
      {step === 0 && <ClassStep c={c} update={update} />}
      {step === 1 && <SpeciesStep c={c} update={update} />}
      {step === 2 && <BackgroundStep c={c} update={update} />}
      {step === 3 && <AbilityStep c={c} update={update} />}
      {step === 4 && <SkillsStep c={c} update={update} />}
      {step === 5 && <EquipmentStep c={c} update={update} />}
      {step === 6 && <DetailsStep c={c} update={update} />}
      <div className="noprint" style={{ display: "flex", justifyContent: "space-between", marginTop: 24, gap: 12 }}>
        <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
        {step < STEPS.length - 1 ? (
          <button className="btn primary" onClick={() => setStep(step + 1)}>Next: {STEPS[step + 1]}</button>
        ) : (
          <button className="btn primary" onClick={() => nav(`/sheet/${c.id}`)}>Finish: view sheet</button>
        )}
      </div>
    </div>
  );
}

type StepProps = { c: Character; update: (p: Partial<Character>) => void };

/** Choices from Modif `choose` blocks (Fighting Style, Weapon Mastery, origin feats, tools…). */
function ModifChoices({ c, update, origins }: StepProps & { origins: (string | undefined)[] }) {
  const content = useContent();
  const fx = modifFor(c, content);
  // feat slots (Ability Score Improvement) and what's chosen inside them are on the Ability scores step
  const list = fx.pending.filter((p) => !p.storedIn && !p.slot && origins.includes(p.origin));
  if (!list.length) return null;
  return <>{list.map((p) => <ChoiceRow key={p.key} p={p} c={c} update={update} />)}</>;
}

function setChoice(c: Character, update: StepProps["update"], key: string, next: string[]) {
  update({ choices: { ...(c.choices || {}), [key]: next } });
}

function ChoiceRow({ p, c, update, bare }: StepProps & { p: PendingChoice; bare?: boolean }) {
  const content = useContent();
  if (p.amounts) return <IncreaseRow p={p} c={c} update={update} bare={bare} />;
  const chosen = p.chosen.slice(0, p.count);
  const pick = (v: string) =>
    setChoice(c, update, p.key, p.count === 1 ? [v] : chosen.includes(v) ? chosen.filter((x) => x !== v) : chosen.length < p.count ? [...chosen, v] : chosen);
  const label = (v: string) => p.options?.find((o) => o.value === v)?.label || content.byId(v)?.name || v;
  const have = p.options?.some((o) => SKILLS.includes(o.value)) ? skillSources(c, content, p) : new Map<string, string>();
  return (
    <div className={bare ? "" : "choice"}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <strong>{p.label}</strong>
        {chosen.length < p.count && p.options && <span className="tag need">Choice needed</span>}
      </div>
      {p.entry.id !== p.origin && !p.slot && <div className="faint">From {p.entry.name}</div>}
      {p.options ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {p.options.map((o) => (
            <button key={o.value} className={`pill${have.has(o.value) && !chosen.includes(o.value) ? " have" : ""}`} aria-pressed={chosen.includes(o.value)} disabled={p.locked} title={p.locked ? `Set by ${p.origin.split("/").pop()?.replace(/-/g, " ")}` : undefined} onClick={() => pick(o.value)}>{o.label}{have.has(o.value) && !chosen.includes(o.value) ? ` (${have.get(o.value)})` : ""}</button>
          ))}
        </div>
      ) : (
        <div className="faint" style={{ marginTop: 6 }}>{chosen.length ? `Chosen: ${chosen.map(label).join(", ")}. ` : ""}Note your choice on the sheet; the app can't list these options yet.</div>
      )}
      {p.locked && <div className="faint" style={{ marginTop: 6 }}>Set by your background.</div>}
      {p.options && (!p.options.length || (p.hint && p.options.length < p.count)) && <div className="faint" style={{ marginTop: 6 }}>{p.hint || "Nothing to choose from yet."}</div>}
      {p.count > 1 && p.options && <div className="faint" style={{ marginTop: 6 }}>Chosen {chosen.length} / {p.count}</div>}
    </div>
  );
}

/** Skills the character is already proficient in, and where from ("Soldier"), leaving out the choice being made. */
function skillSources(c: Character, content: ReturnType<typeof useContent>, p: PendingChoice): Map<string, string> {
  const out = new Map<string, string>();
  const bg = content.byId(c.backgroundId);
  for (const s of SKILLS) if (bg && stripMd(bg.fields["skill proficiencies"] || "").includes(s)) out.set(s, bg.name);
  const cls = content.byId(c.classId)?.name || "class";
  for (const s of c.classSkills) out.set(s, cls);
  for (const s of c.extraSkills) out.set(s, content.byId(c.speciesId)?.name || "species");
  const fx = modifFor(c, content);
  for (const q of fx.pending) {
    if (q.key === p.key || q.storedIn) continue;
    for (const s of q.chosen.slice(0, q.count)) if (SKILLS.includes(s) && !out.has(s)) out.set(s, q.entry.name);
  }
  return out;
}

/** "+2 to one score or +1 to two": click an ability to add +1, click again past its limit to take it back. */
function IncreaseRow({ p, c, update, bare }: StepProps & { p: PendingChoice; bare?: boolean }) {
  const a = p.amounts!;
  const abilities = p.options?.map((o) => o.value) || ABILITIES;
  const count = (ab: string) => p.chosen.filter((x) => x === ab).length;
  const click = (ab: string) => {
    const next = validIncreases([...p.chosen, ab], a.sets);
    setChoice(c, update, p.key, next.length > p.chosen.length ? next : p.chosen.filter((x) => x !== ab));
  };
  const left = a.points - p.chosen.length;
  return (
    <div className={bare ? "" : "choice"}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <strong>{p.label.replace(/^.*?: /, "Increase: ")}</strong>
        {left > 0 && <span className="tag need">{left} to place</span>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        {abilities.map((ab) => (
          <button key={ab} className="pill" aria-pressed={count(ab) > 0} onClick={() => click(ab)} title={`Click to add +1 (maximum ${a.max})`}>
            {ab}{count(ab) ? ` +${count(ab)}` : ""}
          </button>
        ))}
      </div>
      <div className="faint" style={{ marginTop: 6 }}>Scores can’t go above {a.max}.</div>
    </div>
  );
}

/** Ability Score Improvement and Epic Boon slots, with the choices of the feat taken in each. */
function FeatSlots({ c, update }: StepProps) {
  const content = useContent();
  const fx = modifFor(c, content);
  const slots = fx.pending.filter((p) => p.level !== undefined).sort((x, y) => (x.level! - y.level!) || x.label.localeCompare(y.label));
  if (!slots.length) return null;
  return (
    <div className="panel">
      <h2>Ability Score Improvements and feats</h2>
      <p className="faint">At these levels you take the Ability Score Improvement feat or another feat {c.ignorePrereqs ? "(prerequisites are off, so every feat is listed)" : "you qualify for"}.</p>
      <div className="stack" style={{ gap: 10, marginTop: 10 }}>
        {slots.map((slot) => {
          const feat = content.byId(slot.chosen[0]);
          const inner = fx.pending.filter((p) => p.slot === slot.key && p.key !== slot.key);
          return (
            <div key={slot.key} className="choice">
              <label className="field" style={{ gap: 6 }}>
                <strong>{slot.label.replace(/: .*$/, "")}</strong>
                <select value={slot.chosen[0] || ""} onChange={(e) => update({ choices: setSlotFeat(c.choices, slot.key, e.target.value || undefined) })}>
                  {!slot.chosen[0] && <option value="">Choose a feat…</option>}
                  {slot.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              {feat && feat.id !== "srd:feat/ability-score-improvement" && (
                <details style={{ marginTop: 6 }}><summary className="faint">{feat.tagline || "About this feat"}</summary><Md md={feat.body} /></details>
              )}
              {inner.map((p) => <div key={p.key} style={{ marginTop: 10 }}><ChoiceRow p={p} c={c} update={update} bare /></div>)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PackLabel({ e }: { e: Entry }) {
  return e.pack === "srd" ? null : <span className="tag plain" style={{ marginLeft: 6 }}>{e.pack}</span>;
}

function Picker({ items, selected, onPick, render }: { items: Entry[]; selected?: string; onPick: (e: Entry) => void; render: (e: Entry) => ReactNode }) {
  return (
    <>
      {items.map((e) => (
        <button key={e.id} className="card" aria-pressed={e.id === selected} onClick={() => onPick(e)}>
          {render(e)}
        </button>
      ))}
    </>
  );
}

// ------------------------------------------------------------------ class
function ClassStep({ c, update }: StepProps) {
  const content = useContent();
  const { byType, byId } = content;
  const classes = byType("Class");
  const lvl = startingLevel(c);
  const multi = extraClasses(c).length > 0;
  // with more than one class, the side panel switches between them: traits, subclass, choices and features of each
  const infos = classInfos(c, byId);
  const [view, setView] = useState(0);
  const k = infos[Math.min(view, infos.length - 1)];
  const cls = byId(c.classId);
  const shown = k?.cls;
  const sub = k?.sub;
  const kLevel = k?.level ?? lvl;
  const subclasses = byType("Subclass").filter((s) => shown && stripMd(s.fields["parent"] || "").replace(/^[\w-]+:class\//, "").toLowerCase() === shown.name.toLowerCase());
  const pickSub = (id: string) => (k && k.index > 0 ? update(patchClass(c, k.index, { subclassId: id })) : update({ subclassId: id }));
  const feats = shown ? features(shown).filter((f) => f.level <= kLevel) : [];
  const subFeats = sub && kLevel >= SUBCLASS_LEVEL ? features(sub).filter((f) => f.level <= kLevel) : [];
  // a class still needs something: its subclass, or a choice in its features
  const pendingEvery = shown ? modifFor(c, content).pending : [];
  const pendingAll = multi ? pendingEvery.filter((p) => !p.storedIn && !p.slot && p.chosen.length < p.count && p.options) : [];
  /** The choices a feature asks for (D&D Beyond's "1 Choice" badge): how many, how many left, and where they're made. */
  const choicesOf = (fname: string) => {
    const mine = pendingEvery.filter((p) => (p.origin === shown?.id || (sub && p.origin === sub.id)) && p.feature.replace(/^Level \d+:\s*/, "").toLowerCase() === fname.toLowerCase());
    // counted like D&D Beyond: each pick ("Weapon Mastery: 2 Choices"), but a feat slot counts once with what's inside it
    const inner = (p: (typeof mine)[number]) => !!p.slot && !!p.amounts;
    const total = mine.reduce((n, p) => n + (inner(p) ? 0 : p.count), 0);
    const left = mine.reduce((n, p) => n + (inner(p) ? 0 : Math.max(0, p.count - p.chosen.length)), 0) || (mine.some((p) => inner(p) && p.chosen.length < p.count) ? 1 : 0);
    return { total, left, onAbility: mine.some((p) => p.slot) };
  };
  const later = shown ? [...features(shown).filter((f) => f.level > kLevel).map((f) => ({ ...f, src: shown.name })), ...(sub ? features(sub).filter((f) => f.level > Math.max(kLevel, SUBCLASS_LEVEL - 1)).map((f) => ({ ...f, src: sub.name })) : [])].sort((a, b) => a.level - b.level) : [];
  const needs = (i: (typeof infos)[number]) =>
    (i.level >= SUBCLASS_LEVEL && !i.sub && byType("Subclass").some((s) => stripMd(s.fields["parent"] || "").replace(/^[\w-]+:class\//, "").toLowerCase() === i.cls.name.toLowerCase())) ||
    pendingAll.some((p) => p.origin === i.cls.id || (i.sub && p.origin === i.sub.id));
  return (
    <div className="row">
      <section className="grow">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <h2>Choose a class</h2>
          <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {multi ? `${cls?.name || "Starting class"} level` : "Level"}
            <select value={lvl} onChange={(e) => update(patchClass(c, 0, { level: +e.target.value }))}>
              {Array.from({ length: MAX_LEVEL - (c.level - lvl) }, (_, i) => <option key={i + 1}>{i + 1}</option>)}
            </select>
          </label>
        </div>
        <div className="grid3">
          <Picker
            items={classes}
            selected={c.classId}
            onPick={(e) => update({ classId: e.id, subclassId: undefined, classSkills: [], equipClass: undefined, cantrips: [], spells: [], multiclass: extraClasses(c).filter((x) => x.classId !== e.id), ...suggestedBase(c, byId(c.classId)?.name, e.name) })}
            render={(e) => (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span className="t">{e.name}<PackLabel e={e} /></span>
                  <span className="chip">{(e.fields["hit point die"] || "").split(" ")[0]}</span>
                </div>
                <div className="faint">Primary: {stripMd(e.fields["primary ability"] || "—")}</div>
              </>
            )}
          />
        </div>
        {cls && <MulticlassPanel c={c} update={update} onEdit={(i) => { setView(i); document.querySelector(".classaside")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />}
      </section>
      <aside className="side panel classaside">
        {!cls || !shown ? (
          <p className="muted">Pick a class to see its traits and features.</p>
        ) : (
          <div className="stack">
            {infos.length > 1 && (
              <div className="classtabs" role="tablist" aria-label="Your classes">
                {infos.map((i, n) => (
                  <button key={i.cls.id} role="tab" className="pill" aria-selected={n === Math.min(view, infos.length - 1)} aria-pressed={n === Math.min(view, infos.length - 1)} onClick={() => setView(n)}>
                    {i.cls.name} {i.level}{needs(i) && <span className="tag need" style={{ marginLeft: 6 }}>!</span>}
                  </button>
                ))}
              </div>
            )}
            <div className="eyebrow">{infos.length > 1 ? (k.starting ? "Starting class" : "Multiclass") : "Selected class"}</div>
            <h2 style={{ color: "var(--accent-ink)", fontSize: 28 }}>{shown.name}{infos.length > 1 ? ` ${kLevel}` : ""}</h2>
            <dl className="kv">
              {[["Primary ability", "primary ability"], ["Hit Point Die", "hit point die"], ["Saving throws", "saving throw proficiencies"], ["Skills", "skill proficiencies"], ["Weapons", "weapon proficiencies"], ["Armor training", "armor training"]].map(([l, k]) => (
                <div key={k} style={{ display: "contents" }}>
                  <dt>{l}</dt>
                  <dd><MdInline md={shown.fields[k] || "—"} /></dd>
                </div>
              ))}
            </dl>
            {kLevel >= SUBCLASS_LEVEL && subclasses.length > 0 && (
              <div className="choice">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>Subclass</strong>
                  {!sub && <span className="tag need">Choice needed</span>}
                </div>
                <div className="stack" style={{ marginTop: 8, gap: 6 }}>
                  {subclasses.map((s) => (
                    <button key={s.id} className="card" aria-pressed={s.id === sub?.id} onClick={() => pickSub(s.id)}>
                      <span className="t" style={{ fontSize: 16 }}>{s.name}</span><PackLabel e={s} />
                      {s.tagline && <div className="faint">{s.tagline}</div>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <ModifChoices c={c} update={update} origins={[shown.id, sub?.id]} />
            <div className="eyebrow" style={{ marginTop: 6 }}>Features through {shown.name} level {kLevel}</div>
            {[...feats.map((f) => ({ ...f, src: shown.name })), ...subFeats.map((f) => ({ ...f, src: sub!.name }))]
              .sort((a, b) => a.level - b.level)
              .map((f, i) => {
                const ch = choicesOf(f.name);
                return (
                  <details key={i} className="inset">
                    <summary>
                      <strong>{f.name}</strong> <span className="faint">· Level {f.level}{f.src !== shown.name ? ` · ${f.src}` : ""}</span>
                      {ch.total > 0 && (ch.left > 0
                        ? <span className="tag need" style={{ marginLeft: 6 }}>{ch.left} choice{ch.left === 1 ? "" : "s"} left</span>
                        : <span className="tag ok" style={{ marginLeft: 6 }}>✓ {ch.total} choice{ch.total === 1 ? "" : "s"} made</span>)}
                    </summary>
                    {ch.total > 0 && <p className="faint" style={{ margin: "4px 0" }}>{ch.onAbility ? "Make this choice on the Ability scores step." : "Make this choice in the choices above."}</p>}
                    <Md md={f.md} />
                  </details>
                );
              })}
            {later.length > 0 && (
              <details className="inset later">
                <summary><strong>Available at higher levels</strong> <span className="faint">({later.length})</span></summary>
                <div className="stack" style={{ gap: 6, marginTop: 8 }}>
                  {later.map((f, i) => (
                    <details key={i} className="inset">
                      <summary><strong>{f.name}</strong> <span className="faint">· Level {f.level}{f.src !== shown.name ? ` · ${f.src}` : ""}</span></summary>
                      <Md md={f.md} />
                    </details>
                  ))}
                </div>
              </details>
            )}
            <div className="faint">Source: {shown.fields["source"] || shown.pack}</div>
          </div>
        )}
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------- species
// ------------------------------------------------------------- multiclass
function MulticlassPanel({ c, update, onEdit }: StepProps & { onEdit?: (index: number) => void }) {
  const { byType, byId } = useContent();
  const classes = byType("Class");
  const infos = classInfos(c, byId);
  const extras = extraClasses(c);
  const content = useContent();
  const scoresNow = modifFor(c, content).scores;
  const problems = c.ignorePrereqs ? [] : prerequisiteProblems(infos.map((i) => i.cls), scoresNow);
  const taken = new Set([c.classId, ...extras.map((x) => x.classId)]);
  const toggle = (list: string[], v: string, max: number) => (list.includes(v) ? list.filter((x) => x !== v) : list.length < max ? [...list, v] : list);
  return (
    <div className="panel" style={{ marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <h2>Multiclass</h2>
        <span className="faint">Total level {c.level} of {MAX_LEVEL}</span>
      </div>
      <p className="faint" style={{ marginTop: 4 }}>
        Take levels in other classes. You need 13 or higher in the primary ability of every class you have, and you get only some of a new class’s proficiencies.
      </p>
      {problems.length > 0 && (
        <div className="inset" role="status" style={{ borderColor: "var(--warn)" }}>
          <strong>Doesn’t meet the multiclass prerequisites:</strong>
          <ul style={{ margin: "6px 0 0 18px" }}>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          <div className="faint" style={{ marginTop: 4 }}>You can keep it if your DM allows, or turn off “Use prerequisites” in the Details step’s settings.</div>
        </div>
      )}
      <div className="stack" style={{ gap: 10, marginTop: 10 }}>
        {extras.map((x, k) => {
          const index = k + 1;
          const xc = byId(x.classId);
          if (!xc) return <div key={k} className="inset">Unknown class {x.classId}. <button className="linkish" onClick={() => update(removeClass(c, index))}>Remove</button></div>;
          // what a second class grants: shown from its text, chosen from its `multiclass` block
          const grantsText = (xc.sections.find((sec) => /^As a Multiclass Character$/i.test(sec.title))?.md || "").split("\n").find((l) => /^\s*-\s*Gain/.test(l))?.replace(/^\s*-\s*/, "").trim();
          const mcSkill = multiclassSkillChoice(xc);
          const subs = byType("Subclass").filter((s) => stripMd(s.fields["parent"] || "").replace(/^[\w-]+:class\//, "").toLowerCase() === xc.name.toLowerCase());
          const room = MAX_LEVEL - (c.level - x.level);
          const skills = x.skills || [];
          return (
            <div key={k} className="inset">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <strong style={{ fontSize: 17 }}>{xc.name}</strong>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    Level
                    <select value={x.level} onChange={(e) => update(patchClass(c, index, { level: +e.target.value }))}>
                      {Array.from({ length: room }, (_, i) => <option key={i + 1}>{i + 1}</option>)}
                    </select>
                  </label>
                  {onEdit && <button className="btn small" onClick={() => onEdit(index)}>Features &amp; choices</button>}
                  <button className="btn small" onClick={() => update(removeClass(c, index))}>Remove</button>
                </div>
              </div>
              <div className="faint" style={{ marginTop: 4 }}><MdInline md={grantsText || "Gain the Hit Point Die and level 1 features."} /></div>
              {mcSkill && (
                <div style={{ marginTop: 8 }}>
                  <div className="faint">Choose {mcSkill.count} skill{mcSkill.count > 1 ? "s" : ""} ({skills.length}/{mcSkill.count})</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                    {mcSkill.from.map((s) => (
                      <button key={s} className="pill" aria-pressed={skills.includes(s)} onClick={() => update(patchClass(c, index, { skills: toggle(skills, s, mcSkill.count) }))}>{s}</button>
                    ))}
                  </div>
                </div>
              )}
              {x.level >= SUBCLASS_LEVEL && subs.length > 0 && (
                <label className="field" style={{ marginTop: 8 }}>
                  {xc.name} subclass
                  <select value={x.subclassId || ""} onChange={(e) => update(patchClass(c, index, { subclassId: e.target.value || undefined }))}>
                    <option value="">Choose…</option>
                    {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
              )}
            </div>
          );
        })}
      </div>
      {c.level < MAX_LEVEL && (
        <label className="field" style={{ marginTop: 12, maxWidth: 320 }}>
          Add a class
          <select value="" onChange={(e) => e.target.value && update(addClass(c, e.target.value))}>
            <option value="">Choose a class…</option>
            {classes.filter((k) => !taken.has(k.id)).map((k) => {
              const why = c.ignorePrereqs ? [] : prerequisiteProblems([...infos.map((i) => i.cls), k], scoresNow);
              return <option key={k.id} value={k.id} disabled={why.length > 0} title={why.join(" ")}>{k.name} (primary: {stripMd(k.fields["primary ability"] || "—")}){why.length ? " — prerequisites not met" : ""}</option>;
            })}
          </select>
        </label>
      )}
    </div>
  );
}


function SpeciesStep({ c, update }: StepProps) {
  const { byType, byId } = useContent();
  const list = byType("Species");
  const sp = byId(c.speciesId);
  const choice = speciesChoice(sp);
  const skillPick = speciesSkillChoice(sp);
  const bgSkills = stripMd(byId(c.backgroundId)?.fields["skill proficiencies"] || "");
  const haveSkill = (s: string) => (bgSkills.includes(s) ? byId(c.backgroundId)!.name : c.classSkills.includes(s) ? byId(c.classId)?.name || "class" : "");
  return (
    <div className="row">
      <section className="side">
        <h2 style={{ marginBottom: 12 }}>Choose a species</h2>
        <div className="stack" style={{ gap: 8 }}>
          <Picker
            items={list}
            selected={c.speciesId}
            onPick={(e) => update({ speciesId: e.id, speciesChoice: undefined, extraSkills: [] })}
            render={(e) => (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <span className="t">{e.name}<PackLabel e={e} /></span>
                  <span className="faint">{stripMd(e.fields["size"] || "").split(" (")[0]} · {e.fields["speed"]}</span>
                </div>
                <div className="faint">{traits(e).map((t) => t.name).join(" · ")}</div>
              </>
            )}
          />
        </div>
      </section>
      <aside className="grow panel">
        {!sp ? (
          <p className="muted">Pick a species to see its traits.</p>
        ) : (
          <div className="stack" style={{ gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <h2 style={{ color: "var(--accent-ink)", fontSize: 28 }}>{sp.name}</h2>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["creature type", "size", "speed"].map((k) => sp.fields[k] && <span key={k} className="chip">{stripMd(sp.fields[k])}</span>)}
              </div>
            </div>
            {intro(sp) && <Md md={intro(sp)} />}
            <div className="stack" style={{ gap: 8 }}>
              {traits(sp).map((t) => (
                <div key={t.name}><Md md={`***${t.name}.*** ${t.md}`} /></div>
              ))}
            </div>
            {choice && (
              <div className="choice">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>{choice.title}</strong>
                  {!c.speciesChoice && <span className="tag need">Choice needed</span>}
                </div>
                <div style={{ overflowX: "auto", marginTop: 8 }}>
                  <table className="data">
                    <thead><tr><th></th>{choice.table.header.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                    <tbody>
                      {choice.table.rows.map((r) => (
                        <tr key={r[0]}>
                          <td><input type="radio" name="spchoice" aria-label={r[0]} checked={c.speciesChoice === r[0]} onChange={() => update({ speciesChoice: r[0] })} style={{ accentColor: "var(--accent)", width: 18, height: 18 }} /></td>
                          {r.map((cell, i) => <td key={i}>{i === 0 ? <strong>{cell}</strong> : cell}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {skillPick && (
              <div className="choice">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>Skill proficiency from your species</strong>
                  {!c.extraSkills.length && <span className="tag need">Choice needed</span>}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {skillPick.from.map((s) => (
                    <button key={s} className={`pill${haveSkill(s) && !c.extraSkills.includes(s) ? " have" : ""}`} aria-pressed={c.extraSkills.includes(s)} onClick={() => update({ extraSkills: [s] })}>{s}{haveSkill(s) && !c.extraSkills.includes(s) ? ` (${haveSkill(s)})` : ""}</button>
                  ))}
                </div>
              </div>
            )}
            <ModifChoices c={c} update={update} origins={[sp.id]} />
            <div className="faint">Source: {sp.fields["source"] || sp.pack}</div>
          </div>
        )}
      </aside>
    </div>
  );
}

// ------------------------------------------------------------- background
function BackgroundStep({ c, update }: StepProps) {
  const { byType, byId } = useContent();
  const list = byType("Background");
  const bg = byId(c.backgroundId);
  const feat = bg ? byType("Feat").find((f) => f.name.toLowerCase() === featName(bg.fields["feat"]).replace(/\s*\(.*\)$/, "").toLowerCase()) : undefined;
  return (
    <div className="row">
      <section className="side">
        <h2 style={{ marginBottom: 12 }}>Choose a background</h2>
        <div className="stack" style={{ gap: 8 }}>
          <Picker
            items={list}
            selected={c.backgroundId}
            onPick={(e) => update({ backgroundId: e.id, bonus: {}, equipBackground: undefined })}
            render={(e) => (
              <>
                <span className="t">{e.name}<PackLabel e={e} /></span>
                <div className="faint">{abilityList(e.fields["ability scores"]).map((a) => ABBR[a]).join(" · ")} — {featName(e.fields["feat"])}</div>
                <div className="faint">{stripMd(e.fields["skill proficiencies"] || "")}</div>
              </>
            )}
          />
          {list.length <= 4 && <div className="inset faint">The SRD includes four backgrounds. Add more by importing a content pack.</div>}
        </div>
      </section>
      <aside className="grow panel">
        {!bg ? (
          <p className="muted">Pick a background to see what it grants.</p>
        ) : (
          <div className="stack" style={{ gap: 14 }}>
            <h2 style={{ color: "var(--accent-ink)", fontSize: 28 }}>{bg.name}</h2>
            <dl className="kv">
              {[["Ability scores", "ability scores"], ["Feat", "feat"], ["Skills", "skill proficiencies"], ["Tool", "tool proficiency"], ["Equipment", "equipment"]].map(([l, k]) =>
                bg.fields[k] ? (
                  <div key={k} style={{ display: "contents" }}>
                    <dt>{l}</dt>
                    <dd><MdInline md={bg.fields[k]} /></dd>
                  </div>
                ) : null,
              )}
            </dl>
            {bg.body && <Md md={bg.body} />}
            {feat && (
              <div className="inset">
                <div className="eyebrow">Origin feat</div>
                <h3 style={{ margin: "2px 0 6px" }}>{feat.name}</h3>
                <Md md={feat.body} />
              </div>
            )}
            <ModifChoices c={c} update={update} origins={[bg.id]} />
            <div className="faint">Source: {bg.fields["source"] || bg.pack}</div>
          </div>
        )}
      </aside>
    </div>
  );
}

// --------------------------------------------------------- ability scores
const SUGGESTED: Record<string, number[]> = {
  Barbarian: [15, 13, 14, 10, 12, 8], Bard: [8, 14, 12, 13, 10, 15], Cleric: [14, 8, 13, 10, 15, 12],
  Druid: [8, 12, 14, 13, 15, 10], Fighter: [15, 14, 13, 8, 10, 12], Monk: [12, 15, 13, 10, 14, 8],
  Paladin: [15, 10, 13, 8, 12, 14], Ranger: [12, 15, 13, 8, 14, 10], Rogue: [12, 15, 13, 14, 10, 8],
  Sorcerer: [10, 13, 14, 8, 12, 15], Warlock: [8, 14, 13, 12, 10, 15], Wizard: [8, 12, 13, 15, 14, 10],
};

/** Picking a class starts the standard array from its suggested scores, unless the player already set them. */
function suggestedBase(c: Character, from: string | undefined, to: string): Partial<Character> {
  if (c.method !== "standard" || !SUGGESTED[to]) return {};
  const now = ABILITIES.map((a) => c.base[a]);
  const untouched = now.every((v) => v === 10 || v === undefined) || (from && SUGGESTED[from]?.every((v, i) => v === now[i])) || STANDARD_ARRAY.every((v, i) => v === now[i]);
  return untouched ? { base: Object.fromEntries(ABILITIES.map((a, i) => [a, SUGGESTED[to][i]])) } : {};
}

function AbilityStep({ c, update }: StepProps) {
  const { byId } = useContent();
  const cls = byId(c.classId);
  const bg = byId(c.backgroundId);
  const bgAbilities = abilityList(bg?.fields["ability scores"]);
  const content = useContent();
  const mf = modifFor(c, content);
  const finals = mf.scores;
  const breakdown = scoreBreakdown(c, mf.scoreSteps, bg?.name);

  const setMethod = (method: Character["method"]) => {
    const base = Object.fromEntries(ABILITIES.map((a, i) => [a, method === "standard" ? (SUGGESTED[cls?.name || ""] || STANDARD_ARRAY)[i] : method === "pointbuy" ? 8 : c.base[a] ?? 10]));
    update({ method, base });
  };
  const used = new Map<number, number>();
  if (c.method === "standard") for (const a of ABILITIES) used.set(c.base[a], (used.get(c.base[a]) || 0) + 1);

  const toggleBonus = (a: string) => {
    if (c.bonusMode === "1-1-1") return;
    const cur = { ...c.bonus };
    if (cur[a] === 2) delete cur[a];
    else if (cur[a] === 1) cur[a] = 2;
    else cur[a] = Object.values(cur).includes(1) ? 2 : 1;
    // keep at most one +2 and one +1
    const twos = Object.keys(cur).filter((k) => cur[k] === 2);
    const ones = Object.keys(cur).filter((k) => cur[k] === 1);
    if (twos.length > 1) for (const k of twos) if (k !== a) delete cur[k];
    if (ones.length > 1) for (const k of ones) if (k !== a) delete cur[k];
    update({ bonus: cur });
  };

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <h2>Ability scores</h2>
          <div role="group" aria-label="Method" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["standard", "pointbuy", "manual"] as const).map((m) => (
              <button key={m} className="pill" aria-pressed={c.method === m} onClick={() => setMethod(m)}>
                {{ standard: "Standard Array", pointbuy: "Point Cost", manual: "Random / manual" }[m]}
              </button>
            ))}
          </div>
        </div>
        <p className="faint" style={{ margin: "8px 0 0" }}>
          {c.method === "standard" && `Assign 15, 14, 13, 12, 10, 8.${cls && SUGGESTED[cls.name] ? ` Starts from the suggested ${cls.name} array.` : ""}`}
          {c.method === "pointbuy" && `27 points; scores 8–15. Used: ${pointBuyUsed(c.base)} / 27.`}
          {c.method === "manual" && "Roll four d6 and keep the highest three, six times, then type your results."}
        </p>
        <div className="grid6" style={{ marginTop: 14 }}>
          {ABILITIES.map((a) => (
            <div key={a} className="score">
              <div className="eyebrow">{ABBR[a]}</div>
              {c.method === "standard" && (
                <select aria-label={`${a} score`} value={c.base[a]} onChange={(e) => update({ base: { ...c.base, [a]: +e.target.value } })} style={{ marginTop: 6 }}>
                  {STANDARD_ARRAY.map((v) => <option key={v} value={v}>{v}{(used.get(v) || 0) > 1 && c.base[a] === v ? " (dup)" : ""}</option>)}
                </select>
              )}
              {c.method === "pointbuy" && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 6 }}>
                  <button className="btn small" aria-label={`Lower ${a}`} disabled={c.base[a] <= 8} onClick={() => update({ base: { ...c.base, [a]: c.base[a] - 1 } })}>−</button>
                  <span style={{ minWidth: 22 }}>{c.base[a]}</span>
                  <button className="btn small" aria-label={`Raise ${a}`} disabled={c.base[a] >= 15 || pointBuyUsed({ ...c.base, [a]: c.base[a] + 1 }) > 27} onClick={() => update({ base: { ...c.base, [a]: c.base[a] + 1 } })}>+</button>
                </div>
              )}
              {c.method === "manual" && (
                <input type="number" min={3} max={20} aria-label={`${a} score`} value={c.base[a]} onChange={(e) => update({ base: { ...c.base, [a]: Math.max(1, Math.min(20, +e.target.value || 0)) } })} style={{ width: 70, marginTop: 6 }} />
              )}
              <div className="v">{finals[a]}</div>
              <div className="m">{fmt(mod(finals[a]))}</div>
              {c.method === "pointbuy" && <div className="faint">cost {POINT_COST[c.base[a]]}</div>}
            </div>
          ))}
        </div>
        {c.method === "standard" && [...used.values()].some((n) => n > 1) && <p className="faint" style={{ color: "var(--warn)" }}>Each value in the array should be used once.</p>}
        <p className="faint" style={{ marginBottom: 0 }}>Totals include your background increase and any feats below.</p>
        <details className="scorecalc">
          <summary>Score calculations</summary>
          <div className="scgrid">
            {ABILITIES.map((a) => (
              <div key={a} className="sccard">
                <div className="schead"><b>{a}</b><span>{finals[a]} <span className="faint">({fmt(mod(finals[a]))})</span></span></div>
                <table>
                  <tbody>
                    {breakdown[a].map((r, i) => (
                      <tr key={i}>
                        <td>{r.label}{r.note ? <span className="faint"> · {r.note}</span> : null}</td>
                        <td>{i === 0 ? r.amount : fmt(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </details>
      </div>

      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <h2>Background increase</h2>
          <div role="group" aria-label="Increase pattern" style={{ display: "flex", gap: 6 }}>
            <button className="pill" aria-pressed={c.bonusMode === "2-1"} onClick={() => update({ bonusMode: "2-1", bonus: {} })}>+2 and +1</button>
            <button className="pill" aria-pressed={c.bonusMode === "1-1-1"} onClick={() => update({ bonusMode: "1-1-1", bonus: Object.fromEntries(bgAbilities.map((a) => [a, 1])) })}>+1 to all three</button>
          </div>
        </div>
        {!bg ? (
          <p className="muted">Choose a background first: it lists the three abilities you can increase.</p>
        ) : (
          <>
            <p className="faint">{bg.name} lists {bgAbilities.join(", ")}. {c.bonusMode === "2-1" ? "Click an ability once for +1, again for +2." : "Each gets +1."} Scores can’t go above 20.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {bgAbilities.map((a) => (
                <button key={a} className="pill" aria-pressed={!!c.bonus[a]} onClick={() => toggleBonus(a)}>
                  {a} {c.bonus[a] ? `+${c.bonus[a]}` : ""}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <FeatSlots c={c} update={update} />
    </div>
  );
}

// ---------------------------------------------------------- skills/spells
function SkillsStep({ c, update }: StepProps) {
  const content = useContent();
  const cls = content.byId(c.classId);
  const bg = content.byId(c.backgroundId);
  const pick = skillChoiceOf(cls);
  const fromBg = listOf(bg?.fields["skill proficiencies"] || "");
  const casting = classInfos(c, content.byId).filter((i) => casterKindOf(i));
  const toggle = (list: string[], v: string, max: number) => (list.includes(v) ? list.filter((x) => x !== v) : list.length < max ? [...list, v] : list);

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="panel">
        <h2>Class skills</h2>
        {!cls ? (
          <p className="muted">Choose a class first.</p>
        ) : (
          <>
            <p className="faint">{cls.name}: choose {pick.count}. Chosen {c.classSkills.length} / {pick.count}. Skills your background already gives are marked.</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {pick.from.map((s) => {
                const bgHas = fromBg.includes(s);
                return (
                  <Btn key={s} className="pill" disabled={bgHas} aria-pressed={c.classSkills.includes(s)} onClick={() => update({ classSkills: toggle(c.classSkills, s, pick.count) })} why={bgHas ? "Your background already gives you this skill, so pick a different one here." : undefined}>
                    {s}{bgHas ? " (background)" : ""}
                  </Btn>
                );
              })}
            </div>
          </>
        )}
      </div>
      {casting.map((i) => (
        <ClassSpells key={i.index} c={c} update={update} index={i.index} />
      ))}
    </div>
  );
}

function ClassSpells({ c, update, index }: StepProps & { index: number }) {
  const content = useContent();
  const info = classInfos(c, content.byId).find((i) => i.index === index)!;
  // Eldritch Knight / Arcane Trickster: slots from the subclass's table, spells from the Wizard list
  const caster = casterInfoOf(info);
  const listCls = spellListClass(info, content.entries);
  const spellsByLevel = useMemo(() => classSpells(listCls, content.byType("Spell")), [listCls, content]);
  const toggle = (list: string[], v: string, max: number) => (list.includes(v) ? list.filter((x) => x !== v) : list.length < max ? [...list, v] : list);
  const multi = extraClasses(c).length > 0;
  // subclass, oath and feat spells that are always prepared: shown, but not counted against the prepared limit
  const always = new Map(modifFor(c, content).grantedSpells.filter((g) => g.prepared).map((g) => [g.spell.name, g.source]));
  if (!caster) return null;
  const alwaysShown = [...spellsByLevel.entries()].filter(([l]) => l > 0 && l <= caster.maxSpellLevel).flatMap(([, list]) => list).filter((x) => always.has(x.name)).length;
  return (
    <div className="panel">
      <h2>{multi ? `${info.cls.name} spells` : "Spells"}</h2>
      {!content.loaded.has("spells") ? (
        <p className="muted">Loading spells…</p>
      ) : (
        <>
          <p className="faint">
            Level {info.level} {info.cls.name}: {caster.cantrips ? `${caster.cantrips} cantrips, ` : ""}{caster.prepared} prepared spells of level {caster.maxSpellLevel} or lower.
            {multi ? " Spell slots for all your classes together are shown on the sheet." : ` Slots: ${caster.slots.map((s) => `${s.count}× level ${s.level}`).join(", ")}.`}
          </p>
          {caster.cantrips > 0 && (
            <SpellGroup title={`Cantrips (${info.cantrips.length}/${caster.cantrips})`} spells={spellsByLevel.get(0) || []} chosen={info.cantrips} onToggle={(n) => update(patchClass(c, index, { cantrips: toggle(info.cantrips, n, caster.cantrips) }))} />
          )}
          {Array.from({ length: caster.maxSpellLevel }, (_, i) => i + 1).map((lvl) => (
            <SpellGroup key={lvl} title={`Level ${lvl}`} spells={spellsByLevel.get(lvl) || []} chosen={info.spells} always={always} onToggle={(n) => update(patchClass(c, index, { spells: toggle(info.spells, n, caster.prepared) }))} />
          ))}
          <p className="faint">Prepared: {info.spells.filter((n) => !always.has(n)).length} / {caster.prepared}{alwaysShown ? ` (plus ${alwaysShown} always prepared)` : ""}</p>
        </>
      )}
    </div>
  );
}

function SpellGroup({ title, spells, chosen, onToggle, always }: { title: string; spells: Entry[]; chosen: string[]; onToggle: (n: string) => void; always?: Map<string, string> }) {
  const [open, setOpen] = useState<string>();
  return (
    <div style={{ marginTop: 14 }}>
      <h3 style={{ marginBottom: 8 }}>{title}</h3>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {spells.map((s) => (
          <span key={s.id} style={{ display: "inline-flex" }}>
            {always?.has(s.name) ? (
              <button className="pill" aria-pressed disabled title={`Always prepared (${always.get(s.name)}); doesn't count against your prepared spells`}>{s.name} · Always prepared</button>
            ) : (
              <button className="pill" aria-pressed={chosen.includes(s.name)} onClick={() => onToggle(s.name)}>{s.name}</button>
            )}
            <button className="btn small" style={{ border: 0 }} aria-label={`About ${s.name}`} onClick={() => setOpen(open === s.id ? undefined : s.id)}>ⓘ</button>
          </span>
        ))}
      </div>
      {open && (() => {
        const s = spells.find((x) => x.id === open)!;
        return (
          <div className="inset" style={{ marginTop: 8 }}>
            <strong>{s.name}</strong> <span className="faint"><i>{s.tagline}</i></span>
            <div className="faint">{["casting time", "range", "components", "duration"].map((k) => `${k[0].toUpperCase()}${k.slice(1)}: ${stripMd(s.fields[k] || "—")}`).join(" · ")}</div>
            <Md md={s.body} />
          </div>
        );
      })()}
    </div>
  );
}

// -------------------------------------------------------------- equipment
function EquipmentStep({ c, update }: StepProps) {
  const { byId, entries } = useContent();
  const cls = byId(c.classId);
  const bg = byId(c.backgroundId);
  const armor = useMemo(() => armorTable(entries), [entries]);
  const weapons = useMemo(() => weaponTable(entries), [entries]);
  const cat = useMemo(() => catalog(entries, weapons, armor), [entries, weapons, armor]);
  const inv = inventoryOf(c, cls, bg, cat);
  const d = derive(c, { cls, background: bg, species: byId(c.speciesId), armor, items: inv.items, classes: classInfos(c, byId), modif: modifFor(c, { entries, byId }) });
  const Group = ({ title, opts, value, onPick }: { title: string; opts: { key: string; text: string }[]; value?: string; onPick: (k: string) => void }) => (
    <div className="panel">
      <h2 style={{ marginBottom: 10 }}>{title}</h2>
      {opts.length === 0 ? <p className="muted">Nothing to choose.</p> : (
        <div className="stack" style={{ gap: 8 }}>
          {opts.map((o) => (
            <button key={o.key} className="card" aria-pressed={(value || "A") === o.key} onClick={() => onPick(o.key)}>
              <strong>Option {o.key}</strong>
              <div className="muted" style={{ fontSize: 13 }}>{o.text}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
  return (
    <div className="row">
      <div className="grow stack" style={{ gap: 18 }}>
        {!inv.fromStart && (
          <div className="inset" role="status">
            This character’s inventory has been edited on the sheet, so changing these choices won’t change it.{" "}
            <button className="linkish" onClick={() => { if (confirm("Replace the inventory and coins with the starting equipment chosen here?")) update({ inventory: undefined, coins: undefined, play: { ...(c.play || {}), gear: "" } }); }}>
              Replace it with this starting equipment
            </button>
          </div>
        )}
        <Group title={`${cls?.name || "Class"} starting equipment`} opts={equipmentOptions(cls?.fields["starting equipment"])} value={c.equipClass || "A"} onPick={(k) => update({ equipClass: k })} />
        <Group title={`${bg?.name || "Background"} equipment`} opts={equipmentOptions(bg?.fields["equipment"])} value={c.equipBackground || "A"} onPick={(k) => update({ equipBackground: k })} />
      </div>
      <aside className="side panel">
        <div className="eyebrow">Armor Class</div>
        <div style={{ fontFamily: "var(--serif)", fontSize: 44, fontWeight: 600 }}>{d.ac}</div>
        <div className="faint">{d.acNote}</div>
        <p className="faint" style={{ marginTop: 14 }}>
          Worked out from the armor and shield {inv.fromStart ? "in your chosen equipment" : "equipped in your inventory"}. You’ll start with {inv.items.length} item{inv.items.length === 1 ? "" : "s"} and {inv.coins.gp} GP; manage them in the sheet’s Inventory tab.
        </p>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------- details
function DetailsStep({ c, update }: StepProps) {
  return (
    <div className="stack" style={{ gap: 18, maxWidth: 820 }}>
      <div className="panel stack" style={{ gap: 14 }}>
        <label className="field">
          Character name
          <input type="text" value={c.name} onChange={(e) => update({ name: e.target.value })} placeholder="Name your character" />
        </label>
        <DetailsForm c={c} onChange={(details) => update({ details })} />
        <label className="field">
          Other notes
          <textarea value={c.notes} onChange={(e) => update({ notes: e.target.value })} />
        </label>
      </div>
      <div className="panel stack" style={{ gap: 8 }}>
        <h2>Settings</h2>
        <label className="checkrow">
          <input type="checkbox" checked={!c.ignorePrereqs} onChange={(e) => update({ ignorePrereqs: !e.target.checked })} />
          <span><b>Use prerequisites</b> for feats and multiclassing<div className="faint">When off, the builder lists every feat and lets you add any class, whatever your scores and level.</div></span>
        </label>
      </div>
    </div>
  );
}
