# Resistance
**Type:** Spell
**Source:** SRD 5.2.1, p. 158
*Abjuration Cantrip (Cleric, Druid)*
**Casting Time:** Action
**Range:** Touch
**Component:** V, S
**Duration:** Concentration, up to 1 minute

You touch a willing creature and choose a damage type: Acid, Bludgeoning, Cold, Fire, Lightning, Necrotic, Piercing, Poison, Radiant, Slashing, or Thunder. When the creature takes damage of the chosen type before the spell ends, the creature reduces the total damage taken by 1d4. A creature can benefit from this spell only once per turn.

## Effects
```yaml
- action: { range: touch, targets: { count: 1, creature: willing }, choose: { id: resistance-type, kind: damage-type, from: [acid, bludgeoning, cold, fire, lightning, necrotic, piercing, poison, radiant, slashing, thunder] } }
- target-effects: { effects: [ { trigger: { event: damaged, auto: true, per: turn, scope: { against: { damage: choice:resistance-type } },
                                            offer: { damage-taken: { reduce: 1d4 } } } } ] }
```
