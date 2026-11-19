// SCENE 3 — "Geometry Zone" (22 s). Long blades and a spear on a ruler that is a see-saw.
//
// Stage: an abstract maths space. The floor is a long RULER (rest x 300…2000) balanced on the
// apex of a big set square at x = 1150, so it tilts toward whoever stands further out, and it can
// be split (16.9, by B's spear) and cut (19.5, by A's longsword). Floating shapes around it:
// a drawing compass whose needle arm becomes B's spear, a cube that catches B's shortsword, a
// set square and a small cube used as stepping stones, a cube that ends up skewered on the spear.
//
// Heights: the ruler's top surface rests at height H0 = -120 (not 0!). Keeping it just under 0
// makes the rig treat feet on it as grounded (planted feet, automatic step lift) while every jump
// still rises into the rig's "airborne" range. `ph(x, t)` returns the surface height under x at
// time t for whatever piece of ruler is there; `ground()` turns pose keys without an explicit
// `y` into keys standing on that surface (base height + feet following the slope).

import { createScene } from '../engine/scene.js';
import { flight, POSES } from '../engine/moves.js';
import { BASE_POSE } from '../engine/rig.js';
import { DEG, TAU, rng, clamp, prog, EASE, lerp, hash } from '../engine/util.js';
import { sketchPoly, hatch, stroke, line, BLACK, WHITE } from '../engine/ink.js';
import { cube, protractor, setSquare, scribble, drawTear, crackSet, drawCracks, makeDebris } from '../engine/kit.js';

const S = createScene({
  id: 's3', title: 'Geometry Zone', duration: 22,
  page: { y1: 2100 }, pageOpts: { skipRule: [] }, anchor: [1150, -40],
});

// ── the ruler ────────────────────────────────────────────────────────────────
const X0 = 300, X1 = 2000;      // rest extent
const PIV = 1150;               // fulcrum x
const H0 = -120;                // height of the top surface at rest
const THICK = 58;               // top surface above the underside
const HB = H0 - THICK;          // height of the underside at rest (the fulcrum apex)
const T_SPLIT = 16.9, XS = 1180;   // B levers it apart here
const T_CUT = 19.5, XC = 1060;     // A cuts the rest free here
const T_STAB = 16.1;               // B's spear goes through the ruler at XS
const T_STUB = 20.14;              // the last piece slides off the fulcrum
const T_CLASH = 21.3;              // they meet once more in mid-air

// [t, tilt in degrees (+ = right end up), bounce dy, ease]
const TILT = [
  [0, 0, 0], [0.7, 0, 0], [0.78, 1.6, -5, 'out'], [0.92, 0.8, -2], [1.02, -5.5, -6, 'out'], [1.2, 2.6, 2],
  [1.42, -1.6, 0], [1.66, 0.7, 0], [1.9, 0, 0],
  [3.12, 0, 0], [3.16, -0.5, -4, 'out'], [3.32, 0, 0],
  [6.36, 0, 0], [6.47, -9.5, 0, 'out'], [6.6, -6.2, 0], [6.76, -8, 0], [6.95, -7, 0], [7.3, -6.5, 0], [8.3, -1.5, 0], [8.8, 0, 0],
  [11.92, 0, 0], [12.02, 2.8, -4, 'out'], [12.2, 0.8, 0], [12.4, 1.6, 0], [12.7, 0.6, 0], [12.9, 0.4, 0],
  [13.0, -5, -6, 'out'], [13.16, -2, 0], [13.34, -3.6, 0], [13.6, -2, 0], [14.3, -0.5, 0], [15.0, 0, 0],
  [16.0, 0, 0], [T_STAB, 0, -9, 'out'], [16.24, 0, 0], [16.46, 0, 0], [16.5, 0.6, -7, 'out'], [16.64, 0, 0], [16.86, 0, 0], [16.9, 0, -4],
  [17.05, 5.5, 0, 'out'], [17.3, 3.2, 0], [17.6, 5.4, 0], [17.72, 5, -5, 'out'], [17.9, 4.6, 0], [19.5, 4.6, 0], [19.56, 4.6, -5],
  [19.7, -5, 0, 'out'], [19.9, 2.5, 0], [20.14, -2, 0],
  [22.5, 0, 0],
];
function tiltAt(t) {
  let i = 0;
  while (i < TILT.length - 2 && TILT[i + 1][0] <= t) i++;
  const a = TILT[i], b = TILT[i + 1];
  const u = (EASE[b[3]] || EASE.io)(clamp((t - a[0]) / (b[0] - a[0])));
  return { a: lerp(a[1], b[1], u) * DEG, ox: PIV, oy: HB + lerp(a[2], b[2], u) };
}
/** distance fallen after tau seconds (soft terminal velocity) */
const fallen = (tau, vt = 420, k = 2.2) => (tau <= 0 ? 0 : vt * (tau - (1 - Math.exp(-k * tau)) / k));

/** A broken-off piece: starts from pose `b`, turns about the rest point (cu, top) by phi and moves by (dx, -drop). */
function loose(b, cu, phi, dx, drop) {
  const ca = Math.cos(b.a), sa = Math.sin(b.a);
  const c = [b.ox + (cu - PIV) * ca - THICK * sa, b.oy + (cu - PIV) * sa + THICK * ca];
  const cp = Math.cos(phi), sp = Math.sin(phi);
  const rx = b.ox - c[0], ry = b.oy - c[1];
  return { a: b.a + phi, ox: c[0] + rx * cp - ry * sp + dx, oy: c[1] + rx * sp + ry * cp - drop };
}
const pieceMemo = new Map();
/** Every piece of ruler at time t: { id, u0, u1 (rest extent), a, ox, oy (world position of the rest point [PIV, underside]) } */
function pieces(t) {
  const key = Math.round(t * 1e4);
  let out = pieceMemo.get(key);
  if (out) return out;
  const m = tiltAt(t);
  if (t < T_SPLIT) out = [{ id: 'main', u0: X0, u1: X1, ...m }];
  else {
    out = [];
    const tau = t - T_SPLIT;
    // the right half hangs from the break for a moment (hinge at the split), then drops
    const phi = -(15 * EASE.out(clamp(tau / 0.55)) + 26 * clamp((tau - 0.5) / 2)) * DEG;
    out.push({ id: 'R', u0: XS, u1: X1, ...loose(tiltAt(T_SPLIT), XS, phi, 40 * clamp(tau / 2), fallen(tau - 0.12, 460, 1.7)) });
    if (t < T_CUT) out.push({ id: 'L', u0: X0, u1: XS, ...m });
    else {
      const tc = t - T_CUT - 0.08;
      if (t < T_STUB) out.push({ id: 'stub', u0: XC, u1: XS, ...m });
      else {
        const ts = t - T_STUB;
        out.push({ id: 'stub', u0: XC, u1: XS, ...loose(tiltAt(T_STUB), 1120, -26 * ts * DEG, 110 * ts, fallen(ts, 330, 1.8)) });
      }
      const ph2 = (4 * EASE.out(clamp(tc / 0.3)) + 30 * clamp((tc - 0.2) / 2.2)) * DEG;
      out.push({ id: 'LL', u0: X0, u1: XC, ...loose(tiltAt(T_CUT), 700, tc > 0 ? ph2 : 0, -30 * clamp(tc / 2), fallen(tc, 520, 2.6)) });
    }
  }
  if (pieceMemo.size > 4000) pieceMemo.clear();
  pieceMemo.set(key, out);
  return out;
}
/** Height of the ruler surface under world x at time t, or null where there is no ruler. */
function ph(x, t) {
  let best = null;
  for (const p of pieces(t)) {
    const ca = Math.cos(p.a), sa = Math.sin(p.a);
    const du = (x - p.ox + THICK * sa) / ca;
    const u = PIV + du;
    if (u < p.u0 - 3 || u > p.u1 + 3) continue;
    const h = p.oy + du * sa + THICK * ca;
    if (best == null || h > best) best = h;
  }
  return best;
}
const R = (x, t, up = 0) => (ph(x, t) ?? H0) + up;

// ── floating shapes the fight uses ───────────────────────────────────────────
const HINGE = [1700, 215];                       // compass hinge (world, height)
const ARM_ANG = 245;                             // its needle arm = the spear
const ARM_DIR = [Math.cos(ARM_ANG * DEG), Math.sin(ARM_ANG * DEG)];
const armPt = (d) => [HINGE[0] + ARM_DIR[0] * d, HINGE[1] + ARM_DIR[1] * d];
const T_ARM = 4.46;                              // wrenched off
const C1 = { x: 1870, y: -170, s: 110 };          // cube that catches B's shortsword (canvas coords of the front face's bottom-left)
const T_STICK = 3.86;
const T1X0 = 380, T1X1 = 900, T1TOP = 120;       // floating set square (a platform): top edge, world height
const bump = (t, t0, amp, k = 6, w = 18) => (t < t0 ? 0 : amp * Math.exp(-k * (t - t0)) * Math.cos(w * (t - t0)));
const T1Y = (t) => T1TOP - bump(t, 10.48, 16) - bump(t, 10.82, 9) + bump(t, 11.5, 8);
const Q1TOP = 20;                                // small floating cube (a stepping stone): top, world height
const T_IMP = 12.18;                             // B's lunge runs a floating cube through
const T_SLAM = 12.9;                             // …and he uses it as a mace
const T_SLICE = 13.86;                           // A cuts the cube off the spear
const onT = (t, o) => ({ t, y: T1Y(t), ...o });  // a key standing on the set square

// ── pose-key helpers ─────────────────────────────────────────────────────────
/**
 * Keys without an explicit `y` stand on the ruler: base height = ph(x, t), feet follow the slope,
 * planted feet ride the platform when it moves. Keys with `y` (jumps, other platforms) pass through.
 */
function ground(keys, sc) {
  let x = 0, face = 1, last = null, lastAuto = false;
  const foot = { fF: null, fB: null };
  const out = [];
  for (const k of keys) {
    let base = typeof k.p === 'string' ? POSES[k.p] : k.p || {};
    if (typeof k.p === 'string' && !POSES[k.p]) console.warn(`[s3] unknown pose ${k.p}`);
    let auto = k.y == null && !k.air;
    if (k.same && last) {
      const { hop, e, er, slide, reveal, same, t, turnF, turnB, ...rest } = last;
      base = rest;
      if (k.y == null && !k.air) auto = lastAuto;
    }
    const m = { ...BASE_POSE, ...base, ...k };
    delete m.p; delete m.same; delete m.air;
    if (k.x == null) m.x = x; else x = k.x;
    if (k.face == null) m.face = face; else face = k.face;
    last = m;
    const o = { ...m };
    if (auto) {
      o.y = R(m.x, m.t);
      let moved = false;
      for (const n of ['fF', 'fB']) {
        if (m[n + 'w']) { foot[n] = null; continue; }
        const wx = m.x + m.face * sc * m[n][0];
        const pf = foot[n];
        if (pf && m[n][1] === 0 && Math.abs(wx - pf.x) < 14 && !k.slide) {
          const hh = ph(pf.x, m.t) ?? o.y;
          o[n + 'w'] = [pf.x, hh];
          if (Math.abs(hh - pf.h) > 0.4) moved = true;
          foot[n] = { x: pf.x, h: hh };
        } else {
          const hgt = ph(wx, m.t) ?? o.y;
          o[n] = [m[n][0], m[n][1] + (hgt - o.y) / sc];
          foot[n] = m[n][1] === 0 ? { x: wx, h: hgt } : null;
        }
      }
      if (moved || !lastAuto) o.slide = true;
    } else {
      foot.fF = foot.fB = null;
      if (o.slide == null) o.slide = true;
    }
    lastAuto = auto;
    out.push(o);
  }
  return out;
}
/** flight() where an end given as a plain number means "on the ruler at that x". */
function air(t0, t1, from, to, g, mids, land) {
  const f = typeof from === 'number' ? [from, R(from, t0)] : from;
  const onRuler = typeof to === 'number';
  const d = onRuler ? [to, R(to, t1)] : to;
  const ks = flight(t0, t1, f, d, g, mids, land);
  if (onRuler) delete ks[ks.length - 1].y;
  return ks;
}
/** Weapon keys with TRUE angles (0…360): unwrapped the short way unless cw / ccw / turns says otherwise. */
function wk(keys) {
  let prev = null;
  return keys.map((k) => {
    const { cw, ccw, turns, ...rest } = k;
    if (k.ang == null) return rest;
    let a = k.ang;
    if (prev != null) {
      a = prev + ((((k.ang - prev) % 360) + 540) % 360) - 180;
      if (cw && a > prev) a -= 360;
      if (ccw && a < prev) a += 360;
      a += 360 * (turns || 0);
    }
    prev = a;
    return { ...rest, ang: a };
  });
}

/** where B's leading hand sits on the spear (105 up the shaft from the hole at XS) while it is through the ruler at angle `ang` */
const shaftHand = (ang, t) => [XS - 105 * Math.cos(ang * DEG), R(XS - 4, t) - 105 * Math.sin(ang * DEG)];
// where B's free hand catches A's sword wrist (16.62–16.8): it trembles, then is forced down
const GRAB = (t) => [1154 + (t > 16.66 ? 8 * Math.sin((t - 16.62) * 60) * (t < 16.76 ? 1 : 0) : 0) - 10 * prog(t, 16.72, 16.8), 40 + 6 * prog(t, 16.62, 16.7) - 16 * prog(t, 16.72, 16.8)];
const PIN_A = [1104, 0];   // x where A's foot pins the spear shaft to the ruler (18.68 → the cut)
const pinA = (t) => [PIN_A[0], R(PIN_A[0], t, 21)];
const PIN_B = [1020, -86];  // B's hand on the pinned spear (probed at 18.68)

// ═════════════════════════════════════════════════════════════════════════════
// FIGHTER A — The Technician
// ═════════════════════════════════════════════════════════════════════════════
const T_SNAP = 5.76;     // his shortsword breaks
const T_GRAB = 6.9;      // he closes his hand on the line he has just drawn: the longsword
const T_LINE = 6.72;     // his finger touches the ruler's edge

const A_KEYS = [
  // 0:00 — drops in from the page above, shortsword trailing
  { t: 0, x: 918, y: 640, face: 1, hip: [0, 86], lean: 10, hF: [30, 44], hB: [-30, 30], fF: [14, 0], fB: [-14, 10] },
  ...air(0, 0.7, [918, 640], 930, 1800, [
    [0.3, { hip: [0, 86], lean: 8, hF: [34, 46], hB: [-36, 34], fF: [16, 6], fB: [-16, 14] }],
    [0.56, { hip: [0, 80], lean: 14, hF: [36, 20], hB: [-30, 20], fF: [22, 0], fB: [-20, 6] }],
  ], { hip: [0, 46], lean: 32, bend: 10, hF: [30, -30], hB: [-20, -50], fF: [32, 0], fB: [-32, 0], e: 'in' }),
  { t: 0.8, hip: [2, 40], lean: 38, bend: 12, hF: [30, -36], hB: [-18, -50], fF: [32, 0], fB: [-32, 0] },
  { t: 0.93, hip: [-2, 66], lean: 20, tilt: -14, hF: [36, -14], hB: [-12, -34], fF: [32, 0], fB: [-32, 0] },
  // B's landing kicks his end of the see-saw up: arms out, knees give
  { t: 1.03, hip: [-8, 54], lean: 0, tilt: -6, hF: [46, 22], hB: [-44, 18], fF: [34, 0], fB: [-34, 0], e: 'out' },
  { t: 1.2, hip: [4, 80], lean: 16, hF: [38, 6], hB: [-32, -4], fF: [34, 0], fB: [-34, 0] },
  { t: 1.38, p: 'guard1', hip: [-6, 88], lean: 2, fF: [32, 0], fB: [-32, 0] },
  { t: 1.6, p: 'guard1', hF: [36, 6], fF: [32, 0], fB: [-32, 0] },
  { t: 1.76, p: 'guard1', x: 972, hip: [-4, 95] },
  { t: 1.9, p: 'guard1', x: 1010 },
  // parries B's overhand high
  { t: 1.98, x: 1016, hip: [-8, 86], lean: -4, hF: [30, 40], hB: [10, -20], fF: [32, 0], fB: [-30, 0] },
  { t: 2.06, hip: [-10, 80], lean: -8, hF: [34, 56], hB: [8, -24], fF: [32, 0], fB: [-30, 0], e: 'snap' },
  { t: 2.12, same: true },
  // riposte: low thrust — beaten down
  { t: 2.22, x: 1046, hip: [16, 76], lean: 30, hF: [74, -22], hB: [-24, -20], fF: [54, 0], fB: [-50, 0], e: 'snap' },
  { t: 2.3, hip: [14, 74], lean: 30, hF: [70, -36], hB: [-24, -22], fF: [54, 0], fB: [-50, 0] },
  { t: 2.4, x: 1050, hip: [-2, 84], lean: 10, hF: [40, -12], hB: [6, -26], fF: [34, 0], fB: [-30, 0] },
  // ducks the backhand
  { t: 2.5, x: 1056, hip: [4, 46], lean: 42, bend: 10, tilt: -20, hF: [20, -34], hB: [-10, -46], fF: [36, 0], fB: [-34, 0], e: 'out' },
  { t: 2.57, hip: [0, 48], lean: 36, bend: 10, tilt: -24, hF: [8, -44], hB: [-14, -40], fF: [36, 0], fB: [-34, 0] },
  // rising cut — B leans out of it
  { t: 2.66, x: 1080, hip: [12, 88], lean: 14, hF: [56, 34], hB: [-24, -24], fF: [40, 0], fB: [-34, 0], e: 'snap' },
  { t: 2.74, hip: [8, 90], lean: 8, hF: [44, 46], hB: [-20, -20], fF: [40, 0], fB: [-34, 0] },
  // kicked in the ribs
  { t: 2.82, x: 1066, hip: [-30, 76], lean: 16, bend: 18, tilt: 24, hF: [40, 20], hB: [44, -10], fF: [30, 4], fB: [-36, 0], e: 'snap' },
  { t: 2.88, same: true },
  { t: 3.02, x: 960, hip: [-8, 60], lean: 30, hF: [30, -20], hB: [-10, -40], fF: [34, 0], fB: [-36, 0], slide: true, e: 'out' },
  // hops back from the chop
  { t: 3.1, x: 900, hip: [-10, 84], lean: -6, hF: [34, 10], hB: [-20, -10], fF: [30, 0], fB: [-30, 0], hop: 14 },
  // turns his back… and whips a low backhand into the stuck sword
  { t: 3.2, x: 906, face: -1, hip: [0, 74], lean: 14, hF: [14, -30], hB: [10, -40], fF: [20, 0], fB: [-20, 0] },
  { t: 3.29, x: 922, face: 1, hip: [4, 62], lean: 26, hF: [30, -56], hB: [-30, -10], fF: [36, 0], fB: [-30, 0], e: 'in' },
  { t: 3.36, x: 935, hip: [14, 60], lean: 24, hF: [60, -62], hB: [-36, 10], fF: [46, 0], fB: [-38, 0], e: 'snap' },
  { t: 3.43, same: true },
  // presses the disarmed B: two cuts
  { t: 3.5, x: 960, hip: [-4, 88], lean: 4, hF: [10, 52], hB: [10, -20], fF: [32, 0], fB: [-30, 0] },
  { t: 3.6, x: 1040, hip: [12, 84], lean: 24, hF: [64, -6], hB: [-22, -22], fF: [42, 0], fB: [-36, 0], e: 'snap' },
  { t: 3.7, x: 1080, hip: [2, 70], lean: 26, hF: [26, -44], hB: [-20, -20], fF: [36, 0], fB: [-34, 0] },
  { t: 3.8, x: 1130, hip: [14, 88], lean: 16, hF: [58, 38], hB: [-26, -20], fF: [44, 0], fB: [-36, 0], e: 'snap' },
  { t: 3.9, x: 1160, p: 'guard1', hip: [0, 88], lean: 12 },
  // booted away
  { t: 4.0, x: 1156, hip: [-24, 78], lean: -18, tilt: -24, hF: [36, 40], hB: [-30, 40], fF: [36, 10], fB: [-36, 0], e: 'snap' },
  { t: 4.06, same: true },
  { t: 4.2, x: 1080, hip: [-12, 46], lean: 34, bend: 10, hF: [30, -40], hB: [-20, -44], fF: [36, 0], fB: [-44, 0], kB: -1, slide: true, e: 'out' },
  { t: 4.36, x: 1066, hip: [-6, 52], lean: 30, tilt: -20, hF: [32, -30], hB: [-14, -44], fF: [36, 0], fB: [-40, 0], kB: -1 },
  { t: 4.52, x: 1070, hip: [2, 76], lean: 24, hF: [36, -10], hB: [-20, -30], fF: [34, 0], fB: [-34, 0] },
  // dashes in… and stops dead on the spear point
  { t: 4.62, x: 1110, p: 'run1', hF: [30, 30] },
  { t: 4.7, x: 1170, p: 'run2', hF: [20, 40] },
  { t: 4.8, x: 1236, hip: [-16, 86], lean: -16, tilt: -8, hF: [26, 30], hB: [-30, 10], fF: [40, 0], fB: [-20, 0], slide: true, e: 'out' },
  { t: 4.9, x: 1228, p: 'guard1', hip: [-10, 86], lean: -4 },
  { t: 4.98, x: 1222, p: 'guard1', hip: [-8, 88], lean: -2 },
  // parries thrust 1, hopping back
  { t: 5.07, x: 1196, hip: [-12, 84], lean: -10, hF: [50, 16], hB: [-10, -20], fF: [30, 0], fB: [-32, 0], e: 'snap' },
  { t: 5.13, same: true },
  { t: 5.22, x: 1160, p: 'guard1', hip: [-6, 86] },
  // ducks thrust 2
  { t: 5.3, x: 1140, hip: [2, 50], lean: 38, bend: 10, tilt: -24, hF: [24, -30], hB: [-10, -44], fF: [34, 0], fB: [-34, 0], e: 'out' },
  { t: 5.4, hip: [0, 54], lean: 32, bend: 8, tilt: -20, hF: [26, -26], hB: [-12, -40], fF: [34, 0], fB: [-34, 0] },
  // hops the sweep
  { t: 5.48, x: 1132, y: R(1132, 5.48, 58), hip: [0, 66], lean: 18, hF: [30, 14], hB: [-30, 22], fF: [22, 24], fB: [-14, 30] },
  { t: 5.58, x: 1140, hip: [0, 58], lean: 30, hF: [30, -20], hB: [-16, -36], fF: [34, 0], fB: [-34, 0] },
  // lunges inside the point — the blade is a hand too short
  { t: 5.66, x: 1262, p: 'thrust', e: 'snap' },
  // sees the shaft coming: sword up as a bar… it breaks
  { t: 5.72, hip: [6, 80], lean: 12, hF: [40, 42], hB: [20, 30], fF: [44, 0], fB: [-44, 0] },
  { t: T_SNAP, x: 1256, hip: [-6, 62], lean: 0, tilt: 10, hF: [38, 40], hB: [16, 34], fF: [44, 0], fB: [-44, 0], e: 'snap' },
  { t: 5.82, same: true },
  // bashed down the ruler, the stub flying from his hand
  ...air(5.82, 6.1, 1256, 880, 2600, [
    [5.93, { hip: [0, 60], lean: -44, tilt: -20, hF: [44, 40], hB: [30, 50], fF: [66, 36], fB: [50, 14] }],
    [6.03, { hip: [0, 48], lean: -62, tilt: -10, hF: [40, 30], hB: [20, 40], fF: [60, 50], fB: [50, 30] }],
  ], { hip: [-20, 26], lean: -50, tilt: 30, hF: [-20, -50], hB: [-50, -30], fF: [50, 10], fB: [30, 0] }),
  { t: 6.22, x: 800, hip: [-10, 34], lean: 10, tilt: 0, hF: [10, -60], hB: [-40, -40], fF: [44, 0], fB: [10, 0], slide: true, e: 'out' },
  { t: 6.34, x: 780, hip: [-4, 48], lean: 30, tilt: -20, hF: [30, -50], hB: [-20, -50], fF: [36, 0], fB: [-36, 0], kB: -1 },
  // B stamps the far end down: the see-saw throws him into the air
  { t: 6.42, x: 780, hip: [0, 60], lean: 10, hF: [30, 0], hB: [-30, 0], fF: [30, 0], fB: [-30, 0], e: 'in' },
  ...air(6.42, 6.66, 780, 830, 5200, [
    [6.54, { hip: [0, 70], lean: -20, tilt: -10, hF: [44, 40], hB: [-40, 40], fF: [40, 30], fB: [-10, 20] }],
  ], { hip: [-6, 28], lean: -36, hF: [34, -20], hB: [-34, -40], fF: [72, 6], fB: [40, 0] }),
  // slides down the slope on his hip, one finger drawing a line along the ruler's edge
  { t: T_LINE, x: 870, hip: [-4, 27], lean: -38, hF: [10, -72], hB: [-30, 10], fF: [74, 6], fB: [42, 0], slide: true, e: 'lin', er: 'lin' },
  { t: 6.8, x: 950, hip: [-4, 27], lean: -40, hF: [10, -72], hB: [-34, 20], fF: [74, 8], fB: [42, 0], slide: true, e: 'lin', er: 'lin' },
  { t: T_GRAB, x: 1040, hip: [-4, 28], lean: -36, hF: [8, -72], hB: [-30, 24], fF: [74, 6], fB: [42, 0], slide: true, e: 'lin', er: 'lin' },
  // the line comes away in his hand
  { t: 6.98, x: 1100, hip: [0, 36], lean: -16, hF: [-34, -30], hB: [10, 10], fF: [70, 0], fB: [36, 0], slide: true, e: 'lin', er: 'lin' },
  { t: 7.06, x: 1146, hip: [4, 54], lean: 0, hF: [-30, 40], hB: [-10, 40], fF: [60, 0], fB: [10, 0], slide: true, e: 'lin', er: 'lin' },
  { t: 7.13, x: 1180, hip: [8, 70], lean: 10, hF: [4, 68], hB: [-10, 56], fF: [52, 0], fB: [-24, 0], slide: true, e: 'lin', er: 'lin' },
  // …and comes down on the spear
  { t: 7.2, x: 1204, hip: [14, 70], lean: 26, hF: [58, -42], hB: [40, -50], fF: [54, 0], fB: [-40, 0], slide: true, e: 'snap', er: 'out' },
  { t: 7.28, same: true },
  // 0:07 — LONGSWORD vs SPEAR. Drives up out of the slide: rising cut — caught on the shaft
  { t: 7.36, x: 1250, hip: [4, 66], lean: 24, hF: [40, -44], hB: [20, -40], fF: [50, 0], fB: [-36, 0] },
  { t: 7.44, x: 1300, hip: [14, 86], lean: 16, hF: [60, 22], hB: [40, 10], fF: [48, 0], fB: [-40, 0], e: 'snap' },
  { t: 7.5, same: true },
  // sways back from the butt-end uppercut
  { t: 7.6, x: 1290, hip: [-16, 88], lean: -22, tilt: -10, hF: [30, 20], hB: [14, 6], fF: [36, 0], fB: [-30, 0], e: 'out' },
  // hops the low sweep
  { t: 7.72, x: 1272, hip: [-6, 74], lean: 6, hF: [36, 0], hB: [20, -14], fF: [32, 0], fB: [-30, 0] },
  { t: 7.82, x: 1252, y: R(1252, 7.82, 60), hip: [0, 70], lean: 10, hF: [34, 30], hB: [20, 14], fF: [24, 26], fB: [-10, 34] },
  { t: 7.94, x: 1236, hip: [-2, 70], lean: 14, hF: [40, -6], hB: [24, -20], fF: [32, 0], fB: [-32, 0] },
  // lifts the lunge over his shoulder with a rising parry…
  { t: 8.02, x: 1232, hip: [-8, 84], lean: 4, hF: [40, -34], hB: [24, -40], fF: [32, 0], fB: [-32, 0] },
  { t: 8.1, x: 1228, hip: [-10, 86], lean: -6, hF: [44, -28], hB: [30, -40], fF: [32, 0], fB: [-32, 0], e: 'snap' },
  { t: 8.16, same: true },
  // …and steps inside: cut at the shoulder — bind
  { t: 8.24, x: 1300, hip: [14, 84], lean: 22, hF: [56, 28], hB: [40, 14], fF: [48, 0], fB: [-40, 0], e: 'snap' },
  { t: 8.36, x: 1306, hip: [18, 82], lean: 26, hF: [58, 24], hB: [42, 10], fF: [48, 0], fB: [-40, 0] },
  // the butt of the spear in his gut
  { t: 8.48, x: 1290, p: 'fold', e: 'snap' },
  { t: 8.54, same: true },
  { t: 8.74, x: 1160, hip: [-10, 60], lean: 34, bend: 10, hF: [36, -30], hB: [20, -40], fF: [38, 0], fB: [-40, 0], slide: true, e: 'out' },
  { t: 8.84, x: 1150, hip: [-6, 78], lean: 12, tilt: -14, hF: [16, 44], hB: [4, 34], fF: [36, 0], fB: [-36, 0] },
  // beats the thrust down into the ruler
  { t: 8.92, x: 1110, hip: [8, 66], lean: 30, hF: [56, -34], hB: [40, -40], fF: [44, 0], fB: [-36, 0], e: 'snap' },
  { t: 8.98, same: true },
  // …steps onto the shaft and runs up it
  { t: 9.05, x: 1178, y: R(1178, 9.05, 16), hip: [6, 84], lean: 22, hF: [30, 10], hB: [14, 0], fFw: [1200, R(1200, 9.05, 29)], fBw: [1076, R(1076, 9.05)] },
  { t: 9.13, x: 1244, y: R(1244, 9.13, 46), hip: [8, 86], lean: 24, hF: [10, 44], hB: [-4, 36], fFw: [1200, R(1200, 9.13, 29)], fBw: [1268, R(1268, 9.13, 58)] },
  // stamps on the back of B's head and vaults over him
  { t: 9.21, x: 1304, y: R(1304, 9.21, 84), hip: [0, 84], lean: 12, hF: [-6, 60], hB: [-16, 50], fFw: [1340, R(1340, 9.21, 116)], fB: [-34, 24], e: 'snap' },
  { t: 9.26, same: true },
  ...air(9.26, 9.6, [1304, R(1304, 9.26, 84)], 1570, 5600, [
    [9.36, { p: 'aTuck', spin: 100, hF: [30, -30], hB: [20, -44] }],
    [9.46, { p: 'aTuck', spin: 230, hF: [30, -30], hB: [20, -44] }],
    [9.54, { hip: [0, 80], lean: 10, hF: [34, 10], hB: [20, 0], fF: [16, 0], fB: [-14, 8], spin: 330 }],
  ], { hip: [0, 50], lean: 30, bend: 8, hF: [34, -30], hB: [20, -40], fF: [32, 0], fB: [-32, 0], spin: 360 }),
  // turns and catches B's overhead sweep on a high guard
  { t: 9.68, x: 1566, face: -1, hip: [0, 60], lean: 20, hF: [30, 10], hB: [14, 0], fF: [30, 0], fB: [-30, 0] },
  { t: 9.8, x: 1570, hip: [-8, 76], lean: -6, hF: [36, 44], hB: [-10, 40], fF: [32, 0], fB: [-30, 0], e: 'snap' },
  { t: 9.86, same: true },
  // drops under the shaft: chop at the legs
  { t: 9.94, x: 1540, hip: [10, 52], lean: 40, hF: [40, 10], hB: [30, 0], fF: [44, 0], fB: [-40, 0] },
  { t: 10.02, x: 1510, hip: [20, 44], lean: 50, hF: [64, -46], hB: [50, -44], fF: [56, 0], fB: [-46, 0], e: 'snap' },
  { t: 10.1, hip: [14, 50], lean: 40, tilt: -30, hF: [50, -40], hB: [36, -40], fF: [56, 0], fB: [-46, 0] },
  // sprints after him
  { t: 10.18, x: 1420, p: 'run1', hF: [30, -10], hB: [16, -20] },
  { t: 10.26, x: 1310, p: 'run2', hF: [20, 0], hB: [6, -10] },
  { t: 10.34, x: 1200, p: 'run1', hF: [30, -10], hB: [16, -20] },
  { t: 10.4, x: 1160, hip: [6, 60], lean: 30, hF: [10, -30], hB: [-4, -40], fF: [30, 0], fB: [-40, 0] },
  // …up onto a floating cube, off it, onto the set square with a falling cut
  ...air(10.4, 10.58, 1160, [1004, Q1TOP], 5200, [
    [10.49, { hip: [0, 80], lean: 24, hF: [30, 30], hB: [16, 20], fF: [40, 10], fB: [-30, 24] }],
  ], { hip: [4, 56], lean: 30, hF: [10, 20], hB: [-4, 10], fF: [20, 0], fB: [-30, 16] }),
  ...air(10.58, 10.82, [1004, Q1TOP], [832, T1Y(10.82)], 5600, [
    [10.7, { hip: [0, 84], lean: 4, hF: [-10, 66], hB: [-24, 56], fF: [30, 20], fB: [-20, 34] }],
  ], { hip: [10, 60], lean: 30, hF: [60, 30], hB: [44, 20], fF: [44, 0], fB: [-40, 0], e: 'in' }),
  onT(10.88, { same: true }),
  // shoved back, hops the butt-sweep
  onT(10.98, { x: 846, hip: [-10, 84], lean: -10, hF: [40, 30], hB: [26, 20], fF: [30, 0], fB: [-30, 0] }),
  { t: 11.08, x: 850, y: T1Y(11.08) + 46, hip: [0, 70], lean: 10, hF: [30, 44], hB: [16, 34], fF: [20, 20], fB: [-16, 28] },
  onT(11.18, { x: 858, hip: [-2, 70], lean: 14, hF: [40, 0], hB: [26, -10], fF: [32, 0], fB: [-30, 0] }),
  // barged off the set square
  onT(11.28, { x: 884, hip: [-10, 80], lean: -8, tilt: 26, bend: 14, hF: [44, 34], hB: [-36, 30], fF: [30, 8], fB: [-10, 0], e: 'snap' }),
  onT(11.34, { same: true }),
  ...air(11.34, 11.7, [884, T1Y(11.34)], 1150, 3200, [
    [11.46, { p: 'flyBack' }],
    [11.58, { hip: [0, 60], lean: 30, hF: [40, -10], hB: [30, -20], fF: [40, 20], fB: [-10, 10] }],
  ], { p: 'threePoint', hF: [14, -70], hB: [-40, 30] }),
  { t: 11.86, x: 1236, p: 'threePoint', hF: [14, -70], hB: [-36, 24], slide: true, e: 'out' },
  // springs back from the plunging spear
  { t: 11.94, x: 1326, hip: [-6, 80], lean: 0, hF: [36, 10], hB: [22, 0], fF: [30, 0], fB: [-30, 0], hop: 16 },
  { t: 12.06, x: 1336, p: 'guard2', hip: [-6, 86], lean: 2 },
  // bends backwards under the lunge — the point goes on into a floating cube
  { t: T_IMP, x: 1320, hip: [14, 64], lean: -66, tilt: 24, hF: [-20, -20], hB: [-34, -10], fF: [30, 0], fB: [-30, 0], e: 'snap' },
  { t: 12.26, same: true },
  { t: 12.4, x: 1326, hip: [0, 84], lean: 4, hF: [50, 36], hB: [36, 24], fF: [32, 0], fB: [-30, 0], e: 'snap' },
  { t: 12.54, x: 1340, p: 'guard2', hip: [-6, 88], lean: 0, tilt: -16 },
  { t: 12.7, x: 1348, hip: [0, 56], lean: 24, tilt: -30, hF: [30, -10], hB: [16, -20], fF: [32, 0], fB: [-32, 0] },
  // back-flips clear of the cube-mace
  { t: 12.78, hip: [-6, 86], lean: -10, hF: [20, 40], hB: [6, 30], fF: [20, 0], fB: [-30, 0], e: 'in' },
  ...air(12.78, 13.08, 1348, 1580, 5600, [
    [12.88, { p: 'aTuck', spin: -110, hF: [30, -30], hB: [20, -44] }],
    [12.98, { p: 'aTuck', spin: -250, hF: [30, -30], hB: [20, -44] }],
  ], { hip: [0, 50], lean: 28, bend: 8, hF: [34, -30], hB: [20, -40], fF: [34, 0], fB: [-34, 0], spin: -360 }),
  { t: 13.2, x: 1584, p: 'guard2', hip: [-6, 84], lean: 4 },
  // sways out of the upswing
  { t: 13.34, x: 1596, hip: [-16, 86], lean: -24, tilt: -8, hF: [30, 20], hB: [16, 10], fF: [34, 0], fB: [-30, 0], e: 'out' },
  // steps in under the second slam, coils… and cuts the cube clean off the spear
  { t: 13.5, x: 1594, hip: [6, 58], lean: 30, hF: [20, -40], hB: [6, -44], fF: [36, 0], fB: [-34, 0] },
  { t: 13.72, x: 1592, hip: [4, 54], lean: 32, hF: [16, -44], hB: [2, -46], fF: [36, 0], fB: [-34, 0] },
  { t: T_SLICE, x: 1590, hip: [10, 88], lean: 6, hF: [50, 50], hB: [36, 40], fF: [40, 0], fB: [-36, 0], e: 'snap' },
  { t: 13.94, same: true },
  // presses: three cuts, each driving B back
  { t: 14.04, x: 1500, hip: [-6, 92], lean: -8, hF: [-4, 68], hB: [-18, 58], fF: [30, 0], fB: [-30, 0] },
  { t: 14.14, x: 1420, hip: [10, 72], lean: 32, hF: [56, -10], hB: [40, -20], fF: [46, 0], fB: [-42, 0], e: 'snap' },
  { t: 14.24, x: 1390, hip: [4, 60], lean: 30, hF: [30, -44], hB: [16, -48], fF: [38, 0], fB: [-36, 0] },
  { t: 14.34, x: 1360, hip: [14, 84], lean: 16, hF: [58, -16], hB: [44, -26], fF: [46, 0], fB: [-40, 0], e: 'snap' },
  { t: 14.44, x: 1336, face: 1, hip: [0, 82], lean: 8, hF: [14, 20], hB: [0, 10], fF: [22, 0], fB: [-22, 0] },
  { t: 14.54, x: 1300, face: -1, hip: [12, 74], lean: 30, hF: [60, 44], hB: [46, 34], fF: [46, 0], fB: [-40, 0], e: 'snap' },
  { t: 14.6, same: true },
  // thrust — it falls short and is slapped down
  { t: 14.7, x: 1350, hip: [-10, 84], lean: 0, hF: [10, -6], hB: [-4, -16], fF: [32, 0], fB: [-32, 0] },
  { t: 14.8, x: 1320, p: 'thrust', hF: [76, -10], hB: [60, -16], e: 'snap' },
  { t: 14.87, hip: [16, 74], lean: 34, hF: [72, -30], hB: [56, -36], fF: [56, 0], fB: [-56, 0] },
  // the shaft takes him off his feet
  { t: 14.98, x: 1372, p: 'hitBack', hF: [40, 30], hB: [28, 36], e: 'snap' },
  { t: 15.04, same: true },
  ...air(15.04, 15.3, 1372, 1490, 2600, [[15.16, { p: 'flyBack' }]], { p: 'threePoint', hF: [14, -70], hB: [-40, 30] }),
  { t: 15.46, x: 1520, p: 'threePoint', hF: [14, -70], hB: [-36, 24], slide: true, e: 'out' },
  { t: 15.7, x: 1524, hip: [0, 70], lean: 24, tilt: -10, hF: [30, -20], hB: [16, -30], fF: [32, 0], fB: [-34, 0] },
  { t: 15.9, x: 1524, p: 'guard2', hip: [-6, 84], lean: 6 },
  // 0:16 — B is doing something to the ruler. The jolt, then he runs to stop him
  { t: 16.04, x: 1520, p: 'guard2', hip: [-2, 84], lean: 10 },
  { t: T_STAB, x: 1516, hip: [-10, 70], lean: -4, hF: [36, 10], hB: [22, 0], fF: [34, 0], fB: [-34, 0], e: 'snap' },
  { t: 16.22, x: 1500, hip: [4, 76], lean: 22, hF: [34, -10], hB: [20, -20], fF: [34, 0], fB: [-36, 0] },
  { t: 16.3, x: 1440, p: 'run1', hF: [30, -6], hB: [16, -16] },
  { t: 16.38, x: 1370, p: 'run2', hF: [20, 10], hB: [6, 0] },
  { t: 16.46, x: 1318, p: 'run1', hF: [0, 56], hB: [-14, 46] },
  // the heave jolts the ruler; he rides it into a two-handed cut at B's head —
  { t: 16.54, x: 1284, hip: [4, 88], lean: 8, hF: [-2, 70], hB: [-16, 60], fF: [40, 0], fB: [-36, 0] },
  // — and B's free hand closes round his wrist, the blade a hand above his skull
  { t: 16.62, x: 1256, hip: [14, 78], lean: 26, hFw: GRAB(16.62), hB: [46, 26], fF: [46, 0], fB: [-38, 0], e: 'snap' },
  { t: 16.7, x: 1256, hip: [16, 76], lean: 28, hFw: GRAB(16.7), hB: [46, 26], fF: [46, 0], fB: [-38, 0] },
  { t: 16.8, x: 1254, hip: [20, 72], lean: 32, hFw: GRAB(16.8), hB: [46, 26], fF: [46, 0], fB: [-38, 0] },
  // B throws the arm off
  { t: 16.87, x: 1268, hip: [-8, 86], lean: -12, tilt: -10, hF: [16, 68], hB: [2, 58], fF: [34, 0], fB: [-30, 0], e: 'out' },
  // — and the ruler SPLITS. His half hinges away under him
  { t: 16.98, x: 1272, hip: [-10, 60], lean: -16, tilt: -10, hF: [44, 30], hB: [-40, 30], fF: [34, 0], fB: [-34, 0], e: 'snap' },
  { t: 17.1, x: 1268, hip: [4, 50], lean: 34, hF: [30, -40], hB: [-10, -50], fF: [36, 0], fB: [-36, 0] },
  // scrambles up the dropping half and leaps the gap, sword high
  { t: 17.2, x: 1240, hip: [8, 64], lean: 40, hF: [36, -20], hB: [20, -30], fF: [40, 0], fB: [-44, 0] },
  { t: 17.28, x: 1222, hip: [10, 84], lean: 26, hF: [20, 40], hB: [6, 30], fF: [20, 0], fB: [-40, 0], e: 'in' },
  ...air(17.28, 17.72, 1222, 1150, 5600, [
    [17.42, { hip: [0, 84], lean: 10, hF: [0, 60], hB: [-14, 50], fF: [34, 20], fB: [-20, 34] }],
    [17.58, { hip: [0, 84], lean: -6, hF: [-10, 68], hB: [-24, 58], fF: [30, 10], fB: [-24, 30] }],
  ], { hip: [10, 60], lean: 30, hF: [60, 30], hB: [44, 20], fF: [44, 0], fB: [-28, 0], e: 'in' }),
  { t: 17.8, same: true },
  // heaved back half a step; beats the thrust down
  { t: 17.92, x: 1158, hip: [-10, 84], lean: -10, hF: [40, 30], hB: [26, 20], fF: [30, 0], fB: [-22, 0] },
  { t: 18.0, x: 1156, p: 'guard2', hip: [-6, 86], lean: 0, fF: [30, 0], fB: [-22, 0] },
  { t: 18.08, x: 1154, hip: [0, 80], lean: 14, hF: [50, -24], hB: [36, -32], fF: [34, 0], fB: [-22, 0], e: 'snap' },
  { t: 18.14, same: true },
  // riposte
  { t: 18.24, x: 1140, hip: [12, 78], lean: 28, hF: [58, 0], hB: [44, -10], fF: [44, 0], fB: [-30, 0], e: 'snap' },
  { t: 18.32, x: 1146, hip: [-4, 84], lean: 4, hF: [36, 0], hB: [22, -10], fF: [32, 0], fB: [-26, 0] },
  // hops the low sweep
  { t: 18.42, x: 1150, y: R(1150, 18.42, 52), hip: [0, 70], lean: 10, hF: [30, 44], hB: [16, 34], fF: [20, 22], fB: [-16, 30] },
  { t: 18.52, x: 1150, hip: [0, 66], lean: 18, hF: [40, 0], hB: [26, -10], fF: [32, 0], fB: [-26, 0] },
  // stamps the next thrust flat against the ruler and stands on it
  { t: 18.62, x: 1152, hip: [-4, 84], lean: 0, hF: [30, 20], hB: [16, 10], fF: [40, 40], fB: [-24, 0] },
  { t: 18.68, x: 1150, hip: [8, 74], lean: 14, hF: [30, 10], hB: [16, 0], fFw: pinA(18.68), fB: [-24, 0], e: 'snap' },
  { t: 18.74, hip: [8, 74], lean: 14, hF: [30, 10], hB: [16, 0], fFw: pinA(18.74), fB: [-24, 0] },
  // both hands on the hilt, up… he looks at B — then at the ruler between them
  { t: 18.92, hip: [4, 80], lean: 6, hF: [20, 50], hB: [6, 40], fFw: pinA(18.92), fB: [-24, 0] },
  { t: 19.12, hip: [-2, 88], lean: -6, hF: [-4, 70], hB: [-18, 60], fFw: pinA(19.12), fB: [-24, 0] },
  { t: 19.38, hip: [-6, 92], lean: -12, tilt: 22, hF: [-10, 72], hB: [-24, 62], fFw: pinA(19.38), fB: [-24, 0] },
  // the cut: straight down through the ruler
  { t: T_CUT, x: 1150, hip: [16, 56], lean: 36, bend: 8, tilt: 10, hF: [36, -50], hB: [22, -54], fFw: pinA(T_CUT), fB: [-24, 0], e: 'in3' },
  { t: 19.58, hip: [16, 56], lean: 36, bend: 8, tilt: 10, hF: [36, -50], hB: [22, -54], fFw: pinA(19.58), fB: [-24, 0] },
  // the stub rocks under him; he watches B drop away… and dives after him
  { t: 19.74, x: 1146, hip: [0, 70], lean: 20, tilt: 20, hF: [40, -30], hB: [26, -36], fF: [34, 0], fB: [-26, 0] },
  { t: 19.92, x: 1140, hip: [0, 54], lean: 30, tilt: 24, hF: [20, -30], hB: [6, -36], fF: [30, 0], fB: [-28, 0] },
  { t: 20.02, x: 1126, hip: [10, 86], lean: 30, hF: [10, 50], hB: [-4, 40], fF: [10, 0], fB: [-36, 0], e: 'in' },
  // the dive: body laid out head-first, sword trailing
  { t: 20.2, x: 1085, y: -80, hip: [0, 84], lean: 10, spin: 30, hF: [10, 60], hB: [-4, 50], fF: [20, 10], fB: [-40, 30], hop: 24 },
  { t: 20.45, x: 1052, y: -118, hip: [0, 84], lean: 10, spin: 80, hF: [-50, 20], hB: [-56, 6], fF: [-58, 3], fB: [-6, 4], e: 'lin', er: 'lin' },
  { t: 20.62, x: 1032, y: -160, hip: [0, 84], lean: 14, spin: 70, hF: [-30, 40], hB: [-40, 26], fF: [-71, 14], fB: [-20, 6], e: 'lin', er: 'lin' },
  // beats B's rising thrust up past his own face with one big sweep
  { t: 20.72, x: 1022, y: -185, hip: [0, 84], lean: 20, spin: 56, hFw: [956, -130], hB: [44, -38], fF: [-90, 41], fB: [-48, 20], e: 'snap', er: 'lin' },
  { t: 20.78, x: 1017, y: -203, hip: [0, 84], lean: 20, spin: 56, hFw: [951, -146], hB: [44, -40], fF: [-90, 41], fB: [-48, 20], e: 'lin', er: 'lin' },
  // coils: knees up, the sword right back over his head
  { t: 21.02, x: 985, y: -282, hip: [0, 84], lean: -14, spin: 14, hF: [-16, 70], hB: [-30, 60], fF: [36, 44], fB: [-20, 52], e: 'io', er: 'lin' },
  { t: 21.16, x: 962, y: -336, hip: [0, 84], lean: -18, spin: 20, hF: [-20, 70], hB: [-34, 60], fF: [38, 48], fB: [-18, 54], e: 'lin', er: 'lin' },
  // …and the whole body opens into the cut
  { t: T_CLASH, x: 946, y: -390, hip: [0, 84], lean: 22, spin: 62, hF: [72, -6], hB: [58, -14], fF: [-91, 42], fB: [-47, 21], e: 'snap', er: 'lin' },
  { t: 21.38, x: 946, y: -412, hip: [0, 84], lean: 22, spin: 62, hF: [72, -8], hB: [58, -16], fF: [-91, 42], fB: [-47, 21], e: 'lin', er: 'lin' },
  // thrown apart — and already stooping after him, the sword cocked back for the next cut
  { t: 21.6, x: 965, y: -464, hip: [0, 84], lean: -8, spin: 14, hF: [10, 66], hB: [-4, 56], fF: [56, 27], fB: [-58, 13], e: 'out', er: 'lin' },
  { t: 21.8, x: 975, y: -526, hip: [0, 84], lean: 6, spin: 20, hF: [-8, 70], hB: [-22, 60], fF: [84, 46], fB: [-69, 30], e: 'lin', er: 'lin' },
  { t: 22.0, x: 982, y: -590, hip: [0, 84], lean: 12, spin: 24, hF: [-18, 70], hB: [-32, 60], fF: [93, 56], fB: [-71, 32], e: 'lin', er: 'lin' },
  { t: 22.2, x: 988, y: -655, hip: [0, 84], lean: 12, spin: 26, hF: [-18, 70], hB: [-32, 60], fF: [94, 60], fB: [-69, 30], e: 'lin', er: 'lin' },
];

// ═════════════════════════════════════════════════════════════════════════════
// FIGHTER B — The Powerhouse
// ═════════════════════════════════════════════════════════════════════════════
const B_KEYS = [
  { t: 0, x: 1440, y: 800, face: -1, hip: [0, 84], lean: 18, hF: [26, 54], hB: [-30, 40], fF: [20, 8], fB: [-24, 20] },
  ...air(0, 0.92, [1440, 800], 1420, 1700, [
    [0.4, { hip: [0, 84], lean: 24, hF: [10, 66], hB: [-24, 50], fF: [26, 8], fB: [-28, 18] }],
    [0.74, { hip: [0, 78], lean: 34, hF: [20, 60], hB: [-10, 56], fF: [40, 4], fB: [-40, 10] }],
  ], { hip: [8, 46], lean: 52, bend: 14, hF: [44, -50], hB: [-6, -60], fF: [52, 0], fB: [-52, 0], e: 'in' }),
  { t: 1.04, hip: [8, 40], lean: 56, bend: 15, hF: [44, -46], hB: [-6, -56], fF: [52, 0], fB: [-52, 0] },
  { t: 1.3, hip: [4, 60], lean: 40, tilt: -24, hF: [38, -44], hB: [-14, -52], fF: [52, 0], fB: [-52, 0] },
  { t: 1.56, p: 'bStance', hip: [0, 86], lean: 12, tilt: -4, hF: [34, -14], hB: [-22, -30], fF: [52, 0], fB: [-52, 0] },
  { t: 1.72, p: 'bStance', hip: [-8, 84], lean: 8, hF: [20, 10], hB: [-10, -30], fF: [52, 0], fB: [-52, 0] },
  // steps in, sword back over the shoulder… overhand cut
  { t: 1.86, x: 1370, hip: [-16, 80], lean: 0, hF: [-24, 36], hB: [26, -16], fF: [46, 0], fB: [-46, 0] },
  { t: 1.97, x: 1310, hip: [4, 80], lean: 22, hF: [10, 58], hB: [10, -24], fF: [50, 0], fB: [-48, 0], e: 'in' },
  { t: 2.06, x: 1284, hip: [16, 74], lean: 36, hF: [60, 30], hB: [-28, -20], fF: [56, 0], fB: [-52, 0], e: 'snap' },
  { t: 2.12, same: true },
  // beats the low thrust down
  { t: 2.22, x: 1290, hip: [2, 80], lean: 20, hF: [44, -4], hB: [-20, -26], fF: [50, 0], fB: [-50, 0] },
  { t: 2.3, x: 1296, hip: [-4, 78], lean: 14, hF: [52, -34], hB: [-24, -20], fF: [50, 0], fB: [-50, 0], e: 'snap' },
  // backhand: winds across the body, slashes at head height
  { t: 2.4, hip: [-12, 82], lean: 2, hF: [-6, 24], hB: [-30, -10], fF: [50, 0], fB: [-50, 0] },
  { t: 2.5, x: 1276, hip: [14, 78], lean: 28, hF: [72, 22], hB: [-40, 10], fF: [54, 0], fB: [-50, 0], e: 'snap' },
  { t: 2.6, hip: [16, 76], lean: 34, hF: [44, -24], hB: [-36, 0], fF: [54, 0], fB: [-50, 0] },
  // leans away from the rising cut
  { t: 2.68, x: 1270, hip: [-20, 84], lean: -22, tilt: -10, hF: [30, 12], hB: [-20, 20], fF: [50, 0], fB: [-50, 0], e: 'out' },
  // front kick
  { t: 2.75, x: 1206, hip: [-14, 88], lean: -14, hF: [0, 4], hB: [-34, 4], fF: [30, 54], fB: [-34, 0] },
  { t: 2.82, x: 1160, hip: [-18, 90], lean: -30, tilt: 14, hF: [-22, 6], hB: [-44, 20], fF: [100, 70], fB: [-36, 0], e: 'snap' },
  { t: 2.88, same: true },
  // plants, winds up with everything, and buries the blade in the ruler
  { t: 2.96, x: 1200, hip: [4, 78], lean: 16, hF: [-14, 44], hB: [20, -20], fF: [50, 0], fB: [-50, 0] },
  { t: 3.04, x: 1232, hip: [12, 78], lean: 28, hF: [6, 66], hB: [10, -24], fF: [54, 0], fB: [-50, 0], e: 'in' },
  { t: 3.12, x: 1240, hip: [22, 56], lean: 52, bend: 10, hF: [62, -54], hB: [-20, -30], fF: [56, 0], fB: [-52, 0], e: 'snap' },
  { t: 3.18, same: true },
  { t: 3.27, hip: [10, 66], lean: 42, bend: 10, hF: [60, -42], hB: [-24, -24], fF: [56, 0], fB: [-52, 0] },
  { t: 3.34, hip: [18, 60], lean: 48, bend: 10, hF: [62, -46], hB: [-20, -30], fF: [56, 0], fB: [-52, 0] },
  // the sword is struck out of his hand
  { t: 3.4, x: 1252, hip: [-14, 82], lean: -10, tilt: -12, hF: [34, 44], hB: [-34, 14], fF: [48, 0], fB: [-50, 0], e: 'snap' },
  { t: 3.5, x: 1280, hip: [-12, 84], lean: -6, tilt: 14, hF: [30, -6], hB: [-20, -20], fF: [46, 0], fB: [-46, 0] },
  // gives ground: sways out of two cuts
  { t: 3.6, x: 1310, hip: [-18, 86], lean: -20, hF: [24, 30], hB: [-30, 24], fF: [44, 0], fB: [-44, 0], e: 'out' },
  { t: 3.7, x: 1335, hip: [-6, 80], lean: 4, hF: [30, 0], hB: [-24, -10], fF: [46, 0], fB: [-46, 0] },
  { t: 3.8, x: 1356, hip: [-22, 84], lean: -26, tilt: -8, hF: [20, 40], hB: [-36, 30], fF: [44, 0], fB: [-44, 0], e: 'out' },
  { t: 3.9, x: 1296, hip: [-6, 76], lean: 8, hF: [20, -16], hB: [-30, -16], fF: [30, 44], fB: [-40, 0] },
  // thrust kick
  { t: 4.0, x: 1230, hip: [-20, 92], lean: -32, tilt: 16, hF: [-10, -6], hB: [-46, 14], fF: [96, 104], fB: [-36, 0], e: 'snap' },
  { t: 4.06, same: true },
  { t: 4.12, x: 1262, hip: [-6, 84], lean: -4, hF: [14, -20], hB: [-30, -6], fF: [40, 0], fB: [-36, 0] },
  // turns his back, two strides to the floating compass, reaches up for its long arm
  { t: 4.2, x: 1400, face: 1, p: 'bRun1', lean: 26, hop: 8 },
  { t: 4.28, x: 1520, p: 'bRun2', lean: 22, hF: [30, 10], hop: 8 },
  { t: 4.36, x: 1622, hip: [4, 98], lean: 4, hFw: armPt(116), hB: [4, 24], fF: [30, 0], fB: [-40, 0], e: 'out' },
  { t: 4.42, hip: [8, 100], lean: 8, hFw: armPt(116), hBw: armPt(176), fF: [30, 0], fB: [-40, 0] },
  // wrenches it off
  { t: 4.5, x: 1612, hip: [-16, 74], lean: -14, hF: [16, 14], hB: [-4, -30], fF: [36, 0], fB: [-44, 0], e: 'snap' },
  { t: 4.6, x: 1600, hip: [-6, 80], lean: 4, hF: [34, 26], hB: [-10, -20], fF: [36, 0], fB: [-44, 0] },
  { t: 4.7, x: 1590, face: -1, hip: [-4, 88], lean: 0, hF: [4, 62], hB: [-24, 40], fF: [40, 0], fB: [-40, 0] },
  // …and levels the point: a spear
  { t: 4.8, x: 1580, hip: [0, 72], lean: 24, hF: [42, -40], hB: [-10, -30], fF: [54, 0], fB: [-52, 0], e: 'in3' },
  { t: 4.9, hip: [0, 80], lean: 18, hF: [40, -38], hB: [-10, -30], fF: [54, 0], fB: [-52, 0] },
  // thrust 1
  { t: 4.98, hip: [-18, 80], lean: 4, hF: [8, -36], hB: [-30, -30], fF: [54, 0], fB: [-52, 0] },
  { t: 5.07, x: 1545, hip: [22, 74], lean: 32, hF: [72, -24], hB: [10, -30], fF: [60, 0], fB: [-56, 0], e: 'snap' },
  { t: 5.13, same: true },
  { t: 5.2, x: 1540, hip: [-12, 80], lean: 6, hF: [12, -32], hB: [-30, -30], fF: [54, 0], fB: [-52, 0] },
  // thrust 2, high
  { t: 5.3, x: 1500, hip: [22, 76], lean: 30, hF: [72, 0], hB: [10, -10], fF: [60, 0], fB: [-56, 0], e: 'snap' },
  { t: 5.38, hip: [4, 70], lean: 24, hF: [30, -40], hB: [-20, -30], fF: [58, 0], fB: [-56, 0] },
  // low sweep
  { t: 5.48, x: 1480, hip: [16, 60], lean: 40, hF: [60, -56], hB: [10, -50], fF: [60, 0], fB: [-56, 0], e: 'snap' },
  { t: 5.58, x: 1490, hip: [-6, 80], lean: 10, hF: [20, 10], hB: [-20, -10], fF: [52, 0], fB: [-52, 0] },
  // hauls the whole shaft back… and brings it down
  { t: 5.67, x: 1510, hip: [-22, 82], lean: -10, hF: [-16, 46], hB: [-40, 30], fF: [50, 0], fB: [-52, 0] },
  { t: T_SNAP, x: 1480, hip: [14, 72], lean: 34, hF: [56, 22], hB: [20, 10], fF: [58, 0], fB: [-56, 0], e: 'snap' },
  { t: 5.82, same: true },
  { t: 5.92, hip: [20, 60], lean: 46, hF: [56, -30], hB: [20, -40], fF: [58, 0], fB: [-56, 0] },
  // crouches… jumps back to the far end of the ruler and STAMPS it down
  { t: 6.02, x: 1490, hip: [0, 46], lean: 34, hF: [24, -10], hB: [-10, -30], fF: [50, 0], fB: [-50, 0] },
  { t: 6.08, hip: [0, 90], lean: 4, hF: [10, 50], hB: [-20, 40], fF: [40, 0], fB: [-40, 0], e: 'in' },
  ...air(6.08, 6.36, 1490, 1600, 6400, [
    [6.22, { hip: [0, 84], lean: -8, hF: [0, 66], hB: [-20, 60], fF: [30, 30], fB: [-20, 36] }],
  ], { hip: [4, 42], lean: 44, bend: 12, hF: [40, -40], hB: [0, -50], fF: [56, 0], fB: [-56, 0], e: 'in' }),
  { t: 6.47, hip: [4, 36], lean: 48, bend: 14, hF: [40, -36], hB: [0, -46], fF: [56, 0], fB: [-56, 0] },
  // levels the point down the slope and waits for A to slide onto it
  { t: 6.64, hip: [0, 62], lean: 30, hF: [40, -40], hB: [-10, -36], fF: [56, 0], fB: [-56, 0] },
  { t: 6.9, hip: [-4, 70], lean: 20, hF: [36, -36], hB: [-14, -30], fF: [56, 0], fB: [-56, 0] },
  { t: 7.04, hip: [-20, 72], lean: 4, hF: [8, -36], hB: [-30, -30], fF: [56, 0], fB: [-56, 0] },
  { t: 7.2, x: 1585, hip: [22, 68], lean: 34, hF: [72, -26], hB: [10, -30], fF: [62, 0], fB: [-56, 0], e: 'snap' },
  { t: 7.28, same: true },
  // catches the rising cut on the shaft
  { t: 7.36, x: 1590, hip: [-10, 80], lean: 6, hF: [30, -10], hB: [-20, -30], fF: [54, 0], fB: [-54, 0] },
  { t: 7.44, x: 1588, hip: [-14, 82], lean: 0, hF: [40, 14], hB: [-10, -10], fF: [54, 0], fB: [-54, 0], e: 'snap' },
  { t: 7.5, same: true },
  // throws the blade off and whips the butt end up at A's chin…
  { t: 7.6, x: 1482, hip: [12, 84], lean: 20, hF: [30, 30], hB: [40, 0], fF: [56, 0], fB: [-50, 0], e: 'snap' },
  { t: 7.68, hip: [8, 84], lean: 16, hF: [14, 40], hB: [30, 20], fF: [56, 0], fB: [-50, 0] },
  // …the head comes round low
  { t: 7.82, x: 1476, hip: [14, 62], lean: 38, hF: [58, -46], hB: [10, -40], fF: [58, 0], fB: [-54, 0], e: 'snap' },
  { t: 7.92, hip: [-4, 78], lean: 14, hF: [20, -30], hB: [-20, -30], fF: [56, 0], fB: [-54, 0] },
  // lunge
  { t: 8.0, hip: [-18, 80], lean: 4, hF: [8, -36], hB: [-30, -30], fF: [56, 0], fB: [-54, 0] },
  { t: 8.1, x: 1470, hip: [22, 74], lean: 32, hF: [72, -22], hB: [10, -30], fF: [60, 0], fB: [-56, 0], e: 'snap' },
  { t: 8.16, same: true },
  // catches the riposte on the shaft: bind
  { t: 8.24, x: 1520, hip: [-10, 80], lean: 0, hF: [38, 12], hB: [-10, -20], fF: [52, 0], fB: [-52, 0], e: 'snap' },
  { t: 8.36, x: 1516, hip: [-4, 80], lean: 8, hF: [42, 14], hB: [-6, -18], fF: [52, 0], fB: [-52, 0] },
  // rolls the shaft over: the butt end into A's gut
  { t: 8.42, x: 1512, hip: [-12, 80], lean: 4, hF: [10, -10], hB: [20, -30], fF: [52, 0], fB: [-52, 0] },
  { t: 8.48, x: 1503, hip: [14, 76], lean: 26, hF: [40, -24], hB: [60, -20], fF: [56, 0], fB: [-52, 0], e: 'snap' },
  { t: 8.54, same: true },
  // winds the spear right round, a huge committed lunge
  { t: 8.66, x: 1520, hip: [-8, 84], lean: 0, hF: [10, 30], hB: [-10, 10], fF: [52, 0], fB: [-52, 0] },
  { t: 8.78, x: 1530, hip: [-22, 76], lean: -4, hF: [0, -30], hB: [-30, -24], fF: [52, 0], fB: [-52, 0] },
  { t: 8.92, x: 1450, hip: [26, 62], lean: 44, hF: [70, -44], hB: [10, -40], fF: [66, 0], fB: [-60, 0], e: 'snap' },
  { t: 8.98, same: true },
  // the point is buried; A is on the shaft — B heaves at it, looks up
  { t: 9.06, hip: [22, 64], lean: 42, tilt: -24, hFw: [1296, -50], hB: [10, -40], fF: [66, 0], fB: [-60, 0] },
  { t: 9.14, hip: [24, 62], lean: 44, tilt: -34, hFw: [1296, -50], hB: [10, -40], fF: [66, 0], fB: [-60, 0] },
  // stamped flat
  { t: 9.21, hip: [26, 50], lean: 60, tilt: 24, bend: 14, hFw: [1296, -50], hB: [10, -36], fF: [66, 0], fB: [-60, 0], e: 'snap' },
  { t: 9.26, same: true },
  { t: 9.42, x: 1400, hip: [20, 54], lean: 56, tilt: 10, bend: 12, hF: [50, -40], hB: [0, -40], fF: [60, 0], fB: [-50, 0] },
  { t: 9.6, x: 1340, hip: [4, 70], lean: 30, hF: [30, -30], hB: [-10, -40], fF: [50, 0], fB: [-50, 0] },
  // rips the spear out, turns: a huge overhead sweep
  { t: 9.7, x: 1330, face: 1, hip: [-10, 84], lean: -6, hF: [-10, 50], hB: [-30, 30], fF: [44, 0], fB: [-44, 0] },
  { t: 9.8, x: 1346, hip: [16, 70], lean: 34, hF: [58, 28], hB: [20, 10], fF: [56, 0], fB: [-52, 0], e: 'snap' },
  { t: 9.86, same: true },
  // jumps the leg-cut — a great leap back onto the floating set square
  { t: 9.94, hip: [0, 52], lean: 30, hF: [30, -10], hB: [0, -30], fF: [50, 0], fB: [-50, 0] },
  { t: 9.99, hip: [-6, 88], lean: -10, hF: [20, 30], hB: [-10, 20], fF: [40, 0], fB: [-40, 0], e: 'in' },
  ...air(9.99, 10.48, 1346, [700, T1Y(10.48)], 6200, [
    [10.14, { hip: [0, 84], lean: -16, hF: [30, 40], hB: [10, 50], fF: [40, 30], fB: [0, 20] }],
    [10.32, { hip: [0, 76], lean: 10, hF: [34, 10], hB: [0, 10], fF: [36, 20], fB: [-20, 16] }],
  ], { hip: [0, 48], lean: 36, bend: 10, hF: [36, -30], hB: [-4, -40], fF: [50, 0], fB: [-50, 0], e: 'in' }),
  onT(10.58, { hip: [0, 54], lean: 32, hF: [36, -26], hB: [-4, -36], fF: [50, 0], fB: [-50, 0] }),
  onT(10.7, { x: 636, hip: [-6, 80], lean: 8, hF: [30, 10], hB: [-10, 0], fF: [50, 0], fB: [-50, 0] }),
  // shaft overhead: stops the falling cut
  onT(10.82, { x: 622, hip: [-8, 72], lean: -6, hF: [40, 44], hB: [-20, 40], fF: [52, 0], fB: [-52, 0], e: 'snap' }),
  onT(10.88, { same: true }),
  // heaves him off, sweeps the butt at his ankles
  onT(10.98, { x: 640, hip: [12, 80], lean: 16, hF: [52, 34], hB: [0, 30], fF: [52, 0], fB: [-52, 0], e: 'snap' }),
  onT(11.08, { x: 656, hip: [12, 60], lean: 34, hF: [30, -36], hB: [60, -50], fF: [56, 0], fB: [-52, 0], e: 'snap' }),
  onT(11.18, { x: 676, hip: [-16, 80], lean: -4, hF: [4, -6], hB: [-30, -20], fF: [46, 0], fB: [-46, 0] }),
  // drives the butt of the spear into his chest at full reach: off the edge
  onT(11.28, { x: 705, hip: [14, 76], lean: 20, hF: [74, -20], hB: [-30, -16], fF: [58, 0], fB: [-56, 0], e: 'snap' }),
  onT(11.34, { same: true }),
  onT(11.44, { x: 736, hip: [0, 50], lean: 30, hF: [10, 30], hB: [-20, 20], fF: [44, 0], fB: [-44, 0] }),
  // dives after him, spear first
  onT(11.5, { x: 772, hip: [6, 86], lean: 20, hF: [0, 62], hB: [-24, 52], fF: [30, 0], fB: [-40, 0], e: 'in' }),
  ...air(11.5, 11.92, [772, T1Y(11.5)], 1010, 5200, [
    [11.66, { hip: [0, 84], lean: 0, hF: [-4, 70], hB: [-24, 60], fF: [30, 20], fB: [-30, 30] }],
    [11.8, { hip: [0, 78], lean: 30, hF: [30, 50], hB: [6, 44], fF: [40, 10], fB: [-20, 20] }],
  ], { hip: [16, 46], lean: 54, bend: 10, hF: [60, 0], hB: [20, -10], fF: [56, 0], fB: [-56, 0], e: 'in' }),
  { t: 11.98, same: true },
  // wrenches it out and lunges — A bends under it, the point runs a floating cube through
  { t: 12.08, x: 1020, hip: [-14, 74], lean: 6, hF: [10, -20], hB: [-20, -30], fF: [50, 0], fB: [-50, 0] },
  { t: T_IMP, x: 1100, hip: [24, 72], lean: 34, hF: [72, -16], hB: [10, -30], fF: [62, 0], fB: [-58, 0], e: 'snap' },
  { t: 12.26, same: true },
  // the cube comes away on the spear: a mace. Hauls it up and over…
  { t: 12.38, x: 1070, hip: [-14, 80], lean: 0, hF: [20, -10], hB: [-20, -20], fF: [52, 0], fB: [-52, 0] },
  { t: 12.52, x: 1050, hip: [-18, 84], lean: -8, hF: [10, 40], hB: [-20, 20], fF: [50, 0], fB: [-50, 0] },
  { t: 12.66, x: 1040, hip: [-24, 80], lean: -16, hF: [-20, 60], hB: [-40, 40], fF: [48, 0], fB: [-50, 0] },
  { t: 12.78, hip: [-26, 78], lean: -18, hF: [-22, 60], hB: [-42, 40], fF: [48, 0], fB: [-50, 0] },
  // …and SLAMS it down where A was
  { t: T_SLAM, x: 1040, hip: [22, 56], lean: 52, bend: 10, hF: [58, -36], hB: [30, -40], fF: [58, 0], fB: [-54, 0], e: 'in3' },
  { t: 12.98, same: true },
  { t: 13.1, hip: [18, 60], lean: 46, hF: [50, -40], hB: [20, -44], fF: [58, 0], fB: [-54, 0] },
  // drags it back and rips it upward
  { t: 13.22, x: 1160, hip: [0, 62], lean: 30, hF: [30, -50], hB: [0, -50], fF: [54, 0], fB: [-54, 0] },
  { t: 13.36, x: 1250, hip: [14, 86], lean: 8, hF: [54, 40], hB: [30, 10], fF: [56, 0], fB: [-52, 0], e: 'snap' },
  { t: 13.48, x: 1246, hip: [-10, 86], lean: -10, hF: [0, 66], hB: [-20, 50], fF: [50, 0], fB: [-50, 0] },
  { t: 13.64, x: 1242, hip: [-18, 84], lean: -16, hF: [-10, 64], hB: [-30, 46], fF: [50, 0], fB: [-50, 0] },
  // second slam — A's cut takes the cube off in mid-air
  { t: T_SLICE, x: 1240, hip: [16, 72], lean: 30, hF: [58, 10], hB: [30, -10], fF: [58, 0], fB: [-54, 0], e: 'in3' },
  { t: 13.94, same: true },
  { t: 14.02, hip: [22, 60], lean: 46, hF: [58, -36], hB: [30, -40], fF: [58, 0], fB: [-54, 0], e: 'out' },
  // on the back foot: three parries, each one costing ground
  { t: 14.14, x: 1215, hip: [-12, 78], lean: 0, hF: [36, -24], hB: [0, -20], fF: [50, 0], fB: [-50, 0], e: 'snap' },
  { t: 14.24, x: 1170, hip: [-8, 80], lean: 6, hF: [30, -10], hB: [0, -30], fF: [50, 0], fB: [-50, 0] },
  { t: 14.34, x: 1110, hip: [-14, 78], lean: -4, hF: [40, 0], hB: [10, -30], fF: [50, 0], fB: [-50, 0], e: 'snap' },
  { t: 14.44, x: 1080, hip: [-8, 80], lean: 4, hF: [30, 10], hB: [-10, 0], fF: [50, 0], fB: [-50, 0] },
  { t: 14.54, x: 1050, hip: [-10, 60], lean: -6, hF: [40, 46], hB: [-20, 42], fF: [54, 0], fB: [-54, 0], e: 'snap' },
  { t: 14.6, same: true },
  { t: 14.7, x: 1040, hip: [-6, 72], lean: 4, hF: [36, 20], hB: [-14, 10], fF: [52, 0], fB: [-52, 0] },
  // hollows out of the thrust, slaps the blade down, whips the spear up and over and smashes the shaft across A's chest
  { t: 14.8, x: 1010, hip: [-24, 80], lean: 22, hF: [44, -34], hB: [0, -40], fF: [40, 0], fB: [-50, 0], e: 'snap' },
  { t: 14.88, x: 1040, hip: [-14, 82], lean: -8, hF: [-10, 58], hB: [-30, 40], fF: [44, 0], fB: [-48, 0] },
  { t: 14.93, x: 1100, hip: [2, 80], lean: 12, hF: [28, 60], hB: [0, 44], fF: [50, 0], fB: [-50, 0], e: 'in' },
  { t: 14.98, x: 1165, hip: [18, 70], lean: 36, hF: [66, -24], hB: [30, -30], fF: [56, 0], fB: [-58, 0], e: 'out' },
  { t: 15.04, same: true },
  // backs to the middle of the ruler… and looks at what is holding it up
  { t: 15.2, x: 1160, p: 'bStance', hip: [0, 84], lean: 10, hF: [30, -20], hB: [-10, -36] },
  { t: 15.36, x: 1136, p: 'bStance', hip: [0, 82], lean: 12, hF: [30, -24], hB: [-10, -38] },
  { t: 15.5, x: 1110, p: 'bStance', hip: [0, 84], lean: 14, tilt: 30, hF: [30, -24], hB: [-10, -38] },
  { t: 15.9, same: true },
  // 0:16 — hoists the spear, point down, both hands…
  { t: 16.02, x: 1112, hip: [-8, 94], lean: -8, hF: [10, 64], hB: [-10, 52], fF: [40, 0], fB: [-40, 0], e: 'out' },
  // …and drives it clean through the ruler
  { t: T_STAB, x: 1116, hip: [6, 64], lean: 24, bend: 8, hFw: shaftHand(295, T_STAB), hB: [-20, -20], fF: [50, 0], fB: [-50, 0], e: 'in3' },
  { t: 16.18, x: 1116, hip: [6, 64], lean: 24, bend: 8, hFw: shaftHand(295, 16.18), hB: [-20, -20], fF: [50, 0], fB: [-50, 0] },
  // gets his weight on the shaft: a lever
  { t: 16.36, x: 1110, hip: [-4, 78], lean: 6, hFw: shaftHand(293, 16.36), hB: [-20, 0], fF: [50, 0], fB: [-50, 0] },
  { t: 16.5, x: 1104, hip: [-16, 58], lean: -6, hFw: shaftHand(306, 16.5), hB: [-20, 0], fF: [54, 0], fB: [-46, 0], e: 'snap' },
  { t: 16.56, x: 1104, hip: [-16, 60], lean: -4, tilt: -16, hFw: shaftHand(306, 16.56), hB: [10, 20], fF: [54, 0], fB: [-46, 0] },
  // catches A's sword wrist in his free fist — and keeps levering with the other hand
  { t: 16.62, x: 1104, hip: [-12, 62], lean: -2, tilt: -24, hFw: shaftHand(304, 16.62), hBw: GRAB(16.62), fF: [54, 0], fB: [-46, 0], e: 'snap' },
  { t: 16.7, x: 1104, hip: [-10, 66], lean: 0, tilt: -26, hFw: shaftHand(301, 16.7), hBw: GRAB(16.7), fF: [54, 0], fB: [-46, 0] },
  { t: 16.8, x: 1102, hip: [-14, 60], lean: -4, tilt: -26, hFw: shaftHand(303, 16.8), hBw: GRAB(16.8), fF: [54, 0], fB: [-46, 0] },
  // flings the arm away…
  { t: 16.87, x: 1100, hip: [-6, 74], lean: 8, tilt: -10, hFw: shaftHand(300, 16.87), hB: [70, 44], fF: [54, 0], fB: [-46, 0], e: 'snap' },
  // hangs everything he has on it
  { t: T_SPLIT, x: 1090, hip: [-22, 44], lean: -14, hFw: shaftHand(326, T_SPLIT - 0.01), hB: [10, -30], fF: [60, 0], fB: [-40, 0], e: 'in3' },
  { t: 16.98, same: true },
  // the ruler gives — he stumbles back down his half with the spear
  { t: 17.1, x: 1040, hip: [-16, 70], lean: -14, tilt: -10, hF: [30, 30], hB: [-20, 20], fF: [40, 0], fB: [-44, 0], e: 'out' },
  { t: 17.26, x: 960, hip: [-8, 74], lean: 4, hF: [34, 0], hB: [-10, -20], fF: [46, 0], fB: [-46, 0] },
  { t: 17.44, x: 892, p: 'bStance', hip: [-4, 80], lean: 8, tilt: -20, hF: [36, -20], hB: [-10, -36] },
  { t: 17.6, x: 876, hip: [-8, 80], lean: 0, tilt: -24, hF: [30, 20], hB: [-20, 10], fF: [50, 0], fB: [-50, 0] },
  // shaft up: the falling cut drives him to a knee
  { t: 17.72, x: 868, hip: [-10, 58], lean: -8, hF: [40, 48], hB: [-20, 44], fF: [54, 0], fB: [-54, 0], e: 'snap' },
  { t: 17.8, same: true },
  // heaves A off, stabs up the slope
  { t: 17.92, x: 880, hip: [10, 80], lean: 16, hF: [52, 36], hB: [0, 30], fF: [52, 0], fB: [-52, 0], e: 'snap' },
  { t: 18.0, x: 808, hip: [-16, 78], lean: 2, hF: [8, -20], hB: [-30, -30], fF: [52, 0], fB: [-52, 0] },
  { t: 18.08, x: 824, hip: [22, 74], lean: 30, hF: [72, -32], hB: [10, -24], fF: [60, 0], fB: [-56, 0], e: 'snap' },
  { t: 18.14, same: true },
  // parries the riposte
  { t: 18.24, x: 890, hip: [-12, 78], lean: 0, hF: [36, 10], hB: [0, -20], fF: [50, 0], fB: [-50, 0], e: 'snap' },
  { t: 18.32, hip: [-6, 76], lean: 8, hF: [30, -20], hB: [0, -36], fF: [50, 0], fB: [-50, 0] },
  // low sweep at the ankles
  { t: 18.42, x: 876, hip: [12, 60], lean: 34, hF: [60, -50], hB: [10, -40], fF: [56, 0], fB: [-52, 0], e: 'snap' },
  { t: 18.52, hip: [0, 74], lean: 20, hF: [30, -30], hB: [-10, -36], fF: [54, 0], fB: [-52, 0] },
  // low thrust — stamped flat and pinned
  { t: 18.62, x: 880, hip: [22, 66], lean: 38, hF: [68, -50], hB: [10, -40], fF: [60, 0], fB: [-56, 0], e: 'snap' },
  { t: 18.68, hip: [22, 64], lean: 40, hF: [64, -62], hB: [10, -44], fF: [60, 0], fB: [-56, 0] },
  // heaves at it — it will not come. Looks up
  { t: 18.86, hip: [8, 72], lean: 28, tilt: -20, hFw: PIN_B, hB: [10, -44], fF: [60, 0], fB: [-56, 0] },
  { t: 19.0, hip: [26, 60], lean: 44, tilt: -30, hFw: PIN_B, hB: [10, -44], fF: [60, 0], fB: [-56, 0] },
  { t: 19.16, hip: [8, 72], lean: 26, tilt: -36, hFw: PIN_B, hB: [10, -44], fF: [60, 0], fB: [-56, 0] },
  { t: 19.34, hip: [22, 62], lean: 40, tilt: -44, hFw: PIN_B, hB: [10, -44], fF: [60, 0], fB: [-56, 0] },
  { t: T_CUT, hip: [14, 68], lean: 30, tilt: -50, hFw: PIN_B, hB: [10, -44], fF: [60, 0], fB: [-56, 0] },
  { t: 19.58, same: true },
  // his half of the ruler drops out from under the world
  { t: 19.72, x: 870, hip: [-12, 70], lean: -12, tilt: -30, hF: [40, 30], hB: [-40, 30], fF: [50, 0], fB: [-50, 0], e: 'out' },
  { t: 19.9, x: 860, hip: [0, 58], lean: 18, tilt: -40, hF: [36, -10], hB: [-30, 10], fF: [52, 0], fB: [-52, 0] },
  { t: 20.1, x: 854, hip: [0, 48], lean: 26, tilt: -46, hF: [30, -20], hB: [-10, -40], fF: [50, 0], fB: [-50, 0] },
  // kicks off the falling slab to meet A
  { t: 20.26, x: 852, hip: [0, 90], lean: 0, tilt: -30, hF: [20, 40], hB: [0, 30], fF: [30, 0], fB: [-30, 0], e: 'in' },
  { t: 20.5, x: 824, y: 'F-30', hip: [0, 84], lean: -10, spin: -30, hF: [30, 30], hB: [0, 20], fF: [40, 20], fB: [-20, 34], hop: 26 },
  // coils in the air, the spear drawn right back…
  { t: 20.64, x: 786, y: 'F-96', hip: [0, 84], lean: 10, spin: -10, hF: [-6, 6], hB: [-36, -6], fF: [40, 50], fB: [-10, 44], e: 'lin', er: 'lin' },
  // …and his whole body goes into one long thrust up at the diving A
  { t: 20.72, x: 765, y: 'F-128', hip: [0, 84], lean: 20, spin: 20, hF: [24, 67], hB: [-10, 40], fF: [38, 66], fB: [-32, -6], e: 'snap', er: 'lin' },
  { t: 20.78, x: 763, y: 'F-146', hip: [0, 84], lean: 20, spin: 20, hF: [20, 68], hB: [-12, 40], fF: [38, 66], fB: [-32, -6], e: 'lin', er: 'lin' },
  // beaten wide, he tumbles onto his back, dragging the shaft across his body
  { t: 21.02, x: 772, y: 'F-226', hip: [0, 84], lean: -6, spin: -40, hF: [30, 20], hB: [-30, 24], fF: [72, 86], fB: [31, -9], e: 'io', er: 'lin' },
  { t: 21.16, x: 782, y: 'F-268', hip: [0, 84], lean: -8, spin: -62, hF: [36, 30], hB: [-34, 34], fF: [70, 61], fB: [4, -16], e: 'lin', er: 'lin' },
  // the shaft goes up like a bar, both arms locked
  { t: T_CLASH, x: 790, y: 'F-300', hip: [0, 84], lean: -6, spin: -72, hFw: [745, -424], hB: [-40, 62], fF: [68, 49], fB: [-10, -16], e: 'snap', er: 'lin' },
  { t: 21.38, x: 789, y: 'F-336', hip: [0, 84], lean: -6, spin: -72, hFw: [744, -462], hB: [-40, 58], fF: [68, 49], fB: [-10, -16], e: 'lin', er: 'lin' },
  // driven down flat on his back, limbs trailing, the point coming round to A again
  { t: 21.6, x: 778, y: 'F-430', hip: [0, 84], lean: -8, spin: -78, hF: [60, 20], hB: [-50, 40], fF: [45, 25], fB: [-42, -7], e: 'out', er: 'lin' },
  { t: 21.8, x: 770, y: 'F-478', hip: [0, 84], lean: -6, spin: -66, hF: [70, 8], hB: [-56, 34], fF: [48, 30], fB: [-28, -12], e: 'lin', er: 'lin' },
  { t: 22.0, x: 764, y: 'F-522', hip: [0, 84], lean: -4, spin: -60, hF: [76, 0], hB: [-60, 30], fF: [52, 37], fB: [-20, -14], e: 'lin', er: 'lin' },
  { t: 22.2, x: 760, y: 'F-584', hip: [0, 84], lean: -4, spin: -58, hF: [76, 0], hB: [-60, 30], fF: [53, 39], fB: [-16, -15], e: 'lin', er: 'lin' },
];
// B's free-fall heights are written relative to where the slab is when he kicks off it
{
  const f0 = R(852, 20.26);
  for (const k of B_KEYS) if (typeof k.y === 'string') k.y = f0 + Number(k.y.slice(1));
}

S.fighters({ A: ground(A_KEYS, 0.95), B: ground(B_KEYS, 1.1) });

// ═════════════════════════════════════════════════════════════════════════════
// WEAPONS
// ═════════════════════════════════════════════════════════════════════════════
// A's shortsword — snapped by the spear shaft at T_SNAP (it becomes a stub: type 'knife')
S.weapon('swA', wk([
  { t: 0, type: 'shortsword', by: 'A', ang: 112 },
  { t: 0.3, by: 'A', ang: 124 }, { t: 0.56, by: 'A', ang: 100 }, { t: 0.7, by: 'A', ang: 24, e: 'in' },
  { t: 0.8, by: 'A', ang: 12 }, { t: 0.93, by: 'A', ang: 30 }, { t: 1.03, by: 'A', ang: 84 }, { t: 1.2, by: 'A', ang: 62 },
  { t: 1.36, by: 'A', ang: 55 }, { t: 1.48, by: 'A', ang: 235, ccw: 1, e: 'lin' }, { t: 1.6, by: 'A', ang: 55, ccw: 1, e: 'lin' },
  { t: 1.9, by: 'A', ang: 55 }, { t: 1.98, by: 'A', ang: 48 }, { t: 2.06, by: 'A', ang: 25, e: 'snap' }, { t: 2.12, by: 'A', ang: 25 },
  { t: 2.22, by: 'A', ang: 352, e: 'snap' }, { t: 2.3, by: 'A', ang: 332 }, { t: 2.4, by: 'A', ang: 40 }, { t: 2.5, by: 'A', ang: 20 },
  { t: 2.57, by: 'A', ang: 328 }, { t: 2.66, by: 'A', ang: 78, e: 'snap' }, { t: 2.74, by: 'A', ang: 104 },
  { t: 2.82, by: 'A', ang: 100 }, { t: 2.88, by: 'A', ang: 100 }, { t: 3.02, by: 'A', ang: 30 }, { t: 3.1, by: 'A', ang: 60 },
  { t: 3.2, by: 'A', ang: 185, ccw: 1 }, { t: 3.29, by: 'A', ang: 270, ccw: 1, e: 'in' }, { t: 3.36, by: 'A', ang: 350, ccw: 1, e: 'snap' },
  { t: 3.43, by: 'A', ang: 356 },
  { t: 3.5, by: 'A', ang: 115, ccw: 1 }, { t: 3.6, by: 'A', ang: 335, cw: 1, e: 'snap' }, { t: 3.7, by: 'A', ang: 318 },
  { t: 3.8, by: 'A', ang: 75, ccw: 1, e: 'snap' }, { t: 3.9, by: 'A', ang: 58 },
  { t: 4.0, by: 'A', ang: 104 }, { t: 4.06, by: 'A', ang: 104 }, { t: 4.2, by: 'A', ang: 20 }, { t: 4.36, by: 'A', ang: 30 },
  { t: 4.52, by: 'A', ang: 50 }, { t: 4.62, by: 'A', ang: 100 }, { t: 4.7, by: 'A', ang: 110 }, { t: 4.8, by: 'A', ang: 70 },
  { t: 4.9, by: 'A', ang: 55 }, { t: 4.98, by: 'A', ang: 55 }, { t: 5.07, by: 'A', ang: 300, cw: 1, e: 'snap' }, { t: 5.13, by: 'A', ang: 296 },
  { t: 5.22, by: 'A', ang: 58 }, { t: 5.3, by: 'A', ang: 20 }, { t: 5.4, by: 'A', ang: 24 }, { t: 5.48, by: 'A', ang: 60 },
  { t: 5.58, by: 'A', ang: 30 }, { t: 5.66, by: 'A', ang: 2, e: 'snap' }, { t: 5.72, by: 'A', ang: 12 },
  { t: T_SNAP, by: 'A', ang: 8, type: 'knife', g: 0.17 }, { t: 5.82, by: 'A', ang: 8 },
  { t: 5.9, by: 'A', ang: 70 },
  { t: 5.92, at: [1163, 68], ang: 72 },
  { t: 6.6, at: [1010, H0 - 520], ang: 80, turns: 2, hop: 330, e: 'lin' },
  { t: 6.62, at: [1010, H0 - 520], ang: 80, gone: true },
]));

// B's shortsword — struck from his hand at 3.36, spins off and sticks in a floating cube
const SW_REST = [C1.x - 35, -C1.y + 45];
S.weapon('swB', wk([
  { t: 0, type: 'shortsword', by: 'B', ang: 78 },
  { t: 0.4, by: 'B', ang: 68 }, { t: 0.74, by: 'B', ang: 58 }, { t: 0.92, by: 'B', ang: 200, e: 'in' }, { t: 1.04, by: 'B', ang: 202 },
  { t: 1.3, by: 'B', ang: 188 }, { t: 1.56, by: 'B', ang: 140 }, { t: 1.72, by: 'B', ang: 118 },
  { t: 1.86, by: 'B', ang: 48 }, { t: 1.97, by: 'B', ang: 96, e: 'in' }, { t: 2.06, by: 'B', ang: 140, e: 'snap' }, { t: 2.12, by: 'B', ang: 140 },
  { t: 2.22, by: 'B', ang: 150 }, { t: 2.3, by: 'B', ang: 212, e: 'snap' }, { t: 2.4, by: 'B', ang: 70, cw: 1 },
  { t: 2.5, by: 'B', ang: 178, ccw: 1, e: 'snap' }, { t: 2.6, by: 'B', ang: 216 }, { t: 2.68, by: 'B', ang: 140 },
  { t: 2.75, by: 'B', ang: 110 }, { t: 2.82, by: 'B', ang: 62 }, { t: 2.88, by: 'B', ang: 62 },
  { t: 2.96, by: 'B', ang: 50 }, { t: 3.04, by: 'B', ang: 86, e: 'in' }, { t: 3.12, by: 'B', ang: 205, e: 'snap' },
  { t: 3.18, by: 'B', ang: 205 }, { t: 3.27, by: 'B', ang: 203 }, { t: 3.34, by: 'B', ang: 205 },
  { t: 3.36, at: [1062, R(1062, 3.36, 40)], ang: 205 },
  { t: T_STICK, at: SW_REST, ang: 20, ccw: 1, turns: 1, hop: 170, e: 'lin' },
  { t: 22.2, at: SW_REST, ang: 20 },
]));

// the compass's needle arm → B's spear
S.weapon('spear', wk([
  { t: 0, type: 'spear', at: armPt(145), ang: ARM_ANG },
  { t: 4.36, by: 'B', ang: ARM_ANG, g: 0.4, two: 0 },
  { t: 4.42, by: 'B', ang: ARM_ANG },
  { t: 4.5, by: 'B', ang: 232, e: 'snap' },
  { t: 4.6, by: 'B', ang: 20, ccw: 1, e: 'in' },
  { t: 4.7, by: 'B', ang: 110, e: 'lin' },
  { t: 4.8, by: 'B', ang: 180, two: 1, e: 'out' },
  { t: 4.9, by: 'B', ang: 180 }, { t: 4.98, by: 'B', ang: 180 }, { t: 5.07, by: 'B', ang: 178, e: 'snap' }, { t: 5.13, by: 'B', ang: 186 },
  { t: 5.2, by: 'B', ang: 178 }, { t: 5.3, by: 'B', ang: 173, e: 'snap' }, { t: 5.38, by: 'B', ang: 198 },
  { t: 5.48, by: 'B', ang: 202, e: 'snap' }, { t: 5.58, by: 'B', ang: 150 }, { t: 5.67, by: 'B', ang: 70 },
  { t: T_SNAP, by: 'B', ang: 170, e: 'snap' }, { t: 5.82, by: 'B', ang: 172 }, { t: 5.92, by: 'B', ang: 196 },
  { t: 6.02, by: 'B', ang: 160 }, { t: 6.08, by: 'B', ang: 150 }, { t: 6.22, by: 'B', ang: 170 }, { t: 6.36, by: 'B', ang: 188 },
  { t: 6.47, by: 'B', ang: 186 }, { t: 6.64, by: 'B', ang: 176 }, { t: 6.9, by: 'B', ang: 174 }, { t: 7.04, by: 'B', ang: 174 },
  { t: 7.2, by: 'B', ang: 176, e: 'snap' }, { t: 7.28, by: 'B', ang: 188 },
  { t: 7.36, by: 'B', ang: 160 }, { t: 7.44, by: 'B', ang: 118, e: 'snap' }, { t: 7.5, by: 'B', ang: 116 },
  { t: 7.6, by: 'B', ang: 340, two: 0.15, cw: 1, e: 'snap' }, { t: 7.68, by: 'B', ang: 296, two: 0.15, cw: 1 },
  { t: 7.82, by: 'B', ang: 199, two: 1, cw: 1, e: 'snap' }, { t: 7.92, by: 'B', ang: 184 }, { t: 8.0, by: 'B', ang: 180 },
  { t: 8.1, by: 'B', ang: 177, e: 'snap' }, { t: 8.16, by: 'B', ang: 166 },
  { t: 8.24, by: 'B', ang: 112, e: 'snap' }, { t: 8.36, by: 'B', ang: 108 },
  { t: 8.42, by: 'B', ang: 30, cw: 1 }, { t: 8.48, by: 'B', ang: 6, e: 'snap' }, { t: 8.54, by: 'B', ang: 6 },
  { t: 8.66, by: 'B', ang: 100, ccw: 1 }, { t: 8.78, by: 'B', ang: 176, ccw: 1 },
  { t: 8.92, by: 'B', ang: 203, e: 'snap' }, { t: 9.26, by: 'B', ang: 203 }, { t: 9.42, by: 'B', ang: 200 }, { t: 9.6, by: 'B', ang: 190 },
  { t: 9.7, by: 'B', ang: 110, cw: 1 }, { t: 9.8, by: 'B', ang: 30, cw: 1, e: 'snap' }, { t: 9.86, by: 'B', ang: 32 },
  { t: 9.94, by: 'B', ang: 10 }, { t: 9.99, by: 'B', ang: 40 }, { t: 10.14, by: 'B', ang: 60 }, { t: 10.32, by: 'B', ang: 20 },
  { t: 10.48, by: 'B', ang: 350, e: 'in' }, { t: 10.58, by: 'B', ang: 352 }, { t: 10.7, by: 'B', ang: 40 },
  { t: 10.82, by: 'B', ang: 8, e: 'snap' }, { t: 10.88, by: 'B', ang: 8 },
  { t: 10.98, by: 'B', ang: 30, e: 'snap' }, { t: 11.08, by: 'B', ang: 150, ccw: 1, e: 'snap' }, { t: 11.18, by: 'B', ang: 176, g: 0.36, two: 0.4 },
  { t: 11.28, by: 'B', ang: 174, g: 0.25, two: 0, e: 'snap' }, { t: 11.34, by: 'B', ang: 174, g: 0.25, two: 0 }, { t: 11.44, by: 'B', ang: 330, g: 0.4, two: 1, cw: 1 }, { t: 11.5, by: 'B', ang: 320 },
  { t: 11.66, by: 'B', ang: 310 }, { t: 11.8, by: 'B', ang: 318 }, { t: 11.92, by: 'B', ang: 325, e: 'in' }, { t: 11.98, by: 'B', ang: 325 },
  { t: 12.08, by: 'B', ang: 0 }, { t: T_IMP, by: 'B', ang: 2, e: 'snap' }, { t: 12.26, by: 'B', ang: 2 }, { t: 12.38, by: 'B', ang: 6 },
  { t: 12.52, by: 'B', ang: 60, ccw: 1 }, { t: 12.66, by: 'B', ang: 130, ccw: 1 }, { t: 12.78, by: 'B', ang: 136 },
  { t: T_SLAM, by: 'B', ang: 350, cw: 1, e: 'in3' }, { t: 12.98, by: 'B', ang: 350 }, { t: 13.1, by: 'B', ang: 352 },
  { t: 13.22, by: 'B', ang: 338 }, { t: 13.36, by: 'B', ang: 62, ccw: 1, e: 'snap' }, { t: 13.48, by: 'B', ang: 100 }, { t: 13.64, by: 'B', ang: 124 },
  { t: T_SLICE, by: 'B', ang: 25, cw: 1, e: 'in3' }, { t: 13.94, by: 'B', ang: 22 }, { t: 14.02, by: 'B', ang: 346, cw: 1, e: 'out' },
  { t: 14.14, by: 'B', ang: 70, ccw: 1, e: 'snap' }, { t: 14.24, by: 'B', ang: 40 }, { t: 14.34, by: 'B', ang: 100, e: 'snap' },
  { t: 14.44, by: 'B', ang: 50 }, { t: 14.54, by: 'B', ang: 5, e: 'snap' }, { t: 14.6, by: 'B', ang: 5 }, { t: 14.7, by: 'B', ang: 30 },
  { t: 14.8, by: 'B', ang: 330, cw: 1, e: 'snap' }, { t: 14.88, by: 'B', ang: 148, ccw: 1 }, { t: 14.93, by: 'B', ang: 96, e: 'in' }, { t: 14.98, by: 'B', ang: 0, cw: 1, e: 'out' }, { t: 15.04, by: 'B', ang: 358 },
  { t: 15.2, by: 'B', ang: 40 }, { t: 15.36, by: 'B', ang: 50 }, { t: 15.5, by: 'B', ang: 80 }, { t: 15.9, by: 'B', ang: 84 },
  { t: 16.02, by: 'B', ang: 300, cw: 1 }, { t: T_STAB, by: 'B', ang: 295, e: 'in3' }, { t: 16.18, by: 'B', ang: 295 }, { t: 16.36, by: 'B', ang: 293 },
  { t: 16.5, by: 'B', ang: 306, e: 'snap' }, { t: 16.56, by: 'B', ang: 306, two: 0.2 }, { t: 16.62, by: 'B', ang: 304, two: 0 }, { t: 16.7, by: 'B', ang: 301, two: 0 },
  { t: 16.8, by: 'B', ang: 303, two: 0 }, { t: 16.87, by: 'B', ang: 300, two: 0 },
  { t: T_SPLIT, by: 'B', ang: 326, two: 1, e: 'in3' }, { t: 16.98, by: 'B', ang: 326 },
  { t: 17.1, by: 'B', ang: 30, ccw: 1 }, { t: 17.26, by: 'B', ang: 20 }, { t: 17.44, by: 'B', ang: 24 }, { t: 17.6, by: 'B', ang: 40 },
  { t: 17.72, by: 'B', ang: 6, e: 'snap' }, { t: 17.8, by: 'B', ang: 6 }, { t: 17.92, by: 'B', ang: 30, e: 'snap' }, { t: 18.0, by: 'B', ang: 14 },
  { t: 18.08, by: 'B', ang: 3, e: 'snap' }, { t: 18.14, by: 'B', ang: 352 }, { t: 18.24, by: 'B', ang: 70, e: 'snap' }, { t: 18.32, by: 'B', ang: 30 },
  { t: 18.42, by: 'B', ang: 348, cw: 1, e: 'snap' }, { t: 18.52, by: 'B', ang: 10 }, { t: 18.62, by: 'B', ang: 350, e: 'snap' },
  { t: 18.68, by: 'B', ang: 351 }, { t: 19.58, by: 'B', ang: 351 },
  { t: 19.72, by: 'B', ang: 20 }, { t: 19.9, by: 'B', ang: 40 }, { t: 20.1, by: 'B', ang: 50 }, { t: 20.26, by: 'B', ang: 70 },
  { t: 20.5, by: 'B', ang: 60, two: 1 }, { t: 20.64, by: 'B', ang: 52, two: 0.6 }, { t: 20.72, by: 'B', ang: 70, two: 0, e: 'snap' }, { t: 20.78, by: 'B', ang: 78, two: 0 },
  { t: 21.02, by: 'B', ang: 104, two: 1 }, { t: 21.16, by: 'B', ang: 124 }, { t: T_CLASH, by: 'B', ang: 132, e: 'snap' }, { t: 21.38, by: 'B', ang: 134 },
  { t: 21.6, by: 'B', ang: 96, two: 0, cw: 1 }, { t: 21.8, by: 'B', ang: 64, two: 0 }, { t: 22.0, by: 'B', ang: 50, two: 0 }, { t: 22.2, by: 'B', ang: 48, two: 0 },
]));

// the line A draws along the ruler's edge → his longsword
S.weapon('long', wk([
  { t: T_GRAB, type: 'longsword', by: 'A', ang: 173, g: 0.1, two: 0 },
  { t: 6.98, by: 'A', ang: 168, e: 'lin' },
  { t: 7.06, by: 'A', ang: 140, two: 0.5, e: 'lin' },
  { t: 7.13, by: 'A', ang: 100, two: 1, e: 'lin' },
  { t: 7.2, by: 'A', ang: 345, cw: 1, e: 'snap' },
  { t: 7.28, by: 'A', ang: 340 },
  { t: 7.36, by: 'A', ang: 322 }, { t: 7.44, by: 'A', ang: 26, e: 'snap' }, { t: 7.5, by: 'A', ang: 30 },
  { t: 7.6, by: 'A', ang: 72 }, { t: 7.72, by: 'A', ang: 58 }, { t: 7.82, by: 'A', ang: 84 }, { t: 7.94, by: 'A', ang: 48 },
  { t: 8.02, by: 'A', ang: 328 }, { t: 8.1, by: 'A', ang: 84, e: 'snap' }, { t: 8.16, by: 'A', ang: 88 },
  { t: 8.24, by: 'A', ang: 14, e: 'snap' }, { t: 8.36, by: 'A', ang: 12 },
  { t: 8.48, by: 'A', ang: 70 }, { t: 8.54, by: 'A', ang: 70 }, { t: 8.74, by: 'A', ang: 36 }, { t: 8.84, by: 'A', ang: 112 },
  { t: 8.92, by: 'A', ang: 318, cw: 1, e: 'snap' }, { t: 8.98, by: 'A', ang: 316 },
  { t: 9.05, by: 'A', ang: 20 }, { t: 9.13, by: 'A', ang: 100 }, { t: 9.21, by: 'A', ang: 120 }, { t: 9.26, by: 'A', ang: 120 },
  { t: 9.36, by: 'A', ang: 40, cw: 1, e: 'lin' }, { t: 9.46, by: 'A', ang: 270, cw: 1, e: 'lin' }, { t: 9.54, by: 'A', ang: 120, cw: 1, e: 'lin' },
  { t: 9.6, by: 'A', ang: 20, cw: 1, e: 'lin' },
  { t: 9.68, by: 'A', ang: 110, ccw: 1 }, { t: 9.8, by: 'A', ang: 152, e: 'snap' }, { t: 9.86, by: 'A', ang: 152 },
  { t: 9.94, by: 'A', ang: 150 }, { t: 10.02, by: 'A', ang: 192, e: 'snap' }, { t: 10.1, by: 'A', ang: 196 },
  { t: 10.18, by: 'A', ang: 150 }, { t: 10.26, by: 'A', ang: 140 }, { t: 10.34, by: 'A', ang: 150 }, { t: 10.4, by: 'A', ang: 170 },
  { t: 10.49, by: 'A', ang: 140 }, { t: 10.58, by: 'A', ang: 110 }, { t: 10.7, by: 'A', ang: 70 },
  { t: 10.82, by: 'A', ang: 160, ccw: 1, e: 'in' }, { t: 10.88, by: 'A', ang: 160 },
  { t: 10.98, by: 'A', ang: 120 }, { t: 11.08, by: 'A', ang: 100 }, { t: 11.18, by: 'A', ang: 140 }, { t: 11.28, by: 'A', ang: 76 },
  { t: 11.34, by: 'A', ang: 100 }, { t: 11.46, by: 'A', ang: 60 }, { t: 11.58, by: 'A', ang: 120 }, { t: 11.7, by: 'A', ang: 200 },
  { t: 11.86, by: 'A', ang: 205 }, { t: 11.94, by: 'A', ang: 150 }, { t: 12.06, by: 'A', ang: 135 },
  { t: T_IMP, by: 'A', ang: 346, cw: 1, e: 'snap' }, { t: 12.26, by: 'A', ang: 346 }, { t: 12.4, by: 'A', ang: 115, cw: 1, e: 'snap' },
  { t: 12.54, by: 'A', ang: 140 }, { t: 12.7, by: 'A', ang: 160 }, { t: 12.78, by: 'A', ang: 120 },
  { t: 12.88, by: 'A', ang: 230, ccw: 1, e: 'lin' }, { t: 12.98, by: 'A', ang: 10, ccw: 1, e: 'lin' }, { t: 13.08, by: 'A', ang: 140, ccw: 1, e: 'lin' },
  { t: 13.2, by: 'A', ang: 140 }, { t: 13.34, by: 'A', ang: 110 }, { t: 13.5, by: 'A', ang: 215, ccw: 1 }, { t: 13.72, by: 'A', ang: 222 },
  { t: T_SLICE, by: 'A', ang: 105, cw: 1, e: 'snap' }, { t: 13.94, by: 'A', ang: 100 },
  { t: 14.04, by: 'A', ang: 62, cw: 1 }, { t: 14.14, by: 'A', ang: 195, ccw: 1, e: 'snap' }, { t: 14.24, by: 'A', ang: 215 },
  { t: 14.34, by: 'A', ang: 160, cw: 1, e: 'snap' }, { t: 14.44, by: 'A', ang: 40, cw: 1 }, { t: 14.54, by: 'A', ang: 160, ccw: 1, e: 'snap' },
  { t: 14.6, by: 'A', ang: 160 }, { t: 14.7, by: 'A', ang: 178 }, { t: 14.8, by: 'A', ang: 182, e: 'snap' }, { t: 14.87, by: 'A', ang: 200 },
  { t: 14.98, by: 'A', ang: 70 }, { t: 15.04, by: 'A', ang: 66 }, { t: 15.16, by: 'A', ang: 60 }, { t: 15.3, by: 'A', ang: 200 },
  { t: 15.46, by: 'A', ang: 205 }, { t: 15.7, by: 'A', ang: 160 }, { t: 15.9, by: 'A', ang: 140 },
  { t: 16.04, by: 'A', ang: 140 }, { t: T_STAB, by: 'A', ang: 120 }, { t: 16.22, by: 'A', ang: 150 }, { t: 16.38, by: 'A', ang: 140 },
  { t: 16.46, by: 'A', ang: 80 }, { t: 16.54, by: 'A', ang: 62 }, { t: 16.62, by: 'A', ang: 150, ccw: 1, e: 'snap' }, { t: 16.7, by: 'A', ang: 146 },
  { t: 16.8, by: 'A', ang: 156 }, { t: 16.87, by: 'A', ang: 96, e: 'out' }, { t: 16.98, by: 'A', ang: 80 }, { t: 17.1, by: 'A', ang: 200 }, { t: 17.2, by: 'A', ang: 170 },
  { t: 17.28, by: 'A', ang: 120 }, { t: 17.42, by: 'A', ang: 80 }, { t: 17.58, by: 'A', ang: 62 },
  { t: 17.72, by: 'A', ang: 160, ccw: 1, e: 'in' }, { t: 17.8, by: 'A', ang: 160 },
  { t: 17.92, by: 'A', ang: 120 }, { t: 18.0, by: 'A', ang: 140 }, { t: 18.08, by: 'A', ang: 212, ccw: 1, e: 'snap' }, { t: 18.14, by: 'A', ang: 214 },
  { t: 18.18, by: 'A', ang: 90, cw: 1 }, { t: 18.24, by: 'A', ang: 188, ccw: 1, e: 'snap' }, { t: 18.32, by: 'A', ang: 150 },
  { t: 18.42, by: 'A', ang: 100 }, { t: 18.52, by: 'A', ang: 140 }, { t: 18.62, by: 'A', ang: 120 }, { t: 18.68, by: 'A', ang: 130 },
  { t: 18.74, by: 'A', ang: 130 }, { t: 18.92, by: 'A', ang: 100 }, { t: 19.12, by: 'A', ang: 70 }, { t: 19.38, by: 'A', ang: 58 },
  { t: T_CUT, by: 'A', ang: 268, ccw: 1, e: 'in3' }, { t: 19.58, by: 'A', ang: 268 }, { t: 19.74, by: 'A', ang: 215 }, { t: 19.92, by: 'A', ang: 190 },
  { t: 20.02, by: 'A', ang: 110 }, { t: 20.2, by: 'A', ang: 70 }, { t: 20.45, by: 'A', ang: 50 }, { t: 20.62, by: 'A', ang: 250, cw: 1 }, { t: 20.72, by: 'A', ang: 150, cw: 1, e: 'snap' },
  { t: 20.78, by: 'A', ang: 144 }, { t: 21.02, by: 'A', ang: 50, cw: 1 }, { t: 21.16, by: 'A', ang: 40 }, { t: T_CLASH, by: 'A', ang: 224, ccw: 1, e: 'snap' },
  { t: 21.38, by: 'A', ang: 226 }, { t: 21.6, by: 'A', ang: 110, cw: 1 }, { t: 21.8, by: 'A', ang: 66 }, { t: 22.0, by: 'A', ang: 44 }, { t: 22.2, by: 'A', ang: 42 },
]));

// ═════════════════════════════════════════════════════════════════════════════
// CAMERA
// ═════════════════════════════════════════════════════════════════════════════
const M = (t, z, o = {}) => ({ t, a: 0.5, b: 0.5, y: -45, z, ...o });
S.camera([
  { t: 0, x: 1160, y: -230, z: 0.9 },
  { t: 0.7, x: 1160, y: -120, z: 1.05 },
  { t: 0.92, x: 1160, y: -70, z: 1.12, e: 'in' },
  { t: 1.0, x: 1160, y: -60, z: 1.2, e: 'snap' },
  M(1.8, 1.42),
  M(2.04, 1.6, { y: -50 }),
  M(2.1, 1.72, { y: -50, e: 'snap' }),
  M(2.4, 1.6, { y: -50 }),
  M(2.78, 1.72, { y: -50 }),
  M(2.84, 2.05, { y: -56, r: -3, e: 'snap' }),
  M(2.98, 1.7, { y: -50, r: 0, e: 'out' }),
  M(3.1, 1.66, { y: -50, e: 'lin' }),
  M(3.34, 1.7, { y: -40 }),
  M(3.4, 1.95, { y: -30, e: 'snap' }),
  M(3.56, 1.6, { y: -50 }),
  { t: 3.8, x: 1500, y: -95, z: 1.5, e: 'out' },
  { t: 3.9, x: 1510, y: -98, z: 1.55 },
  { t: 3.98, a: 0.5, b: 0.5, y: -62, z: 1.75 },
  { t: 4.03, a: 0.5, b: 0.5, y: -66, z: 2.05, r: 3, e: 'snap' },
  { t: 4.22, a: 0.4, b: 0.6, y: -70, z: 1.3, e: 'out' },
  { t: 4.42, a: 0.2, b: 0.8, y: -110, z: 1.45 },
  M(4.82, 1.3, { y: -70 }),
  M(5.7, 1.42, { y: -55, e: 'lin' }),
  M(5.75, 1.42, { y: -55 }),
  M(5.8, 1.7, { y: -55, e: 'snap' }),
  M(6.1, 1.0, { y: -60, e: 'out' }),
  M(6.36, 0.98, { y: -40 }),
  M(6.5, 1.05, { y: -40, r: 3, e: 'snap' }),
  { t: 6.9, a: 0.75, b: 0.25, y: -30, z: 1.5, r: 5 },
  M(7.16, 1.5, { r: 4 }),
  M(7.22, 1.85, { r: 4, e: 'snap' }),
  M(7.5, 1.45, { r: 2, e: 'out' }),
  M(8.2, 1.5, { r: 0, e: 'lin' }),
  M(8.4, 1.72, { y: -55 }),
  M(8.46, 1.72, { y: -55 }),
  M(8.52, 1.9, { y: -55, e: 'snap' }),
  M(8.8, 1.4, { e: 'out' }),
  M(9.0, 1.45),
  M(9.18, 1.5, { y: -80 }),
  M(9.24, 1.68, { y: -90, e: 'snap' }),
  M(9.46, 1.3, { y: -120, e: 'out' }),
  M(9.7, 1.4, { y: -50 }),
  M(9.84, 1.5, { y: -55, e: 'snap' }),
  M(10.0, 1.4, { y: -50 }),
  M(10.34, 0.98, { y: -110, e: 'out' }),
  M(10.6, 1.05, { y: -150 }),
  M(10.84, 1.3, { y: -225 }),
  M(11.0, 1.5, { y: -228, r: -2 }),
  M(11.26, 1.62, { y: -230, r: -3, e: 'lin' }),
  M(11.3, 1.9, { y: -232, r: -5, e: 'snap' }),
  M(11.6, 1.0, { y: -130, r: 0, e: 'out' }),
  M(11.94, 1.1, { y: -70 }),
  M(12.14, 1.32, { y: -50 }),
  M(12.2, 1.5, { y: -50, e: 'snap' }),
  M(12.5, 1.2, { y: -70, e: 'out' }),
  M(12.88, 1.2, { y: -70 }),
  M(12.94, 1.3, { y: -50, r: 2, e: 'snap' }),
  M(13.3, 1.2, { y: -70, r: 1 }),
  M(13.8, 1.34, { y: -80 }),
  M(13.9, 1.6, { y: -90, e: 'snap' }),
  M(14.1, 1.4, { y: -50, e: 'out' }),
  M(14.9, 1.5, { y: -50, e: 'lin' }),
  M(14.96, 1.5, { y: -50 }),
  M(15.02, 1.85, { y: -56, r: 3, e: 'snap' }),
  M(15.5, 0.9, { y: 10, r: 0, e: 'io' }),
  M(15.9, 0.92, { y: 10 }),
  { t: 16.06, a: 0.25, b: 0.75, y: -40, z: 1.25 },
  { t: 16.12, a: 0.25, b: 0.75, y: -30, z: 1.45, e: 'snap' },
  M(16.4, 1.15, { y: -30, e: 'out' }),
  M(16.58, 1.5, { y: -34 }),
  M(16.64, 2.0, { y: -30, r: -4, e: 'snap' }),
  M(16.84, 2.2, { y: -30, r: -7, e: 'lin' }),
  M(16.94, 1.45, { y: -30, r: 0, e: 'snap' }),
  M(17.2, 0.95, { y: 20, r: -2, e: 'out' }),
  M(17.5, 1.0, { y: -60, r: -2 }),
  M(17.7, 1.25, { y: -70, r: 0 }),
  M(17.76, 1.45, { y: -70, r: 2, e: 'snap' }),
  M(18.0, 1.4, { y: -60, r: 3 }),
  M(18.7, 1.5, { y: -60, r: 3, e: 'lin' }),
  { t: 19.42, a: 0.65, b: 0.35, y: -100, z: 1.8, r: 4 },
  { t: 19.49, a: 0.65, b: 0.35, y: -100, z: 1.8, r: 4 },
  M(19.55, 1.2, { y: -20, r: 2, e: 'snap' }),
  M(20.0, 1.0, { y: 60, r: 0 }),
  M(20.4, 1.45, { y: 112, r: -3 }),
  M(20.68, 1.7, { y: 190, r: -5 }),
  M(20.74, 1.95, { y: 206, r: -6, e: 'snap' }),
  M(21.02, 1.6, { y: 296, r: -3, e: 'out' }),
  M(21.26, 1.7, { y: 392, r: 0, e: 'lin' }),
  M(21.32, 2.0, { y: 412, r: 4, e: 'snap' }),
  M(21.6, 1.6, { y: 508, r: 2, e: 'out' }),
  M(22.0, 1.5, { y: 545, r: 1, e: 'lin' }),
  M(22.2, 1.5, { y: 609, r: 1, e: 'lin' }),
]);

// ═════════════════════════════════════════════════════════════════════════════
// CONTACTS, EFFECTS, SOUND
// ═════════════════════════════════════════════════════════════════════════════
// 0:00 arrival
S.whoosh({ t: 0.1, x: 900, size: 'l', dur: 0.5 });
S.whoosh({ t: 0.3, x: 1440, size: 'l', dur: 0.55 });
S.land({ t: 0.7, x: 930, h: R(930, 0.7), weight: 0.45 });
S.land({ t: 0.92, x: 1420, h: R(1420, 0.92), weight: 1 });
S.fx({ t: 0.92, type: 'ring', x: 1420, h: R(1420, 0.92), size: 0.9 });
S.cue({ t: 0.94, type: 'clack', weight: 0.5, x: 1150 });
S.cue({ t: 1.2, type: 'clack', weight: 0.25, x: 1150 });
S.whoosh({ t: 1.38, x: 920, size: 's' });
S.whoosh({ t: 1.5, x: 920, size: 's' });
S.step({ t: 1.76, x: 950, h: H0, weight: 0.3 });
S.step({ t: 1.86, x: 1370, h: H0, weight: 0.7 });
// short swords
S.whoosh({ t: 1.92, x: 1300, size: 'm' });
S.hit({ t: 2.06, x: 1100, h: R(1100, 2.06, 221), sound: 'clang', weight: 0.7, size: 0.9 });
S.whoosh({ t: 2.16, x: 1100, size: 's' });
S.hit({ t: 2.3, x: 1170, h: R(1170, 2.3, 81), sound: 'clang', weight: 0.5, size: 0.7 });
S.whoosh({ t: 2.42, x: 1200, size: 'l', dur: 0.2 });
S.cue({ t: 2.48, type: 'slice', weight: 0.5, x: 1150 });
S.whoosh({ t: 2.6, x: 1120, size: 'm' });
S.cue({ t: 2.64, type: 'slice', weight: 0.4, x: 1150 });
S.whoosh({ t: 2.76, x: 1180, size: 'm' });
S.hit({ t: 2.82, x: 1056, h: R(1056, 2.82, 78), sound: 'hit', weight: 0.6, size: 1 });
S.cue({ t: 2.9, type: 'skid', dur: 0.14, x: 1000 });
S.whoosh({ t: 3.0, x: 1200, size: 'l', heavy: true, dur: 0.2 });
S.hit({ t: 3.12, x: 1000, h: R(1000, 3.12, 4), sound: 'slam', weight: 0.5, size: 0.9, sparks: true });
S.whoosh({ t: 3.24, x: 940, size: 'm' });
S.hit({ t: 3.36, x: 1066, h: R(1066, 3.36, 44), sound: 'clang', weight: 1, size: 1.5, shock: true });
S.whoosh({ t: 3.4, x: 1300, size: 'l', dur: 0.44 });
S.hit({ t: T_STICK, x: C1.x + 4, h: -C1.y + 60, sound: 'clack', weight: 0.6, size: 0.8, sparks: true });
S.cue({ t: T_STICK, type: 'slice', weight: 0.6, x: C1.x });
S.whoosh({ t: 3.52, x: 1000, size: 'm' });
S.cue({ t: 3.59, type: 'slice', weight: 0.4, x: 1150 });
S.whoosh({ t: 3.74, x: 1130, size: 'm' });
S.cue({ t: 3.79, type: 'slice', weight: 0.4, x: 1240 });
S.whoosh({ t: 3.94, x: 1280, size: 'm' });
S.hit({ t: 4.0, x: 1128, h: R(1128, 4.0, 112), sound: 'hit', weight: 0.7, size: 1.1 });
S.cue({ t: 4.06, type: 'skid', dur: 0.16, x: 1120 });
S.step({ t: 4.2, x: 1400, h: H0, weight: 0.6 });
S.step({ t: 4.28, x: 1520, h: H0, weight: 0.7 });
// the spear
S.cue({ t: 4.36, type: 'block', weight: 0.4, x: 1650 });
S.cue({ t: T_ARM, type: 'snap', x: 1700 });
S.fx({ t: T_ARM, type: 'sparks', x: HINGE[0], h: HINGE[1], size: 0.9, n: 10 });
S.fx({ t: T_ARM, type: 'burst', x: HINGE[0], h: HINGE[1], size: 0.7 });
S.shake(T_ARM, 6, 0.15);
S.whoosh({ t: 4.54, x: 1600, size: 'l', heavy: true, dur: 0.26 });
S.land({ t: 4.8, x: 1560, h: R(1560, 4.8), weight: 0.9 });
S.cue({ t: 4.8, type: 'shing', dur: 0.5, x: 1500 });
S.step({ t: 4.62, x: 1110, h: H0, weight: 0.3 });
S.step({ t: 4.7, x: 1170, h: H0, weight: 0.3 });
S.cue({ t: 4.76, type: 'skid', dur: 0.12, x: 1200 });
S.whoosh({ t: 5.0, x: 1400, size: 'm' });
S.hit({ t: 5.07, x: 1241, h: R(1241, 5.07, 120), sound: 'clang', weight: 0.6, size: 0.8 });
S.whoosh({ t: 5.24, x: 1350, size: 'm' });
S.cue({ t: 5.29, type: 'slice', weight: 0.35, x: 1200 });
S.whoosh({ t: 5.42, x: 1300, size: 'l', dur: 0.16 });
S.land({ t: 5.58, x: 1140, h: H0, weight: 0.25 });
S.whoosh({ t: 5.62, x: 1250, size: 's' });
S.whoosh({ t: 5.68, x: 1400, size: 'l', heavy: true, dur: 0.16 });
S.hit({ t: T_SNAP, x: 1341, h: R(1341, T_SNAP, 165), sound: 'clang', weight: 1, size: 1.6, impact: true });
S.cue({ t: T_SNAP, type: 'shatter', x: 1322 });
S.whoosh({ t: 5.84, x: 1100, size: 'l', dur: 0.26 });
S.land({ t: 6.1, x: 880, h: R(880, 6.1), weight: 0.5, dir: -1 });
S.cue({ t: 6.1, type: 'skid', dur: 0.16, x: 860 });
// the see-saw
S.whoosh({ t: 6.08, x: 1500, size: 'l', dur: 0.28 });
S.land({ t: 6.36, x: 1600, h: R(1600, 6.36), weight: 1 });
S.fx({ t: 6.36, type: 'ring', x: 1600, h: R(1600, 6.36), size: 1.2 });
S.cue({ t: 6.36, type: 'boom', gain: 0.7, x: 1600 });
S.cue({ t: 6.38, type: 'crack', dur: 0.3, gain: 0.6, x: 1150 });
S.shake(6.36, 22, 0.4);
S.whoosh({ t: 6.44, x: 790, size: 'm', dur: 0.2 });
S.land({ t: 6.66, x: 830, h: R(830, 6.66), weight: 0.4 });
S.cue({ t: 6.68, type: 'skid', dur: 0.5, x: 900 });
S.cue({ t: T_LINE, type: 'draw', dur: 0.2, x: 950 });
S.cue({ t: T_GRAB, type: 'shing', dur: 0.5, x: 1040 });
S.whoosh({ t: 7.04, x: 1150, size: 'l', dur: 0.16 });
S.whoosh({ t: 7.1, x: 1450, size: 'm' });
S.hit({ t: 7.2, x: 1354, h: R(1354, 7.2, 82), sound: 'clang', weight: 1, size: 1.7, impact: true, shock: true });

// 0:07 longsword vs spear — phrase 1
S.whoosh({ t: 7.32, x: 1280, size: 'm' });
S.hit({ t: 7.44, x: 1512, h: R(1512, 7.44, 228), sound: 'clang', weight: 0.8, size: 1 });
S.whoosh({ t: 7.54, x: 1420, size: 'm' });
S.whoosh({ t: 7.7, x: 1400, size: 'l', dur: 0.16 });
S.land({ t: 7.94, x: 1236, h: R(1236, 7.94), weight: 0.25 });
S.whoosh({ t: 8.02, x: 1380, size: 'm' });
S.hit({ t: 8.1, x: 1250, h: R(1250, 8.1, 112), sound: 'clang', weight: 0.7, size: 0.9 });
S.whoosh({ t: 8.18, x: 1340, size: 'm' });
S.hit({ t: 8.24, x: 1482, h: R(1482, 8.24, 190), sound: 'clang', weight: 0.8, size: 1 });
S.cue({ t: 8.28, type: 'skid', dur: 0.12, x: 1450, gain: 0.6 });
S.whoosh({ t: 8.42, x: 1400, size: 's' });
S.hit({ t: 8.48, x: 1298, h: R(1298, 8.48, 100), sound: 'hit', weight: 0.85, size: 1.3 });
S.cue({ t: 8.54, type: 'skid', dur: 0.2, x: 1240 });
S.whoosh({ t: 8.62, x: 1500, size: 'l', heavy: true, dur: 0.2 });
S.whoosh({ t: 8.84, x: 1350, size: 'l', dur: 0.12 });
S.hit({ t: 8.92, x: 1241, h: R(1241, 8.92, 47), sound: 'clang', weight: 0.9, size: 1.2 });
S.cue({ t: 8.93, type: 'slam', weight: 0.5, x: 1140 });
S.fx({ t: 8.93, type: 'dust', x: 1140, h: R(1140, 8.93), n: 4, size: 0.7 });
S.cue({ t: 9.05, type: 'clack', weight: 0.35, x: 1200 });
S.cue({ t: 9.13, type: 'clack', weight: 0.4, x: 1268 });
S.whoosh({ t: 9.15, x: 1300, size: 'm' });
S.hit({ t: 9.21, x: 1340, h: R(1340, 9.21, 116), sound: 'hit', weight: 0.95, size: 1.5, shock: true });
S.whoosh({ t: 9.3, x: 1450, size: 'l', dur: 0.28 });
S.land({ t: 9.6, x: 1570, h: R(1570, 9.6), weight: 0.4 });
// phrase 2 — up onto the floating shapes
S.whoosh({ t: 9.7, x: 1400, size: 'l', heavy: true, dur: 0.14 });
S.hit({ t: 9.8, x: 1500, h: R(1500, 9.8, 200), sound: 'clang', weight: 0.85, size: 1.1 });
S.whoosh({ t: 9.96, x: 1450, size: 'm' });
S.cue({ t: 10.02, type: 'slice', weight: 0.5, x: 1350 });
S.whoosh({ t: 10.0, x: 1300, size: 'l', dur: 0.46 });
S.step({ t: 10.18, x: 1420, h: H0, weight: 0.3 });
S.step({ t: 10.26, x: 1310, h: H0, weight: 0.3 });
S.step({ t: 10.34, x: 1200, h: H0, weight: 0.3 });
S.whoosh({ t: 10.42, x: 1100, size: 'm' });
S.land({ t: 10.48, x: 700, h: T1TOP, weight: 0.9 });
S.cue({ t: 10.58, type: 'clack', weight: 0.4, x: 1000 });
S.whoosh({ t: 10.64, x: 900, size: 'm', dur: 0.2 });
S.hit({ t: 10.82, x: 640, h: T1TOP + 184, sound: 'clang', weight: 0.9, size: 1.2 });
S.land({ t: 10.83, x: 832, h: T1TOP, weight: 0.35 });
S.whoosh({ t: 10.94, x: 700, size: 'm' });
S.whoosh({ t: 11.04, x: 760, size: 'm' });
S.land({ t: 11.18, x: 850, h: T1TOP, weight: 0.2 });
S.whoosh({ t: 11.22, x: 780, size: 'm' });
S.hit({ t: 11.28, x: 896, h: T1TOP + 122, sound: 'hit', weight: 0.85, size: 1.2 });
S.whoosh({ t: 11.36, x: 1000, size: 'l', dur: 0.3 });
S.whoosh({ t: 11.52, x: 850, size: 'l', heavy: true, dur: 0.36 });
S.land({ t: 11.7, x: 1170, h: R(1170, 11.7), weight: 0.5 });
S.cue({ t: 11.72, type: 'skid', dur: 0.16, x: 1220 });
S.land({ t: 11.92, x: 1010, h: R(1010, 11.92), weight: 1 });
S.hit({ t: 11.92, x: 1286, h: R(1286, 11.92, 4), sound: 'slam', weight: 0.6, size: 0.9, sparks: true });
S.whoosh({ t: 12.1, x: 1200, size: 'l', dur: 0.12 });
S.hit({ t: T_IMP, x: 1420, h: R(1420, T_IMP, 126), sound: 'clack', weight: 0.8, size: 1.1 });
S.cue({ t: T_IMP, type: 'slice', weight: 0.7, x: 1420 });
// phrase 3 — the cube-mace
S.whoosh({ t: 12.34, x: 1330, size: 'm' });
S.cue({ t: 12.3, type: 'pop', x: 1400 });
S.whoosh({ t: 12.44, x: 1100, size: 'l', heavy: true, dur: 0.3 });
S.whoosh({ t: 12.8, x: 1200, size: 'l', heavy: true, dur: 0.14 });
S.whoosh({ t: 12.8, x: 1450, size: 'm', dur: 0.26 });
S.hit({ t: T_SLAM, x: 1340, h: R(1340, T_SLAM, 30), sound: 'slam', weight: 1, size: 2, ring: true, ringH: R(1340, T_SLAM) });
S.fx({ t: T_SLAM, type: 'dust', x: 1340, h: R(1340, T_SLAM), n: 9, size: 1.2 });
S.cue({ t: T_SLAM + 0.02, type: 'crack', dur: 0.3, x: 1340 });
S.land({ t: 13.08, x: 1580, h: R(1580, 13.08), weight: 0.35 });
S.cue({ t: 13.1, type: 'skid', dur: 0.14, x: 1250, gain: 0.6 });
S.whoosh({ t: 13.24, x: 1300, size: 'l', heavy: true, dur: 0.2 });
S.whoosh({ t: 13.66, x: 1350, size: 'l', heavy: true, dur: 0.2 });
S.whoosh({ t: 13.78, x: 1560, size: 'm' });
S.hit({ t: T_SLICE, x: 1520, h: R(1520, T_SLICE, 228), sound: 'clang', weight: 1, size: 1.7, impact: true });
S.cue({ t: T_SLICE, type: 'slice', weight: 1, x: 1500 });
S.cue({ t: 14.02, type: 'clack', weight: 0.5, x: 1380 });
// phrase 4 — A presses
S.whoosh({ t: 14.06, x: 1450, size: 'm' });
S.hit({ t: 14.14, x: 1232, h: R(1232, 14.14, 84), sound: 'clang', weight: 0.7, size: 0.9 });
S.whoosh({ t: 14.26, x: 1380, size: 'm' });
S.hit({ t: 14.34, x: 1131, h: R(1131, 14.34, 173), sound: 'clang', weight: 0.7, size: 0.9 });
S.whoosh({ t: 14.44, x: 1320, size: 'l', dur: 0.14 });
S.hit({ t: 14.54, x: 1130, h: R(1130, 14.54, 190), sound: 'clang', weight: 0.95, size: 1.4, shock: true });
S.whoosh({ t: 14.74, x: 1250, size: 'm' });
S.hit({ t: 14.82, x: 1059, h: R(1059, 14.82, 115), sound: 'clack', weight: 0.5, size: 0.7 });
S.step({ t: 14.94, x: 1220, h: H0, weight: 0.8 });
S.whoosh({ t: 14.88, x: 1150, size: 'l', heavy: true, dur: 0.12 });
S.hit({ t: 14.98, x: 1408, h: R(1408, 14.98, 106), sound: 'hit', weight: 0.95, size: 1.5 });
S.cue({ t: 14.98, type: 'clack', weight: 0.8, x: 1408 });
S.whoosh({ t: 15.06, x: 1400, size: 'm', dur: 0.24 });
S.land({ t: 15.3, x: 1490, h: H0, weight: 0.45 });
S.cue({ t: 15.32, type: 'skid', dur: 0.16, x: 1500 });
S.step({ t: 15.36, x: 1136, h: H0, weight: 0.6 });
// 0:16 — the ruler is broken
S.whoosh({ t: 15.96, x: 1120, size: 'l', heavy: true, dur: 0.14 });
S.hit({ t: T_STAB, x: XS, h: R(XS, T_STAB, 2), sound: 'slam', weight: 1, size: 1.6, ring: true, ringH: R(XS, T_STAB), sparks: true });
S.cue({ t: T_STAB + 0.02, type: 'crack', dur: 0.3, x: XS });
S.step({ t: 16.3, x: 1440, h: H0, weight: 0.3 });
S.step({ t: 16.38, x: 1370, h: H0, weight: 0.3 });
S.step({ t: 16.46, x: 1310, h: H0, weight: 0.3 });
S.cue({ t: 16.5, type: 'crack', dur: 0.35, x: XS });
S.fx({ t: 16.5, type: 'sparks', x: XS, h: R(XS, 16.5), size: 0.9, n: 10 });
S.shake(16.5, 12, 0.2);
S.whoosh({ t: 16.55, x: 1250, size: 'l', dur: 0.1 });
S.hit({ t: 16.62, x: GRAB(16.62)[0], h: GRAB(16.62)[1], sound: 'block', weight: 0.9, size: 0.9, shake: 10 });
S.cue({ t: 16.72, type: 'skid', dur: 0.1, x: 1154, gain: 0.5 });
S.cue({ t: 16.6, type: 'riser', dur: 0.3 });
S.whoosh({ t: 16.84, x: 1200, size: 'm' });
S.hit({ t: T_SPLIT, x: XS, h: R(XS, T_SPLIT - 0.01, -20), sound: null, size: 2.6, impact: 0.09, shake: 40 });
S.cue({ t: T_SPLIT, type: 'megaimpact', x: XS });
S.cue({ t: T_SPLIT, type: 'wallbreak', size: 1, x: XS });
S.fx({ t: T_SPLIT, type: 'scraps', x: XS, h: R(XS, T_SPLIT - 0.01), n: 14 });
S.fx({ t: T_SPLIT, type: 'sparks', x: XS, h: R(XS, T_SPLIT - 0.01), size: 1.6, n: 18 });
S.cue({ t: 16.94, type: 'crumble', dur: 0.8, x: 1300 });
S.cue({ t: 17.0, type: 'rumble', dur: 1.2, x: 1500 });
S.step({ t: 17.1, x: 1040, h: H0, weight: 0.6 });
S.step({ t: 17.2, x: 1240, h: H0 - 20, weight: 0.3 });
S.whoosh({ t: 17.28, x: 1200, size: 'l', dur: 0.4 });
S.hit({ t: 17.72, x: 965, h: R(965, 17.72, 186), sound: 'clang', weight: 1, size: 1.4, shock: true });
S.land({ t: 17.73, x: 1150, h: R(1150, 17.73), weight: 0.4 });
S.whoosh({ t: 17.88, x: 950, size: 'm' });
S.whoosh({ t: 18.02, x: 1000, size: 'm' });
S.hit({ t: 18.08, x: 1050, h: R(1050, 18.08, 92), sound: 'clang', weight: 0.7, size: 0.9 });
S.whoosh({ t: 18.19, x: 1100, size: 'm' });
S.hit({ t: 18.24, x: 902, h: R(902, 18.24, 126), sound: 'clang', weight: 0.8, size: 1 });
S.whoosh({ t: 18.38, x: 1000, size: 'l', dur: 0.12 });
S.land({ t: 18.52, x: 1150, h: R(1150, 18.52), weight: 0.2 });
S.whoosh({ t: 18.57, x: 1000, size: 'm' });
S.hit({ t: 18.68, x: PIN_A[0], h: R(PIN_A[0], 18.68, 8), sound: 'clack', weight: 0.8, size: 0.9 });
S.cue({ t: 18.68, type: 'step', weight: 0.8, x: PIN_A[0] });
S.cue({ t: 18.98, type: 'skid', dur: 0.1, x: 1040, gain: 0.5 });
S.cue({ t: 19.32, type: 'skid', dur: 0.1, x: 1040, gain: 0.5 });
S.cue({ t: 18.92, type: 'riser', dur: 0.56 });
S.cue({ t: 19.1, type: 'shing', dur: 0.36, x: 1150 });
S.musicHint(18.95, 19.48, 'suspend');
S.whoosh({ t: 19.42, x: 1100, size: 'l', dur: 0.1 });
S.hit({ t: T_CUT, x: XC, h: R(XC + 4, T_CUT - 0.01, -10), sound: 'slam', weight: 1, size: 2.2, impact: 0.08, shock: true, shake: 30 });
S.cue({ t: T_CUT, type: 'slice', weight: 1, x: XC });
S.cue({ t: T_CUT + 0.03, type: 'crack', dur: 0.4, x: XC });
S.fx({ t: T_CUT, type: 'scraps', x: XC, h: R(XC + 4, T_CUT - 0.01), n: 10 });
S.cue({ t: 19.6, type: 'crumble', dur: 0.8, x: 900 });
S.cue({ t: 19.62, type: 'rumble', dur: 1.4, x: 800 });
S.cue({ t: 19.7, type: 'wind', dur: 2.3 });
S.whoosh({ t: 20.02, x: 1100, size: 'm', dur: 0.3 });
S.whoosh({ t: 20.26, x: 850, size: 'm', dur: 0.24 });
S.cue({ t: 20.16, type: 'crumble', dur: 0.5, x: 1150, gain: 0.7 });
S.whoosh({ t: 20.64, x: 850, size: 'l', dur: 0.1 });
S.hit({ t: 20.72, x: 904, h: -100, sound: 'clang', weight: 0.9, size: 1.2 });
S.whoosh({ t: 20.96, x: 1000, size: 'm', dur: 0.2 });
S.cue({ t: 20.9, type: 'tear', dur: 0.6, x: 400 });
S.whoosh({ t: 21.18, x: 1000, size: 'l', dur: 0.12 });
S.hit({ t: T_CLASH, x: 771, h: -452, sound: 'clang', weight: 1, size: 2, impact: 0.08, shock: true });
S.cue({ t: 21.16, type: 'tear', dur: 0.6, x: 1500 });
S.cue({ t: 21.44, type: 'crack', dur: 0.4, x: 1400 });
S.whoosh({ t: 21.5, x: 950, size: 'l', dur: 0.4 });
// ═════════════════════════════════════════════════════════════════════════════
// ENVIRONMENT
// ═════════════════════════════════════════════════════════════════════════════
const FONT = '"Bradley Hand", "Noteworthy", cursive';
const YT = -THICK;          // local canvas y of the surface the feet stand on
const YF = YT + 8;          // front edge of the top face
const YB = YT - 12;         // back edge of the top face
const SHEAR = 18;
const YBOT = 5;

// end profiles (rest x offsets from top to bottom of the front face)
const JAG = (() => { const r = rng(4411); return Array.from({ length: 7 }, (_, i) => (i % 2 ? 9 : -8) + (r() - 0.5) * 8); })();
function endProfile(kind, x) {
  const n = 6, out = [];
  for (let i = 0; i <= n; i++) {
    const y = lerp(YF, YBOT, i / n);
    const dx = kind === 'jag' ? JAG[i] : kind === 'cut' ? lerp(5, -7, i / n) : 0;
    out.push([x + dx, y]);
  }
  return out;
}
const dentCracks = crackSet(741, 1340, YF + 2, [{ a: 84 }, { a: 118, len: 0.8 }, { a: 48, len: 0.8 }, { a: 150, len: 0.5, w: 0.7 }, { a: 20, len: 0.5, w: 0.7 }], { len: 58, step: 9, w: 2.3, branch: 0.3 });
const NOTCH_U = 1002;      // where B's shortsword bit (rest x) — probed
const DENT_U = 1400;
const spearCracks = crackSet(733, XS, YF + 4, [{ a: 96, len: 0.5 }, { a: 62, len: 0.42 }, { a: 128, len: 0.45 }, { a: 20, len: 0.6, w: 0.7 }, { a: 164, len: 0.6, w: 0.7 }], { len: 110, step: 12, w: 2.6, branch: 0.3 });

function drawRulerPiece(ctx, p, t, px) {
  const kindL = p.id === 'R' ? 'jag' : p.id === 'stub' ? 'cut' : 'cap';
  const kindR = p.id === 'L' || p.id === 'stub' ? 'jag' : p.id === 'LL' ? 'cut' : 'cap';
  ctx.save();
  ctx.translate(p.ox, -p.oy);
  ctx.rotate(-p.a);
  ctx.translate(-PIV, 0);
  const u0 = p.u0, u1 = p.u1;
  const L = endProfile(kindL, u0), Rr = endProfile(kindR, u1);
  const front = [...L, ...Rr.slice().reverse()];
  const w = Math.max(2.6, 1.5 * px);
  // side face at a clean right end
  if (kindR === 'cap') {
    const side = [[u1, YF], [u1 + SHEAR, YB], [u1 + SHEAR, YBOT - (YF - YB)], [u1, YBOT]];
    sketchPoly(ctx, side, { w, seed: 811, fill: WHITE, over: 2 });
    hatch(ctx, side, { angle: -58, gap: 4.5, w: 1.3, seed: 812, cross: true, crossAngle: 66 });
  }
  // top face
  const top = [[L[0][0], YF], [Rr[0][0], YF], [Rr[0][0] + SHEAR, YB], [L[0][0] + SHEAR, YB]];
  sketchPoly(ctx, top, { w: w * 0.8, seed: 801 + u0, fill: WHITE, over: 2 });
  // front face
  sketchPoly(ctx, front, { w, seed: 803 + u0, fill: WHITE, rough: 0.9 });
  ctx.save();
  ctx.beginPath();
  front.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
  ctx.closePath();
  ctx.clip();
  hatch(ctx, [[u0 - 12, YBOT - 13], [u1 + 12, YBOT - 13], [u1 + 12, YBOT + 2], [u0 - 12, YBOT + 2]], { angle: 62, gap: 7, w: 1.1, seed: 805, skip: 0.1 });
  // tick marks
  ctx.beginPath();
  for (let x = Math.ceil((u0 - 8) / 10) * 10; x <= u1 + 8; x += 10) {
    const k = (x - X0) % 100 === 0 ? 20 : (x - X0) % 50 === 0 ? 14 : 8;
    ctx.moveTo(x, YF + 1);
    ctx.lineTo(x, YF + 1 + k);
  }
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = BLACK;
  ctx.stroke();
  // numbers
  ctx.fillStyle = BLACK;
  ctx.font = `25px ${FONT}`;
  for (let x = Math.ceil(u0 / 100) * 100; x <= u1 - 24; x += 100) ctx.fillText(String((x - X0) / 100), x + 5, YF + 41);
  // damage on the face
  if (t >= T_SLAM && u0 < 1340 && u1 > 1340) drawCracks(ctx, dentCracks, prog(t, T_SLAM, T_SLAM + 0.12), 1);
  if (t >= 16.05 && Math.abs(XS - (u0 + u1) / 2) < (u1 - u0) / 2 + 60) {
    drawCracks(ctx, spearCracks, 0.3 + 0.3 * prog(t, 16.05, 16.2) + 0.4 * prog(t, 16.5, 16.62), 1);
  }
  ctx.restore();
  // B's shortsword bit a notch out of the edge
  if (t >= 3.12 && NOTCH_U > u0 && NOTCH_U < u1) {
    const n = [[NOTCH_U - 9, YF - 1], [NOTCH_U + 3, YF + 15], [NOTCH_U + 10, YF - 1]];
    sketchPoly(ctx, [[NOTCH_U - 9, YF - 3], [NOTCH_U + 3, YF + 15], [NOTCH_U + 10, YF - 3]], { w: 0.1, seed: 3, fill: WHITE, rough: 0 });
    stroke(ctx, n, 2.4);
    stroke(ctx, [[NOTCH_U + 3, YF + 15], [NOTCH_U - 2, YF + 27], [NOTCH_U + 4, YF + 36]], 1.6);
  }
  ctx.restore();
}

/** world point (x, height) → rest x on the main ruler (for things drawn in the ruler's own frame) */
function toRest(p, x, h) {
  return PIV + (x - p.ox) * Math.cos(p.a) + (h - p.oy) * Math.sin(p.a);
}

function drawFulcrum(ctx, px, t) {
  const ax = PIV, ay = -HB + 7;
  const tri = [[ax, ay], [ax + 140, ay + 220], [ax - 140, ay + 220]];
  const inner = [[ax, ay + 76], [ax + 62, ay + 184], [ax - 62, ay + 184]];
  const tau = t - T_STUB - 0.1;
  if (tau > 0) {   // with nothing left to hold up, it topples away
    ctx.translate(ax + 150 * tau, ay + 130 + fallen(tau, 210, 1.5));
    ctx.rotate(0.55 * tau);
    ctx.translate(-ax, -ay - 130);
  }
  ctx.beginPath();
  tri.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
  ctx.closePath();
  ctx.fillStyle = WHITE;
  ctx.fill();
  setSquare(ctx, tri, inner, 431, Math.max(2, 1.2 * px));
}

function drawCompass(ctx, t, px) {
  const w = Math.max(2.2, 1.2 * px);
  const tau = t - T_ARM;
  // once the needle arm is gone the rest swings from the hinge and sags
  const sw = tau > 0 ? 34 * Math.exp(-1.3 * tau) * Math.sin(8 * tau) + 6 * (1 - Math.exp(-tau)) : 0;
  const hx = HINGE[0] + (tau > 0 ? 10 * (1 - Math.exp(-tau)) : 0), hy = -HINGE[1] - (tau > 0 ? 14 * Math.exp(-2 * tau) * Math.sin(10 * tau) : 0);
  ctx.save();
  ctx.translate(hx, hy);
  // pencil leg
  ctx.save();
  ctx.rotate((65 - sw) * DEG);   // canvas angle: down-right
  const leg = [[10, -7], [236, -6], [236, 6], [10, 7]];
  sketchPoly(ctx, leg, { w, seed: 520, fill: WHITE, over: 2 });
  hatch(ctx, [[10, 0], [236, 0], [236, 6], [10, 7]], { angle: 60, gap: 6, w: 1.1, seed: 521 });
  sketchPoly(ctx, [[236, -9], [262, -9], [262, 9], [236, 9]], { w, seed: 522, fill: WHITE });
  hatch(ctx, [[236, -9], [262, -9], [262, 9], [236, 9]], { angle: 90, gap: 3.6, w: 1.1, seed: 523 });
  sketchPoly(ctx, [[262, -6], [284, 0], [262, 6]], { w, seed: 524, fill: WHITE });
  ctx.fillStyle = BLACK;
  ctx.beginPath(); ctx.moveTo(275, -2.6); ctx.lineTo(286, 0); ctx.lineTo(275, 2.6); ctx.fill();
  ctx.restore();
  // stump of the needle arm
  if (tau > 0) {
    ctx.save();
    ctx.rotate((115 - sw * 0.5) * DEG);
    stroke(ctx, [[8, 0], [30, 1], [26, -4], [38, 2]], 4.6);
    ctx.restore();
  }
  // hinge knob + handle
  stroke(ctx, [[0, -14], [0, -44]], 7);
  ctx.beginPath(); ctx.arc(0, 0, 17, 0, TAU); ctx.fillStyle = WHITE; ctx.fill();
  ctx.lineWidth = w + 0.6; ctx.strokeStyle = BLACK; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fillStyle = BLACK; ctx.fill();
  ctx.restore();
}

let RT = null;   // the built scene (hooks look up solved states through it)

// splinters of ruler thrown off by the stab, the split and the cut (they just keep falling)
const splinters = (() => {
  const r = rng(9091);
  const list = [];
  const add = (t, x, y, n, sp, down) => {
    for (let i = 0; i < n; i++) {
      list.push({ t: t + r() * 0.03, x: x + (r() - 0.5) * 30, y: y + r() * 40, w: 10 + r() * 30, h: 5 + r() * 9, vx: (r() - 0.5) * 2 * sp, vy: down ? 80 + r() * 260 : -(120 + r() * 620), om: (r() - 0.5) * 22, floor: 9000, chips: 3 });
    }
  };
  add(T_STAB, XS + 14, -HB, 5, 160, true);
  add(T_SPLIT, XS, -H0, 16, 520, false);
  add(T_CUT, XC, -H0, 9, 420, false);
  return makeDebris(list, 9100);
})();

// the page starts to tear around them as they fall
const TEARS = [
  { t0: 20.9, x0: 150, x1: 610, y: 470, depth: 46, seed: 141, flaps: 5 },
  { t0: 21.14, x0: 1100, x1: 1700, y: 800, depth: 52, seed: 151, flaps: 6 },
];
const tearCracks = [
  { t0: 21.0, set: crackSet(171, 610, 472, [{ a: 8 }, { a: -24, len: 0.6 }, { a: 40, len: 0.5 }], { len: 150, step: 20, w: 2.6 }) },
  { t0: 21.24, set: crackSet(173, 1100, 802, [{ a: 186 }, { a: 150, len: 0.6 }, { a: 214, len: 0.5 }], { len: 200, step: 20, w: 2.6 }) },
];
function drawTears(ctx, t) {
  for (const c of tearCracks) if (t > c.t0) drawCracks(ctx, c.set, prog(t, c.t0, c.t0 + 0.5), 1);
  for (const T of TEARS) if (t > T.t0) drawTear(ctx, T, 0.92 * prog(t, T.t0, 22.15));
}
// thin streaks trailing a falling body
function fallStreaks(ctx, J, P, t, seed) {
  const vy = (J.hip[1] - P.hip[1]) * 60;
  if (vy > -230) return;
  const k = clamp((-vy - 230) / 300);
  const r = rng(seed + Math.floor(t * 15) * 13);
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const x = J.hip[0] + (r() - 0.5) * 220, y = -J.hip[1] - 90 - r() * 150, len = (50 + r() * 140) * k;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (r() - 0.5) * 4, y - len);
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = BLACK;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function drawT1(ctx, t, px) {
  const y = -T1Y(t);
  const tri = [[T1X0, y], [T1X1, y], [T1X0, y + 170]];
  const inner = [[T1X0 + 40, y + 24], [T1X0 + 350, y + 24], [T1X0 + 40, y + 134]];
  ctx.beginPath();
  tri.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
  ctx.closePath();
  ctx.fillStyle = WHITE;
  ctx.fill();
  setSquare(ctx, tri, inner, 461, Math.max(2.2, 1.2 * px));
}
// the stepping-stone cube drifts in before A needs it and is kicked away when he springs off it
function q1At(t) {
  if (t < 10.6) { const u = EASE.io(prog(t, 8.2, 9.9)); return [lerp(690, 964, u), lerp(-420, -Q1TOP + 80, u) + (1 - u) * Math.sin(t * 1.1) * 6 + bump(t, 10.58, -8, 10, 30), 0]; }
  const tau = t - 10.6;
  return [964 + 70 * tau, -Q1TOP + 80 + 60 * tau + 420 * tau * tau, 1.4 * tau];
}
// the cube B skewers: floats in, rides the spear, is cut in two
const C2F = [1432, -10];   // its centre when the spear finds it (canvas coords)
const spearAt = (t) => RT.state(t).weapons.find((w) => w.id === 'spear');
function c2At(t) {
  if (t < T_IMP) {
    const u = EASE.io(prog(t, 10.4, 11.9));
    return { cx: lerp(1560, C2F[0], u), cy: lerp(-470, C2F[1], u) + (1 - u) * Math.sin(t * 0.9) * 6, rot: 0 };
  }
  const imp = spearAt(T_IMP), sp = spearAt(Math.min(t, T_SLICE));
  const a0 = imp.ang * DEG, a = sp.ang * DEG;
  const dx = C2F[0] - imp.tip[0], dy = -C2F[1] - imp.tip[1];
  const lx = dx * Math.cos(a0) + dy * Math.sin(a0), ly = -dx * Math.sin(a0) + dy * Math.cos(a0);
  return { cx: sp.tip[0] + lx * Math.cos(a) - ly * Math.sin(a), cy: -(sp.tip[1] + lx * Math.sin(a) + ly * Math.cos(a)), rot: -(sp.ang - imp.ang) * DEG };
}
function drawC2(ctx, t, px) {
  const w = Math.max(2, 1.2 * px);
  if (t < T_SLICE + 0.07) {
    const c = c2At(t);
    ctx.save(); ctx.translate(c.cx, c.cy); ctx.rotate(c.rot);
    cube(ctx, -35, 35, 70, 471, w);
    ctx.restore();
    return;
  }
  const c = c2At(T_SLICE), tau = t - T_SLICE - 0.07;
  if (tau > 3) return;
  for (const h of [{ vx: -330, vy: -420, om: -7, side: -1 }, { vx: 300, vy: -560, om: 9, side: 1 }]) {
    ctx.save();
    ctx.translate(c.cx + h.vx * tau, c.cy + h.vy * tau + 0.5 * 1900 * tau * tau);
    ctx.rotate(c.rot + h.om * tau);
    ctx.save();
    ctx.beginPath();
    if (h.side < 0) { ctx.moveTo(-70, -90); ctx.lineTo(8, -90); ctx.lineTo(-8, 60); ctx.lineTo(-70, 60); }
    else { ctx.moveTo(8, -90); ctx.lineTo(90, -90); ctx.lineTo(90, 60); ctx.lineTo(-8, 60); }
    ctx.closePath();
    ctx.clip();
    cube(ctx, -35, 35, 70, 471, w);
    ctx.restore();
    stroke(ctx, [[5, -62], [-6, 36]], 2.6);
    ctx.restore();
  }
}

S.env({
  far2(ctx, t, { px }) {
    const w = Math.max(1.4, 1.1 * px);
    scribble(ctx, 'a² + b² = c²', 250, -610, 74, -0.06);
    scribble(ctx, 'y = mx + b', 1500, -640, 66, 0.04);
    scribble(ctx, '∫x² dx = x³⁄3', 1930, -330, 58, -0.03);
    scribble(ctx, 'A = ½ b h', 60, -150, 60, 0.02);
    protractor(ctx, 1010, -420, 210, w);
    cube(ctx, 2240, -560, 110, 47, w);
    cube(ctx, 610, -470, 60, 53, w);
    cube(ctx, -60, 250, 130, 59, w);
    setSquare(ctx, [[2150, 330], [2500, 330], [2500, 30]], [[2330, 280], [2450, 280], [2450, 178]], 61, w);
    scribble(ctx, 'sin²θ + cos²θ = 1', 380, 760, 60, 0.03);
    scribble(ctx, 'πr²', 1760, 560, 80, -0.08);
    scribble(ctx, 'x = (−b ± √(b²−4ac)) ⁄ 2a', 1300, 1180, 56, -0.02);
    cube(ctx, 300, 1250, 150, 67, w);
    protractor(ctx, 2000, 1050, 190, w, 37);
    setSquare(ctx, [[640, 1500], [1040, 1500], [640, 1220]], [[700, 1450], [880, 1450], [700, 1324]], 71, w);
    scribble(ctx, 'e^{iπ} + 1 = 0', 1500, 1600, 62, 0.04);
    cube(ctx, 2100, 1700, 100, 73, w);
  },
  far(ctx, t, { px }) {
    const w = Math.max(1.5, 1.1 * px);
    const bob = (i) => Math.sin(t * 0.9 + i * 1.7) * 7;
    setSquare(ctx, [[1130, -760 + bob(1)], [1430, -610 + bob(1)], [1150, -550 + bob(1)]], [[1184, -690 + bob(1)], [1334, -618 + bob(1)], [1192, -586 + bob(1)]], 81, w);
    cube(ctx, 150, -420 + bob(2), 84, 83, w);
    cube(ctx, 2300, -150 + bob(3), 70, 85, w);
    cube(ctx, 880, -640 + bob(4), 46, 87, w);
    // a small floating ruler
    ctx.save();
    ctx.translate(2060, -700 + bob(5));
    ctx.rotate(-0.22);
    sketchPoly(ctx, [[0, 0], [330, 0], [330, 34], [0, 34]], { w, seed: 89, fill: WHITE, over: 2 });
    ctx.beginPath();
    for (let x = 12; x < 326; x += 12) { ctx.moveTo(x, 0); ctx.lineTo(x, (x / 12) % 5 === 0 ? 16 : 8); }
    ctx.lineWidth = 1.2; ctx.strokeStyle = BLACK; ctx.stroke();
    ctx.restore();
    // an angle mark
    stroke(ctx, [[60, 420], [330, 420]], 2.2);
    stroke(ctx, [[60, 420], [280, 300]], 2.2);
    ctx.beginPath(); ctx.arc(60, 420, 90, -0.5, 0); ctx.lineWidth = 2; ctx.strokeStyle = BLACK; ctx.stroke();
    scribble(ctx, 'θ', 168, 404, 44, 0);
    cube(ctx, 1900, 620 + bob(6), 120, 91, w);
    setSquare(ctx, [[300, 900 + bob(7)], [560, 1010 + bob(7)], [270, 1100 + bob(7)]], [[340, 960 + bob(7)], [470, 1012 + bob(7)], [330, 1050 + bob(7)]], 93, w);
    cube(ctx, 1500, 1300 + bob(8), 90, 95, w);
  },
  stage(ctx, t, { px }) {
    drawTears(ctx, t);
    ctx.save();
    drawFulcrum(ctx, px, t);
    ctx.restore();
    // the cube that catches B's sword (it jolts when the sword sticks)
    const j = t >= T_STICK ? 10 * Math.exp(-6 * (t - T_STICK)) * Math.sin(30 * (t - T_STICK)) : 0;
    cube(ctx, C1.x + j, C1.y, C1.s, 451, Math.max(2, 1.2 * px));
    drawCompass(ctx, t, px);
    drawT1(ctx, t, px);
    {
      const [qx, qy, qr] = q1At(t);
      if (qy < 2600) {
        ctx.save(); ctx.translate(qx + 40, qy - 40); ctx.rotate(qr);
        cube(ctx, -40, 40, 80, 465, Math.max(2, 1.2 * px));
        ctx.restore();
      }
    }
    if (t < T_IMP && RT) drawC2(ctx, t, px);
    for (const p of pieces(t)) {
      if (-p.oy > 2400) continue;
      drawRulerPiece(ctx, p, t, px);
    }
    // the line A's finger draws along the edge — it becomes the longsword
    if (t >= T_LINE - 0.02 && t < T_GRAB && RT) {
      const p = pieces(t)[0];
      const hg = RT.state(T_GRAB).A.hF, pg = pieces(T_GRAB)[0];
      const uTip = toRest(pg, hg[0], hg[1]) - 160;
      const hn = RT.state(t).A.hF;
      const uNow = toRest(p, hn[0], hn[1]);
      if (uNow > uTip) {
        ctx.save();
        ctx.translate(p.ox, -p.oy); ctx.rotate(-p.a); ctx.translate(-PIV, 0);
        stroke(ctx, [[uTip, YT + 1], [uNow, YT + 1]], 5);
        ctx.restore();
      }
    }
  },
  over(ctx, t, { px, st }) {
    splinters.draw(ctx, t, true);
    if (t > 19.6 && RT) {
      const pv = RT.state(t - 1 / 60);
      fallStreaks(ctx, st.A, pv.A, t, 31);
      fallStreaks(ctx, st.B, pv.B, t, 37);
    }
    if (t >= T_IMP && RT) drawC2(ctx, t, px);
    // the broken half of A's shortsword
    const tau = t - T_SNAP;
    if (tau >= 0 && tau < 2) {
      const x = 1340 + 150 * tau, y = -R(1340, T_SNAP, 175) - 620 * tau + 0.5 * 1700 * tau * tau;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.3 + 13 * tau);
      ctx.scale(1.7, 1.7);
      const sh = [[-30, -5], [-22, 1], [-28, 6], [16, 6], [32, 0], [16, -6]];
      sketchPoly(ctx, sh, { w: 1.6, seed: 77, fill: WHITE, rough: 0.4 });
      stroke(ctx, [[-20, 0.5], [14, 0.5]], 0.8);
      ctx.restore();
    }
  },
  surface: (x, t, J) => {
    const low = Math.min(J.fF[1], J.fB[1]);
    if (x > T1X0 && x < T1X1 && low > T1Y(t) - 30) return T1Y(t);
    if (Math.abs(x - 1004) < 44 && t > 10.5 && t < 10.64) return Q1TOP;
    const h = ph(x, t);
    if (h == null) return null;
    return low - h > 420 ? null : h;
  },
});

// ── slow-motion close-up ──
S.bulletTime({ at: 9.24, span: 0.24, hold: 2.0, on: 'A', z: 2.8 });    // A frozen flipping over B off the spear
RT = S.build();
export default RT;
