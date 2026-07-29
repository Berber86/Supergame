/**
 * eventModal.js — модальная карточка события дня (сессия 8).
 * Выбор человека: события ставят игру НА ПАУЗУ до ответа игрока.
 * Логики тут нет: доступность вариантов считает core/events.js, последствия
 * применяет applyEventChoice через session.applyAction.
 */

import { findEvent, choiceAvailability } from '../core/events.js';

function ensureOverlay() {
  let overlay = document.getElementById('eventOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'eventOverlay';
    overlay.className = 'event-overlay';
    document.body.appendChild(overlay);
  }
  return overlay;
}

/** Показать модалку по state.pendingEvent. onChoice(choiceId) — один ответ. */
export function showEventModal(state, onChoice) {
  const event = findEvent(state.pendingEvent?.eventId);
  if (!event) return;
  const overlay = ensureOverlay();

  const buttons = event.choices.map((choice) => {
    const { enabled, reason } = choiceAvailability(state, choice);
    const disabled = enabled ? '' : 'disabled';
    const title = reason ? `title="${reason}"` : '';
    return `<button class="btn event-card__choice" data-choice="${choice.id}" ${disabled} ${title}>${choice.text}</button>`;
  }).join('');

  overlay.innerHTML = `
    <div class="event-card">
      <div class="event-card__emoji">${event.emoji}</div>
      <h2 class="event-card__title">${event.title}</h2>
      <p class="event-card__text">${event.text}</p>
      <div class="event-card__choices">${buttons}</div>
    </div>
  `;
  overlay.classList.add('event-overlay--visible');
  overlay.querySelectorAll('[data-choice]').forEach((btn) => {
    btn.addEventListener('click', () => onChoice(btn.dataset.choice));
  });
}

export function hideEventModal() {
  const overlay = document.getElementById('eventOverlay');
  if (overlay) overlay.classList.remove('event-overlay--visible');
}
