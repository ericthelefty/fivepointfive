# Modif

*An open format for describing 5E-compatible rules as data.*

**Version:** 0.7 (draft) · **Published:** 2026-11-23 · **License:** CC-BY-4.0 (the same as the SRD content it describes) · **Pronounced:** MOD-if, short for *modifier*

## What it is

A rulebook tells a player what a feature does. Modif tells an app. Every class feature, species trait, feat, spell and magic item keeps its rules text for people to read, and adds a short `## Effects` block that says the same thing as data: "a Bonus Action that heals 1d10 + Fighter level, usable twice, one use back on a Short Rest". An app that understands Modif's blocks can then apply any content written in it, including homebrew it has never seen, without anyone writing code for that feature.

Content stays plain Markdown that anyone can read, edit or share. The Effects blocks are YAML inside it, built from a fixed vocabulary of about 70 blocks (bonuses, choices, resources, actions, toggles, spells, triggers and so on). The whole character side of the SRD 5.2.1 is already written in Modif: every class and subclass, species, background and feat, all 339 spells and all 258 magic items.

## A quick example

The SRD's Fighter has Second Wind. The rules text is unchanged; the Effects block after it restates the rules as two blocks:

````markdown
### Level 1: Second Wind

You have a limited well of physical and mental stamina that you can draw on. As a Bonus Action, you can use it to regain Hit Points equal to 1d10 plus your Fighter level.

You can use this feature twice. You regain one expended use when you finish a Short Rest, and you regain all expended uses when you finish a Long Rest. …

## Effects
```yaml
- resource: { id: second-wind, max: table:Second Wind, reset: long, partial: { at: short, amount: 1 } }
- action: { id: second-wind, activation: bonus, cost: { resource: $#second-wind }, heal: 1d10 + level:fighter }
```
````

From that, a character sheet knows to show Second Wind as a Bonus Action with its uses (read from the class table, so it grows with level), roll 1d10 plus the Fighter level and add the result to Hit Points, spend a use, and give one back on a Short Rest and all of them on a Long Rest.

A magic item works the same way. The Staff of Striking fights as a Quarterstaff with +3 to attack and damage, has 10 charges, and lets you spend up to 3 on a melee hit for 1d6 Force damage each:

```yaml
- wield-as: { weapon: quarterstaff }
- bonus: { to: [attack, damage], value: 3, scope: { weapon: { id: self } } }
- charges: { max: 10, recharge: { dice: 1d6 + 4, at: dawn }, destroy-on: { roll: 1d20, if: 1, when: last-charge } }
- trigger: { event: hit, scope: { weapon: { id: self, kind: melee } }, offer: { cost: { charges: { min: 1, max: 3 } }, damage: { dice: "dice(cost.charges, d6)", type: force } } }
```

Equipped and attuned, it shows up as an attack at the right bonus and damage, its charges are tracked, and the extra damage is offered when you hit.

## Where to start

- **Writing content or converting a book:** start with the [cookbook](MODIF_COOKBOOK.md), which pairs common rules phrases with the blocks that express them. [Converting to Modif](CONVERTING_TO_MODIF.md) covers whole books, and [the import prompt](PROMPT_CONVERT_FOR_IMPORT.md) lets an AI assistant draft a pack for you. Check your work with the validator: `python3 tools/modif_check.py <pack folder>`.
- **Building an app that reads Modif:** read §1 (principles), §2 (where effects live), §3 (the shared pieces: values, paths, scopes, conditions) and §4 (the block index), then the section for each block you support. [`tools/modif.schema.json`](../tools/modif.schema.json) is a JSON Schema for every block and field, and `tools/modif_check.py` is the reference validator.

## Blocks first, hand-written code when nothing fits

Modif aims to cover almost everything with its blocks, so an app writes code once per block, never once per feature. For the rare rule no block can express (it appears once or twice in all the content), the `custom` block names a handler the app implements by hand and always carries the rule as text, so an app without that handler still shows it as a reminder (§5.9). When the same pattern turns up about three times, it becomes a proper block and the handler is retired. `wield-as` (0.7) arrived that way.

## Where it comes from

Modif was built from a sort of all 1,088 SRD 5.2.1 character features, a review of D&D Beyond's homebrew forms and stored data, and the D&D Beyond importer for Foundry VTT. Where a D&D Beyond name fits, Modif uses it, so homebrew authors will recognise it. [fivepointfive](../README.md) is the first app that reads it.

The version history, including what each version renamed, is in [MODIF_CHANGES.md](MODIF_CHANGES.md). The spec below describes 0.7 only and is normative: where the cookbook or an app differs, the spec wins.

---

## 1. Principles

1. **Text is for the player; data is for the app.** Rules text is never parsed for rules. If the text says something the data doesn't capture, the importer flags it (see §16); it doesn't guess.
2. **Code per block, never per feature.** Content only combines blocks. If a feature needs something no block can express, that's a request for a new block, which then works for all content. Until it exists, the `custom` escape hatch (§5.9) names a hand-coded handler and always carries the rule as text.
3. **Conditions are data.** "While not wearing armor" is a `when`, not a phrase in a description. Nothing that changes a number may live only in free text.
4. **Situational is a normal result.** A trigger the sheet can't evaluate becomes a **prompt**: a reminder or a button at the right moment. It's still data, never silently dropped.
5. **Everything has an id and a source.** Every effect knows which entry granted it. That gives source labels on every number ("+2 Unarmored Bonus (Bracers of Defense)"), clean removal, and references between entries.
6. **Blocks are the only source of rules.** The app never reads rules out of text, not even as a fallback. An entry with no Effects block (or a heading with none) isn't automated: the sheet shows its text and labels it *not automated*, and the player applies it by hand. To automate something, write a block.

## 2. Where effects live

An entry's effects go in a fenced YAML block under `## Effects`, after the rules text of the feature they belong to. For a class with several features, each `## Level N:` feature gets its own block.

````markdown
### Level 1: Second Wind

You have a limited well of physical and mental stamina…

## Effects
```yaml
- resource: { id: second-wind, max: table:Second Wind, reset: long, partial: { at: short, amount: 1 } }
- action:
    id: second-wind
    activation: bonus
    cost: { resource: second-wind }
    heal: 1d10 + level:fighter
```
````

- An entry with no Effects block still works: players apply the text by hand (principle 6).
- The fence is `yaml`. Each list item is one block. A heading named "Effects" that isn't followed by a `yaml` fence is ordinary rules text.
- Phrasebook bullets (`- +1 AC`) are **not** Modif. Every effect is a block.

### 2.1 Which heading a block belongs to
Put each block under the heading of the feature it comes from, so every heading's data matches its text. A later feature that improves an earlier one gets its own block, usually a `modify` (§14.1).

A heading may appear more than once in an entry (Barbarian has "Improved Brutal Strike" at levels 13 and 17). The importer identifies a feature by its level and heading together, so repeated names are fine.

### 2.2 Reserved words
Never use `on`, `off`, `yes`, `no`, `y`, `n`, `true` or `false` as **keys**. Many YAML parsers turn them into booleans and silently drop the key. The validator rejects them. As values, write `true` and `false` only where a field is a yes/no flag.

### 2.3 Header fields vs. blocks
Facts *about* an entry are header fields (`**Field:** value` lines, as in the format guide), not Effects blocks:

| Header field | Entry types | Example |
|---|---|---|
| `Hit Point Die` | class | `**Hit Point Die:** D10 per Fighter level` (also read as `hit-die`, §5.6) |
| `Creature Type`, `Size`, `Speed` | species | `**Creature Type:** Humanoid` |
| `Category` | feat | `**Category:** Fighting Style` |
| `Repeatable` | feat | `**Repeatable:** yes, distinct choice:mi-list` |
| `Prerequisite` | feat, invocation | `**Prerequisite:** Level 4+` |
| `Parent` | subclass | `**Parent:** Fighter` |
| Tagline (rarity, attunement, base item) | magic item | `*Weapon (Any Simple or Martial), Rare (Requires Attunement)*` |
| Level, school, casting time, range, components, duration | spell | as today |

`Size` and `Speed` header fields are equivalent to `size` and `speed` blocks. Use the header field when the value is fixed; don't repeat it as a block. A size the player picks ("Medium or Small, chosen when you select this species") is a `choose: { kind: size, from: [medium, small] }`.

**A background's `Feat` header with a parenthesis pre-answers the feat's first choice.** `**Feat:** Magic Initiate (Cleric)` grants Magic Initiate with its spell-list choice (`mi-list`) set to `cleric`; the player can't change it. No block is needed.

### 2.4 Run-in traits become headings
SRD text often packs several traits into one feature as run-in bold-italic labels (`***Rage Damage.*** When you…`) or puts a species' traits under one heading. In pack content, each run-in trait that carries rules is written as its own heading one level below its parent, and its Effects block goes under it:

````markdown
### Level 1: Rage
You can imbue yourself with a primal power called Rage…

#### Damage Resistance
You have Resistance to Bludgeoning, Piercing, and Slashing damage.
````

The rule is the same everywhere: one heading, one Effects block. Labels that only organise text ("***Number of Uses.***", "***At Higher Levels.***") stay as they are; their numbers belong to the parent's block. When one block spans several run-ins (Rage's toggle covers four of them), put it under the parent heading.

## 3. Shared building pieces

These pieces appear inside many blocks.

### 3.1 Ids and references
- **Entry ids** come from the existing ID rules (pack id + file id), e.g. `srd/fighter`.
- **Local ids** (`id:` on a block) only need to be unique within the entry: `second-wind`, `rage`, `ancestry`.
- **References** use `$`, followed by an entry id and then a local id after `#`. (`$` rather than `@`, because YAML reserves `@` at the start of a value.) Every reference to another entry or block uses `$`, including in `default`, `parent` and filters.
  - `$srd/fighter#second-wind` refers to that block in another entry.
  - `$#rage` (no entry id) refers to a block in the same entry.
  - `$<pack-id>/<type>/<slug>` refers to an entry in another pack, the same way `$srd/…` refers to the SRD pack: `$phb2024/feats/lucky`. Only the pack id and the entry's slug are used to find it.
- **Ids are stable.** Apps may store a character's choices by entry id and choice id (`<entry id>#<choice id>`), so a later version of a pack must keep its entry and choice ids. Renaming one loses what characters picked.
  - `$srd/spells/hunters-mark` refers to a whole entry.

### 3.2 Values (expressions)
Anywhere a number or dice are expected, a **value** may be:

| Form | Meaning | Example |
|---|---|---|
| number | fixed | `2`, `-1` |
| dice | rolled | `1d8`, `2d6+3` |
| `prof` | Proficiency Bonus | `prof` |
| `mod:<ability>` | ability modifier | `mod:con` |
| `score:<ability>` | ability score | `score:str` |
| `level` / `level:<class>` | character / class level | `level:monk` |
| `table:<column>` | this class's table column at the current level | `table:Martial Arts` |
| `table:<Table>.<column>` | a column of another table in the same entry that's keyed by class level (Yes/No cells read as true/false) | `table:Beast Shapes.Max CR` |
| `choice:<id>` / `choice:<id>.<field>` | value picked in a choice (§7) | `choice:ancestry.damage` |
| `spell-ability` | the spellcasting ability modifier this grant uses | `spell-ability` |
| `steps` | a value that changes at given levels (when the class table has no column for it) | `{ steps: { 2: 1, 17: 2 } }`, `{ steps: { 1: 1d10, 5: 2d10, 11: 3d10, 17: 4d10 }, by: level }` |
| `variant:<id>` | the value of this item's variant (§13) | `variant:plus` |
| `cost.<field>` | the amount actually paid for this use (§9) | `cost.charges` |
| `slot-level` | the level of the spell slot used for this cast | `2 + slot-level` (Disciple of Life) |
| `save-dc:<class>` | a class's save DC, as defined by a `set` (§6.2) | `save-dc:monk` |
| `spell.<field>` | a field of the spell being cast or affected: `level`, `range`, `duration` | `2 * spell.range` (Distant Spell) |
| `target.<field>`, `form.<field>` | the target creature, or the creature form chosen | `target.cr`, `form.hp` (Polymorph) |
| `damage-taken.<field>` | the damage that set off this trigger: `amount`, `type` | `damage-taken.type` |
| `uses` | how many times this block has been used since its counter reset (§3.6) | `10 + 5 * uses` |
| `variant:<id>.<field>` | a field of an object-valued variant (§13) | `variant:level.dc` |
| `score:choice:<id>`, `mod:choice:<id>` | the score or modifier of a chosen ability | `score:choice:boon-asi` |
| unit literal | a number with a unit, for durations and distances | `24 hour`, `1 minute` |
| arithmetic | `+ - * /` (round down), `min()`, `max()`, `half()`, `ceil()` | `max(1, mod:cha)`, `half(level:monk)` |

Abilities are written `str dex con int wis cha`. A leading minus negates any value: `add-roll: "-table:Bardic Die"` (Cutting Words).

**Table columns** are matched ignoring case and punctuation, so `table:Creating Spell Slots.Min Sorcerer Level` finds the column "Min. Sorcerer Level". A subclass reads its parent class's table (`table:Rage Damage` in Path of the Berserker).

**Quote any expression that contains a comma.** Inside `{ … }`, YAML splits at every comma, so `value: max(1, mod:cha)` is silently stored as `"max(1"` plus a stray key. Write `value: "max(1, mod:cha)"`. The validator reports keys that look like the tail of a split expression.

Two function forms combine with arithmetic (quote them, since they contain commas):
- `"steps(2: 1d8, 7: 2d8, 13: 3d8, 18: 4d8) + mod:wis"`, the inline form of `steps`;
- `"dice(max(1, mod:wis), d8)"`, dice whose count is computed (Sear Undead).

`steps` takes the highest key at or below the current level. `by` defaults to the class level for class and subclass entries, and to character level for species, feats and items. Filters in `choose` and scopes also accept `choice:` values (`{ spell: { list: choice:mi-list } }`).

### 3.3 Stat paths (what an effect changes)
A **path** names a number on the sheet.

| Path | Meaning |
|---|---|
| `score:<ab>`, `score-max:<ab>` | ability score, its maximum (normally 20) |
| `save:<ab>` / `save:all` | saving throw |
| `check:<ab>` / `check:all` | ability check |
| `skill:<skill>` | skill (kebab-case: `sleight-of-hand`) |
| `initiative` | |
| `ac` | Armor Class (total) |
| `hp:max`, `hp:per-level` | |
| `speed:<walk|climb|swim|fly|burrow>` | |
| `sense:<darkvision|blindsight|tremorsense|truesight>` | range in feet |
| `passive:<perception|insight|investigation>` | |
| `attack`, `damage` | attack/damage rolls (narrow with a scope, §3.4) |
| `spell:dc`, `spell:attack` | |
| `healing` | HP you restore (narrow with a scope) |
| `attacks-per-action` | Extra Attack |
| `crit-range` | lowest d20 roll that crits |
| `attunement:slots` | normally 3 |
| `death-save` | |
| `concentration` | Constitution save to keep concentration |
| `carry:size` | size used for carrying capacity |
| `range` | a spell's range in feet (narrow with a spell scope) |
| `jump` | jump distance (normally from Strength) |
| `save-dc:<class>` | a class's own save DC (Monk's Focus: 8 + Wis + PB) |
| `damage.ability-mod` | whether the ability modifier is added to damage (`set` to `true`: Two-Weapon Fighting) |

### 3.4 Scopes (which rolls an effect touches)
A `scope` narrows `attack`, `damage`, `healing`, `save`, `check` and `advantage`.

```yaml
scope:
  weapon: { kind: melee|ranged, category: simple|martial, property: [heavy, finesse, light, two-handed, thrown, versatile],
            hands: two, monk: true, unarmed: true, mastery: true, id: longsword, deals: bludgeoning }
  spell:  { list: wizard, school: evocation, level: 0, slot: true, heals: true, deals: fire, range: ">= 10", id: choice:agonizing-cantrip }
  source: $#rage            # only rolls made with this feature/action
  ability: str              # only rolls that use this ability
  against: { condition: poisoned, creature: [fiend, undead], damage: poison, target: marked }
```

`deals` in a weapon scope matches the weapon's damage type (an Unarmed Strike deals Bludgeoning). For "an attack that deals Piercing damage" (Piercer), combine both: `any: [ { weapon: { deals: piercing } }, { spell: { deals: piercing } } ]`.

Spell scopes and filters also take `save: any` (the spell forces a save), `attack: true` (it makes an attack roll: Spell Sniper), `duration: ">= 1 minute"`, `range: touch`, `scales: targets` (it gains targets at higher levels: Twinned Spell), `casting-time: action`, and `slot: available` (a level you have slots for).

**Targets the sheet can't see:** `target: marked` (marked by the entry holding this effect), `target: { marked-by: $srd/spells/hunters-mark }` (marked by another entry: Precise Hunter), `target: grappled-by-you` (Grappler).

**Built-in sources:** `source` takes a feature reference or one of `opportunity-attack`, `light-extra-attack` (the extra attack from the Light property) and `magic` (spells and other magical effects).

An empty scope (`scope: {}`) means any roll. A `modify` that sets it removes an earlier restriction (Deflect Energy).

`mastery: true` means a weapon whose mastery property you can use. `against: { target: marked }` means the creature marked by the feature or spell that holds this effect (Hunter's Mark); the sheet can't see it, so it becomes a note or a prompt.

Fields inside one scope must all match. Use `any: [ … ]` or `all: [ … ]` to combine scopes (Sneak Attack: a Finesse *or* Ranged weapon). A list value means any of those (`property: [finesse, light]` = finesse or light).

A scope whose subject the sheet can't see (`against`) turns the effect into a **note** on that roll instead of a number (§5.4). That reproduces DDB's "to avoid or end the Poisoned condition" line next to saving throws.

### 3.5 Conditions (`when`)
Any block may carry `when`. The effect applies only while it's true.

| Key | Values | Known by the sheet? |
|---|---|---|
| `armor` | `none`, `light`, `medium`, `heavy`, `any`, list | yes, from equipped items |
| `shield` | `true` / `false` | yes |
| `wielding` | a weapon scope (§3.4), `self` (this item), `monk-weapon`, `none`, or a list of these | yes |
| `level` / `level:<class>` | `>= 5` | yes |
| `active` | a toggle reference: `$#rage` | yes, from the toggle's state |
| `hp` | `bloodied` (≤ half), `zero` | yes |
| `equipped` / `attuned` | `true` | automatic for item effects (§13) |
| `choice` | `{ id: land, is: arid }` | yes |
| `condition` | one of your own conditions: `incapacitated`, `prone`… | yes, from the sheet's condition tracker |
| `in-combat` | `true` | yes, once Initiative has been rolled (until combat is ended) |
| `has` | `{ resource: heroic-inspiration, is: 0 }`, `{ item: poisoners-kit }` | yes |
| `speed` | `0` or a comparison | yes |
| `variant` | `{ id: kind, is: agility }` (an item's variant, §13) | yes |
| `rarity` | `">= rare"` or a rarity (an evolving item's stage, §13) | yes, from the item's name |
| `player` | a label: `"In dim light or darkness"` | no: shown as a switch the player sets |
| `all` / `any` / `not` | nested conditions | – |

```yaml
when: { armor: none, shield: false }          # Monk Unarmored Defense
when: { not: { armor: heavy } }                # Fast Movement
when: { active: $#rage }                       # Rage benefits
when: { player: "In dim light or darkness" }   # Boon of the Night Spirit
when: { not: { condition: incapacitated } }    # Evasion, Elusive
```

### 3.6 Frequency and duration
- `per: turn | round | roll | short | long | dawn` limits how often something happens ("once per turn": `per: turn`; "no more than once per roll": `per: roll`).
- `duration: { amount: 10, unit: minute|hour|round|turn|day, until: end-of-turn|start-of-next-turn|end-of-next-turn, concentration: true }`. `end-of-turn` means the end of the current turn.
- `duration.extend` (a prompt saying how to keep it going) and `duration.max` (the cap): Rage lasts `until: end-of-next-turn`, extendable, `max: { amount: 10, unit: minute }`.
- `per: { until: start-of-next-turn }` ("once until the start of your next turn": Peerless Aim).
- On an `action` with no `cost`, `per: short | long | dawn` gives it a use counter of its own (one use, regained on that rest): "Once you use this feature, you can't use it again until you finish a Long Rest" is just `per: long`.

**Per-use counters.** Some features get harder or costlier each time they're used before a rest. Any block may carry `counter: { reset: short | long }`; `uses` in its values is the number of uses since the reset (0 the first time).
```yaml
- trigger: { event: zero-hp, counter: { reset: short }, dc: 10 + 5 * uses, … }                       # Relentless Rage
- trigger: { event: cast, counter: { reset: long },
             offer: { maximize: true, self-damage: { if: "uses >= 1", dice: "dice((uses + 1) * slot-level, d12)", … } } }   # Overchannel
```

### 3.7 Levels
Any block may carry `level` (available from that level) or `at` (granted again at each listed level):
```yaml
- choose: { id: asi, kind: feat, from: { feat: { qualify: true } }, at: [4, 6, 8, 12, 14, 16] }   # one heading, six picks
- toggle: { id: draconic-flight, level: 5, … }                                               # from character level 5
```
`level` is shorthand for `when: { level: ">= N" }`, using the same class/character rule as `steps`. `at: new-slot-level` means "each time you gain a new level of spell slots in this class" (Evocation Savant).

### 3.8 Activation
`activation` (on `action`, `toggle`, `form`) takes one of:

| Value | Meaning |
|---|---|
| `action`, `bonus`, `reaction`, `magic` | the 2024 action types |
| `none` | no action required |
| `replace-attack` | replaces one attack of the Attack action (Breath Weapon) |
| `attack-action` | as part of taking the Attack action (Sacred Weapon) |
| `forgo-attack` | give up one attack of the Attack action (ending Quivering Palm) |
| `start-of-turn` | at the start of your turn (Superior Defense) |
| `{ amount, unit }` | takes that long (`{ amount: 10, unit: minute }`: Rock Gnome's clockwork device) |
| a list | any of these (`[action, forgo-attack]`) |

---

## 4. Block index

| # | Group | Blocks | DDB equivalent |
|---|---|---|---|
| 5 | Always-on grants | `proficiency`, `expertise`, `half-proficiency`, `mastery`, `language`, `sense`, `speed`, `defense`, `size`, `note`, `trait` | modifier types proficiency, expertise, half-proficiency, language, sense/set-base, resistance/immunity/vulnerability |
| 5.6 | Class plumbing | `hit-die`, `multiclass`, `equipment` | Core traits table, "As a Multiclass Character", starting-equipment slots |
| 6 | Numbers | `bonus`, `set`, `base`, `advantage`, `disadvantage`, `crit-range`, `extra-attack`, `damage-die`, `use-ability`, `damage-type`, `ignore-resistance`, `score`, `score-max` | bonus, stacking-bonus, set, set-base, advantage, disadvantage, ignore, replace-damage-type |
| 6.8 | Roll rules | `roll-floor`, `die-floor`, `maximize`, `reroll`, `save-rule` | (none: DDB hand-codes these) |
| 7 | Choices | `choose`, `option` (§7.1) | choices types 2/3/4/6, options, `parentChoiceId` |
| 8 | Resources | `resource`, `convert` | limited-use (number of uses, operator, stat modifier, proficiency bonus, reset) |
| 9 | Actions | `action` (with `give`, §9.1), `remove-condition` | Actions form (31 fields) |
| 10 | Toggles | `toggle` | (DDB has none; it hand-codes them) |
| 10.1 | Areas | `aura`, `zone` | (DDB has none) |
| 20 | Equipment and rules | `weapon-property`, `weapon-rule`, `container`, `craft`, `auto-fail`, `breaks-concentration`, `rest`, `poison`, `condition`, `narrative` | weapon/armor tables, conditions |
| 11 | Spells | `grant-spell`, `spell-list`, `spellcasting` | Spells form, Spell Mapping |
| 12 | Creatures | `form`, `summon` | Creatures form |
| 13 | Items | item header fields, `wield-as`, `charges`, `variant`, `curse`, `limit`, `cast-list`, `suppress` | magic item form, charges |
| 14 | Patches | `modify`, `replace` | optional class features (Feature Type: Replacement) |
| 15 | Triggers | `trigger` | (DDB has none) |
| 5.9 | Escape hatch | `custom` | (DDB hand-codes these) |

---

## 5. Always-on grants

### 5.1 `proficiency`, `expertise`, `half-proficiency`
```yaml
- proficiency: [save:str, save:con]
- proficiency: [weapon:simple, weapon:martial, armor:light, armor:medium, armor:heavy, armor:shield]
- proficiency: [tool:thieves-tools, skill:stealth]
- expertise: [skill:stealth]
- half-proficiency: { scope: check:all, unless: proficient }    # Jack of All Trades
```
Targets: `skill:*`, `save:*`, `tool:*`, `weapon:<category|id|property:x>`, `armor:<light|medium|heavy|shield>`. A target can also be a weapon scope: `{ weapon: { category: martial, property: [finesse, light] } }`. A saving throw picked by a choice is `{ save: choice:<id> }` (Resilient: the save of the ability it increased). Picking from a list is a `choose` (§7) whose result is a proficiency.

**`mastery`** grants the mastery property of the listed weapons (the property itself comes from the weapon table): `mastery: [longsword]`. A Weapon Mastery feature is a `choose` with `grants: mastery`.

### 5.2 `language`
```yaml
- language: [common, druidic]
```

### 5.3 `sense`, `speed`, `size`
```yaml
- sense: { darkvision: 120 }                 # highest wins, doesn't add (DDB set-base)
- sense: { devils-sight: 120 }               # see normally in magical and nonmagical darkness (DDB devils-sight)
- sense: { telepathy: 60 }                    # speak telepathically to a creature you can see (Telepathic)
- speed: { walk: 30 }                        # base speed
- speed: { climb: speed:walk, swim: speed:walk }   # equal to walking speed
- size: medium                               # or { choose: [small, medium] }
- size: +1                                   # one category larger (Enlarge); -1 for smaller
```
A speed *increase* is a `bonus` to `speed:walk` (§6.1).

### 5.4 `defense`
```yaml
- defense: { resistance: [bludgeoning, piercing, slashing] }
- defense: { immunity: [poison], condition-immunity: [poisoned, charmed] }
- defense: { resistance: choice:ancestry.damage }
- defense: { resistance: all, except: [psychic, radiant] }
- defense: { immunity: { spell: $srd/spells/magic-missile } }    # Shield; shown as a note
- defense: { condition-immunity: [magical-sleep] }               # Trance
```
Besides the 15 conditions, `condition-immunity` accepts the pseudo-condition `magical-sleep` ("magic can't put you to sleep").

**`condition: [frightened]`** is a block meaning the affected creature has that condition while the effect lasts (Hallow's Fear, Heavily Obscured → Blinded, Unconscious → Incapacitated and Prone). The conditions themselves are entries with blocks (§20.3).

### 5.5 `note`
Text attached to a stat. Shown next to it, never calculated. Used for anything the sheet can't see.
```yaml
- note: { stat: save:all, text: "Advantage to avoid or end the Poisoned condition" }
```
Prefer `advantage` with an `against` scope (§6.3), which produces the same note automatically and keeps the data structured.

### 5.9 `custom`: hand-coded mechanics
For a rule that no block can express and that only appears once or twice. It names a handler the app implements in code, passes it plain data, and always carries the rule as `text`:
```yaml
- custom: { handler: use-magic-device, params: { ability: int, check: { skill: arcana, from-level: 2 } },
            text: "Any Spell Scroll: Intelligence is your spellcasting ability; a level 2+ spell needs an Intelligence (Arcana) check (DC 10 + spell level) first, and on a failure the scroll disintegrates." }
```
- `handler` (required): the handler's name. The validator checks it against the handlers the app has.
- `params`: the handler's own data. Modif doesn't check what's inside.
- `text` (required): the rule in words. An app that doesn't have the handler shows it as a reminder, the same as `note`, so a pack with `custom` blocks still works everywhere.

**When to use it.** Write blocks whenever the blocks can say it, even if the result is a little longer. Use `custom` only when nothing in this spec fits, and say in the conversion report which handler is needed.

**When it becomes a block.** Once the same pattern turns up about three times (in the SRD, homebrew or monsters), it gets a proper block in the next Modif version and the handler is retired. Each handler records what Modif would need to replace it, and its test pins what it does to the sheet, so the swap can be checked.

Handlers in fivepointfive (`src/lib/custom/`, one file each):

| Handler | Used by | What it does | What would replace it |
|---|---|---|---|
| `use-magic-device` | Thief, Use Magic Device | Any Spell Scroll can be read, with the given ability; from `from-level` up, a check (DC 10 + spell level) first, and a failure destroys the scroll. | A way for a feature to change another item's action (waive `requires: spell-on-list`, set the ability, replace its `check`). |
| `thiefs-reflexes` | Thief, Thief's Reflexes | The Initiative roll shows the second turn's number (Initiative + `offset`). | An `extra-turn` block. |

### 5.6 Class plumbing: `hit-die`, `multiclass`, `equipment`
These sit under a class's core traits heading.
```yaml
- hit-die: d10
- multiclass: [hit-die, weapon:martial, armor:light, armor:medium, armor:shield]       # what a multiclass character gets
- multiclass: [hit-die, armor:light, tool:thieves-tools, { choose: { kind: skill, count: 1, from: $#skills } }]
- equipment:
    options:
      - { id: a, items: [chain-mail, greatsword, flail, { javelin: 8 }, dungeoneers-pack], gp: 4 }
      - { id: b, items: [studded-leather-armor, scimitar, shortsword, longbow, { arrows: 20 }, quiver, dungeoneers-pack], gp: 11 }
      - { id: c, gp: 155 }
```
- `multiclass` lists the grants (by target or local reference) a character gets when this class isn't their first. Anything not listed is first-class only.
- `equipment` options are the "Choose A, B or C" bundles. Items are catalog ids, with a quantity where it isn't 1. An item can also be a filter, such as `{ choose: { weapon: { category: simple } } }`.
- Backgrounds use the same `equipment` block.

### 5.7 `trait`
Abilities with no number attached, shown in the features list. The sheet can use them in a few places (Trance means no sleep is needed).
```yaml
- trait: [breathe-underwater]        # Gift of the Depths
- trait: [no-sleep, immune-magical-sleep, trance]   # Trance (4-hour Long Rest)
```
The importer keeps a short list of known traits and warns on unknown ones, so near-duplicates don't creep in. A one-off ability can be a trait with text: `trait: { text: "You can move through the space of any creature a size larger than you." }`.

### 5.8 `narrative`
`- narrative: true` marks an entry or heading whose rules have nothing for a sheet to track: Knock, Legend Lore, Mending, Bag of Devouring, Manual of Golems. It's different from having no block: it records that someone looked. 71 SRD spells and items are narrative-only. Their header fields (casting time, range, duration, rarity) are still data.

**Light** is a field of `trait`: `trait: { light: { bright: 20, dim: 20 } }` (Sacred Weapon, Flame Tongue); `bright: sunlight` for sunlight (Holy Nimbus).

---

## 6. Numbers

### 6.1 `bonus`
Adds to a stat. Bonuses from different sources add together. Two copies of the *same* entry don't stack (5e's same-name rule).
```yaml
- bonus: { to: ac, value: 1, when: { armor: [light, medium, heavy] } }          # Defense
- bonus: { to: attack, value: 2, scope: { weapon: { kind: ranged } } }          # Archery
- bonus: { to: damage, value: mod:wis, scope: { spell: { list: druid, level: 0 } } }   # Potent Spellcasting
- bonus: { to: damage, value: table:Rage Damage, scope: { ability: str }, when: { active: $#rage } }
- bonus: { to: speed:walk, value: 10, when: { not: { armor: heavy } } }
- bonus: { to: initiative, value: prof }                                         # Alert
- bonus: { to: hp:per-level, value: 1 }                                          # Dwarven Toughness
- bonus: { to: ac, value: 2, when: { armor: none, shield: false } }               # Bracers of Defense (as written)
```
Fields:
- `to` (path), `value`, `scope`, `when`;
- `once: true`: add to only one roll of the effect (Empowered Evocation's "one damage roll");
- `type: <name>`: bonuses with the same type don't stack, and only the highest counts;
- `also-current: true`: raising `hp:max` raises current HP by the same amount (Aid).

### 6.2 `set` and `base`
- **`set`** makes a stat equal to a value. `mode` says how:
  - `if-higher` (default, DDB `set`): only if the stat would otherwise be lower (Belt of Giant Strength).
  - `min`: a floor ("AC can't be less than 16").
  - `override`: replaces the stat even if that lowers it (Steady Aim: Speed 0).
  - `multiply`: multiplies the stat by the value (Haste: `value: 2`; Spirit Guardians: `value: 0.5`; Step of the Wind's jump: `to: jump, value: 2`).
- **`base`** offers an alternative way to calculate a base value. The sheet uses the best one available (DDB `set unarmored-armor-class`, `set-base`).
```yaml
- set: { to: score:str, value: 21 }
- base: { to: ac, value: 10 + mod:dex + mod:con, when: { armor: none }, allow-shield: true }   # Barbarian
- base: { to: ac, value: 10 + mod:dex + mod:wis, when: { armor: none, shield: false } }        # Monk
- base: { to: ac, value: 13 + mod:dex, when: { armor: none } }                                 # Mage Armor (inside a toggle)
- set: { to: ac, value: 16, mode: min }        # "AC can't be less than 16" (Barkskin-style floor)
- set: { to: speed:all, value: 0, mode: override }   # Steady Aim, until the end of the turn
```

### 6.3 `advantage`, `disadvantage`
```yaml
- advantage: { roll: [check:str, save:str], when: { active: $#rage } }
- advantage: { roll: save:dex }                                     # Danger Sense
- advantage: { roll: initiative }
- advantage: { roll: save:all, scope: { against: { condition: poisoned } } }   # becomes a note
- advantage: { roll: death-save }
- cancel-advantage: { roll: attacks-against-you }                   # Elusive
```

### 6.4 `crit-range`, `extra-attack`
```yaml
- crit-range: { value: 19, scope: { any: [ { weapon: {} }, { weapon: { unarmed: true } } ] } }   # lowest roll wins across sources
- extra-attack: { total: 2 }                                        # highest wins; does not add
- extra-attack: { total: 2, scope: { weapon: { id: choice:pact-weapon } } }   # Thirsting Blade: only with that weapon
```

### 6.5 `damage-die`, `use-ability`, `damage-type`, `ignore-resistance`
```yaml
- damage-die: { die: table:Martial Arts, scope: { any: [ { weapon: { monk: true } }, { weapon: { unarmed: true } } ] }, if-higher: true }
- damage-die: { die: 1d8, type: slashing, scope: { weapon: { unarmed: true } } }   # Demon Armor: new die and damage type
- use-ability: { ability: dex, instead-of: str, scope: { any: [ { weapon: { monk: true } }, { weapon: { unarmed: true } } ] } }  # player may pick the best
- use-ability: { ability: cha, for: attack, scope: { source: $#sacred-weapon } }
- damage-type: { add-option: force, scope: { weapon: { unarmed: true } } }                            # Empowered Strikes
- ignore-resistance: { damage: [bludgeoning, piercing, slashing] }                                   # Overcome Defenses
```

### 6.6 `score`, `score-max`
Ability score changes made at build time.
```yaml
- score: { cha: 1 }
- score: { str: 4, con: 4, max: 25 }              # Primal Champion: raises the maximum too
- score-max: { all: 30 }                          # Epic Boons ("to a maximum of 30")
```
A player-chosen increase is a `choose` of kind `ability` (§7).

### 6.7 Order of operations for ability scores
1. Base score (point buy, array or rolled) + background and species increases.
2. `score` increases from features, feats and items, capped at `score-max` (default 20, raised by any `max`).
3. Manual adjustments the player enters "ignoring the cap".
4. `set` effects apply if higher.
5. A manual override replaces everything.

This matches DDB's order, as reconstructed from the Foundry importer.

### 6.8 Roll rules
```yaml
- roll-floor: { roll: check:all, min: 10, when-proficient: true }      # Reliable Talent (d20 of 9 or lower counts as 10)
- roll-floor: { roll: [check:str, save:str], total-min: score:str }   # Indomitable Might
- die-floor: { min: 3, scope: { weapon: { kind: melee, hands: two } } }   # Great Weapon Fighting (1–2 count as 3)
- maximize: { scope: { healing: true, spell: { slot: true } } }     # Supreme Healing
- reroll: { roll: d20, if: 1, must-use-new: true }                    # Halfling Luck (the sheet can do it automatically)
- save-rule: { ability: dex, success: none, failure: half }         # Evasion
- save-rule: { scope: { spell: { level: 0 } }, success: half, miss: half }   # Potent Cantrip (also on a missed attack)
- reroll: { roll: damage, dice: "max(1, mod:cha)", must-use-new: true }   # Empowered Spell: reroll some damage dice
- reroll: { roll: damage, keep: either }                                 # Savage Attacker: roll twice, use either
- treat-roll: { roll: death-save, range: [18, 20], as: 20 }           # Defy Death
```

---

## 7. Choices: `choose`

A choice is a slot the player fills at build time (or on a rest). Its answer can be used anywhere through `choice:<id>`.

```yaml
- choose:
    id: skills
    kind: skill                     # skill | tool | language | ability | option | feat | subclass | spell | weapon | equipment | damage-type | size | item, or a list
    count: 2
    from: [acrobatics, animal-handling, athletics, history, insight, intimidation, persuasion, perception, survival]
    grants: proficiency             # what each pick becomes (for skill/tool/language/weapon)
```

Fields:
- `id`, `kind`, `count` (a value, so `table:Weapon Mastery` works), `from`;
- `grants` (what each pick becomes);
- `swap: level-up | short | long`, or `{ at: level-up | short | long, count: 1 | all }` ("change one of those choices");
- `default` (a suggestion, never auto-applied);
- `limit: { per: cast, count: 1 }` for option groups used together (one Metamagic option per spell; §15 `group`);
- `at: [levels]` / `level` (§3.7).

Repeatable feats are a header field (§2.3), not a field of `choose`.

**`from` can be:**
- **A list:** `[str, dex]`.
- **`any`.**
- **A filter:**
  - `{ feat: { category: fighting-style } }`;
  - `{ spell: { list: [cleric, druid, wizard], level: 1, school: [divination, enchantment], ritual: true } }`;
  - `{ weapon: { category: [simple, martial] } }`;
  - `{ subclass: { parent: $srd/fighter } }`;
  - `{ tool: { category: musical-instrument | artisans-tools | gaming-set } }`;
  - **the character's own state:** `{ proficient: skill }`, `{ proficient: skill, not: expertise }` ("a skill you're proficient in but lack Expertise in"), `{ proficient: weapon }`, `{ known: spell, level: 1 }`.
  Filters are evaluated live, so homebrew that matches appears automatically (DDB did this with Sniper's Mark). Filter values may be `choice:` references, comparisons (`level: "<= 5"`) and `not` (`casting-time: { not: reaction }`).
- **Options defined right here:**

```yaml
- choose:
    id: ancestry
    kind: option
    options:
      - { id: black, label: Black, damage: acid }
      - { id: red,   label: Red,   damage: fire }
      - { id: gold,  label: Gold,  damage: fire }
      # …
- defense: { resistance: choice:ancestry.damage }
```

An option may carry its own effects:
```yaml
- choose:
    id: order
    kind: option
    options:
      - id: protector
        effects:
          - proficiency: [weapon:martial, armor:heavy]
      - id: thaumaturge
        effects:
          - grant-spell: { choose: { count: 1, from: { spell: { list: cleric, level: 0 } } } }
          - bonus: { to: [skill:arcana, skill:religion], value: "max(1, mod:wis)" }
```

**Rules:**
- **Nesting:** a choice inside an option belongs to that option (DDB `parentChoiceId`). Removing the option removes everything chosen under it.
- **No duplicates:** the same option can't be picked twice across choices that offer it (DDB blocks a second Wisdom across two Fey Touched). Spell picks may repeat unless `distinct: true`.
- **`kind: ability`** is a *pick* of an ability (Magic Initiate's spellcasting ability: `from: [int, wis, cha]`). Adding `amounts` makes it an *increase*: `amounts: [2]` or `[1, 1]` (ASI), `from: [int, wis, cha], amounts: [1], max: 20` (half-feats). Either way, `choice:<id>` is the picked ability.
- **Choices at use time** aren't `choose`. A choice made each time you use something is `choose-on-use` inside the action (§9).
- **Unfilled choices** show "No choice made" and apply nothing.
- **`kind: item`** picks one of the character's inventory items matching the filter (Pact of the Blade's weapon). `swap: { at: use }` lets the player re-pick it whenever the feature is used.
- **Filters over spells you know:** `from: { known: { spell: { list: warlock, level: 0, deals: any } } }`.
- **`swap.at`** may be a list: `{ at: [short, long], count: all }` (Fiendish Resilience, Pact of the Tome).
- **Damage types:** `kind: damage-type, from: { not: [force] }` means any type except Force.
- **Several kinds:** `kind: [skill, tool]` picks any mix (Skilled).
- **A choice of amounts:** `amounts: { choose-one: [[2], [1, 1]] }` (Ability Score Improvement: +2 to one, or +1 to two).
- **Proficiency or Expertise:** `grants: proficiency-or-expertise` gives proficiency, or Expertise if the character already has the proficiency (Keen Mind, Observant).
- **What a picked spell becomes:** `grants: { prepared: always, counts-as: bard }` (Magical Discoveries); `grants: spellbook` adds it to a spellbook (§11.3).
- **`from` and `options` together:** the pool is both (Fighting Style: any fighting-style feat, or the class's Blessed Warrior option).

### 7.1 Options under their own headings (invocations, maneuvers, metamagic)
When a class lists its options as separate headings with their own text (Eldritch Invocation Options), the choice points at those headings, and each heading declares itself an option:

```yaml
# under "Level 1: Eldritch Invocations"
- choose: { id: invocations, kind: option, count: table:Eldritch Invocations, swap: { at: level-up, count: 1 },
            options: { headings-under: Eldritch Invocation Options } }

# under "### Eldritch Smite"
- option: { of: $#invocations, prerequisite: { level: 5, has: { option: $#pact-of-the-blade } } }
- trigger: { event: hit, per: turn, … }

# under "### Agonizing Blast"
- option: { of: $#invocations, prerequisite: { level: 2, known: { spell: { list: warlock, level: 0, deals: any } } },
            repeatable: { distinct: choice:agonizing-cantrip } }
- choose: { id: agonizing-cantrip, kind: spell, count: 1, from: { known: { spell: { list: warlock, level: 0, deals: any } } } }
- bonus: { to: damage, value: mod:cha, scope: { spell: { id: choice:agonizing-cantrip } } }
```

- An option heading's **id** is its slug (`pact-of-the-blade`), so other options can name it in prerequisites.
- The option's other blocks apply only while that option is picked.

**`prerequisite`** (used by options, and by feats in structured form):

| Key | Meaning | Example |
|---|---|---|
| `level` | class level (for class options) or character level (feats) | `level: 5` |
| `has` | another option, feat, feature or proficiency | `has: { option: $#pact-of-the-blade }`, `has: { proficiency: armor:medium }` |
| `known` | a spell you know or have prepared that matches a filter | `known: { spell: { list: warlock, level: 0, deals: any } }` |
| `score` | an ability score minimum | `score: { str: 13 }` |
| `species`, `class` | being of a species or class | `class: $srd/wizard` |
| `not` | the reverse (DDB's "exclude") | `not: { has: { feat: $srd/feats/… } }` |

The builder greys out options whose prerequisites aren't met and, like DDB, won't let you remove an option that another of your options requires.

**`repeatable`:** `true`, or `{ distinct: choice:<id> }` (each copy must pick something different).

---

## 8. Resources

### 8.1 `resource`
A pool of uses or points.
```yaml
- resource: { id: rage, max: table:Rages, reset: long, partial: { at: short, amount: 1 } }
- resource: { id: bardic-inspiration, max: "max(1, mod:cha)", reset: long, die: table:Bardic Die }
- resource: { id: focus, max: level:monk, reset: short, label: Focus Points }
- resource: { id: lay-on-hands, max: 5 * level:paladin, reset: long, unit: hp }
- resource: { id: stonecunning, max: prof, reset: long }
- resource: { id: luck, max: 1, reset: long, regain: { event: initiative, to: 2 } }   # e.g. Superior Inspiration
- resource: { id: boots, max: 10, unit: minute, reset: long, spend: while-active }      # Boots of Speed: a time budget
- resource: { id: absorbed, max: 50, reset: never, lifetime: true, start: 1d10 }       # Rod of Absorption
- resource: { id: improve-fate, max: 1, reset: [short, long, initiative] }              # Boon of Fate
```
Fields:
- `id`, `max` (value), `reset: short | long | dawn | initiative | never` (or a list), `partial`;
- `spend: while-active`: with a `unit` of time, the pool runs down while its toggle is on;
- `lifetime: true`: `max` counts everything ever added, not the current amount; `start`: the starting amount, if not `max`;
- `regain: { event: <event>, amount | to }`;
- `die` (for dice pools), `unit`, `label`.

DDB's uses formula (`base`, `+/×` ability modifier, `+/×` Proficiency Bonus) is just a value here: `max: 1 + mod:cha`. Uses that change at a level with no table column use `steps`: `max: { steps: { 2: 1, 17: 2 } }` (Action Surge).

### 8.2 `convert`
```yaml
- convert: { from: { slot: any }, to: { resource: sorcery-points, amount: slot-level }, activation: none }
- convert: { from: { resource: sorcery-points, amount: table:Creating Spell Slots }, to: { slot: chosen }, activation: bonus }
- convert: { from: { slot: any, per: turn }, to: { resource: wild-shape, amount: 1 }, if-empty: true }   # Wild Resurgence
- convert: { from: { resource: $srd/barbarian#rages, amount: 1 }, to: { resource: $#intimidating-presence, amount: 1 },
             activation: none, if-empty: true }                                                          # restore a once-per-rest use
```
`to` may carry `max-slot`, `min-level` (a table value) and `expires: long` (created slots vanish on a Long Rest: Font of Magic). `regain: { to: 2 }` never lowers a pool that's already higher.

### 8.3 Built-in resources
The sheet always has these. Entries can refer to them without defining them:

| Id | What it is |
|---|---|
| `heroic-inspiration` | 0 or 1 |
| `hit-dice` | pooled by die size (multiclass) |
| `spell-slots` | by level; `pact-slots` for Pact Magic |
| `death-saves` | successes / failures |
| `exhaustion` | level 0–6 |
| `charges` | on an item, defined by its `charges` block (§13) |

---

## 9. Actions: `action`

Anything the player clicks to use.
```yaml
- action:
    id: breath-weapon
    activation: replace-attack      # see §3.8
    cost: { resource: $#breath }
    area: { choose-on-use: [ { shape: cone, size: 15 }, { shape: line, size: 30, width: 5 } ] }
    save: { ability: dex, dc: 8 + mod:con + prof, success: half }
    damage: { dice: { steps: { 1: 1d10, 5: 2d10, 11: 3d10, 17: 4d10 }, by: level }, type: choice:ancestry.damage }
```
Fields:
- **activation and cost:** `activation`, `cost` (`{ resource, amount }` or `{ slot: n }`), `per`;
- **targeting:** `range: self | touch | <feet> | <feet>/<feet>`, `area: { shape: sphere|cube|cone|line|cylinder|emanation, size, width }`, `targets: { count, creature: <type>, condition: bloodied, choose: true, include-self: true }`;
- **rolls:** `attack: { ability, proficient: true, kind: melee|ranged|spell }`, `save: { ability, dc, success: half|none|special }`;
- **effects:** `damage: [{ dice, type }]` (several parts allowed), `heal`, `temp-hp`;
- **conditions:** `apply: { condition: <one or a list>, duration, save-ends: end-of-turn, ends-when: [damage], text, effects }` (`effects` for anything that isn't a condition: Superior Hunter's Defense gives `{ defense: { resistance: [damage-taken.type] } }` until the end of the turn);
- **damage options:** a damage part may carry `applies-to: failed-save` (Sear Undead: only creatures that failed the save take it);
- **standard actions and checks:** `take: <action>` (or a list: `take: [disengage, dodge]`, Patient Defense) uses one of the 2024 actions (`attack`, `dash`, `disengage`, `dodge`, `help`, `hide`, `influence`, `magic`, `ready`, `search`, `study`, `utilize`); `check: skill:<x>` rolls a check;
- **casting:** `cast: $<spell>` casts a spell (from an item or feature), or `cast: { choose-on-use: <spell filter> }` lets the player pick the spell at the moment (Divine Intervention); `cast-at: <value>` sets its level; `cast-options: { slot: false, material: false }` casts it without a slot or Material components;
- **items:** `consume: true` uses the item up;
- **recovery:** `regain: { resource, amount | to | levels, max-slot }` (Magical Cunning; Natural Recovery recovers slots whose levels add up to `levels`, none above `max-slot`);
- **requirements:** `requires: { item: <id or category> }` greys the action out unless you carry it;
- **choices each use:** `choose-one: [ … ]` (pick one of several effects) and `choose-on-use: [ … ]` on any field (pick the area shape each time). Give each `choose-one` item an `id` so a `modify` can address it (§14);
- **outcomes:** `on-success` / `on-failure` hold what happens on each result of the `save` (Stunning Strike); `then` holds a follow-up step (`{ if, cost, save, apply, damage }`), as in Sleep's second save;
- **conditions removed:** `effects: [ { remove-condition: [poisoned] } ]` (Lay On Hands); with `pick: any` and `cost: { …, per-pick: true }` the player pays per condition (Restoring Touch);
- **targets:** `targets.repeat: true` lets the same creature be picked more than once (Magic Missile darts) and `damage.per-target: true` rolls for each pick;
- **ability and overrides:** `ability: spell-ability` (an item cast with your own ability: Staff of Healing), `overrides: { dc, attack, components.material }` (Spell Scroll), `use-ability` and `damage-type` with the same meaning as the blocks (§6.5) but for this action only (True Strike), `auto-succeed: { creature: … }` (creatures that pass automatically);
- **limits:** `limit: 3` ("you can have three at a time"); `apply.limit: 1` (only one creature affected at a time: Quivering Palm);
- **other:** `move: { distance, no-opportunity-attacks: true }`, `duration`, `text` (shown on the button, for anything else), `effects` (self effects while it lasts; with a duration this behaves like a toggle).

**Costs:**
- `{ resource: $#id, amount: 1 }`, `{ slot: n }` or `{ charges: n }`;
- a range the player picks: `{ charges: { min: 1, max: 3 } }`;
- dice taken from another roll: `{ dice-from: $#sneak-attack, count: 1 }`;
- **alternatives** the player picks between: `{ any: [ { slot: any }, { resource: $#wild-shape } ] }` (Wild Companion);
- a lockout after a particular use: `lockout: { if-cast: $srd/spells/wish, long-rests: 2d4 }` (Greater Divine Intervention: the feature can't be used again until that many Long Rests pass).

The amount actually paid is available as `cost.<field>`: `cast-at: cost.charges`.

```yaml
- action: { id: second-wind, activation: bonus, cost: { resource: $#second-wind }, heal: 1d10 + level:fighter }
- action: { id: cunning-action, activation: bonus, choose-one: [ { take: dash }, { take: disengage }, { take: hide } ] }
- action: { activation: magic, cast: $srd/spells/magic-missile, cost: { charges: { min: 1, max: 3 } }, cast-at: cost.charges }
- action: { id: divine-spark, activation: magic, range: 30, cost: { resource: $srd/cleric#channel-divinity },
            choose-one: [ { heal: "steps(2: 1d8, 7: 2d8, 13: 3d8, 18: 4d8) + mod:wis" },
                          { save: { ability: con, dc: spell:dc, success: half },
                            damage: { dice: "steps(2: 1d8, 7: 2d8, 13: 3d8, 18: 4d8) + mod:wis", type: { choose-on-use: [necrotic, radiant] } } } ] }
```

### 9.1 `give`: something another creature holds
Some features hand a resource to another creature, which uses it later on its own roll. `give` on an action describes what the recipient holds:
```yaml
- action:
    id: bardic-inspiration
    activation: bonus
    cost: { resource: $#bardic-inspiration }
    range: 60
    targets: { count: 1, creature: other }
    give:
      die: table:Bardic Die
      limit: 1                                  # a creature can hold only one
      duration: { amount: 1, unit: hour }
      use: { event: { fail: d20 }, offer: { add-roll: table:Bardic Die } }   # a trigger, run on the holder's sheet
```
If the recipient is a party member whose sheet the app can see, the held die appears on their sheet with a button at the right moment. Otherwise the giver's sheet tracks it as a note ("Bardic Inspiration given to Rook, 1 hour").

---

## 10. Toggles: `toggle`

Switch on, get a set of effects, switch off. This covers Rage, Innate Sorcery, Dragon Wings, Large Form, Holy Nimbus and self-buff spells.
```yaml
- toggle:
    id: rage
    activation: bonus
    cost: { resource: $#rages }
    duration: { until: end-of-next-turn, extend: "attack or force a save each turn" }   # extension is a prompt
    ends-when: [{ armor: heavy }, { condition: incapacitated }]
    blocks: [concentration, spellcasting]
    effects:
      - defense: { resistance: [bludgeoning, piercing, slashing] }
      - bonus: { to: damage, value: table:Rage Damage, scope: { ability: str } }
      - advantage: { roll: [check:str, save:str] }
```
A toggle also takes `choose` (a pick made when it's switched on: Sacred Weapon's weapon) and `move` (movement as part of switching it on: Instinctive Pounce).

Effects listed inside a toggle need no `when: { active: ... }`; it's implied. Other entries refer to the toggle with `when: { active: $srd/barbarian#rage }` (Mindless Rage, Frenzy).

### 10.1 Auras and zones: `aura`, `zone`
An **aura** is an area centred on you that moves with you. Its effects reach you and the others it names.
```yaml
- aura:
    id: aura-of-protection
    area: { shape: emanation, size: 10 }
    affects: [self, allies]             # self | allies | enemies | all
    inactive-when: [{ condition: incapacitated }]
    stacking: one-per-type              # a creature benefits from only one aura of this id at a time
    effects:
      - bonus: { to: save:all, value: "max(1, mod:cha)" }
- modify: { target: $#aura-of-protection, add: { effects: [ { defense: { condition-immunity: [frightened] } } ] } }   # Aura of Courage
- modify: { target: $#aura-of-protection, set: { area.size: 30 } }                                                  # Aura Expansion
```
Effects on `self` apply to your sheet. Effects on others show as a party note, or on their sheets when the app can see them. A trigger inside an aura runs on the creature it affects: Holy Nimbus adds `{ trigger: { event: start-of-turn, who: { creature: enemy }, … } }`. An aura can sit in a toggle (Holy Nimbus), a spell (Spirit Guardians, with `event: enter-area`) or an item (Holy Avenger, `when: { wielding: self }`).

A **zone** stays where it was created:
```yaml
- zone: { side: one, reach: 10, event: [enter-area, end-of-turn], per: turn, damage: { dice: 5d8, type: fire } }   # Wall of Fire
```
`zone` fields: `area`, `side`, `reach`, `event`, `per`, `save`, `damage`, `apply`, `effects`, plus the outcome fields of `action` (`choose`, `choose-one`, `if`, `then`, `on-success`, `on-failure`, `heal`), `affects`, `moves`, `by-turn`, `ends-after` and `table`.

Zone events: `cast` (when it appears), `enter-area`, `start-of-turn`, `end-of-turn`, `moved-into` (the zone moves into a creature), `move-within` (Spike Growth: `damage.per: 5 feet`), `move-through` (a wall's sheet of frigid air).
```yaml
- zone: { area: { shape: sphere, size: 20 }, event: [cast, enter-area, end-of-turn, moved-into], per: turn,
          save: { ability: con, success: half }, damage: { dice: 5d8, type: poison },
          moves: { distance: 10, at: start-of-your-turn, direction: away }, effects: [ { trait: [heavily-obscured] } ] }   # Cloudkill
- zone: { area: { shape: sphere, size: 300 }, event: [cast], save: { ability: con },
          by-turn: { "2": { damage: { dice: 4d6, type: acid } }, "5-10": { damage: { dice: 1d6, type: cold } } } }     # Storm of Vengeance (abridged)
```
`moves` is `{ with: you, distance }` (moves with you as you move), `{ activation: bonus | magic, distance }` (you move it) or `{ at, distance, direction }` (it drifts). An `action` can create a zone with its own `zone` field (Caltrops, Ball Bearings).

Area shapes: `sphere`, `cube`, `cone`, `line` (with `width`), `cylinder` (with `height`), `emanation`, `square`, `circle`, `wall` and `ring` (`size`, `height`, `width`), `dome`, `globe`, `panels` (with `count`). `area.count` gives several areas (Fire Storm: ten cubes), `area.from: object | target | wall`, and `area.grows: { per, add, max }`.

---

## 11. Spells

### 11.1 `grant-spell`
```yaml
- grant-spell: { spell: $srd/spells/misty-step, prepared: always, free: { per: long, count: 1 }, ability: choice:fey-ability }
- grant-spell: { choose: { id: fey-spell, count: 1, from: { spell: { level: 1, school: [divination, enchantment] } } },
                 prepared: always, free: { per: long, count: 1 }, ability: choice:fey-ability }
- grant-spell: { spell: $srd/spells/hunters-mark, prepared: always, free: { per: long, count: 2 } }
- grant-spell: { spell: $srd/spells/thaumaturgy, ability: choice:legacy.ability }
- grant-spell: { spell: [$srd/spells/power-word-heal, $srd/spells/power-word-kill], prepared: always }
- grant-spell: { at-will: true, choose: { count: 1, from: { spell: { list: wizard, level: 1, in: spellbook } } } }   # Spell Mastery
```
Fields:
- `spell` (one or a list) or `choose`;
- `prepared: always | known | spellbook`, `counts-as-known`;
- `free: { per, count }`, `at-will`, `ritual: can | must`, `uses-slot`, `cast-at`;
- `ability` (a value; omit to use the class's);
- `level` (for "at level 3 you also learn…"), `overrides: { range, components, components.material, targets, concentration, text }` (Dragon Companion: `concentration: { optional: true, if-dropped: { duration: … } }`; Words of Creation: `targets: { count: 2, within: 10 }`);
- `counts-as: <class>` (the spell counts as that class's spell: Blessed Warrior);
- `free: { per, count, each: true }` (`each`: every listed spell gets its own free cast: Signature Spells);
- `target: self` (the spell can only target you, as with Armor of Shadows), `maximize: true` (roll no dice for its healing or temporary HP: Fiendish Vigor), `auto-succeed: save` (Contact Patron);
- `choose: { …, at-use: true }`: the spell is picked when it's cast, from the filter (Natural Recovery: "one of your prepared Circle spells").

**The ability can come from a choice.** That's the link DDB's homebrew forms can't express, though its official data resolves it on the server.

### 11.2 `spell-list`
```yaml
- spell-list: { add-to: $srd/bard, from: { spell: { list: [cleric, druid, wizard] } }, count: 2, at: [10, 14, 18] }  # Magical Secrets
- spell-list: { by-level: { 3: [$srd/spells/bless, $srd/spells/cure-wounds], 5: [$srd/spells/lesser-restoration, …] }, prepared: always }
- spell-list: { by-choice: land, table: Circle of the Land Spells, prepared: always, choose-again: long }
```
`by: slot-level` keys `by-level` by the highest level of spell slot the character has instead of class level ("when you have spell slots of a level specified in the table": the school Adept feats).

### 11.3 `spellcasting`
```yaml
- spellcasting: { ability: wis, progression: full, prepared: table:Prepared Spells, cantrips: table:Cantrips, list: cleric, focus: holy-symbol,
                  change: { prepared: long, cantrips: level-up } }      # when prepared spells and cantrips can be swapped
- spellcasting: { ability: cha, progression: pact, slots: table:Spell Slots, slot-level: table:Slot Level, prepared: table:Prepared Spells }
- spellcasting: { ability: int, progression: full, ritual: from-spellbook,
                  spellbook: { start: 6, start-level: 1, per-level: 2, copy: { hours-per-level: 2, gp-per-level: 50 } } }
```
`progression: full | half | third | pact` drives the multiclass slot table (already in the app).

**A subclass can grant spellcasting** (Eldritch Knight, Arcane Trickster). Put the `spellcasting` block under the subclass's Spellcasting feature; it applies from that feature's class level. Its slots come from a table in the subclass whose first column is the class level (`Fighter Level`) and which has a `Spells Prepared` (or `Prepared Spells`) column; slot columns are `Spell Slots per Spell Level N` (bare `1`…`9` columns are read too). Without a `Cantrips` column, give `cantrips` as a value. `list` names the class whose spell list it uses.
```yaml
- spellcasting: { ability: int, progression: third, list: wizard, cantrips: "steps(3: 2, 10: 3)" }
```
When multiclassing, it counts as a third caster (class level ÷ 3, rounded down).

- **Id:** a `spellcasting` block's id is `spellcasting` unless given, so `modify: { target: $#spellcasting, … }` works (Memorize Spell adds a Short Rest swap).
- **`change`** says when prepared spells and cantrips can be swapped: `level-up`, `long`, or `{ at, count }` (`{ at: long, count: 1 }` for Paladin and Ranger, `{ at: long, count: all }` for Wizard).
- **Spellbook:** a `spellbook` setting gives the class a spellbook list separate from prepared spells. A `choose` with `grants: spellbook` adds to it, and filters can say `in: spellbook` (Ritual Adept, Spell Mastery, Signature Spells).

### 11.4 Spell entries
A spell file's header fields (Level, School, Casting Time, Range, Components, Duration) are already data. A spell's Effects block uses `action` fields plus:
```yaml
- scaling: { per-slot-above: 3, add: { damage: 1d6 } }           # Fireball: +1d6 per slot level above 3 (3 = the spell's level)
- scaling: { cantrip: [5, 11, 17], add: { damage: 1d10 } }        # Fire Bolt
- scaling: { cantrip: [5, 11, 17], add: { attack.count: 1 } }     # Eldritch Blast: one more beam per tier
- scaling: { cantrip: [5, 11, 17], multiply: { range: 2 } }       # Spare the Dying
- scaling: { slots: { "5-6": { duration: { amount: 8, unit: hour, concentration: false } } } }   # Bestow Curse
- scaling: { per-slot-above: 1, add: { targets: 1 } }             # Charm Person
- scaling: { slots: { "3-4": { duration: { amount: 8, unit: hour } }, "5+": { duration: { amount: 24, unit: hour } } } }   # Hunter's Mark
- target-effects: { effects: […], ends-when: […], on-end: […], choose-one: […] }   # effects on the target
- self-effects:   { …blocks… }    # effects on you while the spell lasts (Shield, Mage Armor, Haste on self) → a toggle
```
`per-slot-above` is always the spell's own level: the value added applies once for each slot level above it.

**Outcome fields.** A spell's `action` (and a `zone` or trigger payload) can say what happens on each result:
- `on-hit` / `on-miss` (Guiding Bolt's Advantage; Acid Arrow's half damage);
- `on-success` / `on-failure` (Flesh to Stone: Restrained, or Speed 0 on a success);
- `then: { at | event | if | while | always, … }` for a later or follow-up step (Ice Knife's explosion `always`; Searing Smite's damage `at: start-of-target-turn`; Phantasmal Killer's repeat save);
- `branch: { if, then, else }` (Power Word Kill: `if: "target.hp <= 100"`);
- `repeat: { activation, move }` (Arcane Sword, Call Lightning, Moonbeam);
- `grows` (Delayed Blast Fireball), `delay` (Heroes' Feast), `at: spell-end`;
- `revive: { dead-max, hp, new-body }`, `stabilize`, `grant-rest: short`, `reduce-hp-max`, `heal: all | { pool, split }`, `creates`, `summon`, `dispel: { auto-max-level, check }`, `roll-table`.

`target-effects` takes `ends-when` (Mage Armor ends if the target dons armor), `on-end` (Haste's lethargy), and `choose-one` (Enlarge or Reduce). They're shown as text unless the target is your own sheet.

`self-effects` and any `trigger` inside a spell's Effects only apply while the spell is active. When it's cast, the sheet tracks its duration and concentration and switches them on. No `when` is needed.

---

## 12. Creatures

```yaml
- form:                                   # Wild Shape: a creature temporarily replaces parts of the sheet
    id: wild-shape
    activation: bonus
    cost: { resource: $#wild-shape }
    choose: { id: forms, count: "table:Beast Shapes.Known Forms", swap: { at: long, count: 1 },
              from: { creature: { type: beast, cr-max: "table:Beast Shapes.Max CR", fly: "table:Beast Shapes.Fly Speed" } } }
    keeps: [hp, hit-dice, score:int, score:wis, score:cha, creature-type, features, feats, languages, proficiencies]
    replaces: [ac, speed, senses, attacks, score:str, score:dex, score:con, size]
    temp-hp: level:druid
    duration: { amount: half(level:druid), unit: hour }
    ends-when: [{ condition: incapacitated }]
    blocks: [spellcasting]
    leave: bonus
- summon: { creature: $srd/monsters/… , via: $srd/spells/find-steed }     # a stat block the sheet can open
```
`form` accepts every `toggle` field (§10): `ends-when`, `blocks`, `leave` (how you end it early), `effects`. Creature filters: `type`, `cr-max`, `fly` (true/false), `exclude`.

- `form.target: other` imposes a form on another creature (Polymorph). Values can read the target and the chosen form: `cr-max: target.cr`, `temp-hp: form.hp`.
- `summon-options` adds to another feature's summon when it happens: `for` (the spell or feature), `add` (more stat blocks to pick from, like Pact of the Chain's special familiar forms), `speed: { choose: [fly, swim], value: 40 }`, `save-dc: spell` (its saves use your spell save DC), `damage-type: { choose: [necrotic, radiant], replaces: [bludgeoning, piercing, slashing] }` and `text`. Investment of the Chain Master is the example.
- `summon` takes `limit: 1` ("one familiar only"), `type-override: { choose: [celestial, fey, fiend] }` (Find Familiar), `count`, `control: { activation, range, move, duration }`, `initiative: shared | after-you`, `stat-level: slot-level` (Summon Dragon), `variant`, `overrides` and `creature: { copy-of: target, hp-max: half }` (Simulacrum).

### 12.1 Monster entries (planned for a later version)
Modif is meant to describe every kind of SRD content, including the 235 monsters and 95 animals. They are deferred to a later version; 0.5 records the plan so content isn't shaped against it:
- **Stat block header fields are data:** AC, Initiative, HP (with its dice), Speed, the score/modifier/save table, Skills, Resistances/Immunities, Senses, Languages, CR and PB.
- **Each `***Name.***` entry under Traits, Actions, Bonus Actions, Reactions and Legendary Actions is a heading** (the run-in rule, §2.4), and its section gives the default `activation`.
- **Attacks have fixed numbers:** `attack: { kind: melee | ranged | melee-or-ranged, bonus: 14, reach: 10, range: 30/120 }`, `damage: [ { dice: 1d10 + 8, average: 13, type } ]`; saves `save: { ability, dc: 21, success: half }`.
- **New fields:** `recharge: 5` (Recharge 5–6), `uses: { per: day, count }` (X/Day), `legendary: { cost }`, `multiattack: { attacks: [ { action, count } ], replace }`, Legendary Resistance and Legendary Action Uses as resources with a lair value, and monster `spellcasting: { ability, dc, attack, at-will: [...], per-day: { "1": [...] } }` with "(level N version)" as `at: N`.
- **The format is regular enough to convert by code** (355 melee and 47 ranged attack lines, 199 saving-throw lines share one pattern), with hand review for traits.
- **Pack issue to fix first:** some section headings are merged ("## Reactions Legendary Actions" in the Lich).

---

## 13. Items

Item header fields (from the tagline) are already data:
- **Category:** Armor, Weapon, Wondrous Item, Ring…
- **Base item:** for magic weapons and armor.
- **Rarity.**
- **Requires Attunement:** with an optional "by a Wizard"-style restriction.

**Item effects apply only while the item is active:**
- an item that can be worn and needs attunement must be equipped and attuned;
- an item that can't be worn but needs attunement must be attuned;
- an item that can be worn but needs no attunement must be equipped;
- anything else is always active.

This is the same rule the inventory uses today, and the same as DDB's.

**`wield-as`** says which weapon an item fights as when its tagline doesn't name one: a staff that "can be wielded as a magic Quarterstaff", a rod that "functions as a magic Mace".
```yaml
- wield-as: { weapon: quarterstaff }     # the weapon's id: its name in lower case, words joined with hyphens
```
While the item is equipped, it attacks as that weapon (damage, properties, mastery and proficiency all come from the weapon), and the item's own blocks that scope `{ weapon: { id: self } }` apply to those attacks. Magic weapons whose tagline names their base ("Weapon (Longsword)") don't need it. An item that only sometimes counts as a weapon (Rod of Lordly Might's other forms) still lists its usual one.

```yaml
- bonus: { to: [attack, damage], value: 1, scope: { weapon: { id: self } } }   # a +1 weapon (self = this item)
- bonus: { to: ac, value: 1, scope: { item: self } }                           # +1 armor or shield
- charges: { max: 7, recharge: { dice: 1d6+1, at: dawn }, destroy-on: { roll: 1d20, if: 1, when: last-charge } }
- variant: { id: plus, by: rarity, values: { uncommon: 1, rare: 2, very-rare: 3 } }   # "+1, +2 or +3"
- bonus: { to: [attack, damage], value: variant:plus, scope: { weapon: { id: self } } }
- curse: { prevents: [doff, unattune], ends: { spell: $srd/spells/remove-curse },
           effects: [ { disadvantage: { roll: [attack, save:all], scope: { against: { creature: demon } } } } ] }
- action: { activation: magic, cost: { charges: 1 }, cast: $srd/spells/fireball, dc: 15 }  # casting from an item
- action: { activation: bonus, heal: variant:heal, consume: true }                         # a potion
```

**`variant`** defines a value that depends on which version of the item this is. `by: rarity` reads the rarity of the inventory item. `by: name` matches the qualifier in the item's name ("Belt of Giant Strength (hill)", "Potion of Healing (greater)"); the key `""` is the unqualified version. The value is then available as `variant:<id>` anywhere. The importer offers one catalog item per variant.

**Evolving items** gain properties as their rarity rises and keep the earlier ones. `by: stage` matches the first word of the item's name, the stage word the book prefixes ("Flowering Blossom Rod"), and its values are rarities; `""` is an unnamed first stage. Each property carries `when: { rarity: ">= rare" }`, so renaming the item to its next stage switches the property on. Without a stage variant, `rarity` reads the rarity in the item's tagline when it names only one.
```yaml
- variant: { id: stage, by: stage, values: { budding: uncommon, flowering: rare, somniferous: very-rare } }
- action: { activation: magic, cast: $srd/spells/insect-plague, per: dawn, when: { rarity: ">= rare" } }
```

**`consume: true`** removes one of the item from the inventory when the action is used. A trigger can consume it too: `trigger: { event: hit, scope: { weapon: { id: self } }, offer: { consume: self } }` (magic ammunition).

**More variant forms:**
- `by: roll` with `roll: 1d10` (the GM rolls or picks: Ring of Resistance);
- `by: spell-level` with object values (`{ 3: { dc: 15, attack: 7 } }`), read as `variant:level.dc` (Spell Scroll);
- a plain list of names (`values: [agility, awareness, …]`), with effects for each under `when: { variant: { id: kind, is: agility } }` (Ioun Stones).

**Other item patterns:**
- `limit: { worn: 3, of: $srd/magic-items/ioun-stone }`: at most three active at once;
- `modify: { target: self.base, set: { stealth-disadvantage: false, strength-requirement: 0 } }`: patches the base armor (Mithral Armor);
- `proficiency: [{ armor: { id: self } }]`: training with this item only (Elven Chain);
- payload `suppress: { target: self, until: start-of-next-turn }` turns the item's effects off for a while (Cloak of Displacement after you take damage).

**Attunement restrictions** in the tagline ("Requires Attunement by a Druid, Sorcerer, Warlock, or Wizard") are read as data: the inventory won't let other characters attune to it. No block is needed.

---

## 14. Patches: `modify` and `replace`

One entry changes another one without copying it.
```yaml
- modify: { target: $srd/monk#flurry-of-blows, set: { attacks: 3 }, when: { level:monk: ">= 10" } }   # Heightened Focus
- modify: { target: $srd/spells/hunters-mark, set: { damage.dice: 1d10 } }                            # Foe Slayer
- modify: { target: $srd/cleric#turn-undead, add: { damage: { dice: "dice(max(1, mod:wis), d8)", type: radiant } } }  # Sear Undead
- replace: { target: $srd/fighter#fighting-style, optional: true }   # an optional feature that swaps out another (DDB Feature Type: Replacement)
```
Patches name the field they change, as a dotted path. A path step through a list uses the item's `id`, not its position: `choose-one.focused.temp-hp` (Heightened Focus changes the Focus-point version of Patient Defense). If the target isn't loaded, the importer warns instead of failing.

### 14.1 `modify` or `steps`?
Both can express "gets better at level N". Use exactly one per improvement, or it gets counted twice:
- If the improvement has **its own heading** in the source (Improved Cunning Strike, Heightened Focus, Foe Slayer), write a `modify` under that heading.
- If the improvement is **described inside the same feature** ("Starting at level 17, you can use it twice"), use `steps` in that feature's block.

---

## 15. Triggers: `trigger`

The prompt layer. The sheet can't decide these, but it knows when to offer them.
```yaml
- trigger:
    event: hit                          # see the event list
    scope: { any: [ { weapon: { property: finesse } }, { weapon: { kind: ranged } } ] }
    per: turn
    if: "Advantage on the roll, or an ally within 5 feet of the target"   # shown, not evaluated
    offer:
      damage: { dice: table:Sneak Attack, type: weapon }
```

**Events** (from the 60 SRD prompts):

| Event | SRD examples |
|---|---|
| `attack` (before the roll) | Tactical Master (swap the mastery property) |
| `hit` / `hit-first` | Sneak Attack, Divine Strike, Stunning Strike, Colossus Slayer |
| `miss` | Studied Attacks, Peerless Aim |
| `crit` | Overwhelming Strike, Remarkable Athlete's move |
| `hit-by` / `damaged` / `targeted` | Uncanny Dodge, Deflect Attacks, Retaliation, Shield |
| `fail` / `succeed` (`save`, `check`, `attack`, `d20`) | Indomitable, Tactical Mind, Cutting Words (a creature succeeds), Boon of Fate |
| `roll` (`initiative`, `d20: 1`) | Persistent Rage, Halfling Luck |
| `zero-hp` | Relentless Rage, Relentless Endurance |
| `reduce-to-zero` | Dark One's Blessing |
| `start-of-turn` / `end-of-turn` | Heroic Rally, Self-Restoration |
| `deal-damage` | Superior Hunter's Prey |
| `cast` (scope: spell filter), `cast: any` (with `who`) | Overchannel, Blessed Healer, Free Casting, Counterspell |
| `use` (a feature reference, or `bonus-action`, `attack-action`, `magic-action`) | Tactical Shift (on Second Wind), Cunning Strike (on Sneak Attack), Fleet Step, Blink Steps |
| `enter-area` | Spirit Guardians, Wall of Fire (inside an `aura` or `zone`) |
| `targeted` (`spell`, or a spell reference) | Shield, Rod of Absorption |
| `rest` (`short`, `long`) | Memorize Spell, Fiendish Resilience swap |
| `fall` | Slow Fall |
| `spend` (`charges`, `resource`, `slot`) | Use Magic Device (roll on spending charges) |
| `target-drops` (`zero`) | Hunter's Mark (move the mark) |

**Whose roll or action:** by default a trigger watches your own rolls. `who` widens it:
```yaml
who: { creature: other | ally | enemy | any, range: 60, see: true }
```
Cutting Words (`event: [ { roll: damage }, { succeed: check }, { succeed: attack } ]`, `who: { creature: other, range: 60, see: true }`), Countercharm, Counterspell and Boon of Fate use it. These are always prompts.

**Other trigger fields:**
- `if-roll: 20` fires only on that natural roll (Overwhelming Strike, Vorpal Sword);
- `group: metamagic` puts the trigger in an option group whose per-cast limit is set on the `choose` (§7); `group-exempt: true` ignores the limit (Empowered Spell, Seeking Spell);
- `counter` and `uses` (§3.6), `dc` (any value, including `10 + 5 * uses`).

**Payloads** (`offer`):
- `damage`, `heal`, `temp-hp`;
- `reroll`, `add-roll` (Bardic Inspiration, Dark One's Own Luck: `1d10`), `treat-as: 20`;
- `regain: { resource, amount | to | levels, max-slot }`;
- `turn-on: $#toggle`, `move`, `reaction: true`, `cast: self` (a reaction spell, e.g. Shield);
- `damage-taken: half | { reduce: <value> }` (Uncanny Dodge, Deflect Attacks);
- `roll: <dice>` with `if-roll: <n>` (Use Magic Device: on a 6, the charge is refunded);
- `choose-one: [ … ]` with an optional `pick` (how many, a value) for option menus such as Cunning Strike;
- `cost` (any cost from §9, including `dice-from`), `refund: if-fails` (Tactical Mind: the cost is given back if the roll still fails) or `refund: spent` with `if-roll` (Use Magic Device), and `text`;
- `save` + `on-success` / `on-failure`, and `then` for a follow-up (as in §9): Stunning Strike, Relentless Rage (`on-success: { set-hp: 2 * level:barbarian }`), Deflect Attacks (`then: { if: "The damage was reduced to 0", cost, save, damage }`);
- `set-hp: <value>` (Relentless Endurance), `exhaustion: -1` (Tireless), `remove-condition: [..]`;
- `add-roll` takes a negative value (Cutting Words) or `{ dice: 2d4, sign: choose }` (Boon of Fate: bonus or penalty);
- `reroll: { dice: <n> }` (some dice only), `advantage: true` (the reroll has Advantage: Countercharm);
- `maximize: true` and `self-damage: { if, dice, type, ignore: [resistance, immunity] }` (Overchannel);
- `spell: { range, duration, casting-time, components, damage-type, slot-level }` changes the spell being cast (Metamagic):
  ```yaml
  - trigger: { event: cast, group: metamagic, scope: { spell: { range: ">= 5" } },
               offer: { cost: { resource: $#sorcery-points, amount: 1 }, spell: { range: "2 * spell.range" } } }   # Distant Spell
  - trigger: { event: cast, group: metamagic, scope: { spell: { casting-time: action } },
               offer: { cost: { resource: $#sorcery-points, amount: 2 }, spell: { casting-time: bonus } } }       # Quickened Spell
  ```
- `consume: self`, `suppress: { target, until }` (§13).

**How the sheet handles a trigger:** it offers a button at the moment the event happens on the sheet (for example, after an attack roll that hits). If the event isn't something the sheet sees (`damaged`, `targeted`), it lists the trigger under **Reactions & reminders** instead. With `auto: true`, a trigger whose event *is* seen and whose `if` is empty can resolve on its own (Halfling Luck, "regain on Initiative").

---

---

## 16. Validation (what the importer checks)

The validator is part of the importer, not a separate tool: every Effects block is checked on import, and problems appear in the importer's report like any other format issue. It checks that:
1. **Every block and field is known**, including blocks nested in `effects`, in options, and in `choose-one` items. Anything unknown is reported with the closest match. Reserved words used as keys (§2.2) are errors.
2. **References resolve:** `$…` targets exist, and `choice:` ids are defined in the same entry.
3. **Values parse:** dice and expressions are valid, `table:` columns exist in the class table.
4. **The text and data agree.** These checks help authors; they never change data:
   - the text mentions armor, a shield, "while", "once per turn", "when you…", "as a Reaction" or a condition name, but no block has the matching `when`, `per` or `trigger`;
   - the text has numbers (`+2`, `1d8`, "60 feet") that appear in no block.

   For example, Bracers of Defense whose text says "and using no Shield" but whose data only has `armor: none` would get the warning "Text mentions a shield; no `shield:` condition found."
5. **Coverage.** Each entry is labelled:
   - *automated* — blocks only, no prompts;
   - *partly automated* — prompts (`trigger` with `offer`), notes or `when: { player }` switches present;
   - *narrative* — the entry's only block is `narrative: true` (§5.8): someone checked and there's nothing to automate;
   - *not automated* — no Effects block yet;
   - *reference* — definitions and rules prose (glossary terms, most gear, rules chapters), which never get blocks.

   A pack summary shows those numbers, so authors can see what they've automated. Because blocks are the only source of rules (principle 6), *not automated* means exactly that: the sheet applies nothing from the text.
6. **No phrasebook bullets.** A list item that's a plain string (`- +1 AC`) is an error: "Phrases aren't Modif; write a block."
7. **Headings and blocks match.** A run-in trait with numbers in its text but no heading or block of its own is flagged (§2.4).

### 16.1 Converters and cross-checks
Where content is already structured, code converts it and no hand work is needed: the Weapons and Armor tables (`table_convert.py`) and tool header fields (`tool_convert.py`). Where it's prose, a converter only **drafts** the predictable parts — saves, attack rolls, damage, healing, areas, conditions, slot and cantrip scaling (`draft_convert.py`) — and a person reviews every entry. A cross-check (`check_scaling.py`) then compares the reviewed encoding against the converter's mechanical reads and flags any damage dice, save ability or scaling it can't find.

Neither side is trusted alone. In the 0.5 pass the cross-check caught two of my misses (Meld into Stone's 6d6, Magic Jar's save), my own re-read caught a +4d6 scaling that should be +1d6, and review caught three converter errors (Find Steed read as applying Incapacitated; a "5-foot-wide, 60-foot-long Line" read as 5 feet long; per-slot scaling read against the wrong base level). Review windows must show the whole entry: 94 spells and 94 items were longer than my first window, and re-reading their hidden text changed 19 encodings.

## 17. (Removed) Shorthand phrases

0.1–0.3 accepted phrasebook bullets (`- +1 AC`) as shorthand for blocks. 0.4 removes them: Modif is blocks only. Converting the SRD pack's existing phrases to blocks is a one-time job for the pack converter, which may keep the old phrase table internally; the format, the validator and the app don't accept phrases.

---

## 18. Worked examples

### Dwarf (species)
Size and Speed are header fields. Each trait is its own heading (§2.4); here the blocks are shown together.
```yaml
- sense: { darkvision: 120 }
- defense: { resistance: [poison] }
- advantage: { roll: save:all, scope: { against: { condition: poisoned } } }
- bonus: { to: hp:per-level, value: 1 }
- resource: { id: stonecunning, max: prof, reset: long }
- toggle: { id: stonecunning, activation: bonus, cost: { resource: $#stonecunning }, duration: { amount: 10, unit: minute },
            when: { player: "On or touching a stone surface" }, effects: [ { sense: { tremorsense: 60 } } ] }
```

### Fey Touched (feat)
```yaml
- choose: { id: fey-ability, kind: ability, from: [int, wis, cha], amounts: [1], max: 20 }
- grant-spell: { spell: $srd/spells/misty-step, prepared: always, free: { per: long, count: 1 }, ability: choice:fey-ability }
- grant-spell: { choose: { id: fey-spell, count: 1, from: { spell: { level: 1, school: [divination, enchantment] } } },
                 prepared: always, free: { per: long, count: 1 }, ability: choice:fey-ability }
```

### Bracers of Defense (item)
```yaml
- bonus: { to: ac, value: 2, when: { armor: none, shield: false } }
```
(Attunement comes from the tagline. DDB's own version drops the shield clause; this one doesn't.)

### Rogue: Sneak Attack and Cunning Strike
```yaml
- trigger:
    id: sneak-attack
    event: hit
    scope: { any: [ { weapon: { property: finesse } }, { weapon: { kind: ranged } } ] }
    per: turn
    if: "You have Advantage, or an ally is within 5 feet of the target and you don't have Disadvantage"
    offer: { damage: { dice: table:Sneak Attack, type: weapon } }
- trigger:
    id: cunning-strike
    event: { use: $#sneak-attack }
    level: 5
    dc: 8 + mod:dex + prof
    offer:
      pick: 1                                   # Improved Cunning Strike raises this to 2 with a modify (§14.1)
      choose-one:
        - { label: Poison, cost: { dice-from: $#sneak-attack, count: 1 }, requires: { item: poisoners-kit },
            save: { ability: con }, apply: { condition: poisoned, duration: { amount: 1, unit: minute }, save-ends: end-of-turn } }
        - { label: Trip, cost: { dice-from: $#sneak-attack, count: 1 }, if: "Target is Large or smaller",
            save: { ability: dex }, apply: { condition: prone } }
        - { label: Withdraw, cost: { dice-from: $#sneak-attack, count: 1 }, move: { distance: half-speed, no-opportunity-attacks: true } }
```

### Fireball (spell)
```yaml
- action:
    area: { shape: sphere, size: 20 }
    save: { ability: dex, dc: spell:dc, success: half }
    damage: { dice: 8d6, type: fire }
- scaling: { per-slot-above: 3, add: { damage: 1d6 } }
```

### Paladin: Aura of Protection and its upgrades
```yaml
# under "Level 6: Aura of Protection"
- aura: { id: aura-of-protection, area: { shape: emanation, size: 10 }, affects: [self, allies],
          inactive-when: [{ condition: incapacitated }], stacking: one-per-type,
          effects: [ { bonus: { to: save:all, value: "max(1, mod:cha)" } } ] }
# under "Level 10: Aura of Courage"
- modify: { target: $#aura-of-protection, add: { effects: [ { defense: { condition-immunity: [frightened] } } ] } }
# under "Level 18: Aura Expansion"
- modify: { target: $#aura-of-protection, set: { area.size: 30 } }
```

### Bard: Bardic Inspiration (a die another creature holds)
See §9.1.

---

## 19. Open questions

1. **Format:** settled on YAML blocks only (0.4). Nesting (choices, toggles, auras, Metamagic) is common across the whole SRD, so a one-line syntax would cover too little. The reserved-word problem (§2.2) is the main YAML hazard, and the validator catches it.
2. **Stacking:** the same-name rule and `type` cover 5e's stacking rules. Is anything else needed? The `base` rule (best one wins) covers "doesn't stack with Unarmored Defense".
3. **Effects on other characters:** if shared instances link characters, `target-effects` could apply to a party member's sheet. Still out of scope.
4. **Versioning:** a pack declares `**Modif Version:** 0.5`, so the importer can tell old files from new.
5. **Coverage left:** the whole character-side SRD is encoded (classes, species, feats, backgrounds, spells, magic items, equipment, conditions, character-facing rules). Monsters and animals remain (§12.1).
6. **Party sheets:** `give`, `aura`, `who` and `target-effects` all reach other creatures. They work as notes and prompts today. If the app links party members' sheets, they can apply directly; the data doesn't need to change.
7. **Validator depth:** field names are checked everywhere; many *values* are not (condition names, `activation` values, poison `delivery`, the inside of `overrides` and `convert.to`). A planted `delivery: injected` passed in the 0.5 negative tests. Value enums are the next validator job.
8. **Vocabulary size:** 0.5 added about 150 field names to cover all SRD spells and items. 0.6 merged the clearest overlaps (see "Changes from 0.5"); `heal-self` / `on-hit.heal-self` remains to merge before 1.0.
9. **Pack fixes:** see `modif-0.5-results.md` for spliced or truncated SRD files found while encoding.

---

## 20. Equipment, conditions and rules

### 20.1 Weapons and armor
The Weapons and Armor tables are already data. `table_convert.py` turns each row into an item record: header fields (category, kind, damage, damage type, properties, mastery, weight, cost) plus blocks for armor:
```yaml
half-plate-armor:
  header: { category: medium, weight: 40 lb., cost: 750 GP }
  blocks:
    - base: { to: ac, value: "15 + min(mod:dex, 2)", when: { equipped: self } }
    - disadvantage: { roll: skill:stealth, when: { equipped: self } }
chain-mail:   # Str 13 requirement
  blocks: [ { base: { to: ac, value: 16 } }, { bonus: { to: speed:walk, value: -10, when: { score: { str: "< 13" } } } }, … ]
```
**Weapon properties and mastery properties are rule entries**, one heading each, whose blocks apply to any weapon listing them:
```yaml
Finesse:  [ { use-ability: { ability: [str, dex], choose: best, for: [attack, damage], same-for-both: true } } ]
Graze:    [ { trigger: { event: miss, auto: true, offer: { damage: { dice: attack-ability-mod, type: weapon } } } } ]
Topple:   [ { trigger: { event: hit, offer: { save: { ability: con, dc: 8 + attack-ability-mod + prof }, on-failure: { apply: { condition: prone } } } } } ]
Nick:     [ { modify: { target: $#light-extra-attack, set: { activation: attack-action }, per: turn } } ]
```
`weapon-rule` holds the bookkeeping properties (Ammunition, Loading, Range, Thrown, Two-Handed, improvised weapons); `weapon-property: { add, remove }` lets an item change them (Dwarven Thrower).

### 20.2 Gear and tools
Gear with mechanics gets ordinary blocks (Acid and Alchemist's Fire replace an attack; Caltrops and Ball Bearings create a `zone`; Healer's Kit has `charges`; light sources are `toggle`s with `light`). Gear with none is *reference*. Tools are converted from their header fields: each **Utilize** task becomes `action: { activation: utilize, label, check: { tool: self, ability, dc } }`, **Craft** becomes `craft: { items }`, **Variants** a `variant`.

### 20.3 Conditions
Each condition is an entry whose blocks apply to the creature that has it:
```yaml
paralyzed:
  - condition: [incapacitated]
  - set: { to: speed:all, value: 0, mode: override, locked: true }     # "Speed 0 and can't increase"
  - auto-fail: { roll: [save:str, save:dex] }
  - advantage: { roll: attacks-against-you }
  - treat-roll: { roll: hits-against-you, as: crit, when: { player: "The attacker is within 5 feet" } }
exhaustion:
  - resource: { id: exhaustion-level, builtin: exhaustion, max: 6, on-max: death }
  - bonus: { to: d20, value: "-2 * exhaustion" }
  - bonus: { to: speed:all, value: "-5 * exhaustion" }
```

### 20.4 Actions, rests and other rules
The 12 standard actions are entries with ids (`attack`, `dash`, `disengage`, `dodge`, `help`, `hide`, `influence`, `magic`, `ready`, `search`, `study`, `utilize`), so `take: dash` resolves to a real block; Help uses `give`. Unarmed Strike (Damage, Grapple, Shove), Opportunity Attacks (`event: leaves-reach`), Armor Training, Cover, Falling, Suffocation, Dehydration, Malnutrition, Lightly/Heavily Obscured, Surprise and the two rests (`rest: { kind, duration, regain }`) also have blocks.

### 20.5 Hazards and poisons
Environmental hazards are timed triggers (`event: { every: 1 hour }`) behind a `when: { player }` switch, since the sheet can't know the weather. Poisons use a `poison` block:
```yaml
- poison: { delivery: injury, save: { ability: con, dc: 13 }, on-failure: { apply: { condition: poisoned, duration: { amount: 1, unit: hour } } },
            on-fail-by: { 5: { apply: { condition: unconscious, while: poisoned, ends-when: [damage, shaken-awake] } } } }   # Spider's Sting
```

## 21. Field additions in 0.5, by block
All of these are known to the validator.
- **Values:** `target.hp`, `target.cr`, `fall.feet`, `charges`, `exhaustion`, `attack-ability-mod`, `any` in roll comparisons (`"any >= 3"`), unit literals with distances (`5 feet`), decimals (`0.5`).
- **Paths:** `crits-against-you`, `hits-against-you`, `checks-to-perceive-you`, `hit-die-healing`, `reach`, `damage.ability-mod`.
- **`when`:** `species`, `class`, `weapon`, `score`, `armor-untrained`.
- **Scopes and filters:** `scope.attack: melee | ranged | ranged-weapon | spell`, `against.attack`, `against.hazard`, weapon `not`, creature `size-max`, `seen`, targets `size`, `size-max`, `text`, `within`.
- **`action`:** `on-hit`, `on-miss`, `repeat`, `choose`, `grows`, `dispel`, `creates`, `remove-condition`, `delay`, `reduce-hp-max`, `exhaustion`, `target`, `branch`, `grant-rest`, `roll-table`, `revive`, `table`, `stabilize`, `summon`, `becomes`, `variant`, `preset`, `lockout`, `damage-ability-mod`, `zone`, `end-effect`, `ends-when`.
- **`save`:** `advantage`, `auto-succeed`, `auto-fail`, `disadvantage` (each structured or `{ text }`), `ignore-cover`, `modifiers`, `self`, `unwilling-only`; `save-ends` as a list, `{ every }`, `{ at, successes, failures, on-fail-out }`, `action`, `on-damage`.
- **`apply`:** `escape: { check, dc, others-can-help }`, `table`, `if`, `while`.
- **`toggle`:** `choose-one`, `leave`, `lockout`. **`form`:** `targets`, `repeat`, `save`, `choose-one`. **`self-effects`:** `ends-when`, `on-end`. **`aura`:** `moves`, `affects: [chosen]`.
- **Triggers:** events `forced-move`, `every`, `leaves-reach`; payloads `shift-bonus`, `instead-of-damage`, `attack`, `on-hit`, `end-effect`, `check`.
- **Resources and charges:** `per-property`, `shared-with`, `builtin`, `on-max`; charges `start`, `kinds`.
- **Numbers:** `bonus.decays`, `set.locked`, `roll-floor.optional`, `treat-roll.optional`, `reroll: { dice, keep }`, `damage-type: { replace, with }`, `modify.max`, `scaling.multiply`, `use-ability: { choose, same-for-both }`, `sense.or-add`.
- **Items:** `variant: { by: roll | choice, table }`, `summon` (`overrides`, `variant`, `stat-level`), `spellcasting: { focus: self, class }`.

## 22. Rulings that shape encodings

The official rulings in the Sage Advice Compendium settle several questions an encoding or an app has to answer. They're summarized here in our words; the compendium is the source. An app that reads Modif should behave this way, and an encoding shouldn't contradict it.

**Rolls**
- Ability checks, attack rolls and saving throws are three kinds of D20 Test. Something that affects one of them doesn't affect the others unless it says so (`check:all` isn't `save:all`); something that affects "D20 Tests" affects all three (`roll: d20`).
- Only attack rolls score Critical Hits, and only an attack roll of 1 is an automatic miss. A 1 on a check or save isn't an automatic failure, and a 20 isn't a success (death saves are their own rule).
- Effects with different names stack; copies of the same effect don't (§6.1). Guidance and Bardic Inspiration both add to one check; two Rings of Protection can't both be attuned.
- Temporary Hit Points never add together: a new grant replaces the old one only if it's higher.
- Resistance applies after every other adjustment: a successful save for half, then halved again. Damage can be reduced to 0 but not below.
- Damage absorbed by Temporary Hit Points still counts for a Concentration save's DC.

**Spells**
- A spell cast without a spell slot is cast at its own level unless the text says otherwise. A Ritual doesn't use a slot, so features that care about "a spell slot" (Arcane Ward, Life Domain healing) don't count it.
- Only one spell slot can be spent on a spell per turn, Reaction spells included.
- A spell attack isn't the Attack action: Extra Attack, the Light property and similar features never cast spells unless they say so (Valor Bard, War Caster).
- A spell's Material components are consumed only if the text says so; a focus can't replace a component that has a cost or is consumed.
- A spell cast from a magic item with no DC of its own uses 8 + your spellcasting modifier (0 if you have none) + your Proficiency Bonus.
- A Spell Scroll may be named "Spell Scroll (X)", "Scroll of X" or "Spell Scroll of X". The spell must be on the spell list your class uses: a subclass with its own list counts (an Eldritch Knight reads Wizard scrolls).
- Wild Magic Surge and other "your Sorcerer spells" features apply only to spells prepared through that class (`scope: { spell: { counts-as: sorcerer } }`), not every spell on the list.

**Features and feats**
- A class feature that grants proficiency or training (Divine Order, Iron Mind) grants it even when the class isn't the character's first; only the core traits are limited to "As a Multiclass Character" (§5.6).
- Damage riders are extra damage, not the weapon's dice: Savage Attacker, Great Weapon Fighting and similar weapon-dice rules don't touch Sneak Attack, Divine Smite or a feature's extra dice (scope them to the weapon). A Valor Bard's Combat Inspiration die added to damage is a damage die, so it doubles on a Critical Hit.
- Archery covers Ranged weapons only. A Melee weapon you throw is a ranged attack with a Melee weapon (Thrown Weapon Fighting: `scope: { weapon: { property: thrown }, attack: ranged }`).
- Polearm Master's bonus attack adds the ability modifier as usual and always uses a d4, even with Shillelagh. Dueling allows a Shield or a focus in the other hand. The extra attack of the Light property must use a different weapon, even with Crossbow Expert.
- Reliable Talent and Jack of All Trades never apply to the same check (`unless: proficient`).
- Elemental Affinity and other "one damage roll" bonuses add once per casting (`once: true`), even for a spell with several rolls. Empowered Spell can spread its rerolls across several rolls. One Metamagic option per spell, used once.
- An Abjurer's Arcane Ward regains Hit Points whenever an Abjuration spell is cast with a slot, up to its maximum. Damage goes: Resistances and Vulnerabilities, then the ward, then Immunities, then Temporary Hit Points, then Hit Points.
- Illusory Reality makes one object real per Illusion spell; Portent needs sight of the creature but has no range.
- Pact of the Blade conjures any Melee weapon, or bonds with any magic weapon (ranged too) without changing its form.

**Equipment**
- A Shield's bonus applies only while it's donned; attacking with it doesn't remove the bonus. Heavy armor you're trained with affects only Stealth, not Dexterity saves or other checks.
- Barkskin's AC 17 replaces armor, Shield and cover bonuses unless the total is higher (`set` with `mode: min`). Mage Armor works with a Shield; it's a base AC, so it doesn't combine with Unarmored Defense (§6.2, best base wins).
- Attacks with a magic Ranged weapon are magical even with nonmagical ammunition.
