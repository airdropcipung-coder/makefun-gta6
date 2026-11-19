// Staged screenshot scenes behind ?shot=cover|chase|foot|heist (with &seed=1).
// Each one poses the real game — the same player, cars, police and HUD the
// live game uses — then main.js renders two frames and sets __shotReady.

export const SHOT_NAMES = ['cover', 'chase', 'foot', 'heist'];

// Traffic that happens to sit on the staged shot's camera line is removed,
// so the frame shows the staged scene, not a random passer-by.
function clearTrafficNear(G, x, z, r) {
  for (const c of [...G.vehicles.cars]) {
    if (c.mode === 'traffic' && Math.hypot(c.x - x, c.z - z) < r) G.vehicles.removeCar(c);
  }
}

export function stageShot(name, G) {
  const { player, vehicles, police, pedestrians, missions, combat, hud, render } = G;
  police.reset();
  player.group.visible = true;

  if (name === 'cover') {
    // Driving the red sports car down the main avenue, police converging.
    const sport = vehicles.spawnCar('sport', 26, -10, 0, 'parked');
    vehicles.enterCar(sport);
    clearTrafficNear(G, sport.x, sport.z, 32);
    police.setHeat(70); // wanted 3, mid-band so decay never drops a star
    // Converging head-on down the avenue, ahead of the player, frozen in
    // pose so the frame stays composed while the shot is taken.
    for (const [x, z] of [[20, 18], [32, 28], [26, 48]]) {
      const cop = vehicles.spawnCar('police', x, z, Math.PI, 'police');
      cop.staged = true;
      police.copCars.push(cop);
    }
    police.copCars.push(...vehicles.cars.filter((c) => c.mode === 'police'));
    hud.setObjective('Escape the Vipers — lose the cops');
    hud.setMission('The Big Score');
    render.snapCamera(sport.x, sport.z, sport.angle, true);
    return true;
  }

  if (name === 'chase') {
    // A police roadblock across the avenue ahead, wanted 4.
    const sport = vehicles.spawnCar('sport', 26, 4, 0, 'parked');
    vehicles.enterCar(sport);
    clearTrafficNear(G, sport.x, sport.z, 32);
    police.setHeat(90); // wanted 4, mid-band
    // A roadblock ahead and two more cars flanking it, all frozen in pose.
    for (const [x, z, a] of [
      [21, 44, Math.PI / 2],
      [31, 46, -Math.PI / 2],
      [16, 30, Math.PI],
      [36, 32, Math.PI],
    ]) {
      const cop = vehicles.spawnCar('police', x, z, a, 'police');
      cop.staged = true;
      police.copCars.push(cop);
    }
    police.copCars.push(...vehicles.cars.filter((c) => c.mode === 'police'));
    hud.setObjective('Roadblock ahead — break through!');
    hud.setMission('Bank Run');
    render.snapCamera(sport.x, sport.z, sport.angle, true);
    return true;
  }

  if (name === 'foot') {
    // On foot in the plaza: pedestrians, traffic, the market marker.
    // The player stands in the open south of the plaza, clear of the palms.
    player.setPosition(-4, 18);
    player.angle = Math.atan2(4, -18);
    player.group.rotation.y = player.angle;
    for (let i = 0; i < 6; i++) pedestrians.spawn(-14 + i * 5, 2 + (i % 3) * 4);
    missions.stageMarker(0, 0, 'Collect the package at Palmera Market');
    hud.setMission('The Pickup');
    render.snapCamera(player.x, player.z, player.angle, false);
    return true;
  }

  if (name === 'heist') {
    // Outside Bay Jewelers on foot, pistol out, police closing in.
    // The player stands on the street south of the shop, clear of the palms.
    player.setPosition(46, -28);
    player.angle = Math.atan2(6, -12);
    player.group.rotation.y = player.angle;
    combat.givePistol();
    police.setHeat(70); // wanted 3, mid-band
    for (const [x, z, a] of [
      [30, -52, 0.6],
      [64, -58, -0.6],
    ]) {
      const cop = vehicles.spawnCar('police', x, z, a, 'police');
      cop.staged = true;
      police.copCars.push(cop);
    }
    police.placeFootCop(54, -34);
    police.placeFootCop(40, -38);
    missions.stageMarker(52, -40, 'Rob Bay Jewelers — hold the door 5s');
    hud.setMission('The Big Score');
    render.snapCamera(player.x, player.z, player.angle, false);
    return true;
  }

  return false;
}
