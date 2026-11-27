import { describe, expect, it } from "vitest";
import { detectGridGrey } from "./gridDetect.ts";

/** A made-up random number source, so the tests always draw the same "map". */
function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
}

/** A greyscale map: blotchy ground (big soft patches and pixel noise) with grid lines drawn on it. */
function map(w: number, h: number, o: { size?: number; sizeY?: number; ox?: number; oy?: number; line?: number; noise?: number; grid?: boolean; seed?: number } = {}) {
  const r = rng(o.seed ?? 7);
  const g = new Float32Array(w * h);
  const blobs = Array.from({ length: 14 }, () => ({ x: r() * w, y: r() * h, rad: 40 + r() * 160, v: (r() - 0.5) * 80 }));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = 120;
    for (const b of blobs) { const d = Math.hypot(x - b.x, y - b.y); if (d < b.rad) v += b.v * (1 - d / b.rad); }
    g[y * w + x] = v + (r() - 0.5) * (o.noise ?? 20);
  }
  if (o.grid !== false) {
    const sx = o.size ?? 50, sy = o.sizeY ?? sx, dark = o.line ?? 60;
    for (let gx = o.ox ?? 0; gx < w; gx += sx) { const c = Math.round(gx); for (let y = 0; y < h; y++) if (c < w) g[y * w + c] -= dark; }
    for (let gy = o.oy ?? 0; gy < h; gy += sy) { const c = Math.round(gy); for (let x = 0; x < w; x++) if (c < h) g[c * w + x] -= dark; }
  }
  return g;
}

describe("finding a printed grid", () => {
  it("finds a clean grid's size and where it starts", () => {
    const f = detectGridGrey(map(700, 500, { size: 50, ox: 20, oy: 15 }), 700, 500)!;
    expect(f).not.toBeNull();
    expect(f.size).toBeCloseTo(50, 0);
    expect(f.sizeY).toBeCloseTo(50, 0);
    expect(Math.abs(f.ox - 20)).toBeLessThan(1.5);
    expect(Math.abs(f.oy - 15)).toBeLessThan(1.5);
  });
  it("finds a spacing that isn't a whole number of pixels", () => {
    const f = detectGridGrey(map(900, 600, { size: 47.6, ox: 9 }), 900, 600)!;
    expect(Math.abs(f.size - 47.6)).toBeLessThan(0.3);
  });
  it("picks the true square, not every other line", () => {
    const f = detectGridGrey(map(800, 560, { size: 40, ox: 5, oy: 5 }), 800, 560)!;
    expect(f.size).toBeCloseTo(40, 0);
  });
  it("finds a slightly stretched grid", () => {
    const f = detectGridGrey(map(800, 600, { size: 52, sizeY: 48, ox: 3, oy: 30 }), 800, 600)!;
    expect(f.size).toBeCloseTo(52, 0);
    expect(f.sizeY).toBeCloseTo(48, 0);
  });
  it("finds faint lines over busy ground", () => {
    const f = detectGridGrey(map(700, 500, { size: 35, ox: 12, oy: 2, line: 22, noise: 40, seed: 3 }), 700, 500)!;
    expect(f).not.toBeNull();
    expect(f.size).toBeCloseTo(35, 0);
  });
  it("isn't fooled by strong walls on some of the lines", () => {
    const w = 700, h = 1400;
    const g = map(w, h, { size: 59, ox: 1, oy: 1, line: 18, noise: 30, seed: 5 });
    // thick dark walls along every third line, as on a dungeon map
    for (let gx = 1; gx < w; gx += 59 * 3) for (let y = 0; y < h; y++) for (let d = -2; d <= 2; d++) { const c = Math.round(gx) + d; if (c >= 0 && c < w) g[y * w + c] -= 90; }
    for (let gy = 1; gy < h; gy += 59 * 6) for (let x = 0; x < w; x++) for (let d = -2; d <= 2; d++) { const c = Math.round(gy) + d; if (c >= 0 && c < h) g[c * w + x] -= 90; }
    const f = detectGridGrey(g, w, h)!;
    expect(f).not.toBeNull();
    expect(f.size).toBeCloseTo(59, 0);
    expect(f.sizeY).toBeCloseTo(59, 0);
  });
  it("gives up on a flat image whose only pattern is faint compression blocks", () => {
    const w = 640, h = 480, g = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = 120 + ((x >> 4) + (y >> 4)) % 2 * 1.5;
    expect(detectGridGrey(g, w, h)).toBeNull();
  });
  it("gives up on a map with no grid", () => {
    expect(detectGridGrey(map(700, 500, { grid: false, noise: 40 }), 700, 500)).toBeNull();
    expect(detectGridGrey(map(600, 400, { grid: false, noise: 5, seed: 11 }), 600, 400)).toBeNull();
  });
});
