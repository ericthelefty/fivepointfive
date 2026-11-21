# Boon of Truesight
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

## Truesight

You have Truesight with a range of 60 feet.

## Effects
```yaml
- sense: { truesight: 60 }
```
