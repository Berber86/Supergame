/** Сцена: камера, сортировка по глубине, пост-обработка «акварель на рисовой бумаге». */

import { GRID, LEVEL_H, TILE_H, TILE_W, isoToScreen, screenToIso } from '../core/iso';
import { clamp, clamp01, hash2, lerp } from '../core/rng';
import { ITEM_BY_ID } from '../world/catalog';
import { Atmosphere, RGB, css, mix, shade } from '../world/palette';
import { PlacedObject } from '../world/types';
import { World } from '../world/world';
import { Ctx, getPaperTile, glow, vignette } from './paint';
import { TerrainLayer, TileRect, drawWaterAnimation, renderTerrain } from './terrain';
import { drawCost, drawObject, drawObjectShadow } from './sprites';
import { drawHouseRoof, drawHouseWalls } from './building';
import { Life } from '../world/life';
import { drawBird, drawCat, drawFish, drawFlutter } from './creatures';
import { cacheable, cachedGrowth, drawCached, spriteFrame } from './spriteCache';
import { Weather, drawMist, drawSunShafts } from './weather';
import { RainRenderer, drawFog, drawLightning, drawWetSheen } from './rain';
import { WeatherState } from '../world/weatherState';
import { WaterFlow } from '../world/waterFlow';
import { drawCurrent, drawFalls, drawShoreRipple } from './water';

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
  /** Участок земли, который нужно перерисовать; null — весь слой. */
  private dirtyRect: TileRect | null = null;
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
  rain = new RainRenderer();
  weatherState: WeatherState | null = null;
  /** id переносимого объекта: он «приподнят» и полупрозрачен. */
  movingId = -1;
  /** id объекта под указателем — подсвечивается пипеткой и переносом. */
  highlightId = -1;
  /** Течение воды: считается по рельефу, обновляется при правках земли. */
  flow = new WaterFlow();
  /**
   * Показывать ли кровлю. Снимается кнопкой: дом и сад — одна сцена,
   * и игрок сам решает, смотреть на усадьбу снаружи или обживать комнаты.
   * Переключается плавно, чтобы крыша не мигала.
   */
  roofVisible = true;
  /** Текущая непрозрачность кровли — догоняет roofVisible. */
  private roofFade = 1;
  /** Поставить кровлю в нужное состояние без плавного перехода. */
  snapRoof(): void {
    this.roofFade = this.roofVisible ? 1 : 0;
  }

  /** Показывать ли частицы: лепестки, светлячков, бабочек, дождь. */
  particles = true;
  /** Кэш спрайтов — можно выключить для сравнения «до и после». */
  useSpriteCache = true;
  /** Начало прокладываемой тропы. */
  pathFrom: { x: number; y: number } | null = null;
  /** Предпросмотр тропы — клетки, по которым она ляжет. */
  pathPreview: { x: number; y: number }[] | null = null;

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
    this.rain.resize(w, h);
  }

  get viewW(): number {
    return this.canvas.width / this.dpr;
  }

  get viewH(): number {
    return this.canvas.height / this.dpr;
  }

  /** Перерисовать весь ландшафт (смена сезона, загрузка, отмена). */
  /** Слой для полупрозрачной кровли — заводится один раз. */
  private roof: HTMLCanvasElement | null = null;

  private roofLayer(w: number, h: number): HTMLCanvasElement {
    if (!this.roof || this.roof.width !== Math.ceil(w) || this.roof.height !== Math.ceil(h)) {
      this.roof = document.createElement('canvas');
      this.roof.width = Math.ceil(w);
      this.roof.height = Math.ceil(h);
    }
    return this.roof;
  }

  markTerrainDirty(): void {
    this.terrainDirty = true;
    this.dirtyRect = null;
    this.flow.markDirty();
  }

  /**
   * Перерисовать только тронутый участок земли. Несколько вызовов подряд
   * до следующего кадра объединяются в общий прямоугольник.
   */
  markTilesDirty(x0: number, y0: number, x1: number, y1: number): void {
    const r: TileRect = {
      x0: Math.floor(Math.min(x0, x1)),
      y0: Math.floor(Math.min(y0, y1)),
      x1: Math.floor(Math.max(x0, x1)),
      y1: Math.floor(Math.max(y0, y1)),
    };
    if (this.terrainDirty && !this.dirtyRect) return; // и так перерисуем всё
    if (this.dirtyRect) {
      this.dirtyRect = {
        x0: Math.min(this.dirtyRect.x0, r.x0),
        y0: Math.min(this.dirtyRect.y0, r.y0),
        x1: Math.max(this.dirtyRect.x1, r.x1),
        y1: Math.max(this.dirtyRect.y1, r.y1),
      };
    } else {
      this.dirtyRect = r;
    }
    this.terrainDirty = true;
    this.flow.markDirty();
  }

  /**
   * Масштаб, при котором сад целиком помещается в экран.
   *
   * На телефоне в альбомной ориентации высота около 390 px — прежний
   * нижний предел 0.45 всё ещё показывал лишь угол сада. Считаем предел
   * от размеров окна, а не берём числом.
   */
  fitZoom(): number {
    // Сад в экранных координатах: ромб шириной GRID*TILE_W и высотой GRID*TILE_H
    const w = GRID * TILE_W;
    const h = GRID * TILE_H + LEVEL_H * 4;
    // Небольшой запас по краям, чтобы сад не упирался в рамку
    return Math.min(this.viewW / (w * 1.04), this.viewH / (h * 1.12));
  }

  /**
   * Показать сад целиком.
   *
   * В книжной ориентации «целиком» не годится: узкий экран даёт масштаб
   * около 0.085, сад выходит размером с почтовую марку и разглядеть в нём
   * нечего. Поэтому там показываем не весь участок, а его обжитую середину —
   * дом с прудом, — и даём игроку отвести камеру самому.
   */
  fitToView(): void {
    const portrait = this.viewH > this.viewW;
    if (portrait) {
      // Впишем по ширине: по высоте место есть, а мельчить незачем
      const w = GRID * TILE_W * 0.62;
      this.camera.zoom = clamp(this.viewW / w, 0.16, 2.4);
      this.centerOn(GRID / 2, GRID / 2 + 1);
      this.clampCamera();
      return;
    }
    this.camera.zoom = clamp(this.fitZoom(), 0.12, 2.4);
    this.centerOn(GRID / 2, GRID / 2);
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

  render(world: World, atm: Atmosphere, time: number, dt: number, life?: Life, weatherState?: WeatherState): void {
    if (life) this.life = life;
    if (weatherState) this.weatherState = weatherState;
    const ws = this.weatherState;
    if (ws) this.rain.update(dt, ws, world);
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
      // Свет поменялся — обновлять частями нельзя, цвет плывёт по всему саду
      const full = !this.terrain || key !== this.lastAtmKey || !this.dirtyRect;
      this.terrain = renderTerrain(world, atm, 1, full ? undefined : this.terrain!, full ? undefined : this.dirtyRect!);
      this.terrainDirty = false;
      this.dirtyRect = null;
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

    // анимированная вода: сначала общие блики, потом течение и водопады
    spriteFrame();
    this.flow.ensure(world);
    drawWaterAnimation(ctx, world, atm, time);
    drawCurrent(ctx, world, this.flow, atm, time);
    drawShoreRipple(ctx, world, this.flow, atm, time);
    drawFalls(ctx, world, this.flow, atm, time);

    // карпы — в толще воды, до наземных объектов
    if (this.life) {
      for (const f of this.life.fish) drawFish(ctx, f, world, atm, time);
    }

    // дальние стены дома — за объектами интерьера
    drawHouseWalls(ctx, world, atm);

    // сетка в режиме строительства
    if (this.showGrid) this.drawGrid(ctx, world, atm);

    // предпросмотр тропы
    if (this.pathFrom || this.pathPreview) this.drawPathPreview(ctx, world, time);

    // подсветка наведённого тайла / призрак объекта
    if (this.ghost) this.drawGhost(ctx, world, atm, time);

    // --- Объекты, отсортированные по глубине ---
    this.drawObjects(ctx, world, atm, time);

    // Кровля поверх интерьера.
    //
    // Когда в комнатах что-то стоит, крыша становится полупрозрачной —
    // дом и сад по замыслу одна сцена, и обстановку должно быть видно.
    // Рисуем её на отдельном слое и накладываем разом: скаты перекрывают
    // друг друга, и прозрачность, заданная каждому по отдельности,
    // складывалась бы обратно в непрозрачную крышу.
    // Плавно догоняем нужное состояние: резкое исчезновение крыши
    // выглядит сбоем, а не выбором игрока.
    const want = this.roofVisible ? 1 : 0;
    this.roofFade += (want - this.roofFade) * Math.min(1, dt * 0.009);
    if (Math.abs(this.roofFade - want) < 0.004) this.roofFade = want;

    const roofA = this.roofFade;
    if (roofA < 0.004) {
      // крыши нет вовсе — не тратим слой
    } else if (roofA > 0.99) {
      drawHouseRoof(ctx, world, atm, time);
    } else {
      const layer = this.roofLayer(W, H);
      const lc = layer.getContext('2d')!;
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.clearRect(0, 0, layer.width, layer.height);
      lc.save();
      lc.translate(W / 2, H / 2);
      lc.scale(this.camera.zoom, this.camera.zoom);
      lc.translate(-this.camera.x, -this.camera.y);
      drawHouseRoof(lc, world, atm, time);
      lc.restore();

      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.globalAlpha = roofA;
      ctx.drawImage(layer, 0, 0);
      ctx.restore();
    }

    // мокрый блеск и круги от капель
    if (ws) {
      drawWetSheen(ctx, world, atm, ws, time);
      if (this.particles) this.rain.drawWorldLayer(ctx, world, atm, ws);
    }

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
    // Частицы можно отключить в настройках: кого-то от них укачивает,
    // а сад и без них остаётся садом.
    if (this.particles) {
      this.weather.update(dt, atm);
      this.weather.draw(ctx, atm);
    }

    // дождь, туман и молнии — поверх сцены
    if (ws && this.particles) {
      this.rain.drawScreenLayer(ctx, atm, ws);
      drawFog(ctx, W, H, atm, ws, time);
      drawLightning(ctx, W, H, ws);
    }

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

  /** Кольцо под объектом: жёлтое у наведённого, светлое у переносимого. */
  private drawObjectMarker(
    ctx: Ctx,
    cx: number,
    cy: number,
    lvl: number,
    strong: boolean,
    time: number,
  ): void {
    const p = isoToScreen(cx, cy, lvl);
    const pulse = 0.6 + Math.sin(time * 0.005) * 0.2;
    const col: RGB = strong ? { r: 250, g: 244, b: 216 } : { r: 236, g: 206, b: 138 };
    ctx.save();
    ctx.strokeStyle = css(col, (strong ? 0.75 : 0.5) * pulse);
    ctx.lineWidth = 1.8 / this.camera.zoom;
    ctx.setLineDash([5 / this.camera.zoom, 4 / this.camera.zoom]);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, TILE_W * 0.42, TILE_H * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = css(col, 0.14 * pulse);
    ctx.fill();
    ctx.restore();
  }

  /** Тропа перед прокладкой: цепочка следов от начала к концу. */
  private drawPathPreview(ctx: Ctx, world: World, time: number): void {
    const pulse = 0.6 + Math.sin(time * 0.005) * 0.2;
    const col: RGB = { r: 248, g: 242, b: 214 };

    // Отметка начала — кружок, чтобы было видно, откуда ведём
    if (this.pathFrom) {
      const t = world.at(this.pathFrom.x, this.pathFrom.y);
      const p = isoToScreen(this.pathFrom.x + 0.5, this.pathFrom.y + 0.5, t ? t.level : 0);
      ctx.save();
      ctx.strokeStyle = css(col, 0.8 * pulse);
      ctx.lineWidth = 2 / this.camera.zoom;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, TILE_W * 0.26, TILE_H * 0.26, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const cells = this.pathPreview;
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
        ctx.fillStyle = css(col, 0.2 * pulse);
        ctx.fill();
        // Тёмная подложка под светлым контуром: ночью и на снегу одна
        // светлая линия сливается с фоном и метку под пальцем не видно.
        ctx.strokeStyle = css({ r: 30, g: 24, b: 18 }, 0.34 * pulse);
        ctx.lineWidth = 3.2 / this.camera.zoom;
        ctx.stroke();
        ctx.strokeStyle = css(col, 0.85 * pulse);
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

      // На общем плане мелочь не читается: подушка мха размером в три
      // пикселя стоит столько же, сколько вблизи, но её попросту не видно.
      // На телефоне сад по умолчанию показан целиком, так что это
      // основной режим просмотра, а не редкий случай.
      if (this.camera.zoom < 0.42 && (item.kind === 'micro' || item.kind === 'flower')) continue;
      const g = world.growth(o, now);
      // ветер берём в точке дерева — порыв проходит волной
      const wind = this.life ? this.life.windAt(cx, cy) : this.wind;
      const isMoving = o.id === this.movingId;
      const isHot = o.id === this.highlightId;
      // Переносимое слегка всплывает над землёй — видно, что оно «в руке»
      const lift = isMoving ? 9 + Math.sin(time * 0.006) * 1.6 : 0;
      list.push({
        depth: (cx + cy) * 100 + lvl * 20,
        draw: () => {
          if (isMoving || isHot) this.drawObjectMarker(ctx, cx, cy, lvl, isMoving, time);

          // Дорогие неподвижные объекты идём через кэш спрайтов: дерево
          // стоит 638 мкс, и перерисовывать его каждый кадр незачем —
          // меняется только покачивание, а его даёт сдвиг при копировании.
          const cost = drawCost(o.type);
          if (this.useSpriteCache && cacheable(o.type, cost)) {
            // Ветер даём сдвигом готового спрайта. Формула повторяет ту,
            // что внутри makeTree: та же фаза, та же амплитуда с учётом
            // стадии роста. Ствол там качается втрое слабее кроны, поэтому
            // берём среднее — сдвиг всего спрайта мягче, чем у одной кроны.
            // Тот же огрублённый размер, что у спрайта в кэше: иначе тень
            // будет от дерева другой стадии роста, и края разойдутся.
            const gq = cachedGrowth(g);
            const scale = 0.18 + 0.82 * Math.pow(gq, 0.72);
            const sway = Math.sin(time * 0.0004 + o.seed) * 3 * wind * scale * 0.7;
            // Тень рисуем прямо здесь: она идёт режимом multiply по земле,
            // и в прозрачном холсте кэша ей не на что умножаться.
            drawObjectShadow({
              ctx,
              x: p.x,
              y: p.y,
              atm,
              g: gq,
              obj: o,
              time,
              wind,
              alpha: isMoving ? 0.72 : 1,
            });
            const drawn = drawCached({
              ctx,
              x: p.x + sway,
              y: p.y - lift,
              atm,
              g,
              obj: o,
              time,
              wind,
              alpha: isMoving ? 0.72 : 1,
            });
            if (drawn) return;
          }

          drawObject({
            ctx,
            x: p.x,
            y: p.y - lift,
            atm,
            g,
            obj: o,
            time,
            wind,
            alpha: isMoving ? 0.72 : 1,
          });
        },
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
      // бабочки, стрекозы и светлячки — тоже частицы
      for (const f of this.particles ? this.life.flutters : []) {
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
    // Нижний предел — «сад целиком», но не крупнее 0.45: на большом мониторе
    // не даём отдалиться в пустоту, а на телефоне позволяем увидеть всё.
    const minZoom = Math.min(0.45, this.fitZoom() * 0.85);
    this.camera.zoom = clamp(this.camera.zoom, minZoom, 2.4);
  }
}

export { lerp, clamp01, LEVEL_H, TILE_H, TILE_W };
