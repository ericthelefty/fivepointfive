# Regenerate
**Type:** Spell
**Source:** SRD 5.2.1, p. 158
*Level 7 Transmutation (Bard, Cleric, Druid)*
**Casting Time:** 1 minute
**Range:** Touch
**Components:** V, S, M (a prayer wheel)
**Duration:** 1 hour

A creature you touch regains 4d8 + 15 Hit Points. For the duration, the target regains 1 Hit Point at the start of each of its turns, and any severed body parts regrow after 2 minutes.

## Effects
```yaml
- action: { range: touch, targets: { count: 1 }, heal: 4d8 + 15 }
- target-effects: { effects: [ { trigger: { event: start-of-turn, auto: true, offer: { heal: 1 } } }, { trait: { text: "Severed body parts regrow after 2 minutes." } } ] }
```
