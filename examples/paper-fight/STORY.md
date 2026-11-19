# PAPER FIGHT: story bible (full film, 2:58)

> Two lines of ink. One sheet of paper. An escalating battle with the intensity of a blockbuster.

Two minimalist stick figures fight through a hand-drawn notebook. Strict black and white,
pen-and-ink, hatching for all tone. The fight escalates from bare hands to colossal ink-forged
weapons, the notebook itself is torn apart by it, and it ends where it began: two figures, bare
hands, one page.

**Fighter A: The Technician.** Smaller, lighter line. Fast, upright, precise. Dodges, counters,
spins, flips, uses the environment cleverly. Wins exchanges with timing, not force.

**Fighter B: The Powerhouse.** Taller, heavier line, small fists. Wide, low, hunched. Charges,
grabs, throws, smashes. Every miss breaks something. Never stops coming.

Neither speaks; there is no text. Each weapon upgrade must be *motivated* by the choreography:
a weapon breaks, is lost, or is outmatched, and the fighter takes something bigger from the world.

| # | File | Film time | Dur | Location | Combat tier | Arrives by | Starts holding | Ends holding |
|---|---|---|---|---|---|---|---|---|
| 1 | `s1_first_clash.js` | 0:00–0:20 | 20 s | Blank Notebook Arena | unarmed | (film start) | nothing | nothing |
| 2 | `s2_pencil_city.js` | 0:20–0:42 | 22 s | Pencil City | improvised + light | page turn | nothing | A: shortsword · B: shortsword |
| 3 | `s3_geometry_zone.js` | 0:42–1:04 | 22 s | Geometry Zone | long blades, spear | page turn | A: shortsword · B: shortsword | A: longsword · B: spear |
| 3b | `s3b_ink_shots.js` | 1:04–1:24 | 20 s | Graph Paper Range | a firearm | page turn | A: longsword · B: spear | A: longsword · B: spear |
| 4 | `s4_torn_paper.js` | 1:24–1:52 | 28 s | Torn Paper Battlefield | heavy weapons | page turn | A: longsword · B: spear | A: greatsword · B: hammer |
| 5 | `s5_ink_arena.js` | 1:52–2:17 | 25 s | Final Ink Arena | massive ink-forged | page turn | A: greatsword · B: hammer | nothing (both shattered) |
| 6 | `s6_last_line.js` | 2:24–2:44 | 20 s | The same blank page, scarred | unarmed, then a rifle | hard cut (white-out) | nothing | A: rifle (cut to black on the shot) |

Reference boards from the director are in `ref/` (look at them): `1.webp` character sheet,
`2.webp` scene environment concepts, `3.webp` asset board (weapons, environment elements, action
effects, "pull a weapon from the notebook" examples), `4.webp` the original 15 s storyboard.

Timings below are guides: re-pace freely inside your scene, but hit the opening state, the
closing state, the tier, and the fixed duration.

---

## Scene 1: The First Clash (20 s, unarmed) · Blank Notebook Arena

White page, ruled lines, a few geometry doodles, a breakable brick wall at stage right
(as in `ref_poc.js`). **No weapons at all**: the audience must enjoy what these two can do
with bare hands before anything is picked up.

- **0–3**: Top-down reveal of the notebook page; the two figures are drawn on by a pen, take
  their stances (A hops light, B stomps wide); slow push-in. *(reuse ref_poc 0–3 exactly)*
- **3–9.5**: *(reuse ref_poc 3.0–9.45)* B's flying overhand → A slides under and answers with
  a spinning kick → parry / jab / duck / block / low kick → B catches a fist and launches A
  across the page → B's charge and haymaker in **slow motion**, A drops under it, the fist goes
  through the brick wall → A wall-kicks into a flip over B.
- **9.5–16**: New material, unarmed escalation, **grappling and acrobatics**. B rips his arm
  out and turns; A darts in with a fast 4–5 hit combination that actually rocks B; B answers by
  *catching* A mid-kick and swinging him into the ground (dust, cracks); A kips up, runs up B's
  body / vaults off his shoulders, scissor or flying kick; B bear-hugs or lifts A overhead and
  throws him; A lands in a roll. Show B's hits displacing A a long way, and A's hits needing
  three to B's one.
- **16–20** (B grabs A and **hurls him through the damaged wall** (the wall bursts) bricks
  everywhere), then barrels through the hole after him. Final frame: the wall exploding outward,
  both figures airborne in the debris, heading off the right side of the page.

Must keep: the pencil planted in the page stays untouched (it is set dressing here; it pays off
in scene 2). Do **not** include the staff section or the sword-crack ending of ref_poc.

## Scene 2: Pencil City (22 s, improvised and light weapons) · rooftops and alley

A city built from stationery (ref `2.webp` panel 2): towers that are giant pencils and
markers, buildings that are stacked notebooks/erasers/books with dense architectural hatching,
clotheslines, crates, a water-tank made of a pencil sharpener, an alley between two buildings.
Fight happens across **rooftops** at different heights with a gap between them, then drops
into the **alley**. Strong layered parallax (far skyline, mid buildings, foreground ledge).

- **0–1**: Page turn clears; A and B crash down out of the sky onto a rooftop (debris from
  scene 1 raining with them), roll apart, face off.
- **1–8**: **First weapon.** B charges; A snatches a *pencil* out of the skyline (a pencil
  antenna/flagpole), which becomes a plain black **staff** (`type: 'pencil'` → `'staff'`): block,
  twirl, sweeping counter, vault using the staff as a pole. B answers by ripping something off
  the roof (a pipe/ruler **baton**) then a **knife** (a compass needle / pen nib) in the other
  hand: aggressive close-range flurry. Staff vs baton + knife. B **snaps the staff** in half
  (`snap` cue): A fights a few beats with the two halves as escrima sticks, loses them.
- **8–15**: **Short swords.** A, disarmed, backs to a wall/billboard where a sword is *drawn*
 : reaches into the drawing and pulls a **shortsword** out of it (the outline lifts off the
  wall; see ref `3.webp` "pull weapon from notebook"). B throws the knife (A deflects it into a
  wall), kicks a crate at him (A splits it), then tears his own **shortsword** from a drawn
  shop sign/weathervane. Sword on sword: fast clangs, a leap across the rooftop gap mid-exchange,
  a clothesline cut and used to swing, a pencil tower sliced through and toppling.
- **15–22**: The fight tips off the roof and they fall into the **alley** trading cuts on the way
  down (wall-run / wall-kick), land, a last furious exchange in the narrow alley (sparks off the
  walls), and B's overhead blow (A sidesteps) **splits the alley floor open**. Final frame:
  the floor cracked wide, both falling into the tear with swords in hand.

## Scene 3: Geometry Zone (22 s, long swords, spear, complex combinations) · abstract math space

Ref `2.webp` panel 3: floating rulers, set squares, protractors, cubes and equations in white
space; no ground: the "floor" is a giant **ruler platform** (with tick marks and numbers) plus
smaller floating shapes at other heights. Platforms can **tilt, slide and be cut**. Lighter,
airier hatching than the city; the geometry itself is the set.

- **0–1**: Page turn clears; both fall in from above and land on the long ruler, short swords
  in hand (the ruler bounces/tilts under the landing).
- **1–7**: Short swords at speed, then the **reach upgrade**. A knocks B's shortsword away
  (it spins off and sticks into a floating cube). B wrenches the long arm off a drawing
  **compass** / pulls the hypotenuse off a triangle → a **spear**. Now B has reach and uses it:
  thrusts, sweeps, keeps A out. A's shortsword is too short: it is knocked from his hand or
  snapped; A slides down the tilting ruler and draws a **longsword** out of the ruler's edge
  line (a straight line becomes a blade).
- **7–16**: Longsword vs spear, the most technical exchange of the film. Long choreographed
  phrases (6–8 beats each): parry-riposte chains, the spear's butt-end strike, A stepping
  *onto* the spear shaft and running up it, a spin under a sweep, both leaping between
  floating shapes; B's missed thrust impales a floating cube and he swings the cube on the
  spear like a mace until A slices it off. The camera should travel with them: long tracking
  moves, a rotation as the ruler tilts.
- **16–22** (B drives the spear **through the ruler platform** and levers it) the ruler
  splits; A cuts the other half free; platforms collapse. Final frame: the broken ruler halves
  falling away, both fighters dropping through white space, A with the longsword, B with the
  spear, the page beginning to tear around them.

## Scene 3b: Ink Shots (20 s, a firearm) · Graph Paper Range

Added at the client's request: one scene with a **firearm, shooting effects and damage**. It sits
between the Geometry Zone and the Torn Paper Battlefield and has to explain why the next page is
in tatters: this is where the notebook gets shot to pieces. The gun is a *shortcut that fails*:
it out-ranges every blade, wrecks the page, hits no one, runs dry, and is destroyed; the fight
returns to steel, heavier than before.

Location: a sheet of **graph paper** (a fine square grid instead of ruled lines; draw it in a
custom `page` hook) on which someone has doodled a shooting gallery: target rings, a shelf line
with bottles and cans, a big **ink bottle**, a stapler and paperclips as cover, and: in the
margin: a doodled **revolver**. Every prop is breakable and must show its damage. No lettering.

- **0–1.5**: Page turn clears; both drop in from the fall that ended scene 3 and land on the
  grid, A with the longsword, B with the spear. A breath, a stand-off.
- **1.5–5**: Longsword vs spear, short and sharp, ending with A beating the spear out of B's
  hands: it sticks upright in the page. B, empty-handed and backing away, bumps the margin and
  finds the doodled revolver: he **peels it off the page** (`draw` cue; its dashed outline stays
  behind), weighs it, levels it. A freezes.
- **5–11**: **Six shots.** Each has recoil you can see (hand kicks, shoulders rock, a casing
  spins away) and each does *damage*: a hole punched through the page where A's head just was;
  bottles on the shelf bursting one by one as A sprints along it; the target doodle drilled;
  A diving behind the stapler as a round sparks off it; the ink bottle exploding in a black
  splash. The fifth is **bullet time**: slow motion, a visible ink slug crawling across the
  frame with shock rings, A turning the flat of the longsword into its path: spark, `clang`,
  the ricochet tears through the shelf. The sixth he cuts in half at full speed, already running.
- **11–15** (*Click.* Empty. B stares at the gun (a beat of comedy), throws it at A) A catches
  it, dunks the muzzle in the spilled ink (`reload`) and for three shots the tables turn: B, no
  dancer, yanks his spear out of the page and takes the rounds on the spinning shaft (sparks),
  loses a chunk of the floor in front of him, and simply **walks through it**. He swats the
  revolver out of A's hand with the spear and stomps it flat (`snap`); it stays crushed on the
  floor.
- **15–20**: Steel again, angrier. Three or four heavy exchanges across a floor that is now
  riddled with bullet holes: and the holes run in a **line**. The page begins to tear from
  hole to hole like a perforation (`tear` cues, cracks joining the holes). B's last overhead
  blow lands on the line. Final frame: the sheet ripping along the dotted line of bullet holes
  and folding away under them, both dropping, A with the longsword, B with the spear.

Rules for this scene: nobody is shot. No wounds, no blood, no bodies hit. Bullets are dodged,
deflected, or hit paper, props and weapons. The spear and longsword must survive intact (scene 4
breaks them itself). Use `S.shot` for every round (ENGINE.md → Firearms).

## Scene 4: Torn Paper Battlefield (28 s, heavy weapons) · ripped and layered paper

Ref `2.webp` panel 4: a landscape of **ripped, layered notebook paper**, with torn edges, holes
showing black underneath, curled and folded flaps as ramps and cover, floating scraps; deep
cross-hatched shadow under every lifted layer. This is where **weight** becomes the subject:
slow preparation, huge impact, long follow-through, the ground reacting to every blow.

- **0–1.5**: Page turn clears; they land hard on torn paper (A rolls, B craters).
- **1.5–9**: **Axe.** B's spear is cut in two by A's longsword. B plants his feet, rips a
  great strip of the page up and **folds it** (origami, three sharp folds) into a
  **battle axe**. The first swing takes 0.4 s to wind up and buries itself in the ground,
  splitting a paper layer; A's longsword parries one blow and is driven to the ground by it;
  the next blow **breaks the longsword** (`shatter`). A is now unarmed against an axe:
  pure evasion: slides under, runs up a folded ramp, uses a flap as a shield (it is cut in
  half), kicks B in the head off a rebound. Each missed axe swing carves a permanent rip.
- **9–18**: **Hammer.** A traps the axe (it wedges deep in a fold; B can't free it). B walks
  to a folded paper block, tears it loose on a shaft → a **large hammer**. Hammer blows hit
  the ground like artillery: the paper layer **see-saws**, launching A into the air; shock
  rings, scraps everywhere; one blow A dodges punches a hole straight through the page. A,
  running out of page, sees the cracks from an earlier impact forming a familiar outline:
  he plunges both hands into the fracture and **pulls out the oversized two-handed sword**
  (the foreshadowed greatsword; a long, effortful draw with a `shing`). It is almost too heavy
  for him: the first swings pull *him* around.
- **18–28**: **Greatsword vs hammer.** Slow, colossal, readable, with wind-ups you can see coming,
  clashes that stop both fighters dead (hit-stop + impact frame + shock ring), follow-throughs
  that spin them. A learns the weight: starts using its momentum (spinning cuts, vaulting on
  the planted blade). The final simultaneous swing meets in the middle and the shock **rips the
  whole page in two** along the ground line; ink wells up through the tear. Final frame: the
  page split, black ink surging up between the two halves, the fighters silhouetted against it
  with greatsword and hammer locked.

## Scene 5: Final Ink Arena (25 s, massive ink-forged weapons) · storm of ink

Ref `2.webp` panels 5–6: a climactic arena where paper and ink collapse together, with a raging
**ink storm** (flying ink streaks, a swirling vortex in the sky), ruined **arches, pillars and
bridges** with heavy cross-hatching, ink pooled on the floor with reflections, the highest
contrast of the film (large areas of solid black are welcome here; the page may be mostly ink).
Consider `page: false` / a custom `page` hook. Everything is at stake; everything gets broken.

- **0–1.5**: Page turn clears onto the storm; the fighters stand apart, weapons lowered,
  ink running up the blades as the **weapons grow** (`scale` 1 → ~1.8, `ink: 1`): a hammer the
  size of B, a sword taller than A.
- **1.5–10**: Massive weapons, rapid camera. Swings **topple pillars** (they fall and stay),
  shear an arch, send ink waves across the floor. Creative reversals: A runs up the hammer
  shaft; B catches the giant blade between his fists; A is batted through a pillar and comes
  back surfing an ink surge; B hurls a broken pillar. Use ink surges as hazards and as
  launch ramps.
- **10–19**: The duel compresses and accelerates into a continuous exchange where each clash is
  bigger (impact frames, shock rings, the vortex reacting), the arena being reduced to rubble
  around them, both visibly tiring (slower recoveries, lower stances).
- **19–25** (**The last clash.** Both wind up everything they have) a long, held
  anticipation (slow-motion beat, music suspended): and strike. The weapons meet and
  **shatter** into hundreds of ink strokes; the shockwave blows the storm, the ruins and the
  ink outward, wiping the frame **to pure white** by the end. Final 0.4 s: white frame (scene 6
  cuts in from it).

## Scene 6: The Last Line (20 s, unarmed, then a rifle) · the first page again, scarred

The blank notebook page from scene 1, after everything: cracks, skid marks, a torn edge, ink
flecks, the stump of the broken wall: and a doodled rifle by the set square.

- **0–8**: From white, the two figures, exhausted, take their opening stances again, staged in
  tight tilted close-ups (a head lifting, a fist clenching, a foot digging in). B launches the
  same flying overhand that opened the fight; A steps inside and throws him: the page craters.
  B rises and comes again; A slides under the haymaker and lands the spinning kick in slow
  motion. B is launched into the wall stump and slides down flat.
- **8–11** (B is down but alive: small, weak movements) a fist twitching, a hand dragging,
  the head lifting, one attempt to push up that gives out.
- **11–18.6**: A turns away, sees the doodled rifle, peels it off the page, and walks back with
  slow heavy steps. B hears him, tries once more to rise, cannot. A works the bolt, shoulders
  the rifle and levels it at him; B turns his head and lifts a hand. The camera pushes in along
  the barrel; the music is gone.
- **18.6**: He fires. **The shot is never seen.** On that instant the picture hard-cuts to
  black and only the shot's sound rings out. Black to the end of the scene.

## Credits (14 s)

White hand-lettering on black: the title, "directed by Lauro Guedes", "animated by Claude
Fable 5.2", each credit beside a tilted panel replaying short moments of the fight.

---

## Shared conventions

- A is always drawn in front of B unless a scene says otherwise.
- World layout is yours per scene; keep main action roughly between x 400 and 2200 so the
  default page and camera anchor work, or pass your own `page` to `createScene`.
- Escalation of **camera shake / impact frames / debris** should follow the tier: scene 2
  small and sharp, scene 3 fast and clean, scene 4 heavy and slow, scene 5 enormous.
- Fighters stay stick figures: no added anatomy, no costume, no faces.
