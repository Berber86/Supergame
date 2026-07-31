/**
 * Рейд-петля (S5 v1 + S6: синергии и баланс).
 * Полный цикл: снаряжение → этапы с выбором реликвий → босс → победа/поражение → возврат.
 *
 * Связь двух петель (митигация риска GDD §5.5): сила рейда зависит от пещеры
 * (слуги, здания, уровень дракона), а синергии реликвий дают проценты — не раздувая числа.
 */

import type { ActiveSynergy, GameState, KingdomDef, RaidPower, RelicDef } from '../core/types';
import { RELICS, getRelic } from '../content/relics';
import { KINGDOMS } from '../content/kingdoms';
import { clampGold } from '../economy/pacing';
import { getActiveSynergies, getDamageMultiplier, getLootMultiplier } from './synergies';

/** Базовый урон дракона без пещеры и реликвий. */
export const BASE_DAMAGE = 8;
/** Сколько карточек предлагается на этапе (GDD: 2–3). */
export const OFFER_SIZE = 3;

/** Королевство по id. */
export function getKingdom(id: string | null): KingdomDef | null {
  if (!id) return null;
  return KINGDOMS.find((k) => k.id === id) ?? null;
}

/** Сила пещеры: слуги и здания реально идут в бой. */
export function getCavePower(state: GameState): number {
  const servants = state.servants.reduce((sum, s) => sum + s.count, 0);
  const buildings = state.buildings.reduce((sum, b) => sum + b.level, 0);
  return servants + buildings * 2 + (state.dragonLevel - 1) * 2;
}

/** Можно ли начать новый рейд? */
export function canStartRaid(state: GameState): boolean {
  return state.raid.kingdomId === null;
}

/** Хватает ли золота на снаряжение рейда. */
export function canAffordRaid(state: GameState, kingdomId: string): boolean {
  const kingdom = getKingdom(kingdomId);
  return !!kingdom && state.gold >= kingdom.cost;
}

/** Начать рейд на королевство (тратит золото на снаряжение). */
export function startRaid(state: GameState, kingdomId: string): boolean {
  if (!canStartRaid(state)) return false;

  const kingdom = getKingdom(kingdomId);
  if (!kingdom) return false;
  if (state.gold < kingdom.cost) return false;

  state.gold = Math.max(0, state.gold - kingdom.cost);
  state.raid = { kingdomId, stage: 1, relics: [], offer: [], atBoss: false };
  rollOffer(state);

  addJournal(state, `Фламберг снарядился за ${kingdom.cost} золота и вылетел на «${kingdom.name}»!`);
  return true;
}

/** Сформировать предложение реликвий на текущем этапе (фиксируется в состоянии). */
export function rollOffer(state: GameState): RelicDef[] {
  if (!state.raid.kingdomId || state.raid.atBoss) {
    state.raid.offer = [];
    return [];
  }

  const used = new Set(state.raid.relics);
  const pool = RELICS.filter((r) => !used.has(r.id));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  state.raid.offer = shuffled.slice(0, OFFER_SIZE).map((r) => r.id);
  return getStageRelicChoices(state);
}

/** Реликвии, предложенные на текущем этапе. */
export function getStageRelicChoices(state: GameState): RelicDef[] {
  return state.raid.offer
    .map((id) => getRelic(id))
    .filter((r): r is RelicDef => r !== undefined);
}

/** Выбрать реликвию на этапе; продвигает этап или выводит к боссу. */
export function chooseRelic(state: GameState, relicId: string): boolean {
  if (!state.raid.kingdomId || state.raid.atBoss) return false;
  if (!state.raid.offer.includes(relicId)) return false;
  if (state.raid.relics.includes(relicId)) return false;

  const relic = getRelic(relicId);
  if (!relic) return false;

  state.raid.relics.push(relicId);
  if (!state.relics.includes(relicId)) state.relics.push(relicId); // коллекция навсегда

  const total = getTotalStages(state);
  if (state.raid.stage < total) {
    state.raid.stage += 1;
    rollOffer(state);
  } else {
    state.raid.atBoss = true;
    state.raid.offer = [];
  }

  addJournal(state, `Подобрана реликвия: ${relic.name}.`);
  return true;
}

/** Расчёт силы рейда с учётом синергий (чистая функция — тестируется). */
export function computeRaidPower(state: GameState): RaidPower {
  const base = BASE_DAMAGE + getCavePower(state);
  const fromRelics = state.raid.relics.reduce((sum, id) => sum + (getRelic(id)?.damage ?? 0), 0);
  const synergies: ActiveSynergy[] = getActiveSynergies(state.raid.relics);
  const multiplier = getDamageMultiplier(synergies);
  const damage = Math.floor((base + fromRelics) * multiplier);
  return { base, fromRelics, multiplier, damage, synergies };
}

/** Добыча за победу с учётом реликвий и синергий. */
export function computeLoot(state: GameState, kingdom: KingdomDef): number {
  const relicPct = state.raid.relics.reduce((sum, id) => sum + (getRelic(id)?.lootPct ?? 0), 0);
  const synergyMult = getLootMultiplier(getActiveSynergies(state.raid.relics));
  return Math.floor(kingdom.loot * (1 + relicPct) * synergyMult);
}

/** Результат боя с боссом. */
export interface BossResult {
  win: boolean;
  damageDealt: number;
  bossHp: number;
  remainingHp: number;
  loot: number;
  goldLost: number;
  synergies: ActiveSynergy[];
  /** Захвачены все королевства — победа в игре. */
  allKingdomsTaken: boolean;
}

/** Бой с боссом: завершает рейд победой или поражением. */
export function resolveBoss(state: GameState): BossResult {
  const kingdom = getKingdom(state.raid.kingdomId);
  if (!kingdom) {
    return {
      win: false, damageDealt: 0, bossHp: 0, remainingHp: 0,
      loot: 0, goldLost: 0, synergies: [], allKingdomsTaken: false,
    };
  }

  const power = computeRaidPower(state);
  const remaining = Math.max(0, kingdom.bossHp - power.damage);
  const win = remaining <= 0;

  let loot = 0;
  let goldLost = 0;

  if (win) {
    loot = computeLoot(state, kingdom);
    state.gold = clampGold(state.gold + loot);
    state.kingdomProgress[kingdom.id] = true;
    addJournal(state, `Победа над «${kingdom.boss}»! Захвачено «${kingdom.name}», добыча — ${loot} золота.`);
  } else {
    goldLost = Math.floor(state.gold * 0.15);
    state.gold = Math.max(0, state.gold - goldLost);
    addJournal(
      state,
      `«${kingdom.boss}» устоял (${remaining} HP осталось). Дракон вернулся домой и потерял ${goldLost} золота.`,
    );
  }

  const allKingdomsTaken = isVictory(state);
  if (win && allKingdomsTaken) {
    addJournal(state, 'Все три королевства в коллекции. Фламберг — Повелитель Области!');
  }

  endRaid(state);
  return {
    win,
    damageDealt: power.damage,
    bossHp: kingdom.bossHp,
    remainingHp: remaining,
    loot,
    goldLost,
    synergies: power.synergies,
    allKingdomsTaken,
  };
}

/** Отступить из рейда без боя (реликвии остаются в коллекции). */
export function retreat(state: GameState): void {
  const kingdom = getKingdom(state.raid.kingdomId);
  if (kingdom) addJournal(state, `Фламберг передумал и улетел из «${kingdom.name}». Бывает.`);
  endRaid(state);
}

/** Завершить текущий рейд (очистить состояние рейда). */
export function endRaid(state: GameState): void {
  state.raid = { kingdomId: null, stage: 0, relics: [], offer: [], atBoss: false };
}

/** Текущее королевство рейда (или null). */
export function getCurrentKingdom(state: GameState): KingdomDef | null {
  return getKingdom(state.raid.kingdomId);
}

/** Сколько этапов всего у текущего королевства. */
export function getTotalStages(state: GameState): number {
  return getCurrentKingdom(state)?.stages ?? 3;
}

/** Все ли королевства захвачены (условие победы MLP). */
export function isVictory(state: GameState): boolean {
  return KINGDOMS.every((k) => state.kingdomProgress[k.id] === true);
}

function addJournal(state: GameState, text: string): void {
  state.journal.unshift(text);
  state.journal = state.journal.slice(0, 20);
}
