/**
 * screens/character.js — вкладка «Персонаж». Сессия 8: быт ЖИВОЙ —
 * покупная еда, мытьё, выбор ночлега на сегодня; метрика «лучшая жизнь».
 * Снаряжение — слоты-загадки до сессии 9.
 */

import { SKILLS, LIVING, ACTIONS, NIGHT_RISK } from '../../data/balance.js';
import { REBIRTH } from '../../data/rebirth.js';
import { EQUIPMENT_SLOTS } from '../../data/equipment.js';
import { buyFood, wash, chooseShelter } from '../../core/living.js';
import { equipmentSourceLabel } from '../../core/equipment.js';
import { getState, applyAction } from '../session.js';
import { percentLabel, rublesLabel, hoursLabel, plural } from '../format.js';
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
  const rows = Object.entries(EQUIPMENT_SLOTS).map(([slot, def]) => {
    const source = state.equipment[slot];
    const hint = def.fromItems.length > 0
      ? 'приспособить находку из инвентаря или купить'
      : 'только купить у торговца';
    return `
      <div class="row">
        <span class="row__icon">${def.emoji}</span>
        <div class="row__main">
          <div class="row__name">${def.name}</div>
          <div class="row__sub">${source
            ? `${equipmentSourceLabel(slot, source)} — ${def.effectDesc}`
            : `пусто · ${def.effectDesc} · источник: ${hint}`}</div>
        </div>
        ${source
          ? '<span class="row__meta">✓ надето</span>'
          : '<span class="row__meta">в 🧰 магазине</span>'}
      </div>
    `;
  }).join('');

  return `
    <p class="section-title">Снаряжение (надел — навсегда, до смерти или замены)</p>
    <div class="rows">${rows}</div>
  `;
}

function foodRows(state) {
  const rows = LIVING.food.map((f) => {
    const afford = state.money >= f.price;
    const dirty = f.cleanliness ? ` · ${f.cleanliness} 🧼` : '';
    const warm = f.warmth ? ` · +${f.warmth} 🔥` : '';
    return `
      <div class="row">
        <span class="row__icon">${f.emoji}</span>
        <div class="row__main">
          <div class="row__name">${f.name}</div>
          <div class="row__sub">${rublesLabel(f.price)} · +${f.satiety} 🍞${warm}${dirty} · ${hoursLabel(ACTIONS.eatOut.hours)}</div>
        </div>
        <button class="btn btn--ghost" data-food="${f.id}" ${afford ? '' : 'disabled title="не по карману"'}>Съесть</button>
      </div>
    `;
  }).join('');

  return `
    <p class="section-title">Еда (горячее — счастье, которое быстро жуётся)</p>
    <div class="rows">${rows}</div>
  `;
}

function washRow() {
  return `
    <p class="section-title">Личная гидродинамика</p>
    <div class="rows">
      <div class="row">
        <span class="row__icon">🚿</span>
        <div class="row__main">
          <div class="row__name">Умыться</div>
          <div class="row__sub">бесплатно · +${ACTIONS.wash.cleanliness} 🧼 · ${hoursLabel(ACTIONS.wash.hours)} · нужно для 🧺 барахолки</div>
        </div>
        <button class="btn btn--ghost" data-wash>Умыться</button>
      </div>
    </div>
  `;
}

function shelterRows(state) {
  const rows = LIVING.shelter.map((s) => {
    const current = state.shelterTonight === s.id;
    const note = s.riskEvents
      ? `морозный сон смертелен ${percentLabel(NIGHT_RISK.lavkaFrostDeathChance)} · кража ${percentLabel(NIGHT_RISK.lavkaStealChance)}`
      : `сон ${percentLabel(s.quality)}${s.washIncluded ? ' · мойка включена' : ''}`;
    return `
      <div class="row">
        <span class="row__icon">${s.emoji}</span>
        <div class="row__main">
          <div class="row__name">${s.name}</div>
          <div class="row__sub">${s.price === 0 ? 'бесплатно' : `${rublesLabel(s.price)} при отбое`} · ${note}</div>
        </div>
        ${current
          ? '<span class="row__meta">✓ на сегодня</span>'
          : `<button class="btn btn--ghost" data-shelter="${s.id}">Спать тут</button>`}
      </div>
    `;
  }).join('');

  return `
    <p class="section-title">Ночлег на сегодня (деньги снимутся в полночь)</p>
    <div class="rows">${rows}</div>
  `;
}

function bestLifeCard(state) {
  const b = state.bestLife;
  if (!b || b.earned <= 0) return '';
  return `
    <div class="card">
      <p class="card__desc">
        🏆 <strong>Лучшая жизнь — №${b.life}</strong>: ${b.days} ${plural(b.days, 'день', 'дня', 'дней')},
        заработано ${rublesLabel(b.earned)}${b.bestItemLabel ? `, находка ${b.bestItemLabel}` : ''}.
        Рекорд не горит и не тонет. В отличие от нас с тобой.
      </p>
    </div>
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
    ${foodRows(state)}
    ${washRow()}
    ${shelterRows(state)}
    ${bestLifeCard(state)}
    ${rebirthCard(state)}
  `;

  root.querySelectorAll('[data-food]').forEach((btn) => {
    btn.addEventListener('click', () => applyAction((s) => buyFood(s, btn.dataset.food)));
  });
  root.querySelectorAll('[data-wash]').forEach((btn) => {
    btn.addEventListener('click', () => applyAction((s) => wash(s)));
  });
  root.querySelectorAll('[data-shelter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyAction((s) => chooseShelter(s, btn.dataset.shelter));
      showToast('🛏️ Выбор на сегодня сделан. Полночь рассчитает.');
    });
  });
}
