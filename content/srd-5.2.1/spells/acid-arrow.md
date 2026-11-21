# Acid Arrow
**Type:** Spell
**Source:** SRD 5.2.1, p. 107
*Level 2 Evocation (Wizard)*
**Casting Time:** Action
**Range:** 90 feet
**Components:** V, S, M (powdered rhubarb leaf)
**Duration:** Instantaneous

A shimmering green arrow streaks toward a target within range and bursts in a spray of acid. Make a ranged spell attack against the target. On a hit, the target takes 4d4 Acid damage and 2d4 Acid damage at the end of its next turn. On a miss, the arrow splashes the target with acid for half as much of the initial damage only.

***Using a Higher-Level Spell Slot.*** The damage (both initial and later) increases by 1d4 for each spell slot level above 2.

## Effects
```yaml
- action: { attack: { kind: ranged-spell }, damage: { dice: 4d4, type: acid }, on-miss: { damage: { dice: 4d4, type: acid, half: true } },
            then: { at: end-of-target-next-turn, if: hit, damage: { dice: 2d4, type: acid } } }
- scaling: { per-slot-above: 2, add: { damage: 1d4, then.damage: 1d4 } }
```
