#!/usr/bin/env python3
"""Stage 2: master Markdown -> content pack of entry files.

Parses the master file into a heading tree, decides which headings are
entries (spells, monsters, feats...) using a per-source rule table, and writes
every line of the master into exactly one output file. Text that isn't an
entry is written to `rules/` section files, so nothing is ever dropped.

Usage: split.py master.md out_dir [--rules srd521]
"""
import os
import re
import sys
import shutil

# ------------------------------------------------------------------ rules --
# Each rule: (path regex, entry type, out folder, options)
# The path is the chain of ancestor heading titles joined by " > ", ending in
# the candidate heading itself; level is prefixed like "h4:".
SRD521_RULES = [
    (r"^h1:Classes > h2:[^>]+ > h3:\w+ Subclass: [^>]+$", "Subclass", "subclasses", {}),
    (r"^h1:Classes > h2:[^>]+$", "Class", "classes", {}),
    (r"Background Descriptions > h4:[^>]+$", "Background", "backgrounds", {}),
    (r"Species Descriptions > h4:[^>]+$", "Species", "species", {}),
    (r"^h1:Feats > h2:Feat Descriptions > h3:(Origin|General|Fighting Style|Epic Boon) Feats > h4:[^>]+$",
     "Feat", "feats", {}),
    (r"^h1:Equipment > h2:Tools > h3:[^>]+ > h4:[^>]+$", "Tool", "equipment/tools", {}),
    (r"^h1:Equipment > h2:Adventuring Gear > h4:[^>]+$", "Gear", "equipment/gear", {}),
    (r"^h1:Spells > h2:Spell Descriptions > h4:[^>]+$", "Spell", "spells", {}),
    (r"^h1:Rules Glossary > h2:Rules Definitions > h4:[^>]+$", "Rule", "glossary", {}),
    (r"^h1:Magic Items > h2:Magic Items A–Z > h4:[^>]+$", "Magic Item", "magic-items", {}),
    (r"^h1:Monsters A–Z > h2:[^>]+ > h3:[^>]+$", "Creature", "monsters", {"group": True}),
    (r"^h1:Monsters A–Z > h2:[^>]+$", "Creature Group", "monsters/groups", {"only_if_text": True}),
    (r"^h1:Animals > h3:[^>]+$", "Creature", "animals", {}),
]

# Source-specific fixes for layout quirks (moving misplaced sidebar text).
SRD521_PATCHES = [
    # The "Selling Equipment" sidebar is printed on the first page of the
    # Equipment chapter but extracted before the chapter heading.
    ("move_before_next", r"^##### Selling Equipment$", r"^# Equipment$", r"^## Coins$"),
    ("move_before_next", r"^##### Exceptions Supersede General Rules$", r"^# Playing the Game$", r"^## Rhythm of Play$"),
    ("move_before_next", r"^##### Casting in Armor$", r"^# Spells$", r"^## Gaining Spells$"),
    # Stat blocks printed inside spell and magic item descriptions use the
    # same heading size as monster names; demote them below the entry level.
    ("demote", r"^## Spell Descriptions$", r"^# Rules Glossary$", 3, 5),
    ("demote", r"^## Magic Items A–Z$", r"^# Monsters$", 3, 5),
]

PACK = {
    "id": "srd",
    "name": "System Reference Document 5.2.1",
    "short": "SRD 5.2.1",
}

ATTRIBUTION = (
    "This work includes material from the System Reference Document 5.2.1 "
    "(“SRD 5.2.1”) by Wizards of the Coast LLC, available at "
    "https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative "
    "Commons Attribution 4.0 International License, available at "
    "https://creativecommons.org/licenses/by/4.0/legalcode."
)


def slug(s):
    s = s.lower().replace("’", "").replace("'", "")
    s = re.sub(r"\[[^\]]*\]", "", s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "untitled"


def apply_patches(lines, patches):
    for p in patches:
        if p[0] == "move_before_next":
            _, start_rx, anchor_rx, before_rx = p
            s = next(i for i, l in enumerate(lines) if re.match(start_rx, l))
            a = next(i for i in range(s + 1, len(lines)) if re.match(anchor_rx, lines[i]))
            block = lines[s:a]
            rest = lines[:s] + lines[a:]
            b = next(i for i, l in enumerate(rest) if re.match(before_rx, l))
            lines = rest[:b] + block + rest[b:]
        if p[0] == "demote":
            _, a_rx, b_rx, frm, to = p
            a = next(i for i, l in enumerate(lines) if re.match(a_rx, l))
            b = next(i for i in range(a + 1, len(lines)) if re.match(b_rx, lines[i]))
            for i in range(a + 1, b):
                if lines[i].startswith("#" * frm + " "):
                    lines[i] = "#" * to + lines[i][frm:]
    return lines


class Node:
    def __init__(self, level, title, line):
        self.level, self.title, self.line = level, title, line
        self.children, self.parent = [], None
        self.body = []          # (line_no, text) lines directly under this heading
        self.page = None

    def path(self):
        n, parts = self, []
        while n and n.level > 0:
            parts.append(f"h{n.level}:{n.title}")
            n = n.parent
        return " > ".join(reversed(parts))

    def has_text(self):
        return any(t.strip() and not t.startswith("<!--") for _, t in self.body)


def parse(lines):
    root = Node(0, "", -1)
    stack = [root]
    page = 1
    for i, l in enumerate(lines):
        m = re.match(r"^(#{1,6}) (.+)$", l)
        pm = re.match(r"^<!-- p\.(\d+) -->$", l)
        if pm:
            page = int(pm.group(1))
        if m:
            lvl = len(m.group(1))
            n = Node(lvl, m.group(2).strip(), i)
            n.page = page
            while stack[-1].level >= lvl:
                stack.pop()
            n.parent = stack[-1]
            stack[-1].children.append(n)
            stack.append(n)
        else:
            stack[-1].body.append((i, l))
    return root


STAT_TAGLINE = re.compile(r"^\*(Tiny|Small|Medium|Large|Huge|Gargantuan)\b")


def subtree_text(n, skip=None):
    out = [n.title]
    for _, t in n.body:
        out.append(t)
    for c in n.children:
        if c is not skip:
            out.append(subtree_text(c, skip))
    return re.sub(r"\*+", "", "\n".join(out))


def relocate_stat_blocks(root):
    """Move stat blocks that float next to the wrong entry (layout) to the
    entry whose text refers to them, e.g. "the Otherworldly Steed stat block"."""
    entries = [n for n in walk(root) if getattr(n, "rule", None)]
    moved = []
    for e in entries:
        for c in list(e.children):
            first = next((t for _, t in c.body if t.strip()), "")
            is_stat = STAT_TAGLINE.match(first) and e.rule[0] in ("Spell", "Magic Item")
            is_table = first.startswith("|") and not c.children
            if not (is_stat or is_table):
                continue
            if c.title.lower() in subtree_text(e, skip=c).lower():
                continue
            target = None
            for o in entries:
                if o is e:
                    continue
                if o.rule[0] != e.rule[0]:
                    continue
                txt = subtree_text(o).lower()
                if (c.title + (" stat block" if is_stat else " table")).lower() in txt:
                    target = o
                    break
            if target is None and is_stat:
                for o in entries:
                    if o is not e and o.rule[0] == e.rule[0] and c.title.lower() in subtree_text(o).lower():
                        target = o
                        break
            if target is not None and is_table:
                # move only the heading and its table; text after the table
                # belongs to the host entry
                tbl, rest, seen = [], [], False
                for ln, t in c.body:
                    if not seen or t.startswith("|") or (not t.strip() and not rest):
                        tbl.append((ln, t))
                        if t.startswith("|"):
                            seen = True
                    else:
                        rest.append((ln, t))
                c.body = tbl
                if rest:
                    idx = e.children.index(c)
                    holder = e if idx == 0 else e.children[idx - 1]
                    while holder.children and holder is not e:
                        holder = holder.children[-1]
                    holder.body.extend(rest)
            if target is not None:
                e.children.remove(c)
                target.children.append(c)
                c.parent = target
                moved.append((c.title, e.title, target.title))
    for m in moved:
        print("  moved stat block %r: %r -> %r" % m)


def match_rule(node, rules):
    p = node.path()
    for rx, typ, folder, opt in rules:
        if re.search(rx, p):
            if opt.get("only_if_text") and not node.has_text():
                return None
            return (typ, folder, opt)
    return None


def walk(n):
    yield n
    for c in n.children:
        yield from walk(c)


def split(master_path, out_dir, rules=SRD521_RULES, patches=SRD521_PATCHES):
    lines = open(master_path, encoding="utf-8").read().split("\n")
    lines = apply_patches(lines, patches)
    root = parse(lines)

    # 1. decide owners
    for n in walk(root):
        n.rule = match_rule(n, rules) if n.level else None
    def owner(n):
        while n is not None:
            if n.rule:
                return n
            n = n.parent
        return None
    # non-entry owner: the level-2 section (or chapter) containing the node
    def section_of(n):
        chain = []
        while n is not None and n.level > 0:
            chain.append(n)
            n = n.parent
        chain.reverse()
        if not chain:
            return None
        return chain[1] if len(chain) > 1 else chain[0]

    relocate_stat_blocks(root)

    files = {}  # key -> dict(meta, lines)
    order = []

    def file_for(n):
        o = owner(n)
        if o is not None:
            key = ("entry", id(o))
            if key not in files:
                typ, folder, opt = o.rule
                files[key] = dict(node=o, type=typ, folder=folder, opt=opt, lines=[])
                order.append(key)
            return files[key]
        s = section_of(n)
        key = ("rule", id(s) if s else 0)
        if key not in files:
            files[key] = dict(node=s, type="Rule", folder="rules", opt={}, lines=[])
            order.append(key)
        return files[key]

    # 2. distribute lines in document order
    pre = [l for _, l in root.body]
    for n in walk(root):
        if n.level == 0:
            continue
        f = file_for(n)
        f["lines"].append((n, None))          # heading marker
        for _, t in n.body:
            f["lines"].append((None, t))

    # 3. write
    if os.path.exists(out_dir):
        shutil.rmtree(out_dir)
    os.makedirs(out_dir)
    used = {}
    written = []
    for key in order:
        f = files[key]
        node = f["node"]
        md = render_file(f, node)
        if md is None:
            continue
        folder = f["folder"]
        if f["type"] == "Rule" and folder == "rules":
            chap = node
            while chap.parent and chap.parent.level > 0:
                chap = chap.parent
            sub = slug(chap.title)
            name = "_index" if node is chap else slug(node.title)
            rel = os.path.join(folder, sub, name + ".md")
        else:
            rel = os.path.join(folder, slug(entry_title(node.title, f["type"])[0]) + ".md")
        n = used.get(rel, 0)
        used[rel] = n + 1
        if n:
            rel = rel[:-3] + f"-{n + 1}.md"
        path = os.path.join(out_dir, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        open(path, "w", encoding="utf-8").write(md)
        written.append((rel, f["type"], node.title))
    return written


def first_page(f):
    for n, t in f["lines"]:
        if n is not None and n.page:
            return n.page
    return None


def render_file(f, node):
    base = node.level
    typ = f["type"]
    out = []
    first = True
    hstack = []
    page = node.page
    for n, t in f["lines"]:
        if n is not None:
            lvl = max(1, n.level - base + 1)
            if n is node:
                hstack = [(n.level, 1)]
                title, extra = entry_title(n.title, typ)
                out.append(f"# {title}")
                out.append(f"**Type:** {typ}")
                if f["opt"].get("group") and n.parent and n.parent.title != n.title:
                    out.append(f"**Group:** {n.parent.title}")
                if typ == "Subclass":
                    out.append(f"**Parent:** {n.parent.title}")
                out.extend(extra)
                out.append(f"**Source:** {PACK['short']}, p. {page}")
                out.append("")
            else:
                while hstack and hstack[-1][0] >= n.level:
                    hstack.pop()
                lvl = hstack[-1][1] + 1 if hstack else 2
                hstack.append((n.level, lvl))
                out.append("#" * min(lvl, 6) + " " + n.title)
                out.append("")
            continue
        if t.startswith("<!--"):
            continue
        out.append(t)
    md = "\n".join(out)
    md = re.sub(r"\n{3,}", "\n\n", md).strip() + "\n"
    # field lines directly under the heading: no blank lines between them
    md = tighten_fields(md)
    if typ == "Class":
        md = class_traits_to_fields(md)
    content = [t for n, t in f["lines"] if n is None and t.strip() and not t.startswith("<!--")]
    content += [n for n, t in f["lines"] if n is not None and n is not node]
    if not content and not (typ == "Rule" and node.level == 1):
        return None
    return md


def entry_title(title, typ):
    """Split structural parts out of a heading into fields."""
    extra = []
    if typ == "Subclass":
        title = re.sub(r"^\w+ Subclass:\s*", "", title)
    if typ in ("Gear", "Tool"):
        m = re.match(r"^(.*?)\s*\(([^()]*(?:GP|SP|CP|Varies)[^()]*)\)$", title)
        if m:
            title = m.group(1)
            extra.append(f"**Cost:** {m.group(2)}")
    return title, extra


FIELD_RX = re.compile(r"^(\*\*[^*]+?:?\*\*.*|\*[^*].*\*)$")


def tighten_fields(md):
    """Collapse blank lines inside the leading block of field/tagline lines."""
    lines = md.split("\n")
    out = [lines[0]]
    i = 1
    while i < len(lines):
        l = lines[i]
        if l == "" and i + 1 < len(lines) and FIELD_RX.match(lines[i + 1]) and out and FIELD_RX.match(out[-1]) \
                and is_header_zone(out):
            i += 1
            continue
        out.append(l)
        i += 1
    return "\n".join(out)


def is_header_zone(out):
    # still in the header if no body paragraph seen since the title
    for l in out[1:]:
        if l and not FIELD_RX.match(l):
            return False
    return True


def class_traits_to_fields(md):
    """Core <Class> Traits table -> field lines under that heading."""
    def conv(m):
        head, table = m.group(1), m.group(2)
        rows = [r for r in table.strip().split("\n")[2:]]
        fields = []
        for r in rows:
            cells = [c.strip() for c in r.strip().strip("|").split("|")]
            if len(cells) >= 2 and cells[0]:
                fields.append(f"**{cells[0]}:** {cells[1]}")
        return head + "\n\n" + "\n".join(fields) + "\n"
    return re.sub(r"(#+ Core [^\n]+ Traits)\n\n((?:\|[^\n]*\n)+)", conv, md)


if __name__ == "__main__":
    master, out = sys.argv[1], sys.argv[2]
    w = split(master, out)
    from collections import Counter
    c = Counter(t for _, t, _ in w)
    print(len(w), "files;", dict(c))
