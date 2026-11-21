# Animated Shield
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 209
*Armor (Shield), Very Rare (Requires Attunement)*

While holding this Shield, you can take a Bonus Action to cause it to animate. The Shield leaps into the air and hovers in your space to protect you as if you were wielding it, leaving your hands free. The Shield remains animate for 1 minute, until you take a Bonus Action to end this effect, or until you die or have the Incapacitated condition, at which point the Shield falls to the ground or into your hand if you have one free.

## Effects
```yaml
- toggle: { activation: bonus, duration: { amount: 1, unit: minute }, ends-when: [{ condition: incapacitated }],
            effects: [ { trait: { text: "The Shield protects you as if wielded, leaving your hands free." } } ] }
```
