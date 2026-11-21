# Dragon’s Breath
**Type:** Spell
**Source:** SRD 5.2.1, p. 126
*Level 2 Transmutation (Sorcerer, Wizard)*
**Casting Time:** Bonus Action
**Range:** Touch
**Components:** V, S, M (a hot pepper)
**Duration:** Concentration, up to 1 minute

You touch one willing creature, and choose Acid, Cold, Fire, Lightning, or Poison. Until the spell ends, the target can take a Magic action to exhale a 15-foot Cone. Each creature in that area makes a Dexterity saving throw, taking 3d6 damage of the chosen type on a failed save or half as much damage on a successful one.

***Using a Higher-Level Spell Slot.*** The damage increases by 1d6 for each spell slot level above 2.

## Effects
```yaml
- action: { range: touch, targets: { count: 1, creature: willing }, choose: { id: breath-type, kind: damage-type, from: [acid, cold, fire, lightning, poison] } }
- target-effects: { effects: [ { action: { activation: magic, area: { shape: cone, size: 15 }, save: { ability: dex, dc: spell:dc, success: half },
                                           damage: { dice: 3d6, type: choice:breath-type } } } ] }
- scaling: { per-slot-above: 2, add: { target-effects.action.damage: 1d6 } }
```
