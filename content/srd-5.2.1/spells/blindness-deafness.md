# Blindness/Deafness
**Type:** Spell
**Source:** SRD 5.2.1, p. 113
*Level 2 Transmutation (Bard, Cleric, Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** 120 feet
**Components:** V
**Duration:** 1 minute

One creature that you can see within range must succeed on a Constitution saving throw, or it has the Blinded or Deafened condition (your choice) for the duration. At the end of each of its turns, the target repeats the save, ending the spell on itself on a success.

***Using a Higher-Level Spell Slot.*** You can target one additional creature for each spell slot level above 2.

## Effects
```yaml
- action: { targets: { count: 1 }, save: { ability: con }, apply: { condition: { choose: [blinded, deafened] }, duration: spell, save-ends: end-of-turn } }
- scaling: { per-slot-above: 2, add: { targets: 1 } }
```
