/**
 * Merging two edits of the same character: the version both started from (`base`), this browser's (`local`) and the
 * one saved elsewhere (`remote`), for example a player's sheet and the GM's encounter tracker changing the same
 * character at once. Whatever only one side changed is kept; when both changed the same thing:
 * - HP and Temporary HP: both changes apply (the GM's 7 damage and the player's 5 healing both count);
 * - conditions: additions and removals from both sides apply;
 * - the game log: entries from both sides are kept;
 * - anything else: this browser's change wins.
 */
import type { Character } from "./rules.ts";
import type { LogEntry, PlayState } from "./play.ts";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Two changes to a number: both deltas apply, never below 0. Unset HP means "full", which has no number to add to. */
function both(b: number | undefined, l: number | undefined, r: number | undefined): number | undefined {
  if (same(l, b)) return r;
  if (same(r, b)) return l;
  if (typeof b !== "number" || typeof l !== "number" || typeof r !== "number") {
    // one side started from full HP: take the lower, so damage isn't lost
    if (typeof l === "number" && typeof r === "number") return Math.min(l, r);
    return typeof l === "number" ? l : r;
  }
  return Math.max(0, b + (l - b) + (r - b));
}

function mergeSet(b: string[] = [], l: string[] = [], r: string[] = []): string[] {
  const removed = new Set([...b.filter((x) => !l.includes(x)), ...b.filter((x) => !r.includes(x))]);
  return [...new Set([...l, ...r])].filter((x) => !removed.has(x));
}

function mergeLog(b: LogEntry[] = [], l: LogEntry[] = [], r: LogEntry[] = []): LogEntry[] {
  const have = new Set(l.map((x) => x.id));
  const known = new Set(b.map((x) => x.id));
  // entries that arrived from elsewhere go on top (both are newer than anything in base)
  const theirs = r.filter((x) => !have.has(x.id) && !known.has(x.id));
  return [...theirs, ...l].slice(0, 150);
}

function mergePlay(b: Partial<PlayState> = {}, l: Partial<PlayState> = {}, r: Partial<PlayState> = {}): Partial<PlayState> {
  const out: Record<string, unknown> = {};
  for (const k of new Set([...Object.keys(b), ...Object.keys(l), ...Object.keys(r)]) as Set<keyof PlayState>) {
    const bv = b[k], lv = l[k], rv = r[k];
    if (k === "log") out.log = mergeLog(b.log, l.log, r.log);
    else if (k === "conditions") out.conditions = mergeSet(b.conditions, l.conditions, r.conditions);
    else if (k === "hpCur" || k === "hpTemp") out[k] = both(bv as number | undefined, lv as number | undefined, rv as number | undefined);
    else out[k] = same(lv, bv) ? rv : lv;
  }
  return out as Partial<PlayState>;
}

export function mergeCharacter(base: Character | undefined, local: Character, remote: Character): Character {
  // without the starting version there's nothing to compare against: keep the log and conditions from both, local wins the rest
  const b = base ?? ({ ...local, play: { ...(local.play || {}), log: [], conditions: [] } } as Character);
  const out: Record<string, unknown> = {};
  for (const k of new Set([...Object.keys(b), ...Object.keys(local), ...Object.keys(remote)]) as Set<keyof Character>) {
    if (k === "play") out.play = mergePlay(b.play, local.play, remote.play);
    else if (k === "updated") out.updated = Math.max(local.updated || 0, remote.updated || 0);
    else out[k] = same(local[k], b[k]) ? remote[k] : local[k];
  }
  return out as unknown as Character;
}
