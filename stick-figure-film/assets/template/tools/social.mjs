// Social cuts, rendered from the film's own engine and soundtrack.
//   node tools/social.mjs teaser      → out/social/x-teaser.mp4            (16:9, ~40 s, cold open)
//   node tools/social.mjs vertical    → out/social/vertical-*.mp4          (9:16, re-framed on the fighters)
//   node tools/social.mjs thumbnail   → out/social/thumbnail.png           (1280×720)
//   node tools/social.mjs             → all of them
// Needs out/soundtrack.wav (npm run audio). The teaser also uses an effects-only stem, which this
// script renders itself (tools/audio.mjs --solo=sfx), and the generated score in assets/audio/music.
import { createCanvas } from '@napi-rs/canvas';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as film from '../src/film.js';
import { worldToScreen } from '../src/engine/camera.js';

film.setCanvasFactory((w, h) => createCanvas(w, h));
const { WIDTH: W, HEIGHT: H, FPS } = film;
const OUT = 'out/social';
const TMP = join(tmpdir(), 'stick-film-social');
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });
const want = process.argv[2] || 'all';
const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: ['ignore', 'inherit', 'inherit'] });
const entry = (id) => film.TIMELINE.find((e) => e.id === id);
/** film time of an AUTHORED scene time */
const at = (id, t) => entry(id).start + (entry(id).scene.toScreen ? entry(id).scene.toScreen(t) : t);

/** Pipe frames into ffmpeg. draw(ctx, i) paints frame i; vf = optional video filter. */
async function encode(file, n, draw, vf, audio) {
  const args = ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', 'pipe:0',
    ...(audio ? ['-i', audio] : []),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-tune', 'animation', '-pix_fmt', 'yuv420p',
    // range conversion FIRST (full-range RGB → video-range YUV), then any re-framing filter
    '-vf', `scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv444p${vf ? ',' + vf : ''}`,
    '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    ...(audio ? ['-c:a', 'aac', '-b:a', '256k', '-shortest'] : []), '-frames:v', String(n), '-movflags', '+faststart', file];
  const p = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < n; i++) {
    draw(ctx, i);
    if (!p.stdin.write(canvas.data())) await new Promise((r) => p.stdin.once('drain', r));
  }
  p.stdin.end();
  await new Promise((r) => p.on('close', r));
  console.log('wrote', file);
}

// ── X teaser: cold open on the bullet deflection, then the escalation, ending on the title ──
// [scene id, authored from, authored to]  — edit freely; lengths are in film seconds.
const TEASER = [            // [scene id on the timeline, authored from, authored to]
  ['minimal', 1.2, 2.2],     // cold open on the strongest single moment
  ['minimal', 0.0, 1.2],
  ['minimal', 2.6, 6.0],
];
// the bed is cross-faded from two of the generated score cues (assets/audio/music/<id>.wav) when
// they exist; without them the teaser carries effects only
const BED = ['minimal', 'minimal'];

async function teaser() {
  const segs = TEASER.map(([id, a, b]) => [at(id, a), at(id, b)]);
  const frames = [];
  for (const [a, b] of segs) for (let i = 0; i < Math.round((b - a) * FPS); i++) frames.push(a + i / FPS);
  const total = frames.length / FPS;
  // sound: effects cut with the picture, over one continuous bed made from the film's own score
  const stem = join(TMP, 'sfx.wav');
  if (!existsSync(stem)) execFileSync('node', ['tools/audio.mjs', '--solo=sfx', `--out=${stem}`], { stdio: 'ignore' });
  const parts = [];
  let cursor = 0;
  segs.forEach(([a, b], i) => {
    const d = Math.round((b - a) * FPS) / FPS;
    parts.push(`[0:a]atrim=${a}:${a + d},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st=${Math.max(0, d - 0.03)}:d=0.03[s${i}]`);
    cursor += d;
  });
  const half = Math.min(18, total * 0.47);
  const beds = BED.map((id) => `assets/audio/music/${id}.wav`);
  const hasBed = beds.every((f) => existsSync(f));
  const master = `loudnorm=I=-15:TP=-2:LRA=9,alimiter=limit=0.8:attack=2:release=60:level=false,afade=t=out:st=${total - 0.25}:d=0.25,atrim=0:${total}[out]`;
  const graph = [
    ...parts,
    `${segs.map((_, i) => `[s${i}]`).join('')}concat=n=${segs.length}:v=0:a=1[sfx]`,
    ...(hasBed ? [
      `[1:a]atrim=0:${half + 0.6},asetpts=PTS-STARTPTS[m1]`,
      `[2:a]atrim=3:${3 + total - half + 0.6},asetpts=PTS-STARTPTS[m2]`,
      `[m1][m2]acrossfade=d=0.6:c1=tri:c2=tri,volume=0.5,afade=t=out:st=${total - 2.2}:d=2.2[bed]`,
      `[sfx][bed]amix=inputs=2:normalize=0,${master}`,
    ] : [`[sfx]${master}`]),
  ].join(';');
  const audio = join(TMP, 'teaser.wav');
  ff(['-i', stem, ...(hasBed ? beds.flatMap((f) => ['-i', f]) : []), '-filter_complex', graph, '-map', '[out]', '-ar', '48000', audio]);
  await encode(`${OUT}/x-teaser.mp4`, frames.length, (ctx, i) => film.renderFrame(ctx, frames[i]), null, audio);
  console.log(`teaser: ${total.toFixed(2)} s, ${segs.length} shots`);
}

// ── vertical clips: the camera is re-framed on the fighters, not cropped blindly ──
const VERTICAL = [
  ['vertical-1', 'minimal', 0.0, 6.0],
];
const CROP_W = Math.round((H * 9) / 16); // 608 px of the 16:9 frame become the 9:16 picture

function verticalCamera(sc, t) {
  const target = (tt) => {
    const base = sc.camera(tt);
    const st = sc.state(sc.toAction(tt));
    const vis = [st.A, st.B].filter((J) => {
      if (J.reveal < 1 && tt > 1) return false;
      const p = worldToScreen(base, W, H, [J.hip[0], -J.hip[1]]);
      return p[0] > -60 && p[0] < W + 60 && p[1] > -200 && p[1] < H + 200;
    });
    if (!vis.length) return { x: base.x, y: base.y, lz: Math.log(base.z), base };
    const xs = vis.map((J) => J.hip[0]);
    const x = (Math.min(...xs) + Math.max(...xs)) / 2;
    const need = Math.max(...xs) - Math.min(...xs) + 300;
    const z = Math.max(base.z * 0.5, Math.min(base.z * 1.2, CROP_W / need));
    const yw = vis.reduce((n, J) => n - J.hip[1], 0) / vis.length;        // canvas y of the action
    const y = yw - ((yw - base.y) * base.z) / z;                          // keep it at the same screen height
    return { x, y, lz: Math.log(z), base };
  };
  let x = 0, y = 0, lz = 0;
  const offs = [-0.2, -0.1, 0, 0.1, 0.2];
  for (const o of offs) { const k = target(Math.max(0, Math.min(sc.duration - 0.01, t + o))); x += k.x; y += k.y; lz += k.lz; }
  const base = sc.camera(t);
  return { x: x / offs.length, y: y / offs.length, z: Math.exp(lz / offs.length), r: base.r, sx: base.sx, sy: base.sy };
}

async function vertical() {
  for (const [name, id, a, b] of VERTICAL) {
    const e = entry(id), sc = e.scene;
    const s0 = sc.toScreen(a), s1 = sc.toScreen(b);
    const n = Math.round((s1 - s0) * FPS), d = n / FPS;
    const audio = join(TMP, `${name}.wav`);
    ff(['-ss', String(e.start + s0), '-t', String(d), '-i', 'out/soundtrack.wav',
      '-af', `afade=t=in:d=0.15,afade=t=out:st=${d - 0.5}:d=0.5`, audio]);
    await encode(`${OUT}/${name}.mp4`, n, (ctx, i) => {
      const t = s0 + i / FPS;
      sc.draw(ctx, t, { cam: verticalCamera(sc, t) });
    }, `crop=${CROP_W}:${H}:${(W - CROP_W) / 2}:0,scale=1080:1920:flags=lanczos,unsharp=5:5:0.6`, audio);
    console.log(`${name}: ${d.toFixed(2)} s`);
  }
}

// ── thumbnail: a frame of the climax with the hand-lettered title ──
const THUMB = { scene: 'minimal', at: 3.6, title: 'YOUR FILM', crop: [0, 0, W, H] }; // crop = [x, y, w, h] of the 1920×1080 frame
function thumbnail() {
  const big = createCanvas(W, H);
  const sc = entry(THUMB.scene).scene;
  sc.draw(big.getContext('2d'), sc.toScreen(THUMB.at));
  const c = createCanvas(1280, 720);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.drawImage(big, ...THUMB.crop, 0, 0, 1280, 720);
  // title on a paper strip — keep it off the characters
  ctx.save();
  ctx.translate(400, 96);
  ctx.rotate(-0.025);
  ctx.font = '92px "Bradley Hand", "Noteworthy", cursive';
  const w = ctx.measureText(THUMB.title).width;
  ctx.fillStyle = '#000';
  ctx.fillRect(-w / 2 - 50, -70, w + 100, 124);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-w / 2 - 40, -61, w + 80, 106);
  ctx.fillStyle = '#000';
  ctx.fillText(THUMB.title, -w / 2, 24);
  ctx.restore();
  writeFileSync(`${OUT}/thumbnail.png`, c.toBuffer('image/png'));
  console.log('wrote', `${OUT}/thumbnail.png`);
}

if (want === 'all' || want === 'thumbnail') thumbnail();
if (want === 'all' || want === 'teaser') await teaser();
if (want === 'all' || want === 'vertical') await vertical();
