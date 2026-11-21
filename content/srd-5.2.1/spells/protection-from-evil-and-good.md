# Protection from Evil and Good
**Type:** Spell
**Source:** SRD 5.2.1, p. 157
*Level 1 Abjuration (Cleric, Druid, Paladin, Warlock, Wizard)*
**Casting Time:** Action
**Range:** Touch
**Components:** V, S, M (a flask of Holy Water worth 25+ GP, which the spell consumes)
**Duration:** Concentration up to 10 minutes

Until the spell ends, one willing creature you touch is protected against creatures that are Aberrations, Celestials, Elementals, Fey, Fiends, or Undead. The protection grants several benefits. Creatures of those types have Disadvantage on attack rolls against the target. The target also can’t be possessed by or gain the Charmed or Frightened conditions from them. If the target is already possessed, Charmed, or Frightened by such a creature, the target has Advantage on any new saving throw against the relevant effect.

## Effects
```yaml
- action: { range: touch, targets: { count: 1, creature: willing } }
- target-effects: { effects: [
    { disadvantage: { roll: attacks-against-you, scope: { against: { creature: [aberration, celestial, elemental, fey, fiend, undead] } } } },
    { defense: { condition-immunity: [charmed, frightened], scope: { against: { creature: [aberration, celestial, elemental, fey, fiend, undead] } } } },
    { trait: { text: "Can't be possessed by those creatures; Advantage on new saves against their existing charm, fear or possession." } } ] }
```
