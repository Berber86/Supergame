import { STONE_TYPES } from '../../world/stone';
import { drawWindDirect } from '../plantWind';
import { drawOrchard } from './orchard';
/**
 * Рисованные «акварельные» объекты сада. Всё генерируется кодом, без ассетов.
 * Рисовальщики лежат по смысловым файлам: деревья, камни и мелочь, вода,
 * мосты, свет, постройки, интерьер. Общая утварь — в common.ts.
 */

import { LEVEL_H, TILE_H, TILE_W } from '../../core/iso';
import { makeRng } from '../../core/rng';
import { ITEM_BY_ID, FURNITURE_IDS, SMALL_HOUSE_IDS } from '../../world/catalog';
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
import { drawTorii, drawFeeder, drawBirdbath, drawBeehive, drawSquirrelFeeder, drawTurtleLog } from './buildings';
import {
  drawShoji,
  drawFusuma,
  drawTokonoma,
  drawTansu,
  drawIndoorPlant,
  drawKotatsu,
  drawBookshelf,
  drawEngawaBench,
} from './furniture';
import { drawTeaHouse, drawShed, drawTinyHouse, drawPavilion } from './smallHouses';
import {
  drawMossLog,
  drawStump,
  drawMushrooms,
  drawFenceWood,
  drawFenceStone,
  drawJizo,
  drawWell,
  drawGardenBench,
  drawWoodpile,
  drawNestbox,
  drawHammock,
  drawMatatabi,
  drawZenRake,
} from './decor';
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
  ume: drawOrchard,
  nashi: drawOrchard,
  peach: drawOrchard,
  yuzu: drawOrchard,
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
  kotatsu: drawKotatsu,
  bookshelf: drawBookshelf,
  engawa_bench: drawEngawaBench,
  tansu: drawTansu,
  indoor_plant: drawIndoorPlant,
  feeder: drawFeeder,
  birdbath: drawBirdbath,
  beehive: drawBeehive,
  squirrel_feeder: drawSquirrelFeeder,
  turtle_log: drawTurtleLog,
  cushion: drawCushion,
  bowl: drawBowl,
  cat: drawCat,
  moss_log: drawMossLog,
  stump: drawStump,
  mushrooms: drawMushrooms,
  fence_wood: drawFenceWood,
  fence_stone: drawFenceStone,
  jizo: drawJizo,
  zen_rake: drawZenRake,
  well: drawWell,
  garden_bench: drawGardenBench,
  woodpile: drawWoodpile,
  nestbox: drawNestbox,
  hammock: drawHammock,
  matatabi: drawMatatabi,
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
      if (shadowSpec.size > 600) shadowSpec.delete(shadowSpec.keys().next().value!);
      probe.width = probe.height = 1;
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
    probe.width = probe.height = 1;
    if (shadowSpec.size > 600) shadowSpec.delete(shadowSpec.keys().next().value!);
  }
  if (!spec) return;
  // Учитываем scaleJitter для тени
  const sc = scaleJitterOf(d.obj.seed);
  const item = ITEM_BY_ID.get(d.obj.type);
  const isTreeLike =
    item && (item.kind === 'tree' || item.kind === 'shrub' || item.kind === 'flower' || item.kind === 'micro');
  const extraScale =
    item?.kind === 'bridge' || FURNITURE_IDS.has(d.obj.type) || SMALL_HOUSE_IDS.has(d.obj.type)
      ? 1
      : isTreeLike
        ? 0.92 + (sc - 0.88) * 0.5
        : sc;
  shadowUnder(d, spec.rx * extraScale, spec.ry * extraScale, spec.strength);
}

export function drawObject(d: DrawCtx): void {
  const fn = DRAWERS[d.obj.type];
  if (!fn) return;
  const { ctx } = d;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = d.alpha;

  // Детерминированное разнообразие по сиду: зеркало и лёгкий масштаб.
  // Мосты и мебель исключены: оси и размер должны совпадать с сеткой пола.
  // Тень уже нарисована до этого, зеркало на неё не влияет — тень от солнца, а не от формы.
  const mirror = STONE_TYPES.has(d.obj.type) ? 1 : mirrorOf(d.obj.seed);
  const sc = scaleJitterOf(d.obj.seed);
  const item = ITEM_BY_ID.get(d.obj.type);
  const isTreeLike =
    item && (item.kind === 'tree' || item.kind === 'shrub' || item.kind === 'flower' || item.kind === 'micro');
  const extraScale =
    item?.kind === 'bridge' || FURNITURE_IDS.has(d.obj.type) || SMALL_HOUSE_IDS.has(d.obj.type)
      ? 1
      : isTreeLike
        ? 0.92 + (sc - 0.88) * 0.5
        : sc;

  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.scale(
    (item?.kind === 'bridge' || FURNITURE_IDS.has(d.obj.type) || SMALL_HOUSE_IDS.has(d.obj.type) ? 1 : mirror) *
      extraScale,
    extraScale,
  );
  ctx.translate(-d.x, -d.y);

  // Keep the same basal clip in calm and gusts too: nested bark clips can otherwise
  // rasterize a thin curved trunk differently when the first gust begins.
  if (d.plantPose && (d.plantPose.hinge > 0 || Math.abs(d.plantPose.slope) > 1e-6)) {
    // Undo the seed transform for the world-space hinge, then let each rigid piece
    // receive the same seed anatomy. This path is diagnostic; normal play copies cached pixels.
    ctx.restore();
    drawWindDirect(ctx, d.x, d.y, d.plantPose, () => drawObject({ ...d, plantPose: undefined, wind: 0 }));
    ctx.globalAlpha = prev;
    return;
  }
  fn(d.plantPose ? { ...d, wind: 0 } : d);

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
  if (type === 'step_stone') return 180;
  if (FURNITURE_IDS.has(type) || CACHED_DECOR.has(type)) return 150;
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

/**
 * Статичные предметы обустройства: их новые рисовки объёмнее старых,
 * поэтому рендер идёт через кэш спрайтов, как у деревьев и построек.
 * Живые вещи (опята у дождя, скворечник с синицей) остаются дешёвыми и рисуются напрямую.
 */
const CACHED_DECOR = new Set([
  'moss_log',
  'stump',
  'jizo',
  'zen_rake',
  'fence_wood',
  'fence_stone',
  'well',
  'garden_bench',
  'woodpile',
  'hammock',
  'matatabi',
]);

/** Приблизительная высота объекта — для сортировки и превью. */
export function objectHeight(type: string): number {
  switch (type) {
    case 'bookshelf':
    case 'shoji':
    case 'fusuma':
    case 'tokonoma':
      return 76;
    case 'zen_rake':
      return 36;
    case 'byobu':
    case 'irori':
      return 64;
    case 'ume':
    case 'nashi':
    case 'peach':
    case 'yuzu':
    case 'sakura':
    case 'maple':
    case 'ginkgo':
    case 'willow':
      return 120;
    case 'pine':
      return 245;
    case 'bamboo':
      return 100;
    case 'pavilion':
    case 'tea_house':
    case 'tiny_house':
      return 96;
    case 'shed':
      return 94;
    case 'nestbox':
      return 58;
    case 'well':
      return 64;
    case 'woodpile':
      return 28;
    case 'hammock':
      return 29;
    case 'fence_wood':
    case 'fence_stone':
    case 'jizo':
      return 26;
    case 'garden_bench':
      return 20;
    case 'stump':
    case 'matatabi':
      return 16;
    case 'mushrooms':
      return 13;
    case 'moss_log':
      return 12;
    default:
      return 40;
  }
}

export { makeRng, TILE_H, TILE_W, LEVEL_H };
