# Cinderfall

A first-person shooter that runs in the browser, built with [three.js](https://threejs.org).
It is set in a rain-soaked neon city.

- **Campaign.** The foundry's security AI has turned its machines on the night shift. Clear the yard,
  restore power, hold the uplink, and take down the Warden. You start with a carbine and a pistol; each objective
  unlocks another weapon (shotgun, satchel charges, rail rifle, minigun, RPG). Three threat levels, and a
  **No drones** option (no enemy Hornet drones) that works with any of them.
- **Kill streak.** 5 kills within 30 seconds earns an attack drone with 60 rounds.
- **Multiplayer.** Play online with friends: free-for-all or team deathmatch (Voltage vs Ronin) on
  **Neon Market**, **Skyline** and **Nuketown**, with six loadouts. Kill-streak drones work here too.
- **Global leaderboard.** Campaign runs are ranked against everyone who plays (needs the game server below).

**Play:** open this repository's GitHub Pages link in a desktop browser. You need a mouse and keyboard.

## Multiplayer

1. One player picks **Multiplayer**, chooses a map and mode, and clicks **Host match**. A 5-character room code appears.
2. Friends open the same page, pick **Multiplayer**, type the code and click **Join match**.
3. Everyone picks a loadout and clicks **Deploy**.

Up to 8 players. Players first try a direct peer-to-peer link (WebRTC through [PeerJS](https://peerjs.com)). If a router or
school/office Wi-Fi blocks it, they switch to the relay on the Cinderfall server after a few seconds (see **Game server** below).
The relay works on any network that can open ordinary websites. The host's browser runs the scoreboard and passes everyone's
moves along, so the host should have the best connection.

| Loadout | Weapons | Perk |
| --- | --- | --- |
| Assault | M7 carbine + P-11 pistol | — |
| Breacher | KS-12 shotgun + P-11 | Starts with 50 armor |
| Marksman | VX-3 rail rifle + P-11 | One-shot headshots |
| Runner | M7 carbine + P-11 | 8% faster, one grenade |
| Heavy | Rotor-6 minigun + P-11 | Starts with 50 armor, 10% slower |
| Demolition | Havoc RPG + satchel charges + P-11 | — |

## Game server (global leaderboard and multiplayer relay)

`server/` is a small [Cloudflare Worker](https://developers.cloudflare.com/workers/) that stores the global campaign leaderboard and relays
multiplayer traffic when a direct connection is blocked. It fits in Cloudflare's free plan. Without it the game still works:
the leaderboard stays on each computer and multiplayer is peer-to-peer only.

1. Make a free account at [dash.cloudflare.com](https://dash.cloudflare.com/sign-up).
2. In this folder run `cd server && npx wrangler login`, then `npx wrangler deploy`.
3. Copy the `https://cinderfall.<your-subdomain>.workers.dev` address it prints into `js/config.js` (`CF.SERVER = '…'`), then commit and push.

To try it locally, run `npx wrangler dev` in `server/` and set `CF.SERVER = 'http://127.0.0.1:8787'`.

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
| 1–7 · mouse wheel | Switch weapon (multiplayer: pick a loadout while respawning) |
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
