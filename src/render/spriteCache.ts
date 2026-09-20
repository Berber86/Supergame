import { crownCacheKey, crownCacheTime } from '../world/phenology';
/**
 * Кэш готовых спрайтов.
 *
 * Дерево — это два десятка акварельных мазков: размывы кроны, зернистость,
 * лепестки, снег на ветках. Замер показал 638 мкс на дерево, и 29 деревьев
 * стартового сада съедали 18.5 мс из 29.8 мс кадра — больше половины.
 * При этом от кадра к кадру дерево меняется только покачиванием на ветру.
 *
 * Поэтому рисуем его один раз в отдельный холст и дальше копируем, а ветер
 * добавляем сдвигом при копировании. Глаз разницы не замечает: качается
 * крона целиком, как и раньше.
 *
 * Что входит в ключ кэша — всё, от чего картинка правда зависит:
 * тип, сезон, стадия роста (огрублённая), освещение (огрублённое),
 * азимут солнца и золотой час (грубыми корзинами — светлая и теневая
 * стороны кроны выпекаются в спрайт), сид.
 * Ветер и время покачивания в ключ не входят — они применяются при копировании.
 * Годовое развитие кроны входит отдельной ограниченной ревизией (примерно 17 часов).
 */

import { DrawCtx, drawObject, drawCost, hasDrawer, setSkipShadows } from './sprites';
import { Ctx } from './paint';
import { flowerCycleKey } from './flowerCycle';
import { css } from '../world/palette';
import { ITEM_BY_ID, SMALL_HOUSE_IDS } from '../world/catalog';
import { roofSnowKey } from './roofSnow';

interface Entry {
  canvas: HTMLCanvasElement;
  /** Где внутри холста находится точка опоры объекта. */
  ax: number;
  ay: number;
  /** Последний кадр, когда спрайт пригодился, — для вытеснения. */
  used: number;
}

const cache = new Map<string, Entry>();
/** Жёсткий предел: прошедшие годовые ревизии вытесняются, архив крон не накапливается. */
const LIMIT = 420;
let frame = 0;
let hits = 0;
let misses = 0;

/** Типы, которые нельзя кэшировать: у них своя анимация внутри. */
const LIVE = new Set([
  'cat',
  'koi',
  'lantern_stone',
  'lantern_paper',
  'lantern_path',
  'brazier',
  'irori',
  'shishi',
  'wind_chime',
  'water_stone',
  'tsukubai',
  'table',
]);

/** Огрубление вниз: значение никогда не становится больше исходного. */
function quantDown(v: number, step: number): number {
  return Math.floor(v / step) * step;
}

/**
 * Стадия роста, огрублённая так же, как в ключе кэша.
 *
 * Тень должна рисоваться по тому же размеру, что и спрайт: иначе дерево
 * из кэша (шаг 0.08) получает тень от точного g, и они не сходятся.
 */
export function cachedGrowth(g: number): number {
  const q = Math.min(1, quantDown(g, 0.04));
  return q <= 0 ? 0.02 : q;
}

/**
 * Можно ли рисовать этот объект из кэша.
 *
 * Мелочь вроде мха дешевле нарисовать заново, чем копировать: у неё
 * несколько мазков, а копирование холста тоже не бесплатно.
 */
export function cacheable(type: string, cost: number): boolean {
  return !LIVE.has(type) && hasDrawer(type) && cost > 120;
}

export function spriteStats(): { size: number; boxes: number; hits: number; misses: number; pixels: number } {
  let pixels = 0;
  for (const entry of cache.values()) pixels += entry.canvas.width * entry.canvas.height;
  return { size: cache.size, boxes: boxes.size, hits, misses, pixels };
}

function releaseSprite(entry: Entry): void {
  // Drop retired backing pixels immediately; rapid calendar scrubbing must not wait for canvas GC.
  entry.canvas.width = 1;
  entry.canvas.height = 1;
}

export function clearSprites(): void {
  for (const entry of cache.values()) releaseSprite(entry);
  cache.clear();
  boxes.clear();
  hits = 0;
  misses = 0;
}

/** Новый кадр — для учёта давности. */
export function spriteFrame(): void {
  frame++;
}

/**
 * Рисует объект через кэш. Возвращает false, если кэш не подошёл
 * и объект надо рисовать обычным способом.
 */
function getCachedSprite(d: DrawCtx, relit = false): Entry | null {
  const { obj, atm } = d;

  // Огрубление ключа: без него кэш промахивался бы каждый кадр, потому
  // что рост и освещение меняются непрерывно. Но огрублять надо вниз,
  // а не к ближайшему: округление вверх делало взрослое дерево (g=1)
  // на 4% крупнее настоящего — заметное расхождение по всей кроне.
  const gq = Math.min(1, quantDown(d.g, 0.04));
  const expq = quantDown(atm.exposure, 0.04);
  const lampq = quantDown(atm.lampGlow, 0.15);
  // Светлая и теневая стороны кроны выпекаются в спрайт, поэтому азимут
  // солнца и сила золотого часа тоже входят в ключ. Корзины грубые:
  // перебация случается считаные разы за сутки, а не каждый кадр.
  const sunq = quantDown(atm.sunDir.x, 0.4);
  const goldq = quantDown(atm.golden, 0.34);
  const snowKey = SMALL_HOUSE_IDS.has(obj.type) ? roofSnowKey(atm, obj.seed) : '';
  const key = `${crownCacheKey(obj.type, obj.seed, atm.time.now)}|${Math.round((atm.materialWetness ?? 0) * 12)}|${flowerCycleKey(obj.type, atm)}|${relit ? 'lit' : 'base'}|${snowKey}|${obj.type}|${atm.season}|${gq}|${expq}|${lampq}|${sunq}|${goldq}|${obj.seed}|${obj.rot}`;

  let e = cache.get(key);
  if (!e) {
    // Размер поля берём замером, а не оценкой по типу.
    //
    // Сначала я прикидывал высоту формулой от objectHeight — и кроны
    // обрезались: спрайт оказывался меньше настоящего рисунка.
    // Теперь один раз меряем, куда объект дотягивается на самом деле.
    const annualNow = crownCacheTime(obj.type, obj.seed, atm.time.now);
    const bakeAtm = annualNow === atm.time.now ? atm : { ...atm, time: { ...atm.time, now: annualNow } };
    const box = measureBox(obj, bakeAtm, gq);
    if (!box) return null;

    const w = box.w;
    const h = box.h;
    if (w <= 0 || h <= 0 || w > 900 || h > 900) return null;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const cx = canvas.getContext('2d');
    if (!cx) return null;

    // Рисуем без ветра и на нулевом времени: движение добавится при копии
    const ax = box.ax;
    const ay = box.ay;
    cx.translate(ax, ay);
    // Без тени: она рисуется на сцене, где под ней есть земля
    setSkipShadows(true);
    drawObject({
      ctx: cx as unknown as Ctx,
      x: 0,
      y: 0,
      atm: bakeAtm,
      g: gq <= 0 ? 0.02 : gq,
      obj,
      time: 0,
      wind: 0,
      alpha: 1,
    });
    setSkipShadows(false);

    e = { canvas, ax, ay, used: frame };
    cache.set(key, e);
    misses++;
    if (cache.size > LIMIT) evict();
  } else {
    hits++;
  }

  e.used = frame;

  return e;
}

export function drawCached(d: DrawCtx): boolean {
  const e = getCachedSprite(d);
  if (!e) return false;
  drawEntry(d, e);
  return true;
}
function drawEntry(d: DrawCtx, e: Entry): void {
  const ctx = d.ctx as unknown as CanvasRenderingContext2D;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = d.alpha;
  // Кладём по целым пикселям холста, а не по дробным координатам сцены.
  //
  // Спрайт нарисован в своей сетке пикселей; если положить его со сдвигом
  // на пол-пикселя, браузер пересемплирует картинку и по всем кромкам веток
  // появится мыло. Округляем в экранных координатах — с учётом текущего
  // преобразования, иначе при зуме округление не совпадёт с пикселями.
  const m = ctx.getTransform ? ctx.getTransform() : null;
  const dx = d.x - e.ax;
  const dy = d.y - e.ay;
  if (m && m.a !== 0 && m.d !== 0) {
    const sx = m.a * dx + m.c * dy + m.e;
    const sy = m.b * dx + m.d * dy + m.f;
    const rx = Math.round(sx);
    const ry = Math.round(sy);
    ctx.drawImage(e.canvas, dx + (rx - sx) / m.a, dy + (ry - sy) / m.d);
  } else {
    ctx.drawImage(e.canvas, Math.round(dx), Math.round(dy));
  }
  ctx.globalAlpha = prev;
}

/** Shared live pose for the displayed sprite and its reflection; rigid objects never sway. */
export function spriteSway(type: string, seed: number, g: number, time: number, wind: number): number {
  const kind = ITEM_BY_ID.get(type)?.kind;
  if (kind !== 'tree' && kind !== 'shrub' && kind !== 'flower') return 0;
  const scale = 0.18 + 0.82 * Math.pow(cachedGrowth(g), 0.72);
  return Math.sin(time * 0.0004 + seed) * 3 * wind * scale * 0.7;
}

/** The very same painted sprite, mirrored in broken horizontal strips; no shadow. */
export function drawCachedReflection(d: DrawCtx, compression = 0.82, stripSize = 5): void {
  const e = getCachedSprite(d);
  if (!e) return;
  const ctx = d.ctx;
  ctx.save();
  const alpha = ctx.globalAlpha * d.alpha;
  ctx.translate(d.x + spriteSway(d.obj.type, d.obj.seed, d.g, d.time, d.wind), d.y);
  ctx.scale(1, -compression);
  // Only the part above the object's foot reflects. A fragment is 5 world pixels,
  // not a screen-sized offscreen canvas; reused sprites also bound memory.
  const step = Number.isFinite(stripSize) ? Math.max(5, Math.min(24, stripSize)) : 5;
  for (let y = 0; y < e.ay; y += step) {
    const h = Math.min(step, e.ay - y);
    const depth = (e.ay - y) / Math.max(1, e.ay);
    const wave = d.reflectionWarp?.(d.x, d.y + (e.ay - y) * compression);
    const drift = wave?.dx ?? Math.sin(d.time * 0.0013 + y * 0.095 + d.obj.seed) * (0.3 + d.wind * 0.6);
    ctx.globalAlpha = alpha * (0.9 - depth * 0.35) * (wave?.alpha ?? 1);
    ctx.drawImage(
      e.canvas,
      0,
      y,
      e.canvas.width,
      h,
      -e.ax + drift,
      y - e.ay - (wave?.dy ?? 0) / compression,
      e.canvas.width,
      h + 0.12,
    );
  }
  ctx.restore();
}

/**
 * Настоящие границы рисунка относительно точки опоры.
 *
 * Меряется пробным кадром на большом холсте: дешевле один раз замерить,
 * чем всю жизнь угадывать размер и обрезать кроны.
 */
const boxes = new Map<string, { w: number; h: number; ax: number; ay: number } | null>();

/** Failures/empty dormant sprites need the same bound as successful measurements. */
function rememberBox(key: string, box: { w: number; h: number; ax: number; ay: number } | null): void {
  boxes.set(key, box);
  if (boxes.size > 600) boxes.delete(boxes.keys().next().value!);
}

let _probe: HTMLCanvasElement | null = null;
function getProbe(S: number): CanvasRenderingContext2D | null {
  if (!_probe) {
    _probe = document.createElement('canvas');
  }
  if (_probe.width !== S || _probe.height !== S) {
    _probe.width = S;
    _probe.height = S;
  }
  const pc = _probe.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D | null;
  if (!pc) return null;
  pc.setTransform(1, 0, 0, 1, 0, 0);
  pc.clearRect(0, 0, S, S);
  return pc;
}

function measureBox(
  obj: { type: string; seed: number; rot: number; tx: number; ty: number; planted: number; id: number },
  atm: Parameters<typeof drawObject>[0]['atm'],
  gq: number,
): { w: number; h: number; ax: number; ay: number } | null {
  // Размер зависит от сида из-за scaleJitter и зеркала, поэтому включаем seed
  const snowKey = SMALL_HOUSE_IDS.has(obj.type) ? roofSnowKey(atm, obj.seed) : '';
  const key = `${crownCacheKey(obj.type, obj.seed, atm.time.now)}|${flowerCycleKey(obj.type, atm)}|${snowKey}|${obj.type}|${atm.season}|${gq}|${obj.rot}|${obj.seed}`;
  const hit = boxes.get(key);
  if (hit !== undefined) return hit;

  // Уменьшили холст с 520 до 380 — быстрее и меньше памяти,
  // а для самых больших деревьев всё ещё хватает.
  const S = 380;
  const pc = getProbe(S);
  if (!pc) {
    rememberBox(key, null);
    return null;
  }
  // Опора строго в целых пикселях: спрайт потом кладётся по целым
  // координатам, и дробное начало дало бы сдвиг на полпикселя —
  // все кромки веток размылись бы.
  const ox = Math.round(S / 2);
  const oy = Math.round(S * 0.72);
  pc.translate(ox, oy);
  setSkipShadows(true);
  try {
    drawObject({
      ctx: pc as unknown as Ctx,
      x: 0,
      y: 0,
      atm,
      g: gq <= 0 ? 0.02 : gq,
      obj: obj as never,
      time: 0,
      wind: 0,
      alpha: 1,
    });
  } catch (e) {
    console.warn('[spriteCache] measure draw failed', obj.type, e);
    setSkipShadows(false);
    rememberBox(key, null);
    return null;
  }
  setSkipShadows(false);

  let img: ImageData;
  try {
    img = (pc as any).getImageData(0, 0, S, S) as ImageData;
  } catch (e) {
    console.warn('[spriteCache] getImageData failed', e);
    rememberBox(key, null);
    return null;
  }
  const px = img.data;
  let top = S;
  let bottom = -1;
  let left = S;
  let right = -1;

  // Быстрый поиск границ: сверху/снизу/по бокам, с ранним выходом.
  // Полный скан 380*380=144k пикселей, но обычно находим границы за 10-20% проверок.
  for (let y = 0; y < S; y++) {
    const rowOff = y * S * 4;
    for (let x = 0; x < S; x++) {
      if (px[rowOff + x * 4 + 3] > 0) {
        top = y;
        break;
      }
    }
    if (top !== S) break;
  }
  if (top === S) {
    rememberBox(key, null);
    return null;
  }
  for (let y = S - 1; y >= top; y--) {
    const rowOff = y * S * 4;
    for (let x = 0; x < S; x++) {
      if (px[rowOff + x * 4 + 3] > 0) {
        bottom = y;
        break;
      }
    }
    if (bottom !== -1) break;
  }
  for (let x = 0; x < S; x++) {
    for (let y = top; y <= bottom; y++) {
      if (px[(y * S + x) * 4 + 3] > 0) {
        left = x;
        break;
      }
    }
    if (left !== S) break;
  }
  for (let x = S - 1; x >= left; x--) {
    for (let y = top; y <= bottom; y++) {
      if (px[(y * S + x) * 4 + 3] > 0) {
        right = x;
        break;
      }
    }
    if (right !== -1) break;
  }

  if (bottom < 0 || right < 0) {
    rememberBox(key, null);
    return null;
  }

  // Запас по краям. Берём щедро: у акварельных размывов кромка уходит
  // в почти нулевую альфу, и скупой запас срезал бы края кроны.
  // Увеличили с 8 до 16 из-за scaleJitter 0.88..1.12 — чтобы не обрезать.
  const pad = 16;
  const w = Math.min(900, right - left + 1 + pad * 2);
  const h = Math.min(900, bottom - top + 1 + pad * 2);
  if (w <= 0 || h <= 0) {
    rememberBox(key, null);
    return null;
  }
  const box = {
    w,
    h,
    ax: ox - left + pad,
    ay: oy - top + pad,
  };
  rememberBox(key, box);
  return box;
}

/** Выкидываем то, что дольше всего не пригождалось. */
function evict(): void {
  let oldest = Infinity;
  let victim = '';
  for (const [k, v] of cache) {
    if (v.used < oldest) {
      oldest = v.used;
      victim = k;
    }
  }
  if (victim) {
    releaseSprite(cache.get(victim)!);
    cache.delete(victim);
  }
}

/** Two reusable large-sprite masks (1.25 MiB total); no per-light/per-frame sprite variants. */
const lightMasks = new Map<number, HTMLCanvasElement>();
export function paintObjectLight(d: DrawCtx, hits: import('./localLight').LightSample[], useCache = true): void {
  if (!hits.length) return;
  // A real re-lit material, not a uniform orange silhouette: books, grain and dark faces retain contrast.
  const litD = {
    ...d,
    atm: {
      ...d.atm,
      exposure: Math.min(1.08, d.atm.exposure + 0.58),
      lightTint: hits[0].light.color,
      lightAmount: 0.34,
    },
  };
  const cached = useCache && cacheable(d.obj.type, drawCost(d.obj.type)) ? getCachedSprite(litD, true) : null;
  const strength = Math.min(
    0.65,
    hits.reduce((s, h) => s + h.strength, 0),
  );
  // Tiny materials need only receiver-level falloff. Avoid a mutable bitmap copy per blade of grass.
  // Large cached crowns retain the spatial gradient; live objects retain their exact animation.
  if (!cached || Math.max(cached.canvas.width, cached.canvas.height) <= 160) {
    const direct = { ...litD, alpha: d.alpha * strength * 0.56 };
    if (cached) drawEntry(direct, cached);
    else {
      setSkipShadows(true);
      try {
        drawObject(direct);
      } finally {
        setSkipShadows(false);
      }
    }
    return;
  }
  const measured = { w: cached.canvas.width, h: cached.canvas.height, ax: cached.ax, ay: cached.ay };
  if (measured.w > 512 || measured.h > 512) return;
  const size = [256, 512].find((s) => s >= Math.max(measured.w, measured.h))!;
  let lightMask = lightMasks.get(size);
  if (!lightMask) {
    lightMask = document.createElement('canvas');
    lightMask.width = size;
    lightMask.height = size;
    lightMasks.set(size, lightMask);
  }
  const c = lightMask.getContext('2d')!;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.save();
  c.beginPath();
  c.rect(0, 0, measured.w, measured.h);
  c.clip();
  c.clearRect(0, 0, measured.w, measured.h);
  c.drawImage(cached.canvas, 0, 0);
  c.globalCompositeOperation = 'destination-in';
  const l = hits[0].light;
  const x = l.screen.x - d.x + measured.ax,
    y = l.screen.y - d.y + measured.ay,
    r = l.radius * 66;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, css(l.color, strength * 0.76));
  g.addColorStop(0.45, css(l.color, strength * 0.55));
  g.addColorStop(1, css(l.color, 0));
  c.fillStyle = g;
  c.fillRect(0, 0, measured.w, measured.h);
  c.restore();
  let dx = d.x - measured.ax,
    dy = d.y - measured.ay;
  const m = d.ctx.getTransform();
  if (cached && m.a && m.d) {
    const sx = m.a * dx + m.c * dy + m.e,
      sy = m.b * dx + m.d * dy + m.f;
    dx += (Math.round(sx) - sx) / m.a;
    dy += (Math.round(sy) - sy) / m.d;
  }
  d.ctx.save();
  d.ctx.globalAlpha = d.alpha;
  d.ctx.globalCompositeOperation = 'source-over';
  d.ctx.drawImage(lightMask, 0, 0, measured.w, measured.h, dx, dy, measured.w, measured.h);
  d.ctx.restore();
}
