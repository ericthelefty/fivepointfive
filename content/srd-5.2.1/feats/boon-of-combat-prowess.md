# Boon of Combat Prowess
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

## Peerless Aim

When you miss with an attack roll, you can hit instead. Once you use this benefit, you can’t use it again until the start of your next turn.

## Effects
```yaml
- trigger: { event: miss, per: { until: start-of-next-turn }, offer: { treat-as: hit } }
```
