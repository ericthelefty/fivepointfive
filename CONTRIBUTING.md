# Contributing to fivepointfive

Thanks for helping. Bug reports, rules fixes, content conversions and code are all welcome.

## Setting up

```bash
npm install
npm run dev      # http://localhost:5173, local-only mode (browser storage)
npm test         # unit tests, guide checks and repo checks
npm run build    # type-check and production build
```

To work on shared-instance features, put your own Supabase project's values in `.env.local` (see [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md)).

## Reporting a bug

Open an issue with what you did, what you expected and what happened. For a rules bug, name the class, subclass, species, background or feat, the character level, and the rule as written. A comparison with another tool (such as D&D Beyond) helps.

## Pull requests

1. Branch from `main` and keep the change focused.
2. Run `npm test` and `npm run build`. GitHub runs both on every pull request.
3. Add a test for a rules fix, ideally in `src/lib/forms.test.ts` or `src/lib/modif.test.ts`.
4. Add a line to the **Unreleased** section of [`CHANGELOG.md`](CHANGELOG.md) saying what changed, in plain words.

### Changing the database

Instance data lives in Supabase. Never edit a migration that has already shipped; add a new file instead:

1. Name it `supabase/migrations/NNNN_short_name.sql`, numbered after the last one, and make it safe to run on an existing instance (`if not exists`, `create or replace`, `drop policy if exists`).
2. List it in step 1 of [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md) and in the changelog entry's **Database** line, so instance admins know to run it.

`npm test` fails if a migration isn't listed in the self-hosting guide.

### Releasing a version

1. Choose the new number ([semantic versioning](https://semver.org/): while it's 0.x, bump the minor number for new features and the patch number for fixes).
2. Set it in `package.json` (`npm version <number> --no-git-tag-version` also updates the lockfile).
3. Rename **Unreleased** in `CHANGELOG.md` to `<number> (<date>)`, add its **Database** line, and start a new empty **Unreleased** section.
4. Update the **Status** line at the top of the README.

`npm test` checks that the README, `package.json` and the changelog agree on the version.

## Content

- Content is Markdown, in the format described in [`docs/CONTENT_FORMAT.md`](docs/CONTENT_FORMAT.md). Rules that the sheet applies are written in Modif ([`docs/MODIF.md`](docs/MODIF.md), with recipes in [`docs/MODIF_COOKBOOK.md`](docs/MODIF_COOKBOOK.md)).
- Only freely licensed content goes in this repository. The SRD 5.2.1 is CC-BY-4.0. **Don't commit text from books that aren't openly licensed** (the Player's Handbook, Dungeon Master's Guide, Monster Manual and other published books). Players import that content into their own copy as a content pack.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE). SRD content stays under CC-BY-4.0.
