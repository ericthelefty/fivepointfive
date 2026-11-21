# Eversmoking Bottle
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 220
*Wondrous Item, Uncommon*

As a Magic action, you can open or close this bottle.

Opening the bottle causes thick smoke to billow out, forming a cloud that fills a 60-foot Emanation originating from the bottle. The area within the smoke is Heavily Obscured.

Each minute the bottle remains open, the size of the Emanation increases by 10 feet until it reaches its maximum size of 120 feet.

Closing the bottle causes the cloud to become fixed in place until it disperses after 10 minutes. A strong wind (such as that created by the *Gust of Wind* spell) disperses the cloud after 1 minute.

## Effects
```yaml
- toggle: { activation: magic, effects: [ { zone: { area: { shape: emanation, size: 60, grows: { per: minute, add: 10, max: 120 } }, effects: [ { trait: [heavily-obscured] } ] } } ] }
```
