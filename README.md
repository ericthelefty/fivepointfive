# fivepointfive

An open-source character builder and sheet for fifth edition (2024 rules) tabletop roleplaying games, built on the System Reference Document 5.2.1. Players can add their own content as plain Markdown files.

> **Status:** early. This repository currently holds the game content, the content format, and the tools used to produce it. The app itself is next.

## What's here

| Folder | What it is |
|---|---|
| [`content/srd-5.2.1/`](content/srd-5.2.1/) | The complete SRD 5.2.1 as 1,317 Markdown entries: classes, subclasses, species, backgrounds, feats, spells, equipment, magic items, creatures, the rules glossary and the rules chapters. Wording is unchanged from the source. |
| [`docs/CONTENT_FORMAT.md`](docs/CONTENT_FORMAT.md) | How content files are written. The same format is used for the SRD and for anything users import. |
| [`tools/pdf2md/`](tools/pdf2md/) | The converter that turned the SRD PDF into those files, written to be reused for other source documents. |

## Planned

1. **Builder:** step-by-step character creation from SRD content, plus import of `.md` content files with a preview that auto-fixes simple formatting problems and suggests fixes for the rest.
2. **Accounts and sharing:** friends can view each other's characters and make their own copies.
3. **Pack sharing:** share uploaded content packs with friends or groups.

## Adding your own content

Content is plain `.md` files you can write in any text editor. See [`docs/CONTENT_FORMAT.md`](docs/CONTENT_FORMAT.md) for the format and templates.

## License

- **SRD content** (`content/srd-5.2.1/`) is licensed under CC-BY-4.0. See [`content/srd-5.2.1/LICENSE.md`](content/srd-5.2.1/LICENSE.md).
- **Code and documentation:** license to be chosen.

This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

fivepointfive is an independent project, not affiliated with or endorsed by Wizards of the Coast.
