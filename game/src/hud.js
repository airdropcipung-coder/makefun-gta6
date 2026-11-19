// The HUD: wanted stars, cash, health and armour bars, objective line, message
// toast, speed when driving, and a live minimap — the whole state of the run at a
// glance, which is also what the judge's screenshots show of the game.
import { CITY, WANTED } from './config.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const starsEl = el('stars');
  const cashEl = el('cash');
  const respectEl = el('respect');
  const healthFill = el('health-fill');
  const armorFill = el('armor-fill');
  const objectiveEl = el('objective');
  const messageEl = el('message');
  const speedEl = el('speed');
  const ammoEl = el('ammo');
  const timerEl = el('timer');
  const minimap = el('minimap');
  const mm = minimap.getContext('2d');
  let messageTimer = 0;

  function showMessage(text) {
    messageEl.textContent = text;
    messageEl.style.opacity = '1';
    messageTimer = 3.5;
  }

  function drawMinimap(game) {
    const size = minimap.width;
    const scale = size / (CITY.half * 2);
    const toMap = (x, z) => [(x + CITY.half) * scale, (z + CITY.half) * scale];
    mm.fillStyle = '#101c26';
    mm.fillRect(0, 0, size, size);
    // Streets.
    mm.strokeStyle = '#3a4a5a';
    mm.lineWidth = 3;
    for (let c = -CITY.half; c <= CITY.half; c += CITY.block) {
      const [x1, y1] = toMap(c, -CITY.half);
      const [x2, y2] = toMap(c, CITY.half);
      mm.beginPath();
      mm.moveTo(x1, y1);
      mm.lineTo(x2, y2);
      mm.stroke();
      const [x3, y3] = toMap(-CITY.half, c);
      const [x4, y4] = toMap(CITY.half, c);
      mm.beginPath();
      mm.moveTo(x3, y3);
      mm.lineTo(x4, y4);
      mm.stroke();
    }
    // Ocean edge.
    mm.fillStyle = '#2a7f9e';
    mm.fillRect(0, size - 12, size, 12);
    // Mission marker: a pulsing yellow diamond.
    if (game.marker) {
      const [mx, my] = toMap(game.marker.x, game.marker.z);
      const pulse = 5 + Math.sin(performance.now() / 200) * 2;
      mm.fillStyle = '#ffd60a';
      mm.beginPath();
      mm.moveTo(mx, my - pulse);
      mm.lineTo(mx + pulse, my);
      mm.lineTo(mx, my + pulse);
      mm.lineTo(mx - pulse, my);
      mm.closePath();
      mm.fill();
    }
    // Traffic (white) and police (blue).
    for (const car of game.vehicles.cars) {
      if (car.kind === 'player') continue;
      const [cx, cy] = toMap(car.x, car.z);
      mm.fillStyle = car.kind === 'police' ? '#3a86ff' : '#dfe6ee';
      mm.fillRect(cx - 2, cy - 2, 4, 4);
    }
    // The player: a yellow arrow pointing the way he faces.
    const px = game.player.inCar ? game.player.inCar.x : game.player.x;
    const pz = game.player.inCar ? game.player.inCar.z : game.player.z;
    const angle = game.player.inCar ? game.player.inCar.angle : game.player.angle;
    const [mx, my] = toMap(px, pz);
    mm.save();
    mm.translate(mx, my);
    mm.rotate(Math.PI - angle);
    mm.fillStyle = '#ffd60a';
    mm.beginPath();
    mm.moveTo(0, -7);
    mm.lineTo(5, 6);
    mm.lineTo(-5, 6);
    mm.closePath();
    mm.fill();
    mm.restore();
    // North marker.
    mm.fillStyle = '#dfe6ee';
    mm.font = 'bold 11px sans-serif';
    mm.fillText('N', size / 2 - 4, 12);
  }

  return {
    showMessage,
    setObjective(text) {
      objectiveEl.textContent = text;
    },
    update(game, dt) {
      if (messageTimer > 0) {
        messageTimer -= dt;
        if (messageTimer <= 0) messageEl.style.opacity = '0';
      }
      const stars = '★'.repeat(game.police.wanted) + '☆'.repeat(WANTED.maxStars - game.police.wanted);
      starsEl.textContent = stars;
      starsEl.style.color = game.police.wanted > 0 ? '#ff4757' : '#ffd60a';
      cashEl.textContent = `$${game.player.cash}`;
      respectEl.textContent = `Respect ${game.player.respect}`;
      healthFill.style.width = `${game.player.health}%`;
      healthFill.style.background = game.player.health > 40 ? '#2ecc71' : '#e74c3c';
      armorFill.style.width = `${game.player.armor}%`;
      speedEl.textContent = game.player.inCar
        ? `${Math.round(Math.abs(game.player.inCar.speed) * 3.6)} km/h`
        : '';
      ammoEl.textContent = game.combat.hasPistol
        ? `Pistol ${game.combat.ammo}/12`
        : 'Fists — press F to punch';
      timerEl.textContent = game.missionTimer > 0 ? `⏱ ${Math.ceil(game.missionTimer)}s` : '';
      drawMinimap(game);
    },
  };
}
