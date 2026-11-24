# Staff of the Magi
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 246
*Staff, Legendary (Requires Attunement by a Sorcerer, Warlock, or Wizard)*

This staff has 50 charges and can be wielded as a magic Quarterstaff that grants a +2 bonus to attack rolls and damage rolls made with it. While you hold it, you gain a +2 bonus to spell attack rolls.

***Spell Absorption.*** While holding the staff, you have Advantage on saving throws against spells. In addition, you can take a Reaction when another creature casts a spell that targets only you. If you do, the staff absorbs the magic of the spell, canceling its effect and gaining a number of charges equal to the absorbed spell’s level. However, if doing so brings the staff’s total number of charges above 50, the staff explodes as if you activated its Retributive Strike (see below).

***Spells.*** While holding the staff, you can cast one of the spells on the following table from it, using your spell save DC. The table indicates how many charges you must expend to cast the spell.

|  |  |
|---|---|
| Spell | Charge Cost |
| Arcane Lock | 0 |
| Conjure Elemental | 7 |
| Detect Magic | 0 |
| Dispel Magic | 3 |
| Enlarge/Reduce | 0 |
| Fireball (level 7 version) | 7 |
| Flaming Sphere | 2 |
| Ice Storm | 4 |
| Invisibility | 2 |
| Knock | 2 |
| Light | 0 |
| Lightning Bolt (level 7 version) | 7 |

| Spell | Charge Cost |
|---|---|
| Mage Hand | 0 |
| Passwall | 5 |
| Plane Shift | 7 |
| Protection from Evil and Good | 0 |
| Telekinesis | 5 |
| Wall of Fire | 4 |
| Web | 2 |

***Regaining Charges.*** The staff regains 4d6 + 2 expended charges daily at dawn. If you expend the last charge, roll 1d20. On a 20, the staff regains 1d12 + 1 charges.

***Retributive Strike.*** You can take a Magic action to break the staff over your knee or against a solid surface. The staff is destroyed and releases its magic in an explosion that fills a 30-foot Emanation originating from itself. You have a 50 percent chance to instantly travel to a random plane of existence, avoiding the explosion. If you fail to avoid the effect, you take Force damage equal to 16 times the number of charges in the staff. Each other creature in the area makes a DC 17 Dexterity saving throw. On a failed save, a creature takes Force damage equal to 6 times the number of charges in the staff. On a successful save, a creature takes half as much damage.

## Effects
```yaml
- wield-as: { weapon: quarterstaff }
- bonus: { to: [attack, damage], value: 2, scope: { weapon: { id: self } } }
- bonus: { to: spell:attack, value: 2, when: { wielding: self } }
- charges: { max: 50, recharge: { dice: 4d6 + 2, at: dawn } }
- advantage: { roll: save:all, scope: { source: spell } }
- trigger: { event: { targeted: spell }, reaction: true, if: "The spell targets only you", offer: { text: "Absorb it: no effect; the staff gains charges equal to the spell's level." } }
- cast-list: { pay-from: charges, dc: spell:dc, table: Staff of the Magi }
- action: { activation: magic, label: Retributive Strike, area: { shape: emanation, size: 30 }, save: { ability: dex, dc: 17, success: half },
            damage: { dice: "16 * charges", type: force, by-distance: true }, consume: true }
```
