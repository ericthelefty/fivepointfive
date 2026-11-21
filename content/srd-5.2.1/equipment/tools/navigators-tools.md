# Navigator’s Tools
**Type:** Tool
**Cost:** 25 GP
**Source:** SRD 5.2.1, p. 94
**Ability:** Wisdom
**Weight:** 2 lb.
**Utilize:** Plot a course (DC 10), or determine position by stargazing (DC 15)

## Effects
```yaml
- action:
    activation: utilize
    label: Plot a course
    check: {tool: self, ability: wis, dc: 10}
- action:
    activation: utilize
    label: Determine position by stargazing
    check: {tool: self, ability: wis, dc: 15}
```
