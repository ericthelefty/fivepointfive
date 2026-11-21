# Mass Healing Word
**Type:** Spell
**Source:** SRD 5.2.1, p. 148
*Level 3 Abjuration (Bard, Cleric)*
**Casting Time:** Bonus Action
**Range:** 60 feet
**Components:** V
**Duration:** Instantaneous

Up to six creatures of your choice that you can see within range regain Hit Points equal to 2d4 plus your spellcasting ability modifier.

***Using a Higher-Level Spell Slot.*** The healing increases by 1d4 for each spell slot level above 3.

## Effects
```yaml
- action: { targets: { count: 6, choose: true }, heal: 2d4 + spell-ability }
- scaling: { per-slot-above: 3, add: { heal: 1d4 } }
```
