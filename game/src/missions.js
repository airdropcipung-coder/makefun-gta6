// The story: five missions in a chain, taxi fares for free roam, and ten cash
// pickups hidden around the city. Each mission is a small state machine with a
// marker on the map and an objective line on the HUD.

import * as THREE from 'three';
import { CFG, LANDMARKS, MISSIONS } from './config.js';

function makeBeacon(scene) {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 26, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 13;
  group.add(beam);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3, 0.28, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd24a }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.25;
  group.add(ring);
  group.visible = false;
  scene.add(group);
  return group;
}

function makePickupMesh(scene, x, z) {
  const mesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.7),
    new THREE.MeshStandardMaterial({ color: 0xffc800, emissive: 0xaa7700, emissiveIntensity: 0.8, metalness: 0.6, roughness: 0.3 }),
  );
  mesh.position.set(x, 1.1, z);
  scene.add(mesh);
  return mesh;
}

export function createMissions(scene, world, player, vehicles, police, audio, save, hud, rng, hooks) {
  const beacon = makeBeacon(scene);
  const checkpoints = [LANDMARKS.hotel, LANDMARKS.docks, LANDMARKS.plaza];
  let index = save.mission; // next mission to play
  let phase = 0;
  let timer = 0;
  let standTime = 0;
  let taxiCar = null;
  let sportCar = null;
  let fare = null; // { ped, dest, active }
  let fareTimer = 0;
  const pickups = [];
  let marker = null;

  // Cash pickups at seeded spots on sidewalks.
  for (let i = 0; i < CFG.pickupCount; i++) {
    const p = world.randomStreetPoint();
    const x = p.axis === 'z' ? p.x + 9 : p.x;
    const z = p.axis === 'z' ? p.z : p.z + 9;
    const mesh = makePickupMesh(scene, x, z);
    pickups.push({ x, z, mesh, taken: save.pickups.includes(i), id: i });
    if (save.pickups.includes(i)) mesh.visible = false;
  }

  function setMarker(x, z, visible) {
    marker = visible === false ? null : { x, z };
    beacon.visible = visible !== false;
    if (marker) beacon.position.set(marker.x, 0, marker.z);
  }

  function current() {
    return MISSIONS[index] || null;
  }

  function startMission() {
    const m = current();
    if (!m) {
      hud.setObjective('Free roam — fares and pickups around the city');
      setMarker(0, 0, false);
      return;
    }
    phase = 0;
    timer = 0;
    standTime = 0;
    hud.setMission(m.name);
    hud.setObjective(m.objective);
    hud.toast(`Mission ${index + 1}: ${m.name} — ${m.brief}`);
    audio.pickup();
    if (m.id === 'fare') {
      taxiCar = vehicles.spawnCar('taxi', LANDMARKS.garage.x + 8, LANDMARKS.garage.z + 6, Math.PI / 2, 'parked');
      setMarker(taxiCar.x, taxiCar.z);
    } else if (m.id === 'wheels') {
      sportCar = vehicles.spawnCar('sport', LANDMARKS.docks.x - 6, LANDMARKS.docks.z + 4, Math.PI, 'parked');
      setMarker(LANDMARKS.docks.x, LANDMARKS.docks.z);
    } else if (m.id === 'pickup') {
      setMarker(LANDMARKS.market.x, LANDMARKS.market.z);
    } else if (m.id === 'bank') {
      police.setHeat(40);
      timer = 150;
      setMarker(checkpoints[0].x, checkpoints[0].z);
    } else if (m.id === 'score') {
      setMarker(LANDMARKS.jewelers.x, LANDMARKS.jewelers.z);
    }
  }

  function completeMission() {
    const m = current();
    if (!m) return;
    save.cash += m.pay;
    save.respect += 10;
    audio.complete();
    hud.toast(`Mission complete: ${m.name} — +$${m.pay}`);
    if (hooks.onMissionComplete) hooks.onMissionComplete(m);
    index += 1;
    save.mission = index;
    if (index >= MISSIONS.length) {
      save.storyDone = true;
      if (hooks.onStoryComplete) hooks.onStoryComplete();
      hud.setObjective('Story complete — free roam: fares, pickups, trouble');
      setMarker(0, 0, false);
    } else {
      startMission();
    }
  }

  function failMission(reason) {
    audio.fail();
    hud.toast(`Mission failed: ${reason} — try again`);
    if (hooks.onMissionFail) hooks.onMissionFail(reason);
    police.reset();
    startMission();
  }

  // A taxi fare: a waiting pedestrian, then a destination.
  function startFare() {
    if (fare || !save.storyDone) return;
    const p = world.randomStreetPoint();
    const ped = { x: p.x, z: p.z };
    const dest = rng.pick([LANDMARKS.hotel, LANDMARKS.plaza, LANDMARKS.docks, LANDMARKS.market]);
    fare = { ped, dest, active: false, waiting: true };
    setMarker(ped.x, ped.z);
    hud.toast('Taxi fare waiting — drive to the passenger');
    hud.setObjective('Pick up the taxi fare');
  }

  const missions = {
    get index() {
      return index;
    },
    get marker() {
      return marker;
    },
    get timerLeft() {
      return timer;
    },
    get fare() {
      return fare;
    },
    get storyDone() {
      return index >= MISSIONS.length;
    },
    start: startMission,
    startFare,
    // Pose a marker and objective without touching the story (screenshots).
    stageMarker(x, z, objective) {
      setMarker(x, z);
      hud.setObjective(objective);
    },

    // Called when the player gets into a car.
    onEnterCar(car) {
      const m = current();
      if (!m) return;
      if (m.id === 'fare' && car === taxiCar && phase === 0) {
        phase = 1;
        setMarker(LANDMARKS.hotel.x, LANDMARKS.hotel.z);
        hud.setObjective('Drive the taxi to the Bay Hotel');
      }
      if (m.id === 'wheels' && car === sportCar && phase === 0) {
        phase = 1;
        police.addHeat(20);
        hud.toast('Stolen! The Vipers want their car back.');
        setMarker(LANDMARKS.garage.x, LANDMARKS.garage.z);
        hud.setObjective('Deliver the sports car to Rosa Garage');
      }
      if (fare && fare.waiting) {
        const d = Math.hypot(car.x - fare.ped.x, car.z - fare.ped.z);
        if (d < 8) {
          fare.waiting = false;
          fare.active = true;
          setMarker(fare.dest.x, fare.dest.z);
          hud.toast(`Fare aboard — take them to ${fare.dest.name}`);
          hud.setObjective(`Taxi fare: ${fare.dest.name}`);
        }
      }
    },

    update(dt, inCar) {
      // Beacon pulse.
      beacon.rotation.y += dt * 0.8;
      beacon.scale.setScalar(1 + Math.sin(Date.now() * 0.004) * 0.06);
      for (const p of pickups) {
        if (!p.taken) p.mesh.rotation.y += dt * 2;
      }

      // Cash pickups: walk or drive through one.
      const px = inCar ? vehicles.playerCar.x : player.x;
      const pz = inCar ? vehicles.playerCar.z : player.z;
      for (const p of pickups) {
        if (p.taken) continue;
        if (Math.hypot(p.x - px, p.z - pz) < 2.6) {
          p.taken = true;
          p.mesh.visible = false;
          save.cash += CFG.pickupPay;
          save.pickups.push(p.id);
          audio.cash();
          hud.toast(`Cash pickup +$${CFG.pickupPay}`);
        }
      }

      const m = current();
      if (!m) {
        // Free roam: keep a fare waiting.
        if (!fare) {
          fareTimer += dt;
          if (fareTimer > 20) {
            fareTimer = 0;
            startFare();
          }
        } else if (fare.active) {
          if (Math.hypot(fare.dest.x - px, fare.dest.z - pz) < 9) {
            const pay = rng.pick(CFG.farePay);
            save.cash += pay;
            save.faresDone += 1;
            audio.cash();
            hud.toast(`Fare complete +$${pay}`);
            fare = null;
            fareTimer = 0;
            hud.setObjective('Free roam — fares and pickups around the city');
            setMarker(0, 0, false);
          }
        }
        return;
      }

      const dist = marker ? Math.hypot(marker.x - px, marker.z - pz) : Infinity;
      if (m.id === 'fare') {
        if (phase === 1 && dist < 9) completeMission();
      } else if (m.id === 'wheels') {
        if (phase === 1 && dist < 9) {
          if (vehicles.playerCar === sportCar) completeMission();
        }
      } else if (m.id === 'pickup') {
        if (phase === 0 && dist < 4 && !inCar) {
          phase = 1;
          police.setHeat(40);
          hud.toast('Package taken — run to the Safehouse, two stars on you!');
          setMarker(LANDMARKS.safehouse.x, LANDMARKS.safehouse.z);
          hud.setObjective('Escape to the Safehouse');
        } else if (phase === 1 && dist < 9) {
          completeMission();
        }
      } else if (m.id === 'bank') {
        timer -= dt;
        if (timer <= 0) {
          failMission('Out of time on the Bank Run');
          return;
        }
        if (dist < 9) {
          phase += 1;
          audio.pickup();
          if (phase >= 3) {
            completeMission();
          } else {
            setMarker(checkpoints[phase].x, checkpoints[phase].z);
            hud.toast(`Checkpoint ${phase} of 3 — ${Math.ceil(timer)}s left`);
          }
        }
      } else if (m.id === 'score') {
        if (phase === 0 && dist < 6) {
          phase = 1;
          standTime = 0;
          hud.toast('Hold the door — 5 seconds…');
          hud.setObjective('Hold at Bay Jewelers for 5 seconds');
        } else if (phase === 1) {
          if (dist < 6) {
            standTime += dt;
            if (standTime >= 5) {
              phase = 2;
              police.setHeat(60);
              save.cash += 200;
              hud.toast('Vault open! Three stars — get to the Safehouse!');
              setMarker(LANDMARKS.safehouse.x, LANDMARKS.safehouse.z);
              hud.setObjective('Escape to the Safehouse');
            }
          } else {
            standTime = Math.max(0, standTime - dt);
          }
        } else if (phase === 2 && dist < 9) {
          completeMission();
        }
      }
    },
  };
  return missions;
}
