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

/**
 * Each damage type's icon, drawn about 36 units across round (0, 0), with the classes its animation in sheet.css hooks
 * onto (designed on the canvas, CSS only). Ids are prefixed so two icons never clash.
 */
export const DAMAGE_ICON: Record<DamageType, string> = {
  fire: "<defs><clipPath id=\"ddfire-lo-a\"><rect x=\"-30\" y=\"3.8\" width=\"60\" height=\"30\"/></clipPath><clipPath id=\"ddfire-hi-a\"><rect x=\"-30\" y=\"-40\" width=\"60\" height=\"44.2\"/></clipPath></defs><g class=\"back\"><g class=\"flame\"><g class=\"rise\"><g clip-path=\"url(#ddfire-lo-a)\"><path d=\"M0 -17 C6 -9 13 -4 11 6 C10 13 5 17 0 17 C-5 17 -11 13 -11 6 C-11 0 -7 -4 -5 -9 C-3 -4 -1 -2 1 -1 C2 -6 1 -11 0 -17 Z\" fill=\"currentColor\"/></g><g clip-path=\"url(#ddfire-hi-a)\"><g class=\"wave\"><path d=\"M0 -17 C6 -9 13 -4 11 6 C10 13 5 17 0 17 C-5 17 -11 13 -11 6 C-11 0 -7 -4 -5 -9 C-3 -4 -1 -2 1 -1 C2 -6 1 -11 0 -17 Z\" fill=\"currentColor\"/></g></g><path class=\"core\" d=\"M0 4 C3 7 5 9 4 12 C3 15 -3 15 -4 12 C-5 9 -2 7 0 4 Z\" fill=\"#fff3d6\"/></g></g></g><circle class=\"ember e1\" cx=\"0\" cy=\"-15\" r=\"1.2\"/><circle class=\"ember e2\" cx=\"2\" cy=\"-13\" r=\"1\"/><circle class=\"ember e3\" cx=\"-2\" cy=\"-14\" r=\"1.1\"/><circle class=\"ember e4\" cx=\"1\" cy=\"-15\" r=\".9\"/><circle class=\"ember e5\" cx=\"-1\" cy=\"-12\" r=\"1\"/>",
  lightning: "<g class=\"back\"><g class=\"bolt glowpulse\"><g class=\"vb st\"><g class=\"idlez\"><path d=\"M3 -18 L-10 3 L-1 3 L-4 18 L10 -4 L1 -4 Z\" fill=\"currentColor\"/></g><path class=\"flash\" d=\"M3 -18 L-10 3 L-1 3 L-4 18 L10 -4 L1 -4 Z\"/></g></g></g>",
  thunder: "<g class=\"back\"><g class=\"th\"><g class=\"vb jolt\"><g class=\"vb b-dot\"><circle r=\"3\" fill=\"currentColor\"/></g><g class=\"b-in b-inl\"><g class=\"pulse-l\"><path d=\"M-6 -12 Q-14 0 -6 12\" stroke=\"currentColor\" stroke-width=\"2.6\" fill=\"none\" stroke-linecap=\"round\"/></g></g><g class=\"b-in b-inr\"><g class=\"pulse-r\"><path d=\"M6 -12 Q14 0 6 12\" stroke=\"currentColor\" stroke-width=\"2.6\" fill=\"none\" stroke-linecap=\"round\"/></g></g><g class=\"b-out b-outl\"><g class=\"pulse-l o\"><path d=\"M-13 -16 Q-24 0 -13 16\" stroke=\"currentColor\" stroke-width=\"2.2\" fill=\"none\" stroke-linecap=\"round\" opacity=\".7\"/></g></g><g class=\"b-out b-outr\"><g class=\"pulse-r o\"><path d=\"M13 -16 Q24 0 13 16\" stroke=\"currentColor\" stroke-width=\"2.2\" fill=\"none\" stroke-linecap=\"round\" opacity=\".7\"/></g></g></g></g></g>",
  force: "<g class=\"back\"><g class=\"fo fan\"><g class=\"sk k0\" style=\"--a:-36deg\"><g class=\"breathe\"><path d=\"M-2.6 12 Q0 0 0 -9 Q0 0 2.6 12 Z\" fill=\"currentColor\" transform=\"rotate(-36 0 12)\"/></g></g><g class=\"sk k1\" style=\"--a:-18deg\"><g class=\"breathe\"><path d=\"M-2.6 12 Q0 0 0 -13 Q0 0 2.6 12 Z\" fill=\"currentColor\" transform=\"rotate(-18 0 12)\"/></g></g><g class=\"sk k2\" style=\"--a:0deg\"><g class=\"breathe\"><path d=\"M-2.6 12 Q0 0 0 -17 Q0 0 2.6 12 Z\" fill=\"currentColor\" transform=\"rotate(0 0 12)\"/></g></g><g class=\"sk k3\" style=\"--a:18deg\"><g class=\"breathe\"><path d=\"M-2.6 12 Q0 0 0 -13 Q0 0 2.6 12 Z\" fill=\"currentColor\" transform=\"rotate(18 0 12)\"/></g></g><g class=\"sk k4\" style=\"--a:36deg\"><g class=\"breathe\"><path d=\"M-2.6 12 Q0 0 0 -9 Q0 0 2.6 12 Z\" fill=\"currentColor\" transform=\"rotate(36 0 12)\"/></g></g></g></g>",
  radiant: "<g class=\"back\"><g class=\"ra\"><g class=\"vb dawn\"><g class=\"vb twink\"><path d=\"M0 -18 L4 -4 L18 0 L4 4 L0 18 L-4 4 L-18 0 L-4 -4 Z\" fill=\"currentColor\"/></g><path class=\"hot\" d=\"M0 -18 L4 -4 L18 0 L4 4 L0 18 L-4 4 L-18 0 L-4 -4 Z\"/></g><g class=\"reach\"><g class=\"ry r0\"><g class=\"pl\"><line x1=\"5.7\" y1=\"5.7\" x2=\"9.2\" y2=\"9.2\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/></g></g><g class=\"ry r1\"><g class=\"pl\"><line x1=\"-5.7\" y1=\"5.7\" x2=\"-9.2\" y2=\"9.2\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/></g></g><g class=\"ry r2\"><g class=\"pl\"><line x1=\"-5.7\" y1=\"-5.7\" x2=\"-9.2\" y2=\"-9.2\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/></g></g><g class=\"ry r3\"><g class=\"pl\"><line x1=\"5.7\" y1=\"-5.7\" x2=\"9.2\" y2=\"-9.2\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/></g></g></g></g></g>",
  psychic: "<g class=\"back\"><g class=\"ps\"><g class=\"vb open\"><g class=\"vb blink\"><path d=\"M-17 0 Q0 -14 17 0 Q0 14 -17 0 Z\" stroke=\"currentColor\" stroke-width=\"2.4\" fill=\"none\"/><g class=\"look\"><g class=\"vb dil\"><circle r=\"5\" fill=\"currentColor\"/></g></g></g></g><g class=\"vb orbit\"><circle cy=\"-15\" r=\"2\" fill=\"currentColor\"/><circle cy=\"15\" r=\"2\" fill=\"currentColor\"/></g></g></g>",
  slashing: "<g class=\"back\"><g class=\"sl\"><g class=\"jolt\"><path class=\"s1\" pathLength=\"100\" d=\"M-14 12 Q3 3 12 -14\" stroke=\"currentColor\" stroke-width=\"2.8\"/><path class=\"s2\" pathLength=\"100\" d=\"M-8 16 Q7 7 16 -8\" stroke=\"currentColor\" stroke-width=\"2.2\"/><path class=\"b1\" pathLength=\"100\" d=\"M-14 12 Q3 3 12 -14\" stroke=\"#fff\" stroke-width=\"3.4\"/><path class=\"b2\" pathLength=\"100\" d=\"M-8 16 Q7 7 16 -8\" stroke=\"#fff\" stroke-width=\"2.8\"/></g></g></g>",
  piercing: "<line class=\"streak\" x1=\"-30\" y1=\"0\" x2=\"6\" y2=\"0\" stroke-width=\"2\"/><g class=\"back\"><g class=\"pi\"><g class=\"fly\"><g class=\"tip quiver\"><line x1=\"-17\" y1=\"0\" x2=\"8\" y2=\"0\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\"/><path d=\"M17 0 L6 -6 L8 0 L6 6 Z\" fill=\"currentColor\"/><path d=\"M-17 0 L-21 -4 M-17 0 L-21 4 M-13 0 L-17 -4 M-13 0 L-17 4\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" fill=\"none\"/></g></g></g></g>",
  bludgeoning: "<g class=\"hit\"><path d=\"M14 -9 L20 -9 M13 -13 L18 -17 M13 -5 L18 -1\"/></g><g class=\"back\"><g class=\"bl\"><g class=\"shake\"><g class=\"grip swing\"><rect x=\"-11\" y=\"-16\" width=\"22\" height=\"13\" rx=\"3\" fill=\"currentColor\"/><line x1=\"0\" y1=\"-3\" x2=\"0\" y2=\"17\" stroke=\"currentColor\" stroke-width=\"3.4\" stroke-linecap=\"round\"/></g></g></g></g>",
  necrotic: "<circle class=\"wisp w1\" cx=\"-4.6\" cy=\"-1\" r=\"1.4\"/><circle class=\"wisp w2\" cx=\"4.6\" cy=\"-1\" r=\"1.4\"/><circle class=\"wisp w3\" cx=\"-4.6\" cy=\"-1\" r=\"1.2\"/><circle class=\"wisp w4\" cx=\"4.6\" cy=\"-1\" r=\"1.2\"/><circle class=\"wisp w5\" cx=\"0\" cy=\"-1\" r=\"1.1\"/><circle class=\"wisp w6\" cx=\"-4.6\" cy=\"-1\" r=\"1.1\"/><g class=\"back\"><g class=\"ne\"><g class=\"fadein\"><defs><clipPath id=\"ddnecrotic-lob\"><rect x=\"-20\" y=\"-9.8\" width=\"40\" height=\"30\"/></clipPath><clipPath id=\"ddnecrotic-hib\"><rect x=\"-20\" y=\"-30\" width=\"40\" height=\"20.4\"/></clipPath></defs><g clip-path=\"url(#ddnecrotic-lob)\"><path d=\"M-10 5 C-13 1 -13 -6 -10 -10 C-9 -12 -8 -14 -8 -17 C-5 -14 -4 -12 -3.5 -10 C-2 -15 2 -18 5 -23 C5 -18 8 -15 10 -12 C13 -8 13 0 10 5 L7 9 L7 13 Q0 15.5 -7 13 L-7 9 Z\" fill=\"currentColor\"/></g><g clip-path=\"url(#ddnecrotic-hib)\"><g class=\"lick\"><path d=\"M-10 5 C-13 1 -13 -6 -10 -10 C-9 -12 -8 -14 -8 -17 C-5 -14 -4 -12 -3.5 -10 C-2 -15 2 -18 5 -23 C5 -18 8 -15 10 -12 C13 -8 13 0 10 5 L7 9 L7 13 Q0 15.5 -7 13 L-7 9 Z\" fill=\"currentColor\"/></g></g><g class=\"eye el\"><ellipse cx=\"-4.6\" cy=\"-1\" rx=\"3.4\" ry=\"3.9\" fill=\"#030604\"/></g><g class=\"eye er\"><ellipse cx=\"4.6\" cy=\"-1\" rx=\"3.4\" ry=\"3.9\" fill=\"#030604\"/></g><path class=\"brow bl\" d=\"M-9.5 -7 L-0.4 -7 L-0.4 -1.6 L-9.5 -4.6 Z\" fill=\"currentColor\"/><path class=\"brow br\" d=\"M9.5 -7 L0.4 -7 L0.4 -1.6 L9.5 -4.6 Z\" fill=\"currentColor\"/><path d=\"M0 3.2 L-1.8 6.6 L1.8 6.6 Z\" fill=\"#0b1a12\"/><path d=\"M-2.6 9.6 L-2.6 13.4 M0 9.8 L0 13.9 M2.6 9.6 L2.6 13.4\" stroke=\"#0b1a12\" stroke-width=\"1.2\" stroke-linecap=\"round\"/></g></g></g><circle class=\"ember-g eg1\" cx=\"5\" cy=\"-22\" r=\"1\"/><circle class=\"ember-g eg2\" cx=\"-8\" cy=\"-16\" r=\".9\"/><circle class=\"ember-g eg3\" cx=\"4\" cy=\"-20\" r=\".8\"/>",
  poison: "<circle class=\"sp sp1\" cx=\"-4\" cy=\"16\" r=\"1.5\"/><circle class=\"sp sp2\" cx=\"4\" cy=\"16\" r=\"1.4\"/><circle class=\"sp sp3\" cx=\"-2\" cy=\"15\" r=\"1.1\"/><circle class=\"sp sp4\" cx=\"2\" cy=\"15\" r=\"1.2\"/><g class=\"back\"><g class=\"po\"><g class=\"fall\"><g class=\"bottom splat\"><g class=\"bottom jelly\"><path d=\"M0 -17 C4 -9 12 -3 12 5 A12 12 0 0 1 -12 5 C-12 -3 -4 -9 0 -17 Z\" fill=\"currentColor\"></path><g class=\"mid bonepop\"><g transform=\"translate(0 6) scale(1.15)\"><g fill=\"#14100c\" stroke=\"#14100c\" stroke-width=\"1.1\" stroke-linejoin=\"round\"><g transform=\"rotate(45)\"><rect x=\"-5\" y=\"-1.1\" width=\"10\" height=\"2.2\" rx=\"1\"></rect><circle cx=\"-5.4\" cy=\"-1.35\" r=\"1.55\"></circle><circle cx=\"-5.4\" cy=\"1.35\" r=\"1.55\"></circle><circle cx=\"5.4\" cy=\"-1.35\" r=\"1.55\"></circle><circle cx=\"5.4\" cy=\"1.35\" r=\"1.55\"></circle></g><g transform=\"rotate(-45)\"><rect x=\"-5\" y=\"-1.1\" width=\"10\" height=\"2.2\" rx=\"1\"></rect><circle cx=\"-5.4\" cy=\"-1.35\" r=\"1.55\"></circle><circle cx=\"-5.4\" cy=\"1.35\" r=\"1.55\"></circle><circle cx=\"5.4\" cy=\"-1.35\" r=\"1.55\"></circle><circle cx=\"5.4\" cy=\"1.35\" r=\"1.55\"></circle></g></g><g fill=\"#ffffff\"><g transform=\"rotate(45)\"><rect x=\"-5\" y=\"-1.1\" width=\"10\" height=\"2.2\" rx=\"1\"></rect><circle cx=\"-5.4\" cy=\"-1.35\" r=\"1.55\"></circle><circle cx=\"-5.4\" cy=\"1.35\" r=\"1.55\"></circle><circle cx=\"5.4\" cy=\"-1.35\" r=\"1.55\"></circle><circle cx=\"5.4\" cy=\"1.35\" r=\"1.55\"></circle></g><g transform=\"rotate(-45)\"><rect x=\"-5\" y=\"-1.1\" width=\"10\" height=\"2.2\" rx=\"1\"></rect><circle cx=\"-5.4\" cy=\"-1.35\" r=\"1.55\"></circle><circle cx=\"-5.4\" cy=\"1.35\" r=\"1.55\"></circle><circle cx=\"5.4\" cy=\"-1.35\" r=\"1.55\"></circle><circle cx=\"5.4\" cy=\"1.35\" r=\"1.55\"></circle></g></g></g></g></g></g></g></g></g>",
  acid: "<circle class=\"falldrop\" cx=\"0\" cy=\"10\" r=\"2.6\"/><g class=\"back\"><g class=\"ac\"><g class=\"base puddle\"><ellipse cx=\"0\" cy=\"13\" rx=\"16\" ry=\"4\" fill=\"currentColor\"/></g><g class=\"base crown\"><g class=\"base ripple\"><path d=\"M-15 13 Q-14 6 -13 -1 Q-11 5 -8 7 Q-7 0 -6 -6 Q-4 3 -2 6 Q-1 -3 0 -9 Q1 -3 2 6 Q4 3 6 -6 Q7 0 8 7 Q11 5 13 -1 Q14 6 15 13 Z\" fill=\"currentColor\"/></g></g><g class=\"fly dd0\"><g class=\"bob\"><circle cx=\"0\" cy=\"-15\" r=\"3.2\" fill=\"currentColor\"/></g></g><g class=\"fly dd1\"><g class=\"bob\"><circle cx=\"-12\" cy=\"-10\" r=\"1.9\" fill=\"currentColor\"/></g></g><g class=\"fly dd2\"><g class=\"bob\"><circle cx=\"10.5\" cy=\"-13\" r=\"1.4\" fill=\"currentColor\"/></g></g><g class=\"fly dd3\"><g class=\"bob\"><circle cx=\"16\" cy=\"-5\" r=\"1.2\" fill=\"currentColor\"/></g></g></g></g>",
  cold: "<circle class=\"snow sn1\" cx=\"-22\" cy=\"-36\" r=\"1\"/><circle class=\"snow sn2\" cx=\"-12\" cy=\"-36\" r=\"0.8\"/><circle class=\"snow sn3\" cx=\"-2\" cy=\"-36\" r=\"1.1\"/><circle class=\"snow sn4\" cx=\"9\" cy=\"-36\" r=\"0.9\"/><circle class=\"snow sn5\" cx=\"18\" cy=\"-36\" r=\"1\"/><circle class=\"snow sn6\" cx=\"26\" cy=\"-36\" r=\"0.8\"/><g class=\"back\"><g class=\"co\"><g class=\"vb drift\"><g transform=\"rotate(0)\"><line class=\"arm  a0\" x1=\"0\" y1=\"-16\" x2=\"0\" y2=\"16\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\"/><path class=\"br  a0\" d=\"M-5 -11 L0 -6 L5 -11 M-5 11 L0 6 L5 11\" stroke=\"currentColor\" stroke-width=\"2\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g><g transform=\"rotate(60)\"><line class=\"arm  a1\" x1=\"0\" y1=\"-16\" x2=\"0\" y2=\"16\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\"/><path class=\"br  a1\" d=\"M-5 -11 L0 -6 L5 -11 M-5 11 L0 6 L5 11\" stroke=\"currentColor\" stroke-width=\"2\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g><g transform=\"rotate(120)\"><line class=\"arm  a2\" x1=\"0\" y1=\"-16\" x2=\"0\" y2=\"16\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\"/><path class=\"br  a2\" d=\"M-5 -11 L0 -6 L5 -11 M-5 11 L0 6 L5 11\" stroke=\"currentColor\" stroke-width=\"2\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></g></g></g></g>",
};

export function damageTypeOf(s: string): DamageType | undefined {
  const t = s.toLowerCase();
  let best: { k: DamageType; at: number } | undefined;
  for (const k of DAMAGE_TYPES) {
    const at = t.search(new RegExp(`\\b${k}\\b`));
    if (at >= 0 && (!best || at < best.at)) best = { k, at };
  }
  return best?.k;
}

/**
 * The damage types a roll lets the player choose between, in the order written: "Bludgeoning or Necrotic or Psychic or
 * Radiant" gives four. Only the part before any ", plus ..." extra damage counts. Fewer than two means no choice.
 */
export function damageChoices(s: string): DamageType[] {
  const base = s.split(/,\s*plus\s+/i)[0];
  if (!/\bor\b/i.test(base)) return [];
  const found: DamageType[] = [];
  for (const m of base.toLowerCase().matchAll(/[a-z]+/g)) {
    const t = m[0] as DamageType;
    if ((DAMAGE_TYPES as readonly string[]).includes(t) && !found.includes(t)) found.push(t);
  }
  return found.length >= 2 ? found : [];
}

/** A damage type's name as the SRD writes it: "Radiant". */
export const damageName = (t: DamageType) => t[0].toUpperCase() + t.slice(1);

