/**
 * Простой UI-хелпер для рейд-петли (временно в main.ts, здесь для будущего разделения).
 * Экспортируем утилиты для рендера.
 */
import type { GameState } from '../core/types';
import { getCurrentKingdom, getTotalStages } from './raid';
import { RELICS } from '../content/relics';

export function getRaidStatusText(state: GameState): string {
  const k = getCurrentKingdom(state);
  if (!k) return 'Нет активного рейда';

  const total = getTotalStages(state);
  return `Рейд: ${k.name} — этап ${state.raid.stage} из ${total}`;
}

export function getRelicName(id: string): string {
  const r = RELICS.find((x) => x.id === id);
  return r ? r.name : id;
}
