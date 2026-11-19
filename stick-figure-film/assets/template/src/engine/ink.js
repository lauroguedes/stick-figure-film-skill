// Pen-and-ink drawing primitives: wobbly lines, sketchy polygons, hatching.
// The whole film is drawn with these: only #000 and #fff are ever used.

import { rng, TAU, DEG } from './util.js';

export const BLACK = '#000000';
export const WHITE = '#ffffff';

/** Append a hand-drawn line a→b to the current path (no stroke). */
export function pathLine(ctx, ax, ay, bx, by, rough, r) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 0.01) return;
  const nx = -dy / len;
  const ny = dx / len;
  const j = () => (r() - 0.5) * 2 * rough;
  const sx = ax + j() * 0.5 * (dx / len) + nx * j() * 0.4;
  const sy = ay + j() * 0.5 * (dy / len) + ny * j() * 0.4;
  const ex = bx + j() * 0.5 * (dx / len) + nx * j() * 0.4;
  const ey = by + j() * 0.5 * (dy / len) + ny * j() * 0.4;
  ctx.moveTo(sx, sy);
  if (len < 26 || rough === 0) {
    ctx.lineTo(ex, ey);
    return;
  }
  // one or two gentle bows, like a ruler-less pen stroke
  const b1 = j() * Math.min(1.6, len / 120 + 0.6);
  const b2 = j() * Math.min(1.6, len / 120 + 0.6);
  ctx.bezierCurveTo(
    ax + dx * 0.33 + nx * b1, ay + dy * 0.33 + ny * b1,
    ax + dx * 0.66 + nx * b2, ay + dy * 0.66 + ny * b2,
    ex, ey,
  );
}

/** Stroke one sketchy line. */
export function line(ctx, ax, ay, bx, by, o = {}) {
  const { w = 2, rough = 1.2, seed = 1, color = BLACK, passes = 1 } = o;
  const r = rng(seed);
  ctx.beginPath();
  for (let p = 0; p < passes; p++) pathLine(ctx, ax, ay, bx, by, rough, r);
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.stroke();
}

/** Sketchy closed/open polygon: every edge is its own slightly overshooting stroke. */
export function sketchPoly(ctx, pts, o = {}) {
  const { w = 2, rough = 1.2, seed = 1, close = true, fill = null, color = BLACK, over = 0, passes = 1 } = o;
  if (fill) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  const r = rng(seed);
  ctx.beginPath();
  const n = close ? pts.length : pts.length - 1;
  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      let ax = a[0], ay = a[1], bx = b[0], by = b[1];
      if (over) {
        const l = Math.hypot(bx - ax, by - ay) || 1;
        const ox = ((bx - ax) / l) * over * r();
        const oy = ((by - ay) / l) * over * r();
        ax -= ox; ay -= oy; bx += ox; by += oy;
      }
      pathLine(ctx, ax, ay, bx, by, rough, r);
    }
  }
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** Plain polyline stroke (used for characters: clean, confident lines). */
export function stroke(ctx, pts, w, color = BLACK) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function polyPath(ctx, pts) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
}

/**
 * Hatch a polygon with parallel pen strokes.
 *  angle  degrees (screen space, 0 = horizontal)
 *  gap    distance between strokes; `gapEnd` lets density vary across the shape
 *  cross  true → second pass at angle + crossAngle (cross-hatching)
 *  skip   probability that a stroke is broken/omitted (airier hatching)
 */
export function hatch(ctx, pts, o = {}) {
  const {
    angle = 45, gap = 8, gapEnd = null, w = 1.4, rough = 1, seed = 1,
    cross = false, crossAngle = 78, skip = 0.06, color = BLACK, clip = true,
  } = o;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p[0] < minX) minX = p[0];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const R = Math.hypot(maxX - minX, maxY - minY) / 2 + 2;
  ctx.save();
  if (clip) {
    polyPath(ctx, pts);
    ctx.clip();
  }
  const passes = cross ? [angle, angle + crossAngle] : [angle];
  const r = rng(seed);
  ctx.beginPath();
  for (const ang of passes) {
    const a = ang * DEG;
    const ux = Math.cos(a), uy = Math.sin(a);
    const nx = -uy, ny = ux;
    let d = -R + r() * gap;
    while (d < R) {
      const f = (d + R) / (2 * R);
      const g = gapEnd == null ? gap : gap + (gapEnd - gap) * f;
      if (r() >= skip) {
        const wob = (r() - 0.5) * 0.035; // strokes are never perfectly parallel
        const s0 = -R * (0.96 + r() * 0.04);
        const s1 = R * (0.96 + r() * 0.04);
        const ox = cx + nx * d, oy = cy + ny * d;
        const vx = ux * Math.cos(wob) - uy * Math.sin(wob);
        const vy = ux * Math.sin(wob) + uy * Math.cos(wob);
        pathLine(ctx, ox + vx * s0, oy + vy * s0, ox + vx * s1, oy + vy * s1, rough, r);
      } else {
        r(); r(); r();
      }
      d += g * (0.82 + r() * 0.36);
    }
  }
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

/** Wobbly circle/ellipse outline (optionally filled first). */
export function blob(ctx, x, y, rx, ry, o = {}) {
  const { w = 2, rough = 0.12, seed = 1, fill = null, color = BLACK, n = 14, rot = 0, strokeIt = true } = o;
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rot;
    const k = 1 + (r() - 0.5) * 2 * rough;
    pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]);
  }
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const p0 = pts[i % n];
    const p1 = pts[(i + 1) % n];
    const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
    if (i === 0) ctx.moveTo(mx, my);
    else ctx.quadraticCurveTo(p0[0], p0[1], mx, my);
  }
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (strokeIt) {
    ctx.lineWidth = w;
    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

/** Trim a polyline to its first `f` (0..1) of arc length: used for "draw-on" reveals. */
export function trim(pts, f) {
  if (f >= 1) return pts;
  if (f <= 0) return [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let left = total * f;
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (l <= left) {
      out.push(pts[i]);
      left -= l;
    } else {
      const k = left / (l || 1);
      out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]);
      break;
    }
  }
  return out;
}

/** Jagged crack polyline generator. Returns array of {pts, w} branches. */
export function makeCracks(seed, ox, oy, dirs, o = {}) {
  const { len = 200, step = 22, jag = 0.55, branch = 0.28, w = 3 } = o;
  const r = rng(seed);
  const out = [];
  const grow = (x, y, ang, L, width, depth) => {
    const pts = [[x, y]];
    let a = ang;
    let travelled = 0;
    while (travelled < L) {
      const s = step * (0.6 + r() * 0.9);
      a += (r() - 0.5) * 2 * jag;
      a = ang + (a - ang) * 0.7; // keep heading roughly true
      x += Math.cos(a) * s;
      y += Math.sin(a) * s;
      pts.push([x, y]);
      travelled += s;
      if (depth < 2 && r() < branch) {
        grow(x, y, a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.6), (L - travelled) * (0.35 + r() * 0.4), width * 0.6, depth + 1);
      }
    }
    out.push({ pts, w: width, start: depth * 0.25 });
  };
  for (const d of dirs) {
    const L = len * (d.len ?? 1) * (0.75 + r() * 0.5);
    grow(ox, oy, d.a * DEG, L, w * (d.w ?? 1), 0);
  }
  return out;
}
