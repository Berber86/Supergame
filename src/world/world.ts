/** Состояние усадьбы: рельеф, вода, объекты, вехи. */

import { GRID, inBounds } from '../core/iso';
import { clamp, fbm, hash2 } from '../core/rng';
import {
  BRUSH_BY_ID,
  FURNITURE_IDS,
  SMALL_HOUSE_IDS,
  CatalogItem,
  ITEMS,
  ITEM_BY_ID,
  MILESTONES,
  TAB_BY_ID,
  TERRAIN_BRUSHES,
  TerrainBrush,
  footprintCells,
} from './catalog';
import { ChronicleEntry, noteChronicle } from './chronicle';
import { GrowRect, GrowState, growOfferReady, growTick, growZones, inGrowRect } from './grow';
import { DAY_MS } from '../core/clock';
import { SAVE_VERSION, parseSave, serializeSave } from './saveFormat';
import { GroundId, PlacedObject, SaveData, Tile } from './types';

const SAVE_KEY = 'usadba.save.v3';

export interface ChronicleToastNote {
  id: string;
  x: number;
  y: number;
  at?: number;
}

export class World {
  /** Сторона сада в тайлах — чтобы рендер не импортировал GRID отдельно. */
  readonly size = GRID;
  tiles: Tile[] = [];
  objects: PlacedObject[] = [];
  nextId = 1;
  milestones = new Set<string>();
  seenTabs = new Set<string>();
  /** Каталог открытий: предметы, доступные игроку. Копятся через строительство. */
  unlocked = new Set<string>();
  /** Свежие открытия: золотая точка горит до первой постройки предмета. */
  fresh = new Set<string>();
  /** Летопись сада: первые встречи и редкие события, по одной строке. */
  chronicle: ChronicleEntry[] = [];
  /** Очередь уведомлений о новых вехах. */
  pendingMilestones: string[] = [];
  /** Очередь новых строк летописи — мягкие заметки поверх сада. */
  pendingNotes: ChronicleToastNote[] = [];
  /** Границы последней правки земли — для частичной перерисовки. */
  lastTouched: { x0: number; y0: number; x1: number; y1: number } | null = null;

  constructor() {
    this.reset();
  }

  idx(x: number, y: number): number {
    return y * GRID + x;
  }

  /** Отметить клетку как изменённую. */
  private touch(x: number, y: number): void {
    const r = this.lastTouched;
    if (!r) this.lastTouched = { x0: x, y0: y, x1: x, y1: y };
    else {
      if (x < r.x0) r.x0 = x;
      if (y < r.y0) r.y0 = y;
      if (x > r.x1) r.x1 = x;
      if (y > r.y1) r.y1 = y;
    }
  }

  clearTouched(): void {
    this.lastTouched = null;
  }

  at(x: number, y: number): Tile | null {
    if (!inBounds(x, y)) return null;
    return this.tiles[this.idx(x, y)];
  }

  reset(): void {
    this.born = Date.now();
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
    // Вольный сад: режима роста нет
    this.grow = null;
    this.growRefused = false;
    this.milestones = new Set();
    this.seasonsSeen = new Set();
    // Летопись нового сада пуста: встречи ещё впереди
    this.chronicle = [];
    this.pendingNotes = [];
    this.seenTabs = new Set(['ground', 'water', 'relief', 'trees', 'stones', 'micro']);
    this.seedStarterGarden();

    // Начальный сад сам по себе подходит под несколько вех — но игрок
    // их не заслужил, и вываливать ему пачку наград на первой секунде
    // нечестно. Засчитываем молча то, что уже верно на старте: наградой
    // остаётся только то, что он сделает сам.
    this.observe(Date.now(), 'spring', false, false);
    this.pendingMilestones.length = 0;
    this.initUnlocks(true);
  }

  /**
   * Открытия каталога. Строгий старт (растущий сад): ровно одно случайное
   * открытие, всё остальное впереди. Мягкий (вольный сад-витрина): доступно
   * то, что уже стоит, и земные кисти, плюс одно открытие впереди.
   * Дикие постройки (улей, бельчатник, бревно черепахи, кормушка, поилка)
   * должны быть видны сразу — иначе вкладка Гости не появляется вовсе,
   * т.к. tabHasContent требует unlocked.
   */
  initUnlocks(lenient: boolean): void {
    this.unlocked = new Set();
    this.fresh = new Set();
    if (lenient) {
      for (const o of this.objects) if (ITEM_BY_ID.has(o.type)) this.unlocked.add(o.type);
      for (const b of TERRAIN_BRUSHES) this.unlocked.add(b.id);
      this.unlockInteriorIfHoused();
      // Всегда открыты базовые приглашения дикой жизни
      for (const id of ['feeder', 'birdbath', 'beehive', 'squirrel_feeder', 'turtle_log']) {
        this.unlocked.add(id);
      }
    }
    this.unlockRandomItem();
  }

  /** Free established gardens should not hide the house tab behind painting one more floor tile. */
  private unlockInteriorIfHoused(): void {
    if (this.grow) return;
    if (!this.tiles.some((t) => t.indoor) && !this.objects.some((o) => SMALL_HOUSE_IDS.has(o.type))) return;
    for (const id of FURNITURE_IDS) this.unlocked.add(id);
  }

  /** A furnished free-garden preset can have a house without a recorded construction milestone. */
  tabAvailable(id: string): boolean {
    const tab = TAB_BY_ID.get(id);
    if (!tab) return false;
    if (!tab.requires || this.milestones.has(tab.requires)) return true;
    return (
      id === 'house' &&
      !this.grow &&
      (this.tiles.some((t) => t.indoor) || this.objects.some((o) => SMALL_HOUSE_IDS.has(o.type)))
    );
  }

  /** Запись каталога технически доступна: веха вкладки открыта, размер влезает. */
  itemAvailable(item: CatalogItem | TerrainBrush): boolean {
    const tab = TAB_BY_ID.get(item.tab);
    if (!tab) return false;
    if (!this.tabAvailable(item.tab)) return false;
    if (this.grow) {
      const r = this.grow.rect;
      const straight = item.w <= r.w && item.h <= r.h;
      const turned = 'rotatable' in item && !!item.rotatable && item.h <= r.w && item.w <= r.h;
      if (!straight && !turned) return false;
      // В растущем саду усадьбу не выдаём до появления самого здания:
      // сначала игрок строит сад, потом дом. Тайл здания — tatami (indoor).
      if (item.tab === 'house') {
        let hasHouse = false;
        for (let y = r.y; y < r.y + r.h && !hasHouse; y++) {
          for (let x = r.x; x < r.x + r.w; x++) {
            const t = this.at(x, y);
            if (t?.indoor) {
              hasHouse = true;
              break;
            }
          }
        }
        if (!hasHouse) return false;
      }
    }
    return true;
  }

  /** Открыть одну случайную доступную запись: предмет или кисть. */
  unlockRandomItem(): string | null {
    const pool: (CatalogItem | TerrainBrush)[] = [...ITEMS, ...TERRAIN_BRUSHES];
    const closed = pool.filter((e) => !this.unlocked.has(e.id) && this.itemAvailable(e));
    if (!closed.length) return null;
    const pick = closed[Math.floor(Math.random() * closed.length)];
    this.unlocked.add(pick.id);
    this.fresh.add(pick.id);
    return pick.id;
  }

  /** Кисть или заливка впервые тронули сад: точка открытия гаснет. */
  useEntry(id: string): boolean {
    if (!this.fresh.has(id)) return false;
    this.fresh.delete(id);
    return true;
  }

  /** Строительство случилось: точка предмета гаснет, открывается что-то новое. */
  onBuiltItem(itemId: string): void {
    this.fresh.delete(itemId);
    this.unlockRandomItem();
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
      [11, 9],
      [11, 10],
      [12, 11],
      [13, 11],
      [14, 11],
      [15, 10],
      [16, 10],
      [17, 9],
      [17, 8],
      [18, 7],
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

    // Мостик через пруд: северо-западный конец у каменистого мысика,
    // юго-восточный — на песчаной кромке под скальным трио. Раньше дуга
    // стояла посреди воды и «висела в воздухе».
    this.place('bridge', 17, 11, 0, old);

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
    // New gardens only. Keep the tea area open; partition off a quiet sleeping nook.
    const furnishings: [string, number, number, number][] = [
      ['tokonoma', 3.5, 3, 0],
      ['tansu', 6, 3, 0],
      ['indoor_plant', 9, 3, 0],
      ['futon', 3.5, 6.5, 1],
      ['byobu', 5, 6, 1],
      ['byobu', 5, 7, 1],
      ['irori', 8.5, 7.5, 0],
      ['bonsai', 8, 3, 0],
      ['bookshelf', 4.5, 3, 0],
      ['kotatsu', 3.5, 4.5, 0],
      ['engawa_bench', 10, 5, 1],
    ];
    for (const [type, x, y, rot] of furnishings) {
      if (this.canPlace(type, x, y, rot)) this.place(type, x, y, rot, old);
    }
    this.place('cat', 7.5, 7.5, 0, old);
    // Миска у кота: второму коту будет зачем остаться
    this.place('bowl', 9.5, 7.5, 0, old);
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
      ['maple', 2.5, 12.5],
      ['pine', 1, 8.5],
      ['sakura', 2.5, 19],
      ['ginkgo', 11.5, 20.5],
      ['maple', 13.5, 22.5],
      ['pine', 17.5, 21.5],
      ['sakura', 20.5, 22.5],
      ['willow', 19.5, 15.5],
      ['maple', 22.5, 11.5],
      ['pine', 23.5, 16.5],
      ['ginkgo', 6.5, 23],
      ['sakura', 16.5, 19.5],
      ['hedge', 15.25, 8.5],
      ['hedge', 18.75, 19.25],
      ['azalea', 21.25, 16.75],
      ['azalea', 3.25, 10.5],
      ['azalea', 12.75, 18.5],
      ['hedge', 9.25, 12.25],
      ['bamboo', 23.5, 8.5],
      ['bamboo', 23, 9.75],
      ['bamboo', 22.5, 22.5],
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
    for (const [x, y] of [
      [18, 16],
      [19, 17],
      [20, 17],
      [21, 18],
      [21, 19],
      [22, 20],
    ] as [number, number][]) {
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
      const kind =
        r2 > 0.72 ? 'moss_clump' : r2 > 0.5 ? 'grass_tuft' : r2 > 0.3 ? 'fern' : r2 > 0.15 ? 'iris' : 'pebbles';
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
        this.touch(x, y);
      }
    }
    this.smoothTerrain();
  }

  /** Дерево или куст, который нельзя заливать — станет островком. */
  private hasBlockingTree(x: number, y: number): boolean {
    for (const o of this.objects) {
      const item = ITEM_BY_ID.get(o.type);
      if (!item) continue;
      if (item.onWater) continue;
      if (item.kind !== 'tree' && item.kind !== 'shrub') continue;
      const r = footprintCells(item, o.tx, o.ty, o.rot);
      if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return true;
    }
    return false;
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
        if (this.hasBlockingTree(x, y)) continue;
        // мягкий природный силуэт вместо строгого прямоугольника
        // добавляем второй шум для более рваного берега
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        const wob = (fbm(x * 0.55, y * 0.55, 2, 21) - 0.5) * 0.32 + (fbm(x * 1.1 + 7, y * 1.1 - 3, 2, 47) - 0.5) * 0.18;
        const d = Math.sqrt(nx * nx + ny * ny) + wob;
        if (d <= 1.02) {
          this.touch(x, y);
          t.water = true;
          t.ground = 'water';
          t.level = Math.min(t.level, 0);
        } else if (d <= 1.45 && !t.water) {
          // песок более рваный, не сплошным кольцом
          if (hash2(x, y, 19) > 0.18) {
            this.touch(x, y);
            t.ground = t.ground === 'tatami' || t.ground === 'deck' ? t.ground : 'sand';
          }
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
    this.touch(x, y);
  }

  setGround(x: number, y: number, g: GroundId): void {
    const t = this.at(x, y);
    if (!t) return;
    this.touch(x, y);
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
          if (cur < maxN - 1) {
            this.tiles[i].level = maxN - 1;
            this.touch(x, y);
          } else if (cur > minN + 1) {
            this.tiles[i].level = minN + 1;
            this.touch(x, y);
          }
        }
      }
    }
  }

  /**
   * Размер кисти для земли: 1, 3 или 5 клеток. Модульные блоки (пруд, холм)
   * свой размер уже несут в себе, их это не касается.
   */
  brushSize = 1;

  /** Режим растущего сада: null у вольных усадеб. */
  grow: GrowState | null = null;
  /** Когда сад родился: годы летописи считаем отсюда. */
  born = Date.now();
  /** Действие кончилось: последний отказ, чтобы интерфейс тихо пояснил. */
  growRefused = false;
  private strokeCharged = false;

  /** Заливка области одним материалом вместо мазков по клетке. */
  floodFill(tx: number, ty: number, g: GroundId): boolean {
    const sx = Math.floor(tx);
    const sy = Math.floor(ty);
    const start = this.at(sx, sy);
    if (!start) return false;
    // В растущем саду заливать можно лишь открытую землю
    if (this.grow && !inGrowRect(this.grow.rect, sx, sy)) return false;
    if (!this.growPay()) return false;
    // Что считаем «той же областью»: материал и наличие воды
    const srcGround = start.ground;
    const srcWater = start.water;
    if (srcGround === g && !srcWater) return false;

    const seen = new Uint8Array(GRID * GRID);
    const stack: number[] = [this.idx(sx, sy)];
    let painted = 0;
    // Предел бережёт от случайной заливки всего сада одним кликом
    const LIMIT = 420;
    while (stack.length && painted < LIMIT) {
      const i = stack.pop()!;
      if (seen[i]) continue;
      seen[i] = 1;
      const x = i % GRID;
      const y = (i / GRID) | 0;
      const t = this.tiles[i];
      if (t.indoor || t.veranda) continue;
      if (this.grow && !inGrowRect(this.grow.rect, x, y)) continue;
      if (t.ground !== srcGround || t.water !== srcWater) continue;
      t.ground = g;
      t.water = false;
      this.touch(x, y);
      painted++;
      if (x > 0) stack.push(i - 1);
      if (x < GRID - 1) stack.push(i + 1);
      if (y > 0) stack.push(i - GRID);
      if (y < GRID - 1) stack.push(i + GRID);
    }
    return painted > 0;
  }

  applyBrush(brush: TerrainBrush, tx: number, ty: number): boolean {
    // Кисти земли растягиваются до выбранного размера, блоки — нет
    const isGroundPaint = brush.kind === 'ground';
    const bw = isGroundPaint ? this.brushSize : brush.w;
    const bh = isGroundPaint ? this.brushSize : brush.h;
    const x0 = Math.floor(tx - (bw - 1) / 2);
    const y0 = Math.floor(ty - (bh - 1) / 2);
    const rad = (bw - 1) / 2;
    // За туманом растущего сада кисть не работает: сперва открой землю
    if (this.grow && !(inGrowRect(this.grow.rect, x0, y0) && inGrowRect(this.grow.rect, x0 + bw - 1, y0 + bh - 1)))
      return false;
    if (!this.growPayStroke()) return false;
    switch (brush.kind) {
      case 'ground':
        for (let y = y0; y < y0 + bh; y++)
          for (let x = x0; x < x0 + bw; x++) {
            // Круглая кисть, а не квадрат — мазок ложится естественнее
            if (bw > 1 && Math.hypot(x - tx + 0.5, y - ty + 0.5) > rad + 0.62) continue;
            if (brush.id === 'w_fill') this.drain(x, y);
            else {
              const t = this.at(x, y);
              if (t && !t.indoor && !t.veranda) {
                this.touch(x, y);
                t.ground = brush.ground!;
                t.water = false;
              }
            }
          }
        return true;
      case 'water':
        this.applyWaterBlock(x0, y0, bw, bh);
        return true;
      case 'hill':
        this.applyHill(x0, y0, bw, bh, 1);
        return true;
      case 'lower':
        this.applyHill(x0, y0, bw, bh, -1);
        return true;
      case 'floor':
        for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) this.setGround(x, y, brush.ground!);
        return true;
      case 'spring':
        this.applySpring(x0, y0, bw, bh);
        return true;
      case 'cascade':
        this.applyCascade(x0, y0, bw, bh);
        return true;
      case 'steps':
        this.applySteps(x0, y0, bw, bh);
        return true;
      case 'terrace':
        this.applyTerrace(x0, y0, bw, bh);
        return true;
    }
    return false;
  }

  /**
   * Исток: приподнятая площадка с водой наверху. Сам по себе он никуда
   * не течёт — но стоит опустить землю рядом, и вода найдёт дорогу вниз.
   */
  applySpring(x0: number, y0: number, w: number, h: number): void {
    const cx = x0 + (w - 1) / 2;
    const cy = y0 + (h - 1) / 2;
    const rx = w / 2;
    const ry = h / 2;
    // Поднимаем площадку с запасом: широкий берег вокруг, иначе вода
    // выглядит стеклянной плитой, повисшей в воздухе.
    for (let y = y0 - 2; y < y0 + h + 2; y++) {
      for (let x = x0 - 2; x < x0 + w + 2; x++) {
        const t = this.at(x, y);
        if (!t || t.indoor || t.veranda) continue;
        const nx = (x - cx) / (rx + 1.6);
        const ny = (y - cy) / (ry + 1.6);
        if (Math.sqrt(nx * nx + ny * ny) > 1.15) continue;
        t.level = Math.max(t.level, 1);
        this.touch(x, y);
      }
    }
    // Вода — мягким пятном, как у обычного пруда, и с каменной кромкой
    for (let y = y0 - 1; y < y0 + h + 1; y++) {
      for (let x = x0 - 1; x < x0 + w + 1; x++) {
        const t = this.at(x, y);
        if (!t || t.indoor || t.veranda) continue;
        if (this.hasBlockingTree(x, y)) continue;
        const nx = (x - cx) / rx;
        const ny = (y - cy) / ry;
        const wob = (fbm(x * 0.55, y * 0.55, 2, 37) - 0.5) * 0.32 + (fbm(x * 1.2, y * 1.2, 2, 57) - 0.5) * 0.15;
        const d = Math.sqrt(nx * nx + ny * ny) + wob;
        if (d <= 1.02) {
          t.water = true;
          t.ground = 'water';
          this.touch(x, y);
        } else if (d <= 1.5 && !t.water) {
          if (hash2(x, y, 27) > 0.2) {
            t.ground = 'stone';
            this.touch(x, y);
          }
        }
      }
    }
    this.checkMilestone('first_pond');
    this.checkMilestone('running_water');
  }

  /**
   * Каскад: лестница из водяных ступеней, каждая ниже предыдущей.
   * Готовый водопад одним движением — самый наглядный способ показать
   * игроку, что вода умеет падать.
   */
  applyCascade(x0: number, y0: number, w: number, h: number): void {
    const steps = Math.max(2, Math.min(w, h));
    // Unequal, bent terrace bands rather than identical diagonal stair treads.
    const phase = hash2(x0, y0, 157) * Math.PI * 2;
    const bandOf = (x: number, y: number) => {
      const u = (x - x0) / Math.max(1, w - 1);
      const v = (y - y0) / Math.max(1, h - 1);
      const bend = Math.sin(Math.max(0, Math.min(1, v)) * Math.PI) * Math.sin(u * Math.PI + phase) * 0.12;
      const progress = u * 0.68 + v * 0.32 + bend;
      return Math.max(0, Math.min(steps - 1, Math.floor((progress + 0.08) * (steps - 0.2))));
    };

    // 1) Рельеф: каждая полоса ниже предыдущей, вокруг — покатый берег
    for (let y = y0 - 2; y < y0 + h + 2; y++) {
      for (let x = x0 - 2; x < x0 + w + 2; x++) {
        const t = this.at(x, y);
        if (!t || t.indoor || t.veranda) continue;
        const inside = x >= x0 - 1 && x < x0 + w + 1 && y >= y0 - 1 && y < y0 + h + 1;
        if (!inside) continue;
        const lvl = steps - 1 - bandOf(x, y);
        t.level = lvl;
        this.touch(x, y);
      }
    }

    // Winding banks with a guaranteed connected staircase through the centre.
    // The narrow/wide pools deliberately do not repeat at each elevation.
    const connector = Math.sin(phase) > 0 ? 1 : -1;
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const t = this.at(x, y);
        if (!t || t.indoor || t.veranda) continue;
        if (this.hasBlockingTree(x, y)) continue;
        const axis = x - x0 - (y - y0);
        const v = (y - y0) / Math.max(1, h - 1);
        const wob = Math.sin(v * 4.4 + phase) * 0.55;
        const width = 1.05 + Math.sin(v * 5.3 + phase + 1) * 0.4;
        if (Math.abs(axis + wob) > width && axis !== 0 && axis !== connector) continue;
        t.water = true;
        t.ground = 'water';
        this.touch(x, y);
      }
    }

    // 3) Камень по берегам русла — вода прорезает скалу
    for (let y = y0 - 1; y < y0 + h + 1; y++) {
      for (let x = x0 - 1; x < x0 + w + 1; x++) {
        const t = this.at(x, y);
        if (!t || t.water || t.indoor || t.veranda) continue;
        let nearWater = false;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as [number, number][]) {
          if (this.at(x + dx, y + dy)?.water) nearWater = true;
        }
        if (!nearWater) continue;
        if (hash2(x, y, 71) > 0.35) {
          t.ground = 'stone';
          this.touch(x, y);
        }
      }
    }

    // Сглаживаем окружение, чтобы каскад не выглядел кубично-ступенчатым
    // — без этого каждая полоса — отдельный куб с земляной стенкой.
    this.smoothTerrain();

    this.checkMilestone('first_pond');
    this.checkMilestone('running_water');
  }

  /** Ступени: плавный подъём в одну клетку шириной. */
  applySteps(x0: number, y0: number, w: number, h: number): void {
    // определяем, куда подниматься: сравниваем концы полосы
    const a = this.at(x0, y0);
    const b = this.at(x0 + w - 1, y0 + h - 1);
    const from = a ? a.level : 0;
    const to = b ? b.level : 0;
    const n = Math.max(w, h);
    for (let i = 0; i < n; i++) {
      const k = n > 1 ? i / (n - 1) : 0;
      const lvl = Math.round(from + (to - from) * k);
      const x = w > h ? x0 + i : x0;
      const y = h >= w ? y0 + i : y0;
      const t = this.at(x, y);
      if (!t || t.indoor) continue;
      t.level = lvl;
      t.water = false;
      if (t.ground === 'water') t.ground = 'stone';
      else t.ground = 'stone';
      this.touch(x, y);
    }
    this.checkMilestone('first_steps');
  }

  /** Терраса: ровная площадка, приподнятая над округой. */
  applyTerrace(x0: number, y0: number, w: number, h: number): void {
    // берём самую высокую точку под пятном и равняем всё по ней
    let top = -9;
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        const t = this.at(x, y);
        if (t) top = Math.max(top, t.level);
      }
    const lvl = clamp(top + 1, -1, 3);
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const t = this.at(x, y);
        if (!t || t.indoor || t.veranda) continue;
        t.level = lvl;
        t.water = false;
        if (t.ground === 'water') t.ground = 'moss';
        this.touch(x, y);
      }
    }
    this.checkMilestone('first_terrace');
  }

  // ---- Объекты ----

  /**
   * Может ли предмет встать на место. Проверяются клетки настоящего
   * отпечатка — с учётом поворота: мост 1×3 в положении 0 лежит вдоль
   * оси x, и у правого края сада встать уже не может.
   */
  canPlace(type: string, tx: number, ty: number, rot = 0): boolean {
    const item = ITEM_BY_ID.get(type);
    if (!item) return false;
    const r = footprintCells(item, tx, ty, rot);
    let anyWater = false;
    let anyLand = false;
    for (let y = r.y0; y <= r.y1; y++) {
      for (let x = r.x0; x <= r.x1; x++) {
        const t = this.at(x, y);
        if (!t) return false;
        if (item.kind === 'tree' && (t.indoor || t.veranda)) return false;
        if (item.needsWater && !t.water) return false;
        if (!item.onWater && t.water) return false;
        if (t.water) anyWater = true;
        else anyLand = true;
      }
    }
    // Мост обязан соединять берега: посреди пруда и посреди лужайки он не стоит.
    if (item.spansWater && (!anyWater || !anyLand)) return false;
    return true;
  }

  place(type: string, tx: number, ty: number, rot = 0, planted = Date.now()): PlacedObject | null {
    const item = ITEM_BY_ID.get(type);
    if (!item) return null;
    // В растущем саду каждое посаженное стоит действия,
    // а за туманом сажать нечего: сперва открой землю
    if (this.grow && !inGrowRect(this.grow.rect, tx, ty)) return null;
    if (!this.growPay()) return null;
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
    this.noteObjectsChanged();
    if (type === 'cat') this.checkMilestone('first_cat');
    if (item.kind === 'tree') {
      const trees = this.objects.filter((o) => ITEM_BY_ID.get(o.type)?.kind === 'tree').length;
      if (trees >= 12) this.checkMilestone('grove');
    }
    return obj;
  }

  /**
   * Сетка-индекс для выбора объектов. Строится лениво и только после
   * изменения расстановки: в саду сотни предметов, а указатель
   * интересуется одной точкой.
   */
  private pickBuckets = new Map<number, PlacedObject[]>();
  private pickVersion = 0;
  private pickBuilt = -1;
  /** Сторона ковша сетки в тайлах. */
  private static PICK_CELL = 4;

  /**
   * Расстановка изменилась (постановка, снос, перенос, загрузка,
   * отмена). Вызывается и снаружи — история правит список напрямую.
   */
  noteObjectsChanged(): void {
    this.pickVersion++;
  }

  private static bucketKey(bx: number, by: number): number {
    return bx * 1024 + by;
  }

  private buildPickIndex(): void {
    this.pickBuckets.clear();
    const S = World.PICK_CELL;
    for (const o of this.objects) {
      const item = ITEM_BY_ID.get(o.type);
      if (!item) continue;
      const cx = o.tx + item.w / 2;
      const cy = o.ty + item.h / 2;
      const k = World.bucketKey(Math.floor(cx / S), Math.floor(cy / S));
      const bucket = this.pickBuckets.get(k);
      if (bucket) bucket.push(o);
      else this.pickBuckets.set(k, [o]);
    }
    this.pickBuilt = this.pickVersion;
  }

  /**
   * Что находится под указателем. Ищем ближайший центр, но крупные
   * объекты имеют больший радиус захвата — иначе в валун 2×2 трудно попасть.
   *
   * Первым делом проверяется центр объекта, поэтому сетка обязана отдавать
   * те же результаты, что и полный перебор: ковш вдвое дальше ближайшего
   * возможного касания уже не может содержать подходящих центров.
   */
  pickObject(tx: number, ty: number): PlacedObject | null {
    if (this.pickBuilt !== this.pickVersion) this.buildPickIndex();
    const S = World.PICK_CELL;
    const bx = Math.floor(tx / S);
    const by = Math.floor(ty / S);

    let best: PlacedObject | null = null;
    let bestScore = Infinity;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const bucket = this.pickBuckets.get(World.bucketKey(bx + dx, by + dy));
        if (!bucket) continue;
        for (const o of bucket) {
          const item = ITEM_BY_ID.get(o.type)!;
          const cx = o.tx + item.w / 2;
          const cy = o.ty + item.h / 2;
          const reach = Math.max(item.w, item.h) * 0.5 + 0.3;
          const d = Math.hypot(cx - tx, cy - ty);
          if (d > reach) continue;
          // при равном расстоянии выигрывает тот, кто поставлен позже
          const score = d / reach - o.id * 1e-7;
          if (score < bestScore) {
            bestScore = score;
            best = o;
          }
        }
      }
    }
    return best;
  }

  removeObject(obj: PlacedObject): void {
    this.objects = this.objects.filter((o) => o !== obj);
    this.noteObjectsChanged();
  }

  removeAt(tx: number, ty: number): PlacedObject | null {
    const best = this.pickObject(tx, ty);
    if (best) this.removeObject(best);
    return best;
  }

  /**
   * Перенести уже поставленное. Возраст сохраняется — дерево, которое
   * растили неделю, не должно снова стать саженцем из-за переезда.
   *
   * Объект, которого уже нет в списке (например, пока шёл перенос,
   * усадьбу сменили), обратно не возвращается — иначе чужой предмет
   * появлялся бы в новом саду.
   */
  private moveObjectRaw(obj: PlacedObject, tx: number, ty: number, rot = obj.rot): boolean {
    const item = ITEM_BY_ID.get(obj.type);
    if (!item) return false;
    if (!this.objects.includes(obj)) return false;
    if (this.grow && !inGrowRect(this.grow.rect, Math.floor(tx), Math.floor(ty))) return false;
    const oldX = obj.tx;
    const oldY = obj.ty;
    const oldRot = obj.rot;
    // проверяем место без самого объекта — он себе не мешает
    this.removeObject(obj);
    const ok = this.canPlace(obj.type, tx, ty, rot);
    if (ok) {
      obj.tx = tx;
      obj.ty = ty;
      obj.rot = rot;
    } else {
      obj.tx = oldX;
      obj.ty = oldY;
      obj.rot = oldRot;
    }
    this.objects.push(obj);
    this.objects.sort((a, b) => a.id - b.id);
    this.noteObjectsChanged();
    return ok;
  }

  moveObject(obj: PlacedObject, tx: number, ty: number, rot = obj.rot): boolean {
    if (this.grow && !inGrowRect(this.grow.rect, Math.floor(tx), Math.floor(ty))) return false;
    if (!this.growPay()) return false;
    return this.moveObjectRaw(obj, tx, ty, rot);
  }

  /** Перенос без списания действия — для перетаскивания мышью (плата берётся один раз в конце жеста). */
  moveObjectFree(obj: PlacedObject, tx: number, ty: number, rot = obj.rot): boolean {
    return this.moveObjectRaw(obj, tx, ty, rot);
  }

  /** Сезоны, которые игрок уже застал. */
  seasonsSeen = new Set<string>();

  checkMilestone(id: string): void {
    if (this.milestones.has(id) || !MILESTONES[id]) return;
    this.milestones.add(id);
    this.pendingMilestones.push(id);
  }

  /**
   * Строка летописи. Первые встречи не повторяются: сад помнит, кого
   * уже видел. Некоторые строки заодно поднимают веху — но только те,
   * что нельзя «выполнить» нарочно.
   */
  noteEvent(id: string, now: number, x?: number, y?: number): boolean {
    // В растущем саду события за туманом не должны попадать в летопись:
    // иначе тосты и Polaroid приходят из неоткрытой земли.
    if (this.grow && x != null && y != null) {
      if (!inGrowRect(this.grow.rect, Math.floor(x), Math.floor(y))) return false;
    }
    if (!noteChronicle(this.chronicle, id, now)) return false;
    this.pendingNotes.push({ id, x: x ?? GRID / 2, y: y ?? GRID / 2, at: now });
    if (id === 'meet_frog') this.checkMilestone('first_frog');
    if (id === 'guest_stayed') this.checkMilestone('second_cat');
    if (id === 'chorus') this.checkMilestone('frog_chorus');
    if (id === 'winter_table') this.checkMilestone('winter_feeder');
    if (id === 'meet_firefly') this.checkMilestone('night_lights');
    if (id === 'meet_heron') this.checkMilestone('heron_guest');
    if (id === 'meet_deer') this.checkMilestone('deer_guest');
    if (id === 'meet_hedgehog') this.checkMilestone('hedgehog_guest');
    if (id === 'meet_mouse') this.checkMilestone('mouse_guest');
    if (id === 'meet_owl') this.checkMilestone('owl_guest');
    if (id === 'meet_squirrel') this.checkMilestone('squirrel_guest');
    if (id === 'meet_turtle') this.checkMilestone('turtle_guest');
    if (id === 'meet_bee') this.checkMilestone('bee_guest');
    return true;
  }

  hasEvent(id: string): boolean {
    return this.chronicle.some((e) => e.id === id);
  }

  /** Стадия роста 0..1 для объекта — рост убран, всё сажается сразу взрослым. */
  growth(_o: PlacedObject, _now: number): number {
    return 1;
  }

  // ---- Сохранение ----

  // ---------------- Растущий сад ----------------

  /** Начислить действия за прошедшее настоящее время (тихо, без UI). */
  growTickNow(): void {
    if (this.grow) growTick(this.grow, Date.now());
  }

  /**
   * Списать одно действие. У вольного сада счета нет вовсе — возвращаем
   * true, чтобы прежняя игра не заметила новой бухгалтерии.
   */
  growPay(): boolean {
    if (!this.grow) return true;
    growTick(this.grow, Date.now());
    if (this.grow.bank <= 0) {
      this.growRefused = true;
      return false;
    }
    this.grow.bank -= 1;
    this.grow.progress += 1;
    return true;
  }

  /** Мазок кисти земли стоит как одно действие, каким бы длинным ни был. */
  growPayStroke(): boolean {
    if (!this.grow) return true;
    if (this.strokeCharged) return true;
    const ok = this.growPay();
    if (ok) this.strokeCharged = true;
    return ok;
  }

  /** Новая кисть — новый мазок: счётчик мазка сбрасывается. */
  beginStroke(): void {
    this.strokeCharged = false;
  }

  /** Зоны-кандидаты расширения, когда порог действий достигнут. */
  growZonesNow(): GrowRect[] {
    if (!this.grow || !growOfferReady(this.grow)) return [];
    return growZones(this.grow.rect);
  }

  /** Выбранная зона открыта: сад вырос, счёт до следующего порога. */
  growExpand(zone: GrowRect): void {
    const g = this.grow;
    if (!g) return;
    const r = g.rect;
    const x = Math.min(r.x, zone.x);
    const y = Math.min(r.y, zone.y);
    const x1 = Math.max(r.x + r.w, zone.x + zone.w);
    const y1 = Math.max(r.y + r.h, zone.y + zone.h);
    g.rect = { x, y, w: x1 - x, h: y1 - y };
    g.progress = 0;
    g.stage += 1;
    g.choosing = false;
    this.noteObjectsChanged();
  }

  toJSON(): SaveData {
    // Фото-ловушка: храним снимки только для последних 18 строк, иначе localStorage переполнится
    const keepSnapFrom = Math.max(0, this.chronicle.length - 18);
    return {
      version: SAVE_VERSION,
      tiles: this.tiles,
      objects: this.objects,
      nextId: this.nextId,
      milestones: [...this.milestones],
      seasons: [...this.seasonsSeen],
      seen: [...this.seenTabs],
      chronicle: this.chronicle.map((e, i) => ({
        id: e.id,
        at: e.at,
        snap: i >= keepSnapFrom ? e.snap : undefined,
      })),
      grow: this.grow
        ? { ...this.grow, rect: { ...this.grow.rect }, ...(this.grow.clock ? { clock: { ...this.grow.clock } } : {}) }
        : null,
      born: this.born,
      unlocked: [...this.unlocked],
      fresh: [...this.fresh],
    };
  }

  save(): void {
    try {
      localStorage.setItem(SAVE_KEY, serializeSave(this.toJSON()));
    } catch {
      /* тишина */
    }
  }

  /**
   * Применить уже проверенное сохранение. Отдельно от разбора, чтобы
   * хранилище могло само выбрать живую копию (основная, резервная,
   * временная), а мир получал только чистые данные.
   */
  applySave(p: SaveData): void {
    this.tiles = p.tiles.map((t) => ({
      ground: t.ground,
      level: t.level,
      water: t.water,
      indoor: t.indoor,
      veranda: t.veranda,
    }));
    this.objects = p.objects.map((o) => ({ ...o }));
    // Repair only the identifiable original starter pine, not arbitrary player plantings.
    const legacyPine = this.objects.find((o) => o.type === 'pine' && o.tx === 3.5 && o.ty === 8.5);
    const starter =
      this.objects.some((o) => o.type === 'torii' && o.tx === 22.5 && o.ty === 20.5) &&
      this.objects.some((o) => o.type === 'table' && o.tx === 6.5 && o.ty === 5.5) &&
      Array.from({ length: 42 }, (_, i) => this.at(3 + (i % 7), 3 + Math.floor(i / 7))?.indoor).every(Boolean);
    if (legacyPine && starter && this.canPlace('pine', 1, 8.5, legacyPine.rot)) legacyPine.tx = 1;

    this.nextId = p.nextId;
    for (const o of this.objects) this.nextId = Math.max(this.nextId, o.id + 1);
    this.milestones = new Set(p.milestones);
    this.seasonsSeen = new Set(p.seasons);
    this.seenTabs = new Set(p.seen);
    this.chronicle = (p.chronicle ?? []).map((e) => ({ id: e.id, at: e.at, snap: (e as any).snap }));
    this.grow = p.grow ?? null;
    this.born = p.born ?? this.born;
    // Лягушки из тумана: если в открытом саду нет воды, случайные строки
    // прежних ошибок не остаются в книге
    if (this.grow) {
      const r = this.grow.rect;
      let water = false;
      for (let y = r.y; y < r.y + r.h && !water; y++)
        for (let x = r.x; x < r.x + r.w; x++)
          if (this.tiles[y * GRID + x].water) {
            water = true;
            break;
          }
      if (!water) {
        this.chronicle = this.chronicle.filter((e) => e.id !== 'meet_frog' && e.id !== 'frog_chorus');
        this.milestones.delete('first_frog');
        this.milestones.delete('frog_chorus');
      }
    }
    this.growRefused = false;
    this.strokeCharged = false;
    this.pendingMilestones = [];
    this.pendingNotes = [];
    this.lastTouched = null;
    if (p.unlocked) {
      this.unlocked = new Set(p.unlocked);
      this.fresh = new Set(p.fresh ?? []);
      // Миграция: старые сохранения не имели улья/бельчатника/бревна в unlocked,
      // из-за чего вкладка Гости не появлялась. Добавляем их принудительно.
      for (const id of ['feeder', 'birdbath', 'beehive', 'squirrel_feeder', 'turtle_log']) {
        if (ITEM_BY_ID.has(id)) this.unlocked.add(id);
      }
    } else {
      // Старое сохранение: растущий сад начинает путь заново с одного открытия,
      // вольный оставляет себе то, что уже прожито
      this.initUnlocks(!p.grow);
    }
    // Expose the interior kit in established free gardens, without moving/adding a single object.
    // Growing gardens retain their existing discovery progression.
    this.unlockInteriorIfHoused();
    this.noteObjectsChanged();
  }

  /**
   * Принять разобранное сохранение любой прошлой версии. Данные проверяются
   * целиком до того, как мир будет тронут: битый файл возвращает false
   * и оставляет текущий сад нетронутым.
   */
  fromJSON(d: unknown): boolean {
    const parsed = parseSave(d);
    if (!parsed) return false;
    this.applySave(parsed);
    return true;
  }

  load(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      return this.fromJSON(JSON.parse(raw) as SaveData);
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

  /**
   * Вехи, которые сад замечает сам.
   *
   * Их нельзя «выполнить» нарочно — они отмечают то, что уже случилось:
   * игрок застал снег, остался под дождём, дождался взрослого дерева.
   * Поэтому проверка живёт здесь, а не в местах постройки.
   */
  observe(_now: number, season: string, night: boolean, raining: boolean): void {
    // Круг года: сезоны накапливаются между сессиями
    if (!this.seasonsSeen.has(season)) {
      this.seasonsSeen.add(season);
      if (this.seasonsSeen.size >= 4) this.checkMilestone('four_seasons');
    }
    if (night) this.checkMilestone('night_visit');
    if (season === 'winter') this.checkMilestone('first_snow');
    if (raining) this.checkMilestone('in_the_rain');

    // Сад камней: много гравия и хотя бы пара валунов
    let gravel = 0;
    for (const t of this.tiles) if (t.ground === 'gravel') gravel++;
    if (gravel >= 20) {
      let rocks = 0;
      for (const o of this.objects)
        if (o.type === 'rock_big' || o.type === 'rock_trio' || o.type === 'rock_mid') rocks++;
      if (rocks >= 3) this.checkMilestone('stone_garden');
    }

    // Считаем разом всё, что зависит от состава сада
    let lanterns = 0;
    let koi = 0;
    let indoorKinds = 0;
    const seenIndoor = new Set<string>();
    let grown = false;
    for (const o of this.objects) {
      const item = ITEM_BY_ID.get(o.type);
      if (item?.kind === 'lantern') lanterns++;
      if (o.type === 'koi') koi++;
      const t = this.at(Math.floor(o.tx), Math.floor(o.ty));
      if (t?.indoor && !seenIndoor.has(o.type)) {
        seenIndoor.add(o.type);
        indoorKinds++;
      }
      // Рост убран: дерево сразу взрослое, веха даётся за наличие крупного дерева
      if (!grown && item && item.kind === 'tree') grown = true;
    }
    if (lanterns >= 5) this.checkMilestone('lantern_path');
    if (koi >= 3) this.checkMilestone('koi_pond');
    if (indoorKinds >= 5) this.checkMilestone('full_house');
    if (grown) this.checkMilestone('old_tree');
    if (this.objects.length >= 100) this.checkMilestone('hundred');
  }

  brushById(id: string): TerrainBrush | undefined {
    return BRUSH_BY_ID.get(id);
  }
}
