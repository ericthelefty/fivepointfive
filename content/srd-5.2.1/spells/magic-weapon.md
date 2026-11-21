# Magic Weapon
**Type:** Spell
**Source:** SRD 5.2.1, p. 146
*Level 2 Transmutation (Paladin, Ranger, Sorcerer, Wizard)*
**Casting Time:** Bonus Action
**Range:** Touch
**Components:** V, S
**Duration:** 1 hour

You touch a nonmagical weapon. Until the spell ends, that weapon becomes a magic weapon with a +1 bonus to attack rolls and damage rolls. The spell ends early if you cast it again.

***Using a Higher-Level Spell Slot.*** The bonus increases to +2 with a level 3–5 spell slot. The bonus increases to +3 with a level 6+ spell slot.

## Effects
```yaml
- action: { range: touch, targets: { text: "A nonmagical weapon" } }
- target-effects: { effects: [ { bonus: { to: [attack, damage], value: 1, scope: { weapon: { id: target } } } } ] }
- scaling: { slots: { "3-5": { target-effects.bonus.value: 2 }, "6+": { target-effects.bonus.value: 3 } } }
```
