# Robe of the Archmagi
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 240
*Wondrous Item, Legendary (Requires Attunement by a Sorcerer, Warlock, or Wizard)*

This elegant garment is made from exquisite cloth and adorned with runes.

You gain these benefits while wearing the robe.

***Armor.*** If you aren’t wearing armor, your base Armor Class is 15 plus your Dexterity modifier.

***Magic Resistance.*** You have Advantage on saving throws against spells and other magical effects.

***War Mage.*** Your spell save DC and spell attack bonus each increase by 2.

## Effects
```yaml
- base: { to: ac, value: 15 + mod:dex, when: { armor: none } }
- advantage: { roll: save:all, scope: { source: magic } }
- bonus: { to: [spell:dc, spell:attack], value: 2 }
```
