# Ice Knife
**Type:** Spell
**Source:** SRD 5.2.1, p. 141
*Level 1 Conjuration (Druid, Sorcerer, Wizard)*
**Casting Time:** Action
**Range:** 60 feet
**Components:** S, M (a drop of water or a piece of ice)
**Duration:** Instantaneous

You create a shard of ice and fling it at one creature within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 Piercing damage. Hit or miss, the shard then explodes. The target and each creature within 5 feet of it must succeed on a Dexterity saving throw or take 2d6 Cold damage.

***Using a Higher-Level Spell Slot.*** The Cold damage increases by 1d6 for each spell slot level above 1.

## Effects
```yaml
- action: { attack: { kind: ranged-spell }, damage: { dice: 1d10, type: piercing },
            then: { always: true, area: { shape: emanation, size: 5, from: target }, save: { ability: dex }, damage: { dice: 2d6, type: cold } } }
- scaling: { per-slot-above: 1, add: { then.damage: 1d6 } }
```
