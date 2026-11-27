import { describe, expect, it } from "vitest";
import { allCells, brushCells, cellAt, cellRect, clampCell, DEFAULT_GRID, feetBetween, gridAcross, gridBounds, gridFromBox, normGrid, paintFog, rectCells, sizeSquares, syncTokens, tokenLabel, tokenSeen, type MapGrid, type MapToken } from "./maps.ts";
import type { Combatant } from "./encounter.ts";

const g = (p: Partial<MapGrid> = {}): MapGrid => ({ ...DEFAULT_GRID, size: 50, ox: 0, oy: 0, ...p });

describe("grid", () => {
  it("finds the square under a point, with the grid offset", () => {
    expect(cellAt(g(), 0, 0)).toEqual({ x: 0, y: 0 });
    expect(cellAt(g(), 99.9, 50)).toEqual({ x: 1, y: 1 });
    // lines start 20 px in: the strip left of them is square -1
    expect(cellAt(g({ ox: 20 }), 10, 0)).toEqual({ x: -1, y: 0 });
    expect(cellRect(g({ ox: 20, oy: 5 }), 2, 1, 2)).toEqual({ left: 120, top: 55, size: 100 });
  });
  it("covers the image, partial squares included", () => {
    expect(gridBounds(g(), 500, 300)).toEqual({ x0: 0, y0: 0, x1: 9, y1: 5 });
    expect(gridBounds(g({ ox: 20 }), 500, 300)).toEqual({ x0: -1, y0: 0, x1: 9, y1: 5 });
  });
  it("keeps the offset inside one square", () => {
    expect(normGrid(g({ ox: 130, oy: -10 }))).toMatchObject({ ox: 30, oy: 40 });
  });
  it("fits a box drawn round one printed square", () => {
    const fit = gridFromBox(g(), 172, 43, 242, 112);
    expect(fit.size).toBe(70);
    expect(fit.ox).toBe(172 % 70);
    expect(fit.oy).toBe(43);
    // a tiny box (a click) changes nothing
    expect(gridFromBox(g(), 10, 10, 12, 12)).toEqual(g());
  });
  it("fits a number of squares across", () => {
    expect(gridAcross(g({ ox: 13 }), 1400, 20)).toMatchObject({ size: 70, ox: 0 });
  });
  it("keeps big tokens on the map", () => {
    expect(clampCell(g(), 500, 300, 9, 5, 2)).toEqual({ x: 8, y: 4 });
    expect(clampCell(g(), 500, 300, -3, 2, 1)).toEqual({ x: 0, y: 2 });
  });
  it("sizes and distances", () => {
    expect([sizeSquares("Tiny"), sizeSquares("Medium"), sizeSquares("Large"), sizeSquares("Huge"), sizeSquares("Gargantuan"), sizeSquares()]).toEqual([1, 1, 2, 3, 4, 1]);
    // every square is 5 feet, diagonals too
    expect(feetBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(20);
    expect(feetBetween({ x: 0, y: 0 }, { x: 3, y: 4 }, 10)).toBe(40);
  });
});

describe("fog", () => {
  it("brushes and boxes", () => {
    expect(brushCells(0, 0, 0)).toEqual(["0,0"]);
    expect(brushCells(5, 5, 1).sort()).toEqual(["4,4", "4,5", "4,6", "5,4", "5,5", "5,6", "6,4", "6,5", "6,6"]);
    expect(brushCells(0, 0, 2)).toHaveLength(21); // round: no corners
    expect(rectCells({ x: 2, y: 1 }, { x: 0, y: 2 })).toHaveLength(6);
    expect(allCells(g(), 100, 100).sort()).toEqual(["0,0", "0,1", "1,0", "1,1"]);
  });
  it("uncovers and covers, and leaves an unchanged fog as it was", () => {
    const f = { on: true, cells: ["0,0"] };
    const more = paintFog(f, ["0,0", "1,0"], true);
    expect(more.cells.sort()).toEqual(["0,0", "1,0"]);
    expect(paintFog(more, ["0,0"], false).cells).toEqual(["1,0"]);
    expect(paintFog(f, ["0,0"], true)).toBe(f);
  });
  it("hides monsters under the fog and hidden tokens from players, never characters", () => {
    const fog = { on: true, cells: ["3,3"] };
    const t = (p: Partial<MapToken>): MapToken => ({ uid: "a", name: "Goblin", kind: "monster", size: 1, x: 0, y: 0, ...p });
    expect(tokenSeen(t({}), fog)).toBe(false);
    expect(tokenSeen(t({ x: 3, y: 3 }), fog)).toBe(true);
    // a Large monster with one square uncovered shows
    expect(tokenSeen(t({ x: 2, y: 2, size: 2 }), fog)).toBe(true);
    expect(tokenSeen(t({ kind: "pc" }), fog)).toBe(true);
    expect(tokenSeen(t({}), { on: false, cells: [] })).toBe(true);
    expect(tokenSeen(t({ hidden: true, x: 3, y: 3 }), fog)).toBe(false);
  });
});

describe("tokens", () => {
  const cbs: Combatant[] = [
    { uid: "p1", kind: "pc", ref: "char1", name: "" },
    { uid: "m1", kind: "monster", ref: "ogre", name: "Ogre 1", hp: 0 },
    { uid: "m2", kind: "monster", ref: "goblin", name: "Goblin 1", surrendered: true },
  ];
  const info = (c: Combatant) => ({ name: c.kind === "pc" ? "Sera" : c.name, size: c.ref === "ogre" ? 2 : 1, out: c.kind === "monster" && c.hp != null && c.hp <= 0 });
  it("gives everyone in the fight a token, keeping where it stood and the GM's choices", () => {
    const prev: MapToken[] = [
      { uid: "p1", name: "old", kind: "pc", size: 1, x: 4, y: 2 },
      { uid: "m2", name: "Goblin 1", kind: "monster", size: 3, sized: true, hidden: true, x: 1, y: 1 },
      { uid: "gone", name: "Wolf", kind: "monster", size: 1, x: 0, y: 0 },
    ];
    const out = syncTokens(prev, cbs, info);
    expect(out.map((t) => t.uid)).toEqual(["p1", "m1", "m2"]);
    expect(out[0]).toEqual({ uid: "p1", name: "Sera", kind: "pc", size: 1, char: "char1", x: 4, y: 2 });
    expect(out[1]).toMatchObject({ size: 2, out: true });
    expect(out[1].x).toBeUndefined();
    expect(out[2]).toMatchObject({ size: 3, sized: true, hidden: true, out: true, x: 1, y: 1 });
  });
  it("labels tokens briefly", () => {
    expect(tokenLabel("Goblin Warrior 2")).toBe("GW2");
    expect(tokenLabel("Sera")).toBe("SE");
    expect(tokenLabel("Ogre 3")).toBe("O3");
    expect(tokenLabel("Ancient Red Dragon")).toBe("ARD");
  });
});
