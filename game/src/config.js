// Palmera Bay — all tuning numbers live here, in one place. Every other module
// imports from this file, so rebalancing the game means editing numbers here only
// and never hunting through the systems that use them.
export const CITY = {
  half: 400, // playable city spans -400..400 on x and z
  block: 100, // distance between street centrelines
  road: 16, // asphalt width
  sidewalk: 4,
};

export const PLAYER = {
  walkSpeed: 6,
  sprintSpeed: 10.5,
  accel: 40,
  radius: 0.9,
  maxHealth: 100,
  maxArmor: 100,
};

export const CAR = {
  accel: 22,
  brake: 34,
  reverseAccel: 12,
  maxSpeed: 38, // m/s, top speed of the fastest car
  maxReverse: 10,
  turnRate: 1.9, // steering, rad/s at full lock; less at high speed
  grip: 8,
  handbrakeTurn: 3.1,
};

export const TRAFFIC = {
  count: 22,
  speedMin: 9,
  speedMax: 14,
};

export const PEDS = {
  count: 26,
  speedMin: 1.1,
  speedMax: 2.2,
};

export const WANTED = {
  decayDelay: 9, // quiet seconds before the heat starts to fall
  decayStep: 6, // seconds to lose one star once cooling down
  maxStars: 5,
  policeCars: [0, 1, 2, 3, 4, 6], // patrol cars on the road, by star level
  footCops: [0, 1, 1, 2, 3, 4], // officers on foot, by star level
};

export const COMBAT = {
  punchDamage: 12,
  punchRange: 2.2,
  punchCooldown: 0.45,
  pistolDamage: 34,
  pistolRange: 60,
  pistolCooldown: 0.28,
  pistolMag: 12,
};

export const MISSIONS = {
  taxiFare: 60,
  pickupCash: 25,
};

export const SAVE_KEY = 'palmera-bay-save-v1';
export const BEST_KEY = 'palmera-bay-best-v1';
