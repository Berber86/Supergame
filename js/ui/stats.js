/**
 * stats.js — HUD: панель статов и часы с погодой.
 * Сессия 4: читает живой GameState (передаётся параметром).
 */

import { STAT_META } from './icons.js';
import { rublesLabel, formatClock } from './format.js';
import { findWeather } from '../core/lookups.js';

const LOW_THRESHOLD = 25; // ниже — красная полоска, пора к столовой

export function renderStats(state) {
  const panel = document.getElementById('statsPanel');
  if (!panel || !state) return;
  panel.innerHTML = '';

  for (const meta of STAT_META) {
    const isMoney = meta.kind === 'money';
    const value = isMoney ? state.money : state.stats[meta.key];

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

export function renderClock(state) {
  const badge = document.getElementById('clockBadge');
  if (!badge || !state) return;
  const w = findWeather(state.weatherId);
  badge.textContent = `⏰ День ${state.day} · ${formatClock(state.hour)} · ${w.emoji} ${w.name}`;
}
