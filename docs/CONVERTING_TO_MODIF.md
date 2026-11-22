# Prompt: convert fivepointfive content to Modif

*This prompt is for an agent working inside the repo. To convert your own content into a pack you import in the app, use [`PROMPT_CONVERT_FOR_IMPORT.md`](PROMPT_CONVERT_FOR_IMPORT.md).*

You are converting entries in the fivepointfive SRD content pack to **Modif**, the YAML effects format the app reads to apply rules automatically. You work in the repo `ericthelefty/fivepointfive` (React + Vite + TypeScript, tests with vitest).

## What to read first

1. `docs/MODIF.md`: the Modif 0.6 spec. It is the authority on block names, fields and values. Read §2 (where effects live), §3 (values, paths, scopes, conditions), §4 (block index) and the sections for every block you use.
2. `docs/CONTENT_FORMAT.md` §4: the user-facing summary of Effects.
3. Files that are already converted (all of the SRD pack's character content). Copy their style exactly, for example:
   - `content/srd-5.2.1/classes/fighter.md`
   - `content/srd-5.2.1/subclasses/champion.md`
   - `content/srd-5.2.1/species/human.md`
   - `content/srd-5.2.1/backgrounds/soldier.md`
   - every file in `content/srd-5.2.1/feats/`
4. `src/lib/modif.ts` (the engine) and `src/lib/modif.test.ts`, so you know what the app does with each block.

## Tools

- **Validator:** `tools/modif_check.py` with `tools/modif.schema.json` next to it (see `tools/README.md`). Run `python3 tools/modif_check.py`. It reads the Effects blocks out of the Markdown files and must report **0 issues**. Install `jsonschema` (`pip install jsonschema`) so the schema checks run too.
- **Converter:** `tools/convert_entry.py <entry.md> <draft.yaml>` puts a draft's blocks under the right headings, turning run-in traits and bold option labels into headings as it goes (see `tools/README.md`). Review the result by eye.
- **Drafts:** write drafts in `encodings/` while you work (see `encodings/README.md`): top-level keys are feature headings. Delete a draft in the same change that moves it into the pack.

## The task

Convert the entries the user names. The whole SRD 5.2.1 character side is already converted, so this is for homebrew content packs and for content the SRD pack doesn't cover yet (monsters, once Modif covers them). Work one entry, or one class with its subclasses, at a time, finishing each completely before starting the next. The SRD files are the examples to copy: every class, subclass, species, background, feat, spell and magic item there has Effects.

## How to write Effects

**Placement**
- Put `## Effects` and then a fenced `yaml` block immediately after the text of the feature it belongs to, before the next heading of any level.
- Each list item is one block. Use the `## Effects` heading level even inside `###` features; the parser attaches it to the heading just above.
- A class gives each `### Level N: Name` feature its own Effects. Core traits go under `## Core <Class> Traits`.
- If a feature heading has a nested table (`#### <Class> Features` under Fighting Style), put the Effects before the table heading.
- Effects for the entry as a whole go before its first heading.

**Run-in traits**
- A bold-italic run-in that carries rules (`***Rage Damage.*** …`) becomes its own heading one level below its parent, with its own Effects under it. Feat and species traits become `##` headings.
- Labels that only organise text stay as they are, with their numbers in the parent's block. Examples: `***Number of Uses.***`, `***At Higher Levels.***`, `***Repeatable.***`.
- Change only the label line. Keep the rules text word for word.

**Header fields are data**
- Don't repeat header fields as blocks: `Hit Point Die`, `Size`, `Speed`, `Creature Type`, `Skill Proficiencies` on backgrounds, a background's `Feat`, spell headers, item taglines, and tool fields.
- Exception: a size the player chooses is a `choose: { kind: size, … }`.

**Faithful, not bent to the app**
- Encode what the rules say, using the spec's vocabulary, even if the engine only lists a block as a reminder today.
- Use `narrative` only where there is really nothing for a sheet to track.
- Never put prose rules in YAML where a block exists. `text:` is for short notes inside a block.

**YAML rules**
- Never use `on`, `off`, `yes`, `no`, `y`, `n`, `true` or `false` as keys.
- Quote any value that contains a comma, colon or `#`.
- Wrap long flow mappings across lines the way `fighter.md` does.

**Read the whole text**
- Read every feature in full before encoding it, including tables, the "At Higher Levels" text and the later levels that change it.
- Don't encode from a summary or a truncated view. Earlier conversion passes lost details exactly this way.

## Rules the app depends on (break these and the sheet breaks)

The app reads rules only from Effects blocks, never from the text. Anything a class's blocks leave out simply isn't on the sheet, so a class must be encoded **completely** in one go.

- **Saving throws:** core traits need `proficiency: [save:…, save:…]`. Without it the class shows no save proficiencies.
- **Skill choice:** the class skill choice must be `choose: { id: skills, kind: skill, count: N, grants: proficiency, from: [...] }`, using the id `skills` exactly. The builder stores it in its existing class-skills field.
- **Multiclass grants:** include `multiclass: [...]` with exactly what the "As a Multiclass Character" text grants.
- **Switchable features:** Rage, Wild Shape, Bladesong and the like are a `toggle` (or `form`) with an `id`, its `cost`, `duration` and `effects`. Effects elsewhere that apply only while it's on use `when: { active: $#<id> }`. The sheet turns these into switches on its Effects tab, so they must be complete.
- **Limited-use features:** every one, Rage, Bardic Inspiration, Channel Divinity, Wild Shape, Focus Points and so on, needs a `resource` block. Use `table:<Column>` where the class table has a column, and `steps` where uses change at levels without a column.
- **Feat slots:** Ability Score Improvement is `choose: { id: asi, kind: feat, from: { feat: { qualify: true } }, default: $srd/feats/ability-score-improvement, at: [levels] }` under the first ASI heading. Epic Boon is `choose: { id: epic-boon, kind: feat, from: { feat: { qualify: true } }, default: <the boon the class text recommends, if any> }`. Copy `fighter.md`.
- **Species skill choices:** a species "skill of your choice" is a single-kind `choose` with `kind: skill`. The builder stores it in its species-skill field.
- **Choice ids are permanent:** players' saved choices are keyed by `<entry id>#<choice id>`. Don't rename an id that already exists in the pack.
- **References:** use `$srd/feats/<slug>` for other entries and `$#<id>` for ids in the same entry.
- **Scaling:** `per-slot-above` equals the spell's own level.

## Check every batch

1. `python3 tools/modif_check.py content/srd-5.2.1` reports 0 issues.
2. **No regressions.** Before converting, record what `derive()` gives for a sample character of each class you convert at levels 1, 5, 11 and 20. Do the same afterwards and compare:
   - save proficiencies, skill proficiencies, HP, AC, speed, initiative
   - resources (name, maximum, recovery)
   - the class's attacks

   Any difference must be one you can point to in the rules text. Typically that means a feature the text-reading code missed and Effects now apply.
3. **Tests.** Add tests to `src/lib/modif.test.ts` for each converted class, modelled on the Fighter tests: the numbers at a few levels, its resources, its choices and its subclass features. Update the test that lists which non-feat entries have Effects.
4. `npm test` and `npm run build` both pass.
5. **Look at the result.** Run `npm run dev`, build a character of the converted class in the builder, and check the class step choices, the Ability scores step slots and the sheet. Each feature should carry an "Automated" or "Partly automated" tag where expected.

## Don't

- Don't change the rules text, apart from turning run-in labels into headings.
  - If the pack text looks wrong (garbled, truncated, a malformed table), leave it and list it in your report.
  - Known issues already: `animate-objects`, `antilife-shell` and `find-steed` are garbled; `antipathy-sympathy` is truncated; the `chill-touch` header; a `draconic-sorcery` table row; the `armor-of-resistance` table; some monster headings merged together.
- Don't invent block names or fields. If the spec has no way to say something:
  - encode the nearest faithful form plus a `text:` note;
  - or, if the rule really can't be said with blocks and the sheet needs to act on it, write a `custom` block (MODIF.md §5.9) with a new handler name and the rule as `text` — it shows as a reminder until the handler exists;
  - list it under "Spec gaps" in your report, with any handler names you introduced.
- Don't edit `docs/MODIF.md`, the engine or the validator unless the user asks. Report what they'd need instead.
- Don't commit or push unless the user tells you to.

## Report at the end of each batch

- **Converted:** entries and features, with block counts.
- **Coverage:** the features the sheet automates, partly automates or only lists as reminders.
- **Regression check results:** every difference from before, and the rule text that justifies it.
- **Spec gaps:** things Modif couldn't express cleanly, with the feature and your suggested addition.
- **Pack text problems found.**
- **Validator, test and build output:** the summary lines.
