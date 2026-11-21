# Human
**Type:** Species
**Source:** SRD 5.2.1, p. 86
**Creature Type:** Humanoid
**Size:** Medium (about 4–7 feet tall) or Small (about 2–4 feet tall), chosen when you select this species
**Speed:** 30 feet

As a Human, you have these special traits.

## Effects
```yaml
- choose: { id: size, kind: size, count: 1, from: [medium, small] }
```

## Resourceful

You gain Heroic Inspiration whenever you finish a Long Rest.

## Effects
```yaml
- trigger: { event: { rest: long }, auto: true, offer: { regain: { resource: heroic-inspiration, to: 1 } } }
```

## Skillful

You gain proficiency in one skill of your choice.

## Effects
```yaml
- choose: { id: skillful, kind: skill, count: 1, grants: proficiency, from: any }
```

## Versatile

You gain an Origin feat of your choice (see “Feats”). Skilled is recommended.

## Effects
```yaml
- choose: { id: versatile, kind: feat, count: 1, from: { feat: { category: origin } }, default: $srd/feats/skilled }
```
