// SCENE 4 — "Torn Paper Battlefield" (28 s, heavy weapons).
// A arrives with the longsword, B with the spear. Spear cut → B folds a strip of the page into
// a battle axe → A's longsword is shattered → A evades unarmed → the axe wedges → B tears a
// hammer loose → A pulls the greatsword out of the cracked page → greatsword vs hammer →
// the last clash rips the page in two and ink wells up through the tear.
//
// Stage (world x): hammer block 560 · sword outline 700…975 · strip torn from 1130…1300 ·
// B's crater 1400 · see-saw slab 1290…1610 · standing flap 1540 · folded ramp 1620…1800.

import { createScene } from '../engine/scene.js';
import { flight } from '../engine/moves.js';
import { DEG, rng, clamp, prog, EASE, hash, lerp, TAU } from '../engine/util.js';
import { sketchPoly, hatch, stroke, trim, line, BLACK, WHITE } from '../engine/ink.js';
import { drawGround, makeDebris, crackSet, drawCracks, drawTear, DEFAULT_PAGE } from '../engine/kit.js';

const S = createScene({
  id: 's4', title: 'Torn Paper Battlefield', duration: 28,
  poses: { ball: { hip: [0, 56], lean: 40, curl: 0.5, bend: 10, tilt: 30, hF: [30, -46], hB: [26, -50], fF: [34, 26], fB: [28, 20] } },
});

// ── key times ────────────────────────────────────────────────────────────────
const T_CRATER = 0.86;      // B lands
const T_CUT = 2.97;         // spear cut in two
const T_RIP0 = 3.85, T_RIP1 = 4.2;   // strip torn out of the floor
const T_AXE = 5.0;          // folded strip becomes the axe
const T_AXE1 = 5.84;        // first axe blow buries itself
const T_SHATTER = 7.62;     // longsword breaks
const T_FLAPCUT = 9.86;     // standing flap cut in half
const T_WEDGE = 11.57;      // axe wedges in the fold
const T_HAMMER = 13.9;      // hammer torn loose
const T_H1 = 15.05;         // hammer blow 1: see-saw
const T_H2 = 16.5;          // hammer blow 2: hole through the page
const T_GRAB = 17.05;       // A's hands in the fracture
const T_C1 = 19.5;           // greatsword meets hammer
const T_B3 = 20.55;         // hammer blow three (A vaults it)
const T_C2 = 23.0;          // second clash
const T_FINAL = 25.9;       // the last clash — the page rips in two

const FLOOR_L = 430, FLOOR_R = 2160;
const RAMP = { x0: 1620, x1: 1800, h: 170 };
const rampH = (x) => (x > RAMP.x0 && x <= RAMP.x1 ? ((x - RAMP.x0) / (RAMP.x1 - RAMP.x0)) * RAMP.h : 0);
const SLAB = { x0: 1290, x1: 1610, px: 1450 };

// ── drawing helpers ──────────────────────────────────────────────────────────
const jag = (x0, x1, y, amp, seed, step = 28) => {
  const r = rng(seed), pts = [];
  const n = Math.max(2, Math.round(Math.abs(x1 - x0) / step));
  for (let i = 0; i <= n; i++) pts.push([lerp(x0, x1, i / n), y + (r() - 0.5) * 2 * amp + (i % 2 ? amp * 0.6 : -amp * 0.4)]);
  return pts;
};
const fillPoly = (ctx, pts, color) => {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
};
const ragged = (cx, cy, rx, ry, seed, n = 18, rough = 0.28) => {
  const r = rng(seed), pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, k = 1 + (r() - 0.5) * 2 * rough;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return pts;
};

// ── static set geometry (built once) ─────────────────────────────────────────
const PG = DEFAULT_PAGE;
const LIP = jag(FLOOR_L - 6, FLOOR_R + 6, 50, 9, 411);          // torn front edge of the top layer
const LOW = jag(PG.x0, PG.x1, 285, 16, 412, 34);                // torn edge of the layer under it
const HOLE_FAR = ragged(520, -700, 250, 150, 421, 22, 0.3);
const HOLE_FAR2 = ragged(1160, -760, 90, 54, 422, 14, 0.34);
const SHEET = [[1560, -1130], ...jag(1560, 2700, -452, 14, 423, 36).map((p, i) => [p[0], p[1] - i * 2.4]), [2700, -1130]];
const SHEET_SH = [...jag(1560, 2700, -452, 14, 423, 36).map((p, i) => [p[0], p[1] - i * 2.4]), [2700, -470], [1560, -392]];
const LOW_HOLES = [ragged(760, 170, 90, 34, 431, 14), ragged(1480, 190, 130, 30, 432, 16), ragged(2050, 160, 70, 28, 433, 12)];
const SCRAPS = (() => {
  const r = rng(441), out = [];
  for (let i = 0; i < 11; i++) out.push({ x: 150 + r() * 2100, y: -380 - r() * 520, s: 12 + r() * 22, ph: r() * 6, rot: r() * 6 });
  return out;
})();

const FLAP = [[1526, 0], [1556, 0], [1566, -120], [1580, -205], [1560, -224], [1540, -200], [1532, -110]];
const FLAP_STUMP = [[1526, 0], [1556, 0], [1564, -104], [1552, -96], [1544, -108], [1532, -98]];
const BLOCK = [[504, 0], [616, 0], [622, -40], [598, -74], [522, -70], [498, -34]];

// ── persistent damage ────────────────────────────────────────────────────────
// smash(t, x, opts): cracks from a floor point (+ an optional rip showing the black desk)
const DMG = [];
function smash(t, x, o = {}) {
  const dirs = o.dirs || [{ a: 176, len: 1.1 }, { a: 4, len: 1.1 }, { a: -172, len: 0.45, w: 0.8 }, { a: -10, len: 0.45, w: 0.8 }, { a: 100, len: 0.5, w: 0.8 }, { a: 66, len: 0.4, w: 0.8 }];
  DMG.push({
    t, x, grow: o.grow ?? 0.34,
    cracks: crackSet(500 + DMG.length * 17, x, -2, dirs, { len: o.len ?? 150, step: 24, w: o.w ?? 3, branch: o.branch ?? 0.12 }),
    tear: o.tear ? { x0: x - o.tear[0], x1: x + o.tear[1], y: 4, depth: o.tear[2] ?? 24, seed: 150 + DMG.length * 9, flaps: o.flaps ?? 4 } : null,
  });
}
function drawDamage(ctx, t) {
  for (const d of DMG) {
    if (t < d.t) continue;
    const p = prog(t, d.t, d.t + d.grow);
    const fn = () => { if (d.tear) drawTear(ctx, d.tear, p); drawCracks(ctx, d.cracks, p, 1); };
    if (d.t < T_H1 && d.x > SLAB.x0 + 30 && d.x < SLAB.x1) onSlab(ctx, t, fn); else fn();
  }
}
// cuts left in the air (the page behind the fighters) by missed swings
const CUTS = [];
function cutMark(t, pts, seed = 1) { CUTS.push({ t, pts, seed }); }
function drawCuts(ctx, t) {
  for (const c of CUTS) {
    if (t < c.t) continue;
    const p = prog(t, c.t, c.t + 0.1);
    const pts = trim(c.pts, p);
    if (pts.length < 2) continue;
    const n = pts.length - 1;
    const lo = pts.map((q, i) => [q[0], q[1] + 7 * Math.sin((i / n) * Math.PI) * p]).reverse();
    fillPoly(ctx, [...pts, ...lo], BLACK);
    stroke(ctx, pts, 1.6);
    const m = pts[Math.floor(n / 2)];
    const fl = [[m[0] - 12, m[1] + 6], [m[0] + 10, m[1] + 6], [m[0] + 2, m[1] + 22 * p]];
    sketchPoly(ctx, fl, { w: 1.6, seed: 590 + c.seed, fill: WHITE }); hatch(ctx, fl, { angle: 60, gap: 4, w: 1, seed: 592 + c.seed });
  }
}

smash(T_CRATER, 1400, { tear: [70, 80, 20], len: 130 });
smash(T_AXE1, 1040, { tear: [95, 85, 26], len: 150, dirs: [{ a: 178, len: 1.3 }, { a: 6 }, { a: -172, len: 0.6, w: 0.8 }, { a: 96, len: 0.5, w: 0.8 }, { a: 120, len: 0.4, w: 0.8 }] });

smash(7.24, 975, { len: 70, w: 2.4 });
smash(T_WEDGE, 1538, { tear: [34, 40, 16], len: 90 });
smash(T_H1, 1312, { tear: [56, 44, 22], len: 140 });
smash(T_H2, 853, { len: 190, w: 3.4, branch: 0.2, dirs: [{ a: 178, len: 1.2 }, { a: -166, len: 1.0 }, { a: -150, len: 0.7 }, { a: 4, len: 0.7 }, { a: 140, len: 0.5, w: 0.8 }, { a: 50, len: 0.5, w: 0.8 }] });
smash(20.42, 960, { len: 60, w: 2.4 });
smash(T_B3, 1040, { len: 110 });
smash(T_FINAL, 1150, { len: 260, w: 4, grow: 0.3, dirs: [{ a: -172, len: 0.8 }, { a: -8, len: 0.8 }, { a: 120, len: 0.8 }, { a: 60, len: 0.8 }, { a: 92, len: 0.6 }] });
cutMark(8.78, [[1000, -142], [930, -150], [860, -146], [800, -132]], 1);
cutMark(T_FLAPCUT, [[1430, -132], [1500, -140], [1560, -139], [1600, -132]], 2);
const flapTop = makeDebris([
  { t: T_FLAPCUT, x: 1556, y: -160, w: 50, h: 110, vx: 430, vy: -420, om: 9, pts: [[-22, 54], [8, 46], [18, -10], [26, -46], [6, -62], [-14, -40], [-18, 10]], chips: 6 },
], 940);

// the see-saw slab (hammer blow one): degrees, + = left end down
const slabAng = (t) => {
  const dt = t - T_H1;
  if (dt < 0) return 0;
  if (dt < 0.07) return 22 * EASE.out(dt / 0.07);
  return 1.2 + 20.8 * Math.exp(-(dt - 0.07) * 5.5) * Math.cos((dt - 0.07) * 13);
};
// things standing on the slab ride it
const onSlab = (ctx, t, fn) => {
  if (t < T_H1) return fn();
  ctx.save(); ctx.translate(SLAB.px, 0); ctx.rotate(-slabAng(t) * DEG); ctx.translate(-SLAB.px, 0);
  fn();
  ctx.restore();
};
function drawSlab(ctx, t, vb, px) {
  const a = slabAng(t);
  fillPoly(ctx, [[SLAB.x0, -1], [SLAB.x1, -1], [SLAB.x1 - 6, 30], [SLAB.x0 + 8, 30]], BLACK);
  // the wad of crushed layers it pivots on
  const wad = [[SLAB.px - 34, 30], [SLAB.px - 20, 8], [SLAB.px + 2, 2], [SLAB.px + 24, 9], [SLAB.px + 36, 30]];
  sketchPoly(ctx, wad, { w: 2, seed: 545, fill: WHITE, rough: 1 }); hatch(ctx, wad, { angle: 40, gap: 5, w: 1.1, seed: 546, cross: true });
  ctx.save();
  ctx.translate(SLAB.px, 0);
  ctx.rotate(-a * DEG);
  const w0 = SLAB.x0 - SLAB.px, w1 = SLAB.x1 - SLAB.px;
  const under = [[w0, 0], [w1, 0], [w1 - 5, 24], [w1 - 40, 20], [0, 26], [w0 + 50, 21], [w0 + 6, 24]];
  fillPoly(ctx, under, WHITE);
  hatch(ctx, [[w0, 12], [w1, 12], [w1 - 5, 24], [w1 - 40, 20], [0, 26], [w0 + 50, 21], [w0 + 6, 24]], { angle: 60, gap: 4.5, w: 1.2, seed: 547, cross: true });
  stroke(ctx, [...under.slice(1).reverse(), under[0]], 2.6);
  drawGround(ctx, w0, w1, { x0: -1e5, x1: 1e5 }, px, { strokes: false, depth: 12, seed: 300 });
  ctx.restore();
}
// the hole punched through the page (hammer blow two)
const HOLE = ragged(853, 12, 84, 34, 551, 20, 0.22);
function drawHole(ctx, t) {
  if (t < T_H2) return;
  const p = EASE.out(prog(t, T_H2, T_H2 + 0.12));
  fillPoly(ctx, HOLE.map((q) => [853 + (q[0] - 853) * p, 12 + (q[1] - 12) * p]), BLACK);
  for (const [x, y, sx, sy, sd] of [[778, -6, -1, -1, 1], [930, -4, 1, -1, 2], [800, -20, -0.6, -1.3, 3], [900, -22, 0.7, -1.2, 4], [856, -26, 0.1, -1.2, 5]]) {
    const f = [[x - 12 * p, y + 10], [x + 12 * p, y + 8], [x + sx * 26 * p, y + sy * 22 * p]];
    sketchPoly(ctx, f, { w: 2, seed: 552 + sd, fill: WHITE, rough: 0.7 });
    hatch(ctx, f, { angle: 60, gap: 5, w: 1.1, seed: 560 + sd });
  }
}
// The foreshadowed greatsword: the cracks trace its outline (as in ref_poc's drawSlamDamage),
// then A pulls the real thing out and a sword-shaped gash is left in the page.
const GS_TAIL = [546, 163], GS_ANG = -32;
const GS_OUT = [[0, -5], [52, -5], [52, -42], [60, -42], [60, -17], [260, -17], [300, 0], [260, 17], [60, 17], [60, 42], [52, 42], [52, 5], [0, 5], [0, -5]];
const GSF = frame(GS_TAIL, GS_ANG);
const swordEdges = [];
{
  const r = rng(123);
  for (let i = 0; i < GS_OUT.length - 1; i++) {
    const a = GS_OUT[i], b = GS_OUT[i + 1];
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 22));
    const pts = [];
    for (let j = 0; j <= n; j++) {
      const k = j / n, q = GSF(lerp(a[0], b[0], k), lerp(a[1], b[1], k));
      const jit = j === 0 || j === n ? 0 : 6;
      pts.push([q[0] + (r() - 0.5) * jit, q[1] + (r() - 0.5) * jit]);
    }
    swordEdges.push({ pts, l: 300 - Math.max(a[0], b[0]), id: i });
  }
  for (let u = 80; u < 250; u += 44) swordEdges.push({ pts: [GSF(u, (r() - 0.5) * 4), GSF(u + 14, (r() - 0.5) * 6), GSF(u + 30, (r() - 0.5) * 4)], l: 300 - u - 30, id: 100 + u, thin: true });
}
// what is left when the sword is gone: built from the outline but torn ragged (the crossguard
// nubs are ripped away, the edge wanders) so it reads as a hole in the paper, not as a sword
const HOLLOW = (() => {
  const r = rng(577), up = [], lo = [];
  for (let u = -6; u <= 304; u += 13) {
    const w = u < 44 ? 9 : u < 74 ? 26 : u > 262 ? 20 * (304 - u) / 42 + 3 : 20;
    up.push(GSF(u + (r() - 0.5) * 8, -(w + (r() - 0.3) * 11)));
    lo.push(GSF(u + (r() - 0.5) * 8, w + (r() - 0.3) * 11));
  }
  return [...up, ...lo.reverse()];
})();
const HOLLOW_CORE = (() => {
  const r = rng(578), up = [], lo = [];
  for (let u = 30; u <= 286; u += 16) {
    const w = 7.5 * Math.sin(((u - 30) / 256) * Math.PI) + 1;
    up.push(GSF(u, 5 - w * (0.6 + r() * 0.7)));
    lo.push(GSF(u, 5 + w * (0.6 + r() * 0.7)));
  }
  return [...up, ...lo.reverse()];
})();
const HOLLOW_FLAPS = [[60, -24, -10, -30, 1], [128, -19, 8, -30, 2], [206, -19, -6, -26, 3], [96, 19, 6, 26, 4], [176, 19, -8, 28, 5], [250, 16, 8, 22, 6]];
function drawSwordOutline(ctx, t, impact) {
  if (t < T_H2 + 0.04) return;
  if (t >= T_GRAB) {
    // the hollow it leaves: a ragged tear with shadow inside and curled edges — no sword outline
    const k = EASE.out(prog(t, T_GRAB, 17.74));
    fillPoly(ctx, HOLLOW, WHITE);
    hatch(ctx, HOLLOW, { angle: -32, gap: 4.6, w: 1.2, seed: 575, cross: true, crossAngle: 58 });
    fillPoly(ctx, HOLLOW_CORE, BLACK);
    stroke(ctx, [...HOLLOW, HOLLOW[0]], 2.2);
    for (const [u, v, du, dv, sd] of HOLLOW_FLAPS) {
      const fl = [GSF(u - 16, v), GSF(u + 16, v), GSF(u + du * k, v + dv * k)];
      sketchPoly(ctx, fl, { w: 1.8, seed: 571 + sd, fill: WHITE, rough: 0.8 }); hatch(ctx, fl, { angle: 50, gap: 5, w: 1, seed: 580 + sd });
    }
    return;
  }
  const grow = prog(t, T_H2 + 0.04, T_H2 + 0.4);       // spreads from the hole (tip) to the hilt
  const sure = prog(t, T_H2 + 0.3, T_GRAB - 0.05);      // flickers less and less
  const flick = Math.floor(t * 15);
  for (const ed of swordEdges) {
    if (ed.l / 300 > grow) continue;
    const h = hash(ed.id * 3.7 + flick * 1.3);
    if (!impact && h < 0.3 * (1 - sure)) continue;
    const base = ed.thin ? 1.8 : impact ? 6 : 3.6 + sure * 1.4;
    stroke(ctx, trim(ed.pts, clamp((grow - ed.l / 300) * 6)), base * (0.8 + h * 0.4));
  }
}
// the last clash rips the page in two along the ground line; ink wells up through the tear
const RIP_UP = jag(PG.x0, PG.x1, 7, 3.5, 581, 30), RIP_LO = jag(PG.x0, PG.x1, 9, 5, 582, 26);
const ripRun = (t) => EASE.out(prog(t, T_FINAL, T_FINAL + 0.32));
const ripDrop = (t) => 190 * EASE.io(prog(t, T_FINAL + 0.2, T_FINAL + 1.9));
const inkRise = (t) => EASE.io(prog(t, T_FINAL + 0.45, 28.2));
const GEYSERS = (() => {
  const r = rng(591), out = [];
  for (let i = 0; i < 16; i++) {
    const x = PG.x0 + 60 + r() * (PG.x1 - PG.x0 - 120);
    out.push({ x, w: 22 + r() * 34, h: 150 + r() * 210, rate: 0.9 + r() * 0.9, ph: r() });
  }
  return out;
})();
function inkTop(x, t) {
  const k = inkRise(t);
  const calm = 1 - 0.93 * Math.exp(-Math.pow((x - 1150) / 430, 4));    // low between and under the fighters
  const n = 0.5 + 0.4 * Math.sin(x * 0.0085 + t * 2.2) + 0.25 * Math.sin(x * 0.021 - t * 1.7);
  let surge = 0;
  for (const g of GEYSERS) {
    const ph = ((t - T_FINAL) * g.rate + g.ph) % 1;
    const up = ph < 0.22 ? EASE.out(ph / 0.22) : Math.pow(1 - (ph - 0.22) / 0.78, 1.6);       // shoots up, sinks back
    surge += g.h * up * Math.exp(-Math.pow((x - g.x - 30 * Math.sin(ph * 6)) / g.w, 2));
  }
  return -(k * calm * (40 + 150 * Math.max(0, n) + surge) - (1 - calm) * 4);
}
function drawRip(ctx, t) {
  if (t < T_FINAL) return;
  const e = ripRun(t), xa = lerp(1150, PG.x0, e), xb = lerp(1150, PG.x1, e);
  const up = RIP_UP.filter((q) => q[0] >= xa && q[0] <= xb);
  if (up.length < 2) return;
  const d = ripDrop(t);
  const lo = RIP_LO.filter((q) => q[0] >= xa && q[0] <= xb).map((q) => [q[0], q[1] + 6 + d + 14 * Math.sin((q[0] - xa) / (xb - xa) * Math.PI)]).reverse();
  fillPoly(ctx, [...up, ...lo], BLACK);
}
function drawInk(ctx, t) {
  if (inkRise(t) > 0) {
    const top = [];
    for (let x = PG.x0; x <= PG.x1; x += 7) top.push([x, 8 + inkTop(x, t)]);
    fillPoly(ctx, [...top, [PG.x1, 20], [PG.x0, 20]], BLACK);
  }
}
function inkDrops(ctx, t) {
  const k = inkRise(t);
  if (k <= 0) return;
  ctx.fillStyle = BLACK;
  for (let i = 0; i < 46; i++) {
    const x0 = PG.x0 + hash(i * 7.1) * (PG.x1 - PG.x0);
    if (Math.abs(x0 - 1150) < 330) continue;
    const ph = (t * (0.7 + hash(i * 3.3) * 0.9) + hash(i * 1.7)) % 1;
    const base = inkTop(x0, t);
    const y = 8 + base - ph * (60 + 160 * hash(i * 5.9)) * k, rad = (3 + 7 * hash(i * 9.1)) * (1 - ph * 0.7) * Math.min(1, k * 3);
    ctx.beginPath(); ctx.ellipse(x0 + Math.sin(ph * 5 + i) * 10, y, rad * 0.8, rad * 1.5, 0, 0, TAU); ctx.fill();
  }
}

// ── scene-drawn props ────────────────────────────────────────────────────────
// Folded-paper axe head in the weapon's own frame: u along the shaft from the tail, v across
// (v > 0 = the side the blade is on: it leads when B, facing left, swings forward).
const AXL = 196;
function frame(tail, angDeg) {
  const a = angDeg * DEG, d = [Math.cos(a), Math.sin(a)], n = [-Math.sin(a), Math.cos(a)];
  return (u, v) => [tail[0] + d[0] * u + n[0] * v, -(tail[1] + d[1] * u + n[1] * v)];
}
function drawAxeHead(ctx, tail, ang, k, spikeK = k) {
  const F = frame(tail, ang), L = AXL;
  if (Math.abs(k) > 0.02) {
    const head = [[L - 50, 3], [L - 6, 3], [L + 4, 40 * k], [L - 24, 58 * k], [L - 62, 46 * k], [L - 42, 24 * k]].map((q) => F(q[0], q[1]));
    sketchPoly(ctx, head, { w: 2.6, seed: 540, fill: WHITE, rough: 0.5 });
    hatch(ctx, [[L + 4, 40 * k], [L - 24, 58 * k], [L - 62, 46 * k], [L - 50, 32 * k], [L - 20, 40 * k], [L - 4, 28 * k]].map((q) => F(q[0], q[1])), { angle: 20, gap: 4, w: 1.1, seed: 542, cross: true });
    stroke(ctx, [F(L - 42, 24 * k), F(L - 6, 3)], 1.3);        // fold crease
  }
  if (Math.abs(spikeK) > 0.02) sketchPoly(ctx, [[L - 44, -3], [L - 12, -3], [L - 28, -18 * spikeK]].map((q) => F(q[0], q[1])), { w: 2.2, seed: 541, fill: WHITE, rough: 0.5 });
}
// The strip of page B rips up (T_RIP0…T_RIP1) and folds three times into the axe (…T_AXE).
// It is drawn as a sheet with its own (u, v) coordinates — u along its length (0 = the end that
// becomes the pommel, 240 = the end that becomes the head), v across — mapped through a bendable
// centre line, so it sags while it is paper and stiffens as the creases go in. Each fold is a flap
// mirrored across its crease (cos of the fold angle: +1 flat, 0 edge-on, −1 folded over).
const FOLD_T = [4.38, 4.6, 4.82];
const FOLD_G = [1296, 158];                 // where B's front hand holds the sheet while he folds
const SH_L = 240, SH_ANG = 112;
const gripU = (t) => (t < 4.5 ? lerp(236, 165, EASE.io(prog(t, T_RIP1, 4.34))) : lerp(165, AXL * 0.3, EASE.io(prog(t, 4.88, T_AXE))));
const sheetAng = (t) => lerp(SH_ANG, 125, EASE.io(prog(t, 4.88, T_AXE)));
const foldCos = (t, ft) => Math.cos(Math.PI * EASE.in(prog(t, ft - 0.1, ft)));
// tail→tip direction of the sheet s units below the hand: the freed tail whips round (the far
// end lagging), overshoots, then hangs and sways until the lengthwise creases stiffen it
const tailAng = (t, s) => {
  const k = s / 165, lag = t - 0.08 * k;
  const swing = lerp(47, SH_ANG, EASE.back(prog(lag, T_RIP1, 4.38)));
  const limp = 1 - prog(t, FOLD_T[1] - 0.1, FOLD_T[1]);
  return swing + (9 * Math.sin(t * 9) + 5) * k * k * limp * prog(t, 4.3, 4.4) + (sheetAng(t) - SH_ANG);
};
function sheetMap(t, G) {
  const gU = gripU(t), a0 = sheetAng(t), N = 20, du = SH_L / N;
  const C = [], A = [];
  let px = G[0], py = G[1], pu = gU;
  for (let i = N; i >= 0; i--) {
    const u = i * du;
    if (u >= gU) { C[i] = [G[0] + Math.cos(a0 * DEG) * (u - gU), G[1] + Math.sin(a0 * DEG) * (u - gU)]; A[i] = a0; continue; }
    const am = tailAng(t, gU - (pu + u) / 2) * DEG;
    px -= Math.cos(am) * (pu - u); py -= Math.sin(am) * (pu - u); pu = u;
    C[i] = [px, py]; A[i] = tailAng(t, gU - u);
  }
  return (u, v) => {
    const f = clamp(u / du, 0, N - 1e-6), i = Math.floor(f), k = f - i + (u > SH_L ? (u - SH_L) / du : u < 0 ? u / du : 0);
    const a = lerp(A[i], A[i + 1], clamp(k)) * DEG;
    return [lerp(C[i][0], C[i + 1][0], k) - Math.sin(a) * v, -(lerp(C[i][1], C[i + 1][1], k) + Math.cos(a) * v)];
  };
}
// subdivide polygon edges so a bent sheet stays smooth
const subdiv = (pts, step = 16) => {
  const out = [];
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length], n = Math.max(1, Math.round(Math.hypot(q[0] - p[0], q[1] - p[1]) / step));
    for (let j = 0; j < n; j++) out.push([lerp(p[0], q[0], j / n), lerp(p[1], q[1], j / n)]);
  });
  return out;
};
const lerpPts = (a, b, k) => a.map((p, i) => [lerp(p[0], b[i][0], k), lerp(p[1], b[i][1], k)]);
const FLAP3 = [[172, -6], [208, -6], [240, -6], [240, 22], [200, 22], [186, 8]];
const HEAD6 = [[146, 3], [154, 24], [134, 46], [172, 58], [200, 40], [190, 3]];
const mirror3 = (p, c) => {                 // across the diagonal crease (172,−6)–(200,22)
  const rx = p[0] - 172, ry = p[1] + 6, al = (rx + ry) / 2;
  return [172 + al + (rx - al) * c, -6 + al + (ry - al) * c];
};
function drawFold(ctx, t, st) {
  if (t < T_RIP0 || t >= T_AXE) return;
  const B = st.B;
  const fists = () => { ctx.fillStyle = BLACK; for (const h of [B.hF, B.hB]) { ctx.beginPath(); ctx.arc(h[0], -h[1], 6, 0, TAU); ctx.fill(); } };
  if (t < T_RIP1) {
    // peeling ribbon, floor → hands: it twists face-on as it lifts, bellies and flutters
    const p = EASE.in(prog(t, T_RIP0, T_RIP1));
    const xr = lerp(1292, 1130, p);
    const H = [(B.hF[0] + B.hB[0]) / 2, -(B.hF[1] + B.hB[1]) / 2];
    const c = [(H[0] + xr) / 2 - 60 * p, H[1] * 0.18];
    const up = [], lo = [], mid = [];
    for (let i = 0; i <= 14; i++) {
      const k = i / 14, m = 1 - k;
      const tx = 2 * m * (c[0] - xr) + 2 * k * (H[0] - c[0]), ty = 2 * m * c[1] + 2 * k * (H[1] - c[1]);
      const l = Math.hypot(tx, ty) || 1, w = lerp(5, 22, EASE.out(k)), fl = Math.sin(k * 8 - t * 46) * 5 * Math.sin(k * Math.PI) * p;
      const x = m * m * xr + 2 * m * k * c[0] + k * k * H[0] - (ty / l) * fl, y = 2 * m * k * c[1] + k * k * H[1] + (tx / l) * fl;
      up.push([x - (ty / l) * w, y + (tx / l) * w]); lo.push([x + (ty / l) * w, y - (tx / l) * w]); mid.push([x, y]);
    }
    const band = [...up, ...lo.reverse()];
    sketchPoly(ctx, band, { w: 2.4, seed: 520, fill: WHITE, rough: 0.6 });
    stroke(ctx, mid, 1); stroke(ctx, mid.map((q, i) => [(q[0] + up[i][0]) / 2, (q[1] + up[i][1]) / 2]), 1);
    fists();
    return;
  }
  const W = sheetMap(t, B.hF);
  const M = (pts) => subdiv(pts).map((q) => W(q[0], q[1]));
  const c1 = foldCos(t, FOLD_T[0]), c2 = foldCos(t, FOLD_T[1]), c3 = foldCos(t, FOLD_T[2]);
  const s4 = EASE.io(prog(t, 4.9, 4.985));
  const paper = (pts, seed, back) => {
    sketchPoly(ctx, pts, { w: 2.2, seed, fill: WHITE, rough: 0.5 });
    if (back) hatch(ctx, pts, { angle: 62, gap: 6, w: 1, seed: seed + 1, skip: 0.05 });
  };
  const crease = (a, b, k) => { if (k > 0) stroke(ctx, [W(a[0], a[1]), W(b[0], b[1])], 1 + 1.6 * k); };
  // 1. the sheet itself (what is left of it after each fold)
  let body;
  if (c3 < 1) body = lerpPts([[0, -6], [172, -6], [200, 22], [164, 22], [150, 8], [0, 8]], [[0, -4.5], [196, -4.5], [196, 4.5], [150, 4.5], [100, 4.5], [0, 4.5]], s4);
  else if (c2 < 1) body = [[0, -6], [240, -6], [240, 22], [164, 22], [150, 8], [0, 8]];
  else body = [[0, -6], [240, -6], [240, 22], [0, 22]];
  paper(M(body), 522, false);
  if (c2 >= 1) for (const v of [2, 12]) stroke(ctx, M([[4, v], [236, v]]).slice(0, -14), 1);      // notebook rules
  // 2. fold one: the back edge turned over, the whole length
  if (c2 > -1) {
    paper(M([[0, -6], [240, -6], [240, -6 - 16 * c1], [0, -6 - 16 * c1]]), 524, c1 < 0);
    crease([2, -6], [238, -6], prog(t, FOLD_T[0] - 0.1, FOLD_T[0]));
  }
  // 3. fold two: the front edge turned back over the handle
  if (c2 < 1 && s4 < 0.5) {
    paper(M([[0, 8], [150, 8], [164, 8 + 14 * c2], [0, 8 + 14 * c2]]), 526, c2 < 0);
    crease([2, 8], [150, 8], prog(t, FOLD_T[1] - 0.1, FOLD_T[1]));
    if (c2 <= -1) stroke(ctx, [W(4, 1), W(146, 1)], 1.1);
  }
  // 4. fold three: the top end turned down across a diagonal — the blade
  if (c3 < 1) {
    const blade = lerpPts(FLAP3.map((q) => mirror3(q, c3)), HEAD6, s4);
    paper(M(blade), 528, c3 < 0);
    if (c3 <= -1) hatch(ctx, M(lerpPts([[172, 40], [172, 62], [200, 62], [200, 44]], [[134, 46], [172, 58], [200, 40], [176, 40]], s4)), { angle: 20, gap: 4, w: 1.1, seed: 542, cross: true });
    crease(lerpPts([[172, -6]], [[154, 24]], s4)[0], lerpPts([[200, 22]], [[190, 3]], s4)[0], prog(t, FOLD_T[2] - 0.1, FOLD_T[2]));
    if (s4 > 0) sketchPoly(ctx, [[152, -3], [184, -3], [168, -18 * s4]].map((q) => W(q[0], q[1])), { w: 2.2, seed: 541, fill: WHITE, rough: 0.5 });
  }
  fists();
}
function drawStripGap(ctx, t) {
  if (t < T_RIP0) return;
  const xr = lerp(1292, 1130, EASE.in(prog(t, T_RIP0, T_RIP1)));
  const top = jag(xr, 1296, 3, 1.5, 525, 20), bot = jag(xr, 1296, 15, 3, 526, 20).reverse();
  fillPoly(ctx, [...top, ...bot], BLACK);
}
// the cut-off front of the spear: pinned under A's foot, then flicked away
function drawSpearHead(ctx, t) {
  if (t < T_CUT || t >= T_H2) return;
  const k = prog(t, 3.3, 3.74);
  const x = lerp(1112, 772, k), h = 6 + 150 * 4 * k * (1 - k) * (k < 1 ? 1 : 0);
  const ang = (198 + 560 * k) * DEG, d = [Math.cos(ang), -Math.sin(ang)], n = [d[1], -d[0]];
  const P = (u, v) => [x + d[0] * u + n[0] * v, -h + d[1] * u + n[1] * v];
  stroke(ctx, [P(-62, 0), P(18, 0)], 5.6 + 9, WHITE);
  stroke(ctx, [P(-62, 0), P(18, 0)], 5.6);
  sketchPoly(ctx, [P(14, 0), P(30, -11), P(62, 0), P(30, 11)], { w: 2.2, seed: 527, fill: WHITE, rough: 0.5 });
  stroke(ctx, [P(14, -8), P(14, 8)], 3.4);
}
// longsword blade fragments
const shards = makeDebris([
  { t: T_SHATTER, x: 1020, y: -210, w: 62, h: 12, vx: -520, vy: -620, om: 14 },
  { t: T_SHATTER, x: 1035, y: -180, w: 44, h: 12, vx: -260, vy: -820, om: -18 },
  { t: T_SHATTER, x: 1040, y: -150, w: 30, h: 11, vx: 180, vy: -700, om: 22 },
  { t: T_SHATTER, x: 1030, y: -230, w: 22, h: 10, vx: -760, vy: -300, om: 9 },
], 930);

// ── environment ──────────────────────────────────────────────────────────────
function drawBelow(ctx, t, vb, px) {
  // lower layer: white sheet with its own torn edge, the black desk under it
  fillPoly(ctx, [[PG.x0, 6], [PG.x1, 6], [PG.x1, PG.y1], [PG.x0, PG.y1]], WHITE);
  fillPoly(ctx, [...LOW, [PG.x1, PG.y1 + 40], [PG.x0, PG.y1 + 40]], BLACK);
  stroke(ctx, LOW, 2.4);
  for (const h of LOW_HOLES) { fillPoly(ctx, h, BLACK); }
  // void to the left / right of the top layer
  fillPoly(ctx, [[PG.x0, 6], [FLOOR_L - 60, 6], [FLOOR_L - 30, 60], [FLOOR_L - 90, 130], [FLOOR_L - 40, 200], [FLOOR_L - 120, 300], [PG.x0, 300]], BLACK);
  fillPoly(ctx, [[PG.x1, 6], [FLOOR_R + 50, 6], [FLOOR_R + 20, 70], [FLOOR_R + 90, 150], [FLOOR_R + 40, 300], [PG.x1, 300]], BLACK);
  // deep shadow under the lifted top layer
  hatch(ctx, [...LIP, [FLOOR_R + 6, 104], [FLOOR_L - 6, 96]], { angle: 52, gap: 5.2, gapEnd: 7.5, w: Math.max(1.3, px), seed: 451, cross: true, crossAngle: 70 });
  hatch(ctx, [[FLOOR_L - 6, 96], [FLOOR_R + 6, 104], [FLOOR_R + 6, 150], [FLOOR_L - 6, 140]], { angle: 52, gap: 11, w: Math.max(1.2, px), seed: 452, skip: 0.2 });
  // the top layer's front lip
  fillPoly(ctx, [[FLOOR_L, 0], [FLOOR_R, 0], ...LIP.slice().reverse()], WHITE);
  stroke(ctx, LIP, 2.6);
  stroke(ctx, [[FLOOR_L, 0], [FLOOR_L - 12, 24], [FLOOR_L - 4, 50]], 2.6);
  stroke(ctx, [[FLOOR_R, 0], [FLOOR_R + 10, 26], [FLOOR_R + 4, 50]], 2.6);
}

function drawProps(ctx, t) {
  // standing flap (cut in half at T_FLAPCUT)
  const fl = t < T_FLAPCUT ? FLAP : FLAP_STUMP;
  onSlab(ctx, t, () => {
    sketchPoly(ctx, fl, { w: 2.6, seed: 461, fill: WHITE, rough: 0.8 });
    hatch(ctx, fl, { angle: 68, gap: 7, gapEnd: 4.5, w: 1.2, seed: 462 });
    if (t < T_H1) hatch(ctx, [[1556, 0], [1600, 0], [1590, 10], [1556, 12]], { angle: 20, gap: 4, w: 1.2, seed: 463, cross: true });
  });
  // folded ramp
  const tri = [[RAMP.x0, 0], [RAMP.x1, 0], [RAMP.x1, -RAMP.h]];
  const side = [[RAMP.x1, 0], [RAMP.x1 + 46, -30], [RAMP.x1 + 46, -RAMP.h - 30], [RAMP.x1, -RAMP.h]];
  sketchPoly(ctx, side, { w: 2.6, seed: 471, fill: WHITE, over: 3 });
  hatch(ctx, side, { angle: -60, gap: 5, w: 1.3, seed: 472, cross: true, crossAngle: 68 });
  sketchPoly(ctx, tri, { w: 2.8, seed: 473, fill: WHITE, over: 3 });
  hatch(ctx, tri, { angle: 44, gap: 13, gapEnd: 6, w: 1.1, seed: 474, skip: 0.1 });
  line(ctx, RAMP.x0 + 60, -4, RAMP.x1 - 4, -RAMP.h * 0.62, { w: 1.2, seed: 475 });
}

function drawBlock(ctx, t) {
  // folded block the hammer is torn out of (stub afterwards)
  if (t < T_HAMMER) {
    sketchPoly(ctx, BLOCK, { w: 2.6, seed: 481, fill: WHITE, rough: 0.9 });
    hatch(ctx, BLOCK, { angle: -40, gap: 8, w: 1.2, seed: 482, skip: 0.1 });
    stroke(ctx, [[522, -70], [548, -36], [616, 0]], 1.6);
    stroke(ctx, [[598, -74], [574, -40], [504, 0]], 1.6);
  } else {
    const st = [[504, 0], [616, 0], [606, -8], [584, -3], [560, -10], [534, -3], [512, -8]];
    sketchPoly(ctx, st, { w: 2.4, seed: 483, fill: WHITE, rough: 0.9 });
    hatch(ctx, st, { angle: -40, gap: 6, w: 1.2, seed: 484 });
  }
}

S.env({
  mid(ctx, t) { drawBlock(ctx, t); },
  far(ctx, t, { px }) {
    // a hole torn through the page, a lifted sheet with shadow under it, drifting scraps
    fillPoly(ctx, HOLE_FAR, BLACK);
    const fl = [[330, -640], [470, -720], [400, -560]];
    sketchPoly(ctx, fl, { w: 2.4, seed: 491, fill: WHITE }); hatch(ctx, fl, { angle: 60, gap: 6, w: 1.2, seed: 492 });
    const fl2 = [[700, -610], [640, -760], [790, -700]];
    sketchPoly(ctx, fl2, { w: 2.4, seed: 493, fill: WHITE }); hatch(ctx, fl2, { angle: -30, gap: 7, w: 1.2, seed: 494 });
    fillPoly(ctx, HOLE_FAR2, BLACK);
    hatch(ctx, SHEET_SH, { angle: 55, gap: 6, gapEnd: 11, w: 1.5, seed: 495, cross: true });
    fillPoly(ctx, SHEET, WHITE);
    stroke(ctx, SHEET.slice(1, -1), 2.8);
    hatch(ctx, [[1900, -1130], [2700, -1130], [2700, -560]], { angle: -48, gap: 12, w: 1.2, seed: 496, skip: 0.15 });
    for (let i = 0; i < 9; i++) line(ctx, 1580, -520 - i * 64, 2700, -596 - i * 64, { w: Math.max(1.1, 0.9 * px), seed: 600 + i, rough: 0.6 });
    for (const s of SCRAPS) {
      const x = s.x + Math.sin(t * 0.5 + s.ph) * 24, y = s.y + Math.cos(t * 0.37 + s.ph) * 16 + t * 2;
      const a = s.rot + Math.sin(t * 0.6 + s.ph) * 0.5, c = Math.cos(a), sn = Math.sin(a);
      const tri = [[-s.s, s.s * 0.5], [s.s, s.s * 0.2], [0.1 * s.s, -s.s * 0.8]].map((q) => [x + q[0] * c - q[1] * sn, y + q[0] * sn + q[1] * c]);
      sketchPoly(ctx, tri, { w: 1.8, seed: 497, fill: WHITE }); hatch(ctx, tri, { angle: 40, gap: 6, w: 1, seed: 498 });
    }
  },
  stage(ctx, t, { vb, px, impact }) {
    const d = ripDrop(t);
    if (d > 0) { ctx.save(); ctx.translate(1150, d); ctx.rotate(0.012 * (d / 190)); ctx.translate(-1150, 0); }
    drawBelow(ctx, t, vb, px);
    if (d > 0) ctx.restore();
    drawRip(ctx, t);
    if (t < T_H1) drawGround(ctx, FLOOR_L, FLOOR_R, vb, px, { strokes: false, depth: 14 });
    else {
      drawGround(ctx, FLOOR_L, SLAB.x0, vb, px, { strokes: false, depth: 14 });
      drawGround(ctx, SLAB.x1, FLOOR_R, vb, px, { strokes: false, depth: 14, seed: 220 });
      if (d < 4) drawSlab(ctx, t, vb, px); else drawGround(ctx, SLAB.x0, SLAB.x1, vb, px, { strokes: false, depth: 10, seed: 300 });
    }
    drawProps(ctx, t);
    drawCuts(ctx, t);
    drawSwordOutline(ctx, t, impact);
    drawDamage(ctx, t);
    drawHole(ctx, t);
    flapTop.draw(ctx, t, false);
    drawInk(ctx, t);
    drawStripGap(ctx, t);
    drawSpearHead(ctx, t);
    shards.draw(ctx, t, false);
  },
  over(ctx, t, E) {
    drawFold(ctx, t, E.st);
    const ax = E.st.weapons.find((w) => w.id === 'axe');
    if (ax) drawAxeHead(ctx, ax.tail, ax.ang, lerp(1, -1, prog(t, 9.08, 9.2)));
    shards.draw(ctx, t, true);
    flapTop.draw(ctx, t, true);
    inkDrops(ctx, t);
  },
  surface: (x) => rampH(x),
});

// ── FIGHTER A — The Technician ───────────────────────────────────────────────
// 0–4: drops in, rolls, parries the thrust, hops onto the low stab and cuts the spear in two
const A1 = [
  { t: 0, x: 700, y: 620, face: 1, hip: [0, 84], lean: 16, hF: [20, 44], hB: [-16, 40], fF: [16, 6], fB: [-20, 18] },
  ...flight(0, 0.6, [700, 620], [880, 0], 2400, [
    [0.3, { hip: [0, 84], lean: 24, hF: [24, 40], hB: [-20, 36], fF: [20, 4], fB: [-24, 20] }],
  ], { hip: [6, 46], lean: 44, bend: 10, hF: [30, -40], hB: [10, -50], fF: [34, 0], fB: [-30, 0] }),
  { t: 0.7, x: 914, p: 'ball', hip: [0, 54], spin: 75, slide: true, e: 'lin', er: 'lin' },          // over the shoulder…
  { t: 0.8, x: 952, p: 'ball', hip: [0, 70], spin: 155, slide: true, e: 'lin', er: 'lin' },        // …on his back, knees to chest…
  { t: 0.9, x: 986, p: 'ball', hip: [0, 54], spin: 255, slide: true, e: 'lin', er: 'lin' },        // …round onto his feet
  { t: 1.0, x: 1006, hip: [0, 50], lean: 34, bend: 10, hF: [30, -36], hB: [6, -46], fF: [32, 0], fB: [-30, 0], spin: 360, slide: true, e: 'lin', er: 'lin' },
  { t: 1.16, x: 1010, p: 'guard2', hip: [-4, 84], e: 'out' },
  { t: 1.4, p: 'guard2' },
  { t: 1.6, p: 'guard2', hip: [-6, 90], lean: 4 },
  { t: 1.8, p: 'guard2', hip: [-8, 86], lean: 2, hF: [36, -4] },
  { t: 1.9, hip: [-10, 88], lean: -6, hF: [34, 22], hB: [14, 0], fF: [30, 0], fB: [-32, 0], e: 'snap' },     // parries the thrust up
  { t: 1.98, same: true },
  { t: 2.14, p: 'guard2', hip: [-6, 88] },
  { t: 2.3, hip: [0, 62], lean: 20, hF: [30, -10], hB: [8, -26], fF: [30, 0], fB: [-28, 0] },
  { t: 2.34, hip: [0, 90], lean: 6, hF: [24, 30], hB: [4, 20], fF: [24, 0], fB: [-24, 0], e: 'in' },
  ...flight(2.34, 2.66, [1010, 0], [1075, 0], 4200, [
    [2.5, { hip: [0, 78], lean: 10, hF: [10, 56], hB: [-6, 48], fF: [26, 30], fB: [-18, 36] }],
  ], { hip: [4, 66], lean: 16, hF: [-6, 62], hB: [-18, 54], fFw: [1094, 14], fB: [-34, 0] }),     // lands ON the shaft
  { t: 2.8, hip: [2, 74], lean: -4, hF: [-14, 68], hB: [-24, 58], fFw: [1094, 8], fB: [-34, 0] },
  { t: 2.9, hip: [0, 78], lean: -10, hF: [-20, 70], hB: [-30, 60], fFw: [1094, 8], fB: [-34, 0] },
  { t: 2.97, hip: [10, 62], lean: 38, bend: 8, hF: [52, -34], hB: [34, -34], fFw: [1094, 6], fB: [-36, 0], e: 'in3' },  // cuts the shaft
  { t: 3.05, same: true },
  { t: 3.2, hip: [4, 76], lean: 16, hF: [44, -16], hB: [20, -30], fF: [20, 0], fB: [-34, 0] },
  { t: 3.3, hip: [-6, 86], lean: -6, hF: [30, 0], hB: [-10, -20], fF: [52, 12], fB: [-30, 0], e: 'snap' },         // flicks the spearhead away
  { t: 3.42, x: 1060, p: 'guard2' },
  { t: 3.6, p: 'guard2', hip: [-8, 88], lean: 0, hF: [30, 10] },
  { t: 3.7, hip: [-6, 88], lean: -4, hF: [40, 30], hB: [10, 10], fF: [32, 0], fB: [-30, 0], e: 'snap' },          // swats the thrown stub
  { t: 3.78, same: true },
  { t: 3.95, p: 'guard2', x: 1050 },
];
// 4–8.2: lunges into the new axe, leaps clear of the first blow, is driven to a knee, loses the sword
const A2 = [
  { t: 4.2, p: 'guard2', hip: [-10, 88], lean: -4 },
  { t: 4.45, x: 1036, p: 'guard2', hip: [-8, 90], lean: -2 },
  { t: 4.7, x: 1052, p: 'guard2', hip: [-2, 84], lean: 12 },
  { t: 4.92, hip: [-14, 82], lean: -4, hF: [10, -6], hB: [-10, -20], fF: [30, 0], fB: [-30, 0] },
  { t: 5.06, x: 1092, p: 'thrust', e: 'snap' },                                                            // lunge — swatted down
  { t: 5.14, same: true },
  { t: 5.3, x: 1050, p: 'guard2', hip: [-10, 88], lean: -6, slide: true },
  { t: 5.55, p: 'guard2', hip: [-8, 90], lean: -8, hF: [36, 6] },
  { t: 5.7, hip: [-6, 66], lean: 8, hF: [30, -10], hB: [8, -26], fF: [30, 0], fB: [-28, 0] },
  { t: 5.74, hip: [-8, 90], lean: -8, hF: [34, 10], hB: [10, 0], fF: [28, 0], fB: [-26, 0], e: 'in' },
  ...flight(5.74, 5.98, [1050, 0], [900, 0], 3400, [
    [5.86, { hip: [0, 84], lean: -10, hF: [40, 10], hB: [10, 0], fF: [30, 24], fB: [-10, 30] }],
  ], { hip: [-6, 60], lean: 20, hF: [36, -20], hB: [10, -30], fF: [34, 0], fB: [-34, 0] }),
  { t: 6.08, p: 'guard2', hip: [-4, 80] },
  { t: 6.2, x: 970, p: 'run1', hF: [0, 50], hB: [-14, 40], e: 'lin' },                                    // darts in while the axe is stuck
  { t: 6.34, x: 1075, hip: [10, 84], lean: 24, hF: [60, 18], hB: [40, 8], fF: [42, 0], fB: [-40, 0], e: 'in3' },
  { t: 6.42, same: true },
  { t: 6.52, x: 1040, hip: [-16, 80], lean: -18, hF: [30, 30], hB: [10, 20], fF: [30, 0], fB: [-40, 0], slide: true, e: 'snap' },
  { t: 6.7, x: 985, p: 'guard2', slide: true, e: 'out' },
  { t: 6.9, p: 'guard2', hip: [-8, 86], lean: -6, hF: [30, 20] },
  { t: 7.02, hip: [-6, 80], lean: -4, hF: [14, 50], hB: [-4, 44], fF: [32, 0], fB: [-30, 0], e: 'snap' },      // blade overhead: the parry
  { t: 7.1, hip: [-6, 70], lean: -4, hF: [14, 48], hB: [-4, 42], fF: [32, 0], fB: [-30, 0] },
  { t: 7.24, hip: [-4, 44], lean: 10, bend: 8, hF: [20, 30], hB: [0, 24], fF: [36, 0], fB: [-40, 0], kB: -1 },   // driven down to a knee
  { t: 7.36, hip: [-6, 46], lean: 6, hF: [22, 26], hB: [0, 20], fF: [36, 0], fB: [-40, 0], kB: -1 },
  { t: 7.52, hip: [-8, 72], lean: -4, hF: [34, 4], hB: [14, -8], fF: [34, 0], fB: [-36, 0] },
  { t: 7.62, x: 965, hip: [-22, 76], lean: -28, tilt: -30, hF: [40, 26], hB: [30, 34], fF: [34, 8], fB: [-40, 0], e: 'snap' },   // the sword shatters
  { t: 7.72, same: true },
  { t: 7.95, x: 850, p: 'stagger', slide: true, e: 'out' },
  { t: 8.16, x: 835, hip: [-8, 84], lean: 6, tilt: 22, hF: [30, -12], hB: [22, -18], fF: [28, 0], fB: [-30, 0] },   // empty hands
];
// 8.2–14.2: unarmed. Slides under a sweep, ducks behind the flap, runs up the ramp, kicks B
// in the head off the rebound, dodges the blow that wedges the axe, kicks B off it
const A3 = [
  { t: 8.4, x: 850, p: 'aStance', hip: [-10, 90], lean: -8 },
  { t: 8.64, hip: [2, 62], lean: 34, bend: 10, hF: [30, -10], hB: [8, -22], fF: [42, 0], fB: [-30, 0] },
  { t: 8.76, x: 930, hip: [-10, 32], lean: 72, tilt: -40, hF: [52, 4], hB: [-34, -6], fF: [64, 0], fB: [-36, 0], kB: -1, slide: true, e: 'in' },
  { t: 8.92, x: 1090, hip: [-10, 32], lean: 72, tilt: -40, hF: [52, 4], hB: [-34, -6], fF: [64, 0], fB: [-36, 0], kB: -1, slide: true, e: 'lin', er: 'lin' },
  { t: 9.06, x: 1200, hip: [-6, 36], lean: 60, tilt: -30, hF: [40, -10], hB: [-30, -10], fF: [60, 0], fB: [-30, 0], kB: -1, slide: true, e: 'out' },
  { t: 9.2, x: 1225, hip: [4, 74], lean: 20, hF: [20, -30], hB: [-14, -30], fF: [20, 0], fB: [-24, 0] },
  { t: 9.3, x: 1290, p: 'run1', e: 'lin' },
  { t: 9.42, x: 1400, p: 'run2', hop: 8, e: 'lin' },
  { t: 9.54, x: 1500, p: 'run1', hop: 8, e: 'lin' },
  { t: 9.66, x: 1600, face: -1, hip: [-4, 82], lean: 4, hF: [24, -16], hB: [-10, -30], fF: [24, 0], fB: [-24, 0] },   // turns behind the flap
  { t: 9.78, hip: [-2, 56], lean: 22, hFw: [1574, 84], hB: [6, -30], fF: [26, 0], fB: [-26, 0] },
  { t: 9.86, hip: [0, 40], lean: 40, bend: 12, tilt: 20, hF: [24, -20], hB: [8, -30], fF: [28, 0], fB: [-28, 0], e: 'snap' },   // the axe passes over his head
  { t: 9.96, same: true },
  { t: 10.04, x: 1612, face: 1, hip: [4, 66], lean: 30, hF: [30, -20], hB: [-30, -10], fF: [30, 0], fB: [-36, 0] },
  { t: 10.14, x: 1690, y: 62, p: 'run2', e: 'lin' },                                                          // up the ramp
  { t: 10.24, x: 1760, y: 130, p: 'run1', e: 'lin' },
  { t: 10.34, x: 1794, y: 164, face: -1, hip: [-6, 56], lean: 24, hF: [26, -30], hB: [-20, -30], fF: [26, 0], fB: [-14, 0] },   // plants on the top edge
  ...flight(10.34, 10.86, [1794, 164], [1480, 0], 1800, [
    [10.48, { hip: [0, 70], lean: 10, hF: [30, 10], hB: [-30, 20], fF: [30, 30], fB: [-30, 26] }],
    [10.6, { hip: [-6, 80], lean: -34, tilt: 20, hF: [24, -30], hB: [-50, 0], fF: [92, 58], fB: [-10, 20], e: 'snap' }],   // flying kick
    [10.68, { hip: [-6, 80], lean: -30, tilt: 20, hF: [24, -30], hB: [-50, 0], fF: [84, 56], fB: [-10, 20] }],
  ], { hip: [0, 48], lean: 30, bend: 8, hF: [24, -50], hB: [-12, -50], fF: [30, 0], fB: [-30, 0] }),
  { t: 11.02, p: 'aStance', hip: [-4, 86] },
  { t: 11.26, p: 'aStance', hip: [-8, 92], lean: -2 },
  { t: 11.46, hip: [-4, 66], lean: 14, hF: [30, -10], hB: [10, -24], fF: [30, 0], fB: [-28, 0] },
  { t: 11.57, x: 1602, hip: [-10, 88], lean: -14, hF: [36, 12], hB: [0, 10], fF: [30, 0], fB: [-26, 0], hop: 14, e: 'snap' },   // springs back
  { t: 11.72, p: 'aStance', hip: [-6, 86] },
  { t: 11.9, p: 'aStance', hip: [-2, 90], lean: 10 },
  { t: 12.04, x: 1575, hip: [6, 78], lean: 20, hF: [30, -6], hB: [-30, -10], fFw: [1470, 30], fB: [-30, 0], e: 'in' },      // one step on the shaft…
  { t: 12.1, x: 1512, y: 30, hip: [4, 84], lean: 14, hF: [30, 10], hB: [-30, 16], fFw: [1470, 30], fB: [-40, 6], e: 'lin' },
  ...flight(12.1, 12.52, [1512, 30], [1340, 0], 2600, [
    [12.28, { hip: [0, 74], lean: -20, tilt: 16, hF: [10, -20], hB: [-44, 6], fF: [84, 46], fB: [10, 16], e: 'snap' }],       // …and both feet into B
    [12.36, { hip: [0, 74], lean: -16, hF: [10, -20], hB: [-44, 6], fF: [70, 40], fB: [10, 16] }],
  ], { hip: [0, 52], lean: 26, hF: [24, -46], hB: [-12, -48], fF: [30, 0], fB: [-30, 0] }),
  { t: 12.68, x: 1352, face: 1, p: 'aStance', hip: [-4, 88] },
  { t: 12.86, x: 1375, hip: [6, 70], lean: 26, hFw: [1422, 64], hBw: [1404, 77], fF: [30, 0], fB: [-30, 0] },             // tries the axe himself
  { t: 13.0, hip: [-16, 66], lean: -8, hFw: [1422, 64], hBw: [1404, 77], fF: [30, 0], fB: [-30, 0] },
  { t: 13.14, hip: [8, 66], lean: 30, hFw: [1422, 64], hBw: [1404, 77], fF: [30, 0], fB: [-30, 0] },
  { t: 13.3, hip: [-22, 62], lean: -16, tilt: -20, hFw: [1422, 64], hBw: [1404, 77], fF: [30, 0], fB: [-30, 0] },         // it will not move
  { t: 13.46, hip: [0, 80], lean: 22, hF: [26, -50], hB: [10, -54], fF: [28, 0], fB: [-28, 0] },
  { t: 13.64, x: 1385, face: -1, p: 'aStance', hip: [-6, 90], lean: -4 },                                              // hears the tearing
  { t: T_HAMMER, p: 'aStance', hip: [-12, 88], lean: -12, hF: [34, 10], hB: [20, 0] },
  { t: 14.24, x: 1420, p: 'aStance', hip: [-6, 88], slide: true },
];
// 14.2–18.7: the hammer. Launched by the see-saw, back-handsprings clear of the blow that
// punches through the page, pulls the greatsword out of the cracks, is spun by its first swing
const A4 = [
  { t: 14.5, x: 1480, p: 'aStance', hip: [-8, 86], lean: -6 },
  { t: 14.76, x: 1550, p: 'aStance', hip: [-8, 86], lean: -6 },
  { t: 14.96, x: 1580, hip: [-4, 70], lean: 10, hF: [34, -6], hB: [14, -18], fF: [30, 0], fB: [-28, 0] },
  { t: T_H1, hip: [-4, 58], lean: 16, hF: [30, -16], hB: [10, -26], fF: [30, 0], fB: [-28, 0] },
  { t: 15.1, y: 46, hip: [0, 97], lean: -16, tilt: -22, hF: [34, 56], hB: [-30, 50], fF: [22, 0], fB: [-18, 0], e: 'lin', er: 'lin' },   // the slab end kicks up under his feet
  ...flight(15.1, 15.82, [1580, 46], [900, 0], 5000, [
    [15.26, { p: 'tuck', hF: [40, 30], hB: [-30, 40], fF: [34, 10], fB: [-30, 30], spin: -70 }],
    [15.42, { p: 'aTuck', spin: -200 }],
    [15.6, { p: 'aTuck', spin: -320 }],
    [15.72, { p: 'airFall', spin: -360 }],
  ], { p: 'landDeep', spin: -360 }),
  { t: 15.96, face: 1, x: 905, hip: [-4, 70], lean: 14, hF: [30, -10], hB: [-14, -30], fF: [28, 0], fB: [-28, 0] },
  { t: 16.16, p: 'aStance', hip: [-10, 90], lean: -8 },
  { t: 16.34, hip: [-8, 60], lean: -6, hF: [10, 30], hB: [-10, 36], fF: [28, 0], fB: [-26, 0] },                          // sinks…
  ...flight(16.36, 16.66, [905, 0], [575, 0], 3600, [
    [16.46, { hip: [0, 84], lean: -40, hF: [-30, 60], hB: [-40, 50], fF: [30, 20], fB: [10, 30], spin: -90 }],             // …back handspring
    [16.56, { hip: [0, 70], lean: -10, hF: [20, -60], hB: [0, -64], fF: [20, 40], fB: [-20, 44], spin: -230 }],
  ], { p: 'landDeep', spin: -360 }),
  { t: 16.8, x: 560, hip: [-6, 60], lean: 26, tilt: 26, hF: [30, -30], hB: [-10, -40], fF: [30, 0], fB: [-30, 0], slide: true, e: 'out' },   // heels at the torn edge; sees the outline
  { t: 16.94, x: 535, hip: [0, 80], lean: 14, tilt: 14, hF: [30, 0], hB: [10, -10], fF: [26, 0], fB: [-28, 0] },
  { t: T_GRAB, hip: [8, 76], lean: 24, hFw: [571, 147], hB: [30, 0], fF: [28, 0], fB: [-30, 0], e: 'snap' },            // both hands into the fracture
  { t: 17.22, hip: [-8, 68], lean: 2, hFw: [566, 150], hB: [30, 0], fF: [28, 0], fB: [-30, 0] },
  { t: 17.4, hip: [-22, 70], lean: -18, hFw: [540, 168], hB: [30, 0], fF: [28, 0], fB: [-34, 0] },
  { t: 17.56, hip: [-10, 64], lean: 6, hFw: [530, 172], hB: [30, 0], fF: [28, 0], fB: [-34, 0] },
  { t: 17.74, x: 520, hip: [-28, 76], lean: -30, tilt: -16, hFw: [492, 196], hB: [30, 0], fF: [30, 0], fB: [-36, 0], e: 'out' },   // it comes out
  { t: 17.9, hip: [6, 60], lean: 40, bend: 10, hF: [36, -46], hB: [20, -50], fF: [30, 0], fB: [-36, 0], e: 'in' },         // …and its weight folds him over
  { t: 18.05, x: 530, hip: [-4, 78], lean: -6, hF: [40, -6], hB: [24, -16], fF: [34, 0], fB: [-34, 0], e: 'snap' },        // wild rising heave into the hammer
  { t: 18.12, same: true },
  { t: 18.26, x: 520, hip: [-14, 84], lean: -24, hF: [-10, 60], hB: [-24, 50], fF: [30, 0], fB: [-30, 0] },                 // the sword keeps going…
  { t: 18.4, x: 492, hip: [-24, 76], lean: -34, tilt: -10, hF: [-52, 14], hB: [-56, 0], fF: [34, 0], fB: [-26, 0] },        // …and drags him to the torn edge
  { t: 18.54, x: 476, hip: [-28, 72], lean: -38, tilt: -10, hF: [-54, 6], hB: [-58, -8], fF: [40, 6], fB: [-22, 0] },
  { t: 18.66, x: 500, hip: [0, 86], lean: 0, hF: [-4, 70], hB: [-18, 58], fF: [30, 0], fB: [-30, 0] },                      // hauls it back over
  { t: 18.78, x: 540, hip: [10, 58], lean: 44, bend: 10, hF: [40, -46], hB: [22, -50], fF: [40, 0], fB: [-40, 0], e: 'in' },
];
// 18.8–28: greatsword against hammer
const A5 = [
  { t: 18.96, hip: [6, 62], lean: 38, hF: [38, -44], hB: [20, -48], fF: [40, 0], fB: [-40, 0] },
  { t: 19.14, x: 545, hip: [-14, 80], lean: -10, hF: [10, 30], hB: [-6, 16], fF: [36, 0], fB: [-36, 0] },                  // gets it onto his shoulder
  { t: 19.3, x: 550, hip: [-10, 90], lean: -14, hF: [-10, 66], hB: [-22, 54], fF: [32, 0], fB: [-34, 0] },
  { t: 19.42, x: 552, hip: [-6, 90], lean: -8, hF: [-6, 70], hB: [-18, 58], fF: [38, 6], fB: [-36, 0] },
  { t: T_C1, x: 556, hip: [10, 72], lean: 30, hF: [58, 10], hB: [40, 4], fF: [44, 0], fB: [-42, 0], e: 'in3' },            // CLASH 1
  { t: 19.64, same: true },
  { t: 19.9, x: 500, hip: [-12, 76], lean: -8, hF: [40, -10], hB: [24, -20], fF: [34, 0], fB: [-36, 0], slide: true, e: 'out' },   // heels at the torn edge
  { t: 20.0, x: 505, hip: [-2, 80], lean: 10, hF: [14, 36], hB: [0, 22], fF: [32, 0], fB: [-34, 0] },                     // heaves it onto his shoulder…
  { t: 20.12, x: 560, p: 'run1', hF: [6, 54], hB: [-8, 40], hop: 6, e: 'lin' },                                          // …and runs at B
  { t: 20.24, x: 660, p: 'run2', hF: [10, 58], hB: [-4, 46], hop: 6, e: 'lin' },
  { t: 20.34, x: 760, p: 'run1', hip: [0, 88], lean: 20, hF: [30, 64], hB: [14, 54], hop: 6, e: 'lin' },                 // point swinging down
  { t: 20.42, x: 800, hip: [8, 78], lean: 18, hFw: [833, 193], hB: [10, 50], fF: [30, 0], fB: [-34, 0], e: 'in3' },       // planted, clear of the old damage
  { t: 20.46, hip: [10, 86], lean: 22, hFw: [833, 193], hB: [10, 50], fF: [28, 0], fB: [-30, 0] },
  // swings round the planted blade: the legs lead, the body lays out feet-first past the hilt
  { t: 20.56, x: 860, y: 40, hip: [0, 80], lean: 35, hFw: [886, 215], hB: [20, 40], fF: [-10, 22], fB: [-52, 32], e: 'lin', er: 'lin' },      // hauls himself up the hilt, legs trailing
  { t: 20.66, x: 1000, y: 94, hip: [0, 80], lean: -30, curl: 0.4, bend: 8, hFw: [960, 225], hB: [10, 0], fF: [36, 70], fB: [26, 62], e: 'lin', er: 'lin' },   // tucked tight as he passes the pole…
  { t: 20.76, x: 1060, y: 94, hip: [0, 80], lean: -70, tilt: 20, hFw: [1025, 217], hB: [-20, 10], fF: [84, 90], fB: [40, 70], e: 'lin', er: 'lin' },         // …and whips out feet-first
  { t: 20.82, x: 1110, y: 80, hip: [0, 80], lean: -78, tilt: 24, hFw: [1052, 209], hB: [-24, 6], fF: [100, 70], fB: [34, 62], e: 'in', er: 'lin' },   // heel into B's head
  { t: 20.9, same: true, y: 80 },
  { t: 21.0, x: 1145, hip: [0, 60], lean: 14, hFw: [1151, 146], hB: [-20, 20], fF: [34, 0], fB: [-30, 0], e: 'in', er: 'in' },
  { t: 21.08, x: 1160, hip: [10, 82], lean: 20, hF: [-40, 50], hB: [-50, 36], fF: [36, 0], fB: [-34, 0] },                // rips it out behind him…
  { t: 21.18, x: 1180, hip: [4, 90], lean: 0, hF: [-6, 72], hB: [-20, 60], fF: [36, 0], fB: [-36, 0] },
  { t: 21.3, x: 1200, hip: [14, 72], lean: 32, hF: [58, 14], hB: [40, 6], fF: [44, 0], fB: [-42, 0], e: 'in3' },          // …into an overhead cut
  { t: 21.38, same: true },
  { t: 21.5, x: 1100, hip: [-12, 70], lean: -8, hF: [44, -34], hB: [26, -40], fF: [40, 0], fB: [-30, 0], slide: true, e: 'out' },   // B shoves him off — he lets the blade's weight take him round
  { t: 21.62, x: 1015, face: -1, hip: [0, 76], lean: 10, hF: [50, -20], hB: [30, -30], fF: [30, 0], fB: [-30, 0], slide: true },
  { t: 21.75, x: 1008, hip: [-8, 86], lean: -10, hF: [-10, 64], hB: [-24, 52], fF: [28, 0], fB: [-30, 0] },
  { t: 21.88, x: 1015, face: 1, hip: [14, 74], lean: 30, hF: [66, 0], hB: [46, -6], fF: [44, 0], fB: [-42, 0], e: 'in3' },  // spinning cut
  { t: 21.96, same: true },
  { t: 22.16, x: 955, hip: [-8, 78], lean: 2, hF: [36, -20], hB: [20, -30], fF: [32, 0], fB: [-34, 0], slide: true, e: 'out' },
  { t: 22.4, x: 880, hip: [-10, 86], lean: -10, hF: [-4, 64], hB: [-18, 52], fF: [32, 0], fB: [-34, 0] },
  { t: 22.62, hip: [-18, 80], lean: -22, hF: [-50, 20], hB: [-56, 6], fF: [36, 0], fB: [-32, 0] },                          // blade hanging behind him
  { t: 22.86, hip: [-20, 78], lean: -24, hF: [-52, 24], hB: [-58, 10], fF: [38, 8], fB: [-32, 0] },
  { t: T_C2, x: 885, hip: [12, 74], lean: 30, hF: [60, 10], hB: [42, 2], fF: [44, 0], fB: [-42, 0], e: 'in3' },            // CLASH 2
  { t: 23.14, same: true },
  { t: 23.26, x: 850, hip: [-10, 86], lean: -16, hF: [-6, 68], hB: [-20, 56], fF: [30, 0], fB: [-34, 0] },                 // the rebound throws the sword back over his shoulder
  { t: 23.4, x: 800, hip: [-20, 82], lean: -24, hF: [-22, 62], hB: [-36, 50], fF: [36, 0], fB: [-30, 0] },
  { t: 23.52, x: 770, hip: [-22, 80], lean: -26, hF: [-24, 60], hB: [-38, 48], fF: [38, 0], fB: [-28, 0] },
  { t: 23.66, x: 775, hip: [10, 58], lean: 44, bend: 10, hF: [40, -46], hB: [22, -50], fF: [40, 0], fB: [-40, 0], e: 'in' },   // …and it drops, folding him over it
  { t: 23.85, hip: [8, 54], lean: 48, bend: 12, hF: [40, -44], hB: [22, -48], fF: [40, 0], fB: [-40, 0] },                  // heaving
  { t: 24.05, hip: [8, 59], lean: 43, bend: 9, hF: [40, -46], hB: [22, -50], fF: [40, 0], fB: [-40, 0] },
  { t: 24.3, hip: [-10, 84], lean: -8, hF: [24, 20], hB: [8, 6], fF: [34, 0], fB: [-34, 0] },                               // up it comes
  { t: 24.5, hip: [-4, 84], lean: 8, hF: [34, 10], hB: [16, -6], fF: [34, 0], fB: [-32, 0] },
  { t: 24.7, hip: [-12, 76], lean: 0, hF: [26, 14], hB: [8, 0], fF: [34, 0], fB: [-34, 0] },
  { t: 24.84, x: 800, p: 'run1', hF: [20, 30], hB: [4, 16], hop: 8, e: 'lin' },                                          // the charge
  { t: 24.98, x: 835, p: 'run2', hF: [14, 40], hB: [0, 26], hop: 8, e: 'lin' },
  { t: 25.12, x: 866, p: 'run1', hF: [6, 54], hB: [-8, 40], hop: 8, e: 'lin' },
  { t: 25.26, x: 890, hip: [-10, 86], lean: -12, hF: [-14, 66], hB: [-26, 54], fF: [40, 0], fB: [-36, 0] },
  { t: 25.5, x: 900, hip: [-16, 90], lean: -20, hF: [-24, 70], hB: [-36, 58], fF: [40, 0], fB: [-38, 0] },
  { t: 25.74, x: 905, hip: [-18, 92], lean: -24, hF: [-28, 70], hB: [-40, 58], fF: [42, 12], fB: [-38, 0] },
  { t: T_FINAL, x: 920, hip: [12, 72], lean: 32, hF: [58, 14], hB: [40, 6], fF: [46, 0], fB: [-44, 0], e: 'in3' },         // THE LAST CLASH
  { t: 26.12, same: true },
  { t: 26.45, hip: [16, 68], lean: 36, hF: [56, 16], hB: [38, 8], fF: [46, 0], fB: [-44, 0] },                              // locked, straining
  { t: 26.85, hip: [10, 72], lean: 30, hF: [58, 12], hB: [40, 4], fF: [46, 0], fB: [-44, 0] },
  { t: 27.25, hip: [16, 68], lean: 36, hF: [56, 16], hB: [38, 8], fF: [46, 0], fB: [-44, 0] },
  { t: 27.65, hip: [12, 70], lean: 32, hF: [58, 13], hB: [40, 5], fF: [46, 0], fB: [-44, 0] },
  { t: 28.05, hip: [17, 67], lean: 37, hF: [56, 16], hB: [38, 8], fF: [46, 0], fB: [-44, 0] },
];
const A_KEYS = [...A1, ...A2, ...A3, ...A4, ...A5];

// ── FIGHTER B — The Powerhouse ───────────────────────────────────────────────
const B1 = [
  { t: 0, x: 1470, y: 900, face: -1, hip: [0, 80], lean: 20, hF: [30, 30], hB: [-20, 40], fF: [30, 10], fB: [-30, 20] },
  ...flight(0, T_CRATER, [1470, 900], [1400, 0], 2400, [
    [0.5, { hip: [0, 78], lean: 30, hF: [36, 40], hB: [-10, 50], fF: [40, 14], fB: [-36, 24] }],
  ], { hip: [8, 44], lean: 52, bend: 14, tilt: -10, hF: [34, -56], hB: [-6, -58], fF: [52, 0], fB: [-52, 0], kB: -1, e: 'in' }),
  { t: 0.98, hip: [8, 40], lean: 54, bend: 15, tilt: -10, hF: [34, -52], hB: [-6, -54], fF: [52, 0], fB: [-52, 0], kB: -1 },
  { t: 1.25, hip: [4, 62], lean: 36, tilt: -24, hF: [36, -40], hB: [-10, -46], fF: [52, 0], fB: [-52, 0] },
  { t: 1.5, p: 'bStance', hip: [0, 82], lean: 20, hF: [44, -26], hB: [-14, -34], fF: [50, 0], fB: [-50, 0] },
  { t: 1.72, hip: [-18, 76], lean: 6, hF: [12, -22], hB: [-40, -28], fF: [50, 0], fB: [-50, 0] },
  { t: 1.9, x: 1330, hip: [18, 76], lean: 34, hF: [76, -10], hB: [22, -24], fF: [60, 0], fB: [-58, 0], e: 'snap' },    // thrust
  { t: 1.98, same: true },
  { t: 2.14, x: 1345, p: 'bStance', hF: [40, -26], hB: [-14, -34] },
  { t: 2.3, hip: [-14, 66], lean: 20, hF: [6, -40], hB: [-44, -40], fF: [50, 0], fB: [-50, 0] },
  { t: 2.42, x: 1330, hip: [20, 60], lean: 44, bend: 8, hF: [50, -58], hB: [-4, -50], fF: [60, 0], fB: [-56, 0], e: 'snap' },  // low stab
  { t: 2.6, same: true },
  { t: 2.7, hip: [14, 58], lean: 40, hF: [50, -62], hB: [-4, -54], fF: [60, 0], fB: [-56, 0] },                    // the shaft is stomped down
  { t: 2.84, hip: [-6, 64], lean: 22, hF: [58, -56], hB: [6, -50], fF: [60, 0], fB: [-56, 0] },                     // tugs
  { t: 2.96, hip: [-12, 66], lean: 16, hF: [60, -54], hB: [8, -48], fF: [60, 0], fB: [-56, 0] },
  { t: 3.1, x: 1380, hip: [-24, 78], lean: -22, tilt: -20, hF: [30, 10], hB: [-20, 0], fF: [36, 8], fB: [-50, 0], e: 'out' },   // it gives: he reels
  { t: 3.28, x: 1410, p: 'bStance', hip: [-8, 80], lean: 8, hF: [30, -10], hB: [-10, -30] },
  { t: 3.42, hip: [-20, 80], lean: -12, hF: [-40, 36], hB: [20, -20], fF: [46, 0], fB: [-46, 0] },
  { t: 3.54, hip: [14, 76], lean: 34, hF: [74, 6], hB: [-30, -20], fF: [50, 0], fB: [-50, 0], e: 'snap' },         // hurls the stub
  { t: 3.7, x: 1370, hip: [4, 74], lean: 26, hF: [30, -40], hB: [-10, -40], fF: [50, 0], fB: [-50, 0] },
];
// 3.7–8.1: rips a strip of the page up, folds it into an axe, three blows
const B2 = [
  { t: 3.78, x: 1350, hip: [12, 50], lean: 56, bend: 12, hFw: [1296, 10], hBw: [1276, 10], fF: [50, 0], fB: [-50, 0] },
  { t: T_RIP0, hip: [14, 46], lean: 60, bend: 14, hFw: [1296, 4], hBw: [1276, 4], fF: [50, 0], fB: [-50, 0] },
  { t: 3.98, hip: [4, 60], lean: 30, hFw: [1300, 96], hBw: [1284, 76], fF: [50, 0], fB: [-50, 0], e: 'in' },
  { t: 4.1, hip: [-10, 80], lean: 0, hFw: [1316, 196], hBw: [1306, 170], fF: [50, 0], fB: [-50, 0], e: 'lin' },
  { t: T_RIP1, hip: [-20, 84], lean: -16, tilt: -10, hF: [8, 74], hB: [-8, 60], fF: [50, 0], fB: [-50, 0], e: 'out' },   // it tears free
  { t: 4.3, p: 'bStance', hip: [0, 80], lean: 12, hFw: FOLD_G, hBw: [1326, 150], fF: [50, 0], fB: [-50, 0] },      // stands the strip in front of him
  { t: 4.38, hip: [4, 76], lean: 18, hFw: FOLD_G, hBw: [1298, 143], fF: [50, 0], fB: [-50, 0], e: 'in' },            // fold one: sweeps the back edge over
  { t: 4.5, hip: [0, 80], lean: 12, hFw: FOLD_G, hBw: [1285, 116], fF: [50, 0], fB: [-50, 0] },
  { t: 4.6, hip: [4, 76], lean: 18, hFw: FOLD_G, hBw: [1309, 126], fF: [50, 0], fB: [-50, 0], e: 'in' },             // fold two: the front edge back over the handle
  { t: 4.72, hip: [2, 84], lean: 16, hFw: FOLD_G, hBw: [1272, 224], fF: [50, 0], fB: [-50, 0] },                     // takes the top end…
  { t: 4.82, hip: [6, 76], lean: 22, hFw: FOLD_G, hBw: [1250, 166], fF: [50, 0], fB: [-50, 0], e: 'in' },            // fold three: …and turns it down across: the blade
  { t: 4.92, hip: [-4, 82], lean: 8, hF: [30, 10], hB: [10, -20], fF: [50, 0], fB: [-50, 0] },
  { t: T_AXE, p: 'heavyRest', hip: [-4, 84], lean: 6, hF: [34, 4], hB: [-2, -26], fF: [50, 0], fB: [-50, 0] },
  { t: 5.06, hip: [-8, 80], lean: 4, hF: [44, -10], hB: [10, -36], fF: [50, 0], fB: [-50, 0], e: 'snap' },         // swats the lunge aside
  { t: 5.14, same: true },
  { t: 5.3, p: 'heavyWind', hip: [-14, 80], lean: -6, hF: [-10, 40], hB: [-30, 30], fF: [50, 0], fB: [-50, 0] },   // the long wind-up
  { t: 5.5, p: 'heavyWind', hip: [-26, 76], lean: -20, hF: [-46, 34], hB: [-56, 16], fF: [50, 0], fB: [-50, 0] },
  { t: 5.72, p: 'heavyWind', hip: [-30, 72], lean: -24, hF: [-50, 40], hB: [-60, 22], fF: [40, 12], fB: [-50, 0] },
  { t: T_AXE1, x: 1280, p: 'heavyEnd', e: 'in' },                                                         // buries it
  { t: 5.94, same: true },
  { t: 6.1, hip: [18, 60], lean: 46, bend: 12, hF: [50, -46], hB: [30, -46], fF: [52, 0], fB: [-54, 0] },          // heaves
  { t: 6.24, hip: [-2, 70], lean: 22, hF: [54, -42], hB: [32, -42], fF: [52, 0], fB: [-54, 0] },
  { t: 6.34, hip: [-14, 82], lean: -4, hF: [30, 12], hB: [6, -10], fF: [52, 0], fB: [-54, 0], e: 'snap' },         // rips it free into a block
  { t: 6.42, same: true },
  { t: 6.52, hip: [8, 80], lean: 20, hF: [60, 12], hB: [30, -8], fF: [52, 0], fB: [-54, 0], e: 'snap' },           // shoves
  { t: 6.64, p: 'heavyWind', hip: [-10, 82], lean: -8, hF: [-4, 56], hB: [-20, 44], fF: [52, 0], fB: [-54, 0] },
  { t: 6.82, hip: [-20, 84], lean: -18, hF: [-30, 66], hB: [-44, 52], fF: [46, 0], fB: [-50, 0] },
  { t: 6.94, hip: [-22, 88], lean: -20, hF: [-32, 70], hB: [-46, 56], fF: [44, 8], fB: [-50, 0] },
  { t: 7.02, x: 1230, hip: [14, 70], lean: 34, hF: [60, 12], hB: [40, 8], fF: [52, 0], fB: [-54, 0], e: 'in3' },   // overhead chop onto the parry
  { t: 7.1, same: true },
  { t: 7.24, hip: [20, 60], lean: 46, hF: [58, -22], hB: [38, -24], fF: [52, 0], fB: [-54, 0] },                   // grinds him down
  { t: 7.36, hip: [4, 74], lean: 20, hF: [30, 10], hB: [10, 0], fF: [52, 0], fB: [-54, 0] },
  { t: 7.52, hip: [-20, 80], lean: -14, hF: [-48, 20], hB: [-58, 4], fF: [46, 0], fB: [-50, 0] },
  { t: T_SHATTER, hip: [18, 72], lean: 30, hF: [70, -6], hB: [46, -8], fF: [54, 0], fB: [-56, 0], e: 'in3' },      // sideways blow: the blade breaks
  { t: 7.72, same: true },
  { t: 7.92, hip: [24, 62], lean: 46, hF: [30, -50], hB: [10, -52], fF: [54, 0], fB: [-56, 0] },
  { t: 8.12, p: 'heavyRest' },
];
// 8.1–14.2: three missed swings, the wedged axe, the hammer
const B3 = [
  { t: 8.3, x: 1175, p: 'heavyRest', hip: [0, 80], lean: 12 },
  { t: 8.5, x: 1110, hip: [-22, 78], lean: -16, hF: [-46, 18], hB: [-56, 2], fF: [46, 0], fB: [-46, 0] },
  { t: 8.66, hip: [-28, 76], lean: -20, hF: [-50, 22], hB: [-60, 6], fF: [40, 8], fB: [-48, 0] },
  { t: 8.78, x: 1050, hip: [18, 74], lean: 30, hF: [70, -4], hB: [46, -6], fF: [54, 0], fB: [-56, 0], e: 'in3' },       // waist-high sweep — nothing there
  { t: 8.9, hip: [26, 66], lean: 44, hF: [44, -40], hB: [24, -44], fF: [54, 0], fB: [-56, 0] },
  { t: 9.04, hip: [16, 68], lean: 34, hF: [40, -30], hB: [18, -36], fF: [54, 0], fB: [-56, 0] },
  { t: 9.18, x: 1060, face: 1, hip: [0, 80], lean: 6, hF: [-30, 20], hB: [-44, 4], fF: [30, 0], fB: [-34, 0] },      // dragged round after it
  { t: 9.32, p: 'heavyRest', hip: [0, 80], lean: 14, hF: [30, -6], hB: [0, -30], fF: [44, 0], fB: [-44, 0] },
  { t: 9.44, x: 1140, p: 'bRun2', hF: [30, -6], hB: [0, -26], hop: 10, e: 'lin' },
  { t: 9.58, x: 1220, p: 'bRun1', hF: [10, 10], hB: [-20, 0], hop: 10, e: 'lin' },
  { t: 9.7, x: 1270, hip: [-18, 78], lean: -12, hF: [-44, 26], hB: [-54, 10], fF: [50, 0], fB: [-48, 0] },
  { t: 9.78, x: 1284, hip: [-24, 76], lean: -18, hF: [-48, 30], hB: [-58, 14], fF: [46, 8], fB: [-50, 0] },
  { t: T_FLAPCUT, x: 1300, hip: [18, 72], lean: 30, hF: [70, -6], hB: [46, -8], fF: [54, 0], fB: [-56, 0], e: 'in' },   // shears the flap
  { t: 9.94, same: true },
  { t: 10.08, hip: [24, 64], lean: 44, hF: [44, -40], hB: [24, -42], fF: [54, 0], fB: [-56, 0] },
  { t: 10.26, x: 1330, p: 'heavyRest', hip: [0, 82], lean: 4, tilt: -20, hF: [26, -4], hB: [0, -28] },
  { t: 10.4, x: 1470, hip: [4, 84], lean: 10, tilt: -26, hF: [20, 30], hB: [-4, 10], fF: [50, 0], fB: [-48, 0] },
  { t: 10.57, x: 1575, hip: [-6, 88], lean: -6, tilt: -30, hF: [-10, 62], hB: [-26, 48], fF: [48, 0], fB: [-48, 0] },   // axe going up — too late
  { t: 10.63, x: 1560, hip: [-20, 74], lean: -30, tilt: -34, hF: [30, 50], hB: [10, 40], fF: [34, 10], fB: [-40, 0], e: 'snap' },
  { t: 10.7, same: true },
  { t: 10.9, x: 1330, p: 'stagger', hF: [20, 30], hB: [-10, 20], slide: true, e: 'out' },
  { t: 11.08, x: 1290, p: 'heavyRest', hip: [0, 74], lean: 24, tilt: -10 },
  { t: 11.28, p: 'heavyWind', hip: [-16, 80], lean: -8, hF: [-10, 56], hB: [-28, 44], fF: [48, 0], fB: [-48, 0] },
  { t: 11.47, hip: [-24, 86], lean: -20, hF: [-34, 68], hB: [-48, 54], fF: [42, 10], fB: [-50, 0] },
  { t: T_WEDGE, x: 1295, p: 'heavyEnd', e: 'in' },                                                              // overhead — buried to the eye in the fold
  { t: 11.67, same: true },
  { t: 11.8, hip: [-10, 70], lean: 14, hFw: [1427, 61], hB: [30, -44], fF: [52, 0], fB: [-54, 0] },                     // heaves…
  { t: 11.92, hip: [20, 58], lean: 48, hFw: [1427, 61], hB: [30, -44], fF: [52, 0], fB: [-54, 0] },
  { t: 12.06, hip: [-16, 74], lean: 6, hFw: [1427, 61], hB: [30, -44], fF: [52, 0], fB: [-54, 0] },                     // …heaves
  { t: 12.2, hip: [16, 60], lean: 44, tilt: -30, hFw: [1427, 61], hB: [30, -44], fF: [52, 0], fB: [-54, 0] },
  { t: 12.24, hip: [14, 62], lean: 40, tilt: -34, hF: [50, -30], hB: [30, -40], fF: [52, 0], fB: [-54, 0] },
  { t: 12.3, x: 1280, p: 'hitBack', e: 'snap' },
  { t: 12.38, same: true },
  { t: 12.56, x: 1120, p: 'flyBack', hip: [-10, 60], lean: -30, hF: [40, 30], hB: [30, 40], fF: [50, 20], fB: [-20, 0], slide: true, e: 'out' },
  { t: 12.8, x: 1020, p: 'kneel', hip: [0, 50], slide: true, e: 'out' },
  { t: 13.0, x: 1010, face: -1, hip: [0, 78], lean: 16, hF: [24, -30], hB: [-10, -40], fF: [40, 0], fB: [-40, 0] },     // sees the folded block
  { t: 13.12, x: 930, p: 'bRun1', hop: 10, e: 'lin' },
  { t: 13.24, x: 830, p: 'bRun2', hop: 10, e: 'lin' },
  { t: 13.36, x: 730, p: 'bRun1', hop: 10, e: 'lin' },
  { t: 13.46, x: 660, hip: [8, 80], lean: 26, hFw: [560, 150], hB: [50, -10], fF: [46, 0], fB: [-46, 0] },             // both hands on the shaft
  { t: 13.6, hip: [-14, 76], lean: 0, hFw: [560, 150], hB: [50, -10], fF: [46, 0], fB: [-46, 0] },
  { t: 13.72, hip: [10, 68], lean: 30, hFw: [560, 150], hB: [50, -10], fF: [46, 0], fB: [-46, 0] },
  { t: 13.82, hip: [-22, 72], lean: -10, hFw: [566, 156], hB: [50, -10], fF: [46, 0], fB: [-46, 0] },
  { t: T_HAMMER, hip: [-28, 82], lean: -24, tilt: -16, hF: [10, 60], hB: [-10, 44], fF: [44, 0], fB: [-48, 0], e: 'snap' },   // tears it loose
  { t: 14.04, hip: [-20, 78], lean: -16, hF: [-10, 50], hB: [-30, 34], fF: [44, 0], fB: [-48, 0] },
  { t: 14.24, x: 670, face: 1, p: 'heavyRest', hip: [0, 80], lean: 12, hF: [-6, 30], hB: [-30, 10] },
];
// 14.2–18.7: hammer blows like artillery
const B4 = [
  { t: 14.4, x: 740, p: 'bRun2', hF: [-6, 30], hB: [-30, 10], hop: 10, e: 'lin' },
  { t: 14.52, x: 820, p: 'bRun1', hF: [-6, 30], hB: [-30, 10], hop: 10, e: 'lin' },
  { t: 14.64, x: 900, p: 'bRun2', hF: [-6, 30], hB: [-30, 10], hop: 10, e: 'lin' },
  { t: 14.76, x: 975, p: 'bRun1', hF: [-10, 44], hB: [-30, 26], hop: 10, e: 'lin' },
  { t: 14.86, x: 1012, hip: [-16, 82], lean: -10, hF: [-20, 60], hB: [-38, 46], fF: [48, 0], fB: [-48, 0] },
  { t: 14.97, x: 1024, hip: [-24, 88], lean: -22, hF: [-36, 70], hB: [-50, 56], fF: [40, 14], fB: [-50, 0] },
  { t: T_H1, x: 1045, p: 'heavyEnd', e: 'in3' },                                                                // blow one: the layer see-saws
  { t: 15.17, same: true },
  { t: 15.4, hip: [14, 62], lean: 40, tilt: -30, hF: [52, -40], hB: [32, -40], fF: [52, 0], fB: [-54, 0] },             // watches A go over
  { t: 15.62, hip: [-6, 78], lean: 6, tilt: -34, hF: [30, 0], hB: [10, -10], fF: [50, 0], fB: [-50, 0] },
  { t: 15.86, x: 1070, face: -1, hip: [0, 80], lean: 10, hF: [20, 10], hB: [-10, 0], fF: [44, 0], fB: [-44, 0] },
  { t: 16.06, x: 1100, p: 'heavyWind', hip: [-14, 82], lean: -8, hF: [-10, 56], hB: [-28, 44], fF: [48, 0], fB: [-48, 0] },
  { t: 16.26, hip: [-22, 86], lean: -18, hF: [-32, 68], hB: [-46, 54], fF: [46, 0], fB: [-50, 0] },
  { t: 16.4, x: 1110, hip: [-26, 88], lean: -22, hF: [-36, 70], hB: [-50, 56], fF: [40, 14], fB: [-50, 0] },
  { t: T_H2, x: 1122, p: 'heavyEnd', hip: [24, 54], e: 'in' },                                                 // blow two: straight through the page
  { t: 16.64, same: true },
  { t: 16.82, hip: [-4, 66], lean: 24, hFw: [990, 56], hB: [30, -44], fF: [52, 0], fB: [-54, 0] },                      // wrenches it out of the hole
  { t: 16.98, hip: [20, 56], lean: 48, hFw: [990, 56], hB: [30, -44], fF: [52, 0], fB: [-54, 0] },
  { t: 17.16, hip: [-18, 80], lean: -8, hF: [34, 8], hB: [8, -12], fF: [50, 0], fB: [-52, 0], e: 'out' },
  { t: 17.36, x: 1060, p: 'heavyRest', hip: [0, 80], lean: 14, hF: [30, 0], hB: [0, -24] },
  { t: 17.56, x: 990, hip: [-10, 80], lean: 0, hF: [0, 10], hB: [-30, -4], fF: [48, 0], fB: [-48, 0] },
  { t: 17.76, hip: [-24, 78], lean: -16, hF: [-46, 20], hB: [-56, 4], fF: [46, 0], fB: [-48, 0] },                      // sideways wind-up
  { t: 17.95, hip: [-30, 76], lean: -22, hF: [-50, 24], hB: [-60, 8], fF: [38, 10], fB: [-50, 0] },
  { t: 18.05, x: 960, hip: [18, 74], lean: 30, hF: [70, -4], hB: [46, -6], fF: [54, 0], fB: [-56, 0], e: 'in3' },       // …met by the greatsword
  { t: 18.12, same: true },
  { t: 18.3, x: 1000, hip: [-20, 78], lean: -20, tilt: -16, hF: [30, 40], hB: [10, 30], fF: [36, 0], fB: [-50, 0], slide: true, e: 'out' },
  { t: 18.5, x: 1030, p: 'heavyRest', hip: [-4, 80], lean: 8 },
  { t: 18.7, x: 1040, p: 'heavyRest', hip: [0, 78], lean: 16 },
];
const B5 = [
  { t: 18.9, x: 1040, p: 'heavyRest', hip: [0, 78], lean: 14 },
  { t: 19.1, x: 1030, p: 'heavyWind', hip: [-14, 82], lean: -8, hF: [-10, 56], hB: [-28, 44], fF: [48, 0], fB: [-48, 0] },
  { t: 19.3, x: 1025, hip: [-24, 86], lean: -20, hF: [-34, 68], hB: [-48, 54], fF: [46, 0], fB: [-50, 0] },              // hammer all the way back
  { t: 19.42, hip: [-26, 88], lean: -22, hF: [-36, 70], hB: [-50, 56], fF: [40, 12], fB: [-50, 0] },
  { t: T_C1, x: 1010, hip: [14, 80], lean: 24, hF: [62, 16], hB: [40, -4], fF: [52, 0], fB: [-52, 0], e: 'in3' },         // rising swing: CLASH 1
  { t: 19.64, same: true },
  { t: 19.9, x: 1180, hip: [-16, 78], lean: -10, hF: [30, 20], hB: [10, 6], fF: [44, 0], fB: [-50, 0], slide: true, e: 'out' },
  { t: 20.05, x: 1260, p: 'heavyWind', hip: [-14, 82], lean: -8, hF: [-10, 56], hB: [-28, 44], fF: [48, 0], fB: [-48, 0], slide: true, e: 'lin' },   // still skidding — the rebound hauls the hammer up and back
  { t: 20.25, x: 1310, hip: [-22, 86], lean: -18, hF: [-32, 68], hB: [-46, 54], fF: [48, 0], fB: [-50, 0], slide: true, e: 'out' },
  { t: 20.45, x: 1318, hip: [-26, 88], lean: -22, hF: [-36, 70], hB: [-50, 56], fF: [40, 14], fB: [-50, 0] },
  { t: T_B3, x: 1307, p: 'heavyEnd', e: 'in' },                                                                  // blow three — just past the planted blade, under A's swing
  { t: 20.74, same: true },
  { t: 20.82, x: 1325, hip: [-22, 70], lean: -32, tilt: -34, hF: [50, -20], hB: [40, -30], fF: [34, 10], fB: [-40, 0], e: 'snap' },
  { t: 20.9, same: true },
  { t: 21.04, x: 1400, p: 'stagger', hF: [30, 0], hB: [10, -20], slide: true, e: 'out' },
  { t: 21.18, x: 1405, hip: [-8, 82], lean: -4, hF: [36, 14], hB: [30, -30], fF: [46, 0], fB: [-48, 0] },                  // shaft up
  { t: 21.3, x: 1410, hip: [-14, 68], lean: -10, hF: [36, 18], hB: [30, -26], fF: [46, 0], fB: [-50, 0], e: 'snap' },     // takes the overhead cut on it
  { t: 21.38, same: true },
  { t: 21.48, x: 1388, hip: [16, 78], lean: 26, hF: [64, 22], hB: [54, -22], fF: [52, 0], fB: [-52, 0], e: 'snap' },      // …and heaves him off
  { t: 21.62, x: 1340, hip: [4, 80], lean: 12, hF: [44, 10], hB: [34, -30], fF: [48, 0], fB: [-50, 0] },
  { t: 21.76, x: 1295, hip: [-6, 80], lean: 6, hF: [40, 0], hB: [30, -30], fF: [46, 0], fB: [-48, 0] },                    // steps in after him
  { t: 21.88, x: 1290, hip: [-20, 74], lean: -20, tilt: -16, hF: [30, 30], hB: [20, -10], fF: [36, 0], fB: [-50, 0], e: 'snap' },
  { t: 21.96, same: true },
  { t: 22.2, x: 1400, p: 'stagger', hF: [30, 10], hB: [10, -10], slide: true, e: 'out' },
  { t: 22.4, x: 1410, p: 'heavyRest', hip: [0, 74], lean: 22 },
  { t: 22.6, hip: [-24, 78], lean: -16, hF: [-46, 20], hB: [-56, 4], fF: [46, 0], fB: [-48, 0] },                          // sideways wind-up
  { t: 22.86, x: 1385, hip: [-30, 76], lean: -22, hF: [-50, 24], hB: [-60, 8], fF: [38, 10], fB: [-50, 0] },
  { t: T_C2, x: 1360, hip: [18, 74], lean: 30, hF: [70, 0], hB: [46, -4], fF: [54, 0], fB: [-56, 0], e: 'in3' },          // CLASH 2
  { t: 23.14, same: true },
  { t: 23.28, x: 1400, hip: [-12, 84], lean: -14, hF: [0, 60], hB: [-20, 46], fF: [40, 0], fB: [-50, 0] },                 // the hammer rebounds and hauls him round
  { t: 23.42, x: 1430, hip: [-26, 76], lean: -30, hF: [-50, 20], hB: [-58, 6], fF: [40, 0], fB: [-50, 0], slide: true, e: 'lin' },
  { t: 23.58, x: 1450, hip: [-24, 64], lean: -20, hF: [-52, -20], hB: [-60, -34], fF: [46, 0], fB: [-44, 0], slide: true, e: 'out' },
  { t: 23.85, x: 1454, hip: [-8, 68], lean: 20, hF: [-30, -40], hB: [-44, -48], fF: [46, 0], fB: [-46, 0] },                // heaving
  { t: 24.1, hip: [-10, 72], lean: 14, hF: [-32, -36], hB: [-46, -44], fF: [46, 0], fB: [-46, 0] },
  { t: 24.4, hip: [-12, 82], lean: -4, hF: [-20, 30], hB: [-40, 14], fF: [46, 0], fB: [-46, 0] },                           // onto the shoulder
  { t: 24.7, hip: [-16, 76], lean: 4, hF: [-16, 34], hB: [-36, 18], fF: [46, 0], fB: [-46, 0] },
  { t: 24.84, x: 1420, p: 'bRun1', hF: [-10, 40], hB: [-30, 24], hop: 10, e: 'lin' },
  { t: 24.98, x: 1396, p: 'bRun2', hF: [-10, 44], hB: [-30, 28], hop: 10, e: 'lin' },
  { t: 25.12, x: 1372, p: 'bRun1', hF: [-14, 50], hB: [-34, 34], hop: 10, e: 'lin' },
  { t: 25.26, x: 1352, hip: [-16, 82], lean: -10, hF: [-20, 60], hB: [-38, 46], fF: [48, 0], fB: [-48, 0] },
  { t: 25.5, x: 1346, hip: [-24, 88], lean: -22, hF: [-36, 70], hB: [-50, 56], fF: [46, 0], fB: [-50, 0] },
  { t: 25.74, x: 1343, hip: [-26, 90], lean: -24, hF: [-38, 70], hB: [-52, 56], fF: [40, 14], fB: [-50, 0] },
  { t: T_FINAL, x: 1330, hip: [14, 74], lean: 30, hF: [60, 16], hB: [40, 2], fF: [54, 0], fB: [-54, 0], e: 'in3' },       // THE LAST CLASH
  { t: 26.12, same: true },
  { t: 26.45, hip: [10, 76], lean: 26, hF: [60, 14], hB: [40, 0], fF: [54, 0], fB: [-54, 0] },
  { t: 26.85, hip: [16, 72], lean: 32, hF: [58, 18], hB: [38, 4], fF: [54, 0], fB: [-54, 0] },
  { t: 27.25, hip: [11, 75], lean: 27, hF: [60, 14], hB: [40, 0], fF: [54, 0], fB: [-54, 0] },
  { t: 27.65, hip: [16, 72], lean: 32, hF: [58, 18], hB: [38, 4], fF: [54, 0], fB: [-54, 0] },
  { t: 28.05, hip: [12, 74], lean: 28, hF: [60, 15], hB: [40, 1], fF: [54, 0], fB: [-54, 0] },
];
const B_KEYS = [...B1, ...B2, ...B3, ...B4, ...B5];

S.fighters({ A: A_KEYS, B: B_KEYS });

// ── weapons ──────────────────────────────────────────────────────────────────
S.weapon('sword', [
  { t: 0, type: 'longsword', by: 'A', ang: 64, g: 0.1, two: 0 },
  { t: 0.6, by: 'A', ang: 25 },
  { t: 0.7, by: 'A', ang: 66, e: 'lin' },
  { t: 0.8, by: 'A', ang: 100, e: 'lin' },
  { t: 0.9, by: 'A', ang: 62, e: 'lin' },
  { t: 1.0, by: 'A', ang: 35, e: 'lin' },
  { t: 1.16, by: 'A', ang: 55, two: 1 },
  { t: 1.8, by: 'A', ang: 50 },
  { t: 1.9, by: 'A', ang: 112, e: 'snap' },
  { t: 1.98, by: 'A', ang: 112 },
  { t: 2.14, by: 'A', ang: 55 },
  { t: 2.3, by: 'A', ang: 40 },
  { t: 2.5, by: 'A', ang: 100 },
  { t: 2.66, by: 'A', ang: 118 },
  { t: 2.9, by: 'A', ang: 138 },
  { t: 2.97, by: 'A', ang: -48, e: 'in3' },
  { t: 3.05, by: 'A', ang: -48 },
  { t: 3.2, by: 'A', ang: 20 },
  { t: 3.42, by: 'A', ang: 55 },
  { t: 3.6, by: 'A', ang: 70 },
  { t: 3.7, by: 'A', ang: 124, e: 'snap' },
  { t: 3.78, by: 'A', ang: 124 },
  { t: 3.95, by: 'A', ang: 55 },
  { t: 4.2, by: 'A', ang: 62 },
  { t: 4.7, by: 'A', ang: 50 },
  { t: 4.92, by: 'A', ang: 18 },
  { t: 5.06, by: 'A', ang: 2, e: 'snap' },
  { t: 5.1, by: 'A', ang: -24, e: 'out' },
  { t: 5.14, by: 'A', ang: -24 },
  { t: 5.3, by: 'A', ang: 55 },
  { t: 5.7, by: 'A', ang: 50 },
  { t: 5.86, by: 'A', ang: 80 },
  { t: 5.98, by: 'A', ang: 40 },
  { t: 6.08, by: 'A', ang: 55 },
  { t: 6.2, by: 'A', ang: 124 },
  { t: 6.34, by: 'A', ang: 35, e: 'in3' },
  { t: 6.42, by: 'A', ang: 35 },
  { t: 6.52, by: 'A', ang: 70 },
  { t: 6.7, by: 'A', ang: 55 },
  { t: 6.9, by: 'A', ang: 60 },
  { t: 7.02, by: 'A', ang: 14, e: 'snap' },
  { t: 7.1, by: 'A', ang: 13 },
  { t: 7.24, by: 'A', ang: 4 },
  { t: 7.36, by: 'A', ang: 6 },
  { t: 7.52, by: 'A', ang: 84 },
  { t: 7.6, by: 'A', ang: 84 },
  { t: T_SHATTER, at: [1000, 150], ang: 84, type: 'shortsword', scale: 0.6 },                // the hilt spins away
  { t: 8.25, at: [690, 6], ang: 620, hop: 240, e: 'lin' },
  { t: T_B3, at: [690, 6], ang: 620 },
  { t: T_B3 + 0.5, at: [300, -260], ang: 1500, hop: 300, e: 'lin' },      // …and is bounced into the void by blow three
  { t: T_B3 + 0.52, at: [300, -260], ang: 1500, gone: true },
]);
S.weapon('spear', [
  { t: 0, type: 'spear', by: 'B', ang: 205, g: 0.45, two: 1 },
  { t: T_CRATER, by: 'B', ang: 182 },
  { t: 1.5, by: 'B', ang: 181 },
  { t: 1.72, by: 'B', ang: 180 },
  { t: 1.9, by: 'B', ang: 180, e: 'snap' },
  { t: 1.96, by: 'B', ang: 166, e: 'out' },
  { t: 2.14, by: 'B', ang: 184 },
  { t: 2.3, by: 'B', ang: 190 },
  { t: 2.42, by: 'B', ang: 195, e: 'snap' },
  { t: 2.66, by: 'B', ang: 195 },
  { t: 2.7, by: 'B', ang: 199 },
  { t: 2.96, by: 'B', ang: 198 },
  { t: T_CUT, by: 'B', ang: 198, type: 'staff', scale: 0.786, g: 0.79 },
  { t: 3.1, by: 'B', ang: 150, two: 0.5 },
  { t: 3.28, by: 'B', ang: 140, two: 0 },
  { t: 3.42, by: 'B', ang: 60 },
  { t: 3.54, by: 'B', ang: 190, e: 'snap' },
  { t: 3.55, at: [1321, 156], ang: 190 },
  { t: 3.7, at: [1125, 150], ang: -80, e: 'lin' },
  { t: 4.15, at: [830, 6], ang: -540, hop: 200, e: 'lin' },
  { t: T_H2, at: [830, 6], ang: -540 },
  { t: T_H2 + 0.5, at: [330, -260], ang: -1300, hop: 330, e: 'lin' },     // blasted off the page by hammer blow two
  { t: T_H2 + 0.52, at: [330, -260], ang: -1300, gone: true },
]);

// the axe: an engine shaft + a folded-paper head drawn by this scene (drawAxeHead), so the
// blade can face the way B swings.
S.weapon('hammer', [
  { t: 0, type: 'hammer', at: [560, 107], ang: 270 },
  { t: 13.46, by: 'B', ang: 270, g: 0.3, two: 1 },
  { t: 13.72, by: 'B', ang: 266 },
  { t: 13.82, by: 'B', ang: 256 },
  { t: T_HAMMER, by: 'B', ang: 200, e: 'snap' },
  { t: 14.04, by: 'B', ang: 150 },
  { t: 14.24, by: 'B', ang: 118 },
  { t: 14.76, by: 'B', ang: 124 },
  { t: 14.86, by: 'B', ang: 140 },
  { t: 14.97, by: 'B', ang: 166 },
  { t: T_H1, by: 'B', ang: -26, e: 'in3' },
  { t: 15.17, by: 'B', ang: -26 },
  { t: 15.4, by: 'B', ang: -22 },
  { t: 15.62, by: 'B', ang: 40 },
  { t: 15.86, by: 'B', ang: 100 },
  { t: 16.06, by: 'B', ang: 70 },
  { t: 16.26, by: 'B', ang: 26 },
  { t: 16.4, by: 'B', ang: 14 },
  { t: T_H2, by: 'B', ang: 206, e: 'in3' },
  { t: 16.98, by: 'B', ang: 206 },
  { t: 17.16, by: 'B', ang: 130 },
  { t: 17.36, by: 'B', ang: 122 },
  { t: 17.56, by: 'B', ang: 80 },
  { t: 17.76, by: 'B', ang: 24 },
  { t: 17.95, by: 'B', ang: 10 },
  { t: 18.05, by: 'B', ang: 180, e: 'in3' },
  { t: 18.12, by: 'B', ang: 176 },
  { t: 18.3, by: 'B', ang: 120 },
  { t: 18.7, by: 'B', ang: 122 },
  { t: 18.702, by: 'B', ang: -238 },     // same angle, one turn down (keeps the later keys continuous)
  { t: 18.9, by: 'B', ang: -250 },
  { t: 19.1, by: 'B', ang: -296 },
  { t: 19.3, by: 'B', ang: -332 },
  { t: 19.42, by: 'B', ang: -340 },
  { t: T_C1, by: 'B', ang: -196, e: 'in3' },
  { t: 19.64, by: 'B', ang: -196 },
  { t: 19.9, by: 'B', ang: -232 },
  { t: 20.05, by: 'B', ang: -290 },
  { t: 20.25, by: 'B', ang: -334 },
  { t: 20.45, by: 'B', ang: -346 },
  { t: T_B3, by: 'B', ang: -154, e: 'in' },
  { t: 20.74, by: 'B', ang: -154 },
  { t: 20.82, by: 'B', ang: -166 },
  { t: 21.04, by: 'B', ang: -222 },
  { t: 21.18, by: 'B', ang: -258 },
  { t: 21.3, by: 'B', ang: -256 },
  { t: 21.48, by: 'B', ang: -236 },
  { t: 21.62, by: 'B', ang: -248 },
  { t: 21.76, by: 'B', ang: -244 },
  { t: 21.88, by: 'B', ang: -232 },
  { t: 22.2, by: 'B', ang: -206 },
  { t: 22.4, by: 'B', ang: -238 },
  { t: 22.6, by: 'B', ang: -336 },
  { t: 22.86, by: 'B', ang: -350 },
  { t: T_C2, by: 'B', ang: -182, e: 'in3' },
  { t: 23.14, by: 'B', ang: -184 },
  { t: 23.28, by: 'B', ang: -262 },
  { t: 23.42, by: 'B', ang: -340 },
  { t: 23.58, by: 'B', ang: -388 },
  { t: 24.1, by: 'B', ang: -388 },
  { t: 24.4, by: 'B', ang: -306 },
  { t: 25.12, by: 'B', ang: -304 },
  { t: 25.26, by: 'B', ang: -318 },
  { t: 25.5, by: 'B', ang: -328 },
  { t: 25.74, by: 'B', ang: -334 },
  { t: T_FINAL, by: 'B', ang: -215, e: 'in3' },
  { t: 26.12, by: 'B', ang: -215 },
  { t: 26.85, by: 'B', ang: -212 },
  { t: 27.65, by: 'B', ang: -216 },
  { t: 28.05, by: 'B', ang: -213 },
]);
S.weapon('great', [
  { t: T_GRAB, type: 'greatsword', by: 'A', ang: -32, g: 0.1, two: 1 },
  { t: 17.22, by: 'A', ang: -33 },
  { t: 17.4, by: 'A', ang: -34 },
  { t: 17.56, by: 'A', ang: -33 },
  { t: 17.74, by: 'A', ang: -26 },
  { t: 17.9, by: 'A', ang: -16, e: 'in' },
  { t: 18.05, by: 'A', ang: 20, e: 'snap' },
  { t: 18.12, by: 'A', ang: 26 },
  { t: 18.26, by: 'A', ang: 110 },
  { t: 18.4, by: 'A', ang: 194 },
  { t: 18.54, by: 'A', ang: 200 },
  { t: 18.66, by: 'A', ang: 100 },
  { t: 18.78, by: 'A', ang: -14, e: 'in' },
  { t: 18.96, by: 'A', ang: -14 },
  { t: 19.14, by: 'A', ang: 60 },
  { t: 19.3, by: 'A', ang: 118 },
  { t: 19.42, by: 'A', ang: 126 },
  { t: T_C1, by: 'A', ang: 38, e: 'in3' },
  { t: 19.64, by: 'A', ang: 38 },
  { t: 19.9, by: 'A', ang: 50 },
  { t: 20.0, by: 'A', ang: 76 },
  { t: 20.12, by: 'A', ang: 104 },
  { t: 20.24, by: 'A', ang: 96 },
  { t: 20.34, by: 'A', ang: 14 },
  { t: 20.42, by: 'A', ang: -62, e: 'in3' },
  { t: 20.46, by: 'A', ang: -62 },
  { t: 20.56, by: 'A', ang: -74, e: 'lin' },
  { t: 20.66, by: 'A', ang: -90, e: 'lin' },
  { t: 20.76, by: 'A', ang: -104, e: 'lin' },
  { t: 20.82, by: 'A', ang: -110, e: 'lin' },
  { t: 20.9, by: 'A', ang: -112, e: 'lin' },
  { t: 21.0, by: 'A', ang: -135, e: 'lin' },
  { t: 21.08, by: 'A', ang: -160 },
  { t: 21.18, by: 'A', ang: -262 },
  { t: 21.3, by: 'A', ang: -328, e: 'in3' },
  { t: 21.38, by: 'A', ang: -328 },
  { t: 21.5, by: 'A', ang: -382 },
  { t: 21.53, by: 'A', ang: -368, scale: 0.3, e: 'out' },
  { t: 21.57, by: 'A', ang: -552, scale: 0.3, e: 'lin' },
  { t: 21.62, by: 'A', ang: -540, scale: 1, e: 'out' },
  { t: 21.75, by: 'A', ang: -630 },
  { t: 21.88, by: 'A', ang: -704, e: 'in3' },
  { t: 21.96, by: 'A', ang: -704 },
  { t: 22.16, by: 'A', ang: -690 },
  { t: 22.4, by: 'A', ang: -604 },
  { t: 22.62, by: 'A', ang: -534 },
  { t: 22.86, by: 'A', ang: -528 },
  { t: T_C2, by: 'A', ang: -700, e: 'in3' },
  { t: 23.14, by: 'A', ang: -700 },
  { t: 23.26, by: 'A', ang: -630 },
  { t: 23.4, by: 'A', ang: -604 },
  { t: 23.52, by: 'A', ang: -600 },
  { t: 23.66, by: 'A', ang: -734, e: 'in' },
  { t: 24.05, by: 'A', ang: -734 },
  { t: 24.3, by: 'A', ang: -660 },
  { t: 24.5, by: 'A', ang: -676 },
  { t: 24.7, by: 'A', ang: -672 },
  { t: 25.12, by: 'A', ang: -640 },
  { t: 25.26, by: 'A', ang: -598 },
  { t: 25.5, by: 'A', ang: -580 },
  { t: 25.74, by: 'A', ang: -572 },
  { t: T_FINAL, by: 'A', ang: -684, e: 'in3' },
  { t: 26.12, by: 'A', ang: -684 },
  { t: 26.85, by: 'A', ang: -687 },
  { t: 27.65, by: 'A', ang: -683 },
  { t: 28.05, by: 'A', ang: -686 },
]);
S.weapon('axe', [
  { t: T_AXE, type: 'staff', scale: 0.933, by: 'B', ang: 125, g: 0.3, two: 1 },
  { t: 5.06, by: 'B', ang: 200, e: 'snap' },
  { t: 5.14, by: 'B', ang: 200 },
  { t: 5.3, by: 'B', ang: 110 },
  { t: 5.5, by: 'B', ang: 50 },
  { t: 5.72, by: 'B', ang: 30 },
  { t: T_AXE1, by: 'B', ang: 216, e: 'in3' },
  { t: 5.94, by: 'B', ang: 216 },
  { t: 6.1, by: 'B', ang: 212 },
  { t: 6.24, by: 'B', ang: 205 },
  { t: 6.34, by: 'B', ang: 100, e: 'snap' },
  { t: 6.42, by: 'B', ang: 100 },
  { t: 6.52, by: 'B', ang: 120 },
  { t: 6.64, by: 'B', ang: 80 },
  { t: 6.82, by: 'B', ang: 40 },
  { t: 6.94, by: 'B', ang: 32 },
  { t: 7.02, by: 'B', ang: 150, e: 'in3' },
  { t: 7.1, by: 'B', ang: 150 },
  { t: 7.24, by: 'B', ang: 168 },
  { t: 7.36, by: 'B', ang: 140 },
  { t: 7.52, by: 'B', ang: 20 },
  { t: T_SHATTER, by: 'B', ang: 178, e: 'in3' },
  { t: 7.72, by: 'B', ang: 180 },
  { t: 7.92, by: 'B', ang: 236 },
  { t: 8.12, by: 'B', ang: 125 },
  { t: 8.3, by: 'B', ang: 120 },
  { t: 8.5, by: 'B', ang: 30 },
  { t: 8.66, by: 'B', ang: 14 },
  { t: 8.78, by: 'B', ang: 184, e: 'in3' },
  { t: 8.9, by: 'B', ang: 226 },
  { t: 9.04, by: 'B', ang: 204 },
  { t: 9.18, by: 'B', ang: 150 },
  { t: 9.32, by: 'B', ang: 40 },
  { t: 9.58, by: 'B', ang: 50 },
  { t: 9.7, by: 'B', ang: 140 },
  { t: 9.78, by: 'B', ang: 162 },
  { t: T_FLAPCUT, by: 'B', ang: 2, e: 'in' },
  { t: 9.94, by: 'B', ang: -4 },
  { t: 10.08, by: 'B', ang: -50 },
  { t: 10.26, by: 'B', ang: 35 },
  { t: 10.4, by: 'B', ang: 70 },
  { t: 10.57, by: 'B', ang: 124 },
  { t: 10.63, by: 'B', ang: 110 },
  { t: 10.9, by: 'B', ang: 60 },
  { t: 11.08, by: 'B', ang: 40 },
  { t: 11.28, by: 'B', ang: 140 },
  { t: 11.47, by: 'B', ang: 166 },
  { t: T_WEDGE, by: 'B', ang: -36, e: 'in' },
  { t: 12.2, by: 'B', ang: -36 },
  { t: 12.21, at: [1459, 37], ang: -36 },
  { t: T_H1, at: [1459, 37], ang: -36 },
  { t: 15.7, at: [1960, 40], ang: 740, hop: 420, e: 'lin' },      // flipped out by the see-saw
  { t: 26.9, at: [1960, 40], ang: 740 },
  { t: 27.0, at: [1960, 40], ang: 740, gone: true },       // swallowed by the ink
]);

S.camera([
  { t: 0, x: 1150, y: -330, z: 0.72, r: -3 },
  { t: 0.5, x: 1120, y: -290, z: 0.84, r: -1 },
  { t: 0.64, a: 1, x: 130, y: -150, z: 1.42, r: 2, e: 'snap' },         // drops with A's landing and rolls with him
  { t: 0.84, a: 0.62, b: 0.38, y: -160, z: 1.4, r: 0 },
  { t: 0.92, a: 0.5, b: 0.5, y: -165, z: 1.58, r: -2, e: 'snap' },       // B craters
  { t: 1.5, a: 0.5, b: 0.5, y: -165, z: 1.32, e: 'out' },
  { t: 1.86, a: 0.5, b: 0.5, y: -165, z: 1.36 },
  { t: 1.93, a: 0.5, b: 0.5, y: -160, z: 1.5, e: 'snap' },
  { t: 2.3, a: 0.5, b: 0.5, y: -160, z: 1.4 },
  { t: 2.66, a: 0.6, b: 0.4, y: -160, z: 1.5 },
  { t: 2.94, a: 0.6, b: 0.4, y: -155, z: 1.55 },
  { t: 3.0, a: 0.6, b: 0.4, y: -150, z: 1.75, e: 'snap' },
  { t: 3.4, a: 0.5, b: 0.5, y: -165, z: 1.35, e: 'out' },
  { t: 3.8, a: 0.25, b: 0.75, y: -140, z: 1.6 },                        // B and the strip
  { t: 4.16, a: 0.25, b: 0.75, y: -185, z: 1.6 },
  { t: 4.32, x: 1222, y: -178, z: 2.15, r: 3, e: 'out' },               // close on the folding hands, A watching at frame left
  { t: 4.86, x: 1232, y: -186, z: 2.6, r: -3, e: 'lin' },               // slow rolling push through the three folds
  { t: 4.98, x: 1228, y: -190, z: 2.45, r: -1 },
  { t: 5.14, a: 0.5, b: 0.5, y: -165, z: 1.5, r: 0, e: 'out' },
  { t: 5.7, a: 0.5, b: 0.5, y: -195, z: 1.3 },                          // rises with the wind-up
  { t: 5.84, a: 0.45, b: 0.55, y: -150, z: 1.3, e: 'in' },
  { t: 5.9, a: 0.45, b: 0.55, y: -140, z: 1.5, e: 'snap' },
  { t: 6.3, a: 0.5, b: 0.5, y: -165, z: 1.32, e: 'out' },
  { t: 6.9, a: 0.5, b: 0.5, y: -180, z: 1.45 },
  { t: 7.02, a: 0.5, b: 0.5, y: -180, z: 1.45 },
  { t: 7.08, a: 0.5, b: 0.5, y: -175, z: 1.65, e: 'snap' },
  { t: 7.32, a: 0.65, b: 0.35, y: -130, z: 1.8 },                       // A driven down
  { t: 7.6, a: 0.6, b: 0.4, y: -150, z: 1.6 },
  { t: 7.68, a: 0.6, b: 0.4, y: -155, z: 1.9, e: 'snap' },
  { t: 8.05, a: 0.5, b: 0.5, y: -165, z: 1.25, e: 'out' },
  { t: 8.66, a: 0.5, b: 0.5, y: -160, z: 1.35 },
  { t: 9.2, a: 0.5, b: 0.5, y: -165, z: 1.22, e: 'out' },
  { t: 9.8, a: 0.5, b: 0.5, y: -170, z: 1.3 },
  { t: 9.92, a: 0.5, b: 0.5, y: -165, z: 1.5, e: 'snap' },
  { t: 10.32, a: 0.6, b: 0.4, y: -235, z: 1.15, e: 'out' },             // A at the top of the ramp
  { t: 10.6, a: 0.5, b: 0.5, y: -225, z: 1.35 },
  { t: 10.66, a: 0.5, b: 0.5, y: -220, z: 1.6, e: 'snap' },
  { t: 11.05, a: 0.5, b: 0.5, y: -165, z: 1.3, e: 'out' },
  { t: 11.47, a: 0.5, b: 0.5, y: -190, z: 1.38 },
  { t: 11.57, a: 0.5, b: 0.5, y: -160, z: 1.4, e: 'in' },
  { t: 11.63, a: 0.5, b: 0.5, y: -150, z: 1.6, e: 'snap' },
  { t: 12.2, a: 0.5, b: 0.5, y: -160, z: 1.5 },
  { t: 12.34, a: 0.5, b: 0.5, y: -165, z: 1.7, e: 'snap' },
  { t: 12.8, a: 0.5, b: 0.5, y: -165, z: 1.15, e: 'out' },
  { t: 13.5, a: 0.3, b: 0.7, y: -165, z: 1.1 },
  { t: 13.64, b: 1, x: -40, y: -150, z: 1.9, e: 'io' },                 // B at the folded block (A is off screen for 0.4 s)
  { t: 13.9, b: 1, x: -40, y: -170, z: 2.0, e: 'lin' },
  { t: 13.96, b: 1, x: -30, y: -185, z: 2.15, e: 'snap' },
  { t: 14.16, a: 0.5, b: 0.5, y: -175, z: 1.12, e: 'out' },
  { t: 14.9, a: 0.5, b: 0.5, y: -190, z: 1.25 },
  { t: 15.05, a: 0.68, b: 0.32, y: -165, z: 1.5, r: -2, e: 'in' },           // swings toward the slab as the hammer comes down
  { t: 15.12, a: 0.72, b: 0.28, y: -175, z: 1.72, r: 4, e: 'snap' },          // its far end kicks up under A
  { t: 15.47, a: 0.5, b: 0.5, y: -300, z: 0.95, r: 0, e: 'out' },       // A thrown over B
  { t: 15.85, a: 0.5, b: 0.5, y: -170, z: 1.2 },
  { t: 16.4, a: 0.5, b: 0.5, y: -190, z: 1.3 },
  { t: 16.5, a: 0.5, b: 0.5, y: -165, z: 1.3 },
  { t: 16.56, a: 0.5, b: 0.5, y: -150, z: 1.5, e: 'snap' },
  { t: 16.95, a: 0.75, b: 0.25, y: -140, z: 1.55 },                     // the outline in the cracks
  { t: 17.1, a: 0.8, b: 0.2, x: 20, y: -150, z: 1.78 },
  { t: 17.74, a: 0.8, b: 0.2, x: 20, y: -175, z: 1.66, e: 'lin' },
  { t: 18.0, a: 0.5, b: 0.5, y: -170, z: 1.4 },
  { t: 18.05, a: 0.5, b: 0.5, y: -170, z: 1.4 },
  { t: 18.11, a: 0.5, b: 0.5, y: -170, z: 1.6, e: 'snap' },
  { t: 18.5, a: 0.6, b: 0.4, y: -175, z: 1.28, e: 'out' },
  { t: 19.3, a: 0.5, b: 0.5, y: -205, z: 1.35 },
  { t: T_C1, a: 0.5, b: 0.5, y: -200, z: 1.38 },
  { t: 19.56, a: 0.5, b: 0.5, y: -195, z: 1.68, e: 'snap' },
  { t: 19.95, a: 0.5, b: 0.5, y: -175, z: 1.3, e: 'out' },
  { t: 20.3, a: 0.5, b: 0.5, x: -20, y: -200, z: 1.36, r: -2 },           // tracks A's run-in, B hoisting the hammer
  { t: 20.42, a: 0.5, b: 0.5, x: -40, y: -180, z: 1.5, r: -3 },
  { t: 20.48, a: 0.5, b: 0.5, x: -40, y: -175, z: 1.62, r: -4, e: 'snap' }, // the blade goes in
  { t: 20.68, x: 1090, y: -215, z: 1.85, r: 3 },                            // swings up and round with him as the hammer lands under his feet
  { t: 20.8, x: 1150, y: -195, z: 1.9, r: 6 },
  { t: 20.86, x: 1175, y: -180, z: 2.2, r: 8, e: 'snap' },                 // the kick
  { t: 21.08, a: 0.5, b: 0.5, y: -185, z: 1.4, r: 0, e: 'out' },
  { t: 21.3, a: 0.5, b: 0.5, y: -195, z: 1.36 },
  { t: 21.36, a: 0.5, b: 0.5, y: -190, z: 1.55, e: 'snap' },
  { t: 21.65, a: 0.5, b: 0.5, y: -185, z: 1.38 },
  { t: 21.88, a: 0.5, b: 0.5, y: -180, z: 1.4 },
  { t: 21.94, a: 0.5, b: 0.5, y: -175, z: 1.6, e: 'snap' },
  { t: 22.35, a: 0.5, b: 0.5, y: -170, z: 1.22, e: 'out' },
  { t: 22.9, a: 0.5, b: 0.5, y: -175, z: 1.3, r: 2 },
  { t: T_C2, a: 0.5, b: 0.5, y: -175, z: 1.32, r: 2 },
  { t: 23.06, a: 0.5, b: 0.5, y: -170, z: 1.62, r: -2, e: 'snap' },
  { t: 23.65, a: 0.5, b: 0.5, y: -190, z: 0.98, r: 0, e: 'out' },       // the breath: wide, still
  { t: 24.65, a: 0.5, b: 0.5, y: -190, z: 1.06, e: 'lin' },
  { t: 25.26, a: 0.5, b: 0.5, y: -195, z: 1.2 },
  { t: 25.78, a: 0.5, b: 0.5, y: -205, z: 1.36, e: 'lin' },
  { t: T_FINAL, a: 0.5, b: 0.5, y: -200, z: 1.38 },
  { t: 25.97, a: 0.5, b: 0.5, y: -195, z: 1.62, r: 3, e: 'snap' },
  { t: 26.4, a: 0.5, b: 0.5, y: -190, z: 1.5, r: 2 },
  { t: 27.2, x: 1150, y: -170, z: 1.0, r: -2, e: 'io' },                // pulls out: the page split in two
  { t: 28.05, x: 1150, y: -135, z: 0.94, r: -4, e: 'out' },
]);

// ── contacts, effects, sound ─────────────────────────────────────────────────
const scr = (t, x, h, n) => S.fx({ t, type: 'scraps', x, h, n });
// arrival
S.whoosh({ t: 0.06, x: 900, size: 'l', dur: 0.5 });
S.land({ t: 0.6, x: 880, weight: 0.5 });
S.skid({ t0: 0.62, t1: 1.0, x0: 890, x1: 1004 });
S.hit({ t: T_CRATER, x: 1400, h: 4, size: 1.8, sound: 'slam', weight: 0.9, ring: true, sparks: false });
S.fx({ t: T_CRATER, type: 'dust', x: 1400, n: 10, size: 1.3 }); scr(T_CRATER, 1400, 6, 10);
S.cue({ t: T_CRATER + 0.02, type: 'crack', dur: 0.4, x: 1400 });
// spear against longsword
S.whoosh({ t: 1.8, x: 1300, size: 'm' });
S.hit({ t: 1.9, x: 1060, h: 135, size: 0.9, sound: 'clang', weight: 0.55 });
S.whoosh({ t: 2.34, x: 1020, size: 's' }); S.whoosh({ t: 2.36, x: 1250, size: 'm' });
S.hit({ t: 2.42, x: 1055, h: 8, size: 0.5, sound: 'clack', weight: 0.35 });
S.hit({ t: 2.66, x: 1094, h: 12, size: 0.7, sound: 'clack', weight: 0.6, sparks: false }); S.land({ t: 2.66, x: 1060, weight: 0.4 });
S.cue({ t: 2.84, type: 'crumble', dur: 0.14, gain: 0.4, x: 1200 });
S.whoosh({ t: 2.9, x: 1100, size: 'm' });
S.hit({ t: T_CUT, x: 1168, h: 36, size: 1.1, sound: 'clack', weight: 0.8 });
S.cue({ t: T_CUT, type: 'snap', x: 1168 }); S.cue({ t: T_CUT - 0.02, type: 'slice', weight: 0.7, x: 1168 });
S.skid({ t0: 3.0, t1: 3.28, x0: 1340, x1: 1410 });
S.whoosh({ t: 3.26, x: 1100, size: 's' }); S.hit({ t: 3.3, x: 1118, h: 8, size: 0.4, sound: 'clack', weight: 0.25, sparks: false });
S.cue({ t: 3.74, type: 'clack', weight: 0.2, x: 772 });
S.whoosh({ t: 3.48, x: 1300, size: 'm' });
S.hit({ t: 3.7, x: 1118, h: 160, size: 0.7, sound: 'clack', weight: 0.5 });
S.cue({ t: 4.15, type: 'clack', weight: 0.2, x: 830 });
// the strip, the folds, the axe
S.step({ t: 3.78, x: 1320, weight: 0.7 });
S.cue({ t: T_RIP0, type: 'tear', dur: 0.4, x: 1250 }); S.cue({ t: T_RIP0, type: 'crack', dur: 0.2, x: 1290 });
scr(T_RIP1, 1200, 40, 9); S.whoosh({ t: T_RIP1 - 0.04, x: 1300, size: 'm' }); S.shake(T_RIP1, 6, 0.2);
for (const ft of [4.38, 4.6, 4.82]) { S.cue({ t: ft, type: 'draw', dur: 0.1, x: 1300 }); S.cue({ t: ft + 0.02, type: 'clack', weight: 0.25, x: 1300 }); S.fx({ t: ft, type: 'sparks', x: ft > 4.7 ? 1262 : 1300, h: ft > 4.7 ? 196 : 150, size: 0.45, n: 6 }); S.shake(ft, 5, 0.12); }
S.cue({ t: T_AXE - 0.02, type: 'shing', dur: 0.35, x: 1300 }); S.fx({ t: T_AXE, type: 'burst', x: 1270, h: 215, size: 0.6 });
S.whoosh({ t: 4.98, x: 1100, size: 'm' });
S.hit({ t: 5.06, x: 1250, h: 125, size: 0.9, sound: 'clang', weight: 0.6 });
S.skid({ t0: 5.14, t1: 5.3, x0: 1092, x1: 1050 });
S.whoosh({ t: 5.7, x: 1250, size: 'l', heavy: true, dur: 0.3 }); S.whoosh({ t: 5.74, x: 1000, size: 's' });
S.hit({ t: T_AXE1, x: 1040, h: 4, size: 2.2, sound: 'slam', weight: 1, ring: true, impact: 0.08, sparks: false });
S.fx({ t: T_AXE1, type: 'dust', x: 1040, n: 10, size: 1.3 }); scr(T_AXE1, 1040, 6, 14);
S.cue({ t: T_AXE1 + 0.02, type: 'tear', dur: 0.5, x: 1040 }); S.cue({ t: T_AXE1 + 0.04, type: 'crack', dur: 0.5, x: 1040 });
S.land({ t: 5.98, x: 900, weight: 0.4 });
S.cue({ t: 6.1, type: 'crumble', dur: 0.25, gain: 0.5, x: 1040 });
S.whoosh({ t: 6.18, x: 950, size: 'm' }); scr(6.32, 1040, 10, 6);
S.hit({ t: 6.34, x: 1190, h: 178, size: 1, sound: 'clang', weight: 0.7 });
S.hit({ t: 6.52, x: 1130, h: 150, size: 0.7, sound: 'block', weight: 0.6 });
S.skid({ t0: 6.52, t1: 6.7, x0: 1040, x1: 985 });
S.whoosh({ t: 6.9, x: 1200, size: 'l', heavy: true });
S.hit({ t: 7.02, x: 1050, h: 215, size: 1.5, sound: 'clang', weight: 0.95, shock: true });
S.land({ t: 7.24, x: 975, weight: 0.8 }); S.cue({ t: 7.24, type: 'crack', dur: 0.3, x: 975 });
S.whoosh({ t: 7.5, x: 1150, size: 'l', heavy: true });
S.hit({ t: T_SHATTER, x: 1000, h: 150, size: 1.8, sound: 'clang', weight: 1, impact: 0.08, shock: true });
S.cue({ t: T_SHATTER, type: 'shatter', x: 1000 });
S.skid({ t0: 7.64, t1: 7.95, x0: 950, x1: 850 });
S.cue({ t: 8.25, type: 'clack', weight: 0.25, x: 690 });
// unarmed against the axe
S.step({ t: 8.3, x: 1175, weight: 0.8 }); S.step({ t: 8.5, x: 1110, weight: 0.8 });
S.whoosh({ t: 8.66, x: 1050, size: 'l', heavy: true });
S.skid({ t0: 8.76, t1: 9.06, x0: 930, x1: 1200 });
S.cue({ t: 8.78, type: 'slice', weight: 0.9, x: 900 });
S.step({ t: 9.3, x: 1290, weight: 0.3 }); S.step({ t: 9.42, x: 1400, weight: 0.3 }); S.step({ t: 9.54, x: 1500, weight: 0.3 });
S.step({ t: 9.44, x: 1140, weight: 0.8 }); S.step({ t: 9.58, x: 1220, weight: 0.85 });
S.whoosh({ t: 9.74, x: 1350, size: 'l', heavy: true });
S.hit({ t: T_FLAPCUT, x: 1548, h: 136, size: 1.2, sound: null, shake: 14 });
S.cue({ t: T_FLAPCUT, type: 'slice', weight: 1, x: 1548 }); S.cue({ t: T_FLAPCUT + 0.02, type: 'tear', dur: 0.3, x: 1548 }); scr(T_FLAPCUT, 1548, 136, 12);
S.step({ t: 10.14, x: 1690, h: 62, weight: 0.3 }); S.step({ t: 10.24, x: 1760, h: 130, weight: 0.3 });
S.whoosh({ t: 10.34, x: 1750, size: 'm', dur: 0.26 });
S.step({ t: 10.4, x: 1470, weight: 0.8 }); S.step({ t: 10.57, x: 1575, weight: 0.8 });
S.hit({ t: 10.6, x: 1565, h: 205, size: 1.4, sound: 'hit', weight: 0.9 });
S.skid({ t0: 10.66, t1: 10.9, x0: 1560, x1: 1330 });
S.land({ t: 10.86, x: 1480, weight: 0.4 });
S.whoosh({ t: 11.45, x: 1400, size: 'l', heavy: true });
S.hit({ t: T_WEDGE, x: 1538, h: 4, size: 1.9, sound: 'slam', weight: 1, ring: true, sparks: false });
scr(T_WEDGE, 1538, 6, 10); S.cue({ t: T_WEDGE + 0.02, type: 'crack', dur: 0.4, x: 1538 });
S.land({ t: 11.6, x: 1602, weight: 0.3 });
S.cue({ t: 11.8, type: 'crumble', dur: 0.16, gain: 0.5, x: 1500 }); S.cue({ t: 12.06, type: 'crumble', dur: 0.18, gain: 0.6, x: 1500 });
S.cue({ t: 12.04, type: 'clack', weight: 0.3, x: 1470 }); S.whoosh({ t: 12.1, x: 1480, size: 'm' });
S.hit({ t: 12.28, x: 1392, h: 128, size: 1.3, sound: 'hit', weight: 0.85 });
S.skid({ t0: 12.32, t1: 12.8, x0: 1280, x1: 1020 });
S.land({ t: 12.52, x: 1340, weight: 0.4 });
S.cue({ t: 13.0, type: 'crumble', dur: 0.14, gain: 0.35, x: 1420 }); S.cue({ t: 13.3, type: 'crumble', dur: 0.16, gain: 0.4, x: 1420 });
// the hammer
S.step({ t: 13.12, x: 930, weight: 0.85 }); S.step({ t: 13.24, x: 830, weight: 0.85 }); S.step({ t: 13.36, x: 730, weight: 0.85 });
S.cue({ t: 13.46, type: 'block', weight: 0.4, x: 560 });
S.cue({ t: 13.6, type: 'crack', dur: 0.15, x: 560 }); S.cue({ t: 13.76, type: 'crack', dur: 0.15, x: 560 });
S.hit({ t: T_HAMMER, x: 560, h: 34, size: 1.2, sound: null, shake: 16 });
S.cue({ t: T_HAMMER, type: 'tear', dur: 0.45, x: 560 }); S.cue({ t: T_HAMMER, type: 'wallbreak', size: 0.4, x: 560 }); scr(T_HAMMER, 560, 40, 18);
S.whoosh({ t: 13.94, x: 600, size: 'l', heavy: true });
S.land({ t: 14.24, x: 670, weight: 0.9 });
S.step({ t: 14.4, x: 740, weight: 0.9 }); S.step({ t: 14.52, x: 820, weight: 0.9 }); S.step({ t: 14.64, x: 900, weight: 0.95 }); S.step({ t: 14.76, x: 975, weight: 1 });
S.whoosh({ t: 14.92, x: 1100, size: 'l', heavy: true });
S.hit({ t: T_H1, x: 1312, h: 6, size: 2.6, sound: 'slam', weight: 1, ring: true, impact: 0.09, sparks: false });
S.cue({ t: T_H1, type: 'boom', x: 1312 }); S.cue({ t: T_H1 + 0.03, type: 'tear', dur: 0.4, x: 1450 });
S.fx({ t: T_H1, type: 'dust', x: 1312, n: 12, size: 1.5 }); scr(T_H1, 1330, 6, 9);
S.whoosh({ t: 15.08, x: 1560, size: 'l', dur: 0.5 }); S.cue({ t: 15.08, type: 'clack', weight: 0.4, x: 1500 });
S.cue({ t: 15.7, type: 'clack', weight: 0.4, x: 1960 });
S.land({ t: 15.82, x: 900, weight: 0.6 });
S.whoosh({ t: 16.36, x: 800, size: 'm', dur: 0.28 }); S.whoosh({ t: 16.38, x: 1050, size: 'l', heavy: true });
S.hit({ t: T_H2, x: 853, h: 6, size: 2.8, sound: 'slam', weight: 1, ring: true, sparks: false, shake: 42 });
S.cue({ t: T_H2, type: 'wallbreak', size: 0.9, x: 853 }); S.cue({ t: T_H2 + 0.03, type: 'tear', dur: 0.5, x: 853 });
scr(T_H2, 853, 6, 22); S.fx({ t: T_H2, type: 'splash', x: 853, h: 6, n: 12, size: 1.1, dir: 0 }); S.fx({ t: T_H2, type: 'dust', x: 853, n: 12, size: 1.5 });
S.cue({ t: T_H2 + 0.08, type: 'crack', dur: 0.5, x: 700 }); S.cue({ t: T_H2 + 0.14, type: 'shing', dur: 0.55, gain: 0.5, x: 660 });
S.land({ t: 16.66, x: 575, weight: 0.4 }); S.skid({ t0: 16.66, t1: 16.8, x0: 580, x1: 556 });
S.cue({ t: 16.82, type: 'crumble', dur: 0.18, gain: 0.5, x: 880 }); S.cue({ t: 17.0, type: 'crumble', dur: 0.2, gain: 0.6, x: 880 });
scr(17.14, 870, 10, 8); S.whoosh({ t: 17.1, x: 950, size: 'm', heavy: true });
// the greatsword
S.hit({ t: T_GRAB, x: 571, h: 147, size: 0.8, sound: null, shake: 8 });
S.cue({ t: T_GRAB, type: 'crack', dur: 0.3, x: 571 }); S.cue({ t: 17.2, type: 'tear', dur: 0.55, x: 620 }); S.cue({ t: 17.24, type: 'shing', dur: 0.8, x: 620 });
scr(17.4, 640, 100, 8); scr(17.74, 620, 110, 14); S.fx({ t: 17.74, type: 'burst', x: 560, h: 180, size: 0.9 }); S.shake(17.74, 10, 0.25);
S.hit({ t: 17.9, x: 780, h: 6, size: 0.9, sound: 'slam', weight: 0.5, sparks: false });
S.step({ t: 17.56, x: 990, weight: 0.8 });
S.whoosh({ t: 17.93, x: 900, size: 'l', heavy: true }); S.whoosh({ t: 17.98, x: 620, size: 'm', heavy: true });
S.hit({ t: 18.05, x: 690, h: 168, size: 1.6, sound: 'clang', weight: 0.9, shock: true });
S.skid({ t0: 18.12, t1: 18.3, x0: 960, x1: 1000 });
S.whoosh({ t: 18.16, x: 520, size: 'l', heavy: true, dur: 0.34 });
S.skid({ t0: 18.28, t1: 18.54, x0: 520, x1: 478 });
S.whoosh({ t: 18.6, x: 520, size: 'm', heavy: true });
S.hit({ t: 18.78, x: 808, h: 4, size: 1.2, sound: 'slam', weight: 0.7, sparks: false, ring: true });
// greatsword against hammer
S.whoosh({ t: 19.12, x: 550, size: 'm', heavy: true });
S.whoosh({ t: 19.4, x: 620, size: 'l', heavy: true }); S.whoosh({ t: 19.42, x: 950, size: 'l', heavy: true });
S.hit({ t: T_C1, x: 756, h: 212, size: 2.4, sound: 'clang', weight: 1, impact: 0.09, shock: true, ring: true });
S.cue({ t: T_C1, type: 'boom', gain: 0.6, x: 756 });
S.skid({ t0: 19.66, t1: 19.9, x0: 556, x1: 500 }); S.skid({ t0: 19.66, t1: 20.25, x0: 1010, x1: 1310 });
S.fx({ t: 19.9, type: 'dust', x: 1200, n: 5, size: 0.9, dir: 1 }); S.land({ t: 20.25, x: 1310, weight: 0.7 });
S.whoosh({ t: 19.98, x: 520, size: 'm', heavy: true }); S.step({ t: 20.12, x: 560, weight: 0.5 }); S.step({ t: 20.24, x: 660, weight: 0.5 }); S.step({ t: 20.34, x: 760, weight: 0.5 });
S.hit({ t: 20.42, x: 960, h: 4, size: 0.9, sound: 'slam', weight: 0.6, sparks: false }); S.cue({ t: 20.4, type: 'slice', weight: 0.8, x: 960 });
S.whoosh({ t: 20.44, x: 1260, size: 'l', heavy: true }); S.whoosh({ t: 20.48, x: 880, size: 'l', dur: 0.36 });
S.hit({ t: T_B3, x: 1040, h: 6, size: 2.2, sound: 'slam', weight: 1, ring: true, sparks: false });
scr(T_B3, 1040, 6, 14); S.cue({ t: T_B3 + 0.02, type: 'crack', dur: 0.4, x: 1040 }); S.fx({ t: T_B3, type: 'dust', x: 1060, n: 10, size: 1.3, dir: 1 });
S.hit({ t: 20.82, x: 1210, h: 140, size: 1.5, sound: 'hit', weight: 0.95 });
S.skid({ t0: 20.9, t1: 21.04, x0: 1325, x1: 1400 });
S.land({ t: 21.0, x: 1145, weight: 0.5 });
S.cue({ t: 21.04, type: 'crack', dur: 0.2, x: 960 }); scr(21.06, 965, 8, 8);
S.whoosh({ t: 21.1, x: 1170, size: 'l', heavy: true });
S.hit({ t: 21.3, x: 1390, h: 186, size: 1.7, sound: 'clang', weight: 0.95, shock: true });
S.hit({ t: 21.48, x: 1285, h: 150, size: 0.8, sound: 'block', weight: 0.7 });
S.skid({ t0: 21.48, t1: 21.64, x0: 1200, x1: 1020 });
S.whoosh({ t: 21.52, x: 1050, size: 'l', heavy: true, dur: 0.36 }); S.step({ t: 21.62, x: 1340, weight: 0.8 }); S.step({ t: 21.76, x: 1295, weight: 0.8 });
S.hit({ t: 21.88, x: 1308, h: 174, size: 1.8, sound: 'clang', weight: 1, shock: true });
S.skid({ t0: 21.96, t1: 22.2, x0: 1290, x1: 1400 }); S.skid({ t0: 21.98, t1: 22.16, x0: 1015, x1: 955 });
S.whoosh({ t: 22.4, x: 880, size: 'm', heavy: true }); S.step({ t: 22.4, x: 1410, weight: 0.8 });
S.whoosh({ t: 22.84, x: 910, size: 'l', heavy: true }); S.whoosh({ t: 22.86, x: 1330, size: 'l', heavy: true });
S.hit({ t: T_C2, x: 1065, h: 160, size: 2.6, sound: 'clang', weight: 1, impact: 0.09, shock: true, ring: true });
S.cue({ t: T_C2, type: 'boom', gain: 0.7, x: 1065 });
S.whoosh({ t: 23.18, x: 870, size: 'l', heavy: true }); S.whoosh({ t: 23.2, x: 1400, size: 'l', heavy: true });
S.skid({ t0: 23.28, t1: 23.52, x0: 850, x1: 770 }); S.skid({ t0: 23.3, t1: 23.58, x0: 1400, x1: 1450 });
S.hit({ t: 23.58, x: 1628, h: 4, size: 1.1, sound: 'slam', weight: 0.7, sparks: false });
S.hit({ t: 23.66, x: 1063, h: 4, size: 1.1, sound: 'slam', weight: 0.65, sparks: false });
S.cue({ t: 23.9, type: 'heartbeat' }); S.cue({ t: 24.4, type: 'heartbeat' });
S.whoosh({ t: 24.24, x: 700, size: 'm', heavy: true }); S.whoosh({ t: 24.34, x: 1450, size: 'm', heavy: true });
S.cue({ t: 24.5, type: 'riser', dur: 1.35 });
// the charge and the last clash
S.step({ t: 24.84, x: 700, weight: 0.5 }); S.step({ t: 24.98, x: 770, weight: 0.5 }); S.step({ t: 25.12, x: 840, weight: 0.55 }); S.step({ t: 25.26, x: 890, weight: 0.6 });
S.step({ t: 24.86, x: 1420, weight: 0.9 }); S.step({ t: 25.0, x: 1396, weight: 0.95 }); S.step({ t: 25.14, x: 1372, weight: 1 }); S.land({ t: 25.28, x: 1352, weight: 0.9 });
S.whoosh({ t: 25.76, x: 950, size: 'l', heavy: true }); S.whoosh({ t: 25.78, x: 1350, size: 'l', heavy: true });
S.hit({ t: T_FINAL, x: 1132, h: 222, size: 3.2, sound: 'clang', weight: 1, impact: 0.12, shock: true, ring: true, shake: 56 });
S.cue({ t: T_FINAL, type: 'megaimpact', x: 1150 });
S.cue({ t: T_FINAL + 0.05, type: 'tear', dur: 1.5, x: 1150 }); S.cue({ t: T_FINAL + 0.06, type: 'crack', dur: 0.6, x: 1150 });
S.cue({ t: T_FINAL + 0.2, type: 'rumble', dur: 1.8 });
scr(T_FINAL, 1150, 8, 26); S.fx({ t: T_FINAL, type: 'dust', x: 1150, n: 14, size: 1.6 });
scr(T_FINAL + 0.2, 700, 8, 14); scr(T_FINAL + 0.24, 1650, 8, 14);
S.shake(26.1, 22, 1.3); S.shake(26.9, 9, 1.1);
for (const [t, x, w] of [[26.5, 620, 0.7], [26.8, 1700, 0.8], [27.1, 760, 0.9], [27.4, 1560, 1], [27.7, 500, 0.9]]) {
  S.cue({ t, type: 'inksplash', weight: w, x });
  S.fx({ t, type: 'splash', x, h: 30, n: 14, size: 1.2 + w * 0.5, dir: 0 });
}
S.musicHint(23.5, 24.7, 'suspend');
S.musicHint(T_FINAL, 28, 'aftermath');

// ── slow-motion close-up ──
S.bulletTime({ at: 25.58, span: 0.28, hold: 2.2, on: 'mid', z: 1.75 }); // both frozen at the top of the last wind-up
export default S.build();
