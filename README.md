# Palmera Bay — A Sunset City Story

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/airdropcipung-coder/makefun-gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/airdropcipung-coder/makefun-gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original 3D open-world crime game for make.fun's "Make GTA 6" bounty
($1,666 in USDC). Danny Reyes drives for Mama Rosa of the Rosa Garage,
against the rival Vipers crew, in the sun-soaked coastal city of Palmera Bay.
Built with Three.js r160 (vendored) and plain ES modules — no network, no
build step. Every name, character, vehicle and story beat is original.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

Title → Enter → Mission 1. On foot: WASD to move, Shift to sprint, F to
punch, click to shoot once armed. In a car: WASD to drive, Space for the
handbrake, E to enter or exit. Stealing a stranger's car is a crime.

## The story

1. **First Fare** — drive the taxi to the Bay Hotel.
2. **Hot Wheels** — steal the red sports car at the docks, deliver it to the garage (1★).
3. **The Pickup** — collect a package on foot at the market, escape a 2★ chase.
4. **Bank Run** — 3 checkpoints in 150 seconds with 2★ wanted.
5. **The Big Score** — rob Bay Jewelers (hold the door 5 seconds), escape 3★ to the safehouse.

Wanted 0–5 stars: stealing, shooting, running a pedestrian over or dropping
a cop adds heat; police cars chase and ram, foot cops chase and bust you.
Hide out of sight and the heat cools. Busted or Wasted respawns at the
Safehouse minus $100. After the story: taxi fares and 10 cash pickups around
the city. Cash and respect save in localStorage.

## Files

- `game/index.html` — page, import map, HUD DOM, menus.
- `game/src/config.js` — every tuning number in one place.
- `game/src/random.js` — seeded RNG (mulberry32); `?seed=N` replays a scene.
- `game/src/input.js` — keyboard + mouse, named actions.
- `game/src/audio.js` — all sound synthesised with WebAudio.
- `game/src/world.js` — the city: street grid, lit-window towers, palms, beach + ocean.
- `game/src/player.js` — Danny on foot.
- `game/src/vehicles.js` — car meshes, arcade driving, traffic AI.
- `game/src/pedestrians.js` — foot traffic that walks and flees gunfire.
- `game/src/police.js` — wanted stars, heat decay, pursuit and busts.
- `game/src/combat.js` — punch + pistol (hitscan tracers, magazine, reload).
- `game/src/missions.js` — the 5-mission chain, taxi fares, cash pickups.
- `game/src/hud.js` — wanted stars, cash, bars, objective, toast, live minimap.
- `game/src/render.js` — third-person chase camera, particle pool.
- `game/src/save.js` — localStorage save / best score.
- `game/src/shots.js` — staged screenshot scenes (`?shot=…`).
- `game/src/main.js` — boot, fixed 1/60 s loop, screens.
- `game/vendor/three.module.min.js` — Three.js r160, vendored.
- `main.ts` — copies `game/` + `screenshots/` to `/output`, writes `dossier.json`.

Built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC.
