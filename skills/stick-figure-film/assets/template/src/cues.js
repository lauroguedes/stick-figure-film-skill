// Film-level sound sheet, assembled from the scenes. tools/audio.mjs renders it to out/soundtrack.wav.
// All times here are FILM seconds.
//   CUES         [{ t, type, pan?, weight?, size?, dur?, gain?, scene }]
//   SCENES       [{ id, title, start, end }]                 → musical sections
//   MUSIC_HINTS  [{ from, to, mode }]  'suspend' | 'aftermath' | 'surge'
//   ACCENTS      [t, …]                times of impact frames (the biggest hits)

import { TIMELINE, DURATION } from './film.js';

export { DURATION };
export const SCENES = TIMELINE.map((e) => ({ id: e.id, title: e.title, start: e.start, end: e.end, score: e.scene.score ?? null }));

export const CUES = [];
export const MUSIC_HINTS = [];
export const ACCENTS = [];
for (const e of TIMELINE) {
  if (e.in === 'pageturn') CUES.push({ t: e.start, type: 'pageturn', dur: e.dur, pan: 0, scene: e.id });
  for (const c of e.scene.cues) {
    const { x, ...rest } = c;
    CUES.push({ ...rest, t: Math.round((c.t + e.start) * 1000) / 1000, scene: e.id });
  }
  for (const m of e.scene.music) MUSIC_HINTS.push({ from: m.from + e.start, to: m.to + e.start, mode: m.mode });
  for (const i of e.scene.impacts) ACCENTS.push(Math.round((i.t + e.start) * 1000) / 1000);
}
CUES.sort((a, b) => a.t - b.t);
ACCENTS.sort((a, b) => a - b);
