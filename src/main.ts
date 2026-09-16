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
import { ITEM_BY_ID } from './world/catalog';
import { Life } from './world/life';

const app = document.getElementById('app')!;

const canvas = document.createElement('canvas');
canvas.id = 'garden';
app.appendChild(canvas);

const world = new World();
if (world.load()) {
  // сохранённая усадьба
} else {
  world.save();
}

const life = new Life();
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
    scene.showGrid = sel.kind !== 'none';
    canvas.classList.toggle('building', sel.kind !== 'none');
    if (sel.kind === 'none') scene.ghost = null;
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
});

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
  dragging = false;
  painting = false;
  canvas.classList.remove('dragging');
  world.save();
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
  wake();
  if (k === 'b') {
    ui.toggleBuild();
  } else if (k === 'z') {
    setZen(!zenMode);
  } else if (k === 'p') {
    takeScreenshot();
  } else if (k === 'h' || k === '?') {
    ui.toggleHelp();
  } else if (k === 'r') {
    ghostRot = (ghostRot + 1) % 4;
    updateGhost();
  } else if (k === 'x') {
    ui.select({ kind: 'erase' });
    ui.toggleBuild(true);
  } else if (k === 'escape') {
    if (ui.selection.kind !== 'none') ui.select({ kind: 'none' });
    else ui.toggleBuild(false);
    ui.toggleHelp(false);
  } else if (k === 'g') {
    scene.showGrid = !scene.showGrid;
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
    return;
  }
  const p = scene.pickTile(pointerX, pointerY, world);
  const s = snapForSelection(p.tx, p.ty);

  if (selection.kind === 'item') {
    const item = selection.item;
    const valid = inBounds(Math.floor(s.tx), Math.floor(s.ty)) && world.canPlace(item.id, s.tx, s.ty);
    scene.ghost = { kind: 'item', itemId: item.id, tx: s.tx, ty: s.ty, rot: ghostRot, valid, w: item.w, h: item.h };
  } else if (selection.kind === 'brush') {
    const b = selection.brush;
    const x0 = Math.floor(s.tx - (b.w - 1) / 2);
    const y0 = Math.floor(s.ty - (b.h - 1) / 2);
    scene.ghost = { kind: 'brush', brushId: b.id, tx: x0, ty: y0, rot: 0, valid: inBounds(x0, y0), w: b.w, h: b.h };
  } else {
    scene.ghost = { kind: 'erase', tx: Math.floor(s.tx), ty: Math.floor(s.ty), rot: 0, valid: true, w: 1, h: 1 };
  }
}

function applyAt(sx: number, sy: number, isClick: boolean): void {
  const p = scene.pickTile(sx, sy, world);
  if (!inBounds(Math.floor(p.tx), Math.floor(p.ty))) return;

  if (selection.kind === 'brush') {
    const b = selection.brush;
    world.applyBrush(b, p.tx, p.ty);
    scene.markTerrainDirty();
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
    world.place(item.id, s.tx, s.ty, ghostRot);
    flushMilestones();
    return;
  }

  if (selection.kind === 'erase') applyErase(sx, sy);
}

function applyErase(sx: number, sy: number): void {
  const p = scene.pickTile(sx, sy, world);
  const removed = world.removeAt(p.tx, p.ty);
  if (removed) {
    const item = ITEM_BY_ID.get(removed.type);
    ui.toast(`${item?.name ?? 'Предмет'} убран${item?.kind === 'tree' ? 'о' : ''}`);
    world.save();
  }
}

function flushMilestones(): void {
  while (world.pendingMilestones.length) {
    const id = world.pendingMilestones.shift()!;
    ui.showMilestone(id);
  }
  world.save();
}

function takeScreenshot(): void {
  const wasZen = zenMode;
  setZen(true);
  // Даём кадру отрисоваться без интерфейса
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const t = computeTime(Date.now());
        a.href = url;
        a.download = `усадьба-${t.season}-${t.label.replace(':', '-')}.png`;
        a.click();
        URL.revokeObjectURL(url);
        if (!wasZen) setTimeout(() => setZen(false), 200);
        ui.toast('Снимок сохранён');
      }, 'image/png');
    });
  });
}

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
});

// ---------------- Игровой цикл ----------------

let last = performance.now();
let eveningChecked = '';

function frame(now: number): void {
  const dt = Math.min(now - last, 60);
  last = now;

  const t = computeTime(Date.now());
  const atm = buildAtmosphere(t);

  // Веха «Сумерки» — когда игрок впервые застаёт вечер
  const dayKey = `${t.year}-${t.seasonIndex}-${Math.floor(t.dayT * 4)}`;
  if (atm.lampGlow > 0.4 && eveningChecked !== dayKey) {
    eveningChecked = dayKey;
    world.noteEvening();
    flushMilestones();
  }

  // Живность и ветер
  life.update(world, t, dt, now);
  scene.wind = life.windBase;

  // Интерфейс растворяется в бездействии
  if (!zenMode && !ui.buildOpen && now - lastInteraction > IDLE_MS) setZen(true);

  scene.render(world, atm, now, dt, life);
  ui.tick(t, atm);

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// Периодическое автосохранение — сад не должен теряться
setInterval(() => world.save(), 20000);
window.addEventListener('beforeunload', () => world.save());

// Тихая подсказка при первом входе
setTimeout(() => {
  if (!zenMode) ui.setHint('B — открыть каталог · Z — созерцание · H — свиток');
}, 6000);
