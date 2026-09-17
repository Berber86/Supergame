/**
 * Летопись усадьбы: свиток с первыми встречами и редкими событиями.
 *
 * Открывается тихо — строкой в созерцании и строкой в свитке помощи,
 * без новой кнопки в столбце. Внутри нет ни чисел, ни наград: только
 * «весна · год второй · сумерки» и одна фраза о том, что случилось.
 */

import './chronicle.css';
import { chronicleDate, chronicleText } from '../world/chronicle';
import { World } from '../world/world';
import { svgIcon } from './icons';

export class ChroniclePanel {
  private root: HTMLElement;
  private list: HTMLElement;
  private empty: HTMLElement;
  private open = false;

  constructor(
    parent: HTMLElement,
    private world: World,
  ) {
    const root = document.createElement('div');
    root.className = 'chronicle paper';
    root.innerHTML = `
      <div class="ch-close">${svgIcon('close', 18)}</div>
      <h2>Летопись сада</h2>
      <div class="ch-lead">Строки, которые сад записал сам: первые встречи и редкие события. Чисел здесь нет — только то, что случилось.</div>
      <div class="ch-list"></div>
      <div class="ch-empty">Летопись пока пуста. Сад знакомится с вами: посидите у воды, поставьте кормушку, не спугните кота.</div>`;
    parent.appendChild(root);
    this.root = root;
    this.list = root.querySelector('.ch-list')!;
    this.empty = root.querySelector('.ch-empty')!;
    root.querySelector('.ch-close')!.addEventListener('click', () => this.setOpen(false));
  }

  get isOpen(): boolean {
    return this.open;
  }

  setOpen(on: boolean): void {
    this.open = on;
    if (on) this.render();
    this.root.classList.toggle('show', on);
  }

  toggle(): void {
    this.setOpen(!this.open);
  }

  private render(): void {
    this.list.innerHTML = '';
    const entries = [...this.world.chronicle].sort((a, b) => b.at - a.at);
    this.empty.style.display = entries.length ? 'none' : '';
    for (const e of entries) {
      const t = chronicleText(e.id);
      if (!t) continue;
      const row = document.createElement('div');
      row.className = 'ch-row';
      const kanji = document.createElement('span');
      kanji.className = 'ch-kanji';
      kanji.lang = 'ja';
      kanji.textContent = t.kanji;
      const body = document.createElement('div');
      body.className = 'ch-body';
      const date = document.createElement('div');
      date.className = 'ch-date';
      date.textContent = chronicleDate(e.at);
      const text = document.createElement('div');
      text.className = 'ch-text';
      text.textContent = t.text;
      body.appendChild(date);
      body.appendChild(text);
      row.appendChild(kanji);
      row.appendChild(body);
      this.list.appendChild(row);
    }
  }
}
