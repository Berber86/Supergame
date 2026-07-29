/**
 * screens/city.js — вкладка «Город». Сессия 5.5 (UX-минимализм, заказ человека):
 * ОДНА карточка района (погода — строкой, флейвор за <details>), компактные
 * баки/переходы, журнал свёрнут. Стоимость обыска показана ОДИН раз на всех.
 */

import { DISTRICTS } from '../../data/districts.js';
import { ACTIONS, BEGGING, DIG_MODES } from '../../data/balance.js';
import { findDistrict, findWeather } from '../../core/lookups.js';
import {
  travelTo, beg, dig, setDigMode,
  availableDigModes, digModeDef, getBinsRecord, binRichness,
} from '../../core/actions.js';
import { getState, applyAction } from '../session.js';
import { formatClock, hoursLabel, riskLabel, rublesLabel, plural } from '../format.js';

const MODE_META = {
  careful: { emoji: '🤫', label: 'Аккуратнее', hint: `лут ×${DIG_MODES.careful.lootMult} · риск ×${DIG_MODES.careful.riskMult}` },
  normal:  { emoji: '🧢', label: 'Обычно',     hint: 'как есть' },
  bold:    { emoji: '😤', label: 'Смелее',     hint: `лут ×${DIG_MODES.bold.lootMult} · риск ×${DIG_MODES.bold.riskMult} · 🔍${DIG_MODES.bold.unlockLevel}` },
};

/** Сегмент-переключатель режима обыска (аккуратнее/обычно/смелее). */
function digModesSeg(state) {
  const activeId = digModeDef(state).id;
  const buttons = availableDigModes(state).map(({ id, unlocked }) => {
    const meta = MODE_META[id];
    const lockNote = unlocked ? '' : ` 🔒 с 🔍-${DIG_MODES.bold.unlockLevel}`;
    return `
      <button class="seg__btn ${activeId === id ? 'seg__btn--active' : ''}" data-dig-mode="${id}"
        ${unlocked ? '' : 'disabled'} title="${meta.hint}${lockNote}">
        ${meta.emoji} ${meta.label}
      </button>
    `;
  }).join('');
  return `<div class="seg" role="group" aria-label="Режим обыска">${buttons}</div>`;
}

function binsBlock(state, district) {
  if (district.binCount === 0) {
    return '<p class="card__desc">Баков тут нет — тут ты спишь. Рабочие районы — ниже.</p>';
  }
  const rec = getBinsRecord(state, district.id);

  const bins = rec.digs.map((digs, i) => {
    const richness = binRichness(state, district, i);
    const spent = richness <= 0.125; // после 3+ обысков — тщетно всё
    const stateLine = digs > 0
      ? `<span class="bin__meta ${spent ? 'bin__meta--spent' : ''}">${spent ? 'пусто' : `рыт ×${digs} · ×${Math.round(richness * 100) / 100}`}</span>`
      : '<span class="bin__meta">не рыт</span>';
    return `
      <button class="bin" data-dig-bin="${i}" title="Обыск бака №${i + 1}">
        <span class="bin__emoji">🗑️</span> №${i + 1}<br>
        ${stateLine}
      </button>
    `;
  }).join('');

  return `${digModesSeg(state)}<div class="bins">${bins}</div>`;
}

function districtCard(state) {
  const d = findDistrict(state.districtId);
  const w = findWeather(state.weatherId);
  const cost = ACTIONS.dig;

  const weatherFx = [
    w.warmthMult !== 1 ? `тепло ×${w.warmthMult}` : null,
    w.digRiskMult !== 1 ? `риск ×${w.digRiskMult}` : null,
  ].filter(Boolean).join(' · ');

  return `
    <div class="card">
      <h2 class="card__title"><span class="emoji">${d.emoji}</span>${d.name} — ты здесь</h2>
      <p class="mini-strip">
        <span>${w.emoji} ${w.name}${weatherFx ? ` · ${weatherFx}` : ''}</span>
        <span>·</span>
        <span>баков: ${d.binCount} · риск: ${riskLabel(d.digRisk)}</span>
        ${d.binCount > 0 ? `<span>·</span><span>обыск: ${hoursLabel(cost.hours)} · ${cost.energy}⚡ ${cost.cleanliness}🧼</span>` : ''}
      </p>
      <details class="info"><summary>о районе и погоде</summary>
        <p class="info__body">${d.desc}</p>
        <p class="info__body">${w.note}</p>
      </details>
      ${binsBlock(state, d)}
      <button class="btn--ghost btn btn--wide" id="begBtn">🧢 Постоять с шапкой: ${hoursLabel(BEGGING.hours)} → ${rublesLabel(BEGGING.income)} (стабильно, скучно)</button>
    </div>
  `;
}

function travelRows(state) {
  const current = findDistrict(state.districtId);
  const others = DISTRICTS.filter((d) => d.id !== current.id);

  const rows = others.map((d) => {
    const hours = current.travelHours[d.id];
    const sub = d.binCount > 0
      ? `баков: ${d.binCount} · риск: ${riskLabel(d.digRisk)}`
      : 'твоя база — сон и слухи';
    return `
      <div class="row">
        <span class="row__icon">${d.emoji}</span>
        <div class="row__main">
          <div class="row__name">${d.name}</div>
          <div class="row__sub">${sub}</div>
        </div>
        <span class="row__meta">${hoursLabel(hours)}</span>
        <button class="btn btn--ghost" data-travel-to="${d.id}">🚶 Идти</button>
      </div>
    `;
  }).join('');

  return `
    <p class="section-title">Куда дальше?</p>
    <div class="rows">${rows}</div>
  `;
}

function logCard(state) {
  const last = state.log.slice(-6).reverse();
  if (last.length === 0) return '';
  const line = (e) => `<p class="info__body"><small>д${e.day} · ${formatClock(e.hour)}</small> — ${e.text}</p>`;
  const [head, ...rest] = last;
  const more = rest.length > 0
    ? `<details class="info"><summary>ещё ${rest.length} ${plural(rest.length, 'запись', 'записи', 'записей')}</summary>${rest.map(line).join('')}</details>`
    : '';
  return `
    <div class="card">
      <h3 class="card__title"><span class="emoji">📓</span>Журнал</h3>
      ${line(head)}
      ${more}
    </div>
  `;
}

export function renderCity(root) {
  const state = getState();
  if (!state) return;

  root.innerHTML = `
    ${districtCard(state)}
    ${travelRows(state)}
    ${logCard(state)}
  `;

  root.querySelectorAll('[data-travel-to]').forEach((btn) => {
    btn.addEventListener('click', () => applyAction((s) => travelTo(s, btn.dataset.travelTo)));
  });

  const begBtn = root.querySelector('#begBtn');
  if (begBtn) begBtn.addEventListener('click', () => applyAction(beg));

  root.querySelectorAll('[data-dig-bin]').forEach((btn) => {
    btn.addEventListener('click', () => applyAction((s) => dig(s, Number(btn.dataset.digBin))));
  });

  root.querySelectorAll('[data-dig-mode]').forEach((btn) => {
    btn.addEventListener('click', () => applyAction((s) => setDigMode(s, btn.dataset.digMode)));
  });
}
