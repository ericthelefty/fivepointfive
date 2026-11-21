# Rogue
**Type:** Class
**Source:** SRD 5.2.1, p. 61

## Core Rogue Traits

**Primary Ability:** Dexterity
**Hit Point Die:** D8 per Rogue level
**Saving Throw Proficiencies:** Dexterity and Intelligence
**Skill Proficiencies:** Choose 4: Acrobatics, Athletics, Deception, Insight, Intimidation, Investigation, Perception, Persuasion, Sleight of Hand, or Stealth
**Weapon Proficiencies:** Simple weapons and Martial weapons that have the Finesse or Light property
**Tool Proficiencies:** Thieves’ Tools
**Armor Training:** Light armor
**Starting Equipment:** Choose A or B: (A) Leather Armor, 2 Daggers, Shortsword, Shortbow, 20 Arrows, Quiver, Thieves’ Tools, Burglar’s Pack, and 8 GP; or (B) 100 GP

## Effects
```yaml
- hit-die: d8
- proficiency: [save:dex, save:int]
- choose: { id: skills, kind: skill, count: 4, grants: proficiency,
            from: [acrobatics, athletics, deception, insight, intimidation, investigation, perception, persuasion, sleight-of-hand, stealth] }
- proficiency: [weapon:simple, { weapon: { category: martial, property: [finesse, light] } }]   # list value = finesse OR light
- proficiency: [tool:thieves-tools, armor:light]
- multiclass: [hit-die, armor:light, { choose: { kind: skill, count: 1, from: $#skills } }, tool:thieves-tools]
```

## Becoming a Rogue …

### As a Level 1 Character

- Gain all the traits in the Core Rogue Traits table.
- Gain the Rogue’s level 1 features, which are listed in the Rogue Features table.

### As a Multiclass Character

- Gain the following traits from the Core Rogue Traits table: Hit Point Die, proficiency in one skill of your choice from the Rogue’s skill list, proficiency with Thieves’ Tools, and training with Light armor.
- Gain the Rogue’s level 1 features, which are listed in the Rogue Features table.

## Rogue Class Features

As a Rogue, you gain the following class features when you reach the specified Rogue levels. These features are listed in the Rogue Features table.

### Level 1: Expertise

You gain Expertise in two of your skill proficiencies of your choice. Sleight of Hand and Stealth are recommended if you have proficiency in them.

At Rogue level 6, you gain Expertise in two more of your skill proficiencies of your choice.

## Effects
```yaml
- choose: { id: expertise-1, kind: skill, count: 2, grants: expertise, from: { proficient: skill } }
- choose: { id: expertise-2, kind: skill, count: 2, grants: expertise, from: { proficient: skill }, when: { level:rogue: ">= 6" } }
```

### Level 1: Sneak Attack

You know how to strike subtly and exploit a foe’s distraction. Once per turn, you can deal an extra 1d6 damage to one creature you hit with an attack roll if you have Advantage on the roll and the attack uses a Finesse or a Ranged weapon. The extra damage’s type is the same as the weapon’s type.

You don’t need Advantage on the attack roll if at least one of your allies is within 5 feet of the target, the ally doesn’t have the Incapacitated condition, and you don’t have Disadvantage on the attack roll.

The extra damage increases as you gain Rogue levels, as shown in the Sneak Attack column of the Rogue Features table.

## Effects
```yaml
- trigger:
    id: sneak-attack
    event: hit
    scope: { any: [ { weapon: { property: finesse } }, { weapon: { kind: ranged } } ] }
    per: turn
    if: "You have Advantage, or an ally within 5 feet of the target isn't Incapacitated and you don't have Disadvantage"
    offer: { damage: { dice: table:Sneak Attack, type: weapon } }
```

### Level 1: Thieves’ Cant

You picked up various languages in the communities where you plied your roguish talents. You know Thieves’ Cant and one other language of your choice, which you choose from the language tables in “Character Creation.”

## Effects
```yaml
- language: [thieves-cant]
- choose: { id: language, kind: language, count: 1, grants: language, from: any }
```

### Level 1: Weapon Mastery

Your training with weapons allows you to use the mastery properties of two kinds of weapons of your choice with which you have proficiency, such as Daggers and Shortbows.

Whenever you finish a Long Rest, you can change the kinds of weapons you chose. For example, you could switch to using the mastery properties of Scimitars and Shortswords.

## Effects
```yaml
- choose: { id: mastery, kind: weapon, count: 2, from: { proficient: weapon }, grants: mastery, swap: { at: long, count: all } }
```

### Level 2: Cunning Action

Your quick thinking and agility allow you to move and act quickly. On your turn, you can take one of the following actions as a Bonus Action: Dash, Disengage, or Hide.

## Effects
```yaml
- action: { id: cunning-action, activation: bonus, choose-one: [ { take: dash }, { take: disengage }, { take: hide } ] }
```

### Level 3: Rogue Subclass

You gain a Rogue subclass of your choice. The Thief subclass is detailed after this class’s description. A subclass is a specialization that grants you features at certain Rogue levels. For the rest of your career, you gain each of your subclass’s features that are of your Rogue level or lower.

## Effects
```yaml
- choose: { id: subclass, kind: subclass, from: { subclass: { parent: $srd/rogue } } }
```

### Level 3: Steady Aim

As a Bonus Action, you give yourself Advantage on your next attack roll on the current turn. You can use this feature only if you haven’t moved during this turn, and after you use it, your Speed is 0 until the end of the current turn.

## Effects
```yaml
- toggle:
    id: steady-aim
    activation: bonus
    if: "You haven't moved this turn"
    duration: { until: end-of-turn }
    effects:
      - advantage: { roll: attack, once: true }
      - set: { to: speed:all, value: 0, mode: override }
```

#### Rogue Features

| Level | Proficiency Bonus | Class Features | Sneak Attack |
|---|---|---|---|
| 1 | +2 | Expertise, Sneak Attack, Thieves’ Cant, Weapon Mastery | 1d6 |
| 2 | +2 | Cunning Action | 1d6 |
| 3 | +2 | Rogue Subclass, Steady Aim | 2d6 |
| 4 | +2 | Ability Score Improvement | 2d6 |
| 5 | +3 | Cunning Strike, Uncanny Dodge | 3d6 |
| 6 | +3 | Expertise | 3d6 |
| 7 | +3 | Evasion, Reliable Talent | 4d6 |
| 8 | +3 | Ability Score Improvement | 4d6 |
| 9 | +4 | Subclass feature | 5d6 |
| 10 | +4 | Ability Score Improvement | 5d6 |
| 11 | +4 | Improved Cunning Strike | 6d6 |
| 12 | +4 | Ability Score Improvement | 6d6 |
| 13 | +5 | Subclass feature | 7d6 |
| 14 | +5 | Devious Strikes | 7d6 |
| 15 | +5 | Slippery Mind | 8d6 |
| 16 | +5 | Ability Score Improvement | 8d6 |
| 17 | +6 | Subclass feature | 9d6 |
| 18 | +6 | Elusive | 9d6 |
| 19 | +6 | Epic Boon | 10d6 |
| 20 | +6 | Stroke of Luck | 10d6 |

### Level 4: Ability Score Improvement

You gain the Ability Score Improvement feat (see “Feats”) or another feat of your choice for which you qualify. You gain this feature again at Rogue levels 8, 10, 12, and 16.

## Effects
```yaml
- choose: { id: asi, kind: feat, from: { feat: { qualify: true } }, default: $srd/feats/ability-score-improvement, at: [4, 8, 10, 12, 16] }
```

### Level 5: Cunning Strike

You’ve developed cunning ways to use your Sneak Attack. When you deal Sneak Attack damage, you can add one of the following Cunning Strike effects. Each effect has a die cost, which is the number of Sneak Attack damage dice you must forgo to add the effect. You remove the die before rolling, and the effect occurs immediately after the attack’s damage is dealt. For example, if you add the Poison effect, remove 1d6 from the Sneak Attack’s damage before rolling.

If a Cunning Strike effect requires a saving throw, the DC equals 8 plus your Dexterity modifier and Proficiency Bonus.

***Poison (Cost: 1d6).*** You add a toxin to your strike, forcing the target to make a Constitution saving throw. On a failed save, the target has the Poisoned condition for 1 minute. At the end of each of its turns, the Poisoned target repeats the save, ending the effect on itself on a success.

To use this effect, you must have a Poisoner’s Kit on your person.

***Trip (Cost: 1d6).*** If the target is Large or smaller, it must succeed on a Dexterity saving throw or have the Prone condition.

***Withdraw (Cost: 1d6).*** Immediately after the attack, you move up to half your Speed without provoking Opportunity Attacks.

## Effects
```yaml
- trigger:
    id: cunning-strike
    event: { use: $#sneak-attack }
    dc: 8 + mod:dex + prof
    offer:
      pick: 1                                         # Improved Cunning Strike raises this (§14.1)
      choose-one:
        - { id: poison, label: Poison, cost: { dice-from: $#sneak-attack, count: 1 },
            requires: { item: poisoners-kit },
            save: { ability: con }, apply: { condition: poisoned, duration: { amount: 1, unit: minute }, save-ends: end-of-turn } }
        - { id: trip, label: Trip, cost: { dice-from: $#sneak-attack, count: 1 }, if: "Target is Large or smaller",
            save: { ability: dex }, apply: { condition: prone } }
        - { id: withdraw, label: Withdraw, cost: { dice-from: $#sneak-attack, count: 1 },
            move: { distance: half-speed, no-opportunity-attacks: true } }
```

### Level 5: Uncanny Dodge

When an attacker that you can see hits you with an attack roll, you can take a Reaction to halve the attack’s damage against you (round down).

## Effects
```yaml
- trigger: { event: hit-by, reaction: true, if: "You can see the attacker", offer: { damage-taken: half } }
```

### Level 7: Evasion

You can nimbly dodge out of the way of certain dangers. When you’re subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed on the saving throw and only half damage if you fail. You can’t use this feature if you have the Incapacitated condition.

## Effects
```yaml
- save-rule: { ability: dex, success: none, failure: half, when: { not: { condition: incapacitated } } }
```

### Level 7: Reliable Talent

Whenever you make an ability check that uses one of your skill or tool proficiencies, you can treat a d20 roll of 9 or lower as a 10.

## Effects
```yaml
- roll-floor: { roll: [check:all], min: 10, when-proficient: true }
```

### Level 11: Improved Cunning Strike

You can use up to two Cunning Strike effects when you deal Sneak Attack damage, paying the die cost for each effect.

## Effects
```yaml
- modify: { target: $#cunning-strike, set: { offer.pick: 2 } }
```

### Level 14: Devious Strikes

You’ve practiced new ways to use your Sneak Attack deviously. The following effects are now among your Cunning Strike options.

***Daze (Cost: 2d6).*** The target must succeed on a Constitution saving throw, or on its next turn, it can do only one of the following: move or take an action or a Bonus Action.

***Knock Out (Cost: 6d6).*** The target must succeed on a Constitution saving throw, or it has the Unconscious condition for 1 minute or until it takes any damage. The Unconscious target repeats the save at the end of each of its turns, ending the effect on itself on a success.

***Obscure (Cost: 3d6).*** The target must succeed on a Dexterity saving throw, or it has the Blinded condition until the end of its next turn.

## Effects
```yaml
- modify:
    target: $#cunning-strike
    add:
      offer.choose-one:
        - { id: daze, label: Daze, cost: { dice-from: $#sneak-attack, count: 2 }, save: { ability: con },
            text: "On its next turn it can only move or take an action or a Bonus Action." }
        - { id: knock-out, label: Knock Out, cost: { dice-from: $#sneak-attack, count: 6 }, save: { ability: con },
            apply: { condition: unconscious, duration: { amount: 1, unit: minute }, ends-when: damage, save-ends: end-of-turn } }
        - { id: obscure, label: Obscure, cost: { dice-from: $#sneak-attack, count: 3 }, save: { ability: dex },
            apply: { condition: blinded, duration: { until: end-of-next-turn } } }
```

### Level 15: Slippery Mind

Your cunning mind is exceptionally difficult to control. You gain proficiency in Wisdom and Charisma saving throws.

## Effects
```yaml
- proficiency: [save:wis, save:cha]
```

### Level 18: Elusive

You’re so evasive that attackers rarely gain the upper hand against you. No attack roll can have Advantage against you unless you have the Incapacitated condition.

## Effects
```yaml
- cancel-advantage: { roll: attacks-against-you, when: { not: { condition: incapacitated } } }
```

### Level 19: Epic Boon

You gain an Epic Boon feat (see “Feats”) or another feat of your choice for which you qualify. Boon of the Night Spirit is recommended.

## Effects
```yaml
- choose: { id: epic-boon, kind: feat, from: { feat: { qualify: true } }, default: $srd/feats/boon-of-the-night-spirit }
```

### Level 20: Stroke of Luck

You have a marvelous knack for succeeding when you need to. If you fail a D20 Test, you can turn the roll into a 20.

Once you use this feature, you can’t use it again until you finish a Short or Long Rest.

## Effects
```yaml
- resource: { id: stroke-of-luck, max: 1, reset: short }
- trigger: { event: { fail: d20 }, offer: { treat-as: 20, cost: { resource: $#stroke-of-luck } } }
```
