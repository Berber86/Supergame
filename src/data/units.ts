import type { Role } from '../entities/types';

/** Шаблон тестового юнита (одна эпоха — Каменный век). */
export interface UnitTemplate {
  id: string;
  name: string;
  role: Role;
  hp: number;
  atk: number;
  def: number;
  atkSpeed: number; // атак в секунду
  range: number; // дальность в гексах
  move: number; // скорость: гексов в секунду
  description?: string;
}

/**
 * 9 тестовых юнитов Каменного века.
 * Роли: 2 танка, 2 melee-dps, 2 ranged, 1 support, 1 cavalry, 1 heavy.
 */
export const STONE_AGE_UNITS: UnitTemplate[] = [
  {
    id: 'guardian',
    name: 'Племенной Страж',
    role: 'tank',
    hp: 140,
    atk: 12,
    def: 14,
    atkSpeed: 0.6,
    range: 1,
    move: 1,
    description: 'Громоздкий боец с дубиной, держит удар.',
  },
  {
    id: 'boneshield',
    name: 'Носитель Костяного Щита',
    role: 'tank',
    hp: 155,
    atk: 10,
    def: 17,
    atkSpeed: 0.6,
    range: 1,
    move: 1,
    description: 'Самый живучий, бьёт слабо.',
  },
  {
    id: 'spearhunter',
    name: 'Охотник с Копьем',
    role: 'melee',
    hp: 90,
    atk: 18,
    def: 6,
    atkSpeed: 0.9,
    range: 1,
    move: 2,
    description: 'Сбалансированный ближний боец.',
  },
  {
    id: 'flintaxe',
    name: 'Воин Кремнёвого Топора',
    role: 'melee',
    hp: 100,
    atk: 23,
    def: 8,
    atkSpeed: 0.8,
    range: 1,
    move: 2,
    description: 'Высокий урон в ближнем бою.',
  },
  {
    id: 'sling',
    name: 'Пращник',
    role: 'ranged',
    hp: 60,
    atk: 16,
    def: 3,
    atkSpeed: 0.7,
    range: 3,
    move: 2,
    description: 'Бьёт издалека, кайтит в ближнем бою.',
  },
  {
    id: 'atlatl',
    name: 'Метатель Дротиков',
    role: 'ranged',
    hp: 55,
    atk: 15,
    def: 3,
    atkSpeed: 0.85,
    range: 4,
    move: 2,
    description: 'Самая большая дальность, хрупкий.',
  },
  {
    id: 'shaman',
    name: 'Шаман Племени',
    role: 'support',
    hp: 70,
    atk: 6,
    def: 4,
    atkSpeed: 0.5,
    range: 2,
    move: 1,
    description: 'Держится позади, лечит раненых союзников.',
  },
  {
    id: 'wolfrider',
    name: 'Наездник на Волке',
    role: 'cavalry',
    hp: 95,
    atk: 20,
    def: 7,
    atkSpeed: 1.0,
    range: 1,
    move: 4,
    description: 'Очень быстрый, заходит во фланг.',
  },
  {
    id: 'mammoth',
    name: 'Гонщик Мамонта',
    role: 'heavy',
    hp: 185,
    atk: 27,
    def: 12,
    atkSpeed: 0.5,
    range: 1,
    move: 1,
    description: 'Огромный и медленный, давит всё на пути.',
  },
];

/** Визуальная информация по ролям (используется UI). */
export const ROLE_INFO: Record<Role, { label: string; color: number; letter: string }> = {
  tank: { label: 'Танк', color: 0xfbbf24, letter: 'Т' },
  melee: { label: 'Боец', color: 0xf97316, letter: 'Б' },
  ranged: { label: 'Стрелок', color: 0x22d3ee, letter: 'С' },
  support: { label: 'Шаман', color: 0xa3e635, letter: 'Ш' },
  cavalry: { label: 'Кавалерия', color: 0xe879f9, letter: 'К' },
  heavy: { label: 'Тяжёлый', color: 0xd1d5db, letter: 'Ж' },
};

/**
 * Заранее заданный тестовый набор врагов (зона врага, правые 3 колонки).
 * Используется как при расстановке (превью), так и в бою.
 */
export const ENEMY_LINEUP: ReadonlyArray<{ templateId: string; col: number; row: number }> = [
  { templateId: 'guardian', col: 10, row: 1 },
  { templateId: 'boneshield', col: 10, row: 4 },
  { templateId: 'spearhunter', col: 9, row: 0 },
  { templateId: 'flintaxe', col: 9, row: 6 },
  { templateId: 'sling', col: 8, row: 2 },
  { templateId: 'wolfrider', col: 9, row: 3 },
];

export function findTemplate(id: string): UnitTemplate {
  const t = STONE_AGE_UNITS.find((u) => u.id === id);
  if (!t) throw new Error(`Unknown unit template: ${id}`);
  return t;
}
