/**
 * main.js — точка входа оболочки игры (Сессия 4).
 * Собирает каркас + поднимает живое состояние (сейв или новая жизнь).
 */

import { GAME_TITLE, GAME_VERSION, SESSION_NUMBER } from './core/config.js';
import { initSession, refreshUi } from './ui/session.js';
import { initTabs } from './ui/tabs.js';

function init() {
  document.title = `${GAME_TITLE} — симулятор бродяги в Петербурге`;

  const versionBadge = document.getElementById('versionBadge');
  if (versionBadge) {
    versionBadge.textContent = `v${GAME_VERSION} · сессия ${SESSION_NUMBER}`;
  }

  initSession();
  initTabs();      // вкладки сами дорисуют активный экран
  refreshUi();     // статы, часы, (при загрузке с «трупом» — экран конца жизни)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
