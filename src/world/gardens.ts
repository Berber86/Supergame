/**
 * Несколько усадеб в одном браузере: список, переключение, файл на диск.
 *
 * Слоты живут отдельными ключами localStorage, а рядом лежит лёгкий
 * указатель со списком имён и датами — чтобы показать выбор, не разбирая
 * каждое сохранение целиком.
 *
 * Сад — это часы и иногда недели труда игрока, поэтому запись ведётся
 * бережно:
 * — новая версия ложится во временный ключ и только потом подменяет
 *   основной: сбой посреди записи оставляет прошлое состояние целым;
 * — прежнее состояние держится резервной копией: если основной ключ
 *   побит, чтение поднимает копию и чинит основу;
 * — совсем битые данные не выбрасываются и не затираются новым садом,
 *   а откладываются ключом-карантином;
 * — отказ хранилища (переполнение, приватный режим) не молчит: save()
 *   возвращает причину, чтобы игра честно предупредила и предложила
 *   выгрузить сад файлом.
 */

import { parseSave, serializeSave } from './saveFormat';
import { SaveData } from './types';
import { World } from './world';
import { newGrowState, seedGrowWorld } from './grow';
import { PRESET_BY_ID, applyPreset } from './presets';
import { thinLandscape, type ThinningGroup } from './landscapeDensity';

const INDEX_KEY = 'usadba.gardens.v1';
const SLOT_PREFIX = 'usadba.garden.';
/** Ключ старого одиночного сохранения — переносим его в первый слот. */
const LEGACY_KEY = 'usadba.save.v3';
/** Суффиксы ключей слота: временная запись, резервная копия, карантин. */
const TMP = '.tmp';
const BAK = '.bak';
const BROKEN = '.broken';
/** Unlike .bak, autosaves never overwrite the snapshot from before a thinning pass. */
const BEFORE_THINNING = '.before-thinning';

/** Результат записи: ладно — или причина отказа. */
export type SaveResult = { ok: true } | { ok: false; reason: 'quota' | 'error' };

export type LandscapeLoadNotice =
  | { kind: 'thinned'; gardenId: string; before: number; after: number; removed: number; groups: ThinningGroup[] }
  | { kind: 'skipped'; gardenId: string; candidates: number; reason: 'quota' | 'error' };

export interface GardenMeta {
  id: string;
  name: string;
  /** Когда последний раз сохраняли. */
  saved: number;
  /** Сколько предметов — чтобы показать «пустой сад» или «142 предмета». */
  objects: number;
}

export interface GardenCreateOptions {
  mode?: 'free' | 'grow';
  preset?: string;
  seed?: number;
  /** The start screen has no current garden: never save its placeholder over a real slot. */
  saveCurrent?: boolean;
}

interface GardenIndex {
  active: string;
  list: GardenMeta[];
}

function slotKey(id: string): string {
  return SLOT_PREFIX + id;
}

function newId(): string {
  return Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
}

/** Разобрать строку сохранения, не роняя ничего: null значит «битые данные». */
function tryParse(raw: string): SaveData | null {
  try {
    return parseSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

function isQuota(e: unknown): boolean {
  const name = (e as { name?: unknown })?.name;
  return typeof name === 'string' && /quota/i.test(name);
}

export class GardenStore {
  private index: GardenIndex = { active: '', list: [] };
  /**
   * Признак, что слот был, но не прочитался даже из копий. Игра показывает
   * предупреждение; данные при этом уже отложены карантином, не удалены.
   */
  lastLoadFailed = false;
  /** Transient result of this load, not an event/milestone and never part of a garden save. */
  lastThinning: LandscapeLoadNotice | null = null;

  constructor(options: { deferEmpty?: boolean } = {}) {
    this.loadIndex(options.deferEmpty ?? false);
  }

  private loadIndex(deferEmpty: boolean): void {
    try {
      const raw = localStorage.getItem(INDEX_KEY);
      if (raw) {
        const d = JSON.parse(raw) as GardenIndex;
        if (d && Array.isArray(d.list)) {
          this.index = d;
          if (this.index.list.length) return;
        }
      }
    } catch {
      /* тишина */
    }
    this.bootstrap(deferEmpty);
  }

  /** Первый запуск или пустой указатель: заводим слот, подобрав старое сохранение. */
  private bootstrap(deferEmpty: boolean): void {
    let legacy: string | null = null;
    try {
      legacy = localStorage.getItem(LEGACY_KEY);
    } catch {
      /* private storage */
    }
    // A new visitor explicitly creates their first garden. Existing single-slot saves still migrate.
    if (deferEmpty && !legacy) return;
    const id = newId();
    const objects = legacy ? (tryParse(legacy)?.objects.length ?? 0) : 0;
    if (legacy) {
      try {
        localStorage.setItem(slotKey(id), legacy);
      } catch {
        /* keep the original legacy key */
      }
    }
    this.index = { active: id, list: [{ id, name: 'Усадьба', saved: Date.now(), objects }] };
    this.saveIndex();
  }

  private saveIndex(): void {
    try {
      localStorage.setItem(INDEX_KEY, JSON.stringify(this.index));
    } catch {
      /* указатель не лёг — сады в слотах всё равно уцелеют */
    }
  }

  private removeQuiet(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* тишина */
    }
  }

  get list(): GardenMeta[] {
    return this.index.list;
  }

  get activeId(): string {
    return this.index.active;
  }

  get active(): GardenMeta | undefined {
    return this.index.list.find((g) => g.id === this.index.active);
  }

  private meta(id: string): GardenMeta | undefined {
    return this.index.list.find((g) => g.id === id);
  }

  /**
   * Записать текущий мир в активный слот. Запись атомарная: сначала
   * временный ключ, потом подмена основного, затем прежнее состояние
   * уходит в резервную копию. При отказе хранилища возвращается причина.
   */
  save(world: World): SaveResult {
    const id = this.index.active;
    if (!id) return { ok: true };
    let payload: string;
    try {
      payload = serializeSave(world.toJSON());
    } catch {
      return { ok: false, reason: 'error' };
    }
    return this.writeSlot(id, payload, world.objects.length);
  }

  /** Also used by the loader: the chosen slot need not be the current/active one yet. */
  private writeSlot(id: string, payload: string, objects: number, recovered?: string): SaveResult {
    const main = slotKey(id);
    let old: string | null = recovered ?? null;
    try {
      if (recovered === undefined) old = localStorage.getItem(main);
    } catch {
      /* прочитать прежнее не смогли — записи не помеха */
    }
    try {
      localStorage.setItem(main + TMP, payload);
      localStorage.setItem(main, payload);
    } catch (e) {
      this.removeQuiet(main + TMP);
      return { ok: false, reason: isQuota(e) ? 'quota' : 'error' };
    }
    try {
      if (old && old !== payload) localStorage.setItem(main + BAK, old);
    } catch {
      /* копия не легла — основа на месте, переживём */
    }
    this.removeQuiet(main + TMP);
    const m = this.meta(id);
    if (m) {
      m.saved = Date.now();
      m.objects = objects;
    }
    this.saveIndex();
    return { ok: true };
  }

  /**
   * Прочитать слот в мир. Основной ключ побит — берём резервную копию
   * или временную запись и чиним основу заодно. Совсем битый слот
   * откладывается карантином, а мир остаётся как был.
   */
  load(world: World, id = this.index.active): boolean {
    this.lastThinning = null;
    const main = slotKey(id);
    for (const key of [main, main + BAK, main + TMP, main + BEFORE_THINNING]) {
      let raw: string | null;
      try {
        raw = localStorage.getItem(key);
      } catch {
        continue;
      }
      if (!raw) continue;
      const parsed = tryParse(raw);
      if (!parsed) continue;
      const prepared = this.prepareLoaded(id, parsed, raw);
      world.applySave(prepared);
      if (key !== main && prepared === parsed) {
        // Восстановились из копии — вернём её на основное место
        try {
          localStorage.setItem(main, raw);
          localStorage.removeItem(main + TMP);
        } catch {
          /* тишина */
        }
      }
      this.lastLoadFailed = false;
      return true;
    }
    this.lastLoadFailed = this.quarantine(main);
    return false;
  }

  /** Thinning happens only here, after validation and before any agents/render caches see the objects. */
  private prepareLoaded(id: string, parsed: SaveData, raw: string): SaveData {
    const plan = thinLandscape(parsed);
    if (!plan.removed) return parsed;
    const prepared = { ...parsed, objects: plan.objects };
    let payload: string;
    try {
      payload = serializeSave(prepared);
      // Backup first. If it cannot be written, do not remove anything even in the live world.
      localStorage.setItem(slotKey(id) + BEFORE_THINNING, raw);
    } catch (e) {
      this.lastThinning = {
        kind: 'skipped',
        gardenId: id,
        candidates: plan.removed,
        reason: isQuota(e) ? 'quota' : 'error',
      };
      return parsed;
    }
    const result = this.writeSlot(id, payload, prepared.objects.length, raw);
    if (!result.ok) {
      this.lastThinning = { kind: 'skipped', gardenId: id, candidates: plan.removed, reason: result.reason };
      return parsed;
    }
    this.lastThinning = {
      kind: 'thinned',
      gardenId: id,
      before: parsed.objects.length,
      after: prepared.objects.length,
      removed: plan.removed,
      groups: plan.groups,
    };
    return prepared;
  }

  /** Read on demand by the open gardens panel, never while building the metadata-only start menu. */
  hasThinningBackup(id = this.activeId): boolean {
    try {
      return localStorage.getItem(slotKey(id) + BEFORE_THINNING) !== null;
    } catch {
      return false;
    }
  }

  exportThinningBackup(id = this.activeId): boolean {
    try {
      const raw = localStorage.getItem(slotKey(id) + BEFORE_THINNING);
      if (!raw || !tryParse(raw)) return false;
      this.download(`${this.meta(id)?.name ?? 'Усадьба'} — до прореживания`, JSON.parse(raw));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Убрать битые данные с дороги, не выбрасывая: собрать все остатки
   * слота в один ключ-карантин. Сначала копия, потом уборка — если
   * хранилище полно, всё остаётся лежать где лежало.
   */
  private quarantine(main: string): boolean {
    try {
      const parts: Record<string, string> = {};
      let found = false;
      for (const k of [main, main + BAK, main + TMP, main + BEFORE_THINNING]) {
        const raw = localStorage.getItem(k);
        if (raw) {
          parts[k.slice(main.length)] = raw;
          found = true;
        }
      }
      if (!found) return false;
      localStorage.setItem(main + BROKEN, JSON.stringify({ at: Date.now(), parts }));
      for (const k of [main, main + BAK, main + TMP, main + BEFORE_THINNING]) localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }

  /** Enter from the chooser, including the last active slot, without saving a placeholder world. */
  open(world: World, id: string): boolean {
    if (!this.meta(id) || !this.load(world, id)) return false;
    this.index.active = id;
    this.saveIndex();
    return true;
  }

  /** Переключиться на другую усадьбу, сохранив текущую. */
  switchTo(world: World, id: string): boolean {
    if (id === this.index.active) return false;
    if (!this.meta(id)) return false;
    const from = this.index.active;
    this.save(world);
    this.index.active = id;
    if (!this.load(world, id)) {
      // Открыть не вышло — остаёмся в текущем саду, мир не тронут
      this.index.active = from;
      this.saveIndex();
      return false;
    }
    this.saveIndex();
    return true;
  }

  /** Завести новую усадьбу и сразу перейти в неё. */
  create(world: World, name?: string, opts?: GardenCreateOptions): GardenMeta {
    this.lastThinning = null;
    if (opts?.saveCurrent !== false) this.save(world);
    const id = newId();
    const m: GardenMeta = {
      id,
      name: name || this.suggestName(opts?.mode, opts?.preset),
      saved: Date.now(),
      objects: 0,
    };
    this.index.list.push(m);
    this.index.active = id;

    if (opts?.mode === 'grow') {
      const seed = opts.seed ?? Math.floor(Math.random() * 1_000_000_000);
      world.reset();
      seedGrowWorld(world, seed);
      world.grow = newGrowState(seed, Date.now());
      world.initUnlocks(false);
    } else if (opts?.preset) {
      world.reset();
      applyPreset(world, opts.preset);
    } else {
      world.reset();
    }

    this.save(world);
    this.saveIndex();
    return m;
  }

  private suggestName(mode?: 'free' | 'grow', preset?: string): string {
    if (mode === 'grow') {
      const base = 'Растущий сад';
      if (!this.index.list.some((g) => g.name === base)) return base;
      let n = 2;
      while (this.index.list.some((g) => g.name === `${base} ${n}`)) n++;
      return `${base} ${n}`;
    }
    if (preset) {
      const p = PRESET_BY_ID.get(preset);
      if (p) {
        if (!this.index.list.some((g) => g.name === p.name)) return p.name;
        let n = 2;
        while (this.index.list.some((g) => g.name === `${p.name} ${n}`)) n++;
        return `${p.name} ${n}`;
      }
    }
    if (!this.index.list.length) return 'Усадьба';
    const poetic = ['Второй сад', 'Дальний двор', 'Северный склон', 'Тихая заводь', '新しい庭'];
    for (const n of poetic) if (!this.index.list.some((g) => g.name === n)) return n;
    return `Усадьба ${this.index.list.length + 1}`;
  }

  rename(id: string, name: string): void {
    const m = this.meta(id);
    if (!m) return;
    m.name = name.trim().slice(0, 40) || m.name;
    this.saveIndex();
  }

  /** Удалить усадьбу со всеми копиями. Если это последняя — заводится новая чистая. */
  remove(world: World, id: string): boolean {
    const i = this.index.list.findIndex((g) => g.id === id);
    if (i < 0) return false;
    const wasLast = this.index.list.length <= 1;
    this.index.list.splice(i, 1);
    const main = slotKey(id);
    this.removeQuiet(main);
    this.removeQuiet(main + TMP);
    this.removeQuiet(main + BAK);
    this.removeQuiet(main + BROKEN);
    this.removeQuiet(main + BEFORE_THINNING);
    if (this.lastThinning?.gardenId === id) this.lastThinning = null;
    if (wasLast) {
      // последнюю удалили — заводим новую усадьбу, чтобы не остаться без сада
      const nid = newId();
      const nm: GardenMeta = { id: nid, name: 'Усадьба', saved: Date.now(), objects: 0 };
      this.index.list.push(nm);
      this.index.active = nid;
      world.reset();
      this.save(world);
      this.saveIndex();
      return true;
    }
    if (this.index.active === id) {
      this.index.active = this.index.list[Math.min(i, this.index.list.length - 1)].id;
      if (!this.load(world, this.index.active)) world.reset();
    }
    this.saveIndex();
    return true;
  }

  /** Выгрузить активную усадьбу файлом в том же компактном виде, что и слоты. */
  exportFile(world: World): void {
    this.download(this.active?.name ?? 'усадьба', JSON.parse(serializeSave(world.toJSON())) as unknown);
  }

  private download(name: string, data: unknown): void {
    const payload = { kind: 'usadba-garden', name, exported: Date.now(), data };
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/[^\p{L}\p{N}\s-]/gu, '') || 'усадьба'}.сад.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** Принять файл: всегда создаёт новую усадьбу, ничего не затирая. */
  async importFile(world: World, file: File): Promise<string | null> {
    try {
      const text = await file.text();
      const raw = JSON.parse(text) as { kind?: string; name?: string; data?: unknown };
      const parsed = parseSave(raw?.data ?? raw);
      if (!parsed) return null;

      this.lastThinning = null;
      this.save(world);
      const id = newId();
      const base = typeof raw?.name === 'string' ? raw.name : file.name.replace(/\.(сад\.)?json$/i, '');
      const m: GardenMeta = {
        id,
        name: base.slice(0, 40) || 'Принятый сад',
        saved: Date.now(),
        objects: parsed.objects.length,
      };
      this.index.list.push(m);
      this.index.active = id;
      const original = raw?.data !== undefined ? JSON.stringify(raw.data) : text;
      world.applySave(this.prepareLoaded(id, parsed, original));
      this.save(world);
      this.saveIndex();
      return m.name;
    } catch {
      return null;
    }
  }
}
