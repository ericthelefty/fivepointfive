import type { Entry } from "./parse.ts";

/** What updating a pack changes, by entry ID: names added, changed and removed, and how many stay the same. */
export function packChanges(before: Entry[], after: Entry[]): { added: string[]; changed: string[]; removed: string[]; same: number } {
  const key = (e: Entry) => JSON.stringify([e.type, e.name, e.tagline || "", e.fields, e.body, (e.effects || []).map((f) => [f.feature, f.yaml])]);
  const old = new Map(before.map((e) => [e.id, e]));
  const now = new Map(after.map((e) => [e.id, e]));
  const added: string[] = [], changed: string[] = [], removed: string[] = [];
  let same = 0;
  for (const [id, e] of now) {
    const o = old.get(id);
    if (!o) added.push(e.name);
    else if (key(o) !== key(e)) changed.push(e.name);
    else same++;
  }
  for (const [id, e] of old) if (!now.has(id)) removed.push(e.name);
  const sort = (l: string[]) => l.sort((a, b) => a.localeCompare(b));
  return { added: sort(added), changed: sort(changed), removed: sort(removed), same };
}
