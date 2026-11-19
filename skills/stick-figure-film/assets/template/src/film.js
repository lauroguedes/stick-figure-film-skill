// The film timeline. renderFrame(ctx, T) draws the frame for film time T (seconds).
// Pure function of T: any frame can be rendered on its own, in Node or in a browser canvas.
//
// Add scenes to ORDER as you write them. `in` is how a scene arrives:
//   'cut'       hard cut
//   'pageturn'  the previous scene's last frame flips away like a notebook page over `dur` seconds

import { WIDTH, HEIGHT } from './engine/scene.js';
import { EASE, clamp, lerp } from './engine/util.js';
import { hatch, stroke, BLACK, WHITE } from './engine/ink.js';
import minimal from './scenes/minimal.js';
// import ref from './scenes/ref_poc.js';   // the full worked fight example (15 s): `--scene ref` works without adding it
// import s2 from './scenes/s2_your_scene.js';
// import { makeCredits } from './credits.js';

export { WIDTH, HEIGHT };
export const FPS = 30;

const ORDER = [
  { scene: minimal, in: 'cut' },   // replace with your own scenes
  // { scene: s2, in: 'pageturn', dur: 0.5 },
];

// Offscreen canvases (for transitions and the credits). Node tools install @napi-rs/canvas here.
let makeCanvas = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};
export const setCanvasFactory = (fn) => { makeCanvas = fn; };

// End credits (optional): edit TITLE and CARDS in src/credits.js, then uncomment.
// ORDER.push({ scene: makeCredits(ORDER.map((e) => e.scene), (w, h) => makeCanvas(w, h)), in: 'cut' });

let clock = 0;
export const TIMELINE = ORDER.map((e) => {
  const entry = { ...e, id: e.scene.id, title: e.scene.title, start: clock, end: clock + e.scene.duration };
  clock = entry.end;
  return entry;
});
export const DURATION = clock;

export const sceneById = (id) => TIMELINE.find((e) => e.id === id)?.scene;

const snaps = new Map();
function lastFrameOf(entry) {
  let c = snaps.get(entry.id);
  if (!c) {
    c = makeCanvas(WIDTH, HEIGHT);
    entry.scene.draw(c.getContext('2d'), entry.scene.duration - 1 / 120);
    snaps.set(entry.id, c);
  }
  return c;
}

/** The outgoing page lifts from the right and flips away to the left, revealing the next page. */
function pageTurn(ctx, old, p) {
  const W = WIDTH, H = HEIGHT;
  const e = EASE.io(clamp(p));
  const xb = lerp(W + 260, -620, e);
  const xt = xb + 380;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(xt, 0); ctx.lineTo(xb, H); ctx.lineTo(0, H);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(old, 0, 0);
  ctx.restore();
  hatch(ctx, [[xt, 0], [xt + 70, 0], [xb + 70, H], [xb, H]], { angle: 62, gap: 7, gapEnd: 16, w: 2, seed: 4, cross: true });
  const wv = 70 + 300 * Math.sin(Math.PI * e);
  const flap = [[xt - wv, 0], [xt, 0], [xb, H], [xb - wv * 1.25, H]];
  ctx.beginPath();
  flap.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
  ctx.closePath();
  ctx.fillStyle = WHITE;
  ctx.fill();
  hatch(ctx, flap, { angle: 104, gap: 22, gapEnd: 6, w: 2, seed: 5 });
  stroke(ctx, [flap[0], flap[3]], 5, BLACK);
  stroke(ctx, [flap[1], flap[2]], 3, BLACK);
}

export function renderFrame(ctx, T, o = {}) {
  if (T >= DURATION) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BLACK;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    return;
  }
  let i = TIMELINE.findIndex((e) => T < e.end);
  if (i < 0) i = TIMELINE.length - 1;
  const entry = TIMELINE[i];
  const t = T - entry.start;
  entry.scene.draw(ctx, t, o);
  if (entry.in === 'pageturn' && i > 0 && t < entry.dur) pageTurn(ctx, lastFrameOf(TIMELINE[i - 1]), t / entry.dur);
}
