# Dagger of Venom
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 216
*Weapon (Dagger), Rare*

You gain a +1 bonus to attack rolls and damage rolls made with this magic weapon.

You can take a Bonus Action to magically coat the blade with poison. The poison remains for 1 minute or until an attack using this weapon hits a creature. That creature must succeed on a DC 15 Constitution saving throw or take 2d10 Poison damage and have the Poisoned condition for 1 minute. The weapon can’t be used this way again until the next dawn.

## Effects
```yaml
- bonus: { to: [attack, damage], value: 1, scope: { weapon: { id: self } } }
- resource: { id: venom, max: 1, reset: dawn }
- toggle: { activation: bonus, cost: { resource: $#venom }, duration: { amount: 1, unit: minute }, ends-when: [{ text: "An attack with it hits" }],
            effects: [ { trigger: { event: hit, scope: { weapon: { id: self } }, auto: true,
                                    offer: { save: { ability: con, dc: 15 }, on-failure: { damage: { dice: 2d10, type: poison }, apply: { condition: poisoned, duration: { amount: 1, unit: minute } } } } } } ] }
```
