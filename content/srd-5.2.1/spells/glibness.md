# Glibness
**Type:** Spell
**Source:** SRD 5.2.1, p. 136
*Level 8 Enchantment (Bard, Warlock)*
**Casting Time:** Action
**Range:** Self
**Components:** V
**Duration:** 1 hour

Until the spell ends, when you make a Charisma check, you can replace the number you roll with a 15. Additionally, no matter what you say, magic that would determine if you are telling the truth indicates that you are being truthful.

## Effects
```yaml
- self-effects: { effects: [ { roll-floor: { roll: check:cha, min: 15, optional: true } }, { trait: [reads-as-truthful] } ] }
```
