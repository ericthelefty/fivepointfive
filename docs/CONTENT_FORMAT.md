# Content Format Guide (draft v0.4)

Every piece of game content in this app — the bundled SRD, your homebrew, or material from books you own — is written as plain **Markdown** files. No YAML, no JSON, no code. If you can write a rulebook entry in Notepad, you can write content for this app.

The app reads a small set of conventions (headings, bold labels, a few fixed phrases). Anything it doesn't recognize is **kept as rules text**, never thrown away — so a file always imports; it's just less automated.

---

## 1. The basics

### Files and packs

- Files are UTF-8 text with the `.md` extension. **Only `.md` files are accepted**; anything else (images, .txt, .zip) is skipped with a note in the import preview.
- A **pack** is a set of `.md` files imported together. An optional `pack.md` (`**Type:** Pack`) names the collection and gives credit; without one, files go into a default pack called **My Homebrew**.
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
3. **Tagline** — a single line in *italics* right under the heading, the way books print "*Level 3 Evocation (Sorcerer, Wizard)*" under a spell name. The app reads known patterns from it (spell level/school/classes, item category/rarity/attunement, creature size/type/alignment).
4. **Body** — everything else is rules text, shown to players as written. Use normal Markdown: paragraphs, `- bullets`, `**bold**`, `*italic*`.
5. **Sub-sections** — `## Heading` inside an entry. Class features use `## Level 3: Feature Name`; creatures use `## Actions`, `## Reactions`, etc.
6. **Tables** — standard Markdown pipe tables. A table's title is the `##`/`###` heading just above it.

### Common fields (any type)

| Field | Use |
|---|---|
| `**Source:** SRD 5.2.1, p. 131` | Where the entry comes from. Shown on the sheet; handy for checking rules. |
| `**Tags:** defense, homebrew` | Free labels for filtering. |

A heading may end with a bracketed tag, as the rules glossary does: `# Blinded [Condition]`. The app reads the name as "Blinded" and adds the tag "Condition".

### Rules for writing labels

- Labels are case-insensitive and the colon goes **inside** the bold: `**Casting Time:** Action`. The colon is optional — creature stat blocks print labels without one (`**AC** 16`), and both forms are read the same way.
- Lists inside a value are comma-separated: `**Classes:** Bard, Wizard`.
- Use the same words the rules use. `Level 4+` and `Constitution 13+` are understood in prerequisites.

---

## 2. IDs, packs, and overriding content

Every entry gets an ID automatically: `pack-id:type/slug-of-name`, e.g. `srd:spell/fireball`. You only write an ID when you need to:

| Field | Use |
|---|---|
| `**ID:** my-fireball` | Give the entry a fixed slug (useful if you might rename it). |
| `**Replaces:** srd:spell/fireball` | Swap out an existing entry with yours (a house-ruled version). |
| `**Parent:** srd:class/fighter` | Attach to another entry (subclasses, sub-species, item variants). Plain names work too: `**Parent:** Fighter`. |

Two packs can both contain "Fireball" — IDs keep them apart, and the app asks which to use only if you pick both.

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

**Who sees your packs.** On a shared instance, packs you upload are visible to every member of that instance, and only you or the admin can remove them. In local-only mode, packs stay in your browser. Either way, only upload content you have the right to share with that group.

---

## 3. Entry types

Each type lists the fields the app understands. Only `**Type:**` is required; every other field is optional, and an entry without it still imports as text. The Format guide page in the app has a copyable template for each type.

### Class
`**Type:** Class` · Primary Ability · Hit Point Die · Saving Throw Proficiencies · Skill Proficiencies · Weapon Proficiencies · Tool Proficiencies · Armor Training · Starting Equipment

- The class fields go in a sub-section named `## Core <Class> Traits` (mirroring the book's table), one field per line. Write them the way the SRD does, because the builder reads the wording: `Choose 2: Athletics, History, or Survival` for skills, `D10 per Fighter level` for the Hit Point Die, and `Choose A or B: (A) …; or (B) 50 GP` for equipment.
- Features are any heading of the form `Level N: Feature Name`, at any depth (the SRD nests them under `## <Class> Class Features`).
- The progression table is a Markdown table whose first column is `Level`, with one row per level from 1 to 20. Extra columns (Rages, Second Wind, Cantrips…) become values the app can look up by column name, for example in Effects.
- **Spellcasting classes** add the columns `Cantrips`, `Prepared Spells` and `Spell Slots per Spell Level 1` through `Spell Slots per Spell Level 9` (use `—` where there are no slots), and say "Intelligence is your spellcasting ability" (or Wisdom, or Charisma) in their Spellcasting feature. The class's spells go under `## <Class> Spell List`, with one sub-section per level (`### Cantrips (Level 0 <Class> Spells)`, `### Level 1 <Class> Spells`, …) each holding a `Spell | School | Special` table. Spell names must match spell entries.

### Subclass
`**Type:** Subclass` · **Parent** (the class) · optional tagline (the subclass motto) · features as `Level N: Feature Name` headings.

### Species
`**Type:** Species` · Creature Type · Size · Speed · traits as `***Trait Name.***` run-ins (or `## Trait Name` sub-sections).

### Background
`**Type:** Background` · Ability Scores · Feat · Skill Proficiencies · Tool Proficiency · Equipment

### Feat
`**Type:** Feat` · tagline gives the category (`*Origin Feat*`, `*General Feat (Prerequisite: Level 4+)*`, `*Fighting Style Feat*`, `*Epic Boon Feat*`) · Repeatable · benefits as `***Name.***` run-ins.

### Spell
`**Type:** Spell` · tagline `*Level N School (Class, Class)*` or `*School Cantrip (Class)*` · Casting Time · Range · Components · Duration. Upcasting text goes in a `***Using a Higher-Level Spell Slot.***` run-in; cantrip scaling in `***Cantrip Upgrade.***`.

### Equipment (Weapon, Armor, Gear, Tool, Mount, Vehicle…)
One entry per item: `**Type:** Gear`, `Tool`, `Weapon`, `Armor`… with fields such as Cost, Weight, Damage, Properties and Mastery. Tools also use the fields Ability, Utilize, Craft and Variants.

For now, attack rolls and Armor Class on the play sheet come from the SRD's Weapons and Armor tables only. A custom weapon or armor entry shows up in the Library and on the sheet as text, but it won't get an attack button or change AC yet.

### Magic Item
`**Type:** Magic Item` · tagline `*Category, Rarity (Requires Attunement)*`.

### Creature
`**Type:** Creature` · Group (for families like "Red Dragons") · tagline `*Size Type, Alignment*` · AC · Initiative · HP · Speed · an ability table (`| | Score | Mod | Save |` rows for Str…Cha) · Skills · Resistances · Immunities · Gear · Senses · Languages · CR · sections `## Traits`, `## Actions`, `## Bonus Actions`, `## Reactions`, `## Legendary Actions`.

### Rule
`**Type:** Rule` — any rules text that isn't one of the above: glossary terms, conditions (tagline `*Condition*`), chapters of the rules. Sub-sections nest with `##`, `###`, etc.

---

## 4. Automating rules (Effects) — optional

Every entry works without this section: players read the rules text and apply it by hand. An `## Effects` section restates the rules in short, fixed phrases the app can understand, so a future version can do the math for you.

**What happens today:** when you import, the app checks each Effects line and flags any it can't understand, so your files are ready. It doesn't apply effects to the character sheet yet. The phrasebook may still grow and change as it's used on real files.

Write each effect as a bullet (`- `) under `## Effects`, using these phrases:

| Phrase | Example |
|---|---|
| `+N <ability or stat>` | `+1 Constitution (max 20)`, `+1 AC`, `+10 Speed` |
| `proficiency in <skill/save/tool/armor/weapon>` | `proficiency in Athletics` |
| `expertise in <skill>` | `expertise in Stealth` |
| `advantage on <roll>` / `disadvantage on <roll>` | `advantage on Initiative` |
| `resistance to <damage type>` | `resistance to Fire damage` |
| `AC = <formula>` | `AC = 10 + Dex + Con` |
| `<resource>: N uses per <rest>` | `Rage: 2 uses per Long Rest`, or `Rage: Rages uses per Long Rest` (see below) |
| `choose N <thing> from <list>` | `choose 2 skills from Arcana, History, Religion` |
| `grant <entry>` | `grant Magic Initiate (Cleric)` |

Any phrase can end with a condition: `while not wearing armor`, `while raging`, `at level 5`.

**Using a class table column instead of a number.** Where a number changes with level, you can write the name of a column from the class's progression table. The Barbarian table has a column called **Rages** (2 at level 1, 3 at level 3, and so on), so `Rage: Rages uses per Long Rest` means "as many uses as the Rages column shows for your level."

### A worked example

A homebrew feat with its rules text and the matching Effects:

```markdown
# Barkskin Hide
**Type:** Feat
*General Feat (Prerequisite: Level 4+)*

Your skin hardens like old bark.

***Ability Score Increase.*** Increase your Constitution score by 1, to a maximum of 20.

***Bark Armor.*** While you aren't wearing armor, your base Armor Class equals 10 plus your Dexterity and Constitution modifiers.

***Rooted.*** You have Advantage on saving throws to avoid being knocked Prone.

## Effects
- +1 Constitution (max 20)
- AC = 10 + Dex + Con while not wearing armor
- advantage on saving throws against Prone
```

The rules text is what players read; the Effects lines say the same thing in phrasebook form. If the two disagree, the rules text is what counts.

---

## 5. What the importer does

1. Splits files into entries at each `# ` heading.
2. Reads field lines and the tagline; checks the Type.
3. Fixes small formatting slips automatically (a missing space after `#`, the colon outside the bold) and tells you what it changed.
4. Shows a preview: the entries found, plus plain-language suggestions with line numbers for anything it couldn't understand, such as an unknown type or a misspelled stat.
5. Nothing that is a `.md` file is rejected: anything the app doesn't understand is kept as text.
