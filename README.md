# fivepointfive

An open-source character builder and sheet for fifth edition (2024 rules) tabletop roleplaying games, built on the System Reference Document 5.2.1. Players can add their own content as plain Markdown files.

> **Status:** v0.3.0. Builder (including multiclassing), a play sheet that applies the rules automatically, inventory, `.md` and `.zip` content packs, and shared instances: one admin invites their group, and everyone sees and plays the same characters and content. See the [changelog](CHANGELOG.md).

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

| Folder | What it is |
|---|---|
| [`content/srd-5.2.1/`](content/srd-5.2.1/) | The complete SRD 5.2.1 as 1,317 Markdown entries: classes, subclasses, species, backgrounds, feats, spells, equipment, magic items, creatures, the rules glossary and the rules chapters. Wording is unchanged from the source. |
| [`docs/CONTENT_FORMAT.md`](docs/CONTENT_FORMAT.md) | How content files are written. The same format is used for the SRD and for anything users import. |
| [`docs/MODIF.md`](docs/MODIF.md) | Modif, the YAML format for `## Effects` blocks that lets the sheet apply rules automatically (draft spec). |
| [`docs/CONVERTING_TO_MODIF.md`](docs/CONVERTING_TO_MODIF.md) | How to convert entries to Modif (written as a prompt for an agent), with the tools in `tools/` and drafts in `encodings/`. |
| [`src/`](src/) | The web app (Vite + React + TypeScript). `src/lib/parse.ts` reads content files, `src/lib/fix.ts` checks and fixes imports, `src/lib/rules.ts` turns entries into builder choices. |
| [`tools/pdf2md/`](tools/pdf2md/) | The converter that turned the SRD PDF into those files, written to be reused for other source documents. |

## Contributing

Bug reports and pull requests are welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for setup, tests, database migrations and releases.

## Adding your own content

Content is plain `.md` files you can write in any text editor. See [`docs/CONTENT_FORMAT.md`](docs/CONTENT_FORMAT.md) for the format and templates.

## License

- **SRD content** (`content/srd-5.2.1/`) is licensed under CC-BY-4.0. See [`content/srd-5.2.1/LICENSE.md`](content/srd-5.2.1/LICENSE.md).
- **Code and documentation:** [MIT](LICENSE).

This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

fivepointfive is an independent project, not affiliated with or endorsed by Wizards of the Coast.
