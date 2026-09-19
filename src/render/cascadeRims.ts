/** Render geometry for existing AND newly sculpted cascades. Never rewrites a save. */
import { isoToScreen, LEVEL_H, type Pt } from '../core/iso';
import { hash2, lerp } from '../core/rng';
import type { World } from '../world/world';
import type { WaterFlow } from '../world/waterFlow';

export interface CascadeRim {
  lip: Pt[];
  raw: Pt[];
  topLevel: number;
  bottomLevel: number;
  height: number;
  seed: number;
  span: number;
  depth: number;
}
interface Edge {
  a: Pt;
  b: Pt;
  used: boolean;
}
const cache = new WeakMap<WaterFlow, { falls: WaterFlow['falls']; rims: CascadeRim[] }>();
const key = (p: Pt) => `${p.x},${p.y}`;
/** Join the X/Y zigzag of a single terrace into one rim before rounding it. */
export function cascadeRims(world: World, flow: WaterFlow): CascadeRim[] {
  const hit = cache.get(flow);
  if (hit?.falls === flow.falls) return hit.rims;
  const groups = new Map<string, { top: number; bottom: number; edges: Edge[] }>();
  for (const f of flow.falls) {
    if (f.dx !== 1 && f.dy !== 1) continue;
    const tile = world.at(f.x, f.y);
    if (!tile) continue;
    const nb = world.at(f.x + f.dx, f.y + f.dy);
    const top = tile.level - 0.26,
      bottom = nb ? nb.level - (nb.water ? 0.26 : 0) : tile.level - f.drop;
    if (top - bottom <= 0.06) continue;
    const id = `${top}/${bottom}`;
    const group = groups.get(id) ?? { top, bottom, edges: [] };
    groups.set(id, group);
    const a = f.dx === 1 ? { x: f.x + 1, y: f.y } : { x: f.x, y: f.y + 1 };
    const b = { x: f.x + 1, y: f.y + 1 };
    group.edges.push({ a, b, used: false });
  }
  const rims: CascadeRim[] = [];
  for (const { top, bottom, edges } of groups.values()) {
    const nodes = new Map<string, Edge[]>();
    for (const edge of edges)
      for (const p of [edge.a, edge.b]) {
        const list = nodes.get(key(p)) ?? [];
        list.push(edge);
        nodes.set(key(p), list);
      }
    for (const edge of edges) {
      if (edge.used) continue;
      // Find an endpoint of this component, so a long terrace is not split midway.
      let start = edge.a;
      const visited = new Set<Edge>(),
        todo = [edge];
      while (todo.length) {
        const e = todo.pop()!;
        if (visited.has(e)) continue;
        visited.add(e);
        for (const p of [e.a, e.b]) {
          const linked = nodes.get(key(p))!;
          if (linked.length === 1) start = p;
          else for (const n of linked) if (!visited.has(n)) todo.push(n);
        }
      }
      const raw: Pt[] = [start];
      let cursor = start;
      for (let n = 0; n <= edges.length; n++) {
        const next = nodes.get(key(cursor))?.find((e) => !e.used);
        if (!next) break;
        next.used = true;
        cursor = key(next.a) === key(cursor) ? next.b : next.a;
        raw.push(cursor);
      }
      if (raw.length < 2) continue;
      let pts = raw.map((p) => isoToScreen(p.x, p.y, top));
      if (pts[0].x > pts[pts.length - 1].x) pts.reverse();
      const rawScreen = pts;
      // Rounding the WHOLE chain removes the repeated V-shaped tile front.
      for (let pass = 0; pass < 3; pass++) {
        const smooth = [pts[0]];
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i],
            b = pts[i + 1];
          smooth.push(
            { x: lerp(a.x, b.x, 0.25), y: lerp(a.y, b.y, 0.25) },
            { x: lerp(a.x, b.x, 0.75), y: lerp(a.y, b.y, 0.75) },
          );
        }
        smooth.push(pts[pts.length - 1]);
        pts = smooth;
      }
      const seed = Math.floor(hash2(raw[0].x, raw[0].y, Math.round(top * 100)) * 100000);
      // Short terraces lose their tile-sized W shape. Long cliffs keep local
      // rounding: changing one end must not reshape distant cached terrain.
      // Erosion noise is anchored in world space, independent of component seed.
      const erode =
        Math.max(...raw.map((p) => p.x)) - Math.min(...raw.map((p) => p.x)) <= 3 &&
        Math.max(...raw.map((p) => p.y)) - Math.min(...raw.map((p) => p.y)) <= 3;
      const first = pts[0],
        last = pts[pts.length - 1];
      pts = pts.map((p) => {
        const t = (p.x - first.x) / Math.max(1, last.x - first.x);
        const chord = lerp(first.y, last.y, t);
        return {
          x: p.x,
          y:
            (erode ? chord + (p.y - chord) * 0.12 + Math.sin(t * Math.PI) * 9 : p.y) +
            Math.sin(p.x * 0.028 + p.y * 0.015) * 5 +
            Math.sin(p.x * 0.083) * 1.8,
        };
      });
      let span = 0;
      for (let i = 1; i < pts.length; i++) span += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      rims.push({
        lip: pts,
        raw: rawScreen,
        topLevel: top + 0.26,
        bottomLevel: bottom + 0.26,
        height: (top - bottom) * LEVEL_H,
        seed,
        span,
        depth: raw.reduce((v, p) => v + p.x + p.y, 0) / raw.length,
      });
    }
  }
  rims.sort((a, b) => a.depth - b.depth);
  cache.set(flow, { falls: flow.falls, rims });
  return rims;
}
export function rimPoint(rim: CascadeRim, t: number): Pt {
  const q = Math.max(0, Math.min(1, t)) * (rim.lip.length - 1),
    i = Math.min(rim.lip.length - 2, Math.floor(q));
  return { x: lerp(rim.lip[i].x, rim.lip[i + 1].x, q - i), y: lerp(rim.lip[i].y, rim.lip[i + 1].y, q - i) };
}

/** Sample monotone visible front edges by screen X, independent of tessellation. */
function yAt(points: Pt[], x: number): number {
  let lo = 0,
    hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].x < x) lo = mid;
    else hi = mid;
  }
  const a = points[lo],
    b = points[hi];
  return lerp(a.y, b.y, Math.max(0, Math.min(1, (x - a.x) / Math.max(0.001, b.x - a.x))));
}
/** Both water planes meet the same eroded rim. No painted-on blue apron or floating shelf. */
export function meetCascadeRims(points: Pt[], level: number, rims: CascadeRim[]): Pt[] {
  const relevant = rims.filter((r) => Math.abs(level - r.topLevel) < 0.001 || Math.abs(level - r.bottomLevel) < 0.001);
  if (!relevant.length) return points;
  return points.map((p) => {
    let best = 18,
      result = p;
    for (const r of relevant) {
      if (p.x < r.raw[0].x || p.x > r.raw[r.raw.length - 1].x) continue;
      const offset = Math.abs(level - r.topLevel) < 0.001 ? 0 : r.height;
      const rawY = yAt(r.raw, p.x) + offset,
        distance = Math.abs(p.y - rawY);
      if (distance >= best) continue;
      best = distance;
      // Keep the small shoreline irregularity, not the square terrace underneath.
      result = { x: p.x, y: yAt(r.lip, p.x) + offset + (p.y - rawY) * 0.12 };
    }
    return result;
  });
}
