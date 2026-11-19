// SCENE 1: "The First Clash" (20 s, unarmed). Blank notebook arena, brick wall at stage right.
//
// 0 → 9.45 s is the approved proof of concept, ported verbatim from ref_poc.js (raw S.fx / S.cue /
// S.shake lists). 9.45 → 20 s is new: A's five-hit combination, B catching a kick and slamming A
// into the page, the punt across the page, A running up B's body, the bear hug and overhead
// throw, and finally B catching A out of the air and hurling him through the damaged wall, then
// barrelling through after him. New contacts use S.hit / S.land / S.step / S.whoosh / S.skid.
//
// Stage: A starts at x=820 facing right, B at x=1140 facing left, the brick wall face is at
// x=1620 (it runs to x=2300), the pencil is planted in the page at x=1262 and is never touched.

import { createScene } from '../engine/scene.js';
import { flight, makeTrack, FIGHTER_A, FIGHTER_B } from '../engine/moves.js';
import { pose, drawFigure } from '../engine/rig.js';
import { DEG, rng, prog } from '../engine/util.js';
import { sketchPoly, hatch, blob, WHITE } from '../engine/ink.js';
import { drawGround, makeBrickWall, makeDebris, crackSet, drawCracks, cube, protractor, setSquare, scribble, DEFAULT_PAGE } from '../engine/kit.js';

const WALL_X = 1620;
const T_WALL_HIT = 8.6;
const T_THROUGH = 19.08;   // A goes through the wall
const T_BARREL = 19.42;    // B goes through after him

// Extra poses. The h* ones are authored around the HIP (hip: [0, 0], so key x / y is the hip's
// world position): used whenever A is carried, swung or thrown and has to be placed exactly.
const POSES2 = {
  hTuck: { hip: [0, 0], lean: 26, curl: 0.3, bend: 8, hF: [28, -44], hB: [24, -50], fF: [30, -38], fB: [24, -44] },
  hLand: { hip: [0, 0], lean: 32, bend: 10, hF: [22, -58], hB: [-12, -56], fF: [30, -46], fB: [-30, -46] },
  hSuper: { hip: [0, 0], lean: 0, hF: [6, 74], hB: [-12, 58], fF: [8, -98], fB: [-14, -90] },
  hRag: { hip: [0, 0], lean: 0, bend: 10, hF: [40, 40], hB: [-44, 30], fF: [36, -80], fB: [-40, -70] },
};

const S = createScene({ id: 's1', title: 'The First Clash', duration: 20, poses: POSES2 });

// ═════════════════════════════════════════════════════════════════════════════
// PART 1: 0 → 9.45 s, ported unchanged from ref_poc.js
// ═════════════════════════════════════════════════════════════════════════════

// ── FIGHTER A: The Technician ───────────────────────────────────────────────
const A_KEYS = [
  // 0:00: drawn onto the page, standing
  { t: 0.0, p: 'stand', x: 820, face: 1, reveal: 0 },
  { t: 0.15, p: 'stand', reveal: 0 },
  { t: 0.8, p: 'stand', reveal: 1, e: 'lin' },
  { t: 1.3, p: 'stand' },
  // light hop into a narrow, springy stance
  { t: 1.44, p: 'stand', hip: [0, 90], lean: 5, hF: [14, -62], hB: [-8, -64] },
  { t: 1.56, p: 'aStance', y: 16, hip: [-2, 98], fF: [24, 0], fB: [-20, 0], e: 'out' },
  { t: 1.66, p: 'aStance', hip: [-4, 80], e: 'in' },
  { t: 1.8, p: 'aStance', e: 'out' },
  { t: 2.0, p: 'aStance', hip: [-4, 88] },
  { t: 2.18, p: 'aStance', hip: [-4, 95], hF: [40, 2] },
  { t: 2.36, p: 'aStance', hip: [-4, 88] },
  { t: 2.54, p: 'aStance', hip: [-4, 95], hF: [40, 2] },
  { t: 2.72, p: 'aStance', hip: [-4, 88] },
  { t: 2.9, p: 'aStance', hip: [-4, 94] },
  // 0:03: reads the dash, slips low and slides under the punch
  { t: 3.08, p: 'aStance', hip: [-10, 90], lean: -3, hF: [34, 6], hB: [18, -6] },
  { t: 3.2, x: 832, hip: [2, 62], lean: 34, bend: 10, hF: [30, -10], hB: [8, -22], fF: [42, 0], fB: [-30, 0], e: 'in' },
  { t: 3.34, x: 905, hip: [-10, 32], lean: 72, tilt: -40, hF: [52, 4], hB: [-34, -6], fF: [64, 0], fB: [-36, 0], kB: -1, slide: true, e: 'lin' },
  { t: 3.5, x: 1005, hip: [-6, 36], lean: 60, tilt: -30, hF: [40, -10], hB: [-30, -10], fF: [60, 0], fB: [-30, 0], kB: -1, slide: true, e: 'out' },
  // pivots behind B and whips a spinning kick
  { t: 3.62, x: 1032, face: -1, hip: [4, 78], lean: 14, hF: [10, -34], hB: [-22, -28], fF: [14, 0], fB: [-22, 0] },
  { t: 3.75, hip: [0, 90], lean: -8, hF: [14, -26], hB: [-18, -30], fF: [22, 64], fB: [-6, 0], e: 'in' },
  { t: 3.86, hip: [-6, 92], lean: -36, tilt: 22, hF: [24, -40], hB: [-52, -8], fF: [92, 150], fB: [-6, 0], e: 'snap' },
  { t: 3.95, same: true },
  { t: 4.07, hip: [-2, 90], lean: -12, hF: [20, -30], hB: [-30, -20], fF: [60, 70], fB: [-6, 0] },
  { t: 4.19, p: 'aStance', x: 1036, hip: [-4, 84] },
  { t: 4.3, p: 'aStance' },
  { t: 4.46, p: 'aStance', hip: [-4, 95] },
  { t: 4.58, p: 'aStance', hip: [-6, 89] },
  // the exchange: parry, jab, duck, uppercut, low kick, cross
  { t: 4.68, p: 'aStance', hip: [-8, 90], lean: -4, hF: [46, 12], hB: [14, -12], e: 'snap' },
  { t: 4.77, p: 'aStance', hip: [-2, 88], lean: 6, hF: [20, 0], hB: [14, -14] },
  { t: 4.84, p: 'aStance', x: 1006, hip: [6, 90], lean: 12, hF: [77, -6], hB: [12, -12], fF: [40, 0], e: 'snap' },
  { t: 4.9, same: true },
  { t: 5.0, p: 'aStance', x: 1046 },
  { t: 5.09, hip: [0, 60], lean: 30, bend: 12, hF: [24, -8], hB: [10, -16], fF: [32, 0], fB: [-28, 0], e: 'out' },
  { t: 5.19, hip: [2, 58], lean: 28, bend: 12, hF: [22, -12], hB: [8, -26], fF: [32, 0], fB: [-28, 0] },
  { t: 5.28, x: 1008, hip: [10, 92], lean: 10, hF: [22, -10], hB: [60, 20], fF: [34, 0], fB: [-28, 0], e: 'snap' },
  { t: 5.34, same: true },
  { t: 5.4, p: 'aStance', x: 1040, hip: [-6, 90], lean: -6 },
  { t: 5.46, hip: [-8, 90], lean: -14, hF: [26, -14], hB: [-10, -30], fF: [86, 26], fB: [-26, 0], e: 'snap' },
  { t: 5.5, same: true },
  { t: 5.58, p: 'aStance' },
  { t: 5.66, x: 1020, hip: [10, 90], lean: 16, hF: [20, -8], hBw: [925, 146], fF: [36, 0], fB: [-30, 0], e: 'snap' },
  // …caught. He strains to pull free
  { t: 5.74, hip: [0, 88], lean: 4, hF: [14, -16], hBw: [925, 146], fF: [36, 0], fB: [-30, 0] },
  { t: 5.82, hip: [-4, 86], lean: 0, hF: [10, -18], hBw: [927, 147], fF: [36, 0], fB: [-30, 0] },
  // folded by the body blow and launched across the page
  { t: 5.88, x: 1010, y: 6, hip: [-22, 80], lean: 38, bend: 22, hF: [52, -18], hB: [56, -4], fF: [44, 8], fB: [26, 2], e: 'snap' },
  { t: 5.94, same: true, x: 1016 },
  ...flight(5.94, 6.24, [1016, 6], [1470, 0], 2400, [
    [6.04, { hip: [0, 56], lean: 58, bend: 16, hF: [60, 10], hB: [66, -8], fF: [72, 44], fB: [62, 22] }],
    [6.15, { hip: [0, 56], lean: 30, bend: 8, hF: [40, -20], hB: [30, -30], fF: [34, 14], fB: [-14, 6] }],
  ], { hip: [-14, 40], lean: 55, tilt: -34, hF: [14, -76], hB: [-50, 30], fF: [22, 0], fB: [-70, 0], kB: -1 }),
  // three-point landing, skidding back to the wall
  { t: 6.5, x: 1540, hip: [-14, 40], lean: 55, tilt: -34, hF: [14, -76], hB: [-44, 20], fF: [22, 0], fB: [-70, 0], kB: -1, slide: true, e: 'out' },
  { t: 6.72, x: 1545, hip: [0, 80], lean: 16, hF: [30, -20], hB: [10, -30], fF: [26, 0], fB: [-30, 0] },
  { t: 6.92, x: 1548, p: 'aStance', hip: [-4, 88] },
  { t: 7.1, p: 'aStance', hip: [-8, 92], lean: -4, hF: [34, 8], hB: [18, -4] },
  // 0:07: slow motion: the fist comes in, he drops under it
  { t: 7.25, p: 'aStance', hip: [-8, 92], lean: -7, hF: [32, 10], hB: [16, -2], e: 'lin' },
  { t: 7.45, hip: [-6, 64], lean: 12, bend: 8, hF: [30, -4], hB: [14, -14], fF: [32, 0], fB: [-28, 0], e: 'lin' },
  { t: 7.7, hip: [-4, 54], lean: 20, bend: 14, tilt: -10, hF: [28, -14], hB: [12, -24], fF: [34, 0], fB: [-26, 0], e: 'lin' },
  { t: 8.5, hip: [4, 51], lean: 32, bend: 16, tilt: -30, hF: [34, -34], hB: [18, -42], fF: [36, 0], fB: [-24, 0], e: 'out' },
  { t: 8.62, hip: [8, 48], lean: 40, bend: 18, tilt: -34, hF: [36, -38], hB: [20, -46], fF: [36, 0], fB: [-24, 0] },
  // plants a foot on the wall and flips over B
  { t: 8.73, hip: [4, 48], lean: 40, tilt: -44, hF: [30, -44], hB: [-20, -40], fF: [30, 0], fBw: [1616, 44] },
  { t: 8.82, x: 1532, hip: [10, 88], lean: 30, hF: [44, 36], hB: [36, 44], fF: [-6, 12], fBw: [1616, 50], e: 'in' },
  ...flight(8.82, 9.45, [1532, 0], [1325, 0], 5800, [
    [8.96, { hip: [0, 70], lean: 24, hF: [44, 44], hB: [38, 50], fF: [-30, 6], fB: [-56, 14] }],
    [9.1, { p: 'aTuck', spin: 130 }],
    [9.24, { p: 'aTuck', spin: 290 }],
    [9.36, { hip: [0, 86], lean: 8, hF: [34, 26], hB: [-30, 24], fF: [14, 0], fB: [-12, 8], spin: 360 }],
  ], { hip: [0, 46], lean: 32, bend: 10, hF: [22, -58], hB: [-12, -56], fF: [30, 0], fB: [-30, 0] }),
];

// ── FIGHTER B: The Powerhouse ───────────────────────────────────────────────
const B_KEYS = [
  { t: 0.0, p: 'stand', x: 1140, face: -1, reveal: 0 },
  { t: 0.36, p: 'stand', reveal: 0 },
  { t: 0.96, p: 'stand', reveal: 1, e: 'lin' },
  { t: 1.56, p: 'stand' },
  // raises a knee… and stomps into a wide, heavy stance
  { t: 1.68, hip: [-6, 100], lean: -6, hF: [12, -44], hB: [-12, -44], fF: [22, 38], fB: [-12, 0] },
  { t: 1.83, hip: [-10, 100], lean: -10, hF: [22, -22], hB: [-22, -22], fF: [34, 54], fB: [-14, 0], e: 'out' },
  { t: 1.94, p: 'bStance', hip: [0, 66], lean: 24, hF: [34, -48], hB: [-6, -52], e: 'in3' },
  { t: 2.08, p: 'bStance', hip: [0, 83], e: 'out' },
  { t: 2.4, p: 'bStance', hip: [0, 78], lean: 21 },
  { t: 2.7, p: 'bStance', hip: [0, 82] },
  // coils…
  { t: 2.86, p: 'bStance', hip: [-22, 74], lean: 2, hB: [-52, -8], hF: [30, -30] },
  { t: 3.02, p: 'bStance', hip: [-28, 68], lean: -4, hB: [-58, -2], hF: [32, -26] },
  // 0:03: explodes into a flying overhand
  { t: 3.08, hip: [14, 74], lean: 40, hB: [-60, 6], hF: [46, -22], fF: [40, 18], fB: [-60, 0], e: 'in' },
  ...flight(3.08, 3.44, [1140, 0], [945, 0], 3000, [
    [3.2, { hip: [0, 78], lean: 56, hB: [-62, 12], hF: [52, -18], fF: [50, 30], fB: [-72, 22] }],
    [3.31, { hip: [0, 76], lean: 52, hB: [82, -36], hF: [10, -40], fF: [56, 24], fB: [-66, 26], e: 'snap' }],
  ], { hip: [20, 60], lean: 62, bend: 8, hB: [66, -70], hF: [-10, -50], fF: [48, 0], fB: [-56, 0] }),
  { t: 3.56, hip: [16, 62], lean: 56, bend: 8, hB: [60, -66], hF: [-10, -50], fF: [48, 0], fB: [-56, 0] },
  { t: 3.7, hip: [6, 70], lean: 34, hF: [20, -50], hB: [30, -50], fF: [44, 0], fB: [-50, 0] },
  // turns straight into the kick
  { t: 3.8, face: 1, hip: [0, 64], lean: 10, hF: [20, -40], hB: [-10, -44], fF: [30, 0], fB: [-30, 0] },
  { t: 3.86, x: 940, hip: [-20, 72], lean: -32, tilt: -36, hF: [52, 22], hB: [42, 32], fF: [34, 12], fB: [-40, 0], e: 'snap' },
  { t: 3.95, same: true },
  { t: 4.07, x: 880, hip: [-16, 74], lean: -22, tilt: -20, hF: [36, 48], hB: [-44, 40], fF: [30, 0], fB: [-50, 0], e: 'out' },
  { t: 4.19, x: 825, hip: [-12, 66], lean: 6, hF: [40, 0], hB: [-30, -10], fF: [44, 0], fB: [-44, 0] },
  { t: 4.3, x: 800, p: 'bStance', hip: [-4, 66], lean: 28, slide: true, e: 'out' },
  // shakes it off, steps in with a jab
  { t: 4.41, p: 'bStance', hip: [-12, 70], lean: 14, hF: [10, -10], hB: [-40, -10] },
  { t: 4.53, x: 850, hip: [6, 80], lean: 30, hF: [20, -6], hB: [-30, -14], fF: [50, 0], fB: [-50, 0] },
  { t: 4.62, x: 895, p: 'bStance', hip: [10, 80], lean: 20, hF: [84, 6], hB: [4, -14], fF: [50, 0], fB: [-50, 0], e: 'snap' },
  { t: 4.7, p: 'bStance', hip: [8, 80], lean: 16, hF: [66, 40], hB: [4, -14], fF: [50, 0], fB: [-50, 0] },
  { t: 4.8, p: 'bStance', hip: [4, 80], lean: 16, hF: [36, -6], hB: [0, -16], fF: [50, 0], fB: [-50, 0] },
  { t: 4.84, p: 'bStance', hip: [-4, 80], lean: 10, tilt: -12, hF: [34, -2], hB: [-4, -14], fF: [50, 0], fB: [-50, 0], e: 'snap' },
  // big hook: misses
  { t: 4.94, p: 'bStance', hip: [0, 80], lean: 14, hF: [30, -10], hB: [-44, 18], fF: [50, 0], fB: [-50, 0] },
  { t: 5.03, p: 'bStance', hip: [-6, 80], lean: 8, hF: [34, -10], hB: [-56, 22], fF: [50, 0], fB: [-50, 0] },
  { t: 5.12, p: 'bStance', hip: [8, 80], lean: 26, hF: [10, -20], hB: [82, 24], fF: [50, 0], fB: [-50, 0], e: 'snap' },
  { t: 5.22, p: 'bStance', hip: [12, 78], lean: 36, hF: [-6, -30], hB: [46, -34], fF: [50, 0], fB: [-50, 0] },
  // braces: crossed-arm block
  { t: 5.28, p: 'bStance', hip: [-6, 78], lean: 6, tilt: 0, hF: [33, 6], hB: [30, -4], fF: [50, 0], fB: [-50, 0], e: 'snap' },
  { t: 5.37, p: 'bStance', hip: [-10, 78], lean: 2, tilt: 0, hF: [33, 6], hB: [30, -4], fF: [50, 0], fB: [-50, 0] },
  { t: 5.46, p: 'bStance', hip: [0, 68], lean: 22, tilt: 12, hF: [30, -20], hB: [10, -30], fF: [50, 0], fB: [-50, 0], e: 'snap' },
  { t: 5.57, hip: [0, 86], lean: 8, hF: [40, 8], hB: [-30, 6], fF: [50, 0], fB: [-50, 0] },
  // catches the cross in his fist
  { t: 5.66, hip: [0, 86], lean: 10, hFw: [925, 146], hB: [-30, 0], fF: [50, 0], fB: [-50, 0], e: 'snap' },
  { t: 5.74, hip: [-2, 86], lean: 8, hFw: [925, 146], hB: [-44, 8], fF: [50, 0], fB: [-50, 0] },
  { t: 5.82, hip: [-8, 84], lean: 0, hFw: [927, 147], hB: [-58, 12], fF: [50, 0], fB: [-50, 0] },
  // body blow
  { t: 5.88, x: 915, hip: [0, 80], lean: 22, hBw: [1000, 132], hF: [10, -20], fF: [54, 0], fB: [-56, 0], e: 'snap' },
  { t: 5.95, hip: [8, 80], lean: 28, hB: [86, -10], hF: [4, -26], fF: [54, 0], fB: [-56, 0] },
  { t: 6.1, same: true },
  { t: 6.22, p: 'bStance', hip: [0, 84], lean: 10, fF: [50, 0], fB: [-50, 0] },
  // charges: six heavy strides
  { t: 6.31, hip: [6, 66], lean: 34, hF: [30, -30], hB: [-50, 0], fF: [50, 0], fB: [-50, 0] },
  { t: 6.4, x: 975, p: 'bRun2', hop: 10, e: 'lin' },
  { t: 6.52, x: 1070, p: 'bRun1', hop: 12, e: 'lin' },
  { t: 6.64, x: 1165, p: 'bRun2', hop: 12, e: 'lin' },
  { t: 6.76, x: 1260, p: 'bRun1', hop: 12, e: 'lin' },
  { t: 6.88, x: 1345, p: 'bRun2', hop: 12, e: 'lin' },
  { t: 6.98, x: 1395, hip: [-10, 76], lean: 10, hB: [-66, 22], hF: [40, -10], fF: [60, 0], fB: [-58, 0], hop: 6, e: 'lin' },
  { t: 7.1, x: 1408, hip: [-4, 78], lean: 14, hB: [-66, 26], hF: [44, -6], fF: [52, 0], fB: [-58, 0] },
  // 0:07: the punch, in slow motion: a long lunge carries the fist past A's head
  { t: 7.25, x: 1385, hip: [16, 78], lean: 30, hB: [44, 16], hF: [20, -30], fFw: [1491, 0], fB: [-60, 0], e: 'in' },
  { t: 7.45, x: 1396, hip: [18, 78], lean: 33, hB: [50, 14], hF: [10, -34], fFw: [1491, 0], fB: [-62, 0], e: 'lin' },
  { t: 7.6, x: 1404, hip: [18, 78], lean: 35, hB: [58, 14], hF: [4, -36], fFw: [1491, 0], fB: [-64, 0], e: 'lin' },
  { t: 8.1, x: 1432, hip: [20, 78], lean: 40, hB: [69, 14], hF: [-6, -40], fFw: [1491, 0], fB: [-70, 0], e: 'lin' },
  { t: 8.45, x: 1450, hip: [20, 78], lean: 43, hB: [73, 12], hF: [-14, -40], fFw: [1491, 0], fB: [-74, 0], e: 'lin' },
  { t: 8.59, x: 1458, hip: [22, 78], lean: 46, hBw: [1630, 146], hF: [-24, -36], fFw: [1491, 0], fB: [-76, 0], e: 'in3' },
  // fist punches clean through the brickwork
  { t: 8.66, hip: [27, 75], lean: 51, hBw: [1640, 146], hF: [-24, -36], fFw: [1491, 0], fB: [-76, 0] },
  { t: 8.9, hip: [22, 78], lean: 46, hBw: [1636, 146], hF: [-10, -40], fFw: [1491, 0], fB: [-70, 0] },
  { t: 9.1, hip: [14, 80], lean: 38, hBw: [1626, 148], hF: [0, -44], fFw: [1491, 0], fB: [-60, 0] },
  { t: 9.3, x: 1462, hip: [0, 84], lean: 16, hB: [60, 0], hF: [10, -46], fF: [30, 0], fB: [-44, 0] },
  // rips free, turns on A
  { t: 9.42, x: 1470, hip: [-10, 82], lean: -6, hB: [30, -20], hF: [20, -30], fF: [30, 0], fB: [-40, 0] },
  { t: 9.56, x: 1476, hip: [-8, 78], lean: 0, hB: [20, -30], hF: [10, -40], fF: [30, 0], fB: [-40, 0] },
  { t: 9.72, face: -1, x: 1482, hip: [0, 82], lean: 4, hF: [14, -50], hB: [-14, -50], fF: [30, 0], fB: [-30, 0] },
];

// ═════════════════════════════════════════════════════════════════════════════
// PART 2: 9.45 → 20 s, new material
// ═════════════════════════════════════════════════════════════════════════════

const off = (p, dx, dy) => [p[0] + dx, p[1] + dy];
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];

// A carried by one ankle (his front foot): the body is whipped out rigid from the grip.
//   grip = [worldX, height] of the held ankle, th = world direction grip → hip in degrees
//   (0 = right, 90 = up), fold = extra torso angle on top of the radial line.
function byAnkle(t, grip, th, o = {}) {
  const { fold = 0, face = 1, ...rest } = o;
  const L = 95;
  return {
    t, face, x: grip[0] + L * Math.cos(th * DEG), y: grip[1] + L * Math.sin(th * DEG),
    hip: [0, 0], spin: face * (90 - th), lean: face * fold, fFw: grip,
    fB: [26, -74], hF: [-14, 66], hB: [16, 70], e: 'lin', er: 'lin', ...rest,
  };
}

// A hanging from one wrist (his front hand): th = world direction grip → body in degrees.
function byWrist(t, grip, th, o = {}) {
  const { face = 1, D = 132, ...rest } = o;
  return {
    t, face, x: grip[0] + D * Math.cos(th * DEG), y: grip[1] + D * Math.sin(th * DEG),
    hip: [0, 0], spin: face * (270 - th), lean: 0, hFw: grip,
    hB: [20, 30], fF: [10, -96], fB: [-16, -90], e: 'lin', er: 'lin', ...rest,
  };
}

// grips: the ankle B catches at 11.66 and how he swings it; the wrist he catches at 18.66
const ANKLE = { 11.66: [1500, 150], 11.92: [1502, 142], 12.0: [1514, 186], 12.08: [1530, 240], 12.16: [1540, 266], 12.23: [1540, 270], 12.3: [1524, 250], 12.36: [1506, 172], 12.42: [1508, 24] };
const WRIST = {
  18.16: [1028, 205], 18.22: [1034, 214], 18.3: [1046, 234], 18.38: [1048, 240], 18.46: [1046, 236],   // caught, hoisted, dangling
  18.54: [1024, 214], 18.62: [1004, 190],                                                              // drawn back
  18.69: [1040, 232], 18.76: [1082, 258], 18.82: [1140, 252], 18.86: [1184, 238], 18.9: [1218, 215],   // over the top and away
};
const grab2 = (g) => off(g, 7, -6);   // B's second hand, just below the first
const RIBS = (q, k) => off(mix(q.A.hip, q.A.sh, k), 14, 0);   // where B's hands hold A at arm's length (15.84–16.25)

const A_NEW = [
  // lands the flip, whips round to face B
  { t: 9.6, hip: [2, 60], lean: 26, tilt: -10, hF: [26, -40], hB: [-10, -46], fF: [30, 0], fB: [-30, 0], e: 'out' },
  { t: 9.76, face: 1, x: 1322, hip: [-2, 80], lean: 10, hF: [32, -10], hB: [10, -24], fF: [28, 0], fB: [-28, 0] },
  { t: 9.86, p: 'aStance', x: 1322, hip: [-4, 94] },
  // ── the combination. Each hit is its own pose; A steps in to land it and out again ──
  { t: 9.93, p: 'aStance', hip: [-14, 82], lean: -6, hF: [26, 6], hB: [2, -12] },
  // 1 · jab: one long line from the back heel to the fist
  { t: 10.0, x: 1390, hip: [12, 88], lean: 16, hFw: (q) => off(q.B.head, -19, -2), hB: [6, -8], fF: [44, 0], fB: [-44, 0], e: 'snap' },
  { t: 10.07, hip: [4, 88], lean: 8, hF: [34, 8], hB: [-10, -6], fF: [44, 0], fB: [-44, 0] },
  // 2 · cross to the body: sinks and turns the back hand through
  { t: 10.14, x: 1398, hip: [16, 78], lean: 26, hF: [14, 0], hBw: (q) => off(mix(q.B.hip, q.B.sh, 0.4), -8, 0), fF: [44, 0], fB: [-48, 0], e: 'snap' },
  { t: 10.19, same: true },
  // out: hops back on his toes while B folds
  { t: 10.28, x: 1340, hip: [-6, 92], lean: -2, hF: [38, 6], hB: [16, -8], fF: [28, 0], fB: [-28, 0], hop: 10, e: 'out' },
  { t: 10.35, hip: [-12, 86], lean: -8, hF: [30, 2], hB: [-4, -18], fF: [28, 0], fB: [-28, 0] },
  // 3 · low kick: leans away, lead leg whips across B's shin
  { t: 10.42, x: 1384, hip: [-8, 88], lean: -20, tilt: 10, hF: [18, -22], hB: [-40, -4], fFw: (q) => off(mix(q.B.fF, q.B.kF, 0.45), -6, 0), fB: [-26, 0], e: 'snap' },
  { t: 10.48, same: true },
  // out again as B goes down, then sinks to load the uppercut
  { t: 10.54, x: 1346, hip: [-6, 90], lean: 0, hF: [36, 4], hB: [14, -10], fF: [28, 0], fB: [-28, 0], hop: 6, e: 'out' },
  { t: 10.62, x: 1350, hip: [2, 62], lean: 24, bend: 10, hF: [24, -10], hB: [-6, -46], fF: [34, 0], fB: [-32, 0] },
  // 4 · uppercut: everything goes up
  { t: 10.7, x: 1424, y: 8, hip: [16, 98], lean: 4, hF: [10, -24], hBw: (q) => off(q.B.head, -15, -14), fF: [30, 0], fB: [-28, 6], e: 'snap' },
  { t: 10.77, same: true },
  // out and wind up: drops back, chambers the knee
  { t: 10.87, x: 1404, hip: [-8, 84], lean: -2, hF: [30, -4], hB: [-22, -22], fF: [28, 0], fB: [-30, 0] },
  { t: 10.96, x: 1446, hip: [-2, 88], lean: -10, hF: [14, -26], hB: [-22, -28], fF: [22, 64], fB: [-6, 0], e: 'in' },
  // 5 · high kick
  { t: 11.04, x: 1466, hip: [-6, 92], lean: -36, tilt: 22, hF: [24, -40], hB: [-52, -8], fFw: (q) => off(q.B.head, -17, -8), fB: [-6, 0], e: 'snap' },
  { t: 11.12, same: true },
  { t: 11.24, hip: [-2, 90], lean: -10, hF: [20, -30], hB: [-30, -20], fF: [56, 60], fB: [-6, 0] },
  { t: 11.36, p: 'aStance', x: 1384, hip: [-4, 88] },
  { t: 11.48, p: 'aStance', x: 1380, hip: [-6, 95], hF: [36, 6] },
  // one more high kick… and B catches the ankle
  { t: 11.57, x: 1396, hip: [4, 76], lean: 14, hF: [30, -10], hB: [-10, -30], fF: [30, 0], fB: [-30, 0] },
  { t: 11.66, x: 1425, hip: [-4, 92], lean: -30, tilt: 18, hF: [22, -38], hB: [-50, -6], fFw: ANKLE[11.66], fB: [-4, 0], e: 'snap' },
  { t: 11.74, hip: [-8, 88], lean: -22, tilt: 8, hF: [30, -8], hB: [-40, 14], fFw: ANKLE[11.66], fB: [-4, 0] },
  { t: 11.82, hip: [0, 92], lean: -4, hF: [66, 22], hB: [-30, -10], fFw: ANKLE[11.66], fB: [-4, 0], e: 'out' },
  { t: 11.92, hip: [-8, 86], lean: -24, tilt: 10, hF: [14, 40], hB: [-50, 30], fFw: ANKLE[11.92], fB: [-4, 0] },
  // heaved up like a flag…
  byAnkle(12.0, ANKLE[12.0], 207, { fold: 62, hF: [40, 30], hB: [-30, 50], fB: [10, -80] }),
  byAnkle(12.08, ANKLE[12.08], 172, { fold: 14, hF: [-10, 60], hB: [20, 66] }),
  byAnkle(12.16, ANKLE[12.16], 128, { fold: 0 }),
  byAnkle(12.23, ANKLE[12.23], 102, { fold: -6, hF: [-30, 50], hB: [34, 56], fB: [40, -60], e: 'out' }),
  // …and slammed into the page
  byAnkle(12.3, ANKLE[12.3], 126, { fold: 14, fB: [50, -50] }),
  byAnkle(12.36, ANKLE[12.36], 152, { fold: 16 }),
  byAnkle(12.42, ANKLE[12.42], 187, { fold: 9, hF: [-34, 40], hB: [30, 60], fB: [44, -64], e: 'in' }),
  byAnkle(12.52, ANKLE[12.42], 187, { fold: 9, hF: [-36, 30], hB: [34, 50], fB: [50, -50] }),
  // props himself up, sees the boot coming, crosses his arms
  { t: 12.68, x: 1404, hip: [0, 30], lean: -46, tilt: 20, hF: [-34, -44], hB: [20, -30], fF: [70, 0], fB: [46, 0] },
  { t: 12.8, x: 1408, hip: [-4, 40], lean: -14, tilt: 6, hF: [36, -22], hB: [32, -34], fF: [56, 0], fB: [-30, 0], kB: -1 },
  { t: 12.86, x: 1400, y: 6, p: 'fold', hip: [-22, 54], e: 'snap' },
  { t: 12.92, same: true, x: 1392, y: 8 },
  ...flight(12.92, 13.38, [1392, 8], [833, 0], 3000, [
    [13.04, { p: 'flyBack' }],
    [13.2, { p: 'flyBack', lean: 40, hF: [50, 30], hB: [56, 12], spin: -30 }],
  ], { p: 'tuck', hip: [0, 14], spin: -70 }),
  // backward roll, up onto his feet, skids
  { t: 13.47, x: 790, p: 'tuck', hip: [0, 84], spin: -170, e: 'lin', er: 'lin' },
  { t: 13.56, x: 754, p: 'tuck', hip: [0, 70], spin: -270, e: 'lin', er: 'lin' },
  { t: 13.66, x: 726, hip: [0, 46], lean: 32, bend: 10, hF: [26, -60], hB: [-12, -56], fF: [32, 0], fB: [-32, 0], spin: -360, e: 'lin', er: 'lin' },
  { t: 13.84, x: 700, hip: [-6, 52], lean: 30, tilt: -20, hF: [30, -62], hB: [-20, -30], fF: [34, 0], fB: [-40, 0], slide: true, e: 'out' },
  // ── he comes straight back: sprints, ducks the hook, runs up B and kicks off his chin ──
  { t: 13.96, x: 702, hip: [-2, 74], lean: 20, tilt: -10, hF: [34, -20], hB: [4, -34], fF: [32, 0], fB: [-38, 0] },
  { t: 14.04, x: 710, hip: [10, 68], lean: 38, hF: [36, -26], hB: [-30, -20], fF: [34, 0], fB: [-46, 0] },
  { t: 14.11, x: 768, p: 'run1', hop: 8, e: 'lin', er: 'lin' },
  { t: 14.18, x: 836, p: 'run2', hop: 8, e: 'lin', er: 'lin' },
  { t: 14.25, x: 890, p: 'run1', hip: [0, 68], lean: 44, hop: 4, e: 'lin', er: 'lin' },
  { t: 14.32, x: 940, y: 34, hip: [0, 88], lean: 2, hF: [30, 10], hB: [-30, -10], fFw: (q) => off(q.B.kF, -4, 8), fB: [-44, 22], e: 'lin', er: 'lin' },
  { t: 14.39, x: 968, y: 104, hip: [0, 88], lean: -28, hF: [34, 30], hB: [-26, 20], fF: [44, 66], fBw: (q) => off(mix(q.B.hip, q.B.sh, 0.72), -8, 0), e: 'lin', er: 'lin' },
  { t: 14.46, x: 968, y: 214, hip: [0, 0], lean: 0, spin: -66, hF: [30, 40], hB: [-30, 40], fFw: (q) => off(q.B.head, -16, -10), fB: [-20, -70], e: 'snap', er: 'lin' },
  ...flight(14.46, 14.86, [968, 214], [858, 44], 5200, [
    [14.56, { p: 'hTuck', spin: -150 }],
    [14.66, { p: 'hTuck', spin: -250 }],
    [14.77, { p: 'hLand', lean: 10, hF: [34, 26], hB: [-30, 24], fF: [14, -86], fB: [-12, -78], spin: -340 }],
  ], { p: 'hLand', spin: -360 }),
  // flying kick: B takes it on crossed arms; A springs off them
  { t: 14.94, x: 862, hip: [-6, 60], lean: 24, hF: [24, -40], hB: [-16, -44], fF: [30, 0], fB: [-30, 0] },
  { t: 15.0, x: 878, hip: [8, 88], lean: 20, hF: [30, 30], hB: [10, 40], fF: [24, 0], fB: [-36, 0], e: 'in' },
  ...flight(15.0, 15.2, [886, 84], [954, 132], 3000, [
    [15.1, { hip: [0, 0], lean: 4, hF: [26, -10], hB: [-24, 0], fF: [40, -40], fB: [-10, -60] }],
  ], { hip: [0, 0], lean: -42, tilt: 20, hF: [20, -34], hB: [-46, 0], fFw: (q) => off(q.B.hF, -8, -2), fB: [10, -56], e: 'snap' }),
  { t: 15.26, same: true },
  ...flight(15.26, 15.5, [954, 132], [864, 44], 3600, [
    [15.38, { hip: [0, 0], lean: 6, hF: [34, 26], hB: [-30, 24], fF: [20, -70], fB: [-10, -84] }],
  ], { p: 'hLand' }),
  // third time: a flying punch: it lands, and B simply plucks him out of the air and holds him
  // off the ground at arm's length. A kicks him in the face twice; B does not let go.
  { t: 15.56, x: 868, hip: [8, 66], lean: 32, hF: [20, -30], hB: [-40, -10], fF: [30, 0], fB: [-36, 0] },
  { t: 15.62, x: 884, hip: [10, 88], lean: 26, hF: [30, 10], hB: [-50, 20], fF: [20, 0], fB: [-40, 0], e: 'in' },
  ...flight(15.62, 15.84, [894, 84], [1004, 148], 3000, [
    [15.73, { hip: [0, 0], lean: 30, hF: [-40, 30], hB: [40, 0], fF: [30, -50], fB: [-40, -60] }],
  ], { hip: [0, 0], lean: 12, hFw: (q) => off(q.B.head, -19, 0), hB: [-16, -30], fF: [6, -92], fB: [-30, -78], e: 'snap' }),
  { t: 15.92, x: 1004, y: 166, hip: [0, 0], lean: -14, tilt: -18, hF: [44, 14], hB: [34, 30], fF: [44, -72], fB: [24, -88], e: 'out' },
  { t: 15.98, x: 1004, y: 168, hip: [0, 0], lean: -4, hF: [34, -30], hB: [30, -44], fF: [26, -50], fB: [-10, -92] },
  { t: 16.04, x: 1004, y: 168, hip: [0, 0], lean: -20, tilt: 12, hF: [30, -36], hB: [26, -50], fFw: (q) => off(q.B.head, -19, -4), fB: [-16, -88], e: 'snap' },
  { t: 16.1, x: 1004, y: 168, hip: [0, 0], lean: -8, hF: [32, -32], hB: [28, -46], fF: [40, -40], fB: [14, -56] },
  { t: 16.17, x: 1004, y: 168, hip: [0, 0], lean: -20, tilt: 12, hF: [30, -36], hB: [26, -50], fF: [20, -84], fBw: (q) => off(q.B.head, -19, -12), e: 'snap' },
  { t: 16.25, x: 1004, y: 170, hip: [0, 0], lean: 2, tilt: -8, hF: [34, -30], hB: [30, -44], fF: [14, -92], fB: [-10, -94] },
  { t: 16.34, x: 1012, y: 138, hip: [0, 0], lean: -10, tilt: -16, hF: [30, -20], hB: [24, -36], fF: [26, -84], fB: [2, -92] },
  // pressed overhead
  { t: 16.39, x: 1092, y: 214, hip: [0, 0], spin: -50, hF: [-20, 40], hB: [30, 30], fF: [30, -80], fB: [-20, -86], e: 'lin', er: 'lin' },
  { t: 16.45, x: 1118, y: 268, hip: [0, 0], spin: -90, hF: [-30, 50], hB: [40, 30], fF: [40, -76], fB: [-10, -92], e: 'out', er: 'out' },
  { t: 16.53, x: 1118, y: 272, hip: [0, 0], spin: -92, hF: [30, 60], hB: [-30, 40], fF: [-10, -94], fB: [50, -66] },
  { t: 16.61, x: 1140, y: 262, hip: [0, 0], spin: -84, hF: [-34, 40], hB: [44, 20], fF: [44, -70], fB: [-14, -90] },
  // …and thrown the length of the page
  { t: 16.7, x: 1053, y: 252, hip: [0, 0], spin: -100, hF: [10, 70], hB: [-30, 60], fF: [10, -96], fB: [-30, -84], e: 'in', er: 'in' },
  ...flight(16.7, 17.26, [1053, 252], [566, 70], 3200, [
    [16.84, { p: 'hRag', face: -1, spin: 118 }],
    [16.98, { p: 'hRag', face: -1, spin: 142, hF: [30, 60], hB: [-20, 50] }],
    [17.12, { p: 'hSuper', face: -1, spin: 168, lean: 10, fF: [30, -70], fB: [-10, -86] }],
  ], { p: 'hTuck', face: -1, spin: 196, hF: [20, 50], hB: [34, 30] }),
  // dive roll, up, turns
  { t: 17.34, x: 520, y: 14, p: 'hTuck', spin: 262, e: 'lin', er: 'lin' },
  { t: 17.42, x: 482, y: 27, p: 'hTuck', spin: 330, e: 'lin', er: 'lin' },
  { t: 17.5, x: 456, hip: [0, 46], lean: 32, bend: 10, hF: [22, -58], hB: [-12, -56], fF: [30, 0], fB: [-30, 0], e: 'lin', er: 'lin' },
  { t: 17.6, face: 1, x: 446, hip: [-4, 62], lean: 22, hF: [30, -30], hB: [4, -40], fF: [30, 0], fB: [-32, 0] },
  // ── last charge: straight back at him, a flying punch from too far out ──
  { t: 17.68, x: 444, hip: [-14, 68], lean: 6, hF: [30, -10], hB: [-10, -30], fF: [34, 0], fB: [-30, 0] },
  { t: 17.76, x: 530, p: 'run1', hop: 8, e: 'lin', er: 'lin' },
  { t: 17.84, x: 620, p: 'run2', hop: 8, e: 'lin', er: 'lin' },
  { t: 17.92, x: 708, p: 'run1', hop: 8, e: 'lin', er: 'lin' },
  { t: 17.98, x: 756, hip: [10, 84], lean: 32, hF: [-40, 10], hB: [40, -10], fF: [30, 0], fB: [-60, 20], e: 'lin', er: 'lin' },
  ...flight(17.98, 18.16, [766, 80], off(WRIST[18.16], 132 * Math.cos(190 * DEG), 132 * Math.sin(190 * DEG)), 2600, [
    [18.07, { hip: [0, 0], lean: 60, hF: [-30, 30], hB: [50, 10], fF: [-20, -80], fB: [-70, -50] }],
  ], byWrist(18.16, WRIST[18.16], 190, { e: 'snap' })),
  // caught by the wrist: his own speed swings him under B's fist, and he is hoisted off the page
  byWrist(18.22, WRIST[18.22], 224, { D: 126, lean: -14, bend: 10, hB: [30, 10], fF: [40, -78], fB: [14, -94] }),
  byWrist(18.3, WRIST[18.3], 250, { D: 128, lean: -8, hB: [26, -20], fFw: (q) => off(q.B.kF, -8, 8), fB: [-4, -96], e: 'out', er: 'out' }),
  // dangling: braces a foot on B's knee to hold himself off, claws at the fist; B looks at the wall
  byWrist(18.38, WRIST[18.38], 247, { D: 128, lean: -4, hBw: (q) => off(q.B.hF, -8, -6), fFw: (q) => off(q.B.kF, -8, 8), fB: [-26, -84], e: 'io', er: 'io' }),
  byWrist(18.46, WRIST[18.46], 251, { D: 128, lean: -8, hBw: (q) => off(q.B.hF, -8, -6), fFw: (q) => off(q.B.kF, -8, 8), fB: [10, -94], e: 'io', er: 'io' }),
  // drawn back like a hammer…
  byWrist(18.54, WRIST[18.54], 228, { D: 126, lean: 12, bend: -8, hB: [10, 40], fF: [-10, -96], fB: [-34, -82], e: 'in', er: 'in' }),
  byWrist(18.62, WRIST[18.62], 198, { hB: [-20, 50], fF: [-6, -98], fB: [-24, -90], e: 'out', er: 'out' }),
  // …then whipped up and over B's head: the fist leads, the body sags behind it, then cracks straight
  byWrist(18.69, WRIST[18.69], 224, { D: 124, lean: -16, bend: 16, hB: [34, 6], fF: [36, -80], fB: [54, -58] }),
  byWrist(18.76, WRIST[18.76], 212, { D: 124, lean: -18, bend: 18, hB: [40, 0], fF: [44, -74], fB: [60, -50] }),
  byWrist(18.82, WRIST[18.82], 194, { D: 126, lean: -10, bend: 10, hB: [30, 20], fF: [24, -90], fB: [40, -74] }),
  byWrist(18.86, WRIST[18.86], 180, { hB: [10, 44], fF: [-4, -98], fB: [10, -94] }),
  byWrist(18.9, WRIST[18.9], 168, { e: 'in', er: 'in' }),
  // …and hurled into the wall
  ...flight(18.9, 19.08, [1089, 242], [1540, 188], 2400, [
    [18.99, { p: 'hSuper', spin: 96 }],
  ], { p: 'hSuper', spin: 92, hF: [10, 60], hB: [-6, 64] }),
  { t: 19.12, x: 1556, y: 188, p: 'hSuper', spin: 100, lean: 20, bend: 14, hF: [30, 30], hB: [-30, 40], fF: [30, -80], fB: [-20, -90] },
  ...flight(19.12, 20.3, [1556, 188], [2700, 110], 500, [
    [19.3, { p: 'hRag', spin: 180 }],
    [19.48, { p: 'hTuck', spin: 270 }],
    [19.66, { p: 'hRag', spin: 350, hF: [20, 60], hB: [-50, 20] }],
    [19.84, { p: 'hRag', spin: 408, hF: [-30, 56], hB: [26, 64], fF: [44, -70], fB: [-24, -88] }],
    [20.0, { p: 'hRag', spin: 428, lean: -10, hF: [-44, 40], hB: [10, 70], fF: [54, -60], fB: [-10, -94] }],
  ], { p: 'hRag', spin: 470 }),
];

const B_NEW = [
  { t: 9.86, p: 'bStance', hip: [0, 86], lean: -6, tilt: -16, hF: [36, -30], hB: [-32, -34] },
  { t: 9.95, p: 'bStance', hip: [6, 80], lean: 14, hF: [40, -14], hB: [-20, -28] },
  // 1 · the jab snaps his head back
  { t: 10.0, hip: [-4, 84], lean: 0, tilt: -28, hF: [34, -6], hB: [-24, -24], fF: [46, 0], fB: [-46, 0], e: 'snap' },
  { t: 10.07, hip: [-8, 84], lean: -6, tilt: -14, hF: [38, 0], hB: [-14, -24], fF: [46, 0], fB: [-46, 0] },
  // 2 · the cross folds him in half
  { t: 10.14, x: 1490, hip: [-24, 76], lean: 18, bend: 24, tilt: 16, hF: [32, -44], hB: [20, -40], fF: [46, 0], fB: [-46, 0], e: 'snap' },
  { t: 10.19, same: true },
  { t: 10.3, x: 1500, hip: [-18, 72], lean: 28, bend: 20, tilt: 12, hF: [28, -42], hB: [8, -46], fF: [44, 0], fB: [-46, 0], slide: true, e: 'out' },
  // comes back at him: and steps straight onto the low kick
  { t: 10.38, hip: [4, 80], lean: 22, tilt: -12, hF: [54, -2], hB: [-30, -4], fF: [58, 0], fB: [-46, 0] },
  // 3 · the leg goes from under him: down on one knee, a hand on the page
  { t: 10.42, hip: [2, 66], lean: 30, tilt: 4, hF: [46, -30], hB: [-26, -28], fF: [34, 0], fB: [-46, 0], slide: true, e: 'snap' },
  { t: 10.52, hip: [0, 54], lean: 36, bend: 14, tilt: 12, hF: [26, -72], hB: [-10, -50], fF: [34, 0], fB: [-56, 0] },
  { t: 10.63, hip: [0, 60], lean: 24, tilt: -20, hF: [34, -50], hB: [-14, -40], fF: [34, 0], fB: [-56, 0] },
  // 4 · the uppercut stands him up
  { t: 10.7, x: 1506, hip: [-8, 90], lean: -10, tilt: -28, hF: [40, 12], hB: [22, 26], fF: [34, 6], fB: [-44, 0], e: 'snap' },
  { t: 10.77, x: 1510, hip: [-14, 92], lean: -22, tilt: -30, hF: [46, 28], hB: [32, 40], fF: [36, 10], fB: [-44, 0], e: 'out' },
  { t: 10.88, x: 1520, hip: [-10, 82], lean: -8, tilt: -8, hF: [38, 10], hB: [-36, 8], fF: [42, 0], fB: [-46, 0] },
  { t: 10.97, x: 1524, hip: [-4, 80], lean: 6, tilt: 8, hF: [30, -20], hB: [-20, -26], fF: [44, 0], fB: [-46, 0] },
  // 5 · the high kick sends him into the wall
  { t: 11.04, x: 1524, hip: [-10, 80], lean: -8, tilt: -30, hF: [44, 14], hB: [30, 24], fF: [40, 4], fB: [-44, 0], e: 'snap' },
  { t: 11.12, x: 1530, p: 'hitBack', e: 'out' },
  { t: 11.26, x: 1548, p: 'stagger', slide: true, e: 'out' },
  // back against the wall, shakes his head
  { t: 11.4, x: 1562, hip: [-14, 78], lean: -12, tilt: -14, hF: [20, -30], hB: [-26, -20], fF: [40, 0], fB: [-44, 0] },
  { t: 11.54, hip: [-10, 80], lean: 0, tilt: 12, hF: [24, -36], hB: [-20, -34], fF: [40, 0], fB: [-44, 0] },
  // catches the kick
  { t: 11.66, x: 1556, hip: [6, 84], lean: 12, hFw: ANKLE[11.66], hB: [-30, -10], fF: [46, 0], fB: [-46, 0], e: 'snap' },
  { t: 11.76, hip: [4, 86], lean: 8, tilt: -10, hFw: ANKLE[11.66], hBw: grab2(ANKLE[11.66]), fF: [46, 0], fB: [-46, 0] },
  { t: 11.92, hip: [8, 70], lean: 28, hFw: ANKLE[11.92], hBw: grab2(ANKLE[11.92]), fF: [46, 0], fB: [-46, 0] },
  // heaves him overhead and slams him down
  { t: 12.0, hip: [4, 82], lean: 10, hFw: ANKLE[12.0], hBw: grab2(ANKLE[12.0]), fF: [46, 0], fB: [-46, 0], e: 'lin' },
  { t: 12.08, hip: [-6, 96], lean: -8, hFw: ANKLE[12.08], hBw: grab2(ANKLE[12.08]), fF: [46, 0], fB: [-46, 0], e: 'lin' },
  { t: 12.16, hip: [-10, 100], lean: -14, tilt: -14, hFw: ANKLE[12.16], hBw: grab2(ANKLE[12.16]), fF: [46, 0], fB: [-46, 0], e: 'lin' },
  { t: 12.23, hip: [-8, 102], lean: -10, tilt: -20, hFw: ANKLE[12.23], hBw: grab2(ANKLE[12.23]), fF: [46, 0], fB: [-46, 0], e: 'out' },
  { t: 12.3, x: 1552, hip: [4, 96], lean: 12, hFw: ANKLE[12.3], hBw: grab2(ANKLE[12.3]), fF: [46, 0], fB: [-46, 0], e: 'lin' },
  { t: 12.36, x: 1550, hip: [12, 80], lean: 36, hFw: ANKLE[12.36], hBw: grab2(ANKLE[12.36]), fF: [56, 0], fB: [-48, 0], e: 'lin' },
  { t: 12.42, x: 1550, hip: [16, 58], lean: 56, bend: 10, hFw: ANKLE[12.42], hBw: grab2(ANKLE[12.42]), fF: [58, 0], fB: [-50, 0], e: 'in' },
  { t: 12.52, same: true },
  // lets go, rears back, punts him across the page
  { t: 12.64, x: 1552, hip: [0, 82], lean: 14, hF: [24, -44], hB: [-16, -44], fF: [58, 0], fB: [-48, 0] },
  { t: 12.78, hip: [-4, 90], lean: -10, hF: [30, 0], hB: [-40, -10], fF: [58, 0], fB: [-66, 46], e: 'out' },
  { t: 12.86, hip: [6, 90], lean: -18, hF: [-30, -10], hB: [40, 10], fF: [58, 0], fBw: (q) => off(q.A.hF, 14, -6), e: 'in3' },
  { t: 12.92, same: true },
  { t: 13.02, hip: [4, 94], lean: -22, hF: [-36, 0], hB: [44, 20], fF: [58, 0], fB: [96, 96] },
  // stalks after him: five heavy strides
  { t: 13.16, x: 1470, hip: [0, 84], lean: 14, hF: [20, -40], hB: [-24, -36], fF: [-16, 0], fB: [30, 0] },
  { t: 13.31, x: 1394, hip: [0, 84], lean: 20, bend: 8, hF: [-24, -34], hB: [30, -26], fF: [39, 0], fB: [-39, 0], hop: 5 },
  { t: 13.46, x: 1308, hip: [0, 84], lean: 20, bend: 8, hF: [30, -26], hB: [-24, -34], fF: [-39, 0], fB: [39, 0], hop: 5 },
  { t: 13.61, x: 1222, hip: [0, 84], lean: 20, bend: 8, hF: [-24, -34], hB: [30, -26], fF: [39, 0], fB: [-39, 0], hop: 5 },
  { t: 13.76, x: 1136, hip: [0, 84], lean: 22, bend: 8, hF: [30, -26], hB: [-24, -34], fF: [-39, 0], fB: [39, 0], hop: 5 },
  { t: 13.91, x: 1050, hip: [0, 84], lean: 22, bend: 8, hF: [-24, -34], hB: [30, -26], fF: [39, 0], fB: [-39, 0], hop: 5 },
  { t: 14.04, x: 1046, hip: [0, 82], lean: 18, bend: 8, hF: [34, -20], hB: [-30, -10], fF: [36, 0], fB: [-46, 0] },
  // big hook: A is already under it and climbing
  { t: 14.13, hip: [-10, 82], lean: 2, hB: [-58, 20], hF: [34, -10], fF: [44, 0], fB: [-46, 0] },
  { t: 14.22, hip: [8, 80], lean: 26, hB: [84, 22], hF: [10, -20], fF: [44, 0], fB: [-46, 0], e: 'snap' },
  { t: 14.27, hip: [8, 78], lean: 24, hB: [50, -30], hF: [-6, -30], fF: [44, 0], fB: [-46, 0] },
  { t: 14.32, hip: [-2, 80], lean: 8, hB: [34, -44], hF: [-4, -40], fF: [44, 0], fB: [-46, 0] },
  { t: 14.39, hip: [-6, 82], lean: -2, hB: [24, -36], hF: [0, -36], fF: [44, 0], fB: [-46, 0] },
  { t: 14.46, hip: [-8, 84], lean: -12, tilt: -30, hF: [44, 16], hB: [30, 26], fF: [44, 0], fB: [-46, 0], e: 'snap' },
  { t: 14.54, x: 1060, p: 'hitBack', e: 'out' },
  { t: 14.68, x: 1078, p: 'stagger', slide: true, e: 'out' },
  { t: 14.86, hip: [-4, 78], lean: 12, tilt: 14, hF: [30, -30], hB: [-10, -36], fF: [46, 0], fB: [-46, 0] },
  { t: 15.0, p: 'bStance', tilt: -4 },
  // crossed-arm block: driven back a step
  { t: 15.12, p: 'bStance', hip: [-6, 78], lean: 6, tilt: 0, hF: [33, 6], hB: [30, -4], e: 'out' },
  { t: 15.2, x: 1086, p: 'bStance', hip: [-12, 76], lean: -2, tilt: 0, hF: [31, 6], hB: [28, -4], e: 'snap' },
  { t: 15.26, same: true },
  { t: 15.4, x: 1113, p: 'bStance', hip: [-6, 76], lean: 8, tilt: 0, hF: [33, 4], hB: [30, -6], slide: true, e: 'out' },
  // opens his arms… and catches A by the ribs at full reach
  { t: 15.54, p: 'bStance', hip: [0, 80], lean: 12, hF: [42, 20], hB: [-50, 24] },
  { t: 15.72, p: 'bStance', hip: [4, 74], lean: 18, hF: [46, 32], hB: [-56, 32] },
  { t: 15.84, p: 'bStance', hip: [8, 82], lean: 12, tilt: -24, hFw: (q) => RIBS(q, 0.62), hBw: (q) => RIBS(q, 0.24), e: 'snap' },
  { t: 15.92, p: 'bStance', hip: [4, 88], lean: 4, tilt: -8, hFw: (q) => RIBS(q, 0.62), hBw: (q) => RIBS(q, 0.24), e: 'out' },
  { t: 15.98, p: 'bStance', hip: [4, 88], lean: 4, tilt: -4, hFw: (q) => RIBS(q, 0.62), hBw: (q) => RIBS(q, 0.24) },
  { t: 16.04, p: 'bStance', hip: [8, 88], lean: 6, tilt: -40, hFw: (q) => RIBS(q, 0.62), hBw: (q) => RIBS(q, 0.24), e: 'snap' },
  { t: 16.1, p: 'bStance', hip: [4, 88], lean: 4, tilt: -6, hFw: (q) => RIBS(q, 0.62), hBw: (q) => RIBS(q, 0.24) },
  { t: 16.17, p: 'bStance', hip: [8, 88], lean: 6, tilt: -42, hFw: (q) => RIBS(q, 0.62), hBw: (q) => RIBS(q, 0.24), e: 'snap' },
  { t: 16.25, p: 'bStance', hip: [4, 88], lean: 4, tilt: 0, hFw: (q) => RIBS(q, 0.62), hBw: (q) => RIBS(q, 0.24) },
  // sinks, presses him overhead
  { t: 16.34, p: 'bStance', hip: [10, 66], lean: 26, hFw: (q) => RIBS(q, 0.62), hBw: (q) => RIBS(q, 0.2) },
  { t: 16.39, p: 'bStance', hip: [0, 86], lean: 6, hFw: (q) => off(mix(q.A.hip, q.A.sh, 0.6), 0, -6), hBw: (q) => off(q.A.hip, 16, -6), e: 'lin' },
  { t: 16.45, p: 'bStance', hip: [0, 100], lean: 0, tilt: -16, hFw: (q) => off(mix(q.A.hip, q.A.sh, 0.6), 0, -6), hBw: (q) => off(q.A.hip, 22, -6), e: 'out' },
  { t: 16.53, p: 'bStance', hip: [0, 98], lean: 0, tilt: -26, hFw: (q) => off(mix(q.A.hip, q.A.sh, 0.6), 0, -6), hBw: (q) => off(q.A.hip, 22, -6) },
  { t: 16.61, p: 'bStance', hip: [-10, 96], lean: -14, tilt: -10, hFw: (q) => off(mix(q.A.hip, q.A.sh, 0.6), 0, -6), hBw: (q) => off(q.A.hip, 22, -6) },
  // throws him
  { t: 16.7, x: 1100, hip: [10, 92], lean: 20, hFw: (q) => off(mix(q.A.hip, q.A.sh, 0.5), 0, -6), hBw: (q) => off(q.A.hip, 22, -6), fF: [56, 0], fB: [-40, 0], e: 'in' },
  { t: 16.78, hip: [18, 76], lean: 50, hF: [72, -14], hB: [60, -34], fF: [56, 0], fB: [-40, 0], e: 'out' },
  { t: 16.96, hip: [6, 80], lean: 26, hF: [30, -50], hB: [0, -56], fF: [56, 0], fB: [-40, 0] },
  { t: 17.16, x: 1108, p: 'bStance', hip: [0, 90], lean: 4, tilt: -10 },
  // waits for him: fist into palm
  { t: 17.4, p: 'bStance', hip: [0, 94], lean: -2, tilt: -12, hF: [26, -4], hB: [-34, 0] },
  { t: 17.5, p: 'bStance', hip: [0, 90], lean: 6, tilt: -4, hF: [26, -14], hB: [22, -12], e: 'snap' },
  { t: 17.62, same: true },
  { t: 17.74, p: 'bStance', hip: [0, 92], lean: -8, tilt: -16, hF: [48, 4], hB: [-54, 0] },
  { t: 17.96, p: 'bStance', hip: [2, 74], lean: 22, hF: [46, -4], hB: [-40, -6] },
  { t: 18.08, p: 'bStance', hip: [4, 78], lean: 18, hF: [56, 16], hB: [-44, 0] },
  // catches the fist out of the air and hoists A off the page by it
  { t: 18.16, p: 'bStance', hip: [6, 84], lean: 10, hFw: WRIST[18.16], hB: [-40, 6], e: 'snap' },
  { t: 18.22, p: 'bStance', hip: [-2, 84], lean: 2, tilt: -4, hFw: WRIST[18.22], hB: [-44, 10] },
  { t: 18.3, p: 'bStance', hip: [2, 94], lean: 2, tilt: 10, hFw: WRIST[18.3], hB: [-36, -20], e: 'out' },
  // holds him there; looks over his shoulder at the wall
  { t: 18.38, p: 'bStance', hip: [2, 96], lean: 0, tilt: -44, hFw: WRIST[18.38], hB: [-40, -24] },
  { t: 18.46, p: 'bStance', hip: [2, 94], lean: 2, tilt: 14, hFw: WRIST[18.46], hB: [-30, -30] },
  // winds up: sinks and draws A back…
  { t: 18.54, p: 'bStance', hip: [10, 78], lean: 20, hFw: WRIST[18.54], hB: [-46, 6], e: 'in' },
  { t: 18.62, p: 'bStance', hip: [16, 66], lean: 32, hFw: WRIST[18.62], hB: [-56, 20], fF: [52, 0], fB: [-46, 0], e: 'out' },
  // …pivots, and hurls him overhand at the wall
  { t: 18.69, p: 'bStance', hip: [8, 86], lean: 16, hFw: WRIST[18.69], hB: [-50, 24], fF: [52, 0], fB: [-46, 0], e: 'lin' },
  { t: 18.76, face: 1, x: 1116, hip: [-4, 100], lean: 0, hFw: WRIST[18.76], hB: [-30, 20], fF: [34, 0], fB: [-36, 0], e: 'lin' },
  { t: 18.82, x: 1124, hip: [8, 94], lean: 16, hFw: WRIST[18.82], hB: [-46, 14], fF: [48, 0], fB: [-40, 0], e: 'lin' },
  { t: 18.86, x: 1134, hip: [14, 86], lean: 32, hFw: WRIST[18.86], hB: [-52, 16], fF: [56, 0], fB: [-46, 0], e: 'lin' },
  { t: 18.9, x: 1143, hip: [18, 78], lean: 44, hFw: WRIST[18.9], hB: [-56, 20], fF: [60, 0], fB: [-50, 0], e: 'in' },
  { t: 18.96, hip: [22, 68], lean: 60, hF: [44, -60], hB: [-50, 24], fF: [60, 0], fB: [-50, 0] },
  // …and goes after him, shoulder first
  { t: 19.03, x: 1196, p: 'bRun2', hop: 8, e: 'lin', er: 'lin' },
  { t: 19.1, x: 1280, p: 'bRun1', hop: 10, e: 'lin', er: 'lin' },
  { t: 19.17, x: 1364, p: 'bRun2', hop: 10, e: 'lin', er: 'lin' },
  { t: 19.24, x: 1448, p: 'bRun1', hop: 10, e: 'lin', er: 'lin' },
  { t: 19.31, x: 1528, p: 'bRun2', hop: 10, e: 'lin', er: 'lin' },
  { t: 19.37, x: 1572, hip: [10, 72], lean: 50, bend: 10, hF: [20, -30], hB: [-30, -30], fF: [40, 0], fB: [-60, 20], e: 'lin', er: 'lin' },
  ...flight(19.37, 20.3, [1572, 0], [2400, 0], 1000, [
    [19.44, { hip: [0, 78], lean: 64, bend: 8, tilt: -20, hF: [30, -20], hB: [-20, -40], fF: [-30, 20], fB: [-80, 30] }],
    [19.6, { hip: [0, 78], lean: 74, tilt: -24, hF: [60, 30], hB: [-10, -40], fF: [-40, 30], fB: [-90, 44] }],
    [19.8, { hip: [0, 78], lean: 80, tilt: -30, hF: [70, 36], hB: [40, 50], fF: [-50, 40], fB: [-94, 50] }],
    [20.0, { hip: [0, 78], lean: 84, tilt: -30, hF: [74, 30], hB: [56, 46], fF: [-60, 44], fB: [-96, 40] }],
  ], { hip: [0, 78], lean: 90, hF: [70, 20], hB: [60, 30], fF: [-60, 40], fB: [-96, 40] }),
];

// Contact pins written as functions are resolved against the other fighter's solved pose at the
// same instant (a fist on a chin, a foot on a knee, B's hands on A's back), so the two tracks
// stay locked together when either one is retimed.
function resolvePins(aKeys, bKeys) {
  const PINS = [['hFw', 'hF'], ['hBw', 'hB'], ['fFw', 'fF'], ['fBw', 'fB']];
  const bake = (keys, at) => keys.map((k) => {
    const o = { ...k };
    for (const [n] of PINS) {
      if (typeof o[n] !== 'function') continue;
      if (at) o[n] = o[n](at(k.t)); else delete o[n];
    }
    return o;
  });
  let A = bake(aKeys, null), B = bake(bKeys, null), tA, tB;
  for (let i = 0; i < 4; i++) {
    tA = makeTrack(FIGHTER_A, A, POSES2);
    tB = makeTrack(FIGHTER_B, B, POSES2);
    const at = (t) => ({ A: pose(tA, t), B: pose(tB, t) });
    A = bake(aKeys, at);
    B = bake(bKeys, at);
  }
  tA = makeTrack(FIGHTER_A, A, POSES2);
  tB = makeTrack(FIGHTER_B, B, POSES2);
  for (const [name, keys, tr] of [['A', A, tA], ['B', B, tB]]) for (const k of keys) for (const [n, j] of PINS) {
    if (!k[n] || k.t < 9.45) continue;
    const J = pose(tr, k.t)[j];
    const d = Math.hypot(J[0] - k[n][0], J[1] - k[n][1]);
    if (d > 5) console.warn(`[s1] ${name}.${n} at t=${k.t} misses its target by ${d.toFixed(0)} units`);
  }
  return { A, B, at: (t) => ({ A: pose(tA, t), B: pose(tB, t) }) };
}

const SOLVED = resolvePins([...A_KEYS, ...A_NEW], [...B_KEYS, ...B_NEW]);
S.fighters({ A: SOLVED.A, B: SOLVED.B });

// the pencil stays planted in the page for the whole scene (set dressing; it pays off in scene 2)
S.weapon('pencil', [{ t: 0, type: 'pencil', at: [1247.5, 104], ang: 98 }]);

// ── camera ───────────────────────────────────────────────────────────────────
const CAM_KEYS = [
  // top-down reveal of the notebook page, slow push to the fighters
  { t: 0.0, x: 1100, y: -265, z: 0.5, r: -6 },
  { t: 2.9, a: 0.5, b: 0.5, y: -150, z: 1.42, r: 0, e: 'io3' },
  { t: 3.06, a: 0.5, b: 0.5, y: -150, z: 1.42 },
  { t: 3.4, a: 0.5, b: 0.5, y: -145, z: 1.55, e: 'out' },          // whips with B's dash
  { t: 3.84, a: 0.5, b: 0.5, y: -150, z: 1.6 },
  { t: 3.9, a: 0.5, b: 0.5, y: -158, z: 1.9, e: 'snap' },          // punch-in on the kick
  { t: 4.3, a: 0.5, b: 0.5, y: -145, z: 1.45, e: 'out' },
  { t: 4.6, a: 0.5, b: 0.5, y: -150, z: 1.7 },
  { t: 5.6, a: 0.5, b: 0.5, y: -150, z: 1.82, e: 'lin' },          // creeps in through the exchange
  { t: 5.86, a: 0.5, b: 0.5, y: -150, z: 1.9 },
  { t: 5.95, a: 0.5, b: 0.5, y: -150, z: 1.5, e: 'snap' },
  { t: 6.3, a: 0.72, b: 0.28, y: -150, z: 1.22, e: 'out' },        // whip-pan right with A's flight
  { t: 6.62, a: 0.5, b: 0.5, y: -160, z: 1.16 },
  { t: 7.2, a: 0.6, b: 0.4, x: 10, y: -185, z: 1.9, e: 'in' },     // rushes in with the punch
  { t: 7.6, x: 1528, y: -212, z: 2.35, r: 3, e: 'out' },           // slow-motion close-up
  { t: 8.5, x: 1566, y: -222, z: 2.6, r: 6, e: 'lin' },
  { t: 8.6, x: 1574, y: -222, z: 2.7, r: 6 },
  { t: 8.76, x: 1540, y: -235, z: 1.2, r: 0, e: 'snap' },          // snaps wide on the wall impact
  { t: 9.45, x: 1460, y: -235, z: 1.2 },
];

const CAM_NEW = [
  { t: 9.9, a: 0.5, b: 0.5, y: -162, z: 2.2, e: 'io' },                     // pushes in as they square up
  { t: 9.98, a: 0.5, b: 0.5, y: -165, z: 2.26 },
  { t: 10.02, a: 0.5, b: 0.5, y: -168, z: 2.42, e: 'snap' },                 // jab
  { t: 10.12, a: 0.5, b: 0.5, y: -160, z: 2.36 },
  { t: 10.16, a: 0.5, b: 0.5, y: -152, z: 2.54, r: -2, e: 'snap' },          // cross
  { t: 10.34, a: 0.5, b: 0.5, y: -150, z: 2.2, r: 0, e: 'out' },            // breathes out with A's hop back
  { t: 10.4, a: 0.5, b: 0.5, y: -135, z: 2.26 },
  { t: 10.45, a: 0.5, b: 0.5, y: -118, z: 2.56, r: 3, e: 'snap' },           // drops low for the leg kick
  { t: 10.62, a: 0.5, b: 0.5, y: -128, z: 2.4, r: 2 },
  { t: 10.68, a: 0.5, b: 0.5, y: -150, z: 2.4, r: 0 },
  { t: 10.73, a: 0.5, b: 0.5, y: -188, z: 2.7, r: -4, e: 'snap' },          // tilts up with the uppercut
  { t: 10.94, a: 0.5, b: 0.5, y: -168, z: 2.2, r: 0, e: 'out' },             // room for the wind-up
  { t: 11.02, a: 0.5, b: 0.5, y: -168, z: 2.24 },
  { t: 11.07, a: 0.5, b: 0.5, y: -174, z: 2.6, r: -3, e: 'snap' },          // punch-in on the high kick
  { t: 11.4, a: 0.5, b: 0.5, y: -160, z: 1.62, r: 0, e: 'out' },
  { t: 11.62, a: 0.5, b: 0.5, y: -160, z: 1.7 },
  { t: 11.68, a: 0.5, b: 0.5, y: -165, z: 1.92, e: 'snap' },                 // the catch
  { t: 11.92, a: 0.5, b: 0.5, y: -165, z: 1.8 },
  { t: 12.2, x: 1470, y: -300, z: 1.14, r: 3, e: 'out' },                    // tilts up as A is heaved overhead
  { t: 12.4, x: 1452, y: -180, z: 1.42, r: 0, e: 'in' },                     // …and comes down with him
  { t: 12.46, x: 1450, y: -170, z: 1.66, e: 'snap' },
  { t: 12.8, x: 1450, y: -150, z: 1.56 },
  { t: 12.9, x: 1440, y: -150, z: 1.6 },
  { t: 13.36, a: 0.7, b: 0.3, y: -175, z: 1.02, e: 'out' },                  // whip-pan left with A's flight
  { t: 13.9, a: 0.5, b: 0.5, y: -160, z: 1.42, e: 'io' },
  { t: 14.25, a: 0.5, b: 0.5, y: -165, z: 1.62 },
  { t: 14.44, a: 0.4, b: 0.6, y: -200, z: 1.72 },
  { t: 14.49, a: 0.4, b: 0.6, y: -205, z: 1.92, e: 'snap' },                 // the flip kick
  { t: 14.86, a: 0.5, b: 0.5, y: -170, z: 1.5, e: 'out' },
  { t: 15.18, a: 0.5, b: 0.5, y: -170, z: 1.6 },
  { t: 15.23, a: 0.5, b: 0.5, y: -170, z: 1.74, e: 'snap' },
  { t: 15.6, a: 0.5, b: 0.5, y: -165, z: 1.58 },
  { t: 15.86, a: 0.5, b: 0.5, y: -185, z: 2.2, r: -2, e: 'in' },             // closes in: A held out at arm's length
  { t: 16.02, a: 0.5, b: 0.5, y: -188, z: 2.3, r: 0, e: 'lin' },
  { t: 16.06, a: 0.5, b: 0.5, y: -192, z: 2.46, r: 2, e: 'snap' },           // first kick
  { t: 16.3, a: 0.5, b: 0.5, y: -190, z: 2.5, r: 4, e: 'lin' },
  { t: 16.47, a: 0.2, b: 0.8, y: -235, z: 1.5, r: 0, e: 'out' },             // pressed overhead
  { t: 16.64, a: 0.2, b: 0.8, y: -238, z: 1.46 },
  { t: 17.26, a: 0.6, b: 0.4, y: -200, z: 0.95, e: 'out' },                  // thrown: whip left and wide
  { t: 17.62, a: 0.5, b: 0.5, y: -205, z: 1.02, e: 'io' },                    // a breath of distance: A far left, B waiting
  { t: 17.72, a: 0.5, b: 0.5, y: -205, z: 1.06 },
  { t: 18.13, a: 0.3, b: 0.7, y: -200, z: 1.72, e: 'in' },                   // rushes in with A's charge
  { t: 18.18, a: 0.3, b: 0.7, y: -205, z: 1.95, e: 'snap' },                 // the catch
  { t: 18.3, a: 0.3, b: 0.7, y: -200, z: 2.05, r: 2 },
  { t: 18.47, a: 0.3, b: 0.7, y: -196, z: 2.3, r: 5, e: 'lin' },             // slow rolling push-in on the dangling A
  { t: 18.62, a: 0.4, b: 0.6, y: -185, z: 1.9, r: -3, e: 'out' },            // swings back with the wind-up
  { t: 18.8, a: 0.2, b: 0.8, y: -238, z: 1.5, r: 0, e: 'in' },               // up and over
  { t: 18.9, x: 1190, y: -225, z: 1.3 },
  { t: 19.08, x: 1540, y: -230, z: 1.12, e: 'in' },                          // whips right with the throw
  { t: 19.13, x: 1570, y: -225, z: 1.28, e: 'snap' },
  { t: 19.5, x: 1840, y: -262, z: 1.02, e: 'out' },
  { t: 20.0, x: 1990, y: -275, z: 0.95, r: -2, e: 'lin' },                    // final frame: the wall going over
];

S.camera([...CAM_KEYS, ...CAM_NEW]);

const SHAKES = [
  { t: 1.94, amp: 8, dur: 0.28 },
  { t: 3.44, amp: 6, dur: 0.2 },
  { t: 3.86, amp: 18, dur: 0.32 },
  { t: 4.84, amp: 5, dur: 0.12 },
  { t: 5.28, amp: 7, dur: 0.16 },
  { t: 5.46, amp: 4, dur: 0.1 },
  { t: 5.88, amp: 22, dur: 0.36 },
  { t: 6.24, amp: 7, dur: 0.2 },
  { t: 6.4, amp: 3, dur: 0.1 }, { t: 6.52, amp: 4, dur: 0.1 }, { t: 6.64, amp: 5, dur: 0.1 },
  { t: 6.76, amp: 6, dur: 0.1 }, { t: 6.88, amp: 7, dur: 0.1 }, { t: 6.98, amp: 9, dur: 0.14 },
  { t: 8.6, amp: 40, dur: 0.7 },
  { t: 9.42, amp: 9, dur: 0.2 },
];

for (const s of SHAKES) S.shake(s.t, s.amp, s.dur);

const IMPACTS = [
  { t: 3.86, dur: 0.07 },
  { t: 5.88, dur: 0.07 },
  { t: 8.6, dur: 0.1 },
];

for (const i of IMPACTS) S.impact(i.t, i.dur);

S.slowmo(7.25, 8.56, (st) => st.B.hB, { sound: false, music: false });
S.musicHint(7.22, 8.6, 'suspend');

// ── effects ──────────────────────────────────────────────────────────────────
const FX = [
  { t: 1.66, type: 'dust', x: 822, n: 3, size: 0.6 },
  { t: 1.94, type: 'dust', x: 1090, n: 7, size: 1.0 },
  { t: 1.94, type: 'ring', x: 1090, h: 0, size: 0.7 },
  { t: 3.08, type: 'dust', x: 1205, n: 7, size: 1.1, dir: 1 },
  { t: 3.44, type: 'dust', x: 895, n: 6, size: 0.9, dir: -1 },
  { t: 3.86, type: 'burst', x: 941, h: 140, size: 1.35 },
  { t: 4.3, type: 'dust', x: 760, n: 5, size: 0.8, dir: -1 },
  { t: 4.68, type: 'burst', x: 1012, h: 160, size: 0.55 },
  { t: 4.84, type: 'burst', x: 915, h: 142, size: 0.7 },
  { t: 5.28, type: 'burst', x: 932, h: 166, size: 0.85 },
  { t: 5.46, type: 'burst', x: 956, h: 28, size: 0.6 },
  { t: 5.66, type: 'burst', x: 925, h: 146, size: 0.6 },
  { t: 5.88, type: 'burst', x: 1000, h: 132, size: 1.5 },
  { t: 5.88, type: 'ring', x: 1000, h: 0, size: 0.9 },
  { t: 6.24, type: 'dust', x: 1480, n: 6, size: 0.9, dir: 1 },
  { t: 6.4, type: 'dust', x: 1035, n: 3, size: 0.6, dir: -1 },
  { t: 6.52, type: 'dust', x: 1130, n: 3, size: 0.65, dir: -1 },
  { t: 6.64, type: 'dust', x: 1225, n: 3, size: 0.7, dir: -1 },
  { t: 6.76, type: 'dust', x: 1320, n: 4, size: 0.75, dir: -1 },
  { t: 6.88, type: 'dust', x: 1405, n: 4, size: 0.8, dir: -1 },
  { t: 6.98, type: 'dust', x: 1461, n: 6, size: 0.9 },
  { t: 8.6, type: 'burst', x: 1618, h: 146, size: 2.3 },
  { t: 8.6, type: 'splash', x: 1612, h: 146, n: 16, size: 1.2, dir: -1 },
  { t: 8.6, type: 'dust', x: 1600, n: 9, size: 1.3, dir: -1 },
  { t: 9.45, type: 'dust', x: 1325, n: 5, size: 0.8 },
];

for (const e of FX) S.fx(e);

const SKIDS = [
  { t0: 3.22, t1: 3.52, x0: 850, x1: 1065, seed: 1 },
  { t0: 3.9, t1: 4.3, x0: 985, x1: 760, seed: 2 },
  { t0: 6.24, t1: 6.5, x0: 1430, x1: 1606, seed: 3 },
];

for (const s of SKIDS) S.skid({ ...s, sound: false });

// ── sound ────────────────────────────────────────────────────────────────────
const CUES = [
  // ── 0:00–0:03  The Confrontation ─────────────────────────────────────────
  { t: 0.15, type: 'scribble', dur: 0.62, pan: -0.25 },            // Fighter A is drawn
  { t: 0.36, type: 'scribble', dur: 0.60, pan: 0.25 },             // Fighter B is drawn
  { t: 1.50, type: 'whoosh', size: 's', dur: 0.16, pan: -0.25 },   // A hops into stance
  { t: 1.66, type: 'step', weight: 0.35, pan: -0.25 },
  { t: 1.74, type: 'whoosh', size: 'm', dur: 0.22, pan: 0.25 },    // B lifts leg
  { t: 1.94, type: 'stomp', pan: 0.25 },                           // B stomps into stance
  { t: 2.62, type: 'riser', dur: 0.42 },                           // tension before the dash

  // ── 0:03–0:07  Explosive hand-to-hand ────────────────────────────────────
  { t: 3.04, type: 'whoosh', size: 'l', dur: 0.34, pan: 0.1 },     // B dashes
  { t: 3.24, type: 'skid', dur: 0.26, pan: -0.2 },                 // A slides under
  { t: 3.30, type: 'whoosh', size: 'm', dur: 0.14, pan: -0.25 },   // B's punch (miss)
  { t: 3.44, type: 'thud', weight: 0.8, pan: -0.15 },              // B lands
  { t: 3.70, type: 'whoosh', size: 'm', dur: 0.18, pan: -0.05 },   // A spinning kick
  { t: 3.86, type: 'hit', weight: 1.0, pan: -0.15 },               // KICK LANDS (impact frame)
  { t: 3.92, type: 'skid', dur: 0.36, pan: -0.3 },                 // B staggers back
  { t: 4.56, type: 'whoosh', size: 's', dur: 0.10, pan: -0.1 },    // B jab
  { t: 4.68, type: 'block', weight: 0.5, pan: -0.05 },             // A parries
  { t: 4.78, type: 'whoosh', size: 's', dur: 0.08, pan: -0.05 },
  { t: 4.84, type: 'hit', weight: 0.45, pan: -0.1 },               // A jab lands
  { t: 5.02, type: 'whoosh', size: 'l', dur: 0.18, pan: -0.05 },   // B hook (miss)
  { t: 5.22, type: 'whoosh', size: 's', dur: 0.08, pan: -0.05 },
  { t: 5.28, type: 'block', weight: 0.9, pan: -0.1 },              // B blocks uppercut
  { t: 5.42, type: 'whoosh', size: 's', dur: 0.07, pan: -0.05 },
  { t: 5.46, type: 'hit', weight: 0.5, pan: -0.1 },                // A low kick
  { t: 5.60, type: 'whoosh', size: 's', dur: 0.08, pan: -0.05 },
  { t: 5.66, type: 'block', weight: 0.7, pan: -0.1 },              // B catches A's fist
  { t: 5.80, type: 'whoosh', size: 'm', dur: 0.10, pan: -0.1 },
  { t: 5.88, type: 'hit', weight: 1.0, pan: -0.05 },               // B's body blow (impact frame)
  { t: 5.92, type: 'whoosh', size: 'l', dur: 0.32, pan: 0.2 },     // A flies back
  { t: 6.24, type: 'thud', weight: 0.5, pan: 0.45 },
  { t: 6.24, type: 'skid', dur: 0.30, pan: 0.5 },                  // A skids to the wall
  { t: 6.40, type: 'step', weight: 0.6, pan: -0.2 },               // B charges (6 heavy steps)
  { t: 6.52, type: 'step', weight: 0.7, pan: -0.1 },
  { t: 6.64, type: 'step', weight: 0.8, pan: 0.0 },
  { t: 6.76, type: 'step', weight: 0.9, pan: 0.1 },
  { t: 6.88, type: 'step', weight: 1.0, pan: 0.2 },
  { t: 6.98, type: 'stomp', gain: 0.8, pan: 0.3 },

  // ── 0:07–0:10  Slow-motion near miss → wall ──────────────────────────────
  { t: 7.08, type: 'whoosh', size: 'l', dur: 0.22, pan: 0.3 },     // the punch launches
  { t: 7.22, type: 'slowdown', dur: 1.30 },                        // time stretches (7.25–8.55)
  { t: 7.48, type: 'heartbeat' },
  { t: 8.08, type: 'heartbeat' },
  { t: 8.36, type: 'riser', dur: 0.24 },                           // snap back to speed
  { t: 8.60, type: 'wallbreak', size: 1.0, pan: 0.45 },            // FIST HITS WALL (impact frame)
  { t: 8.66, type: 'crumble', dur: 1.10, pan: 0.45 },              // bricks rain down
  { t: 8.78, type: 'whoosh', size: 'm', dur: 0.24, pan: 0.3 },     // A wall-kicks into a flip
  { t: 9.40, type: 'crumble', dur: 0.40, gain: 0.6, pan: 0.5 },    // B rips his arm free
  { t: 9.45, type: 'thud', weight: 0.4, pan: 0.15 },               // A lands
];

for (const c of CUES) S.cue(c);

// ── PART 2 events ────────────────────────────────────────────────────────────
// contacts whose position follows the solved poses
const Q = SOLVED.at;
const hitOn = (t, pick, o) => { const p = pick(Q(t)); S.hit({ t, x: p[0], h: p[1], ...o }); };
const stepOn = (t, pick, weight) => S.step({ t, x: pick(Q(t))[0], weight });

// squaring up
S.step({ t: 9.76, x: 1322, weight: 0.3 });
S.cue({ t: 9.86, type: 'boom', gain: 0.6, x: 1482 });
// the combination
S.whoosh({ t: 9.95, x: 1350, size: 's' });
hitOn(10.0, (q) => q.A.hF, { size: 0.75, weight: 0.45 });
S.whoosh({ t: 10.1, x: 1420, size: 's' });
hitOn(10.14, (q) => q.A.hB, { size: 0.9, weight: 0.6 });
stepOn(10.28, (q) => q.A.fB, 0.3);
S.whoosh({ t: 10.37, x: 1420, size: 'm', dur: 0.1 });
hitOn(10.42, (q) => q.A.fF, { size: 0.8, weight: 0.55 });
S.land({ t: 10.52, x: 1560, weight: 0.5 });                              // B's knee hits the page
S.whoosh({ t: 10.63, x: 1430, size: 'm' });
hitOn(10.7, (q) => q.A.hB, { size: 1.1, weight: 0.75 });
stepOn(10.88, (q) => q.B.fB, 0.6);
S.whoosh({ t: 10.97, x: 1460, size: 'm' });
hitOn(11.04, (q) => q.A.fF, { size: 1.45, weight: 1, impact: 0.05 });
S.skid({ t0: 11.1, t1: 11.3, x0: 1462, x1: 1500 });
S.hit({ t: 11.38, x: 1608, h: 150, size: 0.6, weight: 0.4 });            // B's back meets the wall
S.fx({ t: 11.38, type: 'dust', x: 1606, h: 150, n: 4, size: 0.7, dir: -1 });
S.cue({ t: 11.4, type: 'crumble', dur: 0.3, gain: 0.4, x: 1620 });
// caught, heaved, slammed
S.whoosh({ t: 11.6, x: 1440, size: 'm' });
S.hit({ t: 11.66, x: ANKLE[11.66][0], h: ANKLE[11.66][1], size: 0.75, sound: 'block', weight: 0.7 });
S.whoosh({ t: 11.79, x: 1440, size: 's' });
S.whoosh({ t: 11.97, x: 1480, size: 'l', dur: 0.26 });
S.whoosh({ t: 12.27, x: 1480, size: 'l', dur: 0.16, heavy: true });
S.hit({ t: 12.42, x: 1392, h: 12, size: 2.2, sound: 'slam', weight: 1, impact: 0.08, ring: true, shake: 34 });
S.fx({ t: 12.42, type: 'dust', x: 1380, n: 12, size: 1.4 });
S.fx({ t: 12.42, type: 'scraps', x: 1390, h: 6, n: 10 });
S.cue({ t: 12.43, type: 'crack', dur: 0.4, x: 1390 });
stepOn(12.42, (q) => q.B.fF, 0.8);
// the punt
S.whoosh({ t: 12.79, x: 1500, size: 'l', dur: 0.1, heavy: true });
hitOn(12.86, (q) => q.B.fB, { size: 1.6, weight: 1, shake: 22 });
S.whoosh({ t: 12.9, x: 1300, size: 'l', dur: 0.45 });
S.land({ t: 13.38, x: 833, weight: 0.6, dir: -1 });
S.skid({ t0: 13.62, t1: 13.86, x0: 760, x1: 700 });
stepOn(13.16, (q) => q.B.fB, 0.6);
for (const [t, f] of [[13.31, 'fF'], [13.46, 'fB'], [13.61, 'fF'], [13.76, 'fB'], [13.91, 'fF']]) stepOn(t, (q) => q.B[f], 0.7);
// A comes back: up B's body, flip kick
S.whoosh({ t: 14.05, x: 720, size: 's' });
for (const [t, f] of [[14.11, 'fF'], [14.18, 'fB'], [14.25, 'fF']]) stepOn(t, (q) => q.A[f], 0.3);
S.whoosh({ t: 14.15, x: 1000, size: 'l', dur: 0.14 });
hitOn(14.32, (q) => q.A.fF, { size: 0.5, sound: 'block', weight: 0.35 });
hitOn(14.39, (q) => q.A.fB, { size: 0.6, weight: 0.45 });
hitOn(14.46, (q) => q.A.fF, { size: 1.3, weight: 0.9 });
S.whoosh({ t: 14.5, x: 940, size: 'm', dur: 0.3 });
S.skid({ t0: 14.52, t1: 14.7, x0: 1010, x1: 1042 });
stepOn(14.68, (q) => q.B.fB, 0.6);
S.land({ t: 14.86, x: 858, weight: 0.4 });
// flying kick on the guard
S.whoosh({ t: 15.01, x: 900, size: 'm' });
hitOn(15.2, (q) => q.A.fF, { size: 1.1, sound: 'block', weight: 0.8 });
S.skid({ t0: 15.2, t1: 15.4, x0: 1040, x1: 1070 });
S.land({ t: 15.5, x: 864, weight: 0.35 });
// flying punch → caught and held out at arm's length
S.whoosh({ t: 15.63, x: 920, size: 'm' });
hitOn(15.84, (q) => q.A.hF, { size: 0.8, weight: 0.5 });
S.cue({ t: 15.86, type: 'block', weight: 0.9, x: 1040 });
S.whoosh({ t: 16.0, x: 1040, size: 's' });
hitOn(16.04, (q) => q.A.fF, { size: 0.7, weight: 0.45, shake: 5 });
S.whoosh({ t: 16.13, x: 1040, size: 's' });
hitOn(16.17, (q) => q.A.fB, { size: 0.7, weight: 0.45, shake: 5 });
// overhead press and throw
S.whoosh({ t: 16.36, x: 1100, size: 'l', dur: 0.12, heavy: true });
S.cue({ t: 16.46, type: 'boom', gain: 0.5, x: 1110 });
S.whoosh({ t: 16.63, x: 1080, size: 'l', dur: 0.12, heavy: true });
stepOn(16.7, (q) => q.B.fF, 0.8);
S.whoosh({ t: 16.74, x: 900, size: 'l', dur: 0.5 });
S.land({ t: 17.26, x: 566, weight: 0.6, dir: -1 });
S.step({ t: 17.42, x: 482, weight: 0.3 });
S.skid({ t0: 17.5, t1: 17.66, x0: 486, x1: 402 });
S.hit({ t: 17.5, x: 1082, h: 166, size: 0.6, sound: 'block', weight: 0.6, shake: 4 });   // fist into palm
S.cue({ t: 17.5, type: 'boom', gain: 0.5, x: 1100 });
S.step({ t: 17.6, x: 446, weight: 0.3 });
// the last charge
S.cue({ t: 17.6, type: 'riser', dur: 0.54 });
S.whoosh({ t: 17.69, x: 450, size: 's' });
for (const [t, f] of [[17.76, 'fF'], [17.84, 'fB'], [17.92, 'fF'], [17.98, 'fF']]) stepOn(t, (q) => q.A[f], 0.4);
S.whoosh({ t: 18.0, x: 800, size: 'm', dur: 0.16 });
S.hit({ t: 18.16, x: WRIST[18.16][0], h: WRIST[18.16][1], size: 0.9, sound: 'block', weight: 0.9 });
S.whoosh({ t: 18.2, x: 1000, size: 's', dur: 0.12 });
S.cue({ t: 18.34, type: 'riser', dur: 0.3, gain: 0.6 });
S.whoosh({ t: 18.5, x: 960, size: 'm', dur: 0.14 });
S.whoosh({ t: 18.64, x: 1040, size: 'l', dur: 0.26, heavy: true });
stepOn(18.76, (q) => q.B.fF, 0.6);
stepOn(18.9, (q) => q.B.fF, 0.85);
S.whoosh({ t: 18.9, x: 1300, size: 'l', dur: 0.18 });
// A goes through the wall
S.hit({ t: 19.08, x: 1624, h: 186, size: 2.6, sound: null, weight: 1, impact: 0.1, shake: 46 });
S.cue({ t: 19.08, type: 'megaimpact', x: 1640 });
S.cue({ t: 19.08, type: 'wallbreak', size: 1.0, x: 1660 });
S.fx({ t: 19.08, type: 'splash', x: 1630, h: 186, n: 16, size: 1.3, dir: 1 });
S.fx({ t: 19.08, type: 'dust', x: 1640, n: 9, size: 1.3, dir: 1 });
S.cue({ t: 19.12, type: 'crumble', dur: 0.85, x: 1800 });
S.cue({ t: 19.34, type: 'wallbreak', size: 0.5, x: 1920 });
// B goes after him
for (const [t, f] of [[19.03, 'fB'], [19.1, 'fF'], [19.17, 'fB'], [19.24, 'fF'], [19.31, 'fB']]) stepOn(t, (q) => q.B[f], 0.9);
S.whoosh({ t: 19.36, x: 1580, size: 'l', dur: 0.14, heavy: true });
S.hit({ t: 19.42, x: 1640, h: 130, size: 2.2, sound: 'slam', weight: 1, shake: 40 });
S.cue({ t: 19.42, type: 'wallbreak', size: 0.9, x: 1700 });
S.fx({ t: 19.42, type: 'dust', x: 1650, n: 12, size: 1.5, dir: 1 });
S.fx({ t: 19.42, type: 'scraps', x: 1700, h: 200, n: 12 });
S.cue({ t: 19.44, type: 'rumble', dur: 0.56, x: 1900 });
S.cue({ t: 19.62, type: 'wallbreak', size: 0.6, x: 2180 });
S.cue({ t: 19.5, type: 'crumble', dur: 0.5, gain: 0.8, x: 2000 });
S.musicHint(18.9, 20, 'surge');


// ── environment ──────────────────────────────────────────────────────────────
const inStump = (b) => b.row === 0 || (b.row === 1 && b.seed % 3 === 0);
const wall = makeBrickWall({ x0: WALL_X, x1: 2300, rows: 10, seed: 300 })
  .smash(T_WALL_HIT, WALL_X, -146, 118, { dir: -1 })
  .bruise(T_WALL_HIT, WALL_X, -146, 340)
  .crack(T_WALL_HIT, WALL_X + 4, -146, [{ a: -74 }, { a: -46, len: 1.2 }, { a: -18, len: 1.3 }, { a: 8, len: 1.1 }, { a: 36, len: 1.2 }, { a: 64 }], { seed: 71 })
  // 19.08: A is thrown in at the old hole and tunnels through, the brickwork bursting ahead of him
  .smash(T_THROUGH, 1640, -182, 146, { dir: 1 })
  .smash(19.2, 1790, -208, 136, { dir: 1 })
  .smash(19.34, 1920, -218, 136, { dir: 1 })
  // 19.42: B hits it shoulder first, and the rest comes apart from left to right. A ragged
  // stump (the bottom course and a few bricks of the second) is left standing.
  .smash(T_BARREL, 1690, -150, 122, { dir: 1 })
  .collapse(T_BARREL + 0.02, (b) => !inStump(b) && b.cx < 1900, { dir: 1 })
  .smash(19.48, 2050, -218, 136, { dir: 1 })
  .smash(19.6, 1880, -160, 128, { dir: 1 })
  .smash(19.62, 2180, -208, 136, { dir: 1 })
  .collapse(19.62, (b) => !inStump(b), { dir: 1 })
  .smash(19.76, 2290, -196, 140, { dir: 1 });

// Engine work-around: makeBrickWall retargets every brick that would land inside the wall's own
// footprint onto a 120-unit strip beside it: right for a hole, wrong when the whole wall goes
// (it funnels the explosion into a neat heap). The final burst gets real outward velocities and
// a little less gravity instead, so the last frame is a cloud of brick still spreading.
for (const p of wall._debris().pieces) {
  if (p.t < T_THROUGH) continue;
  const r = rng(p.seed + 5);
  const high = Math.max(0, -p.y - 120);
  p.g = 1500;
  p.vx = 240 + r() * 760 + high * 0.9;
  p.vy = -(160 + r() * 620 + high * 0.5);
  p.om = (r() - 0.5) * 13;
  const rest = p.floor - p.h * 0.42;
  const disc = p.vy * p.vy - 2 * p.g * (p.y - rest);
  p.tl = disc > 0 ? (-p.vy + Math.sqrt(disc)) / p.g : 0;
  p.lx = p.x + p.vx * p.tl;
  for (const c of p.cl) c.vx += p.vx * 0.5;
}

// a burst of brick dust behind a figure: clears a white pocket in the flying debris
function puff(ctx, c, R, seed, t) {
  if (R < 4) return;
  const r = rng(seed);
  const fl = Math.floor(t * 12) % 2;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r() * 0.6;
    const d = i ? R * (0.42 + r() * 0.2) : 0;
    const rad = R * (i ? 0.5 + r() * 0.22 : 0.74);
    blob(ctx, c[0] + Math.cos(a) * d * 1.25, -c[1] + Math.sin(a) * d * 0.8, rad * 1.15, rad * 0.9, { w: 1.8, rough: 0.16, seed: seed + i * 3 + fl, fill: WHITE, n: 11 });
  }
  blob(ctx, c[0], -c[1], R * 0.86, R * 0.66, { fill: WHITE, strokeIt: false, seed, n: 12 });
}

// a handful of bricks that pass in FRONT of the fighters in the last second (depth)
const nearBricks = makeDebris([
  { t: T_THROUGH, x: 1650, y: -260, w: 112, h: 48, vx: 380, vy: -760, om: 7, seed: 811, g: 1500 },
  { t: T_BARREL, x: 1660, y: -50, w: 112, h: 48, vx: 300, vy: -420, om: 8, seed: 813, g: 1500 },
  { t: T_BARREL + 0.03, x: 1700, y: -320, w: 90, h: 48, vx: 260, vy: -820, om: -6, seed: 814, g: 1500 },
  { t: 19.7, x: 2200, y: -360, w: 100, h: 48, vx: 820, vy: -640, om: -8, seed: 816, g: 1500 },
], 820);

// the page where A is slammed at 12.42
const T_SLAM = 12.42;
const slamCracks = crackSet(97, 1392, -2, [
  { a: -160, len: 0.9 }, { a: -128, len: 0.6 }, { a: -62, len: 0.6 }, { a: -24, len: 0.9 },
  { a: 176, len: 1.1 }, { a: 4, len: 1.0 }, { a: 150, len: 0.6, w: 0.8 }, { a: 38, len: 0.6, w: 0.8 },
], { len: 190, step: 22, w: 3, branch: 0.3 });

S.env({
  // slower parallax layer: geometry doodles and handwritten formulas
  far(ctx, t, { px }) {
    const w = Math.max(1.5, 1.1 * px);
    setSquare(ctx, [[250, 0], [250, -560], [640, 0]], [[310, -60], [310, -330], [498, -60]], 21, w);
    protractor(ctx, 1000, -300, 170, w);
    cube(ctx, 650, -610, 120, 41, w);
    cube(ctx, 1190, -650, 62, 47, w);
    cube(ctx, 60, -420, 80, 53, w);
    cube(ctx, 2050, -700, 90, 59, w);
    scribble(ctx, 'a² + b² = c²', 300, -720, 62, -0.05);
    scribble(ctx, 'y = mx + b', 1330, -790, 56, 0.03);
    scribble(ctx, 'A = ½ b h', 1960, -560, 50, -0.04);
  },
  // the stage, behind the fighters
  stage(ctx, t, { vb, px }) {
    drawGround(ctx, DEFAULT_PAGE.x0 + 8, DEFAULT_PAGE.x1 - 8, vb, px, { dense: [1500, 2620] });
    hatch(ctx, [[1486, 3], [WALL_X, 3], [WALL_X, 34], [1520, 34]], { angle: -32, gap: 5, gapEnd: 10, w: 1.4, seed: 77, cross: true });
    wall.draw(ctx, t);
    if (t >= T_SLAM) drawCracks(ctx, slamCracks, prog(t, T_SLAM, T_SLAM + 0.3), 1);
    wall.drawDebris(ctx, t, false);   // rubble at rest
  },
  // in front of the fighters
  over(ctx, t, { st }) {
    wall.drawDebris(ctx, t, true);    // bricks still in the air
    if (t >= T_THROUGH) {
      // inside the bursting wall the two figures stay on top of the flying brick (same drawing,
      // repeated over the debris) so they can be read; a few near bricks then pass in front
      if (t >= T_BARREL) puff(ctx, st.B.sh, 118 * prog(t, T_BARREL, T_BARREL + 0.12), 31, t);
      puff(ctx, st.A.hip, 104 * prog(t, T_THROUGH, T_THROUGH + 0.12), 47, t);
      drawFigure(ctx, st.B, FIGHTER_B);
      drawFigure(ctx, st.A, FIGHTER_A);
      nearBricks.draw(ctx, t, true);
    }
  },
  // faster parallax layer: dark foreground shapes for depth
  fore(ctx) {
    const a = [[380, 560], [520, 250], [760, 560]];
    sketchPoly(ctx, a, { w: 3, seed: 700, fill: '#ffffff', over: 4 });
    hatch(ctx, a, { angle: 40, gap: 5.5, w: 1.6, seed: 701, cross: true });
    const b = [[1780, 560], [1780, 330], [2080, 330], [2080, 560]];
    sketchPoly(ctx, b, { w: 3, seed: 710, fill: '#ffffff', over: 4 });
    hatch(ctx, b, { angle: -50, gap: 5.5, w: 1.6, seed: 711, cross: true });
    const top = [[1780, 330], [2080, 330], [2140, 290], [1840, 290]];
    sketchPoly(ctx, top, { w: 3, seed: 712, fill: '#ffffff', over: 4 });
    hatch(ctx, top, { angle: 10, gap: 9, w: 1.3, seed: 713 });
  },
});

// ── slow-motion close-up ──
S.bulletTime({ at: 14.56, span: 0.24, hold: 2.0, on: 'A', z: 3.0 });   // A frozen mid-backflip off B's chin
export default S.build();
