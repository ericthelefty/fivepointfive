# Scorching Ray
**Type:** Spell
**Source:** SRD 5.2.1, p. 159
*Level 2 Evocation (Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** 120 feet
**Components:** V, S
**Duration:** Instantaneous

You hurl three fiery rays. You can hurl them at one target within range or at several. Make a ranged spell attack for each ray. On a hit, the target takes 2d6 Fire damage.

***Using a Higher-Level Spell Slot.*** You create one additional ray for each spell slot level above 2.

## Effects
```yaml
- action: { attack: { kind: ranged-spell, count: 3 }, damage: { dice: 2d6, type: fire } }
- scaling: { per-slot-above: 2, add: { attack.count: 1 } }
```
