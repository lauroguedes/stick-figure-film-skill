// End credits: white hand-lettering on black, with a tilted "storyboard panel" replaying short
// moments of the fight. Built like a scene (draw / duration / cues) so it sits on the film timeline.
// To change the wording or the clips, edit CARDS below.

import { EASE, clamp } from './engine/util.js';
import { line, BLACK, WHITE } from './engine/ink.js';
import { WIDTH, HEIGHT } from './engine/scene.js';

export const CREDITS_DURATION = 14;
const FONT = '"Bradley Hand", "Noteworthy", cursive';

const TITLE = { t0: 0.5, t1: 3.3, text: 'PAPER FIGHT' };
// clips: [scene id, authored scene time where the clip starts]; each plays for CLIP seconds
const CLIP = 1.6;
const CARDS = [
  { t0: 3.4, t1: 8.2, side: 'R', role: 'directed by', name: 'Lauro Guedes', clips: [['s1', 3.25], ['s2', 10.8], ['s3', 12.9]] },
  { t0: 8.3, t1: 13.1, side: 'L', role: 'animated by', name: 'Claude Fable 5.2', clips: [['s3b', 5.2], ['s4', 18.9], ['s5', 16.6]] },
];

/** Text that is "written" on from the left over `dur` seconds. */
function written(ctx, text, cx, y, size, p, max = 700) {
  ctx.font = `${size}px ${FONT}`;
  let w = ctx.measureText(text).width;
  if (w > max) { size *= max / w; ctx.font = `${size}px ${FONT}`; w = ctx.measureText(text).width; }
  const x = cx - w / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 20, y - size * 1.2, (w + 40) * clamp(p), size * 1.8);
  ctx.clip();
  ctx.fillStyle = WHITE;
  ctx.fillText(text, x, y);
  ctx.restore();
  return w;
}

export function makeCredits(scenes, makeCanvas) {
  const byId = Object.fromEntries(scenes.map((s) => [s.id, s]));
  let off = null;

  function panel(ctx, card, t) {
    const k = Math.min(card.clips.length - 1, Math.floor((t - card.t0) / CLIP));
    const [id, at] = card.clips[k];
    const sc = byId[id];
    const local = t - card.t0 - k * CLIP;
    if (!off) off = makeCanvas(WIDTH, HEIGHT);
    sc.draw(off.getContext('2d'), Math.min(sc.duration - 0.05, sc.toScreen(at) + local));
    const w = 1040, h = 585;
    const cx = card.side === 'R' ? 1310 : 610, cy = 540;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((card.side === 'R' ? 1 : -1) * 0.035);
    ctx.fillStyle = WHITE;
    ctx.fillRect(-w / 2 - 12, -h / 2 - 12, w + 24, h + 24);   // paper border
    ctx.drawImage(off, -w / 2, -h / 2, w, h);
    ctx.lineWidth = 3;
    ctx.strokeStyle = BLACK;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }

  function draw(ctx, t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = BLACK;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if (t >= TITLE.t0 && t < TITLE.t1) {
      const p = (t - TITLE.t0) / 0.7;
      const w = written(ctx, TITLE.text, WIDTH / 2, 590, 190, p, 1500);
      const u = EASE.out(clamp((t - TITLE.t0 - 0.5) / 0.5));
      if (u > 0) line(ctx, WIDTH / 2 - w / 2 - 10, 640, WIDTH / 2 - w / 2 - 10 + (w + 20) * u, 634, { w: 7, seed: 3, rough: 2.2, color: WHITE });
    }
    for (const card of CARDS) {
      if (t < card.t0 || t >= card.t1) continue;
      panel(ctx, card, t);
      const cx = card.side === 'R' ? 400 : 1520;
      written(ctx, card.role, cx, 470, 50, (t - card.t0) / 0.35);
      written(ctx, card.name, cx, 590, 104, (t - card.t0 - 0.2) / 0.6);
    }
  }

  return { id: 'credits', title: 'Credits', duration: CREDITS_DURATION, draw, cues: [], music: [], impacts: [] };
}
