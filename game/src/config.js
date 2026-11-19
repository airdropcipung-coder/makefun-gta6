// Palmera Bay — every tuning number lives here, so the whole game can be
// rebalanced from this one file. Distances are metres, speeds metres/second,
// times seconds. The city is a street grid; the beach and ocean sit east of it.

export const CFG = {
  // City layout
  block: 40, // side of one city block
  road: 12, // width of one street
  grid: 6, // blocks across (and down)
  beachX: 156, // sand starts here
  oceanX: 178, // water starts here
  cityHalf: 156, // half the built-up span

  // Player on foot
  walkSpeed: 5.2,
  sprintSpeed: 9.0,
  playerRadius: 0.55,
  playerHealth: 100,
  playerArmour: 50,
  punchDamage: 12,
  punchRange: 1.9,
  punchCooldown: 0.45,

  // Pistol
  pistolDamage: 34,
  pistolRange: 90,
  magSize: 12,
  reloadTime: 1.4,
  fireCooldown: 0.22,

  // Cars
  carAccel: 16,
  carBrake: 26,
  carReverse: 9,
  carMaxSpeed: 34,
  sportMaxSpeed: 44,
  taxiMaxSpeed: 30,
  carTurn: 1.9,
  handbrakeTurn: 3.1,
  carDrag: 0.6,
  trafficSpeed: 9,
  trafficCount: 14,
  trafficStopGap: 11,

  // Pedestrians
  pedCount: 22,
  pedSpeed: 1.6,
  pedFleeSpeed: 4.2,

  // Police
  maxWanted: 5,
  heatPerStar: 20,
  heatDecayCalm: 2.2,
  heatDecayHot: 0.6,
  calmSeconds: 8,
  copCarSpeed: 36,
  copCarCount: 6,
  copFootSpeed: 5.6,
  copFootCount: 4,
  bustRange: 2.2,
  bustHold: 1.6,
  bustFine: 100,

  // Camera
  camDistance: 9.5,
  camHeight: 4.2,
  camCarDistance: 12,
  camCarHeight: 5,
  camSmooth: 6,

  // Loop
  step: 1 / 60,
  maxFrame: 0.25,

  // Money
  startCash: 50,
  farePay: [40, 60, 80],
  pickupPay: 25,
  pickupCount: 10,
  missionPay: [150, 250, 300, 400, 1000],

  // Colours (golden hour)
  sky: 0xffb36b,
  fog: 0xf7a55c,
  sun: 0xffd9a0,
  ocean: 0x1d6f8e,
  sand: 0xe8cf9a,
  asphalt: 0x2c2f36,
  sidewalk: 0x8d8578,
};

// Where the story happens. Each landmark is a named point on the map.
export const LANDMARKS = {
  garage: { x: -104, z: -84, name: 'Rosa Garage' },
  hotel: { x: 52, z: 84, name: 'Bay Hotel' },
  docks: { x: 150, z: -52, name: 'The Docks' },
  market: { x: 0, z: 0, name: 'Palmera Market' },
  jewelers: { x: 52, z: -40, name: 'Bay Jewelers' },
  safehouse: { x: -104, z: 90, name: 'Safehouse' },
  plaza: { x: -26, z: 26, name: 'Sunset Plaza' },
};

// The story chain. Each mission names its goal in plain words; the code in
// missions.js turns each one into markers, timers and rewards.
export const MISSIONS = [
  {
    id: 'fare',
    name: 'First Fare',
    brief: 'Mama Rosa needs a driver. Take the taxi to the Bay Hotel.',
    objective: 'Drive the taxi to the Bay Hotel',
    pay: 150,
  },
  {
    id: 'wheels',
    name: 'Hot Wheels',
    brief: 'The Vipers left a red sports car at the docks. Take it. Bring it home.',
    objective: 'Steal the red sports car, deliver it to Rosa Garage',
    pay: 250,
  },
  {
    id: 'pickup',
    name: 'The Pickup',
    brief: 'A package waits at Palmera Market. Collect it on foot — and run.',
    objective: 'Collect the package at the market, then reach the Safehouse',
    pay: 300,
  },
  {
    id: 'bank',
    name: 'Bank Run',
    brief: 'Three drops, one hundred and fifty seconds, two stars on your tail.',
    objective: 'Hit all 3 checkpoints in 150 seconds',
    pay: 400,
  },
  {
    id: 'score',
    name: 'The Big Score',
    brief: 'Bay Jewelers. Stand at the door for five seconds, then vanish.',
    objective: 'Rob Bay Jewelers, then escape to the Safehouse',
    pay: 1000,
  },
];

export const STORAGE_KEY = 'palmera-bay-save-v1';
export const BEST_KEY = 'palmera-bay-best-v1';
