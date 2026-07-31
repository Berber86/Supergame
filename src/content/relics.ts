/**
 * Статичный контент: реликвии (GDD §3.3, MLP: 3 семейства, 12–15 шт.).
 * S6: у каждой реликвии числовые эффекты — `damage` (урон в рейде)
 * и `lootPct` (прибавка к добыче золота за победу, доля от 1).
 * Синергии (комбо семейств и именованные пары) — в `raid/synergies.ts`.
 */

import type { RelicDef, RelicFamily } from '../core/types';

export const RELICS: RelicDef[] = [
  // 🔥 Огонь — урон в рейде
  { id: 'ember', name: 'Уголёк-долгожитель', family: 'fire', effect: '+2 урона: тлеет с прошлого века', damage: 2, lootPct: 0 },
  { id: 'dragon-tea', name: 'Драконий чай', family: 'fire', effect: '+3 урона: боссы теряют терпение быстрее', damage: 3, lootPct: 0 },
  { id: 'charcoal-socks', name: 'Носки из угля', family: 'fire', effect: '+3 урона: греют лапы перед боем', damage: 3, lootPct: 0 },
  { id: 'fireworks', name: 'Фейерверк-в-коробке', family: 'fire', effect: '+4 урона, но очень шумно', damage: 4, lootPct: 0 },
  { id: 'lava-lamp', name: 'Лавовая лампа', family: 'fire', effect: '+5 урона и стильное освещение пещеры', damage: 5, lootPct: 0 },

  // 💰 Жадность — золото и добыча
  { id: 'golden-tooth', name: 'Золотой зуб', family: 'greed', effect: '+10% добычи: улыбка дороже слов', damage: 0, lootPct: 0.1 },
  { id: 'piggy-bank', name: 'Свинья-копилка', family: 'greed', effect: '+1 урон и +10% добычи (тяжёлая!)', damage: 1, lootPct: 0.1 },
  { id: 'magnet', name: 'Магнит для монет', family: 'greed', effect: '+15% добычи: монеты сами прилипают', damage: 0, lootPct: 0.15 },
  { id: 'royal-tax', name: 'Королевский налог', family: 'greed', effect: '+25% добычи, слуги ворчат', damage: 0, lootPct: 0.25 },
  { id: 'purse', name: 'Бездонный кошель', family: 'greed', effect: '+2 урона и +10% добычи', damage: 2, lootPct: 0.1 },

  // 🧙 Союзники — слуги и армия
  { id: 'whistle', name: 'Свисток бригадира', family: 'ally', effect: '+1 урон и +10% добычи: слуги бодрее', damage: 1, lootPct: 0.1 },
  { id: 'crown-of-servants', name: 'Корона слуг', family: 'ally', effect: '+2 урона и +5% добычи: слуги гордятся', damage: 2, lootPct: 0.05 },
  { id: 'tent', name: 'Походная палатка', family: 'ally', effect: '+3 урона: союзники высыпаются', damage: 3, lootPct: 0 },
  { id: 'friendship-bracelet', name: 'Браслет дружбы', family: 'ally', effect: '+3 урона: армия не ссорится в походе', damage: 3, lootPct: 0 },
  { id: 'megaphone', name: 'Мегафон', family: 'ally', effect: '+4 урона: речь перед боем пробирает', damage: 4, lootPct: 0 },
];

/** Быстрый доступ к реликвии по id. */
export function getRelic(id: string): RelicDef | undefined {
  return RELICS.find((r) => r.id === id);
}

/** Человекочитаемые названия семейств (для UI). */
export const FAMILY_NAMES: Record<RelicFamily, string> = {
  fire: '🔥 Огонь',
  greed: '💰 Жадность',
  ally: '🧙 Союзники',
};
