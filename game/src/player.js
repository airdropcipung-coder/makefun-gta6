// Danny Reyes on foot: a low-poly figure that walks camera-relative, sprints
// with Shift, and swings his legs while he moves. Health and armour live here;
// combat.js asks this module to deal and take damage.

import * as THREE from 'three';
import { CFG } from './config.js';

export function createPlayer(scene, world) {
  const group = new THREE.Group();
  group.name = 'danny';

  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d64, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0x2e6a8e, roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2c2f36, roughness: 0.9 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 1 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
  torso.position.y = 1.12;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.38), skin);
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);
  const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.4), hair);
  hairMesh.position.y = 1.94;
  group.add(hairMesh);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), pants);
  legL.position.set(-0.17, 0.36, 0);
  legL.castShadow = true;
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.17;
  group.add(legR);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.22), shirt);
  armL.position.set(-0.42, 1.14, 0);
  armL.castShadow = true;
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  group.add(armR);

  scene.add(group);

  const player = {
    group,
    health: CFG.playerHealth,
    armour: CFG.playerArmour,
    angle: 0, // facing, radians around Y
    walkPhase: 0,
    moving: false,
    speed: 0,

    get x() {
      return group.position.x;
    },
    get z() {
      return group.position.z;
    },
    setPosition(x, z) {
      group.position.set(x, 0, z);
    },

    // Damage soaks armour first, then health. Returns true if wasted.
    damage(amount) {
      let rest = amount;
      if (player.armour > 0) {
        const soaked = Math.min(player.armour, rest);
        player.armour -= soaked;
        rest -= soaked;
      }
      player.health -= rest;
      return player.health <= 0;
    },
    heal(amount) {
      player.health = Math.min(CFG.playerHealth, player.health + amount);
    },

    // Move with WASD relative to the camera yaw; sprint with Shift.
    update(dt, input, camYaw) {
      const fx = Math.sin(camYaw);
      const fz = Math.cos(camYaw);
      const rx = Math.cos(camYaw);
      const rz = -Math.sin(camYaw);
      let mx = 0;
      let mz = 0;
      const throttle = input.throttle();
      const steer = input.steer();
      mx += fx * throttle + rx * steer;
      mz += fz * throttle + rz * steer;
      const len = Math.hypot(mx, mz);
      player.moving = len > 0.01;
      const top = input.sprinting ? CFG.sprintSpeed : CFG.walkSpeed;
      if (player.moving) {
        mx /= len;
        mz /= len;
        player.speed = top;
        const nx = group.position.x + mx * top * dt;
        const nz = group.position.z + mz * top * dt;
        const fixed = world.resolveCircle(nx, nz, CFG.playerRadius);
        group.position.x = fixed.x;
        group.position.z = fixed.z;
        player.angle = Math.atan2(mx, mz);
        group.rotation.y = player.angle;
        player.walkPhase += dt * top * 1.6;
      } else {
        player.speed = 0;
      }
      const swing = player.moving ? Math.sin(player.walkPhase) * 0.55 : 0;
      legL.rotation.x = swing;
      legR.rotation.x = -swing;
      armL.rotation.x = -swing * 0.7;
      armR.rotation.x = swing * 0.7;
    },
  };

  player.setPosition(-104, -84);
  return player;
}
