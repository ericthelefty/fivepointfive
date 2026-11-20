import { useState } from "react";
import { Link } from "react-router-dom";
import { Md } from "../lib/md.tsx";
import guide from "../../docs/CONTENT_FORMAT.md?raw";

export const TEMPLATES: Record<string, { file: string; text: string }> = {
  Feat: { file: "feat.md", text: "# [Feat Name]\n**Type:** Feat\n*General Feat (Prerequisite: Level 4+)*\n\n[What the feat represents, in a sentence or two.]\n\n***[Benefit Name].*** [What it lets you do.]\n\n***[Second Benefit].*** [What it lets you do.]\n" },
  Spell: { file: "spell.md", text: "# [Spell Name]\n**Type:** Spell\n*Level 1 Evocation (Sorcerer, Wizard)*\n**Casting Time:** Action\n**Range:** 60 feet\n**Components:** V, S, M ([material])\n**Duration:** Instantaneous\n\n[What the spell does.]\n\n***Using a Higher-Level Spell Slot.*** [What changes when cast with a higher slot.]\n" },
  Species: { file: "species.md", text: "# [Species Name]\n**Type:** Species\n**Creature Type:** Humanoid\n**Size:** Medium (about [x–y] feet tall)\n**Speed:** 30 feet\n\n[A short description.]\n\n***[Trait Name].*** [What it does.]\n\n***[Trait Name].*** [What it does.]\n" },
  Background: { file: "background.md", text: "# [Background Name]\n**Type:** Background\n**Ability Scores:** [Ability], [Ability], [Ability]\n**Feat:** [Origin Feat]\n**Skill Proficiencies:** [Skill] and [Skill]\n**Tool Proficiency:** [Tool]\n**Equipment:** Choose A or B: (A) [items], [n] GP; or (B) 50 GP\n\n[Optional description.]\n" },
  Subclass: { file: "subclass.md", text: "# [Subclass Name]\n**Type:** Subclass\n**Parent:** [Class]\n*[A short motto.]*\n\n[What this path is about.]\n\n## Level 3: [Feature Name]\n[What it does.]\n\n## Level 6: [Feature Name]\n[What it does.]\n" },
  "Magic Item": { file: "magic-item.md", text: "# [Item Name]\n**Type:** Magic Item\n*Wondrous Item, Uncommon (Requires Attunement)*\n\n[What the item does.]\n" },
  Creature: { file: "creature.md", text: "# [Creature Name]\n**Type:** Creature\n*Medium Beast, Unaligned*\n**AC** 12\n**Initiative** +2 (12)\n**HP** 11 (2d8 + 2)\n**Speed** 40 ft.\n\n| | Score | Mod | Save |\n|---|---|---|---|\n| Str | 12 | +1 | +1 |\n| Dex | 14 | +2 | +2 |\n| Con | 12 | +1 | +1 |\n| Int | 3 | −4 | −4 |\n| Wis | 12 | +1 | +1 |\n| Cha | 6 | −2 | −2 |\n\n**Senses** Passive Perception 11\n**CR** 1/4 (XP 50; PB +2)\n\n## Actions\n***Bite.*** *Melee Attack Roll:* +4, reach 5 ft. *Hit:* 5 (1d6 + 2) Piercing damage.\n" },
  Pack: { file: "pack.md", text: "# [Collection Name]\n**Type:** Pack\n**ID:** [my-homebrew]\n**Version:** 1.0\n**System:** 5.5e\n**Author:** [Your name]\n**License:** [Personal use]\n\n[What’s in this collection, and any credits.]\n" },
};

export default function Guide() {
  const [tab, setTab] = useState("Spell");
  const [copied, setCopied] = useState(false);
  const t = TEMPLATES[tab];
  return (
    <div className="stack" style={{ gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1>How to format .md files</h1>
          <p className="muted" style={{ margin: "6px 0 0", maxWidth: 720 }}>
            Write content in Notepad, TextEdit or any editor, save it with the <code>.md</code> extension, and drop it on the{" "}
            <Link to="/content">Content packs</Link> page. In Notepad, choose “All files” when saving so it isn’t saved as .txt.
          </p>
        </div>
      </div>

      <section className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
          <h2>Templates</h2>
          <span className="faint">Copy one, replace the text in [brackets], save as .md</span>
        </div>
        <div role="tablist" aria-label="Content type" style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "12px 0" }}>
          {Object.keys(TEMPLATES).map((k) => (
            <button key={k} role="tab" aria-selected={k === tab} className="pill" aria-pressed={k === tab} onClick={() => { setTab(k); setCopied(false); }}>{k}</button>
          ))}
        </div>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "var(--mono)", fontSize: 13, lineHeight: 1.7, background: "var(--panel-2)", border: "1px solid var(--line-2)", borderRadius: 12, padding: 16 }}>{t.text}</pre>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <button className="btn small primary" onClick={() => { navigator.clipboard?.writeText(t.text); setCopied(true); }}>{copied ? "Copied" : "Copy template"}</button>
          <button className="btn small" onClick={() => {
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([t.text], { type: "text/markdown" }));
            a.download = t.file;
            a.click();
          }}>Download {t.file}</button>
          <Link className="btn small" to="/library">See SRD examples</Link>
        </div>
      </section>

      <section className="panel">
        <Md md={guide.replace(/^# .*\n/, "")} />
      </section>
    </div>
  );
}
