# Smith’s Tools
**Type:** Tool
**Cost:** 20 GP
**Source:** SRD 5.2.1, p. 93
**Ability:** Strength
**Weight:** 8 lb.
**Utilize:** Pry open a door or container (DC 20)
**Craft:** Any Melee weapon (except Club, Greatclub, Quarterstaff, and Whip), Medium armor (except Hide), Heavy armor, Ball Bearings, Bucket, Caltrops, Chain, Crowbar, Firearm Bullets, Grappling Hook, Iron Pot, Iron Spikes, Sling Bullets

## Effects
```yaml
- action:
    activation: utilize
    label: Pry open a door or container
    check: {tool: self, ability: str, dc: 20}
- craft:
    items: [any-melee-weapon-except-club, greatclub, quarterstaff, and-whip, medium-armor-except-hide, heavy-armor, ball-bearings, bucket, caltrops, chain, crowbar, firearm-bullets, grappling-hook, iron-pot, iron-spikes, sling-bullets]
```
