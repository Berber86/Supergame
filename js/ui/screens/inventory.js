/**
 * screens/inventory.js — вкладка «Инвентарь». Сессия 4: ЖИВАЯ ноша
 * (пока пустая — баки откроются в сессии 5, но экран уже честный).
 */

import { EXPERTS } from '../../data/experts.js';
import { CARRY } from '../../data/balance.js';
import { findItem } from '../../core/lookups.js';
import { getState } from '../session.js';
import { kgLabel, rublesLabel, percentLabel } from '../format.js';
import { showToast } from '../toast.js';

/** Вес стопки (у неопознанного веса нет в данных — условный 0.5 кг). */
const UNIDENTIFIED_WEIGHT_KG = 0.5;

function entryWeightKg(entry) {
  const item = findItem(entry.itemId);
  return (item?.weight ?? UNIDENTIFIED_WEIGHT_KG) * entry.qty;
}

function inventoryUsedKg(state) {
  return state.inventory.reduce((sum, e) => sum + entryWeightKg(e), 0);
}

function capacityKg(state) {
  return CARRY.baseKg + CARRY.staminaBonusKg * state.skills.stamina.level;
}

function capacityCard(state) {
  const used = inventoryUsedKg(state);
  const max = capacityKg(state);
  const pct = Math.min(100, (used / max) * 100);
  return `
    <div class="card">
      <h2 class="card__title"><span class="emoji">🎒</span>Пакет-майка</h2>
      <p class="card__desc">Ноша: ${kgLabel(used)} из ${kgLabel(max)}.
        Рюкзак и тележка выносливее — снаряжение придёт в сессии 9.</p>
      <div class="progress"><div class="progress__fill" style="width: ${pct}%"></div></div>
    </div>
  `;
}

function itemCard(entry) {
  const item = findItem(entry.itemId);
  const qty = entry.qty > 1 ? `<span class="item__qty">×${entry.qty}</span>` : '';

  let valueHtml;
  if (item.kind === 'unidentified' && !entry.identified) {
    valueHtml = `<span class="item__value item__value--unknown">❓ не опознано</span>`;
  } else if (item.kind === 'food') {
    valueHtml = `<span class="item__value">+${item.satiety} 🍞</span>`;
  } else {
    const value = entry.identified && entry.trueValue != null ? entry.trueValue : item.value;
    valueHtml = `<span class="item__value">${rublesLabel(value)}</span>`;
  }

  return `
    <div class="card item" title="${item.desc}">
      ${qty}
      <div class="item__emoji">${item.emoji}</div>
      <div class="item__name">${item.name}</div>
      ${valueHtml}
    </div>
  `;
}

function itemsSection(state) {
  if (state.inventory.length === 0) {
    return `
      <div class="card">
        <h3 class="card__title"><span class="emoji">🕸️</span>Пустая ноша</h3>
        <p class="card__desc">
          Пока тут только паутина и надежды. Баки откроются в сессии 5 —
          приходи с пустым пакетом и тёплым нюхом.
        </p>
      </div>
    `;
  }
  return `
    <p class="section-title">Ноша (${state.inventory.length} видов)</p>
    <div class="grid">${state.inventory.map(itemCard).join('')}</div>
  `;
}

function identifyHintCard() {
  const experts = EXPERTS.map((e) => {
    const fee = e.fee.type === 'percent'
      ? `${percentLabel(e.fee.value)} от сделки, мин ${rublesLabel(e.fee.min)}`
      : rublesLabel(e.fee.value);
    return `<span class="tag">${e.emoji} ${e.name}: ${fee}</span>`;
  }).join('');

  return `
    <div class="card card--hi">
      <h3 class="card__title"><span class="emoji">❓</span>Что делать с неопознанным?</h3>
      <p class="card__desc">
        Прокачивай 👁️ Оценку (диапазон цены) или неси к эксперту (точная цена, за деньги).
        Можно и вслепую — 🕶️ Тень у гаражей берёт всё, но считает в свою пользу.
      </p>
      <div class="card__meta">${experts}</div>
      <button class="btn btn--wide" data-session="6">🔎 Опознать находку</button>
    </div>
  `;
}

export function renderInventory(root) {
  const state = getState();
  if (!state) return;

  root.innerHTML = `${capacityCard(state)}${itemsSection(state)}${identifyHintCard()}`;

  root.querySelectorAll('[data-session]').forEach((btn) => {
    btn.addEventListener('click', () => showToast(`🚧 Оживёт в сессии ${btn.dataset.session} — данные уже готовы, логика в пути`));
  });
}
