/** Permanent broadleaf habits. A tree keeps its anatomy through seasons, wind and reloads. */
import { hash2 } from '../core/rng';

export const LEAFY_TREES = ['maple', 'sakura', 'ginkgo', 'willow', 'persimmon'] as const;
export type LeafyTree = (typeof LEAFY_TREES)[number];
export const TREE_FORMS = ['spreading', 'upright', 'low', 'leaning'] as const;
export type TreeForm = (typeof TREE_FORMS)[number];
export const TREE_FORM_NAMES: Record<TreeForm, string> = {
  spreading: 'Раскидистое',
  upright: 'Колонновидное',
  low: 'Низкое',
  leaning: 'Наклонное',
};
export const LEAFY_BASE: Record<LeafyTree, { height: number; crownW: number; crownH: number; layers: number }> = {
  maple: { height: 92, crownW: 96, crownH: 72, layers: 5 },
  sakura: { height: 96, crownW: 98, crownH: 74, layers: 5 },
  ginkgo: { height: 98, crownW: 82, crownH: 78, layers: 4 },
  willow: { height: 94, crownW: 104, crownH: 58, layers: 4 },
  persimmon: { height: 74, crownW: 58, crownH: 46, layers: 3 },
};
export interface TreeProfile {
  type: LeafyTree;
  form: TreeForm;
  height: number;
  crownW: number;
  crownH: number;
  layers: number;
  trunkWidth: number;
  lean: number;
  bow: number;
  branchBase: number;
  droop: number;
}
// Bole height, crown width/depth, trunk radius and willow curtain length.
const FORMS: Record<TreeForm, [number, number, number, number, number]> = {
  spreading: [0.93, 1.18, 0.8, 1.14, 1.15],
  upright: [1.46, 0.7, 1.16, 0.82, 1.7],
  low: [0.67, 1.02, 0.68, 1.25, 0.68],
  leaning: [1.1, 0.98, 0.88, 1.02, 1.48],
};
export function treeProfile(type: string, seed: number): TreeProfile | undefined {
  const species = LEAFY_TREES.indexOf(type as LeafyTree);
  if (species < 0) return;
  const base = LEAFY_BASE[type as LeafyTree];
  const form = TREE_FORMS[Math.floor(hash2(seed, species + 3, 3301) * TREE_FORMS.length)];
  const [height, width, depth, radius, curtain] = FORMS[form];
  return {
    type: type as LeafyTree,
    form,
    height: base.height * height * (0.91 + hash2(seed, 5, 3307) * 0.18),
    crownW:
      base.crownW * width * (form === 'upright' && type !== 'ginkgo' ? 1.12 : 1) * (0.89 + hash2(seed, 7, 3313) * 0.22),
    crownH:
      base.crownH * depth * (form === 'upright' && type !== 'ginkgo' ? 0.9 : 1) * (0.92 + hash2(seed, 9, 3319) * 0.16),
    layers: base.layers + (form === 'low' ? -1 : 0) + (hash2(seed, 11, 3323) > 0.55 ? 1 : 0),
    trunkWidth: 7 * radius * (0.91 + hash2(seed, 13, 3329) * 0.2),
    lean: form === 'leaning' ? 0.17 + hash2(seed, 15, 3331) * 0.12 : (hash2(seed, 15, 3331) - 0.5) * 0.1,
    bow: (hash2(seed, 17, 3343) - 0.3) * (form === 'upright' ? 0.055 : 0.22),
    branchBase: (form === 'upright' ? 0.5 : form === 'low' ? 0.3 : 0.4) + (hash2(seed, 19, 3347) - 0.5) * 0.09,
    droop: type === 'willow' ? 82 * curtain * (0.86 + hash2(seed, 21, 3359) * 0.28) : 0,
  };
}
