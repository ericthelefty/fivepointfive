/**
 * Thief, Thief's Reflexes: in the first round of combat you take a second turn at your Initiative minus 10.
 * The Initiative roll shows the second turn's number.
 *
 * params: { offset: -10 }
 */
import type { CustomHandler } from "./index.ts";

const handler: CustomHandler = {
  replaceWith: "An `extra-turn` block (round 1, at Initiative + offset) that the sheet shows on Initiative rolls.",
  apply({ params, r, source }) {
    const offset = typeof params?.offset === "number" ? params.offset : -10;
    r.rollNotes.push({ roll: "init", source, text: (total) => `First round: take a second turn at Initiative ${total + offset}.` });
    return true;
  },
};
export default handler;
