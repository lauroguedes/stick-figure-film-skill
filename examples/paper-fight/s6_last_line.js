// SCENE 6: "The Last Line" (20 s, unarmed → one rifle). The ending.
//
// The same notebook page as the film's opening (layout mirrored from ref_poc.js: set square,
// protractor, cubes, formulas, foreground shapes, the pencil planted at x=1262), scarred by the
// whole film: the brick wall is a broken stump, the floor is cracked and torn, the page edges are
// ripped, ink from the storm is spattered across it. And, by the set square, somebody once
// doodled a rifle. It is there from the first frame.
//
// PART 1: the fight (0–9 s), told in close-ups and cuts
//   0.0–0.5   the white-out is scratched away, stroke by stroke
//   0.0–3.4   spent. A's head comes up, B's fists close, the stomp, the two heads in profile.
//   3.4–4.3   B's same flying overhand. A steps inside, takes the arm, turns: B goes right over
//             the top of him and craters the page (catch 3.77, slam + impact frame 4.12).
//   4.3–6.0   A gives ground; B gets his hands under him and stands. One last time.
//   6.0–7.0   the haymaker; A slides under it (the opening's slide), comes up behind him and
//             unwinds the spinning kick: slow-motion contact 6.46–7.00.
//   7.0–8.1   full speed (impact frame 7.00): B is launched the length of the stage, lands on his
//             back, skids, and is stopped by the wall stump (impact frame 7.62). He stays down.
// PART 2: the new ending (8.2–20 s)
//   9.0–11.0  B on the ground: a fist twitches on his chest, a hand drags down the brickwork, the
//             head lifts, he pushes up on one arm: and it gives out. Alive; finished.
//   11.0–12.8 A looks away from him. Sees the doodle. Walks to it (hand on it 12.46) and peels it
//             off the page (12.76): its dashed outline stays behind.
//   12.8–16.1 the rifle is real. He walks back: slow, heavy, deliberate. B hears him, tries once
//             more to rise, cannot, turns his head.
//   16.1–18.6 the bolt (16.35). The rifle comes up to the shoulder and down onto B (17.05). B lifts
//             one hand. Slow push along the barrel.
//   18.6      he fires: and the picture is already black. The shot is never seen.
//
// Stage: A starts at x=820 facing right, B at x=1140 facing left (the opening marks). The wall
// stump starts at x=1620. The pencil is a free weapon and is never touched.

import { createScene } from '../engine/scene.js';
import { flight, FIGHTER_A } from '../engine/moves.js';
import { figureStrokes } from '../engine/rig.js';
import { rng, prog, EASE, hash, lerp } from '../engine/util.js';
import { sketchPoly, hatch, blob, stroke, BLACK, WHITE } from '../engine/ink.js';
import {
  drawPage, drawGround, makeBrickWall, makeDebris, crackSet, drawCracks, drawTear, drawSkids,
  cube, protractor, setSquare, scribble, DEFAULT_PAGE,
} from '../engine/kit.js';

const WALL_X = 1620;
const T_IN = 0.5;            // the white-out is scratched away over the first half second
const T_STOMP = 2.5;
const T_LAUNCH = 3.56;       // B leaves the ground
const T_CATCH = 3.77;        // A's hands close on B's punching arm
const T_SLAM = 4.12;         // B hits the page (impact frame)
const T_KICK = 6.46;         // foot meets head: slow motion starts
const T_REL = 7.0;           // …and ends: full speed (impact frame)
const T_LAND = 7.42;         // B comes down on his back
const T_CRASH = 7.62;        // …and the wall stump stops him (impact frame)
const T_GRAB = 12.46;        // A's hand on the doodle
const T_PEEL = 12.76;        // it comes off the page
const T_BOLT = 16.35;
const T_SHOT = 18.6;         // the cut to black. Nothing is drawn after this.
const T_AIM = 16.66;         // (a camera cut) from here A's support arm is drawn in front of the rifle

const S = createScene({
  id: 's6', title: 'The Last Line', duration: 20,
  poses: {
    // flat on his back after the throw (facing left: head to the right, at A's feet)
    down: { hip: [0, 9], lean: -86, hF: [60, 6], hB: [72, -8], fF: [100, 2], fB: [88, 2], eF: 1, eB: 1 },
    // where he ends: flat at the foot of the stump, one fist on his chest, the other arm flopped
    // up against the brickwork
    bRest: { hip: [0, 9], lean: -86, tilt: 0, hF: [50, 9], hB: [-43, 50], fF: [102, 3], fB: [97, 3], eF: 1, eB: 1 },
    // A carrying the rifle low across the body (the support hand is placed by the rig)
    carry: { hip: [0, 90], lean: 10, bend: 5, tilt: 8, hF: [-4, -44], hB: [40, -60] },
  },
});

// The grip: where A's hands hold B's wrist through the throw (world x, height).
const G = [
  [892, 147],   // 0 catch
  [868, 150],   // 1
  [852, 142],   // 2
  [840, 128],   // 3 top: B is upside down above him
  [826, 110],   // 4
  [800, 80],    // 5
  [792, 50],    // 6
  [782, 24],    // 7 slam: pinned across B's chest
];
const off = (p, dx, dy) => [p[0] + dx, p[1] + dy];
// the kick: where A's foot meets B's head when time slows, and where it has pushed it to when time resumes
const KICK_A = [849, 143];
const KICK_B = [888, 160];
const PIVOT = [764, 0];      // A's standing foot through the kick
const RIFLE0 = [566, 222];   // the doodle: centre of the rifle drawn on the page, muzzle to the left
const RGRIP = [601.2, 222];  // its grip (g = 0.3 from the butt)
const A_END = 1335;          // where A stops, over B

// ── FIGHTER A: The Technician ───────────────────────────────────────────────
const stA = { fF: [34, 0], fB: [-40, 0] };                 // his feet through the throw
const gA = { fF: [30, 0], fBw: PIVOT };                    // …after the kick
const wA = { p: 'carry' };
const A_KEYS = [
  // spent: head hanging, arms down, swaying
  { t: 0.0, x: 820, face: 1, hip: [0, 89], lean: 22, bend: 15, tilt: 22, hF: [12, -62], hB: [-2, -66], fF: [16, 0], fB: [-18, 0] },
  { t: 0.4, hip: [0, 93], lean: 17, bend: 12, tilt: 18, hF: [12, -64], hB: [-2, -67], fF: [16, 0], fB: [-18, 0] },
  { t: 0.66, hip: [-10, 93], lean: 2, bend: 5, tilt: 2, hF: [16, -62], hB: [0, -68], fF: [16, 0], fB: [-18, 0] },
  // …nearly goes over backwards: a step catches him
  { t: 0.86, x: 800, hip: [-10, 82], lean: -9, tilt: -8, hF: [34, -36], hB: [-32, -44], fF: [37, 0], fB: [-34, 0], e: 'in' },
  { t: 1.08, x: 808, hip: [2, 84], lean: 22, bend: 13, tilt: 26, hF: [20, -54], hB: [-4, -62], fF: [29, 0], fB: [-42, 0], e: 'out' },
  // (close-up) the head comes up
  { t: 1.28, hip: [2, 83], lean: 23, bend: 14, tilt: 28, hF: [20, -55], hB: [-4, -62], fF: [29, 0], fB: [-42, 0] },
  { t: 1.62, x: 812, hip: [0, 95], lean: 5, bend: 3, tilt: -8, hF: [18, -46], hB: [0, -56], fF: [25, 0], fB: [-38, 0], e: 'out' },
  // the hands find the old guard: lower and heavier than the first time
  { t: 1.92, x: 820, p: 'aStance', hip: [-4, 82], lean: 12, bend: 7, hF: [34, -10], hB: [14, -22], fF: [34, 0] },
  { t: 2.1, p: 'aStance', hip: [-4, 78], lean: 13, bend: 7, hF: [36, -6], hB: [15, -18], fF: [34, 0], e: 'in' },
  { t: 2.36, p: 'aStance', hip: [-4, 84], lean: 11, bend: 6, hF: [38, -2], hB: [16, -14], fF: [34, 0] },
  // the held beat: only breathing
  { t: 2.8, p: 'aStance', hip: [-4, 81], lean: 13, bend: 6, hF: [38, -4], hB: [16, -16], fF: [34, 0] },
  { t: 3.22, p: 'aStance', hip: [-4, 85], lean: 10, bend: 5, hF: [38, -1], hB: [16, -13], fF: [34, 0] },
  // he has seen this punch before
  { t: 3.48, p: 'aStance', hip: [-9, 84], lean: 3, hF: [34, 4], hB: [18, -8], fF: [34, 0] },
  { t: 3.57, hip: [0, 74], lean: 16, hF: [32, 2], hB: [18, -6], fF: [34, 0], fB: [-28, 0] },
  // steps INSIDE it
  { t: 3.67, x: 868, hip: [6, 68], lean: 20, bend: 6, hF: [34, 18], hB: [24, 8], fF: [36, 0], fB: [-78, 0], e: 'in' },
  // turns his back in under the arm and takes it in both hands
  { t: T_CATCH, x: 905, face: -1, hip: [-4, 70], lean: 10, bend: 6, hFw: G[0], hBw: off(G[0], 20, 9), ...stA },
  // loads him, straightens his legs under him, bows: and B's own speed takes him over the top
  { t: 3.81, hip: [-5, 68], lean: 20, bend: 8, tilt: -3, hFw: G[1], hBw: off(G[1], 17, 12), ...stA, e: 'lin', er: 'lin' },
  { t: 3.85, hip: [-6, 70], lean: 36, bend: 9, tilt: -6, hFw: G[2], hBw: off(G[2], 15, 13), ...stA, e: 'lin', er: 'lin' },
  { t: 3.9, hip: [-10, 84], lean: 60, bend: 10, tilt: -10, hFw: G[3], hBw: off(G[3], 13, 13), ...stA, e: 'lin', er: 'lin' },
  { t: 3.95, hip: [-11, 82], lean: 74, bend: 12, tilt: -12, hFw: G[4], hBw: off(G[4], 12, 13), ...stA, e: 'lin', er: 'lin' },
  { t: 4.0, hip: [-12, 80], lean: 82, bend: 14, tilt: -14, hFw: G[5], hBw: off(G[5], 11, 14), ...stA, e: 'lin', er: 'lin' },
  { t: 4.06, hip: [-8, 70], lean: 87, bend: 15, tilt: -19, hFw: G[6], hBw: off(G[6], 10, 12), ...stA, e: 'lin', er: 'lin' },
  { t: T_SLAM, hip: [-4, 60], lean: 88, bend: 16, tilt: -24, hFw: G[7], hBw: off(G[7], 11, 9), ...stA, e: 'lin', er: 'lin' },
  { t: 4.27, same: true },
  // lets go, straightens: and the effort nearly drops him. He gives ground.
  { t: 4.46, hip: [-8, 82], lean: 38, bend: 12, tilt: 6, hF: [26, -52], hB: [6, -60], ...stA },
  { t: 4.66, x: 940, hip: [-6, 90], lean: 2, bend: 5, tilt: -4, hF: [30, -26], hB: [-14, -46], fF: [71, 0], fB: [-63, 0] },
  { t: 4.84, x: 975, hip: [-8, 90], lean: -5, bend: 2, tilt: -6, hF: [34, -18], hB: [-22, -40], fF: [26, 0], fB: [-26, 0] },
  { t: 5.04, x: 1015, hip: [-10, 72], lean: 18, bend: 10, tilt: 6, hF: [38, -30], hB: [-28, -34], fF: [68, 0], fB: [-58, 0], e: 'in' },
  { t: 5.24, x: 1030, hip: [-6, 84], lean: 12, bend: 8, tilt: 4, hF: [30, -26], hB: [6, -40], fF: [29, 0], fB: [-42, 0], e: 'out' },
  { t: 5.5, p: 'aStance', hip: [-4, 82], lean: 12, bend: 7, hF: [34, -10], hB: [14, -22], fF: [29, 0], fB: [-42, 0] },
  { t: 5.76, p: 'aStance', hip: [-4, 86], lean: 9, bend: 5, hF: [38, -2], hB: [16, -14], fF: [29, 0], fB: [-42, 0] },
  { t: 5.9, p: 'aStance', hip: [-9, 84], lean: 2, hF: [34, 4], hB: [18, -8], fF: [29, 0], fB: [-42, 0] },
  // under the leaping haymaker: the slide that opened the fight. He is already down when the fist arrives.
  { t: 5.98, x: 1020, hip: [2, 56], lean: 38, bend: 10, hF: [28, -12], hB: [10, -22], fF: [44, 0], fB: [-34, 0], e: 'in' },
  { t: 6.06, x: 950, hip: [-10, 32], lean: 72, tilt: -40, hF: [52, 4], hB: [-34, -6], fF: [64, 0], fB: [-36, 0], kB: -1, slide: true, e: 'lin', er: 'lin' },
  { t: 6.14, x: 862, hip: [-8, 33], lean: 68, tilt: -36, hF: [46, -2], hB: [-32, -8], fF: [62, 0], fB: [-34, 0], kB: -1, slide: true, e: 'lin', er: 'lin' },
  { t: 6.22, x: 780, hip: [-6, 36], lean: 60, tilt: -30, hF: [40, -10], hB: [-30, -10], fF: [60, 0], fB: [-30, 0], kB: -1, slide: true, e: 'out', er: 'out' },
  // up behind him, turning
  { t: 6.31, x: 770, face: 1, hip: [4, 78], lean: 14, hF: [10, -34], hB: [-22, -28], fF: [14, 0], fB: [-22, 0] },
  // …and unwinds: the spinning kick from the first exchange
  { t: 6.4, hip: [0, 90], lean: -8, hF: [14, -26], hB: [-18, -30], fF: [22, 64], fBw: PIVOT, e: 'in' },
  { t: T_KICK, hip: [-4, 92], lean: -32, tilt: 20, hF: [24, -40], hB: [-34, -18], fFw: KICK_A, fBw: PIVOT, e: 'snap' },
  // slow motion: the foot drives through
  { t: T_REL, x: 794, hip: [22, 92], lean: -42, tilt: 24, hF: [26, -42], hB: [-38, -14], fFw: KICK_B, fBw: PIVOT, e: 'lin', er: 'lin' },
  { t: 7.08, hip: [10, 90], lean: -30, tilt: 16, hF: [20, -36], hB: [-36, -16], fF: [102, 124], fBw: PIVOT, e: 'out' },
  { t: 7.24, hip: [0, 88], lean: -10, hF: [20, -30], hB: [-30, -20], fF: [60, 60], fBw: PIVOT },
  { t: 7.42, hip: [-2, 74], lean: 16, bend: 8, hF: [30, -18], hB: [8, -30], ...gA, e: 'in' },
  // guard, out of habit. Nothing comes.
  { t: 7.66, p: 'aStance', hip: [-4, 82], lean: 12, bend: 7, hF: [34, -8], hB: [14, -20], ...gA },
  { t: 8.0, p: 'aStance', hip: [-4, 86], lean: 9, bend: 6, hF: [36, -5], hB: [15, -17], ...gA },
  { t: 8.34, p: 'aStance', hip: [-4, 82], lean: 12, bend: 7, hF: [35, -8], hB: [14, -20], ...gA },
  // the arms come down
  { t: 8.6, hip: [-3, 86], lean: 12, bend: 8, tilt: 4, hF: [28, -30], hB: [8, -42], ...gA },
  { t: 8.96, hip: [-2, 92], lean: 13, bend: 9, tilt: 10, hF: [10, -66], hB: [-6, -68], ...gA },
  { t: 9.7, hip: [-2, 90], lean: 15, bend: 10, tilt: 14, hF: [10, -66], hB: [-6, -68], ...gA },
  { t: 10.5, hip: [-2, 92], lean: 13, bend: 9, tilt: 10, hF: [10, -66], hB: [-6, -68], ...gA },
  { t: 11.1, hip: [-2, 91], lean: 13, bend: 9, tilt: 8, hF: [10, -66], hB: [-6, -68], ...gA },
  // he looks away from him. And sees it.
  { t: 11.34, face: -1, x: 786, hip: [0, 93], lean: 3, bend: 3, tilt: -10, hF: [8, -66], hB: [-8, -68], fF: [-26, 0], fB: [23, 0] },
  { t: 11.86, hip: [0, 94], lean: 5, bend: 3, tilt: -16, hF: [8, -66], hB: [-8, -68], fF: [-26, 0], fB: [23, 0] },
  // two steps
  { t: 12.08, x: 715, hip: [0, 88], lean: 12, bend: 5, tilt: -10, hF: [16, -58], hB: [-14, -62], fF: [47, 0], fB: [-52, 0] },
  { t: 12.3, x: 640, hip: [0, 92], lean: 9, tilt: -14, hF: [14, -36], hB: [-8, -62], fF: [-32, 0], fB: [36, 0] },
  // his hand flat on the drawing…
  { t: T_GRAB, x: 632, hip: [2, 97], lean: 6, tilt: -18, hFw: RGRIP, hB: [-10, -56], fF: [-40, 0], fB: [27, 0] },
  // …it resists… and it comes away from the page
  { t: T_GRAB + 0.16, hip: [-2, 96], lean: 2, tilt: -14, hFw: off(RGRIP, 5, -6), hB: [-14, -52], fF: [-40, 0], fB: [27, 0], e: 'in' },
  { t: T_PEEL, hip: [-9, 91], lean: -6, tilt: 4, hFw: off(RGRIP, 12, -88), hB: [-26, -38], fF: [-40, 0], fB: [27, 0], e: 'snap' },
  // holds it out level, side-on, looking at it
  { t: 12.92, hip: [-6, 92], lean: -2, tilt: 12, hFw: off(RGRIP, 8, -92), hB: [-22, -42], fF: [-40, 0], fB: [27, 0] },
  // (the camera is on the outline it left: he turns and takes it in both hands, unseen)
  { t: 13.06, face: 1, x: 640, ...wA, hip: [0, 88], lean: 10, tilt: 22, fF: [32, 0], fB: [-36, 0] },
  // weighs it
  { t: 13.26, ...wA, hip: [0, 92], lean: 6, tilt: 24, hF: [-2, -38], fF: [32, 0], fB: [-36, 0] },
  { t: 13.42, ...wA, hip: [0, 90], tilt: 14, fF: [32, 0], fB: [-36, 0] },
  { t: 13.52, ...wA, hip: [0, 91], tilt: 4, fF: [32, 0], fB: [-36, 0] },
  // the walk: slow, heavy, deliberate
  { t: 13.9, ...wA, x: 695, hip: [0, 86], lean: 12, fF: [-26, 0], fB: [47, 0] },
  { t: 14.02, ...wA, hip: [0, 83], lean: 13, fF: [-26, 0], fB: [47, 0] },
  { t: 14.4, ...wA, x: 765, hip: [0, 86], lean: 12, fF: [47, 0], fB: [-26, 0] },
  { t: 14.52, ...wA, hip: [0, 83], lean: 13, fF: [47, 0], fB: [-26, 0] },
  // (the camera is on B's hand: the page between them goes by unseen)
  { t: 14.64, ...wA, x: 870, hip: [0, 86], lean: 14, fF: [-50, 16], fB: [48, 0], e: 'lin', er: 'lin' },
  { t: 14.76, ...wA, x: 970, hip: [0, 86], lean: 14, fF: [48, 0], fB: [-50, 16], e: 'lin', er: 'lin' },
  { t: 14.88, ...wA, x: 1060, hip: [0, 86], lean: 14, fF: [-50, 16], fB: [48, 0], e: 'lin', er: 'lin' },
  { t: 15.0, ...wA, x: 1120, hip: [0, 85], lean: 12, fF: [32, 0], fB: [-37, 0], e: 'out', er: 'out' },
  // …and his feet arrive
  { t: 15.28, ...wA, x: 1185, hip: [0, 86], lean: 12, fF: [-36, 0], fB: [42, 0] },
  { t: 15.4, ...wA, hip: [0, 83], lean: 13, fF: [-36, 0], fB: [42, 0] },
  { t: 15.7, ...wA, x: 1258, hip: [0, 86], lean: 12, fF: [39, 0], fB: [-35, 0] },
  { t: 15.82, ...wA, hip: [0, 83], lean: 13, fF: [39, 0], fB: [-35, 0] },
  { t: 16.1, ...wA, x: A_END, hip: [0, 87], lean: 11, tilt: 14, fF: [-42, 0], fB: [28, 0] },
  { t: 16.22, ...wA, hip: [0, 90], lean: 9, tilt: 18, fF: [-42, 0], fB: [28, 0] },
  // works the bolt
  { t: 16.3, hip: [0, 90], lean: 8, bend: 4, tilt: 18, hF: [-2, -40], hBw: [1346, 121], fF: [-42, 0], fB: [28, 0] },
  { t: T_BOLT, hip: [-2, 90], lean: 6, bend: 4, tilt: 18, hF: [-2, -40], hBw: [1330, 124], fF: [-42, 0], fB: [28, 0], e: 'snap' },
  { t: 16.46, hip: [0, 90], lean: 8, bend: 4, tilt: 18, hF: [-2, -40], hBw: [1347, 121], fF: [-42, 0], fB: [28, 0], e: 'snap' },
  { t: 16.62, hip: [0, 90], lean: 8, bend: 4, tilt: 16, hF: [-2, -40], hB: [40, -52], fF: [-42, 0], fB: [28, 0] },
  // shoulders it and brings it down onto him
  // (butt in the shoulder, trigger hand at the grip, support hand under the fore-end with the elbow out and down)
  { t: 17.05, hip: [0, 90], lean: 16, bend: 4, tilt: 24, hF: [34, -28], hB: [54, -51], fF: [-42, 0], fB: [28, 0], e: 'io' },
  { t: 18.0, hip: [0, 89], lean: 17, bend: 4, tilt: 25, hF: [34, -28], hB: [54, -51], fF: [-42, 0], fB: [28, 0] },
  { t: 20.0, same: true },
];

// ── FIGHTER B: The Powerhouse ───────────────────────────────────────────────
const bSt = { fF: [46, 0], fB: [-46, 0] };
const kF = { fF: [23, 0], fB: [-27, 0] };                 // his feet when the kick finds him
const pushUp = { hFw: [828, 2], hBw: [808, 2], eF: 1, eB: 1 };
const R = { p: 'bRest', x: 1500 };
const FL = { hF: [64, -18] };                              // an arm lying on the page in front of him
const R2 = { ...R, ...FL, hB: [-45, 12], eB: -1 };          // …after his arm has given out
const HAND_UP = [1532, 58];                                // B's raised hand at the end
const B_KEYS = [
  // heaving, hands on his thighs
  { t: 0.0, x: 1140, face: -1, hip: [-6, 72], lean: 44, bend: 14, tilt: 10, hF: [-4, -70], hB: [-40, -62], ...bSt },
  { t: 0.45, hip: [-6, 77], lean: 39, bend: 12, tilt: 8, hF: [-2, -72], hB: [-38, -64], ...bSt },
  { t: 0.9, hip: [-6, 71], lean: 45, bend: 15, tilt: 10, hF: [-4, -70], hB: [-40, -62], ...bSt },
  { t: 1.3, hip: [-6, 77], lean: 39, bend: 12, tilt: 6, hF: [-2, -72], hB: [-38, -64], ...bSt },
  // pushes himself upright; (close-up) the fists close
  { t: 1.62, hip: [-4, 88], lean: 20, bend: 8, tilt: 2, hF: [16, -58], hB: [-16, -60], ...bSt },
  { t: 1.8, hip: [-4, 91], lean: 14, bend: 6, tilt: 0, hF: [13, -65], hB: [-13, -65], ...bSt },
  { t: 1.88, hip: [-4, 91], lean: 14, bend: 6, tilt: 0, hF: [17, -59], hB: [-16, -60], ...bSt, e: 'snap' },
  { t: 2.0, hip: [-4, 91], lean: 13, bend: 6, tilt: -2, hF: [14, -64], hB: [-13, -65], ...bSt },
  { t: 2.07, hip: [-4, 91], lean: 13, bend: 6, tilt: -2, hF: [17, -60], hB: [-15, -61], ...bSt, e: 'snap' },
  { t: 2.2, hip: [-4, 92], lean: 12, bend: 6, tilt: -4, hF: [14, -64], hB: [-13, -65], ...bSt },
  // (close-up) the knee comes up (not as high as it once did) and stomps into the wide stance
  { t: 2.36, hip: [-8, 98], lean: -4, hF: [14, -42], hB: [-14, -44], fF: [24, 30], fB: [-12, 0] },
  { t: 2.44, hip: [-10, 98], lean: -8, hF: [22, -24], hB: [-22, -24], fF: [34, 44], fB: [-14, 0], e: 'out' },
  { t: T_STOMP, p: 'bStance', hip: [0, 64], lean: 26, hF: [34, -48], hB: [-6, -52], e: 'in3' },
  { t: 2.7, p: 'bStance', hip: [0, 79], lean: 20, e: 'out' },
  { t: 3.0, p: 'bStance', hip: [0, 74], lean: 24, bend: 11 },
  { t: 3.28, p: 'bStance', hip: [0, 80], lean: 19 },
  // coils… (close-up) the back foot digs in
  { t: 3.4, p: 'bStance', hip: [-22, 74], lean: 2, hB: [-52, -8], hF: [30, -30] },
  { t: 3.5, p: 'bStance', hip: [-28, 68], lean: -4, hB: [-58, -2], hF: [32, -26], fB: [-62, 0], slide: true },
  // …and throws the same flying overhand that opened the fight
  { t: T_LAUNCH, hip: [14, 74], lean: 40, hB: [-60, 6], hF: [46, -22], fF: [40, 18], fB: [-62, 0], e: 'in' },
  ...flight(T_LAUNCH, T_LAUNCH + 0.4, [1140, 0], [940, 0], 3000, [
    [3.68, { hip: [0, 78], lean: 56, hB: [-62, 12], hF: [52, -18], fF: [50, 30], fB: [-72, 22] }],
    [T_CATCH, { hip: [0, 76], lean: 52, hBw: G[0], hF: [10, -40], fF: [56, 24], fB: [-66, 26], e: 'snap' }],
  ], {}).slice(0, -1),
  // caught. His own momentum carries him up and right over the top of A
  { t: 3.81, x: 990, y: 121, hip: [0, 76], lean: 52, spin: 26, hBw: G[1], hF: [17, -43], fF: [13, 17], fB: [-56, 24], e: 'lin', er: 'lin' },
  { t: 3.85, x: 950, y: 166, hip: [0, 76], lean: 52, spin: 56, hBw: G[2], hF: [24, -46], fF: [-30, 10], fB: [-46, 22], e: 'lin', er: 'lin' },
  { t: 3.9, x: 905, y: 191, hip: [0, 76], lean: 52, spin: 113, hBw: G[3], hF: [40, 6], fF: [-24, 2], fB: [-40, 14], e: 'lin', er: 'lin' },
  { t: 3.95, x: 850, y: 161, hip: [0, 76], lean: 52, spin: 153, hBw: G[4], hF: [43, 13], fF: [-34, 4], fB: [-49, 15], e: 'lin', er: 'lin' },
  { t: 4.0, x: 790, y: 91, hip: [0, 76], lean: 52, spin: 193, hBw: G[5], hF: [46, 20], fF: [-44, 6], fB: [-58, 16], e: 'lin', er: 'lin' },
  { t: 4.06, x: 765, y: 26, hip: [0, 76], lean: 52, spin: 210, hBw: G[6], hF: [46, 20], fF: [-52, 4], fB: [-64, 12], e: 'lin', er: 'lin' },
  // flat on his back, in the page
  { t: T_SLAM, x: 735, p: 'down', hBw: G[7], hF: [48, 30], e: 'lin', er: 'lin' },
  { t: 4.27, same: true },
  { t: 4.44, p: 'down' },
  { t: 4.64, p: 'down', hF: [40, -12], hB: [66, -8], fF: [92, 2], fB: [76, 2] },
  // (close-up) rolls over, gets his hands under him
  { t: 4.84, face: 1, x: 735, hip: [0, 12], lean: 84, bend: 4, tilt: -20, ...pushUp, fF: [-101, 2], fB: [-93, 2], kF: -1, kB: -1, turnF: -1, turnB: -1 },
  { t: 4.98, x: 745, hip: [-4, 44], lean: 74, bend: 8, tilt: -22, ...pushUp, fF: [-84, 0], fB: [-96, 0] },
  { t: 5.12, x: 762, hip: [-8, 52], lean: 62, bend: 12, tilt: -24, ...pushUp, fF: [-40, 0], fB: [-96, 0] },
  // one knee… then both feet. One last time.
  { t: 5.32, x: 772, hip: [0, 50], lean: 34, bend: 12, tilt: 0, hF: [22, -58], hB: [-4, -62], fF: [36, 0], fB: [-70, 0] },
  { t: 5.52, x: 785, hip: [0, 80], lean: 26, bend: 12, tilt: 10, hF: [18, -60], hB: [-12, -62], fF: [24, 0], fB: [-44, 0] },
  { t: 5.64, hip: [-6, 84], lean: 12, bend: 8, tilt: -4, hF: [24, -50], hB: [-10, -56], fF: [24, 0], fB: [-44, 0] },
  // comes again: one heavy stride and everything he has left
  { t: 5.78, x: 820, hip: [0, 80], lean: 28, bend: 8, hF: [30, -36], hB: [-46, -14], fF: [-8, 0], fB: [45, 0] },
  // sinks, cocks the arm…
  { t: 5.9, x: 840, hip: [-10, 70], lean: 8, bend: 6, hF: [38, -12], hB: [-64, 20], fF: [-26, 0], fB: [27, 0] },
  // …and leaps into the haymaker: it passes clean over A, who is already sliding under him
  { t: 5.96, x: 848, hip: [10, 80], lean: 30, bend: 6, hF: [40, -16], hB: [-62, 26], fF: [-34, 0], fB: [20, 0], e: 'in' },
  ...flight(5.96, 6.2, [848, 0], [928, 0], 5200, [
    [6.06, { hip: [10, 78], lean: 40, bend: 8, hF: [-6, -40], hB: [82, 10], fF: [52, 34], fB: [-62, 38], e: 'snap' }],
    [6.13, { hip: [12, 76], lean: 48, bend: 8, hF: [-14, -38], hB: [50, -44], fF: [52, 26], fB: [-50, 32] }],
  ], { hip: [16, 66], lean: 48, bend: 8, hF: [-16, -36], hB: [40, -56], fF: [44, 0], fB: [-40, 0] }),
  // it finds nothing; he turns to find A behind him
  { t: 6.28, x: 940, hip: [4, 78], lean: 22, tilt: -10, hF: [20, -44], hB: [-20, -44], fF: [-14, 0], fB: [36, 0] },
  { t: 6.4, face: -1, x: 950, hip: [10, 70], lean: 38, bend: 6, hF: [22, -46], hB: [-6, -52], ...kF },
  { t: T_KICK, x: 950, hip: [12, 68], lean: 42, bend: 6, tilt: 0, hF: [24, -48], hB: [-8, -54], ...kF },
  // slow motion: the head goes first; the arms come up too late
  { t: T_REL, x: 950, hip: [9, 70], lean: 28, bend: -4, tilt: -48, hF: [40, -22], hB: [-22, -38], fF: [18, 12], fB: [-27, 0], e: 'lin', er: 'lin' },
  // full speed: lifted off his feet and thrown the length of the stage
  { t: 7.06, x: 972, y: 8, hip: [-20, 74], lean: -30, tilt: -34, hF: [50, 22], hB: [42, 32], fF: [34, 10], fB: [-40, 0], e: 'snap' },
  ...flight(7.06, T_LAND, [972, 8], [1400, 0], 3600, [
    [7.18, { hip: [0, 70], lean: -52, tilt: -20, bend: -8, hF: [46, 34], hB: [36, 44], fF: [56, 30], fB: [30, 10] }],
    [7.3, { hip: [0, 50], lean: -74, tilt: -10, hF: [50, 30], hB: [30, 40], fF: [70, 34], fB: [50, 16] }],
  ], { p: 'down', hF: [50, 30], hB: [-30, 34], fF: [84, 26], fB: [70, 10] }),
  // skids on his back: the stump stops him
  { t: T_CRASH, x: 1512, hip: [0, 12], lean: -68, tilt: 32, bend: 10, hF: [30, 44], hB: [-8, 52], fF: [58, 50], fB: [40, 28], eF: 1, eB: 1, slide: true, e: 'lin', er: 'lin' },
  { t: 7.72, same: true },
  // slides down flat
  { t: 7.98, ...R, e: 'in' },
  { t: 8.06, ...R, hip: [0, 11] },
  { t: 8.16, ...R },
  // ── on the ground: weak movements, each one long enough to read ──
  { t: 9.1, ...R },
  // an arm comes up off his chest, reaching at nothing…
  { t: 9.42, ...R, hF: [53, 47], lean: -84, tilt: 8, e: 'out' },
  { t: 9.5, ...R, hF: [49, 43], lean: -84, tilt: 8 },
  { t: 9.58, ...R, hF: [54, 46], lean: -84, tilt: 6 },
  // …and falls: off his chest, onto the page in front of him
  { t: 9.7, ...R, ...FL, e: 'in' },
  { t: 9.8, ...R, ...FL },
  // the hand drags back along the page, getting under him (it leaves a mark)
  { t: 10.22, ...R, hFw: [1548, -4], e: 'io' },
  // the head lifts…
  { t: 10.4, ...R, hFw: [1548, -4], lean: -72, tilt: 42, e: 'out' },
  // …he pushes: the shoulders come right off the page, a leg bends under him:
  { t: 10.64, ...R, hip: [0, 10], hFw: [1548, -3], hB: [8, 12], fB: [62, 3], lean: -44, bend: 8, tilt: 18, slide: true, e: 'out' },
  { t: 10.7, ...R, hip: [0, 10], hFw: [1548, -3], hB: [12, 8], fB: [62, 3], lean: -47, bend: 9, tilt: 12 },
  { t: 10.76, ...R, hip: [0, 10], hFw: [1548, -3], hB: [9, 11], fB: [62, 3], lean: -44, bend: 8, tilt: 14 },
  //: and the arm gives out
  { t: 10.9, ...R2, fB: [80, 3], slide: true, e: 'in' },
  { t: 10.98, ...R2, fB: [80, 3] },
  { t: 14.56, ...R2, fB: [80, 3] },
  // (close-up) the arm again, weaker: half as high, and it drops
  { t: 14.84, ...R2, hF: [57, 27], fB: [80, 3], e: 'out' },
  { t: 14.92, ...R2, hF: [54, 23], fB: [80, 3] },
  { t: 15.04, ...R2, fB: [80, 3], e: 'in' },
  // he hears the steps: the head comes up
  { t: 15.24, ...R2, fB: [80, 3], lean: -76, tilt: 36, e: 'out' },
  // tries once more: the hand drags under him, he gets half-way
  { t: 15.42, ...R2, hFw: [1548, -4], fB: [80, 3], lean: -75, tilt: 32 },
  { t: 15.66, ...R2, hip: [0, 10], hFw: [1548, -3], hB: [2, 14], fB: [66, 3], lean: -58, bend: 8, tilt: 20, slide: true, e: 'out' },
  { t: 15.76, ...R2, hip: [0, 10], hFw: [1548, -3], hB: [4, 12], fB: [66, 3], lean: -61, bend: 8, tilt: 15 },
  { t: 15.92, ...R2, fB: [88, 3], slide: true, e: 'in' },
  { t: 16.0, ...R2, fB: [88, 3] },
  // he turns his head to look at him
  { t: 16.3, ...R2, fB: [88, 3], lean: -84, tilt: 26 },
  { t: 17.1, ...R2, fB: [88, 3], lean: -84, tilt: 26 },
  // one hand, up off the page, toward the muzzle
  { t: 17.5, ...R2, hFw: HAND_UP, fB: [88, 3], lean: -82, tilt: 28, e: 'out' },
  { t: 17.9, ...R2, hFw: off(HAND_UP, 2, 4), fB: [88, 3], lean: -82, tilt: 28 },
  { t: 18.4, ...R2, hFw: off(HAND_UP, -1, 0), fB: [88, 3], lean: -82, tilt: 28 },
  { t: 20.0, same: true },
];

S.fighters({ A: A_KEYS, B: B_KEYS });

// the pencil planted in the page: exactly where it was at the start. Nobody touches it.
S.weapon('pencil', [
  { t: 0, type: 'pencil', at: [1247.5, 104], ang: 98 },
  { t: 20, at: [1247.5, 104], ang: 98 },
]);

// the rifle: a doodle on the page from the first frame, then real
const AIM = 331;
S.weapon('rifle', [
  // `flip` is set by hand: mirrored (stock hanging down) while it points left, and switched once:
  // mid-turn, at 12.99, while the camera is on the outline and the rifle is below the frame
  { t: 0, type: 'rifle', at: RIFLE0, ang: 180, flip: true },
  { t: T_GRAB, by: 'A', ang: 180, g: 0.3, two: 0 },
  { t: T_GRAB + 0.16, by: 'A', ang: 183 },
  { t: T_PEEL, by: 'A', ang: 192, e: 'snap' },
  { t: 12.92, by: 'A', ang: 187 },
  { t: 12.99, by: 'A', ang: 262, flip: false, e: 'lin' },
  { t: 13.06, by: 'A', ang: 338, two: 1, e: 'lin' },
  { t: 13.26, by: 'A', ang: 347 },
  { t: 13.42, by: 'A', ang: 338 },
  { t: 13.9, by: 'A', ang: 336 }, { t: 14.02, by: 'A', ang: 333 },
  { t: 14.4, by: 'A', ang: 337 }, { t: 14.52, by: 'A', ang: 334 },
  { t: 15.0, by: 'A', ang: 337 },
  { t: 15.28, by: 'A', ang: 336 }, { t: 15.4, by: 'A', ang: 333 },
  { t: 15.7, by: 'A', ang: 337 }, { t: 15.82, by: 'A', ang: 334 },
  { t: 16.1, by: 'A', ang: 338 },
  { t: 16.3, by: 'A', ang: 350, two: 0 },
  { t: T_BOLT, by: 'A', ang: 352, e: 'snap' },
  { t: 16.46, by: 'A', ang: 350 },
  { t: 16.62, by: 'A', ang: 346, two: 1 },
  { t: 17.05, by: 'A', ang: AIM, two: 0, e: 'io' },
  { t: 20, by: 'A', ang: AIM, two: 0 },
]);

// ── camera: shots and cuts ───────────────────────────────────────────────────
// shot(t0, t1, from, to, ease, mids): a continuous move; the next shot() is a hard cut.
const CAM = [];
const shot = (t0, t1, a, b, e = 'lin', mids = []) => {
  CAM.push({ ...a, t: t0 });
  for (const m of mids) CAM.push(m);
  CAM.push({ e, ...b, t: t1 - 0.002 });
};
const M = { a: 0.5, b: 0.5 };
// 1 · out of the white: the page, the two of them, the doodle by the set square
shot(0, 1.05, { x: 940, y: -178, z: 1.2, r: -2.5 }, { x: 955, y: -172, z: 1.34, r: -1 });
// 2 · A's head comes up
shot(1.05, 1.66, { x: 840, y: -138, z: 4.4, r: 6 }, { x: 822, y: -166, z: 5.0, r: 9 }, 'io');
// 3 · B's fist closes
shot(1.66, 2.22, { x: 1128, y: -98, z: 7.0, r: -9 }, { x: 1126, y: -100, z: 6.2, r: -6 }, 'out');
// 4 · the stomp
shot(2.22, 2.78, { x: 1100, y: -44, z: 5.0, r: 5 }, { x: 1094, y: -34, z: 5.6, r: 7 }, 'lin');
// 5 · two heads in profile: the held beat
shot(2.78, 3.42, { ...M, y: -164, z: 3.7, r: -3 }, { ...M, y: -167, z: 4.15, r: -6 }, 'lin');
// 6 · the back foot digs in
shot(3.42, 3.6, { x: 1200, y: -26, z: 5.4, r: 9 }, { x: 1194, y: -30, z: 5.8, r: 11 }, 'out');
// 7 · low and wide for the charge, slamming in on the catch
shot(3.6, 3.78, { ...M, x: 10, y: -118, z: 2.3, r: -5 }, { ...M, y: -164, z: 2.45, r: -3 }, 'in');
// 8 · over he goes: and the camera comes down with him
shot(3.78, 4.5, { x: 932, y: -186, z: 2.2, r: -3 }, { x: 796, y: -70, z: 2.7, r: 8 }, 'out', [
  { t: 3.95, x: 886, y: -204, z: 2.2, r: 1, e: 'lin' },
  { t: 4.08, x: 850, y: -172, z: 2.2, r: 4, e: 'lin' },
  { t: 4.14, x: 800, y: -84, z: 2.5, r: 7, e: 'snap' },
]);
// 9 · B's hands find the page
shot(4.5, 5.14, { x: 806, y: -34, z: 3.1, r: -7 }, { x: 800, y: -52, z: 2.7, r: -4 }, 'io');
// 10 · between them, drifting
shot(5.14, 5.58, { x: 794, y: -136, z: 2.9, r: 5 }, { x: 802, y: -156, z: 3.4, r: 8 }, 'io');
// 11 · low and wide again: he comes
shot(5.58, 6.3, { ...M, x: -6, y: -112, z: 2.35, r: -6 }, { ...M, y: -132, z: 2.3, r: -4 }, 'io', [
  { t: 6.06, ...M, y: -114, z: 2.5, r: -5, e: 'lin' },
]);
// 12 · the kick: punch in, then a slow sliding close-up while time stretches
shot(6.3, T_REL, { ...M, y: -134, z: 2.3, r: -4 }, { x: 880, y: -152, z: 3.2, r: -12 }, 'lin', [
  { t: 6.44, x: 850, y: -138, z: 2.2, r: -6, e: 'in' },
  { t: 6.5, x: 838, y: -140, z: 2.65, r: -8, e: 'snap' },
]);
// 13 · full speed: whip right with him, all the way to the wall
shot(T_REL, 8.2, { x: 900, y: -150, z: 1.7, r: 3 }, { x: 1506, y: -86, z: 2.05, r: 4 }, 'out', [
  { t: 7.08, x: 950, y: -150, z: 1.45, r: 2, e: 'snap' },
  { t: 7.42, b: 1, x: -50, y: -122, z: 1.5, r: -3, e: 'lin' },
  { t: 7.58, b: 1, x: -30, y: -110, z: 1.55, r: -4, e: 'lin' },
  { t: 7.66, x: 1492, y: -104, z: 1.95, r: -6, e: 'snap' },
]);
// 14 · A: the leg comes down, the guard, the arms
shot(8.2, 9.0, { x: 790, y: -146, z: 2.5, r: -5 }, { x: 784, y: -152, z: 3.0, r: -3 }, 'lin');
// 15 · B on the ground: small, weak movements
shot(9.0, 11.0, { x: 1512, y: -48, z: 3.9, r: -4 }, { x: 1526, y: -46, z: 4.6, r: -8 }, 'lin');
// 16 · A looks away… whip to what he sees
shot(11.0, 11.9, { x: 792, y: -156, z: 3.0, r: 4 }, { x: 566, y: -224, z: 3.8, r: 8 }, 'lin', [
  { t: 11.36, x: 780, y: -160, z: 3.2, r: 5, e: 'lin' },
  { t: 11.56, x: 574, y: -222, z: 3.5, r: 7, e: 'out' },
]);
// 17 · two steps, the hand, the peel
shot(11.9, 12.92, { x: 690, y: -160, z: 2.2, r: -4 }, { x: 626, y: -188, z: 3.2, r: -8 }, 'io', [
  { t: 12.4, x: 632, y: -180, z: 2.7, r: -6, e: 'io' },
]);
// 17b · what it leaves on the page
shot(12.92, 13.14, { x: 540, y: -268, z: 5.8, r: 5 }, { x: 548, y: -264, z: 6.2, r: 7 }, 'lin');
// 18 · it is real
shot(13.14, 13.5, { x: 640, y: -126, z: 3.4, r: 8 }, { x: 650, y: -120, z: 3.1, r: 5 }, 'lin');
// 19 · low angle: the walk
shot(13.5, 14.5, { a: 1, x: 34, y: -38, z: 3.8, r: -7 }, { a: 1, x: 48, y: -44, z: 3.5, r: -4 }, 'lin');
// 20 · B's hand; A's feet arrive behind it
shot(14.5, 16.14, { x: 1510, y: -30, z: 4.4, r: 5 }, { x: 1440, y: -66, z: 2.8, r: 8 }, 'io', [
  { t: 15.3, x: 1470, y: -34, z: 3.7, r: 6, e: 'io' },
]);
// 21 · the bolt
shot(16.14, 16.66, { x: 1362, y: -112, z: 5.6, r: -9 }, { x: 1370, y: -110, z: 6.0, r: -7 }, 'lin');
// 22 · the rifle comes up, and down
shot(16.66, 17.3, { x: 1460, y: -100, z: 2.45, r: 5 }, { x: 1464, y: -96, z: 2.6, r: 6.5 }, 'lin');
// 23 · along the barrel. Hold. (black from T_SHOT)
shot(17.3, 20.01, { x: 1464, y: -96, z: 2.6, r: 6.5 }, { x: 1500, y: -86, z: 3.7, r: 11.5 }, 'lin', [
  { t: T_SHOT, x: 1498, y: -86, z: 3.6, r: 11, e: 'lin' },
]);
S.camera(CAM);

// ── contacts, effects, sound ─────────────────────────────────────────────────
S.musicHint(0, 3.4, 'aftermath');
S.step({ t: 0.86, x: 768, weight: 0.3 });                              // A's stumble
S.whoosh({ t: 2.3, x: 1100, size: 's', dur: 0.2 });                    // B's knee comes up
S.land({ t: T_STOMP, x: 1092, weight: 0.85 });                         // …and stomps down
S.cue({ t: 3.44, type: 'skid', dur: 0.12, x: 1200 });                  // the back foot digs in
S.fx({ t: 3.46, type: 'dust', x: 1212, n: 4, size: 0.7, dir: 1 });
S.whoosh({ t: 3.54, x: 1100, size: 'l', dur: 0.3 });                   // the overhand
S.fx({ t: T_LAUNCH, type: 'dust', x: 1205, n: 6, size: 1.0, dir: 1 });
S.step({ t: 3.67, x: 900, weight: 0.45 });                             // A steps inside
S.cue({ t: T_CATCH, type: 'block', weight: 0.6, x: G[0][0] });          // the arm is caught
S.shake(T_CATCH, 7, 0.14);
S.whoosh({ t: 3.84, x: 900, size: 'l', dur: 0.3 });                    // over he goes
S.hit({ t: T_SLAM, x: 782, h: 12, size: 2.7, sound: 'hit', weight: 1, impact: 0.07, ring: true, shock: true, shake: 0 });
S.land({ t: T_SLAM, x: 756, weight: 1 });
S.shake(T_SLAM, 48, 0.7);
S.fx({ t: T_SLAM, type: 'dust', x: 780, n: 13, size: 1.5 });
S.fx({ t: T_SLAM, type: 'scraps', x: 780, h: 6, n: 18 });
S.fx({ t: T_SLAM, type: 'splash', x: 780, h: 6, n: 14, size: 1.1, dir: 0 });
S.cue({ t: T_SLAM, type: 'megaimpact', x: 780 });
S.cue({ t: T_SLAM + 0.02, type: 'tear', dur: 0.5, x: 780 });
S.cue({ t: T_SLAM + 0.04, type: 'crack', dur: 0.5, x: 780 });
S.step({ t: 4.66, x: 1000, weight: 0.3 });                              // A gives ground
S.step({ t: 5.04, x: 1040, weight: 0.45 });
S.step({ t: 4.84, x: 820, weight: 0.4 });                              // B's hands
S.step({ t: 5.32, x: 800, weight: 0.45 });                             // …a foot under him
S.step({ t: 5.78, x: 870, weight: 0.85 });                             // B comes again
S.whoosh({ t: 5.94, x: 900, size: 'l', dur: 0.24 });                   // the leaping haymaker
S.land({ t: 6.2, x: 928, weight: 0.7 });
S.skid({ t0: 5.99, t1: 6.22, x0: 1010, x1: 792 });                     // A's slide
S.fx({ t: 6.03, type: 'dust', x: 1000, n: 5, size: 0.8, dir: 1 });
S.step({ t: 6.31, x: 780, weight: 0.35 });
S.whoosh({ t: 6.38, x: 800, size: 'm', dur: 0.12 });                   // the kick
S.hit({ t: T_KICK, x: KICK_A[0], h: KICK_A[1], size: 0.7, sound: 'hit', weight: 0.5, shake: 5 });
S.slowmo(T_KICK + 0.02, T_REL, (st) => st.A.fF);
S.cue({ t: 6.66, type: 'heartbeat' });
S.hit({ t: T_REL, x: KICK_B[0], h: KICK_B[1], size: 2.2, sound: 'hit', weight: 1, impact: 0.06, shock: true });
S.whoosh({ t: 7.04, x: 1000, size: 'l', dur: 0.38 });                  // B flies
S.step({ t: 7.42, x: 810, weight: 0.4 });                              // A's foot comes down
S.land({ t: T_LAND, x: 1400, weight: 0.9, dir: 1 });
S.skid({ t0: T_LAND, t1: T_CRASH, x0: 1372, x1: 1506 });
S.hit({ t: T_CRASH, x: 1640, h: 112, size: 1.5, sound: 'hit', weight: 1, impact: 0.06, shake: 0 });
S.shake(T_CRASH, 38, 0.6);
S.cue({ t: T_CRASH, type: 'wallbreak', size: 0.75, x: 1620 });
S.cue({ t: T_CRASH + 0.05, type: 'crumble', dur: 0.9, x: 1640 });
S.fx({ t: T_CRASH, type: 'dust', x: 1646, h: 60, n: 6, size: 1.0, dir: 1 });
S.fx({ t: T_CRASH, type: 'sparks', x: 1620, h: 70, n: 14, size: 1.2, dir: -1 });
S.fx({ t: T_CRASH + 0.04, type: 'dust', x: 1650, h: 96, n: 7, size: 1.1 });
S.cue({ t: 7.98, type: 'thud', weight: 0.35, x: 1440 });               // his legs come down
S.fx({ t: 7.98, type: 'dust', x: 1410, n: 3, size: 0.6 });
S.musicHint(7.7, 15.6, 'aftermath');
// Part 2
S.cue({ t: 9.7, type: 'thud', weight: 0.25, x: 1500 });                // the arm falls
S.fx({ t: 9.7, type: 'dust', x: 1496, n: 3, size: 0.45 });
S.skid({ t0: 9.82, t1: 10.22, x0: 1498, x1: 1546, y: 11 });            // the hand drags under him
S.cue({ t: 10.9, type: 'thud', weight: 0.35, x: 1560 });               // his arm gives out
S.fx({ t: 10.9, type: 'dust', x: 1566, n: 4, size: 0.6 });
S.step({ t: 12.08, x: 670, weight: 0.4 });                             // A walks to the doodle
S.step({ t: 12.3, x: 606, weight: 0.4 });
S.cue({ t: T_GRAB, type: 'scribble', dur: 0.14, x: RGRIP[0] });         // a hand on paper
S.cue({ t: T_GRAB + 0.14, type: 'draw', dur: 0.22, x: RGRIP[0] });      // the drawing lifts off the page
S.fx({ t: T_PEEL, type: 'scraps', x: 620, h: 204, n: 5 });
S.cue({ t: 13.06, type: 'block', weight: 0.3, x: 650 });               // both hands on it
S.step({ t: 13.9, x: 740, weight: 0.72 });                             // the walk
S.step({ t: 14.4, x: 810, weight: 0.72 });
S.cue({ t: 14.86, type: 'step', weight: 0.72, x: 1000 });              // (unseen)
S.step({ t: 15.28, x: 1225, weight: 0.72 });
S.step({ t: 15.7, x: 1295, weight: 0.72 });
S.step({ t: 16.1, x: 1362, weight: 0.78 });
S.cue({ t: 15.04, type: 'thud', weight: 0.18, x: 1500 });              // the arm drops again
S.cue({ t: 15.26, type: 'skid', dur: 0.16, x: 1520, gain: 0.5 });
S.cue({ t: 15.92, type: 'thud', weight: 0.25, x: 1560 });              // …and he is down again
S.fx({ t: 15.92, type: 'dust', x: 1566, n: 3, size: 0.45 });
S.cue({ t: T_BOLT, type: 'riflecock', x: 1380 });
S.musicHint(15.6, 20, 'suspend');
S.cue({ t: 17.2, type: 'heartbeat' });
S.cue({ t: 17.9, type: 'heartbeat' });
S.cue({ t: 18.1, type: 'riser', dur: 0.5 });
S.cue({ t: T_SHOT, type: 'rifleshot', x: 1480 });                      // on the cut. Never seen.

// ── environment: the opening page, after everything ──────────────────────────
// the wall: what is left of it. Its near end is what stops B.
const stumpRows = (cx) => (cx < 1700 ? 3 : cx < 1790 ? 4 : cx < 1850 ? 2 : cx < 1930 ? 0 : cx < 2000 ? 2 : cx < 2060 ? 5 : cx < 2120 ? 4 : cx < 2180 ? 6 : cx < 2240 ? 4 : 7);
const wall = makeBrickWall({ x0: WALL_X, x1: 2300, rows: 10, seed: 300 })
  .collapse(-60, (b) => b.row >= Math.min(stumpRows(b.x + 6), stumpRows(b.cx), stumpRows(b.x + b.w - 6)), { dir: -1 })
  .bruise(-60, 2030, -150, 96)
  .crack(-60, 1900, -150, [{ a: 118, len: 0.6 }, { a: 40, len: 0.9 }, { a: -20, len: 0.8 }], { seed: 71, len: 190, w: 3 })
  .crack(-60, 2150, -200, [{ a: 100, len: 0.9 }, { a: 150, len: 0.7 }, { a: 30, len: 0.7 }], { seed: 83, len: 180, w: 2.8 })
  // the crash: the top of the near end is knocked off, the face cracks
  .smash(T_CRASH, 1640, -100, 60, { dir: 1 })
  .bruise(T_CRASH, 1640, -30, 58)
  .crack(T_CRASH, 1624, -34, [{ a: -20, len: 0.8 }, { a: 24, len: 0.7 }, { a: -62, len: 0.5 }], { seed: 91, len: 120, w: 2.6, grow: 0.2 });

// what the crash knocks loose (drawn by us, so we choose where it comes to rest)
const crashBricks = makeDebris([
  { t: T_CRASH, x: 1676, y: -120, w: 112, h: 48, vx: 262, vy: -520, om: 7 },                  // …into the breach
  { t: T_CRASH + 0.01, x: 1648, y: -72, w: 56, h: 48, vx: 62, vy: -620, om: -9, floor: -48 },  // …back onto the stump
  { t: T_CRASH + 0.02, x: 1700, y: -150, w: 36, h: 24, vx: 420, vy: -380, om: 14, chips: 2 },
], 4400);

// rubble at rest: in the breach, beyond the far end, two strays far left. The floor in front
// of the stump is left clear: that is where the film ends.
const rubble = (() => {
  const r = rng(4242);
  const list = [];
  const add = (x, big = 1) => list.push({
    t: -60, x, y: -30, w: big ? 70 + r() * 42 : 34 + r() * 26, h: big ? 48 : 26 + r() * 20,
    vx: 0, vy: 0, chips: 0,
  });
  for (let i = 0; i < 5; i++) add(1862 + r() * 60, r() < 0.6);     // in the breach
  for (let i = 0; i < 6; i++) add(2345 + r() * 230, r() < 0.6);
  add(-60, 0); add(214, 1); add(96, 0);
  return makeDebris(list, 4300);
})();

// old floor damage: cracks (mostly running down into the page below the floor line, so the
// space behind the fighters stays light), one rip showing the black desk, old skid marks
const OLD_CRACKS = [
  crackSet(97, 1040, -2, [
    { a: 172, len: 1.0 }, { a: 8, len: 1.0 }, { a: 150, len: 0.7 }, { a: 28, len: 0.8 }, { a: 95, len: 0.6 },
    { a: -158, len: 0.4, w: 0.7 }, { a: -26, len: 0.35, w: 0.7 },
  ], { len: 220, step: 26, w: 2.6, branch: 0.3 }),
  crackSet(131, 236, -2, [
    { a: -128, len: 0.5, w: 0.7 }, { a: -62, len: 0.45, w: 0.7 },
    { a: 166, len: 1.0 }, { a: 18, len: 0.9 }, { a: 66, len: 0.7 }, { a: 112, len: 0.6 },
  ], { len: 240, step: 26, w: 3, branch: 0.32 }),
  crackSet(157, 470, -2, [
    { a: 170, len: 1.0 }, { a: 12, len: 0.8 }, { a: 62, len: 0.6 }, { a: -140, len: 0.45, w: 0.7 },
  ], { len: 180, step: 24, w: 2.4, branch: 0.3 }),
  crackSet(173, 2460, -330, [
    { a: -120, len: 0.8 }, { a: -40, len: 0.5 }, { a: 100, len: 1.0 }, { a: 170, len: 0.6 },
  ], { len: 210, step: 26, w: 2.6, branch: 0.3 }),
];
// this scene's own mark: the crater where B is thrown
const SLAM_X = 782;
const SLAM_CRACKS = crackSet(211, SLAM_X, -2, [
  { a: 176, len: 1.0 }, { a: 5, len: 1.1 }, { a: 150, len: 0.8 }, { a: 34, len: 0.8 }, { a: 96, len: 0.7 }, { a: 68, len: 0.5 }, { a: 122, len: 0.55 },
  { a: -152, len: 0.42, w: 0.7 }, { a: -32, len: 0.45, w: 0.7 }, { a: -96, len: 0.3, w: 0.6 },
], { len: 250, step: 24, w: 3.3, branch: 0.34 });

const OLD_SKIDS = [
  { t0: -9, t1: -8, x0: 850, x1: 1065, seed: 11 },
  { t0: -9, t1: -8, x0: 1180, x1: 1034, seed: 12 },
  { t0: -9, t1: -8, x0: 560, x1: 392, seed: 14 },
  { t0: -9, t1: -8, x0: 1900, x1: 2110, y: 0, seed: 17 },
];

// ink from the storm: splats (a body with thrown droplets) and loose flecks
const INK = (() => {
  const out = [];
  const splat = (seed, x, y, R0, n, dir = null) => {
    const r = rng(seed);
    out.push({ x, y, rx: R0, ry: R0 * (0.7 + r() * 0.25), rot: r() * 6, seed, rough: 0.28, n: 13 });
    for (let i = 0; i < n; i++) {
      const a = dir == null ? r() * Math.PI * 2 : dir + (r() - 0.5) * 1.5;
      const d = R0 * (1.15 + r() * r() * 3.4);
      const s = R0 * (0.07 + r() * 0.2) * (1.25 - Math.min(1, d / (R0 * 4.6)));
      out.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, rx: s * (1.3 + r() * 1.6), ry: s, ang: a, seed: seed + i + 1, rough: 0.18, n: 9 });
    }
  };
  splat(801, 96, -560, 46, 16);
  splat(802, 1512, -655, 34, 13, -0.4);
  splat(803, 2392, -838, 40, 14, 2.4);
  splat(804, -206, 286, 52, 15, -0.9);
  splat(805, 742, 372, 30, 12);
  splat(806, 1668, 452, 44, 15, 3.6);
  splat(807, 2236, 236, 26, 10);
  splat(808, 398, -905, 30, 12, 0.7);
  splat(809, 1228, -470, 15, 8, 1.2);
  splat(810, 2496, -112, 30, 11, 2.9);
  // flecks: everywhere, but thin where the fight and the ending happen
  const r = rng(977);
  for (let i = 0; i < 150; i++) {
    const x = lerp(-380, 2590, r()), y = lerp(-1080, 560, r()), s = 1.6 + r() * r() * 7;
    if (x > 440 && x < 1660 && y > -290 && y < 6 && r() < 0.85) continue;
    out.push({ x, y, rx: s * (1 + r() * 0.8), ry: s, ang: r() * 6, seed: 2000 + i, rough: 0.15, n: 7 });
  }
  return out;
})();

function drawInk(ctx, vb) {
  for (const b of INK) {
    if (b.x < vb.x0 - 80 || b.x > vb.x1 + 80 || b.y < vb.y0 - 80 || b.y > vb.y1 + 80) continue;
    if (b.ang != null) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.ang);
      blob(ctx, 0, 0, b.rx, b.ry, { fill: BLACK, strokeIt: false, rough: b.rough, seed: b.seed, n: b.n });
      ctx.restore();
    } else blob(ctx, b.x, b.y, b.rx, b.ry, { fill: BLACK, strokeIt: false, rough: b.rough, seed: b.seed, n: b.n, rot: b.rot });
  }
}

// torn page edges: bites out of the sheet (the black desk shows), with a hatched lip of paper fibre
const torn = (a, b, n, amp, seed) => {
  const r = rng(seed);
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
  const nx = -dy / l, ny = dx / l;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    const j = i === 0 || i === n ? 0 : (r() - 0.5) * 2 * amp + (i % 2 ? amp * 0.5 : -amp * 0.5);
    pts.push([a[0] + dx * k + nx * j + (r() - 0.5) * (l / n) * 0.5 * (i && i < n ? 1 : 0), a[1] + dy * k + ny * j]);
  }
  return pts;
};
const shift = (pts, dx, dy) => pts.map((p) => [p[0] + dx, p[1] + dy]);
const P = DEFAULT_PAGE;
const TEARS = (() => {
  const corner = torn([2258, P.y0 - 8], [P.x1 + 8, -772], 17, 13, 31);
  const ripUp = torn([P.x1 + 8, -462], [2292, -420], 13, 7, 37);
  const ripLo = torn([2292, -420], [P.x1 + 8, -388], 13, 7, 41);
  const biteL = torn([1046, P.y1 + 8], [1222, 452], 9, 10, 43);
  const biteR = torn([1222, 452], [1408, P.y1 + 8], 9, 10, 47);
  const nick = torn([-250, P.y0 - 8], [-96, P.y0 - 8], 8, 4, 53).map((p, i, a) => [p[0], p[1] + Math.sin((i / (a.length - 1)) * Math.PI) * 74]);
  return [
    { hole: [...corner, [P.x1 + 30, P.y0 - 30]], lip: [...corner, ...shift(corner, -15, 17).reverse()], ang: 44 },
    { hole: [...ripUp, ...ripLo.slice(1), [P.x1 + 30, -425]], lip: [...ripUp, ...shift(ripUp, -4, -15).reverse()], ang: 70, flap: [[2452, -452], [2548, -512], [2590, -458]] },
    { hole: [...biteL, ...biteR.slice(1), [1408, P.y1 + 30], [1046, P.y1 + 30]], lip: [...biteL, ...biteR.slice(1), ...shift([...biteL, ...biteR.slice(1)], 0, -16).reverse()], ang: 62 },
    { hole: [...nick, [-96, P.y0 - 30], [-250, P.y0 - 30]], lip: [...nick, ...shift(nick, 0, 13).reverse()], ang: 58 },
  ];
})();

function drawTornEdges(ctx) {
  for (const [i, tr] of TEARS.entries()) {
    hatch(ctx, tr.lip, { angle: tr.ang, gap: 5.5, w: 1.6, seed: 880 + i, skip: 0.1 });
    ctx.beginPath();
    tr.hole.forEach((p, j) => (j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.fillStyle = BLACK;
    ctx.fill();
    if (tr.flap) {
      sketchPoly(ctx, tr.flap, { w: 2.6, seed: 890 + i, fill: WHITE, rough: 0.8 });
      hatch(ctx, tr.flap, { angle: 68, gap: 6, w: 1.4, seed: 895 + i });
    }
  }
}

// the rifle doodle's surroundings: a doodled target it was "aimed" at, and: once A has peeled the
// rifle off the page: the dashed ghost it leaves behind, with a curl of lifted paper.
// (The rifle itself is the free weapon 'rifle'; these outlines mirror weapons.js DRAW.rifle.)
const RIFLE_PARTS = [
  [[0, 2], [40, -5], [46, 7], [30, 10], [6, 24], [-2, 20]],
  [[40, -6], [78, -6], [78, 6], [46, 7]],
  [[78, 0], [128, 0], [126, 7], [78, 8]],
  [[78, -4.5], [176, -4.5], [176, 0.5], [78, 0.5]],
];
function drawRifleDoodle(ctx, t) {
  // a little bullseye pinned up beyond the muzzle
  const tx = RIFLE0[0] - 150, ty = -RIFLE0[1] + 2;
  for (const [rad, seed] of [[21, 61], [12, 62]]) blob(ctx, tx, ty, rad, rad, { w: 1.6, rough: 0.05, seed, n: 16 });
  blob(ctx, tx, ty, 4, 4, { fill: BLACK, strokeIt: false, rough: 0.1, seed: 63, n: 8 });
  if (t < T_GRAB) return;
  ctx.save();
  ctx.translate(RIFLE0[0] + 88, -RIFLE0[1]);
  ctx.rotate(Math.PI);
  ctx.scale(1, -1);
  ctx.setLineDash([5.5, 4.5]);
  ctx.lineWidth = 1.6; ctx.strokeStyle = BLACK; ctx.lineCap = 'butt';
  for (const q of RIFLE_PARTS) {
    ctx.beginPath();
    q.forEach((v, i) => (i ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1])));
    ctx.closePath();
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
  if (t < T_PEEL) return;
  // curled paper edge where it was lifted
  const gx = RGRIP[0], gy = -RGRIP[1];
  const f = [[gx + 26, gy - 12], [gx + 50, gy - 26], [gx + 42, gy + 2]];
  sketchPoly(ctx, f, { w: 1.6, seed: 31, fill: WHITE, rough: 0.5 });
  hatch(ctx, f, { angle: 60, gap: 3.5, w: 0.9, seed: 32 });
}

// from the white-out: the white is scratched away stroke by stroke, top to bottom
function drawWhiteIn(ctx, t, W, H) {
  if (t >= T_IN) return;
  const N = 46;
  const R0 = Math.hypot(W, H) / 2 + 30;
  const bw = (2 * R0) / N;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.3);
  ctx.fillStyle = WHITE;
  for (let i = 0; i < N; i++) {
    const t0 = 0.3 * (i / (N - 1)) + 0.06 * hash(i * 7.3);
    const p = EASE.io(prog(t, t0, t0 + 0.17));
    if (p >= 1) continue;
    const y = -R0 + i * bw;
    const len = 2 * R0 * (1 - p);
    ctx.fillRect(i % 2 ? -R0 : R0 - len, y - 1.5, len, (bw + 3) * (1 - 0.45 * p));
  }
  ctx.restore();
}

S.env({
  page(ctx, t, { vb, px }) {
    drawPage(ctx, P, vb, px);
    drawTornEdges(ctx);
  },
  // slower parallax layer: the same geometry doodles and formulas as the opening
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
    drawInk(ctx, vb);
    drawGround(ctx, P.x0 + 8, P.x1 - 8, vb, px, { dense: [1640, 2620] });
    wall.draw(ctx, t);
    drawTear(ctx, { x0: 96, x1: 330, y: 4, depth: 30, seed: 140 }, 1);
    for (const c of OLD_CRACKS) drawCracks(ctx, c, 1, 1);
    if (t >= T_SLAM) {
      // the crater: the page splits open under him
      const p = prog(t, T_SLAM, T_SLAM + 0.34);
      drawTear(ctx, { x0: SLAM_X - 118, x1: SLAM_X + 104, y: 4, depth: 22, seed: 151, flaps: 4 }, p);
      drawCracks(ctx, SLAM_CRACKS, p, 1);
    }
    drawSkids(ctx, OLD_SKIDS, t);
    drawRifleDoodle(ctx, t);
    rubble.draw(ctx, t, false);
    crashBricks.draw(ctx, t, false);
  },
  // in front of the fighters: bricks still in the air
  over(ctx, t, { st }) {
    crashBricks.draw(ctx, t, true);
    // The aim. The engine draws a held weapon over its holder, which hides the arm that supports
    // the rifle; for the last shots that arm is re-inked in front of it (same line, same halo: the
    // figure itself is unchanged), with the grip dot the engine puts on a gripping hand.
    if (t >= T_AIM && t < T_SHOT) {
      const J = st.A, w = FIGHTER_A.line * J.s;
      const arm = figureStrokes(J).armB;
      stroke(ctx, arm, w + 7, WHITE);
      stroke(ctx, arm, w);
      ctx.fillStyle = BLACK;
      ctx.beginPath();
      ctx.arc(J.hB[0], -J.hB[1], 4.4, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  // faster parallax layer: the same dark foreground shapes
  fore(ctx) {
    const a = [[380, 560], [520, 250], [760, 560]];
    sketchPoly(ctx, a, { w: 3, seed: 700, fill: WHITE, over: 4 });
    hatch(ctx, a, { angle: 40, gap: 5.5, w: 1.6, seed: 701, cross: true });
    const b = [[1780, 560], [1780, 330], [2080, 330], [2080, 560]];
    sketchPoly(ctx, b, { w: 3, seed: 710, fill: WHITE, over: 4 });
    hatch(ctx, b, { angle: -50, gap: 5.5, w: 1.6, seed: 711, cross: true });
    const top = [[1780, 330], [2080, 330], [2140, 290], [1840, 290]];
    sketchPoly(ctx, top, { w: 3, seed: 712, fill: WHITE, over: 4 });
    hatch(ctx, top, { angle: 10, gap: 9, w: 1.3, seed: 713 });
  },
  // screen space: in from white; and from the shot on, nothing at all
  screen(ctx, t, { W, H }) {
    drawWhiteIn(ctx, t, W, H);
    if (t >= T_SHOT - 1e-4) { ctx.fillStyle = BLACK; ctx.fillRect(0, 0, W, H); }
  },
});

export default S.build();
