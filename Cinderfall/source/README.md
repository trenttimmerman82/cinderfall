# Cinderfall

A first-person shooter that runs in the browser, built with [three.js](https://threejs.org).
Cinder Station's security AI has turned its machines on the night shift. Clear the yard,
restore power, hold the uplink, and take down the Warden.

**Play:** open `index.html` in a desktop browser, or use this repository's GitHub Pages link.
You need a mouse and keyboard.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Look |
| Left click | Fire |
| Right click | Aim down sights |
| Shift | Sprint · steady the scope |
| Space | Jump · climb ledges |
| C | Crouch · slide while sprinting |
| R | Reload |
| E | Interact (hold) |
| G | Throw grenade |
| V | Melee |
| 1–4 · mouse wheel | Switch weapon |
| Esc | Pause |

## Single-file build

Run `python3 build.py` to write `dist/Cinderfall.html`, a single file with three.js inlined that runs offline.

All textures, sound and music are generated in code. three.js is MIT-licensed.
