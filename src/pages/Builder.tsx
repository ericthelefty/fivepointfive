import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { loadCharacters, saveCharacter, useContent } from "../lib/store.tsx";
import { Md, MdInline } from "../lib/md.tsx";
import { features, stripMd, type Entry } from "../lib/parse.ts";
import {
  ABBR, ABILITIES, POINT_COST, SKILLS, STANDARD_ARRAY, abilityList, armorTable, casterInfo, classSpells,
  derive, equipmentOptions, featName, finalScores, fmt, listOf, mod, pointBuyUsed, skillChoice, speciesChoice,
  traits, intro, type Character,
} from "../lib/rules.ts";

const STEPS = ["Class", "Species", "Background", "Ability scores", "Skills & spells", "Equipment", "Details"] as const;

export default function Builder() {
  const { id } = useParams();
  const nav = useNavigate();
  const content = useContent();
  const [c, setC] = useState<Character | undefined>(() => loadCharacters().find((x) => x.id === id));
  const [step, setStep] = useState(0);

  const update = (patch: Partial<Character>) =>
    setC((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      saveCharacter(next);
      return next;
    });

  const cls = content.byId(c?.classId);
  const caster = casterInfo(cls, c?.level || 1);
  useEffect(() => {
    if (caster) content.ensure("spells");
  }, [!!caster]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!c) return <div className="panel">Character not found. <Link to="/">Back to characters</Link></div>;

  const done = [
    !!c.classId,
    !!c.speciesId,
    !!c.backgroundId,
    Object.keys(c.bonus).length > 0,
    c.classSkills.length >= skillChoice(cls?.fields["skill proficiencies"]).count && c.classSkills.length > 0,
    !!c.equipClass,
    !!c.name,
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <h1>{c.name || "New character"}</h1>
        <Link className="btn" to={`/sheet/${c.id}`}>View sheet</Link>
      </div>
      <nav className="steps" aria-label="Builder steps">
        {STEPS.map((s, i) => (
          <button key={s} className={`${i === step ? "on" : ""} ${done[i] && i !== step ? "done" : ""}`} onClick={() => setStep(i)} aria-current={i === step ? "step" : undefined}>
            <span className="n">{done[i] && i !== step ? "✓" : i + 1}</span>
            {s}
          </button>
        ))}
      </nav>
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
  const { byType, byId } = useContent();
  const classes = byType("Class");
  const cls = byId(c.classId);
  const subclasses = byType("Subclass").filter((s) => cls && stripMd(s.fields["parent"] || "").replace(/^[\w-]+:class\//, "").toLowerCase() === cls.name.toLowerCase());
  const sub = byId(c.subclassId);
  const feats = cls ? features(cls).filter((f) => f.level <= c.level) : [];
  const subFeats = sub && c.level >= 3 ? features(sub).filter((f) => f.level <= c.level) : [];
  return (
    <div className="row">
      <section className="grow">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <h2>Choose a class</h2>
          <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            Level
            <select value={c.level} onChange={(e) => update({ level: +e.target.value })}>
              {Array.from({ length: 20 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}
            </select>
          </label>
        </div>
        <div className="grid3">
          <Picker
            items={classes}
            selected={c.classId}
            onPick={(e) => update({ classId: e.id, subclassId: undefined, classSkills: [], equipClass: undefined, cantrips: [], spells: [] })}
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
      </section>
      <aside className="side panel">
        {!cls ? (
          <p className="muted">Pick a class to see its traits and features.</p>
        ) : (
          <div className="stack">
            <div className="eyebrow">Selected class</div>
            <h2 style={{ color: "var(--accent-ink)", fontSize: 28 }}>{cls.name}</h2>
            <dl className="kv">
              {[["Primary ability", "primary ability"], ["Hit Point Die", "hit point die"], ["Saving throws", "saving throw proficiencies"], ["Skills", "skill proficiencies"], ["Weapons", "weapon proficiencies"], ["Armor training", "armor training"]].map(([l, k]) => (
                <div key={k} style={{ display: "contents" }}>
                  <dt>{l}</dt>
                  <dd><MdInline md={cls.fields[k] || "—"} /></dd>
                </div>
              ))}
            </dl>
            {c.level >= 3 && subclasses.length > 0 && (
              <div className="choice">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong>Subclass</strong>
                  {!sub && <span className="tag need">Choice needed</span>}
                </div>
                <div className="stack" style={{ marginTop: 8, gap: 6 }}>
                  {subclasses.map((s) => (
                    <button key={s.id} className="card" aria-pressed={s.id === c.subclassId} onClick={() => update({ subclassId: s.id })}>
                      <span className="t" style={{ fontSize: 16 }}>{s.name}</span><PackLabel e={s} />
                      {s.tagline && <div className="faint">{s.tagline}</div>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="eyebrow" style={{ marginTop: 6 }}>Features through level {c.level}</div>
            {[...feats.map((f) => ({ ...f, src: cls.name })), ...subFeats.map((f) => ({ ...f, src: sub!.name }))]
              .sort((a, b) => a.level - b.level)
              .map((f, i) => (
                <details key={i} className="inset">
                  <summary><strong>{f.name}</strong> <span className="faint">· Level {f.level}{f.src !== cls.name ? ` · ${f.src}` : ""}</span></summary>
                  <Md md={f.md} />
                </details>
              ))}
            <div className="faint">Source: {cls.fields["source"] || cls.pack}</div>
          </div>
        )}
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------- species
function skillTraitChoice(sp?: Entry): { count: number; from: string[] } | null {
  for (const t of traits(sp)) {
    const any = t.md.match(/proficiency in one skill of your choice/i);
    if (any) return { count: 1, from: [...SKILLS] };
    const m = t.md.match(/proficiency in the ([A-Z][\w ,]+?),? or ([A-Z][\w ]+?) skill/);
    if (m) return { count: 1, from: [...listOf(m[1]), m[2]].filter((s) => SKILLS.includes(s)) };
  }
  return null;
}

function SpeciesStep({ c, update }: StepProps) {
  const { byType, byId } = useContent();
  const list = byType("Species");
  const sp = byId(c.speciesId);
  const choice = speciesChoice(sp);
  const skillPick = skillTraitChoice(sp);
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
                <strong>Skill proficiency from your species</strong>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {skillPick.from.map((s) => (
                    <button key={s} className="pill" aria-pressed={c.extraSkills.includes(s)} onClick={() => update({ extraSkills: [s] })}>{s}</button>
                  ))}
                </div>
              </div>
            )}
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

function AbilityStep({ c, update }: StepProps) {
  const { byId } = useContent();
  const cls = byId(c.classId);
  const bg = byId(c.backgroundId);
  const bgAbilities = abilityList(bg?.fields["ability scores"]);
  const finals = finalScores(c);

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
    </div>
  );
}

// ---------------------------------------------------------- skills/spells
function SkillsStep({ c, update }: StepProps) {
  const content = useContent();
  const cls = content.byId(c.classId);
  const bg = content.byId(c.backgroundId);
  const pick = skillChoice(cls?.fields["skill proficiencies"]);
  const fromBg = listOf(bg?.fields["skill proficiencies"] || "");
  const caster = casterInfo(cls, c.level);
  const spellsByLevel = useMemo(() => (cls && caster ? classSpells(cls, content.byType("Spell")) : new Map()), [cls, caster, content]);
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
                  <button key={s} className="pill" disabled={bgHas} aria-pressed={c.classSkills.includes(s)} onClick={() => update({ classSkills: toggle(c.classSkills, s, pick.count) })} title={bgHas ? "Already from your background" : undefined}>
                    {s}{bgHas ? " (background)" : ""}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
      {caster && (
        <div className="panel">
          <h2>Spells</h2>
          {!content.loaded.has("spells") ? (
            <p className="muted">Loading spells…</p>
          ) : (
            <>
              <p className="faint">
                Level {c.level} {cls!.name}: {caster.cantrips ? `${caster.cantrips} cantrips, ` : ""}{caster.prepared} prepared spells of level {caster.maxSpellLevel} or lower.
                Slots: {caster.slots.map((s) => `${s.count}× level ${s.level}`).join(", ")}.
              </p>
              {caster.cantrips > 0 && (
                <SpellGroup title={`Cantrips (${c.cantrips.length}/${caster.cantrips})`} spells={spellsByLevel.get(0) || []} chosen={c.cantrips} onToggle={(n) => update({ cantrips: toggle(c.cantrips, n, caster.cantrips) })} />
              )}
              {Array.from({ length: caster.maxSpellLevel }, (_, i) => i + 1).map((lvl) => (
                <SpellGroup key={lvl} title={`Level ${lvl}`} spells={spellsByLevel.get(lvl) || []} chosen={c.spells} onToggle={(n) => update({ spells: toggle(c.spells, n, caster.prepared) })} />
              ))}
              <p className="faint">Prepared: {c.spells.length} / {caster.prepared}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SpellGroup({ title, spells, chosen, onToggle }: { title: string; spells: Entry[]; chosen: string[]; onToggle: (n: string) => void }) {
  const [open, setOpen] = useState<string>();
  return (
    <div style={{ marginTop: 14 }}>
      <h3 style={{ marginBottom: 8 }}>{title}</h3>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {spells.map((s) => (
          <span key={s.id} style={{ display: "inline-flex" }}>
            <button className="pill" aria-pressed={chosen.includes(s.name)} onClick={() => onToggle(s.name)}>{s.name}</button>
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
  const d = derive(c, { cls, background: bg, species: byId(c.speciesId), armor });
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
        <Group title={`${cls?.name || "Class"} starting equipment`} opts={equipmentOptions(cls?.fields["starting equipment"])} value={c.equipClass} onPick={(k) => update({ equipClass: k })} />
        <Group title={`${bg?.name || "Background"} equipment`} opts={equipmentOptions(bg?.fields["equipment"])} value={c.equipBackground} onPick={(k) => update({ equipBackground: k })} />
      </div>
      <aside className="side panel">
        <div className="eyebrow">Armor Class</div>
        <div style={{ fontFamily: "var(--serif)", fontSize: 44, fontWeight: 600 }}>{d.ac}</div>
        <div className="faint">{d.acNote}</div>
        <p className="faint" style={{ marginTop: 14 }}>Worked out from the armor and shield in your chosen equipment.</p>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------- details
function DetailsStep({ c, update }: StepProps) {
  return (
    <div className="panel stack" style={{ gap: 14, maxWidth: 720 }}>
      <label className="field">
        Character name
        <input type="text" value={c.name} onChange={(e) => update({ name: e.target.value })} placeholder="Name your character" />
      </label>
      <label className="field">
        Notes (appearance, personality, backstory)
        <textarea value={c.notes} onChange={(e) => update({ notes: e.target.value })} />
      </label>
    </div>
  );
}
