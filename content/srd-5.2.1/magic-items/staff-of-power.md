# Staff of Power
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 245
*Staff, Very Rare (Requires Attunement by a Sorcerer, Warlock, or Wizard)*

This staff has 20 charges and can be wielded as a magic Quarterstaff that grants a +2 bonus to attack rolls and damage rolls made with it. While holding it, you gain a +2 bonus to Armor Class, saving throws, and spell attack rolls.

***Spells.*** While holding the staff, you can cast one of the spells on the following table from it, using your spell save DC. The table indicates how many charges you must expend to cast the spell.

| Spell | Charge Cost |
|---|---|
| Cone of Cold | 5 |
| Fireball (level 5 version) | 5 |
| Globe of Invulnerability | 6 |
| Hold Monster | 5 |
| Levitate | 2 |
| Lightning Bolt (level 5 version) | 5 |
| Magic Missile | 1 |
| Ray of Enfeeblement | 1 |
| Wall of Force | 5 |

***Regaining Charges.*** The staff regains 2d8 + 4 expended charges daily at dawn. If you expend the last charge, roll 1d20. On a 1, the staff retains its +2 bonus to attack rolls and damage rolls but loses all other properties. On a 20, the staff regains 1d8 + 2 charges.

***Retributive Strike.*** You can take a Magic action to break the staff over your knee or against a solid surface. The staff is destroyed and releases its magic in an explosion that fills a 30-foot Emanation originating from itself. You have a 50 percent chance to instantly travel to a random plane of existence, avoiding the explosion. If you fail to avoid the effect, you take Force damage equal to 16 times the number of charges in the staff. Each other creature in the area makes a DC 17 Dexterity saving throw. On a failed save, a creature takes Force damage equal to 4 times the number of charges in the staff. On a successful save, a creature takes half as much damage.

## Effects
```yaml
- wield-as: { weapon: quarterstaff }
- bonus: { to: [attack, damage], value: 2, scope: { weapon: { id: self } } }
- bonus: { to: [ac, save:all, spell:attack], value: 2, when: { wielding: self } }
- charges: { max: 20, recharge: { dice: 2d8 + 4, at: dawn } }
- cast-list: { pay-from: charges, dc: spell:dc, spells: [ { spell: $srd/spells/cone-of-cold, cost: 5 }, { spell: $srd/spells/fireball, cost: 5, at: 5 },
    { spell: $srd/spells/globe-of-invulnerability, cost: 6 }, { spell: $srd/spells/hold-monster, cost: 5 }, { spell: $srd/spells/levitate, cost: 2 },
    { spell: $srd/spells/lightning-bolt, cost: 5, at: 5 }, { spell: $srd/spells/magic-missile, cost: 1 }, { spell: $srd/spells/ray-of-enfeeblement, cost: 1 },
    { spell: $srd/spells/wall-of-force, cost: 5 } ] }
- trigger: { event: hit, scope: { weapon: { id: self } }, offer: { cost: { charges: 1 }, damage: { dice: 1d6, type: force } } }
- action: { activation: magic, label: Retributive Strike, area: { shape: emanation, size: 30 }, save: { ability: dex, dc: 17, success: half },
            damage: { dice: "16 * charges", type: force, by-distance: true }, consume: true, text: "Break the staff; 50% chance you travel to another plane." }
```
