"""Move a draft encoding (one entry: class, subclass, species…) into its pack file.

usage: convert_entry.py <entry.md> <draft.yaml> [--key-prefix <prefix>] [--dry-run]

Each top-level key of the draft is a feature heading (without "Level N: ") or the
entry's name. For each key, in the draft's order:
  - a matching heading is used ("Cloud's Jaunt" matches "Cloud's Jaunt (Cloud Giant)");
    when a name repeats, "Level N:" headings win, and blocks with `at: N` go to the
    "Level N" copy (Improved Brutal Strike at 13 and 17);
  - otherwise a run-in label (***Key.***) or bold label (**Key.** / **Key (…).**) is
    turned into a heading one level below the heading it sits under (Modif §2.4);
  - the key that is the entry's name goes before the first heading.
The blocks then go under "## Effects" in a yaml fence right after that heading's text.
"""
import re, sys, pathlib

args = sys.argv[1:]
dry = '--dry-run' in args
args = [a for a in args if a != '--dry-run']
prefix = None
if '--key-prefix' in args:
    i = args.index('--key-prefix'); prefix = args[i + 1]; del args[i:i + 2]
md_path, draft_path = pathlib.Path(args[0]), pathlib.Path(args[1])

# --- the draft: key -> raw lines (keeps the author's formatting and comments inside blocks)
groups, order, cur = {}, [], None
for line in draft_path.read_text().splitlines():
    m = re.match(r'^([^\s#-][^:]*?):\s*(#.*)?$', line)
    if m:
        cur = m.group(1).strip().strip('"')
        if prefix:
            if not cur.startswith(prefix): cur = None; continue
            cur = cur[len(prefix):].strip(' /') or cur
        groups.setdefault(cur, []); order.append(cur) if cur not in order else None
        continue
    if cur is not None and line.strip() and not re.match(r'^\s*#', line):
        groups[cur].append(line)

def dedent(block):
    n = min(len(l) - len(l.lstrip()) for l in block if l.strip())
    return [l[n:] for l in block]

def split_items(block):
    """Top-level list items of a block (each item with its continuation lines)."""
    items, curi = [], None
    base = min(len(l) - len(l.lstrip()) for l in block if l.strip())
    for l in block:
        if len(l) - len(l.lstrip()) == base and l.lstrip().startswith('- '):
            curi = [l]; items.append(curi)
        elif curi is not None:
            curi.append(l)
    return items

norm = lambda t: re.sub(r'\s*\([^)]*\)\s*$', '', re.sub(r'^Level \d+:\s*', '', t)).strip().lower()

lines = md_path.read_text().split('\n')
title = lines[0][2:].strip()

def headings():
    out, fence = [], False
    for i, l in enumerate(lines):
        if re.match(r'^\s*(```|~~~)', l): fence = not fence
        m = not fence and re.match(r'^(#{2,6})\s+(.+?)\s*$', l)
        if m: out.append((i, len(m.group(1)), m.group(2)))
    return out

created_runin, created_bold = set(), set()  # made here: siblings don't nest under each other

def level_at(idx, runin):
    """Level of the heading a label sits under. A run-in sits under the last original heading;
    a bold label (an option inside a run-in trait) under the last original or run-in heading."""
    lv = 1
    for i, l, t in headings():
        if i >= idx: break
        if t in created_bold or (runin and t in created_runin): continue
        lv = l
    return lv

def make_heading(key):
    """Turn ***Key.*** or **Key….** into a heading. Returns True if it did."""
    pats = [re.compile(r'^\*\*\*(' + re.escape(key) + r')\.?\*\*\*\.?\s*(.*)$'),
            re.compile(r'^\*\*(' + re.escape(key) + r'(?:\s*\([^)]*\))?)\.?\*\*\.?\s*(.*)$')]
    for i, l in enumerate(lines):
        for n, p in enumerate(pats):
            m = p.match(l.strip())
            if m and not l.startswith('#'):
                runin = n == 0
                # traits of a species, background or feat are top-level headings (Modif §2.4)
                flat = runin and not any(re.match(r'^Level \d+:', h[2]) for h in headings()) and re.search(r'^\*\*Type:\*\* (Species|Background|Feat)\b', '\n'.join(lines[:12]), re.M)
                lv = 2 if flat else min(6, max(2, level_at(i, runin) + 1))
                head = m.group(1).rstrip('.')
                (created_runin if runin else created_bold).add(head)
                lines[i:i + 1] = ['#' * lv + ' ' + head, ''] + ([m.group(2)] if m.group(2) else [])
                return True
    return False

placed = []  # (heading index or None for top, lines)
for key in order:
    block = groups.get(key) or []
    if not block: continue
    if key.lower() == title.lower() or (prefix and key == prefix):
        placed.append(('TOP', dedent(block))); continue
    hs = [h for h in headings() if norm(h[2]) == key.lower()]
    if not hs:
        if not make_heading(key):
            sys.exit(f'{md_path.name}: no heading or run-in for "{key}"')
        hs = [h for h in headings() if norm(h[2]) == key.lower()]
    lv_heads = [h for h in hs if re.match(r'^Level \d+:', h[2])]
    if len(lv_heads) > 1:
        # blocks with `at: N` go to the "Level N" copy; the rest to the first
        by_level = {int(re.match(r'^Level (\d+):', h[2]).group(1)): h for h in lv_heads}
        first = lv_heads[0]
        buckets = {}
        for item in split_items(block):
            at = re.search(r'\bat:\s*(\d+)\b', '\n'.join(item))
            h = by_level.get(int(at.group(1))) if at and int(at.group(1)) in by_level else first
            buckets.setdefault(h[2], []).extend(item)
        for t, items in buckets.items():
            placed.append((t, dedent(items)))
    else:
        h = (lv_heads or hs)[0]
        placed.append((h[2], dedent(block)))

# insert, last position first so earlier indexes stay valid
def insert_at(title_or_top):
    hs = headings()
    if title_or_top == 'TOP':
        return hs[0][0] if hs else len(lines)
    k = next(j for j, h in enumerate(hs) if h[2] == title_or_top)
    return hs[k + 1][0] if k + 1 < len(hs) else len(lines)

# merge blocks placed under the same heading
merged = {}
for t, b in placed: merged.setdefault(t, []).extend(b)
for t in sorted(merged, key=insert_at, reverse=True):
    at = insert_at(t)
    while at > 0 and not lines[at - 1].strip(): at -= 1
    body = ['', '## Effects', '```yaml', *merged[t], '```']
    lines[at:at] = body + ([''] if at < len(lines) else [])

text = re.sub(r'\n{3,}', '\n\n', '\n'.join(lines)).rstrip('\n') + '\n'
if dry: print(text)
else: md_path.write_text(text)
print(f'{md_path.name}: {len(merged)} Effects sections', file=sys.stderr)
