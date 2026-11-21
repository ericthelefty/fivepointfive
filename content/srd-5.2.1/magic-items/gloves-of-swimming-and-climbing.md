# Gloves of Swimming and Climbing
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 224
*Wondrous Item, Uncommon (Requires Attunement)*

While wearing these gloves, you have a Climb Speed and a Swim Speed equal to your Speed, and you gain a +5 bonus to Strength (Athletics) checks made to climb or swim.

## Effects
```yaml
- speed: { climb: speed:walk, swim: speed:walk }
- bonus: { to: skill:athletics, value: 5, when: { player: "Climbing or swimming" } }
```
