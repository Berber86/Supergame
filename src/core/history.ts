/**
 * Отмена и повтор.
 *
 * Подход — снимок с последующим вычитанием. Перед действием запоминаем
 * состояние, после — сравниваем и храним только то, что изменилось.
 * Это дороже команд по уму, но сравнение 676 тайлов занимает доли
 * миллисекунды и случается раз на действие игрока, зато World остаётся
 * чистым: ни один метод не обязан знать про историю.
 *
 * Про память. Правки тайлов хранятся упакованными — по три числа на
 * клетку (индекс, было, стало) вместо пары полных объектов, а общий
 * объём ограничен сверху: когда правок слишком много, самые старые
 * шаги уступают место новым. Сто двадцать шагов кистью живут вечно,
 * заливки всего сада — столько, сколько поместится в потолок.
 */

import { packTile, unpackTile } from '../world/saveFormat';
import { PlacedObject, Tile } from '../world/types';
import { World } from '../world/world';

/** Перенос: объект тот же, изменилось только где он стоит. */
interface MoveDelta {
  obj: PlacedObject;
  before: { tx: number; ty: number; rot: number };
  after: { tx: number; ty: number; rot: number };
}

export interface Edit {
  label: string;
  /** Упакованные правки тайлов, по три числа: индекс, было, стало. */
  tiles: number[];
  added: PlacedObject[];
  removed: PlacedObject[];
  moved: MoveDelta[];
  milestones: string[];
  /** Правки земли одной кистью сливаются в одну запись. */
  mergeKey: string | null;
}

interface Snapshot {
  tiles: Tile[];
  objectIds: Set<number>;
  objects: Map<number, PlacedObject>;
  /**
   * Позы объектов копией, а не ссылкой: перенос меняет объект на месте,
   * и по ссылке «было» уже не отличить от «стало».
   */
  poses: Map<number, { tx: number; ty: number; rot: number }>;
  milestones: Set<string>;
}

export const MAX_STEPS = 120;
/**
 * Потолок хранимых правок тайлов. В худшем случае это километры сплошных
 * заливок: 65536 клеток × ~25 байт — измеримо меньше двух мегабайт против
 * прежних ~5.7 МБ. Обычная игра до потолка не доходит никогда.
 */
export const TILE_BUDGET = 65536;

function copyTile(t: Tile): Tile {
  return { ground: t.ground, level: t.level, water: t.water, indoor: t.indoor, veranda: t.veranda };
}

function sameTile(a: Tile, b: Tile): boolean {
  return (
    a.ground === b.ground && a.level === b.level && a.water === b.water && a.indoor === b.indoor && a.veranda === b.veranda
  );
}

export class History {
  private world: World;
  private past: Edit[] = [];
  private future: Edit[] = [];
  private snap: Snapshot | null = null;
  private pendingLabel = '';
  private pendingMerge: string | null = null;
  /** Пока идёт применение отмены, новые записи не пишутся. */
  private applying = false;
  /** Сколько правок тайлов хранится всего — для потолка. */
  private tilesCount = 0;

  constructor(world: World) {
    this.world = world;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  get undoLabel(): string {
    return this.past.length ? this.past[this.past.length - 1].label : '';
  }

  get redoLabel(): string {
    return this.future.length ? this.future[this.future.length - 1].label : '';
  }

  /** Полностью забыть историю — например, при загрузке другой усадьбы. */
  clear(): void {
    this.past = [];
    this.future = [];
    this.snap = null;
    this.tilesCount = 0;
  }

  /**
   * Начать действие. `mergeKey` склеивает соседние однородные правки:
   * ведение кистью по земле должно отменяться одним движением, а не
   * по клетке.
   */
  begin(label: string, mergeKey: string | null = null): void {
    if (this.applying || this.snap) return;
    this.pendingLabel = label;
    this.pendingMerge = mergeKey;
    this.snap = {
      tiles: this.world.tiles.map(copyTile),
      objectIds: new Set(this.world.objects.map((o) => o.id)),
      objects: new Map(this.world.objects.map((o) => [o.id, o])),
      poses: new Map(this.world.objects.map((o) => [o.id, { tx: o.tx, ty: o.ty, rot: o.rot }])),
      milestones: new Set(this.world.milestones),
    };
  }

  /** Закончить действие. Возвращает true, если что-то действительно изменилось. */
  commit(): boolean {
    const snap = this.snap;
    this.snap = null;
    if (!snap || this.applying) return false;

    const tiles: number[] = [];
    for (let i = 0; i < this.world.tiles.length; i++) {
      const now = this.world.tiles[i];
      const was = snap.tiles[i];
      if (!sameTile(was, now)) tiles.push(i, packTile(was), packTile(now));
    }

    const added: PlacedObject[] = [];
    const moved: MoveDelta[] = [];
    const nowIds = new Set<number>();
    for (const o of this.world.objects) {
      nowIds.add(o.id);
      if (!snap.objectIds.has(o.id)) {
        added.push(o);
        continue;
      }
      const was = snap.poses.get(o.id)!;
      if (was.tx !== o.tx || was.ty !== o.ty || was.rot !== o.rot) {
        moved.push({ obj: o, before: was, after: { tx: o.tx, ty: o.ty, rot: o.rot } });
      }
    }
    const removed: PlacedObject[] = [];
    for (const id of snap.objectIds) {
      if (!nowIds.has(id)) removed.push(snap.objects.get(id)!);
    }

    const milestones: string[] = [];
    for (const m of this.world.milestones) if (!snap.milestones.has(m)) milestones.push(m);

    if (!tiles.length && !added.length && !removed.length && !moved.length) return false;

    const edit: Edit = {
      label: this.pendingLabel,
      tiles,
      added,
      removed,
      moved,
      milestones,
      mergeKey: this.pendingMerge,
    };

    // Слияние с предыдущей записью того же мазка
    const prev = this.past[this.past.length - 1];
    if (prev && edit.mergeKey && prev.mergeKey === edit.mergeKey) {
      this.mergeInto(prev, edit);
    } else {
      this.past.push(edit);
      this.tilesCount += edit.tiles.length / 3;
    }
    this.trim();
    this.future = [];
    return true;
  }

  /** Вытеснить самые старые шаги, когда память или глубина за потолком. */
  private trim(): void {
    while (this.tilesCount > TILE_BUDGET || this.past.length > MAX_STEPS) {
      const e = this.past.shift();
      if (!e) break;
      this.tilesCount -= e.tiles.length / 3;
    }
  }

  /** Отбросить начатое действие, ничего не записывая. */
  abort(): void {
    this.snap = null;
  }

  /** Разорвать слияние: следующий мазок станет отдельным шагом. */
  breakMerge(): void {
    const prev = this.past[this.past.length - 1];
    if (prev) prev.mergeKey = null;
  }

  private mergeInto(prev: Edit, next: Edit): void {
    if (next.tiles.length) {
      const pos = new Map<number, number>();
      for (let k = 0; k < prev.tiles.length; k += 3) pos.set(prev.tiles[k], k);
      for (let k = 0; k < next.tiles.length; k += 3) {
        const i = next.tiles[k];
        const at = pos.get(i);
        // «Было» берём самое раннее, «стало» — самое позднее
        if (at !== undefined) prev.tiles[at + 2] = next.tiles[k + 2];
        else {
          pos.set(i, prev.tiles.length);
          prev.tiles.push(i, next.tiles[k + 1], next.tiles[k + 2]);
          this.tilesCount++;
        }
      }
    }
    for (const o of next.added) {
      const i = prev.removed.findIndex((r) => r.id === o.id);
      if (i >= 0) prev.removed.splice(i, 1);
      else prev.added.push(o);
    }
    for (const o of next.removed) {
      const i = prev.added.findIndex((a) => a.id === o.id);
      if (i >= 0) prev.added.splice(i, 1);
      else prev.removed.push(o);
    }
    for (const d of next.moved) {
      const old = prev.moved.find((m) => m.obj.id === d.obj.id);
      if (old) old.after = d.after;
      else prev.moved.push(d);
    }
    for (const m of next.milestones) if (!prev.milestones.includes(m)) prev.milestones.push(m);
  }

  /** Отменить последнее действие. Возвращает подпись отменённого. */
  undo(): string | null {
    const edit = this.past.pop();
    if (!edit) return null;
    this.applying = true;
    this.tilesCount -= edit.tiles.length / 3;

    const t = edit.tiles;
    for (let k = 0; k < t.length; k += 3) this.world.tiles[t[k]] = unpackTile(t[k + 1]);
    if (edit.added.length) {
      const drop = new Set(edit.added.map((o) => o.id));
      this.world.objects = this.world.objects.filter((o) => !drop.has(o.id));
    }
    for (const o of edit.removed) this.world.objects.push(o);
    for (const d of edit.moved) {
      d.obj.tx = d.before.tx;
      d.obj.ty = d.before.ty;
      d.obj.rot = d.before.rot;
    }
    // Вехи не отбираем: однажды понятое не забывается — сад не отнимает
    // у игрока то, до чего он уже дошёл.
    this.reorderObjects();

    this.applying = false;
    this.future.push(edit);
    return edit.label;
  }

  /** Повторить отменённое. */
  redo(): string | null {
    const edit = this.future.pop();
    if (!edit) return null;
    this.applying = true;

    const t = edit.tiles;
    for (let k = 0; k < t.length; k += 3) this.world.tiles[t[k]] = unpackTile(t[k + 2]);
    if (edit.removed.length) {
      const drop = new Set(edit.removed.map((o) => o.id));
      this.world.objects = this.world.objects.filter((o) => !drop.has(o.id));
    }
    for (const o of edit.added) this.world.objects.push(o);
    for (const d of edit.moved) {
      d.obj.tx = d.after.tx;
      d.obj.ty = d.after.ty;
      d.obj.rot = d.after.rot;
    }
    for (const m of edit.milestones) this.world.milestones.add(m);
    this.reorderObjects();

    this.applying = false;
    this.past.push(edit);
    this.tilesCount += edit.tiles.length / 3;
    return edit.label;
  }

  /** Возвращённые объекты дописываются в конец — восстанавливаем порядок по id. */
  private reorderObjects(): void {
    this.world.objects.sort((a, b) => a.id - b.id);
    let maxId = 0;
    for (const o of this.world.objects) maxId = Math.max(maxId, o.id);
    this.world.nextId = Math.max(this.world.nextId, maxId + 1);
    // История правит список напрямую — сетке выбора нужно знать об этом
    this.world.noteObjectsChanged();
  }
}
