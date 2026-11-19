# Scene authoring guide (engine reference)

Everything on screen is drawn procedurally: black ink (`#000`) on white paper (`#fff`), nothing
else by default. A **scene** is one location with its own clock (`t = 0` at the scene start). You author a
scene as data (pose keys, weapon keys, camera keys, events) plus a few drawing hooks for the
environment. `src/scenes/ref_poc.js` is a complete worked example — read it alongside this guide.

```js
import { createScene } from '../engine/scene.js';
const S = createScene({ id: 's2', title: 'Pencil City', duration: 22 });
S.fighters({ A: [...], B: [...] });   // pose keys
S.weapon('staff', [...]);             // weapon keys (any number of weapons)
S.camera([...]);                      // camera keys
S.hit({...}); S.land({...});          // contacts: picture + sound + shake in one call
S.env({ far, stage, over, fore });    // environment drawing hooks
export default S.build();
```

## Tools (run from the project root)

| Command | Use |
|---|---|
| `node tools/sheet.mjs --scene s2 --from 3 --to 5 --n 12 --out out/review/s2/a.png` | contact sheet through the scene camera (then look at the PNG) |
| `… --times 3.2,3.33,3.4 --cols 3 --cw 660` | exact frames, bigger cells |
| `… --stage 1000,-180,1.8` | fixed debug camera `x,y,zoom` — judge poses without the film camera |
| `node tools/sheet.mjs --scene s2 --at 8.6 --out out/review/s2/still.png` | one full-resolution frame |
| `node tools/probe.mjs --scene s2 --times 3.4,3.46` | prints solved world positions of every joint and weapon tip — **use this to line up contacts instead of guessing** |
| `node tools/cross.mjs --scene s2 --a sword --b axe --times 4.1,4.12` | where two weapons' blades cross (or how far they miss) — place `S.hit` on a clash with this |
| `node tools/lint.mjs --scene s2` | teleporting joints, limbs under the floor or the scene's `surface`, weapons popping between holders, characters out of frame (first 25 of each kind; `--all` for every line) |
| `node tools/render.mjs --scene s2` | `out/s2.mp4` of the scene alone (no audio) |
| `node tools/sheet.mjs --scene _gallery --from 0.5 --to 10.5 --n 11` | every weapon type, held |

A 12-frame sheet renders in ~2 s. Review constantly: you cannot judge a pose from its numbers.
`--scene` takes a scene id (whether or not it is on the timeline) or a file name.

The object `S.build()` returns has `state(t)` (solved joints and weapons at authored time t),
`draw`, `camera`, `cues`; inside env hooks the same solved state is `E.st` (`E.st.A.hF` is A's
front hand, `E.st.weapons` the weapons).

## Coordinates

- **World x** grows to the right. **Height** is up-positive, floor = 0. Pose keys, weapon `at`,
  `S.hit({x, h})`, `hFw` etc. all use `[worldX, height]`.
- **Drawing hooks** use canvas coordinates: same x, but **y is DOWN** (floor = 0, a point 300
  units up is `y = -300`). Camera `y` is canvas-style too (chest height ≈ `-150`).
- Fighter A is ~195 units tall, B ~225. The default page spans x −420…2620, y −1120…590;
  a 16:9 frame at zoom 1 shows 1920 × 1080 world units.

## Characters

`S.fighters({ A, B })` — A is the smaller, lighter character (scale 0.95, line 4.6, round
hands); B the bigger, heavier one (scale 1.1, line 6.2, solid fists). **B is optional**: omit it
for a one-character film — B then exists off-page and is never drawn, the lint ignores it, and a
camera `b` weight follows A. To have a second character appear later, give B keys and use
`reveal: 0` (hidden) on the keys before it enters — `reveal` is per key, not sticky, and a hidden
figure also has no shadow, smear or speed lines.

## Poses (see `engine/rig.js`, `engine/moves.js`)

A key is authored in the fighter's **local** space: x = forward (the way they face), y = up,
origin = their base point on the floor.

```js
{ t: 3.2, x: 900, face: 1,            // world position of the base point; face 1 = right, -1 = left (both sticky)
  y: 0,                               // base height (0 = on the floor; set it on a rooftop / in the air). NOT sticky.
  hip: [0, 80],                       // pelvis: [forward, up]. Standing ≈ 102, fighting stance 80–92, crouch 45–60
  lean: 18,                           // torso angle from vertical, + = forward
  bend: 9, curl: 0, tilt: 8,          // spine curve (+ hunched), tuck 0..0.6, head tilt
  hF: [30, -30], hB: [-6, -38],       // hands RELATIVE TO THE SHOULDER  (max reach 78)
  fF: [46, 0],  fB: [-46, 0],         // feet relative to the base        (max reach 104 from the hip)
  e: 'snap' }                         // ease INTO this key: lin in in3 out out3 io io3 snap exp back hold
```

- `p: 'bStance'` starts from a named pose in `POSES` (moves.js) and applies your overrides.
  Pass your own library with `createScene({ poses: {...} })`.
- `same: true` repeats the previous pose — use it for **hit-stops** (2–3 frames) and holds.
- Local units are multiplied by the fighter's scale (A 0.95, B 1.1) — B's reach is longer.
- Hands travel on **arcs around the shoulder** between keys, feet stay planted if they move
  < 14 units between keys, larger moves become steps with an automatic lift
  (`slide: true` on the arriving key = drag/skid instead). `turnF / turnB: ±1` forces which way
  round a hand swings when the default (shortest way) is wrong.
- `hFw / hBw / fFw / fBw: [worldX, height]` pin a hand or foot to a world point for that key
  (grabs, catching a fist, a hand on a wall, a foot on a ledge).
- `spin: deg` rotates the whole body about the hip (+ = forward flip). Go ≤ 160° per key.
- `kF / kB / eF / eB: -1` flips a knee / elbow. In very low poses a knee can poke below the
  floor — flip it (`kB: -1`) or raise the hip; the lint flags it.
- `er` = separate ease for the body's travel (hip), `e` for the limbs.
- `reveal: 0→1` draws the figure on with a pen (used once, at the very start of the film).

**Jumps and falls** — use `flight()` (moves.js): the key before it is the take-off, then

```js
...flight(t0, t1, [x0, y0], [x1, y1], g, [[t, poseA], [t, poseB]], landingPose),
```

puts the mid-air poses and the landing on one true parabola (`g` 2400 = flat line-drive,
4000 = hop, 6000–7000 = big leap; apex above the chord = g·T²/8). After landing on a raised
surface keep writing `y:` on every key while they stand there (y is not sticky).

**What makes it feel animated, not rotated** (the brief's hardest requirement):

1. **Anticipation** — a key that goes the opposite way first (coil back before a dash, sink
   before a jump). Heavier action → longer anticipation (light jab 0.05 s, sword 0.12 s,
   axe/hammer 0.3–0.45 s).
2. **Fast into contact** — `e: 'snap'` or `'in3'` on the contact key, 2–4 frames of travel.
3. **Hit-stop** — `{ t: +0.06…0.1, same: true }` right after a big contact.
4. **Follow-through, then recover** — overshoot past the target, settle back. Heavy weapons
   drag the body after them (`heavyEnd`), light ones snap back to guard.
5. **Reactions sell hits** — the one who is struck needs a key at the same instant
   (`hitBack`, `fold`, `stagger`, or custom), usually with travel (`x` change + `slide: true`).
6. **Whole body, every key** — move the hip and lean with every arm action; shift the feet.
   A key that only changes one hand looks robotic.
7. **Contrast the two fighters** — A: upright, narrow, bouncy, precise, dodges and counters,
   flips and spins. B: wide, low, hunched, heavy steps, big wind-ups, grabs and throws,
   breaks things. They must be recognisable by silhouette and movement alone.
8. Keep them **150–260 units apart** while trading blows so silhouettes don't merge; step in
   for a strike and back out.
9. The rig adds secondary motion for you: spine flex, head drag, limb smears, weapon trails,
   speed lines when a body moves fast.

## Weapons (see `engine/weapons.js`)

Types: `pencil staff baton knife shortsword longsword spear ruler axe hammer greatsword pistol rifle`.

```js
S.weapon('sword', [
  { t: 2.0, type: 'shortsword', at: [1400, 120], ang: 80 },       // free: lying / stuck / flying. `at` = its CENTRE
  { t: 3.1, by: 'A', ang: 80, g: 0.11, two: 0 },                  // held from 3.1 (A's hF must be there at 3.1!)
  { t: 3.3, by: 'A', ang: 150, e: 'out' },                        // wind-up
  { t: 3.42, by: 'A', ang: -20, e: 'snap' },                      // cut
  { t: 6.0, at: [1700, 60], ang: 400, hop: 160 },                 // knocked away: free again, tumbling in an arc
  { t: 6.4, at: [1820, 4], ang: 720 },                            // lands
  { t: 9.0, at: [1820, 4], ang: 720, gone: true },                // (optional) remove
]);
```

- Which end is which: for blades the tail is the pommel and the tip the point; for the `pencil`
  the tail is the sharpened point and the tip the eraser; for guns the tip is the muzzle.
- Anything that is not in the list (a paper plane, a ball, a balloon) is drawn by you in an env
  hook as a function of `t`; to frame it, put its position in an absolute camera `x`, or give the
  camera a key per beat.
- `ang` = direction tail→tip in world degrees: 0 points right, 90 up, 180 left, 270 down.
  It is interpolated numerically — **keep it continuous** (a full twirl adds 360; to swing the
  short way from 350 to 10 write 370, not 10).
- `g` = where the main hand (hF) grips, 0 = pommel/tail … 1 = tip. `two: 1` puts the back hand
  on the weapon automatically (author `hB` roughly near; the rig moves it).
  `hand: 'B'` puts a one-handed weapon in the back hand (dual wielding).
- `scale` (interpolated) makes massive weapons; `ink: 1` draws it ink-forged (solid black);
  `type` on a later key morphs it (pencil → staff).
- The weapon follows the hand. To aim a strike, set the hand pose and the angle, then
  **probe** the tip position and adjust until tip/edge meets the target at the contact key.
- Weight is yours to animate: a knife flicks in 2 frames; a hammer needs 0.35 s of wind-up,
  drags the wielder's whole body, buries itself, and takes 0.3 s to lift again. Pair heavy
  contacts with `S.hit({ sound: 'slam', weight: 1, size: 2, ring: true })` and big shakes.

### Firearms

`type: 'pistol'` is a hand-drawn revolver. Its axis (tail→tip) is the **line of fire** and the tip is
the muzzle; it mirrors automatically when the holder faces left, so the grip always hangs down.
Hold it one-handed in `hF` (`g` default) with the arm extended along `ang`, or `two: 1` for a braced grip.

```js
S.shot({ t: 4.2, weapon: 'gun', to: [1480, 150] });                       // bullet hole in the page at `to`
S.shot({ t: 4.5, weapon: 'gun', to: [1010, 160], hit: 'spark' });         // ricochet off a blade / hard prop
S.shot({ t: 6.0, weapon: 'gun', to: [900, 150], slug: [6.0, 7.1], hit: 'page' }); // slow-motion: a visible slug flies for 1.1 s
```

One call adds the muzzle flash (read from the weapon's solved tip — it cannot drift off the barrel),
tracer, ejected casing, smoke, the hit (persistent **bullet hole** showing the black desk, or sparks),
gunshot / casing / impact sounds and a camera kick. `to` must lie along the barrel: the build warns
when it is more than 8° off. Animate the **recoil** yourself: on the shot key the hand kicks back and
up 10–20 units and `ang` jumps 15–30° (ease `snap`), recovering over 0.15–0.25 s; the shooter's
shoulders rock. Holes persist for the rest of the scene (`E.holes` lists them; `S.hole({t,x,h,r})`
adds one without a shot). A fighter is never shown wounded: bullets graze, are dodged, deflected
(`hit: 'spark'` on the blade, with a `S.hit({sound:'clang'})`-style parry pose), or hit weapons and
scenery — the damage is to the notebook.

## Camera (see `engine/camera.js`)

```js
S.camera([
  { t: 0, x: 1100, y: -265, z: 0.6 },                    // absolute framing
  { t: 2, a: 0.5, b: 0.5, y: -150, z: 1.5, e: 'io3' },   // track the midpoint of A and B
  { t: 3, a: 1, x: 40, y: -160, z: 2.2, r: 4, e: 'snap' } // punch in on A, slight roll
]);
```

Typical zooms: 0.5 whole page · 1.0–1.3 wide · 1.5–1.9 medium fight shot · 2.2–2.8 close-up.
Make it cinematic — push-ins, whip pans (`e: 'out'` over 0.25–0.4 s), punch-ins on hits
(`e: 'snap'`, +0.2 zoom over 2 frames), pull-outs for scale, roll 3–8° for tension, low/high
framing via `y` — **but both fighters must stay readable**: the lint reports a fighter out of
frame for > 0.5 s. `S.shake(t, ampPx, dur)` adds shake (S.hit/S.land add it automatically).

**Bullet-time close-ups.** `S.bulletTime({ at, span: 0.25, hold: 2, on: 'A', z: 2.9 })` freezes the
action at scene time `at` for `hold` seconds of screen time (only `span` seconds of action pass) while
the camera cuts in tight with moving close-up shots — a rolling push-in on `on`, then a whip to the
other fighter — and then time snaps back. Pass `shots: [{ on, z, roll: [a, b], slide: [a, b] }, …]`
to direct the sub-shots yourself. The scene grows by `hold − span` and everything after it shifts
automatically (cues, music hints and the film timeline included).

`S.impact(t, dur)` = **impact frame**: the whole image flips to white-on-black for a beat.
Reserve it for the 3–6 biggest hits of the scene, never closer than 0.5 s apart.

`S.slowmo(t0, t1, (st) => st.B.hF)` adds slow-motion focus lines around a point and tells the
music to drop out. You author the slow motion itself by spacing keys widely (use `e: 'lin'`).

## Contacts, effects and sound

Use the combined helpers — one call keeps burst, sound and shake on the same frame:

```js
S.hit({ t, x, h, size: 1, sound: 'hit', weight: 0.6, impact: false, ring: false, shock: false,
        sparks, shake, ringH });     // sparks: default on for clang/clack; shake: px (0 = none); ringH: ring height
S.land({ t, x, h: 0, weight: 0.6 });        // dust + thud (+ shake)
S.step({ t, x, weight: 0.5 });              // footfall
S.whoosh({ t, x, size: 'm' });              // 's' | 'm' | 'l'; heavy: true for heavy weapons
S.skid({ t0, t1, x0, x1 });                 // persistent scratches + scrape sound
S.fx({ t, type: 'sparks', x, h, size: 1 }); // raw effect: dust burst ring shock sparks splash scraps (fx.js)
S.cue({ t, type: 'tear', dur: 0.5, x });    // raw sound
```

`sound` for `S.hit`: `hit` (body) · `block` (limb on limb) · `clack` (wood) · `clang` (metal on
metal) · `slam` (heavy weapon into ground/wall) · `null`.

All cue types the soundtrack knows (give `x` for auto-pan, `weight` 0..1 where it applies):
`scribble(dur)` pencil on paper · `draw(dur)` a fast confident pen stroke (something being drawn
into existence) · `whoosh(size,dur)` · `heavyswing(weight,dur)` · `slice(weight)` blade cutting
air/paper · `step(weight)` · `thud(weight)` · `stomp` · `hit(weight)` · `block(weight)` ·
`clack(weight)` · `clang(weight)` · `slam(weight)` · `snap` wood/pencil breaking · `skid(dur)` ·
`pop` · `boom` · `wallbreak(size 0..1)` · `crumble(dur)` · `tear(dur)` paper · `crack(dur)` ·
`shing(dur)` blade shimmer / unsheathe · `shatter` weapon breaking into pieces ·
`inksplash(weight)` · `rumble(dur)` · `thunder` · `wind(dur)` storm bed · `riser(dur)` ·
`slowdown(dur)` · `heartbeat` · `gunshot(weight)` · `ricochet` · `bulletimpact(weight)` bullet into paper/wood · `bulletwhiz` near miss · `shell` casing on the floor · `dryfire` empty click · `reload` · `rustle(dur)` paper folding · `whistle(size: 'up'|'down', dur)` slide whistle · `chime` a happy
glockenspiel run · `mark(name)` a silent timing marker a score function can read · `megaimpact` (once per scene at most) · `pageturn` (added
automatically at page-turn transitions) · `cuthit`.

**Every significant action needs a cue**: each swing a whoosh, each contact a hit, each
landing a thud, each break a break. Sound is half of the impact.

## Environment hooks (`S.env({...})`) and the kit (`engine/kit.js`, `engine/ink.js`)

Each hook is `(ctx, t, E) => void`, already inside the camera transform, with
`E = { cam, px (world units per screen px), vb (visible bounds), impact, st (solved state), W, H }`.

| Hook | Layer |
|---|---|
| `page` | replaces the default notebook page (white sheet, ruled lines, spiral) |
| `far2`, `far` | background layers on slower parallax (0.72 / 0.86) — skyline, doodles |
| `stage` | the set **behind** the fighters: floor, walls, props, damage |
| `mid` | behind the fighters but over dust |
| `over` | **in front** of the fighters: flying debris, foreground rain |
| `fore` | foreground silhouettes on faster parallax (1.28) |
| `screen` | screen-space overlay (identity transform, 1920×1080) |
| `surface: (x, t, J) => height \| null` | the floor height under x — used for contact shadows and by the lint's floor check; `null` = no floor here (a gap, a fall, off a ledge): no shadow, no floor check |
| `order: (t) => 'BA' \| 'AB'` | who is drawn first (further back). Default B behind A |

Kit: `drawPage`, `drawGround(ctx, x0, x1, vb, px, {y, dense})` (hatched floor/platform line),
`box` / `cube` (hatched solids), `setSquare`, `protractor`, `scribble` (handwriting),
`makeBrickWall` (breakable: `.smash .collapse .crack .bruise`), `makeDebris` (flying chunks that
land and stay), `crackSet` + `drawCracks`, `drawTear` (rip showing the black desk), `drawSkids`.
Ink: `line`, `sketchPoly`, `hatch` (the workhorse: `{angle, gap, gapEnd, cross, w, seed}`),
`blob`, `stroke`, `trim`, `makeCracks`.

**Art rules (the defaults — the user's brief overrides them)**

- Only `BLACK` and `WHITE`. No other colours, no `globalAlpha`, no gradients, no grey, no
  shadowBlur. All tone is **hatching / cross-hatching**: density = darkness, direction = form.
- The fighters are never altered: a circle and five lines. Environments may be rich; keep the
  space right behind the fighters lighter than its surroundings so they stay readable (they
  get a white halo automatically).
- Everything must be a pure function of `t` (use `rng(seed)` from util.js, never
  `Math.random()` or state carried between frames). Build static geometry once at module
  scope; cull or skip what is off-screen (`E.vb`). A frame should render in < 0.15 s.
- The notebook is part of the fight: things get broken, torn, pulled out of drawings, used.
  Destruction persists for the rest of the scene.
- No gore. No text or titles on screen other than notebook doodles — unless the brief asks for it.

## Scene contract

- Set the music with `createScene({ score: 'playful' | 'duel' | … | 'none' })` (see sound.md).
- `duration` is fixed once the soundtrack exists (generated music is cut to it). First fighter and
  camera key at `t = 0`, last at `t ≥ duration`.
- A scene that **arrives by page turn** has the previous page flipping away over it for the
  first 0.5 s: open with ~0.8 s of arrival/establishing, not a key hit.
- The **last frame** of a scene followed by a page turn is frozen during that turn — end on a
  strong, clean composition, and finish the scene's last impact ≥ 0.3 s before the end.
- Run the lint clean (or explain what remains) and look at the whole scene on sheets at
  ≤ 0.25 s spacing before calling it done.
