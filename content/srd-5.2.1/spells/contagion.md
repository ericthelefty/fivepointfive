# Contagion
**Type:** Spell
**Source:** SRD 5.2.1, p. 119
*Level 5 Necromancy (Cleric, Druid)*
**Casting Time:** Action
**Range:** Touch
**Component:** V, S
**Duration:** 7 days

Your touch inflicts a magical contagion. The target must succeed on a Constitution saving throw or take 11d8 Necrotic damage and have the Poisoned condition. Also, choose one ability when you cast the spell. While Poisoned, the target has Disadvantage on saving throws made with the chosen ability.

The target must repeat the saving throw at the end of each of its turns until it gets three successes or failures. If the target succeeds on three of these saves, the spell ends on the target. If the target fails three of the saves, the spell lasts for 7 days on it.

Whenever the Poisoned target receives an effect that would end the Poisoned condition, the target must succeed on a Constitution saving throw, or the Poisoned condition doesn’t end on it.

## Effects
```yaml
- action: { range: touch, save: { ability: con }, choose: { kind: ability, id: contagion-ability },
            on-failure: { damage: { dice: 11d8, type: necrotic }, apply: { condition: poisoned,
              effects: [ { disadvantage: { roll: save:chosen } } ],
              save-ends: { at: end-of-turn, successes: 3, failures: 3, on-fail-out: { duration: { amount: 7, unit: day } } } } } }
```
