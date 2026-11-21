# Fighter
**Type:** Class
**Source:** SRD 5.2.1, p. 47

## Core Fighter Traits

**Primary Ability:** Strength or Dexterity
**Hit Point Die:** D10 per Fighter level
**Saving Throw Proficiencies:** Strength and Constitution
**Skill Proficiencies:** Choose 2: Acrobatics, Animal Handling, Athletics, History, Insight, Intimidation, Persuasion, Perception, or Survival
**Weapon Proficiencies:** Simple and Martial weapons
**Armor Training:** Light, Medium, and Heavy armor and Shields
**Starting Equipment:** Choose A, B, or C: (A) Chain Mail, Greatsword, Flail, 8 Javelins, Dungeoneer’s Pack, and 4 GP; (B) Studded Leather Armor, Scimitar, Shortsword, Longbow, 20 Arrows, Quiver, Dungeoneer’s Pack, and 11 GP; or (C) 155 GP

## Effects
```yaml
- hit-die: d10
- proficiency: [save:str, save:con]
- choose: { id: skills, kind: skill, count: 2, grants: proficiency,
            from: [acrobatics, animal-handling, athletics, history, insight, intimidation, persuasion, perception, survival] }
- proficiency: [weapon:simple, weapon:martial]
- proficiency: [armor:light, armor:medium, armor:heavy, armor:shield]
- multiclass: [hit-die, weapon:martial, armor:light, armor:medium, armor:shield]
- equipment:
    options:
      - { id: a, items: [chain-mail, greatsword, flail, { javelin: 8 }, dungeoneers-pack], gp: 4 }
      - { id: b, items: [studded-leather-armor, scimitar, shortsword, longbow, { arrows: 20 }, quiver, dungeoneers-pack], gp: 11 }
      - { id: c, gp: 155 }
```

## Becoming a Fighter …

### As a Level 1 Character

- Gain all the traits in the Core Fighter Traits table.
- Gain the Fighter’s level 1 features, which are listed in the Fighter Features table.

### As a Multiclass Character

- Gain the following traits from the Core Fighter Traits table: Hit Point Die, proficiency with Martial weapons, and training with Light and Medium armor and Shields.
- Gain the Fighter’s level 1 features, which are listed in the Fighter Features table.

## Fighter Class Features

As a Fighter, you gain the following class features when you reach the specified Fighter levels. These features are listed on the Fighter Features table.

### Level 1: Fighting Style

You have honed your martial prowess and gain a Fighting Style feat of your choice (see “Feats”). Defense is recommended.

Whenever you gain a Fighter level, you can replace the feat you chose with a different Fighting Style feat.

## Effects
```yaml
- choose: { id: fighting-style, kind: feat, count: 1, from: { feat: { category: fighting-style } }, swap: level-up, default: $srd/feats/defense }
```

#### Fighter Features

| Level | Proficiency Bonus | Class Features | Second Wind | Weapon Mastery |
|---|---|---|---|---|
| 1 | +2 | Fighting Style, Second Wind, Weapon Mastery | 2 | 3 |
| 2 | +2 | Action Surge (one use), Tactical Mind | 2 | 3 |
| 3 | +2 | Fighter Subclass | 2 | 3 |
| 4 | +2 | Ability Score Improvement | 3 | 4 |
| 5 | +3 | Extra Attack, Tactical Shift | 3 | 4 |
| 6 | +3 | Ability Score Improvement | 3 | 4 |
| 7 | +3 | Subclass feature | 3 | 4 |
| 8 | +3 | Ability Score Improvement | 3 | 4 |
| 9 | +4 | Indomitable (one use), Tactical Master | 3 | 4 |
| 10 | +4 | Subclass feature | 4 | 5 |
| 11 | +4 | Two Extra Attacks | 4 | 5 |
| 12 | +4 | Ability Score Improvement | 4 | 5 |
| 13 | +5 | Indomitable (two uses), Studied Attacks | 4 | 5 |
| 14 | +5 | Ability Score Improvement | 4 | 5 |
| 15 | +5 | Subclass feature | 4 | 5 |
| 16 | +5 | Ability Score Improvement | 4 | 6 |
| 17 | +6 | Action Surge (two uses), Indomitable (three uses) | 4 | 6 |
| 18 | +6 | Subclass feature | 4 | 6 |
| 19 | +6 | Epic Boon | 4 | 6 |
| 20 | +6 | Three Extra Attacks | 4 | 6 |

### Level 1: Second Wind

You have a limited well of physical and mental stamina that you can draw on. As a Bonus Action, you can use it to regain Hit Points equal to 1d10 plus your Fighter level.

You can use this feature twice. You regain one expended use when you finish a Short Rest, and you regain all expended uses when you finish a Long Rest.

When you reach certain Fighter levels, you gain more uses of this feature, as shown in the Second Wind column of the Fighter Features table.

## Effects
```yaml
- resource: { id: second-wind, max: table:Second Wind, reset: long, partial: { at: short, amount: 1 } }
- action: { id: second-wind, activation: bonus, cost: { resource: $#second-wind }, heal: 1d10 + level:fighter }
```

### Level 1: Weapon Mastery

Your training with weapons allows you to use the mastery properties of three kinds of Simple or Martial weapons of your choice. Whenever you finish a Long Rest, you can practice weapon drills and change one of those weapon choices.

When you reach certain Fighter levels, you gain the ability to use the mastery properties of more kinds of weapons, as shown in the Weapon Mastery column of the Fighter Features table.

## Effects
```yaml
- choose: { id: mastery, kind: weapon, count: table:Weapon Mastery, from: { weapon: { category: [simple, martial] } },
            grants: mastery,
            swap: { at: long, count: 1 } }
```

### Level 2: Action Surge

You can push yourself beyond your normal limits for a moment. On your turn, you can take one additional action, except the Magic action.

Once you use this feature, you can’t do so again until you finish a Short or Long Rest. Starting at level 17, you can use it twice before a rest but only once on a turn.

## Effects
```yaml
- resource: { id: action-surge, max: { steps: { 2: 1, 17: 2 } }, reset: short }
- action: { id: action-surge, activation: none, cost: { resource: $#action-surge }, per: turn,
            text: "Take one additional action this turn, except the Magic action." }
```

### Level 2: Tactical Mind

You have a mind for tactics on and off the battlefield. When you fail an ability check, you can expend a use of your Second Wind to push yourself toward success. Rather than regaining Hit Points, you roll 1d10 and add the number rolled to the ability check, potentially turning it into a success. If the check still fails, this use of Second Wind isn’t expended.

## Effects
```yaml
- trigger: { event: { fail: check }, offer: { add-roll: 1d10, cost: { resource: $#second-wind }, refund: if-fails } }
```

### Level 3: Fighter Subclass

You gain a Fighter subclass of your choice. The Champion subclass is detailed after this class’s description. A subclass is a specialization that grants you features at certain Fighter levels. For the rest of your career, you gain each of your subclass’s features that are of your Fighter level or lower.

## Effects
```yaml
- choose: { id: subclass, kind: subclass, from: { subclass: { parent: $srd/fighter } } }
```

### Level 4: Ability Score Improvement

You gain the Ability Score Improvement feat (see “Feats”) or another feat of your choice for which you qualify. You gain this feature again at Fighter levels 6, 8, 12, 14, and 16.

## Effects
```yaml
- choose: { id: asi, kind: feat, from: { feat: { qualify: true } }, default: $srd/feats/ability-score-improvement,
            at: [4, 6, 8, 12, 14, 16] }
```

### Level 5: Extra Attack

You can attack twice instead of once whenever you take the Attack action on your turn.

## Effects
```yaml
- extra-attack: { total: 2 }
```

### Level 5: Tactical Shift

Whenever you activate your Second Wind with a Bonus Action, you can move up to half your Speed without provoking Opportunity Attacks.

## Effects
```yaml
- trigger: { event: { use: $#second-wind }, auto: false, offer: { move: { distance: half-speed, no-opportunity-attacks: true } } }
```

### Level 9: Indomitable

If you fail a saving throw, you can reroll it with a bonus equal to your Fighter level. You must use the new roll, and you can’t use this feature again until you finish a Long Rest.

You can use this feature twice before a Long Rest starting at level 13 and three times before a Long Rest starting at level 17.

## Effects
```yaml
- resource: { id: indomitable, max: { steps: { 9: 1, 13: 2, 17: 3 } }, reset: long }
- trigger: { event: { fail: save }, offer: { reroll: true, bonus: level:fighter, must-use-new: true, cost: { resource: $#indomitable } } }
```

### Level 9: Tactical Master

When you attack with a weapon whose mastery property you can use, you can replace that property with the Push, Sap, or Slow property for that attack.

## Effects
```yaml
- trigger: { event: attack, scope: { weapon: { mastery: true } },
             offer: { choose-one: [ { label: Push, text: "Use the Push mastery property for this attack" },
                                    { label: Sap,  text: "Use the Sap mastery property for this attack" },
                                    { label: Slow, text: "Use the Slow mastery property for this attack" } ] } }
```

### Level 11: Two Extra Attacks

You can attack three times instead of once whenever you take the Attack action on your turn.

## Effects
```yaml
- extra-attack: { total: 3 }
```

### Level 13: Studied Attacks

You study your opponents and learn from each attack you make. If you make an attack roll against a creature and miss, you have Advantage on your next attack roll against that creature before the end of your next turn.

## Effects
```yaml
- trigger: { event: miss, offer: { text: "Advantage on your next attack roll against that creature before the end of your next turn." } }
```

### Level 19: Epic Boon

You gain an Epic Boon feat (see “Feats”) or another feat of your choice for which you qualify. Boon of Combat Prowess is recommended.

## Effects
```yaml
- choose: { id: epic-boon, kind: feat, from: { feat: { qualify: true } }, default: $srd/feats/boon-of-combat-prowess }
```

### Level 20: Three Extra Attacks

You can attack four times instead of once whenever you take the Attack action on your turn.

## Effects
```yaml
- extra-attack: { total: 4 }
```
