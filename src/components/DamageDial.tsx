import { DAMAGE_ICON, DAMAGE_TYPES, type DamageType } from "../lib/damageDial.ts";

/** The ring's geometry, in the dial's own units (the SVG scales it to the size the CSS gives it). */
const C = 310;
const R_ICON = 204;
const R_TOTAL = 274;
/** The icons are drawn about 36 units across; they're shown at twice that. */
const ICON_SCALE = 2;
const STEP = 360 / DAMAGE_TYPES.length;
const at = (r: number, deg: number) => {
  const t = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(t), C + r * Math.sin(t)] as const;
};

/** How long after the dice land the next type lights up (ms). */
export const DIAL_STAGGER = 140;

/**
 * The damage dial around the dice: every damage type's icon in its fixed place on a ring. The types in this roll light
 * up one after another, play their own short effect, then keep a subtle loop, with their share of the damage beside
 * them in the same gold as the dice's modifier, so it reads on any background; the other types aren't shown. `delay` is when the dice land.
 */
export function DamageDial({ parts, delay }: { parts: { type: DamageType; total: number }[]; delay: number }) {
  const lit = DAMAGE_TYPES.filter((t) => parts.some((p) => p.type === t));
  const totalOf = (t: DamageType) => parts.filter((p) => p.type === t).reduce((n, p) => n + p.total, 0);
  return (
    <svg className="ddial" viewBox="-40 -40 700 700" aria-hidden="true" style={{ ["--land" as string]: `${delay}ms` }}>
      {DAMAGE_TYPES.map((t, i) => {
        const on = lit.indexOf(t);
        if (on < 0) return null;
        const [ix, iy] = at(R_ICON, i * STEP);
        const [tx, ty] = at(R_TOTAL, i * STEP);
        return (
          <g key={t} className={`seg t-${t} on`} style={{ ["--d" as string]: `calc(var(--land) + ${on * DIAL_STAGGER}ms)` }}>
            <g transform={`translate(${ix.toFixed(1)} ${iy.toFixed(1)}) scale(${ICON_SCALE})`}>
              <g className="icon">
                <g className="inner">
                  <g className="idle" dangerouslySetInnerHTML={{ __html: DAMAGE_ICON[t] }} />
                </g>
              </g>
            </g>
            {<text x={tx.toFixed(1)} y={(ty + 13).toFixed(1)} textAnchor="middle" className="wtot">{totalOf(t)}</text>}
          </g>
        );
      })}
    </svg>
  );
}
