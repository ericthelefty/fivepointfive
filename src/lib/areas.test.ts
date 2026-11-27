import { describe, expect, it } from "vitest";
import { aimPoint, areaName, areaOutline, areaSquares, areaTokens, inArea, snapHalf, wallEnds, type Area, type AreaCtx } from "./areas.ts";
import type { MapToken } from "./maps.ts";

const ctx = (tokens: MapToken[] = []): AreaCtx => ({ feet: 5, tokens });
const A = (p: Partial<Area>): Area => ({ id: "a", kind: "sphere", x: 0, y: 0, size: 20, color: "#f00", ...p });
const set = (l: string[]) => new Set(l);

describe("areas of effect", () => {
  it("a Sphere catches the squares whose centres are within its radius, centre included", () => {
    // a 20-foot radius from a grid corner: 4 squares out, about 12.6 squares' worth either way
    const s = areaSquares(A({ x: 10, y: 10 }), ctx());
    expect(s).toContain("9,9"); // next to the point of origin
    expect(s).toContain("13,9"); // centre 3.5 squares away
    expect(s).not.toContain("14,9"); // centre 4.5 squares away
    expect(s).not.toContain("13,13"); // a corner: about 4.95 squares away
    expect(s.length).toBe(52);
  });
  it("a Cylinder is a circle from above, like a Sphere", () => {
    expect(areaSquares(A({ kind: "cylinder", x: 5, y: 5, size: 10 }), ctx()).sort()).toEqual(areaSquares(A({ x: 5, y: 5, size: 10 }), ctx()).sort());
  });
  it("a Cone is as wide as it is far from its point of origin, which isn't in it", () => {
    const cone = A({ kind: "cone", x: 0, y: 5, size: 15, angle: 0 }); // 3 squares long, pointing right
    expect(inArea(cone, { x: 0, y: 5 }, ctx())).toBe(false);
    expect(inArea(cone, { x: 3, y: 5 + 1.5 }, ctx())).toBe(true); // 15 feet out, 7.5 feet to the side
    expect(inArea(cone, { x: 3, y: 5 + 1.6 }, ctx())).toBe(false);
    expect(inArea(cone, { x: 3.1, y: 5 }, ctx())).toBe(false); // past its length
    // the usual 15-foot cone from a square's edge catches 1, 3 and then 3 squares
    expect(set(areaSquares(cone, ctx()))).toEqual(set(["0,4", "1,4", "2,4", "0,5", "1,5", "2,5", "1,3", "2,3", "1,6", "2,6"].filter((k) => inArea(cone, { x: +k.split(",")[0] + 0.5, y: +k.split(",")[1] + 0.5 }, ctx()))));
  });
  it("a Line has a length and a width", () => {
    const line = A({ kind: "line", x: 0, y: 0.5, size: 100, width: 5, angle: 0 }); // Lightning Bolt along a row
    const s = areaSquares(line, ctx());
    expect(s).toHaveLength(20);
    expect(s.every((k) => k.endsWith(",0"))).toBe(true);
  });
  it("a Cube's point of origin is on one side, and it can point any way", () => {
    const cube = A({ kind: "cube", x: 2, y: 1.5, size: 15, angle: 0 }); // Thunderwave from the middle of its left side
    expect(areaSquares(cube, ctx()).sort()).toEqual(["2,0", "2,1", "2,2", "3,0", "3,1", "3,2", "4,0", "4,1", "4,2"]);
    const down = A({ kind: "cube", x: 1.5, y: 2, size: 15, angle: Math.PI / 2 });
    expect(areaSquares(down, ctx()).sort()).toEqual(["0,2", "0,3", "0,4", "1,2", "1,3", "1,4", "2,2", "2,3", "2,4"]);
  });
  it("an Emanation reaches out from its creature's edges, moves with it and leaves it out", () => {
    const ogre: MapToken = { uid: "o", name: "Ogre", kind: "monster", size: 2, x: 5, y: 5 };
    const pc: MapToken = { uid: "p", name: "Sera", kind: "pc", size: 1, x: 8, y: 5 };
    const far: MapToken = { uid: "f", name: "Far", kind: "pc", size: 1, x: 9, y: 5 };
    const e = A({ kind: "emanation", token: "o", size: 10, x: 0, y: 0 });
    const s = areaSquares(e, ctx([ogre, pc, far]));
    expect(s).not.toContain("5,5"); // the ogre's own space
    expect(s).toContain("8,5"); // 10 feet from its edge
    expect(s).not.toContain("9,5");
    expect(areaTokens(e, s, ctx([ogre, pc, far])).map((t) => t.uid)).toEqual(["p"]);
    // it follows the token
    const moved = areaSquares(e, ctx([{ ...ogre, x: 0, y: 0 }]));
    expect(moved).toContain("3,0");
    expect(moved).not.toContain("8,5");
  });
  it("a thin Wall catches every square it passes through, and keeps to its length", () => {
    const wall = A({ kind: "wall", x: 0, y: 0.5, x2: 20, y2: 0.5, size: 60, width: 1 });
    expect(wallEnds(wall, ctx())[1]).toEqual({ x: 12, y: 0.5 }); // 60 feet is 12 squares
    expect(areaSquares(wall, ctx())).toHaveLength(12);
  });
  it("a Ring is a hollow circle", () => {
    const ring = A({ kind: "ring", x: 10, y: 10, size: 20, width: 1 }); // 20 feet across, so 2 squares out
    const s = areaSquares(ring, ctx());
    expect(s).not.toContain("9,9"); // the middle
    expect(s).toContain("11,9");
    expect(s).not.toContain("13,9");
  });
  it("outlines, aiming and names", () => {
    expect(areaOutline(A({ x: 1, y: 2 }), ctx())).toEqual({ kind: "circle", cx: 1, cy: 2, r: 4 });
    expect((areaOutline(A({ kind: "cone", size: 15, angle: 0 }), ctx()) as { pts: unknown[] }).pts).toHaveLength(3);
    expect(aimPoint(A({ kind: "line", size: 30, angle: 0 }), ctx())).toEqual({ x: 6, y: 0 });
    expect(aimPoint(A({}), ctx())).toBeNull();
    expect(areaName(A({ kind: "line", size: 100, width: 5 }))).toBe("100 × 5-foot Line");
    expect(areaName(A({}))).toBe("20-foot-radius Sphere");
    expect(snapHalf(3.3)).toBe(3.5);
  });
});
