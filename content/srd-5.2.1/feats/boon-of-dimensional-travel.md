# Boon of Dimensional Travel
**Type:** Feat
**Source:** SRD 5.2.1, p. 88
*Epic Boon Feat (Prerequisite: Level 19+)*

You gain the following benefits.

## Ability Score Increase

Increase one ability score of your choice by 1, to a maximum of 30.

## Effects
```yaml
- choose: { id: boon-asi, kind: ability, from: any, amounts: [1], max: 30 }
```

## Blink Steps

Immediately after you take the Attack action or the Magic action, you can teleport up to 30 feet to an unoccupied space you can see.

## Effects
```yaml
- trigger: { event: [ { use: attack-action }, { use: magic-action } ], offer: { move: { teleport: 30 } } }
```
