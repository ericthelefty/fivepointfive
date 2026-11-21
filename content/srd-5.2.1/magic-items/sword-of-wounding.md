# Sword of Wounding
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 248
*Weapon (Glaive, Greatsword, Longsword, Rapier, Scimitar, or Shortsword), Rare (Requires Attunement)*

When you hit a creature with an attack using this magic weapon, the target takes an extra 2d6 Necrotic damage and must succeed on a DC 15 Constitution saving throw or be unable to regain Hit Points for 1 hour. The target repeats the save at the end of each of its turns, ending the effect on itself on a success.

## Effects
```yaml
- trigger: { event: hit, scope: { weapon: { id: self } }, auto: true,
             offer: { damage: { dice: 2d6, type: necrotic }, save: { ability: con, dc: 15 },
                      on-failure: { apply: { text: "Can't regain Hit Points", duration: { amount: 1, unit: hour }, save-ends: end-of-turn } } } }
```
