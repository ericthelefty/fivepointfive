# Lightning Bolt
**Type:** Spell
**Source:** SRD 5.2.1, p. 144
*Level 3 Evocation (Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** Self
**Components:** V, S, M (a bit of fur and a crystal rod)
**Duration:** Instantaneous

A stroke of lightning forming a 100-foot-long, 5-foot-wide Line blasts out from you in a direction you choose. Each creature in the Line makes a Dexterity saving throw, taking 8d6 Lightning damage on a failed save or half as much damage on a successful one.

***Using a Higher-Level Spell Slot.*** The damage increases by 1d6 for each spell slot level above 3.

## Effects
```yaml
- action: { area: { shape: line, size: 100, width: 5 }, save: { ability: dex, success: half }, damage: { dice: 8d6, type: lightning } }
- scaling: { per-slot-above: 3, add: { damage: 1d6 } }
```
