# Skilled
**Type:** Feat
**Source:** SRD 5.2.1, p. 87
*Origin Feat*

You gain proficiency in any combination of three skills or tools of your choice.

***Repeatable.*** You can take this feat more than once.

## Effects
```yaml
- choose: { id: skilled, kind: [skill, tool], count: 3, grants: proficiency, from: any }
```
