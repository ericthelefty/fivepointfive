# Barbarian
**Type:** Class
**Source:** SRD 5.2.1, p. 28

## Core Barbarian Traits

**Primary Ability:** Strength
**Hit Point Die:** D12 per Barbarian level
**Saving Throw Proficiencies:** Strength and Constitution
**Skill Proficiencies:** Choose 2: Animal Handling, Athletics, Intimidation, Nature, Perception, or Survival
**Weapon Proficiencies:** Simple and Martial weapons
**Armor Training:** Light and Medium armor and Shields
**Starting Equipment:** Choose A or B: (A) Greataxe, 4 Handaxes, Explorer’s Pack, and 15 GP; or (B) 75 GP

## Effects
```yaml
- hit-die: d12
- proficiency: [save:str, save:con]
- choose: { id: skills, kind: skill, count: 2, grants: proficiency,
            from: [animal-handling, athletics, intimidation, nature, perception, survival] }
- proficiency: [weapon:simple, weapon:martial, armor:light, armor:medium, armor:shield]
- multiclass: [hit-die, armor:shield, weapon:martial]
- equipment:
    options:
      - { id: a, items: [greataxe, { handaxe: 4 }, explorers-pack], gp: 15 }
      - { id: b, gp: 75 }
```

## Becoming a Barbarian …

### As a Level 1 Character

- Gain all the traits in the Core Barbarian Traits table.
- Gain the Barbarian’s level 1 features, which are listed in the Barbarian Features table.

### As a Multiclass Character

- Gain the following traits from the Core Barbarian Traits table: Hit Point Die, proficiency with Martial weapons, and training with Shields.
- Gain the Barbarian’s level 1 features, which are listed in the Barbarian Features table.

## Barbarian Class Features

As a Barbarian, you gain the following class features when you reach the specified Barbarian levels. These features are listed in the Barbarian Features table.

### Level 1: Rage

You can imbue yourself with a primal power called Rage, a force that grants you extraordinary might and resilience. You can enter it as a Bonus Action if you aren’t wearing Heavy armor.

You can enter your Rage the number of times shown for your Barbarian level in the Rages column of the Barbarian Features table. You regain one expended use when you finish a Short Rest, and you regain all expended uses when you finish a Long Rest.

## Effects
```yaml
- resource: { id: rages, max: table:Rages, reset: long, partial: { at: short, amount: 1 } }
- toggle:
    id: rage
    activation: bonus
    cost: { resource: $#rages }
    if: "You aren't wearing Heavy armor"
    duration: { until: end-of-next-turn, extend: "attack an enemy, force an enemy to save, or take a Bonus Action", max: { amount: 10, unit: minute } }
    ends-when: [{ armor: heavy }, { condition: incapacitated }]
    blocks: [concentration, spellcasting]
    effects:
      - defense: { resistance: [bludgeoning, piercing, slashing] }
      - bonus: { to: damage, value: table:Rage Damage, scope: { ability: str } }
      - advantage: { roll: [check:str, save:str] }
```

#### Barbarian Features

| Level | Proficiency Bonus | Class Features | Rages | Rage Damage | Weapon Mastery |
|---|---|---|---|---|---|
| 1 | +2 | Rage, Unarmored Defense, Weapon Mastery | 2 | +2 | 2 |
| 2 | +2 | Danger Sense, Reckless Attack | 2 | +2 | 2 |
| 3 | +2 | Barbarian Subclass, Primal Knowledge | 3 | +2 | 2 |
| 4 | +2 | Ability Score Improvement | 3 | +2 | 3 |
| 5 | +3 | Extra Attack, Fast Movement | 3 | +2 | 3 |
| 6 | +3 | Subclass feature | 4 | +2 | 3 |
| 7 | +3 | Feral Instinct, Instinctive Pounce | 4 | +2 | 3 |
| 8 | +3 | Ability Score Improvement | 4 | +2 | 3 |
| 9 | +4 | Brutal Strike | 4 | +3 | 3 |
| 10 | +4 | Subclass feature | 4 | +3 | 4 |
| 11 | +4 | Relentless Rage | 4 | +3 | 4 |
| 12 | +4 | Ability Score Improvement | 5 | +3 | 4 |
| 13 | +5 | Improved Brutal Strike | 5 | +3 | 4 |
| 14 | +5 | Subclass feature | 5 | +3 | 4 |
| 15 | +5 | Persistent Rage | 5 | +3 | 4 |
| 16 | +5 | Ability Score Improvement | 5 | +4 | 4 |
| 17 | +6 | Improved Brutal Strike | 6 | +4 | 4 |
| 18 | +6 | Indomitable Might | 6 | +4 | 4 |
| 19 | +6 | Epic Boon | 6 | +4 | 4 |
| 20 | +6 | Primal Champion | 6 | +4 | 4 |

While active, your Rage follows the rules below.

***Damage Resistance.*** You have Resistance to Bludgeoning, Piercing, and Slashing damage.

***Rage Damage.*** When you make an attack using Strength—with either a weapon or an Unarmed Strike—and deal damage to the target, you gain a bonus to the damage that increases as you gain levels as a Barbarian, as shown in the Rage Damage column of the Barbarian Features table.

***Strength Advantage.*** You have Advantage on Strength checks and Strength saving throws.

***No Concentration or Spells.*** You can’t maintain Concentration, and you can’t cast spells.

***Duration.*** The Rage lasts until the end of your next turn, and it ends early if you don Heavy armor or have the Incapacitated condition. If your Rage is still active on your next turn, you can extend the Rage for another round by doing one of the following:

- Make an attack roll against an enemy.
- Force an enemy to make a saving throw.
- Take a Bonus Action to extend your Rage.

Each time the Rage is extended, it lasts until the end of your next turn. You can maintain a Rage for up to 10 minutes.

### Level 1: Unarmored Defense

While you aren’t wearing any armor, your base Armor Class equals 10 plus your Dexterity and Constitution modifiers. You can use a Shield and still gain this benefit.

## Effects
```yaml
- base: { to: ac, value: 10 + mod:dex + mod:con, when: { armor: none }, allow-shield: true }
```

### Level 1: Weapon Mastery

Your training with weapons allows you to use the mastery properties of two kinds of Simple or Martial Melee weapons of your choice, such as Greataxes and Handaxes. Whenever you finish a Long Rest, you can practice weapon drills and change one of those weapon choices.

When you reach certain Barbarian levels, you gain the ability to use the mastery properties of more kinds of weapons, as shown in the Weapon Mastery column of the Barbarian Features table.

## Effects
```yaml
- choose: { id: mastery, kind: weapon, count: table:Weapon Mastery, grants: mastery,
            from: { weapon: { kind: melee, category: [simple, martial] } }, swap: { at: long, count: 1 } }
```

### Level 2: Danger Sense

You gain an uncanny sense of when things aren’t as they should be, giving you an edge when you dodge perils. You have Advantage on Dexterity saving throws unless you have the Incapacitated condition.

## Effects
```yaml
- advantage: { roll: save:dex, when: { not: { condition: incapacitated } } }
```

### Level 2: Reckless Attack

You can throw aside all concern for defense to attack with increased ferocity. When you make your first attack roll on your turn, you can decide to attack recklessly. Doing so gives you Advantage on attack rolls using Strength until the start of your next turn, but attack rolls against you have Advantage during that time.

## Effects
```yaml
- toggle:
    id: reckless-attack
    activation: none
    if: "You're making your first attack roll on your turn"
    duration: { until: start-of-next-turn }
    effects:
      - advantage: { roll: attack, scope: { ability: str } }
      - advantage: { roll: attacks-against-you }
```

### Level 3: Barbarian Subclass

You gain a Barbarian subclass of your choice. The Path of the Berserker subclass is detailed after this class’s description. A subclass is a specialization that grants you features at certain Barbarian levels. For the rest of your career, you gain each of your subclass’s features that are of your Barbarian level or lower.

## Effects
```yaml
- choose: { id: subclass, kind: subclass, from: { subclass: { parent: $srd/barbarian } } }
```

### Level 3: Primal Knowledge

You gain proficiency in another skill of your choice from the skill list available to Barbarians at level 1.

In addition, while your Rage is active, you can channel primal power when you attempt certain tasks; whenever you make an ability check using one of the following skills, you can make it as a Strength check even if it normally uses a different ability: Acrobatics, Intimidation, Perception, Stealth, or Survival. When you use this ability, your Strength represents primal power coursing through you, honing your agility, bearing, and senses.

## Effects
```yaml
- choose: { id: primal-skill, kind: skill, count: 1, grants: proficiency, from: $#skills }
- use-ability: { ability: str, instead-of: any, for: [skill:acrobatics, skill:intimidation, skill:perception, skill:stealth, skill:survival],
                 when: { active: $#rage } }
```

### Level 4: Ability Score Improvement

You gain the Ability Score Improvement feat (see “Feats”) or another feat of your choice for which you qualify. You gain this feature again at Barbarian levels 8, 12, and 16.

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

### Level 5: Fast Movement

Your speed increases by 10 feet while you aren’t wearing Heavy armor.

## Effects
```yaml
- bonus: { to: speed:walk, value: 10, when: { not: { armor: heavy } } }
```

### Level 7: Feral Instinct

Your instincts are so honed that you have Advantage on Initiative rolls.

## Effects
```yaml
- advantage: { roll: initiative }
```

### Level 7: Instinctive Pounce

As part of the Bonus Action you take to enter your Rage, you can move up to half your Speed.

## Effects
```yaml
- modify: { target: $#rage, set: { move: { distance: half-speed } } }
```

### Level 9: Brutal Strike

If you use Reckless Attack, you can forgo any Advantage on one Strength-based attack roll of your choice on your turn. The chosen attack roll mustn’t have Disadvantage. If the chosen attack roll hits, the target takes an extra 1d10 damage of the same type dealt by the weapon or Unarmed Strike, and you can cause one Brutal Strike effect of your choice. You have the following effect options.

***Forceful Blow.*** The target is pushed 15 feet straight away from you. You can then move up to half your Speed straight toward the target without provoking Opportunity Attacks.

***Hamstring Blow.*** The target’s Speed is reduced by 15 feet until the start of your next turn. A target can be affected by only one Hamstring Blow at a time— the most recent one.

## Effects
```yaml
- trigger:
    id: brutal-strike
    event: attack
    scope: { ability: str }
    when: { active: $#reckless-attack }
    per: turn
    if: "The roll has Advantage and no Disadvantage; you give up the Advantage"
    offer:
      damage: { dice: 1d10, type: weapon, applies-to: hit }
      pick: 1
      choose-one:
        - { id: forceful-blow, label: Forceful Blow,
            text: "Push the target 15 feet away; you can then move up to half your Speed toward it without provoking Opportunity Attacks." }
        - { id: hamstring-blow, label: Hamstring Blow,
            text: "The target's Speed drops by 15 feet until the start of your next turn (only the most recent Hamstring Blow applies)." }
```

### Level 11: Relentless Rage

Your Rage can keep you fighting despite grievous wounds. If you drop to 0 Hit Points while your Rage is active and don’t die outright, you can make a DC 10 Constitution saving throw. If you succeed, your Hit Points instead change to a number equal to twice your Barbarian level.

Each time you use this feature after the first, the DC increases by 5. When you finish a Short or Long Rest, the DC resets to 10.

## Effects
```yaml
- trigger:
    id: relentless-rage
    event: zero-hp
    when: { active: $#rage }
    if: "You don't die outright"
    counter: { reset: short }
    dc: 10 + 5 * uses
    offer: { save: { ability: con }, on-success: { set-hp: 2 * level:barbarian } }
```

### Level 13: Improved Brutal Strike

You have honed new ways to attack furiously. The following effects are now among your Brutal Strike options.

***Staggering Blow.*** The target has Disadvantage on the next saving throw it makes, and it can’t make Opportunity Attacks until the start of your next turn.

***Sundering Blow.*** Before the start of your next turn, the next attack roll made by another creature against the target gains a +5 bonus to the roll. An attack roll can gain only one Sundering Blow bonus.

## Effects
```yaml
- modify:
    target: $#brutal-strike
    at: 13
    add:
      offer.choose-one:
        - { id: staggering-blow, label: Staggering Blow,
            text: "The target has Disadvantage on its next saving throw and can't make Opportunity Attacks until the start of your next turn." }
        - { id: sundering-blow, label: Sundering Blow,
            text: "The next attack roll by another creature against the target before your next turn gains +5." }
```

### Level 15: Persistent Rage

When you roll Initiative, you can regain all expended uses of Rage. After you regain uses of Rage in this way, you can’t do so again until you finish a Long Rest.

In addition, your Rage is so fierce that it now lasts for 10 minutes without you needing to do anything to extend it from round to round. Your Rage ends early if you have the Unconscious condition (not just the Incapacitated condition) or don Heavy armor.

## Effects
```yaml
- trigger: { event: { roll: initiative }, per: long, offer: { regain: { resource: $#rages, to: max } } }
- modify: { target: $#rage, set: { duration: { amount: 10, unit: minute }, ends-when: [{ armor: heavy }, { condition: unconscious }] } }
```

### Level 17: Improved Brutal Strike

The extra damage of your Brutal Strike increases to 2d10. In addition, you can use two different Brutal Strike effects whenever you use your Brutal Strike feature.

## Effects
```yaml
- modify: { target: $#brutal-strike, at: 17, set: { offer.damage.dice: 2d10, offer.pick: 2 } }
```

### Level 18: Indomitable Might

If your total for a Strength check or Strength saving throw is less than your Strength score, you can use that score in place of the total.

## Effects
```yaml
- roll-floor: { roll: [check:str, save:str], total-min: score:str }
```

### Level 19: Epic Boon

You gain an Epic Boon feat (see “Feats”) or another feat of your choice for which you qualify. Boon of Irresistible Offense is recommended.

## Effects
```yaml
- choose: { id: epic-boon, kind: feat, from: { feat: { qualify: true } }, default: $srd/feats/boon-of-irresistible-offense }
```

### Level 20: Primal Champion

You embody primal power. Your Strength and Constitution scores increase by 4, to a maximum of 25.

## Effects
```yaml
- score: { str: 4, con: 4, max: 25 }
```
