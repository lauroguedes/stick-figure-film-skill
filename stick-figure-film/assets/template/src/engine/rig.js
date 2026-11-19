// Stick-figure rig.
//
// A pose is authored in LOCAL space: x = forward (the way the fighter faces), y = up,
// origin = the fighter's base point on the ground. Units are unscaled skeleton units.
//
//   hip:[x,y]     pelvis position                lean  torso angle from vertical (+ = forward)
//   bend          spine curve (+ = hunched)      curl  0..0.6 tuck (shortens the torso chord)
//   tilt          head tilt relative to torso    spin  whole-body rotation about the hip (+ = forward flip)
//   hF,hB:[x,y]   hands, relative to the SHOULDER fF,fB:[x,y] feet, relative to the base point
//   eF,eB,kF,kB   elbow / knee bend side (±1)
//   hFw,hBw,fFw,fBw: [worldX, height]  absolute world targets (contacts: grabs, wall hits…)
//
// Keys are converted to world-space targets once, then interpolated: hands travel on arcs
// around the shoulder (polar), planted feet stay planted, steps get an automatic lift, and
// limbs are solved with 2-bone IK every frame. Follow-through (head drag, spine flex) is
// derived from finite differences of the pose function, so the whole thing stays a pure
// function of time — any frame can be rendered on its own.

import { DEG, TAU, clamp, lerp, lerpAngle, EASE, segIndex } from './util.js';
import { stroke, trim, BLACK, WHITE } from './ink.js';

export const SKEL = { torso: 72, uArm: 40, fArm: 38, thigh: 52, shin: 52, headR: 17 };

export const BASE_POSE = {
  hip: [0, 102], lean: 0, bend: 0, curl: 0, tilt: 0, spin: 0,
  hF: [8, -74], hB: [-8, -74], fF: [10, 0], fB: [-10, 0],
  eF: -1, eB: -1, kF: 1, kB: 1,
};

const STRETCH = 1.16;
const PLANT_SNAP = 14; // feet that move less than this between keys stay planted

function torsoGeom(hip, leanW, bendW, curl, s) {
  const a = leanW * DEG;
  const dir = [Math.sin(a), Math.cos(a)];
  const chord = SKEL.torso * s * (1 - curl);
  const neck = [hip[0] + dir[0] * chord, hip[1] + dir[1] * chord];
  const perp = [-Math.cos(a), Math.sin(a)];
  const bulge = bendW * s + Math.sign(bendW || 1) * curl * SKEL.torso * s * 0.85;
  const ctrl = [
    (hip[0] + neck[0]) / 2 + perp[0] * bulge,
    (hip[1] + neck[1]) / 2 + perp[1] * bulge,
  ];
  const q = (t) => [
    (1 - t) * (1 - t) * hip[0] + 2 * (1 - t) * t * ctrl[0] + t * t * neck[0],
    (1 - t) * (1 - t) * hip[1] + 2 * (1 - t) * t * ctrl[1] + t * t * neck[1],
  ];
  return { neck, ctrl, sh: q(0.88), q, dir };
}

/** Convert one authored key into world-space targets. */
function keyTarget(ch, k) {
  const s = ch.scale;
  const f = k.face;
  const bx = k.x;
  const by = k.y || 0;
  const sp = (k.spin || 0) * DEG;
  const cs = Math.cos(sp), sn = Math.sin(sp);
  const rot = (v) => [v[0] * cs + v[1] * sn, -v[0] * sn + v[1] * cs];
  const hip = [bx + f * s * k.hip[0], by + s * k.hip[1]];
  const leanW = f * (k.lean + (k.spin || 0));
  const bendW = f * k.bend;
  const tiltW = f * k.tilt;
  const g = torsoGeom(hip, leanW, bendW, k.curl, s);
  const hand = (name) => {
    const w = k[name + 'w'];
    if (w) return [w[0] - g.sh[0], w[1] - g.sh[1]];
    const v = rot(k[name]);
    return [f * s * v[0], s * v[1]];
  };
  const foot = (name) => {
    const w = k[name + 'w'];
    if (w) return [w[0], w[1]];
    const v = rot([k[name][0] - k.hip[0], k[name][1] - k.hip[1]]);
    return [hip[0] + f * s * v[0], hip[1] + s * v[1]];
  };
  return {
    t: k.t, e: k.e || 'io', er: k.er || k.e || 'io', hop: k.hop || 0, slide: !!k.slide, face: f,
    hip, leanW, bendW, tiltW, curl: k.curl,
    hF: hand('hF'), hB: hand('hB'), fF: foot('fF'), fB: foot('fB'),
    eF: k.eF * f, eB: k.eB * f, kF: k.kF * f, kB: k.kB * f,
    turnF: k.turnF || 0, turnB: k.turnB || 0,
    reveal: k.reveal,
    pinF: !!k.fFw, pinB: !!k.fBw,
  };
}

export function buildTrack(ch, keys) {
  const T = keys.map((k) => keyTarget(ch, k));
  // keep planted feet planted; unwrap torso angle so flips never "unwind"
  for (let i = 1; i < T.length; i++) {
    T[i].leanW += 360 * Math.round((T[i - 1].leanW - T[i].leanW) / 360);
    for (const n of ['fF', 'fB']) {
      const a = T[i - 1][n], b = T[i][n];
      const pinned = n === 'fF' ? T[i].pinF : T[i].pinB; // an explicit world pin wins over plant-snapping
      if (!pinned && a[1] < 3 && b[1] < 3 && !T[i].slide && Math.abs(a[0] - b[0]) < PLANT_SNAP) {
        b[0] = a[0];
        b[1] = a[1];
      }
    }
  }
  return { ch, keys: T };
}

function ik(root, target, l1, l2, sigma) {
  let dx = target[0] - root[0];
  let dy = target[1] - root[1];
  let d = Math.hypot(dx, dy) || 1e-6;
  const max = (l1 + l2) * STRETCH;
  let end = target;
  if (d > max) {
    end = [root[0] + (dx / d) * max, root[1] + (dy / d) * max];
    d = max;
  }
  if (d > l1 + l2) {
    const k = d / (l1 + l2);
    l1 *= k;
    l2 *= k;
  }
  const min = Math.abs(l1 - l2) + 0.5;
  if (d < min) d = min;
  const ux = (end[0] - root[0]) / (Math.hypot(end[0] - root[0], end[1] - root[1]) || 1);
  const uy = (end[1] - root[1]) / (Math.hypot(end[0] - root[0], end[1] - root[1]) || 1);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const joint = [root[0] + ux * a - uy * h * sigma, root[1] + uy * a + ux * h * sigma];
  return { joint, end };
}

function polarLerp(a, b, u, turn) {
  const ra = Math.hypot(a[0], a[1]);
  const rb = Math.hypot(b[0], b[1]);
  const aa = Math.atan2(a[1], a[0]);
  const ab = Math.atan2(b[1], b[0]);
  let ang;
  if (turn) {
    let d = (ab - aa) % TAU;
    if (turn > 0 && d < 0) d += TAU;
    if (turn < 0 && d > 0) d -= TAU;
    ang = aa + d * u;
  } else {
    ang = lerpAngle(aa, ab, u);
  }
  const r = lerp(ra, rb, u);
  return [Math.cos(ang) * r, Math.sin(ang) * r];
}

/** Raw interpolated skeleton at time t (world space, y up). */
export function sample(track, t) {
  const K = track.keys;
  const s = track.ch.scale;
  const i = segIndex(K, t);
  const a = K[i], b = K[i + 1];
  const span = b.t - a.t || 1;
  const raw = clamp((t - a.t) / span);
  const u = (EASE[b.e] || EASE.io)(raw);
  const ur = (EASE[b.er] || EASE.io)(raw);

  const hip = [lerp(a.hip[0], b.hip[0], ur), lerp(a.hip[1], b.hip[1], ur)];
  const hopLift = b.hop ? b.hop * 4 * raw * (1 - raw) : 0;
  hip[1] += hopLift;
  const leanW = lerp(a.leanW, b.leanW, u);
  const bendW = lerp(a.bendW, b.bendW, u);
  const tiltW = lerp(a.tiltW, b.tiltW, u);
  const curl = lerp(a.curl, b.curl, u);
  const face = lerp(a.face, b.face, u);

  const foot = (n) => {
    const p = a[n], q = b[n];
    const air = p[1] > 3 && q[1] > 3;
    if (air) {
      const off = polarLerp([p[0] - a.hip[0], p[1] - a.hip[1]], [q[0] - b.hip[0], q[1] - b.hip[1]], u, 0);
      return [hip[0] + off[0], hip[1] + off[1]];
    }
    const out = [lerp(p[0], q[0], ur), lerp(p[1], q[1], ur) + hopLift];
    const airborne = p[1] > 3 || q[1] > 3;
    const d = Math.abs(q[0] - p[0]);
    if (!airborne && !b.slide && d > PLANT_SNAP) out[1] += Math.min(26, d * 0.22) * s * Math.sin(Math.PI * u);
    return out;
  };

  return {
    hip, leanW, bendW, tiltW, curl, face, s,
    hF: polarLerp(a.hF, b.hF, u, b.turnF),
    hB: polarLerp(a.hB, b.hB, u, b.turnB),
    fF: foot('fF'), fB: foot('fB'),
    eF: lerp(a.eF, b.eF, u), eB: lerp(a.eB, b.eB, u),
    kF: lerp(a.kF, b.kF, u), kB: lerp(a.kB, b.kB, u),
    reveal: b.reveal != null || a.reveal != null ? lerp(a.reveal ?? 1, b.reveal ?? 1, raw) : 1,
  };
}

function solve(S, extra = {}) {
  const s = S.s;
  const g = torsoGeom(S.hip, S.leanW, S.bendW + (extra.flex || 0), S.curl, s);
  const ha = (S.leanW + S.tiltW) * DEG;
  const R = SKEL.headR * s;
  const head = [g.neck[0] + Math.sin(ha) * R + (extra.drag?.[0] || 0), g.neck[1] + Math.cos(ha) * R + (extra.drag?.[1] || 0)];
  const tF = extra.hF || [g.sh[0] + S.hF[0], g.sh[1] + S.hF[1]];
  const tB = extra.hB || [g.sh[0] + S.hB[0], g.sh[1] + S.hB[1]];
  const armF = ik(g.sh, tF, SKEL.uArm * s, SKEL.fArm * s, S.eF);
  const armB = ik(g.sh, tB, SKEL.uArm * s, SKEL.fArm * s, S.eB);
  const legF = ik(S.hip, S.fF, SKEL.thigh * s, SKEL.shin * s, S.kF);
  const legB = ik(S.hip, S.fB, SKEL.thigh * s, SKEL.shin * s, S.kB);
  const torso = [];
  for (let i = 0; i <= 10; i++) torso.push(g.q(i / 10));
  return {
    s, face: S.face, hip: S.hip, neck: g.neck, sh: g.sh, head, headR: R, torso,
    eF: armF.joint, hF: armF.end, eB: armB.joint, hB: armB.end,
    kF: legF.joint, fF: legF.end, kB: legB.joint, fB: legB.end,
    reveal: S.reveal, leanW: S.leanW,
  };
}

/**
 * Full pose at time t with follow-through.
 * `fix` may override hand targets in world space: { hF:[x,y], hB:[x,y], wB: 0..1 blend }.
 */
export function pose(track, t, fix = null) {
  const S = sample(track, t);
  const dt = 0.05;
  const P = sample(track, t - dt);
  const g0 = torsoGeom(S.hip, S.leanW, S.bendW, S.curl, S.s);
  const g1 = torsoGeom(P.hip, P.leanW, P.bendW, P.curl, P.s);
  const vn = [(g0.neck[0] - g1.neck[0]) / dt, (g0.neck[1] - g1.neck[1]) / dt];
  const vh = [(S.hip[0] - P.hip[0]) / dt, (S.hip[1] - P.hip[1]) / dt];
  const a = S.leanW * DEG;
  const perp = [-Math.cos(a), Math.sin(a)];
  // spine flexes against the direction the chest is whipping
  const rel = (vn[0] - vh[0]) * perp[0] + (vn[1] - vh[1]) * perp[1];
  const flex = clamp(rel * 0.016, -9, 9);
  // head trails the neck slightly
  const lim = 5 * S.s;
  const drag = [clamp(-vn[0] * 0.006, -lim, lim), clamp(-vn[1] * 0.004, -lim, lim)];
  const extra = { flex, drag };
  if (fix) {
    const J0 = solve(S, extra);
    if (fix.hF) extra.hF = fix.hF;
    if (fix.hB) {
      const w = fix.wB ?? 1;
      extra.hB = [lerp(J0.hB[0], fix.hB[0], w), lerp(J0.hB[1], fix.hB[1], w)];
    }
  }
  return solve(S, extra);
}

// ── drawing ────────────────────────────────────────────────────────────────

const C = (p) => [p[0], -p[1]]; // world (y up) → canvas (y down)

function limb(root, joint, end, s) {
  // rounded corner at the joint so limbs read as drawn strokes, not hinged rods
  const r = Math.min(9 * s, Math.hypot(joint[0] - root[0], joint[1] - root[1]) * 0.45, Math.hypot(end[0] - joint[0], end[1] - joint[1]) * 0.45);
  const u1 = [joint[0] - root[0], joint[1] - root[1]];
  const l1 = Math.hypot(u1[0], u1[1]) || 1;
  const u2 = [end[0] - joint[0], end[1] - joint[1]];
  const l2 = Math.hypot(u2[0], u2[1]) || 1;
  const p1 = [joint[0] - (u1[0] / l1) * r, joint[1] - (u1[1] / l1) * r];
  const p2 = [joint[0] + (u2[0] / l2) * r, joint[1] + (u2[1] / l2) * r];
  const pts = [C(root), C(p1)];
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    pts.push(C([
      (1 - t) * (1 - t) * p1[0] + 2 * (1 - t) * t * joint[0] + t * t * p2[0],
      (1 - t) * (1 - t) * p1[1] + 2 * (1 - t) * t * joint[1] + t * t * p2[1],
    ]));
  }
  pts.push(C(p2), C(end));
  return pts;
}

function headPts(J) {
  const pts = [];
  const a0 = Math.atan2(J.neck[1] - J.head[1], J.neck[0] - J.head[0]);
  for (let i = 0; i <= 30; i++) {
    const a = a0 + (i / 30) * TAU;
    pts.push(C([J.head[0] + Math.cos(a) * J.headR, J.head[1] + Math.sin(a) * J.headR]));
  }
  return pts;
}

export function figureStrokes(J) {
  return {
    head: headPts(J),
    torso: J.torso.map(C),
    armB: limb(J.sh, J.eB, J.hB, J.s),
    armF: limb(J.sh, J.eF, J.hF, J.s),
    legB: limb(J.hip, J.kB, J.fB, J.s),
    legF: limb(J.hip, J.kF, J.fF, J.s),
  };
}

/** Draw a fighter. White halo first (keeps the figure readable over dense hatching), then ink. */
export function drawFigure(ctx, J, ch, o = {}) {
  const w = ch.line * J.s;
  const halo = o.halo ?? 5;
  let S = figureStrokes(J);
  const rv = o.reveal ?? J.reveal ?? 1;
  if (rv < 1) {
    // pen "draws" the figure: head, spine, arms, legs
    const seg = (a, b) => clamp((rv - a) / (b - a));
    S = {
      head: trim(S.head, seg(0, 0.3)), torso: trim(S.torso.slice().reverse(), seg(0.3, 0.46)),
      armF: trim(S.armF, seg(0.46, 0.6)), armB: trim(S.armB, seg(0.6, 0.72)),
      legF: trim(S.legF, seg(0.72, 0.86)), legB: trim(S.legB, seg(0.86, 1)),
    };
  }
  const limbs = [S.legB, S.armB, S.torso, S.legF, S.armF];
  const fist = ch.fist * J.s;
  const hands = [C(J.hB), C(J.hF)];
  if (halo > 0 && rv >= 1) {
    for (const l of limbs) stroke(ctx, l, w + halo * 2, WHITE);
    stroke(ctx, S.head, w + halo * 2, WHITE);
    if (fist) {
      ctx.fillStyle = WHITE;
      for (const h of hands) {
        ctx.beginPath();
        ctx.arc(h[0], h[1], fist + halo, 0, TAU);
        ctx.fill();
      }
    }
  }
  stroke(ctx, S.legB, w);
  stroke(ctx, S.armB, w);
  stroke(ctx, S.torso, w);
  stroke(ctx, S.legF, w);
  if (S.head.length > 2) {
    if (rv >= 1) {
      ctx.beginPath();
      S.head.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath();
      ctx.fillStyle = WHITE;
      ctx.fill();
    }
    stroke(ctx, S.head, w * 0.92);
  }
  stroke(ctx, S.armF, w);
  if (fist && rv >= 1) {
    ctx.fillStyle = BLACK;
    for (const h of hands) {
      ctx.beginPath();
      ctx.arc(h[0], h[1], fist, 0, TAU);
      ctx.fill();
    }
  }
}

/**
 * Smear / afterimage strokes for fast limbs. Samples the pose function a few
 * sub-frames back and draws thin trailing ink where an extremity is moving fast.
 */
export function drawSmear(ctx, poseAt, t, ch, o = {}) {
  const N = 6;
  const dt = 1 / 100;
  const thresh = o.thresh ?? 620; // world units / second
  const S = [];
  for (let k = 0; k <= N; k++) S.push(poseAt(t - k * dt));
  const s = S[0].s;
  const parts = [['hF', 'eF', 'sh'], ['hB', 'eB', 'sh'], ['fF', 'kF', 'hip'], ['fB', 'kB', 'hip']];
  for (const [end, mid, root] of parts) {
    let len = 0;
    for (let k = 1; k <= N; k++) len += Math.hypot(S[k][end][0] - S[k - 1][end][0], S[k][end][1] - S[k - 1][end][1]);
    const speed = len / (N * dt);
    // discount whole-body travel so a dash does not smear every limb
    const body = Math.hypot(S[N].hip[0] - S[0].hip[0], S[N].hip[1] - S[0].hip[1]) / (N * dt);
    if (speed - body * 0.8 < thresh) continue;
    const trail = S.map((J) => C(J[end]));
    stroke(ctx, trail.slice(0, 4), 2.4 * s);
    stroke(ctx, trail.slice(3), 1.3 * s);
    for (const k of [2, 4]) {
      stroke(ctx, [C(S[k][root]), C(S[k][mid]), C(S[k][end])], (k === 2 ? 1.8 : 1.1) * s);
    }
  }
}

export { C as toCanvas };
