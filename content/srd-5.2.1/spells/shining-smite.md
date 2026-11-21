# Shining Smite
**Type:** Spell
**Source:** SRD 5.2.1, p. 162
*Level 2 Transmutation (Paladin)*
**Casting Time:** Bonus Action, which you take immediately after hitting a creature with a Melee weapon or an Unarmed Strike
**Range:** Self
**Component:** V
**Duration:** Concentration, up to 1 minute

The target hit by the strike takes an extra 2d6 Radiant damage from the attack. Until the spell ends, the target sheds Bright Light in a 5-foot radius, attack rolls against it have Advantage, and it can’t benefit from the Invisible condition.

***Using a Higher-Level Spell Slot.*** The damage increases by 1d6 for each spell slot level above 2.

## Effects
```yaml
- trigger: { event: hit, scope: { any: [ { weapon: { kind: melee } }, { weapon: { unarmed: true } } ] }, offer: { cast: self } }
- action: { damage: { dice: 2d6, type: radiant } }
- target-effects: { effects: [ { advantage: { roll: attacks-against-you } }, { trait: [cant-be-invisible] }, { trait: { light: { bright: 5 } } } ] }
- scaling: { per-slot-above: 2, add: { damage: 1d6 } }
```
