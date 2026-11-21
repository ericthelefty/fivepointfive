# Oil of Slipperiness
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 233
*Potion, Uncommon*

One vial of this oil can cover one Medium or smaller creature, along with the equipment it’s wearing and carrying (one additional vial is required for each size category above Medium). Applying the oil takes 10 minutes. The affected creature then gains the effect of the *Freedom of Movement* spell for 8 hours.

Alternatively, the oil can be poured on the ground as a Magic action, where it covers a 10-foot square, duplicating the effect of the *Grease* spell in that area for 8 hours.

This sticky, black unguent is thick and heavy, but it flows quickly when poured.

## Effects
```yaml
- action: { consume: true, choose-one: [
              { id: coat, label: Coat a creature, activation: { amount: 10, unit: minute }, cast: $srd/spells/freedom-of-movement, overrides: { duration: { amount: 8, unit: hour } } },
              { id: pour, label: Pour on the ground, activation: magic, cast: $srd/spells/grease, overrides: { duration: { amount: 8, unit: hour } } } ] }
```
