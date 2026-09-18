/**
 * Школа тишины: экран практик и сеансов.
 *
 * Переработано: уроки хороши, а практика была неочевидна.
 * Теперь каждая практика имеет:
 *  - что это (what)
 *  - как делать (steps)
 *  - предпросмотр перед стартом с обратным отсчётом
 *  - постоянную подсказку во время сеанса: вдох/выдох с секундами,
 *    счёт, прогресс трёх вдохов, шаги, слушание.
 *
 * Сеанс живёт в src/zen/session.ts без DOM; панель читает view,
 * раздаёт события звуку и рисует круг. Пока сеанс идёт, сцена сада не
 * рисуется — батарея важнее картинки за непрозрачным листом.
 */

import './practice.css';
import { computeTime } from '../core/clock';
import { CARE_NOTE, LESSONS, LESSON_BY_ID, PRACTICES, PRACTICE_BY_ID, Practice } from '../zen/content';
import { loadProgress, markCareSeen, noteSession } from '../zen/progress';
import { Session, SessionEvent } from '../zen/session';
import { svgIcon } from './icons';

export interface PracticeHooks {
  onActive(active: boolean): void;
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

function minutesNominative(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return n === 1 ? 'одна минута' : `${n} минута`;
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
  private readyTimer = 0;
  private guideEl: HTMLElement | null = null;
  private breathLabel: HTMLElement | null = null;
  private countEl: HTMLElement | null = null;

  constructor(
    parent: HTMLElement,
    private hooks: PracticeHooks,
  ) {
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

    const practiceRows = PRACTICES.map((pr) => {
      const stepsPreview = pr.steps.slice(0, 2).join(' → ');
      const count = p.sessions[pr.id] ?? 0;
      return `
      <div class="pr-row" data-practice="${pr.id}">
        <span class="pr-row-kanji" lang="ja">${pr.kanji}</span>
        <div class="pr-row-info">
          <div class="pr-row-name">${pr.name}<span class="pr-row-what"> — ${pr.what}</span></div>
          <div class="pr-row-hint">${pr.hint}${count ? ` · сидели ${count} раз` : ''}</div>
          <div class="pr-row-steps">${stepsPreview}</div>
        </div>
        <div class="pr-chips">
          ${pr.minutes.map((m, i) => `<span class="pr-chip${i === 0 ? ' on' : ''}" data-min="${m}">${m} мин</span>`).join('')}
        </div>
      </div>`;
    }).join('');

    const lessonRows = LESSONS.map(
      (l) => `
      <div class="pr-row pr-lesson-row${p.lessons.includes(l.id) ? ' done' : ''}" data-lesson="${l.id}">
        <span class="pr-row-n">${l.n}</span>
        <div class="pr-row-info">
          <div class="pr-row-name"><span lang="ja">${l.kanji}</span> ${l.title}</div>
          <div class="pr-row-hint">${p.lessons.includes(l.id) ? 'прожито' : l.id === next?.id ? 'следующий → открой и сядь' : 'урок'}</div>
        </div>
      </div>`,
    ).join('');

    this.body.innerHTML = `
      <div class="pr-menu">
        <div class="pr-lead">Сядь сейчас — без построек и погоды. Выбери что делать → время → 3 секунды на вдох.</div>
        <div class="pr-cols">
          <section>
            <div class="pr-sec">Сесть — ${PRACTICES.length} практик</div>
            <div class="pr-list">${practiceRows}</div>
          </section>
          <section>
            <div class="pr-sec">Школа тишины · ${done} из ${LESSONS.length}</div>
            <div class="pr-list">${lessonRows}</div>
            ${p.minutes > 0 ? `<div class="pr-memory">в вашей тишине — ${minutesNominative(p.minutes)} · ${Object.values(p.sessions).reduce((a, b) => a + b, 0)} сеансов</div>` : ''}
            <div class="pr-care">${CARE_NOTE}</div>
          </section>
        </div>
      </div>`;

    this.body.querySelectorAll<HTMLElement>('.pr-row[data-practice]').forEach((row) => {
      const id = row.dataset.practice!;
      row.querySelector('.pr-row-info')!.addEventListener('click', () => this.renderPractice(id, PRACTICE_BY_ID.get(id)!.minutes[0]));
      row.querySelectorAll<HTMLElement>('.pr-chip').forEach((chip) => {
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          this.renderPractice(id, Number(chip.dataset.min));
        });
      });
    });
    this.body.querySelectorAll<HTMLElement>('.pr-row[data-lesson]').forEach((row) => {
      row.addEventListener('click', () => this.renderLesson(row.dataset.lesson!));
    });
  }

  private renderPractice(id: string, minutes: number): void {
    const pr = PRACTICE_BY_ID.get(id);
    if (!pr) return;
    this.lastPractice = pr;
    this.lastMinutes = minutes;
    const breathInfo = pr.breath ? `вдох ${pr.breath.inhale}с → выдох ${pr.breath.exhale}с` : 'дыхание естественное';
    this.body.innerHTML = `
      <div class="pr-practice">
        <div class="pr-l-head">
          <span class="pr-l-kanji" lang="ja">${pr.kanji}</span>
          <div>
            <div class="pr-l-n">практика · ${minutes} ${minutes === 1 ? 'минута' : 'минут'} · ${breathInfo}</div>
            <h3>${pr.name}</h3>
            <div class="pr-p-what">${pr.what}</div>
          </div>
        </div>
        <div class="pr-p-steps simple">
          <ol>
            ${pr.steps.map((s, i) => `<li><span class="pr-step-n">${i + 1}</span><span>${s}</span></li>`).join('')}
          </ol>
        </div>
        <div class="pr-l-actions">
          <div class="pr-btn primary" data-start>сесть на ${minutes} ${minutes === 1 ? 'минуту' : 'минут'}</div>
          <div class="pr-btn ghost" data-back>назад</div>
        </div>
        <div class="pr-p-meta">Встать можно в любой момент — засчитается. Чаша в начале и две в конце. Во время будут тихие подсказки.</div>
      </div>`;
    this.body.querySelector('[data-start]')!.addEventListener('click', () => this.startReady(pr.id, minutes));
    this.body.querySelector('[data-back]')!.addEventListener('click', () => this.renderMenu());
    this.body.scrollTop = 0;
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
            <div class="pr-l-n">урок ${l.n} · ${pr.name} · ${l.minutes} мин</div>
            <h3>${l.title}</h3>
          </div>
        </div>
        <div class="pr-l-text">${l.text.map((t) => `<p>${t}</p>`).join('')}</div>
        <div class="pr-l-notice"><em>Что заметить</em>${l.notice}</div>
        <details class="pr-l-details">
          <summary>Как сесть сейчас — ${pr.steps.length} шага <span>${pr.what}</span></summary>
          <ol class="pr-mini-steps">
            ${pr.steps.map((s, i) => `<li><span class="pr-step-n">${i + 1}</span><span>${s}</span></li>`).join('')}
          </ol>
        </details>
        <div class="pr-l-actions">
          <div class="pr-btn primary" data-sit>сесть на ${l.minutes} ${l.minutes === 1 ? 'минуту' : 'минут'}</div>
          <div class="pr-btn ghost" data-back>позже</div>
        </div>
      </div>`;
    this.body.querySelector('[data-sit]')!.addEventListener('click', () => this.startReady(pr.id, l.minutes, l.id));
    this.body.querySelector('[data-back]')!.addEventListener('click', () => this.renderMenu());
    this.body.scrollTop = 0;
  }

  // ---------------- Подготовка к старту: 3-2-1 ----------------

  private startReady(practiceId: string, minutes: number, lessonId?: string): void {
    const pr = PRACTICE_BY_ID.get(practiceId);
    if (!pr) return;
    if (lessonId) this.lessonId = lessonId;
    this.lastPractice = pr;
    this.lastMinutes = minutes;
    this.body.innerHTML = `
      <div class="pr-ready">
        <div class="pr-ready-kanji" lang="ja">${pr.kanji}</div>
        <div class="pr-ready-name">${pr.name} · ${minutes} мин</div>
        <div class="pr-ready-what">${pr.what}</div>
        <div class="pr-ready-step" data-step>${pr.steps[0]}</div>
        <div class="pr-ready-count" data-count>3</div>
        <div class="pr-ready-hint">сядьте, поправьте спину — чаша через 3 секунды</div>
        <div class="pr-btn ghost" data-cancel>отменить</div>
      </div>`;
    this.body.querySelector('[data-cancel]')!.addEventListener('click', () => this.renderPractice(pr.id, minutes));
    let n = 3;
    let stepIdx = 0;
    const stepEl = this.body.querySelector<HTMLElement>('[data-step]')!;
    const countEl = this.body.querySelector<HTMLElement>('[data-count]')!;
    this.readyTimer = window.setInterval(() => {
      n -= 1;
      stepIdx = Math.min(pr.steps.length - 1, stepIdx + 1);
      stepEl.textContent = pr.steps[stepIdx];
      if (n > 0) {
        countEl.textContent = String(n);
      } else {
        window.clearInterval(this.readyTimer);
        this.readyTimer = 0;
        this.start(practiceId, minutes);
      }
    }, 1000) as unknown as number;
  }

  private start(practiceId: string, minutes: number): void {
    const pr = PRACTICE_BY_ID.get(practiceId);
    if (!pr) return;
    this.session = new Session(pr, minutes);
    this.lastPractice = pr;
    this.lastMinutes = minutes;
    this.body.innerHTML = `
      <div class="pr-session">
        <div class="pr-session-head">
          <span class="pr-session-kanji" lang="ja">${pr.kanji}</span>
          <span class="pr-session-name">${pr.name}</span>
          <span class="pr-session-meta" data-meta>осталось ${minutes}:00</span>
        </div>
        <div class="pr-guide" data-guide>${pr.steps[0]}</div>
        <div class="pr-breath" data-breath></div>
        <div class="pr-count" data-count></div>
        <canvas class="pr-canvas" aria-hidden="true"></canvas>
        <div class="pr-line"></div>
        <div class="pr-dots" data-dots></div>
        <div class="pr-btn pr-rise" role="button" tabindex="0">встать — засчитается</div>
        <div class="pr-session-hint">вдох — круг растёт · выдох — сужается · мысль пришла — вернитесь</div>
      </div>`;
    this.canvas = this.body.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.guideEl = this.body.querySelector('[data-guide]')!;
    this.breathLabel = this.body.querySelector('[data-breath]')!;
    this.countEl = this.body.querySelector('[data-count]')!;
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
    const feedback = this.feedbackFor(pr, minutes, early);
    this.body.innerHTML = `
      <div class="pr-end">
        <div class="pr-end-kanji" lang="ja">円</div>
        <div class="pr-end-line">вы сидели ${minutesPhrase(minutes)}</div>
        <div class="pr-end-sub">${early ? 'встать раньше — тоже практика' : 'чаша конца. звук растаял сам'}</div>
        <div class="pr-end-feedback">${feedback}</div>
        <div class="pr-actions">
          <div class="pr-btn" data-again>сесть ещё на ${this.lastMinutes} мин</div>
          <div class="pr-btn ghost" data-menu>к списку практик</div>
          <div class="pr-btn ghost" data-garden>вернуться в сад</div>
        </div>
      </div>`;
    this.body.querySelector('[data-again]')!.addEventListener('click', () => this.startReady(again, this.lastMinutes));
    this.body.querySelector('[data-menu]')!.addEventListener('click', () => this.renderMenu());
    this.body.querySelector('[data-garden]')!.addEventListener('click', () => this.close());
  }

  private feedbackFor(pr: Practice | null, minutes: number, early: boolean): string {
    if (!pr) return '';
    if (early && minutes === 1) return 'Одна минута — уже остановка. В следующий раз попробуй две.';
    if (pr.id === 'count') return `Счёт — опора, а не экзамен. Если сбились, вы заметили — значит, внимание работало.`;
    if (pr.id === 'three') return 'Три вдоха можно делать посреди дела — перед письмом, звонком, чаем.';
    if (pr.id === 'walk') return 'Медленный шаг — та же тишина, только на ногах. Попробуй в коридоре.';
    if (pr.id === 'listen') return 'Звуки сами приходят и уходят. Тишина между — тоже звук.';
    if (pr.id === 'kindness') return 'Доброта — не награда за хорошую медитацию. Она и есть медитация.';
    return 'Ничего не происходит — и это хорошо. Спина держалась сама.';
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
    if (this.readyTimer) {
      window.clearInterval(this.readyTimer);
      this.readyTimer = 0;
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
      this.hooks.bowl(0.9);
      this.endTimer = window.setTimeout(() => this.hooks.bowl(0.7), 1700) as unknown as number;
      this.endTimer = window.setTimeout(() => this.finish(s.minutesSat(), false), 3600) as unknown as number;
      this.raf = 0;
      return;
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private onEvent(e: SessionEvent): void {
    const pr = this.lastPractice;
    switch (e.type) {
      case 'start':
        this.hooks.bowl(0.9);
        if (this.guideEl && pr) this.guideEl.textContent = pr.steps[0];
        break;
      case 'breath':
        this.hooks.breath(e.phase, e.seconds);
        if (this.breathLabel) {
          const label = e.phase === 'in' ? `вдох ${e.seconds}с` : `выдох ${e.seconds}с`;
          this.breathLabel.textContent = label;
          this.breathLabel.className = `pr-breath ${e.phase}`;
        }
        // Обновляем гайд по шагам дыхания
        if (this.guideEl && pr && pr.breath) {
          if (e.phase === 'in') {
            const idx = Math.min(pr.steps.length - 1, Math.floor(this.session!.view.cycles / 2));
            this.guideEl.textContent = pr.steps[idx] ?? pr.steps[0];
          }
        }
        break;
      case 'han':
        this.hooks.han(0.8);
        if (this.guideEl) this.guideEl.textContent = 'хан — полпути. заметь, где ты сейчас';
        break;
      case 'line':
        this.setLine(e.text);
        break;
      case 'count':
        this.setLine(`вдох — ${NUM_WORDS[e.n] ?? e.n}`);
        if (this.countEl) {
          this.countEl.textContent = `${NUM_WORDS[e.n] ?? e.n}`;
          this.countEl.className = 'pr-count show';
          window.setTimeout(() => {
            if (this.countEl) this.countEl.className = 'pr-count';
          }, 1200);
        }
        this.updateDots();
        break;
      case 'close':
        this.setLine('время вышло. досидите выдох');
        if (this.guideEl) this.guideEl.textContent = 'время вышло — досидите выдох и вставайте когда готовы';
        if (this.breathLabel) this.breathLabel.textContent = '';
        break;
    }
  }

  private setLine(text: string): void {
    const el = this.body.querySelector('.pr-line');
    if (el) el.textContent = text;
  }

  private updateMeta(): void {
    const s = this.session;
    const el = this.body.querySelector<HTMLElement>('[data-meta]');
    if (!s || !el) return;
    const modeLabel = s.view.count ? `счёт ${NUM_WORDS[s.view.count] ?? s.view.count}` : s.practice.name.toLowerCase();
    el.textContent = `осталось ${timeLeft(s.view.total - s.view.elapsed)} · ${modeLabel}`;
  }

  private updateDots(): void {
    const s = this.session;
    const dots = this.body.querySelector<HTMLElement>('[data-dots]');
    if (!s || !dots) return;
    const pr = s.practice;
    if (pr.mode === 'three') {
      const n = Math.min(3, s.view.cycles);
      dots.innerHTML = Array.from({ length: 3 }, (_, i) => `<span class="${i < n ? 'on' : ''}">●</span>`).join('');
    } else if (pr.mode === 'count') {
      const c = s.view.count;
      dots.innerHTML = Array.from({ length: 10 }, (_, i) => `<span class="${i + 1 <= c ? 'on' : ''}">${i + 1}</span>`).join('');
    } else {
      dots.innerHTML = '';
    }
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

    const left = 1 - Math.min(1, s.view.elapsed / s.view.total);
    g.strokeStyle = `rgba(${ink},0.22)`;
    g.lineWidth = 2.2 * dpr;
    g.beginPath();
    g.arc(cx, cy, R * 1.18, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2);
    g.stroke();

    g.strokeStyle = `rgba(${ink},0.10)`;
    g.lineWidth = 1 * dpr;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.stroke();

    const v = s.view;
    const ease = (t: number): number => t * t * (3 - 2 * t);
    const breathK = v.breathPhase === 'in' ? ease(v.breathT) : 1 - ease(v.breathT);

    if (mode === 'listen') {
      for (let i = 0; i < 3; i++) {
        const t = (now / 5200 + i / 3) % 1;
        g.strokeStyle = `rgba(${ink},${0.32 * (1 - t)})`;
        g.lineWidth = 1.8 * dpr;
        g.beginPath();
        g.arc(cx, cy, R * (0.2 + t * 0.95), 0, Math.PI * 2);
        g.stroke();
      }
      g.fillStyle = `rgba(${ink},0.55)`;
      g.font = `${Math.round(R * 0.18)}px 'Cormorant Garamond', serif`;
      g.textAlign = 'center';
      g.fillText('слушай', cx, cy);
    } else if (mode === 'walk') {
      const steps = Math.min(60, v.cycles * 2 + (v.breathPhase === 'out' ? 1 : 0));
      g.lineCap = 'round';
      for (let i = 0; i <= steps; i++) {
        const a = -Math.PI / 2 + (i / 60) * Math.PI * 2;
        const x = cx + Math.cos(a) * R * 0.9;
        const y = cy + Math.sin(a) * R * 0.9;
        g.fillStyle = `rgba(${ink},${i === steps ? 0.78 : 0.26})`;
        g.beginPath();
        g.ellipse(x, y, 5.2 * dpr, 3.4 * dpr, a, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = `rgba(${ink},0.7)`;
      g.font = `${Math.round(R * 0.16)}px sans-serif`;
      g.textAlign = 'center';
      g.fillText(v.breathPhase === 'in' ? 'вдох — шаг' : 'выдох — стопа на земле', cx, cy + R * 0.62);
    } else if (mode === 'sit' || mode === 'koan') {
      this.ensoGuide(g, cx, cy, R, ink);
      const slow = 0.5 + 0.5 * Math.sin(now / 4600);
      g.fillStyle = `rgba(${ink},0.52)`;
      g.beginPath();
      g.arc(cx, cy, R * (0.06 + slow * 0.04), 0, Math.PI * 2);
      g.fill();
      if (mode === 'koan') {
        g.fillStyle = `rgba(${ink},0.64)`;
        g.font = `italic ${Math.round(R * 0.16)}px 'Cormorant Garamond', serif`;
        g.textAlign = 'center';
        g.fillText(s.practice.lines[3] ?? '', cx, cy + R * 0.5);
      } else {
        g.fillStyle = `rgba(${ink},0.42)`;
        g.font = `${Math.round(R * 0.13)}px sans-serif`;
        g.textAlign = 'center';
        g.fillText('ничего не делай — просто сиди', cx, cy + R * 0.48);
      }
    } else if (mode === 'kindness') {
      const r = R * (0.62 + 0.28 * breathK);
      g.strokeStyle = `rgba(${ink},0.32)`;
      g.lineWidth = R * 0.06;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = `rgba(${ink},0.72)`;
      g.font = `italic ${Math.round(R * 0.16)}px 'Cormorant Garamond', serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const texts = ['пусть у меня', 'пусть у тебя', 'пусть у всех'];
      const idx = Math.min(2, Math.floor(v.cycles / 3) % 3);
      g.fillText(texts[idx] + ' будет покой', cx, cy);
      g.textBaseline = 'alphabetic';
      g.font = `${Math.round(R * 0.12)}px sans-serif`;
      g.fillStyle = `rgba(${ink},0.45)`;
      g.fillText(v.breathPhase === 'in' ? 'вдох' : 'выдох — пожелание', cx, cy + R * 0.42);
    } else {
      const r = R * (0.60 + 0.32 * breathK);
      g.strokeStyle = `rgba(${ink},${v.breathPhase === 'in' ? 0.62 : 0.42})`;
      g.lineWidth = R * 0.05;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = `rgba(${ink},0.13)`;
      g.lineWidth = R * 0.13;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();

      if (mode === 'count' && v.count > 0) {
        g.fillStyle = `rgba(${ink},0.78)`;
        g.font = `${Math.round(R * 0.42)}px 'Cormorant Garamond', serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(NUM_WORDS[v.count] ?? String(v.count), cx, cy);
        g.textBaseline = 'alphabetic';
        g.font = `${Math.round(R * 0.12)}px sans-serif`;
        g.fillStyle = `rgba(${ink},0.48)`;
        g.fillText(v.breathPhase === 'in' ? 'вдох — считай' : 'выдох — отпускай', cx, cy + R * 0.42);
      } else if (mode === 'three') {
        const n = Math.min(3, v.cycles);
        g.fillStyle = `rgba(${ink},0.72)`;
        g.font = `${Math.round(R * 0.32)}px 'Cormorant Garamond', serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(`${n} / 3`, cx, cy);
        g.textBaseline = 'alphabetic';
      } else {
        g.fillStyle = `rgba(${ink},0.52)`;
        g.font = `${Math.round(R * 0.14)}px sans-serif`;
        g.textAlign = 'center';
        g.fillText(v.breathPhase === 'in' ? `вдох ${s.practice.breath?.inhale ?? ''}с` : `выдох ${s.practice.breath?.exhale ?? ''}с`, cx, cy);
      }
    }
  }

  private ensoGuide(g: CanvasRenderingContext2D, cx: number, cy: number, R: number, ink: string): void {
    g.save();
    g.lineCap = 'round';
    const seg = 60;
    for (let i = 1; i < seg; i++) {
      const a0 = -Math.PI * 0.6 + ((i - 1) / seg) * Math.PI * 2 * 0.9;
      const a1 = -Math.PI * 0.6 + (i / seg) * Math.PI * 2 * 0.9;
      g.strokeStyle = `rgba(${ink},${0.32 - (i / seg) * 0.14})`;
      g.lineWidth = R * (0.032 + 0.022 * Math.sin((i / seg) * Math.PI));
      g.beginPath();
      g.moveTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R);
      g.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R);
      g.stroke();
    }
    g.restore();
  }
}
