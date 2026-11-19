// SCENE 5 — FINAL INK ARENA (25 s). Massive ink-forged weapons, total destruction, white-out.
//
// Stage (world x): toppling pillar at 610 · opening stand-off 815 ↔ 1395 · ruined arch 1490–1930
// (legs at 1532 and 1888) · tall broken pillar at 2410 · ink splash-down at 2250 · last clash 1590.
// A starts with the greatsword, B with the hammer; both weapons shatter at T_CLASH and the
// shockwave wipes the frame to pure white (white from T_WHITE to the end).

import { createScene } from '../engine/scene.js';
import { flight } from '../engine/moves.js';
import { DEG, TAU, rng, clamp, prog, EASE, hash, lerp, noise1 } from '../engine/util.js';
import { stroke, makeCracks, BLACK, WHITE } from '../engine/ink.js';

// ── story clock ──────────────────────────────────────────────────────────────
const T_GROW = 1.42;       // lightning: A's sword turns to ink
const T_GROW_B = 1.9;      // lightning again: B's hammer
const T_PILLAR = 3.4;      // B's hammer takes out the left pillar
const T_PILLAR_DOWN = 4.22;
const T_ARCH1 = 6.72;      // hammer bursts the arch's left leg
const T_SLICE = 7.1;       // A cuts the falling arch in two
const T_BAT = 7.7;         // A is batted away…
const T_ARCH2 = 7.84;      // …through the right leg
const T_SPLASH = 8.15;     // A lands in deep ink
const T_PICK = 8.5;        // B lifts a column drum
const T_THROW = 9.0;
const T_CUT = 9.2;         // A cuts the drum in half
const T_SURGE = 9.6;       // the surge breaks on B's guard
const T_AIR = 13.1;        // aerial clash; the tall pillar goes, the bridge goes
const T_MEGA = 17.75;      // the biggest clash before the last
const T_CLASH = 23.3;      // THE LAST CLASH
const T_SHATTER = T_CLASH + 0.1;
const T_WHITE = 24.45;     // pure white from here to the end

const X_PL = 610;                       // left pillar
const ARCH = { xl: 1532, xr: 1888, cx: 1710, spring: 330, ri: 136, ro: 220, w: 84 };
const X_PR = 2580;                      // tall right pillar
const PR_TOP = 392;
const CLASH = [1733, 251];              // where the last clash happens [x, height]

const smooth = (a, b, v) => { const k = clamp((v - a) / (b - a)); return k * k * (3 - 2 * k); };
// the surge A rides back in on
const surgeX = (t) => lerp(2400, 1960, clamp((t - 8.5) / 1.0));
const surgeY = (t) => Math.max(0, surgeH(t) - 14);
const surgeH = (t) => 205 * smooth(T_SPLASH + 0.05, 8.52, t) * (1 - smooth(9.5, 9.78, t));

const S = createScene({ id: 's5', title: 'Final Ink Arena', duration: 25, page: false });
let scene = null;                       // set after build — hooks may sample scene.state(t)

// ═════════════════════════════════════════════════════════════════════════════
// CHOREOGRAPHY
// ═════════════════════════════════════════════════════════════════════════════

const SW = 1.65;   // greatsword scale once it is ink (hand → tip ≈ 445)
const HM = 1.9;    // hammer scale (hand → head end ≈ 285 at g 0.3)
const pt = (o, ang, s) => [o[0] + Math.cos(ang * DEG) * s, o[1] + Math.sin(ang * DEG) * s];

// — the blade catch (4.44–5.08): A's hand and B's two palms are pinned to one line —
const H1 = [1302, 142], H2 = [1311, 127], H3 = [1366, 180];
const CATCH = (H, ang) => ({ hFw: pt(H, ang, 262), hBw: pt(H, ang, 240) });

const A_KEYS = [
  // 0:00 — locked blade-to-shaft inside the ink that swallowed them
  { t: 0, x: 1025, face: 1, hip: [8, 82], lean: 22, bend: 6, hF: [44, 22], hB: [30, 6], fF: [36, 0], fB: [-46, 0] },
  { t: 0.3, x: 1019, hip: [2, 80], lean: 16, bend: 8, hF: [40, 26], hB: [28, 8], fF: [36, 0], fB: [-46, 0] },
  { t: 0.6, x: 1027, hip: [12, 80], lean: 27, bend: 6, hF: [46, 20], hB: [30, 6], fF: [36, 0], fB: [-46, 0] },
  // shove — both skid apart
  { t: 0.68, x: 1012, hip: [-10, 86], lean: -8, hF: [54, 30], hB: [30, 10], fF: [30, 0], fB: [-40, 0], e: 'snap' },
  { t: 0.86, x: 850, hip: [-14, 68], lean: 16, hF: [32, -8], hB: [10, -20], fF: [46, 0], fB: [-50, 0], slide: true, e: 'out' },
  { t: 1.02, x: 815, hip: [-8, 74], lean: 20, hF: [34, -30], hB: [10, -34], fF: [44, 0], fB: [-46, 0], slide: true, e: 'out' },
  // drives the point down into the pool; the ink climbs the blade
  { t: 1.2, hip: [-2, 78], lean: 14, bend: 6, tilt: 14, hF: [34, 34], hB: [20, 18], fF: [44, 0], fB: [-46, 0], e: 'in' },
  { t: 1.4, hip: [-2, 76], lean: 17, bend: 6, tilt: 20, hF: [34, 32], hB: [20, 16], fF: [44, 0], fB: [-46, 0] },
  // lightning — and he rips out a sword twice his size
  { t: 1.46, hip: [-4, 78], lean: 12, tilt: 0, hF: [34, 30], hB: [20, 14], fF: [44, 0], fB: [-46, 0] },
  { t: 1.56, hip: [-10, 86], lean: 0, hF: [30, 16], hB: [12, 0], fF: [42, 0], fB: [-44, 0], e: 'in' },
  { t: 1.7, hip: [-14, 94], lean: -10, tilt: -8, hF: [12, 34], hB: [0, 20], fF: [40, 0], fB: [-42, 0], e: 'out' },
  { t: 1.88, hip: [-6, 84], lean: 8, hF: [30, 4], hB: [10, -10], fF: [40, 0], fB: [-42, 0] },
  // sees the hammer come down — stands the sword on its pommel like a post and gets behind it
  { t: 2.06, hip: [-10, 86], lean: -4, tilt: 12, hF: [20, 30], hB: [6, 12], fF: [38, 0], fB: [-40, 0] },
  { t: 2.2, x: 838, hip: [0, 92], lean: 4, hF: [30, 40], hB: [16, 18], fF: [36, 0], fB: [-36, 0] },
  { t: 2.34, x: 850, hip: [-4, 78], lean: 12, hFw: [890, 138], hB: [30, -30], fF: [44, 0], fB: [-50, 0], e: 'in' },
  { t: 2.5, hip: [4, 70], lean: 26, tilt: 10, hFw: [890, 138], hB: [30, -30], fF: [44, 0], fB: [-62, 0] },
  { t: 2.6, hip: [-12, 74], lean: 4, tilt: -16, hFw: [884, 138], hB: [30, -30], fF: [44, 0], fB: [-62, 0], e: 'snap' },
  { t: 2.68, same: true },
  // shoved back, the pommel ploughing the floor
  { t: 2.84, x: 796, hip: [-16, 70], lean: -8, tilt: -10, hFw: [836, 133], hB: [30, -30], fF: [40, 0], fB: [-44, 0], slide: true, e: 'out' },
  // tears it free; its weight swings it up and over behind him
  { t: 2.96, x: 790, hip: [-18, 80], lean: -16, hF: [0, 50], hB: [-10, 34], fF: [36, 0], fB: [-44, 0] },
  { t: 3.08, x: 786, hip: [-10, 68], lean: 6, hF: [-36, 4], hB: [-30, -14], fF: [34, 0], fB: [-40, 0] },
  // sees the hammer coming round — throws himself down against the pillar
  { t: 3.2, x: 778, hip: [4, 56], lean: 30, tilt: -30, hF: [-34, -20], hB: [-20, -30], fF: [30, 0], fB: [-36, 0] },
  { t: 3.32, x: 770, hip: [0, 40], lean: 56, bend: 12, tilt: -26, hF: [-30, -30], hB: [10, -10], fF: [34, 0], fB: [-36, 0], kB: -1, e: 'out' },
  { t: 3.4, hip: [0, 37], lean: 60, bend: 14, tilt: -10, hF: [-30, -28], hB: [16, -2], fF: [34, 0], fB: [-36, 0], kB: -1 },
  { t: 3.48, hip: [0, 44], lean: 44, tilt: -40, hF: [-26, -20], hB: [20, 30], fF: [34, 0], fB: [-36, 0], kB: -1 },
  // springs up onto the hammer shaft and runs along it
  ...flight(3.48, 3.64, [770, 0], [802, 150], 4000, [
    [3.56, { hip: [0, 74], lean: 16, hF: [-16, 10], hB: [-20, -6], fF: [26, 22], fB: [-10, 10] }],
  ], { hip: [0, 62], lean: 28, hF: [-10, 20], hB: [-16, 4], fF: [26, 0], fB: [-26, 0] }),
  { t: 3.74, x: 856, y: 150, p: 'run1', hip: [0, 82], lean: 22, hF: [-8, 24], hB: [-14, 8], hop: 8, e: 'lin' },
  { t: 3.84, x: 912, y: 152, p: 'run2', hip: [0, 84], lean: 20, hF: [-8, 26], hB: [-14, 10], fFw: [958, 186], hop: 8, e: 'lin' },
  { t: 3.9, x: 944, y: 170, hip: [4, 92], lean: 12, hF: [-10, 34], hB: [-16, 18], fFw: [960, 182], fB: [-30, 14], e: 'in' },
  // vaults off B's head, turns in the air, lands behind him
  ...flight(3.9, 4.26, [944, 170], [1390, 0], 6000, [
    [4.02, { p: 'tuck', hF: [-10, 50], hB: [-16, 40] }],
    [4.14, { p: 'tuck', face: -1, hF: [-20, 56], hB: [-24, 44] }],
  ], { hip: [0, 56], lean: 18, hF: [-22, 46], hB: [-26, 30], fF: [36, 0], fB: [-36, 0] }),
  // …and brings the whole sword down
  { t: 4.34, hip: [-8, 86], lean: -8, hF: [-16, 64], hB: [-22, 48], fF: [34, 0], fB: [-36, 0] },
  { t: 4.44, hip: [10, 78], lean: 26, hFw: H1, hB: [40, 0], fF: [48, 0], fB: [-44, 0], e: 'in3' },
  { t: 4.52, hip: [10, 78], lean: 26, hFw: H1, hB: [40, 0], fF: [48, 0], fB: [-44, 0] },
  // caught. He leans everything he has on it
  { t: 4.66, hip: [16, 74], lean: 33, hFw: H1, hB: [40, 0], fF: [48, 0], fB: [-50, 0] },
  { t: 4.8, hip: [20, 70], lean: 38, hFw: H1, hB: [40, 0], fF: [48, 0], fB: [-56, 0] },
  // B wrenches the blade down past his hip — A is dragged in…
  { t: 4.96, x: 1380, hip: [22, 62], lean: 46, tilt: -20, hFw: H2, hB: [40, 0], fF: [50, 0], fB: [-52, 0] },
  // …and rammed back off his feet
  { t: 5.08, x: 1400, y: 10, hip: [-10, 84], lean: -12, tilt: -24, hFw: H3, hB: [40, 0], fF: [30, 0], fB: [-18, 8], e: 'snap' },
  ...flight(5.08, 5.44, [1400, 10], [1650, 0], 3400, [
    [5.2, { hip: [0, 60], lean: -40, tilt: -20, hF: [50, 20], hB: [40, 10], fF: [60, 40], fB: [40, 20] }],
    [5.32, { hip: [0, 62], lean: -16, hF: [50, 0], hB: [40, -10], fF: [30, 10], fB: [-20, 10] }],
  ], { hip: [-10, 46], lean: 40, tilt: -30, hF: [44, -4], hB: [30, -20], fF: [30, 0], fB: [-56, 0], kB: -1 }),
  // lands braking, the sword ploughing the floor
  { t: 5.62, x: 1725, hip: [-12, 44], lean: 44, tilt: -34, hF: [44, -2], hB: [30, -20], fF: [30, 0], fB: [-60, 0], kB: -1, slide: true, e: 'out' },
  { t: 5.82, hip: [-6, 70], lean: 22, tilt: -20, hF: [36, 6], hB: [20, -10], fF: [32, 0], fB: [-40, 0] },
  { t: 6.02, x: 1730, hip: [-6, 86], lean: 8, hF: [34, 0], hB: [14, -14], fF: [32, 0], fB: [-32, 0] },
  // under the arch: gives ground as B comes on
  { t: 6.3, x: 1742, hip: [-10, 88], lean: 2, hF: [34, 6], hB: [14, -10], fF: [32, 0], fB: [-32, 0] },
  { t: 6.5, x: 1764, hip: [-8, 86], lean: 4, hF: [32, 10], hB: [12, -6], fF: [30, 0], fB: [-34, 0] },
  { t: 6.66, x: 1800, hip: [-16, 82], lean: -14, tilt: -10, hF: [30, 22], hB: [14, 6], fF: [30, 0], fB: [-36, 0], e: 'out' },
  { t: 6.74, hip: [-18, 78], lean: -18, tilt: -30, hF: [24, 30], hB: [10, 12], fF: [30, 0], fB: [-36, 0] },
  // the arch is coming down on him — blade to the floor, then straight up through it
  { t: 6.88, hip: [-6, 68], lean: 12, tilt: -44, hF: [40, -32], hB: [20, -36], fF: [34, 0], fB: [-36, 0] },
  { t: 7.0, hip: [-12, 58], lean: 22, tilt: -40, hF: [32, -42], hB: [14, -44], fF: [36, 0], fB: [-38, 0] },
  { t: 7.1, hip: [6, 94], lean: -6, tilt: -10, hF: [18, 72], hB: [6, 56], fF: [34, 0], fB: [-34, 0], e: 'snap' },
  { t: 7.16, same: true },
  // the follow-through drags him round
  { t: 7.28, x: 1808, hip: [-10, 88], lean: -24, hF: [-30, 58], hB: [-36, 40], fF: [30, 0], fB: [-36, 0] },
  { t: 7.4, x: 1822, hip: [-20, 74], lean: -30, hF: [-48, 18], hB: [-50, 0], fF: [26, 0], fB: [-42, 0] },
  { t: 7.5, x: 1824, hip: [-14, 70], lean: -10, hF: [-44, 2], hB: [-40, -16], fF: [28, 0], fB: [-42, 0] },
  // sees the hammer coming up off the floor — gets the flat of the blade in the way
  { t: 7.62, hip: [-6, 82], lean: 2, tilt: 10, hF: [16, 14], hB: [10, -6], fF: [30, 0], fB: [-36, 0], e: 'out' },
  { t: 7.7, x: 1832, y: 14, hip: [-22, 80], lean: 38, bend: 22, hF: [34, 12], hB: [30, -6], fF: [44, 8], fB: [26, 2], e: 'snap' },
  { t: 7.76, same: true, x: 1836, y: 16 },
  // batted clean through the arch's other leg, into deep ink
  ...flight(7.76, 8.15, [1836, 16], [2400, 0], 3000, [
    [7.9, { p: 'flyBack', hF: [50, 20], hB: [44, 6] }],
    [8.04, { hip: [0, 56], lean: 30, bend: 8, hF: [44, 0], hB: [36, -14], fF: [40, 16], fB: [-10, 8] }],
  ], { hip: [0, 40], lean: 40, bend: 10, hF: [40, -20], hB: [20, -40], fF: [34, 0], fB: [-34, 0] }),
  // the ink throws him back: he rides the surge in
  { t: 8.3, x: 2400, y: surgeY(8.3), hip: [0, 46], lean: 36, hF: [10, -10], hB: [-10, -30], fF: [36, 0], fB: [-36, 0], er: 'lin' },
  { t: 8.5, x: surgeX(8.5), y: surgeY(8.5), hip: [-8, 60], lean: 16, hF: [-14, 18], hB: [-20, 0], fF: [42, 0], fB: [-44, 0], er: 'lin' },
  { t: 8.7, x: surgeX(8.7), y: surgeY(8.7), hip: [-2, 64], lean: 22, hF: [-16, 24], hB: [-22, 6], fF: [42, 0], fB: [-44, 0], er: 'lin' },
  { t: 8.9, x: surgeX(8.9), y: surgeY(8.9), hip: [-10, 58], lean: 12, hF: [-18, 26], hB: [-24, 8], fF: [42, 0], fB: [-44, 0], er: 'lin' },
  { t: 9.06, x: surgeX(9.06), y: surgeY(9.06), hip: [-4, 62], lean: 16, hF: [-20, 36], hB: [-26, 18], fF: [42, 0], fB: [-44, 0], er: 'lin' },
  // B's boulder — cut in two in mid-air
  { t: 9.14, x: surgeX(9.14), y: surgeY(9.14), hip: [-12, 70], lean: -4, hF: [-22, 56], hB: [-28, 40], fF: [40, 0], fB: [-44, 0], er: 'lin' },
  { t: 9.2, x: surgeX(9.2), y: surgeY(9.2), hip: [8, 66], lean: 30, hF: [58, 30], hB: [36, 16], fF: [46, 0], fB: [-44, 0], e: 'snap', er: 'lin' },
  { t: 9.26, same: true, x: surgeX(9.26), y: surgeY(9.26), er: 'lin' },
  { t: 9.34, x: surgeX(9.34), y: surgeY(9.34), hip: [-6, 54], lean: 24, hF: [10, 50], hB: [0, 34], fF: [40, 0], fB: [-42, 0], er: 'lin' },
  // leaps off the crest at B
  { t: 9.42, x: surgeX(9.42), y: surgeY(9.42), hip: [6, 90], lean: 12, hF: [-8, 68], hB: [-16, 52], fF: [20, 0], fB: [-36, 0], e: 'in', er: 'lin' },
  ...flight(9.42, 9.8, [surgeX(9.42), surgeY(9.42)], [1800, 0], 5000, [
    [9.52, { hip: [0, 84], lean: -6, hF: [-10, 72], hB: [-18, 56], fF: [16, 14], fB: [-30, 24] }],
    [9.6, { hip: [0, 80], lean: 28, hF: [56, 36], hB: [36, 22], fF: [30, 20], fB: [-20, 30], e: 'snap' }],
    [9.68, { hip: [0, 80], lean: 24, hF: [54, 38], hB: [34, 24], fF: [30, 16], fB: [-16, 26] }],
  ], { hip: [0, 52], lean: 30, hF: [30, 30], hB: [14, 14], fF: [36, 0], fB: [-36, 0] }),
  { t: 9.92, hip: [-6, 80], lean: 8, hF: [30, 12], hB: [14, -4], fF: [34, 0], fB: [-34, 0] },
  // shoved back off the bind
  { t: 10.0, x: 1808, hip: [-16, 78], lean: -14, tilt: -14, hF: [20, 26], hB: [6, 8], fF: [30, 0], fB: [-40, 0], e: 'snap' },
  { t: 10.12, x: 1900, hip: [-12, 70], lean: 10, hF: [30, 6], hB: [12, -10], fF: [40, 0], fB: [-46, 0], slide: true, e: 'out' },
  { t: 10.3, hip: [-4, 56], lean: 20, tilt: -30, hF: [30, 0], hB: [12, -16], fF: [36, 0], fB: [-40, 0] },
  // hops back out from under the hammer
  ...flight(10.3, 10.54, [1900, 0], [2180, 0], 4200, [
    [10.42, { p: 'tuck', hF: [20, 30], hB: [10, 14] }],
  ], { hip: [0, 54], lean: 26, hF: [30, 4], hB: [14, -12], fF: [34, 0], fB: [-34, 0] }),
  // …and straight back in over it
  { t: 10.66, x: 2160, hip: [-10, 84], lean: -8, hF: [-10, 60], hB: [-18, 44], fF: [30, 0], fB: [-36, 0] },
  { t: 10.8, x: 2090, p: 'run1', hip: [4, 86], lean: 16, hF: [-6, 68], hB: [-14, 52], hop: 8, e: 'lin' },
  { t: 10.95, x: 2040, hip: [12, 78], lean: 28, hF: [54, 26], hB: [34, 10], fF: [48, 0], fB: [-46, 0], e: 'in3' },
  { t: 11.02, same: true },
  { t: 11.14, hip: [14, 76], lean: 32, hF: [52, 30], hB: [32, 14], fF: [48, 0], fB: [-46, 0] },
  // B throws the blade up and off — its weight drags A backwards
  { t: 11.26, x: 2060, hip: [-12, 84], lean: -16, tilt: -16, hF: [10, 62], hB: [0, 46], fF: [30, 0], fB: [-40, 0], e: 'snap' },
  { t: 11.4, x: 2110, hip: [-20, 76], lean: -26, hF: [-36, 40], hB: [-40, 22], fF: [28, 0], fB: [-44, 0] },
  { t: 11.52, x: 2150, hip: [-12, 72], lean: -6, hF: [-40, 4], hB: [-36, -14], fF: [30, 0], fB: [-40, 0] },
  // reads the scoop: jumps ONTO the rising hammer head and lets it throw him
  { t: 11.64, x: 2184, hip: [-2, 54], lean: 22, hF: [-6, 30], hB: [-16, 14], fF: [30, 0], fB: [-32, 0] },
  { t: 11.72, x: 2192, hip: [2, 90], lean: 6, hF: [6, 60], hB: [-6, 44], fF: [20, 0], fB: [-26, 0], e: 'in' },
  ...flight(11.72, 11.9, [2192, 0], [2210, 206], 3000, [
    [11.82, { p: 'tuck', hF: [10, 56], hB: [0, 40] }],
  ], { hip: [0, 50], lean: 22, hF: [14, 50], hB: [4, 34], fF: [30, 0], fB: [-30, 0] }),
  ...flight(11.9, 12.35, [2210, 206], [X_PR, PR_TOP], 5000, [
    [12.02, { p: 'airUp', spin: -50 }],
    [12.14, { p: 'tuck', spin: -180, hF: [20, 40], hB: [10, 26] }],
    [12.26, { p: 'tuck', spin: -320, hF: [20, 40], hB: [10, 26] }],
  ], { hip: [0, 48], lean: 30, bend: 10, hF: [26, 20], hB: [10, 4], fF: [30, 0], fB: [-30, 0], spin: -360 }),
  // on top of the tall pillar
  { t: 12.5, y: PR_TOP, hip: [-4, 98], lean: -4, hF: [10, 66], hB: [0, 50], fF: [24, 0], fB: [-24, 0], e: 'out' },
  { t: 12.64, y: PR_TOP, hip: [-8, 60], lean: 14, hF: [-20, 56], hB: [-28, 40], fF: [26, 0], fB: [-26, 0] },
  { t: 12.74, y: PR_TOP, hip: [8, 92], lean: 16, hF: [-10, 68], hB: [-18, 52], fF: [14, 0], fB: [-30, 0], e: 'in' },
  // plunges — B swings up to meet him
  ...flight(12.74, 13.1, [X_PR, PR_TOP], [2500, 290], 4000, [
    [12.92, { hip: [0, 84], lean: -8, hF: [-6, 72], hB: [-14, 56], fF: [16, 16], fB: [-30, 26] }],
  ], { hip: [0, 80], lean: 28, hF: [56, 36], hB: [36, 20], fF: [30, 20], fB: [-24, 30], e: 'in3' }),
  { t: 13.18, same: true, x: 2500, y: 286 },
  ...flight(13.18, 13.46, [2500, 286], [2470, 0], 5200, [
    [13.32, { hip: [0, 70], lean: -10, tilt: -20, hF: [30, 50], hB: [14, 34], fF: [30, 10], fB: [-20, 16] }],
  ], { hip: [0, 46], lean: 34, hF: [36, -10], hB: [18, -26], fF: [34, 0], fB: [-36, 0] }),
  // spent: plants the blade and hangs on it
  { t: 13.6, x: 2484, hip: [-6, 60], lean: 32, bend: 12, tilt: 14, hF: [-30, -18], hB: [-36, -30], fF: [32, 0], fB: [-40, 0], slide: true, e: 'out' },
  { t: 13.84, hip: [-6, 66], lean: 24, bend: 8, tilt: 6, hF: [-30, -24], hB: [-36, -36], fF: [32, 0], fB: [-40, 0] },
  { t: 14.06, hip: [-6, 60], lean: 33, bend: 13, tilt: 14, hF: [-30, -18], hB: [-36, -30], fF: [32, 0], fB: [-40, 0] },
  // rips it up and round behind him, runs
  { t: 14.18, hip: [-12, 78], lean: 6, tilt: -10, hF: [-40, -8], hB: [-40, -22], fF: [30, 0], fB: [-36, 0], e: 'in' },
  { t: 14.3, x: 2436, p: 'run1', hF: [-44, -6], hB: [-40, -20], hop: 8, e: 'lin' },
  { t: 14.42, x: 2352, p: 'run2', hF: [-46, -4], hB: [-42, -18], hop: 8, e: 'lin' },
  // B leaves the ground — A drops and slides straight under him, the blade skating along the floor behind
  { t: 14.5, x: 2290, hip: [-6, 60], lean: -10, hF: [-44, 0], hB: [-40, -14], fF: [50, 0], fB: [-30, 0] },
  { t: 14.6, x: 2150, hip: [-8, 36], lean: -34, tilt: 26, hF: [-58, -26], hB: [-50, -40], fF: [74, 6], fB: [30, 0], slide: true, e: 'lin', er: 'lin' },
  { t: 14.7, x: 2010, hip: [-8, 32], lean: -40, tilt: 26, hF: [-58, -26], hB: [-50, -40], fF: [74, 6], fB: [30, 0], slide: true, e: 'lin', er: 'lin' },
  { t: 14.8, x: 1880, hip: [-8, 32], lean: -40, tilt: 26, hF: [-58, -26], hB: [-50, -40], fF: [74, 6], fB: [30, 0], slide: true, e: 'lin', er: 'lin' },
  { t: 14.9, x: 1760, hip: [-8, 34], lean: -36, tilt: 26, hF: [-58, -26], hB: [-50, -40], fF: [74, 6], fB: [30, 0], slide: true, e: 'lin', er: 'lin' },
  { t: 15.0, x: 1625, hip: [-6, 38], lean: -24, tilt: 14, hF: [-54, -16], hB: [-48, -30], fF: [60, 0], fB: [20, 0], slide: true, e: 'lin', er: 'lin' },
  { t: 15.1, x: 1552, hip: [-6, 50], lean: -8, hF: [-44, 6], hB: [-40, -10], fF: [44, 0], fB: [6, 0], slide: true, e: 'out', er: 'out' },
  // comes up turning — the blade is already pointing at B's back. Draws it in…
  { t: 15.22, x: 1516, face: 1, hip: [-8, 80], lean: 2, hF: [30, -6], hB: [10, -18], fF: [30, 0], fB: [-34, 0] },
  { t: 15.38, x: 1504, hip: [-22, 74], lean: -10, hF: [-8, -10], hB: [-24, -18], fF: [34, 0], fB: [-40, 0] },
  // …and lunges: a straight thrust
  { t: 15.52, x: 1522, hip: [16, 82], lean: 30, hF: [78, -6], hB: [40, -16], fF: [56, 0], fB: [-56, 0], e: 'in3' },
  { t: 15.6, same: true },
  // stopped dead on the hammer head; the point is knocked up and the blade carries over his shoulder
  { t: 15.74, x: 1620, hip: [-14, 78], lean: -14, tilt: -10, hF: [30, 36], hB: [14, 18], fF: [32, 0], fB: [-40, 0], e: 'out' },
  { t: 15.9, x: 1676, hip: [-18, 72], lean: -18, hF: [-30, 30], hB: [-38, 12], fF: [34, 0], fB: [-40, 0] },
  { t: 16.06, x: 1668, hip: [-6, 64], lean: 28, bend: 12, tilt: 12, hF: [-34, -16], hB: [-38, -30], fF: [36, 0], fB: [-40, 0] },
  { t: 16.28, hip: [-6, 70], lean: 20, bend: 8, tilt: 2, hF: [-34, -22], hB: [-38, -36], fF: [36, 0], fB: [-40, 0] },
  { t: 16.46, hip: [-14, 78], lean: 2, hF: [-36, 10], hB: [-40, -8], fF: [36, 0], fB: [-40, 0], e: 'in' },
  { t: 16.64, x: 1690, hip: [-12, 88], lean: -8, hF: [-16, 60], hB: [-24, 44], fF: [34, 0], fB: [-40, 0] },
  { t: 16.78, x: 1710, hip: [0, 88], lean: 6, hF: [0, 68], hB: [-10, 52], fF: [40, 0], fB: [-40, 0] },
  { t: 16.9, x: 1720, hip: [12, 80], lean: 26, hF: [52, 40], hB: [30, 24], fF: [46, 0], fB: [-44, 0], e: 'snap' },
  { t: 16.98, same: true },
  // locked — B walks him backwards across the rubble
  { t: 17.14, x: 1690, hip: [6, 72], lean: 30, hF: [48, 36], hB: [28, 20], fF: [40, 0], fB: [-50, 0], slide: true, e: 'lin', er: 'lin' },
  { t: 17.3, x: 1640, hip: [2, 66], lean: 34, hF: [44, 34], hB: [24, 18], fF: [40, 0], fB: [-52, 0], slide: true, e: 'lin', er: 'lin' },
  { t: 17.42, x: 1605, hip: [0, 62], lean: 36, hF: [42, 32], hB: [22, 16], fF: [40, 0], fB: [-54, 0], slide: true, e: 'out' },
  // shoves off, and everything into one more
  { t: 17.5, x: 1596, hip: [-14, 84], lean: -12, hF: [30, 50], hB: [14, 34], fF: [30, 0], fB: [-40, 0], e: 'snap' },
  { t: 17.62, x: 1594, hip: [-12, 90], lean: -14, hF: [-16, 64], hB: [-24, 48], fF: [32, 0], fB: [-40, 0] },
  { t: T_MEGA, x: 1605, hip: [12, 80], lean: 26, hF: [52, 40], hB: [30, 24], fF: [46, 0], fB: [-44, 0], e: 'in3' },
  { t: 17.85, same: true },
  // blown back, skidding, down on one knee
  { t: 18.0, x: 1520, hip: [-18, 70], lean: -20, tilt: -16, hF: [-10, 50], hB: [-22, 32], fF: [40, 0], fB: [-44, 0], slide: true, e: 'out' },
  { t: 18.2, x: 1430, hip: [-12, 58], lean: 6, hF: [-36, 10], hB: [-40, -8], fF: [40, 0], fB: [-44, 0], slide: true, e: 'out' },
  { t: 18.4, x: 1390, hip: [0, 50], lean: 30, bend: 14, tilt: 16, hF: [-32, -22], hB: [-36, -34], fF: [36, 0], fB: [-40, 0], slide: true, e: 'out' },
  { t: 18.66, hip: [0, 54], lean: 24, bend: 10, tilt: 8, hF: [-32, -26], hB: [-36, -38], fF: [36, 0], fB: [-40, 0] },
  { t: 18.9, hip: [0, 50], lean: 32, bend: 15, tilt: 18, hF: [-32, -20], hB: [-36, -32], fF: [36, 0], fB: [-40, 0] },
  { t: 19.14, hip: [0, 54], lean: 24, bend: 10, tilt: -8, hF: [-32, -26], hB: [-36, -38], fF: [36, 0], fB: [-40, 0] },
  // gets up. Everything he has left
  { t: 19.4, hip: [-6, 72], lean: 12, hF: [-36, -4], hB: [-40, -20], fF: [36, 0], fB: [-40, 0] },
  { t: 19.7, hip: [-14, 84], lean: -6, hF: [-38, 28], hB: [-44, 10], fF: [36, 0], fB: [-42, 0] },
  { t: 20.0, hip: [-20, 78], lean: -16, hF: [-36, 50], hB: [-44, 32], fF: [40, 0], fB: [-46, 0] },
  // the held breath
  { t: 20.3, hip: [-21, 76], lean: -17, hF: [-37, 51], hB: [-44, 32], fF: [40, 0], fB: [-46, 0] },
  { t: 20.6, hip: [-20, 78], lean: -16, hF: [-36, 50], hB: [-44, 32], fF: [40, 0], fB: [-46, 0] },
  { t: 20.9, hip: [-23, 73], lean: -19, hF: [-38, 48], hB: [-46, 30], fF: [40, 0], fB: [-46, 0] },
  // go
  { t: 21.02, x: 1424, p: 'run1', hF: [-36, 52], hB: [-44, 34], hop: 8, e: 'lin' },
  { t: 21.16, x: 1474, p: 'run2', hF: [-34, 54], hB: [-42, 36], hop: 8, e: 'lin' },
  { t: 21.3, x: 1524, p: 'run1', hF: [-30, 58], hB: [-38, 40], hop: 8, e: 'lin' },
  { t: 21.42, x: 1560, hip: [0, 70], lean: 16, hF: [-24, 62], hB: [-32, 46], fF: [40, 0], fB: [-40, 0] },
  { t: 21.5, x: 1564, hip: [6, 92], lean: 12, hF: [-18, 66], hB: [-28, 50], fF: [26, 0], fB: [-36, 0], e: 'in' },
  // slow motion: the leap
  { t: 22.1, x: 1580, y: 36, hip: [0, 86], lean: 0, hF: [-10, 72], hB: [-18, 56], fF: [20, 16], fB: [-30, 26], e: 'lin', er: 'lin' },
  { t: 22.7, x: 1597, y: 54, hip: [0, 84], lean: 10, hF: [10, 72], hB: [0, 56], fF: [24, 22], fB: [-34, 30], e: 'lin', er: 'lin' },
  { t: 23.2, x: 1611, y: 50, hip: [4, 82], lean: 22, hF: [40, 54], hB: [22, 38], fF: [30, 20], fB: [-36, 30], e: 'lin', er: 'lin' },
  { t: T_CLASH, x: 1614, y: 47, hip: [8, 80], lean: 28, hF: [54, 40], hB: [32, 24], fF: [34, 18], fB: [-38, 28], e: 'in', er: 'lin' },
  { t: T_SHATTER, same: true, x: 1612, y: 46 },
  // the shockwave throws them out of the picture
  { t: 23.62, x: 1360, y: 120, p: 'flyBack', lean: -50, tilt: -20, hF: [60, 30], hB: [56, 10], e: 'out', er: 'lin' },
  { t: 24.0, x: 760, y: 210, p: 'flyBack', lean: -66, tilt: -24, hF: [64, 36], hB: [58, 14], e: 'lin', er: 'lin' },
  { t: 25, x: -1500, y: 260, p: 'flyBack', lean: -70, hF: [64, 36], hB: [58, 14], e: 'lin', er: 'lin' },
];

const B_KEYS = [
  { t: 0, x: 1185, face: -1, hip: [8, 76], lean: 26, bend: 10, hF: [44, 26], hB: [20, 4], fF: [50, 0], fB: [-56, 0] },
  { t: 0.3, x: 1179, hip: [14, 76], lean: 31, bend: 10, hF: [46, 24], hB: [20, 4], fF: [50, 0], fB: [-56, 0] },
  { t: 0.6, x: 1187, hip: [4, 78], lean: 22, bend: 10, hF: [42, 28], hB: [20, 6], fF: [50, 0], fB: [-56, 0] },
  { t: 0.68, x: 1200, hip: [-8, 84], lean: -6, hF: [56, 30], hB: [30, 10], fF: [46, 0], fB: [-50, 0], e: 'snap' },
  { t: 0.86, x: 1362, hip: [-12, 70], lean: 22, hF: [30, -12], hB: [0, -30], fF: [52, 0], fB: [-56, 0], slide: true, e: 'out' },
  { t: 1.02, x: 1395, hip: [-6, 74], lean: 26, hF: [36, -36], hB: [6, -40], fF: [52, 0], fB: [-54, 0], slide: true, e: 'out' },
  // hammer head down in the pool, waiting his turn
  { t: 1.2, hip: [0, 74], lean: 28, bend: 10, hF: [36, -54], hB: [8, -54], fF: [52, 0], fB: [-54, 0] },
  { t: 1.5, hip: [0, 73], lean: 29, bend: 11, tilt: -14, hF: [36, -54], hB: [8, -54], fF: [52, 0], fB: [-54, 0] },
  { t: 1.88, hip: [0, 72], lean: 32, bend: 12, tilt: 16, hF: [36, -55], hB: [8, -55], fF: [52, 0], fB: [-54, 0] },
  // lightning again — he heaves up a hammer as big as he is
  { t: 1.94, hip: [-2, 74], lean: 26, hF: [36, -50], hB: [8, -52], fF: [52, 0], fB: [-54, 0] },
  { t: 2.02, hip: [-10, 82], lean: 8, hF: [26, -8], hB: [0, -26], fF: [52, 0], fB: [-54, 0], e: 'in' },
  { t: 2.12, hip: [-18, 84], lean: -8, hF: [-8, 32], hB: [-30, 12], fF: [46, 0], fB: [-50, 0], e: 'out' },
  // lets it topple forward — the head slams down between them…
  { t: 2.28, x: 1410, hip: [-10, 84], lean: 20, bend: 8, hFw: [1345, 100], hB: [20, -50], fF: [50, 0], fB: [-50, 0], e: 'in3' },
  // …and he ploughs it across the floor at A
  { t: 2.4, x: 1372, hip: [0, 82], lean: 26, bend: 8, hFw: [1306, 100], hB: [30, -52], fF: [44, 0], fB: [-56, 0], e: 'lin' },
  { t: 2.5, x: 1330, hip: [4, 80], lean: 30, bend: 8, hFw: [1268, 100], hB: [32, -52], fF: [56, 0], fB: [-40, 0], e: 'lin' },
  { t: 2.6, x: 1290, hip: [14, 74], lean: 40, hFw: [1233, 100], hB: [36, -50], fF: [58, 0], fB: [-62, 0], e: 'in' },
  { t: 2.68, same: true },
  // heaves it up, and lets it swing right round behind him
  { t: 2.84, x: 1290, hip: [-10, 82], lean: 4, hF: [20, 46], hB: [-4, 26], fF: [46, 0], fB: [-50, 0], e: 'in' },
  { t: 2.98, x: 1300, hip: [-22, 74], lean: -16, hF: [-34, 30], hB: [-46, 6], fF: [46, 0], fB: [-50, 0] },
  { t: 3.12, x: 1226, p: 'bRun1', hip: [0, 82], lean: 12, hF: [-20, 52], hB: [-36, 30], hop: 6, e: 'lin' },
  { t: 3.26, x: 1112, p: 'bRun2', hip: [4, 82], lean: 24, hF: [10, 64], hB: [-10, 46], hop: 6, e: 'lin' },
  // the swing takes out the pillar A is cowering against
  { t: 3.4, x: 1030, hip: [16, 78], lean: 40, hF: [70, 6], hB: [40, -4], fF: [58, 0], fB: [-60, 0], e: 'in3' },
  { t: 3.5, same: true },
  // wedged. He hauls on it; A's weight on the shaft drags his hands down
  { t: 3.64, hip: [10, 74], lean: 44, hF: [68, -2], hB: [40, -10], fF: [58, 0], fB: [-60, 0] },
  { t: 3.76, hip: [0, 76], lean: 36, tilt: -44, hF: [70, 2], hB: [42, -8], fF: [58, 0], fB: [-60, 0] },
  // a foot on his head
  { t: 3.86, hip: [12, 68], lean: 52, tilt: 20, hF: [66, -12], hB: [40, -20], fF: [58, 0], fB: [-60, 0], e: 'snap' },
  { t: 3.94, x: 1020, hip: [18, 64], lean: 58, tilt: 24, hF: [44, -50], hB: [20, -56], fF: [58, 0], fB: [-56, 0] },
  // lets go of the hammer, turns
  { t: 4.08, x: 1024, hip: [4, 74], lean: 26, hF: [26, -44], hB: [-10, -46], fF: [44, 0], fB: [-44, 0] },
  { t: 4.2, x: 1035, face: 1, hip: [0, 80], lean: 4, hF: [14, -24], hB: [-12, -32], fF: [32, 0], fB: [-36, 0] },
  { t: 4.34, hip: [-6, 80], lean: -6, tilt: -22, hF: [34, 36], hB: [26, 44], fF: [36, 0], fB: [-40, 0] },
  // claps the giant blade between his fists
  { t: 4.44, hip: [-10, 82], lean: -8, tilt: -10, ...CATCH(H1, 162), fF: [40, 0], fB: [-46, 0], e: 'snap' },
  { t: 4.52, hip: [-10, 82], lean: -8, tilt: -10, ...CATCH(H1, 162), fF: [40, 0], fB: [-46, 0] },
  { t: 4.66, hip: [-10, 72], lean: -6, tilt: -4, ...CATCH(H1, 162), fF: [42, 0], fB: [-50, 0] },
  { t: 4.8, hip: [-6, 66], lean: 0, tilt: 4, ...CATCH(H1, 162), fF: [44, 0], fB: [-54, 0] },
  // wrenches it aside…
  { t: 4.96, hip: [-16, 64], lean: 12, tilt: 10, ...CATCH(H2, 175), fF: [44, 0], fB: [-54, 0] },
  // …and rams it back at him
  { t: 5.08, hip: [14, 84], lean: 24, ...CATCH(H3, 168), fF: [50, 0], fB: [-56, 0], e: 'snap' },
  { t: 5.18, hip: [18, 82], lean: 30, hF: [76, 22], hB: [66, 30], fF: [50, 0], fB: [-56, 0] },
  { t: 5.34, hip: [0, 84], lean: 10, hF: [30, -20], hB: [-10, -34], fF: [44, 0], fB: [-46, 0] },
  // back to the hammer: bends, takes the shaft, heaves it up
  { t: 5.48, x: 1012, face: -1, hip: [0, 80], lean: 16, hF: [30, -34], hB: [-14, -36], fF: [34, 0], fB: [-36, 0] },
  { t: 5.62, x: 985, hip: [10, 50], lean: 60, bend: 12, hFw: [940, 26], hB: [30, -50], fF: [50, 0], fB: [-50, 0] },
  { t: 5.8, hip: [-10, 76], lean: 12, hF: [22, -12], hB: [-6, -30], fF: [50, 0], fB: [-50, 0], e: 'in' },
  { t: 5.98, x: 992, face: 1, hip: [-12, 86], lean: -8, hF: [-12, 34], hB: [-30, 12], fF: [40, 0], fB: [-44, 0], e: 'out' },
  // charges the arch
  { t: 6.1, x: 1004, hip: [-16, 78], lean: 0, hF: [-18, 34], hB: [-36, 12], fF: [46, 0], fB: [-50, 0] },
  { t: 6.24, x: 1040, p: 'bRun1', hF: [-24, 40], hB: [-40, 18], hop: 8, e: 'lin' },
  { t: 6.38, x: 1092, p: 'bRun2', hF: [-26, 48], hB: [-40, 26], hop: 8, e: 'lin' },
  { t: 6.52, x: 1130, hip: [-6, 86], lean: 2, hF: [-10, 62], hB: [-28, 40], fF: [50, 0], fB: [-46, 0] },
  { t: 6.62, x: 1140, hip: [6, 84], lean: 16, hF: [30, 62], hB: [6, 46], fF: [52, 0], fB: [-50, 0], e: 'in' },
  // the blow meant for A goes through the arch's leg
  { t: 6.72, x: 1150, hip: [16, 76], lean: 38, hF: [72, 14], hB: [44, 0], fF: [58, 0], fB: [-60, 0], e: 'in3' },
  { t: 6.8, same: true },
  { t: 6.92, x: 1176, hip: [22, 64], lean: 50, hF: [62, -26], hB: [36, -34], fF: [58, 0], fB: [-58, 0], e: 'out' },
  // hauls the hammer out of the rubble, up and back over his head as he comes on
  { t: 7.08, x: 1182, hip: [4, 74], lean: 30, tilt: -30, hF: [56, -20], hB: [30, -30], fF: [58, 0], fB: [-58, 0] },
  { t: 7.22, x: 1230, p: 'bRun1', hip: [-4, 84], lean: 8, hF: [20, 50], hB: [-4, 32], hop: 4, e: 'lin' },
  { t: 7.36, x: 1300, p: 'bRun2', hip: [-10, 86], lean: -6, hF: [-20, 56], hB: [-38, 34], hop: 4, e: 'lin' },
  // plants his feet, coils right back…
  { t: 7.52, x: 1380, hip: [-26, 76], lean: -22, tilt: 10, hF: [-44, 40], hB: [-58, 16], fF: [56, 0], fB: [-54, 0] },
  { t: 7.6, x: 1396, hip: [-28, 72], lean: -26, tilt: 14, hF: [-48, 36], hB: [-60, 12], fF: [56, 0], fB: [-54, 0] },
  // …and bats A clean off his feet
  { t: 7.7, x: 1450, hip: [14, 72], lean: 30, hF: [66, -14], hB: [40, -24], fF: [58, 0], fB: [-58, 0], e: 'in' },
  { t: 7.78, hip: [18, 64], lean: 42, hF: [62, -34], hB: [36, -42], fF: [58, 0], fB: [-58, 0], e: 'out' },
  { t: 7.92, x: 1444, hip: [-4, 84], lean: 8, hF: [30, 20], hB: [4, 2], fF: [50, 0], fB: [-52, 0] },
  // walks the hammer forward, stands it on its head…
  { t: 8.08, x: 1474, p: 'bRun1', hip: [-6, 84], lean: 4, hF: [-12, 46], hB: [-30, 24], hop: 4, e: 'lin' },
  { t: 8.22, x: 1540, p: 'bRun2', hip: [0, 84], lean: 8, hF: [-20, 40], hB: [-36, 20], hop: 4, e: 'lin' },
  { t: 8.36, x: 1566, hip: [-4, 84], lean: 6, hFw: [1545, 222], hB: [-20, 30], fF: [40, 0], fB: [-44, 0] },
  // …and takes a drum of the fallen column instead
  { t: 8.5, x: 1600, hip: [12, 52], lean: 52, bend: 12, hFw: [1696, 44], hBw: [1626, 48], fF: [50, 0], fB: [-52, 0] },
  { t: 8.66, hip: [0, 72], lean: 12, hF: [50, -6], hB: [-8, -4], fF: [50, 0], fB: [-52, 0], e: 'in' },
  { t: 8.8, hip: [-6, 90], lean: -8, hF: [36, 66], hB: [-30, 68], fF: [46, 0], fB: [-50, 0], e: 'out' },
  { t: 8.92, hip: [-18, 84], lean: -22, hF: [14, 74], hB: [-50, 58], fF: [44, 0], fB: [-52, 0] },
  { t: 9.0, hip: [14, 82], lean: 28, hF: [76, 34], hB: [60, 44], fF: [54, 0], fB: [-56, 0], e: 'snap' },
  { t: 9.1, hip: [18, 76], lean: 40, hF: [70, -10], hB: [50, -22], fF: [54, 0], fB: [-56, 0] },
  // snatches the hammer back up to meet the cut
  { t: 9.24, x: 1590, hip: [-8, 86], lean: -4, hFw: [1545, 222], hB: [-30, 20], fF: [40, 0], fB: [-46, 0] },
  { t: 9.42, hip: [-12, 74], lean: 10, hF: [0, 34], hB: [-24, 10], fF: [46, 0], fB: [-50, 0] },
  { t: 9.6, hip: [8, 90], lean: 4, hF: [34, 46], hB: [10, 26], fF: [50, 0], fB: [-54, 0], e: 'in3' },
  { t: 9.68, same: true },
  { t: 9.8, hip: [10, 80], lean: 20, hF: [50, 16], hB: [24, 0], fF: [50, 0], fB: [-54, 0] },
  { t: 9.92, x: 1620, hip: [4, 82], lean: 12, hF: [40, 30], hB: [16, 12], fF: [50, 0], fB: [-54, 0] },
  { t: 10.0, x: 1640, hip: [16, 80], lean: 30, hF: [74, 24], hB: [50, 10], fF: [54, 0], fB: [-56, 0], e: 'snap' },
  // hammer up and back… and down where A was standing
  { t: 10.12, x: 1632, hip: [-14, 84], lean: -10, hF: [-16, 52], hB: [-34, 30], fF: [48, 0], fB: [-50, 0] },
  { t: 10.26, x: 1640, hip: [-8, 90], lean: -4, hF: [0, 70], hB: [-20, 50], fF: [48, 0], fB: [-50, 0] },
  { t: 10.38, hip: [4, 86], lean: 14, hF: [30, 64], hB: [6, 46], fF: [50, 0], fB: [-52, 0], e: 'in' },
  { t: 10.5, x: 1650, hip: [22, 58], lean: 52, bend: 10, hF: [56, -40], hB: [30, -44], fF: [56, 0], fB: [-58, 0], e: 'in3' },
  { t: 10.58, same: true },
  { t: 10.72, hip: [12, 62], lean: 46, tilt: -24, hF: [56, -36], hB: [30, -42], fF: [56, 0], fB: [-58, 0] },
  { t: 10.84, hip: [-4, 80], lean: 10, hF: [44, 4], hB: [20, -14], fF: [54, 0], fB: [-56, 0], e: 'in' },
  // shaft up — takes the cut on it
  { t: 10.95, hip: [-10, 86], lean: -8, hF: [30, 46], hB: [8, 28], fF: [50, 0], fB: [-54, 0], e: 'snap' },
  { t: 11.02, same: true },
  { t: 11.14, hip: [-12, 76], lean: -4, hF: [28, 40], hB: [6, 22], fF: [50, 0], fB: [-56, 0] },
  { t: 11.26, x: 1664, hip: [10, 92], lean: 10, hF: [40, 66], hB: [16, 50], fF: [52, 0], fB: [-54, 0], e: 'snap' },
  // lets the head fall, drags it forward, scoops
  { t: 11.4, x: 1680, hip: [16, 70], lean: 40, hF: [60, -30], hB: [34, -36], fF: [54, 0], fB: [-56, 0], e: 'in' },
  { t: 11.56, x: 1740, p: 'bRun1', hip: [6, 72], lean: 30, hF: [56, -38], hB: [26, -42], hop: 4, e: 'lin' },
  { t: 11.7, x: 1800, p: 'bRun2', hip: [4, 70], lean: 32, hF: [30, -42], hB: [0, -44], hop: 4, e: 'lin' },
  { t: 11.8, x: 1822, hip: [-12, 60], lean: 40, hF: [-4, -46], hB: [-30, -40], fF: [56, 0], fB: [-54, 0] },
  { t: 11.9, x: 1840, hip: [14, 74], lean: 28, hF: [66, -30], hB: [40, -40], fF: [58, 0], fB: [-58, 0], e: 'in3' },
  { t: 12.0, hip: [6, 90], lean: 4, hF: [44, 50], hB: [20, 34], fF: [56, 0], fB: [-58, 0], e: 'out' },
  { t: 12.14, hip: [-10, 90], lean: -14, tilt: -30, hF: [6, 66], hB: [-14, 48], fF: [50, 0], fB: [-54, 0] },
  // lumbers after him
  { t: 12.3, x: 1890, p: 'bRun1', hip: [-4, 84], lean: 8, tilt: -24, hF: [-12, 46], hB: [-30, 24], hop: 4, e: 'lin' },
  { t: 12.46, x: 1960, p: 'bRun2', hip: [-4, 84], lean: 8, tilt: -30, hF: [-14, 46], hB: [-32, 24], hop: 4, e: 'lin' },
  { t: 12.62, x: 2030, p: 'bRun1', hip: [-4, 84], lean: 8, tilt: -36, hF: [-16, 44], hB: [-34, 22], hop: 4, e: 'lin' },
  { t: 12.78, x: 2100, p: 'bRun2', hip: [-4, 84], lean: 6, tilt: -40, hF: [-22, 40], hB: [-38, 18], hop: 4, e: 'lin' },
  { t: 12.94, x: 2122, hip: [-16, 74], lean: -6, tilt: -40, hF: [-30, 30], hB: [-46, 8], fF: [50, 0], fB: [-52, 0] },
  // swings up to meet him in the air
  { t: 13.1, x: 2130, hip: [8, 92], lean: 6, tilt: -20, hF: [40, 56], hB: [14, 36], fF: [52, 0], fB: [-54, 0], e: 'in3' },
  { t: 13.18, same: true },
  // driven back, down on a knee
  { t: 13.3, x: 2080, hip: [-14, 74], lean: -14, hF: [0, 50], hB: [-20, 30], fF: [50, 0], fB: [-54, 0], slide: true, e: 'out' },
  { t: 13.48, x: 2010, hip: [-10, 64], lean: 10, hF: [-34, 10], hB: [-46, -10], fF: [50, 0], fB: [-54, 0], slide: true, e: 'out' },
  { t: 13.66, x: 1985, hip: [0, 52], lean: 30, bend: 14, tilt: 10, hF: [-40, -34], hB: [-20, -46], fF: [40, 0], fB: [-44, 0], slide: true, e: 'out' },
  { t: 13.86, hip: [0, 56], lean: 24, bend: 10, tilt: 2, hF: [-40, -38], hB: [-20, -50], fF: [40, 0], fB: [-44, 0] },
  { t: 14.06, hip: [0, 52], lean: 32, bend: 15, tilt: 12, hF: [-40, -32], hB: [-20, -44], fF: [40, 0], fB: [-44, 0] },
  // up again; a huge swing at the runner — over his head
  { t: 14.22, hip: [0, 66], lean: 18, hF: [-38, -16], hB: [-30, -34], fF: [44, 0], fB: [-48, 0] },
  { t: 14.36, hip: [-12, 84], lean: -8, hF: [-14, 50], hB: [-34, 28], fF: [46, 0], fB: [-50, 0] },
  // sinks… and LEAPS, the hammer hauled up behind him
  { t: 14.46, hip: [2, 58], lean: 22, hF: [-20, 44], hB: [-40, 24], fF: [46, 0], fB: [-50, 0] },
  { t: 14.52, hip: [8, 92], lean: 8, hF: [-10, 66], hB: [-30, 46], fF: [30, 0], fB: [-44, 0], e: 'in' },
  ...flight(14.52, 15.0, [1985, 0], [2215, 0], 6000, [
    [14.66, { hip: [0, 84], lean: -14, tilt: 20, hF: [-30, 62], hB: [-46, 40], fF: [36, 30], fB: [-24, 44] }],
    [14.84, { hip: [0, 82], lean: 4, tilt: 24, hF: [-6, 74], hB: [-26, 56], fF: [44, 26], fB: [-14, 44] }],
  ], { hip: [20, 56], lean: 52, bend: 10, hF: [56, -40], hB: [32, -44], fF: [54, 0], fB: [-56, 0], e: 'in3' }),
  // comes down on nothing: the hammer buries itself in the fallen pillar
  { t: 15.08, same: true },
  { t: 15.2, hip: [6, 70], lean: 26, tilt: -30, hF: [40, -20], hB: [14, -30], fF: [54, 0], fB: [-56, 0] },
  // wrenches it out and round over his head as he turns, choking right up on the shaft…
  { t: 15.34, x: 2232, face: -1, hip: [-8, 88], lean: -6, hF: [-10, 60], hB: [-26, 40], fF: [34, 0], fB: [-40, 0] },
  { t: 15.46, x: 2250, hip: [-6, 84], lean: 0, hF: [40, 16], hB: [4, 30], fF: [40, 0], fB: [-44, 0], e: 'in' },
  // …and takes the point square on the hammer head
  { t: 15.52, x: 2272, hip: [-14, 80], lean: -8, tilt: -8, hF: [62, -24], hB: [10, -10], fF: [44, 0], fB: [-48, 0], e: 'snap' },
  { t: 15.6, same: true },
  { t: 15.76, x: 2170, hip: [0, 84], lean: 12, hF: [20, 50], hB: [-4, 30], fF: [50, 0], fB: [-46, 0], hop: 4 },
  { t: 15.92, x: 2040, hip: [-18, 74], lean: -14, hF: [-30, 30], hB: [-44, 8], fF: [48, 0], fB: [-52, 0] },
  { t: 16.08, x: 2046, hip: [0, 64], lean: 32, bend: 14, tilt: 10, hF: [-40, -40], hB: [-22, -50], fF: [50, 0], fB: [-52, 0] },
  { t: 16.3, hip: [0, 68], lean: 26, bend: 10, tilt: 2, hF: [-40, -44], hB: [-22, -54], fF: [50, 0], fB: [-52, 0] },
  { t: 16.48, hip: [-10, 78], lean: 8, hF: [-40, -16], hB: [-40, -34], fF: [50, 0], fB: [-52, 0], e: 'in' },
  { t: 16.66, x: 2034, hip: [-16, 84], lean: -10, hF: [-20, 52], hB: [-38, 30], fF: [48, 0], fB: [-52, 0] },
  { t: 16.8, x: 2018, hip: [-4, 86], lean: 6, hF: [-6, 60], hB: [-24, 38], fF: [52, 0], fB: [-48, 0] },
  { t: 16.9, x: 2010, hip: [12, 76], lean: 30, hF: [56, 34], hB: [30, 10], fF: [54, 0], fB: [-50, 0], e: 'snap' },
  { t: 16.98, same: true },
  // still the stronger: walks A backwards
  { t: 17.14, x: 1980, hip: [16, 72], lean: 36, hF: [56, 34], hB: [30, 10], fF: [40, 0], fB: [-62, 0], e: 'lin', er: 'lin' },
  { t: 17.3, x: 1930, hip: [16, 72], lean: 38, hF: [56, 32], hB: [30, 8], fF: [60, 0], fB: [-42, 0], e: 'lin', er: 'lin' },
  { t: 17.42, x: 1895, hip: [18, 70], lean: 40, hF: [56, 30], hB: [30, 6], fF: [44, 0], fB: [-60, 0], e: 'out' },
  { t: 17.5, x: 1904, hip: [-12, 84], lean: -8, hF: [30, 50], hB: [6, 30], fF: [48, 0], fB: [-52, 0], e: 'snap' },
  { t: 17.62, x: 1906, hip: [-18, 84], lean: -16, hF: [-20, 56], hB: [-38, 34], fF: [48, 0], fB: [-52, 0] },
  { t: T_MEGA, x: 1890, hip: [12, 76], lean: 30, hF: [56, 34], hB: [30, 10], fF: [54, 0], fB: [-50, 0], e: 'in3' },
  { t: 17.85, same: true },
  { t: 18.0, x: 1970, hip: [-18, 74], lean: -18, tilt: -14, hF: [-6, 50], hB: [-26, 28], fF: [48, 0], fB: [-52, 0], slide: true, e: 'out' },
  { t: 18.2, x: 2070, hip: [-10, 62], lean: 10, hF: [-36, 4], hB: [-46, -14], fF: [48, 0], fB: [-52, 0], slide: true, e: 'out' },
  { t: 18.4, x: 2110, hip: [0, 52], lean: 32, bend: 14, tilt: 12, hF: [-40, -36], hB: [-22, -48], fF: [40, 0], fB: [-46, 0], slide: true, e: 'out' },
  { t: 18.66, hip: [0, 56], lean: 26, bend: 10, tilt: 4, hF: [-40, -40], hB: [-22, -52], fF: [40, 0], fB: [-46, 0] },
  { t: 18.9, hip: [0, 52], lean: 34, bend: 16, tilt: 14, hF: [-40, -34], hB: [-22, -46], fF: [40, 0], fB: [-46, 0] },
  { t: 19.14, hip: [0, 56], lean: 26, bend: 10, tilt: -12, hF: [-40, -40], hB: [-22, -52], fF: [40, 0], fB: [-46, 0] },
  { t: 19.4, hip: [-4, 68], lean: 14, hF: [-42, -22], hB: [-36, -38], fF: [46, 0], fB: [-50, 0] },
  { t: 19.7, hip: [-14, 80], lean: -6, hF: [-44, 12], hB: [-52, -8], fF: [48, 0], fB: [-52, 0] },
  { t: 20.0, hip: [-24, 76], lean: -18, hF: [-44, 40], hB: [-56, 16], fF: [50, 0], fB: [-54, 0] },
  { t: 20.3, hip: [-25, 74], lean: -19, hF: [-45, 41], hB: [-56, 16], fF: [50, 0], fB: [-54, 0] },
  { t: 20.6, hip: [-24, 76], lean: -18, hF: [-44, 40], hB: [-56, 16], fF: [50, 0], fB: [-54, 0] },
  { t: 20.9, hip: [-27, 71], lean: -21, hF: [-46, 38], hB: [-58, 14], fF: [50, 0], fB: [-54, 0] },
  { t: 21.04, x: 2076, p: 'bRun1', hF: [-40, 44], hB: [-54, 20], hop: 8, e: 'lin' },
  { t: 21.2, x: 2020, p: 'bRun2', hF: [-38, 48], hB: [-52, 24], hop: 8, e: 'lin' },
  { t: 21.36, x: 1964, p: 'bRun1', hF: [-34, 52], hB: [-48, 28], hop: 8, e: 'lin' },
  { t: 21.5, x: 1930, hip: [-10, 84], lean: -6, hF: [-28, 58], hB: [-44, 36], fF: [50, 0], fB: [-48, 0] },
  // slow motion: the swing
  { t: 22.1, x: 1920, hip: [-6, 86], lean: 0, hF: [-14, 66], hB: [-32, 44], fF: [52, 0], fB: [-50, 0], e: 'lin', er: 'lin' },
  { t: 22.7, x: 1908, hip: [2, 84], lean: 10, hF: [10, 68], hB: [-10, 48], fF: [54, 0], fB: [-52, 0], e: 'lin', er: 'lin' },
  { t: 23.2, x: 1896, hip: [10, 78], lean: 24, hF: [44, 46], hB: [20, 24], fF: [56, 0], fB: [-54, 0], e: 'lin', er: 'lin' },
  { t: T_CLASH, x: 1892, hip: [12, 76], lean: 30, hF: [56, 34], hB: [30, 10], fF: [56, 0], fB: [-54, 0], e: 'in', er: 'lin' },
  { t: T_SHATTER, same: true },
  { t: 23.62, x: 2140, y: 120, p: 'flyBack', lean: -50, tilt: -20, hF: [60, 30], hB: [56, 10], e: 'out', er: 'lin' },
  { t: 24.0, x: 2760, y: 210, p: 'flyBack', lean: -66, tilt: -24, hF: [64, 36], hB: [58, 14], e: 'lin', er: 'lin' },
  { t: 25, x: 5000, y: 260, p: 'flyBack', lean: -70, hF: [64, 36], hB: [58, 14], e: 'lin', er: 'lin' },
];
S.fighters({ A: A_KEYS, B: B_KEYS });

S.weapon('gs', [
  { t: 0, type: 'greatsword', by: 'A', ang: 62, two: 1, scale: 1 },
  { t: 0.6, by: 'A', ang: 60 },
  { t: 0.68, by: 'A', ang: 76, e: 'snap' },
  { t: 0.86, by: 'A', ang: 38 },
  { t: 1.02, by: 'A', ang: 8 },
  { t: 1.2, by: 'A', ang: -42, scale: 1, e: 'in' },
  { t: T_GROW + 0.02, by: 'A', ang: -42, scale: 1, ink: 1 },
  { t: 1.56, by: 'A', ang: 8, scale: 1.35, e: 'in' },
  { t: 1.7, by: 'A', ang: 86, scale: SW, e: 'out' },
  { t: 1.88, by: 'A', ang: 62 },
  { t: 2.06, by: 'A', ang: 70 },
  { t: 2.2, by: 'A', ang: 92, g: 0.2 },
  { t: 2.34, by: 'A', ang: 96, g: 0.28, e: 'in' },
  { t: 2.5, by: 'A', ang: 97 },
  { t: 2.6, by: 'A', ang: 99, e: 'snap' },
  { t: 2.68, by: 'A', ang: 99 },
  { t: 2.84, by: 'A', ang: 106, e: 'out' },
  { t: 2.96, by: 'A', ang: 138, g: 0.16 },
  { t: 3.08, by: 'A', ang: 172, g: 0.1, e: 'in' },
  { t: 3.2, by: 'A', ang: 176 },
  { t: 3.32, by: 'A', ang: 186 },
  { t: 3.48, by: 'A', ang: 186 },
  { t: 3.64, by: 'A', ang: 150 },
  { t: 3.74, by: 'A', ang: 146 },
  { t: 3.84, by: 'A', ang: 140 },
  { t: 3.9, by: 'A', ang: 128 },
  { t: 4.02, by: 'A', ang: 110, e: 'lin' },
  { t: 4.14, by: 'A', ang: 88, e: 'lin' },
  { t: 4.26, by: 'A', ang: 62, e: 'lin' },
  { t: 4.34, by: 'A', ang: 70 },
  { t: 4.44, by: 'A', ang: 162, e: 'in3' },
  { t: 4.8, by: 'A', ang: 162 },
  { t: 4.96, by: 'A', ang: 175 },
  { t: 5.08, by: 'A', ang: 168, e: 'snap' },
  { t: 5.2, by: 'A', ang: 184 },
  { t: 5.32, by: 'A', ang: 194 },
  { t: 5.44, by: 'A', ang: 192, e: 'in' },
  { t: 5.62, by: 'A', ang: 191 },
  { t: 5.82, by: 'A', ang: 160 },
  { t: 6.02, by: 'A', ang: 124 },
  { t: 6.3, by: 'A', ang: 122 },
  { t: 6.5, by: 'A', ang: 116 },
  { t: 6.66, by: 'A', ang: 106 },
  { t: 6.74, by: 'A', ang: 102 },
  { t: 6.88, by: 'A', ang: 189, e: 'in' },
  { t: 7.0, by: 'A', ang: 188 },
  { t: 7.1, by: 'A', ang: 100, e: 'snap' },
  { t: 7.16, by: 'A', ang: 94 },
  { t: 7.28, by: 'A', ang: 40 },
  { t: 7.4, by: 'A', ang: 2 },
  { t: 7.5, by: 'A', ang: -11, e: 'in' },
  { t: 7.62, by: 'A', ang: 66, e: 'out' },
  { t: 7.7, by: 'A', ang: 84 },
  { t: 7.76, by: 'A', ang: 86 },
  { t: 7.9, by: 'A', ang: 150, e: 'lin' },
  { t: 8.04, by: 'A', ang: 172, e: 'lin' },
  { t: 8.15, by: 'A', ang: 186 },
  { t: 8.3, by: 'A', ang: 150 },
  { t: 8.5, by: 'A', ang: 56 },
  { t: 8.7, by: 'A', ang: 48 },
  { t: 8.9, by: 'A', ang: 54 },
  { t: 9.06, by: 'A', ang: 50 },
  { t: 9.14, by: 'A', ang: 66 },
  { t: 9.2, by: 'A', ang: 165, e: 'snap' },
  { t: 9.26, by: 'A', ang: 172 },
  { t: 9.34, by: 'A', ang: 112 },
  { t: 9.42, by: 'A', ang: 80 },
  { t: 9.52, by: 'A', ang: 72 },
  { t: 9.6, by: 'A', ang: 170, e: 'snap' },
  { t: 9.68, by: 'A', ang: 168 },
  { t: 9.8, by: 'A', ang: 132 },
  { t: 9.92, by: 'A', ang: 140 },
  { t: 10.0, by: 'A', ang: 120, e: 'snap' },
  { t: 10.12, by: 'A', ang: 128 },
  { t: 10.3, by: 'A', ang: 134 },
  { t: 10.42, by: 'A', ang: 120 },
  { t: 10.54, by: 'A', ang: 128 },
  { t: 10.66, by: 'A', ang: 62 },
  { t: 10.8, by: 'A', ang: 56 },
  { t: 10.95, by: 'A', ang: 165, e: 'in3' },
  { t: 11.14, by: 'A', ang: 166 },
  { t: 11.26, by: 'A', ang: 62, e: 'snap' },
  { t: 11.4, by: 'A', ang: 20 },
  { t: 11.52, by: 'A', ang: -10, e: 'in' },
  { t: 11.64, by: 'A', ang: 60 },
  { t: 11.72, by: 'A', ang: 100 },
  { t: 11.82, by: 'A', ang: 118 },
  { t: 11.9, by: 'A', ang: 130 },
  { t: 12.02, by: 'A', ang: 70, e: 'lin' },
  { t: 12.14, by: 'A', ang: -70, e: 'lin' },
  { t: 12.26, by: 'A', ang: -200, e: 'lin' },
  { t: 12.35, by: 'A', ang: -230, e: 'lin' },
  { t: 12.5, by: 'A', ang: -264 },
  { t: 12.64, by: 'A', ang: -308 },
  { t: 12.74, by: 'A', ang: -300 },
  { t: 12.92, by: 'A', ang: -278 },
  { t: 13.1, by: 'A', ang: -163, e: 'in3' },
  { t: 13.18, by: 'A', ang: -165 },
  { t: 13.32, by: 'A', ang: -236, e: 'out' },
  { t: 13.46, by: 'A', ang: -290 },
  { t: 13.6, by: 'A', ang: -369, e: 'in' },
  { t: 14.06, by: 'A', ang: -369 },
  { t: 14.18, by: 'A', ang: -372 },
  { t: 14.42, by: 'A', ang: -372 },
  { t: 14.6, by: 'A', ang: -366 },
  { t: 15.0, by: 'A', ang: -365 },
  { t: 15.1, by: 'A', ang: -362 },
  { t: 15.22, by: 'A', ang: -358 },
  { t: 15.38, by: 'A', ang: -360 },
  { t: 15.52, by: 'A', ang: -360, e: 'in3' },
  { t: 15.6, by: 'A', ang: -360 },
  { t: 15.74, by: 'A', ang: -305, e: 'out' },
  { t: 15.9, by: 'A', ang: -206 },
  { t: 16.06, by: 'A', ang: -171, e: 'in' },
  { t: 16.28, by: 'A', ang: -171 },
  { t: 16.46, by: 'A', ang: -186 },
  { t: 16.64, by: 'A', ang: -230 },
  { t: 16.78, by: 'A', ang: -238 },
  { t: 16.9, by: 'A', ang: -308, e: 'snap' },
  { t: 17.42, by: 'A', ang: -306 },
  { t: 17.5, by: 'A', ang: -276, e: 'snap' },
  { t: 17.62, by: 'A', ang: -220 },
  { t: T_MEGA, by: 'A', ang: -310, e: 'in3' },
  { t: 17.85, by: 'A', ang: -308 },
  { t: 18.0, by: 'A', ang: -256, e: 'out' },
  { t: 18.2, by: 'A', ang: -200 },
  { t: 18.4, by: 'A', ang: -172, e: 'in' },
  { t: 19.14, by: 'A', ang: -172, scale: SW },
  { t: 19.4, by: 'A', ang: -178, scale: 1.8 },
  { t: 19.7, by: 'A', ang: -194, scale: 1.95 },
  { t: 20.0, by: 'A', ang: -208, scale: 2.05 },
  { t: 20.9, by: 'A', ang: -206 },
  { t: 21.3, by: 'A', ang: -210 },
  { t: 21.42, by: 'A', ang: -214 },
  { t: 21.5, by: 'A', ang: -220 },
  { t: 22.1, by: 'A', ang: -232, e: 'lin' },
  { t: 22.7, by: 'A', ang: -260, e: 'lin' },
  { t: 23.2, by: 'A', ang: -298, e: 'lin' },
  { t: T_CLASH, by: 'A', ang: -310, e: 'in' },
  { t: T_SHATTER, gone: true },
]);
S.weapon('hm', [
  { t: 0, type: 'hammer', by: 'B', ang: 118, two: 1, scale: 1 },
  { t: 0.6, by: 'B', ang: 120 },
  { t: 0.68, by: 'B', ang: 104, e: 'snap' },
  { t: 0.86, by: 'B', ang: 150 },
  { t: 1.02, by: 'B', ang: 182 },
  { t: 1.2, by: 'B', ang: 213, scale: 1, e: 'in' },
  { t: T_GROW_B + 0.02, by: 'B', ang: 213, scale: 1, ink: 1 },
  { t: 2.02, by: 'B', ang: 158, scale: 1.55, e: 'in' },
  { t: 2.12, by: 'B', ang: 76, scale: HM, e: 'out' },
  { t: 2.28, by: 'B', ang: 184.5, e: 'in3' },
  { t: 2.5, by: 'B', ang: 184.5, e: 'lin' },
  { t: 2.6, by: 'B', ang: 184.5, g: 0.26 },
  { t: 2.68, by: 'B', ang: 184.5 },
  { t: 2.84, by: 'B', ang: 96, g: 0.3, e: 'in' },
  { t: 2.98, by: 'B', ang: 24 },
  { t: 3.12, by: 'B', ang: 68, e: 'lin' },
  { t: 3.26, by: 'B', ang: 118, e: 'lin', g: 0.28 },
  { t: 3.4, by: 'B', ang: 178, g: 0.24, e: 'in3' },
  { t: 3.5, by: 'B', ang: 178 },
  { t: 3.64, by: 'B', ang: 183 },
  { t: 3.86, by: 'B', ang: 184 },
  { t: 3.9, at: [760, 148], ang: 184 },
  { t: 4.12, at: [860, 40], ang: 170, e: 'in' },
  { t: 5.62, by: 'B', ang: 170, g: 0.3, two: 1 },
  { t: 5.8, by: 'B', ang: 150, e: 'in' },
  { t: 5.98, by: 'B', ang: 104, e: 'out' },
  { t: 6.1, by: 'B', ang: 112 },
  { t: 6.24, by: 'B', ang: 118, e: 'lin' },
  { t: 6.38, by: 'B', ang: 122, e: 'lin' },
  { t: 6.52, by: 'B', ang: 112 },
  { t: 6.62, by: 'B', ang: 70, g: 0.27, e: 'in' },
  { t: 6.72, by: 'B', ang: 15, g: 0.24, e: 'in3' },
  { t: 6.8, by: 'B', ang: 13 },
  { t: 6.92, by: 'B', ang: 3, e: 'out' },
  { t: 7.08, by: 'B', ang: 14 },
  { t: 7.22, by: 'B', ang: 78, g: 0.3, e: 'lin' },
  { t: 7.36, by: 'B', ang: 132, e: 'lin' },
  { t: 7.52, by: 'B', ang: 158, e: 'out' },
  { t: 7.6, by: 'B', ang: 163 },
  { t: 7.7, by: 'B', ang: 8, g: 0.24, e: 'in3' },
  { t: 7.78, by: 'B', ang: -6, e: 'out' },
  { t: 7.92, by: 'B', ang: 50, g: 0.3 },
  { t: 8.08, by: 'B', ang: 102, g: 0.3 },
  { t: 8.22, by: 'B', ang: 160, g: 0.4, e: 'lin' },
  { t: 8.36, by: 'B', ang: 270, g: 0.45, e: 'lin' },
  { t: 8.4, at: [1545, 202], ang: 270 },
  { t: 9.24, by: 'B', ang: 270, g: 0.45, two: 1 },
  { t: 9.42, by: 'B', ang: 332 },
  { t: 9.6, by: 'B', ang: 425, e: 'in3' },
  { t: 9.68, by: 'B', ang: 423 },
  { t: 9.8, by: 'B', ang: 400, g: 0.4 },
  { t: 9.92, by: 'B', ang: 396 },
  { t: 10.0, by: 'B', ang: 392, g: 0.35, e: 'snap' },
  { t: 10.12, by: 'B', ang: 470, g: 0.3 },
  { t: 10.26, by: 'B', ang: 458 },
  { t: 10.38, by: 'B', ang: 425, e: 'in' },
  { t: 10.5, by: 'B', ang: 363, g: 0.26, e: 'in3' },
  { t: 10.72, by: 'B', ang: 363 },
  { t: 10.84, by: 'B', ang: 385, e: 'in' },
  { t: 10.95, by: 'B', ang: 425, g: 0.3, e: 'snap' },
  { t: 11.14, by: 'B', ang: 420 },
  { t: 11.26, by: 'B', ang: 442, e: 'snap' },
  { t: 11.4, by: 'B', ang: 363, g: 0.24, e: 'in' },
  { t: 11.8, by: 'B', ang: 363 },
  { t: 11.9, by: 'B', ang: 366, e: 'in3' },
  { t: 12.0, by: 'B', ang: 410, e: 'out' },
  { t: 12.14, by: 'B', ang: 452, g: 0.3 },
  { t: 12.3, by: 'B', ang: 465 },
  { t: 12.78, by: 'B', ang: 466 },
  { t: 12.94, by: 'B', ang: 500 },
  { t: 13.1, by: 'B', ang: 415, e: 'in3' },
  { t: 13.18, by: 'B', ang: 413 },
  { t: 13.3, by: 'B', ang: 468, e: 'out' },
  { t: 13.48, by: 'B', ang: 516 },
  { t: 13.66, by: 'B', ang: 539, e: 'in' },
  { t: 14.06, by: 'B', ang: 539 },
  { t: 14.22, by: 'B', ang: 530 },
  { t: 14.36, by: 'B', ang: 494 },
  { t: 14.46, by: 'B', ang: 496 },
  { t: 14.52, by: 'B', ang: 504 },
  { t: 14.66, by: 'B', ang: 512, e: 'lin' },
  { t: 14.84, by: 'B', ang: 476, e: 'lin' },
  { t: 15, by: 'B', ang: 364, g: 0.26, e: 'in3' },
  { t: 15.08, by: 'B', ang: 364 },
  { t: 15.2, by: 'B', ang: 372, g: 0.3 },
  { t: 15.34, by: 'B', ang: 450, g: 0.55 },
  { t: 15.46, by: 'B', ang: 524, g: 0.58, e: 'in' },
  { t: 15.52, by: 'B', ang: 540, g: 0.62, e: 'snap' },
  { t: 15.6, by: 'B', ang: 540 },
  { t: 15.76, by: 'B', ang: 470, g: 0.5, e: 'out' },
  { t: 15.92, by: 'B', ang: 396, g: 0.3 },
  { t: 16.08, by: 'B', ang: 362, e: 'in' },
  { t: 16.3, by: 'B', ang: 362 },
  { t: 16.48, by: 'B', ang: 378 },
  { t: 16.66, by: 'B', ang: 402 },
  { t: 16.8, by: 'B', ang: 420 },
  { t: 16.9, by: 'B', ang: 485, e: 'snap' },
  { t: 17.42, by: 'B', ang: 483 },
  { t: 17.5, by: 'B', ang: 456, e: 'snap' },
  { t: 17.62, by: 'B', ang: 400 },
  { t: T_MEGA, by: 'B', ang: 485, e: 'in3' },
  { t: 17.85, by: 'B', ang: 483 },
  { t: 18.0, by: 'B', ang: 438, e: 'out' },
  { t: 18.2, by: 'B', ang: 388 },
  { t: 18.4, by: 'B', ang: 362, e: 'in' },
  { t: 19.14, by: 'B', ang: 362, scale: HM },
  { t: 19.4, by: 'B', ang: 364, scale: 2.0 },
  { t: 19.7, by: 'B', ang: 376, scale: 2.15 },
  { t: 20.0, by: 'B', ang: 393, scale: 2.3 },
  { t: 20.9, by: 'B', ang: 391 },
  { t: 21.36, by: 'B', ang: 394 },
  { t: 21.5, by: 'B', ang: 396 },
  { t: 22.1, by: 'B', ang: 410, e: 'lin' },
  { t: 22.7, by: 'B', ang: 440, e: 'lin' },
  { t: 23.2, by: 'B', ang: 475, e: 'lin' },
  { t: T_CLASH, by: 'B', ang: 485, e: 'in' },
  { t: T_SHATTER, gone: true },
]);

S.camera([
  // locked in the ink: tight on the two of them
  { t: 0, x: 1105, y: -175, z: 1.5 },
  { t: 0.62, x: 1105, y: -170, z: 1.72, e: 'lin' },
  { t: 1.02, x: 1105, y: -185, z: 1.3, e: 'out' },            // they skid apart — the only wide of the opening
  // A's sword drinks the ink
  { t: 1.14, x: 950, y: -105, z: 2.1, e: 'io' },
  { t: 1.42, x: 960, y: -100, z: 2.35, r: -3, e: 'lin' },
  { t: 1.5, x: 950, y: -120, z: 2.2, r: -3 },
  { t: 1.7, x: 880, y: -250, z: 1.75, r: 4, e: 'out' },        // tilts up the grown blade
  // whip to B's hammer
  { t: 1.74, x: 890, y: -240, z: 1.75, r: 4 },
  { t: 1.86, x: 1285, y: -100, z: 2.2, r: 3, e: 'out' },
  { t: 1.94, x: 1290, y: -100, z: 2.3, r: 3, e: 'lin' },
  { t: 2.12, x: 1330, y: -240, z: 1.7, r: -3, e: 'out' },
  // the plough
  { t: 2.3, a: 0.5, b: 0.5, y: -165, z: 1.5, r: 0, e: 'out' },
  { t: 2.57, a: 0.5, b: 0.5, x: -50, y: -130, z: 1.75, e: 'lin' },
  { t: 2.63, a: 0.5, b: 0.5, x: -70, y: -125, z: 2.05, e: 'snap' },
  { t: 2.96, a: 0.5, b: 0.5, y: -200, z: 1.45, e: 'out' },
  // the pillar
  { t: 3.3, x: 880, y: -170, z: 1.5 },
  { t: 3.37, x: 850, y: -170, z: 1.5 },
  { t: 3.44, x: 800, y: -170, z: 1.75, e: 'snap' },
  { t: 3.66, a: 1, x: 60, y: -225, z: 1.8 },                   // A up on the shaft
  { t: 3.9, a: 1, x: 40, y: -250, z: 1.8 },
  { t: 4.26, a: 0.6, b: 0.4, y: -215, z: 1.55 },
  { t: 4.4, a: 0.5, b: 0.5, y: -210, z: 1.6 },
  // the blade caught between B's fists
  { t: 4.46, x: 1185, y: -200, z: 1.95, e: 'snap' },
  { t: 4.9, x: 1190, y: -190, z: 2.2, r: 4, e: 'lin' },
  { t: 5.08, x: 1230, y: -190, z: 2.05, r: 0 },
  { t: 5.42, a: 1, x: -120, y: -170, z: 1.45, e: 'out' },      // whips right with A
  { t: 5.62, a: 1, x: -110, y: -125, z: 1.85 },                // A braking, the blade ploughing the floor
  // whip back to B hauling the hammer up
  { t: 5.68, a: 1, x: -110, y: -125, z: 1.85 },
  { t: 5.84, b: 1, x: -50, y: -150, z: 1.75, e: 'out' },
  { t: 6.02, b: 1, x: 40, y: -210, z: 1.7 },
  { t: 6.34, a: 0.5, b: 0.5, y: -215, z: 1.38 },               // the charge
  { t: 6.68, a: 0.5, b: 0.5, x: 30, y: -230, z: 1.45 },
  { t: 6.75, a: 0.5, b: 0.5, x: 40, y: -230, z: 1.7, e: 'snap' },
  { t: 7.05, x: 1590, y: -280, z: 1.28 },                      // the arch comes down
  { t: 7.13, x: 1620, y: -300, z: 1.45, e: 'snap' },
  { t: 7.36, a: 0.35, b: 0.65, y: -230, z: 1.5 },              // B winds up
  { t: 7.62, a: 0.4, b: 0.6, y: -215, z: 1.65, r: -3, e: 'lin' },
  { t: 7.68, a: 0.5, b: 0.5, y: -200, z: 1.6, r: 0 },
  { t: 7.74, a: 0.6, b: 0.4, y: -200, z: 1.95, e: 'snap' },
  { t: 8.15, a: 1, x: -90, y: -170, z: 1.35, e: 'out' },       // whips through the arch with A
  { t: 8.42, a: 1, x: -60, y: -190, z: 1.6 },
  // whip back: B takes a drum of the column
  { t: 8.46, a: 1, x: -60, y: -190, z: 1.6 },
  { t: 8.62, a: 0.3, b: 0.7, y: -215, z: 1.42, e: 'out' },
  { t: 8.9, a: 0.35, b: 0.65, y: -250, z: 1.42 },
  { t: 9.14, a: 0.5, b: 0.5, y: -300, z: 1.3, e: 'out' },      // follows the throw
  { t: 9.23, a: 0.6, b: 0.4, y: -330, z: 1.5, e: 'snap' },
  { t: 9.56, a: 0.5, b: 0.5, y: -330, z: 1.5 },
  { t: 9.63, a: 0.5, b: 0.5, y: -340, z: 1.85, e: 'snap' },
  { t: 10.0, a: 0.5, b: 0.5, y: -210, z: 1.65, e: 'out' },
  { t: 10.3, a: 0.5, b: 0.5, y: -225, z: 1.45 },
  { t: 10.47, a: 0.5, b: 0.5, x: 30, y: -200, z: 1.4 },
  { t: 10.53, a: 0.5, b: 0.5, x: 60, y: -170, z: 1.65, e: 'snap' },
  { t: 10.9, a: 0.5, b: 0.5, y: -225, z: 1.55 },
  { t: 10.98, a: 0.5, b: 0.5, x: -60, y: -230, z: 1.85, e: 'snap' },
  { t: 11.3, a: 0.5, b: 0.5, y: -230, z: 1.5, r: 3 },
  { t: 11.7, a: 0.6, b: 0.4, y: -190, z: 1.55, r: 0 },
  { t: 11.9, a: 0.7, b: 0.3, y: -230, z: 1.5 },
  { t: 12.35, a: 0.75, b: 0.25, y: -430, z: 1.25, e: 'out' },  // up with A onto the pillar
  { t: 12.6, a: 1, x: -70, y: -520, z: 1.85, r: -5 },          // low angle: A against the storm
  { t: 12.76, a: 1, x: -110, y: -510, z: 1.8, r: -5 },
  { t: 13.07, a: 0.5, b: 0.5, y: -400, z: 1.3, r: 0, e: 'in' },
  { t: 13.13, a: 0.5, b: 0.5, y: -410, z: 1.6, e: 'snap' },
  { t: 13.56, a: 0.5, b: 0.5, y: -190, z: 1.4, e: 'out' },
  // spent: close on B, whip to A
  { t: 13.74, b: 1, x: -30, y: -115, z: 2.2, r: 3 },
  { t: 13.92, b: 1, x: -40, y: -115, z: 2.3, r: 3, e: 'lin' },
  { t: 14.06, a: 1, x: 50, y: -115, z: 2.3, r: -3, e: 'out' },
  { t: 14.22, a: 1, x: 30, y: -125, z: 2.2, r: -3, e: 'lin' },
  { t: 14.46, a: 0.5, b: 0.5, y: -205, z: 1.4, r: 0, e: 'out' },
  { t: 14.66, a: 0.5, b: 0.5, y: -215, z: 1.62 },              // the slide under the leap
  { t: 14.97, a: 0.4, b: 0.6, y: -180, z: 1.3 },
  { t: 15.03, a: 0.4, b: 0.6, x: 40, y: -160, z: 1.5, e: 'snap' },
  { t: 15.3, a: 0.5, b: 0.5, y: -160, z: 1.55 },
  { t: 15.49, a: 0.5, b: 0.5, x: 30, y: -155, z: 1.65, e: 'lin' },
  { t: 15.55, a: 0.45, b: 0.55, y: -150, z: 1.85, e: 'snap' },    // the point stopped on the hammer head
  { t: 15.9, a: 0.5, b: 0.5, y: -170, z: 1.6, e: 'out' },
  { t: 16.44, a: 0.5, b: 0.5, y: -140, z: 1.95, r: 3, e: 'lin' }, // both heaving, weapons on the floor behind them
  { t: 16.7, a: 0.5, b: 0.5, y: -215, z: 1.55, r: 0 },
  { t: 16.87, a: 0.5, b: 0.5, y: -230, z: 1.55 },
  { t: 16.93, a: 0.5, b: 0.5, y: -230, z: 1.8, e: 'snap' },
  { t: 17.4, a: 0.5, b: 0.5, y: -195, z: 2.1, r: 5, e: 'lin' },   // tight on the grind
  { t: 17.6, a: 0.5, b: 0.5, y: -235, z: 1.5, r: 0 },
  { t: T_MEGA - 0.03, a: 0.5, b: 0.5, y: -235, z: 1.5 },
  { t: T_MEGA + 0.03, a: 0.5, b: 0.5, y: -235, z: 1.85, e: 'snap' },
  { t: 18.3, x: 1750, y: -230, z: 1.12, e: 'out' },               // one look at what is left of the arena
  // down on a knee: close on A, whip to B
  { t: 18.5, x: 1750, y: -225, z: 1.14 },
  { t: 18.68, a: 1, x: 10, y: -115, z: 2.2, r: -3, e: 'io' },
  { t: 18.9, a: 1, x: 0, y: -115, z: 2.3, r: -3, e: 'lin' },
  { t: 19.04, b: 1, x: 10, y: -120, z: 2.25, r: 3, e: 'out' },
  { t: 19.26, b: 1, x: 0, y: -120, z: 2.3, r: 3, e: 'lin' },
  { t: 19.6, x: 1750, y: -215, z: 1.32, r: 0, e: 'io' },          // they rise; the weapons swell
  { t: 20.0, x: 1750, y: -250, z: 1.3 },
  // the held breath: up A's blade, whip, up B's hammer
  { t: 20.14, a: 1, x: -40, y: -200, z: 2.0, r: -6, e: 'out' },
  { t: 20.4, a: 1, x: -50, y: -210, z: 2.15, r: -7, e: 'lin' },
  { t: 20.52, b: 1, x: 50, y: -200, z: 2.0, r: 6, e: 'out' },
  { t: 20.8, b: 1, x: 60, y: -210, z: 2.15, r: 7, e: 'lin' },
  { t: 20.96, x: 1750, y: -215, z: 1.3, r: 0, e: 'out' },         // go
  { t: 21.5, x: 1748, y: -220, z: 1.6 },
  { t: 23.24, x: 1736, y: -262, z: 2.1, r: -5, e: 'lin' },        // slow motion: closing on the point of contact
  { t: T_CLASH + 0.05, x: 1733, y: -285, z: 1.2, r: 0, e: 'snap' },
  { t: 24.3, x: 1733, y: -280, z: 0.85, e: 'out' },
  { t: 25, x: 1733, y: -280, z: 0.85 },
]);

// ═════════════════════════════════════════════════════════════════════════════
// CONTACTS, EFFECTS, SOUND
// ═════════════════════════════════════════════════════════════════════════════
// storm beds
S.cue({ t: 0.02, type: 'wind', dur: 8.6, gain: 0.9 });
S.cue({ t: 8.4, type: 'wind', dur: 8.6, gain: 0.9 });
S.cue({ t: 16.8, type: 'wind', dur: 6.5, gain: 1.0 });
S.cue({ t: 0.05, type: 'rumble', dur: 1.4, x: 1105 });

// 0:00 — the ink parts; they shove apart
S.cue({ t: 0.5, type: 'inksplash', weight: 0.9, x: 1105 });
S.hit({ t: 0.64, x: 1085, h: 180, size: 0.9, sound: 'clang', weight: 0.6 });
S.skid({ t0: 0.68, t1: 1.02, x0: 1010, x1: 780 });
S.skid({ t0: 0.68, t1: 1.02, x0: 1200, x1: 1430, sound: false });
S.fx({ t: 0.7, type: 'dust', x: 1000, n: 5, size: 0.9, dir: -1 });
S.fx({ t: 0.7, type: 'dust', x: 1210, n: 5, size: 1.0, dir: 1 });
// the weapons drink the ink and grow
S.cue({ t: 1.06, type: 'draw', dur: 0.36, x: 1000 });
S.cue({ t: 1.12, type: 'riser', dur: 0.3 });
S.cue({ t: T_GROW, type: 'thunder', x: 960 });
S.shake(T_GROW, 14, 0.4);
S.fx({ t: T_GROW + 0.05, type: 'splash', x: 1060, h: 10, n: 14, size: 1.1, dir: 0 });
S.cue({ t: 1.5, type: 'shing', dur: 0.4, x: 860 });
S.whoosh({ t: 1.54, x: 880, size: 'l' });
S.cue({ t: 1.52, type: 'draw', dur: 0.38, x: 1260 });
S.cue({ t: T_GROW_B, type: 'thunder', x: 1260, gain: 0.85 });
S.shake(T_GROW_B, 14, 0.4);
S.fx({ t: T_GROW_B + 0.05, type: 'splash', x: 1240, h: 10, n: 14, size: 1.1, dir: 0 });
S.whoosh({ t: 1.98, x: 1360, size: 'l', heavy: true });
// first clash: the hammer ploughed along the floor into the sword, stood upright like a post
S.step({ t: 2.2, x: 838, weight: 0.4 });
S.whoosh({ t: 2.16, x: 1300, size: 'l', heavy: true });
S.hit({ t: 2.28, x: 1000, h: 20, size: 1.5, sound: 'slam', weight: 0.9, ring: true, shake: 26 });
S.cue({ t: 2.28, type: 'inksplash', weight: 0.7, x: 1020 });
S.fx({ t: 2.28, type: 'splash', x: 1020, h: 10, n: 16, size: 1.3, dir: 0 });
S.hit({ t: 2.34, x: 904, h: 4, size: 0.6, sound: 'clack', weight: 0.5, sparks: false });
S.skid({ t0: 2.3, t1: 2.6, x0: 1070, x1: 940 });
S.step({ t: 2.4, x: 1372, weight: 0.9 }); S.step({ t: 2.5, x: 1330, weight: 1.0 });
S.fx({ t: 2.38, type: 'splash', x: 1040, h: 10, n: 9, size: 1.0, dir: -1 });
S.fx({ t: 2.48, type: 'splash', x: 990, h: 10, n: 9, size: 1.0, dir: -1 });
S.hit({ t: 2.6, x: 924, h: 76, size: 2.0, sound: 'clang', weight: 1, shock: true, ring: true, shake: 34 });
S.cue({ t: 2.6, type: 'slam', weight: 0.6, x: 924 });
S.skid({ t0: 2.68, t1: 2.86, x0: 904, x1: 874 });
S.fx({ t: 2.7, type: 'sparks', x: 900, h: 6, size: 0.8, n: 8, dir: -1 });
S.whoosh({ t: 2.72, x: 1280, size: 'l', heavy: true });
S.whoosh({ t: 2.9, x: 800, size: 'm' });
S.cue({ t: 3.08, type: 'thud', weight: 0.5, x: 320 });
S.fx({ t: 3.08, type: 'sparks', x: 312, h: 16, size: 0.7, n: 7 });
// B's swing takes the pillar
S.step({ t: 3.12, x: 1226, weight: 0.9 }); S.step({ t: 3.26, x: 1112, weight: 1.0 });
S.whoosh({ t: 3.24, x: 1000, size: 'l', heavy: true });
S.hit({ t: T_PILLAR, x: 636, h: 154, size: 2.6, sound: 'slam', weight: 1, impact: 0.08, shake: 42 });
S.cue({ t: T_PILLAR, type: 'wallbreak', size: 1, x: 620 });
S.cue({ t: T_PILLAR + 0.06, type: 'crumble', dur: 0.8, x: 560 });
S.fx({ t: T_PILLAR, type: 'dust', x: 620, h: 120, n: 9, size: 1.3, dir: -1 });
S.cue({ t: 3.64, type: 'clack', weight: 0.35, x: 800 });
S.cue({ t: 3.74, type: 'clack', weight: 0.3, x: 856 });
S.hit({ t: 3.86, x: 946, h: 160, size: 0.7, sound: 'hit', weight: 0.5 });
S.whoosh({ t: 3.9, x: 1000, size: 'm', dur: 0.3 });
S.cue({ t: 4.12, type: 'thud', weight: 0.7, x: 860 });
S.fx({ t: 4.12, type: 'dust', x: 720, n: 5, size: 0.9 });
S.cue({ t: T_PILLAR_DOWN, type: 'slam', weight: 1, x: 420 });
S.cue({ t: T_PILLAR_DOWN, type: 'inksplash', weight: 0.8, x: 420 });
S.cue({ t: T_PILLAR_DOWN + 0.04, type: 'crumble', dur: 0.5, gain: 0.7, x: 420 });
S.shake(T_PILLAR_DOWN, 20, 0.4);
S.fx({ t: T_PILLAR_DOWN, type: 'dust', x: 430, n: 10, size: 1.4 });
S.fx({ t: T_PILLAR_DOWN, type: 'splash', x: 360, h: 10, n: 18, size: 1.4, dir: 0 });
// the blade catch
S.land({ t: 4.26, x: 1390, weight: 0.45 });
S.whoosh({ t: 4.36, x: 1300, size: 'l' });
S.hit({ t: 4.44, x: 1064, h: 220, size: 1.7, sound: 'block', weight: 1, shock: true, sparks: true, shake: 24 });
S.cue({ t: 4.44, type: 'clang', weight: 0.5, x: 1064 });
S.cue({ t: 4.56, type: 'riser', dur: 0.4 });
S.skid({ t0: 4.56, t1: 4.82, x0: 1000, x1: 975 });
S.whoosh({ t: 4.9, x: 1100, size: 'm', heavy: true });
S.hit({ t: 5.08, x: 1366, h: 180, size: 1.1, sound: 'hit', weight: 0.8 });
S.whoosh({ t: 5.1, x: 1450, size: 'l', dur: 0.34 });
S.land({ t: 5.44, x: 1650, weight: 0.6 });
S.skid({ t0: 5.44, t1: 5.64, x0: 1630, x1: 1740 });
S.fx({ t: 5.44, type: 'sparks', x: 1190, h: 6, size: 0.9, n: 9, dir: -1 });
S.fx({ t: 5.5, type: 'sparks', x: 1220, h: 6, size: 0.8, n: 7, dir: -1 });
S.skid({ t0: 5.44, t1: 5.64, x0: 1170, x1: 1260, sound: false });
// B takes the hammer back and goes through the arch
S.step({ t: 5.48, x: 1012, weight: 0.6 });
S.cue({ t: 5.62, type: 'clack', weight: 0.4, x: 940 });
S.whoosh({ t: 5.74, x: 900, size: 'm', heavy: true });
S.step({ t: 6.24, x: 1040, weight: 0.8 }); S.step({ t: 6.38, x: 1092, weight: 0.9 }); S.step({ t: 6.52, x: 1130, weight: 1.0 });
S.whoosh({ t: 6.56, x: 1300, size: 'l', heavy: true });
S.hit({ t: T_ARCH1, x: 1537, h: 219, size: 2.6, sound: 'slam', weight: 1, impact: 0.08, shake: 42 });
S.cue({ t: T_ARCH1, type: 'wallbreak', size: 1, x: 1532 });
S.cue({ t: T_ARCH1 + 0.08, type: 'crumble', dur: 0.9, x: 1620 });
S.fx({ t: T_ARCH1, type: 'dust', x: 1540, h: 200, n: 9, size: 1.3, dir: 1 });
S.whoosh({ t: 7.0, x: 1740, size: 'l' });
S.hit({ t: T_SLICE, x: 1668, h: 400, size: 2.0, sound: 'slice', weight: 1, shock: true, shake: 26 });
S.cue({ t: T_SLICE, type: 'wallbreak', size: 0.6, x: 1668 });
S.fx({ t: T_SLICE, type: 'sparks', x: 1668, h: 400, size: 1.5, n: 16 });
S.cue({ t: 7.36, type: 'crumble', dur: 0.6, gain: 0.8, x: 1660 });
S.cue({ t: 7.5, type: 'thud', weight: 0.6, x: 1560 });
S.fx({ t: 7.5, type: 'dust', x: 1560, n: 6, size: 1.0 });
S.fx({ t: 7.56, type: 'dust', x: 1780, n: 6, size: 1.0 });
S.cue({ t: 7.5, type: 'thud', weight: 0.4, x: 2300 });
// the scoop: A is batted through the other leg
S.whoosh({ t: 7.1, x: 1300, size: 'm', heavy: true });
S.step({ t: 7.22, x: 1230, weight: 0.8 }); S.step({ t: 7.36, x: 1300, weight: 0.9 });
S.cue({ t: 7.52, type: 'stomp', x: 1380, gain: 0.7 });
S.whoosh({ t: 7.6, x: 1600, size: 'l', heavy: true });
S.hit({ t: T_BAT, x: 1806, h: 150, size: 2.3, sound: 'clang', weight: 1, impact: 0.07, ring: true, shake: 40 });
S.cue({ t: T_BAT, type: 'hit', weight: 1, x: 1806 });
S.whoosh({ t: 7.78, x: 1900, size: 'l', dur: 0.36 });
S.hit({ t: T_ARCH2, x: 1888, h: 180, size: 1.8, sound: null, shake: 26 });
S.cue({ t: T_ARCH2, type: 'wallbreak', size: 0.9, x: 1888 });
S.cue({ t: T_ARCH2 + 0.08, type: 'crumble', dur: 1.0, x: 1900 });
S.fx({ t: T_ARCH2, type: 'dust', x: 1900, h: 150, n: 9, size: 1.3, dir: 1 });
S.fx({ t: 8.3, type: 'dust', x: 1900, n: 8, size: 1.2 });
S.cue({ t: 8.3, type: 'thud', weight: 0.7, x: 1900 });
// into deep ink — and back in on the surge
S.cue({ t: T_SPLASH, type: 'inksplash', weight: 1, x: 2400 });
S.shake(T_SPLASH, 16, 0.3);
S.fx({ t: T_SPLASH, type: 'splash', x: 2400, h: 10, n: 28, size: 1.9, dir: 0 });
S.fx({ t: T_SPLASH + 0.03, type: 'splash', x: 2380, h: 10, n: 16, size: 1.4, dir: -1 });
S.step({ t: 8.08, x: 1474, weight: 0.7 }); S.step({ t: 8.22, x: 1540, weight: 0.7 });
S.hit({ t: 8.36, x: 1545, h: 8, size: 0.8, sound: 'slam', weight: 0.5, ring: true });
S.cue({ t: 8.32, type: 'rumble', dur: 1.3, x: 2200 });
S.whoosh({ t: 8.5, x: 2300, size: 'l', dur: 0.9 });
S.cue({ t: T_PICK, type: 'crumble', dur: 0.25, gain: 0.5, x: 1660 });
S.whoosh({ t: 8.64, x: 1620, size: 'm', heavy: true });
S.whoosh({ t: T_THROW - 0.02, x: 1640, size: 'l', dur: 0.24 });
S.whoosh({ t: 9.13, x: 2080, size: 'm' });
S.hit({ t: T_CUT, x: 1830, h: 396, size: 1.5, sound: 'slice', weight: 0.9, sparks: true });
S.cue({ t: T_CUT, type: 'wallbreak', size: 0.45, x: 1830 });
S.cue({ t: 9.24, type: 'clack', weight: 0.4, x: 1545 });
S.whoosh({ t: 9.4, x: 1620, size: 'l', heavy: true });
S.whoosh({ t: 9.44, x: 1960, size: 'm', dur: 0.2 });
S.hit({ t: T_SURGE, x: 1712, h: 373, size: 2.3, sound: 'clang', weight: 1, shock: true, shake: 30 });
S.cue({ t: T_SURGE + 0.06, type: 'inksplash', weight: 1, x: 1780 });
S.fx({ t: T_SURGE + 0.06, type: 'splash', x: 1800, h: 40, n: 26, size: 1.8, dir: 0 });
S.fx({ t: T_SURGE + 0.1, type: 'splash', x: 1680, h: 30, n: 18, size: 1.5, dir: -1 });
S.cue({ t: 9.7, type: 'thud', weight: 0.5, x: 2060 });
S.land({ t: 9.8, x: 1800, weight: 0.5 });
// 0:10 — the duel
S.hit({ t: 10.0, x: 1800, h: 191, size: 0.9, sound: 'block', weight: 0.7 });
S.skid({ t0: 10.0, t1: 10.14, x0: 1830, x1: 1930 });
S.whoosh({ t: 10.22, x: 1700, size: 'l', heavy: true });
S.whoosh({ t: 10.3, x: 1950, size: 's' });
S.hit({ t: 10.5, x: 2036, h: 30, size: 2.0, sound: 'slam', weight: 1, ring: true, shake: 34 });
S.cue({ t: 10.5, type: 'inksplash', weight: 0.7, x: 2036 });
S.fx({ t: 10.5, type: 'splash', x: 2036, h: 10, n: 18, size: 1.4, dir: 0 });
S.fx({ t: 10.5, type: 'dust', x: 2036, n: 8, size: 1.2 });
S.land({ t: 10.54, x: 2180, weight: 0.4 });
S.step({ t: 10.8, x: 2090, weight: 0.4 });
S.whoosh({ t: 10.82, x: 1980, size: 'l' });
S.whoosh({ t: 10.8, x: 1700, size: 'm', heavy: true });
S.hit({ t: 10.95, x: 1668, h: 227, size: 1.7, sound: 'clang', weight: 0.9, shock: true });
S.whoosh({ t: 11.18, x: 1700, size: 'm', heavy: true });
S.hit({ t: 11.26, x: 1700, h: 300, size: 1.0, sound: 'clang', weight: 0.6 });
S.hit({ t: 11.4, x: 2063, h: 30, size: 1.1, sound: 'slam', weight: 0.6, ring: true });
S.cue({ t: 11.52, type: 'thud', weight: 0.4, x: 2640 });
S.step({ t: 11.56, x: 1740, weight: 0.8 }); S.step({ t: 11.7, x: 1800, weight: 0.8 });
S.skid({ t0: 11.42, t1: 11.82, x0: 2063, x1: 2200 });
S.whoosh({ t: 11.72, x: 2190, size: 's' });
S.whoosh({ t: 11.8, x: 2000, size: 'l', heavy: true });
S.hit({ t: 11.9, x: 2212, h: 200, size: 1.2, sound: 'clack', weight: 0.7, sparks: false });
S.whoosh({ t: 11.94, x: 2300, size: 'l', dur: 0.4 });
S.land({ t: 12.35, x: X_PR, h: PR_TOP, weight: 0.5 });
S.cue({ t: 12.37, type: 'crumble', dur: 0.3, gain: 0.5, x: X_PR });
S.step({ t: 12.3, x: 1890, weight: 0.8 }); S.step({ t: 12.46, x: 1960, weight: 0.8 }); S.step({ t: 12.62, x: 2030, weight: 0.9 }); S.step({ t: 12.78, x: 2100, weight: 0.9 });
S.cue({ t: 12.5, type: 'thunder', x: 2400 });
S.shake(12.5, 12, 0.4);
S.whoosh({ t: 12.74, x: 2560, size: 'l', dur: 0.36 });
S.whoosh({ t: 12.96, x: 2200, size: 'l', heavy: true });
S.hit({ t: T_AIR, x: 2326, h: 425, size: 2.8, sound: 'clang', weight: 1, impact: 0.09, shock: true, shake: 46 });
S.cue({ t: T_AIR, type: 'boom', x: 2326 });
S.fx({ t: T_AIR, type: 'shock', x: 2326, h: 425, size: 4.2 });
S.cue({ t: T_AIR + 0.04, type: 'wallbreak', size: 1, x: X_PR });
S.cue({ t: T_AIR + 0.12, type: 'crumble', dur: 1.3, x: 2100, gain: 0.8 });
S.fx({ t: T_AIR + 0.04, type: 'dust', x: X_PR, h: 120, n: 8, size: 1.3, dir: 1 });
S.skid({ t0: 13.18, t1: 13.66, x0: 2180, x1: 2030 });
S.land({ t: 13.46, x: 2470, weight: 0.6 });
S.cue({ t: 13.66, type: 'thud', weight: 0.6, x: 1720 });
S.fx({ t: 13.66, type: 'dust', x: 1740, n: 5, size: 0.9 });
S.cue({ t: T_AIR + 0.75, type: 'slam', weight: 1, x: 2820 });
S.cue({ t: T_AIR + 0.75, type: 'inksplash', weight: 0.8, x: 2820 });
S.shake(T_AIR + 0.75, 18, 0.4);
S.fx({ t: T_AIR + 0.75, type: 'dust', x: 2800, n: 10, size: 1.4 });
S.fx({ t: T_AIR + 0.75, type: 'splash', x: 2900, h: 10, n: 18, size: 1.4, dir: 0 });
// tired; one more run. B leaps for the smash, A slides under him
S.step({ t: 14.3, x: 2436, weight: 0.4 }); S.step({ t: 14.42, x: 2352, weight: 0.45 });
S.cue({ t: 14.2, type: 'skid', dur: 0.4, x: 2600, gain: 0.6 });
S.cue({ t: 14.52, type: 'stomp', x: 1985, gain: 0.8 });
S.fx({ t: 14.52, type: 'dust', x: 1985, n: 6, size: 1.0 });
S.whoosh({ t: 14.54, x: 2050, size: 'l', heavy: true, dur: 0.44 });
S.skid({ t0: 14.56, t1: 15.12, x0: 2230, x1: 1590 });
S.fx({ t: 14.58, type: 'dust', x: 2230, n: 5, size: 0.9, dir: 1 });
S.fx({ t: 14.72, type: 'sparks', x: 2300, h: 8, size: 0.8, n: 8, dir: 1 });
S.fx({ t: 14.88, type: 'sparks', x: 2120, h: 8, size: 0.8, n: 8, dir: 1 });
S.hit({ t: 15.0, x: 2560, h: 40, size: 2.0, sound: 'slam', weight: 1, ring: true, shake: 34 });
S.land({ t: 15.0, x: 2215, weight: 0.8 });
S.cue({ t: 15.0, type: 'wallbreak', size: 0.5, x: 2600 });
S.cue({ t: 15.02, type: 'inksplash', weight: 0.6, x: 2600 });
S.fx({ t: 15.0, type: 'splash', x: 2600, h: 10, n: 16, size: 1.3, dir: 0 });
S.whoosh({ t: 15.22, x: 2260, size: 'l', heavy: true });
S.whoosh({ t: 15.4, x: 1700, size: 'l', dur: 0.14 });
S.cue({ t: 15.44, type: 'slice', weight: 0.8, x: 1900 });
S.hit({ t: 15.52, x: 2080, h: 125, size: 2.2, sound: 'clang', weight: 1, shock: true, shake: 32 });
S.skid({ t0: 15.52, t1: 15.62, x0: 2270, x1: 2310 });
S.whoosh({ t: 15.66, x: 2150, size: 'm', heavy: true });
S.step({ t: 15.76, x: 2170, weight: 0.8 }); S.step({ t: 15.92, x: 2040, weight: 0.8 });
S.cue({ t: 16.06, type: 'thud', weight: 0.5, x: 1220 });
S.cue({ t: 16.08, type: 'thud', weight: 0.7, x: 2290 });
S.fx({ t: 16.08, type: 'dust', x: 2290, n: 5, size: 0.9 });
S.fx({ t: 16.06, type: 'sparks', x: 1220, h: 20, size: 0.7, n: 6 });
S.whoosh({ t: 16.58, x: 2040, size: 'l', heavy: true });
S.whoosh({ t: 16.66, x: 1700, size: 'l' });
S.step({ t: 16.78, x: 1710, weight: 0.5 }); S.step({ t: 16.8, x: 2018, weight: 0.9 });
S.hit({ t: 16.9, x: 1861, h: 237, size: 2.1, sound: 'clang', weight: 1, shock: true, shake: 30 });
// the bind: B walks him back, steel grinding
S.skid({ t0: 16.98, t1: 17.44, x0: 1700, x1: 1570 });
S.step({ t: 17.14, x: 1980, weight: 0.9 }); S.step({ t: 17.3, x: 1930, weight: 0.9 });
S.fx({ t: 17.08, type: 'sparks', x: 1830, h: 230, size: 0.8, n: 8 });
S.fx({ t: 17.22, type: 'sparks', x: 1798, h: 224, size: 0.8, n: 8 });
S.fx({ t: 17.36, type: 'sparks', x: 1752, h: 216, size: 0.8, n: 8 });
S.cue({ t: 17.0, type: 'shing', dur: 0.44, x: 1800 });
S.hit({ t: 17.5, x: 1740, h: 220, size: 0.9, sound: 'block', weight: 0.7 });
S.whoosh({ t: 17.58, x: 1900, size: 'l', heavy: true });
S.whoosh({ t: 17.6, x: 1600, size: 'l' });
S.hit({ t: T_MEGA, x: 1745, h: 228, size: 3.2, sound: 'clang', weight: 1, impact: 0.1, shock: true, ring: true, shake: 56 });
S.cue({ t: T_MEGA, type: 'boom', x: 1745 });
S.cue({ t: T_MEGA, type: 'slam', weight: 1, x: 1745 });
S.cue({ t: T_MEGA + 0.02, type: 'inksplash', weight: 1, x: 1745 });
S.fx({ t: T_MEGA, type: 'shock', x: 1745, h: 228, size: 5 });
S.fx({ t: T_MEGA, type: 'splash', x: 1640, h: 10, n: 26, size: 2.0, dir: -1 });
S.fx({ t: T_MEGA, type: 'splash', x: 1850, h: 10, n: 26, size: 2.0, dir: 1 });
S.fx({ t: T_MEGA, type: 'scraps', x: 1745, h: 30, n: 16 });
S.cue({ t: T_MEGA + 0.14, type: 'crumble', dur: 1.5, x: 1750 });
S.cue({ t: T_MEGA + 0.1, type: 'tear', dur: 0.5, x: 1745 });
S.skid({ t0: 17.85, t1: 18.4, x0: 1570, x1: 1350 });
S.skid({ t0: 17.85, t1: 18.4, x0: 1930, x1: 2150, sound: false });
S.cue({ t: 18.4, type: 'thud', weight: 0.5, x: 950 });
S.cue({ t: 18.42, type: 'thud', weight: 0.7, x: 2400 });
S.fx({ t: 18.42, type: 'dust', x: 2360, n: 5, size: 0.9 });
S.musicHint(T_MEGA + 0.15, 19.3, 'aftermath');
S.cue({ t: 18.62, type: 'heartbeat' });
S.cue({ t: 19.1, type: 'heartbeat' });
// 0:19 — the last clash
S.cue({ t: 19.25, type: 'rumble', dur: 2.2, x: 1750 });
S.cue({ t: 19.3, type: 'draw', dur: 0.7, x: 1400 });
S.cue({ t: 19.45, type: 'draw', dur: 0.7, x: 2100 });
S.whoosh({ t: 19.5, x: 1400, size: 'l' });
S.whoosh({ t: 19.56, x: 2100, size: 'l', heavy: true });
S.cue({ t: 19.9, type: 'riser', dur: 1.0 });
S.musicHint(19.95, 20.92, 'suspend');
S.cue({ t: 20.3, type: 'heartbeat' });
S.cue({ t: 20.55, type: 'thunder', x: 1560 });
S.shake(20.55, 12, 0.4);
S.musicHint(20.92, 21.46, 'surge');
S.whoosh({ t: 20.9, x: 1750, size: 'l', dur: 0.5 });
S.step({ t: 21.02, x: 1424, weight: 0.5 }); S.step({ t: 21.16, x: 1474, weight: 0.55 }); S.step({ t: 21.3, x: 1524, weight: 0.6 });
S.step({ t: 21.04, x: 2076, weight: 0.9 }); S.step({ t: 21.2, x: 2020, weight: 1.0 }); S.step({ t: 21.36, x: 1964, weight: 1.0 });
S.cue({ t: 21.5, type: 'stomp', x: 1930 });
S.slowmo(21.5, 23.24, () => CLASH);
S.cue({ t: 21.8, type: 'heartbeat' });
S.cue({ t: 22.45, type: 'heartbeat' });
S.cue({ t: 22.8, type: 'riser', dur: 0.5 });
S.hit({ t: T_CLASH, x: CLASH[0], h: CLASH[1], size: 4, sound: null, impact: 0.14, shock: true, ring: true, shake: 70 });
S.cue({ t: T_CLASH, type: 'megaimpact', x: CLASH[0] });
S.cue({ t: T_CLASH + 0.04, type: 'shatter', x: CLASH[0] });
S.fx({ t: T_CLASH, type: 'shock', x: CLASH[0], h: CLASH[1], size: 6 });
S.fx({ t: T_CLASH, type: 'sparks', x: CLASH[0], h: CLASH[1], size: 2.4, n: 26 });
S.shake(T_SHATTER, 50, 0.9);
S.cue({ t: T_SHATTER, type: 'whoosh', size: 'l', dur: 0.9, x: CLASH[0], weight: 1 });
S.cue({ t: T_SHATTER + 0.02, type: 'tear', dur: 0.7, x: CLASH[0] });
S.cue({ t: T_SHATTER + 0.05, type: 'crumble', dur: 0.7, gain: 0.7, x: CLASH[0] });
S.musicHint(T_SHATTER + 0.4, 25, 'suspend');

// ═════════════════════════════════════════════════════════════════════════════
// ENVIRONMENT
// ═════════════════════════════════════════════════════════════════════════════
const SHEET = { x0: -1500, x1: 4000, y0: -2400, y1: 1200 };
const POOL_Y = 15;                      // the ink pool starts just under the floor line
const VORTEX = [1150, -700];
const VSQ = 0.56;                       // the vortex is seen at an angle
const G = 2300;

// ── stone: rigid hatched blocks (pillars, arch, bridge) that break, fall and STAY ──
function hatchSegs(x0, y0, x1, y1, angDeg, gap, r, skip = 0.08) {
  const out = [];
  const a = angDeg * DEG, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2 + 2;
  for (let d = -R + r() * gap; d < R; d += gap * (0.8 + r() * 0.4)) {
    if (r() < skip) continue;
    const ox = cx + nx * d, oy = cy + ny * d;
    let s0 = -R, s1 = R;
    for (const [o, u, lo, hi] of [[ox, ux, x0, x1], [oy, uy, y0, y1]]) {
      if (Math.abs(u) < 1e-6) { if (o < lo || o > hi) { s0 = 1; s1 = 0; } continue; }
      let a0 = (lo - o) / u, a1 = (hi - o) / u;
      if (a0 > a1) [a0, a1] = [a1, a0];
      s0 = Math.max(s0, a0); s1 = Math.min(s1, a1);
    }
    if (s1 - s0 < 3) continue;
    const j = () => (r() - 0.5) * 1.8;
    out.push([ox + ux * s0 + j(), oy + uy * s0 + j(), ox + ux * s1 + j(), oy + uy * s1 + j()]);
  }
  return out;
}

const stones = [];      // stage layer
const farStones = [];   // the distant bridge (far layer)
function stone(o, list = stones) {
  const p = { rot: 0, t: Infinity, born: -Infinity, until: Infinity, floor: 0, front: false, ...o };
  const r = rng(p.seed);
  const hw = p.w / 2, hh = p.h / 2;
  const j = () => (r() - 0.5) * 3.2;
  if (p.kind === 'broken') {
    // jagged top edge
    p.poly = [[-hw, hh], [-hw + j(), -hh * 0.2], [-hw * 0.55, -hh], [-hw * 0.2, -hh * 0.35], [hw * 0.15, -hh * 0.9], [hw * 0.5, -hh * 0.1], [hw + j(), -hh * 0.6], [hw, hh]];
  } else {
    p.poly = [[-hw + j(), -hh + j()], [hw + j(), -hh + j()], [hw + j(), hh + j()], [-hw + j(), hh + j()]];
  }
  const thin = [];
  const far = p.kind === 'far';
  if (p.kind === 'drum' || p.kind === 'broken') {
    for (const fx of [-0.3, -0.06, 0.18]) thin.push([fx * p.w + j(), -hh + 6, fx * p.w + j(), hh - 5]);
    thin.push(...hatchSegs(hw * 0.34, -hh + 2, hw - 1, hh - 2, 62, 5.5, r));
    thin.push(...hatchSegs(hw * 0.34, -hh + 2, hw - 1, hh - 2, -24, 7, r));
    thin.push(...hatchSegs(-hw + 1, -hh + 2, -hw * 0.66, hh - 2, 62, 12, r, 0.2));
  } else if (far) {
    // the distant bridge stays an outline: no tone behind the fighters' bodies
  } else {
    thin.push(...hatchSegs(-hw + 1, -hh + 1, hw - 1, hh - 1, 50, 11, r, 0.15));
    thin.push(...hatchSegs(hw * 0.3, -hh + 1, hw - 1, hh - 1, -30, 6, r));
    thin.push(...hatchSegs(-hw + 1, hh * 0.3, hw - 1, hh - 1, 50, 5, r));
  }
  p.thin = thin;
  // ink running down the stone
  p.drips = [];
  if (p.drip) for (let i = 0; i < p.drip; i++) p.drips.push([(r() - 0.5) * p.w * 0.9, -hh + 2, 14 + r() * (p.h * 0.7), 3 + r() * 4]);
  list.push(p);
  return p;
}

function finalizeStone(p) {
  if (p.t === Infinity || p.top) return;
  let ph = { t: p.t, x: p.x, y: p.y, rot: p.rot, vx: p.vx || 0, vy: p.vy || 0, om: p.om || 0 };
  if (p.t2 != null && p.t2 > p.t) {
    const d = p.t2 - p.t;
    p.ph1 = ph;
    ph = { t: p.t2, x: ph.x + ph.vx * d, y: ph.y + ph.vy * d + 0.5 * G * d * d, rot: ph.rot + ph.om * d, vx: p.vx2, vy: p.vy2, om: p.om2 ?? ph.om };
  }
  p.ph = ph;
  const solve = (half) => {
    const A = 0.5 * G, B = ph.vy, C = ph.y - (p.floor - half);
    const disc = B * B - 4 * A * C;
    return disc > 0 ? Math.max(0, (-B + Math.sqrt(disc)) / (2 * A)) : 0;
  };
  let tl = solve(Math.min(p.w, p.h) / 2);
  const k = Math.round((ph.rot + ph.om * tl) / (Math.PI / 2));
  const half = k % 2 === 0 ? p.h / 2 : p.w / 2;
  tl = solve(half);
  p.tl = ph.t + tl;
  p.lx = ph.x + ph.vx * tl;
  p.ly = p.floor - half;
  p.lrot = k * Math.PI / 2 + (hash(p.seed * 1.7) - 0.5) * 0.22;
  if (tl > 0.05) ph.om = (p.lrot - ph.rot) / tl;   // spin is retimed so the stone arrives flat instead of snapping
}

/** → [x, y, rot, flying] or null when the stone is not there */
function stonePose(p, t) {
  if (t < p.born || t >= p.until) return null;
  if (t < p.t) return [p.x, p.y, p.rot, 0];
  if (p.top) {
    const o = p.top, tau = t - p.t;
    const at = (u) => {
      const dropY = o.drop * Math.min(1, (tau / 0.2) * (tau / 0.2));
      const th = o.dir * o.th1 * Math.pow(u, 2.3);
      const dx = p.x - o.px, dy = p.y + dropY - o.py;
      const c = Math.cos(th), s = Math.sin(th);
      return [o.px + dx * c - dy * s, o.py + dx * s + dy * c, p.rot + th];
    };
    if (tau < o.T) return [...at(tau / o.T), 1];
    const e = at(1), v = clamp((tau - o.T) / 0.13), bt = tau - o.T;
    const b = bt < 0.3 ? -Math.sin((bt / 0.3) * Math.PI) * 12 * (1 - bt / 0.3) : 0;
    return [lerp(e[0], o.fx, v), lerp(e[1], o.fy, v) + b, lerp(e[2], o.frot, v), 0];
  }
  if (t >= p.tl) {
    const bt = t - p.tl;
    const b = bt < 0.16 ? -Math.sin((bt / 0.16) * Math.PI) * 9 : 0;
    return [p.lx, p.ly + b, p.lrot, 0];
  }
  const ph = p.ph1 && t < p.ph.t ? p.ph1 : p.ph, d = t - ph.t;
  return [ph.x + ph.vx * d, ph.y + ph.vy * d + 0.5 * G * d * d, ph.rot + ph.om * d, 1];
}

function drawStone(ctx, p, x, y, rot) {
  const far = p.kind === 'far';
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.beginPath();
  p.poly.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
  ctx.closePath();
  ctx.fillStyle = WHITE; ctx.fill();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.lineWidth = far ? 1.5 : 2.7; ctx.strokeStyle = BLACK; ctx.stroke();
  ctx.beginPath();
  for (const s of p.thin) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); }
  ctx.lineWidth = far ? 1.05 : 1.3; ctx.stroke();
  for (const d of p.drips) {
    ctx.beginPath(); ctx.moveTo(d[0], d[1]); ctx.lineTo(d[0], d[1] + d[2]);
    ctx.lineWidth = d[3]; ctx.stroke();
  }
  ctx.restore();
}

function drawStones(ctx, list, t, vb, front) {
  for (const p of list) {
    const q = stonePose(p, t);
    if (!q) continue;
    if ((p.front && q[3] === 1) !== front) continue;
    if (q[0] < vb.x0 - 260 || q[0] > vb.x1 + 260 || q[1] < vb.y0 - 260) continue;
    drawStone(ctx, p, q[0], q[1], q[2]);
  }
}

function column(x, o) {
  const { w = 92, n = 5, dh = 88, ph = 34, seed, cap = true, broken = false } = o;
  const plinth = stone({ kind: 'block', x, y: -ph / 2, w: w + 30, h: ph, seed });
  let y = -ph;
  const drums = [];
  for (let i = 0; i < n; i++) {
    drums.push(stone({ kind: 'drum', x: x + (hash(seed + i * 3.1) - 0.5) * 6, y: y - dh / 2, w, h: dh, seed: seed + 3 + i, drip: i === n - 1 ? 2 : 0 }));
    y -= dh;
  }
  let top = null;
  if (cap) { top = stone({ kind: 'cap', x, y: y - 20, w: w + 34, h: 40, seed: seed + 20, drip: 4 }); y -= 40; }
  if (broken) { top = stone({ kind: 'broken', x, y: y - 26, w, h: 52, seed: seed + 21, drip: 2 }); }
  return { x, w, plinth, drums, top, h: -y };
}

function blast(p, t, vx, vy, om, extra = {}) { Object.assign(p, { t, vx, vy, om, ...extra }); return p; }

/** small stone chips born at t */
function chips(t, x, y, n, vx, vy, seed, o = {}) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const s = 18 + r() * 26;
    stone({
      kind: 'block', x: x + (r() - 0.5) * (o.sx ?? 70), y: y + (r() - 0.5) * (o.sy ?? 80), w: s * (1 + r() * 0.5), h: s, seed: seed + 5 + i * 3,
      born: t, t, vx: vx * (0.4 + r() * 0.9) + (r() - 0.5) * 240, vy: vy * (0.5 + r()) - r() * 260, om: (r() - 0.5) * 18, front: i % 2 === 0, rot: r() * 3,
    });
  }
}

/** topple a stack of stones like a felled tree about pivot (px, py); they end lying on the floor */
function topple(list, t, px, py, dir, T, drop = 0) {
  const hp = -py;
  let L = 0;
  for (const p of list) L = Math.max(L, py - (p.y + drop) + p.h / 2);
  const th1 = Math.PI / 2 + Math.asin(clamp((hp - 20) / L, 0, 0.9));
  list.forEach((p, i) => {
    const d = py - (p.y + drop);
    p.t = t;
    p.top = { px, py, dir, T, th1, drop, fx: px + dir * (d * 1.03 + 46 + i * 7), fy: -(p.w / 2) + (p.kind === 'cap' ? 12 : 0), frot: dir * Math.PI / 2 + (hash(p.seed) - 0.5) * 0.16 };
  });
}

// — the left pillar: B's hammer knocks a drum out at T_PILLAR, the rest falls like a tree —
const PL = column(X_PL, { seed: 410, n: 5 });
blast(PL.drums[1], T_PILLAR, -620, -260, -7, { front: true });
chips(T_PILLAR, X_PL, -166, 7, -520, -300, 430);
topple([PL.drums[2], PL.drums[3], PL.drums[4], PL.top], T_PILLAR + 0.02, X_PL - 46, -122, -1, T_PILLAR_DOWN - T_PILLAR - 0.02, 88);

// — set dressing on the far left: a stump and a leaning column —
const STUMP = column(190, { seed: 450, n: 1, cap: false, broken: true });
stone({ kind: 'drum', x: 300, y: -46, w: 92, h: 88, rot: Math.PI / 2 + 0.1, seed: 461 });
for (let i = 0; i < 5; i++) {
  const a = -0.2;
  stone({ kind: i === 4 ? 'cap' : 'drum', x: -60 + Math.sin(a) * (44 + i * 88) * -1, y: -(44 + i * 88) * Math.cos(a), w: i === 4 ? 126 : 92, h: i === 4 ? 40 : 88, rot: a, seed: 470 + i, drip: i > 2 ? 3 : 0 });
}

// — the arch —
const LEG_L = column(ARCH.xl, { seed: 500, n: 3, dh: 100, ph: 30, w: ARCH.w, cap: false });
const LEG_R = column(ARCH.xr, { seed: 520, n: 3, dh: 100, ph: 30, w: ARCH.w, cap: false });
const RING = [];
{
  const rm = (ARCH.ri + ARCH.ro) / 2, N = 9;
  for (let i = 0; i < N; i++) {
    const phi = Math.PI + ((i + 0.5) / N) * Math.PI;
    RING.push(stone({ kind: 'block', x: ARCH.cx + Math.cos(phi) * rm, y: -ARCH.spring + Math.sin(phi) * rm, w: (rm * Math.PI) / N + 12, h: ARCH.ro - ARCH.ri, rot: phi + Math.PI / 2, seed: 540 + i, drip: i > 1 && i < 7 ? 2 : 0 }));
  }
}
// hammer through the left leg: top drum bursts, the middle drum is knocked out whole (B throws it later)
const BOULDER = LEG_L.drums[1];
blast(BOULDER, T_ARCH1, 250, -330, 5.5, { until: T_PICK });
LEG_L.drums[2].until = T_ARCH1;
blast(LEG_L.drums[0], T_ARCH1 + 0.03, 150, -150, 3.2);
chips(T_ARCH1, ARCH.xl + 10, -280, 9, 420, -260, 560, { front: true });
// the left half of the ring drops… and A's rising cut splits it (second impulse)
RING.forEach((p, i) => {
  if (i > 4) return;
  const side = p.x < ARCH.cx - 30 ? -1 : 1;
  blast(p, T_ARCH1 + 0.07 + i * 0.045, 40 + i * 14, 30, (i - 2) * 0.9, {
    t2: T_SLICE + i * 0.012, vx2: side * (260 + hash(i * 7.7) * 380) + (i === 4 ? 260 : 0), vy2: -(430 + hash(i * 3.3) * 420), om2: side * (5 + hash(i) * 7), front: i % 2 === 1,
  });
});
// A is batted through the right leg: it bursts, the rest of the ring comes down
blast(LEG_R.drums[1], T_ARCH2, 560, -340, 8, { front: true });
blast(LEG_R.drums[2], T_ARCH2 + 0.05, 240, -120, 3);
chips(T_ARCH2, ARCH.xr, -180, 9, 520, -280, 580, { front: true });
RING.forEach((p, i) => { if (i > 4) blast(p, T_ARCH2 + 0.06 + (8 - i) * 0.05, 120 + (i - 5) * 60, -40, (i - 6.5) * 1.3 + 2); });

// — the tall right pillar: A lands on top of it; the aerial clash topples it —
const PR = column(X_PR, { seed: 600, n: 4, w: 96, cap: false, broken: true });
topple([PR.drums[1], PR.drums[2], PR.drums[3], PR.top], T_AIR + 0.03, X_PR + 48, -122, 1, 0.72, 0);
chips(T_AIR + 0.03, X_PR, -150, 6, 300, -360, 620);
chips(15.0, 2700, -70, 7, 160, -420, 680, { sx: 160, sy: 60 });   // B's leaping smash lands on the fallen pillar

// — old rubble already lying around —
stone({ kind: 'drum', x: 2168, y: -44, w: 88, h: 96, rot: Math.PI / 2 - 0.08, seed: 640 });
stone({ kind: 'block', x: 1228, y: -17, w: 70, h: 34, rot: 0.05, seed: 644 });
stone({ kind: 'block', x: 446, y: -20, w: 84, h: 40, rot: -0.07, seed: 648 });
stone({ kind: 'block', x: 2640, y: -24, w: 90, h: 48, rot: 0.1, seed: 652 });

// — the distant bridge (far layer). Spans come down with the big clashes. —
const BRIDGE = { piers: [300, 880, 1460, 2040], deckY: -452, spans: [] };
{
  let seed = 700;
  const fall = (p, t, i) => blast(p, t + i * 0.045 + hash(seed + i) * 0.08, (hash(i * 5.1 + seed) - 0.5) * 160, -60 * hash(i * 2.3), (hash(i * 9.9 + seed) - 0.5) * 5, { floor: -4 });
  BRIDGE.piers.forEach((px, k) => {
    for (let i = 0; i < 4; i++) {
      const p = stone({ kind: 'far', x: px + (hash(seed) - 0.5) * 4, y: -52 - i * 104, w: 66, h: 104, seed: seed++ }, farStones);
      // pier tops crumble with the mega clash
      if (i >= 2 && (k === 1 || k === 2)) fall(p, T_MEGA + 0.1 + (3 - i) * 0.1, k);
      if (i >= 1 && k === 3) fall(p, T_MEGA + 0.16 + (3 - i) * 0.1, k);
    }
  });
  const span = (x0, x1, tBreak, from = 0, to = 5) => {
    const n = 5, w = (x1 - x0) / n;
    const blocks = [];
    for (let i = from; i < to; i++) {
      const p = stone({ kind: 'far', x: x0 + (i + 0.5) * w, y: BRIDGE.deckY, w: w + 3, h: 50, seed: seed++ }, farStones);
      if (tBreak != null) fall(p, tBreak + Math.abs(i - 2) * 0.05, i);
      blocks.push(p);
    }
    BRIDGE.spans.push({ x0, x1, t: tBreak ?? Infinity, whole: from === 0 && to === 5 });
  };
  span(-280, 300, null, 3, 5);            // broken stub on the left
  span(300, 880, T_MEGA + 0.12);
  span(880, 1460, T_AIR + 0.12);
  span(1460, 2040, T_MEGA + 0.2);
  span(2040, 2620, null, 0, 2);           // broken stub on the right
}

for (const p of stones) finalizeStone(p);
for (const p of farStones) finalizeStone(p);

// — the drum B throws: carried, thrown, cut in two —
let boulder = null;
function boulderInit() {
  if (boulder) return boulder;
  const s0 = scene.state(T_THROW), s1 = scene.state(T_CUT);
  const hold = (st) => [(st.B.hF[0] + st.B.hB[0]) / 2, -(st.B.hF[1] + st.B.hB[1]) / 2 - 30];
  const p0 = hold(s0);
  const tip = s1.weapons.find((w) => w.id === 'gs');
  const p1 = tip ? [(tip.tip[0] * 0.6 + tip.tail[0] * 0.4), -(tip.tip[1] * 0.6 + tip.tail[1] * 0.4)] : [s1.A.sh[0], -s1.A.sh[1]];
  const halves = [];
  for (const sgn of [-1, 1]) {
    const h = stone({ kind: 'drum', x: p1[0], y: p1[1] + sgn * 24, w: BOULDER.w, h: BOULDER.h / 2, seed: 660 + sgn, born: T_CUT, rot: 1.2, front: true });
    blast(h, T_CUT, 330 + sgn * 90, sgn < 0 ? -520 : 120, sgn * 9);
    finalizeStone(h);
    halves.push(h);
  }
  boulder = { hold, p0, p1, halves };
  return boulder;
}
function drawBoulder(ctx, t, st) {
  if (t < T_PICK || t >= T_CUT) return;
  const b = boulderInit();
  if (t < T_THROW) {
    const c = b.hold(st);
    drawStone(ctx, BOULDER, c[0], c[1], BOULDER.lrot + (t - T_PICK) * 0.5);
  } else {
    const u = (t - T_THROW) / (T_CUT - T_THROW);
    drawStone(ctx, BOULDER, lerp(b.p0[0], b.p1[0], u), lerp(b.p0[1], b.p1[1], u) - 60 * 4 * u * (1 - u), BOULDER.lrot + 0.25 + u * 5);
  }
}

// ── sky ──────────────────────────────────────────────────────────────────────
const KICKS = [[2.6, 0.5], [T_PILLAR, 0.5], [T_ARCH1, 0.5], [T_BAT, 0.6], [T_SURGE, 0.6], [10.95, 0.4], [11.9, 0.5], [T_AIR, 1.3], [15.52, 0.6], [16.9, 0.6], [T_MEGA, 2.0]];
function vortexPhase(t) {
  let ph = 0.5 * t;
  for (const [tk, k] of KICKS) if (t > tk) ph += k * EASE.out(prog(t, tk, tk + 0.9));
  if (t > 19) ph += 0.42 * (t - 19) * (t - 19);
  return -ph;
}
function cloudEdge(x, t) {
  let y = -850;
  y += 520 * smooth(560, -300, x);       // left curtain hangs down to about -330
  y += 470 * smooth(2950, 3750, x);      // right curtain
  y += 46 * noise1(x / 130 + t * 0.25, 3) + 20 * noise1(x / 37 - t * 0.6, 8);
  return y;
}
const BOLTS = [
  { t: T_GROW + 0.05, set: makeCracks(811, 965, -560, [{ a: 86 }], { len: 560, step: 64, jag: 0.8, branch: 0.34, w: 10 }) },
  { t: T_GROW_B + 0.05, set: makeCracks(815, 1255, -560, [{ a: 92 }], { len: 560, step: 64, jag: 0.8, branch: 0.34, w: 10 }) },
  { t: 12.5, set: makeCracks(823, 2020, -640, [{ a: 96 }], { len: 600, step: 64, jag: 0.8, branch: 0.34, w: 10 }) },
  { t: 20.55, set: makeCracks(837, 1560, -600, [{ a: 88 }], { len: 620, step: 64, jag: 0.8, branch: 0.3, w: 11 }) },
];

function drawSky(ctx, t, vb) {
  // the black storm ceiling with hanging curtains of ink rain
  const x0 = Math.floor((vb.x0 - 120) / 44) * 44, x1 = vb.x1 + 120;
  ctx.beginPath();
  ctx.moveTo(x0, SHEET.y0);
  for (let x = x0; x <= x1; x += 44) ctx.lineTo(x, cloudEdge(x, t));
  ctx.lineTo(x1, SHEET.y0);
  ctx.closePath();
  ctx.fillStyle = BLACK; ctx.fill();
  // drips / rain fingers hanging from the edge
  ctx.beginPath();
  for (let k = Math.floor(x0 / 58); k * 58 < x1; k++) {
    const x = k * 58 + hash(k * 1.3) * 40;
    const len = (30 + hash(k * 7.7) * 190) * (0.55 + 0.45 * Math.sin(t * (1.2 + hash(k) * 2) + k));
    const y = cloudEdge(x, t) - 8;
    ctx.moveTo(x, y); ctx.lineTo(x - len * 0.16, y + len);
  }
  ctx.lineWidth = 13; ctx.lineCap = 'round'; ctx.strokeStyle = BLACK; ctx.stroke();
  // slanted rain strokes under the ceiling (tone by hatching)
  ctx.beginPath();
  const q = Math.floor(t * 12);
  for (let k = Math.floor(x0 / 30); k * 30 < x1; k++) {
    const x = k * 30 + hash(k * 3.1 + q * 0.37) * 26;
    const top = cloudEdge(x, t);
    const off = hash(k * 5.3 + q * 1.1) * 150, len = 50 + hash(k * 9.1 + q) * 150;
    ctx.moveTo(x - off * 0.16, top + off); ctx.lineTo(x - (off + len) * 0.16, top + off + len);
  }
  ctx.lineWidth = 2; ctx.stroke();

  // the vortex: a white eye torn in the ceiling, black arms winding into it
  const [vx, vy] = VORTEX;
  const ph = vortexPhase(t);
  ctx.beginPath();
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * TAU;
    const r = 700 * (1 + 0.05 * noise1(i * 0.9 + t * 0.8, 21));
    const X = vx + Math.cos(a) * r, Y = vy + Math.sin(a) * r * VSQ;
    i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
  }
  ctx.closePath();
  ctx.fillStyle = WHITE; ctx.fill();
  const N = 7;
  ctx.beginPath();
  for (let k = 0; k < N; k++) {
    const a0 = ph + (k / N) * TAU;
    const L = [], R = [];
    for (let i = 0; i <= 26; i++) {
      const u = i / 26, r = 64 + 690 * u;
      const th = a0 + 2.0 * Math.log(r / 64);
      const hw = ((4 + 0.2 * r) * (0.72 + 0.28 * Math.sin(k * 2.1 + u * 6 + t * 0.7))) / r;
      L.push([vx + Math.cos(th - hw) * r, vy + Math.sin(th - hw) * r * VSQ]);
      R.push([vx + Math.cos(th + hw) * r, vy + Math.sin(th + hw) * r * VSQ]);
    }
    L.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
    ctx.closePath();
  }
  ctx.fillStyle = BLACK; ctx.fill();
  // thin swirl lines between the arms
  ctx.beginPath();
  for (let k = 0; k < N * 2; k++) {
    const a0 = ph + ((k + 0.5) / (N * 2)) * TAU + (k % 2 ? 0.1 : -0.14);
    const ra = 110 + hash(k * 3.3) * 200, rb = ra + 180 + hash(k * 4.1) * 260;
    for (let i = 0; i <= 12; i++) {
      const r = lerp(ra, rb, i / 12), th = a0 + 2.0 * Math.log(r / 64);
      const X = vx + Math.cos(th) * r, Y = vy + Math.sin(th) * r * VSQ;
      i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
    }
  }
  ctx.lineWidth = 2.6; ctx.strokeStyle = BLACK; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(vx, vy, 40, 40 * VSQ, 0, 0, TAU); ctx.fillStyle = BLACK; ctx.fill();
  // the vortex answers every clash with a pulse
  for (const [tk, k] of KICKS) {
    const p = (t - tk) / 0.7;
    if (p <= 0 || p >= 1 || k < 0.5) continue;
    const r = 90 + 660 * EASE.out(p);
    const rr = rng(Math.round(tk * 100));
    ctx.beginPath();
    for (let i = 0; i < 30; i++) {
      if (rr() < 0.2 + p * 0.4) continue;
      const a0 = (i / 30) * TAU, a1 = ((i + 0.8) / 30) * TAU;
      ctx.moveTo(vx + Math.cos(a0) * r, vy + Math.sin(a0) * r * VSQ);
      ctx.ellipse(vx, vy, r, r * VSQ, 0, a0, a1);
    }
    ctx.lineWidth = Math.max(1.5, 9 * k * (1 - p)); ctx.stroke();
  }
  // ink lightning
  for (const b of BOLTS) {
    const d = t - b.t;
    if (d < 0 || d > 0.2) continue;
    for (const c of b.set) stroke(ctx, c.pts, c.w * (d < 0.1 ? 1 : 0.45));
  }
}

/** wind-blown ink streaks, far layer */
function drawWind(ctx, t, vb) {
  const SPAN = 4400;
  for (const [w, n, seed] of [[1.8, 54, 1], [4.5, 12, 2]]) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const sp = 800 + hash(i * 3.7 + seed) * 1500;
      const y = -1020 + hash(i * 9.1 + seed * 5) * 960;
      const len = 90 + hash(i * 5.3 + seed) * 280;
      let x = (hash(i * 1.9 + seed * 3) * SPAN - sp * t) % SPAN;
      if (x < 0) x += SPAN;
      x -= 800;
      if (x < vb.x0 - 400 || x > vb.x1 + 400) continue;
      const yy = y + (SPAN - x) * 0.02;
      ctx.moveTo(x, yy); ctx.lineTo(x + len, yy - len * 0.1);
    }
    ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.strokeStyle = BLACK; ctx.stroke();
  }
}

const BSC = 0.7;   // the bridge is far away: drawn smaller and finer
function drawBridge(ctx, t, vb0) {
  ctx.save();
  ctx.translate(1100, 0); ctx.scale(BSC, BSC); ctx.translate(-1100, 0);
  const vb = { x0: 1100 + (vb0.x0 - 1100) / BSC, x1: 1100 + (vb0.x1 - 1100) / BSC, y0: vb0.y0 / BSC, y1: vb0.y1 / BSC };
  drawStones(ctx, farStones, t, vb, false);
  // arch lines under the spans that still stand
  ctx.beginPath();
  for (const s of BRIDGE.spans) {
    if (!s.whole || t >= s.t) continue;
    const cx = (s.x0 + s.x1) / 2, rx = (s.x1 - s.x0) / 2 - 33;
    for (const k of [1]) {
      ctx.moveTo(cx - rx * k, BRIDGE.deckY + 25 + 190 * k);
      ctx.ellipse(cx, BRIDGE.deckY + 25 + 190 * k, rx * k, 190 * k, 0, Math.PI, TAU);
    }
  }
  ctx.lineWidth = 1.7; ctx.strokeStyle = BLACK; ctx.stroke();
  ctx.restore();
}

// ── floor: a hatched lip, then the ink pool with reflections ─────────────────
const CLEARS = [{ t: T_MEGA, x: 1750, r: 560, keep: 0.62 }, { t: 10.5, x: 2036, r: 250, keep: 0 }, { t: T_SURGE, x: 1700, r: 240, keep: 0 }, { t: T_AIR, x: 2330, r: 300, keep: 0 }];
const RIPPLES = [
  [0.62, 1105, 1.6], [2.28, 1020, 1.2], [2.6, 930, 1.0], [T_PILLAR_DOWN, 380, 1.5], [T_ARCH1, 1560, 1.0], [T_SLICE + 0.5, 1700, 1.2], [T_SPLASH, 2400, 1.8],
  [T_SURGE, 1700, 1.6], [10.5, 2036, 1.5], [11.4, 1930, 0.9], [T_AIR, 2330, 1.6], [T_AIR + 0.75, 2820, 1.5], [15.0, 2560, 1.3], [16.9, 1865, 1.0], [T_MEGA, 1750, 2.6],
];
function drawFloor(ctx, t, vb, px) {
  const xa = vb.x0 - 20, xb = vb.x1 + 20;
  // lip hatching
  ctx.beginPath();
  for (let k = Math.floor(xa / 9); k * 9 < xb; k++) {
    const x = k * 9 + hash(k * 1.7) * 4;
    ctx.moveTo(x, 2); ctx.lineTo(x - 7, 2 + 9 + hash(k * 2.9) * 5);
  }
  ctx.lineWidth = Math.max(1.3, px); ctx.strokeStyle = BLACK; ctx.lineCap = 'round'; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(xa, 0); ctx.lineTo(xb, 0); ctx.lineWidth = Math.max(3.2, 1.8 * px); ctx.stroke();
  // pool
  ctx.beginPath();
  ctx.moveTo(xa, SHEET.y1);
  const q = Math.floor(t * 8);
  for (let x = Math.floor(xa / 70) * 70; x <= xb + 70; x += 70) ctx.lineTo(x, POOL_Y + 2.5 * noise1(x / 70 + q * 0.7, 4));
  ctx.lineTo(xb + 70, SHEET.y1);
  ctx.closePath();
  ctx.fillStyle = BLACK; ctx.fill();
  // paper blown clear of ink by the biggest clashes
  for (const c of CLEARS) {
    if (t < c.t) continue;
    const d = t - c.t;
    const r = c.r * (EASE.out(clamp(d / 0.3)) * (1 - (1 - c.keep) * smooth(0.5, 2.6, d)));
    if (r < 12) continue;
    ctx.beginPath();
    ctx.moveTo(c.x - r, POOL_Y - 1);
    for (let i = 0; i <= 26; i++) {
      const a = Math.PI - (i / 26) * Math.PI;
      const k = 1 + 0.09 * noise1(i * 1.3 + c.t * 7 + Math.floor(t * 6) * 0.2, 31);
      ctx.lineTo(c.x + Math.cos(a) * r * k, POOL_Y - 1 + Math.sin(a) * r * 0.42 * k);
    }
    ctx.closePath();
    ctx.fillStyle = WHITE; ctx.fill();
  }
  // reflections: broken white strokes, wider toward the viewer
  ctx.strokeStyle = WHITE; ctx.lineCap = 'round';
  const q2 = Math.floor(t * 7);
  for (let j = 0; j < 7; j++) {
    const y = POOL_Y + 12 + j * j * 6.5 + j * 8;
    if (y > vb.y1) break;
    const T = 150 + j * 46;
    ctx.beginPath();
    for (let k = Math.floor(xa / T) - 1; k * T < xb; k++) {
      if (hash(k * 7.3 + j * 31.7 + q2 * 0.618) < 0.3) continue;
      const x = k * T + hash(k * 3.1 + j * 17.3) * T + 10 * noise1(t * 1.5 + k, j);
      const len = (30 + hash(k * 5.9 + j * 3.3) * 110) * (1 + j * 0.3);
      ctx.moveTo(x, y); ctx.lineTo(x + len, y + (hash(k + j) - 0.5) * 2);
    }
    ctx.lineWidth = 1.6 + j * 0.75; ctx.stroke();
  }
  // ripples from slams
  for (const [tr, x, size] of RIPPLES) {
    const p = (t - tr) / 0.6;
    if (p <= 0 || p >= 1) continue;
    const k = EASE.out(p);
    ctx.beginPath();
    for (const s of [1, 0.62]) {
      const rx = (50 + 330 * k) * size * s;
      ctx.moveTo(x + rx, POOL_Y + 8); ctx.ellipse(x, POOL_Y + 8, rx, rx * 0.2, 0, 0, Math.PI);
    }
    ctx.lineWidth = Math.max(1.2, 4.5 * (1 - p)); ctx.stroke();
  }
}

// ── ink waves and surges ─────────────────────────────────────────────────────
// { t0, x0, v, life, H, W }  — a crest travelling along the floor, decaying
const WAVES = [
  // the ink that swallowed them at the page turn parts like a curtain
  { t0: -0.6, x0: 1040, v: -560, life: 2.3, H: 760, W: 560, seed: 1, hold: 1.0 },
  { t0: -0.6, x0: 1170, v: 560, life: 2.3, H: 800, W: 560, seed: 2, hold: 1.0 },
  { t0: 2.28, x0: 1000, v: -520, life: 0.6, H: 70, W: 150, seed: 3 },
  { t0: 2.28, x0: 1080, v: 620, life: 0.7, H: 60, W: 150, seed: 4 },
  { t0: T_PILLAR_DOWN, x0: 330, v: -520, life: 1.0, H: 150, W: 240, seed: 5 },
  { t0: T_PILLAR_DOWN, x0: 620, v: 620, life: 1.0, H: 96, W: 200, seed: 6 },
  { t0: T_SLICE + 0.45, x0: 1640, v: -520, life: 0.8, H: 70, W: 170, seed: 7 },
  { t0: T_SLICE + 0.5, x0: 1790, v: 520, life: 0.8, H: 70, W: 170, seed: 8 },
  { t0: T_SPLASH, x0: 2440, v: 620, life: 1.1, H: 210, W: 260, seed: 9 },
  { t0: 10.5, x0: 1990, v: -640, life: 0.8, H: 80, W: 170, seed: 10 },
  { t0: 10.5, x0: 2080, v: 640, life: 0.8, H: 100, W: 180, seed: 11 },
  { t0: 11.4, x0: 1990, v: 600, life: 0.7, H: 60, W: 150, seed: 12 },
  { t0: 15.0, x0: 2640, v: 640, life: 0.8, H: 100, W: 180, seed: 17 },
  { t0: T_AIR, x0: 2300, v: -760, life: 0.9, H: 90, W: 190, seed: 13 },
  { t0: T_AIR + 0.75, x0: 3000, v: 500, life: 0.9, H: 150, W: 220, seed: 14 },
  { t0: T_MEGA + 0.04, x0: 1400, v: -1250, life: 1.0, H: 200, W: 280, seed: 15 },
  { t0: T_MEGA + 0.04, x0: 2100, v: 1250, life: 1.0, H: 200, W: 280, seed: 16 },
];
function drawWave(ctx, x, H, W, dir, seed, t) {
  if (H < 4) return;
  const q = Math.floor(t * 12);
  const X = (k) => x + dir * k * W;
  ctx.beginPath();
  ctx.moveTo(X(-1.25), POOL_Y + 4);
  ctx.bezierCurveTo(X(-0.7), POOL_Y - 2, X(-0.42), -H * 0.72, X(-0.06), -H);
  ctx.bezierCurveTo(X(0.1), -H * 1.06, X(0.26), -H * 0.98, X(0.3), -H * 0.74);
  ctx.bezierCurveTo(X(0.2), -H * 0.8, X(0.1), -H * 0.6, X(0.14), -H * 0.36);
  ctx.bezierCurveTo(X(0.18), -H * 0.14, X(0.28), -2, X(0.46), POOL_Y + 4);
  ctx.closePath();
  ctx.fillStyle = BLACK; ctx.fill();
  // highlights on the back of the wave
  ctx.beginPath();
  for (const [k0, s] of [[-0.82, 0.5], [-0.6, 0.72], [-0.36, 0.86]]) {
    if (hash(seed * 3.1 + k0 * 9 + q * 0.31) < 0.25) continue;
    ctx.moveTo(X(k0), -H * (s - 0.34));
    ctx.quadraticCurveTo(X(k0 + 0.2), -H * (s - 0.08), X(k0 + 0.3), -H * s);
  }
  ctx.lineWidth = Math.max(2, H * 0.022); ctx.strokeStyle = WHITE; ctx.lineCap = 'round'; ctx.stroke();
  // spray off the lip
  ctx.fillStyle = BLACK;
  const n = 5 + Math.round(H / 40);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const h1 = hash(seed * 7.7 + i * 3.3 + q * 0.77), h2 = hash(seed * 1.3 + i * 9.1 + q * 0.39);
    const sx = X(0.16 + h1 * 0.5), sy = -H * (0.55 + h2 * 0.7);
    const rr = 2.5 + hash(i * 5.1 + seed) * (3 + H * 0.03);
    ctx.moveTo(sx + rr * 1.8, sy);
    ctx.ellipse(sx, sy, rr * 1.8, rr, -dir * 0.5, 0, TAU);
  }
  ctx.fill();
}
function drawWaves(ctx, t, vb) {
  for (const w of WAVES) {
    const d = t - w.t0;
    if (d <= 0 || d >= w.life) continue;
    const x = w.x0 + w.v * d;
    if (x < vb.x0 - 900 || x > vb.x1 + 900) continue;
    const fall = w.hold ? 1 - smooth(w.hold, w.life, d) : Math.pow(1 - d / w.life, 0.8);
    drawWave(ctx, x, w.H * EASE.out(clamp(d / 0.12)) * fall, w.W, Math.sign(w.v), w.seed, t);
  }
}
function drawSurge(ctx, t) {
  if (t < T_SPLASH || t > 9.8) return;
  drawWave(ctx, surgeX(t) - 26, surgeH(t), 430, -1, 40, t);
}

// ── the pool climbs each weapon in turn (the switch to ink hides in a lightning flash); ──
// ── on the last wind-up ink pours into both of them                                     ──
const CLIMB = { gs: [1.06, T_GROW], hm: [1.5, T_GROW_B] };
const FLASHES = [T_GROW, T_GROW_B];
function drawInkClimb(ctx, t, st) {
  for (const w of st.weapons) {
    const c = CLIMB[w.id];
    if (!c || w.ink || t < c[0]) continue;
    const p = EASE.io(prog(t, c[0], c[1] - 0.02));
    const L = w.spec.len;
    const lo = w.tip[1] < w.tail[1] ? w.tip : w.tail;
    // runners feeding it from the pool
    for (let k = 0; k < 3; k++) {
      const pts = [];
      const bx = lo[0] + (k - 1) * 42;
      for (let i = 0; i <= 6; i++) pts.push([lerp(bx, lo[0], i / 6) + Math.sin(i * 1.4 + k * 2 + t * 16) * 6, lerp(POOL_Y + 8, -lo[1] - 6, i / 6)]);
      stroke(ctx, pts, 7 - k * 1.5);
    }
    ctx.save();
    ctx.translate(w.tail[0], -w.tail[1]);
    ctx.rotate(Math.atan2(-(w.tip[1] - w.tail[1]), w.tip[0] - w.tail[0]));
    ctx.scale(w.scale, w.scale);
    ctx.beginPath();
    if (w.type === 'hammer') { ctx.rect(0, -4.5, L - 40, 9); ctx.rect(L - 58, -40, 58, 80); }
    else {
      ctx.rect(0, -4.5, 52, 9); ctx.rect(48, -42, 8, 84);
      ctx.moveTo(52, -17); ctx.lineTo(L - 40, -17); ctx.lineTo(L, 0); ctx.lineTo(L - 40, 17); ctx.lineTo(52, 17); ctx.closePath();
    }
    ctx.clip();
    const x0 = L * (1 - p) - 6;
    ctx.beginPath();
    ctx.moveTo(L + 6, -96); ctx.lineTo(L + 6, 96);
    for (let i = 0; i <= 12; i++) ctx.lineTo(x0 + (i % 2 ? 10 : -8) + 6 * Math.sin(t * 34 + i * 1.7), 96 - i * 16);
    ctx.closePath();
    ctx.fillStyle = BLACK; ctx.fill();
    ctx.restore();
  }
}
function drawTendrils(ctx, t, st) {
  drawInkClimb(ctx, t, st);
  // last wind-up: ink streams out of the pool and the sky into both weapons
  const pc = prog(t, 19.2, 20.0) * (1 - prog(t, T_CLASH - 0.6, T_CLASH - 0.1));
  if (pc > 0) {
    ctx.beginPath();
    for (const w of st.weapons) {
      const c = [w.tail[0] * 0.3 + w.tip[0] * 0.7, -(w.tail[1] * 0.3 + w.tip[1] * 0.7)];
      for (let i = 0; i < 26; i++) {
        const a = hash(i * 3.7 + (w.id === 'gs' ? 0 : 50)) * TAU;
        const u = ((t * (1.3 + hash(i * 1.9) * 1.2) + hash(i * 7.1)) % 1);
        if (hash(i * 2.3) > pc) continue;
        const r0 = lerp(420, 40, u), r1 = r0 + 30 + 70 * (1 - u);
        const sw = 0.8 * (1 - u);
        ctx.moveTo(c[0] + Math.cos(a + sw) * r1, c[1] + Math.sin(a + sw) * r1 * 0.8);
        ctx.quadraticCurveTo(c[0] + Math.cos(a + sw * 0.6) * (r0 + r1) / 2, c[1] + Math.sin(a + sw * 0.6) * (r0 + r1) / 2 * 0.8, c[0] + Math.cos(a + sw * 0.3) * r0, c[1] + Math.sin(a + sw * 0.3) * r0 * 0.8);
      }
    }
    ctx.lineWidth = 3.4; ctx.strokeStyle = BLACK; ctx.lineCap = 'round'; ctx.stroke();
  }
}

// ── the end: weapons burst into ink strokes, a white shockwave erases everything ─────────
const C0 = [CLASH[0], -CLASH[1]];
const blastR = (t) => { const d = t - T_SHATTER; return d <= 0 ? 0 : 70 + 2500 * Math.pow(d / 0.85, 1.5); };
let shards = null;
function shardInit() {
  if (shards) return shards;
  const st = scene.state(T_SHATTER - 0.02);
  const r = rng(977);
  shards = [];
  for (const w of st.weapons) {
    const n = 170;
    for (let i = 0; i < n; i++) {
      const u = r();
      const p = [lerp(w.tail[0], w.tip[0], u), -lerp(w.tail[1], w.tip[1], u)];
      const big = w.type === 'hammer' ? u > 0.78 : u > 0.2;
      let a = Math.atan2(p[1] - C0[1], p[0] - C0[0]) + (r() - 0.5) * 1.5;
      if (r() < 0.3) a = r() * TAU;
      const sp = 300 + r() * r() * 2600;
      shards.push({ p, a, sp, len: (big ? 26 : 14) + r() * (big ? 80 : 40), w: big ? 3 + r() * 8 : 2 + r() * 3, om: (r() - 0.5) * 16, rot: r() * TAU, life: 0.5 + r() * 0.6 });
    }
  }
  return shards;
}
function drawShards(ctx, t) {
  const d = t - T_SHATTER;
  if (d < 0) return;
  const list = shardInit();
  for (const [w0, w1, lw] of [[0, 4, 2.6], [4, 7.5, 5.5], [7.5, 99, 9]]) {
    ctx.beginPath();
    for (const s of list) {
      if (s.w < w0 || s.w >= w1 || d > s.life) continue;
      const k = 1 - Math.exp(-d * 2.4);
      const x = s.p[0] + Math.cos(s.a) * s.sp * k * 0.8, y = s.p[1] + Math.sin(s.a) * s.sp * k * 0.8 + 260 * d * d;
      const ang = s.rot + s.om * d, l = s.len * (1 - d / s.life) * 0.5;
      ctx.moveTo(x - Math.cos(ang) * l, y - Math.sin(ang) * l);
      ctx.lineTo(x + Math.cos(ang) * l, y + Math.sin(ang) * l);
    }
    ctx.lineWidth = lw; ctx.strokeStyle = BLACK; ctx.lineCap = 'round'; ctx.stroke();
  }
}
/** the white shockwave: everything behind the fighters is wiped back to blank paper */
function drawBlast(ctx, t) {
  const R = blastR(t);
  if (R <= 0) return;
  const q = Math.floor(t * 30);
  ctx.beginPath();
  for (let i = 0; i <= 90; i++) {
    const a = (i / 90) * TAU;
    const r = R * (1 + 0.035 * noise1(i * 0.8 + q * 0.4, 51));
    i ? ctx.lineTo(C0[0] + Math.cos(a) * r, C0[1] + Math.sin(a) * r) : ctx.moveTo(C0[0] + Math.cos(a) * r, C0[1] + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = WHITE; ctx.fill();
  // the front: ink and rubble driven outward ahead of it
  const d = t - T_SHATTER;
  ctx.beginPath();
  for (let i = 0; i < 150; i++) {
    const a = (i / 150) * TAU + hash(i * 3.3 + q) * 0.05;
    const r0 = R * (0.97 + hash(i * 1.7 + q * 0.9) * 0.05), len = (30 + hash(i * 5.1 + q * 0.3) * 190) * (0.5 + d * 1.6);
    ctx.moveTo(C0[0] + Math.cos(a) * r0, C0[1] + Math.sin(a) * r0);
    ctx.lineTo(C0[0] + Math.cos(a) * (r0 + len), C0[1] + Math.sin(a) * (r0 + len));
  }
  ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.strokeStyle = BLACK; ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 70; i++) {
    const a = hash(i * 9.7) * TAU, r0 = R * (0.55 + hash(i * 2.9 + q * 0.2) * 0.4), len = 20 + hash(i * 4.3) * 60;
    ctx.moveTo(C0[0] + Math.cos(a) * r0, C0[1] + Math.sin(a) * r0);
    ctx.lineTo(C0[0] + Math.cos(a) * (r0 + len), C0[1] + Math.sin(a) * (r0 + len));
  }
  ctx.lineWidth = 2; ctx.stroke();
}

// ── screen-space storm: ink streaks whipping past the lens ───────────────────
function drawScreenStorm(ctx, t, W, H) {
  const fade = 1 - prog(t, T_CLASH, T_CLASH + 0.25);
  if (fade <= 0) return;
  const gust = 1 + 0.6 * smooth(19, 23, t);
  for (const [lw, n, seed] of [[2, 16, 1], [4.5, 7, 2]]) {
    ctx.beginPath();
    for (let i = 0; i < Math.round(n * fade * gust); i++) {
      const sp = (2600 + hash(i * 3.7 + seed * 11) * 2800) * gust;
      const span = W + 1400;
      let x = (hash(i * 1.9 + seed * 3) * span - sp * t) % span;
      if (x < 0) x += span;
      x -= 700;
      const y = hash(i * 9.1 + seed * 5) * (H + 200) - 100 + (span - x) * 0.07;
      const len = 180 + hash(i * 5.3 + seed) * 420;
      ctx.moveTo(x, y); ctx.lineTo(x + len, y - len * 0.13);
    }
    ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.strokeStyle = BLACK; ctx.stroke();
  }
  // fat drops
  ctx.fillStyle = BLACK;
  ctx.beginPath();
  for (let i = 0; i < Math.round(9 * fade * gust); i++) {
    const sp = 1900 + hash(i * 4.7) * 1800, span = W + 600;
    let x = (hash(i * 2.9) * span - sp * t) % span;
    if (x < 0) x += span;
    x -= 300;
    const y = hash(i * 6.1) * H + (span - x) * 0.1;
    const rr = 5 + hash(i * 8.3) * 9;
    ctx.moveTo(x + rr * 3, y);
    ctx.ellipse(x, y, rr * 3, rr, -0.14, 0, TAU);
  }
  ctx.fill();
}

S.env({
  page(ctx, t, { vb }) {
    ctx.fillStyle = WHITE;
    ctx.fillRect(SHEET.x0, SHEET.y0, SHEET.x1 - SHEET.x0, SHEET.y1 - SHEET.y0);
    // what is left of the ruled lines
    ctx.beginPath();
    for (let y = -64; y > Math.max(vb.y0, -900); y -= 64) {
      ctx.moveTo(Math.max(vb.x0, SHEET.x0), y); ctx.lineTo(Math.min(vb.x1, SHEET.x1), y);
    }
    ctx.lineWidth = 1.1; ctx.strokeStyle = BLACK; ctx.stroke();
  },
  far2(ctx, t, { vb }) { drawSky(ctx, t, vb); },
  far(ctx, t, { vb }) {
    drawWind(ctx, t, vb);
    drawBridge(ctx, t, vb);
  },
  stage(ctx, t, { vb, px }) {
    drawFloor(ctx, t, vb, px);
    drawStones(ctx, stones, t, vb, false);
    drawSurge(ctx, t);
    drawWaves(ctx, t, vb);
  },
  mid(ctx, t, { st }) {
    if (t >= T_PICK && t < T_THROW) drawBoulder(ctx, t, st);
    drawBlast(ctx, t);
  },
  over(ctx, t, { vb, st }) {
    drawStones(ctx, stones, t, vb, true);
    if (t >= T_THROW) drawBoulder(ctx, t, st);
    drawTendrils(ctx, t, st);
    drawShards(ctx, t);
  },
  screen(ctx, t, { W, H }) {
    drawScreenStorm(ctx, t, W, H);
    for (const tf of FLASHES) if (t >= tf && t < tf + 0.05) { ctx.fillStyle = WHITE; ctx.fillRect(0, 0, W, H); }   // lightning
    if (t >= T_WHITE) { ctx.fillStyle = WHITE; ctx.fillRect(0, 0, W, H); }
  },
  surface: (x, t, J) => (t > T_CLASH || Math.min(J.fF[1], J.fB[1]) > 60 ? null : 0),
});

scene = S.build();
export default scene;
