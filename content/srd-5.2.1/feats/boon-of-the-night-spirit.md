# Boon of the Night Spirit
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

## Merge with Shadows

While within Dim Light or Darkness, you can give yourself the Invisible condition as a Bonus Action. The condition ends on you immediately after you take an action, a Bonus Action, or a Reaction.

## Effects
```yaml
- action: { activation: bonus, when: { player: "In Dim Light or Darkness" },
            apply: { condition: invisible, ends-when: [action, bonus-action, reaction] } }
```

## Shadowy Form

While within Dim Light or Darkness, you have Resistance to all damage except Psychic and Radiant.

## Effects
```yaml
- defense: { resistance: [all], except: [psychic, radiant], when: { player: "In Dim Light or Darkness" } }
```
