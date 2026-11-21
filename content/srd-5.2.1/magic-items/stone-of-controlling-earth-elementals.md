# Stone of Controlling Earth Elementals
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 248
*Wondrous Item, Rare*

While touching this 5-pound stone to the ground, you can take a Magic action to summon an **Earth Elemental**. The elemental appears in an unoccupied space you choose within 30 feet of yourself, obeys your commands, and takes its turn immediately after you on your Initiative count. The elemental disappears after 1 hour, when it dies, or when you dismiss it as a Bonus Action. The stone can’t be used this way again until the next dawn.

## Effects
```yaml
- resource: { id: stone, max: 1, reset: dawn }
- action: { activation: magic, cost: { resource: $#stone }, summon: { creature: $srd/monsters/earth-elemental, duration: { amount: 1, unit: hour }, initiative: after-you } }
```
