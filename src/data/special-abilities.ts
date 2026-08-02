import { CONFIG } from '../config';

/** Небольшой общий словарь механик: 75 отдельных реализаций нам не нужны. */
export type SpecialAbilityType =
  | 'AreaHeal'
  | 'Stun'
  | 'BonusVsTank'
  | 'Trap'
  | 'Charge'
  | 'Suppress'
  | 'Shield'
  | 'SummonTurret';

/**
 * Полностью рассчитанная способность, которую можно положить в шаблон/сейв.
 * Не все поля используются каждым типом; единый формат упрощает сериализацию.
 */
export interface SpecialAbilityDefinition {
  type: SpecialAbilityType;
  name: string;
  description: string;
  cooldown: number;
  range: number;
  radius: number;
  power: number;
  duration: number;
  multiplier: number;
}

interface AbilityBase {
  name: string;
  cooldown: number;
  range: number;
  radius: number;
  power: number;
  duration: number;
  multiplier: number;
  describe: (a: Omit<SpecialAbilityDefinition, 'type' | 'name' | 'description'>) => string;
}

const BASE: Record<SpecialAbilityType, AbilityBase> = {
  AreaHeal: {
    name: 'Круговое исцеление',
    cooldown: 7.5,
    range: 0,
    radius: 2,
    power: 22,
    duration: 0,
    multiplier: 1,
    describe: (a) => `Восстанавливает до ${a.power} HP союзникам в радиусе ${a.radius}.`,
  },
  Stun: {
    name: 'Оглушающий удар',
    cooldown: 6.5,
    range: 2,
    radius: 0,
    power: 8,
    duration: 1.4,
    multiplier: 1,
    describe: (a) => `Наносит ${a.power} урона и оглушает цель на ${a.duration} с.`,
  },
  BonusVsTank: {
    name: 'Бронебойный выстрел',
    cooldown: 4.8,
    range: 0,
    radius: 0,
    power: 0,
    duration: 0,
    multiplier: 1.65,
    describe: (a) => `Следующая атака по танку или тяжёлому наносит ×${a.multiplier} урона.`,
  },
  Trap: {
    name: 'Ловушка',
    cooldown: 8,
    range: 1,
    radius: 0,
    power: 28,
    duration: 12,
    multiplier: 1,
    describe: (a) => `Ставит ловушку на гекс: ${a.power} урона и короткая остановка.`,
  },
  Charge: {
    name: 'Натиск',
    cooldown: 7,
    range: 4,
    radius: 0,
    power: 0,
    duration: 0,
    multiplier: 1.5,
    describe: (a) => `Рывок на дистанцию до ${a.range} с ударом ×${a.multiplier}.`,
  },
  Suppress: {
    name: 'Подавление',
    cooldown: 7.5,
    range: 5,
    radius: 0,
    power: 6,
    duration: 3.5,
    multiplier: 0.55,
    describe: (a) => `На ${a.duration} с снижает темп атак цели до ×${a.multiplier}.`,
  },
  Shield: {
    name: 'Защитное поле',
    cooldown: 8,
    range: 3,
    radius: 0,
    power: 34,
    duration: 6,
    multiplier: 1,
    describe: (a) => `Даёт союзнику щит на ${a.power} HP на ${a.duration} с.`,
  },
  SummonTurret: {
    name: 'Развёртывание турели',
    cooldown: 12,
    range: 1,
    radius: 0,
    power: 0,
    duration: 14,
    multiplier: 0.42,
    describe: (a) => `Создаёт неподвижную турель на ${a.duration} с (×${a.multiplier} силы владельца).`,
  },
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Числа способности растут той же контролируемой кривой, что и статы эпох.
 * potency позволяет лишь небольшую вариацию (например, 0.95/1.05), не меняя
 * сам тип эффекта и не создавая одноразовую механику для каждого юнита.
 */
export function createSpecialAbility(
  type: SpecialAbilityType,
  epoch: number,
  potency = 1,
): SpecialAbilityDefinition {
  const base = BASE[type];
  const era = Math.max(1, Math.min(8, Math.round(epoch)));
  const powerScale = Math.pow(CONFIG.UNIT_STAT_SCALING.ABILITY_POWER_PER_EPOCH, era - 1);
  const cooldownScale = 1 - Math.min(0.14, (era - 1) * 0.02);
  const values = {
    cooldown: round1(Math.max(2.5, base.cooldown * cooldownScale / Math.sqrt(potency))),
    range: base.range,
    radius: base.radius,
    power: Math.round(base.power * powerScale * potency),
    duration: round1(base.duration * (1 + (potency - 1) * 0.35)),
    multiplier: round1(
      type === 'Suppress'
        ? Math.max(0.4, base.multiplier / potency)
        : 1 + (base.multiplier - 1) * potency,
    ),
  };
  return {
    type,
    name: base.name,
    description: base.describe(values),
    ...values,
  };
}

export const SPECIAL_ABILITY_NAMES: Record<SpecialAbilityType, string> = Object.fromEntries(
  (Object.keys(BASE) as SpecialAbilityType[]).map((type) => [type, BASE[type].name]),
) as Record<SpecialAbilityType, string>;
