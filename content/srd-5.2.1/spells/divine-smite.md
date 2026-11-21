# Divine Smite
**Type:** Spell
**Source:** SRD 5.2.1, p. 125
*Level 1 Evocation (Paladin)*
**Casting Time:** Bonus Action, which you take immediately after hitting a target with a Melee weapon or an Unarmed Strike
**Range:** Self
**Component:** V
**Duration:** Instantaneous

The target takes an extra 2d8 Radiant damage from the attack. The damage increases by 1d8 if the target is a Fiend or an Undead.

***Using a Higher-Level Spell Slot.*** The damage increases by 1d8 for each spell slot level above 1.

## Effects
```yaml
- trigger: { event: hit, scope: { any: [ { weapon: { kind: melee } }, { weapon: { unarmed: true } } ] }, offer: { cast: self } }
- action: { damage: [ { dice: 2d8, type: radiant }, { dice: 1d8, type: radiant, if: "The target is a Fiend or Undead" } ] }
- scaling: { per-slot-above: 1, add: { damage: 1d8 } }
```
