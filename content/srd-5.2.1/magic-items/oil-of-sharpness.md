# Oil of Sharpness
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 233
*Potion, Very Rare*

One vial of this oil can coat one Melee weapon or twenty pieces of ammunition, but only ammunition and Melee weapons that are nonmagical and deal Slashing or Piercing damage are affected. Applying the oil takes 1 minute, after which the oil magically seeps into whatever it coats, turning the coated weapon into a *+3 Weapon* or the coated ammunition into *+3 Ammunition.*

This clear, gelatinous oil sparkles with tiny, ultrathin silver shards.

## Effects
```yaml
- action: { activation: { amount: 1, unit: minute }, consume: true, targets: { text: "A nonmagical Slashing or Piercing melee weapon, or 20 ammunition" },
            text: "It becomes a +3 Weapon or +3 Ammunition.", becomes: $srd/magic-items/weapon-1-2-or-3, variant: { plus: 3 } }
```
