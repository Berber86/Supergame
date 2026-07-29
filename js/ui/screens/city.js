/**
 * screens/city.js — вкладка «Город»: погода, текущий район, БАКИ (играбельно,
 * сессия 5), попрошайничество, переходы, журнал. Правил здесь нет: нажал
 * кнопку — ядро решило, тосты рассказали.
 */

import { DISTRICTS } from '../../data/districts.js';
import { ACTIONS, BEGGING, DIG_MODES } from '../../data/balance.js';
import { findDistrict, findWeather } from '../../core/lookups.js';
import {
  travelTo, beg, dig, setDigMode,
  availableDigModes, digModeDef, getBinsRecord, binRichness,
} from '../../core/actions.js';
import { getState, applyAction } from '../session.js';
import { formatClock, hoursLabel, riskLabel, rublesLabel } from '../format.js';

function weatherCard(state) {
  const w = findWeather(state.weatherId);
  const tags = [];
  if (w.warmthMult !== 1) tags.push(`<span class="tag tag--danger">тепло ×${w.warmthMult}</span>`);
  if (w.digRiskMult !== 1) tags.push(`<span class="tag">риск обыска ×${w.digRiskMult}</span>`);

  return `
    <div class="card card--hi">
      <h2 class="card__title"><span class="emoji">${w.emoji}</span>${w.name} над городом</h2>
      <p class="card__desc">${w.note}</p>
      <div class="card__meta">${tags.join('') || '<span class="tag">петербургская норма</span>'}</div>
    </div>
  `;
}

const MODE_META = {
  careful: { emoji: '🤫', label: 'Аккуратнее', hint: `лут ×${DIG_MODES.careful.lootMult} · риск ×${DIG_MODES.careful.riskMult}` },
  normal:  { emoji: '🧢', label: 'Обычно',     hint: 'как есть' },
  bold:    { emoji: '😤', label: 'Смелее',     hint: `лут ×${DIG_MODES.bold.lootMult} · риск ×${DIG_MODES.bold.riskMult} · 🔍${DIG_MODES.bold.unlockLevel}` },
};

/** Переключатель режима обыска (аккуратнее/обычно/смелее, DIG_MODES). */
function digModesRow(state) {
  const activeId = digModeDef(state).id; // учитывает и запертый «смелее» из старого сейва
  const buttons = availableDigModes(state).map(({ id, unlocked }) => {
    const meta = MODE_META[id];
    const cls = activeId === id ? 'btn' : 'btn btn--ghost';
    const lockNote = unlocked ? '' : ` 🔒 с 🔍 Поиска-${DIG_MODES.bold.unlockLevel}`;
    return `
      <button class="${cls} modes__btn" data-dig-mode="${id}" ${unlocked ? '' : 'disabled'}
        title="${meta.hint}${lockNote}">
        ${meta.emoji} ${meta.label}
      </button>
    `;
  }).join('');
  return `<div class="modes">${buttons}</div>`;
}

function binsBlock(state, district) {
  if (district.binCount === 0) {
    return '<p class="card__desc" style="margin-top:8px">Баков тут нет — тут ты спишь. Рабочие районы — ниже.</p>';
  }
  const rec = getBinsRecord(state, district.id);
  const cost = ACTIONS.dig;

  const bins = rec.digs.map((digs, i) => {
    const richness = binRichness(state, district, i);
    const spent = richness <= 0.125; // после 3+ обысков — тщетно всё
    const stateLine = digs > 0
      ? `<small class="bin__meta ${spent ? 'bin__meta--spent' : ''}">${spent ? 'пусто, хватит' : `рыт ×${digs} · лут ×${Math.round(richness * 100) / 100}`}</small>`
      : `<small class="bin__meta">${hoursLabel(cost.hours)} · ${cost.energy}⚡ · ${cost.cleanliness}🧼</small>`;
    return `
      <button class="bin" data-dig-bin="${i}" title="Обыск: ${hoursLabel(cost.hours)}, ${cost.energy}⚡, ${cost.cleanliness}🧼">
        <span class="bin__emoji">🗑️</span>
        Бак №${i + 1}<br>
        ${stateLine}
      </button>
    `;
  }).join('');

  return `${digModesRow(state)}<div class="bins">${bins}</div>`;
}

function currentDistrictCard(state) {
  const d = findDistrict(state.districtId);

  return `
    <div class="card">
      <h2 class="card__title"><span class="emoji">${d.emoji}</span>${d.name} — ты здесь</h2>
      <p class="card__desc">${d.desc}</p>
      <div class="card__meta">
        <span class="tag">баков: ${d.binCount}</span>
        <span class="tag ${d.digRisk >= 0.2 ? 'tag--danger' : 'tag--green'}">риск: ${riskLabel(d.digRisk)}</span>
      </div>
      ${binsBlock(state, d)}
    </div>
  `;
}

function beggingCard() {
  return `
    <div class="card">
      <h2 class="card__title"><span class="emoji">🧢</span>Постоять с шапкой</h2>
      <p class="card__desc">
        Стабильно, скучно, без приключений: ${hoursLabel(BEGGING.hours)} → ${rublesLabel(BEGGING.income)} гарантированно.
        На голодный день — вариант. На счастливый — вряд ли.
      </p>
      <button class="btn btn--wide" id="begBtn">🧢 Постоять (${hoursLabel(BEGGING.hours)})</button>
    </div>
  `;
}

function travelSection(state) {
  const current = findDistrict(state.districtId);
  const others = DISTRICTS.filter((d) => d.id !== current.id);

  const cards = others.map((d) => {
    const hours = current.travelHours[d.id];
    const binsInfo = d.binCount > 0 ? `<span class="tag">баков: ${d.binCount}</span>` : '<span class="tag tag--accent">твоя база</span>';
    return `
      <div class="card">
        <h3 class="card__title"><span class="emoji">${d.emoji}</span>${d.name}</h3>
        <p class="card__desc">${d.desc}</p>
        <div class="card__meta">
          ${binsInfo}
          <span class="tag">риск: ${riskLabel(d.digRisk)}</span>
          <span class="tag tag--accent">путь: ${hoursLabel(hours)}</span>
        </div>
        <button class="btn btn--wide" data-travel-to="${d.id}">🚶 Перейти</button>
      </div>
    `;
  }).join('');

  return `
    <p class="section-title">Куда дальше?</p>
    <div class="grid grid--wide">${cards}</div>
  `;
}

function logCard(state) {
  const last = state.log.slice(-3).reverse();
  if (last.length === 0) return '';
  const lines = last.map((e) => `
    <p class="card__desc"><small>д${e.day} · ${formatClock(e.hour)}</small> — ${e.text}</p>
  `).join('');
  return `
    <div class="card">
      <h3 class="card__title"><span class="emoji">📓</span>Журнал (последнее)</h3>
      ${lines}
    </div>
  `;
}

export function renderCity(root) {
  const state = getState();
  if (!state) return;

  root.innerHTML = `
    ${weatherCard(state)}
    ${currentDistrictCard(state)}
    ${beggingCard()}
    ${travelSection(state)}
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
