/** One bird in the bowl, one on the rim. Reservations disappear with the bird or the real bath. */
import { hash1, hash2 } from '../core/rng';
import { TILE_W, LEVEL_H } from '../core/iso';
import { ITEM_BY_ID } from './catalog';
import { inGrowRect } from './grow';
import type { Bird } from './life';
import type { World } from './world';
interface Site {
  id: number;
  x: number;
  y: number;
  height: number;
  radius: number;
  level: number;
}
interface Visit {
  site: Site;
  slot: number;
  phase: 'wait' | 'in' | 'bathe' | 'out' | 'dry';
  time: number;
  age: number;
  waitedFor?: Bird;
}
export class BirdBaths {
  private visits = new Map<Bird, Visit>();
  private completed = new Map<number, { bird: Bird; at: number }>();
  private clock = 0;
  reset(): void {
    for (const b of this.visits.keys()) delete b.bathDry;
    this.visits.clear();
    this.completed.clear();
    this.clock = 0;
  }
  owns(b: Bird): boolean {
    return this.visits.has(b) && b.state !== 'fly-in' && b.state !== 'fly-out';
  }
  landingHeight(b: Bird, world: World): number {
    const site = this.visits.get(b)?.site;
    if (!site) return 7;
    return site.height + (site.level - (world.at(Math.floor(b.tx), Math.floor(b.ty))?.level ?? site.level)) * LEVEL_H;
  }
  private rim(v: Visit) {
    const offset = ((v.site.radius * 0.88) / TILE_W) * (v.slot ? 1 : -1);
    return { x: v.site.x + offset, y: v.site.y - offset };
  }
  update(
    birds: Bird[],
    world: World,
    dt: number,
    allowed: boolean,
    leave: (b: Bird) => void,
    note: (id: string, x: number, y: number) => void,
  ): void {
    dt = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    this.clock += dt;
    const sites: Site[] = [];
    for (const o of world.objects) {
      if (o.type !== 'birdbath') continue;
      const item = ITEM_BY_ID.get(o.type)!,
        x = o.tx + item.w / 2,
        y = o.ty + item.h / 2;
      const tile = world.at(Math.floor(x), Math.floor(y));
      if (!tile || tile.water || (world.grow && !inGrowRect(world.grow.rect, Math.floor(x), Math.floor(y)))) continue;
      const scale = 0.88 + hash1(o.seed, 29) * 0.24;
      sites.push({ id: o.id, x, y, height: 10.6 * scale, radius: 13 * scale, level: tile.level });
    }
    for (const [b, v] of this.visits) {
      if (
        !birds.includes(b) ||
        b.state === 'fly-out' ||
        !allowed ||
        !sites.some(
          (s) =>
            s.id === v.site.id &&
            s.x === v.site.x &&
            s.y === v.site.y &&
            s.level === v.site.level &&
            s.height === v.site.height,
        )
      ) {
        this.visits.delete(b);
        delete b.bathDry;
        if (birds.includes(b) && b.state !== 'fly-out') leave(b);
      }
    }
    for (const [id, last] of this.completed)
      if (!sites.some((s) => s.id === id) || this.clock - last.at > 25_000) this.completed.delete(id);
    for (const b of birds) {
      if (b.place !== 'bath' || b.state === 'fly-out' || this.visits.has(b)) continue;
      const target = b.target ?? { x: b.tx, y: b.ty };
      const site = sites.find((s) => Math.hypot(s.x - target.x, s.y - target.y) < 0.9);
      const taken = [...this.visits.values()].filter((v) => v.site.id === site?.id).map((v) => v.slot);
      const slot = [0, 1].find((n) => !taken.includes(n));
      if (!allowed || !site || slot === undefined) {
        leave(b);
        continue;
      }
      const visit: Visit = { site, slot, phase: 'wait', time: 0, age: 0 };
      this.visits.set(b, visit);
      // Incoming birds aim at their reserved rim, not a random overlapping point outside the bowl.
      if (b.state === 'fly-in') b.target = this.rim(visit);
    }
    // Update all existing turns before granting the next one; array order cannot produce two bathers.
    for (const [b, v] of this.visits) {
      v.age += dt;
      if (v.age > 55_000) {
        leave(b);
        this.visits.delete(b);
        delete b.bathDry;
        continue;
      }
      if (b.state === 'fly-in') continue;
      v.time += dt;
      b.alt = this.landingHeight(b, world);
      b.timer = 4000;
      const rim = this.rim(v);
      const centerDx = v.site.x - b.tx - (v.site.y - b.ty);
      if (Math.abs(centerDx) > 0.005) b.facing = centerDx > 0 ? 1 : -1;
      if (v.phase === 'in' || v.phase === 'out') {
        const goal = v.phase === 'in' ? v.site : rim;
        const dx = goal.x - b.tx,
          dy = goal.y - b.ty,
          distance = Math.hypot(dx, dy);
        const step = Math.min(distance, dt * 0.00036);
        b.tx += (dx / (distance || 1)) * step;
        b.ty += (dy / (distance || 1)) * step;
        b.state = 'hop';
        b.hop += dt * 0.009;
        if (distance <= step + 1e-8) {
          v.phase = v.phase === 'in' ? 'bathe' : 'dry';
          v.time = 0;
          b.state = v.phase === 'bathe' ? 'drink' : 'perch';
        }
      } else if (v.phase === 'bathe') {
        b.state = v.time < 1000 ? 'drink' : 'bathe';
        if (v.time >= 5600 + hash2(b.seed, 3, 3463) * 1600) {
          note('bath_splash', v.site.x, v.site.y);
          const last = this.completed.get(v.site.id);
          if (v.waitedFor && last?.bird === v.waitedFor && this.clock - last.at < 25_000)
            note('birds_share_bath', v.site.x, v.site.y);
          this.completed.set(v.site.id, { bird: b, at: this.clock });
          v.phase = 'out';
          v.time = 0;
        }
      } else {
        b.state = 'perch';
        b.bathDry = v.phase === 'dry' ? Math.sin(Math.min(1, v.time / 1800) * Math.PI) : 0;
        if (v.phase === 'dry' && v.time > 8500) {
          leave(b);
          this.visits.delete(b);
          delete b.bathDry;
        }
      }
    }
    // The rim can overhang a neighbouring cell: feet follow the bowl's level, not that cell's ground.
    for (const [b] of this.visits)
      if (b.state !== 'fly-in' && b.state !== 'fly-out') b.alt = this.landingHeight(b, world);
    for (const site of sites) {
      const present = [...this.visits].filter(
        ([b, v]) => v.site.id === site.id && b.state !== 'fly-in' && b.state !== 'fly-out',
      );
      const owner = present.find(([, v]) => v.phase === 'in' || v.phase === 'bathe' || v.phase === 'out');
      const waiting = present.filter(([, v]) => v.phase === 'wait');
      if (owner) for (const [, v] of waiting) v.waitedFor = owner[0];
      else {
        const next = waiting.find(([, v]) => v.time >= 1400);
        if (next) {
          next[1].phase = 'in';
          next[1].time = 0;
        }
      }
    }
  }
}
