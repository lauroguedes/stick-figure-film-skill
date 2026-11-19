// Motion graphics: impact bursts, shock rings, dust, sparks, speed lines, ink splashes,
// paper scraps and slow-motion focus lines. All pure black / pure white.
// World coords are canvas-style (y down, floor at 0); event `h` is height above the floor.
//
// FX event types (scene.fx({...})):
//   dust   { t, x, h?, n, size, dir? }     puffs kicked up from a surface (dir -1/1 = one-sided)
//   burst  { t, x, h, size }               impact star + radiating strokes
//   ring   { t, x, h, size }               flat shock ring on a surface
//   shock  { t, x, h, size }               round shock ring in the air (weapon clashes)
//   sparks { t, x, h, n?, size, dir? }     short flying streaks (metal on metal, stone chips)
//   splash { t, x, h, n, size, dir }       ink droplets (dir 0 = upward fan, -1/1 = sideways)
//   scraps { t, x, h, n }                  fluttering paper scraps
//   muzzle { t, x, h, ang, size }          gun muzzle flash (ang in radians, world y-up)   ┐ normally added
//   tracer { t, x, h, x2, h2 }             bullet streak from → to (2–3 frames)            │ for you by
//   slug   { t, x, h, x2, h2, life }       visible ink slug with shock rings (bullet time) │ S.shot(...)
//   casing { t, x, h, dir }                ejected shell casing                            ┘
// Any event may carry `life` (seconds) to override the default duration.

import { rng, clamp, prog, EASE, TAU, hash, lerp } from './util.js';
import { blob, sketchPoly, BLACK, WHITE } from './ink.js';

const LIFE = { dust: 0.55, burst: 0.17, ring: 0.34, shock: 0.26, sparks: 0.34, splash: 0.6, scraps: 1.3, muzzle: 0.075, tracer: 0.09, slug: 1, casing: 0.6 };

function dust(ctx, e, p, t) {
  const r = rng(Math.round(e.t * 100) + Math.round(e.x));
  const k = EASE.out(p);
  for (let i = 0; i < e.n; i++) {
    const side = e.dir ? e.dir : r() < 0.5 ? -1 : 1;
    const dx = side * (14 + r() * 70) * e.size * k;
    const dy = -(4 + r() * 34) * e.size * k;
    const rad = (7 + r() * 11) * e.size * (0.45 + 0.75 * k) * (p > 0.6 ? 1 - (p - 0.6) / 0.4 : 1);
    const seed = 900 + i * 13 + Math.floor(t * 12);
    if (rad < 1.2) { r(); continue; }
    blob(ctx, e.x + dx, -(e.h || 0) - 6 + dy, rad, rad * 0.86, { w: 1.8, rough: 0.2, seed, fill: WHITE, n: 9, rot: r() * 6 });
  }
}

function burst(ctx, e, p) {
  const r = rng(Math.round(e.t * 100));
  const k = EASE.out(p);
  const cx = e.x, cy = -e.h;
  const n = 13;
  if (p < 0.55) {
    // white star with ink outline
    const pts = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + 0.2;
      const rad = (i % 2 ? 13 : 30 + r() * 12) * e.size * (0.7 + k * 0.6);
      pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
    }
    sketchPoly(ctx, pts, { w: 2.6, seed: 950, fill: WHITE, rough: 0.6 });
  }
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + (r() - 0.5) * 0.3;
    const r1 = (30 + 38 * k) * e.size;
    const r2 = r1 + (20 + 70 * k * (0.5 + r())) * e.size * (1 - p * 0.5);
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
  }
  ctx.lineWidth = Math.max(1.2, 3.6 * (1 - p) * Math.min(1.5, e.size));
  ctx.strokeStyle = BLACK;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function ring(ctx, e, p) {
  const k = EASE.out(p);
  const rx = (36 + 190 * k) * e.size, ry = rx * 0.2;
  const r = rng(Math.round(e.t * 100) + 5);
  ctx.beginPath();
  const segs = 22;
  for (let i = 0; i < segs; i++) {
    if (r() < 0.25 + p * 0.4) continue;
    const a0 = (i / segs) * TAU, a1 = ((i + 0.8) / segs) * TAU;
    ctx.moveTo(e.x + Math.cos(a0) * rx, -e.h + 6 + Math.sin(a0) * ry);
    ctx.ellipse(e.x, -e.h + 6, rx, ry, 0, a0, a1);
  }
  ctx.lineWidth = Math.max(1, 3.4 * (1 - p));
  ctx.strokeStyle = BLACK;
  ctx.stroke();
}

function splash(ctx, e, p) {
  const r = rng(Math.round(e.t * 100) + 9);
  const tau = p * LIFE.splash;
  ctx.fillStyle = BLACK;
  if (p < 0.12) {
    blob(ctx, e.x, -e.h, 20 * e.size, 16 * e.size, { seed: 960, fill: BLACK, rough: 0.35, n: 11, strokeIt: false });
  }
  for (let i = 0; i < e.n; i++) {
    const a = e.dir === 0 ? -Math.PI * (0.1 + r() * 0.8) : -Math.PI / 2 + e.dir * (0.2 + r() * 1.2);
    const v = (260 + r() * 620) * e.size;
    const x = e.x + Math.cos(a) * v * tau;
    const y = -e.h + Math.sin(a) * v * tau + 0.5 * 2600 * tau * tau;
    const rad = (2.2 + r() * 5) * e.size * (1 - p * 0.5);
    if (y > -1) continue;
    ctx.beginPath();
    // teardrop stretched along travel
    const vx = Math.cos(a) * v, vy = Math.sin(a) * v + 2600 * tau;
    const ang = Math.atan2(vy, vx);
    ctx.ellipse(x, y, rad * 1.9, rad, ang, 0, TAU);
    ctx.fill();
  }
}

function scraps(ctx, e, p) {
  const r = rng(Math.round(e.t * 100) + 21);
  const tau = p * (e.life ?? LIFE.scraps);
  for (let i = 0; i < e.n; i++) {
    const a = -Math.PI * (0.15 + r() * 0.7);
    const v = 380 + r() * 760;
    const s = 9 + r() * 16;
    const om = (r() - 0.5) * 14;
    const drag = 1 / (1 + tau * 1.4); // paper flutters: quick out, slow fall
    const x = e.x + Math.cos(a) * v * tau * drag * 1.6;
    const y = -e.h + Math.sin(a) * v * tau * drag * 1.6 + 0.5 * 900 * tau * tau;
    if (y > -3) continue;
    const rot = om * tau;
    const flip = Math.abs(Math.cos(tau * 9 + i)); // tumbling
    const c = Math.cos(rot), sn = Math.sin(rot);
    const tri = [[-s, s * 0.5 * flip], [s * 0.9, s * 0.3 * flip], [s * 0.1, -s * flip]].map((q) => [x + q[0] * c - q[1] * sn, y + q[0] * sn + q[1] * c]);
    sketchPoly(ctx, tri, { w: 1.8, seed: 970 + i, fill: WHITE, rough: 0.5 });
  }
}

function shock(ctx, e, p) {
  const k = EASE.out(p);
  const rad = (28 + 150 * k) * e.size;
  const r = rng(Math.round(e.t * 100) + 33);
  ctx.beginPath();
  const segs = 26;
  for (let i = 0; i < segs; i++) {
    if (r() < 0.2 + p * 0.5) continue;
    const a0 = (i / segs) * TAU, a1 = ((i + 0.82) / segs) * TAU;
    ctx.moveTo(e.x + Math.cos(a0) * rad, -e.h + Math.sin(a0) * rad);
    ctx.arc(e.x, -e.h, rad, a0, a1);
  }
  ctx.lineWidth = Math.max(1, 4 * (1 - p) * Math.min(1.6, e.size));
  ctx.strokeStyle = BLACK;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function sparks(ctx, e, p) {
  const r = rng(Math.round(e.t * 100) + 41 + Math.round(e.x));
  const tau = p * LIFE.sparks;
  const n = e.n || 12;
  ctx.beginPath();
  ctx.fillStyle = BLACK;
  for (let i = 0; i < n; i++) {
    const a = e.dir ? -Math.PI / 2 + e.dir * (0.2 + r() * 1.3) : r() * TAU;
    const v = (420 + r() * 900) * e.size;
    const pos = (q) => [e.x + Math.cos(a) * v * q, -e.h + Math.sin(a) * v * q + 0.5 * 2200 * q * q];
    const p1 = pos(tau), p0 = pos(Math.max(0, tau - 0.035 * (1 - p * 0.6)));
    ctx.moveTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]);
  }
  ctx.lineWidth = Math.max(1, 2.6 * (1 - p) * Math.min(1.5, e.size));
  ctx.strokeStyle = BLACK;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function muzzle(ctx, e, p) {
  const r = rng(Math.round(e.t * 100) + 51);
  const k = (e.size || 1) * 1.7 * (p < 0.5 ? 1 : 0.62);
  const c = Math.cos(e.ang), s = -Math.sin(e.ang);
  const P = (l, w) => [e.x + c * l - s * w, -e.h + s * l + c * w];
  // long forward tongue + side spikes: white with an ink outline
  const pts = [P(-4, 0)];
  const spikes = [[14, -26], [30, -9], [96 + r() * 26, 0], [30, 9], [14, 26]];
  for (const [l, w] of spikes) { pts.push(P(l * k * 0.45, w * k * 0.32)); pts.push(P(l * k, w * k)); }
  pts.push(P(6 * k, 9 * k));
  sketchPoly(ctx, pts, { w: 3.6, seed: 980, fill: WHITE, rough: 0.5 });
  // ink core at the muzzle so the flash reads on white paper
  ctx.fillStyle = BLACK;
  ctx.beginPath();
  [P(0, -5 * k), P(26 * k, 0), P(0, 5 * k)].forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
  ctx.fill();
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = (r() - 0.5) * 1.5, l0 = (40 + r() * 30) * k, l1 = l0 + (30 + r() * 60) * k;
    const d = [c * Math.cos(a) - s * Math.sin(a), s * Math.cos(a) + c * Math.sin(a)];
    ctx.moveTo(e.x + d[0] * l0, -e.h + d[1] * l0);
    ctx.lineTo(e.x + d[0] * l1, -e.h + d[1] * l1);
  }
  ctx.lineWidth = 2.4; ctx.strokeStyle = BLACK; ctx.lineCap = 'round'; ctx.stroke();
}

function tracer(ctx, e, p) {
  const a = Math.max(0, p * 1.6 - 0.6), b = Math.min(1, p * 1.6 + 0.15);
  const X = (q) => e.x + (e.x2 - e.x) * q, Y = (q) => -(e.h + (e.h2 - e.h) * q);
  ctx.beginPath(); ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b));
  ctx.lineWidth = 7; ctx.strokeStyle = WHITE; ctx.lineCap = 'round'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b));
  ctx.lineWidth = 2.6; ctx.strokeStyle = BLACK; ctx.stroke();
}

function slug(ctx, e, p) {
  const x = e.x + (e.x2 - e.x) * p, y = -(e.h + (e.h2 - e.h) * p);
  const ang = Math.atan2(-(e.h2 - e.h), e.x2 - e.x);
  const c = Math.cos(ang), s = Math.sin(ang);
  // shock rings shed behind the slug
  ctx.lineWidth = 1.8; ctx.strokeStyle = BLACK;
  for (let i = 1; i <= 5; i++) {
    const d = i * 26, rr = 5 + i * 5;
    if (Math.hypot(x - e.x, y + e.h) < d) break;
    ctx.beginPath();
    ctx.ellipse(x - c * d, y - s * d, rr * 0.38, rr, ang, 0, TAU);
    ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(x - c * 150, y - s * 150); ctx.lineTo(x - c * 14, y - s * 14);
  ctx.lineWidth = 1.4; ctx.stroke();
  ctx.fillStyle = WHITE;
  ctx.beginPath(); ctx.ellipse(x, y, 16, 9, ang, 0, TAU); ctx.fill();
  ctx.fillStyle = BLACK;
  ctx.beginPath(); ctx.ellipse(x, y, 11, 5, ang, 0, TAU); ctx.fill();
}

function casing(ctx, e, p) {
  const tau = p * LIFE.casing;
  const r = rng(Math.round(e.t * 100) + 61);
  const vx = (e.dir || -1) * (120 + r() * 120), vy = -(380 + r() * 160);
  const x = e.x + vx * tau, y = -e.h + vy * tau + 0.5 * 2400 * tau * tau;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tau * 22 * (e.dir || -1));
  ctx.fillStyle = WHITE; ctx.fillRect(-6, -3.5, 12, 7);
  ctx.lineWidth = 1.8; ctx.strokeStyle = BLACK; ctx.strokeRect(-6, -3.5, 12, 7);
  ctx.fillStyle = BLACK; ctx.fillRect(3, -3.5, 3, 7);
  ctx.restore();
}

const DRAW = { dust, burst, ring, shock, sparks, splash, scraps, muzzle, tracer, slug, casing };

/** layer: 'back' (behind fighters: dust, rings) or 'front' (bursts, sparks, splashes, scraps) */
export function drawFxList(ctx, list, t, layer) {
  for (const e of list) {
    const life = e.life ?? LIFE[e.type];
    const p = (t - e.t) / life;
    if (p < 0 || p >= 1) continue;
    const back = e.type === 'dust' || e.type === 'ring';
    if ((layer === 'back') !== back) continue;
    DRAW[e.type](ctx, e, p, t);
  }
}

/** Speed lines trailing a fast-moving body. pos/vel in canvas world coords. */
export function drawSpeedLines(ctx, pos, vel, s, t, seed) {
  const speed = Math.hypot(vel[0], vel[1]);
  if (speed < 470 || Math.abs(vel[0]) < 400) return;
  // flattened toward horizontal so a leap does not rain lines through the floor
  const fl = Math.hypot(vel[0], vel[1] * 0.4);
  const ux = vel[0] / fl, uy = (vel[1] * 0.4) / fl;
  const nx = -uy, ny = ux;
  const n = Math.min(13, 5 + Math.floor(speed / 220));
  const r = rng(seed + Math.floor(t * 15) * 31);
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const off = (r() - 0.5) * 190 * s;
    const back = (26 + r() * 70) * s;
    const len = (50 + r() * 150) * Math.min(1.7, speed / 800);
    const x = pos[0] + nx * off - ux * back;
    const y = pos[1] - 12 * s + ny * off - uy * back;
    ctx.moveTo(x, y);
    ctx.lineTo(x - ux * len, y - uy * len);
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = BLACK;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

/** Slow-motion concentration lines, drawn in SCREEN space around a focal point. */
export function drawFocusLines(ctx, t, W, H, focus, strength) {
  if (strength <= 0) return;
  const r = rng(77 + Math.floor(t * 7.5));
  const N = 78;
  ctx.fillStyle = BLACK;
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU + (r() - 0.5) * 0.06;
    const inner = lerp(1500, 330 + r() * 330, strength);
    const outer = 1600;
    const hw = (0.004 + r() * 0.011) * (0.6 + strength * 0.4);
    ctx.moveTo(focus[0] + Math.cos(a) * inner, focus[1] + Math.sin(a) * inner * 0.82);
    ctx.lineTo(focus[0] + Math.cos(a - hw) * outer, focus[1] + Math.sin(a - hw) * outer);
    ctx.lineTo(focus[0] + Math.cos(a + hw) * outer, focus[1] + Math.sin(a + hw) * outer);
    ctx.closePath();
  }
  ctx.fill();
}
