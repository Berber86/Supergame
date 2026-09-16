/** Состояние усадьбы: рельеф, вода, объекты, вехи. */

import { GRID, inBounds } from '../core/iso';
import { clamp, fbm, hash2 } from '../core/rng';
import { BRUSH_BY_ID, ITEM_BY_ID, MILESTONES, TerrainBrush } from './catalog';
import { DAY_MS } from '../core/clock';
import { GroundId, PlacedObject, SaveData, Tile } from './types';

const SAVE_KEY = 'usadba.save.v3';

export class World {
  tiles: Tile[] = [];
  objects: PlacedObject[] = [];
  nextId = 1;
  milestones = new Set<string>();
  seenTabs = new Set<string>();
  /** Очередь уведомлений о новых вехах. */
  pendingMilestones: string[] = [];

  constructor() {
    this.reset();
  }

  idx(x: number, y: number): number {
    return y * GRID + x;
  }

  at(x: number, y: number): Tile | null {
    if (!inBounds(x, y)) return null;
    return this.tiles[this.idx(x, y)];
  }

  reset(): void {
    this.tiles = [];
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const n = fbm(x * 0.12, y * 0.12, 3, 11);
        const ground: GroundId = n > 0.56 ? 'grass' : 'moss';
        this.tiles.push({ ground, level: 0, water: false, indoor: false, veranda: false });
      }
    }
    this.objects = [];
    this.nextId = 1;
    this.milestones = new Set();
    this.seenTabs = new Set(['ground', 'water', 'relief', 'trees', 'stones', 'micro']);
    this.seedStarterGarden();
  }

  /** Начальная композиция: небольшая усадьба, чтобы сцена сразу выглядела как картина. */
  private seedStarterGarden(): void {
    const now = Date.now();
    const old = now - DAY_MS * 9; // деревья уже взрослые

    // Дом в северо-западном углу: татами + веранда вокруг
    for (let y = 3; y <= 8; y++) {
      for (let x = 3; x <= 9; x++) {
        const t = this.at(x, y)!;
        t.ground = 'tatami';
        t.indoor = true;
        t.level = 1;
      }
    }
    // Энгава — веранда по южной и восточной кромке
    for (let x = 2; x <= 10; x++) {
      const t = this.at(x, 9);
      if (t) {
        t.ground = 'deck';
        t.veranda = true;
        t.level = 1;
      }
    }
    for (let y = 2; y <= 9; y++) {
      const t = this.at(10, y);
      if (t) {
        t.ground = 'deck';
        t.veranda = true;
        t.level = 1;
      }
      const t2 = this.at(2, y);
      if (t2) {
        t2.ground = 'deck';
        t2.veranda = true;
        t2.level = 1;
      }
    }
    for (let x = 2; x <= 10; x++) {
      const t = this.at(x, 2);
      if (t) {
        t.ground = 'deck';
        t.veranda = true;
        t.level = 1;
      }
    }

    // Пруд на юго-востоке
    this.applyWaterBlock(14, 12, 6, 5);
    this.applyWaterBlock(12, 15, 3, 3);

    // Холм на северо-востоке
    this.applyHill(18, 3, 4, 4, 1);
    this.applyHill(19, 4, 2, 2, 1);

    // Гравийный сад перед верандой
    for (let y = 11; y <= 14; y++) {
      for (let x = 3; x <= 8; x++) {
        const t = this.at(x, y);
        if (t && !t.water) t.ground = 'gravel';
      }
    }

    // Дорожка
    const path: [number, number][] = [
      [11, 9], [11, 10], [12, 11], [13, 11], [14, 11], [15, 10], [16, 10], [17, 9], [17, 8], [18, 7],
    ];
    for (const [x, y] of path) {
      const t = this.at(x, y);
      if (t && !t.water) t.ground = 'stone';
    }

    // Деревья
    const trees: [string, number, number][] = [
      ['sakura', 13.5, 6.5],
      ['sakura', 16, 5],
      ['maple', 20.5, 9.5],
      ['maple', 21.5, 14],
      ['pine', 19, 3.5],
      ['pine', 6, 17.5],
      ['willow', 12.5, 13.5],
      ['ginkgo', 17.5, 17],
      ['bamboo', 22.5, 5.5],
      ['bamboo', 22.75, 6.5],
      ['bamboo', 23.25, 5],
      ['bamboo', 22.25, 7.25],
      ['azalea', 11.5, 11.25],
      ['azalea', 9.5, 15.5],
      ['azalea', 14.25, 17.75],
      ['hedge', 4.5, 16.25],
      ['hedge', 7.75, 19.5],
      ['sakura', 8.5, 21.5],
      ['maple', 4.5, 21.75],
    ];
    for (const [type, tx, ty] of trees) this.place(type, tx, ty, 0, old);

    // Камни
    this.place('rock_big', 5, 12, 0, old);
    this.place('rock_mid', 7.25, 13.75, 1, old);
    this.place('rock_mid', 4.25, 14.5, 2, old);
    this.place('rock_trio', 18.5, 12, 0, old);

    // Мостик через пруд
    this.place('bridge', 16, 12, 0, old);

    // Фонари
    this.place('lantern_stone', 11.5, 10.5, 0, old);
    this.place('lantern_stone', 17.5, 14.5, 0, old);
    this.place('lantern_path', 12.25, 11.75, 0, old);
    this.place('lantern_path', 14.75, 10.25, 0, old);
    this.place('lantern_paper', 10.5, 5.5, 0, old);

    // Мелочи
    for (let i = 0; i < 34; i++) {
      const r1 = hash2(i, 3, 77);
      const r2 = hash2(i, 9, 91);
      const tx = Math.round((2 + r1 * 22) * 4) / 4;
      const ty = Math.round((10 + r2 * 13) * 4) / 4;
      const t = this.at(Math.floor(tx), Math.floor(ty));
      if (!t || t.water || t.indoor) continue;
      const kind = r1 > 0.66 ? 'moss_clump' : r1 > 0.4 ? 'grass_tuft' : r1 > 0.22 ? 'fern' : 'lily';
      this.place(kind, tx, ty, 0, old);
    }

    // Водные растения
    this.place('lilypad', 15.25, 13.25, 0, old);
    this.place('lilypad', 16.75, 14.5, 0, old);
    this.place('lilypad', 18, 13.75, 0, old);
    this.place('lotus', 15.75, 14.75, 0, old);
    this.place('lotus', 17.25, 12.75, 0, old);
    this.place('koi', 16.5, 13.5, 0, old);
    this.place('koi', 13.5, 16, 0, old);

    // Дом внутри
    this.place('table', 6.5, 5.5, 0, old);
    this.place('cushion', 5.5, 6.5, 0, old);
    this.place('cushion', 7.5, 6.5, 0, old);
    this.place('cat', 8.5, 7.5, 0, old);
    this.place('wind_chime', 9.5, 8.5, 0, old);
    this.place('tsukubai', 11.5, 8.25, 0, old);
    this.place('shishi', 12.5, 12.5, 0, old);

    // Стартовые вехи уже открыты — сад «прожил» какое-то время
    this.milestones.add('first_pond');
    this.milestones.add('first_deck');
    this.milestones.add('first_cat');
    this.seenTabs.add('pond');
    this.seenTabs.add('house');
    this.seenTabs.add('cat');

    this.place('pavilion', 20, 18, 0, old);
    this.place('torii', 22.5, 20.5, 0, old);

    // Южная роща и дальний берег — чтобы кадр был наполнен во все стороны
    const more: [string, number, number][] = [
      ['maple', 2.5, 12.5], ['pine', 3.5, 8.5], ['sakura', 2.5, 19],
      ['ginkgo', 11.5, 20.5], ['maple', 13.5, 22.5], ['pine', 17.5, 21.5],
      ['sakura', 20.5, 22.5], ['willow', 19.5, 15.5], ['maple', 22.5, 11.5],
      ['pine', 23.5, 16.5], ['ginkgo', 6.5, 23], ['sakura', 16.5, 19.5],
      ['hedge', 15.25, 8.5], ['hedge', 18.75, 19.25], ['azalea', 21.25, 16.75],
      ['azalea', 3.25, 10.5], ['azalea', 12.75, 18.5], ['hedge', 9.25, 12.25],
      ['bamboo', 23.5, 8.5], ['bamboo', 23, 9.75], ['bamboo', 22.5, 22.5],
    ];
    for (const [type, tx, ty] of more) this.place(type, tx, ty, 0, old);

    // Камни-акценты
    this.place('rock_mid', 10.75, 19.25, 1, old);
    this.place('rock_mid', 21.5, 13.25, 2, old);
    this.place('rock_big', 7, 21, 0, old);
    this.place('rock_trio', 4, 17.5, 1, old);

    // Свет вдоль южной тропы
    this.place('lantern_stone', 9.5, 18.5, 0, old);
    this.place('lantern_stone', 19.5, 20.5, 0, old);
    this.place('lantern_path', 15.25, 20.75, 0, old);
    this.place('brazier', 18.5, 17.5, 0, old);

    // Каменная тропа к беседке
    for (const [x, y] of [[18, 16], [19, 17], [20, 17], [21, 18], [21, 19], [22, 20]] as [number, number][]) {
      const t = this.at(x, y);
      if (t && !t.water && !t.indoor) t.ground = 'stone';
    }

    // Ковёр мха и цветов в южной части
    for (let i = 0; i < 46; i++) {
      const r1 = hash2(i, 17, 131);
      const r2 = hash2(i, 23, 149);
      const tx = Math.round((2 + r1 * 21) * 4) / 4;
      const ty = Math.round((16 + r2 * 8) * 4) / 4;
      const t = this.at(Math.floor(tx), Math.floor(ty));
      if (!t || t.water || t.indoor || t.veranda) continue;
      const kind = r2 > 0.72 ? 'moss_clump' : r2 > 0.5 ? 'grass_tuft' : r2 > 0.3 ? 'fern' : r2 > 0.15 ? 'iris' : 'pebbles';
      this.place(kind, tx, ty, 0, old);
    }
    // Ирисы у воды
    for (let i = 0; i < 14; i++) {
      const r1 = hash2(i, 31, 211);
      const r2 = hash2(i, 37, 223);
      const tx = Math.round((11 + r1 * 10) * 4) / 4;
      const ty = Math.round((11 + r2 * 7) * 4) / 4;
      const t = this.at(Math.floor(tx), Math.floor(ty));
      if (!t || t.water || t.indoor) continue;
      if (!this.hasWaterNear(tx, ty, 2)) continue;
      this.place(r1 > 0.5 ? 'iris' : 'fern', tx, ty, 0, old);
    }
  }

  // ---- Рельеф ----

  applyHill(x0: number, y0: number, w: number, h: number, delta: number): void {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const t = this.at(x, y);
        if (!t || t.indoor) continue;
        t.level = clamp(t.level + delta, -1, 3);
        if (t.level > 0 && t.water) t.water = false;
      }
    }
    this.smoothTerrain();
  }

  applyWaterBlock(x0: number, y0: number, w: number, h: number): void {
    const cx = x0 + (w - 1) / 2;
    const cy = y0 + (h - 1) / 2;
    const rx = w / 2;
    const ry = h / 2;
    for (let y = y0 - 1; y < y0 + h + 1; y++) {
      for (let x = x0 - 1; x < x0 + w + 1; x++) {
        const t = this.at(x, y);
        if (!t || t.indoor || t.veranda) continue;
        // мягкий природный силуэт вместо строгого прямоугольника
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        const wob = (fbm(x * 0.55, y * 0.55, 2, 21) - 0.5) * 0.3;
        const d = Math.sqrt(nx * nx + ny * ny) + wob;
        if (d <= 1.02) {
          t.water = true;
          t.ground = 'water';
          t.level = Math.min(t.level, 0);
        } else if (d <= 1.35 && !t.water) {
          t.ground = t.ground === 'tatami' || t.ground === 'deck' ? t.ground : 'sand';
        }
      }
    }
    this.checkMilestone('first_pond');
  }

  drain(x: number, y: number): void {
    const t = this.at(x, y);
    if (!t) return;
    t.water = false;
    if (t.ground === 'water') t.ground = 'moss';
  }

  setGround(x: number, y: number, g: GroundId): void {
    const t = this.at(x, y);
    if (!t) return;
    t.ground = g;
    if (g !== 'water') t.water = false;
    t.indoor = g === 'tatami';
    t.veranda = g === 'deck';
    if (g === 'tatami' || g === 'deck') {
      t.level = Math.max(t.level, 1);
      this.checkMilestone('first_deck');
    }
  }

  /** Плавно сшивает перепады высот, чтобы не было резких ступеней. */
  smoothTerrain(): void {
    for (let pass = 0; pass < 2; pass++) {
      const snapshot = this.tiles.map((t) => t.level);
      for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
          const i = this.idx(x, y);
          if (this.tiles[i].indoor) continue;
          let maxN = -99;
          let minN = 99;
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            if (!inBounds(x + dx, y + dy)) continue;
            const v = snapshot[this.idx(x + dx, y + dy)];
            maxN = Math.max(maxN, v);
            minN = Math.min(minN, v);
          }
          if (maxN === -99) continue;
          const cur = snapshot[i];
          if (cur < maxN - 1) this.tiles[i].level = maxN - 1;
          else if (cur > minN + 1) this.tiles[i].level = minN + 1;
        }
      }
    }
  }

  applyBrush(brush: TerrainBrush, tx: number, ty: number): boolean {
    const x0 = Math.floor(tx - (brush.w - 1) / 2);
    const y0 = Math.floor(ty - (brush.h - 1) / 2);
    switch (brush.kind) {
      case 'ground':
        for (let y = y0; y < y0 + brush.h; y++)
          for (let x = x0; x < x0 + brush.w; x++) {
            if (brush.id === 'w_fill') this.drain(x, y);
            else {
              const t = this.at(x, y);
              if (t && !t.indoor && !t.veranda) {
                t.ground = brush.ground!;
                t.water = false;
              }
            }
          }
        return true;
      case 'water':
        this.applyWaterBlock(x0, y0, brush.w, brush.h);
        return true;
      case 'hill':
        this.applyHill(x0, y0, brush.w, brush.h, 1);
        return true;
      case 'lower':
        this.applyHill(x0, y0, brush.w, brush.h, -1);
        return true;
      case 'floor':
        for (let y = y0; y < y0 + brush.h; y++)
          for (let x = x0; x < x0 + brush.w; x++) this.setGround(x, y, brush.ground!);
        return true;
    }
    return false;
  }

  // ---- Объекты ----

  canPlace(type: string, tx: number, ty: number): boolean {
    const item = ITEM_BY_ID.get(type);
    if (!item) return false;
    const x0 = Math.floor(tx);
    const y0 = Math.floor(ty);
    for (let y = y0; y < y0 + item.h; y++) {
      for (let x = x0; x < x0 + item.w; x++) {
        const t = this.at(x, y);
        if (!t) return false;
        if (item.needsWater && !t.water) return false;
        if (!item.onWater && t.water) return false;
      }
    }
    return true;
  }

  place(type: string, tx: number, ty: number, rot = 0, planted = Date.now()): PlacedObject | null {
    const item = ITEM_BY_ID.get(type);
    if (!item) return null;
    const obj: PlacedObject = {
      id: this.nextId++,
      type,
      tx,
      ty,
      planted,
      rot,
      seed: Math.floor(Math.random() * 100000),
    };
    this.objects.push(obj);
    if (type === 'cat') this.checkMilestone('first_cat');
    if (item.kind === 'tree') {
      const trees = this.objects.filter((o) => ITEM_BY_ID.get(o.type)?.kind === 'tree').length;
      if (trees >= 12) this.checkMilestone('grove');
    }
    return obj;
  }

  removeAt(tx: number, ty: number): PlacedObject | null {
    let best: PlacedObject | null = null;
    let bestD = 0.75;
    for (const o of this.objects) {
      const item = ITEM_BY_ID.get(o.type);
      if (!item) continue;
      const cx = o.tx + item.w / 2;
      const cy = o.ty + item.h / 2;
      const d = Math.hypot(cx - tx, cy - ty);
      if (d < bestD) {
        bestD = d;
        best = o;
      }
    }
    if (best) this.objects = this.objects.filter((o) => o !== best);
    return best;
  }

  checkMilestone(id: string): void {
    if (this.milestones.has(id) || !MILESTONES[id]) return;
    this.milestones.add(id);
    this.pendingMilestones.push(id);
  }

  /** Стадия роста 0..1 для объекта. */
  growth(o: PlacedObject, now: number): number {
    const item = ITEM_BY_ID.get(o.type);
    if (!item || item.growDays <= 0) return 1;
    const age = (now - o.planted) / (item.growDays * DAY_MS);
    return clamp(age, 0.06, 1);
  }

  // ---- Сохранение ----

  toJSON(): SaveData {
    return {
      version: 3,
      tiles: this.tiles,
      objects: this.objects,
      nextId: this.nextId,
      milestones: [...this.milestones],
      seen: [...this.seenTabs],
    };
  }

  save(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.toJSON()));
    } catch {
      /* тишина */
    }
  }

  load(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw) as SaveData;
      if (!d || d.version !== 3 || !Array.isArray(d.tiles) || d.tiles.length !== GRID * GRID) return false;
      this.tiles = d.tiles;
      this.objects = d.objects ?? [];
      this.nextId = d.nextId ?? 1;
      this.milestones = new Set(d.milestones ?? []);
      this.seenTabs = new Set(d.seen ?? []);
      return true;
    } catch {
      return false;
    }
  }

  clearSave(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* тишина */
    }
  }

  hasWaterNear(tx: number, ty: number, r = 2): boolean {
    for (let y = Math.floor(ty - r); y <= ty + r; y++)
      for (let x = Math.floor(tx - r); x <= tx + r; x++) {
        const t = this.at(x, y);
        if (t?.water) return true;
      }
    return false;
  }

  /** Используется для уведомления о вечере. */
  noteEvening(): void {
    this.checkMilestone('first_evening');
  }

  brushById(id: string): TerrainBrush | undefined {
    return BRUSH_BY_ID.get(id);
  }
}
