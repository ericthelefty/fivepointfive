# Ball Bearings
**Type:** Gear
**Cost:** 1 GP
**Source:** SRD 5.2.1, p. 96

As a Utilize action, you can spill Ball Bearings from their pouch. They spread to cover a level, 10-foot-square area within 10 feet of yourself. A creature that enters this area for the first time on a turn must succeed on a DC 10 Dexterity saving throw or have the Prone condition. It takes 10 minutes to recover the Ball Bearings.

## Effects
```yaml
- action: { activation: utilize, consume: true, zone: { area: { shape: square, size: 10 }, event: [enter-area], per: turn, save: { ability: dex, dc: 10 }, apply: { condition: prone } } }
```
