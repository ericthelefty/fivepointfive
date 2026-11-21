# Armor Training
**Type:** Rule
**Source:** SRD 5.2.1, p. 177

Armor training allows you to use armor of a certain category without the following drawbacks. If you wear Light, Medium, or Heavy armor and lack training with it, you have Disadvantage on any D20 Test that involves Strength or Dexterity, and you can’t cast spells. If you use a Shield and lack training with it, you don’t gain its AC bonus. *See also* “Disadvantage” and “Equipment” (“Armor”).

## Effects
```yaml
- disadvantage: { roll: d20, scope: { ability: [str, dex] }, when: { armor-untrained: true } }
- trait: { text: "Wearing armor you lack training with: you can't cast spells. An untrained Shield gives no AC." }
```
