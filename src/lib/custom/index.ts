/**
 * Hand-coded mechanics for the `custom` Modif block.
 *
 * A mechanic gets a handler here when it is used once or twice and doesn't fit the existing blocks.
 * When the same pattern shows up about three times, it becomes a Modif block instead and the handler is
 * removed; each handler says what Modif would need (`replaceWith`), and its test pins what it does to the
 * sheet so the replacement can be checked against it.
 *
 * Handlers only write to the same ModifResult the blocks write to. A pack that names a handler this app
 * doesn't have still works: the block's `text` shows as a reminder.
 *
 * One file per handler, named like the handler (the validator reads the file names).
 */
import type { Entry } from "../parse.ts";
import type { Item } from "../inventory.ts";
import type { Env, ModifResult, Val } from "../modif.ts";
import useMagicDevice from "./use-magic-device.ts";
import thiefsReflexes from "./thiefs-reflexes.ts";

export interface CustomCtx {
  /** the block's `params` */
  params: Val;
  r: ModifResult;
  env: Env;
  /** shown on the sheet as where it comes from */
  source: string;
  feature: string;
  entry: Entry;
  item?: Item;
}

export interface CustomHandler {
  /** What Modif would need for this to become blocks. */
  replaceWith: string;
  /** Apply to the sheet. Return false if it can't (the block's text then shows as a reminder). */
  apply(ctx: CustomCtx): boolean;
}

export const CUSTOM_HANDLERS: Record<string, CustomHandler> = {
  "use-magic-device": useMagicDevice,
  "thiefs-reflexes": thiefsReflexes,
};
