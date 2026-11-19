#!/usr/bin/env node
// Generated sound library (ElevenLabs sound effects + per-scene score).
//
//   node tools/soundlib.mjs status                 → account credits + what is on disk / missing
//   node tools/soundlib.mjs plan                   → what `generate` would create and what it would cost (no API calls)
//   node tools/soundlib.mjs generate               → generate everything that is missing (never overwrites)
//   node tools/soundlib.mjs generate --budget=12000 → required when the key cannot read the balance: the most
//                                                    credits this run may use (by estimate)
//   node tools/soundlib.mjs generate --sfx | --music
//   node tools/soundlib.mjs generate --type=hit [--variant=heavy_2] [--force]     → (re)generate one effect
//   node tools/soundlib.mjs generate --scene=s3b [--force]                        → (re)generate one scene's music
//   node tools/soundlib.mjs generate --scene=s6 --length=20 --force               → … for a scene length (s) that
//                                                                                    src/cues.js does not have yet
//
// Files:  assets/audio/sfx/<type>/<variant>.wav   assets/audio/music/<scene id>.wav   assets/audio/manifest.json
// Everything is converted to 48 kHz stereo 16-bit WAV with ffmpeg as it arrives, so the mixer
// (tools/audio.mjs) only ever reads WAV. Existing files are never regenerated without --force.
//
// The API key is read at run time from the environment (ELEVEN_LABS_API_KEY or ELEVENLABS_API_KEY)
// or from a .env file in the project folder or its parent. It is never printed or written anywhere.
// Only the generic prompts below are sent to the API.
//
// API (docs read 2026-11): POST /v1/sound-generation  (model eleven_text_to_sound_v3, 0.5–30 s, 40 credits/s
// with an explicit duration), POST /v1/music (model music_v2_5, 3 s–10 min, force_instrumental),
// GET /v1/user/subscription (character_count / character_limit = credits used / credit limit).

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// (STICK_FILM_AUDIO_ASSETS points the library somewhere else — used for testing the mixer)
export const ASSET_DIR = process.env.STICK_FILM_AUDIO_ASSETS ? resolve(process.env.STICK_FILM_AUDIO_ASSETS) : resolve(HERE, '../assets/audio');
const MANIFEST = join(ASSET_DIR, 'manifest.json');
const API = 'https://api.elevenlabs.io';

export const SFX_MODEL = 'eleven_text_to_sound_v3';     // newest sound-effects model in the docs (there is no v4)
export const MUSIC_MODEL = 'music_v2_5';                // newest music model in the docs
const SFX_CREDITS_PER_SECOND = 40;                      // docs: "40 credits per second" when a duration is set
const MUSIC_CREDITS_PER_MINUTE = 900;                   // pricing page, approximate — the real cost is measured
const MUSIC_TAIL = 1;                                   // seconds generated past the end of a scene, for the crossfade
const PROMPT_INFLUENCE = 0.5;
// Preferred output formats, best first; the first one the account's plan accepts is used for the rest of the run.
const SFX_FORMATS = ['wav_48000', 'mp3_44100_192', 'mp3_44100_128'];
const MUSIC_FORMATS = ['mp3_48000_320', 'mp3_48000_192', 'mp3_44100_192', 'mp3_44100_128'];

// ═════════════════════════════════════════════════════════════════════════════
// The plan: every cue type → variants. Tags pick a variant for a cue:
//   size: 's' | 'm' | 'l'   matches the cue's size          w: [lo, hi]   matches the cue's weight (or wallbreak size)
// Identity of the film's sound: close, dry, tactile foley — paper, pencil, wood, ink — with
// cinematic weight on the big impacts. No voices, no music inside the effects.
// ═════════════════════════════════════════════════════════════════════════════
const DRY = 'Close-miked, dry, tactile foley, no reverb, isolated sound effect, no music, no voices.';
const AIR = 'Dry, close, no reverb, no impact at the end, isolated sound effect, no music, no voices.';
const BIG = 'Cinematic, punchy, heavy low end, short tail, isolated sound effect, no whoosh before the hit, no music, no voices.';
const v = (id, dur, text, style, tags = {}) => ({ id, dur, prompt: `${text} ${style}`, ...tags });
const LIGHT = (hi) => ({ w: [0, hi] }), HEAVY = (lo) => ({ w: [lo, 1.01] });

export const SFX_PLAN = {
  whoosh: [
    v('s_1', 1, 'A single very short, quick whoosh of a fist jabbing past the microphone, fast tight air swish.', AIR, { size: 's' }),
    v('s_2', 1, 'A single short sharp swish of a thin stick flicked quickly through the air.', AIR, { size: 's' }),
    v('s_3', 1, 'A single quick light whoosh of an arm snapping through the air, martial arts movement.', AIR, { size: 's' }),
    v('m_1', 1, 'A single fast martial arts whoosh of a leg kicking through the air, medium body, airy swoosh.', AIR, { size: 'm' }),
    v('m_2', 1, 'A single fast swoosh of a body spinning quickly past the microphone, cloth and air movement.', AIR, { size: 'm' }),
    v('m_3', 1, 'A single punchy whoosh of a wooden staff swung fast through the air.', AIR, { size: 'm' }),
    v('l_1', 1.2, 'A single big fast whoosh of a body flying past the microphone, long low airy swoosh with a doppler pass-by.', AIR, { size: 'l' }),
    v('l_2', 1.2, 'A single large powerful swoosh of someone leaping through the air, deep rush of air.', AIR, { size: 'l' }),
    v('l_3', 1.2, 'A single long sweeping whoosh, a big movement rushing past from one side to the other, low and full.', AIR, { size: 'l' }),
  ],
  heavyswing: [
    v('1', 1.5, 'A single deep, slow, heavy whoosh of a giant sword swung through the air, low rumbling swoosh passing the microphone with a pitch drop.', AIR),
    v('2', 1.5, 'A single heavy low swoosh of a massive hammer swinging past, weighty displacement of air.', AIR),
    v('3', 1.5, 'A single huge slow whoosh of an enormous heavy weapon cutting through the air, deep and menacing.', AIR),
    v('4', 1.5, 'A single deep bassy swoosh of a giant axe swing, slow and powerful, doppler pass-by.', AIR),
  ],
  slice: [
    v('light_1', 0.6, 'A thin sword blade slices through the air once, a very short bright airy swish.', AIR, LIGHT(0.7)),
    v('light_2', 0.6, 'A single quick razor-sharp blade swipe, a tiny fast high swish.', AIR, LIGHT(0.7)),
    v('heavy_1', 0.7, 'A sharp blade slices cleanly through a sheet of paper once, quick bright swish with a tiny rip.', DRY, HEAVY(0.7)),
    v('heavy_2', 0.7, 'A single fast sword cut through air and paper, sharp airy slice with a faint metallic edge.', DRY, HEAVY(0.7)),
  ],
  step: [
    v('light_1', 0.6, 'A single soft footstep of a light shoe on a wooden desk covered with paper.', DRY, LIGHT(0.6)),
    v('light_2', 0.6, 'A single quick footstep landing on paper over wood, with a small scuff.', DRY, LIGHT(0.6)),
    v('light_3', 0.6, 'A single light footstep on a hollow wooden floor.', DRY, LIGHT(0.6)),
    v('heavy_1', 0.7, 'A single heavy footstep stomping on a hollow wooden floor, weighty low thud.', DRY, HEAVY(0.6)),
    v('heavy_2', 0.7, 'A single heavy running footstep hitting wooden floorboards hard.', DRY, HEAVY(0.6)),
    v('heavy_3', 0.7, 'A single heavy boot step on paper-covered wood, deep and solid.', DRY, HEAVY(0.6)),
  ],
  thud: [
    v('light_1', 1, 'A single soft dull thud of a body landing on a wooden floor after a small jump.', DRY, LIGHT(0.5)),
    v('light_2', 1, 'A single muffled thud of feet landing on paper over a wooden desk.', DRY, LIGHT(0.5)),
    v('light_3', 1, 'A single short dull thump of a body bumping onto wood.', DRY, LIGHT(0.5)),
    v('heavy_1', 1, 'A single heavy body fall slamming onto a wooden floor, deep dull thud.', DRY, HEAVY(0.5)),
    v('heavy_2', 1, 'A single heavy landing from a high jump onto hollow wood, weighty low thump.', DRY, HEAVY(0.5)),
  ],
  stomp: [
    v('1', 1, 'A single huge foot stomp onto a hollow wooden floor, deep heavy boom with a rustle of paper.', BIG),
    v('2', 1, 'A single powerful stomp landing, heavy feet slamming down on wood, big low thump.', BIG),
    v('3', 1, 'A single giant stomp into a fighting stance, deep thud and a puff of dust.', BIG),
  ],
  hit: [
    v('light_1', 1, 'A single light punch landing on a body, quick dull smack.', DRY, LIGHT(0.55)),
    v('light_2', 1, 'A single quick jab hitting a chest, short fleshy thump.', DRY, LIGHT(0.55)),
    v('light_3', 1, 'A single fast punch impact on cloth and body, small and tight.', DRY, LIGHT(0.55)),
    v('medium_1', 1, 'A single solid punch to the body, meaty thump with a sharp smack.', BIG, { w: [0.55, 0.9] }),
    v('medium_2', 1, 'A single hard kick landing on a torso, dense body impact.', BIG, { w: [0.55, 0.9] }),
    v('medium_3', 1, 'A single strong punch impact, fist on body, thick and punchy.', BIG, { w: [0.55, 0.9] }),
    v('heavy_1', 1.2, 'A single massive punch impact, deep bassy body blow with a sharp crack, martial arts film style.', BIG, HEAVY(0.9)),
    v('heavy_2', 1.2, 'A single devastating kick impact, huge thump with a hard crack, exaggerated action movie hit.', BIG, HEAVY(0.9)),
    v('heavy_3', 1.2, 'A single enormous body blow, heavy low-end punch with a hard smack on top, trailer-style impact.', BIG, HEAVY(0.9)),
  ],
  block: [
    v('1', 0.6, 'A forearm blocks a punch once, a single short dry slap of arm on arm.', DRY),
    v('2', 0.6, 'A single quick parry, a hand slapping away a fist, tight fleshy smack.', DRY),
    v('3', 0.6, 'A single hard block, forearm against shin, dull short knock.', DRY),
  ],
  clack: [
    v('light_1', 0.8, 'Two wooden sticks tap together once, a single light dry woody clack.', DRY, LIGHT(0.5)),
    v('light_2', 0.8, 'A wooden pencil hits a wooden stick once, a single small sharp clack.', DRY, LIGHT(0.5)),
    v('heavy_1', 0.8, 'Two thick wooden staffs collide hard once, a single loud woody clack with a low knock.', DRY, HEAVY(0.5)),
    v('heavy_2', 0.8, 'A wooden staff strikes another staff with force, a single sharp crack-clack.', DRY, HEAVY(0.5)),
    v('heavy_3', 0.8, 'A single hard hit of a heavy wooden pole against wood, loud dry clack.', DRY, HEAVY(0.5)),
  ],
  clang: [
    v('light_1', 1.5, 'Two thin steel sword blades clash once, a single bright metallic clang with a short ring.', DRY, LIGHT(0.75)),
    v('light_2', 1.5, 'A single quick clang of a steel blade parrying another blade, bright and tight.', DRY, LIGHT(0.75)),
    v('light_3', 1.5, 'A metal ruler strikes a steel blade once, a single sharp metallic ting with a brief ring.', DRY, LIGHT(0.75)),
    v('heavy_1', 1.5, 'Two heavy steel swords collide once with great force, a single loud metallic clang with a low body and ringing decay.', BIG, HEAVY(0.75)),
    v('heavy_2', 1.5, 'A huge steel blade strikes a thick metal weapon once, a single massive clang, deep and ringing.', BIG, HEAVY(0.75)),
    v('heavy_3', 1.5, 'A single violent sword clash, heavy steel on steel, sharp attack and a long shimmering ring.', BIG, HEAVY(0.75)),
  ],
  slam: [
    v('medium_1', 1.5, 'A heavy hammer slams into wooden ground once, deep boom with a crunch.', BIG, LIGHT(0.8)),
    v('medium_2', 1.5, 'A big sword smashes down onto a stone floor once, heavy impact with a gritty crunch.', BIG, LIGHT(0.8)),
    v('heavy_1', 1.5, 'A giant hammer slams into the ground once with enormous force, deep booming impact, crunch and small debris falling.', BIG, HEAVY(0.8)),
    v('heavy_2', 1.5, 'A colossal weapon smashes into a wall once, huge low boom with a cracking crunch and debris.', BIG, HEAVY(0.8)),
    v('heavy_3', 1.5, 'A single massive ground slam, a heavy weapon hitting earth, deep sub thump, crunch and scattering rubble.', BIG, HEAVY(0.8)),
  ],
  wallbreak: [
    v('small_1', 2, 'A fist punches through a thin brick wall, a single crunching impact with a few bricks breaking.', BIG, LIGHT(0.7)),
    v('small_2', 2, 'A body crashes into a plaster wall and cracks it, a single crunchy impact with small debris.', BIG, LIGHT(0.7)),
    v('big_1', 2, 'A fist smashes through a thick brick wall, a single huge crunching impact with a deep boom and bricks bursting apart.', BIG, HEAVY(0.7)),
    v('big_2', 2, 'A wall bursts apart as a body is thrown through it, massive crash of bricks and plaster with a deep low thump.', BIG, HEAVY(0.7)),
    v('big_3', 2, 'A single enormous impact demolishing a brick wall, heavy boom, crack and collapsing rubble.', BIG, HEAVY(0.7)),
  ],
  megaimpact: [
    v('1', 3, 'A single colossal impact, an enormous slam shattering the ground, deep sub bass drop, cracking and debris, movie trailer hit.', BIG),
    v('2', 3, 'A single gigantic earth-shaking impact, massive low boom with a sharp crack on top and a long rumbling tail.', BIG),
    v('3', 3, 'A single apocalyptic slam, huge thud with deep bass, splitting ground and falling rubble.', BIG),
  ],
  cuthit: [v('1', 1, 'A single tight, dry, heavy hit, short punchy low thump with no tail.', BIG)],
  boom: [
    v('1', 2, 'A single deep sub boom, low soft impact with a short rumbling tail.', BIG),
    v('2', 2, 'A single dark low boom, distant heavy thump with deep bass.', BIG),
  ],
  skid: [
    v('1', 1, 'A shoe skidding across a sheet of paper on a wooden desk, short dry scrape.', DRY),
    v('2', 1, 'Feet sliding to a stop on rough paper, gritty scraping skid.', DRY),
    v('3', 1, 'A short dry friction slide of a body dragged across paper and wood.', DRY),
    v('4', 1, 'A quick scuffing skid of shoes on a dusty wooden floor.', DRY),
  ],
  crumble: [
    v('1', 2, 'Bricks and rubble crumbling and tumbling onto the floor, small chunks of debris falling and settling.', DRY),
    v('2', 2, 'A small collapse of broken plaster and stones, pieces dropping and rolling.', DRY),
    v('3', 2, 'Debris raining down after a wall breaks, bits of brick and dust falling and thinning out.', DRY),
  ],
  crack: [
    v('1', 1, 'Dry wood and plaster cracking and splintering, a sharp crackle spreading.', DRY),
    v('2', 1, 'A crack spreading through a brittle surface, dry snapping and crackling.', DRY),
    v('3', 1, 'Stone and dry paper cracking apart, quick splintery fracture sounds.', DRY),
  ],
  tear: [
    v('1', 1.5, 'A thick sheet of paper being torn slowly in half, crisp close ripping.', DRY),
    v('2', 1.5, 'Heavy paper ripping apart, a long tearing sound.', DRY),
    v('3', 1.5, 'A large page being torn quickly, sharp crackly paper rip.', DRY),
  ],
  snap: [
    v('1', 0.6, 'A wooden pencil snapping in half, a single sharp dry crack.', DRY),
    v('2', 0.6, 'A thin wooden stick breaking, a single crisp snap with tiny splinters.', DRY),
  ],
  shatter: [
    v('1', 1.5, 'A steel sword blade shattering into pieces, bright metallic break and fragments scattering on the floor.', DRY),
    v('2', 1.5, 'A metal weapon breaking apart, sharp metallic snap and small shards tinkling down.', DRY),
  ],
  shing: [
    v('1', 1.5, 'A sword being drawn from a metal scabbard, long bright metallic shing with a shimmering ring.', DRY),
    v('2', 1.5, 'A blade unsheathed quickly, sharp steel scrape and ringing shimmer.', DRY),
    v('3', 1.5, 'A long ominous metallic shimmer of a huge blade, slow steel ring.', DRY),
  ],
  inksplash: [
    v('1', 1, 'A blob of thick ink splashing onto paper, a single wet low splat.', DRY),
    v('2', 1, 'Thick liquid slopping and splattering on a table, wet heavy slosh.', DRY),
    v('3', 1, 'A single splash of thick paint hitting the floor, dull wet splat with drips.', DRY),
  ],
  scribble: [
    v('1', 1.5, 'A pencil scribbling quickly on paper, fast sketching strokes.', DRY),
    v('2', 1.5, 'Rapid pencil sketching on rough paper, short back-and-forth strokes.', DRY),
  ],
  draw: [
    v('1', 0.8, 'A single fast confident stroke of a felt-tip marker across paper, quick squeaky line.', DRY),
    v('2', 0.8, 'A pen drawing one quick decisive line on paper, short scratchy stroke.', DRY),
    v('3', 0.8, 'A single swift ink brush stroke across rough paper, brisk and clean.', DRY),
  ],
  pop: [
    v('1', 0.5, 'A single short cork pop.', DRY),
    v('2', 0.5, 'A single quick suction pop, small and tight.', DRY),
  ],
  pageturn: [
    v('1', 1, 'A large sheet of paper flipped over quickly, a big page turn with flutter and a soft flap.', DRY),
    v('2', 1, 'A big book page turning fast, paper whoosh and flap.', DRY),
  ],
  heartbeat: [
    v('1', 1, 'A single deep heartbeat, two muffled low thumps, lub-dub.', 'Close, dry, isolated sound effect, no music, no voices.'),
    v('2', 1, 'One slow heavy heartbeat heard from inside the body, soft low double thump.', 'Close, dry, isolated sound effect, no music, no voices.'),
  ],
  riser: [
    v('1', 2, 'A tense riser, airy whoosh rising steadily in pitch and volume, ending abruptly at its loudest point.', 'Sound design, isolated sound effect, no melody, no music, no voices.'),
    v('2', 2, 'A short rising whoosh build-up, pitch sweeping upward with growing intensity, hard stop at the peak.', 'Sound design, isolated sound effect, no melody, no music, no voices.'),
    v('3', 2, 'A fast reverse-swell riser, tension building upward quickly and cutting off suddenly.', 'Sound design, isolated sound effect, no melody, no music, no voices.'),
  ],
  slowdown: [
    v('1', 2.5, 'A time-slowing-down effect, a tape-stop pitch dropping down into a low muffled airy rumble, slow motion.', 'Sound design, isolated sound effect, no music, no voices.'),
    v('2', 2.5, 'A slow-motion whoosh, sound bending downward in pitch and stretching into a deep hollow drone.', 'Sound design, isolated sound effect, no music, no voices.'),
  ],
  rumble: [
    v('1', 4, 'A low deep rumble of the ground shaking, sustained earthquake tremor, no impacts.', 'Isolated sound effect, no music, no voices.'),
    v('2', 4, 'A sustained deep sub rumble, heavy vibration building and fading.', 'Isolated sound effect, no music, no voices.'),
  ],
  wind: [
    v('1', 10, 'Strong storm wind howling and gusting across an open plain, steady ambience, no rain, no thunder.', 'Isolated ambience, no music, no voices.'),
    v('2', 10, 'Fierce gusty wind blowing, whistling storm wind ambience, no rain, no thunder.', 'Isolated ambience, no music, no voices.'),
  ],
  thunder: [
    v('1', 4, 'A close thunder crack followed by a long low rolling rumble.', 'Isolated sound effect, no rain, no music, no voices.'),
    v('2', 4, 'A sharp lightning strike crack and deep rolling thunder fading away.', 'Isolated sound effect, no rain, no music, no voices.'),
  ],
  // firearms (scene s3b)
  gunshot: [
    v('1', 1.5, 'A single revolver gunshot, close, punchy and dry, sharp crack with a heavy low thump and a short tail.', BIG),
    v('2', 1.5, 'A single large-caliber revolver shot fired close to the microphone, loud punchy bang, dry.', BIG),
    v('3', 1.5, 'A single old western six-shooter gunshot, sharp and powerful, short echo-free tail.', BIG),
    v('4', 1.5, 'A single heavy handgun shot, tight explosive crack with strong low-end punch.', BIG),
  ],
  ricochet: [
    v('1', 1.2, 'A single bullet ricochet whining off metal, classic western ricochet zing fading away.', 'Isolated sound effect, no gunshot, no music, no voices.'),
    v('2', 1.2, 'A bullet glancing off stone, sharp ping and a descending whine.', 'Isolated sound effect, no gunshot, no music, no voices.'),
    v('3', 1.2, 'A single high-pitched bullet ricochet, quick metallic ping and whirring tail.', 'Isolated sound effect, no gunshot, no music, no voices.'),
  ],
  bulletimpact: [
    v('1', 0.8, 'A bullet punching through a thin wooden board, a single sharp crack and thunk with splinters.', DRY),
    v('2', 0.8, 'A bullet tearing through thick paper and cardboard, a short sharp punch and rip.', DRY),
    v('3', 0.8, 'A single bullet hitting wood, tight hard smack with a splintering crack.', DRY),
  ],
  bulletwhiz: [
    v('1', 0.6, 'A bullet whizzing past very close to the ear, a single fast sharp zip.', AIR),
    v('2', 0.6, 'A single fast bullet fly-by, quick snap and hiss.', AIR),
    v('3', 0.6, 'A bullet passing by at high speed, a short thin whizz.', AIR),
  ],
  shell: [
    v('1', 1, 'A single brass bullet casing dropping and bouncing on a hard concrete floor, small bright metallic tinkle.', DRY),
    v('2', 1, 'An empty shell casing falls onto a wooden floor and rolls, light metallic clink.', DRY),
  ],
  dryfire: [
    v('1', 0.5, 'An empty revolver dry fire, the hammer clicking on an empty chamber, a single metallic click.', DRY),
    v('2', 0.5, 'A single sharp click of a gun hammer falling on an empty chamber.', DRY),
  ],
  reload: [
    v('1', 2, 'A revolver being reloaded, cylinder swung open, bullets pushed in, cylinder spun and snapped shut.', DRY),
    v('2', 2, 'Loading a six-shooter revolver quickly, metallic clicks, cartridges sliding in, cylinder closing with a snap.', DRY),
  ],
  // the ending: the rifle (the shot is the film's full stop — see STOP_TYPES in tools/audio.mjs)
  rifleshot: [
    v('1', 3, 'A single bolt-action rifle shot fired outdoors very close to the microphone, a huge dry crack with a deep heavy body, followed by a long natural echo rolling away into silence.', 'One shot only, isolated sound effect, no music, no voices.'),
    v('2', 3, 'One enormous hunting rifle gunshot, close and brutally loud, sharp crack and deep boom, the echo ringing out for a long time across an open space.', 'One shot only, isolated sound effect, no music, no voices.'),
  ],
  riflecock: [
    v('1', 1.5, 'Working the bolt of a bolt-action rifle once, slowly and deliberately: the bolt pulled back, then pushed forward and locked, two clean mechanical clacks.', DRY),
    v('2', 1.5, 'A rifle bolt being cycled once, metallic slide and two hard clacks, heavy steel mechanism.', DRY),
  ],
};

// The score: one piece per scene id, all in D minor, tempos related (140 ↔ 70 is half-time).
const SCORE = 'Cinematic orchestral trailer-style action film score, dark and powerful, one continuous cue. Instrumental only, no vocals, no lyrics, no singing.';
export const MUSIC_PLAN = {
  s1: `${SCORE} Tense martial-arts duel, D minor, 120 BPM. Start very sparse for the first 3 seconds: only a low string drone and a couple of distant deep taiko hits. Then bring in driving taiko drums and a low staccato cello and double-bass ostinato, wooden percussion clicks, intensity building steadily to the end. No resolution at the end.`,
  s2: `${SCORE} Nimble, percussive rooftop chase, D minor, 140 BPM. Starts immediately at full motion: light fast hand drums, woodblocks, sticks and clicking wooden percussion, pizzicato strings and quick marimba figures, syncopated and agile, constant forward motion, tense but light on its feet. No resolution at the end.`,
  s3: `${SCORE} Precise, driving, clockwork sword fight, D minor, 140 BPM. Starts immediately: tight sixteenth-note staccato string ostinato, ticking metallic percussion like a clock mechanism, crisp snare and short brass stabs, exact and relentless, mechanical precision. No resolution at the end.`,
  s3b: `${SCORE} Tense gunfight, D minor. Begins as a spaghetti-western standoff at 105 BPM: a lone twangy baritone guitar, tremolo strings, a distant bell and sparse castanets with lots of space and silence. After about eight seconds it turns into pounding action: galloping drums, driving low strings and brass hits, with gaps between the hits. No resolution at the end.`,
  s4: `${SCORE} Slow, enormous and heavy, D minor, 70 BPM. Starts immediately: huge deep drums with long gaps between the hits, massive low brass, trombones and tuba holding long growling notes, low strings and sub bass, a sense of colossal weight and dread. No resolution at the end.`,
  s5: `${SCORE} The apocalyptic climax, D minor, 160 BPM, the fastest and biggest cue. Starts immediately at full power: full orchestra at maximum intensity, relentless pounding percussion and taiko, racing string ostinato, blazing brass and a huge wordless epic choir, pushing harder and harder to a final crashing hit at the end.`,
  s6: `${SCORE} The final scene, D minor, slow, 60 BPM. First three seconds: sparse, exhausted low strings and a slow lone drum. From about 3 to 8 seconds a short violent surge of pounding drums and aggressive low strings and brass. At about 9 seconds it drops suddenly into cold dread: only a low sustained drone and a slow heartbeat-like pulse, thinning out more and more, almost nothing by 15 seconds and completely silent from 17 seconds to the end. No melody, no resolution, no final hit.`,
  credits: `${SCORE} End-title cue, D minor, 140 BPM. Starts immediately: dark, driving taiko drums and a low staccato string ostinato in the style of a martial-arts action score, rising steadily in intensity with brass, and ending decisively on one final unison hit shortly before the end, then silence.`,
};

// How a scene's piece sits in its scene, by scene id (seconds):
//   lead   the piece starts this long after the scene does (the mixer delays it by the same amount)
//   tail   generated beyond the scene's end for the crossfade (default MUSIC_TAIL); negative = ends early
// s6 ends on the rifle shot, which silences everything, so nothing is generated past it; the
// end titles wait for the shot's echo and finish before the last frame.
export const MUSIC_SHAPE = {
  s6: { tail: -1 },
  credits: { lead: 1.5, tail: -0.5 },
};

// ═════════════════════════════════════════════════════════════════════════════
// Library on disk
// ═════════════════════════════════════════════════════════════════════════════
export const sfxPath = (type, id) => join(ASSET_DIR, 'sfx', type, `${id}.wav`);
export const musicPath = (sceneId) => join(ASSET_DIR, 'music', `${sceneId}.wav`);

// Minimal WAV reader (PCM 16-bit, as written by ffmpeg) → { L, R, sr } as Float32Array.
export function readWav(path) {
  const b = readFileSync(path);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`not a WAV file: ${path}`);
  let fmt = null, data = null;
  for (let p = 12; p + 8 <= b.length;) {
    const id = b.toString('ascii', p, p + 4), size = b.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { format: b.readUInt16LE(p + 8), channels: b.readUInt16LE(p + 10), sr: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === 'data') { data = { start: p + 8, size: Math.min(size, b.length - p - 8) }; break; }
    p += 8 + size + (size & 1);
  }
  if (!fmt || !data || fmt.bits !== 16 || (fmt.format !== 1 && fmt.format !== 0xfffe)) throw new Error(`unsupported WAV (need 16-bit PCM): ${path}`);
  const frames = Math.floor(data.size / (2 * fmt.channels)), L = new Float32Array(frames), R = new Float32Array(frames);
  for (let i = 0, p = data.start; i < frames; i++, p += 2 * fmt.channels) {
    L[i] = b.readInt16LE(p) / 32768;
    R[i] = fmt.channels > 1 ? b.readInt16LE(p + 2) / 32768 : L[i];
  }
  return { L, R, sr: fmt.sr };
}

function readManifest() {
  try { return JSON.parse(readFileSync(MANIFEST, 'utf8')); } catch { return { sfx: {}, music: {} }; }
}
function writeManifest(m) {
  mkdirSync(ASSET_DIR, { recursive: true });
  writeFileSync(`${MANIFEST}.tmp`, `${JSON.stringify(m, null, 2)}\n`);
  renameSync(`${MANIFEST}.tmp`, MANIFEST);
}

// What the mixer needs: every generated effect that exists, grouped by type (with the plan's
// tags), and every scene's music. Nothing here touches the network.
export function loadLibrary(sceneIds = []) {
  const sfx = new Map(), music = new Map();
  for (const [type, variants] of Object.entries(SFX_PLAN)) {
    const have = [];
    for (const variant of variants) {
      const path = sfxPath(type, variant.id);
      if (!existsSync(path)) continue;
      try { have.push({ ...variant, ...readWav(path) }); } catch (err) { console.warn(`soundlib: ${err.message} — ignored`); }
    }
    if (have.length) sfx.set(type, have);
  }
  for (const id of sceneIds) {
    const path = musicPath(id);
    if (!existsSync(path)) continue;
    try { music.set(id, readWav(path)); } catch (err) { console.warn(`soundlib: ${err.message} — ignored`); }
  }
  return { sfx, music };
}

// ═════════════════════════════════════════════════════════════════════════════
// Generation (CLI only)
// ═════════════════════════════════════════════════════════════════════════════

// The API key: environment first, then .env in the project folder or its parent. Never logged.
function loadKey() {
  const names = ['ELEVEN_LABS_API_KEY', 'ELEVENLABS_API_KEY'];
  for (const n of names) if (process.env[n]) return process.env[n].trim();
  for (const file of [resolve(HERE, '../.env'), resolve(HERE, '../../.env')]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && names.includes(m[1])) return m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  return null;
}

class ApiError extends Error {
  constructor(status, message, body) { super(message); this.status = status; this.body = body; }
}
async function api(key, path, { method = 'GET', query, body, timeoutMs = 600000 } = {}) {
  const url = new URL(path, API);
  for (const [k, val] of Object.entries(query ?? {})) url.searchParams.set(k, val);
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        method, signal: AbortSignal.timeout(timeoutMs),
        headers: { 'xi-api-key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      if (attempt < 2) { await sleep(3000 * (attempt + 1)); continue; }
      throw new ApiError(0, `network error: ${err.cause?.code ?? err.name}`);
    }
    if (res.ok) return res;
    let parsed = null, text = '';
    try { text = await res.text(); parsed = JSON.parse(text); } catch { /* not JSON */ }
    if ((res.status === 429 || res.status >= 500) && attempt < 4) { await sleep(4000 * (attempt + 1)); continue; }
    const d = parsed?.detail;
    const message = typeof d === 'string' ? d : d?.message ?? (Array.isArray(d) ? d.map((x) => x.msg).join('; ') : text.slice(0, 200));
    throw new ApiError(res.status, `HTTP ${res.status}${d?.status ? ` (${d.status})` : ''}: ${message}`, parsed);
  }
}
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// Credits on the account, or null when the key is not allowed to read them (restricted keys
// without the "user_read" permission).
async function balance(key) {
  try {
    const s = await (await api(key, '/v1/user/subscription', { timeoutMs: 30000 })).json();
    return { tier: s.tier, used: s.character_count, limit: s.character_limit, remaining: s.character_limit - s.character_count };
  } catch (err) {
    if (err.status === 401 && /permission/i.test(err.message)) return null;
    throw err;
  }
}
// Can this key call an endpoint? Sends a deliberately invalid request (a length below the
// documented minimum), which the API rejects before generating anything — it costs nothing.
async function allowed(key, path, body) {
  try { await api(key, path, { method: 'POST', body, timeoutMs: 30000 }); return 'unexpectedly accepted'; } catch (err) {
    if (err.status === 401) return /permission/i.test(err.message) ? 'NO — the key lacks this permission' : `NO — ${err.message}`;
    if (err.status === 422 || err.status === 400) return 'yes';
    return `unclear — ${err.message}`;
  }
}

// Whatever the API returned → 48 kHz stereo 16-bit WAV.
function toWav(bytes, outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  const tmp = `${outPath}.tmp.wav`;
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', 'pipe:0', '-vn', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', tmp], { input: bytes, maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`ffmpeg could not convert the response (${String(r.stderr).trim().split('\n').pop()})`);
  renameSync(tmp, outPath);
}

// Request audio in the best format the plan allows; remember which one worked.
async function requestAudio(key, path, body, formats, state) {
  for (let i = state.format ?? 0; i < formats.length; i++) {
    try {
      const res = await api(key, path, { method: 'POST', query: { output_format: formats[i] }, body });
      state.format = i;
      return { bytes: Buffer.from(await res.arrayBuffer()), format: formats[i], songId: res.headers.get('song-id') };
    } catch (err) {
      const aboutFormat = err instanceof ApiError && [400, 401, 403, 422].includes(err.status) && /format|tier|subscri|plan|upgrade/i.test(err.message) && !/quota|credit/i.test(err.message);
      if (!aboutFormat || i === formats.length - 1) throw err;
      console.log(`soundlib: output format ${formats[i]} not available on this plan — trying ${formats[i + 1]}`);
    }
  }
  throw new Error('no usable output format');
}

function jobs(args, sceneList) {
  const list = [], want = (flag) => args[flag] || (!args.sfx && !args.music && !args.type && !args.scene);
  if (want('sfx') || args.type) {
    for (const [type, variants] of Object.entries(SFX_PLAN)) {
      if (args.type && args.type !== type) continue;
      for (const variant of variants) {
        if (args.variant && args.variant !== variant.id) continue;
        list.push({ kind: 'sfx', key: `${type}/${variant.id}`, path: sfxPath(type, variant.id), dur: variant.dur, prompt: variant.prompt, credits: variant.dur * SFX_CREDITS_PER_SECOND });
      }
    }
  }
  if ((want('music') || args.scene) && !args.type) {
    for (const sc of sceneList) {
      if (args.scene && args.scene !== sc.id) continue;
      const prompt = MUSIC_PLAN[sc.id];
      if (!prompt) { console.warn(`soundlib: no music prompt for scene "${sc.id}" — skipped`); continue; }
      // --length=<s> (with --scene) plans for a scene length that src/cues.js does not have yet
      const shape = MUSIC_SHAPE[sc.id] ?? {}, sceneLen = args.scene && args.length ? Number(args.length) : sc.end - sc.start;
      const dur = Math.max(3, sceneLen - (shape.lead ?? 0) + (shape.tail ?? MUSIC_TAIL));
      list.push({ kind: 'music', key: sc.id, path: musicPath(sc.id), dur, prompt, credits: dur / 60 * MUSIC_CREDITS_PER_MINUTE });
    }
  }
  return list;
}

async function runPool(items, size, worker) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) await worker(items[next++]);
  }));
}

function listing(sceneList) {
  const rows = [];
  let have = 0, total = 0;
  for (const [type, variants] of Object.entries(SFX_PLAN)) {
    const ok = variants.filter((x) => existsSync(sfxPath(type, x.id)));
    have += ok.length; total += variants.length;
    rows.push(`  ${type.padEnd(13)} ${String(ok.length).padStart(2)}/${variants.length}  ${variants.map((x) => (existsSync(sfxPath(type, x.id)) ? x.id : `(${x.id})`)).join(' ')}`);
  }
  const music = sceneList.map((s) => (existsSync(musicPath(s.id)) ? s.id : `(${s.id})`)).join(' ');
  return `sound effects: ${have}/${total} variants in ${Object.keys(SFX_PLAN).length} types   (in brackets = not generated yet)\n${rows.join('\n')}\nmusic: ${music}`;
}

async function cli() {
  const [command, ...rest] = process.argv.slice(2);
  const args = Object.fromEntries(rest.map((a) => { const [k, val] = a.replace(/^--/, '').split('='); return [k, val ?? true]; }));
  const scenes = await import('../src/cues.js').then((m) => m.SCENES, () => []);
  const n = (x) => Math.round(x).toLocaleString('en-US');

  if (command === 'plan' || command === 'status') {
    console.log(listing(scenes));
    const todo = jobs(args, scenes).filter((j) => args.force || !existsSync(j.path));
    const cost = (kind) => todo.filter((j) => j.kind === kind).reduce((s, j) => s + j.credits, 0);
    console.log(`\nto generate: ${todo.filter((j) => j.kind === 'sfx').length} effects (${todo.filter((j) => j.kind === 'sfx').reduce((s, j) => s + j.dur, 0).toFixed(1)} s ≈ ${n(cost('sfx'))} credits at ${SFX_CREDITS_PER_SECOND}/s)`
      + `, ${todo.filter((j) => j.kind === 'music').length} music cues (${todo.filter((j) => j.kind === 'music').reduce((s, j) => s + j.dur, 0).toFixed(0)} s ≈ ${n(cost('music'))} credits if ${MUSIC_CREDITS_PER_MINUTE}/min — estimate)`);
    if (command === 'status') {
      const key = loadKey();
      if (!key) { console.log('\nno API key found (ELEVEN_LABS_API_KEY in the environment or .env)'); return; }
      const b = await balance(key);
      console.log(b ? `\naccount: tier ${b.tier}, credits used ${n(b.used)} of ${n(b.limit)}, remaining ${n(b.remaining)}`
        : '\naccount: the balance cannot be read — this API key lacks the "user_read" permission');
      console.log(`key may generate sound effects: ${await allowed(key, '/v1/sound-generation', { text: 'probe', duration_seconds: 0.01, model_id: SFX_MODEL })}`);
      console.log(`key may generate music: ${await allowed(key, '/v1/music', { prompt: 'probe', music_length_ms: 1, model_id: MUSIC_MODEL })}`);
    }
    return;
  }

  if (command !== 'generate') { console.log('usage: node tools/soundlib.mjs status | plan | generate [--sfx] [--music] [--type=T [--variant=V]] [--scene=ID] [--force]'); return; }
  const key = loadKey();
  if (!key) throw new Error('no API key found (ELEVEN_LABS_API_KEY in the environment or .env)');
  const todo = jobs(args, scenes).filter((j) => args.force || !existsSync(j.path));
  if (!todo.length) { console.log('soundlib: nothing to generate — everything requested is already on disk (use --force to regenerate)'); return; }
  const estimate = todo.reduce((s, j) => s + j.credits, 0), before = await balance(key), budget = args.budget ? Number(args.budget) : null;
  console.log(`soundlib: ${todo.length} files to generate, estimated ${n(estimate)} credits; `
    + (before ? `account has ${n(before.remaining)} of ${n(before.limit)} left (tier ${before.tier})` : 'the account balance cannot be read with this key (no "user_read" permission)'));
  // Budget discipline: never spend more than half of what is left; when the balance is not
  // readable, spend nothing unless an explicit credit budget is given.
  if (before && estimate > before.remaining * 0.5 && !args['over-half']) {
    console.log('soundlib: STOP — this would use more than half of the remaining credits. Narrow the request, or pass --over-half to proceed anyway.');
    process.exitCode = 2;
    return;
  }
  if (budget != null ? estimate > budget : !before) {
    console.log(budget != null ? `soundlib: STOP — the estimate exceeds the budget of ${n(budget)} credits (--budget).`
      : `soundlib: STOP — nothing generated. The balance is unknown, so an explicit limit is required: re-run with --budget=<credits> (this request needs about ${n(estimate)}).`);
    process.exitCode = 2;
    return;
  }
  let spentEstimate = 0;                                    // running tally when the balance is not readable

  const manifest = readManifest(), failed = [], state = { sfx: {}, music: {} };
  const record = (job, extra) => {
    manifest[job.kind][job.key] = { prompt: job.prompt, model: job.kind === 'sfx' ? SFX_MODEL : MUSIC_MODEL, requested_seconds: job.dur, date: new Date().toISOString(), ...extra };
    writeManifest(manifest);
  };
  let done = 0;
  const report = (job, note) => console.log(`  [${String(++done).padStart(3)}/${todo.length}] ${job.kind} ${job.key} ${note}`);

  await runPool(todo.filter((j) => j.kind === 'sfx'), 3, async (job) => {
    try {
      const out = await requestAudio(key, '/v1/sound-generation', { text: job.prompt, duration_seconds: job.dur, prompt_influence: PROMPT_INFLUENCE, loop: false, model_id: SFX_MODEL }, SFX_FORMATS, state.sfx);
      toWav(out.bytes, job.path);
      spentEstimate += job.credits;
      record(job, { format: out.format, prompt_influence: PROMPT_INFLUENCE });
      report(job, `ok (${job.dur} s)`);
    } catch (err) { failed.push(job); report(job, `FAILED — ${err.message}`); }
  });

  for (const job of todo.filter((j) => j.kind === 'music')) {          // one at a time; the first one measures the real price
    try {
      const pre = await balance(key);
      spentEstimate += job.credits;
      const body = (prompt) => ({ prompt, music_length_ms: Math.round(job.dur * 1000), model_id: MUSIC_MODEL, force_instrumental: true });
      let out, prompt = job.prompt;
      try { out = await requestAudio(key, '/v1/music', body(prompt), MUSIC_FORMATS, state.music); } catch (err) {
        const suggestion = err.body?.detail?.data?.prompt_suggestion;       // the API's own rewording of a refused prompt
        if (!suggestion) throw err;
        console.log(`  music ${job.key}: prompt refused, retrying with the API's suggested wording`);
        prompt = suggestion; out = await requestAudio(key, '/v1/music', body(prompt), MUSIC_FORMATS, state.music);
      }
      toWav(out.bytes, job.path);
      const post = await balance(key), spent = pre && post ? post.used - pre.used : null;
      record({ ...job, prompt }, { format: out.format, force_instrumental: true, ...(spent != null ? { credits: spent } : {}), ...(out.songId ? { song_id: out.songId } : {}) });
      report(job, spent != null ? `ok (${job.dur} s, ${n(spent)} credits)` : `ok (${job.dur} s)`);
      const left = todo.filter((j) => j.kind === 'music' && !existsSync(j.path) && j !== job).reduce((s, j) => s + j.dur, 0);
      if (spent > 0 && left / job.dur * spent > post.remaining * 0.5 && !args['over-half']) {
        console.log(`soundlib: STOP — at the measured price (${n(spent / job.dur * 60)} credits/min) the remaining music would use more than half of what is left.`);
        process.exitCode = 2;
        break;
      }
    } catch (err) { failed.push(job); report(job, `FAILED — ${err.message}`); if (err.status === 401) break; }
  }

  const after = await balance(key);
  console.log(before && after ? `soundlib: done. credits used by this run: ${n(after.used - before.used)}; remaining ${n(after.remaining)} of ${n(after.limit)}`
    : `soundlib: done. estimated credits used by this run: ${n(spentEstimate)} (the key cannot read the real balance; music is priced at an assumed ${MUSIC_CREDITS_PER_MINUTE}/min)`);
  if (failed.length) { console.log(`soundlib: ${failed.length} failed: ${failed.map((j) => j.key).join(', ')}`); process.exitCode = 1; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  cli().catch((err) => { console.error(`soundlib: ${err.message}`); process.exitCode = 1; });
}
