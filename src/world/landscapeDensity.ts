/**
 * Мягкие пороги густоты. Один проход при загрузке, не запрет на посадку:
 * прореживаем только тесные скопления одного вида, не весь ландшафт.
 * Чистая функция: без World, DOM, localStorage и изменения исходного сада.
 */
import { GRID } from '../core/iso';
import { ITEM_BY_ID } from './catalog';
import type { PlacedObject, SaveData } from './types';

export const LANDSCAPE_LIMITS = Object.freeze({
  trees: 80,
  shrubs: 80,
  plants: 200,
  habitat: 24,
  rocks: 100,
  lights: 48,
});
export type LandscapeGroup = keyof typeof LANDSCAPE_LIMITS;
/** Расстояние в тайлах, не экранных пикселях: результат не зависит от камеры. */
export const DUPLICATE_RADIUS = 2;

const SMALL_PLANTS = new Set(['moss_clump', 'grass_tuft', 'lilypad']);
const HABITAT_OBJECTS = new Set(['feeder', 'birdbath', 'beehive', 'squirrel_feeder', 'turtle_log', 'shishi']);

/** Явно исключены дом, мебель, мосты, дорожки, коты и карпы (включая их миски/подушки). */
export function landscapeGroup(type: string): LandscapeGroup | null {
  const item = ITEM_BY_ID.get(type);
  if (
    !item ||
    item.tab === 'house' ||
    type === 'cushion' ||
    type === 'bowl' ||
    ['bridge', 'pavilion', 'creature'].includes(item.kind)
  )
    return null;
  if (HABITAT_OBJECTS.has(type)) return 'habitat';
  if (item.kind === 'tree') return 'trees';
  if (item.kind === 'shrub') return 'shrubs';
  if (item.kind === 'flower' || SMALL_PLANTS.has(type)) return 'plants';
  if (item.kind === 'rock' || type === 'pebbles') return 'rocks';
  if (item.kind === 'lantern') return 'lights';
  return null;
}

export interface ThinningGroup {
  group: LandscapeGroup;
  before: number;
  after: number;
  removed: number;
  limit: number;
}
export interface LandscapeThinning {
  /** Тот же массив при отсутствии изменений; иначе сохраняются порядок и поля выживших предметов. */
  objects: PlacedObject[];
  removed: number;
  /** Только превысившие порог группы, в том числе без найденных дублей. */
  groups: ThinningGroup[];
}

interface Cluster {
  anchor: PlacedObject;
  members: PlacedObject[];
  group: LandscapeGroup;
}

/**
 * Оставляем старейшую посадку на каждом месте, удаляем две трети лишних копий
 * (с округлением вверх). Не сравниваем сид: каждый повторный клик создаёт новый.
 *
 * Кластеры привязаны к неподвижному якорю, не сливаются транзитивно вдоль
 * целой клумбы. Пространственный индекс хранит только якоря, а не все копии:
 * даже десять тысяч предметов в одной точке не превращаются в O(n²).
 */
export function thinLandscape(data: Pick<SaveData, 'objects' | 'tiles'>): LandscapeThinning {
  const counts = new Map<LandscapeGroup, number>();
  for (const o of data.objects) {
    const group = landscapeGroup(o.type);
    if (group) counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  const groups = (Object.keys(LANDSCAPE_LIMITS) as LandscapeGroup[])
    .filter((group) => (counts.get(group) ?? 0) > LANDSCAPE_LIMITS[group])
    .map((group) => ({
      group,
      before: counts.get(group)!,
      after: counts.get(group)!,
      removed: 0,
      limit: LANDSCAPE_LIMITS[group],
    }));
  if (!groups.length) return { objects: data.objects, removed: 0, groups };
  const overloaded = new Map(groups.map((g) => [g.group, g]));
  const candidates = data.objects
    .filter((o) => {
      const group = landscapeGroup(o.type);
      return group && overloaded.has(group);
    })
    .sort((a, b) => a.planted - b.planted || a.id - b.id);
  const buckets = new Map<string, Cluster[]>();
  const clusters: Cluster[] = [];
  const radius2 = DUPLICATE_RADIUS * DUPLICATE_RADIUS;
  for (const o of candidates) {
    const x = Math.floor(o.tx),
      y = Math.floor(o.ty);
    // Imported legacy anchors may lie beyond the map. They aren't safe to classify as duplicates.
    if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue;
    const tile = data.tiles[y * GRID + x];
    if (!tile) continue;
    const item = ITEM_BY_ID.get(o.type)!;
    // A rock turned another way or a plant on the other side of a cliff/waterline isn't a copy.
    const family = `${o.type}:${item.rotatable ? o.rot : 0}:${tile.level}:${+tile.water}:${+tile.indoor}:${+tile.veranda}`;
    const bx = Math.floor(o.tx / DUPLICATE_RADIUS),
      by = Math.floor(o.ty / DUPLICATE_RADIUS);
    let nearest: Cluster | undefined,
      distance = Infinity;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nearby = buckets.get(`${family}:${bx + dx}:${by + dy}`);
        if (!nearby) continue;
        for (const cluster of nearby) {
          const d = (o.tx - cluster.anchor.tx) ** 2 + (o.ty - cluster.anchor.ty) ** 2;
          if (
            d <= radius2 + 1e-10 &&
            (!nearest || d < distance || (d === distance && cluster.anchor.id < nearest.anchor.id))
          ) {
            nearest = cluster;
            distance = d;
          }
        }
      }
    if (nearest) nearest.members.push(o);
    else {
      const cluster: Cluster = { anchor: o, members: [o], group: landscapeGroup(o.type)! };
      const key = `${family}:${bx}:${by}`;
      const bucket = buckets.get(key);
      if (bucket) bucket.push(cluster);
      else buckets.set(key, [cluster]);
      clusters.push(cluster);
    }
  }
  const removedIds = new Set<number>();
  for (const cluster of clusters) {
    const n = Math.ceil(((cluster.members.length - 1) * 2) / 3);
    if (!n) continue;
    // Members are oldest-first: discard only the newest repetitions, never the original anchor.
    for (let i = cluster.members.length - n; i < cluster.members.length; i++) removedIds.add(cluster.members[i].id);
    const group = overloaded.get(cluster.group)!;
    group.removed += n;
    group.after -= n;
  }
  return {
    objects: removedIds.size ? data.objects.filter((o) => !removedIds.has(o.id)) : data.objects,
    removed: removedIds.size,
    groups,
  };
}
