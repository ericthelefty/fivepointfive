import { describe, expect, it } from "vitest";
import { applyOps, diff } from "./patch.ts";

describe("live update patches", () => {
  const a = { name: "Erich", level: 6, play: { hpCur: 48, conditions: ["Poisoned"], slotsUsed: { 1: 1 } }, inventory: [{ id: "x", qty: 1 }] };

  it("sends only what changed", () => {
    const b = { ...a, play: { ...a.play, hpCur: 31 } };
    expect(diff(a, b)).toEqual([{ p: ["play", "hpCur"], v: 31 }]);
    expect(JSON.stringify(diff(a, b)).length).toBeLessThan(40);
  });

  it("round-trips additions, removals and replaced arrays", () => {
    const b = { name: "Erich", level: 7, play: { hpCur: 48, conditions: [], slotsUsed: { 1: 2, 2: 1 }, hpTemp: 5 }, inventory: [{ id: "x", qty: 2 }, { id: "y", qty: 1 }] };
    const ops = diff(a, b);
    expect(applyOps(a, ops)).toEqual(b);
    // the original copy is untouched
    expect(a.play.hpCur).toBe(48);
    expect(a.inventory).toHaveLength(1);
  });

  it("removes keys that are gone", () => {
    const b = { name: "Erich", level: 6, play: { hpCur: 48, conditions: ["Poisoned"] }, inventory: a.inventory };
    const ops = diff(a, b);
    expect(ops).toEqual([{ p: ["play", "slotsUsed"], d: true }]);
    expect(applyOps(a, ops)).toEqual(b);
  });

  it("has nothing to send when nothing changed", () => {
    expect(diff(a, structuredClone(a))).toEqual([]);
  });
});
