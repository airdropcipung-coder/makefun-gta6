// Cars: the player's ride, traffic and police share one mesh builder and one
// road-following brain. Traffic drives the street grid, keeps its lane, and stops
// for the car ahead; the player's car is arcade physics — fast, drifty, forgiving.
import * as THREE from 'three';
import { CAR, TRAFFIC, CITY } from './config.js';

const PAINT = [0xc0392b, 0x2c6fbb, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x1a1a1a, 0x16a085];

export function makeCarMesh(colour, isPolice = false) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color: isPolice ? 0x1a1a1a : colour,
    roughness: 0.35,
    metalness: 0.6,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), paint);
  body.position.y = 0.65;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.6, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.2, metalness: 0.7 }),
  );
  cabin.position.set(0, 1.25, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  if (isPolice) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.18, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x2244ff, emissiveIntensity: 1.5 }),
    );
    bar.position.set(0, 1.62, -0.2);
    bar.name = 'lightbar';
    group.add(bar);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.4, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }),
    );
    door.position.y = 0.65;
    group.add(door);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const wheels = [];
  for (const [x, z] of [
    [-0.95, 1.4],
    [0.95, 1.4],
    [-0.95, -1.4],
    [0.95, -1.4],
  ]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.38, z);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  group.userData.wheels = wheels;
  return group;
}

export function createVehicles(scene, world, rng) {
  const cars = []; // every car: {mesh, x, z, angle, speed, isPlayer, isPolice, isTraffic, colour, health, target, ...}

  function addCar(x, z, angle, colour, kind) {
    const mesh = makeCarMesh(colour, kind === 'police');
    mesh.position.set(x, 0, z);
    mesh.rotation.y = angle;
    scene.add(mesh);
    const car = {
      mesh,
      x,
      z,
      angle,
      speed: 0,
      kind, // 'player' | 'traffic' | 'police' | 'parked'
      colour,
      health: 100,
      steer: 0,
      // traffic brain: current waypoint and the street it follows
      target: null,
      wait: 0,
    };
    cars.push(car);
    return car;
  }

  function pickWaypoint(car) {
    const p = world.randomRoadPoint();
    car.target = p;
  }

  function spawnTraffic(count) {
    for (let i = 0; i < count; i++) {
      const p = world.randomRoadPoint();
      const angle = rng.chance(0.5) ? 0 : Math.PI / 2;
      const car = addCar(p.x, p.z, angle + (rng.chance(0.5) ? Math.PI : 0), rng.pick(PAINT), 'traffic');
      car.speed = rng.range(TRAFFIC.speedMin, TRAFFIC.speedMax);
      pickWaypoint(car);
    }
  }

  function spawnParked(count) {
    for (let i = 0; i < count; i++) {
      const p = world.randomRoadPoint();
      const along = rng.chance(0.5);
      const x = along ? p.x + rng.range(-30, 30) : p.x + (rng.chance(0.5) ? 9 : -9);
      const z = along ? p.z + (rng.chance(0.5) ? 9 : -9) : p.z + rng.range(-30, 30);
      addCar(x, z, along ? 0 : Math.PI / 2, rng.pick(PAINT), 'parked');
    }
  }

  function nearestCar(x, z, maxDist, kinds = ['parked', 'traffic']) {
    let best = null;
    let bestD = maxDist;
    for (const car of cars) {
      if (!kinds.includes(car.kind)) continue;
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  // Arcade driving for the player's car: throttle, brake/reverse, steering that bites
  // harder at low speed, handbrake drift, and building collision with a thud.
  function drive(car, input, dt) {
    const { x, y } = input.axis();
    const handbrake = input.held('handbrake');
    if (y > 0) car.speed += CAR.accel * dt;
    else if (y < 0) {
      if (car.speed > 0.5) car.speed -= CAR.brake * dt;
      else car.speed -= CAR.reverseAccel * dt;
    } else {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
    }
    car.speed = THREE.MathUtils.clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
    const speedFactor = THREE.MathUtils.clamp(Math.abs(car.speed) / 12, 0.25, 1);
    const turn = (handbrake ? CAR.handbrakeTurn : CAR.turnRate) * speedFactor;
    car.angle += x * turn * dt * (car.speed >= 0 ? 1 : -1) * (handbrake ? 1.4 : 1);
    const nx = car.x + Math.sin(car.angle) * car.speed * dt;
    const nz = car.z + Math.cos(car.angle) * car.speed * dt;
    const hit = world.collideCircle(nx, nz, 2.2);
    if (hit.hit && Math.abs(car.speed) > 8) {
      car.speed *= 0.4;
      car.health -= 6;
    }
    const clamped = world.clampToCity(hit.x, hit.z);
    car.x = clamped.x;
    car.z = clamped.z;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.angle;
    // Lean into the turn, wheels spin with speed.
    car.mesh.rotation.z = -x * 0.06 * speedFactor;
    for (const wheel of car.mesh.userData.wheels) wheel.rotation.x += car.speed * dt * 2.4;
    return car.speed;
  }

  function updateTraffic(dt, playerPos) {
    for (const car of cars) {
      if (car.kind !== 'traffic') continue;
      if (!car.target) pickWaypoint(car);
      const dx = car.target.x - car.x;
      const dz = car.target.z - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 6) {
        pickWaypoint(car);
        continue;
      }
      const want = Math.atan2(dx, dz);
      let diff = want - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += THREE.MathUtils.clamp(diff, -1.4 * dt, 1.4 * dt);
      // Stop for the car ahead (traffic jam, and it keeps the player from being rammed).
      let blocked = false;
      for (const other of cars) {
        if (other === car) continue;
        const ox = other.x - car.x;
        const oz = other.z - car.z;
        const od = Math.hypot(ox, oz);
        if (od < 7 && Math.cos(Math.atan2(ox, oz) - car.angle) > 0.6) {
          blocked = true;
          break;
        }
      }
      // And for the player on foot crossing in front of it.
      if (playerPos) {
        const px = playerPos.x - car.x;
        const pz = playerPos.z - car.z;
        if (Math.hypot(px, pz) < 6 && Math.cos(Math.atan2(px, pz) - car.angle) > 0.7) blocked = true;
      }
      const targetSpeed = blocked ? 0 : rng.range(TRAFFIC.speedMin, TRAFFIC.speedMax);
      car.speed = THREE.MathUtils.damp(car.speed, targetSpeed, 2, dt);
      car.x += Math.sin(car.angle) * car.speed * dt;
      car.z += Math.cos(car.angle) * car.speed * dt;
      const hit = world.collideCircle(car.x, car.z, 2.2);
      car.x = hit.x;
      car.z = hit.z;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.angle;
      for (const wheel of car.mesh.userData.wheels) wheel.rotation.x += car.speed * dt * 2.4;
    }
  }

  function removeCar(car) {
    scene.remove(car.mesh);
    const i = cars.indexOf(car);
    if (i >= 0) cars.splice(i, 1);
  }

  return { cars, addCar, spawnTraffic, spawnParked, nearestCar, drive, updateTraffic, removeCar };
}
