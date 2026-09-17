/**
 * Школа тишины: экран практик и сеансов.
 *
 * Полноэкранный лист поверх сада. Три вида: выбор (практики и уроки),
 * текст урока и сам сеанс с кругом дыхания. Ничего не давит: длительность
 * выбирается до, а не во время, встать можно одной кнопкой в любую секунду,
 * и это засчитается как состоявшееся сидение.
 *
 * Сеанс живёт в src/zen/session.ts без DOM; панель читает его `view`,
 * раздаёт события звуку и рисует круг. Пока сеанс идёт, сцена сада не
 * рисуется вовсе — батарея телефона важнее картинки за непрозрачным листом.
 */

import './practice.css';
import { computeTime } from '../core/clock';
import { CARE_NOTE, LESSONS, LESSON_BY_ID, PRACTICES, PRACTICE_BY_ID, Practice } from '../zen/content';
import { loadProgress, markCareSeen, noteSession } from '../zen/progress';
import { Session, SessionEvent } from '../zen/session';
import { svgIcon } from './icons';

export interface PracticeHooks {
  /** Сеанс или выбор открыты: главному циклу не нужно рисовать сад. */
  onActive(active: boolean): void;
  /** Приглушить сад на время сеанса. */
  duck(v: number): void;
  bowl(amount?: number): void;
  han(amount?: number): void;
  breath(phase: 'in' | 'out', seconds: number): void;
  toast(text: string): void;
}

const NUM_WORDS = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять'];

function minutesPhrase(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return n === 1 ? 'одну минуту' : `${n} минуту`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} минуты`;
  return `${n} минут`;
}

function timeLeft(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export class PracticePanel {
  private root: HTMLElement;
  private body: HTMLElement;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private session: Session | null = null;
  private lessonId: string | null = null;
  private raf = 0;
  private last = 0;
  private shown = false;
  private night = false;
  private lastPractice: Practice | null = null;
  private lastMinutes = 0;
  private endTimer = 0;

  constructor(parent: HTMLElement, private hooks: PracticeHooks) {
    const root = document.createElement('div');
    root.className = 'practice paper';
    root.innerHTML = `
      <div class="pr-head">
        <span class="pr-kanji" lang="ja">静</span>
        <span class="pr-title">Школа тишины</span>
        <span class="pr-close" role="button" tabindex="0" title="Закрыть">${svgIcon('close', 18)}</span>
      </div>
      <div class="pr-body"></div>`;
    parent.appendChild(root);
    this.root = root;
    this.body = root.querySelector('.pr-body')!;
    const close = root.querySelector<HTMLElement>('.pr-close')!;
    close.addEventListener('click', () => this.close());
    close.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.close();
      }
    });
  }

  get isOpen(): boolean {
    return this.shown;
  }

  openMenu(): void {
    this.stopSession(false);
    this.shown = true;
    this.root.classList.add('show');
    this.night = computeTime(Date.now()).daylight < 0.45;
    this.root.classList.toggle('night', this.night);
    this.hooks.onActive(true);
    this.renderMenu();
  }

  close(): void {
    this.stopSession(false);
    this.shown = false;
    this.root.classList.remove('show');
    this.hooks.onActive(false);
    this.hooks.duck(0);
  }

  // ---------------- Виды ----------------

  private renderMenu(): void {
    const p = loadProgress();
    if (!p.careSeen) markCareSeen();
    const done = p.lessons.length;
    const next = LESSONS.find((l) => !p.lessons.includes(l.id)) ?? null;

    const practiceRows = PRACTICES.map(
      (pr) => `
      <div class="pr-row" data-practice="${pr.id}">
        <span class="pr-row-kanji" lang="ja">${pr.kanji}</span>
        <div class="pr-row-info">
          <div class="pr-row-name">${pr.name}</div>
          <div class="pr-row-hint">${pr.hint}</div>
        </div>
        <div class="pr-chips">
          ${pr.minutes.map((m, i) => `<span class="pr-chip${i === 0 ? ' on' : ''}" data-min="${m}">${m} мин</span>`).join('')}
        </div>
      </div>`,
    ).join('');

    const lessonRows = LESSONS.map(
      (l) => `
      <div class="pr-row pr-lesson-row${p.lessons.includes(l.id) ? ' done' : ''}" data-lesson="${l.id}">
        <span class="pr-row-n">${l.n}</span>
        <div class="pr-row-info">
          <div class="pr-row-name"><span lang="ja">${l.kanji}</span> ${l.title}</div>
          <div class="pr-row-hint">${p.lessons.includes(l.id) ? 'прожито' : l.id === next?.id ? 'следующий' : ' '}</div>
        </div>
      </div>`,
    ).join('');

    this.body.innerHTML = `
      <div class="pr-menu">
        <div class="pr-lead">Сесть можно прямо сейчас: практике не нужны ни постройка, ни погода, ни особое время суток.</div>
        <div class="pr-cols">
          <section>
            <div class="pr-sec">Сесть</div>
            <div class="pr-list">${practiceRows}</div>
          </section>
          <section>
            <div class="pr-sec">Школа тишины · прожито ${done} из ${LESSONS.length}</div>
            <div class="pr-list">${lessonRows}</div>
          </section>
        </div>
        ${p.minutes > 0 ? `<div class="pr-memory">в вашей тишине — ${minutesPhrase(p.minutes).replace('одну минуту', 'одна минута')}</div>` : ''}
        <div class="pr-care">${CARE_NOTE}</div>
      </div>`;

    this.body.querySelectorAll<HTMLElement>('.pr-row[data-practice]').forEach((row) => {
      const id = row.dataset.practice!;
      row.querySelector('.pr-row-info')!.addEventListener('click', () => this.start(id, PRACTICE_BY_ID.get(id)!.minutes[0]));
      row.querySelectorAll<HTMLElement>('.pr-chip').forEach((chip) => {
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          this.start(id, Number(chip.dataset.min));
        });
      });
    });
    this.body.querySelectorAll<HTMLElement>('.pr-row[data-lesson]').forEach((row) => {
      row.addEventListener('click', () => this.renderLesson(row.dataset.lesson!));
    });
  }

  private renderLesson(id: string): void {
    const l = LESSON_BY_ID.get(id);
    if (!l) return;
    this.lessonId = id;
    const pr = PRACTICE_BY_ID.get(l.practice)!;
    this.body.innerHTML = `
      <div class="pr-lesson">
        <div class="pr-l-head">
          <span class="pr-l-kanji" lang="ja">${l.kanji}</span>
          <div>
            <div class="pr-l-n">урок ${l.n}</div>
            <h3>${l.title}</h3>
          </div>
        </div>
        <div class="pr-l-text">${l.text.map((t) => `<p>${t}</p>`).join('')}</div>
        <div class="pr-l-notice"><em>Что заметить</em>${l.notice}</div>
        <div class="pr-l-actions">
          <div class="pr-btn" data-sit>сесть на ${l.minutes} ${l.minutes === 1 ? 'минуту' : 'минут'}</div>
          <div class="pr-btn ghost" data-back>позже</div>
        </div>
      </div>`;
    this.body.querySelector('[data-sit]')!.addEventListener('click', () => this.start(pr.id, l.minutes));
    this.body.querySelector('[data-back]')!.addEventListener('click', () => this.renderMenu());
    this.body.scrollTop = 0;
  }

  private start(practiceId: string, minutes: number): void {
    const pr = PRACTICE_BY_ID.get(practiceId);
    if (!pr) return;
    this.session = new Session(pr, minutes);
    this.lastPractice = pr;
    this.lastMinutes = minutes;
    this.body.innerHTML = `
      <div class="pr-session">
        <canvas class="pr-canvas" aria-hidden="true"></canvas>
        <div class="pr-line"></div>
        <div class="pr-meta"></div>
        <div class="pr-btn pr-rise" role="button" tabindex="0">встать</div>
      </div>`;
    this.canvas = this.body.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.sizeCanvas();
    const rise = this.body.querySelector<HTMLElement>('.pr-rise')!;
    rise.addEventListener('click', () => this.rise());
    rise.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.rise();
      }
    });
    this.hooks.duck(0.75);
    this.last = performance.now();
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
  }

  private sizeCanvas(): void {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || 300;
    const h = this.canvas.clientHeight || 300;
    this.canvas.width = Math.max(2, Math.round(w * dpr));
    this.canvas.height = Math.max(2, Math.round(h * dpr));
  }

  /** Встали сами: сеанс всё равно состоялся и будет записан. */
  private rise(): void {
    const s = this.session;
    if (!s || s.done) return;
    s.finishEarly();
    this.hooks.bowl(0.8);
    this.finish(s.minutesSat(), true);
  }

  private finish(minutes: number, early: boolean): void {
    const pr = this.lastPractice;
    if (pr) noteSession(pr.id, minutes, this.lessonId ?? undefined);
    this.stopLoop();
    this.hooks.duck(0);
    this.session = null;
    const again = pr ? pr.id : 'sit';
    this.body.innerHTML = `
      <div class="pr-end">
        <div class="pr-end-kanji" lang="ja">円</div>
        <div class="pr-end-line">вы сидели ${minutesPhrase(minutes)}</div>
        <div class="pr-end-sub">${early ? 'встать раньше — тоже практика' : 'чаша конца. звук растаял сам'}</div>
        <div class="pr-actions">
          <div class="pr-btn" data-again>сесть ещё</div>
          <div class="pr-btn ghost" data-garden>вернуться в сад</div>
        </div>
      </div>`;
    this.body.querySelector('[data-again]')!.addEventListener('click', () => this.start(again, this.lastMinutes));
    this.body.querySelector('[data-garden]')!.addEventListener('click', () => this.close());
  }

  private stopSession(record: boolean): void {
    void record;
    if (this.session && !this.session.done) {
      this.session.finishEarly();
      this.session = null;
    }
    this.stopLoop();
    this.hooks.duck(0);
    if (this.endTimer) {
      window.clearTimeout(this.endTimer);
      this.endTimer = 0;
    }
  }

  private stopLoop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  // ---------------- Сеанс ----------------

  private loop = (now: number): void => {
    const s = this.session;
    if (!s) {
      this.raf = 0;
      return;
    }
    const dt = Math.min(100, now - this.last);
    this.last = now;
    for (const e of s.update(dt)) this.onEvent(e);
    this.draw(now);
    this.updateMeta();
    if (s.done) {
      // чаши конца: две, с интервалом, и только потом итог
      this.hooks.bowl(0.9);
      this.endTimer = window.setTimeout(() => this.hooks.bowl(0.7), 1700);
      this.endTimer = window.setTimeout(() => this.finish(s.minutesSat(), false), 3600);
      this.raf = 0;
      return;
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private onEvent(e: SessionEvent): void {
    switch (e.type) {
      case 'start':
        this.hooks.bowl(0.9);
        break;
      case 'breath':
        this.hooks.breath(e.phase, e.seconds);
        break;
      case 'han':
        this.hooks.han(0.8);
        break;
      case 'line':
        this.setLine(e.text);
        break;
      case 'count':
        this.setLine(`вдох — ${NUM_WORDS[e.n] ?? e.n}`);
        break;
      case 'close':
        this.setLine('время вышло. досидите выдох');
        break;
    }
  }

  private setLine(text: string): void {
    const el = this.body.querySelector('.pr-line');
    if (el) el.textContent = text;
  }

  private updateMeta(): void {
    const s = this.session;
    const el = this.body.querySelector('.pr-meta');
    if (!s || !el) return;
    const bits: string[] = [];
    if (s.view.count > 0) bits.push(`счёт · ${NUM_WORDS[s.view.count] ?? s.view.count}`);
    bits.push(`осталось ${timeLeft(s.view.total - s.view.elapsed)}`);
    el.textContent = bits.join('   ·   ');
  }

  // ---------------- Круг ----------------

  private draw(now: number): void {
    const c = this.canvas;
    const g = this.ctx;
    const s = this.session;
    if (!c || !g || !s) return;
    const W = c.width;
    const H = c.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) * 0.36;
    const ink = this.night ? '214,220,232' : '46,40,36';
    const mode = s.practice.mode;

    // тонкая дуга оставшегося времени: не циферблат, а след
    const left = 1 - Math.min(1, s.view.elapsed / s.view.total);
    g.strokeStyle = `rgba(${ink},0.22)`;
    g.lineWidth = 1.5 * dpr;
    g.beginPath();
    g.arc(cx, cy, R * 1.16, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2);
    g.stroke();

    // направляющий круг
    g.strokeStyle = `rgba(${ink},0.12)`;
    g.lineWidth = 1 * dpr;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.stroke();

    const v = s.view;
    const ease = (t: number): number => t * t * (3 - 2 * t);
    const breathK = v.breathPhase === 'in' ? ease(v.breathT) : 1 - ease(v.breathT);

    if (mode === 'listen') {
      // круги от камня, брошенного в воду: звук приходит и уходит
      for (let i = 0; i < 3; i++) {
        const t = ((now / 5200 + i / 3) % 1);
        g.strokeStyle = `rgba(${ink},${0.3 * (1 - t)})`;
        g.lineWidth = 1.6 * dpr;
        g.beginPath();
        g.arc(cx, cy, R * (0.2 + t * 0.95), 0, Math.PI * 2);
        g.stroke();
      }
    } else if (mode === 'walk') {
      // дорожка шагов: точка идёт по дуге, шаг на фазу
      const steps = Math.min(60, v.cycles * 2 + (v.breathPhase === 'out' ? 1 : 0));
      g.lineCap = 'round';
      for (let i = 0; i <= steps; i++) {
        const a = -Math.PI / 2 + (i / 60) * Math.PI * 2;
        const x = cx + Math.cos(a) * R * 0.9;
        const y = cy + Math.sin(a) * R * 0.9;
        g.fillStyle = `rgba(${ink},${i === steps ? 0.75 : 0.28})`;
        g.beginPath();
        g.ellipse(x, y, 4.5 * dpr, 3 * dpr, a, 0, Math.PI * 2);
        g.fill();
      }
    } else if (mode === 'sit' || mode === 'koan') {
      // неподвижный энсо и точка, которая дышит сама, без указаний
      this.ensoGuide(g, cx, cy, R, ink);
      const slow = 0.5 + 0.5 * Math.sin(now / 4600);
      g.fillStyle = `rgba(${ink},0.5)`;
      g.beginPath();
      g.arc(cx, cy, R * (0.05 + slow * 0.035), 0, Math.PI * 2);
      g.fill();
      if (mode === 'koan') {
        g.fillStyle = `rgba(${ink},0.62)`;
        g.font = `italic ${Math.round(R * 0.16)}px 'Cormorant Garamond', serif`;
        g.textAlign = 'center';
        g.fillText(s.practice.lines[3] ?? '', cx, cy + R * 0.5);
      }
    } else {
      // дышащее кольцо: вдох разводит, выдох собирает
      const r = R * (0.62 + 0.3 * breathK);
      g.strokeStyle = `rgba(${ink},0.55)`;
      g.lineWidth = R * 0.045;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = `rgba(${ink},0.14)`;
      g.lineWidth = R * 0.12;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
      if (mode === 'count' && v.count > 0) {
        g.fillStyle = `rgba(${ink},0.7)`;
        g.font = `${Math.round(R * 0.34)}px 'Cormorant Garamond', serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(NUM_WORDS[v.count] ?? String(v.count), cx, cy);
        g.textBaseline = 'alphabetic';
      }
      if (mode === 'three') {
        for (let i = 0; i < Math.min(3, v.cycles); i++) {
          g.strokeStyle = `rgba(${ink},0.5)`;
          g.lineWidth = 2 * dpr;
          g.beginPath();
          g.moveTo(cx - R * 0.24 + i * R * 0.24, cy + R * 0.52);
          g.lineTo(cx - R * 0.12 + i * R * 0.24, cy + R * 0.52);
          g.stroke();
        }
      }
    }
  }

  /** Тихий энсо позади: для сидения и коана круг не дышит по указке. */
  private ensoGuide(g: CanvasRenderingContext2D, cx: number, cy: number, R: number, ink: string): void {
    g.save();
    g.lineCap = 'round';
    const seg = 60;
    for (let i = 1; i < seg; i++) {
      const a0 = -Math.PI * 0.6 + ((i - 1) / seg) * Math.PI * 2 * 0.9;
      const a1 = -Math.PI * 0.6 + (i / seg) * Math.PI * 2 * 0.9;
      g.strokeStyle = `rgba(${ink},${0.3 - (i / seg) * 0.12})`;
      g.lineWidth = R * (0.03 + 0.02 * Math.sin((i / seg) * Math.PI));
      g.beginPath();
      g.moveTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R);
      g.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R);
      g.stroke();
    }
    g.restore();
  }
}
