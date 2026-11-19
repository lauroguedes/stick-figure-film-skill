// Weapons: specs, key tracks (held / free-flying / planted in the world) and ink drawing.
//
// A weapon track is a list of keys, each either HELD or FREE:
//   held: { t, by: 'A'|'B', ang, g?, two?, hand?: 'F'|'B', e? }
//         ang  world angle of tail→tip in degrees (0 = pointing right, 90 = up). Keep it CONTINUOUS
//              across keys (a full twirl is +360), it is interpolated numerically.
//         g    where the main hand grips, 0 = tail/pommel … 1 = tip (default from the spec)
//         two  0..1 — second hand on the weapon (the rig moves the fighter's hB onto it)
//   free: { t, at: [worldX, height], ang, hop?, e? }   `at` is the weapon's CENTER. hop adds a
//         parabolic arc between two free keys (thrown / knocked away / falling weapons).
//   any key may also set: type (morph, e.g. pencil → staff), scale (interpolated), ink (0|1,
//   ink-forged: solid black), gone: true (weapon disappears from this key on),
//   flip: true|false — mirror an asymmetric weapon (axe, pistol) across its axis. By default they
//   mirror automatically when the holder faces left, so the axe blade leads and the pistol grip hangs down.
// Between two keys with the same holder everything interpolates; when the holder changes the
// earlier key holds until the later one starts — so make the hand and weapon meet at that key.
// The weapon is invisible before its first key.

import { DEG, TAU, EASE, clamp, lerp, segIndex } from './util.js';
import { stroke, sketchPoly, hatch, line, BLACK, WHITE } from './ink.js';

// len in world units at scale 1; spread = distance between the two hands as a fraction of len.
export const WEAPONS = {
  pencil: { len: 210, g: 0.5, spread: 0.24, mass: 1 },
  staff: { len: 210, g: 0.5, spread: 0.24, mass: 1 },
  baton: { len: 96, g: 0.2, spread: 0.2, mass: 0.6 },
  knife: { len: 64, g: 0.17, spread: 0, mass: 0.4 },
  shortsword: { len: 112, g: 0.11, spread: 0.1, mass: 0.8 },
  longsword: { len: 178, g: 0.1, spread: 0.09, mass: 1.4 },
  spear: { len: 290, g: 0.4, spread: 0.24, mass: 1.6 },
  ruler: { len: 250, g: 0.4, spread: 0.24, mass: 1.2 },
  axe: { len: 196, g: 0.3, spread: 0.26, mass: 2.4, asym: true },
  hammer: { len: 214, g: 0.3, spread: 0.26, mass: 3 },
  greatsword: { len: 300, g: 0.1, spread: 0.07, mass: 3 },
  // firearm: the axis tail→tip is the line of fire; the muzzle is the tip (see S.shot in scene.js)
  pistol: { len: 74, g: 0.1, spread: 0.12, mass: 0.5, asym: true },
  // long gun: main hand at the grip, support hand FORWARD on the fore-end (negative spread)
  rifle: { len: 176, g: 0.3, spread: -0.3, mass: 1.6, asym: true },
};

export function buildWeapon(id, keys) {
  const K = keys.map((k) => ({ ...k }));
  let prev = { type: 'staff', scale: 1, ink: 0, ang: 0, two: 0, hand: 'F' };
  for (const k of K) {
    for (const f of ['type', 'scale', 'ink', 'ang', 'hand', 'flip']) if (k[f] == null) k[f] = prev[f];
    if (!WEAPONS[k.type]) console.warn(`[weapon ${id}] unknown type "${k.type}"`);
    if (k.by) {
      if (k.g == null) k.g = prev.by === k.by && prev.g != null ? prev.g : WEAPONS[k.type].g;
      if (k.two == null) k.two = prev.by === k.by ? prev.two : 0;
    }
    if (!k.by && !k.at && !k.gone) console.warn(`[weapon ${id}] key at t=${k.t} needs "by" or "at"`);
    prev = k;
  }
  return { id, keys: K };
}

/** Interpolated weapon state at t, or null when the weapon is not on screen. */
export function weaponState(w, t) {
  const K = w.keys;
  if (t < K[0].t) return null;
  let i = K.length - 1;
  if (t < K[i].t) i = segIndex(K, t);
  const a = K[i], b = K[i + 1];
  if (a.gone) return null;
  const spec = WEAPONS[a.type] || WEAPONS.staff;
  const st = { id: w.id, type: a.type, by: a.by || null, hand: a.hand, ang: a.ang, g: a.g, two: a.two || 0, scale: a.scale, ink: a.ink, at: a.at, flip: a.flip, spec };
  if (!b || b.gone) return st;
  const u = (EASE[b.e] || EASE.io)(clamp((t - a.t) / (b.t - a.t)));
  if (a.by && b.by === a.by && b.hand === a.hand) {
    st.ang = lerp(a.ang, b.ang, u);
    st.g = lerp(a.g, b.g, u);
    st.two = lerp(a.two || 0, b.two || 0, u);
    st.scale = lerp(a.scale, b.scale, u);
  } else if (!a.by && !b.by && b.at) {
    const raw = clamp((t - a.t) / (b.t - a.t));
    const ur = (EASE[b.e || 'lin'])(raw);
    st.at = [lerp(a.at[0], b.at[0], ur), lerp(a.at[1], b.at[1], ur) + (b.hop ? b.hop * 4 * raw * (1 - raw) : 0)];
    st.ang = lerp(a.ang, b.ang, ur);
    st.scale = lerp(a.scale, b.scale, ur);
  }
  return st;
}

/** Fill in tail/tip (world, y up). `hand` is the gripping hand position for held weapons. */
export function placeWeapon(st, hand, face = 1) {
  // asymmetric weapons mirror with the holder (or, when free, with which way they point)
  if (st.spec.asym) st.mirror = st.flip != null ? !!st.flip : st.by ? face < 0 : Math.cos(st.ang * DEG) < 0;
  const L = st.spec.len * st.scale;
  const a = st.ang * DEG;
  const d = [Math.cos(a), Math.sin(a)];
  if (st.by) {
    st.tail = [hand[0] - d[0] * L * st.g, hand[1] - d[1] * L * st.g];
    st.tip = [hand[0] + d[0] * L * (1 - st.g), hand[1] + d[1] * L * (1 - st.g)];
    st.grip2 = [hand[0] - d[0] * L * st.spec.spread, hand[1] - d[1] * L * st.spec.spread];
  } else {
    st.tail = [st.at[0] - d[0] * L / 2, st.at[1] - d[1] * L / 2];
    st.tip = [st.at[0] + d[0] * L / 2, st.at[1] + d[1] * L / 2];
  }
  return st;
}

// ── drawing ──────────────────────────────────────────────────────────────────
// Each weapon is drawn in its own frame: x runs from the tail (0) to the tip (len), y across.

function poly(ctx, pts, fill, w, seed, haloW) {
  if (haloW) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.lineWidth = haloW; ctx.strokeStyle = WHITE; ctx.lineJoin = 'round'; ctx.stroke();
    return;
  }
  sketchPoly(ctx, pts, { w, seed, fill, rough: 0.5 });
}
const shaft = (ctx, a, b, w, halo) => stroke(ctx, [[a, 0], [b, 0]], halo ? w + 9 : w, halo ? WHITE : BLACK);

const DRAW = {
  staff(ctx, L, o) { shaft(ctx, 0, L, 6.8, o.halo); },
  baton(ctx, L, o) { shaft(ctx, 0, L, 7.4, o.halo); },
  pencil(ctx, L, o) {
    const hw = 7.5;
    if (o.halo) { shaft(ctx, 0, L, hw * 2 - 1, true); return; }
    const body = [[30, -hw], [L - 26, -hw], [L - 26, hw], [30, hw]];
    sketchPoly(ctx, body, { w: 2.2, seed: 500, fill: WHITE, rough: 0.6 });
    line(ctx, 34, hw * 0.25, L - 30, hw * 0.25, { w: 1.3, seed: 501, rough: 0.5 });
    hatch(ctx, [[30, hw * 0.3], [L - 26, hw * 0.3], [L - 26, hw], [30, hw]], { angle: 62, gap: 7, w: 1.1, seed: 502 });
    sketchPoly(ctx, [[30, -hw], [0, 0], [30, hw]], { w: 2, seed: 503, fill: WHITE, rough: 0.5 });
    ctx.fillStyle = BLACK;
    ctx.beginPath(); ctx.moveTo(11, -hw * 0.37); ctx.lineTo(0, 0); ctx.lineTo(11, hw * 0.37); ctx.fill();
    const fer = [[L - 26, -hw], [L - 12, -hw], [L - 12, hw], [L - 26, hw]];
    sketchPoly(ctx, fer, { w: 2, seed: 504, fill: WHITE, rough: 0.4 });
    hatch(ctx, fer, { angle: 90, gap: 3.4, w: 1.1, seed: 505, skip: 0 });
    sketchPoly(ctx, [[L - 12, -hw], [L - 2, -hw * 0.9], [L, 0], [L - 2, hw * 0.9], [L - 12, hw]], { w: 2, seed: 506, fill: WHITE, rough: 0.4 });
  },
  knife(ctx, L, o) {
    const blade = [[22, -5], [50, -5], [L, 2.5], [22, 5]];
    shaft(ctx, 0, 22, 6.2, o.halo);
    poly(ctx, blade, o.fill, 2, 510, o.halo && 9);
    if (!o.halo) stroke(ctx, [[22, -8], [22, 8]], 3.6);
  },
  shortsword(ctx, L, o) { sword(ctx, L, o, { grip: 24, guard: 14, hw: 5.6, taper: 15, gw: 4.6 }); },
  longsword(ctx, L, o) { sword(ctx, L, o, { grip: 34, guard: 21, hw: 6.4, taper: 20, gw: 5.2 }); },
  greatsword(ctx, L, o) { sword(ctx, L, o, { grip: 52, guard: 42, hw: 17, taper: 40, gw: 9, great: true }); },
  spear(ctx, L, o) {
    shaft(ctx, 0, L - 44, 5.6, o.halo);
    const head = [[L - 48, 0], [L - 32, -11], [L, 0], [L - 32, 11]];
    poly(ctx, head, o.fill, 2.2, 520, o.halo && 9);
    if (!o.halo) {
      stroke(ctx, [[L - 48, -8], [L - 48, 8]], 3.4);
      hatch(ctx, [[L - 48, 0], [L, 0], [L - 32, 11]], { angle: 60, gap: 3.6, w: 1, seed: 521, color: o.detail });
    }
  },
  ruler(ctx, L, o) {
    const body = [[0, -9], [L, -9], [L, 9], [0, 9]];
    poly(ctx, body, o.fill, 2.2, 530, o.halo && 9);
    if (!o.halo) {
      ctx.beginPath();
      for (let x = 10, i = 0; x < L - 4; x += 10, i++) { ctx.moveTo(x, -9); ctx.lineTo(x, i % 5 === 0 ? 1 : -3); }
      ctx.lineWidth = 1.2; ctx.strokeStyle = o.detail; ctx.stroke();
    }
  },
  axe(ctx, L, o) {
    shaft(ctx, 0, L, 6.6, o.halo);
    const head = [[L - 50, 3], [L - 6, 3], [L + 4, 40], [L - 24, 58], [L - 62, 46], [L - 42, 24]];
    const spike = [[L - 44, -3], [L - 12, -3], [L - 28, -18]];
    poly(ctx, head, o.fill, 2.5, 540, o.halo && 10);
    poly(ctx, spike, o.fill, 2.2, 541, o.halo && 9);
    if (!o.halo) hatch(ctx, [[L + 4, 40], [L - 24, 58], [L - 62, 46], [L - 50, 32], [L - 20, 40], [L - 4, 28]], { angle: 20, gap: 4, w: 1.1, seed: 542, color: o.detail, cross: true });
  },
  hammer(ctx, L, o) {
    shaft(ctx, 0, L - 40, 7.2, o.halo);
    const head = [[L - 58, -40], [L, -40], [L, 40], [L - 58, 40]];
    poly(ctx, head, o.fill, 2.8, 550, o.halo && 10);
    if (!o.halo) {
      hatch(ctx, [[L - 58, 0], [L, 0], [L, 40], [L - 58, 40]], { angle: 50, gap: 5, w: 1.2, seed: 551, color: o.detail, cross: true });
      hatch(ctx, [[L - 58, -40], [L, -40], [L, 0], [L - 58, 0]], { angle: 50, gap: 9, w: 1.1, seed: 552, color: o.detail });
      stroke(ctx, [[L - 58, -30], [L, -30]], 1.6, o.detail);
      stroke(ctx, [[L - 58, 30], [L, 30]], 1.6, o.detail);
    }
  },
};

DRAW.pistol = function pistol(ctx, L, o) {
  // side view, aiming along +x: barrel on the axis, grip hanging below (+y), hammer spur on top
  const barrel = [[30, -6], [L, -6], [L, 3], [30, 3]];
  const frame = [[4, -7], [32, -7], [32, 9], [22, 9], [18, 4], [4, 4]];
  const grip = [[2, 2], [16, 4], [9, 31], [-7, 28]];
  const cyl = [[14, -9], [31, -9], [31, 8], [14, 8]];
  if (o.halo) { for (const q of [barrel, frame, grip, cyl]) poly(ctx, q, null, 0, 0, 9); return; }
  poly(ctx, grip, BLACK, 2, 570);
  poly(ctx, frame, o.fill, 2.2, 571);
  poly(ctx, barrel, o.fill, 2.2, 572);
  poly(ctx, cyl, o.fill, 2.2, 573);
  stroke(ctx, [[18, -9], [18, 8]], 1.2, o.detail);
  stroke(ctx, [[23, -9], [23, 8]], 1.2, o.detail);
  stroke(ctx, [[27, -9], [27, 8]], 1.2, o.detail);
  stroke(ctx, [[34, -2], [L - 3, -2]], 1.1, o.detail);
  stroke(ctx, [[L - 4, -6], [L - 4, -10]], 2.2);           // front sight
  stroke(ctx, [[4, -7], [-2, -13]], 2.6);                   // hammer
  ctx.beginPath(); ctx.arc(22, 13, 6, 0.1, Math.PI - 0.1); ctx.lineWidth = 2; ctx.strokeStyle = BLACK; ctx.stroke(); // trigger guard
};

DRAW.rifle = function rifle(ctx, L, o) {
  // side view, aiming along +x: barrel on the axis, stock dropping below it toward the tail
  const stock = [[0, 2], [40, -5], [46, 7], [30, 10], [6, 24], [-2, 20]];
  const receiver = [[40, -6], [78, -6], [78, 6], [46, 7]];
  const fore = [[78, 0], [128, 0], [126, 7], [78, 8]];
  if (o.halo) { for (const q of [stock, receiver, fore]) poly(ctx, q, null, 0, 0, 9); stroke(ctx, [[78, -2], [L, -2]], 5 + 9, WHITE); return; }
  stroke(ctx, [[78, -2], [L, -2]], 5);                       // barrel
  poly(ctx, stock, BLACK, 2, 580);
  poly(ctx, fore, BLACK, 2, 581);
  poly(ctx, receiver, o.fill, 2.2, 582);
  stroke(ctx, [[52, -6], [58, -13]], 2.6);                   // bolt handle
  stroke(ctx, [[L - 5, -4], [L - 5, -10]], 2.2);             // front sight
  stroke(ctx, [[66, -6], [66, -10]], 2);                     // rear sight
  ctx.beginPath(); ctx.arc(56, 9, 6, 0.1, Math.PI - 0.1); ctx.lineWidth = 2; ctx.strokeStyle = BLACK; ctx.stroke(); // trigger guard
};

function sword(ctx, L, o, s) {
  shaft(ctx, 0, s.grip, s.great ? 7.4 : 5.6, o.halo);
  const blade = [[s.grip, -s.hw], [L - s.taper, -s.hw], [L, 0], [L - s.taper, s.hw], [s.grip, s.hw]];
  poly(ctx, blade, o.fill, s.great ? 2.8 : 2, 560, o.halo && (s.great ? 11 : 9));
  if (o.halo) return;
  stroke(ctx, [[s.grip, -s.guard], [s.grip, s.guard]], s.gw);
  ctx.fillStyle = BLACK;
  ctx.beginPath(); ctx.arc(0, 0, s.great ? 7 : 4.4, 0, TAU); ctx.fill();
  stroke(ctx, [[s.grip + 10, 0], [L - s.taper - 6, 0]], s.great ? 1.8 : 1.1, o.detail);
  if (s.great) {
    hatch(ctx, [[s.grip, 3], [L - s.taper, 3], [L - s.taper, s.hw], [s.grip, s.hw]], { angle: 58, gap: 6.5, w: 1.1, seed: 561, color: o.detail });
  }
}

/** Draw a placed weapon state (tail/tip in world y-up coords). */
export function drawWeapon(ctx, st, halo = true) {
  const tx = st.tail[0], ty = -st.tail[1];
  const ang = Math.atan2(-(st.tip[1] - st.tail[1]), st.tip[0] - st.tail[0]);
  const fn = DRAW[st.type] || DRAW.staff;
  const o = { fill: st.ink ? BLACK : WHITE, detail: st.ink ? WHITE : BLACK };
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(ang);
  ctx.scale(st.scale, st.mirror ? -st.scale : st.scale);
  if (halo) fn(ctx, st.spec.len, { ...o, halo: true });
  fn(ctx, st.spec.len, o);
  ctx.restore();
}

/**
 * Smear for a fast-moving weapon: a white sword-trail with ink streaks between where the
 * weapon was a couple of frames ago and where it is now. `sampler(t)` returns the placed state.
 */
export function drawWeaponSmear(ctx, sampler, t) {
  const N = 7, dt = 1 / 210;
  const S = [];
  for (let k = 0; k <= N; k++) {
    const s = sampler(t - k * dt);
    if (!s || !s.tail) return;
    S.push(s);
  }
  let tipLen = 0, tailLen = 0;
  for (let k = 1; k <= N; k++) {
    tipLen += Math.hypot(S[k].tip[0] - S[k - 1].tip[0], S[k].tip[1] - S[k - 1].tip[1]);
    tailLen += Math.hypot(S[k].tail[0] - S[k - 1].tail[0], S[k].tail[1] - S[k - 1].tail[1]);
  }
  const speed = Math.max(tipLen, tailLen) / (N * dt);
  if (speed < 1500) return;
  const C = (p) => [p[0], -p[1]];
  const mid = (s) => C([(s.tail[0] + s.tip[0]) / 2, (s.tail[1] + s.tip[1]) / 2]);
  const heavy = S[0].spec.mass >= 2 || S[0].scale > 1.3;
  if (S[0].type !== 'staff' && S[0].type !== 'pencil' && S[0].type !== 'baton') {
    // blade trail: white crescent between the tip path and the mid-blade path
    ctx.beginPath();
    S.forEach((s, i) => { const p = C(s.tip); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
    S.slice().reverse().forEach((s) => { const p = mid(s); ctx.lineTo(p[0], p[1]); });
    ctx.closePath();
    ctx.fillStyle = WHITE; ctx.fill();
  }
  for (let k = 1; k <= N; k++) stroke(ctx, [C(S[k].tail), C(S[k].tip)], Math.max(0.9, (heavy ? 4.4 : 3.4) - k * 0.42));
  stroke(ctx, S.map((s) => C(s.tip)), heavy ? 3.6 : 2.6);
  stroke(ctx, S.map((s) => C(s.tail)), 1.8);
}
