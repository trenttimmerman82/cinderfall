# Cinderfall

A first-person shooter that runs in the browser, built with [three.js](https://threejs.org).
It is set in a rain-soaked neon city.

- **Campaign.** The foundry's security AI has turned its machines on the night shift. Clear the yard,
  restore power, hold the uplink, and take down the Warden.
- **Multiplayer.** Play online with friends: free-for-all or team deathmatch (Voltage vs Ronin) on two maps,
  **Neon Market** and **Skyline**, with four loadouts.

**Play:** open this repository's GitHub Pages link in a desktop browser. You need a mouse and keyboard.

## Multiplayer

1. One player picks **Multiplayer**, chooses a map and mode, and clicks **Host match**. A 5-character room code appears.
2. Friends open the same page, pick **Multiplayer**, type the code and click **Join match**.
3. Everyone picks a loadout and clicks **Deploy**.

Up to 8 players. Connections are peer-to-peer (WebRTC through [PeerJS](https://peerjs.com)); the host's browser runs the
scoreboard and relays everyone's moves, so the host should have the best connection. Online play needs internet access.
Some strict school or office networks block peer-to-peer connections.

| Loadout | Weapons | Perk |
| --- | --- | --- |
| Assault | M7 carbine + P-11 pistol | — |
| Breacher | KS-12 shotgun + P-11 | Starts with 50 armor |
| Marksman | VX-3 rail rifle + P-11 | One-shot headshots |
| Runner | Hex-9 SMG + P-11 | 8% faster |

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Look |
| Left click | Fire |
| Right click · Tab · F | Aim down sights (Tab or F toggles, for trackpads) |
| Shift | Sprint · steady the scope |
| Space | Jump · climb ledges |
| C | Crouch · slide while sprinting |
| R | Reload |
| E | Interact (hold) |
| G | Throw grenade |
| V | Melee |
| 1–4 · mouse wheel | Switch weapon (multiplayer: pick a loadout while respawning) |
| Esc | Pause · multiplayer menu |

These are the defaults. Every key can be rebound in **Settings → Key bindings** (keyboard keys plus middle and side mouse buttons). The settings page also has toggle crouch/sprint, click-to-toggle aiming, crosshair color, view bob, brightness and film grain.

## Running it

No build step is needed. `index.html` loads three.js and PeerJS from a CDN, so you can:

- **GitHub Pages:** push this repo and turn on Pages for the `main` branch (root folder).
- **Locally:** run `python3 -m http.server 8000` in this folder and open http://localhost:8000.

## Single-file build

Run `python3 build.py` to write `dist/Cinderfall.html`, a single file with three.js and PeerJS inlined.
The campaign runs offline; multiplayer needs internet access.

All textures, sound and music are generated in code. three.js and PeerJS are MIT-licensed.
