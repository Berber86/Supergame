/**
 * session.js — мост между игровым ядром (js/core) и интерфейсом.
 * Держит живой GameState, применяет действия, сохраняет, рисует HUD.
 * ВАЖНО: правил игры здесь нет — все правила в js/core.
 */

import { createGame, newLife } from '../core/state.js';
import { saveGame, loadGame } from '../core/persist.js';
import { applyEventChoice } from '../core/events.js';
import { renderStats, renderClock } from './stats.js';
import { rerenderActive } from './tabs.js';
import { showDeath, hideDeath } from './death.js';
import { showEventModal, hideEventModal } from './eventModal.js';
import { showToast } from './toast.js';

let state = null;

/** Инициализация при загрузке страницы: сейв или новая жизнь. */
export function initSession() {
  const loaded = loadGame();
  state = loaded ?? createGame();
  return state;
}

export function getState() {
  return state;
}

/** Перерисовать худ целиком (статы, часы, активная вкладка).
 *  Сессия 5.5: скролл НЕ сбрасываем после перерисовки — иначе каждый клик
 *  по баку прыгал экраном вверх (главная UX-жалоба человека). */
export function refreshUi({ keepScroll = true } = {}) {
  if (!state) return;
  const y = keepScroll ? window.scrollY : 0;
  renderStats(state);
  renderClock(state);
  rerenderActive();
  if (keepScroll) requestAnimationFrame(() => window.scrollTo(0, y));
  if (state.status === 'dead') {
    showDeath(state, startNewLife);
  } else {
    maybeShowEventModal();
  }
}

/** Событие дня ждёт ответа (сессия 8): пауза в модалке до выбора. */
function maybeShowEventModal() {
  if (!state || state.status !== 'alive' || !state.pendingEvent) return;
  showEventModal(state, (choiceId) => {
    hideEventModal();
    applyAction((s) => applyEventChoice(s, choiceId));
  });
}

/**
 * Применить действие (редьюсер из js/core), сохраниться, перерисоваться.
 * reducerFn: (state) => events[].
 */
export function applyAction(reducerFn) {
  if (!state || state.status !== 'alive') return [];
  const events = reducerFn(state) ?? [];
  saveGame(state);
  refreshUi();
  if (events.length) showToast(events.join(' · '));
  return events;
}

/** Начать новую жизнь после смерти (мягкий рогалик). */
export function startNewLife() {
  if (!state) return;
  const events = newLife(state, []);
  saveGame(state);
  hideDeath();
  refreshUi({ keepScroll: false }); // новая жизнь — с верха страницы
  if (events.length) showToast(events.join(' · '));
}
