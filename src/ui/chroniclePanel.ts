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
import { MILESTONES } from '../world/catalog';

const CHRONICLE_IMAGES: Record<string, string> = {
  // лягушки и вода
  meet_frog: './images/chronicle/meet_frog.webp',
  chorus: './images/chronicle/chorus.webp',
  // стрекозы
  meet_dragonfly: './images/chronicle/meet_dragonfly.webp',
  dragonfly_pair: './images/chronicle/dragonfly_pair.webp',
  // птицы и кормушка
  meet_feeder: './images/chronicle/meet_feeder.webp',
  flock: './images/chronicle/flock.webp',
  birds_fled: './images/chronicle/birds_fled.webp',
  bath_splash: './images/chronicle/bath_splash.webp',
  winter_table: './images/chronicle/winter_table.webp',
  // коты
  meet_guest: './images/chronicle/meet_guest.webp',
  guest_stayed: './images/chronicle/guest_stayed.webp',
  cats_greet: './images/chronicle/cats_greet.webp',
  // светлячки и мотыльки
  meet_firefly: './images/chronicle/meet_firefly.webp',
  firefly_dance: './images/chronicle/firefly_dance.webp',
  meet_moth: './images/chronicle/meet_moth.webp',
  // цапля
  meet_heron: './images/chronicle/meet_heron.webp',
  heron_strike: './images/chronicle/heron_strike.webp',
  // олени
  meet_deer: './images/chronicle/meet_deer.webp',
  deer_pair: './images/chronicle/deer_pair.webp',
  // ёжик
  meet_hedgehog: './images/chronicle/meet_hedgehog.webp',
  hedgehog_curl: './images/chronicle/hedgehog_curl.webp',
  // мышки и кошки-мышки
  meet_mouse: './images/chronicle/meet_mouse.webp',
  mouse_fled: './images/chronicle/mouse_fled.webp',
  cat_mouse: './images/chronicle/cat_mouse.webp',
  // сова
  meet_owl: './images/chronicle/meet_owl.webp',
  owl_hoot: './images/chronicle/owl_hoot.webp',
  owl_hunt: './images/chronicle/owl_hunt.webp',
  // белка
  meet_squirrel: './images/chronicle/meet_squirrel.webp',
  squirrel_cache: './images/chronicle/squirrel_cache.webp',
  cat_squirrel: './images/chronicle/cat_squirrel.webp',
  // черепаха
  meet_turtle: './images/chronicle/meet_turtle.webp',
  turtle_bask: './images/chronicle/turtle_bask.webp',
  // пчёлы
  meet_bee: './images/chronicle/meet_bee.webp',
  bee_swarm: './images/chronicle/bee_swarm.webp',
  // идеи (северный мох, гнёзда, умные кои) — отдельные иллюстрации
  koi_smart: './images/chronicle/koi_smart.webp',
  north_moss: './images/chronicle/north_moss.webp',
  bird_nest: './images/chronicle/bird_nest.webp',
};

export class ChroniclePanel {
  private root: HTMLElement;
  private list: HTMLElement;
  private empty: HTMLElement;
  private milesWrap: HTMLElement;
  private miles: HTMLElement;
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
      <div class="ch-miles-wrap">
        <h3>Вехи мастерства</h3>
        <div class="ch-miles"></div>
      </div>
      <div class="ch-empty">Летопись пока пуста. Сад знакомится с вами: посидите у воды, поставьте кормушку, не спугните кота.</div>`;
    parent.appendChild(root);
    this.root = root;
    this.list = root.querySelector('.ch-list')!;
    this.empty = root.querySelector('.ch-empty')!;
    this.milesWrap = root.querySelector('.ch-miles-wrap')!;
    this.miles = root.querySelector('.ch-miles')!;
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
    // Вехи: тихий список свершившегося, без чисел и без рамок
    this.miles.innerHTML = '';
    const done = Object.keys(MILESTONES).filter((id) => this.world.milestones.has(id));
    this.milesWrap.style.display = done.length ? '' : 'none';
    for (const id of done) {
      const m = MILESTONES[id];
      const row = document.createElement('div');
      row.className = 'ch-mile';
      const t = document.createElement('span');
      t.className = 'ch-mile-title';
      t.textContent = m.title;
      const u = document.createElement('span');
      u.className = 'ch-mile-unlock';
      u.textContent = m.unlocks;
      row.appendChild(t);
      row.appendChild(u);
      this.miles.appendChild(row);
    }
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
      date.textContent = chronicleDate(e.at, this.world.born);
      const text = document.createElement('div');
      text.className = 'ch-text';
      text.textContent = t.text;
      body.appendChild(date);
      body.appendChild(text);
      const imgSrc = CHRONICLE_IMAGES[e.id];
      if (imgSrc) {
        const img = document.createElement('img');
        img.className = 'ch-img';
        img.src = imgSrc;
        img.alt = '';
        img.loading = 'lazy';
        body.appendChild(img);
      }
      row.appendChild(kanji);
      row.appendChild(body);
      this.list.appendChild(row);
    }
  }
}
