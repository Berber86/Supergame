/**
 * Рейд-петля v1 (S5, ROADMAP).
 * Полный цикл: выбор королевства → этапы с выбором реликвий → босс → победа/поражение → возврат.
 * Без синергий (они в S6). Все числа малые.
 */

import type { GameState, KingdomDef, RelicDef } from '../core/types';
import { RELICS } from '../content/relics';
import { KINGDOMS } from '../content/kingdoms';

/** Можно ли начать новый рейд? */
export function canStartRaid(state: GameState): boolean {
  return state.raid.kingdomId === null;
}

/** Начать рейд на королевство. Возвращает true при успехе. */
export function startRaid(state: GameState, kingdomId: string): boolean {
  if (!canStartRaid(state)) return false;

  const kingdom = KINGDOMS.find((k) => k.id === kingdomId);
  if (!kingdom) return false;

  state.raid = {
    kingdomId,
    stage: 1,
    relics: [],
  };

  state.journal.unshift(`Дракон Фламберг вылетел в рейд на «${kingdom.name}»!`);
  state.journal = state.journal.slice(0, 20);
  return true;
}

/** Получить доступные реликвии для текущего этапа (3 случайные, без повторов в забеге). */
export function getStageRelicChoices(state: GameState): RelicDef[] {
  if (!state.raid.kingdomId) return [];

  const used = new Set(state.raid.relics);
  const pool = RELICS.filter((r) => !used.has(r.id));

  // Простой shuffle + take 3 (или меньше)
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

/** Выбрать реликвию на текущем этапе. Возвращает true при успехе. */
export function chooseRelic(state: GameState, relicId: string): boolean {
  if (!state.raid.kingdomId || state.raid.stage === 0) return false;

  const already = state.raid.relics.includes(relicId);
  if (already) return false;

  const relic = RELICS.find((r) => r.id === relicId);
  if (!relic) return false;

  state.raid.relics.push(relicId);

  // Продвигаем этап
  const kingdom = KINGDOMS.find((k) => k.id === state.raid.kingdomId);
  const totalStages = kingdom ? kingdom.stages : 3;

  if (state.raid.stage < totalStages) {
    state.raid.stage += 1;
  } else {
    // Этапы закончились — переходим к боссу (stage остаётся на финальном для UI)
  }

  state.journal.unshift(`Выбрана реликвия: ${relic.name}`);
  state.journal = state.journal.slice(0, 20);
  return true;
}

/** Простой расчёт урона по боссу на основе собранных реликвий (без синергий).
 * С 8–10 хорошими реликвиями — уверенная победа над первым боссом (HP 50).
 */
function calculateRaidDamage(relicIds: string[]): number {
  let dmg = 12; // базовый урон дракона
  for (const id of relicIds) {
    const relic = RELICS.find((r) => r.id === id);
    if (relic) {
      // Простые эффекты из описаний (только урон)
      if (relic.effect.includes('+4 урон')) dmg += 6;
      else if (relic.effect.includes('+3 урон')) dmg += 5;
      else if (relic.effect.includes('+2 урон')) dmg += 4;
      else if (relic.effect.includes('+1 урон')) dmg += 3;
      else if (relic.effect.includes('урон')) dmg += 5;
      else dmg += 2; // fallback
    }
  }
  // Малые числа, но даёт возможность победить первые 2 королевства (HP 50/80)
  return Math.max(12, Math.min(dmg, 95));
}

/** Разрешить бой с боссом. Возвращает {win: boolean, damageDealt, remainingHp} */
export function resolveBoss(state: GameState): { win: boolean; damageDealt: number; remainingHp: number } {
  if (!state.raid.kingdomId) {
    return { win: false, damageDealt: 0, remainingHp: 0 };
  }

  const kingdom = KINGDOMS.find((k) => k.id === state.raid.kingdomId)!;
  const damage = calculateRaidDamage(state.raid.relics);
  const remaining = Math.max(0, kingdom.bossHp - damage);
  const win = remaining <= 0;

  if (win) {
    state.kingdomProgress[kingdom.id] = true;
    state.journal.unshift(`Победа! Захвачено «${kingdom.name}».`);
  } else {
    // Поражение — теряем немного золота (малые числа)
    const loss = Math.floor(state.gold * 0.15);
    state.gold = Math.max(0, state.gold - loss);
    state.journal.unshift(`Рейд провалился. Потеряно ${loss} золота.`);
  }

  state.journal = state.journal.slice(0, 20);

  // Завершаем рейд
  const result = { win, damageDealt: damage, remainingHp: remaining };
  endRaid(state);
  return result;
}

/** Завершить текущий рейд (очистить состояние рейда). */
export function endRaid(state: GameState): void {
  state.raid = { kingdomId: null, stage: 0, relics: [] };
}

/** Получить текущее королевство рейда (или null). */
export function getCurrentKingdom(state: GameState): KingdomDef | null {
  if (!state.raid.kingdomId) return null;
  return KINGDOMS.find((k) => k.id === state.raid.kingdomId) || null;
}

/** Сколько этапов всего у текущего королевства. */
export function getTotalStages(state: GameState): number {
  const k = getCurrentKingdom(state);
  return k ? k.stages : 3;
}
