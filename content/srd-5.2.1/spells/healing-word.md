# Healing Word
**Type:** Spell
**Source:** SRD 5.2.1, p. 139
*Level 1 Abjuration (Bard, Cleric, Druid)*
**Casting Time:** Bonus Action
**Range:** 60 feet
**Components:** V
**Duration:** Instantaneous

A creature of your choice that you can see within range regains Hit Points equal to 2d4 plus your spellcasting ability modifier.

***Using a Higher-Level Spell Slot.*** The healing increases by 2d4 for each spell slot level above 1.

## Effects
```yaml
- action: { targets: { count: 1 }, heal: 2d4 + spell-ability }
- scaling: { per-slot-above: 1, add: { heal: 2d4 } }
```
