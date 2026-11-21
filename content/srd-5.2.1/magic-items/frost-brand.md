# Frost Brand
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 223
*Weapon (Glaive, Greatsword, Longsword, Rapier, Scimitar, or Shortsword), Very Rare (Requires Attunement)*

When you hit with an attack roll using this magic weapon, the target takes an extra 1d6 Cold damage. In addition, while you hold the weapon, you have Resistance to Fire damage.

In freezing temperatures, the weapon sheds Bright Light in a 10-foot radius and Dim Light for an additional 10 feet.

When you draw this weapon, you can extinguish all nonmagical flames within 30 feet of yourself. Once used, this property can’t be used again for 1 hour.

## Effects
```yaml
- trigger: { event: hit, scope: { weapon: { id: self } }, auto: true, offer: { damage: { dice: 1d6, type: cold } } }
- defense: { resistance: [fire], when: { wielding: self } }
- resource: { id: extinguish, max: 1, reset: { amount: 1, unit: hour } }
- action: { activation: none, cost: { resource: $#extinguish }, when: { player: "When you draw it" }, text: "Extinguish nonmagical flames within 30 feet." }
```
