# Potion of Climbing
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 235
*Potion, Common*

When you drink this potion, you gain a Climb Speed equal to your Speed for 1 hour. During this time, you have Advantage on Strength (Athletics) checks to climb.

This potion is separated into brown, silver, and gray layers resembling bands of stone. Shaking the bottle fails to mix the colors.

## Effects
```yaml
- action: { activation: bonus, consume: true, duration: { amount: 1, unit: hour },
            effects: [ { speed: { climb: speed:walk } }, { advantage: { roll: skill:athletics, when: { player: "Climbing" } } } ] }
```
