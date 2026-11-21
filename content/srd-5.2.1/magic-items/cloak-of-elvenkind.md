# Cloak of Elvenkind
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 215
*Wondrous Item, Uncommon (Requires Attunement)*

While you wear this cloak, Wisdom (Perception) checks made to perceive you have Disadvantage, and you have Advantage on Dexterity (Stealth) checks.

## Effects
```yaml
- advantage: { roll: skill:stealth }
- disadvantage: { roll: checks-to-perceive-you, scope: { ability: wis } }
```
