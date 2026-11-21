# Bowl of Commanding Water Elementals
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 214
*Wondrous Item, Rare*

While this bowl is filled with water and you are within 5 feet of it, you can take a Magic action to summon a **Water Elemental**. The elemental appears in an unoccupied space as close to the bowl as possible, understands your languages, obeys your commands, and takes its turn immediately after you on your Initiative count. The elemental disappears after 1 hour, when it dies, or when you dismiss it as a Bonus Action. The bowl can’t be used this way again until the next dawn.

The bowl is about 1 foot in diameter and half as deep. It holds about 3 gallons.

## Effects
```yaml
- resource: { id: bowl, max: 1, reset: dawn }
- action: { activation: magic, cost: { resource: $#bowl }, summon: { creature: $srd/monsters/water-elemental, duration: { amount: 1, unit: hour }, initiative: after-you },
            requires: { text: "Filled with water; you within 5 feet" } }
```
