# Burning [Hazard]
**Type:** Rule
**Source:** SRD 5.2.1, p. 178

A burning creature or object takes 1d4 Fire damage at the start of each of its turns. As an action, you can extinguish fire on yourself by giving yourself the Prone condition and rolling on the ground. The fire also goes out if it is doused, submerged, or suffocated.

## Effects
```yaml
- trigger: { event: start-of-turn, auto: true, offer: { damage: { dice: 1d4, type: fire } } }
- action: { activation: action, effects: [ { condition: [prone] } ], end-effect: true, text: "Roll on the ground to put out the fire." }
```
