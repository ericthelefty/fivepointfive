#!/usr/bin/env python3
"""Stage 1: PDF -> faithful master Markdown.

Reads a PDF with PyMuPDF and rebuilds headings, paragraphs, inline styling,
tables, and stat-block ability tables from font and position data.

The style map (STYLE) is the only part tuned to a particular source document;
to convert another PDF, survey its fonts (see survey_fonts.py) and write a new
style map.

Usage: extract.py input.pdf output.md [--style srd521]
"""
import re
import sys
import json
import pymupdf

# ---------------------------------------------------------------- style map --
# (font-prefix, size) -> role.  Roles: h1..h6, body, table, label, footer, abil
SRD521 = {
    "footer_y": 740,
    "headings": [
        # (font startswith, min size, max size, level)
        ("GillSans-SemiBold", 25.0, 27.0, 1),
        ("GillSans-SemiBold", 17.5, 18.5, 2),
        ("GillSans-SemiBold", 13.5, 15.0, 3),
        ("GillSans-BoldItalic", 14.0, 15.0, 3),
        ("GillSans-SemiBold-SC700", 11.5, 12.5, 4),
        ("GillSans-SemiBold", 11.5, 12.5, 4),
        ("GillSans-Bold-SC700", 10.5, 11.5, 5),
        ("GillSans-SemiBold", 10.3, 10.7, 5),
        ("GillSans", 11.5, 12.5, 6),          # stat block sections (Traits, Actions)
    ],
    # fonts whose lines are candidate table cells
    "table_fonts": [("GillSans", 8.9, 9.6)],
    # lines matching these are field lines, not tables, even in table fonts
    "field_line": re.compile(r"^(Casting Time|Range|Components|Duration):"),
}

BULLET = "•"


def style_of(font):
    f = font.lower()
    bold = any(k in f for k in ("bold", "semibold", "-sb", "black", "heavy"))
    ital = "italic" in f or "oblique" in f
    return ("b" if bold else "") + ("i" if ital else "")


def heading_level(span, S):
    f, sz = span["font"], span["size"]
    best = None
    for pre, lo, hi, lvl in S["headings"]:
        if f.startswith(pre) and lo <= sz <= hi:
            # prefer longest matching prefix
            if best is None or len(pre) > best[0]:
                best = (len(pre), lvl)
    if best and (f.startswith("GillSans") and (f == "GillSans" or "Semi" in f or "Bold" in f)):
        # plain 'GillSans' regular only counts for the exact size-12 rule
        if f == "GillSans" and not (11.5 <= sz <= 12.5):
            return None
        return best[1]
    return None


def is_table_font(span, S):
    for pre, lo, hi in S["table_fonts"]:
        if span["font"].startswith(pre) and lo <= span["size"] <= hi:
            return True
    return False


# ------------------------------------------------------------ line stream --
def clean_spans(spans):
    out = []
    for s in spans:
        t = s["text"].replace("­", "")
        if not t:
            continue
        out.append(dict(text=t, font=s["font"], size=round(s["size"], 1),
                        bbox=s["bbox"], color=s["color"]))
    return out


def page_lines(page, S):
    lines = []
    for b in page.get_text("dict")["blocks"]:
        if "lines" not in b:
            continue
        for l in b["lines"]:
            spans = clean_spans(l["spans"])
            if not spans or not "".join(s["text"] for s in spans).strip():
                continue
            if l["bbox"][1] >= S["footer_y"]:
                continue
            lines.append(dict(bbox=l["bbox"], spans=spans))
    return lines


def first_real(spans):
    for s in spans:
        if s["text"].strip():
            return s
    return spans[0]


def classify(line, S):
    sp = line["spans"]
    fr = first_real(sp)
    txt = "".join(s["text"] for s in sp)
    if any(s["font"].startswith("GillSans") and s["size"] <= 6.5 and s["text"].strip() in ("MOD", "SAVE") for s in sp) \
            or (fr["font"].startswith("GillSans") and abs(fr["size"] - 9.8) < 0.05):
        return "abil"
    lvl = heading_level(fr, S)
    if lvl:
        return "h%d" % lvl
    if S["field_line"].match(txt.strip()):
        return "field"
    if fr["font"].startswith("GillSans") and "b" in style_of(fr["font"]) \
            and re.fullmatch(r"[A-Z][A-Za-z ’'()/-]{0,30}:\s*", fr["text"].strip() + " "):
        return "field"
    if is_table_font(fr, S):
        return "table"
    return "body"


# ------------------------------------------------------------- inline text --
def render_spans(spans):
    """Merge spans by style and wrap with Markdown emphasis."""
    runs = []
    for s in spans:
        t = s["text"].replace("\t", " ")
        st = style_of(s["font"])
        if not t.strip() or (runs and re.fullmatch(r"[\s.,:;)\]]+", t)):
            st = runs[-1][0] if runs else ""
        if runs and runs[-1][0] == st:
            runs[-1][1] += t
        else:
            runs.append([st, t])
    out = []
    for st, t in runs:
        if not st or not t.strip():
            out.append(t)
            continue
        m = re.match(r"^(\s*)(.*?)(\s*)$", t, re.S)
        lead, core, trail = m.groups()
        mark = {"b": "**", "i": "*", "bi": "***"}[st]
        out.append(f"{lead}{mark}{core}{mark}{trail}")
    s = "".join(out)
    # tidy adjacent markers like **A****B**
    s = s.replace("****", "").replace("**  **", " ")
    return s


# ------------------------------------------------------------------ tables --
def words_in(page, rect):
    ws = page.get_text("words", clip=rect)
    # (x0,y0,x1,y1,word,block,line,wordno) ; keep those whose centre is inside
    out = []
    for w in ws:
        cx, cy = (w[0] + w[2]) / 2, (w[1] + w[3]) / 2
        if rect.x0 - 1 <= cx <= rect.x1 + 1 and rect.y0 - 1 <= cy <= rect.y1 + 1:
            out.append(w)
    return out


def word_bold(page_spans, w):
    cx, cy = (w[0] + w[2]) / 2, (w[1] + w[3]) / 2
    for s in page_spans:
        x0, y0, x1, y1 = s["bbox"]
        if x0 - .5 <= cx <= x1 + .5 and y0 - .5 <= cy <= y1 + .5:
            return "b" in style_of(s["font"])
    return False


def cluster_rows(words, tol=3.0):
    rows = []
    for w in sorted(words, key=lambda w: ((w[1] + w[3]) / 2, w[0])):
        cy = (w[1] + w[3]) / 2
        if rows and abs(rows[-1]["cy"] - cy) <= tol:
            rows[-1]["w"].append(w)
        else:
            rows.append(dict(cy=cy, w=[w]))
    for r in rows:
        r["w"].sort(key=lambda w: w[0])
    return rows


def column_edges(rows, min_gap=4.5):
    """Find x-gaps that no word crosses (in body rows)."""
    if not rows:
        return []
    xs = []
    def clusters(r):
        n, end = 0, None
        for w in r["w"]:
            if end is None or w[0] - end >= min_gap:
                n += 1
            end = w[2] if end is None else max(end, w[2])
        return n
    multi = [r for r in rows if clusters(r) > 1] or rows
    for r in multi:
        for w in r["w"]:
            xs.append((w[0], w[2]))
    xs.sort()
    cuts = []
    cur_end = xs[0][1]
    for x0, x1 in xs[1:]:
        if x0 - cur_end >= min_gap:
            cuts.append((cur_end + x0) / 2)
        cur_end = max(cur_end, x1)
    return cuts


def build_table(page, rect, page_spans, line_rows=None, line_rects=None):
    ws = words_in(page, rect)
    if line_rects:
        def inside(w):
            cx, cy = (w[0] + w[2]) / 2, (w[1] + w[3]) / 2
            return any(r.x0 - 1 <= cx <= r.x1 + 1 and r.y0 - 1 <= cy <= r.y1 + 1 for r in line_rects)
        ws = [w for w in ws if inside(w)]
    if not ws:
        return None
    rows = cluster_rows(ws)
    for r in rows:
        r["bold"] = all(word_bold(page_spans, w) for w in r["w"])
    # header = leading bold rows
    nh = 0
    while nh < len(rows) and rows[nh]["bold"] and nh < 3:
        nh += 1
    if nh == len(rows):
        nh = 0
    body = rows[nh:]
    cuts = column_edges(body)
    ncol = len(cuts) + 1
    if ncol < 2:
        return None  # not a table: prose in a sidebar font

    def col_of(w):
        cx = w[0]  # left edge decides column (handles right-aligned numbers poorly but ok)
        cx = (w[0] + w[2]) / 2 if ncol > 1 else w[0]
        for i, c in enumerate(cuts):
            if cx < c:
                return i
        return ncol - 1

    def cells(r):
        c = [[] for _ in range(ncol)]
        for w in r["w"]:
            c[col_of(w)].append(w[4])
        return [" ".join(x) for x in c]

    header = [""] * ncol
    span_label = [""] * ncol
    col_centers = []
    for i in range(ncol):
        xs = [((w[0] + w[2]) / 2) for r in body for w in r["w"] if col_of(w) == i]
        col_centers.append(sum(xs) / len(xs) if xs else None)
    for r in rows[:nh]:
        # phrases: runs of words separated by small gaps
        phrases, cur = [], []
        for w in r["w"]:
            if cur and w[0] - cur[-1][2] >= 4.5:
                phrases.append(cur)
                cur = []
            cur.append(w)
        if cur:
            phrases.append(cur)
        rest = []
        for ph in phrases:
            x0, x1 = ph[0][0], ph[-1][2]
            covered = [i for i in range(ncol) if col_centers[i] is not None
                       and x0 - 8 <= col_centers[i] <= x1 + 8]
            if len(covered) >= 2:
                label = re.sub(r"^[—–-]+|[—–-]+$", "", " ".join(w[4] for w in ph)).strip()
                for i in covered:
                    span_label[i] = label
            else:
                rest.extend(ph)
        rr = dict(r, w=rest)
        for i, t in enumerate(cells(rr)):
            if t:
                header[i] = (header[i] + " " + t).strip()
    for i in range(ncol):
        if span_label[i]:
            header[i] = (span_label[i] + " " + header[i]).strip()
    out = []
    # row bands from shading, if provided
    if line_rows:
        bands = []
        for r in body:
            b = next((i for i, (y0, y1) in enumerate(line_rows) if y0 - 1 <= r["cy"] <= y1 + 1), None)
            bands.append(b)
    else:
        bands = [None] * len(body)
    # line pitch: wrapped cell lines sit closer together than table rows
    cys = [r["cy"] for r in body]
    pitches = [b - a for a, b in zip(cys, cys[1:])]
    thresh = None
    if pitches and min(pitches) > 0 and max(pitches) / min(pitches) > 1.18:
        thresh = (min(pitches) + max(pitches)) / 2
    prev_band = object()
    prev_cy = None
    for r, band in zip(body, bands):
        c = cells(r)
        cont = False
        if out:
            if band is not None:
                cont = band == prev_band
            elif thresh is not None and prev_cy is not None:
                cont = (r["cy"] - prev_cy) < thresh
            elif not c[0].strip():
                cont = True
        prev_cy = r["cy"]
        if cont:
            for i, t in enumerate(c):
                if t:
                    out[-1][i] = join_wrap(out[-1][i], t)
        else:
            out.append(c)
        prev_band = band
    return dict(header=header if nh else None, rows=out)


def join_wrap(a, b):
    if not a:
        return b
    if a.endswith("-") and len(a) > 1 and a[-2].isalpha() and b[:1].islower():
        return a[:-1] + b
    return a + " " + b


def table_md(t):
    def esc(x):
        return x.replace("|", "\\|").strip()
    ncol = len(t["rows"][0]) if t["rows"] else len(t["header"] or [])
    hdr = t["header"] or [""] * ncol
    lines = ["| " + " | ".join(esc(h) for h in hdr) + " |",
             "|" + "|".join(["---"] * ncol) + "|"]
    for r in t["rows"]:
        lines.append("| " + " | ".join(esc(x) for x in r) + " |")
    return "\n".join(lines)


# --------------------------------------------------- monster ability table --
ABIL = ["Str", "Dex", "Con", "Int", "Wis", "Cha"]


def ability_md(text):
    t = text.replace("\t", " ").replace("−", "-")
    t = re.sub(r"\b(MOD|SAVE)\b", " ", t)
    out = []
    for i, a in enumerate(ABIL):
        nxt = ABIL[i + 1] if i + 1 < len(ABIL) else None
        m = re.search(a + r"\s+(.*?)" + (r"(?=\b" + nxt + r"\b)" if nxt else "$"), t, re.S)
        if not m:
            return None
        nums = m.group(1).split()
        if len(nums) != 3:
            return None
        out.append((a, nums))
    lines = ["| | Score | Mod | Save |", "|---|---|---|---|"]
    for a, (sc, mo, sv) in out:
        fx = lambda s: s.replace("-", "−")
        lines.append(f"| {a} | {sc} | {fx(mo)} | {fx(sv)} |")
    return "\n".join(lines)


# ------------------------------------------------------------------- main --
def extract(pdf_path, S=SRD521, pages=None):
    doc = pymupdf.open(pdf_path)
    items = []  # (kind, payload, page)
    pr = range(len(doc)) if pages is None else [p - 1 for p in pages]
    for pno in pr:
        page = doc[pno]
        lines = page_lines(page, S)
        page_spans = [s for l in lines for s in l["spans"]]
        shaded = [t for t in page.find_tables(strategy="lines").tables]
        shaded_rects = [pymupdf.Rect(t.bbox) for t in shaded]
        for l in lines:
            l["kind"] = classify(l, S)
            r = pymupdf.Rect(l["bbox"])
            if l["kind"] in ("body",) and first_real(l["spans"])["font"].startswith("GillSans") \
                    and any(sr.contains(r) for sr in shaded_rects):
                l["kind"] = "table"
        # group consecutive table / abil lines
        i = 0
        while i < len(lines):
            l = lines[i]
            k = l["kind"]
            if k in ("table", "abil"):
                j = i
                gx0, gx1, gtop = l["bbox"][0], l["bbox"][2], l["bbox"][1]
                mid = page.rect.width / 2
                while j + 1 < len(lines) and lines[j + 1]["kind"] == k:
                    nb = lines[j + 1]["bbox"]
                    if nb[1] < gtop - 25:
                        break
                    gx0, gx1, gtop = min(gx0, nb[0]), max(gx1, nb[2]), min(gtop, nb[1])
                    j += 1
                grp = lines[i:j + 1]
                rect = pymupdf.Rect(grp[0]["bbox"])
                for g in grp[1:]:
                    rect |= pymupdf.Rect(g["bbox"])
                if k == "abil":
                    txt = " ".join("".join(s["text"] for s in g["spans"]) for g in grp)
                    # small caps split 'S'+'tr' -> join letters
                    txt = re.sub(r"\b([SDCIWC])\s?(tr|ex|on|nt|is|ha)\b", r"\1\2", txt)
                    md = ability_md(txt)
                    items.append(("table_md", md or txt, pno + 1))
                else:
                    sr = next((t for t in shaded if pymupdf.Rect(t.bbox).intersects(rect)), None)
                    bands = None
                    if sr is not None:
                        rect |= pymupdf.Rect(sr.bbox)
                        bands = [(row.bbox[1], row.bbox[3]) for row in sr.rows]
                    t = build_table(page, rect, page_spans, bands,
                                    [pymupdf.Rect(g["bbox"]) for g in grp])
                    if t and t["rows"]:
                        items.append(("table", t, pno + 1))
                    else:
                        for g in grp:
                            items.append(("tbody", g, pno + 1))
                i = j + 1
                continue
            items.append((k, l, pno + 1))
            i += 1
    return items


def collect_hyphen_words(items):
    """Words that appear hyphenated mid-line, to keep hyphens at line breaks."""
    keep = set()
    for k, l, _ in items:
        if k in ("body", "field") or k.startswith("h"):
            t = "".join(s["text"] for s in l["spans"])
            for m in re.finditer(r"([A-Za-z]+)-([A-Za-z]+)", t[:-1]):
                keep.add((m.group(1).lower(), m.group(2).lower()))
    return keep


def runin_text(sp):
    t = ""
    for x in sp:
        if not x["text"].strip() and not t:
            continue
        if "b" in style_of(x["font"]) or (t and re.fullmatch(r"[\s.:]+", x["text"])):
            t += x["text"]
        else:
            break
    t = t.strip()
    return bool(t) and len(t) <= 90 and t[-1] in ".:"


def _fam(l):
    return first_real(l["spans"])["font"].split("-")[0]


def _raw(l):
    return "".join(s["text"] for s in l["spans"])


def reflow_interruptions(items):
    """Tables and sidebars are placed wherever they fit on the page, which can
    split a sentence in two. Move such interruptions after the paragraph."""
    items = list(items)
    i = 0
    moved = 0
    while i < len(items) - 2:
        k, l, _ = items[i]
        if k == "body" and _fam(l) in ("Cambria", "Optima") \
                and not re.search(r"[.!?:”)]\s*$", _raw(l).rstrip()):
            fam = _fam(l)
            j = i + 1
            while j < len(items):
                kj, lj, _ = items[j]
                if kj in ("table", "table_md", "h5", "h6", "tbody") or \
                        (kj in ("body", "field") and _fam(lj) != fam):
                    j += 1
                    continue
                break
            if j > i + 1 and j < len(items) and items[j][0] == "body" and _fam(items[j][1]) == fam:
                rj = _raw(items[j][1])
                if not rj.startswith("\t") and not rj.lstrip().startswith(BULLET):
                    e = j + 1
                    while e < len(items) and items[e][0] == "body" and _fam(items[e][1]) == fam \
                            and not _raw(items[e][1]).startswith("\t") \
                            and not _raw(items[e][1]).lstrip().startswith(BULLET) \
                            and not runin_text(items[e][1]["spans"]):
                        e += 1
                    block = items[i + 1:j]
                    items = items[:i + 1] + items[j:e] + block + items[e:]
                    moved += 1
                    i = e - len(block) if False else i + 1
                    continue
        i += 1
    return items


def to_markdown(items):
    items = reflow_interruptions(items)
    keep = collect_hyphen_words(items)
    out = []
    para = None  # current paragraph text
    para_kind = None
    last_page = None
    heading_buf = None
    bullet_x = None
    pending_marker = None
    prev_last_bold = False
    field_sig = None

    def flush():
        nonlocal para, heading_buf
        if heading_buf:
            out.append(heading_buf[0] + " " + re.sub(r"\s+", " ", heading_buf[1]).strip())
            out.append("")
            heading_buf = None
        if para is not None and para.strip():
            p = para.strip()
            if p.startswith("- ") and out and out[-1] == "" and len(out) > 1 and out[-2].startswith("- "):
                out.pop()  # tight list
            out.append(p)
            out.append("")
        para = None

    def append_text(t):
        nonlocal para
        if para is None:
            para = t
            return
        # hyphenation across lines
        m = re.search(r"([A-Za-z]+)-(\**)$", para.rstrip())
        n = re.match(r"^(\**)([a-z][A-Za-z]*)", t.lstrip())
        if m and n:
            pair = (m.group(1).lower(), n.group(2).lower())
            base = para.rstrip()
            close, opn = m.group(2), n.group(1)
            head = base[: m.start() + len(m.group(1))]
            tail = t.lstrip()
            if close and close == opn:
                close, tail = "", tail[len(opn):]
            para = head + ("-" if pair in keep else "") + close + tail
            return
        m2 = re.search(r"([A-Za-z0-9])-(\**)$", para)
        n2 = re.match(r"^(\**)([A-Za-z0-9]+)", t)
        if m2 and n2 and not para.endswith(" ") and n2.group(2) not in ("and", "or", "to"):
            close, opn = m2.group(2), n2.group(1)
            tail = t
            if close and close == opn:
                close, tail = "", t[len(opn):]
            para = para[: m2.end(1)] + "-" + close + tail
            return
        if para.endswith(" ") or t.startswith(" "):
            para = para + t
        else:
            para = para + " " + t

    for kind, l, pg in items:
        if pg != last_page:
            pending_marker = f"<!-- p.{pg} -->"
            last_page = pg
        if pending_marker and (kind.startswith("h") or kind in ("table", "table_md") or para is None):
            flush()
            out.append(pending_marker)
            out.append("")
            pending_marker = None
        if kind in ("table", "table_md"):
            flush()
            out.append(table_md(l) if kind == "table" else l)
            out.append("")
            continue
        if kind.startswith("h"):
            lvl = int(kind[1])
            txt = "".join(s["text"] for s in l["spans"]).replace("\t", " ")
            txt = re.sub(r"\s+", " ", txt)
            if heading_buf and heading_buf[2] == lvl and para is None:
                heading_buf[1] = heading_buf[1].strip() + " " + txt.strip()  # wrapped heading
                continue
            flush()
            heading_buf = ["#" * lvl, txt, lvl]
            continue
        sp = l["spans"]
        raw = "".join(s["text"] for s in sp)
        fr = first_real(sp)
        fieldcont = kind in ("tbody", "body") and para_kind == "field" and para is not None \
            and fr["font"].startswith("GillSans") and not raw.startswith("\t")
        if fieldcont:
            if pending_marker:
                pass
            append_text(render_spans(sp).lstrip("\t "))
            continue
        if kind == "tbody":
            kind = "body"
        if para is not None and para_kind == "field" and field_sig == (fr["font"], fr["size"]) \
                and not raw.startswith("\t") and not raw.lstrip().startswith(BULLET) \
                and not re.match(r"^\s*[A-Z][\w ]{0,25}:", raw):
            append_text(render_spans(sp).lstrip("\t "))
            continue
        if para is not None and para_kind == "field" and fr["font"].startswith("Optima") \
                and style_of(fr["font"]) == "" and not raw.startswith("\t") and not raw.lstrip().startswith(BULLET):
            append_text(render_spans(sp).lstrip("\t "))
            prev_last_bold = "b" in style_of(sp[-1]["font"])
            continue
        lead_bold = "b" in style_of(fr["font"])
        lead_words = ""
        for x in sp:
            if "b" in style_of(x["font"]) or not x["text"].strip():
                lead_words += x["text"]
            else:
                break
        runin_open = lead_bold and para is not None and not prev_last_bold \
            and re.search(r"[.!?:)”]\**\s*$", para) and len(lead_words.split()) >= 2 \
            and fr["font"].startswith(("Optima-BoldItalic", "Cambria-BoldItalic"))
        starts_new = (
            raw.startswith("\t") or raw.lstrip().startswith(BULLET) or kind == "field"
            or para_kind == "field"
            or (runin_text(sp) and not prev_last_bold)
            or runin_open
            or (para is not None and para_kind is not None and para_kind != fr["font"].split("-")[0])
        )
        # stat-block field lines (Optima-Bold label at line start, short)
        if fr["font"].startswith("Optima-Bold") and not fr["font"].startswith("Optima-BoldItalic"):
            starts_new = True
            kind = "field"
        x0 = l["bbox"][0]
        if para is not None and re.fullmatch(r"(\*[^*]+\*\s*)+", para.strip()) \
                and "i" not in style_of(fr["font"]):
            starts_new = True  # italic tagline ends
        if para is not None and para.startswith("- ") and not raw.lstrip().startswith(BULLET) \
                and bullet_x is not None and x0 < bullet_x - 2:
            starts_new = True
        if heading_buf:
            flush()
        if starts_new:
            flush()
        txt = render_spans(sp)
        txt = txt.lstrip("\t ")
        if txt.startswith(BULLET):
            txt = "- " + txt[1:].lstrip("\t ")
            bullet_x = x0 + 4
        elif starts_new:
            bullet_x = None if not (para or "").startswith("- ") else bullet_x
        append_text(txt)
        para_kind = "field" if kind == "field" else fr["font"].split("-")[0]
        if kind == "field":
            lastv = [x for x in sp if x["text"].strip()][-1]
            field_sig = (lastv["font"], lastv["size"]) if style_of(lastv["font"]) == "" else None
        prev_last_bold = "b" in style_of(sp[-1]["font"]) and bool(sp[-1]["text"].strip())
    flush()
    md = "\n".join(out)
    md = re.sub(r"[ \t]+\n", "\n", md)
    md = re.sub(r"\n{3,}", "\n\n", md)
    md = md.replace("\u00a0", " ")
    md = re.sub(r" ?\u200b ?", " ", md)
    md = md.replace("\u00ad", "")
    md = re.sub(r"(?<=[^\s*])(\*{1,3}) \1(?=[^\s*])", " ", md)
    return md


if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    pages = None
    if len(sys.argv) > 3:
        a, b = sys.argv[3].split("-")
        pages = range(int(a), int(b) + 1)
    items = extract(src, pages=pages)
    open(dst, "w").write(to_markdown(items))
    print("wrote", dst)
