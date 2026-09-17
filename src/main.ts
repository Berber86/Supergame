/**
 * «Усадьба Безмятежности» — дзен-песочница.
 * Точка входа: игровой цикл, ввод, связь мира / сцены / интерфейса.
 */

import './ui/style.css';
import { GRID, floorTo, inBounds } from './core/iso';
import { computeTime } from './core/clock';
import { Scene } from './render/scene';
import { World } from './world/world';
import { UI, Selection } from './ui/ui';
import { ITEM_BY_ID, TERRAIN_BRUSHES, footprintCells } from './world/catalog';
import { Life } from './world/life';
import { TimeControl } from './core/timeControl';
import { WeatherSystem } from './world/weatherState';
import { GardenAudio } from './audio/audio';
import { DevPanel } from './ui/devPanel';
import { History } from './core/history';
import { GardenStore } from './world/gardens';
import { GardensPanel } from './ui/gardensPanel';
import { findPath, layPath } from './world/paths';
import { ShotRatio, composeScroll } from './ui/snapshot';
import { SettingsPanel, applyView, loadView } from './ui/settings';
import { isTouchDevice } from './ui/touch';
import { pointer, moving, pathStart, setupInput, touchMode } from './app/input';
import { startLoop } from './app/gameLoop';
import { PracticePanel } from './ui/practicePanel';
import { ChroniclePanel } from './ui/chroniclePanel';
import { StartScreen } from './ui/startScreen';

const app = document.getElementById('app')!;

const canvas = document.createElement('canvas');
canvas.id = 'garden';
app.appendChild(canvas);

const world = new World();
const gardens = new GardenStore();
if (!gardens.load(world)) gardens.save(world);

const history = new History(world);

/**
 * Плашка про хранилище. Тихие сбои сохранения недопустимы: если хранилище
 * заполнено, игрок должен узнать об этом сразу и успеть выгрузить сад
 * файлом, пока он есть в памяти.
 */
let storageWarn: HTMLElement | null = null;
let storageWarnKind: 'quota' | 'error' | 'broken' | null = null;

function showStorageWarn(kind: 'quota' | 'error' | 'broken'): void {
  if (storageWarnKind === kind) return;
  hideStorageWarn();
  storageWarnKind = kind;
  const el = document.createElement('div');
  el.className = 'storage-warn paper';
  const text =
    kind === 'broken'
      ? 'Прежнее сохранение оказалось повреждено и не открылось даже из копии — открыта чистая земля. Старые данные не удалены: они отложены отдельной копией.'
      : kind === 'quota'
        ? 'Хранилище браузера заполнено — сад перестал сохраняться. Выгрузите усадьбу файлом, пока она жива в памяти.'
        : 'Браузер не смог записать сад. Выгрузите усадьбу файлом на всякий случай.';
  const textEl = document.createElement('div');
  textEl.className = 'sw-text';
  textEl.textContent = text;
  const row = document.createElement('div');
  row.className = 'sw-row';
  if (kind !== 'broken') {
    const exp = document.createElement('span');
    exp.className = 'sw-btn';
    exp.textContent = 'Выгрузить сад';
    exp.addEventListener('click', () => {
      gardens.exportFile(world);
      hideStorageWarn();
    });
    row.appendChild(exp);
  }
  const ok = document.createElement('span');
  ok.className = 'sw-btn';
  ok.textContent = kind === 'broken' ? 'Понятно' : 'Скрыть';
  ok.addEventListener('click', hideStorageWarn);
  row.appendChild(ok);
  el.appendChild(textEl);
  el.appendChild(row);
  app.appendChild(el);
  storageWarn = el;
}

function hideStorageWarn(): void {
  storageWarn?.remove();
  storageWarn = null;
  storageWarnKind = null;
}

/** Сохранение теперь всегда идёт в активный слот усадьбы. */
function saveWorld(): void {
  const res = gardens.save(world);
  // Запись снова пошла — плашку убираем сами, без лишних слов.
  if (res.ok) hideStorageWarn();
  else showStorageWarn(res.reason);
}

// Слот был, но не прочитался даже из копии — честно скажем об этом:
// данные уже отложены карантином, перед игроком чистая земля.
if (gardens.lastLoadFailed) showStorageWarn('broken');

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
// Начальный вид: на большом экране — привычный крупный план, на телефоне
// сад целиком, иначе игрок видит только угол своего сада.
if (isTouchDevice()) {
  scene.fitToView();
} else {
  scene.centerOn(GRID / 2, GRID / 2 + 1.5);
  scene.camera.zoom = 0.85;
}

let selection: Selection = { kind: 'none' };
/** Свиток стартовой страницы ещё висит: сад за ним живёт, но не слушает клавиш. */
let startOpen = true;
let ghostRot = 0;
let zenMode = false;
let lastInteraction = performance.now();
/** Масштаб, к которому камера возвращается после входа: 0 — входа не было. */
let entryZoom = 0;

const ui = new UI(app, world, {
  onSelect(sel) {
    selection = sel;
    ghostRot = 0;
    // Сетка нужна, когда кладут землю или предметы; пипетке и переносу — нет
    scene.showGrid = sel.kind === 'item' || sel.kind === 'brush' || sel.kind === 'fill';
    canvas.classList.toggle('building', sel.kind !== 'none');
    canvas.classList.toggle('picking', sel.kind === 'pick' || sel.kind === 'move');
    if (sel.kind !== 'path') {
      pathStart.current = null;
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
  onTimeWorkshop() {
    devPanel.toggle();
    devPanel.refresh();
  },
  onGardens() {
    gardensPanel.toggle();
  },
  onSit() {
    practice.openMenu();
  },
  onChronicle() {
    chronicle.toggle();
    wake();
  },
});

// Летопись сада: свиток с первыми встречами. Открывается тихо, без кнопки.
const chronicle = new ChroniclePanel(app, world);

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
    // Незавершённое действие относилось к прошлому саду — отпускаем его:
    // переносимый предмет, начатая тропа, мазок кистью.
    input.cancelOngoingAction();
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
    // практика и летопись предлагают себя ровно тогда, когда исчезло всё остальное
    ui.setSitVisible(true);
    ui.setChronVisible(true);
  } else {
    ui.setZenNote('');
    ui.setSitVisible(false);
    ui.setChronVisible(false);
  }
}

/** Интерфейс исчезает сам, когда игрок ничего не делает. */
function wake(): void {
  lastInteraction = performance.now();
  if (zenMode) setZen(false);
}

const IDLE_MS = 14000;

// ---------------- Ввод ----------------
// Жесты, клавиши и их состояние — в app/input.ts; здесь только связка.

const input = setupInput({
  canvas,
  scene,
  world,
  history,
  ui,
  audio,
  timeCtl,
  gardensPanel,
  settingsPanel,
  devPanel,
  chronicle,
  selection: () => selection,
  isZenMode: () => zenMode,
  isStartOpen: () => startOpen,
  isPracticeOpen: () => practice.isOpen,
  closePractice: () => practice.close(),
  actions: {
    applyAt,
    applyErase,
    updateGhost,
    wake,
    saveWorld,
    syncHistoryUI,
    doUndo,
    doRedo,
    setZen,
    takeScreenshot,
    cycleShotRatio,
    setRoofVisible,
    toggleSound,
    rotateGhost: () => {
      ghostRot = (ghostRot + 1) % 4;
      updateGhost();
    },
  },
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
  if (!pointer.has || selection.kind === 'none') {
    scene.ghost = null;
    scene.highlightId = -1;
    return;
  }
  const p = scene.pickTile(pointer.x, pointer.y, world);
  const s = snapForSelection(p.tx, p.ty);

  // Пипетка и перенос не показывают призрак — они подсвечивают то, что под курсором
  if (selection.kind === 'pick' || selection.kind === 'move') {
    scene.ghost = null;
    const hit = moving.current ? null : world.pickObject(p.tx, p.ty);
    scene.highlightId = hit ? hit.id : -1;
    return;
  }
  scene.highlightId = -1;

  if (selection.kind === 'path') {
    scene.ghost = null;
    // Пока выбран только старт — показываем, куда ляжет дорога
    scene.pathPreview = pathStart.current
      ? findPath(world, pathStart.current, { x: Math.floor(p.tx), y: Math.floor(p.ty) })
      : null;
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
    const valid = inBounds(Math.floor(s.tx), Math.floor(s.ty)) && world.canPlace(item.id, s.tx, s.ty, ghostRot);
    const hl = footprintCells(item, s.tx, s.ty, ghostRot);
    scene.ghost = { kind: 'item', itemId: item.id, tx: s.tx, ty: s.ty, rot: ghostRot, valid, w: item.w, h: item.h, hl };
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
    if (!world.canPlace(item.id, s.tx, s.ty, ghostRot)) {
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

  if (!pathStart.current) {
    pathStart.current = { x, y };
    scene.pathFrom = pathStart.current;
    ui.setHint('Теперь отметьте, куда ведёт тропа');
    return;
  }

  const cells = findPath(world, pathStart.current, { x, y });
  pathStart.current = null;
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

/**
 * Новые строки летописи: мягкая заметка поверх сада и запись в сохранение.
 * Вехи, которые подняли эти же события, показываем следом своим чередом.
 */
function flushChronicle(): void {
  let noted = false;
  while (world.pendingNotes.length) {
    ui.showChronicleNote(world.pendingNotes.shift()!);
    noted = true;
  }
  if (world.pendingMilestones.length) flushMilestones();
  else if (noted) saveWorld();
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
  // Интерфейс живёт в DOM, а снимок собирает только холст — прятать
  // интерфейс не за чем: раньше кнопки мигали на глазах игрока, а тихие
  // строки созерцания вспыхивали поверх вернувшегося интерфейса.
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

// ---------------- Школа тишины ----------------

/** Пока открыт лист практики, сцена не рисуется вовсе: за непрозрачной
 *  бумагой картинка не нужна, а батарея телефона — нужна. */
let practiceActive = false;

const practice = new PracticePanel(app, {
  onActive(active) {
    practiceActive = active;
    if (active) {
      ui.toggleBuild(false);
      ui.setSitVisible(false);
    } else {
      wake();
    }
  },
  duck: (v) => audio.setDuck(v),
  bowl: (a) => audio.bowl(a),
  han: (a) => audio.han(a),
  breath: (phase, seconds) => audio.breath(phase, seconds),
  toast: (text) => ui.toast(text),
});

// ---------------- Заставка ----------------

// Свиток на стене: свет идёт по тем же часам, что и сад, а вход
// одновременно разблокирует звук — без касания страницы браузер его не даст.
const start = new StartScreen({
  hour: () => timeCtl.compute().dayT * 24,
  motion: view.motion,
  onEnter() {
    startOpen = false;
    wake();
    void toggleSound(true);
    // Шаг через порог: камера подаётся вперёд, а не прыгает на место.
    entryZoom = scene.camera.zoom;
    scene.camera.zoom *= 0.86;
    // Подсказка ждёт входа: за свитком её всё равно не видно.
    showTip(5000);
  },
});
start.mount(document.body);

// ---------------- Игровой цикл ----------------

startLoop({
  world,
  scene,
  life,
  weatherSys,
  audio,
  timeCtl,
  ui,
  devPanel,
  idleMs: IDLE_MS,
  isPracticeActive: () => practiceActive,
  isZenMode: () => zenMode,
  igniteZen: () => setZen(true),
  lastInteractionMs: () => lastInteraction,
  getEntryZoom: () => entryZoom,
  setEntryZoom: (v) => {
    entryZoom = v;
  },
  flushMilestones,
  flushChronicle,
});

// Кровля: восстанавливаем прошлый выбор игрока до первого кадра,
// чтобы крыша не мигала на старте.
scene.roofVisible = loadRoofPref();
scene.snapRoof();
ui.setRoofState(scene.roofVisible);
scene.particles = view.particles;

// Периодическое автосохранение — сад не должен теряться
setInterval(saveWorld, 20000);
window.addEventListener('beforeunload', saveWorld);

// Тихая подсказка при входе. На телефоне клавиш нет — называем то, что там
// действительно есть: кнопки и жесты. Показывается один раз и не поверх свитка.
let tipShown = false;

function showTip(delay: number): void {
  setTimeout(() => {
    if (zenMode || tipShown) return;
    tipShown = true;
    ui.setHint(
      touchMode
        ? 'Рука — каталог · щипок — приблизить · часы — время года'
        : 'B — открыть каталог · Z — созерцание · H — свиток',
    );
  }, delay);
}
