// The chase camera and the particle pool. The camera rides behind the player
// or his car, smoothed so turns feel weighty; particles are one Points cloud
// whose slots are recycled for sparks, smoke and dust.

import * as THREE from 'three';
import { CFG } from './config.js';

const MAX_PARTICLES = 240;

export function createRender(scene, camera) {
  // One Points cloud, 240 slots, each with a velocity and a life.
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const colors = new Float32Array(MAX_PARTICLES * 3);
  const vels = new Float32Array(MAX_PARTICLES * 3);
  const life = new Float32Array(MAX_PARTICLES);
  for (let i = 0; i < MAX_PARTICLES; i++) positions[i * 3 + 1] = -100;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  let cursor = 0;

  const camPos = new THREE.Vector3(0, 20, 30);
  const lookAt = new THREE.Vector3();

  return {
    // Burst of coloured sparks at a point.
    spawnBurst(pos, color, count, speed) {
      const c = new THREE.Color(color);
      for (let n = 0; n < count; n++) {
        const i = cursor;
        cursor = (cursor + 1) % MAX_PARTICLES;
        positions[i * 3] = pos.x;
        positions[i * 3 + 1] = pos.y;
        positions[i * 3 + 2] = pos.z;
        const a = Math.random() * Math.PI * 2;
        const up = Math.random() * 0.9 + 0.3;
        const s = (speed || 5) * (0.5 + Math.random() * 0.8);
        vels[i * 3] = Math.cos(a) * s;
        vels[i * 3 + 1] = up * s;
        vels[i * 3 + 2] = Math.sin(a) * s;
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
        life[i] = 0.5 + Math.random() * 0.4;
      }
      geo.attributes.color.needsUpdate = true;
    },

    // Third-person chase: behind the target's facing, above it, smoothed.
    updateCamera(dt, tx, tz, angle, inCar) {
      const dist = inCar ? CFG.camCarDistance : CFG.camDistance;
      const height = inCar ? CFG.camCarHeight : CFG.camHeight;
      const fx = Math.sin(angle);
      const fz = Math.cos(angle);
      const wantX = tx - fx * dist;
      const wantZ = tz - fz * dist;
      const k = Math.min(1, CFG.camSmooth * dt);
      camPos.x += (wantX - camPos.x) * k;
      camPos.y += (height - camPos.y) * k;
      camPos.z += (wantZ - camPos.z) * k;
      camera.position.copy(camPos);
      lookAt.set(tx + fx * 4, 1.6, tz + fz * 4);
      camera.lookAt(lookAt);
    },

    // Snap the camera behind a target at once (scene staging).
    snapCamera(tx, tz, angle, inCar) {
      const dist = inCar ? CFG.camCarDistance : CFG.camDistance;
      const height = inCar ? CFG.camCarHeight : CFG.camHeight;
      camPos.set(tx - Math.sin(angle) * dist, height, tz - Math.cos(angle) * dist);
      camera.position.copy(camPos);
      lookAt.set(tx + Math.sin(angle) * 4, 1.6, tz + Math.cos(angle) * 4);
      camera.lookAt(lookAt);
    },

    update(dt) {
      for (let i = 0; i < MAX_PARTICLES; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        if (life[i] <= 0) {
          positions[i * 3 + 1] = -100;
          continue;
        }
        vels[i * 3 + 1] -= 9 * dt;
        positions[i * 3] += vels[i * 3] * dt;
        positions[i * 3 + 1] += vels[i * 3 + 1] * dt;
        positions[i * 3 + 2] += vels[i * 3 + 2] * dt;
        if (positions[i * 3 + 1] < 0.05) positions[i * 3 + 1] = 0.05;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
