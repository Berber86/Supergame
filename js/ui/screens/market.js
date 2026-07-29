/**
 * screens/market.js — вкладка «Сбыт»: точки продажи и эксперты.
 * Коэффициенты/условия — из js/data (buyers.js, experts.js), не из удачи.
 */

import { BUYERS } from '../../data/buyers.js';
import { EXPERTS } from '../../data/experts.js';
import { CATEGORY_ICONS, EXPERT_CATEGORY_ICONS } from '../icons.js';
import { percentLabel, rublesLabel } from '../format.js';
import { showToast } from '../toast.js';

function acceptsChips(buyer) {
  if (buyer.accepts === 'all') return '<span class="tag tag--accent">берёт всё подряд</span>';
  return buyer.accepts.map((cat) => {
    const c = CATEGORY_ICONS[cat];
    return `<span class="tag">${c.emoji} ${c.label}</span>`;
  }).join('');
}

function priceLine(buyer) {
  if (typeof buyer.priceMult === 'number') {
    if (buyer.priceMult === 1) return 'платит честные 100% цены';
    return `платит ${percentLabel(buyer.priceMult)} цены`;
  }
  return `платит ${percentLabel(buyer.priceMult.min)}–${percentLabel(buyer.priceMult.max)} цены`;
}

function conditionTags(buyer) {
  const tags = [];
  tags.push(buyer.instant ? '<span class="tag tag--green">мгновенно</span>' : '<span class="tag">съедает полдня</span>');
  if (buyer.tradeBonus) tags.push(`<span class="tag">+торг до ${percentLabel(buyer.tradeBonus)}</span>`);
  if (buyer.requires?.minCleanliness) tags.push(`<span class="tag tag--danger">🧼 от ${buyer.requires.minCleanliness}</span>`);
  if (buyer.scam) tags.push(`<span class="tag tag--danger">кидок ${percentLabel(buyer.scam.baseChance)}</span>`);
  if (buyer.acceptsUnidentified) tags.push('<span class="tag tag--accent">берёт ❓</span>');
  return tags.join('');
}

function buyerCard(buyer) {
  return `
    <div class="card">
      <h3 class="card__title"><span class="emoji">${buyer.emoji}</span>${buyer.name}</h3>
      <p class="card__desc">${buyer.desc}</p>
      <div class="card__meta"><span class="tag tag--accent">${priceLine(buyer)}</span>${conditionTags(buyer)}</div>
      <div class="card__meta">${acceptsChips(buyer)}</div>
      <button class="btn btn--ghost btn--wide" data-session="7">💰 Продать</button>
    </div>
  `;
}

function expertCard(expert) {
  const fee = expert.fee.type === 'percent'
    ? `${percentLabel(expert.fee.value)} от сделки, мин ${rublesLabel(expert.fee.min)}`
    : rublesLabel(expert.fee.value);
  const specs = expert.specialties.map((s) => {
    const c = EXPERT_CATEGORY_ICONS[s];
    return `<span class="tag">${c.emoji} ${c.label}</span>`;
  }).join('');

  return `
    <div class="card">
      <h3 class="card__title"><span class="emoji">${expert.emoji}</span>${expert.name}</h3>
      <p class="card__desc">${expert.desc}</p>
      <p class="card__desc"><em>${expert.quote}</em></p>
      <div class="card__meta">${specs}<span class="tag tag--accent">${fee}</span></div>
      <button class="btn btn--ghost btn--wide" data-session="6">🔎 Опознать</button>
    </div>
  `;
}

export function renderMarket(root) {
  root.innerHTML = `
    <p class="section-title">Кому сдать добро</p>
    <div class="grid grid--wide">${BUYERS.map(buyerCard).join('')}</div>
    <p class="section-title">Кто оценит ❓ (идентификация)</p>
    <div class="grid grid--wide">${EXPERTS.map(expertCard).join('')}</div>
  `;

  root.querySelectorAll('[data-session]').forEach((btn) => {
    btn.addEventListener('click', () => showToast(`🚧 Оживёт в сессии ${btn.dataset.session} — данные уже готовы, логика в пути`));
  });
}
