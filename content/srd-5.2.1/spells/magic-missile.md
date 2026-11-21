# Magic Missile
**Type:** Spell
**Source:** SRD 5.2.1, p. 146
*Level 1 Evocation (Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** 120 feet
**Components:** V, S
**Duration:** Instantaneous

You create three glowing darts of magical force. Each dart strikes a creature of your choice that you can see within range. A dart deals 1d4 + 1 Force damage to its target. The darts all strike simultaneously, and you can direct them to hit one creature or several.

***Using a Higher-Level Spell Slot.*** The spell creates one more dart for each spell slot level above 1.

## Effects
```yaml
- action: { targets: { count: 3, choose: true, repeat: true }, damage: { dice: 1d4 + 1, type: force, per-target: true } }
- scaling: { per-slot-above: 1, add: { targets: 1 } }
```
