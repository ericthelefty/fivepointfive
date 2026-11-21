# Brazier of Commanding Fire Elementals
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 214
*Wondrous Item, Rare*

While you are within 5 feet of this brazier, you can take a Magic action to summon a **Fire Elemental.** The elemental appears in an unoccupied space as close to the brazier as possible, understands your languages, obeys your commands, and takes its turn immediately after you on your Initiative count. The elemental disappears after 1 hour, when it dies, or when you dismiss it as a Bonus Action. The brazier can’t be used this way again until the next dawn.

## Effects
```yaml
- resource: { id: brazier, max: 1, reset: dawn }
- action: { activation: magic, cost: { resource: $#brazier }, summon: { creature: $srd/monsters/fire-elemental, duration: { amount: 1, unit: hour }, initiative: after-you } }
```
