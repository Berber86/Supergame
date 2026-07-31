/**
 * Рендер панели рейда (HTML-строки, без слушателей — их вешает main.ts делегированием).
 * Держим разметку отдельно от логики: main.ts не должен пухнуть (правило ≤300 строк).
 */

import type { GameState } from '../core/types';
import { KINGDOMS } from '../content/kingdoms';
import { FAMILY_NAMES, getRelic } from '../content/relics';
import {
  canAffordRaid,
  computeRaidPower,
  getCurrentKingdom,
  getStageRelicChoices,
  getTotalStages,
  isVictory,
} from '../raid/raid';
import { formatSynergyBonus } from '../raid/raid-ui';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Список активных синергий текущего забега. */
function renderSynergies(state: GameState): string {
  const power = computeRaidPower(state);
  if (power.synergies.length === 0) {
    return `<p class="hint">Синергии не открыты. Собери 2 реликвии одного семейства или соедини разные — что-то да получится.</p>`;
  }
  const items = power.synergies
    .map(
      (s) => `<li class="synergy">
        <strong>✨ ${escapeHtml(s.name)}</strong> <span class="muted">${escapeHtml(formatSynergyBonus(s))}</span><br>
        <span class="small">${escapeHtml(s.desc)}</span>
      </li>`,
    )
    .join('');
  return `<ul class="synergy-list">${items}</ul>`;
}

/** Выбор королевства (рейда нет). */
function renderKingdomChoice(state: GameState): string {
  if (isVictory(state)) {
    return `<div class="victory">
        <h3>👑 Повелитель Области!</h3>
        <p>Все три королевства стоят в пещере на полочке. Фламберг доволен и слегка объелся.</p>
        <p class="hint">Можно начать заново — новая пещера, новые реликвии, новые нелепые короли.</p>
      </div>`;
  }

  const cards = KINGDOMS.map((k) => {
    const taken = state.kingdomProgress[k.id] === true;
    const affordable = canAffordRaid(state, k.id);
    const disabled = taken || !affordable;
    const label = taken ? 'Захвачено ✅' : `Вылет за ${k.cost} 💰`;
    return `
      <li class="shop-item">
        <div>
          <strong>${escapeHtml(k.name)}</strong>${taken ? ' <span class="muted">— уже наше</span>' : ''}<br>
          <span class="small">${escapeHtml(k.desc)}</span><br>
          <span class="muted">Этапов: ${k.stages} • Босс: ${escapeHtml(k.boss)} (${k.bossHp} HP) • Добыча: ${k.loot} 💰</span>
        </div>
        <div class="shop-actions">
          <button class="buy-btn" data-raid="${k.id}" ${disabled ? 'disabled' : ''}>${label}</button>
        </div>
      </li>`;
  }).join('');

  return `<ul class="shop-list">${cards}</ul>
    <p class="hint">Сила рейда зависит от пещеры: слуги и здания летят вместе с драконом.</p>`;
}

/** Этап рейда: выбор реликвии. */
function renderStage(state: GameState): string {
  const kingdom = getCurrentKingdom(state)!;
  const power = computeRaidPower(state);
  const choices = getStageRelicChoices(state)
    .map(
      (r) => `
      <li class="shop-item">
        <div>
          <strong>${escapeHtml(r.name)}</strong> <span class="muted">${escapeHtml(FAMILY_NAMES[r.family])}</span><br>
          <span class="small">${escapeHtml(r.effect)}</span>
        </div>
        <div class="shop-actions">
          <button class="buy-btn" data-relic="${r.id}">Взять</button>
        </div>
      </li>`,
    )
    .join('');

  return `
    <p><strong>${escapeHtml(kingdom.name)}</strong> — этап ${state.raid.stage} из ${getTotalStages(state)}</p>
    <p class="muted">Урон: ${power.damage} (пещера ${power.base} + реликвии ${power.fromRelics}, ×${power.multiplier.toFixed(2)}) • Босс: ${kingdom.bossHp} HP</p>
    <ul class="shop-list">${choices}</ul>
    ${renderSynergies(state)}
    <button id="retreat-btn" class="reset-btn">Отступить</button>`;
}

/** Логово босса. */
function renderBoss(state: GameState): string {
  const kingdom = getCurrentKingdom(state)!;
  const power = computeRaidPower(state);
  const verdict =
    power.damage >= kingdom.bossHp
      ? 'Выглядит убедительно — босс уже нервничает.'
      : 'Урона маловато: босс, кажется, зевает.';

  return `
    <p><strong>${escapeHtml(kingdom.boss)}</strong> — ${kingdom.bossHp} HP</p>
    <p class="muted">Твой урон: ${power.damage} (пещера ${power.base} + реликвии ${power.fromRelics}, ×${power.multiplier.toFixed(2)}). ${verdict}</p>
    ${renderSynergies(state)}
    <button id="boss-btn" class="big-btn">🔥 В бой!</button>
    <button id="retreat-btn" class="reset-btn">Отступить</button>`;
}

/** Панель рейда целиком. */
export function renderRaidPanel(state: GameState): string {
  if (!state.raid.kingdomId) return renderKingdomChoice(state);
  if (state.raid.atBoss) return renderBoss(state);
  return renderStage(state);
}

/** Коллекция найденных реликвий. */
export function renderCollection(state: GameState): string {
  if (state.relics.length === 0) {
    return '<p class="hint">Коллекция пуста. Реликвии находятся только в рейдах.</p>';
  }
  const items = state.relics
    .map((id) => getRelic(id))
    .filter((r) => r !== undefined)
    .map((r) => `<li>${escapeHtml(FAMILY_NAMES[r!.family])} ${escapeHtml(r!.name)} — <span class="small">${escapeHtml(r!.effect)}</span></li>`)
    .join('');
  return `<ul class="list">${items}</ul>`;
}
