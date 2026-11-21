# Ensnaring Strike
**Type:** Spell
**Source:** SRD 5.2.1, p. 128
*Level 1 Conjuration (Ranger)*
**Casting Time:** Bonus Action, which you take immediately after hitting a creature with a weapon
**Range:** Self
**Components:** V
**Duration:** Concentration, up to 1 minute

As you hit the target, grasping vines appear on it, and it makes a Strength saving throw. A Large or larger creature has Advantage on this save. On a failed save, the target has the Restrained condition until the spell ends. On a successful save, the vines shrivel away, and the spell ends.

While Restrained, the target takes 1d6 Piercing damage at the start of each of its turns. The target or a creature within reach of it can take an action to make a Strength (Athletics) check against your spell save DC. On a success, the spell ends.

***Using a Higher-Level Spell Slot.*** The damage increases by 1d6 for each spell slot level above 1.

## Effects
```yaml
- trigger: { event: hit, scope: { weapon: {} }, offer: { cast: self } }
- action: { save: { ability: str, advantage: { text: "The target is Large or larger" } },
            apply: { condition: restrained, duration: spell, escape: { check: skill:athletics, dc: spell:dc, others-can-help: true } },
            then: { at: start-of-target-turn, while: restrained, damage: { dice: 1d6, type: piercing } } }
- scaling: { per-slot-above: 1, add: { then.damage: 1d6 } }
```
