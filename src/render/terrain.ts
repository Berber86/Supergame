/** Отрисовка земли: непрерывные акварельные заливки, мягкие границы материалов, вода с берегом. */

import { GRID, LEVEL_H, TILE_H, TILE_W, isoToScreen } from '../core/iso';
import { clamp01, fbm, hash2, lerp } from '../core/rng';
import { Atmosphere, RGB, css, mix, shade } from '../world/palette';
import { GroundId, Tile } from '../world/types';
import { World } from '../world/world';
import { Ctx, blobPath, granulate } from './paint';

interface Bounds {
  bx0: number;
  by0: number;
  bx1: number;
  by1: number;
}

/**
 * Начало цикла с сохранением фазы.
 *
 * Разводы идут с дробным шагом (2.1, 1.2, 3.4 клетки), и позиция каждой
 * кляксы задаётся её координатой. Если при частичной перерисовке начать
 * цикл прямо с края участка, вся сетка клякс сдвинется и рисунок поедет.
 * Поэтому отступаем назад до ближайшего узла исходной сетки.
 */
function phase(from: number, origin: number, step: number): number {
  return origin + Math.floor((from - origin) / step) * step;
}

function groundColor(g: GroundId, atm: Atmosphere): RGB {
  const p = atm.palette;
  switch (g) {
    case 'moss':
      return p.moss;
    case 'grass':
      return p.grass;
    case 'gravel':
      return mix(p.stone, { r: 232, g: 224, b: 204 }, 0.42);
    case 'sand':
      return mix(p.soil, { r: 238, g: 224, b: 194 }, 0.6);
    case 'stone':
      return p.stone;
    case 'soil':
      return p.soil;
    case 'water':
      return p.water;
    case 'tatami':
      return { r: 214, g: 200, b: 152 };
    case 'deck':
      return { r: 178, g: 138, b: 96 };
  }
}

/** «Мягкие» материалы, у которых граница размывается кляксами. */
function isSoft(g: GroundId): boolean {
  return g === 'moss' || g === 'grass' || g === 'gravel' || g === 'sand' || g === 'soil';
}

/** Прямоугольник тайлов, который нужно перерисовать. */
export interface TileRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface TerrainLayer {
  canvas: HTMLCanvasElement;
  ox: number;
  oy: number;
  w: number;
  h: number;
}

/**
 * Рисует землю в готовый слой.
 *
 * Если передан `dirty`, перерисовывается только этот участок: контекст
 * обрезается по экранному прямоугольнику участка, старые пиксели стираются,
 * и всё рисуется заново. Так можно, потому что вся отрисовка земли
 * детерминирована — цвет и форма каждой кляксы выводятся из координат тайла
 * и сида, а не из случайных чисел. Частичный проход даёт пиксель в пиксель
 * то же, что полный.
 */
export function renderTerrain(
  world: World,
  atm: Atmosphere,
  scale = 1,
  into?: TerrainLayer,
  dirty?: TileRect,
): TerrainLayer {
  const corners = [isoToScreen(0, 0, 3), isoToScreen(GRID, 0, 0), isoToScreen(GRID, GRID, 0), isoToScreen(0, GRID, 0)];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const c of corners) {
    minX = Math.min(minX, c.x);
    maxX = Math.max(maxX, c.x);
    minY = Math.min(minY, c.y);
    maxY = Math.max(maxY, c.y);
  }
  const pad = 150;
  minX -= pad;
  maxX += pad;
  minY -= pad + LEVEL_H * 3;
  maxY += pad;

  const canvas = into?.canvas ?? document.createElement('canvas');
  if (!into) {
    canvas.width = Math.ceil((maxX - minX) * scale);
    canvas.height = Math.ceil((maxY - minY) * scale);
  }

  // Какой прямоугольник холста обновляем
  const rect = into && dirty ? blitRect(dirty, minX, minY, scale, canvas.width, canvas.height) : null;

  // Частичная перерисовка идёт в запасной холст такого же размера, а потом
  // участок переносится в слой.
  //
  // Почему не рисовать сразу в слой с обрезкой: земля складывается из двух
  // десятков полупрозрачных слоёв, и любая обрезка домножает каждый из них
  // на краевое покрытие по отдельности. На стыке нового со старым от этого
  // остаётся еле заметный, но различимый шов.
  //
  // Почему холст полного размера, а не с участок: мазки должны лечь ровно
  // в те же координаты, что и при полной перерисовке. Холст заводится один
  // раз и живёт между вызовами.
  const partial = !!(into && dirty && rect);
  const target = partial ? scratchFor(canvas) : canvas;
  const ctx = target.getContext('2d')!;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Чистим весь холст, а не только участок переноса.
  //
  // Тайлы за пределами прямоугольника тоже рисуются (их краска может
  // залететь внутрь), и следы прошлой правки, оставшиеся рядом, попадали
  // бы в перенос. Ловилось это одним пикселем на шести миллионах —
  // но один настоящий пиксель важнее удобной погрешности.
  if (partial) ctx.clearRect(0, 0, target.width, target.height);
  ctx.scale(scale, scale);
  ctx.translate(-minX, -minY);

  // Тайлы обходим по диагоналям — так дальние рисуются раньше ближних.
  // При частичной перерисовке берём только те, что могут задеть участок:
  // запас в 3 клетки покрывает разлёт клякс и берега.
  // Какие тайлы нужны, чтобы прямоугольник был нарисован целиком. Набор
  // выводится из самого прямоугольника, а не берётся с запасом «на глаз».
  const need = rect ? tilesCovering(rect, minX, minY, scale) : null;
  const bx0 = need ? Math.max(0, need.x0) : 0;
  const by0 = need ? Math.max(0, need.y0) : 0;
  const bx1 = need ? Math.min(GRID - 1, need.x1) : GRID - 1;
  const by1 = need ? Math.min(GRID - 1, need.y1) : GRID - 1;

  const bounds: Bounds = { bx0, by0, bx1, by1 };

  const order: { x: number; y: number }[] = [];
  for (let s = 0; s <= (GRID - 1) * 2; s++) {
    for (let x = bx0; x <= bx1; x++) {
      const y = s - x;
      if (y < by0 || y > by1) continue;
      // Прямоугольный охват по тайлам заметно шире нужного: соответствующий
      // ему ромб вытянут по диагонали. Отсеиваем поштучно клетки, чья краска
      // до прямоугольника всё равно не долетит.
      if (rect && !tileTouchesRect(x, y, world, rect, minX, minY, scale)) continue;
      // Прямоугольный охват по тайлам сильно шире нужного: ромб, который
      // ему соответствует, вытянут по диагонали. Отсеиваем поштучно те
      // клетки, чья краска до прямоугольника всё равно не долетит.
      order.push({ x, y });
    }
  }

  // 1) Земляная «подушка» под садом
  drawBase(ctx, atm);

  // 2) Боковые грани рельефа
  for (const { x, y } of order) drawTileSides(ctx, world, x, y, world.at(x, y)!, atm);

  // 3) Сплошная заливка верхних плоскостей — без щелей
  for (const { x, y } of order) drawTileFill(ctx, world, x, y, world.at(x, y)!, atm);

  // 4) Крупные акварельные разводы поверх — ломают ощущение сетки
  drawGlobalWash(ctx, world, atm, bounds);

  // 4.5) Снежный покров
  if (atm.season === 'winter') drawSnowCover(ctx, world, atm, bounds);

  // 4.7) Возвращаем поверхность воды поверх разводов.
  //
  // Кляксы разводов крупнее клетки и заливают соседнюю воду, отчего пруд
  // выглядит прозрачным — сквозь него просвечивает трава. На уровне земли
  // это сходило за игру света, но приподнятый пруд от этого становится
  // стеклянным. Вода — не земля, акварельных затёков на ней быть не должно.
  for (const { x, y } of order) {
    const t = world.at(x, y)!;
    if (t.water) drawWaterTop(ctx, x, y, t.level, atm);
  }

  // 5) Мягкие границы между разными материалами
  for (const { x, y } of order) drawMaterialEdges(ctx, world, x, y, atm);

  // 6) Фактура материалов
  for (const { x, y } of order) drawTileDetail(ctx, world, x, y, world.at(x, y)!, atm);

  // 7) Скругление силуэта водоёма + берег
  for (const { x, y } of order) {
    if (world.at(x, y)!.water) roundWaterCorners(ctx, world, x, y, atm);
  }
  for (const { x, y } of order) {
    if (world.at(x, y)!.water) drawWaterEdge(ctx, world, x, y, atm);
  }

  ctx.restore();

  if (partial) {
    // Переносим ровно прямоугольник участка: целые координаты и масштаб 1:1,
    // поэтому сглаживанию на кромке взяться неоткуда и результат совпадает
    // с полной перерисовкой пиксель в пиксель.
    // Именно putImageData, а не drawImage: тот заставляет подготовить
    // весь холст слоя целиком (это и была основная трата), а этот копирует
    // ровно байты участка. Замена пикселей здесь и нужна — участок уже
    // нарисован поверх пустоты, смешивать со старым содержимым нечего.
    const dst = canvas.getContext('2d')!;
    dst.save();
    dst.setTransform(1, 0, 0, 1, 0, 0);
    dst.clearRect(rect!.x, rect!.y, rect!.w, rect!.h);
    dst.drawImage(target, rect!.x, rect!.y, rect!.w, rect!.h, rect!.x, rect!.y, rect!.w, rect!.h);
    dst.restore();
  }

  return { canvas, ox: minX, oy: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Насколько далеко краска расходится от своего тайла.
 * Кляксы разводов и снежные сугробы бывают крупнее клетки.
 */
const SPLATTER = 3.5;
/** Диапазон уровней рельефа, который может попасть в кадр. */
const LEVEL_MIN = -2.5;
const LEVEL_MAX = 3.5;

/** Может ли тайл нарисовать хоть что-нибудь внутри прямоугольника. */
function tileTouchesRect(
  x: number,
  y: number,
  world: World,
  rect: { x: number; y: number; w: number; h: number },
  ox: number,
  oy: number,
  scale: number,
): boolean {
  const t = world.at(x, y);
  const lvl = t ? t.level : 0;
  // Ромб тайла плюс разлёт краски и высота столбика под ним
  const c = isoToScreen(x + 0.5, y + 0.5, lvl);
  const halfW = TILE_W * (0.5 + SPLATTER * 0.5);
  const up = TILE_H * (0.5 + SPLATTER * 0.5) + LEVEL_H;
  const down = TILE_H * (0.5 + SPLATTER * 0.5) + LEVEL_H * (lvl + 3);
  const x0 = (c.x - halfW - ox) * scale;
  const x1 = (c.x + halfW - ox) * scale;
  const y0 = (c.y - up - oy) * scale;
  const y1 = (c.y + down - oy) * scale;
  return x1 >= rect.x && x0 <= rect.x + rect.w && y1 >= rect.y && y0 <= rect.y + rect.h;
}

/**
 * Запасной холст для частичной перерисовки — один на всё приложение.
 * Держать его постоянно дешевле, чем заводить новый на каждый мазок кистью.
 */

/**
 * Запасной холст для частичной перерисовки — один на всё приложение,
 * размером с участок. Маленький он не только ради памяти: чтение пикселей
 * заставляет canvas сбросить очередь отрисовки по всей своей площади,
 * и на холсте размером со слой это стоило дороже, чем нарисовать сад заново.
 */
let scratch: HTMLCanvasElement | null = null;

function scratchFor(like: HTMLCanvasElement): HTMLCanvasElement {
  if (!scratch || scratch.width !== like.width || scratch.height !== like.height) {
    scratch = document.createElement('canvas');
    scratch.width = like.width;
    scratch.height = like.height;
  }
  return scratch;
}

/**
 * Какие тайлы способны нарисовать хоть что-то внутри прямоугольника.
 *
 * Обращаем изометрию: x = (tx-ty)·(W/2), y = (tx+ty)·(H/2) - level·LEVEL_H.
 * Значит tx-ty и tx+ty выражаются через края прямоугольника, а разброс
 * по высоте и разлёт краски расширяют полученные границы.
 */
function tilesCovering(
  rect: { x: number; y: number; w: number; h: number },
  ox: number,
  oy: number,
  scale: number,
): { x0: number; y0: number; x1: number; y1: number } {
  // пиксели холста → мировые экранные координаты
  const wx0 = rect.x / scale + ox;
  const wx1 = (rect.x + rect.w) / scale + ox;
  const wy0 = rect.y / scale + oy;
  const wy1 = (rect.y + rect.h) / scale + oy;

  // разность координат: d = tx - ty
  const dMin = wx0 / (TILE_W / 2) - SPLATTER * 2;
  const dMax = wx1 / (TILE_W / 2) + SPLATTER * 2;
  // сумма координат: s = tx + ty (высота сдвигает тайл по вертикали)
  const sMin = (wy0 + LEVEL_MIN * LEVEL_H) / (TILE_H / 2) - SPLATTER * 2;
  const sMax = (wy1 + LEVEL_MAX * LEVEL_H) / (TILE_H / 2) + SPLATTER * 2;

  return {
    x0: Math.floor((sMin + dMin) / 2),
    y0: Math.floor((sMin - dMax) / 2),
    x1: Math.ceil((sMax + dMax) / 2),
    y1: Math.ceil((sMax - dMin) / 2),
  };
}

/**
 * Прямоугольник переноса в пикселях холста.
 *
 * Берём экранные границы изменённых клеток и сжимаем запасом CLIP_MARGIN,
 * который уже заложен в перерисованную область: всё внутри прямоугольника
 * нарисовано полностью, потому что каждый влияющий на него тайл попал
 * в проход отрисовки.
 */
function blitRect(
  r: TileRect,
  ox: number,
  oy: number,
  scale: number,
  cw: number,
  ch: number,
): { x: number; y: number; w: number; h: number } | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let y = r.y0; y <= r.y1 + 1; y++) {
    for (let x = r.x0; x <= r.x1 + 1; x++) {
      // Берём щедрый диапазон высот: правка могла и поднять землю, и опустить,
      // а стереть нужно и то, что было нарисовано до неё.
      for (const l of [LEVEL_MAX, LEVEL_MIN]) {
        const p = isoToScreen(x, y, l);
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
    }
  }
  // Запас на берег, кромку воды и разлёт клякс
  const pad = TILE_W * SPLATTER * 0.5;
  const x0 = Math.max(0, Math.floor((minX - pad - ox) * scale));
  const y0 = Math.max(0, Math.floor((minY - pad - oy) * scale));
  const x1 = Math.min(cw, Math.ceil((maxX + pad - ox) * scale));
  const y1 = Math.min(ch, Math.ceil((maxY + pad - oy) * scale));
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function drawBase(ctx: Ctx, atm: Atmosphere): void {
  const c0 = isoToScreen(0, 0);
  const c1 = isoToScreen(GRID, GRID);
  const cx = (c0.x + c1.x) / 2;
  const cy = (c0.y + c1.y) / 2;
  const rx = (GRID * TILE_W) / 2 + 70;
  const ry = (GRID * TILE_H) / 2 + 70;
  const base = shade(mix(atm.palette.soil, atm.palette.moss, 0.4), atm.exposure * 0.86);
  // Градиент строится в локальных координатах после translate — иначе его
  // центр уезжает вдвое дальше от центра острова, и мягкое поле основы
  // вырождается: везде берётся дальняя stop-точка с нулевой альфой.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry));
  g.addColorStop(0, css(base, 0.95));
  g.addColorStop(0.85, css(base, 0.8));
  g.addColorStop(1, css(base, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Ромб тайла, слегка расширенный — соседние тайлы перекрываются, щелей не остаётся. */
function tilePath(ctx: Ctx, x: number, y: number, level: number, grow = 0.02): void {
  const a = isoToScreen(x - grow, y - grow, level);
  const b = isoToScreen(x + 1 + grow, y - grow, level);
  const c = isoToScreen(x + 1 + grow, y + 1 + grow, level);
  const d = isoToScreen(x - grow, y + 1 + grow, level);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
}

/** Дорожные покрытия: сливаются в тропинки, а не лежат плитой. */
function isRoad(g: GroundId): boolean {
  return g === 'gravel' || g === 'sand' || g === 'stone';
}

function sameGround(world: World, x: number, y: number, g: GroundId): boolean {
  const n = world.at(x, y);
  return !!n && !n.water && !n.indoor && !n.veranda && n.ground === g;
}

const ROAD_CARD: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

const ROAD_DIAG: [number, number][] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** Число соседей-дорог в радиусе одной клетки (все 8 направлений). */
function roadDeg(world: World, x: number, y: number, g: GroundId): number {
  let n = 0;
  for (const [dx, dy] of [...ROAD_CARD, ...ROAD_DIAG]) if (sameGround(world, x + dx, y + dy, g)) n++;
  return n;
}

/** Тонкая тропинка: до двух дорожных соседей. Больше — уже двор-площадка. */
function roadThin(world: World, x: number, y: number, g: GroundId): boolean {
  return roadDeg(world, x, y, g) <= 2;
}

/** Что под тропинкой: грунт ближайшего недорожного соседа, иначе трава. */
function roadUnder(world: World, x: number, y: number): GroundId {
  const seen = new Set<GroundId>();
  for (const [dx, dy] of ROAD_CARD) {
    const n = world.at(x + dx, y + dy);
    if (!n || n.water || n.indoor || n.veranda || isRoad(n.ground)) continue;
    seen.add(n.ground);
  }
  // предпочитаем самый частый по кругу порядок: трава > мох > почва > прочее
  for (const pref of ['grass', 'moss', 'soil', 'sand', 'gravel'] as GroundId[]) {
    if (seen.has(pref)) return pref;
  }
  return 'grass';
}

/** Скелет тропинки: центр + отростки к соседям того же покрытия. */
interface RoadSkeleton {
  c: { x: number; y: number };
  /** отросток: m — точка на границе тайла, corner — диагональная связь (лёгкий поворот). */
  arms: { m: { x: number; y: number }; corner: boolean }[];
  cardDeg: number;
}

function roadSkeleton(world: World, x: number, y: number, t: Tile): RoadSkeleton | null {
  if (!isRoad(t.ground) || !roadThin(world, x, y, t.ground)) return null;
  const lv = t.level;
  const c = isoToScreen(x + 0.5, y + 0.5, lv);
  const arms: RoadSkeleton['arms'] = [];
  let card = 0;
  const cardSide = (dx: number, dy: number) => sameGround(world, x + dx, y + dy, t.ground);
  for (const [dx, dy] of ROAD_CARD) {
    if (!cardSide(dx, dy)) continue;
    card++;
    arms.push({ m: isoToScreen(x + 0.5 + dx * 0.5, y + 0.5 + dy * 0.5, lv), corner: false });
  }
  for (const [dx, dy] of ROAD_DIAG) {
    if (!sameGround(world, x + dx, y + dy, t.ground)) continue;
    // диагональ «просится» только если между ними нет своих же кардинальных
    if (cardSide(dx, 0) || cardSide(0, dy)) continue;
    arms.push({
      m: isoToScreen(x + 0.5 + dx * 0.5, y + 0.5 + dy * 0.5, lv),
      corner: true,
    });
  }
  return { c, arms, cardDeg: card };
}

// склон свечения: та же вариация тона, что у тайла, — но отсчёт от дороги,
// чтобы тропинка не «проваливалась» в узор травы.
function tileColor(world: World, x: number, y: number, t: Tile, atm: Atmosphere, g?: GroundId): RGB {
  const ground = g ?? (isRoad(t.ground) && roadThin(world, x, y, t.ground) ? roadUnder(world, x, y) : t.ground);
  let col = groundColor(ground, atm);
  const v = (fbm(x * 0.28, y * 0.28, 3, 5) - 0.5) * 0.14 + (hash2(x, y, 31) - 0.5) * 0.035;
  col = shade(col, 1 + v);
  const nbN = world.at(x, y - 1)?.level ?? t.level;
  const nbW = world.at(x - 1, y)?.level ?? t.level;
  const slope = (t.level - nbN) * 0.05 + (t.level - nbW) * 0.035;
  col = shade(col, atm.exposure * (1 + slope));
  return mix(col, atm.lightTint, atm.lightAmount * 0.75);
}

function drawTileFill(ctx: Ctx, world: World, x: number, y: number, t: Tile, atm: Atmosphere): void {
  if (t.water) {
    drawWaterTop(ctx, x, y, t.level, atm);
    return;
  }
  tilePath(ctx, x, y, t.level, 0.025);
  ctx.fillStyle = css(tileColor(world, x, y, t, atm), 1);
  ctx.fill();
  // Дорожка поверх подстилающего грунта: лента к соседям, а не квадрат.
  drawRoadRibbon(ctx, world, x, y, t, atm);
}

/** Конусная лента от c до m в цвет покрытия. */
function ribbonQuad(ctx: Ctx, c: { x: number; y: number }, m: { x: number; y: number }, w0: number, w1: number): void {
  const dx = m.x - c.x;
  const dy = m.y - c.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  ctx.beginPath();
  ctx.moveTo(c.x + px * w0, c.y + py * w0);
  ctx.lineTo(c.x - px * w0, c.y - py * w0);
  ctx.lineTo(m.x - px * w1, m.y - py * w1);
  ctx.lineTo(m.x + px * w1, m.y + py * w1);
  ctx.closePath();
  ctx.fill();
}

/** Тропинка: узкая лента, обвивающая соседей; перекрёстки шире. */
function drawRoadRibbon(ctx: Ctx, world: World, x: number, y: number, t: Tile, atm: Atmosphere): void {
  if (!isRoad(t.ground) || t.water || t.indoor || t.veranda) return;
  const sk = roadSkeleton(world, x, y, t);
  if (!sk) return; // широкий участок — остаётся сплошной плитой
  const col = tileColor(world, x, y, t, atm, t.ground);
  const junc = sk.cardDeg >= 2 || sk.arms.length >= 3;
  const w = TILE_W * 0.15 * (junc ? 1.35 : 1);
  // Сплошная лента-раствор по всей оси пути; у камня она чуть приглушена —
  // поверх неё в detail-проходе лягут бутовые плиты дорожки.
  const stone = t.ground === 'stone';
  ctx.fillStyle = css(stone ? shade(col, 0.94) : col, stone ? 0.55 : 0.96);
  for (const arm of sk.arms) {
    ribbonQuad(ctx, sk.c, arm.m, w, w * (arm.corner ? 0.8 : 1));
    if (arm.corner) {
      // диагональный сосед: лента загибается к общему углу — поворот
      // читается лёгкой дугой, а не рваной ступенькой «уголок к уголку».
      blobPath(ctx, arm.m.x, arm.m.y, w * 1.15, w * 1.05, x * 67 + y * 13 + 5, 0.3, 9);
      ctx.fill();
    }
  }
  const seed = x * 41 + y * 97;
  blobPath(ctx, sk.c.x, sk.c.y, w * (sk.arms.length ? 1.5 : 1.7), w * 1.35, seed, 0.34, 11);
  ctx.fill();
}

/** Крупные размывы поверх земли. Режим multiply — краска ложится слоями, как акварель. */
function drawGlobalWash(ctx: Ctx, world: World, atm: Atmosphere, b: Bounds): void {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';

  // Слой 1: широкие мягкие тени — объём и «дыхание» лужайки
  for (let gy = phase(b.by0, 0, 2.1); gy <= b.by1; gy += 2.1) {
    for (let gx = phase(b.bx0, 0, 2.1); gx <= b.bx1; gx += 2.1) {
      const x = Math.floor(gx);
      const y = Math.floor(gy);
      const t = world.at(x, y);
      if (!t || t.water || t.indoor || t.veranda) continue;
      const n = fbm(gx * 0.17, gy * 0.17, 4, 77);
      const n2 = fbm(gx * 0.38 + 13, gy * 0.38 - 7, 3, 23);
      if (n < 0.44) continue;
      const p = isoToScreen(gx + 1, gy + 1, t.level);
      // тон: холодная зелень ↔ тёплая охра, но всегда темнее подложки
      const cool = mix(atm.palette.foliageDeep, atm.palette.grassDeep, 0.4);
      const warm = mix(atm.palette.grassDeep, atm.palette.soil, 0.55);
      const col = mix(cool, warm, clamp01((n2 - 0.4) * 2));
      const a = (n - 0.44) * 0.5;
      ctx.fillStyle = css(mix({ r: 255, g: 255, b: 255 }, col, a), 1);
      blobPath(
        ctx,
        p.x + (n - 0.5) * 70,
        p.y + (n2 - 0.5) * 32,
        TILE_W * (0.7 + n * 0.9),
        TILE_H * (0.7 + n2 * 0.9),
        Math.round(gx * 31 + gy * 17),
        0.32,
        11,
      );
      ctx.fill();
    }
  }

  // Слой 2: тёмные затёки поменьше — кромки высохшей краски
  for (let gy = phase(b.by0, 0, 1.2); gy <= b.by1; gy += 1.2) {
    for (let gx = phase(b.bx0, 0, 1.2); gx <= b.bx1; gx += 1.2) {
      const x = Math.floor(gx);
      const y = Math.floor(gy);
      const t = world.at(x, y);
      if (!t || t.water || t.indoor || t.veranda) continue;
      const n = fbm(gx * 0.62 + 41, gy * 0.62 - 19, 3, 131);
      if (n < 0.56) continue;
      const p = isoToScreen(gx + 0.6, gy + 0.6, t.level);
      const col = mix(atm.palette.foliageDeep, atm.palette.grassDeep, 0.3);
      const a = (n - 0.56) * 0.62;
      ctx.fillStyle = css(mix({ r: 255, g: 255, b: 255 }, col, a), 1);
      blobPath(
        ctx,
        p.x + (n - 0.5) * 30,
        p.y + (n - 0.5) * 14,
        TILE_W * (0.3 + n * 0.42),
        TILE_H * (0.3 + n * 0.42),
        Math.round(gx * 13 + gy * 29),
        0.42,
        9,
      );
      ctx.fill();
    }
  }
  ctx.restore();

  // Слой 3: редкие солнечные прогалины — светлее, «просвет в листве»
  ctx.save();
  for (let gy = phase(b.by0, 0, 3.4); gy <= b.by1; gy += 3.4) {
    for (let gx = phase(b.bx0, 0, 3.4); gx <= b.bx1; gx += 3.4) {
      const x = Math.floor(gx);
      const y = Math.floor(gy);
      const t = world.at(x, y);
      if (!t || t.water || t.indoor || t.veranda) continue;
      const n = fbm(gx * 0.21 + 77, gy * 0.21 + 33, 3, 57);
      if (n < 0.58) continue;
      const p = isoToScreen(gx + 1.4, gy + 1.4, t.level);
      const sun = mix(atm.palette.grass, { r: 252, g: 248, b: 214 }, 0.45);
      ctx.fillStyle = css(shade(sun, atm.exposure), (n - 0.58) * 0.5 * atm.time.daylight);
      blobPath(ctx, p.x, p.y, TILE_W * (1 + n), TILE_H * (1 + n), Math.round(gx * 7 + gy * 41), 0.3, 11);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Зимой землю укрывает снег: непрерывный покров, без следов сетки. */
function drawSnowCover(ctx: Ctx, world: World, atm: Atmosphere, b: Bounds): void {
  // Снег не белила: в полдень экспозиция и так вытягивает его к белому,
  // и если брать чистый белый за основу, лепка сугробов пропадает —
  // сад превращается в лист бумаги. Держим основу чуть голубее,
  // а на ярком свету дополнительно придерживаем.
  const bright = clamp01((atm.exposure - 1) * 1.2);
  // Ночью лепка сугробов должна слабеть вместе со светом. Без этого
  // тёмные пятна остаются во всю силу поверх потемневшего снега,
  // и ровное поле выглядит грязной крапинкой, а не сугробами.
  const modelling = 0.35 + clamp01(atm.exposure) * 0.65;
  const snowBase = mix({ r: 242, g: 245, b: 250 }, { r: 214, g: 226, b: 240 }, bright * 0.55);
  // На рассвете и закате свет очень тёплый (lightTint уходит в оранжевый),
  // и снег, покрашенный им в полную силу, становится бежевым — зимнее утро
  // превращалось в однотонную молочную пелену. Снег ловит тёплый отсвет,
  // но остаётся снегом: примесь света для него вдвое слабее обычной.
  const snowLight = atm.lightAmount * (1 - atm.golden * 0.55);
  const snow = shade(mix(snowBase, atm.lightTint, snowLight * 0.8), Math.min(atm.exposure, 1.04));
  const shadowSnow = shade(
    // Тени на снегу наоборот холодные — так глаз и читает «снег»
    mix({ r: 196, g: 212, b: 234 }, atm.lightTint, snowLight * 0.7),
    Math.min(atm.exposure, 1.04),
  );

  // 1) Сплошная непрозрачная шапка одной фигурой — швов быть не может
  ctx.save();
  ctx.beginPath();
  for (let y = b.by0; y <= b.by1; y++) {
    for (let x = b.bx0; x <= b.bx1; x++) {
      const t = world.at(x, y)!;
      if (t.water || t.indoor || t.veranda) continue;
      const a = isoToScreen(x - 0.04, y - 0.04, t.level);
      const b = isoToScreen(x + 1.04, y - 0.04, t.level);
      const c = isoToScreen(x + 1.04, y + 1.04, t.level);
      const dd = isoToScreen(x - 0.04, y + 1.04, t.level);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(dd.x, dd.y);
      ctx.closePath();
    }
  }
  ctx.fillStyle = css(snow, 1);
  ctx.fill();

  // 2) Внутри этой формы — мягкая лепка сугробов (клип не даёт вылезти за край)
  ctx.clip();
  for (let gy = phase(b.by0 - 1, -1, 1.1); gy <= b.by1; gy += 1.1) {
    for (let gx = phase(b.bx0 - 1, -1, 1.1); gx <= b.bx1; gx += 1.1) {
      const t = world.at(Math.max(0, Math.floor(gx)), Math.max(0, Math.floor(gy)));
      const lvl = t ? t.level : 0;
      const n = fbm(gx * 0.33, gy * 0.33, 4, 311);
      const p = isoToScreen(gx + 0.5, gy + 0.5, lvl);
      if (n < 0.47) {
        ctx.fillStyle = css(shadowSnow, (0.47 - n) * 0.85 * modelling);
        blobPath(ctx, p.x, p.y, TILE_W * (0.5 + n), TILE_H * (0.5 + n), Math.round(gx * 19 + gy * 7), 0.36, 10);
        ctx.fill();
      } else if (n > 0.6) {
        // блик на гребне сугроба — но не в полную силу на ярком свету
        ctx.fillStyle = css({ r: 255, g: 255, b: 255 }, (n - 0.6) * 0.7 * (1 - bright * 0.45) * modelling);
        blobPath(
          ctx,
          p.x,
          p.y,
          TILE_W * (0.4 + n * 0.6),
          TILE_H * (0.4 + n * 0.6),
          Math.round(gx * 41 + gy * 13),
          0.34,
          10,
        );
        ctx.fill();
      }
    }
  }

  // 3) Редкие проталины — сухая трава сквозь снег
  for (let i = 0; i < 90; i++) {
    const gx = hash2(i, 5, 71) * GRID;
    const gy = hash2(i, 9, 83) * GRID;
    const t = world.at(Math.floor(gx), Math.floor(gy));
    if (!t || t.water || t.indoor || t.veranda) continue;
    const n = fbm(gx * 0.5, gy * 0.5, 2, 411);
    if (n < 0.58) continue;
    const p = isoToScreen(gx, gy, t.level);
    ctx.fillStyle = css(shade(mix(atm.palette.moss, atm.palette.soil, 0.45), atm.exposure), (n - 0.58) * 0.75);
    blobPath(ctx, p.x, p.y, TILE_W * (0.14 + n * 0.16), TILE_H * (0.14 + n * 0.16), i * 13, 0.46, 8);
    ctx.fill();
  }

  // 4) Искристая крупа
  for (let i = 0; i < 620; i++) {
    const gx = hash2(i, 1, 21) * GRID;
    const gy = hash2(i, 2, 33) * GRID;
    const t = world.at(Math.floor(gx), Math.floor(gy));
    if (!t || t.water || t.indoor || t.veranda) continue;
    const p = isoToScreen(gx, gy, t.level);
    ctx.fillStyle = css({ r: 255, g: 255, b: 255 }, 0.3 + hash2(i, 3, 9) * 0.45);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 0.7 + hash2(i, 4, 11) * 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** На стыке двух мягких материалов рисуем кляксу — граница перестаёт быть ромбом. */
function drawMaterialEdges(ctx: Ctx, world: World, x: number, y: number, atm: Atmosphere): void {
  const t = world.at(x, y)!;
  if (t.water || t.indoor || t.veranda || !isSoft(t.ground)) return;
  const col = tileColor(world, x, y, t, atm);
  const dirs: [number, number][] = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  for (const [dx, dy] of dirs) {
    const nb = world.at(x + dx, y + dy);
    if (!nb || nb.water || nb.indoor || nb.veranda) continue;
    if (nb.ground === t.ground || !isSoft(nb.ground)) continue;
    if (nb.level !== t.level) continue;
    // вылезаем на территорию соседа неровным языком
    const seed = x * 73 + y * 31 + (dx + 2) * 7 + (dy + 2);
    const r = hash2(x * 17 + dx, y * 29 + dy, 83);
    if (r < 0.34) continue; // часть стыков оставляем резкой — так ритм живее
    const reach = 0.3 + r * 0.55;
    const p = isoToScreen(x + 0.5 + dx * reach, y + 0.5 + dy * reach, t.level);
    const sz = 0.2 + r * 0.42;
    ctx.fillStyle = css(col, 0.92);
    blobPath(ctx, p.x, p.y, TILE_W * sz, TILE_H * sz * 0.95, seed, 0.36, 9);
    ctx.fill();
    if (r > 0.7) {
      const p2 = isoToScreen(x + 0.5 + dx * (reach + 0.4), y + 0.5 + dy * (reach + 0.4), t.level);
      ctx.fillStyle = css(col, 0.55);
      blobPath(ctx, p2.x, p2.y, TILE_W * sz * 0.5, TILE_H * sz * 0.48, seed + 9, 0.42, 8);
      ctx.fill();
    }
  }
}

function drawTileDetail(ctx: Ctx, world: World, x: number, y: number, t: Tile, atm: Atmosphere): void {
  if (t.water) return;
  const sk = isRoad(t.ground) ? roadSkeleton(world, x, y, t) : null;
  const col = tileColor(world, x, y, t, atm, sk ? t.ground : undefined);
  const c = isoToScreen(x + 0.5, y + 0.5, t.level);
  switch (t.ground) {
    case 'gravel':
      if (sk) drawRibbonGrain(ctx, sk, col, x * 17 + y * 31, 0.11);
      else drawGravel(ctx, c.x, c.y, col, x * 17 + y * 31);
      break;
    case 'stone':
      if (sk) drawRibbonFlags(ctx, sk, col, x * 29 + y);
      else drawStoneSlab(ctx, world, x, y, t.level, col);
      break;
    case 'tatami':
      drawTatami(ctx, x, y, t.level, atm);
      break;
    case 'deck':
      drawDeck(ctx, x, y, t.level, atm);
      break;
    case 'sand':
      if (sk) drawRibbonGrain(ctx, sk, col, x * 13 + y * 7, 0.09);
      else granulate(ctx, c.x, c.y, TILE_W * 0.4, TILE_H * 0.4, shade(col, 0.88), x * 13 + y * 7, 14, 0.09);
      break;
    case 'moss':
    case 'grass':
      drawMossSpeckle(ctx, x, y, t.level, col, atm);
      break;
    case 'soil':
      granulate(ctx, c.x, c.y, TILE_W * 0.4, TILE_H * 0.4, shade(col, 0.8), x * 19 + y * 3, 18, 0.13);
      break;
  }
}

function drawMossSpeckle(ctx: Ctx, x: number, y: number, level: number, col: RGB, atm: Atmosphere): void {
  const deep = mix(col, atm.palette.grassDeep, 0.5);
  const light = mix(col, { r: 236, g: 240, b: 206 }, 0.3);
  for (let i = 0; i < 6; i++) {
    const r1 = hash2(x * 5 + i, y * 7 + i, 41);
    const r2 = hash2(x * 3 + i, y * 11 + i, 53);
    if (r1 < 0.35) continue;
    const p = isoToScreen(x + 0.12 + r1 * 0.76, y + 0.12 + r2 * 0.76, level);
    ctx.fillStyle = css(r2 > 0.72 ? light : deep, 0.14 + r1 * 0.13);
    blobPath(ctx, p.x, p.y, 8 + r1 * 15, 4 + r2 * 7, x * 31 + y * 7 + i, 0.4, 7);
    ctx.fill();
  }
  // редкие травинки для живости
  if (hash2(x, y, 91) > 0.62) {
    const g = shade(mix(col, atm.palette.grassDeep, 0.6), 0.95);
    for (let i = 0; i < 3; i++) {
      const r = hash2(x + i, y * 3, 17);
      const p = isoToScreen(x + 0.2 + r * 0.6, y + 0.25 + hash2(x, y + i, 19) * 0.5, level);
      ctx.strokeStyle = css(g, 0.3);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.quadraticCurveTo(p.x + (r - 0.5) * 5, p.y - 5, p.x + (r - 0.5) * 9, p.y - 9);
      ctx.stroke();
    }
  }
}

/** Крошка/песок вдоль ленты тропинки: зерно по осям отростков. */
function drawRibbonGrain(ctx: Ctx, sk: RoadSkeleton, col: RGB, seed: number, alpha: number): void {
  granulate(ctx, sk.c.x, sk.c.y, TILE_W * 0.16, TILE_H * 0.16, shade(col, 0.86), seed, 10, alpha * 1.2);
  for (let i = 0; i < sk.arms.length; i++) {
    const a = sk.arms[i];
    const mx = lerp(sk.c.x, a.m.x, 0.55);
    const my = lerp(sk.c.y, a.m.y, 0.55);
    granulate(ctx, mx, my, TILE_W * 0.11, TILE_H * 0.1, shade(col, 0.86), seed + i * 7, 8, alpha);
  }
}

/** Каменная тропка: бутовые плиты вдоль ленты — узор, а не сплошною плита. */
function drawRibbonFlags(ctx: Ctx, sk: RoadSkeleton, col: RGB, seed: number): void {
  const slab = (cx: number, cy: number, r: number, s: number, rot: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.fillStyle = css(shade(col, 1.09), 0.85);
    blobPath(ctx, 0, 0, r, r * 0.62, s, 0.32, 7);
    ctx.fill();
    ctx.restore();
  };
  const r0 = TILE_W * 0.17;
  const axis = Math.atan2(sk.arms.length ? sk.arms[0].m.y - sk.c.y : 0, sk.arms.length ? sk.arms[0].m.x - sk.c.x : 1);
  slab(sk.c.x, sk.c.y, r0, seed, axis * 0.3);
  for (let i = 0; i < sk.arms.length; i++) {
    const a = sk.arms[i];
    slab(lerp(sk.c.x, a.m.x, 0.62), lerp(sk.c.y, a.m.y, 0.62), r0 * 0.68, seed + i * 13, axis * 0.3 + i * 0.5);
  }
}

function drawGravel(ctx: Ctx, cx: number, cy: number, col: RGB, seed: number): void {
  granulate(ctx, cx, cy, TILE_W * 0.42, TILE_H * 0.42, shade(col, 0.86), seed, 20, 0.11);
  ctx.strokeStyle = css(shade(col, 0.8), 0.26);
  ctx.lineWidth = 1.4;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - TILE_W * 0.44, cy + i * 8);
    ctx.quadraticCurveTo(cx, cy + i * 8 + 3, cx + TILE_W * 0.44, cy + i * 8);
    ctx.stroke();
  }
}

function drawStoneSlab(ctx: Ctx, world: World, x: number, y: number, level: number, col: RGB): void {
  const c = isoToScreen(x + 0.5, y + 0.5, level);
  ctx.fillStyle = css(shade(col, 1.07), 0.9);
  const s = 0.3;
  const pts = [
    isoToScreen(x + s, y + s * 0.9, level),
    isoToScreen(x + 1 - s * 0.7, y + s * 0.75, level),
    isoToScreen(x + 1 - s * 0.85, y + 1 - s, level),
    isoToScreen(x + s * 0.75, y + 1 - s * 0.75, level),
  ];
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = css(shade(col, 0.68), 0.3);
  ctx.lineWidth = 1.1;
  ctx.stroke();
  // Плиты сшиваются с такими же соседями в общее полотно: перемычки
  // кромки кромкой, шов уходит под зерно — дорожка выглядит выложенной
  // за один проход, а не отдельными квадратиками.
  for (const [dx, dy] of ROAD_CARD) {
    const n = world.at(x + dx, y + dy);
    if (!n || n.water || n.ground !== 'stone' || n.level !== level || n.indoor || n.veranda) continue;
    ribbonQuad(ctx, c, isoToScreen(x + 0.5 + dx * 0.62, y + 0.5 + dy * 0.62, level), TILE_W * 0.17, TILE_W * 0.17);
  }
  granulate(ctx, c.x, c.y, TILE_W * 0.22, TILE_H * 0.22, shade(col, 0.74), x * 29 + y, 8, 0.09);
}

function drawTatami(ctx: Ctx, x: number, y: number, level: number, atm: Atmosphere): void {
  const base = shade(mix({ r: 218, g: 205, b: 158 }, atm.lightTint, atm.lightAmount * 0.7), atm.exposure);
  tilePath(ctx, x, y, level, 0.02);
  ctx.fillStyle = css(base, 1);
  ctx.fill();
  const horiz = (x + y) % 2 === 0;
  ctx.strokeStyle = css(shade(base, 0.92), 0.28);
  ctx.lineWidth = 1;
  for (let i = 1; i < 7; i++) {
    const t = i / 7;
    const p0 = horiz ? isoToScreen(x + t, y, level) : isoToScreen(x, y + t, level);
    const p1 = horiz ? isoToScreen(x + t, y + 1, level) : isoToScreen(x + 1, y + t, level);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
  // тканевая кайма только по краю комнаты
  ctx.strokeStyle = css(shade({ r: 96, g: 80, b: 60 }, atm.exposure), 0.22);
  ctx.lineWidth = 1.6;
  tilePath(ctx, x, y, level, -0.02);
  ctx.stroke();
}

function drawDeck(ctx: Ctx, x: number, y: number, level: number, atm: Atmosphere): void {
  const base = shade(mix({ r: 178, g: 138, b: 96 }, atm.lightTint, atm.lightAmount * 0.7), atm.exposure);
  tilePath(ctx, x, y, level, 0.02);
  ctx.fillStyle = css(base, 1);
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    const t = i / 5;
    const p0 = isoToScreen(x + t, y, level);
    const p1 = isoToScreen(x + t, y + 1, level);
    const k = 0.9 + hash2(x + i, y, 61) * 0.18;
    ctx.strokeStyle = css(shade(base, k), 0.5);
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
  const c = isoToScreen(x + 0.5, y + 0.5, level);
  granulate(ctx, c.x, c.y, TILE_W * 0.35, TILE_H * 0.3, shade(base, 0.72), x * 7 + y * 3, 8, 0.07);
}

function drawTileSides(ctx: Ctx, world: World, x: number, y: number, t: Tile, atm: Atmosphere): void {
  const south = world.at(x, y + 1);
  const east = world.at(x + 1, y);
  const baseCol = groundColor(t.ground === 'water' ? 'soil' : t.ground, atm);

  const drawSide = (nb: Tile | null, dir: 'south' | 'east') => {
    const nbLevel = nb ? nb.level : -1;
    const drop = t.level - nbLevel;
    if (drop <= 0) return;
    // Вода на воду: не рисуем земляную стенку — её закроет занавес водопада.
    // Иначе каскад выглядит кубично: земляные кубы с синей крышкой.
    if (t.water && nb?.water) return;
    const hpx = drop * LEVEL_H;
    const p0 = dir === 'south' ? isoToScreen(x - 0.02, y + 1, t.level) : isoToScreen(x + 1, y - 0.02, t.level);
    const p1 = dir === 'south' ? isoToScreen(x + 1.02, y + 1, t.level) : isoToScreen(x + 1, y + 1.02, t.level);
    // Грань, обращённая к солнцу, светлее противоположной, а не одинаково
    // тёмная весь день: утром свет слева, к вечеру — справа.
    const shadeK = dir === 'south' ? 0.74 - atm.sunDir.x * 0.1 : 0.62 + atm.sunDir.x * 0.08;
    const col = shade(mix(baseCol, atm.palette.soil, 0.5), atm.exposure * shadeK);

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    const steps = 4;
    for (let i = steps; i >= 0; i--) {
      const tt = i / steps;
      ctx.lineTo(
        lerp(p0.x, p1.x, tt),
        lerp(p0.y, p1.y, tt) + hpx + (hash2(x * 3 + i, y * 9 + (dir === 'south' ? 1 : 2), 23) - 0.5) * 5,
      );
    }
    ctx.closePath();
    ctx.fillStyle = css(col, 1);
    ctx.fill();

    if (t.ground === 'moss' || t.ground === 'grass') {
      const grassCol = shade(mix(atm.palette.grassDeep, atm.palette.moss, 0.4), atm.exposure * 0.92);
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y - 2);
      ctx.lineTo(p1.x, p1.y - 2);
      for (let i = steps; i >= 0; i--) {
        const tt = i / steps;
        ctx.lineTo(lerp(p0.x, p1.x, tt), lerp(p0.y, p1.y, tt) + 5 + hash2(i, x + y, 13) * 5);
      }
      ctx.closePath();
      ctx.fillStyle = css(grassCol, 0.9);
      ctx.fill();
    }
    granulate(
      ctx,
      (p0.x + p1.x) / 2,
      (p0.y + p1.y) / 2 + hpx * 0.5,
      TILE_W * 0.3,
      hpx * 0.4,
      col,
      x * 31 + y,
      10,
      0.11,
    );
  };

  drawSide(south, 'south');
  drawSide(east, 'east');
}

function drawWaterTop(ctx: Ctx, x: number, y: number, level: number, atm: Atmosphere): void {
  // Вода не должна проваливаться в темноту на рассвете: держим дно светлее
  // и ближе к палитре water, иначе пруд в 05:03 выглядит «в непонятно чём».
  const bottom = shade(mix(atm.palette.waterDeep, atm.palette.water, 0.55), Math.max(atm.exposure, 0.72) * 0.88);
  const surfBase = mix(atm.palette.water, bottom, 0.18);
  const surf = shade(mix(surfBase, atm.lightTint, atm.lightAmount * 0.42), Math.max(atm.exposure, 0.78));

  // Центр тайла в экране
  const cDeep = isoToScreen(x + 0.5, y + 0.5, level - 0.34);
  const cSurf = isoToScreen(x + 0.5, y + 0.5, level - 0.26);

  // Вариация глубины по шуму — вода не однотонная плита
  const deepVar = fbm(x * 0.6, y * 0.6, 2, 11);
  const surfVar = fbm(x * 0.9 + 5, y * 0.9 - 3, 2, 19);
  const bottomCol = shade(bottom, 0.96 + deepVar * 0.1);
  const surfCol = shade(surf, 0.98 + surfVar * 0.08);

  // Неровный акварельный blob — делаем крупнее, чтобы каскад не выглядел кубично:
  // соседние кляксы должны перекрываться даже при перепаде уровня.
  const seed = x * 137 + y * 73;
  const rx = TILE_W * (0.68 + hash2(x, y, 3) * 0.18);
  const ry = TILE_H * (0.68 + hash2(x, y, 7) * 0.18);

  // глубина — чуть больше и мягче
  ctx.fillStyle = css(bottomCol, 1);
  blobPath(ctx, cDeep.x, cDeep.y, rx * 1.12, ry * 1.12, seed, 0.28, 11);
  ctx.fill();

  // поверхность — почти во всю клетку, с рваным краем
  ctx.fillStyle = css(surfCol, 1);
  blobPath(ctx, cSurf.x, cSurf.y, rx * 1.02, ry * 1.02, seed + 7, 0.3, 12);
  ctx.fill();

  // лёгкая внутренняя тень у края — объём, но слабее
  const edge = hash2(x, y, 13);
  if (edge > 0.55) {
    ctx.fillStyle = css(shade(bottomCol, 0.88), 0.08 + edge * 0.05);
    blobPath(ctx, cSurf.x + (hash2(x, y, 17) - 0.5) * 8, cSurf.y + 2, rx * 0.42, ry * 0.36, seed + 13, 0.34, 8);
    ctx.fill();
  }
}

/** Ступенчатый силуэт пруда сглаживается кляксами воды на углах — без ровных ступеней. */
function roundWaterCorners(ctx: Ctx, world: World, x: number, y: number, atm: Atmosphere): void {
  const t = world.at(x, y)!;
  const lv = t.level - 0.26;
  const bottom = shade(mix(atm.palette.waterDeep, atm.palette.soil, 0.4), atm.exposure * 0.78);
  const surf = shade(mix(mix(atm.palette.water, bottom, 0.26), atm.lightTint, atm.lightAmount * 0.5), atm.exposure);
  const diag: [number, number][] = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  for (const [dx, dy] of diag) {
    const a = world.at(x + dx, y);
    const b = world.at(x, y + dy);
    const c = world.at(x + dx, y + dy);
    // внутренний угол: оба соседа — вода, диагональ — суша → заполняем плавно рваной кляксой
    if (a?.water && b?.water && c && !c.water && !c.indoor && !c.veranda) {
      const p = isoToScreen(x + 0.5 + dx * 0.62, y + 0.5 + dy * 0.62, lv);
      const seed = x * 53 + y * 11 + dx * 3 + dy;
      const r = hash2(x + dx, y + dy, 19);
      // более крупная и неровная, чем раньше
      ctx.fillStyle = css(surf, 0.92);
      blobPath(ctx, p.x, p.y, TILE_W * (0.34 + r * 0.18), TILE_H * (0.34 + r * 0.18), seed, 0.36, 10);
      ctx.fill();
    }
    // внешний угол: вода граничит с сушей по диагонали — делаем выступ, чтобы берег не был 90°
    if (a && !a.water && b && !b.water && !a.indoor && !a.veranda && !b.indoor && !b.veranda) {
      // только если этот внешний угол действительно на берегу (есть вода рядом)
      const hasWaterSide = world.at(x + dx, y)?.water || world.at(x, y + dy)?.water;
      if (!hasWaterSide) continue;
      const p = isoToScreen(x + 0.5 + dx * 0.38, y + 0.5 + dy * 0.38, lv);
      const seed = x * 71 + y * 29 + dx * 7 + dy * 11;
      ctx.fillStyle = css(surf, 0.42);
      blobPath(ctx, p.x, p.y, TILE_W * 0.18, TILE_H * 0.16, seed, 0.42, 8);
      ctx.fill();
    }
  }
}

/** Берег: неровный акварельный край — влажная полоса и рваная пена, без прямых линий. */
function drawWaterEdge(ctx: Ctx, world: World, x: number, y: number, atm: Atmosphere): void {
  const t = world.at(x, y)!;
  const level = t.level;
  const wet = shade(mix(atm.palette.soil, atm.palette.waterDeep, 0.28), atm.exposure * 0.86);
  const foam = shade(mix(atm.palette.water, { r: 255, g: 255, b: 255 }, 0.62), atm.exposure);
  const sandCol = shade(mix(atm.palette.soil, { r: 238, g: 226, b: 198 }, 0.52), atm.exposure);

  const dirs: [number, number][] = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  for (const [dx, dy] of dirs) {
    const nb = world.at(x + dx, y + dy);
    if (nb?.water) continue;
    if (nb && (nb.indoor || nb.veranda)) continue;

    const seed = x * 41 + y * 17 + (dx + 2) * 5 + (dy + 2);
    const r = hash2(x * 13 + dx, y * 7 + dy, 61);
    const r2 = hash2(x * 23 + dx * 3, y * 37 + dy * 5, 97);

    // 1) Влажная тёмная полоса на берегу — неровная клякса, заходящая на сушу
    if (r > 0.18) {
      const p = isoToScreen(x + 0.5 + dx * (0.52 + r * 0.18), y + 0.5 + dy * (0.52 + r * 0.18), nb ? nb.level : level);
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      // более крупная и рваная, чем раньше
      ctx.fillStyle = css(mix({ r: 255, g: 255, b: 255 }, wet, 0.28 + r * 0.28), 1);
      blobPath(ctx, p.x, p.y, TILE_W * (0.26 + r * 0.24), TILE_H * (0.22 + r * 0.2), seed, 0.44, 11);
      ctx.fill();
      // вторая маленькая клякса рядом — рваность
      if (r > 0.6) {
        ctx.fillStyle = css(mix({ r: 255, g: 255, b: 255 }, wet, 0.22), 1);
        blobPath(ctx, p.x + (r2 - 0.5) * 12, p.y + (r - 0.5) * 6, TILE_W * 0.14, TILE_H * 0.12, seed + 9, 0.48, 8);
        ctx.fill();
      }
      ctx.restore();
    }

    // 2) Песчаная кромка на суше — светлый акварельный наплыв, не сплошной
    if (nb && !nb.water && r > 0.32 && (nb.ground === 'sand' || hash2(x, y, 53) > 0.55)) {
      const ps = isoToScreen(x + 0.5 + dx * 0.72, y + 0.5 + dy * 0.72, nb.level);
      ctx.fillStyle = css(sandCol, 0.22 + r * 0.18);
      blobPath(ctx, ps.x, ps.y, TILE_W * (0.18 + r * 0.14), TILE_H * (0.16 + r * 0.12), seed + 21, 0.38, 9);
      ctx.fill();
    }

    // 3) Пена — рваная линия с волной + отдельные пузырьки
    const lv = level - 0.26;
    let p0, p1;
    if (dx === 0 && dy === -1) {
      p0 = isoToScreen(x, y, lv);
      p1 = isoToScreen(x + 1, y, lv);
    } else if (dx === 1) {
      p0 = isoToScreen(x + 1, y, lv);
      p1 = isoToScreen(x + 1, y + 1, lv);
    } else if (dy === 1) {
      p0 = isoToScreen(x, y + 1, lv);
      p1 = isoToScreen(x + 1, y + 1, lv);
    } else {
      p0 = isoToScreen(x, y, lv);
      p1 = isoToScreen(x, y + 1, lv);
    }
    if (r2 > 0.32) {
      const t0 = r2 * 0.32;
      const t1 = 1 - hash2(x + dx, y + dy, 43) * 0.38;
      const a0 = { x: lerp(p0.x, p1.x, t0), y: lerp(p0.y, p1.y, t0) };
      const a1 = { x: lerp(p0.x, p1.x, t1), y: lerp(p0.y, p1.y, t1) };
      // волнистая линия вместо прямой
      const mx = (a0.x + a1.x) / 2 + (hash2(x, y, 71) - 0.5) * 8;
      const my = (a0.y + a1.y) / 2 + 2.5 + (hash2(x, y, 73) - 0.5) * 4;
      ctx.strokeStyle = css(foam, 0.14 + r2 * 0.18);
      ctx.lineWidth = 1.4 + r2 * 1.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a0.x, a0.y);
      ctx.quadraticCurveTo(mx, my, a1.x, a1.y);
      ctx.stroke();
      ctx.lineCap = 'butt';

      // пузырьки пены — маленькие белые кляксы
      if (r2 > 0.68) {
        ctx.fillStyle = css(foam, 0.18);
        blobPath(ctx, mx, my - 1, 3.5 + r2 * 2, 2.2, seed + 33, 0.5, 6);
        ctx.fill();
      }
    }
  }
}

/** Анимированные блики — рисуются каждый кадр поверх кэшированного слоя. */
export function drawWaterAnimation(ctx: Ctx, world: World, atm: Atmosphere, time: number): void {
  // Блики отвечают настоящему свету: днём ярче, в золотой час вода
  // ловит низкое солнце и теплеет, ночью остаётся еле заметный лунный отсвет.
  const hi = shade(
    mix(mix(atm.palette.water, { r: 255, g: 255, b: 250 }, 0.7), { r: 255, g: 212, b: 148 }, atm.golden * 0.55),
    atm.exposure,
  );
  const glintK = 0.75 + atm.time.daylight * 0.45 + atm.golden * 0.55;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const t = world.at(x, y)!;
      if (!t.water) continue;
      const c = isoToScreen(x + 0.5, y + 0.5, t.level - 0.26);
      const ph = hash2(x, y, 7) * Math.PI * 2;
      for (let i = 0; i < 2; i++) {
        const s = Math.sin(time * 0.0009 + ph + i * 2.1);
        const a = (0.05 + 0.07 * (s * 0.5 + 0.5)) * glintK;
        const ox = Math.sin(time * 0.0006 + ph + i) * 11;
        const oy = Math.cos(time * 0.0005 + ph * 1.3) * 3;
        ctx.strokeStyle = css(hi, a);
        ctx.lineWidth = 1.7;
        ctx.beginPath();
        ctx.moveTo(c.x - 17 + ox, c.y + oy + i * 8 - 5);
        ctx.quadraticCurveTo(c.x + ox, c.y + oy + i * 8 - 1.5, c.x + 17 + ox, c.y + oy + i * 8 - 5);
        ctx.stroke();
      }
      const rp = clamp01(Math.sin(time * 0.0012 + ph) * 0.5 + 0.5);
      ctx.fillStyle = css(hi, 0.04 * rp * glintK);
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, TILE_W * 0.3, TILE_H * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
