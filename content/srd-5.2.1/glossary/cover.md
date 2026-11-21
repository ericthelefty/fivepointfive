# Cover
**Type:** Rule
**Source:** SRD 5.2.1, p. 179

Cover provides a degree of protection to a target behind it. There are three degrees of cover, each of which provides a different benefit to a target: Half Cover (+2 bonus to AC and Dexterity saving throws), Three-Quarters Cover (+5 bonus to AC and Dexterity saving throws), and Total Cover (can’t be targeted directly). If behind more than one degree of cover, a target benefits only from the most protective degree. *See also* “Playing the Game” (“Combat”).

## Effects
```yaml
- bonus: { to: [ac, save:dex], value: { choose: { half: 2, three-quarters: 5 } }, when: { player: "Behind cover" } }
- trait: { text: "Total Cover: can't be targeted directly. Only the best cover applies." }
```
