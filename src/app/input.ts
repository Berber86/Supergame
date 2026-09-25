/**
 * Ввод: мышь, клавиатура и отдельный разбор касаний.
 *
 * Мышиные обработчики и TouchInput живут вместе — на планшете с трекпадом
 * работают оба; синтетические pointer-события от касаний отсекаются.
 * Состояние жестов — закрытое; наружу видны только указатель для призрака,
 * несомый предмет и отметка начала тропы.
 */

import { clamp } from '../core/rng';
import { GRID, floorTo } from '../core/iso';
import { GROW_BANK_CAP } from '../world/grow';
import { ITEM_BY_ID } from '../world/catalog';
import { PlacedObject } from '../world/types';
import { TouchInput, isTouchDevice } from '../ui/touch';
import type { Scene } from '../render/scene';
import type { World } from '../world/world';
import type { History } from '../core/history';
import type { UI, Selection } from '../ui/ui';
import type { GardenAudio } from '../audio/audio';
import type { TimeControl } from '../core/timeControl';
import type { GardensPanel } from '../ui/gardensPanel';
import type { SettingsPanel } from '../ui/settings';
import type { DevPanel } from '../ui/devPanel';
import type { ChroniclePanel } from '../ui/chroniclePanel';

/** Положение указателя для призрака — на пальце его нет. */
export const pointer = { x: 0, y: 0, has: false };

/** Объект, который сейчас переносят, и его исходное место. */
export const moving: { current: { obj: PlacedObject; fromX: number; fromY: number } | null } = {
  current: null,
};

/** Начало тропы: первый клик инструмента «Тропа». */
export const pathStart: { current: { x: number; y: number } | null } = { current: null };

export const touchMode = isTouchDevice();

/** Действия, которые ввод просит у игры. */
export interface InputActions {
  applyAt(sx: number, sy: number, isClick: boolean): void;
  applyErase(sx: number, sy: number): void;
  /** Растущий сад: тап по зоне-кандидату. true — зона выбрана. */
  growPick(tx: number, ty: number): boolean;
  updateGhost(): void;
  wake(): void;
  saveWorld(): void;
  syncHistoryUI(): void;
  doUndo(): void;
  doRedo(): void;

  setRoofVisible(visible: boolean): void;
  toggleSound(): void;
  /** Снять ждущий призрак бесплатно. true — призрак был. */
  cancelPlace(): boolean;
  /** Поворот призрака на 90° — состояние ghostRot живёт в main. */
  rotateGhost(): void;
  /** Тактильный отклик в созерцании: погладить кота, круги на воде, колокольчик. */
  handleContemplationTap(sx: number, sy: number): boolean;
  /** Включить/выключить режим созерцания (Z). */
  toggleZen(): void;
  isZen(): boolean;
  exitZen(): void;
  /** Сбросить начальную точку мазка (при отпускании мыши/пальца). */
  resetStroke(): void;
}

export interface InputDeps {
  canvas: HTMLCanvasElement;
  scene: Scene;
  world: World;
  history: History;
  ui: UI;
  audio: GardenAudio;
  timeCtl: TimeControl;
  gardensPanel: GardensPanel;
  settingsPanel: SettingsPanel;
  devPanel: DevPanel;
  chronicle: ChroniclePanel;
  selection(): Selection;
  isStartOpen(): boolean;
  isPracticeOpen(): boolean;
  closePractice(): void;
  /** Как ставит инструмент: одиночное касание или мазок движением. */
  paintMode(): 'tap' | 'stroke';
  actions: InputActions;
}

export function setupInput(deps: InputDeps): { cancelOngoingAction(): void } {
  const { canvas, scene, world, history, ui, audio, timeCtl, gardensPanel, settingsPanel, devPanel, chronicle } = deps;
  const { selection, isStartOpen, isPracticeOpen, closePractice, paintMode, actions } = deps;

  // ---------------- Ввод ----------------

  let dragging = false;
  let painting = false;
  /** Одиночное касание: клик ставит предмет, движение ведёт камеру. */
  let tapPlace: { x: number; y: number; moved: boolean } | null = null;
  let lastX = 0;
  let lastY = 0;
  let downX = 0;
  let downY = 0;

  /**
   * Сбросить незавершённое действие — при смене усадьбы на середине
   * мазка, переноса или разметки тропы. След прошлого сада не должен
   * оставаться нажатым состоянием в новом.
   */
  function cancelOngoingAction(): void {
    moving.current = null;
    scene.movingId = -1;
    dragging = false;
    painting = false;
    tapPlace = null;
    pathStart.current = null;
    scene.pathFrom = null;
    scene.pathPreview = null;
    canvas.classList.remove('dragging');
    actions.updateGhost();
  }

  canvas.addEventListener('pointerdown', (e) => {
    // На пальце работает TouchInput; браузер дублирует касания
    // синтетическими pointer-событиями, и без этой отсечки
    // каждое касание срабатывало бы дважды.
    if (e.pointerType === 'touch') return;
    canvas.setPointerCapture(e.pointerId);
    downX = e.clientX;
    downY = e.clientY;
    lastX = e.clientX;
    lastY = e.clientY;
    actions.wake();

    if (e.button === 2) {
      // ПКМ — убрать объект
      actions.applyErase(e.clientX, e.clientY);
      return;
    }
    // Растущий сад выбирает, куда расти: тап по подсвеченной зоне
    if (world.grow?.choosing) {
      const p = scene.pickTile(e.clientX, e.clientY, world);
      if (actions.growPick(p.tx, p.ty)) return;
      dragging = true;
      canvas.classList.add('dragging');
      return;
    }
    if (selection().kind === 'move' && e.button === 0) {
      const p = scene.pickTile(e.clientX, e.clientY, world);
      const obj = world.pickObject(p.tx, p.ty);
      if (obj) {
        const free = world.canMoveWithoutCost(obj.type);
        if (world.grow && world.grow.bank <= 0 && !free) {
          world.growRefused = true;
          ui.toast('Нет действий роста');
          dragging = true;
          canvas.classList.add('dragging');
          return;
        }
        history.begin('перенос', null);
        moving.current = { obj, fromX: obj.tx, fromY: obj.ty };
        scene.movingId = obj.id;
        painting = true;
        audio.place();
      } else {
        dragging = true;
        canvas.classList.add('dragging');
      }
      return;
    }
    if (selection().kind !== 'none' && e.button === 0) {
      if (paintMode() === 'stroke') {
        painting = true;
        world.beginStroke();
        actions.applyAt(e.clientX, e.clientY, true);
      } else {
        // Касание: предмет встанет на отпускании, если палец не повёл камеру
        tapPlace = { x: e.clientX, y: e.clientY, moved: false };
        dragging = true;
        canvas.classList.add('dragging');
      }
    } else {
      dragging = true;
      canvas.classList.add('dragging');
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.has = true;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      actions.wake();
    }
    if (dragging) {
      if (tapPlace && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) tapPlace.moved = true;
      scene.camera.x -= dx / scene.camera.zoom;
      scene.camera.y -= dy / scene.camera.zoom;
      scene.clampCamera();
    } else if (moving.current) {
      const p = scene.pickTile(e.clientX, e.clientY, world);
      const item = ITEM_BY_ID.get(moving.current.obj.type);
      if (item) {
        const s2 =
          item.step === 1
            ? { tx: Math.floor(p.tx - (item.w - 1) / 2), ty: Math.floor(p.ty - (item.h - 1) / 2) }
            : { tx: floorTo(p.tx, item.step), ty: floorTo(p.ty, item.step) };
        world.moveObjectFree(moving.current.obj, s2.tx, s2.ty);
      }
    } else if (painting && selection().kind === 'brush') {
      actions.applyAt(e.clientX, e.clientY, false);
    } else if (painting && selection().kind === 'item' && (selection() as { item: { step: number } }).item.step < 1) {
      // мелочи можно «рассыпать» движением
      actions.applyAt(e.clientX, e.clientY, false);
    }
    lastX = e.clientX;
    lastY = e.clientY;
    actions.updateGhost();
  });

  const endPointer = () => {
    if (moving.current) {
      const m = moving.current;
      moving.current = null;
      scene.movingId = -1;
      if (m.obj.tx === m.fromX && m.obj.ty === m.fromY) {
        history.abort();
      } else {
        // Стоимость переноса — одно действие, кроме очевидной мелочи (фонарь, цветок, подушка)
        const free = world.canMoveWithoutCost(m.obj.type);
        if (!free && !world.growPay()) {
          // нет действий — возвращаем на исходное место
          world.moveObjectFree(m.obj, m.fromX, m.fromY);
          history.abort();
          ui.toast('Нет действий роста');
        } else if (history.commit()) {
          const item = ITEM_BY_ID.get(m.obj.type);
          ui.toast(`${item?.name ?? 'Предмет'} переставлен`);
          actions.syncHistoryUI();
        }
      }
    } else if (painting) {
      // мазок кистью закончен — следующий станет отдельным шагом отмены
      if (history.commit()) actions.syncHistoryUI();
      history.breakMerge();
    } else if (tapPlace) {
      // одиночное касание: клик без движения камеры ставит предмет
      const tp = tapPlace;
      if (!tp.moved && selection().kind !== 'none') {
        actions.applyAt(tp.x, tp.y, true);
        if (history.commit()) actions.syncHistoryUI();
        history.breakMerge();
      }
    } else if (selection().kind === 'none' && !moving.current && !painting) {
      // Созерцание: короткое касание без сдвига камеры — тактильный отклик мира
      if (Math.hypot(lastX - downX, lastY - downY) < 6) {
        actions.handleContemplationTap(lastX, lastY);
      }
    }
    dragging = false;
    painting = false;
    tapPlace = null;
    actions.resetStroke();
    canvas.classList.remove('dragging');
    actions.saveWorld();
  };
  canvas.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') return;
    endPointer();
  });
  canvas.addEventListener('pointercancel', (e) => {
    if (e.pointerType === 'touch') return;
    endPointer();
  });
  canvas.addEventListener('pointerleave', () => {
    pointer.has = false;
    scene.ghost = null;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      actions.wake();
      const before = scene.screenToWorld(e.clientX, e.clientY);
      const k = Math.exp(-e.deltaY * 0.0012);
      scene.camera.zoom = clamp(scene.camera.zoom * k, 0.12, 6);
      const after = scene.screenToWorld(e.clientX, e.clientY);
      scene.camera.x += before.x - after.x;
      scene.camera.y += before.y - after.y;
      scene.clampCamera();
      actions.updateGhost();
    },
    { passive: false },
  );

  if (touchMode) document.body.classList.add('touch');

  // ---------------- Управление пальцем ----------------
  //
  // На телефоне работает отдельный разбор жестов: у пальца нет правой кнопки,
  // колеса и наведения. Мышиные обработчики при этом остаются — на планшете
  // с трекпадом могут пригодиться оба.

  if (touchMode) document.body.classList.add('touch');

  /** Масштаб вокруг точки: картинка не должна уезжать из-под пальцев. */
  function zoomAt(k: number, sx: number, sy: number): void {
    const before = scene.screenToWorld(sx, sy);
    scene.camera.zoom = clamp(scene.camera.zoom * k, 0.12, 6);
    const after = scene.screenToWorld(sx, sy);
    scene.camera.x += before.x - after.x;
    scene.camera.y += before.y - after.y;
    scene.clampCamera();
  }

  if (touchMode) {
    new TouchInput(canvas, {
      isPainting: () => selection().kind !== 'none',

      onTap(x, y) {
        actions.wake();
        // Растущий сад выбирает сторону: касание зоны важнее пустого выбора
        if (world.grow?.choosing) {
          const p = scene.pickTile(x, y, world);
          if (actions.growPick(p.tx, p.ty)) return;
        }
        if (selection().kind === 'none') {
          actions.handleContemplationTap(x, y);
          return;
        }
        pointer.x = x;
        pointer.y = y;
        pointer.has = true;
        // Перенос пальцем идёт в два касания: взять и поставить.
        // Тащить объект и одновременно видеть его под пальцем невозможно.
        if (selection().kind === 'move') {
          tapMove(x, y);
          return;
        }
        actions.applyAt(x, y, true);
        if (history.commit()) actions.syncHistoryUI();
        history.breakMerge();
        actions.saveWorld();
      },

      onHold(_x, _y) {
        // Долгое удержание намеренно не удаляет предметы: удаление только через инструмент «Убрать»
      },

      onDragStart(x, y) {
        actions.wake();
        // Пока сад выбирает, куда расти, палец возит камеру, а не кисть
        if (world.grow?.choosing) {
          dragging = true;
          return;
        }
        // Кистью и мелочью рисуем, всем остальным — возим камеру.
        // В режиме касания движение всегда ведёт камеру: предмет ставит тап.
        const sel2 = selection();
        const paintable =
          paintMode() === 'stroke' && (sel2.kind === 'brush' || (sel2.kind === 'item' && sel2.item.step < 1));
        if (paintable) {
          painting = true;
          world.beginStroke();
          pointer.x = x;
          pointer.y = y;
          pointer.has = true;
          actions.applyAt(x, y, true);
        } else {
          dragging = true;
        }
      },

      onDragMove(x, y, dx, dy) {
        if (painting) {
          pointer.x = x;
          pointer.y = y;
          actions.applyAt(x, y, false);
        } else if (dragging) {
          scene.camera.x -= dx / scene.camera.zoom;
          scene.camera.y -= dy / scene.camera.zoom;
          scene.clampCamera();
        }
      },

      onDragEnd() {
        if (painting) {
          if (history.commit()) actions.syncHistoryUI();
          history.breakMerge();
          actions.saveWorld();
        }
        painting = false;
        dragging = false;
        actions.resetStroke();
        // Призрак под пальцем больше не нужен — палец убран
        scene.ghost = null;
        pointer.has = false;
      },

      onPinch(k, cx, cy, dx, dy) {
        actions.wake();
        zoomAt(k, cx, cy);
        scene.camera.x -= dx / scene.camera.zoom;
        scene.camera.y -= dy / scene.camera.zoom;
        scene.clampCamera();
      },

      onPinchEnd() {
        scene.ghost = null;
        pointer.has = false;
      },
    });
  }

  /** Перенос в два касания: первое берёт предмет, второе ставит. */
  function tapMove(sx: number, sy: number): void {
    const p = scene.pickTile(sx, sy, world);
    if (!moving.current) {
      const obj = world.pickObject(p.tx, p.ty);
      if (!obj) {
        ui.toast('Здесь нечего переносить');
        return;
      }
      const free = world.canMoveWithoutCost(obj.type);
      if (world.grow && world.grow.bank <= 0 && !free) {
        world.growRefused = true;
        ui.toast('Нет действий роста');
        return;
      }
      history.begin('перенос', null);
      moving.current = { obj, fromX: obj.tx, fromY: obj.ty };
      scene.movingId = obj.id;
      audio.place();
      ui.setHint('Теперь коснитесь места, куда поставить');
      return;
    }

    const item = ITEM_BY_ID.get(moving.current.obj.type);
    let movedOk = false;
    if (item) {
      const s2 =
        item.step === 1
          ? { tx: Math.floor(p.tx - (item.w - 1) / 2), ty: Math.floor(p.ty - (item.h - 1) / 2) }
          : { tx: floorTo(p.tx, item.step), ty: floorTo(p.ty, item.step) };
      movedOk = world.moveObjectFree(moving.current.obj, s2.tx, s2.ty);
    }
    const m = moving.current;
    moving.current = null;
    scene.movingId = -1;
    if (!movedOk || (m.obj.tx === m.fromX && m.obj.ty === m.fromY)) {
      history.abort();
      ui.setHint('Перенос — коснитесь предмета, затем места');
      if (!movedOk) ui.toast('Сюда нельзя поставить');
      return;
    }
    const free = world.canMoveWithoutCost(m.obj.type);
    if (!free && !world.growPay()) {
      world.moveObjectFree(m.obj, m.fromX, m.fromY);
      history.abort();
      ui.toast('Нет действий роста');
      ui.setHint('Перенос — коснитесь предмета, затем места');
      return;
    }
    if (history.commit()) {
      ui.toast(`${item?.name ?? 'Предмет'} переставлен`);
      actions.syncHistoryUI();
    }
    ui.setHint('Перенос — коснитесь предмета, затем места');
    actions.saveWorld();
  }

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    // Не перехватываем набор текста (переименование усадьбы)
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
    // Пока висит свиток, сад ещё не начался: клавиши ему не принадлежат.
    if (isStartOpen()) return;
    // Под листом практики сад не живёт: клавиши не проходят сквозь него.
    if (isPracticeOpen()) {
      if (e.key === 'Escape') closePractice();
      return;
    }
    actions.wake();

    // Отмена и повтор — до остальных клавиш
    if ((e.ctrlKey || e.metaKey) && k === 'z') {
      e.preventDefault();
      if (e.shiftKey) actions.doRedo();
      else actions.doUndo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && k === 'y') {
      e.preventDefault();
      actions.doRedo();
      return;
    }
    if (e.ctrlKey || e.metaKey) return;

    if (k === 'z' || k === 'я') {
      actions.toggleZen();
      return;
    }

    if (k === 'b') {
      actions.exitZen();
      ui.toggleBuild();
    } else if (k === 'n') {
      ui.toggleMirage();
    } else if (k === 'h' || k === '?') {
      ui.toggleHelp();
    } else if (k === 'r') {
      actions.rotateGhost();
    } else if (k === 'x') {
      ui.select({ kind: 'erase' });
      ui.toggleBuild(true);
    } else if (k === 'escape') {
      if (actions.isZen()) {
        actions.exitZen();
        return;
      }
      // Ждущий призрак убирается первым: Esc — тоже «другое действие»
      if (actions.cancelPlace()) return;
      // Выбор «куда расти» откладывается: туман снова укроет зоны
      if (world.grow?.choosing) {
        world.grow.choosing = false;
        return;
      }
      if (gardensPanel.isOpen) gardensPanel.setOpen(false);
      else if (chronicle.isOpen) chronicle.setOpen(false);
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
    } else if (k === 's') {
      settingsPanel.toggle();
    } else if (k === 'u') {
      gardensPanel.toggle();
    } else if (k === '1' || k === '2' || k === '3') {
      ui.setBrushSize(k === '1' ? 1 : k === '2' ? 3 : 5);
    } else if (k === 'c') {
      // Очевидно полезное: центрировать камеру на саду (просил игрок)
      if (world.grow) {
        const r = world.grow.rect;
        scene.centerOn(r.x + r.w / 2, r.y + r.h / 2);
        scene.camera.zoom = 1.1;
      } else {
        scene.centerOn(GRID / 2, GRID / 2);
        scene.camera.zoom = 0.85;
      }
      scene.clampCamera();
      ui.toast('Камера — в центр сада');
    } else if (k === '+' || k === '=' || k === 'numpadadd') {
      // Дать одно действие в растущем саду — не ждать 10 минут (очевидно полезно)
      if (world.grow) {
        world.grow.bank = Math.min(GROW_BANK_CAP, world.grow.bank + 1);
        actions.saveWorld();
        ui.toast(`+1 действие · в запасе ${world.grow.bank}`);
      }
    } else if (k === 't') {
      devPanel.toggle();
      devPanel.refresh();
    } else if (k === 'm') {
      actions.toggleSound();
    } else if (k === 'arrowleft' || k === 'arrowright') {
      e.preventDefault();
      const dir = k === 'arrowright' ? 1 : -1;
      if (e.shiftKey) timeCtl.nextSeason(dir);
      else timeCtl.nudgeHour(dir * (e.altKey ? 0.25 : 1));
      scene.markTerrainDirty();
      devPanel.refresh();
    }
  });

  /** Книжная ориентация — для подсказки «поверните телефон». */
  function syncOrientation(): void {
    const portrait = window.innerHeight > window.innerWidth;
    document.body.classList.toggle('portrait', portrait);
  }
  syncOrientation();
  window.addEventListener('orientationchange', () => {
    // Размеры окна после поворота приходят не сразу — ждём кадр-другой
    setTimeout(() => {
      syncOrientation();
      scene.resize();
      scene.markTerrainDirty();
      // Вид подбирается под ориентацию: в альбоме сад помещается целиком,
      // в книжной — только его середина. Без пересчёта после поворота
      // остался бы масштаб от прошлой ориентации.
      if (touchMode) scene.fitToView(world);
      scene.clampCamera();
    }, 160);
  });

  // В мобильных браузерах адресная строка сворачивается на ходу и меняет
  // высоту окна. visualViewport сообщает об этом точнее, чем resize.
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      scene.resize();
      scene.markTerrainDirty();
      scene.clampCamera();
    });
  }

  window.addEventListener('resize', () => {
    syncOrientation();
    scene.resize();
    scene.markTerrainDirty();
  });

  return { cancelOngoingAction };
}
