// MINIMAL EXAMPLE. The smallest complete scene: one character, one prop, a jump, a camera move,
// sound cues and a friendly score. Copy this file to start a new scene; read ref_poc.js for a full
// two-character fight (impact frames, slow motion, a breakable wall, a weapon pulled off the page).
//
// World: x to the right, height up (floor = 0). The character's base point is `x`; poses are in
// the character's own space (forward, up). Drawing hooks use canvas coordinates: y DOWN.

import { createScene } from '../engine/scene.js';
import { flight } from '../engine/moves.js';
import { drawGround, cube, scribble, DEFAULT_PAGE } from '../engine/kit.js';

// score: the music style for this scene ('playful', 'duel', 'chase', 'heavy', …, or 'none')
const S = createScene({ id: 'minimal', title: 'Minimal example', duration: 6, score: 'playful' });

// One character: omit B. A walks in, hops a gap, picks up the pencil and twirls it.
S.fighters({
  A: [
    { t: 0, p: 'stand', x: 520, face: 1 },
    { t: 0.5, p: 'run1', x: 640, e: 'lin' },
    { t: 1.0, p: 'run2', x: 760, e: 'lin' },
    { t: 1.3, p: 'crouch', x: 800, e: 'in' },                         // anticipation before the hop
    ...flight(1.3, 1.9, [800, 0], [1000, 0], 4000, [
      [1.6, { p: 'airUp' }],
    ], { p: 'landDeep' }),
    { t: 2.2, p: 'stand', x: 1010 },
    { t: 2.7, p: 'crouch', x: 1040, hFw: [1100, 8] },                 // hand pinned to the pencil on the floor
    { t: 3.1, p: 'stand', x: 1040, hF: [30, 40] },                    // stands up holding it
    { t: 4.4, p: 'stand', x: 1040, hF: [36, 10], e: 'out' },
    { t: 6.0, p: 'stand', x: 1040, hF: [36, 10] },
  ],
});

// A prop that becomes held: free (lying on the page) until the hand reaches it, then carried.
S.weapon('pencil', [
  { t: 0, type: 'pencil', at: [1100, 8], ang: 0 },                   // lying flat (at = its centre)
  { t: 2.7, by: 'A', ang: 0 },                                        // picked up when the hand gets there
  { t: 3.1, by: 'A', ang: 80 },
  { t: 4.0, by: 'A', ang: 80 + 720, e: 'io' },                        // two twirls (keep ang continuous)
  { t: 6.0, by: 'A', ang: 800 },
]);

// Camera: wide establishing shot, then track the character (a: 1) and push in for the end.
S.camera([
  { t: 0, x: 900, y: -200, z: 0.9 },
  { t: 1.2, a: 1, y: -160, z: 1.3, e: 'io' },
  { t: 3.0, a: 1, y: -150, z: 1.6, e: 'io' },
  { t: 6.0, a: 1, x: 10, y: -150, z: 2.3, r: 3, e: 'io' },
]);

// Sound: one helper call per action keeps picture, sound and shake in sync.
S.step({ t: 0.5, x: 640, weight: 0.3 });
S.step({ t: 1.0, x: 760, weight: 0.3 });
S.whoosh({ t: 1.3, x: 800, size: 's' });
S.land({ t: 1.9, x: 1000, weight: 0.4 });
S.cue({ t: 2.75, type: 'pop', x: 1100 });
S.whoosh({ t: 3.2, x: 1060, size: 's' });
S.whoosh({ t: 3.6, x: 1060, size: 's' });

S.env({
  far(ctx, t, { px }) {
    cube(ctx, 700, -420, 90, 41, Math.max(1.5, 1.1 * px));
    scribble(ctx, 'hello', 1250, -520, 64, -0.04);
  },
  stage(ctx, t, { vb, px }) {
    drawGround(ctx, DEFAULT_PAGE.x0 + 8, 820, vb, px);
    drawGround(ctx, 960, DEFAULT_PAGE.x1 - 8, vb, px);                 // a gap in the floor between 820 and 960
  },
  surface: (x) => (x > 820 && x < 960 ? null : 0),                    // no floor (and no shadow) over the gap
});

export default S.build();
