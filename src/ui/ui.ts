/** Исчезающий интерфейс: каталог, часы, вехи, свиток помощи. */

import { CatalogItem, ITEMS, MILESTONES, TABS, TERRAIN_BRUSHES, TerrainBrush } from '../world/catalog';
import { SEASON_NAMES, SEASON_POEM, TimeState, partOfDay } from '../core/clock';
import { Atmosphere } from '../world/palette';
import { World } from '../world/world';
import { itemIcon, svgIcon } from './icons';

const SEASON_KANJI: Record<string, string> = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };

export type Selection =
  | { kind: 'none' }
  | { kind: 'item'; item: CatalogItem }
  | { kind: 'brush'; brush: TerrainBrush }
  | { kind: 'erase' };

export interface UIHooks {
  onSelect(sel: Selection): void;
  onToggleBuild(open: boolean): void;
  onZen(): void;
  onScreenshot(): void;
  onReset(): void;
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
    layer.appendChild(time);
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
    this.els.btnHelp = mk('scroll', 'Свиток (H)');
    layer.appendChild(tools);

    this.els.btnBuild.addEventListener('click', () => this.toggleBuild());
    this.els.btnZen.addEventListener('click', () => this.hooks.onZen());
    this.els.btnShot.addEventListener('click', () => this.hooks.onScreenshot());
    this.els.btnSound.addEventListener('click', () => this.onSound?.());
    this.els.btnHelp.addEventListener('click', () => this.toggleHelp());

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
    hint.textContent = 'Перетаскивайте — осматривайте сад. Колесо — приблизить.';
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
    help.innerHTML = `
      <div class="scroll-close">${svgIcon('close', 18)}</div>
      <h2>Усадьба Безмятежности</h2>
      <div class="lead">Здесь некуда спешить. Сад растёт сам, а вы просто выбираете, чему в нём быть.</div>
      <div class="section">Взгляд</div>
      <dl>
        <dt>Перетащить</dt><dd>Двигать камеру по усадьбе</dd>
        <dt>Колесо</dt><dd>Приблизить или отдалить</dd>
        <dt>Z</dt><dd>Созерцание — интерфейс растворяется</dd>
        <dt>P</dt><dd>Сохранить снимок сада</dd>
        <dt>M</dt><dd>Звук сада: листва, вода, цикады, дождь</dd>
      </dl>
      <div class="section">Строительство</div>
      <dl>
        <dt>B</dt><dd>Открыть или закрыть каталог</dd>
        <dt>Клик</dt><dd>Поставить выбранное</dd>
        <dt>Зажать</dt><dd>Рисовать землёй и мелочами</dd>
        <dt>R</dt><dd>Повернуть предмет</dd>
        <dt>X / ПКМ</dt><dd>Убрать предмет</dd>
        <dt>Esc</dt><dd>Отложить инструмент</dd>
      </dl>
      <div class="section">Время</div>
      <dl>
        <dt>Часы</dt><dd>Время в саду равно вашему</dd>
        <dt>Сезон</dt><dd>Три реальных дня; год — двенадцать</dd>
        <dt>Рост</dt><dd>Сакура взрослеет за неделю. Ничто не гибнет.</dd>
        <dt>T</dt><dd>Мастерская времени: выбрать час, сезон и погоду</dd>
        <dt>← →</dt><dd>Сдвинуть час; с Shift — сменить сезон</dd>
      </dl>
      <div class="section">Мастерство</div>
      <dl>
        <dt>Вехи</dt><dd>Новые вкладки открываются от ваших же дел: выкопали пруд — пришли лотосы</dd>
      </dl>`;
    layer.appendChild(help);
    this.els.help = help;
    help.querySelector('.scroll-close')!.addEventListener('click', () => this.toggleHelp(false));

    // --- Заметка о созерцании ---
    const note = this.el('div', 'zen-note fade keep');
    note.textContent = '';
    layer.appendChild(note);
    this.els.note = note;

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
        b.kind === 'water' ? 'water' : b.kind === 'hill' ? 'hill' : b.kind === 'lower' ? 'hill' : b.kind === 'floor' ? 'house' : 'ground';
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

  select(sel: Selection): void {
    this.selection = sel;
    this.renderItems();
    this.hooks.onSelect(sel);
    if (sel.kind === 'item') this.setHint(`${sel.item.name} — клик, чтобы поставить · R — поворот`);
    else if (sel.kind === 'brush') this.setHint(`${sel.brush.name} — зажмите и ведите`);
    else if (sel.kind === 'erase') this.setHint('Кликните по предмету, чтобы убрать');
  }

  toggleBuild(force?: boolean): void {
    this.buildOpen = force ?? !this.buildOpen;
    this.els.catalog.classList.toggle('open', this.buildOpen);
    this.els.btnBuild.classList.toggle('active', this.buildOpen);
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
  }
}
