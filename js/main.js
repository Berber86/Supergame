/**
 * main.js — точка входа оболочки игры (Сессия 3).
 * Собирает каркас: шапку, панель статов, вкладки, футер.
 * Игровой логики всё ещё нет — она придёт в сессии 4 (js/core),
 * а пока UI показывает демо-снимок из js/ui/demo.js.
 */

import { GAME_TITLE, GAME_VERSION, SESSION_NUMBER } from './core/config.js';
import { DEMO, findWeather } from './ui/demo.js';
import { formatClock } from './ui/format.js';
import { renderStats } from './ui/stats.js';
import { initTabs } from './ui/tabs.js';

function init() {
  document.title = `${GAME_TITLE} — симулятор бродяги в Петербурге`;

  const versionBadge = document.getElementById('versionBadge');
  if (versionBadge) {
    versionBadge.textContent = `v${GAME_VERSION} · сессия ${SESSION_NUMBER}`;
  }

  const clockBadge = document.getElementById('clockBadge');
  if (clockBadge) {
    const w = findWeather(DEMO.weatherId);
    clockBadge.textContent = `⏰ День ${DEMO.day} · ${formatClock(DEMO.hour, DEMO.minute)} · ${w.emoji} ${w.name}`;
  }

  renderStats();
  initTabs();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
