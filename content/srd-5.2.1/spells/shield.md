# Shield
**Type:** Spell
**Source:** SRD 5.2.1, p. 161
*Level 1 Abjuration (Sorcerer, Wizard)*
**Casting Time:** Reaction, which you take when you are hit by an attack roll or targeted by the *Magic Missile* spell
**Range:** Self
**Components:** V, S
**Duration:** 1 round

An imperceptible barrier of magical force protects you. Until the start of your next turn, you have a +5 bonus to AC, including against the triggering attack, and you take no damage from *Magic Missile.*

## Effects
```yaml
- trigger: { event: [hit-by, { targeted: $srd/spells/magic-missile }], reaction: true, offer: { cast: self } }
- self-effects:
    duration: { until: start-of-next-turn }
    effects:
      - bonus: { to: ac, value: 5 }
      - defense: { immunity: { spell: $srd/spells/magic-missile } }
```
