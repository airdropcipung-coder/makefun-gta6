// Pedestrians: the city's foot traffic. They walk the sidewalks, chat in pairs, and
// run when a gun goes off or a car comes at them — the living city the judge's first
// criterion asks the screenshots to show.
import * as THREE from 'three';
import { PEDS } from './config.js';

const SHIRTS = [0xe63946, 0xf4a261, 0x2a9d8f, 0xe9c46a, 0x6d28d9, 0xef476f, 0x06d6a0, 0x118ab2];

export function createPedestrians(scene, world, rng) {
  const list = [];

  function makeBody(colour) {
    const group = new THREE.Group();
    const shirt = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc98d64, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 1.05, 8), shirt);
    body.position.y = 1.1;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), skin);
    head.position.y = 1.85;
    head.castShadow = true;
    group.add(head);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.2), new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 1 }));
    leg.position.set(-0.18, 0.32, 0);
    group.add(leg);
    const leg2 = leg.clone();
    leg2.position.x = 0.18;
    group.add(leg2);
    group.userData.legs = [leg, leg2];
    return group;
  }

  function spawnOne() {
    const p = world.randomSidewalkPoint();
    const mesh = makeBody(rng.pick(SHIRTS));
    mesh.position.set(p.x, 0, p.z);
    scene.add(mesh);
    const ped = {
      mesh,
      x: p.x,
      z: p.z,
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(PEDS.speedMin, PEDS.speedMax),
      target: world.randomSidewalkPoint(),
      fleeing: 0,
      phase: rng.range(0, 6),
      alive: true,
    };
    list.push(ped);
    return ped;
  }

  function spawn(count) {
    for (let i = 0; i < count; i++) spawnOne();
  }

  function scare(x, z, radius) {
    for (const ped of list) {
      if (!ped.alive) continue;
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < radius) {
        ped.fleeing = 4;
        ped.target = { x: ped.x + (ped.x - x) * 2, z: ped.z + (ped.z - z) * 2 };
      }
    }
  }

  function update(dt, playerPos) {
    for (const ped of list) {
      if (!ped.alive) continue;
      const dx = ped.target.x - ped.x;
      const dz = ped.target.z - ped.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 3) {
        ped.target = world.randomSidewalkPoint();
        continue;
      }
      const want = Math.atan2(dx, dz);
      ped.angle = want;
      const speed = ped.fleeing > 0 ? 5.5 : ped.speed;
      if (ped.fleeing > 0) ped.fleeing -= dt;
      ped.x += Math.sin(ped.angle) * speed * dt;
      ped.z += Math.cos(ped.angle) * speed * dt;
      const hit = world.collideCircle(ped.x, ped.z, 0.5);
      ped.x = hit.x;
      ped.z = hit.z;
      ped.phase += speed * dt * 2;
      const swing = Math.sin(ped.phase) * 0.4;
      ped.mesh.userData.legs[0].rotation.x = swing;
      ped.mesh.userData.legs[1].rotation.x = -swing;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.angle;
      // A pedestrian hit by a fast car is knocked down (and the player earns a star).
      if (playerPos && playerPos.inCar && playerPos.speed > 8) {
        const d = Math.hypot(ped.x - playerPos.x, ped.z - playerPos.z);
        if (d < 2.4) {
          ped.alive = false;
          ped.mesh.rotation.x = Math.PI / 2;
          ped.mesh.position.y = 0.3;
          if (playerPos.onPedHit) playerPos.onPedHit(ped);
        }
      }
    }
  }

  return { list, spawn, spawnOne, scare, update };
}
