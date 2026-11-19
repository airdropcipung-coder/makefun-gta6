// The city of Palmera Bay: a sun-soaked coastal grid, built once from a seed.
// Streets run every 100 m; each block holds one to four buildings, palms line the
// avenues, and the south edge is a beach with the ocean beyond it. Everything here
// is original art made from boxes, canvas textures and light — no asset from any
// other game.
import * as THREE from 'three';
import { CITY } from './config.js';

// Sun-bleached pastel facades: cream, terracotta, aqua, coral, sand.
const FACADE = [0xf2e3c6, 0xe8a87c, 0x7fc8bc, 0xe07856, 0xd9c9a3, 0x9db8c9, 0xf0c987, 0xc98a7a];

function makeFacadeTexture(rng, base, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = `#${base.toString(16).padStart(6, '0')}`;
  g.fillRect(0, 0, 128, 256);
  // Window grid: most dark, a few lit gold for the sunset hour.
  for (let y = 14; y < 244; y += 26) {
    for (let x = 12; x < 116; x += 24) {
      g.fillStyle = rng.chance(0.28) ? '#ffd98a' : '#2c3a4a';
      g.fillRect(x, y, 14, 18);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Repeat the window grid so windows stay square on tall and wide buildings.
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(Math.max(1, Math.round(w / 16)), Math.max(1, Math.round(h / 16)));
  return texture;
}

function makePalm(rng) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6b4a, roughness: 1 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 6, 6), trunkMat);
  trunk.position.y = 3;
  trunk.castShadow = true;
  group.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f8f4f, roughness: 0.9 });
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.7, 3.4, 4), leafMat);
    const angle = (i / 6) * Math.PI * 2 + rng.range(-0.2, 0.2);
    leaf.position.set(Math.cos(angle) * 1.4, 6.2, Math.sin(angle) * 1.4);
    leaf.rotation.z = Math.cos(angle) * 1.1;
    leaf.rotation.x = -Math.sin(angle) * 1.1;
    leaf.castShadow = true;
    group.add(leaf);
  }
  return group;
}

export function createWorld(scene, rng) {
  const { half, block, road } = CITY;
  const colliders = []; // {minX, maxX, minZ, maxZ} building footprints
  const roadLines = []; // street centre lines, for traffic waypoints

  // --- sky, sun, fog: golden hour, warm from the west, long shadows.
  scene.background = new THREE.Color(0xffb36b);
  scene.fog = new THREE.Fog(0xffc98a, 180, 900);
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.6);
  sun.position.set(-220, 140, -120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 700;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x9fc8ff, 0x8a6b4a, 1.15));

  // --- ground: grass-green blocks, asphalt streets, sand beach, ocean.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 400, half * 2 + 400),
    new THREE.MeshStandardMaterial({ color: 0x7fae62, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x565b66, roughness: 0.95 });
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xb8b0a0, roughness: 1 });
  for (let c = -half; c <= half; c += block) {
    for (const [w, h, x, z] of [
      [half * 2, road, 0, c],
      [road, half * 2, c, 0],
    ]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(w, h), roadMat);
      strip.rotation.x = -Math.PI / 2;
      strip.position.set(x, 0.02, z);
      strip.receiveShadow = true;
      scene.add(strip);
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(w + 8, road + 8), sidewalkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(x, 0.01, z);
      walk.receiveShadow = true;
      scene.add(walk);
    }
    roadLines.push({ x: c, z: 0, horizontal: true });
    roadLines.push({ x: 0, z: c, horizontal: false });
  }

  // Beach (south edge) and ocean beyond it.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 400, 90),
    new THREE.MeshStandardMaterial({ color: 0xe8d29a, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.03, half + 45);
  sand.receiveShadow = true;
  scene.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 400, 400),
    new THREE.MeshStandardMaterial({ color: 0x2a7f9e, roughness: 0.25, metalness: 0.1 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.01, half + 290);
  scene.add(ocean);

  // --- buildings: one to four per block, heights 12–60, taller downtown.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let bx = -half + block / 2; bx < half; bx += block) {
    for (let bz = -half + block / 2; bz < half - block / 2; bz += block) {
      const downtown = Math.abs(bx) < 150 && Math.abs(bz) < 150;
      const count = downtown ? rng.int(2) + 1 : rng.int(3) + 1;
      const slots = [
        [-20, -20, 34, 34],
        [20, -20, 34, 34],
        [-20, 20, 34, 34],
        [20, 20, 34, 34],
      ];
      for (let i = 0; i < count; i++) {
        const [ox, oz, w, d] = slots[(i + rng.int(4)) % 4];
        const height = downtown ? rng.range(28, 62) : rng.range(10, 30);
        const colour = rng.pick(FACADE);
        const mat = new THREE.MeshStandardMaterial({
          map: makeFacadeTexture(rng, colour, w, height),
          roughness: 0.85,
        });
        const building = new THREE.Mesh(boxGeo, mat);
        building.scale.set(w, height, d);
        building.position.set(bx + ox, height / 2, bz + oz);
        building.castShadow = true;
        building.receiveShadow = true;
        scene.add(building);
        // Flat roof cap, slightly darker.
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(w + 1, 1, d + 1),
          new THREE.MeshStandardMaterial({ color: 0x5a5148, roughness: 1 }),
        );
        roof.position.set(bx + ox, height + 0.5, bz + oz);
        scene.add(roof);
        colliders.push({
          minX: bx + ox - w / 2 - 0.5,
          maxX: bx + ox + w / 2 + 0.5,
          minZ: bz + oz - d / 2 - 0.5,
          maxZ: bz + oz + d / 2 + 0.5,
        });
      }
    }
  }

  // --- palms along the avenues, lamps at corners.
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 });
  const lampGlow = new THREE.MeshStandardMaterial({
    color: 0xffe9a8,
    emissive: 0xffc860,
    emissiveIntensity: 1.4,
  });
  for (let c = -half; c <= half; c += block) {
    for (let t = -half + 40; t <= half - 40; t += 80) {
      if (rng.chance(0.6)) {
        const palm = makePalm(rng);
        palm.position.set(c + road / 2 + 5, 0, t);
        scene.add(palm);
      }
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 6), lampMat);
      pole.position.set(c - road / 2 - 3, 3.5, t + 8);
      scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), lampGlow);
      bulb.position.set(c - road / 2 - 3, 7.1, t + 8);
      scene.add(bulb);
    }
  }

  // --- helpers the systems use.
  function onRoad(x, z) {
    const mx = ((x % block) + block) % block;
    const mz = ((z % block) + block) % block;
    return mx < road / 2 + 2 || mx > block - road / 2 - 2 || mz < road / 2 + 2 || mz > block - road / 2 - 2;
  }

  function collideCircle(x, z, radius) {
    for (const c of colliders) {
      if (x + radius > c.minX && x - radius < c.maxX && z + radius > c.minZ && z - radius < c.maxZ) {
        const pushLeft = x + radius - c.minX;
        const pushRight = c.maxX - (x - radius);
        const pushUp = z + radius - c.minZ;
        const pushDown = c.maxZ - (z - radius);
        const min = Math.min(pushLeft, pushRight, pushUp, pushDown);
        if (min === pushLeft) x = c.minX - radius;
        else if (min === pushRight) x = c.maxX + radius;
        else if (min === pushUp) z = c.minZ - radius;
        else z = c.maxZ + radius;
        return { x, z, hit: true };
      }
    }
    return { x, z, hit: false };
  }

  function randomRoadPoint() {
    const street = rng.int(9) - 4; // -4..4
    const along = rng.range(-half + 20, half - 20);
    if (rng.chance(0.5)) return { x: along, z: street * block };
    return { x: street * block, z: along };
  }

  function randomSidewalkPoint() {
    const p = randomRoadPoint();
    return { x: p.x + rng.range(-14, 14), z: p.z + rng.range(-14, 14) };
  }

  return {
    colliders,
    roadLines,
    onRoad,
    collideCircle,
    randomRoadPoint,
    randomSidewalkPoint,
    clampToCity(x, z) {
      return {
        x: THREE.MathUtils.clamp(x, -half + 8, half - 8),
        z: THREE.MathUtils.clamp(z, -half + 8, half + 60),
      };
    },
  };
}
