import { plantPose, windLag } from './plantWind';
import { CALM, type WindSampler } from '../world/wind';
import { drawFruitFall } from './fruitFall';
import { drawLizard } from './lizard';
import { ecologyYear, wildlifeActivity } from '../world/ecology';
import { spriteSway } from './spriteCache';
import { rainMaterial, drawSmallHouseDrips, type RainField } from './afterRain';
import type { WeatherState } from '../world/weatherState';
import { paintObjectLight } from './spriteCache';
import { sampleLocalLight, receivesObjectLight, type LocalLightField } from './localLight';
/**
 * Шаги отрисовки сцены — чистые функции над контекстом холста.
 *
 * Порядок и обоснования слоёв остаются в Scene.render; здесь — сами мазки:
 * небо и горы, тень-подложка, строительная сетка, призрак и подсветки,
 * сортированные объекты, свечение окон, зерно бумаги и цветокоррекция.
 */

import { GRID, TILE_H, TILE_W, isoToScreen } from '../core/iso';
import { clamp01, hash2, lerp } from '../core/rng';
import { ITEM_BY_ID } from '../world/catalog';
import { Atmosphere, RGB, css, mix, shade } from '../world/palette';
import { PlacedObject } from '../world/types';
import { World } from '../world/world';
import { Ctx, getPaperTile, glow } from './paint';
import { drawCost, drawObject, drawObjectShadow } from './sprites';
import { cacheable, cachedGrowth, drawCached } from './spriteCache';
import { drawBird, drawButterfly, drawCat } from './creatures';
import { drawDragonfly, drawFrog } from './residents';
import {
  drawBee,
  drawDeer,
  drawFirefly,
  drawHedgehog,
  drawHeron,
  drawMoth,
  drawMouse,
  drawOwl,
  drawSquirrel,
  drawTurtle,
} from './wildlife';
import type { GhostPreview } from './scene';
import type { WaterMotion } from './waterMotion';
import { waterSurfaces, waterSurfacePath, waterSurfaceBounds } from './waterSurface';

/** Наборка состояния сцены, нужная одному кадру сортированных объектов. */
export interface ObjectsOpts {
  life: import('../world/life').Life | null;
  wind: number;
  zoom: number;
  camX: number;
  camY: number;
  viewW: number;
  viewH: number;
  movingId: number;
  highlightId: number;
  useSpriteCache: boolean;
  particles: boolean;
  motion?: boolean;
  windField?: WindSampler;
  simpleWind?: boolean;
  waterMotion?: WaterMotion;
  localLights?: LocalLightField;
  rainReceivers?: RainField;
  rainWeather?: WeatherState;
}

/**
 * Положение солнца на экране.
 *
 * Дуга держится в полосе неба, которое реально видно в типичном кадре:
 * остров-ромб закрывает середины высот, дом — верхнюю середину, а открыты
 * левый и правый верхние углы. Поэтому светило поднимается лишь до
 * ~0.08H в полдень и опускается к ~0.34H у горизонта — утром оно слева,
 * вечером справа, и его правда видно, а не прячется за садом, как было
 * с прежней дугой (0.62H − sin·0.52H: диск всегда оказывался за островом
 * или крышей, и закат в кадре не существовал).
 * elev — высота солнца 0..1, та же, что в worlds/palette (тени по ней).
 */
export function sunScreenPos(W: number, H: number, dayT: number): { x: number; y: number; elev: number } {
  const sunT = clamp01((dayT - 0.22) / 0.58);
  const elev = Math.sin(sunT * Math.PI);
  return { x: W * (0.06 + sunT * 0.88), y: H * (0.34 - elev * 0.26), elev };
}

export function drawSky(ctx: Ctx, W: number, H: number, atm: Atmosphere, time: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, css(atm.skyTop, 1));
  g.addColorStop(0.5, css(mix(atm.skyTop, atm.skyBottom, 0.7), 1));
  g.addColorStop(1, css(atm.skyBottom, 1));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Солнце / луна
  //
  // Дуга поднята выше, чем «настоящая»: раньше низкое солнце садилось за
  // середину сада — остров закрывал диск как раз в тот момент, когда
  // должен читаться закат. Теперь «горизонт» проходит по видимой полосе
  // неба над дальним краем острова, и рассвет с закатом видно целиком.
  const t = atm.time;
  const isDay = t.dayT > 0.2 && t.dayT < 0.84;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (isDay) {
    const sun = sunScreenPos(W, H, t.dayT);
    const sunT = clamp01((t.dayT - 0.22) / 0.58);
    // У горизонта солнце крупнее и гуще — закатное ярмо, а не солнечный зайчик.
    // Ореол скромный, а диск кладём обычной кистью поверх неба и ореола
    // насыщенным цветом: «lighter» на светлом небе вырождается в белое
    // пятно, а закатное солнце должно быть янтарным, как лампа.
    const warm = mix({ r: 255, g: 240, b: 198 }, { r: 255, g: 152, b: 78 }, atm.golden);
    const rr = 22 + atm.golden * 18;
    glow(ctx, sun.x, sun.y, 150 + atm.golden * 110, warm, 0.32 + atm.golden * 0.22);
    const disc = mix(warm, { r: 255, g: 150, b: 74 }, atm.golden * 0.85);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = css(mix(disc, { r: 255, g: 252, b: 236 }, 0.22 * (1 - atm.golden)), 0.95);
    // у самого горизонта диск сплющивается — солнце «садится за горизонт»
    const edge = Math.min(1, Math.min(sunT, 1 - sunT) / 0.09);
    ctx.save();
    ctx.translate(sun.x, sun.y);
    ctx.scale(1, 0.6 + 0.4 * edge);
    ctx.beginPath();
    ctx.arc(0, 0, rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else {
    const nightT = t.dayT < 0.2 ? (t.dayT + 0.16) / 0.36 : (t.dayT - 0.84 + 0.16) / 0.36;
    // Луна держится той же видимой полосы неба, что и солнце днём
    const mx = W * (0.08 + clamp01(nightT) * 0.84);
    const my = H * (0.32 - Math.sin(clamp01(nightT) * Math.PI) * 0.22);
    const moon: RGB = { r: 238, g: 242, b: 226 };
    glow(ctx, mx, my, 130, moon, 0.35);
    ctx.fillStyle = css(moon, 0.8);
    ctx.beginPath();
    ctx.arc(mx, my, 19, 0, Math.PI * 2);
    ctx.fill();
    // лёгкий серп-тень
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = css(atm.skyTop, 0.55);
    ctx.beginPath();
    ctx.arc(mx - 8, my - 4, 17, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Звёзды
  if (t.daylight < 0.35) {
    const a = (1 - t.daylight / 0.35) * 0.85;
    for (let i = 0; i < 70; i++) {
      const sx = hash2(i, 3, 5) * W;
      const sy = hash2(i, 7, 9) * H * 0.62;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(time * 0.001 + i));
      ctx.fillStyle = css({ r: 255, g: 253, b: 240 }, a * tw * (0.3 + hash2(i, 11, 13) * 0.7));
      ctx.beginPath();
      ctx.arc(sx, sy, 0.6 + hash2(i, 13, 17) * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Облака — мягкие акварельные полосы
  const cloudCol = mix({ r: 255, g: 252, b: 246 }, atm.skyBottom, 0.35);
  for (let i = 0; i < 5; i++) {
    const seed = hash2(i, 21, 3);
    const speed = 0.0018 + seed * 0.0022;
    const cx = ((time * speed + seed * 2000) % (W + 600)) - 300;
    const cy = H * (0.06 + seed * 0.3);
    const sc = 0.6 + seed * 0.9;
    ctx.save();
    ctx.globalAlpha = (0.14 + seed * 0.16) * (0.4 + atm.time.daylight * 0.8);
    ctx.fillStyle = css(cloudCol, 1);
    for (let k = 0; k < 5; k++) {
      const kx = cx + (k - 2) * 62 * sc + hash2(i, k, 5) * 30;
      const ky = cy + (hash2(i, k, 9) - 0.5) * 22;
      ctx.beginPath();
      ctx.ellipse(kx, ky, (58 + hash2(i, k, 11) * 46) * sc, (16 + hash2(i, k, 13) * 12) * sc, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Далёкие горы — силуэты на горизонте
  drawMountains(ctx, W, H, atm);
}

export function drawMountains(ctx: Ctx, W: number, H: number, atm: Atmosphere): void {
  const horizon = H * 0.58;
  const layers = 3;
  for (let l = layers - 1; l >= 0; l--) {
    const depth = l / (layers - 1);
    const col = mix(
      mix(atm.palette.foliageDeep, atm.skyBottom, 0.55 + depth * 0.32),
      atm.lightTint,
      atm.lightAmount * 0.5,
    );
    ctx.fillStyle = css(shade(col, atm.exposure * (0.8 + depth * 0.15)), 0.5 - depth * 0.16);
    ctx.beginPath();
    ctx.moveTo(-50, H);
    const baseY = horizon - (1 - depth) * 60;
    ctx.lineTo(-50, baseY);
    const peaks = 7 + l * 3;
    for (let i = 0; i <= peaks; i++) {
      const t = i / peaks;
      const x = -50 + t * (W + 100);
      const n = hash2(i * 3 + l * 17, l * 7, 23);
      const n2 = hash2(i * 5 + l, l * 11, 31);
      const y = baseY - n * (90 - depth * 45) - n2 * 24;
      const px = x - (W + 100) / peaks / 2;
      ctx.quadraticCurveTo(px, y + 18, x, y);
    }
    ctx.lineTo(W + 50, baseY);
    ctx.lineTo(W + 50, H);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * Воздушная перспектива: дальний край острова тонет в бумажной пелене.
 *
 * Ось глубины изометрии — мировая ось Y (tx+ty), поэтому пелена — просто
 * вертикальный градиент в мировых координатах поверх земли и объектов.
 * Ближний край остаётся чистым, дальний светлеет и теряет контраст —
 * кадр перестаёт читаться как карта, появляется воздух. Цвет пелены
 * следует за небом и часом: днём — тёплая бумага, в золотой час — охра,
 * ночью — холодная синева.
 */
export function drawAerialPerspective(ctx: Ctx, atm: Atmosphere): void {
  const cFar = isoToScreen(0, 0);
  const cNear = isoToScreen(GRID, GRID);
  const yFar = cFar.y - TILE_H * 2.2;
  const yNear = cNear.y + TILE_H * 1.2;
  const paper: RGB = { r: 247, g: 244, b: 234 };
  let hazeCol = mix(atm.skyBottom, paper, 0.55);
  hazeCol = mix(hazeCol, { r: 244, g: 208, b: 158 }, atm.golden * 0.5);
  const maxA = Math.min(0.22, lerp(0.025, 0.065, atm.time.daylight) + atm.golden * 0.04 + atm.overcast * 0.1);
  if (maxA < 0.02) return;

  const g = ctx.createLinearGradient(0, yFar, 0, yNear);
  g.addColorStop(0, css(hazeCol, maxA));
  g.addColorStop(0.45, css(hazeCol, maxA * 0.3));
  g.addColorStop(0.7, css(hazeCol, 0));
  g.addColorStop(1, css(hazeCol, 0));
  ctx.save();
  ctx.fillStyle = g;
  const halfW = (GRID * TILE_W) / 2 + 500;
  ctx.fillRect(-halfW, yFar, halfW * 2, yNear - yFar);
  ctx.restore();
}

export function drawIslandShadow(ctx: Ctx, atm: Atmosphere): void {
  const c0 = isoToScreen(0, 0);
  const c1 = isoToScreen(GRID, GRID);
  const cx = (c0.x + c1.x) / 2;
  const cy = (c0.y + c1.y) / 2 + 30;
  const rx = (GRID * TILE_W) / 2 + 70;
  const ry = (GRID * TILE_H) / 2 + 55;
  const col = mix(atm.shadowTint, { r: 40, g: 40, b: 50 }, 0.3);
  // Градиент после сдвига: координаты градиента преобразуются матрицей в
  // момент отрисовки, и градиент, созданный до translate, уезжал вдвое
  // дальше по кадру — подложка под островом не рисовалась вовсе.
  // Начинаем спад близко к краю: широкое тёмное поле вокруг сада читалось
  // как грязь, а узкая мягкая кромка лишь отделяет остров от листа.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, rx * 0.72, 0, 0, rx);
  g.addColorStop(0, css(col, 0.16));
  g.addColorStop(0.55, css(col, 0.1));
  g.addColorStop(1, css(col, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawGrid(ctx: Ctx, world: World, atm: Atmosphere, zoom: number): void {
  ctx.save();
  ctx.lineWidth = 1 / zoom;
  const col = mix(atm.lightTint, { r: 255, g: 255, b: 255 }, 0.5);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const t = world.at(x, y)!;
      const a = isoToScreen(x, y, t.level);
      const b = isoToScreen(x + 1, y, t.level);
      const c = isoToScreen(x + 1, y + 1, t.level);
      const d = isoToScreen(x, y + 1, t.level);
      ctx.strokeStyle = css(col, 0.13);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawObjectMarker(
  ctx: Ctx,
  cx: number,
  cy: number,
  lvl: number,
  strong: boolean,
  time: number,
  zoom: number,
): void {
  const p = isoToScreen(cx, cy, lvl);
  const pulse = 0.6 + Math.sin(time * 0.005) * 0.2;
  const col: RGB = strong ? { r: 250, g: 244, b: 216 } : { r: 236, g: 206, b: 138 };
  ctx.save();
  ctx.strokeStyle = css(col, (strong ? 0.75 : 0.5) * pulse);
  ctx.lineWidth = 1.8 / zoom;
  ctx.setLineDash([5 / zoom, 4 / zoom]);
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, TILE_W * 0.42, TILE_H * 0.42, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = css(col, 0.14 * pulse);
  ctx.fill();
  ctx.restore();
}

export function drawPathPreview(
  ctx: Ctx,
  world: World,
  time: number,
  pathFrom: { x: number; y: number } | null,
  pathPreview: { x: number; y: number }[] | null,
  zoom: number,
): void {
  const pulse = 0.6 + Math.sin(time * 0.005) * 0.2;
  const col: RGB = { r: 248, g: 242, b: 214 };

  // Отметка начала — кружок, чтобы было видно, откуда ведём
  if (pathFrom) {
    const t = world.at(pathFrom.x, pathFrom.y);
    const p = isoToScreen(pathFrom.x + 0.5, pathFrom.y + 0.5, t ? t.level : 0);
    ctx.save();
    ctx.strokeStyle = css(col, 0.8 * pulse);
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, TILE_W * 0.26, TILE_H * 0.26, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const cells = pathPreview;
  if (!cells || cells.length < 2) return;

  ctx.save();
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const t = world.at(c.x, c.y);
    const p = isoToScreen(c.x + 0.5, c.y + 0.5, t ? t.level : 0);
    // След тем ярче, чем ближе к началу — видно направление
    const k = 1 - (i / cells.length) * 0.45;
    ctx.fillStyle = css(col, 0.3 * pulse * k);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, TILE_W * 0.3, TILE_H * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawGhost(
  ctx: Ctx,
  world: World,
  atm: Atmosphere,
  time: number,
  ghost: GhostPreview,
  wind: number,
  zoom: number,
  windField?: WindSampler,
  simpleWind = false,
): void {
  const gh = ghost;
  const pulse = 0.55 + Math.sin(time * 0.004) * 0.15;
  const okCol: RGB = { r: 246, g: 240, b: 214 };
  const badCol: RGB = { r: 226, g: 130, b: 110 };
  const col = gh.valid ? okCol : badCol;

  // Подсветка занимаемых клеток — по настоящему отпечатку с поворотом
  const hx0 = gh.hl ? gh.hl.x0 : Math.floor(gh.tx);
  const hy0 = gh.hl ? gh.hl.y0 : Math.floor(gh.ty);
  const hx1 = gh.hl ? gh.hl.x1 : Math.floor(gh.tx) + gh.w - 1;
  const hy1 = gh.hl ? gh.hl.y1 : Math.floor(gh.ty) + gh.h - 1;
  for (let y = hy0; y <= hy1; y++) {
    for (let x = hx0; x <= hx1; x++) {
      const t = world.at(x, y);
      const lvl = t ? t.level : 0;
      const a = isoToScreen(x, y, lvl);
      const b = isoToScreen(x + 1, y, lvl);
      const c = isoToScreen(x + 1, y + 1, lvl);
      const d = isoToScreen(x, y + 1, lvl);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fillStyle = css(col, 0.2 * pulse);
      ctx.fill();
      // Тёмная подложка под светлым контуром: ночью и на снегу одна
      // светлая линия сливается с фоном и метку под пальцем не видно.
      ctx.strokeStyle = css({ r: 30, g: 24, b: 18 }, 0.34 * pulse);
      ctx.lineWidth = 3.2 / zoom;
      ctx.stroke();
      ctx.strokeStyle = css(col, 0.85 * pulse);
      ctx.lineWidth = 1.6 / zoom;
      ctx.stroke();
    }
  }

  // Призрак самого объекта
  if (gh.kind === 'item' && gh.itemId) {
    const item = ITEM_BY_ID.get(gh.itemId);
    if (item) {
      const t = world.at(Math.floor(gh.tx), Math.floor(gh.ty));
      const lvl = t ? t.level : 0;
      const p = isoToScreen(gh.tx + item.w / 2, gh.ty + item.h / 2, lvl);
      const fake: PlacedObject = {
        id: -1,
        type: gh.itemId,
        tx: gh.tx,
        ty: gh.ty,
        planted: Date.now(),
        rot: gh.rot,
        seed: 777,
      };
      const vector = windField?.(gh.tx + item.w / 2, gh.ty + item.h / 2, windLag(gh.itemId));
      const ghostGrowth = world.growth(fake, Date.now());
      drawObject({
        ctx,
        x: p.x,
        y: p.y,
        atm,
        g: ghostGrowth,
        obj: fake,
        time,
        wind: vector?.screenX ?? wind,
        windVector: vector,
        plantPose: vector ? plantPose(gh.itemId, 777, cachedGrowth(ghostGrowth), time, vector, simpleWind) : undefined,
        alpha: gh.valid ? 0.62 : 0.3,
      });
    }
  }
}

export function drawObjects(ctx: Ctx, world: World, atm: Atmosphere, time: number, opts: ObjectsOpts): void {
  const now = Date.now();
  // Единый список: статичные объекты и живность сортируются вместе,
  // иначе кот будет проходить «сквозь» дерево.
  type Entry = { depth: number; draw: () => void };
  const list: Entry[] = [];

  for (const o of world.objects) {
    const item = ITEM_BY_ID.get(o.type);
    if (!item) continue;
    // кот и карпы рисуются системой жизни, а не как статичные предметы
    if (o.type === 'cat' || o.type === 'koi') continue;
    const cx = o.tx + item.w / 2;
    const cy = o.ty + item.h / 2;
    const tile = world.at(Math.floor(cx), Math.floor(cy));
    const lvl = tile ? (tile.water ? tile.level - 0.28 : tile.level) : 0;
    const p = isoToScreen(cx, cy, lvl);
    const s = { x: (p.x - opts.camX) * opts.zoom + opts.viewW / 2, y: (p.y - opts.camY) * opts.zoom + opts.viewH / 2 };
    const marginX = Math.max(240, 230 * opts.zoom),
      marginY = Math.max(280, 320 * opts.zoom);
    if (s.x < -marginX || s.x > opts.viewW + marginX || s.y < -marginY || s.y > opts.viewH + marginY) continue;

    // На общем плане мелочь не читается: подушка мха размером в три
    // пикселя стоит столько же, сколько вблизи, но её попросту не видно.
    // На телефоне сад по умолчанию показан целиком, так что это
    // основной режим просмотра, а не редкий случай.
    if (
      opts.zoom < 0.42 &&
      o.id !== opts.movingId &&
      o.id !== opts.highlightId &&
      (item.kind === 'micro' || item.kind === 'flower')
    )
      continue;
    const g = world.growth(o, now);
    // ветер берём в точке дерева — порыв проходит волной
    const air = opts.windField?.(cx, cy, windLag(o.type));
    const vector = opts.motion === false ? CALM : air;
    const pose = vector ? plantPose(o.type, o.seed, cachedGrowth(g), time, vector, opts.simpleWind) : undefined;
    const wind = opts.motion === false ? 0 : air ? air.screenX : opts.life ? opts.life.windAt(cx, cy) : opts.wind;
    const localHits =
      opts.localLights && receivesObjectLight(o.type) ? sampleLocalLight(opts.localLights, cx, cy, lvl, o.id) : [];
    const materialAtm = rainMaterial(atm, opts.rainReceivers, opts.rainWeather, o.type, cx, cy);
    const isMoving = o.id === opts.movingId;
    const isHot = o.id === opts.highlightId;
    // Переносимое слегка всплывает над землёй — видно, что оно «в руке»
    const lift = isMoving ? 9 + Math.sin(time * 0.006) * 1.6 : 0;
    list.push({
      depth: (cx + cy) * 100 + lvl * 20,
      draw: () => {
        if (isMoving || isHot) drawObjectMarker(ctx, cx, cy, lvl, isMoving, time, opts.zoom);

        // Дорогие неподвижные объекты идём через кэш спрайтов: дерево
        // стоит 638 мкс, и перерисовывать его каждый кадр незачем —
        // меняется только покачивание, а его даёт сдвиг при копировании.
        const cost = drawCost(o.type);
        if (opts.useSpriteCache && cacheable(o.type, cost)) {
          // Ветер даём сдвигом готового спрайта. Формула повторяет ту,
          // что внутри makeTree: та же фаза, та же амплитуда с учётом
          // стадии роста. Ствол там качается втрое слабее кроны, поэтому
          // берём среднее — сдвиг всего спрайта мягче, чем у одной кроны.
          // Тот же огрублённый размер, что у спрайта в кэше: иначе тень
          // будет от дерева другой стадии роста, и края разойдутся.
          const gq = cachedGrowth(g);
          const sway = air ? 0 : spriteSway(o.type, o.seed, g, time, wind);
          // Тень рисуем прямо здесь: она идёт режимом multiply по земле,
          // и в прозрачном холсте кэша ей не на что умножаться.
          drawObjectShadow({
            ctx,
            x: p.x,
            y: p.y,
            atm: materialAtm,
            g: gq,
            obj: o,
            time,
            wind,
            plantPose: pose,
            windVector: vector,
            alpha: isMoving ? 0.72 : 1,
          });
          const drawn = drawCached({
            ctx,
            x: p.x + sway,
            y: p.y - lift,
            atm: materialAtm,
            g,
            obj: o,
            time,
            wind,
            plantPose: pose,
            windVector: vector,
            alpha: isMoving ? 0.72 : 1,
          });
          if (drawn) {
            paintObjectLight(
              {
                ctx,
                x: p.x + sway,
                y: p.y - lift,
                atm: materialAtm,
                g,
                obj: o,
                time,
                wind,
                plantPose: pose,
                windVector: vector,
                alpha: isMoving ? 0.72 : 1,
              },
              localHits,
            );
            if (opts.particles && !isMoving)
              drawSmallHouseDrips({ ctx, x: p.x, y: p.y, atm, g, obj: o, time, wind, alpha: 1 }, opts.rainWeather);
            if (opts.particles && !isMoving)
              drawFruitFall({ ctx, x: p.x, y: p.y, atm, g, obj: o, time, wind, plantPose: pose, alpha: 1 }, world);
            return;
          }
        }

        drawObject({
          ctx,
          x: p.x,
          y: p.y - lift,
          atm: materialAtm,
          g,
          obj: o,
          time,
          wind,
          plantPose: pose,
          windVector: vector,
          alpha: isMoving ? 0.72 : 1,
        });
        paintObjectLight(
          {
            ctx,
            x: p.x,
            y: p.y - lift,
            atm: materialAtm,
            g,
            obj: o,
            time,
            wind,
            plantPose: pose,
            windVector: vector,
            alpha: isMoving ? 0.72 : 1,
          },
          localHits,
          false,
        );
        if (opts.particles && !isMoving)
          drawSmallHouseDrips({ ctx, x: p.x, y: p.y, atm, g, obj: o, time, wind, alpha: 1 }, opts.rainWeather);
        if (opts.particles && !isMoving)
          drawFruitFall({ ctx, x: p.x, y: p.y, atm, g, obj: o, time, wind, plantPose: pose, alpha: 1 }, world);
      },
    });
  }

  list.push(...animalEntries(ctx, world, atm, time, opts));

  list.sort((a, b) => a.depth - b.depth);
  for (const e of list) e.draw();
}

interface AnimalEntry {
  alt?: number;
  tx: number;
  ty: number;
  level: number;
  depth: number;
  draw: () => void;
}

/** One source of poses/altitudes/visibility for the animal and its reflection. */
function animalEntries(ctx: Ctx, world: World, atm: Atmosphere, time: number, opts: ObjectsOpts): AnimalEntry[] {
  const list: AnimalEntry[] = [];
  const activity = wildlifeActivity(atm.time, opts.rainWeather, opts.wind);
  const seasonalDraw = (amount: number, paint: () => void) => {
    ctx.save();
    ctx.globalAlpha *= amount;
    paint();
    ctx.restore();
  };
  if (opts.life) {
    for (const c of opts.life.cats) {
      const tile = world.at(Math.floor(c.tx), Math.floor(c.ty));
      const lvl = tile ? tile.level : 0;
      const p = isoToScreen(c.tx, c.ty, lvl);
      list.push({
        tx: c.tx,
        ty: c.ty,
        level: lvl,
        depth: (c.tx + c.ty) * 100 + lvl * 20 + 4,
        draw: () => drawCat(ctx, c, p.x, p.y, atm, time),
      });
    }
    for (const b of opts.life.birds) {
      const tile = world.at(Math.floor(b.tx), Math.floor(b.ty));
      const lvl = tile ? tile.level : 0;
      const p = isoToScreen(b.tx, b.ty, lvl);
      list.push({
        tx: b.tx,
        ty: b.ty,
        level: lvl,
        depth: (b.tx + b.ty) * 100 + lvl * 20 + 6,
        alt: b.alt,
        draw: () => drawBird(ctx, b, p.x, p.y, atm, time),
      });
    }
    // бабочки — тоже частицы
    for (const f of opts.particles ? opts.life.flutters : []) {
      if (activity.butterflies <= 0.001) continue;
      const tile = world.at(Math.floor(f.tx), Math.floor(f.ty));
      const lvl = tile ? (tile.water ? tile.level - 0.26 : tile.level) : 0;
      const p = isoToScreen(f.tx, f.ty, lvl);
      list.push({
        tx: f.tx,
        ty: f.ty,
        level: lvl,
        depth: (f.tx + f.ty) * 100 + lvl * 20 + 8,
        alt: f.alt,
        draw: () => seasonalDraw(activity.butterflies, () => drawButterfly(ctx, f, p.x, p.y, atm, time)),
      });
    }
    // Жители воды: на общем плане их не разглядеть, а рисовать всё равно
    // пришлось бы — поэтому на дальнем виде бережём кадр.
    if (opts.zoom >= 0.42) {
      for (const fr of opts.life.residents.frogs) {
        if (activity.frogs <= 0.001) continue;
        if (fr.hidden > 0) continue;
        const tile = world.at(Math.floor(fr.tx), Math.floor(fr.ty));
        const lvl = tile ? tile.level : 0;
        const p = isoToScreen(fr.tx, fr.ty, lvl);
        list.push({
          tx: fr.tx,
          ty: fr.ty,
          level: lvl,
          depth: (fr.tx + fr.ty) * 100 + lvl * 20 + 5,
          draw: () => seasonalDraw(activity.frogs, () => drawFrog(ctx, fr, p.x, p.y, atm, time)),
        });
      }
      for (const d of opts.particles ? opts.life.residents.dragonflies : []) {
        if (activity.dragonflies <= 0.001) continue;
        const tile = world.at(Math.floor(d.tx), Math.floor(d.ty));
        const lvl = tile ? (tile.water ? tile.level - 0.26 : tile.level) : 0;
        const p = isoToScreen(d.tx, d.ty, lvl);
        list.push({
          tx: d.tx,
          ty: d.ty,
          level: lvl,
          depth: (d.tx + d.ty) * 100 + lvl * 20 + 9,
          alt: d.alt,
          draw: () => seasonalDraw(activity.dragonflies, () => drawDragonfly(ctx, d, p.x, p.y, atm, time)),
        });
      }
    }
    // Коты-гости: те же позы, что у домашних, но своя шуба
    for (const c of opts.life.guests) {
      const tile = world.at(Math.floor(c.tx), Math.floor(c.ty));
      const lvl = tile ? tile.level : 0;
      const p = isoToScreen(c.tx, c.ty, lvl);
      list.push({
        tx: c.tx,
        ty: c.ty,
        level: lvl,
        depth: (c.tx + c.ty) * 100 + lvl * 20 + 4,
        draw: () => drawCat(ctx, c, p.x, p.y, atm, time),
      });
    }
    // Дикие соседи: цапля и олень крупные — видны и с общего плана
    const hr = opts.life.wildlife.heron;
    if (hr) {
      const tile = world.at(Math.floor(hr.tx), Math.floor(hr.ty));
      const lvl = tile ? (tile.water ? tile.level - 0.26 : tile.level) : 0;
      const p = isoToScreen(hr.tx, hr.ty, lvl);
      list.push({
        tx: hr.tx,
        ty: hr.ty,
        level: lvl,
        depth: (hr.tx + hr.ty) * 100 + lvl * 20 + 6,
        draw: () => drawHeron(ctx, hr, p.x, p.y, atm, time),
      });
    }
    for (const d of opts.life.wildlife.deer) {
      const tile = world.at(Math.floor(d.tx), Math.floor(d.ty));
      const lvl = tile ? tile.level : 0;
      const p = isoToScreen(d.tx, d.ty, lvl);
      list.push({
        tx: d.tx,
        ty: d.ty,
        level: lvl,
        depth: (d.tx + d.ty) * 100 + lvl * 20 + 5,
        draw: () => drawDeer(ctx, d, p.x, p.y, atm, time),
      });
    }
    if (opts.zoom >= 0.42 && activity.lizard > 0.001) {
      for (const a of opts.life.lizards.agents) {
        if (a.alpha <= 0.005) continue;
        const tile = world.at(Math.floor(a.tx), Math.floor(a.ty));
        if (!tile || tile.water || tile.indoor || tile.veranda) continue;
        const p = isoToScreen(a.tx, a.ty, tile.level);
        list.push({
          tx: a.tx,
          ty: a.ty,
          level: tile.level,
          alt: a.lift,
          depth: (a.tx + a.ty) * 100 + tile.level * 20 + 14,
          draw: () => seasonalDraw(activity.lizard, () => drawLizard(ctx, a, p.x, p.y - a.lift, atm, time)),
        });
      }
    }
    // Ёжик и мышка — видны при приближении (0.5+), но и на общем плане как точки
    if (opts.zoom >= 0.42) {
      for (const e of opts.life.wildlife.hedgehogs) {
        if (activity.hedgehog <= 0.001) continue;
        const tile = world.at(Math.floor(e.tx), Math.floor(e.ty));
        const lvl = tile ? tile.level : 0;
        const p = isoToScreen(e.tx, e.ty, lvl);
        list.push({
          tx: e.tx,
          ty: e.ty,
          level: lvl,
          depth: (e.tx + e.ty) * 100 + lvl * 20 + 12,
          draw: () => seasonalDraw(activity.hedgehog, () => drawHedgehog(ctx, e, p.x, p.y, atm, time)),
        });
      }
      for (const m of opts.life.wildlife.mice) {
        const tile = world.at(Math.floor(m.tx), Math.floor(m.ty));
        const lvl = tile ? tile.level : 0;
        const p = isoToScreen(m.tx, m.ty, lvl);
        list.push({
          tx: m.tx,
          ty: m.ty,
          level: lvl,
          depth: (m.tx + m.ty) * 100 + lvl * 20 + 12,
          draw: () => drawMouse(ctx, m, p.x, p.y, atm, time),
        });
      }
      for (const o of opts.life.wildlife.owls) {
        const tile = world.at(Math.floor(o.tx), Math.floor(o.ty));
        const lvl = tile ? tile.level : 0;
        const p = isoToScreen(o.tx, o.ty, lvl);
        // Сова на ветке должна быть поверх кроны, иначе сидит ПОД деревом
        list.push({
          tx: o.tx,
          ty: o.ty,
          level: lvl,
          depth: (o.tx + o.ty) * 100 + lvl * 20 + 180,
          draw: () => drawOwl(ctx, o, p.x, p.y, atm, time),
        });
      }
      for (const sq of opts.life.wildlife.squirrels) {
        const tile = world.at(Math.floor(sq.tx), Math.floor(sq.ty));
        const lvl = tile ? tile.level : 0;
        const p = isoToScreen(sq.tx, sq.ty, lvl);
        list.push({
          tx: sq.tx,
          ty: sq.ty,
          level: lvl,
          depth: (sq.tx + sq.ty) * 100 + lvl * 20 + 12,
          draw: () => drawSquirrel(ctx, sq, p.x, p.y, atm, time),
        });
      }
      for (const tu of opts.life.wildlife.turtles) {
        if (activity.turtle <= 0.001) continue;
        const tile = world.at(Math.floor(tu.tx), Math.floor(tu.ty));
        const lvl = tile ? (tile.water ? tile.level - 0.26 : tile.level) : 0;
        const p = isoToScreen(tu.tx, tu.ty, lvl);
        list.push({
          tx: tu.tx,
          ty: tu.ty,
          level: lvl,
          depth: (tu.tx + tu.ty) * 100 + lvl * 20 + 8,
          draw: () => seasonalDraw(activity.turtle, () => drawTurtle(ctx, tu, p.x, p.y, atm, time)),
        });
      }
    }
    // Светлячки, мотыльки и пчёлы — ночная и дневная мелочь: на дальнем плане бережём кадр
    if (opts.zoom >= 0.42 && opts.particles) {
      for (const f of opts.life.wildlife.fireflies) {
        if (activity.fireflies <= 0.001) continue;
        const tile = world.at(Math.floor(f.tx), Math.floor(f.ty));
        const lvl = tile ? tile.level : 0;
        const p = isoToScreen(f.tx, f.ty, lvl);
        list.push({
          tx: f.tx,
          ty: f.ty,
          level: lvl,
          depth: (f.tx + f.ty) * 100 + lvl * 20 + 200,
          draw: () => seasonalDraw(activity.fireflies, () => drawFirefly(ctx, f, p.x, p.y, atm, time)),
        });
      }
      for (const m of opts.life.wildlife.moths) {
        if (activity.moths <= 0.001) continue;
        const tile = world.at(Math.floor(m.tx), Math.floor(m.ty));
        const lvl = tile ? tile.level : 0;
        const p = isoToScreen(m.tx, m.ty, lvl);
        list.push({
          tx: m.tx,
          ty: m.ty,
          level: lvl,
          depth: (m.tx + m.ty) * 100 + lvl * 20 + 210,
          draw: () => seasonalDraw(activity.moths, () => drawMoth(ctx, m, p.x, p.y, atm, time)),
        });
      }
      for (const b of opts.life.wildlife.bees) {
        if (activity.bees <= 0.001) continue;
        const tile = world.at(Math.floor(b.tx), Math.floor(b.ty));
        const lvl = tile ? tile.level : 0;
        const p = isoToScreen(b.tx, b.ty, lvl);
        list.push({
          tx: b.tx,
          ty: b.ty,
          level: lvl,
          depth: (b.tx + b.ty) * 100 + lvl * 20 + 220,
          alt: b.alt,
          draw: () => seasonalDraw(activity.bees, () => drawBee(ctx, b, p.x, p.y, atm, time)),
        });
      }
    }
  }

  return list;
}

/** Reflect the actual animated pose, not a second agent or a frozen icon. */
export function drawAnimalReflections(ctx: Ctx, world: World, atm: Atmosphere, time: number, opts: ObjectsOpts): void {
  if (!opts.life) return;
  // Shadows are lighting on the shore, not part of an animal's reflected body.
  const entries = animalEntries(ctx, world, { ...atm, shadowAmount: 0, exposure: atm.exposure * 0.55 }, time, opts);
  if (!entries.length) return;
  entries.sort((a, b) => a.depth - b.depth);
  for (const surface of waterSurfaces(world)) {
    const { minX, maxX, minY, maxY } = waterSurfaceBounds(surface);
    ctx.save();
    waterSurfacePath(ctx, surface);
    ctx.clip('evenodd');
    for (const entry of entries) {
      if (surface.level > entry.level + 0.3) continue;
      const plane = isoToScreen(entry.tx, entry.ty, surface.level - 0.26);
      const base = isoToScreen(entry.tx, entry.ty, entry.level);
      const reflectedY = 2 * plane.y - base.y;
      // Generous local bounds include flight/perching height; the exact shore
      // mask clips dry land and islands. No per-agent offscreen canvases/cache.
      if (plane.x + 80 < minX || plane.x - 80 > maxX || reflectedY - 35 > maxY || reflectedY + 220 < minY) continue;
      const sx = (plane.x - opts.camX) * opts.zoom + opts.viewW / 2;
      const sy = (reflectedY - opts.camY) * opts.zoom + opts.viewH / 2;
      if (sx < -120 || sx > opts.viewW + 120 || sy < -240 || sy > opts.viewH + 80) continue;
      const drift = Math.sin(time * 0.0013 + plane.y * 0.07) * 0.65;
      const wave = opts.waterMotion?.(plane.x, reflectedY + (entry.alt ?? 12), surface.level);
      ctx.save();
      ctx.globalAlpha *= 0.5 * (wave?.alpha ?? 1);
      ctx.transform(1, 0, 0, -1, wave?.dx ?? drift, 2 * plane.y + (wave?.dy ?? 0));
      entry.draw();
      ctx.restore();
    }
    ctx.restore();
  }
}

export function drawPaperGrain(
  ctx: Ctx,
  W: number,
  H: number,
  paperPattern: CanvasPattern | null,
): CanvasPattern | null {
  if (!paperPattern) {
    const p = ctx.createPattern(getPaperTile(), 'repeat');
    if (p) paperPattern = p;
  }
  if (!paperPattern) return paperPattern;
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  // The old overlay + soft-light passes reused the same neutral grain. A single
  // calibrated pass keeps paper texture (tested against colour swatches) and avoids
  // a second full-resolution blend every frame, especially expensive on HiDPI.
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = paperPattern;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  return paperPattern;
}

/**
 * Солнце «в объективе»: тёплый свет, заливающийся в кадр со стороны
 * светила, поверх уже нарисованного мира (экранные координаты).
 *
 * Сам диск на небе часто закрыт усадьбой и деревьями — кадр смотрит
 * на сад сверху, и неба в нём мало. Но присутствие солнца должно
 * ощущаться: днём — мягким теплом с его стороны, в золотой час —
 * закатным пламенем, протянувшимся поперёк сцены. Тучи гасят заливку.
 */
export function drawSunGlow(ctx: Ctx, W: number, H: number, atm: Atmosphere): void {
  const t = atm.time;
  if (t.daylight < 0.05) return;
  const sun = sunScreenPos(W, H, t.dayT);
  // Было слишком ярко: 0.07*daylight давало молочную пелену даже в полдень,
  // а золотой час выжигал. Уменьшили в ~2.5 раза и перевели в soft-light.
  const s = (0.025 * t.daylight + 0.07 * atm.golden) * (1 - atm.overcast * 0.75);
  if (s < 0.015) return;
  const warm = mix({ r: 255, g: 226, b: 168 }, { r: 255, g: 158, b: 84 }, atm.golden);
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  glow(ctx, sun.x, sun.y, Math.max(W, H) * (0.32 + atm.golden * 0.18), warm, s);
  ctx.restore();
}

export function drawColorGrade(ctx: Ctx, W: number, H: number, atm: Atmosphere): void {
  // Общий тёплый/холодный «фильтр» по времени суток
  const t = atm.time;
  ctx.save();
  if (atm.golden > 0.05) {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = css({ r: 255, g: 186, b: 116 }, atm.golden * 0.34);
    ctx.fillRect(0, 0, W, H);
  }
  if (t.daylight < 0.5) {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = css({ r: 70, g: 96, b: 176 }, (1 - t.daylight * 2) * 0.32);
    ctx.fillRect(0, 0, W, H);
  }
  const cold = ecologyYear(t.now).cold;
  if (cold > 0.001) {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = css({ r: 190, g: 214, b: 236 }, 0.14 * cold);
    ctx.fillRect(0, 0, W, H);
  }

  // Свет направленный: тёплое плечо со стороны солнца, прохладное — со
  // стороны тени. Было слишком ярко (0.035+...), теперь еле заметное
  // моделирование днём и мягкая драматургия в золотой час.
  const dirA = (0.012 + t.daylight * 0.014 + atm.golden * 0.06) * (1 - atm.overcast * 0.7);
  if (dirA > 0.008 && t.daylight > 0.12) {
    const sunSide = atm.sunDir.x >= 0 ? 1 : -1;
    const warmCol = mix({ r: 255, g: 206, b: 138 }, { r: 255, g: 166, b: 92 }, atm.golden);
    const coolCol = mix({ r: 106, g: 126, b: 172 }, { r: 150, g: 128, b: 158 }, atm.golden * 0.5);
    const x0 = sunSide > 0 ? 0 : W;
    const x1 = sunSide > 0 ? W : 0;
    const g = ctx.createLinearGradient(x0, 0, x1, H * 0.85);
    g.addColorStop(0, css(warmCol, dirA));
    g.addColorStop(0.6, css(mix(warmCol, coolCol, 0.5), 0));
    g.addColorStop(1, css(coolCol, dirA * 0.7));
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}
