# Sword of Sharpness
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 248
*Weapon (Glaive, Greatsword, Longsword, or Scimitar), Very Rare (Requires Attunement)*

When you attack an object with this magic weapon and hit, maximize your weapon damage dice against the target.

When you attack a creature with this weapon and roll a 20 on the d20 for the attack roll, that target takes an extra 14 Slashing damage and gains 1 Exhaustion level.

## Effects
```yaml
- maximize: { scope: { weapon: { id: self }, against: { target: object } } }
- trigger: { event: { roll: attack }, if-roll: 20, scope: { weapon: { id: self } }, auto: true, offer: { damage: { dice: 14, type: slashing }, exhaustion: 1 } }
```
