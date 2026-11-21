# Cloak of Displacement
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 215
*Wondrous Item, Rare (Requires Attunement)*

While you wear this cloak, it magically projects an illusion that makes you appear to be standing in a place near your actual location, causing any creature to have Disadvantage on attack rolls against you. If you take damage, the property ceases to function until the start of your next turn. This property is suppressed while your Speed is 0.

## Effects
```yaml
- disadvantage: { roll: attacks-against-you, when: { not: { speed: "== 0" } } }
- trigger: { event: damaged, auto: true, offer: { suppress: { target: self, until: start-of-next-turn } } }
```
