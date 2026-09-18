/** Исчезающий интерфейс: каталог, часы, вехи, свиток помощи. */

import { CatalogItem, ITEMS, MILESTONES, TABS, TERRAIN_BRUSHES, TerrainBrush } from '../world/catalog';
import { SEASON_NAMES, SEASON_POEM, TimeState, partOfDay } from '../core/clock';
import { Atmosphere } from '../world/palette';
import { GroundId } from '../world/types';
import { World } from '../world/world';
import { itemIcon, svgIcon } from './icons';
import './grow.css';

const SEASON_KANJI: Record<string, string> = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };

export type Selection =
  | { kind: 'none' }
  | { kind: 'item'; item: CatalogItem }
  | { kind: 'brush'; brush: TerrainBrush }
  | { kind: 'erase' }
  /** Пипетка: подобрать то, что уже стоит. */
  | { kind: 'pick' }
  /** Перенос поставленного. */
  | { kind: 'move' }
  /** Заливка области материалом. */
  | { kind: 'fill'; ground: GroundId; name: string }
  /** Тропа: два клика — начало и конец, дорога прокладывается сама. */
  | { kind: 'path' };

export interface UIHooks {
  onSelect(sel: Selection): void;
  onToggleBuild(open: boolean): void;
  onZen(): void;
  onScreenshot(): void;
  onReset(): void;
  onUndo(): void;
  onRedo(): void;
  onBrushSize(n: number): void;
  onGardens(): void;
  /** Показать или убрать кровлю усадьбы. */
  onRoof(): void;
  /** Панель настроек вида. */
  onSettings(): void;
  /** Мастерская времени: час, сезон, погода. */
  onTimeWorkshop(): void;
  /** Сесть в тишине: практики и школа дзена. */
  onSit(): void;
  /** Открыть летопись сада. */
  onChronicle(): void;
  /** Растущий сад: открыть выбор, куда расти. */
  onGrowLine(): void;
}

export class UI {
  root: HTMLElement;
  private hooks: UIHooks;
  private world: World;
  private atm!: Atmosphere;
  selection: Selection = { kind: 'none' };
  buildOpen = false;
  private activeTab = 'trees';
  private els: Record<string, HTMLElement> = {};
  private milestoneTimer = 0;
  private toastTimer = 0;
  private iconSeason = '';
  brushSize = 1;
  /** Назначается извне: переключение звука. */
  onSound: (() => void) | null = null;

  constructor(root: HTMLElement, world: World, hooks: UIHooks) {
    this.root = root;
    this.world = world;
    this.hooks = hooks;
    this.build();
  }

  private el<T extends HTMLElement = HTMLElement>(tag: string, cls?: string, html?: string): T {
    const e = document.createElement(tag) as T;
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  private build(): void {
    const layer = this.el('div', 'ui-layer');

    // --- Часы ---
    const time = this.el('div', 'time-card paper fade');
    time.innerHTML = `
      <div class="time-row">
        <span class="clock">00:00</span>
        <span class="season-kanji">春</span>
      </div>
      <div class="time-sub">весна · утро</div>
      <div class="season-bar"><i style="width:0%"></i></div>`;
    // Плашка часов — она же вход в мастерскую времени. На телефоне нет
    // клавиатуры, и клавиша T была недостижима; отдельная девятая кнопка
    // в столбце лишняя, а нажать на часы, чтобы поменять время, — понятно.
    time.classList.add('clickable');
    time.title = 'Мастерская времени (T)';
    time.addEventListener('click', () => this.hooks.onTimeWorkshop());
    layer.appendChild(time);
    this.els.timeCard = time;
    this.els.clock = time.querySelector('.clock')!;
    this.els.kanji = time.querySelector('.season-kanji')!;
    this.els.sub = time.querySelector('.time-sub')!;
    this.els.bar = time.querySelector('.season-bar > i')!;

    // --- Кнопки справа ---
    const tools = this.el('div', 'tools fade');
    const mk = (icon: string, label: string, cls = '') => {
      const b = this.el('div', `tool-btn wood ${cls}`);
      b.innerHTML = `${svgIcon(icon, 23)}<span class="label">${label}</span>`;
      tools.appendChild(b);
      return b;
    };
    this.els.btnBuild = mk('hand', 'Строить (B)');
    this.els.btnZen = mk('eye', 'Созерцание (Z)');
    this.els.btnShot = mk('camera', 'Снимок (P)');
    this.els.btnSound = mk('sound-off', 'Звук (M)');
    this.els.btnRoof = mk('roof', 'Крыша (R)');
    this.els.btnGardens = mk('gardens', 'Усадьбы (U)');
    this.els.btnSettings = mk('settings', 'Настройки (S)');
    this.els.btnHelp = mk('scroll', 'Свиток (H)');
    layer.appendChild(tools);

    // Подсказка повернуть телефон: сад — широкая картина, и в книжной
    // ориентации от него видно слишком мало. Именно подсказка, а не
    // заглушка: играть можно и вертикально, просто хуже.
    const rotate = this.el('div', 'rotate-note');
    rotate.innerHTML = `${svgIcon('phone', 19)}<span>Поверните телефон — сад шире, чем экран</span>`;
    // Подсказка сама уходит через несколько секунд и больше не возвращается:
    // висеть постоянно ей незачем, она занимает нижний край экрана.
    const hideRotate = () => {
      rotate.classList.add('dismissed');
      try {
        localStorage.setItem('usadba.rotateSeen', '1');
      } catch {
        /* приватный режим — переживём */
      }
    };
    rotate.addEventListener('click', hideRotate);
    let rotateSeen = false;
    try {
      rotateSeen = localStorage.getItem('usadba.rotateSeen') === '1';
    } catch {
      /* приватный режим — переживём */
    }
    if (rotateSeen) rotate.classList.add('dismissed');
    else setTimeout(hideRotate, 9000);
    layer.appendChild(rotate);
    this.els.rotate = rotate;

    this.els.btnBuild.addEventListener('click', () => this.toggleBuild());
    this.els.btnZen.addEventListener('click', () => this.hooks.onZen());
    this.els.btnShot.addEventListener('click', () => this.hooks.onScreenshot());
    this.els.btnSound.addEventListener('click', () => this.onSound?.());
    this.els.btnRoof.addEventListener('click', () => this.hooks.onRoof());
    this.els.btnSettings.addEventListener('click', () => this.hooks.onSettings());
    this.els.btnGardens.addEventListener('click', () => this.hooks.onGardens());
    this.els.btnHelp.addEventListener('click', () => this.toggleHelp());

    // --- Инструменты строителя (видны только в режиме стройки) ---
    const bb = this.el('div', 'buildbar wood');
    bb.innerHTML = `
      <div class="bb-group">
        <div class="bb-btn" data-act="undo" title="Отменить (Ctrl+Z)">${svgIcon('undo', 19)}</div>
        <div class="bb-btn" data-act="redo" title="Повторить (Ctrl+Shift+Z)">${svgIcon('redo', 19)}</div>
      </div>
      <div class="bb-sep"></div>
      <div class="bb-group">
        <div class="bb-btn" data-act="pick" title="Пипетка (I) — подобрать то, что стоит">${svgIcon('dropper', 19)}</div>
        <div class="bb-btn" data-act="move" title="Перенести (V)">${svgIcon('move', 19)}</div>
        <div class="bb-btn" data-act="fill" title="Залить область (F)">${svgIcon('fill', 19)}</div>
        <div class="bb-btn" data-act="path" title="Тропа (P) — два клика, дорога ляжет сама">${svgIcon('path', 19)}</div>
      </div>
      <div class="bb-sep"></div>
      <div class="bb-group bb-sizes" title="Размер кисти (1 · 2 · 3)">
        <div class="bb-size active" data-size="1">1</div>
        <div class="bb-size" data-size="3">3</div>
        <div class="bb-size" data-size="5">5</div>
      </div>`;
    layer.appendChild(bb);
    this.els.buildbar = bb;
    bb.querySelectorAll<HTMLElement>('.bb-btn').forEach((b) => {
      b.addEventListener('click', () => {
        const act = b.dataset.act!;
        if (act === 'undo') this.hooks.onUndo();
        else if (act === 'redo') this.hooks.onRedo();
        else if (act === 'pick') this.select(this.selection.kind === 'pick' ? { kind: 'none' } : { kind: 'pick' });
        else if (act === 'move') this.select(this.selection.kind === 'move' ? { kind: 'none' } : { kind: 'move' });
        else if (act === 'fill') this.startFill();
        else if (act === 'path') this.select(this.selection.kind === 'path' ? { kind: 'none' } : { kind: 'path' });
      });
    });
    bb.querySelectorAll<HTMLElement>('.bb-size').forEach((b) => {
      b.addEventListener('click', () => this.setBrushSize(Number(b.dataset.size)));
    });

    // --- Каталог ---
    const cat = this.el('div', 'catalog');
    cat.innerHTML = `
      <div class="catalog-inner wood">
        <div class="catalog-handle"><div class="cord"></div></div>
        <div class="tabs"></div>
        <div class="items paper"></div>
      </div>`;
    layer.appendChild(cat);
    this.els.catalog = cat;
    this.els.tabs = cat.querySelector('.tabs')!;
    this.els.items = cat.querySelector('.items')!;
    cat.querySelector('.catalog-handle')!.addEventListener('click', () => this.toggleBuild());

    // --- Подсказка ---
    const hint = this.el('div', 'hint-bar fade');
    hint.textContent = matchMedia('(hover: none)').matches
      ? 'Проведите пальцем — осмотрите сад. Щипок — приблизить.'
      : 'Перетаскивайте — осматривайте сад. Колесо — приблизить.';
    layer.appendChild(hint);
    this.els.hint = hint;

    // --- Веха ---
    const ms = this.el('div', 'milestone paper');
    ms.innerHTML = `<div class="seal">道</div><h3></h3><p></p><div class="unlock"></div>`;
    layer.appendChild(ms);
    this.els.milestone = ms;

    // --- Тост ---
    const toast = this.el('div', 'toast paper');
    layer.appendChild(toast);
    this.els.toast = toast;

    // --- Свиток помощи ---
    const help = this.el('div', 'scroll-panel paper');
    // На телефоне свиток рассказывает про жесты, а не про клавиши:
    // список сочетаний там бесполезен и только занимает экран.
    const touch = matchMedia('(hover: none)').matches;
    const look = touch
      ? `
        <dt>Провести</dt><dd>Двигать камеру по усадьбе</dd>
        <dt>Щипок</dt><dd>Приблизить или отдалить</dd>
        <dt>Глаз</dt><dd>Созерцание — интерфейс растворяется</dd>
        <dt>Камера</dt><dd>Снимок сада свитком</dd>
        <dt>Нота</dt><dd>Звук сада: листва, вода, цикады, дождь</dd>`
      : `
        <dt>Перетащить</dt><dd>Двигать камеру по усадьбе</dd>
        <dt>Колесо</dt><dd>Приблизить или отдалить</dd>
        <dt>Z</dt><dd>Созерцание — интерфейс растворяется</dd>
        <dt>P</dt><dd>Сохранить снимок сада</dd>
        <dt>M</dt><dd>Звук сада: листва, вода, цикады, дождь</dd>`;

    const build = touch
      ? `
        <dt>Рука</dt><dd>Открыть или закрыть каталог</dd>
        <dt>Касание</dt><dd>Поставить выбранное</dd>
        <dt>Провести</dt><dd>Рисовать землёй и мелочами</dd>
        <dt>Держать</dt><dd>Убрать то, что под пальцем</dd>
        <dt>Пипетка</dt><dd>Подобрать то, что уже стоит</dd>
        <dt>Перенос</dt><dd>Коснуться предмета, затем места</dd>
        <dt>Заливка</dt><dd>Залить область материалом</dd>
        <dt>Тропа</dt><dd>Два касания — дорога ляжет сама</dd>
        <dt>1 · 3 · 5</dt><dd>Размер кисти земли</dd>
        <dt>Стрелки</dt><dd>Отменить и вернуть</dd>
        <dt>Крыша</dt><dd>Убрать кровлю — заглянуть в комнаты</dd>`
      : `
        <dt>B</dt><dd>Открыть или закрыть каталог</dd>
        <dt>Клик</dt><dd>Поставить выбранное</dd>
        <dt>Зажать</dt><dd>Рисовать землёй и мелочами</dd>
        <dt>X / ПКМ</dt><dd>Убрать предмет</dd>
        <dt>I</dt><dd>Пипетка — подобрать то, что уже стоит</dd>
        <dt>V</dt><dd>Перенести поставленное</dd>
        <dt>F</dt><dd>Залить область материалом</dd>
        <dt>L</dt><dd>Тропа: два клика, дорога ляжет сама</dd>
        <dt>1 2 3</dt><dd>Размер кисти земли</dd>
        <dt>Ctrl+Z</dt><dd>Отменить · с Shift — вернуть</dd>
        <dt>R</dt><dd>Убрать крышу — заглянуть в комнаты</dd>
        <dt>S</dt><dd>Настройки: частицы, контраст, размер</dd>
        <dt>Shift+P</dt><dd>Формат снимка: широкий · квадрат · свиток</dd>
        <dt>U</dt><dd>Усадьбы: несколько садов, файл на диск</dd>
        <dt>Esc</dt><dd>Отложить инструмент</dd>`;

    const timeRows = touch
      ? `
        <dt>Часы</dt><dd>Время в саду равно вашему</dd>
        <dt>Сезон</dt><dd>Три реальных дня; год — двенадцать</dd>
        <dt>Рост</dt><dd>Сакура взрослеет за неделю. Ничто не гибнет.</dd>`
      : `
        <dt>Часы</dt><dd>Время в саду равно вашему</dd>
        <dt>Сезон</dt><dd>Три реальных дня; год — двенадцать</dd>
        <dt>Рост</dt><dd>Сакура взрослеет за неделю. Ничто не гибнет.</dd>
        <dt>T</dt><dd>Мастерская времени: выбрать час, сезон и погоду</dd>
        <dt>← →</dt><dd>Сдвинуть час; с Shift — сменить сезон</dd>`;

    help.innerHTML = `
      <div class="scroll-close">${svgIcon('close', 18)}</div>
      <h2>Усадьба Безмятежности</h2>
      <div class="lead">Здесь некуда спешить. Сад растёт сам, а вы просто выбираете, чему в нём быть.</div>
      <div class="section">Взгляд</div>
      <dl>${look}</dl>
      <div class="section">Строительство</div>
      <dl>${build}</dl>
      <div class="section">Время</div>
      <dl>${timeRows}</dl>
      <div class="section">Мастерство</div>
      <dl>
        <dt>Вехи</dt><dd>Новые вкладки открываются от ваших же дел: выкопали пруд — пришли лотосы</dd>
      </dl>
      <div class="scroll-chron" role="button" tabindex="0"><span lang="ja">記</span>Летопись сада — первые встречи и редкие события</div>
      <div class="scroll-sit" role="button" tabindex="0"><span lang="ja">坐</span>Сесть в тишине — практики и школа дзена</div>`;
    layer.appendChild(help);
    this.els.help = help;
    help.querySelector('.scroll-close')!.addEventListener('click', () => this.toggleHelp(false));
    const sitBtn = help.querySelector<HTMLElement>('.scroll-sit')!;
    const goSit = (): void => {
      this.toggleHelp(false);
      this.hooks.onSit();
    };
    sitBtn.addEventListener('click', goSit);
    sitBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        goSit();
      }
    });
    const chronBtn = help.querySelector<HTMLElement>('.scroll-chron')!;
    const goChron = (): void => {
      this.toggleHelp(false);
      this.hooks.onChronicle();
    };
    chronBtn.addEventListener('click', goChron);
    chronBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        goChron();
      }
    });

    // --- Тихая строка входа в летопись: приходит в созерцании ---
    const chron = this.el('div', 'chron-line');
    chron.innerHTML = `<span class="kanji" lang="ja">記</span>летопись сада`;
    chron.setAttribute('role', 'button');
    chron.setAttribute('tabindex', '0');
    chron.addEventListener('click', () => this.hooks.onChronicle());
    chron.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.hooks.onChronicle();
      }
    });
    layer.appendChild(chron);
    this.els.chron = chron;

    // --- Заметка о созерцании ---
    const note = this.el('div', 'zen-note fade keep');
    note.textContent = '';
    layer.appendChild(note);
    this.els.note = note;

    // --- Тихая строка входа в практику ---
    // Приходит только в созерцании, когда интерфейс уже растворился:
    // практика предлагает себя ровно тогда, когда исчезло всё остальное.
    // Девятой кнопки в столбце не будет (её лишней назвала ещё сессия 6).
    const sit = this.el('div', 'sit-line');
    sit.innerHTML = `<span class="kanji" lang="ja">坐</span>сесть в тишине`;
    sit.setAttribute('role', 'button');
    sit.setAttribute('tabindex', '0');
    sit.addEventListener('click', () => this.hooks.onSit());
    sit.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.hooks.onSit();
      }
    });
    layer.appendChild(sit);
    this.els.sit = sit;

    // --- Тихая строка растущего сада: «куда расти?» ---
    const grow = this.el('div', 'grow-line');
    grow.innerHTML = `<span class="kanji" lang="ja">拡</span>куда расти?`;
    grow.setAttribute('role', 'button');
    grow.setAttribute('tabindex', '0');
    grow.addEventListener('click', () => this.hooks.onGrowLine());
    grow.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.hooks.onGrowLine();
      }
    });
    layer.appendChild(grow);
    this.els.grow = grow;

    this.root.appendChild(layer);
    this.renderTabs();
    this.renderItems();
  }

  // ---- Каталог ----

  private tabUnlocked(id: string): boolean {
    const tab = TABS.find((t) => t.id === id);
    if (!tab) return false;
    return !tab.requires || this.world.milestones.has(tab.requires);
  }

  renderTabs(): void {
    this.els.tabs.innerHTML = '';
    for (const tab of TABS) {
      const unlocked = this.tabUnlocked(tab.id);
      const isNew = unlocked && !this.world.seenTabs.has(tab.id);
      const e = this.el(
        'div',
        `tab ${this.activeTab === tab.id ? 'active' : ''} ${unlocked ? '' : 'locked'} ${isNew ? 'new' : ''}`,
      );
      e.innerHTML = `${svgIcon(tab.icon, 17)}<span>${unlocked ? tab.name : '＊'}</span>`;
      if (unlocked) {
        e.addEventListener('click', () => {
          this.activeTab = tab.id;
          this.world.seenTabs.add(tab.id);
          this.renderTabs();
          this.renderItems();
        });
      }
      this.els.tabs.appendChild(e);
    }
  }

  renderItems(): void {
    const box = this.els.items;
    box.innerHTML = '';

    const brushes = TERRAIN_BRUSHES.filter((b) => b.tab === this.activeTab);
    const items = ITEMS.filter((i) => i.tab === this.activeTab);

    for (const b of brushes) {
      const e = this.el('div', 'item paper');
      const sel = this.selection.kind === 'brush' && this.selection.brush.id === b.id;
      if (sel) e.classList.add('selected');
      const icon =
        b.kind === 'water'
          ? 'water'
          : b.kind === 'hill'
            ? 'hill'
            : b.kind === 'lower'
              ? 'hill'
              : b.kind === 'floor'
                ? 'house'
                : 'ground';
      const size = b.w > 1 || b.h > 1 ? ` ${b.w}×${b.h}` : '';
      e.innerHTML = `<div class="thumb">${svgIcon(icon, 34)}</div><div class="name">${b.name}${size}</div><div class="hint">${b.hint}</div>`;
      e.addEventListener('click', () => this.select({ kind: 'brush', brush: b }));
      box.appendChild(e);
    }

    for (const it of items) {
      const e = this.el('div', 'item paper');
      const sel = this.selection.kind === 'item' && this.selection.item.id === it.id;
      if (sel) e.classList.add('selected');
      const src = this.atm ? itemIcon(it.id, this.atm, 56) : '';
      const size = it.w > 1 || it.h > 1 ? ` ${it.w}×${it.h}` : '';
      e.innerHTML = `<div class="thumb">${src ? `<img src="${src}" alt="">` : svgIcon('micro', 30)}</div>
        <div class="name">${it.name}${size}</div><div class="hint">${it.hint}</div>`;
      e.addEventListener('click', () => this.select({ kind: 'item', item: it }));
      box.appendChild(e);
    }

    // Кнопка «убрать»
    const er = this.el('div', 'item paper');
    if (this.selection.kind === 'erase') er.classList.add('selected');
    er.innerHTML = `<div class="thumb">${svgIcon('erase', 32)}</div><div class="name">Убрать</div><div class="hint">вернуть на место</div>`;
    er.addEventListener('click', () => this.select({ kind: 'erase' }));
    box.appendChild(er);
  }

  /** Открыть вкладку каталога — нужно пипетке. */
  openTab(id: string): void {
    if (!this.tabUnlocked(id)) return;
    this.activeTab = id;
    this.world.seenTabs.add(id);
    this.renderTabs();
    this.renderItems();
  }

  /** Заливка по клавише F. */
  fillFromKeyboard(): void {
    this.startFill();
  }

  setBrushSize(n: number): void {
    this.brushSize = n;
    this.els.buildbar.querySelectorAll<HTMLElement>('.bb-size').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.size) === n);
    });
    this.hooks.onBrushSize(n);
    if (this.selection.kind === 'brush' && this.selection.brush.kind === 'ground') {
      this.setHint(`${this.selection.brush.name} · кисть ${n}×${n}`);
    }
  }

  /** Заливка работает материалом выбранной кисти земли. */
  private startFill(): void {
    if (this.selection.kind === 'fill') {
      this.select({ kind: 'none' });
      return;
    }
    const brush = this.selection.kind === 'brush' && this.selection.brush.ground ? this.selection.brush : null;
    if (!brush) {
      this.toast('Сначала выберите материал на вкладке «Земля»');
      this.activeTab = 'ground';
      this.renderTabs();
      this.renderItems();
      this.toggleBuild(true);
      return;
    }
    this.select({ kind: 'fill', ground: brush.ground!, name: brush.name });
  }

  /** Подсветка активного инструмента и доступности отмены. */
  private syncBuildbar(): void {
    const bb = this.els.buildbar;
    if (!bb) return;
    const k = this.selection.kind;
    bb.querySelector('[data-act="pick"]')!.classList.toggle('active', k === 'pick');
    bb.querySelector('[data-act="move"]')!.classList.toggle('active', k === 'move');
    bb.querySelector('[data-act="fill"]')!.classList.toggle('active', k === 'fill');
    bb.querySelector('[data-act="path"]')!.classList.toggle('active', k === 'path');
  }

  setHistoryState(canUndo: boolean, canRedo: boolean, undoLabel: string, redoLabel: string): void {
    const bb = this.els.buildbar;
    if (!bb) return;
    const u = bb.querySelector<HTMLElement>('[data-act="undo"]')!;
    const r = bb.querySelector<HTMLElement>('[data-act="redo"]')!;
    u.classList.toggle('off', !canUndo);
    r.classList.toggle('off', !canRedo);
    u.title = canUndo ? `Отменить: ${undoLabel} (Ctrl+Z)` : 'Отменять нечего';
    r.title = canRedo ? `Повторить: ${redoLabel} (Ctrl+Shift+Z)` : 'Повторять нечего';
  }

  select(sel: Selection): void {
    this.selection = sel;
    this.renderItems();
    this.syncBuildbar();
    this.hooks.onSelect(sel);
    // Подсказки называют то действие, которое у игрока под рукой:
    // на телефоне «коснитесь», на мыши «кликните».
    const touch = matchMedia('(hover: none)').matches;
    const tap = touch ? 'коснитесь' : 'кликните';
    if (sel.kind === 'item') {
      this.setHint(
        touch
          ? `${sel.item.name} — коснитесь, чтобы поставить`
          : `${sel.item.name} — клик, чтобы поставить · R — поворот`,
      );
    } else if (sel.kind === 'brush') {
      const sz =
        sel.brush.kind === 'ground' && this.brushSize > 1 ? ` · кисть ${this.brushSize}×${this.brushSize}` : '';
      this.setHint(touch ? `${sel.brush.name} — ведите пальцем${sz}` : `${sel.brush.name} — зажмите и ведите${sz}`);
    } else if (sel.kind === 'erase') {
      this.setHint(`${tap[0].toUpperCase()}${tap.slice(1)} по предмету, чтобы убрать`);
    } else if (sel.kind === 'pick') {
      this.setHint(`Пипетка — ${tap} по тому, что хотите продолжить ставить`);
    } else if (sel.kind === 'fill') {
      this.setHint(`Заливка «${sel.name}» — ${tap} по области`);
    } else if (sel.kind === 'move') {
      this.setHint(
        touch ? 'Перенос — коснитесь предмета, затем места' : 'Перенос — тяните поставленное на новое место',
      );
    } else if (sel.kind === 'path') {
      this.setHint('Тропа — отметьте начало, потом конец; дорога ляжет сама');
    }
  }

  toggleBuild(force?: boolean): void {
    this.buildOpen = force ?? !this.buildOpen;
    this.els.catalog.classList.toggle('open', this.buildOpen);
    this.els.buildbar.classList.toggle('show', this.buildOpen);
    this.els.btnBuild.classList.toggle('active', this.buildOpen);
    // Режим стройки виден и в CSS: на телефоне по нему прячется подсказка,
    // которую иначе закрывает боковой каталог.
    document.body.classList.toggle('building', this.buildOpen);
    if (!this.buildOpen) this.select({ kind: 'none' });
    else this.setHint('Выберите, чему появиться в саду');
    this.hooks.onToggleBuild(this.buildOpen);
  }

  toggleHelp(force?: boolean): void {
    const open = force ?? !this.els.help.classList.contains('show');
    this.els.help.classList.toggle('show', open);
    this.els.btnHelp.classList.toggle('active', open);
  }

  setSoundState(on: boolean): void {
    const b = this.els.btnSound;
    if (!b) return;
    b.classList.toggle('active', on);
    b.innerHTML = `${svgIcon(on ? 'sound-on' : 'sound-off', 23)}<span class="label">${
      on ? 'Тишина (M)' : 'Звук (M)'
    }</span>`;
  }

  /** Кнопка кровли: подписываем действием, а не состоянием. */
  setRoofState(visible: boolean): void {
    const b = this.els.btnRoof;
    if (!b) return;
    b.classList.toggle('active', !visible);
    b.innerHTML = `${svgIcon(visible ? 'roof' : 'roof-off', 23)}<span class="label">${
      visible ? 'Убрать крышу (R)' : 'Вернуть крышу (R)'
    }</span>`;
  }

  setHint(text: string): void {
    this.els.hint.textContent = text;
  }

  toast(text: string): void {
    this.els.toast.textContent = text;
    this.els.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.els.toast.classList.remove('show'), 2600);
  }

  showMilestone(id: string): void {
    const m = MILESTONES[id];
    if (!m) return;
    const e = this.els.milestone;
    e.querySelector('h3')!.textContent = m.title;
    e.querySelector('p')!.textContent = m.text;
    e.querySelector('.unlock')!.textContent = `открыто: ${m.unlocks}`;
    e.classList.add('show');
    clearTimeout(this.milestoneTimer);
    this.milestoneTimer = window.setTimeout(() => e.classList.remove('show'), 5200);
    this.renderTabs();
  }

  /** Обновление часов и сезонной полоски. */
  tick(t: TimeState, atm: Atmosphere): void {
    const prevSeason = this.iconSeason;
    this.atm = atm;
    this.els.clock.textContent = t.label;
    this.els.kanji.textContent = SEASON_KANJI[t.season];
    this.els.sub.textContent = `${SEASON_NAMES[t.season].toLowerCase()} · ${partOfDay(t)} · ${SEASON_POEM[t.season]}`;
    (this.els.bar as HTMLElement).style.width = `${(t.seasonT * 100).toFixed(1)}%`;
    if (prevSeason !== t.season) {
      this.iconSeason = t.season;
      if (prevSeason) this.renderItems();
      else this.renderItems();
    }
  }

  setZenNote(text: string): void {
    this.els.note.textContent = text;
    // Класс включает отложенное проявление: надпись приходит, когда
    // интерфейс уже почти растворился, а не спорит с ним за место.
    this.els.note.classList.toggle('on', text !== '');
  }

  /** Тихая строка «сесть в тишине» видна только в созерцании. */
  setSitVisible(v: boolean): void {
    this.els.sit.classList.toggle('show', v);
  }

  /** Тихая строка летописи приходит туда же, где исчез остальной интерфейс. */
  /** Строка «куда расти?»: видна, когда сад готов вырасти. */
  setGrowVisible(v: boolean): void {
    this.els.grow?.classList.toggle('show', v);
  }

  setChronVisible(v: boolean): void {
    this.els.chron.classList.toggle('show', v);
  }
}
