# Search [Action]
**Type:** Rule
**Source:** SRD 5.2.1, p. 187

When you take the Search action, you make a Wisdom check to discern something that isn’t obvious. The Search table suggests which skills are applicable when you take this action, depending on what you’re trying to detect.

## Effects
```yaml
- action: { id: search, activation: action, check: { ability: wis, skill: { choose: [insight, medicine, perception, survival] } } }
```

## Search

| Skill | Thing to Detect |
|---|---|
| Insight | Creature’s state of mind |
| Medicine | Creature’s ailment or cause of death |
| Perception | Concealed creature or object |
| Survival | Tracks or food |
