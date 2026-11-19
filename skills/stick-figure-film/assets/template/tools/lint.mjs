// Animation lint: flags joints that teleport between frames, limbs sinking through the floor (or the
// scene's `surface`), weapons popping, and characters out of frame.
//   node tools/lint.mjs --scene s2          (one scene)      node tools/lint.mjs   (every scene on the timeline)
//   --floor -9999   disables the floor check entirely (rarely needed: scenes with a `surface` hook are
//                   checked against it, and a surface that returns null (off a ledge, mid-fall) is skipped)
//   --all           print every issue (default: the first 25 of each kind, then a count)
import { arg, source } from './_common.mjs';
import { FPS, WIDTH, HEIGHT } from '../src/film.js';
import { worldToScreen } from '../src/engine/camera.js';

const src = await source();
const scenes = (src.scene ? [src.scene] : src.film.TIMELINE.map((e) => e.scene)).filter((sc) => sc.state);
const showAll = process.argv.includes('--all');
const floor = Number(arg('floor', -6));
const names = ['hip', 'head', 'hF', 'hB', 'fF', 'fB', 'eF', 'eB', 'kF', 'kB'];
let total = 0;
for (const sc of scenes) {
  let prev = null, issues = 0;
  const off = { A: null, B: null };
  const kinds = {};
  const say = (m, kind = 'other') => {
    kinds[kind] = (kinds[kind] || 0) + 1;
    if (showAll || kinds[kind] <= 25) console.log(`[${sc.id}] ${m}`);
    issues++;
  };
  const who2 = sc.solo ? ['A'] : ['A', 'B'];
  for (let i = 0; i <= sc.duration * FPS; i++) {
    const t = i / FPS;
    const ta = sc.toAction ? sc.toAction(t) : t;
    const s = sc.state(ta);
    for (const who of who2) {
      const J = s[who];
      if (prev) for (const n of names) {
        const d = Math.hypot(J[n][0] - prev[who][n][0], J[n][1] - prev[who][n][1]);
        if (d > 190) say(`${t.toFixed(3)} ${who}.${n} jumps ${d.toFixed(0)} units in one frame (teleport?)`, 'teleport');
      }
      // framing: a fighter out of frame for more than half a second
      const cam = sc.camera(t);
      const p = worldToScreen(cam, WIDTH, HEIGHT, [J.head[0], -J.head[1]]);
      const out = p[0] < -40 || p[0] > WIDTH + 40 || p[1] < -40 || p[1] > HEIGHT + 40;
      if (out && off[who] == null) off[who] = t;
      if ((!out || i === sc.duration * FPS) && off[who] != null) {
        if (t - off[who] > 0.5) say(`${off[who].toFixed(2)}–${t.toFixed(2)} ${who} is out of frame`, 'frame');
        off[who] = null;
      }
      const surf = sc.surface ? sc.surface(J.hip[0], ta, J) : 0;
      if (surf != null && floor > -9000) for (const n of ['fF', 'fB', 'kF', 'kB']) if (J[n][1] < surf + floor) say(`${t.toFixed(3)} ${who}.${n} is ${(surf - J[n][1]).toFixed(0)} below the ${sc.surface ? 'surface' : 'floor'}`, 'floor');
    }
    if (prev) for (const w of s.weapons) {
      const p = prev.weapons.find((q) => q.id === w.id);
      if (!p) continue;
      const d = Math.hypot(w.tip[0] - p.tip[0], w.tip[1] - p.tip[1]);
      const reach = w.spec.len * w.scale;
      if (d > 2.2 * reach + 120) say(`${t.toFixed(3)} weapon ${w.id} tip jumps ${d.toFixed(0)} units in one frame (holder change without contact?)`, 'weapon');
    }
    prev = s;
  }
  const by = Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(', ');
  console.log(`[${sc.id}] ${issues ? issues + ' issue(s): ' + by : 'clean'}  (${sc.duration}s, ${sc.cues.length} cues)`);
  total += issues;
}
process.exitCode = total ? 1 : 0;
