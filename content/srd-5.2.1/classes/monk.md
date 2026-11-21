# Monk
**Type:** Class
**Source:** SRD 5.2.1, p. 49

## Core Monk Traits

**Primary Ability:** Dexterity and Wisdom
**Hit Point Die:** D8 per Monk level
**Saving Throw Proficiencies:** Strength and Dexterity
**Skill Proficiencies:** Choose 2: Acrobatics, Athletics, History, Insight, Religion, or Stealth
**Weapon Proficiencies:** Simple weapons and Martial weapons that have the Light property
**Tool Proficiencies:** Choose one type of Artisan’s Tools or Musical Instrument (see “Equipment”)
**Armor Training:** None
**Starting Equipment:** Choose A or B: (A) Spear, 5 Daggers, Artisan’s Tools or Musical Instrument chosen for the tool proficiency above, Explorer’s Pack, and 11 GP; or (B) 50 GP

## Effects
```yaml
- hit-die: d8
- proficiency: [save:str, save:dex, weapon:simple, { weapon: { category: martial, property: light } }]
- choose: { id: skills, kind: skill, count: 2, grants: proficiency, from: [acrobatics, athletics, history, insight, religion, stealth] }
- choose: { id: tool, kind: tool, count: 1, grants: proficiency,
            from: { any: [ { tool: { category: artisans-tools } }, { tool: { category: musical-instrument } } ] } }
- multiclass: [hit-die]
- equipment:
    options:
      - { id: a, items: [spear, { dagger: 5 }, choice:tool, explorers-pack], gp: 11 }
      - { id: b, gp: 50 }
```

## Becoming a Monk …

### As a Level 1 Character

- Gain all the traits in the Core Monk Traits table.
- Gain the Monk’s level 1 features, which are listed in the Monk Features table.

### As a Multiclass Character

- Gain the Hit Point Die trait from the Core Monk Traits table.
- Gain the Monk’s level 1 features, which are listed in the Monk Features table.

## Monk Class Features

As a Monk, you gain the following class features when you reach the specified Monk levels. These features are listed in the Monk Features table.

### Level 1: Martial Arts

Your practice of martial arts gives you mastery of combat styles that use your Unarmed Strike and Monk weapons, which are the following:

- Simple Melee weapons
- Martial Melee weapons that have the Light property

You gain the following benefits while you are unarmed or wielding only Monk weapons and you aren’t wearing armor or wielding a Shield.

***Bonus Unarmed Strike.*** You can make an Unarmed Strike as a Bonus Action.

***Martial Arts Die.*** You can roll 1d6 in place of the normal damage of your Unarmed Strike or Monk weapons. This die changes as you gain Monk levels, as shown in the Martial Arts column of the Monk Features table.

***Dexterous Attacks.*** You can use your Dexterity modifier instead of your Strength modifier for the attack and damage rolls of your Unarmed Strikes and Monk weapons. In addition, when you use the Grapple or Shove option of your Unarmed Strike, you can use your Dexterity modifier instead of your Strength modifier to determine the save DC.

## Effects
```yaml
- action: { id: bonus-unarmed-strike, activation: bonus, attack: { weapon: unarmed },
            when: { armor: none, shield: false, wielding: [monk-weapon, none] } }
- damage-die: { die: table:Martial Arts, if-higher: true, scope: { any: [ { weapon: { monk: true } }, { weapon: { unarmed: true } } ] },
                when: { armor: none, shield: false, wielding: [monk-weapon, none] } }
- use-ability: { ability: dex, instead-of: str, for: [attack, damage, grapple-dc, shove-dc],
                 scope: { any: [ { weapon: { monk: true } }, { weapon: { unarmed: true } } ] },
                 when: { armor: none, shield: false, wielding: [monk-weapon, none] } }
```

### Level 1: Unarmored Defense

While you aren’t wearing armor or wielding a Shield, your base Armor Class equals 10 plus your Dexterity and Wisdom modifiers.

## Effects
```yaml
- base: { to: ac, value: 10 + mod:dex + mod:wis, when: { armor: none, shield: false } }
```

### Level 2: Monk’s Focus

Your focus and martial training allow you to harness a well of extraordinary energy within yourself. This energy is represented by Focus Points. Your Monk level determines the number of points you have, as shown in the Focus Points column of the Monk Features table.

You can expend these points to enhance or fuel certain Monk features. You start knowing three such features: Flurry of Blows, Patient Defense, and Step of the Wind, each of which is detailed below.

When you expend a Focus Point, it is unavailable until you finish a Short or Long Rest, at the end of which you regain all your expended points.

Some features that use Focus Points require your target to make a saving throw. The save DC equals 8 plus your Wisdom modifier and Proficiency Bonus.

***Flurry of Blows.*** You can expend 1 Focus Point to make two Unarmed Strikes as a Bonus Action.

***Patient Defense.*** You can take the Disengage action as a Bonus Action. Alternatively, you can expend 1 Focus Point to take both the Disengage and the Dodge actions as a Bonus Action.

## Effects
```yaml
- resource: { id: focus, max: table:Focus Points, reset: short }
- set: { to: save-dc:monk, value: 8 + mod:wis + prof, mode: override }
- action: { id: flurry-of-blows, activation: bonus, cost: { resource: $#focus }, attack: { weapon: unarmed, count: 2 } }
- action: { id: patient-defense, activation: bonus,
            choose-one: [ { id: basic, take: disengage }, { id: focused, take: [disengage, dodge], cost: { resource: $#focus } } ] }
- action: { id: step-of-the-wind, activation: bonus,
            choose-one: [ { id: basic, take: dash }, { id: focused, take: [disengage, dash], cost: { resource: $#focus }, effects: [ { set: { to: jump, value: 2, mode: multiply } } ] } ] }
```

#### Monk Features

| Level | Proficiency Bonus | Class Features | Martial Arts | Focus Points | Unarmored Movement |
|---|---|---|---|---|---|
| 1 | +2 | Martial Arts, Unarmored Defense | 1d6 | — | — |
| 2 | +2 | Monk’s Focus, Unarmored Movement, Uncanny Metabolism | 1d6 | 2 | +10 ft. |
| 3 | +2 | Deflect Attacks, Monk Subclass | 1d6 | 3 | +10 ft. |
| 4 | +2 | Ability Score Improvement, Slow Fall | 1d6 | 4 | +10 ft. |
| 5 | +3 | Extra Attack, Stunning Strike | 1d8 | 5 | +10 ft. |
| 6 | +3 | Empowered Strikes, Subclass feature | 1d8 | 6 | +15 ft. |
| 7 | +3 | Evasion | 1d8 | 7 | +15 ft. |
| 8 | +3 | Ability Score Improvement | 1d8 | 8 | +15 ft. |
| 9 | +4 | Acrobatic Movement | 1d8 | 9 | +15 ft. |
| 10 | +4 | Heightened Focus, Self-Restoration | 1d8 | 10 | +20 ft. |
| 11 | +4 | Subclass feature | 1d10 | 11 | +20 ft. |
| 12 | +4 | Ability Score Improvement | 1d10 | 12 | +20 ft. |
| 13 | +5 | Deflect Energy | 1d10 | 13 | +20 ft. |
| 14 | +5 | Disciplined Survivor | 1d10 | 14 | +25 ft. |
| 15 | +5 | Perfect Focus | 1d10 | 15 | +25 ft. |
| 16 | +5 | Ability Score Improvement | 1d10 | 16 | +25 ft. |
| 17 | +6 | Subclass feature | 1d12 | 17 | +25 ft. |
| 18 | +6 | Superior Defense | 1d12 | 18 | +30 ft. |
| 19 | +6 | Epic Boon | 1d12 | 19 | +30 ft. |
| 20 | +6 | Body and Mind | 1d12 | 20 | +30 ft. |

***Step of the Wind.*** You can take the Dash action as a Bonus Action. Alternatively, you can expend 1 Focus Point to take both the Disengage and Dash actions as a Bonus Action, and your jump distance is doubled for the turn.

### Level 2: Unarmored Movement

Your speed increases by 10 feet while you aren’t wearing armor or wielding a Shield. This bonus increases when you reach certain Monk levels, as shown on the Monk Features table.

## Effects
```yaml
- bonus: { to: speed:walk, value: table:Unarmored Movement, when: { armor: none, shield: false } }
```

### Level 2: Uncanny Metabolism

When you roll Initiative, you can regain all expended Focus Points. When you do so, roll your Martial Arts die, and regain a number of Hit Points equal to your Monk level plus the number rolled.

Once you use this feature, you can’t use it again until you finish a Long Rest.

## Effects
```yaml
- trigger: { id: uncanny-metabolism, event: { roll: initiative }, per: long,
             offer: { regain: { resource: $#focus, to: max }, heal: table:Martial Arts + level:monk } }
```

### Level 3: Deflect Attacks

When an attack roll hits you and its damage includes Bludgeoning, Piercing, or Slashing damage, you can take a Reaction to reduce the attack’s total damage against you. The reduction equals 1d10 plus your Dexterity modifier and Monk level.

If you reduce the damage to 0, you can expend 1 Focus Point to redirect some of the attack’s force. If you do so, choose a creature you can see within 5 feet of yourself if the attack was a melee attack or a creature you can see within 60 feet of yourself that isn’t behind Total Cover if the attack was a ranged attack. That creature must succeed on a Dexterity saving throw or take damage equal to two rolls of your Martial Arts die plus your Dexterity modifier. The damage is the same type dealt by the attack.

## Effects
```yaml
- trigger:
    id: deflect-attacks
    event: hit-by
    reaction: true
    scope: { against: { damage: [bludgeoning, piercing, slashing] } }
    offer:
      damage-taken: { reduce: 1d10 + mod:dex + level:monk }
      then:
        if: "The damage was reduced to 0"
        cost: { resource: $#focus }
        save: { ability: dex, dc: save-dc:monk }
        damage: { dice: "dice(2, table:Martial Arts) + mod:dex", type: attack }
        text: "One creature within 5 feet (melee) or 60 feet not behind Total Cover (ranged)."
```

### Level 3: Monk Subclass

You gain a Monk subclass of your choice. The Warrior of the Open Hand subclass is detailed after this class’s description. A subclass is a specialization that grants you features at certain Monk levels. For the rest of your career, you gain each of your subclass’s features that are of your Monk level or lower.

## Effects
```yaml
- choose: { id: subclass, kind: subclass, from: { subclass: { parent: $srd/monk } } }
```

### Level 4: Ability Score Improvement

You gain the Ability Score Improvement feat (see “Feats”) or another feat of your choice for which you qualify. You gain this feature again at Monk levels 8, 12, and 16.

## Effects
```yaml
- choose: { id: asi, kind: feat, from: { feat: { qualify: true } }, default: $srd/feats/ability-score-improvement, at: [4, 8, 12, 16] }
```

### Level 4: Slow Fall

You can take a Reaction when you fall to reduce any damage you take from the fall by an amount equal to five times your Monk level.

## Effects
```yaml
- trigger: { event: fall, reaction: true, offer: { damage-taken: { reduce: 5 * level:monk } } }
```

### Level 5: Extra Attack

You can attack twice instead of once whenever you take the Attack action on your turn.

## Effects
```yaml
- extra-attack: { total: 2 }
```

### Level 5: Stunning Strike

Once per turn when you hit a creature with a Monk weapon or an Unarmed Strike, you can expend 1 Focus Point to attempt a stunning strike. The target must make a Constitution saving throw. On a failed save, the target has the Stunned condition until the start of your next turn. On a successful save, the target’s Speed is halved until the start of your next turn, and the next attack roll made against the target before then has Advantage.

## Effects
```yaml
- trigger:
    event: hit
    scope: { any: [ { weapon: { monk: true } }, { weapon: { unarmed: true } } ] }
    per: turn
    offer:
      cost: { resource: $#focus }
      save: { ability: con, dc: save-dc:monk }
      apply: { condition: stunned, duration: { until: start-of-next-turn } }
      on-success: { text: "Speed halved and the next attack roll against it has Advantage, until the start of your next turn." }
```

### Level 6: Empowered Strikes

Whenever you deal damage with your Unarmed Strike, it can deal your choice of Force damage or its normal damage type.

## Effects
```yaml
- damage-type: { add-option: force, scope: { weapon: { unarmed: true } } }
```

### Level 7: Evasion

When you’re subjected to an effect that allows you to make a Dexterity saving throw to take only half damage, you instead take no damage if you succeed on the saving throw and only half damage if you fail.

You don’t benefit from this feature if you have the Incapacitated condition.

## Effects
```yaml
- save-rule: { ability: dex, success: none, failure: half, when: { not: { condition: incapacitated } } }
```

### Level 9: Acrobatic Movement

While you aren’t wearing armor or wielding a Shield, you gain the ability to move along vertical surfaces and across liquids on your turn without falling during the movement.

## Effects
```yaml
- trait: { id: acrobatic-movement, text: "Move along vertical surfaces and across liquids on your turn without falling.",
           when: { armor: none, shield: false } }
```

### Level 10: Heightened Focus

Your Flurry of Blows, Patient Defense, and Step of the Wind gain the following benefits.

***Flurry of Blows.*** You can expend 1 Focus Point to use Flurry of Blows and make three Unarmed Strikes with it instead of two.

***Patient Defense.*** When you expend a Focus Point to use Patient Defense, you gain a number of Temporary Hit Points equal to two rolls of your Martial Arts die.

***Step of the Wind.*** When you expend a Focus Point to use Step of the Wind, you can choose a willing creature within 5 feet of yourself that is Large or smaller. You move the creature with you until the end of your turn. The creature’s movement doesn’t provoke Opportunity Attacks.

## Effects
```yaml
- modify: { target: $#flurry-of-blows, set: { attack.count: 3 } }
- modify: { target: $#patient-defense, add: { choose-one.focused.temp-hp: "dice(2, table:Martial Arts)" } }
- modify: { target: $#step-of-the-wind, add: { choose-one.focused.text: "Bring a willing Large or smaller creature within 5 feet along; its movement doesn't provoke Opportunity Attacks." } }
```

### Level 10: Self-Restoration

Through sheer force of will, you can remove one of the following conditions from yourself at the end of each of your turns: Charmed, Frightened, or Poisoned.

In addition, forgoing food and drink doesn’t give you levels of Exhaustion.

## Effects
```yaml
- trigger: { event: end-of-turn, offer: { text: "End one of these on yourself: Charmed, Frightened, Poisoned." } }
- trait: { text: "Going without food and drink doesn't give you Exhaustion." }
```

### Level 13: Deflect Energy

You can now use your Deflect Attacks feature against attacks that deal any damage type, not just Bludgeoning, Piercing, or Slashing.

## Effects
```yaml
- modify: { target: $#deflect-attacks, set: { scope: {} } }
```

### Level 14: Disciplined Survivor

Your physical and mental discipline grant you proficiency in all saving throws.

Additionally, whenever you make a saving throw and fail, you can expend 1 Focus Point to reroll it, and you must use the new roll.

## Effects
```yaml
- proficiency: [save:all]
- trigger: { event: { fail: save }, offer: { reroll: true, must-use-new: true, cost: { resource: $#focus } } }
```

### Level 15: Perfect Focus

When you roll Initiative and don’t use Uncanny Metabolism, you regain expended Focus Points until you have 4 if you have 3 or fewer.

## Effects
```yaml
- trigger: { event: { roll: initiative }, if: "You didn't use Uncanny Metabolism", auto: true,
             offer: { regain: { resource: $#focus, to: 4, only-up: true } } }
```

### Level 18: Superior Defense

At the start of your turn, you can expend 3 Focus Points to bolster yourself against harm for 1 minute or until you have the Incapacitated condition. During that time, you have Resistance to all damage except Force damage.

## Effects
```yaml
- toggle:
    activation: start-of-turn
    cost: { resource: $#focus, amount: 3 }
    duration: { amount: 1, unit: minute }
    ends-when: [{ condition: incapacitated }]
    effects:
      - defense: { resistance: [all], except: [force] }
```

### Level 19: Epic Boon

You gain an Epic Boon feat (see “Feats”) or another feat of your choice for which you qualify. Boon of Irresistible Offense is recommended.

## Effects
```yaml
- choose: { id: epic-boon, kind: feat, from: { feat: { qualify: true } }, default: $srd/feats/boon-of-irresistible-offense }
```

### Level 20: Body and Mind

You have developed your body and mind to new heights. Your Dexterity and Wisdom scores increase by 4, to a maximum of 25.

## Effects
```yaml
- score: { dex: 4, wis: 4, max: 25 }
```
