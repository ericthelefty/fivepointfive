# Eldritch Blast
**Type:** Spell
**Source:** SRD 5.2.1, p. 127
*Evocation Cantrip (Warlock)*
**Casting Time:** Action
**Range:** 120 feet
**Components:** V, S
**Duration:** Instantaneous

You hurl a beam of crackling energy. Make a ranged spell attack against one creature or object in range. On a hit, the target takes 1d10 Force damage.

***Cantrip Upgrade.*** The spell creates two beams at level 5, three beams at level 11, and four beams at level 17. You can direct the beams at the same target or at different ones. Make a separate attack roll for each beam.

## Effects
```yaml
- action: { attack: { kind: ranged-spell, count: 1 }, damage: { dice: 1d10, type: force } }
- scaling: { cantrip: [5, 11, 17], add: { attack.count: 1 } }
```
