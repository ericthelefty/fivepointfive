/**
 * A creature's stat block with clickable rolls: ability checks and saves, skills, attacks and damage.
 * Used by the encounter builder and tracker; styled with the play sheet's classes (inside .sheetv).
 */
import type { ReactNode } from "react";
import type { CreatureAction, CreatureStats } from "../lib/creature.ts";

const ABILITIES = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"] as const;
const fmt = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`);

export interface Roller {
  /** A d20 test: an ability check, save, skill or initiative. */
  test: (title: string, bonus: number) => void;
  /** An attack roll, then its damage on demand. */
  attack: (title: string, toHit: number, damage: CreatureAction["damage"]) => void;
  damage: (title: string, expr: string, type: string) => void;
}

export function StatBlock({ st, roll, hp, head }: { st: CreatureStats; roll?: Roller; hp?: ReactNode; head?: ReactNode }) {
  const row = (a: CreatureAction, i: number) => (
    <div key={`${a.name}-${i}`} className="crow">
      <div className="ctext"><b>{a.name}.</b> <span className="note">{a.text}</span></div>
      {roll && (
        <div className="rowbtn">
          {a.toHit !== undefined && <button className="sbtn sm" onClick={() => roll.attack(`${st.name}: ${a.name}`, a.toHit!, a.damage)}>{fmt(a.toHit)} to hit</button>}
          {a.save && <span className="tag plain">DC {a.save.dc} {a.save.ability.slice(0, 3)}</span>}
          {a.damage.length > 0 && (
            <button className="sbtn sm ghost" onClick={() => roll.damage(`${st.name}: ${a.name}`, a.damage.map((x) => x.expr).join("+"), a.damage.map((x) => x.type).join(" + "))}>
              {a.damage.map((x) => x.expr).join(" + ")}
            </button>
          )}
        </div>
      )}
    </div>
  );
  return (
    <div className="formblock statblock">
      <div className="fbhead">
        <div>
          <b className="fbname">{st.name}</b> <span className="mut">{st.tagline}{st.crText ? ` · CR ${st.crText}` : ""}{st.xp !== undefined ? ` (${st.xp.toLocaleString()} XP)` : ""}</span>
        </div>
        {head}
      </div>
      <div className="fbtags" style={{ margin: "6px 0" }}>
        <span className="tag plain">AC {st.ac}</span>
        <span className="tag plain">HP {st.hpText || st.hp}</span>
        <span className="tag plain">Speed {st.speedText}</span>
        {roll && st.initiative !== undefined ? (
          <button className="sbtn sm ghost" onClick={() => roll.test(`${st.name}: Initiative`, st.initiative!)}>Initiative {fmt(st.initiative)}</button>
        ) : st.initiative !== undefined ? <span className="tag plain">Initiative {fmt(st.initiative)}</span> : null}
      </div>
      {hp}
      <div className="fbabil" style={{ marginTop: 8 }}>
        {ABILITIES.map((a) => {
          const m = Math.floor((st.scores[a] - 10) / 2);
          const sv = st.saves[a] ?? m;
          return (
            <div key={a} className="fbab">
              <div className="sl">{a.slice(0, 3)}</div>
              {roll ? <button className="sbtn sm" onClick={() => roll.test(`${st.name}: ${a} check`, m)}>{fmt(m)}</button> : <b>{fmt(m)}</b>}
              <div className="mut" style={{ fontSize: 11 }}>{st.scores[a]}</div>
              {roll ? <button className="sbtn sm ghost" onClick={() => roll.test(`${st.name}: ${a} save`, sv)}>Save {fmt(sv)}</button> : <span className="mut" style={{ fontSize: 11 }}>Save {fmt(sv)}</span>}
            </div>
          );
        })}
      </div>
      {Object.keys(st.skills).length > 0 && (
        <div className="rowbtn" style={{ flexWrap: "wrap", marginTop: 8 }}>
          {Object.entries(st.skills).map(([k, v]) => (roll
            ? <button key={k} className="sbtn sm ghost" onClick={() => roll.test(`${st.name}: ${k}`, v)}>{k} {fmt(v)}</button>
            : <span key={k} className="tag plain">{k} {fmt(v)}</span>))}
        </div>
      )}
      {(st.defenses.length > 0 || st.senses || st.languages) && (
        <div className="note" style={{ marginTop: 8 }}>
          {[...st.defenses, st.senses && `Senses: ${st.senses}`, st.languages && `Languages: ${st.languages}`].filter(Boolean).join(" · ")}
        </div>
      )}
      {st.traits.length > 0 && <div className="fbsec"><h4>Traits</h4>{st.traits.map((x) => <div key={x.name} className="crow"><div className="ctext"><b>{x.name}.</b> <span className="note">{x.text}</span></div></div>)}</div>}
      {st.actions.length > 0 && <div className="fbsec"><h4>Actions</h4>{st.actions.map(row)}</div>}
      {st.bonusActions.length > 0 && <div className="fbsec"><h4>Bonus Actions</h4>{st.bonusActions.map(row)}</div>}
      {st.reactions.length > 0 && <div className="fbsec"><h4>Reactions</h4>{st.reactions.map(row)}</div>}
      {st.legendary && st.legendary.length > 0 && (
        <div className="fbsec">
          <h4>Legendary Actions</h4>
          {st.legendaryUses && <p className="note" style={{ margin: "0 0 4px" }}>{st.legendaryUses}</p>}
          {st.legendary.map(row)}
        </div>
      )}
    </div>
  );
}
