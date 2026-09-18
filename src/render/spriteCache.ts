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
 * Ветер и время в ключ не входят — они применяются при копировании.
 */

import { DrawCtx, drawObject, hasDrawer, setSkipShadows } from './sprites';
import { Ctx } from './paint';

interface Entry {
  canvas: HTMLCanvasElement;
  /** Где внутри холста находится точка опоры объекта. */
  ax: number;
  ay: number;
  /** Последний кадр, когда спрайт пригодился, — для вытеснения. */
  used: number;
}

const cache = new Map<string, Entry>();
/** Больше не держим: при 4 сезонах и десятке стадий этого с запасом. */
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

export function spriteStats(): { size: number; hits: number; misses: number } {
  return { size: cache.size, hits, misses };
}

export function clearSprites(): void {
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
export function drawCached(d: DrawCtx): boolean {
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
  const key = `${obj.type}|${atm.season}|${gq}|${expq}|${lampq}|${sunq}|${goldq}|${obj.seed}|${obj.rot}`;

  let e = cache.get(key);
  if (!e) {
    // Размер поля берём замером, а не оценкой по типу.
    //
    // Сначала я прикидывал высоту формулой от objectHeight — и кроны
    // обрезались: спрайт оказывался меньше настоящего рисунка.
    // Теперь один раз меряем, куда объект дотягивается на самом деле.
    const box = measureBox(obj, atm, gq);
    if (!box) return false;

    const w = box.w;
    const h = box.h;
    if (w <= 0 || h <= 0 || w > 900 || h > 900) return false;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const cx = canvas.getContext('2d');
    if (!cx) return false;

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
      atm,
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
  return true;
}

/**
 * Настоящие границы рисунка относительно точки опоры.
 *
 * Меряется пробным кадром на большом холсте: дешевле один раз замерить,
 * чем всю жизнь угадывать размер и обрезать кроны.
 */
const boxes = new Map<string, { w: number; h: number; ax: number; ay: number } | null>();

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
  const key = `${obj.type}|${atm.season}|${gq}|${obj.rot}|${obj.seed}`;
  const hit = boxes.get(key);
  if (hit !== undefined) return hit;

  // Уменьшили холст с 520 до 380 — быстрее и меньше памяти,
  // а для самых больших деревьев всё ещё хватает.
  const S = 380;
  const pc = getProbe(S);
  if (!pc) {
    boxes.set(key, null);
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
    boxes.set(key, null);
    return null;
  }
  setSkipShadows(false);

  let img: ImageData;
  try {
    img = (pc as any).getImageData(0, 0, S, S) as ImageData;
  } catch (e) {
    console.warn('[spriteCache] getImageData failed', e);
    boxes.set(key, null);
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
    boxes.set(key, null);
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
    boxes.set(key, null);
    return null;
  }

  // Запас по краям. Берём щедро: у акварельных размывов кромка уходит
  // в почти нулевую альфу, и скупой запас срезал бы края кроны.
  // Увеличили с 8 до 16 из-за scaleJitter 0.88..1.12 — чтобы не обрезать.
  const pad = 16;
  const w = Math.min(900, right - left + 1 + pad * 2);
  const h = Math.min(900, bottom - top + 1 + pad * 2);
  if (w <= 0 || h <= 0) {
    boxes.set(key, null);
    return null;
  }
  const box = {
    w,
    h,
    ax: ox - left + pad,
    ay: oy - top + pad,
  };
  boxes.set(key, box);
  if (boxes.size > 600) {
    const first = boxes.keys().next().value;
    if (first) boxes.delete(first);
  }
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
  if (victim) cache.delete(victim);
}
