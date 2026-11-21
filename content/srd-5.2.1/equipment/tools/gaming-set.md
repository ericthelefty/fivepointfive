# Gaming Set
**Type:** Tool
**Cost:** Varies
**Source:** SRD 5.2.1, p. 94
**Ability:** Wisdom
**Weight:** —
**Utilize:** Discern whether someone is cheating (DC 10), or win the game (DC 20)
**Variants:** Dice (1 SP), dragonchess (1 GP), playing cards (5 SP), three-dragon ante (1 GP)

## Effects
```yaml
- action:
    activation: utilize
    label: Discern whether someone is cheating
    check: {tool: self, ability: wis, dc: 10}
- action:
    activation: utilize
    label: Win the game
    check: {tool: self, ability: wis, dc: 20}
- variant:
    id: kind
    by: name
    values: [dice, dragonchess, playing-cards, dragon-ante]
```
