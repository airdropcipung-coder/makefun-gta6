// Cars: the meshes, arcade driving for the player, and traffic AI that
// follows the street grid and stops for the car ahead. Police cars are plain
// cars too — police.js steers them.

import * as THREE from 'three';
import { CFG } from './config.js';
import { STREETS } from './world.js';

const CAR_COLORS = {
  taxi: 0xf2c200,
  sport: 0xc22a1e,
  sedan: 0x4a6a8a,
  van: 0x7a7a72,
  coupe: 0x8a3a6a,
  police: 0xe8e8e8,
};

function carMesh(kind, color) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2530, roughness: 0.15, metalness: 0.7 });
  const low = kind === 'sport';
  const bodyH = low ? 0.55 : 0.75;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, bodyH, 4.4), paint);
  body.position.y = low ? 0.55 : 0.68;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), glass);
  cabin.position.set(0, body.position.y + bodyH / 2 + 0.28, -0.2);
  cabin.castShadow = true;
  group.add(cabin);

  // Wheels: geometry pre-rotated so the axle is along X; spinning is rotation.x.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 });
  const wheels = [];
  const front = [];
  for (const [wx, wz, isFront] of [
    [-0.95, 1.45, true],
    [0.95, 1.45, true],
    [-0.95, -1.45, false],
    [0.95, -1.45, false],
  ]) {
    const pivot = new THREE.Group();
    pivot.position.set(wx, 0.38, wz);
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.castShadow = true;
    pivot.add(wheel);
    group.add(pivot);
    wheels.push(wheel);
    if (isFront) front.push(pivot);
  }

  // Headlights and taillights.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffdf80, emissiveIntensity: 0.9 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xaa1010, emissive: 0xcc2020, emissiveIntensity: 0.7 });
  for (const sx of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.08), headMat);
    head.position.set(sx, 0.72, 2.22);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.08), tailMat);
    tail.position.set(sx, 0.72, -2.22);
    group.add(tail);
  }

  if (kind === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.28, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffc800, emissiveIntensity: 0.8 }),
    );
    sign.position.set(0, 1.55, -0.2);
    group.add(sign);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.22, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x111111 }),
    );
    bar.position.set(0, 1.5, -0.2);
    group.add(bar);
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.24, 0.42),
      new THREE.MeshStandardMaterial({ color: 0xdd1111, emissive: 0xff2222, emissiveIntensity: 1.6 }),
    );
    red.position.set(-0.28, 1.5, -0.2);
    group.add(red);
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.24, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x1133dd, emissive: 0x3355ff, emissiveIntensity: 1.6 }),
    );
    blue.position.set(0.28, 1.5, -0.2);
    group.add(blue);
  }
  return { group, wheels, front };
}

export function createVehicles(scene, world, hooks) {
  const cars = [];
  let playerCar = null;

  function spawnCar(kind, x, z, angle, mode) {
    const color = CAR_COLORS[kind] ?? 0x888888;
    const { group, wheels, front } = carMesh(kind, color);
    group.position.set(x, 0, z);
    group.rotation.y = angle;
    scene.add(group);
    const car = {
      kind,
      mode: mode || 'parked',
      group,
      wheels,
      front,
      x,
      z,
      angle,
      speed: 0,
      maxSpeed: kind === 'sport' ? CFG.sportMaxSpeed : kind === 'taxi' ? CFG.taxiMaxSpeed : CFG.carMaxSpeed,
      steerAngle: 0,
      // Traffic AI state.
      axis: 'z',
      dir: 1,
      street: 0,
      lane: 3,
      targetSpeed: CFG.trafficSpeed,
      stopped: false,
    };
    cars.push(car);
    return car;
  }

  function forwardOf(car) {
    return { x: Math.sin(car.angle), z: Math.cos(car.angle) };
  }

  // Circle (the car, radius ~1.7) against every other car. The player's car
  // holds its line: the other car takes the whole shove and the player's car
  // only loses a little speed, so traffic can never push the player into a
  // wall. Two traffic cars split the shove between them.
  function pushCarsApart() {
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i];
        const b = cars[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d < 3.4 && d > 0.001) {
          const ux = dx / d;
          const uz = dz / d;
          if (a.mode === 'player' || b.mode === 'player') {
            const other = a.mode === 'player' ? b : a;
            const sgn = other === b ? 1 : -1;
            other.x += ux * (3.4 - d) * sgn;
            other.z += uz * (3.4 - d) * sgn;
            const playerCarObj = a.mode === 'player' ? a : b;
            playerCarObj.speed *= 0.85;
            other.speed *= 0.6;
          } else {
            const push = (3.4 - d) / 2;
            a.x -= ux * push;
            a.z -= uz * push;
            b.x += ux * push;
            b.z += uz * push;
            a.speed *= 0.6;
            b.speed *= 0.6;
          }
        }
      }
    }
  }

  function syncMesh(car) {
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.angle;
    const spin = (car.speed * 1) / 0.38;
    for (const w of car.wheels) w.rotation.x += spin * (1 / 60);
    for (const f of car.front) f.rotation.y = car.steerAngle * 0.4;
  }

  // Drive the player's car with the arcade model.
  function drivePlayer(dt, input) {
    const car = playerCar;
    if (!car) return;
    const throttle = input.throttle();
    const steer = input.steer();
    const braking = input.wasPressed('brake') || input.handbrake;
    if (throttle > 0) car.speed += CFG.carAccel * dt;
    else if (throttle < 0) {
      if (car.speed > 0.5) car.speed -= CFG.carBrake * dt;
      else car.speed -= CFG.carReverse * dt;
    } else {
      car.speed -= car.speed * CFG.carDrag * dt;
      if (Math.abs(car.speed) < 0.05) car.speed = 0;
    }
    if (braking && Math.abs(car.speed) > 0.5) {
      car.speed -= Math.sign(car.speed) * CFG.carBrake * 1.4 * dt;
    }
    car.speed = Math.max(-CFG.carReverse, Math.min(car.maxSpeed, car.speed));
    const turnRate = (input.handbrake ? CFG.handbrakeTurn : CFG.carTurn) * Math.min(1, Math.abs(car.speed) / 8);
    // Steering flips when reversing, as in a real car.
    car.angle += steer * turnRate * dt * Math.sign(car.speed || 1);
    car.steerAngle = steer;
    const f = forwardOf(car);
    const nx = car.x + f.x * car.speed * dt;
    const nz = car.z + f.z * car.speed * dt;
    const fixed = world.resolveCircle(nx, nz, 1.7);
    if (fixed.x !== nx || fixed.z !== nz) car.speed *= 0.55;
    car.x = fixed.x;
    car.z = fixed.z;
  }

  // Traffic: follow the street it is on; stop for the car ahead; sometimes
  // turn at an intersection.
  function driveTraffic(car, dt, rng) {
    // Find the car ahead on the same street and direction.
    let gap = Infinity;
    for (const other of cars) {
      if (other === car) continue;
      if (car.axis === 'z') {
        if (Math.abs(other.x - car.x) > 4) continue;
        const ahead = (other.z - car.z) * car.dir;
        if (ahead > 0 && ahead < gap) gap = ahead;
      } else {
        if (Math.abs(other.z - car.z) > 4) continue;
        const ahead = (other.x - car.x) * car.dir;
        if (ahead > 0 && ahead < gap) gap = ahead;
      }
    }
    const want = gap < CFG.trafficStopGap ? 0 : CFG.trafficSpeed;
    car.speed += (want - car.speed) * Math.min(1, dt * 2);
    if (car.speed < 0.05) car.speed = 0;

    // Maybe turn at an intersection.
    const cross = car.axis === 'z' ? car.z : car.x;
    for (const s of STREETS) {
      if (Math.abs(cross - s) < 3 && rng.chance(dt * 0.22)) {
        const newAxis = car.axis === 'z' ? 'x' : 'z';
        const newDir = rng.chance(0.5) ? 1 : -1;
        car.axis = newAxis;
        car.dir = newDir;
        car.street = s;
        car.lane = newDir > 0 ? 3 : -3;
        break;
      }
    }
    if (car.axis === 'z') {
      car.z += car.dir * car.speed * dt;
      car.x = car.street + car.lane;
      car.angle = car.dir > 0 ? 0 : Math.PI;
      if (car.z > 156) car.dir = -1;
      if (car.z < -156) car.dir = 1;
    } else {
      car.x += car.dir * car.speed * dt;
      car.z = car.street + car.lane;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (car.x > 156) car.dir = -1;
      if (car.x < -156) car.dir = 1;
    }
  }

  return {
    cars,
    get playerCar() {
      return playerCar;
    },

    spawnCar,
    spawnTraffic(rng) {
      const kinds = ['sedan', 'coupe', 'van', 'sedan', 'coupe'];
      const kind = rng.pick(kinds);
      const p = world.randomStreetPoint();
      const car = spawnCar(kind, p.x, p.z, 0, 'traffic');
      car.axis = p.axis;
      car.dir = rng.chance(0.5) ? 1 : -1;
      car.street = p.axis === 'z' ? p.x : p.z;
      car.lane = car.dir > 0 ? 3 : -3;
      car.speed = CFG.trafficSpeed;
      return car;
    },

    // The nearest car the player could get into.
    nearestCar(x, z, maxDist) {
      let best = null;
      let bestD = maxDist;
      for (const car of cars) {
        if (car.mode === 'police') continue;
        const d = Math.hypot(car.x - x, car.z - z);
        if (d < bestD) {
          bestD = d;
          best = car;
        }
      }
      return best;
    },

    enterCar(car) {
      if (playerCar) return false;
      // Taking a stranger's traffic car is a crime; mission cars are assigned.
      const stolen = car.mode === 'traffic';
      playerCar = car;
      car.mode = 'player';
      car.speed = 0;
      if (stolen && hooks.onSteal) hooks.onSteal(car);
      if (hooks.onEnter) hooks.onEnter(car);
      return true;
    },

    exitCar() {
      if (!playerCar) return null;
      const car = playerCar;
      playerCar = null;
      car.mode = 'parked';
      car.speed = 0;
      if (hooks.onExit) hooks.onExit(car);
      return car;
    },

    removeCar(car) {
      scene.remove(car.group);
      const i = cars.indexOf(car);
      if (i >= 0) cars.splice(i, 1);
      if (playerCar === car) playerCar = null;
    },

    update(dt, input, rng, playerInCar) {
      if (playerInCar && playerCar) drivePlayer(dt, input);
      for (const car of cars) {
        if (car.mode === 'traffic') driveTraffic(car, dt, rng);
      }
      pushCarsApart();
      for (const car of cars) syncMesh(car);
    },
  };
}
