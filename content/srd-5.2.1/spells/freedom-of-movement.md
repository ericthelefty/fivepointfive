# Freedom of Movement
**Type:** Spell
**Source:** SRD 5.2.1, p. 134
*Level 4 Abjuration (Bard, Cleric, Druid, Ranger)*
**Casting Time:** Action
**Range:** Touch
**Components:** V, S, M (a leather strap)
**Duration:** 1 hour

You touch a willing creature. For the duration, the target’s movement is unaffected by Difficult Terrain, and spells and other magical effects can neither reduce the target’s Speed nor cause the target to have the Paralyzed or Restrained conditions. The target also has a Swim Speed equal to its Speed.

In addition, the target can spend 5 feet of movement to automatically escape from nonmagical restraints, such as manacles or a creature imposing the Grappled condition on it.

***Using a Higher-Level Spell Slot.*** You can target one additional creature for each spell slot level above 4.

## Effects
```yaml
- action: { range: touch, targets: { count: 1, creature: willing } }
- target-effects: { effects: [ { trait: [ignore-difficult-terrain, magic-cant-reduce-speed] },
                               { defense: { condition-immunity: [paralyzed, restrained], scope: { source: magic } } },
                               { speed: { swim: speed:walk } },
                               { action: { activation: { amount: 5, unit: feet-of-movement }, text: "Escape nonmagical restraints or a grapple." } } ] }
- scaling: { per-slot-above: 4, add: { targets: 1 } }
```
