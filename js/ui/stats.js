/**
 * stats.js — панель статов персонажа (шапка приложения).
 * Сессия 3: рендерит демо-снимок; в сессии 4 подключится к GameState.
 */

import { STAT_META } from './icons.js';
import { DEMO } from './demo.js';
import { rublesLabel } from './format.js';

const LOW_THRESHOLD = 25; // ниже — красная полоска, пора паниковать

export function renderStats() {
  const panel = document.getElementById('statsPanel');
  if (!panel) return;
  panel.innerHTML = '';

  for (const meta of STAT_META) {
    const isMoney = meta.kind === 'money';
    const value = isMoney ? DEMO.money : DEMO.stats[meta.key];

    const el = document.createElement('div');
    el.className = 'stat';
    if (isMoney) el.classList.add('stat--money');
    if (!isMoney && value < LOW_THRESHOLD) el.classList.add('stat--low');

    const valueText = isMoney ? rublesLabel(value) : Math.round(value);
    const barPct = isMoney ? Math.min(100, value / 10) : value; // деньги: условная шкала до 1000 ₽

    el.innerHTML = `
      <div class="stat__head">
        <span>${meta.emoji} ${meta.label}</span>
        <span class="stat__value">${valueText}</span>
      </div>
      <div class="stat__bar"><div class="stat__fill" style="width: ${Math.max(0, Math.min(100, barPct))}%"></div></div>
    `;
    panel.appendChild(el);
  }
}
