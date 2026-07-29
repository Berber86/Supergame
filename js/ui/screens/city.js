/**
 * screens/city.js — вкладка «Город»: погода, текущий район, баки,
 * попрошайничество, переходы. Сессия 3: всё кнопки — плейсхолдеры,
 * номер сессии, когда оживёт, стоит в data-session.
 */

import { DISTRICTS } from '../../data/districts.js';
import { ACTIONS, BEGGING } from '../../data/balance.js';
import { DEMO, findDistrict, findWeather, BEGGING_INCOME } from '../demo.js';
import { hoursLabel, riskLabel, rublesLabel } from '../format.js';
import { showToast } from '../toast.js';

function weatherCard() {
  const w = findWeather(DEMO.weatherId);
  const tags = [];
  if (w.warmthMult !== 1) tags.push(`<span class="tag tag--danger">тепло ×${w.warmthMult}</span>`);
  if (w.digRiskMult !== 1) tags.push(`<span class="tag">риск обыска ×${w.digRiskMult}</span>`);

  return `
    <div class="card card--hi">
      <h2 class="card__title"><span class="emoji">${w.emoji}</span>${w.name} над городом</h2>
      <p class="card__desc">${w.note}</p>
      <div class="card__meta">${tags.join('')}</div>
    </div>
  `;
}

function currentDistrictCard() {
  const d = findDistrict(DEMO.districtId);
  const bins = Array.from({ length: d.binCount }, (_, i) => `
    <button class="bin" data-session="5" title="Обыск оживёт в сессии 5">
      <span class="bin__emoji">🗑️</span>
      Бак №${i + 1}<br>
      <small>${hoursLabel(ACTIONS.dig.hours)} · ${ACTIONS.dig.energy}⚡</small>
    </button>
  `).join('');

  return `
    <div class="card">
      <h2 class="card__title"><span class="emoji">${d.emoji}</span>${d.name} — ты здесь</h2>
      <p class="card__desc">${d.desc}</p>
      <div class="card__meta">
        <span class="tag">баков: ${d.binCount}</span>
        <span class="tag ${d.digRisk >= 0.2 ? 'tag--danger' : 'tag--green'}">риск: ${riskLabel(d.digRisk)}</span>
      </div>
      <div class="bins">${bins}</div>
    </div>
  `;
}

function beggingCard() {
  return `
    <div class="card">
      <h2 class="card__title"><span class="emoji">🧢</span>Постоять с шапкой</h2>
      <p class="card__desc">
        Стабильно, скучно, без приключений: ${hoursLabel(BEGGING.hours)} → ${rublesLabel(BEGGING_INCOME)} гарантированно.
        На голодный день — вариант. На счастливый — вряд ли.
      </p>
      <button class="btn btn--wide" data-session="4">🧢 Постоять (${hoursLabel(BEGGING.hours)})</button>
    </div>
  `;
}

function travelSection() {
  const current = findDistrict(DEMO.districtId);
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
        <button class="btn btn--ghost btn--wide" data-session="5">🚶 Перейти</button>
      </div>
    `;
  }).join('');

  return `
    <p class="section-title">Куда дальше?</p>
    <div class="grid grid--wide">${cards}</div>
  `;
}

export function renderCity(root) {
  root.innerHTML = `
    ${weatherCard()}
    ${currentDistrictCard()}
    ${beggingCard()}
    ${travelSection()}
  `;

  root.querySelectorAll('[data-session]').forEach((btn) => {
    btn.addEventListener('click', () => showToast(`🚧 Оживёт в сессии ${btn.dataset.session} — данные уже готовы, логика в пути`));
  });
}
