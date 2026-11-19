// Contact sheet / still renderer: the fastest way to review animation.
//   node tools/sheet.mjs --scene s2 --from 3 --to 4.3 --n 12 --out out/sheet.png   (scene-local time)
//   node tools/sheet.mjs --scene s2 --times 3.2,3.33,3.4 --cols 3 --cw 660         (explicit times)
//   node tools/sheet.mjs --scene s2 --from 3 --to 5 --n 12 --stage 1000,-200,1.6   (fixed debug camera x,y,zoom)
//   node tools/sheet.mjs --scene s2 --at 8.6 --out out/still.png                   (one full-res frame)
//   omit --scene to use FILM time across the whole timeline; --scene ref_poc = the reference scene
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { arg, source } from './_common.mjs';
import { WIDTH, HEIGHT, FPS } from '../src/film.js';

const src = await source();
const out = arg('out', 'out/sheet.png');
const stage = arg('stage', null);
const cam = stage ? (([x, y, z]) => ({ x, y, z }))(stage.split(',').map(Number)) : null;
const frame = createCanvas(WIDTH, HEIGHT);
const fctx = frame.getContext('2d');
mkdirSync(dirname(out), { recursive: true });

if (arg('at', null) != null) {
  src.draw(fctx, Number(arg('at')), { cam });
  writeFileSync(out, frame.toBuffer('image/png'));
  console.log('wrote', out);
} else {
  const from = Number(arg('from', 0)), to = Number(arg('to', src.duration)), n = Number(arg('n', 12));
  const list = arg('times', null) ? arg('times').split(',').map(Number)
    : Array.from({ length: n }, (_, i) => Math.round((from + ((to - from) * i) / Math.max(1, n - 1)) * FPS) / FPS);
  const cols = Number(arg('cols', 4));
  const cw = Number(arg('cw', 640)), chh = Math.round((cw * HEIGHT) / WIDTH);
  const sheet = createCanvas(cols * cw, Math.ceil(list.length / cols) * chh);
  const sctx = sheet.getContext('2d');
  list.forEach((t, i) => {
    src.draw(fctx, t, { cam });
    const x = (i % cols) * cw, y = Math.floor(i / cols) * chh;
    sctx.drawImage(frame, x, y, cw, chh);
    sctx.fillStyle = '#000'; sctx.fillRect(x, y, 92, 26);
    sctx.fillStyle = '#fff'; sctx.font = 'bold 18px Menlo'; sctx.fillText(t.toFixed(3), x + 6, y + 19);
    sctx.strokeStyle = '#000'; sctx.lineWidth = 2; sctx.strokeRect(x, y, cw, chh);
  });
  writeFileSync(out, sheet.toBuffer('image/png'));
  console.log('wrote', out);
}
