/**
 * death.js — экран конца жизни (оверлей на всю страницу).
 * Полноценный «экран итогов» — сессия 8, здесь честный минимум:
 * причина, итоги дней/денег, правила новой жизни, кнопка возрождения.
 */

import { REBIRTH } from '../data/rebirth.js';
import { percentLabel, rublesLabel } from './format.js';

function ensureOverlay() {
  let overlay = document.getElementById('deathOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'deathOverlay';
    overlay.className = 'death-overlay';
    document.body.appendChild(overlay);
  }
  return overlay;
}

export function showDeath(state, onNewLife) {
  const overlay = ensureOverlay();

  const epilogue = REBIRTH.epilogueLines[0]
    .replace('{days}', state.day)
    .replace('{earned}', state.earnedThisLife);
  const bestItemLine = state.bestItemLabel
    ? `Лучшая находка: ${state.bestItemLabel}.`
    : 'Лучшей находки не случилось — небо задолжало тебе картину.';

  overlay.innerHTML = `
    <div class="death-card">
      <div class="death-card__emoji">⚰️</div>
      <h2 class="death-card__title">Жизнь №${state.lives} окончена</h2>
      <p class="death-card__cause">${state.deathCause ?? 'Питер забрал своё.'}</p>
      <p class="death-card__line"><em>${epilogue}</em></p>
      <p class="death-card__line">${bestItemLine}</p>
      <p class="death-card__rules">
        Навыки останутся при тебе. Ноша и деньги — при городе.<br>
        Новая жизнь: ${rublesLabel(REBIRTH.start.money)} к существованию,
        наследие репутации +${percentLabel(REBIRTH.legacy.reputationBonusPerLife)}
        (всего +${percentLabel(state.legacyBonus + REBIRTH.legacy.reputationBonusPerLife)}).
      </p>
      <button class="btn death-card__btn" id="deathNewLifeBtn">🌅 Новая жизнь</button>
    </div>
  `;
  overlay.classList.add('death-overlay--visible');
  overlay.querySelector('#deathNewLifeBtn').addEventListener('click', onNewLife);
}

export function hideDeath() {
  const overlay = document.getElementById('deathOverlay');
  if (overlay) overlay.classList.remove('death-overlay--visible');
}
