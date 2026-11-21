# Cure Wounds
**Type:** Spell
**Source:** SRD 5.2.1, p. 121
*Level 1 Abjuration (Bard, Cleric, Druid, Paladin, Ranger)*
**Casting Time:** Action
**Range:** Touch
**Components:** V, S
**Duration:** Instantaneous

A creature you touch regains a number of Hit Points equal to 2d8 plus your spellcasting ability modifier.

***Using a Higher-Level Spell Slot.*** The healing increases by 2d8 for each spell slot level above 1.

## Effects
```yaml
- action: { range: touch, heal: 2d8 + spell-ability }
- scaling: { per-slot-above: 1, add: { heal: 2d8 } }
```
