// Print solved world positions at given scene times — use it to line up contacts
// (fist ↔ chin, blade ↔ blade, hand ↔ pickup) instead of guessing.
//   node tools/probe.mjs --scene s2 --times 3.4,3.46
// Output is [worldX, height] (height: 0 = floor, up is positive) — the same units pose keys,
// weapon `at`, S.hit({x, h}) and hFw/fFw overrides use.
import { arg, source } from './_common.mjs';
const src = await source();
if (!src.scene) { console.error('probe needs --scene <id>'); process.exit(1); }
const f = (p) => `[${p[0].toFixed(0)}, ${p[1].toFixed(0)}]`;
for (const t of String(arg('times', '0')).split(',').map(Number)) {
  const s = src.scene.state(t);
  const cam = src.scene.camera(src.scene.toScreen ? src.scene.toScreen(t) : t); // probe times are AUTHORED scene times
  console.log(`t=${t}  camera x=${cam.x.toFixed(0)} y=${cam.y.toFixed(0)} zoom=${cam.z.toFixed(2)}  (visible x ${(cam.x - 960 / cam.z).toFixed(0)}…${(cam.x + 960 / cam.z).toFixed(0)}, height ${(-cam.y - 540 / cam.z).toFixed(0)}…${(-cam.y + 540 / cam.z).toFixed(0)})`);
  for (const who of ['A', 'B']) {
    const J = s[who];
    console.log(`  ${who}: hip ${f(J.hip)} head ${f(J.head)} shoulder ${f(J.sh)} hF ${f(J.hF)} hB ${f(J.hB)} fF ${f(J.fF)} fB ${f(J.fB)} kF ${f(J.kF)} kB ${f(J.kB)}`);
  }
  for (const w of s.weapons) console.log(`  weapon ${w.id} (${w.type}${w.by ? ', held by ' + w.by : ', free'}): tail ${f(w.tail)} tip ${f(w.tip)} ang ${w.ang.toFixed(0)}`);
}
