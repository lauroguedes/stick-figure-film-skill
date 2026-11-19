// Where do two weapons cross? Prints the intersection of the two blade segments (or the closest
// approach when they miss) at the given AUTHORED scene times — use it to place S.hit on a clash.
//   node tools/cross.mjs --scene s1 --a foil --b cleaver --times 1.12,1.42
import { arg, source } from './_common.mjs';
const src = await source();
if (!src.scene) { console.error('cross needs --scene <id>'); process.exit(1); }
const f = (p) => `[${p[0].toFixed(0)}, ${p[1].toFixed(0)}]`;
for (const t of String(arg('times', '0')).split(',').map(Number)) {
  const s = src.scene.state(t);
  const A = s.weapons.find((w) => w.id === arg('a')), B = s.weapons.find((w) => w.id === arg('b'));
  if (!A || !B) { console.log(`t=${t}: weapon missing`); continue; }
  const d1 = [A.tip[0] - A.tail[0], A.tip[1] - A.tail[1]], d2 = [B.tip[0] - B.tail[0], B.tip[1] - B.tail[1]];
  const den = d1[0] * d2[1] - d1[1] * d2[0];
  const w = [B.tail[0] - A.tail[0], B.tail[1] - A.tail[1]];
  const u = (w[0] * d2[1] - w[1] * d2[0]) / den, v = (w[0] * d1[1] - w[1] * d1[0]) / den;
  const p = [A.tail[0] + d1[0] * u, A.tail[1] + d1[1] * u];
  const ok = u >= 0 && u <= 1 && v >= 0 && v <= 1;
  console.log(`t=${t}  ${ok ? 'CROSS' : 'miss '} at ${f(p)}  — ${(u * 100).toFixed(0)}% along ${A.id} (${f(A.tail)}→${f(A.tip)}), ${(v * 100).toFixed(0)}% along ${B.id} (${f(B.tail)}→${f(B.tip)})  A.hip ${f(s.A.hip)} B.hip ${f(s.B.hip)}`);
}
