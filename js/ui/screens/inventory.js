/**
 * screens/inventory.js — вкладка «Инвентарь»: ёмкость, стопки предметов,
 * подсказки по идентификации. Сессия 3: демо-стопки, кнопки-плейсхолдеры.
 */

import { EXPERTS } from '../../data/experts.js';
import { DEMO, findItem, inventoryUsedKg, stackWeightKg } from '../demo.js';
import { kgLabel, rublesLabel, percentLabel } from '../format.js';
import { showToast } from '../toast.js';

function capacityCard() {
  const used = inventoryUsedKg();
  const pct = Math.min(100, (used / DEMO.inventoryMaxKg) * 100);
  return `
    <div class="card">
      <h2 class="card__title"><span class="emoji">🎒</span>${DEMO.bagName}</h2>
      <p class="card__desc">Ноша: ${kgLabel(used)} из ${kgLabel(DEMO.inventoryMaxKg)}.
        Рюкзак и тележка выносливее — снаряжение придёт в сессии 9.</p>
      <div class="progress"><div class="progress__fill" style="width: ${pct}%"></div></div>
    </div>
  `;
}

function itemCard(entry) {
  const item = findItem(entry.itemId);
  const qty = entry.qty > 1 ? `<span class="item__qty">×${entry.qty}</span>` : '';

  let valueHtml;
  if (item.kind === 'unidentified') {
    valueHtml = `<span class="item__value item__value--unknown">❓ не опознано</span>`;
  } else if (item.kind === 'food') {
    valueHtml = `<span class="item__value">+${item.satiety} 🍞</span>`;
  } else {
    valueHtml = `<span class="item__value">${rublesLabel(item.value)}</span>`;
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

function itemsGrid() {
  return `
    <p class="section-title">Ноша (${DEMO.inventory.length} видов)</p>
    <div class="grid">${DEMO.inventory.map(itemCard).join('')}</div>
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
  root.innerHTML = `${capacityCard()}${itemsGrid()}${identifyHintCard()}`;

  root.querySelectorAll('[data-session]').forEach((btn) => {
    btn.addEventListener('click', () => showToast(`🚧 Оживёт в сессии ${btn.dataset.session} — данные уже готовы, логика в пути`));
  });
}
