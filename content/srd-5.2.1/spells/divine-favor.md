# Divine Favor
**Type:** Spell
**Source:** SRD 5.2.1, p. 125
*Level 1 Transmutation (Paladin)*
**Casting Time:** Bonus Action
**Range:** Self
**Components:** V, S
**Duration:** 1 minute

Until the spell ends, your attacks with weapons deal an extra 1d4 Radiant damage on a hit.

## Effects
```yaml
- self-effects: { effects: [ { trigger: { event: hit, scope: { weapon: {} }, auto: true, offer: { damage: { dice: 1d4, type: radiant } } } } ] }
```
