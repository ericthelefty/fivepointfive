# Circlet of Blasting
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 215
*Wondrous Item, Uncommon*

While wearing this circlet, you can cast *Scorching Ray* with it (+5 to hit). The circlet can’t cast this spell again until the next dawn.

## Effects
```yaml
- resource: { id: circlet, max: 1, reset: dawn }
- action: { cost: { resource: $#circlet }, cast: $srd/spells/scorching-ray, overrides: { attack: 5 } }
```
