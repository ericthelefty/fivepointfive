# Demon Armor
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 218
*Armor (Any Light, Medium, or Heavy), Very Rare (Requires Attunement)*

While wearing this armor, you gain a +1 bonus to Armor Class, and you know Abyssal. In addition, the armor’s clawed gauntlets allow your Unarmed Strikes to deal 1d8 Slashing damage instead of the usual Bludgeoning damage, and you gain a +1 bonus to the attack and damage rolls of your Unarmed Strikes.

***Curse.*** Once you don this cursed armor, you can’t doff it unless you are targeted by a *Remove Curse* spell or similar magic. While wearing the armor, you have Disadvantage on attack rolls against demons and on saving throws against their spells and special abilities.

## Effects
```yaml
- bonus: { to: ac, value: 1, scope: { item: self } }
- language: [abyssal]
- damage-die: { die: 1d8, type: slashing, scope: { weapon: { unarmed: true } } }
- bonus: { to: [attack, damage], value: 1, scope: { weapon: { unarmed: true } } }
- curse:
    prevents: [doff, unattune]
    ends: { spell: $srd/spells/remove-curse }
    effects:
      - disadvantage: { roll: [attack, save:all], scope: { against: { creature: demon } } }
```
