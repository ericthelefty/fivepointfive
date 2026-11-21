# Staff of Charming
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 245
*Staff, Rare (Requires Attunement by a Bard, Cleric, Druid, Sorcerer, Warlock, or Wizard)*

This staff has 10 charges. While holding the staff, you can use any of its properties:

**Cast Spell.** You can expend 1 of the staff’s charges to cast *Charm Person, Command*, or *Comprehend Languages* from it using your spell save DC.

**Reflect Enchantment.** If you succeed on a saving throw against an Enchantment spell that targets only you, you can take a Reaction to expend 1 charge from the staff and turn the spell back on its caster as if you had cast the spell.

**Resist Enchantment.** If you fail a saving throw against an Enchantment spell that targets only you, you can turn your failed save into a successful one. You can’t use this property of the staff again until the next dawn.

***Regaining Charges.*** The staff regains 1d8 + 2 expended charges daily at dawn. If you expend the last charge, roll 1d20. On a 1, the staff crumbles to dust and is destroyed.

## Effects
```yaml
- charges: { max: 10, recharge: { dice: 1d8 + 2, at: dawn }, destroy-on: { roll: 1d20, if: 1, when: last-charge } }
- cast-list: { pay-from: charges, dc: spell:dc, spells: [ { spell: $srd/spells/charm-person, cost: 1 }, { spell: $srd/spells/command, cost: 1 }, { spell: $srd/spells/comprehend-languages, cost: 1 } ] }
- trigger: { event: { succeed: save }, scope: { spell: { school: enchantment } }, reaction: true, if: "It targeted only you",
             offer: { cost: { charges: 1 }, text: "Turn the spell back on its caster." } }
- resource: { id: resist-enchantment, max: 1, reset: dawn }
- trigger: { event: { fail: save }, scope: { spell: { school: enchantment } }, if: "It targeted only you", offer: { cost: { resource: $#resist-enchantment }, treat-as: success } }
```
