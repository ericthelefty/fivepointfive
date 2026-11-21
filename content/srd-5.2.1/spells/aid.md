# Aid
**Type:** Spell
**Source:** SRD 5.2.1, p. 107
*Level 2 Abjuration (Bard, Cleric, Druid, Paladin, Ranger)*
**Casting Time:** Action
**Range:** 30 feet
**Components:** V, S, M (a strip of white cloth)
**Duration:** 8 hours

Choose up to three creatures within range. Each target’s Hit Point maximum and current Hit Points increase by 5 for the duration.

***Using a Higher-Level Spell Slot.*** Each target’s Hit Points increase by 5 for each spell slot level above 2.

## Effects
```yaml
- action: { range: 30, targets: { count: 3 } }
- target-effects:
    effects:
      - bonus: { to: hp:max, value: 5, also-current: true }
- scaling: { per-slot-above: 2, add: { target-effects.bonus.value: 5 } }
```
