/**
 * Статичный контент: реликвии (GDD §3.3, MLP: 3 семейства, 12–15 шт.).
 * Синергии: 2+ реликвии одного семейства активируют комбо-эффект
 * семейства; пары из разных семейств — именованные синергии (raid/synergies.ts).
 */

import type { RelicDef, RelicFamily } from '../core/types';

export const RELICS: RelicDef[] = [
  // 🔥 Огонь — урон в рейде
  { id: 'ember', name: 'Уголёк-долгожитель', family: 'fire', effect: '+1 урон в рейде' },
  { id: 'dragon-tea', name: 'Драконий чай', family: 'fire', effect: 'Боссы теряют терпение быстрее (+2 урон)' },
  { id: 'charcoal-socks', name: 'Носки из угля', family: 'fire', effect: 'Греют лапы: +2 урон' },
  { id: 'fireworks', name: 'Фейерверк-в-коробке', family: 'fire', effect: '+3 урон, но очень шумно' },
  { id: 'lava-lamp', name: 'Лавовая лампа', family: 'fire', effect: '+4 урон, стильно освещает пещеру' },

  // 💰 Жадность — золото и экономика
  { id: 'golden-tooth', name: 'Золотой зуб', family: 'greed', effect: '+10% дохода слуг' },
  { id: 'piggy-bank', name: 'Свинья-копилка', family: 'greed', effect: '+1 золото за клик' },
  { id: 'magnet', name: 'Магнит для монет', family: 'greed', effect: '+15% дохода слуг' },
  { id: 'royal-tax', name: 'Королевский налог', family: 'greed', effect: '+25% дохода, слуги ворчат' },
  { id: 'purse', name: 'Бездонный кошель', family: 'greed', effect: '+1 золото за клик и +5% дохода' },

  // 🧙 Союзники — слуги и армия
  { id: 'whistle', name: 'Свисток бригадира', family: 'ally', effect: 'Слуги работают быстрее (+10% дохода)' },
  { id: 'crown-of-servants', name: 'Корона слуг', family: 'ally', effect: 'Слуги гордятся: +2 урон и +5% дохода' },
  { id: 'tent', name: 'Походная палатка', family: 'ally', effect: 'Союзники высыпаются: +2 урон' },
  { id: 'friendship-bracelet', name: 'Браслет дружбы', family: 'ally', effect: 'Армия не ссорится: +3 урон' },
  { id: 'megaphone', name: 'Мегафон', family: 'ally', effect: 'Речь перед боем: +4 урон' },
];

/** Комбо-эффекты семейств (2+ реликвии семейства в забеге). */
export const FAMILY_COMBOS: Record<RelicFamily, string> = {
  fire: 'Пылающий след: +5 урона',
  greed: 'Золотая лихорадка: +50% дохода слуг',
  ally: 'Крепкая дружба: +5 урона и +25% дохода',
};
