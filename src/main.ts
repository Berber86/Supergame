/**
 * «Усадьба Безмятежности» — дзен-песочница.
 * Точка входа: игровой цикл, ввод, связь мира / сцены / интерфейса.
 */

import './ui/style.css';
import { GRID, floorTo, inBounds } from './core/iso';
import { computeTime } from './core/clock';
import { clamp } from './core/rng';
import { Scene } from './render/scene';
import { buildAtmosphere } from './world/palette';
import { World } from './world/world';
import { UI, Selection } from './ui/ui';
import { ITEM_BY_ID, TERRAIN_BRUSHES } from './world/catalog';
import { Life } from './world/life';
import { TimeControl } from './core/timeControl';
import { WeatherSystem } from './world/weatherState';
import { GardenAudio } from './audio/audio';
import { DevPanel } from './ui/devPanel';
import { History } from './core/history';
import { GardenStore } from './world/gardens';
import { GardensPanel } from './ui/gardensPanel';
import { waterLoudness } from './render/water';
import { findPath, layPath } from './world/paths';
import { ShotRatio, composeScroll } from './ui/snapshot';
import { SettingsPanel, applyView, loadView } from './ui/settings';
import { PlacedObject } from './world/types';

const app = document.getElementById('app')!;

const canvas = document.createElement('canvas');
canvas.id = 'garden';
app.appendChild(canvas);

const world = new World();
const gardens = new GardenStore();
if (!gardens.load(world)) gardens.save(world);

const history = new History(world);

/** Сохранение теперь всегда идёт в активный слот усадьбы. */
function saveWorld(): void {
  gardens.save(world);
}

/**
 * Видимость кровли — настройка взгляда, а не сада: она одна на все усадьбы
 * и потому живёт отдельным ключом, а не внутри сохранения.
 */
const ROOF_KEY = 'usadba.roof.v1';

function loadRoofPref(): boolean {
  try {
    return localStorage.getItem(ROOF_KEY) !== 'off';
  } catch {
    return true;
  }
}

function saveRoofPref(visible: boolean): void {
  try {
    localStorage.setItem(ROOF_KEY, visible ? 'on' : 'off');
  } catch {
    // приватный режим — переживём
  }
}

const life = new Life();
const timeCtl = new TimeControl();
const weatherSys = new WeatherSystem();
const audio = new GardenAudio();
const scene = new Scene(canvas);
scene.centerOn(GRID / 2, GRID / 2 + 1.5);
scene.camera.zoom = 0.85;

let selection: Selection = { kind: 'none' };
let ghostRot = 0;
let zenMode = false;
let lastInteraction = performance.now();

const ui = new UI(app, world, {
  onSelect(sel) {
    selection = sel;
    ghostRot = 0;
    // Сетка нужна, когда кладут землю или предметы; пипетке и переносу — нет
    scene.showGrid = sel.kind === 'item' || sel.kind === 'brush' || sel.kind === 'fill';
    canvas.classList.toggle('building', sel.kind !== 'none');
    canvas.classList.toggle('picking', sel.kind === 'pick' || sel.kind === 'move');
    if (sel.kind !== 'path') {
      pathStart = null;
      scene.pathFrom = null;
      scene.pathPreview = null;
    }
    if (sel.kind === 'none') {
      scene.ghost = null;
      scene.highlightId = -1;
    }
    updateGhost();
  },
  onToggleBuild(open) {
    scene.showGrid = open && selection.kind !== 'none';
    if (!open) {
      scene.ghost = null;
      canvas.classList.remove('building');
    }
    wake();
  },
  onZen() {
    setZen(!zenMode);
  },
  onScreenshot() {
    takeScreenshot();
  },
  onReset() {
    world.clearSave();
    location.reload();
  },
  onUndo() {
    doUndo();
  },
  onRedo() {
    doRedo();
  },
  onBrushSize(n) {
    world.brushSize = n;
    updateGhost();
  },
  onRoof() {
    setRoofVisible(!scene.roofVisible);
  },
  onSettings() {
    settingsPanel.toggle();
  },
  onGardens() {
    gardensPanel.toggle();
  },
});

// Настройки вида применяем до первого кадра, чтобы интерфейс
// сразу открылся таким, каким игрок его оставил.
const view = loadView();
applyView(view);

const settingsPanel = new SettingsPanel(app, view, (v) => {
  scene.particles = v.particles;
});

const gardensPanel = new GardensPanel(app, world, gardens, {
  onSwitch() {
    // Мир заменился целиком: история чужой усадьбы больше не имеет смысла
    history.clear();
    scene.markTerrainDirty();
    life.reset();
    ui.select({ kind: 'none' });
    ui.renderTabs();
    ui.renderItems();
    syncHistoryUI();
    wake();
  },
  toast: (t) => ui.toast(t),
});

const devPanel = new DevPanel(app, timeCtl, weatherSys, {
  onChange() {
    scene.markTerrainDirty();
    wake();
  },
});

// Гром: звук приходит позже вспышки
weatherSys.onThunder = (d) => audio.thunder(d);

// ---------------- Отмена и повтор ----------------

function syncHistoryUI(): void {
  ui.setHistoryState(history.canUndo, history.canRedo, history.undoLabel, history.redoLabel);
}

/** Земля после отмены может измениться где угодно — перерисовываем целиком. */
function afterHistory(label: string | null, verb: string): void {
  if (!label) {
    ui.toast(verb === 'отмена' ? 'Отменять нечего' : 'Повторять нечего');
    return;
  }
  scene.markTerrainDirty();
  life.sync(world);
  ui.renderTabs();
  syncHistoryUI();
  saveWorld();
  ui.toast(verb === 'отмена' ? `Отменено: ${label}` : `Возвращено: ${label}`);
}

function doUndo(): void {
  afterHistory(history.undo(), 'отмена');
}

function doRedo(): void {
  afterHistory(history.redo(), 'повтор');
}

// ---------------- Режим созерцания ----------------

function setZen(on: boolean): void {
  zenMode = on;
  document.body.classList.toggle('zen', on);
  if (on) {
    ui.toggleBuild(false);
    ui.toggleHelp(false);
    ui.setZenNote('созерцание · любое движение вернёт интерфейс');
  } else {
    ui.setZenNote('');
  }
}

/** Интерфейс исчезает сам, когда игрок ничего не делает. */
function wake(): void {
  lastInteraction = performance.now();
  if (zenMode) setZen(false);
}

const IDLE_MS = 14000;

// ---------------- Ввод ----------------

let dragging = false;
let painting = false;
/** Объект, который сейчас переносят, и его исходное место. */
let moving: { obj: PlacedObject; fromX: number; fromY: number } | null = null;
/** Начало тропы: первый клик инструмента «Тропа». */
let pathStart: { x: number; y: number } | null = null;
let lastX = 0;
let lastY = 0;
let pointerX = 0;
let pointerY = 0;
let hasPointer = false;

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  lastX = e.clientX;
  lastY = e.clientY;
  wake();

  if (e.button === 2) {
    // ПКМ — убрать объект
    applyErase(e.clientX, e.clientY);
    return;
  }
  if (selection.kind === 'move' && e.button === 0) {
    const p = scene.pickTile(e.clientX, e.clientY, world);
    const obj = world.pickObject(p.tx, p.ty);
    if (obj) {
      history.begin('перенос', null);
      moving = { obj, fromX: obj.tx, fromY: obj.ty };
      scene.movingId = obj.id;
      painting = true;
      audio.place();
    } else {
      dragging = true;
      canvas.classList.add('dragging');
    }
    return;
  }
  if (selection.kind !== 'none' && e.button === 0) {
    painting = true;
    applyAt(e.clientX, e.clientY, true);
  } else {
    dragging = true;
    canvas.classList.add('dragging');
  }
});

canvas.addEventListener('pointermove', (e) => {
  pointerX = e.clientX;
  pointerY = e.clientY;
  hasPointer = true;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
    wake();
  }
  if (dragging) {
    scene.camera.x -= dx / scene.camera.zoom;
    scene.camera.y -= dy / scene.camera.zoom;
    scene.clampCamera();
  } else if (moving) {
    const p = scene.pickTile(e.clientX, e.clientY, world);
    const item = ITEM_BY_ID.get(moving.obj.type);
    if (item) {
      const s2 =
        item.step === 1
          ? { tx: Math.floor(p.tx - (item.w - 1) / 2), ty: Math.floor(p.ty - (item.h - 1) / 2) }
          : { tx: floorTo(p.tx, item.step), ty: floorTo(p.ty, item.step) };
      world.moveObject(moving.obj, s2.tx, s2.ty);
    }
  } else if (painting && selection.kind === 'brush') {
    applyAt(e.clientX, e.clientY, false);
  } else if (painting && selection.kind === 'item' && selection.item.step < 1) {
    // мелочи можно «рассыпать» движением
    applyAt(e.clientX, e.clientY, false);
  }
  lastX = e.clientX;
  lastY = e.clientY;
  updateGhost();
});

const endPointer = () => {
  if (moving) {
    const m = moving;
    moving = null;
    scene.movingId = -1;
    if (m.obj.tx === m.fromX && m.obj.ty === m.fromY) {
      history.abort();
    } else if (history.commit()) {
      const item = ITEM_BY_ID.get(m.obj.type);
      ui.toast(`${item?.name ?? 'Предмет'} переставлен`);
      syncHistoryUI();
    }
  } else if (painting) {
    // мазок кистью закончен — следующий станет отдельным шагом отмены
    if (history.commit()) syncHistoryUI();
    history.breakMerge();
  }
  dragging = false;
  painting = false;
  canvas.classList.remove('dragging');
  saveWorld();
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', () => {
  hasPointer = false;
  scene.ghost = null;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    wake();
    const before = scene.screenToWorld(e.clientX, e.clientY);
    const k = Math.exp(-e.deltaY * 0.0012);
    scene.camera.zoom = clamp(scene.camera.zoom * k, 0.45, 2.4);
    const after = scene.screenToWorld(e.clientX, e.clientY);
    scene.camera.x += before.x - after.x;
    scene.camera.y += before.y - after.y;
    scene.clampCamera();
    updateGhost();
  },
  { passive: false },
);

// Пинч-зум на тач
let pinchDist = 0;
canvas.addEventListener(
  'touchstart',
  (e) => {
    if (e.touches.length === 2) {
      pinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      dragging = false;
      painting = false;
    }
  },
  { passive: true },
);
canvas.addEventListener(
  'touchmove',
  (e) => {
    if (e.touches.length === 2 && pinchDist > 0) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      scene.camera.zoom = clamp(scene.camera.zoom * (d / pinchDist), 0.45, 2.4);
      pinchDist = d;
      scene.clampCamera();
      wake();
    }
  },
  { passive: true },
);

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  // Не перехватываем набор текста (переименование усадьбы)
  const el = e.target as HTMLElement | null;
  if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
  wake();

  // Отмена и повтор — до остальных клавиш
  if ((e.ctrlKey || e.metaKey) && k === 'z') {
    e.preventDefault();
    if (e.shiftKey) doRedo();
    else doUndo();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && k === 'y') {
    e.preventDefault();
    doRedo();
    return;
  }
  if (e.ctrlKey || e.metaKey) return;

  if (k === 'b') {
    ui.toggleBuild();
  } else if (k === 'z') {
    setZen(!zenMode);
  } else if (k === 'p') {
    // Shift меняет формат кадра, без него — снимаем
    if (e.shiftKey) cycleShotRatio();
    else takeScreenshot();
  } else if (k === 'h' || k === '?') {
    ui.toggleHelp();
  } else if (k === 'r') {
    ghostRot = (ghostRot + 1) % 4;
    updateGhost();
  } else if (k === 'x') {
    ui.select({ kind: 'erase' });
    ui.toggleBuild(true);
  } else if (k === 'escape') {
    if (gardensPanel.isOpen) gardensPanel.setOpen(false);
    else if (ui.selection.kind !== 'none') ui.select({ kind: 'none' });
    else ui.toggleBuild(false);
    ui.toggleHelp(false);
  } else if (k === 'g') {
    scene.showGrid = !scene.showGrid;
  } else if (k === 'i') {
    ui.toggleBuild(true);
    ui.select(ui.selection.kind === 'pick' ? { kind: 'none' } : { kind: 'pick' });
  } else if (k === 'v') {
    ui.toggleBuild(true);
    ui.select(ui.selection.kind === 'move' ? { kind: 'none' } : { kind: 'move' });
  } else if (k === 'f') {
    ui.toggleBuild(true);
    ui.fillFromKeyboard();
  } else if (k === 'l') {
    ui.toggleBuild(true);
    ui.select(ui.selection.kind === 'path' ? { kind: 'none' } : { kind: 'path' });
  } else if (k === 'r') {
    setRoofVisible(!scene.roofVisible);
  } else if (k === 's') {
    settingsPanel.toggle();
  } else if (k === 'u') {
    gardensPanel.toggle();
  } else if (k === '1' || k === '2' || k === '3') {
    ui.setBrushSize(k === '1' ? 1 : k === '2' ? 3 : 5);
  } else if (k === 't') {
    devPanel.toggle();
    devPanel.refresh();
  } else if (k === 'm') {
    toggleSound();
  } else if (k === 'arrowleft' || k === 'arrowright') {
    e.preventDefault();
    const dir = k === 'arrowright' ? 1 : -1;
    if (e.shiftKey) timeCtl.nextSeason(dir);
    else timeCtl.nudgeHour(dir * (e.altKey ? 0.25 : 1));
    scene.markTerrainDirty();
    devPanel.refresh();
  }
});

window.addEventListener('resize', () => {
  scene.resize();
  scene.markTerrainDirty();
});

// ---------------- Действия ----------------

function snapForSelection(tx: number, ty: number): { tx: number; ty: number } {
  if (selection.kind === 'item') {
    const item = selection.item;
    if (item.step === 1) {
      return { tx: Math.floor(tx - (item.w - 1) / 2), ty: Math.floor(ty - (item.h - 1) / 2) };
    }
    // Четверть-тайлы: объект центрируется на четвертинке
    return { tx: floorTo(tx, item.step), ty: floorTo(ty, item.step) };
  }
  return { tx: Math.floor(tx), ty: Math.floor(ty) };
}

function updateGhost(): void {
  if (!hasPointer || selection.kind === 'none') {
    scene.ghost = null;
    scene.highlightId = -1;
    return;
  }
  const p = scene.pickTile(pointerX, pointerY, world);
  const s = snapForSelection(p.tx, p.ty);

  // Пипетка и перенос не показывают призрак — они подсвечивают то, что под курсором
  if (selection.kind === 'pick' || selection.kind === 'move') {
    scene.ghost = null;
    const hit = moving ? null : world.pickObject(p.tx, p.ty);
    scene.highlightId = hit ? hit.id : -1;
    return;
  }
  scene.highlightId = -1;

  if (selection.kind === 'path') {
    scene.ghost = null;
    // Пока выбран только старт — показываем, куда ляжет дорога
    scene.pathPreview = pathStart ? findPath(world, pathStart, { x: Math.floor(p.tx), y: Math.floor(p.ty) }) : null;
    return;
  }

  if (selection.kind === 'fill') {
    scene.ghost = {
      kind: 'brush',
      tx: Math.floor(s.tx),
      ty: Math.floor(s.ty),
      rot: 0,
      valid: inBounds(Math.floor(s.tx), Math.floor(s.ty)),
      w: 1,
      h: 1,
    };
    return;
  }

  if (selection.kind === 'item') {
    const item = selection.item;
    const valid = inBounds(Math.floor(s.tx), Math.floor(s.ty)) && world.canPlace(item.id, s.tx, s.ty);
    scene.ghost = { kind: 'item', itemId: item.id, tx: s.tx, ty: s.ty, rot: ghostRot, valid, w: item.w, h: item.h };
  } else if (selection.kind === 'brush') {
    const b = selection.brush;
    // Кисти земли растягиваются размером 1/3/5, блоки держат свой размер
    const bw = b.kind === 'ground' ? world.brushSize : b.w;
    const bh = b.kind === 'ground' ? world.brushSize : b.h;
    const x0 = Math.floor(s.tx - (bw - 1) / 2);
    const y0 = Math.floor(s.ty - (bh - 1) / 2);
    scene.ghost = { kind: 'brush', brushId: b.id, tx: x0, ty: y0, rot: 0, valid: inBounds(x0, y0), w: bw, h: bh };
  } else {
    scene.ghost = { kind: 'erase', tx: Math.floor(s.tx), ty: Math.floor(s.ty), rot: 0, valid: true, w: 1, h: 1 };
  }
}

/** Перерисовать только то, что тронула правка земли. */
function repaintTouched(): void {
  const r = world.lastTouched;
  if (r) scene.markTilesDirty(r.x0, r.y0, r.x1, r.y1);
  else scene.markTerrainDirty();
  world.clearTouched();
}

function applyAt(sx: number, sy: number, isClick: boolean): void {
  const p = scene.pickTile(sx, sy, world);
  if (!inBounds(Math.floor(p.tx), Math.floor(p.ty))) return;

  // Пипетка: подобрать то, что уже стоит, и продолжить тем же
  if (selection.kind === 'pick') {
    pickAt(p.tx, p.ty);
    return;
  }

  if (selection.kind === 'path') {
    if (!isClick) return;
    layPathStep(p.tx, p.ty);
    return;
  }

  if (selection.kind === 'fill') {
    history.begin(`заливка «${selection.name}»`, null);
    world.clearTouched();
    if (world.floodFill(p.tx, p.ty, selection.ground)) {
      repaintTouched();
      if (history.commit()) syncHistoryUI();
      audio.place();
      flushMilestones();
    } else {
      history.abort();
      if (isClick) ui.toast('Здесь уже этот материал');
    }
    return;
  }

  if (selection.kind === 'brush') {
    const b = selection.brush;
    // Один мазок = один шаг отмены: ведение кистью склеивается по ключу
    history.begin(b.name.toLowerCase(), `brush:${b.id}`);
    world.clearTouched();
    world.applyBrush(b, p.tx, p.ty);
    repaintTouched();
    if (history.commit()) syncHistoryUI();
    flushMilestones();
    return;
  }

  if (selection.kind === 'item') {
    const item = selection.item;
    const s = snapForSelection(p.tx, p.ty);
    if (!world.canPlace(item.id, s.tx, s.ty)) {
      if (isClick) ui.toast(item.needsWater ? 'Это растёт только в воде' : 'Здесь вода — нужно другое место');
      return;
    }
    // при «рассыпании» не ставим слишком плотно
    if (!isClick) {
      const tooClose = world.objects.some(
        (o) => o.type === item.id && Math.hypot(o.tx - s.tx, o.ty - s.ty) < item.step * 0.9,
      );
      if (tooClose) return;
    }
    history.begin(item.name.toLowerCase(), isClick ? null : `scatter:${item.id}`);
    world.place(item.id, s.tx, s.ty, ghostRot);
    if (history.commit()) syncHistoryUI();
    if (item.needsWater || item.onWater) audio.splash();
    else audio.place();
    flushMilestones();
    return;
  }

  if (selection.kind === 'erase') applyErase(sx, sy);
}

/** Тропа в два клика: первый отмечает начало, второй прокладывает дорогу. */
function layPathStep(tx: number, ty: number): void {
  const x = Math.floor(tx);
  const y = Math.floor(ty);
  const here = world.at(x, y);
  if (!here || here.water || here.indoor) {
    ui.toast('Тропа здесь не ляжет');
    return;
  }

  if (!pathStart) {
    pathStart = { x, y };
    scene.pathFrom = pathStart;
    ui.setHint('Теперь отметьте, куда ведёт тропа');
    return;
  }

  const cells = findPath(world, pathStart, { x, y });
  pathStart = null;
  scene.pathFrom = null;
  scene.pathPreview = null;
  if (!cells) {
    ui.toast('Отсюда туда дороги нет');
    ui.setHint('Тропа — отметьте начало, потом конец');
    return;
  }

  history.begin('тропа', null);
  world.clearTouched();
  const laid = layPath(world, cells);
  if (laid) {
    repaintTouched();
    if (history.commit()) syncHistoryUI();
    audio.place();
    flushMilestones();
    world.checkMilestone('first_path');
    flushMilestones();
    ui.toast(`Тропа легла: ${laid} шагов`);
  } else {
    history.abort();
    ui.toast('Тропа уже проложена');
  }
  ui.setHint('Тропа — отметьте начало, потом конец');
}

/** Пипетка: под указателем может быть и предмет, и просто земля. */
function pickAt(tx: number, ty: number): void {
  const obj = world.pickObject(tx, ty);
  if (obj) {
    const item = ITEM_BY_ID.get(obj.type);
    if (item) {
      ui.openTab(item.tab);
      ui.select({ kind: 'item', item });
      ghostRot = obj.rot;
      ui.toast(`Подобрано: ${item.name}`);
      return;
    }
  }
  const t = world.at(Math.floor(tx), Math.floor(ty));
  if (t) {
    const brush = TERRAIN_BRUSHES.find((b) => b.kind === 'ground' && b.ground === t.ground);
    if (brush) {
      ui.openTab(brush.tab);
      ui.select({ kind: 'brush', brush });
      ui.toast(`Подобрано: ${brush.name}`);
      return;
    }
  }
  ui.toast('Здесь нечего подбирать');
}

function applyErase(sx: number, sy: number): void {
  const p = scene.pickTile(sx, sy, world);
  const target = world.pickObject(p.tx, p.ty);
  if (!target) return;
  history.begin('снос', null);
  world.removeObject(target);
  if (history.commit()) syncHistoryUI();
  const item = ITEM_BY_ID.get(target.type);
  ui.toast(`${item?.name ?? 'Предмет'} убран${item?.kind === 'tree' ? 'о' : ''}`);
  saveWorld();
}

function flushMilestones(): void {
  while (world.pendingMilestones.length) {
    const id = world.pendingMilestones.shift()!;
    ui.showMilestone(id);
  }
  saveWorld();
}

/** Соотношение сторон снимка — переключается там же, на кнопке. */
const SHOT_RATIOS: ShotRatio[] = ['wide', 'square', 'tall'];
const SHOT_NAMES: Record<ShotRatio, string> = {
  wide: 'широкий',
  square: 'квадрат',
  tall: 'свиток',
};
let shotRatio: ShotRatio = 'wide';

function cycleShotRatio(): void {
  shotRatio = SHOT_RATIOS[(SHOT_RATIOS.indexOf(shotRatio) + 1) % SHOT_RATIOS.length];
  ui.toast(`Снимок: ${SHOT_NAMES[shotRatio]}`);
}

function takeScreenshot(): void {
  const wasZen = zenMode;
  setZen(true);
  // Даём кадру отрисоваться без интерфейса
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const t = computeTime(Date.now());
      // Кадр обрамляем свитком: поля рисовой бумаги и подпись сезона
      const scroll = composeScroll(canvas, shotRatio, {
        season: t.season,
        year: t.year,
        time: t.label,
        garden: gardens.active?.name ?? 'Усадьба',
      });
      scroll.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `усадьба-${t.season}-год-${t.year}-${t.label.replace(':', '-')}.png`;
        a.click();
        URL.revokeObjectURL(url);
        if (!wasZen) setTimeout(() => setZen(false), 200);
        ui.toast('Снимок сохранён');
      }, 'image/png');
    });
  });
}

// ---------------- Звук ----------------

let soundOn = false;

async function toggleSound(force?: boolean): Promise<void> {
  const want = force ?? !soundOn;
  if (want) {
    await audio.start();
    audio.setEnabled(true);
    soundOn = true;
    ui.toast('Звук сада включён');
  } else {
    audio.setEnabled(false);
    soundOn = false;
    ui.toast('Тишина');
  }
  ui.setSoundState(soundOn);
}

/** Показать или убрать кровлю — и запомнить выбор. */
function setRoofVisible(visible: boolean): void {
  scene.roofVisible = visible;
  ui.setRoofState(visible);
  saveRoofPref(visible);
  ui.toast(visible ? 'Крыша на месте' : 'Крыша убрана — видно комнаты');
}

ui.onSound = () => void toggleSound();

// ---------------- Заставка ----------------

const splash = document.createElement('div');
splash.className = 'splash';
splash.innerHTML = `
  <div class="splash-inner">
    <h1>静かな庭</h1>
    <div class="sub">Усадьба Безмятежности</div>
    <div class="enter">войти в сад</div>
  </div>`;
document.body.appendChild(splash);
splash.querySelector('.enter')!.addEventListener('click', () => {
  splash.classList.add('hide');
  setTimeout(() => splash.remove(), 1400);
  wake();
  void toggleSound(true);
});

// ---------------- Игровой цикл ----------------

let last = performance.now();
let eveningChecked = '';
let audioAccum = 0;
let observeAccum = 1200;

/** Что сейчас звучит вокруг: считаем по составу сада рядом с камерой. */
function gatherAudioContext() {
  let water = 0;
  let trees = 0;
  let hasChime = false;
  let hasShishi = false;
  for (const o of world.objects) {
    const item = ITEM_BY_ID.get(o.type);
    if (!item) continue;
    if (item.kind === 'tree') trees++;
    if (o.type === 'wind_chime') hasChime = true;
    if (o.type === 'shishi') hasShishi = true;
  }
  for (let y = 0; y < 26; y += 2)
    for (let x = 0; x < 26; x += 2) if (world.at(x, y)?.water) water += 0.03;
  // Шум воды выводим из настоящего течения, а не из «где-то есть пруд»
  const loud = waterLoudness(scene.flow);
  return {
    current: loud.stream,
    falling: loud.fall,
    wind: life.windBase + life.gusts.reduce((a, g) => a + g.strength, 0) * 0.5,
    waterNearby: Math.min(1, water),
    hasChime,
    hasShishi,
    catNear: life.cats.length > 0,
    trees,
  };
}

function frame(now: number): void {
  const dt = Math.min(now - last, 60);
  last = now;

  timeCtl.tick(dt);
  const t = timeCtl.compute();
  weatherSys.update(dt, t);
  const atm = buildAtmosphere(t, weatherSys.state.overcast);

  // Веха «Сумерки» — когда игрок впервые застаёт вечер
  const dayKey = `${t.year}-${t.seasonIndex}-${Math.floor(t.dayT * 4)}`;
  if (atm.lampGlow > 0.4 && eveningChecked !== dayKey) {
    eveningChecked = dayKey;
    world.noteEvening();
    flushMilestones();
  }

  // Вехи, которые сад замечает сам. Раз в пару секунд: они про то,
  // что уже случилось, спешить некуда.
  observeAccum -= dt;
  if (observeAccum <= 0) {
    observeAccum = 2500;
    world.observe(now, t.season, atm.lampGlow > 0.55, weatherSys.state.rain > 0.3);
    flushMilestones();
  }

  // Живность и ветер
  life.update(world, t, dt, now);
  scene.wind = life.windBase;

  // Интерфейс растворяется в бездействии
  if (!zenMode && !ui.buildOpen && now - lastInteraction > IDLE_MS) setZen(true);

  scene.render(world, atm, now, dt, life, weatherSys.state);
  ui.tick(t, atm);
  devPanel.tick();

  // Звук: пересобираем «что слышно» из состава сада
  audioAccum -= dt;
  if (audioAccum <= 0) {
    audioAccum = 400;
    audio.update(400, t, weatherSys.state, gatherAudioContext());
  }

  requestAnimationFrame(frame);
}

// Кровля: восстанавливаем прошлый выбор игрока до первого кадра,
// чтобы крыша не мигала на старте.
scene.roofVisible = loadRoofPref();
scene.snapRoof();
ui.setRoofState(scene.roofVisible);
scene.particles = view.particles;

requestAnimationFrame(frame);

// Периодическое автосохранение — сад не должен теряться
setInterval(saveWorld, 20000);
window.addEventListener('beforeunload', saveWorld);

// Тихая подсказка при первом входе
setTimeout(() => {
  if (!zenMode) ui.setHint('B — открыть каталог · Z — созерцание · H — свиток');
}, 6000);
