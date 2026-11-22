/**
 * Thief, Use Magic Device (Scrolls): any Spell Scroll can be read, with the given ability as the spellcasting
 * ability; from `from-level` up, a check (DC 10 + spell level) comes first and a failure destroys the scroll.
 *
 * params: { ability: int, check: { skill: arcana, from-level: 2 } }
 */
import type { CustomHandler } from "./index.ts";

const ABIL: Record<string, string> = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
const titled = (s: string) => s.replace(/-/g, " ").replace(/\b\w/g, (x) => x.toUpperCase());

const handler: CustomHandler = {
  replaceWith: "A way for a feature to change another item's action: waive `requires: spell-on-list`, set the casting ability, and replace its `check` (Modif `modify` on items).",
  apply({ params, r, source }) {
    const ability = ABIL[String(params?.ability || "")];
    if (!ability) return false;
    const ck = params?.check;
    r.scrollRule = {
      ability,
      check: ck ? { ability, skill: ck.skill ? titled(String(ck.skill)) : undefined, fromLevel: typeof ck["from-level"] === "number" ? ck["from-level"] : 0 } : undefined,
      source,
    };
    return true;
  },
};
export default handler;
