import { newGrowClock, type GrowClockState } from '../core/growClock';
/**
 * Растущий сад: режим ограниченных действий.
 *
 * Вольный сад остаётся вольным, а растущий начинается с клочка 2×2
 * посреди неоткрытого листа. Действие приходит раз в десять настоящих
 * минут и тратится на посадку, постройку, терраформ и перенос. Снос
 * бесплатен: ошибиться можно, расплачиваться за это не нужно.
 *
 * Расширение — награда за деятельность, а не покупка: совершил одно
 * действие — сад предлагает вырасти вдвое вдоль одной из сторон
 * (четыре зоны-кандидата, туман приподнимается, видно, что там:
 * вода, грива, роща). Пороги: 1, 1, 2, 3, 4, 5, 6… действий
 * после предыдущего расширения. Первые два расширения — по одному действию.
 *
 * Содержимое зон не придумывается в момент выбора: весь лист заранее
 * рождён процедурно — вода, холмы, рощи, — поэтому новая земля всегда
 * согласована с границами сада: пруд продолжается заводью, роща —
 * опушкой. Построек и троп в дикой земле нет.
 */

import { GRID } from '../core/iso';
import { makeRng } from '../core/rng';
import { ITEM_BY_ID } from './catalog';
import { World } from './world';

export interface GrowRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GrowState {
  /** Independent seasonal/solar clock. Missing in legacy saves until migrated. */
  clock?: GrowClockState;
  rect: GrowRect;
  /** Зерно рождения дикой земли: лист один на всю усадьбу. */
  seed: number;
  /** Накопленные действия, не потраченные. */
  bank: number;
  /** Метка последнего начисления, мс реального времени. */
  tick: number;
  /** Совершено действий с последнего расширения. */
  progress: number;
  /** Сколько расширений было: порог следующего = max(1, stage). */
  stage: number;
  /** Игрок сейчас выбирает зону: туман приподнят над кандидатами. */
  choosing: boolean;
}

/** Действие приходит раз в десять настоящих минут. */
export const GROW_ACTION_MS = 10 * 60 * 1000;
/** Запас не растёт бесконечно: три действия впрок — полчаса отсутствия. */
export const GROW_BANK_CAP = 3;
/** Семь расширений: 2×2 → 4×2 → 4×4 → 8×4 → 8×8 → 16×8 → 16×16 → (32×16/16×32, если влезет). */
export const GROW_MAX_STAGE = 7;

/**
 * Действия после предыдущего расширения: 1, 1, 2, 3, 4, 5, 6, 7, 8…
 * Ступени нумеруются с нуля; после двух лёгких расширений порог растёт на один.
 * Формула продолжает ряд и за пределами текущего числа расширений.
 */
export function growThreshold(stage: number): number {
  const n = Number.isFinite(stage) ? Math.max(0, Math.floor(stage)) : 0;
  return Math.max(1, n);
}

/** Расширение доступно: порог достигнут, лист ещё не вырос весь и есть куда расти. */
export function growOfferReady(g: GrowState): boolean {
  if (g.stage >= GROW_MAX_STAGE) return false;
  if (g.progress < growThreshold(g.stage)) return false;
  // Если сад уже упёрся в края листа (например 16×16 в GRID 26 и 7-я стадия 32),
  // зон нет — предложение не показываем, иначе «куда расти?» без подсветки.
  return growZones(g.rect).length > 0;
}

/**
 * Четыре зоны-кандидата: приставка того же размера вдоль каждой стороны,
 * удваивающая сад. Что не помещается в лист — не предлагается.
 * Дополнительно не даём слишком вытянутых прямоугольников: сад должен
 * оставаться примерно квадратным, иначе 8×2 или 16×4 — это уже коридор.
 */
export function growZones(r: GrowRect): GrowRect[] {
  const raw: GrowRect[] = [];
  const { x, y, w, h } = r;
  if (y - h >= 0) raw.push({ x, y: y - h, w, h });
  if (y + h + h <= GRID) raw.push({ x, y: y + h, w, h });
  if (x - w >= 0) raw.push({ x: x - w, y, w, h });
  if (x + w + w <= GRID) raw.push({ x: x + w, y, w, h });

  // Фильтр «слишком длинный»: после слияния соотношение сторон >2.2 — коридор.
  const out: GrowRect[] = [];
  for (const zone of raw) {
    const nx = Math.min(r.x, zone.x);
    const ny = Math.min(r.y, zone.y);
    const nx1 = Math.max(r.x + r.w, zone.x + zone.w);
    const ny1 = Math.max(r.y + r.h, zone.y + zone.h);
    const nw = nx1 - nx;
    const nh = ny1 - ny;
    const ratio = Math.max(nw, nh) / Math.max(1, Math.min(nw, nh));
    if (ratio > 2.2) continue;
    out.push(zone);
  }
  // Если фильтр съел всё (на краю листа осталась только длинная полоса),
  // возвращаем исходные — лучше дать хоть что-то, чем запереть рост.
  return out.length ? out : raw;
}

export function inGrowRect(r: GrowRect, tx: number, ty: number): boolean {
  return tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h;
}

/** Начислить действия за прошедшее настоящее время, с потолком запаса. */
export function growTick(g: GrowState, now: number): number {
  if (now <= g.tick) return 0;
  const gained = Math.floor((now - g.tick) / GROW_ACTION_MS);
  if (gained <= 0) return 0;
  g.tick += gained * GROW_ACTION_MS;
  g.bank = Math.min(GROW_BANK_CAP, g.bank + gained);
  return gained;
}

/** Свежее состояние растущего сада: клочок 2×2 посреди листа. */
export function newGrowState(seed: number, now: number): GrowState {
  const c = Math.floor((GRID - 2) / 2);
  return {
    rect: { x: c, y: c, w: 2, h: 2 },
    seed,
    clock: newGrowClock(now),
    // Первые три действия даром: иначе первые двадцать минут нечего делать
    bank: 3,
    tick: now,
    progress: 0,
    stage: 0,
    choosing: false,
  };
}

/**
 * Дикая земля растущего сада: весь лист рождён заранее, открыт лишь
 * клочок. Вода, холмы, рощи и береговая растительность — без построек,
 * троп и животных: их приведут постройки игрока.
 */
export function seedGrowWorld(world: World, seed: number): void {
  const rnd = makeRng(seed);

  for (const t of world.tiles) {
    t.ground = 'moss';
    t.level = 0;
    t.water = false;
    t.indoor = false;
    t.veranda = false;
  }
  world.objects = [];

  const blob = (cx: number, cy: number, r: number, fn: (x: number, y: number, k: number) => void): void => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue;
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
        const k = 1 - d + (rnd() - 0.5) * 0.35;
        if (k > 0) fn(x, y, k);
      }
    }
  };

  // Луга и галька: пятна поверх мха
  for (let i = 0; i < 5; i++) {
    blob(2 + rnd() * (GRID - 4), 2 + rnd() * (GRID - 4), 2 + rnd() * 3, (x, y) => {
      world.tiles[y * GRID + x].ground = 'grass';
    });
  }
  for (let i = 0; i < 3; i++) {
    blob(2 + rnd() * (GRID - 4), 2 + rnd() * (GRID - 4), 1.5 + rnd() * 2, (x, y) => {
      world.tiles[y * GRID + x].ground = 'gravel';
    });
  }

  // Холмы по краям листа: центр оставляем ровным под первый клочок
  for (let i = 0; i < 3; i++) {
    const edge = Math.floor(rnd() * 4);
    const cx = edge === 0 ? 3 + rnd() * 4 : edge === 1 ? GRID - 4 - rnd() * 4 : 3 + rnd() * (GRID - 6);
    const cy = edge === 2 ? 3 + rnd() * 4 : edge === 3 ? GRID - 4 - rnd() * 4 : 3 + rnd() * (GRID - 6);
    blob(cx, cy, 2 + rnd() * 2.5, (x, y) => {
      world.tiles[y * GRID + x].level = 1;
    });
  }

  // Водоёмы: один-два, с песчаной кромкой
  const ponds: { cx: number; cy: number; r: number }[] = [];
  const pondCount = 1 + (rnd() < 0.6 ? 1 : 0);
  for (let i = 0; i < pondCount; i++) {
    const cx = 4 + rnd() * (GRID - 8);
    const cy = 4 + rnd() * (GRID - 8);
    const r = 2 + rnd() * 2.2;
    ponds.push({ cx, cy, r });
    blob(cx, cy, r, (x, y) => {
      world.tiles[y * GRID + x].water = true;
      world.tiles[y * GRID + x].level = 0;
    });
    blob(cx, cy, r + 1.2, (x, y, k) => {
      const t = world.tiles[y * GRID + x];
      if (!t.water && k < 0.45) t.ground = 'sand';
    });
  }

  // Первый клочок игрока: ровный сухой мох без воды и деревьев
  const c = Math.floor((GRID - 2) / 2);
  for (let y = c - 1; y <= c + 2; y++) {
    for (let x = c - 1; x <= c + 2; x++) {
      if (x < 0 || y < 0 || x >= GRID || y >= GRID) continue;
      const t = world.tiles[y * GRID + x];
      t.water = false;
      t.level = 0;
      t.ground = 'moss';
    }
  }

  world.noteObjectsChanged();

  // Рощи: сгустки деревьев подальше от первого клочка
  const old = Date.now() - 86400_000 * 40;
  const treeIds = ['maple', 'pine', 'sakura', 'ginkgo'];
  for (let i = 0; i < 5; i++) {
    const cx = 2 + rnd() * (GRID - 4);
    const cy = 2 + rnd() * (GRID - 4);
    if (Math.hypot(cx - c, cy - c) < 4) continue;
    const n = 3 + Math.floor(rnd() * 5);
    for (let k = 0; k < n; k++) {
      const x = Math.round(cx + (rnd() - 0.5) * 4);
      const y = Math.round(cy + (rnd() - 0.5) * 4);
      if (x < 1 || y < 1 || x >= GRID - 1 || y >= GRID - 1) continue;
      const t = world.at(x, y);
      if (!t || t.water || t.level > 0) continue;
      if (world.objects.some((o) => Math.hypot(o.tx - x, o.ty - y) < 1.4)) continue;
      world.place(treeIds[Math.floor(rnd() * treeIds.length)], x, y, 0, old);
    }
  }

  // Берега: камыш и ирисы у воды, папоротник и цветы по лугам
  for (const p of ponds) {
    for (let a = 0; a < 10; a++) {
      const ang = rnd() * Math.PI * 2;
      const x = Math.round(p.cx + Math.cos(ang) * (p.r + 0.6));
      const y = Math.round(p.cy + Math.sin(ang) * (p.r + 0.6));
      const t = world.at(x, y);
      if (!t || t.water || t.indoor) continue;
      world.place(rnd() < 0.6 ? 'reed' : 'iris', x, y, 0, old);
    }
    for (let a = 0; a < 4; a++) {
      const ang = rnd() * Math.PI * 2;
      const x = Math.round(p.cx + Math.cos(ang) * (p.r * 0.5));
      const y = Math.round(p.cy + Math.sin(ang) * (p.r * 0.5));
      const t = world.at(x, y);
      if (!t || !t.water) continue;
      world.place(rnd() < 0.5 ? 'lilypad' : 'lily', x, y, 0, old);
    }
  }
  for (let i = 0; i < 14; i++) {
    const x = 1 + Math.floor(rnd() * (GRID - 2));
    const y = 1 + Math.floor(rnd() * (GRID - 2));
    const t = world.at(x, y);
    if (!t || t.water || t.level > 0) continue;
    if (Math.abs(x - c) < 2 && Math.abs(y - c) < 2) continue;
    if (world.objects.some((o) => Math.hypot(o.tx - x, o.ty - y) < 1)) continue;
    world.place(t.ground === 'grass' ? (rnd() < 0.5 ? 'grass_tuft' : 'azalea') : 'moss_clump', x, y, 0, old);
  }

  // Стартовый клочок 2×2 — чистая бумага: чужие кроны и кусты не нависают
  world.objects = world.objects.filter((o) => {
    const it = ITEM_BY_ID.get(o.type);
    const w = it?.w ?? 1;
    const h = it?.h ?? 1;
    return o.tx + w <= c || o.tx >= c + 2 || o.ty + h <= c || o.ty >= c + 2;
  });

  world.noteObjectsChanged();
}
