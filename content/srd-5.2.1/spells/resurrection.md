# Resurrection
**Type:** Spell
**Source:** SRD 5.2.1, p. 158
*Level 7 Necromancy (Bard, Cleric)*
**Casting Time:** 1 hour
**Range:** Touch
**Components:** V, S, M (a diamond worth 1,000+ GP, which the spell consumes)
**Duration:** Instantaneous

With a touch, you revive a dead creature that has been dead for no more than a century, didn’t die of old age, and wasn’t Undead when it died.

The creature returns to life with all its Hit Points. This spell also neutralizes any poisons that affected the creature at the time of death. This spell closes all mortal wounds and restores any missing body parts.

Coming back from the dead is an ordeal. The target takes a −4 penalty to D20 Tests. Every time the target finishes a Long Rest, the penalty is reduced by 1 until it becomes 0.

Casting this spell to revive a creature that has been dead for 365 days or longer taxes you. Until you finish a Long Rest, you can’t cast spells again, and you have Disadvantage on D20 Tests.

## Effects
```yaml
- action: { range: touch, revive: { dead-max: { amount: 100, unit: year }, hp: all },
            apply: { effects: [ { bonus: { to: d20, value: -4, decays: { per: long-rest, amount: 1 } } } ] },
            text: "Reviving after 365+ days: you can't cast spells and have Disadvantage on D20 Tests until a Long Rest." }
```
