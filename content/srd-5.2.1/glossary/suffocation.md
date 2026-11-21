# Suffocation [Hazard]
**Type:** Rule
**Source:** SRD 5.2.1, p. 189

A creature can hold its breath for a number of minutes equal to 1 plus its Constitution modifier (minimum of 30 seconds) before suffocation begins. When a creature runs out of breath or is choking, it gains 1 Exhaustion level at the end of each of its turns. When a creature can breathe again, it removes all levels of Exhaustion it gained from suffocating.

## Effects
```yaml
- resource: { id: breath, max: "max(0.5, 1 + mod:con)", unit: minute }
- trigger: { event: end-of-turn, auto: true, when: { player: "Out of breath or choking" }, offer: { exhaustion: 1 } }
```
