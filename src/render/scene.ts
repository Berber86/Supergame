import { CALM, makeWindSampler, type WindSampler } from '../world/wind';
import { GRAPHICS, isGraphicsQuality, type GraphicsQuality } from './graphics';
import { crownCacheKey, crownCacheTime } from '../world/phenology';
import { rainField, rainMaterial, drawRainGround, drawHouseDrips } from './afterRain';
import { drawGroundLife } from './groundLife';
/** Сцена: камера, сортировка по глубине, пост-обработка «акварель на рисовой бумаге». */

import { GRID, LEVEL_H, TILE_H, TILE_W, isoToScreen, screenToIso } from '../core/iso';
import { clamp, clamp01, lerp } from '../core/rng';
import { Atmosphere, mix } from '../world/palette';
import { World } from '../world/world';
import { Ctx, vignette } from './paint';
import { drawGrowFog } from './growFog';
import { TerrainLayer, TileRect, drawWaterAnimation, renderTerrain } from './terrain';
import { drawHouseRoof, drawHouseWalls, drawHouseShade } from './building';
import { Life } from '../world/life';
import { drawFish } from './creatures';
import { drawRipple } from './residents';
import { spriteFrame } from './spriteCache';
import { Weather, drawMist, drawSunShafts } from './weather';
import { RainRenderer, drawFog, drawLightning } from './rain';
import { WeatherState } from '../world/weatherState';
import { WaterFlow } from '../world/waterFlow';
import { drawWinterIce } from './winterIce';
import { buildLocalLights, drawLocalSurfaceLight, drawLocalWallLight } from './localLight';
import { drawCurrent, drawFalls, drawShoreRipple } from './water';
import { makeWaterMotion, type WaterRing } from './waterMotion';
import {
  drawSky,
  drawIslandShadow,
  drawGrid,
  drawPathPreview,
  drawGhost,
  drawObjects,
  drawAnimalReflections,
  drawPaperGrain,
  drawColorGrade,
  drawAerialPerspective,
  drawSunGlow,
} from './scene-steps';

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface GhostPreview {
  kind: 'item' | 'brush' | 'erase' | 'mirage';
  itemId?: string;
  brushId?: string;
  tx: number;
  ty: number;
  rot: number;
  valid: boolean;
  w: number;
  h: number;
  /** Клетки настоящего отпечатка с учётом поворота; если нет — w×h от (tx,ty). */
  hl?: { x0: number; y0: number; x1: number; y1: number };
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
  private quality: GraphicsQuality = 'high';
  motion = true;
  /** Optional travelling gusts. Default rendering uses inexpensive scalar sway. */
  smartWind = false;
  get graphicsQuality(): GraphicsQuality {
    return this.quality;
  }
  get graphicsProfile() {
    return GRAPHICS[this.quality];
  }
  get pixelRatio(): number {
    return this.dpr;
  }
  setQuality(value: GraphicsQuality): void {
    if (!isGraphicsQuality(value) || value === this.quality) return;
    this.quality = value;
    this.resize();
  }
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
  /** Diagnostic comparison; not saved in the garden. */
  localLighting = true;
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
    this.dpr = Math.min(window.devicePixelRatio || 1, this.graphicsProfile.dpr);
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
    const vw = this.viewW;
    const vh = this.viewH;
    if (vw < 1 || vh < 1 || w < 1 || h < 1) return 0.2;
    // Небольшой запас по краям, чтобы сад не упирался в рамку
    const zx = vw / (w * 1.04);
    const zy = vh / (h * 1.12);
    const z = Math.min(zx, zy);
    if (!Number.isFinite(z) || z <= 0) return 0.2;
    return z;
  }

  /**
   * Показать сад целиком.
   *
   * В книжной ориентации «целиком» не годится: узкий экран даёт масштаб
   * около 0.085, сад выходит размером с почтовую марку и разглядеть в нём
   * нечего. Поэтому там показываем не весь участок, а его обжитую середину —
   * дом с прудом, — и даём игроку отвести камеру самому.
   */
  fitToView(world?: World): void {
    const portrait = this.viewH > this.viewW;
    if (portrait) {
      // Впишем по ширине: по высоте место есть, а мельчить незачем
      const w = GRID * TILE_W * 0.48;
      this.camera.zoom = clamp(this.viewW / w, 0.16, 6);
      const bridges = world?.objects.filter((o) => o.type === 'bridge' || o.type === 'plank_bridge') ?? [];
      if (bridges.length) {
        this.centerOn(
          bridges.reduce((n, o) => n + o.tx + 0.5, 0) / bridges.length,
          bridges.reduce((n, o) => n + o.ty + (o.type === 'bridge' ? 1.5 : 1), 0) / bridges.length,
        );
      } else this.centerOn(GRID / 2, GRID / 2 + 1);
      // Keep the focal point above the bottom toolbar, rather than beneath it.
      this.camera.y += (this.viewH * 0.04) / this.camera.zoom;
      this.clampCamera();
      return;
    }
    this.camera.zoom = clamp(this.fitZoom(), 0.12, 6);
    this.centerOn(GRID / 2, GRID / 2);
  }

  centerOn(tx: number, ty: number): void {
    const p = isoToScreen(tx, ty);
    this.camera.x = p.x;
    this.camera.y = p.y;
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    const z = this.camera.zoom;
    const safeZ = !Number.isFinite(z) || z < 0.05 ? 0.2 : z;
    return {
      x: (sx - this.viewW / 2) / safeZ + this.camera.x,
      y: (sy - this.viewH / 2) / safeZ + this.camera.y,
    };
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    const z = this.camera.zoom;
    const safeZ = !Number.isFinite(z) || z < 0.05 ? 0.2 : z;
    return {
      x: (wx - this.camera.x) * safeZ + this.viewW / 2,
      y: (wy - this.camera.y) * safeZ + this.viewH / 2,
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
    return `${crownCacheKey('__surface', 0, atm.time.now)}|${atm.season}|${Math.round(atm.exposure * 22)}|${Math.round(atm.lightAmount * 22)}|${Math.round(
      atm.lightTint.r / 9,
    )}|${Math.round(atm.lightTint.b / 9)}|${Math.round(atm.sunDir.x / 0.34)}`;
  }

  render(world: World, atm: Atmosphere, time: number, dt: number, life?: Life, weatherState?: WeatherState): void {
    if (life) this.life = life;
    if (weatherState) this.weatherState = weatherState;
    const ws = this.weatherState;
    try {
      if (ws && this.particles) this.rain.update(dt, ws, world, this.graphicsProfile.particles);
      else this.rain.clear();
    } catch (e) {
      console.warn('[scene] rain update', e);
    }
    const profile = this.graphicsProfile;
    const windField: WindSampler | undefined = this.smartWind
      ? this.life
        ? (x, y, lag) => this.life!.windVectorAt(x, y, lag)
        : makeWindSampler(time)
      : undefined;
    const ctx = this.ctx;
    const W = this.viewW;
    const H = this.viewH;
    if (W < 1 || H < 1) return;
    if (!Number.isFinite(this.camera.x) || !Number.isFinite(this.camera.y) || !Number.isFinite(this.camera.zoom)) {
      console.warn('[scene] camera NaN, resetting');
      this.camera.x = 0;
      this.camera.y = 0;
      this.camera.zoom = 0.3;
    }

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // --- Небо / фон ---
    drawSky(ctx, W, H, atm, time);

    // --- Ландшафт (кэшируется) ---
    const key = this.atmKey(atm);
    if (this.terrainDirty || key !== this.lastAtmKey || !this.terrain) {
      // Свет поменялся — обновлять частями нельзя, цвет плывёт по всему саду
      const full = !this.terrain || key !== this.lastAtmKey || !this.dirtyRect;
      const terrainAtm = { ...atm, time: { ...atm.time, now: crownCacheTime('__surface', 0, atm.time.now) } };
      this.terrain = renderTerrain(
        world,
        terrainAtm,
        1,
        full ? undefined : this.terrain!,
        full ? undefined : this.dirtyRect!,
      );
      this.terrainDirty = false;
      this.dirtyRect = null;
      this.lastAtmKey = key;
    }

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    // мягкая тень-«подложка» под всем островом
    drawIslandShadow(ctx, atm);

    if (this.terrain) {
      ctx.drawImage(this.terrain.canvas, this.terrain.ox, this.terrain.oy);
    }

    drawGroundLife(ctx, world, atm, {
      x: this.camera.x,
      y: this.camera.y,
      width: W,
      height: H,
      zoom: this.camera.zoom,
      detail: profile.groundDetail,
    });

    drawRainGround(ctx, world, atm, ws ?? undefined, time, {
      x: this.camera.x,
      y: this.camera.y,
      width: W,
      height: H,
      zoom: this.camera.zoom,
    });
    const rainReceivers = rainField(world);

    // Pond bed is in terrain. Fish must be BELOW reflections, glare and ripples.
    spriteFrame();
    this.flow.ensure(world);
    if (this.life) for (const f of this.life.fish) drawFish(ctx, f, world, atm, time);
    const rings: WaterRing[] = (this.life?.residents.ripples ?? []).map((r) => ({
      tx: r.x,
      ty: r.y,
      age: r.age,
      life: 1600,
      max: r.big ? 15 : 8,
      start: r.big ? 3 : 2,
      strength: r.big ? 1.5 : 1,
    }));
    if (this.particles && ws && ws.rain > 0.02) rings.push(...this.rain.waterRipples);
    const waterMotion = makeWaterMotion(world, this.flow, time, this.wind, rings, windField);
    drawWaterAnimation(
      ctx,
      world,
      atm,
      time,
      this.wind,
      waterMotion,
      rainReceivers ? (type, x, y) => rainMaterial(atm, rainReceivers, ws ?? undefined, type, x, y) : undefined,
      {
        view: {
          minX: this.camera.x - W / (2 * this.camera.zoom) - 8,
          maxX: this.camera.x + W / (2 * this.camera.zoom) + 8,
          minY: this.camera.y - H / (2 * this.camera.zoom) - 8,
          maxY: this.camera.y + H / (2 * this.camera.zoom) + 8,
        },
        detail: profile.waterDetail,
        objectWind: this.motion ? this.wind : 0,
        windField,
        plantMotion: this.motion,
        simpleWind: this.graphicsQuality === 'low',
        reflectionStep: Math.max(profile.reflectionStep, 2 / this.camera.zoom),
      },
    );
    drawAnimalReflections(ctx, world, atm, time, {
      rainWeather: ws ?? undefined,
      life: this.life,
      waterMotion,
      wind: this.wind,
      zoom: this.camera.zoom,
      camX: this.camera.x,
      camY: this.camera.y,
      viewW: this.viewW,
      viewH: this.viewH,
      movingId: this.movingId,
      highlightId: this.highlightId,
      useSpriteCache: this.useSpriteCache,
      particles: this.particles,
      motion: this.motion,
      windField,
      simpleWind: this.graphicsQuality === 'low',
    });
    drawCurrent(ctx, world, this.flow, atm, time);
    drawShoreRipple(ctx, world, this.flow, atm, time);
    drawFalls(ctx, world, this.flow, atm, time);

    if (this.life) {
      // круги на воде: лягушка нырнула, птица выкупалась
      for (const r of this.life.residents.ripples) {
        const tile = world.at(Math.floor(r.x), Math.floor(r.y));
        const lvl = (tile ? tile.level : 0) - 0.26;
        const p = isoToScreen(r.x, r.y, lvl);
        drawRipple(ctx, r, p.x, p.y, atm);
      }
    }

    const want = this.roofVisible ? 1 : 0;
    this.roofFade += (want - this.roofFade) * (this.motion ? Math.min(1, dt * 0.009) : 1);
    if (Math.abs(this.roofFade - want) < 0.004) this.roofFade = want;

    drawHouseShade(ctx, world, atm, this.roofFade);
    const localLights = this.localLighting
      ? buildLocalLights(world, atm, time, { x: this.camera.x, y: this.camera.y }, this.movingId)
      : { world, lights: [], barriers: [] };
    drawLocalSurfaceLight(ctx, localLights, time);
    drawWinterIce(ctx, world, atm, this.flow);

    // дальние стены дома — за объектами интерьера
    drawHouseWalls(ctx, world, atm);
    drawLocalWallLight(ctx, localLights);

    // сетка в режиме строительства
    if (this.showGrid) drawGrid(ctx, world, atm, this.camera.zoom);

    // предпросмотр тропы
    if (this.pathFrom || this.pathPreview)
      drawPathPreview(ctx, world, time, this.pathFrom, this.pathPreview, this.camera.zoom);

    // подсветка наведённого тайла / призрак объекта
    if (this.ghost)
      drawGhost(
        ctx,
        world,
        atm,
        time,
        this.ghost,
        this.motion ? this.wind : 0,
        this.camera.zoom,
        this.motion ? windField : () => CALM,
        this.graphicsQuality === 'low',
      );

    // --- Объекты, отсортированные по глубине ---
    drawObjects(ctx, world, atm, time, {
      localLights: profile.objectLight ? localLights : undefined,
      rainReceivers,
      rainWeather: ws ?? undefined,
      life: this.life,
      waterMotion,
      wind: this.wind,
      zoom: this.camera.zoom,
      camX: this.camera.x,
      camY: this.camera.y,
      viewW: this.viewW,
      viewH: this.viewH,
      movingId: this.movingId,
      highlightId: this.highlightId,
      useSpriteCache: this.useSpriteCache,
      particles: this.particles,
      motion: this.motion,
      windField,
      simpleWind: this.graphicsQuality === 'low',
    });

    // Кровля поверх интерьера.
    //
    // При переключении вида крыша плавно исчезает, открывая интерьер.
    // Рисуем её на отдельном слое и накладываем разом: скаты перекрывают
    // друг друга, и прозрачность, заданная каждому по отдельности,
    // складывалась бы обратно в непрозрачную крышу.
    // Плавно догоняем нужное состояние: резкое исчезновение крыши
    // выглядит сбоем, а не выбором игрока.
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
      if (this.particles) drawHouseDrips(ctx, world, atm, ws, time, roofA);
      if (this.particles) this.rain.drawWorldLayer(ctx, world, atm, ws);
    }

    // Воздушная перспектива: даль уходит в пелену поверх земли и объектов
    drawAerialPerspective(ctx, atm);

    // Туман неоткрытой земли: поверх всего мира, под атмосферными слоями
    if (world.grow) drawGrowFog(ctx, world, time, this.camera.zoom);

    ctx.restore();

    // --- Атмосферные слои поверх сцены ---
    if (profile.shafts) drawSunShafts(ctx, W, H, atm, time);
    if (profile.mist) drawMist(ctx, W, H, atm, time);
    // лепестки и листья, сорванные ветром с конкретных деревьев
    if (this.life) {
      for (const e of this.life.takeEmitted()) {
        if (!this.particles) continue;
        const tile = world.at(Math.floor(e.x), Math.floor(e.y));
        const lvl = tile ? tile.level : 0;
        const wp = isoToScreen(e.x, e.y, lvl);
        const sp = this.worldToScreen(wp.x, wp.y - 70);
        if (sp.x > -60 && sp.x < W + 60 && sp.y > -60 && sp.y < H + 60) {
          this.weather.emitAt(sp.x, sp.y, e.kind, e.seed, Math.round(96 * profile.particles), { x: e.x, y: e.y });
        }
      }
    }
    // Частицы можно отключить в настройках: кого-то от них укачивает,
    // а сад и без них остаётся садом.
    if (this.particles) {
      this.weather.update(dt, atm, windField, this.camera.zoom);
      this.weather.draw(ctx, atm);
    } else this.weather.clear();

    // дождь, туман и молнии — поверх сцены
    if (ws && this.particles) {
      this.rain.drawScreenLayer(ctx, atm, ws);
      drawFog(ctx, W, H, atm, ws, time);
      drawLightning(ctx, W, H, ws);
    }

    // Солнце «в объективе»: тёплая заливка со стороны светила поверх мира —
    // сам диск часто закрыт домом, но закат должен читаться и без неба
    drawSunGlow(ctx, W, H, atm);

    // --- Пост-обработка ---
    if (profile.paper) this.paperPattern = drawPaperGrain(ctx, W, H, this.paperPattern);
    drawColorGrade(ctx, W, H, atm);
    vignette(ctx, W, H, mix(atm.shadowTint, { r: 60, g: 50, b: 40 }, 0.4), atm.time.isNight ? 0.5 : 0.35);

    ctx.restore();
  }

  /** Кольцо под объектом: жёлтое у наведённого, светлое у переносимого. */

  /** Тропа перед прокладкой: цепочка следов от начала к концу. */

  clampCamera(): void {
    const c0 = isoToScreen(0, 0);
    const c1 = isoToScreen(GRID, GRID);
    const cx = (c0.x + c1.x) / 2;
    const cy = (c0.y + c1.y) / 2;
    const rx = (GRID * TILE_W) / 2 + 200;
    const ry = (GRID * TILE_H) / 2 + 200;
    if (!Number.isFinite(this.camera.x)) this.camera.x = cx;
    if (!Number.isFinite(this.camera.y)) this.camera.y = cy;
    if (!Number.isFinite(this.camera.zoom) || this.camera.zoom <= 0) this.camera.zoom = 0.3;
    this.camera.x = clamp(this.camera.x, cx - rx, cx + rx);
    this.camera.y = clamp(this.camera.y, cy - ry, cy + ry);
    // Нижний предел — «сад целиком», но не крупнее 0.45 и не меньше 0.12,
    // иначе деление на zoom даёт Infinity и камера замирает.
    const fz = this.fitZoom();
    const minZoom = clamp(Math.min(0.45, fz * 0.85), 0.12, 0.45);
    this.camera.zoom = clamp(this.camera.zoom, minZoom, 6);
  }
}

export { lerp, clamp01, LEVEL_H, TILE_H, TILE_W };
