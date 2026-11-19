// SCENE 2: "Pencil City" (22 s). Improvised and light weapons on the rooftops of a city made
// of stationery: pencil → staff, pipe baton + pen-nib knife, then short swords; a leap across the
// rooftop gap, a clothesline swing, a pencil tower sliced through, the fall into the alley and
// the blow that splits the alley floor.
//
// Stage (heights are up-positive, the alley floor is height 0):
//   roof 1  x 250…1150  height 500   billboard (drawn sword) · pencil antenna · crate · vent + pipe
//                                    · pen-nib chimney · weathervane (B's sword) · clothesline pole
//   gap     x 1150…1330
//   roof 2  x 1330…1760 height 360   the pencil tower (x 1370…1440) stands behind it
//   alley   x 1760…2140 height 0     between roof 2's building and the tall block on the right

import { createScene } from '../engine/scene.js';
import { flight } from '../engine/moves.js';
import { rng, clamp, prog, EASE, lerp, DEG, TAU } from '../engine/util.js';
import { sketchPoly, hatch, stroke, line, BLACK, WHITE } from '../engine/ink.js';
import { drawGround, makeDebris, crackSet, drawCracks, box, cube, setSquare } from '../engine/kit.js';

const H1 = 500, H2 = 360;
const R1 = [250, 1150], R2 = [1330, 1760], AL = [1760, 2140];
const PAGE = { x0: -420, x1: 2960, y0: -1560, y1: 760 };

// story times the environment reacts to
const T_PENCIL = 1.66;      // A takes the pencil antenna
const T_VENT = 3.52;        // B is kicked into the vent stack
const T_SNAP = 5.95;        // the staff breaks
const T_PULL = 8.02;        // A's sword leaves the billboard drawing
const T_KNIFE = 8.86;       // the deflected knife sticks in the billboard
const T_KICK = 9.14;        // B kicks the crate
const T_SPLIT = 9.36;       // A splits it
const T_VANE = 10.5;        // B tears the sword off the weathervane
const T_ROPE_CUT = 13.1;    // A cuts the clothesline
const T_REL = 13.74;        // …and lets go of it
const T_TOWER = 14.3;       // B's cut goes through the pencil tower
const T_CRASH = T_TOWER + 0.8;   // …and its top lands across the gap on roof 1
const T_SLAM = 19.2;        // B's overhead blow hits the alley floor
const T_BREAK = 21.3;       // the floor gives way

const S = createScene({ id: 's2', title: 'Pencil City', duration: 22, page: PAGE, anchor: [1100, -500] });

/*@@FIGHTERS@@*/
const r1 = (ks) => ks.map((k) => ({ y: H1, ...k }));
const r2 = (ks) => ks.map((k) => ({ y: H2, ...k }));

// ── FIGHTER A: The Technician ───────────────────────────────────────────────
const A1 = r1([
  // 0:00: tumbles out of the sky after the page turn, lands and skids
  { t: 0, x: 395, y: 1240, face: 1, p: 'aTuck', spin: 40 },
  ...flight(0, 0.56, [395, 1240], [575, H1], 3000, [
    [0.18, { p: 'aTuck', spin: 170 }],
    [0.36, { p: 'aTuck', spin: 300 }],
    [0.48, { hip: [0, 84], lean: 8, hF: [34, 26], hB: [-30, 24], fF: [14, 0], fB: [-12, 8], spin: 360 }],
  ], { hip: [0, 46], lean: 32, bend: 10, hF: [22, -58], hB: [-12, -56], fF: [30, 0], fB: [-30, 0] }),
  { t: 0.74, x: 604, hip: [-10, 44], lean: 44, tilt: -30, hF: [20, -70], hB: [-44, 10], fF: [26, 0], fB: [-60, 0], kB: -1, slide: true, e: 'out' },
  { t: 0.96, x: 606, hip: [0, 78], lean: 16, tilt: -14, hF: [30, -24], hB: [8, -32], fF: [26, 0], fB: [-30, 0] },
  { t: 1.12, p: 'aStance', x: 606 },
  { t: 1.28, p: 'aStance', hip: [-4, 96], hF: [40, 2] },
  { t: 1.42, p: 'aStance', hip: [-4, 88] },
  // B is coming: glances back at the pencil antenna and snatches it
  { t: 1.54, p: 'aStance', hip: [-10, 90], lean: -6, tilt: -20, hF: [30, 4], hB: [-20, -10] },
  { t: 1.66, x: 596, face: -1, hip: [10, 72], lean: 26, hFw: [541, H1 + 104], hB: [-20, -36], fF: [-32, 0], fB: [30, 0], e: 'out' },
  { t: 1.76, hip: [14, 66], lean: 30, hFw: [541, H1 + 104], hB: [-24, -30], fF: [-32, 0], fB: [30, 0] },
  { t: 1.85, hip: [0, 90], lean: 6, hF: [24, 34], hB: [-28, -20], fF: [-32, 0], fB: [30, 0], e: 'snap' },
  { t: 1.95, face: 1, x: 600, hip: [0, 94], lean: 0, hF: [4, 62], hB: [-20, -30], fF: [26, 0], fB: [-30, 0] },
  { t: 2.05, hip: [-4, 90], lean: 8, hF: [42, -8], hB: [10, -30], fF: [26, 0], fB: [-30, 0], e: 'back' },
  // staff up: blocks the double hammer-fist, knees buckle, driven back
  { t: 2.14, hip: [-4, 86], lean: -2, hF: [36, 40], hB: [-10, 36], fF: [26, 0], fB: [-30, 0], e: 'out' },
  { t: 2.2, x: 594, hip: [-6, 66], lean: -4, hF: [36, 42], hB: [-10, 38], fF: [28, 0], fB: [-30, 0], e: 'in' },
  { t: 2.26, same: true },
  { t: 2.36, x: 576, hip: [-6, 62], lean: -6, hF: [36, 42], hB: [-10, 38], fF: [28, 0], fB: [-30, 0], slide: true, e: 'out' },
  // slips the fists off, low sweep at the lead leg
  { t: 2.46, x: 570, hip: [-14, 78], lean: -10, hF: [8, -6], hB: [-24, -12], fF: [28, 0], fB: [-30, 0] },
  { t: 2.58, x: 580, hip: [12, 58], lean: 34, hF: [58, -46], hB: [20, -40], fF: [40, 0], fB: [-36, 0], e: 'snap' },
  { t: 2.64, same: true },
  // twirl overhead, rising strike to the chin
  { t: 2.76, hip: [-12, 78], lean: -12, hF: [-6, -30], hB: [-30, -30], fF: [40, 0], fB: [-36, 0] },
  { t: 2.88, x: 658, hip: [10, 88], lean: 20, hF: [56, 20], hB: [30, 0], fF: [36, 0], fB: [-34, 0], e: 'snap' },
  { t: 2.94, same: true },
  // runs in, plants the staff and swings round it: double kick
  { t: 3.02, x: 668, p: 'run1', hF: [30, 10], hB: [10, -10], e: 'lin' },
  { t: 3.1, x: 690, hip: [8, 82], lean: 18, hFw: [695, H1 + 138], hB: [20, 0], fF: [34, 0], fB: [-40, 0], e: 'lin' },
  ...flight(3.1, 3.46, [690, H1], [800, H1], 3000, [
    [3.2, { hip: [0, 80], lean: -18, hFw: [720, H1 + 145], hB: [20, 10], fF: [40, 30], fB: [8, 14] }],
    [3.3, { hip: [0, 80], lean: -52, tilt: 20, hFw: [760, H1 + 146], hB: [30, 20], fF: [102, 108], fB: [94, 92], e: 'snap' }],
    [3.36, { hip: [0, 80], lean: -50, tilt: 20, hFw: [766, H1 + 146], hB: [30, 20], fF: [100, 106], fB: [70, 70] }],
  ], { hip: [0, 54], lean: 28, hF: [36, -30], hB: [10, -36], fF: [34, 0], fB: [-34, 0] }),
  { t: 3.62, x: 800, p: 'guard2', hip: [-4, 84] },
  { t: 3.8, p: 'guard2', hip: [-4, 92] },
  { t: 3.98, p: 'guard2', hip: [-6, 86], lean: 4 },
  { t: 4.16, p: 'guard2', hip: [-6, 90], lean: 2 },
  // staff against baton and knife: high parry, swat the thrust, duck, thrust
  { t: 4.26, p: 'parryHigh', x: 796, e: 'out' },
  { t: 4.32, p: 'parryHigh', x: 790, hip: [-8, 70], slide: true, e: 'in' },
  { t: 4.38, same: true },
  { t: 4.52, x: 782, hip: [-12, 82], lean: -4, hF: [44, -24], hB: [6, 4], fF: [32, 0], fB: [-32, 0], e: 'snap' },
  { t: 4.66, x: 784, hip: [0, 52], lean: 34, bend: 10, hF: [34, -30], hB: [0, -30], fF: [34, 0], fB: [-32, 0], e: 'out' },
  { t: 4.76, hip: [-10, 56], lean: 20, hF: [10, -24], hB: [-30, -22], fF: [34, 0], fB: [-32, 0] },
  { t: 4.84, x: 800, hip: [14, 70], lean: 30, hF: [72, -14], hB: [26, -16], fF: [46, 0], fB: [-40, 0], e: 'snap' },
  { t: 4.9, same: true },
  { t: 5.0, x: 790, p: 'guard2' },
  { t: 5.12, x: 784, hip: [-4, 70], lean: 14, hF: [44, -40], hB: [0, -36], fF: [34, 0], fB: [-32, 0], e: 'in' },
  { t: 5.24, x: 776, hip: [-18, 80], lean: -38, tilt: -10, hF: [30, -10], hB: [-14, -10], fF: [34, 0], fB: [-36, 0], e: 'snap' },
  { t: 5.36, hip: [-8, 86], lean: -8, hF: [-10, 20], hB: [-40, 10], fF: [30, 0], fB: [-34, 0] },
  { t: 5.5, x: 790, hip: [10, 84], lean: 22, hF: [60, 6], hB: [20, -10], fF: [40, 0], fB: [-38, 0], e: 'snap' },
  { t: 5.56, same: true },
  { t: 5.7, x: 784, p: 'guard2', hip: [-8, 86] },
  // raises the staff against the overhead smash: and it snaps
  { t: 5.86, x: 780, p: 'parryHigh', e: 'out' },
  { t: 5.95, x: 776, p: 'parryHigh', hip: [-8, 66], e: 'in' },
  { t: 6.03, x: 768, hip: [-12, 58], lean: -10, hF: [54, 20], hB: [-34, 30], fF: [32, 0], fB: [-34, 0], slide: true, e: 'snap' },
  { t: 6.12, same: true },
  // two halves: parry, head, ribs, overhead…
  { t: 6.24, x: 776, hip: [0, 86], lean: 10, hF: [20, 20], hB: [52, -8], fF: [32, 0], fB: [-32, 0], e: 'snap' },
  { t: 6.34, x: 806, hip: [8, 88], lean: 18, hF: [66, 26], hB: [20, -10], fF: [40, 0], fB: [-36, 0], e: 'snap' },
  { t: 6.44, hip: [10, 84], lean: 22, hF: [20, 10], hB: [64, -14], fF: [40, 0], fB: [-36, 0], e: 'snap' },
  { t: 6.56, hip: [6, 90], lean: 14, hF: [60, 40], hB: [10, -20], fF: [40, 0], fB: [-36, 0], e: 'snap' },
  { t: 6.62, same: true },
  // …both knocked out of his hands
  { t: 6.72, x: 782, hip: [-6, 84], lean: -4, hF: [50, 34], hB: [-30, 20], fF: [36, 0], fB: [-34, 0], e: 'snap' },
  { t: 6.9, x: 776, hip: [-10, 80], lean: -12, hF: [30, -30], hB: [-40, 0], fF: [34, 0], fB: [-34, 0], e: 'snap' },
  { t: 6.98, same: true },
  // stomp kick in the chest: launched over the crate to the billboard
  { t: 7.06, x: 770, y: H1 + 6, p: 'fold', e: 'snap' },
  { t: 7.12, same: true, x: 764 },
  ...flight(7.12, 7.46, [764, H1 + 6], [520, H1], 2600, [
    [7.22, { p: 'flyBack' }],
    [7.34, { hip: [0, 56], lean: 30, bend: 8, hF: [40, -20], hB: [30, -30], fF: [34, 14], fB: [-14, 6] }],
  ], { hip: [-14, 40], lean: -30, hF: [-30, -60], hB: [-50, -20], fF: [40, 0], fB: [10, 0] }),
  { t: 7.62, x: 486, hip: [-16, 34], lean: -36, tilt: 20, hF: [-20, -56], hB: [-48, -30], fF: [52, 0], fB: [20, 0], slide: true, e: 'out' },
  // against the billboard: reaches into the drawing and pulls the sword out of it
  { t: 7.8, x: 486, hip: [-8, 60], lean: -6, tilt: -24, hF: [20, -30], hB: [-40, 30], fF: [40, 0], fB: [-10, 0] },
  { t: 7.92, face: -1, x: 478, hip: [6, 76], lean: 14, hFw: [434, H1 + 117], hB: [-20, -30], fF: [-34, 0], fB: [20, 0], e: 'out' },
  { t: 8.02, hip: [8, 74], lean: 18, hFw: [434, H1 + 117], hB: [-24, -26], fF: [-34, 0], fB: [20, 0] },
  { t: 8.14, hip: [-6, 88], lean: -6, hF: [-10, 40], hB: [-30, -10], fF: [-34, 0], fB: [20, 0], e: 'snap' },
  { t: 8.28, face: 1, x: 486, hip: [-2, 92], lean: 4, hF: [20, 50], hB: [-10, -20], fF: [30, 0], fB: [-28, 0] },
  { t: 8.42, p: 'guard1', x: 490 },
]);

// ── FIGHTER B: The Powerhouse ───────────────────────────────────────────────
const B1 = r1([
  { t: 0, x: 660, y: 1330, face: 1, hip: [0, 70], lean: 50, hF: [50, 20], hB: [-40, 30], fF: [40, 30], fB: [-50, 30] },
  ...flight(0, 0.66, [660, 1330], [880, H1], 3000, [
    [0.25, { hip: [0, 80], lean: 40, hF: [40, 30], hB: [-40, 34], fF: [30, 20], fB: [-40, 30] }],
    [0.5, { hip: [0, 84], lean: 20, hF: [44, 40], hB: [-30, 50], fF: [36, 10], fB: [-30, 16] }],
  ], { hip: [10, 44], lean: 56, bend: 14, hF: [24, -80], hB: [8, -80], fF: [52, 0], fB: [-52, 0], e: 'in' }),
  { t: 0.74, same: true },
  { t: 0.94, x: 926, hip: [6, 50], lean: 50, bend: 12, hF: [26, -76], hB: [-10, -70], fF: [52, 0], fB: [-52, 0], slide: true, e: 'out' },
  // rises, turns on A, stomps into his stance
  { t: 1.12, x: 930, hip: [0, 74], lean: 26, hF: [20, -50], hB: [-14, -52], fF: [48, 0], fB: [-48, 0] },
  { t: 1.26, face: -1, x: 930, hip: [0, 84], lean: 4, hF: [14, -46], hB: [-14, -46], fF: [-48, 0], fB: [48, 0] },
  { t: 1.36, hip: [0, 98], lean: 0, hF: [26, -20], hB: [-26, -20], fF: [10, 16], fB: [-10, 16], e: 'out' },
  { t: 1.46, p: 'bStance', hip: [0, 64], lean: 26, hF: [34, -48], hB: [-6, -52], e: 'in3' },
  { t: 1.58, p: 'bStance', hip: [-24, 72], lean: 0, hB: [-56, -4], hF: [30, -28], e: 'out' },
  // charges and leaps in with a double hammer-fist
  { t: 1.68, x: 900, p: 'bRun1', hop: 8, e: 'lin' },
  { t: 1.8, x: 830, p: 'bRun2', hop: 10, e: 'lin' },
  { t: 1.9, x: 770, hip: [6, 80], lean: 18, hF: [10, 40], hB: [0, 44], fF: [30, 0], fB: [-36, 0], e: 'lin' },
  ...flight(1.9, 2.24, [770, H1], [722, H1], 2800, [
    [2.04, { hip: [0, 84], lean: -14, hF: [-4, 74], hB: [-14, 72], fF: [24, 20], fB: [-36, 30] }],
    [2.2, { hip: [10, 84], lean: 32, hFw: [640, H1 + 168], hBw: [628, H1 + 168], fF: [36, 6], fB: [-30, 16], e: 'in' }],
  ], { hip: [12, 74], lean: 36, hFw: [634, H1 + 162], hBw: [622, H1 + 162], fF: [40, 0], fB: [-44, 0] }),
  { t: 2.36, x: 722, hip: [14, 72], lean: 38, hFw: [616, H1 + 158], hBw: [604, H1 + 158], fF: [40, 0], fB: [-44, 0] },
  // fists slide off; the staff takes his lead leg, then his chin
  { t: 2.48, x: 764, hip: [-6, 78], lean: 10, hF: [44, -20], hB: [30, -34], fF: [40, 0], fB: [-44, 0], e: 'in' },
  { t: 2.58, x: 774, hip: [-12, 66], lean: 2, hF: [40, -40], hB: [-20, -50], fF: [20, 30], fB: [-44, 0], e: 'snap' },
  { t: 2.64, same: true },
  { t: 2.76, x: 790, hip: [6, 58], lean: 44, hF: [44, -56], hB: [10, -60], fF: [30, 0], fB: [-50, 0] },
  { t: 2.88, x: 794, p: 'hitBack', e: 'snap' },
  { t: 2.94, same: true },
  { t: 3.1, x: 820, p: 'stagger', slide: true, e: 'out' },
  { t: 3.24, x: 852, hip: [-4, 78], lean: 10, hF: [34, -10], hB: [-10, -30], fF: [44, 0], fB: [-44, 0] },
  // double kick in the chest → thrown back into the vent stack
  { t: 3.3, x: 858, y: H1 + 4, p: 'fold', e: 'snap' },
  { t: 3.36, same: true, x: 862 },
  ...flight(3.36, T_VENT, [862, H1 + 4], [966, H1], 2400, [
    [3.44, { p: 'flyBack' }],
  ], { hip: [-16, 40], lean: -24, hF: [-30, -50], hB: [-44, -20], fF: [50, 0], fB: [20, 0] }),
  { t: 3.62, same: true },
  // his hands find the pipe and the pen nib behind him: tears them loose
  { t: 3.74, x: 966, hip: [-14, 44], lean: -18, tilt: 16, hFw: [965, H1 + 89], hBw: [1012, H1 + 61], fF: [50, 0], fB: [16, 0] },
  { t: 3.84, same: true },
  { t: 3.96, x: 960, hip: [0, 80], lean: 14, hF: [20, 30], hB: [-40, -10], fF: [44, 0], fB: [-40, 0], e: 'snap' },
  { t: 4.1, x: 954, p: 'bStance', hF: [36, 4], hB: [10, -34] },
  // flurry: overhead baton, knife thrust, backhand
  { t: 4.2, x: 986, hip: [-10, 84], lean: -4, hF: [-10, 66], hB: [16, -30], fF: [46, 0], fB: [-46, 0] },
  { t: 4.32, x: 980, hip: [10, 76], lean: 30, hF: [70, 30], hB: [-10, -36], fF: [52, 0], fB: [-46, 0], e: 'snap' },
  { t: 4.38, same: true },
  { t: 4.44, x: 980, hip: [-6, 78], lean: 10, hF: [40, 30], hB: [-30, -20], fF: [50, 0], fB: [-46, 0] },
  { t: 4.52, x: 974, hip: [14, 70], lean: 34, hF: [20, 10], hB: [80, -24], fF: [56, 0], fB: [-50, 0], e: 'snap' },
  { t: 4.6, x: 974, hip: [-4, 80], lean: 6, hF: [-20, 30], hB: [30, -20], fF: [52, 0], fB: [-48, 0] },
  { t: 4.68, x: 970, hip: [12, 80], lean: 24, hF: [80, 24], hB: [-20, -30], fF: [54, 0], fB: [-48, 0], e: 'snap' },
  { t: 4.76, hip: [16, 78], lean: 32, hF: [60, -10], hB: [-24, -30], fF: [54, 0], fB: [-48, 0] },
  // takes the staff end in the gut
  { t: 4.84, x: 980, p: 'fold', hip: [-18, 78], e: 'snap' },
  { t: 4.9, same: true },
  { t: 5.0, x: 992, hip: [-8, 78], lean: 20, hF: [30, -6], hB: [0, -30], fF: [46, 0], fB: [-46, 0], slide: true },
  { t: 5.06, x: 980, hip: [-6, 84], lean: 0, hF: [10, 64], hB: [10, -30], fF: [46, 0], fB: [-46, 0] },
  { t: 5.12, x: 966, hip: [12, 72], lean: 34, hF: [66, -20], hB: [-10, -30], fF: [54, 0], fB: [-46, 0], e: 'snap' },
  { t: 5.24, x: 960, hip: [16, 76], lean: 30, hF: [30, -30], hB: [82, -4], fF: [56, 0], fB: [-48, 0], e: 'snap' },
  { t: 5.34, hip: [8, 80], lean: 20, hF: [30, -10], hB: [40, 30], fF: [54, 0], fB: [-48, 0] },
  { t: 5.5, x: 964, hip: [-6, 80], lean: 6, hF: [44, 6], hB: [-10, -30], fF: [50, 0], fB: [-46, 0], e: 'snap' },
  { t: 5.56, same: true },
  { t: 5.68, x: 958, hip: [8, 78], lean: 24, hF: [50, 10], hB: [40, -10], fF: [52, 0], fB: [-46, 0] },
  // both arms high… and down through the staff
  { t: 5.84, x: 964, hip: [-14, 86], lean: -12, hF: [-16, 72], hB: [-10, 60], fF: [46, 0], fB: [-46, 0], e: 'out' },
  { t: 5.95, x: 952, hip: [14, 66], lean: 42, hF: [62, 14], hB: [20, -30], fF: [56, 0], fB: [-46, 0], e: 'in3' },
  { t: 6.03, hip: [18, 60], lean: 50, hF: [56, -30], hB: [20, -36], fF: [56, 0], fB: [-46, 0] },
  { t: 6.12, same: true },
  { t: 6.22, x: 952, hip: [8, 76], lean: 26, hF: [30, -10], hB: [76, 4], fF: [54, 0], fB: [-46, 0], e: 'snap' },
  { t: 6.34, x: 956, hip: [-10, 80], lean: -10, tilt: -24, hF: [30, 10], hB: [40, 0], fF: [50, 0], fB: [-46, 0], e: 'snap' },
  { t: 6.44, x: 940, hip: [-14, 76], lean: 16, bend: 14, hF: [20, -10], hB: [20, -20], fF: [50, 0], fB: [-46, 0], e: 'snap' },
  { t: 6.56, x: 958, hip: [-4, 82], lean: 4, hF: [40, 40], hB: [0, -30], fF: [50, 0], fB: [-46, 0], e: 'snap' },
  { t: 6.62, same: true },
  { t: 6.72, x: 954, hip: [8, 80], lean: 20, hF: [44, 44], hB: [78, 6], fF: [52, 0], fB: [-46, 0], e: 'snap' },
  { t: 6.8, hip: [-6, 84], lean: -2, hF: [-10, 66], hB: [30, 10], fF: [52, 0], fB: [-46, 0] },
  { t: 6.9, x: 948, hip: [12, 74], lean: 32, hF: [66, 0], hB: [0, -30], fF: [54, 0], fB: [-46, 0], e: 'snap' },
  // chambers the knee: stomp kick
  { t: 6.98, x: 908, hip: [-10, 86], lean: -10, hF: [20, -10], hB: [-20, -20], fF: [20, 50], fB: [-30, 0] },
  { t: 7.06, x: 896, hip: [6, 88], lean: -22, hF: [10, -20], hB: [-40, -10], fF: [100, 80], fB: [-30, 0], e: 'snap' },
  { t: 7.12, same: true },
  { t: 7.3, x: 890, p: 'bStance', hF: [36, 0], hB: [10, -34] },
  // stalks after him
  { t: 7.6, x: 870, p: 'bStance', hip: [0, 84], lean: 12, hF: [36, 4], hB: [10, -30] },
  { t: 7.9, x: 852, p: 'bStance', hF: [36, 0], hB: [10, -34] },
  { t: 8.2, x: 852, p: 'bStance', hip: [-4, 84], lean: 6, tilt: -10 },
  { t: 8.42, x: 852, hip: [-20, 80], lean: -14, hF: [30, -10], hB: [-60, 30], fF: [46, 0], fB: [-46, 0] },
]);

const A2 = [...r1([
  // the thrown knife: flicked aside into the billboard
  { t: 8.6, p: 'guard1', x: 490, hip: [-8, 88], lean: 2, hF: [30, 20], hB: [0, -24] },
  { t: 8.72, x: 494, hip: [4, 88], lean: 12, hF: [56, 14], hB: [-20, -20], fF: [34, 0], fB: [-30, 0], e: 'snap' },
  { t: 8.78, same: true },
  { t: 9.0, p: 'guard1', x: 492, hip: [-4, 92] },
  // the crate: sword high, cuts down through it
  { t: 9.2, x: 490, hip: [-10, 88], lean: -10, hF: [0, 66], hB: [-20, 40], fF: [30, 0], fB: [-30, 0], e: 'out' },
  { t: 9.36, x: 500, hip: [10, 76], lean: 30, hF: [62, -10], hB: [-10, -30], fF: [40, 0], fB: [-34, 0], e: 'in3' },
  { t: 9.42, same: true },
  // dashes in: first cut shears the baton, second finds air
  { t: 9.52, x: 540, hip: [10, 76], lean: 34, hF: [40, -24], hB: [-20, -30], fF: [40, 14], fB: [-56, 0], e: 'in' },
  { t: 9.64, x: 620, p: 'run2', hF: [30, -10], e: 'lin' },
  { t: 9.76, x: 690, p: 'run1', hF: [-10, 30], hB: [20, -20], e: 'lin' },
  { t: 9.88, x: 684, hip: [12, 84], lean: 26, hF: [60, 40], hB: [-24, -20], fF: [44, 0], fB: [-40, 0], e: 'snap' },
  { t: 9.94, same: true },
  { t: 10.04, x: 704, hip: [4, 86], lean: 10, hF: [10, 40], hB: [-10, -20], fF: [36, 0], fB: [-34, 0] },
  { t: 10.14, x: 740, hip: [14, 80], lean: 30, hF: [70, -6], hB: [-26, -16], fF: [50, 0], fB: [-44, 0], e: 'snap' },
  { t: 10.3, x: 780, p: 'guard1', hip: [-4, 88] },
  { t: 10.5, x: 820, p: 'guard1', hip: [-4, 92] },
  { t: 10.7, x: 850, p: 'guard1' },
  // sword on sword: parry high, low riposte, duck, rising cut
  { t: 10.82, x: 870, p: 'guard1', hip: [-6, 88] },
  { t: 10.92, x: 870, hip: [-8, 76], lean: -6, hF: [40, 44], hB: [-10, -10], fF: [32, 0], fB: [-32, 0], e: 'snap' },
  { t: 10.98, same: true },
  { t: 11.02, hip: [-6, 80], lean: 0, hF: [10, 30], hB: [-10, -20], fF: [32, 0], fB: [-32, 0] },
  { t: 11.1, x: 866, hip: [12, 66], lean: 34, hF: [64, -40], hB: [-24, -20], fF: [46, 0], fB: [-40, 0], e: 'snap' },
  { t: 11.18, hip: [4, 74], lean: 20, hF: [40, -20], hB: [-16, -24], fF: [46, 0], fB: [-40, 0] },
  { t: 11.26, x: 862, hip: [-8, 40], lean: 24, bend: 10, hF: [26, -24], hB: [-14, -36], fF: [36, 0], fB: [-36, 0], e: 'snap' },
  { t: 11.36, hip: [-10, 44], lean: 18, hF: [10, -30], hB: [-10, -40], fF: [36, 0], fB: [-34, 0] },
  { t: 11.44, x: 906, hip: [10, 90], lean: 16, hF: [58, 36], hB: [-24, -10], fF: [40, 0], fB: [-36, 0], e: 'snap' },
  { t: 11.5, same: true },
  // bind (shoved back) blocks the big backhand, skids
  { t: 11.62, x: 900, hip: [-10, 80], lean: -10, hF: [44, 34], hB: [20, 20], fF: [36, 0], fB: [-36, 0], e: 'in' },
  { t: 11.76, x: 850, hip: [-12, 74], lean: -4, hF: [40, 20], hB: [0, -10], fF: [34, 0], fB: [-34, 0], slide: true, e: 'out' },
  { t: 11.88, x: 846, p: 'guard1', hip: [-8, 84] },
  { t: 11.96, x: 830, hip: [-10, 72], lean: -8, hF: [40, 24], hB: [10, 10], fF: [34, 0], fB: [-34, 0], e: 'snap' },
  { t: 12.02, same: true },
  { t: 12.08, x: 808, hip: [-10, 70], lean: -4, hF: [40, 20], hB: [0, -10], fF: [34, 0], fB: [-34, 0], slide: true, e: 'out' },
  // answers with three cuts that drive B to the roof edge, then a lunge at nothing
  { t: 12.14, x: 826, hip: [-6, 84], lean: 0, hF: [0, 50], hB: [-10, -20], fF: [34, 0], fB: [-34, 0] },
  { t: 12.22, x: 850, hip: [12, 84], lean: 24, hF: [66, 20], hB: [-24, -20], fF: [44, 0], fB: [-40, 0], e: 'snap' },
  { t: 12.28, x: 880, hip: [4, 86], lean: 10, hF: [30, -20], hB: [-10, -20], fF: [40, 0], fB: [-36, 0] },
  { t: 12.34, x: 900, hip: [12, 84], lean: 24, hF: [64, 24], hB: [-24, -16], fF: [44, 0], fB: [-40, 0], e: 'snap' },
  { t: 12.46, x: 866, hip: [0, 84], lean: 6, hF: [10, 10], hB: [10, -10], fF: [40, 0], fB: [-36, 0] },
  { t: 12.56, x: 880, p: 'thrust', e: 'snap' },
  { t: 12.62, same: true },
  { t: 12.72, x: 1010, p: 'run1', hF: [30, -6], e: 'lin' },
  // the clothesline: takes hold, cuts it loose at the pole…
  { t: 12.88, x: 1120, hip: [0, 92], lean: 0, tilt: -20, hF: [30, 0], hBw: [1153, H1 + 199], fF: [26, 0], fB: [-26, 0] },
  { t: 13.0, x: 1122, hip: [-6, 90], lean: -8, hF: [-10, -30], hBw: [1153, H1 + 199], fF: [26, 0], fB: [-26, 0] },
  { t: 13.1, x: 1124, hip: [0, 94], lean: 4, hF: [22, 62], hBw: [1153, H1 + 199], fF: [26, 0], fB: [-26, 0], e: 'snap' },
]),
  // …and swings across the gap, both feet into B
  { t: 13.2, x: 1150, y: 496, hip: [0, 92], lean: 10, hBw: [1155, 698], hF: [30, -10], fF: [10, 6], fB: [-30, 10], e: 'in', er: 'in' },
  { t: 13.3, x: 1195, y: 458, hip: [0, 92], lean: -26, hBw: [1200, 658], hF: [-10, -30], fF: [-10, 12], fB: [-40, 22], e: 'lin', er: 'lin' },
  { t: 13.4, x: 1268, y: 419, hip: [0, 90], lean: -34, hBw: [1275, 617], hF: [-34, 10], fF: [50, 50], fB: [28, 34], e: 'lin', er: 'lin' },
  { t: 13.5, x: 1356, y: 398, hip: [0, 88], lean: -36, hBw: [1369, 594], hF: [-44, 26], fF: [86, 76], fB: [70, 58], e: 'lin', er: 'lin' },
  { t: 13.6, x: 1436, y: 394, hip: [0, 86], lean: -30, hBw: [1447, 594], hF: [20, 10], fF: [100, 86], fB: [92, 68], e: 'lin', er: 'lin' },
  { t: 13.66, x: 1452, y: 396, hip: [0, 86], lean: -30, hBw: [1465, 597], hF: [20, 10], fF: [98, 84], fB: [70, 50] },
  { t: 13.74, x: 1478, y: 398, hip: [0, 84], lean: -16, hBw: [1500, 606], hF: [30, 0], fF: [50, 40], fB: [20, 24] },
  ...flight(13.74, 13.92, [1478, 398], [1440, H2], 2400, [], { hip: [0, 50], lean: 30, bend: 8, hF: [34, -30], hB: [-12, -50], fF: [32, 0], fB: [-32, 0] }),
  ...r2([
    { t: 14.06, x: 1440, p: 'guard1', hip: [-4, 84] },
    { t: 14.2, x: 1432, hip: [-8, 84], lean: -8, hF: [36, 20], hB: [0, -20], fF: [32, 0], fB: [-30, 0] },
    // drops under the cut that takes the pencil tower
    { t: 14.3, x: 1404, hip: [-4, 30], lean: 30, bend: 12, tilt: -30, hF: [30, -20], hB: [-20, -30], fF: [38, 0], fB: [-40, 0], slide: true, e: 'snap' },
    { t: 14.42, same: true },
    // rising cut from the crouch, cut, parry, then drives B to the edge
    { t: 14.52, x: 1470, hip: [10, 86], lean: 18, hF: [60, 40], hB: [-20, -10], fF: [40, 0], fB: [-36, 0], e: 'snap' },
    { t: 14.58, same: true },
    { t: 14.68, x: 1466, hip: [0, 86], lean: 4, hF: [0, 40], hB: [-10, -20], fF: [36, 0], fB: [-34, 0] },
    { t: 14.78, x: 1462, hip: [12, 82], lean: 26, hF: [66, 8], hB: [-24, -20], fF: [44, 0], fB: [-40, 0], e: 'snap' },
    { t: 14.88, x: 1462, p: 'guard1', hip: [-6, 86] },
    { t: 14.98, x: 1462, hip: [-8, 76], lean: -6, hF: [40, 44], hB: [-10, -10], fF: [32, 0], fB: [-32, 0], e: 'snap' },
    { t: 15.04, same: true },
    { t: 15.14, x: 1470, hip: [-4, 70], lean: 20, hF: [40, 30], hB: [20, 10], fF: [34, 0], fB: [-36, 0] },
    { t: 15.28, x: 1572, hip: [14, 78], lean: 28, hF: [72, 30], hB: [50, 16], fF: [46, 0], fB: [-56, 0], e: 'in' },
  ]),
];

const B2 = [...r1([
  // throws the knife
  { t: 8.56, x: 846, hip: [14, 76], lean: 30, hF: [30, -20], hB: [80, 10], fF: [54, 0], fB: [-48, 0], e: 'snap' },
  { t: 8.7, hip: [16, 74], lean: 36, hF: [20, -30], hB: [60, -30], fF: [54, 0], fB: [-48, 0] },
  { t: 8.86, x: 846, p: 'bStance', hF: [36, 0], hB: [0, -36] },
  // boots the crate at him
  { t: 9.0, x: 838, hip: [-12, 84], lean: -8, hF: [20, -20], hB: [-30, -10], fF: [-10, 30], fB: [-40, 0] },
  { t: 9.14, x: 836, hip: [8, 86], lean: -16, hF: [-10, -30], hB: [-40, 10], fF: [70, 24], fB: [-36, 0], e: 'snap' },
  { t: 9.2, same: true },
  { t: 9.36, x: 838, p: 'bStance', hF: [36, 4], hB: [0, -30] },
  { t: 9.6, x: 840, p: 'bStance', hip: [-6, 82], lean: 8, hF: [40, 20], hB: [0, -30] },
  // baton up: sheared in half
  { t: 9.8, x: 844, hip: [-8, 84], lean: 4, hF: [44, 36], hB: [-6, -30], fF: [46, 0], fB: [-46, 0] },
  { t: 9.88, x: 852, hip: [-14, 78], lean: -8, hF: [46, 30], hB: [-10, -30], fF: [46, 0], fB: [-46, 0], e: 'snap' },
  { t: 9.94, same: true },
  { t: 10.04, x: 862, hip: [-10, 82], lean: -4, tilt: 20, hF: [30, 10], hB: [-10, -30], fF: [46, 0], fB: [-46, 0] },
  // leaps back to the weathervane and tears the sword off it
  { t: 10.12, x: 870, hip: [-10, 60], lean: 20, hF: [20, -30], hB: [-30, -30], fF: [40, 0], fB: [-40, 0] },
  ...flight(10.12, 10.4, [870, H1], [1092, H1], 3600, [
    [10.26, { hip: [0, 84], lean: 10, hF: [30, 20], hB: [-30, 30], fF: [30, 24], fB: [-30, 20] }],
  ], { hip: [-8, 58], lean: 24, hF: [40, 10], hB: [-30, -30], fF: [44, 0], fB: [-44, 0] }),
  { t: T_VANE, x: 1092, hip: [0, 84], lean: 10, hFw: [1031, H1 + 178], hB: [-20, -30], fF: [46, 0], fB: [-44, 0], e: 'out' },
  { t: 10.58, hip: [-8, 80], lean: -2, hFw: [1031, H1 + 178], hB: [-30, -20], fF: [46, 0], fB: [-44, 0] },
  { t: 10.66, x: 1096, hip: [-10, 84], lean: -10, hF: [10, 60], hB: [-30, -10], fF: [46, 0], fB: [-44, 0], e: 'snap' },
  { t: 10.76, x: 1090, p: 'bStance', hF: [40, 10], hB: [0, -34] },
  // overhead: low parry: head-high cut: blocks the rising cut
  { t: 10.82, x: 1086, hip: [-10, 86], lean: -8, hF: [0, 70], hB: [-20, -20], fF: [46, 0], fB: [-46, 0] },
  { t: 10.92, x: 1074, hip: [12, 76], lean: 32, hF: [70, 44], hB: [-20, -30], fF: [56, 0], fB: [-46, 0], e: 'snap' },
  { t: 10.98, same: true },
  { t: 11.1, x: 1080, hip: [-8, 74], lean: 14, hF: [50, -44], hB: [-10, -30], fF: [50, 0], fB: [-46, 0], e: 'snap' },
  { t: 11.18, hip: [-10, 82], lean: -6, hF: [-20, 40], hB: [20, -20], fF: [50, 0], fB: [-46, 0] },
  { t: 11.28, x: 1070, hip: [14, 80], lean: 26, hF: [80, 26], hB: [-30, -20], fF: [56, 0], fB: [-46, 0], e: 'snap' },
  { t: 11.36, hip: [16, 78], lean: 32, hF: [50, -10], hB: [-30, -24], fF: [56, 0], fB: [-46, 0] },
  { t: 11.44, x: 1082, hip: [-14, 84], lean: -10, hF: [44, 30], hB: [-10, -20], fF: [50, 0], fB: [-46, 0], e: 'snap' },
  { t: 11.5, same: true },
  // bind and shove, then the big backhand
  { t: 11.62, x: 1066, hip: [16, 76], lean: 30, hF: [70, 20], hB: [50, 10], fF: [56, 0], fB: [-46, 0], e: 'in' },
  { t: 11.8, x: 1090, hip: [-10, 82], lean: -10, hF: [-30, 30], hB: [30, 0], fF: [50, 0], fB: [-46, 0] },
  { t: 11.96, x: 1084, hip: [16, 78], lean: 30, hF: [82, 16], hB: [-30, -20], fF: [58, 0], fB: [-48, 0], e: 'snap' },
  { t: 12.02, same: true },
  { t: 12.14, x: 1066, p: 'bStance', hF: [40, 10], hB: [0, -30] },
  // driven back to the edge
  { t: 12.22, x: 1060, hip: [-8, 80], lean: 0, hF: [44, 26], hB: [-10, -20], fF: [46, 0], fB: [-46, 0], e: 'snap' },
  { t: 12.34, x: 1090, hip: [-12, 78], lean: -6, hF: [46, 10], hB: [-10, -20], fF: [46, 0], fB: [-44, 0], e: 'snap' },
  { t: 12.42, x: 1118, hip: [-4, 54], lean: 24, hF: [30, -20], hB: [-30, -30], fF: [40, 0], fB: [-34, 0] },
  // huge backward leap across the gap, down onto roof 2
  { t: 12.46, x: 1118, hip: [0, 86], lean: -6, hF: [30, 40], hB: [10, 50], fF: [30, 0], fB: [-30, 0], e: 'in' },
  ...flight(12.46, 13.0, [1118, H1], [1520, H2], 6000, [
    [12.62, { hip: [0, 88], lean: -14, hF: [40, 40], hB: [-30, 50], fF: [36, 20], fB: [10, 6] }],
    [12.84, { hip: [0, 76], lean: 12, hF: [34, 20], hB: [-30, 30], fF: [30, 22], fB: [-24, 18] }],
  ], { hip: [0, 48], lean: 34, bend: 10, hF: [34, -40], hB: [-12, -58], fF: [42, 0], fB: [-42, 0] }),
]), ...r2([
  { t: 13.14, x: 1520, hip: [0, 62], lean: 28, hF: [36, -30], hB: [-12, -50], fF: [42, 0], fB: [-42, 0] },
  { t: 13.3, x: 1524, p: 'bStance', tilt: -24, hF: [40, 10], hB: [0, -34] },
  { t: 13.46, x: 1530, hip: [-10, 84], lean: -8, tilt: -20, hF: [-10, 60], hB: [-30, 10], fF: [46, 0], fB: [-46, 0] },
  // both of A's feet in his chest
  { t: 13.6, x: 1530, y: H2 + 4, p: 'fold', e: 'snap' },
  { t: 13.68, same: true, x: 1536 },
  { t: 13.9, x: 1670, p: 'stagger', slide: true, e: 'out' },
  { t: 14.04, x: 1690, hip: [-6, 70], lean: 20, hF: [34, -20], hB: [-20, -30], fF: [46, 0], fB: [-46, 0] },
  // the cut that goes through the pencil tower
  { t: 14.16, x: 1670, hip: [-16, 78], lean: -8, hF: [-30, 30], hB: [40, 0], fF: [46, 0], fB: [-46, 0] },
  { t: 14.3, x: 1610, hip: [18, 76], lean: 32, hF: [84, 6], hB: [-36, -10], fF: [60, 0], fB: [-50, 0], e: 'snap' },
  { t: 14.38, hip: [20, 72], lean: 40, hF: [40, -36], hB: [-30, -20], fF: [60, 0], fB: [-50, 0] },
  { t: 14.46, x: 1616, hip: [4, 80], lean: 14, tilt: -24, hF: [36, -10], hB: [0, -34], fF: [52, 0], fB: [-46, 0] },
  { t: 14.52, x: 1650, hip: [-12, 82], lean: -12, hF: [40, 30], hB: [-10, -20], fF: [48, 0], fB: [-46, 0], e: 'snap' },
  { t: 14.58, same: true },
  { t: 14.78, x: 1714, hip: [-10, 80], lean: -4, hF: [44, 4], hB: [-10, -24], fF: [46, 0], fB: [-46, 0], e: 'snap' },
  { t: 14.88, x: 1712, hip: [-8, 84], lean: -6, hF: [0, 66], hB: [-20, -10], fF: [46, 0], fB: [-46, 0] },
  { t: 14.98, x: 1700, hip: [12, 76], lean: 30, hF: [72, 44], hB: [-20, -30], fF: [54, 0], fB: [-46, 0], e: 'snap' },
  { t: 15.04, same: true },
  { t: 15.14, x: 1712, p: 'bStance', hF: [40, 14], hB: [0, -30] },
  { t: 15.28, x: 1722, hip: [-16, 76], lean: -20, hF: [40, 30], hB: [30, 20], fF: [40, 0], fB: [-36, 0], e: 'snap' },
]),
];

const A3 = [
  // B goes over the edge: A springs after him, cuts down at him in mid-air, lands on the far wall
  { t: 15.36, x: 1608, y: H2, hip: [4, 70], lean: 34, hF: [60, 20], hB: [30, 0], fF: [44, 0], fB: [-46, 0] },
  { t: 15.42, x: 1640, y: H2, hip: [10, 84], lean: 26, hF: [10, 60], hB: [-20, 30], fF: [30, 0], fB: [-44, 0], e: 'in' },
  ...flight(15.42, 16.0, [1640, H2], [2096, 190], 3600, [
    [15.52, { hip: [0, 78], lean: 36, hF: [20, 66], hB: [-30, 30], fF: [20, 20], fB: [-40, 30] }],
    [15.62, { hip: [0, 74], lean: 30, hFw: [1840, 500], hB: [-40, 30], fF: [10, 20], fB: [-40, 30], e: 'snap' }],
    [15.8, { hip: [0, 70], lean: 10, hF: [30, 40], hB: [-30, 20], fF: [36, 20], fB: [10, 10] }],
  ], { hip: [8, 60], lean: -6, hF: [10, 50], hB: [-30, 10], fFw: [2138, 236], fBw: [2138, 196] }),
  { t: 16.06, x: 2100, y: 190, hip: [18, 54], lean: 6, hF: [-10, 56], hB: [-30, 0], fFw: [2138, 236], fBw: [2138, 196] },
  // wall-kick: dives back at B, blade first
  ...flight(16.06, 16.3, [2100, 190], [2030, 0], 3200, [
    [16.13, { face: -1, hip: [0, 80], lean: 30, hF: [10, 70], hB: [-30, 20], fF: [-30, 30], fB: [-50, 10] }],
    [16.2, { face: -1, hip: [0, 80], lean: 44, hF: [70, 14], hB: [-30, 10], fF: [-10, 20], fB: [-50, 20], e: 'snap' }],
  ], { face: -1, hip: [6, 48], lean: 36, hF: [50, -20], hB: [-12, -50], fF: [34, 0], fB: [-34, 0] }),
  { t: 16.4, x: 2050, hip: [-4, 70], lean: 14, hF: [36, 0], hB: [-10, -30], fF: [32, 0], fB: [-32, 0] },
  { t: 16.5, x: 2044, hip: [-8, 80], lean: -8, hF: [44, 20], hB: [-10, -20], fF: [32, 0], fB: [-32, 0], e: 'snap' },
  { t: 16.56, same: true },
  { t: 16.62, hip: [-6, 84], lean: 0, hF: [6, 16], hB: [10, -10], fF: [32, 0], fB: [-32, 0] },
  { t: 16.7, x: 2056, hip: [8, 84], lean: 16, hF: [56, 0], hB: [-20, -20], fF: [44, 0], fB: [-40, 0], e: 'snap' },
  { t: 16.79, x: 2082, hip: [-6, 50], lean: 20, hF: [30, -10], hB: [-20, -30], fF: [30, 0], fB: [-30, 0] },
  // springs onto the wall over B's cut, two steps up it, back-flips over him
  ...flight(16.79, 16.94, [2082, 0], [2098, 150], 2400, [], { face: 1, hip: [4, 64], lean: -24, hF: [20, 40], hB: [-30, 30], fFw: [2138, 230], fBw: [2138, 180] }),
  { t: 17.1, x: 2102, y: 230, hip: [6, 70], lean: -34, hF: [10, 50], hB: [-34, 40], fFw: [2138, 270], fBw: [2138, 320], e: 'lin', er: 'lin' },
  ...flight(17.1, 17.58, [2102, 230], [1830, 0], 4600, [
    [17.22, { p: 'aTuck', spin: -100 }],
    [17.34, { p: 'aTuck', spin: -220 }],
    [17.46, { hip: [0, 84], lean: 8, hF: [34, 26], hB: [-30, 24], fF: [14, 0], fB: [-12, 8], spin: -340 }],
  ], { hip: [0, 48], lean: 30, bend: 8, hF: [36, -30], hB: [-12, -50], fF: [32, 0], fB: [-32, 0], spin: -360 }),
  { t: 17.7, x: 1826, p: 'guard1', hip: [-4, 80] },
  { t: 17.78, hip: [-8, 84], lean: -4, hF: [0, 44], hB: [-10, -20], fF: [32, 0], fB: [-32, 0] },
  { t: 17.86, x: 1800, hip: [12, 84], lean: 24, hF: [66, 16], hB: [-24, -20], fF: [44, 0], fB: [-40, 0], e: 'snap' },
  { t: 17.92, same: true },
  { t: 17.98, hip: [4, 80], lean: 12, hF: [30, -24], hB: [-10, -20], fF: [44, 0], fB: [-40, 0] },
  { t: 18.06, x: 1806, hip: [12, 70], lean: 30, hF: [64, -30], hB: [-24, -20], fF: [46, 0], fB: [-40, 0], e: 'snap' },
  { t: 18.12, same: true },
  // B's fist: knocked back against the wall
  { t: 18.22, x: 1816, y: 4, hip: [-14, 78], lean: -18, tilt: -30, hF: [44, 26], hB: [36, 34], fF: [30, 8], fB: [-30, 0], e: 'snap' },
  { t: 18.28, same: true },
  { t: 18.44, x: 1800, hip: [-18, 70], lean: -14, tilt: -20, hF: [30, 20], hB: [-40, 30], fF: [34, 0], fB: [-20, 0], slide: true, e: 'out' },
  { t: 18.7, x: 1800, hip: [-12, 62], lean: 10, tilt: 20, hF: [30, -30], hB: [-30, -10], fF: [34, 0], fB: [-20, 0] },
  { t: 18.92, x: 1800, hip: [-10, 70], lean: 0, tilt: -30, hF: [34, 0], hB: [-30, 0], fF: [34, 0], fB: [-20, 0] },
  { t: 19.0, x: 1800, hip: [4, 50], lean: 36, hF: [40, -30], hB: [-20, -40], fF: [34, 0], fB: [-24, 0] },
  // springs straight up the wall behind him (the blow lands under his feet) then off the wall and over B
  { t: 19.06, x: 1800, hip: [6, 78], lean: 14, hF: [30, 40], hB: [-20, 30], fF: [30, 0], fB: [-30, 0], e: 'in' },
  ...flight(19.06, 19.2, [1800, 0], [1806, 232], 3000, [], { hip: [-4, 44], lean: 34, bend: 8, hF: [30, -20], hB: [-34, 6], fFw: [1764, 230], fBw: [1764, 276] }),
  { t: 19.3, x: 1808, y: 232, hip: [-8, 40], lean: 40, bend: 10, hF: [26, -26], hB: [-36, 0], fFw: [1764, 230], fBw: [1764, 276] },
  ...flight(19.3, 19.66, [1808, 232], [2090, 0], 4200, [
    [19.4, { hip: [0, 84], lean: 30, hF: [40, 40], hB: [-34, 34], fF: [-20, 16], fB: [-50, 26] }],
    [19.52, { hip: [0, 84], lean: 6, hF: [34, 40], hB: [-34, 34], fF: [24, 16], fB: [-30, 26] }],
  ], { hip: [0, 50], lean: 30, bend: 8, hF: [36, -30], hB: [-12, -50], fF: [32, 0], fB: [-32, 0] }),
  { t: 19.8, x: 2094, face: -1, hip: [0, 84], lean: 6, hF: [36, 0], hB: [-10, -24], fF: [-32, 0], fB: [30, 0] },
  { t: 19.9, x: 2092, hip: [-4, 78], lean: 10, tilt: 24, hF: [38, -6], hB: [-10, -20], fF: [-32, 0], fB: [30, 0] },
  // on the cracking floor: cut, parry, cut: shoved back
  { t: 20.0, x: 2080, hip: [-6, 84], lean: -4, hF: [0, 46], hB: [-10, -20], fF: [30, 0], fB: [-30, 0] },
  { t: 20.08, x: 2076, hip: [12, 84], lean: 24, hF: [66, 14], hB: [-24, -20], fF: [44, 0], fB: [-40, 0], e: 'snap' },
  { t: 20.14, same: true },
  { t: 20.26, x: 2080, hip: [-8, 76], lean: -6, hF: [40, 44], hB: [-10, -10], fF: [34, 0], fB: [-32, 0], e: 'snap' },
  { t: 20.32, same: true },
  { t: 20.4, hip: [-4, 80], lean: 4, hF: [0, 20], hB: [10, -10], fF: [34, 0], fB: [-32, 0] },
  { t: 20.48, x: 2076, hip: [12, 80], lean: 26, hF: [66, 30], hB: [-24, -16], fF: [44, 0], fB: [-40, 0], e: 'snap' },
  { t: 20.54, same: true },
  { t: 20.66, x: 2104, hip: [-12, 74], lean: -6, hF: [40, 16], hB: [0, -10], fF: [34, 0], fB: [-34, 0], slide: true, e: 'out' },
  // everything he has
  { t: 20.82, x: 2110, hip: [-14, 70], lean: -14, hF: [-20, 40], hB: [20, -10], fF: [34, 0], fB: [-36, 0] },
  { t: 20.92, x: 2104, hip: [0, 76], lean: 20, hF: [20, 50], hB: [-20, -10], fF: [40, 0], fB: [-40, 0], e: 'in' },
  { t: 21.0, x: 2100, hip: [14, 80], lean: 30, hF: [62, 30], hB: [-26, -10], fF: [48, 0], fB: [-44, 0], e: 'snap' },
  { t: 21.08, same: true },
  { t: 21.22, hip: [2, 80], lean: 10, tilt: 30, hF: [38, 32], hB: [-20, -10], fF: [48, 0], fB: [-44, 0] },
  { t: T_BREAK, same: true },
  // the floor is gone
  { t: 21.4, x: 2096, y: 3, hip: [0, 92], lean: -6, hF: [30, 50], hB: [-34, 44], fF: [20, 4], fB: [-20, 8], e: 'out' },
  { t: 21.6, x: 2086, y: -26, hip: [0, 86], lean: -14, hF: [40, 56], hB: [-40, 50], fF: [26, 14], fB: [-24, 20], e: 'lin', er: 'in' },
  { t: 21.8, x: 2074, y: -76, hip: [0, 84], lean: -18, hF: [38, 60], hB: [-44, 44], fF: [30, 18], fB: [-22, 26], e: 'lin', er: 'lin' },
  { t: 22.0, x: 2062, y: -166, hip: [0, 84], lean: -22, tilt: 10, hF: [36, 60], hB: [-44, 40], fF: [30, 20], fB: [-20, 30], e: 'lin', er: 'lin' },
  { t: 22.2, x: 2050, y: -300, hip: [0, 84], lean: -24, tilt: 10, hF: [36, 60], hB: [-44, 40], fF: [30, 20], fB: [-20, 30], e: 'lin', er: 'lin' },
];

const B3 = [
  // tips backwards off the roof, parries on his back in mid-air, hits the alley floor
  { t: 15.36, x: 1750, y: H2, hip: [-20, 70], lean: -36, hF: [40, 40], hB: [50, 30], fF: [30, 0], fB: [-10, 0] },
  { t: 15.4, x: 1756, y: H2, hip: [-24, 66], lean: -52, hF: [44, 44], hB: [56, 34], fF: [30, 4], fB: [-6, 0], e: 'in' },
  ...flight(15.4, 15.87, [1756, H2], [1880, 0], 3200, [
    [15.5, { hip: [0, 80], lean: -10, hF: [50, 40], hB: [40, 50], fF: [40, 30], fB: [0, 20], spin: -40 }],
    [15.62, { hip: [0, 80], lean: -6, hFw: [1850, 432], hB: [-30, 40], fF: [36, 20], fB: [-10, 24], spin: -70, e: 'snap' }],
    [15.76, { hip: [0, 78], lean: 10, hF: [40, 0], hB: [-40, 30], fF: [34, 8], fB: [-30, 14], spin: -30 }],
  ], { hip: [8, 46], lean: 50, bend: 12, hF: [30, -70], hB: [-10, -76], fF: [52, 0], fB: [-52, 0], e: 'in' }),
  { t: 15.96, same: true },
  // turns, sword overhead: catches the dive
  { t: 16.08, x: 1880, face: 1, hip: [-4, 60], lean: 0, tilt: -20, hF: [30, 50], hB: [-20, 30], fF: [-52, 0], fB: [52, 0] },
  { t: 16.2, x: 1886, hip: [-8, 58], lean: -10, hF: [40, 80], hB: [-10, 50], fF: [-52, 0], fB: [52, 0], e: 'snap' },
  { t: 16.26, same: true },
  { t: 16.36, x: 1836, hip: [-10, 60], lean: 6, hF: [10, -30], hB: [-20, -30], fF: [46, 0], fB: [-46, 0], slide: true, e: 'out' },
  { t: 16.5, x: 1836, hip: [12, 84], lean: 22, hF: [66, 30], hB: [-20, -20], fF: [50, 0], fB: [-46, 0], e: 'snap' },
  { t: 16.56, same: true },
  { t: 16.7, x: 1836, hip: [-10, 80], lean: -4, hF: [40, 10], hB: [-10, -24], fF: [48, 0], fB: [-46, 0], e: 'snap' },
  { t: 16.76, same: true },
  // big cut: A is gone, the tip rakes the wall
  { t: 16.82, x: 1846, hip: [-14, 80], lean: -10, hF: [-30, 30], hB: [30, 0], fF: [48, 0], fB: [-46, 0] },
  { t: 16.94, x: 1896, hip: [18, 76], lean: 32, hF: [84, 0], hB: [-36, -10], fF: [60, 0], fB: [-50, 0], e: 'snap' },
  { t: 17.0, same: true },
  { t: 17.1, x: 1900, hip: [10, 78], lean: 24, tilt: -30, hF: [50, -20], hB: [-20, -30], fF: [56, 0], fB: [-48, 0] },
  { t: 17.22, x: 1906, hip: [-6, 84], lean: -6, tilt: -30, hF: [20, 66], hB: [-20, 20], fF: [50, 0], fB: [-46, 0] },
  { t: 17.34, x: 1936, hip: [4, 66], lean: 24, hF: [50, 30], hB: [-20, -20], fF: [50, 0], fB: [-46, 0] },
  { t: 17.5, x: 1966, face: -1, hip: [0, 80], lean: 6, hF: [30, 0], hB: [-10, -30], fF: [-46, 0], fB: [46, 0] },
  { t: 17.66, x: 1990, p: 'bStance', hF: [40, 10], hB: [0, -34] },
  { t: 17.86, x: 2040, hip: [-10, 80], lean: -4, hF: [44, 26], hB: [-10, -20], fF: [46, 0], fB: [-46, 0], e: 'snap' },
  { t: 17.92, same: true },
  { t: 18.06, x: 2046, hip: [-8, 74], lean: 14, hF: [50, -40], hB: [-10, -30], fF: [50, 0], fB: [-46, 0], e: 'snap' },
  { t: 18.12, same: true },
  // traps the blade low and throws the free fist
  { t: 18.22, x: 1985, hip: [14, 80], lean: 28, hF: [40, -40], hB: [80, 30], fF: [56, 0], fB: [-46, 0], e: 'snap' },
  { t: 18.28, same: true },
  // the big one: both hands, all the way up… and down into the floor
  { t: 18.46, x: 1986, hip: [-6, 84], lean: 4, hF: [30, 10], hB: [20, 0], fF: [46, 0], fB: [-46, 0] },
  { t: 18.72, x: 1978, hip: [-16, 92], lean: -16, hF: [-10, 74], hB: [-20, 64], fF: [44, 0], fB: [-46, 0], e: 'out' },
  { t: 19.0, x: 1970, hip: [-20, 94], lean: -22, hF: [-16, 76], hB: [-26, 66], fF: [44, 0], fB: [-46, 0] },
  { t: 19.1, x: 1966, hip: [0, 90], lean: 6, hF: [30, 70], hB: [20, 60], fF: [50, 0], fB: [-46, 0], e: 'in' },
  { t: T_SLAM, x: 1960, hip: [20, 56], lean: 52, bend: 12, hF: [40, -18], hB: [24, -20], fF: [56, 0], fB: [-50, 0], e: 'in3' },
  { t: 19.3, same: true },
  { t: 19.5, hip: [18, 58], lean: 48, hF: [42, -14], hB: [26, -16], fF: [56, 0], fB: [-50, 0] },
  { t: 19.62, hip: [10, 62], lean: 40, hF: [42, -12], hB: [26, -14], fF: [56, 0], fB: [-50, 0] },
  { t: 19.74, x: 1944, hip: [-12, 84], lean: -10, hF: [30, 30], hB: [10, 30], fF: [50, 0], fB: [-46, 0], e: 'snap' },
  { t: 19.88, x: 1924, face: 1, hip: [0, 82], lean: 10, hF: [36, 10], hB: [0, -30], fF: [-46, 0], fB: [46, 0] },
  { t: 20.0, x: 1850, p: 'bStance', hF: [40, 10], hB: [0, -34] },
  { t: 20.08, x: 1830, hip: [-10, 80], lean: -4, hF: [44, 26], hB: [-10, -20], fF: [46, 0], fB: [-46, 0], e: 'snap' },
  { t: 20.16, hip: [-10, 86], lean: -8, hF: [0, 70], hB: [-20, -20], fF: [46, 0], fB: [-46, 0] },
  { t: 20.26, x: 1840, hip: [12, 76], lean: 32, hF: [70, 46], hB: [-20, -30], fF: [56, 0], fB: [-46, 0], e: 'snap' },
  { t: 20.32, same: true },
  { t: 20.48, x: 1830, hip: [-8, 80], lean: 0, hF: [44, 10], hB: [-10, -20], fF: [48, 0], fB: [-46, 0], e: 'snap' },
  { t: 20.54, same: true },
  { t: 20.64, x: 1900, hip: [16, 76], lean: 30, hF: [70, 20], hB: [50, 10], fF: [56, 0], fB: [-46, 0], e: 'in' },
  { t: 20.82, x: 1820, hip: [-20, 76], lean: -14, hF: [-30, 36], hB: [30, 0], fF: [48, 0], fB: [-46, 0] },
  { t: 20.92, x: 1836, hip: [0, 80], lean: 16, hF: [10, 56], hB: [-10, 10], fF: [50, 0], fB: [-46, 0], e: 'in' },
  { t: 21.0, x: 1858, hip: [16, 78], lean: 32, hF: [70, 30], hB: [-30, -20], fF: [58, 0], fB: [-48, 0], e: 'snap' },
  { t: 21.08, same: true },
  { t: 21.22, hip: [2, 80], lean: 12, tilt: 34, hF: [44, 32], hB: [-30, -10], fF: [58, 0], fB: [-48, 0] },
  { t: T_BREAK, same: true },
  { t: 21.4, x: 1862, y: 0, hip: [0, 88], lean: -10, hF: [40, 40], hB: [-50, 40], fF: [30, 2], fB: [-30, 6], e: 'out' },
  { t: 21.6, x: 1872, y: -34, hip: [0, 84], lean: -20, hF: [50, 50], hB: [-56, 44], fF: [40, 16], fB: [-30, 20], e: 'lin', er: 'in' },
  { t: 21.8, x: 1884, y: -92, hip: [0, 82], lean: -28, hF: [50, 56], hB: [-60, 36], fF: [44, 24], fB: [-26, 30], e: 'lin', er: 'lin' },
  { t: 22.0, x: 1896, y: -196, hip: [0, 82], lean: -34, tilt: 14, hF: [46, 60], hB: [-62, 30], fF: [46, 30], fB: [-22, 36], e: 'lin', er: 'lin' },
  { t: 22.2, x: 1908, y: -340, hip: [0, 82], lean: -36, tilt: 14, hF: [46, 60], hB: [-62, 30], fF: [46, 30], fB: [-22, 36], e: 'lin', er: 'lin' },
];

const A_KEYS = [...A1, ...A2, ...A3];
const B_KEYS = [...B1, ...B2, ...B3];
S.fighters({ A: A_KEYS, B: B_KEYS });

// ── weapons ──────────────────────────────────────────────────────────────────
// the pencil antenna → staff → (snapped) the half that stays in A's front hand
S.weapon('staff', [
  { t: 0, type: 'pencil', at: [540, H1 + 104], ang: 96 },
  { t: T_PENCIL, by: 'A', ang: 96, g: 0.5, two: 0 },
  { t: 1.76, by: 'A', ang: 98 },
  { t: 1.85, by: 'A', ang: 140, e: 'in' },
  { t: 1.95, by: 'A', ang: 320, type: 'staff', e: 'lin' },
  { t: 2.05, by: 'A', ang: 412, g: 0.6, two: 1, e: 'out' },
  { t: 2.14, by: 'A', ang: 362, g: 0.62, e: 'out' },
  { t: 2.36, by: 'A', ang: 360 },
  { t: 2.46, by: 'A', ang: 334, g: 0.5 },
  { t: 2.58, by: 'A', ang: 352, g: 0.3, e: 'snap' },
  { t: 2.64, by: 'A', ang: 354 },
  { t: 2.76, by: 'A', ang: 582, e: 'lin' },
  { t: 2.88, by: 'A', ang: 774, g: 0.4, e: 'snap' },
  { t: 2.94, by: 'A', ang: 780 },
  { t: 3.1, by: 'A', ang: 650, g: 0.3, e: 'in' },
  { t: 3.2, by: 'A', ang: 640, e: 'lin' },
  { t: 3.3, by: 'A', ang: 624, e: 'lin' },
  { t: 3.36, by: 'A', ang: 622 },
  { t: 3.46, by: 'A', ang: 760, g: 0.55, e: 'out' },
  { t: 3.62, by: 'A', ang: 772, g: 0.6 },
  { t: 4.16, by: 'A', ang: 772 },
  { t: 4.26, by: 'A', ang: 722, g: 0.62, e: 'out' },
  { t: 4.38, by: 'A', ang: 720 },
  { t: 4.52, by: 'A', ang: 660, g: 0.55, e: 'snap' },
  { t: 4.66, by: 'A', ang: 700 },
  { t: 4.76, by: 'A', ang: 716, g: 0.5 },
  { t: 4.84, by: 'A', ang: 720, e: 'snap' },
  { t: 4.9, by: 'A', ang: 720 },
  { t: 5.0, by: 'A', ang: 772, g: 0.6 },
  { t: 5.12, by: 'A', ang: 690, e: 'in' },
  { t: 5.24, by: 'A', ang: 740 },
  { t: 5.36, by: 'A', ang: 880, g: 0.5 },
  { t: 5.5, by: 'A', ang: 1090, e: 'snap' },
  { t: 5.56, by: 'A', ang: 1094 },
  { t: 5.7, by: 'A', ang: 1132, g: 0.6 },
  { t: 5.86, by: 'A', ang: 1082, g: 0.62, e: 'out' },
  { t: 5.94, by: 'A', ang: 1080 },
  { t: 5.96, by: 'A', ang: 1086, scale: 0.5, g: 0.24, two: 0 },          // snapped: this is now the front half
  { t: 6.03, by: 'A', ang: 1120 },
  { t: 6.12, by: 'A', ang: 1124 },
  { t: 6.24, by: 'A', ang: 1150 },
  { t: 6.34, by: 'A', ang: 1092, e: 'snap' },
  { t: 6.44, by: 'A', ang: 1160 },
  { t: 6.56, by: 'A', ang: 1086, e: 'snap' },
  { t: 6.72, by: 'A', ang: 1110 },
  { t: 6.9, at: [825, H1 + 97], ang: 1070 },
  { t: 7.08, at: [690, H1 + 5], ang: 1440, hop: 30, e: 'lin' },
  { t: 7.24, at: [655, H1 + 5], ang: 1440, hop: 14, e: 'out' },
]);
// the back half, in A's other hand until the knife knocks it away
S.weapon('stick2', [
  { t: 5.96, type: 'staff', scale: 0.5, by: 'A', hand: 'B', ang: 0, g: 0.76 },
  { t: 6.03, by: 'A', hand: 'B', ang: 30 },
  { t: 6.12, by: 'A', hand: 'B', ang: 110 },
  { t: 6.24, by: 'A', hand: 'B', ang: 40, e: 'snap' },
  { t: 6.34, by: 'A', hand: 'B', ang: 80 },
  { t: 6.44, by: 'A', hand: 'B', ang: 8, e: 'snap' },
  { t: 6.56, by: 'A', hand: 'B', ang: 100 },
  { t: 6.72, at: [760, H1 + 180], ang: 150 },
  { t: 7.12, at: [470, H1 + 620], ang: 1300, e: 'lin' },
  { t: 7.14, gone: true },
]);
S.weapon('baton', [
  { t: 0, type: 'baton', at: [965, H1 + 118], ang: 90 },
  { t: 3.74, by: 'B', ang: 90, g: 0.2 },
  { t: 3.84, by: 'B', ang: 92 },
  { t: 3.96, by: 'B', ang: 140, e: 'snap' },
  { t: 4.1, by: 'B', ang: 125 },
  { t: 4.2, by: 'B', ang: 60 },
  { t: 4.32, by: 'B', ang: 200, e: 'snap' },
  { t: 4.38, by: 'B', ang: 202 },
  { t: 4.44, by: 'B', ang: 150 },
  { t: 4.52, by: 'B', ang: 130 },
  { t: 4.6, by: 'B', ang: 30 },
  { t: 4.68, by: 'B', ang: 175, e: 'snap' },
  { t: 4.76, by: 'B', ang: 215 },
  { t: 4.84, by: 'B', ang: 150 },
  { t: 5.0, by: 'B', ang: 130 },
  { t: 5.06, by: 'B', ang: 70 },
  { t: 5.12, by: 'B', ang: 205, e: 'snap' },
  { t: 5.24, by: 'B', ang: 220 },
  { t: 5.34, by: 'B', ang: 160 },
  { t: 5.5, by: 'B', ang: 100, e: 'snap' },
  { t: 5.56, by: 'B', ang: 100 },
  { t: 5.68, by: 'B', ang: 140 },
  { t: 5.84, by: 'B', ang: 60 },
  { t: 5.95, by: 'B', ang: 200, e: 'in3' },
  { t: 6.03, by: 'B', ang: 230 },
  { t: 6.12, by: 'B', ang: 230 },
  { t: 6.22, by: 'B', ang: 170 },
  { t: 6.34, by: 'B', ang: 140 },
  { t: 6.44, by: 'B', ang: 130 },
  { t: 6.56, by: 'B', ang: 215, e: 'snap' },
  { t: 6.62, by: 'B', ang: 215 },
  { t: 6.72, by: 'B', ang: 170 },
  { t: 6.8, by: 'B', ang: 60 },
  { t: 6.9, by: 'B', ang: 205, e: 'snap' },
  { t: 6.98, by: 'B', ang: 150 },
  { t: 7.06, by: 'B', ang: 120 },
  { t: 7.3, by: 'B', ang: 125 },
  { t: 8.42, by: 'B', ang: 130 },
  { t: 9.6, by: 'B', ang: 150 },
  { t: 9.8, by: 'B', ang: 186 },
  { t: 9.88, by: 'B', ang: 190 },
  { t: 9.9, by: 'B', ang: 190, scale: 0.5 },                  // sheared: the stump
  { t: 10.04, by: 'B', ang: 150 },
  { t: 10.06, at: [832, H1 + 178], ang: 150 },
  { t: 10.3, at: [846, H1 + 5], ang: 540, hop: 16, e: 'lin' },
]);
S.weapon('batonTip', [
  { t: 9.9, type: 'baton', scale: 0.5, at: [775, H1 + 178], ang: 190 },
  { t: 10.32, at: [668, H1 + 5], ang: 1090, hop: 120, e: 'lin' },
]);
S.weapon('knife', [
  { t: 0, type: 'knife', at: [1012, H1 + 82], ang: 90 },
  { t: 3.74, by: 'B', hand: 'B', ang: 90 },
  { t: 3.84, by: 'B', hand: 'B', ang: 90 },
  { t: 3.96, by: 'B', hand: 'B', ang: 200, e: 'snap' },
  { t: 4.1, by: 'B', hand: 'B', ang: 195 },
  { t: 4.44, by: 'B', hand: 'B', ang: 170 },
  { t: 4.52, by: 'B', hand: 'B', ang: 185, e: 'snap' },
  { t: 4.6, by: 'B', hand: 'B', ang: 200 },
  { t: 5.12, by: 'B', hand: 'B', ang: 200 },
  { t: 5.24, by: 'B', hand: 'B', ang: 115, e: 'snap' },
  { t: 5.34, by: 'B', hand: 'B', ang: 150 },
  { t: 5.5, by: 'B', hand: 'B', ang: 190 },
  { t: 5.84, by: 'B', hand: 'B', ang: 80 },
  { t: 5.95, by: 'B', hand: 'B', ang: 200 },
  { t: 6.12, by: 'B', hand: 'B', ang: 190 },
  { t: 6.22, by: 'B', hand: 'B', ang: 182, e: 'snap' },
  { t: 6.34, by: 'B', hand: 'B', ang: 170 },
  { t: 6.56, by: 'B', hand: 'B', ang: 200 },
  { t: 6.72, by: 'B', hand: 'B', ang: 160, e: 'snap' },
  { t: 6.8, by: 'B', hand: 'B', ang: 160 },
  { t: 7.06, by: 'B', hand: 'B', ang: 200 },
  { t: 7.3, by: 'B', hand: 'B', ang: 195 },
  { t: 8.2, by: 'B', hand: 'B', ang: 195 },
  { t: 8.42, by: 'B', hand: 'B', ang: 60 },
  { t: 8.56, by: 'B', hand: 'B', ang: 176, e: 'snap' },
  { t: 8.58, at: [687, H1 + 155], ang: 180 },
  { t: 8.72, at: [610, H1 + 186], ang: 900, e: 'lin' },
  { t: 8.86, at: [446, H1 + 204], ang: 1240, hop: 22, e: 'lin' },
  { t: 22, at: [446, H1 + 204], ang: 1240 },
]);
S.weapon('swA', [
  { t: T_PULL, type: 'shortsword', by: 'A', ang: 120 },
  { t: 8.14, by: 'A', ang: 100, e: 'snap' },
  { t: 8.28, by: 'A', ang: 70 },
  { t: 8.42, by: 'A', ang: 50 },
  { t: 8.6, by: 'A', ang: 110 },
  { t: 8.72, by: 'A', ang: 30, e: 'snap' },
  { t: 8.78, by: 'A', ang: 28 },
  { t: 9, by: 'A', ang: 50 },
  { t: 9.2, by: 'A', ang: 100 },
  { t: 9.36, by: 'A', ang: -10, e: 'in3' },
  { t: 9.42, by: 'A', ang: -14 },
  { t: 9.52, by: 'A', ang: 20 },
  { t: 9.76, by: 'A', ang: 150 },
  { t: 9.88, by: 'A', ang: -10, e: 'snap' },
  { t: 9.94, by: 'A', ang: -14 },
  { t: 10.04, by: 'A', ang: 110 },
  { t: 10.14, by: 'A', ang: -10, e: 'snap' },
  { t: 10.3, by: 'A', ang: 50 },
  { t: 10.82, by: 'A', ang: 60 },
  { t: 10.92, by: 'A', ang: 15, e: 'snap' },
  { t: 10.98, by: 'A', ang: 15 },
  { t: 11.02, by: 'A', ang: 80 },
  { t: 11.1, by: 'A', ang: -15, e: 'snap' },
  { t: 11.18, by: 'A', ang: -10 },
  { t: 11.26, by: 'A', ang: -40 },
  { t: 11.36, by: 'A', ang: -50 },
  { t: 11.44, by: 'A', ang: 70, e: 'snap' },
  { t: 11.5, by: 'A', ang: 72 },
  { t: 11.62, by: 'A', ang: 80 },
  { t: 11.76, by: 'A', ang: 70 },
  { t: 11.88, by: 'A', ang: 55 },
  { t: 11.96, by: 'A', ang: 95, e: 'snap' },
  { t: 12.08, by: 'A', ang: 90 },
  { t: 12.14, by: 'A', ang: 120 },
  { t: 12.22, by: 'A', ang: 10, e: 'snap' },
  { t: 12.28, by: 'A', ang: -60 },
  { t: 12.34, by: 'A', ang: 60, e: 'snap' },
  { t: 12.46, by: 'A', ang: 10 },
  { t: 12.56, by: 'A', ang: 0, e: 'snap' },
  { t: 12.62, by: 'A', ang: 0 },
  { t: 12.72, by: 'A', ang: 50 },
  { t: 12.88, by: 'A', ang: 40 },
  { t: 13, by: 'A', ang: -30 },
  { t: 13.1, by: 'A', ang: 100, e: 'snap' },
  { t: 13.2, by: 'A', ang: 70 },
  { t: 13.3, by: 'A', ang: 130 },
  { t: 13.4, by: 'A', ang: 160 },
  { t: 13.5, by: 'A', ang: 165 },
  { t: 13.6, by: 'A', ang: 120 },
  { t: 13.74, by: 'A', ang: 100 },
  { t: 13.92, by: 'A', ang: 50 },
  { t: 14.2, by: 'A', ang: 60 },
  { t: 14.3, by: 'A', ang: 10 },
  { t: 14.42, by: 'A', ang: -20 },
  { t: 14.52, by: 'A', ang: 75, e: 'snap' },
  { t: 14.58, by: 'A', ang: 78 },
  { t: 14.68, by: 'A', ang: 130 },
  { t: 14.78, by: 'A', ang: 5, e: 'snap' },
  { t: 14.88, by: 'A', ang: 50 },
  { t: 14.98, by: 'A', ang: 15, e: 'snap' },
  { t: 15.04, by: 'A', ang: 15 },
  { t: 15.14, by: 'A', ang: 60 },
  { t: 15.28, by: 'A', ang: 80, e: 'in' },
  { t: 15.36, by: 'A', ang: 60 },
  { t: 15.42, by: 'A', ang: 100 },
  { t: 15.52, by: 'A', ang: 110 },
  { t: 15.62, by: 'A', ang: 230, e: 'snap' },
  { t: 15.8, by: 'A', ang: 140 },
  { t: 16, by: 'A', ang: 100 },
  { t: 16.06, by: 'A', ang: 80 },
  { t: 16.13, by: 'A', ang: 60 },
  { t: 16.2, by: 'A', ang: 210, e: 'snap' },
  { t: 16.3, by: 'A', ang: 220 },
  { t: 16.4, by: 'A', ang: 160 },
  { t: 16.5, by: 'A', ang: 100, e: 'snap' },
  { t: 16.56, by: 'A', ang: 100 },
  { t: 16.62, by: 'A', ang: 150 },
  { t: 16.7, by: 'A', ang: 180, e: 'snap' },
  { t: 16.79, by: 'A', ang: 150 },
  { t: 16.94, by: 'A', ang: 80 },
  { t: 17.1, by: 'A', ang: 100 },
  { t: 17.22, by: 'A', ang: 200, e: 'lin' },
  { t: 17.34, by: 'A', ang: 320, e: 'lin' },
  { t: 17.46, by: 'A', ang: 440, e: 'lin' },
  { t: 17.58, by: 'A', ang: 410 },
  { t: 17.7, by: 'A', ang: 410 },
  { t: 17.78, by: 'A', ang: 480 },
  { t: 17.86, by: 'A', ang: 370, e: 'snap' },
  { t: 17.92, by: 'A', ang: 368 },
  { t: 17.98, by: 'A', ang: 300 },
  { t: 18.06, by: 'A', ang: 345, e: 'snap' },
  { t: 18.12, by: 'A', ang: 345 },
  { t: 18.22, by: 'A', ang: 400 },
  { t: 18.44, by: 'A', ang: 420 },
  { t: 18.7, by: 'A', ang: 330 },
  { t: 18.92, by: 'A', ang: 380 },
  { t: 19.06, by: 'A', ang: 400 },
  { t: 19.2, by: 'A', ang: 420 },
  { t: 19.3, by: 'A', ang: 424 },
  { t: 19.52, by: 'A', ang: 450 },
  { t: 19.66, by: 'A', ang: 410 },
  { t: 19.8, by: 'A', ang: 500 },
  { t: 19.9, by: 'A', ang: 510 },
  { t: 20, by: 'A', ang: 420 },
  { t: 20.08, by: 'A', ang: 530, e: 'snap' },
  { t: 20.14, by: 'A', ang: 532 },
  { t: 20.26, by: 'A', ang: 525, e: 'snap' },
  { t: 20.32, by: 'A', ang: 525 },
  { t: 20.4, by: 'A', ang: 390 },
  { t: 20.48, by: 'A', ang: 545, e: 'snap' },
  { t: 20.54, by: 'A', ang: 545 },
  { t: 20.66, by: 'A', ang: 500 },
  { t: 20.82, by: 'A', ang: 400 },
  { t: 20.92, by: 'A', ang: 440 },
  { t: 21, by: 'A', ang: 510, e: 'snap' },
  { t: 21.08, by: 'A', ang: 510 },
  { t: 21.22, by: 'A', ang: 506 },
  { t: 21.4, by: 'A', ang: 480 },
  { t: 21.6, by: 'A', ang: 470 },
  { t: 22, by: 'A', ang: 460 },
  { t: 22.2, by: 'A', ang: 450 },
]);
S.weapon('swB', [
  { t: 0, type: 'shortsword', at: [1075, H1 + 178], ang: 0 },
  { t: T_VANE, by: 'B', ang: 0 },
  { t: 10.58, by: 'B', ang: 4 },
  { t: 10.66, by: 'B', ang: 80, e: 'snap' },
  { t: 10.76, by: 'B', ang: 140 },
  { t: 10.82, by: 'B', ang: 70 },
  { t: 10.92, by: 'B', ang: 205, e: 'snap' },
  { t: 10.98, by: 'B', ang: 207 },
  { t: 11.1, by: 'B', ang: 250, e: 'snap' },
  { t: 11.18, by: 'B', ang: 40 },
  { t: 11.28, by: 'B', ang: 185, e: 'snap' },
  { t: 11.36, by: 'B', ang: 235 },
  { t: 11.44, by: 'B', ang: 125, e: 'snap' },
  { t: 11.5, by: 'B', ang: 125 },
  { t: 11.62, by: 'B', ang: 120 },
  { t: 11.8, by: 'B', ang: 30 },
  { t: 11.96, by: 'B', ang: 190, e: 'snap' },
  { t: 12.02, by: 'B', ang: 194 },
  { t: 12.14, by: 'B', ang: 150 },
  { t: 12.22, by: 'B', ang: 110, e: 'snap' },
  { t: 12.34, by: 'B', ang: 150, e: 'snap' },
  { t: 12.42, by: 'B', ang: 160 },
  { t: 12.62, by: 'B', ang: 120 },
  { t: 13, by: 'B', ang: 170 },
  { t: 13.3, by: 'B', ang: 150 },
  { t: 13.46, by: 'B', ang: 80 },
  { t: 13.6, by: 'B', ang: 60, e: 'snap' },
  { t: 13.9, by: 'B', ang: 100 },
  { t: 14.04, by: 'B', ang: 150 },
  { t: 14.16, by: 'B', ang: 20 },
  { t: 14.3, by: 'B', ang: 180, e: 'snap' },
  { t: 14.38, by: 'B', ang: 240 },
  { t: 14.46, by: 'B', ang: 200 },
  { t: 14.52, by: 'B', ang: 130, e: 'snap' },
  { t: 14.58, by: 'B', ang: 130 },
  { t: 14.78, by: 'B', ang: 100, e: 'snap' },
  { t: 14.88, by: 'B', ang: 70 },
  { t: 14.98, by: 'B', ang: 200, e: 'snap' },
  { t: 15.04, by: 'B', ang: 202 },
  { t: 15.14, by: 'B', ang: 150 },
  { t: 15.28, by: 'B', ang: 110, e: 'snap' },
  { t: 15.36, by: 'B', ang: 110 },
  { t: 15.5, by: 'B', ang: 100 },
  { t: 15.62, by: 'B', ang: 120, e: 'snap' },
  { t: 15.76, by: 'B', ang: 150 },
  { t: 15.87, by: 'B', ang: 200 },
  { t: 16.08, by: 'B', ang: 60 },
  { t: 16.2, by: 'B', ang: 10, e: 'snap' },
  { t: 16.26, by: 'B', ang: 10 },
  { t: 16.36, by: 'B', ang: -60 },
  { t: 16.5, by: 'B', ang: 60, e: 'snap' },
  { t: 16.56, by: 'B', ang: 62 },
  { t: 16.7, by: 'B', ang: 80, e: 'snap' },
  { t: 16.76, by: 'B', ang: 80 },
  { t: 16.82, by: 'B', ang: 150 },
  { t: 16.94, by: 'B', ang: -5, e: 'snap' },
  { t: 17, by: 'B', ang: -8 },
  { t: 17.1, by: 'B', ang: -30 },
  { t: 17.22, by: 'B', ang: 80 },
  { t: 17.34, by: 'B', ang: 30 },
  { t: 17.5, by: 'B', ang: 100 },
  { t: 17.66, by: 'B', ang: 150 },
  { t: 17.86, by: 'B', ang: 110, e: 'snap' },
  { t: 17.92, by: 'B', ang: 110 },
  { t: 18.06, by: 'B', ang: 250, e: 'snap' },
  { t: 18.12, by: 'B', ang: 250 },
  { t: 18.22, by: 'B', ang: 240 },
  { t: 18.28, by: 'B', ang: 240 },
  { t: 18.46, by: 'B', ang: 150, two: 1 },
  { t: 18.72, by: 'B', ang: 60, e: 'out' },
  { t: 19, by: 'B', ang: 50 },
  { t: 19.1, by: 'B', ang: 110, e: 'in' },
  { t: T_SLAM, by: 'B', ang: 240, e: 'in3' },
  { t: 19.3, by: 'B', ang: 240 },
  { t: 19.5, by: 'B', ang: 238 },
  { t: 19.62, by: 'B', ang: 236 },
  { t: 19.74, by: 'B', ang: 100, e: 'snap', two: 0 },
  { t: 19.88, by: 'B', ang: 40 },
  { t: 20, by: 'B', ang: 30 },
  { t: 20.08, by: 'B', ang: 70, e: 'snap' },
  { t: 20.16, by: 'B', ang: 110 },
  { t: 20.26, by: 'B', ang: -20, e: 'snap' },
  { t: 20.32, by: 'B', ang: -22 },
  { t: 20.48, by: 'B', ang: 80, e: 'snap' },
  { t: 20.54, by: 'B', ang: 80 },
  { t: 20.64, by: 'B', ang: 50 },
  { t: 20.82, by: 'B', ang: 150 },
  { t: 20.92, by: 'B', ang: 110 },
  { t: 21, by: 'B', ang: 30, e: 'snap' },
  { t: 21.08, by: 'B', ang: 30 },
  { t: 21.22, by: 'B', ang: 34 },
  { t: 21.4, by: 'B', ang: 60 },
  { t: 21.6, by: 'B', ang: 80 },
  { t: 22, by: 'B', ang: 100 },
  { t: 22.2, by: 'B', ang: 110 },
]);

// ── camera ───────────────────────────────────────────────────────────────────
S.camera([
  { t: 0, x: 760, y: -790, z: 0.82, r: -3 },                        // the page turn clears on the skyline
  { t: 0.7, a: 0.5, b: 0.5, y: -690, z: 1.05, r: 0, e: 'io' },
  { t: 1.3, a: 0.5, b: 0.5, y: -655, z: 1.32, e: 'out' },
  { t: 1.6, a: 0.5, b: 0.5, y: -650, z: 1.36 },
  { t: 2.0, a: 0.6, b: 0.4, y: -662, z: 1.6, e: 'out' },            // rushes in with B's charge
  { t: 2.2, a: 0.6, b: 0.4, y: -662, z: 1.62 },
  { t: 2.26, a: 0.6, b: 0.4, y: -660, z: 1.82, e: 'snap' },         // punch-in on the block
  { t: 2.6, a: 0.5, b: 0.5, y: -650, z: 1.6 },
  { t: 2.86, a: 0.5, b: 0.5, y: -655, z: 1.62 },
  { t: 2.92, a: 0.5, b: 0.5, y: -660, z: 1.8, e: 'snap' },
  { t: 3.12, a: 0.5, b: 0.5, y: -655, z: 1.5 },
  { t: 3.5, a: 0.5, b: 0.5, y: -650, z: 1.36, e: 'out' },
  { t: 3.8, a: 0.15, b: 0.85, y: -612, z: 2.0, e: 'io' },           // B's hands find the pipe and the nib
  { t: 4.02, a: 0.15, b: 0.85, y: -625, z: 2.0 },
  { t: 4.24, a: 0.5, b: 0.5, y: -652, z: 1.58, e: 'out' },
  { t: 5.8, a: 0.5, b: 0.5, y: -655, z: 1.78, e: 'lin' },           // creeps in through the flurry
  { t: 5.94, a: 0.5, b: 0.5, y: -660, z: 1.8 },
  { t: 6.0, a: 0.5, b: 0.5, y: -660, z: 2.05, e: 'snap' },          // the staff snaps
  { t: 6.2, a: 0.5, b: 0.5, y: -652, z: 1.7 },
  { t: 7.02, a: 0.5, b: 0.5, y: -652, z: 1.78, e: 'lin' },
  { t: 7.1, a: 0.5, b: 0.5, y: -650, z: 1.5, e: 'snap' },
  { t: 7.5, a: 0.7, b: 0.3, y: -655, z: 1.25, e: 'out' },           // whips left with A
  { t: 7.9, a: 1, x: -24, y: -650, z: 2.0, e: 'io' },               // A and the drawn sword
  { t: 8.3, a: 1, x: -6, y: -662, z: 2.12 },
  { t: 8.52, a: 0.5, b: 0.5, y: -655, z: 1.38, e: 'out' },
  { t: 9.3, a: 0.6, b: 0.4, y: -655, z: 1.46 },
  { t: 9.4, a: 0.6, b: 0.4, y: -655, z: 1.64, e: 'snap' },          // the crate splits
  { t: 9.9, a: 0.5, b: 0.5, y: -655, z: 1.62 },
  { t: 10.44, a: 0.3, b: 0.7, y: -672, z: 1.72 },                   // B at the weathervane
  { t: 10.8, a: 0.5, b: 0.5, y: -655, z: 1.62 },
  { t: 12.3, a: 0.5, b: 0.5, y: -655, z: 1.74, e: 'lin' },
  { t: 12.46, a: 0.5, b: 0.5, y: -655, z: 1.6 },
  { t: 12.9, a: 0.5, b: 0.5, y: -610, z: 1.04, e: 'out' },          // wide: the leap across the gap
  { t: 13.12, a: 0.75, b: 0.25, y: -640, z: 1.28 },
  { t: 13.58, a: 0.5, b: 0.5, y: -560, z: 1.3 },                    // travels with the swing
  { t: 13.64, a: 0.5, b: 0.5, y: -550, z: 1.52, e: 'snap' },
  { t: 14.0, a: 0.5, b: 0.5, y: -520, z: 1.36 },
  { t: 14.22, x: 1500, y: -505, z: 1.62, r: 3, e: 'io' },            // pushes in on the cut
  { t: 14.3, x: 1480, y: -505, z: 1.78, r: 5, e: 'snap' },
  { t: 14.44, x: 1470, y: -520, z: 1.74, r: 5 },                     // holds while the cut gleams
  { t: 14.72, x: 1330, y: -640, z: 1.2, r: -2, e: 'io' },            // tilts up and back as the top tips over
  { t: 15.08, x: 1230, y: -560, z: 1.32, r: -5, e: 'in' },           // swings down-left with it to the crash
  { t: 15.14, x: 1225, y: -555, z: 1.42, r: -5, e: 'snap' },
  { t: 15.3, a: 0.5, b: 0.5, y: -515, z: 1.6, r: 0, e: 'out' },      // whips back to the bind
  { t: 15.44, a: 0.5, b: 0.5, y: -490, z: 1.55, r: 3 },
  { t: 15.62, a: 0.5, b: 0.5, y: -432, z: 1.7, r: 8, e: 'lin' },     // falls with them: the mid-air clang
  { t: 15.87, a: 0.4, b: 0.6, y: -210, z: 1.3, r: -4, e: 'in' },     // B hits the alley floor
  { t: 16.02, a: 0.5, b: 0.5, y: -185, z: 1.3, r: 0 },
  { t: 16.2, a: 0.5, b: 0.5, y: -150, z: 1.4 },
  { t: 16.26, a: 0.5, b: 0.5, y: -150, z: 1.62, e: 'snap' },
  { t: 16.6, a: 0.5, b: 0.5, y: -150, z: 1.42 },
  { t: 17.0, x: 1990, y: -175, z: 1.42, r: 3 },
  { t: 17.34, x: 1970, y: -215, z: 1.32, r: -2 },
  { t: 17.72, a: 0.5, b: 0.5, y: -150, z: 1.46, r: 0 },
  { t: 18.2, a: 0.5, b: 0.5, y: -150, z: 1.56 },
  { t: 18.5, a: 0.5, b: 0.5, y: -160, z: 1.5 },
  { t: 19.02, a: 0.5, b: 0.5, y: -180, z: 1.76, r: -4, e: 'lin' },   // slow push on the wind-up
  { t: 19.18, a: 0.5, b: 0.5, y: -175, z: 1.8, r: -4 },
  { t: 19.27, x: 1930, y: -150, z: 1.28, r: 0, e: 'snap' },         // snaps wide as the floor cracks
  { t: 19.9, x: 1960, y: -140, z: 1.4 },
  { t: 20.94, x: 1985, y: -145, z: 1.6, e: 'lin' },
  { t: 21.04, x: 1990, y: -145, z: 1.8, e: 'snap' },
  { t: 21.3, x: 1985, y: -130, z: 1.5 },
  { t: 21.55, x: 1982, y: -110, z: 1.42, r: 2, e: 'io' },
  { t: 22, x: 1980, y: -20, z: 1.5, r: 5, e: 'out' },               // they drop through the page
]);
// ── contacts, effects and sound ──────────────────────────────────────────────
const hit = (t, x, h, size, sound, weight, o = {}) => S.hit({ t, x, h, size, sound, weight, ...o });
const wh = (t, x, size = 'm', o = {}) => S.whoosh({ t, x, size, ...o });
const cue = (t, type, x, o = {}) => S.cue({ t, type, x, ...o });

// 0:00: out of the sky
cue(0.02, 'whoosh', 500, { size: 'l', dur: 0.5 });
cue(0.1, 'crumble', 600, { dur: 1.0, gain: 0.7 });
S.land({ t: 0.56, x: 575, h: H1, weight: 0.5 });
S.skid({ t0: 0.56, t1: 0.74, x0: 575, x1: 606, y: -H1 });
S.land({ t: 0.66, x: 884, h: H1, weight: 0.95 });
S.fx({ t: 0.66, type: 'ring', x: 884, h: H1, size: 0.8 });
S.skid({ t0: 0.74, t1: 0.94, x0: 890, x1: 944, y: -H1 });
for (const [t, x] of [[0.62, 470], [0.8, 700], [0.98, 330]]) cue(t, 'thud', x, { weight: 0.25 });
wh(1.34, 930, 's');
S.land({ t: 1.46, x: 930, h: H1, weight: 0.9 });
cue(1.48, 'riser', 760, { dur: 0.4 });
// the pencil
S.step({ t: 1.68, x: 900, h: H1, weight: 0.7 }); S.step({ t: 1.8, x: 830, h: H1, weight: 0.8 }); S.step({ t: 1.9, x: 770, h: H1, weight: 0.9 });
cue(1.66, 'scribble', 541, { dur: 0.12 });
cue(1.84, 'pop', 541);
S.fx({ t: 1.84, type: 'burst', x: 541, h: H1 + 8, size: 0.6 });
wh(1.87, 560); wh(1.97, 590); wh(1.93, 750, 'l');
hit(2.2, 630, H1 + 166, 1.4, 'clack', 1, { ring: true, ringH: H1 });
S.land({ t: 2.24, x: 722, h: H1, weight: 0.7 });
S.skid({ t0: 2.26, t1: 2.36, x0: 594, x1: 574, y: -H1 });
wh(2.5, 620);
hit(2.58, 726, H1 + 40, 0.8, 'clack', 0.6); cue(2.58, 'hit', 726, { weight: 0.5 });
wh(2.7, 600); wh(2.82, 640, 'l');
hit(2.88, 782, H1 + 176, 1.25, 'clack', 0.8); cue(2.88, 'hit', 782, { weight: 0.8 });
S.skid({ t0: 2.94, t1: 3.1, x0: 790, x1: 830, y: -H1 });
S.step({ t: 3.02, x: 640, h: H1, weight: 0.4 });
hit(3.1, 745, H1 + 3, 0.6, 'clack', 0.5);
wh(3.14, 720, 'l');
hit(3.3, 846, H1 + 148, 1.5, 'hit', 1);
wh(3.36, 900, 'l');
S.land({ t: 3.46, x: 800, h: H1, weight: 0.4 });
hit(T_VENT, 968, H1 + 48, 1.3, 'slam', 0.7, { sparks: true }); cue(T_VENT + 0.03, 'crumble', 968, { dur: 0.4, gain: 0.6 });
S.fx({ t: T_VENT, type: 'dust', x: 968, h: H1, n: 6, size: 0.9 });
// pipe and nib
cue(3.9, 'snap', 965); cue(3.92, 'pop', 965); cue(3.96, 'shing', 1010, { dur: 0.3 });
S.fx({ t: 3.92, type: 'burst', x: 968, h: H1 + 76, size: 0.6 }); S.fx({ t: 3.92, type: 'sparks', x: 1010, h: H1 + 56, size: 0.6, n: 7 });
wh(3.94, 960); cue(4.08, 'boom', 954, { gain: 0.5 });
// staff against baton and knife
wh(4.24, 930); hit(4.32, 827, H1 + 166, 1, 'clack', 0.9);
wh(4.47, 900, 's'); hit(4.52, 814, H1 + 105, 0.6, 'clack', 0.5);
wh(4.62, 900, 'l');
wh(4.78, 830, 's'); hit(4.84, 1005, H1 + 105, 1, 'hit', 0.7);
S.skid({ t0: 4.9, t1: 5.0, x0: 982, x1: 1000, y: -H1 });
wh(5.06, 930); hit(5.12, 815, H1 + 100, 0.9, 'clack', 0.8);
wh(5.2, 880, 's'); cue(5.24, 'slice', 820, { weight: 0.4 });
wh(5.4, 800); hit(5.5, 912, H1 + 148, 1, 'clack', 0.8);
wh(5.76, 950, 'l'); wh(5.9, 900, 'l');
hit(T_SNAP, 806, H1 + 165, 1.8, 'clack', 1, { impact: 0.07, ring: true, ringH: H1 }); cue(T_SNAP, 'snap', 806);
S.fx({ t: T_SNAP, type: 'scraps', x: 806, h: H1 + 165, n: 7 });
// two halves
wh(6.2, 900, 's'); hit(6.24, 848, H1 + 152, 0.6, 'clack', 0.5);
wh(6.3, 850, 's'); hit(6.34, 978, H1 + 182, 0.8, 'hit', 0.5); cue(6.34, 'clack', 978, { weight: 0.5 });
hit(6.44, 938, H1 + 126, 0.8, 'hit', 0.5); cue(6.44, 'clack', 938, { weight: 0.4 });
wh(6.5, 860, 's'); hit(6.56, 884, H1 + 182, 0.8, 'clack', 0.7);
wh(6.67, 900, 's'); hit(6.72, 790, H1 + 168, 0.7, 'clack', 0.6); wh(6.75, 740);
wh(6.84, 900); hit(6.9, 800, H1 + 112, 0.9, 'clack', 0.8); cue(7.08, 'clack', 700, { weight: 0.3 });
wh(7.0, 880);
hit(7.06, 782, H1 + 88, 1.7, 'hit', 1, { impact: 0.07 });
wh(7.12, 700, 'l');
S.land({ t: 7.46, x: 520, h: H1, weight: 0.6 });
S.skid({ t0: 7.46, t1: 7.62, x0: 520, x1: 480, y: -H1 });
cue(7.62, 'thud', 450, { weight: 0.5 });
S.step({ t: 7.46, x: 880, h: H1, weight: 0.6 }); S.step({ t: 7.76, x: 860, h: H1, weight: 0.6 });
// the sword comes out of the drawing
cue(7.9, 'scribble', 434, { dur: 0.14 });
cue(T_PULL, 'draw', 434, { dur: 0.22 });
cue(8.12, 'shing', 440, { dur: 0.5 });
S.fx({ t: 8.1, type: 'burst', x: 428, h: H1 + 150, size: 0.55 });
wh(8.24, 480, 's');
// knife, crate
wh(8.5, 800); cue(8.56, 'slice', 700, { weight: 0.5 });
hit(8.72, 606, H1 + 186, 0.8, 'clang', 0.6); wh(8.74, 540, 's');
hit(T_KNIFE, 446, H1 + 204, 0.5, 'clack', 0.5, { sparks: false });
wh(9.06, 830);
hit(T_KICK, 760, H1 + 28, 0.9, 'clack', 0.8, { sparks: false }); wh(9.18, 720);
wh(9.28, 520);
hit(T_SPLIT, 640, H1 + 108, 1.2, 'clack', 0.9); cue(T_SPLIT, 'slice', 640, { weight: 0.8 }); cue(T_SPLIT + 0.02, 'snap', 640);
S.fx({ t: T_SPLIT, type: 'scraps', x: 640, h: H1 + 108, n: 6 });
cue(9.62, 'thud', 560, { weight: 0.3 }); cue(10.0, 'thud', 340, { weight: 0.3 });
// the baton is sheared; B takes the sword off the weathervane
wh(9.52, 540, 'l'); S.step({ t: 9.64, x: 620, h: H1, weight: 0.4 }); S.step({ t: 9.76, x: 690, h: H1, weight: 0.4 });
wh(9.83, 740);
hit(9.88, 805, H1 + 178, 1, 'clang', 0.7); cue(9.88, 'slice', 805, { weight: 0.7 });
wh(10.1, 780); wh(10.14, 900, 'l');
cue(10.3, 'clack', 846, { weight: 0.3 }); cue(10.34, 'clack', 668, { weight: 0.3 });
S.land({ t: 10.4, x: 1092, h: H1, weight: 0.7 });
cue(10.56, 'crack', 1060, { dur: 0.15 }); cue(10.66, 'shing', 1050, { dur: 0.5 });
S.fx({ t: 10.66, type: 'sparks', x: 1060, h: H1 + 176, size: 0.8, n: 9 });
wh(10.66, 1080);
// sword on sword
wh(10.86, 1060); hit(10.92, 940, H1 + 172, 1, 'clang', 0.8);
wh(11.05, 900, 's'); hit(11.1, 1012, H1 + 80, 0.8, 'clang', 0.6);
wh(11.22, 1050, 'l');
wh(11.38, 900); hit(11.44, 1030, H1 + 240, 1, 'clang', 0.8);
hit(11.62, 942, H1 + 160, 0.9, 'clang', 0.6, { shock: true });
S.skid({ t0: 11.62, t1: 11.76, x0: 900, x1: 850, y: -H1 });
wh(11.86, 1040, 'l'); hit(11.96, 876, H1 + 180, 1.3, 'clang', 1);
S.skid({ t0: 12.02, t1: 12.08, x0: 830, x1: 808, y: -H1 });
wh(12.16, 850, 's'); hit(12.22, 1028, H1 + 170, 0.8, 'clang', 0.7);
wh(12.3, 900, 's'); hit(12.34, 1022, H1 + 190, 0.8, 'clang', 0.7);
wh(12.5, 980);
// the gap, the clothesline
cue(12.46, 'whoosh', 1200, { size: 'l', dur: 0.5 });
S.land({ t: 13.0, x: 1520, h: H2, weight: 0.9 });
wh(13.04, 1130, 's');
cue(T_ROPE_CUT, 'slice', 1140, { weight: 0.7 }); cue(T_ROPE_CUT + 0.02, 'pop', 1140);
S.fx({ t: T_ROPE_CUT, type: 'sparks', x: 1142, h: H1 + 200, size: 0.6, n: 6 });
cue(13.2, 'whoosh', 1250, { size: 'l', dur: 0.45 });
hit(13.6, 1532, H2 + 112, 1.8, 'hit', 1, { impact: 0.07 });
S.skid({ t0: 13.68, t1: 13.9, x0: 1540, x1: 1672, y: -H2 });
S.land({ t: 13.92, x: 1440, h: H2, weight: 0.4 });
// the pencil tower
wh(14.2, 1600, 'l');
cue(T_TOWER, 'slice', 1405, { weight: 1 }); cue(T_TOWER + 0.02, 'shing', 1405, { dur: 0.4 });
S.fx({ t: T_TOWER, type: 'sparks', x: 1410, h: H2 + 148, size: 1, n: 12 });
S.shake(T_TOWER, 9, 0.2);
cue(14.46, 'crack', 1405, { dur: 0.3 }); cue(14.5, 'skid', 1405, { dur: 0.25 });
cue(14.68, 'whoosh', 1250, { size: 'l', dur: 0.42 });
S.hit({ t: T_CRASH, x: 1010, h: H1 + 34, size: 2.2, sound: 'slam', weight: 1, ring: true, ringH: H1, sparks: false });
cue(T_CRASH, 'wallbreak', 1000, { size: 0.8 }); cue(T_CRASH + 0.04, 'crumble', 1000, { dur: 0.7 });
for (const x of [860, 1000, 1120]) S.fx({ t: T_CRASH, type: 'dust', x, h: H1, n: 7, size: 1.2 });
S.fx({ t: T_CRASH, type: 'scraps', x: 1000, h: H1 + 40, n: 9 });
wh(14.46, 1500); hit(14.52, 1576, H2 + 262, 1, 'clang', 0.8);
wh(14.72, 1500); hit(14.78, 1668, H2 + 150, 0.9, 'clang', 0.7);
wh(14.92, 1660); hit(14.98, 1545, H2 + 185, 1, 'clang', 0.8);
wh(15.2, 1560, 'l'); hit(15.28, 1705, H2 + 220, 1.2, 'clang', 0.9, { shock: true });
// into the alley
cue(15.4, 'whoosh', 1800, { size: 'l', dur: 0.5 });
hit(15.62, 1823, 478, 1.1, 'clang', 0.8, { shock: true });
S.land({ t: 15.87, x: 1880, h: 0, weight: 0.9 });
cue(16.0, 'step', 2130, { weight: 0.6 }); S.fx({ t: 16.0, type: 'burst', x: 2136, h: 214, size: 0.5 });
wh(16.08, 2080, 'l');
hit(16.2, 1930, 212, 1.8, 'clang', 1, { impact: 0.07, ring: true, shock: true });
S.skid({ t0: 16.26, t1: 16.36, x0: 1886, x1: 1836 });
S.land({ t: 16.3, x: 2030, h: 0, weight: 0.4 });
wh(16.44, 1860); hit(16.5, 2008, 240, 0.9, 'clang', 0.7);
wh(16.66, 2040, 's'); hit(16.7, 1876, 140, 0.8, 'clang', 0.6);
wh(16.86, 1900, 'l'); hit(16.94, 2138, 134, 1.1, 'clang', 0.8);
cue(16.95, 'step', 2130, { weight: 0.4 }); cue(17.1, 'step', 2130, { weight: 0.4 });
cue(17.12, 'whoosh', 2050, { size: 'l', dur: 0.4 }); wh(17.2, 1910);
S.land({ t: 17.58, x: 1830, h: 0, weight: 0.4 });
wh(17.8, 1820); hit(17.86, 2004, 170, 1, 'clang', 0.8);
wh(18.0, 1830, 's'); hit(18.06, 1970, 73, 0.9, 'clang', 0.7);
wh(18.16, 1960); hit(18.22, 1850, 180, 1.3, 'hit', 0.9);
cue(18.44, 'thud', 1766, { weight: 0.6 }); S.fx({ t: 18.44, type: 'dust', x: 1772, h: 110, n: 5, size: 0.8, dir: 1 });
// the blow that splits the floor
cue(18.5, 'riser', 1960, { dur: 0.66 });
S.whoosh({ t: 18.6, x: 1970, size: 'm', heavy: true }); S.whoosh({ t: 19.06, x: 1900, size: 'l', heavy: true, dur: 0.16 });
wh(19.06, 1810);
hit(T_SLAM, 1792, 4, 2.4, 'slam', 1, { impact: 0.1, ring: true });
cue(T_SLAM, 'megaimpact', 1800); cue(T_SLAM + 0.04, 'crack', 1880, { dur: 0.6 });
S.fx({ t: T_SLAM, type: 'scraps', x: 1800, h: 4, n: 12 }); S.fx({ t: T_SLAM, type: 'dust', x: 1810, h: 0, n: 10, size: 1.3 });
cue(19.2, 'step', 1766, { weight: 0.5 }); S.fx({ t: 19.24, type: 'dust', x: 1768, h: 240, n: 3, size: 0.6, dir: 1 });
wh(19.32, 1860);
S.land({ t: 19.66, x: 2090, h: 0, weight: 0.4 });
cue(19.5, 'crack', 1800, { dur: 0.3, gain: 0.6 });
cue(19.74, 'crumble', 1795, { dur: 0.4 }); wh(19.74, 1850);
S.fx({ t: 19.74, type: 'burst', x: 1795, h: 8, size: 0.8 }); S.fx({ t: 19.74, type: 'scraps', x: 1795, h: 6, n: 6 });
cue(19.9, 'rumble', 1950, { dur: 1.4, gain: 0.6 });
wh(20.02, 2060); hit(20.08, 1868, 178, 1, 'clang', 0.8);
S.whoosh({ t: 20.2, x: 1880, size: 'm' }); hit(20.26, 1975, 196, 1.1, 'clang', 0.9); cue(20.28, 'crack', 1960, { dur: 0.2, gain: 0.7 });
S.fx({ t: 20.26, type: 'dust', x: 1960, h: 0, n: 5, size: 0.8 });
wh(20.42, 2040); hit(20.48, 1878, 150, 1, 'clang', 0.8);
cue(20.64, 'block', 1990, { weight: 0.6 });
S.skid({ t0: 20.56, t1: 20.66, x0: 2076, x1: 2106 });
cue(20.76, 'riser', 1960, { dur: 0.24 }); wh(20.9, 1960, 'l');
hit(21.0, 1992, 172, 2, 'clang', 1, { impact: 0.07, shock: true, ring: true });
cue(21.1, 'crack', 1950, { dur: 0.25 });
cue(T_BREAK, 'wallbreak', 1950, { size: 1 }); cue(T_BREAK + 0.02, 'tear', 1950, { dur: 0.6 }); cue(T_BREAK + 0.05, 'crumble', 1950, { dur: 0.6 });
S.shake(T_BREAK, 26, 0.6);
S.fx({ t: T_BREAK, type: 'scraps', x: 1950, h: 4, n: 14 }); S.fx({ t: T_BREAK, type: 'dust', x: 1950, h: 0, n: 12, size: 1.4 });
cue(21.36, 'whoosh', 1960, { size: 'l', dur: 0.6 });
S.musicHint(18.5, 19.2, 'suspend');
S.musicHint(10.8, 12.4, 'surge');

/*@@END@@*/

// ═════════════════════════════ ENVIRONMENT ═════════════════════════════════
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const seen = (vb, x0, y0, x1, y1) => !(x1 < vb.x0 || x0 > vb.x1 || y1 < vb.y0 || y0 > vb.y1);

/** Hatch a big rectangle in fixed tiles, so the pattern never depends on the camera. */
function tiles(ctx, vb, x0, y0, x1, y1, ho, seed, T = 300) {
  for (let x = x0; x < x1; x += T) for (let y = y0; y < y1; y += T) {
    const xe = Math.min(x + T, x1), ye = Math.min(y + T, y1);
    if (!seen(vb, x, y, xe, ye)) continue;
    hatch(ctx, rect(x, y, xe, ye), { w: 1.1, ...ho, seed: seed + Math.round(x * 0.37 + y * 0.11) });
  }
}

function pencilTower(ctx, x, w, top, bot, seed, lw = 2, shade = 7) {
  const ch = w * 1.45, yb = top + ch;
  sketchPoly(ctx, rect(x, yb, x + w, bot), { w: lw, seed, fill: WHITE, over: 2 });
  line(ctx, x + w * 0.34, yb + 8, x + w * 0.34, bot, { w: lw * 0.5, seed: seed + 1 });
  line(ctx, x + w * 0.68, yb + 8, x + w * 0.68, bot, { w: lw * 0.5, seed: seed + 2 });
  if (shade) for (let y = yb; y < bot; y += 300) hatch(ctx, rect(x + w * 0.68, y, x + w, Math.min(bot, y + 300)), { angle: 62, gap: shade, w: lw * 0.5, seed: seed + 3 + y });
  sketchPoly(ctx, [[x, yb], [x + w / 2, top], [x + w, yb]], { w: lw, seed: seed + 4, fill: WHITE });
  ctx.beginPath(); ctx.moveTo(x, yb);
  for (let i = 0; i < 3; i++) ctx.quadraticCurveTo(x + (i + 0.5) * w / 3, yb + w * 0.24, x + (i + 1) * w / 3, yb);
  ctx.lineWidth = lw * 0.8; ctx.strokeStyle = BLACK; ctx.stroke();
  ctx.fillStyle = BLACK; ctx.beginPath();
  ctx.moveTo(x + w * 0.36, top + ch * 0.28); ctx.lineTo(x + w / 2, top); ctx.lineTo(x + w * 0.64, top + ch * 0.28); ctx.closePath(); ctx.fill();
  if (shade) hatch(ctx, [[x + w / 2, top], [x + w, yb], [x + w * 0.62, yb]], { angle: 70, gap: shade * 0.8, w: lw * 0.45, seed: seed + 5 });
}

function markerTower(ctx, x, w, top, bot, seed, lw = 2, shade = 8) {
  const cap = w * 0.9;
  sketchPoly(ctx, rect(x, top + cap, x + w, bot), { w: lw, seed, fill: WHITE, over: 2 });
  sketchPoly(ctx, [[x + w * 0.2, top + cap], [x + w * 0.2, top + w * 0.3], [x + w * 0.38, top], [x + w * 0.62, top], [x + w * 0.8, top + w * 0.3], [x + w * 0.8, top + cap]], { w: lw, seed: seed + 1, fill: WHITE });
  line(ctx, x, top + cap + w * 0.5, x + w, top + cap + w * 0.5, { w: lw * 0.6, seed: seed + 2 });
  line(ctx, x, top + cap + w * 0.62, x + w, top + cap + w * 0.62, { w: lw * 0.6, seed: seed + 3 });
  if (shade) {
    for (let y = top + cap; y < bot; y += 300) hatch(ctx, rect(x + w * 0.6, y, x + w, Math.min(bot, y + 300)), { angle: 58, gap: shade, w: lw * 0.5, seed: seed + 4 + y });
    hatch(ctx, rect(x + w * 0.2, top + w * 0.3, x + w * 0.8, top + cap), { angle: 90, gap: shade * 0.6, w: lw * 0.5, seed: seed + 6 });
  }
}

function blockTower(ctx, x, w, top, bot, seed, lw = 2, shade = 12) {
  sketchPoly(ctx, rect(x, top, x + w, bot), { w: lw, seed, fill: WHITE, over: 3 });
  line(ctx, x, top + 14, x + w, top + 14, { w: lw * 0.6, seed: seed + 1 });
  if (!shade) return;
  const r = rng(seed);
  for (let y = top + 40; y < Math.min(bot, top + 420); y += 62) for (let wx = x + 18; wx < x + w - 30; wx += 44) {
    if (r() < 0.35) continue;
    const q = rect(wx, y, wx + 22, y + 32);
    sketchPoly(ctx, q, { w: lw * 0.6, seed: seed + wx + y });
    if (r() < 0.6) hatch(ctx, q, { angle: 50, gap: 5, w: lw * 0.45, seed: seed + wx });
  }
  for (let y = top; y < bot; y += 300) hatch(ctx, rect(x + w * 0.78, y, x + w, Math.min(bot, y + 300)), { angle: 60, gap: shade, w: lw * 0.45, seed: seed + 9 + y });
}
const TOWER = { p: pencilTower, m: markerTower, b: blockTower };

// distant skyline (parallax 0.72): outlines only
const SKY2 = [];
{
  const r = rng(2202);
  for (let x = -700; x < 3300; ) {
    const k = r() < 0.4 ? 'p' : r() < 0.5 ? 'm' : 'b';
    const w = k === 'b' ? 110 + r() * 150 : 44 + r() * 50;
    SKY2.push({ k, x, w, top: -(k === 'b' ? 470 + r() * 190 : 600 + r() * 380), seed: 2300 + SKY2.length * 17 });
    x += w + 16 + r() * 90;
  }
}
// mid skyline (parallax 0.86): kept low behind the rooftops where the fight happens
const SKY1 = [
  { k: 'p', x: -520, w: 96, top: -930 }, { k: 'm', x: -380, w: 120, top: -720 }, { k: 'p', x: 150, w: 72, top: -860 },
  { k: 'b', x: 400, w: 230, top: -590 }, { k: 'b', x: 690, w: 190, top: -566 }, { k: 'p', x: 930, w: 44, top: -745 },
  { k: 'm', x: 1196, w: 104, top: -800 }, { k: 'b', x: 1500, w: 250, top: -452 }, { k: 'b', x: 1850, w: 330, top: -610 },
  { k: 'p', x: 2330, w: 120, top: -1230 }, { k: 'm', x: 2560, w: 140, top: -1060 }, { k: 'p', x: 2800, w: 90, top: -1150 },
].map((o, i) => ({ ...o, seed: 2500 + i * 31 }));

// windows of the tall block on the right
const WIN_R = [];
{
  const r = rng(77);
  for (let y = -760; y < -60; y += 96) for (let x = 2210; x < 2900; x += 104) if (r() > 0.25) WIN_R.push([x, y, r() < 0.3]);
}

// bricks from scene 1's wall raining down with the fighters
const rain = makeDebris([
  { t: 0.0, x: 380, y: -1250, w: 52, h: 24, vx: 240, vy: 500, floor: -H1 },
  { t: 0.0, x: 520, y: -1420, w: 46, h: 22, vx: 300, vy: 420, floor: -H1 },
  { t: 0.05, x: 700, y: -1500, w: 54, h: 24, vx: 260, vy: 520, floor: -H1 },
  { t: 0.1, x: 880, y: -1560, w: 44, h: 22, vx: 330, vy: 380, floor: 900 },
  { t: 0.15, x: 240, y: -1500, w: 50, h: 24, vx: 150, vy: 300, floor: -H1 },
  { t: 0.2, x: 1010, y: -1600, w: 48, h: 22, vx: 420, vy: 300, floor: 900 },
  { t: 0.3, x: 600, y: -1650, w: 40, h: 20, vx: 380, vy: 200, floor: -H1 },
  { t: 0.42, x: 300, y: -1700, w: 46, h: 22, vx: 200, vy: 260, floor: -H1 },
], 4100);

// the crate: kicked at T_KICK, split at T_SPLIT
const CRATE0 = [730, -H1 - 29], CRATE1 = [640, -H1 - 108];
const crateHalves = makeDebris([
  { t: T_SPLIT, x: CRATE1[0], y: CRATE1[1] - 16, w: 58, h: 30, vx: -460, vy: -620, om: -9, floor: -H1, pts: [[-29, -15], [29, -15], [29, 15], [-29, 4]] },
  { t: T_SPLIT, x: CRATE1[0], y: CRATE1[1] + 14, w: 58, h: 30, vx: -300, vy: 60, om: 7, floor: -H1, pts: [[-29, -4], [29, -15], [29, 15], [-29, 15]] },
], 4300);

function drawCrate(ctx, x, y, rot, seed = 610) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  sketchPoly(ctx, rect(-29, -29, 29, 29), { w: 2.4, seed, fill: WHITE, over: 3 });
  sketchPoly(ctx, rect(-22, -22, 22, 22), { w: 1.4, seed: seed + 1 });
  line(ctx, -22, -22, 22, 22, { w: 1.6, seed: seed + 2 }); line(ctx, -22, 22, 22, -22, { w: 1.6, seed: seed + 3 });
  hatch(ctx, rect(-29, 12, 29, 29), { angle: 40, gap: 6, w: 1, seed: seed + 4 });
  ctx.restore();
}

// ── billboard with the drawn sword ──
const BB = { x0: 316, x1: 470, y0: -H1 - 262, y1: -H1 - 72 };
const SW_POM = [440, -H1 - 106], SW_ANG = 120;                 // pommel + direction of the drawn sword
function swordOutline(ctx, px, py, angDeg, L, w, dashed) {
  ctx.save(); ctx.translate(px, py); ctx.rotate(-angDeg * DEG);
  const o = [[0, -3], [24, -3], [24, -15], [29, -15], [29, -6], [L - 16, -6], [L, 0], [L - 16, 6], [29, 6], [29, 15], [24, 15], [24, 3], [0, 3]];
  if (dashed) ctx.setLineDash([7, 8]);
  sketchPoly(ctx, o, { w, seed: 640, rough: dashed ? 0.3 : 0.9, fill: dashed ? null : WHITE });
  ctx.setLineDash([]);
  if (!dashed) line(ctx, 36, 0, L - 22, 0, { w: 1, seed: 641 });
  ctx.restore();
}
function drawBillboard(ctx, t) {
  line(ctx, 344, -H1, 344, BB.y1, { w: 3, seed: 620 }); line(ctx, 442, -H1, 442, BB.y1, { w: 3, seed: 621 });
  line(ctx, 344, -H1 - 4, 442, BB.y1 + 2, { w: 1.4, seed: 622 });
  sketchPoly(ctx, rect(BB.x0, BB.y0, BB.x1, BB.y1), { w: 3, seed: 623, fill: WHITE, over: 4 });
  sketchPoly(ctx, rect(BB.x0 + 9, BB.y0 + 9, BB.x1 - 9, BB.y1 - 9), { w: 1.3, seed: 624 });
  hatch(ctx, rect(BB.x0, BB.y1 - 9, BB.x1, BB.y1), { angle: 60, gap: 4, w: 1, seed: 625 });
  if (t < T_PULL) {
    swordOutline(ctx, SW_POM[0], SW_POM[1], SW_ANG, 118, 2.2, false);
    for (const [a, d] of [[20, 26], [70, 30], [150, 24], [200, 28]]) {             // little "shine" ticks
      const c = [SW_POM[0] - 30, SW_POM[1] - 56];
      line(ctx, c[0] + Math.cos(a * DEG) * 44, c[1] - Math.sin(a * DEG) * 44, c[0] + Math.cos(a * DEG) * (44 + d * 0.5), c[1] - Math.sin(a * DEG) * (44 + d * 0.5), { w: 1.3, seed: 630 + a });
    }
  } else {
    swordOutline(ctx, SW_POM[0], SW_POM[1], SW_ANG, 118, 1.2, true);            // the empty outline it left behind
    const p = prog(t, T_PULL, T_PULL + 0.3);
    if (p < 1) for (let i = 0; i < 6; i++) {                                     // pen strokes peeling off
      const a = (100 + i * 14) * DEG, r0 = 30 + i * 12 + p * 60;
      line(ctx, 412 + Math.cos(a) * r0, -H1 - 150 - Math.sin(a) * r0, 412 + Math.cos(a) * (r0 + 22), -H1 - 150 - Math.sin(a) * (r0 + 22), { w: 1.6, seed: 650 + i });
    }
  }
}

// ── the clothesline: pole on roof 1 → the pencil tower ──
const AN = [1405, -940], POLE = [1140, -700], ROPE_L = 348;
function ropePts(t, st) {
  if (t < T_ROPE_CUT) {
    const pts = [];
    for (let i = 0; i <= 14; i++) { const k = i / 14; pts.push([lerp(POLE[0], AN[0], k), lerp(POLE[1], AN[1], k) + 70 * 4 * k * (1 - k)]); }
    return pts;
  }
  if (t < T_REL) { const h = st.A.hB; return [[h[0] - 8, -h[1] + 22], [h[0], -h[1]], AN]; }
  const tau = t - T_REL, th = 22 * Math.cos(tau * 5.4) * Math.exp(-tau * 1.2) * DEG;
  const pts = [];
  for (let i = 0; i <= 8; i++) { const k = 1 - i / 8, b = th * (1 + 0.25 * k * Math.sin(tau * 9)); pts.push([AN[0] + Math.sin(b) * ROPE_L * k, AN[1] + Math.cos(b) * ROPE_L * k]); }
  return pts;
}
function drawRope(ctx, t, st) {
  const pts = ropePts(t, st);
  stroke(ctx, pts, 5.5, WHITE); stroke(ctx, pts, 2.2);
  // laundry: sheets of paper pegged to the line
  const n = pts.length - 1;
  [0.34, 0.52, 0.7, 0.86].forEach((k, i) => {
    const f = k * n, j = Math.min(n - 1, Math.floor(f)), u = f - j;
    const x = lerp(pts[j][0], pts[j + 1][0], u), y = lerp(pts[j][1], pts[j + 1][1], u);
    const sw = Math.sin(t * 3 + i * 2) * 3 + (t >= T_ROPE_CUT ? Math.sin(t * 14 + i) * 7 : 0);
    const q = [[x - 15, y + 2], [x + 15, y + 2], [x + 15 + sw, y + 44], [x - 15 + sw, y + 44]];
    sketchPoly(ctx, q, { w: 1.6, seed: 700 + i, fill: WHITE });
    hatch(ctx, q, { angle: 0, gap: 8, w: 0.9, seed: 710 + i, skip: 0.2 });
  });
}

// ── the pencil tower B cuts through ──
const TW = { x: 1370, w: 70, top: -1060, cutL: -H2 - 142, cutR: -H2 - 176 };
function towerTop(t) {
  const tau = t - T_TOWER - 0.14;
  if (tau <= 0) return { dx: 0, dy: 0, rot: 0 };
  const s = EASE.io(clamp(tau / 0.2)), k = clamp((tau - 0.06) / 0.6);
  let rot = -90 * Math.pow(k, 2.6);
  if (k >= 1) { const tb = tau - 0.66; rot = -90 + 5 * Math.abs(Math.sin(tb * 18)) * Math.exp(-tb * 7); }
  return { dx: -14 * s, dy: 7 * s, rot: rot * DEG };
}
const towerCutPoly = (up) => [[TW.x - 40, TW.cutL + 17], [TW.x + TW.w + 40, TW.cutR - 17], [TW.x + TW.w + 40, up ? -1700 : 200], [TW.x - 40, up ? -1700 : 200]];
function towerPart(ctx, up) {
  ctx.save();
  ctx.beginPath(); towerCutPoly(up).forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.clip();
  pencilTower(ctx, TW.x, TW.w, TW.top, 40, 800, 2.6, 6);
  line(ctx, TW.x, -960, TW.x + TW.w, -960, { w: 2, seed: 811 }); line(ctx, TW.x, -948, TW.x + TW.w, -948, { w: 2, seed: 812 });
  for (let y = -900; y < 0; y += 110) sketchPoly(ctx, rect(TW.x + 9, y, TW.x + 23, y + 34), { w: 1.3, seed: 820 + y });
  ctx.restore();
}
/** The standing tower (whole until the cut, then only the stump). */
function drawTower(ctx, t, st) {
  if (t < T_TOWER) { towerPart(ctx, true); towerPart(ctx, false); drawRope(ctx, t, st); return; }
  towerPart(ctx, false);
  line(ctx, TW.x - 3, TW.cutL, TW.x + TW.w + 3, TW.cutR, { w: 2.6, seed: 813 });
}
/** The severed top: slides on the cut, topples left about its lower corner and comes to rest across the gap on roof 1. */
function drawTowerTop(ctx, t, st) {
  if (t < T_TOWER) return;
  const m = towerTop(t);
  ctx.save();
  ctx.translate(TW.x + m.dx, TW.cutL + m.dy); ctx.rotate(m.rot); ctx.translate(-TW.x, -TW.cutL);
  towerPart(ctx, true);
  line(ctx, TW.x - 3, TW.cutL, TW.x + TW.w + 3, TW.cutR, { w: 2.6, seed: 814 });
  if (t < T_CRASH) drawRope(ctx, t, st);
  ctx.restore();
  if (t < T_TOWER + 0.16) {                                   // the cut gleams for a beat before anything moves
    const a = [TW.x - 46, TW.cutL + 22], b = [TW.x + TW.w + 46, TW.cutR - 22];
    stroke(ctx, [a, b], 9, WHITE); stroke(ctx, [a, b], 2);
  }
}
// what the falling top breaks on roof 1
const crashBits = makeDebris([
  { t: T_CRASH, x: 1075, y: -H1 - 120, w: 70, h: 9, vx: -260, vy: -620, om: 9, floor: -H1 },
  { t: T_CRASH, x: 1130, y: -H1 - 150, w: 84, h: 9, vx: -90, vy: -720, om: -8, floor: -H1 - 62 },
  { t: T_CRASH, x: 1010, y: -H1 - 60, w: 30, h: 22, vx: -380, vy: -560, floor: -H1 },
  { t: T_CRASH, x: 960, y: -H1 - 70, w: 44, h: 30, vx: -520, vy: -480, floor: -H1 },
  { t: T_CRASH, x: 880, y: -H1 - 40, w: 36, h: 20, vx: -300, vy: -700, floor: -H1 },
  { t: T_CRASH, x: 1040, y: -H1 - 80, w: 30, h: 20, vx: 60, vy: -760, floor: -H1 - 62 },
], 4500);

// ── the alley floor: cracks at T_SLAM, gives way at T_BREAK ──
const floorCracks = crackSet(51, 1795, 2, [
  { a: 2, len: 1.7 }, { a: 14, len: 0.9 }, { a: 40, len: 0.8 }, { a: 84, len: 0.7 }, { a: 118, len: 0.5 }, { a: 62, len: 0.9, w: 0.8 }, { a: 174, len: 0.15, w: 0.8 },
], { len: 190, step: 24, w: 3.6, branch: 0.34 });
const SLABS = [1790, 1862, 1934, 2006, 2070].map((x, i, a) => ({ x0: x, x1: a[i + 1] || 2112, seed: 900 + i * 7, lag: [0.1, 0.02, 0, 0.05, 0.12][i], om: [-1.1, 0.6, -0.5, 0.8, 1.3][i] }));
function drawAlleyFloor(ctx, t, vb, px) {
  if (t < T_BREAK) {
    drawGround(ctx, AL[0], AL[1], vb, px, { seed: 140, dense: t >= T_SLAM ? [1800, 2140] : null });
    if (t >= T_SLAM) drawCracks(ctx, floorCracks, prog(t, T_SLAM, T_SLAM + 0.5), 1);
    return;
  }
  const p = EASE.out(prog(t, T_BREAK, T_BREAK + 0.45));
  // the hole: the next page shows through, in the shadow of this one
  const xa = lerp(1950, 1772, p), xb = lerp(1950, 2130, p), r = rng(930);
  const rim = [[xa, 0]];
  for (let i = 1; i < 14; i++) rim.push([lerp(xa, xb, i / 14), (i % 2 ? 10 : 2) + r() * 8]);
  rim.push([xb, 0]);
  const hole = [...rim, [xb + 26, 760], [xa - 26, 760]];
  ctx.beginPath(); hole.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath();
  ctx.fillStyle = WHITE; ctx.fill();
  ctx.save(); ctx.clip();
  for (let y = 64; y < 760; y += 64) line(ctx, xa - 30, y + 20, xb + 30, y + 20, { w: 1, seed: 940 + y, rough: 0.4 });
  setSquare(ctx, [[1820, 520], [1820, 300], [1990, 520]], [[1846, 494], [1846, 380], [1930, 494]], 941, 1.3);
  cube(ctx, 2030, 420, 54, 943, 1.3);
  hatch(ctx, rect(xa - 30, 0, xb + 30, 120), { angle: 58, gap: 6, gapEnd: 22, w: 1.3, seed: 944 });
  hatch(ctx, rect(xa - 30, 0, xa + 60, 700), { angle: -66, gap: 7, gapEnd: 16, w: 1.3, seed: 945 });
  hatch(ctx, rect(xb - 60, 0, xb + 30, 700), { angle: 66, gap: 16, gapEnd: 7, w: 1.3, seed: 946 });
  ctx.restore();
  stroke(ctx, rim, 3.4);
  line(ctx, xa, 0, xa - 26, 760, { w: 2.6, seed: 947 }); line(ctx, xb, 0, xb + 26, 760, { w: 2.6, seed: 948 });
  // what is left of the floor on either side, with curled flaps
  drawGround(ctx, AL[0], xa, vb, px, { seed: 140, dense: [0, 9999] });
  drawGround(ctx, xb, AL[1], vb, px, { seed: 141, dense: [0, 9999] });
  for (const [x, d] of [[xa, 1], [xb, -1]]) {
    const f = [[x - d * 4, -2], [x + d * 30 * p, 6 + 30 * p], [x + d * 8, 44 * p + 8]];
    sketchPoly(ctx, f, { w: 2.2, seed: 950 + d, fill: WHITE }); hatch(ctx, f, { angle: 70 * d, gap: 5, w: 1.1, seed: 952 + d });
  }
  // slabs of floor tipping in
  for (const s of SLABS) {
    const tau = t - T_BREAK - s.lag;
    if (tau < 0) { drawGround(ctx, s.x0, s.x1, vb, px, { seed: s.seed, strokes: false, dense: [0, 9999] }); continue; }
    const cx = (s.x0 + s.x1) / 2, hw = (s.x1 - s.x0) / 2 - 3, dy = 0.5 * 1500 * tau * tau;
    if (dy > 820) continue;
    ctx.save(); ctx.translate(cx + s.om * 26 * tau, 12 + dy); ctx.rotate(s.om * tau * 1.2);
    const q = [[-hw, -12], [hw, -12], [hw - 5, 12], [-hw + 7, 14]];
    sketchPoly(ctx, q, { w: 2.6, seed: s.seed, fill: WHITE }); hatch(ctx, q, { angle: 58, gap: 6, w: 1.2, seed: s.seed + 1, cross: true });
    ctx.restore();
  }
}

function windowR(ctx, x, y, dark, seed) {
  const q = rect(x, y, x + 46, y + 58);
  sketchPoly(ctx, q, { w: 2, seed, fill: WHITE, over: 2 });
  line(ctx, x + 23, y, x + 23, y + 58, { w: 1.2, seed: seed + 1 }); line(ctx, x, y + 26, x + 46, y + 26, { w: 1.2, seed: seed + 2 });
  if (dark) hatch(ctx, q, { angle: 45, gap: 4.5, w: 1.1, seed: seed + 3, cross: true });
}

S.env({
  far2(ctx, t, { vb }) {
    for (const o of SKY2) if (seen(vb, o.x - 300, -1700, o.x + o.w + 300, 900)) TOWER[o.k](ctx, o.x, o.w, o.top, 700, o.seed, 1.25, 0);
  },
  far(ctx, t, { vb }) {
    for (const o of SKY1) if (seen(vb, o.x - 200, -1700, o.x + o.w + 200, 900)) TOWER[o.k](ctx, o.x, o.w, o.top, 700, o.seed, 1.7, o.k === 'b' ? 13 : 9);
    // a pencil-sharpener water tank on the far block
    if (seen(vb, 1700, -800, 2300, -500)) {
      for (const x of [1900, 1934, 2010, 2044]) line(ctx, x, -610, x + (x < 1960 ? 8 : -8), -660, { w: 1.8, seed: 2700 + x });
      box(ctx, 1890, -660, 150, 86, { d: 26, seed: 2710, lw: 1.8, gap: 6, front: 14 });
      ctx.beginPath(); ctx.ellipse(1936, -704, 22, 22, 0, 0, TAU); ctx.fillStyle = WHITE; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = BLACK; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(1936, -704, 9, 9, 0, 0, TAU); ctx.fillStyle = BLACK; ctx.fill();
      line(ctx, 1986, -716, 2024, -690, { w: 1.6, seed: 2712 });
    }
  },

  stage(ctx, t, { vb, px, st }) {
    // the gap between the two roofs: a dark shaft, with the cut tower top dropping into it
    tiles(ctx, vb, R1[1], -H2 + 10, R2[0], 0, { angle: 56, gap: 6, cross: true, crossAngle: 70, w: 1.3 }, 300, 200);
    tiles(ctx, vb, R1[1], -H2 - 130, R2[0], -H2 + 10, { angle: 56, gap: 11, w: 1.2 }, 320, 200);
    drawTower(ctx, t, st);

    // left neighbour (an eraser block)
    if (seen(vb, -420, -340, 236, 0)) {
      sketchPoly(ctx, rect(-420, -330, 232, 0), { w: 2.6, seed: 200, fill: WHITE, over: 3 });
      tiles(ctx, vb, -420, -330, 232, 0, { angle: 90, gap: 15, skip: 0.2 }, 201);
      tiles(ctx, vb, 120, -330, 232, 0, { angle: 60, gap: 7 }, 203);
      drawGround(ctx, -420, 240, vb, px, { y: -330, strokes: false, seed: 204 });
    }
    // building 1: a stack of notebooks
    if (seen(vb, R1[0], -H1, R1[1], 0)) {
      sketchPoly(ctx, rect(R1[0], -H1 + 18, R1[1], 0), { w: 2.8, seed: 210, fill: WHITE, over: 3 });
      tiles(ctx, vb, R1[0], -H1 + 44, R1[1], 0, { angle: 0, gap: 9, skip: 0.16 }, 211);
      for (let y = -H1 + 44, i = 0; y < 0; y += 92, i++) {
        line(ctx, R1[0], y, R1[1], y, { w: 3.2, seed: 220 + i });
        line(ctx, R1[0], y + 7, R1[1], y + 7, { w: 1.3, seed: 240 + i });
        for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(R1[0] + 6, y + 20 + k * 12, 7, 0.6 * Math.PI, 1.6 * Math.PI); ctx.lineWidth = 2; ctx.strokeStyle = BLACK; ctx.stroke(); }
      }
      tiles(ctx, vb, 960, -H1 + 20, R1[1], 0, { angle: 62, gap: 7, gapEnd: 5 }, 260);
      tiles(ctx, vb, R1[0], -H1 + 20, R1[1], -H1 + 44, { angle: -40, gap: 5, cross: true, crossAngle: 80, w: 1.2 }, 262);
    }
    // building 2: stacked books
    if (seen(vb, R2[0], -H2, R2[1], 0)) {
      sketchPoly(ctx, rect(R2[0], -H2 + 18, R2[1], 0), { w: 2.8, seed: 270, fill: WHITE, over: 3 });
      for (let y = -H2 + 44, i = 0; y < 0; y += 79, i++) {
        const ye = Math.min(0, y + 79);
        line(ctx, R2[0], y, R2[1], y, { w: 3, seed: 271 + i });
        if (seen(vb, R2[0], y, R2[1], ye)) hatch(ctx, rect(R2[0] + (i % 2 ? 70 : 0), y + 4, R2[1] - (i % 2 ? 0 : 60), ye - 3), i % 2 ? { angle: 0, gap: 6, w: 1, seed: 280 + i, skip: 0.1 } : { angle: 90, gap: 9, w: 1, seed: 280 + i, skip: 0.15 });
        sketchPoly(ctx, rect(R2[0] + 120 + i * 37, y + 22, R2[0] + 200 + i * 37, y + 52), { w: 1.6, seed: 290 + i, fill: WHITE });
      }
      tiles(ctx, vb, R2[0], -H2 + 20, R2[0] + 90, 0, { angle: -62, gap: 7 }, 295);
      tiles(ctx, vb, R2[0], -H2 + 20, R2[1], -H2 + 44, { angle: -40, gap: 5, cross: true, crossAngle: 80, w: 1.2 }, 297);
    }
    // the alley's back wall: light brick courses so the fighters read against it
    if (seen(vb, AL[0], -260, AL[1], 0)) {
      sketchPoly(ctx, rect(AL[0], -250, AL[1], 0), { w: 2, seed: 400, fill: WHITE });
      const r = rng(401);
      for (let y = -214, i = 0; y < -4; y += 36, i++) {
        line(ctx, AL[0] + 4, y, AL[1] - 4, y, { w: 1, seed: 402 + i, rough: 0.8 });
        for (let x = AL[0] + (i % 2 ? 30 : 64); x < AL[1] - 20; x += 68) if (r() > 0.45) line(ctx, x, y, x, y + 36, { w: 0.9, seed: 420 + i * 9 + x });
      }
      hatch(ctx, rect(AL[0], -250, AL[1], -232), { angle: 60, gap: 5, w: 1.1, seed: 440 });
      hatch(ctx, rect(AL[0], -250, AL[0] + 46, 0), { angle: -64, gap: 6, gapEnd: 14, w: 1.2, seed: 441 });
      hatch(ctx, rect(AL[1] - 46, -250, AL[1], 0), { angle: 64, gap: 14, gapEnd: 6, w: 1.2, seed: 442 });
    }
    // the tall block on the right
    if (seen(vb, AL[1], -830, PAGE.x1, 0)) {
      sketchPoly(ctx, rect(AL[1], -820, PAGE.x1 - 10, 0), { w: 3, seed: 460, fill: WHITE, over: 3 });
      tiles(ctx, vb, AL[1], -820, PAGE.x1 - 10, 0, { angle: -58, gap: 8, cross: true, crossAngle: 64, skip: 0.1 }, 461);
      tiles(ctx, vb, AL[1], -820, AL[1] + 60, 0, { angle: 84, gap: 5 }, 470);
      for (const [x, y, d] of WIN_R) if (seen(vb, x, y, x + 46, y + 58)) windowR(ctx, x, y, d, 480 + x + y);
      line(ctx, 2164, -820, 2164, -6, { w: 4.5, seed: 490, color: WHITE }); line(ctx, 2158, -820, 2158, -6, { w: 1.6, seed: 491 }); line(ctx, 2170, -820, 2170, -6, { w: 1.6, seed: 492 });
      drawGround(ctx, AL[1] - 10, PAGE.x1 - 10, vb, px, { y: -820, strokes: false, seed: 493 });
    }
    // street level left and right of the alley, then the alley floor itself
    if (vb.y1 > -30) {
      ctx.fillStyle = WHITE; ctx.fillRect(PAGE.x0 + 6, 0, PAGE.x1 - PAGE.x0 - 12, PAGE.y1 - 6);
      for (let y = 64; y < PAGE.y1 - 30; y += 64) if (y > vb.y0 && y < vb.y1) line(ctx, Math.max(PAGE.x0 + 6, vb.x0), y, Math.min(PAGE.x1 - 6, vb.x1), y, { w: 1.15, seed: 90 + y, rough: 0 });
    }
    if (vb.y1 > -30) { drawGround(ctx, PAGE.x0 + 8, AL[0], vb, px, { seed: 100 }); drawGround(ctx, AL[1], PAGE.x1 - 8, vb, px, { seed: 120 }); }
    drawAlleyFloor(ctx, t, vb, px);

    // roof slabs
    drawGround(ctx, R1[0] - 12, R1[1] + 12, vb, px, { y: -H1, strokes: false, seed: 500, lw: 3.6 });
    drawGround(ctx, R2[0] - 12, R2[1] + 12, vb, px, { y: -H2, strokes: false, seed: 520, lw: 3.6 });

    // roof 1 props
    if (seen(vb, 280, -H1 - 280, 1180, -H1)) {
      drawBillboard(ctx, t);
      sketchPoly(ctx, rect(526, -H1 - 9, 556, -H1), { w: 2, seed: 600, fill: WHITE });                       // antenna foot
      if (t < T_KICK) drawCrate(ctx, CRATE0[0], CRATE0[1], 0);
      else if (t < T_SPLIT) { const k = prog(t, T_KICK, T_SPLIT); drawCrate(ctx, lerp(CRATE0[0], CRATE1[0], k), lerp(CRATE0[1], CRATE1[1], k) - 40 * 4 * k * (1 - k), -k * 2.2); }
      // vent stack (dented after B is thrown into it) and the pen-cap chimney
      const dent = t >= T_VENT;
      box(ctx, 940, -H1, 50, dent ? 62 : 70, { d: 14, seed: 660, lw: 2.2, gap: 5, front: dent ? 5 : 10 });
      if (dent) { line(ctx, 944, -H1 - 50, 966, -H1 - 30, { w: 2, seed: 661 }); line(ctx, 966, -H1 - 30, 958, -H1 - 8, { w: 2, seed: 662 }); line(ctx, 966, -H1 - 30, 986, -H1 - 40, { w: 1.6, seed: 663 }); }
      if (t < T_CRASH) box(ctx, 1001, -H1, 22, 50, { d: 8, seed: 670, lw: 2, gap: 4, front: 6, frontAngle: 90 });
      // weathervane pole
      if (t < T_CRASH) {
      const bent = t >= T_VANE;
      line(ctx, 1075, -H1, 1075, -H1 - 150, { w: 3.2, seed: 680 });
      line(ctx, 1075, -H1 - 150, bent ? 1058 : 1075, -H1 - 170, { w: 3, seed: 681 });
      line(ctx, 1049, -H1 - 118, 1101, -H1 - 118, { w: 2.2, seed: 682 }); line(ctx, 1075, -H1 - 132, 1075, -H1 - 104, { w: 2.2, seed: 683 });
      ctx.beginPath(); ctx.arc(1075, -H1 - 118, 6, 0, TAU); ctx.fillStyle = WHITE; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = BLACK; ctx.stroke();
      // clothesline pole
      line(ctx, POLE[0], -H1, POLE[0], POLE[1] - 6, { w: 3.6, seed: 690 }); line(ctx, POLE[0] - 14, POLE[1], POLE[0] + 14, POLE[1], { w: 2.6, seed: 691 });
      if (t >= T_ROPE_CUT) line(ctx, POLE[0], POLE[1], POLE[0] - 10, POLE[1] + 34 + Math.sin(t * 9) * 3, { w: 2, seed: 692 });
      }
    }
    drawTowerTop(ctx, t, st);
    rain.draw(ctx, t, false);
    crashBits.draw(ctx, t, false);
    crateHalves.draw(ctx, t, false);
  },

  over(ctx, t) {
    rain.draw(ctx, t, true);
    crashBits.draw(ctx, t, true);
    crateHalves.draw(ctx, t, true);
  },

  surface: (x, t) => (x < R1[1] + 6 ? H1 : x < R2[0] - 6 ? null : x < R2[1] + 6 ? H2 : t < T_BREAK ? 0 : null),
});

// ── slow-motion close-up ──
S.bulletTime({ at: 13.36, span: 0.2, hold: 1.9, on: 'A', z: 2.8 });    // A frozen on the clothesline, feet first
export default S.build();
