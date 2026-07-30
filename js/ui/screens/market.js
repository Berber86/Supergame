/**
 * screens/market.js — вкладка «Сбыт». Сессия 7: кнопки продажи ЖИВЫЕ.
 * Под каждой точкой — строки «что можно ей сдать прямо сейчас»: цена на
 * кнопке = цена сделки (считает та же saleOffer, что и редьюсер — не врёт).
 * У 🕶️ Тени честно показаны вилка 110–130% и шанс кидка. ❓ без опознания
 * для барахолки учим через «кота в мешке» (нужна твоя 👁️-оценка);
 * продажа ❓ вслепую Тени так и живёт на карточках в «🎒 Инвентаре».
 */

import { BUYERS } from '../../data/buyers.js';
import { EXPERTS } from '../../data/experts.js';
import { EQUIPMENT_SLOTS, EQUIPMENT_SHOP } from '../../data/equipment.js';
import { ACTIONS, SCAM } from '../../data/balance.js';
import { CATEGORY_ICONS, EXPERT_CATEGORY_ICONS } from '../icons.js';
import { percentLabel, rublesLabel, hoursLabel } from '../format.js';
import { showToast } from '../toast.js';
import { findItem } from '../../core/lookups.js';
import {
  sellableEntries, sellEntry, tradeMult, perekupHonestChance, passesGate,
} from '../../core/trade.js';
import { buyEquipment } from '../../core/equipment.js';
import { getState, applyAction } from '../session.js';

function priceLine(buyer) {
  if (typeof buyer.priceMult === 'number') {
    if (buyer.priceMult === 1) return 'честные 100%';
    return `${percentLabel(buyer.priceMult)} цены`;
  }
  return `${percentLabel(buyer.priceMult.min)}–${percentLabel(buyer.priceMult.max)} цены`;
}

function buyerSubline(buyer, state) {
  const bits = [priceLine(buyer)];
  bits.push(buyer.instant
    ? hoursLabel(ACTIONS.saleInstant.hours)
    : `${hoursLabel(ACTIONS.fleaMarket.hours)} · ${ACTIONS.fleaMarket.energy}⚡`);
  if (buyer.scam) {
    bits.push(`честность ${percentLabel(perekupHonestChance(state))} · ❓ вслепую — из инвентаря`);
  }
  if (buyer.tradeBonus) bits.push(`🤝${state.skills.trade.level} → ${percentLabel(tradeMult(state, buyer))}`);
  if (buyer.requires?.minCleanliness) bits.push(`🧼 от ${buyer.requires.minCleanliness}`);
  return bits.join(' · ');
}

function acceptsLine(buyer) {
  if (buyer.accepts === 'all') return 'берёт всё';
  return buyer.accepts.map((cat) => CATEGORY_ICONS[cat]?.emoji ?? cat).join(' ');
}

function buyerRow(buyer, state) {
  return `
    <div class="row">
      <span class="row__icon">${buyer.emoji}</span>
      <div class="row__main">
        <div class="row__name">${buyer.name}</div>
        <div class="row__sub">${acceptsLine(buyer)} · ${buyerSubline(buyer, state)}</div>
      </div>
    </div>
  `;
}

/** Кнопка продажи: цена = правде (у Тени — вилка и подсказка про кидок). */
function sellButton(state, buyer, entryIndex, offer) {
  if (!passesGate(state, buyer)) {
    return `<button class="btn btn--ghost btn--mini" disabled
      title="Фейс-контроль: нужна опрятность от ${buyer.requires.minCleanliness} 🧼 — приведи себя в порядок">🧼 мыло!</button>`;
  }
  if (buyer.scam) {
    return `<button class="btn btn--ghost btn--mini" data-sell="${entryIndex}" data-buyer="${buyer.id}"
      title="Честность ${percentLabel(1 - offer.scamChance)}; кинет — 0 ₽ и скандал (${SCAM.scandalCleanliness} 🧼)">💰 ${offer.min}–${offer.max} ₽</button>`;
  }
  return `<button class="btn btn--ghost btn--mini" data-sell="${entryIndex}" data-buyer="${buyer.id}">💰 ${rublesLabel(offer.price)}</button>`;
}

function entryRow(state, buyer, { entry, entryIndex, offer }) {
  const item = findItem(entry.itemId);
  const qty = offer.qty > 1 ? ` <span class="item__qty">×${offer.qty}</span>` : '';
  const mystery = offer.story === 'fleaMystery'
    ? `<div class="row__sub">🐈‍⬛ кот в мешке: цена = центр твоей оценки ≈ ${entry.estimate.low}–${entry.estimate.high} ₽</div>`
    : '';
  return `
    <div class="row">
      <span class="row__icon">${item.emoji}</span>
      <div class="row__main">
        <div class="row__name">${item.name}${qty}</div>
        ${mystery}
      </div>
      ${sellButton(state, buyer, entryIndex, offer)}
    </div>
  `;
}

/** Обучающая строка: ❓ без оценки барахолка возьмёт, когда сам назовёшь цену. */
function fleaMysteryTeachRow(entry) {
  const item = findItem(entry.itemId);
  return `
    <div class="row">
      <span class="row__icon">${item.emoji}</span>
      <div class="row__main">
        <div class="row__name">${item.name}</div>
        <div class="row__sub">🐈‍⬛ «кот в мешке»: 🧺 берёт ❓ по центру ТВОЕЙ 👁️-оценки</div>
      </div>
      <button class="btn btn--ghost btn--mini" disabled title="Сначала оцени находку в «🎒 Инвентаре»">❓ сначала 👁️</button>
    </div>
  `;
}

function buyerBlock(buyer, state) {
  const rows = sellableEntries(state, buyer.id)
    .map((x) => entryRow(state, buyer, x));

  // ❓ без оценки и без опознания — обучающие строки только для 🧺.
  if (buyer.id === 'baraholka') {
    for (const entry of state.inventory) {
      const item = findItem(entry.itemId);
      if (item?.kind === 'unidentified' && !entry.identified && !entry.estimate) {
        rows.push(fleaMysteryTeachRow(entry));
      }
    }
  }

  return `${buyerRow(buyer, state)}${rows.join('')}`;
}

/** Секция хозтоваров Тещи Петровны (снаряжение, сессия 9). */
function shopBlock(state) {
  const rows = Object.entries(EQUIPMENT_SLOTS).map(([slot, def]) => {
    const owned = Boolean(state.equipment[slot]);
    const afford = state.money >= def.shop.price;
    const btn = owned
      ? '<span class="row__meta">✓ есть</span>'
      : `<button class="btn btn--ghost btn--mini" data-buy-equip="${slot}"
          title="${def.shop.desc}" ${afford ? '' : 'disabled'}>Купить ${rublesLabel(def.shop.price)}</button>`;
    return `
      <div class="row">
        <span class="row__icon">${def.emoji}</span>
        <div class="row__main">
          <div class="row__name">${def.shop.name}</div>
          <div class="row__sub">${def.effectDesc} · ${hoursLabel(ACTIONS.saleInstant.hours)}</div>
        </div>
        ${btn}
      </div>
    `;
  }).join('');

  return `
    <p class="section-title">${EQUIPMENT_SHOP.emoji} ${EQUIPMENT_SHOP.name}</p>
    <div class="rows">${rows}</div>
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
      <button class="btn btn--ghost" data-goto-inventory>🎒 К вещам</button>
    </div>
  `;
}

function loreDetails() {
  const buyerLore = BUYERS.map((b) => `<p class="info__body"><strong>${b.emoji} ${b.name}</strong> — ${b.desc}</p>`).join('');
  const expertLore = EXPERTS.map((e) => `<p class="info__body"><strong>${e.emoji} ${e.name}</strong> — ${e.desc} <em>«${e.quote}»</em></p>`).join('');
  const shopLore = `<p class="info__body"><strong>${EQUIPMENT_SHOP.emoji} ${EQUIPMENT_SHOP.name}</strong> — ${EQUIPMENT_SHOP.desc}</p>`;
  return `
    <div class="card">
      <details class="info info--flat"><summary>кто все эти люди</summary>
        ${buyerLore}${expertLore}${shopLore}
      </details>
    </div>
  `;
}

function emptyNoshaCard(state) {
  if (state.inventory.length > 0) return '';
  return `
    <div class="card">
      <p class="card__desc">🕸️ Ноша пуста — сначала баки во вкладке «🗺️ Город».</p>
    </div>
  `;
}

export function renderMarket(root) {
  const state = getState();
  if (!state) return;

  root.innerHTML = `
    <p class="section-title">Кому сдать добро</p>
    ${emptyNoshaCard(state)}
    <div class="rows">${BUYERS.map((b) => buyerBlock(b, state)).join('')}</div>
    ${shopBlock(state)}
    <p class="section-title">Кто оценит ❓ — кнопки на самих находках в «🎒 Инвентаре»</p>
    <div class="rows">${EXPERTS.map(expertRow).join('')}</div>
    ${loreDetails()}
  `;

  root.querySelectorAll('[data-sell]').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyAction((s) => sellEntry(s, Number(btn.dataset.sell), btn.dataset.buyer));
    });
  });
  root.querySelectorAll('[data-buy-equip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyAction((s) => buyEquipment(s, btn.dataset.buyEquip));
    });
  });
  root.querySelectorAll('[data-goto-inventory]').forEach((btn) => {
    btn.addEventListener('click', () => showToast('❓-находки и кнопки опознания — во вкладке «🎒 Инвентарь»'));
  });
}
