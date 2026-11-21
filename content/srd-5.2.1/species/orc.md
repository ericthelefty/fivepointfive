# Orc
**Type:** Species
**Source:** SRD 5.2.1, p. 86
**Creature Type:** Humanoid
**Size:** Medium (about 6–7 feet tall)
**Speed:** 30 feet

As an Orc, you have these special traits.

## Adrenaline Rush

You can take the Dash action as a Bonus Action. When you do so, you gain a number of Temporary Hit Points equal to your Proficiency Bonus.

You can use this trait a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Short or Long Rest.

## Effects
```yaml
- resource: { id: adrenaline-rush, max: prof, reset: short }
- action: { id: adrenaline-rush, activation: bonus, take: dash, cost: { resource: $#adrenaline-rush }, temp-hp: prof }
```

## Darkvision

You have Darkvision with a range of 120 feet.

## Effects
```yaml
- sense: { darkvision: 120 }
```

## Relentless Endurance

When you are reduced to 0 Hit Points but not killed outright, you can drop to 1 Hit Point instead. Once you use this trait, you can’t do so again until you finish a Long Rest.

## Effects
```yaml
- trigger: { event: zero-hp, if: "You aren't killed outright", per: long, offer: { set-hp: 1 } }
```
