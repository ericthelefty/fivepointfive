# Talisman of Ultimate Evil
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 249
*Wondrous Item, Legendary (Requires Attunement)*

This item symbolizes unrepentant evil. A creature that isn’t a Fiend or an Undead that touches the talisman takes 8d6 Necrotic damage and takes the damage again each time it ends its turn holding or carrying the talisman.

***Holy Symbol.*** You can use the talisman as a Holy Symbol. You gain a +2 bonus to spell attack rolls while you wear or hold it.

***Ultimate End.*** The talisman has 6 charges. While wearing or holding the talisman, you can take a Magic action to expend 1 charge and target one creature you can see on the ground within 120 feet of yourself. A flaming fissure opens under the target, and the target makes a DC 20 Dexterity saving throw. If the target is a Celestial, it has Disadvantage on the save. On a failed save, the target falls into the fissure and is destroyed, leaving no remains. On a successful save, the target isn’t cast into the fissure but takes 4d6 Psychic damage from the ordeal. In either case, the fissure then closes, leaving no trace of its existence. When you expend the last charge, the talisman dissolves into foul-smelling slime and is destroyed.

## Effects
```yaml
- bonus: { to: spell:attack, value: 2 }
- spellcasting: { focus: self }
- charges: { max: 6, destroy-on: { when: last-charge } }
- action: { activation: magic, label: Ultimate End, cost: { charges: 1 }, range: 120, targets: { count: 1, text: "On the ground" },
            save: { ability: dex, dc: 20, disadvantage: { creature: celestial } }, on-failure: { text: "Falls into a fissure and is destroyed." },
            on-success: { damage: { dice: 4d6, type: psychic } } }
- trait: { text: "A creature that isn't a Fiend or Undead touching it takes 8d6 Necrotic damage, and again each time it ends a turn holding it." }
```
