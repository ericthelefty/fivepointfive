# Helm of Telepathy
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 226
*Wondrous Item, Uncommon (Requires Attunement)*

While wearing this helm, you have telepathy with a range of 30 feet, and you can cast *Detect Thoughts* or *Suggestion* (save DC 13) from the helm. Once either spell is cast from the helm, that spell can’t be cast from it again until the next dawn.

## Effects
```yaml
- sense: { telepathy: 30 }
- grant-spell: { spell: [$srd/spells/detect-thoughts, $srd/spells/suggestion], free: { per: dawn, count: 1, each: true }, overrides: { dc: 13 } }
```
