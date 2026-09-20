/** Five connected pine silhouettes, shared by cold-cache drawing and structural checks. */
import { hash2, lerp } from '../core/rng';
import { pineGrowth, pineProfile } from '../world/pine';
import { woodCurve, woodFrame, woodPoint, type WoodCurve } from './treeWood';

export function pineGeometry(seed: number, g: number, x = 0, y = 0, sway = 0) {
  const profile = pineProfile(seed),
    scale = pineGrowth(g);
  const motion = sway * scale;
  const h = profile.height * scale,
    w = profile.trunkWidth * scale;
  const lean = h * profile.lean,
    bow = h * profile.bow;
  const trunk: WoodCurve = {
    a: { x, y },
    b: { x: x + bow + lean * 0.22, y: y - h * 0.29 },
    c: { x: x - bow * 0.45 + lean * 0.7, y: y - h * 0.73 },
    d: { x: x + lean + motion * 0.3, y: y - h },
    r0: w * 0.84,
    r1: w * 0.12,
    flare: w * 0.37,
  };
  const trunks = [trunk];
  let forkAt = 0;
  if (profile.form === 'forked') {
    forkAt = 0.38 + hash2(seed, 21, 3187) * 0.08;
    const root = woodFrame(trunk, forkAt);
    trunks.push(
      woodCurve(
        { x: root.x, y: root.y },
        { x: x - h * (0.16 + hash2(seed, 23, 3191) * 0.1), y: y - h * (0.8 + hash2(seed, 25, 3203) * 0.1) },
        root.r * 0.79,
        w * 0.1,
        -h * 0.06,
        -h * 0.025,
      ),
    );
  }
  const boughs: { curve: WoodCurve; parent: number; at: number; cone: boolean; side: number }[] = [];
  const twigs: WoodCurve[] = [];
  const sprays: { x: number; y: number; rx: number; ry: number; seed: number }[] = [];
  for (const [parent, leader] of trunks.entries()) {
    const tiers = parent ? 2 : profile.tiers;
    const width = parent ? 0.68 : 1;
    for (let i = 0; i < tiers; i++)
      for (const side of [-1, 1]) {
        const salt = parent * 101 + i * 7 + side;
        if (i > 0 && hash2(seed, salt, 2939) > (profile.form === 'windswept' && side < 0 ? 0.5 : 0.92)) continue;
        const u = i / (tiers - 1);
        const at =
          lerp(parent ? 0.18 : profile.crownStart, 0.88, u) + side * 0.026 + (hash2(seed, salt, 3191) - 0.5) * 0.04;
        const root = woodFrame(leader, at),
          join = { x: root.x, y: root.y };
        const windward = profile.form === 'windswept' ? (side < 0 ? 0.38 : 1.18) : 1;
        const spread =
          profile.spread * (1 - u * profile.taper) * scale * width * windward * (0.84 + hash2(seed, salt, 2941) * 0.28);
        const tip = {
          x: join.x + side * spread + motion,
          y: join.y - (4 + hash2(seed, salt, 2953) * (profile.form === 'umbrella' ? 14 : 9)) * scale,
        };
        const curve = woodCurve(
          join,
          tip,
          Math.min(root.r * 0.88, (3.1 - u) * scale),
          0.34 * scale,
          -side * 4 * scale,
          (profile.form === 'tall' ? 3 : 9) * scale,
        );
        boughs.push({ curve, parent, at, cone: i === 0 && hash2(seed, salt, 2971) > 0.45, side });
        for (let k = 0; k < 2; k++) {
          const p = woodPoint(curve, 0.59 + k * 0.41);
          const crown = { x: p.x + side * k * 3 * scale, y: p.y - (4 + k * 2) * scale };
          twigs.push(woodCurve(p, crown, 0.76 * scale, 0.13 * scale, side * 2 * scale, -2 * scale));
          sprays.push({
            ...crown,
            rx: (13 + hash2(seed, salt * 5 + k, 2963) * 6) * (1 - u * 0.13) * scale * profile.foliage,
            ry: (6 + hash2(seed, salt * 3 + k, 2969) * 2) * scale * profile.foliage,
            seed: seed + parent * 997 + i * 31 + k * 13 + side,
          });
        }
      }
    // Each leader has its own crown, joined by fine twigs rather than floating pads.
    for (const side of [-1, 1]) {
      const crown = {
        x: leader.d.x + side * (profile.form === 'umbrella' ? 14 : 8) * scale + motion,
        y: leader.d.y + side * 2 * scale,
      };
      twigs.push(woodCurve(leader.d, crown, 0.8 * scale, 0.14 * scale, side * 2 * scale, -2 * scale));
      sprays.push({
        ...crown,
        rx: (side < 0 ? 17 : 14) * scale * profile.foliage,
        ry: (side < 0 ? 8 : 7) * scale * profile.foliage,
        seed: seed + parent * 997 + 184 + side * 7,
      });
    }
  }
  return { profile, scale, height: h, width: w, trunks, forkAt, boughs, twigs, sprays };
}
