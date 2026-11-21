# Hunter’s Mark
**Type:** Spell
**Source:** SRD 5.2.1, p. 141
*Level 1 Divination (Ranger)*
**Casting Time:** Bonus Action
**Range:** 90 feet
**Components:** V
**Duration:** Concentration, up to 1 hour

You magically mark one creature you can see within range as your quarry. Until the spell ends, you deal an extra 1d6 Force damage to the target whenever you hit it with an attack roll. You also have Advantage on any Wisdom (Perception or Survival) check you make to find it.

If the target drops to 0 Hit Points before this spell ends, you can take a Bonus Action to move the mark to a new creature you can see within range.

***Using a Higher-Level Spell Slot.*** Your Concentration can last longer with a spell slot of level 3–4 (up to 8 hours) or 5+ (up to 24 hours).

## Effects
```yaml
- action: { activation: bonus, range: 90, duration: { amount: 1, unit: hour, concentration: true } }
- trigger: { id: mark-damage, event: hit, if: "Target is your marked creature",
             offer: { damage: { dice: 1d6, type: force } } }
- advantage: { roll: [skill:perception, skill:survival], scope: { against: { target: marked } } }
- trigger: { event: { target-drops: zero }, offer: { text: "Bonus Action: move the mark to a new creature." } }
- scaling: { slots: { "3-4": { duration: { amount: 8, unit: hour } }, "5+": { duration: { amount: 24, unit: hour } } } }
```
