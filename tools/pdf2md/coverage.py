#!/usr/bin/env python3
"""Compare the word multiset of a PDF against converted Markdown.

Reports words present in the PDF but missing from the Markdown (and vice
versa), ignoring page footers, Markdown syntax, and hyphenation at line ends.

Usage: coverage.py input.pdf converted_dir_or_file [--footer-y 740]
"""
import re
import sys
import os
import collections
import pymupdf


def norm_words(text):
    text = text.replace("−", "-").replace(" ", " ").replace("­", "")
    text = re.sub(r"<!--.*?-->", " ", text)
    text = re.sub(r"[*_|#>`]", " ", text)
    return [w.lower() for w in re.findall(r"[A-Za-z0-9À-ɏ’'½¼¾]+", text)]


def pdf_words(path, footer_y=740):
    doc = pymupdf.open(path)
    words = []
    for page in doc:
        lines = []
        for b in page.get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                if l["bbox"][1] >= footer_y:
                    continue
                lines.append("".join(s["text"] for s in l["spans"]))
        # join hyphenated line breaks
        txt = ""
        for ln in lines:
            ln = ln.rstrip()
            if txt.endswith("-") and ln[:1].islower():
                txt = txt[:-1] + ln
            else:
                txt += "\n" + ln
        words += norm_words(txt)
    return words


def md_words(path):
    files = []
    if os.path.isdir(path):
        for root, _, fs in os.walk(path):
            files += [os.path.join(root, f) for f in fs if f.endswith(".md")]
    else:
        files = [path]
    words = []
    for f in files:
        words += norm_words(open(f, encoding="utf-8").read())
    return words


def split_compound(c):
    """Hyphenated words may be split differently; compare by subword."""
    return c


if __name__ == "__main__":
    pdf, md = sys.argv[1], sys.argv[2]
    ignore = set(sys.argv[3].split(",")) if len(sys.argv) > 3 else set()
    a = collections.Counter(pdf_words(pdf))
    b = collections.Counter(md_words(md))
    missing = a - b
    extra = b - a
    print(f"PDF words: {sum(a.values())}  MD words: {sum(b.values())}")
    print(f"missing from MD: {sum(missing.values())}  extra in MD: {sum(extra.values())}")
    print("top missing:", missing.most_common(40))
    print("top extra:", extra.most_common(40))
