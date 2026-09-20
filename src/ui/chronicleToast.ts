/**
 * Всплывающее уведомление летописи: картинка + текст на 20 секунд.
 * При клике переносит камеру к месту события, иначе плавно растворяется.
 * Не чаще одного показа за три реальные минуты; в ожидании хранится только последнее событие.
 */

import './chronicleToast.css';
import { chronicleText } from '../world/chronicle';
import { CHRONICLE_IMAGES } from './chronicleArt';
import type { ChronicleToastNote } from '../world/world';

interface Queued {
  id: string;
  x: number;
  y: number;
}

export const CHRONICLE_TOAST_INTERVAL = 180_000;
const LAST_SHOWN_KEY = 'usadba:chronicle-toast-shown';

export class ChronicleToast {
  private root: HTMLElement;
  private pending: Queued | null = null;
  private paused = false;
  private nextAllowed = 0;
  private cooldownTimer = 0;
  private onVisibility = () => {
    if (!document.hidden) this.showNext();
  };
  private currentEl: HTMLElement | null = null;
  private timer: number = 0;
  private fadeTimer: number = 0;

  constructor(
    parent: HTMLElement,
    private onTeleport: (x: number, y: number) => void,
  ) {
    const root = document.createElement('div');
    root.className = 'chronicle-toast-stack';
    parent.appendChild(root);
    this.root = root;
    // UI preference only, not the accelerated garden clock or the world's save.
    try {
      const raw = window.sessionStorage.getItem(LAST_SHOWN_KEY);
      if (raw !== null) {
        const last = Number(raw),
          age = Date.now() - last;
        if (Number.isFinite(last) && last > 0)
          this.nextAllowed = performance.now() + Math.max(0, CHRONICLE_TOAST_INTERVAL - Math.max(0, age));
      }
    } catch {
      /* Private mode/storage failure must not disable the garden. */
    }
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  push(note: ChronicleToastNote): void {
    if (!chronicleText(note.id)) return;
    this.pending = { id: note.id, x: note.x, y: note.y };
    this.showNext();
  }

  /** Delay new popups while a load-time notice needs the same small-screen space. */
  setPaused(paused: boolean): void {
    this.paused = paused;
    this.showNext();
  }

  /** Switching gardens drops old destinations, but never bypasses the quiet interval. */
  clear(): void {
    window.clearTimeout(this.timer);
    window.clearTimeout(this.fadeTimer);
    window.clearTimeout(this.cooldownTimer);
    this.timer = this.fadeTimer = this.cooldownTimer = 0;
    this.pending = null;
    this.currentEl?.remove();
    this.currentEl = null;
  }
  dispose(): void {
    this.clear();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.root.remove();
  }
  private showNext(): void {
    window.clearTimeout(this.cooldownTimer);
    this.cooldownTimer = 0;
    if (this.currentEl || !this.pending || document.hidden || this.paused) return;
    const remaining = this.nextAllowed - performance.now();
    if (remaining > 0) {
      this.cooldownTimer = window.setTimeout(() => this.showNext(), remaining);
      return;
    }
    const item = this.pending;
    this.pending = null;
    const info = chronicleText(item.id);
    if (!info) return;
    const imgSrc = CHRONICLE_IMAGES[item.id];

    const el = document.createElement('div');
    el.className = 'chronicle-toast paper';
    el.innerHTML = `
      <div class="ct-img-wrap">${imgSrc ? `<img class="ct-img" src="${imgSrc}" alt="" loading="eager">` : ''}</div>
      <div class="ct-body">
        <div class="ct-kanji" lang="ja">${info.kanji}</div>
        <div class="ct-text">${info.text}</div>
        <div class="ct-hint">нажмите, чтобы увидеть</div>
      </div>
      <div class="ct-close">✕</div>
      <div class="ct-progress"><i></i></div>
    `;

    // клик — телепорт и закрыть
    const go = () => {
      if (el !== this.currentEl || el.classList.contains('out')) return;
      this.onTeleport(item.x, item.y);
      this.dismiss(el);
    };
    el.addEventListener('click', go);
    // Крестик закрывает без перемещения камеры.
    const closeBtn = el.querySelector('.ct-close') as HTMLElement;
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismiss(el);
    });

    this.root.appendChild(el);
    // триггер появления
    requestAnimationFrame(() => {
      if (el === this.currentEl) el.classList.add('show');
    });

    this.currentEl = el;
    this.nextAllowed = performance.now() + CHRONICLE_TOAST_INTERVAL;
    try {
      window.sessionStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
    } catch {
      /* optional UI state */
    }

    // прогресс бар 20 сек
    const progress = el.querySelector('.ct-progress i') as HTMLElement;
    progress.style.transition = 'none';
    progress.style.width = '100%';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        progress.style.transition = 'width 20s linear';
        progress.style.width = '0%';
      });
    });

    // авто-закрытие через 20 сек
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.dismiss(el);
    }, 20000);
  }

  private dismiss(el: HTMLElement): void {
    if (el !== this.currentEl || el.classList.contains('out')) return;
    if (this.fadeTimer) window.clearTimeout(this.fadeTimer);
    window.clearTimeout(this.timer);
    el.classList.remove('show');
    el.classList.add('out');
    this.fadeTimer = window.setTimeout(() => {
      el.remove();
      this.currentEl = null;
      this.showNext();
    }, 700);
  }
}
