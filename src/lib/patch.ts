/**
 * Small live updates: what changed between two versions of a character, as a list of edits another screen can
 * apply to its own copy. Plain objects are compared key by key; anything else (numbers, strings, arrays) is
 * replaced whole when it differs, so an edit is never ambiguous.
 */
export type Op = { p: string[]; v: unknown } | { p: string[]; d: true };

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** The edits that turn `a` into `b`. */
export function diff(a: unknown, b: unknown, path: string[] = []): Op[] {
  if (same(a, b)) return [];
  if (!isObj(a) || !isObj(b)) return [{ p: path, v: b }];
  const ops: Op[] = [];
  for (const k of Object.keys(a)) if (!(k in b) || b[k] === undefined) { if (a[k] !== undefined) ops.push({ p: [...path, k], d: true }); }
  for (const k of Object.keys(b)) if (b[k] !== undefined) ops.push(...diff(a[k], b[k], [...path, k]));
  return ops;
}

/** `obj` with the edits applied; the original is left alone. */
export function applyOps<T>(obj: T, ops: Op[]): T {
  let out: unknown = obj;
  for (const op of ops) out = put(out, op.p, "d" in op ? undefined : op.v, "d" in op);
  return out as T;
}

function put(o: unknown, p: string[], v: unknown, del: boolean): unknown {
  if (!p.length) return del ? undefined : v;
  const [k, ...rest] = p;
  const base = isObj(o) ? o : {};
  const next = { ...base };
  const child = put(base[k], rest, v, del);
  if (child === undefined && (del || !rest.length)) delete next[k];
  else next[k] = child;
  return next;
}
