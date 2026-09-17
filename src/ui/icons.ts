/** Миниатюрные иконки предметов — рисуются тем же кодом, что и сад, но в маленьком канвасе. */

import { Atmosphere } from '../world/palette';
import { drawObject, hasDrawer } from '../render/sprites';
import { PlacedObject } from '../world/types';
import { ITEM_BY_ID } from '../world/catalog';

const cache = new Map<string, string>();

export function itemIcon(itemId: string, atm: Atmosphere, size = 56): string {
  const key = `${itemId}|${atm.season}|${size}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const c = document.createElement('canvas');
  c.width = size * dpr;
  c.height = size * dpr;
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);

  if (hasDrawer(itemId)) {
    const item = ITEM_BY_ID.get(itemId);
    const tall = item && (item.kind === 'tree' || itemId === 'pavilion');
    const scale = tall ? size / 150 : size / 70;
    ctx.save();
    ctx.translate(size / 2, tall ? size * 0.94 : size * 0.68);
    ctx.scale(scale, scale);
    const fake: PlacedObject = { id: -1, type: itemId, tx: 0, ty: 0, planted: Date.now() - 864e5 * 30, rot: 0, seed: 424242 };
    // Иконка рисуется при «дневном» свете — независимо от времени суток в саду
    const iconAtm: Atmosphere = {
      ...atm,
      exposure: 1,
      lightAmount: 0.06,
      shadowAmount: 0.16,
      lampGlow: 0.35,
      fireflies: 0,
    };
    drawObject({ ctx, x: 0, y: 0, atm: iconAtm, g: 1, obj: fake, time: 1200, wind: 0, alpha: 1 });
    ctx.restore();
  }

  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

export function clearIconCache(): void {
  cache.clear();
}

/** SVG-иконки для вкладок и кнопок — тонкая «тушь». */
export const GLYPHS: Record<string, string> = {
  ground: '<path d="M3 17c3-3 6-3 9 0s6 3 9 0" /><path d="M3 12c3-2.5 6-2.5 9 0s6 2.5 9 0" opacity=".5"/>',
  water: '<path d="M4 14c2.5-2.5 5-2.5 8 0s5.5 2.5 8 0"/><path d="M4 18c2.5-2.5 5-2.5 8 0s5.5 2.5 8 0" opacity=".55"/>',
  hill: '<path d="M2 18l6-8 4 5 3-3 7 6z"/>',
  tree: '<path d="M12 21v-7"/><path d="M12 15c-4 0-6-2.2-6-5s2.4-5.5 6-5.5S18 7.2 18 10s-2 5-6 5z"/>',
  rock: '<path d="M4 18l4-8 6-2 6 6-2 4z"/>',
  micro: '<circle cx="8" cy="15" r="2"/><circle cx="14" cy="17" r="1.5"/><circle cx="17" cy="13" r="1.2"/><circle cx="11" cy="11" r="1.4"/>',
  lotus: '<path d="M12 19c-5 0-8-3-8-3s3-2 8-2 8 2 8 2-3 3-8 3z"/><path d="M12 14c0-4 2-7 2-7s2 3 2 6"/><path d="M12 14c0-4-2-7-2-7s-2 3-2 6"/>',
  lantern: '<path d="M7 8h10l-1.5 8h-7z"/><path d="M5 8h14"/><path d="M12 4v4"/><path d="M12 16v3"/>',
  house: '<path d="M3 11l9-6 9 6"/><path d="M5 11v9h14v-9"/><path d="M10 20v-6h4v6"/>',
  cat: '<path d="M6 10L5 5l4 2.5"/><path d="M18 10l1-5-4 2.5"/><path d="M12 19c-4 0-6.5-2.5-6.5-6S8 7 12 7s6.5 2.5 6.5 6-2.5 6-6.5 6z"/><circle cx="9.5" cy="12" r=".8"/><circle cx="14.5" cy="12" r=".8"/>',
  hand: '<path d="M8 13V6.5a1.5 1.5 0 013 0V12"/><path d="M11 12V5.5a1.5 1.5 0 013 0V12"/><path d="M14 12V7.5a1.5 1.5 0 013 0V13"/><path d="M8 13l-1.5-2a1.4 1.4 0 00-2.2 1.7L7 18a6 6 0 0010 0v-5"/>',
  erase: '<path d="M4 16l8-8 6 6-4 4H7z"/><path d="M9 20h11"/>',
  eye: '<path d="M2 12s3.8-6 10-6 10 6 10 6-3.8 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.6"/>',
  camera: '<rect x="3" y="7" width="18" height="12" rx="2.5"/><circle cx="12" cy="13" r="3.4"/><path d="M8 7l1.5-2.5h5L16 7"/>',
  rotate: '<path d="M4 12a8 8 0 1 1 2.6 5.9"/><path d="M3 18.5l1.2-4.4 4.4 1.2"/>',
  scroll: '<path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  'sound-on':
    '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M16 9.2a4 4 0 010 5.6"/><path d="M18.6 6.6a7.6 7.6 0 010 10.8"/>',
  'sound-off':
    '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M16.5 10l4 4M20.5 10l-4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  grid: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5" opacity=".5"/>',
  undo: '<path d="M9 7L4 12l5 5"/><path d="M4 12h9.5a5.5 5.5 0 010 11H10"/>',
  redo: '<path d="M15 7l5 5-5 5"/><path d="M20 12h-9.5a5.5 5.5 0 000 11H14"/>',
  dropper:
    '<path d="M14.5 4.8a2.6 2.6 0 013.7 3.7l-1.3 1.3 1 1-1.6 1.6-1-1L9 18.7l-3.6.9.9-3.6 6.3-6.3-1-1L13.2 7l1 1z"/>',
  move: '<path d="M12 3v18M3 12h18"/><path d="M12 3l-2.4 2.6M12 3l2.4 2.6M12 21l-2.4-2.6M12 21l2.4-2.6"/><path d="M3 12l2.6-2.4M3 12l2.6 2.4M21 12l-2.6-2.4M21 12l2.6 2.4"/>',
  fill: '<path d="M11 3l8 8-7.5 7.5a2 2 0 01-2.8 0L4 13a2 2 0 010-2.8z"/><path d="M6 8.5h11"/><path d="M20 15c1.4 2 2 3.1 2 4a2 2 0 11-4 0c0-.9.6-2 2-4z"/>',
  gardens: '<path d="M4 20V9l6-4 6 4v11"/><path d="M16 20V12h4v8"/><path d="M4 20h16"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/>',
  roof: '<path d="M3 12L12 5l9 7"/><path d="M5 12v7h14v-7"/>',
  'roof-off': '<path d="M3 12L12 5l9 7"/><path d="M4 4l16 16"/>',
  path: '<path d="M7 21c0-4 3-4 3-8s-3-4-3-7"/><path d="M14 21c1.5-3 3-3.5 3-7s-2-4-2-7"/><circle cx="7" cy="3" r="1"/><circle cx="15" cy="4" r="1"/>',
};

export function svgIcon(name: string, size = 22, stroke = 'currentColor'): string {
  const body = GLYPHS[name] ?? GLYPHS.micro;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}
