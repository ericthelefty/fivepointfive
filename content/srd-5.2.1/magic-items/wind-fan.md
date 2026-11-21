# Wind Fan
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 253
*Wondrous Item, Uncommon*

While holding this fan, you can cast *Gust of Wind* (save DC 13) from it. Each subsequent time the fan is used before the next dawn, it has a cumulative 20 percent chance of not working; if the fan fails to work, it tears into useless, nonmagical tatters.

## Effects
```yaml
- action: { cast: $srd/spells/gust-of-wind, overrides: { dc: 13 }, counter: { reset: dawn },
            then: { if: "uses >= 1", roll: 1d100, if-roll: "<= 20 * uses", text: "The fan fails and tears to tatters." } }
```
