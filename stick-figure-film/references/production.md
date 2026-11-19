# Production templates

Contents: story bible · scene brief (for one agent per scene) · polish brief · review checklist ·
delivery report.

## Story bible (`STORY.md`)

```markdown
# <FILM> — story bible (<m:ss>)

> One-line vision.

**Character A — <name>.** How they look (minimal) and, more importantly, how they MOVE.
**Character B — <name>.** The contrast. They must be recognisable by silhouette and motion alone.

Rule of escalation: each upgrade is motivated by the choreography (something breaks, is lost,
or is outmatched), never an arbitrary equipment change.

| # | File | Film time | Dur | Location | Tier | Arrives by | Starts holding | Ends holding |
|---|---|---|---|---|---|---|---|---|
| 1 | `s1_….js` | 0:00–0:20 | 20 s | … | unarmed | — | nothing | nothing |
| 2 | `s2_….js` | 0:20–0:42 | 22 s | … | light weapons | page turn | nothing | A: … · B: … |

## Scene 1 — <title> (<dur>, <tier>) · <location>
One paragraph on the set and what makes it different from the others.
- **0–3** — beat
- **3–9** — beat
- **…** — Final frame: the image the next transition freezes on.
```

Notes:
- "Starts holding / ends holding" plus the final frame are the join between scenes. Scene N's
  ending state must equal scene N+1's opening state.
- Give each location one idea that the fight can use (a see-saw platform, rooftops with a gap,
  paper that tears). The set is part of the choreography, and damage persists.
- Vary the *subject* of each scene, not only the weapon: speed, reach, weight, scale.
- Timings in beats are guides; durations and start/end states are fixed.

## Scene brief (one agent, one file)

Fill the brackets. Send all scene briefs in one message so the agents run in parallel.

```
You are animating ONE scene of a <length>, <look> procedurally drawn film ("<FILM>"). Other
animators are building the other scenes in parallel in the same project, so file ownership is
strict.

Project: <absolute path> (Node, ES modules; run everything from that folder).

Read first, in this order:
1. ENGINE.md — the authoring guide (API, tools, animation principles, art rules, scene
   contract). Read all of it.
2. STORY.md — intro, table, shared conventions, and YOUR scene closely; skim the scenes before
   and after yours for continuity.
3. src/scenes/ref_poc.js — a complete, approved scene. It is the quality bar and the best
   source of working pose keys, camera moves and environment code. Render it to see it:
   `node tools/sheet.mjs --scene ref --from 3 --to 6 --n 16 --cols 4 --out out/review/<id>/ref.png`
   (src/scenes/minimal.js is a 70-line version of the same API, easier to read first)
4. <any reference boards — view them with the Read tool>

YOUR SCENE: <n> — "<title>". File: src/scenes/<file>.js, id '<id>', duration <d> s.
<Opening state. Closing state and final frame. The tier and what this scene is about. Hard
rules for this scene. Anything to reuse from the reference scene.>

Ownership rules
- You own exactly one file: src/scenes/<file>.js (a placeholder — replace it). Keep `id` and
  `duration` exactly.
- Do NOT edit src/engine/, tools/, other scenes, src/film.js, src/cues.js or the docs. If the
  engine lacks something, work around it inside your scene file and tell me in your report. If
  you hit a real engine bug, report it precisely (file, function, reproduction) rather than
  patching it.
- Review images go in out/review/<id>/. Don't create other project files. Always pass
  `--scene <id>`; don't render the whole film; don't leave an mp4 behind.
- Write the scene file early and save often so progress survives an interruption.

How to work
- Passes: (1) environment + rough blocking for the whole duration, (2) full choreography,
  (3) contacts lined up with tools/probe.mjs, effects, sound cues, (4) camera, (5) polish.
- After every substantial edit render contact sheets and LOOK at them (Read the PNG). Use
  `--stage x,y,zoom` to judge poses and the film camera to judge framing. Before you finish,
  review the entire scene at ≤0.25 s spacing through the film camera, plus close sheets
  (≤0.07 s) of every major contact, and fix what reads badly: merged silhouettes, limbs bent
  the wrong way, hands or weapons not touching what they hit, feet sliding, characters out of
  frame or tiny, dead air, clutter behind the characters.
- Camera: prefer tight, moving framing (push-ins, roll, whip pans) over wide static shots.
- Run `node tools/lint.mjs --scene <id>` and get it clean or explain each remaining line.
- Density: something changes roughly every half second; hold still only on purpose. Expect
  roughly 8–10 pose keys per character per second in fast passages.
- Sound: every swing, contact, landing, break and pickup needs a cue (use the S.hit / S.land /
  S.step / S.whoosh / S.skid helpers so picture and sound stay in sync).

Done means: the scene plays its full duration with no placeholder stretches, meets the brief
(opening state, closing state, final frame), follows the art rules, lint is clean or
explained, and you have looked at all of it.

Report back (concise): what happens beat by beat with times; where each character and prop is
at the last frame; the impact-frame times; the 3 weakest moments you would fix with more time;
anything in the engine that got in your way; lint summary. I cannot see your images, so be
honest about what does not read well — I will check the scene myself.
```

Before launching: put a tiny valid placeholder in every scene file (two keys per character, a
static camera, the right `id` and `duration`) so `src/film.js` imports cleanly and every tool
runs while scenes are still being written.

If agents are cut off (usage limits), check that each file still builds
(`node tools/lint.mjs`), then message each agent to continue where it stopped — do not start
new agents for the same scene.

## Polish brief

```
Polish pass on your scene <n> (src/scenes/<file>.js). Targeted, not a rework: fix the items
below, leave everything else alone. Same ownership rules, tools and review habits.

Fixed constraints
- `duration` stays <d>. Opening state and last frame stay (transitions depend on them).
- <Moments other things are fitted to: music hits, slow-motion inserts (authored time and the
  screen-time shift they cause), passages replayed in credits, the exact time of a cut.>

Fix these (your own weakest moments from the last report)
1. <moment, time, what is wrong, the direction of the fix>
2. …
Smaller notes: fix if cheap.

Review every changed passage on close sheets (≤0.07 s) through the film camera, run the lint,
and report briefly: what you changed (with times), what still does not read, lint summary.
```

## Review checklist (yours, per scene)

Render `node tools/sheet.mjs --scene <id> --from 0.2 --to <end> --n 36 --cols 6 --cw 427` and
look for:

- Does every frame show who is who? (line weight, size, stance)
- Any frame where the two figures are one blob?
- Are the characters large enough in frame? Any wide shot held longer than it needs?
- Does each contact have a visible cause and a visible reaction?
- Do props that were broken stay broken?
- Is the final frame a clean composition that matches the next scene's opening?
- Lint: only the expected lines?

Then check the joins on a film-time sheet around each scene boundary, and the ending and
credits on frames pulled from the rendered MP4.

## Delivery report (to the user)

Lead with what exists and its status, then:

- file, length, resolution, where it is;
- what was checked and how (contact sheets, measurements) and what was not (motion, sound);
- what changed since the last version, by scene;
- what still does not read well — the agents' weakest moments, unsoftened;
- anything spent (generation credits) and anything that departs from the brief;
- the one decision you need from them, if any.
