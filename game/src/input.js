// Keyboard and mouse, sampled once a frame. The game talks in named actions, not
// key codes, so a rebind is one entry in the map below. Controls: WASD/arrows to
// move and drive, E to enter/exit a car, F to punch, mouse click to fire the pistol
// once armed, Shift to sprint, Space for the handbrake, Esc to pause, Enter to
// confirm, M to mute.
export const ACTION_UP = 'up';
export const ACTION_DOWN = 'down';
export const ACTION_LEFT = 'left';
export const ACTION_RIGHT = 'right';
export const ACTION_ENTER = 'enter';
export const ACTION_PUNCH = 'punch';
export const ACTION_FIRE = 'fire';
export const ACTION_SPRINT = 'sprint';
export const ACTION_HANDBRAKE = 'handbrake';
export const ACTION_PAUSE = 'pause';
export const ACTION_CONFIRM = 'confirm';
export const ACTION_MUTE = 'mute';

const KEY_MAP = {
  KeyW: ACTION_UP,
  ArrowUp: ACTION_UP,
  KeyS: ACTION_DOWN,
  ArrowDown: ACTION_DOWN,
  KeyA: ACTION_LEFT,
  ArrowLeft: ACTION_LEFT,
  KeyD: ACTION_RIGHT,
  ArrowRight: ACTION_RIGHT,
  KeyE: ACTION_ENTER,
  KeyF: ACTION_PUNCH,
  ShiftLeft: ACTION_SPRINT,
  ShiftRight: ACTION_SPRINT,
  Space: ACTION_HANDBRAKE,
  Escape: ACTION_PAUSE,
  KeyP: ACTION_PAUSE,
  Enter: ACTION_CONFIRM,
  KeyM: ACTION_MUTE,
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let mouseDown = false;
  let mousePressed = false;

  function onKeyDown(e) {
    const action = KEY_MAP[e.code];
    if (!action) return;
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!held.has(action)) pressed.add(action);
    held.add(action);
  }
  function onKeyUp(e) {
    const action = KEY_MAP[e.code];
    if (action) held.delete(action);
  }
  function onMouseDown(e) {
    if (e.button === 0) {
      mouseDown = true;
      mousePressed = true;
    }
  }
  function onMouseUp(e) {
    if (e.button === 0) mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    held(action) {
      return held.has(action) || (action === ACTION_FIRE && mouseDown);
    },
    pressed(action) {
      return pressed.has(action) || (action === ACTION_FIRE && mousePressed);
    },
    // Steering / throttle axes, -1..1, shared by driving and walking.
    axis() {
      const x = (held.has(ACTION_RIGHT) ? 1 : 0) - (held.has(ACTION_LEFT) ? 1 : 0);
      const y = (held.has(ACTION_UP) ? 1 : 0) - (held.has(ACTION_DOWN) ? 1 : 0);
      return { x, y };
    },
    // Call once at the end of each frame: a press only counts on the frame it happens.
    endFrame() {
      pressed.clear();
      mousePressed = false;
    },
  };
}
