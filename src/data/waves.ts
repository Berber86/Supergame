import { CONFIG } from '../config';
import type { CombatRole } from '../entities/types';
import { RNG } from '../systems/RNG';
import { buildTerrainMap, terrainSeedForWave } from './boardLayout';
import { EVOLUTION_TREE_NODES, nodeToTemplate, type EvolutionNode } from './evolution-tree';
import type { Terrain } from './terrain';
import type { UnitTemplate } from './units';

export interface WaveEnemy {
  templateId: string;
  scaled: UnitTemplate;
  col: number;
  row: number;
  epoch: number;
  elite: boolean;
}

export function isEliteWave(wave: number): boolean {
  return Number.isFinite(wave) && wave > 0 && Math.floor(wave) % CONFIG.WAVES.ELITE_EVERY === 0;
}

export function enemyCount(wave: number): number {
  const safeWave = Number.isFinite(wave) ? Math.max(1, Math.floor(wave)) : 1;
  const regular = CONFIG.WAVES.MIN_UNITS +
    Math.floor((safeWave - 1) / CONFIG.WAVES.WAVES_PER_EXTRA_UNIT);
  return Math.min(
    CONFIG.WAVES.MAX_UNITS,
    regular + (isEliteWave(safeWave) ? 1 : 0),
  );
}

export function waveEpochSpread(wave: number): number {
  const safeWave = Number.isFinite(wave) ? Math.max(1, wave) : 1;
  return Math.min(
    CONFIG.WAVES.EPOCH_SPREAD_MAX,
    CONFIG.WAVES.EPOCH_SPREAD_BASE + safeWave * CONFIG.WAVES.EPOCH_SPREAD_PER_WAVE,
  );
}

/**
 * Небольшое давление номера волны + отдельный элитный множитель. Смена эпохи
 * уже заложена в самом шаблоне и не дублируется бесконечным линейным ростом.
 */
export function scaleTemplate(
  template: UnitTemplate,
  wave: number,
  elite = isEliteWave(wave),
): UnitTemplate {
  const safeWave = Number.isFinite(wave) ? Math.max(1, wave) : 1;
  const pressure = Math.min(
    CONFIG.WAVES.PRESSURE_MAX,
    1 + Math.max(0, safeWave - 1) * CONFIG.WAVES.PRESSURE_PER_WAVE,
  );
  const regularMultiplier = CONFIG.WAVES.BASE_STAT_MULT * pressure;
  const multiplier = regularMultiplier * (elite ? CONFIG.WAVES.ELITE_STAT_MULT : 1);
  const scaleStat = (value: number): number => {
    const regular = Math.round(value * regularMultiplier);
    const scaled = Math.round(value * multiplier);
    // Даже низкий DEF обязан получить видимый элитный бонус после округления.
    return elite ? Math.max(regular + 1, scaled) : regular;
  };
  return {
    ...template,
    hp: scaleStat(template.hp),
    atk: scaleStat(template.atk),
    def: scaleStat(template.def),
    elite,
    name: elite ? `Элита: ${template.name}` : template.name,
  };
}

type SquadNeed = 'tankLike' | 'melee' | 'ranged' | 'support' | 'breaker';

/** Ролевой каркас гарантирует фронт, урон и не более двух поддержек. */
function rolePlan(count: number, elite: boolean, rng: RNG): SquadNeed[] {
  const plan: SquadNeed[] = ['tankLike', 'ranged', 'melee'];
  if (count >= 5) plan.push('support');
  if (elite) plan.push('breaker');
  const flexible: SquadNeed[] = ['melee', 'ranged', 'breaker', 'support'];
  const caps: Record<SquadNeed, number> = {
    tankLike: 1,
    melee: 3,
    ranged: 3,
    support: 2,
    breaker: 1,
  };
  while (plan.length < count) {
    const available = flexible.filter(
      (need) => plan.filter((entry) => entry === need).length < caps[need],
    );
    plan.push(available[rng.int(0, available.length - 1)] ?? 'melee');
  }
  return plan.slice(0, count);
}

function matchesNeed(node: EvolutionNode, need: SquadNeed): boolean {
  switch (need) {
    case 'tankLike': return node.combatRole === 'tank';
    case 'melee': return node.combatRole === 'melee-dps';
    case 'ranged': return node.combatRole === 'ranged-dps';
    case 'support': return node.combatRole === 'support-heal' || node.combatRole === 'support-buff';
    case 'breaker': return node.combatRole === 'aoe-breaker';
  }
}

function sampleEpoch(worldEpochScore: number, spread: number, rng: RNG): number {
  // Сумма двух равномерных отклонений даёт треугольное распределение:
  // соседняя эпоха встречается часто, край разброса остаётся неожиданностью.
  const offset = (rng.next() + rng.next() - 1) * spread;
  return Math.max(1, Math.min(8, Math.round(worldEpochScore + offset)));
}

function chooseNode(
  need: SquadNeed,
  epoch: number,
  rng: RNG,
  excluded: ReadonlySet<string> = new Set(),
): EvolutionNode {
  const matching = EVOLUTION_TREE_NODES.filter((node) => matchesNeed(node, need));
  const exact = matching.filter((node) => node.epoch === epoch);
  const nearest = exact.length
    ? exact
    : matching.filter((node) =>
      Math.abs(node.epoch - epoch) === Math.min(...matching.map((n) => Math.abs(n.epoch - epoch))),
    );
  const unique = nearest.filter((node) => !excluded.has(node.id));
  const pool = unique.length ? unique : nearest;
  return pool[rng.int(0, pool.length - 1)];
}

interface Slot {
  col: number;
  row: number;
  terrain: Terrain;
  tie: number;
}

function placementPriority(role: CombatRole): number {
  if (role === 'ranged-dps') return 0;
  if (role === 'support-heal' || role === 'support-buff') return 1;
  if (role === 'tank') return 2;
  return 3;
}

function slotScore(template: UnitTemplate, slot: Slot): number {
  const role = template.combatRole;
  const rear = slot.col;
  const front = CONFIG.GRID_COLS - slot.col;
  if (role === 'ranged-dps') {
    return (slot.terrain === 'hill' ? 100 : 0) + rear * 4 + (slot.terrain === 'forest' ? -6 : 0);
  }
  if (role === 'support-heal' || role === 'support-buff') {
    return (slot.terrain === 'forest' ? 24 : 0) + rear * 3;
  }
  if (role === 'tank') {
    return front * 5 + (slot.terrain === 'forest' ? 12 : 0);
  }
  if (role === 'aoe-breaker') {
    return rear * 2 + (slot.terrain === 'hill' ? 8 : 0);
  }
  return front * 4 + (slot.terrain === 'plain' ? 4 : 0);
}

/** Ranged занимают холмы первыми, затем support ищет укрытие, фронт — передний ряд. */
export function assignEnemyPositions(
  templates: ReadonlyArray<UnitTemplate>,
  terrainMap: ReadonlyArray<ReadonlyArray<Terrain>>,
  rng: RNG,
): Array<{ col: number; row: number }> {
  const slots: Slot[] = [];
  const start = CONFIG.GRID_COLS - CONFIG.ENEMY_ZONE_COLS;
  for (let col = start; col < CONFIG.GRID_COLS; col++) {
    for (let row = 0; row < CONFIG.GRID_ROWS; row++) {
      const terrain = terrainMap[row]?.[col] ?? 'plain';
      if (terrain !== 'rock') slots.push({ col, row, terrain, tie: rng.next() });
    }
  }

  const positions: Array<{ col: number; row: number }> = Array.from(
    { length: templates.length },
    () => ({ col: CONFIG.GRID_COLS - 1, row: 0 }),
  );
  const order = templates.map((_, index) => index).sort((a, b) =>
    placementPriority(templates[a].combatRole ?? 'melee-dps') -
      placementPriority(templates[b].combatRole ?? 'melee-dps') || a - b,
  );

  for (const index of order) {
    const template = templates[index];
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < slots.length; i++) {
      const score = slotScore(template, slots[i]) + slots[i].tie * 0.01;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    const chosen = slots.splice(bestIndex, 1)[0];
    if (chosen) positions[index] = { col: chosen.col, row: chosen.row };
  }
  return positions;
}

export function averageEnemyEpoch(wave: ReadonlyArray<WaveEnemy>): number {
  if (!wave.length) return 0;
  return wave.reduce((sum, enemy) => sum + enemy.epoch, 0) / wave.length;
}

// Совместимость: старый вызов generateWave(wave) трактуется как score=1.
export function generateWave(wave: number): WaveEnemy[];
export function generateWave(
  worldEpochScore: number,
  wave: number,
  terrainMap?: ReadonlyArray<ReadonlyArray<Terrain>>,
): WaveEnemy[];
export function generateWave(
  scoreOrWave: number,
  maybeWave?: number,
  providedTerrain?: ReadonlyArray<ReadonlyArray<Terrain>>,
): WaveEnemy[] {
  const rawWave = maybeWave ?? scoreOrWave;
  const wave = Number.isFinite(rawWave) ? Math.max(1, Math.floor(rawWave)) : 1;
  const rawScore = maybeWave === undefined ? 1 : scoreOrWave;
  const worldEpochScore = Number.isFinite(rawScore)
    ? Math.max(1, Math.min(8, rawScore))
    : 1;
  const scoreSeed = Math.round(worldEpochScore * 1000);
  const rng = new RNG(CONFIG.SEED + wave * 977 + scoreSeed * 131);
  const elite = isEliteWave(wave);
  const count = enemyCount(wave);
  const spread = waveEpochSpread(wave);
  const plan = rolePlan(count, elite, rng);

  const nodes: EvolutionNode[] = [];
  const selectedIds = new Set<string>();
  for (const need of plan) {
    const node = chooseNode(
      need,
      sampleEpoch(worldEpochScore, spread, rng),
      rng,
      selectedIds,
    );
    nodes.push(node);
    selectedIds.add(node.id);
  }
  // Округление отдельных эпох не должно вытолкнуть среднее всего отряда за
  // заявленный диапазон. Сдвигаем крайний профиль, сохраняя его роль.
  for (let guard = 0; guard < 32; guard++) {
    const average = nodes.reduce((sum, node) => sum + node.epoch, 0) / nodes.length;
    if (average > worldEpochScore + spread) {
      let index = 0;
      for (let i = 1; i < nodes.length; i++) if (nodes[i].epoch > nodes[index].epoch) index = i;
      if (nodes[index].epoch <= 1) break;
      const excluded = new Set(nodes.map((node) => node.id));
      excluded.delete(nodes[index].id);
      nodes[index] = chooseNode(plan[index], nodes[index].epoch - 1, rng, excluded);
      continue;
    }
    if (average < worldEpochScore - spread) {
      let index = 0;
      for (let i = 1; i < nodes.length; i++) if (nodes[i].epoch < nodes[index].epoch) index = i;
      if (nodes[index].epoch >= 8) break;
      const excluded = new Set(nodes.map((node) => node.id));
      excluded.delete(nodes[index].id);
      nodes[index] = chooseNode(plan[index], nodes[index].epoch + 1, rng, excluded);
      continue;
    }
    break;
  }
  // Страховка на случай будущего изменения контентных профилей: фронт не может
  // остаться без настоящего танка.
  if (!nodes.some((node) => node.combatRole === 'tank')) {
    const epoch = nodes[0]?.epoch ?? Math.round(worldEpochScore);
    const tanks = EVOLUTION_TREE_NODES.filter((node) => node.combatRole === 'tank' && node.epoch === epoch);
    if (tanks.length) nodes[0] = tanks[rng.int(0, tanks.length - 1)];
  }

  const templates = nodes.map((node) => scaleTemplate(nodeToTemplate(node), wave, elite));
  const terrain = providedTerrain ?? buildTerrainMap(
    CONFIG.GRID_COLS,
    CONFIG.GRID_ROWS,
    terrainSeedForWave(wave),
  );
  const positions = assignEnemyPositions(templates, terrain, rng);

  return nodes.map((node, index) => ({
    templateId: node.id,
    scaled: templates[index],
    col: positions[index].col,
    row: positions[index].row,
    epoch: node.epoch,
    elite,
  }));
}
