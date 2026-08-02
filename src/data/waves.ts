import type { UnitTemplate } from './units';
import { STONE_AGE_UNITS } from './units';
import { CONFIG } from '../config';
import { RNG } from '../systems/RNG';

/** Вражеский юнит волны: ссылка на шаблон + промасштабированный шаблон + позиция. */
export interface WaveEnemy {
  templateId: string;
  scaled: UnitTemplate;
  col: number;
  row: number;
}

/**
 * Заглушка генерации волн (полноценная процедурка — на Этапе 4).
 * Состав врагов растёт количественно и по статам ЛИНЕЙНО с номером волны,
 * используются те же 9 юнитов эпохи 1.
 */

export function enemyCount(wave: number): number {
  return Math.min(14, 3 + Math.floor((wave - 1) * 0.8));
}

/** Линейное масштабирование статов по волне. */
export function scaleTemplate(tpl: UnitTemplate, wave: number): UnitTemplate {
  const hpMult = 1 + 0.08 * (wave - 1);
  const atkMult = 1 + 0.06 * (wave - 1);
  const defMult = 1 + 0.05 * (wave - 1);
  return {
    ...tpl,
    hp: Math.round(tpl.hp * hpMult),
    atk: Math.round(tpl.atk * atkMult),
    def: Math.round(tpl.def * defMult),
    name: `${tpl.name} [в${wave}]`,
  };
}

/** Сгенерировать состав волны. Детерминированно от CONFIG.SEED + wave. */
export function generateWave(wave: number): WaveEnemy[] {
  const rng = new RNG(CONFIG.SEED + wave * 977);
  const count = enemyCount(wave);

  // Позиции в зоне врага (правые 3 колонки), заполняем справа налево.
  const slots: { col: number; row: number }[] = [];
  for (let col = CONFIG.GRID_COLS - 1; col >= CONFIG.GRID_COLS - CONFIG.ENEMY_ZONE_COLS; col--) {
    for (let row = 0; row < CONFIG.GRID_ROWS; row++) slots.push({ col, row });
  }

  const enemies: WaveEnemy[] = [];
  for (let i = 0; i < count && i < slots.length; i++) {
    const base = STONE_AGE_UNITS[rng.int(0, STONE_AGE_UNITS.length - 1)];
    const { col, row } = slots[i];
    enemies.push({
      templateId: base.id,
      scaled: scaleTemplate(base, wave),
      col,
      row,
    });
  }
  return enemies;
}
