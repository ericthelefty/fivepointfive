# Rope
**Type:** Gear
**Cost:** 1 GP
**Source:** SRD 5.2.1, p. 99

As a Utilize action, you can tie a knot with Rope if you succeed on a DC 10 Dexterity (Sleight of Hand) check. The Rope can be burst with a successful DC 20 Strength (Athletics) check.

You can bind an unwilling creature with the Rope only if the creature has the Grappled, Incapacitated, or Restrained condition. If the creature’s legs are bound, the creature has the Restrained condition until it escapes. Escaping the Rope requires the creature to make a successful DC 15 Dexterity (Acrobatics) check as an action.

## Effects
```yaml
- action: { activation: utilize, check: { skill: sleight-of-hand, dc: 10 }, text: "Tie a knot; bind a Grappled, Incapacitated or Restrained creature (legs bound: Restrained; escape DC 15 Dex (Acrobatics)). Burst: DC 20 Str (Athletics)." }
```
