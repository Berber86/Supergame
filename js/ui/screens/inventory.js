/**
 * screens/inventory.js — вкладка «Инвентарь». Сессия 5: живая ноша из баков:
 * вес и ёмкость считает ядро (core/inventory.js), еду можно съесть на месте.
 * Идентификация неопознанного — сессия 6 (кнопка-плейсхолдер внизу).
 */

import { EXPERTS } from '../../data/experts.js';
import { findItem } from '../../core/lookups.js';
import { capacityKg, inventoryUsedKg } from '../../core/inventory.js';
import { eat } from '../../core/actions.js';
import { getState, applyAction } from '../session.js';
import { kgLabel, rublesLabel, percentLabel } from '../format.js';
import { showToast } from '../toast.js';

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

  const eatBtn = item.kind === 'food'
    ? `<button class="btn btn--ghost btn--mini" data-eat="${item.id}" ${item.healthRisk ? `title="риск отравления ${percentLabel(item.healthRisk)}"` : ''}>🍽️ Съесть</button>`
    : '';

  return `
    <div class="card item" title="${item.desc}">
      ${qty}
      <div class="item__emoji">${item.emoji}</div>
      <div class="item__name">${item.name}</div>
      ${valueHtml}
      ${eatBtn}
    </div>
  `;
}

function itemsSection(state) {
  if (state.inventory.length === 0) {
    return `
      <div class="card">
        <h3 class="card__title"><span class="emoji">🕸️</span>Пустая ноша</h3>
        <p class="card__desc">
          Пока тут только паутина и надежды. Баки открыты во вкладке «🗺️ Город» —
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

  root.querySelectorAll('[data-eat]').forEach((btn) => {
    btn.addEventListener('click', () => applyAction((s) => eat(s, btn.dataset.eat)));
  });

  root.querySelectorAll('[data-session]').forEach((btn) => {
    btn.addEventListener('click', () => showToast(`🚧 Оживёт в сессии ${btn.dataset.session} — данные уже готовы, логика в пути`));
  });
}
