# Ranger
**Type:** Class
**Source:** SRD 5.2.1, p. 57

## Core Ranger Traits

**Primary Ability:** Dexterity and Wisdom
**Hit Point Die:** D10 per Ranger level
**Saving Throw Proficiencies:** Strength and Dexterity
**Skill Proficiencies:** Choose 3: Animal Handling, Athletics, Insight, Investigation, Nature, Perception, Stealth, or Survival
**Weapon Proficiencies:** Simple and Martial weapons
**Armor Training:** Light and Medium armor and Shields
**Starting Equipment:** Choose A or B: (A) Studded Leather Armor, Scimitar, Shortsword, Longbow, 20 Arrows, Quiver, Druidic Focus (sprig of mistletoe), Explorer’s Pack, and 7 GP; or (B) 150 GP

## Effects
```yaml
- hit-die: d10
- proficiency: [save:str, save:dex, weapon:simple, weapon:martial, armor:light, armor:medium, armor:shield]
- choose: { id: skills, kind: skill, count: 3, grants: proficiency,
            from: [animal-handling, athletics, insight, investigation, nature, perception, stealth, survival] }
- multiclass: [hit-die, weapon:martial, armor:light, armor:medium, armor:shield, { choose: { kind: skill, count: 1, from: $#skills } }]
- equipment:
    options:
      - { id: a, items: [studded-leather-armor, scimitar, shortsword, longbow, { arrows: 20 }, quiver, druidic-focus, explorers-pack], gp: 7 }
      - { id: b, gp: 150 }
```

## Becoming a Ranger …

### As a Level 1 Character

- Gain all the traits in the Core Ranger Traits table.
- Gain the Ranger’s level 1 features, which are listed in the Ranger Features table.

### As a Multiclass Character

- Gain the following traits from the Core Ranger Traits table: Hit Point Die, proficiency with Martial weapons, proficiency in one skill of your choice from the Ranger’s skill list, and training with Light and Medium armor and Shields.
- Gain the Ranger’s level 1 features, which are listed in the Ranger Features table. See the multiclassing rules in “Character Creation” to determine your available spell slots.

## Ranger Class Features

As a Ranger, you gain the following class features when you reach the specified Ranger levels. These features are listed in the Ranger Features table.

### Level 1: Spellcasting

You have learned to channel the magical essence of nature to cast spells. See “Spells” for the rules on spellcasting. The information below details how you use those rules with Ranger spells, which appear in the Ranger spell list later in the class’s description.

***Spell Slots.*** The Ranger Features table shows how many spell slots you have to cast your level 1+ spells. You regain all expended slots when you finish a Long Rest.

***Prepared Spells of Level 1+***. You prepare the list of level 1+ spells that are available for you to cast with this feature. To start, choose two level 1 Ranger spells. *Cure Wounds* and *Ensnaring Strike* are recommended.

The number of spells on your list increases as you gain Ranger levels, as shown in the Prepared Spells column of the Ranger Features table. Whenever that number increases, choose additional Ranger spells until the number of spells on your list matches the number in the Ranger Features table. The chosen spells must be of a level for which you have spell slots. For example, if you’re a level 5 Ranger, your list of prepared spells can include six Ranger spells of level 1 or 2 in any combination.

If another Ranger feature gives you spells that you always have prepared, those spells don’t count against the number of spells you can prepare with this feature, but those spells otherwise count as Ranger spells for you.

***Changing Your Prepared Spells.*** Whenever you finish a Long Rest, you can replace one spell on your list with another Ranger spell for which you have spell slots.

***Spellcasting Ability.*** Wisdom is your spellcasting ability for your Ranger spells.

***Spellcasting Focus.*** You can use a Druidic Focus as a Spellcasting Focus for your Ranger spells.

## Effects
```yaml
- spellcasting: { ability: wis, progression: half, list: ranger, focus: druidic-focus,
                  prepared: table:Prepared Spells, change: { prepared: { at: long, count: 1 } } }
```

### Level 1: Favored Enemy

You always have the *Hunter’s Mark* spell prepared. You can cast it twice without expending a spell slot, and you regain all expended uses of this ability when you finish a Long Rest.

The number of times you can cast the spell without a spell slot increases when you reach certain Ranger levels, as shown in the Favored Enemy column of the Ranger Features table.

## Effects
```yaml
- grant-spell: { spell: $srd/spells/hunters-mark, prepared: always, free: { per: long, count: table:Favored Enemy } }
```

### Level 1: Weapon Mastery

Your training with weapons allows you to use the mastery properties of two kinds of weapons of your choice with which you have proficiency, such as Longbows and Shortswords.

## Effects
```yaml
- choose: { id: mastery, kind: weapon, count: 2, grants: mastery, from: { proficient: weapon }, swap: { at: long, count: all } }
```

#### Ranger Features

| Level | Proficiency Bonus | Class Features | Favored Enemy | Prepared Spells | Spell Slots per Spell Level 1 | Spell Slots per Spell Level 2 | Spell Slots per Spell Level 3 | Spell Slots per Spell Level 4 | Spell Slots per Spell Level 5 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | +2 | Spellcasting, Favored Enemy, Weapon Mastery | 2 | 2 | 2 | — | — | — | — |
| 2 | +2 | Deft Explorer, Fighting Style | 2 | 3 | 2 | — | — | — | — |
| 3 | +2 | Ranger Subclass | 2 | 4 | 3 | — | — | — | — |
| 4 | +2 | Ability Score Improvement | 2 | 5 | 3 | — | — | — | — |
| 5 | +3 | Extra Attack | 3 | 6 | 4 | 2 | — | — | — |
| 6 | +3 | Roving | 3 | 6 | 4 | 2 | — | — | — |
| 7 | +3 | Subclass feature | 3 | 7 | 4 | 3 | — | — | — |
| 8 | +3 | Ability Score Improvement | 3 | 7 | 4 | 3 | — | — | — |
| 9 | +4 | Expertise | 4 | 9 | 4 | 3 | 2 | — | — |
| 10 | +4 | Tireless | 4 | 9 | 4 | 3 | 2 | — | — |
| 11 | +4 | Subclass feature | 4 | 10 | 4 | 3 | 3 | — | — |
| 12 | +4 | Ability Score Improvement | 4 | 10 | 4 | 3 | 3 | — | — |
| 13 | +5 | Relentless Hunter | 5 | 11 | 4 | 3 | 3 | 1 | — |
| 14 | +5 | Nature’s Veil | 5 | 11 | 4 | 3 | 3 | 1 | — |
| 15 | +5 | Subclass feature | 5 | 12 | 4 | 3 | 3 | 2 | — |
| 16 | +5 | Ability Score Improvement | 5 | 12 | 4 | 3 | 3 | 2 | — |
| 17 | +6 | Precise Hunter | 6 | 14 | 4 | 3 | 3 | 3 | 1 |
| 18 | +6 | Feral Senses | 6 | 14 | 4 | 3 | 3 | 3 | 1 |
| 19 | +6 | Epic Boon | 6 | 15 | 4 | 3 | 3 | 3 | 2 |
| 20 | +6 | Foe Slayer | 6 | 15 | 4 | 3 | 3 | 3 | 2 |

Whenever you finish a Long Rest, you can change the kinds of weapons you chose. For example, you could switch to using the mastery properties of Scimitars and Longswords.

### Level 2: Deft Explorer

Thanks to your travels, you gain the following benefits.

***Expertise.*** Choose one of your skill proficiencies with which you lack Expertise. You gain Expertise in that skill.

***Languages.*** You know two languages of your choice from the language tables in “Character Creation.”

## Effects
```yaml
- choose: { id: deft-expertise, kind: skill, count: 1, grants: expertise, from: { proficient: skill, not: { expertise: skill } } }
- choose: { id: deft-languages, kind: language, count: 2, grants: language, from: any }
```

### Level 2: Fighting Style

You gain a Fighting Style feat of your choice (see “Feats”). Instead of choosing one of those feats, you can choose the option below.

***Druidic Warrior.*** You learn two Druid cantrips of your choice (see the Druid class’s section for a list of Druid spells). *Guidance* and *Starry Wisp* are recommended. The chosen cantrips count as Ranger spells for you, and Wisdom is your spellcasting ability for them. Whenever you gain a Ranger level, you can replace one of these cantrips with another Druid cantrip.

## Effects
```yaml
- choose:
    id: fighting-style
    kind: feat
    count: 1
    from: { feat: { category: fighting-style } }
    swap: level-up
    options:
      - id: druidic-warrior
        label: Druidic Warrior
        effects:
          - grant-spell: { choose: { id: druidic-cantrips, count: 2, from: { spell: { list: druid, level: 0 } }, swap: { at: level-up, count: 1 } },
                           ability: wis, counts-as: ranger }
```

### Level 3: Ranger Subclass

You gain a Ranger subclass of your choice. The Hunter subclass is detailed after this class’s description. A subclass is a specialization that grants you features at certain Ranger levels. For the rest of your career, you gain each of your subclass’s features that are of your Ranger level or lower.

## Effects
```yaml
- choose: { id: subclass, kind: subclass, from: { subclass: { parent: $srd/ranger } } }
```

### Level 4: Ability Score Improvement

You gain the Ability Score Improvement feat (see “Feats”) or another feat of your choice for which you qualify. You gain this feature again at Ranger levels 8, 12, and 16.

## Effects
```yaml
- choose: { id: asi, kind: feat, from: { feat: { qualify: true } }, default: $srd/feats/ability-score-improvement, at: [4, 8, 12, 16] }
```

### Level 5: Extra Attack

You can attack twice instead of once whenever you take the Attack action on your turn.

## Effects
```yaml
- extra-attack: { total: 2 }
```

### Level 6: Roving

Your Speed increases by 10 feet while you aren’t wearing Heavy armor. You also have a Climb Speed and a Swim Speed equal to your Speed.

## Effects
```yaml
- bonus: { to: speed:walk, value: 10, when: { not: { armor: heavy } } }
- speed: { climb: speed:walk, swim: speed:walk }
```

### Level 9: Expertise

Choose two of your skill proficiencies with which you lack Expertise. You gain Expertise in those skills.

## Effects
```yaml
- choose: { id: expertise-9, kind: skill, count: 2, grants: expertise, from: { proficient: skill, not: { expertise: skill } } }
```

### Level 10: Tireless

Primal forces now help fuel you on your journeys, granting you the following benefits.

***Temporary Hit Points.*** As a Magic action, you can give yourself a number of Temporary Hit Points equal to 1d8 plus your Wisdom modifier (minimum of 1). You can use this action a number of times equal to your Wisdom modifier (minimum of once), and you regain all expended uses when you finish a Long Rest.

***Decrease Exhaustion.*** Whenever you finish a Short Rest, your Exhaustion level, if any, decreases by 1.

## Effects
```yaml
- resource: { id: tireless, max: "max(1, mod:wis)", reset: long }
- action: { id: tireless, activation: magic, cost: { resource: $#tireless }, temp-hp: "max(1, 1d8 + mod:wis)" }
- trigger: { event: { rest: short }, auto: true, offer: { exhaustion: -1 } }
```

### Level 13: Relentless Hunter

Taking damage can’t break your Concentration on *Hunter’s Mark.*

## Effects
```yaml
- modify: { target: $srd/spells/hunters-mark, set: { concentration.break-on-damage: false } }
```

### Level 14: Nature’s Veil

You invoke spirits of nature to magically hide yourself. As a Bonus Action, you can give yourself the Invisible condition until the end of your next turn.

You can use this feature a number of times equal to your Wisdom modifier (minimum of once), and you regain all expended uses when you finish a Long Rest.

## Effects
```yaml
- resource: { id: natures-veil, max: "max(1, mod:wis)", reset: long }
- action: { id: natures-veil, activation: bonus, cost: { resource: $#natures-veil }, targets: { count: 1, choose: self },
            apply: { condition: invisible, duration: { until: end-of-next-turn } } }
```

### Level 17: Precise Hunter

You have Advantage on attack rolls against the creature currently marked by your *Hunter’s Mark.*

## Effects
```yaml
- advantage: { roll: attack, scope: { against: { target: { marked-by: $srd/spells/hunters-mark } } } }
```

### Level 18: Feral Senses

Your connection to the forces of nature grants you Blindsight with a range of 30 feet.

## Effects
```yaml
- sense: { blindsight: 30 }
```

### Level 19: Epic Boon

You gain an Epic Boon feat (see “Feats”) or another feat of your choice for which you qualify. Boon of Dimensional Travel is recommended.

## Effects
```yaml
- choose: { id: epic-boon, kind: feat, from: { feat: { qualify: true } }, default: $srd/feats/boon-of-dimensional-travel }
```

### Level 20: Foe Slayer

The damage die of your *Hunter’s Mark* is a d10 rather than a d6.

## Effects
```yaml
- modify: { target: $srd/spells/hunters-mark, set: { damage.dice: 1d10 } }
```

## Ranger Spell List

This section presents the Ranger spell list. The spells are organized by spell level and then alphabetized, and each spell’s school of magic is listed. In the Special column, *C* means the spell requires Concentration, *R* means it’s a Ritual, and *M* means it requires a specific Material component.

### Level 1 Ranger Spells

| Spell | School | Special |
|---|---|---|
| Alarm | Abjuration | R |
| Animal Friendship | Enchantment | — |
| Cure Wounds | Abjuration | — |
| Detect Magic | Divination | C, R |
| Detect Poison and Disease | Divination | C, R |
| Ensnaring Strike | Conjuration | C |
| Entangle | Conjuration | C |
| Fog Cloud | Conjuration | C |
| Goodberry | Conjuration | — |
| Hunter’s Mark | Divination | C |
| Jump | Transmutation | — |
| Longstrider | Transmutation | — |
| Speak with Animals | Divination | R |

### Level 2 Ranger Spells

| Spell | School | Special |
|---|---|---|
| Aid | Abjuration | — |
| Animal Messenger | Enchantment | R |
| Barkskin | Transmutation | — |
| Darkvision | Transmutation | — |
| Enhance Ability | Transmutation | C |
| Find Traps | Divination | — |
| Gust of Wind | Evocation | C |
| Lesser Restoration | Abjuration | — |
| Locate Animals or Plants | Divination | R |
| Locate Object | Divination | C |
| Magic Weapon | Transmutation | — |
| Pass without Trace | Abjuration | C |
| Protection from Poison | Abjuration | — |
| Silence | Illusion | C, R |
| Spike Growth | Transmutation | C |

### Level 3 Ranger Spells

| Spell | School | Special |
|---|---|---|
| Conjure Animals | Conjuration | C |
| Daylight | Evocation | — |
| Dispel Magic | Abjuration | — |
| Meld into Stone | Transmutation | R |
| Nondetection | Abjuration | M |
| Plant Growth | Transmutation | — |
| Protection from Energy | Abjuration | C |
| Revivify | Necromancy | M |
| Speak with Plants | Transmutation | — |
| Water Breathing | Transmutation | R |
| Water Walk | Transmutation | R |
| Wind Wall | Evocation | C |

### Level 4 Ranger Spells

| Spell | School | Special |
|---|---|---|
| Conjure Woodland Beings | Conjuration | C |
| Dominate Beast | Enchantment | C |
| Freedom of Movement | Abjuration | — |
| Locate Creature | Divination | C |
| Stoneskin | Transmutation | C, M |

### Level 5 Ranger Spells

| Spell | School | Special |
|---|---|---|
| Commune with Nature | Divination | R |
| Greater Restoration | Abjuration | M |
| Tree Stride | Conjuration | C |
