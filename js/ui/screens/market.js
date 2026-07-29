/**
 * screens/market.js — вкладка «Сбыт». Сессия 5.5: покупатели и эксперты —
 * компактные строки, лор-справки собраны в один <details> внизу.
 * Кнопки — плейсхолдеры до сессий 6–7.
 */

import { BUYERS } from '../../data/buyers.js';
import { EXPERTS } from '../../data/experts.js';
import { CATEGORY_ICONS, EXPERT_CATEGORY_ICONS } from '../icons.js';
import { percentLabel, rublesLabel } from '../format.js';
import { showToast } from '../toast.js';

function priceLine(buyer) {
  if (typeof buyer.priceMult === 'number') {
    if (buyer.priceMult === 1) return 'честные 100%';
    return `${percentLabel(buyer.priceMult)} цены`;
  }
  return `${percentLabel(buyer.priceMult.min)}–${percentLabel(buyer.priceMult.max)} цены`;
}

function buyerSubline(buyer) {
  const bits = [priceLine(buyer)];
  bits.push(buyer.instant ? 'мгновенно' : 'съедает полдня');
  if (buyer.scam) bits.push(`🕶️ кидок ${percentLabel(buyer.scam.baseChance)}`);
  if (buyer.tradeBonus) bits.push(`+торг до ${percentLabel(buyer.tradeBonus)}`);
  if (buyer.requires?.minCleanliness) bits.push(`🧼 от ${buyer.requires.minCleanliness}`);
  return bits.join(' · ');
}

function acceptsLine(buyer) {
  if (buyer.accepts === 'all') return 'берёт всё';
  return buyer.accepts.map((cat) => CATEGORY_ICONS[cat]?.emoji ?? cat).join(' ');
}

function buyerRow(buyer) {
  return `
    <div class="row">
      <span class="row__icon">${buyer.emoji}</span>
      <div class="row__main">
        <div class="row__name">${buyer.name}</div>
        <div class="row__sub">${acceptsLine(buyer)} · ${buyerSubline(buyer)}</div>
      </div>
      <button class="btn btn--ghost" data-session="7">💰 Продать</button>
    </div>
  `;
}

function expertRow(expert) {
  const fee = expert.fee.type === 'percent'
    ? `${percentLabel(expert.fee.value)}, мин ${rublesLabel(expert.fee.min)}`
    : rublesLabel(expert.fee.value);
  const specs = expert.specialties.map((s) => EXPERT_CATEGORY_ICONS[s]?.emoji ?? s).join(' ');
  return `
    <div class="row">
      <span class="row__icon">${expert.emoji}</span>
      <div class="row__main">
        <div class="row__name">${expert.name}</div>
        <div class="row__sub">${specs} · ${fee}</div>
      </div>
      <button class="btn btn--ghost" data-session="6">🔎 Опознать</button>
    </div>
  `;
}

function loreDetails() {
  const buyerLore = BUYERS.map((b) => `<p class="info__body"><strong>${b.emoji} ${b.name}</strong> — ${b.desc}</p>`).join('');
  const expertLore = EXPERTS.map((e) => `<p class="info__body"><strong>${e.emoji} ${e.name}</strong> — ${e.desc} <em>«${e.quote}»</em></p>`).join('');
  return `
    <div class="card">
      <details class="info info--flat"><summary>кто все эти люди</summary>
        ${buyerLore}${expertLore}
      </details>
    </div>
  `;
}

export function renderMarket(root) {
  root.innerHTML = `
    <p class="section-title">Кому сдать добро</p>
    <div class="rows">${BUYERS.map(buyerRow).join('')}</div>
    <p class="section-title">Кто оценит ❓ (сессия 6)</p>
    <div class="rows">${EXPERTS.map(expertRow).join('')}</div>
    ${loreDetails()}
  `;

  root.querySelectorAll('[data-session]').forEach((btn) => {
    btn.addEventListener('click', () => showToast(`🚧 Оживёт в сессии ${btn.dataset.session}`));
  });
}
