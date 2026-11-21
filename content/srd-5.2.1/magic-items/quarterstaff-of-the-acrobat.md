# Quarterstaff of the Acrobat
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 237
*Weapon (Quarterstaff), Very Rare (Requires Attunement)*

You have a +2 bonus to attack rolls and damage rolls made with this magic weapon.

While holding this weapon, you can cause it to emit green Dim Light out to 10 feet, either as a Bonus Action or after you roll Initiative, or you can extinguish the light as a Bonus Action.

While holding this weapon, you can take a Bonus Action to alter its form, turning it into a 6-inch rod (for ease of storage) or a 10-foot pole, or reverting it a Quarterstaff; the weapon will elongate only as far as the surrounding space allows.

In certain forms, the weapon has the following additional properties.

***Acrobatic Assist (Quarterstaff and 10-Foot Pole Forms Only).*** While holding this weapon, you have Advantage on Dexterity (Acrobatics) checks.

***Attack Deflection (Quarterstaff Form Only).*** When you are hit by an attack while holding the weapon, you can take a Reaction to twirl the weapon around you, gaining a +5 bonus to your Armor Class against the triggering attack, potentially causing the attack to miss you. You can’t use this property again until you finish a Short or Long Rest.

***Ranged Weapon (Quarterstaff Form Only).*** This weapon has the Thrown property with a normal range of 30 feet and a long range of 120 feet. Immediately after you make a ranged attack with the weapon, it flies back to your hand.

## Effects
```yaml
- bonus: { to: [attack, damage], value: 2, scope: { weapon: { id: self } } }
- action: { activation: bonus, choose-one: [ { id: light, label: Light, effects: [ { trait: { light: { dim: 10 } } } ] },
                                            { id: rod, label: 6-inch rod }, { id: pole, label: 10-foot pole }, { id: staff, label: Quarterstaff } ] }
- advantage: { roll: skill:acrobatics, when: { player: "Quarterstaff or 10-foot pole form" } }
- resource: { id: attack-deflection, max: 1, reset: short }
- trigger: { event: hit-by, reaction: true, when: { player: "Quarterstaff form" }, offer: { cost: { resource: $#attack-deflection }, bonus: { to: ac, value: 5, text: "Against that attack" } } }
- weapon-property: { add: [{ thrown: { range: 30/120 } }], when: { player: "Quarterstaff form" } }
```
