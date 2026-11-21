# Boon of Irresistible Offense
**Type:** Feat
**Source:** SRD 5.2.1, p. 88
*Epic Boon Feat (Prerequisite: Level 19+)*

You gain the following benefits.

## Ability Score Increase

Increase your Strength or Dexterity score by 1, to a maximum of 30.

## Effects
```yaml
- choose: { id: boon-asi, kind: ability, from: [str, dex], amounts: [1], max: 30 }
```

## Overcome Defenses

The Bludgeoning, Piercing, and Slashing damage you deal always ignores Resistance.

## Effects
```yaml
- ignore-resistance: { damage: [bludgeoning, piercing, slashing] }
```

## Overwhelming Strike

When you roll a 20 on the d20 for an attack roll, you can deal extra damage to the target equal to the ability score increased by this feat. The extra damage’s type is the same as the attack’s type.

## Effects
```yaml
- trigger: { event: { roll: attack }, if-roll: 20, offer: { damage: { dice: score:choice:boon-asi, type: attack } } }
```
