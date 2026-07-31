/**
 * Синергии реликвий (S6, GDD §3.3).
 *
 * Два уровня:
 *  1. Комбо семейства — 2+ реликвии одного семейства (🔥/💰/🧙), усиливается на 4+.
 *  2. Именованные пары — по одной реликвии из двух разных семейств.
 *
 * Принцип GDD: синергии не подсказываются заранее — игрок открывает их сам,
 * активные показываются только после активации (см. `getActiveSynergies`).
 * Все эффекты — проценты (множители), а не раздувание чисел: контракт «≤ 1000».
 */

import type { ActiveSynergy, RelicFamily } from '../core/types';
import { getRelic } from '../content/relics';

/** Порог активации комбо семейства. */
export const FAMILY_THRESHOLD = 2;
/** Порог усиленного («великого») комбо семейства. */
export const FAMILY_GREAT_THRESHOLD = 4;

/** Описания комбо семейств: обычное (2+) и усиленное (4+). */
const FAMILY_COMBOS: Record<
  RelicFamily,
  { name: string; desc: string; damageMult: number; lootMult: number;
    great: { name: string; desc: string; damageMult: number; lootMult: number } }
> = {
  fire: {
    name: 'Пылающий след',
    desc: 'Дракон разогрелся: +25% урона.',
    damageMult: 0.25,
    lootMult: 0,
    great: {
      name: 'Огненная буря',
      desc: 'Четыре очага пламени сливаются в бурю: +60% урона.',
      damageMult: 0.6,
      lootMult: 0,
    },
  },
  greed: {
    name: 'Золотая лихорадка',
    desc: 'Каждая монета зовёт соседку: +30% добычи.',
    damageMult: 0,
    lootMult: 0.3,
    great: {
      name: 'Драконий аукцион',
      desc: 'Даже трон уходит с молотка: +75% добычи.',
      damageMult: 0,
      lootMult: 0.75,
    },
  },
  ally: {
    name: 'Крепкая дружба',
    desc: 'Слуги идут в бой строем: +20% урона и +10% добычи.',
    damageMult: 0.2,
    lootMult: 0.1,
    great: {
      name: 'Великий поход',
      desc: 'Вся пещера снялась с места: +45% урона и +25% добычи.',
      damageMult: 0.45,
      lootMult: 0.25,
    },
  },
};

/** Именованные пары «одно семейство + другое» (GDD §3.3). */
const PAIR_SYNERGIES: Array<{
  id: string;
  families: [RelicFamily, RelicFamily];
  name: string;
  desc: string;
  damageMult: number;
  lootMult: number;
}> = [
  {
    id: 'hot-coin',
    families: ['fire', 'greed'],
    name: 'Горячая монета',
    desc: 'Раскалённое золото никто не решается отобрать: +15% урона и +15% добычи.',
    damageMult: 0.15,
    lootMult: 0.15,
  },
  {
    id: 'mercenary-contract',
    families: ['greed', 'ally'],
    name: 'Наёмник на подряде',
    desc: 'Слугам заплатили вперёд — работают вдохновенно: +10% урона и +20% добычи.',
    damageMult: 0.1,
    lootMult: 0.2,
  },
  {
    id: 'torch-brigade',
    families: ['fire', 'ally'],
    name: 'Факельная бригада',
    desc: 'Союзники несут факелы и поют боевые частушки: +20% урона.',
    damageMult: 0.2,
    lootMult: 0,
  },
];

/** Сколько реликвий каждого семейства собрано в забеге. */
export function countFamilies(relicIds: string[]): Record<RelicFamily, number> {
  const counts: Record<RelicFamily, number> = { fire: 0, greed: 0, ally: 0 };
  for (const id of relicIds) {
    const relic = getRelic(id);
    if (relic) counts[relic.family] += 1;
  }
  return counts;
}

/**
 * Все активные синергии для набора реликвий.
 * Комбо семейства не дублируется: при 4+ выдаётся только усиленный вариант.
 */
export function getActiveSynergies(relicIds: string[]): ActiveSynergy[] {
  const counts = countFamilies(relicIds);
  const active: ActiveSynergy[] = [];

  (Object.keys(counts) as RelicFamily[]).forEach((family) => {
    const count = counts[family];
    const combo = FAMILY_COMBOS[family];
    if (count >= FAMILY_GREAT_THRESHOLD) {
      active.push({ id: `${family}-great`, ...combo.great });
    } else if (count >= FAMILY_THRESHOLD) {
      active.push({
        id: `${family}-combo`,
        name: combo.name,
        desc: combo.desc,
        damageMult: combo.damageMult,
        lootMult: combo.lootMult,
      });
    }
  });

  for (const pair of PAIR_SYNERGIES) {
    const [a, b] = pair.families;
    if (counts[a] >= 1 && counts[b] >= 1) {
      active.push({
        id: pair.id,
        name: pair.name,
        desc: pair.desc,
        damageMult: pair.damageMult,
        lootMult: pair.lootMult,
      });
    }
  }

  return active;
}

/** Итоговый множитель урона от синергий (1 = без бонусов). */
export function getDamageMultiplier(synergies: ActiveSynergy[]): number {
  return synergies.reduce((mult, s) => mult + s.damageMult, 1);
}

/** Итоговый множитель добычи от синергий (1 = без бонусов). */
export function getLootMultiplier(synergies: ActiveSynergy[]): number {
  return synergies.reduce((mult, s) => mult + s.lootMult, 1);
}

/** Полный список синергий для «коллекции» (открытые — с раскрытым описанием). */
export function listAllSynergyNames(): string[] {
  const families = (Object.keys(FAMILY_COMBOS) as RelicFamily[]).flatMap((f) => [
    FAMILY_COMBOS[f].name,
    FAMILY_COMBOS[f].great.name,
  ]);
  return [...families, ...PAIR_SYNERGIES.map((p) => p.name)];
}
