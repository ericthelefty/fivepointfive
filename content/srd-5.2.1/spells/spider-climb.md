# Spider Climb
**Type:** Spell
**Source:** SRD 5.2.1, p. 164
*Level 2 Transmutation (Sorcerer, Warlock, Wizard)*
**Casting Time:** Action
**Range:** Touch
**Components:** V, S, M (a drop of bitumen and a spider)
**Duration:** Concentration, up to 1 hour

Until the spell ends, one willing creature you touch gains the ability to move up, down, and across vertical surfaces and along ceilings, while leaving its hands free. The target also gains a Climb Speed equal to its Speed.

***Using a Higher-Level Spell Slot.*** You can target one additional creature for each spell slot level above 2.

## Effects
```yaml
- action: { range: touch, targets: { count: 1, creature: willing } }
- target-effects: { effects: [ { speed: { climb: speed:walk } }, { trait: [spider-climb] } ] }
- scaling: { per-slot-above: 2, add: { targets: 1 } }
```
