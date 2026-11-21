# Wand of the War Mage, +1, +2, or +3
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 251
*Wand, Uncommon (+1), Rare (+2), or Very Rare (+3) (Requires Attunement by a Spellcaster)*

While holding this wand, you gain a bonus to spell attack rolls determined by the wand’s rarity. In addition, you ignore Half Cover when making a spell attack roll.

## Effects
```yaml
- variant: { id: plus, by: rarity, values: { uncommon: 1, rare: 2, very-rare: 3 } }
- bonus: { to: spell:attack, value: variant:plus, when: { wielding: self } }
- trait: [ignore-half-cover-on-spell-attacks]
```
