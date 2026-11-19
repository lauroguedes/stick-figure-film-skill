// SCENE 3b — "Ink Shots" (20 s). A firearm: the shortcut that fails.
//
// Stage: a sheet of GRAPH PAPER (40-unit grid) with a doodled shooting gallery. Left to right:
//   x 524   the margin (double line). The doodled REVOLVER sits in it at [457, 170], pointing left.
//   x 640   where B fires round one from (he strides to 800 for the rest).
//   x 1040  where B's spear sticks upright in the page (3.5 → 11.8).
//   x 1300  a paperclip lying on the floor (blown away by round nine).
//   x 1300…1800, height 250   the shelf: bottle · can · bottle · can · bottle · jar.
//   x 1540  the big ink bottle on the floor.   x 1670…1950  the stapler (cover).
//   [1960, 332]  the target.
// Nine rounds:  B: 1 page (A's head was there) · 2 the bottle at A's heels · 3 the target bullseye, under A's leap · 4 stapler →
// ricochet into the ink bottle · 5 bullet time, off the flat of the longsword → snaps the shelf ·
// 6 cut in half.   A: 7, 8 off B's spinning spear (fragments stitch the floor) · 9 the floor at B's feet.
// The floor holes run in a line (PERF); at 17.1 cracks join them, at 18.4 B's blow lands on the line
// and the sheet tears from hole to hole (and on to the margin and the ink), sags, rips loose at the ink
// end and peels down, hinged on the margin, its top edge curling over — both fighters dropping with it.
//
// Opening: both fall in (A longsword, B spear). Closing: both dropping, A (left) longsword, B (right) spear.

import { createScene } from '../engine/scene.js';
import { flight } from '../engine/moves.js';
import { DEG, TAU, rng, clamp, prog, EASE, lerp, hash } from '../engine/util.js';
import { sketchPoly, hatch, stroke, line, blob, trim, BLACK, WHITE } from '../engine/ink.js';
import { drawPage, drawGround, crackSet, drawCracks, DEFAULT_PAGE } from '../engine/kit.js';

const S = createScene({ id: 's3b', title: 'Ink Shots', duration: 20 });

const F = (n) => n / 30;            // frame → seconds (the film runs at 30 fps; shots sit on frames)
const T_DISARM = 2.72;              // A beats the spear out of B's hands
const T_STICK = 3.5;                // …it sticks upright in the page
const T_BUMP = 3.95;                // B backs into the margin
const T_GRAB = 4.2, T_PEEL = 4.3;   // fingers on the doodle / it comes off the page
const T_LEVEL = 4.95;
const SH1 = F(159);                 // 5.30  A's head was there
const SH2 = F(182);                 // 6.07  first bottle
const SH3 = F(194);                 // 6.47  under A's leap, into the target
const SH4 = F(212);                 // 7.07  sparks off the stapler…
const T_INK = F(214);               // 7.13  …into the ink bottle
const SH5 = F(237);                 // 7.90  bullet time
const T_DEFLECT = F(270);           // 9.00  flat of the longsword
const T_SHELF = F(271);             // 9.03  the ricochet snaps the shelf
const SH6 = F(285);                 // 9.50  cut in half
const T_CUT = SH6 + 0.04;
const T_CLICK = F(297);             // 9.90  empty
const T_THROW = F(330);             // 11.00
const T_CATCH = F(335);             // 11.17
const T_YANK = 11.68;               // B rips the spear out of the page
const T_RELOAD = F(356);            // 11.87 muzzle in the ink…
const T_INKED = 12.2;               // …and the ink has run up the barrel
const SH7 = F(377);                 // 12.57
const SH8 = F(389);                 // 12.97
const SH9 = F(400);                 // 13.33 the floor at B's feet
const T_SWAT = F(417);              // 13.90
const T_STOMP = F(435);             // 14.50
const T_LIFT = 14.8;                // the foot comes off what is left
const T_SLAM1 = 15.38;
const T_CRACK = 17.1;               // the holes start to join up
const T_BLOW = F(552);              // 18.40 B's overhead lands on the line
const T_GIVE = 18.9;                // the sheet lets go

// ── set geometry (canvas coordinates: y down, floor = 0) ─────────────────────
const PAGE = { ...DEFAULT_PAGE };
const GRID = 40;
const MARGIN = 524;
const GUN0 = [457, 170];                     // doodle centre [x, height], pointing left
const GRIP0 = [487, 170];                    // its grip
const SPEAR_X = 1040;
const SPEAR_GRIP = [1036, 154];
const SHELF = { x0: 1300, x1: 1800, y: -250, xb: 1610, px: 1760 };
const ITEMS = [
  { id: 'b1', kind: 'bottle', x: 1370 }, { id: 'c1', kind: 'can', x: 1445 }, { id: 'b2', kind: 'bottle', x: 1520 },
  { id: 'c2', kind: 'can', x: 1590 }, { id: 'b3', kind: 'bottle', x: 1670 }, { id: 'jar', kind: 'jar', x: 1742 },
];
const TARGET = [1960, 332], TARGET_R = 96;
const INK_X = 1540;
const ST = { hx: 1925, hy: -34, k: 1.3 };    // stapler hinge, scale
const ST_NOSE = [1690, 96];
const CLIP_X = 1300;
const PERF = [1070, 1130, 1190, 1262, 1330, 1396];   // floor holes, left → right (1250 = round nine, big)
const FLOOR_H = -4;
const XL = MARGIN + 8, XR = 1664, X_BLOW = 1120;
const GUN_REST = [1445, 6];
// the tear front runs from hole to hole: [seconds after the blow, x]
const TEAR_R = [[0, X_BLOW + 16], [0.04, PERF[1]], [0.1, PERF[2]], [0.16, PERF[3]], [0.22, PERF[4]], [0.28, PERF[5]], [0.47, XR]];
const TEAR_L = [[0, X_BLOW - 16], [0.06, PERF[0]], [0.44, XL]];
const DUNK = [1540, 62];                     // A's gun hand while the muzzle sits in the ink

// ── helpers ──────────────────────────────────────────────────────────────────
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
/** B's gun arm (he faces right): hand offset from the shoulder for a barrel angle `a`. */
const arm = (a, r = 76, dy = 4) => [Math.round(r * Math.cos(a * DEG)), Math.round(r * Math.sin(a * DEG) + dy)];
/** A's gun arm (back hand, he faces left): world barrel angle `a` (180 = level). */
const armL = (a, r = 70, dy = 2) => [Math.round(-r * Math.cos(a * DEG)), Math.round(r * Math.sin(a * DEG) + dy)];

// barrel angles (probed so each `to` lies on the line of fire)
const A1 = 0, A2 = 12, A3 = 8, A4 = -5, A5 = 0, A6 = -1;
const A7 = 183, A8 = 195, A9 = 210;
// where each round ends up
const P1 = [946, 169], P4 = ST_NOSE, P5 = [1574, 172], P6 = [1110, 165], P7 = [1150, 128], P8 = [1284, 88], P9 = [PERF[3], -2];

/** B fires: aim exactly at t, kick two frames later, settle. */
const bShot = (t, a, base, slow = 1) => [
  { t, ...base, hF: arm(a), e: 'out' },
  { t: t + 0.05 * slow, ...base, hip: [base.hip[0] - 7, base.hip[1] + 1], lean: base.lean - 9, tilt: -8, hF: arm(a + 24, 58, 10), e: slow > 1 ? 'out' : 'snap' },
  { t: t + 0.24 * slow, ...base, hF: arm(a + 3, 72), e: slow > 1 ? 'io' : 'io' },
];
const gShot = (t, a, slow = 1, dir = 1) => [
  { t, by: 'B', ang: a },
  { t: t + 0.05 * slow, by: 'B', ang: a + 27 * dir, e: slow > 1 ? 'out' : 'snap' },
  { t: t + 0.24 * slow, by: 'B', ang: a + 3 * dir },
];
const AS = { hip: [-6, 88], lean: -4, hF: [-22, -36], fF: [30, 0], fB: [-30, 0] };
const aShot = (t, a, x) => [
  { t, x, ...AS, hB: armL(a), e: 'out' },
  { t: t + 0.05, x: x + 6, ...AS, hip: [-12, 89], lean: -14, tilt: -8, hB: armL(a - 22, 54, 8), e: 'snap' },
  { t: t + 0.22, x: x + 8, ...AS, hB: armL(a - 2, 66) },
];

// ── FIGHTER A — The Technician ───────────────────────────────────────────────
const SLIDE = { hip: [-10, 32], lean: 72, tilt: -40, hF: [52, 4], hB: [-34, -6], fF: [64, 0], fB: [-36, 0], kB: -1 };
const A_KEYS = [
  // 0–1.5: drops out of scene 3, lands light, guard
  { t: 0, x: 1240, y: 760, face: -1, hip: [0, 84], lean: 14, hF: [0, 66], hB: [-20, 56], fF: [16, 4], fB: [-40, 34] },
  ...flight(0, 0.62, [1240, 760], [1196, 0], 2400, [
    [0.34, { hip: [0, 82], lean: 20, hF: [20, 50], hB: [-20, 44], fF: [20, 6], fB: [-24, 22] }],
  ], { hip: [4, 46], lean: 40, bend: 10, hF: [30, -40], hB: [10, -50], fF: [34, 0], fB: [-30, 0] }),
  { t: 0.76, x: 1204, hip: [0, 52], lean: 32, bend: 8, hF: [32, -34], hB: [12, -46], fF: [34, 0], fB: [-30, 0], slide: true, e: 'out' },
  { t: 0.98, x: 1206, p: 'guard2', hip: [-4, 82] },
  { t: 1.22, p: 'guard2', hip: [-6, 90], lean: 4 },
  { t: 1.44, p: 'guard2', hip: [-4, 86] },
  // 1.5–2.8: parry the thrust, riposte, hop the low stab, smash the spear down, beat it out of his hands
  { t: 1.52, p: 'guard2', hip: [-8, 90], lean: 0, hF: [38, 0], hB: [16, -18] },
  { t: 1.6, x: 1210, hip: [-10, 88], lean: -6, hF: [34, 22], hB: [14, 0], fF: [30, 0], fB: [-32, 0], e: 'snap' },
  { t: 1.68, same: true },
  { t: 1.78, x: 1196, hip: [-8, 94], lean: -10, hF: [-4, 70], hB: [-18, 60], fF: [28, 0], fB: [-30, 0] },
  { t: 1.9, x: 1130, hip: [10, 76], lean: 26, hF: [52, 30], hB: [36, 20], fF: [46, 0], fB: [-42, 0], e: 'snap' },
  { t: 1.97, same: true },
  { t: 2.08, x: 1136, hip: [0, 62], lean: 20, hF: [30, -10], hB: [8, -26], fF: [30, 0], fB: [-28, 0] },
  { t: 2.14, hip: [0, 90], lean: 6, hF: [24, 30], hB: [4, 20], fF: [24, 0], fB: [-24, 0], e: 'in' },
  ...flight(2.14, 2.46, [1136, 0], [1160, 0], 4400, [
    [2.3, { hip: [0, 78], lean: 4, hF: [-4, 66], hB: [-18, 56], fF: [26, 34], fB: [-18, 40] }],
  ], { hip: [8, 58], lean: 34, bend: 8, hF: [44, -22], hB: [28, -28], fF: [44, 0], fB: [-44, 0], e: 'in' }),
  { t: 2.52, same: true },
  { t: 2.6, hip: [6, 54], lean: 32, hF: [26, -44], hB: [10, -46], fF: [40, 0], fB: [-38, 0] },
  { t: T_DISARM, hip: [10, 88], lean: 6, hF: [50, 50], hB: [36, 40], fF: [40, 0], fB: [-36, 0], e: 'snap' },
  { t: 2.8, same: true },
  // 2.8–4.3: walks B back at sword-point
  { t: 2.96, x: 1110, p: 'guard2', hip: [-4, 88] },
  { t: 3.15, x: 1010, hip: [4, 86], lean: 12, hF: [58, 2], hB: [42, -8], fF: [36, 0], fB: [-34, 0] },
  { t: 3.35, x: 930, hip: [2, 88], lean: 10, hF: [60, 4], hB: [44, -6], fF: [-30, 0], fB: [34, 0] },
  { t: 3.55, x: 900, hip: [4, 86], lean: 12, hF: [60, 2], hB: [44, -8], fF: [36, 0], fB: [-34, 0] },
  { t: 3.8, x: 892, hip: [6, 86], lean: 12, hF: [60, 4], hB: [44, -6], fF: [38, 0], fB: [-34, 0] },
  { t: 4.1, x: 890, hip: [6, 84], lean: 14, hF: [62, 6], hB: [46, -4], fF: [38, 0], fB: [-34, 0] },
  { t: 4.3, x: 890, hip: [6, 86], lean: 12, tilt: -10, hF: [60, 6], hB: [44, -4], fF: [38, 0], fB: [-34, 0] },
  // 4.3–5.3: a gun. Freezes, gives ground
  { t: 4.52, x: 894, hip: [-8, 96], lean: -6, tilt: -6, hF: [50, 8], hB: [34, -2], fF: [34, 0], fB: [-30, 0], e: 'snap' },
  { t: 4.7, x: 908, hip: [-10, 92], lean: -8, hF: [40, 10], hB: [26, 0], fF: [32, 0], fB: [-30, 0] },
  { t: T_LEVEL, x: 920, hip: [-8, 90], lean: -6, hF: [36, 12], hB: [20, 2], fF: [32, 0], fB: [-30, 0] },
  { t: 5.12, x: 924, hip: [-8, 92], lean: -6, hF: [36, 14], hB: [20, 4], fF: [30, 0], fB: [-30, 0] },
  { t: 5.22, hip: [-8, 90], lean: -10, hF: [36, 14], hB: [20, 4], fF: [30, 0], fB: [-30, 0] },
  // round one: bends out from under it
  { t: SH1, x: 928, hip: [6, 68], lean: -62, tilt: -14, hF: [14, -34], hB: [-34, -6], fF: [30, 0], fB: [-26, 0], e: 'snap' },
  { t: 5.4, hip: [8, 66], lean: -64, tilt: -14, hF: [12, -36], hB: [-36, -8], fF: [30, 0], fB: [-26, 0] },
  // …and runs for the shelf
  { t: 5.46, x: 950, face: 1, hip: [8, 70], lean: 30, hF: [30, -20], hB: [-30, -20], fF: [30, 0], fB: [-40, 0] },
  { t: 5.53, x: 1040, p: 'run1', e: 'lin' },
  { t: 5.6, x: 1110, p: 'run2', e: 'lin' },
  { t: 5.66, x: 1180, p: 'run1', e: 'lin' },
  { t: 5.72, x: 1235, hip: [6, 74], lean: 20, hF: [30, 30], hB: [-20, 20], fF: [20, 0], fB: [-40, 10], e: 'in' },
  ...flight(5.72, 5.92, [1235, 0], [1340, 250], 6000, [
    [5.82, { p: 'airUp', lean: 14, hF: [30, 30] }],
  ], { p: 'run1', hip: [0, 74], lean: 34 }),
  { t: 5.99, x: 1402, y: 250, p: 'run2', e: 'lin' },
  { t: SH2, x: 1466, y: 250, p: 'run1', e: 'lin' },
  // round two bursts the bottle at his heels: ducks his head and keeps running
  { t: SH2 + 0.06, x: 1512, y: 250, hip: [0, 72], lean: 46, bend: 10, tilt: 24, hF: [30, -10], hB: [-14, 34], fF: [-52, 22], fB: [44, 0], e: 'lin' },
  { t: 6.2, x: 1578, y: 250, p: 'run1', lean: 36, e: 'lin' },
  { t: 6.26, x: 1640, y: 250, p: 'run2', e: 'lin' },
  { t: 6.31, x: 1700, y: 250, hip: [6, 58], lean: 34, hF: [-20, -30], hB: [-34, -20], fF: [28, 0], fB: [-30, 0], e: 'lin' },   // gathers at the end of the plank
  { t: 6.34, x: 1740, y: 250, hip: [8, 86], lean: 20, hF: [30, 50], hB: [16, 56], fF: [8, 0], fB: [-40, 12], e: 'in' },
  // leaps off the end — round three passes under his feet and drills the target — and flips down across it
  ...flight(6.34, 6.86, [1740, 250], [2000, 0], 7000, [
    [6.44, { hip: [0, 80], lean: 24, hF: [36, 44], hB: [24, 52], fF: [-10, 10], fB: [-40, 20], spin: 40 }],
    [6.55, { p: 'aTuck', spin: 150 }],
    [6.66, { p: 'aTuck', spin: 250 }],
    [6.77, { hip: [0, 76], lean: 20, hF: [30, 20], hB: [-20, 24], fF: [20, 6], fB: [-10, 14], spin: 330 }],
  ], { hip: [0, 46], lean: 34, bend: 10, hF: [22, -50], hB: [-12, -56], fF: [30, 0], fB: [-30, 0], spin: 360 }),
  { t: 6.98, x: 1996, face: -1, hip: [0, 44], lean: 30, tilt: -10, hF: [26, -40], hB: [-10, -46], fF: [34, 0], fB: [-34, 0] },
  { t: SH4, same: true },
  { t: SH4 + 0.05, hip: [-6, 42], lean: 46, tilt: 24, hF: [20, -34], hB: [10, -40], fF: [34, 0], fB: [-34, 0], kB: -1, e: 'snap' },
  { t: 7.26, hip: [0, 54], lean: 18, tilt: -24, hF: [26, -36], hB: [-6, -44], fF: [34, 0], fB: [-34, 0] },
  // comes out into the open, in the spilled ink
  { t: 7.36, x: 1950, p: 'run1', e: 'lin' },
  { t: 7.46, x: 1850, p: 'run2', e: 'lin' },
  { t: 7.56, x: 1740, p: 'run1', e: 'lin' },
  { t: 7.66, x: 1640, p: 'run2', e: 'lin' },
  { t: 7.76, x: 1596, p: 'guard2', hip: [-6, 84], lean: 4, slide: true, e: 'out' },
  { t: 7.86, p: 'guard2', hip: [-6, 88], lean: 0 },
  // round five, bullet time: the flat of the blade goes up into its path
  { t: SH5, p: 'guard2', hip: [-6, 88], lean: 0, e: 'lin' },
  { t: 8.3, hip: [-8, 89], lean: -3, hF: [40, -8], hB: [16, -28], fF: [32, 0], fB: [-30, 0], e: 'lin' },
  { t: 8.7, hip: [-10, 88], lean: -7, hF: [42, -6], hB: [16, -24], fF: [32, 0], fB: [-30, 0], e: 'lin' },
  { t: 8.96, hip: [-12, 86], lean: -10, hF: [44, -4], hB: [16, -20], fF: [32, 0], fB: [-30, 0], e: 'lin' },
  { t: T_DEFLECT, hip: [-12, 86], lean: -10, hF: [44, -4], hB: [16, -20], fF: [32, 0], fB: [-30, 0], e: 'lin' },
  { t: 9.07, x: 1604, hip: [-18, 82], lean: -16, tilt: 10, hF: [30, 2], hB: [12, -18], fF: [32, 0], fB: [-32, 0], e: 'snap' },
  // already running
  { t: 9.12, x: 1596, hip: [8, 70], lean: 28, hF: [30, -20], hB: [14, -30], fF: [30, 0], fB: [-36, 0] },
  { t: 9.2, x: 1545, p: 'run1', hF: [30, -6], hB: [16, -16], e: 'lin' },
  { t: 9.29, x: 1470, p: 'run2', hF: [10, 20], hB: [-4, 10], e: 'lin' },
  { t: 9.38, x: 1395, p: 'run1', hF: [-20, 44], hB: [-30, 34], e: 'lin' },
  { t: 9.46, x: 1340, p: 'run2', hF: [-24, 50], hB: [-34, 40], e: 'lin' },
  // round six: cut in half on the run
  { t: T_CUT, x: 1290, hip: [10, 78], lean: 30, hF: [56, 34], hB: [40, 24], fF: [50, 0], fB: [-52, 20], e: 'snap' },
  { t: 9.63, x: 1250, p: 'run2', hF: [50, -30], hB: [36, -36], e: 'lin' },
  { t: 9.72, x: 1218, p: 'run1', hF: [40, -20], hB: [26, -28], e: 'lin' },
  { t: 9.82, x: 1198, p: 'run2', hF: [36, -10], hB: [22, -20], e: 'lin' },
  // click. He stops.
  { t: 9.98, x: 1186, hip: [-14, 70], lean: -14, hF: [40, 12], hB: [24, 2], fF: [44, 0], fB: [-20, 0], slide: true, e: 'out' },
  { t: 10.12, x: 1180, p: 'guard2', hip: [-6, 84] },
  { t: 10.22, p: 'guard2', hip: [-10, 86], lean: -6 },
  { t: 10.34, p: 'guard2', hip: [-8, 86], lean: -4 },
  { t: 10.5, hip: [-4, 97], lean: 0, tilt: -16, hF: [22, -44], hB: [-10, -60], fF: [26, 0], fB: [-22, 0] },
  { t: 10.72, hip: [-4, 98], lean: -2, tilt: 14, hF: [22, -46], hB: [-10, -62], fF: [26, 0], fB: [-22, 0] },
  { t: 10.92, hip: [-4, 97], lean: -2, tilt: 10, hF: [22, -46], hB: [-10, -62], fF: [26, 0], fB: [-22, 0] },
  // the gun comes at his head — caught
  { t: 11.06, hip: [-8, 92], lean: -10, hF: [16, -40], hB: [30, 24], fF: [26, 0], fB: [-26, 0] },
  { t: T_CATCH, x: 1184, hip: [-14, 88], lean: -18, tilt: -8, hF: [10, -40], hB: [44, 34], fF: [26, 0], fB: [-30, 0], e: 'snap' },
  { t: 11.24, same: true },
  { t: 11.32, hip: [-6, 92], lean: -4, tilt: 22, hF: [14, -44], hB: [34, 12], fF: [26, 0], fB: [-26, 0] },      // looks at it
  // back to the ink: turn, sprint with the sword trailing, slide to a knee, muzzle into the puddle
  { t: 11.42, x: 1196, face: 1, hip: [8, 72], lean: 28, hF: [-30, -24], hB: [30, -10], fF: [30, 0], fB: [-36, 0] },
  { t: 11.5, x: 1250, p: 'run1', hF: [-36, -26], hB: [34, -6], e: 'lin' },
  { t: 11.58, x: 1312, p: 'run2', hF: [-34, -28], hB: [40, -16], e: 'lin' },
  { t: 11.66, x: 1374, p: 'run1', hF: [-36, -24], hB: [44, -24], e: 'lin' },
  { t: 11.77, x: 1440, hip: [-6, 54], lean: 20, hF: [-34, -10], hB: [50, -30], fF: [44, 0], fB: [-36, 0], slide: true, e: 'out' },
  { t: T_RELOAD, x: 1456, hip: [4, 46], lean: 36, tilt: 18, hF: [-34, 4], hBw: DUNK, fF: [38, 0], fB: [-36, 0], e: 'snap' },
  { t: 12.02, hip: [5, 45], lean: 38, tilt: 22, hF: [-30, 14], hBw: [DUNK[0], DUNK[1] - 5], fF: [38, 0], fB: [-36, 0] },   // watches it drink
  { t: T_INKED, hip: [4, 46], lean: 36, tilt: 20, hF: [-20, 30], hBw: [DUNK[0], DUNK[1] - 3], fF: [38, 0], fB: [-36, 0] },
  { t: 12.32, x: 1462, face: -1, hip: [0, 68], lean: 8, hF: [-20, -10], hB: [10, -30], fF: [30, 0], fB: [-30, 0] },
  { t: 12.46, x: 1470, ...AS, hB: armL(A7, 60), e: 'out' },
  // rounds seven, eight, nine
  ...aShot(SH7, A7, 1470),
  { t: 12.87, x: 1486, ...AS, hip: [-8, 86], lean: 2, hB: armL(A8, 66) },
  ...aShot(SH8, A8, 1490),
  { t: 13.25, x: 1506, ...AS, hip: [-4, 84], lean: 4, hB: armL(A9, 66) },
  ...aShot(SH9, A9, 1510),
  { t: 13.64, x: 1570, hip: [-10, 90], lean: -8, hF: [-22, -36], hB: armL(176, 72), fF: [30, 0], fB: [-30, 0] },
  { t: 13.81, x: 1600, hip: [-12, 90], lean: -10, hF: [-22, -36], hB: armL(174, 74), fF: [-26, 0], fB: [30, 0] },
  // the revolver is swatted out of his hand
  { t: T_SWAT, x: 1604, hip: [-14, 88], lean: -20, tilt: -14, hF: [-10, -30], hB: [30, 62], fF: [30, 0], fB: [-32, 0], e: 'snap' },
  { t: 13.98, same: true },
  { t: 14.12, x: 1640, hip: [-8, 86], lean: -6, hF: [30, -10], hB: [20, 10], fF: [30, 0], fB: [-30, 0] },
  { t: 14.26, x: 1650, p: 'guard2', hip: [-6, 86] },
  { t: T_STOMP, p: 'guard2', hip: [-6, 88], lean: 6 },
  { t: T_STOMP + 0.06, p: 'guard2', hip: [-10, 84], lean: 0, e: 'snap' },
  { t: T_LIFT, p: 'guard2', hip: [-6, 90], lean: 4, tilt: 18 },                                              // looks at what is left of it
  { t: 14.98, p: 'guard2', hip: [-4, 86], tilt: 6 },
  // 15–16.4: steel again. Sways out of the overhead, cuts, slides under the thrust
  { t: 15.2, x: 1654, p: 'guard2', hip: [-8, 90], lean: 0 },
  { t: 15.36, x: 1744, hip: [-16, 86], lean: -24, tilt: -8, hF: [30, 20], hB: [16, 10], fF: [34, 0], fB: [-30, 0], e: 'out' },
  { t: 15.5, x: 1736, hip: [-8, 94], lean: -10, hF: [-4, 70], hB: [-18, 60], fF: [28, 0], fB: [-30, 0] },
  { t: 15.62, x: 1668, hip: [10, 76], lean: 28, hF: [54, 34], hB: [38, 24], fF: [46, 0], fB: [-42, 0], e: 'snap' },
  { t: 15.7, same: true },
  { t: 15.8, x: 1674, p: 'guard2', hip: [-4, 84] },
  { t: 15.9, x: 1668, hip: [2, 60], lean: 34, hF: [30, -20], hB: [16, -30], fF: [34, 0], fB: [-30, 0] },
  { t: 15.98, x: 1620, ...SLIDE, slide: true, e: 'in' },
  { t: 16.1, x: 1450, ...SLIDE, slide: true, e: 'lin' },
  { t: 16.22, x: 1320, ...SLIDE, hip: [-6, 36], lean: 60, slide: true, e: 'out' },
  { t: 16.34, x: 1272, face: 1, hip: [4, 74], lean: 14, hF: [10, -34], hB: [-22, -28], fF: [14, 0], fB: [-22, 0] },
  // 16.4–17.5: cut at his back — blocked — bind. The floor starts to go
  { t: 16.46, x: 1232, hip: [-12, 88], lean: -12, hF: [-20, 44], hB: [-30, 34], fF: [30, 0], fB: [-30, 0] },
  { t: 16.6, x: 1244, hip: [10, 76], lean: 30, hF: [58, 0], hB: [44, -10], fF: [46, 0], fB: [-42, 0], e: 'snap' },
  { t: 16.68, same: true },
  { t: 16.82, x: 1280, hip: [14, 78], lean: 26, hF: [56, 10], hB: [42, 0], fF: [46, 0], fB: [-44, 0] },
  { t: 17.0, hip: [18, 74], lean: 30, hF: [56, 12], hB: [42, 2], fF: [46, 0], fB: [-46, 0] },
  { t: 17.16, x: 1258, hip: [14, 74], lean: 26, hF: [52, 12], hB: [38, 2], fF: [44, 0], fB: [-46, 0], slide: true },
  { t: 17.3, hip: [12, 76], lean: 24, tilt: 34, hF: [52, 12], hB: [38, 2], fF: [44, 0], fB: [-46, 0] },
  { t: 17.44, hip: [10, 74], lean: 22, tilt: 10, hF: [50, 12], hB: [36, 2], fF: [44, 0], fB: [-46, 0] },
  // shoved off
  { t: 17.52, x: 1246, p: 'hitBack', e: 'snap' },
  ...flight(17.52, 17.8, [1246, 0], [1130, 0], 2600, [
    [17.66, { hip: [0, 70], lean: -20, hF: [40, 30], hB: [30, 36], fF: [40, 20], fB: [-10, 10] }],
  ], { hip: [-10, 56], lean: 16, hF: [34, -20], hB: [20, -30], fF: [36, 0], fB: [-40, 0] }),
  { t: 17.95, x: 1100, hip: [-8, 60], lean: 18, hF: [36, -16], hB: [22, -26], fF: [36, 0], fB: [-40, 0], slide: true, e: 'out' },
  { t: 18.12, x: 1100, p: 'parryHigh', hip: [-6, 76] },
  // thinks better of blocking that
  { t: 18.26, hip: [-12, 82], lean: -12, hF: [30, 40], hB: [16, 30], fF: [30, 0], fB: [-30, 0], e: 'in' },
  ...flight(18.26, 18.54, [1100, 0], [960, 0], 3800, [
    [18.4, { hip: [0, 84], lean: -6, hF: [34, 30], hB: [20, 24], fF: [30, 20], fB: [-10, 26] }],
  ], { hip: [-6, 56], lean: 22, hF: [36, -20], hB: [20, -30], fF: [36, 0], fB: [-36, 0] }),
  { t: 18.72, x: 956, y: -sag(956, 18.72), hip: [-8, 70], lean: 2, tilt: 26, hF: [40, 0], hB: [-30, 10], fF: [34, 0], fB: [-34, 0] },
  // the sheet folds away under him
  { t: T_GIVE, x: 952, y: -sag(952, T_GIVE), hip: [-6, 82], lean: -8, tilt: 10, hF: [36, 30], hB: [-34, 26], fF: [24, 0], fB: [-24, 0] },
  { t: 19.15, x: 940, y: -38, hip: [0, 86], lean: -4, hF: [30, 44], hB: [-26, 40], fF: [20, 6], fB: [-22, 12], e: 'lin', er: 'lin' },
  { t: 19.5, x: 915, y: -68, hip: [0, 84], lean: 6, hF: [24, 46], hB: [-20, 40], fF: [18, 6], fB: [-20, 16], e: 'lin', er: 'lin' },
  { t: 20.0, x: 890, y: -128, hip: [0, 84], lean: 16, hF: [20, 44], hB: [-16, 40], fF: [16, 6], fB: [-20, 18], e: 'lin', er: 'lin' },
  { t: 20.2, x: 884, y: -172, hip: [0, 84], lean: 16, hF: [20, 44], hB: [-16, 40], fF: [16, 6], fB: [-20, 18], e: 'lin', er: 'lin' },
];

// ── FIGHTER B — The Powerhouse ───────────────────────────────────────────────
const BS1 = { hip: [-4, 90], lean: 6, hB: [-20, -30], fF: [46, 0], fB: [-46, 0] };
const BS2 = { hip: [-8, 90], lean: -2, hB: [30, -4], fF: [46, 0], fB: [-46, 0] };
const BS4 = { hip: [-2, 88], lean: 10, hB: [30, -4], fF: [46, 0], fB: [-46, 0] };
const W1 = { hip: [0, 84], lean: 16, hF: [56, -6], hB: [-24, -30], fF: [50, 0], fB: [-44, 0] };
const W2 = { hip: [0, 86], lean: 14, hF: [56, -4], hB: [-24, -30], fF: [-40, 0], fB: [48, 0] };
const B_KEYS = [
  // 0–1.5: lands like a dropped safe, levels the spear
  { t: 0, x: 770, y: 940, face: 1, hip: [0, 80], lean: 20, hF: [30, 30], hB: [-20, 40], fF: [30, 10], fB: [-30, 20] },
  ...flight(0, 0.74, [770, 940], [800, 0], 2400, [
    [0.4, { hip: [0, 78], lean: 30, hF: [36, 36], hB: [-10, 46], fF: [40, 14], fB: [-36, 24] }],
  ], { hip: [8, 44], lean: 52, bend: 14, tilt: -10, hF: [34, -56], hB: [-6, -58], fF: [52, 0], fB: [-52, 0], kB: -1, e: 'in' }),
  { t: 0.86, hip: [8, 40], lean: 54, bend: 15, tilt: -10, hF: [34, -52], hB: [-6, -54], fF: [52, 0], fB: [-52, 0], kB: -1 },
  { t: 1.08, hip: [4, 62], lean: 36, tilt: -24, hF: [36, -40], hB: [-10, -46], fF: [52, 0], fB: [-52, 0] },
  { t: 1.3, p: 'bStance', hip: [0, 82], lean: 20, hF: [44, -26], hB: [-14, -34], fF: [50, 0], fB: [-50, 0] },
  // thrust — parried; blocks the riposte overhead; low stab — smashed down; disarmed
  { t: 1.46, hip: [-18, 76], lean: 6, hF: [12, -22], hB: [-40, -28], fF: [50, 0], fB: [-50, 0] },
  { t: 1.6, x: 860, hip: [18, 76], lean: 34, hF: [76, 10], hB: [22, -6], fF: [60, 0], fB: [-58, 0], e: 'snap' },
  { t: 1.68, same: true },
  { t: 1.78, x: 850, hip: [-10, 78], lean: 4, hF: [40, -10], hB: [0, -24], fF: [52, 0], fB: [-52, 0] },
  { t: 1.9, hip: [-10, 62], lean: -6, hF: [40, 46], hB: [-20, 42], fF: [54, 0], fB: [-54, 0], e: 'snap' },
  { t: 1.97, same: true },
  { t: 2.06, x: 846, hip: [-16, 68], lean: 12, hF: [10, -34], hB: [-40, -38], fF: [52, 0], fB: [-52, 0] },
  { t: 2.2, x: 852, hip: [18, 58], lean: 42, bend: 8, hF: [62, -54], hB: [10, -50], fF: [60, 0], fB: [-56, 0], e: 'snap' },
  { t: 2.36, same: true },
  { t: 2.46, hip: [22, 54], lean: 50, bend: 10, hF: [60, -60], hB: [10, -56], fF: [60, 0], fB: [-56, 0], e: 'in3' },
  { t: 2.52, same: true },
  { t: 2.62, hip: [10, 60], lean: 40, hF: [58, -50], hB: [8, -48], fF: [60, 0], fB: [-56, 0] },
  { t: T_DISARM, hip: [4, 72], lean: 8, tilt: -20, hF: [60, 40], hB: [30, 52], fF: [60, 0], fB: [-56, 0], e: 'snap' },
  { t: 2.8, x: 838, hip: [-18, 76], lean: -26, tilt: -30, hF: [44, 50], hB: [26, 60], fF: [40, 8], fB: [-44, 0], e: 'out' },
  // empty hands: backs away from the sword-point
  { t: 2.94, x: 800, hip: [-12, 78], lean: -10, tilt: -10, hF: [36, 4], hB: [20, 10], fF: [40, 0], fB: [-48, 0] },
  { t: 3.12, x: 720, hip: [-8, 82], lean: -2, tilt: 26, hF: [34, -10], hB: [24, -4], fF: [-36, 0], fB: [40, 0] },
  { t: 3.3, x: 652, hip: [-10, 84], lean: -10, tilt: -30, hF: [30, 4], hB: [22, -8], fF: [40, 0], fB: [-44, 0] },
  { t: 3.52, x: 610, hip: [-12, 84], lean: -12, tilt: -6, hF: [38, 6], hB: [30, -2], fF: [-36, 0], fB: [40, 0] },
  { t: 3.76, x: 590, hip: [-14, 86], lean: -14, hF: [38, 8], hB: [30, 0], fF: [40, 0], fB: [-44, 0] },
  // bumps the margin, looks round, finds the doodle, peels it off the page
  { t: T_BUMP, x: 574, hip: [-16, 88], lean: 0, tilt: -12, hF: [36, 10], hB: [-22, 4], fF: [40, 0], fB: [-44, 0], turnB: -1, e: 'snap' },
  { t: 4.02, same: true },
  { t: 4.12, x: 580, face: -1, hip: [0, 84], lean: 14, tilt: 18, hF: [36, 0], hB: [-20, -20], fF: [30, 0], fB: [-30, 0] },
  { t: T_GRAB, hip: [8, 82], lean: 20, tilt: 10, hFw: GRIP0, hB: [-24, -20], fF: [30, 0], fB: [-30, 0] },
  { t: T_PEEL, hip: [-4, 86], lean: 6, hFw: [522, 182], hB: [-30, -10], fF: [30, 0], fB: [-30, 0], e: 'snap' },
  { t: 4.36, hip: [-6, 88], lean: 2, hF: [30, 16], hB: [-26, -14], fF: [30, 0], fB: [-30, 0] },
  { t: 4.5, x: 590, face: 1, hip: [0, 86], lean: 6, hF: [26, 14], hB: [-16, -30], fF: [30, 0], fB: [-30, 0] },
  // weighs it… levels it
  { t: 4.6, hip: [0, 84], lean: 10, tilt: 16, hF: [40, -8], hB: [-10, -36], fF: [30, 0], fB: [-30, 0] },
  { t: 4.72, hip: [0, 82], lean: 12, tilt: 18, hF: [44, -16], hB: [-10, -36], fF: [30, 0], fB: [-30, 0] },
  { t: 4.84, x: 620, hip: [0, 86], lean: 8, tilt: 6, hF: [46, -2], hB: [-12, -34], fF: [44, 0], fB: [-44, 0] },
  { t: T_LEVEL, x: 640, ...BS1, hF: arm(A1), e: 'snap' },
  { t: 5.18, ...BS1, hip: [-2, 88], lean: 10, hF: arm(A1) },
  // 5.3–9.5: six rounds
  ...bShot(SH1, A1, BS1),
  // strides after him, the gun coming up in both hands
  { t: 5.6, ...BS1, hip: [2, 88], lean: 12, hF: arm(4, 72) },
  { t: 5.74, x: 716, hip: [4, 84], lean: 16, hF: arm(8, 70), hB: [30, 0], fFw: [690.6, 0], fBw: [749.4, 0] },
  { t: 5.92, x: 800, ...BS2, hip: [-2, 88], lean: 6, hF: arm(A2 + 5) },
  ...bShot(SH2, A2, BS2),
  { t: 6.38, ...BS2, hip: [-6, 91], lean: -6, hF: arm(17, 74) },                    // follows him along the shelf
  ...bShot(SH3, A3, BS2),
  { t: 6.96, ...BS4, hF: arm(A4) },
  ...bShot(SH4, A4, BS4),
  { t: 7.42, hip: [-6, 90], lean: 2, tilt: -12, hF: arm(-24, 60), hB: [-16, -32], fF: [46, 0], fB: [-46, 0] },
  { t: 7.66, hip: [-4, 90], lean: 4, hF: arm(-10, 68), hB: [20, -10], fF: [46, 0], fB: [-46, 0] },
  { t: 7.82, ...BS4, hF: arm(A5) },
  ...bShot(SH5, A5, BS4, 4),
  { t: T_DEFLECT, ...BS4, hF: arm(A5 + 1) },
  { t: 9.14, hip: [-8, 90], lean: 0, tilt: -16, hF: arm(-12, 66), hB: [-16, -32], fF: [46, 0], fB: [-46, 0] },
  { t: 9.36, x: 800, hip: [0, 86], lean: 12, hF: arm(A6), hB: [30, -4], fF: [46, 0], fB: [-46, 0] },
  ...bShot(SH6, A6, { hip: [0, 86], lean: 12, hB: [30, -4], fF: [46, 0], fB: [-46, 0] }),
  { t: 9.82, hip: [2, 86], lean: 14, hF: arm(A6), hB: [30, -4], fF: [46, 0], fB: [-46, 0] },
  // click. click click.
  { t: T_CLICK, hip: [2, 86], lean: 14, hF: arm(A6 - 4, 76), hB: [30, -4], fF: [46, 0], fB: [-46, 0], e: 'snap' },
  { t: 9.98, hip: [2, 86], lean: 14, hF: arm(A6), hB: [30, -4], fF: [46, 0], fB: [-46, 0] },
  { t: 10.14, x: 816, hip: [6, 84], lean: 20, hF: arm(A6 + 1), hB: [30, -4], fF: [48, 0], fB: [-46, 0] },
  { t: 10.2, hip: [6, 84], lean: 20, hF: arm(A6 - 5, 76), hB: [30, -4], fF: [48, 0], fB: [-46, 0], e: 'snap' },
  { t: 10.27, hip: [6, 84], lean: 20, hF: arm(A6), hB: [30, -4], fF: [48, 0], fB: [-46, 0] },
  { t: F(310), hip: [6, 84], lean: 20, hF: arm(A6 - 5, 76), hB: [30, -4], fF: [48, 0], fB: [-46, 0], e: 'snap' },
  { t: 10.4, hip: [6, 84], lean: 20, hF: arm(A6), hB: [30, -4], fF: [48, 0], fB: [-46, 0] },
  // stares at it. Shakes it.
  { t: 10.54, hip: [-4, 92], lean: 0, tilt: 22, hF: [30, 12], hB: [-14, -34], fF: [46, 0], fB: [-46, 0] },
  { t: 10.64, hip: [-4, 92], lean: 2, tilt: 26, hF: [34, 4], hB: [-14, -34], fF: [46, 0], fB: [-46, 0] },
  { t: 10.71, hip: [-4, 92], lean: 2, tilt: 26, hF: [34, 14], hB: [-14, -34], fF: [46, 0], fB: [-46, 0] },
  { t: 10.78, hip: [-4, 92], lean: 2, tilt: 24, hF: [34, 4], hB: [-14, -34], fF: [46, 0], fB: [-46, 0] },
  // …and throws it at him
  { t: 10.88, x: 822, hip: [-20, 82], lean: -14, tilt: -8, hF: [-40, 30], hB: [40, 0], fF: [46, 0], fB: [-46, 0] },
  { t: T_THROW, x: 862, hip: [16, 78], lean: 34, hF: [72, 10], hB: [-30, -20], fF: [56, 0], fB: [-54, 0], e: 'snap' },
  { t: 11.08, same: true },
  // marches to his spear and rips it out of the page
  { t: 11.22, x: 876, p: 'bStance', hip: [0, 84], lean: 16, fFw: [923.6, 0], fBw: [802.6, 0] },
  { t: 11.36, x: 940, hip: [4, 82], lean: 22, hF: [40, -20], hB: [-30, -24], fFw: [923.6, 0], fBw: [960, 0] },
  { t: 11.5, x: 984, hip: [2, 86], lean: 16, hF: [50, -6], hB: [-20, -30], fFw: [1012, 0], fBw: [960, 0] },
  { t: 11.56, hip: [8, 84], lean: 18, hFw: SPEAR_GRIP, hB: [10, -20], fFw: [1012, 0], fBw: [960, 0] },
  { t: T_YANK, hip: [-12, 92], lean: -8, hF: [50, 40], hB: [10, 10], fFw: [1012, 0], fBw: [960, 0], e: 'snap' },
  { t: 11.84, hip: [-4, 86], lean: 6, hF: [48, 8], hB: [0, -10], fFw: [1012, 0], fBw: [960, 0] },            // the point comes up
  // sets a guard and comes on: three heavy steps, the shaft put where each round is going
  { t: 12.0, x: 988, hip: [0, 78], lean: 16, hF: [40, -2], hB: [0, -30], fFw: [1012, 0], fBw: [960, 0] },
  { t: 12.26, x: 1058, hip: [6, 74], lean: 24, hF: [58, 2], hB: [20, -30], fFw: [1012, 0], fBw: [1105, 0], e: 'in' },
  { t: 12.42, x: 1060, hip: [-2, 78], lean: 12, hF: [68, 4], hB: [40, -30], fFw: [1012, 0], fBw: [1105, 0] },         // shaft upright at arm's length
  { t: SH7, hip: [-2, 77], lean: 12, hF: [68, 4], hB: [40, -30], fFw: [1012, 0], fBw: [1105, 0] },
  { t: SH7 + 0.05, x: 1052, hip: [-14, 82], lean: 0, tilt: -12, hF: [46, 8], hB: [20, -30], fFw: [1012, 0], fBw: [1105, 0], e: 'snap' },   // seven: driven back onto his chest
  { t: SH7 + 0.13, x: 1052, hip: [-14, 82], lean: 0, tilt: -12, hF: [46, 8], hB: [20, -30], fFw: [1012, 0], fBw: [1105, 0] },
  { t: 12.78, x: 1066, hip: [6, 78], lean: 24, tilt: 10, hF: [46, 4], hB: [10, -30], fFw: [1012, 0], fBw: [1105, 0] },
  { t: 12.92, x: 1148, hip: [8, 68], lean: 32, hF: [50, -10], hB: [10, -10], fFw: [1195, 0], fBw: [1105, 0], e: 'in' },       // crouches behind the point
  { t: SH8, hip: [8, 67], lean: 32, hF: [50, -10], hB: [10, -10], fFw: [1195, 0], fBw: [1105, 0] },
  { t: SH8 + 0.05, x: 1138, hip: [-6, 72], lean: 20, tilt: -10, hF: [34, -4], hB: [0, 0], fFw: [1195, 0], fBw: [1105, 0], e: 'snap' },    // eight
  { t: SH8 + 0.13, x: 1138, hip: [-6, 72], lean: 20, tilt: -10, hF: [34, -4], hB: [0, 0], fFw: [1195, 0], fBw: [1105, 0] },
  { t: 13.18, x: 1150, hip: [6, 74], lean: 28, hF: [48, -10], hB: [10, -10], fFw: [1195, 0], fBw: [1105, 0] },
  { t: 13.3, x: 1172, hip: [2, 84], lean: 18, hF: [46, -10], hB: [10, -20], fFw: [1195, 0], fBw: [1166, 34] },                // the next step is on its way down…
  // …when the floor goes in front of him. The foot hangs there. Then he puts it down on the far side
  { t: SH9 + 0.07, x: 1168, hip: [-12, 88], lean: -4, tilt: 22, hF: [44, 14], hB: [0, -10], fFw: [1195, 0], fBw: [1202, 50], e: 'snap' },
  { t: 13.52, x: 1168, hip: [-12, 89], lean: -4, tilt: 28, hF: [44, 12], hB: [0, -10], fFw: [1195, 0], fBw: [1208, 54] },
  { t: 13.64, x: 1262, hip: [8, 76], lean: 26, hF: [52, -8], hB: [10, -20], fFw: [1195, 0], fBw: [1335, 0], e: 'in' },
  { t: 13.78, x: 1384, hip: [-10, 80], lean: 6, hF: [14, -34], hB: [-30, -40], fFw: [1440, 0], fBw: [1335, 0] },
  // swats the revolver away…
  { t: T_SWAT, x: 1402, hip: [12, 86], lean: 14, hF: [70, 10], hB: [20, -10], fFw: [1440, 0], fBw: [1335, 0], e: 'snap' },
  { t: 13.98, x: 1402, hip: [12, 86], lean: 14, hF: [70, 10], hB: [20, -10], fFw: [1440, 0], fBw: [1335, 0] },
  { t: 14.12, hip: [0, 86], lean: 10, tilt: 22, hF: [30, 20], hB: [-20, -30], fFw: [1440, 0], fBw: [1335, 0] },
  // …and stomps it flat. Grinds it. Takes his foot off.
  { t: 14.28, hip: [-8, 96], lean: -6, tilt: 26, hF: [20, 30], hB: [-24, -20], fF: [36, 54], fBw: [1380, 0] },
  { t: 14.4, hip: [-10, 98], lean: -8, tilt: 26, hF: [20, 34], hB: [-24, -16], fF: [40, 62], fBw: [1380, 0] },
  { t: T_STOMP, hip: [10, 70], lean: 26, tilt: 26, hF: [24, 30], hB: [-30, -10], fFw: [GUN_REST[0], 0], fBw: [1380, 0], e: 'in3' },
  { t: 14.58, hip: [10, 70], lean: 26, tilt: 26, hF: [24, 30], hB: [-30, -10], fFw: [GUN_REST[0], 0], fBw: [1380, 0] },
  { t: 14.68, hip: [14, 64], lean: 30, tilt: 30, hF: [26, 24], hB: [-30, -14], fFw: [GUN_REST[0] + 7, 0], fBw: [1380, 0], slide: true },
  { t: T_LIFT, hip: [-6, 90], lean: 0, tilt: 34, hF: [20, 22], hB: [-24, -24], fFw: [GUN_REST[0] - 6, 46], fBw: [1380, 0], e: 'out' },
  { t: 14.94, x: 1346, p: 'bStance', hip: [0, 82], lean: 18, tilt: 22, hF: [44, -26], hB: [-14, -34], fF: [50, 0], fB: [-50, 0] },
  // 15–16.4: overhead — misses; blocks; thrust — A is gone
  { t: 15.06, hip: [-18, 84], lean: -12, hF: [-10, 64], hB: [-30, 46], fF: [50, 0], fB: [-50, 0], e: 'out' },
  { t: 15.28, hip: [-22, 88], lean: -16, hF: [-14, 68], hB: [-34, 50], fF: [50, 0], fB: [-50, 0] },
  { t: T_SLAM1, x: 1400, hip: [22, 56], lean: 52, bend: 10, hF: [58, -36], hB: [30, -40], fF: [58, 0], fB: [-54, 0], e: 'in3' },
  { t: 15.46, same: true },
  { t: 15.54, hip: [4, 66], lean: 30, hF: [50, -10], hB: [10, -20], fF: [58, 0], fB: [-54, 0] },
  { t: 15.62, x: 1400, hip: [-10, 62], lean: -6, hF: [40, 34], hB: [-20, 30], fF: [54, 0], fB: [-54, 0], e: 'snap' },
  { t: 15.7, same: true },
  { t: 15.84, hip: [-18, 78], lean: 4, hF: [10, 6], hB: [-40, -4], fF: [54, 0], fB: [-54, 0] },
  { t: 16.0, x: 1470, hip: [18, 80], lean: 30, hF: [76, 14], hB: [22, 0], fF: [60, 0], fB: [-58, 0], e: 'snap' },
  { t: 16.08, same: true },
  { t: 16.22, hip: [6, 82], lean: 16, tilt: -30, hF: [50, 0], hB: [0, -10], fF: [60, 0], fB: [-58, 0] },
  // turns, takes the cut on the shaft, leans on him
  { t: 16.38, x: 1496, face: -1, hip: [-6, 80], lean: 4, hF: [30, 10], hB: [0, -10], fF: [44, 0], fB: [-44, 0] },
  { t: 16.5, hip: [-8, 80], lean: 0, hF: [38, 14], hB: [10, -20], fF: [44, 0], fB: [-44, 0] },
  { t: 16.6, x: 1500, hip: [-12, 76], lean: -4, hF: [50, 16], hB: [14, -24], fF: [50, 0], fB: [-50, 0], e: 'snap' },
  { t: 16.68, same: true },
  { t: 16.82, hip: [6, 76], lean: 6, hF: [70, 16], hB: [30, -20], fF: [50, 0], fB: [-50, 0] },
  { t: 17.0, hip: [10, 74], lean: 6, hF: [74, 16], hB: [34, -20], fF: [50, 0], fB: [-52, 0] },
  { t: 17.16, x: 1470, hip: [12, 74], lean: 8, hF: [74, 16], hB: [34, -20], fF: [50, 0], fB: [-52, 0] },
  { t: 17.3, hip: [10, 76], lean: 6, tilt: 30, hF: [72, 16], hB: [32, -20], fF: [50, 0], fB: [-52, 0] },
  { t: 17.42, hip: [-8, 78], lean: 4, tilt: 0, hF: [30, 16], hB: [0, -16], fF: [50, 0], fB: [-52, 0] },
  { t: 17.52, x: 1440, hip: [18, 80], lean: 26, hF: [72, 16], hB: [40, -10], fF: [56, 0], fB: [-54, 0], e: 'snap' },
  { t: 17.6, same: true },
  // the big one: everything he has, overhead
  { t: 17.78, x: 1450, hip: [-20, 82], lean: -14, hF: [-16, 64], hB: [-40, 48], fF: [48, 0], fB: [-48, 0] },
  { t: 18.2, hip: [-26, 90], lean: -20, hF: [-20, 70], hB: [-44, 54], fF: [48, 0], fB: [-48, 0] },
  { t: 18.3, x: 1430, hip: [-10, 92], lean: -6, hF: [10, 74], hB: [-14, 64], fF: [40, 14], fB: [-48, 0], e: 'in' },
  { t: T_BLOW, x: 1410, hip: [22, 56], lean: 52, bend: 12, hF: [54, -40], hB: [30, -44], fF: [54, 0], fB: [-54, 0], e: 'in3' },
  { t: 18.52, same: true },
  { t: 18.72, y: -sag(1410, 18.72), hip: [18, 60], lean: 46, tilt: 24, hF: [50, -36], hB: [26, -40], fF: [54, 0], fB: [-54, 0] },
  // …and the floor is gone
  { t: T_GIVE, y: -sag(1410, T_GIVE), hip: [0, 74], lean: 16, tilt: -10, hF: [40, 10], hB: [-30, 20], fF: [50, 0], fB: [-50, 0] },
  { t: 19.15, x: 1414, y: -36, hip: [0, 80], lean: 6, hF: [36, 30], hB: [-26, 36], fF: [40, 6], fB: [-40, 10], e: 'lin', er: 'lin' },
  { t: 19.5, x: 1420, y: -72, hip: [0, 80], lean: 14, hF: [32, 30], hB: [-20, 40], fF: [34, 10], fB: [-34, 18], e: 'lin', er: 'lin' },
  { t: 20.0, x: 1428, y: -136, hip: [0, 80], lean: 20, hF: [30, 30], hB: [-20, 40], fF: [30, 10], fB: [-30, 20], e: 'lin', er: 'lin' },
  { t: 20.2, x: 1430, y: -182, hip: [0, 80], lean: 20, hF: [30, 30], hB: [-20, 40], fF: [30, 10], fB: [-30, 20], e: 'lin', er: 'lin' },
];

S.fighters({ A: A_KEYS, B: B_KEYS });

// ── weapons ──────────────────────────────────────────────────────────────────
S.weapon('long', wk([
  { t: 0, type: 'longsword', by: 'A', ang: 100, g: 0.1, two: 0 },
  { t: 0.62, by: 'A', ang: 158 }, { t: 0.98, by: 'A', ang: 125, two: 1 }, { t: 1.44, by: 'A', ang: 125 }, { t: 1.52, by: 'A', ang: 128 },
  { t: 1.6, by: 'A', ang: 98, e: 'snap' }, { t: 1.68, by: 'A', ang: 84 }, { t: 1.78, by: 'A', ang: 70 },
  { t: 1.9, by: 'A', ang: 158, ccw: 1, e: 'snap' }, { t: 1.97, by: 'A', ang: 160 }, { t: 2.08, by: 'A', ang: 150 }, { t: 2.14, by: 'A', ang: 120 },
  { t: 2.3, by: 'A', ang: 75 }, { t: 2.46, by: 'A', ang: 216, ccw: 1, e: 'in3' }, { t: 2.52, by: 'A', ang: 217 }, { t: 2.6, by: 'A', ang: 200 },
  { t: T_DISARM, by: 'A', ang: 105, cw: 1, e: 'snap' }, { t: 2.8, by: 'A', ang: 100 }, { t: 2.96, by: 'A', ang: 125 },
  { t: 3.15, by: 'A', ang: 178 }, { t: 4.1, by: 'A', ang: 181 }, { t: 4.3, by: 'A', ang: 180 }, { t: 4.52, by: 'A', ang: 160, e: 'snap' },
  { t: 4.7, by: 'A', ang: 140 }, { t: T_LEVEL, by: 'A', ang: 114 }, { t: 5.22, by: 'A', ang: 110 },
  { t: SH1, by: 'A', ang: 62, two: 0, e: 'snap' }, { t: 5.4, by: 'A', ang: 58 },
  { t: 5.46, by: 'A', ang: 20 }, { t: 5.66, by: 'A', ang: 30 }, { t: 5.72, by: 'A', ang: 44 }, { t: 5.82, by: 'A', ang: 70 }, { t: 5.92, by: 'A', ang: 30 },
  { t: SH2, by: 'A', ang: 36 }, { t: SH2 + 0.06, by: 'A', ang: 12 }, { t: 6.26, by: 'A', ang: 28 }, { t: 6.31, by: 'A', ang: 352 }, { t: 6.34, by: 'A', ang: 60 },
  { t: 6.44, by: 'A', ang: 80 }, { t: 6.55, by: 'A', ang: 24, cw: 1, e: 'lin' }, { t: 6.66, by: 'A', ang: 250, cw: 1, e: 'lin' }, { t: 6.77, by: 'A', ang: 130, cw: 1, e: 'lin' }, { t: 6.86, by: 'A', ang: 50, cw: 1, e: 'lin' },
  { t: 6.98, by: 'A', ang: 140 }, { t: SH4, by: 'A', ang: 146 }, { t: 7.26, by: 'A', ang: 136 },
  { t: 7.36, by: 'A', ang: 160 }, { t: 7.66, by: 'A', ang: 162 }, { t: 7.76, by: 'A', ang: 128, two: 1 }, { t: 7.86, by: 'A', ang: 124 },
  { t: SH5, by: 'A', ang: 124, e: 'lin' }, { t: 8.3, by: 'A', ang: 114, e: 'lin' }, { t: 8.7, by: 'A', ang: 102, e: 'lin' }, { t: 8.96, by: 'A', ang: 93, e: 'lin' },
  { t: T_DEFLECT, by: 'A', ang: 93, e: 'lin' }, { t: 9.07, by: 'A', ang: 78, e: 'snap' },
  { t: 9.12, by: 'A', ang: 120 }, { t: 9.2, by: 'A', ang: 150 }, { t: 9.29, by: 'A', ang: 100 }, { t: 9.38, by: 'A', ang: 62 }, { t: 9.46, by: 'A', ang: 50 },
  { t: T_CUT, by: 'A', ang: 176, ccw: 1, e: 'snap' }, { t: 9.63, by: 'A', ang: 225 }, { t: 9.72, by: 'A', ang: 200 }, { t: 9.82, by: 'A', ang: 170 },
  { t: 9.98, by: 'A', ang: 132 }, { t: 10.12, by: 'A', ang: 125 }, { t: 10.34, by: 'A', ang: 120 },
  { t: 10.5, by: 'A', ang: 214, two: 0 }, { t: 10.72, by: 'A', ang: 222 }, { t: 10.92, by: 'A', ang: 220 },
  { t: 11.06, by: 'A', ang: 212 }, { t: T_CATCH, by: 'A', ang: 196 }, { t: 11.32, by: 'A', ang: 208 },
  { t: 11.42, by: 'A', ang: 204 }, { t: 11.66, by: 'A', ang: 196 }, { t: 11.77, by: 'A', ang: 176 },                 // trails behind him as he runs
  { t: T_RELOAD, by: 'A', ang: 150 }, { t: 12.02, by: 'A', ang: 110 }, { t: T_INKED, by: 'A', ang: 66 },              // comes up and over, slowly, while he kneels
  { t: 12.32, by: 'A', ang: 10 }, { t: 12.46, by: 'A', ang: 330 }, { t: SH7, by: 'A', ang: 330 }, { t: SH7 + 0.05, by: 'A', ang: 320 }, { t: 12.87, by: 'A', ang: 330 },
  { t: SH8, by: 'A', ang: 330 }, { t: SH8 + 0.05, by: 'A', ang: 320 }, { t: 13.25, by: 'A', ang: 332 }, { t: SH9, by: 'A', ang: 332 }, { t: SH9 + 0.05, by: 'A', ang: 322 },
  { t: 13.81, by: 'A', ang: 326 }, { t: T_SWAT, by: 'A', ang: 322 }, { t: 14.12, by: 'A', ang: 60, ccw: 1 }, { t: 14.26, by: 'A', ang: 125, two: 1 },
  { t: T_STOMP, by: 'A', ang: 122 }, { t: 14.98, by: 'A', ang: 125 }, { t: 15.2, by: 'A', ang: 120 }, { t: 15.36, by: 'A', ang: 100 },
  { t: 15.5, by: 'A', ang: 70 }, { t: 15.62, by: 'A', ang: 168, ccw: 1, e: 'snap' }, { t: 15.7, by: 'A', ang: 170 }, { t: 15.8, by: 'A', ang: 140 },
  { t: 15.9, by: 'A', ang: 170 }, { t: 15.98, by: 'A', ang: 188, two: 0 }, { t: 16.22, by: 'A', ang: 182 },
  { t: 16.34, by: 'A', ang: 60 }, { t: 16.46, by: 'A', ang: 125, two: 1 }, { t: 16.6, by: 'A', ang: 340, cw: 1, e: 'snap' }, { t: 16.68, by: 'A', ang: 342 },
  { t: 16.82, by: 'A', ang: 36, ccw: 1 }, { t: 17.0, by: 'A', ang: 46 }, { t: 17.16, by: 'A', ang: 50 }, { t: 17.44, by: 'A', ang: 48 },
  { t: 17.52, by: 'A', ang: 84, e: 'snap' }, { t: 17.8, by: 'A', ang: 40 }, { t: 17.95, by: 'A', ang: 55 },
  { t: 18.12, by: 'A', ang: 16 }, { t: 18.26, by: 'A', ang: 44 }, { t: 18.4, by: 'A', ang: 70 }, { t: 18.54, by: 'A', ang: 48 },
  { t: 18.72, by: 'A', ang: 58, two: 0.4 }, { t: T_GIVE, by: 'A', ang: 70, two: 0 }, { t: 19.5, by: 'A', ang: 68 }, { t: 20.2, by: 'A', ang: 64 },
]));

S.weapon('spear', wk([
  { t: 0, type: 'spear', by: 'B', ang: 30, g: 0.45, two: 1 },
  { t: 0.4, by: 'B', ang: 20 }, { t: 0.74, by: 'B', ang: 352, e: 'in' }, { t: 1.08, by: 'B', ang: 356 }, { t: 1.3, by: 'B', ang: 5 }, { t: 1.46, by: 'B', ang: 2 },
  { t: 1.6, by: 'B', ang: 4, e: 'snap' }, { t: 1.66, by: 'B', ang: 16, e: 'out' }, { t: 1.78, by: 'B', ang: 8 },
  { t: 1.9, by: 'B', ang: 12, e: 'snap' }, { t: 1.97, by: 'B', ang: 10 }, { t: 2.06, by: 'B', ang: 336 },
  { t: 2.2, by: 'B', ang: 352, e: 'snap' }, { t: 2.36, by: 'B', ang: 354 }, { t: 2.46, by: 'B', ang: 345, e: 'in3' }, { t: 2.52, by: 'B', ang: 344 },
  { t: 2.62, by: 'B', ang: 350 }, { t: T_DISARM - 0.01, by: 'B', ang: 20, e: 'in' },
  { t: T_DISARM, at: [946, 197], ang: 20 },
  { t: T_STICK, at: [SPEAR_X, 125], ang: 278, ccw: 1, turns: 1, hop: 330, e: 'lin' },
  { t: 3.56, at: [SPEAR_X, 125], ang: 273 }, { t: 3.64, at: [SPEAR_X, 125], ang: 281 }, { t: 3.74, at: [SPEAR_X, 125], ang: 277 }, { t: 3.9, at: [SPEAR_X, 125], ang: 278 },
  { t: 11.56, by: 'B', ang: 278, g: 0.4, two: 0 },
  { t: T_YANK, by: 'B', ang: 290, e: 'snap' },
  { t: 11.84, by: 'B', ang: 20, ccw: 1, g: 0.5 },
  { t: 12.0, by: 'B', ang: 62, two: 1 },
  { t: 12.26, by: 'B', ang: 80 }, { t: 12.42, by: 'B', ang: 96 },
  { t: SH7, by: 'B', ang: 96 }, { t: SH7 + 0.05, by: 'B', ang: 80, e: 'snap' }, { t: SH7 + 0.13, by: 'B', ang: 80 },
  { t: 12.78, by: 'B', ang: 66 },
  { t: 12.92, by: 'B', ang: 316, cw: 1, g: 0.4 },                                                                    // turns the point down in front of him
  { t: SH8, by: 'B', ang: 316 }, { t: SH8 + 0.05, by: 'B', ang: 308, e: 'snap' }, { t: SH8 + 0.13, by: 'B', ang: 308 },
  { t: 13.18, by: 'B', ang: 316 }, { t: 13.3, by: 'B', ang: 336, g: 0.5 },
  { t: SH9 + 0.07, by: 'B', ang: 24, e: 'snap' }, { t: 13.52, by: 'B', ang: 16 },
  { t: 13.64, by: 'B', ang: 352 },
  { t: 13.78, by: 'B', ang: 318, g: 0.45 },
  { t: T_SWAT, by: 'B', ang: 30, ccw: 1, e: 'snap' }, { t: 13.98, by: 'B', ang: 36 }, { t: 14.12, by: 'B', ang: 62 },
  { t: 14.28, by: 'B', ang: 90, two: 0 }, { t: T_STOMP, by: 'B', ang: 96 }, { t: 14.68, by: 'B', ang: 92 },
  { t: T_LIFT, by: 'B', ang: 84 }, { t: 14.94, by: 'B', ang: 38, two: 1 },
  { t: 15.06, by: 'B', ang: 118 }, { t: 15.28, by: 'B', ang: 126 }, { t: T_SLAM1, by: 'B', ang: 337, cw: 1, e: 'in3' }, { t: 15.46, by: 'B', ang: 337 },
  { t: 15.54, by: 'B', ang: 0 }, { t: 15.62, by: 'B', ang: 12, e: 'snap' }, { t: 15.7, by: 'B', ang: 10 }, { t: 15.84, by: 'B', ang: 8 },
  { t: 16.0, by: 'B', ang: 6, e: 'snap' }, { t: 16.08, by: 'B', ang: 6 }, { t: 16.22, by: 'B', ang: 12 },
  { t: 16.38, by: 'B', ang: 90 }, { t: 16.5, by: 'B', ang: 96 }, { t: 16.6, by: 'B', ang: 98, e: 'snap' }, { t: 16.68, by: 'B', ang: 96 },
  { t: 16.82, by: 'B', ang: 80 }, { t: 17.0, by: 'B', ang: 74 }, { t: 17.3, by: 'B', ang: 72 }, { t: 17.42, by: 'B', ang: 84 },
  { t: 17.52, by: 'B', ang: 100, e: 'snap' }, { t: 17.6, by: 'B', ang: 100 },
  { t: 17.78, by: 'B', ang: 62 }, { t: 18.2, by: 'B', ang: 52 }, { t: 18.3, by: 'B', ang: 70 },
  { t: T_BLOW, by: 'B', ang: 198, ccw: 1, e: 'in3' }, { t: 18.52, by: 'B', ang: 198 }, { t: 18.72, by: 'B', ang: 192 },
  { t: T_GIVE, by: 'B', ang: 186 }, { t: 19.5, by: 'B', ang: 198 }, { t: 20.2, by: 'B', ang: 205 },
]));

S.weapon('gun', wk([
  { t: 0, type: 'pistol', at: GUN0, ang: 180 },
  { t: T_GRAB, by: 'B', ang: 180, g: 0.1, two: 0 },
  { t: T_PEEL, by: 'B', ang: 172, e: 'snap' }, { t: 4.36, by: 'B', ang: 150 },
  { t: 4.5, by: 'B', ang: 30 }, { t: 4.6, by: 'B', ang: 42 }, { t: 4.72, by: 'B', ang: 20 }, { t: 4.84, by: 'B', ang: 46 },
  { t: T_LEVEL, by: 'B', ang: A1, e: 'snap' }, { t: 5.18, by: 'B', ang: A1 },
  ...gShot(SH1, A1),
  { t: 5.6, by: 'B', ang: 4 }, { t: 5.74, by: 'B', ang: 8, two: 1 }, { t: 5.92, by: 'B', ang: A2 + 5 },
  ...gShot(SH2, A2), { t: 6.38, by: 'B', ang: 17 }, ...gShot(SH3, A3),
  { t: 6.96, by: 'B', ang: A4 },
  ...gShot(SH4, A4),
  { t: 7.42, by: 'B', ang: -24, two: 0 }, { t: 7.66, by: 'B', ang: -10, two: 1 }, { t: 7.82, by: 'B', ang: A5 },
  ...gShot(SH5, A5, 4),
  { t: T_DEFLECT, by: 'B', ang: A5 + 1 }, { t: 9.14, by: 'B', ang: -12, two: 0 }, { t: 9.36, by: 'B', ang: A6, two: 1 },
  ...gShot(SH6, A6),
  { t: 9.82, by: 'B', ang: A6 }, { t: T_CLICK, by: 'B', ang: A6 - 4, e: 'snap' }, { t: 9.98, by: 'B', ang: A6 },
  { t: 10.14, by: 'B', ang: A6 + 1 }, { t: 10.2, by: 'B', ang: A6 - 5, e: 'snap' }, { t: 10.27, by: 'B', ang: A6 },
  { t: F(310), by: 'B', ang: A6 - 5, e: 'snap' }, { t: 10.4, by: 'B', ang: A6, two: 1 },
  { t: 10.54, by: 'B', ang: 84, two: 0 }, { t: 10.64, by: 'B', ang: 70 }, { t: 10.71, by: 'B', ang: 108 }, { t: 10.78, by: 'B', ang: 74 },
  { t: 10.88, by: 'B', ang: 140 }, { t: T_THROW - 0.01, by: 'B', ang: 24, e: 'in' },
  { t: T_THROW, at: [1025, 166], ang: 24 },
  { t: T_CATCH - 0.01, at: [1146, 163], ang: 200, cw: 1, turns: -1, hop: 30, e: 'lin' },
  { t: T_CATCH, by: 'A', hand: 'B', ang: 200, g: 0.1, two: 0 },
  { t: 11.24, by: 'A', ang: 196 }, { t: 11.32, by: 'A', ang: 104 },
  { t: 11.42, by: 'A', ang: 68 }, { t: 11.66, by: 'A', ang: 56 }, { t: 11.77, by: 'A', ang: 300, cw: 1 },
  { t: T_RELOAD, by: 'A', ang: 276, e: 'snap' }, { t: 12.02, by: 'A', ang: 274 },
  { t: T_INKED, by: 'A', ang: 275, ink: 1 },                       // loaded: an ink-black revolver from here on
  { t: 12.32, by: 'A', ang: 250 }, { t: 12.46, by: 'A', ang: A7, e: 'out' },
  { t: SH7, by: 'A', ang: A7 }, { t: SH7 + 0.05, by: 'A', ang: A7 - 26, e: 'snap' }, { t: SH7 + 0.22, by: 'A', ang: A7 - 2 },
  { t: 12.87, by: 'A', ang: A8 },
  { t: SH8, by: 'A', ang: A8 }, { t: SH8 + 0.05, by: 'A', ang: A8 - 26, e: 'snap' }, { t: SH8 + 0.22, by: 'A', ang: A8 - 2 },
  { t: 13.25, by: 'A', ang: A9 },
  { t: SH9, by: 'A', ang: A9 }, { t: SH9 + 0.05, by: 'A', ang: A9 - 24, e: 'snap' }, { t: SH9 + 0.22, by: 'A', ang: A9 - 4 },
  { t: 13.64, by: 'A', ang: 176 }, { t: 13.81, by: 'A', ang: 174 }, { t: T_SWAT - 0.01, by: 'A', ang: 172 },
  { t: T_SWAT, at: [1580, 202], ang: 172 },
  { t: 14.26, at: [GUN_REST[0], 27], ang: 180, ccw: 1, turns: 2, hop: 210, e: 'lin' },      // lies ON the floor: the grip hangs 25 below the axis
  { t: 14.33, at: [GUN_REST[0] + 4, 26], ang: 184, hop: 16 },
  { t: T_STOMP, at: [GUN_REST[0], 26], ang: 180 },
  { t: T_STOMP + 0.001, at: [GUN_REST[0], 26], ang: 180, gone: true },
]));

// ── the nine rounds ──────────────────────────────────────────────────────────
S.shot({ t: SH1, weapon: 'gun', to: P1 });
S.shot({ t: SH2, weapon: 'gun', to: [1370, 292], hit: 'prop' });
S.shot({ t: SH3, weapon: 'gun', to: TARGET, r: 17 });
S.shot({ t: SH4, weapon: 'gun', to: ST_NOSE, hit: 'spark' });
S.shot({ t: SH5, weapon: 'gun', to: P5, slug: [SH5, T_DEFLECT], hit: 'spark' });
S.shot({ t: SH6, weapon: 'gun', to: P6, hit: 'spark' });
S.shot({ t: SH7, weapon: 'gun', to: P7, hit: 'spark' });
S.shot({ t: SH8, weapon: 'gun', to: P8, hit: 'spark' });
S.shot({ t: SH9, weapon: 'gun', to: P9, r: 30, size: 1.2 });

// ricochets, fragments and the damage they do
const T_B1 = SH2 + 0.04, T_TGT = SH3 + 0.04, T_B2 = T_CUT + 0.05, T_JAR = T_SHELF + 0.36, T_PLANK = T_SHELF + 0.34;
const tracer = (t, a, b) => S.fx({ t, type: 'tracer', x: a[0], h: a[1], x2: b[0], h2: b[1] });
const floorHole = (t, from, x, r = 12) => {
  tracer(t, from, [x, FLOOR_H]);
  S.hole({ t: t + 0.04, x, h: FLOOR_H, r });
  S.fx({ t: t + 0.04, type: 'scraps', x, h: 4, n: 3, life: 0.6 });
  S.fx({ t: t + 0.04, type: 'dust', x, h: 0, n: 3, size: 0.5 });
  S.cue({ t: t + 0.04, type: 'bulletimpact', weight: 0.45, x });
};
tracer(SH4 + 0.04, P4, [INK_X, 62]);                                        // 4: stapler → ink bottle
tracer(T_DEFLECT, P5, [SHELF.xb, 250]);                                     // 5: blade → shelf
tracer(T_CUT, P6, [1520, 292]); floorHole(T_CUT, P6, PERF[2]);             // 6: two halves
floorHole(SH7 + 0.04, P7, PERF[0], 11); floorHole(SH7 + 0.04, P7, PERF[1], 12);
floorHole(SH8 + 0.04, P8, PERF[4], 12); floorHole(SH8 + 0.04, P8, PERF[5], 11);

// ── camera ───────────────────────────────────────────────────────────────────
S.camera([
  { t: 0, x: 1250, y: -330, z: 0.74 },                              // the gallery
  { t: 0.5, x: 1240, y: -322, z: 0.78, e: 'lin' },
  { t: 1.3, a: 0.5, b: 0.5, y: -170, z: 1.4, r: 0, e: 'io3' },
  { t: 1.56, a: 0.5, b: 0.5, y: -160, z: 1.55 },
  { t: 1.63, a: 0.5, b: 0.5, y: -160, z: 1.68, e: 'snap' },
  { t: 2.1, a: 0.5, b: 0.5, y: -165, z: 1.55 },
  { t: 2.44, a: 0.5, b: 0.5, y: -150, z: 1.6 },
  { t: 2.5, a: 0.5, b: 0.5, y: -140, z: 1.75, e: 'snap' },
  { t: 2.7, a: 0.5, b: 0.5, y: -150, z: 1.7 },
  { t: 2.77, a: 0.5, b: 0.5, y: -165, z: 1.95, e: 'snap' },
  { t: 3.12, a: 0.5, b: 0.5, y: -265, z: 1.15, e: 'out' },          // tilts up after the spear
  { t: 3.5, a: 0.5, b: 0.5, x: 30, y: -215, z: 1.25 },
  { t: 3.95, a: 0.3, b: 0.7, y: -170, z: 1.6 },
  { t: 4.2, b: 1, x: -64, y: -172, z: 2.3 },                        // the doodle
  { t: 4.4, b: 1, x: -56, y: -176, z: 2.4 },
  { t: 4.72, a: 0.5, b: 0.5, y: -165, z: 1.75, e: 'out' },
  { t: 4.95, a: 0.5, b: 0.5, y: -165, z: 1.8 },
  { t: 5.28, a: 0.5, b: 0.5, y: -172, z: 2.05, e: 'lin' },          // creeps in on the stand-off
  { t: 5.37, a: 0.5, b: 0.5, y: -172, z: 1.7, e: 'snap' },
  { t: 5.7, a: 0.65, b: 0.35, x: 30, y: -195, z: 1.5, r: -2, e: 'out' },       // whips after A — B keeps pace
  { t: 5.94, a: 0.6, b: 0.4, x: 20, y: -268, z: 1.5, r: -4 },                   // tilts up as he gains the shelf: B low left, A high right
  { t: SH2, a: 0.6, b: 0.4, x: 20, y: -272, z: 1.52, r: -4 },
  { t: SH2 + 0.08, a: 1, x: -60, y: -335, z: 1.85, r: -6, e: 'snap' },          // punch in: the bottle goes off at his heels
  { t: 6.28, a: 1, x: -40, y: -345, z: 1.75, r: -3, e: 'lin' },                 // rides his run along the plank
  { t: 6.43, x: 1420, y: -262, z: 1.28, r: 2, e: 'io' },                        // widens as he leaps: B, the round, the target
  { t: SH3 + 0.03, x: 1425, y: -265, z: 1.29, r: 2 },
  { t: SH3 + 0.1, x: 1915, y: -335, z: 1.9, r: 5, e: 'snap' },                  // punch in: the bullseye
  { t: 6.74, x: 1940, y: -290, z: 1.8, r: 4 },
  { t: 7.02, x: 1400, y: -215, z: 1.16, r: 0, e: 'io' },                        // back out for round four
  { t: 7.07, x: 1400, y: -215, z: 1.16 },
  { t: 7.17, x: 1600, y: -150, z: 1.5, e: 'snap' },                 // the ink bottle goes
  { t: 7.36, x: 1580, y: -160, z: 1.45 },
  { t: 7.62, a: 0.5, b: 0.5, y: -178, z: 1.3, e: 'io' },
  { t: 7.84, a: 0.5, b: 0.5, y: -178, z: 1.38 },
  { t: SH5, x: 980, y: -176, z: 1.75, e: 'io' },                    // bullet time: rides with the slug
  { t: 8.94, x: 1400, y: -178, z: 1.8, e: 'lin' },
  { t: T_DEFLECT, x: 1430, y: -184, z: 1.9 },
  { t: 9.12, x: 1380, y: -240, z: 1.2, e: 'snap' },
  { t: 9.5, a: 0.5, b: 0.5, y: -200, z: 1.3 },
  { t: 9.9, a: 0.5, b: 0.5, y: -165, z: 1.6 },
  { t: 10.45, a: 0.5, b: 0.5, y: -172, z: 2.0 },                    // the empty gun
  { t: 10.9, a: 0.45, b: 0.55, y: -174, z: 2.1, e: 'lin' },
  { t: 11.2, a: 0.5, b: 0.5, y: -165, z: 1.7, e: 'out' },
  { t: 11.66, a: 0.5, b: 0.5, y: -160, z: 1.5 },                     // B rips the spear out as A sprints for the ink
  { t: 11.8, a: 0.5, b: 0.5, y: -150, z: 1.5 },
  { t: 11.89, x: 1528, y: -64, z: 3.0, r: -4, e: 'snap' },           // insert: the muzzle goes into the ink
  { t: T_INKED, x: 1534, y: -74, z: 3.3, r: -8, e: 'lin' },          // creeps in, rolling, as the ink runs up the barrel
  { t: 12.34, a: 0.5, b: 0.5, y: -160, z: 1.5, r: 0, e: 'out' },
  { t: 12.5, a: 0.5, b: 0.5, y: -158, z: 1.55 },
  { t: SH7 + 0.04, a: 0.45, b: 0.55, y: -160, z: 1.6 },
  { t: SH7 + 0.1, a: 0.3, b: 0.7, y: -165, z: 1.95, r: 3, e: 'snap' },     // punch in on the block
  { t: 12.86, a: 0.5, b: 0.5, y: -155, z: 1.6, r: 0 },
  { t: SH8 + 0.04, a: 0.45, b: 0.55, y: -150, z: 1.65 },
  { t: SH8 + 0.1, a: 0.3, b: 0.7, y: -128, z: 2.0, r: -3, e: 'snap' },
  { t: 13.24, a: 0.5, b: 0.5, y: -140, z: 1.7, r: 0 },
  { t: SH9 + 0.03, a: 0.5, b: 0.5, y: -135, z: 1.7 },
  { t: SH9 + 0.1, a: 0.3, b: 0.7, x: 30, y: -84, z: 2.1, r: 2, e: 'snap' },    // the floor goes at his feet
  { t: 13.55, a: 0.3, b: 0.7, x: 30, y: -92, z: 2.1, r: 2 },
  { t: 13.84, a: 0.5, b: 0.5, y: -160, z: 1.8, r: 0 },
  { t: 13.94, a: 0.5, b: 0.5, y: -170, z: 2.05, e: 'snap' },         // the swat
  { t: 14.34, x: 1450, y: -100, z: 2.1 },
  { t: T_STOMP, x: 1450, y: -74, z: 2.5, e: 'in' },                  // the stomp
  { t: 14.7, x: 1452, y: -70, z: 2.6, r: -2 },
  { t: 14.98, x: 1448, y: -66, z: 2.75, r: -3, e: 'lin' },           // holds on what is left of it as the foot comes off
  { t: 15.2, a: 0.5, b: 0.5, y: -165, z: 1.55, r: 0, e: 'io' },
  { t: 15.36, a: 0.5, b: 0.5, y: -175, z: 1.5 },
  { t: 15.42, a: 0.5, b: 0.5, y: -150, z: 1.65, e: 'snap' },
  { t: 15.9, a: 0.5, b: 0.5, y: -160, z: 1.6 },
  { t: 16.3, a: 0.5, b: 0.5, y: -145, z: 1.5, e: 'out' },
  { t: 16.58, a: 0.5, b: 0.5, y: -155, z: 1.7 },
  { t: 16.64, a: 0.5, b: 0.5, y: -155, z: 1.9, e: 'snap' },
  { t: 17.1, a: 0.5, b: 0.5, y: -130, z: 1.95 },
  { t: 17.45, a: 0.5, b: 0.5, y: -100, z: 2.1, e: 'lin' },          // down to the floor: the holes are joining up
  { t: 17.9, a: 0.5, b: 0.5, y: -200, z: 1.35, e: 'out' },
  { t: 18.36, a: 0.5, b: 0.5, y: -215, z: 1.3 },
  { t: 18.44, x: 1170, y: -120, z: 1.6, e: 'snap' },
  { t: 18.52, x: 1180, y: -78, z: 2.0, r: 2 },                       // drops to the floor: the tear running hole to hole
  { t: 18.8, x: 1290, y: -66, z: 2.1, r: -2, e: 'lin' },             // …and tracks it toward the ink
  { t: 19.12, x: 1170, y: -100, z: 1.28, r: 0, e: 'out' },           // out as the right end rips loose and the sheet peels away
  { t: 20.2, x: 1160, y: -34, z: 1.3, e: 'io' },
]);

S.impact(T_DISARM, 0.07);
S.impact(T_INK, 0.06);
let NOW = 0;   // set by the page hook at the top of every frame, read by the slow-motion focus in the same frame
S.slowmo(SH5 + 0.03, T_DEFLECT - 0.02, () => [lerp(960, P5[0], prog(NOW, SH5, T_DEFLECT)), lerp(170, P5[1], prog(NOW, SH5, T_DEFLECT))]);
S.musicHint(4.9, SH1, 'suspend');
S.musicHint(T_CLICK, 10.9, 'suspend');
S.musicHint(T_BLOW, 20, 'aftermath');

// ── contacts, effects, sound (in story order) ────────────────────────────────
S.whoosh({ t: 0.08, x: 1000, size: 'l', dur: 0.5 });
S.land({ t: 0.62, x: 1196, weight: 0.4 });
S.land({ t: 0.74, x: 800, weight: 0.95 });
S.fx({ t: 0.74, type: 'ring', x: 800, h: 0, size: 0.8 });
S.whoosh({ t: 1.24, x: 820, size: 's' });
S.whoosh({ t: 1.5, x: 860, size: 'm' });
S.hit({ t: 1.6, x: 1172, h: 166, sound: 'clang', weight: 0.6, size: 0.8 });
S.whoosh({ t: 1.82, x: 1150, size: 'm' });
S.hit({ t: 1.9, x: 925, h: 200, sound: 'clang', weight: 0.7, size: 0.9 });
S.whoosh({ t: 2.12, x: 930, size: 'm' });
S.whoosh({ t: 2.16, x: 1130, size: 's' });
S.cue({ t: 2.2, type: 'slice', weight: 0.5, x: 1080 });
S.fx({ t: 2.2, type: 'dust', x: 1120, n: 4, size: 0.7 });
S.whoosh({ t: 2.38, x: 1110, size: 'm' });
S.hit({ t: 2.46, x: 1004, h: 36, sound: 'clang', weight: 0.9, size: 1.1 });
S.fx({ t: 2.46, type: 'dust', x: 1060, n: 6, size: 0.9 });
S.whoosh({ t: 2.64, x: 1080, size: 'l', dur: 0.1 });
S.hit({ t: T_DISARM, x: 1080, h: 246, sound: 'clang', weight: 1, size: 1.4, shock: true });
S.whoosh({ t: 2.78, x: 1000, size: 'l', dur: 0.6 });
S.step({ t: 2.94, x: 800, weight: 0.5 }); S.step({ t: 3.12, x: 720, weight: 0.45 }); S.step({ t: 3.3, x: 652, weight: 0.45 });
S.step({ t: 3.52, x: 610, weight: 0.4 }); S.step({ t: 3.76, x: 590, weight: 0.4 });
S.step({ t: 3.15, x: 1010, weight: 0.25 }); S.step({ t: 3.35, x: 930, weight: 0.25 }); S.step({ t: 3.55, x: 900, weight: 0.25 });
S.hit({ t: T_STICK, x: SPEAR_X + 18, h: 6, sound: 'slam', weight: 0.6, size: 0.8, shake: 10 });
S.cue({ t: T_STICK + 0.02, type: 'crack', dur: 0.2, x: SPEAR_X });
S.cue({ t: T_STICK + 0.05, type: 'shing', dur: 0.4, x: SPEAR_X, gain: 0.5 });
S.hit({ t: T_BUMP, x: 534, h: 120, sound: 'block', weight: 0.4, size: 0.5 });
S.whoosh({ t: 4.06, x: 580, size: 's' });
S.cue({ t: T_GRAB, type: 'draw', dur: 0.14, x: 480 });
S.cue({ t: T_PEEL, type: 'pop', x: 480 });
S.cue({ t: T_PEEL, type: 'tear', dur: 0.12, x: 480, gain: 0.6 });
S.fx({ t: T_PEEL, type: 'scraps', x: 470, h: 170, n: 4, life: 0.7 });
S.whoosh({ t: 4.42, x: 590, size: 's' });
S.step({ t: 4.52, x: 794, weight: 0.3 });
S.whoosh({ t: 4.9, x: 660, size: 's' });
S.cue({ t: 4.95, type: 'riser', dur: 0.34 });
S.whoosh({ t: 5.24, x: 890, size: 's' });
S.cue({ t: SH1 + 0.01, type: 'bulletwhiz', x: 946 });
S.step({ t: 5.53, x: 1040, weight: 0.3 }); S.step({ t: 5.6, x: 1110, weight: 0.3 }); S.step({ t: 5.66, x: 1180, weight: 0.3 });
S.whoosh({ t: 5.72, x: 1240, size: 'm' });
S.land({ t: 5.92, x: 1340, h: 250, weight: 0.32 });
S.step({ t: 5.74, x: 749, weight: 0.6 }); S.step({ t: 5.92, x: 851, weight: 0.65 });
S.step({ t: 5.99, x: 1402, h: 250, weight: 0.3 }); S.step({ t: SH2, x: 1466, h: 250, weight: 0.3 });
S.step({ t: 6.2, x: 1578, h: 250, weight: 0.3 }); S.step({ t: 6.26, x: 1640, h: 250, weight: 0.3 }); S.step({ t: 6.31, x: 1700, h: 250, weight: 0.4 });
S.cue({ t: T_B1, type: 'shatter', x: 1370 });
S.cue({ t: SH2 + 0.02, type: 'bulletwhiz', x: 1300 });
S.cue({ t: SH3 + 0.02, type: 'bulletwhiz', x: 1800 });
S.cue({ t: SH4 + 0.02, type: 'bulletwhiz', x: 1500 });
S.whoosh({ t: 6.34, x: 1760, size: 'l', dur: 0.46 });
S.fx({ t: T_TGT, type: 'sparks', x: TARGET[0], h: TARGET[1], n: 10, size: 0.8 });
S.fx({ t: T_TGT, type: 'burst', x: TARGET[0], h: TARGET[1], size: 1.1 });
S.fx({ t: T_TGT, type: 'shock', x: TARGET[0], h: TARGET[1], size: 0.7 });
S.fx({ t: T_TGT, type: 'scraps', x: TARGET[0], h: TARGET[1], n: 9, life: 0.9 });
S.cue({ t: T_TGT, type: 'clack', weight: 0.7, x: TARGET[0] });
S.cue({ t: T_TGT + 0.02, type: 'crack', dur: 0.25, x: TARGET[0] });
S.shake(T_TGT, 9, 0.2);
S.land({ t: 6.86, x: 2000, weight: 0.4 });
S.hit({ t: SH4 + 0.04, x: ST_NOSE[0], h: ST_NOSE[1], sound: 'clack', weight: 0.6, size: 0.8 });
S.hit({ t: T_INK, x: INK_X, h: 60, sound: null, size: 1.7, shake: 20 });
S.fx({ t: T_INK, type: 'splash', x: INK_X, h: 56, n: 34, size: 1.7, dir: 0 });
S.fx({ t: T_INK, type: 'splash', x: INK_X, h: 30, n: 14, size: 1.1, dir: -1 });
S.fx({ t: T_INK, type: 'splash', x: INK_X, h: 30, n: 14, size: 1.1, dir: 1 });
S.cue({ t: T_INK, type: 'inksplash', weight: 1, x: INK_X });
S.cue({ t: T_INK, type: 'shatter', x: INK_X });
S.step({ t: 7.36, x: 1950, weight: 0.3 }); S.step({ t: 7.46, x: 1850, weight: 0.3 }); S.step({ t: 7.56, x: 1740, weight: 0.3 });
S.fx({ t: 7.66, type: 'splash', x: 1640, h: 2, n: 7, size: 0.55, dir: 0 });
S.cue({ t: 7.66, type: 'inksplash', weight: 0.25, x: 1640 });
S.fx({ t: 7.76, type: 'splash', x: 1580, h: 2, n: 7, size: 0.55, dir: -1 });
S.cue({ t: 7.76, type: 'inksplash', weight: 0.2, x: 1590 });
S.cue({ t: 8.2, type: 'heartbeat' }); S.cue({ t: 8.66, type: 'heartbeat' });
S.hit({ t: T_DEFLECT, x: P5[0], h: P5[1], sound: 'clang', weight: 1, size: 1.5, impact: 0.05, shock: true });
S.cue({ t: T_SHELF, type: 'snap', x: SHELF.xb });
S.cue({ t: T_SHELF + 0.02, type: 'crack', dur: 0.3, x: SHELF.xb });
S.fx({ t: T_SHELF, type: 'scraps', x: SHELF.xb, h: 250, n: 6, life: 0.8 });
S.fx({ t: T_SHELF, type: 'burst', x: SHELF.xb, h: 248, size: 0.9 });
S.hit({ t: T_PLANK, x: 1700, h: 116, sound: 'clack', weight: 0.8, size: 0.9 });
S.cue({ t: T_JAR, type: 'shatter', x: 1720 });
S.cue({ t: T_JAR + 0.05, type: 'shatter', x: 1660 });
S.cue({ t: T_SHELF + 0.5, type: 'clack', weight: 0.3, x: 1632 });
S.fx({ t: T_SHELF + 0.5, type: 'splash', x: 1632, h: 2, n: 6, size: 0.5, dir: 0 });
S.fx({ t: 9.2, type: 'splash', x: 1545, h: 2, n: 6, size: 0.5, dir: 1 });
S.step({ t: 9.2, x: 1545, weight: 0.35 }); S.step({ t: 9.29, x: 1470, weight: 0.35 }); S.step({ t: 9.38, x: 1395, weight: 0.35 }); S.step({ t: 9.46, x: 1340, weight: 0.35 });
S.whoosh({ t: 9.44, x: 1300, size: 'm', dur: 0.1 });
S.cue({ t: T_CUT, type: 'slice', weight: 0.9, x: 1160 });
S.cue({ t: T_B2, type: 'shatter', x: 1520 });
S.step({ t: 9.63, x: 1236, weight: 0.35 }); S.step({ t: 9.72, x: 1190, weight: 0.35 }); S.step({ t: 9.82, x: 1156, weight: 0.35 });
S.cue({ t: T_CLICK, type: 'dryfire', x: 880 });
S.skid({ t0: 9.86, t1: 10.04, x0: 1215, x1: 1184 });
S.cue({ t: 10.2, type: 'dryfire', x: 880 });
S.cue({ t: F(310), type: 'dryfire', x: 880 });
S.cue({ t: 10.66, type: 'shell', x: 800 }); S.cue({ t: 10.74, type: 'shell', x: 800 });
S.whoosh({ t: 10.88, x: 760, size: 'm' });
S.whoosh({ t: T_THROW, x: 1000, size: 'l', dur: 0.16 });
S.hit({ t: T_CATCH, x: 1160, h: 172, sound: 'block', weight: 0.45, size: 0.5 });
S.whoosh({ t: 11.4, x: 1200, size: 's' });
S.step({ t: 11.36, x: 960, weight: 0.6 }); S.step({ t: 11.5, x: 1012, weight: 0.6 });
S.step({ t: 11.5, x: 1250, weight: 0.3 }); S.step({ t: 11.58, x: 1312, weight: 0.3 }); S.step({ t: 11.66, x: 1374, weight: 0.3 });
S.skid({ t0: 11.68, t1: 11.84, x0: 1380, x1: 1444 });
S.cue({ t: 11.56, type: 'block', weight: 0.3, x: SPEAR_X });
S.cue({ t: T_YANK, type: 'shing', dur: 0.3, x: SPEAR_X });
S.cue({ t: T_YANK, type: 'crack', dur: 0.15, x: SPEAR_X });
S.fx({ t: T_YANK, type: 'scraps', x: SPEAR_X + 18, h: 4, n: 4, life: 0.7 });
S.whoosh({ t: T_YANK, x: SPEAR_X, size: 'm' });
S.whoosh({ t: 11.76, x: SPEAR_X, size: 'm', heavy: true });
S.cue({ t: T_RELOAD, type: 'reload', x: 1540 });
S.cue({ t: T_RELOAD, type: 'inksplash', weight: 0.4, x: 1545 });
S.fx({ t: T_RELOAD, type: 'splash', x: 1547, h: 6, n: 10, size: 0.6, dir: 0 });
S.cue({ t: 11.94, type: 'scribble', dur: 0.24, x: 1545, gain: 0.7 });                // the ink climbing the barrel
S.cue({ t: T_INKED, type: 'pop', x: 1545 });
S.fx({ t: 12.3, type: 'splash', x: 1480, h: 110, n: 6, size: 0.4, dir: -1 });        // it comes up dripping
// A's rounds are ink: each one spits a few drops from the muzzle
S.fx({ t: SH7, type: 'splash', x: 1347, h: 136, n: 7, size: 0.5, dir: -1 });
S.fx({ t: SH8, type: 'splash', x: 1367, h: 136, n: 7, size: 0.5, dir: -1 });
S.fx({ t: SH9, type: 'splash', x: 1404, h: 82, n: 7, size: 0.5, dir: -1 });
// B comes on: three heavy steps, the shaft set for each round
S.whoosh({ t: 12.1, x: 1040, size: 'm', heavy: true });
S.land({ t: 12.26, x: 1105, weight: 0.75 });
S.cue({ t: 12.42, type: 'block', weight: 0.4, x: 1130 });
S.hit({ t: SH7 + 0.04, x: P7[0], h: P7[1], sound: 'clang', weight: 0.85, size: 1.1, shock: true });
S.whoosh({ t: 12.8, x: 1150, size: 'm', heavy: true });
S.land({ t: 12.92, x: 1195, weight: 0.8 });
S.hit({ t: SH8 + 0.04, x: P8[0], h: P8[1], sound: 'clang', weight: 0.85, size: 1.1, shock: true });
S.whoosh({ t: 13.22, x: 1180, size: 's' });
S.fx({ t: SH9 + 0.04, type: 'scraps', x: P9[0], h: 4, n: 14 });
S.fx({ t: SH9 + 0.04, type: 'dust', x: P9[0], h: 0, n: 9, size: 1.3 });
S.cue({ t: SH9 + 0.04, type: 'crumble', dur: 0.4, x: P9[0] });
S.cue({ t: SH9 + 0.05, type: 'clack', weight: 0.3, x: P9[0] });
S.shake(SH9 + 0.04, 14, 0.25);
S.whoosh({ t: 13.54, x: 1240, size: 'm', heavy: true });
S.land({ t: 13.64, x: 1335, weight: 0.9 });
S.step({ t: 13.78, x: 1440, weight: 0.8 });
S.whoosh({ t: 13.8, x: 1400, size: 'm', heavy: true });
S.hit({ t: T_SWAT, x: 1582, h: 208, sound: 'clang', weight: 0.8, size: 1 });
S.cue({ t: 14.26, type: 'clack', weight: 0.35, x: GUN_REST[0] });
S.cue({ t: 14.33, type: 'shell', x: GUN_REST[0] });
S.whoosh({ t: 14.28, x: 1410, size: 's' });
S.hit({ t: T_STOMP, x: GUN_REST[0], h: 4, sound: 'slam', weight: 1, size: 1.4, impact: 0.06, ring: true });
S.cue({ t: T_STOMP, type: 'snap', x: GUN_REST[0] });
S.fx({ t: T_STOMP, type: 'sparks', x: GUN_REST[0], h: 6, n: 12, size: 0.9, dir: 0 });
S.fx({ t: T_STOMP, type: 'splash', x: GUN_REST[0], h: 6, n: 24, size: 1.1, dir: 0 });   // the ink it was loaded with
S.cue({ t: T_STOMP, type: 'inksplash', weight: 0.7, x: GUN_REST[0] });
S.cue({ t: 14.62, type: 'crack', dur: 0.22, x: GUN_REST[0], gain: 0.7 });               // grinds it
S.cue({ t: 14.62, type: 'skid', dur: 0.12, x: GUN_REST[0], gain: 0.5 });
S.whoosh({ t: 14.76, x: 1420, size: 's' });                                             // the foot comes off
S.step({ t: 14.94, x: 1300, weight: 0.5 });
S.whoosh({ t: 15.22, x: 1420, size: 'l', heavy: true });
S.whoosh({ t: 15.3, x: 1660, size: 's' });
S.hit({ t: T_SLAM1, x: 1690, h: 4, sound: 'slam', weight: 0.9, size: 1.3, ring: true });
S.cue({ t: T_SLAM1 + 0.02, type: 'crack', dur: 0.3, x: 1690 });
S.whoosh({ t: 15.54, x: 1660, size: 'm' });
S.hit({ t: 15.62, x: 1540, h: 190, sound: 'clang', weight: 0.8, size: 1 });
S.whoosh({ t: 15.9, x: 1500, size: 'l', dur: 0.14 });
S.cue({ t: 16.0, type: 'slice', weight: 0.6, x: 1650 });
S.skid({ t0: 15.98, t1: 16.3, x0: 1590, x1: 1300 });
S.whoosh({ t: 16.3, x: 1280, size: 's' });
S.whoosh({ t: 16.36, x: 1490, size: 'm' });
S.whoosh({ t: 16.52, x: 1300, size: 'm' });
S.hit({ t: 16.6, x: 1476, h: 76, sound: 'clang', weight: 1, size: 1.3, shock: true });
S.cue({ t: 16.9, type: 'skid', dur: 0.3, x: 1380, gain: 0.5 });
S.skid({ t0: 17.02, t1: 17.18, x0: 1250, x1: 1226 });
S.cue({ t: T_CRACK, type: 'crack', dur: 0.5, x: 1300 });
S.cue({ t: 17.3, type: 'tear', dur: 0.25, x: 1300, gain: 0.6 });
S.whoosh({ t: 17.46, x: 1420, size: 'm', heavy: true });
S.hit({ t: 17.52, x: 1330, h: 150, sound: 'block', weight: 0.8, size: 1 });
S.land({ t: 17.8, x: 1130, weight: 0.4 });
S.skid({ t0: 17.8, t1: 17.96, x0: 1130, x1: 1094 });
S.cue({ t: 17.82, type: 'riser', dur: 0.56 });
S.whoosh({ t: 18.24, x: 1100, size: 'm' });
S.whoosh({ t: 18.28, x: 1400, size: 'l', dur: 0.14, heavy: true });
S.hit({ t: T_BLOW, x: X_BLOW, h: 4, sound: null, size: 2.4, impact: 0.09, ring: true, shake: 46 });
S.cue({ t: T_BLOW, type: 'megaimpact', x: X_BLOW });
S.cue({ t: T_BLOW + 0.03, type: 'tear', dur: 0.7, x: X_BLOW });
S.cue({ t: T_BLOW + 0.05, type: 'crack', dur: 0.5, x: X_BLOW });
S.fx({ t: T_BLOW, type: 'scraps', x: X_BLOW, h: 4, n: 16 });
S.fx({ t: T_BLOW, type: 'dust', x: X_BLOW, h: 0, n: 12, size: 1.5 });
for (const [dt, x] of [[0.04, PERF[1]], [0.06, PERF[0]], [0.1, PERF[2]], [0.16, PERF[3]], [0.22, PERF[4]], [0.28, PERF[5]]]) {
  S.cue({ t: T_BLOW + dt, type: 'crack', dur: 0.07, x, gain: 0.6 });                   // the tear snaps from hole to hole
  S.fx({ t: T_BLOW + dt, type: 'scraps', x, h: 4, n: 2, life: 0.5 });
}
S.land({ t: 18.54, x: 960, weight: 0.35 });
S.cue({ t: 18.56, type: 'tear', dur: 0.5, x: 700 });
S.cue({ t: 18.6, type: 'rumble', dur: 1.3 });
S.fx({ t: 18.7, type: 'scraps', x: 800, h: 4, n: 8 });
S.fx({ t: 18.75, type: 'scraps', x: 1450, h: 4, n: 8 });
S.cue({ t: T_GIVE, type: 'tear', dur: 0.9, x: 1100 });
S.cue({ t: T_GIVE, type: 'crack', dur: 0.25, x: XR });                                // the right end rips loose
S.fx({ t: T_GIVE, type: 'scraps', x: XR - 20, h: 0, n: 7 });
S.fx({ t: T_GIVE + 0.05, type: 'splash', x: 1600, h: 0, n: 10, size: 0.7, dir: 1 }); // the ink goes with it
S.cue({ t: T_GIVE + 0.05, type: 'inksplash', weight: 0.35, x: 1600 });
S.cue({ t: 19.0, type: 'crumble', dur: 0.6, x: 1100 });
S.fx({ t: 19.0, type: 'scraps', x: 1150, h: -10, n: 14 });
S.whoosh({ t: 19.15, x: 1150, size: 'l', dur: 0.8 });
S.shake(T_GIVE, 12, 0.6);

// ── environment ──────────────────────────────────────────────────────────────
const fillPoly = (ctx, pts, color) => {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
};
const rot = (p, c, a) => { const cs = Math.cos(a), sn = Math.sin(a), x = p[0] - c[0], y = p[1] - c[1]; return [c[0] + x * cs - y * sn, c[1] + x * sn + y * cs]; };

// the tear: it runs from hole to hole (dwelling at each, snapping to the next) and on to the margin and
// the ink; the freed sheet sags between its two ends; then the right end rips loose and the sheet peels
// down, hinged on the margin, its top edge curling over as it goes.
function tearFront(tab, tau) {
  if (tau <= 0) return tab[0][1];
  for (let i = 1; i < tab.length; i++) {
    if (tau < tab[i][0]) { const a = tab[i - 1], b = tab[i], u = (tau - a[0]) / (b[0] - a[0]); return lerp(a[1], b[1], u * u * u); }
  }
  return tab[tab.length - 1][1];
}
function tearState(t) {
  if (t < T_BLOW) return null;
  const tau = t - T_BLOW, fall = Math.max(0, t - T_GIVE);
  const zl = tearFront(TEAR_L, tau), zr = tearFront(TEAR_R, tau);
  return {
    zl, zr,
    belly: (4 + 28 * EASE.io(prog(t, T_BLOW + 0.05, T_GIVE))) * Math.min(1, (zr - zl) / 700),
    drop: 0.5 * 628 * fall * fall,
    curl: 54 * EASE.out(prog(t, T_GIVE - 0.12, T_GIVE + 0.8)),
  };
}
function sag(x, t) {
  const s = tearState(t);
  if (!s || x <= s.zl || x > s.zr) return 0;
  const u = (x - s.zl) / (s.zr - s.zl);
  return s.belly * Math.pow(Math.sin(Math.PI * u), 0.8) + s.drop * Math.pow(u, 0.8);
}
/** put the drawing frame onto the freed sheet at x: down by its sag, tilted to its slope */
function ride(ctx, x, t) {
  const s = tearState(t);
  if (!s || x <= s.zl || x > s.zr) return;
  const xa = Math.max(s.zl + 1, x - 40), xb = Math.min(s.zr, x + 40);
  ctx.translate(x, sag(x, t));
  ctx.rotate(Math.atan2(sag(xb, t) - sag(xa, t), xb - xa));
  ctx.translate(-x, 0);
}
const edgeY = (x) => 2 + (hash(Math.round(x / 20) * 3.1) - 0.5) * 6;

function drawGrid(ctx, vb, px) {
  const xa = Math.max(PAGE.x0 + 6, vb.x0), xb = Math.min(PAGE.x1 - 6, vb.x1);
  const ya = Math.max(PAGE.y0 + 6, vb.y0), yb = Math.min(PAGE.y1 - 6, vb.y1);
  if (xb <= xa || yb <= ya) return;
  for (const major of [false, true]) {
    ctx.beginPath();
    for (let x = Math.ceil(xa / GRID) * GRID; x <= xb; x += GRID) {
      if ((((Math.round(x / GRID) % 5) + 5) % 5 === 0) !== major) continue;
      ctx.moveTo(x, ya); ctx.lineTo(x, yb);
    }
    for (let y = Math.ceil(ya / GRID) * GRID; y <= yb; y += GRID) {
      if ((((Math.round(y / GRID) % 5) + 5) % 5 === 0) !== major) continue;
      ctx.moveTo(xa, y); ctx.lineTo(xb, y);
    }
    ctx.lineWidth = major ? Math.max(1.3, 2.3 * px) : Math.max(0.7, 1.4 * px);
    ctx.strokeStyle = BLACK;
    ctx.stroke();
  }
}

function drawMargin(ctx, t, px) {
  const k = t > T_BUMP && t < T_BUMP + 0.45 ? Math.sin((t - T_BUMP) * 46) * 7 * (1 - (t - T_BUMP) / 0.45) : 0;
  for (const mx of [MARGIN - 4, MARGIN + 4]) {
    const pts = [];
    for (let y = PAGE.y0 + 6; y <= PAGE.y1 - 6; y += 40) {
      const b = Math.max(0, 1 - Math.abs(y + 120) / 170);
      pts.push([mx - k * b, y]);
    }
    stroke(ctx, pts, Math.max(1.5, 1.1 * px));
  }
}

// doodles in the margin: the revolver's dashed ghost once it has been peeled off, tally marks, bang-lines
const PISTOL_PARTS = [
  [[30, -6], [74, -6], [74, 3], [30, 3]], [[4, -7], [32, -7], [32, 9], [22, 9], [18, 4], [4, 4]],
  [[2, 2], [16, 4], [9, 31], [-7, 28]], [[14, -9], [31, -9], [31, 8], [14, 8]],
];
function drawGunDoodle(ctx, t) {
  // bang-lines off the muzzle and a little star: someone was bored in class
  const mx = GUN0[0] - 37, my = -GUN0[1];
  ctx.beginPath();
  for (const [a, r0, r1] of [[180, 10, 26], [205, 12, 24], [155, 12, 24], [228, 14, 22], [132, 14, 22]]) {
    ctx.moveTo(mx + Math.cos(a * DEG) * r0, my - 4 + Math.sin(a * DEG) * r0);
    ctx.lineTo(mx + Math.cos(a * DEG) * r1, my - 4 + Math.sin(a * DEG) * r1);
  }
  ctx.lineWidth = 1.6; ctx.strokeStyle = BLACK; ctx.lineCap = 'round'; ctx.stroke();
  // tally of earlier shots
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const x = 424 + i * 9 + Math.floor(i / 5) * 12, y = -252;
    if (i % 5 === 4) { ctx.moveTo(x - 40, y - 4); ctx.lineTo(x, y - 24); } else { ctx.moveTo(x, y); ctx.lineTo(x + 2, y - 28); }
  }
  ctx.lineWidth = 1.8; ctx.stroke();
  if (t < T_GRAB) return;
  // the ghost it leaves behind
  const p = prog(t, T_GRAB, T_PEEL + 0.05);
  ctx.save();
  ctx.translate(GUN0[0] + 37, -GUN0[1]);
  ctx.rotate(Math.PI);
  ctx.scale(1, -1);
  ctx.setLineDash([5, 4.5]);
  ctx.lineWidth = 1.5; ctx.strokeStyle = BLACK;
  for (const q of PISTOL_PARTS) {
    ctx.beginPath();
    q.forEach((v, i) => (i ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1])));
    ctx.closePath();
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
  if (p < 1) return;
  // curled paper edge where it was lifted
  const f = [[GUN0[0] + 30, -GUN0[1] - 12], [GUN0[0] + 46, -GUN0[1] - 22], [GUN0[0] + 40, -GUN0[1] - 2]];
  sketchPoly(ctx, f, { w: 1.5, seed: 31, fill: WHITE, rough: 0.5 });
  hatch(ctx, f, { angle: 60, gap: 3.5, w: 0.9, seed: 32 });
}

// ── shards (glass, staples, splinters): fly, land, stay ──
const SHARDS = [];
function addShards(t, x, y, n, seed, o = {}) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * (0.08 + r() * 0.84), v = (o.v || 340) * (0.35 + r());
    const sh = { t, x: x + (r() - 0.5) * (o.sx ?? 16), y: y + (r() - 0.5) * (o.sy ?? 36), vx: Math.cos(a) * v + (o.vx || 0), vy: Math.sin(a) * v, s: 3.5 + r() * (o.s || 7), om: (r() - 0.5) * 30, floor: o.floor ?? 0, kind: o.kind || 'glass', seed: seed + i };
    const dy = Math.max(1, sh.floor - 3 - sh.y);
    sh.tl = (-sh.vy + Math.sqrt(sh.vy * sh.vy + 4400 * dy)) / 2200;
    sh.lx = sh.x + sh.vx * sh.tl;
    sh.rr = (r() - 0.5) * 0.8;
    SHARDS.push(sh);
  }
}
addShards(T_B1, 1370, -292, 9, 410, { vx: 150 });
addShards(T_JAR, 1664, -116, 9, 430, { vx: -30, v: 280, sy: 10 });
addShards(T_B2, 1520, -292, 9, 450, { vx: 120 });
addShards(T_JAR, 1722, -112, 10, 470, { vx: -40, v: 260, sy: 10 });
addShards(T_INK, INK_X, -70, 12, 490, { v: 420, s: 9 });
addShards(SH4 + 0.05, ST_NOSE[0] + 10, -ST_NOSE[1] + 14, 9, 510, { vx: -30, v: 230, s: 3, kind: 'staple', sy: 10 });
addShards(T_SHELF, SHELF.xb, -246, 6, 530, { v: 260, s: 6, kind: 'wood' });
addShards(T_STOMP, GUN_REST[0], -8, 7, 550, { v: 300, s: 4, kind: 'staple', sy: 6 });
function drawShards(ctx, t, flying) {
  for (const s of SHARDS) {
    if (t < s.t) continue;
    const tau = t - s.t, fl = tau < s.tl;
    if (fl !== flying) continue;
    let x, y, a;
    if (fl) { x = s.x + s.vx * tau; y = s.y + s.vy * tau + 1100 * tau * tau; a = s.om * tau; } else { x = s.lx; y = s.floor - 3 + sag(s.lx, t); a = s.rr; }
    const c = Math.cos(a), sn = Math.sin(a), k = s.s;
    const P = (u, v) => [x + u * c - v * sn, y + u * sn + v * c];
    if (s.kind === 'staple') {
      stroke(ctx, [P(-k, k * 0.8), P(-k, -k * 0.4), P(k, -k * 0.4), P(k, k * 0.8)], 1.7);
    } else if (s.kind === 'wood') {
      stroke(ctx, [P(-k * 1.6, 0), P(k * 1.6, 0)], 3);
    } else {
      ctx.beginPath();
      const q = [P(-k, k * 0.6), P(k, k * 0.4), P(k * 0.1, -k)];
      ctx.moveTo(q[0][0], q[0][1]); ctx.lineTo(q[1][0], q[1][1]); ctx.lineTo(q[2][0], q[2][1]); ctx.closePath();
      ctx.fillStyle = WHITE; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = BLACK; ctx.lineJoin = 'round'; ctx.stroke();
    }
  }
}

// ── the shelf and what stands on it ──
function drawBottle(ctx, x, yb, seed) {
  const pts = [[-13, 0], [13, 0], [13, -50], [5, -64], [5, -80], [-5, -80], [-5, -64], [-13, -50]].map((p) => [x + p[0], yb + p[1]]);
  sketchPoly(ctx, pts, { w: 2, seed, fill: WHITE, rough: 0.5 });
  hatch(ctx, [[x + 4, yb - 2], [x + 13, yb - 2], [x + 13, yb - 50], [x + 4, yb - 50]], { angle: 62, gap: 3.6, w: 1, seed: seed + 1 });
  stroke(ctx, [[x - 7, yb - 82], [x + 7, yb - 82]], 4);
  sketchPoly(ctx, [[x - 13, yb - 36], [x + 4, yb - 36], [x + 4, yb - 16], [x - 13, yb - 16]], { w: 1.2, seed: seed + 2, rough: 0.4 });
}
function drawStump(ctx, x, yb, seed) {
  const pts = [[-13, 0], [13, 0], [13, -19], [8, -10], [3, -24], [-3, -9], [-8, -21], [-13, -12]].map((p) => [x + p[0], yb + p[1]]);
  sketchPoly(ctx, pts, { w: 2, seed, fill: WHITE, rough: 0.4 });
  hatch(ctx, [[x + 4, yb - 1], [x + 13, yb - 1], [x + 13, yb - 12], [x + 4, yb - 12]], { angle: 62, gap: 3.6, w: 1, seed: seed + 1 });
}
function drawCan(ctx, x, yb, seed, a = 0) {
  ctx.save();
  ctx.translate(x, yb);
  ctx.rotate(a);
  sketchPoly(ctx, [[-15, 0], [15, 0], [15, -42], [-15, -42]], { w: 2, seed, fill: WHITE, rough: 0.5 });
  stroke(ctx, [[-15, -7], [15, -7]], 1.3);
  stroke(ctx, [[-15, -35], [15, -35]], 1.3);
  hatch(ctx, [[5, -8], [15, -8], [15, -34], [5, -34]], { angle: 90, gap: 3, w: 1, seed: seed + 1, skip: 0 });
  ctx.restore();
}
function drawJar(ctx, x, yb, seed) {
  sketchPoly(ctx, [[x - 18, yb], [x + 18, yb], [x + 18, yb - 40], [x - 18, yb - 40]], { w: 2, seed, fill: WHITE, rough: 0.5 });
  sketchPoly(ctx, [[x - 20, yb - 40], [x + 20, yb - 40], [x + 20, yb - 49], [x - 20, yb - 49]], { w: 2, seed: seed + 1, fill: BLACK, rough: 0.4 });
  hatch(ctx, [[x + 6, yb - 2], [x + 18, yb - 2], [x + 18, yb - 38], [x + 6, yb - 38]], { angle: 62, gap: 4, w: 1, seed: seed + 2 });
}
function plankTheta(t) {
  const tau = t - T_SHELF;
  if (tau <= 0) return 0;
  if (tau < 0.34) return 58 * EASE.in(tau / 0.34);
  if (tau < 0.6) return 58 - 7 * Math.sin((Math.PI * (tau - 0.34)) / 0.26);
  return 58;
}
function drawShelf(ctx, t) {
  const { x0, x1, y, xb, px } = SHELF;
  const broken = t >= T_SHELF;
  // brackets
  for (const [bx, d] of [[x0 + 40, 1], [px, -1]]) {
    const tri = [[bx, y + 12], [bx, y + 56], [bx + d * 38, y + 12]];
    sketchPoly(ctx, tri, { w: 2, seed: 300 + bx, fill: WHITE, rough: 0.6 });
    hatch(ctx, tri, { angle: 60 * d, gap: 5, w: 1, seed: 301 + bx });
  }
  // left part (or the whole plank)
  const xe = broken ? xb : x1;
  const L = broken
    ? [[x0, y], [xe, y], [xe - 9, y + 4], [xe + 5, y + 8], [xe - 5, y + 12], [x0, y + 12]]
    : [[x0, y], [x1, y], [x1, y + 12], [x0, y + 12]];
  sketchPoly(ctx, L, { w: 2.2, seed: 310, fill: WHITE, rough: 0.6, over: 2 });
  hatch(ctx, [[x0, y + 6], [xe, y + 6], [xe, y + 12], [x0, y + 12]], { angle: 20, gap: 7, w: 1, seed: 311 });
  hatch(ctx, [[x0 + 6, y + 13], [xe - 6, y + 13], [xe - 6, y + 21], [x0 + 6, y + 21]], { angle: 58, gap: 6, w: 1, seed: 312, skip: 0.15 });
  // right part: hinges down on its bracket, lands on the stapler
  if (broken) {
    const th = plankTheta(t) * DEG, c = [px, y + 6];
    ctx.save();
    ctx.translate(c[0], c[1]);
    ctx.rotate(-th);
    const R = [[xb - px + 6, -6], [x1 - px, -6], [x1 - px, 6], [xb - px - 4, 6], [xb - px + 8, 2], [xb - px - 6, -2]];
    sketchPoly(ctx, R, { w: 2.2, seed: 315, fill: WHITE, rough: 0.6, over: 2 });
    hatch(ctx, [[xb - px, 0], [x1 - px, 0], [x1 - px, 6], [xb - px, 6]], { angle: 20, gap: 7, w: 1, seed: 316 });
    ctx.restore();
  }
  // what stands on it
  const hopAt = (t0) => (t > t0 && t < t0 + 0.22 ? -Math.sin(((t - t0) / 0.22) * Math.PI) * 9 : 0);
  if (t < T_B1) drawBottle(ctx, 1370, y, 320); else drawStump(ctx, 1370, y, 320);
  drawCan(ctx, 1445, y + hopAt(T_B1) + hopAt(T_B2) + hopAt(T_SHELF) * 1.4, 330);
  if (t < T_B2) drawBottle(ctx, 1520, y + hopAt(T_SHELF), 340); else drawStump(ctx, 1520, y, 340);
  if (t < T_SHELF) {
    drawCan(ctx, 1590, y, 350);
    drawBottle(ctx, 1670, y, 360);
    drawJar(ctx, 1742, y, 370);
  }
}
/** things knocked off the shelf, in the air (front) or come to rest (back) */
function drawFallen(ctx, t, front) {
  const tau = t - T_SHELF;
  if (tau < 0) return;
  // the can by the break is flipped into the ink
  const TC = 0.5;
  if (tau < TC) {
    if (front) drawCan(ctx, lerp(1590, 1630, tau / TC), SHELF.y - 300 * tau + 1560 * tau * tau, 350, tau * 14);
  } else if (!front) {
    ctx.save(); ride(ctx, 1651, t); drawCan(ctx, 1651, -15, 350, Math.PI / 2); ctx.restore();
  }
  if (!front) return;
  // the bottle stump and the jar slide off the tilting half
  if (tau < 0.36) {
    drawBottle(ctx, 1670 - 30 * tau, SHELF.y + 1100 * tau * tau, 360);
    drawJar(ctx, 1742 - 60 * tau, SHELF.y + 1100 * tau * tau, 370);
  }
}

// ── the target ──
const tgtCracks = crackSet(205, TARGET[0], -TARGET[1], [{ a: -150 }, { a: -70, len: 1.2 }, { a: 10 }, { a: 80, len: 0.8 }, { a: 160, len: 1.1 }], { len: 104, step: 14, w: 2.4, branch: 0.34 });
function drawTarget(ctx, t) {
  const [cx, h] = TARGET, cy = -h, R = TARGET_R;
  const hit = t - T_TGT;
  const sw = hit > 0 && hit < 0.9 ? Math.sin(hit * 26) * 0.1 * (1 - hit / 0.9) : 0;
  ctx.save();
  ctx.translate(cx, cy - R - 40);
  ctx.rotate(sw);
  ctx.translate(-cx, -(cy - R - 40));
  // nail and string
  stroke(ctx, [[cx - 30, cy - R + 6], [cx, cy - R - 40], [cx + 30, cy - R + 6]], 1.6);
  ctx.fillStyle = BLACK; ctx.beginPath(); ctx.arc(cx, cy - R - 40, 4.5, 0, TAU); ctx.fill();
  blob(ctx, cx, cy, R, R, { w: 2.6, seed: 200, fill: WHITE, rough: 0.012, n: 30 });
  const ringHatch = (r1, r0, seed, ang) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r1, 0, TAU);
    ctx.arc(cx, cy, r0, 0, TAU, true);
    ctx.clip('evenodd');
    hatch(ctx, [[cx - r1, cy - r1], [cx + r1, cy - r1], [cx + r1, cy + r1], [cx - r1, cy + r1]], { angle: ang, gap: 5, w: 1.2, seed, clip: false, cross: true, crossAngle: 80 });
    ctx.restore();
  };
  ringHatch(R, R * 0.74, 201, 40);
  ringHatch(R * 0.48, R * 0.24, 202, -50);
  for (const k of [0.74, 0.48, 0.24]) blob(ctx, cx, cy, R * k, R * k, { w: 1.8, seed: 203 + k * 10, rough: 0.015, n: 24 });
  if (hit > 0) drawCracks(ctx, tgtCracks, prog(t, T_TGT, T_TGT + 0.2));
  ctx.restore();
}

// ── the stapler ──
function staplerPhi(t) {
  if (t >= T_PLANK) return lerp(24, 7, EASE.snap(prog(t, T_PLANK, T_PLANK + 0.08)));
  const tau = t - (SH4 + 0.04);
  if (tau <= 0) return 11;
  if (tau < 0.1) return lerp(11, 31, EASE.out(tau / 0.1));
  return lerp(31, 24, EASE.io(clamp((tau - 0.1) / 0.25)));
}
function drawStapler(ctx, t) {
  const { hx, hy, k } = ST;
  const base = [[1668, 0], [1950, 0], [1950, -18], [1686, -18], [1668, -8]];
  sketchPoly(ctx, base, { w: 2.4, seed: 600, fill: WHITE, rough: 0.6, over: 2 });
  hatch(ctx, base, { angle: 50, gap: 5, w: 1.1, seed: 601, cross: true });
  sketchPoly(ctx, [[1900, -18], [1950, -18], [1950, -50], [1900, -44]], { w: 2.2, seed: 602, fill: WHITE, rough: 0.5 });
  hatch(ctx, [[1900, -18], [1950, -18], [1950, -50], [1900, -44]], { angle: -50, gap: 4.5, w: 1.1, seed: 603, cross: true });
  const hurt = t >= SH4 + 0.04;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(staplerPhi(t) * DEG);
  ctx.scale(k, k);
  const mag = [[4, 2], [-184, 2], [-190, 12], [4, 12]];
  sketchPoly(ctx, mag, { w: 1.7, seed: 610, fill: WHITE, rough: 0.5 });
  hatch(ctx, mag, { angle: 90, gap: 4, w: 0.8, seed: 611, skip: 0 });
  const top = hurt
    ? [[8, -4], [8, -30], [-24, -44], [-150, -40], [-176, -30], [-180, -16], [-192, -6], [-184, 2], [4, 2]]
    : [[8, -4], [8, -30], [-24, -44], [-150, -40], [-186, -22], [-192, -2], [-184, 2], [4, 2]];
  sketchPoly(ctx, top, { w: 1.9, seed: 612, fill: WHITE, rough: 0.5, over: 1.5 });
  hatch(ctx, [[8, -30], [-24, -44], [-150, -40], [-150, -30], [8, -22]], { angle: 14, gap: 4.2, w: 0.85, seed: 613 });
  hatch(ctx, [[-150, -40], [-186, -22], [-192, -2], [-150, -4]], { angle: -58, gap: 4.6, w: 0.85, seed: 614, cross: true });
  stroke(ctx, [[-140, -10], [-20, -12]], 1.2);
  ctx.fillStyle = BLACK; ctx.beginPath(); ctx.arc(-2, -14, 4.5, 0, TAU); ctx.fill();
  if (hurt) {
    fillPoly(ctx, [[-192, -6], [-176, -18], [-168, -6], [-178, 0]], BLACK);
    stroke(ctx, [[-170, -14], [-158, -24], [-150, -18], [-138, -30]], 1.4);
    stroke(ctx, [[-168, -8], [-152, -6], [-144, -12]], 1.1);
  }
  ctx.restore();
}

// ── the ink bottle ──
const SPLAT = [];
{
  const r = rng(77);
  for (let i = 0; i < 30; i++) {
    const a = -Math.PI * (0.04 + r() * 0.92), d = 44 + r() * 240;
    SPLAT.push({ x: INK_X + Math.cos(a) * d * 1.2, y: -8 + Math.sin(a) * d * 0.9, r: 1.8 + r() * 3.6, d, drip: r() < 0.3 ? 10 + r() * 30 : 0, seed: 780 + i });
  }
}
const DRIPS = [[1452, 34, 0.1], [1480, 70, 0.0], [1506, 46, 0.2], [1528, 112, 0.05], [1552, 60, 0.15], [1574, 132, 0.0], [1600, 52, 0.25], [1622, 84, 0.1], [1646, 30, 0.3]];
function drawInk(ctx, t) {
  const x = INK_X;
  ctx.save();
  ride(ctx, x, t);
  if (t < T_INK) {
    const body = [[x - 38, 0], [x + 38, 0], [x + 38, -78], [x + 17, -98], [x + 17, -112], [x - 17, -112], [x - 17, -98], [x - 38, -78]];
    sketchPoly(ctx, body, { w: 2.4, seed: 700, fill: WHITE, rough: 0.6, over: 2 });
    fillPoly(ctx, [[x - 34, -3], [x + 34, -3], [x + 34, -56], [x - 34, -52]], BLACK);        // the ink in it
    sketchPoly(ctx, [[x - 22, -44], [x + 22, -44], [x + 22, -14], [x - 22, -14]], { w: 1.4, seed: 701, fill: WHITE, rough: 0.5 });
    ctx.fillStyle = BLACK;                                                                      // a drop on the label
    ctx.beginPath(); ctx.moveTo(x, -39); ctx.quadraticCurveTo(x + 10, -24, x, -19); ctx.quadraticCurveTo(x - 10, -24, x, -39); ctx.fill();
    sketchPoly(ctx, [[x - 20, -112], [x + 20, -112], [x + 20, -128], [x - 20, -128]], { w: 2, seed: 702, fill: BLACK, rough: 0.4 });
    stroke(ctx, [[x + 28, -72], [x + 28, -60]], 1.4);
  } else {
    const p = EASE.out(prog(t, T_INK, T_INK + 0.55));
    // what is thrown up the page
    ctx.fillStyle = BLACK;
    for (const s of SPLAT) {
      if (t < T_INK + s.d / 2600) continue;
      blob(ctx, s.x, s.y, s.r * 1.25, s.r, { seed: s.seed, fill: BLACK, rough: 0.3, n: 9, strokeIt: false });
      if (s.drip) {
        const l = s.drip * prog(t, T_INK + 0.1, T_INK + 1.6);
        ctx.fillRect(s.x - Math.max(1, s.r * 0.22), s.y, Math.max(2, s.r * 0.44), Math.min(l, -s.y - 2));
      }
    }
    // the puddle and what runs down the page from it
    const xl = lerp(x, 1492, p), xr = lerp(x, 1664, p);
    const pts = [];
    for (let i = 0; i <= 14; i++) { const k = i / 14, xx = lerp(xl, xr, k); pts.push([xx, -3 - 7 * Math.sin(k * Math.PI) - (hash(i * 1.3) * 3)]); }
    for (let i = 14; i >= 0; i--) { const k = i / 14, xx = lerp(xl, xr, k); pts.push([xx, 5 + 9 * Math.sin(k * Math.PI) + hash(i * 2.1) * 4]); }
    fillPoly(ctx, pts, BLACK);
    for (const [dx, len, d0] of DRIPS) {
      if (dx < xl || dx > xr) continue;
      const l = len * EASE.out(prog(t, T_INK + 0.15 + d0, T_INK + 1.5 + d0 * 2));
      if (l < 2) continue;
      ctx.fillStyle = BLACK;
      ctx.fillRect(dx - 3.5, 6, 7, l);
      ctx.beginPath(); ctx.arc(dx, 6 + l, 5.2, 0, TAU); ctx.fill();
    }
    // the base of the bottle, jagged
    const base = [[x - 38, 0], [x + 38, 0], [x + 38, -34], [x + 26, -20], [x + 14, -42], [x + 2, -22], [x - 12, -38], [x - 24, -18], [x - 38, -30]];
    sketchPoly(ctx, base, { w: 2.4, seed: 705, fill: WHITE, rough: 0.5 });
    fillPoly(ctx, [[x - 34, -3], [x + 34, -3], [x + 34, -14], [x - 34, -12]], BLACK);
  }
  ctx.restore();
}

// ── paperclips ──
function clipPath(ctx, L, w) {
  const wi = w * 0.62, w2 = wi * 0.7;
  ctx.beginPath();
  ctx.moveTo(L * 0.3, -w);
  ctx.lineTo(L - w, -w);
  ctx.arc(L - w, 0, w, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(wi, w);
  ctx.arc(wi, w - wi, wi, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.lineTo(L * 0.8 - w2, w - 2 * wi);
  ctx.arc(L * 0.8 - w2, w - 2 * wi + w2, w2, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(L * 0.36, w - 2 * wi + 2 * w2);
}
function drawClip(ctx, x, y, L, a, bent) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (bent) {
    const pts = [[0, 0], [L * 0.42, -4], [L * 0.5, -26], [L * 0.9, -34], [L * 0.96, -20], [L * 0.62, -12]];
    stroke(ctx, pts, 7, WHITE);
    stroke(ctx, pts, 3.4);
  } else {
    clipPath(ctx, L, 17); ctx.lineWidth = 8; ctx.strokeStyle = WHITE; ctx.stroke();
    clipPath(ctx, L, 17); ctx.lineWidth = 3.4; ctx.strokeStyle = BLACK; ctx.stroke();
  }
  ctx.restore();
}
const CLIP_T = SH9 + 0.04, CLIP_DUR = 0.8, CLIP_TO = 660;
function drawClips(ctx, t, front) {
  if (!front) drawClip(ctx, 2150, -62, 150, -1.25, false);          // set dressing, far right
  const tau = t - CLIP_T;
  if (tau < 0) { if (!front) drawClip(ctx, CLIP_X, -19, 124, -0.1, false); return; }
  if (tau < CLIP_DUR) {
    if (!front) return;
    const k = tau / CLIP_DUR;
    drawClip(ctx, lerp(CLIP_X, CLIP_TO, k), -30 - 4 * 250 * k * (1 - k), 124, -0.1 - k * 13, k > 0.1);
  } else if (!front) {
    ctx.save(); ride(ctx, CLIP_TO, t); drawClip(ctx, CLIP_TO, -4, 124, 0.02, true); ctx.restore();
  }
}

// ── "click": little tick-lines off the hammer when the gun is empty ──
const CLICKS = [T_CLICK, 10.2, F(310)];
function drawClicks(ctx, t, st) {
  for (const c of CLICKS) {
    const p = (t - c) / 0.11;
    if (p < 0 || p >= 1) continue;
    const g = st.weapons.find((w) => w.id === 'gun');
    if (!g) return;
    const x = g.tail[0] - 2, y = -g.tail[1] - 12;
    ctx.beginPath();
    for (const a of [-160, -125, -90, -55]) {
      const r0 = 7 + 9 * p, r1 = 15 + 16 * p;
      ctx.moveTo(x + Math.cos(a * DEG) * r0, y + Math.sin(a * DEG) * r0);
      ctx.lineTo(x + Math.cos(a * DEG) * r1, y + Math.sin(a * DEG) * r1);
    }
    ctx.lineWidth = 2.2; ctx.strokeStyle = BLACK; ctx.lineCap = 'round'; ctx.stroke();
  }
}

// ── the reload: ink climbs the barrel while the muzzle sits in the puddle ──
function drawInkLoad(ctx, t, st) {
  if (t < T_RELOAD || t >= T_INKED + 0.2) return;
  const g = st.weapons.find((w) => w.id === 'gun');
  if (!g || g.by !== 'A') return;
  if (t < T_INKED) {
    const xf = lerp(78, 0, EASE.io(prog(t, T_RELOAD + 0.03, T_INKED - 0.03)));
    ctx.save();
    ctx.translate(g.tail[0], -g.tail[1]);
    ctx.rotate(Math.atan2(-(g.tip[1] - g.tail[1]), g.tip[0] - g.tail[0]));
    ctx.scale(g.scale, g.mirror ? -g.scale : g.scale);
    ctx.beginPath();                      // everything muzzle-side of a ragged front
    ctx.moveTo(84, -16); ctx.lineTo(xf + 3, -16); ctx.lineTo(xf - 3, -6); ctx.lineTo(xf + 4, 1); ctx.lineTo(xf - 2, 12); ctx.lineTo(84, 12);
    ctx.closePath();
    ctx.clip();
    for (const i of [0, 3, 1]) fillPoly(ctx, PISTOL_PARTS[i], BLACK);
    ctx.restore();
    // rings spreading in the ink round the muzzle
    for (let i = 0; i < 2; i++) {
      const u = ((t - T_RELOAD) * 2.6 + i * 0.5) % 1;
      ctx.beginPath();
      ctx.ellipse(g.tip[0] + 2, 2, 12 + 50 * u, 2.5 + 6 * u, 0, 0, TAU);
      ctx.lineWidth = 0.6 + 1.8 * (1 - u); ctx.strokeStyle = WHITE; ctx.stroke();
    }
  } else {
    // a drop or two off the muzzle as it comes up
    const u = (t - T_INKED) / 0.2;
    ctx.fillStyle = BLACK;
    for (const [dx, k] of [[0, 1], [5, 0.6]]) { ctx.beginPath(); ctx.ellipse(g.tip[0] + dx, -g.tip[1] + 6 + 60 * u * u * k, 2.6, 4.4, 0, 0, TAU); ctx.fill(); }
  }
}

// ── floor damage ──
const slamCracks = crackSet(811, 1690, 3, [{ a: 20, len: 0.9 }, { a: 62 }, { a: 100, len: 0.7 }, { a: 150, len: 0.9 }], { len: 70, step: 12, w: 2.4, branch: 0.3 });
const stompCracks = crackSet(821, GUN_REST[0], 3, [{ a: 10 }, { a: 50, len: 0.8 }, { a: 96, len: 0.6 }, { a: 140, len: 0.8 }, { a: 172 }], { len: 66, step: 12, w: 2.2, branch: 0.3 });
const blowCracks = crackSet(831, X_BLOW, 3, [{ a: 24 }, { a: 66, len: 1.2 }, { a: 100 }, { a: 128, len: 1.1 }, { a: 160 }], { len: 150, step: 18, w: 3, branch: 0.34 });
const PERF_SEGS = [];
{
  const r = rng(841);
  for (let i = 0; i < PERF.length - 1; i++) {
    const a = PERF[i], b = PERF[i + 1], n = 4, pts = [];
    for (let j = 0; j <= n; j++) pts.push([lerp(a, b, j / n), -FLOOR_H + (j === 0 || j === n ? 0 : (r() - 0.5) * 9)]);
    PERF_SEGS.push({ pts, t: T_CRACK + Math.abs((a + b) / 2 - 1290) * 0.0014 });
  }
}
function drawCrushedGun(ctx, t) {
  if (t < T_STOMP + 0.002) return;
  const [x] = GUN_REST;
  const k = EASE.out(prog(t, T_STOMP, T_STOMP + 0.12));
  const dot = (cx, cy, r) => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); };
  ctx.save();
  ride(ctx, x, t);
  drawCracks(ctx, stompCracks, prog(t, T_STOMP, T_STOMP + 0.2));
  ctx.translate(x, 0);
  // the ink it was loaded with, squeezed out across the floor, thrown up the page, running down it
  const r = rng(905), sp = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU, rr = 1 + (i % 2 ? 0.3 : -0.14) + (r() - 0.5) * 0.3;
    sp.push([Math.cos(a) * 104 * rr * k, 1 + Math.sin(a) * 8 * rr * k]);
  }
  fillPoly(ctx, sp, BLACK);
  ctx.fillStyle = BLACK;
  for (let i = 0; i < 11; i++) { const dx = (r() - 0.5) * 250, dy = -10 - r() * 52; if (Math.abs(dx) > 34) dot(dx * k, dy * k, 1.8 + r() * 3.4); else r(); }
  for (const [dx, len] of [[-52, 24], [-12, 46], [30, 30], [64, 18]]) {
    const l = len * EASE.out(prog(t, T_STOMP + 0.1, T_STOMP + 1.3));
    ctx.fillStyle = BLACK; ctx.fillRect(dx - 3, 6, 6, l); dot(dx, 6 + l, 4.6);
  }
  // what is left of it: the same revolver the audience knows, lying muzzle-left, in pieces
  ctx.translate(10, -1);
  ctx.rotate(-0.05);
  ctx.scale(1.7, 1.7);
  const piece = (pts, seed, fill = WHITE, hatchAngle = null) => {
    stroke(ctx, pts.concat([pts[0]]), 6, WHITE);
    sketchPoly(ctx, pts, { w: 1.7, seed, fill, rough: 0.3 });
    if (hatchAngle != null) hatch(ctx, pts, { angle: hatchAngle, gap: 3, w: 0.7, seed: seed + 1 });
  };
  piece([[-28, -24], [-50, -28], [-75, -12], [-71, -4], [-50, -19], [-28, -15]], 911);       // barrel, kinked
  stroke(ctx, [[-33, -20], [-49, -23.5], [-68, -11]], 0.8);
  stroke(ctx, [[-72, -13], [-75, -18]], 1.6);                                                // front sight
  piece([[-2, -25], [-30, -25], [-30, -9], [-20, -9], [-16, -14], [-2, -14]], 912, WHITE, 55);  // frame
  fillPoly(ctx, [[-27, -23], [-13, -23], [-13, -12.5], [-27, -12.5]], BLACK);                 // the window where the cylinder sat
  stroke(ctx, [[-12, -25], [-9, -19], [-13, -14]], 1);                                       // cracked through
  ctx.beginPath(); ctx.arc(-21, -8, 6, 0.3, Math.PI * 0.8); ctx.lineWidth = 1.4; ctx.strokeStyle = BLACK; ctx.stroke();   // trigger guard, sprung open
  piece([[1, -17], [-13, -19], [-10, -3], [4, -4]], 913, BLACK);                             // grip: the stub…
  piece([[12, -11], [25, -15], [29, -3], [15, 0]], 914, BLACK);                              // …and the rest of it
  stroke(ctx, [[-2, -25], [6, -34]], 5, WHITE); stroke(ctx, [[-2, -25], [6, -34]], 2);       // hammer
  const spr = [];                                                                            // mainspring, sprung
  for (let i = 0; i <= 9; i++) spr.push([3 + i * 1.5 + (i % 2 ? 4.5 : -4.5), -19 - i * 3.3]);
  stroke(ctx, spr, 4.4, WHITE); stroke(ctx, spr, 1.4);
  blob(ctx, -36, -44, 11.5, 9.5, { w: 1.8, seed: 902, fill: WHITE, rough: 0.05, n: 16, rot: 0.3 });   // the cylinder, popped out: six empty chambers
  ctx.fillStyle = BLACK;
  for (let i = 0; i < 6; i++) dot(-36 + Math.cos(i * 1.047 + 0.4) * 6.6, -44 + Math.sin(i * 1.047 + 0.4) * 5.2, 1.7);
  dot(-36, -44, 1);
  ctx.restore();
}
function drawFloorDamage(ctx, t) {
  // where the spear went in
  if (t >= T_STICK) {
    stroke(ctx, [[SPEAR_X + 8, 1], [SPEAR_X + 2, 9], [SPEAR_X + 6, 16]], 1.6);
    stroke(ctx, [[SPEAR_X + 30, 1], [SPEAR_X + 38, 8], [SPEAR_X + 34, 14]], 1.6);
    if (t >= T_YANK) fillPoly(ctx, [[SPEAR_X + 10, 0], [SPEAR_X + 30, -1], [SPEAR_X + 26, 6], [SPEAR_X + 14, 7]], BLACK);
  }
  if (t >= T_SLAM1) { ctx.save(); ctx.translate(0, sag(1690, t)); drawCracks(ctx, slamCracks, prog(t, T_SLAM1, T_SLAM1 + 0.2)); ctx.restore(); }
  // the perforation: cracks running from hole to hole
  if (t >= T_CRACK && t < T_BLOW + 0.5) {
    for (const s of PERF_SEGS) {
      const q = prog(t, s.t, s.t + 0.22);
      if (q > 0) stroke(ctx, trim(s.pts, q), 2.2);
    }
  }
  if (t >= T_BLOW && t < T_GIVE + 0.1) { ctx.save(); ride(ctx, X_BLOW, t); drawCracks(ctx, blowCracks, prog(t, T_BLOW, T_BLOW + 0.25)); ctx.restore(); }
}

// ── the torn-away lower sheet ──
function drawTear(ctx, t, vb, px) {
  const s = tearState(t);
  if (!s) return;
  const xs = [];
  for (let x = s.zl; x < s.zr - 1; x += 16) xs.push(x);
  xs.push(s.zr);
  const dep = xs.map((x) => sag(x, t));
  const up = xs.map((x) => [x, edgeY(x)]);
  const lo = xs.map((x, i) => [x, edgeY(x) + dep[i]]);
  const n = xs.length - 1;
  const dR = dep[n];                                   // how far the free (right) end has dropped
  const yb = Math.min(PAGE.y1 - 6, vb.y1 + 40);
  // the lower sheet: paper again, its grid sagging and sliding down with it
  ctx.save();
  ctx.beginPath();
  lo.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.lineTo(s.zr, yb + 800); ctx.lineTo(s.zl, yb + 800);
  ctx.closePath();
  ctx.fillStyle = WHITE; ctx.fill();
  ctx.clip();
  for (const major of [false, true]) {
    ctx.beginPath();
    for (let x = Math.ceil(s.zl / GRID) * GRID; x <= s.zr; x += GRID) {
      if ((((Math.round(x / GRID) % 5) + 5) % 5 === 0) !== major) continue;
      ctx.moveTo(x, sag(x, t)); ctx.lineTo(x, yb + 800);
    }
    for (let y = GRID; y <= yb + 40; y += GRID) {
      if ((((Math.round(y / GRID) % 5) + 5) % 5 === 0) !== major) continue;
      xs.forEach((x, i) => { const yy = y + dep[i]; i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); });
    }
    ctx.lineWidth = major ? Math.max(1.3, 2.3 * px) : Math.max(0.7, 1.4 * px);
    ctx.strokeStyle = BLACK;
    ctx.stroke();
  }
  // its ground hatching rides down with it
  const band = lo.concat(lo.slice().reverse().map((p) => [p[0], p[1] + 18]));
  hatch(ctx, band, { angle: 58, gap: 9.5, w: Math.max(1.3, px), seed: 151, skip: 0.08, clip: true });
  ctx.restore();
  // the gap: the black desk. Its right side is the ragged rip the free end came away from
  const side = [];
  for (let y = 14; y < dR - 8; y += 20) side.push([s.zr + (hash(Math.round(y / 20) * 1.7) - 0.5) * 9, edgeY(s.zr) + y]);
  fillPoly(ctx, up.concat(side, lo.slice().reverse()), BLACK);
  stroke(ctx, up, 1.6);
  if (dR > 2) {
    const rip = [[s.zr, edgeY(s.zr) + dR]];             // …and the rip runs on down the page below it
    for (let y = dR + 24; y < yb + 60; y += 24) rip.push([s.zr + (hash(Math.round(y / 24) * 2.3) - 0.5) * 8, y]);
    stroke(ctx, rip, 3.4);
  }
  // the top edge of the freed sheet rolls over on itself
  const c = xs.map((x) => { const u = (x - s.zl) / (s.zr - s.zl || 1); return s.curl * Math.min(1, u * 5) * (0.55 + 0.45 * u); });
  if (s.curl > 1.5) {
    const top = lo.map((q, i) => [q[0], q[1] - c[i] * 0.3]);
    const mid = lo.map((q, i) => [q[0], q[1] + c[i] * 0.2]);
    const bot = lo.map((q, i) => [q[0], q[1] + c[i] * 0.7]);
    const sh = bot.map((q, i) => [q[0], q[1] + 6 + c[i] * 0.45]);
    hatch(ctx, bot.concat(sh.slice().reverse()), { angle: 66, gap: 4.2, w: 1.2, seed: 163, cross: true, crossAngle: 70 });   // its shadow on the sheet
    fillPoly(ctx, top.concat(bot.slice().reverse()), WHITE);
    hatch(ctx, mid.concat(bot.slice().reverse()), { angle: 84, gap: 5, w: 1.1, seed: 164 });
    stroke(ctx, top, 2.8); stroke(ctx, bot, 2.8); stroke(ctx, mid, 1.1);
    // the free end shows the roll end-on
    const rr = c[n] * 0.5, cx = s.zr - 2, cy = lo[n][1] + c[n] * 0.2;
    if (rr > 4 && dR > 4) {
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, TAU); ctx.fillStyle = WHITE; ctx.fill();
      ctx.lineWidth = 2.8; ctx.strokeStyle = BLACK; ctx.stroke();
      const sp = [];
      for (let i = 0; i <= 26; i++) { const a = -1.2 + i * 0.36, r2 = rr * (1 - i / 34); sp.push([cx + Math.cos(a) * r2, cy + Math.sin(a) * r2]); }
      stroke(ctx, sp, 1.6);
    }
  } else stroke(ctx, lo, 3);
  // little flaps of paper left along the upper lip (and along the lower edge until it rolls)
  const r = rng(161);
  for (let i = 0; i < 16; i++) {
    const x = lerp(XL, XR, (i + 0.3 + r() * 0.4) / 16), sz = 8 + r() * 12, up2 = r() < 0.5;
    if (x <= s.zl + 20 || x >= s.zr - 20 || (!up2 && s.curl > 1.5)) { r(); continue; }
    const y0 = up2 ? edgeY(x) : edgeY(x) + sag(x, t);
    const d = up2 ? 1 : -1;
    const f = [[x - sz, y0], [x + sz * 0.3, y0 + d * sz * (0.7 + r() * 0.5)], [x + sz, y0]];
    sketchPoly(ctx, f, { w: 1.6, seed: 170 + i, fill: WHITE, rough: 0.6 });
    hatch(ctx, f, { angle: 70, gap: 4, w: 1, seed: 190 + i });
  }
}

function drawFloor(ctx, t, vb, px) {
  const X0 = PAGE.x0 + 8, X1 = PAGE.x1 - 8;
  const s = tearState(t);
  if (!s) { drawGround(ctx, X0, X1, vb, px); return; }
  drawGround(ctx, X0, s.zl, vb, px);
  const xs = X0 + 240 * Math.ceil((s.zr - X0) / 240);
  line(ctx, s.zr, 0, xs, 0, { w: Math.max(3, 1.6 * px), seed: 141, rough: 1.1 });
  drawGround(ctx, xs, X1, vb, px);
}

S.env({
  page(ctx, t, { vb, px }) {
    NOW = t;
    drawPage(ctx, PAGE, vb, px, { rules: false });
    drawGrid(ctx, vb, px);
    drawMargin(ctx, t, px);
  },
  stage(ctx, t, { vb, px }) {
    drawFloor(ctx, t, vb, px);
    drawGunDoodle(ctx, t);
    drawTarget(ctx, t);
    drawShelf(ctx, t);
    drawStapler(ctx, t);
    drawTear(ctx, t, vb, px);
    drawInk(ctx, t);
    drawClips(ctx, t, false);
    drawFallen(ctx, t, false);
    drawFloorDamage(ctx, t);
    drawCrushedGun(ctx, t);
    drawShards(ctx, t, false);
  },
  over(ctx, t, { st }) {
    drawClicks(ctx, t, st);
    drawInkLoad(ctx, t, st);
    drawClips(ctx, t, true);
    drawFallen(ctx, t, true);
    drawShards(ctx, t, true);
  },
  // A runs along the shelf for a moment; later the floor sags, then is gone
  surface: (x, t, J) => {
    if (t >= T_GIVE) return null;
    if (J && J.s < 1 && t > 5.86 && t < 6.36) return 250;
    return -sag(x, t);
  },
});

export default S.build();
