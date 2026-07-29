/**
 * screens/character.js — вкладка «Персонаж». Сессия 5.5: минимализм —
 * навыки/слоты/быт компактными строками, правила ребёрна за <details>.
 */

import { SKILLS, LIVING } from '../../data/balance.js';
import { REBIRTH } from '../../data/rebirth.js';
import { getState } from '../session.js';
import { percentLabel, rublesLabel } from '../format.js';
import { showToast } from '../toast.js';

function pips(level, max = SKILLS.maxLevel) {
  return `<span class="pips">${'●'.repeat(level)}${'○'.repeat(max - level)}</span>`;
}

function skillsRows(state) {
  const rows = Object.entries(SKILLS.list).map(([key, skill]) => {
    const s = state.skills[key] ?? { level: 0, xp: 0 };
    return `
      <div class="row">
        <span class="row__icon">${skill.emoji}</span>
        <div class="row__main">
          <div class="row__name">${skill.name}</div>
          <div class="row__sub">${skill.effect}</div>
        </div>
        <span class="row__meta">ур. ${s.level} ${pips(s.level)} ${s.xp}xp</span>
      </div>
    `;
  }).join('');

  return `
    <p class="section-title">Навыки (растут от практики)</p>
    <div class="rows">${rows}</div>
  `;
}

function equipmentRows(state) {
  const slots = [
    { emoji: '🧤', name: 'Перчатки', value: state.equipment.gloves },
    { emoji: '🧥', name: 'Верхнее', value: state.equipment.jacket },
    { emoji: '🛒', name: 'Транспорт', value: state.equipment.cart },
  ];
  const rows = slots.map((s) => `
    <div class="row">
      <span class="row__icon">${s.emoji}</span>
      <div class="row__main"><div class="row__name">${s.name}</div></div>
      <span class="row__meta">${s.value ?? 'пусто'}</span>
    </div>
  `).join('');

  return `
    <p class="section-title">Снаряжение (сессия 9)</p>
    <div class="rows">${rows}</div>
  `;
}

function livingRows() {
  const food = LIVING.food.map((f) => `
    <div class="row">
      <span class="row__icon">${f.emoji}</span>
      <div class="row__main">
        <div class="row__name">${f.name}</div>
        <div class="row__sub">${rublesLabel(f.price)} · +${f.satiety} 🍞</div>
      </div>
      <button class="btn btn--ghost" data-session="8">Купить</button>
    </div>
  `).join('');

  const shelter = LIVING.shelter.map((s) => `
    <div class="row">
      <span class="row__icon">${s.emoji}</span>
      <div class="row__main">
        <div class="row__name">${s.name}</div>
        <div class="row__sub">${s.price === 0 ? 'бесплатно' : rublesLabel(s.price)} · сон ${percentLabel(s.quality)}</div>
      </div>
      <button class="btn btn--ghost" data-session="8">Лечь</button>
    </div>
  `).join('');

  return `
    <p class="section-title">Еда (сессия 8)</p>
    <div class="rows">${food}</div>
    <p class="section-title">Ночлег (сессия 8)</p>
    <div class="rows">${shelter}</div>
  `;
}

function rebirthCard(state) {
  return `
    <div class="card">
      <details class="info info--flat">
        <summary>⚰️ Если жизнь №${state.lives} кончится… (сейчас наследие +${percentLabel(state.legacyBonus)})</summary>
        <p class="info__body">
          Навыки останутся при тебе, деньги и ноша — при городе. Новая жизнь:
          ${rublesLabel(REBIRTH.start.money)} и +${percentLabel(REBIRTH.legacy.reputationBonusPerLife)}
          к ценам выкупа за каждую прожитую жизнь (потолок ${percentLabel(REBIRTH.legacy.reputationBonusCap)}).
        </p>
      </details>
    </div>
  `;
}

export function renderCharacter(root) {
  const state = getState();
  if (!state) return;

  root.innerHTML = `
    ${skillsRows(state)}
    ${equipmentRows(state)}
    ${livingRows()}
    ${rebirthCard(state)}
  `;

  root.querySelectorAll('[data-session]').forEach((btn) => {
    btn.addEventListener('click', () => showToast(`🚧 Оживёт в сессии ${btn.dataset.session}`));
  });
}
