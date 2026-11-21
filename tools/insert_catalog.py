"""Move draft encodings keyed by entry slug (spells, magic items) into the pack.

usage: insert_catalog.py <pack folder> <entry subfolder> <draft.yaml>...
Each top-level key is an entry file stem. Its blocks go under "## Effects" before
the entry's first heading (or at the end). Entries that already have Effects are skipped.
Prints the slugs it inserted so their drafts can be deleted.
"""
import re, sys, pathlib
pack, sub, drafts = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3:]
done, missing, skipped = [], [], []
for d in drafts:
    groups, cur = {}, None
    for line in open(d).read().splitlines():
        m = re.match(r'^([a-z0-9][a-z0-9-]*):\s*(#.*)?$', line)
        if m: cur = m.group(1); groups[cur] = []; continue
        if cur and line.strip() and not line.lstrip().startswith('#'): groups[cur].append(line)
    for slug, block in groups.items():
        f = pack / sub / f'{slug}.md'
        if not f.exists(): missing.append(slug); continue
        text = f.read_text()
        if re.search(r'^## Effects\s*\n+```ya?ml', text, re.M): skipped.append(slug); continue
        n = min(len(l) - len(l.lstrip()) for l in block if l.strip())
        body = '## Effects\n```yaml\n' + '\n'.join(l[n:] for l in block) + '\n```\n'
        lines = text.rstrip('\n').split('\n')
        fence, at = False, None
        for i, l in enumerate(lines[1:], 1):
            if re.match(r'^\s*(```|~~~)', l): fence = not fence
            if not fence and re.match(r'^#{2,6}\s', l): at = i; break
        if at is None:
            new = '\n'.join(lines) + '\n\n' + body
        else:
            head = '\n'.join(lines[:at]).rstrip('\n')
            new = head + '\n\n' + body + '\n' + '\n'.join(lines[at:]) + '\n'
        f.write_text(new)
        done.append(slug)
print(f'inserted {len(done)}, already had Effects {len(skipped)}, no entry file {len(missing)}: {missing}')
