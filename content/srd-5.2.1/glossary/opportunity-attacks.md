# Opportunity Attacks
**Type:** Rule
**Source:** SRD 5.2.1, p. 185

You can make an Opportunity Attack when a creature that you can see leaves your reach using its action, its Bonus Action, its Reaction, or one of its speeds. To make the Opportunity Attack, take a Reaction to make one melee attack with a weapon or an Unarmed Strike against the provoking creature. The attack occurs right before the creature leaves your reach. *See also* “Playing the Game” (“Combat”).

## Effects
```yaml
- trigger: { id: opportunity-attack, event: { leaves-reach: enemy }, reaction: true, offer: { attack: { kind: melee, count: 1 } } }
```
