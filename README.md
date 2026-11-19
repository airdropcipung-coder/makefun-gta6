# Palmera Bay — A Sunset City Story

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/airdropcipung-coder/makefun-gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/airdropcipung-coder/makefun-gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game for make.fun's **"Make GTA 6"** bounty ($1,666 in
USDC). You are Danny Reyes, a driver for hire in Palmera Bay, a sun-soaked coastal
city. Work five jobs for Mama Rosa of the Rosa Garage, outrun the Palmera Bay police,
and run the city.

## Play it

Open `game/index.html` in desktop Chrome (or `node serve.ts` and visit
http://localhost:8080). No network, no build step, no install.

| Key | Action |
|-----|--------|
| WASD / arrows | Move on foot, drive |
| E | Enter / exit a car (stealing a stranger's car earns a wanted star) |
| F | Punch |
| Mouse click | Shoot the pistol (once armed) |
| Shift | Sprint |
| Space | Handbrake |
| Esc | Pause (progress saves) |
| Enter | Start the next mission |
| M | Mute |

## What's in the game

- **A city to explore** — an 800 m street grid with downtown towers, a beach and the
  ocean, palms, lamps and golden-hour light, all built from a seed (`?seed=N` replays it).
- **On foot and by car** — third-person on-foot movement and arcade driving with
  handbrake drifts, plus 22 traffic cars and 8 parked cars to steal.
- **Traffic and pedestrians** — cars follow the streets and stop for the car ahead;
  pedestrians walk the sidewalks and run when a gun goes off.
- **Wanted level and police** — 0–5 stars. Police cars chase and ram, foot cops chase
  on foot, and hiding out of sight cools the heat down. Busted or Wasted sends you
  back to the safehouse.
- **Missions and a story** — five jobs from a first fare to the big score, plus taxi
  fares and cash pickups for free-roam money. Cash and respect save between visits.
- **HUD with a minimap** — wanted stars, cash, health and armour, objective line,
  speed, ammo, and a live minimap with the mission marker, traffic and police.
- **Combat** — fists and a pistol with tracers, magazine and reload.
- **Sound** — engine, sirens, gunshots and a bass groove, all synthesised with WebAudio.

## Files

- `game/` — the game itself (static files, Three.js r160 vendored under `game/vendor/`)
- `game/src/` — one file per system: `world`, `vehicles`, `player`, `pedestrians`,
  `police`, `missions`, `combat`, `hud`, `render`, `audio`, `input`, `save`, `shots`, `config`, `random`, `main`
- `screenshots/` — 4 screenshots of the game, staged with `?shot=cover|chase|foot|heist`
- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and
  writes `dossier.json`
- `serve.ts` — development server for `game/`

## Originality

Palmera Bay, Danny Reyes, Mama Rosa, the Vipers, and every piece of art, sound and
story in this game are original. Nothing is taken from Rockstar Games' Grand Theft
Auto series or any other commercial game.

## License

MIT — see `LICENSE`.
