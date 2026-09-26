#!/usr/bin/env python3
"""Build dist/Cinderfall.html: one self-contained file (three.js, PeerJS, CSS and all game scripts inlined)."""
import os, re, urllib.request
here = os.path.dirname(os.path.abspath(__file__))
os.chdir(here)
LIBS = [
    'https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js',
    'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js',
]


def inline(code):
    code = re.sub(r'//[#@] sourceMappingURL=\S+\s*$', '', code)  # no .map file next to the build
    return '<script>\n' + code.replace('</script', '<\\/script') + '\n</script>'


s = open('index.html', encoding='utf-8').read()
s = s.replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + open('css/style.css', encoding='utf-8').read() + '\n</style>')
for url in LIBS:
    tag = '<script src="' + url + '"></script>'
    assert tag in s, url
    lib = urllib.request.urlopen(url).read().decode('utf-8')
    s = s.replace(tag, inline(lib))
s, n = re.subn(r'<script src="(js/[a-z\-]+\.js)"></script>',
               lambda m: inline('/* ' + m.group(1) + ' */\n' + open(m.group(1), encoding='utf-8').read()), s)
# optional content the game loads on demand (CF.lazy): carried along as inert text so the offline file still has it
LAZY = ['js/enemy-models-enhanced.js']
lazy = ''.join('<script type="text/plain" data-lazy="' + f + '">\n' + open(f, encoding='utf-8').read().replace('</script', '<\\/script') + '\n</script>\n' for f in LAZY)
i = s.rfind('</body>')
s = s[:i] + lazy + s[i:]
os.makedirs('dist', exist_ok=True)
open('dist/Cinderfall.html', 'w', encoding='utf-8').write(s)
print('dist/Cinderfall.html:', n, 'scripts inlined,', round(len(s) / 1024), 'KB')
