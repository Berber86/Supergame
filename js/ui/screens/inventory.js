/**
 * screens/inventory.js — вкладка «Инвентарь». Сессия 6: ❓-предметы живые —
 * самооценка 👁️ (час, результат на карточке), эксперты 🧔/🧑‍🔧 (точная цена
 * за гонорар), продажа вслепую 🕶️ (азарт с кидком). Всё — кнопками на находке.
 */

import { EXPERTS } from '../../data/experts.js';
import { ACTIONS } from '../../data/balance.js';
import { findItem } from '../../core/lookups.js';
import { capacityKg, inventoryUsedKg } from '../../core/inventory.js';
import { assessSelf, expertAssess, blindSell } from '../../core/identify.js';
import { eat } from '../../core/actions.js';
import { getState, applyAction } from '../session.js';
import { kgLabel, rublesLabel, percentLabel, hoursLabel } from '../format.js';

function capacityCard(state) {
  const used = inventoryUsedKg(state);
  const max = capacityKg(state);
  const pct = Math.min(100, (used / max) * 100);
  return `
    <div class="card">
      <h2 class="card__title"><span class="emoji">🎒</span>${kgLabel(used)} / ${kgLabel(max)}</h2>
      <div class="progress"><div class="progress__fill" style="width: ${pct}%"></div></div>
    </div>
  `;
}

/** Подходящий эксперт под категорию ❓-предмета (Герыч — антиквариат, Слива — техника). */
function expertFor(item) {
  return EXPERTS.find((e) => e.specialties.includes(item.guess.expertCategory)) ?? null;
}

function expertFeeLabel(expert) {
  return expert.fee.type === 'percent'
    ? `от ${rublesLabel(expert.fee.min)}`
    : rublesLabel(expert.fee.value);
}

function expertMinMoney(expert) {
  return expert.fee.type === 'percent' ? expert.fee.min : expert.fee.value;
}

/** Ценовая строка карточки (что известно о цене). */
function valueLine(entry, item) {
  if (item.kind === 'unidentified') {
    if (entry.identified && entry.trueValue != null) {
      return `<span class="item__value">✅ ${rublesLabel(entry.trueValue)}</span>`;
    }
    if (entry.estimate) {
      return `<span class="item__value item__value--unknown">≈ ${entry.estimate.low}–${entry.estimate.high} ₽ · 👁️${entry.estimate.level}</span>`;
    }
    return `<span class="item__value item__value--unknown">❓ не опознано</span>`;
  }
  if (item.kind === 'food') return `<span class="item__value">+${item.satiety} 🍞</span>`;
  return `<span class="item__value">${rublesLabel(item.value)}</span>`;
}

/** Кнопки действий карточки (по виду предмета). */
function cardButtons(state, entry, item, idx) {
  if (item.kind === 'food') {
    return `<button class="btn btn--ghost btn--mini" data-eat="${item.id}" ${item.healthRisk ? `title="риск отравления ${percentLabel(item.healthRisk)}"` : ''}>🍽️ Съесть</button>`;
  }
  if (item.kind !== 'unidentified' || entry.identified) return '';

  const expert = expertFor(item);
  const expertBtn = expert && state.money >= expertMinMoney(expert)
    ? `<button class="btn btn--ghost btn--mini" data-expert="${idx}"
        title="${expert.name}: точная оценка за гонорар (${expert.fee.type === 'percent' ? `${percentLabel(expert.fee.value)} от цены, мин ${rublesLabel(expert.fee.min)}` : rublesLabel(expert.fee.value)}), ${hoursLabel(ACTIONS.expertVisit.hours)}">
        ${expert.emoji} ${expertFeeLabel(expert)}
      </button>`
    : expert
      ? `<button class="btn btn--ghost btn--mini" disabled title="${expert.name}: не по карману даже минимум (${rublesLabel(expertMinMoney(expert))})">${expert.emoji} ${expertFeeLabel(expert)}</button>`
      : '';

  return `
    <button class="btn btn--ghost btn--mini" data-assess="${idx}" title="Час разглядывания: диапазон цены по вашему 👁️-${state.skills.assess.level}">👁️ Оценить</button>
    ${expertBtn}
    <button class="btn btn--ghost btn--mini" data-blindsell="${idx}" title="Тень платит 110–130% скрытой цены, если не кинет (честность ${percentLabel(0.65 + state.skills.trade.level * 0.03)})">🕶️ Вслепую</button>
  `;
}

function itemCard(state, entry, idx) {
  const item = findItem(entry.itemId);
  const qty = entry.qty > 1 ? `<span class="item__qty">×${entry.qty}</span>` : '';

  return `
    <div class="card item" title="${item.desc}">
      ${qty}
      <div class="item__emoji">${item.emoji}</div>
      <div class="item__name">${item.name}</div>
      ${valueLine(entry, item)}
      ${cardButtons(state, entry, item, idx)}
    </div>
  `;
}

function itemsSection(state) {
  if (state.inventory.length === 0) {
    return `
      <div class="card">
        <p class="card__desc">🕸️ Пусто. Баки ждут во вкладке «🗺️ Город».</p>
      </div>
    `;
  }
  return `
    <div class="grid">${state.inventory.map((e, i) => itemCard(state, e, i)).join('')}</div>
  `;
}

function identifyHintCard(state) {
  const hasUnidentified = state.inventory.some((e) => e.trueValue != null && !e.identified);
  if (!hasUnidentified) return ''; // нечего опознавать — не шумим

  return `
    <div class="card">
      <p class="card__desc">
        ❓ <strong>Как узнать цену:</strong> 👁️ самому (час на предмет, диапазон сужается с навыком) ·
        🧔/🧑‍🔧 эксперту (точно, за гонорар) · 🕶️ Тени вслепую (дорого, если не кинет).
      </p>
    </div>
  `;
}

export function renderInventory(root) {
  const state = getState();
  if (!state) return;

  root.innerHTML = `${capacityCard(state)}${itemsSection(state)}${identifyHintCard(state)}`;

  root.querySelectorAll('[data-eat]').forEach((btn) => {
    btn.addEventListener('click', () => applyAction((s) => eat(s, btn.dataset.eat)));
  });
  root.querySelectorAll('[data-assess]').forEach((btn) => {
    btn.addEventListener('click', () => applyAction((s) => assessSelf(s, Number(btn.dataset.assess))));
  });
  root.querySelectorAll('[data-expert]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const s = getState();
      const entry = s.inventory[Number(btn.dataset.expert)];
      const expert = entry ? expertFor(findItem(entry.itemId)) : null;
      if (expert) applyAction((st) => expertAssess(st, Number(btn.dataset.expert), expert.id));
    });
  });
  root.querySelectorAll('[data-blindsell]').forEach((btn) => {
    btn.addEventListener('click', () => applyAction((s) => blindSell(s, Number(btn.dataset.blindsell))));
  });
}
