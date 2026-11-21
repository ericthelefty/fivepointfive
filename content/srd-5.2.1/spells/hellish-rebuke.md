# Hellish Rebuke
**Type:** Spell
**Source:** SRD 5.2.1, p. 140
*Level 1 Evocation (Warlock)*
**Casting Time:** Reaction, which you take in response to taking damage from a creature that you can see within 60 feet of yourself
**Range:** 60 feet
**Components:** V, S
**Duration:** Instantaneous

The creature that damaged you is momentarily surrounded by green flames. It makes a Dexterity saving throw, taking 2d10 Fire damage on a failed save or half as much damage on a successful one.

***Using a Higher-Level Spell Slot.*** The damage increases by 1d10 for each spell slot level above 1.

## Effects
```yaml
- trigger: { event: damaged, reaction: true, if: "The damage came from a creature you can see within 60 feet", offer: { cast: self } }
- action: { targets: { count: 1 }, save: { ability: dex, success: half }, damage: { dice: 2d10, type: fire } }
- scaling: { per-slot-above: 1, add: { damage: 1d10 } }
```
