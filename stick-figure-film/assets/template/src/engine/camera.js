// Cinematography: a keyframed 2D camera (pan / zoom / roll), fighter tracking and shake.
//
// Camera key:  { t, y, z, r?, e?,  x | a, b (+ x as offset) }
//   y  world y of the frame centre (NEGATIVE = up; fighters' chests are around -150)
//   z  zoom (1 = 1920 world units across; 0.5 = whole notebook page; 2.5 = close-up)
//   r  roll in degrees          e  ease INTO this key (lin, in, out, io, io3, snap, …)
//   x  absolute world x — or — a / b = tracking weights on fighter A / B (x then is an offset)
// Tracked keys follow the fighters automatically, so retiming a fight keeps its framing.

import { EASE, clamp, lerp, segIndex, noise1, DEG } from './util.js';

function keyX(k, ax, bx) {
  return (k.a || 0) * ax + (k.b || 0) * bx + (k.x || 0);
}

/** keys: camera keys; shakes: [{t, amp(px), dur}]; hipA/hipB: (t) => [x, y] */
export function makeCamera(keys, shakes, hipA, hipB) {
  const smooth = (fn, t) => {
    let s = 0;
    for (let i = -2; i <= 2; i++) s += fn(t + i * 0.05)[0];
    return s / 5;
  };
  return function camera(t) {
    const i = segIndex(keys, t);
    const k0 = keys[i], k1 = keys[i + 1] || k0;
    const u = k1 === k0 ? 0 : (EASE[k1.e] || EASE.io)(clamp((t - k0.t) / (k1.t - k0.t)));
    const ax = smooth(hipA, t), bx = smooth(hipB, t);
    const x = lerp(keyX(k0, ax, bx), keyX(k1, ax, bx), u);
    const y = lerp(k0.y, k1.y, u);
    const z = Math.exp(lerp(Math.log(k0.z), Math.log(k1.z), u));
    let r = lerp(k0.r || 0, k1.r || 0, u);
    let sx = 0, sy = 0;
    for (const s of shakes) {
      const p = (t - s.t) / s.dur;
      if (p < 0 || p > 1) continue;
      const d = (1 - p) * (1 - p) * s.amp;
      sx += noise1(t * 38, 3 + s.t) * d;
      sy += noise1(t * 41, 9 + s.t) * d;
      r += noise1(t * 30, 17 + s.t) * d * 0.035;
    }
    return { x, y, z, r, sx, sy };
  };
}

/** World visible extent (conservative) for culling. */
export function viewBounds(cam, W, H) {
  const R = Math.hypot(W, H) / 2 / cam.z + 40;
  // while orbiting, the world is foreshortened and the layers slide: more of it is in view
  const k = cam.orbit ? 1 / Math.max(0.25, Math.cos(cam.orbit * DEG)) : 1;
  const pad = cam.orbit ? 950 : 0;
  return { x0: cam.x - R * k - pad, x1: cam.x + R * k + pad, y0: cam.y - R, y1: cam.y + R };
}

/**
 * depth: how far in front of (+) or behind (−) the fighters' plane a layer sits, in world units.
 * It only matters while the camera ORBITS (cam.orbit, degrees, about the vertical axis through
 * world x = cam.opx): the fighters' plane foreshortens by cos θ and every layer slides sideways
 * by depth·sin θ — the 2D stand-in for a camera arcing around the action.
 */
export function applyCamera(ctx, cam, W, H, parallax = 1, anchor = [1100, -265], depth = 0) {
  const cx = anchor[0] + (cam.x - anchor[0]) * parallax;
  const cy = anchor[1] + (cam.y - anchor[1]) * parallax;
  ctx.translate(W / 2 + cam.sx, H / 2 + cam.sy);
  ctx.rotate(cam.r * DEG);
  ctx.scale(cam.z, cam.z);
  ctx.translate(-cx, -cy);
  if (cam.orbit) {
    const a = cam.orbit * DEG;
    const pivot = cam.opx - cam.x + cx; // the pivot expressed in this layer's coordinates
    ctx.translate(pivot + depth * Math.sin(a), 0);
    ctx.scale(Math.cos(a), 1);
    ctx.translate(-pivot, 0);
  }
}

export function worldToScreen(cam, W, H, p) {
  const px = cam.orbit ? cam.opx + (p[0] - cam.opx) * Math.cos(cam.orbit * DEG) : p[0];
  const dx = (px - cam.x) * cam.z, dy = (p[1] - cam.y) * cam.z;
  const c = Math.cos(cam.r * DEG), s = Math.sin(cam.r * DEG);
  return [W / 2 + cam.sx + dx * c - dy * s, H / 2 + cam.sy + dx * s + dy * c];
}
