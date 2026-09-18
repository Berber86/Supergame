/**
 * «Усадьба Безмятежности» — дзен-песочница.
 * Точка входа: игровой цикл, ввод, связь мира / сцены / интерфейса.
 */

import './ui/style.css';
import { GRID, floorTo, inBounds } from './core/iso';
import { Scene } from './render/scene';
import { World } from './world/world';
import { GROW_BANK_CAP, growOfferReady, growThreshold, newGrowState, seedGrowWorld, GROW_ACTION_MS } from './world/grow';
import { moving, pathStart, pointer, setupInput } from './app/input';
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
import { SettingsPanel, applyView, loadView } from './ui/settings';
import { isTouchDevice } from './ui/touch';
import { startLoop } from './app/gameLoop';
import { PracticePanel } from './ui/practicePanel';
import { ChroniclePanel } from './ui/chroniclePanel';
import { ChronicleToast } from './ui/chronicleToast';
import { StartScreen } from './ui/startScreen';
import { isoToScreen } from './core/iso';

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

/** Каталог видит только то, что влезает в текущий растущий сад. */
function syncGrowRect(): void {
  const r = world.grow?.rect;
  growRectKey = r ? `${r.x},${r.y},${r.w},${r.h}` : '';
  ui.setGrowRect(r ? { w: r.w, h: r.h } : null);
}

/** Сохранение теперь всегда идёт в активный слот усадьбы. */
function saveWorld(): void {
  syncRoofButton();
  syncGrowRect();
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

// Как ставит инструмент: одиночное касание или мазок движением.
// Выбор игрока переживает перезагрузку — привычка руки не должна теряться.
function loadPaintPref(): 'tap' | 'stroke' {
  try {
    return localStorage.getItem('usadba.paintMode') === 'tap' ? 'tap' : 'stroke';
  } catch {
    return 'stroke';
  }
}
let paintMode: 'tap' | 'stroke' = loadPaintPref();
/** Свиток стартовой страницы ещё висит: сад за ним живёт, но не слушает клавиш. */
let startOpen = true;
let ghostRot = 0;
let zenMode = false;
let lastInteraction = performance.now();
/** Масштаб, к которому камера возвращается после входа: 0 — входа не было. */
let entryZoom = 0;

const ui = new UI(app, world, {
  onSelect(sel) {
    // Смена инструмента убирает ждущий призрак бесплатно
    if (pendingPlace && (sel.kind !== 'item' || sel.item.id !== pendingPlace.itemId)) cancelPlace();
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
      clearPending();
      scene.ghost = null;
      canvas.classList.remove('building');
    }
    wake();
  },
  onConfirmPlace() {
    confirmPlace();
  },
  onCancelPlace() {
    cancelPlace();
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
  onGrowLine() {
    const g = world.grow;
    if (!g || !growOfferReady(g)) return;
    g.choosing = true;
    saveWorld();
  },
  onRotate() {
    rotateGhost();
  },
  onPaintMode(m) {
    paintMode = m;
    ui.setPaintMode(m);
    try {
      localStorage.setItem('usadba.paintMode', m);
    } catch {
      /* приватный режим — переживём */
    }
    ui.setHint(
      m === 'stroke'
        ? 'Мазок: зажмите и ведите — кисть и мелочь сыплются движением'
        : 'Касание: клик ставит один предмет, движение ведёт камеру',
    );
  },
  onChronicle() {
    chronicle.toggle();
    wake();
  },
});

// Летопись сада: свиток с первыми встречами. Открывается тихо, без кнопки.
const chronicle = new ChroniclePanel(app, world);

/** Плавный перенос камеры к событию летописи */
function smoothPanTo(tx: number, ty: number): void {
  const target = isoToScreen(tx, ty);
  const startX = scene.camera.x;
  const startY = scene.camera.y;
  const dx = target.x - startX;
  const dy = target.y - startY;
  const dur = 900;
  const t0 = performance.now();
  const ease = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / dur);
    const k = ease(p);
    scene.camera.x = startX + dx * k;
    scene.camera.y = startY + dy * k;
    scene.clampCamera();
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  wake();
}

const chronicleToast = new ChronicleToast(app, (x, y) => {
  smoothPanTo(x, y);
});

// Настройки вида применяем до первого кадра, чтобы интерфейс
// сразу открылся таким, каким игрок его оставил.
const view = loadView();
applyView(view);

// Звук: состояние живёт выше панели настроек — её строка «Звук сада»
// спрашивает его уже в момент постройки.
let soundOn = false;

const settingsPanel = new SettingsPanel(
  app,
  view,
  (v) => {
    scene.particles = v.particles;
  },
  {
    get: () => soundOn,
    toggle: () => void toggleSound(),
  },
);

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
    syncRoofButton();
    syncGrowRect();
    wake();
  },
  toast: (t) => ui.toast(t),
});

const devPanel = new DevPanel(app, timeCtl, weatherSys, {
  onChange() {
    scene.markTerrainDirty();
    wake();
  },
  getGrow() {
    const g = world.grow;
    if (!g) return null;
    return {
      bank: g.bank,
      progress: g.progress,
      stage: g.stage,
      need: growThreshold(g.stage),
    };
  },
  giveGrowAction() {
    const g = world.grow;
    if (!g) {
      ui.toast('Сначала войдите в растущий сад');
      return;
    }
    if (g.bank >= GROW_BANK_CAP) {
      ui.toast(`Банк полон: ${GROW_BANK_CAP}/${GROW_BANK_CAP}`);
      return;
    }
    g.bank = Math.min(GROW_BANK_CAP, g.bank + 1);
    g.tick = Date.now();
    saveWorld();
    ui.toast(`Дано действие — теперь ${g.bank}/${GROW_BANK_CAP}`);
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
  cancelPlace();
  afterHistory(history.undo(), 'отмена');
}

function doRedo(): void {
  cancelPlace();
  afterHistory(history.redo(), 'повтор');
}

// ---------------- Режим созерцания ----------------

/** Интерфейс растворяется без движения: без режима, просто тишина экрана. */
function setZen(on: boolean): void {
  zenMode = on;
  document.body.classList.toggle('zen', on);
  if (on) {
    ui.toggleBuild(false);
    ui.toggleHelp(false);
    settingsPanel.setOpen(false);
    gardensPanel.setOpen(false);
  } else {
    ui.setGrowVisible(growLineShown);
  }
}

/** Интерфейс исчезает сам, когда игрок ничего не делает. */
function wake(): void {
  lastInteraction = performance.now();
  if (zenMode) setZen(false);
}

const IDLE_MS = 20000;

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
  isStartOpen: () => startOpen,
  isPracticeOpen: () => practice.isOpen,
  closePractice: () => practice.close(),
  paintMode: () => paintMode,
  actions: {
    applyAt,
    applyErase,
    growPick,
    updateGhost,
    wake,
    saveWorld,
    syncHistoryUI,
    doUndo,
    doRedo,
    setRoofVisible,
    toggleSound,
    rotateGhost,
    cancelPlace,
  },
});

// ---------------- Действия ----------------

/** Поворот на 90°: ждущий призрак крутится на месте, обычный — до постановки. */
function rotateGhost(): void {
  if (pendingPlace) {
    pendingPlace.rot = (pendingPlace.rot + 1) % 4;
    syncPendingGhost();
    return;
  }
  ghostRot = (ghostRot + 1) % 4;
  updateGhost();
}

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

/**
 * Призрак, ждущий подтверждения: только в растущем саду.
 * Ставится тапом, объект появляется лишь на ✓; любое другое действие
 * (кроме движения и масштаба камеры) убирает призрак бесплатно.
 */
let pendingPlace: { itemId: string; tx: number; ty: number; rot: number } | null = null;

function clearPending(): void {
  pendingPlace = null;
  ui.showConfirm(false);
}

/** Отменить призрак бесплатно: действие роста не тратится. */
function cancelPlace(): boolean {
  if (!pendingPlace) return false;
  clearPending();
  updateGhost();
  return true;
}

/** ✓: призрак становится объектом (в растущем саду тратит действие). */
function confirmPlace(): void {
  const p = pendingPlace;
  if (!p) return;
  const item = ITEM_BY_ID.get(p.itemId);
  clearPending();
  if (!item) return;
  history.begin(item.name.toLowerCase(), null);
  const placed = world.place(p.itemId, p.tx, p.ty, p.rot);
  if (placed) {
    if (history.commit()) syncHistoryUI();
    if (item.needsWater || item.onWater) audio.splash();
    else audio.place();
    flushMilestones();
    builtItem(p.itemId);
    saveWorld();
  } else {
    history.abort();
  }
  updateGhost();
}

/** Пока призрак ждёт подтверждения, он закреплён на месте: указатель его не двигает. */
function syncPendingGhost(): void {
  const p = pendingPlace;
  if (!p) return;
  const item = ITEM_BY_ID.get(p.itemId);
  if (!item) return;
  scene.ghost = {
    kind: 'item',
    itemId: p.itemId,
    tx: p.tx,
    ty: p.ty,
    rot: p.rot,
    valid: world.canPlace(p.itemId, p.tx, p.ty, p.rot),
    w: item.w,
    h: item.h,
    hl: footprintCells(item, p.tx, p.ty, p.rot),
  };
}

function updateGhost(): void {
  if (pendingPlace) {
    scene.highlightId = -1;
    syncPendingGhost();
    return;
  }
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

  // Любое действие мимо подтверждения снимает призрак бесплатно
  if (pendingPlace && selection.kind !== 'item') cancelPlace();

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
    const ground = selection.ground;
    history.begin(`заливка «${selection.name}»`, null);
    world.clearTouched();
    if (world.floodFill(p.tx, p.ty, selection.ground)) {
      repaintTouched();
      if (history.commit()) syncHistoryUI();
      const gb = TERRAIN_BRUSHES.find((b) => b.ground === ground);
      if (gb && world.useEntry(gb.id)) {
        ui.renderTabs();
        ui.renderItems();
      }
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
    if (history.commit()) {
      syncHistoryUI();
      if (world.useEntry(b.id)) {
        ui.renderTabs();
        ui.renderItems();
      }
    }
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
    // Растущий сад: тап ставит призрак; объект появится только на ✓
    if (world.grow) {
      if (!isClick) return; // рассыпание движением несовместимо с подтверждением
      pendingPlace = { itemId: item.id, tx: s.tx, ty: s.ty, rot: ghostRot };
      syncPendingGhost();
      ui.showConfirm(true);
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
    const placed = world.place(item.id, s.tx, s.ty, ghostRot);
    if (history.commit()) syncHistoryUI();
    if (item.needsWater || item.onWater) audio.splash();
    else audio.place();
    flushMilestones();
    if (placed) builtItem(item.id);
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

/** Предмет построен: его точка гаснет, каталог открывается на шаг дальше. */
function builtItem(itemId: string): void {
  world.onBuiltItem(itemId);
  ui.renderTabs();
  ui.renderItems();
}

function flushMilestones(): void {
  let any = false;
  while (world.pendingMilestones.length) {
    any = true;
    const id = world.pendingMilestones.shift()!;
    ui.showMilestone(id);
  }
  if (any) {
    // Новая веха могла открыть вкладку или расширить пул открытий
    ui.renderTabs();
    ui.renderItems();
  }
  saveWorld();
}

/** Снимок места события для Polaroid-ленты летописи — вызывается после рендера кадра */
function capturePolaroid(tx: number, ty: number): string | null {
  try {
    const iso = isoToScreen(tx, ty);
    const screen = scene.worldToScreen(iso.x, iso.y);
    const vw = scene.viewW;
    const vh = scene.viewH;
    if (screen.x < -260 || screen.x > vw + 260 || screen.y < -260 || screen.y > vh + 260) return null;
    const dpr = window.devicePixelRatio || 1;
    const size = 220;
    const finalSize = 160;
    const sx = Math.round((screen.x - size / 2) * dpr);
    const sy = Math.round((screen.y - size / 2) * dpr);
    const sSize = Math.round(size * dpr);
    const cw = scene.canvas.width;
    const ch = scene.canvas.height;
    if (cw < 10 || ch < 10) return null;
    const tmp = document.createElement('canvas');
    tmp.width = finalSize;
    tmp.height = finalSize;
    const tctx = tmp.getContext('2d')!;
    if (!tctx) return null;
    tctx.fillStyle = '#F7F4EA';
    tctx.fillRect(0, 0, finalSize, finalSize);
    const srcX = Math.max(0, sx);
    const srcY = Math.max(0, sy);
    const srcW = Math.min(sSize, cw - srcX);
    const srcH = Math.min(sSize, ch - srcY);
    if (srcW <= 0 || srcH <= 0) return null;
    const dstX = ((srcX - sx) / sSize) * finalSize;
    const dstY = ((srcY - sy) / sSize) * finalSize;
    const dstW = (srcW / sSize) * finalSize;
    const dstH = (srcH / sSize) * finalSize;
    tctx.drawImage(scene.canvas, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
    tctx.fillStyle = 'rgba(90,64,40,0.04)';
    tctx.fillRect(0, 0, finalSize, finalSize);
    let url = tmp.toDataURL('image/webp', 0.62);
    if (url.length > 50000) url = tmp.toDataURL('image/jpeg', 0.55);
    if (url.length > 58000) return null;
    return url;
  } catch {
    return null;
  }
}

type SnapJob = { id: string; x: number; y: number; at?: number };
let snapQueue: SnapJob[] = [];

/**
 * Новые строки летописи: всплывающее уведомление с картинкой на 20 секунд.
 * При клике — камера летит к месту события, иначе плавное растворение.
 * Очередь — если несколько событий подряд, показываются по очереди.
 * Фото-ловушка: тост сразу, Polaroid-снимок — после рендера кадра.
 */
function flushChronicle(): void {
  const notes = [...world.pendingNotes];
  const noted = notes.length > 0;
  if (noted) {
    for (const n of notes) {
      chronicleToast.push(n);
      snapQueue.push({ id: n.id, x: n.x, y: n.y, at: n.at });
    }
    world.pendingNotes.length = 0;
  }
  if (world.pendingMilestones.length) flushMilestones();
  else if (noted) saveWorld();
}

function flushChronicleSnaps(): void {
  if (!snapQueue.length) return;
  let any = false;
  for (const n of snapQueue) {
    const entry =
      (n.at != null ? [...world.chronicle].reverse().find((e) => e.id === n.id && e.at === n.at) : null) ??
      [...world.chronicle].reverse().find((e) => e.id === n.id && !e.snap) ??
      world.chronicle.find((e) => e.id === n.id);
    if (entry && !entry.snap) {
      const snap = capturePolaroid(n.x, n.y);
      if (snap) {
        entry.snap = snap;
        any = true;
      }
    }
  }
  snapQueue = [];
  if (any) saveWorld();
}

/** Соотношение сторон снимка — переключается там же, на кнопке. */
// ---------------- Звук ----------------

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
  settingsPanel.sync();
}

/** Показать или убрать кровлю — и запомнить выбор. */
function setRoofVisible(visible: boolean): void {
  scene.roofVisible = visible;
  ui.setRoofState(visible);
  saveRoofPref(visible);
  ui.toast(visible ? 'Крыша на месте' : 'Крыша убрана — видно комнаты');
}

// ---------------- Школа тишины ----------------

/** Пока открыт лист практики, сцена не рисуется вовсе: за непрозрачной
 *  бумагой картинка не нужна, а батарея телефона — нужна. */
let practiceActive = false;

const practice = new PracticePanel(app, {
  onActive(active) {
    practiceActive = active;
    if (active) {
      ui.toggleBuild(false);
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

// ---------------- Растущий сад ----------------

const GROW_NAME = 'Растущий сад';
let growAccum = 0;
let growLineShown = false;
/** Ключ текущего прямоугольника роста — чтобы не дёргать каталог каждый кадр. */
let growRectKey = '';

/** Тик растущего сада: приход действий, строка выбора, отказ-подсказка. */
/** Кнопка кровли живая, только когда есть дом: иначе её не за что хватать.
 *  Усадьба в мире — не объект, а крытые тайлы (комнаты и терраса). */
function syncRoofButton(): void {
  ui.setRoofAvailable(world.tiles.some((t) => t.indoor));
}

let growBankShown = false;

function growFrame(dt: number): void {
  if (startOpen) return;
  if (!world.grow) {
    if (growRectKey !== '') {
      growRectKey = '';
      ui.setGrowRect(null);
    }
    if (growBankShown) {
      growBankShown = false;
      ui.setGrowBankVisible(false);
    }
    return;
  }
  growAccum += dt;
  if (growAccum < 250) return;
  growAccum = 0;
  world.growTickNow();
  if (world.growRefused) {
    world.growRefused = false;
    const mins = Math.max(1, Math.ceil((GROW_ACTION_MS - (Date.now() - world.grow.tick)) / 60000));
    ui.setHint(`Действий нет — новое придёт через ${mins} мин`);
  }
  // Принудительное расширение: как только порог достигнут, другие
  // интерфейсы сворачиваются и показывается выбор зон (просил игрок).
  if (growOfferReady(world.grow) && !world.grow.choosing) {
    ui.toggleBuild(false);
    ui.toggleHelp(false);
    settingsPanel.setOpen(false);
    gardensPanel.setOpen(false);
    devPanel.setOpen(false);
    chronicle.setOpen(false);
    if (practice.isOpen) practice.close();
    clearPending();
    input.cancelOngoingAction();
    ui.select({ kind: 'none' });
    world.grow.choosing = true;
    saveWorld();
    ui.toast('Сад готов расти — выберите подсвеченную зону');
    ui.setHint('Коснитесь зоны за туманом — сад вырастет туда');
    const r = world.grow.rect;
    scene.centerOn(r.x + r.w / 2, r.y + r.h / 2);
    scene.clampCamera();
    growLineShown = false;
    ui.setGrowVisible(false);
  }
  const show = !zenMode && !world.grow.choosing && growOfferReady(world.grow);
  if (show !== growLineShown) {
    growLineShown = show;
    ui.setGrowVisible(show);
  }
  // Запас действий: печати и минуты до нового действия
  // Сад мог вырасти — каталог пересобирается под новый размер
  const r = world.grow.rect;
  const key = `${r.x},${r.y},${r.w},${r.h}`;
  if (key !== growRectKey) syncGrowRect();
  const bank = world.grow.bank;
  const mins =
    bank < GROW_BANK_CAP ? Math.max(1, Math.ceil((world.grow.tick + GROW_ACTION_MS - Date.now()) / 60000)) : null;
  ui.setGrowBank(bank, GROW_BANK_CAP, mins);
  if (!growBankShown) {
    growBankShown = true;
    ui.setGrowBankVisible(true);
  }
}

/** Тап по подсвеченной зоне: сад вырастает в выбранную сторону. */
function growPick(tx: number, ty: number): boolean {
  const zones = world.growZonesNow();
  if (!zones.length) return false;
  for (const z of zones) {
    if (tx >= z.x && tx < z.x + z.w && ty >= z.y && ty < z.y + z.h) {
      world.growExpand(z);
      saveWorld();
      scene.markTerrainDirty();
      ui.setHint('Сад вырос — туман отступил');
      wake();
      return true;
    }
  }
  return false;
}

/** Вторая дверь заставки: войти в растущий сад (создать или открыть свой). */
function enterGrow(): void {
  const meta = gardens.list.find((m) => m.name === GROW_NAME);
  if (meta) {
    if (meta.id === gardens.activeId) {
      // уже в нём
    } else if (!gardens.switchTo(world, meta.id)) {
      return;
    }
  } else {
    gardens.create(world, GROW_NAME);
    const seed = Math.floor(Math.random() * 1_000_000_000);
    world.reset();
    seedGrowWorld(world, seed);
    world.grow = newGrowState(seed, Date.now());
    // Стартовая усадьба стёрта: путь роста начинается с одного открытия
    world.initUnlocks(false);
    saveWorld();
  }
  history.clear();
  input.cancelOngoingAction();
  scene.markTerrainDirty();
  life.reset();
  ui.select({ kind: 'none' });
  ui.renderTabs();
  ui.renderItems();
  syncHistoryUI();
  // Камера — на открытый клочок земли
  const r = world.grow?.rect;
  if (r) {
    scene.camera.zoom = 1.15;
    scene.centerOn(r.x + r.w / 2, r.y + r.h / 2);
  }
  growLineShown = false;
  ui.setGrowVisible(false);
  growBankShown = false;
  ui.setGrowBankVisible(false);
  syncRoofButton();
  syncGrowRect();
  // Те же пороги, что и у обычного входа
  startOpen = false;
  wake();
  void toggleSound(true);
  entryZoom = scene.camera.zoom;
}

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
  },
  onGrow() {
    enterGrow();
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
  flushChronicleSnaps,
  growFrame,
});

// Кровля: восстанавливаем прошлый выбор игрока до первого кадра,
// чтобы крыша не мигала на старте.
scene.roofVisible = loadRoofPref();
scene.snapRoof();
ui.setRoofState(scene.roofVisible);
scene.particles = view.particles;
ui.setPaintMode(paintMode);
syncRoofButton();
syncGrowRect();

// Периодическое автосохранение — сад не должен теряться
setInterval(saveWorld, 20000);
window.addEventListener('beforeunload', saveWorld);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveWorld();
});

// Тихая подсказка при входе. На телефоне клавиш нет — называем то, что там
// действительно есть: кнопки и жесты. Показывается один раз и не поверх свитка.
