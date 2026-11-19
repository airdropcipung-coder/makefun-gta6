// Staged screenshot scenes: ?shot=<name>&seed=1 puts the game in one composed
// moment and paints it twice, then sets window.__shotReady so a screenshot tool
// knows when to shoot. The four shots are the entry's screenshots: cover, chase, on
// foot, and the heist.
//   cover — driving the red sports car down the main avenue at sunset, police behind,
//           wanted 3, minimap and mission objective on the HUD.
//   chase — the same avenue, a police roadblock ahead, wanted 4.
//   foot  — on foot in the plaza, pedestrians and traffic around, mission marker ahead.
//   heist — outside Bay Jewelers on foot with the pistol, police converging, wanted 3.
export function stageShot(name, game) {
  const { player, vehicles, police, peds, world } = game;
  // Reset the street to a known state.
  police.clear();
  for (const car of [...vehicles.cars]) {
    if (car.kind !== 'player') vehicles.removeCar(car);
  }
  vehicles.spawnTraffic(14);
  vehicles.spawnParked(6);

  // Put the police where the camera can see them: ahead of the player, converging on
  // him, so the shot shows the chase, not an empty street. (The chase camera sits
  // behind the player, so police placed behind him would be behind the camera.)
  function placePolice(count) {
    const cars = police.cops.filter((c) => !c.onFoot);
    const baseX = player.inCar ? player.inCar.x : player.x;
    const baseZ = player.inCar ? player.inCar.z : player.z;
    const angle = player.inCar ? player.inCar.angle : player.angle;
    cars.slice(0, count).forEach((cop, i) => {
      const side = i % 2 === 0 ? -6 : 6;
      const ahead = 55 + i * 22;
      cop.x = baseX + Math.sin(angle) * ahead + Math.cos(angle) * side;
      cop.z = baseZ + Math.cos(angle) * ahead - Math.sin(angle) * side;
      cop.angle = angle + Math.PI; // facing the player, closing in
      cop.speed = 22;
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.angle;
    });
  }

  if (name === 'cover' || name === 'chase') {
    const car = game.spawnMissionCar(0xff2222, 0, 120);
    game.enterCar(car, true);
    player.angle = Math.PI; // facing -z, toward downtown and the marker
    car.angle = Math.PI;
    car.speed = 24;
    police.setWanted(name === 'cover' ? 3 : 4);
    placePolice(2);
    game.marker = { x: 0, z: -260, label: 'Rosa Garage' };
    game.setObjective('Deliver the sports car to the Rosa Garage — lose the cops!');
    if (name === 'chase') {
      // A roadblock ahead: two police cars parked across the avenue, 60 m on.
      const block1 = vehicles.addCar(-6, 60, Math.PI / 2, 0x111111, 'police');
      const block2 = vehicles.addCar(6, 60, Math.PI / 2, 0x111111, 'police');
      block1.speed = 0;
      block2.speed = 0;
    }
    return { camera: 'chase' };
  }

  if (name === 'foot') {
    player.x = 0;
    player.z = 40;
    player.angle = Math.PI;
    player.health = 100;
    game.marker = { x: 0, z: -120, label: 'Market — package' };
    game.setObjective('Walk to the market and collect the package.');
    police.setWanted(1);
    placePolice(1);
    return { camera: 'foot' };
  }

  // heist
  player.x = 0;
  player.z = -180;
  player.angle = Math.PI;
  player.health = 82;
  game.combat.givePistol();
  game.marker = { x: -350, z: 350, label: 'Safehouse' };
  game.setObjective('The score is yours. Escape to the safehouse!');
  police.setWanted(3);
  placePolice(2);
  return { camera: 'foot' };
}
