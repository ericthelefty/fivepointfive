# Oathbow
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 233
*Weapon (Longbow or Shortbow), Very Rare (Requires Attunement)*

When you nock an arrow on this bow, it whispers in Elvish, “Swift defeat to my enemies.” When you use this weapon to make a ranged attack, you can utter or sign the following command words: “Swift death to you who have wronged me.” The target of your attack becomes your sworn enemy until it dies or until dawn 7 days later. You can have only one such sworn enemy at a time. When your sworn enemy dies, you can choose a new one after the next dawn.

When you make a ranged attack roll with this weapon against your sworn enemy, you have Advantage on the roll. In addition, your target gains no benefit from Half Cover or Three-Quarters Cover, and you suffer no Disadvantage due to long range. If the attack hits, your sworn enemy takes an extra 3d6 Piercing damage.

While your sworn enemy lives, you have Disadvantage on attack rolls with all other weapons.

## Effects
```yaml
- action: { activation: none, if: "When you make a ranged attack with it", text: "Name the target your sworn enemy (until it dies or dawn 7 days later; one at a time)." }
- advantage: { roll: attack, scope: { weapon: { id: self }, against: { target: sworn-enemy } } }
- trigger: { event: hit, scope: { weapon: { id: self }, against: { target: sworn-enemy } }, auto: true, offer: { damage: { dice: 3d6, type: piercing } } }
- trait: { text: "Against your sworn enemy: ignore Half and Three-Quarters Cover and long-range Disadvantage." }
- disadvantage: { roll: attack, scope: { weapon: { not: { id: self } } }, when: { player: "Your sworn enemy lives" } }
```
