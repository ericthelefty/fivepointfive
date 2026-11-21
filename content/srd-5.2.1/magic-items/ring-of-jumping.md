# Ring of Jumping
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 238
*Ring, Uncommon (Requires Attunement)*

While wearing this ring, you can cast *Jump* from it, but can target only yourself when you do so.

## Effects
```yaml
- grant-spell: { spell: $srd/spells/jump, at-will: true, target: self }
```
