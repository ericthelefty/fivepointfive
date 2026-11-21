# Spell Scroll
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 244
*Scroll, Rarity Varies*

A *Spell Scroll* bears the words of a single spell, written in a mystical cipher. If the spell is on your spell list, you can read the scroll and cast its spell without Material components. Otherwise, the scroll is unintelligible. Casting the spell by reading the scroll requires the spell’s normal casting time. Once the spell is cast, the scroll crumbles to dust. If the casting is interrupted, the scroll isn’t lost.

If the spell is on your spell list but of a higher level than you can normally cast, you make an ability check using your spellcasting ability to determine whether you cast the spell. The DC equals 10 plus the spell’s level. On a failed check, the spell disappears from the scroll with no other effect.

The level of the spell on the scroll determines the spell’s saving throw DC and attack bonus, as well as the scroll’s rarity, as shown in the following table.

|  |  |  |  |
|---|---|---|---|
| Spell Level | Rarity | Save DC | Attack Bonus |
| Cantrip | Common | 13 | +5 |
| 1 | Common | 13 | +5 |
| 2 | Uncommon | 13 | +5 |
| 3 | Uncommon | 15 | +7 |

| Spell Level | Rarity | Save DC | Attack Bonus |
|---|---|---|---|
| 4 | Rare | 15 | +7 |
| 5 | Rare | 17 | +9 |
| 6 | Very Rare | 17 | +9 |
| 7 | Very Rare | 18 | +10 |
| 8 | Very Rare | 18 | +10 |
| 9 | Legendary | 19 | +11 |

***Copying a Scroll into a Spellbook.*** A Wizard spell on a *Spell Scroll* can be copied into a spellbook. When a spell is copied in this way, the copier must succeed on an Intelligence (Arcana) check with a DC equal to 10 plus the spell’s level. On a successful check, the spell is copied. Whether the check succeeds or fails, the *Spell Scroll* is destroyed.

## Effects
```yaml
- variant: { id: level, by: spell-level, values: { 0: { dc: 13, attack: 5 }, 1: { dc: 13, attack: 5 }, 2: { dc: 13, attack: 5 },
                                                   3: { dc: 15, attack: 7 }, 4: { dc: 15, attack: 7 }, 5: { dc: 17, attack: 9 },
                                                   6: { dc: 17, attack: 9 }, 7: { dc: 18, attack: 10 }, 8: { dc: 18, attack: 10 },
                                                   9: { dc: 19, attack: 11 } } }
- action: { cast: variant:spell, consume: true, requires: { spell-on-list: true },
            overrides: { components.material: false, dc: variant:level.dc, attack: variant:level.attack },
            check: { ability: spell-ability, dc: 10 + spell.level, if: "The spell is above the level you can cast" } }
```
