import type { Role } from '../entities/types';
import type { UnitTemplate } from './units';

export type EvolutionLine = 'Infantry' | 'Ranged' | 'Cavalry' | 'Siege' | 'Support';

export interface EvolutionNode {
  id: string; // template ID
  name: string;
  line: EvolutionLine;
  epoch: number; // 1 to 8
  role: Role;
  hp: number;
  atk: number;
  def: number;
  atkSpeed: number;
  range: number;
  move: number;
  description: string;
  nextNodes: string[]; // target template IDs in the next epoch
  evolutionCost: number; // cost to evolve TO this node from previous epoch (0 for epoch 1)
}

// Порог опыта для эволюции в зависимости от ТЕКУЩЕЙ эпохи юнита
export function getEvolutionThreshold(epoch: number): number {
  // Например: Эпоха 1 -> нужно 2 XP, Эпоха 2 -> 4 XP, Эпоха 3 -> 6 XP, и т.д.
  return epoch * 2;
}

export const EVOLUTION_TREE_NODES: EvolutionNode[] = [
  // ==========================================
  // EPOCH 1 (Каменный век - Плейсхолдеры из STONE_AGE_UNITS)
  // ==========================================
  {
    id: 'guardian',
    name: 'Племенной Страж',
    line: 'Infantry',
    epoch: 1,
    role: 'tank',
    hp: 140,
    atk: 12,
    def: 14,
    atkSpeed: 0.6,
    range: 1,
    move: 1,
    description: 'Громоздкий боец с дубиной, держит удар.',
    nextNodes: ['bronze_swordsman', 'bronze_phalanx'],
    evolutionCost: 0,
  },
  {
    id: 'spearhunter',
    name: 'Охотник с Копьем',
    line: 'Infantry',
    epoch: 1,
    role: 'melee',
    hp: 90,
    atk: 18,
    def: 6,
    atkSpeed: 0.9,
    range: 1,
    move: 2,
    description: 'Сбалансированный ближний боец.',
    nextNodes: ['bronze_swordsman', 'bronze_phalanx'],
    evolutionCost: 0,
  },
  {
    id: 'sling',
    name: 'Пращник',
    line: 'Ranged',
    epoch: 1,
    role: 'ranged',
    hp: 60,
    atk: 16,
    def: 3,
    atkSpeed: 0.7,
    range: 3,
    move: 2,
    description: 'Бьёт издалека, кайтит в ближнем бою.',
    nextNodes: ['composite_bowman', 'bronze_skirmisher'],
    evolutionCost: 0,
  },
  {
    id: 'atlatl',
    name: 'Метатель Дротиков',
    line: 'Ranged',
    epoch: 1,
    role: 'ranged',
    hp: 55,
    atk: 15,
    def: 3,
    atkSpeed: 0.85,
    range: 4,
    move: 2,
    description: 'Самая большая дальность, хрупкий.',
    nextNodes: ['composite_bowman', 'bronze_skirmisher'],
    evolutionCost: 0,
  },
  {
    id: 'wolfrider',
    name: 'Наездник на Волке',
    line: 'Cavalry',
    epoch: 1,
    role: 'cavalry',
    hp: 95,
    atk: 20,
    def: 7,
    atkSpeed: 1.0,
    range: 1,
    move: 4,
    description: 'Очень быстрый, заходит во фланг.',
    nextNodes: ['chariot_rider', 'nomad_horseman'],
    evolutionCost: 0,
  },
  {
    id: 'flintaxe',
    name: 'Воин Кремнёвого Топора',
    line: 'Cavalry',
    epoch: 1,
    role: 'melee',
    hp: 100,
    atk: 23,
    def: 8,
    atkSpeed: 0.8,
    range: 1,
    move: 2,
    description: 'Высокий урон в ближнем бою.',
    nextNodes: ['chariot_rider', 'nomad_horseman'],
    evolutionCost: 0,
  },
  {
    id: 'shaman',
    name: 'Шаман Племени',
    line: 'Support',
    epoch: 1,
    role: 'support',
    hp: 70,
    atk: 6,
    def: 4,
    atkSpeed: 0.5,
    range: 2,
    move: 1,
    description: 'Держится позади, лечит раненых союзников.',
    nextNodes: ['bronze_cleric', 'herbalist'],
    evolutionCost: 0,
  },
  {
    id: 'boneshield',
    name: 'Носитель Костяного Щита',
    line: 'Support',
    epoch: 1,
    role: 'tank',
    hp: 155,
    atk: 10,
    def: 17,
    atkSpeed: 0.6,
    range: 1,
    move: 1,
    description: 'Самый живучий, защищает соратников.',
    nextNodes: ['bronze_cleric', 'herbalist'],
    evolutionCost: 0,
  },
  {
    id: 'mammoth',
    name: 'Гонщик Мамонта',
    line: 'Siege',
    epoch: 1,
    role: 'heavy',
    hp: 185,
    atk: 27,
    def: 12,
    atkSpeed: 0.5,
    range: 1,
    move: 1,
    description: 'Огромный и медленный, давит всё на пути.',
    nextNodes: ['bronze_ballista'],
    evolutionCost: 0,
  },

  // ==========================================
  // EPOCH 2 (Бронзовый век)
  // ==========================================
  {
    id: 'bronze_swordsman',
    name: 'Бронзовый Мечник',
    line: 'Infantry',
    epoch: 2,
    role: 'melee',
    hp: 130,
    atk: 30,
    def: 12,
    atkSpeed: 0.9,
    range: 1,
    move: 2,
    description: 'Превосходная наступательная сила Бронзового века.',
    nextNodes: ['iron_legionary', 'iron_berserker'],
    evolutionCost: 45,
  },
  {
    id: 'bronze_phalanx',
    name: 'Бронзовый Фалангист',
    line: 'Infantry',
    epoch: 2,
    role: 'tank',
    hp: 190,
    atk: 18,
    def: 22,
    atkSpeed: 0.7,
    range: 1,
    move: 1,
    description: 'Непробиваемая стена щитов и крепкая броня.',
    nextNodes: ['iron_legionary', 'iron_berserker'],
    evolutionCost: 45,
  },
  {
    id: 'composite_bowman',
    name: 'Сложный Лучник',
    line: 'Ranged',
    epoch: 2,
    role: 'ranged',
    hp: 80,
    atk: 22,
    def: 6,
    atkSpeed: 0.8,
    range: 4,
    move: 2,
    description: 'Большая дальность стрельбы благодаря составному луку.',
    nextNodes: ['iron_crossbowman', 'longbowman'],
    evolutionCost: 45,
  },
  {
    id: 'bronze_skirmisher',
    name: 'Бронзовый Застрельщик',
    line: 'Ranged',
    epoch: 2,
    role: 'ranged',
    hp: 95,
    atk: 25,
    def: 10,
    atkSpeed: 0.9,
    range: 3,
    move: 2,
    description: 'Быстрый стрелок с метательными дротиками и щитом.',
    nextNodes: ['iron_crossbowman', 'longbowman'],
    evolutionCost: 45,
  },
  {
    id: 'chariot_rider',
    name: 'Колесничий',
    line: 'Cavalry',
    epoch: 2,
    role: 'cavalry',
    hp: 140,
    atk: 28,
    def: 12,
    atkSpeed: 1.0,
    range: 1,
    move: 3,
    description: 'Элитный экипаж, разрывающий фланги врага.',
    nextNodes: ['iron_cataphract', 'knight_errant'],
    evolutionCost: 45,
  },
  {
    id: 'nomad_horseman',
    name: 'Всадник-Номад',
    line: 'Cavalry',
    epoch: 2,
    role: 'cavalry',
    hp: 115,
    atk: 24,
    def: 8,
    atkSpeed: 1.1,
    range: 2,
    move: 4,
    description: 'Быстрый и маневренный конный лучник.',
    nextNodes: ['iron_cataphract', 'knight_errant'],
    evolutionCost: 45,
  },
  {
    id: 'bronze_cleric',
    name: 'Бронзовый Клирик',
    line: 'Support',
    epoch: 2,
    role: 'support',
    hp: 100,
    atk: 10,
    def: 8,
    atkSpeed: 0.6,
    range: 2,
    move: 2,
    description: 'Священник, вдохновляющий союзников и исцеляющий раны.',
    nextNodes: ['iron_inquisitor', 'templar_medic'],
    evolutionCost: 45,
  },
  {
    id: 'herbalist',
    name: 'Травник',
    line: 'Support',
    epoch: 2,
    role: 'support',
    hp: 90,
    atk: 8,
    def: 6,
    atkSpeed: 0.7,
    range: 3,
    move: 2,
    description: 'Опытный лекарь, использующий целебные снадобья.',
    nextNodes: ['iron_inquisitor', 'templar_medic'],
    evolutionCost: 45,
  },
  {
    id: 'bronze_ballista',
    name: 'Бронзовая Баллиста',
    line: 'Siege',
    epoch: 2,
    role: 'heavy',
    hp: 150,
    atk: 40,
    def: 15,
    atkSpeed: 0.4,
    range: 4,
    move: 1,
    description: 'Мощное орудие, стреляющее огромными болтами.',
    nextNodes: ['iron_catapult'],
    evolutionCost: 45,
  },

  // ==========================================
  // EPOCH 3 (Железный век)
  // ==========================================
  {
    id: 'iron_legionary',
    name: 'Имперский Легионер',
    line: 'Infantry',
    epoch: 3,
    role: 'tank',
    hp: 240,
    atk: 25,
    def: 30,
    atkSpeed: 0.8,
    range: 1,
    move: 1,
    description: 'Тяжелобронированный гвардеец со стальным щитом.',
    nextNodes: ['inf_4_a', 'inf_4_b'],
    evolutionCost: 80,
  },
  {
    id: 'iron_berserker',
    name: 'Неистовый Берсерк',
    line: 'Infantry',
    epoch: 3,
    role: 'melee',
    hp: 170,
    atk: 42,
    def: 15,
    atkSpeed: 1.0,
    range: 1,
    move: 2,
    description: 'Неистовый воин с двуручным боевым топором.',
    nextNodes: ['inf_4_a', 'inf_4_b'],
    evolutionCost: 80,
  },
  {
    id: 'iron_crossbowman',
    name: 'Тяжёлый Арбалетчик',
    line: 'Ranged',
    epoch: 3,
    role: 'ranged',
    hp: 120,
    atk: 38,
    def: 14,
    atkSpeed: 0.6,
    range: 4,
    move: 2,
    description: 'Высокая пробивная сила благодаря стальной тетиве.',
    nextNodes: ['ran_4_a', 'ran_4_b'],
    evolutionCost: 80,
  },
  {
    id: 'longbowman',
    name: 'Длиннолучник',
    line: 'Ranged',
    epoch: 3,
    role: 'ranged',
    hp: 100,
    atk: 32,
    def: 8,
    atkSpeed: 0.9,
    range: 5,
    move: 2,
    description: 'Стрелок легендарной дальности, засыпающий врагов стрелами.',
    nextNodes: ['ran_4_a', 'ran_4_b'],
    evolutionCost: 80,
  },
  {
    id: 'iron_cataphract',
    name: 'Панцирный Катафрактарий',
    line: 'Cavalry',
    epoch: 3,
    role: 'cavalry',
    hp: 200,
    atk: 35,
    def: 20,
    atkSpeed: 0.8,
    range: 1,
    move: 3,
    description: 'Кавалерия, закованная в тяжёлые латы с головы до ног.',
    nextNodes: ['cav_4_a', 'cav_4_b'],
    evolutionCost: 80,
  },
  {
    id: 'knight_errant',
    name: 'Странствующий Рыцарь',
    line: 'Cavalry',
    epoch: 3,
    role: 'cavalry',
    hp: 160,
    atk: 45,
    def: 14,
    atkSpeed: 1.1,
    range: 1,
    move: 4,
    description: 'Благородный всадник с мощным копьём для сокрушения строя.',
    nextNodes: ['cav_4_a', 'cav_4_b'],
    evolutionCost: 80,
  },
  {
    id: 'iron_inquisitor',
    name: 'Верховный Инквизитор',
    line: 'Support',
    epoch: 3,
    role: 'support',
    hp: 140,
    atk: 18,
    def: 12,
    atkSpeed: 0.7,
    range: 2,
    move: 2,
    description: 'Фанатичный священник, карающий врагов и лечащий праведных.',
    nextNodes: ['sup_4_a', 'sup_4_b'],
    evolutionCost: 80,
  },
  {
    id: 'templar_medic',
    name: 'Рыцарь-Медик',
    line: 'Support',
    epoch: 3,
    role: 'support',
    hp: 130,
    atk: 12,
    def: 16,
    atkSpeed: 0.7,
    range: 2,
    move: 2,
    description: 'Бронированный целитель, спасающий жизни на передовой.',
    nextNodes: ['sup_4_a', 'sup_4_b'],
    evolutionCost: 80,
  },
  {
    id: 'iron_catapult',
    name: 'Осадная Катапульта',
    line: 'Siege',
    epoch: 3,
    role: 'heavy',
    hp: 200,
    atk: 60,
    def: 22,
    atkSpeed: 0.35,
    range: 5,
    move: 1,
    description: 'Мощная осадная машина для обрушения укреплений.',
    nextNodes: ['sie_4'],
    evolutionCost: 80,
  },

  // ==========================================
  // EPOCH 4 (Минимальные заглушки)
  // ==========================================
  {
    id: 'inf_4_a', name: 'Пехотинец Эпохи 4 (А)', line: 'Infantry', epoch: 4, role: 'melee',
    hp: 280, atk: 50, def: 25, atkSpeed: 1.0, range: 1, move: 2,
    description: 'Заглушка юнита Эпохи 4 ветки А', nextNodes: ['inf_5_a', 'inf_5_b'], evolutionCost: 120
  },
  {
    id: 'inf_4_b', name: 'Пехотинец Эпохи 4 (Б)', line: 'Infantry', epoch: 4, role: 'tank',
    hp: 350, atk: 30, def: 40, atkSpeed: 0.8, range: 1, move: 1,
    description: 'Заглушка юнита Эпохи 4 ветки Б', nextNodes: ['inf_5_a', 'inf_5_b'], evolutionCost: 120
  },
  {
    id: 'ran_4_a', name: 'Стрелок Эпохи 4 (А)', line: 'Ranged', epoch: 4, role: 'ranged',
    hp: 150, atk: 45, def: 12, atkSpeed: 0.9, range: 4, move: 2,
    description: 'Заглушка стрелка Эпохи 4 ветки А', nextNodes: ['ran_5_a', 'ran_5_b'], evolutionCost: 120
  },
  {
    id: 'ran_4_b', name: 'Стрелок Эпохи 4 (Б)', line: 'Ranged', epoch: 4, role: 'ranged',
    hp: 130, atk: 40, def: 10, atkSpeed: 1.1, range: 5, move: 2,
    description: 'Заглушка стрелка Эпохи 4 ветки Б', nextNodes: ['ran_5_a', 'ran_5_b'], evolutionCost: 120
  },
  {
    id: 'cav_4_a', name: 'Всадник Эпохи 4 (А)', line: 'Cavalry', epoch: 4, role: 'cavalry',
    hp: 240, atk: 55, def: 22, atkSpeed: 1.0, range: 1, move: 4,
    description: 'Заглушка всадника Эпохи 4 ветки А', nextNodes: ['cav_5_a', 'cav_5_b'], evolutionCost: 120
  },
  {
    id: 'cav_4_b', name: 'Всадник Эпохи 4 (Б)', line: 'Cavalry', epoch: 4, role: 'cavalry',
    hp: 210, atk: 48, def: 18, atkSpeed: 1.2, range: 2, move: 4,
    description: 'Заглушка всадника Эпохи 4 ветки Б', nextNodes: ['cav_5_a', 'cav_5_b'], evolutionCost: 120
  },
  {
    id: 'sup_4_a', name: 'Поддержка Эпохи 4 (А)', line: 'Support', epoch: 4, role: 'support',
    hp: 180, atk: 22, def: 16, atkSpeed: 0.8, range: 2, move: 2,
    description: 'Заглушка поддержки Эпохи 4 ветки А', nextNodes: ['sup_5_a', 'sup_5_b'], evolutionCost: 120
  },
  {
    id: 'sup_4_b', name: 'Поддержка Эпохи 4 (Б)', line: 'Support', epoch: 4, role: 'support',
    hp: 160, atk: 18, def: 14, atkSpeed: 0.9, range: 3, move: 2,
    description: 'Заглушка поддержки Эпохи 4 ветки Б', nextNodes: ['sup_5_a', 'sup_5_b'], evolutionCost: 120
  },
  {
    id: 'sie_4', name: 'Осада Эпохи 4', line: 'Siege', epoch: 4, role: 'heavy',
    hp: 280, atk: 85, def: 28, atkSpeed: 0.4, range: 5, move: 1,
    description: 'Заглушка осадной машины Эпохи 4', nextNodes: ['sie_5'], evolutionCost: 120
  },

  // ==========================================
  // EPOCH 5 (Минимальные заглушки)
  // ==========================================
  {
    id: 'inf_5_a', name: 'Пехотинец Эпохи 5 (А)', line: 'Infantry', epoch: 5, role: 'melee',
    hp: 380, atk: 70, def: 35, atkSpeed: 1.0, range: 1, move: 2,
    description: 'Заглушка юнита Эпохи 5 ветки А', nextNodes: ['inf_6_a', 'inf_6_b'], evolutionCost: 185
  },
  {
    id: 'inf_5_b', name: 'Пехотинец Эпохи 5 (Б)', line: 'Infantry', epoch: 5, role: 'tank',
    hp: 480, atk: 45, def: 55, atkSpeed: 0.8, range: 1, move: 1,
    description: 'Заглушка юнита Эпохи 5 ветки Б', nextNodes: ['inf_6_a', 'inf_6_b'], evolutionCost: 185
  },
  {
    id: 'ran_5_a', name: 'Стрелок Эпохи 5 (А)', line: 'Ranged', epoch: 5, role: 'ranged',
    hp: 200, atk: 65, def: 16, atkSpeed: 1.0, range: 4, move: 2,
    description: 'Заглушка стрелка Эпохи 5 ветки А', nextNodes: ['ran_6_a', 'ran_6_b'], evolutionCost: 185
  },
  {
    id: 'ran_5_b', name: 'Стрелок Эпохи 5 (Б)', line: 'Ranged', epoch: 5, role: 'ranged',
    hp: 170, atk: 58, def: 14, atkSpeed: 1.2, range: 5, move: 2,
    description: 'Заглушка стрелка Эпохи 5 ветки Б', nextNodes: ['ran_6_a', 'ran_6_b'], evolutionCost: 185
  },
  {
    id: 'cav_5_a', name: 'Всадник Эпохи 5 (А)', line: 'Cavalry', epoch: 5, role: 'cavalry',
    hp: 330, atk: 75, def: 30, atkSpeed: 1.0, range: 1, move: 4,
    description: 'Заглушка всадника Эпохи 5 ветки А', nextNodes: ['cav_6_a', 'cav_6_b'], evolutionCost: 185
  },
  {
    id: 'cav_5_b', name: 'Всадник Эпохи 5 (Б)', line: 'Cavalry', epoch: 5, role: 'cavalry',
    hp: 290, atk: 65, def: 24, atkSpeed: 1.2, range: 2, move: 4,
    description: 'Заглушка всадника Эпохи 5 ветки Б', nextNodes: ['cav_6_a', 'cav_6_b'], evolutionCost: 185
  },
  {
    id: 'sup_5_a', name: 'Поддержка Эпохи 5 (А)', line: 'Support', epoch: 5, role: 'support',
    hp: 240, atk: 30, def: 22, atkSpeed: 0.8, range: 2, move: 2,
    description: 'Заглушка поддержки Эпохи 5 ветки А', nextNodes: ['sup_6_a', 'sup_6_b'], evolutionCost: 185
  },
  {
    id: 'sup_5_b', name: 'Поддержка Эпохи 5 (Б)', line: 'Support', epoch: 5, role: 'support',
    hp: 210, atk: 25, def: 18, atkSpeed: 0.9, range: 3, move: 2,
    description: 'Заглушка поддержки Эпохи 5 ветки Б', nextNodes: ['sup_6_a', 'sup_6_b'], evolutionCost: 185
  },
  {
    id: 'sie_5', name: 'Осада Эпохи 5', line: 'Siege', epoch: 5, role: 'heavy',
    hp: 380, atk: 120, def: 38, atkSpeed: 0.4, range: 5, move: 1,
    description: 'Заглушка осадной машины Эпохи 5', nextNodes: ['sie_6'], evolutionCost: 185
  },

  // ==========================================
  // EPOCH 6 (Минимальные заглушки)
  // ==========================================
  {
    id: 'inf_6_a', name: 'Пехотинец Эпохи 6 (А)', line: 'Infantry', epoch: 6, role: 'melee',
    hp: 500, atk: 95, def: 45, atkSpeed: 1.1, range: 1, move: 2,
    description: 'Заглушка юнита Эпохи 6 ветки А', nextNodes: ['inf_7_a', 'inf_7_b'], evolutionCost: 260
  },
  {
    id: 'inf_6_b', name: 'Пехотинец Эпохи 6 (Б)', line: 'Infantry', epoch: 6, role: 'tank',
    hp: 620, atk: 60, def: 70, atkSpeed: 0.9, range: 1, move: 1,
    description: 'Заглушка юнита Эпохи 6 ветки Б', nextNodes: ['inf_7_a', 'inf_7_b'], evolutionCost: 260
  },
  {
    id: 'ran_6_a', name: 'Стрелок Эпохи 6 (А)', line: 'Ranged', epoch: 6, role: 'ranged',
    hp: 270, atk: 90, def: 22, atkSpeed: 1.1, range: 4, move: 2,
    description: 'Заглушка стрелка Эпохи 6 ветки А', nextNodes: ['ran_7_a', 'ran_7_b'], evolutionCost: 260
  },
  {
    id: 'ran_6_b', name: 'Стрелок Эпохи 6 (Б)', line: 'Ranged', epoch: 6, role: 'ranged',
    hp: 230, atk: 80, def: 18, atkSpeed: 1.3, range: 5, move: 2,
    description: 'Заглушка стрелка Эпохи 6 ветки Б', nextNodes: ['ran_7_a', 'ran_7_b'], evolutionCost: 260
  },
  {
    id: 'cav_6_a', name: 'Всадник Эпохи 6 (А)', line: 'Cavalry', epoch: 6, role: 'cavalry',
    hp: 440, atk: 105, def: 40, atkSpeed: 1.1, range: 1, move: 4,
    description: 'Заглушка всадника Эпохи 6 ветки А', nextNodes: ['cav_7_a', 'cav_7_b'], evolutionCost: 260
  },
  {
    id: 'cav_6_b', name: 'Всадник Эпохи 6 (Б)', line: 'Cavalry', epoch: 6, role: 'cavalry',
    hp: 390, atk: 90, def: 32, atkSpeed: 1.3, range: 2, move: 4,
    description: 'Заглушка всадника Эпохи 6 ветки Б', nextNodes: ['cav_7_a', 'cav_7_b'], evolutionCost: 260
  },
  {
    id: 'sup_6_a', name: 'Поддержка Эпохи 6 (А)', line: 'Support', epoch: 6, role: 'support',
    hp: 310, atk: 40, def: 28, atkSpeed: 0.9, range: 2, move: 2,
    description: 'Заглушка поддержки Эпохи 6 ветки А', nextNodes: ['sup_7_a', 'sup_7_b'], evolutionCost: 260
  },
  {
    id: 'sup_6_b', name: 'Поддержка Эпохи 6 (Б)', line: 'Support', epoch: 6, role: 'support',
    hp: 280, atk: 32, def: 24, atkSpeed: 1.0, range: 3, move: 2,
    description: 'Заглушка поддержки Эпохи 6 ветки Б', nextNodes: ['sup_7_a', 'sup_7_b'], evolutionCost: 260
  },
  {
    id: 'sie_6', name: 'Осада Эпохи 6', line: 'Siege', epoch: 6, role: 'heavy',
    hp: 500, atk: 160, def: 50, atkSpeed: 0.45, range: 5, move: 1,
    description: 'Заглушка осадной машины Эпохи 6', nextNodes: ['sie_7'], evolutionCost: 260
  },

  // ==========================================
  // EPOCH 7 (Минимальные заглушки)
  // ==========================================
  {
    id: 'inf_7_a', name: 'Пехотинец Эпохи 7 (А)', line: 'Infantry', epoch: 7, role: 'melee',
    hp: 650, atk: 130, def: 55, atkSpeed: 1.1, range: 1, move: 2,
    description: 'Заглушка юнита Эпохи 7 ветки А', nextNodes: ['inf_8_a', 'inf_8_b'], evolutionCost: 360
  },
  {
    id: 'inf_7_b', name: 'Пехотинец Эпохи 7 (Б)', line: 'Infantry', epoch: 7, role: 'tank',
    hp: 800, atk: 80, def: 90, atkSpeed: 0.9, range: 1, move: 1,
    description: 'Заглушка юнита Эпохи 7 ветки Б', nextNodes: ['inf_8_a', 'inf_8_b'], evolutionCost: 360
  },
  {
    id: 'ran_7_a', name: 'Стрелок Эпохи 7 (А)', line: 'Ranged', epoch: 7, role: 'ranged',
    hp: 350, atk: 120, def: 28, atkSpeed: 1.1, range: 4, move: 2,
    description: 'Заглушка стрелка Эпохи 7 ветки А', nextNodes: ['ran_8_a', 'ran_8_b'], evolutionCost: 360
  },
  {
    id: 'ran_7_b', name: 'Стрелок Эпохи 7 (Б)', line: 'Ranged', epoch: 7, role: 'ranged',
    hp: 300, atk: 105, def: 22, atkSpeed: 1.3, range: 5, move: 2,
    description: 'Заглушка стрелка Эпохи 7 ветки Б', nextNodes: ['ran_8_a', 'ran_8_b'], evolutionCost: 360
  },
  {
    id: 'cav_7_a', name: 'Всадник Эпохи 7 (А)', line: 'Cavalry', epoch: 7, role: 'cavalry',
    hp: 580, atk: 140, def: 50, atkSpeed: 1.1, range: 1, move: 4,
    description: 'Заглушка всадника Эпохи 7 ветки А', nextNodes: ['cav_8_a', 'cav_8_b'], evolutionCost: 360
  },
  {
    id: 'cav_7_b', name: 'Всадник Эпохи 7 (Б)', line: 'Cavalry', epoch: 7, role: 'cavalry',
    hp: 510, atk: 120, def: 40, atkSpeed: 1.3, range: 2, move: 4,
    description: 'Заглушка всадника Эпохи 7 ветки Б', nextNodes: ['cav_8_a', 'cav_8_b'], evolutionCost: 360
  },
  {
    id: 'sup_7_a', name: 'Поддержка Эпохи 7 (А)', line: 'Support', epoch: 7, role: 'support',
    hp: 400, atk: 55, def: 36, atkSpeed: 0.9, range: 2, move: 2,
    description: 'Заглушка поддержки Эпохи 7 ветки А', nextNodes: ['sup_8_a', 'sup_8_b'], evolutionCost: 360
  },
  {
    id: 'sup_7_b', name: 'Поддержка Эпохи 7 (Б)', line: 'Support', epoch: 7, role: 'support',
    hp: 360, atk: 45, def: 30, atkSpeed: 1.0, range: 3, move: 2,
    description: 'Заглушка поддержки Эпохи 7 ветки Б', nextNodes: ['sup_8_a', 'sup_8_b'], evolutionCost: 360
  },
  {
    id: 'sie_7', name: 'Осада Эпохи 7', line: 'Siege', epoch: 7, role: 'heavy',
    hp: 650, atk: 220, def: 65, atkSpeed: 0.45, range: 5, move: 1,
    description: 'Заглушка осадной машины Эпохи 7', nextNodes: ['sie_8'], evolutionCost: 360
  },

  // ==========================================
  // EPOCH 8 (Максимальная эпоха)
  // ==========================================
  {
    id: 'inf_8_a', name: 'Пехотинец Эпохи 8 (А)', line: 'Infantry', epoch: 8, role: 'melee',
    hp: 850, atk: 180, def: 70, atkSpeed: 1.2, range: 1, move: 2,
    description: 'Финальный пехотинец ветки А', nextNodes: [], evolutionCost: 500
  },
  {
    id: 'inf_8_b', name: 'Пехотинец Эпохи 8 (Б)', line: 'Infantry', epoch: 8, role: 'tank',
    hp: 1100, atk: 110, def: 110, atkSpeed: 1.0, range: 1, move: 1,
    description: 'Финальный пехотинец ветки Б', nextNodes: [], evolutionCost: 500
  },
  {
    id: 'ran_8_a', name: 'Стрелок Эпохи 8 (А)', line: 'Ranged', epoch: 8, role: 'ranged',
    hp: 450, atk: 160, def: 36, atkSpeed: 1.2, range: 4, move: 2,
    description: 'Финальный стрелок ветки А', nextNodes: [], evolutionCost: 500
  },
  {
    id: 'ran_8_b', name: 'Стрелок Эпохи 8 (Б)', line: 'Ranged', epoch: 8, role: 'ranged',
    hp: 400, atk: 140, def: 30, atkSpeed: 1.4, range: 5, move: 2,
    description: 'Финальный стрелок ветки Б', nextNodes: [], evolutionCost: 500
  },
  {
    id: 'cav_8_a', name: 'Всадник Эпохи 8 (А)', line: 'Cavalry', epoch: 8, role: 'cavalry',
    hp: 750, atk: 190, def: 65, atkSpeed: 1.2, range: 1, move: 4,
    description: 'Финальный всадник ветки А', nextNodes: [], evolutionCost: 500
  },
  {
    id: 'cav_8_b', name: 'Всадник Эпохи 8 (Б)', line: 'Cavalry', epoch: 8, role: 'cavalry',
    hp: 680, atk: 160, def: 52, atkSpeed: 1.4, range: 2, move: 4,
    description: 'Финальный всадник ветки Б', nextNodes: [], evolutionCost: 500
  },
  {
    id: 'sup_8_a', name: 'Поддержка Эпохи 8 (А)', line: 'Support', epoch: 8, role: 'support',
    hp: 520, atk: 75, def: 48, atkSpeed: 1.0, range: 2, move: 2,
    description: 'Финальная поддержка ветки А', nextNodes: [], evolutionCost: 500
  },
  {
    id: 'sup_8_b', name: 'Поддержка Эпохи 8 (Б)', line: 'Support', epoch: 8, role: 'support',
    hp: 480, atk: 60, def: 40, atkSpeed: 1.1, range: 3, move: 2,
    description: 'Финальная поддержка ветки Б', nextNodes: [], evolutionCost: 500
  },
  {
    id: 'sie_8', name: 'Осада Эпохи 8', line: 'Siege', epoch: 8, role: 'heavy',
    hp: 850, atk: 300, def: 85, atkSpeed: 0.5, range: 5, move: 1,
    description: 'Финальная осадная машина', nextNodes: [], evolutionCost: 500
  },
];

export function findNode(id: string): EvolutionNode | undefined {
  return EVOLUTION_TREE_NODES.find(n => n.id === id);
}

// Преобразовать узел эволюции в UnitTemplate
export function nodeToTemplate(node: EvolutionNode): UnitTemplate {
  return {
    id: node.id,
    name: node.name,
    role: node.role,
    hp: node.hp,
    atk: node.atk,
    def: node.def,
    atkSpeed: node.atkSpeed,
    range: node.range,
    move: node.move,
    description: node.description,
    epochIndex: node.epoch,
  };
}
