# Horn of Blasting
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 226
*Wondrous Item, Rare*

You can take a Magic action to blow the horn, which emits a thunderous blast in a 30-foot Cone that is audible out to 600 feet. Each creature in the Cone makes a DC 15 Constitution saving throw. On a failed save, a creature takes 5d8 Thunder damage and has the Deafened condition for 1 minute. On a successful save, a creature takes half as much damage only. Glass or crystal objects in the Cone that aren’t being worn or carried take 10d8 Thunder damage.

Each use of the horn’s magic has a 20 percent chance of causing the horn to explode. The explosion deals 10d6 Force damage to the user and destroys the horn.

## Effects
```yaml
- action: { activation: magic, area: { shape: cone, size: 30 }, save: { ability: con, dc: 15, success: half }, damage: { dice: 5d8, type: thunder },
            on-failure: { apply: { condition: deafened, duration: { amount: 1, unit: minute } } },
            then: { always: true, roll: 1d100, if-roll: "<= 20", text: "The horn explodes: 10d6 Force damage to you; it's destroyed." } }
```
