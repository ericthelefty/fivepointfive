# Arrow-Catching Shield
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 211
*Armor (Shield), Rare (Requires Attunement)*

You gain a +2 bonus to Armor Class against ranged attack rolls while you wield this Shield. This bonus is in addition to the Shield’s normal bonus to AC.

Whenever an attacker makes a ranged attack roll against a target within 5 feet of you, you can take a Reaction to become the target of the attack instead.

## Effects
```yaml
- bonus: { to: ac, value: 2, scope: { against: { attack: ranged } } }
- trigger: { event: targeted, who: { creature: ally, range: 5 }, reaction: true, if: "A ranged attack against a target within 5 feet of you",
             offer: { text: "You become the target instead." } }
```
