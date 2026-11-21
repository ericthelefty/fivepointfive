# Ability Score Improvement
**Type:** Feat
**Source:** SRD 5.2.1, p. 87
*General Feat (Prerequisite: Level 4+)*

Increase one ability score of your choice by 2, or increase two ability scores of your choice by 1. This feat can’t increase an ability score above 20.

***Repeatable.*** You can take this feat more than once.

## Effects
```yaml
- choose: { id: asi, kind: ability, from: any, amounts: { choose-one: [[2], [1, 1]] }, max: 20 }
```
