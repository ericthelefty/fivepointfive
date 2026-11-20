/** Dice expressions like "2d6+1d4+3" and d20 tests with Advantage/Disadvantage. */

export interface Term {
  count: number;
  sides: number; // 0 for a flat modifier
  sign: 1 | -1;
  value?: number; // flat value
}

export interface Rolled {
  expr: string;
  total: number;
  parts: { label: string; rolls?: number[]; value: number }[];
}

export type Rng = () => number;
let rng: Rng = () => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 2 ** 32;
};
export function setRng(r: Rng) {
  rng = r;
}

export const die = (sides: number) => 1 + Math.floor(rng() * sides);

export function parseExpr(expr: string): Term[] | null {
  const s = expr.replace(/\s+/g, "").replace(/−/g, "-").toLowerCase();
  if (!s || !/^[+-]?(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/.test(s)) return null;
  const terms: Term[] = [];
  for (const m of s.matchAll(/([+-]?)(\d*)d(\d+)|([+-]?)(\d+)/g)) {
    if (m[3]) {
      const count = m[2] ? +m[2] : 1;
      const sides = +m[3];
      if (count < 1 || count > 100 || sides < 1 || sides > 1000) return null;
      terms.push({ count, sides, sign: m[1] === "-" ? -1 : 1 });
    } else if (m[5]) {
      terms.push({ count: 0, sides: 0, sign: m[4] === "-" ? -1 : 1, value: +m[5] });
    }
  }
  return terms;
}

/** Roll an expression. `doubleDice` doubles the number of dice (critical hits). */
export function roll(expr: string, opts: { doubleDice?: boolean } = {}): Rolled | null {
  const terms = parseExpr(expr);
  if (!terms) return null;
  const parts: Rolled["parts"] = [];
  let total = 0;
  for (const t of terms) {
    if (t.sides) {
      const n = t.count * (opts.doubleDice ? 2 : 1);
      const rolls = Array.from({ length: n }, () => die(t.sides));
      const v = t.sign * rolls.reduce((a, b) => a + b, 0);
      parts.push({ label: `${t.sign < 0 ? "−" : ""}${n}d${t.sides}`, rolls, value: v });
      total += v;
    } else {
      parts.push({ label: `${t.sign < 0 ? "−" : "+"}${t.value}`, value: t.sign * (t.value || 0) });
      total += t.sign * (t.value || 0);
    }
  }
  return { expr, total, parts };
}

export type Mode = "normal" | "adv" | "dis";

export interface D20 {
  rolls: number[];
  kept: number;
  mode: Mode;
  bonus: number;
  extra?: Rolled; // one-off bonus like 1d4
  total: number;
  crit: boolean;
  fumble: boolean;
}

/** A d20 test. Advantage and Disadvantage cancel out. */
export function d20(bonus: number, mode: Mode, extra?: string): D20 {
  const rolls = mode === "normal" ? [die(20)] : [die(20), die(20)];
  const kept = mode === "adv" ? Math.max(...rolls) : mode === "dis" ? Math.min(...rolls) : rolls[0];
  const ex = extra ? roll(extra) || undefined : undefined;
  return { rolls, kept, mode, bonus, extra: ex, total: kept + bonus + (ex?.total || 0), crit: kept === 20, fumble: kept === 1 };
}

export function combineModes(adv: boolean, dis: boolean): Mode {
  if (adv && !dis) return "adv";
  if (dis && !adv) return "dis";
  return "normal";
}

export function describeRolled(r: Rolled): string {
  return r.parts.map((p) => (p.rolls ? `${p.label} [${p.rolls.join(", ")}]` : p.label)).join(" ");
}
