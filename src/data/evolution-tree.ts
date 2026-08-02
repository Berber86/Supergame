import { CONFIG } from '../config';
import type { CombatRole, Role } from '../entities/types';
import type { UnitTemplate } from './units';
import {
  createSpecialAbility,
  type SpecialAbilityDefinition,
  type SpecialAbilityType,
} from './special-abilities';

export type EvolutionLine = 'Infantry' | 'Ranged' | 'Cavalry' | 'Siege' | 'Support';
export type EpochIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export const EPOCH_NAMES: Record<EpochIndex, string> = {
  1: 'Каменный век',
  2: 'Бронзовый век',
  3: 'Железный век',
  4: 'Средневековье',
  5: 'Индустриальная эпоха',
  6: 'Эпоха мировых войн',
  7: 'Цифровая эпоха',
  8: 'Далёкое будущее',
};

export interface EvolutionNode {
  id: string;
  name: string;
  line: EvolutionLine;
  epoch: EpochIndex;
  role: Role;
  combatRole: CombatRole;
  hp: number;
  atk: number;
  def: number;
  atkSpeed: number;
  range: number;
  move: number;
  description: string;
  /** Явная метка узла выбора, требуемая форматом дерева. */
  is_branch_point: boolean;
  /** Ровно треть контента получает механику из общего словаря эффектов. */
  special_ability?: SpecialAbilityDefinition;
  nextNodes: string[];
  evolutionCost: number;
}

export function getEvolutionThreshold(epoch: number): number {
  return Math.max(2, Math.min(8, Math.round(epoch)) * 2);
}

const EVOLUTION_COST_BY_EPOCH: Record<EpochIndex, number> = {
  1: 0,
  2: 45,
  3: 80,
  4: 120,
  5: 185,
  6: 260,
  7: 360,
  8: 500,
};

type StatProfile =
  | 'tank'
  | 'melee'
  | 'ranged'
  | 'cavalry'
  | 'support-heal'
  | 'support-buff'
  | 'breaker';

type StatVariant =
  | 'standard'
  | 'assault'
  | 'bulwark'
  | 'marksman'
  | 'skirmisher'
  | 'lancer'
  | 'raider';

interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  atkSpeed: number;
  range: number;
  move: number;
}

/** Базовые силуэты эпохи I. Все последующие числа выводятся из них формулой. */
const BASE_STATS: Record<StatProfile, BaseStats> = {
  tank: { hp: 145, atk: 14, def: 13, atkSpeed: 0.68, range: 1, move: 1.2 },
  melee: { hp: 102, atk: 22, def: 6, atkSpeed: 0.9, range: 1, move: 2 },
  ranged: { hp: 68, atk: 18, def: 3, atkSpeed: 0.78, range: 3, move: 1.9 },
  cavalry: { hp: 96, atk: 18, def: 6, atkSpeed: 0.96, range: 1, move: 3.5 },
  'support-heal': { hp: 78, atk: 8, def: 4, atkSpeed: 0.62, range: 3, move: 1.6 },
  'support-buff': { hp: 88, atk: 10, def: 6, atkSpeed: 0.66, range: 3, move: 1.7 },
  // Разрушитель силён по плотной группе, но намеренно уступает танку в HP/DEF
  // и стрелку в стабильном DPS — иначе моно-линия осады доминирует эпохами.
  breaker: { hp: 118, atk: 25, def: 5, atkSpeed: 0.42, range: 1, move: 1 },
};

interface VariantMultipliers {
  hp: number;
  atk: number;
  def: number;
  atkSpeed: number;
  rangeBonus: number;
  moveBonus: number;
}

/** Ограниченный набор специализаций не даёт «подкрутить» один юнит вручную. */
const VARIANTS: Record<StatVariant, VariantMultipliers> = {
  standard: { hp: 1, atk: 1, def: 1, atkSpeed: 1, rangeBonus: 0, moveBonus: 0 },
  assault: { hp: 0.94, atk: 1.12, def: 0.88, atkSpeed: 1.08, rangeBonus: 0, moveBonus: 0.2 },
  bulwark: { hp: 1.12, atk: 0.85, def: 1.18, atkSpeed: 0.9, rangeBonus: 0, moveBonus: -0.2 },
  marksman: { hp: 0.9, atk: 1.12, def: 0.85, atkSpeed: 0.88, rangeBonus: 1, moveBonus: 0 },
  skirmisher: { hp: 1.02, atk: 0.94, def: 1.1, atkSpeed: 1.15, rangeBonus: 0, moveBonus: 0.3 },
  lancer: { hp: 1.08, atk: 1.1, def: 1.05, atkSpeed: 0.92, rangeBonus: 0, moveBonus: 0 },
  raider: { hp: 0.9, atk: 0.93, def: 0.8, atkSpeed: 1.18, rangeBonus: 1, moveBonus: 0.5 },
};

interface UnitContent {
  id: string;
  name: string;
  line: EvolutionLine;
  epoch: EpochIndex;
  role: Role;
  combatRole: CombatRole;
  profile: StatProfile;
  variant: StatVariant;
  description: string;
  special?: SpecialAbilityType;
  potency?: number;
}

/**
 * 72 записи контента: 9 на эпоху. Здесь нет ручных HP/ATK/DEF — только имя,
 * исторический образ и один из проверенных стат-профилей.
 */
const CONTENT: UnitContent[] = [
  // I — Каменный век
  { id: 'guardian', name: 'Племенной Страж', line: 'Infantry', epoch: 1, role: 'tank', combatRole: 'tank', profile: 'tank', variant: 'bulwark', description: 'Щит из кожи и тяжёлая дубина делают его опорой первобытного строя.' },
  { id: 'spearhunter', name: 'Охотник с Копьём', line: 'Infantry', epoch: 1, role: 'melee', combatRole: 'melee-dps', profile: 'melee', variant: 'assault', description: 'Терпеливо выжидает момент, а затем бьёт кремнёвым наконечником.' },
  { id: 'sling', name: 'Пращник', line: 'Ranged', epoch: 1, role: 'ranged', combatRole: 'ranged-dps', profile: 'ranged', variant: 'marksman', description: 'Гладкий речной камень опасен задолго до рукопашной.' },
  { id: 'atlatl', name: 'Метатель Атлатля', line: 'Ranged', epoch: 1, role: 'ranged', combatRole: 'ranged-dps', profile: 'ranged', variant: 'skirmisher', description: 'Раскладывает зазубренные колья и гонит добычу прямо на них.', special: 'Trap', potency: 0.9 },
  { id: 'wolfrider', name: 'Наездник на Волке', line: 'Cavalry', epoch: 1, role: 'cavalry', combatRole: 'melee-dps', profile: 'cavalry', variant: 'raider', description: 'Полулегендарный разведчик, который всегда оказывается на фланге.' },
  { id: 'flintaxe', name: 'Воин Кремнёвого Топора', line: 'Cavalry', epoch: 1, role: 'cavalry', combatRole: 'melee-dps', profile: 'cavalry', variant: 'lancer', description: 'Бежит рядом с охотничьей сворой и раскалывает любой щит.' },
  { id: 'shaman', name: 'Шаман Племени', line: 'Support', epoch: 1, role: 'support', combatRole: 'support-heal', profile: 'support-heal', variant: 'standard', description: 'Песней и целебным дымом возвращает соплеменников в строй.', special: 'AreaHeal' },
  { id: 'boneshield', name: 'Хранитель Тотема', line: 'Support', epoch: 1, role: 'support', combatRole: 'support-buff', profile: 'support-buff', variant: 'standard', description: 'Костяной тотем напоминает воинам, что за ними стоит весь род.' },
  { id: 'mammoth', name: 'Погонщик Мамонта', line: 'Siege', epoch: 1, role: 'heavy', combatRole: 'aoe-breaker', profile: 'breaker', variant: 'standard', description: 'Живая осадная машина сметает плотный строй одним натиском.', special: 'Charge', potency: 0.9 },

  // II — Бронзовый век
  { id: 'bronze_swordsman', name: 'Микенский Мечник', line: 'Infantry', epoch: 2, role: 'melee', combatRole: 'melee-dps', profile: 'melee', variant: 'assault', description: 'Короткий бронзовый клинок быстр в тесноте городских ворот.' },
  { id: 'bronze_phalanx', name: 'Гоплит Фаланги', line: 'Infantry', epoch: 2, role: 'tank', combatRole: 'tank', profile: 'tank', variant: 'bulwark', description: 'Поднимает аспис и превращает соседей в сплошную стену.', special: 'Shield' },
  { id: 'composite_bowman', name: 'Лучник Составного Лука', line: 'Ranged', epoch: 2, role: 'ranged', combatRole: 'ranged-dps', profile: 'ranged', variant: 'marksman', description: 'Склеенные рог и дерево посылают стрелу дальше простого лука.' },
  { id: 'bronze_skirmisher', name: 'Пельтаст', line: 'Ranged', epoch: 2, role: 'ranged', combatRole: 'ranged-dps', profile: 'ranged', variant: 'skirmisher', description: 'Тяжёлый дротик находит слабое место даже в панцире.', special: 'BonusVsTank' },
  { id: 'chariot_rider', name: 'Колесничий Хеттов', line: 'Cavalry', epoch: 2, role: 'cavalry', combatRole: 'melee-dps', profile: 'cavalry', variant: 'lancer', description: 'Три человека и две лошади превращают колесницу в таран.' },
  { id: 'nomad_horseman', name: 'Степной Всадник', line: 'Cavalry', epoch: 2, role: 'cavalry', combatRole: 'melee-dps', profile: 'cavalry', variant: 'raider', description: 'Стреляет на скаку и исчезает прежде, чем строй развернётся.' },
  { id: 'bronze_cleric', name: 'Жрец Асклепия', line: 'Support', epoch: 2, role: 'support', combatRole: 'support-heal', profile: 'support-heal', variant: 'standard', description: 'Знает травы, шины и цену спокойного голоса среди битвы.', special: 'AreaHeal', potency: 1.05 },
  { id: 'herbalist', name: 'Храмовый Глашатай', line: 'Support', epoch: 2, role: 'support', combatRole: 'support-buff', profile: 'support-buff', variant: 'standard', description: 'Ритм медных пластин удерживает фалангу в едином шаге.' },
  { id: 'bronze_ballista', name: 'Гастрафетный Расчёт', line: 'Siege', epoch: 2, role: 'heavy', combatRole: 'aoe-breaker', profile: 'breaker', variant: 'standard', description: 'Механический лук пробивает строй, но требует времени на взвод.' },

  // III — Железный век
  { id: 'iron_legionary', name: 'Имперский Легионер', line: 'Infantry', epoch: 3, role: 'tank', combatRole: 'tank', profile: 'tank', variant: 'bulwark', description: 'Скутум, пилум и железная дисциплина переживают любую атаку.' },
  { id: 'iron_berserker', name: 'Неистовый Берсерк', line: 'Infantry', epoch: 3, role: 'melee', combatRole: 'melee-dps', profile: 'melee', variant: 'assault', description: 'Удар двуручного топора на миг лишает противника воли к бою.', special: 'Stun' },
  { id: 'iron_crossbowman', name: 'Китайский Арбалетчик', line: 'Ranged', epoch: 3, role: 'ranged', combatRole: 'ranged-dps', profile: 'ranged', variant: 'marksman', description: 'Бронзовый спуск делает каждый тяжёлый болт одинаково точным.' },
  { id: 'longbowman', name: 'Парфянский Лучник', line: 'Ranged', epoch: 3, role: 'ranged', combatRole: 'ranged-dps', profile: 'ranged', variant: 'skirmisher', description: 'Ведёт непрерывный огонь, не задерживаясь на одном месте.' },
  { id: 'iron_cataphract', name: 'Панцирный Катафрактарий', line: 'Cavalry', epoch: 3, role: 'cavalry', combatRole: 'melee-dps', profile: 'cavalry', variant: 'lancer', description: 'Железная чешуя закрывает и всадника, и боевого коня.' },
  { id: 'knight_errant', name: 'Сарматский Контосник', line: 'Cavalry', epoch: 3, role: 'cavalry', combatRole: 'melee-dps', profile: 'cavalry', variant: 'raider', description: 'Длинный контос превращает разгон в сокрушительный выпад.', special: 'Charge', potency: 1.05 },
  { id: 'iron_inquisitor', name: 'Римский Аквилифер', line: 'Support', epoch: 3, role: 'support', combatRole: 'support-buff', profile: 'support-buff', variant: 'standard', description: 'Орёл легиона вдохновляет своих и подавляет решимость чужих.', special: 'Suppress' },
  { id: 'templar_medic', name: 'Военный Медикус', line: 'Support', epoch: 3, role: 'support', combatRole: 'support-heal', profile: 'support-heal', variant: 'standard', description: 'Полевая хирургия сохраняет ветеранов для следующего сражения.' },
  { id: 'iron_catapult', name: 'Онагр', line: 'Siege', epoch: 3, role: 'heavy', combatRole: 'aoe-breaker', profile: 'breaker', variant: 'standard', description: 'Торсионная машина обрушивает камни в самую плотную толпу.' },

  // IV — Средневековье
  { id: 'inf_4_a', name: 'Ландскнехт', line: 'Infantry', epoch: 4, role: 'melee', combatRole: 'melee-dps', profile: 'melee', variant: 'assault', description: 'Двуручный цвайхендер прорубает проход в строю пик.' },
  { id: 'inf_4_b', name: 'Страж с Павезой', line: 'Infantry', epoch: 4, role: 'tank', combatRole: 'tank', profile: 'tank', variant: 'bulwark', description: 'Высокий щит становится переносной крепостной стеной.', special: 'Shield', potency: 1.05 },
  { id: 'ran_4_a', name: 'Генуэзский Арбалетчик', line: 'Ranged', epoch: 4, role: 'ranged', combatRole: 'ranged-dps', profile: 'ranged', variant: 'marksman', description: 'Ворот арбалета заряжает болт, способный прошить рыцарские латы.', special: 'BonusVsTank', potency: 1.05 },
  { id: 'ran_4_b', name: 'Аркебузир', line: 'Ranged', epoch: 4, role: 'ranged', combatRole: 'ranged-dps', profile: 'ranged', variant: 'skirmisher', description: 'Дымный порох неточен, зато залп не знает страха перед бронёй.' },
  { id: 'cav_4_a', name: 'Рыцарь-Копейщик', line: 'Cavalry', epoch: 4, role: 'cavalry', combatRole: 'melee-dps', profile: 'cavalry', variant: 'lancer', description: 'Опускает турнирное копьё и доверяет весу коня и доспеха.' },
  { id: 'cav_4_b', name: 'Конный Мамлюк', line: 'Cavalry', epoch: 4, role: 'cavalry', combatRole: 'melee-dps', profile: 'cavalry', variant: 'raider', description: 'Сабля и короткий лук одинаково опасны в умелых руках.' },
  { id: 'sup_4_a', name: 'Монастырский Лекарь', line: 'Support', epoch: 4, role: 'support', combatRole: 'support-heal', profile: 'support-heal', variant: 'standard', description: 'Несёт сумку с бинтами, мёдом и знаниями старых рукописей.' },
  { id: 'sup_4_b', name: 'Королевский Знаменосец', line: 'Support', epoch: 4, role: 'support', combatRole: 'support-buff', profile: 'support-buff', variant: 'standard', description: 'Пока знамя видно над схваткой, линия не отступает.' },
  { id: 'sie_4', name: 'Инженер Требюше', line: 'Siege', epoch: 4, role: 'heavy', combatRole: 'aoe-breaker', profile: 'breaker', variant: 'standard', description: 'Перед боем рассыпает калтропы, затем запускает тяжёлый камень.', special: 'Trap', potency: 1.05 },

  // V — Индустриальная эпоха
  { id: 'inf_5_a', name: 'Гренадер Империи', line: 'Infantry', epoch: 5, role: 'melee', combatRole: 'melee-dps', profile: 'melee', variant: 'assault', description: 'Идёт впереди колонны и оглушает защитников ручной гранатой.', special: 'Stun', potency: 1.05 },
  { id: 'inf_5_b', name: 'Линейный Пехотинец', line: 'Infantry', epoch: 5, role: 'tank', combatRole: 'tank', profile: 'tank', variant: 'bulwark', description: 'Строй, штык и муштра позволяют выдержать первый залп.' },
  { id: 'ran_5_a', name: 'Стрелок Нарезного Ружья', line: 'Ranged', epoch: 5, role: 'ranged', combatRole: 'ranged-dps', profile: 'ranged', variant: 'marksman', description: 'Нарезной ствол уверенно достаёт офицеров за линией фронта.' },
  { id: 'ran_5_b', name: 'Расчёт Картечницы', line: 'Ranged', epoch: 5, role: 'ranged', combatRole: 'ranged-dps', profile: 'ranged', variant: 'skirmisher', description: 'Поток свинца заставляет целый сектор прижаться к земле.', special: 'Suppress', potency: 1.05 },
  { id: 'cav_5_a', name: 'Улан', line: 'Cavalry', epoch: 5, role: 'cavalry', combatRole: 'melee-dps', profile: 'cavalry', variant: 'lancer', description: 'Последний блеск пики перед тем, как войну захватят машины.' },
  { id: 'cav_5_b', name: 'Конный Драгун', line: 'Cavalry', epoch: 5, role: 'cavalry', combatRole: 'melee-dps', profile: 'cavalry', variant: 'raider', description: 'Скачет как кавалерист, стреляет как опытный пехотинец.' },
  { id: 'sup_5_a', name: 'Полевой Хирург', line: 'Support', epoch: 5, role: 'support', combatRole: 'support-heal', profile: 'support-heal', variant: 'standard', description: 'Антисептик и перевязочный пункт спасают сразу целое отделение.', special: 'AreaHeal', potency: 1.1 },
  { id: 'sup_5_b', name: 'Полковой Горнист', line: 'Support', epoch: 5, role: 'support', combatRole: 'support-buff', profile: 'support-buff', variant: 'standard', description: 'Короткий сигнал превращает разрозненных солдат в строй.' },
  { id: 'sie_5', name: 'Паровая Мортира', line: 'Siege', epoch: 5, role: 'heavy', combatRole: 'aoe-breaker', profile: 'breaker', variant: 'standard', description: 'Промышленная тяга доставляет фугас туда, где его не ждут.' },

  // VI — Эпоха мировых войн
  { id: 'inf_6_a', name: 'Штурмовой Сапёр', line: 'Infantry', epoch: 6, role: 'melee', combatRole: 'melee-dps', profile: 'melee', variant: 'assault', description: 'Мины, растяжки и взрывчатка превращают каждый гекс в угрозу.', special: 'Trap', potency: 1.1 },
  { id: 'inf_6_b', name: 'Окопный Ветеран', line: 'Infantry', epoch: 6, role: 'tank', combatRole: 'tank', profile: 'tank', variant: 'bulwark', description: 'Каска и мешки с песком научили его переживать артобстрел.' },
  { id: 'ran_6_a', name: 'Снайпер Наблюдатель', line: 'Ranged', epoch: 6, role: 'ranged', combatRole: 'ranged-dps', profile: 'ranged', variant: 'marksman', description: 'Один выстрел следует за долгими минутами расчёта ветра.' },
  { id: 'ran_6_b', name: 'Пулемётный Расчёт', line: 'Ranged', epoch: 6, role: 'ranged', combatRole: 'ranged-dps', profile: 'ranged', variant: 'skirmisher', description: 'Сменный ствол удерживает подступы под непрерывным огнём.' },
  { id: 'cav_6_a', name: 'Крейсерский Танк', line: 'Cavalry', epoch: 6, role: 'cavalry', combatRole: 'melee-dps', profile: 'cavalry', variant: 'lancer', description: 'Броня приняла эстафету тяжёлой кавалерии.' },
  { id: 'cav_6_b', name: 'Мотоциклетный Разведчик', line: 'Cavalry', epoch: 6, role: 'cavalry', combatRole: 'melee-dps', profile: 'cavalry', variant: 'raider', description: 'Находит обходной путь быстрее, чем штаб успевает нанести его на карту.' },
  { id: 'sup_6_a', name: 'Фронтовой Санитар', line: 'Support', epoch: 6, role: 'support', combatRole: 'support-heal', profile: 'support-heal', variant: 'standard', description: 'Вытаскивает раненых из-под огня и возвращает лёгких в строй.' },
  { id: 'sup_6_b', name: 'Радиооператор', line: 'Support', epoch: 6, role: 'support', combatRole: 'support-buff', profile: 'support-buff', variant: 'standard', description: 'Координаты и своевременный приказ создают невидимый защитный контур.', special: 'Shield', potency: 1.1 },
  { id: 'sie_6', name: 'Самоходная Гаубица', line: 'Siege', epoch: 6, role: 'heavy', combatRole: 'aoe-breaker', profile: 'breaker', variant: 'standard', description: 'Разворачивает пулемётное гнездо и ведёт навесный огонь.', special: 'SummonTurret', potency: 1.05 },

  // VII — Цифровая эпоха
  { id: 'inf_7_a', name: 'Киберкоммандос', line: 'Infantry', epoch: 7, role: 'melee', combatRole: 'melee-dps', profile: 'melee', variant: 'assault', description: 'Нейроинтерфейс сокращает паузу между решением и ударом.' },
  { id: 'inf_7_b', name: 'Щитоносец Экзолат', line: 'Infantry', epoch: 7, role: 'tank', combatRole: 'tank', profile: 'tank', variant: 'bulwark', description: 'Силовой каркас держит плиту, неподъёмную для обычного солдата.' },
  { id: 'ran_7_a', name: 'Стрелок Рельсотрона', line: 'Ranged', epoch: 7, role: 'ranged', combatRole: 'ranged-dps', profile: 'ranged', variant: 'marksman', description: 'Гиперзвуковой сердечник прошивает активную броню.', special: 'BonusVsTank', potency: 1.1 },
  { id: 'ran_7_b', name: 'Оператор Роя Дронов', line: 'Ranged', epoch: 7, role: 'ranged', combatRole: 'ranged-dps', profile: 'ranged', variant: 'skirmisher', description: 'Оставляет автономный огневой модуль и меняет позицию.', special: 'SummonTurret', potency: 1.1 },
  { id: 'cav_7_a', name: 'Гравибайк-Копейщик', line: 'Cavalry', epoch: 7, role: 'cavalry', combatRole: 'melee-dps', profile: 'cavalry', variant: 'lancer', description: 'Магнитное копьё замыкает контур в момент столкновения.' },
  { id: 'cav_7_b', name: 'Стелс-Рейдер', line: 'Cavalry', epoch: 7, role: 'cavalry', combatRole: 'melee-dps', profile: 'cavalry', variant: 'raider', description: 'Тепловая маскировка оставляет противнику лишь ложные отметки.' },
  { id: 'sup_7_a', name: 'Наномедик', line: 'Support', epoch: 7, role: 'support', combatRole: 'support-heal', profile: 'support-heal', variant: 'standard', description: 'Облако медицинских нанитов одновременно закрывает десятки ран.', special: 'AreaHeal', potency: 1.15 },
  { id: 'sup_7_b', name: 'Тактический ИИ-Связист', line: 'Support', epoch: 7, role: 'support', combatRole: 'support-buff', profile: 'support-buff', variant: 'standard', description: 'Предсказывает угрозы на несколько секунд вперёд и раздаёт цели.' },
  { id: 'sie_7', name: 'Ракетная Платформа', line: 'Siege', epoch: 7, role: 'heavy', combatRole: 'aoe-breaker', profile: 'breaker', variant: 'standard', description: 'Управляемый залп меняет траекторию уже над полем боя.' },

  // VIII — Далёкое будущее
  { id: 'inf_8_a', name: 'Клинок Сингулярности', line: 'Infantry', epoch: 8, role: 'melee', combatRole: 'melee-dps', profile: 'melee', variant: 'assault', description: 'Лезвие искривляет пространство на толщину атома.' },
  { id: 'inf_8_b', name: 'Страж Нулевого Поля', line: 'Infantry', epoch: 8, role: 'tank', combatRole: 'tank', profile: 'tank', variant: 'bulwark', description: 'Вокруг него импульс теряет энергию ещё до соприкосновения.' },
  { id: 'ran_8_a', name: 'Фотонный Снайпер', line: 'Ranged', epoch: 8, role: 'ranged', combatRole: 'ranged-dps', profile: 'ranged', variant: 'marksman', description: 'Выстрел приходит одновременно с нажатием спуска.' },
  { id: 'ran_8_b', name: 'Хронорейнджер', line: 'Ranged', epoch: 8, role: 'ranged', combatRole: 'ranged-dps', profile: 'ranged', variant: 'skirmisher', description: 'На долю секунды запирает цель в чужом темпе времени.', special: 'Stun', potency: 1.15 },
  { id: 'cav_8_a', name: 'Гравитационный Кирасир', line: 'Cavalry', epoch: 8, role: 'cavalry', combatRole: 'melee-dps', profile: 'cavalry', variant: 'lancer', description: 'Искусственная масса превращает лёгкую машину в неудержимый таран.' },
  { id: 'cav_8_b', name: 'Фазовый Всадник', line: 'Cavalry', epoch: 8, role: 'cavalry', combatRole: 'melee-dps', profile: 'cavalry', variant: 'raider', description: 'Выходит из фазы там, где оборона оставила единственный зазор.' },
  { id: 'sup_8_a', name: 'Квантовый Врач', line: 'Support', epoch: 8, role: 'support', combatRole: 'support-heal', profile: 'support-heal', variant: 'standard', description: 'Выбирает для пациента ту вероятность, в которой рана уже закрылась.' },
  { id: 'sup_8_b', name: 'Архитектор Роя', line: 'Support', epoch: 8, role: 'support', combatRole: 'support-buff', profile: 'support-buff', variant: 'standard', description: 'Собирает автономного защитника прямо из пыли поля боя.', special: 'SummonTurret', potency: 1.15 },
  { id: 'sie_8', name: 'Орбитальный Разрушитель', line: 'Siege', epoch: 8, role: 'heavy', combatRole: 'aoe-breaker', profile: 'breaker', variant: 'standard', description: 'Луч с орбиты подавляет электронику и выжигает целый сектор.', special: 'Suppress', potency: 1.15 },
];

function scaled(base: number, growth: number, epoch: EpochIndex, variant: number): number {
  return base * Math.pow(growth, epoch - 1) * variant;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function statsFor(content: UnitContent): BaseStats {
  const base = BASE_STATS[content.profile];
  const variant = VARIANTS[content.variant];
  const s = CONFIG.UNIT_STAT_SCALING;
  const rangedEraBonus = content.profile === 'ranged' ? Math.floor((content.epoch - 1) / 4) : 0;
  const breakerEraBonus = content.profile === 'breaker' ? Math.ceil((content.epoch - 1) / 2) : 0;
  return {
    hp: Math.round(scaled(base.hp, s.HP_PER_EPOCH, content.epoch, variant.hp)),
    atk: Math.round(scaled(base.atk, s.ATK_PER_EPOCH, content.epoch, variant.atk)),
    def: Math.round(scaled(base.def, s.DEF_PER_EPOCH, content.epoch, variant.def)),
    atkSpeed: round2(scaled(base.atkSpeed, s.ATK_SPEED_PER_EPOCH, content.epoch, variant.atkSpeed)),
    range: Math.max(1, Math.round(base.range + variant.rangeBonus + rangedEraBonus + breakerEraBonus)),
    move: round2(Math.max(0.8, base.move + variant.moveBonus)),
  };
}

function nextNodesFor(content: UnitContent): string[] {
  if (content.epoch >= 8) return [];
  return CONTENT.filter((candidate) =>
    candidate.epoch === content.epoch + 1 && candidate.line === content.line,
  ).map((candidate) => candidate.id);
}

export const EVOLUTION_TREE_NODES: EvolutionNode[] = CONTENT.map((content) => {
  const stats = statsFor(content);
  const nextNodes = nextNodesFor(content);
  return {
    id: content.id,
    name: content.name,
    line: content.line,
    epoch: content.epoch,
    role: content.role,
    combatRole: content.combatRole,
    ...stats,
    description: content.description,
    is_branch_point: nextNodes.length > 1,
    special_ability: content.special
      ? createSpecialAbility(content.special, content.epoch, content.potency)
      : undefined,
    nextNodes,
    evolutionCost: EVOLUTION_COST_BY_EPOCH[content.epoch],
  };
});

const NODE_BY_ID = new Map(EVOLUTION_TREE_NODES.map((node) => [node.id, node]));

export function findNode(id: string): EvolutionNode | undefined {
  return NODE_BY_ID.get(id);
}

export function nodesInEpoch(epoch: number): EvolutionNode[] {
  return EVOLUTION_TREE_NODES.filter((node) => node.epoch === epoch);
}

export function nodeToTemplate(node: EvolutionNode): UnitTemplate {
  return {
    id: node.id,
    name: node.name,
    role: node.role,
    combatRole: node.combatRole,
    hp: node.hp,
    atk: node.atk,
    def: node.def,
    atkSpeed: node.atkSpeed,
    range: node.range,
    move: node.move,
    description: node.description,
    epochIndex: node.epoch,
    specialAbility: node.special_ability,
    isBranchPoint: node.is_branch_point,
  };
}
