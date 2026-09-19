/** Миниатюрные иконки предметов — рисуются тем же кодом, что и сад, но в маленьком канвасе. */

import { computeTime } from '../core/clock';
import { crownCacheKey, crownCacheTime } from '../world/phenology';
import { buildAtmosphere, Atmosphere } from '../world/palette';
import { drawObject, hasDrawer } from '../render/sprites';
import { PlacedObject } from '../world/types';

const cache = new Map<string, string>();

export function itemIcon(itemId: string, atm: Atmosphere, size = 56): string {
  const key = `${itemId}|${atm.season}|${crownCacheKey(itemId, 424242, atm.time.now)}|${size}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const c = document.createElement('canvas');
  c.width = size * dpr;
  c.height = size * dpr;
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);

  if (hasDrawer(itemId)) {
    // Иконка рисуется при «дневном» свете — независимо от времени суток в саду
    const iconTime = {
      ...computeTime(crownCacheTime(itemId, 424242, atm.time.now)),
      dayT: 0.5,
      hours: 12,
      minutes: 0,
      daylight: 1,
      isNight: false,
      golden: 0,
    };
    const iconAtm: Atmosphere = {
      ...buildAtmosphere(iconTime),
      exposure: 1,
      lightAmount: 0.06,
      shadowAmount: 0.16,
      lampGlow: 0.35,
      fireflies: 0,
    };
    const fake: PlacedObject = {
      id: -1,
      type: itemId,
      tx: 0,
      ty: 0,
      planted: Date.now() - 864e5 * 30,
      rot: 0,
      seed: 424242,
    };

    // Вписываем предмет по его настоящим границам.
    //
    // Раньше масштаб брался по двум разрядам «высокий / не высокий»:
    // сакура упиралась в рамку и теряла верхушку кроны, а подушка мха
    // занимала четверть поля и висела у нижнего края. Теперь рисуем
    // пробный кадр, замеряем занятый прямоугольник и подгоняем под него.
    const box = measure(itemId, iconAtm, fake);
    const pad = size * 0.06;
    const avail = size - pad * 2;
    const scale = Math.min(avail / box.w, avail / box.h);

    ctx.save();
    // Середина занятого прямоугольника должна оказаться в середине иконки
    ctx.translate(size / 2 - box.cx * scale, size / 2 - box.cy * scale);
    ctx.scale(scale, scale);
    drawObject({ ctx, x: 0, y: 0, atm: iconAtm, g: 1, obj: fake, time: 1200, wind: 0, alpha: 1 });
    ctx.restore();
  }

  const url = c.toDataURL();
  cache.set(key, url);
  if (cache.size > 300) cache.delete(cache.keys().next().value!);
  c.width = c.height = 1;
  return url;
}

/** Границы предмета в его собственных координатах — для вписывания в иконку. */
const boxCache = new Map<string, { w: number; h: number; cx: number; cy: number }>();

function measure(itemId: string, atm: Atmosphere, obj: PlacedObject): { w: number; h: number; cx: number; cy: number } {
  const key = `${itemId}|${atm.season}|${crownCacheKey(itemId, obj.seed, atm.time.now)}`;
  const hit = boxCache.get(key);
  if (hit) return hit;

  // Пробный холст с запасом: предметы рисуются вверх от точки опоры
  const S = 260;
  const probe = document.createElement('canvas');
  probe.width = S;
  probe.height = S;
  const pc = probe.getContext('2d')!;
  pc.translate(S / 2, S * 0.78);
  drawObject({ ctx: pc, x: 0, y: 0, atm, g: 1, obj, time: 1200, wind: 0, alpha: 1 });

  const px = pc.getImageData(0, 0, S, S).data;
  let top = S;
  let bottom = -1;
  let left = S;
  let right = -1;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (px[(y * S + x) * 4 + 3] > 12) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }

  // Ничего не нарисовалось — отдаём безопасный размер, чтобы не делить на ноль
  const box =
    bottom < 0
      ? { w: 70, h: 70, cx: 0, cy: -35 }
      : {
          w: right - left + 1,
          h: bottom - top + 1,
          // назад в координаты предмета: начало было в (S/2, S*0.78)
          cx: (left + right) / 2 - S / 2,
          cy: (top + bottom) / 2 - S * 0.78,
        };
  boxCache.set(key, box);
  if (boxCache.size > 300) boxCache.delete(boxCache.keys().next().value!);
  probe.width = probe.height = 1;
  return box;
}

export function clearIconCache(): void {
  cache.clear();
  boxCache.clear();
}

/** SVG-иконки для вкладок и кнопок — тонкая «тушь». */
export const GLYPHS: Record<string, string> = {
  ground: '<path d="M3 17c3-3 6-3 9 0s6 3 9 0" /><path d="M3 12c3-2.5 6-2.5 9 0s6 2.5 9 0" opacity=".5"/>',
  water: '<path d="M4 14c2.5-2.5 5-2.5 8 0s5.5 2.5 8 0"/><path d="M4 18c2.5-2.5 5-2.5 8 0s5.5 2.5 8 0" opacity=".55"/>',
  hill: '<path d="M2 18l6-8 4 5 3-3 7 6z"/>',
  tree: '<path d="M12 21v-7"/><path d="M12 15c-4 0-6-2.2-6-5s2.4-5.5 6-5.5S18 7.2 18 10s-2 5-6 5z"/>',
  rock: '<path d="M4 18l4-8 6-2 6 6-2 4z"/>',
  micro:
    '<circle cx="8" cy="15" r="2"/><circle cx="14" cy="17" r="1.5"/><circle cx="17" cy="13" r="1.2"/><circle cx="11" cy="11" r="1.4"/>',
  lotus:
    '<path d="M12 19c-5 0-8-3-8-3s3-2 8-2 8 2 8 2-3 3-8 3z"/><path d="M12 14c0-4 2-7 2-7s2 3 2 6"/><path d="M12 14c0-4-2-7-2-7s-2 3-2 6"/>',
  lantern: '<path d="M7 8h10l-1.5 8h-7z"/><path d="M5 8h14"/><path d="M12 4v4"/><path d="M12 16v3"/>',
  house: '<path d="M3 11l9-6 9 6"/><path d="M5 11v9h14v-9"/><path d="M10 20v-6h4v6"/>',
  cat: '<path d="M6 10L5 5l4 2.5"/><path d="M18 10l1-5-4 2.5"/><path d="M12 19c-4 0-6.5-2.5-6.5-6S8 7 12 7s6.5 2.5 6.5 6-2.5 6-6.5 6z"/><circle cx="9.5" cy="12" r=".8"/><circle cx="14.5" cy="12" r=".8"/>',
  hand: '<path d="M8 13V6.5a1.5 1.5 0 013 0V12"/><path d="M11 12V5.5a1.5 1.5 0 013 0V12"/><path d="M14 12V7.5a1.5 1.5 0 013 0V13"/><path d="M8 13l-1.5-2a1.4 1.4 0 00-2.2 1.7L7 18a6 6 0 0010 0v-5"/>',
  erase: '<path d="M4 16l8-8 6 6-4 4H7z"/><path d="M9 20h11"/>',
  eye: '<path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.6"/>',
  camera:
    '<rect x="3" y="7" width="18" height="12" rx="2.5"/><circle cx="12" cy="13" r="3.4"/><path d="M8 7l1.5-2.5h5L16 7"/>',
  rotate: '<path d="M4 12a8 8 0 1 1 2.6 5.9"/><path d="M3 18.5l1.2-4.4 4.4 1.2"/>',
  book: '<path d="M12 6C9 4 5 4 2 5v14c3-1 7-1 10 1 3-2 7-2 10-1V5c-3-1-7-1-10 1v14"/><path d="M5 8h4M5 11h4M15 8h4M15 11h4"/>',
  scroll: '<path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5.5 12.5l4.3 4.6L19 7.5"/>',
  'sound-on':
    '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M16 9.2a4 4 0 010 5.6"/><path d="M18.6 6.6a7.6 7.6 0 010 10.8"/>',
  'sound-off': '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M16.5 10l4 4M20.5 10l-4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  grid: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5" opacity=".5"/>',
  undo: '<path d="M9 7L4 12l5 5"/><path d="M4 12h9.5a5.5 5.5 0 010 11H10"/>',
  // Одиночное касание: точка и круги-рябь вокруг
  tap: '<circle cx="12" cy="12" r="2.1"/><circle cx="12" cy="12" r="6.2" opacity=".45"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2" opacity=".5"/>',
  // Мазок: волнистая лента кисти
  stroke: '<path d="M4 17c3.4 0 4.2-8.4 7.4-8.4 3 0 2.6 6.4 8.6 6.4"/><path d="M4 20.4h16" opacity=".4"/>',
  redo: '<path d="M15 7l5 5-5 5"/><path d="M20 12h-9.5a5.5 5.5 0 000 11H14"/>',
  dropper:
    '<path d="M14.5 4.8a2.6 2.6 0 013.7 3.7l-1.3 1.3 1 1-1.6 1.6-1-1L9 18.7l-3.6.9.9-3.6 6.3-6.3-1-1L13.2 7l1 1z"/>',
  move: '<path d="M12 3v18M3 12h18"/><path d="M12 3l-2.4 2.6M12 3l2.4 2.6M12 21l-2.4-2.6M12 21l2.4-2.6"/><path d="M3 12l2.6-2.4M3 12l2.6 2.4M21 12l-2.6-2.4M21 12l2.6 2.4"/>',
  fill: '<path d="M11 3l8 8-7.5 7.5a2 2 0 01-2.8 0L4 13a2 2 0 010-2.8z"/><path d="M6 8.5h11"/><path d="M20 15c1.4 2 2 3.1 2 4a2 2 0 11-4 0c0-.9.6-2 2-4z"/>',
  gardens: '<path d="M3 20v-7l4.5-3 4.5 3v7"/><path d="M13.5 20v-5l4-2.5 3.5 2.5v5"/><path d="M2 20h20"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/>',
  phone:
    '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M3 12a9 9 0 0 1 3-6.7"/><path d="M21 12a9 9 0 0 1-3 6.7"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
  roof: '<path d="M2 13L12 6l10 7"/><path d="M4.5 13c2.5 1.6 4.8 2.4 7.5 2.4s5-0.8 7.5-2.4"/><path d="M12 6V3.5"/>',
  'roof-off':
    '<path d="M2 13L12 6l10 7"/><path d="M4.5 13c2.5 1.6 4.8 2.4 7.5 2.4s5-0.8 7.5-2.4"/><path d="M4 4l16 16"/>',
  path: '<path d="M7 21c0-4 3-4 3-8s-3-4-3-7"/><path d="M14 21c1.5-3 3-3.5 3-7s-2-4-2-7"/><circle cx="7" cy="3" r="1"/><circle cx="15" cy="4" r="1"/>',
  bird: '<path d="M4 14c3 3 8 3 11 0l5-4-3-.5 1.5-3-3 1.5c-.6-2-2.4-3-4.5-3C10.5 5 9 7.5 9 10c-2 0-3.5 1.5-5 4z"/><circle cx="14.6" cy="7.6" r=".7"/>',
  quill: '<path d="M20 4c-6 0-11 4-13 10l-3 6"/><path d="M20 4c1 5-2 10-8 11l-4 1"/><path d="M9 12h5"/>',
};

export function svgIcon(name: string, size = 22, stroke = 'currentColor'): string {
  const body = GLYPHS[name] ?? GLYPHS.micro;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
