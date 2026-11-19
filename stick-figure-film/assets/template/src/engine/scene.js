// Scene builder + runtime. A scene is one continuous shot-sequence in one location, with its
// own local clock (t = 0 at the scene start). See ENGINE.md for the authoring guide.
//
//   const S = createScene({ id: 's2', title: 'Pencil City', duration: 22 });
//   S.fighters({ A: [...keys], B: [...keys] });
//   S.weapon('staff', [...keys]);
//   S.camera([...keys]);
//   S.hit({ t, x, h, size, sound, weight, impact });   // burst + sound + shake in one call
//   S.env({ far, stage, over, fore, screen, surface });
//   export default S.build();

import { pose, sample, drawFigure, drawSmear, toCanvas as C } from './rig.js';
import { FIGHTER_A, FIGHTER_B, makeTrack } from './moves.js';
import { makeCamera, applyCamera, viewBounds, worldToScreen } from './camera.js';
import { buildWeapon, weaponState, placeWeapon, drawWeapon, drawWeaponSmear } from './weapons.js';
import { drawFxList, drawSpeedLines, drawFocusLines } from './fx.js';
import { drawPage, drawShadow, drawSkids, drawBulletHoles, DEFAULT_PAGE } from './kit.js';
import { clamp, prog, EASE, lerp } from './util.js';
import { BLACK, WHITE } from './ink.js';

export const WIDTH = 1920;
export const HEIGHT = 1080;

export function createScene(cfg) {
  const sc = {
    id: cfg.id, title: cfg.title || cfg.id, duration: cfg.duration, score: cfg.score ?? null,
    page: cfg.page === false ? null : { ...DEFAULT_PAGE, ...(cfg.page || {}) },
    pageOpts: cfg.pageOpts || {},
    anchor: cfg.anchor || [1100, -265],
    desk: cfg.desk || BLACK,
    weapons: [], camKeys: null, shakes: [], impacts: [], fx: [], cues: [], skids: [], slowmo: [], music: [],
    holes: [], shots: [], bullets: [],
    env: {}, poses: cfg.poses || {},
  };
  let keysA = null, keysB = null;

  const S = {
    /**
     * Pose keys for the characters (see rig.js / moves.js). First key at t=0, last at t >= duration.
     * B is optional: omit it for a one-character film (B then exists but is never drawn, and the
     * camera's `b` weight and the lint ignore it).
     */
    fighters({ A, B }) { keysA = A; keysB = B ?? null; return S; },
    /** A weapon track (see weapons.js). */
    weapon(id, keys) { sc.weapons.push(buildWeapon(id, keys)); return S; },
    /** Camera keys (see camera.js). */
    camera(keys) { sc.camKeys = keys; return S; },
    /** Camera shake: amp in screen px, decaying over dur seconds. */
    shake(t, amp, dur = 0.25) { sc.shakes.push({ t, amp, dur }); return S; },
    /** Impact frame: the whole frame flips to white-on-black for dur seconds. Use for the BIG hits only. */
    impact(t, dur = 0.07) { sc.impacts.push({ t, dur }); return S; },
    /** Raw FX event (see fx.js). */
    fx(e) { sc.fx.push(e); return S; },
    /** Raw sound cue: { t, type, x? (world x → auto pan), weight?, size?, dur?, gain? }. */
    cue(c) { sc.cues.push(c); return S; },
    /** Persistent skid marks + scrape sound. */
    skid({ t0, t1, x0, x1, y = 0, sound = true }) {
      sc.skids.push({ t0, t1, x0, x1, y, seed: sc.skids.length + 1 });
      if (sound) sc.cues.push({ t: t0, type: 'skid', dur: Math.max(0.12, t1 - t0), x: x0 });
      return S;
    },
    /** Slow-motion look (focus lines) between t0 and t1 around focus(state) → [worldX, height]. Also marks a music "suspend". */
    slowmo(t0, t1, focus, o = {}) {
      sc.slowmo.push({ t0, t1, focus });
      if (o.sound !== false) sc.cues.push({ t: t0 - 0.03, type: 'slowdown', dur: t1 - t0 + 0.03 });
      if (o.music !== false) sc.music.push({ from: t0 - 0.03, to: t1 + 0.04, mode: 'suspend' });
      return S;
    },
    /**
     * Bullet-time close-up: at scene time `at` the action almost freezes for `hold` seconds of screen
     * time (only `span` seconds of action elapse) while the camera cuts in tight on the fighters with
     * moving close-up shots (push-in, roll, slide, whip between subjects), then time snaps back.
     * The scene gets longer by hold − span; everything authored after `at` shifts automatically.
     *   on: 'A' | 'B' | 'mid'   z: close-up zoom (2.6–3.4 for one fighter)   dy: frame higher (−) / lower (+)
     *   shots: optional list of sub-shots played across the hold, each
     *          { on, z, roll: [deg0, deg1], slide: [dx0, dx1], dy, push: 0.16, frac: 1, cut: false }
     *          (default: a rolling push-in on `on`, then a whip to the other fighter's close-up)
     * Place it just BEFORE a contact (wind-up, mid-flip, mid-leap), never across an impact frame.
     */
    bulletTime(o) { sc.bullets.push({ span: 0.25, hold: 2, on: 'A', z: 2.9, dy: 0, ramp: 0.18, ...o }); return S; },

    /** Music hint for a passage: mode = 'suspend' (near silence) | 'aftermath' (groove stops, drone) | 'surge' (push harder). */
    musicHint(from, to, mode) { sc.music.push({ from, to, mode }); return S; },

    // ── combined helpers: picture + sound + shake stay in sync by construction ──
    /**
     * A contact. Adds the impact burst, the sound, and a camera shake.
     *   sound:  'hit' (body) | 'block' | 'clack' (wood) | 'clang' (metal) | 'slam' (heavy weapon on ground/wall) | null
     *   weight: 0..1 loudness/size of the sound       size: visual size of the burst (0.5 light … 3 huge)
     *   impact: true → also an impact frame           ring: true → shock ring on the floor
     *   sparks: defaults to true for clang/clack       shock: true → round shock ring in the air
     */
    hit(o) {
      const { t, x, h = 120, size = 1, sound = 'hit', weight = 0.6, impact = false, ring = false, shock = false } = o;
      const sparks = o.sparks ?? (sound === 'clang' || sound === 'clack');
      sc.fx.push({ t, type: 'burst', x, h, size });
      if (sparks) sc.fx.push({ t, type: 'sparks', x, h, size: Math.max(0.6, size * 0.8), n: 8 + Math.round(size * 5) });
      if (ring) sc.fx.push({ t, type: 'ring', x, h: o.ringH ?? 0, size: size * 0.7 });
      if (shock) sc.fx.push({ t, type: 'shock', x, h, size });
      if (sound) sc.cues.push({ t, type: sound, weight, x });
      const amp = o.shake ?? Math.round(4 + 14 * weight * Math.min(2.2, size));
      if (amp > 0) sc.shakes.push({ t, amp, dur: 0.12 + 0.2 * weight });
      if (impact) sc.impacts.push({ t, dur: typeof impact === 'number' ? impact : 0.07 });
      return S;
    },
    /** A landing: dust + thud (+ shake when heavy). h = height of the surface landed on. */
    land({ t, x, h = 0, weight = 0.5, dir = 0 }) {
      sc.fx.push({ t, type: 'dust', x, h, n: 3 + Math.round(weight * 6), size: 0.6 + weight * 0.6, dir });
      sc.cues.push({ t, type: weight > 0.85 ? 'stomp' : 'thud', weight, x });
      if (weight > 0.3) sc.shakes.push({ t, amp: Math.round(3 + weight * 10), dur: 0.2 });
      return S;
    },
    /** A footfall: small dust + step sound. */
    step({ t, x, h = 0, weight = 0.5, dir = 0 }) {
      sc.fx.push({ t, type: 'dust', x, h, n: 3, size: 0.5 + weight * 0.3, dir });
      sc.cues.push({ t, type: 'step', weight, x });
      if (weight > 0.55) sc.shakes.push({ t, amp: Math.round(weight * 7), dur: 0.1 });
      return S;
    },
    /** Movement / swing sound. size: 's' | 'm' | 'l'; heavy: true → deep heavy-weapon swing. */
    whoosh({ t, x, size = 'm', dur, heavy = false }) {
      sc.cues.push({ t, type: heavy ? 'heavyswing' : 'whoosh', size, dur: dur ?? { s: 0.1, m: 0.18, l: 0.3 }[size], x, weight: { s: 0.4, m: 0.7, l: 1 }[size] });
      return S;
    },

    /**
     * Fire a gun. The muzzle is read from the weapon's solved tip at time t, so the flash always
     * sits on the barrel — aim by posing the hand and the weapon `ang`, then give the point the
     * bullet reaches (probe the line of fire; `to` should lie along the barrel direction).
     *   weapon: weapon id (a 'pistol')         to: [worldX, height] where the bullet ends up
     *   hit: 'page'  punches a persistent bullet hole through the paper (black desk shows) — default
     *        'spark' ricochet off something hard (blade, brick, ruler): sparks + ricochet sound, no hole
     *        'prop'  thud + scraps, no hole (you draw the prop's damage yourself in an env hook)
     *        'none'  flies off-page
     *   r: hole radius (default 13)   size: flash / kick size (default 1)   sound: false to mute
     *   slug: [t0, t1] also draws a visible ink slug travelling to → for slow-motion bullet time
     *         (then the hole / sparks appear at t1 instead of t + 0.04)
     * Adds: muzzle flash, tracer streak, ejected casing, smoke puff, gunshot + casing sounds, shake.
     */
    shot(o) { sc.shots.push(o); return S; },
    /** A persistent bullet hole without a shot (stray damage). { t, x, h, r } */
    hole(o) { sc.holes.push({ r: 13, ...o, seed: 700 + sc.holes.length * 17 }); return S; },

    /** Environment hooks, all optional: (ctx, t, E) => void, E = { cam, px, vb, impact, st, W, H }. */
    env(hooks) { Object.assign(sc.env, hooks); return S; },

    build() {
      if (!keysA) throw new Error(`[${sc.id}] fighters() not set`);
      if (!keysB) {
        sc.solo = true;
        keysB = [{ t: 0, p: 'stand', x: -1e5, face: 1, reveal: 0 }, { t: sc.duration + 1, p: 'stand', reveal: 0 }];
      }
      if (!sc.camKeys) throw new Error(`[${sc.id}] camera() not set`);
      for (const [n, k] of [['A', keysA], ['B', keysB], ['camera', sc.camKeys]]) {
        if (k[0].t !== 0) console.warn(`[${sc.id}] ${n}: first key must be at t=0 (is ${k[0].t})`);
        if (k[k.length - 1].t < sc.duration) console.warn(`[${sc.id}] ${n}: last key (${k[k.length - 1].t}) ends before the scene (${sc.duration})`);
      }
      sc.trackA = makeTrack(FIGHTER_A, keysA, sc.poses);
      sc.trackB = makeTrack(FIGHTER_B, keysB, sc.poses);
      const hipA = (t) => sample(sc.trackA, t).hip, hipB = sc.solo ? hipA : (t) => sample(sc.trackB, t).hip;
      sc.camera = makeCamera(sc.camKeys, sc.shakes, hipA, hipB);
      const rt = makeRuntime(sc);
      // resolve shots against the solved weapon positions
      for (const o of sc.shots) {
        const st = rt.state(o.t).weapons.find((w) => w.id === o.weapon);
        if (!st) { console.warn(`[${sc.id}] shot at t=${o.t}: weapon "${o.weapon}" is not on screen`); continue; }
        const from = st.tip, to = o.to, size = o.size ?? 1;
        const ang = Math.atan2(to[1] - from[1], to[0] - from[0]);
        const aim = Math.atan2(st.tip[1] - st.tail[1], st.tip[0] - st.tail[0]);
        let off = Math.abs(ang - aim) % (2 * Math.PI); if (off > Math.PI) off = 2 * Math.PI - off;
        if (off > 0.14) console.warn(`[${sc.id}] shot at t=${o.t}: target is ${(off * 57.3).toFixed(0)}° off the barrel line (muzzle [${from[0].toFixed(0)}, ${from[1].toFixed(0)}], barrel ${(aim * 57.3).toFixed(0)}°)`);
        const tHit = o.slug ? o.slug[1] : o.t + 0.04;
        const hit = o.hit ?? 'page';
        sc.fx.push({ t: o.t, type: 'muzzle', x: from[0], h: from[1], ang, size });
        sc.fx.push({ t: o.t, type: 'casing', x: st.tail[0] * 0.6 + from[0] * 0.4, h: (st.tail[1] + from[1]) / 2 + 6, dir: Math.cos(ang) > 0 ? -1 : 1 });
        sc.fx.push({ t: o.t + 0.03, type: 'dust', x: from[0] + Math.cos(ang) * 14, h: from[1] - 4, n: 3, size: 0.5 * size });
        if (o.slug) sc.fx.push({ t: o.slug[0], type: 'slug', x: from[0], h: from[1], x2: to[0], h2: to[1], life: o.slug[1] - o.slug[0] });
        else sc.fx.push({ t: o.t, type: 'tracer', x: from[0], h: from[1], x2: to[0], h2: to[1] });
        if (hit === 'page') {
          sc.holes.push({ t: tHit, x: to[0], h: to[1], r: o.r ?? 13, seed: 700 + sc.holes.length * 17 });
          sc.fx.push({ t: tHit, type: 'scraps', x: to[0], h: to[1], n: 5, life: 0.7 });
          sc.fx.push({ t: tHit, type: 'burst', x: to[0], h: to[1], size: 0.45 });
          if (o.sound !== false) sc.cues.push({ t: tHit, type: 'bulletimpact', weight: 0.6, x: to[0] });
        } else if (hit === 'spark') {
          sc.fx.push({ t: tHit, type: 'sparks', x: to[0], h: to[1], size: 1, n: 12 });
          sc.fx.push({ t: tHit, type: 'burst', x: to[0], h: to[1], size: 0.5 });
          if (o.sound !== false) sc.cues.push({ t: tHit, type: 'ricochet', weight: 0.8, x: to[0] });
        } else if (hit === 'prop') {
          sc.fx.push({ t: tHit, type: 'scraps', x: to[0], h: to[1], n: 7, life: 0.8 });
          sc.fx.push({ t: tHit, type: 'burst', x: to[0], h: to[1], size: 0.6 });
          if (o.sound !== false) sc.cues.push({ t: tHit, type: 'bulletimpact', weight: 0.9, x: to[0] });
        }
        if (o.sound !== false) {
          sc.cues.push({ t: o.t, type: 'gunshot', weight: Math.min(1, 0.8 * size), x: from[0] });
          sc.cues.push({ t: o.t + 0.32, type: 'shell', x: from[0] });
        }
        sc.shakes.push({ t: o.t, amp: Math.round(9 * size), dur: 0.14 });
      }
      sc.cues.sort((a, b) => a.t - b.t);
      for (const c of sc.cues) {
        if (c.t < 0 || c.t > sc.duration) console.warn(`[${sc.id}] cue "${c.type}" at t=${c.t} is outside the scene`);
        if (c.pan == null && c.x != null) {
          const cam = sc.camera(c.t);
          c.pan = Math.round(clamp(((c.x - cam.x) * cam.z) / 960, -1, 1) * 70) / 100;
        }
      }
      // bullet-time inserts stretch the scene: publish everything in SCREEN time
      sc.bullets.sort((a, b) => a.at - b.at);
      let shift = 0;
      for (const b of sc.bullets) { b.s0 = b.at + shift; shift += b.hold - b.span; }
      const scr = rt.toScreen;
      const r3 = (v) => Math.round(v * 1000) / 1000;
      rt.duration = r3(sc.duration + shift);
      rt.cues = sc.cues.map((c) => ({ ...c, t: r3(scr(c.t)) }));
      rt.music = sc.music.map((m) => ({ ...m, from: scr(m.from), to: scr(m.to) }));
      rt.impacts = sc.impacts.map((i) => ({ ...i, t: r3(scr(i.t)) }));
      for (const b of sc.bullets) {
        rt.cues.push({ t: r3(b.s0), type: 'slowdown', dur: b.hold, pan: 0 });
        rt.cues.push({ t: r3(b.s0 + b.hold * 0.42), type: 'heartbeat', pan: 0 });
        rt.cues.push({ t: r3(b.s0 + b.hold - 0.3), type: 'riser', dur: 0.3, pan: 0 });
        rt.music.push({ from: b.s0 - 0.03, to: b.s0 + b.hold, mode: 'suspend' });
      }
      rt.cues.sort((a, b) => a.t - b.t);
      return rt;
    },
  };
  return S;
}

const smooth01 = (v) => { const k = clamp(v); return k * k * (3 - 2 * k); };
const curve = (u) => { const v = 2 * u - 1; return 0.5 + 0.5 * Math.sign(v) * Math.abs(v) ** 3; };       // fast → frozen → fast
const curveInv = (f) => { const w = 2 * f - 1; return 0.5 + 0.5 * Math.sign(w) * Math.abs(w) ** (1 / 3); };

function makeRuntime(sc) {
  const memo = new Map();

  // screen time ↔ action (authored) time, through the bullet-time inserts
  function toAction(t) {
    let off = 0;
    for (const b of sc.bullets) {
      if (b.s0 == null || t < b.s0) break;
      if (t < b.s0 + b.hold) return b.at + b.span * curve((t - b.s0) / b.hold);
      off += b.hold - b.span;
    }
    return t - off;
  }
  function toScreen(tau) {
    let off = 0;
    for (const b of sc.bullets) {
      if (b.s0 == null || tau < b.at) break;
      if (tau < b.at + b.span) return b.s0 + b.hold * curveInv((tau - b.at) / b.span);
      off += b.hold - b.span;
    }
    return tau + off;
  }
  const centre = (J) => [(J.hip[0] + J.head[0]) / 2, (J.hip[1] + J.head[1]) / 2];
  const focusOf = (st, on) => {
    if (typeof on === 'function') { const v = on(st); return Array.isArray(v) ? v : [v, 120]; }
    if (typeof on === 'number') return [on, 120];
    const a = centre(st.A), b = centre(st.B);
    return on === 'A' ? a : on === 'B' ? b : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  };
  // sub-shots of a bullet-time close-up: each one keeps moving (push-in, roll, slide)
  const defaultShots = (b) => {
    const other = b.on === 'A' ? 'B' : 'A';
    if (b.on === 'mid') return [
      { on: 'A', z: b.z * 1.5, roll: [-7, 4], slide: [-24, 18] },
      { on: 'B', z: b.z * 1.5, roll: [6, -5], slide: [24, -18] },
      { on: 'mid', z: b.z, roll: [4, -3], push: 0.1, frac: 1.15 },
    ];
    return [
      { on: b.on, roll: [-8, 5], slide: [-36, 24], frac: 1.3 },
      { on: other, z: b.z * 0.9, roll: [7, -4], slide: [30, -22] },
    ];
  };
  function closeUp(b, st, u) {
    const shots = b.shots || defaultShots(b);
    const total = shots.reduce((n, x) => n + (x.frac || 1), 0);
    let acc = 0, k = 0, q = 0, f = 1;
    for (k = 0; k < shots.length; k++) {
      f = (shots[k].frac || 1) / total;
      if (u < acc + f || k === shots.length - 1) { q = clamp((u - acc) / f); break; }
      acc += f;
    }
    const frame = (sh, qq) => {
      const p = focusOf(st, sh.on ?? b.on), roll = sh.roll || [0, 0], slide = sh.slide || [0, 0];
      return {
        x: p[0] + lerp(slide[0], slide[1], qq), y: -p[1] + (sh.dy ?? b.dy),
        z: (sh.z ?? b.z) * (1 + (sh.push ?? 0.16) * EASE.out(qq)), r: lerp(roll[0], roll[1], qq),
      };
    };
    let c = frame(shots[k], q);
    const whip = 0.17 / (b.hold * f); // whip-pan in from the previous sub-shot
    if (k > 0 && q < whip && !shots[k].cut) {
      const p = frame(shots[k - 1], 1), w = EASE.io(q / whip);
      c = { x: lerp(p.x, c.x, w), y: lerp(p.y, c.y, w), z: Math.exp(lerp(Math.log(p.z), Math.log(c.z), w)), r: lerp(p.r, c.r, w) };
    }
    return c;
  }
  /** The camera actually used at screen time t: scene camera + bullet-time close-ups. */
  function finalCamera(t) {
    const tau = toAction(t);
    const cam = { ...sc.camera(tau) };
    for (const b of sc.bullets) {
      if (b.s0 == null || t <= b.s0 || t >= b.s0 + b.hold) continue;
      const u = (t - b.s0) / b.hold;
      const w = EASE.out(clamp(Math.min((t - b.s0) / b.ramp, (b.s0 + b.hold - t) / b.ramp)));
      const c = closeUp(b, state(tau), u);
      cam.x = lerp(cam.x, c.x, w);
      cam.y = lerp(cam.y, c.y, w);
      cam.z = Math.exp(lerp(Math.log(cam.z), Math.log(c.z), w));
      cam.r = lerp(cam.r, c.r, w);
      cam.sx += Math.sin(t * 5.1) * 4 * w;   // a breath of handheld drift
      cam.sy += Math.sin(t * 6.7 + 1) * 3 * w;
    }
    return cam;
  }

  /** Both fighters + all visible weapons, fully solved (world space, y up), at AUTHORED scene time. */
  function state(t) {
    const key = Math.round(t * 1e5);
    const hit = memo.get(key);
    if (hit) return hit;
    let A = pose(sc.trackA, t), B = pose(sc.trackB, t);
    const W = [];
    for (const w of sc.weapons) {
      const st = weaponState(w, t);
      if (st) W.push(st);
    }
    // two-handed grips: move the holder's back hand onto the weapon
    for (const st of W) {
      if (!st.by || st.hand === 'B' || st.two <= 0.01) continue;
      const J = st.by === 'A' ? A : B;
      placeWeapon(st, J.hF, J.face);
      const fixed = pose(st.by === 'A' ? sc.trackA : sc.trackB, t, { hB: st.grip2, wB: st.two });
      if (st.by === 'A') A = fixed; else B = fixed;
    }
    for (const st of W) {
      if (st.by) {
        const J = st.by === 'A' ? A : B;
        placeWeapon(st, st.hand === 'B' ? J.hB : J.hF, J.face);
      } else placeWeapon(st);
    }
    const out = { A, B, weapons: W };
    if (memo.size > 400) memo.clear();
    memo.set(key, out);
    return out;
  }

  function draw(ctx, screenT, o = {}) {
    const W = WIDTH, H = HEIGHT;
    const t = toAction(screenT); // everything below runs on action time
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = sc.desk;
    ctx.fillRect(0, 0, W, H);

    const cam = o.cam ? { sx: 0, sy: 0, r: 0, ...o.cam } : finalCamera(screenT);
    const px = 1 / cam.z;
    const vb = viewBounds(cam, W, H);
    const impact = sc.impacts.some((i) => t >= i.t - 1e-6 && t < i.t + i.dur);
    const st = state(t);
    const prev = state(t - 1 / 60);
    const { A, B } = st;
    const E = { t, cam, px, vb, impact, st, W, H, anchor: sc.anchor, holes: sc.holes };
    const env = sc.env;
    const layer = (parallax, fn, depth = 0) => {
      if (!fn) return;
      ctx.save();
      applyCamera(ctx, cam, W, H, parallax, sc.anchor, depth);
      fn(ctx, t, E);
      ctx.restore();
    };

    // page
    layer(1, (c) => {
      if (env.page) env.page(c, t, E);
      else if (sc.page) drawPage(c, sc.page, vb, px, sc.pageOpts);
    }, -220);
    layer(0.72, env.far2, -900);   // deepest background
    layer(0.86, env.far, -480);    // background doodles / skyline

    // stage
    ctx.save();
    applyCamera(ctx, cam, W, H, 1, sc.anchor);
    if (env.stage) env.stage(ctx, t, E);
    drawSkids(ctx, sc.skids, t);
    if (sc.holes.length && !env.ownHoles) drawBulletHoles(ctx, sc.holes, t);

    for (const [J, seed] of [[A, 61], [B, 67]]) {
      if (J.reveal < 1) continue;
      const surf = env.surface ? env.surface(J.hip[0], t, J) : 0;
      if (surf == null) continue;
      const lift = Math.max(0, Math.min(J.fF[1], J.fB[1]) - surf);
      const half = clamp(Math.abs(J.fF[0] - J.fB[0]) / 2 + 26 * J.s, 34 * J.s, 96 * J.s);
      const mid = (J.fF[0] + J.fB[0]) / 2;
      drawShadow(ctx, mid * 0.6 + J.hip[0] * 0.4, -surf, half, lift, seed + Math.floor(t * 10) % 2);
    }

    drawFxList(ctx, sc.fx, t, 'back');
    for (const w of st.weapons) if (!w.by) drawWeapon(ctx, w);
    if (env.mid) env.mid(ctx, t, E); // behind the fighters, in front of dust

    for (const [J, P, s, seed] of [[A, prev.A, FIGHTER_A.scale, 5], [B, prev.B, FIGHTER_B.scale, 9]]) {
      if (J.reveal < 1) continue;
      drawSpeedLines(ctx, C(J.hip), [(J.hip[0] - P.hip[0]) * 60, -(J.hip[1] - P.hip[1]) * 60], s, t, seed);
    }

    const order = env.order ? env.order(t) : 'BA'; // who is drawn first (= further back)
    for (const who of order) {
      const J = st[who], ch = who === 'A' ? FIGHTER_A : FIGHTER_B;
      const mine = st.weapons.filter((w) => w.by === who);
      if (J.reveal >= 1) drawSmear(ctx, (tt) => state(tt)[who], t, ch);
      for (const w of mine) drawWeaponSmear(ctx, (tt) => state(tt).weapons.find((q) => q.id === w.id && q.by === who), t);
      drawFigure(ctx, J, ch);
      for (const w of mine) {
        drawWeapon(ctx, w);
        // re-ink the gripping hand(s) so the grip reads
        ctx.fillStyle = BLACK;
        const hands = [w.hand === 'B' ? J.hB : J.hF];
        if (w.two > 0.6 && w.hand !== 'B') hands.push(J.hB);
        for (const h of hands) {
          ctx.beginPath();
          ctx.arc(h[0], -h[1], Math.max(4.4, ch.fist), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    for (const w of st.weapons) if (!w.by) drawWeaponSmear(ctx, (tt) => state(tt).weapons.find((q) => q.id === w.id && !q.by), t);

    if (env.over) env.over(ctx, t, E); // in front of the fighters (flying debris…)
    drawFxList(ctx, sc.fx, t, 'front');
    ctx.restore();

    layer(1.28, env.fore, 380);   // foreground silhouettes

    // screen space
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const s of sc.slowmo) {
      if (t <= s.t0 - 0.05 || t >= s.t1 + 0.04) continue;
      const k = Math.min(prog(t, s.t0 - 0.05, s.t0 + 0.25), 1 - prog(t, s.t1 - 0.06, s.t1 + 0.04));
      const f = s.focus(st);
      drawFocusLines(ctx, t, W, H, worldToScreen(cam, W, H, [f[0], -f[1]]), EASE.out(clamp(k)));
    }
    if (env.screen) env.screen(ctx, t, E);

    if (impact) {
      ctx.globalCompositeOperation = 'difference';
      ctx.fillStyle = WHITE;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  return {
    id: sc.id, title: sc.title, duration: sc.duration, score: sc.score, solo: !!sc.solo,
    surface: sc.env.surface || null,
    // draw / camera / duration / cues are in SCREEN time; state(t) stays in authored (action) time so
    // scene hooks can keep sampling it. They only differ when the scene uses bulletTime — convert
    // with toAction(screenT) / toScreen(actionT).
    state, draw, camera: finalCamera, toScreen, toAction,
    cues: sc.cues, music: sc.music, impacts: sc.impacts, slowmo: sc.slowmo, holes: sc.holes,
  };
}
