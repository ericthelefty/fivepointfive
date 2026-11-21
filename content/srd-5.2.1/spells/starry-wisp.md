# Starry Wisp
**Type:** Spell
**Source:** SRD 5.2.1, p. 165
*Evocation Cantrip (Bard, Druid)*
**Casting Time:** Action
**Range:** 60 feet
**Components:** V, S
**Duration:** Instantaneous

You launch a mote of light at one creature or object within range. Make a ranged spell attack against the target. On a hit, the target takes 1d8 Radiant damage, and until the end of your next turn, it emits Dim Light in a 10-foot radius and can’t benefit from the Invisible condition.

***Cantrip Upgrade.*** The damage increases by 1d8 when you reach levels 5 (2d8), 11 (3d8), and 17 (4d8).

## Effects
```yaml
- action: { attack: { kind: ranged-spell }, damage: { dice: 1d8, type: radiant },
            on-hit: { apply: { duration: { until: end-of-next-turn }, effects: [ { trait: [cant-be-invisible] }, { trait: { light: { dim: 10 } } } ] } } }
- scaling: { cantrip: [5, 11, 17], add: { damage: 1d8 } }
```
