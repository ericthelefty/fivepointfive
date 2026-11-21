"""Insert Modif blocks into an SRD entry file.

usage: insert_effects.py <entry.md> <encoding.yaml> [key-prefix]
Each top-level key in the YAML is a feature heading (without "Level N: ") or the
entry name (= the entry itself). Its block list goes in a fenced yaml block under
"## Effects", right after that heading's own text (before the next heading).
"""
import re, sys
md_path, enc_path = sys.argv[1], sys.argv[2]
prefix = sys.argv[3] if len(sys.argv) > 3 else None

# split the encoding file into key -> raw block text (keeps the author's formatting)
groups, cur = {}, None
for line in open(enc_path).read().splitlines():
    if not line.strip() or line.lstrip().startswith('#') and not line.startswith('  '):
        if line.startswith('#'): continue
    m = re.match(r'^([^\s#][^:]*):\s*$', line)
    if m:
        cur = m.group(1).strip(); groups[cur] = []; continue
    if cur is not None and line.strip() and not line.strip().startswith('#'):
        groups[cur].append(line)
if prefix:
    groups = {k[len(prefix):].strip(' /') or prefix: v for k, v in groups.items() if k.startswith(prefix)}

lines = open(md_path).read().splitlines()
title = lines[0][2:].strip()
fence = False
heads = []  # (index, title)
for i, l in enumerate(lines):
    if re.match(r'^\s*(```|~~~)', l): fence = not fence
    if not fence and re.match(r'^#{2,6}\s', l):
        heads.append((i, re.sub(r'^#+\s+', '', l).strip()))

def dedent(block):
    n = min(len(l) - len(l.lstrip()) for l in block if l.strip())
    return [l[n:] for l in block]

inserts = []
for key, block in groups.items():
    if not block: continue
    body = ['## Effects', '```yaml', *dedent(block), '```']
    if key.lower() in (title.lower(), prefix or ''):
        # the entry itself: before the first heading, or at the end
        at = heads[0][0] if heads else len(lines)
    else:
        hit = [k for k, (i, t) in enumerate(heads) if re.sub(r'^Level \d+:\s*', '', t).lower() == key.lower()]
        if len(hit) != 1:
            sys.exit(f'{md_path}: heading for "{key}" found {len(hit)} times')
        k = hit[0]
        at = heads[k + 1][0] if k + 1 < len(heads) else len(lines)
    inserts.append((at, body))

for at, body in sorted(inserts, key=lambda x: -x[0]):
    # keep one blank line before and after
    while at > 0 and not lines[at - 1].strip(): at -= 1
    lines[at:at] = [''] + body + ([''] if at < len(lines) else [])
open(md_path, 'w').write('\n'.join(lines).rstrip('\n') + '\n')
print(f'{md_path}: {len(inserts)} Effects sections')
