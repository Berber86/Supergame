/** Сцена: камера, сортировка по глубине, пост-обработка «акварель на рисовой бумаге». */

import { GRID, LEVEL_H, TILE_H, TILE_W, isoToScreen, screenToIso } from '../core/iso';
import { clamp, clamp01, hash2, lerp } from '../core/rng';
import { ITEM_BY_ID } from '../world/catalog';
import { Atmosphere, RGB, css, mix, shade } from '../world/palette';
import { PlacedObject } from '../world/types';
import { World } from '../world/world';
import { Ctx, getPaperTile, glow, vignette } from './paint';
import { TerrainLayer, drawWaterAnimation, renderTerrain } from './terrain';
import { drawObject } from './sprites';
import { drawHouseRoof, drawHouseWalls } from './building';
import { Life } from '../world/life';
import { drawBird, drawCat, drawFish, drawFlutter } from './creatures';
import { Weather, drawMist, drawSunShafts } from './weather';

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface GhostPreview {
  kind: 'item' | 'brush' | 'erase';
  itemId?: string;
  brushId?: string;
  tx: number;
  ty: number;
  rot: number;
  valid: boolean;
  w: number;
  h: number;
}

export class Scene {
  canvas: HTMLCanvasElement;
  ctx: Ctx;
  camera: Camera = { x: 0, y: 0, zoom: 1 };
  private terrain: TerrainLayer | null = null;
  private terrainDirty = true;
  private lastAtmKey = '';
  private weather = new Weather();
  private paperPattern: CanvasPattern | null = null;
  private dpr = 1;
  /** Наведённый тайл — подсвечивается только в режиме строительства. */
  hover: { tx: number; ty: number } | null = null;
  ghost: GhostPreview | null = null;
  showGrid = false;
  wind = 0.5;
  life: Life | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.weather.resize(w, h);
  }

  get viewW(): number {
    return this.canvas.width / this.dpr;
  }

  get viewH(): number {
    return this.canvas.height / this.dpr;
  }

  markTerrainDirty(): void {
    this.terrainDirty = true;
  }

  centerOn(tx: number, ty: number): void {
    const p = isoToScreen(tx, ty);
    this.camera.x = p.x;
    this.camera.y = p.y;
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.viewW / 2) / this.camera.zoom + this.camera.x,
      y: (sy - this.viewH / 2) / this.camera.zoom + this.camera.y,
    };
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: (wx - this.camera.x) * this.camera.zoom + this.viewW / 2,
      y: (wy - this.camera.y) * this.camera.zoom + this.viewH / 2,
    };
  }

  /** Экранные координаты → координаты тайла с учётом высоты рельефа. */
  pickTile(sx: number, sy: number, world: World): { tx: number; ty: number } {
    const w = this.screenToWorld(sx, sy);
    // Итеративно уточняем уровень: сначала нулевой, потом по найденному тайлу.
    let best = screenToIso(w.x, w.y, 0);
    for (let i = 0; i < 3; i++) {
      const t = world.at(Math.floor(best.x), Math.floor(best.y));
      const lvl = t ? t.level : 0;
      best = screenToIso(w.x, w.y, lvl);
    }
    return { tx: best.x, ty: best.y };
  }

  private atmKey(atm: Atmosphere): string {
    // Перерисовываем ландшафт при заметном изменении освещения
    return `${atm.season}|${Math.round(atm.exposure * 22)}|${Math.round(atm.lightAmount * 22)}|${Math.round(
      atm.lightTint.r / 9,
    )}|${Math.round(atm.lightTint.b / 9)}`;
  }

  render(world: World, atm: Atmosphere, time: number, dt: number, life?: Life): void {
    if (life) this.life = life;
    const ctx = this.ctx;
    const W = this.viewW;
    const H = this.viewH;

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // --- Небо / фон ---
    this.drawSky(ctx, W, H, atm, time);

    // --- Ландшафт (кэшируется) ---
    const key = this.atmKey(atm);
    if (this.terrainDirty || key !== this.lastAtmKey || !this.terrain) {
      this.terrain = renderTerrain(world, atm, 1);
      this.terrainDirty = false;
      this.lastAtmKey = key;
    }

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    // мягкая тень-«подложка» под всем островом
    this.drawIslandShadow(ctx, atm);

    if (this.terrain) {
      ctx.drawImage(this.terrain.canvas, this.terrain.ox, this.terrain.oy);
    }

    // анимированная вода
    drawWaterAnimation(ctx, world, atm, time);

    // карпы — в толще воды, до наземных объектов
    if (this.life) {
      for (const f of this.life.fish) drawFish(ctx, f, world, atm, time);
    }

    // дальние стены дома — за объектами интерьера
    drawHouseWalls(ctx, world, atm);

    // сетка в режиме строительства
    if (this.showGrid) this.drawGrid(ctx, world, atm);

    // подсветка наведённого тайла / призрак объекта
    if (this.ghost) this.drawGhost(ctx, world, atm, time);

    // --- Объекты, отсортированные по глубине ---
    this.drawObjects(ctx, world, atm, time);

    // кровля и столбы — поверх интерьера
    drawHouseRoof(ctx, world, atm, time);

    ctx.restore();

    // --- Атмосферные слои поверх сцены ---
    drawSunShafts(ctx, W, H, atm, time);
    drawMist(ctx, W, H, atm, time);
    // лепестки и листья, сорванные ветром с конкретных деревьев
    if (this.life) {
      for (const e of this.life.takeEmitted()) {
        const tile = world.at(Math.floor(e.x), Math.floor(e.y));
        const lvl = tile ? tile.level : 0;
        const wp = isoToScreen(e.x, e.y, lvl);
        const sp = this.worldToScreen(wp.x, wp.y - 70);
        if (sp.x > -60 && sp.x < W + 60 && sp.y > -60 && sp.y < H + 60) {
          this.weather.emitAt(sp.x, sp.y, e.kind, e.seed);
        }
      }
    }
    this.weather.update(dt, atm);
    this.weather.draw(ctx, atm);

    // --- Пост-обработка ---
    this.drawPaperGrain(ctx, W, H);
    this.drawColorGrade(ctx, W, H, atm);
    vignette(ctx, W, H, mix(atm.shadowTint, { r: 60, g: 50, b: 40 }, 0.4), atm.time.isNight ? 0.5 : 0.3);

    ctx.restore();
  }

  private drawSky(ctx: Ctx, W: number, H: number, atm: Atmosphere, time: number): void {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, css(atm.skyTop, 1));
    g.addColorStop(0.62, css(mix(atm.skyTop, atm.skyBottom, 0.7), 1));
    g.addColorStop(1, css(atm.skyBottom, 1));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Солнце / луна
    const t = atm.time;
    const sunT = clamp01((t.dayT - 0.22) / 0.58);
    const isDay = t.dayT > 0.2 && t.dayT < 0.84;
    const bodyX = W * (0.12 + sunT * 0.76);
    const bodyY = H * (0.62 - Math.sin(sunT * Math.PI) * 0.52);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (isDay) {
      const warm = mix({ r: 255, g: 246, b: 214 }, { r: 255, g: 198, b: 140 }, atm.golden);
      glow(ctx, bodyX, bodyY, 190, warm, 0.5 + atm.golden * 0.4);
      ctx.fillStyle = css(warm, 0.85);
      ctx.beginPath();
      ctx.arc(bodyX, bodyY, 26, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const nightT = t.dayT < 0.2 ? (t.dayT + 0.16) / 0.36 : (t.dayT - 0.84 + 0.16) / 0.36;
      const mx = W * (0.15 + clamp01(nightT) * 0.7);
      const my = H * (0.5 - Math.sin(clamp01(nightT) * Math.PI) * 0.4);
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
    this.drawMountains(ctx, W, H, atm);
  }

  private drawMountains(ctx: Ctx, W: number, H: number, atm: Atmosphere): void {
    const horizon = H * 0.58;
    const layers = 3;
    for (let l = layers - 1; l >= 0; l--) {
      const depth = l / (layers - 1);
      const col = mix(mix(atm.palette.foliageDeep, atm.skyBottom, 0.55 + depth * 0.32), atm.lightTint, atm.lightAmount * 0.5);
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

  private drawIslandShadow(ctx: Ctx, atm: Atmosphere): void {
    const c0 = isoToScreen(0, 0);
    const c1 = isoToScreen(GRID, GRID);
    const cx = (c0.x + c1.x) / 2;
    const cy = (c0.y + c1.y) / 2 + 30;
    const rx = (GRID * TILE_W) / 2 + 110;
    const ry = (GRID * TILE_H) / 2 + 90;
    const g = ctx.createRadialGradient(cx, cy, rx * 0.5, cx, cy, rx);
    const col = mix(atm.shadowTint, { r: 40, g: 40, b: 50 }, 0.3);
    g.addColorStop(0, css(col, 0.2));
    g.addColorStop(1, css(col, 0));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawGrid(ctx: Ctx, world: World, atm: Atmosphere): void {
    ctx.save();
    ctx.lineWidth = 1 / this.camera.zoom;
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

  private drawGhost(ctx: Ctx, world: World, atm: Atmosphere, time: number): void {
    const gh = this.ghost!;
    const pulse = 0.55 + Math.sin(time * 0.004) * 0.15;
    const okCol: RGB = { r: 246, g: 240, b: 214 };
    const badCol: RGB = { r: 226, g: 130, b: 110 };
    const col = gh.valid ? okCol : badCol;

    // Подсветка занимаемых клеток
    const x0 = Math.floor(gh.tx);
    const y0 = Math.floor(gh.ty);
    for (let y = y0; y < y0 + gh.h; y++) {
      for (let x = x0; x < x0 + gh.w; x++) {
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
        ctx.fillStyle = css(col, 0.18 * pulse);
        ctx.fill();
        ctx.strokeStyle = css(col, 0.55 * pulse);
        ctx.lineWidth = 1.6 / this.camera.zoom;
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
        const fake: PlacedObject = { id: -1, type: gh.itemId, tx: gh.tx, ty: gh.ty, planted: Date.now(), rot: gh.rot, seed: 777 };
        drawObject({
          ctx,
          x: p.x,
          y: p.y,
          atm,
          g: item.growDays > 0 ? 0.55 : 1,
          obj: fake,
          time,
          wind: this.wind,
          alpha: gh.valid ? 0.62 : 0.3,
        });
      }
    }
  }

  private drawObjects(ctx: Ctx, world: World, atm: Atmosphere, time: number): void {
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
      const s = this.worldToScreen(p.x, p.y);
      if (s.x < -240 || s.x > this.viewW + 240 || s.y < -280 || s.y > this.viewH + 240) continue;
      const g = world.growth(o, now);
      // ветер берём в точке дерева — порыв проходит волной
      const wind = this.life ? this.life.windAt(cx, cy) : this.wind;
      list.push({
        depth: (cx + cy) * 100 + lvl * 20,
        draw: () => drawObject({ ctx, x: p.x, y: p.y, atm, g, obj: o, time, wind, alpha: 1 }),
      });
    }

    if (this.life) {
      for (const c of this.life.cats) {
        const tile = world.at(Math.floor(c.tx), Math.floor(c.ty));
        const lvl = tile ? tile.level : 0;
        const p = isoToScreen(c.tx, c.ty, lvl);
        list.push({ depth: (c.tx + c.ty) * 100 + lvl * 20 + 4, draw: () => drawCat(ctx, c, p.x, p.y, atm, time) });
      }
      for (const b of this.life.birds) {
        const tile = world.at(Math.floor(b.tx), Math.floor(b.ty));
        const lvl = tile ? tile.level : 0;
        const p = isoToScreen(b.tx, b.ty, lvl);
        list.push({ depth: (b.tx + b.ty) * 100 + lvl * 20 + 6, draw: () => drawBird(ctx, b, p.x, p.y, atm, time) });
      }
      for (const f of this.life.flutters) {
        const tile = world.at(Math.floor(f.tx), Math.floor(f.ty));
        const lvl = tile ? (tile.water ? tile.level - 0.26 : tile.level) : 0;
        const p = isoToScreen(f.tx, f.ty, lvl);
        list.push({ depth: (f.tx + f.ty) * 100 + lvl * 20 + 8, draw: () => drawFlutter(ctx, f, p.x, p.y, atm, time) });
      }
    }

    list.sort((a, b) => a.depth - b.depth);
    for (const e of list) e.draw();

    // Тёплое свечение окон дома изнутри
    this.drawWindowGlow(ctx, world, atm);
  }

  private drawWindowGlow(ctx: Ctx, world: World, atm: Atmosphere): void {
    if (atm.lampGlow < 0.05) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const warm: RGB = { r: 255, g: 196, b: 122 };
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const t = world.at(x, y)!;
        if (!t.indoor) continue;
        // светятся только клетки у кромки дома
        const edge = !world.at(x, y + 1)?.indoor || !world.at(x + 1, y)?.indoor;
        if (!edge) continue;
        const p = isoToScreen(x + 0.5, y + 0.5, t.level);
        glow(ctx, p.x, p.y - 10, 66, warm, atm.lampGlow * 0.28);
      }
    }
    ctx.restore();
  }

  private drawPaperGrain(ctx: Ctx, W: number, H: number): void {
    if (!this.paperPattern) {
      const p = ctx.createPattern(getPaperTile(), 'repeat');
      if (p) this.paperPattern = p;
    }
    if (!this.paperPattern) return;
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = this.paperPattern;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // лёгкое размытие краёв кадра — «краска ушла в бумагу»
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = this.paperPattern;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  private drawColorGrade(ctx: Ctx, W: number, H: number, atm: Atmosphere): void {
    // Общий тёплый/холодный «фильтр» по времени суток
    const t = atm.time;
    ctx.save();
    if (atm.golden > 0.05) {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = css({ r: 255, g: 186, b: 116 }, atm.golden * 0.26);
      ctx.fillRect(0, 0, W, H);
    }
    if (t.daylight < 0.5) {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = css({ r: 70, g: 96, b: 176 }, (1 - t.daylight * 2) * 0.32);
      ctx.fillRect(0, 0, W, H);
    }
    if (atm.season === 'winter') {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = css({ r: 190, g: 214, b: 236 }, 0.14);
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  clampCamera(): void {
    const c0 = isoToScreen(0, 0);
    const c1 = isoToScreen(GRID, GRID);
    const cx = (c0.x + c1.x) / 2;
    const cy = (c0.y + c1.y) / 2;
    const rx = (GRID * TILE_W) / 2 + 200;
    const ry = (GRID * TILE_H) / 2 + 200;
    this.camera.x = clamp(this.camera.x, cx - rx, cx + rx);
    this.camera.y = clamp(this.camera.y, cy - ry, cy + ry);
    this.camera.zoom = clamp(this.camera.zoom, 0.45, 2.4);
  }
}

export { lerp, clamp01, LEVEL_H, TILE_H, TILE_W };
