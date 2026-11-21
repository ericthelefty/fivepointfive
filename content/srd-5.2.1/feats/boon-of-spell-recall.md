# Boon of Spell Recall
**Type:** Feat
**Source:** SRD 5.2.1, p. 88
*Epic Boon Feat (Prerequisite: Level 19+, Spellcasting Feature)*

You gain the following benefits.

## Ability Score Increase

Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 30.

## Effects
```yaml
- choose: { id: boon-asi, kind: ability, from: [int, wis, cha], amounts: [1], max: 30 }
```

## Free Casting

Whenever you cast a spell with a level 1–4 spell slot, roll 1d4. If the number you roll is the same as the slot’s level, the slot isn’t expended.

## Effects
```yaml
- trigger: { event: cast, scope: { spell: { slot: [1, 2, 3, 4] } }, auto: true,
             offer: { roll: 1d4, if-roll: slot-level, refund: slot } }
```
