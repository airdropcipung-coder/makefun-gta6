// Boot and the one loop. The game moves between five screens — title, play,
// paused, game over and story complete — and the world advances in fixed
// 1/60 s steps. ?seed=N fixes the city; ?shot=<name> stages a screenshot
// scene instead of the title screen.

import * as THREE from 'three';
import { CFG, LANDMARKS, MISSIONS } from './config.js';
import { makeRng } from './random.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildWorld } from './world.js';
import { createPlayer } from './player.js';
import { createVehicles } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createRender } from './render.js';
import { loadSave, writeSave, loadBest, writeBest } from './save.js';
import { stageShot, SHOT_NAMES } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const rng = makeRng(seed);

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 900);
const scene = new THREE.Scene();

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const save = loadSave();
const input = createInput();
const audio = createAudio();
const world = buildWorld(scene, rng);
const player = createPlayer(scene, world);
const hud = createHud(world);
const render = createRender(scene, camera);

let inCar = false;
let state = 'title';
let overTitle = 'BUSTED';
let framesRendered = 0;
let saveTimer = 0;
let orbitAngle = 0;
let camYaw = 0; // the camera's own heading; it eases behind the player so
// diagonal input curves the run instead of spinning the facing

const vehicles = createVehicles(scene, world, {
  onSteal(car) {
    police.addHeat(20);
    hud.toast('Car stolen! The cops are coming.');
  },
  onEnter(car) {
    inCar = true;
    player.group.visible = false;
    audio.door();
    missions.onEnterCar(car);
  },
  onExit(car) {
    inCar = false;
    player.group.visible = true;
    const a = car.angle;
    player.setPosition(car.x - Math.sin(a) * 2.4, car.z - Math.cos(a) * 2.4);
    player.angle = a;
    player.group.rotation.y = a;
    audio.door();
  },
});

const pedestrians = createPedestrians(scene, world, rng);
pedestrians.spawnMany(CFG.pedCount);
for (let i = 0; i < CFG.trafficCount; i++) vehicles.spawnTraffic(rng);

const police = createPolice(scene, world, vehicles, rng, {
  onBusted() {
    endRun('BUSTED', 'The cops caught up with you. You wake at the Safehouse, $100 lighter.');
  },
  onRam() {
    audio.hit();
  },
});

const combat = createCombat(scene, player, vehicles, pedestrians, police, audio, {
  onCrime() {
    hud.flashDamage();
  },
  onSparks(point) {
    render.spawnBurst(point, 0xffd24a, 10, 5);
  },
  onCopDown() {
    hud.toast('Cop down! That will cost you.');
  },
});

const missions = createMissions(scene, world, player, vehicles, police, audio, save, hud, rng, {
  onMissionComplete(m) {
    save.respect += 0; // respect already added in missions.js
    writeSave(save);
    writeBest(save.cash);
    hud.setMission(missions.storyDone ? 'Free Roam' : MISSIONS[missions.index]?.name || '');
  },
  onMissionFail() {
    writeSave(save);
  },
  onStoryComplete() {
    state = 'complete';
    showScreen('complete');
    audio.complete();
    writeSave(save);
    writeBest(save.cash);
  },
});

const G = { player, vehicles, police, pedestrians, missions, combat, hud, render, world, rng, save, audio };

// A read-only handle for play-testing (and for the curious): the live game.
window.__palmera = {
  get player() {
    return player;
  },
  get vehicles() {
    return vehicles;
  },
  get police() {
    return police;
  },
  get missions() {
    return missions;
  },
  get camera() {
    return camera;
  },
  get scene() {
    return scene;
  },
  get state() {
    return state;
  },
  get inCar() {
    return inCar;
  },
};

// --- Screens ---------------------------------------------------------------

const screens = {
  title: document.getElementById('title'),
  pause: document.getElementById('pause'),
  over: document.getElementById('over'),
  complete: document.getElementById('complete'),
};
const hudEl = document.getElementById('hud');
const statusEl = document.getElementById('status');
const bestLine = document.getElementById('best-line');
const best = loadBest();
if (best > 0) bestLine.textContent = `Best bankroll so far: $${best}`;

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) el.classList.toggle('on', key === name);
  hudEl.classList.toggle('on', name === null);
  statusEl.textContent =
    name === 'title'
      ? 'Palmera Bay. Press Enter to play.'
      : name === 'pause'
        ? 'Paused.'
        : name === 'over'
          ? `${overTitle}. Press Enter to continue.`
          : name === 'complete'
            ? 'Story complete. Press Enter to keep playing.'
            : '';
}

function startGame() {
  audio.unlock();
  audio.musicStart();
  state = 'play';
  showScreen(null);
  if (save.mission === 0 && !save.storyDone) {
    hud.setMission(MISSIONS[0].name);
    missions.start();
  } else {
    hud.setMission(save.storyDone ? 'Free Roam' : MISSIONS[save.mission]?.name || '');
    missions.start();
  }
  hud.toast('Welcome to Palmera Bay');
}

function endRun(title, text) {
  overTitle = title;
  document.getElementById('over-title').textContent = title;
  document.getElementById('over-text').textContent = text;
  state = 'over';
  save.cash = Math.max(0, save.cash - CFG.bustFine);
  police.reset();
  audio.fail();
  audio.siren(false);
  writeSave(save);
  showScreen('over');
}

function respawn() {
  if (inCar) {
    vehicles.exitCar();
  }
  player.health = CFG.playerHealth;
  player.armour = CFG.playerArmour;
  player.setPosition(LANDMARKS.safehouse.x, LANDMARKS.safehouse.z);
  player.angle = 0;
  state = 'play';
  showScreen(null);
  hud.toast('Back on the streets');
}

// --- The loop ---------------------------------------------------------------

let last = performance.now();
let acc = 0;

function step(dt) {
  const car = vehicles.playerCar;
  const px = inCar && car ? car.x : player.x;
  const pz = inCar && car ? car.z : player.z;
  const angle = inCar && car ? car.angle : player.angle;

  // Ease the camera heading toward the player's facing.
  let yawDiff = angle - camYaw;
  while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
  while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
  camYaw += yawDiff * Math.min(1, 2.2 * dt);

  // Enter / exit the car.
  if (input.wasPressed('enter')) {
    if (inCar) {
      vehicles.exitCar();
    } else {
      const near = vehicles.nearestCar(player.x, player.z, 3.6);
      if (near) vehicles.enterCar(near);
    }
  }

  if (inCar && car) {
    vehicles.update(dt, input, rng, true);
  } else {
    player.update(dt, input, camYaw);
    vehicles.update(dt, input, rng, false);
  }
  combat.update(dt, input, camera, inCar);
  pedestrians.update(dt);
  police.update(dt, player, vehicles.playerCar);
  missions.update(dt, inCar);

  // The player's car running a pedestrian over is a crime.
  if (inCar && car && Math.abs(car.speed) > 4) {
    for (const ped of pedestrians.list) {
      if (ped.down) continue;
      if (Math.hypot(ped.x - car.x, ped.z - car.z) < 2.2) {
        ped.down = true;
        ped.group.rotation.x = -Math.PI / 2;
        ped.group.position.y = 0.3;
        police.addHeat(15);
        hud.flashDamage();
        audio.hit();
        render.spawnBurst(new THREE.Vector3(ped.x, 1, ped.z), 0xdd2222, 8, 4);
      }
    }
  }

  // A cop car shoving the player on foot hurts.
  if (!inCar) {
    for (const cop of police.copCars) {
      if (Math.hypot(cop.x - player.x, cop.z - player.z) < 2.6) {
        if (player.damage(8 * dt)) {
          endRun('WASTED', 'Run over by a police cruiser. You wake at the Safehouse, $100 lighter.');
        } else {
          hud.flashDamage();
        }
      }
    }
  }

  if (player.health <= 0 && state === 'play') {
    endRun('WASTED', 'Danny is down. You wake at the Safehouse, $100 lighter.');
  }

  render.updateCamera(dt, px, pz, camYaw, inCar);
  render.update(dt);

  // Sound follows the chase.
  const speed01 = inCar && car ? Math.abs(car.speed) / car.maxSpeed : player.speed / CFG.sprintSpeed;
  audio.engine(speed01, state === 'play');
  audio.siren(police.wanted > 0 && state === 'play');

  hud.update(
    {
      wanted: police.wanted,
      cash: save.cash,
      respect: save.respect,
      health: player.health,
      armour: player.armour,
      speed: car ? car.speed : 0,
      ammo: combat.ammo,
      hasPistol: combat.hasPistol,
      reloading: combat.reloading,
      inCar,
      timer: missions.timerLeft,
      playerX: px,
      playerZ: pz,
      playerAngle: angle,
      marker: missions.marker,
      cars: vehicles.cars,
      policeCars: police.copCars,
    },
    dt,
  );

  saveTimer += dt;
  if (saveTimer > 5) {
    saveTimer = 0;
    writeSave(save);
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const elapsed = Math.min(CFG.maxFrame, (now - last) / 1000);
  last = now;

  if (input.wasPressed('confirm')) {
    if (state === 'title') startGame();
    else if (state === 'over') respawn();
    else if (state === 'complete') {
      state = 'play';
      showScreen(null);
    }
  }
  if (input.wasPressed('pause')) {
    if (state === 'play') {
      state = 'paused';
      showScreen('pause');
    } else if (state === 'paused') {
      state = 'play';
      showScreen(null);
    }
  }

  if (state === 'play') {
    acc += elapsed;
    while (acc >= CFG.step) {
      step(CFG.step);
      acc -= CFG.step;
    }
  } else if (state === 'title') {
    // A slow orbit over the city behind the title screen.
    orbitAngle += elapsed * 0.05;
    render.updateCamera(elapsed, 0, 0, orbitAngle, false);
    render.update(elapsed);
  }

  renderer.render(scene, camera);
  framesRendered += 1;
  if (shotName && framesRendered >= 3) window.__shotReady = true;
  input.endFrame();
}

// --- Shot staging -----------------------------------------------------------

if (shotName && SHOT_NAMES.includes(shotName)) {
  state = 'play';
  showScreen(null);
  audio.unlock();
  stageShot(shotName, G);
  // Start the camera heading where the staged shot put it.
  const staged = vehicles.playerCar;
  camYaw = staged ? staged.angle : player.angle;
}

showScreen(shotName ? null : 'title');
requestAnimationFrame(frame);
