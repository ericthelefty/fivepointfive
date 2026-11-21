# Spellguard Shield
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 244
*Armor (Shield), Very Rare (Requires Attunement)*

While holding this Shield, you have Advantage on saving throws against spells and other magical effects, and spell attack rolls have Disadvantage against you.

## Effects
```yaml
- advantage: { roll: save:all, scope: { source: magic } }
- disadvantage: { roll: attacks-against-you, scope: { attack: spell } }
```
