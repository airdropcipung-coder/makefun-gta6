// Combat: fists and a pistol. Punches are a short-range arc in front of the player;
// the pistol fires a hitscan tracer at the nearest target in the aim cone (mouse
// click or tap), with a magazine, reload, and a muzzle flash. Pedestrians and cops
// can be hit; hitting a cop or a bystander is a crime, and the police module hears
// about it.
import * as THREE from 'three';
import { COMBAT } from './config.js';

export function createCombat(scene) {
  const tracers = []; // {line, life}
  let punchCooldown = 0;
  let shootCooldown = 0;
  let ammo = COMBAT.pistolMag;
  let reloading = 0;
  let hasPistol = false;

  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe08a });
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });

  function fireTracer(from, to) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, len), tracerMat);
    line.position.copy(from).addScaledVector(dir, 0.5);
    line.lookAt(to);
    scene.add(line);
    tracers.push({ line, life: 0.12 });
    const flash = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), flashMat);
    flash.position.copy(from);
    scene.add(flash);
    tracers.push({ line: flash, life: 0.06 });
  }

  // The nearest living target inside a cone in front of the shooter.
  function nearestTarget(from, angle, targets) {
    let best = null;
    let bestD = COMBAT.pistolRange;
    for (const t of targets) {
      if (t.alive === false) continue;
      const dx = t.x - from.x;
      const dz = t.z - from.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD) continue;
      const a = Math.atan2(dx, dz);
      let diff = Math.abs(a - angle);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff < 0.45) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  return {
    get ammo() {
      return ammo;
    },
    get hasPistol() {
      return hasPistol;
    },
    givePistol() {
      hasPistol = true;
      ammo = COMBAT.pistolMag;
    },
    update(dt) {
      punchCooldown = Math.max(0, punchCooldown - dt);
      shootCooldown = Math.max(0, shootCooldown - dt);
      if (reloading > 0) {
        reloading -= dt;
        if (reloading <= 0) ammo = COMBAT.pistolMag;
      }
      for (const t of [...tracers]) {
        t.life -= dt;
        if (t.life <= 0) {
          scene.remove(t.line);
          tracers.splice(tracers.indexOf(t), 1);
        }
      }
    },
    punch(from, angle, targets, onHit) {
      if (punchCooldown > 0) return false;
      punchCooldown = COMBAT.punchCooldown;
      const target = nearestTarget(from, angle, targets);
      if (target && Math.hypot(target.x - from.x, target.z - from.z) < COMBAT.punchRange) {
        if (target.health !== undefined) target.health -= COMBAT.punchDamage;
        else target.alive = false;
        onHit(target, COMBAT.punchDamage);
        return true;
      }
      return false;
    },
    shoot(from, angle, targets, onHit) {
      if (!hasPistol || shootCooldown > 0 || reloading > 0) return false;
      if (ammo <= 0) {
        reloading = 1.4;
        return false;
      }
      shootCooldown = COMBAT.pistolCooldown;
      ammo -= 1;
      const fromVec = new THREE.Vector3(from.x, 1.4, from.z);
      const target = nearestTarget(from, angle, targets);
      const end = target
        ? new THREE.Vector3(target.x, 1.2, target.z)
        : new THREE.Vector3(
            from.x + Math.sin(angle) * COMBAT.pistolRange,
            1.4,
            from.z + Math.cos(angle) * COMBAT.pistolRange,
          );
      fireTracer(fromVec, end);
      if (target) {
        if (target.health !== undefined) target.health -= COMBAT.pistolDamage;
        else target.alive = false;
        onHit(target, COMBAT.pistolDamage);
      }
      return true;
    },
  };
}
