// The player on foot: a simple articulated figure (capsule body, head, legs that
// swing as he walks) with camera-relative movement, sprinting, and building
// collision.
import * as THREE from 'three';
import { PLAYER } from './config.js';

export function createPlayer(scene, world) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d64, roughness: 0.8 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0x2ec4b6, roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2b2d42, roughness: 0.9 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 1.1, 10), shirt);
  body.position.y = 1.15;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), skin);
  head.position.y = 1.95;
  head.castShadow = true;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), pants);
  legL.position.set(-0.2, 0.35, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.2;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.65, 0.18), shirt);
  armL.position.set(-0.55, 1.2, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.55;
  group.add(armR);
  scene.add(group);

  const player = {
    mesh: group,
    x: 0,
    z: 8,
    angle: 0, // facing, radians
    speed: 0,
    health: PLAYER.maxHealth,
    armor: 0,
    cash: 0,
    respect: 0,
    inCar: null,
    walkPhase: 0,
    update(dt, input, cameraAngle) {
      if (this.inCar) return;
      const { x, y } = input.axis();
      const sprint = input.held('sprint');
      const targetSpeed = (sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed) * Math.hypot(x, y);
      this.speed = THREE.MathUtils.damp(this.speed, targetSpeed, 10, dt);
      if (Math.hypot(x, y) > 0.1) {
        // Move relative to the camera, so W always walks away from the viewer.
        const moveAngle = cameraAngle + Math.atan2(x, y);
        let diff = moveAngle - this.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.angle += diff * Math.min(1, 12 * dt);
        const nx = this.x + Math.sin(this.angle) * this.speed * dt;
        const nz = this.z + Math.cos(this.angle) * this.speed * dt;
        const hit = world.collideCircle(nx, nz, PLAYER.radius);
        const clamped = world.clampToCity(hit.x, hit.z);
        this.x = clamped.x;
        this.z = clamped.z;
      }
      this.walkPhase += this.speed * dt * 1.6;
      const swing = Math.sin(this.walkPhase) * 0.5 * Math.min(1, this.speed / 4);
      legL.rotation.x = swing;
      legR.rotation.x = -swing;
      armL.rotation.x = -swing * 0.7;
      armR.rotation.x = swing * 0.7;
      group.position.set(this.x, 0, this.z);
      group.rotation.y = this.angle;
    },
    damage(amount) {
      let left = amount;
      if (this.armor > 0) {
        const absorbed = Math.min(this.armor, left * 0.6);
        this.armor -= absorbed;
        left -= absorbed;
      }
      this.health = Math.max(0, this.health - left);
      return this.health <= 0;
    },
    heal(amount) {
      this.health = Math.min(PLAYER.maxHealth, this.health + amount);
    },
  };
  group.position.set(player.x, 0, player.z);
  return player;
}
