# Nine Lives Stealer
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 233
*Weapon (Any Simple or Martial), Very Rare (Requires Attunement)*

You gain a +2 bonus to attack rolls and damage rolls made with this magic weapon.

***Life Stealing.*** The weapon has 1d8 + 1 charges. When you attack a creature that has fewer than 100 Hit Points with this weapon and roll a 20 on the d20 for the attack roll, the creature must succeed on a DC 15 Constitution saving throw or be slain instantly as the sword tears its life force from its body. Constructs and Undead succeed on the save automatically. The weapon loses 1 charge if the creature is slain. When the weapon has no charges remaining, it loses this property.

## Effects
```yaml
- bonus: { to: [attack, damage], value: 2, scope: { weapon: { id: self } } }
- charges: { max: 1d8 + 1, start: 1d8 + 1 }
- trigger: { event: { roll: attack }, if-roll: 20, scope: { weapon: { id: self } }, if: "The target has fewer than 100 HP",
             offer: { save: { ability: con, dc: 15, auto-succeed: { creature: [construct, undead] } }, on-failure: { text: "Slain instantly." }, cost: { charges: 1 } } }
```
