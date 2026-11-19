---
name: stick-figure-film
description: Make a complete 2D animated short film where every frame is drawn in code: minimalist stick-figure (or other simple line-art) characters, hand-drawn ink/hatching look, choreographed action, cinematic camera, synced sound effects and music, rendered to MP4 with Node canvas and ffmpeg, no video-generation model. Use this skill whenever the user wants an animated short, fight scene, action sequence, music-less cartoon, "stick figure" or "stickman" animation, notebook/doodle/ink-style animation, a procedural or code-drawn video, a storyboard brought to life, or asks to extend, re-cut, polish, add a scene to, or make social clips from a film made this way, even if they only describe the story and never mention code.
---

# Stick-figure film

Make an animated short the way a small studio would, except that the "drawing" is code: a rig,
pose keys, a keyframed camera, effects and a sound cue sheet, all rendered deterministically.
The bundled engine produced a 3-minute, seven-scene action film; this skill is the method that
got it there, including what went wrong on the way.

The engine is a starting point, not a cage. It ships two stick figures (B optional), twelve
weapon types, an ink/hatching look and a notebook world, and its vocabulary is a fighter's
(`S.fighters`, `S.hit`, "weapons") because that is what it was built for. It handles non-fight
stories too: a chase, a prop, a fall, a comic beat. The trial film of a stick figure chasing a
paper plane used the same rig, `flight()`, world-pinned hands and env hooks. Other looks change
`ink.js` and the scene hooks.

**The look follows the brief, not this skill.** The engine's art rules (pure black and white,
hatching only, faceless figures, no text) were the brief of the film it came from. They are good
defaults when the user asks for ink or notebook style. When the brief says otherwise (colour,
a smiling face for a children's piece, a hand-written "YAY!"), follow the brief and adapt the
drawing code.

## What makes this hard (read this first)

You cannot watch the film or hear it. Everything you know about it comes from still frames and
measurements. Three consequences shape the whole method:

1. **Look constantly.** A pose cannot be judged from its numbers. Render contact sheets after
   every substantial edit and read the image. A 12-frame sheet takes about two seconds.
2. **Say what you verified and how.** "Checked on contact sheets at 0.25 s; not watched in
   motion, not heard" is the honest status of nearly everything you deliver. Timing feel, music
   and mix are the user's to judge; tell them so each time you hand over a render.
3. **Get a human look early.** Deliver a short prototype before building the film, and expect
   notes that could not be predicted from stills (the first big one on the original film was
   that a simulated 3D camera move "didn't turn out well").

## Workflow

### 0. Pick the path

- **Small film** (one scene, up to ~30 s): skip the story bible and the per-scene agents. Copy
  the template, write one scene file, review, render, deliver. This is the common case.
- **Long film** (several locations, a minute or more): follow steps 1–7.
- **Nobody to ask** (the user said not to ask questions, or is away): make sensible choices,
  build the whole thing instead of stopping at a prototype, and list every choice you made in
  the delivery message so the user can overturn it.

### 1. Brief → prototype first

Read the brief for: characters and how they differ in movement, the look, the story beats, the
length, what is forbidden (gore, text, colour…), the deliverable format. If the user supplies
boards or references, look at them; where text and images disagree, follow the text and say so.

Then build **15 seconds** (or the whole film, if it is shorter) and stop for approval. Scaffold
the project by copying `assets/template/` into the working folder, copying `references/engine.md` into it as `ENGINE.md` (agents read it there),
and running `npm install` (Node 20+ and `ffmpeg` are required; the only dependency is
`@napi-rs/canvas`). The template has two example scenes:

- `src/scenes/minimal.js` (≈70 lines, on the timeline): one character, a prop picked up off the
  page, a jump, a camera move, sound cues and a friendly score. Start new scenes from this.
- `src/scenes/ref_poc.js` (≈650 lines, `--scene ref`): a complete 15-second two-character fight:
  impact frames, slow motion, a breakable wall, a weapon pulled out of the set, page damage.
  Too long to read in one go; read the parts you need (search for `S.weapon`, `S.camera`,
  `makeBrickWall`, `S.slowmo`).

Read `references/engine.md`, write the user's scene as a new file in `src/scenes/`, and replace
`minimal` with it in `ORDER` in `src/film.js`.

Deliver the prototype MP4 with: what happens beat by beat, what you could and could not verify,
and where you departed from the brief. Wait for approval before making the film.

### 2. Story bible

Once approved, write `STORY.md`: one table row per scene (file, film time, duration, location,
what each character holds at the start and at the end, how the scene arrives), then a beat
outline per scene. The start/end states are the contract that lets scenes be made independently
and still join. Escalation must be *motivated*: a weapon breaks, is lost or is outmatched, and
the character takes something bigger from the world. `references/production.md` has the template.

Keep an eye on total length against the brief's maximum from the start; every later addition
(a new scene, slow-motion inserts, credits) spends from that budget.

### 3. One scene per file, one agent per scene

Each scene is one file that owns its choreography, camera, effects, cues and set. That makes
scenes independent, so build them in parallel: one subagent per scene, each owning exactly one
file. Brief them with the template in `references/production.md`; it carries the ownership
rules, the review habits and the report format that made the reports trustworthy (beats with
times, last-frame positions, impact frames, **the three weakest moments**, engine friction,
lint summary).

Things that matter when delegating:
- Tell agents to write the scene file early and save often. Long parallel work hits usage
  limits; saved files survive and a resumed agent continues where it stopped.
- Agents must not edit the engine. Collect their "engine friction" notes and fix the engine
  yourself between rounds, so two agents never patch the same file.
- An agent's report is a claim, not proof. Render an overview sheet of every scene yourself
  before telling the user it is done, and report which scenes you reviewed closely and which
  you know only from the agent's account.
- Without subagents, make the scenes yourself one at a time, in story order.

### 4. Sound

Scenes emit cues (`S.hit`, `S.land`, `S.step`, `S.whoosh`, `S.shot`, raw `S.cue`), so picture and
sound cannot drift. `tools/audio.mjs` turns the assembled cue sheet into the soundtrack with a
built-in synthesizer: no assets, no network, exact length, loudness-normalised. That is the
default and it always works.

**Choose each scene's music** with `createScene({ score: '…' })`: `duel`, `chase`, `clockwork`,
`heavy`, `climax`, `aftermath` (the fight scores), `playful` (friendly, for anything gentle) or
`none` (effects only). A scene without one gets the fight score `duel` and a warning, which is wrong for
a children's piece. Write your own score function when none fits (`references/sound.md`).

Generated audio (ElevenLabs effects and score via `tools/soundlib.mjs`) is optional and spends
the user's credits. Read `references/sound.md` before using it: the procedure there (read the
current API docs, check the balance, state an estimate, get an explicit cap, cache everything)
exists because each step was needed once.

### 5. Assemble, review, render

Add scenes to `ORDER` in `src/film.js` (`in: 'cut' | 'pageturn'`). Then, every time:

```bash
node tools/lint.mjs                      # teleports, limbs under the floor, weapon pops, framing
node tools/sheet.mjs --from 0 --to <end> --n 48 --cols 8 --cw 320 --out out/overview.png
node tools/audio.mjs --stats             # soundtrack + loudness / per-scene levels
node tools/render.mjs                    # out/film.mp4 (1920×1080, 30 fps, H.264 + AAC)
```

After rendering, verify the file rather than assuming: `ffprobe` for duration and frame count,
frames pulled from the MP4 at the cuts and the ending, loudness and true peak from
`ffmpeg -i out/film.mp4 -af ebur128=peak=true -f null -` (measure the MP4, not the WAV: the AAC
encode adds about a decibel of peak). If the brief demands a strict palette, count off-palette
pixels on raw frames.

### 6. Polish pass

When the user is happy with the shape, send each scene back to its agent with *its own* list of
weakest moments, plus fixed constraints: duration, first and last frame, any moment other
things are fitted to (music hits, slow-motion inserts, clips reused in credits). Targeted, not
a rework. `references/production.md` has the polish brief.

### 7. Ending, credits, social cuts

`src/credits.js` makes end credits with short replayed clips (edit `TITLE` and `CARDS`, then
enable it in `film.js`). `tools/social.mjs` makes a cold-open teaser, vertical clips (the camera
is re-framed on the characters, not blindly cropped) and a thumbnail. Don't put a spoiler or a
weapon aimed at a person on the thumbnail.

## Craft rules that came from mistakes

These are the corrections that mattered. Each one cost a round to learn.

**Readability beats everything** (most of these are about two characters; the same idea,
one clear silhouette per thing that matters, applies to a character and a prop).
- Keep the two characters 150–260 units apart while they trade blows; step in to strike and
  back out. Merged silhouettes were the most common defect in every scene.
- Strikes land at full limb extension with the torsos apart; the one who is hit needs a
  reaction key on the same frame, usually with travel.
- Grapples, holds and binds need daylight between the bodies: hold the other figure at arm's
  length rather than hugging.
- Don't stage an exchange where props or rubble sit behind the legs.

**Weight is animated, not implied.** Anticipation before, hit-stop on, follow-through after.
A throw that takes 0.3 s reads as a glitch; give it a catch, a held wind-up, a whip and a
release. Heavy weapons need 0.3–0.45 s of visible wind-up and drag their wielder afterwards.

**Camera: closer and moving.** The note that changed the film most: the user wanted tight
close-ups with a moving camera (push-ins, roll, slides, whip pans between the characters),
not wide static shots where the figures are small. Let oversized props run out of frame.
Use a wide only briefly to establish scale.

**Don't fake a third dimension.** A simulated "orbit" (foreshortening the plane and sliding
parallax layers) was built on request and rejected on first viewing. For a "Matrix" moment use
`S.bulletTime`: the action nearly freezes while the camera cuts in with moving close-ups.

**Variety.** Five clashes with the same crossed-overhead composition read as one clash five
times. Vary the line of attack, the height and who is airborne.

**Small things must be big to read.** A 12-unit twitch for three frames is invisible. If a
detail carries story (a hand moving, a reload, a broken object), give it a close-up and a hold.

**State changes need cover.** An instant swap (a weapon changing look, a mirror flip) pops.
Hide it inside an impact frame, a flash or a camera cut.

**Non-fight scenes.** A chase needs the camera to hold both the chaser and what is chased;
keep it short and cut closer rather than holding a wide shot where both are tiny. A fall or
trip reads through anticipation (the foot catching), the fall itself and a held beat on the
ground. A prop that carries the story needs its own close-up.

**Violence and tone.** Follow the brief's limits literally and keep them when the user adds
firearms or a dark ending: bullets are dodged, deflected or hit the set; a decisive shot can
land on a hard cut to black with only its sound. Implication is stronger and safer than
depiction.

**Lengths ripple.** Changing a scene's duration after the music exists invalidates that
music. Fix durations before generating audio; afterwards, polish inside the existing length.

## Reference files

- `references/engine.md`: the authoring API: poses, jumps, weapons and firearms, camera,
  bullet-time close-ups, contacts and sound cues, environment hooks and kit, art rules, scene
  contract, tools. Read it before writing or editing any scene.
- `references/production.md`: story-bible template, the scene brief and polish brief for
  subagents, the review checklist, the delivery report format.
- `references/sound.md`: cue types, the synthesizer, per-scene music, the ElevenLabs
  procedure and its budget rules, the "full stop" trick for an ending.
- `assets/template/`: the project scaffold: engine (`src/engine/`), tools (`tools/`), the
  minimal and the full example scenes, a weapon gallery scene, preview player.
