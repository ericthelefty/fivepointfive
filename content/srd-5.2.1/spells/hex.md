# Hex
**Type:** Spell
**Source:** SRD 5.2.1, p. 140
*Level 1 Enchantment (Warlock)*
**Casting Time:** Bonus Action
**Range:** 90 feet
**Components:** V, S, M (the petrified eye of a newt)
**Duration:** Concentration, up to 1 hour

You place a curse on a creature that you can see within range. Until the spell ends, you deal an extra 1d6 Necrotic damage to the target whenever you hit it with an attack roll. Also, choose one ability when you cast the spell. The target has Disadvantage on ability checks made with the chosen ability.

If the target drops to 0 Hit Points before this spell ends, you can take a Bonus Action on a later turn to curse a new creature.

***Using a Higher-Level Spell Slot.*** Your Concentration can last longer with a spell slot of level 2 (up to 4 hours), 3–4 (up to 8 hours), or 5+ (24 hours).

## Effects
```yaml
- action: { targets: { count: 1 }, choose: { id: hex-ability, kind: ability } }
- target-effects: { effects: [ { disadvantage: { roll: check:chosen } } ] }
- trigger: { event: hit, scope: { against: { target: marked } }, auto: true, offer: { damage: { dice: 1d6, type: necrotic } } }
- trigger: { event: { target-drops: zero }, offer: { text: "Bonus Action on a later turn: curse a new creature." } }
- scaling: { slots: { "2": { duration: { amount: 4, unit: hour, concentration: true } }, "3-4": { duration: { amount: 8, unit: hour, concentration: true } },
                      "5+": { duration: { amount: 24, unit: hour, concentration: true } } } }
```
