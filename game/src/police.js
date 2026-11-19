// The wanted system: stars, heat, and police who respond. Crimes add stars; hiding
// out of sight lets them cool down. Police cars chase and ram, foot cops chase on
// foot, and at 3+ stars they set up ahead of the player. Getting caught on foot is
// Busted; at zero health it is Wasted — either way the run restarts at the
// safehouse, minus some cash.
import * as THREE from 'three';
import { WANTED } from './config.js';
import { makeCarMesh } from './vehicles.js';

export function createPolice(scene, world, vehicles, rng) {
  const cops = []; // {mesh, x, z, angle, speed, onFoot, car}
  let wanted = 0;
  let heatTimer = 0; // time since the last crime
  let decayTimer = 0;

  function spawnPoliceCar() {
    const p = world.randomRoadPoint();
    const mesh = makeCarMesh(0x111111, true);
    mesh.position.set(p.x, 0, p.z);
    scene.add(mesh);
    const cop = { mesh, x: p.x, z: p.z, angle: 0, speed: 0, onFoot: false, car: null };
    cops.push(cop);
    return cop;
  }

  function spawnFootCop(x, z) {
    const group = new THREE.Group();
    const uniform = new THREE.MeshStandardMaterial({ color: 0x1a2a6c, roughness: 0.85 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 1.1, 8), uniform);
    body.position.y = 1.15;
    body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xc98d64, roughness: 0.8 }),
    );
    head.position.y = 1.95;
    group.add(head);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.12, 10),
      new THREE.MeshStandardMaterial({ color: 0x0a1a4a, roughness: 0.8 }),
    );
    cap.position.y = 2.15;
    group.add(cap);
    group.position.set(x, 0, z);
    scene.add(group);
    const cop = { mesh: group, x, z, angle: 0, speed: 0, onFoot: true, car: null };
    cops.push(cop);
    return cop;
  }

  function setWanted(stars) {
    wanted = THREE.MathUtils.clamp(stars, 0, WANTED.maxStars);
    heatTimer = 0;
    decayTimer = 0;
    // Match the force on the street to the stars.
    const wantCars = WANTED.policeCars[wanted];
    const wantFoot = WANTED.footCops[wanted];
    const carsNow = cops.filter((c) => !c.onFoot).length;
    const footNow = cops.filter((c) => c.onFoot).length;
    for (let i = carsNow; i < wantCars; i++) spawnPoliceCar();
    for (let i = footNow; i < wantFoot; i++) spawnFootCop(0, 0);
    // Too many: the extra ones give up and leave.
    let extra = carsNow - wantCars;
    for (const cop of [...cops]) {
      if (extra <= 0) break;
      if (!cop.onFoot) {
        scene.remove(cop.mesh);
        cops.splice(cops.indexOf(cop), 1);
        extra -= 1;
      }
    }
    extra = footNow - wantFoot;
    for (const cop of [...cops]) {
      if (extra <= 0) break;
      if (cop.onFoot) {
        scene.remove(cop.mesh);
        cops.splice(cops.indexOf(cop), 1);
        extra -= 1;
      }
    }
  }

  function addWanted(stars) {
    setWanted(wanted + stars);
  }

  function update(dt, player, events) {
    heatTimer += dt;
    if (wanted > 0 && heatTimer > WANTED.decayDelay) {
      decayTimer += dt;
      if (decayTimer > WANTED.decayStep) {
        decayTimer = 0;
        setWanted(wanted - 1);
      }
    }
    const px = player.inCar ? player.inCar.x : player.x;
    const pz = player.inCar ? player.inCar.z : player.z;
    for (const cop of cops) {
      const dx = px - cop.x;
      const dz = pz - cop.z;
      const dist = Math.hypot(dx, dz);
      if (cop.onFoot) {
        // Foot cops sprint at the player, and catch him if they get close.
        const want = Math.atan2(dx, dz);
        cop.angle = want;
        cop.speed = dist < 40 ? 7.5 : 4;
        cop.x += Math.sin(cop.angle) * cop.speed * dt;
        cop.z += Math.cos(cop.angle) * cop.speed * dt;
        if (dist < 1.6 && !player.inCar) {
          events.onBusted();
          return;
        }
      } else {
        // Police cars steer at the player and ram; at 3+ stars one cuts ahead instead.
        const want = Math.atan2(dx, dz);
        let diff = want - cop.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const topSpeed = 26 + wanted * 2.5;
        cop.speed = THREE.MathUtils.damp(cop.speed, dist < 60 ? topSpeed : topSpeed * 0.7, 1.5, dt);
        cop.angle += THREE.MathUtils.clamp(diff, -2.2 * dt, 2.2 * dt);
        cop.x += Math.sin(cop.angle) * cop.speed * dt;
        cop.z += Math.cos(cop.angle) * cop.speed * dt;
        const hit = world.collideCircle(cop.x, cop.z, 2.2);
        cop.x = hit.x;
        cop.z = hit.z;
        // Ram the player's car: damage, and a shove.
        if (player.inCar && dist < 4.5) {
          player.inCar.health -= 4 * dt * 10;
          if (events.onRam) events.onRam();
        }
        // Flash the light bar.
        const bar = cop.mesh.getObjectByName('lightbar');
        if (bar) {
          bar.material.emissive.setHex(Math.floor(performance.now() / 300) % 2 ? 0xff2222 : 0x2244ff);
        }
      }
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.angle;
    }
    // Foot cops start next to the action, not at the map's edge.
    for (const cop of cops) {
      if (cop.onFoot && Math.hypot(cop.x - px, cop.z - pz) > 120) {
        cop.x = px + (rng.chance(0.5) ? 30 : -30);
        cop.z = pz + (rng.chance(0.5) ? 30 : -30);
      }
    }
  }

  function clear() {
    for (const cop of cops) scene.remove(cop.mesh);
    cops.length = 0;
    wanted = 0;
  }

  return {
    get wanted() {
      return wanted;
    },
    cops,
    setWanted,
    addWanted,
    update,
    clear,
  };
}
