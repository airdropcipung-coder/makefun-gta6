// Keyboard and mouse, turned into named actions. The rest of the game never
// reads a key code: it asks whether the player is holding "forward", or
// whether "enter" was just pressed this frame.

// Held movement keys, by the physical key, so WASD and arrows both work.
const MOVE_KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
};

// One-shot keys: pressing once fires the action, holding does not repeat it.
const PRESS_KEYS = {
  confirm: ['Enter'],
  pause: ['Escape', 'KeyP'],
  enter: ['KeyE'],
  punch: ['KeyF'],
  reload: ['KeyR'],
  brake: ['Space'],
  sprint: ['ShiftLeft', 'ShiftRight'],
};

export function createInput() {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  function onKeyDown(e) {
    if (e.repeat) return;
    held.add(e.code);
    pressed.add(e.code);
    // Space scrolls the page; the game owns it while playing.
    if (e.code === 'Space') e.preventDefault();
  }
  function onKeyUp(e) {
    held.delete(e.code);
  }
  function onMouseMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }
  function onMouseDown(e) {
    if (e.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  }
  function onMouseUp(e) {
    if (e.button === 0) mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  // Is any of the named action's keys held right now?
  function isHeld(name) {
    return MOVE_KEYS[name].some((code) => held.has(code));
  }

  // Was any of the named action's keys pressed since the last frame?
  // Edge-triggered actions must call this once a frame; it clears on read.
  function wasPressed(name) {
    const keys = PRESS_KEYS[name] || [];
    return keys.some((code) => pressed.has(code));
  }

  return {
    mouse,
    isHeld,
    wasPressed,
    // -1 (left) .. +1 (right) from the held steering keys.
    steer() {
      let s = 0;
      if (isHeld('left')) s -= 1;
      if (isHeld('right')) s += 1;
      return s;
    },
    // -1 (back) .. +1 (forward) from the held throttle keys.
    throttle() {
      let t = 0;
      if (isHeld('forward')) t += 1;
      if (isHeld('back')) t -= 1;
      return t;
    },
    get sprinting() {
      return PRESS_KEYS.sprint.some((code) => held.has(code));
    },
    get handbrake() {
      return held.has('Space');
    },
    // Call once at the end of each frame: one-shot presses expire.
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
  };
}
