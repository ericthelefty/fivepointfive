# Content Format Guide
**Version:** 0.5 (draft)
**Published:** 2026-11-20

Every piece of game content in this app — the bundled SRD, your homebrew, or material from books you own — is written as plain **Markdown** files. No YAML, no JSON, no code. If you can write a rulebook entry in Notepad, you can write content for this app.

The app reads a small set of conventions (headings, bold labels, a few fixed phrases). Anything it doesn't recognize is **kept as rules text**, never thrown away — so a file always imports; it's just less automated.

This guide marks what each convention does. **Used** means the builder or play sheet acts on it (works out HP, offers a choice, adds a roll button). **Shown** means it's displayed in the Library and builder for players to read and apply themselves.

The app doesn't read rules from prose. What an entry *does* (proficiencies, choices, limited uses, bonuses, spell rolls) is automated only through its `## Effects` blocks (section 4); header fields such as Hit Point Die, Speed and a spell's Duration are read as data. An entry without Effects still imports and shows its text, and players apply it by hand.

---

## 1. The basics

### Files and packs

- Files are UTF-8 text with the `.md` extension. You can import `.md` files directly, or a **`.zip`** of them: the app unpacks it in your browser and imports every `.md` file inside, in any folder. Anything else (images, .txt, files inside a zip that aren’t .md) is skipped with a note in the import preview.
- A **pack** is a set of `.md` files imported together. An optional `pack.md` (`**Type:** Pack`) names the collection and gives credit (see section 2); without one, the pack is called whatever you type in the Pack name box, or **My Homebrew**.
- One file can hold **one entry or many**. Each entry starts with a level-1 heading (`# Name`).

### Anatomy of an entry

```markdown
# Entry Name                                ← 1. heading: starts the entry
**Type:** Feat                              ← 2. field lines (Type is required)
*Origin Feat*                               ← 3. optional tagline (italic line)
**Prerequisite:** Level 4+                  ← more field lines

Rules text paragraphs, exactly as written.  ← 4. body

***Run-in Benefit.*** More rules text.      ← run-in subheading (bold italic + period)

## Sub-section                              ← 5. sub-sections (features, actions…)

| Column | Column |                         ← 6. tables (standard Markdown tables)
|---|---|
| a | b |
```

1. **Heading** — `# Name` begins an entry. The entry runs until the next `#` heading.
2. **Field lines** — `**Label:** value`, one per line, directly under the heading. `**Type:**` is required; see section 3 for the labels each type understands. Unknown labels are kept and displayed, not rejected.
3. **Tagline** — a single line in *italics* in the same block as the field lines, the way books print "*Level 3 Evocation (Sorcerer, Wizard)*" under a spell name.
4. **Body** — everything else is rules text, shown to players as written. Use normal Markdown: paragraphs, `- bullets`, `**bold**`, `*italic*`.
5. **Sub-sections** — `## Heading` inside an entry. Class features use `## Level 3: Feature Name`; creatures use `## Actions`, `## Reactions`, etc.
6. **Tables** — standard Markdown pipe tables, with a header row and a `|---|---|` line under it.

**Keep the field block together.** The heading, field lines and tagline must have no blank lines between them: the first blank line ends the block, and any field after it is read as body text. The importer removes stray blank lines between field lines for you and says so.

### Common fields (any type)

| Field | Use |
|---|---|
| `**Source:** SRD 5.2.1, p. 131` | Where the entry comes from. **Shown** in the Library and builder; without it, the pack name is shown. |
| `**Tags:** defense, homebrew` | Free labels, comma-separated. **Shown** in the Library, and the Library search finds entries by tag. |

A heading may end with a bracketed tag, as the rules glossary does: `# Blinded [Condition]`. The app reads the name as "Blinded" and adds the tag "Condition". The `Condition` tag is special: see Rule in section 3.

### Rules for writing labels

- Labels are case-insensitive and the colon goes **inside** the bold: `**Casting Time:** Action`. The colon is optional — creature stat blocks print labels without one (`**AC** 16`), and both forms are read the same way. If you write the colon outside the bold (`**Range**: 60 feet`), the importer moves it for you.
- Use the same words the rules use. A few header fields are read by their wording (section 3 says which), so copying the SRD's phrasing is the safest choice.
- Prerequisites such as `Level 4+` or `Strength 13+` are **shown**, not checked: the app doesn't stop a character from taking a feat they don't qualify for.

---

## 2. IDs, packs, and overriding content

Every entry gets an ID automatically: `pack-id:type/slug-of-name`, e.g. `srd:spell/fireball`. The Library shows each entry's ID at the bottom of its page. You only write an ID when you need to:

| Field | Use |
|---|---|
| `**ID:** my-fireball` | Give the entry a fixed slug, so its ID stays the same if you rename it. Characters remember their class, subclass, species and background by ID. |
| `**Replaces:** srd:spell/fireball` | Swap out an existing entry with yours (a house-ruled version). The original is hidden everywhere, and characters that used it get yours instead. Use the exact ID from the Library. |
| `**Parent:** Fighter` | **Used** by subclasses: the class name the subclass belongs to. An ID such as `srd:class/fighter` works too. |

If two packs both contain an entry called "Fireball", both appear, and the Library and builder show which pack each comes from. Use `**Replaces:**` when you want only one.

Re-importing a pack with the same name or ID adds a second copy rather than updating the first. To update a pack, remove the old one on the Content packs page, then import the new files.

### `pack.md`

```markdown
# My Homebrew Collection
**Type:** Pack
**ID:** ericbrew
**Version:** 1.0
**System:** 5.5e
**Author:** Eric
**License:** Personal use

Optional description and any attribution text the license requires.
```

The heading becomes the pack's name, and `**ID:**` becomes the pack ID used in every entry ID (`ericbrew:spell/…`). **Author** and **License** are shown on the Content packs page. **Version**, **System** and the description stay in the file for anyone who downloads the pack.

**Who sees your packs.** On a shared instance, packs you upload are visible to every member of that instance, and only you or the admin can remove them. In local-only mode, packs stay in your browser. Either way, only upload content you have the right to share with that group.

---

## 3. Entry types

Each type lists the fields the app understands. Only `**Type:**` is required. Every other field is optional: an entry that leaves fields out still imports, and players just read the text. The Format guide page in the app has a copyable template for each type.

### Class
`**Type:** Class` · Primary Ability · Hit Point Die · Saving Throw Proficiencies · Skill Proficiencies · Weapon Proficiencies · Tool Proficiencies · Armor Training · Starting Equipment

- The class fields go in a sub-section named `## Core <Class> Traits` (mirroring the book's table), one field per line.
- **Used**, so write them the way the SRD does:
  - Primary Ability: `Strength or Dexterity` (the multiclass prerequisite).
  - Hit Point Die: `D10 per Fighter level` (HP on the sheet).
  - Starting Equipment: `Choose A or B: (A) …; or (B) 50 GP` (a choice in the builder).
- **Shown:** Saving Throw Proficiencies, Skill Proficiencies, Weapon Proficiencies, Tool Proficiencies, Armor Training. What they grant comes from the core traits' Effects: `proficiency: [save:str, save:con, weapon:simple, armor:light]`, the skill choice as `choose: { id: skills, kind: skill, count: 2, grants: proficiency, from: [athletics, history, survival] }` (the builder's skill step reads this one), and `multiclass: [hit-die, …]` for what a second class grants.
- Features are any heading of the form `Level N: Feature Name`, at any depth (the SRD nests them under `## <Class> Class Features`).
- The progression table is a Markdown table whose first column is `Level`, with one row per level from 1 to 20.
- **Trackers on the play sheet** come from `resource` blocks, which can read a table column: `resource: { id: vigils, max: table:Vigils, reset: long, partial: { at: short, amount: 1 } }`.
- **Spellcasting classes** add the columns `Cantrips`, `Prepared Spells` and `Spell Slots per Spell Level 1` through `Spell Slots per Spell Level 9` (use `—` where there are no slots), and their Spellcasting feature has a `spellcasting` block naming the ability and progression: `spellcasting: { ability: int, progression: full, list: wizard }` (`half` for a Paladin-style class; `pact` with `Spell Slots` and `Slot Level` columns for a Warlock-style one). The class's spells go under `## <Class> Spell List`, with one sub-section per level (`### Cantrips (Level 0 <Class> Spells)`, `### Level 1 <Class> Spells`, …), each holding a `Spell | School | Special` table. Spell names must match spell entries. Without a spell list, the class gets every spell whose tagline names it.

### Subclass
`**Type:** Subclass` · **Parent** (the class name) · optional tagline (the subclass motto) · features as `Level N: Feature Name` headings. Players choose a subclass at level 3, so features start at level 3.

A subclass that grants spellcasting (like an Eldritch Knight) puts a `spellcasting` block in its Spellcasting feature, `spellcasting: { ability: int, progression: third, list: wizard, cantrips: "steps(3: 2, 10: 3)" }`, and a spellcasting table whose first column is the class level (`Fighter Level`), with a `Spells Prepared` column and `Spell Slots per Spell Level 1`… columns. The builder then offers spells from the named class's list and the sheet shows the slots.

### Species
`**Type:** Species` · Creature Type · Size · Speed

- **Used:** Speed (`30 feet`) on the sheet. Size is shown in the builder.
- **Shown:** Creature Type.
- **Traits:** write each as its own `##` heading with its Effects under it, as the SRD species do; each heading is listed as a trait in the builder and on the sheet. A species skill choice is a `choose` of kind `skill`. (In a species with no Effects at all, traits are written as run-ins, `***Trait Name.*** What it does.`, and `##` headings aren't listed as traits.)
- A table with options (like the Dragonborn's Draconic Ancestry table) becomes a choice in the builder. Put it under a `##` heading: the first such table with more than one row is used, so put other tables after it.

### Background
`**Type:** Background` · Ability Scores · Feat · Skill Proficiencies · Tool Proficiency · Equipment

- **Used:**
  - Ability Scores: three abilities, `Strength, Dexterity, Constitution` (the scores players can raise).
  - Feat: the name of a feat entry, such as `Magic Initiate (Cleric)`. Text in parentheses is ignored when matching, so this links to Magic Initiate.
  - Skill Proficiencies: `Athletics and Survival`.
  - Equipment: `Choose A or B: (A) …; or (B) 50 GP`.
- **Shown:** Tool Proficiency.

### Feat
`**Type:** Feat` · tagline gives the category (`*Origin Feat*`, `*General Feat (Prerequisite: Level 4+)*`, `*Fighting Style Feat*`, `*Epic Boon Feat*`) and prerequisites (level, ability scores, a feature) · Repeatable · benefits as `##` headings with their Effects. Offered in the builder's feat choices, and on the sheet when the character has it.

### Spell
`**Type:** Spell` · tagline `*Level N School (Class, Class)*` or `*School Cantrip (Class)*` · Casting Time · Range · Components · Duration

- **Used:** the tagline gives the spell's level, school and classes. Naming a class there adds the spell to that class's list, including SRD classes, so a homebrew spell tagged `(Wizard)` shows up for Wizards.
- **Used:** a Duration that starts with `Concentration` marks the spell as Concentration on the sheet.
- **Roll buttons** on the sheet come from the spell's Effects:
  - attack, save, damage and healing: `action: { save: { ability: dex, success: half }, damage: { dice: 8d6, type: fire } }`, `action: { attack: { kind: ranged-spell }, damage: … }`, `action: { heal: 2d8 + spell-ability }`
  - upcasting: `scaling: { per-slot-above: 3, add: { damage: 1d6 } }` (the number is the spell's own level)
  - cantrip scaling: `scaling: { cantrip: [5, 11, 17], add: { damage: 1d10 } }`
  - effects on you while it lasts: `self-effects: { effects: [ … ] }`; on its target: `target-effects`.
  A spell without Effects can still be cast (it uses a slot and is tracked while it lasts), but players roll from its text.
- **Shown:** Casting Time, Range, Components.

### Equipment (Gear, Tool, Weapon, Armor)
One entry per item: `**Type:** Gear`, `Tool`, `Weapon` or `Armor`, with fields such as Cost, Weight, Damage, Properties and Mastery. Tools also use the fields Ability, Utilize, Craft and Variants. Use `Gear` for anything else, such as mounts and vehicles. All of these are **shown**.

**Weapons from a pack are used:** a `Weapon` entry with `**Damage:**` (`3d6 Radiant`), `**Properties:**`, `**Mastery:**`, `**Weight:**` and `**Cost:**` can be added to the inventory, and when equipped it gets an attack on the sheet. Its category (`Martial Ranged Weapon`, `Simple Melee Weapon`) comes from a `**Category:**` field or the tagline, and decides proficiency and whether it uses Strength or Dexterity. A Weapon entry with the same name as an SRD weapon replaces it. Its own Effects apply while it's equipped.

Armor Class still comes from the SRD's Armor table only: a custom armor entry shows up in the Library as text but doesn't change AC yet.

### Magic Item
`**Type:** Magic Item` · tagline `*Category, Rarity (Requires Attunement)*`. **Shown** in the Library.

### Creature
`**Type:** Creature` · Group (for families like "Red Dragons") · tagline `*Size Type, Alignment*` · AC · Initiative · HP · Speed · an ability table (`| | Score | Mod | Save |` rows for Str…Cha) · Skills · Resistances · Immunities · Gear · Senses · Languages · CR · sections `## Traits`, `## Actions`, `## Bonus Actions`, `## Reactions`, `## Legendary Actions`. **Shown** as a stat block in the Library. Fields such as Senses and CR can come after the ability table, as long as they're before the first `##` section.

### Rule
`**Type:** Rule` — any rules text that isn't one of the above: glossary terms, conditions, chapters of the rules. Sub-sections nest with `##`, `###`, etc.

**Conditions:** put `[Condition]` at the end of the heading, as in `# Dazed [Condition]` (or add `**Tags:** Condition`). That's what adds it to the Conditions tab on the play sheet. Conditions with the same names as the SRD's (Blinded, Poisoned, Prone…) apply their effects to rolls automatically; new conditions can be marked on the sheet, and players apply their text by hand.

---

## 4. Automating rules (Effects)

Every entry imports without this section: players read the rules text and apply it by hand. Effects are how an entry gets automated: the app doesn't read rules from prose. An `## Effects` section restates the rules as **Modif** blocks, a small YAML format the app can act on. The full list of blocks is in the Modif spec (`docs/MODIF.md`).

**Where they go.** Put a `## Effects` heading right after the text of the feature it belongs to, then a fenced `yaml` block. Each list item (`- `) is one block. A class gives each `Level N:` feature its own Effects; an entry with one rule has one Effects section. The app hides Effects from the rules text that players read.

**One heading per trait.** If a feature packs several traits into bold-italic run-ins (`***Rooted.*** You have…`), write each one as its own heading instead, with its Effects under it.

**What happens today:** the importer checks every block and flags typos and blocks it doesn't know. On the sheet:
- **Numbers:** proficiencies, choices (skills, tools, feats, weapon masteries), ability score increases (including feats taken at Ability Score Improvement levels), AC formulas and bonuses, save, check, skill, Initiative, Speed, attack and damage bonuses, Advantage and Disadvantage, critical-hit range, Extra Attack and death-save rules.
- **Active effects:** anything with a `toggle` (Rage, a cloak you switch on) gets a switch on the Effects tab; switching it on spends its cost and applies its effects until you end it or rest. Spells you cast with a duration show there too, and their effects on you apply.
- **Uses:** limited-use features, item charges (with their recharge) and free casts are tracked, each with a Use button.
- **When this happens:** triggers (reactions, "when you hit", "when you fail a save") are listed with their remaining uses.
- **Spells and magic items** take their attack, save, damage, healing and upcasting from their Effects; magic items apply while equipped or attuned as they need.

Anything the sheet can't act on (areas, effects on other creatures, conditions only the player can judge) is listed as a reminder, and the rules text still applies.

Common blocks:

| Block | Example |
|---|---|
| `proficiency` | `- proficiency: [skill:athletics, save:con, armor:light, tool:smiths-tools]` |
| `choose` | `- choose: { id: skills, kind: skill, count: 2, grants: proficiency, from: [arcana, history, religion] }` |
| `bonus` | `- bonus: { to: ac, value: 1, when: { armor: [light, medium, heavy] } }` |
| `base` | `- base: { to: ac, value: 10 + mod:dex + mod:con, when: { armor: none } }` |
| `advantage` | `- advantage: { roll: initiative }` |
| `resource` | `- resource: { id: rage, max: table:Rages, reset: long, partial: { at: short, amount: 1 } }` |
| `action` | `- action: { id: second-wind, activation: bonus, cost: { resource: second-wind }, heal: 1d10 + level:fighter }` |
| `crit-range`, `extra-attack` | `- crit-range: { value: 19 }`, `- extra-attack: { total: 2 }` |
| `score` | `- score: { con: 1 }` |

**Values** can be numbers or short formulas: `prof` (Proficiency Bonus), `mod:dex`, `level:fighter`, `max(1, mod:cha)`, dice such as `1d10`, and `table:<column>` for a column of the class's progression table. The Barbarian table has a column called **Rages**, so `max: table:Rages` means "as many as the Rages column shows for your level."

### A worked example

A homebrew feat with its rules text and the matching Effects:

````markdown
# Barkskin Hide
**Type:** Feat
*General Feat (Prerequisite: Level 4+)*

Your skin hardens like old bark.

## Ability Score Increase

Increase your Constitution score by 1, to a maximum of 20.

## Effects
```yaml
- score: { con: 1 }
```

## Bark Armor

While you aren't wearing armor, your base Armor Class equals 10 plus your Dexterity and Constitution modifiers.

## Effects
```yaml
- base: { to: ac, value: 10 + mod:dex + mod:con, when: { armor: none } }
```

## Rooted

You have Advantage on saving throws to avoid being knocked Prone.

## Effects
```yaml
- advantage: { roll: save:all, scope: { against: { condition: prone } } }
```
````

The rules text is what players read; the Effects say the same thing as data. If the two disagree, the rules text is what counts.

---

## 5. What the importer does

1. Splits files into entries at each `# ` heading.
2. Reads field lines and the tagline; checks the Type.
3. Fixes small formatting slips automatically (a missing space after `#`, the colon outside the bold, blank lines inside the field block, a missing Type it can work out from the fields) and tells you what it changed.
4. Shows a preview: the entries found, plus plain-language suggestions with line numbers for anything it couldn't understand, such as an unknown type or a misspelled stat.
5. Nothing that is a `.md` file is rejected: anything the app doesn't understand is kept as text.
