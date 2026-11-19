// Palmera Bay — boot and the one loop. Input is read every frame, the world advances
// in fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between five screens: title, play, paused, game over and story complete.
//
// ?seed=N fixes the city. ?shot=cover|chase|foot|heist (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.
//
// This is an original game: its own city, characters, vehicles, names, story, art
// and sounds. Nothing is taken from any commercial game.
import * as THREE from 'three';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_ENTER,
  ACTION_FIRE,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_PUNCH,
  createInput,
} from './input.js';
import { createAudio } from './audio.js';
import { createPlayer } from './player.js';
import { createVehicles } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createCameraRig, createParticles } from './render.js';
import { readSave, writeSave, readBest, writeBest } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const rng = createRandom(seed);

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

const world = createWorld(scene, rng);
const audio = createAudio();
const input = createInput(canvas);
const player = createPlayer(scene, world);
const vehicles = createVehicles(scene, world, rng);
const peds = createPedestrians(scene, world, rng);
const police = createPolice(scene, world, vehicles, rng);
const combat = createCombat(scene);
const hud = createHud();
const cameraRig = createCameraRig(camera);
const particles = createParticles(scene);

// The shared game object: every system reads and writes through it, so the wiring is
// one place and the systems stay independent.
const game = {
  world,
  player,
  vehicles,
  peds,
  police,
  combat,
  audio,
  marker: null,
  missionStage: 0,
  missionTimer: 0,
  missionCheckpoints: [],
  screen: 'title',
  overReason: '',
  time: 0,
  setObjective(text) {
    hud.setObjective(text);
  },
  showMessage(text) {
    hud.showMessage(text);
  },
  atMarker(radius) {
    if (!this.marker) return false;
    const px = player.inCar ? player.inCar.x : player.x;
    const pz = player.inCar ? player.inCar.z : player.z;
    return Math.hypot(this.marker.x - px, this.marker.z - pz) < radius;
  },
  spawnMissionCar(colour, x, z) {
    const car = vehicles.addCar(x, z, 0, colour, 'parked');
    car.missionCar = true;
    return car;
  },
  playerInMissionCar() {
    return Boolean(player.inCar && player.inCar.missionCar);
  },
  enterCar(car, silent = false) {
    player.inCar = car;
    car.kind = 'player';
    player.x = car.x;
    player.z = car.z;
    player.angle = car.angle;
    player.mesh.visible = false;
    if (!silent && car.stolen !== true && !car.missionCar) {
      // Stealing a stranger's car is a crime — unless it is yours to take.
      car.stolen = true;
      police.addWanted(1);
      audio.wanted();
      hud.showMessage('Car stolen! The police are on to you.');
    }
  },
  exitCar() {
    if (!player.inCar) return;
    const car = player.inCar;
    car.kind = 'parked';
    player.inCar = null;
    player.mesh.visible = true;
    player.x = car.x + Math.sin(car.angle + Math.PI / 2) * 3;
    player.z = car.z + Math.cos(car.angle + Math.PI / 2) * 3;
    player.angle = car.angle;
    player.mesh.position.set(player.x, 0, player.z);
  },
};

const missions = createMissions(game);
game.missions = missions;

function loadProgress() {
  const save = readSave();
  if (save) {
    player.cash = save.cash || 0;
    player.respect = save.respect || 0;
    if (save.missionsDone > 0) {
      // A returning player starts at the next mission, not from the beginning.
      missions.start(Math.min(save.missionsDone, 4));
    }
  }
}

function saveProgress() {
  writeSave({
    cash: player.cash,
    respect: player.respect,
    missionsDone: player.respect,
    best: Math.max(readBest(), player.cash),
  });
  writeBest(Math.max(readBest(), player.cash));
}

function setScreen(name) {
  game.screen = name;
  for (const id of ['title', 'pause', 'gameover', 'complete']) {
    document.getElementById(id).classList.toggle('hidden', id !== name);
  }
  if (name === 'gameover') {
    document.getElementById('over-reason').textContent = game.overReason;
  }
}

function startGame() {
  audio.unlock();
  audio.startMusic();
  loadProgress();
  if (missions.index < 0 && player.respect === 0) missions.start(0);
  else if (missions.index < 0) hud.setObjective('Free roam — press Enter to start the next mission.');
  setScreen('play');
  cameraRig.snap(player);
}

function endRun(reason) {
  game.overReason = reason;
  audio.busted();
  audio.engine(false);
  audio.siren(false);
  player.cash = Math.max(0, player.cash - 100);
  saveProgress();
  setScreen('gameover');
}

function respawn() {
  player.health = 100;
  player.armor = 0;
  police.clear();
  if (player.inCar) {
    vehicles.removeCar(player.inCar);
    player.inCar = null;
    player.mesh.visible = true;
  }
  player.x = -200;
  player.z = 0;
  player.angle = 0;
  player.mesh.position.set(player.x, 0, player.z);
  cameraRig.snap(player);
  hud.setObjective('Free roam — press Enter to start the next mission.');
  setScreen('play');
}

function step(dt) {
  game.time += dt;
  const inCar = Boolean(player.inCar);

  // Enter in free roam: start the next story mission, or a taxi fare once the story is done.
  if (input.pressed(ACTION_CONFIRM) && missions.index < 0) {
    if (player.respect < 5) missions.start(player.respect);
    else missions.startTaxi(game);
  }

  // Enter / exit cars. Note: enterCar/exitCar change player.inCar mid-step, so the
  // driving branch below must read player.inCar live, never the snapshot above.
  if (input.pressed(ACTION_ENTER)) {
    if (inCar) game.exitCar();
    else {
      const car = vehicles.nearestCar(player.x, player.z, 5);
      if (car) game.enterCar(car);
    }
  }

  if (player.inCar) {
    const speed = vehicles.drive(player.inCar, input, dt);
    player.x = player.inCar.x;
    player.z = player.inCar.z;
    player.angle = player.inCar.angle;
    audio.engine(true, Math.abs(speed) / 38);
    if (Math.abs(speed) > 20 && input.held('handbrake')) {
      particles.spawn(player.inCar.x, 0.3, player.inCar.z, 0xcccccc, 3, 2, 0.5);
    }
  } else {
    player.update(dt, input, cameraRig.angle);
    audio.engine(false);
    // Combat on foot.
    const targets = [
      ...peds.list.filter((p) => p.alive),
      ...police.cops.filter((c) => c.onFoot && (c.health === undefined || c.health > 0)),
    ];
    if (input.pressed(ACTION_PUNCH)) {
      combat.punch(player, player.angle, targets, onCombatHit);
      audio.punch();
    }
    if (input.pressed(ACTION_FIRE)) {
      if (combat.shoot(player, player.angle, targets, onCombatHit)) {
        audio.shoot();
        peds.scare(player.x, player.z, 30);
        police.addWanted(1);
      }
    }
  }

  vehicles.updateTraffic(dt, player.inCar ? null : { x: player.x, z: player.z });
  peds.update(dt, {
    x: player.x,
    z: player.z,
    inCar: Boolean(player.inCar),
    speed: player.inCar ? Math.abs(player.inCar.speed) : player.speed,
    onPedHit: () => {
      police.addWanted(1);
      hud.showMessage('You hit a pedestrian! Wanted level up.');
    },
  });
  police.update(dt, player, {
    onBusted: () => endRun('Busted! The Palmera Bay police caught you.'),
    onRam: () => {
      if (player.inCar && player.inCar.health <= 0) {
        vehicles.removeCar(player.inCar);
        player.inCar = null;
        player.mesh.visible = true;
        player.health = 40;
        hud.showMessage('Your car is wrecked!');
      }
    },
  });
  combat.update(dt);
  missions.update(dt);
  particles.update(dt);
  audio.siren(police.wanted > 0);

  // Cops shot down fall and cost the player two stars.
  for (const cop of [...police.cops]) {
    if (cop.onFoot && cop.health !== undefined && cop.health <= 0) {
      cop.mesh.rotation.x = Math.PI / 2;
      cop.mesh.position.y = 0.3;
      police.cops.splice(police.cops.indexOf(cop), 1);
      police.addWanted(2);
      hud.showMessage('Cop down! Wanted level up.');
    }
  }

  if (player.health <= 0) endRun('Wasted! You ran out of health in Palmera Bay.');
  if (player.respect >= 5 && game.screen === 'play') {
    saveProgress();
    setScreen('complete');
  }
  hud.update(game, dt);
}

function onCombatHit(target, damage) {
  particles.spawn(target.x, 1.2, target.z, 0xff3333, 8, 3, 0.4);
  if (target.mesh && target.mesh.userData.legs) {
    // A pedestrian who was shot falls over.
    target.mesh.rotation.x = Math.PI / 2;
    target.mesh.position.y = 0.3;
  }
  if (target.health !== undefined && target.health <= 0 && target.onFoot) {
    // A cop handled by the police step; a pedestrian is already down.
  }
}

function runShot(name) {
  stageShot(name, game);
  game.screen = 'play';
  setScreen('play');
  document.getElementById('hud').style.display = 'block';
  cameraRig.snap(player);
  // Paint twice (the second frame has the shadows and the HUD settled), then signal.
  let painted = 0;
  function paint() {
    step(1 / 60);
    cameraRig.update(1 / 60, player, player.inCar ? player.inCar.speed : player.speed);
    renderer.render(scene, camera);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = 'title';
  let last = performance.now();
  let accumulator = 0;
  setScreen('title');
  document.getElementById('hud').style.display = 'none';

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    if (input.pressed(ACTION_MUTE)) audio.setMuted(!audio.isMuted());
    if (screen === 'title' && input.pressed(ACTION_CONFIRM)) {
      screen = 'play';
      document.getElementById('hud').style.display = 'block';
      startGame();
    } else if (screen === 'play' && input.pressed(ACTION_PAUSE)) {
      screen = 'paused';
      setScreen('paused');
      saveProgress();
    } else if (screen === 'paused' && input.pressed(ACTION_PAUSE)) {
      screen = 'play';
      setScreen('play');
    } else if (screen === 'gameover' && input.pressed(ACTION_CONFIRM)) {
      screen = 'play';
      respawn();
    } else if (screen === 'complete' && input.pressed(ACTION_CONFIRM)) {
      screen = 'play';
      setScreen('play');
    }
    if (screen === 'play' && game.screen === 'play') {
      accumulator += elapsed;
      while (accumulator >= 1 / 60) {
        step(1 / 60);
        accumulator -= 1 / 60;
      }
      cameraRig.update(elapsed, player, player.inCar ? player.inCar.speed : player.speed);
      renderer.render(scene, camera);
    }
    // Keep the menu screens painted behind their overlay.
    if (screen !== 'play') renderer.render(scene, camera);
    input.endFrame();
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- boot: world, traffic, pedestrians, pickups, then the loop or a staged shot.
vehicles.spawnTraffic(22);
vehicles.spawnParked(8);
peds.spawn(26);
missions.spawnPickups(scene);
if (shot) runShot(shot);
else runGame();
