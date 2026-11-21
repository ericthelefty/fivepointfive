# Faerie Fire
**Type:** Spell
**Source:** SRD 5.2.1, p. 129
*Level 1 Evocation (Bard, Druid)*
**Casting Time:** Action
**Range:** 60 feet
**Components:** V
**Duration:** Concentration, up to 1 minute

Objects in a 20-foot Cube within range are outlined in blue, green, or violet light (your choice). Each creature in the Cube is also outlined if it fails a Dexterity saving throw. For the duration, objects and affected creatures shed Dim Light in a 10-foot radius and can’t benefit from the Invisible condition.

Attack rolls against an affected creature or object have Advantage if the attacker can see it.

## Effects
```yaml
- action: { area: { shape: cube, size: 20 }, save: { ability: dex } }
- target-effects: { effects: [ { advantage: { roll: attacks-against-you, when: { player: "The attacker can see it" } } },
                               { trait: [cant-be-invisible] }, { trait: { light: { dim: 10 } } } ] }
```
