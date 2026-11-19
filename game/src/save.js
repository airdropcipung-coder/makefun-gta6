// Save and best score in localStorage. Nothing else persists: the city,
// the story and the wanted level are rebuilt fresh every run.

import { STORAGE_KEY, BEST_KEY } from './config.js';

// The shape a save always has, so a missing or corrupt save still loads.
export function blankSave() {
  return {
    cash: 50,
    respect: 0,
    mission: 0,
    storyDone: false,
    pickups: [],
    faresDone: 0,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return blankSave();
    const parsed = JSON.parse(raw);
    return { ...blankSave(), ...parsed };
  } catch {
    return blankSave();
  }
}

export function writeSave(save) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // Private mode or a full store: the game plays on without saving.
  }
}

export function loadBest() {
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    const n = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function writeBest(cash) {
  try {
    if (cash > loadBest()) window.localStorage.setItem(BEST_KEY, String(cash));
  } catch {
    // See writeSave.
  }
}
