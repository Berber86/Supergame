/**
 * Хелперы рендера рейда: текстовые представления без обращения к DOM.
 * Держим их отдельно от логики (`raid.ts`) и от `main.ts` — так main не пухнет.
 */

import type { ActiveSynergy, GameState } from '../core/types';
import { getCurrentKingdom, getTotalStages } from './raid';
import { getRelic, FAMILY_NAMES } from '../content/relics';

export function getRaidStatusText(state: GameState): string {
  const kingdom = getCurrentKingdom(state);
  if (!kingdom) return 'Нет активного рейда';
  if (state.raid.atBoss) return `Рейд: ${kingdom.name} — логово босса`;
  return `Рейд: ${kingdom.name} — этап ${state.raid.stage} из ${getTotalStages(state)}`;
}

export function getRelicName(id: string): string {
  return getRelic(id)?.name ?? id;
}

export function getRelicLabel(id: string): string {
  const relic = getRelic(id);
  if (!relic) return id;
  return `${FAMILY_NAMES[relic.family]} ${relic.name}`;
}

/** Строка вида «+45% урона, +30% добычи» для активной синергии. */
export function formatSynergyBonus(synergy: ActiveSynergy): string {
  const parts: string[] = [];
  if (synergy.damageMult > 0) parts.push(`+${Math.round(synergy.damageMult * 100)}% урона`);
  if (synergy.lootMult > 0) parts.push(`+${Math.round(synergy.lootMult * 100)}% добычи`);
  return parts.join(', ');
}
