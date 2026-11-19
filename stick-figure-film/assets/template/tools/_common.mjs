// Shared by the Node tools: argument parsing + "film or single scene" source selection.
import { createCanvas } from '@napi-rs/canvas';

export const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i > 0 ? process.argv[i + 1] : d;
};

/** Returns { draw(ctx, t, o), duration, label, state? } for --scene <id|path> or the whole film. */
export async function source() {
  const id = arg('scene', null);
  const film = await import('../src/film.js');
  film.setCanvasFactory((w, h) => createCanvas(w, h));
  if (!id) return { draw: film.renderFrame, duration: film.DURATION, label: 'film', film };
  let scene = film.sceneById(id);
  if (!scene) {
    // not on the timeline: accept a file name (--scene ref_poc) or a scene id defined in any file (--scene ref)
    const { readdirSync, existsSync } = await import('node:fs');
    const dir = new URL('../src/scenes/', import.meta.url);
    const direct = new URL(`${id.replace(/\.js$/, '')}.js`, dir);
    if (existsSync(direct)) scene = (await import(direct)).default;
    else {
      for (const f of readdirSync(dir).filter((n) => n.endsWith('.js'))) {
        const mod = await import(new URL(f, dir)).catch(() => null);
        if (mod?.default?.id === id) { scene = mod.default; break; }
      }
    }
    if (!scene) throw new Error(`no scene "${id}" on the timeline or in src/scenes/`);
  }
  return { draw: scene.draw, duration: scene.duration, label: scene.id, scene, film };
}
