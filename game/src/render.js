// Camera and effects: a third-person chase camera that sits behind the player (or
// the car), smooths into place, and looks a little ahead of the motion; plus a small
// particle pool for skid smoke, impacts and muzzle sparks, all drawn as one
// THREE.Points cloud.
import * as THREE from 'three';

export function createCameraRig(camera) {
  let camAngle = 0;
  let camPos = new THREE.Vector3(0, 8, -14);

  function update(dt, target, speed) {
    // The camera trails the player's facing, not the mouse: driving stays readable.
    const wantAngle = target.angle;
    let diff = wantAngle - camAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    camAngle += diff * Math.min(1, 3.2 * dt);
    const inCar = target.inCar;
    const dist = inCar ? 12 : 8;
    const height = inCar ? 7.5 : 5;
    const lookAhead = inCar ? 10 : 5;
    const want = new THREE.Vector3(
      target.x - Math.sin(camAngle) * dist,
      height,
      target.z - Math.cos(camAngle) * dist,
    );
    camPos.lerp(want, Math.min(1, 6 * dt));
    camera.position.copy(camPos);
    camera.lookAt(
      target.x + Math.sin(target.angle) * lookAhead,
      1.6,
      target.z + Math.cos(target.angle) * lookAhead,
    );
  }

  function snap(target) {
    camAngle = target.angle;
    const inCar = target.inCar;
    const dist = inCar ? 12 : 8;
    const height = inCar ? 7.5 : 5;
    camPos.set(
      target.x - Math.sin(camAngle) * dist,
      height,
      target.z - Math.cos(camAngle) * dist,
    );
    camera.position.copy(camPos);
    camera.lookAt(target.x, 1.6, target.z);
  }

  return { update, snap, get angle() { return camAngle; } };
}

export function createParticles(scene, max = 400) {
  const positions = new Float32Array(max * 3);
  const colours = new Float32Array(max * 3);
  for (let i = 0; i < max; i++) positions[i * 3 + 1] = -100;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ size: 0.7, vertexColors: true, transparent: true, opacity: 0.9 }),
  );
  points.frustumCulled = false;
  scene.add(points);
  const pool = [];
  for (let i = 0; i < max; i++) pool.push({ life: 0, vx: 0, vy: 0, vz: 0, i });

  function spawn(x, y, z, colour, count, speed, life, up = 0) {
    let made = 0;
    for (const p of pool) {
      if (made >= count) break;
      if (p.life > 0) continue;
      p.life = life * (0.6 + Math.random() * 0.8);
      p.vx = (Math.random() - 0.5) * speed;
      p.vy = up + Math.random() * speed * 0.5;
      p.vz = (Math.random() - 0.5) * speed;
      positions[p.i * 3] = x;
      positions[p.i * 3 + 1] = y;
      positions[p.i * 3 + 2] = z;
      const c = new THREE.Color(colour);
      colours[p.i * 3] = c.r;
      colours[p.i * 3 + 1] = c.g;
      colours[p.i * 3 + 2] = c.b;
      made += 1;
    }
  }

  function update(dt) {
    for (const p of pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      positions[p.i * 3] += p.vx * dt;
      positions[p.i * 3 + 1] += p.vy * dt;
      positions[p.i * 3 + 2] += p.vz * dt;
      if (p.life <= 0) positions[p.i * 3 + 1] = -100;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  return { spawn, update };
}
