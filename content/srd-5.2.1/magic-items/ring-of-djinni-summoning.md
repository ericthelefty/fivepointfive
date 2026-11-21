# Ring of Djinni Summoning
**Type:** Magic Item
**Source:** SRD 5.2.1, p. 237
*Ring, Legendary (Requires Attunement)*

While wearing this ring, you can take a Magic action to summon a particular **Djinni** from the Elemental Plane of Air. The djinni appears in an unoccupied space you choose within 120 feet of yourself. It remains as long as you maintain Concentration, to a maximum of 1 hour, or until it drops to 0 Hit Points.

While summoned, the djinni is Friendly to you and your allies, and it obeys your commands. If you fail to command it, the djinni defends itself against attackers but takes no other actions.

After the djinni departs, it can’t be summoned again for 24 hours, and the ring becomes nonmagical if the djinni dies.

*Rings of Djinni Summoning* are often created by the djinn they summon and given to mortals as gifts of friendship or tokens of esteem.

## Effects
```yaml
- action: { activation: magic, summon: { creature: $srd/monsters/djinni, duration: { amount: 1, unit: hour, concentration: true } }, lockout: { amount: 24, unit: hour },
            text: "The ring becomes nonmagical if the djinni dies." }
```
