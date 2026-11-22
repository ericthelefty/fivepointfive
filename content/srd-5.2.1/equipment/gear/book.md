# Book
**Type:** Gear
**Cost:** 25 GP
**Weight:** 5 lb.
**Source:** SRD 5.2.1, p. 96

A Book contains fiction or nonfiction. If you consult an accurate nonfiction Book about its topic, you gain a +5 bonus to Intelligence (Arcana, History, Nature, or Religion) checks you make about that topic.

## Effects
```yaml
- bonus: { to: [skill:arcana, skill:history, skill:nature, skill:religion], value: 5, when: { player: "Consulting an accurate book on the topic" } }
```
