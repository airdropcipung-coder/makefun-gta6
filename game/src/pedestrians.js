// Foot traffic: people who stroll the sidewalks, cross at corners, and run
// when a gun goes off. They never enter buildings and never drive.

import * as THREE from 'three';
import { CFG } from './config.js';
import { STREETS } from './world.js';

const SHIRT_COLORS = [0xd86a4a, 0x4a8ad8, 0x6ab04a, 0xd8b04a, 0x9a5ad8, 0xd8d8d8, 0x3a3a3a];

function pedMesh(color) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb98a68, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x33363d, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.28), shirt);
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.3), skin);
  head.position.y = 1.55;
  head.castShadow = true;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.2), pants);
  legL.position.set(-0.13, 0.35, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.13;
  group.add(legR);
  return { group, legL, legR };
}

export function createPedestrians(scene, world, rng) {
  const list = [];

  function spawn(x, z) {
    const { group, legL, legR } = pedMesh(rng.pick(SHIRT_COLORS));
    group.position.set(x, 0, z);
    scene.add(group);
    const ped = {
      group,
      legL,
      legR,
      x,
      z,
      angle: rng.angle(),
      speed: CFG.pedSpeed * rng.range(0.8, 1.25),
      target: null,
      fleeing: false,
      fleeTimer: 0,
      phase: rng.range(0, 6),
      down: false,
    };
    ped.target = pickTarget(ped);
    list.push(ped);
    return ped;
  }

  // A nearby sidewalk corner to walk towards.
  function pickTarget(ped) {
    const s = rng.pick(STREETS);
    const along = rng.range(-140, 140);
    if (rng.chance(0.5)) return { x: s + 9, z: along };
    return { x: along, z: s + 9 };
  }

  return {
    list,
    spawn,
    spawnMany(n) {
      for (let i = 0; i < n; i++) {
        const p = world.randomStreetPoint();
        const off = rng.chance(0.5) ? 9 : -9;
        spawn(p.axis === 'z' ? p.x + off : p.x, p.axis === 'z' ? p.z : p.z + off);
      }
    },

    // A gunshot at (x, z) sends everyone nearby running.
    scare(x, z, radius) {
      for (const ped of list) {
        if (ped.down) continue;
        const d = Math.hypot(ped.x - x, ped.z - z);
        if (d < radius) {
          ped.fleeing = true;
          ped.fleeTimer = 4;
          ped.angle = Math.atan2(ped.x - x, ped.z - z);
        }
      }
    },

    update(dt) {
      for (const ped of list) {
        if (ped.down) continue;
        let speed = ped.speed;
        if (ped.fleeing) {
          speed = CFG.pedFleeSpeed;
          ped.fleeTimer -= dt;
          if (ped.fleeTimer <= 0) ped.fleeing = false;
        } else if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.z - ped.z) < 2) {
          ped.target = pickTarget(ped);
        }
        if (!ped.fleeing && ped.target) {
          const dx = ped.target.x - ped.x;
          const dz = ped.target.z - ped.z;
          ped.angle = Math.atan2(dx, dz);
        }
        const nx = ped.x + Math.sin(ped.angle) * speed * dt;
        const nz = ped.z + Math.cos(ped.angle) * speed * dt;
        const fixed = world.resolveCircle(nx, nz, 0.4);
        ped.x = fixed.x;
        ped.z = fixed.z;
        ped.group.position.set(ped.x, 0, ped.z);
        ped.group.rotation.y = ped.angle;
        ped.phase += dt * speed * 2.4;
        const swing = Math.sin(ped.phase) * 0.5;
        ped.legL.rotation.x = swing;
        ped.legR.rotation.x = -swing;
      }
    },
  };
}
