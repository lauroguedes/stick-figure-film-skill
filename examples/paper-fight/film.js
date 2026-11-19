// PAPER FIGHT — the film timeline. renderFrame(ctx, T) draws the frame for film time T (s).
// Pure function of T: any frame can be rendered on its own, in Node or in a browser canvas.

import { WIDTH, HEIGHT } from './engine/scene.js';
import { EASE, clamp, lerp } from './engine/util.js';
import { hatch, stroke, BLACK, WHITE } from './engine/ink.js';
import s1 from './scenes/s1_first_clash.js';
import s2 from './scenes/s2_pencil_city.js';
import s3 from './scenes/s3_geometry_zone.js';
import s3b from './scenes/s3b_ink_shots.js';
import s4 from './scenes/s4_torn_paper.js';
import s5 from './scenes/s5_ink_arena.js';
import s6 from './scenes/s6_last_line.js';
import { makeCredits } from './credits.js';

export { WIDTH, HEIGHT };
export const FPS = 30;

// in: how the scene arrives — 'cut' or 'pageturn' (the previous page flips away over `dur` seconds)
const ORDER = [
  { scene: s1, in: 'cut' },
  { scene: s2, in: 'pageturn', dur: 0.5 },
  { scene: s3, in: 'pageturn', dur: 0.5 },
  { scene: s3b, in: 'pageturn', dur: 0.5 },
  { scene: s4, in: 'pageturn', dur: 0.5 },
  { scene: s5, in: 'pageturn', dur: 0.5 },
  { scene: s6, in: 'cut' },
];

// Offscreen canvases (for transitions and the credits). Node tools install @napi-rs/canvas here.
let makeCanvas = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
};
export const setCanvasFactory = (fn) => { makeCanvas = fn; };

ORDER.push({ scene: makeCredits(ORDER.map((e) => e.scene), (w, h) => makeCanvas(w, h)), in: 'cut' });

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
  const xb = lerp(W + 260, -620, e);      // fold line at the bottom edge…
  const xt = xb + 380;                    // …and at the top (the corner lifts first)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // what is left of the old page
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(xt, 0); ctx.lineTo(xb, H); ctx.lineTo(0, H);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(old, 0, 0);
  ctx.restore();
  // shadow the lifted sheet throws on the new page
  hatch(ctx, [[xt, 0], [xt + 70, 0], [xb + 70, H], [xb, H]], { angle: 62, gap: 7, gapEnd: 16, w: 2, seed: 4, cross: true });
  // the curled underside of the sheet
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
