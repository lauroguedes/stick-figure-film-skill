// Render the film (or one scene): frames are drawn procedurally and piped straight into ffmpeg.
//   node tools/render.mjs                      → out/film.mp4 (1920x1080, H.264 + AAC)
//   node tools/render.mjs --scene s3           → out/s3.mp4 (that scene only, no audio)
//   node tools/render.mjs --from 40 --to 50 --out out/clip.mp4
//   node tools/render.mjs --fps 60             (default 30)
import { createCanvas } from '@napi-rs/canvas';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { arg, source } from './_common.mjs';
import { WIDTH, HEIGHT, FPS } from '../src/film.js';

const src = await source();
const fps = Number(arg('fps', FPS));
const from = Number(arg('from', 0));
const to = Number(arg('to', src.duration));
const out = arg('out', src.scene ? `out/${src.label}.mp4` : 'out/film.mp4');
const audio = arg('audio', 'out/soundtrack.wav');
const withAudio = !src.scene && existsSync(audio) && !process.argv.includes('--noaudio');
mkdirSync(dirname(out), { recursive: true });

const n = Math.round((to - from) * fps);
const args = [
  '-y', '-loglevel', 'error',
  '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${WIDTH}x${HEIGHT}`, '-r', String(fps), '-i', 'pipe:0',
  ...(withAudio ? ['-ss', String(from), '-t', String(to - from), '-i', audio] : []),
  '-c:v', 'libx264', '-preset', arg('preset', 'slow'), '-crf', arg('crf', '18'), '-tune', 'animation',
  '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
  '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709',
  ...(withAudio ? ['-c:a', 'aac', '-b:a', '320k'] : []),
  '-frames:v', String(n), '-movflags', '+faststart', out,
];
const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');
const t0 = Date.now();
for (let i = 0; i < n; i++) {
  src.draw(ctx, from + i / fps);
  const ok = ff.stdin.write(canvas.data());
  if (!ok) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % 90 === 0) process.stdout.write(`\rframe ${i}/${n}`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
console.log(`\rwrote ${out}  (${n} frames @ ${fps}fps, ${((Date.now() - t0) / 1000).toFixed(1)}s${withAudio ? ', with audio' : ', no audio'})`);
