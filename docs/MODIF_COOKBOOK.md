# Modif 0.6 cookbook: writing Effects from rules text

**The authoring guide for Modif 0.6.** It's informative: the spec, [`MODIF.md`](MODIF.md), is normative and defines every block, field and value. Where they disagree, the spec wins. Lines marked *fivepointfive:* describe that app's behavior, not Modif.

This cookbook is the how-to. It maps the phrases rules text uses to the blocks that express them, using patterns from the SRD 5.2.1 pack. When a recipe doesn't cover something, find the closest SRD entry and copy its shape.

Effects restate the rules as data. The text stays what players read; when the two disagree, the text is right and the Effects get fixed.

## 1. Method

1. **Read the whole feature first:** its tables, its "At Higher Levels" text, and the later features that change it (a level 14 feature that adds to a level 3 one is a `modify` on the level 3 block).
2. **One rule, one block.** Go sentence by sentence. Each sentence that changes a number, gives a choice, uses a resource or does something on the sheet becomes a block. Sentences that only explain stay text.
3. **Header fields are data already.** Don't repeat Hit Point Die, Speed, Size, a background's skills and feat, spell headers or item taglines as blocks.
4. **Put the block under its feature.** `## Effects` with a `yaml` block right after the feature's text, before the next heading. A run-in trait that carries rules (`***Rooted.*** …`) becomes its own heading first.
5. **Prefer structure over notes.** If a block can say it, use the block, even if the app only shows it as a reminder today. Use `note`, `player` conditions or `custom` only for what really can't be said (section 15).
6. **Check it.** Run the validator (`python3 tools/modif_check.py <pack folder>`), then build a character with it in an app that reads Modif and look at the sheet.

In the recipes, *"…"* is the rules phrase and the block below it is the encoding. *From* names an SRD entry that does it.

## 2. Proficiencies and choices

*"You gain proficiency in the Athletics skill and with Smith's Tools."*
```yaml
- proficiency: [skill:athletics, tool:smiths-tools]
```

*"Saving Throw Proficiencies: Strength and Constitution"* (class core traits; the field is shown, the block grants it)
```yaml
- proficiency: [save:str, save:con, weapon:simple, weapon:martial, armor:light, armor:medium, armor:shield]
```

*"Skill Proficiencies: Choose 2: Athletics, History, or Survival"* (a class's skill choice; *fivepointfive:* the builder's class-skills step reads the choice whose id is `skills`)
```yaml
- choose: { id: skills, kind: skill, count: 2, grants: proficiency, from: [athletics, history, survival] }
```

*"You gain proficiency in one skill of your choice."*
```yaml
- choose: { id: skill-pick, kind: skill, count: 1, grants: proficiency, from: any }
```

*"Choose one of your skill proficiencies. You gain Expertise in that skill."* (from: Bard)
```yaml
- choose: { id: expertise-pick, kind: skill, count: 1, grants: expertise, from: { proficient: skill, not: { expertise: skill } } }
```

*"You can add half your Proficiency Bonus to any ability check that doesn't already use it."* (from: Bard, Jack of All Trades)
```yaml
- half-proficiency: { scope: check:all, unless: proficient }
```

*"You have proficiency with Martial weapons that have the Finesse or Light property."* (a list means any of them; from: Rogue)
```yaml
- proficiency: [{ weapon: { category: martial, property: [finesse, light] } }]
```

*"Choose one of the following options."* with options of its own (from: Dragonborn ancestry)
```yaml
- choose: { id: ancestry, kind: option, options: [ { id: red, label: Red, damage: fire }, { id: blue, label: Blue, damage: lightning } ] }
- defense: { resistance: [choice:ancestry.damage] }
```
Read a picked option's fields with `choice:<id>.<field>`.

*"You learn one Fighting Style feat of your choice."* (from: Fighter)
```yaml
- choose: { id: fighting-style, kind: feat, count: 1, from: { feat: { category: fighting-style } }, swap: level-up, default: $srd/feats/defense }
```

*Invocations, maneuvers, metamagic:* the choice lists the options, and each option heading carries `option: { of: … }` above its own blocks (see MODIF.md §7.1).

## 3. Ability scores and Hit Points

*"Increase your Constitution score by 1, to a maximum of 20."*
```yaml
- score: { con: 1 }
```

*"Increase one ability score of your choice by 1."* (a feat with a choice; `max` raises the cap for Epic Boons)
```yaml
- choose: { id: boon-asi, kind: ability, from: [str, dex], amounts: [1], max: 30 }
```

*"Your Hit Point maximum increases by an amount equal to your level."* (from: Dwarf, Dwarven Toughness)
```yaml
- bonus: { to: hp:max, value: level }
```

*"Your Strength score is 19 while you wear it."* (only raises a lower score; from: Gauntlets of Ogre Power)
```yaml
- set: { to: score:str, value: 19 }
```

## 4. Armor Class

*"While you aren't wearing armor, your base Armor Class equals 10 plus your Dexterity and Constitution modifiers."* (from: Barbarian)
```yaml
- base: { to: ac, value: 10 + mod:dex + mod:con, when: { armor: none } }
```
Add `allow-shield: true` when a Shield still counts, or `shield: false` to the `when` when it doesn't (Monk).

*"You gain a +1 bonus to Armor Class while you're wearing armor."* (from: Defense)
```yaml
- bonus: { to: ac, value: 1, when: { armor: [light, medium, heavy] } }
```

*"Your AC can't be less than 17."* (from: Barkskin)
```yaml
- set: { to: ac, value: 17 }
```

*"You have a +1 bonus to AC and saving throws."* (one block, two paths; from: Cloak of Protection)
```yaml
- bonus: { to: [ac, save:all], value: 1 }
```

## 5. Speed and senses

*"You have a Climb Speed equal to your Speed."* (from: Thief)
```yaml
- speed: { climb: speed:walk }
```

*"Your Speed increases by 10 feet while you aren't wearing Heavy armor."* (from: Barbarian, Fast Movement)
```yaml
- bonus: { to: speed:walk, value: 10, when: { not: { armor: heavy } } }
```

*"You have Darkvision with a range of 60 feet."*
```yaml
- sense: { darkvision: 60 }
```

## 6. Damage and condition defenses

*"You have Resistance to Cold damage."*
```yaml
- defense: { resistance: [cold] }
```

*"You have Immunity to Poison damage and the Poisoned condition."* (from: Periapt of Proof against Poison)
```yaml
- defense: { immunity: [poison], condition-immunity: [poisoned] }
```

*"While raging, you have Resistance to Bludgeoning, Piercing, and Slashing damage."* goes inside the toggle's `effects` (section 10).

## 7. Advantage and Disadvantage

*"You have Advantage on Initiative rolls."*
```yaml
- advantage: { roll: initiative }
```

*"You have Advantage on saving throws to avoid or end the Poisoned condition."* (the sheet can't see the condition coming, so it becomes a note on saves)
```yaml
- advantage: { roll: save:all, scope: { against: { condition: poisoned } } }
```

*"You have Advantage on Dexterity saving throws."*
```yaml
- advantage: { roll: save:dex }
```

*"…while you're in Dim Light or Darkness."* (only the player knows: becomes a switch on the sheet; from: Boon of the Night Spirit)
```yaml
- advantage: { roll: skill:stealth, when: { player: "In Dim Light or Darkness" } }
```

*"Creatures have Disadvantage on attack rolls against you."* is about someone else's roll. Write it as `disadvantage: { roll: attacks-against-you }`, narrowed with a scope when the text does (from: Spellguard Shield, `scope: { attack: spell }`); the sheet shows it as a reminder.

## 8. Bonuses to rolls and damage

*"When you roll Initiative, you can add your Proficiency Bonus to the roll."* (from: Alert)
```yaml
- bonus: { to: initiative, value: prof }
```

*"You gain a +2 bonus to attack rolls you make with Ranged weapons."* (from: Archery)
```yaml
- bonus: { to: attack, value: 2, scope: { weapon: { kind: ranged } } }
```

*"You gain a +2 bonus to damage rolls with Longbows and Shortbows."* (a weapon scope by id)
```yaml
- bonus: { to: damage, value: 2, scope: { weapon: { id: [longbow, shortbow] } } }
```

*"Add your Intelligence modifier to one damage roll of any Wizard Evocation spell you cast."* (from: Evoker)
```yaml
- bonus: { to: damage, value: mod:int, once: true, scope: { spell: { list: wizard, school: evocation } } }
```

*"Your attack rolls with weapons can score a Critical Hit on a roll of 19 or 20."* (from: Champion)
```yaml
- crit-range: { value: 19, scope: { any: [ { weapon: {} }, { weapon: { unarmed: true } } ] } }
```

*"You can attack twice instead of once whenever you take the Attack action."*
```yaml
- extra-attack: { total: 2 }
```

*Weapon rules* (all applied per attack on the sheet):
```yaml
# "You can use Dexterity instead of Strength for the attack and damage rolls of your Unarmed Strikes and Monk weapons."
- use-ability: { ability: dex, instead-of: str, for: [attack, damage], scope: { any: [ { weapon: { unarmed: true } }, { weapon: { monk: true } } ] } }
# "You can roll 1d6 in place of the normal damage of your Unarmed Strike or Monk weapon." (the die grows with the class table)
- damage-die: { die: table:Martial Arts, if-higher: true, scope: { weapon: { unarmed: true } } }
# "Treat any 1 or 2 on a damage die as a 3." (Great Weapon Fighting)
- die-floor: { min: 3, scope: { weapon: { kind: melee, hands: two } } }
# "Whenever you make an ability check that uses your proficiency, treat a d20 roll of 9 or lower as a 10." (Reliable Talent)
- roll-floor: { roll: [check:all], min: 10, when-proficient: true }
```

## 9. Limited uses

Every "a number of times", "once per Long Rest" or pool of points is a `resource`. Whatever spends it says `cost: { resource: $#<id> }`.

*"You can use this feature twice. You regain one expended use when you finish a Short Rest, and you regain all expended uses when you finish a Long Rest."* (the class table has the count; from: Barbarian, Rage)
```yaml
- resource: { id: rages, max: table:Rages, reset: long, partial: { at: short, amount: 1 } }
```

*"You can use this feature a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest."*
```yaml
- resource: { id: uses, max: prof, reset: long }
```

*"…a number of times equal to your Charisma modifier (minimum of once)."* (quote it: it has a comma)
```yaml
- resource: { id: cha-uses, max: "max(1, mod:cha)", reset: long }
```

*"You can use it once; you gain another use at level 17."* (no table column: use `steps`; from: Fighter, Action Surge)
```yaml
- resource: { id: action-surge, max: { steps: { 2: 1, 17: 2 } }, reset: short }
```

*"Once you use this feature, you can't use it again until you finish a Long Rest."* on an action with no named pool: write `per: long` on the action itself; it gets a use counter of its own (MODIF.md §3.6).

*"The item has 3 charges and regains 1d3 expended charges daily at dawn."* (items use `charges`; from: Cloak of Invisibility)
```yaml
- charges: { max: 3, recharge: { dice: 1d3, at: dawn } }
```

*"You can expend a spell slot to regain one use."* or *"…to gain Sorcery Points equal to the slot's level."* (a trade the player makes)
```yaml
- convert: { from: { slot: any }, to: { resource: $#sorcery-points, amount: cost.slot } }
```

## 10. Things the character does

*"As a Bonus Action, you can regain Hit Points equal to 1d10 plus your Fighter level."* (from: Fighter, Second Wind)
```yaml
- action: { id: second-wind, activation: bonus, cost: { resource: $#second-wind }, heal: 1d10 + level:fighter }
```

*"As a Bonus Action, you can take the Dash, Disengage, or Hide action."* (from: Rogue, Cunning Action)
```yaml
- action: { id: cunning-action, activation: bonus, choose-one: [ { take: dash }, { take: disengage }, { take: hide } ] }
```

*"…or expend 1 Focus Point to take both the Disengage and Dodge actions."* (an option with its own cost, paid only when that option is picked; from: Monk)
```yaml
- action: { id: patient-defense, activation: bonus,
            choose-one: [ { id: basic, take: disengage }, { id: focused, take: [disengage, dodge], cost: { resource: $#focus } } ] }
```

*"You can expend 1 Focus Point to make two Unarmed Strikes as a Bonus Action."* (an attack action: the sheet rolls the attacks; from: Monk, Flurry of Blows)
```yaml
- action: { id: flurry-of-blows, activation: bonus, cost: { resource: $#focus }, attack: { weapon: unarmed, count: 2 } }
```

*"Each creature in a 15-foot Cone makes a Dexterity saving throw, taking 1d10 Fire damage on a failed save or half as much on a success."* (from: Dragonborn, Breath Weapon)
```yaml
- action: { id: breath, activation: replace-attack, area: { shape: cone, size: 15 },
            save: { ability: dex, dc: 8 + mod:con + prof, success: half }, damage: { dice: 1d10, type: choice:ancestry.damage } }
```

*"You gain Temporary Hit Points equal to your Druid level."*: `temp-hp: level:druid` on the action.

Activations: `action`, `bonus`, `reaction`, `magic`, `none`, `replace-attack` (instead of one attack), `attack-action`. Use `utilize` for items you use.

## 11. Things you switch on

Anything that lasts (Rage, a form, activating a cloak) is a `toggle`. Its `effects` apply only while it's on, and other blocks can check it with `when: { active: $#<id> }`.

*"As a Bonus Action, you can enter a Rage for 10 minutes… While active, you have Resistance to Bludgeoning, Piercing, and Slashing damage and a bonus to damage with Strength attacks. It ends early if you don Heavy armor or have the Incapacitated condition."*
```yaml
- toggle:
    id: rage
    activation: bonus
    cost: { resource: $#rages }
    duration: { until: end-of-next-turn, max: { amount: 10, unit: minute } }
    ends-when: [{ armor: heavy }, { condition: incapacitated }]
    effects:
      - defense: { resistance: [bludgeoning, piercing, slashing] }
      - bonus: { to: damage, value: table:Rage Damage, scope: { ability: str } }
- advantage: { roll: check:str, when: { active: $#rage } }
```

*"While wearing this cloak, you can take a Magic action to become Invisible for 1 hour, spending 1 charge."* (from: Cloak of Invisibility)
```yaml
- toggle: { activation: magic, cost: { charges: 1 }, duration: { amount: 1, unit: hour }, effects: [ { condition: [invisible] } ] }
```

Shapes you turn into (Wild Shape, Starry Form) are a `form`: like a toggle, plus what you keep and what's replaced.

## 12. When something happens

Reactions and "when X, you can Y" are `trigger`s. *fivepointfive:* the sheet lists them with their remaining uses and offers them after its own rolls; it doesn't track what happens at the table.

*"Once per turn, when you hit a target with a weapon, you can roll the weapon's damage dice twice and use either roll."* (from: Savage Attacker)
```yaml
- trigger: { event: hit, scope: { weapon: {} }, per: turn, offer: { reroll: { roll: damage, keep: either } } }
```

*"When you fail an ability check, you can roll 1d10 and add it, possibly turning it into a success; the use is spent only if it succeeds."* (from: Fighter, Tactical Mind)
```yaml
- trigger: { event: { fail: check }, offer: { add-roll: 1d10, cost: { resource: $#second-wind }, refund: if-fails } }
```

*"When you fail a Dexterity saving throw, you can succeed instead."* (spending a charge; from: Ring of Evasion)
```yaml
- trigger: { event: { fail: save }, scope: { ability: dex }, reaction: true, offer: { treat-as: success, cost: { charges: 1 } } }
```

Events include `hit`, `miss`, `crit`, `hit-by`, `damaged`, `{ fail: save | check | d20 }`, `{ roll: initiative }`, `{ use: <id> }`, `zero-hp`, `start-of-turn`, `end-of-turn`, `cast`, `rest`. Add `reaction: true` when it takes your Reaction.

*"Whenever you roll a 1 on a death saving throw, treat it as…"* and similar fixed changes to a roll are `treat-roll`; *"reroll it and use the new roll"* is `reroll` (as a trigger offer when it's optional).

## 13. Spells

**A spell entry** (attack, save, healing, upcasting):
```yaml
# Fire Bolt
- action: { attack: { kind: ranged-spell }, damage: { dice: 1d10, type: fire } }
- scaling: { cantrip: [5, 11, 17], add: { damage: 1d10 } }
# Fireball
- action: { area: { shape: sphere, size: 20 }, save: { ability: dex, success: half }, damage: { dice: 8d6, type: fire } }
- scaling: { per-slot-above: 3, add: { damage: 1d6 } }
# Cure Wounds
- action: { range: touch, heal: 2d8 + spell-ability }
- scaling: { per-slot-above: 1, add: { heal: 2d8 } }
```
`per-slot-above` is always the spell's own level.

**What a spell does while it lasts:** `self-effects` (on the caster: the sheet applies it while the spell is active) and `target-effects` (on the target: shown).
```yaml
# Shield of Faith
- action: { targets: { count: 1 } }
- target-effects: { effects: [ { bonus: { to: ac, value: 2 } } ] }
```

**Spells a feature gives:**
```yaml
# "You know the Light cantrip. Charisma is your spellcasting ability for it."
- grant-spell: { spell: $srd/spells/light, ability: cha }
# "You can cast Speak with Animals a number of times equal to your Proficiency Bonus without a spell slot; you regain all uses on a Long Rest."
- grant-spell: { spell: $srd/spells/speak-with-animals, prepared: always, free: { per: long, count: prof } }
# "You always have these spells prepared" (subclass spell tables)
- spell-list: { prepared: always, by-level: { 3: [$srd/spells/aid, $srd/spells/bless], 5: [$srd/spells/revivify] } }
```

**Spellcasting** (a class, or a subclass like an Eldritch Knight):
```yaml
- spellcasting: { ability: int, progression: full, prepared: table:Prepared Spells, cantrips: table:Cantrips, list: wizard }
- spellcasting: { ability: int, progression: third, list: wizard, cantrips: "steps(3: 2, 10: 3)" }
```

## 14. Class structure and items

**Class core traits** need, besides proficiencies and the `skills` choice: `hit-die`, `multiclass` (exactly what "As a Multiclass Character" grants) and `equipment`. Ability Score Improvement and Epic Boon are feat choices:
```yaml
- hit-die: d10
- multiclass: [hit-die, weapon:martial, armor:light, armor:medium, armor:shield]
- choose: { id: asi, kind: feat, from: { feat: { qualify: true } }, default: $srd/feats/ability-score-improvement, at: [4, 6, 8, 12, 14, 16] }
```

**Magic items** apply while equipped, and attuned if they need it.
```yaml
# "+1, +2, or +3 Weapon": the bonus comes from the rarity in the item's name
- variant: { id: plus, by: rarity, values: { uncommon: 1, rare: 2, very-rare: 3 } }
- bonus: { to: [attack, damage], value: variant:plus, scope: { weapon: { id: self } } }
# "Potion of Healing" variants by name, drunk as a Bonus Action and used up
- variant: { id: heal, by: name, values: { "": 2d4+2, greater: 4d4+4, superior: 8d4+8, supreme: 10d4+20 } }
- action: { activation: bonus, heal: variant:heal, consume: true }
# A staff that casts spells from its charges
- cast-list: { pay-from: charges, spells: [ { spell: $srd/spells/heal, cost: 1 }, { spell: $srd/spells/resurrection, cost: 5 } ] }
```
A cursed item adds `curse: { prevents: [unattune], ends: { spell: $srd/spells/remove-curse } }`.

**A later feature that changes an earlier one** is a `modify` on its block (*"Your Patient Defense also grants Temporary Hit Points"*), and a feature that swaps one out is `replace`.

## 15. When nothing fits

In order of preference:

1. **The nearest faithful blocks**, with a short `text:` for the part they miss.
2. **`note`**, shown next to a stat and never calculated: `- note: { stat: initiative, text: "…" }`.
3. **`narrative: true`**, when there's truly nothing for a sheet to track (flavor, social effects).
4. **`custom`**, only when the sheet needs code to act on it: `- custom: { handler: <name>, params: { … }, text: "<the rule in words>" }`. An app without the handler shows the text as a reminder. List it in your report so a handler, or later a real block, can be added.

## 16. Pitfalls

- **Quote anything with a comma, colon or `#`.** `value: max(1, mod:cha)` is silently split by YAML; write `value: "max(1, mod:cha)"`.
- **No YAML-reserved words as keys:** `on`, `off`, `yes`, `no`, `true`, `false`, `y`, `n`.
- **Ids are stable** (MODIF.md §3.1). Keep entry and choice ids the same in later versions of a pack: apps store characters' picks by them.
- **`$#id` is this entry; `$srd/…` is the SRD pack; `$<pack-id>/…` is another pack.**
- **Don't encode a summary.** Encode from the full text, including the table columns and the levels that change a feature.
- **Encode a class completely.** Blocks are the only source of rules (MODIF.md §1): whatever a class's Effects leave out (saves, skills, resources, features) isn't on the sheet.
- **Don't bend the rules to an app.** If an app can't act on a block yet, write the block anyway: it shows as a reminder now and works when the app catches up.
