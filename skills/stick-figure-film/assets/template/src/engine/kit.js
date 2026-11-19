// Environment kit: reusable notebook-world pieces every scene can build from.
// World space here is canvas-style: x right, y DOWN, floor at y = 0 (so "up" is NEGATIVE y).
// Everything is drawn with ink.js primitives: only #000 and #fff.

import { line, sketchPoly, hatch, makeCracks, trim, stroke, pathLine, BLACK, WHITE } from './ink.js';
import { rng, clamp, prog, EASE, TAU, lerp } from './util.js';

export const DEFAULT_PAGE = { x0: -420, x1: 2620, y0: -1120, y1: 590 };
const RULE = 64;

// ── the notebook page ────────────────────────────────────────────────────────
/** White sheet, ruled lines every 64 units (y=0 is left free for the floor), margin, holes + spiral. */
export function drawPage(ctx, page, vb, px, o = {}) {
  const { x0, x1, y0, y1 } = page;
  const { rules = true, holes = true, skipRule = [0] } = o;
  const r = rng(11);
  const pts = [];
  const edge = (ax, ay, bx, by, n) => {
    for (let i = 0; i < n; i++) {
      const k = i / n;
      pts.push([lerp(ax, bx, k) + (r() - 0.5) * 3, lerp(ay, by, k) + (r() - 0.5) * 3]);
    }
  };
  edge(x0, y0, x1, y0, 12); edge(x1, y0, x1, y1, 8); edge(x1, y1, x0, y1, 12); edge(x0, y1, x0, y0, 8);
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  ctx.fillStyle = WHITE;
  ctx.fill();

  const w = Math.max(1.15, 0.95 * px);
  ctx.beginPath();
  if (rules) {
    const rr = rng(5);
    for (let y = Math.ceil((y0 + 110) / RULE) * RULE; y < y1 - 30; y += RULE) {
      if (skipRule.includes(y) || y < vb.y0 - 10 || y > vb.y1 + 10) { rr(); continue; }
      const xa = Math.max(x0 + 6, vb.x0), xb = Math.min(x1 - 6, vb.x1);
      if (xb <= xa) continue;
      ctx.moveTo(xa, y + (rr() - 0.5) * 0.8);
      ctx.lineTo(xb, y + (rr() - 0.5) * 0.8);
    }
    for (const mx of [x0 + 196, x0 + 204]) { ctx.moveTo(mx, y0 + 6); ctx.lineTo(mx, y1 - 6); }
    ctx.moveTo(x0 + 6, y0 + 96); ctx.lineTo(x1 - 6, y0 + 96);
    ctx.moveTo(x0 + 6, y0 + 102); ctx.lineTo(x1 - 6, y0 + 102);
  }
  ctx.lineWidth = w;
  ctx.strokeStyle = BLACK;
  ctx.stroke();

  if (holes) {
    for (let y = y0 + 120; y < y1 - 60; y += 128) {
      const hx = x0 + 76;
      ctx.fillStyle = BLACK;
      ctx.beginPath();
      ctx.ellipse(hx, y, 20, 17, 0, 0, TAU);
      ctx.fill();
      const wire = () => {
        ctx.beginPath();
        ctx.moveTo(hx + 6, y + 2);
        ctx.bezierCurveTo(hx - 40, y - 34, x0 - 70, y - 30, x0 - 96, y + 6);
      };
      wire(); ctx.lineWidth = 15; ctx.lineCap = 'round'; ctx.strokeStyle = BLACK; ctx.stroke();
      wire(); ctx.lineWidth = 9; ctx.strokeStyle = WHITE; ctx.stroke();
    }
  }
}

// ── doodles ──────────────────────────────────────────────────────────────────
/** Oblique hatched cube; (x, y) = bottom-left of the front face, s = edge. */
export function cube(ctx, x, y, s, seed, w = 1.5) {
  const d = s * 0.42;
  const f = [[x, y], [x + s, y], [x + s, y - s], [x, y - s]];
  const top = [[x, y - s], [x + s, y - s], [x + s + d, y - s - d * 0.7], [x + d, y - s - d * 0.7]];
  const side = [[x + s, y], [x + s + d, y - d * 0.7], [x + s + d, y - s - d * 0.7], [x + s, y - s]];
  sketchPoly(ctx, f, { w, seed, fill: WHITE, over: 3 });
  sketchPoly(ctx, top, { w, seed: seed + 1, fill: WHITE, over: 3 });
  sketchPoly(ctx, side, { w, seed: seed + 2, fill: WHITE, over: 3 });
  hatch(ctx, side, { angle: -62, gap: 6.5, w: w * 0.7, seed: seed + 3, cross: true, crossAngle: 70 });
  hatch(ctx, f, { angle: 48, gap: 11, w: w * 0.6, seed: seed + 4, skip: 0.2 });
}

/** Oblique box (w × h front face, depth d) with hatched side: buildings, crates, pillars, blocks. */
export function box(ctx, x, y, w, h, o = {}) {
  const { d = 30, seed = 1, lw = 2.2, gap = 6, front = 12, frontAngle = 48, cross = true, fill = WHITE } = o;
  const f = [[x, y], [x + w, y], [x + w, y - h], [x, y - h]];
  const top = [[x, y - h], [x + w, y - h], [x + w + d, y - h - d * 0.7], [x + d, y - h - d * 0.7]];
  const side = [[x + w, y], [x + w + d, y - d * 0.7], [x + w + d, y - h - d * 0.7], [x + w, y - h]];
  sketchPoly(ctx, top, { w: lw, seed: seed + 1, fill, over: 3 });
  sketchPoly(ctx, side, { w: lw, seed: seed + 2, fill, over: 3 });
  hatch(ctx, side, { angle: -62, gap, w: lw * 0.6, seed: seed + 3, cross, crossAngle: 70 });
  sketchPoly(ctx, f, { w: lw, seed, fill, over: 3 });
  if (front) hatch(ctx, f, { angle: frontAngle, gap: front, w: lw * 0.55, seed: seed + 4, skip: 0.12 });
}

/** Handwritten note (Bradley Hand). y is the baseline; rot in radians. */
export function scribble(ctx, text, x, y, size = 56, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = BLACK;
  ctx.font = `${size}px "Bradley Hand", "Noteworthy", cursive`;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Protractor outline with tick marks, flat edge at y = cy. */
export function protractor(ctx, cx, cy, pr, w = 1.5, seed = 31) {
  ctx.beginPath();
  const rr = rng(seed);
  for (let i = 0; i <= 36; i++) {
    const a = Math.PI + (i / 36) * Math.PI;
    const x = cx + Math.cos(a) * (pr + (rr() - 0.5) * 1.6), y = cy + Math.sin(a) * (pr + (rr() - 0.5) * 1.6);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  for (let i = 0; i <= 36; i++) {
    const a = Math.PI + (i / 36) * Math.PI;
    const l = i % 3 === 0 ? 20 : 10;
    ctx.moveTo(cx + Math.cos(a) * pr, cy + Math.sin(a) * pr);
    ctx.lineTo(cx + Math.cos(a) * (pr - l), cy + Math.sin(a) * (pr - l));
  }
  ctx.moveTo(cx + pr * 0.45, cy);
  ctx.arc(cx, cy, pr * 0.45, 0, Math.PI, true);
  ctx.lineWidth = w;
  ctx.strokeStyle = BLACK;
  ctx.stroke();
}

/** Set-square: outer triangle, inner cut-out, hatching between them. */
export function setSquare(ctx, tri, inner, seed = 21, w = 1.5) {
  sketchPoly(ctx, tri, { w: w * 1.2, seed, over: 6, passes: 2, rough: 1.6 });
  sketchPoly(ctx, inner, { w, seed: seed + 1, over: 4 });
  ctx.save();
  ctx.beginPath();
  tri.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  inner.slice().reverse().forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  ctx.clip('evenodd');
  hatch(ctx, tri, { angle: 52, gap: 13, gapEnd: 7, w: w * 0.7, seed: seed + 2, clip: false, skip: 0.1 });
  ctx.restore();
}

// ── ground ───────────────────────────────────────────────────────────────────
/**
 * Hatched ground line from x0 to x1 at canvas-y `y` (0 = the floor; a rooftop at height 300 is y = -300).
 *   dense: [xa, xb]  region drawn with tighter cross-hatching (shadow / damage)
 *   strokes: false   to drop the loose perspective strokes underneath (use for platforms)
 */
export function drawGround(ctx, x0, x1, vb, px, o = {}) {
  const { y = 0, dense = null, seed = 100, depth = 18, gap = 9.5, strokes = true, lw = 3 } = o;
  const TILE = 240;
  for (let x = x0; x < x1; x += TILE) {
    const xe = Math.min(x + TILE, x1);
    if (xe < vb.x0 || x > vb.x1) continue;
    const s = seed + Math.round(x);
    const dn = dense && xe > dense[0] && x < dense[1];
    hatch(ctx, [[x, y + 3], [xe, y + 3], [xe, y + (dn ? depth + 8 : depth)], [x, y + (dn ? depth + 8 : depth)]], {
      angle: 58, gap: dn ? gap * 0.66 : gap, w: Math.max(1.3, px), seed: s, cross: dn, crossAngle: 64, skip: 0.08,
    });
    if (strokes) {
      const r = rng(s + 7);
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const sx = x + r() * TILE, sy = y + 46 + r() * 90, len = 50 + r() * 120;
        pathLine(ctx, sx, sy, Math.min(sx + len, x1), sy + (r() - 0.5) * 3, 1, r);
      }
      ctx.lineWidth = Math.max(1.2, px);
      ctx.strokeStyle = BLACK;
      ctx.stroke();
    }
    line(ctx, x - 3, y, xe + 3, y, { w: Math.max(lw, 1.6 * px), seed: s, rough: 1.1 });
  }
}

/** Hatched contact shadow under a fighter. floorY = canvas y of the surface, lift = feet height above it. */
export function drawShadow(ctx, x, floorY, halfW, lift, seed) {
  const k = clamp(1 - lift / 520, 0.25, 1);
  const rx = halfW * (0.75 + 0.25 * k) * (lift > 4 ? 0.85 : 1);
  const n = 18;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    pts.push([x + Math.cos(a) * rx, floorY + 9 + Math.sin(a) * 7 * k]);
  }
  hatch(ctx, pts, { angle: 24, gap: lerp(9, 4.2, k), w: 1.5, seed, cross: k > 0.8, crossAngle: 96, skip: 0.02 });
}

/** Persistent skid scratches. skids: [{ t0, t1, x0, x1, y?, seed }] */
export function drawSkids(ctx, skids, t) {
  for (const s of skids) {
    if (t < s.t0) continue;
    const p = EASE.out(prog(t, s.t0, s.t1));
    const xe = lerp(s.x0, s.x1, p);
    const r = rng(600 + (s.seed || 1));
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const y = (s.y || 0) - 3 - i * 3.2 - r() * 2;
      const a = lerp(s.x0, xe, r() * 0.15), b = lerp(s.x0, xe, 0.85 + r() * 0.15);
      pathLine(ctx, a, y, b, y + (r() - 0.5) * 2, 1.2, r);
    }
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = BLACK;
    ctx.stroke();
  }
}

// ── cracks & tears ───────────────────────────────────────────────────────────
/** crackSet(seed, x, y, [{a: degrees (0 = right, -90 = up), len?, w?}], {len, step, w, branch}) */
export const crackSet = makeCracks;

/** Draw a crack set revealed to progress p (0..1). */
export function drawCracks(ctx, set, p, wScale = 1) {
  if (p <= 0) return;
  for (const c of set) {
    const q = clamp((p - c.start) / (1 - c.start + 1e-6));
    if (q <= 0) continue;
    const pts = trim(c.pts, q);
    const half = Math.max(2, Math.ceil(pts.length / 2));
    stroke(ctx, pts.slice(0, half), c.w * wScale);
    stroke(ctx, pts.slice(half - 1), c.w * 0.55 * wScale);
  }
}

/**
 * A rip in the page along a horizontal line: the black desk shows through, with curled flaps.
 * p = 0..1 opening progress. { x0, x1, y, depth, seed, flaps }
 */
export function drawTear(ctx, o, p) {
  if (p <= 0) return;
  const { x0, x1, y = 4, depth = 28, seed = 140, flaps = 5 } = o;
  const e = EASE.out(clamp(p));
  const cx = (x0 + x1) / 2;
  const xa = lerp(cx, x0, e), xb = lerp(cx, x1, e);
  const r = rng(seed);
  const up = [], lo = [];
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const x = lerp(xa, xb, k);
    const belly = Math.sin(k * Math.PI);
    up.push([x, y + (r() - 0.5) * 5 * belly + (i % 2 ? 3 : 0) * belly]);
    lo.push([x, y + 2 + belly * (depth * 0.7 + r() * depth * 0.45) * e]);
  }
  ctx.beginPath();
  up.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
  lo.reverse().forEach((q) => ctx.lineTo(q[0], q[1]));
  ctx.closePath();
  ctx.fillStyle = BLACK;
  ctx.fill();
  for (let i = 0; i < flaps; i++) {
    const k = 0.14 + (i * 0.72) / Math.max(1, flaps - 1) + r() * 0.04;
    const x = lerp(xa, xb, k);
    const fy = y + 4 + Math.sin(k * Math.PI) * depth * 0.9 * e;
    const s = (16 + r() * 16) * e;
    const f = [[x - s, fy], [x + s * 0.2, fy - s * (0.7 + r() * 0.5)], [x + s, fy + 2]];
    sketchPoly(ctx, f, { w: 2, seed: seed + 10 + i, fill: WHITE, rough: 0.8 });
    hatch(ctx, f, { angle: 70, gap: 5, w: 1.1, seed: seed + 20 + i });
  }
}

// ── bullet holes ─────────────────────────────────────────────────────────────
/**
 * Persistent holes punched through the page: ragged black hole (the desk shows through),
 * short radiating cracks and a curled paper flap. holes: [{ t, x, h, r, seed }] (h = height).
 * The scene runtime draws its own S.shot / S.hole list automatically after env.stage; call this
 * yourself (and set env.ownHoles = true) only if you need them on a different layer.
 */
export function drawBulletHoles(ctx, holes, t) {
  for (const o of holes) {
    if (t < o.t) continue;
    const p = clamp((t - o.t) / 0.1);
    const r = rng(o.seed);
    const R = o.r * (0.55 + 0.45 * EASE.out(p));
    const cx = o.x, cy = -o.h;
    ctx.beginPath();
    const n = 11;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + r() * 0.3;
      const k = R * (i % 2 ? 0.72 + r() * 0.2 : 1 + r() * 0.3);
      i ? ctx.lineTo(cx + Math.cos(a) * k, cy + Math.sin(a) * k) : ctx.moveTo(cx + Math.cos(a) * k, cy + Math.sin(a) * k);
    }
    ctx.closePath();
    ctx.fillStyle = BLACK;
    ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = r() * TAU, l0 = R * 1.05, l1 = R * (1.7 + r() * 1.5) * EASE.out(p);
      const b = a + (r() - 0.5) * 0.5;
      ctx.moveTo(cx + Math.cos(a) * l0, cy + Math.sin(a) * l0);
      ctx.lineTo(cx + Math.cos(b) * (l0 + l1) / 2, cy + Math.sin(b) * (l0 + l1) / 2);
      ctx.lineTo(cx + Math.cos(a) * l1, cy + Math.sin(a) * l1);
    }
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = BLACK;
    ctx.lineCap = 'round';
    ctx.stroke();
    const fa = r() * TAU, fs = R * 0.9;
    const f = [[cx + Math.cos(fa) * R * 0.8, cy + Math.sin(fa) * R * 0.8], [cx + Math.cos(fa + 0.9) * R * 1.1, cy + Math.sin(fa + 0.9) * R * 1.1], [cx + Math.cos(fa + 0.4) * (R + fs), cy + Math.sin(fa + 0.4) * (R + fs)]];
    sketchPoly(ctx, f, { w: 1.6, seed: o.seed + 1, fill: WHITE, rough: 0.5 });
  }
}

// ── flying chunks ────────────────────────────────────────────────────────────
function drawChunk(ctx, c, x, y, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const hw = c.w / 2, hh = c.h / 2;
  const pts = c.pts || [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
  sketchPoly(ctx, pts, { w: 2.2, seed: c.seed, fill: c.ink ? BLACK : WHITE, over: 2 });
  if (!c.ink) hatch(ctx, pts, { angle: -34, gap: 8, w: 1.2, seed: c.seed + 1, skip: 0.15 });
  ctx.restore();
}

/**
 * Ballistic debris that lands and stays (rubble).
 *   const d = makeDebris([{ t, x, y, w, h, vx, vy, om?, floor?, pts?, ink?, chips? }], seed)
 *   d.draw(ctx, t, front)   front=true → pieces still flying (draw over the fighters),
 *                           front=false → pieces at rest (draw behind the fighters)
 * x,y = start centre (canvas coords, y negative = up); vx,vy in units/s (vy negative = up);
 * floor = canvas y of the surface it lands on (default 0).
 */
export function makeDebris(list, seed = 900) {
  const q = rng(seed);
  const P = list.map((c, i) => {
    const p = { g: 2100, om: (q() - 0.5) * 12, floor: 0, chips: 4, seed: seed + i * 7, ...c };
    const rest = p.floor - p.h * 0.42;
    const A = 0.5 * p.g, B = p.vy, Cc = p.y - rest;
    const disc = B * B - 4 * A * Cc;
    p.tl = disc > 0 ? (-B + Math.sqrt(disc)) / (2 * A) : 0;
    p.lx = p.x + p.vx * p.tl;
    p.restRot = (q() - 0.5) * 0.35 + (q() < 0.5 ? 0 : Math.PI);
    p.restY = rest - (q() < 0.3 ? p.h * 0.7 : 0);
    p.cl = [];
    for (let j = 0; j < p.chips; j++) p.cl.push({ vx: p.vx * 0.4 + (q() - 0.5) * 600, vy: -(100 + q() * 700), s: 4 + q() * 9, om: (q() - 0.5) * 30, ox: (q() - 0.5) * p.w, oy: (q() - 0.5) * p.h });
    return p;
  });
  return {
    pieces: P,
    draw(ctx, t, front) {
      for (const p of P) {
        if (t < p.t) continue;
        const tau = t - p.t;
        const flying = tau < p.tl;
        if (flying && front) {
          drawChunk(ctx, p, p.x + p.vx * tau, p.y + p.vy * tau + 0.5 * p.g * tau * tau, p.om * tau);
          ctx.fillStyle = BLACK;
          for (const c of p.cl) {
            const cx = p.x + c.ox + c.vx * tau, cy = p.y + c.oy + c.vy * tau + 0.5 * 2400 * tau * tau;
            if (cy > p.floor - 2) continue;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(c.om * tau);
            ctx.beginPath();
            ctx.moveTo(-c.s, c.s * 0.6); ctx.lineTo(c.s, c.s * 0.4); ctx.lineTo(0, -c.s);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
        } else if (!flying && !front) {
          const bt = tau - p.tl;
          const bounce = bt < 0.18 ? -Math.sin((bt / 0.18) * Math.PI) * 10 : 0;
          drawChunk(ctx, p, p.lx, p.restY + bounce, p.restRot);
        }
      }
    },
  };
}

// ── breakable brick wall ─────────────────────────────────────────────────────
/**
 * const wall = makeBrickWall({ x0, x1, base = 0, rows = 10, row = 48, bw = 112, seed })
 *   wall.smash(t, x, y, radius, {dir})        blast a crater: bricks within the (1.25:1) ellipse fly out
 *   wall.collapse(t, sel, {dir})              bricks matching sel(brick) drop (brick: {x,y,w,h,cx,cy,row})
 *   wall.crack(t, x, y, dirs, opts)           cracks growing from a point (see crackSet)
 *   wall.bruise(t, x, y, radius)              cross-hatched damage shadow spreading from a point
 *   wall.draw(ctx, t)        wall.drawDebris(ctx, t, front)   (front as in makeDebris)
 * Canvas coords: base = canvas y of the wall foot (0 = floor); the wall rises to base - rows*row.
 */
export function makeBrickWall(o) {
  const { x0, x1, base = 0, rows = 10, row = 48, bw = 112, seed = 300, depth = 40 } = o;
  const H = rows * row;
  const r = rng(seed);
  const bricks = [];
  for (let rw = 0; rw < rows; rw++) {
    const y = base - (rw + 1) * row;
    for (let x = x0 + (rw % 2 ? -bw / 2 : 0); x < x1; x += bw) {
      const bx0 = Math.max(x, x0), bx1 = Math.min(x + bw, x1);
      if (bx1 - bx0 < 8) continue;
      bricks.push({ x: bx0, y, w: bx1 - bx0, h: row, cx: (bx0 + bx1) / 2, cy: y + row / 2, row: rw, seed: seed + 100 + bricks.length * 7, rm: Infinity, shade: r() < 0.17 });
    }
  }
  const cracks = [], bruises = [];
  let debris = null;
  const pending = [];
  const launch = (b, t, kind, dir, origin) => {
    const q = rng(b.seed + 3);
    b.rm = t;
    const blast = kind === 'blast';
    let vx = blast ? dir * (80 + q() * 420) : dir * (40 + q() * 260);
    const vy = blast ? -(180 + q() * 520) : -(q() * 120) + 40;
    pending.push({ t, x: b.cx, y: b.cy, w: b.w, h: b.h, vx, vy, om: (q() - 0.5) * (blast ? 16 : 9), floor: base, seed: b.seed, chips: 5, _keep: [x0, x1, dir] });
    debris = null;
  };
  const wall = {
    bricks, x0, x1, base, h: H,
    smash(t, x, y, radius, opt = {}) {
      const dir = opt.dir ?? -1;
      for (const b of bricks) {
        if (b.rm !== Infinity) continue;
        const d = Math.hypot((b.cx - x) / 1.25, b.cy - y);
        if (d < radius) launch(b, t + d * 0.00035, 'blast', dir);
      }
      return wall;
    },
    collapse(t, sel, opt = {}) {
      const dir = opt.dir ?? -1;
      for (const b of bricks) {
        if (b.rm !== Infinity || !sel(b)) continue;
        launch(b, t + (rows - 1 - b.row) * 0.028 + Math.abs(b.cx - (dir < 0 ? x0 : x1)) * 0.00018, 'fall', dir);
      }
      return wall;
    },
    crack(t, x, y, dirs, opt = {}) {
      cracks.push({ t, grow: opt.grow ?? 0.32, set: makeCracks(opt.seed ?? seed + 50 + cracks.length * 13, x, y, dirs, { len: 300, step: 26, w: 3.4, ...opt }) });
      return wall;
    },
    bruise(t, x, y, radius) {
      bruises.push({ t, x, y, radius, seed: seed + 70 + bruises.length * 5 });
      return wall;
    },
    _debris() {
      if (!debris) {
        debris = makeDebris(pending, seed + 9);
        // keep rubble out of the wall's own footprint
        for (const p of debris.pieces) {
          const [a, b, dir] = p._keep;
          if (p.lx > a - 30 && p.lx < b + 30 && p.tl > 0) {
            const tx = dir < 0 ? a - 40 - (p.seed % 120) : b + 40 + (p.seed % 120);
            p.vx = (tx - p.x) / p.tl;
            p.lx = tx;
          }
        }
      }
      return debris;
    },
    drawDebris(ctx, t, front) { wall._debris().draw(ctx, t, front); },
    draw(ctx, t) {
      const present = bricks.filter((b) => t < b.rm);
      if (!present.length) return;
      const topRow = present.filter((b) => b.row === rows - 1);
      if (topRow.length) {
        const tx0 = Math.min(...topRow.map((b) => b.x)), tx1 = Math.max(...topRow.map((b) => b.x + b.w));
        sketchPoly(ctx, [[tx0, base - H], [tx1, base - H], [tx1 + depth, base - H - depth * 0.7], [tx0 + depth, base - H - depth * 0.7]], { w: 2.4, seed: seed + 10, fill: WHITE, over: 3 });
      }
      const sideB = present.filter((b) => b.x + b.w >= x1 - 1);
      if (sideB.length) {
        const top = Math.min(...sideB.map((b) => b.y));
        const side = [[x1, base], [x1, top], [x1 + depth, top - depth * 0.7], [x1 + depth, base - depth * 0.7]];
        sketchPoly(ctx, side, { w: 2.4, seed: seed + 11, fill: WHITE, over: 3 });
        hatch(ctx, side, { angle: -58, gap: 5, w: 1.4, seed: seed + 12, cross: true, crossAngle: 66 });
      }
      ctx.fillStyle = WHITE;
      ctx.beginPath();
      for (const b of present) ctx.rect(b.x, b.y, b.w, b.h);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      for (const b of present) ctx.rect(b.x - 0.5, b.y - 0.5, b.w + 1, b.h + 1);
      ctx.clip();
      const W = x1 - x0;
      hatch(ctx, [[x0 + W * 0.25, base], [x1, base - H * 0.88], [x1, base]], { angle: 44, gap: 9, gapEnd: 6, w: 1.3, seed: seed + 20, clip: false });
      hatch(ctx, [[x0, base], [x1, base], [x1, base - 34], [x0, base - 24]], { angle: -40, gap: 6.5, w: 1.3, seed: seed + 21, cross: true, clip: false });
      hatch(ctx, [[x0, base - H], [x0 + 40, base - H], [x0 + 22, base], [x0, base]], { angle: -64, gap: 6, w: 1.3, seed: seed + 22 });
      for (const b of present) {
        if (b.shade) hatch(ctx, [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]], { angle: -34, gap: 6, w: 1.2, seed: b.seed });
      }
      for (const br of bruises) {
        if (t < br.t) continue;
        const p = prog(t, br.t, br.t + 0.5);
        const R = br.radius * (0.27 + 0.73 * EASE.out(p));
        const pts = [];
        const rr = rng(br.seed);
        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * TAU;
          const k = R * (0.82 + rr() * 0.36);
          pts.push([br.x + Math.cos(a) * k * 1.15, br.y + Math.sin(a) * k]);
        }
        hatch(ctx, pts, { angle: -52, gap: 9, gapEnd: 17, w: 1.4, seed: br.seed + 1 + (p < 1 ? Math.floor(t * 15) % 2 : 0), cross: true, crossAngle: 74 });
      }
      for (const c of cracks) if (t >= c.t) drawCracks(ctx, c.set, prog(t, c.t, c.t + c.grow));
      ctx.restore();
      for (const b of present) {
        sketchPoly(ctx, [[b.x + 1, b.y + 1], [b.x + b.w - 1, b.y + 1], [b.x + b.w - 1, b.y + b.h - 1], [b.x + 1, b.y + b.h - 1]], { w: 2.1, seed: b.seed, rough: 1, over: 2.5 });
      }
    },
  };
  return wall;
}
