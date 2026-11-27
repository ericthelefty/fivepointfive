/**
 * The damage dial: the 13 damage types, each with its own icon in a fixed place on a ring around the dice.
 * When a damage roll lands, the types in it light up in their colour and show their share of the total.
 */

/** Clockwise from the top: Fire beside Cold at the top, the physical types at the bottom. */
export const DAMAGE_TYPES = ["fire", "lightning", "thunder", "force", "radiant", "psychic", "slashing", "piercing", "bludgeoning", "necrotic", "poison", "acid", "cold"] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

/** Each type's colour on the dark theme, and a deeper one that reads on the light theme. */
export const DAMAGE_COLOR: Record<DamageType, string> = {
  "slashing": "#dfe3ea",
  "piercing": "#dfe3ea",
  "bludgeoning": "#c9ced6",
  "fire": "#ff7a1a",
  "cold": "#5cc8f2",
  "lightning": "#4f8dff",
  "thunder": "#9a78f5",
  "acid": "#c6e01e",
  "poison": "#a9c046",
  "necrotic": "#6fe3a8",
  "radiant": "#f5c85a",
  "force": "#ef6f74",
  "psychic": "#e472d6"
};
export const DAMAGE_COLOR_LIGHT: Record<DamageType, string> = {
  "slashing": "#4a5566",
  "piercing": "#4a5566",
  "bludgeoning": "#5a6270",
  "fire": "#e2620c",
  "cold": "#1f86c0",
  "lightning": "#1d4fd6",
  "thunder": "#5a3fc8",
  "acid": "#7a9a00",
  "poison": "#6a8a10",
  "necrotic": "#1f9a62",
  "radiant": "#c99300",
  "force": "#c83a44",
  "psychic": "#b02aa0"
};

/** Each type's icon, drawn in a 40 × 40 box centred on 0,0, in currentColor (static SVG markup, ours). */
export const DAMAGE_ICON: Record<DamageType, string> = {
  "fire": "<path d=\"M0 -17 C6 -9 13 -4 11 6 C10 13 5 17 0 17 C-5 17 -11 13 -11 6 C-11 0 -7 -4 -5 -9 C-3 -4 -1 -2 1 -1 C2 -6 1 -11 0 -17 Z\" fill=\"currentColor\"></path><path d=\"M0 4 C3 7 5 9 4 12 C3 15 -3 15 -4 12 C-5 9 -2 7 0 4 Z\" fill=\"#fff3d6\" opacity=\".85\"></path>",
  "lightning": "<path d=\"M3 -18 L-10 3 L-1 3 L-4 18 L10 -4 L1 -4 Z\" fill=\"currentColor\"></path>",
  "thunder": "<path d=\"M-6 -12 Q-14 0 -6 12\" stroke=\"currentColor\" stroke-width=\"2.6\" fill=\"none\" stroke-linecap=\"round\"></path><path d=\"M-13 -16 Q-24 0 -13 16\" stroke=\"currentColor\" stroke-width=\"2.2\" fill=\"none\" stroke-linecap=\"round\" opacity=\".7\"></path><path d=\"M6 -12 Q14 0 6 12\" stroke=\"currentColor\" stroke-width=\"2.6\" fill=\"none\" stroke-linecap=\"round\"></path><path d=\"M13 -16 Q24 0 13 16\" stroke=\"currentColor\" stroke-width=\"2.2\" fill=\"none\" stroke-linecap=\"round\" opacity=\".7\"></path><circle r=\"3\" fill=\"currentColor\"></circle>",
  "force": "<path d=\"M-2.6 12 Q0 0 0 -9 Q0 0 2.6 12 Z\" fill=\"currentColor\" transform=\"rotate(-36 0 12)\"></path><path d=\"M-2.6 12 Q0 0 0 -13 Q0 0 2.6 12 Z\" fill=\"currentColor\" transform=\"rotate(-18 0 12)\"></path><path d=\"M-2.6 12 Q0 0 0 -17 Q0 0 2.6 12 Z\" fill=\"currentColor\" transform=\"rotate(0 0 12)\"></path><path d=\"M-2.6 12 Q0 0 0 -13 Q0 0 2.6 12 Z\" fill=\"currentColor\" transform=\"rotate(18 0 12)\"></path><path d=\"M-2.6 12 Q0 0 0 -9 Q0 0 2.6 12 Z\" fill=\"currentColor\" transform=\"rotate(36 0 12)\"></path>",
  "radiant": "<path d=\"M0 -18 L4 -4 L18 0 L4 4 L0 18 L-4 4 L-18 0 L-4 -4 Z\" fill=\"currentColor\"></path><line x1=\"5.7\" y1=\"5.7\" x2=\"9.2\" y2=\"9.2\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"></line><line x1=\"-5.7\" y1=\"5.7\" x2=\"-9.2\" y2=\"9.2\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"></line><line x1=\"-5.7\" y1=\"-5.7\" x2=\"-9.2\" y2=\"-9.2\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"></line><line x1=\"5.7\" y1=\"-5.7\" x2=\"9.2\" y2=\"-9.2\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"></line>",
  "psychic": "<path d=\"M-17 0 Q0 -14 17 0 Q0 14 -17 0 Z\" stroke=\"currentColor\" stroke-width=\"2.4\" fill=\"none\"></path><circle r=\"5\" fill=\"currentColor\"></circle><circle cy=\"-15\" r=\"2\" fill=\"currentColor\"></circle><circle cy=\"15\" r=\"2\" fill=\"currentColor\"></circle>",
  "slashing": "<path d=\"M-14 12 Q3 3 12 -14\" stroke=\"currentColor\" stroke-width=\"2.8\" stroke-linecap=\"round\" fill=\"none\" class=\"slash\"></path><path d=\"M-8 16 Q7 7 16 -8\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" fill=\"none\" class=\"slash\" opacity=\".75\"></path>",
  "piercing": "<line x1=\"-17\" y1=\"0\" x2=\"8\" y2=\"0\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\"></line><path d=\"M17 0 L6 -6 L8 0 L6 6 Z\" fill=\"currentColor\"></path><path d=\"M-17 0 L-21 -4 M-17 0 L-21 4 M-13 0 L-17 -4 M-13 0 L-17 4\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\"></path>",
  "bludgeoning": "<rect x=\"-11\" y=\"-16\" width=\"22\" height=\"13\" rx=\"3\" fill=\"currentColor\"></rect><line x1=\"0\" y1=\"-3\" x2=\"0\" y2=\"17\" stroke=\"currentColor\" stroke-width=\"3.4\" stroke-linecap=\"round\"></line>",
  "necrotic": "<path d=\"M-10 5 C-13 1 -13 -6 -10 -10 C-9 -12 -8 -14 -8 -17 C-5 -14 -4 -12 -3.5 -10 C-2 -15 2 -18 5 -23 C5 -18 8 -15 10 -12 C13 -8 13 0 10 5 L7 9 L7 13 Q0 15.5 -7 13 L-7 9 Z\" fill=\"currentColor\"></path><ellipse cx=\"-4.6\" cy=\"-1\" rx=\"3.4\" ry=\"3.9\" fill=\"#0b1a12\"></ellipse><ellipse cx=\"4.6\" cy=\"-1\" rx=\"3.4\" ry=\"3.9\" fill=\"#0b1a12\"></ellipse><path d=\"M0 3.2 L-1.8 6.6 L1.8 6.6 Z\" fill=\"#0b1a12\"></path><path d=\"M-2.6 9.6 L-2.6 13.4 M0 9.8 L0 13.9 M2.6 9.6 L2.6 13.4\" stroke=\"#0b1a12\" stroke-width=\"1.2\" stroke-linecap=\"round\"></path>",
  "poison": "<path d=\"M0 -17 C4 -9 12 -3 12 5 A12 12 0 0 1 -12 5 C-12 -3 -4 -9 0 -17 Z\" fill=\"currentColor\"></path><g transform=\"translate(0 6) scale(1.15)\"><g fill=\"#14100c\" stroke=\"#14100c\" stroke-width=\"1.1\" stroke-linejoin=\"round\"><g transform=\"rotate(45)\"><rect x=\"-5\" y=\"-1.1\" width=\"10\" height=\"2.2\" rx=\"1\"></rect><circle cx=\"-5.4\" cy=\"-1.35\" r=\"1.55\"></circle><circle cx=\"-5.4\" cy=\"1.35\" r=\"1.55\"></circle><circle cx=\"5.4\" cy=\"-1.35\" r=\"1.55\"></circle><circle cx=\"5.4\" cy=\"1.35\" r=\"1.55\"></circle></g><g transform=\"rotate(-45)\"><rect x=\"-5\" y=\"-1.1\" width=\"10\" height=\"2.2\" rx=\"1\"></rect><circle cx=\"-5.4\" cy=\"-1.35\" r=\"1.55\"></circle><circle cx=\"-5.4\" cy=\"1.35\" r=\"1.55\"></circle><circle cx=\"5.4\" cy=\"-1.35\" r=\"1.55\"></circle><circle cx=\"5.4\" cy=\"1.35\" r=\"1.55\"></circle></g></g><g fill=\"#ffffff\"><g transform=\"rotate(45)\"><rect x=\"-5\" y=\"-1.1\" width=\"10\" height=\"2.2\" rx=\"1\"></rect><circle cx=\"-5.4\" cy=\"-1.35\" r=\"1.55\"></circle><circle cx=\"-5.4\" cy=\"1.35\" r=\"1.55\"></circle><circle cx=\"5.4\" cy=\"-1.35\" r=\"1.55\"></circle><circle cx=\"5.4\" cy=\"1.35\" r=\"1.55\"></circle></g><g transform=\"rotate(-45)\"><rect x=\"-5\" y=\"-1.1\" width=\"10\" height=\"2.2\" rx=\"1\"></rect><circle cx=\"-5.4\" cy=\"-1.35\" r=\"1.55\"></circle><circle cx=\"-5.4\" cy=\"1.35\" r=\"1.55\"></circle><circle cx=\"5.4\" cy=\"-1.35\" r=\"1.55\"></circle><circle cx=\"5.4\" cy=\"1.35\" r=\"1.55\"></circle></g></g></g>",
  "acid": "<ellipse cx=\"0\" cy=\"13\" rx=\"16\" ry=\"4\" fill=\"currentColor\"></ellipse><path d=\"M-15 13 Q-14 6 -13 -1 Q-11 5 -8 7 Q-7 0 -6 -6 Q-4 3 -2 6 Q-1 -3 0 -9 Q1 -3 2 6 Q4 3 6 -6 Q7 0 8 7 Q11 5 13 -1 Q14 6 15 13 Z\" fill=\"currentColor\"></path><circle cx=\"0\" cy=\"-15\" r=\"3.2\" fill=\"currentColor\"></circle><circle cx=\"-12\" cy=\"-10\" r=\"1.9\" fill=\"currentColor\"></circle><circle cx=\"10.5\" cy=\"-13\" r=\"1.4\" fill=\"currentColor\"></circle><circle cx=\"16\" cy=\"-5\" r=\"1.2\" fill=\"currentColor\"></circle>",
  "cold": "<g transform=\"rotate(0)\"><line x1=\"0\" y1=\"-16\" x2=\"0\" y2=\"16\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\"></line><path d=\"M-5 -11 L0 -6 L5 -11 M-5 11 L0 6 L5 11\" stroke=\"currentColor\" stroke-width=\"2\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path></g><g transform=\"rotate(60)\"><line x1=\"0\" y1=\"-16\" x2=\"0\" y2=\"16\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\"></line><path d=\"M-5 -11 L0 -6 L5 -11 M-5 11 L0 6 L5 11\" stroke=\"currentColor\" stroke-width=\"2\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path></g><g transform=\"rotate(120)\"><line x1=\"0\" y1=\"-16\" x2=\"0\" y2=\"16\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\"></line><path d=\"M-5 -11 L0 -6 L5 -11 M-5 11 L0 6 L5 11\" stroke=\"currentColor\" stroke-width=\"2\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"></path></g>"
};

/** The damage type a phrase names ("Fire", "fire damage", "Slashing or Piercing" → the first). */
export function damageTypeOf(s: string): DamageType | undefined {
  const t = s.toLowerCase();
  let best: { k: DamageType; at: number } | undefined;
  for (const k of DAMAGE_TYPES) {
    const at = t.search(new RegExp(`\\b${k}\\b`));
    if (at >= 0 && (!best || at < best.at)) best = { k, at };
  }
  return best?.k;
}
