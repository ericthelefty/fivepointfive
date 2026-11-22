import { describe, expect, it } from "vitest";
import { parseFile } from "./parse.ts";
import { packChanges } from "./packdiff.ts";

const pack = (md: string) => parseFile(md, "home", "pack.md");
describe("updating a pack", () => {
  it("lists entries added, changed and removed by ID", () => {
    const before = pack("# Zap\n**Type:** Spell\n*Evocation Cantrip (Wizard)*\n\nZap.\n\n# Old Feat\n**Type:** Feat\n\nOld.\n\n# Same\n**Type:** Feat\n\nSame.\n");
    const after = pack("# Zap\n**Type:** Spell\n*Evocation Cantrip (Wizard)*\n\nZap.\n\n## Effects\n```yaml\n- action: { attack: { kind: ranged-spell } }\n```\n\n# Same\n**Type:** Feat\n\nSame.\n\n# New Feat\n**Type:** Feat\n\nNew.\n");
    expect(packChanges(before, after)).toEqual({ added: ["New Feat"], changed: ["Zap"], removed: ["Old Feat"], same: 1 });
  });
});
