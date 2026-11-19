// REFERENCE SCENE — the approved 15-second proof of concept ("The First Clash"), ported to the
// scene API. It is not part of the final film timeline; it exists as a complete worked example:
// unarmed combat, ballistic flights, a slow-motion beat, a breakable wall, a weapon pulled out
// of the environment (pencil → staff), two-handed grips, page damage, camera work and sound cues.
//
// This port uses the RAW API everywhere (S.fx / S.cue / S.shake / S.impact) because it was
// authored before the combined helpers existed. In new scenes prefer S.hit / S.land / S.step /
// S.whoosh / S.skid, which keep picture, sound and shake in sync with one call.
//
// Stage: A starts at x=820 facing right, B at x=1140 facing left, the brick wall face is at
// x=1620, the pencil is planted in the page at x=1262.

import { createScene } from '../engine/scene.js';
import { flight } from '../engine/moves.js';
import { DEG, rng, clamp, prog, EASE, hash, lerp } from '../engine/util.js';
import { sketchPoly, hatch, stroke, trim, BLACK } from '../engine/ink.js';
import { drawGround, makeBrickWall, crackSet, drawCracks, drawTear, cube, protractor, setSquare, scribble, DEFAULT_PAGE } from '../engine/kit.js';

const WALL_X = 1620;
const WALL_H = 480;
const T_WALL_HIT = 8.6;
const T_SLAM = 13.0;
const CUT_TO_BLACK = 14.75;

const S = createScene({ id: 'ref', title: 'Reference: The First Clash (POC)', duration: 15, score: 'duel' });

// ── FIGHTER A — The Technician ───────────────────────────────────────────────
const A_KEYS = [
  // 0:00 — drawn onto the page, standing
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
  // 0:03 — reads the dash, slips low and slides under the punch
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
  // 0:07 — slow motion: the fist comes in, he drops under it
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
  { t: 9.62, hip: [2, 62], lean: 26, tilt: -10, hF: [26, -40], hB: [-10, -46], fF: [30, 0], fB: [-30, 0], e: 'out' },
  { t: 9.9, hip: [4, 68], lean: 24, hF: [30, -30], hB: [-14, -40], fF: [30, 0], fB: [-30, 0] },
  // 0:10 — grabs the pencil, yanks it out of the page, twirls it into a staff
  { t: 10.08, hip: [10, 70], lean: 26, hFw: [1247.5, 104], hB: [-20, -36], fF: [30, 0], fB: [-30, 0], e: 'out' },
  { t: 10.18, hip: [14, 64], lean: 31, hFw: [1247.5, 104], hB: [-24, -30], fF: [30, 0], fB: [-30, 0] },
  { t: 10.27, hip: [0, 90], lean: 6, hF: [24, 34], hB: [-28, -20], fF: [30, 0], fB: [-30, 0], e: 'snap' },
  { t: 10.37, face: 1, x: 1318, hip: [0, 94], lean: 0, hF: [4, 62], hB: [-20, -30], fF: [18, 0], fB: [-18, 0] },
  { t: 10.48, hip: [-4, 90], lean: 8, hF: [42, -8], hB: [10, -30], fF: [30, 0], fB: [-28, 0], e: 'back' },
  { t: 10.58, hip: [-4, 88], lean: 6, hF: [42, -6], hB: [10, -30], fF: [30, 0], fB: [-28, 0] },
  // staff up: blocks the double hammer-fist, knees buckle, driven back
  { t: 10.68, hip: [-4, 86], lean: -2, hF: [36, 40], hB: [-10, 36], fF: [30, 0], fB: [-28, 0], e: 'out' },
  { t: 10.74, x: 1312, hip: [-6, 68], lean: -4, hF: [36, 42], hB: [-10, 38], fF: [32, 0], fB: [-30, 0], e: 'in' },
  { t: 10.86, x: 1292, hip: [-6, 62], lean: -6, hF: [36, 42], hB: [-10, 38], fF: [32, 0], fB: [-30, 0], slide: true, e: 'out' },
  // lets the fists slide off, winds up low, rising strike
  { t: 10.98, x: 1282, hip: [-12, 80], lean: -10, hF: [30, 32], hB: [-8, 30], fF: [30, 0], fB: [-30, 0] },
  { t: 11.09, hip: [-16, 78], lean: -16, hF: [-6, -30], hB: [-30, -30], fF: [30, 0], fB: [-30, 0] },
  { t: 11.2, x: 1290, hip: [10, 88], lean: 20, hF: [56, 20], hB: [30, 0], fF: [36, 0], fB: [-34, 0], e: 'snap' },
  { t: 11.26, same: true },
  // leaping overhead strike — hits only the page
  { t: 11.32, hip: [4, 72], lean: 10, hF: [20, 50], hB: [0, 46], fF: [30, 0], fB: [-30, 0] },
  ...flight(11.32, 11.62, [1290, 0], [1350, 0], 3800, [
    [11.47, { hip: [0, 84], lean: -14, hF: [-4, 70], hB: [-20, 60], fF: [20, 24], fB: [-30, 30] }],
  ], { hip: [10, 56], lean: 42, bend: 8, hF: [52, -34], hB: [30, -30], fF: [44, 0], fB: [-44, 0], e: 'in' }),
  { t: 11.74, same: true },
  { t: 11.98, hip: [0, 80], lean: 10, tilt: -30, hF: [40, -6], hB: [14, -26], fF: [30, 0], fB: [-30, 0] },
  { t: 12.3, p: 'aStance', tilt: -36 },
  { t: 12.52, p: 'aStance', tilt: -40, hip: [-8, 88], lean: 2 },
  { t: 12.68, hip: [-6, 60], lean: 16, tilt: -34, hF: [36, -20], hB: [10, -34], fF: [30, 0], fB: [-30, 0] },
  // backflips clear of B's dive
  ...flight(12.68, 13.06, [1350, 0], [1085, 0], 6400, [
    [12.8, { p: 'aTuck', spin: -110, hF: [30, -30], hB: [20, -44] }],
    [12.93, { p: 'aTuck', spin: -270, hF: [30, -30], hB: [20, -44] }],
  ], { hip: [0, 50], lean: 28, bend: 8, hF: [34, -36], hB: [8, -44], fF: [34, 0], fB: [-34, 0], spin: -360 }),
  { t: 13.24, x: 1068, hip: [-4, 58], lean: 24, hF: [36, -30], hB: [10, -40], fF: [34, 0], fB: [-34, 0], slide: true, e: 'out' },
  // rises, twirls the staff, levels it at B
  { t: 13.48, hip: [-4, 86], lean: 6, hF: [20, 30], hB: [-10, -20], fF: [30, 0], fB: [-28, 0] },
  { t: 13.66, hip: [-4, 92], lean: 2, hF: [10, 50], hB: [-14, -24], fF: [30, 0], fB: [-28, 0] },
  { t: 13.9, hip: [-6, 82], lean: 14, hF: [44, -14], hB: [8, -30], fF: [34, 0], fB: [-32, 0], e: 'back' },
  { t: 14.1, hip: [-16, 76], lean: 4, hF: [36, -16], hB: [0, -30], fF: [34, 0], fB: [-32, 0] },
  // …and charges
  { t: 14.24, hip: [12, 74], lean: 38, hF: [40, -24], hB: [6, -34], fF: [40, 14], fB: [-56, 0], e: 'in' },
  { t: 14.5, x: 1128, y: 10, hip: [0, 78], lean: 46, hF: [40, -26], hB: [4, -36], fF: [54, 18], fB: [-68, 22], e: 'lin', er: 'lin' },
  { t: 14.75, x: 1180, y: 0, hip: [0, 76], lean: 46, hF: [44, -22], hB: [4, -36], fF: [-60, 26], fB: [52, 0], e: 'lin', er: 'lin' },
  { t: 15.0, same: true },
];

// ── FIGHTER B — The Powerhouse ───────────────────────────────────────────────
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
  // 0:03 — explodes into a flying overhand
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
  // big hook — misses
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
  // 0:07 — the punch, in slow motion: a long lunge carries the fist past A's head
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
  { t: 9.9, p: 'bStance', hip: [0, 85], lean: -6, tilt: -18, hF: [34, -34], hB: [-30, -36] },
  { t: 10.08, p: 'bStance', hip: [0, 87], lean: -8, tilt: -20, hF: [38, -30], hB: [-34, -32] },
  // 0:10 — leaps in with a double hammer-fist
  { t: 10.24, hip: [4, 60], lean: 32, hF: [-24, -44], hB: [-44, -30], fF: [40, 0], fB: [-40, 0] },
  { t: 10.34, hip: [6, 82], lean: 16, hF: [10, 40], hB: [0, 44], fF: [30, 0], fB: [-36, 0], e: 'in' },
  ...flight(10.34, 10.82, [1482, 0], [1436, 0], 2800, [
    [10.52, { hip: [0, 84], lean: -14, hF: [-4, 74], hB: [-14, 72], fF: [24, 20], fB: [-36, 30] }],
    [10.74, { hip: [10, 84], lean: 32, hFw: [1362, 165], hBw: [1350, 165], fF: [36, 6], fB: [-30, 16], e: 'in' }],
  ], { hip: [12, 74], lean: 36, hFw: [1344, 160], hBw: [1332, 160], fF: [40, 0], fB: [-44, 0] }),
  { t: 10.9, hip: [14, 72], lean: 38, hFw: [1342, 158], hBw: [1330, 158], fF: [40, 0], fB: [-44, 0] },
  // fists slide off the staff; he stumbles forward… into the rising strike
  { t: 11.0, x: 1428, hip: [22, 64], lean: 56, hF: [52, -50], hB: [44, -58], fF: [40, 0], fB: [-44, 0], e: 'in' },
  { t: 11.12, hip: [20, 62], lean: 52, hF: [40, -56], hB: [30, -60], fF: [40, 0], fB: [-44, 0] },
  { t: 11.2, x: 1432, hip: [-10, 80], lean: -22, tilt: -32, hF: [42, 30], hB: [32, 40], fF: [30, 6], fB: [-40, 0], e: 'snap' },
  { t: 11.26, same: true },
  { t: 11.4, x: 1478, hip: [-4, 70], lean: 14, hF: [30, -20], hB: [-10, -30], fF: [44, 0], fB: [-44, 0], slide: true, e: 'out' },
  // crouch… and a huge backward leap onto the wall
  { t: 11.5, hip: [0, 48], lean: 30, hF: [-22, -60], hB: [-42, -50], fF: [40, 0], fB: [-40, 0] },
  { t: 11.54, hip: [0, 84], lean: -4, hF: [20, 50], hB: [10, 56], fF: [30, 0], fB: [-30, 0], e: 'in' },
  ...flight(11.54, 12.05, [1478, 0], [1700, WALL_H], 7000, [
    [11.7, { hip: [0, 90], lean: -16, hF: [30, 56], hB: [20, 60], fF: [36, 14], fB: [14, 2] }],
    [11.9, { hip: [0, 74], lean: 10, hF: [30, 10], hB: [-20, 10], fF: [30, 24], fB: [-20, 20] }],
  ], { hip: [0, 50], lean: 36, bend: 10, hF: [30, -62], hB: [-12, -58], fF: [32, 0], fB: [-32, 0] }),
  { t: 12.14, y: WALL_H, hip: [0, 45], lean: 38, bend: 10, hF: [30, -58], hB: [-12, -54], fF: [32, 0], fB: [-32, 0] },
  { t: 12.3, y: WALL_H, hip: [0, 92], lean: -6, tilt: -10, hF: [26, 66], hB: [-12, 70], fF: [30, 0], fB: [-30, 0], e: 'out' },
  { t: 12.39, y: WALL_H, hip: [4, 58], lean: 30, hF: [-20, -40], hB: [-40, -30], fF: [30, 0], fB: [-30, 0] },
  // dives off — the wall corner collapses under him
  { t: 12.45, y: WALL_H, hip: [10, 86], lean: 24, hF: [20, 60], hB: [10, 64], fF: [20, 0], fB: [-36, 0], e: 'in' },
  ...flight(12.45, 13.0, [1700, WALL_H], [1340, 0], 6982, [
    [12.6, { hip: [0, 82], lean: -16, hF: [-12, 74], hB: [-22, 72], fF: [10, 30], fB: [-44, 38] }],
    [12.85, { hip: [0, 80], lean: 26, hF: [24, 66], hB: [14, 70], fF: [44, 12], fB: [10, 22] }],
  ], { hip: [10, 46], lean: 55, bend: 14, tilt: -10, hF: [22, -84], hB: [10, -84], fF: [52, 0], fB: [-52, 0], e: 'in' }),
  // 0:13 — lands. The page cracks.
  { t: 13.1, hip: [10, 41], lean: 57, bend: 15, tilt: -10, hF: [22, -80], hB: [10, -80], fF: [52, 0], fB: [-52, 0] },
  { t: 13.34, hip: [10, 46], lean: 55, bend: 14, tilt: -14, hF: [22, -84], hB: [10, -84], fF: [52, 0], fB: [-52, 0] },
  { t: 13.64, hip: [4, 66], lean: 38, tilt: -24, hF: [34, -52], hB: [-10, -58], fF: [52, 0], fB: [-52, 0] },
  { t: 13.92, p: 'bStance', hip: [0, 82], lean: 22, tilt: -6, fF: [52, 0], fB: [-52, 0] },
  { t: 14.1, hip: [-20, 74], lean: 4, hB: [-56, -4], hF: [32, -28], fF: [52, 0], fB: [-52, 0] },
  { t: 14.22, hip: [14, 74], lean: 42, hB: [-60, 8], hF: [46, -20], fF: [40, 16], fB: [-60, 0], e: 'in' },
  { t: 14.5, x: 1292, y: 12, hip: [0, 78], lean: 54, hB: [-50, 16], hF: [50, -16], fF: [52, 20], fB: [-70, 20], e: 'lin', er: 'lin' },
  { t: 14.75, x: 1258, y: 0, hip: [0, 76], lean: 52, hB: [-56, 20], hF: [50, -16], fF: [-64, 24], fB: [54, 0], e: 'lin', er: 'lin' },
  { t: 15.0, same: true },
];

S.fighters({ A: A_KEYS, B: B_KEYS });

// ── the weapon: a pencil planted in the page that becomes a staff ────────────
// Free (planted) until A's hand reaches it at 10.08, then held. ang stays continuous through
// the twirls (412 = 52 + one full turn).
S.weapon('pencil', [
  { t: 0, type: 'pencil', at: [1247.5, 104], ang: 98 },
  { t: 10.08, by: 'A', ang: 98, g: 0.5, two: 0 },
  { t: 10.18, by: 'A', ang: 100 },
  { t: 10.27, by: 'A', ang: 140, e: 'in' },
  { t: 10.37, by: 'A', ang: 320, type: 'staff', e: 'lin' },       // sheds its pencil look mid-twirl
  { t: 10.48, by: 'A', ang: 412, g: 0.6, two: 1, e: 'out' },
  { t: 10.58, by: 'A', ang: 412 },
  { t: 10.68, by: 'A', ang: 362, g: 0.62, e: 'out' },             // raised horizontal: the block
  { t: 10.86, by: 'A', ang: 360 },
  { t: 10.98, by: 'A', ang: 334, g: 0.6 },
  { t: 11.09, by: 'A', ang: 222, g: 0.45 },                       // wind-up, low behind
  { t: 11.2, by: 'A', ang: 414, g: 0.4, e: 'snap' },              // rising strike
  { t: 11.26, by: 'A', ang: 420 },
  { t: 11.32, by: 'A', ang: 452, g: 0.36 },
  { t: 11.47, by: 'A', ang: 505, g: 0.3, e: 'out' },
  { t: 11.62, by: 'A', ang: 332, e: 'in3' },                      // overhead slam
  { t: 11.74, by: 'A', ang: 332 },
  { t: 11.98, by: 'A', ang: 412, g: 0.6 },
  { t: 12.68, by: 'A', ang: 408 },
  { t: 12.8, by: 'A', ang: 298, e: 'lin' },                       // follows the backflip
  { t: 12.93, by: 'A', ang: 138, e: 'lin' },
  { t: 13.06, by: 'A', ang: 48, e: 'lin' },
  { t: 13.24, by: 'A', ang: 40, two: 0.4 },
  { t: 13.48, by: 'A', ang: 96, g: 0.5, two: 0 },
  { t: 13.66, by: 'A', ang: 300, e: 'lin' },
  { t: 13.9, by: 'A', ang: 372, g: 0.55, two: 1, e: 'out' },
  { t: 14.1, by: 'A', ang: 378 },
  { t: 14.24, by: 'A', ang: 368 },
  { t: 15.0, by: 'A', ang: 366 },
]);

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
  { t: 10.0, a: 1, x: -8, y: -140, z: 1.72 },                      // A and the pencil
  { t: 10.3, a: 1, x: 10, y: -152, z: 1.88 },
  { t: 10.56, a: 0.5, b: 0.5, y: -172, z: 1.42, e: 'out' },
  { t: 10.74, a: 0.5, b: 0.5, y: -172, z: 1.55, e: 'in' },
  { t: 10.8, a: 0.5, b: 0.5, y: -166, z: 1.74, e: 'snap' },        // punch-in on the block
  { t: 11.1, a: 0.5, b: 0.5, y: -160, z: 1.5 },
  { t: 11.23, a: 0.5, b: 0.5, y: -160, z: 1.66, e: 'snap' },
  { t: 11.62, a: 0.5, b: 0.5, y: -180, z: 1.28, e: 'out' },
  { t: 12.12, x: 1520, y: -335, z: 0.98, e: 'io' },                // tilts up: B on the wall
  { t: 12.45, x: 1535, y: -345, z: 1.04 },
  { t: 13.0, x: 1330, y: -255, z: 1.08, e: 'in' },                 // follows the dive down
  { t: 13.07, x: 1330, y: -250, z: 1.3, e: 'snap' },
  { t: 13.42, x: 1300, y: -292, z: 1.15, e: 'out' },
  { t: 14.0, x: 1295, y: -292, z: 1.22, e: 'lin' },                // slow push while the outline flickers
  { t: 14.58, x: 1100, y: -265, z: 0.52, r: 6, e: 'io3' },         // rapid zoom-out: the damaged page
  { t: 15.0, x: 1100, y: -265, z: 0.485, r: 7.5, e: 'lin' },
];

S.camera(CAM_KEYS);

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
  { t: 10.74, amp: 22, dur: 0.3 },
  { t: 11.2, amp: 12, dur: 0.2 },
  { t: 11.62, amp: 12, dur: 0.22 },
  { t: 12.05, amp: 12, dur: 0.26 },
  { t: 12.45, amp: 16, dur: 0.4 },
  { t: 13.0, amp: 52, dur: 0.9 },
];

for (const s of SHAKES) S.shake(s.t, s.amp, s.dur);

const IMPACTS = [
  { t: 3.86, dur: 0.07 },
  { t: 5.88, dur: 0.07 },
  { t: 8.6, dur: 0.1 },
  { t: 10.74, dur: 0.045 },
  { t: 13.0, dur: 0.11 },
];

for (const i of IMPACTS) S.impact(i.t, i.dur);

S.slowmo(7.25, 8.56, (st) => st.B.hB, { sound: false, music: false });
S.musicHint(7.22, 8.6, 'suspend');
S.musicHint(13.0, 14.0, 'aftermath');

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
  { t: 10.24, type: 'burst', x: 1262, h: 6, size: 0.6 },
  { t: 10.24, type: 'splash', x: 1262, h: 4, n: 7, size: 0.6, dir: 0 },
  { t: 10.74, type: 'burst', x: 1356, h: 166, size: 1.4 },
  { t: 10.74, type: 'ring', x: 1320, h: 0, size: 0.8 },
  { t: 10.82, type: 'dust', x: 1395, n: 6, size: 0.9 },
  { t: 11.2, type: 'burst', x: 1388, h: 140, size: 1.2 },
  { t: 11.62, type: 'burst', x: 1560, h: 6, size: 0.9 },
  { t: 11.62, type: 'dust', x: 1555, n: 6, size: 0.9 },
  { t: 12.05, type: 'dust', x: 1700, h: 480, n: 6, size: 0.8 },
  { t: 12.45, type: 'burst', x: 1700, h: 474, size: 1.1 },
  { t: 12.47, type: 'dust', x: 1700, h: 440, n: 9, size: 1.2 },
  { t: 13.0, type: 'burst', x: 1300, h: 4, size: 3.0 },
  { t: 13.0, type: 'ring', x: 1300, h: 0, size: 2.2 },
  { t: 13.0, type: 'dust', x: 1300, n: 14, size: 1.5 },
  { t: 13.0, type: 'splash', x: 1300, h: 6, n: 22, size: 1.5, dir: 0 },
  { t: 13.0, type: 'scraps', x: 1300, h: 4, n: 18 },
  { t: 13.06, type: 'dust', x: 1095, n: 5, size: 0.8, dir: -1 },
  { t: 14.24, type: 'dust', x: 1050, n: 5, size: 0.8, dir: -1 },
  { t: 14.24, type: 'dust', x: 1400, n: 5, size: 0.9, dir: 1 },
];

for (const e of FX) S.fx(e);

const SKIDS = [
  { t0: 3.22, t1: 3.52, x0: 850, x1: 1065, seed: 1 },
  { t0: 3.9, t1: 4.3, x0: 985, x1: 760, seed: 2 },
  { t0: 6.24, t1: 6.5, x0: 1430, x1: 1606, seed: 3 },
  { t0: 10.74, t1: 10.88, x0: 1345, x1: 1262, seed: 4 },
  { t0: 11.2, t1: 11.42, x0: 1392, x1: 1528, seed: 5 },
  { t0: 13.06, t1: 13.26, x0: 1120, x1: 1034, seed: 6 },
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
  { t: 9.98, type: 'boom', gain: 0.6, pan: 0.35 },                 // B squares up

  // ── 0:10–0:13  First weapon ──────────────────────────────────────────────
  { t: 10.06, type: 'scribble', dur: 0.14, pan: 0.1 },             // A grabs the pencil
  { t: 10.22, type: 'pop', pan: 0.1 },                             // …yanks it from the page
  { t: 10.26, type: 'whoosh', size: 'm', dur: 0.12, pan: 0.1 },    // staff twirl
  { t: 10.38, type: 'whoosh', size: 'm', dur: 0.12, pan: 0.1 },
  { t: 10.40, type: 'whoosh', size: 'l', dur: 0.30, pan: 0.3 },    // B leaps in
  { t: 10.74, type: 'clack', weight: 1.0, pan: 0.2 },              // STAFF BLOCK (impact frame)
  { t: 10.82, type: 'thud', weight: 0.8, pan: 0.25 },
  { t: 10.92, type: 'skid', dur: 0.14, pan: 0.2 },                 // fists slide off the staff
  { t: 11.08, type: 'whoosh', size: 'l', dur: 0.14, pan: 0.15 },   // A's rising strike
  { t: 11.20, type: 'clack', weight: 0.7, pan: 0.25 },             // …lands
  { t: 11.20, type: 'hit', weight: 0.8, pan: 0.25 },
  { t: 11.24, type: 'skid', dur: 0.18, pan: 0.35 },
  { t: 11.46, type: 'whoosh', size: 'm', dur: 0.16, pan: 0.2 },    // A's overhead swing
  { t: 11.52, type: 'whoosh', size: 'l', dur: 0.40, pan: 0.45 },   // B leaps to the wall top
  { t: 11.62, type: 'clack', weight: 0.8, pan: 0.3 },              // staff slams the floor
  { t: 11.62, type: 'thud', weight: 0.6, pan: 0.3 },
  { t: 12.05, type: 'thud', weight: 0.9, pan: 0.55 },              // B lands on the wall
  { t: 12.07, type: 'crumble', dur: 0.30, gain: 0.5, pan: 0.55 },
  { t: 12.45, type: 'wallbreak', size: 0.6, pan: 0.5 },            // wall corner collapses as B launches
  { t: 12.48, type: 'crumble', dur: 0.80, gain: 0.8, pan: 0.5 },
  { t: 12.48, type: 'whoosh', size: 'l', dur: 0.50, pan: 0.35 },   // B's diving arc
  { t: 12.74, type: 'whoosh', size: 'm', dur: 0.26, pan: 0.0 },    // A backflips clear

  // ── 0:13–0:15  Landing, foreshadow, cut ──────────────────────────────────
  { t: 13.00, type: 'megaimpact', pan: 0.15 },                     // B LANDS — the page cracks (impact frame)
  { t: 13.02, type: 'tear', dur: 0.55, pan: 0.15 },                // paper tearing
  { t: 13.04, type: 'crack', dur: 0.50, pan: 0.2 },                // ink fractures spreading
  { t: 13.08, type: 'thud', weight: 0.35, pan: -0.2 },             // A lands
  { t: 13.14, type: 'shing', dur: 0.90, pan: 0.25 },               // giant-sword outline in the cracks
  { t: 13.46, type: 'whoosh', size: 's', dur: 0.12, pan: -0.2 },   // A twirls the staff
  { t: 13.60, type: 'whoosh', size: 's', dur: 0.12, pan: -0.2 },
  { t: 14.00, type: 'riser', dur: 0.72 },                          // zoom-out + charge
  { t: 14.20, type: 'whoosh', size: 'l', dur: 0.40, pan: 0.0 },
  { t: 14.75, type: 'cuthit' },                                    // hard cut to black
];

for (const c of CUES) S.cue(c);

// ── environment ──────────────────────────────────────────────────────────────
const wall = makeBrickWall({ x0: WALL_X, x1: 2300, rows: 10, seed: 300 })
  .smash(T_WALL_HIT, WALL_X, -146, 118, { dir: -1 })
  .bruise(T_WALL_HIT, WALL_X, -146, 340)
  .crack(T_WALL_HIT, WALL_X + 4, -146, [{ a: -74 }, { a: -46, len: 1.2 }, { a: -18, len: 1.3 }, { a: 8, len: 1.1 }, { a: 36, len: 1.2 }, { a: 64 }], { seed: 71 })
  .crack(12.05, 1700, -WALL_H, [{ a: 62 }, { a: 96, len: 1.2 }, { a: 128 }], { seed: 83, len: 170, step: 22, w: 2.6, grow: 0.2 })
  .collapse(12.47, (b) => b.row >= 5 && b.cx < 1850, { dir: -1 });

// the slam at 13.0: floor cracks, a tear, and fractures that trace a colossal sword
const SLAM = [1300, 0];
const floorCracks = crackSet(97, SLAM[0], SLAM[1] - 2, [
  { a: -166, len: 0.9 }, { a: -142, len: 1.1 }, { a: -118, len: 0.8 }, { a: -96, len: 0.55 },
  { a: -38, len: 0.8 }, { a: -17, len: 1.15 }, { a: 178, len: 1.25 }, { a: 3, len: 1.0 },
  { a: 152, len: 0.7, w: 0.8 }, { a: 34, len: 0.7, w: 0.8 }, { a: 96, len: 0.5, w: 0.8 },
], { len: 380, step: 28, w: 3.8, branch: 0.34 });

// greatsword silhouette: tip stabbed into the tear, rising behind B
const SW_T = [1400, 4];
const SW_A = 80 * DEG;
const swd = [Math.cos(SW_A), -Math.sin(SW_A)];
const swp = [Math.sin(SW_A), Math.cos(SW_A)];
const SW = (l, k) => [SW_T[0] + swd[0] * l + swp[0] * k, SW_T[1] + swd[1] * l + swp[1] * k];
const SW_OUT = [
  [0, 0], [78, 46], [470, 46], [470, 114], [500, 114], [500, 15], [612, 15], [622, 28], [642, 28], [652, 0],
  [642, -28], [622, -28], [612, -15], [500, -15], [500, -114], [470, -114], [470, -46], [78, -46], [0, 0],
];
const swordEdges = [];
{
  const r = rng(123);
  for (let i = 0; i < SW_OUT.length - 1; i++) {
    const a = SW_OUT[i], b = SW_OUT[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.round(len / 30));
    const pts = [];
    for (let j = 0; j <= n; j++) {
      const k = j / n;
      const l = lerp(a[0], b[0], k), w = lerp(a[1], b[1], k);
      const jx = j === 0 || j === n ? 0 : (r() - 0.5) * 9;
      const jy = j === 0 || j === n ? 0 : (r() - 0.5) * 9;
      const p = SW(l, w);
      pts.push([p[0] + jx, p[1] + jy]);
    }
    swordEdges.push({ pts, l: Math.min(a[0], b[0]), id: i });
  }
  // fuller down the middle of the blade
  for (let s = 100; s < 440; s += 62) {
    swordEdges.push({ pts: [SW(s, (r() - 0.5) * 6), SW(s + 20, (r() - 0.5) * 8), SW(s + 42, (r() - 0.5) * 6)], l: s, id: 100 + s, thin: true });
  }
}


function drawSlamDamage(ctx, t, impact) {
  if (t < T_SLAM) return;
  const p = prog(t, T_SLAM, T_SLAM + 0.42);
  drawTear(ctx, { x0: SLAM[0] - 215, x1: SLAM[0] + 235, y: 4, depth: 30, seed: 140 }, p);
  drawCracks(ctx, floorCracks, p, 1);
  const grow = prog(t, T_SLAM + 0.02, T_SLAM + 0.36);
  const fade = prog(t, 13.95, 14.5);
  const flick = Math.floor(t * 15);
  for (const ed of swordEdges) {
    if (ed.l / 652 > grow) continue;
    const h = hash(ed.id * 3.7 + flick * 1.3);
    if (!impact && h < 0.1 + fade * 0.5) continue;
    const base = ed.thin ? 2.2 : impact ? 7.5 : 4.4;
    const w = base * (impact ? 1 : 0.8 + h * 0.5) * (1 - fade * 0.55);
    const q = clamp((grow - ed.l / 652) * 6);
    stroke(ctx, trim(ed.pts, q), w);
  }
}

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
  stage(ctx, t, { vb, px, impact }) {
    drawGround(ctx, DEFAULT_PAGE.x0 + 8, DEFAULT_PAGE.x1 - 8, vb, px, { dense: t >= T_SLAM ? [1040, 2620] : [1500, 2620] });
    hatch(ctx, [[1486, 3], [WALL_X, 3], [WALL_X, 34], [1520, 34]], { angle: -32, gap: 5, gapEnd: 10, w: 1.4, seed: 77, cross: true });
    wall.draw(ctx, t);
    drawSlamDamage(ctx, t, impact);
    wall.drawDebris(ctx, t, false);   // rubble at rest
  },
  // in front of the fighters
  over(ctx, t) {
    wall.drawDebris(ctx, t, true);    // bricks still in the air
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
  // screen space: the hard cut to black
  screen(ctx, t, { W, H }) {
    if (t >= CUT_TO_BLACK) { ctx.fillStyle = BLACK; ctx.fillRect(0, 0, W, H); }
  },
  // B stands on top of the wall for a moment — tell the shadow where the surface is
  surface: (x, t) => (x > WALL_X && t > 11.9 && t < 12.5 ? WALL_H : 0),
});

export default S.build();
