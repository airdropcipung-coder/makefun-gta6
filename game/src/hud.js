// The HUD: wanted stars, cash and respect, health and armour bars, the
// objective line, toasts, speed and ammo, and a live top-down minimap drawn
// on a 2D canvas. All of it is plain DOM over the 3D view.

import { CFG } from './config.js';

export function createHud(world) {
  const $ = (id) => document.getElementById(id);
  const els = {
    stars: $('stars'),
    cash: $('cash'),
    respect: $('respect'),
    healthFill: $('health-fill'),
    armourFill: $('armour-fill'),
    objective: $('objective'),
    missionName: $('mission-name'),
    toast: $('toast'),
    speed: $('speed'),
    ammo: $('ammo'),
    timer: $('timer'),
    minimap: $('minimap'),
    damage: $('damage'),
  };
  const mapCtx = els.minimap.getContext('2d');
  let toastTimer = null;
  let flash = 0;

  function drawMinimap(state) {
    const c = mapCtx;
    const S = 180;
    const scale = S / 360; // world -180..180 maps to the canvas
    const toMap = (x, z) => [90 + x * scale, 90 + z * scale];
    c.fillStyle = '#101826';
    c.fillRect(0, 0, S, S);
    // Ocean and beach on the east edge.
    c.fillStyle = '#1d6f8e';
    c.fillRect(90 + 178 * scale, 0, S, S);
    c.fillStyle = '#e8cf9a';
    c.fillRect(90 + 156 * scale, 0, 22 * scale + 2, S);
    // Roads.
    c.strokeStyle = '#3a4152';
    c.lineWidth = 12 * scale;
    for (const s of [-130, -78, -26, 26, 78, 130]) {
      c.beginPath();
      c.moveTo(...toMap(s, -160));
      c.lineTo(...toMap(s, 160));
      c.stroke();
      c.beginPath();
      c.moveTo(...toMap(-160, s));
      c.lineTo(...toMap(160, s));
      c.stroke();
    }
    // Buildings.
    c.fillStyle = '#5a6274';
    for (const b of world.colliders) {
      const [x, z] = toMap(b.minX, b.minZ);
      c.fillRect(x, z, (b.maxX - b.minX) * scale, (b.maxZ - b.minZ) * scale);
    }
    // Mission marker.
    if (state.marker) {
      const [x, z] = toMap(state.marker.x, state.marker.z);
      c.fillStyle = '#ffd24a';
      c.beginPath();
      c.arc(x, z, 5, 0, Math.PI * 2);
      c.fill();
    }
    // Traffic as grey dots, police as red dots.
    c.fillStyle = '#9aa5b8';
    for (const car of state.cars) {
      const [x, z] = toMap(car.x, car.z);
      c.fillRect(x - 1.5, z - 1.5, 3, 3);
    }
    c.fillStyle = '#ff4444';
    for (const car of state.policeCars) {
      const [x, z] = toMap(car.x, car.z);
      c.fillRect(x - 2, z - 2, 4, 4);
    }
    // The player: a white arrow that turns with him.
    const [px, pz] = toMap(state.playerX, state.playerZ);
    c.save();
    c.translate(px, pz);
    c.rotate(state.playerAngle);
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(0, -6);
    c.lineTo(4, 5);
    c.lineTo(-4, 5);
    c.closePath();
    c.fill();
    c.restore();
  }

  return {
    setObjective(text) {
      els.objective.textContent = text;
    },
    setMission(name) {
      els.missionName.textContent = name;
    },
    toast(msg) {
      els.toast.textContent = msg;
      els.toast.style.opacity = '1';
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        els.toast.style.opacity = '0';
      }, 3400);
    },
    flashDamage() {
      flash = 1;
    },

    update(state, dt) {
      // Wanted stars: filled ★ up to the level, empty ☆ after.
      let stars = '';
      for (let i = 0; i < CFG.maxWanted; i++) stars += i < state.wanted ? '★' : '☆';
      els.stars.textContent = stars;
      els.stars.style.color = state.wanted > 0 ? '#ffd24a' : '#5a6274';
      els.cash.textContent = `$${state.cash}`;
      els.respect.textContent = `Respect ${state.respect}`;
      els.healthFill.style.width = `${Math.max(0, state.health)}%`;
      els.armourFill.style.width = `${Math.max(0, state.armour)}%`;
      els.speed.textContent = state.inCar ? `${Math.round(Math.abs(state.speed) * 2.24)} mph` : '';
      els.ammo.textContent = state.hasPistol
        ? state.reloading
          ? 'Reloading…'
          : `Pistol ${state.ammo}/${CFG.magSize}`
        : state.inCar
          ? ''
          : 'F — punch';
      els.timer.textContent = state.timer > 0 ? `${Math.ceil(state.timer)}s` : '';
      if (flash > 0) {
        flash = Math.max(0, flash - dt * 2);
        els.damage.style.opacity = String(flash * 0.55);
      }
      drawMinimap(state);
    },
  };
}
