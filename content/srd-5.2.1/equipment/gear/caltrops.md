# Caltrops
**Type:** Gear
**Cost:** 1 GP
**Source:** SRD 5.2.1, p. 96

As a Utilize action, you can spread Caltrops from their bag to cover a 5-foot-square area within 5 feet of yourself. A creature that enters this area for the first time on a turn must succeed on a DC 15 Dexterity saving throw or take 1 Piercing damage and have its Speed reduced to 0 until the start of its next turn. It takes 10 minutes to recover the Caltrops.

## Effects
```yaml
- action: { activation: utilize, consume: true, zone: { area: { shape: square, size: 5 }, event: [enter-area], per: turn, save: { ability: dex, dc: 15 },
            on-failure: { damage: { dice: 1, type: piercing }, apply: { text: "Speed 0", duration: { until: start-of-target-next-turn } } } } }
```
