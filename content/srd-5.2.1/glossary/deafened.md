# Deafened [Condition]
**Type:** Rule
**Source:** SRD 5.2.1, p. 181

While you have the Deafened condition, you experience the following effect.

***Can’t Hear.*** You can’t hear and automatically fail any ability check that requires hearing.

## Effects
```yaml
- auto-fail: { roll: check:all, when: { player: "Requires hearing" } }
```
