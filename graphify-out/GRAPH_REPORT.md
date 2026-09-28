# Graph Report - cinderfall  (2026-09-28)

## Corpus Check
- 56 files · ~213,363 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .jsonc 2, .css 1)

## Summary
- 751 nodes · 1323 edges · 67 communities (29 shown, 38 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 39 edges (avg confidence: 0.85)
- Token cost: 24,456 input · 0 output

## Community Hubs (Navigation)
- Audio SFX Synth
- Nuketown Map
- Dust Off Missions
- Server Worker & Leaderboard
- Enemy AI
- Heart Boss
- PvP Bots
- Foundry Boss
- Procedural Textures
- Story Map Geometry
- UI Screens & HUD
- Story Allies
- Weapon Viewmodels
- Halden Map
- Co-op Netcode
- Multiplayer Remotes
- Game Modes & Features
- Enhanced Enemy Models
- Input & Utilities
- Base Map Props
- RC-XD Car
- Halden Mission
- Foundry Mission
- Prop Hunt
- Zombies Mode
- Co-op Campaign
- Locker Showroom
- Peer Transport
- Weapon Skins
- Single-file Build
- Particle Effects
- Story Models
- Campaign Features
- Audio Core
- World Collision
- Capture the Flag
- Game Bootstrap
- Kill Streaks

## God Nodes (most connected - your core abstractions)
1. `R` - 107 edges
2. `Enemy` - 34 edges
3. `HeartBoss` - 28 edges
4. `Bot` - 25 edges
5. `Boss` - 23 edges
6. `Cinderfall` - 20 edges
7. `objective()` - 19 edges
8. `say()` - 18 edges
9. `greenHouse()` - 17 edges
10. `yellowHouse()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Story Campaign: Dust Off` --conceptually_related_to--> `Screen: campaign`  [INFERRED]
  README.md → index.html
- `Multiplayer` --conceptually_related_to--> `Screen: mp`  [INFERRED]
  README.md → index.html
- `Enhanced Characters` --conceptually_related_to--> `Screen: settings`  [INFERRED]
  README.md → index.html
- `Threat Levels` --conceptually_related_to--> `Screen: difficulty`  [INFERRED]
  README.md → index.html
- `Coins, Crates and Locker` --conceptually_related_to--> `Screen: locker`  [INFERRED]
  README.md → index.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Campaigns** — readme_cinder_foundry, readme_whiteout, readme_dust_off [EXTRACTED 1.00]
- **Multiplayer game modes** — readme_multiplayer, readme_revolver_one_shot, readme_prop_hunt, readme_zombies [EXTRACTED 1.00]

## Communities (67 total, 38 thin omitted)

### Community 1 - "Nuketown Map"
Cohesion: 0.08
Nodes (52): armyTruck(), art(), bed(), blobGeo(), bush(), canvasTex(), car(), chair() (+44 more)

### Community 2 - "Dust Off Missions"
Cohesion: 0.12
Nodes (38): award(), bazaar(), block(), blowDoor(), cells(), checkpoint(), court(), courtyard() (+30 more)

### Community 3 - "Server Worker & Leaderboard"
Cohesion: 0.10
Nodes (23): ref_cloudflare_workers, Board, BOARDS, CAMPAIGNS, clean(), cleanName(), CORS, CRATES (+15 more)

### Community 5 - "Heart Boss"
Cohesion: 0.12
Nodes (3): buildModel(), buildPylon(), HeartBoss

### Community 6 - "PvP Bots"
Cohesion: 0.15
Nodes (4): actor(), actors(), Bot, loadoutFor()

### Community 8 - "Procedural Textures"
Cohesion: 0.32
Nodes (24): grayTex(), makeArctic(), makeAsphalt(), makeCanvas(), makeConcrete(), makeContainers(), makeCorrugated(), makeCrate() (+16 more)

### Community 9 - "Story Map Geometry"
Cohesion: 0.22
Nodes (22): bazaar(), car(), clockTex(), court(), fillCity(), fort(), house(), lampPost() (+14 more)

### Community 10 - "UI Screens & HUD"
Cohesion: 0.10
Nodes (17): HUD, Screen: browse, Screen: dead, Screen: difficulty, Screen: feedback, Screen: leaderboard, Screen: loading, Screen: locker (+9 more)

### Community 11 - "Story Allies"
Cohesion: 0.14
Nodes (3): Ally, Heli, project()

### Community 12 - "Weapon Viewmodels"
Cohesion: 0.26
Nodes (16): caps(), carbine(), cyl(), forearm(), hand(), minigun(), part(), pistol() (+8 more)

### Community 13 - "Halden Map"
Cohesion: 0.16
Nodes (11): buildSnowcat(), crystals(), drift(), drums(), hall(), iceSlab(), module(), sled() (+3 more)

### Community 14 - "Co-op Netcode"
Cohesion: 0.15
Nodes (4): nameOf(), refreshTargets(), reviveLogic(), Stand

### Community 15 - "Multiplayer Remotes"
Cohesion: 0.21
Nodes (3): buildOperative(), nameTag(), Remote

### Community 16 - "Game Modes & Features"
Cohesion: 0.20
Nodes (16): PeerJS, Screen: mp, Campaign: Cinder Foundry, Cinderfall, Co-op Campaign, Kill Streak Drone, Multiplayer, No Drones Option (+8 more)

### Community 17 - "Enhanced Enemy Models"
Cohesion: 0.25
Nodes (9): build(), eyeGeo(), gun(), Kit, materials(), merge(), put(), slab() (+1 more)

### Community 18 - "Input & Utilities"
Cohesion: 0.15
Nodes (3): clearAll(), init(), Spring

### Community 19 - "Base Map Props"
Cohesion: 0.19
Nodes (4): ammoCache(), breaker(), screenMesh(), statusLight()

### Community 20 - "RC-XD Car"
Cohesion: 0.24
Nodes (4): chestModel(), mats(), RemoteCar, shieldModel()

### Community 21 - "Halden Mission"
Cohesion: 0.27
Nodes (5): beaconOn(), enter(), say(), setScreen(), update()

### Community 22 - "Foundry Mission"
Cohesion: 0.42
Nodes (7): alarms(), enter(), nearestBreaker(), say(), setBreaker(), setDoors(), update()

### Community 23 - "Prop Hunt"
Cohesion: 0.28
Nodes (4): send(), setPhase(), startRound(), Prop Hunt

### Community 24 - "Zombies Mode"
Cohesion: 0.39
Nodes (6): pick(), send(), spawnOne(), spawnPoint(), startBreak(), startWave()

### Community 26 - "Locker Showroom"
Cohesion: 0.43
Nodes (4): buildShowroom(), standAtEase(), studioEnv(), thumbRig()

### Community 27 - "Peer Transport"
Cohesion: 0.38
Nodes (3): openFast(), openHostRelay(), parse()

### Community 28 - "Weapon Skins"
Cohesion: 0.33
Nodes (3): add(), animate(), mat()

### Community 29 - "Single-file Build"
Cohesion: 0.33
Nodes (4): Build dist/Cinderfall.html: one self-contained file (three.js, PeerJS, CSS and…, os, re, urllib_request

### Community 31 - "Story Models"
Cohesion: 0.60
Nodes (4): finish(), gunModel(), m(), standard()

### Community 32 - "Campaign Features"
Cohesion: 0.40
Nodes (5): Screen: campaign, Screen: settings, Story Campaign: Dust Off, Enhanced Characters, Ghost Protocol Stealth

### Community 36 - "World Collision"
Cohesion: 0.60
Nodes (3): bestStep(), canStepTo(), linked()

## Knowledge Gaps
- **23 isolated node(s):** `CORS`, `CAMPAIGNS`, `MODES`, `BOARDS`, `PHASES` (+18 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 248 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **38 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `R` connect `Audio SFX Synth` to `Audio Core`, `Explosion SFX`, `Player Profile`, `Gun SFX`, `Ice SFX`, `Reveal SFX`, `Pickup SFX`, `Melee SFX`, `Reload SFX`, `Shatter SFX`, `Impact SFX`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `Enhanced Characters` connect `Campaign Features` to `Game Modes & Features`, `Enhanced Enemy Models`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `CORS`, `CAMPAIGNS`, `MODES` to the rest of the system?**
  _23 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Audio SFX Synth` be split into smaller, more focused modules?**
  _Cohesion score 0.024691358024691357 - nodes in this community are weakly interconnected._
- **Should `Nuketown Map` be split into smaller, more focused modules?**
  _Cohesion score 0.07562136435748282 - nodes in this community are weakly interconnected._
- **Should `Dust Off Missions` be split into smaller, more focused modules?**
  _Cohesion score 0.12070874861572536 - nodes in this community are weakly interconnected._
- **Should `Server Worker & Leaderboard` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._