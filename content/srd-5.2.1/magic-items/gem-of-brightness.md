# Gem of Brightness
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 223
*Wondrous Item, Uncommon*

This prism has 50 charges. While you are holding it, you can take a Magic action and use one of three command words to cause one of the following effects:

**First Command Word.** The gem sheds Bright Light in a 30-foot radius and Dim Light for an additional 30 feet. This effect doesn’t expend a charge. It lasts until you take a Bonus Action to repeat the command word or until you use another function of the gem.

**Second Command Word.** You expend 1 charge and cause the gem to fire a brilliant beam of light at one creature you can see within 60 feet of yourself. The creature must succeed on a DC 15 Constitution saving throw or have the Blinded condition for 1 minute. The creature repeats the save at the end of each of its turns, ending the effect on itself on a success.

**Third Command Word.** You expend 5 charges and cause the gem to flare with intense light in a 30-foot Cone. Each creature in the Cone makes a saving throw as if struck by the beam created with the second command word. When all of the gem’s charges are expended, the gem becomes a nonmagical jewel worth 50 GP.

## Effects
```yaml
- charges: { max: 50, destroy-on: { when: last-charge } }
- action:
    activation: magic
    choose-one:
      - { id: light, label: Light, effects: [ { trait: { light: { bright: 30, dim: 30 } } } ] }
      - { id: beam, label: Beam, cost: { charges: 1 }, range: 60, targets: { count: 1 }, save: { ability: con, dc: 15 },
          on-failure: { apply: { condition: blinded, duration: { amount: 1, unit: minute }, save-ends: end-of-turn } } }
      - { id: flare, label: Flare, cost: { charges: 5 }, area: { shape: cone, size: 30 }, save: { ability: con, dc: 15 },
          on-failure: { apply: { condition: blinded, duration: { amount: 1, unit: minute }, save-ends: end-of-turn } } }
```
