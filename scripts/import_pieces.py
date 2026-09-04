"""Import a batch of set-piece functions into src/world/buildings.js.

    python scripts/import_pieces.py <file-from-chatgpt.js> [--dry]

The file may be a bare list of functions, a `const KINDS = { ... }` object, or markdown with
```js fences; anything outside `  name(c, rand) { ... },` blocks is ignored. A function whose
name already exists replaces the old one in place; a new name is added before `tower` and
excluded from the random pick (set pieces are chosen by zone, never at random).
"""
import re, sys, subprocess

TARGET = 'src/world/buildings.js'
FUNC_RE = re.compile(r'^  (\w+)\((c(?:, rand)?(?:, accent)?)\) \{\n(.*?)^  \},\n', re.M | re.S)

def functions(src):
    src = re.sub(r'^```\w*\n|^```\s*$', '', src, flags=re.M)
    # normalise indentation: ChatGPT often returns top-level functions with 0 or 4 spaces
    lines = src.split('\n')
    out = []
    for ln in lines:
        m = re.match(r'^(\s*)(\w+)\((c(?:, rand)?(?:, accent)?)\) \{\s*$', ln)
        out.append(ln)
    src = '\n'.join(out)
    # re-indent blocks whose opening line is not at two spaces
    src = re.sub(r'^(\s*)(?=\w+\(c(?:, rand)?(?:, accent)?\) \{\s*$)', '  ', src, flags=re.M)
    return {m.group(1): m.group(0) for m in FUNC_RE.finditer(src)}

def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    dry = '--dry' in sys.argv
    incoming = functions(open(sys.argv[1], encoding='utf8').read())
    if not incoming:
        print('no functions found in', sys.argv[1]); sys.exit(2)
    s = open(TARGET, encoding='utf8').read()
    start = s.index('const KINDS = {')
    end = s.index('\n}\n', start) + 1
    kinds = s[start:end]
    existing = {m.group(1): m.group(0) for m in FUNC_RE.finditer(kinds)}
    replaced, added = [], []
    for name, code in incoming.items():
        # every function must be balanced and only use the allowed surface
        if 'Math.random' in code or 'import ' in code or 'new THREE.Mesh' in code:
            print('REJECTED', name, ': uses Math.random / import / Mesh'); continue
        if name in existing:
            kinds = kinds.replace(existing[name], code, 1); replaced.append(name)
        else:
            anchor = '  tower(c, rand) {'
            kinds = kinds.replace(anchor, code + '\n' + anchor, 1); added.append(name)
    s = s[:start] + kinds + s[end:]
    if added:
        m = re.search(r"const KIND_IDS = Object\.keys\(KINDS\)\.filter\(\(k\) => !\[(.*?)\]\.includes\(k\)\)", s)
        assert m, 'KIND_IDS exclusion list not found'
        lst = m.group(1) + ''.join(f", '{n}'" for n in added)
        s = s[:m.start(1)] + lst + s[m.end(1):]
    print('replaced:', ', '.join(replaced) or '-')
    print('added:   ', ', '.join(added) or '-')
    if dry:
        print('(dry run, nothing written)'); return
    open(TARGET, 'w', encoding='utf8', newline='\n').write(s)
    r = subprocess.run(['node', '--check', TARGET], capture_output=True, text=True)
    print('node --check:', 'OK' if r.returncode == 0 else r.stderr[:800])
    sys.exit(r.returncode)

main()
