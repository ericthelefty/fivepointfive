# Sorcerer
**Type:** Class
**Source:** SRD 5.2.1, p. 64

## Core Sorcerer Traits

**Primary Ability:** Charisma
**Hit Point Die:** D6 per Sorcerer level
**Saving Throw Proficiencies:** Constitution and Charisma
**Skill Proficiencies:** Choose 2: Arcana, Deception, Insight, Intimidation, Persuasion, or Religion
**Weapon Proficiencies:** Simple weapons
**Armor Training:** None
**Starting Equipment:** Choose A or B: (A) Spear, 2 Daggers, Arcane Focus (crystal), Dungeoneer’s Pack, and 28 GP; or (B) 50 GP

## Effects
```yaml
- hit-die: d6
- proficiency: [save:con, save:cha, weapon:simple]
- choose: { id: skills, kind: skill, count: 2, grants: proficiency, from: [arcana, deception, insight, intimidation, persuasion, religion] }
- multiclass: [hit-die]
- equipment:
    options:
      - { id: a, items: [spear, { dagger: 2 }, arcane-focus, dungeoneers-pack], gp: 28 }
      - { id: b, gp: 50 }
```

## Becoming a Sorcerer …

### As a Level 1 Character

- Gain all the traits in the Core Sorcerer Traits table.
- Gain the Sorcerer’s level 1 features, which are listed in the Sorcerer Features table.

### As a Multiclass Character

- Gain the Hit Point Die from the Core Sorcerer Traits table.
- Gain the Sorcerer’s level 1 features, which are listed in the Sorcerer Features table. See the multiclassing rules in “Character Creation” to determine your available spell slots.

## Sorcerer Class Features

As a Sorcerer, you gain the following class features when you reach the specified Sorcerer levels. These features are listed in the Sorcerer Features table.

### Level 1: Spellcasting

Drawing from your innate magic, you can cast spells. See “Spells” for the rules on spellcasting. The information below details how you use those rules with Sorcerer spells, which appear in the Sorcerer spell list later in the class’s description.

***Cantrips.*** You know four Sorcerer cantrips of your choice. *Light, Prestidigitation, Shocking Grasp*, and *Sorcerous Burst* are recommended. Whenever you gain a Sorcerer level, you can replace one of your cantrips from this feature with another Sorcerer cantrip of your choice.

When you reach Sorcerer levels 4 and 10, you learn another Sorcerer cantrip of your choice, as shown in the Cantrips column of the Sorcerer Features table.

***Spell Slots.*** The Sorcerer Features table shows how many spell slots you have to cast your level 1+ spells. You regain all expended slots when you finish a Long Rest.

***Prepared Spells of Level 1+.*** You prepare the list of level 1+ spells that are available for you to cast with this feature. To start, choose two level 1 Sorcerer spells. *Burning Hands* and *Detect Magic* are recommended.

The number of spells on your list increases as you gain Sorcerer levels, as shown in the Prepared Spells column of the Sorcerer Features table. Whenever that number increases, choose additional Sorcerer spells until the number of spells on your list matches the number in the Sorcerer Features table. The chosen spells must be of a level for which you have spell slots. For example, if you’re a level 3 Sorcerer, your list of prepared spells can include six Sorcerer spells of level 1 or 2 in any combination.

If another Sorcerer feature gives you spells that you always have prepared, those spells don’t count against the number of spells you can prepare with this feature, but those spells otherwise count as Sorcerer spells for you.

***Changing Your Prepared Spells.*** Whenever you gain a Sorcerer level, you can replace one spell on your list with another Sorcerer spell for which you have spell slots.

***Spellcasting Ability.*** Charisma is your spellcasting ability for your Sorcerer spells.

***Spellcasting Focus.*** You can use an Arcane Focus as a Spellcasting Focus for your Sorcerer spells.

## Effects
```yaml
- spellcasting: { ability: cha, progression: full, list: sorcerer, focus: arcane-focus,
                  cantrips: table:Cantrips, prepared: table:Prepared Spells, change: { prepared: level-up, cantrips: level-up } }
- choose: { id: cantrips, kind: spell, count: table:Cantrips, from: { spell: { list: sorcerer, level: 0 } }, swap: { at: level-up, count: 1 },
            default: [$srd/spells/light, $srd/spells/prestidigitation, $srd/spells/shocking-grasp, $srd/spells/sorcerous-burst] }
```

### Level 1: Innate Sorcery

An event in your past left an indelible mark on you, infusing you with simmering magic. As a Bonus Action, you can unleash that magic for 1 minute, during which you gain the following benefits:

## Effects
```yaml
- resource: { id: innate-sorcery, max: 2, reset: long }
- toggle:
    id: innate-sorcery
    activation: bonus
    cost: { resource: $#innate-sorcery }
    duration: { amount: 1, unit: minute }
    effects:
      - bonus: { to: spell:dc, value: 1, scope: { spell: { list: sorcerer } } }
      - advantage: { roll: attack, scope: { spell: { list: sorcerer } } }
```

#### Sorcerer Features

| Level | Proficiency Bonus | Class Features | Sorcery Points | Cantrips | Prepared Spells | Spell Slots per Spell Level 1 | Spell Slots per Spell Level 2 | Spell Slots per Spell Level 3 | Spell Slots per Spell Level 4 | Spell Slots per Spell Level 5 | Spell Slots per Spell Level 6 | Spell Slots per Spell Level 7 | Spell Slots per Spell Level 8 | Spell Slots per Spell Level 9 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | +2 | Spellcasting, Innate Sorcery | — | 4 | 2 | 2 | — | — | — | — | — | — | — | — |
| 2 | +2 | Font of Magic, Metamagic | 2 | 4 | 4 | 3 | — | — | — | — | — | — | — | — |
| 3 | +2 | Sorcerer Subclass | 3 | 4 | 6 | 4 | 2 | — | — | — | — | — | — | — |
| 4 | +2 | Ability Score Improvement | 4 | 5 | 7 | 4 | 3 | — | — | — | — | — | — | — |
| 5 | +3 | Sorcerous Restoration | 5 | 5 | 9 | 4 | 3 | 2 | — | — | — | — | — | — |
| 6 | +3 | Subclass feature | 6 | 5 | 10 | 4 | 3 | 3 | — | — | — | — | — | — |
| 7 | +3 | Sorcery Incarnate | 7 | 5 | 11 | 4 | 3 | 3 | 1 | — | — | — | — | — |
| 8 | +3 | Ability Score Improvement | 8 | 5 | 12 | 4 | 3 | 3 | 2 | — | — | — | — | — |
| 9 | +4 | — | 9 | 5 | 14 | 4 | 3 | 3 | 3 | 1 | — | — | — | — |
| 10 | +4 | Metamagic | 10 | 6 | 15 | 4 | 3 | 3 | 3 | 2 | — | — | — | — |
| 11 | +4 | — | 11 | 6 | 16 | 4 | 3 | 3 | 3 | 2 | 1 | — | — | — |
| 12 | +4 | Ability Score Improvement | 12 | 6 | 16 | 4 | 3 | 3 | 3 | 2 | 1 | — | — | — |
| 13 | +5 | — | 13 | 6 | 17 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | — | — |
| 14 | +5 | Subclass feature | 14 | 6 | 17 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | — | — |
| 15 | +5 | — | 15 | 6 | 18 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | 1 | — |
| 16 | +5 | Ability Score Improvement | 16 | 6 | 18 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | 1 | — |
| 17 | +6 | Metamagic | 17 | 6 | 19 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | 1 | 1 |
| 18 | +6 | Subclass feature | 18 | 6 | 20 | 4 | 3 | 3 | 3 | 3 | 1 | 1 | 1 | 1 |
| 19 | +6 | Epic Boon | 19 | 6 | 21 | 4 | 3 | 3 | 3 | 3 | 2 | 1 | 1 | 1 |
| 20 | +6 | Arcane Apotheosis | 20 | 6 | 22 | 4 | 3 | 3 | 3 | 3 | 2 | 2 | 1 | 1 |

- The spell save DC of your Sorcerer spells increases by 1.
- You have Advantage on the attack rolls of Sorcerer spells you cast.

You can use this feature twice, and you regain all expended uses of it when you finish a Long Rest.

### Level 2: Font of Magic

You can tap into the wellspring of magic within yourself. This wellspring is represented by Sorcery Points, which allow you to create a variety of magical effects.

You have 2 Sorcery Points, and you gain more as you reach higher levels, as shown in the Sorcery Points column of the Sorcerer Features table. You can’t have more Sorcery Points than the number shown in the table for your level. You regain all expended Sorcery Points when you finish a Long Rest.

You can use your Sorcery Points to fuel the options below, along with other features, such as Metamagic, that use those points.

***Converting Spell Slots to Sorcery Points.*** You can expend a spell slot to gain a number of Sorcery Points equal to the slot’s level (no action required).

***Creating Spell Slots.*** As a Bonus Action, you can transform unexpended Sorcery Points into one spell slot. The Creating Spell Slots table shows the cost of creating a spell slot of a given level, and it lists the minimum Sorcerer level you must be to create a slot. You can create a spell slot no higher than level 5.

Any spell slot you create with this feature vanishes when you finish a Long Rest.

## Effects
```yaml
- resource: { id: sorcery-points, max: table:Sorcery Points, reset: long }
- convert: { from: { slot: any }, to: { resource: $#sorcery-points, amount: cost.slot }, activation: none }
- convert:
    from: { resource: $#sorcery-points, amount: "table:Creating Spell Slots.Sorcery Point Cost" }
    to: { slot: "table:Creating Spell Slots.Spell Slot Level", max-slot: 5, min-level: "table:Creating Spell Slots.Min. Sorcerer Level", expires: long }
    activation: bonus
```

#### Creating Spell Slots

| Spell Slot Level | Sorcery Point Cost | Min. Sorcerer Level |
|---|---|---|
| 1 | 2 | 2 |
| 2 | 3 | 3 |
| 3 | 5 | 5 |
| 4 | 6 | 7 |
| 5 | 7 | 9 |

### Level 2: Metamagic

Because your magic flows from within, you can alter your spells to suit your needs; you gain two Metamagic options of your choice from “Metamagic Options” later in this class’s description. You use the chosen options to temporarily modify spells you cast. To use an option, you must spend the number of Sorcery Points that it costs.

You can use only one Metamagic option on a spell when you cast it unless otherwise noted in one of those options.

Whenever you gain a Sorcerer level, you can replace one of your Metamagic options with one you don’t know. You gain two more options at Sorcerer level 10 and two more at Sorcerer level 17.

## Effects
```yaml
- choose: { id: metamagic, kind: option, count: { steps: { 2: 2, 10: 4, 17: 6 } }, swap: { at: level-up, count: 1 },
            options: { headings-under: Metamagic Options }, limit: { per: cast, count: 1 } }
```

### Level 3: Sorcerer Subclass

You gain a Sorcerer subclass of your choice. The Draconic Sorcery subclass is detailed after this class’s description. A subclass is a specialization that grants you features at certain Sorcerer levels. For the rest of your career, you gain each of your subclass’s features that are of your Sorcerer level or lower.

## Effects
```yaml
- choose: { id: subclass, kind: subclass, from: { subclass: { parent: $srd/sorcerer } } }
```

### Level 4: Ability Score Improvement

You gain the Ability Score Improvement feat (see “Feats”) or another feat of your choice for which you qualify. You gain this feature again at Sorcerer levels 8, 12, and 16.

## Effects
```yaml
- choose: { id: asi, kind: feat, from: { feat: { qualify: true } }, default: $srd/feats/ability-score-improvement, at: [4, 8, 12, 16] }
```

### Level 5: Sorcerous Restoration

When you finish a Short Rest, you can regain expended Sorcery Points, but no more than a number equal to half your Sorcerer level (round down). Once you use this feature, you can’t do so again until you finish a Long Rest.

## Effects
```yaml
- trigger: { event: { rest: short }, per: long, offer: { regain: { resource: $#sorcery-points, amount: half(level:sorcerer) } } }
```

### Level 7: Sorcery Incarnate

If you have no uses of Innate Sorcery left, you can use it if you spend 2 Sorcery Points when you take the Bonus Action to activate it.

In addition, while your Innate Sorcery feature is active, you can use up to two of your Metamagic options on each spell you cast.

## Effects
```yaml
- convert: { from: { resource: $#sorcery-points, amount: 2 }, to: { resource: $#innate-sorcery, amount: 1 }, activation: none, if-empty: true }
- modify: { target: $#metamagic, set: { limit.count: 2 }, when: { active: $#innate-sorcery } }
```

### Level 19: Epic Boon

You gain an Epic Boon feat (see “Feats”) or another feat of your choice for which you qualify. Boon of Dimensional Travel is recommended.

## Effects
```yaml
- choose: { id: epic-boon, kind: feat, from: { feat: { qualify: true } }, default: $srd/feats/boon-of-dimensional-travel }
```

### Level 20: Arcane Apotheosis

While your Innate Sorcery feature is active, you can use one Metamagic option on each of your turns without spending Sorcery Points on it.

## Effects
```yaml
- modify: { target: $#metamagic, set: { free: { per: turn, count: 1 } }, when: { active: $#innate-sorcery } }
```

## Metamagic Options

The following options are available to your Meta magic feature. The options are presented in alphabetical order.

### Careful Spell

*Cost: 1 Sorcery Point*

When you cast a spell that forces other creatures to make a saving throw, you can protect some of those creatures from the spell’s full force. To do so, spend 1 Sorcery Point and choose a number of those creatures up to your Charisma modifier (minimum of one creature). A chosen creature automatically succeeds on its saving throw against the spell, and it takes no damage if it would normally take half damage on a successful save.

## Effects
```yaml
- option: { of: $#metamagic }
- trigger: { event: cast, group: metamagic, scope: { spell: { save: any } },
             offer: { cost: { resource: $#sorcery-points, amount: 1 },
                      text: "Up to max(1, CHA mod) creatures auto-succeed on the save and take no damage on a half-on-success save." } }
```

### Distant Spell

*Cost: 1 Sorcery Point*

When you cast a spell that has a range of at least 5 feet, you can spend 1 Sorcery Point to double the spell’s range. Or when you cast a spell that has a range of Touch, you can spend 1 Sorcery Point to make the spell’s range 30 feet.

## Effects
```yaml
- option: { of: $#metamagic }
- trigger: { event: cast, group: metamagic, scope: { spell: { range: ">= 5" } },
             offer: { cost: { resource: $#sorcery-points, amount: 1 }, spell: { range: "2 * spell.range" } } }
- trigger: { event: cast, group: metamagic, scope: { spell: { range: touch } },
             offer: { cost: { resource: $#sorcery-points, amount: 1 }, spell: { range: 30 } } }
```

### Empowered Spell

*Cost: 1 Sorcery Point*

When you roll damage for a spell, you can spend 1 Sorcery Point to reroll a number of the damage dice up to your Charisma modifier (minimum of one), and you must use the new rolls.

You can use Empowered Spell even if you’ve already used a different Metamagic option during the casting of the spell.

## Effects
```yaml
- option: { of: $#metamagic }
- trigger: { event: { roll: damage }, group: metamagic, group-exempt: true, scope: { spell: {} },
             offer: { cost: { resource: $#sorcery-points, amount: 1 }, reroll: { dice: "max(1, mod:cha)" }, must-use-new: true } }
```

### Extended Spell

*Cost: 1 Sorcery Point*

When you cast a spell that has a duration of 1 minute or longer, you can spend 1 Sorcery Point to double its duration to a maximum duration of 24 hours.

If the affected spell requires Concentration, you have Advantage on any saving throw you make to maintain that Concentration.

## Effects
```yaml
- option: { of: $#metamagic }
- trigger: { event: cast, group: metamagic, scope: { spell: { duration: ">= 1 minute" } },
             offer: { cost: { resource: $#sorcery-points, amount: 1 }, spell: { duration: "min(2 * spell.duration, 24 hour)" },
                      text: "Advantage on saves to keep Concentration on it." } }
```

### Heightened Spell

*Cost: 2 Sorcery Points*

When you cast a spell that forces a creature to make a saving throw, you can spend 2 Sorcery Points to give one target of the spell Disadvantage on saves against the spell.

## Effects
```yaml
- option: { of: $#metamagic }
- trigger: { event: cast, group: metamagic, scope: { spell: { save: any } },
             offer: { cost: { resource: $#sorcery-points, amount: 2 }, text: "One target has Disadvantage on saves against the spell." } }
```

### Quickened Spell

*Cost: 2 Sorcery Points*

When you cast a spell that has a casting time of an action, you can spend 2 Sorcery Points to change the casting time to a Bonus Action for this casting. You can’t modify a spell in this way if you’ve already cast a level 1+ spell on the current turn, nor can you cast a level 1+ spell on this turn after modifying a spell in this way.

## Effects
```yaml
- option: { of: $#metamagic }
- trigger: { event: cast, group: metamagic, scope: { spell: { casting-time: action } },
             if: "You haven't cast a level 1+ spell this turn (and can't after)",
             offer: { cost: { resource: $#sorcery-points, amount: 2 }, spell: { casting-time: bonus } } }
```

### Seeking Spell

*Cost: 1 Sorcery Point*

If you make an attack roll for a spell and miss, you can spend 1 Sorcery Point to reroll the d20, and you must use the new roll.

You can use Seeking Spell even if you’ve already used a different Metamagic option during the casting of the spell.

## Effects
```yaml
- option: { of: $#metamagic }
- trigger: { event: miss, group: metamagic, group-exempt: true, scope: { spell: {} },
             offer: { cost: { resource: $#sorcery-points, amount: 1 }, reroll: true, must-use-new: true } }
```

### Subtle Spell

*Cost: 1 Sorcery Point*

When you cast a spell, you can spend 1 Sorcery Point to cast it without any Verbal, Somatic, or Material components, except Material components that are consumed by the spell or that have a cost specified in the spell.

## Effects
```yaml
- option: { of: $#metamagic }
- trigger: { event: cast, group: metamagic,
             offer: { cost: { resource: $#sorcery-points, amount: 1 }, spell: { components: [], keep-costly-material: true } } }
```

### Transmuted Spell

*Cost: 1 Sorcery Point*

When you cast a spell that deals a type of damage from the following list, you can spend 1 Sorcery Point to change that damage type to one of the other listed types: Acid, Cold, Fire, Lightning, Poison, Thunder.

## Effects
```yaml
- option: { of: $#metamagic }
- trigger: { event: cast, group: metamagic, scope: { spell: { deals: [acid, cold, fire, lightning, poison, thunder] } },
             offer: { cost: { resource: $#sorcery-points, amount: 1 },
                      spell: { damage-type: { choose-on-use: [acid, cold, fire, lightning, poison, thunder] } } } }
```

### Twinned Spell

*Cost: 1 Sorcery Point*

When you cast a spell, such as *Charm Person*, that can be cast with a higher-level spell slot to target an additional creature, you can spend 1 Sorcery Point to increase the spell’s effective level by 1.

## Effects
```yaml
- option: { of: $#metamagic }
- trigger: { event: cast, group: metamagic, scope: { spell: { scales: targets } },
             offer: { cost: { resource: $#sorcery-points, amount: 1 }, spell: { slot-level: slot-level + 1 } } }
```

## Sorcerer Spell List

This section presents the Sorcerer spell list. The spells are organized by spell level and then alphabetized, and each spell’s school of magic is listed. In the Special column, *C* means the spell requires Concentration, *R* means it’s a Ritual, and *M* means it requires a specific Material component.

### Cantrips (Level 0 Sorcerer Spells)

| Spell | School | Special |
|---|---|---|
| Acid Splash | Evocation | — |
| Chill Touch | Necromancy | — |
| Dancing Lights | Illusion | C |
| Elementalism | Transmutation | — |
| Fire Bolt | Evocation | — |
| Light | Evocation | — |
| Mage Hand | Conjuration | — |
| Mending | Transmutation | — |
| Message | Transmutation | — |
| Minor Illusion | Illusion | — |
| Poison Spray | Necromancy | — |
| Prestidigitation | Transmutation | — |
| Ray of Frost | Evocation | — |
| Shocking Grasp | Evocation | — |
| Sorcerous Burst | Evocation | — |
| True Strike | Divination | — |

### Level 1 Sorcerer Spells

| Spell | School | Special |
|---|---|---|
| Burning Hands | Evocation | — |
| Charm Person | Enchantment | — |
| Chromatic Orb | Evocation | M |
| Color Spray | Illusion | — |
| Comprehend Languages | Divination | R |
| Detect Magic | Divination | C, R |
| Disguise Self | Illusion | — |
| Expeditious Retreat | Transmutation | C |
| False Life | Necromancy | – |
| Feather Fall | Transmutation | — |
| Fog Cloud | Conjuration | C |
| Grease | Conjuration | — |
| Ice Knife | Conjuration | — |
| Jump | Transmutation | — |
| Mage Armor | Abjuration | — |
| Magic Missile | Evocation | — |
| Ray of Sickness | Necromancy | — |
| Shield | Abjuration | — |
| Silent Image | Illusion | C |
| Sleep | Enchantment | C |
| Thunderwave | Evocation | — |

### Level 2 Sorcerer Spells

| Spell | School | Special |
|---|---|---|
| Alter Self | Transmutation | C |
| Blindness/Deafness | Transmutation | — |
| Blur | Illusion | C |
| Darkness | Evocation | C |
| Darkvision | Transmutation | — |
| Detect Thoughts | Divination | C |
| Dragon’s Breath | Transmutation | C |
| Enhance Ability | Transmutation | C |
| Enlarge/Reduce | Transmutation | C |
| Flame Blade | Evocation | C |
| Flaming Sphere | Evocation | C |
| Gust of Wind | Evocation | C |

| Spell | School | Special |
|---|---|---|
| Hold Person | Enchantment | C |
| Invisibility | Illusion | C |
| Knock | Transmutation | — |
| Levitate | Transmutation | C |
| Magic Weapon | Transmutation | — |
| Mirror Image | Illusion | — |
| Misty Step | Conjuration | — |
| Scorching Ray | Evocation | — |
| See Invisibility | Divination | — |
| Shatter | Evocation | — |
| Spider Climb | Transmutation | C |
| Suggestion | Enchantment | C |
| Web | Conjuration | C |

### Level 3 Sorcerer Spells

| Spell | School | Special |
|---|---|---|
| Blink | Transmutation | — |
| Clairvoyance | Divination | C, M |
| Counterspell | Abjuration | — |
| Daylight | Evocation | — |
| Dispel Magic | Abjuration | — |
| Fear | Illusion | C |
| Fireball | Evocation | — |
| Fly | Transmutation | C |
| Gaseous Form | Transmutation | C |
| Haste | Transmutation | C |
| Hypnotic Pattern | Illusion | C |
| Lightning Bolt | Evocation | — |
| Major Image | Illusion | C |
| Protection from Energy | Abjuration | C |
| Sleet Storm | Conjuration | C |
| Slow | Transmutation | C |
| Stinking Cloud | Conjuration | C |
| Tongues | Divination | — |
| Vampiric Touch | Necromancy | C |
| Water Breathing | Transmutation | R |
| Water Walk | Transmutation | R |

### Level 4 Sorcerer Spells

| Spell | School | Special |
|---|---|---|
| Banishment | Abjuration | C |
| Blight | Necromancy | — |
| Charm Monster | Enchantment | — |
| Confusion | Enchantment | C |
| Dimension Door | Conjuration | — |
| Dominate Beast | Enchantment | C |
| Fire Shield | Evocation | — |
| Greater Invisibility | Illusion | C |
| Ice Storm | Evocation | — |
| Polymorph | Transmutation | C |
| Stoneskin | Transmutation | C, M |
| Vitriolic Sphere | Evocation | — |
| Wall of Fire | Evocation | C |

### Level 5 Sorcerer Spells

| Spell | School | Special |
|---|---|---|
| Animate Objects | Transmutation | C |
| Arcane Hand | Evocation | C |
| Cloudkill | Conjuration | C |
| Cone of Cold | Evocation | — |
| Creation | Illusion | — |
| Dominate Person | Enchantment | C |
| Hold Monster | Enchantment | C |
| Insect Plague | Conjuration | C |
| Seeming | Illusion | — |
| Telekinesis | Transmutation | C |
| Teleportation Circle | Conjuration | M |
| Wall of Stone | Evocation | C |

### Level 6 Sorcerer Spells

| Spell | School | Special |
|---|---|---|
| Chain Lightning | Evocation | — |
| Circle of Death | Necromancy | M |
| Disintegrate | Transmutation | — |
| Eyebite | Necromancy | C |
| Flesh to Stone | Transmutation | C |
| Freezing Sphere | Evocation | — |
| Globe of Invulnerability | Abjuration | C |
| Mass Suggestion | Enchantment | — |
| Move Earth | Transmutation | C |
| Sunbeam | Evocation | C |
| True Seeing | Divination | M |

### Level 7 Sorcerer Spells

| Spell | School | Special |
|---|---|---|
| Delayed Blast Fireball | Evocation | C |
| Etherealness | Conjuration | — |
| Finger of Death | Necromancy | — |
| Fire Storm | Evocation | — |
| Plane Shift | Conjuration | M |
| Prismatic Spray | Evocation | — |
| Reverse Gravity | Transmutation | C |
| Teleport | Conjuration | — |

### Level 8 Sorcerer Spells

| Spell | School | Special |
|---|---|---|
| Demiplane | Conjuration | — |
| Dominate Monster | Enchantment | C |
| Earthquake | Transmutation | C |
| Incendiary Cloud | Conjuration | C |
| Power Word Stun | Enchantment | — |
| Sunburst | Evocation | — |

### Level 9 Sorcerer Spells

| Spell | School | Special |
|---|---|---|
| Gate | Conjuration | C, M |
| Meteor Swarm | Evocation | — |
| Power Word Kill | Enchantment | — |
| Time Stop | Transmutation | — |
| Wish | Conjuration | — |
