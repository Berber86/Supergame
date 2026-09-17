/** Выбор усадьбы: список слотов, переименование, файл на диск и обратно. */

import { GardenStore } from '../world/gardens';
import { World } from '../world/world';
import { svgIcon } from './icons';

export interface GardensHooks {
  /** Мир заменился — пересобрать сцену и интерфейс. */
  onSwitch(): void;
  toast(text: string): void;
}

function ago(ms: number): string {
  const d = Date.now() - ms;
  const min = Math.floor(d / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч назад`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'вчера';
  if (days < 7) return `${days} дн назад`;
  return new Date(ms).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

export class GardensPanel {
  private el: HTMLElement;
  private listEl: HTMLElement;
  private store: GardenStore;
  private world: World;
  private hooks: GardensHooks;
  private fileInput: HTMLInputElement;

  constructor(parent: HTMLElement, world: World, store: GardenStore, hooks: GardensHooks) {
    this.world = world;
    this.store = store;
    this.hooks = hooks;

    const el = document.createElement('div');
    el.className = 'gardens-panel paper';
    el.innerHTML = `
      <div class="gp-head">
        <span class="gp-title">Усадьбы</span>
        <span class="gp-close">${svgIcon('close', 15)}</span>
      </div>
      <div class="gp-list"></div>
      <div class="gp-actions">
        <div class="gp-btn" data-act="new">${svgIcon('plus', 15)}<span>Новая</span></div>
        <div class="gp-btn" data-act="export">${svgIcon('file', 15)}<span>Выгрузить</span></div>
        <div class="gp-btn" data-act="import">${svgIcon('gardens', 15)}<span>Принять</span></div>
      </div>
      <div class="gp-hint">Усадьбы хранятся в этом браузере. Выгрузите файл, чтобы перенести сад на другое устройство.</div>`;
    parent.appendChild(el);
    this.el = el;
    this.listEl = el.querySelector('.gp-list')!;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    el.appendChild(input);
    this.fileInput = input;
    input.addEventListener('change', () => void this.onFile());

    el.querySelector('.gp-close')!.addEventListener('click', () => this.setOpen(false));
    el.querySelectorAll<HTMLElement>('.gp-btn').forEach((b) => {
      b.addEventListener('click', () => this.action(b.dataset.act!));
    });

    this.refresh();
  }

  get isOpen(): boolean {
    return this.el.classList.contains('show');
  }

  setOpen(v: boolean): void {
    this.el.classList.toggle('show', v);
    if (v) this.refresh();
  }

  toggle(): void {
    this.setOpen(!this.isOpen);
  }

  private action(act: string): void {
    if (act === 'new') {
      const m = this.store.create(this.world);
      this.hooks.onSwitch();
      this.refresh();
      this.hooks.toast(`«${m.name}» — чистая земля`);
    } else if (act === 'export') {
      this.store.exportFile(this.world);
      this.hooks.toast('Сад выгружен файлом');
    } else if (act === 'import') {
      this.fileInput.click();
    }
  }

  private async onFile(): Promise<void> {
    const f = this.fileInput.files?.[0];
    this.fileInput.value = '';
    if (!f) return;
    const name = await this.store.importFile(this.world, f);
    if (name) {
      this.hooks.onSwitch();
      this.refresh();
      this.hooks.toast(`«${name}» принята`);
    } else {
      this.hooks.toast('Не удалось прочитать файл сада');
    }
  }

  refresh(): void {
    this.listEl.innerHTML = '';
    const only = this.store.list.length <= 1;
    for (const g of this.store.list) {
      const row = document.createElement('div');
      row.className = `gp-row${g.id === this.store.activeId ? ' active' : ''}`;
      row.innerHTML = `
        <div class="gp-info">
          <div class="gp-name" title="Нажмите, чтобы переименовать">${g.name}</div>
          <div class="gp-meta">${g.objects ? `${g.objects} предметов` : 'пустая земля'} · ${ago(g.saved)}</div>
        </div>
        <span class="gp-del${only ? ' off' : ''}" title="Удалить">${svgIcon('trash', 14)}</span>`;

      row.querySelector('.gp-info')!.addEventListener('click', () => {
        if (g.id === this.store.activeId) {
          this.startRename(row, g.id, g.name);
          return;
        }
        if (this.store.switchTo(this.world, g.id)) {
          this.hooks.onSwitch();
          this.refresh();
          this.hooks.toast(`«${g.name}»`);
        } else {
          this.hooks.toast(`Не удалось открыть «${g.name}» — сохранение повреждено`);
        }
      });

      const del = row.querySelector('.gp-del')!;
      if (!only) {
        del.addEventListener('click', (e) => {
          e.stopPropagation();
          if (del.classList.contains('confirm')) {
            const wasActive = g.id === this.store.activeId;
            if (this.store.remove(this.world, g.id)) {
              if (wasActive) this.hooks.onSwitch();
              this.refresh();
              this.hooks.toast(`«${g.name}» убрана`);
            }
          } else {
            // двойное нажатие вместо окна подтверждения — тише и быстрее
            this.listEl.querySelectorAll('.gp-del.confirm').forEach((o) => o.classList.remove('confirm'));
            del.classList.add('confirm');
            setTimeout(() => del.classList.remove('confirm'), 3000);
          }
        });
      }
      this.listEl.appendChild(row);
    }
  }

  private startRename(row: HTMLElement, id: string, current: string): void {
    const nameEl = row.querySelector<HTMLElement>('.gp-name')!;
    const input = document.createElement('input');
    input.className = 'gp-rename';
    input.value = current;
    input.maxLength = 40;
    nameEl.replaceWith(input);
    input.focus();
    input.select();
    const finish = (save: boolean) => {
      if (save) this.store.rename(id, input.value);
      this.refresh();
    };
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') finish(true);
      else if (e.key === 'Escape') finish(false);
    });
  }
}
