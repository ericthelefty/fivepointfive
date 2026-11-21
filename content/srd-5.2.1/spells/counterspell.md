# Counterspell
**Type:** Spell
**Source:** SRD 5.2.1, p. 120
*Level 3 Abjuration (Sorcerer, Warlock, Wizard)*
**Casting Time:** Reaction, which you take when you see a creature within 60 feet of yourself casting a spell with Verbal, Somatic, or Material components
**Range:** 60 feet
**Components:** S
**Duration:** Instantaneous

You attempt to interrupt a creature in the process of casting a spell. The creature makes a Constitution saving throw. On a failed save, the spell dissipates with no effect, and the action, Bonus Action, or Reaction used to cast it is wasted. If that spell was cast with a spell slot, the slot isn’t expended.

## Effects
```yaml
- trigger: { event: { cast: any }, who: { creature: other, range: 60, see: true }, reaction: true,
             offer: { save: { ability: con }, text: "On a failed save the spell fails; a spent slot isn't expended." } }
```
