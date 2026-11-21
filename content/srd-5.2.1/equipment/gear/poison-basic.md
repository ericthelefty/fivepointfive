# Poison, Basic
**Type:** Gear
**Cost:** 100 GP
**Source:** SRD 5.2.1, p. 99

As a Bonus Action, you can use a vial of Basic Poison to coat one weapon or up to three pieces of ammunition. A creature that takes Piercing or Slashing damage from the poisoned weapon or ammunition takes an extra 1d4 Poison damage. Once applied, the poison retains potency for 1 minute or until its damage is dealt, whichever comes first.

## Effects
```yaml
- action: { activation: bonus, consume: true, duration: { amount: 1, unit: minute },
            effects: [ { trigger: { event: hit, auto: true, scope: { against: { damage: [piercing, slashing] } }, offer: { damage: { dice: 1d4, type: poison }, end-effect: true } } } ] }
```
