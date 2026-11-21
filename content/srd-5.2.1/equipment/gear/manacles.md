# Manacles
**Type:** Gear
**Cost:** 2 GP
**Source:** SRD 5.2.1, p. 98

As a Utilize action, you can use Manacles to bind an unwilling Small or Medium creature within 5 feet of yourself that has the Grappled, Incapacitated, or Restrained condition if you succeed on a DC 13 Dexterity (Sleight of Hand) check. While bound, a creature has Disadvantage on attack rolls, and the creature is Restrained if the Manacles are attached to a chain or hook that is fixed in place. Escaping the Manacles requires a successful DC 20 Dexterity (Sleight of Hand) check as an action. Bursting them requires a successful DC 25 Strength (Athletics) check as an action.

Each set of Manacles comes with a key. Without the key, a creature can use Thieves’ Tools to pick the Manacles’ lock with a successful DC 15 Dexterity (Sleight of Hand) check.

## Effects
```yaml
- action: { activation: utilize, range: 5, targets: { count: 1, size-max: medium, condition: [grappled, incapacitated, restrained] }, check: { skill: sleight-of-hand, dc: 13 },
            on-success: { apply: { effects: [ { disadvantage: { roll: attack } } ], escape: { check: skill:sleight-of-hand, dc: 20 },
                                   text: "Restrained if chained to something fixed. Burst: DC 25 Str (Athletics); pick: DC 15 with Thieves' Tools." } } }
```
