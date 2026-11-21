# Poison Spray
**Type:** Spell
**Source:** SRD 5.2.1, p. 153
*Necromancy Cantrip (Druid, Sorcerer, Warlock, Wizard)*
**Casting Time:** Action
**Range:** 30 feet
**Components:** V, S
**Duration:** Instantaneous

You spray toxic mist at a creature within range. Make a ranged spell attack against the target. On a hit, the target takes 1d12 Poison damage.

***Cantrip Upgrade.*** The damage increases by 1d12 when you reach levels 5 (2d12), 11 (3d12), and 17 (4d12).

## Effects
```yaml
- action: { attack: { kind: ranged-spell }, damage: { dice: 1d12, type: poison } }
- scaling: { cantrip: [5, 11, 17], add: { damage: 1d12 } }
```
