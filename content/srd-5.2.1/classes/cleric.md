# Cleric
**Type:** Class
**Source:** SRD 5.2.1, p. 36

## Core Cleric Traits

**Primary Ability:** Wisdom
**Hit Point Die:** D8 per Cleric level
**Saving Throw Proficiencies:** Wisdom and Charisma
**Skill Proficiencies:** Choose 2: History, Insight, Medicine, Persuasion, or Religion
**Weapon Proficiencies:** Simple weapons
**Armor Training:** Light and Medium armor and Shields
**Starting Equipment:** Choose A or B: (A) Chain Shirt, Shield, Mace, Holy Symbol, Priest’s Pack, and 7 GP; or (B) 110 GP

## Effects
```yaml
- hit-die: d8
- proficiency: [save:wis, save:cha]
- choose: { id: skills, kind: skill, count: 2, grants: proficiency, from: [history, insight, medicine, persuasion, religion] }
- proficiency: [weapon:simple, armor:light, armor:medium, armor:shield]
- multiclass: [hit-die, armor:light, armor:medium, armor:shield]
- equipment:
    options:
      - { id: a, items: [chain-shirt, shield, mace, holy-symbol, priests-pack], gp: 7 }
      - { id: b, gp: 110 }
```

## Becoming a Cleric …

### As a Level 1 Character

- Gain all the traits in the Core Cleric Traits table.
- Gain the Cleric’s level 1 features, which are listed in the Cleric Features table.

### As a Multiclass Character

- Gain the following traits from the Core Cleric Traits table: Hit Point Die and training with Light and Medium armor and Shields.
- Gain the Cleric’s level 1 features, which are listed in the Cleric Features table. See the multiclassing rules in “Character Creation” to determine your available spell slots.

## Cleric Class Features

As a Cleric, you gain the following class features when you reach the specified Cleric levels. These features are listed in the Cleric Features table.

### Level 1: Spellcasting

You have learned to cast spells through prayer and meditation. See “Spells” for the rules on spellcasting. The information below details how you use those rules with Cleric spells, which appear on the Cleric spell list later in the class’s description.

***Cantrips.*** You know three cantrips of your choice from the Cleric spell list. *Guidance, Sacred Flame,* and *Thaumaturgy* are recommended.

Whenever you gain a Cleric level, you can replace one of your cantrips with another cantrip of your choice from the Cleric spell list.

## Effects
```yaml
- spellcasting: { ability: wis, progression: full, list: cleric, focus: holy-symbol,
                  cantrips: table:Cantrips, prepared: table:Prepared Spells, change: { prepared: long, cantrips: level-up } }
- choose: { id: cantrips, kind: spell, count: table:Cantrips, from: { spell: { list: cleric, level: 0 } }, swap: { at: level-up, count: 1 },
            default: [$srd/spells/guidance, $srd/spells/sacred-flame, $srd/spells/thaumaturgy] }
```

#### Cleric Features

| Level | Proficiency Bonus | Class Features | Channel Divinity | Cantrips | Prepared Spells | Spell Slots per Spell Level 1 | Spell Slots per Spell Level 2 | Spell Slots per Spell Level 3 | Spell Slots per Spell Level 4 | Spell Slots per Spell Level 5 | Spell Slots per Spell Level 6 | Spell Slots per Spell Level 7 | Spell Slots per Spell Level 8 | Spell Slots per Spell Level 9 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | +2 | Spellcasting, Divine Order | — | 3 | 4 | 2 | — | — | — | — | — | — | — | — |
| 2 | +2 | Channel Divinity | 2 | 3 | 5 | 3 | — | — | — | — | — | — | — | — |
| 3 | +2 | Cleric Subclass | 2 | 3 | 6 | 4 | 2 | — | — | — | — | — | — | — |
| 4 | +2 | Ability Score Improvement | 2 | 4 | 7 | 4 | 3 | — | — | — | — | — | — | — |
| 5 | +3 | Sear Undead | 2 | 4 | 9 | 4 | 3 | 2 | — | — | — | — | — | — |
| 6 | +3 | Subclass feature | 3 | 4 | 10 | 4 | 3 | 3 | — | — | — | — | — | — |
| 7 | +3 | Blessed Strikes | 3 | 4 | 11 | 4 | 3 | 3 | 1 | — | — | — | — | — |
| 8 | +3 | Ability Score Improvement | 3 | 4 | 12 | 4 | 3 | 3 | 2 | — | — | — | — | — |
| 9 | +4 | — | 3 | 4 | 14 | 4 | 3 | 3 | 3 | 1 | — | — | — | — |
| 10 | +4 | Divine Intervention | 3 | 5 | 15 | 4 | 3 | 3 | 3 | 2 | — | — | — | — |
| 11 | +4 | — | 3 | 5 | 16 | 4 | 3 | 3 | 3 | 2 | 1 | — | — | — |
| 12 | +4 | Ability Score Improvement | 3 | 5 | 16 | 4 | 3 | 3 | 3 | 2 | 1 | — | — | — |
| 13 | +5 | — | 3 | 5 | 17 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | — | — |
| 14 | +5 | Improved Blessed Strikes | 3 | 5 | 17 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | — | — |
| 15 | +5 | — | 3 | 5 | 18 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | 1 | — |
| 16 | +5 | Ability Score Improvement | 3 | 5 | 18 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | 1 | — |
| 17 | +6 | Subclass feature | 3 | 5 | 19 | 4 | 3 | 3 | 3 | 2 | 1 | 1 | 1 | 1 |
| 18 | +6 | — | 4 | 5 | 20 | 4 | 3 | 3 | 3 | 3 | 1 | 1 | 1 | 1 |
| 19 | +6 | Epic Boon | 4 | 5 | 21 | 4 | 3 | 3 | 3 | 3 | 2 | 1 | 1 | 1 |
| 20 | +6 | Greater Divine Intervention | 4 | 5 | 22 | 4 | 3 | 3 | 3 | 3 | 2 | 2 | 1 | 1 |

When you reach Cleric levels 4 and 10, you learn another cantrip of your choice from the Cleric spell list, as shown in the Cantrips column of the Cleric Features table.

***Spell Slots.*** The Cleric Features table shows how many spell slots you have to cast your level 1+ spells. You regain all expended slots when you finish a Long Rest.

***Prepared Spells of Level 1+.*** You prepare the list of level 1+ spells that are available for you to cast with this feature. To start, choose four level 1 spells from the Cleric spell list. *Bless, Cure Wounds, Guiding Bolt*, and *Shield of Faith* are recommended.

The number of spells on your list increases as you gain Cleric levels, as shown in the Prepared Spells column of the Cleric Features table. Whenever that number increases, choose additional spells from the Cleric spell list until the number of spells on your list matches the number on the table. The chosen spells must be of a level for which you have spell slots. For example, if you’re a level 3 Cleric, your list of prepared spells can include six spells of levels 1 and 2 in any combination.

If another Cleric feature gives you spells that you always have prepared, those spells don’t count against the number of spells you can prepare with this feature, but those spells otherwise count as Cleric spells for you.

***Changing Your Prepared Spells.*** Whenever you finish a Long Rest, you can change your list of prepared spells, replacing any of the spells there with other Cleric spells for which you have spell slots.

***Spellcasting Ability.*** Wisdom is your spellcasting ability for your Cleric spells.

***Spellcasting Focus.*** You can use a Holy Symbol as a Spellcasting Focus for your Cleric spells.

### Level 1: Divine Order

You have dedicated yourself to one of the following sacred roles of your choice.

***Protector.*** Trained for battle, you gain proficiency with Martial weapons and training with Heavy armor.

***Thaumaturge.*** You know one extra cantrip from the Cleric spell list. In addition, your mystical connection to the divine gives you a bonus to your Intelligence (Arcana or Religion) checks. The bonus equals your Wisdom modifier (minimum of +1).

## Effects
```yaml
- choose:
    id: divine-order
    kind: option
    options:
      - id: protector
        effects:
          - proficiency: [weapon:martial, armor:heavy]
      - id: thaumaturge
        effects:
          - grant-spell: { choose: { id: order-cantrip, count: 1, from: { spell: { list: cleric, level: 0 } } } }
          - bonus: { to: [skill:arcana, skill:religion], value: "max(1, mod:wis)" }
```

### Level 2: Channel Divinity

You can channel divine energy directly from the Outer Planes to fuel magical effects. You start with two such effects: Divine Spark and Turn Undead, each of which is described below. Each time you use this class’s Channel Divinity, choose which Channel Divinity effect from this class to create. You gain additional effect options at higher Cleric levels.

You can use this class’s Channel Divinity twice. You regain one of its expended uses when you finish a Short Rest, and you regain all expended uses when you finish a Long Rest. You gain additional uses when you reach certain Cleric levels, as shown in the Channel Divinity column of the Cleric Features table.

If a Channel Divinity effect requires a saving throw, the DC equals the spell save DC from this class’s Spellcasting feature.

***Divine Spark.*** As a Magic action, you point your Holy Symbol at another creature you can see within 30 feet of yourself and focus divine energy at it. Roll 1d8 and add your Wisdom modifier. You either restore Hit Points to the creature equal to that total or force the creature to make a Constitution saving throw. On a failed save, the creature takes Necrotic or Radiant damage (your choice) equal to that total. On a successful save, the creature takes half as much damage (round down).

You roll an additional d8 when you reach Cleric levels 7 (2d8), 13 (3d8), and 18 (4d8).

***Turn Undead.*** As a Magic action, you present your Holy Symbol and censure Undead creatures. Each Undead of your choice within 30 feet of you must make a Wisdom saving throw. If the creature fails its save, it has the Frightened and Incapacitated conditions for 1 minute. For that duration, it tries to move as far from you as it can on its turns. This effect ends early on the creature if it takes any damage, if you have the Incapacitated condition, or if you die.

## Effects
```yaml
- resource: { id: channel-divinity, max: table:Channel Divinity, reset: long, partial: { at: short, amount: 1 } }
- action:
    id: divine-spark
    activation: magic
    range: 30
    cost: { resource: $#channel-divinity }
    choose-one:
      - { label: Heal, heal: "steps(2: 1d8, 7: 2d8, 13: 3d8, 18: 4d8) + mod:wis" }
      - { label: Harm, save: { ability: con, dc: spell:dc, success: half },
          damage: { dice: "steps(2: 1d8, 7: 2d8, 13: 3d8, 18: 4d8) + mod:wis", type: { choose-on-use: [necrotic, radiant] } } }
- action:
    id: turn-undead
    activation: magic
    cost: { resource: $#channel-divinity }
    area: { shape: emanation, size: 30 }
    targets: { creature: undead, choose: true }
    save: { ability: wis, dc: spell:dc }
    apply: { condition: [frightened, incapacitated], duration: { amount: 1, unit: minute }, ends-when: damage,
             text: "It moves as far from you as it can. Ends early if you're Incapacitated or die." }
```

### Level 3: Cleric Subclass

You gain a Cleric subclass of your choice. The Life Domain subclass is detailed after this class’s description. A subclass is a specialization that grants you features at certain Cleric levels. For the rest of your career, you gain each of your subclass’s features that are of your Cleric level or lower.

## Effects
```yaml
- choose: { id: subclass, kind: subclass, from: { subclass: { parent: $srd/cleric } } }
```

### Level 4: Ability Score Improvement

You gain the Ability Score Improvement feat (see “Feats”) or another feat of your choice for which you qualify. You gain this feature again at Cleric levels 8, 12, and 16.

## Effects
```yaml
- choose: { id: asi, kind: feat, from: { feat: { qualify: true } }, default: $srd/feats/ability-score-improvement, at: [4, 8, 12, 16] }
```

### Level 5: Sear Undead

Whenever you use Turn Undead, you can roll a number of d8s equal to your Wisdom modifier (minimum of 1d8) and add the rolls together. Each Undead that fails its saving throw against that use of Turn Undead takes Radiant damage equal to the roll’s total. This damage doesn’t end the turn effect.

## Effects
```yaml
- modify: { target: $#turn-undead, add: { damage: { dice: "dice(max(1, mod:wis), d8)", type: radiant, applies-to: failed-save } } }
```

### Level 7: Blessed Strikes

Divine power infuses you in battle. You gain one of the following options of your choice (if you get either option from a Cleric subclass in an older book, use only the option you choose for this feature).

***Divine Strike.*** Once on each of your turns when you hit a creature with an attack roll using a weapon, you can cause the target to take an extra 1d8 Necrotic or Radiant damage (your choice).

***Potent Spellcasting.*** Add your Wisdom modifier to the damage you deal with any Cleric cantrip.

## Effects
```yaml
- choose:
    id: blessed-strikes
    kind: option
    options:
      - id: divine-strike
        effects:
          - trigger: { id: divine-strike, event: hit, scope: { weapon: {} }, per: turn,
                       offer: { damage: { dice: 1d8, type: { choose-on-use: [necrotic, radiant] } } } }
      - id: potent-spellcasting
        effects:
          - bonus: { to: damage, value: mod:wis, scope: { spell: { list: cleric, level: 0 } } }
```

### Level 10: Divine Intervention

You can call on your deity or pantheon to intervene on your behalf. As a Magic action, choose any Cleric spell of level 5 or lower that doesn’t require a Reaction to cast. As part of the same action, you cast that spell without expending a spell slot or needing Material components. You can’t use this feature again until you finish a Long Rest.

## Effects
```yaml
- resource: { id: divine-intervention, max: 1, reset: long }
- action:
    id: divine-intervention
    activation: magic
    cost: { resource: $#divine-intervention }
    cast: { choose-on-use: { spell: { list: cleric, level: "<= 5", casting-time: { not: reaction } } } }
    cast-options: { slot: false, material: false }
```

### Level 14: Improved Blessed Strikes

The option you chose for Blessed Strikes grows more powerful.

***Divine Strike.*** The extra damage of your Divine Strike increases to 2d8.

***Potent Spellcasting.*** When you cast a Cleric cantrip and deal damage to a creature with it, you can give vitality to yourself or another creature within 60 feet of yourself, granting a number of Temporary Hit Points equal to twice your Wisdom modifier.

## Effects
```yaml
- modify: { target: $#divine-strike, set: { offer.damage.dice: 2d8 }, when: { choice: { id: blessed-strikes, is: divine-strike } } }
- trigger: { event: cast, scope: { spell: { list: cleric, level: 0, deals: any } }, when: { choice: { id: blessed-strikes, is: potent-spellcasting } },
             if: "The cantrip dealt damage to a creature", offer: { temp-hp: 2 * mod:wis, text: "You or a creature within 60 feet" } }
```

### Level 19: Epic Boon

You gain an Epic Boon feat (see “Feats”) or another feat of your choice for which you qualify. Boon of Fate is recommended.

## Effects
```yaml
- choose: { id: epic-boon, kind: feat, from: { feat: { qualify: true } }, default: $srd/feats/boon-of-fate }
```

### Level 20: Greater Divine Intervention

You can call on even more powerful divine intervention. When you use your Divine Intervention feature, you can choose *Wish* when you select a spell. If you do so, you can’t use Divine Intervention again until you finish 2d4 Long Rests.

## Effects
```yaml
- modify: { target: $#divine-intervention, add: { cast.choose-on-use: [$srd/spells/wish] } }
- modify: { target: $#divine-intervention, add: { cost.lockout: { if-cast: $srd/spells/wish, long-rests: 2d4 } } }
```

## Cleric Spell List

This section presents the Cleric spell list. The spells are organized by spell level and then alphabetized, and each spell’s school of magic is listed. In the Special column, *C* means the spell requires Concentration, *R* means it’s a Ritual, and *M* means it requires a specific Material component.

### Cantrips (Level 0 Cleric Spells)

| Spell | School | Special |
|---|---|---|
| Guidance | Divination | C |
| Light | Evocation | — |
| Mending | Transmutation | — |
| Resistance | Abjuration | C |
| Sacred Flame | Evocation | — |
| Spare the Dying | Necromancy | — |
| Thaumaturgy | Transmutation | — |

### Level 1 Cleric Spells

| Spell | School | Special |
|---|---|---|
| Bane | Enchantment | C |
| Bless | Enchantment | C, M |
| Command | Enchantment | — |
| Create or Destroy Water | Transmutation | — |
| Cure Wounds | Abjuration | — |
| Detect Evil and Good | Divination | C |
| Detect Magic | Divination | C, R |
| Detect Poison and Disease | Divination | C, R |
| Guiding Bolt | Evocation | — |
| Healing Word | Abjuration | — |
| Inflict Wounds | Necromancy | — |
| Protection from Evil and Good | Abjuration | C, M |
| Purify Food and Drink | Transmutation | R |
| Sanctuary | Abjuration | — |
| Shield of Faith | Abjuration | C |

### Level 2 Cleric Spells

| Spell | School | Special |
|---|---|---|
| Aid | Abjuration | — |
| Augury | Divination | R, M |
| Blindness/Deafness | Transmutation | — |
| Calm Emotions | Enchantment | C |
| Continual Flame | Evocation | M |
| Enhance Ability | Transmutation | C |
| Find Traps | Divination | — |
| Gentle Repose | Necromancy | R, M |
| Hold Person | Enchantment | C |
| Lesser Restoration | Abjuration | — |
| Locate Object | Divination | C |
| Prayer of Healing | Abjuration | — |

| Spell | School | Special |
|---|---|---|
| Protection from Poison | Abjuration | — |
| Silence | Illusion | C, R |
| Spiritual Weapon | Evocation | C |
| Warding Bond | Abjuration | M |
| Zone of Truth | Enchantment | — |

### Level 3 Cleric Spells

| Spell | School | Special |
|---|---|---|
| Animate Dead | Necromancy | — |
| Beacon of Hope | Abjuration | C |
| Bestow Curse | Necromancy | C |
| Clairvoyance | Divination | C, M |
| Create Food and Water | Conjuration | — |
| Daylight | Evocation | — |
| Dispel Magic | Abjuration | — |
| Glyph of Warding | Abjuration | M |
| Magic Circle | Abjuration | M |
| Mass Healing Word | Abjuration | — |
| Meld into Stone | Transmutation | R |
| Protection from Energy | Abjuration | C |
| Remove Curse | Abjuration | — |
| Revivify | Necromancy | M |
| Sending | Divination | — |
| Speak with Dead | Necromancy | — |
| Spirit Guardians | Conjuration | C |
| Tongues | Divination | — |
| Water Walk | Transmutation | R |

### Level 4 Cleric Spells

| Spell | School | Special |
|---|---|---|
| Aura of Life | Abjuration | C |
| Banishment | Abjuration | C |
| Control Water | Transmutation | C |
| Death Ward | Abjuration | — |
| Divination | Divination | R, M |
| Freedom of Movement | Abjuration | — |
| Guardian of Faith | Conjuration | — |
| Locate Creature | Divination | C |
| Stone Shape | Transmutation | — |

### Level 5 Cleric Spells

| Spell | School | Special |
|---|---|---|
| Commune | Divination | R |
| Contagion | Necromancy | — |
| Dispel Evil and Good | Abjuration | C |
| Flame Strike | Evocation | — |
| Geas | Enchantment | — |
| Greater Restoration | Abjuration | M |
| Hallow | Abjuration | M |
| Insect Plague | Conjuration | C |
| Legend Lore | Divination | M |
| Mass Cure Wounds | Abjuration | — |
| Planar Binding | Abjuration | M |
| Raise Dead | Necromancy | M |
| Scrying | Divination | C, M |

### Level 6 Cleric Spells

| Spell | School | Special |
|---|---|---|
| Blade Barrier | Evocation | C |
| Create Undead | Necromancy | M |
| Find the Path | Divination | C, M |
| Forbiddance | Abjuration | R, M |
| Harm | Necromancy | — |
| Heal | Abjuration | — |
| Heroes’ Feast | Conjuration | M |
| Planar Ally | Conjuration | — |
| Sunbeam | Evocation | C |
| True Seeing | Divination | M |
| Word of Recall | Conjuration | — |

### Level 7 Cleric Spells

| Spell | School | Special |
|---|---|---|
| Conjure Celestial | Conjuration | C |
| Divine Word | Evocation | — |
| Etherealness | Conjuration | — |
| Fire Storm | Evocation | — |
| Plane Shift | Conjuration | M |
| Regenerate | Transmutation | — |
| Resurrection | Necromancy | M |
| Symbol | Abjuration | M |

### Level 8 Cleric Spells

| Spell | School | Special |
|---|---|---|
| Antimagic Field | Abjuration | C |
| Control Weather | Transmutation | C |
| Earthquake | Transmutation | C |
| Holy Aura | Abjuration | C, M |
| Sunburst | Evocation | — |

### Level 9 Cleric Spells

| Spell | School | Special |
|---|---|---|
| Astral Projection | Necromancy | M |
| Gate | Conjuration | C, M |
| Mass Heal | Abjuration | — |
| Power Word Heal | Enchantment | — |
| True Resurrection | Necromancy | M |
