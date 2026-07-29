/**
 * screens/character.js — вкладка «Персонаж»: навыки, снаряжение,
 * быт (еда/ночлег) и правила новой жизни. Сессия 4: живые навыки/слоты/жизни.
 */

import { SKILLS, LIVING } from '../../data/balance.js';
import { REBIRTH } from '../../data/rebirth.js';
import { getState } from '../session.js';
import { percentLabel, rublesLabel } from '../format.js';
import { showToast } from '../toast.js';

function pips(level, max = SKILLS.maxLevel) {
  return `<span class="pips">${'●'.repeat(level)}${'○'.repeat(max - level)}</span>`;
}

function skillsCard(state) {
  const rows = Object.entries(SKILLS.list).map(([key, skill]) => {
    const progress = state.skills[key] ?? { level: 0, xp: 0 };
    return `
      <p class="card__desc" style="margin-top:8px">
        ${skill.emoji} <strong>${skill.name}</strong> — ур. ${progress.level} ${pips(progress.level)}
        <small>(${progress.xp} xp)</small><br>
        <small>${skill.effect}</small>
      </p>
    `;
  }).join('');

  return `
    <div class="card">
      <h2 class="card__title"><span class="emoji">📈</span>Навыки</h2>
      <p class="card__desc">Растут от практики, а не из книг. Книги ты продаёшь (30 ₽, том 2).</p>
      ${rows}
    </div>
  `;
}

function equipmentCard(state) {
  const slots = [
    { emoji: '🧤', name: 'Перчатки', value: state.equipment.gloves },
    { emoji: '🧥', name: 'Верхнее', value: state.equipment.jacket },
    { emoji: '🛒', name: 'Транспорт', value: state.equipment.cart },
  ];
  const html = slots.map((s) => `
    <div class="card item">
      <div class="item__emoji">${s.emoji}</div>
      <div class="item__name">${s.name}</div>
      <span class="item__value ${s.value ? '' : 'item__value--unknown'}">${s.value ?? 'пусто'}</span>
    </div>
  `).join('');
  return `
    <div class="card">
      <h2 class="card__title"><span class="emoji">🎽</span>Снаряжение</h2>
      <p class="card__desc">Перчатки берегут руки, куртка — тепло, тележка — ношу. Всё это где-то там, в баках (сессия 9).</p>
    </div>
    <div class="grid">${html}</div>
  `;
}

function livingSection() {
  const food = LIVING.food.map((f) => `
    <div class="card item">
      <div class="item__emoji">${f.emoji}</div>
      <div class="item__name">${f.name}</div>
      <span class="item__value">${rublesLabel(f.price)} · +${f.satiety}🍞</span>
      <button class="btn btn--ghost btn--wide" data-session="8">Съесть</button>
    </div>
  `).join('');

  const shelter = LIVING.shelter.map((s) => `
    <div class="card item">
      <div class="item__emoji">${s.emoji}</div>
      <div class="item__name">${s.name}</div>
      <span class="item__value">${s.price === 0 ? 'бесплатно' : rublesLabel(s.price)} · сон ${percentLabel(s.quality)}</span>
      <button class="btn btn--ghost btn--wide" data-session="8">Лечь спать</button>
    </div>
  `).join('');

  return `
    <p class="section-title">Быт: что поесть</p>
    <div class="grid">${food}</div>
    <p class="section-title">Быт: где переспать ночь</p>
    <div class="grid">${shelter}</div>
  `;
}

function rebirthCard(state) {
  const legacy = REBIRTH.legacy;
  return `
    <div class="card card--hi">
      <h3 class="card__title"><span class="emoji">⚰️</span>Если жизнь №${state.lives} кончится…</h3>
      <p class="card__desc">
        Навыки останутся при тебе, деньги и ноша — при городе. Начнёшь новую жизнь с
        ${rublesLabel(REBIRTH.start.money)} и бонусом репутации +${percentLabel(legacy.reputationBonusPerLife)}
        к ценам выкупа за каждую прожитую жизнь (потолок ${percentLabel(legacy.reputationBonusCap)}).
        Сейчас у тебя: +${percentLabel(state.legacyBonus)}.
      </p>
    </div>
  `;
}

export function renderCharacter(root) {
  const state = getState();
  if (!state) return;

  root.innerHTML = `
    ${skillsCard(state)}
    ${equipmentCard(state)}
    ${livingSection()}
    ${rebirthCard(state)}
  `;

  root.querySelectorAll('[data-session]').forEach((btn) => {
    btn.addEventListener('click', () => showToast(`🚧 Оживёт в сессии ${btn.dataset.session} — данные уже готовы, логика в пути`));
  });
}
