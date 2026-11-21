# Chain
**Type:** Gear
**Cost:** 5 GP
**Source:** SRD 5.2.1, p. 96

As a Utilize action, you can wrap a Chain around an unwilling creature within 5 feet of yourself that has the Grappled, Incapacitated, or Restrained condition if you succeed on a DC 13 Strength (Athletics) check. If the creature’s legs are bound, the creature has the Restrained condition until it escapes. Escaping the Chain requires the creature to make a successful DC 18 Dexterity (Acrobatics) check as an action. Bursting the Chain requires a successful DC 20 Strength (Athletics) check as an action.

## Effects
```yaml
- action: { activation: utilize, range: 5, targets: { count: 1, condition: [grappled, incapacitated, restrained] }, check: { skill: athletics, dc: 13 },
            on-success: { apply: { condition: restrained, escape: { check: skill:acrobatics, dc: 18 }, text: "Burst: DC 20 Str (Athletics)" } } }
```
