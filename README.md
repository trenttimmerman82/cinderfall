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
- **Story Campaign: Dust Off.** On the campaign screen next to the other two. A prisoner rescue in Dar Masir, capital of the
  fictional Qaltan Republic, goes wrong. Eight missions in three acts, each with a briefing, its own kit and time of
  day: *Drop Zone* (ride in on a helicopter and fire from the door), *Contact* (the souk and Clocktower Square, a
  technical), *Ghost Protocol* (a night stealth mission, see below), *Breach* (blow the gate and cell block of the old
  fort, free four prisoners), *Shot Down* (the extraction helicopter is hit by an RPG and crashes; pull the pilot out,
  hold the wreck), *The Long Walk* (fight across the city with the prisoners following your path), *Last Block* (hold a
  walled school in three waves) and *Extraction* (hold the stadium until the last helicopter lands). Your squad fights
  alongside you. Enemies are militia riflemen, machine gunners, RPG gunners who shout before they fire, snipers with a
  visible laser, and technicals (armoured to rifle fire; blow them up or shoot the gunner).
- **Ghost Protocol (stealth).** Suppressed pistol and carbine only. Darkness hides you, lamps and the guards' torch
  beams give you away, crouching keeps you quiet, a melee attack from behind is a silent takedown. A guard who spots you
  raises the alarm after a few seconds unless you silence him; a guard who finds a body comes looking. If the alarm
  goes up, Colonel Kaal runs for his car and the mission fails if he reaches it. Never raising the alarm earns the Ghost
  bonus; silent kills score extra.
- **Enhanced characters** (Settings → Video → Story Campaign characters). *Standard* keeps the light models.
  *Enhanced* gives the Story Campaign's people lathe-turned bodies, sculpted heads, plate carriers, chest rigs,
  helmets, shemaghs, detailed weapons and generated camo, fabric, webbing, leather and skin textures (about 9,000
  triangles and ~26 draw calls per person). Its script (`js/enemy-models-enhanced.js`) is downloaded, and its textures
  painted, only when Enhanced is picked; Standard players never load it.
- All three campaigns have three threat levels (every point you earn is worth 0.8× on Recruit, 1× on Veteran and 1.4× on Elite, so harder runs score higher) and a **No drones** option (no enemy drones) that works with any of them.
- **Kill streak.** 5 kills within 30 seconds earns an attack drone with 60 rounds.
- **Co-op campaign.** Play Cinder Foundry or Whiteout with a friend through a room code: shared objectives, revive each
  other when down, ranked on its own Co-op leaderboard.
- **Multiplayer.** Play online with friends: free-for-all, team deathmatch (Voltage vs Ronin), **Revolver One-Shot**
  (revolvers only, every hit kills), **Prop Hunt** (hide as crates, barrels and chairs; Hunters find you), co-op
  **Zombies** (survive waves of infected) or **Battle Royale** (ride the Battle Bus over **Retail Row**, loot, outlast the storm) on **Sniper Valley** (rail rifles only, two rooftops across a 60 m drop), **Neon Market**, **Skyline**, **Nuketown**, **Oregon**, **Terminal** (an airport with a walk-through airliner), **Dust II** (Long A, the catwalk, mid doors and the tunnels to B) **The Pit** (a UNSC training facility with two bases, sniper towers, the Sword Room and a sunken live-fire range), **Rust** (a desert oil yard round a climbable drilling tower) **Highrise** (a skyscraper roof with a helipad, two floors of offices, a mechanical well and a tower crane) **Hijacked** (a superyacht under way, from the pool deck and the cabins below to the bridge, the sun deck and the helipad on the bow) and **Retail Row** (a shopping town in open country, built for Battle Royale), with eight classes you can edit in the lobby (any primary, eight secondaries including a machine pistol, hand cannon, burst pistol, sawn-off, arc pistol and grenade pistol, plus equipment and vest). Kill-streak drones
  work here too. Nuketown has an **RC-XD** chest: take it, drive the bomb car on a chase camera while your body stands
  shielded, and blow it up.
- **Saves.** Campaign progress saves at every checkpoint, separately for each campaign, and survives closing the tab.
- **Coins, crates and the Locker.** Clearing campaign parts earns coins; crates hold weapon finishes and operative suits
  (Common to Legendary) that other players see in multiplayer. Taking #1 on a leaderboard unlocks the Champion gear.
- **Global leaderboard.** Campaign runs are ranked against everyone who plays, separately for each campaign and drone
  mode. Each board shows the top 10 and your own rank (needs the game server below).

**Play:** open this repository's GitHub Pages link in a desktop browser. You need a mouse and keyboard.

## Multiplayer

1. One player picks **Multiplayer**, chooses a map (a big screenshot preview and a thumbnail gallery show what each one looks like) and a mode, and clicks **Host match**. A 5-character room code appears.
2. Friends open the same page, pick **Multiplayer**, type the code and click **Join match**.
3. In the lobby everyone picks a class (and can edit its primary, secondary, equipment, vest and name) and clicks **Deploy**.

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
| Gunner | HX-9 Warden LMG + P-11 | Starts with 25 armor, 6% slower |
| Heavy | Rotor-6 minigun + P-11 | Starts with 50 armor, 10% slower |
| Demolition | Havoc RPG + satchel charges + P-11 | — |
| Gunslinger | KF-44 revolver + P-11 | 5% faster; the revolver kills in two body shots or one headshot |
| Pyro | Ember-9 flamethrower + P-11 | Starts with 25 armor; 11 m of fire that burns on for 2.5 s |

**Revolver One-Shot** replaces the loadouts with the KF-44 revolver: six rounds, 2.5 s reload, every hit kills, first to
15 kills in 6 minutes. Players are shielded for 2.5 s after spawning or until they fire. No grenades, pickups, drones or RC-XD.

**Prop Hunt** needs two or more players. Ten seconds after the second player joins, about a third of the room become
**Hunters** and the rest **Props**; roles rotate every round. Props get a 15-second head start while the Hunters are
blindfolded. A Prop carries no weapons: walk up to a crate, barrel, trash can, chair, vending machine or other small
object and press **E** to become it (a chase camera follows you; **E** again drops it). You move slowly while
disguised; sprinting or getting shot blows your cover, and you can't hide again for 4 seconds. Hunters keep their
loadouts, but for the first 45 seconds of the hunt Props take only 35% damage. A found Prop joins the Hunters.
Hunters win by finding every Prop within 5 minutes; Props win if anyone is still hiding when time runs out. No
kill-streak drones or RC-XD. Maps register their hiding spots through `CF.PH.place` / `CF.PH.mark` (`js/prophunt.js`).

**Capture the Flag** is Voltage vs Ronin with a flag standing at each team's spawn. Run over the enemy flag to
take it, then bring it back to your own base ring while your flag is at home to score. A carrier who dies drops the
flag where they fell; a teammate who touches their own dropped flag sends it home, and it returns on its own after
25 seconds. First to 3 captures in 10 minutes. Kills count on the scoreboard but not toward the team score. Flag
rules live in `js/ctf.js`; the host decides every take, return and capture.

**Zombies** (2+ players, best on Neon Market) puts everyone on one team against waves of infected: Husks (clawing
Sentry frames), Crawlers, Blight drones from wave 3 and Brutes every fifth wave. Each wave is bigger and tougher;
count, health and damage also scale with the number of players (`CF.ZM.scale` in `js/zombies.js`). A 25-second
break between waves restocks every ammo and armor pickup, gets downed players up and brings back anyone who bled out.
**Points and the shop.** Everyone starts with 500 points and earns their own: 10 per shot that hits, the infected's
score per kill (+50 for a headshot), 100 for a revive and a bonus for every cleared wave. During a break, press **B**
(rebindable) to open the shop and buy with the number keys: max ammo (500), armor to 100 (750), a weapon off the wall
(KF-44 revolver 1,000, KS-12 1,250, VX-3 1,750, HX-9 2,000, RPG 2,500, minigun 3,000; half price to refill one you own)
or an upgrade for the gun in your hands: Mk II, Mk III and Mk IV for 2,000, 4,000 and 7,000, each adding damage,
magazine, reserve, fire rate and reload speed. Points carry across the game; bought guns and upgrades are lost if you
bleed out. The scoreboard shows everyone's points.
Out of health, you go **down**: you crawl and can't shoot; a teammate holds **E** next to you for 3 seconds to revive
you (50 health). After 30 seconds down you bleed out until the next break. The game ends when nobody is standing; the
scoreboard shows the wave reached and total kills.
**Zombies · No drones** is the same mode (same points, shop and revives) with the flying Blight drones taken out of the
waves; Crawlers fill their share. Pick it as its own card in the mode row (`zombiesnd` in `js/mp.js`, `CF.ZM.nd` in
`js/zombies.js`). Kill-streak drones for the players still work.

**Battle Royale** is played on **Retail Row**, a small shopping town in open country after the Fortnite landmark:
the Noms supermarket, a two-storey row of shops (Ruckus Sports, Sofa Kingdom, Toy Barn, Bean There, Hammer & Co.) with a
balcony walk and a roof you reach from the west stair, the parking lot and the RETAIL ROW pylon, the water tower with a
switchback stair up to its catwalk, the Gas-N-Go, two streets of houses with garages, the park, a self-storage yard and
a red barn. Picking the mode picks the map (and the other way round).
- **Warm-up.** Until the bus leaves you run around with a pistol and respawn. Online, the Battle Bus leaves 20 seconds
  after a second player is in; in practice, 5 seconds after you deploy. No classes: everyone drops with a P-11.
- **The drop.** Everyone rides the **Battle Bus** (a bus under a hot-air balloon) across the map on a random line. Press
  **Space** to jump once the doors open; at the end of the route you are thrown out. In free fall, look down and hold **W**
  to dive; **Space** (below 90 m) or reaching 30 m above the ground opens the **glider**. The camera is third-person on the
  bus and in the air, and other players see you fall and glide.
- **Loot.** About 110 floor spots and 24 golden chests (hold **E** to open). Guns come in five rarities, **Common**,
  **Uncommon**, **Rare**, **Epic** and **Legendary**, each a little harder-hitting (up to +22% damage); the colour shows on
  the floor ring and light beam, the weapon name and its slot. Walk over loot to take it: guns while you carry fewer than
  four, ammo boxes, armor plates (+25/+50), med kits and bandages (+25/+50 health), frags. With four guns (or a better copy of
  one you carry), **E** swaps the gun in your hands for it and drops yours. Health does not regenerate in the match.
- **The storm.** Five circles, each inside the last and drawn from the match seed, the late ones near the middle of town:
  wait 75/45/35/30/20 s, then shrink to 78/44/22/9/0 m. Outside you take 1, 2, 4, 7 and then 10 damage a second (armor
  doesn't help), the screen and fog turn purple and the storm howls. The minimap (top right) shows the storm, the next
  circle (white), the bus route and you; **M** opens the full map. The bar shows the storm timer, players alive and kills.
- **Eliminated.** One life: you drop everything you carried, see your placement (**#4 of 8**) and spectate the
  survivors (**Space** for the next). Joining after the bus left also spectates. The last one standing gets
  **Victory Royale**; the scoreboard lists everyone's place and kills, and the host can start another match.
- **Bots** ride the bus, glide to a loot spot, pick up guns, armor and med kits, open chests, keep ahead of the storm and
  fight. Retail Row's navigation grid also sees thin walls and shop windows (`W.navWalls` in `js/world.js`), so bots go
  through doors; like everywhere, the grid maps one floor per spot, so bots don't loot house and shop ground floors.
- **Online:** the host runs the countdown, the bus line, the storm circles and the loot seed, and decides every pickup and
  chest; every client builds the same loot from the seed, flies its own drop and takes its own storm damage. Rules and
  tuning (storm table, rarities, loot pool) are at the top of `js/br.js`; the map is `js/map-retail.js`, which lists its
  loot spots and chests in `L.points.loot` / `L.points.chests`. The anticheat allows the bus ride and the drop and the
  higher damage of rare guns. The network version is now `v9`, so everyone needs the updated page.

**Sniper Valley** is its own map and mode: team deathmatch (first to 25, 10 minutes) between two skyscraper rooftops
60 m apart with nothing connecting them. Each roof has a spawn bunker and a watchtower. Loadouts are rail-rifle kits
only (Deadeye: VX-3 + KF-44, Spotter: VX-3 + P-11 + 50 armor, Longshot: VX-3 with 40 spare rounds + P-11), no
grenades. Go over the edge and you fall to your death.

**Story Campaign runs** are ranked on their own **Dust Off** board (one solo board: the story has no enemy drones and no
co-op). The server must be redeployed (`npx wrangler deploy` in `server/`, API 5) before it accepts them; until then
runs are kept on this computer and sent after the update. Missions are campaign parts: each cleared mission pays coins,
and finishing the story adds a 400-coin bonus.

**Co-op Campaign:** pick **Co-op Campaign** and a campaign, host, and have your friend join with the code. The host
runs the mission; both players share every objective (either can hit a breaker, hold the uplink or the landing pad),
weapon unlocks and checkpoints. A player who runs out of health goes down and can be revived; both down at once
restarts from the last checkpoint. Difficulty and No drones come from the host's campaign settings. Tuning: enemies
have **1.4× health** and deal the **same damage** as solo (the second gun roughly doubles your damage, so the net
result is a little easier than solo at the same difficulty; `COOP_HP` / `COOP_DMG` in `js/coop.js`). Co-op runs earn
no coins, never touch your solo save, and are ranked on a separate **Co-op** leaderboard under both callsigns (needs
the updated server: run `npx wrangler deploy` in `server/`). The partner sees boss attacks land but not their
wind-up telegraphs.

**RC-XD (Nuketown):** hold **E** at the chest between the school bus and the moving truck, then press **T** to drive.
**W/S** drive, **A/D** steer, the mouse swings the camera, **click or T** detonates (7 m blast). It also explodes after
20 seconds, on a hard crash, or when enemies shoot it apart. The chest restocks 75 seconds after the car is gone.

## Practice vs bots

**Practice vs bots** on the main menu (or the same section of the Multiplayer screen) plays any map in Free for all, Team
deathmatch, Capture the Flag, Revolver One-Shot, Sniper Valley or Battle Royale (Retail Row) against 1, 3, 5 or 7 computer players, offline, on
Easy, Normal or Hard. Zombies practice is you alone against the waves. **Esc** pauses. Bots can't play Prop Hunt or the
co-op campaign. The bots (`js/bots.js`) are ordinary multiplayer players driven by the host: they walk the map's
navigation grid, spot you in their field of view or by the sound of your shots, and in CTF they take, carry, return and
defend flags. Skill changes their reaction time, aim wobble, turn speed and how often they go for the head. They don't
throw grenades or use rockets, and the navigation grid only maps the highest walkable floor at each spot, so they
tend to skip rooms that have another floor above them.

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
| Ctrl + A / D | Lean left / right (hold) |
| R | Reload |
| E | Interact (hold) · Prop Hunt: disguise as the object in front of you · co-op: revive a downed teammate (hold) |
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
The Enhanced characters script is carried in the file as inert text and only run when that setting is picked.
The campaign runs offline; multiplayer needs internet access.

All textures, sound and music are generated in code. three.js and PeerJS are MIT-licensed.
