/** Five connected pine silhouettes, shared by cold-cache drawing and structural checks. */
import { clamp01, hash2, lerp } from '../core/rng';
import { pineGrowth, pineProfile } from '../world/pine';
import { woodCurve, woodFrame, woodPoint, type WoodCurve } from './treeWood';

/** Juvenile needle tufts along the young stem; empty once the tree is past them. */
export interface PineTuft {
  x: number;
  y: number;
  r: number;
  seed: number;
}

/**
 * Появление частей кроны по мере роста. Саженец — это не уменьшенная копия
 * взрослой сосны: сперва голый стебель с пучками хвои, потом нижние ярусы,
 * затем верхушка и, наконец, развилка и широкие лапы. Взрослое дерево
 * (g = 1) построено ровно теми же формулами, что и прежде: все «возрастные»
 * множители на полном росту дают в точности единицу.
 */
const tierStart = (u: number): number => 0.1 + 0.5 * u;
const TIER_SPAN = 0.28;
const TOP_START = 0.26;
const TOP_SPAN = 0.3;
const FORK_START = 0.44;
const FORK_SPAN = 0.4;

export function pineGeometry(seed: number, g: number, x = 0, y = 0, sway = 0) {
  const profile = pineProfile(seed),
    scale = pineGrowth(g);
  const mature = g >= 1;
  /** Зрелость части, появляющейся в `start` и взрослеющей `span` роста. */
  const age = (start: number, span: number): number => (mature ? 1 : clamp01((g - start) / span));
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
  const forkAge = age(FORK_START, FORK_SPAN);
  if (profile.form === 'forked' && forkAge > 0) {
    forkAt = 0.38 + hash2(seed, 21, 3187) * 0.08;
    const root = woodFrame(trunk, forkAt);
    // Второй ствол отрастает постепенно: кончик тянется вверх по мере взросления.
    const reach = mature ? 1 : 0.45 + 0.55 * forkAge;
    trunks.push(
      woodCurve(
        { x: root.x, y: root.y },
        {
          x: x - h * (0.16 + hash2(seed, 23, 3191) * 0.1) * reach,
          y: y - h * ((0.8 + hash2(seed, 25, 3203) * 0.1) * reach + forkAt * (1 - reach)),
        },
        root.r * 0.79 * (mature ? 1 : 0.6 + 0.4 * forkAge),
        w * 0.1,
        -h * 0.06 * reach,
        -h * 0.025,
      ),
    );
  }
  const boughs: { curve: WoodCurve; parent: number; at: number; cone: boolean; side: number }[] = [];
  const twigs: WoodCurve[] = [];
  const sprays: { x: number; y: number; rx: number; ry: number; seed: number; m: number }[] = [];
  for (const [parent, leader] of trunks.entries()) {
    // Второй ствол появляется позже: его ветви стартуют после развилки.
    const leaderStart = parent ? FORK_START : 0;
    const tiers = parent ? 2 : profile.tiers;
    const width = parent ? 0.68 : 1;
    for (let i = 0; i < tiers; i++)
      for (const side of [-1, 1]) {
        const salt = parent * 101 + i * 7 + side;
        if (i > 0 && hash2(seed, salt, 2939) > (profile.form === 'windswept' && side < 0 ? 0.5 : 0.92)) continue;
        const u = i / (tiers - 1);
        // Ярус ещё не вырос — ветви нет вовсе; появится и будет расти сама.
        const tierAge = age(leaderStart + tierStart(u), TIER_SPAN);
        if (tierAge <= 0) continue;
        const at =
          lerp(parent ? 0.18 : profile.crownStart, 0.88, u) + side * 0.026 + (hash2(seed, salt, 3191) - 0.5) * 0.04;
        const root = woodFrame(leader, at),
          join = { x: root.x, y: root.y };
        const windward = profile.form === 'windswept' ? (side < 0 ? 0.38 : 1.18) : 1;
        // Молодая ветвь короче и прижата к стволу; полная длина — на полном росту.
        const spreadK = mature ? 1 : 0.3 + 0.7 * tierAge;
        const spread =
          profile.spread *
          (1 - u * profile.taper) *
          scale *
          width *
          windward *
          (0.84 + hash2(seed, salt, 2941) * 0.28) *
          spreadK;
        const tip = {
          x: join.x + side * spread + motion,
          y: join.y - (4 + hash2(seed, salt, 2953) * (profile.form === 'umbrella' ? 14 : 9)) * scale * spreadK,
        };
        const curve = woodCurve(
          join,
          tip,
          Math.min(root.r * 0.88, (3.1 - u) * scale),
          0.34 * scale,
          -side * 4 * scale * spreadK,
          (profile.form === 'tall' ? 3 : 9) * scale * spreadK,
        );
        boughs.push({ curve, parent, at, cone: i === 0 && hash2(seed, salt, 2971) > 0.45, side });
        const leafK = mature ? 1 : 0.28 + 0.72 * tierAge;
        const twigK = mature ? 1 : 0.45 + 0.55 * tierAge;
        for (let k = 0; k < 2; k++) {
          const p = woodPoint(curve, 0.59 + k * 0.41);
          const crown = { x: p.x + side * k * 3 * scale * twigK, y: p.y - (4 + k * 2) * scale * twigK };
          twigs.push(woodCurve(p, crown, 0.76 * scale * twigK, 0.13 * scale, side * 2 * scale * twigK, -2 * scale));
          sprays.push({
            ...crown,
            rx: (13 + hash2(seed, salt * 5 + k, 2963) * 6) * (1 - u * 0.13) * scale * profile.foliage * leafK,
            ry: (6 + hash2(seed, salt * 3 + k, 2969) * 2) * scale * profile.foliage * leafK,
            seed: seed + parent * 997 + i * 31 + k * 13 + side,
            m: tierAge,
          });
        }
      }
    // Each leader has its own crown, joined by fine twigs rather than floating pads.
    const topAge = age(leaderStart + TOP_START, TOP_SPAN);
    if (topAge > 0) {
      const topK = mature ? 1 : 0.3 + 0.7 * topAge;
      for (const side of [-1, 1]) {
        const crown = {
          x: leader.d.x + side * (profile.form === 'umbrella' ? 14 : 8) * scale * topK + motion,
          y: leader.d.y + side * 2 * scale,
        };
        twigs.push(woodCurve(leader.d, crown, 0.8 * scale * topK, 0.14 * scale, side * 2 * scale * topK, -2 * scale));
        sprays.push({
          ...crown,
          rx: (side < 0 ? 17 : 14) * scale * profile.foliage * topK,
          ry: (side < 0 ? 8 : 7) * scale * profile.foliage * topK,
          seed: seed + parent * 997 + 184 + side * 7,
          m: topAge,
        });
      }
    }
  }
  // Саженец и подросток: мягкие пучки хвои прямо на стебле, пока ярусы
  // не сомкнулись. У взрослого дерева пучков нет.
  const tufts: PineTuft[] = [];
  if (!mature && g < 0.5) {
    const count = g < 0.14 ? 4 : g < 0.3 ? 3 : 2;
    const fade = 1 - g * 0.85;
    for (let i = 0; i < count; i++) {
      const t = Math.min(0.88, 0.22 + (i / Math.max(1, count - 1)) * 0.58 + (hash2(seed, i, 3209) - 0.5) * 0.1);
      const p = woodPoint(trunk, t);
      const side = i % 2 === 0 ? -1 : 1;
      const r = woodFrame(trunk, t).r;
      tufts.push({
        x: p.x + side * (r + 2.5 * scale),
        y: p.y - 1.5 * scale,
        r: (5.5 + hash2(seed, i, 3217) * 3) * scale * fade,
        seed: seed + i * 37,
      });
    }
    // Почка на макушке — первый зелёный огонёк саженца.
    const tip = woodPoint(trunk, 1);
    tufts.push({ x: tip.x, y: tip.y - 2 * scale, r: 6.5 * scale * (1 - g * 0.7), seed: seed + 977 });
  }
  return { profile, scale, height: h, width: w, trunks, forkAt, boughs, twigs, sprays, tufts };
}
