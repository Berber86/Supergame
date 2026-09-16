/**
 * Несколько усадеб в одном браузере: список, переключение, файл на диск.
 *
 * Слоты живут отдельными ключами localStorage, а рядом лежит лёгкий
 * указатель со списком имён и датами — чтобы показать выбор, не разбирая
 * каждое сохранение целиком.
 */

import { SaveData } from './types';
import { World } from './world';

const INDEX_KEY = 'usadba.gardens.v1';
const SLOT_PREFIX = 'usadba.garden.';
/** Ключ старого одиночного сохранения — переносим его в первый слот. */
const LEGACY_KEY = 'usadba.save.v3';

export interface GardenMeta {
  id: string;
  name: string;
  /** Когда последний раз сохраняли. */
  saved: number;
  /** Сколько предметов — чтобы показать «пустой сад» или «142 предмета». */
  objects: number;
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

export class GardenStore {
  private index: GardenIndex = { active: '', list: [] };

  constructor() {
    this.loadIndex();
  }

  private loadIndex(): void {
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
    this.bootstrap();
  }

  /** Первый запуск или пустой указатель: заводим слот, подобрав старое сохранение. */
  private bootstrap(): void {
    const id = newId();
    let objects = 0;
    try {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        localStorage.setItem(slotKey(id), legacy);
        const d = JSON.parse(legacy) as SaveData;
        objects = d.objects?.length ?? 0;
      }
    } catch {
      /* тишина */
    }
    this.index = { active: id, list: [{ id, name: 'Усадьба', saved: Date.now(), objects }] };
    this.saveIndex();
  }

  private saveIndex(): void {
    try {
      localStorage.setItem(INDEX_KEY, JSON.stringify(this.index));
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

  /** Записать текущий мир в активный слот. */
  save(world: World): void {
    const id = this.index.active;
    if (!id) return;
    try {
      localStorage.setItem(slotKey(id), JSON.stringify(world.toJSON()));
      const m = this.meta(id);
      if (m) {
        m.saved = Date.now();
        m.objects = world.objects.length;
      }
      this.saveIndex();
    } catch {
      /* тишина */
    }
  }

  /** Прочитать слот в мир. */
  load(world: World, id = this.index.active): boolean {
    try {
      const raw = localStorage.getItem(slotKey(id));
      if (!raw) return false;
      return world.fromJSON(JSON.parse(raw) as SaveData);
    } catch {
      return false;
    }
  }

  /** Переключиться на другую усадьбу, сохранив текущую. */
  switchTo(world: World, id: string): boolean {
    if (id === this.index.active) return false;
    if (!this.meta(id)) return false;
    this.save(world);
    this.index.active = id;
    this.saveIndex();
    if (!this.load(world, id)) {
      world.reset();
      this.save(world);
    }
    return true;
  }

  /** Завести новую пустую усадьбу и сразу перейти в неё. */
  create(world: World, name?: string): GardenMeta {
    this.save(world);
    const id = newId();
    const m: GardenMeta = {
      id,
      name: name || this.suggestName(),
      saved: Date.now(),
      objects: 0,
    };
    this.index.list.push(m);
    this.index.active = id;
    world.reset();
    this.save(world);
    this.saveIndex();
    return m;
  }

  private suggestName(): string {
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

  /** Удалить усадьбу. Последнюю удалить нельзя — иначе некуда возвращаться. */
  remove(world: World, id: string): boolean {
    if (this.index.list.length <= 1) return false;
    const i = this.index.list.findIndex((g) => g.id === id);
    if (i < 0) return false;
    this.index.list.splice(i, 1);
    try {
      localStorage.removeItem(slotKey(id));
    } catch {
      /* тишина */
    }
    if (this.index.active === id) {
      this.index.active = this.index.list[Math.min(i, this.index.list.length - 1)].id;
      if (!this.load(world, this.index.active)) world.reset();
    }
    this.saveIndex();
    return true;
  }

  /** Выгрузить активную усадьбу файлом. */
  exportFile(world: World): void {
    const name = this.active?.name ?? 'усадьба';
    const payload = { kind: 'usadba-garden', name, exported: Date.now(), data: world.toJSON() };
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/[^\p{L}\p{N}\s-]/gu, '')||'усадьба'}.сад.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** Принять файл: всегда создаёт новую усадьбу, ничего не затирая. */
  async importFile(world: World, file: File): Promise<string | null> {
    try {
      const text = await file.text();
      const raw = JSON.parse(text) as { kind?: string; name?: string; data?: SaveData } | SaveData;
      const data = (raw as { data?: SaveData }).data ?? (raw as SaveData);
      if (!data || !Array.isArray(data.tiles)) return null;

      this.save(world);
      const id = newId();
      const base = (raw as { name?: string }).name ?? file.name.replace(/\.(сад\.)?json$/i, '');
      const m: GardenMeta = { id, name: base.slice(0, 40) || 'Принятый сад', saved: Date.now(), objects: 0 };
      this.index.list.push(m);
      this.index.active = id;
      if (!world.fromJSON(data)) {
        // файл не подошёл — откатываем создание слота
        this.index.list.pop();
        this.index.active = this.index.list[this.index.list.length - 1].id;
        this.load(world);
        return null;
      }
      this.save(world);
      return m.name;
    } catch {
      return null;
    }
  }
}
