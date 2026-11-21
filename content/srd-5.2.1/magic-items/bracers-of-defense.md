# Bracers of Defense
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 214
*Wondrous Item, Rare (Requires Attunement)*

While wearing these bracers, you gain a +2 bonus to Armor Class if you are wearing no armor and using no Shield.

## Effects
```yaml
- bonus: { to: ac, value: 2, when: { armor: none, shield: false } }
```
