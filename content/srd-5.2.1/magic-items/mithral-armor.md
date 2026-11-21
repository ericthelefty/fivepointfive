# Mithral Armor
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 231
*Armor (Any Medium or Heavy, Except Hide Armor), Uncommon*

Mithral is a light, flexible metal. Armor made of this substance can be worn under normal clothes. If the armor normally imposes Disadvantage on Dexterity (Stealth) checks or has a Strength requirement, the mithral version of the armor doesn’t.

## Effects
```yaml
- modify: { target: self.base, set: { stealth-disadvantage: false, strength-requirement: 0 } }
```
