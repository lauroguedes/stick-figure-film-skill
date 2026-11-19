// The cast, the shared pose library and the choreography helpers every scene uses.
// Pose format: see the header of rig.js.

import { BASE_POSE, buildTrack } from './rig.js';
import { lerp } from './util.js';

export const FIGHTER_A = { name: 'A', scale: 0.95, line: 4.6, fist: 0 };   // The Technician
export const FIGHTER_B = { name: 'B', scale: 1.1, line: 6.2, fist: 5.4 };  // The Powerhouse

// Named poses (local space: x = forward, y = up; hands relative to the shoulder, feet to the base).
// Use them as { p: 'name', ...overrides }. A scene can add its own via makeTrack(ch, keys, extra).
export const POSES = {
  stand: {},
  // ── Fighter A: narrow, upright, springy ──
  aStance: { hip: [-4, 92], lean: 8, bend: 4, hF: [38, -2], hB: [16, -14], fF: [30, 0], fB: [-28, 0] },
  aTuck: { hip: [0, 60], lean: 26, curl: 0.3, bend: 8, hF: [28, -44], hB: [24, -50], fF: [30, 22], fB: [24, 16] },
  // ── Fighter B: wide, low, hunched ──
  bStance: { hip: [0, 80], lean: 18, bend: 9, tilt: 8, hF: [30, -30], hB: [-6, -38], fF: [46, 0], fB: [-46, 0] },
  bRun1: { hip: [0, 80], lean: 36, bend: 6, hB: [-58, 6], hF: [44, -16], fF: [56, 0], fB: [-66, 28] },
  bRun2: { hip: [0, 80], lean: 36, bend: 6, hB: [-58, 6], hF: [-20, -36], fF: [-66, 28], fB: [56, 0] },
  // ── generic (either fighter) ──
  run1: { hip: [0, 84], lean: 30, hF: [40, -20], hB: [-36, -24], fF: [52, 0], fB: [-62, 26] },
  run2: { hip: [0, 84], lean: 30, hF: [-30, -30], hB: [36, -16], fF: [-62, 26], fB: [52, 0] },
  crouch: { hip: [0, 50], lean: 30, bend: 8, hF: [26, -44], hB: [-10, -48], fF: [34, 0], fB: [-34, 0] },
  tuck: { hip: [0, 60], lean: 26, curl: 0.3, bend: 8, hF: [28, -44], hB: [24, -50], fF: [30, 22], fB: [24, 16] },
  airUp: { hip: [0, 84], lean: 6, hF: [26, 40], hB: [-10, 46], fF: [14, 10], fB: [-24, 24] },
  airFall: { hip: [0, 86], lean: 10, hF: [34, 26], hB: [-30, 24], fF: [14, 0], fB: [-12, 8] },
  landDeep: { hip: [0, 46], lean: 32, bend: 10, hF: [22, -58], hB: [-12, -56], fF: [32, 0], fB: [-32, 0] },
  threePoint: { hip: [-14, 40], lean: 55, tilt: -34, hF: [14, -76], hB: [-50, 30], fF: [22, 0], fB: [-70, 0], kB: -1 },
  // hit reactions
  hitBack: { hip: [-20, 74], lean: -30, tilt: -34, hF: [50, 22], hB: [42, 32], fF: [34, 10], fB: [-40, 0] },
  fold: { hip: [-22, 80], lean: 38, bend: 22, hF: [52, -18], hB: [56, -4], fF: [44, 8], fB: [26, 2] },
  stagger: { hip: [-14, 72], lean: -16, tilt: -18, hF: [36, 44], hB: [-44, 38], fF: [30, 0], fB: [-50, 0] },
  flyBack: { hip: [0, 56], lean: 58, bend: 16, hF: [60, 10], hB: [66, -8], fF: [72, 44], fB: [62, 22] },
  kneel: { hip: [0, 44], lean: 26, bend: 12, tilt: 14, hF: [20, -60], hB: [-6, -52], fF: [36, 0], fB: [-40, 0] },
  lying: { hip: [0, 9], lean: -86, tilt: 0, hF: [-34, -4], hB: [10, -6], fF: [102, 3], fB: [96, 3], eF: 1, eB: 1 },
  // armed: light / one-handed (weapon in hF)
  guard1: { hip: [-4, 90], lean: 8, bend: 4, hF: [42, -6], hB: [8, -26], fF: [32, 0], fB: [-30, 0] },
  windBack: { hip: [-12, 88], lean: -12, hF: [-26, 10], hB: [22, -20], fF: [30, 0], fB: [-30, 0] },
  slashEnd: { hip: [10, 86], lean: 22, hF: [62, 6], hB: [-20, -24], fF: [40, 0], fB: [-36, 0] },
  thrust: { hip: [16, 82], lean: 30, hF: [78, -6], hB: [-24, -20], fF: [56, 0], fB: [-56, 0] },
  // armed: two-handed (back hand is placed on the weapon automatically when `two` > 0)
  guard2: { hip: [-4, 88], lean: 8, bend: 4, hF: [42, -10], hB: [16, -30], fF: [32, 0], fB: [-30, 0] },
  high: { hip: [-8, 94], lean: -10, hF: [-4, 70], hB: [-18, 60], fF: [28, 0], fB: [-30, 0] },
  chop: { hip: [10, 62], lean: 40, bend: 8, hF: [54, -30], hB: [32, -30], fF: [44, 0], fB: [-44, 0] },
  parryHigh: { hip: [-6, 78], lean: -4, hF: [36, 42], hB: [-10, 38], fF: [32, 0], fB: [-30, 0] },
  // heavy weapons: big anticipation, deep follow-through
  heavyRest: { hip: [-6, 84], lean: 4, bend: 6, hF: [10, 8], hB: [-10, -6], fF: [40, 0], fB: [-40, 0] },
  heavyWind: { hip: [-24, 76], lean: -18, bend: -4, hF: [-44, 26], hB: [-52, 10], fF: [46, 0], fB: [-46, 0] },
  heavyEnd: { hip: [22, 58], lean: 50, bend: 12, hF: [50, -44], hB: [30, -44], fF: [52, 0], fB: [-54, 0] },
};

/**
 * Ballistic flight. Returns keys (mid-air poses + the landing) lying on one true parabola.
 *   ...flight(t0, t1, [x0, y0], [x1, y1], g, [[t, pose], ...], landingPose)
 * The key just BEFORE this call must be the take-off pose at t0 with x=x0, y=y0.
 * g is gravity in units/s²; apex above the chord = g·T²/8 (2400 = flat line-drive, 6000 = high leap).
 */
export function flight(t0, t1, from, to, g, mids, land) {
  const T = t1 - t0;
  const v = (to[1] - from[1] + 0.5 * g * T * T) / T;
  const at = (t) => {
    const tau = t - t0;
    return [lerp(from[0], to[0], tau / T), from[1] + v * tau - 0.5 * g * tau * tau];
  };
  const out = [];
  let prev = t0;
  for (const [t, p] of [...mids, [t1, land]]) {
    const [x, y] = t === t1 ? to : at(t);
    out.push({ er: 'lin', e: 'lin', ...p, t, x, y, hop: (g * (t - prev) * (t - prev)) / 8 });
    prev = t;
  }
  return out;
}

/**
 * Turn a list of keys into a track.
 *   key = { t, p?: 'poseName' | {pose}, same?: true, x?, y?, face?, e?, er?, ...pose overrides }
 * x and face are sticky (carried from the previous key); y defaults to 0 (on the floor).
 * `same: true` repeats the previous pose (hit-stops, holds).
 */
export function makeTrack(ch, list, extra = {}) {
  const lib = { ...POSES, ...extra };
  let x = 0;
  let face = 1;
  let last = null;
  const out = [];
  let prevT = -Infinity;
  for (const k of list) {
    if (!(k.t > prevT)) console.warn(`[${ch.name}] key at t=${k.t} is not after t=${prevT}`);
    prevT = k.t;
    let base = typeof k.p === 'string' ? lib[k.p] : k.p || {};
    if (typeof k.p === 'string' && !lib[k.p]) console.warn(`[${ch.name}] unknown pose "${k.p}" at t=${k.t}`);
    if (k.same && last) {
      const { hop, e, er, slide, reveal, same, t, turnF, turnB, ...rest } = last;
      base = rest;
    }
    const m = { ...BASE_POSE, ...base, ...k };
    if (k.x == null) m.x = x; else x = k.x;
    if (k.face == null) m.face = face; else face = k.face;
    last = m;
    out.push(m);
  }
  return buildTrack(ch, out);
}
