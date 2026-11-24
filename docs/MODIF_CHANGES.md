# Modif: version history

What changed in each version of [Modif](MODIF.md), newest first. The spec itself describes the current version only.

## Changes from 0.6

0.7 adds one block.

**`wield-as`** (§13). An item that fights as a weapon though its tagline names none: a staff that "can be wielded as a magic Quarterstaff", a rod that "functions as a magic Mace". `- wield-as: { weapon: quarterstaff }` makes the item use that weapon's statistics (damage, properties, mastery, proficiency), and the item's own blocks (`bonus` with `scope: { weapon: { id: self } }`, triggers on a hit with it) apply to it. Seven SRD items use it: Rod of Lordly Might and the Staffs of Power, Striking, the Magi, the Woodlands, Thunder and Lightning, and Withering. Before 0.7 an app had to read this from the description, which principle 6 rules out.

## The name
Versions 0.1–0.3 were drafted as the "fivepointfive Effects Schema". The format is now called **Modif** (short for *modifier*, the word D&D Beyond and players already use for effects), so it can be used outside fivepointfive. Content files keep `yaml` as the code block label (editors highlight it), and keep `## Effects` as the heading. The name appears in the pack's version line (`**Modif Version:**`), this spec and the validator (`modif_check.py`).

## Changes from 0.5
0.6 is a consolidation release: no new coverage, fewer ways to say the same thing, a machine-readable schema, and the first app that reads Modif.

**Renames (one name per idea)**

| Old (0.5) | New (0.6) | Uses changed in the SRD encodings |
|---|---|---|
| `end-spell: true` | `end-effect: true` (spells, items and features alike) | 5 |
| `escape.on-fail` | `escape.on-failure` (matches every other outcome field) | 1 |
| `apply.ends-on: [events]` | `apply.ends-when: [...]` | 23 |
| `save.advantage-if: "text"` | `save.advantage: { text }` | 8 |
| `save.auto-succeed-if: "text"` | `save.auto-succeed: { text }` | 4 |
| `save.disadvantage-for: { creature }` / `save.disadvantage-if: { armor }` | `save.disadvantage: { creature }` / `save.disadvantage: { when: { armor } }` | 4 |
| `sense: { see-invisible: 9999 }` | `see-invisible: unlimited` | 1 |
| action `table: X` plus "Roll 1d10" in the text | `roll-table: { dice, table }` | 1 |

Values were normalised too: `until: end-of-your-next-turn` is now `end-of-next-turn`; `activation: minute` is `{ amount: 1, unit: minute }`; `activation: attack` is `replace-attack`.

**`ends-when`.** One field lists what ends an applied effect. A **string** entry is an event (`damage`, `attack`, `shaken-awake`); a **mapping** is a state that ends it while true (`{ condition: incapacitated }`). For example `ends-when: [damage, { condition: incapacitated }]`.

**`save` is a closed object.** Its fields are `ability, dc, success, text, advantage, disadvantage, auto-succeed, auto-fail, unwilling-only, self, modifiers, ignore-cover`; anything else is an error.

**JSON Schema.** `modif.schema.json` (JSON Schema 2020-12) is generated from the validator's vocabulary by `build_schema.py`, so the two can't drift. It adds enum checks (conditions, activations, area shapes, time units, `until` values, reset events, delivery, save outcomes) and strict nested objects (`save`, `apply`, `cost`, `targets`, `who`). `modif_check.py` runs it when the `jsonschema` package is installed. It caught one value the field checks had missed (`delivery: injected`).

**Validator reads packs.** `modif_check.py <pack folder>` now reads the `## Effects` blocks straight out of the Markdown entry files, so content can be checked where it lives. Pointing it at a folder of `.yaml` files still works.

**Where Effects live (clarified, §2).** An `## Effects` heading is Modif only when a ```` ```yaml ```` fence follows it. Any other heading named "Effects" (the SRD's "Casting Spells" rules have one) is ordinary rules text.

**First implementation.** fivepointfive reads Modif for all of the SRD 5.2.1 character content: the 12 classes and their subclasses, the 9 species, the 4 backgrounds, all 17 feats, all 339 spells, all 258 magic items, and the equipment, tools, gear, conditions, rules, hazards and poisons. Options under a heading (`choose: { kind: option, options: { headings-under } }` with `option: { of }` on each choice) and inline options with their own `effects` (lineages, read from the builder's species choice) are applied only when chosen; `choice:<id>.<field>` values are filled in from the choice. The builder tracks every Ability Score Improvement and Epic Boon level as its own feat slot (each slot keeps the choices of the feat taken there). The sheet applies proficiencies, choices, ability score increases, resources and item charges, healing actions, AC formulas and bonuses, save/check/skill/attack/damage bonuses, Advantage and Disadvantage, critical range, Extra Attack and death-save rules. `toggle` and `form` blocks become switches on an Effects tab, with their costs, durations and effects (including `when: { active }` blocks elsewhere); spells cast with a duration are tracked there and their `self-effects` apply (and their `target-effects` when the player marks themselves as the target). Triggers are listed as "When this happens" with their uses. Spell casting reads `action`, `scaling` and the duration header; items apply while active and track `charges`, `cast-list` and `grant-spell` free casts. A Spell Scroll names its spell in brackets ("Spell Scroll (Fireball)"): the scroll's action casts it with the save DC and attack bonus for its level (`variant` `by: spell-level`), only if the spell is on one of the character's class lists (`requires: spell-on-list`), with the ability check first when the spell is above the highest slot the character has; the scroll is used up either way. Weapon rules apply per attack: `use-ability` (Martial Arts, Shillelagh, Pact of the Blade) picks the best allowed ability for hit and damage, `damage-die` replaces the die (or uses it when higher, `if-higher`), `damage-type` adds the type options, and `die-floor` (Great Weapon Fighting) and `maximize` change the damage roll; a `wielding` condition is checked against the equipped weapons. `use-ability` for skills (Primal Knowledge) switches the skill's ability while its `when` holds. `roll-floor` raises the d20 or the total on the checks and saves it names (Reliable Talent, Indomitable Might). `maximize` on healing spells (Supreme Healing) maximizes their healing rolls. `convert` becomes a Convert button on the slots-and-uses bar listing the trades the character can make now (spell slots, Sorcery Points, Wild Shape uses…); created slots with `expires: long` are extra slots until the next Long Rest, `per: long` allows one trade per Long Rest, and `if-empty` offers it only when the pool is empty. The player decides when to trade; the sheet doesn't track turns (`per: turn` is shown, not enforced). The sheet doesn't model turns, areas or other creatures: `zone`, `aura` effects on others, `target-effects` on others and triggers are shown to the player, not resolved. The app no longer reads rules from prose: an entry without Effects is shown but not automated. (The earlier text-reading code is archived, unused, in `src/lib/legacy/text-rules.ts`.)

## Changes from 0.4
0.4 covered every SRD class, subclass, species, feat and background. 0.5 encodes the rest of the character-side SRD: all 339 spells, all 258 magic items, the weapon and armor tables, the 11 weapon properties and 8 mastery properties, 39 pieces of adventuring gear and all 25 tools, the 15 conditions plus Burning, the standard actions and other glossary rules a sheet uses, environmental hazards and the 14 sample poisons. That's 1,068 hand-encoded features plus 25 tools and 51 weapon/armor rows converted by code, all passing `modif_check.py` (`modif-0.5-results.md`). Monsters are deferred to a later version (§12.1).

**Classification of every entry (§16)**
1. Each entry is now classified as one of: *automated*, *partly automated* (prompts or notes), *narrative* (nothing for a sheet to automate: Knock, Legend Lore, Bag of Devouring), *not automated* (no Effects block yet) or *reference* (a definition or rules prose: Ally, Bloodied, most gear). `narrative: true` is the block that says "checked, nothing to automate" (§5.8).

**New blocks**
2. `zone` grew into the main shape for lasting areas (Cloudkill, Spike Growth, Wall of Fire, Moonbeam), with `moves`, `by-turn` and the outcome fields of `action` (§10.1).
3. `condition: [x]` — the affected creature has the condition while the effect lasts (§5.4).
4. `cast-list` — an item's spell table with costs: every staff, rod and wand (§13).
5. `container`, `weapon-property`, `weapon-rule`, `craft`, `suppress` — items and equipment (§13, §20).
6. `auto-fail`, `breaks-concentration`, `rest`, `poison` — conditions, rests and poisons (§20).

**Spells (§11)**
7. Outcome fields used everywhere: `on-hit`, `on-miss`, `on-success`, `on-failure`, `then` (with `at`, `while`, `always`, `event`), `branch` (by target HP), `repeat` (re-use on later turns), `grows`, `delay`, `at: spell-end`.
8. `scaling.per-slot-above` is the spell's base level (it was ambiguous); `scaling.slots` changes duration, concentration and summons by slot; `scaling.multiply`.
9. `revive`, `stabilize`, `grant-rest`, `reduce-hp-max`, `remove-condition`, `exhaustion`, `heal: all | { pool, split }`, `creates` (Goodberry), `summon` on actions, `dispel`.

**Items (§13)**
10. Charges with kinds (Helm of Brilliance gems), random starting charges, per-property recharges, shared resources (Sending Stones), lifetime pools; variants by roll, choice or object value; `preset` (a potion casting a spell with its option chosen); spell `overrides` (`dc`, `attack`, `concentration`, `duration`, `on-end`).

**Equipment and rules (§20, new)**
11. The Weapons and Armor tables are data, converted by code; weapon properties and masteries are rule entries; tools are converted from their header fields; standard actions are entries, so `take: dash` resolves.

**Smaller additions** are listed by block in §21, and the validator knows all of them.

**Conversion pipeline**
12. Three one-time converters draft or convert the predictable parts (`draft_convert.py` for spells, `table_convert.py` for weapons and armor, `tool_convert.py` for tools), and `check_scaling.py` cross-checks hand encodings against the converter's reads. Drafts are always reviewed; the cross-check found 2 of my misses and review found 3 converter errors (§16.1).

## Changes from 0.3
0.3 was tested by encoding the rest of the SRD's character content: Barbarian, Bard, Monk, Paladin, Ranger, Sorcerer and Wizard with their subclasses, the eight remaining species, all 17 feats, the four backgrounds, and one sample of each distinct spell and magic-item pattern (17 spells, 20 items). That's 265 new features, 395 in all (`modif-0.4-results.md`, gap log `modif-0.4-gaps.md`). 0.4 makes three decisions and addresses the 105 gaps the test found, which group into these changes:

**Decisions**
1. **Blocks are the only source of rules** (§1, principle 6). The app reads no rules from text. An entry without an Effects block isn't automated, and it's labelled that way. The text-reading fallback is removed once the SRD pack is converted.
2. **Blocks only; the phrasebook is gone** (§17 removed). `- +1 AC` bullets are no longer valid Modif. The one-time converter for the SRD pack may still read them, but the format and the app don't.
3. **Run-in traits become headings** (§2.4). `***Rage Damage.***` inside a feature is written as its own heading in pack content, so every heading has one Effects block and every block has one heading. A heading may repeat at different levels (Improved Brutal Strike, levels 13 and 17).

**New blocks**
4. **`aura`** (an area around you that affects you and others; Aura of Protection, Spirit Guardians, Holy Avenger) and **`zone`** (an area that stays put; Wall of Fire) (§10.1).
5. **`remove-condition`** (Lay On Hands, Restoring Touch) (§9).
6. **`limit`** for "up to N at once" (Ioun Stones) (§13).

**Giving things to other creatures**
7. **`give`** on `action`: a die or effect another creature holds and uses later (Bardic Inspiration) (§9.1).
8. **`who`** on `trigger`: react to other creatures' rolls and actions, not only your own (Cutting Words, Countercharm, Counterspell, Boon of Fate) (§15).

**Outcomes and follow-ups**
9. **One save-then-outcome pattern** for actions and triggers: `save` + `on-success` / `on-failure`, plus `then` for a follow-up step (Stunning Strike, Relentless Rage, Deflect Attacks, Sleep) (§9, §15).
10. **Per-use counters**: `uses` in expressions, for DCs and costs that climb with each use (Relentless Rage, Overchannel) (§3.6).

**Changing a spell as it's cast**
11. Trigger payload **`spell`** changes range, duration, casting time, components, damage type or slot level, and `spell.<field>` can be read in expressions (all of Metamagic) (§15).
12. **Option groups with a per-cast limit**: `group`, `group-exempt` and `choose.limit` (one Metamagic per spell, two with Sorcery Incarnate) (§7, §15).

**Smaller additions**
13. **Values:** `save-dc:<class>`; `spell.`, `target.`, `form.`, `damage-taken.`, `variant:<id>.<field>`; `score:`/`mod:` of a chosen ability; leading minus; unit literals (`24 hour`); table columns matched ignoring punctuation and case; subclasses read their parent's table (§3.2).
14. **Scopes and filters:** spell filters `save`, `duration`, `scales`, `slot: available`; `tool` filters; `target: { marked-by }`, `grappled-by-you`; built-in sources; empty scope = any (§3.4, §7).
15. **`when`:** `wielding` values, `speed`, `variant` (§3.5).
16. **Activation values** listed in one place, including `attack-action`, `start-of-turn`, `forgo-attack` and timed activations (§3.8).
17. **Numbers:** `set mode: multiply`; `bonus.also-current`; `size: +1 / -1`; `save-rule.miss`; `reroll: { dice, keep }` (§5–6).
18. **Choices:** `kind` lists; `amounts: { choose-one }`; `grants: { prepared, counts-as }` and `grants: spellbook`; `from` and `options` together; `at: new-slot-level` (§7).
19. **Resources:** `unit: minute` with `spend: while-active`; `reset: initiative`; `lifetime`, `start`; created slots that `expire` (§8).
20. **Actions and toggles:** `take` lists; option `id`s in `choose-one` (so patches can address them); `cost.per-pick`; `targets.repeat`; `ability`, `overrides`, `use-ability`, `damage-type` on actions; `choose` and `move` on toggles; `light` (§9, §10).
21. **Spells:** `counts-as`, `free.each`, concentration and component overrides; `target-effects` takes `ends-when`, `on-end`, `choose-one`; the default id `spellcasting`; spellbook settings (§11).
22. **Creatures:** `form.target: other`; `summon.limit`, type override (§12).
23. **Items:** variants by roll, object-valued variants, `modify target: self.base`, `consume: self` on hit, `suppress` (§13).
24. **Triggers:** events `succeed`, `deal-damage`, `enter-area`, `use: <action type>`, `cast: any`, `targeted: spell`; `if-roll` on the trigger itself; payloads `set-hp`, `exhaustion`, `maximize`, `self-damage`, `consume`, `suppress`, `remove-condition` (§15).
25. **Header fields:** a background's `Feat` header with a parenthesis pre-answers the feat's first choice ("Magic Initiate (Cleric)"); a chosen size is a `choose` (§2.3).
26. **Validator:** walks `effects` inside `choose-one` options, checks `take` lists and `kind` lists, finds secondary tables with any header, and reads the last segment of a patched field path (§16).

## Changes from 0.2
0.2 was tested by encoding Druid + Circle of the Land, Warlock + Fiend Patron (with 12 invocations), Demon Armor and Staff of Fire, on top of the earlier 82 features (131 in all); see `modif-0.3-results.md`. 0.3 adds:
1. **Options under their own headings**, with structured **prerequisites** and **repeatable** picks: Eldritch Invocations (§7.1).
2. **Secondary class tables:** `table:<Table>.<Column>`, with Yes/No columns read as true/false (§3.2).
3. **Alternative costs:** `cost: { any: [ … ] }` (§9).
4. **`form` takes every `toggle` field** (`ends-when`, `blocks`, `leave`, `effects`) (§12).
5. **Spell additions:** `target: self`, `maximize`, `auto-succeed` on granted spells; a spell's `id` in scopes; `range` as a stat path and a filter; picking the spell at the moment of casting (`at-use`) (§3.3, §3.4, §11.1).
6. **Recovering slots by total level** (`regain: { resource: spell-slots, levels, max-slot }`) and `regain` on actions (§9, §15).
7. **`choose kind: item`** (a pact weapon), filters over spells you know, swap lists (`at: [short, long]`), `per: roll` (§3.6, §7).
8. **`trait`** for non-numeric abilities such as breathing underwater; **`devils-sight`** as a sense (§5.3, §5.7).
9. **Items:** `damage-die` can change the damage type; `curse` has its own `effects` and `ends`; attunement restrictions in the tagline are read as data (§6.5, §13).

## Changes from 0.1
0.1 was tested by hand-encoding 65 features (Fighter, Champion, Rogue, Thief, Dragonborn, three feats, five items, five spells); see `effects-0.1-test-findings.md`. 0.2:
1. **Removes every `on:` key.** YAML 1.1 parsers read a bare `on` as *true*. Triggers use `event:`, roll effects use `roll:`, rests use `at:`, notes use `stat:` (§2.2).
2. **Adds values:** level `steps`, `variant:<id>` and cost amounts (§3.2).
3. **Adds class plumbing:** `hit-die`, `multiclass`, `equipment`, `choose kind: subclass`, and `at:` for features that recur at several levels (§3.7, §5.6).
4. **Extends `choose`:** filters over the character's own state, `swap` counts, choices made each time you use something (§7).
5. **Extends `action`:** `take` (standard actions), `check`, `consume`, `requires`, `cast`/`cast-at` (§9).
6. **Adds `set` modes, `until: end-of-turn`, `when` keys `condition` / `in-combat` / `has`, and built-in resources** (§3.5, §3.6, §6.2, §8.3).
7. **Adds trigger events** `attack`, `spend`, `target-drops`; **payloads** `damage-taken`, `refund`; **costs** `dice-from` (§15).
8. **Says which facts are header fields, not blocks** (§2.3), and **when to use `modify` vs. `steps`** (§14.1).
9. **Makes the validator part of the importer** (§16).
10. **Quoting rule for expressions with commas** (§3.2). `max(1, mod:cha)` inside `{ … }` was silently split by YAML, the same class of bug as `on`. Adds the function forms `steps(…)` and `dice(count, die)`.
11. **Spellcasting additions from encoding Cleric and Life Domain:** `slot-level`, filter comparisons and `not`, `targets` fields, `apply` with `ends-on` and several conditions, `applies-to: failed-save`, `cast: { choose-on-use: … }`, `cast-options`, `lockout`, and spellcasting `change` (§3.2, §7, §9, §11.3).
