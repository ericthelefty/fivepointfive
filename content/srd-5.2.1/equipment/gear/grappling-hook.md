# Grappling Hook
**Type:** Gear
**Cost:** 2 GP
**Weight:** 4 lb.
**Source:** SRD 5.2.1, p. 97

As a Utilize action, you can throw the Grappling Hook at a railing, a ledge, or another catch within 50 feet of yourself, and the hook catches on if you succeed on a DC 13 Dexterity (Acrobatics) check. If you tied a Rope to the hook, you can then climb it.

## Effects
```yaml
- action: { activation: utilize, range: 50, check: { skill: acrobatics, dc: 13 }, text: "The hook catches; climb a tied Rope." }
```
