#!/usr/bin/env node
// Procedural soundtrack for the whole film.
//
//   node tools/audio.mjs               → out/soundtrack.wav (48 kHz, stereo, 16-bit, exactly DURATION s)
//   node tools/audio.mjs --engine=synth → ignore the generated library, synthesize everything
//   node tools/audio.mjs --stats       → also print per-scene bus levels, compressor and limiter activity
//   node tools/audio.mjs --solo=sfx|music --out=/tmp/x.wav   → audition one bus elsewhere
//   node tools/audio.mjs --cue=rifleshot@160.2,riflecock@158   → add cues to the sheet for a test render
//   node tools/audio.mjs --selftest    → render a synthetic, dense cue sheet that uses every cue type
//                                        (written to the system temp dir unless --out is given)
//   node tools/audio.mjs --audition[=clang,slam]   → every cue type (or the named ones) alone, in a
//                                        row, no music — for tweaking recipes (also to the temp dir)
//
// Two sound engines. The default ("eleven") plays the generated library in assets/audio/ (made by
// tools/soundlib.mjs: ElevenLabs sound effects per cue type and a score per scene) and falls back
// to the built-in procedural synth for any cue type or scene that has no file, with one warning
// each. "--engine=synth" uses the synth for everything.
//
// Pure Node, no dependencies, fully deterministic (seeded PRNG; same input and library → identical file).
// Everything is read from src/cues.js at run time: DURATION, CUES, SCENES, MUSIC_HINTS, ACCENTS.
//
// Layout of this file
//   1. DSP primitives      noise, oscillators, filters, envelopes, saturation, reverb
//   2. Mixer               stereo buses, equal-power panning, reverb sends
//   3. SFX recipes         one function per cue type  →  RECIPES table  (+ LEVEL_DB table)
//      3b. Sample playback how each cue type is played from the library  →  SAMPLE table
//   4. Music               instruments, one score function per scene (STYLE table), hints, accents
//      4b. Library music   the generated per-scene score on the timeline  →  MUSIC_LIB table
//   5. Master              ducking, bus compression, loudness normalisation, soft clip, true-peak limiter
//   6. Cue sheet loading, self-test sheet, WAV writer, report
//
// To tweak a sound: edit its recipe in section 3, or just its level in LEVEL_DB.
// To tweak the music of a scene: edit its score function / STYLE entry in section 4.
// Cue times live in the scene files and are locked to the picture — never compensate for them here.

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { endianness, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MUSIC_SHAPE, loadLibrary } from './soundlib.mjs';

const SR = 48000;
const TAU = Math.PI * 2;
const SEED = 'stick-film-v1';

// The cue sheet. Filled in by main() before anything is rendered (see section 6).
let DURATION = 0;        // film seconds
let N = 0;               // film length in sample frames
let CUES = [];           // [{ t, type, pan?, weight?, size?, dur?, gain?, scene }]
let SCENES = [];         // [{ id, title, start, end }]
let MUSIC_HINTS = [];    // [{ from, to, mode }]  'suspend' | 'aftermath' | 'surge'
let ACCENTS = [];        // [t, …] impact frames

const TARGET_LUFS = -12.5;      // integrated loudness target (accepted window −14 … −11)
const CEILING_DB = -2.0;        // true-peak ceiling of the limiter. −2, not −1: the AAC encode in render.mjs adds ~1.3 dB of overshoot
const CLIP_MAX = 1.14;          // master soft clipper tops out this far above the ceiling; the limiter takes the rest
const FADE_IN = 0.005;          // s
const FADE_OUT = 0.040;         // s
const MUSIC_END_FADE = 0.4;     // s — the music bus fades out over the film's last 0.4 s

const ARGS = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));

// ═════════════════════════════════════════════════════════════════════════════
// 1. DSP primitives
// ═════════════════════════════════════════════════════════════════════════════

const sec = (s) => Math.max(1, Math.round(s * SR));
const dB = (d) => 10 ** (d / 20);
const toDb = (x) => 20 * Math.log10(Math.max(x, 1e-12));
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, x) => a + (b - a) * x;
const expLerp = (a, b, x) => a * (b / a) ** x;

// ── seeded PRNG ──────────────────────────────────────────────────────────────
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rngFor = (...keys) => mulberry32(hash([SEED, ...keys].join('|')));
const rr = (rng, a, b) => a + (b - a) * rng();             // uniform in [a, b)
const rexp = (rng, a, b) => a * (b / a) ** rng();          // log-uniform in [a, b)
const rtri = (rng, mode) => {                              // triangular on [0, 1] peaking at `mode`
  const u = rng();
  return u < mode ? Math.sqrt(u * mode) : 1 - Math.sqrt((1 - u) * (1 - mode));
};

// ── noise ────────────────────────────────────────────────────────────────────
function white(n, rng) {
  const o = new Float64Array(n);
  for (let i = 0; i < n; i++) o[i] = rng() * 2 - 1;
  return o;
}
function pink(n, rng) { // Paul Kellett's filter, ≈ −3 dB/oct
  const o = new Float64Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = rng() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
    o[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return o;
}

// ── oscillators (freq: Hz or (t, x) => Hz; t in seconds, x in 0..1 of the buffer) ──
function polyblep(p, dp) {
  if (p < dp) { const t = p / dp; return t + t - t * t - 1; }
  if (p > 1 - dp) { const t = (p - 1) / dp; return t * t + t + t + 1; }
  return 0;
}
function osc(n, freq, wave = 'sine', phase = 0) {
  const o = new Float64Array(n);
  const fn = typeof freq === 'function' ? freq : null;
  let p = phase - Math.floor(phase);
  for (let i = 0; i < n; i++) {
    const dp = (fn ? fn(i / SR, i / n) : freq) / SR;
    if (wave === 'sine') o[i] = Math.sin(TAU * p);
    else if (wave === 'tri') o[i] = p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4;
    else if (wave === 'saw') o[i] = 2 * p - 1 - polyblep(p, dp);
    else { const q = p + 0.5 - Math.floor(p + 0.5); o[i] = (p < 0.5 ? 1 : -1) + polyblep(p, dp) - polyblep(q, dp); }
    p += dp; if (p >= 1) p -= 1;
  }
  return o;
}
// Sum of damped sinusoids: list of [freqHz, decayTauSec, amp, phaseRad].
function modes(n, list) {
  const o = new Float64Array(n);
  for (const [f, tau, a = 1, ph = Math.PI / 2] of list) {
    const w = TAU * f / SR, k = Math.exp(-1 / (tau * SR));
    let e = a;
    for (let i = 0; i < n; i++) { o[i] += e * Math.sin(w * i + ph); e *= k; }
  }
  return o;
}

// ── filters ──────────────────────────────────────────────────────────────────
// 2-pole state-variable filter (TPT form — stays stable while the cutoff is swept).
// fc: Hz or (t, x, i) => Hz.   mode: 0 low-pass, 1 band-pass (unity peak gain), 2 high-pass.
function svf(x, mode, fc, q = 0.7071) {
  const n = x.length, y = new x.constructor(n), k = 1 / q;
  const fn = typeof fc === 'function' ? fc : null;
  let a1 = 0, a2 = 0, a3 = 0, s1 = 0, s2 = 0;
  const set = (f) => {
    const g = Math.tan(Math.PI * clamp(f, 8, SR * 0.45) / SR);
    a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2;
  };
  if (!fn) set(fc);
  for (let i = 0; i < n; i++) {
    if (fn && (i & 7) === 0) set(fn(i / SR, i / n, i));
    if ((i & 255) === 0 && Math.abs(s1) + Math.abs(s2) < 1e-25) s1 = s2 = 0;      // no denormals in long silences
    const v3 = x[i] - s2, v1 = a1 * s1 + a2 * v3, v2 = s2 + a2 * s1 + a3 * v3;
    s1 = 2 * v1 - s1; s2 = 2 * v2 - s2;
    y[i] = mode === 0 ? v2 : mode === 1 ? k * v1 : x[i] - k * v1 - v2;
  }
  return y;
}
const lp = (x, fc, q) => svf(x, 0, fc, q);
const bp = (x, fc, q) => svf(x, 1, fc, q);
const hp = (x, fc, q) => svf(x, 2, fc, q);
function lp1(x, fc) { // one-pole smoother (for control signals)
  const y = new x.constructor(x.length), k = 1 - Math.exp(-TAU * fc / SR);
  let z = 0;
  for (let i = 0; i < x.length; i++) { z += (x[i] - z) * k; y[i] = z; }
  return y;
}
function biquad(x, b0, b1, b2, a1, a2) { // direct-form I, used by the loudness meter
  const y = new x.constructor(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

// ── envelopes & level helpers (all in place, all return the buffer) ──────────
function shape(buf, fn) { // multiply by fn(t, x)
  const n = buf.length;
  for (let i = 0; i < n; i++) buf[i] *= fn(i / SR, i / n);
  return buf;
}
function mul(buf, env) { for (let i = 0; i < buf.length; i++) buf[i] *= env[i]; return buf; }
const decay = (tau) => (t) => Math.exp(-t / tau);
const drop = (f0, f1, tau) => (t) => f1 + (f0 - f1) * Math.exp(-t / tau);   // pitch envelope
function adsr(a, d, s, r, hold) { // attack/decay/sustain level/release; note is held for `hold` s
  return (t) => {
    const on = t < a ? t / a : t < a + d ? 1 - (1 - s) * (t - a) / d : s;
    return t <= hold ? on : on * Math.max(0, 1 - (t - hold) / r);
  };
}
function fade(buf, tin, tout) {
  const n = buf.length, a = Math.min(n, Math.round(tin * SR)), b = Math.min(n, Math.round(tout * SR));
  for (let i = 0; i < a; i++) buf[i] *= i / a;
  for (let i = 0; i < b; i++) buf[n - 1 - i] *= i / b;
  return buf;
}
function peak(...bufs) {
  let m = 0;
  for (const b of bufs) for (let i = 0; i < b.length; i++) { const a = Math.abs(b[i]); if (a > m) m = a; }
  return m;
}
function scale(buf, g) { for (let i = 0; i < buf.length; i++) buf[i] *= g; return buf; }
const norm = (buf, to = 1) => scale(buf, to / (peak(buf) || 1));                 // peak-normalise
function normStereo(L, R, to = 1) { const g = to / (peak(L, R) || 1); scale(L, g); scale(R, g); }
function unit(buf) { // RMS-normalise (so noise layers can be balanced by number)
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return scale(buf, 1 / (Math.sqrt(s / buf.length) || 1));
}
// Soft clip / waveshaper: tanh with drive, unity peak stays unity.
function sat(buf, drive = 1) {
  const g = 1 / Math.tanh(drive);
  for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i] * drive) * g;
  return buf;
}
// Sum layers: each part is [buffer, gain = 1, offsetSeconds = 0].
function layer(n, ...parts) {
  const o = new Float64Array(n);
  for (const [b, g = 1, at = 0] of parts) {
    const off = Math.round(at * SR), m = Math.min(b.length, n - off);
    for (let i = 0; i < m; i++) o[off + i] += b[i] * g;
  }
  return o;
}

// ── small building blocks shared by several recipes ──────────────────────────
// Low sine thump with a downward pitch envelope.
const thump = (n, f0, f1, pitchTau, ampTau) => shape(osc(n, drop(f0, f1, pitchTau)), decay(ampTau));
// Very short bright noise tick — the sample-accurate "front edge" of an impact.
const click = (n, rng, hpHz = 2500, tau = 0.0012) => shape(hp(white(n, rng), hpHz), decay(tau));
// Irregular micro-burst envelope: Poisson events (rate per second, number or (t, x) => n),
// each an instant attack with a random fast exponential decay. Makes crackle / tearing / grit.
function burstEnv(n, rng, rate, tauMin, tauMax) {
  const e = new Float64Array(n), fn = typeof rate === 'function' ? rate : null;
  let lvl = 0, k = 0.99;
  for (let i = 0; i < n; i++) {
    if (rng() < (fn ? fn(i / SR, i / n) : rate) / SR) {
      const a = 0.25 + 0.75 * rng() ** 2;
      if (a > lvl) { lvl = a; k = Math.exp(-1 / (rr(rng, tauMin, tauMax) * SR)); }
    }
    e[i] = lvl; lvl *= k;
  }
  return e;
}
// Sample-and-hold random gain (lo..1) changing ~rate times a second: chattery, gritty AM.
function gritEnv(n, rng, rate, lo = 0.2) {
  const e = new Float64Array(n);
  for (let i = 0; i < n;) {
    const len = Math.min(n - i, sec(rr(rng, 0.5, 1.5) / rate)), v = rr(rng, lo, 1);
    e.fill(v, i, i + len); i += len;
  }
  return lp1(e, rate * 4);
}

// ── Schroeder reverb (parallel damped combs → series all-passes), mono in / stereo out ──
function reverb(inp, { rt60, combsMs, damp = 0.4, hpHz = 140, lpHz = 5500 }) {
  const n = inp.length, out = [];
  for (let ch = 0; ch < 2; ch++) {
    const acc = new Float32Array(n);
    for (const ms of combsMs) {
      const len = Math.round(ms * SR / 1000) + ch * 23;      // offset the right channel → width
      const fb = 10 ** (-3 * (len / SR) / rt60);
      const line = new Float64Array(len);
      let p = 0, z = 0;
      for (let i = 0; i < n; i++) {
        const y = line[p];
        z = y + (z - y) * damp;                              // one-pole low-pass inside the loop
        if (z < 1e-25 && z > -1e-25) z = 0;                  // no denormals in long silences
        line[p] = inp[i] + z * fb; acc[i] += y;
        if (++p === len) p = 0;
      }
    }
    for (const ms of [5.1, 1.7]) {                           // all-passes, in place
      const len = Math.round(ms * SR / 1000) + ch * 7, line = new Float64Array(len);
      let p = 0;
      for (let i = 0; i < n; i++) {
        const x = acc[i], v = line[p] - 0.5 * x;
        line[p] = x + 0.5 * v; acc[i] = v;
        if (++p === len) p = 0;
      }
    }
    out.push(scale(lp(hp(acc, hpHz), lpHz), 1 / combsMs.length));
  }
  return { L: out[0], R: out[1] };
}
const ROOM = { rt60: 0.32, combsMs: [21.3, 25.7, 29.9, 33.1, 37.3, 41.9], damp: 0.5, hpHz: 160, lpHz: 4500 };
const HALL = { rt60: 0.95, combsMs: [31.1, 37.7, 43.3, 47.9, 53.9, 61.3], damp: 0.45, hpHz: 90, lpHz: 3800 };

// ═════════════════════════════════════════════════════════════════════════════
// 2. Mixer
// ═════════════════════════════════════════════════════════════════════════════

const makeBus = () => ({ L: new Float32Array(N), R: new Float32Array(N) });   // film-length buffers are 32-bit
const DECLICK = 96; // every voice gets a 2 ms fade at its very end; onsets are never touched

// Mix a mono buffer into a bus starting exactly at round(t·SR), equal-power panned (optionally moving).
function place(bus, buf, t, gain = 1, pan = 0, panTo = null) {
  const start = Math.round(t * SR), n = buf.length, fadeN = Math.min(DECLICK, n);
  let gl = Math.cos((clamp(pan, -1, 1) + 1) * Math.PI / 4), gr = Math.sin((clamp(pan, -1, 1) + 1) * Math.PI / 4);
  for (let i = 0; i < n; i++) {
    const j = start + i;
    if (j < 0) continue;
    if (j >= N) break;
    if (panTo !== null && (i & 15) === 0) {
      const a = (clamp(lerp(pan, panTo, i / n), -1, 1) + 1) * Math.PI / 4;
      gl = Math.cos(a); gr = Math.sin(a);
    }
    const v = buf[i] * gain * (i >= n - fadeN ? (n - 1 - i) / fadeN : 1);
    bus.L[j] += v * gl; bus.R[j] += v * gr;
  }
}
// Mix a stereo pair into a bus; pan acts as a balance control (unity at centre).
function placeStereo(bus, L, R, t, gain = 1, pan = 0) {
  const start = Math.round(t * SR), n = L.length, fadeN = Math.min(DECLICK, n);
  const a = (clamp(pan, -1, 1) + 1) * Math.PI / 4, gl = Math.cos(a) * Math.SQRT2, gr = Math.sin(a) * Math.SQRT2;
  for (let i = 0; i < n; i++) {
    const j = start + i;
    if (j < 0) continue;
    if (j >= N) break;
    const f = gain * (i >= n - fadeN ? (n - 1 - i) / fadeN : 1);
    bus.L[j] += L[i] * f * gl; bus.R[j] += R[i] * f * gr;
  }
}
function addMono(dst, buf, t, gain) {
  const start = Math.round(t * SR);
  for (let i = 0; i < buf.length; i++) { const j = start + i; if (j >= 0 && j < N) dst[j] += buf[i] * gain; }
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. SFX recipes — one function per cue type:  (cue, rng, out) => void
//
// `out.mono(buf, opts)` / `out.stereo(L, R, opts)` drop a voice at the cue time. opts:
//   gain  linear, on top of LEVEL_DB[type] and the cue's own `gain`
//   pan   offset added to the cue's `pan`;  panTo: end offset for a moving source (mono only)
//   at    seconds after the cue time (default 0 → sample-accurate onset)
//   room / hall   reverb send amounts (0 = bone dry)
// Voices are peak-normalised (norm) before they are emitted, so LEVEL_DB is the peak level.
// ═════════════════════════════════════════════════════════════════════════════

const LEVEL_DB = {
  scribble: -9, whoosh: -8, step: -9, thud: -6, stomp: -3, hit: -2, block: -8, clack: -4,
  skid: -15, pop: -8, boom: -3, wallbreak: 0, crumble: -11, tear: -8, crack: -9, shing: -16,
  riser: -5, slowdown: -9, heartbeat: -18, megaimpact: 1, cuthit: 0,
  draw: -9, slice: -10, heavyswing: -5, clang: -4, slam: -1.5, snap: -6, shatter: -5, inksplash: -7,
  rumble: -16, wind: -21, thunder: -3, pageturn: -8,       // rumble and wind are beds: keep them low
  // firearms — library only, there is no synth recipe for these
  gunshot: -1, ricochet: -9, bulletimpact: -5, bulletwhiz: -10, shell: -14, dryfire: -10, reload: -10,
  rifleshot: 0, riflecock: -3, rustle: -13, whistle: -15, chime: -10,                             // the rifle shot is the film's full stop: see STOP_TYPES
};

// Pencil on paper: bright band-passed noise, amplitude = an irregular 15–30 Hz stroke pattern
// (each stroke speeds up and slows down; some lift off early), times the "tooth" of the paper.
function scribble(c, rng, out) {
  const n = sec(c.dur ?? 0.5);
  const speed = new Float64Array(n);
  for (let i = 0; i < n;) {
    const len = Math.min(n - i, sec(1 / rr(rng, 15, 30)));
    const a = rr(rng, 0.45, 1), lift = rng() < 0.2 ? rr(rng, 0.55, 0.8) : 1;
    for (let k = 0; k < len; k++) {
      const x = k / len;
      speed[i + k] = x < lift ? a * Math.sin(Math.PI * x / lift) ** 0.6 : 0;
    }
    i += len;
  }
  const v = lp1(speed, 220);
  const tooth = lp(white(n, rng), 340).map((s) => Math.min(1.6, 0.35 + 7 * Math.abs(s)));
  const graphite = unit(lp(hp(bp(white(n, rng), (t, x, i) => 2300 + 3300 * v[i], 0.8), 1500), 9000));
  const paper = unit(bp(pink(n, rng), 900, 0.7));                       // dull body of the page/desk
  const y = layer(n, [graphite, 1], [paper, 0.4]);
  for (let i = 0; i < n; i++) y[i] *= v[i] * tooth[i];
  out.mono(norm(fade(y, 0.003, 0.012)));
}

// Air movement: band-passed noise whose centre sweeps up then down under a bell envelope.
const WHOOSH = {
  s: { f0: 1100, f1: 3400, f2: 1500, q: 1.7, gain: 0.42, pan: 0.15 },
  m: { f0: 600, f1: 2300, f2: 800, q: 1.4, gain: 0.65, pan: 0.25 },
  l: { f0: 260, f1: 1500, f2: 360, q: 1.2, gain: 1.0, pan: 0.35 },
};
function whoosh(c, rng, out) {
  const p = WHOOSH[c.size] ?? WHOOSH.m, n = sec(c.dur ?? 0.2), pk = 0.58;
  const fc = (t, x) => (x < pk ? expLerp(p.f0, p.f1, (x / pk) ** 1.5) : expLerp(p.f1, p.f2, ((x - pk) / (1 - pk)) ** 0.8));
  const bell = (t, x) => Math.sin(Math.PI * (x < pk ? 0.5 * x / pk : 0.5 + 0.5 * (x - pk) / (1 - pk))) ** 2.2;
  const core = unit(bp(pink(n, rng), fc, p.q));
  const air = unit(bp(white(n, rng), (t, x) => fc(t, x) * 2.8, 0.8));
  const body = unit(lp(pink(n, rng), (t, x) => fc(t, x) * 0.6));
  const y = shape(layer(n, [core, 1], [air, 0.3], [body, c.size === 'l' ? 0.5 : 0.2]), bell);
  const dir = rng() < 0.5 ? -1 : 1;
  out.mono(norm(y), { gain: p.gain, pan: -dir * p.pan, panTo: dir * p.pan });
}

// Footfalls and body drops: low sine thump + low-passed noise slap. Shared by step/thud/stomp.
function footfall(n, rng, { f0, f1, ampTau, slapHz, slapTau, slap, drive }) {
  const body = sat(thump(n, f0, f1, 0.025, ampTau), drive);
  const skin = shape(unit(lp(white(n, rng), slapHz)), decay(slapTau));
  return layer(n, [body, 1], [skin, slap], [click(n, rng, 1800, 0.001), 0.25]);
}
function step(c, rng, out) {
  const w = c.weight ?? 0.5, n = sec(0.3);
  const y = footfall(n, rng, { f0: 92, f1: 46, ampTau: 0.04 + 0.035 * w, slapHz: 900, slapTau: 0.012, slap: 0.2, drive: 1 + w });
  out.mono(norm(y), { gain: 0.35 + 0.65 * w, room: 0.05 * w });
}
function thud(c, rng, out) {
  const w = c.weight ?? 0.6, n = sec(0.5);
  const y = footfall(n, rng, { f0: 84, f1: 40, ampTau: 0.07 + 0.05 * w, slapHz: 600, slapTau: 0.022, slap: 0.28, drive: 1.2 + 1.3 * w });
  out.mono(norm(y), { gain: 0.4 + 0.6 * w, room: 0.12 * w });
}
function stomp(c, rng, out) {
  const n = sec(0.75);
  const hitPart = footfall(n, rng, { f0: 78, f1: 37, ampTau: 0.15, slapHz: 1200, slapTau: 0.03, slap: 0.35, drive: 2.6 });
  const rustle = mul(unit(bp(white(n, rng), 2600, 0.6)), burstEnv(n, rng, (t) => 260 * Math.exp(-t / 0.12), 0.002, 0.012));
  shape(rustle, (t) => Math.min(1, t / 0.02) * Math.exp(-t / 0.11));     // paper settling after the hit
  out.mono(norm(layer(n, [hitPart, 1], [rustle, 0.12])), { room: 0.22 });
}

// Body impact: click + punchy 120→50 Hz sine + ~60 ms mid noise burst. Full weight adds sub + room.
function hit(c, rng, out) {
  const w = c.weight ?? 0.7, big = w >= 0.95, n = sec(0.3 + 0.35 * w);
  const body = sat(thump(n, 120 + 40 * w, 50, 0.018, 0.045 + 0.05 * w), 1 + 2.5 * w);
  const mid = shape(unit(bp(white(n, rng), 1500, 0.6)), decay(0.02));
  const smack = shape(unit(bp(white(n, rng), 3300, 1.2)), decay(0.007));
  const y = layer(n, [body, 1], [mid, 0.3 + 0.15 * w], [smack, 0.22], [click(n, rng), 0.4]);
  if (big) y.set(layer(n, [y, 1], [sat(thump(n, 64, 34, 0.06, 0.17), 2), 0.9]));
  out.mono(norm(sat(y, 1.4)), { gain: 0.4 + 0.6 * w, room: big ? 0.38 : 0.08 * w });
}

// Forearm on forearm: short, dry, higher slap with a small knock and almost no sub.
function block(c, rng, out) {
  const w = c.weight ?? 0.6, n = sec(0.16);
  const knock = shape(osc(n, drop(340, 215, 0.012)), decay(0.02));
  const slap = shape(unit(bp(white(n, rng), 2300, 1.1)), decay(0.011 + 0.006 * w));
  const low = thump(n, 150, 95, 0.015, 0.03);
  const y = layer(n, [knock, 0.8], [slap, 0.45], [click(n, rng, 4500, 0.003), 0.4], [low, 0.35 * w]);
  out.mono(norm(sat(y, 1.3)), { gain: 0.45 + 0.55 * w });
}

// Wooden staff: inharmonic damped modes (free-bar ratios) with a sharp attack; heavy hits add a thump.
function clack(c, rng, out) {
  const w = c.weight ?? 0.7, n = sec(0.35), f = rr(rng, 730, 800) * (1.08 - 0.12 * w);
  const wood = modes(n, [[f, 0.055, 1], [f * 1.78, 0.036, 0.7], [f * 2.93, 0.02, 0.5], [f * 4.1, 0.011, 0.25], [f * 0.5, 0.024, 0.4]]);
  const attack = layer(n, [click(n, rng, 3000, 0.0015), 0.8], [shape(unit(bp(white(n, rng), 1900, 1)), decay(0.005)), 0.35]);
  const low = thump(n, 112, 60, 0.02, 0.06);
  const y = layer(n, [wood, 0.6], [attack, 1], [low, Math.max(0, w - 0.4) * 1.6]);
  out.mono(norm(sat(y, 1.2)), { gain: 0.45 + 0.55 * w, room: 0.14 * w });
}

// Paper scrape: stick-slip chatter that slows down and darkens as the slide loses speed.
function skid(c, rng, out) {
  const dur = c.dur ?? 0.3, n = sec(dur + 0.04);
  const grain = unit(layer(n,
    [unit(bp(pink(n, rng), (t, x) => expLerp(2700, 1100, x), 0.9)), 1],
    [shape(unit(bp(white(n, rng), 5200, 0.8)), (t, x) => 1 - x), 0.3],
    [unit(lp(pink(n, rng), 480)), 0.35]));
  const rough = lp(white(n, rng), (t, x) => lerp(150, 60, x)).map((s) => Math.min(1.5, 9 * Math.abs(s)));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const x = i / n;
    ph += lerp(62, 22, x) * (0.7 + 0.6 * rough[i]) / SR;
    const chatter = (1 - (ph - Math.floor(ph))) ** 2;                    // sawtooth stick-slip
    grain[i] *= (0.3 + 0.7 * chatter) * (0.5 + rough[i]) * (1 - x) ** 1.6 * Math.min(1, i / 150);
  }
  out.mono(norm(grain));
}

// Something yanked out of the page: an upward-chirping pop, a tiny pluck and a short paper rip.
function pop(c, rng, out) {
  const n = sec(0.16);
  const chirp = shape(osc(n, (t) => 270 + 950 * (1 - Math.exp(-t / 0.012))), decay(0.026));
  const pluck = modes(n, [[540, 0.045, 1, 0], [1330, 0.018, 0.5, 0]]);
  const rip = mul(unit(hp(white(n, rng), 2800)), burstEnv(n, rng, (t) => 1500 * Math.exp(-t / 0.035), 0.0004, 0.002));
  shape(rip, decay(0.04));
  out.mono(norm(layer(n, [chirp, 1], [pluck, 0.3], [click(n, rng, 3000, 0.001), 0.5], [rip, 0.1, 0.012])));
}

// Deep cinematic low hit with soft saturation.
function boom(c, rng, out) {
  const n = sec(0.95);
  const sub = sat(shape(osc(n, drop(62, 46, 0.1)), decay(0.2)), 2.5);
  const air = shape(unit(lp(pink(n, rng), 220)), decay(0.05));
  out.mono(norm(layer(n, [sub, 1], [air, 0.25])), { hall: 0.25 });
}

// Fist through a wall: sub drop + clipped noise crack + gritty mid crunch + a few brick knocks.
function wallbreak(c, rng, out) {
  const s = c.size ?? 1, n = sec(0.5 + 0.7 * s);
  const sub = sat(shape(osc(n, drop(88, 33, 0.09)), decay(0.12 + 0.2 * s)), 2);
  const punch = sat(thump(n, 160, 55, 0.02, 0.06), 2.5);
  const crack = lp(hp(sat(shape(white(n, rng), decay(0.022)), 4), 1500), 8000);
  const crunch = sat(shape(mul(unit(bp(white(n, rng), 700, 0.5)), gritEnv(n, rng, 110)), decay(0.09 + 0.1 * s)), 2.5);
  const bricks = modes(n, Array.from({ length: 5 }, () => [rexp(rng, 180, 650), rr(rng, 0.03, 0.08), rr(rng, 0.4, 1)]));
  const y = layer(n, [sub, 1], [punch, 0.8], [crack, 0.5], [crunch, 0.45], [norm(bricks), 0.3], [click(n, rng, 2000, 0.0015), 0.5]);
  out.mono(norm(sat(y, 1.5)), { gain: 0.35 + 0.65 * s, room: 0.3, hall: 0.35 * s });
}

// Falling debris: many small damped knocks (200–1200 Hz) that thin out, over a bed of dust.
function crumble(c, rng, out) {
  const dur = c.dur ?? 0.6, count = Math.max(6, Math.round(42 * dur));
  for (let k = 0; k < count; k++) {
    const x = rng() ** 1.7, f = rexp(rng, 200, 1200), tau = rr(rng, 0.008, 0.035) * (400 / f) ** 0.3, n = sec(tau * 7);
    const knock = modes(n, [[f, tau, 1], [f * rr(rng, 1.4, 1.9), tau * 0.6, 0.5], [f * rr(rng, 2.3, 3.1), tau * 0.4, 0.25]]);
    const tick = shape(unit(bp(white(n, rng), Math.min(f * 4, 6000), 1)), decay(0.003));
    out.mono(norm(layer(n, [knock, 1], [tick, 0.25])), {
      at: x * dur, gain: rr(rng, 0.3, 1) * (1 - x) ** 1.1, pan: rr(rng, -0.2, 0.2), room: 0.12,
    });
  }
  const n = sec(dur);
  const dust = mul(unit(bp(pink(n, rng), 1800, 0.5)), burstEnv(n, rng, (t, x) => 500 * (1 - x), 0.001, 0.006));
  out.mono(norm(shape(dust, (t, x) => (1 - x) ** 2)), { gain: 0.22 });
}

// Paper tearing: bright noise chopped into dense irregular micro-bursts, density rising then falling.
function tear(c, rng, out) {
  const dur = c.dur ?? 0.5, n = sec(dur + 0.06);
  const dens = (x) => (x < 0.3 ? (x / 0.3) ** 0.7 : Math.max(0, 1 - (x - 0.3) / 0.7) ** 1.4);
  const fibres = mul(hp(white(n, rng), 2600), burstEnv(n, rng, (t, x) => 120 + 1700 * dens(x), 0.0003, 0.002));
  const rip = mul(bp(white(n, rng), (t, x) => 1500 - 500 * x, 0.8), burstEnv(n, rng, (t, x) => 30 + 260 * dens(x), 0.002, 0.008));
  const air = shape(bp(white(n, rng), 5200, 0.6), (t, x) => dens(x));
  const y = layer(n, [unit(fibres), 1], [unit(rip), 0.6], [unit(air), 0.22]);
  out.mono(norm(shape(y, (t, x) => 0.25 + 0.75 * dens(x))));
}

// Ink fractures: dry splintering clicks — sparse, accelerating, then thinning, spreading outward.
function crack(c, rng, out) {
  const dur = c.dur ?? 0.5, count = Math.max(8, Math.round(70 * dur));
  for (let k = 0; k < count; k++) {
    const x = k === 0 ? 0 : rtri(rng, 0.3), n = sec(0.035), f = rexp(rng, 2200, 7500);
    const parts = [
      [modes(n, [[f, rr(rng, 0.0012, 0.004), 1], [f * rr(rng, 1.3, 1.7), 0.002, 0.5]]), 1],
      [click(n, rng, 3000, 0.0006), 0.8],
    ];
    if (k === 0 || rng() < 0.3) parts.push([modes(n, [[rexp(rng, 600, 1100), 0.008, 1]]), 0.8]);   // deeper snap
    out.mono(norm(layer(n, ...parts)), {
      at: x * dur, gain: k === 0 ? 1 : rr(rng, 0.25, 0.9) * (1 - 0.5 * x), pan: rr(rng, -1, 1) * (0.1 + 0.6 * x),
    });
  }
}

// Giant-blade shimmer: detuned inharmonic partials split left/right so they beat across the image.
function shing(c, rng, out) {
  const dur = c.dur ?? 0.9, n = sec(dur * 1.55), base = 1870, att = dur * 0.38;
  const L = new Float64Array(n), R = new Float64Array(n);
  [1, 1.503, 2.086, 2.756, 3.42, 4.61].forEach((ratio, k) => {
    const f = base * ratio, det = rr(rng, 1.5, 4), amp = 1 / (k + 1) ** 0.8, tau = dur * 0.36 / (1 + 0.25 * k);
    const env = (t) => (t < att ? (t / att) ** 2 : Math.exp(-(t - att) / tau));
    const a = shape(osc(n, f - det, 'sine', rng()), env), b = shape(osc(n, f + det, 'sine', rng()), env);
    for (let i = 0; i < n; i++) { L[i] += amp * (a[i] + 0.35 * b[i]); R[i] += amp * (b[i] + 0.35 * a[i]); }
  });
  const air = shape(unit(bp(white(n, rng), 9000, 2)), (t) => 0.12 * (t < att ? (t / att) ** 2 : Math.exp(-(t - att) / (dur * 0.3))));
  const wob = rr(rng, 7, 11);
  for (let i = 0; i < n; i++) {
    const m = 1 - 0.18 * (0.5 + 0.5 * Math.sin(TAU * wob * i / SR));
    L[i] = (L[i] + air[i]) * m; R[i] = (R[i] + air[i]) * m;
  }
  normStereo(L, R);
  out.stereo(fade(L, 0, 0.05), fade(R, 0, 0.05), { hall: 0.5 });
}

// Riser: noise + tone sweeping upward with an accelerating tremolo; stops dead at t + dur.
function riser(c, rng, out) {
  const dur = c.dur ?? 0.5, n = sec(dur);
  const up = (a, b, p) => (t, x) => expLerp(a, b, x ** p);
  const f = up(82, 660, 1.4);
  const air = unit(bp(white(n, rng), up(350, 7500, 1.2), 2.2));
  const tone = unit(lp(layer(n, [osc(n, f, 'saw'), 0.6], [osc(n, (t, x) => f(t, x) * 1.011, 'saw', 0.4), 0.6]), (t, x) => f(t, x) * 5, 1.2));
  const y = layer(n, [air, 0.5], [tone, 0.8], [osc(n, up(41, 165, 1.4)), 0.7]);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const x = i / n;
    ph += expLerp(9, 34, x) / SR;
    y[i] *= x ** 2.3 * (1 - 0.3 * (0.5 + 0.5 * Math.cos(TAU * ph)));
  }
  out.mono(norm(fade(y, 0, 0.0015)));
}

// "Time stretches": a tape-stop (pitch and brightness bending down) then a low airy rumble that
// holds for the duration and opens up just before time snaps back.
const SLOWDOWN_RUMBLE_DB = -22;   // rumble level relative to the tape-stop — keep the hole quiet
function slowdown(c, rng, out) {
  const dur = c.dur ?? 1.2;
  const n1 = sec(Math.min(0.4, dur));
  const bend = (hi, lo, tau) => (t) => lo + (hi - lo) * Math.exp(-t / tau);
  const reel = unit(lp(osc(n1, bend(330, 24, 0.1), 'saw'), bend(2400, 120, 0.1), 1.2));
  const wash = unit(bp(pink(n1, rng), bend(3600, 110, 0.085), 1.4));
  const stop = shape(layer(n1, [reel, 0.6], [wash, 1]), (t, x) => Math.exp(-t / 0.07) * (1 - x));
  out.mono(norm(stop));

  const n2 = sec(dur), tail = 0.2;
  const rumble = () => {
    const open = (t) => (t < dur - tail ? 120 : expLerp(120, 650, (t - (dur - tail)) / tail));
    const low = unit(lp(lp(pink(n2, rng), open), open));
    const air = unit(bp(white(n2, rng), 480, 0.5));
    const y = layer(n2, [low, 1], [air, 0.1]);
    const lfo = rr(rng, 0.7, 1.1), ph = rng() * TAU;
    return shape(y, (t) => Math.min(1, t / 0.3) ** 1.5 * (0.8 + 0.2 * Math.sin(TAU * lfo * t + ph))
      * (t < dur - tail ? 1 : 1 + 1.2 * (t - (dur - tail)) / tail) * clamp((dur - t) / 0.05, 0, 1));
  };
  const L = rumble(), R = rumble();
  normStereo(L, R);
  out.stereo(L, R, { gain: dB(SLOWDOWN_RUMBLE_DB) });
}

// Soft lub-dub.
function heartbeat(c, rng, out) {
  const n = sec(0.42);
  const beat = (f, tau) => layer(n, [thump(n, f, f * 0.62, 0.03, tau), 1], [thump(n, f * 2, f * 1.3, 0.025, tau * 0.6), 0.3]);
  const y = layer(n, [beat(92, 0.05), 1], [beat(78, 0.042), 0.7, 0.15]);
  out.mono(norm(lp(sat(y, 2), 320)));                  // upper partial + saturation: audible on small speakers
}

// The biggest hit in the piece: long sub drop, layered crack/crunch, rubble, hall tail. Stereo.
function megaimpact(c, rng, out) {
  const n = sec(1.7);
  const sub = sat(shape(osc(n, drop(70, 28, 0.2)), decay(0.34)), 1.6);       // ≈ 1.2 s to −30 dB
  const punch = sat(thump(n, 165, 48, 0.028, 0.085), 3);
  const body = shape(unit(lp(pink(n, rng), 300)), decay(0.2));
  const core = layer(n, [sub, 1], [punch, 0.9], [body, 0.2], [click(n, rng, 1800, 0.0015), 0.7]);
  const side = () => {                                                        // decorrelated per channel
    const crackle = lp(hp(sat(shape(white(n, rng), decay(0.028)), 4), 900), 8000);
    const crunch = sat(shape(mul(unit(bp(white(n, rng), 800, 0.5)), gritEnv(n, rng, 90)), decay(0.15)), 2.5);
    const rubble = mul(unit(bp(pink(n, rng), 500, 0.7)), burstEnv(n, rng, (t) => 90 * Math.exp(-t / 0.3), 0.004, 0.02));
    return layer(n, [crackle, 0.55], [crunch, 0.5], [shape(rubble, decay(0.35)), 0.1]);
  };
  const L = sat(layer(n, [core, 1], [side(), 1]), 1.3), R = sat(layer(n, [core, 1], [side(), 1]), 1.3);
  normStereo(L, R);
  out.stereo(L, R, { hall: 0.55, room: 0.25 });
}

// Hard cut to black: one tight, dry, heavy hit; forced to zero 0.2 s after the cue.
function cuthit(c, rng, out) {
  const n = sec(0.2);
  const body = sat(thump(n, 105, 46, 0.016, 0.045), 4);
  const mid = shape(unit(bp(white(n, rng), 1300, 0.6)), decay(0.015));
  const y = layer(n, [body, 1], [mid, 0.3], [click(n, rng, 2200, 0.0012), 0.5]);
  out.mono(norm(shape(sat(y, 1.5), (t, x) => (1 - x) ** 1.5)));
}

// ── recipes added for the full film ──────────────────────────────────────────

// Mix `src` into `dst` starting `at` seconds in (in place).
function mixInto(dst, src, at = 0, gain = 1) {
  const off = Math.round(at * SR), m = Math.min(src.length, dst.length - off);
  for (let i = Math.max(0, -off); i < m; i++) dst[off + i] += src[i] * gain;
  return dst;
}
// Smooth random control curve in 0..1: cosine-interpolated random points, ~`rate` of them a second.
function wander(n, rng, rate) {
  const o = new Float64Array(n);
  let a = rng(), b = rng();
  for (let i = 0; i < n;) {
    const len = Math.min(n - i, sec(rr(rng, 0.6, 1.4) / rate));
    for (let k = 0; k < len; k++) o[i + k] = a + (b - a) * (0.5 - 0.5 * Math.cos(Math.PI * k / len));
    i += len; a = b; b = rng();
  }
  return o;
}

// One fast, confident pen stroke: a resonant (so slightly tonal) band of noise that follows the
// speed of the nib, a faint squeak, and small ticks where the pen touches down and lifts off.
function draw(c, rng, out) {
  const dur = c.dur ?? 0.25, n = sec(dur + 0.02);
  const speed = (x) => Math.sin(Math.PI * clamp(x, 0, 1)) ** 0.45;
  const fc = (t) => 2600 + 2600 * speed(t / dur) + 500 * Math.min(1, t / dur);
  const nib = unit(bp(white(n, rng), fc, 5));
  const hiss = unit(hp(bp(white(n, rng), (t) => fc(t) * 1.6, 1), 2000));
  const squeak = osc(n, (t) => fc(t) * 0.5, 'tri');
  const tooth = lp(white(n, rng), 500).map((s) => 0.75 + 3 * Math.abs(s));
  const y = layer(n, [nib, 1], [hiss, 0.35], [squeak, 0.14]);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    y[i] *= t < dur ? (0.3 + 0.7 * speed(t / dur)) * tooth[i] * Math.min(1, i / 60) * Math.min(1, (dur - t) / 0.004) : 0;
  }
  const tick = () => {
    const m = sec(0.012);
    return norm(layer(m, [click(m, rng, 3500, 0.0012), 1], [modes(m, [[rr(rng, 2800, 3600), 0.003, 0.6]]), 1]));
  };
  const v = layer(n, [norm(y), 1], [tick(), 0.5], [tick(), 0.35, Math.max(0, dur - 0.004)]);
  const dir = rng() < 0.5 ? -1 : 1;
  out.mono(norm(v), { pan: -dir * 0.12, panTo: dir * 0.12 });
}

// A blade cutting air or paper: a very short, bright, airy "fft" with a thin whistling edge.
// High weight adds a tiny paper rip behind it.
function slice(c, rng, out) {
  const w = c.weight ?? 0.6, dur = 0.07 + 0.05 * w, n = sec(dur + 0.09);
  const up = (t) => expLerp(4500, 11500, Math.min(1, t / dur) ** 0.7);
  const air = unit(bp(white(n, rng), up, 1.3));
  const edge = unit(hp(white(n, rng), 7000));
  const whistle = osc(n, (t) => up(t) * 0.82);
  const y = shape(layer(n, [air, 1], [edge, 0.5], [whistle, 0.12]),
    (t) => Math.min(1, t / 0.004) * (t < dur ? 0.5 + 0.5 * Math.sin(Math.PI * t / dur) : 0.5 * Math.exp(-(t - dur) / 0.012)));
  if (w >= 0.7) {
    const rip = mul(unit(hp(white(n, rng), 2600)), burstEnv(n, rng, (t) => (t < dur * 0.6 ? 0 : 1400 * Math.exp(-(t - dur * 0.6) / 0.03)), 0.0004, 0.002));
    mixInto(y, rip, 0, 0.3 * w);
  }
  const dir = rng() < 0.5 ? -1 : 1;
  out.mono(norm(y), { gain: 0.55 + 0.45 * w, pan: -dir * 0.25, panTo: dir * 0.25 });
}

// Heavy weapon swing: low band (80–500 Hz) with a doppler-like pitch drop as it passes, a low
// tonal body and a fluttering sub. The pass (loudest point) sits at the end of `dur`, i.e. just
// before the contact the swing leads to; the falling tail rings on after it.
function heavyswing(c, rng, out) {
  const w = c.weight ?? 0.8, dur = Math.max(0.22, c.dur ?? 0.5), total = dur + 0.3, n = sec(total), pk = dur * 0.9 / total;
  const bell = (t, x) => Math.sin(Math.PI * (x < pk ? 0.5 * x / pk : 0.5 + 0.5 * (x - pk) / (1 - pk))) ** 2;
  const dop = (x) => (x < pk ? 1 + 0.12 * x / pk : 1.12 * Math.exp(-2.2 * (x - pk) / (1 - pk)));
  const fc = (t, x) => clamp(360 * dop(x), 80, 500);
  const body = unit(bp(pink(n, rng), fc, 1.6));
  const low = unit(lp(pink(n, rng), (t, x) => 0.7 * fc(t, x)));
  const tone = unit(lp(osc(n, (t, x) => 118 * Math.max(0.45, dop(x)), 'saw'), (t, x) => 2.5 * fc(t, x)));
  const sub = osc(n, (t, x) => 54 * Math.max(0.6, dop(x)));
  const rate = rr(rng, 11, 16);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    ph += rate * (0.7 + 0.5 * dop(i / n)) / SR;
    sub[i] *= 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(TAU * ph));               // sub flutter
  }
  const y = lp(sat(scale(shape(layer(n, [body, 1], [low, 0.7], [tone, 0.5], [sub, 1.5]), bell), 0.5), 1.5), 900);   // keep it dark
  const dir = rng() < 0.5 ? -1 : 1;
  out.mono(norm(y), { gain: 0.5 + 0.5 * w, pan: -dir * 0.45, panTo: dir * 0.45 });
}

// Metal on metal: beating pairs of inharmonic partials (ratios drawn per cue, so no two clangs
// are the same), a hard transient, and a low "body" when the weight is high.
function clang(c, rng, out) {
  const w = c.weight ?? 0.7, n = sec(0.25 + 0.5 * w), f0 = rexp(rng, 1500, 2300), ring = 0.035 + 0.055 * w;
  const list = [];
  for (let k = 0, ratio = 1; k < 7 && f0 * ratio < 9500; k++, ratio *= rr(rng, 1.28, 1.62)) {
    const f = f0 * ratio, tau = ring / (1 + 0.45 * k) * rr(rng, 0.8, 1.2), a = rr(rng, 0.5, 1) / (1 + 0.25 * k);
    list.push([f, tau, a], [f * (1 + rr(rng, 0.002, 0.008)), tau * 0.9, a * 0.6]);
  }
  const strike = layer(n, [click(n, rng, 4000, 0.0012), 1], [shape(unit(bp(white(n, rng), f0 * 2.2, 0.8)), decay(0.004)), 0.4]);
  const body = modes(n, [[rr(rng, 180, 260), 0.035, 1], [rr(rng, 420, 560), 0.02, 0.5]]);
  const y = layer(n, [norm(modes(n, list)), 0.8], [strike, 0.8], [norm(body), Math.max(0, w - 0.45) * 0.9],
    [thump(n, 120, 70, 0.02, 0.05), Math.max(0, w - 0.7) * 1.5]);
  out.mono(norm(sat(y, 1.2)), { gain: 0.4 + 0.6 * w, room: 0.1 + 0.1 * w, hall: 0.12 * w });
}

// Heavy weapon into ground or wall: low boom + crunch + a short tail of debris. Sits between
// `stomp` and `wallbreak`.
function slam(c, rng, out) {
  const w = c.weight ?? 0.8, n = sec(0.7 + 0.5 * w);
  const low = sat(shape(osc(n, drop(78, 36, 0.06)), decay(0.14 + 0.1 * w)), 2.2);
  const punch = sat(thump(n, 150, 55, 0.02, 0.05), 2.5);
  const crunch = sat(shape(mul(unit(bp(white(n, rng), 520, 0.5)), gritEnv(n, rng, 100)), decay(0.11)), 2.5);
  const crack = lp(hp(sat(shape(white(n, rng), decay(0.015)), 4), 1200), 7000);
  const debris = new Float64Array(n);
  for (let k = 0, count = Math.round(8 + 10 * w); k < count; k++) {
    const f = rexp(rng, 220, 1100), tau = rr(rng, 0.008, 0.03), m = sec(tau * 7);
    mixInto(debris, modes(m, [[f, tau, 1], [f * rr(rng, 1.5, 2.6), tau * 0.5, 0.4]]), 0.05 + 0.5 * rng() ** 1.5, rr(rng, 0.3, 1));
  }
  const dust = shape(mul(unit(bp(pink(n, rng), 1500, 0.5)), burstEnv(n, rng, (t) => 400 * Math.exp(-t / 0.2), 0.001, 0.006)), decay(0.25));
  const y = layer(n, [low, 1], [punch, 0.7], [crunch, 0.45], [crack, 0.35], [click(n, rng, 2000, 0.0015), 0.4], [norm(debris), 0.16], [dust, 0.06]);
  out.mono(norm(sat(y, 1.4)), { gain: 0.45 + 0.55 * w, room: 0.25, hall: 0.2 * w });
}

// A wooden pencil or staff breaking: one sharp crack and two smaller, higher splinter ticks.
function snap(c, rng, out) {
  const n = sec(0.2);
  const crackOne = (f, len) => {
    const m = sec(0.06);
    return norm(layer(m, [modes(m, [[f, 0.012 * len, 1], [f * 2.1, 0.007 * len, 0.6], [f * 3.6, 0.004 * len, 0.4]]), 0.7],
      [click(m, rng, 3000, 0.001), 1], [shape(unit(bp(white(m, rng), 2500, 0.9)), decay(0.005 * len)), 0.5]));
  };
  const y = layer(n, [crackOne(rr(rng, 1050, 1250), 1), 1], [thump(n, 190, 120, 0.01, 0.018), 0.4],
    [crackOne(rr(rng, 1700, 2300), 0.6), 0.4, rr(rng, 0.035, 0.06)], [crackOne(rr(rng, 2200, 3000), 0.5), 0.28, rr(rng, 0.085, 0.125)]);
  out.mono(norm(y));
}

// A weapon breaking into pieces: a bright burst, then a spray of small tonal fragments that
// fall away (and sometimes bounce) over about 0.6 s, spreading across the image.
function shatter(c, rng, out) {
  const n = sec(0.16), f0 = rexp(rng, 2200, 3200);
  const burst = shape(unit(hp(white(n, rng), 3000)), decay(0.022));
  const ringing = modes(n, Array.from({ length: 6 }, (_, k) => [f0 * (1 + 0.37 * k) * rr(rng, 0.94, 1.06), rr(rng, 0.012, 0.035), 1 / (1 + 0.3 * k)]));
  out.mono(norm(layer(n, [burst, 0.5], [norm(ringing), 0.8], [click(n, rng, 4000, 0.001), 0.7], [thump(n, 170, 90, 0.012, 0.025), 0.3])), { room: 0.1 });
  for (let k = 0; k < 22; k++) {
    const x = rng() ** 1.5, at = 0.02 + 0.6 * x, f = rexp(rng, 2000, 8000) * (1 - 0.25 * x), tau = rr(rng, 0.008, 0.035), m = sec(tau * 7);
    const ping = norm(modes(m, [[f, tau, 1], [f * rr(rng, 1.35, 1.8), tau * 0.6, 0.5]]));
    const gain = rr(rng, 0.2, 0.7) * (1 - x) ** 0.8, pan = rr(rng, -1, 1) * (0.1 + 0.5 * x);
    out.mono(ping, { at, gain, pan });
    if (rng() < 0.35) out.mono(ping, { at: at + rr(rng, 0.03, 0.07), gain: gain * 0.45, pan });
  }
}

// Ink: a wet, low splat and slosh — noise through a resonance that sweeps downward, a soft
// low-passed front, a few droplets. Nothing bright.
function inksplash(c, rng, out) {
  const w = c.weight ?? 0.6, len = 0.22 + 0.22 * w, n = sec(len + 0.12);
  const slosh = unit(bp(pink(n, rng), (t) => expLerp(850, 170, Math.min(1, t / len) ** 0.6), 3.5));
  const body = unit(lp(pink(n, rng), 420));
  const y = shape(layer(n, [slosh, 1], [body, 0.6]), (t) => Math.min(1, t / 0.003) * Math.exp(-t / (len * 0.45)));
  mixInto(y, shape(unit(lp(white(n, rng), 650)), decay(0.012)), 0, 0.8);
  for (let k = 0, drops = 2 + Math.round(3 * w); k < drops; k++) {
    const m = sec(0.05), f = rexp(rng, 230, 520), rising = rng() < 0.6;
    const bloop = shape(osc(m, (t) => f * (rising ? 1 + 6 * t : 1.3 - 5 * t)), (t, x) => Math.sin(Math.PI * x) ** 1.5);
    mixInto(y, bloop, rr(rng, 0.04, len), rr(rng, 0.25, 0.6));
  }
  out.mono(norm(lp(sat(y, 1.3), 1500)), { gain: 0.45 + 0.55 * w });
}

// Sustained low rumble bed that swells and fades. Stereo noise over a shared (mono) sub.
function rumble(c, rng, out) {
  const dur = c.dur ?? 2, n = sec(dur);
  const subA = osc(n, rr(rng, 34, 40)), subB = osc(n, rr(rng, 44, 52), 'sine', rng()), amA = wander(n, rng, 3), amB = wander(n, rng, 2.2);
  const env = (t, x) => (x < 0.4 ? Math.sin(Math.PI / 2 * x / 0.4) ** 1.5 : Math.cos(Math.PI / 2 * (x - 0.4) / 0.6) ** 1.2);
  const side = () => {
    const low = unit(lp(lp(pink(n, rng), 110), 140)), am = wander(n, rng, 3);
    for (let i = 0; i < n; i++) low[i] = low[i] * (0.55 + 0.9 * am[i]) + 0.8 * subA[i] * (0.3 + 0.7 * amA[i]) + 0.5 * subB[i] * (0.3 + 0.7 * amB[i]);
    return shape(low, env);
  };
  const L = side(), R = side();
  normStereo(L, R);
  out.stereo(L, R);
}

// Storm wind bed: a low band that drifts, a narrow howl that rides the gusts, a little air.
// Both channels share the gusts but have their own noise. Runs under the action.
function wind(c, rng, out) {
  const dur = c.dur ?? 12, n = sec(dur), edge = Math.min(1.5, dur / 4);
  const gust = wander(n, rng, 0.35).map((v) => v ** 1.6), drift = wander(n, rng, 0.2);
  const side = () => {
    const own = wander(n, rng, 0.5);
    const low = unit(bp(pink(n, rng), (t, x, i) => 280 + 500 * drift[i] + 220 * gust[i], 1.6));
    const howl = unit(bp(white(n, rng), (t, x, i) => 900 + 900 * gust[i] + 500 * own[i], 7));
    const air = unit(bp(white(n, rng), 3200, 0.7));
    for (let i = 0; i < n; i++) {
      const g = gust[i], t = i / SR, fadeIO = Math.min(1, t / edge, (dur - t) / edge);
      low[i] = (low[i] * (0.35 + 0.65 * g) + 0.35 * howl[i] * g * g * (0.4 + 0.6 * own[i]) + 0.1 * air[i] * g) * (0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, fadeIO)));
    }
    return low;
  };
  const L = side(), R = side();
  normStereo(L, R);
  out.stereo(L, R);
}

// Thunder: a crackling strike, then a long low roll (≈ 3 s) that darkens as it dies away.
function thunder(c, rng, out) {
  const n = sec(3.0);
  const sub = osc(n, drop(55, 38, 0.8));
  const side = () => {
    const strikes = burstEnv(n, rng, (t) => 70 * Math.exp(-t / 0.13), 0.004, 0.03);
    for (let i = 0; i < n; i++) strikes[i] = Math.max(strikes[i], Math.exp(-i / SR / 0.04));
    const crack = norm(lp(hp(sat(mul(white(n, rng), strikes), 3), 500), 6500));
    const roll = wander(n, rng, 3.5), slow = wander(n, rng, 0.9);
    const dark = (t) => expLerp(700, 90, Math.min(1, t / 2.5));
    const tail = unit(lp(lp(pink(n, rng), dark), (t) => dark(t) * 1.3));
    for (let i = 0; i < n; i++) {
      const t = i / SR, body = Math.min(1, t / 0.06) * Math.exp(-t / 0.95) * (0.35 + 0.9 * roll[i] * (0.5 + slow[i]));
      tail[i] = 0.9 * crack[i] + 0.4 * tail[i] * body + 0.35 * sub[i] * body;
    }
    return fade(tail, 0, 0.4);
  };
  const L = side(), R = side();
  normStereo(L, R);
  out.stereo(L, R, { hall: 0.3 });
}

// A big sheet of paper flipping: fluttering paper noise that rises through `dur`, a low push of
// air, and a soft flap as the page lands at t + dur. Travels right → left like the picture.
function pageturn(c, rng, out) {
  const dur = c.dur ?? 0.5, n = sec(dur + 0.18);
  const paper = unit(bp(white(n, rng), (t) => expLerp(900, 2800, Math.min(1, t / dur)), 0.7));
  const crinkle = mul(unit(hp(white(n, rng), 3000)), burstEnv(n, rng, (t) => 200 + 900 * Math.min(1, t / dur), 0.0005, 0.003));
  const air = unit(lp(pink(n, rng), (t) => 220 + 260 * Math.min(1, t / dur)));
  const y = new Float64Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, x = Math.min(1, t / dur);
    ph += lerp(11, 30, x) / SR;
    const flutter = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(TAU * ph)) ** 2, after = t > dur ? Math.exp(-(t - dur) / 0.03) : 1;
    y[i] = (paper[i] * flutter + 0.3 * crinkle[i]) * (0.08 + 0.92 * x ** 1.4) * after + (t < dur ? 0.5 * air[i] * Math.sin(Math.PI * x) ** 1.5 : 0);
  }
  const k = sec(0.16);
  const flap = norm(layer(k, [shape(unit(lp(white(k, rng), 1200)), decay(0.02)), 0.5], [thump(k, 115, 70, 0.02, 0.03), 1],
    [shape(unit(bp(white(k, rng), 2600, 0.8)), decay(0.008)), 0.2]));
  mixInto(norm(y, 0.75), flap, dur, 0.9);
  out.mono(norm(y), { pan: 0.5, panTo: -0.5 });
}

// Rifle shot (synth fallback for the library sound): a clipped crack, a deep body, and a long
// tail of echoes that darken as they roll away. Stereo, 3 s.
function rifleshot(c, rng, out) {
  const n = sec(3), body = sat(thump(n, 150, 48, 0.02, 0.09), 3);
  const side = () => {
    const crack = lp(hp(sat(shape(white(n, rng), decay(0.012)), 5), 700), 9000);
    const air = unit(lp(pink(n, rng), (t) => expLerp(5000, 250, Math.min(1, t / 1.5))));
    for (let i = 0; i < n; i++) { const t = i / SR; air[i] = crack[i] + 0.22 * air[i] * Math.min(1, t / 0.01) * Math.exp(-t / 0.5); }
    for (const [at, g] of [[0.19, 0.5], [0.43, 0.3], [0.78, 0.18], [1.2, 0.1]]) mixInto(air, lp(crack, 2500 / (1 + 2 * at)), at * rr(rng, 0.95, 1.05), g);
    return air;
  };
  const L = layer(n, [side(), 1], [body, 0.9], [click(n, rng, 2500, 0.001), 0.6]), R = layer(n, [side(), 1], [body, 0.9]);
  normStereo(L, R);
  out.stereo(fade(L, 0, 0.4), fade(R, 0, 0.4));
}
// Rifle bolt (synth fallback): two mechanical clacks — pulled back, then pushed forward and locked.
function riflecock(c, rng, out) {
  const n = sec(0.9), y = new Float64Array(n), k = sec(0.26);
  for (const [at, g, f] of [[0, 0.8, rr(rng, 2300, 2700)], [0.42, 1, rr(rng, 1800, 2200)]]) {
    const m = sec(0.12);
    mixInto(y, norm(layer(m, [modes(m, [[f, 0.012, 1], [f * 1.63, 0.008, 0.6], [f * 2.71, 0.005, 0.4], [330, 0.02, 0.5]]), 1],
      [click(m, rng, 3500, 0.001), 0.8], [shape(unit(bp(white(m, rng), 3000, 0.8)), decay(0.006)), 0.3])), at, g);
  }
  mixInto(y, shape(unit(bp(white(k, rng), 4200, 2)), (t, x) => 0.05 * Math.sin(Math.PI * x)), 0.13);     // the slide between them
  out.mono(norm(y));
}

// ── "The Paper Plane": three friendly extras ─────────────────────────────────
// Paper being folded: a soft crinkle (bright noise in irregular micro-bursts) over a short swish,
// and a little crease tick where the fold is pressed flat.
function rustle(c, rng, out) {
  const dur = c.dur ?? 0.28, n = sec(dur + 0.06);
  const crinkle = mul(unit(hp(white(n, rng), 2600)), burstEnv(n, rng, (t, x) => 40 + 300 * Math.sin(Math.PI * Math.min(1, x)), 0.0006, 0.004));
  const swish = shape(unit(bp(pink(n, rng), (t, x) => expLerp(1200, 2600, x), 0.8)), (t, x) => Math.sin(Math.PI * Math.min(1, x)) ** 1.5);
  const y = norm(layer(n, [crinkle, 1], [swish, 0.3]));
  const k = sec(0.05);
  mixInto(y, norm(shape(unit(bp(white(k, rng), 3200, 1.2)), decay(0.006))), dur * 0.9, 0.8);
  out.mono(norm(fade(y, 0.004, 0.02)));
}
// Slide whistle: a pure, slightly breathy tone gliding up (size 'up': wheee) or down ('down': whoops).
function whistle(c, rng, out) {
  const dur = c.dur ?? 0.45, n = sec(dur + 0.06), up = c.size !== 'down';
  const f0 = up ? 620 : 1500, f1 = up ? 1650 : 520;
  const f = (t, x) => expLerp(f0, f1, Math.min(1, x * 1.08) ** (up ? 1.2 : 0.9)) * (1 + 0.012 * Math.sin(TAU * 6.5 * t));
  const tone = layer(n, [osc(n, f), 1], [osc(n, (t, x) => 2 * f(t, x)), 0.12], [osc(n, (t, x) => 3 * f(t, x)), 0.04]);
  const breath = unit(bp(white(n, rng), f, 6));
  const y = shape(layer(n, [tone, 1], [breath, 0.05]), (t, x) => Math.min(1, t / 0.025) * Math.min(1, (1 - x) / 0.18));
  out.mono(norm(y), { room: 0.08 });
}
// "Got it!": a quick rising run of four glockenspiel notes (D major).
function chime(c, rng, out) {
  const n = sec(1.5), y = new Float64Array(n);
  [1174.66, 1479.98, 1760, 2349.32].forEach((f, k) => {
    const m = sec(1.1), bar = modes(m, [[f, 0.32, 1, 0], [f * 2.76, 0.09, 0.35, 0], [f * 5.4, 0.03, 0.15, 0]]);
    mixInto(y, shape(bar, (t) => Math.min(1, t / 0.002)), k * 0.07, k === 3 ? 1 : 0.75);
  });
  out.mono(norm(fade(y, 0, 0.1)), { hall: 0.2 });
}
// 'mark' cues carry timing for the score (see scorePaperPlane); they make no sound of their own.
const mark = () => {};

const RECIPES = {
  rustle, whistle, chime, mark,
  scribble, whoosh, step, thud, stomp, hit, block, clack, skid, pop, boom, wallbreak,
  crumble, tear, crack, shing, riser, slowdown, heartbeat, megaimpact, cuthit,
  draw, slice, heavyswing, clang, slam, snap, shatter, inksplash, rumble, wind, thunder, pageturn,
  rifleshot, riflecock,
};

// The film's full stop. A cue of one of these types silences everything else — music, every other
// effect, every ringing tail — from its own instant to the end of its scene. Only the cue itself
// (on its own bus, uncompressed, without the scene trim) is heard. Not applied in --audition.
const STOP_TYPES = new Set(['rifleshot']);
function fullStops() {
  if (ARGS.audition) return [];
  return CUES.filter((c) => STOP_TYPES.has(c.type) && (RECIPES[c.type] || SAMPLE[c.type]) && c.t >= 0 && c.t < DURATION)
    .map((c) => ({ t: c.t, until: (SCENES.find((s) => c.t >= s.start && c.t < s.end) ?? { end: DURATION }).end }));
}
// Hard-mute a bus across every full stop: 2 ms down just before the cue, silent to the end of the
// scene, 30 ms back up after it.
function applyStops(bus, stops) {
  for (const s of stops) {
    const i0 = clamp(Math.round(s.t * SR), 0, N), i1 = clamp(Math.round(s.until * SR), i0, N), up = Math.round(0.03 * SR);
    for (let k = 1; k <= DECLICK && i0 - k >= 0; k++) { const g = k / DECLICK; bus.L[i0 - k] *= g; bus.R[i0 - k] *= g; }
    bus.L.fill(0, i0, i1); bus.R.fill(0, i0, i1);
    for (let k = 0; k < up && i1 + k < N; k++) { const g = k / up; bus.L[i1 + k] *= g; bus.R[i1 + k] *= g; }
  }
}

// Per-scene character for the SFX bus (by scene id): a level trim, and extra hall on anything
// that already has a reverb send (i.e. impacts) — the heavy-weapon scene gets more weight and space.
const SFX_SCENE = {
  s2: { db: -1 },
  s4: { db: 0, hall: 0.14 },
  s5: { db: 1.5, hall: 0.05 },
  s6: { db: -2 },                                          // the final exchange is a real fight again (was −7 for the old quiet scene)
};

function renderSfx(library = null) {
  const bus = makeBus(), room = new Float32Array(N), hall = new Float32Array(N);
  const unknown = new Map(), use = { library: 0, synth: 0, fallback: new Map(), silenced: 0 };
  const stops = fullStops(), stopBus = makeBus();
  let outside = 0;
  CUES.forEach((cue, index) => {
    const recipe = RECIPES[cue.type], variants = library?.sfx.get(cue.type), sample = variants && SAMPLE[cue.type];
    if (!recipe && !sample) { unknown.set(cue.type, (unknown.get(cue.type) ?? 0) + 1); return; }
    if (!(cue.t >= 0 && cue.t < DURATION)) { outside++; return; }
    const isStop = stops.length > 0 && STOP_TYPES.has(cue.type);
    if (!isStop && stops.some((s) => cue.t >= s.t && cue.t < s.until)) { use.silenced++; return; }      // inside the silence after a full stop
    // samples a voice starting at time t may play: cut at a later full stop, nothing inside its silence
    const allowed = (t, len) => {
      if (isStop) return len;
      for (const s of stops) {
        if (t >= s.t && t < s.until) return 0;
        if (t < s.t) len = Math.min(len, Math.round(s.t * SR) - Math.round(t * SR));
      }
      return len;
    };
    const scene = isStop ? {} : SFX_SCENE[cue.scene] ?? {};
    const level = dB((LEVEL_DB[cue.type] ?? -6) + (scene.db ?? 0)) * (cue.gain ?? 1), basePan = cue.pan ?? 0;
    const send = (mono, t, g, o) => {
      const wet = o.room || o.hall;
      if (o.room) addMono(room, mono, t, g * o.room);
      if (o.hall || (wet && scene.hall)) addMono(hall, mono, t, g * ((o.hall ?? 0) + (scene.hall ?? 0)));
    };
    const out = {
      mono(buf, o = {}) {
        const t = cue.t + (o.at ?? 0), g = level * (o.gain ?? 1), len = allowed(t, buf.length);
        if (len <= 0) return;
        if (len < buf.length) buf = buf.subarray(0, len);
        place(isStop ? stopBus : bus, buf, t, g, basePan + (o.pan ?? 0), o.panTo == null ? null : basePan + o.panTo);
        if (!isStop) send(buf, t, g, o);
      },
      stereo(L, R, o = {}) {
        const t = cue.t + (o.at ?? 0), g = level * (o.gain ?? 1), len = allowed(t, L.length);
        if (len <= 0) return;
        if (len < L.length) { L = L.subarray(0, len); R = R.subarray(0, len); }
        placeStereo(isStop ? stopBus : bus, L, R, t, g, basePan + (o.pan ?? 0));
        if (!isStop && (o.room || o.hall)) send(L.map((v, i) => 0.5 * (v + R[i])), t, g, o);
      },
    };
    const rng = rngFor('cue', index, cue.type);
    if (sample && playFromLibrary(cue, rng, out, variants, sample)) { use.library++; return; }
    if (!recipe) { unknown.set(cue.type, (unknown.get(cue.type) ?? 0) + 1); return; }
    if (library) use.fallback.set(cue.type, (use.fallback.get(cue.type) ?? 0) + 1);
    use.synth++;
    recipe(cue, rng, out);
  });
  for (const [type, count] of use.fallback) console.warn(`audio: no generated sound for cue type "${type}" (${count} cue${count > 1 ? 's' : ''}) — using the synth`);
  for (const [type, count] of unknown) console.warn(`audio: no ${library ? 'generated sound and no ' : ''}recipe for cue type "${type}" (${count} cue${count > 1 ? 's' : ''}) — skipped`);
  if (outside) console.warn(`audio: ${outside} cue${outside > 1 ? 's' : ''} outside 0…${DURATION} s — skipped`);
  for (const [sendBuf, cfg] of [[room, ROOM], [hall, HALL]]) {
    const wet = reverb(sendBuf, cfg);
    for (let i = 0; i < N; i++) { bus.L[i] += wet.L[i]; bus.R[i] += wet.R[i]; }
  }
  return Object.assign(bus, { use, stops, stop: stopBus });       // stop: the full-stop cues, on their own bus
}

// ═════════════════════════════════════════════════════════════════════════════
// 3b. Sample playback — cues played from the generated library (tools/soundlib.mjs)
//
// SAMPLE says how each cue type is laid on its cue. Types without an entry, or without files
// on disk, fall back to the procedural recipe of section 3.
//   mode 'shot'   one-shot. align 'peak' → the attack of the loudest transient lands on the cue
//                 time (anything before it in the file — a swish, room noise — is cut);
//                 align 'first' → the first sound in the file lands on the cue time.
//   mode 'swing'  pass-by. The loudest moment lands `at`·dur after the cue; the file is cropped
//                 around it to suit the cue's dur.
//   mode 'fit'    sustained sounds and beds, fitted to the cue's dur with fades (loop: repeat
//                 with crossfades when too short; random: start somewhere inside a longer file;
//                 stretch: play faster/slower so one gesture fills dur).
//   mode 'rise'   ends (at its loudest point) exactly at cue time + dur.
//                 (firstAt: the first sound louder than this fraction of the peak; full: play the
//                 whole file, tail included; maxLen: at most this long)
//   pitch         playback speed varies ± this fraction per cue, so repeats never sound identical
//   gain(cue)     level from weight / size, on top of LEVEL_DB;   room / hall   reverb sends
//   level20       set the level by the file's loudest 20 ms instead (so every variant lands equally hard)
//   prefer        always use this variant id when it exists
// ═════════════════════════════════════════════════════════════════════════════

const wOf = (c, fallback = 0.7) => c.weight ?? fallback;
const SAMPLE = {
  step: { mode: 'shot', align: 'peak', pitch: 0.05, weight: 0.5, gain: (c) => 0.35 + 0.65 * wOf(c, 0.5) },
  thud: { mode: 'shot', align: 'peak', pitch: 0.04, weight: 0.6, gain: (c) => 0.4 + 0.6 * wOf(c, 0.6), room: 0.05 },
  stomp: { mode: 'shot', align: 'peak', pitch: 0.03, room: 0.12 },
  hit: { mode: 'shot', align: 'peak', pitch: 0.035, gain: (c) => 0.4 + 0.6 * wOf(c) },
  block: { mode: 'shot', align: 'peak', pitch: 0.04, gain: (c) => 0.45 + 0.55 * wOf(c, 0.6) },
  clack: { mode: 'shot', align: 'peak', pitch: 0.04, gain: (c) => 0.45 + 0.55 * wOf(c) },
  clang: { mode: 'shot', align: 'peak', pitch: 0.04, gain: (c) => 0.4 + 0.6 * wOf(c), hall: 0.06 },
  slam: { mode: 'shot', align: 'peak', pitch: 0.03, weight: 0.8, gain: (c) => 0.45 + 0.55 * wOf(c, 0.8), hall: 0.1 },
  slice: { mode: 'shot', align: 'first', pitch: 0.05, weight: 0.6, gain: (c) => 0.55 + 0.45 * wOf(c, 0.6) },
  snap: { mode: 'shot', align: 'peak', pitch: 0.04 },
  pop: { mode: 'shot', align: 'peak', pitch: 0.04 },
  boom: { mode: 'shot', align: 'peak', pitch: 0.02, hall: 0.1 },
  wallbreak: { mode: 'shot', align: 'peak', pitch: 0.02, gain: (c) => 0.35 + 0.65 * (c.size ?? 1), hall: 0.15 },
  megaimpact: { mode: 'shot', align: 'peak', hall: 0.25 },
  cuthit: { mode: 'shot', align: 'peak', maxLen: 0.24, fadeOut: 0.09 },
  shatter: { mode: 'shot', align: 'peak', pitch: 0.03 },
  inksplash: { mode: 'shot', align: 'peak', pitch: 0.04, weight: 0.6, gain: (c) => 0.45 + 0.55 * wOf(c, 0.6) },
  thunder: { mode: 'shot', align: 'peak', pitch: 0.02, hall: 0.12 },
  heartbeat: { mode: 'shot', align: 'first', pitch: 0.02 },
  pageturn: { mode: 'shot', align: 'first', pitch: 0.03 },
  gunshot: { mode: 'shot', align: 'peak', pitch: 0.025, room: 0.1 },
  ricochet: { mode: 'shot', align: 'first', pitch: 0.05 },
  bulletimpact: { mode: 'shot', align: 'peak', pitch: 0.04 },
  shell: { mode: 'shot', align: 'first', pitch: 0.04 },
  dryfire: { mode: 'shot', align: 'peak', pitch: 0.03 },
  reload: { mode: 'shot', align: 'first' },
  // whole echo tail; loudest 20 ms at −3.5 dBFS pre-master. Variant 2 has the long echo and survives the
  // master clipper best (variant 1 is a very short crack: 2 dB quieter in the finished mix).
  rifleshot: { mode: 'shot', align: 'peak', full: true, fadeOut: 0.3, level20: 0.67, prefer: '2' },
  riflecock: { mode: 'shot', align: 'first', firstAt: 0.2, pitch: 0.02 },   // start at the first real clack, not at handling noise

  whoosh: { mode: 'swing', at: 0.58, dur: 0.18, pre: 0.07, post: 0.14, tail: 0.9, pitch: 0.06, gain: (c) => ({ s: 0.42, m: 0.65, l: 1 }[c.size] ?? 0.65) },
  heavyswing: { mode: 'swing', at: 0.9, dur: 0.3, minDur: 0.22, pre: 0.25, post: 0.35, tail: 0.6, pitch: 0.04, gain: (c) => 0.5 + 0.5 * wOf(c, 0.8) },
  bulletwhiz: { mode: 'swing', at: 0.5, dur: 0.15, minDur: 0.1, pre: 0.08, post: 0.12, tail: 0.5, pitch: 0.06 },

  scribble: { mode: 'fit', dur: 0.5, random: true, pitch: 0.03, fadeIn: 0.004, fadeOut: 0.015 },
  draw: { mode: 'fit', dur: 0.25, stretch: true, fadeOut: 0.01 },
  skid: { mode: 'fit', dur: 0.3, random: true, pitch: 0.05, release: 0.04, fadeIn: 0.006, fadeOut: 0.06 },
  crumble: { mode: 'fit', dur: 0.6, pitch: 0.04, release: 0.25, fadeOut: 0.25 },
  tear: { mode: 'fit', dur: 0.5, pitch: 0.03, release: 0.05, fadeOut: 0.06 },
  crack: { mode: 'fit', dur: 0.5, pitch: 0.04, release: 0.1, fadeOut: 0.1 },
  shing: { mode: 'fit', dur: 0.9, pitch: 0.02, release: 0.4, fadeOut: 0.35, hall: 0.2 },
  slowdown: { mode: 'fit', dur: 1.2, fadeOut: 0.06 },
  rumble: { mode: 'fit', dur: 2, loop: true, fadeIn: (d) => 0.4 * d, fadeOut: (d) => 0.5 * d },
  wind: { mode: 'fit', dur: 12, loop: true, random: true, fadeIn: (d) => Math.min(1.5, d / 4), fadeOut: (d) => Math.min(1.5, d / 4) },
  riser: { mode: 'rise', dur: 0.5 },
};

// One-time analysis of a library file: where its first sound, its main transient, its loudest
// moment and its end are, and the gain that brings it to the same nominal level as a
// peak-normalised synth voice (loud, dense files are held back a little).
const sampleInfo = new WeakMap();
function prepared(variant) {
  if (sampleInfo.has(variant)) return sampleInfo.get(variant);
  let info = null;
  const { L, R } = variant, n = L.length;
  if (variant.sr === SR && n > 64) {
    const env = new Float32Array(n);
    let pk = 0, iMax = 0;
    for (let i = 0; i < n; i++) { const e = Math.max(Math.abs(L[i]), Math.abs(R[i])); env[i] = e; if (e > pk) { pk = e; iMax = i; } }
    if (pk > 1e-4) {
      let first = 0;
      while (first < n && env[first] < 0.06 * pk) first++;
      for (let k = 0; k < 96 && first > 0 && env[first - 1] > 0.01 * pk; k++) first--;
      // attack of the main transient: follow a fast-attack / 5 ms-release envelope back from the peak
      const follow = new Float32Array(n), rel = Math.exp(-1 / (0.005 * SR));
      for (let i = 0, z = 0; i < n; i++) { z = Math.max(env[i], z * rel); follow[i] = z; }
      let attack = iMax;
      const limit = Math.max(first, iMax - Math.round(0.04 * SR));
      while (attack > limit && follow[attack - 1] > 0.25 * pk) attack--;        // the point where the hit really bites
      let end = n;
      while (end > first + 1 && env[end - 1] < 0.003 * pk) end--;
      end = Math.min(n, end + 960);
      // loudest 30 ms (pass-by / riser peak) and loudest 50 ms RMS (level)
      const w30 = Math.round(0.03 * SR), w50 = Math.round(0.05 * SR);
      const w20 = Math.round(0.02 * SR);
      let acc30 = 0, best30 = -1, swing = iMax, acc50 = 0, best50 = 0, acc20 = 0, best20 = 0;
      for (let i = 0; i < n; i++) {
        const e2 = env[i] * env[i];
        acc30 += e2 - (i >= w30 ? env[i - w30] * env[i - w30] : 0);
        acc50 += e2 - (i >= w50 ? env[i - w50] * env[i - w50] : 0);
        acc20 += e2 - (i >= w20 ? env[i - w20] * env[i - w20] : 0);
        if (acc30 > best30) { best30 = acc30; swing = Math.max(0, i - (w30 >> 1)); }
        if (acc50 > best50) best50 = acc50;
        if (acc20 > best20) best20 = acc20;
      }
      info = { L, R, n, pk, first, attack, end, swing, rms20: Math.sqrt(best20 / w20), gain: Math.min(1 / pk, 0.3 / Math.sqrt(best50 / w50)) };
    }
  } else if (n > 64) console.warn(`audio: library file ${variant.id} is ${variant.sr} Hz, expected ${SR} — ignored`);
  sampleInfo.set(variant, info);
  return info;
}

// Source samples [a, b) of a file → stereo pair played at `rate` (4-point Hermite interpolation).
function cutSample(s, a, b, rate = 1) {
  a = clamp(Math.round(a), 0, s.n); b = clamp(Math.round(b), a, s.n);
  const m = Math.max(1, Math.floor((b - a) / rate)), L = new Float64Array(m), R = new Float64Array(m), last = s.n - 1;
  for (const [src, dst] of [[s.L, L], [s.R, R]]) {
    for (let i = 0; i < m; i++) {
      const p = a + i * rate, j = Math.min(last, Math.floor(p)), f = p - j;
      const x0 = src[j > 0 ? j - 1 : 0], x1 = src[j], x2 = src[j < last ? j + 1 : last], x3 = src[j + 2 <= last ? j + 2 : last];
      dst[i] = ((((0.5 * (x3 - x0) + 1.5 * (x1 - x2)) * f + (x0 - 2.5 * x1 + 2 * x2 - 0.5 * x3)) * f + 0.5 * (x2 - x0)) * f) + x1;
    }
  }
  return { L, R, n: m };
}
function fadePair(seg, inSamples, outSamples, curved = false) {
  const a = Math.min(seg.n, Math.max(0, Math.round(inSamples))), b = Math.min(seg.n, Math.max(0, Math.round(outSamples)));
  const g = (x) => (curved ? Math.sin(Math.PI / 2 * x) ** 2 : x);
  for (let i = 0; i < a; i++) { const k = g(i / a); seg.L[i] *= k; seg.R[i] *= k; }
  for (let i = 0; i < b; i++) { const k = g(i / b); seg.L[seg.n - 1 - i] *= k; seg.R[seg.n - 1 - i] *= k; }
  return seg;
}
// A file repeated with equal-power crossfades until it is `need` samples long (beds).
function loopSample(s, need) {
  const len = s.end - s.first, xf = Math.min(Math.round(0.5 * SR), len >> 2), hop = Math.max(1, len - xf), n = Math.ceil(need) + 1;
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let pos = 0, k = 0; pos < n; pos += hop, k++) {
    for (let i = 0; i < len && pos + i < n; i++) {
      const g = (k > 0 && i < xf ? Math.sin(Math.PI / 2 * i / xf) : 1) * (i >= len - xf ? Math.cos(Math.PI / 2 * (i - (len - xf)) / xf) : 1);
      L[pos + i] += s.L[s.first + i] * g; R[pos + i] += s.R[s.first + i] * g;
    }
  }
  return { L, R, n, first: 0, end: n };
}

// Play one cue from the library. Returns false when no usable file exists for it.
const lastPick = new Map();
function playFromLibrary(cue, rng, out, variants, cfg) {
  // variant: match the cue's size / weight, pick with the cue's own PRNG, never the same file twice in a row
  const weight = cue.type === 'wallbreak' ? cue.size ?? 1 : cue.weight ?? cfg.weight ?? 0.7;
  const usable = variants.filter((x) => prepared(x));
  let pool = usable.filter((x) => (x.size ? x.size === (cue.size ?? 'm') : true) && (x.w ? weight >= x.w[0] && weight < x.w[1] : true));
  if (!pool.length) pool = usable;
  if (!pool.length) return false;
  if (cfg.prefer && pool.some((x) => x.id === cfg.prefer)) pool = pool.filter((x) => x.id === cfg.prefer);
  const group = `${cue.type}|${pool[0].id}`;
  let pick = Math.floor(rng() * pool.length);
  if (pool.length > 1 && lastPick.get(group) === pick) pick = (pick + 1) % pool.length;
  lastPick.set(group, pick);
  const s = prepared(pool[pick]);
  const rate = 1 + (cfg.pitch ? (rng() * 2 - 1) * cfg.pitch : 0), val = (x, d) => (typeof x === 'function' ? x(d) : x);
  const opts = { gain: (cfg.level20 ? cfg.level20 / s.rms20 : s.gain) * (cfg.gain?.(cue) ?? 1), room: cfg.room, hall: cfg.hall }, PRE = 48;   // 1 ms lead-in

  if (cfg.mode === 'shot') {
    let anchor = cfg.align === 'first' ? s.first : s.attack;
    if (cfg.firstAt) { anchor = 0; while (anchor < s.n - 1 && Math.max(Math.abs(s.L[anchor]), Math.abs(s.R[anchor])) < cfg.firstAt * s.pk) anchor++; }
    const a = Math.max(0, anchor - PRE * rate);
    const b = cfg.full ? s.n : cfg.maxLen ? Math.min(s.end, a + cfg.maxLen * SR * rate) : s.end;
    const seg = fadePair(cutSample(s, a, b, rate), (anchor - a) / rate, (cfg.fadeOut ?? 0) * SR);
    out.stereo(seg.L, seg.R, { ...opts, at: -((anchor - a) / rate) / SR });
  } else if (cfg.mode === 'swing') {
    const dur = Math.max(cue.dur ?? cfg.dur, cfg.minDur ?? 0.05), pre = Math.max(cfg.pre, cfg.at * dur), post = Math.max(cfg.post, cfg.tail * dur);
    const a = Math.max(0, s.swing - pre * SR * rate), b = Math.min(s.end, s.swing + post * SR * rate);
    const seg = cutSample(s, a, b, rate), peakAt = (s.swing - a) / rate;
    fadePair(seg, peakAt * 0.9, (seg.n - peakAt) * 0.9, true);
    out.stereo(seg.L, seg.R, { ...opts, at: cfg.at * dur - peakAt / SR });
  } else if (cfg.mode === 'fit') {
    const dur = cue.dur ?? cfg.dur, need = dur + (cfg.release ?? 0), have = (s.end - s.first) / SR;
    const speed = cfg.stretch ? clamp(have / need, 0.6, 2.2) : rate, needSrc = need * SR * speed;
    let src = s, a = s.first, lead = PRE;
    if (cfg.loop && have * SR < needSrc) { src = loopSample(s, needSrc); a = 0; lead = 0; }
    else if (cfg.random && have * SR > needSrc * 1.05) { a = s.first + Math.floor(rng() * (have * SR - needSrc)); lead = 0; }
    const seg = cutSample(src, a - lead * speed, Math.min(src.end, a + needSrc), speed);
    fadePair(seg, cfg.fadeIn != null ? val(cfg.fadeIn, dur) * SR : lead || 0.008 * SR, val(cfg.fadeOut ?? 0.03, dur) * SR, true);
    out.stereo(seg.L, seg.R, { ...opts, at: -lead / SR });
  } else if (cfg.mode === 'rise') {
    const dur = cue.dur ?? cfg.dur, stop = Math.min(s.end, s.swing + Math.round(0.03 * SR)), a = Math.max(s.first, stop - dur * SR);
    const seg = fadePair(cutSample(s, a, stop), 0, 0.003 * SR);
    fadePair(seg, 0.35 * seg.n, 0, true);
    out.stereo(seg.L, seg.R, { ...opts, at: dur - seg.n / SR });
  } else return false;
  return true;
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. Music — original, procedural, in D minor. One score function per scene.
//
// The film's recurring figure (MOTIF) is D F G A | F E D C. It is the bass line of scene 1
// (interleaved with a pedal D), the clockwork ostinato of scene 3, the long top line over the
// choir in scene 5, and — slowed to almost nothing — the last three notes (F E D) of scene 6.
//
// Every scene gets its own tempo grid, aligned to the scene start and stretched a few percent so
// that the scene is a whole number of bars: page turns always land on a bar line.
// ═════════════════════════════════════════════════════════════════════════════

const MOTIF = [0, 3, 5, 7, 3, 2, 0, -2];                   // semitones above D
const D2 = 73.42, D3 = D2 * 2;
const hz = (semi, base = D2) => base * 2 ** (semi / 12);

// Levels (dB). Drums are peak-normalised hits; the rest are the level of that voice in the bus.
const KIT_DB = {
  deep: -9, huge: -5, big: -11, mid: -14, hi: -18, tomA: -15, tomB: -16, lowtom: -11, kick: -12, snare: -15,
  rim: -18, stick: -23, woodHi: -17, woodLo: -17, tick: -25, clockHi: -22, clockLo: -22,
};
const MUSIC_DB = {
  bass: -15, pluck: -19, log: -17, growl: -18, braam: -16, tension: -25, choir: -17, lead: -16,
  soft: -24, riser: -19, drone: -18, tone: -22,
};
const KIT_PAN = {
  mid: -0.15, hi: (st) => (st % 2 ? 0.3 : 0.1), tomA: -0.25, tomB: 0.25, lowtom: 0.1, snare: 0.05,
  rim: (st) => (st % 2 ? -0.35 : 0.35), stick: (st) => (st % 2 ? 0.4 : -0.4), woodHi: 0.3, woodLo: -0.3,
  tick: (st) => (st % 2 ? -0.3 : 0.3), clockHi: -0.4, clockLo: 0.4,
};
const KIT_HALL = { huge: 0.35, deep: 0.15, lowtom: 0.12 };   // hall send per drum

// What each scene sounds like. Looked up by scene id, else by position in SCENES.
//   bpm     nominal tempo (stretched slightly to fit whole bars)      gainDb  scene trim for the groove
//   score   the function that writes the scene                       drone   (t, dur) → [level, low-pass Hz]
//   sub     share of pure sub (D1 sine) in the drone                 accent  drums hit on every ACCENT
//   fill    the two drums used for rolls into accents and into the next scene
const STYLE = {
  s1: { bpm: 150, gainDb: -1.5, score: scoreFirstClash, sub: 0.25, accent: [['deep', 1.1], ['big', 1]], fill: ['mid', 'big'],
    drone: (t, d) => (t < 3 ? [0.85 * t / 3, 60 + 170 * t / 3] : [0.75, 250 + 50 * (t - 3) / Math.max(1, d - 3)]) },
  s2: { bpm: 164, gainDb: 1, score: scorePencilCity, sub: 0.1, accent: [['mid', 1.1], ['tomA', 1]], fill: ['tomA', 'tomB'],
    drone: () => [0.45, 320] },
  s3: { bpm: 156, gainDb: 1, score: scoreGeometry, sub: 0.2, accent: [['big', 1.1], ['kick', 1.1]], fill: ['snare', 'hi'],
    drone: () => [0.6, 280] },
  s4: { bpm: 88, gainDb: -3.5, score: scoreTornPaper, sub: 0.5, accent: [['huge', 1.15], ['deep', 1]], fill: ['lowtom', 'big'],
    drone: () => [1.0, 170] },
  s5: { bpm: 176, gainDb: -1, score: scoreInkArena, sub: 0.3, accent: [['deep', 1.2], ['big', 1.1], ['kick', 1]], fill: ['mid', 'big'],
    drone: (t, d) => [0.9, 300 + 80 * t / d] },
  s6: { bpm: 60, gainDb: -3, score: scoreLastLine, sub: 0.3, accent: [['deep', 0.5]], fill: null,
    drone: (t, d) => [0.45 * clamp((d - 0.8 - t) / (d * 0.7), 0, 1), 110] },
};
STYLE.plane = { bpm: 94, gainDb: 0, score: (ctx) => scorePaperPlane(ctx), sub: 0, accent: [], fill: null, drone: () => [0, 200] };
STYLE.playful = { bpm: 104, gainDb: 0, score: (ctx) => scorePlayful(ctx), sub: 0, accent: [], fill: null, drone: () => [0, 200] };
STYLE.none = { bpm: 100, gainDb: 0, score: () => {}, sub: 0, accent: [], fill: null, drone: () => [0, 200] };
// Score styles by NAME. A scene picks one with createScene({ score: '<name>' }); see references/sound.md.
//   duel       tense martial-arts taiko groove (sparse first 3 s)      chase      fast, light, syncopated wood/toms
//   clockwork  precise driving 16ths, metallic ticks                   heavy      half-time, huge low drums
//   climax     fastest and densest, dark pad                           aftermath  sparse low hits, a resolving tone
//   playful    friendly D-major marimba / pizzicato / woodblock loop   plane      a playful score fitted to 'mark' cues (example)
//   none       effects only — no music
const STYLE_NAMES = { duel: 's1', chase: 's2', clockwork: 's3', heavy: 's4', climax: 's5', aftermath: 's6' };
const warnedStyle = new Set();
const styleOf = (scene) => {
  const name = scene.score ?? null;
  const st = name ? STYLE[STYLE_NAMES[name] ?? name] : null;
  if (st) return st;
  if (!warnedStyle.has(scene.id)) {
    warnedStyle.add(scene.id);
    console.warn(`audio: scene "${scene.id}" ${name ? `asks for unknown score "${name}"` : 'has no score set'} — using "duel" (a fight score). Set createScene({ score: … }); see references/sound.md`);
  }
  return STYLE.s1;
};

// ── instruments ──────────────────────────────────────────────────────────────
// Taiko: pitched sine + triangle overtone with a pitch drop, noise "skin" and a stick click.
function taiko(rng, f, tau, vel = 1) {
  const n = sec(tau * 5 + 0.05);
  const body = shape(osc(n, drop(f * (1.5 + 0.5 * vel), f, 0.028)), decay(tau));
  const over = shape(osc(n, drop(f * 2.9, f * 1.6, 0.02), 'tri'), decay(tau * 0.45));
  const skin = shape(unit(bp(white(n, rng), f * 7, 0.8)), decay(0.03));
  const stick = shape(unit(lp(white(n, rng), 3500)), decay(0.003));
  return norm(sat(layer(n, [body, 1], [over, 0.3], [skin, 0.2 * vel], [stick, 0.25 * vel]), 1 + vel));
}
const DRUMS = {
  deep: (rng, v) => taiko(rng, 55, 0.3, v),
  big: (rng, v) => taiko(rng, 73.42, 0.15, v),
  mid: (rng, v) => taiko(rng, 110, 0.1, v),
  hi: (rng, v) => taiko(rng, 146.83, 0.055, v),
  tomA: (rng, v) => taiko(rng, 196, 0.05, v),
  tomB: (rng, v) => taiko(rng, 261.63, 0.04, v),
  lowtom: (rng, v) => taiko(rng, 82.41, 0.2, v),
  // enormous low drum for the heavy-weapon scene: long, saturated, with a dull skin slap
  huge(rng, v) {
    const n = sec(2.2);
    const body = sat(shape(osc(n, drop(46 * (1.6 + 0.5 * v), 46, 0.045)), decay(0.5)), 2.5);
    const skin = shape(unit(lp(white(n, rng), 420)), decay(0.06));
    const stick = shape(unit(lp(white(n, rng), 2200)), decay(0.004));
    return norm(sat(layer(n, [body, 1], [thump(n, 120, 60, 0.03, 0.12), 0.5], [skin, 0.25], [stick, 0.2 * v]), 1.5));
  },
  kick(rng, v) {
    const n = sec(0.4);
    return norm(layer(n, [sat(thump(n, 150 + 30 * v, 52, 0.02, 0.085), 2), 1], [shape(unit(lp(white(n, rng), 2500)), decay(0.002)), 0.2]));
  },
  snare(rng, v) {
    const n = sec(0.25);
    return norm(layer(n, [modes(n, [[190, 0.04, 1], [330, 0.03, 0.6]]), 0.7], [shape(unit(bp(white(n, rng), 2200, 0.7)), decay(0.04)), 0.4 + 0.2 * v],
      [shape(unit(hp(white(n, rng), 5000)), decay(0.018)), 0.2], [click(n, rng, 3000, 0.001), 0.4]));
  },
  rim(rng) {
    const n = sec(0.06), f = rr(rng, 1700, 1800);
    return norm(layer(n, [modes(n, [[f, 0.012, 1], [f * 1.51, 0.008, 0.6], [f * 2.37, 0.005, 0.4]]), 1], [click(n, rng, 5000, 0.004), 0.5]));
  },
  stick(rng) {
    const n = sec(0.03);
    return norm(layer(n, [click(n, rng, 2500, 0.002), 1], [modes(n, [[rr(rng, 2300, 2500), 0.004, 0.7]]), 1]));
  },
  woodHi: (rng) => woodblock(rng, 1050),
  woodLo: (rng) => woodblock(rng, 760),
  // metallic tick (hat-like): a few inharmonic high partials and a breath of noise
  tick(rng) {
    const n = sec(0.06);
    return norm(layer(n, [modes(n, [[5200, 0.012, 1], [7300, 0.01, 0.8], [9100, 0.008, 0.6], [10800, 0.006, 0.4]].map(([f, tau, a]) => [f * rr(rng, 0.97, 1.03), tau, a])), 1],
      [shape(unit(hp(white(n, rng), 7000)), decay(0.006)), 0.35]));
  },
  clockHi: (rng) => clockTick(rng, 2100),
  clockLo: (rng) => clockTick(rng, 1500),
};
function woodblock(rng, f) {
  const n = sec(0.12);
  return norm(layer(n, [modes(n, [[f, 0.03, 1], [f * 2.7, 0.012, 0.5], [f * 5.2, 0.006, 0.25]]), 1], [click(n, rng, 3000, 0.0012), 0.5]));
}
function clockTick(rng, f) {
  const n = sec(0.05);
  return norm(layer(n, [modes(n, [[f, 0.009, 1], [f * 1.57, 0.005, 0.6]]), 1], [click(n, rng, 4000, 0.0006), 0.6]));
}

// Rendered voices are cached: a drum is rendered once per velocity bucket and round-robin variant,
// a pitched note once per (pitch, length, …). The cache is what keeps a two-minute score fast.
const voiceCache = new Map(), drumTurn = new Map();
function cached(key, make) {
  let v = voiceCache.get(key);
  if (!v) voiceCache.set(key, v = make());
  return v;
}
function drumHit(name, vel) {
  const bucket = clamp(Math.round(vel * 5), 1, 7), turn = drumTurn.get(name) ?? 0;
  drumTurn.set(name, turn + 1);
  const key = `drum|${name}|${bucket}|${turn % 3}`;
  return cached(key, () => DRUMS[name](rngFor(key), bucket / 5));
}

// Bass note: two detuned saws + square through a resonant low-pass with a plucked cutoff envelope.
function bassNote(f, dur, vel, bright) {
  return cached(`bass|${f.toFixed(2)}|${dur.toFixed(4)}|${vel}|${bright}`, () => {
    const n = sec(dur + 0.02);
    const raw = layer(n, [osc(n, f, 'saw'), 0.6], [osc(n, f * 1.007, 'saw', 0.37), 0.45], [osc(n, f, 'square', 0.25), 0.35]);
    const y = lp(raw, (t) => bright * (150 + 560 * vel * Math.exp(-t / 0.05)), 1.8);
    return sat(shape(y, adsr(0.002, 0.07, 0.6, 0.015, dur - 0.015)), 1.4);
  });
}
// Clean sequencer pluck (scene 3's clockwork ostinato).
function pluck(f, dur) {
  return cached(`pluck|${f.toFixed(2)}|${dur.toFixed(4)}`, () => {
    const n = sec(dur + 0.03);
    const raw = layer(n, [osc(n, f, 'square'), 0.5], [osc(n, f * 1.003, 'saw', 0.4), 0.5]);
    const y = lp(raw, (t) => 600 + 3200 * Math.exp(-t / 0.03), 1.5);
    return shape(y, (t) => Math.min(1, t / 0.001) * Math.exp(-t / 0.07) * clamp((dur - t) / 0.008, 0, 1));
  });
}
// Log drum / marimba bar (scene 2's wooden melody): tuned-bar partials 1 : 3.93 : 9.2.
function logdrum(f) {
  return cached(`log|${f.toFixed(2)}`, () => {
    const n = sec(0.45);
    return norm(layer(n, [modes(n, [[f, 0.11, 1, 0], [f * 3.93, 0.025, 0.35, 0], [f * 9.2, 0.008, 0.15, 0]]), 1],
      [shape(unit(lp(white(n, rngFor('log', f)), 1800)), decay(0.003)), 0.12]));
  });
}
// Growling bass (scene 4): detuned saws + sub octave, a low-pass that wobbles at ~7 Hz, heavy saturation.
function growl(f, dur) {
  return cached(`growl|${f.toFixed(2)}|${dur.toFixed(3)}`, () => {
    const n = sec(dur);
    const raw = layer(n, [osc(n, f, 'saw'), 0.5], [osc(n, f * 1.006, 'saw', 0.3), 0.45], [osc(n, f / 2, 'saw', 0.6), 0.5], [osc(n, f / 2, 'square', 0.2), 0.25]);
    const y = lp(raw, (t) => 150 + 330 * (0.5 + 0.5 * Math.sin(TAU * 7.3 * t)) * Math.min(1, t / 0.15) + 250 * Math.exp(-t / 0.1), 2.2);
    return scale(sat(shape(y, adsr(0.02, 0.3, 0.75, 0.12, dur - 0.12)), 3), 0.7);
  });
}
// "Braam": a stack of low saws whose filter opens and closes — the big brass-like swell of scene 4.
function braam(dur) {
  return cached(`braam|${dur.toFixed(3)}`, () => {
    const n = sec(dur), env = (t) => Math.min(1, t / 0.12) * Math.exp(-Math.max(0, t - 0.12) / (dur * 0.33));
    const raw = layer(n, [osc(n, D2 / 2, 'saw'), 0.6], [osc(n, D2 * 0.997, 'saw', 0.2), 0.5], [osc(n, D2 * 1.004, 'saw', 0.7), 0.5],
      [osc(n, 110, 'saw', 0.4), 0.35], [osc(n, D3 * 1.003, 'saw', 0.1), 0.3], [osc(n, D3 * 0.996, 'saw', 0.55), 0.3]);
    const y = lp(raw, (t) => 120 + 900 * env(t), 1.3);
    return scale(fade(sat(shape(y, (t) => env(t) ** 0.6), 2.5), 0, dur * 0.2), 0.7);
  });
}
// Long tension note (scene 4): a high minor second (A + B♭) that swells with a quickening tremolo.
// Returns the two pitches separately so they can sit left and right.
function tension(dur) {
  return cached(`tension|${dur.toFixed(3)}`, () => [440, 466.16].map((f, k) => {
    const n = sec(dur);
    const raw = layer(n, [osc(n, f * 0.997, 'saw', 0.1 + 0.3 * k), 0.5], [osc(n, f * 1.004, 'saw', 0.6), 0.5]);
    let ph = 0;
    return fade(shape(lp(raw, 1800), (t, x) => {
      ph += lerp(4, 9, x) / SR;
      return x ** 2 * (1 - 0.4 * x * (0.5 + 0.5 * Math.sin(TAU * ph)));
    }), 0, 0.03);
  }));
}
// Dark choir-like chord (scene 5): detuned saws through "ah" formants, slow attack. Stereo.
function choir(root, quality, dur) {
  return cached(`choir|${root}|${quality}|${dur.toFixed(4)}`, () => {
    const rng = rngFor('choir', root, quality), n = sec(dur + 0.5), third = quality === 'm' ? 3 : 4;
    const fold = (s) => ((s % 12) + 12) % 12;
    const semis = [root > 3 ? root - 24 : root - 12, fold(root), fold(root + third), fold(root + 7), fold(root) + 12];
    const L = new Float64Array(n), R = new Float64Array(n);
    semis.forEach((s, k) => {
      for (const [det, right] of [[-0.0045, 0], [0.004, 1], [0.0006, k % 2]]) {
        const o = osc(n, hz(s, D3) * (1 + det), 'saw', rng());
        mixInto(right ? R : L, o, 0, 1); mixInto(right ? L : R, o, 0, 0.35);
      }
    });
    const vowel = (x) => {
      const a = bp(x, 640, 3.5), b = bp(x, 1090, 4.5), c = bp(x, 2650, 6), d = lp(x, 500);
      for (let i = 0; i < n; i++) a[i] += 0.55 * b[i] + 0.22 * c[i] + 0.5 * d[i];
      return shape(a, (t) => Math.sin(Math.PI / 2 * Math.min(1, t / 0.3)) ** 2 * (t > dur ? Math.max(0, 1 - (t - dur) / 0.5) : 1) * (1 - 0.08 * Math.sin(TAU * 4.7 * t)));
    };
    const out = { L: vowel(L), R: vowel(R) };
    normStereo(out.L, out.R);
    return out;
  });
}
// Lead voice for the motif over the choir (scene 5): saws with delayed vibrato, vocal band-pass.
function lead(f, dur) {
  return cached(`lead|${f.toFixed(2)}|${dur.toFixed(4)}`, () => {
    const n = sec(dur + 0.25), vib = (t) => f * (1 + 0.004 * Math.min(1, t / 0.4) * Math.sin(TAU * 5.6 * t));
    const raw = layer(n, [osc(n, vib, 'saw'), 0.6], [osc(n, (t) => vib(t) * 1.006, 'saw', 0.3), 0.5], [osc(n, (t) => vib(t) * 2, 'square', 0.1), 0.15]);
    const y = layer(n, [bp(raw, 1250, 1.2), 1], [lp(raw, 800), 0.6]);
    return norm(shape(y, adsr(0.05, 0.3, 0.8, 0.2, dur)));
  });
}
// Soft, pure tone (scene 6): two sines a hair apart (left / right) with a little octave.
function softTone(f, dur) {
  const side = (det) => {
    const n = sec(dur), y = layer(n, [osc(n, f * det), 1], [osc(n, f * det * 2), 0.18], [osc(n, f * det * 3), 0.05]);
    return shape(y, (t, x) => Math.sin(Math.PI / 2 * Math.min(1, t / 0.4)) ** 2 * Math.exp(-t / (dur * 0.55)) * Math.min(1, (1 - x) / 0.3));
  };
  return { L: side(0.9992), R: side(1.0008) };
}
// Noise riser used by the music itself for fills into a scene boundary.
function musicRiser(dur) {
  return cached(`mriser|${dur.toFixed(3)}`, () => {
    const n = sec(dur), y = bp(white(n, rngFor('mriser', dur.toFixed(3))), (t, x) => expLerp(500, 6500, x ** 1.3), 2);
    return norm(fade(shape(y, (t, x) => x ** 2.2), 0, 0.002));
  });
}

// ── hints, control curves ────────────────────────────────────────────────────
const gated = (t) => MUSIC_HINTS.some((h) => (h.mode === 'suspend' || h.mode === 'aftermath') && t >= h.from - 1e-6 && t < h.to - 1e-6);
const CTRL = 64;                                             // control rate: one value per 64 samples
const ctrlAt = (arr, i) => { const p = i / CTRL, k = p | 0; return arr[k] + (arr[k + 1] - arr[k]) * (p - k); };

// Control-rate curves for the whole film: hint amounts (smoothed 0..1) and the drone's level,
// cutoff and sub share (scene styles bent by the hints).
function musicControls() {
  const M = Math.ceil(N / CTRL) + 2, mk = () => new Float32Array(M);
  const sus = mk(), aft = mk(), surge = mk(), lvl = mk(), cut = mk(), sub = mk();
  const byMode = { suspend: sus, aftermath: aft, surge };
  for (const h of MUSIC_HINTS) {
    const arr = byMode[h.mode];
    if (!arr) { console.warn(`audio: unknown music hint mode "${h.mode}" at ${h.from}s — ignored`); continue; }
    arr.fill(1, clamp(Math.round(h.from * SR / CTRL), 0, M), clamp(Math.round(h.to * SR / CTRL), 0, M));
  }
  const smooth = (arr, tau) => {
    const k = 1 - Math.exp(-CTRL / (tau * SR));
    let z = arr[0];
    for (let i = 0; i < M; i++) { z += (arr[i] - z) * k; arr[i] = z; }
  };
  smooth(sus, 0.06); smooth(aft, 0.08); smooth(surge, 0.2);
  let si = 0;
  for (let i = 0; i < M; i++) {
    const t = i * CTRL / SR;
    while (si < SCENES.length - 1 && t >= SCENES[si].end) si++;
    const sc = SCENES[si], st = styleOf(sc);
    let [l, c] = st.drone(clamp(t - sc.start, 0, sc.end - sc.start), sc.end - sc.start);
    l *= (1 - 0.6 * sus[i]) * (1 - 0.15 * aft[i]) * (1 + 0.2 * surge[i]) * clamp((DURATION - 0.3 - t) / 0.5, 0, 1);
    c = lerp(lerp(c, 105, sus[i]), 135, aft[i]);
    lvl[i] = l; cut[i] = c; sub[i] = st.sub ?? 0.25;
  }
  smooth(lvl, 0.05); smooth(cut, 0.05); smooth(sub, 0.3);
  return { sus, aft, surge, lvl, cut, sub };
}
// Groove gate at sample rate: shut during 'suspend' (closes in 35 ms) and 'aftermath' (15 ms — "stops dead").
function grooveGate() {
  const g = new Float32Array(N).fill(1);
  for (const h of MUSIC_HINTS) {
    if (h.mode !== 'suspend' && h.mode !== 'aftermath') continue;
    const a = clamp(Math.round(h.from * SR), 0, N), b = clamp(Math.round(h.to * SR), 0, N), xf = Math.round((h.mode === 'suspend' ? 0.035 : 0.015) * SR);
    for (let i = a; i < b; i++) g[i] = Math.min(g[i], Math.max(0, 1 - (i - a) / xf));
  }
  return g;
}

// Drone (D1 + D2 + a faint fifth, saws through the controlled low-pass, plus pure sub) and the
// ominous tone of 'aftermath' passages (D + tritone, beating slowly between the ears).
function renderPad(ctl) {
  const L = new Float32Array(N), R = new Float32Array(N), D1 = D2 / 2;
  const inc = [D1, D2 - 0.17, D2 + 0.19, 110.12, 109.87].map((f) => f / SR), ph = [0, 0.3, 0.7, 0.6, 0.1];
  for (let i = 0; i < N; i++) {
    const s = 0.6 * (2 * ph[0] - 1);
    L[i] = s + 0.8 * (2 * ph[1] - 1) + 0.22 * (2 * ph[3] - 1);
    R[i] = s + 0.8 * (2 * ph[2] - 1) + 0.22 * (2 * ph[4] - 1);
    for (let k = 0; k < 5; k++) { ph[k] += inc[k]; if (ph[k] >= 1) ph[k] -= 1; }
  }
  const fc = (t, x, i) => ctl.cut[(i / CTRL) | 0];
  const fL = lp(L, fc, 0.9), fR = lp(R, fc, 0.9), gDrone = dB(MUSIC_DB.drone), gTone = dB(MUSIC_DB.tone), w = TAU / SR;
  for (let i = 0; i < N; i++) {
    const a = ctrlAt(ctl.lvl, i) * gDrone * (1 + 0.1 * Math.sin(w * 0.31 * i)), sub = ctrlAt(ctl.sub, i) * Math.sin(w * D1 * i);
    let l = a * (fL[i] + sub), r = a * (fR[i] + sub);
    const b = ctrlAt(ctl.aft, i);
    if (b > 0.0005) {
      const g = b * gTone * (1 - 0.12 * (0.5 + 0.5 * Math.sin(w * 5.3 * i)));
      l += g * (Math.sin(w * 146.62 * i) + 0.55 * Math.sin(w * 207.86 * i + 1.2) + 0.2 * Math.sin(w * 293.18 * i + 3) + 0.12 * Math.sin(w * 311.34 * i + 4.4));
      r += g * (Math.sin(w * 147.06 * i) + 0.55 * Math.sin(w * 207.42 * i + 1.2) + 0.2 * Math.sin(w * 294.19 * i + 3) + 0.12 * Math.sin(w * 310.9 * i + 4.4));
    }
    L[i] = l; R[i] = r;
  }
  return { L, R };
}

// ── the score ────────────────────────────────────────────────────────────────
const steps = (fn) => { const o = {}; for (let i = 0; i < 16; i++) { const v = fn(i); if (v) o[i] = v; } return o; };

// Everything a score function needs for one scene: drums, voices, the tempo grid and a step sequencer.
function sceneContext(scene, index, bus, hallSend, ctl) {
  const style = styleOf(scene), gain = dB(style.gainDb ?? 0), last = index === SCENES.length - 1;
  const ctx = {
    start: scene.start, end: scene.end, style, last,
    surgeAt: (t) => ctl.surge[clamp(Math.round(t * SR / CTRL), 0, ctl.surge.length - 1)],
    // a drum hit (velocity scales level and brightness); silent inside suspend / aftermath hints
    drum(name, t, vel, pan, hall) {
      if (!(t >= 0 && t < DURATION) || gated(t)) return;
      const p = pan ?? KIT_PAN[name] ?? 0, g = dB(KIT_DB[name]) * vel * gain, buf = drumHit(name, vel), h = hall ?? KIT_HALL[name];
      place(bus, buf, t, g, typeof p === 'function' ? p(0) : p);
      if (h) addMono(hallSend, buf, t, g * h);
    },
    // all drums of a pattern table ({ name: { step: velocity } }) that fall on this step
    table(tbl, e) {
      for (const name in tbl) {
        const v = tbl[name][e.st];
        if (!v) continue;
        const p = KIT_PAN[name];
        ctx.drum(name, e.t, v * e.energy, typeof p === 'function' ? p(e.st) : p);
      }
    },
    voice(buf, t, db, pan = 0, hall = 0) {
      if (!(t >= 0 && t < DURATION) || gated(t)) return;
      place(bus, buf, t, dB(db) * gain, pan);
      if (hall) addMono(hallSend, buf, t, dB(db) * gain * hall);
    },
    stereo(pair, t, db) { if (t >= 0 && t < DURATION && !gated(t)) placeStereo(bus, pair.L, pair.R, t, dB(db) * gain); },
    bass(t, semi, len, vel, bright, base = D2) { ctx.voice(bassNote(hz(semi, base), len, vel, bright), t, MUSIC_DB.bass + (vel >= 1 ? 0 : -2.5)); },
    // tempo grid between two times, stretched to a whole number of bars
    grid(from, to, nominal) {
      const bars = Math.max(1, Math.round((to - from) / (240 / nominal))), barLen = (to - from) / bars;
      return { from, to, bars, barLen, step: barLen / 16, bpm: 240 / barLen };
    },
    // Step sequencer: calls fn for every sixteenth with { bar, st, t, x (0..1 through the grid),
    // energy (velocity push from 'surge'), surge (bool), fill (inside the roll into the next scene) }.
    // Then plays that roll: accelerating strokes and a noise riser that end on the page turn.
    seq(grid, fn) {
      const total = grid.bars * 16;
      const fillSteps = last || !style.fill || gated(grid.to - 0.05) ? 0 : Math.round(clamp(grid.barLen / 2, 0.6, 1.2) / grid.step);
      for (let k = 0; k < total; k++) {
        const t = grid.from + k * grid.step;
        if (gated(t)) continue;
        const s = ctx.surgeAt(t);
        fn({ bar: (k / 16) | 0, st: k % 16, t, x: k / total, energy: 1 + 0.26 * s, surge: s > 0.5, fill: total - k <= fillSteps });
      }
      if (!fillSteps) return;
      const from = grid.to - fillSteps * grid.step;
      for (let t = from, gap = (grid.to - from) / 6.5, k = 0; t < grid.to - 0.02; t += gap, gap = Math.max(0.03, gap * 0.86), k++) {
        ctx.drum(style.fill[k % 2], t, 0.45 + 0.75 * ((t - from) / (grid.to - from)) ** 1.3, k % 2 ? -0.2 : 0.2);
      }
      ctx.voice(musicRiser(grid.to - from), from, MUSIC_DB.riser);
    },
  };
  return ctx;
}

// Scene 1 — "The First Clash": tension drone and a few lonely hits for the first seconds, then
// the 3-3-2 taiko groove. The motif is the bass line: D d F d G d A d | F d E d D d C d
// (lower-case = pedal D), in eighths at first, then in sixteenths with octave jumps.
function scoreFirstClash(ctx) {
  const span = ctx.end - ctx.start, intro = span > 8 ? 3 : 0, from = ctx.start + intro;
  for (const [off, v] of [[-2, 0.5], [-1, 0.65], [-0.5, 0.8], [-0.25, 0.95]]) if (from + off >= ctx.start + 0.2) ctx.drum('deep', from + off, v);
  const g = ctx.grid(from, ctx.end, ctx.style.bpm);
  const A = {
    big: { 0: 1, 3: 0.7, 6: 0.8, 8: 0.95, 11: 0.7, 14: 0.8 }, mid: { 4: 0.75, 10: 0.45, 12: 0.8 },
    rim: steps((i) => (i % 2 ? 0 : i % 4 ? 0.7 : 0.45)),
  };
  const B = {
    big: { 0: 1, 3: 0.75, 6: 0.85, 8: 1, 10: 0.6, 11: 0.75, 14: 0.9 }, mid: { 4: 0.85, 7: 0.5, 12: 0.9, 15: 0.6 },
    hi: steps((i) => ([2, 5, 9, 13].includes(i) ? 0.75 : 0.4)), rim: steps((i) => ([0, 3, 6, 8, 11, 14].includes(i) ? 0.8 : 0.45)),
  };
  ctx.seq(g, (e) => {
    const hard = e.x >= 0.42 || e.surge, note = MOTIF[(e.bar * 4 + (e.st >> 2)) % 8];
    if (!e.fill) ctx.table(hard ? B : A, e);
    if (!hard) { if (e.st % 2 === 0) ctx.bass(e.t, e.st % 4 ? 0 : note, g.step * 1.7, e.st % 4 ? 0.7 : 1, 1.3); }
    else ctx.bass(e.t, e.st % 4 === 0 ? note : e.st % 4 === 2 ? 12 : 0, g.step * 0.85, e.st % 4 === 0 ? 1 : 0.7, 2);
  });
}

// Scene 2 — "Pencil City": faster and lighter. High toms, woodblocks and sticks in a syncopated
// pattern, a plucky bass an octave up, and a log-drum line that walks through the motif.
function scorePencilCity(ctx) {
  const g = ctx.grid(ctx.start, ctx.end, ctx.style.bpm);
  const wood = { woodLo: { 2: 0.6, 8: 0.7 }, woodHi: { 5: 0.5, 11: 0.6, 13: 0.45 }, stick: steps((i) => (i % 4 === 2 ? 0.7 : 0.35)) };
  const drums = { mid: { 0: 0.9, 7: 0.55, 10: 0.75 }, tomA: { 3: 0.7, 6: 0.55, 12: 0.8, 15: 0.5 }, tomB: { 5: 0.5, 13: 0.6, 14: 0.5 }, rim: { 4: 0.6, 12: 0.7 } };
  const bassA = { 0: 0, 3: 0, 6: 3, 8: 5, 11: 3, 13: 0, 14: -2 }, bassB = { 0: 0, 3: 0, 6: 7, 8: 5, 11: 3, 13: 2, 14: 0 };
  let turn = 0;
  ctx.seq(g, (e) => {
    const full = e.bar >= 1 || e.surge;
    if (!e.fill) { ctx.table(wood, e); if (full) ctx.table(drums, e); }
    const semi = (e.bar % 2 ? bassB : bassA)[e.st];
    if (semi != null && full) {
      if (e.st === 0) ctx.bass(e.t, semi, g.step * 2, 1, 1.4);                 // downbeats keep some floor
      else ctx.bass(e.t, semi, g.step * 1.3, 0.7, 2.2, D3);
    }
    if (e.x > 0.3 && [0, 3, 6, 9, 12, 14].includes(e.st)) {
      ctx.voice(logdrum(hz(MOTIF[turn % 8] + 12, D3)), e.t, MUSIC_DB.log + (e.st ? 0 : 2), turn % 2 ? 0.3 : -0.2);
      turn++;
    }
  });
}

// Scene 3 — "Geometry Zone": clockwork. Four-on-the-floor, tight backbeat, metallic sixteenths,
// tick-tock, a ratchet every fourth bar. The ostinato is the motif in eighths against a high
// pedal D; a second voice joins in canon (two beats later, an octave up, on the other side).
function scoreGeometry(ctx) {
  const g = ctx.grid(ctx.start, ctx.end, ctx.style.bpm), roots = [0, 0, -4, -2];
  const clock = { clockHi: steps((i) => (i % 4 === 0 ? 0.7 : 0)), clockLo: steps((i) => (i % 4 === 2 ? 0.6 : 0)), tick: steps((i) => (i % 4 === 2 ? 0.75 : 0.4)) };
  const drums = { kick: { 0: 0.9, 4: 0.8, 8: 0.9, 12: 0.8 }, snare: { 4: 0.8, 12: 0.85 } };
  ctx.seq(g, (e) => {
    const full = e.bar >= 2 || e.surge, root = roots[e.bar % 4];
    if (!e.fill) {
      ctx.table(clock, e);
      if (full) ctx.table(drums, e);
      if (full && e.st === 0 && e.bar % 4 === 0) ctx.drum('big', e.t, 0.85 * e.energy);
      if (e.bar % 4 === 3 && e.st >= 14) for (let k = 0; k < 2; k++) ctx.drum('clockHi', e.t + k * g.step / 2, 0.5 + 0.15 * ((e.st - 14) * 2 + k), 0);
      if (e.surge && e.st % 2) ctx.drum('hi', e.t, 0.5);
    }
    const semi = e.st % 2 === 0 ? MOTIF[(e.st >> 1) % 8] : 12;
    ctx.voice(pluck(hz(semi, D3), g.step * 0.9), e.t, MUSIC_DB.pluck + (e.st % 2 ? -5 : e.st % 4 ? 0 : 1.5), -0.3);
    if (e.x > 0.35 && e.st % 2 === 0) ctx.voice(pluck(hz(MOTIF[((e.st >> 1) + 6) % 8] + 12, D3), g.step * 0.9), e.t, MUSIC_DB.pluck - 4, 0.35);
    if (full) { if (e.st === 0) ctx.bass(e.t, root, g.step * 1.6, 1, 1.5); else if (e.st % 4 === 2) ctx.bass(e.t, root, g.step * 0.85, 0.7, 1.5); }
  });
}

// Scene 4 — "Torn Paper Battlefield": half-time and enormous. One huge drum per bar with space
// around it, low toms answering, a growling bass holding one long note per bar, a braam every
// other bar and a high minor-second tension note swelling into every fourth bar.
function scoreTornPaper(ctx) {
  const g = ctx.grid(ctx.start, ctx.end, ctx.style.bpm), roots = [0, 0, -4, -2, 0, 3, -2, -5];
  ctx.seq(g, (e) => {
    const odd = e.bar % 2 === 1, v = e.energy;
    if (!e.fill) {
      if (e.st === 0) ctx.drum('huge', e.t, 1.05 * v);
      if (!odd && e.st === 8) ctx.drum('big', e.t, 0.75 * v);
      if (!odd && (e.st === 10 || e.st === 11)) ctx.drum('lowtom', e.t, (e.st === 10 ? 0.55 : 0.7) * v);
      if (odd && e.st === 6) ctx.drum('big', e.t, 0.6 * v);
      if (odd && e.st === 8) ctx.drum('huge', e.t, 0.85 * v);
      if (e.bar % 4 === 3 && e.st >= 12) ctx.drum('lowtom', e.t, (0.5 + 0.12 * (e.st - 12)) * v, e.st % 2 ? 0.2 : -0.2);
      if (e.surge && e.st % 4 === 0 && e.st) ctx.drum('deep', e.t, 0.8);
    }
    if (e.st !== 0) return;
    ctx.voice(growl(hz(roots[e.bar % 8]), g.barLen * 0.97), e.t, MUSIC_DB.growl);
    if (!odd) ctx.voice(braam(g.barLen * 1.7), e.t, MUSIC_DB.braam, 0, 0.3);
    if (e.bar % 4 === 2 && e.bar + 2 <= g.bars) {
      const [a, b] = tension(g.barLen * 2);
      ctx.voice(a, e.t, MUSIC_DB.tension, -0.4); ctx.voice(b, e.t, MUSIC_DB.tension, 0.4);
    }
  });
}

// Scene 5 — "Final Ink Arena": everything. Taiko 3-3-2 over four-on-the-floor, backbeat, sixteenth
// layers, a driving sixteenth bass on the chord roots, a dark choir (Dm B♭ Gm A | B♭ C Dm C) and
// the motif as the long top line — one note per bar, each a chord tone.
function scoreInkArena(ctx) {
  const g = ctx.grid(ctx.start, ctx.end, ctx.style.bpm);
  const chords = [[0, 'm'], [-4, 'M'], [5, 'm'], [7, 'M'], [-4, 'M'], [-2, 'M'], [0, 'm'], [-2, 'M']];
  const drums = {
    big: { 0: 1, 3: 0.75, 6: 0.85, 8: 1, 11: 0.75, 14: 0.9 }, kick: { 0: 0.9, 4: 0.8, 8: 0.9, 12: 0.8 }, snare: { 4: 0.85, 12: 0.9 },
    mid: { 7: 0.5, 10: 0.6, 15: 0.6 }, hi: steps((i) => ([2, 5, 9, 13].includes(i) ? 0.75 : 0.4)),
    rim: steps((i) => ([0, 3, 6, 8, 11, 14].includes(i) ? 0.8 : 0.45)), tick: steps((i) => (i % 4 === 2 ? 0.7 : 0)),
  };
  ctx.seq(g, (e) => {
    const [root, quality] = chords[e.bar % 8], low = root > 3 ? root - 12 : root;
    if (!e.fill) {
      ctx.table(drums, e);
      if (e.st === 0 && e.bar % 2 === 0) ctx.drum('deep', e.t, 0.9 * e.energy);
      if ((e.x > 0.7 || e.surge) && e.st % 4 === 2) ctx.drum('mid', e.t, 0.6 * e.energy);
    }
    ctx.bass(e.t, e.st % 4 === 2 ? low + 12 : e.st % 8 === 7 ? low + 7 : low, g.step * 0.85, e.st % 4 === 0 ? 1 : 0.7, 2.2);
    if (e.st !== 0) return;
    ctx.stereo(choir(root, quality, g.barLen), e.t, MUSIC_DB.choir);
    ctx.voice(lead(hz(MOTIF[e.bar % 8] + 12, D3), g.barLen * 0.96), e.t, MUSIC_DB.lead);
  });
}

// Scene 6 — "The Last Line": almost nothing. The drone ebbs away, three lonely hits, and the end
// of the motif — F, E, then a long soft D that resolves it — before complete silence.
function scoreLastLine(ctx) {
  const d = ctx.end - ctx.start, at = (x) => ctx.start + x * d;
  [[0.1, 0.5], [0.36, 0.4], [0.6, 0.3]].forEach(([x, v]) => ctx.drum('deep', at(x), v, 0, 0.5));
  const tone = (x, semi, len, db) => ctx.stereo(softTone(hz(semi + 12, D3), len), at(x), db);
  tone(0.2, 3, d * 0.2, MUSIC_DB.soft - 3);
  tone(0.33, 2, d * 0.2, MUSIC_DB.soft - 3);
  tone(0.46, 0, Math.max(0.5, d * 0.54 - 0.45), MUSIC_DB.soft);
}

// ── "playful" — a generic light score for any non-fight scene ───────────────
// A D-major loop (I–IV–V–I) on marimba, pizzicato bass and woodblock, stretched to whole bars over
// the scene, honouring suspend/aftermath hints (ctx.voice / ctx.drum are silent inside them), and
// ending on a button chord. Use it as a starting point for your own score functions.
function scorePlayful(ctx) {
  const D4 = D3 * 2, D5 = D3 * 4;
  const g = ctx.grid(ctx.start + 0.15, ctx.end - 0.9, 104);
  const chords = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]];
  const tune = [12, 16, 19, 16, 17, 21, 19, 17, 19, 23, 21, 19, 16, 12, 14, 12];
  for (let bar = 0; bar < g.bars; bar++) {
    const b0 = g.from + bar * g.barLen, ch = chords[bar % 4], e = g.barLen / 8;
    ctx.voice(pizz(hz(ch[0], D2)), b0, -11, 0);
    ctx.voice(pizz(hz(ch[0] + 7 - 12, D2)), b0 + 4 * e, -12, 0);
    for (let k = 0; k < 8; k++) {
      ctx.drum(k % 2 ? 'woodHi' : 'woodLo', b0 + k * e, k % 2 ? 0.4 : 0.32);
      if (k % 2 === 0) ctx.voice(marimba(hz(tune[(bar % 2) * 8 + k], D4)), b0 + k * e, -14, k % 4 ? 0.2 : -0.2, 0.06);
    }
    if (bar % 2 === 1) ctx.voice(glock(hz(ch[2] + 12, D5)), b0 + 6 * e, -21, 0.25, 0.25);
  }
  const tEnd = g.to + 0.1;
  ctx.voice(pizz(hz(0, D2)), tEnd, -9, 0);
  [12, 16, 19, 24].forEach((s, k) => ctx.voice(marimba(hz(s, D4)), tEnd + k * 0.012, -13, (k - 1.5) * 0.2, 0.08));
  ctx.voice(glock(hz(24, D5)), tEnd + 0.02, -17, 0, 0.3);
}

// ── "The Paper Plane" — a light, friendly score in D major ───────────────────
// No drums of war here: a marimba tune, a soft pizzicato bass, woodblock tick-tock, a glockenspiel.
// It is fitted to the picture through 'mark' cues emitted by the scene (throw, trip, catch, …), so
// retiming the scene moves the music with it. The footsteps of the run fall on its sixteenths.
function marimba(f) {
  return cached(`mar|${f.toFixed(2)}`, () => {
    const n = sec(0.7);
    return norm(layer(n, [modes(n, [[f, 0.16, 1, 0], [f * 4, 0.035, 0.28, 0], [f * 10.1, 0.01, 0.1, 0]]), 1],
      [shape(unit(lp(white(n, rngFor('mar', f.toFixed(2))), 2200)), decay(0.004)), 0.1]));
  });
}
function pizz(f) {
  return cached(`pizz|${f.toFixed(2)}`, () => {
    const n = sec(0.5), raw = layer(n, [osc(n, f, 'tri'), 1], [osc(n, f * 2), 0.25], [osc(n, f * 3), 0.08]);
    return norm(shape(lp(raw, (t) => 400 + 1400 * Math.exp(-t / 0.04), 0.9), (t) => Math.min(1, t / 0.003) * Math.exp(-t / 0.13)));
  });
}
function glock(f) {
  return cached(`glock|${f.toFixed(2)}`, () => {
    const n = sec(1.2);
    return norm(shape(modes(n, [[f, 0.35, 1, 0], [f * 2.76, 0.1, 0.3, 0], [f * 5.4, 0.03, 0.12, 0]]), (t) => Math.min(1, t / 0.002)));
  });
}
function scorePaperPlane(ctx) {
  const at = {};
  for (const c of CUES) if (c.type === 'mark' && c.t >= ctx.start && c.t < ctx.end) at[c.name] = c.t;
  const need = ['throw', 'trip', 'peek', 'stand', 'run2', 'jump', 'catch', 'land', 'tada', 'hop', 'pose'];
  const missing = need.filter((k) => at[k] == null);
  if (missing.length) { console.warn(`audio: scorePaperPlane needs mark cues: ${missing.join(', ')} — no music`); return; }
  const D4 = D3 * 2, D5 = D3 * 4;
  const mar = (t, semi, db = 0, pan = 0) => ctx.voice(marimba(hz(semi, D4)), t, -14 + db, pan, 0.06);
  const bass = (t, semi, db = 0) => ctx.voice(pizz(hz(semi, D2)), t, -11 + db, 0);
  const bell = (t, semi, db = 0, pan = 0.2) => ctx.voice(glock(hz(semi, D5)), t, -19 + db, pan, 0.25);
  const tick = (t, hi, v = 0.5) => ctx.drum(hi ? 'woodHi' : 'woodLo', t, v);
  const chord = (t, semis, db = 0) => semis.forEach((s, k) => mar(t + k * 0.012, s, db - 1, (k - 1) * 0.25));

  // A — folding: eight easy eighths that end on the throw
  const e = 0.32, a0 = at.throw - 8 * e;
  [12, null, 7, 4, 9, null, 7, 4].forEach((s, k) => { if (s != null) mar(a0 + k * e, s, -2, k % 2 ? 0.2 : -0.2); });
  [0, 7, 0, 7].forEach((s, k) => bass(a0 + k * 2 * e, s - (s ? 12 : 0), -2));
  for (let k = 0; k < 8; k++) tick(a0 + k * e, k % 2, k % 2 ? 0.4 : 0.3);

  // B — the chase: the same pulse, twice as busy, until the pencil
  const s16 = e / 2, nB = Math.round((at.trip - at.throw) / s16);
  bell(at.throw, 12, 2);
  [12, 16, 19, 16, 21, 19, 16, 19].forEach((s, k) => { if (k * 2 < nB) mar(at.throw + k * e, s, 0, k % 2 ? 0.25 : -0.25); });
  [0, 7, 0, -5].forEach((s, k) => { if (k * 4 < nB) bass(at.throw + k * 2 * e, s); });
  for (let k = 0; k < nB; k++) { if (k % 2 === 0) tick(at.throw + k * s16, (k / 2) % 2, 0.45); else ctx.drum('stick', at.throw + k * s16, 0.6); }

  // …silence while he lies there (the scene suspends the music) — then three careful notes back up
  bass(at.peek, -5, -3);
  bass((at.peek + at.stand) / 2, -3, -3);
  bass(at.stand - 0.14, -1, -2);
  bass(at.stand, 0); bell(at.stand, 0, 0);

  // D — after it again, climbing into the jump
  const nD = Math.round((at.jump - at.run2) / s16);
  [12, 16, 19, 21, 24].forEach((s, k) => { const t = at.run2 + k * e; if (t < at.jump - 0.05) mar(t, s, 0, k % 2 ? 0.25 : -0.25); });
  bass(at.run2, 0); bass(at.run2 + 2 * e, 7 - 12);
  for (let k = 0; k < nD; k++) { if (k % 2 === 0) tick(at.run2 + k * s16, (k / 2) % 2, 0.45); else ctx.drum('stick', at.run2 + k * s16, 0.6); }
  // the jump: a run up the scale that lands on the catch
  const scale = [12, 14, 16, 17, 19, 21, 23], dt = (at.catch - at.jump) / scale.length;
  scale.forEach((s, k) => mar(at.jump + k * dt, s, -4 + k * 0.6, -0.3 + k * 0.1));

  // E — caught, landed, ta-da
  bass(at.catch, 0, 1); chord(at.catch, [12, 16, 19, 24], 1);
  bass(at.land, -5); chord(at.land, [7, 11, 14], -1);                       // A major: the question…
  bass(at.tada, 0, 2); chord(at.tada, [12, 16, 19, 24], 2); bell(at.tada, 12, 3, -0.2); bell(at.tada + 0.02, 16, 2, 0.3);   // …D major: the answer
  const hopUp = at.hop - 0.32;
  mar(hopUp, 19, -1); mar(hopUp + 0.16, 21, -1);                            // the little hop
  bass(at.hop, 0, 1); chord(at.hop, [12, 16, 19], 1); bell(at.hop, 19, 1);
  bass(at.pose, -12, 1); chord(at.pose, [0, 12, 16, 24], 1); bell(at.pose, 24, 3, 0); bell(at.pose + 0.03, 12, 1, -0.3);   // button
}

// `only`: a Set of scene indices to score (the fallback for scenes without generated music);
// null scores the whole film.
function renderMusic(only = null) {
  const groove = makeBus(), hallSend = new Float32Array(N), ctl = musicControls();
  const contexts = SCENES.map((scene, index) => sceneContext(scene, index, groove, hallSend, ctl));
  contexts.forEach((ctx, index) => {
    if (only && !only.has(index)) return;
    if (index > 0 && !ctx.last) for (const [name, v] of ctx.style.accent) ctx.drum(name, ctx.start, v * 0.9);   // the page lands
    ctx.style.score(ctx);
  });

  // accents: a big hit on every impact frame, with a short fill into it when the second before is free
  const accents = ACCENTS.filter((t) => t >= 0 && t < DURATION).sort((a, b) => a - b);
  accents.forEach((ta, k) => {
    const ctx = contexts.find((c) => ta < c.end) ?? contexts.at(-1);
    if (gated(ta) || (only && !only.has(contexts.indexOf(ctx)))) return;
    for (const [name, v] of ctx.style.accent) ctx.drum(name, ta, v, undefined, 0.25);
    const free = (k === 0 || ta - accents[k - 1] > 1) && ta - ctx.start > 0.6 && ctx.end - ta > 1.3 && !gated(ta - 0.2) && !gated(ta - 0.4);
    if (free && ctx.style.fill) [[-0.36, 0.5], [-0.24, 0.62], [-0.14, 0.76], [-0.06, 0.9]].forEach(([off, v], j) => ctx.drum(ctx.style.fill[j % 2], ta + off, v, j % 2 ? -0.25 : 0.25));
  });

  // glue: a little dry room on everything, hall on the big drums; both inside the gate so they
  // die with the groove
  const mono = new Float32Array(N);
  for (let i = 0; i < N; i++) mono[i] = 0.5 * (groove.L[i] + groove.R[i]);
  const room = reverb(mono, ROOM), hall = reverb(hallSend, HALL), gate = grooveGate();
  for (let i = 0; i < N; i++) {
    groove.L[i] = (groove.L[i] + 0.16 * room.L[i] + hall.L[i]) * gate[i];
    groove.R[i] = (groove.R[i] + 0.16 * room.R[i] + hall.R[i]) * gate[i];
  }

  const pad = renderPad(ctl), bus = makeBus();
  if (only) {                                          // keep just the requested scenes (30 ms edges)
    const mask = new Float32Array(N), edge = Math.round(0.03 * SR);
    SCENES.forEach((sc, index) => {
      if (!only.has(index)) return;
      const a = clamp(Math.round(sc.start * SR), 0, N), b = clamp(Math.round(sc.end * SR), 0, N);
      for (let i = a; i < b; i++) mask[i] = Math.min(1, (i - a) / edge, (b - i) / edge);
    });
    for (let i = 0; i < N; i++) { groove.L[i] *= mask[i]; groove.R[i] *= mask[i]; pad.L[i] *= mask[i]; pad.R[i] *= mask[i]; }
  }
  for (let i = 0; i < N; i++) { bus.L[i] = groove.L[i] + pad.L[i]; bus.R[i] = groove.R[i] + pad.R[i]; }
  return Object.assign(bus, { groove, pad });          // sub-buses kept for --stats
}

// ═════════════════════════════════════════════════════════════════════════════
// 4b. Library music — the generated per-scene score (assets/audio/music/<scene id>.wav)
//
// Each piece starts on its scene's first frame and rings `xfade` seconds past the end, fading
// under the next one (short crossfade at the page turn). Pieces are brought to a common loudness,
// then trimmed per scene so the film escalates and the last scene is the quietest by far.
// ═════════════════════════════════════════════════════════════════════════════
const MUSIC_LIB = {
  lufs: -19.5,                                           // loudness every piece is brought to before the trims (pre-master)
  trim: { s1: 0, s2: -1, s3: -0.5, s3b: -0.5, s4: 1, s5: 1.5, s6: -3, credits: 1 },   // dB per scene id
  // Fitting single pieces to the picture (seconds). Hand-fitted to the files generated on
  // 2026-11-18 — look at these again after regenerating a piece.
  //   skip    start this far into the file
  //   env     [[seconds into the scene, gain], …] a level curve drawn over the piece
  //   endAt   the last sample of the file lands this long into the scene (its start is skipped to fit)
  //   button  finish with a low drum hit and a hall ring-out where the piece ends
  // (the delay before a piece starts — MUSIC_SHAPE[id].lead — lives in tools/soundlib.mjs)
  fit: {
    // quiet stand-off, the file's big moment on the knock-out (≈ 7.7 s), then dread thinning to nothing
    // by 15.6 s. The piece is its own aftermath: 'aftermath' hints inside the scene are not applied to it.
    s6: { skip: 3.0, env: [[0, 0.3], [3.2, 0.3], [3.8, 1], [7.9, 1], [9, 0.45], [13, 0.3], [14.5, 0.12], [15.6, 0]], ignoreHints: ['aftermath'] },
    credits: { endAt: 13.2, button: true },                                // the cue ends decisively before the last frame
  },
  xfade: 0.6,                                            // s the outgoing piece takes to fade out after a boundary
  suspend: { db: -14, lowpass: 320, mix: 1 },            // slow motion: duck hard and low-pass
  aftermath: { db: -26, mix: 0.6 },                      // near silence
  surge: { db: 2 },
};
function renderMusicFromLibrary(library, stops = []) {
  const lib = makeBus(), missing = new Set();
  SCENES.forEach((sc, index) => {
    const piece = library.music.get(sc.id), loud = piece ? lufs(piece.L, piece.R) : null;
    if (!piece || piece.sr !== SR || !(loud > -69)) { missing.add(index); return; }
    const g = dB(MUSIC_LIB.lufs + (MUSIC_LIB.trim[sc.id] ?? 0) - loud), fit = MUSIC_LIB.fit[sc.id] ?? {}, lead = MUSIC_SHAPE[sc.id]?.lead ?? 0;
    const start = Math.round((sc.start + lead) * SR), total = piece.L.length;
    const want = fit.endAt != null ? Math.round((fit.endAt - lead) * SR) : Math.round((sc.end - sc.start - lead + MUSIC_LIB.xfade) * SR);
    const skip = fit.endAt != null ? Math.max(0, total - want) : Math.min(total, Math.round((fit.skip ?? 0) * SR));
    let len = Math.max(0, Math.min(total - skip, want));
    let fout = Math.round((fit.endAt != null ? 0.05 : Math.min(len < want ? 0.3 : MUSIC_LIB.xfade, len / SR / 2)) * SR);
    // a full stop inside the scene ends the piece for good, 2 ms before the cue
    const stop = stops.find((s) => s.t >= sc.start && s.t < sc.end), cut = stop ? Math.round(stop.t * SR) - start : Infinity;
    if (cut < len) { len = Math.max(0, cut); fout = Math.min(DECLICK, len); }
    const fin = Math.round((index === 0 && !lead ? 0.005 : skip ? 0.35 : 0.03) * SR);
    const env = (i) => {                                    // the fitted level curve, linear between its points
      if (!fit.env) return 1;
      const t = lead + i / SR, pts = fit.env;
      if (t <= pts[0][0]) return pts[0][1];
      for (let k = 1; k < pts.length; k++) if (t < pts[k][0]) return lerp(pts[k - 1][1], pts[k][1], (t - pts[k - 1][0]) / (pts[k][0] - pts[k - 1][0]));
      return pts.at(-1)[1];
    };
    for (let i = 0; i < len && start + i < N; i++) {
      const f = g * env(i) * Math.min(1, i / fin) * (i >= len - fout ? 0.5 + 0.5 * Math.cos(Math.PI * (i - (len - fout)) / fout) : 1);
      lib.L[start + i] += piece.L[skip + i] * f; lib.R[start + i] += piece.R[skip + i] * f;
    }
    if (fit.button && cut >= len && len > SR) {             // the ending: a low hit on the last beat, and the hall rings out
      const at = (start + len) / SR - 0.03, ring = Math.round(0.45 * SR), send = new Float32Array(ring + 2 * SR), from = start + len - ring;
      for (const [name, db] of [['big', -13], ['kick', -15]]) {
        const hit = drumHit(name, 1.2);
        place(lib, hit, at, dB(db));
        for (let i = 0; i < hit.length && ring - Math.round(0.03 * SR) + i < send.length; i++) send[ring - Math.round(0.03 * SR) + i] += hit[i] * dB(db);
      }
      for (let i = 0; i < ring; i++) send[i] += 0.5 * (lib.L[from + i] + lib.R[from + i]) * (i / ring) ** 2;
      const wet = reverb(send, HALL);
      for (let i = 0; i < send.length && from + i < N; i++) { lib.L[from + i] += 1.8 * wet.L[i]; lib.R[from + i] += 1.8 * wet.R[i]; }
    }
  });
  for (const index of missing) console.warn(`audio: no generated music for scene "${SCENES[index].id}" — using the synth score`);

  // music hints → a gain curve and a dry / low-passed blend, at control rate
  const M = Math.ceil(N / CTRL) + 2, gdb = new Float32Array(M), mix = new Float32Array(M);
  for (const h of MUSIC_HINTS) {
    const cfg = MUSIC_LIB[h.mode], inScene = SCENES.find((sc) => h.from >= sc.start - 1e-6 && h.from < sc.end);
    if (!cfg || MUSIC_LIB.fit[inScene?.id]?.ignoreHints?.includes(h.mode)) continue;
    const a = clamp(Math.round(h.from * SR / CTRL), 0, M), b = clamp(Math.round(h.to * SR / CTRL), 0, M);
    for (let i = a; i < b; i++) { gdb[i] = cfg.db < 0 ? Math.min(gdb[i], cfg.db) : Math.max(gdb[i], cfg.db); mix[i] = Math.max(mix[i], cfg.mix ?? 0); }
  }
  const down = 1 - Math.exp(-CTRL / (0.04 * SR)), up = 1 - Math.exp(-CTRL / (0.15 * SR)), gain = new Float32Array(M);
  for (let i = 0, zg = gdb[0], zm = mix[0]; i < M; i++) {
    zg += (gdb[i] - zg) * (gdb[i] < zg ? down : up); zm += (mix[i] - zm) * (mix[i] > zm ? down : up);
    gain[i] = dB(zg); mix[i] = zm;
  }
  const lowL = lp(lib.L, MUSIC_LIB.suspend.lowpass), lowR = lp(lib.R, MUSIC_LIB.suspend.lowpass);
  for (let i = 0; i < N; i++) {
    const m = ctrlAt(mix, i), g = ctrlAt(gain, i);
    lib.L[i] = (lib.L[i] * (1 - m) + lowL[i] * m) * g;
    lib.R[i] = (lib.R[i] * (1 - m) + lowR[i] * m) * g;
  }

  // scenes without a generated piece: the synth score, brought to the same loudness
  const synth = missing.size ? renderMusic(missing) : makeBus(), bus = makeBus();
  for (const index of missing) {
    const sc = SCENES[index], a = clamp(Math.round(sc.start * SR), 0, N), b = clamp(Math.round(sc.end * SR), 0, N);
    const loud = lufs(synth.L.subarray(a, b), synth.R.subarray(a, b));
    if (!(loud > -69)) continue;
    const g = dB(MUSIC_LIB.lufs + (MUSIC_LIB.trim[sc.id] ?? 0) - loud);
    for (let i = a; i < b; i++) { synth.L[i] *= g; synth.R[i] *= g; }
  }
  for (let i = 0; i < N; i++) { bus.L[i] = lib.L[i] + synth.L[i]; bus.R[i] = lib.R[i] + synth.R[i]; }
  return Object.assign(bus, { groove: lib, pad: synth, missing });       // sub-buses kept for --stats
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. Master
// ═════════════════════════════════════════════════════════════════════════════

// Music ducks under heavy SFX: { db, hold, release } per cue, or null.
const DUCK = {
  hit: (c) => ((c.weight ?? 0.7) >= 0.8 ? { db: 5 } : null),
  clack: (c) => ((c.weight ?? 0.7) >= 0.8 ? { db: 4 } : null),
  clang: (c) => ((c.weight ?? 0.7) >= 0.8 ? { db: 4 } : null),
  stomp: () => ({ db: 5 }),
  slam: (c) => ({ db: 4 + 3 * (c.weight ?? 0.8), hold: 0.06, release: 0.12 }),
  shatter: () => ({ db: 4 }),
  thunder: () => ({ db: 5, hold: 0.1, release: 0.3 }),
  wallbreak: (c) => ({ db: 5 + 4 * (c.size ?? 1), hold: 0.07, release: 0.14 }),
  megaimpact: () => ({ db: 12, hold: 0.15, release: 0.5 }),
  gunshot: () => ({ db: 5, hold: 0.05, release: 0.12 }),
};
function duckCurve() {
  const g = new Float32Array(N).fill(1), attack = 0.006;
  for (const c of CUES) {
    const d = DUCK[c.type]?.(c);
    if (!d || !(c.t >= 0 && c.t < DURATION)) continue;
    const depth = dB(-d.db * Math.min(1, c.gain ?? 1)), hold = d.hold ?? 0.04, rel = d.release ?? 0.09;
    const i0 = Math.round((c.t - attack) * SR), i1 = Math.round((c.t + hold + rel) * SR);
    for (let i = Math.max(0, i0); i < Math.min(N, i1); i++) {
      const t = i / SR - c.t;
      const x = t < 0 ? 1 + t / attack : t < hold ? 1 : 0.5 + 0.5 * Math.cos(Math.PI * (t - hold) / rel);   // 0 → 1 → 0
      g[i] = Math.min(g[i], 1 + (depth - 1) * x);
    }
  }
  return g;
}

// Gentle stereo-linked bus compressor (feed-forward, peak envelope). Slow attack: transients pass,
// sustained build-up is held back. Works in place; returns how hard it worked.
const BUS_COMP = {
  sfx: { thresholdDb: -12, ratio: 2, attackMs: 12, releaseMs: 180, makeupDb: 0 },
  music: { thresholdDb: -15, ratio: 2.2, attackMs: 25, releaseMs: 250, makeupDb: 0 },
  libraryMusic: { thresholdDb: -12, ratio: 1.5, attackMs: 30, releaseMs: 300, makeupDb: 0 },   // generated music is already mastered
};
function compress(bus, { thresholdDb, ratio, attackMs, releaseMs, makeupDb = 0 }) {
  const { L, R } = bus, n = L.length, thr = dB(thresholdDb), slope = 1 / ratio - 1, makeup = dB(makeupDb);
  const att = 1 - Math.exp(-1 / (attackMs / 1000 * SR)), rel = 1 - Math.exp(-1 / (releaseMs / 1000 * SR));
  let env = 0, minGain = 1, sum = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.abs(L[i]), b = Math.abs(R[i]), x = a > b ? a : b;
    env += (x - env) * (x > env ? att : rel);
    let g = makeup;
    if (env > thr) {
      const r = Math.pow(env / thr, slope);
      g *= r; sum += r;
      if (r < minGain) minGain = r;
    } else sum += 1;
    L[i] *= g; R[i] *= g;
  }
  return { maxGr: -toDb(minGain), meanGr: -toDb(sum / n) };
}

// ITU-R BS.1770 integrated loudness (K-weighting, 400 ms blocks, absolute + relative gating).
function lufs(L, R) {
  const k = (x) => biquad(biquad(x, 1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585),
    1, -2, 1, -1.99004745483398, 0.99007225036621);
  const kl = k(L), kr = k(R), block = Math.round(0.4 * SR), hop = Math.round(0.1 * SR), z = [];
  for (let s = 0; s + block <= L.length; s += hop) {
    let a = 0;
    for (let i = s; i < s + block; i++) a += kl[i] * kl[i] + kr[i] * kr[i];
    z.push(a / block);
  }
  const loud = (p) => -0.691 + 10 * Math.log10(Math.max(p, 1e-12));
  const mean = (arr) => arr.reduce((s, v) => s + v, 0) / (arr.length || 1);
  const abs = z.filter((p) => loud(p) > -70);
  const rel = loud(mean(abs)) - 10;
  return loud(mean(abs.filter((p) => loud(p) > rel)));
}

// Inter-sample ("true") peak envelope: 4× Kaiser-windowed-sinc interpolation, max of both channels.
// Samples whose neighbourhood stays under `floor` are skipped (they cannot matter to the limiter).
const TP_TAPS = 24;
const besselI0 = (x) => { let s = 1, term = 1; for (let k = 1; k < 30; k++) { term *= (x / (2 * k)) ** 2; s += term; } return s; };
const TP_COEF = [0.25, 0.5, 0.75].map((fr) => Float64Array.from({ length: 2 * TP_TAPS }, (_, k) => {
  const d = k - TP_TAPS + 1 - fr;
  return Math.sin(Math.PI * d) / (Math.PI * d) * besselI0(8 * Math.sqrt(1 - (d / TP_TAPS) ** 2)) / besselI0(8);
}));
function truePeakEnv(L, R, floor = 0) {
  const n = L.length, pk = new Float32Array(n);
  for (const x of [L, R]) {
    for (let i = 0; i < n; i++) {
      let m = Math.abs(x[i]);
      if (i >= TP_TAPS && i < n - TP_TAPS
        && Math.max(m, Math.abs(x[i - 1]), Math.abs(x[i + 1]), Math.abs(x[i + 2])) >= floor) {
        for (const h of TP_COEF) {
          let s = 0;
          for (let k = 0, j = i - TP_TAPS + 1; k < 2 * TP_TAPS; k++, j++) s += x[j] * h[k];
          if (s < 0) s = -s;
          if (s > m) m = s;
        }
      }
      if (m > pk[i]) pk[i] = m;
    }
  }
  return pk;
}

// Master soft clip: linear below the knee, tanh above it, never exceeds `max`.
function softClip(x, knee, max) {
  const span = max - knee;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]);
    if (a > knee) x[i] = Math.sign(x[i]) * (knee + span * Math.tanh((a - knee) / span));
  }
  return x;
}

// Look-ahead true-peak limiter. The gain curve leads the peaks; the audio itself is not delayed,
// so onsets stay sample-accurate. Reports how hard and how often it had to work.
function limit(L, R, ceiling, lookahead = 72, releaseMs = 70) {
  const n = L.length, pk = truePeakEnv(L, R, ceiling * 0.35), need = pk;      // reuse the buffer
  for (let i = 0; i < n; i++) need[i] = pk[i] > ceiling ? ceiling / pk[i] : 1;
  // minimum over [i, i + lookahead] (monotonic deque), then exponential release
  const held = new Float32Array(n), dq = new Int32Array(n);
  let head = 0, tail = 0, j = 0;
  for (let i = 0; i < n; i++) {
    for (; j < n && j <= i + lookahead; j++) {
      while (tail > head && need[dq[tail - 1]] >= need[j]) tail--;
      dq[tail++] = j;
    }
    while (dq[head] < i) head++;
    held[i] = need[dq[head]];
  }
  const rel = Math.exp(-1 / (releaseMs / 1000 * SR));
  for (let i = 1; i < n; i++) held[i] = Math.min(held[i], 1 - (1 - held[i - 1]) * rel);
  // moving average over the look-ahead window → smooth attack that still lands on time
  let acc = 0, minGain = 1, at = 0, active = 0, si = 0;
  const byScene = SCENES.map(() => 0);
  for (let i = 0; i < n; i++) {
    acc += held[i] - (i > lookahead ? held[i - lookahead - 1] : 1);
    const g = Math.min(1, 1 + acc / (lookahead + 1));
    L[i] *= g; R[i] *= g;
    if (g < minGain) { minGain = g; at = i; }
    if (g < 0.944) {
      while (si < SCENES.length - 1 && i >= SCENES[si].end * SR) si++;
      active++; byScene[si]++;
    }
  }
  // max reduction, where, and the seconds spent beyond 0.5 dB of reduction (total and per scene)
  return { gr: -toDb(minGain), at: at / SR, active: active / SR, byScene: byScene.map((c) => c / SR) };
}

function master(mixL, mixR) {
  const ceiling = dB(CEILING_DB);
  const srcL = hp(mixL, 22), srcR = hp(mixR, 22);          // remove DC / infrasonics
  const process = (gain) => {
    const L = softClip(scale(srcL.slice(), gain), ceiling * 0.6, ceiling * CLIP_MAX);
    const R = softClip(scale(srcR.slice(), gain), ceiling * 0.6, ceiling * CLIP_MAX);
    const lim = limit(L, R, ceiling);
    const a = Math.round(FADE_IN * SR), b = Math.round(FADE_OUT * SR);
    for (let i = 0; i < a; i++) { L[i] *= i / a; R[i] *= i / a; }
    for (let i = 0; i < b; i++) {                           // fade the last 40 ms; final 2 ms are exact zeros
      const g = clamp((i - DECLICK) / (b - DECLICK), 0, 1);
      L[N - 1 - i] *= g; R[N - 1 - i] *= g;
    }
    return { L, R, lim, lufs: lufs(L, R) };
  };
  // loudness normalisation: the clipper/limiter are non-linear, so home in on the target iteratively
  const raw = lufs(srcL, srcR);
  if (!(raw > -69)) return { ...process(1), gain: 1, truePeak: 0, passes: 1 };     // nothing to normalise
  let gain = dB(TARGET_LUFS - raw), res = process(gain), passes = 1;
  for (; passes < 8 && Math.abs(res.lufs - TARGET_LUFS) > 0.1; passes++) {
    gain *= dB((TARGET_LUFS - res.lufs) * 1.2);
    res = process(gain);
  }
  // belt and braces: if the estimate still sees an over, trim the whole file
  const tp = peak(truePeakEnv(res.L, res.R, ceiling * 0.35));
  if (tp > ceiling) { scale(res.L, ceiling / tp); scale(res.R, ceiling / tp); }
  return { ...res, gain, truePeak: Math.min(tp, ceiling), passes };
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. Cue sheet loading, self-test sheet, WAV writer, report
// ═════════════════════════════════════════════════════════════════════════════

const HERE = dirname(fileURLToPath(import.meta.url));

// Import src/cues.js. Scene files may be mid-edit while this runs; a failed import is retried in
// a fresh process (the module cache of this one would only replay the failure).
async function loadSheet({ optional = false } = {}) {
  try {
    return await import('../src/cues.js');
  } catch (err) {
    if (optional) { console.warn(`audio: src/cues.js not loadable (${err.message}) — using the built-in scene layout`); return null; }
    const attempt = Number(process.env.STICK_FILM_AUDIO_RETRY ?? 0);
    if (attempt >= 5) throw err;
    console.warn(`audio: could not load src/cues.js (${err.message}) — retry ${attempt + 1}/5 in 2 s`);
    await new Promise((done) => setTimeout(done, 2000));
    const child = spawnSync(process.execPath, process.argv.slice(1), { stdio: 'inherit', env: { ...process.env, STICK_FILM_AUDIO_RETRY: String(attempt + 1) } });
    process.exit(child.status ?? 1);
  }
}

// A synthetic but plausible cue sheet for testing: dense fights in the style of each scene, every
// cue type at least once, hints and accents included. Uses the real scene boundaries if available.
const DEFAULT_SCENES = [
  { id: 's1', title: 'The First Clash', start: 0, end: 20 }, { id: 's2', title: 'Pencil City', start: 20, end: 42 },
  { id: 's3', title: 'Geometry Zone', start: 42, end: 64 }, { id: 's3b', title: 'Ink Shots', start: 64, end: 84 },
  { id: 's4', title: 'Torn Paper Battlefield', start: 84, end: 112 }, { id: 's5', title: 'Final Ink Arena', start: 112, end: 137 },
  { id: 's6', title: 'The Last Line', start: 137, end: 157 }, { id: 'credits', title: 'Credits', start: 157, end: 171 },
];
function selfTestSheet(real) {
  const scenes = real?.SCENES?.length ? real.SCENES.map((s) => ({ ...s })) : DEFAULT_SCENES;
  const duration = real?.DURATION ?? scenes.at(-1).end;
  const rng = rngFor('selftest'), cues = [], hints = [], accents = [];
  const r3 = (x) => Math.round(x * 1000) / 1000, pick = (arr) => arr[Math.floor(rng() * arr.length)], between = (a, b) => rr(rng, a, b);
  let sceneId = 's1';
  const add = (t, type, o = {}) => { if (t >= 0 && t < duration) cues.push({ t: r3(t), type, pan: +between(-0.5, 0.5).toFixed(2), ...o, scene: sceneId }); };
  const accent = (t) => { if (!accents.length || t - accents.at(-1) > 0.8) accents.push(r3(t)); };
  const whoosh = (t, size) => { add(t, 'whoosh', { size, dur: { s: 0.1, m: 0.18, l: 0.3 }[size], weight: { s: 0.4, m: 0.7, l: 1 }[size] }); return { s: 0.08, m: 0.14, l: 0.24 }[size]; };
  const heavy = (t) => { add(t, 'heavyswing', { size: 'l', dur: 0.3, weight: 1 }); return 0.3; };
  const blade = (t) => { add(t, 'slice', { weight: between(0.4, 1) }); return 0.07; };
  const impact = (t, type, lo, hi) => { const weight = +between(lo, hi).toFixed(2); add(t, type, { weight }); if (weight >= 0.97) accent(t); };
  // set pieces
  const slowmo = (t, payoff) => {                        // slow motion → big hit
    whoosh(t, 'l');
    add(t + 0.14, 'slowdown', { dur: 1.3, pan: 0 }); add(t + 0.4, 'heartbeat', { pan: 0 }); add(t + 1.0, 'heartbeat', { pan: 0 });
    add(t + 1.28, 'riser', { dur: 0.24, pan: 0 });
    hints.push({ from: r3(t + 0.14), to: r3(t + 1.52), mode: 'suspend' });
    payoff(t + 1.52); accent(t + 1.52);
    return t + 2.7;
  };
  const mega = (t) => {                                  // the page cracks
    add(t, 'megaimpact'); add(t + 0.02, 'tear', { dur: 0.55 }); add(t + 0.04, 'crack', { dur: 0.5 }); add(t + 0.14, 'shing', { dur: 0.9 });
    hints.push({ from: r3(t), to: r3(t + 1.1), mode: 'aftermath' }); accent(t);
    return t + 1.7;
  };
  const wall = (t) => { add(t, 'wallbreak', { size: 1 }); add(t + 0.06, 'crumble', { dur: 1.1 }); };
  const PAL = [
    { swing: (t) => whoosh(t, pick(['s', 's', 'm', 'm', 'l'])), hit: (t) => impact(t, pick(['hit', 'hit', 'block', 'thud']), 0.4, 1), gap: [0.16, 0.42], rest: [0.35, 0.8], lead: 3.05,
      pieces: [[0.36, (t) => slowmo(t, wall)], [0.8, mega]] },
    { swing: (t) => whoosh(t, pick(['s', 's', 'm'])), hit: (t) => impact(t, pick(['clack', 'clack', 'hit', 'block']), 0.4, 0.95), gap: [0.14, 0.34], rest: [0.3, 0.7], lead: 0.9,
      pieces: [[0.05, (t) => { add(t, 'draw', { dur: 0.3 }); add(t + 0.32, 'pop'); return t + 0.7; }], [0.62, (t) => { add(t, 'clack', { weight: 1 }); add(t + 0.02, 'snap'); accent(t); return t + 0.6; }]] },
    { swing: (t) => (rng() < 0.7 ? blade(t) : whoosh(t, 's')), hit: (t) => impact(t, pick(['clang', 'clang', 'clang', 'block', 'hit']), 0.4, 0.95), gap: [0.13, 0.3], rest: [0.3, 0.7], lead: 0.9,
      pieces: [[0.04, (t) => { add(t, 'draw', { dur: 0.22 }); add(t + 0.25, 'shing', { dur: 0.6 }); return t + 0.9; }],
        [0.5, (t) => slowmo(t, (u) => add(u, 'clang', { weight: 1 }))], [0.86, (t) => { add(t, 'clang', { weight: 1 }); add(t + 0.01, 'shatter'); accent(t); return t + 0.9; }]] },
    { swing: heavy, hit: (t) => impact(t, pick(['slam', 'slam', 'clang', 'stomp', 'thud']), 0.75, 1), gap: [0.55, 1.1], rest: [0.6, 1.2], lead: 1.0,
      pieces: [[0.03, (t) => { add(t, 'rumble', { dur: 6, pan: 0 }); return t + 0.2; }], [0.12, (t) => { add(t, 'thunder', { pan: -0.3 }); return t + 0.4; }],
        [0.42, (t) => { heavy(t); add(t + 0.3, 'wallbreak', { size: 0.8 }); add(t + 0.36, 'crumble', { dur: 0.9 }); add(t + 0.5, 'inksplash', { weight: 0.8 }); accent(t + 0.3); return t + 1.6; }],
        [0.76, mega]] },
    { swing: (t) => pick([() => whoosh(t, 'l'), () => whoosh(t, 'm'), () => blade(t), () => heavy(t)])(),
      hit: (t) => impact(t, pick(['hit', 'clang', 'clang', 'slam', 'clack', 'block']), 0.6, 1), gap: [0.13, 0.32], rest: [0.25, 0.6], lead: 0.9,
      pieces: [[0.02, (t) => { add(t, 'wind', { dur: Math.min(22, duration - t - 1), pan: 0 }); return t + 0.1; }], [0.14, (t) => { add(t, 'thunder', { pan: 0.3 }); add(t + 0.3, 'inksplash', { weight: 1 }); return t + 0.5; }],
        [0.4, (t) => { add(t, 'boom'); add(t + 0.1, 'inksplash', { weight: 0.5 }); return t + 0.5; }], [0.58, (t) => slowmo(t, (u) => { add(u, 'slam', { weight: 1 }); add(u + 0.02, 'shatter'); })],
        [0.9, mega]] },
    { swing: () => 0, hit: () => {}, gap: [1, 1], rest: [1, 1], lead: 1e9, pieces: [] },
    // 6 — gunfight
    { swing: (t) => { if (rng() < 0.4) add(t, 'bulletwhiz'); return 0.12; },
      hit: (t) => { add(t, 'gunshot', { weight: +between(0.7, 1).toFixed(2) }); add(t + 0.04, pick(['bulletimpact', 'bulletimpact', 'ricochet']), { weight: 0.6 }); add(t + 0.3, 'shell'); },
      gap: [0.35, 0.9], rest: [0.5, 1.1], lead: 1.2, pieces: [[0.55, (t) => { add(t, 'dryfire'); add(t + 0.25, 'dryfire'); add(t + 0.7, 'reload'); return t + 3; }]] },
    // 7 — the ending: a last exchange, the knock-out, slow steps, the bolt, the shot (the film's full stop)
    { swing: (t) => whoosh(t, pick(['m', 'l'])), hit: (t) => impact(t, 'hit', 0.7, 1), gap: [0.2, 0.45], rest: [0.4, 0.8], lead: 0.8,
      pieces: [[0.42, (t) => {
        add(t, 'hit', { weight: 1 }); add(t + 0.35, 'thud', { weight: 0.8 }); accent(t);
        const end = sc_end(), bolt = end - 0.14 * (end - sc_start()), shot = end - 0.07 * (end - sc_start());
        for (let u = t + 2; u < bolt - 0.6; u += 0.9) add(u, 'step', { weight: 0.9 });
        add(bolt, 'riflecock', { pan: 0 }); add(shot, 'rifleshot', { pan: 0 });
        return end;
      }]] },
  ];
  let current = scenes[0];
  const sc_start = () => current.start, sc_end = () => current.end;
  const PALETTE = { s1: 0, s2: 1, s3: 2, s3b: 6, s4: 3, s5: 4, s6: 7, credits: 5 };
  scenes.forEach((sc, k) => {
    sceneId = sc.id;
    current = sc;
    const p = PAL[PALETTE[sc.id] ?? Math.min(k, 5)], len = sc.end - sc.start, lastScene = k === scenes.length - 1;
    if (k > 0 && !lastScene) add(sc.start, 'pageturn', { dur: 0.5, pan: 0 });
    if (k === 0) {
      add(sc.start + 0.15, 'scribble', { dur: 0.62, pan: -0.25 }); add(sc.start + 0.36, 'scribble', { dur: 0.6, pan: 0.25 });
      add(sc.start + 1.66, 'step', { weight: 0.35 }); add(sc.start + 1.94, 'stomp', { weight: 1 }); add(sc.start + 2.62, 'riser', { dur: 0.42, pan: 0 });
    }
    if (sc.id === 'credits') return;                       // end titles: music only
    if (lastScene && k > 0 && p === PAL[5]) {              // quiet coda
      add(sc.start + 1.0, 'step', { weight: 0.3 }); add(sc.start + len * 0.3, 'scribble', { dur: 0.6 }); add(sc.start + len * 0.55, 'draw', { dur: 0.5 });
      return;
    }
    const pieces = p.pieces.map(([x, run]) => ({ at: sc.start + x * len, run }));
    let t = sc.start + p.lead;
    while (t < sc.end - 1.6) {
      const piece = pieces.find((q) => !q.done && t >= q.at);
      if (piece) { piece.done = true; t = piece.run(t); continue; }
      for (let m = 0, moves = 3 + Math.floor(rng() * 5); m < moves && t < sc.end - 1.6; m++) {
        const lead = p.swing(t);
        p.hit(t + lead);
        if (rng() < 0.3) add(t + lead + 0.06, pick(['step', 'step', 'skid']), { weight: between(0.3, 0.9), dur: between(0.15, 0.35) });
        t += lead + between(...p.gap);
      }
      add(t + 0.1, 'step', { weight: between(0.3, 0.8) });
      if (rng() < 0.4) add(t + 0.22, 'skid', { dur: between(0.15, 0.35) });
      t += between(...p.rest);
    }
    if (p === PAL[4]) { hints.push({ from: r3(sc.start + len * 0.72), to: r3(sc.end - 2.6), mode: 'surge' }); add(sc.end - 0.25, 'cuthit', { pan: 0 }); }
    if (k === 1) hints.push({ from: r3(sc.end - 5), to: r3(sc.end), mode: 'surge' });
  });
  // every recipe at least once
  const used = new Set(cues.map((c) => c.type)), spare = scenes[Math.min(3, scenes.length - 1)];
  Object.keys(RECIPES).filter((type) => !used.has(type) && !STOP_TYPES.has(type)).forEach((type, i) => {
    sceneId = spare.id;
    add(spare.start + 2 + i * 1.3, type, { weight: 0.8, dur: 0.6, size: 'm' });
  });
  cues.sort((a, b) => a.t - b.t); accents.sort((a, b) => a - b);
  return { DURATION: duration, CUES: cues, SCENES: scenes, MUSIC_HINTS: hints, ACCENTS: accents };
}

// Audition sheet: every cue type (or the ones named in --audition=a,b,c) on its own, in a row,
// with no music — for listening to and tweaking single recipes.
function auditionSheet(only) {
  const known = [...new Set([...Object.keys(RECIPES), ...Object.keys(SAMPLE)])];
  const types = typeof only === 'string' ? only.split(',').filter((t) => known.includes(t)) : known;
  const SLOT = { wind: 7, thunder: 3.6, rumble: 4, megaimpact: 2.6, shing: 2.2, rifleshot: 3.6, riflecock: 2, reload: 2.5 }, DUR = { wind: 6, rumble: 3 };
  const cues = [];
  let t = 0.5;
  for (const type of types) {
    for (const weight of LEVEL_BY_WEIGHT.has(type) ? [0.5, 1] : [1]) {
      cues.push({ t: Math.round(t * 1000) / 1000, type, weight, size: type === 'wallbreak' ? weight : 'l', ...(DUR[type] ? { dur: DUR[type] } : {}), pan: 0, scene: 'audition' });
      t += SLOT[type] ?? 1.5;
    }
  }
  return { DURATION: Math.ceil(t), CUES: cues, SCENES: [{ id: 'audition', title: 'audition', start: 0, end: Math.ceil(t) }], MUSIC_HINTS: [], ACCENTS: [] };
}
const LEVEL_BY_WEIGHT = new Set(['step', 'thud', 'hit', 'block', 'clack', 'clang', 'slam', 'slice', 'heavyswing', 'inksplash', 'wallbreak']);

function writeWav(path, L, R) {
  const frames = L.length, header = Buffer.alloc(44), pcm = new Int16Array(frames * 2), rng = rngFor('dither');
  header.write('RIFF', 0); header.writeUInt32LE(36 + frames * 4, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22);
  header.writeUInt32LE(SR, 24); header.writeUInt32LE(SR * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(frames * 4, 40);
  // TPDF dither, except where the signal is exactly zero (keeps digital silence digital)
  const q = (x) => (x === 0 ? 0 : clamp(Math.round(x * 32767 + rng() - rng()), -32768, 32767));
  for (let i = 0; i < frames; i++) { pcm[2 * i] = q(L[i]); pcm[2 * i + 1] = q(R[i]); }
  const body = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  if (endianness() === 'BE') body.swap16();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.concat([header, body]));
}

function rmsDb(L, R, t0, t1) {
  const a = Math.max(0, Math.round(t0 * SR)), b = Math.min(L.length, Math.round(t1 * SR));
  let s = 0;
  for (let i = a; i < b; i++) s += L[i] * L[i] + R[i] * R[i];
  return 10 * Math.log10(Math.max(s / (2 * Math.max(1, b - a)), 1e-12));
}

async function main() {
  const t0 = performance.now();
  const real = ARGS.audition ? null : await loadSheet({ optional: Boolean(ARGS.selftest) });
  const sheet = ARGS.audition ? auditionSheet(ARGS.audition) : ARGS.selftest ? selfTestSheet(real) : real;
  if (ARGS.audition) { ARGS.solo = 'sfx'; console.log(sheet.CUES.map((c) => `${c.t.toFixed(1).padStart(6)} s  ${c.type}${LEVEL_BY_WEIGHT.has(c.type) ? ` (weight ${c.weight})` : ''}`).join('\n')); }
  DURATION = sheet.DURATION;
  if (!(DURATION > 0 && Number.isFinite(DURATION))) throw new Error(`audio: bad DURATION (${DURATION}) in src/cues.js`);
  N = Math.round(DURATION * SR);
  CUES = sheet.CUES ?? [];
  SCENES = sheet.SCENES?.length ? sheet.SCENES : [{ id: 's1', title: '', start: 0, end: DURATION }];
  MUSIC_HINTS = sheet.MUSIC_HINTS ?? [];
  ACCENTS = sheet.ACCENTS ?? [];
  if (typeof ARGS.cue === 'string') {                     // --cue=type@seconds[,…]: extra cues for testing
    const extra = ARGS.cue.split(',').map((spec) => { const [type, at] = spec.split('@'); return { t: Number(at), type, pan: 0 }; }).filter((c) => c.type && Number.isFinite(c.t));
    for (const c of extra) c.scene = SCENES.find((s) => c.t >= s.start && c.t < s.end)?.id;
    CUES = [...CUES, ...extra].sort((a, b) => a.t - b.t);
    console.log(`audio: ${extra.length} extra cue(s) from --cue: ${extra.map((c) => `${c.type} at ${c.t} s`).join(', ')}`);
  }
  const outPath = resolve(typeof ARGS.out === 'string' ? ARGS.out
    : ARGS.audition ? join(tmpdir(), 'stick-film-audition.wav')
      : ARGS.selftest ? join(tmpdir(), 'stick-film-selftest.wav') : resolve(HERE, '../out/soundtrack.wav'));

  const clock = { start: t0 }, lap = (name) => { const now = performance.now(); clock[name] = (now - (clock.last ?? t0)) / 1000; clock.last = now; };
  // engine: the generated library where it has files, the synth for the rest (or for everything)
  const engine = ARGS.engine === 'synth' ? 'synth' : 'eleven';
  if (ARGS.engine && !['synth', 'eleven'].includes(ARGS.engine)) console.warn(`audio: unknown --engine "${ARGS.engine}" — using "eleven"`);
  let library = engine === 'eleven' ? loadLibrary(SCENES.map((s) => s.id)) : null;
  if (library && !library.sfx.size && !library.music.size) {
    console.warn('audio: no generated library in assets/audio/ — using the synth for everything (run: node tools/soundlib.mjs generate)');
    library = null;
  }
  lap('library');
  const sfx = renderSfx(library); lap('sfx');
  const music = ARGS.audition ? Object.assign(makeBus(), { groove: makeBus(), pad: makeBus(), missing: new Set(SCENES.keys()) })   // effects only
    : library ? renderMusicFromLibrary(library, sfx.stops) : renderMusic();
  lap('music');
  const comp = { sfx: compress(sfx, BUS_COMP.sfx), music: compress(music, library ? BUS_COMP.libraryMusic : BUS_COMP.music) };
  const duck = duckCurve();
  for (let i = 0; i < N; i++) { music.L[i] *= duck[i]; music.R[i] *= duck[i]; }
  // nothing musical may ring into the final frame: the music bus is gone 50 ms before the end
  for (let i = Math.max(0, N - Math.round(MUSIC_END_FADE * SR)); i < N; i++) {
    const g = clamp((N - 0.05 * SR - i) / ((MUSIC_END_FADE - 0.05) * SR), 0, 1), e = g * g * (3 - 2 * g);
    music.L[i] *= e; music.R[i] *= e;
  }
  // the film's full stop: both buses are dead from the cue to the end of its scene; the cue's own bus is not
  applyStops(sfx, sfx.stops); applyStops(music, sfx.stops);
  const useSfx = ARGS.solo !== 'music', useMusic = ARGS.solo !== 'sfx';
  const mixL = new Float32Array(N), mixR = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    mixL[i] = (useSfx ? sfx.L[i] + sfx.stop.L[i] : 0) + (useMusic ? music.L[i] : 0);
    mixR[i] = (useSfx ? sfx.R[i] + sfx.stop.R[i] : 0) + (useMusic ? music.R[i] : 0);
  }
  const m = master(mixL, mixR); lap('master');
  writeWav(outPath, m.L, m.R); lap('write');

  const f = (x) => x.toFixed(1);
  console.log(`audio: ${outPath}`);
  console.log(`audio: ${ARGS.selftest ? 'SELF-TEST sheet, ' : ''}${CUES.length} cues, ${SCENES.length} scenes, ${MUSIC_HINTS.length} music hints, ${ACCENTS.length} accents`);
  console.log(library
    ? `audio: engine eleven — ${sfx.use.library} cues from the library, ${sfx.use.synth} from the synth; music from the library for ${SCENES.length - music.missing.size} of ${SCENES.length} scenes`
    : `audio: engine synth${engine === 'eleven' ? ' (fallback: empty library)' : ''}`);
  console.log(`audio: ${N} frames, ${(N / SR).toFixed(3)} s, 48 kHz stereo 16-bit`);
  console.log(`audio: ${f(m.lufs)} LUFS integrated (est.), true peak ${f(toDb(m.truePeak))} dBTP (est.), master gain ${f(toDb(m.gain))} dB, limiter max GR ${f(m.lim.gr)} dB`);
  console.log(`audio: rendered in ${((performance.now() - t0) / 1000).toFixed(1)} s`);

  if (ARGS.stats) {
    const types = {};
    for (const c of CUES) types[c.type] = (types[c.type] ?? 0) + 1;
    console.log(`\ncue types: ${Object.entries(types).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || '(none)'}`);
    console.log(library ? '\nscene                              sfx  lib.mus  syn.mus   master   (RMS dBFS; sfx / library music / synth music are pre-master)'
      : '\nscene                              sfx   groove      pad   master   (RMS dBFS; sfx/groove/pad are pre-master)');
    const rows = SCENES.map((s) => ({ s, v: [sfx, music.groove, music.pad, m].map((b) => rmsDb(b.L, b.R, s.start, s.end)) }));
    for (const { s, v } of rows) {
      console.log(`${String(s.id).padEnd(4)} ${String(s.title ?? '').slice(0, 14).padEnd(14)} ${s.start.toFixed(1).padStart(5)}-${s.end.toFixed(1).padEnd(5)}` + v.map((x) => f(x).padStart(9)).join(''));
    }
    if (rows.length >= 2) {
      const loudest = rows.reduce((a, b) => (b.v[3] > a.v[3] ? b : a)), lastRow = rows.at(-1), prev = rows.at(-2);
      console.log(`\nloudest scene: ${loudest.s.id} (${f(loudest.v[3])} dBFS). last scene ${lastRow.s.id}: ${f(lastRow.v[3])} dBFS = ${f(prev.v[3] - lastRow.v[3])} dB below ${prev.s.id}`);
    }
    console.log(`bus compressors: sfx max ${f(comp.sfx.maxGr)} dB / mean ${comp.sfx.meanGr.toFixed(2)} dB, music max ${f(comp.music.maxGr)} dB / mean ${comp.music.meanGr.toFixed(2)} dB`);
    console.log(`limiter: max GR ${f(m.lim.gr)} dB at ${m.lim.at.toFixed(3)} s, ${m.lim.active.toFixed(2)} s (${(100 * m.lim.active / DURATION).toFixed(1)} %) spent beyond 0.5 dB of reduction (per scene: ${m.lim.byScene.map((x) => x.toFixed(1)).join(' / ')} s); ${m.passes} loudness passes`);
    if (sfx.stops.length) {
      // loudest 20 ms of the finished film (5 ms steps), to compare the full stop against everything else
      const hop = 240, blocks = Math.floor(N / hop), e = new Float64Array(blocks);
      for (let k = 0; k < blocks; k++) { let a = 0; for (let i = k * hop; i < (k + 1) * hop; i++) a += m.L[i] * m.L[i] + m.R[i] * m.R[i]; e[k] = a; }
      const win = (k) => 10 * Math.log10(Math.max((e[k] + e[k + 1] + e[k + 2] + e[k + 3]) / (8 * hop), 1e-12));
      const maxIn = (t0, t1) => { let best = -200, at = 0; for (let k = Math.max(0, Math.floor(t0 * SR / hop)); k < Math.min(blocks - 3, Math.ceil(t1 * SR / hop)); k++) { const v = win(k); if (v > best) { best = v; at = k * hop / SR; } } return { best, at }; };
      for (const st of sfx.stops) {
        const a = Math.round(st.t * SR), b = Math.min(N, Math.round(st.until * SR));
        const others = peak(sfx.L.subarray(a, b), sfx.R.subarray(a, b), music.L.subarray(a, b), music.R.subarray(a, b));
        const shot = maxIn(st.t - 0.005, st.t + 0.06), before = maxIn(0, st.t - 0.05), after = maxIn(st.until, DURATION);
        const rest = before.best > after.best ? before : after;
        console.log(`full stop at ${st.t.toFixed(3)} s: every other bus ${others === 0 ? 'is digitally silent' : `peaks at ${f(toDb(others))} dBFS`} until ${st.until.toFixed(2)} s; `
          + `the shot's loudest 20 ms is ${f(shot.best)} dBFS, the loudest 20 ms anywhere else is ${f(rest.best)} dBFS (at ${rest.at.toFixed(2)} s); ${sfx.use.silenced} cue(s) fell inside the silence`);
      }
    }
    console.log(`pre-master peaks: sfx ${f(toDb(peak(sfx.L, sfx.R)))} dBFS, music ${f(toDb(peak(music.L, music.R)))} dBFS`);
    console.log(`time: sfx ${clock.sfx.toFixed(1)} s, music ${clock.music.toFixed(1)} s, master ${clock.master.toFixed(1)} s, write ${clock.write.toFixed(1)} s`);
  }
}

await main();
