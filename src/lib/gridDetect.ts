/**
 * Finding the grid printed on a battle map. Grid lines are thin, straight and evenly spaced, so if you add up how sharply
 * the brightness changes down each column of pixels, the columns with vertical grid lines stand out as regular spikes
 * (and likewise along each row for the horizontal lines). The spacing of the spikes is the square's size, and where
 * they fall is where the grid starts.
 *
 * Works on clean grids (most VTT, Dungeondraft and Inkarnate exports); gives up (null) when there's no clear grid.
 */

export interface FoundAxis {
  /** Pixels between lines. */
  period: number;
  /** Where the first line falls (0 ≤ phase < period). */
  phase: number;
  /** How clearly the lines stand out from the rest (above about 2.5 is a real grid). */
  strength: number;
}

export interface FoundGrid {
  size: number;
  sizeY: number;
  ox: number;
  oy: number;
  strength: number;
}

/** Remove slow changes across the map (light and dark areas), keeping the sharp spikes of lines. */
function highPass(p: Float64Array, win: number): Float64Array {
  const n = p.length, out = new Float64Array(n), pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + p[i];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - win), b = Math.min(n, i + win + 1);
    out[i] = Math.max(0, p[i] - (pre[b] - pre[a]) / (b - a));
  }
  return out;
}

/** The value at a fractional position (linear). */
const at = (p: Float64Array, x: number) => {
  const i = Math.floor(x), f = x - i;
  return i + 1 < p.length ? p[i] * (1 - f) + p[i + 1] * f : p[i] ?? 0;
};

/** The best place for lines `period` apart: the phase where they land on the most edge, and how much. */
function fold(p: Float64Array, period: number): { phase: number; value: number } {
  let best = { phase: 0, value: -1 };
  const steps = Math.max(1, Math.ceil(period * 2));
  for (let s = 0; s < steps; s++) {
    const phase = (s * period) / steps;
    let sum = 0, k = 0;
    // a line counts its strongest pixel within half a pixel either side
    for (let x = phase; x < p.length - 1; x += period, k++) sum += Math.max(at(p, x), at(p, Math.max(0, x - 0.5)), at(p, x + 0.5));
    const v = k >= 3 ? sum / k : 0;
    if (v > best.value) best = { phase, value: v };
  }
  return best;
}

/**
 * The line spacing along one direction of a map, from how much edge each pixel column (or row) has. The spacing is
 * found by comparing the pattern with itself shifted along (a grid repeats every square, so it matches itself best a
 * square along), which isn't thrown by a few strong walls that happen to sit on grid lines.
 */
export function findAxis(profile: Float64Array, minPeriod = 10, maxPeriod?: number): FoundAxis | null {
  const n = profile.length;
  const max = Math.floor(Math.min(maxPeriod ?? n / 3, n / 3));
  if (n < minPeriod * 4 || max <= minPeriod) return null;
  const p = highPass(profile, 6);
  // cap the strongest spikes (a few heavy walls) so they count no more than ordinary grid lines, then blur a pixel
  // either way, so lines rounded to the nearest pixel still line up with themselves
  const cap = [...p].sort((a, b) => a - b)[Math.floor(n * 0.97)] || 0;
  const c0 = p.map((v) => Math.min(v, cap));
  const q = new Float64Array(n);
  for (let i = 0; i < n; i++) q[i] = (c0[Math.max(0, i - 1)] + 2 * c0[i] + c0[Math.min(n - 1, i + 1)]) / 4;
  let mean = 0;
  for (const v of q) mean += v;
  mean /= n;
  if (mean <= 0) return null;
  const ac = new Float64Array(max + 2);
  for (let lag = minPeriod - 1; lag <= max + 1; lag++) {
    let sum = 0;
    for (let i = 0; i + lag < n; i++) sum += q[i] * q[i + lag];
    ac[lag] = sum / (n - lag) / (mean * mean);
  }
  let best = minPeriod;
  for (let lag = minPeriod; lag <= max; lag++) if (ac[lag] > ac[best]) best = lag;
  // two (or three, or more) squares along matches as well as one, so take the smallest spacing that does nearly as well
  let pick = best;
  for (const div of [8, 7, 6, 5, 4, 3, 2]) {
    const c = Math.round(best / div);
    if (c - 1 < minPeriod) continue;
    const m = [c - 1, c, c + 1].reduce((a, l) => (ac[l] > ac[a] ? l : a), c);
    if (ac[m] >= ac[best] * 0.72) { pick = m; break; }
  }
  const strength = ac[pick];
  if (strength < 2.2) return null;
  // to a fraction of a pixel: the spacing that lands the lines on the most edge across the whole map
  let f = { period: pick, ...fold(p, pick) };
  for (let d = -1; d <= 1.0001; d += 0.05) {
    const period = pick + d;
    if (period < minPeriod) continue;
    const g = fold(p, period);
    if (g.value > f.value) f = { period, ...g };
  }
  // and the lines must actually be visible: a flat image's faint compression blocks repeat too, but barely change
  const sorted = [...profile].sort((a, b) => a - b), median = sorted[Math.floor(n / 2)];
  let lift = 0, k = 0;
  for (let x = f.phase; x < n - 1; x += f.period, k++) { const i = Math.round(x); lift += Math.max(profile[i - 1] ?? 0, profile[i], profile[i + 1] ?? 0) - median; }
  if (!k || lift / k < MIN_LINE) return null;
  return { period: f.period, phase: f.phase % f.period, strength };
}

/** How much a grid line must stand out from a typical column of pixels, in grey levels (of 255) of sharpness. */
const MIN_LINE = 5;

/** Edge profiles of a greyscale image: for each column, how sharply it differs from its neighbours, on average down
 * the column; and the same for each row. A thin line (light or dark) stands out from both sides. */
export function edgeProfiles(grey: Float32Array | Uint8ClampedArray, w: number, h: number) {
  const cols = new Float64Array(w), rows = new Float64Array(h);
  for (let y = 1; y < h - 1; y++) {
    const r = y * w;
    for (let x = 1; x < w - 1; x++) {
      const v = grey[r + x];
      cols[x] += Math.abs(2 * v - grey[r + x - 1] - grey[r + x + 1]);
      rows[y] += Math.abs(2 * v - grey[r - w + x] - grey[r + w + x]);
    }
  }
  for (let x = 0; x < w; x++) cols[x] /= Math.max(1, h - 2);
  for (let y = 0; y < h; y++) rows[y] /= Math.max(1, w - 2);
  return { cols, rows };
}

/** The grid in a greyscale image, or null if there isn't a clear one. */
export function detectGridGrey(grey: Float32Array | Uint8ClampedArray, w: number, h: number): FoundGrid | null {
  const { cols, rows } = edgeProfiles(grey, w, h);
  let x = findAxis(cols), y = findAxis(rows);
  if (!x && !y) return null;
  // one direction found: the squares are probably square, so look for lines that far apart the other way
  if (!x && y) { const f = fold(highPass(cols, 6), y.period); x = { period: y.period, phase: f.phase, strength: y.strength }; }
  if (!y && x) { const f = fold(highPass(rows, 6), x.period); y = { period: x.period, phase: f.phase, strength: x.strength }; }
  // one direction found a whole number of squares at once (lines hidden by walls): squares are nearly square, so use
  // the smaller spacing both ways
  const big = Math.max(x!.period, y!.period), small = Math.min(x!.period, y!.period), k = Math.round(big / small);
  if (k >= 2 && Math.abs(big / small - k) < 0.08) {
    if (x!.period > y!.period) { const f = fold(highPass(cols, 6), small); x = { period: small, phase: f.phase, strength: x!.strength }; }
    else { const f = fold(highPass(rows, 6), small); y = { period: small, phase: f.phase, strength: y!.strength }; }
  }
  // squares far from square are more likely a mistake than a stretched map
  if (Math.abs(x!.period - y!.period) / Math.max(x!.period, y!.period) > 0.2) return null;
  // nearly square is square (a hair's difference is measuring, not a stretched map)
  let sx = x!.period, sy = y!.period;
  if (Math.abs(sx - sy) / Math.max(sx, sy) < 0.015) sx = sy = (sx + sy) / 2;
  return { size: sx, sizeY: sy, ox: x!.phase, oy: y!.phase, strength: Math.min(x!.strength, y!.strength) };
}

/** The grid printed on a map image (by its URL), in the image's own pixels; null if there isn't a clear one. */
export async function detectGrid(url: string, width: number, height: number): Promise<FoundGrid | null> {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob);
  // work on a copy at most 1600 pixels across: plenty for lines, and quick
  const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const px = ctx.getImageData(0, 0, w, h).data;
  const grey = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) grey[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  const g = detectGridGrey(grey, w, h);
  if (!g) return null;
  // back to the stored image's pixels
  const sx = width / w, sy = height / h;
  return { size: g.size * sx, sizeY: g.sizeY * sy, ox: g.ox * sx, oy: g.oy * sy, strength: g.strength };
}
