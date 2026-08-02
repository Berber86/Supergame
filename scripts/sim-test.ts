/**
 * Headless-тест боевой логики (без Phaser).
 * Запуск: см. ниже (esbuild -> node).
 * Проверяет: бой доходит до результата, есть атаки/смерти/лечение, и
 * ДЕТЕРМИНИРОВАННОСТЬ при одинаковом seed + расстановке.
 */
import { CONFIG } from '../src/config';
import { buildTerrainMap, terrainSourceFromMap } from '../src/data/boardLayout';
import { ENEMY_LINEUP, STONE_AGE_UNITS } from '../src/data/units';
import { HexGrid } from '../src/systems/HexGrid';
import { CombatSystem } from '../src/systems/CombatSystem';

type Stats = {
  result: string;
  ticks: number;
  attacks: number;
  deaths: number;
  heals: number;
  moves: number;
  alivePlayer: number;
  aliveEnemy: number;
};

function run(): { stats: Stats; sample: string[] } {
  const map = buildTerrainMap(CONFIG.GRID_COLS, CONFIG.GRID_ROWS, CONFIG.TERRAIN_SEED);
  const grid = new HexGrid(
    CONFIG.GRID_COLS,
    CONFIG.GRID_ROWS,
    0,
    0,
    terrainSourceFromMap(map),
  );
  const sim = new CombatSystem(grid, CONFIG.SEED);
  const templates = Object.fromEntries(STONE_AGE_UNITS.map((u) => [u.id, u]));

  const player = [
    { templateId: 'guardian', col: 0, row: 2 },
    { templateId: 'boneshield', col: 0, row: 4 },
    { templateId: 'spearhunter', col: 1, row: 1 },
    { templateId: 'flintaxe', col: 1, row: 5 },
    { templateId: 'sling', col: 1, row: 3 },
    { templateId: 'atlatl', col: 0, row: 3 },
    { templateId: 'shaman', col: 0, row: 0 },
    { templateId: 'wolfrider', col: 2, row: 3 },
    { templateId: 'mammoth', col: 2, row: 6 },
  ];
  sim.addUnits(player, templates, 'player');
  sim.addUnits(
    ENEMY_LINEUP.map((e) => ({ templateId: e.templateId, col: e.col, row: e.row })),
    templates,
    'enemy',
  );
  sim.start();

  let attacks = 0;
  let deaths = 0;
  let heals = 0;
  let moves = 0;
  const sample: string[] = [];

  for (let i = 0; i < 8000; i++) {
    sim.update(0.1);
    for (const e of sim.events) {
      if (e.type === 'attack') {
        attacks++;
        if (sample.length < 6 && !e.miss)
          sample.push(`atk#${e.attacker}->#${e.target} dmg=${e.damage}${e.crit ? ' CRIT' : ''}${e.ranged ? ' (ranged)' : ''}`);
      } else if (e.type === 'death') {
        deaths++;
      } else if (e.type === 'heal') {
        heals++;
      } else if (e.type === 'move') {
        moves++;
      }
    }
    if (sim.result !== 'ongoing') break;
  }

  return {
    stats: {
      result: sim.result,
      ticks: sim.tickNumber,
      attacks,
      deaths,
      heals,
      moves,
      alivePlayer: sim.aliveCount('player'),
      aliveEnemy: sim.aliveCount('enemy'),
    },
    sample,
  };
}

const a = run();
const b = run();
console.log('=== Симуляция боя (headless) ===');
console.log('Сэмплы атак:', a.sample);
console.log('Итог A:', a.stats);
console.log('Детерминированно (A==B):', JSON.stringify(a.stats) === JSON.stringify(b.stats));
console.log('Бой завершён:', a.stats.result !== 'ongoing');
console.log('Есть атаки/смерти/движения:', a.stats.attacks > 0, a.stats.deaths > 0, a.stats.moves > 0);
