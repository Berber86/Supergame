import re

src = open('src/main.ts').read()

def cut(mark_start, mark_end):
    i = src.index(mark_start)
    j = src.index(mark_end)
    return src[i:j]

A = cut('// ---------------- Ввод ----------------', '// ---------------- Управление пальцем ----------------')
B = cut('// ---------------- Управление пальцем ----------------', '// ---------------- Действия ----------------')
LOOP = cut('// ---------------- Игровой цикл ----------------', '// Кровля: восстанавливаем')

def transform_input(t):
    # общие ссылки → внешние модули/хуки
    t = re.sub(r'(?<!\.)\bmoving\b', 'moving.current', t)
    t = re.sub(r'(?<!\.)\bpathStart\b', 'pathStart.current', t)
    t = re.sub(r'(?<!\.)\bhasPointer\b', 'pointer.has', t)
    t = re.sub(r'(?<!\.)\bpointerX\b', 'pointer.x', t)
    t = re.sub(r'(?<!\.)\bpointerY\b', 'pointer.y', t)
    t = re.sub(r'(?<!ui)(?<!\.)\bselection\.', 'selection().', t)
    # прямые вызовы → actions.*
    for fn in ['applyErase', 'applyAt', 'updateGhost', 'wake', 'saveWorld', 'syncHistoryUI',
               'doUndo', 'doRedo', 'takeScreenshot', 'cycleShotRatio', 'setRoofVisible', 'toggleSound']:
        t = re.sub(r'(?<!\.)\b' + fn + r'\(', 'actions.' + fn + '(', t)
    t = re.sub(r'(?<!\.)\bsetZen\(', 'actions.setZen(', t)
    t = re.sub(r'(?<!\.)\bzenMode\b', 'isZenMode()', t)
    t = re.sub(r'(?<!\.)\bstartOpen\b', 'isStartOpen()', t)
    t = t.replace('practice.isOpen', 'isPracticeOpen()')
    t = t.replace('practice.close()', 'closePractice()')
    # поворот призрака — хук, ghostRot живёт в main
    t = t.replace('''  } else if (k === 'r') {
    ghostRot = (ghostRot + 1) % 4;
    updateGhost();
  } else if (k === 'x') {''', '''  } else if (k === 'r') {
    actions.rotateGhost();
  } else if (k === 'x') {''')
    # убираем объявления переехавшего состояния
    t = t.replace('''let dragging = false;
let painting = false;
/** Объект, который сейчас переносят, и его исходное место. */
let moving.current: { obj: PlacedObject; fromX: number; fromY: number } | null = null;
/** Начало тропы: первый клик инструмента «Тропа». */
let pathStart.current: { x: number; y: number } | null = null;
let lastX = 0;
let lastY = 0;
let pointer.x = 0;
let pointer.y = 0;
let pointer.has = false;
''', '''let dragging = false;
let painting = false;
let lastX = 0;
let lastY = 0;
''')
    return t

A2 = transform_input(A)
B2 = transform_input(B)
# декларации внутри замыканий — отступляем на 2 пробела
def indent(t):
    return '\n'.join(('  ' + ln if ln.strip() else ln) for ln in t.split('\n'))

INPUT_FILE = ('''/**
 * Ввод: мышь, клавиатура и отдельный разбор касаний.
 *
 * Мышиные обработчики и TouchInput живут вместе — на планшете с трекпадом
 * работают оба; синтетические pointer-события от касаний отсекаются.
 * Состояние жестов — закрытое; наружу видны только указатель для призрака,
 * несомый предмет и отметка начала тропы.
 */

import { clamp } from '../core/rng';
import { floorTo } from '../core/iso';
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
  updateGhost(): void;
  wake(): void;
  saveWorld(): void;
  syncHistoryUI(): void;
  doUndo(): void;
  doRedo(): void;
  setZen(on: boolean): void;
  takeScreenshot(): void;
  cycleShotRatio(): void;
  setRoofVisible(visible: boolean): void;
  toggleSound(): void;
  /** Поворот призрака на 90° — состояние ghostRot живёт в main. */
  rotateGhost(): void;
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
  selection(): Selection;
  isZenMode(): boolean;
  isStartOpen(): boolean;
  isPracticeOpen(): boolean;
  closePractice(): void;
  actions: InputActions;
}

export function setupInput(deps: InputDeps): { cancelOngoingAction(): void } {
  const { canvas, scene, world, history, ui, audio, timeCtl, gardensPanel, settingsPanel, devPanel } = deps;
  const { selection, isZenMode, isStartOpen, isPracticeOpen, closePractice, actions } = deps;

''' + indent(A2) + '''
  if (touchMode) document.body.classList.add('touch');

''' + indent(B2) + '''

  return { cancelOngoingAction };
}
''')

INPUT_FILE = INPUT_FILE.replace('function cancelOngoingAction(): void {', 'function cancelOngoingAction(): void {')
open('src/app/input.ts', 'w').write(INPUT_FILE)
print('input.ts написан')
