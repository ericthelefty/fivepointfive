# Hide [Action]
**Type:** Rule
**Source:** SRD 5.2.1, p. 183

With the Hide action, you try to hide yourself. To do so, you must succeed on a DC 15 Dexterity (Stealth) check while you’re Heavily Obscured or behind Three-Quarters Cover or Total Cover, and you must be out of any enemy’s line of sight; if you can see a creature, you can discern whether it can see you.

On a successful check, you have the Invisible condition while hidden. Make note of your check’s total, which is the DC for a creature to find you with a Wisdom (Perception) check.

You stop being hidden immediately after any of the following occurs: you make a sound louder than a whisper, an enemy finds you, you make an attack roll, or you cast a spell with a Verbal component.

## Effects
```yaml
- action: { id: hide, activation: action, check: { skill: stealth, dc: 15 }, if: "Heavily Obscured or behind Three-Quarters/Total Cover, out of enemies' sight",
            on-success: { apply: { condition: invisible, ends-when: [loud-sound, found, attack, verbal-spell], text: "Your check total is the DC to find you." } } }
```
