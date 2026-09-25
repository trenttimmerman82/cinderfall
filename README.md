# Cinderfall

A first-person shooter that runs in the browser, built with [three.js](https://threejs.org).
It is set in a rain-soaked neon city.

- **Campaign: Cinder Foundry.** The foundry's security AI has turned its machines on the night shift. Clear the yard,
  restore power, hold the uplink, and take down the Warden. You start with a carbine and a pistol; each objective
  unlocks another weapon (shotgun, satchel charges, rail rifle, minigun, RPG).
- **Campaign: Whiteout.** Halden Deep, a drilling station in Antarctica, went silent nine days ago. Something came up the
  borehole. Six parts: land at the depot and find Dr. Varga's log, restore the comms mast, cross the crevasse field in a
  whiteout (keep warm at the heat beacons), destroy the crystal blooms, kill the Rime Heart in the Hollow, then outrun
  the collapsing ice shelf to the extraction aircraft. New enemies (Thralls, Skitters, Frost Drones, a Colossus), its own
  music, weather and weapon progression.
- Both campaigns have three threat levels and a **No drones** option (no enemy drones) that works with any of them.
- **Kill streak.** 5 kills within 30 seconds earns an attack drone with 60 rounds.
- **Multiplayer.** Play online with friends: free-for-all, team deathmatch (Voltage vs Ronin) or **Revolver One-Shot**
  (revolvers only, every hit kills) on **Neon Market**, **Skyline** and **Nuketown**, with six loadouts. Kill-streak drones
  work here too. Nuketown has an **RC-XD** chest: take it, drive the bomb car on a chase camera while your body stands
  shielded, and blow it up.
- **Saves.** Campaign progress saves at every checkpoint, separately for each campaign, and survives closing the tab.
- **Coins, crates and the Locker.** Clearing campaign parts earns coins; crates hold weapon finishes and operative suits
  (Common to Legendary) that other players see in multiplayer. Taking #1 on a leaderboard unlocks the Champion gear.
- **Global leaderboard.** Campaign runs are ranked against everyone who plays, separately for each campaign and drone
  mode. Each board shows the top 10 and your own rank (needs the game server below).

**Play:** open this repository's GitHub Pages link in a desktop browser. You need a mouse and keyboard.

## Multiplayer

1. One player picks **Multiplayer**, chooses a map and mode, and clicks **Host match**. A 5-character room code appears.
2. Friends open the same page, pick **Multiplayer**, type the code and click **Join match**.
3. Everyone picks a loadout and clicks **Deploy**.

Up to 8 players. Players first try a direct peer-to-peer link (WebRTC through [PeerJS](https://peerjs.com)). If a router or
school/office Wi-Fi blocks it, they switch to the relay on the Cinderfall server after a few seconds (see **Game server** below).
The relay works on any network that can open ordinary websites. The host's browser runs the scoreboard and passes everyone's
moves along, so the host should have the best connection.

Direct links send positions on a separate fast channel that never re-sends lost packets, so one dropped packet can't
hold up the newer ones. Other players are drawn 100 ms in the past so their movement can be blended smoothly between
updates. That delay is `CF.NET.interp` in `js/config.js`; `?interp=60` in the page address tries another value.

**Performance overlay:** press **F3** in game to see frame time (game logic vs. rendering), draw calls, render
resolution and, in multiplayer, each player's link type, ping and bandwidth.

| Loadout | Weapons | Perk |
| --- | --- | --- |
| Assault | M7 carbine + P-11 pistol | — |
| Breacher | KS-12 shotgun + P-11 | Starts with 50 armor |
| Marksman | VX-3 rail rifle + P-11 | One-shot headshots |
| Runner | M7 carbine + P-11 | 8% faster, one grenade |
| Heavy | Rotor-6 minigun + P-11 | Starts with 50 armor, 10% slower |
| Demolition | Havoc RPG + satchel charges + P-11 | — |

**Revolver One-Shot** replaces the loadouts with the KF-44 revolver: six rounds, 2.5 s reload, every hit kills, first to
15 kills in 6 minutes. Players are shielded for 2.5 s after spawning or until they fire. No grenades, pickups, drones or RC-XD.

**RC-XD (Nuketown):** hold **E** at the chest between the school bus and the moving truck, then press **T** to drive.
**W/S** drive, **A/D** steer, the mouse swings the camera, **click or T** detonates (7 m blast). It also explodes after
20 seconds, on a hard crash, or when enemies shoot it apart. The chest restocks 75 seconds after the car is gone.

## Feedback

Players send feedback from the **Feedback** button at the top of the main menu (topic, optional 1–5 rating, message;
the game adds build, browser, screen size and graphics quality). It is stored on the game server, limited to 5
messages per player every 10 minutes. To read it, pick a developer key and store it on the server:

    cd server && npx wrangler secret put FEEDBACK_KEY

Then open **Feedback → Developer inbox** in the game and enter the same key. You can filter open/done messages,
mark them done or delete them. Without the secret nobody can read feedback.

## Coins, crates and saves

- Clearing a campaign part pays 40 coins on Veteran (Recruit 75%, Elite 150%); finishing Cinder Foundry adds 250 and
  Whiteout 300. New profiles start with 300. A Field crate costs 300, an Elite crate (no commons) 750. Duplicates
  refund 60/125/275/600 coins by rarity. Equip what you own in **Locker & Shop**.
- Taking **#1** on a campaign board (per campaign and drone mode) with at least 5 players unlocks the Champion suit and
  finish for good. While you still hold #1 a crown halo and light trail show on you in multiplayer.
- With the game server, coins, skins and crate rolls live on the server: coins come only from server-tracked campaign
  runs (parts claimed in order, no faster than a person can play them, capped per day), crates are rolled there, and
  other players see the cosmetics the server says you own. Your **save code** (in the Locker) loads your profile,
  coins, skins and campaign progress on another device. Without a server, all of this is kept in the browser.
- **Reset campaign progress** is on the campaign screen; it keeps coins, skins and leaderboard entries.

## Game server (leaderboard, profiles and multiplayer relay)

`server/` is a small [Cloudflare Worker](https://developers.cloudflare.com/workers/) that stores the global campaign leaderboard,
player profiles (coins, skins, cloud saves), player feedback, and relays multiplayer traffic when a direct connection is blocked. It fits in
Cloudflare's free plan. Without it the game still works: the leaderboard, coins and skins stay on each computer and multiplayer
is peer-to-peer only. After changing `server/worker.js`, run `npx wrangler deploy` in `server/` again.

1. Make a free account at [dash.cloudflare.com](https://dash.cloudflare.com/sign-up).
2. In this folder run `cd server && npx wrangler login`, then `npx wrangler deploy`.
3. Copy the `https://cinderfall.<your-subdomain>.workers.dev` address it prints into `js/config.js` (`CF.SERVER = '…'`), then commit and push.

To try it locally, run `npx wrangler dev` in `server/` and open the game with `?server=http://127.0.0.1:8787` in the address
(or set `CF.SERVER`). `npx wrangler dev --var MIN_PHASE_SECS:0` turns off the per-part pacing check for quick testing.

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
| T | Drive / detonate the RC-XD (Nuketown) |
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
