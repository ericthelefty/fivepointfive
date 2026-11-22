# Prompt: convert 5E content into a fivepointfive import pack

*Paste everything below the line into an AI assistant (Claude, ChatGPT…), then give it the content to convert: your homebrew, or rules text from a book you own. It returns `.md` files you import on the app's **Content packs** page.*

---

You are converting tabletop RPG content (D&D 5th edition, 2024 rules, also called 5.5e) into an **import pack for fivepointfive**, a character builder and play sheet. A pack is a set of Markdown (`.md`) files. Each entry keeps its rules text word for word and adds `## Effects` sections written in **Modif**, a small YAML format the app reads to automate the rules: proficiencies, choices, limited uses, bonuses, attacks, spells, toggles like Rage.

The app never reads rules from prose. Whatever the Effects leave out isn't automated, and the player applies it by hand from the text. So the text must be complete and exact, and the Effects must be faithful to it.

## 0. Ground rules

- **Use only the text I give you.** Don't add rules, entries or text from memory, even if you know the book. If something seems to be missing (a table, a feature's later levels), say so in your report instead of filling it in.
- **Keep the rules text word for word.** The only change allowed is turning bold-italic run-in labels into headings (§3).
- **Don't invent Modif.** Use only the blocks and fields in the spec. If something can't be expressed, see §6.
- **Ask before starting** if you don't know the pack's name and ID, or which entries I want converted. Otherwise, work through everything I've given you.
- Work **one entry at a time** (a class together with its subclasses), finishing each completely.

## 1. References

If you can browse the web, read these before you start. They're the authority; this prompt is a summary.

- The Modif cookbook (rules phrases → blocks, with SRD examples): https://github.com/ericthelefty/fivepointfive/blob/main/docs/MODIF_COOKBOOK.md
- The Modif spec: https://github.com/ericthelefty/fivepointfive/blob/main/docs/MODIF.md (read §2–§4 and the section for every block you use)
- The content format: https://github.com/ericthelefty/fivepointfive/blob/main/docs/CONTENT_FORMAT.md
- Finished examples to copy (every class, subclass, species, background, feat, spell and magic item in the SRD pack has Effects): https://github.com/ericthelefty/fivepointfive/tree/main/content/srd-5.2.1. Good ones:
  - `classes/fighter.md`, `classes/barbarian.md`, `subclasses/champion.md`
  - `species/dragonborn.md`, `backgrounds/soldier.md`, `feats/alert.md`
  - `spells/fireball.md`, `magic-items/weapon-1-2-or-3.md`
- The validator: https://github.com/ericthelefty/fivepointfive/tree/main/tools (`modif_check.py` + `modif.schema.json`)

If you can't browse, rely on this prompt, and say so in your report.

## 2. Files

- **Output.** One `.md` file per entry, named after it in kebab-case (`barkskin-hide.md`), plus a `pack.md`. Group them in folders by type if you like (`classes/`, `spells/`). Deliver them as a `.zip` (the app unpacks it), or as one combined `.md` file with the entries one after another, `pack.md` first.
- **`pack.md`** names the pack and sets the ID used in every entry ID:
  ```markdown
  # Eric's Homebrew
  **Type:** Pack
  **ID:** ericbrew
  **Version:** 1.0
  **System:** 5.5e
  **Author:** Eric
  **License:** Personal use
  ```
- **Entry anatomy.** Write field lines directly under the heading, with no blank lines between them. The first blank line ends the field block.
  ```markdown
  # Entry Name
  **Type:** Feat
  *General Feat (Prerequisite: Level 4+)*
  **Source:** Eric's Homebrew

  Rules text, exactly as written.
  ```
- **Types and the fields the app reads.** Write field values the way the SRD does.

  | Type | Fields |
  |---|---|
  | `Class` | Fields go in `## Core <Class> Traits`: `Primary Ability`, `Hit Point Die` (`D10 per Fighter level`), `Saving Throw Proficiencies`, `Skill Proficiencies`, `Weapon Proficiencies`, `Armor Training`, `Starting Equipment` (`Choose A or B: (A) …; or (B) 50 GP`). |
  | `Subclass` | `Parent` (the class name), a motto tagline. |
  | `Species` | `Creature Type`, `Size`, `Speed` (`30 feet`). |
  | `Background` | `Ability Scores` (three abilities), `Feat` (a feat name), `Skill Proficiencies` (`Athletics and Survival`), `Tool Proficiency`, `Equipment`. |
  | `Feat` | Tagline `*Origin Feat*`, `*General Feat (Prerequisite: …)*`, `*Fighting Style Feat*` or `*Epic Boon Feat*`; `Repeatable`. |
  | `Spell` | Tagline `*Level 3 Evocation (Sorcerer, Wizard)*` or `*Evocation Cantrip (Wizard)*`; `Casting Time`, `Range`, `Components`, `Duration` (a Duration starting with `Concentration` marks it). |
  | `Magic Item` | Tagline `*Wondrous Item, Rare (Requires Attunement)*`. |
  | `Rule` | Anything else. A heading ending `[Condition]` adds a condition to the sheet's Conditions tab. |
  | Equipment | `Gear`, `Tool`, `Weapon`, `Armor`. A `Weapon` with `Damage`, `Properties`, `Mastery`, `Weight`, `Cost` and a category tagline (`*Martial Ranged Weapon*`) gets attacks on the sheet; custom armor is text only. |
  | `Creature` | Shown as a stat block, not automated. |

- **Class features** are headings of the form `## Level N: Feature Name`. The progression table is a Markdown table whose first column is `Level`, with rows 1–20.
- **Subclasses that grant spellcasting** (Eldritch Knight, Arcane Trickster) keep their own spellcasting table: first column `<Class> Level`, a `Spells Prepared` column, and slot columns renamed to `Spell Slots per Spell Level 1`…. Their Spellcasting feature gets `spellcasting: { ability: int, progression: third, list: wizard, cantrips: "steps(3: 2, 10: 3)" }`.
- **Spellcasting classes** need these columns: `Cantrips`, `Prepared Spells`, and `Spell Slots per Spell Level 1`…`9` (`—` where there are none). A pact caster uses `Spell Slots` and `Slot Level` instead. Add a `## <Class> Spell List` with `### Level N <Class> Spells` tables. Spell names must match spell entries.
- **IDs.** Every entry gets `pack-id:type/slug` automatically (`ericbrew:feat/barkskin-hide`).
  - Add `**ID:** slug` only to keep an ID stable through a rename.
  - Add `**Replaces:** srd:spell/fireball` to house-rule an SRD entry.

## 3. Where Effects go

- Put `## Effects` and then a fenced `yaml` block **immediately after the text of the feature it belongs to**, before the next heading. Use `## Effects` even inside a `###` feature: it attaches to the heading just above it.
- **Placement by entry type:**
  - A class gives each `Level N:` feature its own Effects. Core traits go under `## Core <Class> Traits`.
  - Feats and species: each benefit or trait is a `##` heading with its own Effects.
  - Effects for the entry as a whole go before its first heading.
- **Run-in traits.** A bold-italic run-in that carries rules (`***Rooted.*** You have…`) becomes its own heading, one level below its parent, with its own Effects. Labels that only organise text stay as they are, with their numbers in the parent's block. Examples: `***At Higher Levels.***`, `***Number of Uses.***`.
- **Header fields are data.** Don't repeat them as blocks: Hit Point Die, Size, Speed, a background's skills and feat, spell headers, item taglines.

## 4. Modif essentials

Each list item is one block: a one-key mapping, `- <block>: { fields }`.

**YAML rules**
- Never use `on`, `off`, `yes`, `no`, `y`, `n`, `true` or `false` as keys.
- **Quote any value containing a comma, colon or `#`**: `value: "max(1, mod:cha)"`. Unquoted, YAML splits it silently.
- Wrap long mappings across lines, as `fighter.md` does.

**Values**
- Numbers and dice (`2`, `1d8`).
- `prof`, `mod:dex`, `score:str`, `level`, `level:<class>`.
- `table:<Column>`: the class table column at your level.
- `{ steps: { 2: 1, 17: 2 } }`: changes at those levels.
- `choice:<id>.<field>`, `spell-ability`.
- Arithmetic with `min()`, `max()`, `half()`.

**Paths (what a block changes)**
- `ac`, `initiative`
- `save:<ab>` / `save:all`, `check:<ab>`, `skill:<kebab-name>`
- `hp:max`, `hp:per-level`, `speed:walk|fly|swim|climb|burrow`, `sense:darkvision`, `passive:perception`
- `attack`, `damage`, `spell:dc`, `spell:attack`

Abilities are `str dex con int wis cha`.

**Scopes (which rolls a block touches)**
- `scope: { weapon: { kind: melee, property: [finesse, light], id: longsword, unarmed: true } }`
- `{ spell: { school: evocation, level: 0 } }`
- `{ ability: str }`
- `{ against: { condition: poisoned } }` (this one becomes a note on the roll)

**Conditions (`when`)**
- `armor: none|light|medium|heavy`, `shield: false`, `active: $#rage`, `level: ">= 5"`
- `hp: bloodied`, `condition: prone`
- `player: "In dim light or darkness"`: becomes a switch the player sets.

**References**
- `$#<id>`: a block in the same entry.
- `$srd/feats/defense`: an SRD entry.
- `$<pack-id>/<type>/<slug>`: an entry in this pack.

### The blocks you'll use most

Copy these shapes; they're taken from the SRD pack.

```yaml
# grants and choices
- proficiency: [save:str, save:con, weapon:simple, armor:light, skill:athletics, tool:thieves-tools]
- choose: { id: skills, kind: skill, count: 2, grants: proficiency, from: [athletics, history, survival] }
- choose: { id: ancestry, kind: option, options: [ { id: red, label: Red, damage: fire }, { id: blue, label: Blue, damage: lightning } ] }
- defense: { resistance: [choice:ancestry.damage] }
- sense: { darkvision: 60 }
- speed: { climb: speed:walk }
- language: [common, draconic]
- score: { con: 1 }

# numbers
- bonus: { to: initiative, value: prof }
- bonus: { to: [ac, save:all], value: 1 }
- base: { to: ac, value: 10 + mod:dex + mod:con, when: { armor: none } }
- advantage: { roll: save:all, scope: { against: { condition: prone } } }
- crit-range: { value: 19 }
- extra-attack: { total: 2 }

# limited uses and actions
- resource: { id: second-wind, max: table:Second Wind, reset: long, partial: { at: short, amount: 1 } }
- action: { id: second-wind, activation: bonus, cost: { resource: $#second-wind }, heal: 1d10 + level:fighter }
- action: { id: patient-defense, activation: bonus,
            choose-one: [ { id: basic, take: disengage }, { id: focused, take: [disengage, dodge], cost: { resource: $#focus } } ] }
- trigger: { event: { fail: check }, offer: { add-roll: 1d10, cost: { resource: $#second-wind }, refund: if-fails } }

# switch on / off (Rage-style); effects elsewhere can use when: { active: $#rage }
- toggle:
    id: rage
    activation: bonus
    cost: { resource: $#rages }
    duration: { until: end-of-next-turn, max: { amount: 10, unit: minute } }
    ends-when: [{ armor: heavy }, { condition: incapacitated }]
    effects:
      - defense: { resistance: [bludgeoning, piercing, slashing] }
      - bonus: { to: damage, value: table:Rage Damage, scope: { ability: str } }

# class plumbing
- hit-die: d10
- multiclass: [hit-die, weapon:martial, armor:light, armor:medium, armor:shield]
- choose: { id: asi, kind: feat, from: { feat: { qualify: true } }, default: $srd/feats/ability-score-improvement, at: [4, 8, 12, 16] }
- choose: { id: subclass, kind: subclass, from: { subclass: { parent: $ericbrew/classes/warden } } }

# spells
- action: { area: { shape: sphere, size: 20 }, save: { ability: dex, success: half }, damage: { dice: 8d6, type: fire } }
- action: { range: touch, heal: 2d8 + spell-ability }
- scaling: { per-slot-above: 3, add: { damage: 1d6 } }          # the number is the spell's own level
- scaling: { cantrip: [5, 11, 17], add: { damage: 1d10 } }
- self-effects: { effects: [ { bonus: { to: ac, value: 2 } } ] }

# magic items (apply while equipped or attuned, as the item needs)
- variant: { id: plus, by: rarity, values: { uncommon: 1, rare: 2, very-rare: 3 } }
- bonus: { to: [attack, damage], value: variant:plus, scope: { weapon: { id: self } } }
- charges: { max: 7, recharge: { at: dawn, regain: 1d6+1 } }
- action: { activation: bonus, heal: 2d4+2, consume: true }

# weapon and roll rules
- use-ability: { ability: dex, instead-of: str, for: [attack, damage], scope: { weapon: { monk: true } } }
- damage-die: { die: table:Martial Arts, if-higher: true, scope: { weapon: { unarmed: true } } }
- roll-floor: { roll: [check:all], min: 10, when-proficient: true }
- die-floor: { min: 3, scope: { weapon: { kind: melee, hands: two } } }
- convert: { from: { slot: any }, to: { resource: $#sorcery-points, amount: cost.slot } }

# nothing to track
- narrative: true
```

Other blocks exist for everything else: `grant-spell`, `spell-list`, `spellcasting`, `form`, `aura`, `zone`, `summon`, `modify`, `replace`, `reroll`, `treat-roll`, `save-rule`, `curse`, `cast-list` and more. Check the spec for their fields before using them.

## 5. Rules the app depends on

Break these and the sheet shows wrong or missing numbers.

- **Encode classes completely.** A class's Effects are its only source of rules on the sheet, so encode it in full or not at all.
- **Saving throws:** core traits need `proficiency: [save:…, save:…]`.
- **Class skill choice:** must use `id: skills` exactly: `choose: { id: skills, kind: skill, count: N, grants: proficiency, from: [...] }`.
- **Multiclassing:** `multiclass: [...]` lists exactly what the "As a Multiclass Character" text grants.
- **Every limited-use feature needs a `resource`.** Use `table:<Column>` when the class table has the number, and `steps` otherwise. Its action, toggle or trigger pays with `cost: { resource: $#<id> }`.
- **Switchable features** (Rage, Wild Shape, a cloak you activate) are a `toggle` or `form` with `id`, `cost`, `duration` and `effects`.
- **Feat slots:** Ability Score Improvement and Epic Boon are `choose` blocks of `kind: feat`, as above.
- **A species "skill of your choice"** is a `choose` with `kind: skill`.
- **Choice and block ids are permanent.** Saved characters remember picks by `<entry id>#<choice id>`. Don't rename them in a later version of the pack.
- **`per-slot-above` equals the spell's own level.**
- **Read every feature in full** before encoding it, including its table and the later levels that change it.
- **Encode what the rules say**, using the spec's vocabulary, even when the app might only show a block as a reminder.

## 6. When Modif can't say it

In order of preference:

1. **The nearest faithful blocks**, with a short `text:` on the block for what they miss.
2. **`note`**, for something to show next to a stat but never calculate: `- note: { stat: initiative, text: "…" }`.
3. **`custom`**, only if the sheet would need code to act on it: `- custom: { handler: <name>, params: { … }, text: "<the rule in words>" }`.
   - This app knows two handlers: `use-magic-device` (any Spell Scroll, with an ability and a check) and `thiefs-reflexes` (a second turn at Initiative + offset).
   - Any other handler name is flagged by the validator. The app shows its `text` as a reminder until someone writes the handler.
   - Use `custom` rarely, and only with a clear `text`.

List every such case under **Spec gaps** in your report.

## 7. Check your work

- **If you can run Python:** download `modif_check.py` and `modif.schema.json` and run `pip install pyyaml jsonschema`. Put your pack folder next to a copy of the SRD pack and run:
  ```
  MODIF_SRD=<path to content/srd-5.2.1> python3 modif_check.py <your pack folder>
  ```
  It must report 0 issues. (Your custom handlers will show as unknown unless they're one of the two above; that's expected, so list them.)
- **Otherwise, self-check each block:**
  - one key per list item;
  - block and field names exist in the spec;
  - expressions with commas are quoted;
  - every `$#id` points to an `id` in the same entry;
  - every `choice:<id>` points to a `choose`;
  - every `table:<Column>` matches a column in the class table.
- **In the app:** the import preview lists anything it couldn't understand, with line numbers. Build a test character with the content and check that the builder offers the choices and the sheet shows the numbers, uses and switches you expect.

## 8. Report at the end

- **Files:** the files you produced, and the entries in each.
- **Coverage per entry:** features fully encoded, partly encoded (and what's missing), and text-only.
- **Spec gaps:** anything Modif couldn't express, the block or `custom` handler you used, and what a proper block would need.
- **Source problems:** text that looked garbled, truncated or inconsistent (a table that disagrees with the prose, a missing level), left as given.
- **Assumptions you made**, and anything I should check.
