# fivepointfive

An open-source, **5.5E compatible** character builder and play sheet for tabletop roleplaying games using the 2024 rules, built on the System Reference Document 5.2.1. It works with older 5E content too. All of its rules come from plain Markdown files, so players and groups can add their own content and have the sheet apply it.

> **Status:** v0.4.0. Builder (with multiclassing), a play sheet that applies the rules automatically, inventory, `.md` and `.zip` content packs, and shared instances where a group plays the same characters live, with encounters for the GM. See the [changelog](CHANGELOG.md).

**Try it without signing in:** open `/demo` on any copy of the app (for example the one you run locally). It opens a sample character, and anything you make stays in your browser.

## What it does

- **Builder:** species, class (and multiclass), background, ability scores, skills, spells, feats and starting equipment from the SRD 5.2.1 or any content pack, with every choice a feature asks for.
- **Play sheet:** click any ability, save, skill or attack to roll, with Advantage and Disadvantage, 3D dice and a game log. Hit Points, rests, Hit Dice, spell slots, limited uses, conditions and effects are tracked, and class features, feats, spells and magic items are applied automatically (a +3 staff shows up at the right attack bonus, Rage adds its damage, a Long Rest brings back what it should).
- **Explainer mode:** switch it on and hover over (or tap) any number to see how it's worked out, where it comes from and how to change it.
- **Phones:** a layout made for one hand, with a header that stays on screen, one section at a time, and dice and the game log a thumb away.
- **Groups:** on a shared instance, one admin invites the group. Everyone sees the same characters, and a change on one screen shows up on every other within a second or two. The GM builds and runs encounters from the SRD's monsters and the party, and can give a character to a player.
- **Your own content:** write a class, subclass, species, feat, spell or item as a Markdown file and import it. The app checks it and offers fixes.

## Modif: rules as data

Content is Markdown that anyone can read. What makes the sheet able to *apply* it is **Modif**, a small open format for the `## Effects` block under each feature. The rules text stays for the player; the Effects block says the same thing for the app:

````markdown
### Level 1: Second Wind

You have a limited well of physical and mental stamina that you can draw on. As a Bonus Action, you can use it to regain Hit Points equal to 1d10 plus your Fighter level. …

## Effects
```yaml
- resource: { id: second-wind, max: table:Second Wind, reset: long, partial: { at: short, amount: 1 } }
- action: { id: second-wind, activation: bonus, cost: { resource: $#second-wind }, heal: 1d10 + level:fighter }
```
````

From those two lines the sheet shows a Second Wind button with its uses, rolls the healing, spends a use and gives it back on the right rest. Modif has about 70 blocks like these (bonuses, choices, resources, actions, toggles, spells, triggers), so an app writes code once per block, not once per feature, and homebrew written in Modif works without new code. For the rare rule no block covers, a `custom` block names a hand-coded handler and always carries the rule as text.

The whole character side of the SRD 5.2.1 is written in Modif: every class, subclass, species, background and feat, all 339 spells and all 258 magic items. Modif is licensed CC-BY-4.0 so other apps can use it too.

- [`docs/MODIF.md`](docs/MODIF.md): the spec, starting with what Modif is and where to begin.
- [`docs/MODIF_COOKBOOK.md`](docs/MODIF_COOKBOOK.md): common rules phrases and the blocks that express them.
- [`tools/modif_check.py`](tools/modif_check.py) and [`tools/modif.schema.json`](tools/modif.schema.json): the validator and a JSON Schema for editors.

## Two ways to run it

- **Local-only:** no setup. Everything is saved in your browser.
- **Shared instance:** one person sets it up with a free Supabase project and invites their group. Everyone in the instance sees all characters and content packs; members edit their own, the admin can edit anything. See [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md).

## Run it locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # parser, import, rules and repo checks
npm run build    # production build in dist/ (what Vercel runs)
```

`npm run dev` and `npm run build` first compile the content packs in `content/` into JSON in `public/data/` (see `scripts/build-content.ts`).

## What's here

| Folder or file | What it is |
|---|---|
| [`content/srd-5.2.1/`](content/srd-5.2.1/) | The complete SRD 5.2.1 as 1,317 Markdown entries: classes, subclasses, species, backgrounds, feats, spells, equipment, magic items, creatures, the rules glossary and the rules chapters. Wording is unchanged from the source; the Effects blocks are added. |
| [`docs/CONTENT_FORMAT.md`](docs/CONTENT_FORMAT.md) | How content files are written, with templates. The same format is used for the SRD and for anything users import. |
| [`docs/MODIF.md`](docs/MODIF.md), [`docs/MODIF_COOKBOOK.md`](docs/MODIF_COOKBOOK.md), [`docs/MODIF_CHANGES.md`](docs/MODIF_CHANGES.md) | The Modif spec, its authoring guide and its version history. |
| [`docs/CONVERTING_TO_MODIF.md`](docs/CONVERTING_TO_MODIF.md), [`docs/PROMPT_CONVERT_FOR_IMPORT.md`](docs/PROMPT_CONVERT_FOR_IMPORT.md) | How to convert a book or homebrew to Modif, including a prompt for an AI assistant. |
| [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md) | Setting up a shared instance for a group. |
| [`src/`](src/) | The web app (Vite + React + TypeScript). `src/lib/parse.ts` reads content files, `src/lib/modif.ts` applies Effects blocks, `src/lib/custom/` holds the hand-coded handlers, `src/lib/fix.ts` checks and fixes imports. |
| [`tools/`](tools/) | The Modif validator and schema, and [`pdf2md/`](tools/pdf2md/), the converter that turned the SRD PDF into Markdown. |
| [`supabase/migrations/`](supabase/migrations/) | The database for shared instances. |

## Contributing

Bug reports and pull requests are welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for setup, tests, database migrations and releases.

## License

- **SRD content** (`content/srd-5.2.1/`) and **Modif** are licensed under CC-BY-4.0. See [`content/srd-5.2.1/LICENSE.md`](content/srd-5.2.1/LICENSE.md).
- **Code and the rest of the documentation:** [MIT](LICENSE).

This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

fivepointfive is an independent project, not affiliated with or endorsed by Wizards of the Coast.
