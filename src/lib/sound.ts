/**
 * Dice sounds, made with Web Audio (no audio files): a few short, filtered clicks like dice landing on a table.
 * Off unless the player turns it on; the choice is kept in this browser.
 */
const KEY = "fpf.sound";
let ctx: AudioContext | null = null;

export function soundOn(): boolean {
  try { return localStorage.getItem(KEY) === "on"; } catch { return false; }
}
export function setSound(on: boolean) {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* private mode */ }
}

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
    || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

/** One die hitting the table at `t` seconds from now. */
function clack(ac: AudioContext, t: number, gain: number) {
  const len = Math.floor(ac.sampleRate * 0.05);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const bp = ac.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1800 + Math.random() * 1600;
  bp.Q.value = 3;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(bp).connect(g).connect(ac.destination);
  src.start(ac.currentTime + t);
}

/** The sound of `dice` dice (capped) rolling and settling. */
export function playDice(dice = 1) {
  if (!soundOn()) return;
  const ac = audio();
  if (!ac) return;
  if (ac.state === "suspended") ac.resume().catch(() => undefined);
  const n = Math.max(1, Math.min(6, dice));
  for (let k = 0; k < n; k++) {
    // each die bounces two or three times, quieter each time
    let t = k * 0.035 + Math.random() * 0.03;
    for (let b = 0, g = 0.5; b < 3; b++, g *= 0.45) {
      clack(ac, t, g);
      t += 0.06 + Math.random() * 0.05;
    }
  }
}

const DICE_KEY = "fpf.dice3d";
/** Dice tumbling onto the sheet after each roll: on unless turned off. */
export function dice3dOn(): boolean {
  try { return localStorage.getItem(DICE_KEY) !== "off"; } catch { return true; }
}
export function setDice3d(on: boolean) {
  try { localStorage.setItem(DICE_KEY, on ? "on" : "off"); } catch { /* private mode */ }
}
