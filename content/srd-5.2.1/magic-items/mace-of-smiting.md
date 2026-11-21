# Mace of Smiting
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 229
*Weapon (Mace), Rare*

You gain a +1 bonus to attack rolls and damage rolls made with this magic weapon. The bonus increases to +3 when you use the weapon to attack a Construct.

When you roll a 20 on an attack roll made with this weapon, the target takes an extra 7 Bludgeoning damage, or 14 Bludgeoning damage if it’s a Construct. If a Construct has 25 Hit Points or fewer after taking this damage, it is destroyed.

## Effects
```yaml
- bonus: { to: [attack, damage], value: 1, scope: { weapon: { id: self } } }
- bonus: { to: [attack, damage], value: 2, scope: { weapon: { id: self }, against: { creature: construct } } }
- trigger: { event: { roll: attack }, if-roll: 20, scope: { weapon: { id: self } }, auto: true,
             offer: { damage: [ { dice: 7, type: bludgeoning }, { dice: 7, type: bludgeoning, if: "The target is a Construct" } ],
                      then: { if: "A Construct with 25 HP or fewer", text: "Destroyed." } } }
```
