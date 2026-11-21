# Chill Touch
**Type:** Spell
**Source:** SRD 5.2.1, p. 115
*Necromancy Cantrip (Sorcerer, Warlock, Wizard)*
**Casting Time:** Action
**Range:** Touch
**Components:** V, S
**Duration:** Instantaneous Channeling the chill of the grave, make a melee spell attack against a target within reach. On a hit, the target takes 1d10 Necrotic damage, and it can’t regain Hit Points until the end of your next turn.

***Cantrip Upgrade.*** The damage increases by 1d10 when you reach levels 5 (2d10), 11 (3d10), and 17 (4d10).

## Effects
```yaml
- action: { attack: { kind: melee-spell }, damage: { dice: 1d10, type: necrotic },
            apply: { text: "Can't regain Hit Points", duration: { until: end-of-next-turn } } }
- scaling: { cantrip: [5, 11, 17], add: { damage: 1d10 } }
```
