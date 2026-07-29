/**
 * Точка входа страницы-заглушки (Сессия 1).
 * Игровой логики здесь нет: только презентационные анимации,
 * чтобы проверить, что ES-модули и рендер работают в браузере.
 */

import { GAME_TITLE, GAME_VERSION, SESSION_NUMBER } from './core/config.js';

/** Ответы-заглушки на попытку «пошарить в баке» до появления игровой логики. */
const DIG_PLACEHOLDER_LINES = [
  '🗑️ Пока пусто. Баки заработают с сессии 5.',
  '🦝 Енот туда ещё не смотрел. Разработка идёт.',
  '🌧️ Над городом дождь, над кодом — агент. Ждите MLP.',
  '🧤 Перчатки готовы. Мусор складируется в GDD.md.',
];

/**
 * Инициализация страницы после загрузки DOM.
 */
function init() {
  document.title = `${GAME_TITLE} — симулятор бродяги в Петербурге`;

  const versionBadge = document.getElementById('versionBadge');
  if (versionBadge) {
    versionBadge.textContent = `v${GAME_VERSION} · сессия ${SESSION_NUMBER}`;
  }

  const emoji = document.getElementById('heroEmoji');
  const hint = document.getElementById('digHint');
  const button = document.getElementById('digButton');

  if (button && emoji && hint) {
    let clickCount = 0;
    button.addEventListener('click', () => {
      emoji.classList.remove('hero__emoji--shake');
      // Форсируем перезапуск CSS-анимации.
      void emoji.offsetWidth;
      emoji.classList.add('hero__emoji--shake');
      hint.textContent = DIG_PLACEHOLDER_LINES[clickCount % DIG_PLACEHOLDER_LINES.length];
      clickCount += 1;
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
