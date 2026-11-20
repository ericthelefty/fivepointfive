# pdf2md — converting a rulebook PDF into a content pack

A repeatable three-stage process. The SRD 5.2.1 pack in `content/srd-5.2.1/` was produced with it.

```
PDF ──extract.py──▶ master.md ──split.py──▶ content pack folder ──coverage.py──▶ completeness report
```

Requires Python 3.10+ and PyMuPDF (`pip install pymupdf`).

## 1. Survey the fonts

```
python survey_fonts.py book.pdf
```

Lists every (font, size, color) combination with character counts and an example. From this you can tell which fonts are chapter headings, section headings, body text, table cells, and stat blocks.

## 2. Extract → master.md

```
python extract.py book.pdf master.md            # whole book
python extract.py book.pdf test.md 28-29        # just pages 28–29, for tuning
```

Rebuilds reading order, headings, paragraphs, bold/italic, bullet lists, tables (using text positions, plus row shading where present), and creature ability tables. Each page is marked with `<!-- p.N -->` so entries can cite their page.

**To adapt to a new book:** copy the `SRD521` style map at the top of `extract.py` and change:

| Setting | What it means |
|---|---|
| `headings` | font name prefix + size range → heading level 1–6 |
| `table_fonts` | fonts used for table cells |
| `field_line` | labels that start "field" lines (e.g. `Casting Time:`) |
| `footer_y` | y position below which text is a running footer |

## 3. Split → content pack

```
python split.py master.md out/
```

Builds a heading tree and uses a **rule table** (`SRD521_RULES`) to decide which headings are entries: e.g. "every level-4 heading under *Spell Descriptions* is a Spell, written to `spells/`". Every line of the master file goes into exactly one output file; text that isn't an entry goes to `rules/<chapter>/<section>.md`, so nothing is dropped.

It also:

- adds `**Type:**`, `**Source:** <pack>, p. N`, and where relevant `**Parent:**` (subclasses), `**Group:**` (creatures), and `**Cost:**` (gear and tools, taken from the heading);
- converts a class's "Core *X* Traits" table into field lines;
- re-levels headings so each entry starts at `#`;
- moves tables and stat blocks that the page layout placed next to the wrong entry to the entry that refers to them ("…uses the **Otherworldly Steed** stat block");
- applies source-specific `PATCHES` for layout quirks (sidebars extracted before their chapter heading).

**To adapt to a new book:** write a new rule table and patch list.

## 4. Verify

```
python coverage.py book.pdf out/
```

Compares the multiset of words in the PDF with the words in the output. For SRD 5.2.1 the only differences are expected ones: the `MOD`/`SAVE` labels (replaced by table headers), page numbers, duplicate creature-group headings, and words hyphenated across line breaks that the checker itself splits differently.

## Known limits

- Tables with merged or spanning header cells come out flattened (all text is kept; layout may need a manual touch).
- Two side-by-side tables that share a row band are emitted as one wide table.
- Scanned (image-only) PDFs need OCR first.
