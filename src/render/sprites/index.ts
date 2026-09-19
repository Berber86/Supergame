/**
 * Рисованные «акварельные» объекты сада. Всё генерируется кодом, без ассетов.
 * Рисовальщики лежат по смысловым файлам: деревья, камни и мелочь, вода,
 * мосты, свет, постройки, интерьер. Общая утварь — в common.ts.
 */

import { LEVEL_H, TILE_H, TILE_W } from '../../core/iso';
import { makeRng } from '../../core/rng';
import { ITEM_BY_ID } from '../../world/catalog';
import { Ctx } from '../paint';
import { DrawCtx, Drawer, mirrorOf, probeShadowBegin, probeShadowEnd, scaleJitterOf, shadowUnder } from './common';
import {
  drawSakura,
  drawMaple,
  drawGinkgo,
  drawWillow,
  drawPine,
  drawBamboo,
  drawShrub,
  drawWisteria,
  drawPersimmon,
  drawCamellia,
} from './trees';
import { makeRock, drawStepStone, drawMossClump, drawPebbles, drawGrassTuft, makeFlower, drawFern } from './ground';
import { drawLilypad, drawLotus, drawKoi, drawReed, drawHorsetail, drawWaterStone } from './water';
import { drawBridge, drawPlankBridge } from './bridges';
import { drawStoneLantern, drawPaperLantern, drawPathLight, drawBrazier } from './light';
import {
  drawPavilion,
  drawTorii,
  drawShoji,
  drawFusuma,
  drawTokonoma,
  drawFeeder,
  drawBirdbath,
  drawBeehive,
  drawSquirrelFeeder,
  drawTurtleLog,
} from './buildings';
import { drawTeaHouse, drawShed, drawTinyHouse } from './smallHouses';
import {
  drawTable,
  drawCushion,
  drawTsukubai,
  drawShishi,
  drawWindChime,
  drawBowl,
  drawCat,
  drawIrori,
  drawFuton,
  drawByobu,
  drawBonsai,
} from './interior';

export type { DrawCtx } from './common';
export { setSkipShadows } from './common';

const DRAWERS: Record<string, Drawer> = {
  sakura: drawSakura,
  maple: drawMaple,
  pine: drawPine,
  bamboo: drawBamboo,
  willow: drawWillow,
  ginkgo: drawGinkgo,
  azalea: drawShrub,
  hedge: drawShrub,
  wisteria: drawWisteria,
  persimmon: drawPersimmon,
  camellia: drawCamellia,
  rock_big: makeRock(1.55, 1),
  rock_mid: makeRock(0.95, 1),
  rock_trio: makeRock(0.85, 3),
  step_stone: drawStepStone,
  moss_clump: drawMossClump,
  pebbles: drawPebbles,
  grass_tuft: drawGrassTuft,
  lily: makeFlower({ r: 250, g: 250, b: 244 }, { r: 112, g: 152, b: 96 }, false),
  iris: makeFlower({ r: 148, g: 122, b: 196 }, { r: 106, g: 148, b: 96 }, true),
  fern: drawFern,
  lotus: drawLotus,
  lilypad: drawLilypad,
  koi: drawKoi,
  bridge: drawBridge,
  lantern_stone: drawStoneLantern,
  lantern_paper: drawPaperLantern,
  lantern_path: drawPathLight,
  brazier: drawBrazier,
  pavilion: drawPavilion,
  tea_house: drawTeaHouse,
  shed: drawShed,
  tiny_house: drawTinyHouse,
  torii: drawTorii,
  shoji: drawShoji,
  table: drawTable,
  tsukubai: drawTsukubai,
  wind_chime: drawWindChime,
  shishi: drawShishi,
  reed: drawReed,
  horsetail: drawHorsetail,
  water_stone: drawWaterStone,
  plank_bridge: drawPlankBridge,
  fusuma: drawFusuma,
  tokonoma: drawTokonoma,
  irori: drawIrori,
  futon: drawFuton,
  byobu: drawByobu,
  bonsai: drawBonsai,
  feeder: drawFeeder,
  birdbath: drawBirdbath,
  beehive: drawBeehive,
  squirrel_feeder: drawSquirrelFeeder,
  turtle_log: drawTurtleLog,
  cushion: drawCushion,
  bowl: drawBowl,
  cat: drawCat,
};

/**
 * Тень объекта — для случая, когда сам объект берётся из кэша.
 *
 * Размеры тени спрашиваем у самого рисовальщика: у каждого они свои
 * (у дерева от ширины кроны, у камня от его масштаба). Пробный прогон
 * идёт в пустой холст и только запоминает числа.
 */
const shadowSpec = new Map<string, { rx: number; ry: number; strength: number } | null>();

export function drawObjectShadow(d: DrawCtx): void {
  // Тень зависит от сида из-за scaleJitter — включаем сид в ключ, чтобы тень не «отставала»
  const key = `${d.obj.type}|${Math.round(d.g * 12)}|${d.obj.rot}|${d.obj.seed}`;
  let spec = shadowSpec.get(key);
  if (spec === undefined) {
    const probe = document.createElement('canvas');
    probe.width = 8;
    probe.height = 8;
    const pc = probe.getContext('2d');
    if (!pc) {
      shadowSpec.set(key, null);
      return;
    }
    probeShadowBegin();
    const fn = DRAWERS[d.obj.type];
    if (fn) {
      try {
        fn({ ...d, ctx: pc as unknown as Ctx, x: 0, y: 0, time: 0, wind: 0, alpha: 1 });
      } catch {
        // рисовальщику мог не понравиться крошечный холст — тень пропустим
      }
    }
    spec = probeShadowEnd();
    shadowSpec.set(key, spec);
  }
  if (!spec) return;
  // Учитываем scaleJitter для тени
  const sc = scaleJitterOf(d.obj.seed);
  const item = ITEM_BY_ID.get(d.obj.type);
  const isTreeLike = item && (item.kind === 'tree' || item.kind === 'shrub' || item.kind === 'flower' || item.kind === 'micro');
  const extraScale = isTreeLike ? 0.92 + (sc - 0.88) * 0.5 : sc;
  shadowUnder(d, spec.rx * extraScale, spec.ry * extraScale, spec.strength);
}

export function drawObject(d: DrawCtx): void {
  const fn = DRAWERS[d.obj.type];
  if (!fn) return;
  const { ctx } = d;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = d.alpha;

  // Детерминированное разнообразие по сиду: зеркало и лёгкий масштаб.
  // Тень уже нарисована до этого, зеркало на неё не влияет — тень от солнца, а не от формы.
  const mirror = mirrorOf(d.obj.seed);
  const sc = scaleJitterOf(d.obj.seed);
  const item = ITEM_BY_ID.get(d.obj.type);
  const isTreeLike = item && (item.kind === 'tree' || item.kind === 'shrub' || item.kind === 'flower' || item.kind === 'micro');
  const extraScale = isTreeLike ? 0.92 + (sc - 0.88) * 0.5 : sc;

  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.scale(mirror * extraScale, extraScale);
  ctx.translate(-d.x, -d.y);

  fn(d);

  ctx.restore();
  ctx.globalAlpha = prev;
}

/**
 * Во сколько примерно обходится отрисовка типа, в микросекундах.
 *
 * Числа сняты замером на стартовом саде (см. историю сессии 7): деревья
 * около 640 мкс, камни 220, кусты 150, мелочь 60–90. Точность тут не нужна —
 * значение служит порогом «стоит ли класть в кэш»: копирование холста
 * тоже не бесплатно, и дешёвую мелочь выгоднее рисовать заново.
 */
export function drawCost(type: string): number {
  const item = ITEM_BY_ID.get(type);
  if (!item) return 0;
  switch (item.kind) {
    case 'tree':
      return 640;
    case 'rock':
      return 220;
    case 'shrub':
      return 150;
    case 'pavilion':
      return 140;
    case 'bridge':
      return 116;
    case 'flower':
      return 91;
    default:
      // чайный домик и сарай дороже мелочи — у них крыша и столбы
      if (type === 'tea_house' || type === 'tiny_house' || type === 'shed') return 135;
      return 60;
  }
}

export function hasDrawer(type: string): boolean {
  return !!DRAWERS[type];
}

/** Приблизительная высота объекта — для сортировки и превью. */
export function objectHeight(type: string): number {
  switch (type) {
    case 'sakura':
    case 'maple':
    case 'ginkgo':
    case 'willow':
      return 120;
    case 'pine':
      return 165;
    case 'bamboo':
      return 100;
    case 'pavilion':
    case 'tea_house':
    case 'tiny_house':
      return 96;
    case 'shed':
      return 52;
    default:
      return 40;
  }
}

export { makeRng, TILE_H, TILE_W, LEVEL_H };
