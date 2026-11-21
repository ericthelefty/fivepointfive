# Ring of Three Wishes
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 239
*Ring, Legendary*

While wearing this ring, you can expend 1 of its 3 charges to cast *Wish* from it. The ring becomes nonmagical when you use the last charge.

## Effects
```yaml
- charges: { max: 3, destroy-on: { when: last-charge } }
- action: { cost: { charges: 1 }, cast: $srd/spells/wish }
```
