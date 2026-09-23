#!/usr/bin/env python3
"""Build dist/Cinderfall.html: one self-contained file (three.js, CSS and all game scripts inlined)."""
import os, re, urllib.request
here = os.path.dirname(os.path.abspath(__file__))
os.chdir(here)
THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js'
s = open('index.html', encoding='utf-8').read()
s = s.replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + open('css/style.css', encoding='utf-8').read() + '\n</style>')
three = urllib.request.urlopen(THREE_URL).read().decode('utf-8')
s = s.replace('<script src="' + THREE_URL + '"></script>', '<script>\n' + three + '\n</script>')
s, n = re.subn(r'<script src="(js/[a-z\-]+\.js)"></script>',
               lambda m: '<script>\n/* ' + m.group(1) + ' */\n' + open(m.group(1), encoding='utf-8').read() + '\n</script>', s)
os.makedirs('dist', exist_ok=True)
open('dist/Cinderfall.html', 'w', encoding='utf-8').write(s)
print('dist/Cinderfall.html:', n, 'scripts inlined,', round(len(s) / 1024), 'KB')
