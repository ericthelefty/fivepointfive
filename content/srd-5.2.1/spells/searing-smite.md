# Searing Smite
**Type:** Spell
**Source:** SRD 5.2.1, p. 160
*Level 1 Evocation (Paladin)*
**Casting Time:** Bonus Action, which you take immediately after hitting a target with a Melee weapon or an Unarmed Strike
**Range:** Self
**Component:** V
**Duration:** 1 minute

As you hit the target, it takes an extra 1d6 Fire damage from the attack. At the start of each of its turns until the spell ends, the target takes 1d6 Fire damage and then makes a Constitution saving throw. On a failed save, the spell continues. On a successful save, the spell ends.

***Using a Higher-Level Spell Slot.*** All the damage increases by 1d6 for each spell slot level above 1.

## Effects
```yaml
- trigger: { event: hit, scope: { any: [ { weapon: { kind: melee } }, { weapon: { unarmed: true } } ] }, offer: { cast: self } }
- action: { damage: { dice: 1d6, type: fire },
            then: { at: start-of-target-turn, damage: { dice: 1d6, type: fire }, save: { ability: con }, on-success: { end-effect: true } } }
- scaling: { per-slot-above: 1, add: { damage: 1d6, then.damage: 1d6 } }
```
