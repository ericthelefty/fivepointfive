# Prone [Condition]
**Type:** Rule
**Source:** SRD 5.2.1, p. 186

While you have the Prone condition, you experience the following effects.

***Restricted Movement.*** Your only movement options are to crawl or to spend an amount of movement equal to half your Speed (round down) to right yourself and thereby end the condition. If your Speed is 0, you can’t right yourself.

***Attacks Affected.*** You have Disadvantage on attack rolls. An attack roll against you has Advantage if the attacker is within 5 feet of you. Otherwise, that attack roll has Disadvantage.

## Effects
```yaml
- trait: { text: "Only crawl, or spend half your Speed to stand (not at Speed 0)." }
- disadvantage: { roll: attack }
- advantage: { roll: attacks-against-you, when: { player: "The attacker is within 5 feet" } }
- disadvantage: { roll: attacks-against-you, when: { player: "The attacker is more than 5 feet away" } }
```
