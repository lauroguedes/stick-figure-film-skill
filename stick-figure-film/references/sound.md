# Sound

The soundtrack is built from a cue sheet, not edited by hand. Scenes emit cues; `src/cues.js`
assembles them into film time; `tools/audio.mjs` renders `out/soundtrack.wav` (48 kHz stereo,
exactly the film's length, loudness-normalised); `tools/render.mjs` muxes it.

You cannot hear the result. Judge it by measurement (`node tools/audio.mjs --stats`,
`ffmpeg -i out/soundtrack.wav -af ebur128=peak=true -f null -`) and tell the user the mix is
unheard.

## Cues

Emit cues through the scene helpers so picture, sound and camera shake share one call:
`S.hit`, `S.land`, `S.step`, `S.whoosh`, `S.skid`, `S.shot`, and `S.cue({ t, type, x, weight, dur })`
for anything else. Give `x` (world position) and the pan is computed from the camera.

Types the mixer knows: `scribble draw whoosh heavyswing slice step thud stomp hit block clack
clang slam snap skid pop boom wallbreak crumble tear crack shing shatter inksplash rumble
thunder wind riser slowdown heartbeat megaimpact pageturn cuthit gunshot ricochet bulletimpact
bulletwhiz shell dryfire reload rifleshot riflecock`. Unknown types warn once and are skipped,
so a typo is silent in the film — read the mixer's output.

Rules of thumb:
- Every significant action gets a cue; sound is half of an impact.
- One `megaimpact` per scene at most. Impact frames (`S.impact`) are also musical accents.
- `S.musicHint(from, to, 'suspend' | 'aftermath' | 'surge')` shapes the music: drop it for slow
  motion, stop it after a catastrophe, push it for a climax. `S.slowmo` and `S.bulletTime` add
  a suspend themselves.

## Choosing the music

Each scene names its score style: `createScene({ id, duration, score: 'playful' })`.

| Style | Sound |
|---|---|
| `duel` | tense martial-arts taiko groove, sparse for the first 3 s |
| `chase` | fast, light, syncopated woodblocks and toms |
| `clockwork` | precise driving sixteenths, metallic ticks |
| `heavy` | half-time, huge low drums, growling bass |
| `climax` | fastest and densest, dark pad |
| `aftermath` | sparse low hits, one resolving tone |
| `playful` | friendly D-major marimba, pizzicato and woodblock loop with a button ending |
| `none` | effects only |

All but `playful` are fight scores. A scene with no `score` falls back to `duel` with a warning.

## The built-in synthesizer (default)

`node tools/audio.mjs` with no library present synthesizes everything: layered recipes per cue
type and a percussive score arranged per scene. It needs no assets or network and is
deterministic. `--engine=synth` forces it.

Useful flags: `--stats` (per-scene levels, limiter activity), `--solo=sfx|music --out=<path>`,
`--audition=type,…` (renders cue types alone, in a row).

**Checking sound you cannot hear.** Render each bus alone (`--solo=sfx`, `--solo=music`), then
look at it: `ffmpeg -i out/sfx.wav -lavfi showspectrumpic=s=1600x500 out/spec.png` shows where
every cue lands and where the music stops; `astats` on short windows gives levels per moment.

**Writing a score.** A style is an entry in `STYLE` in `tools/audio.mjs`
(`{ bpm, gainDb, score: (ctx) => …, sub, accent, fill, drone }`); start from `scorePlayful`.
Inside a score function: `ctx.start` / `ctx.end` (the scene's film time), `ctx.grid(from, to,
bpm)` (a tempo grid stretched to whole bars), `ctx.seq(grid, fn)` (a sixteenth-step sequencer),
`ctx.voice(buffer, t, dB, pan, hall)` and `ctx.drum(name, t, velocity)` — both are silent
inside `suspend` / `aftermath` hints, so slow motion drops out by itself. Instrument buffers:
`marimba(hz)`, `pizz(hz)`, `glock(hz)`, `bassNote(...)`; pitches with `hz(semitones, D2)`.
To fit music to the picture, have the scene emit `S.cue({ t, type: 'mark', name: 'catch' })`
and read the marks from `CUES` in the score (`scorePaperPlane` is a worked example).

**Adding a sound.** Write a recipe `function name(c, rng, out)` that builds a buffer and calls
`out.mono(buffer, { room, hall })`, add it to the `RECIPES` table and give it a level in
`LEVEL_DB`. `rustle`, `whistle` and `chime` are short examples.

Targets: integrated −14…−11 LUFS, true peak ≤ −1 dBFS **measured on the final MP4** (the mixer
limits the WAV to −2 dBTP because the AAC encode adds about a decibel), the climax the loudest
scene, a quiet ending clearly quieter (≥ 10 dB below the climax).

## Generated audio (ElevenLabs) — optional, costs the user's credits

`tools/soundlib.mjs` generates a cached library (`assets/audio/sfx/<type>/<variant>.wav`,
`assets/audio/music/<scene id>.wav`, `assets/audio/manifest.json`); the mixer then uses it
automatically and falls back to the synth for anything missing.

Procedure — follow it in order:

1. **Only when the user asks for it**, and has put a key in the environment or a `.env`
   (`ELEVEN_LABS_API_KEY`). Read the key at run time; never print it, log it or write it to a
   project file. Send only generic sound prompts to the service.
2. **Read the current API docs first.** Model ids and limits change. On the original film the
   user asked for a "v4" sound-effects model that did not exist; the right move was to use the
   newest listed model and tell them. The model ids are `SFX_MODEL` and `MUSIC_MODEL` at the top
   of `soundlib.mjs`.
3. **Find out what it will cost**: `node tools/soundlib.mjs plan`. Effects are priced per
   second; music per minute at a rate the docs may not state — say when a figure is assumed.
4. **Check the balance**: `node tools/soundlib.mjs status`. A restricted key may be unable to
   read it. Then the tool cannot verify spend at all — say so.
5. **Get an explicit cap from the user**, then pass it: `generate --budget=<credits>`. The tool
   refuses to generate without one when the balance is unreadable. Ask again for every later
   top-up (new scene, new ending); an earlier approval does not cover it.
6. Generation can stall on the network. Finished files are cached and are never regenerated
   without `--force`, so just re-run.
7. Tell the user to check the licence terms of their plan before publishing.

Editing the plan: effect prompts and variant counts are `SFX_PLAN` in `soundlib.mjs`; music
prompts are `MUSIC_PLAN`, keyed by scene id — the bundled entries are from the original film,
so replace them with one per scene of yours (keep one key and
related tempos across scenes so the joins work, and ask for instrumental). Scene music is
generated to the scene's length, so **fix durations first**: changing a scene's length later
means paying to regenerate its music.

Generated music does not follow timing instructions reliably. Fit it in the mixer instead
(`MUSIC_LIB.fit` in `audio.mjs`: skip the start, shift so the big moment lands on the picture's
big moment, shape the level). Those numbers are hand-fitted to one file; redo them if the cue
is regenerated.

## An ending that lands: the full stop

For a hard cut on a single sound (a shot, a slam, a door), the mixer supports a full stop: at a
`rifleshot` cue (the set of such types is `STOP_TYPES` in `audio.mjs`) everything else — music and every ringing tail — is cut to digital silence
until the scene boundary, and only that sound and its tail play over black. Put the cue exactly
on the picture cut. If end-title music follows, start it a second or two later so the tail
rings alone.

## Social cuts

`tools/social.mjs teaser` re-cuts sound with the picture from an effects-only stem
(`audio.mjs --solo=sfx`) over a continuous bed made from two of the generated score cues, so the
music does not jump at every cut. Without generated music the teaser carries effects only.
