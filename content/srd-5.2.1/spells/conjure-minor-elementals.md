# Conjure Minor Elementals
**Type:** Spell
**Source:** SRD 5.2.1, p. 118
*Level 4 Conjuration (Druid, Wizard)*
**Casting Time:** Action
**Range:** Self
**Components:** V, S
**Duration:** Concentration, up to 10 minutes

You conjure spirits from the Elemental Planes that flit around you in a 15-foot Emanation for the duration. Until the spell ends, any attack you make deals an extra 2d8 damage when you hit a creature in the Emanation. This damage is Acid, Cold, Fire, or Lightning (your choice when you make the attack).

In addition, the ground in the Emanation is Difficult Terrain for your enemies.

***Using a Higher-Level Spell Slot.*** The damage increases by 1d8 for each spell slot level above 4.

## Effects
```yaml
- self-effects: { effects: [ { trigger: { event: hit, auto: true, if: "The target is within 15 feet of you",
                               offer: { damage: { dice: 2d8, type: { choose-on-use: [acid, cold, fire, lightning] } } } } } ] }
- aura: { id: conjure-minor-elementals, area: { shape: emanation, size: 15 }, affects: [enemies], effects: [ { trait: [difficult-terrain] } ] }
- scaling: { per-slot-above: 4, add: { damage: 1d8 } }
```
