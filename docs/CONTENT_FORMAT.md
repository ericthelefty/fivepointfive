# Content Format Guide (draft v0.3)

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

**Your packs stay on your device.** Uploaded packs are stored in your browser only; the app never sends them anywhere. Only share content you have the right to share.

---

## 3. Entry types

Each type lists the fields the app understands. **Bold** fields are required.

### Class
`**Type:** Class` · Primary Ability · Hit Point Die · Saving Throw Proficiencies · Skill Proficiencies · Weapon Proficiencies · Tool Proficiencies · Armor Training · Starting Equipment

- The class fields go in a sub-section named `## Core <Class> Traits` (mirroring the book's table), one field per line.
- Features are any heading of the form `Level N: Feature Name`, at any depth (the SRD nests them under `## <Class> Class Features`).
- The progression table is a Markdown table under a heading `<Class> Features`; its first column must be `Level`. Extra columns (Rages, Cantrips, spell slots…) become values the app can reference by column name.
- Spell lists go under `## <Class> Spell List`, as one table per level (`Spell | School | Special`).

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
Either one entry per item (`**Type:** Gear`, `Tool`, `Weapon`, `Armor`… with fields such as Cost, Weight, Damage, Properties, Mastery), **or** a table under a heading — the app reads rows of known tables (Weapons, Armor, Ammunition…) by their column names. Tools also use the fields Ability, Weight, Utilize, Craft and Variants.

### Magic Item
`**Type:** Magic Item` · tagline `*Category, Rarity (Requires Attunement)*`.

### Creature
`**Type:** Creature` · Group (for families like "Red Dragons") · tagline `*Size Type, Alignment*` · AC · Initiative · HP · Speed · an ability table (`| | Score | Mod | Save |` rows for Str…Cha) · Skills · Resistances · Immunities · Gear · Senses · Languages · CR · sections `## Traits`, `## Actions`, `## Bonus Actions`, `## Reactions`, `## Legendary Actions`.

### Rule
`**Type:** Rule` — any rules text that isn't one of the above: glossary terms, conditions (tagline `*Condition*`), chapters of the rules. Sub-sections nest with `##`, `###`, etc.

---

## 4. Effects (automation) — optional

An entry works without automation; players apply text-only rules by hand. To let the app do the math, add an `## Effects` list using these phrases (one per line). Lines the app doesn't recognize stay as text and are flagged in the import preview.

| Phrase | Example |
|---|---|
| `+N <ability or stat>` | `+1 Constitution (max 20)`, `+1 AC`, `+10 Speed` |
| `proficiency in <skill/save/tool/armor/weapon>` | `proficiency in Athletics` |
| `expertise in <skill>` | `expertise in Stealth` |
| `advantage on <roll>` / `disadvantage on <roll>` | `advantage on Initiative` |
| `resistance to <damage type>` | `resistance to Fire damage` |
| `AC = <formula>` | `AC = 10 + Dex + Con` |
| `<resource>: N uses per <rest>` | `Rage: Rages uses per Long Rest` (column names from the class table are allowed) |
| `choose N <thing> from <list>` | `choose 2 skills from Arcana, History, Religion` |
| `grant <entry>` | `grant Magic Initiate (Cleric)` |

Any phrase can end with a condition: `while not wearing armor`, `while raging`, `at level 5`.

*(The phrasebook is a draft and will grow based on real files.)*

---

## 5. What the importer does

1. Splits files into entries at each `# ` heading.
2. Reads field lines and the tagline; checks the Type.
3. Shows a preview: entries found, which are automated vs. text-only, and plain-language warnings with line numbers.
4. Nothing is rejected — unknown things become text.
