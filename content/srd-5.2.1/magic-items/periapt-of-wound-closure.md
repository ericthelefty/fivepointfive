# Periapt of Wound Closure
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 234
*Wondrous Item, Uncommon (Requires Attunement)*

While wearing this pendant, you gain the following benefits.

***Life Preservation.*** Whenever you make a Death Saving Throw, you can change a roll of 9 or lower to a 10, turning a failed save into a successful one.

***Natural Healing Boost.*** Whenever you roll a Hit Point Die to regain Hit Points, double the number of Hit Points it restores.

## Effects
```yaml
- treat-roll: { roll: death-save, range: [1, 9], as: 10, optional: true }
- set: { to: hit-die-healing, value: 2, mode: multiply }
```
