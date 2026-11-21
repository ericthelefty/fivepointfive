# Harm
**Type:** Spell
**Source:** SRD 5.2.1, p. 139
*Level 6 Necromancy (Cleric)*
**Casting Time:** Action
**Range:** 60 feet
**Components:** V, S
**Duration:** Instantaneous

You unleash virulent magic on a creature you can see within range. The target makes a Constitution saving throw. On a failed save, it takes 14d6 Necrotic damage, and its Hit Point maximum is reduced by an amount equal to the Necrotic damage it took. On a successful save, it takes half as much damage only. This spell can’t reduce a target’s Hit Point maximum below 1.

## Effects
```yaml
- action: { targets: { count: 1 }, save: { ability: con, success: half }, damage: { dice: 14d6, type: necrotic },
            on-failure: { reduce-hp-max: damage-dealt, min: 1 } }
```
