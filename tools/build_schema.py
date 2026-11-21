"""build_schema: generate modif.schema.json (JSON Schema 2020-12) from the validator's vocabulary.

The schema gives editors autocomplete and checks field names and enum values. Expression grammar, references and
table columns stay in modif_check.py (JSON Schema can't express them).
Usage: python3 build_schema.py <out.json>
"""
import json, sys
import modif_check as v

ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha']
CONDITIONS = ['blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'grappled', 'incapacitated', 'invisible', 'paralyzed',
              'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious', 'burning', 'magical-sleep']
STATES = ['bloodied', 'zero-hp']                         # target states usable where a condition filter is expected
DAMAGE = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant',
          'slashing', 'thunder', 'all']
ACTIONS = sorted(v.ACTIONS)
ACTIVATION = ['action', 'bonus', 'reaction', 'magic', 'none', 'replace-attack', 'attack-action', 'forgo-attack', 'start-of-turn'] + ACTIONS
SHAPES = ['sphere', 'cube', 'cone', 'line', 'cylinder', 'emanation', 'square', 'circle', 'wall', 'ring', 'dome', 'globe', 'panels']
UNITS = ['round', 'turn', 'minute', 'hour', 'day', 'year', 'hp', 'feet-of-movement']
UNTIL = sorted(v.UNTIL | {'start-of-target-next-turn', 'end-of-target-next-turn', 'end-of-target-turn', 'dawn', 'long-rest', 'midnight'})
RESET = ['short', 'long', 'dawn', 'dusk', 'initiative', 'never']
DELIVERY = ['contact', 'ingested', 'inhaled', 'injury']
SUCCESS = ['half', 'none', 'special']

ref = lambda n: {'$ref': f'#/$defs/{n}'}
ref_pattern = r'^(choice:|variant:|\$|chosen$|spell-ability$)'
enum_or_ref = lambda vals: {'anyOf': [{'enum': vals}, {'type': 'string', 'pattern': ref_pattern}, {'type': 'object'}]}
one_or_list = lambda s: {'anyOf': [s, {'type': 'array', 'items': s}]}

FIELD_SCHEMAS = {
    'condition': one_or_list(enum_or_ref(CONDITIONS + STATES)),
    'activation': {'anyOf': [{'enum': ACTIVATION}, ref('timed'), {'type': 'array', 'items': {'enum': ACTIVATION}}]},
    'ability': one_or_list(enum_or_ref(ABILITIES)),
    'delivery': {'enum': DELIVERY},
    'success': {'enum': SUCCESS},
    'until': {'anyOf': [{'enum': UNTIL}, {'type': 'object'}]},
    'unit': {'enum': UNITS},
    'shape': {'enum': SHAPES},
    'take': one_or_list({'enum': ACTIONS}),
    'events': {},
}
NESTED = {   # nested objects checked strictly (additionalProperties false)
    'save': v.SAVE, 'apply': v.APPLY, 'cost': v.COST, 'targets': v.TARGETS, 'who': v.WHO,
}

def body_schema(fields):
    if fields is None:
        return {}
    props = {f: FIELD_SCHEMAS.get(f, {}) for f in sorted(fields)}
    for f in ('effects', 'on-end'):
        if f in props: props[f] = {'type': 'array', 'items': ref('block')}
    for f, keys in NESTED.items():
        if f in props: props[f] = ref(f)
    return {'type': 'object', 'properties': props, 'additionalProperties': False}

def nested_schema(keys):
    props = {k: FIELD_SCHEMAS.get(k, {}) for k in sorted(keys)}
    if 'effects' in props: props['effects'] = {'type': 'array', 'items': ref('block')}
    if 'save' in props: props['save'] = ref('save')
    return {'type': 'object', 'properties': props, 'additionalProperties': False}

schema = {
    '$schema': 'https://json-schema.org/draft/2020-12/schema',
    '$id': 'https://github.com/ericthelefty/fivepointfive/modif/modif.schema.json',
    'title': 'Modif effects (one entry: feature heading -> list of blocks)',
    'type': 'object',
    'additionalProperties': {'type': 'array', 'items': ref('block')},
    '$defs': {
        'timed': {'type': 'object', 'properties': {'amount': {}, 'unit': {'enum': UNITS}}, 'required': ['amount', 'unit'], 'additionalProperties': False},
        'block': {
            'type': 'object', 'minProperties': 1, 'maxProperties': 1, 'additionalProperties': False,
            'properties': {name: (body_schema(fields) if fields is not None else {}) for name, fields in sorted(v.BLOCKS.items())},
        },
        **{k: nested_schema(keys) for k, keys in NESTED.items()},
        'enums': {'conditions': CONDITIONS, 'damage-types': DAMAGE, 'abilities': ABILITIES, 'activation': ACTIVATION, 'shapes': SHAPES,
                  'units': UNITS, 'until': UNTIL, 'reset': RESET, 'delivery': DELIVERY, 'events': sorted(v.EVENTS),
                  'payloads': sorted(v.PAYLOAD), 'when': sorted(v.WHEN), 'choose-kinds': sorted(v.KINDS)},
    },
}
# list-form blocks: allow either an array of strings/objects or an object (e.g. `score: { cha: 1 }`)
json.dump(schema, open(sys.argv[1] if len(sys.argv) > 1 else 'modif.schema.json', 'w'), indent=1)
print('blocks:', len(v.BLOCKS), '| enum lists:', len(schema['$defs']['enums']))
