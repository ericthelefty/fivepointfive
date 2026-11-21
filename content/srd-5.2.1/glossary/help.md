# Help [Action]
**Type:** Rule
**Source:** SRD 5.2.1, p. 182

When you take the Help action, you do one of the following.

***Assist an Ability Check.*** Choose one of your skill or tool proficiencies and one ally who is near enough for you to assist verbally or physically when they make an ability check. That ally has Advantage on the next ability check they make with the chosen skill or tool. This benefit expires if the ally doesn’t use it before the start of your next turn. The GM has final say on whether your assistance is possible.

***Assist an Attack Roll.*** You momentarily distract an enemy within 5 feet of you, giving Advantage to the next attack roll by one of your allies against that enemy. This benefit expires at the start of your next turn.

## Effects
```yaml
- action: { id: help, activation: action, choose-one: [
              { id: assist-check, label: Assist an Ability Check, give: { advantage: { roll: check:chosen }, duration: { until: start-of-next-turn }, limit: 1 } },
              { id: assist-attack, label: Assist an Attack Roll, give: { advantage: { roll: attack, scope: { against: { target: chosen } } }, duration: { until: start-of-next-turn }, limit: 1 } } ] }
```
