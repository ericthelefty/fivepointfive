# Spell Scroll
**Type:** Gear
**Cost:** Cantrip, 30 GP; Level 1, 50 GP
**Source:** SRD 5.2.1, p. 99

A *Spell Scroll* (Cantrip) or *Spell Scroll* (Level 1) is a magic item that bears the words of a cantrip or level 1 spell, respectively, determined by the scroll’s creator. If the spell is on your class’s spell list, you can read the scroll and cast the spell using its normal casting time and without providing any Material components.

If the spell requires a saving throw or an attack roll, the spell save DC is 13, and the attack bonus is +5. The scroll disintegrates when the casting is completed.

## Effects
```yaml
- variant: { id: level, by: name, values: { cantrip: { dc: 13, attack: 5 }, level-1: { dc: 13, attack: 5 } } }
- action: { cast: variant:spell, consume: true, requires: { spell-on-list: true }, overrides: { components.material: false, dc: 13, attack: 5 } }
```
