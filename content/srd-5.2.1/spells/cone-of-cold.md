# Cone of Cold
**Type:** Spell
**Source:** SRD 5.2.1, p. 117
*Level 5 Evocation (Druid, Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** Self
**Components:** V, S, M (a small crystal or glass cone)
**Duration:** Instantaneous

You unleash a blast of cold air. Each creature in a 60-foot Cone originating from you makes a Constitution saving throw, taking 8d8 Cold damage on a failed save or half as much damage on a successful one. A creature killed by this spell becomes a frozen statue until it thaws.

***Using a Higher-Level Spell Slot.*** The damage increases by 1d8 for each spell slot level above 5.

## Effects
```yaml
- action: { area: { shape: cone, size: 60 }, save: { ability: con, success: half }, damage: { dice: 8d8, type: cold } }
- scaling: { per-slot-above: 5, add: { damage: 1d8 } }
```
