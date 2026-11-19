import { createScene } from '../engine/scene.js';
import { drawGround, DEFAULT_PAGE } from '../engine/kit.js';
const types = ['pistol', 'knife', 'baton', 'shortsword', 'longsword', 'spear', 'ruler', 'axe', 'hammer', 'greatsword', 'staff', 'pencil'];
const S = createScene({ id: 'gallery', title: 'Weapon gallery (test)', duration: 13 });
S.fighters({
  A: [{ t: 0, p: 'guard2', x: 900, face: 1 }, { t: 13, p: 'guard2' }],
  B: [{ t: 0, p: 'heavyRest', x: 1300, face: -1 }, { t: 13, p: 'heavyRest' }],
});
types.forEach((ty, i) => {
  S.weapon('a' + i, [{ t: i, type: ty, by: 'A', two: ty === 'knife' || ty === 'baton' || ty === 'pistol' ? 0 : 1, ang: ty === 'pistol' ? 0 : 55 }, { t: i + 1, by: 'A', ang: 55, gone: true }]);
  S.weapon('b' + i, [{ t: i, type: ty, by: 'B', ang: 120, two: 1, scale: 1.6, ink: i % 2 }, { t: i + 1, by: 'B', ang: 120, gone: true }]);
});
S.shot({ t: 0.4, weapon: 'a0', to: [1500, 150] });
S.shot({ t: 0.6, weapon: 'a0', to: [1250, 150], slug: [0.6, 0.95], hit: 'spark' });
S.camera([{ t: 0, x: 1100, y: -220, z: 1.5 }, { t: 13, x: 1100, y: -220, z: 1.5 }]);
S.env({ stage(ctx, t, { vb, px }) { drawGround(ctx, DEFAULT_PAGE.x0 + 8, DEFAULT_PAGE.x1 - 8, vb, px); } });
export default S.build();
