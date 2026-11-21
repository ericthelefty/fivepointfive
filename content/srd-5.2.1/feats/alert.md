# Alert
**Type:** Feat
**Source:** SRD 5.2.1, p. 87
*Origin Feat*

You gain the following benefits.

## Initiative Proficiency

When you roll Initiative, you can add your Proficiency Bonus to the roll.

## Effects
```yaml
- bonus: { to: initiative, value: prof }
```

## Initiative Swap

Immediately after you roll Initiative, you can swap your Initiative with the Initiative of one willing ally in the same combat. You can’t make this swap if you or the ally has the Incapacitated condition.

## Effects
```yaml
- trigger: { event: { roll: initiative }, if: "Neither you nor the ally is Incapacitated",
             offer: { text: "Swap your Initiative with one willing ally in the same combat." } }
```
