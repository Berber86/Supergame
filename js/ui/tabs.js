/**
 * tabs.js — навигация по экранам-вкладкам (выбор человека в сессии 2).
 * Только переключение показа, никакой игровой логики.
 */

import { renderCity } from './screens/city.js';
import { renderInventory } from './screens/inventory.js';
import { renderMarket } from './screens/market.js';
import { renderCharacter } from './screens/character.js';

export const TABS = [
  { id: 'city',      emoji: '🗺️', label: 'Город',     render: renderCity },
  { id: 'inventory', emoji: '🎒', label: 'Инвентарь', render: renderInventory },
  { id: 'market',    emoji: '💰', label: 'Сбыт',      render: renderMarket },
  { id: 'character', emoji: '👤', label: 'Персонаж',  render: renderCharacter },
];

const DEFAULT_TAB = 'city';

export function initTabs() {
  const nav = document.getElementById('tabsNav');
  const screen = document.getElementById('screen');
  if (!nav || !screen) return;

  nav.innerHTML = '';

  const activate = (tabId) => {
    nav.querySelectorAll('.tab').forEach((btn) => {
      btn.classList.toggle('tab--active', btn.dataset.tabId === tabId);
    });
    const tab = TABS.find((t) => t.id === tabId) ?? TABS[0];
    screen.innerHTML = '';
    tab.render(screen);
  };

  for (const tab of TABS) {
    const btn = document.createElement('button');
    btn.className = 'tab';
    btn.dataset.tabId = tab.id;
    btn.textContent = `${tab.emoji} ${tab.label}`;
    btn.addEventListener('click', () => activate(tab.id));
    nav.appendChild(btn);
  }

  activate(DEFAULT_TAB);
}
