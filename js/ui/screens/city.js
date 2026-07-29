/**
 * screens/city.js — вкладка «Город»: погода, текущий район, баки,
 * попрошайничество, переходы, журнал. Сессия 4: ЖИВОЕ состояние —
 * переходы и попрошайничество уже работают, баки ждут сессию 5.
 */

import { DISTRICTS } from '../../data/districts.js';
import { ACTIONS, BEGGING } from '../../data/balance.js';
import { findDistrict, findWeather } from '../../core/lookups.js';
import { travelTo, beg } from '../../core/actions.js';
import { getState, applyAction } from '../session.js';
import { formatClock, hoursLabel, riskLabel, rublesLabel } from '../format.js';
import { showToast } from '../toast.js';

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

function currentDistrictCard(state) {
  const d = findDistrict(state.districtId);

  const binsBlock = d.binCount > 0
    ? `<div class="bins">${Array.from({ length: d.binCount }, (_, i) => `
        <button class="bin" data-session="5" title="Обыск оживёт в сессии 5">
          <span class="bin__emoji">🗑️</span>
          Бак №${i + 1}<br>
          <small>${hoursLabel(ACTIONS.dig.hours)} · ${ACTIONS.dig.energy}⚡</small>
        </button>
      `).join('')}</div>`
    : '<p class="card__desc" style="margin-top:8px">Баков тут нет — тут ты спишь. Рабочие районы — ниже.</p>';

  return `
    <div class="card">
      <h2 class="card__title"><span class="emoji">${d.emoji}</span>${d.name} — ты здесь</h2>
      <p class="card__desc">${d.desc}</p>
      <div class="card__meta">
        <span class="tag">баков: ${d.binCount}</span>
        <span class="tag ${d.digRisk >= 0.2 ? 'tag--danger' : 'tag--green'}">риск: ${riskLabel(d.digRisk)}</span>
      </div>
      ${binsBlock}
    </div>
  `;
}

function beggingCard() {
  return `
    <div class="card">
      <h2 class="card__title"><span class="emoji">🧢</span>Постоять с шапкой</h2>
      <p class="card__desc">
        Стабильно, скучно, без приключений: ${hoursLabel(BEGGING.hours)} → ${rublesLabel(BEGGING.income)} гарантированно.
        На голодный день — вариант. На счастливый — вряд ли. <strong>Работает уже сейчас.</strong>
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

  root.querySelectorAll('[data-session]').forEach((btn) => {
    btn.addEventListener('click', () => showToast(`🚧 Оживёт в сессии ${btn.dataset.session} — логика уже дышит рядом`));
  });
}
