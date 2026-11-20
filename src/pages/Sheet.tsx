import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { loadCharacters, useContent } from "../lib/store.tsx";
import { Md, MdInline } from "../lib/md.tsx";
import { features, stripMd } from "../lib/parse.ts";
import {
  ABBR, ABILITIES, SKILLS, SKILL_ABILITY, armorTable, casterInfo, derive, equipmentOptions, featName, fmt,
  speciesChoice, traits,
} from "../lib/rules.ts";

export default function Sheet() {
  const { id } = useParams();
  const content = useContent();
  const c = loadCharacters().find((x) => x.id === id);
  const cls = content.byId(c?.classId);
  const sub = content.byId(c?.subclassId);
  const sp = content.byId(c?.speciesId);
  const bg = content.byId(c?.backgroundId);
  const armor = useMemo(() => armorTable(content.entries), [content.entries]);
  const caster = casterInfo(cls, c?.level || 1);
  useEffect(() => {
    if (caster) content.ensure("spells");
  }, [!!caster]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!c) return <div className="panel">Character not found. <Link to="/">Back to characters</Link></div>;
  const d = derive(c, { cls, background: bg, species: sp, armor });
  const missing = [
    c.classId && !cls && "class",
    c.speciesId && !sp && "species",
    c.backgroundId && !bg && "background",
  ].filter(Boolean);
  const feat = bg ? content.byType("Feat").find((f) => f.name.toLowerCase() === featName(bg.fields["feat"]).replace(/\s*\(.*\)$/, "").toLowerCase()) : undefined;
  const choice = speciesChoice(sp);
  const choiceRow = choice?.table.rows.find((r) => r[0] === c.speciesChoice);
  const classFeats = cls ? features(cls).filter((f) => f.level <= c.level) : [];
  const subFeats = sub && c.level >= 3 ? features(sub).filter((f) => f.level <= c.level) : [];
  const spells = content.byType("Spell");
  const spellEntry = (n: string) => spells.find((s) => s.name === n);
  const gear = [
    equipmentOptions(cls?.fields["starting equipment"]).find((o) => o.key === (c.equipClass || "A"))?.text,
    equipmentOptions(bg?.fields["equipment"]).find((o) => o.key === (c.equipBackground || "A"))?.text,
  ].filter(Boolean);

  const Stat = ({ label, value, note }: { label: string; value: string | number; note?: string }) => (
    <div className="score">
      <div className="eyebrow">{label}</div>
      <div className="v">{value}</div>
      {note && <div className="faint">{note}</div>}
    </div>
  );

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: 34 }}>{c.name || "Unnamed character"}</h1>
          <div className="muted">
            {[sp?.name && (c.speciesChoice ? `${sp.name} (${c.speciesChoice})` : sp.name), cls && `${cls.name} ${c.level}`, sub?.name, bg?.name].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="noprint" style={{ display: "flex", gap: 8 }}>
          <Link className="btn" to={`/build/${c.id}`}>Edit</Link>
          <button className="btn" onClick={() => window.print()}>Print</button>
        </div>
      </div>
      {missing.length > 0 && (
        <div className="choice">This character uses a {missing.join(", ")} that isn’t loaded. Import the content pack it came from to see everything.</div>
      )}

      <div className="grid6">
        <Stat label="Armor Class" value={d.ac} note={d.acNote} />
        <Stat label="Hit Points" value={d.hp} note={`d${d.hitDie} per level`} />
        <Stat label="Initiative" value={fmt(d.initiative)} />
        <Stat label="Speed" value={`${d.speed} ft`} />
        <Stat label="Proficiency" value={fmt(d.pb)} />
        <Stat label="Passive Perc." value={d.passivePerception} />
      </div>

      <div className="row">
        <section className="side stack">
          <div className="panel">
            <h2 style={{ marginBottom: 10 }}>Abilities</h2>
            <table className="data">
              <thead><tr><th>Ability</th><th>Score</th><th>Mod</th><th>Save</th></tr></thead>
              <tbody>
                {ABILITIES.map((a) => (
                  <tr key={a}>
                    <td>{a}</td>
                    <td>{d.scores[a]}</td>
                    <td style={{ color: "var(--accent-ink)", fontWeight: 600 }}>{fmt(d.mods[a])}</td>
                    <td>{d.saves[a].prof ? "● " : "○ "}{fmt(d.saves[a].value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel">
            <h2 style={{ marginBottom: 10 }}>Skills</h2>
            <table className="data">
              <tbody>
                {SKILLS.map((s) => (
                  <tr key={s}>
                    <td style={{ width: 24 }}>{d.skills[s].prof ? "●" : "○"}</td>
                    <td>{s} <span className="faint">({ABBR[SKILL_ABILITY[s]]})</span></td>
                    <td style={{ textAlign: "right", fontWeight: d.skills[s].prof ? 600 : 400 }}>{fmt(d.skills[s].value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel">
            <h2 style={{ marginBottom: 10 }}>Proficiencies</h2>
            <dl className="kv">
              <dt>Armor</dt><dd><MdInline md={cls?.fields["armor training"] || "—"} /></dd>
              <dt>Weapons</dt><dd><MdInline md={cls?.fields["weapon proficiencies"] || "—"} /></dd>
              <dt>Tools</dt><dd><MdInline md={[cls?.fields["tool proficiencies"], bg?.fields["tool proficiency"]].filter(Boolean).join("; ") || "—"} /></dd>
            </dl>
          </div>
        </section>

        <section className="grow stack">
          <div className="panel stack">
            <h2>Features &amp; traits</h2>
            {[...classFeats.map((f) => ({ ...f, src: cls!.name })), ...subFeats.map((f) => ({ ...f, src: sub!.name }))]
              .sort((a, b) => a.level - b.level)
              .map((f, i) => (
                <details key={`f${i}`} className="inset">
                  <summary><strong>{f.name}</strong> <span className="faint">· {f.src} {f.level}</span></summary>
                  <Md md={f.md} />
                </details>
              ))}
            {traits(sp).map((t, i) => (
              <details key={`t${i}`} className="inset">
                <summary><strong>{t.name}</strong> <span className="faint">· {sp!.name}</span></summary>
                <Md md={t.md} />
              </details>
            ))}
            {choiceRow && (
              <div className="inset">
                <strong>{c.speciesChoice}</strong> <span className="faint">· {choice!.title}</span>
                <div className="faint">{choice!.table.header.slice(1).map((h, i) => `${h}: ${choiceRow[i + 1]}`).join(" · ")}</div>
              </div>
            )}
            {feat && (
              <details className="inset">
                <summary><strong>{feat.name}</strong> <span className="faint">· {bg!.name} feat</span></summary>
                <Md md={feat.body} />
              </details>
            )}
          </div>

          {caster && (
            <div className="panel stack">
              <h2>Spells</h2>
              <div className="faint">Slots: {caster.slots.map((s) => `${s.count}× level ${s.level}`).join(", ")}</div>
              {[...c.cantrips.map((n) => ({ n, l: "Cantrip" })), ...c.spells.map((n) => ({ n, l: "" }))].map(({ n, l }) => {
                const s = spellEntry(n);
                return (
                  <details key={n} className="inset">
                    <summary><strong>{n}</strong> <span className="faint">· {l || s?.tagline || ""}</span></summary>
                    {s ? (
                      <>
                        <div className="faint">{["casting time", "range", "components", "duration"].map((k) => stripMd(s.fields[k] || "")).join(" · ")}</div>
                        <Md md={s.body} />
                      </>
                    ) : <p className="faint">Not loaded.</p>}
                  </details>
                );
              })}
              {c.cantrips.length + c.spells.length === 0 && <p className="muted">No spells chosen yet.</p>}
            </div>
          )}

          <div className="panel">
            <h2 style={{ marginBottom: 10 }}>Equipment</h2>
            {gear.length ? gear.map((g, i) => <p key={i} style={{ margin: "0 0 6px" }}>{g}</p>) : <p className="muted">None chosen.</p>}
          </div>
          {c.notes && (
            <div className="panel">
              <h2 style={{ marginBottom: 10 }}>Notes</h2>
              <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{c.notes}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
