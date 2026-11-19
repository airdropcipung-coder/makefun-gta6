// Combat: a punch up close and a hitscan pistol with tracers, a magazine and
// a reload. Shots scare pedestrians, add heat, and can drop cops.

import * as THREE from 'three';
import { CFG } from './config.js';

export function createCombat(scene, player, vehicles, pedestrians, police, audio, hooks) {
  const tracers = [];
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 });
  let cooldown = 0;
  let reloadTimer = 0;

  const combat = {
    hasPistol: false,
    ammo: 0,
    get reloading() {
      return reloadTimer > 0;
    },

    givePistol() {
      combat.hasPistol = true;
      combat.ammo = CFG.magSize;
    },

    // The nearest person in front of the player, within punch range.
    punch() {
      if (cooldown > 0) return;
      cooldown = CFG.punchCooldown;
      audio.punch();
      const px = player.x;
      const pz = player.z;
      const fx = Math.sin(player.angle);
      const fz = Math.cos(player.angle);
      const hitPerson = (list, isCop) => {
        for (const p of list) {
          if (p.down) continue;
          const dx = p.x - px;
          const dz = p.z - pz;
          const d = Math.hypot(dx, dz);
          if (d > CFG.punchRange) continue;
          if (dx * fx + dz * fz < 0) continue; // behind the player
          return p;
        }
        return null;
      };
      const ped = hitPerson(pedestrians.list, false);
      if (ped) {
        knockDown(ped);
        police.addHeat(15);
        if (hooks.onCrime) hooks.onCrime('ped');
        return;
      }
      const cop = hitPerson(police.footCops, true);
      if (cop) {
        cop.health = (cop.health ?? 50) - CFG.punchDamage;
        audio.hit();
        if (cop.health <= 0) {
          dropCop(cop);
          police.addHeat(20);
        }
      }
    },

    // A hitscan shot along the camera's forward ray.
    shoot(camera) {
      if (!combat.hasPistol || cooldown > 0 || reloadTimer > 0) return;
      if (combat.ammo <= 0) {
        combat.reload();
        return;
      }
      cooldown = CFG.fireCooldown;
      combat.ammo -= 1;
      audio.shot();
      police.addHeat(10);
      pedestrians.scare(player.x, player.z, 40);

      const origin = camera.position.clone();
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const end = origin.clone().add(dir.clone().multiplyScalar(CFG.pistolRange));

      // Nearest hit among people, cops and cars, as spheres.
      let best = null;
      let bestT = CFG.pistolRange;
      const test = (x, y, z, r, target) => {
        const ox = x - origin.x;
        const oy = y - origin.y;
        const oz = z - origin.z;
        const t = ox * dir.x + oy * dir.y + oz * dir.z;
        if (t < 0 || t > bestT) return;
        const cx = origin.x + dir.x * t - x;
        const cy = origin.y + dir.y * t - y;
        const cz = origin.z + dir.z * t - z;
        if (cx * cx + cy * cy + cz * cz < r * r) {
          bestT = t;
          best = target;
        }
      };
      for (const p of pedestrians.list) {
        if (!p.down) test(p.x, 1.2, p.z, 0.9, { kind: 'ped', ref: p });
      }
      for (const c of police.footCops) {
        test(c.x, 1.2, c.z, 0.9, { kind: 'cop', ref: c });
      }
      for (const car of vehicles.cars) {
        test(car.x, 0.9, car.z, 2.2, { kind: 'car', ref: car });
      }

      const hitPoint = origin.clone().add(dir.clone().multiplyScalar(best ? bestT : CFG.pistolRange));
      addTracer(origin, hitPoint);
      if (best) {
        if (best.kind === 'ped') {
          knockDown(best.ref);
          police.addHeat(15);
          if (hooks.onCrime) hooks.onCrime('ped');
        } else if (best.kind === 'cop') {
          const cop = best.ref;
          cop.health = (cop.health ?? 50) - CFG.pistolDamage;
          audio.hit();
          if (cop.health <= 0) {
            dropCop(cop);
            police.addHeat(20);
          }
        } else {
          best.ref.speed *= 0.5;
          audio.hit();
          if (hooks.onSparks) hooks.onSparks(hitPoint);
        }
      }
      if (combat.ammo === 0) combat.reload();
    },

    reload() {
      if (reloadTimer > 0 || combat.ammo === CFG.magSize) return;
      reloadTimer = CFG.reloadTime;
    },

    update(dt, input, camera, inCar) {
      cooldown = Math.max(0, cooldown - dt);
      if (reloadTimer > 0) {
        reloadTimer -= dt;
        if (reloadTimer <= 0) {
          combat.ammo = CFG.magSize;
          reloadTimer = 0;
        }
      }
      // Fists and the pistol are for on foot; the car is the weapon in a car.
      if (!inCar) {
        if (input.wasPressed('punch')) combat.punch();
        if (input.wasPressed('reload')) combat.reload();
        if (input.mouse.clicked) combat.shoot(camera);
      }
      for (let i = tracers.length - 1; i >= 0; i--) {
        const t = tracers[i];
        t.life -= dt;
        t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
        if (t.life <= 0) {
          scene.remove(t.line);
          tracers.splice(i, 1);
        }
      }
    },
  };

  function knockDown(ped) {
    ped.down = true;
    ped.group.rotation.x = -Math.PI / 2;
    ped.group.position.y = 0.3;
    audio.hit();
  }

  function dropCop(cop) {
    cop.group.rotation.x = -Math.PI / 2;
    cop.group.position.y = 0.3;
    cop.down = true;
    if (hooks.onCopDown) hooks.onCopDown(cop);
  }

  function addTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, tracerMat.clone());
    scene.add(line);
    tracers.push({ line, life: 0.09 });
  }

  return combat;
}
