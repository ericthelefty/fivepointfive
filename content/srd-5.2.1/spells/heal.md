# Heal
**Type:** Spell
**Source:** SRD 5.2.1, p. 139
*Level 6 Abjuration (Cleric, Druid)*
**Casting Time:** Action
**Range:** 60 feet
**Components:** V, S
**Duration:** Instantaneous

Choose a creature that you can see within range. Positive energy washes through the target, restoring 70 Hit Points. This spell also ends the Blinded, Deafened, and Poisoned conditions on the target.

***Using a Higher-Level Spell Slot.*** The healing increases by 10 for each spell slot level above 6.

## Effects
```yaml
- action: { targets: { count: 1 }, heal: 70, remove-condition: [blinded, deafened, poisoned] }
- scaling: { per-slot-above: 6, add: { heal: 10 } }
```
