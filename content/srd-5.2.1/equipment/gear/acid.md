# Acid
**Type:** Gear
**Cost:** 25 GP
**Weight:** 1 lb.
**Source:** SRD 5.2.1, p. 94

When you take the Attack action, you can replace one of your attacks with throwing a vial of Acid. Target one creature or object you can see within 20 feet of yourself. The target must succeed on a Dexterity saving throw (DC 8 plus your Dexterity modifier and Proficiency Bonus) or take 2d6 Acid damage.

## Effects
```yaml
- action: { activation: replace-attack, range: 20, consume: true, save: { ability: dex, dc: 8 + mod:dex + prof }, on-failure: { damage: { dice: 2d6, type: acid } } }
```
