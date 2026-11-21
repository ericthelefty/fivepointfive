# Gloves of Missile Snaring
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 224
*Wondrous Item, Uncommon (Requires Attunement)*

If you’re hit by an attack roll made with a Ranged or Thrown weapon while wearing these gloves, you can take a Reaction to reduce the damage by 1d10 plus your Dexterity modifier if you have a free hand. If you reduce the damage to 0, you can catch the ammunition or weapon if it is small enough for you to hold in that hand.

## Effects
```yaml
- trigger: { event: hit-by, reaction: true, scope: { against: { attack: ranged } }, if: "You have a free hand",
             offer: { damage-taken: { reduce: 1d10 + mod:dex }, then: { if: "Reduced to 0", text: "Catch the missile." } } }
```
