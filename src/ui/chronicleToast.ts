/**
 * Всплывающее уведомление летописи: картинка + текст на 20 секунд.
 * При клике переносит камеру к месту события, иначе плавно растворяется.
 * Очередь — если несколько событий подряд, показываются по очереди.
 */

import './chronicleToast.css';
import { chronicleText } from '../world/chronicle';
import { CHRONICLE_IMAGES } from './chroniclePanel';
import { ChronicleToastNote } from '../world/world';

interface Queued {
  id: string;
  x: number;
  y: number;
}

export class ChronicleToast {
  private root: HTMLElement;
  private queue: Queued[] = [];
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
  }

  push(note: ChronicleToastNote): void {
    this.queue.push({ id: note.id, x: note.x, y: note.y });
    if (!this.currentEl) this.showNext();
  }

  private showNext(): void {
    if (this.queue.length === 0) {
      this.currentEl = null;
      return;
    }
    const item = this.queue.shift()!;
    const info = chronicleText(item.id);
    if (!info) {
      // нет текста — пропускаем
      this.showNext();
      return;
    }
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
      this.onTeleport(item.x, item.y);
      this.dismiss(el, true);
    };
    el.addEventListener('click', go);
    // крестик тоже закрывает, но без телепорта? делаем тоже телепорт? пусть закрывает без телепорта по крестику
    const closeBtn = el.querySelector('.ct-close') as HTMLElement;
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismiss(el, false);
    });

    this.root.appendChild(el);
    // триггер появления
    requestAnimationFrame(() => {
      el.classList.add('show');
    });

    this.currentEl = el;

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
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.dismiss(el, false);
    }, 20000);
  }

  private dismiss(el: HTMLElement, _teleported: boolean): void {
    if (this.fadeTimer) clearTimeout(this.fadeTimer);
    clearTimeout(this.timer);
    if (el !== this.currentEl) {
      el.remove();
      return;
    }
    el.classList.remove('show');
    el.classList.add('out');
    this.fadeTimer = window.setTimeout(() => {
      el.remove();
      this.currentEl = null;
      this.showNext();
    }, 700) as unknown as number;
  }
}
