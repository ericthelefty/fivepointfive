# Holy Avenger
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 226
*Weapon (Any Simple or Martial), Legendary (Requires Attunement by a Paladin)*

You gain a +3 bonus to attack rolls and damage rolls made with this magic weapon. When you hit a Fiend or an Undead with it, that creature takes an extra 2d10 Radiant damage.

While you hold the drawn weapon, it creates a 10-foot Emanation originating from you. You and all creatures Friendly to you in the Emanation have Advantage on saving throws against spells and other magical effects. If you have 17 or more levels in the Paladin class, the size of the Emanation increases to 30 feet.

## Effects
```yaml
- bonus: { to: [attack, damage], value: 3, scope: { weapon: { id: self } } }
- trigger: { event: hit, scope: { weapon: { id: self }, against: { creature: [fiend, undead] } }, auto: true,
             offer: { damage: { dice: 2d10, type: radiant } } }
- aura:
    id: holy-avenger
    area: { shape: emanation, size: { steps: { 1: 10, 17: 30 }, by: level:paladin } }
    affects: [self, allies]
    when: { wielding: self }
    effects:
      - advantage: { roll: save:all, scope: { source: magic } }
```
