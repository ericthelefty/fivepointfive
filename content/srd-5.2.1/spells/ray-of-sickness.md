# Ray of Sickness
**Type:** Spell
**Source:** SRD 5.2.1, p. 158
*Level 1 Necromancy (Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** 60 feet
**Components:** V, S
**Duration:** Instantaneous

You shoot a greenish ray at a creature within range. Make a ranged spell attack against the target. On a hit, the target takes 2d8 Poison damage and has the Poisoned condition until the end of your next turn.

***Using a Higher-Level Spell Slot.*** The damage increases by 1d8 for each spell slot level above 1.

## Effects
```yaml
- action: { attack: { kind: ranged-spell }, damage: { dice: 2d8, type: poison }, on-hit: { apply: { condition: poisoned, duration: { until: end-of-next-turn } } } }
- scaling: { per-slot-above: 1, add: { damage: 1d8 } }
```
