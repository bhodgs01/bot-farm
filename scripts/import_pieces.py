"""Import a batch of set-piece functions into src/world/buildings.js.

    python scripts/import_pieces.py <file-from-chatgpt.js> [--dry]

The file may be a bare list of functions, a `const KINDS = { ... }` object, or markdown with
```js fences; anything outside `name(c, rand) { ... },` blocks is ignored, and any indentation
is accepted. A function whose name already exists replaces the old one in place; a new name is
added before `tower` and excluded from the random pick (set pieces are chosen by zone, never at
random).
"""
import re, sys, subprocess

TARGET = 'src/world/buildings.js'
# A block: `<indent>name(c[, rand][, accent]) {` ... `<same indent>},` (trailing comma optional)
BLOCK_RE = re.compile(
    r'^([ \t]*)(\w+)\((c(?:, rand)?(?:, accent)?)\) \{[ \t]*\n(.*?)^\1\},?[ \t]*\n',
    re.M | re.S,
)


def functions(src):
    """Every block in `src`, re-indented to the two spaces the KINDS object uses."""
    src = re.sub(r'^```\w*[ \t]*$', '', src, flags=re.M)
    out = {}
    for m in BLOCK_RE.finditer(src):
        indent, name, args, body = m.group(1), m.group(2), m.group(3), m.group(4)
        lines = body.split('\n')
        lines = [ln[len(indent):] if ln.startswith(indent) else ln for ln in lines]
        body = '\n'.join(('  ' + ln) if ln.strip() else '' for ln in lines)
        out[name] = '  %s(%s) {\n%s  },\n' % (name, args, body)
    return out


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    dry = '--dry' in sys.argv
    incoming = functions(open(sys.argv[1], encoding='utf8').read())
    if not incoming:
        print('no functions found in', sys.argv[1])
        sys.exit(2)
    s = open(TARGET, encoding='utf8').read()
    start = s.index('const KINDS = {')
    end = s.index('\n}\n', start) + 1
    kinds = s[start:end]
    existing = {m.group(2): m.group(0) for m in BLOCK_RE.finditer(kinds)}
    replaced, added, rejected = [], [], []
    for name, code in incoming.items():
        if 'Math.random' in code or 'import ' in code or 'new THREE.Mesh' in code:
            rejected.append(name)
            continue
        if name in existing:
            kinds = kinds.replace(existing[name], code, 1)
            replaced.append(name)
        else:
            anchor = '  tower(c, rand) {'
            kinds = kinds.replace(anchor, code + '\n' + anchor, 1)
            added.append(name)
    s = s[:start] + kinds + s[end:]
    if added:
        m = re.search(r"const KIND_IDS = Object\.keys\(KINDS\)\.filter\(\(k\) => !\[(.*?)\]\.includes\(k\)\)", s)
        assert m, 'KIND_IDS exclusion list not found'
        lst = m.group(1) + ''.join(", '%s'" % n for n in added)
        s = s[:m.start(1)] + lst + s[m.end(1):]
    print('replaced:', ', '.join(replaced) or '-')
    print('added:   ', ', '.join(added) or '-')
    if rejected:
        print('rejected:', ', '.join(rejected), '(Math.random / import / Mesh)')
    if dry:
        print('(dry run, nothing written)')
        return
    open(TARGET, 'w', encoding='utf8', newline='\n').write(s)
    r = subprocess.run(['node', '--check', TARGET], capture_output=True, text=True)
    print('node --check:', 'OK' if r.returncode == 0 else r.stderr[:800])
    sys.exit(r.returncode)


main()
