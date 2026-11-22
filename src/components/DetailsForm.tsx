import { DETAIL_GROUPS, type Character, type DetailKey } from "../lib/rules.ts";

/** The character's details (alignment, looks, personality, people, backstory), editable or read-only. */
export function DetailsForm({ c, onChange, readOnly }: { c: Character; onChange?: (details: Character["details"]) => void; readOnly?: boolean }) {
  const det = c.details || {};
  const set = (key: string, value: string) => onChange?.({ ...det, [key as DetailKey]: value || undefined });
  if (readOnly) {
    const groups = DETAIL_GROUPS.map((g) => ({ ...g, fields: g.fields.filter((f) => det[f.key as DetailKey]) })).filter((g) => g.fields.length);
    if (!groups.length) return <p className="note">No details yet. Add alignment, looks, personality and backstory in the builder’s Details step.</p>;
    return (
      <div className="detailsview">
        {groups.map((g) => (
          <section key={g.title}>
            <h4>{g.title}</h4>
            <dl>
              {g.fields.map((f) => (
                <div key={f.key} className={f.long ? "long" : ""}>
                  <dt>{f.label}</dt>
                  <dd>{det[f.key as DetailKey]}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    );
  }
  return (
    <div className="detailsform">
      {DETAIL_GROUPS.map((g) => (
        <fieldset key={g.title}>
          <legend>{g.title}</legend>
          <div className={g.fields.some((f) => f.long) ? "dfl" : "dfs"}>
            {g.fields.map((f) => (
              <label key={f.key} className="field">
                {f.label}
                {f.options ? (
                  <select value={det[f.key as DetailKey] || ""} onChange={(e) => set(f.key, e.target.value)}>
                    <option value="">—</option>
                    {f.options.map((o) => <option key={o}>{o}</option>)}
                  </select>
                ) : f.long ? (
                  <textarea rows={f.key === "backstory" ? 6 : 2} value={det[f.key as DetailKey] || ""} onChange={(e) => set(f.key, e.target.value)} />
                ) : (
                  <input type="text" value={det[f.key as DetailKey] || ""} onChange={(e) => set(f.key, e.target.value)} />
                )}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
