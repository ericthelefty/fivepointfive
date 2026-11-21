# Eyes of Charming
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 221
*Wondrous Item, Uncommon (Requires Attunement)*

These crystal lenses fit over the eyes. They have 3 charges. While wearing them, you can expend 1 or more charges to cast *Charm Person* (save DC 13). For 1 charge, you cast the level 1 version of the spell. You increase the spell’s level by one for each additional charge you expend. The lenses regain all expended charges daily at dawn.

## Effects
```yaml
- charges: { max: 3, recharge: { at: dawn, to: max } }
- action: { cost: { charges: { min: 1, max: 3 } }, cast: $srd/spells/charm-person, cast-at: cost.charges, overrides: { dc: 13 } }
```
