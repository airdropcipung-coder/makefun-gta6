// The city of Palmera Bay: a street grid with lit-window towers, palm-lined
// avenues, a beach and an ocean to the east, all under a low golden-hour sun.
// One seeded pass builds it; the same seed builds the same city.

import * as THREE from 'three';
import { CFG, LANDMARKS } from './config.js';

// The street centrelines, in metres from the city centre.
export const STREETS = [-130, -78, -26, 26, 78, 130];
// The block centres between the streets.
const BLOCKS = [-104, -52, 0, 52, 104];

// A canvas texture of a tower facade: dark concrete with lit windows.
function facadeTexture(rng, hue) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = hue;
  g.fillRect(0, 0, 128, 256);
  for (let y = 10; y < 246; y += 18) {
    for (let x = 10; x < 118; x += 18) {
      const lit = rng.chance(0.45);
      g.fillStyle = lit ? (rng.chance(0.7) ? '#ffd98a' : '#9fd8ff') : '#1a2230';
      g.fillRect(x, y, 11, 12);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function box(w, h, d, color, x, y, z, opts) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0.05,
    ...(opts || {}),
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildWorld(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  // Sky, fog and the low sun.
  scene.background = new THREE.Color(CFG.sky);
  scene.fog = new THREE.Fog(CFG.fog, 130, 460);
  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x5a4632, 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(CFG.sun, 2.6);
  sun.position.set(-180, 110, 80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -220;
  sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220;
  sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 600;
  scene.add(sun);

  // Ground: dirt lots under the city, sand on the beach, water past it.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700),
    new THREE.MeshStandardMaterial({ color: 0x6b5b45, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(60, -0.05, 0);
  ground.receiveShadow = true;
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 420),
    new THREE.MeshStandardMaterial({ color: CFG.sand, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(CFG.beachX + 12, 0, 0);
  sand.receiveShadow = true;
  group.add(sand);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 460),
    new THREE.MeshStandardMaterial({ color: CFG.ocean, roughness: 0.25, metalness: 0.4 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(CFG.oceanX + 150, -0.3, 0);
  group.add(ocean);

  // Streets: asphalt strips both ways, with a dashed centre line.
  const roadMat = new THREE.MeshStandardMaterial({ color: CFG.asphalt, roughness: 0.95 });
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c0, roughness: 0.8 });
  const walkMat = new THREE.MeshStandardMaterial({ color: CFG.sidewalk, roughness: 1 });
  for (const s of STREETS) {
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(330, CFG.road), roadMat);
      road.rotation.x = -Math.PI / 2;
      if (!horizontal) road.rotation.z = Math.PI / 2;
      road.position.set(horizontal ? 0 : s, 0.01, horizontal ? s : 0);
      road.receiveShadow = true;
      group.add(road);
      // Sidewalks on both edges of the street.
      for (const off of [-8, 8]) {
        const walk = new THREE.Mesh(new THREE.PlaneGeometry(330, 4), walkMat);
        walk.rotation.x = -Math.PI / 2;
        if (!horizontal) walk.rotation.z = Math.PI / 2;
        walk.position.set(horizontal ? 0 : s + off, 0.02, horizontal ? s + off : 0);
        group.add(walk);
      }
      // Centre dashes.
      for (let d = -150; d <= 150; d += 12) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.5), dashMat);
        dash.rotation.x = -Math.PI / 2;
        if (!horizontal) dash.rotation.z = Math.PI / 2;
        dash.position.set(horizontal ? d : s, 0.03, horizontal ? s : d);
        group.add(dash);
      }
    }
  }

  // Buildings, one per block, with lit windows. The market block stays open.
  const facades = [
    facadeTexture(rng, '#3a4152'),
    facadeTexture(rng, '#4a3a3a'),
    facadeTexture(rng, '#2f3d4a'),
    facadeTexture(rng, '#54452f'),
  ];
  const landmarkBlock = (bx, bz) => {
    if (bx === -104 && bz === -104) return 'garage';
    if (bx === 52 && bz === 104) return 'hotel';
    if (bx === 52 && bz === -52) return 'jewelers';
    if (bx === -104 && bz === 104) return 'safehouse';
    return null;
  };
  for (const bx of BLOCKS) {
    for (const bz of BLOCKS) {
      if (bx === 0 && bz === 0) continue; // Palmera Market plaza
      const kind = landmarkBlock(bx, bz);
      let w = rng.range(24, 34);
      let d = rng.range(24, 34);
      let h = rng.range(9, 38);
      let color = 0x9a938a;
      let tex = rng.pick(facades);
      if (kind === 'hotel') {
        h = 64;
        w = 30;
        d = 30;
        tex = facadeTexture(rng, '#274b63');
      } else if (kind === 'garage') {
        h = 9;
        w = 36;
        d = 26;
        tex = null;
        color = 0xb0503c;
      } else if (kind === 'jewelers') {
        h = 11;
        w = 22;
        d = 20;
        tex = null;
        color = 0xc9a227;
      } else if (kind === 'safehouse') {
        h = 8;
        w = 18;
        d = 16;
        tex = null;
        color = 0x7a6a9a;
      }
      const mesh = box(w, h, d, color, bx, h / 2, bz, tex ? { map: tex } : {});
      group.add(mesh);
      colliders.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2 });
      // A flat roof cap so towers read at a glance.
      const cap = box(w + 1, 0.8, d + 1, 0x2c2f36, bx, h + 0.4, bz);
      group.add(cap);
    }
  }

  // Market stalls and a fountain on the open plaza.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const sx = Math.cos(a) * 14;
    const sz = Math.sin(a) * 14;
    const stall = box(5, 3, 4, i % 2 ? 0xe06a3a : 0x3a8e6a, sx, 1.5, sz);
    group.add(stall);
    const roof = box(6, 0.4, 5, 0xf2e6c8, sx, 3.4, sz);
    group.add(roof);
    colliders.push({ minX: sx - 2.5, maxX: sx + 2.5, minZ: sz - 2, maxZ: sz + 2 });
  }
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(5, 5.5, 1.2, 20),
    new THREE.MeshStandardMaterial({ color: 0x8fa8b8, roughness: 0.4 }),
  );
  fountain.position.set(0, 0.6, 0);
  group.add(fountain);

  // The docks: a pier into the ocean and stacked containers.
  const pier = box(26, 1.2, 8, 0x6a5a44, 168, 0.6, -52);
  group.add(pier);
  for (let i = 0; i < 4; i++) {
    const cont = box(6, 2.6, 2.6, [0xc23b2e, 0x2e6ac2, 0x3a9e4f, 0xd8a020][i], 158 + i * 3, 1.3, -60 + i * 5);
    group.add(cont);
    colliders.push({ minX: 155 + i * 3, maxX: 161 + i * 3, minZ: -61.3 + i * 5, maxZ: -58.7 + i * 5 });
  }

  // Palms along the avenues.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 1 });
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x2f7a3a, roughness: 0.9 });
  for (const s of STREETS) {
    for (let d = -140; d <= 140; d += 52) {
      if (rng.chance(0.3)) continue;
      const px = s + 10;
      const pz = d + rng.range(-4, 4);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 6, 6), trunkMat);
      trunk.position.set(px, 3, pz);
      trunk.castShadow = true;
      group.add(trunk);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3.2, 7), frondMat);
      crown.position.set(px, 7.2, pz);
      crown.castShadow = true;
      group.add(crown);
    }
  }

  // Lamp posts on the two main avenues.
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.6 });
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc860, emissiveIntensity: 1.4 });
  for (const s of [-26, 26]) {
    for (let d = -130; d <= 130; d += 52) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), lampMat);
      pole.position.set(s + 7, 3, d);
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), bulbMat);
      bulb.position.set(s + 7, 6.1, d);
      group.add(bulb);
    }
  }

  return {
    group,
    colliders,
    landmarks: LANDMARKS,
    // Push a circle (x, z, radius) out of every building it overlaps.
    resolveCircle(x, z, r) {
      let nx = x;
      let nz = z;
      for (const c of colliders) {
        const cx = Math.max(c.minX, Math.min(nx, c.maxX));
        const cz = Math.max(c.minZ, Math.min(nz, c.maxZ));
        const dx = nx - cx;
        const dz = nz - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 > 0.0001) {
            const d = Math.sqrt(d2);
            nx = cx + (dx / d) * r;
            nz = cz + (dz / d) * r;
          } else {
            // Dead centre: shove out along the shorter axis.
            const pushX = Math.min(nx - (c.minX - r), c.maxX + r - nx);
            const pushZ = Math.min(nz - (c.minZ - r), c.maxZ + r - nz);
            if (pushX < pushZ) nx = nx - c.minX < c.maxX - nx ? c.minX - r : c.maxX + r;
            else nz = nz - c.minZ < c.maxZ - nz ? c.minZ - r : c.maxZ + r;
          }
        }
      }
      nx = Math.max(-170, Math.min(430, nx));
      nz = Math.max(-170, Math.min(170, nz));
      return { x: nx, z: nz };
    },
    // Is a point on a street (within the asphalt)?
    onRoad(x, z) {
      for (const s of STREETS) {
        if (Math.abs(x - s) < 7 || Math.abs(z - s) < 7) return true;
      }
      return false;
    },
    // A random point on a random street, for spawning traffic.
    randomStreetPoint() {
      const s = rng.pick(STREETS);
      const along = rng.range(-140, 140);
      return rng.chance(0.5) ? { x: s, z: along, axis: 'z' } : { x: along, z: s, axis: 'x' };
    },
  };
}
