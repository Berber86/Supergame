import { screenToIso } from '../core/iso';
import { FrameGate } from '../render/graphics';
import { cachedCanopyDensity } from '../world/canopy';
/**
 * Игровой цикл: время, погода, живность, звук и сам кадр рендера.
 * Всё, что меняется раз в кадр или раз в паузу, — здесь.
 */

import { buildAtmosphere } from '../world/palette';
import { ITEM_BY_ID } from '../world/catalog';
import { TimeControl } from '../core/timeControl';
import { WeatherSystem } from '../world/weatherState';
import { World } from '../world/world';
import { Life } from '../world/life';
import { Scene } from '../render/scene';
import { GardenAudio } from '../audio/audio';
import { waterLoudness } from '../render/water';
import { UI } from '../ui/ui';
import { DevPanel } from '../ui/devPanel';

export interface LoopDeps {
  world: World;
  scene: Scene;
  life: Life;
  weatherSys: WeatherSystem;
  audio: GardenAudio;
  timeCtl: TimeControl;
  ui: UI;
  devPanel: DevPanel;
  /** Миллисекунды бездействия до растворения интерфейса. */
  idleMs: number;
  isPracticeActive(): boolean;
  isStartOpen?(): boolean;
  isZenMode(): boolean;
  /** Включить созерцание — по бездействию. */
  igniteZen(): void;
  lastInteractionMs(): number;
  /** Масштаб возвращающейся камеры после входа: 0 — возврата нет. */
  getEntryZoom(): number;
  setEntryZoom(v: number): void;
  flushMilestones(): void;
  /** Новые строки летописи: мягкие заметки и запись в сохранение. */
  flushChronicle(): void;
  /** После рендера — Polaroid-снимки для летописи. */
  flushChronicleSnaps(): void;
  /** Растущий сад: тик действий, строка выбора, подсказка об отказе. */
  growFrame(dt: number): void;
}

export function startLoop(deps: LoopDeps): void {
  const { world, scene, life, weatherSys, audio, timeCtl, ui, devPanel } = deps;

  let last = performance.now();
  const simulationGate = new FrameGate(),
    renderGate = new FrameGate();
  let renderDt = 0;
  let eveningChecked = '';
  let audioAccum = 0;
  let observeAccum = 1200;

  /** Что сейчас звучит вокруг: считаем по составу сада рядом с камерой. */
  function gatherAudioContext(now: number) {
    let water = 0;
    let trees = 0,
      foliage = 0;
    let hasChime = false;
    let chimeWind = 0;
    const ear = screenToIso(scene.camera.x, scene.camera.y);
    let hasShishi = false;
    for (const o of world.objects) {
      const item = ITEM_BY_ID.get(o.type);
      if (!item) continue;
      if (item.kind === 'tree') {
        trees++;
        foliage += 0.18 + 0.82 * cachedCanopyDensity(o.type, o.seed, now);
      }
      if (o.type === 'wind_chime') {
        hasChime = true;
        const distance = Math.hypot(o.tx + 0.5 - ear.x, o.ty + 0.5 - ear.y);
        chimeWind = Math.max(chimeWind, life.windAt(o.tx + 0.5, o.ty + 0.5) * Math.max(0, 1 - distance / 14));
      }
      if (o.type === 'shishi') hasShishi = true;
    }
    for (let y = 0; y < 26; y += 2) for (let x = 0; x < 26; x += 2) if (world.at(x, y)?.water) water += 0.03;
    // Шум воды выводим из настоящего течения, а не из «где-то есть пруд»
    const loud = waterLoudness(scene.flow);
    return {
      current: loud.stream,
      falling: loud.fall,
      wind: life.windAt(ear.x, ear.y),
      chimeWind,
      waterNearby: Math.min(1, water),
      hasChime,
      hasShishi,
      catNear: life.cats.length > 0,
      frogs: life.residents.frogs.filter((f) => f.hidden <= 0 && !f.gone).length,
      trees,
      foliage: trees ? foliage / trees : 0,
    };
  }

  let frameError = false;

  function frame(now: number): void {
    if (document.hidden || deps.isStartOpen?.()) {
      last = now;
      simulationGate.reset();
      renderGate.reset();
      renderDt = 0;
      requestAnimationFrame(frame);
      return;
    }
    if (!simulationGate.due(now, 60)) {
      requestAnimationFrame(frame);
      return;
    }
    // dt зажат с обеих сторон: после сна устройства или возврата вкладки
    // метка rAF может прийти раньше прошлой — отрицательный dt отравил бы
    // все возрасты (круги на воде и т.п.) и уронил бы кадр исключением.
    const dt = Math.min(Math.max(now - last, 0), 60);
    last = now;
    renderDt = Math.min(100, renderDt + dt);

    try {
      step(now, dt);
    } catch (e) {
      // Кадр не должен ронять цикл: одна плохая отрисовка — это пропуск
      // кадра, а не вечное «зависание» с застывшей сценой.
      if (!frameError) {
        frameError = true;
        console.error('Кадр сброшен из-за ошибки:', e);
      }
    }
    requestAnimationFrame(frame);
  }

  function step(now: number, dt: number): void {
    // Холст ещё не в документе или вкладка схлопнута — рисовать нечего.
    if (scene.viewW < 1 || scene.viewH < 1) return;

    timeCtl.tick(dt);
    const t = timeCtl.compute();
    weatherSys.update(dt, t);
    const atm = buildAtmosphere(t, weatherSys.state.overcast);

    // Веха «Сумерки» — когда игрок впервые застаёт вечер
    const dayKey = `${t.year}-${t.seasonIndex}-${Math.floor(t.dayT * 4)}`;
    if (atm.lampGlow > 0.4 && eveningChecked !== dayKey) {
      eveningChecked = dayKey;
      world.noteEvening();
      deps.flushMilestones();
    }

    // Вехи, которые сад замечает сам. Раз в пару секунд: они про то,
    // что уже случилось, спешить некуда.
    observeAccum -= dt;
    if (observeAccum <= 0) {
      observeAccum = 2500;
      // Возраст деревьев меряется от даты посадки: нужны настоящие
      // миллисекунды, а не счётчик кадров (иначе «старое дерево» не созрело бы).
      world.observe(t.now, t.season, atm.lampGlow > 0.55, weatherSys.state.rain > 0.3);
      deps.flushMilestones();
    }

    // Живность и ветер; погода достаётся жителям: лягушки любят дождь,
    // стрекозы его прячут, птицы в ливень сидят по укрытиям.
    life.update(world, t, dt, now, weatherSys.state);
    scene.wind = life.windBase;
    deps.flushChronicle();
    deps.growFrame(dt);

    // Интерфейс растворяется в бездействии
    if (!deps.isZenMode() && !ui.buildOpen && now - deps.lastInteractionMs() > deps.idleMs) deps.igniteZen();

    // Плавное возвращение камеры после входа: сколько бы ни шёл шаг,
    // через порог игрок входит, а не оказывается.
    if (deps.getEntryZoom() > 0) {
      const k = scene.motion ? 1 - Math.pow(0.004, dt / 1000) : 1;
      scene.camera.zoom += (deps.getEntryZoom() - scene.camera.zoom) * k;
      if (Math.abs(deps.getEntryZoom() - scene.camera.zoom) < 0.002 || !Number.isFinite(scene.camera.zoom)) {
        scene.camera.zoom = deps.getEntryZoom();
        deps.setEntryZoom(0);
      }
      scene.clampCamera();
    }

    // До выбора сада frame() не вызывает step() вообще — даже для прогрева.
    // Под листом практики/энциклопедии сад не рисуется.
    if (!deps.isPracticeActive() && renderGate.due(now, scene.graphicsProfile.fps)) {
      scene.render(world, atm, now, renderDt, life, weatherSys.state);
      renderDt = 0;
      deps.flushChronicleSnaps();
    }
    ui.tick(t, atm);
    devPanel.tick();

    // Звук: пересобираем «что слышно» из состава сада
    audioAccum -= dt;
    if (audioAccum <= 0) {
      audioAccum = 400;
      audio.update(400, t, weatherSys.state, gatherAudioContext(t.now));
    }
  }

  requestAnimationFrame(frame);
}
