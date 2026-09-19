/** Permanent branch/leaf attachment sites. Only seed and species proportions, never date or leaf count. */
import { hash2 } from '../core/rng';
export interface CrownSite {
  x: number;
  y: number;
  parentX: number;
  parentY: number;
  rx: number;
  ry: number;
  index: number;
}
export function crownSites(seed: number, cw: number, ch: number, layers: number): CrownSite[] {
  const sites: CrownSite[] = [];
  const groups = layers + 2;
  for (let i = 0; i < groups; i++) {
    const r = hash2(i, seed, 11),
      s = hash2(i, seed, 19);
    const x = (r - 0.5) * cw * 0.94,
      y = -ch * 0.12 + (s - 0.5) * ch * 0.65 - i * ch * 0.045;
    for (let k = 0; k < 3; k++) {
      const index = i * 3 + k,
        a = (k / 3) * Math.PI * 2 + hash2(i, seed, 1411),
        reach = 0.08 + hash2(index, seed, 1423) * 0.12;
      sites.push({
        parentX: x * 0.6,
        parentY: y * 0.6 + 5,
        x: x + Math.cos(a) * cw * reach,
        y: y + Math.sin(a) * ch * reach,
        rx: cw * (0.32 + r * 0.18),
        ry: ch * (0.23 + s * 0.13),
        index,
      });
    }
  }
  return sites;
}
