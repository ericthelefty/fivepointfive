# Guiding Bolt
**Type:** Spell
**Source:** SRD 5.2.1, p. 138
*Level 1 Evocation (Cleric)*
**Casting Time:** Action
**Range:** 120 feet
**Components:** V, S
**Duration:** 1 round

You hurl a bolt of light toward a creature within range. Make a ranged spell attack against the target. On a hit, it takes 4d6 Radiant damage, and the next attack roll made against it before the end of your next turn has Advantage.

***Using a Higher-Level Spell Slot.*** The damage increases by 1d6 for each spell slot level above 1.

## Effects
```yaml
- action: { attack: { kind: ranged-spell }, damage: { dice: 4d6, type: radiant },
            on-hit: { apply: { text: "The next attack roll against it has Advantage", duration: { until: end-of-next-turn } } } }
- scaling: { per-slot-above: 1, add: { damage: 1d6 } }
```
