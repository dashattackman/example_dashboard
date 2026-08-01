// Pure DOM virtual joystick + context buttons (docs/05: UI is vanilla DOM, no framework).
// Left half of the screen: drag anywhere to steer. Right side: 4 context buttons
// (M0: visual placeholders wired to a callback; combat claims them at M3).
// Desktop fallback: WASD/arrows.

export interface InputState {
  /** Normalized move vector, magnitude 0..1. +y = forward (screen-up). */
  x: number;
  y: number;
  buttons: { attack: boolean; power: boolean; dodge: boolean; swap: boolean };
}

export function createTouchControls(root: HTMLElement): InputState {
  const state: InputState = {
    x: 0,
    y: 0,
    buttons: { attack: false, power: false, dodge: false, swap: false },
  };

  // --- joystick (left half) ---
  const stickBase = document.createElement('div');
  const stickNub = document.createElement('div');
  stickBase.style.cssText =
    'position:fixed;width:96px;height:96px;border-radius:50%;display:none;' +
    'border:2px solid rgba(255,255,255,.35);background:rgba(255,255,255,.06);' +
    'pointer-events:none;transform:translate(-50%,-50%)';
  stickNub.style.cssText =
    'position:fixed;width:44px;height:44px;border-radius:50%;display:none;' +
    'background:rgba(255,255,255,.4);pointer-events:none;transform:translate(-50%,-50%)';
  root.append(stickBase, stickNub);

  let stickId: number | null = null;
  let originX = 0;
  let originY = 0;
  const RADIUS = 48;

  const onDown = (e: PointerEvent) => {
    if (e.clientX > window.innerWidth * 0.55 || stickId !== null) return;
    stickId = e.pointerId;
    originX = e.clientX;
    originY = e.clientY;
    for (const el of [stickBase, stickNub]) {
      el.style.display = 'block';
      el.style.left = `${originX}px`;
      el.style.top = `${originY}px`;
    }
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== stickId) return;
    const dx = e.clientX - originX;
    const dy = e.clientY - originY;
    const len = Math.hypot(dx, dy);
    const clamped = Math.min(len, RADIUS);
    const nx = len > 0 ? (dx / len) * clamped : 0;
    const ny = len > 0 ? (dy / len) * clamped : 0;
    stickNub.style.left = `${originX + nx}px`;
    stickNub.style.top = `${originY + ny}px`;
    state.x = nx / RADIUS;
    state.y = -ny / RADIUS; // screen-up = forward
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== stickId) return;
    stickId = null;
    state.x = 0;
    state.y = 0;
    stickBase.style.display = stickNub.style.display = 'none';
  };
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);

  // --- context buttons (right thumb arc, ≥44pt targets per docs/02 §1.2) ---
  const defs: Array<[keyof InputState['buttons'], string, string]> = [
    ['attack', 'A', 'right:118px;bottom:36px'],
    ['power', 'P', 'right:36px;bottom:104px'],
    ['dodge', 'D', 'right:36px;bottom:24px'],
    ['swap', 'S', 'right:118px;bottom:128px'],
  ];
  for (const [key, label, pos] of defs) {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText =
      `position:fixed;${pos};width:64px;height:64px;border-radius:50%;` +
      'border:2px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);' +
      'color:rgba(255,255,255,.75);font:700 18px system-ui;pointer-events:auto;' +
      '-webkit-tap-highlight-color:transparent';
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      state.buttons[key] = true;
    });
    b.addEventListener('pointerup', () => (state.buttons[key] = false));
    b.addEventListener('pointercancel', () => (state.buttons[key] = false));
    root.appendChild(b);
  }

  // --- desktop fallback ---
  const keys = new Set<string>();
  const applyKeys = () => {
    const up = keys.has('KeyW') || keys.has('ArrowUp');
    const down = keys.has('KeyS') || keys.has('ArrowDown');
    const left = keys.has('KeyA') || keys.has('ArrowLeft');
    const right = keys.has('KeyD') || keys.has('ArrowRight');
    if (up || down || left || right) {
      state.x = (right ? 1 : 0) - (left ? 1 : 0);
      state.y = (up ? 1 : 0) - (down ? 1 : 0);
      const len = Math.hypot(state.x, state.y) || 1;
      state.x /= len;
      state.y /= len;
    } else if (stickId === null) {
      state.x = 0;
      state.y = 0;
    }
  };
  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
    applyKeys();
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    applyKeys();
  });

  return state;
}
