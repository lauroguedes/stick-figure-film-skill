// Small math helpers shared by every module. Everything is deterministic.

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const mul = (a, s) => [a[0] * s, a[1] * s];
/** progress of t inside [a,b], clamped to 0..1 */
export const prog = (t, a, b) => clamp((t - a) / (b - a));

export const EASE = {
  lin: (t) => t,
  in: (t) => t * t,
  in3: (t) => t * t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  out3: (t) => 1 - Math.pow(1 - t, 3),
  io: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  io3: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  snap: (t) => 1 - Math.pow(1 - t, 4),
  exp: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  back: (t) => {
    const c = 1.9;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  },
  hold: (t) => (t < 1 ? 0 : 1),
};

/** mulberry32: tiny seeded PRNG, returns () => [0,1) */
export function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

/** smooth 1D value noise in [-1,1] */
export function noise1(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i + seed * 57.3), hash(i + 1 + seed * 57.3), u) * 2 - 1;
}

/** shortest-path angle interpolation (radians) */
export function lerpAngle(a, b, t) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}

/** find segment index i such that keys[i].t <= t < keys[i+1].t */
export function segIndex(keys, t) {
  let lo = 0;
  let hi = keys.length - 1;
  if (t <= keys[0].t) return 0;
  if (t >= keys[hi].t) return hi - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (keys[m].t <= t) lo = m;
    else hi = m;
  }
  return lo;
}
