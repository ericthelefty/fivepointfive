"""modif_check: validator for Modif 0.7 (an open format for 5E-compatible rules as data).

Usage:
  python3 modif_check.py <content pack folder>     reads the ## Effects blocks in every .md entry file
  python3 modif_check.py <folder of .yaml files>   one file per entry; top-level keys are feature headings

Checks: reserved-word keys, block names, allowed fields per block (recursively, including blocks nested in
toggles / options / self-effects / modify), trigger events and payloads, `when` keys, durations, value grammar,
local references, choice ids, and class table columns. With the `jsonschema` package installed and
modif.schema.json next to this script, it also checks enum values and nested objects.

Set MODIF_SRD to the SRD pack folder if it isn't at content/srd-5.2.1 next to this script or one folder up.
"""
import yaml, glob, re, pathlib, json, sys, os
from collections import defaultdict

_here = pathlib.Path(__file__).resolve().parent
SRD = pathlib.Path(os.environ.get('MODIF_SRD') or next((p for p in (_here / 'content' / 'srd-5.2.1', _here.parent / 'content' / 'srd-5.2.1') if p.exists()), _here / 'content' / 'srd-5.2.1'))
# `custom` handlers: one file per handler in the app's src/lib/custom/ (index.ts and *.test.ts aren't handlers)
_handler_dir = pathlib.Path(os.environ.get('MODIF_HANDLERS') or next((p for p in (_here / 'src' / 'lib' / 'custom', _here.parent / 'src' / 'lib' / 'custom') if p.exists()), _here / 'src' / 'lib' / 'custom'))
HANDLERS = {f.stem for f in _handler_dir.glob('*.ts') if f.stem != 'index' and not f.stem.endswith('.test')} if _handler_dir.exists() else None
RESERVED = {'on', 'off', 'yes', 'no', 'y', 'n', 'true', 'false'}

COMMON = {'id', 'when', 'level', 'at', 'scope', 'label', 'text', 'per', 'duration', 'counter'}
F = lambda *a: COMMON | set(a)
BLOCKS = {
    'proficiency': None, 'expertise': None, 'mastery': None, 'language': None,          # list forms
    'half-proficiency': F('unless'),
    'sense': None, 'speed': None, 'size': None,
    'defense': F('resistance', 'immunity', 'vulnerability', 'condition-immunity', 'except'),
    'note': F('stat'),
    'trait': None,
    'option': F('of', 'prerequisite', 'repeatable'),
    'hit-die': None, 'multiclass': None,
    'equipment': F('options'),
    'bonus': F('to', 'value', 'once', 'type', 'also-current', 'decays'),
    'set': F('to', 'value', 'mode', 'locked'),
    'base': F('to', 'value', 'allow-shield'),
    'advantage': F('roll', 'once'), 'disadvantage': F('roll', 'once'), 'cancel-advantage': F('roll'),
    'crit-range': F('value'), 'extra-attack': F('total'),
    'damage-die': F('die', 'if-higher', 'type'), 'use-ability': F('ability', 'instead-of', 'for', 'choose', 'same-for-both'),
    'damage-type': F('add-option', 'replace', 'with'), 'ignore-resistance': F('damage'),
    'score': None, 'score-max': None,
    'roll-floor': F('roll', 'min', 'total-min', 'when-proficient', 'optional'), 'die-floor': F('min'),
    'maximize': F(), 'reroll': F('roll', 'if', 'must-use-new', 'dice', 'keep'), 'save-rule': F('ability', 'success', 'failure', 'miss'),
    'treat-roll': F('roll', 'range', 'as', 'optional'),
    'choose': F('kind', 'count', 'from', 'grants', 'swap', 'default', 'options', 'amounts', 'max', 'distinct', 'limit'),
    'resource': F('max', 'reset', 'partial', 'regain', 'die', 'unit', 'spend', 'lifetime', 'start', 'per-property', 'shared-with', 'builtin', 'on-max'),
    'cast-list': F('pay-from', 'spells', 'dc', 'table', 'ability'),
    'convert': F('from', 'to', 'activation', 'if-empty'),
    'action': F('activation', 'cost', 'range', 'area', 'targets', 'attack', 'save', 'damage', 'heal', 'temp-hp', 'apply',
                'move', 'effects', 'take', 'check', 'cast', 'cast-at', 'cast-options', 'consume', 'requires', 'choose-one', 'dc', 'if', 'regain',
                'give', 'limit', 'ability', 'overrides', 'use-ability', 'damage-type', 'auto-succeed', 'on-success', 'on-failure', 'then',
                'on-miss', 'repeat', 'choose', 'grows', 'end-effect', 'dispel', 'creates', 'on-hit',
                'remove-condition', 'delay', 'reduce-hp-max', 'exhaustion', 'target', 'branch', 'grant-rest', 'roll-table', 'revive', 'table', 'stabilize', 'summon', 'becomes', 'variant', 'preset', 'lockout', 'damage-ability-mod', 'zone', 'ends-when'),
    'toggle': F('activation', 'cost', 'ends-when', 'blocks', 'effects', 'if', 'choose', 'move', 'choose-one', 'leave', 'lockout'),
    'narrative': None, 'suppress': F('target', 'until'),
    'aura': F('area', 'affects', 'inactive-when', 'stacking', 'effects', 'moves'),
    'zone': F('area', 'side', 'reach', 'event', 'save', 'damage', 'apply', 'effects', 'moves', 'choose-one', 'if', 'then', 'on-success', 'on-failure', 'heal', 'choose', 'affects', 'ends-after', 'table', 'by-turn'),
    'remove-condition': None, 'limit': F('worn', 'of'),
    'grant-spell': F('spell', 'choose', 'prepared', 'counts-as-known', 'free', 'at-will', 'ritual', 'uses-slot', 'cast-at',
                     'ability', 'overrides', 'target', 'maximize', 'auto-succeed', 'counts-as'),
    'spell-list': F('add-to', 'from', 'count', 'by-level', 'by-choice', 'table', 'prepared', 'choose-again', 'class', 'by'),
    'spellcasting': F('ability', 'progression', 'prepared', 'cantrips', 'list', 'focus', 'slots', 'slot-level', 'spellbook',
                      'ritual', 'change', 'class', 'limit'),
    'scaling': F('per-slot-above', 'cantrip', 'add', 'slots', 'multiply'),
    'target-effects': F('effects', 'ends-when', 'on-end', 'choose-one'), 'self-effects': F('effects', 'ends-when', 'on-end'),
    'form': F('activation', 'cost', 'choose', 'keeps', 'replaces', 'temp-hp', 'ends-when', 'blocks', 'leave', 'effects', 'if', 'target', 'targets', 'repeat', 'save', 'choose-one'),
    'summon': F('creature', 'via', 'limit', 'type-override', 'count', 'count-rule', 'control', 'initiative', 'variant', 'stat-level', 'overrides'),
    'summon-options': F('for', 'add', 'speed', 'save-dc', 'damage-type', 'text'),
    'condition': None,
    'charges': F('max', 'recharge', 'destroy-on', 'start', 'kinds'), 'variant': F('by', 'values', 'roll', 'table'), 'container': F('capacity', 'weight'), 'weapon-rule': None, 'craft': F('items'), 'auto-fail': F('roll'), 'breaks-concentration': None, 'rest': F('kind', 'spend', 'regain'),
    'poison': F('delivery', 'save', 'damage', 'apply', 'on-failure', 'on-success', 'then', 'delay', 'neutralized-by', 'on-fail-by'), 'weapon-property': F('add', 'remove'), 'wield-as': F('weapon'), 'curse': F('prevents', 'ends', 'effects'),
    'modify': F('target', 'set', 'add', 'max'), 'replace': F('target', 'optional'),
    'custom': F('handler', 'params'),
    'trigger': F('event', 'reaction', 'if', 'offer', 'auto', 'pick', 'dc', 'who', 'group', 'group-exempt', 'if-roll'),
}
EVENTS = {'attack', 'hit', 'hit-first', 'miss', 'crit', 'hit-by', 'damaged', 'targeted', 'fail', 'roll', 'zero-hp',
          'reduce-to-zero', 'start-of-turn', 'end-of-turn', 'cast', 'use', 'rest', 'fall', 'spend', 'target-drops',
          'succeed', 'deal-damage', 'enter-area', 'forced-move', 'every', 'leaves-reach'}
PAYLOAD = {'damage', 'heal', 'temp-hp', 'reroll', 'bonus', 'must-use-new', 'add-roll', 'treat-as', 'regain', 'turn-on', 'move',
           'reaction', 'cast', 'damage-taken', 'roll', 'if-roll', 'refund', 'choose-one', 'pick', 'cost', 'text', 'save', 'apply',
           'label', 'id', 'requires', 'if', 'advantage', 'on-success', 'on-failure', 'then', 'set-hp', 'exhaustion', 'spell',
           'maximize', 'self-damage', 'consume', 'suppress', 'remove-condition', 'effects', 'end-effect', 'shift-bonus', 'instead-of-damage', 'attack', 'on-hit', 'end-effect', 'check'}
WHEN = {'armor', 'shield', 'wielding', 'level', 'active', 'hp', 'equipped', 'attuned', 'choice', 'player', 'condition',
        'in-combat', 'has', 'all', 'any', 'not', 'speed', 'variant', 'species', 'class', 'weapon', 'score', 'armor-untrained', 'rarity'}
UNTIL = {'end-of-turn', 'start-of-next-turn', 'end-of-next-turn', 'start-of-target-next-turn', 'end-of-target-next-turn', 'end-of-target-turn', 'dawn', 'long-rest', 'midnight'}
KINDS = {'skill', 'tool', 'language', 'ability', 'option', 'feat', 'subclass', 'spell', 'weapon', 'equipment', 'damage-type', 'size', 'item'}
ACTIONS = {'attack', 'dash', 'disengage', 'dodge', 'help', 'hide', 'influence', 'magic', 'ready', 'search', 'study', 'utilize'}
TOKEN = re.compile(r"table:[A-Za-z’' ]+\.[A-Za-z .]+|\d+\.\d+|\d+ (?:hour|minute|round|day|feet|foot|mile)s?\b|save-dc:[\w-]+|(?:spell|target|form|damage-taken|fall)\.[\w-]+|\buses\b|variant:[\w-]+\.[\w-]+|(?:score|mod):choice:[\w-]+|\d+:|\d+d\d+|\d+|prof|mod:\w+|score:\w+|level(?::\w+)?|d\d+|table:[A-Za-z’' ]+|choice:[\w.-]+|spell-ability|"
                   r"\bany\b|\bcharges\b|\bexhaustion\b|attack-ability-mod|steps\(|dice\(|\d+:|variant:[\w-]+|cost\.[\w-]+|speed:\w+|min|max|half|ceil|slot-level|spell:\w+|half-speed|>=|<=|==|>|<")
NOT_VALUES = {'rarity', 'id', 'label', 'text', 'if', 'kind', 'reset', 'activation', 'type', 'ability', 'instead-of', 'for', 'mode', 'by',
              'event', 'progression', 'list', 'focus', 'prepared', 'grants', 'success', 'failure', 'stat', 'to', 'roll',
              'take', 'check', 'cast', 'target', 'creature', 'via', 'shape', 'until', 'unit', 'condition', 'resource',
              'prevents', 'damage-taken', 'refund', 'when', 'swap', 'at', 'kind', 'extend', 'table', 'player', 'applies-to', 'headings-under', 'leave', 'count-rule'}


SCOPE = {'weapon', 'spell', 'source', 'ability', 'against', 'any', 'all', 'item', 'healing', 'attack'}
WEAPON = {'kind', 'category', 'property', 'hands', 'monk', 'unarmed', 'mastery', 'id', 'not', 'tag', 'deals'}
SPELL = {'list', 'school', 'level', 'slot', 'heals', 'deals', 'ritual', 'in', 'known', 'casting-time', 'not', 'range', 'id', 'attack', 'counts-as',
         'save', 'duration', 'scales'}
AGAINST = {'condition', 'creature', 'damage', 'target', 'attack', 'hazard'}
FILTER = {'feat', 'spell', 'weapon', 'subclass', 'proficient', 'not', 'known', 'level', 'creature', 'any', 'all', 'tool'}
TOOL_F = {'category'}
FEAT_F = {'category', 'qualify'}
SUBCLASS_F = {'parent'}
CREATURE_F = {'type', 'cr-max', 'exclude', 'fly', 'size-max', 'seen'}
TARGETS = {'count', 'creature', 'condition', 'choose', 'include-self', 'repeat', 'within', 'size', 'size-max', 'text'}
WHO = {'creature', 'range', 'see'}
APPLY = {'condition', 'duration', 'save-ends', 'ends-when', 'text', 'limit', 'effects', 'escape', 'table', 'if', 'while'}
SAVE = {'ability', 'dc', 'success', 'text', 'advantage', 'disadvantage', 'auto-succeed', 'auto-fail', 'unwilling-only', 'self', 'modifiers', 'ignore-cover'}
COST = {'resource', 'amount', 'slot', 'charges', 'dice-from', 'count', 'lockout', 'any', 'per-pick'}

def check_keys(d, allowed, where, what, errs):
    if isinstance(d, dict):
        for k in d:
            if k not in allowed: errs.append(f"{where}: {what} has unknown key '{k}'")

def check_scope(sc, where, errs):
    if not isinstance(sc, dict): return
    check_keys(sc, SCOPE, where, 'scope', errs)
    for k in ('any', 'all'):
        for x in sc.get(k, []) or []: check_scope(x, where, errs)
    check_keys(sc.get('weapon'), WEAPON, where, 'scope.weapon', errs)
    check_keys(sc.get('spell'), SPELL, where, 'scope.spell', errs)
    check_keys(sc.get('against'), AGAINST, where, 'scope.against', errs)

def check_filter(f, where, errs):
    if not isinstance(f, dict): return
    check_keys(f, FILTER, where, 'filter', errs)
    for k in ('any', 'all'):
        for x in f.get(k, []) or []: check_filter(x, where, errs)
    check_keys(f.get('feat'), FEAT_F, where, 'filter.feat', errs)
    check_keys(f.get('spell'), SPELL, where, 'filter.spell', errs)
    check_keys(f.get('weapon'), WEAPON, where, 'filter.weapon', errs)
    check_keys(f.get('subclass'), SUBCLASS_F, where, 'filter.subclass', errs)
    check_keys(f.get('creature'), CREATURE_F, where, 'filter.creature', errs)
    check_keys(f.get('tool'), TOOL_F, where, 'filter.tool', errs)

def deep_parts(o, where, errs):
    """Find scopes, filters, targets, apply and cost anywhere inside a block."""
    if isinstance(o, dict):
        for k, v in o.items():
            if k == 'scope': check_scope(v, where, errs)
            elif k in ('from',) and isinstance(v, dict) and not ({'slot', 'resource'} & set(v)): check_filter(v, where, errs)
            elif k == 'choose-on-use' and isinstance(v, dict): check_filter(v, where, errs)
            elif k == 'targets': check_keys(v, TARGETS, where, 'targets', errs)
            elif k == 'apply': check_keys(v, APPLY, where, 'apply', errs)
            elif k == 'cost': check_keys(v, COST, where, 'cost', errs)
            elif k == 'who': check_keys(v, WHO, where, 'who', errs)
            elif k == 'save' and isinstance(v, dict): check_keys(v, SAVE, where, 'save', errs)
            deep_parts(v, where, errs)
    elif isinstance(o, list):
        for v in o: deep_parts(v, where, errs)

PATHS = re.compile(r"^(score|score-max|save|check|skill|speed|sense|passive|spell|hp|attunement|carry|save-dc):[\w-]+$|^damage\.ability-mod$|"
                   r"^(initiative|ac|attack|damage|healing|attacks-per-action|crit-range|death-save|concentration|jump|range|crits-against-you|checks-to-perceive-you|hit-die-healing|reach|hits-against-you|"
                   r"attacks-against-you|d20)$")
def check_paths(body, name, where, errs):
    for field in ('to', 'roll'):
        v = body.get(field) if isinstance(body, dict) else None
        if v is None or name in ('convert', 'variant'): continue
        for p in (v if isinstance(v, list) else [v]):
            if isinstance(p, str) and not PATHS.match(p): errs.append(f"{where}: '{name}' {field} has unknown stat path '{p}'")

OPTION_FORMS = {'headings-under'}

def norm(c): return re.sub(r'[^a-z0-9 ]', '', c.lower()).strip()
def table_cols(f):
    md = (SRD / f).read_text()
    return {norm(c) for h in re.findall(r'^\| Level \|(.+)\|$', md, re.M) for c in h.split('|')}
TABLES = {c: table_cols(f'classes/{c}.md') for c in ('fighter', 'rogue', 'cleric', 'druid', 'warlock', 'barbarian', 'bard', 'monk', 'paladin', 'ranger', 'sorcerer', 'wizard')}
def secondary_tables(f):
    md = (SRD / f).read_text(); out = {}
    for name, head in re.findall(r'^#### (.+)\n+\|((?: [^|\n]+ \|)+)$', md, re.M):
        out[name.strip()] = {norm(c) for c in head.split('|') if c.strip()}
    return out
PARENT = {}
for sf in (SRD / 'subclasses').glob('*.md'):
    m = re.search(r'^\*\*Parent:\*\* (\w+)', sf.read_text(), re.M)
    if m: PARENT[sf.stem] = m.group(1).lower()
SECONDARY = {c: secondary_tables(f'classes/{c}.md') for c in ('druid', 'barbarian', 'bard', 'monk', 'paladin', 'ranger', 'sorcerer', 'wizard', 'cleric', 'warlock', 'fighter', 'rogue')}

def validate(fname, data):
    errs = []
    tables = TABLES.get(fname) or TABLES.get(PARENT.get(fname), set())
    ids, refs, choice_ids, choice_refs = set(), set(), set(), set()

    def keys_reserved(o, where):
        if isinstance(o, dict):
            for k, v in o.items():
                if isinstance(k, bool) or str(k).lower() in RESERVED: errs.append(f"{where}: reserved word used as a key ({k!r})")
                if isinstance(k, str) and ('(' in k or ')' in k): errs.append(f"{where}: key {k!r} looks like the tail of an unquoted expression with a comma")
                keys_reserved(v, where)
        elif isinstance(o, list):
            for v in o: keys_reserved(v, where)

    def value(v, where, field):
        if isinstance(v, str) and v.count('(') != v.count(')'):
            errs.append(f"{where}: {v!r} has unbalanced brackets (an unquoted comma split the expression?)"); return
        if not isinstance(v, str) or field in NOT_VALUES: return
        if v.startswith('$') or v in ('self', 'weapon', 'spell', 'half', 'any', 'all', 'chosen', 'always', 'long', 'short', 'dawn'): return
        if re.fullmatch(r'[a-z][a-z-]*(:[a-z][a-z-]*)?', v): return   # enum-ish words and paths (fire, save:dex, skill:stealth)
        for m in re.finditer(r'table:([A-Za-z’\' ]+?)(?:\.([A-Za-z ]+))?(?=\s*[+\-*/),]|$)', v):
            if m.group(2):
                sec = (SECONDARY.get(fname) or SECONDARY.get(PARENT.get(fname), {})).get(m.group(1).strip())
                if sec is None or norm(m.group(2)) not in sec: errs.append(f"{where}: secondary table column not found '{m.group(1).strip()}.{m.group(2).strip()}'")
            elif tables and norm(m.group(1)) not in tables: errs.append(f"{where}: table column not found '{m.group(1).strip()}'")
        rest = TOKEN.sub('', v)
        if re.sub(r'[\s+\-*/(),.]', '', rest): errs.append(f"{where}: value doesn't parse: {v!r} (left over: {rest.strip()!r})")

    def scan_values(o, where, field=None):
        if field == 'params': return   # a custom handler's own data
        if isinstance(o, dict):
            if 'steps' in o:
                if not isinstance(o['steps'], dict): errs.append(f"{where}: steps must map levels to values")
            for k, v in o.items(): scan_values(v, where, k)
        elif isinstance(o, list):
            for v in o: scan_values(v, where, field)
        else:
            value(o, where, field.split('.')[-1] if isinstance(field, str) else field)
            if isinstance(o, str):
                refs.update(re.findall(r'\$#([\w-]+)', o)); choice_refs.update(re.findall(r'choice:([\w-]+)', o))

    def when(w, where):
        if not isinstance(w, dict): return
        for k, v in w.items():
            if k.split(':')[0] not in WHEN: errs.append(f"{where}: unknown when key '{k}'")
            if k in ('all', 'any'): [when(x, where) for x in v]
            if k == 'not': when(v, where)

    def block(b, where):
        if isinstance(b, str):
            errs.append(f"{where}: phrase {b!r} isn't Modif; write a block"); return
        if not isinstance(b, dict) or len(b) != 1:
            errs.append(f"{where}: a block must be a one-key mapping, got {b!r:.60}"); return
        (name, body), = b.items()
        if name not in BLOCKS: errs.append(f"{where}: unknown block '{name}'"); return
        allowed = BLOCKS[name]
        if isinstance(body, dict):
            if 'id' in body: ids.add(body['id'])
            if name == 'spellcasting': ids.add(body.get('id', 'spellcasting'))
            if allowed is not None:
                for k in body:
                    if k not in allowed: errs.append(f"{where}: '{name}' has unknown field '{k}'")
            if 'when' in body: when(body['when'], where)
            d = body.get('duration')
            if isinstance(d, dict) and d.get('until') and d['until'] not in UNTIL: errs.append(f"{where}: unknown until '{d['until']}'")
            if name == 'custom':
                h = body.get('handler')
                if not isinstance(h, str) or not h: errs.append(f"{where}: custom needs a handler name")
                elif HANDLERS is not None and h not in HANDLERS: errs.append(f"{where}: unknown custom handler '{h}' (known: {', '.join(sorted(HANDLERS)) or 'none'})")
                if not body.get('text'): errs.append(f"{where}: custom needs text (shown when the app doesn't know the handler)")
            if name == 'choose':
                choice_ids.add(body.get('id'))
                kk = body.get('kind'); kk = kk if isinstance(kk, list) else [kk]
                for k in kk:
                    if k not in KINDS: errs.append(f"{where}: unknown choose kind '{k}'")
                opts = body.get('options') or []
                if isinstance(opts, dict):
                    if set(opts) - {'headings-under'}: errs.append(f"{where}: unknown options form {list(opts)}")
                    elif 'headings-under' not in OPTION_FORMS: errs.append(f"{where}: options defined under their own headings ('headings-under') not in spec")
                    opts = []
                for opt in opts:
                    for e in (opt.get('effects') or []): block(e, where + ' › option')
            if name == 'trigger':
                ev = body.get('event'); evs = ev if isinstance(ev, list) else [ev]
                for e in evs:
                    k = e if isinstance(e, str) else (next(iter(e)) if isinstance(e, dict) else None)
                    if k not in EVENTS: errs.append(f"{where}: unknown trigger event {k!r}")
                offer = body.get('offer') or {}
                for k in offer:
                    if k not in PAYLOAD: errs.append(f"{where}: unknown trigger payload '{k}'")
                for opt in offer.get('choose-one', []) or []:
                    for k in opt:
                        if k not in PAYLOAD | {'move', 'save'}: errs.append(f"{where}: unknown option field '{k}'")
            if name == 'action':
                takes = [body.get('take')] + [o.get('take') for o in (body.get('choose-one') or []) if isinstance(o, dict)]
                for t in takes:
                    for x in (t if isinstance(t, list) else [t]):
                        if x and x not in ACTIONS: errs.append(f"{where}: unknown standard action '{x}'")
            if 'choose' in body and isinstance(body['choose'], dict) and name != 'choose':
                choice_ids.add(body['choose'].get('id'))
            for e in body.get('effects') or []: block(e, where + f' › {name}')
            for e in body.get('on-end') or []:
                if not (isinstance(e, dict) and len(e) == 1 and next(iter(e)) in PAYLOAD): block(e, where + f' › {name}')
            for co in [body.get('choose-one')] + [(body.get('offer') or {}).get('choose-one')]:
                for opt in co or []:
                    if isinstance(opt, dict):
                        for e in opt.get('effects') or []: block(e, where + f' › {name} option')
            if name == 'modify' and isinstance(body.get('add'), dict):
                pass
        scan_values(body, where)
        deep_parts(body, where, errs)
        check_paths(body, name, where, errs)

    keys_reserved(data, fname)
    for feature, blocks in data.items():
        for b in blocks: block(b, f"{fname} [{feature}]")
    for r in refs - ids: errs.append(f"{fname}: unresolved local reference $#{r}")
    for c in choice_refs - choice_ids: errs.append(f"{fname}: choice:{c} used but not defined in this entry")
    return errs

def md_effects(path):
    """Effects blocks in a pack Markdown file: {feature heading: [blocks]} (headings without 'Level N: ')."""
    lines = pathlib.Path(path).read_text().splitlines()
    out, cur, fence, entry = {}, None, False, None
    i = 0
    while i < len(lines):
        l = lines[i]
        if re.match(r'^\s*(```|~~~)', l): fence = not fence
        if not fence and re.match(r'^# \S', l): entry = cur = l[2:].strip()
        elif not fence and re.match(r'^#{2,6}\s', l):
            title = re.sub(r'^#+\s+', '', l).strip()
            nxt = next((x for x in lines[i + 1:] if x.strip()), '')
            if title.lower() == 'effects' and re.match(r'^\s*```ya?ml\s*$', nxt, re.I):
                j = lines.index(nxt, i + 1) + 1
                k = j
                while k < len(lines) and not re.match(r'^\s*```\s*$', lines[k]): k += 1
                key = re.sub(r'^Level \d+:\s*', '', cur or entry or '?')
                key = key.replace('(', '').replace(')', '')  # entry names like "Stone of Good Luck (Luckstone)"
                out.setdefault(key, []).extend(yaml.safe_load('\n'.join(lines[j:k])) or [])
                i = k + 1
                continue
            cur = title
        i += 1
    return out

if __name__ == '__main__':
    folder = sys.argv[1] if len(sys.argv) > 1 else str(SRD)
    total_f = total_b = 0; all_errs = []
    md_files = sorted(glob.glob(f'{folder}/**/*.md', recursive=True))
    if md_files:  # a content pack: read the Effects blocks out of each entry file
        for path in md_files:
            data = md_effects(path)
            if not data: continue
            name = pathlib.Path(path).stem
            # the entry's own named tables ("**Psi Warrior Energy Dice**" or "#### …" above a table) for table:<Table>.<column>
            md = pathlib.Path(path).read_text(encoding='utf-8')
            own = {n.strip(): {norm(c) for c in h.split('|') if c.strip()}
                   for n, h in re.findall(r'^(?:#### (.+)|\*\*(.+?)\*\*)\n+\|((?: [^|\n]+ \|)+)$', md, re.M) and
                   [(a or b, h) for a, b, h in re.findall(r'^(?:#### (.+)|\*\*(.+?)\*\*)\n+\|((?: [^|\n]+ \|)+)$', md, re.M)]}
            if own: SECONDARY[name] = {**SECONDARY.get(PARENT.get(name), {}), **own}
            nf, nb = len(data), sum(len(v) for v in data.values()); total_f += nf; total_b += nb
            errs = validate(name, data)
            try:
                import jsonschema
                sp = pathlib.Path(__file__).resolve().parent / 'modif.schema.json'
                if sp.exists():
                    V = jsonschema.Draft202012Validator(json.load(open(sp)))
                    errs += [f"{name} {list(e.absolute_path)}: schema: {e.message[:140]}" for e in V.iter_errors({str(k): x for k, x in data.items()})]
            except ImportError:
                pass
            all_errs += errs
            print(f"{name:12} {nf:3} features {nb:3} blocks  {len(errs):2} issues")
        print(f"TOTAL {total_f} features, {total_b} blocks, {len(all_errs)} issues")
        for e in all_errs: print('  ', e)
        sys.exit(1 if all_errs else 0)
    for path in sorted(glob.glob(f'{folder}/*.yaml')):
        name = pathlib.Path(path).stem
        data = yaml.safe_load(open(path))
        nf, nb = len(data), sum(len(v) for v in data.values()); total_f += nf; total_b += nb
        errs = validate(name, data); all_errs += errs
        print(f"{name:12} {nf:3} features {nb:3} blocks  {len(errs):2} issues")
    # value checks (enums, nested objects) from the JSON Schema, when it and the jsonschema package are available
    schema_path = pathlib.Path(__file__).resolve().parent / 'modif.schema.json'
    try:
        import jsonschema
        if schema_path.exists():
            V = jsonschema.Draft202012Validator(json.load(open(schema_path)))
            for path in sorted(glob.glob(f'{folder}/*.yaml')):
                data = {str(k): x for k, x in yaml.safe_load(open(path)).items()}
                for e in V.iter_errors(data):
                    msg = f"{pathlib.Path(path).stem} {list(e.absolute_path)}: schema: {e.message[:140]}"
                    if not any(str(e.absolute_path[-1]) in m for m in all_errs[-50:]) or e.validator == 'enum':
                        all_errs.append(msg)
    except ImportError:
        print('(jsonschema not installed: value checks skipped)')
    print(f"TOTAL {total_f} features, {total_b} blocks, {len(all_errs)} issues")
    for e in all_errs: print('  ', e)
