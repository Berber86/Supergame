/** Branches and leaves share the same seeded crown; no disconnected seasonal silhouettes. */
import { clamp01, hash2, lerp } from '../core/rng';
import type { TreeProfile } from '../world/treeHabits';
import type { CrownSite } from './crownGeometry';
import { branchSkeleton, woodCurve, woodPoint, type WoodCurve } from './treeWood';

export function treeGeometry(profile: TreeProfile, seed: number, g: number, x = 0, y = 0, sway = 0) {
  const scale = lerp(0.18, 1, Math.pow(clamp01(g), 0.72));
  const h = profile.height * scale,
    cw = profile.crownW * scale,
    ch = profile.crownH * scale;
  const w = profile.trunkWidth * scale,
    lean = h * profile.lean,
    bow = h * profile.bow;
  const trunk: WoodCurve = {
    a: { x, y },
    b: { x: x + bow + lean * 0.2, y: y - h * 0.29 },
    c: { x: x - bow * 0.45 + lean * 0.7, y: y - h * 0.73 },
    d: { x: x + lean + sway * 0.35, y: y - h },
    r0: w * 0.84,
    r1: w * (profile.type === 'ginkgo' ? 0.19 : 0.13),
    flare: w * 0.37,
  };
  const sites: CrownSite[] = [];
  const groups = profile.layers + 2;
  const mature = clamp01(g) >= 1;
  for (let i = 0; i < groups; i++) {
    const u = i / (groups - 1),
      roll = hash2(seed, i, 3371);
    const angle = (i / groups) * Math.PI * 2 + (roll - 0.5) * 0.45;
    const upright = profile.form === 'upright';
    // Upright trees have a narrow crown growing along the leader; spreading trees open into a low oval.
    const taper = profile.type === 'ginkgo' ? u : Math.sin(Math.PI * (0.08 + u * 0.84));
    const px = upright ? (i % 2 ? -1 : 1) * cw * (0.12 + taper * 0.27) : Math.cos(angle) * cw * (0.32 + roll * 0.13);
    const py = upright ? ch * (-0.54 + u * 0.93) : ch * (-0.2 + Math.sin(angle) * 0.27);
    const breadth = upright ? 0.74 + taper * 0.26 : 1;
    // Саженец: крона растёт сверху вниз — сперва пучок листвы на макушке,
    // нижние ветви присоединяются позже. Взрослому дереву видно всё сразу.
    const topness = clamp01((py / ch + 0.55) / 0.95);
    const age = mature ? 1 : clamp01((g - (0.08 + 0.5 * topness)) / 0.3);
    if (age <= 0) continue;
    const reachK = mature ? 1 : 0.35 + 0.65 * age,
      leafK = mature ? 1 : 0.3 + 0.7 * age;
    for (let k = 0; k < 3; k++) {
      const index = i * 3 + k,
        a = (k / 3) * Math.PI * 2 + hash2(seed, index, 3373);
      const dx = Math.cos(a) * cw * (0.07 + hash2(seed, index, 3389) * 0.045) * reachK;
      const dy = Math.sin(a) * ch * (0.08 + hash2(seed, index, 3391) * 0.06) * reachK;
      sites.push({
        index,
        parentX: px * 0.7 * reachK,
        parentY: py * 0.7 * reachK + 4 * scale,
        x: px * reachK + dx,
        y: py * reachK + dy,
        rx: cw * (0.23 + hash2(seed, index, 3407) * 0.075) * breadth * leafK,
        ry: ch * (0.23 + hash2(seed, index, 3413) * 0.07) * leafK,
      });
    }
  }
  // Скелет ветвей строится только по живым площадкам; нумеруем их заново,
  // чтобы ветви, листва и серёжки ивы всегда сходились в одни узлы.
  sites.forEach((site, j) => {
    site.index = j;
  });
  const skeleton = branchSkeleton(profile.type, seed, trunk, sites, scale, sway, profile.branchBase);
  // Real pendent shoots, shared by bare wood and their narrow leaf pairs. Their
  // endpoints stay above the soil even on the low/upright seeded silhouettes.
  const curtains: WoodCurve[] = [];
  if (profile.droop)
    for (const site of sites) {
      for (let strand = 0; strand < 3; strand++) {
        const start = woodPoint(skeleton.twigs[site.index], 0.64 + strand * 0.18);
        const length = Math.min(
          y - start.y - (6 + hash2(site.index, seed, 3433 + strand) * 22) * scale,
          profile.droop * scale * (0.65 + hash2(site.index, seed, 3419 + strand) * 0.43),
        );
        const end = {
          x:
            trunk.d.x +
            site.x +
            sway +
            (strand - 1) * site.rx * 0.58 +
            (hash2(site.index, seed, 3449 + strand) - 0.5) * 6 * scale,
          y: start.y + Math.max(0, length),
        };
        curtains.push(woodCurve(start, end, 0.4 * scale, 0.075 * scale, (end.x - start.x) * 0.2, -5 * scale));
      }
    }
  return { profile, scale, h, cw, ch, w, trunk, sites, skeleton, curtains };
}
