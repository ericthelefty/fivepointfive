# Bracers of Archery
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 214
*Wondrous Item, Uncommon (Requires Attunement)*

While wearing these bracers, you have proficiency with the Longbow and Shortbow, and you gain a +2 bonus to damage rolls made with such weapons.

## Effects
```yaml
- proficiency: [weapon:longbow, weapon:shortbow]
- bonus: { to: damage, value: 2, scope: { weapon: { id: [longbow, shortbow] } } }
```
