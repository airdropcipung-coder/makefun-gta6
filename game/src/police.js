// The wanted system: heat builds with crimes and cools when the player hides.
// Police cars chase and ram; foot cops chase on foot and bust the player when
// they catch him. Stars are heat divided by twenty, capped at five.

import * as THREE from 'three';
import { CFG } from './config.js';

function copMesh() {
  const group = new THREE.Group();
  const navy = new THREE.MeshStandardMaterial({ color: 0x1e2f4a, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb98a68, roughness: 0.8 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.32), navy);
  torso.position.y = 1.08;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.34), skin);
  head.position.y = 1.62;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.38), navy);
  cap.position.y = 1.84;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), navy);
  legL.position.set(-0.15, 0.35, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.15;
  group.add(legR);
  return { group, legL, legR };
}

export function createPolice(scene, world, vehicles, rng, hooks) {
  const copCars = [];
  const footCops = [];
  let heat = 0;
  let lastCrime = -999;
  let bustTimer = 0;
  let time = 0;

  function spawnCopCar(px, pz) {
    const p = world.randomStreetPoint();
    const car = vehicles.spawnCar('police', p.x, p.z, 0, 'police');
    // Nudge the spawn towards the player so the chase starts close.
    car.x = px + (car.x - px) * 0.5;
    car.z = pz + (car.z - pz) * 0.5;
    car.speed = CFG.copCarSpeed * 0.7;
    copCars.push(car);
    return car;
  }

  function spawnFootCop(px, pz) {
    const { group, legL, legR } = copMesh();
    const a = rng.angle();
    const x = px + Math.sin(a) * 30;
    const z = pz + Math.cos(a) * 30;
    group.position.set(x, 0, z);
    scene.add(group);
    const cop = { group, legL, legR, x, z, angle: 0, phase: 0 };
    footCops.push(cop);
    return cop;
  }

  function removeCopCar(car) {
    vehicles.removeCar(car);
    const i = copCars.indexOf(car);
    if (i >= 0) copCars.splice(i, 1);
  }

  function removeFootCop(cop) {
    scene.remove(cop.group);
    const i = footCops.indexOf(cop);
    if (i >= 0) footCops.splice(i, 1);
  }

  const police = {
    copCars,
    footCops,
    // Put a foot cop at an exact spot (screenshot staging).
    placeFootCop(x, z) {
      const { group, legL, legR } = copMesh();
      group.position.set(x, 0, z);
      scene.add(group);
      const cop = { group, legL, legR, x, z, angle: 0, phase: 0 };
      footCops.push(cop);
      return cop;
    },
    get wanted() {
      return Math.min(CFG.maxWanted, Math.floor(heat / CFG.heatPerStar));
    },
    get heat() {
      return heat;
    },

    // A crime adds heat now and resets the calm timer.
    addHeat(n) {
      heat = Math.min(100, heat + n);
      lastCrime = time;
    },
    setHeat(n) {
      heat = Math.max(0, Math.min(100, n));
      lastCrime = time;
    },
    reset() {
      heat = 0;
      bustTimer = 0;
      for (const c of [...copCars]) removeCopCar(c);
      for (const c of [...footCops]) removeFootCop(c);
    },

    // Distance to the nearest police unit, for the HUD and heat decay.
    nearestCop(px, pz) {
      let best = Infinity;
      for (const c of copCars) best = Math.min(best, Math.hypot(c.x - px, c.z - pz));
      for (const c of footCops) best = Math.min(best, Math.hypot(c.x - px, c.z - pz));
      return best;
    },

    update(dt, player, playerCar) {
      time += dt;
      const px = playerCar ? playerCar.x : player.x;
      const pz = playerCar ? playerCar.z : player.z;
      const wanted = police.wanted;

      // Heat cools: fast when calm and unseen, slow while the chase is on.
      const calm = time - lastCrime > CFG.calmSeconds;
      const near = police.nearestCop(px, pz);
      const rate = calm && near > 50 ? CFG.heatDecayCalm : CFG.heatDecayHot;
      if (heat > 0) heat = Math.max(0, heat - rate * dt);

      // Keep the pursuit sized to the wanted level. Staged cars are never
      // the ones removed when the level drops.
      const wantCars = Math.min(wanted, CFG.copCarCount);
      while (copCars.length < wantCars) spawnCopCar(px, pz);
      while (copCars.length > wantCars) {
        let i = copCars.length - 1;
        while (i >= 0 && copCars[i].staged) i -= 1;
        if (i < 0) break;
        removeCopCar(copCars[i]);
      }
      const wantCops = wanted >= 2 ? Math.min(wanted - 1, CFG.copFootCount) : 0;
      while (footCops.length < wantCops) spawnFootCop(px, pz);
      while (footCops.length > wantCops) removeFootCop(footCops[footCops.length - 1]);

      // Cop cars: steer at the player, ram the player's car. Cars staged for
      // a screenshot hold their pose instead of chasing.
      for (const car of copCars) {
        if (car.staged) {
          car.group.position.set(car.x, 0, car.z);
          car.group.rotation.y = car.angle;
          continue;
        }
        const dx = px - car.x;
        const dz = pz - car.z;
        const dist = Math.hypot(dx, dz) || 1;
        const wantAngle = Math.atan2(dx, dz);
        let diff = wantAngle - car.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
        car.speed = Math.min(CFG.copCarSpeed, car.speed + 12 * dt);
        if (dist > 6) {
          car.x += Math.sin(car.angle) * car.speed * dt;
          car.z += Math.cos(car.angle) * car.speed * dt;
        } else if (playerCar) {
          // Ramming: shove the player's car and scrub its speed.
          const push = 3 * dt;
          playerCar.x += (dx / dist) * push * 4;
          playerCar.z += (dz / dist) * push * 4;
          playerCar.speed *= 1 - 1.8 * dt;
          if (hooks.onRam) hooks.onRam();
        }
        const fixed = world.resolveCircle(car.x, car.z, 1.7);
        car.x = fixed.x;
        car.z = fixed.z;
        car.group.position.set(car.x, 0, car.z);
        car.group.rotation.y = car.angle;
      }

      // Foot cops: run at the player; hold close and the player is busted.
      let busting = false;
      for (const cop of footCops) {
        if (cop.down) continue;
        const dx = px - cop.x;
        const dz = pz - cop.z;
        const dist = Math.hypot(dx, dz) || 1;
        cop.angle = Math.atan2(dx, dz);
        if (dist > 1.6) {
          cop.x += (dx / dist) * CFG.copFootSpeed * dt;
          cop.z += (dz / dist) * CFG.copFootSpeed * dt;
        }
        const fixed = world.resolveCircle(cop.x, cop.z, 0.4);
        cop.x = fixed.x;
        cop.z = fixed.z;
        cop.group.position.set(cop.x, 0, cop.z);
        cop.group.rotation.y = cop.angle;
        cop.phase += dt * 9;
        cop.legL.rotation.x = Math.sin(cop.phase) * 0.6;
        cop.legR.rotation.x = -Math.sin(cop.phase) * 0.6;
        if (!playerCar && dist < CFG.bustRange) busting = true;
      }
      if (busting) {
        bustTimer += dt;
        if (bustTimer > CFG.bustHold && hooks.onBusted) {
          bustTimer = 0;
          hooks.onBusted();
        }
      } else {
        bustTimer = Math.max(0, bustTimer - dt * 2);
      }
    },
  };
  return police;
}
