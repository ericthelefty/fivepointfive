import { describe, expect, it } from "vitest";
import { mergeCharacter } from "./merge.ts";
import { newCharacter, type Character } from "./rules.ts";
import type { LogEntry } from "./play.ts";

const entry = (id: string): LogEntry => ({ id, t: "1:00 PM", title: id, total: "", detail: "", cls: "event" });
const ch = (play: Character["play"], extra: Partial<Character> = {}): Character => ({ ...newCharacter(), id: "c1", name: "Pip", play, ...extra });

describe("merging two edits of a character", () => {
  const base = ch({ hpCur: 30, hpTemp: 0, conditions: ["Prone"], log: [entry("a")] });

  it("keeps what only one side changed", () => {
    const local = ch({ ...base.play, hpCur: 30 }, { notes: "my notes" });
    const remote = ch({ ...base.play, hpCur: 22 });
    const m = mergeCharacter(base, local, remote);
    expect(m.notes).toBe("my notes");
    expect(m.play!.hpCur).toBe(22);
  });

  it("applies both sides' HP changes (the DM's damage and the player's healing)", () => {
    const local = ch({ ...base.play, hpCur: 35 }); // healed 5
    const remote = ch({ ...base.play, hpCur: 23 }); // 7 damage from the DM
    expect(mergeCharacter(base, local, remote).play!.hpCur).toBe(28);
    expect(mergeCharacter(base, ch({ ...base.play, hpCur: 2 }), ch({ ...base.play, hpCur: 1 })).play!.hpCur).toBe(0);
  });

  it("combines condition changes and keeps both sides' log entries", () => {
    const local = ch({ ...base.play, conditions: [], log: [entry("mine"), entry("a")] }); // stood up, rolled
    const remote = ch({ ...base.play, conditions: ["Prone", "Poisoned"], log: [entry("dm"), entry("a")] }); // DM poisoned them
    const m = mergeCharacter(base, local, remote);
    expect(m.play!.conditions).toEqual(["Poisoned"]);
    expect(m.play!.log!.map((x) => x.id)).toEqual(["dm", "mine", "a"]);
  });

  it("damage to a character at full HP (unset) isn't lost", () => {
    const full = ch({ conditions: [], log: [] });
    const m = mergeCharacter(full, ch({ conditions: ["Blinded"], log: [] }), ch({ hpCur: 20, conditions: [], log: [] }));
    expect(m.play!.hpCur).toBe(20);
    expect(m.play!.conditions).toEqual(["Blinded"]);
  });

  it("other conflicts go to this browser's change", () => {
    const local = ch({ ...base.play, deathS: 2 });
    const remote = ch({ ...base.play, deathS: 1 });
    expect(mergeCharacter(base, local, remote).play!.deathS).toBe(2);
  });
});
