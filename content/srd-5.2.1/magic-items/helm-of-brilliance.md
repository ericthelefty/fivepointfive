# Helm of Brilliance
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 225
*Wondrous Item, Very Rare (Requires Attunement)*

This helm is set with 1d10 diamonds, 2d10 rubies, 3d10 fire opals, and 4d10 opals. Any gem pried from the helm crumbles to dust. When all the gems are removed or destroyed, the helm loses its magic.

You gain the following benefits while wearing the helm.

***Diamond Light.*** As long as it has at least one diamond, the helm emits a 30-foot Emanation. When at least one Undead is within that area, the Emanation is filled with Dim Light. Any Undead that starts its turn in that area takes 1d6 Radiant damage.

***Fire Opal Flames.*** As long as the helm has at least one fire opal, you can take a Magic action to cause one weapon you are holding to burst into flames. The flames emit Bright Light in a 10-foot radius and Dim Light for an additional 10 feet. The flames are harmless to you and the weapon. When you hit with an attack using the blazing weapon, the target takes an extra 1d6 Fire damage. The flames last until you take a Bonus Action to extinguish them or until you drop or stow the weapon.

***Ruby Resistance.*** As long as the helm has at least one ruby, you have Resistance to Fire damage.

***Spells.*** You can cast one of the following spells (save DC 18), using one of the helm’s gems of the specified type as a component: *Daylight* (opal), *Fireball* (fire opal), *Prismatic Spray* (diamond), or *Wall of Fire* (ruby). The gem is destroyed when the spell is cast and disappears from the helm.

***Taking Fire Damage.*** Roll 1d20 if you are wearing the helm and take Fire damage as a result of failing a saving throw against a spell. On a roll of 1, the helm emits beams of light from its remaining gems and is then destroyed. Each creature within a 60-foot Emanation originating from you must succeed on a DC 17 Dexterity saving throw or be struck by a beam, taking Radiant damage equal to the number of gems in the helm.

## Effects
```yaml
- charges: { max: { diamond: 1d10, ruby: 2d10, fire-opal: 3d10, opal: 4d10 }, kinds: true }
- aura: { id: diamond-light, area: { shape: emanation, size: 30 }, affects: [enemies], when: { has: { charges: diamond } },
          effects: [ { trigger: { event: start-of-turn, auto: true, if: "The creature is Undead", offer: { damage: { dice: 1d6, type: radiant } } } } ] }
- toggle: { id: fire-opal-flames, activation: magic, when: { has: { charges: fire-opal } },
            effects: [ { trigger: { event: hit, auto: true, offer: { damage: { dice: 1d6, type: fire } } } }, { trait: { light: { bright: 10, dim: 10 } } } ] }
- defense: { resistance: [fire], when: { has: { charges: ruby } } }
- action: { cost: { charges: { kind: opal } }, cast: $srd/spells/daylight, overrides: { dc: 18 } }
- action: { cost: { charges: { kind: fire-opal } }, cast: $srd/spells/fireball, overrides: { dc: 18 } }
- action: { cost: { charges: { kind: diamond } }, cast: $srd/spells/prismatic-spray, overrides: { dc: 18 } }
- action: { cost: { charges: { kind: ruby } }, cast: $srd/spells/wall-of-fire, overrides: { dc: 18 } }
- trigger: { event: damaged, auto: true, scope: { against: { damage: fire } }, if: "From a failed save against a spell",
             offer: { roll: 1d20, if-roll: 1, text: "The helm explodes in beams and is destroyed." } }
```
