/** Headless acceptance + быстрый баланс-проход для Этапа 4. */
import { CONFIG } from '../src/config';
import { buildTerrainMap, terrainSeedForWave, terrainSourceFromMap } from '../src/data/boardLayout';
import {
  EPOCH_NAMES,
  EVOLUTION_TREE_NODES,
  findNode,
  nodeToTemplate,
  type EvolutionLine,
} from '../src/data/evolution-tree';
import type { SpecialAbilityType } from '../src/data/special-abilities';
import {
  assignEnemyPositions,
  averageEnemyEpoch,
  generateWave,
  isEliteWave,
  scaleTemplate,
  waveEpochSpread,
} from '../src/data/waves';
import type { Terrain } from '../src/data/terrain';
import { CombatSystem } from '../src/systems/CombatSystem';
import { HexGrid } from '../src/systems/HexGrid';
import { RNG } from '../src/systems/RNG';

let pass = 0;
let fail = 0;
function check(name: string, condition: boolean, extra = ''): void {
  if (condition) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

console.log('=== Контент и дерево ===');
check('ровно 72 юнита', EVOLUTION_TREE_NODES.length === 72);
check('ID уникальны', new Set(EVOLUTION_TREE_NODES.map((node) => node.id)).size === 72);
for (let epoch = 1; epoch <= 8; epoch++) {
  const nodes = EVOLUTION_TREE_NODES.filter((node) => node.epoch === epoch);
  check(`${EPOCH_NAMES[epoch as keyof typeof EPOCH_NAMES]}: 9 юнитов`, nodes.length === 9);
}
check(
  'нет заглушек в имени/описании',
  EVOLUTION_TREE_NODES.every((node) => !/заглуш|placeholder|эпохи \d \(/i.test(`${node.name} ${node.description}`)),
);
check(
  'все статы валидны',
  EVOLUTION_TREE_NODES.every((node) =>
    node.hp > 0 && node.atk > 0 && node.def >= 0 && node.atkSpeed > 0 &&
    node.range >= 1 && node.move > 0,
  ),
);
check(
  'все рёбра ведут в ту же линию следующей эпохи',
  EVOLUTION_TREE_NODES.every((node) => node.nextNodes.every((id) => {
    const next = findNode(id);
    return !!next && next.epoch === node.epoch + 1 && next.line === node.line;
  })),
);
check(
  'флаг branch point согласован с рёбрами',
  EVOLUTION_TREE_NODES.every((node) => node.is_branch_point === (node.nextNodes.length > 1)),
);

const lines: EvolutionLine[] = ['Infantry', 'Ranged', 'Cavalry', 'Support', 'Siege'];
for (const line of lines) {
  const starts = EVOLUTION_TREE_NODES.filter((node) => node.epoch === 1 && node.line === line);
  const reachesFuture = starts.every((start) => {
    let frontier = [start.id];
    const visited = new Set<string>();
    while (frontier.length) {
      const id = frontier.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const node = findNode(id)!;
      if (node.epoch === 8) return true;
      frontier.push(...node.nextNodes);
    }
    return false;
  });
  check(`${line}: есть полный путь I→VIII`, reachesFuture);
}

const abilities = EVOLUTION_TREE_NODES.filter((node) => node.special_ability);
const abilityTypes = new Set(abilities.map((node) => node.special_ability!.type));
check('ровно 1/3 юнитов имеет special_ability', abilities.length === 24);
check('реализованы все 8 общих типов эффектов', abilityTypes.size === 8);
check(
  'каждый эффект переиспользован',
  [...abilityTypes].every((type) => abilities.filter((node) => node.special_ability?.type === type).length >= 2),
);

const statKeys = ['hp', 'atk', 'def'] as const;
for (const key of statKeys) {
  let monotonic = true;
  let previous = 0;
  for (let epoch = 1; epoch <= 8; epoch++) {
    const nodes = EVOLUTION_TREE_NODES.filter((node) => node.epoch === epoch);
    const average = nodes.reduce((sum, node) => sum + node[key], 0) / nodes.length;
    if (average <= previous) monotonic = false;
    previous = average;
  }
  check(`средний ${key.toUpperCase()} растёт по эпохам`, monotonic);
}

console.log('\n=== Процедурные волны ===');
let allWavesValid = true;
let allMeansValid = true;
let deterministic = true;
for (let waveNumber = 1; waveNumber <= 40; waveNumber++) {
  const score = 1 + ((waveNumber * 37) % 701) / 100;
  const terrain = buildTerrainMap(
    CONFIG.GRID_COLS,
    CONFIG.GRID_ROWS,
    terrainSeedForWave(waveNumber),
  );
  const waveA = generateWave(score, waveNumber, terrain);
  const waveB = generateWave(score, waveNumber, terrain);
  deterministic &&= JSON.stringify(waveA) === JSON.stringify(waveB);
  const keys = new Set(waveA.map((enemy) => `${enemy.col},${enemy.row}`));
  const roleCount = (roles: string[]) => waveA.filter(
    (enemy) => roles.includes(enemy.scaled.combatRole ?? ''),
  ).length;
  allWavesValid &&=
    waveA.length >= 4 && waveA.length <= 8 &&
    waveA.some((enemy) => enemy.scaled.combatRole === 'tank') &&
    roleCount(['aoe-breaker']) <= 1 &&
    roleCount(['support-heal', 'support-buff']) <= 2 &&
    roleCount(['ranged-dps']) <= 3 &&
    keys.size === waveA.length &&
    waveA.every((enemy) =>
      enemy.col >= CONFIG.GRID_COLS - CONFIG.ENEMY_ZONE_COLS &&
      terrain[enemy.row][enemy.col] !== 'rock' &&
      enemy.elite === isEliteWave(waveNumber),
    );
  allMeansValid &&=
    Math.abs(averageEnemyEpoch(waveA) - score) <= waveEpochSpread(waveNumber) + 1e-9;
}
check('40 волн: 4–8, танк, ролевые лимиты, позиции уникальны/проходимы', allWavesValid);
check('средняя эпоха всегда внутри заявленного разброса', allMeansValid);
check('генерация полностью детерминирована', deterministic);
check('разброс растёт с номером волны', waveEpochSpread(30) > waveEpochSpread(1));
const eliteWave = generateWave(3, CONFIG.WAVES.ELITE_EVERY);
check(
  'контрольная волна элитная и усилена',
  eliteWave.every((enemy) => {
    const base = nodeToTemplate(findNode(enemy.templateId)!);
    const regular = scaleTemplate(base, CONFIG.WAVES.ELITE_EVERY, false);
    return enemy.elite &&
      enemy.scaled.hp > regular.hp &&
      enemy.scaled.atk > regular.atk &&
      enemy.scaled.def > regular.def;
  }),
);
const lateWave = generateWave(7.4, 32);
check('поздний score действительно даёт поздние эпохи', averageEnemyEpoch(lateWave) >= 6);

const syntheticTerrain: Terrain[][] = Array.from(
  { length: CONFIG.GRID_ROWS },
  () => Array<Terrain>(CONFIG.GRID_COLS).fill('plain'),
);
syntheticTerrain[0][10] = 'hill';
syntheticTerrain[1][10] = 'hill';
const ranged = EVOLUTION_TREE_NODES.filter((node) => node.epoch === 4 && node.combatRole === 'ranged-dps');
const tank = EVOLUTION_TREE_NODES.find((node) => node.epoch === 4 && node.combatRole === 'tank')!;
const tacticalTemplates = [nodeToTemplate(ranged[0]), nodeToTemplate(ranged[1]), nodeToTemplate(tank)];
const tacticalPositions = assignEnemyPositions(tacticalTemplates, syntheticTerrain, new RNG(42));
check(
  'ranged занимают доступные холмы раньше фронта',
  tacticalPositions.slice(0, 2).every((pos) => syntheticTerrain[pos.row][pos.col] === 'hill'),
);

console.log('\n=== Smoke-прохождение I→VIII ===');
const benchmarkWaves = [1, 9, 14, 19, 24, 29, 34, 39];
let benchmarkResolved = 0;
let benchmarkWins = 0;
for (let epoch = 1; epoch <= 8; epoch++) {
  const terrain = buildTerrainMap(
    CONFIG.GRID_COLS,
    CONFIG.GRID_ROWS,
    terrainSeedForWave(benchmarkWaves[epoch - 1]),
  );
  const sim = new CombatSystem(
    new HexGrid(
      CONFIG.GRID_COLS,
      CONFIG.GRID_ROWS,
      0,
      0,
      terrainSourceFromMap(terrain),
    ),
    CONFIG.SEED,
  );
  const era = EVOLUTION_TREE_NODES.filter((node) => node.epoch === epoch);
  const chosen: typeof era = [];
  const take = (role: string): void => {
    const node = era.find((candidate) =>
      candidate.combatRole === role && !chosen.includes(candidate),
    );
    if (node) chosen.push(node);
  };
  ['tank', 'melee-dps', 'ranged-dps', 'ranged-dps', 'melee-dps',
    'support-heal', 'support-buff', 'aoe-breaker'].forEach(take);

  const placementOrder = [...chosen].sort((a, b) => {
    const priority = (role: string) => role === 'ranged-dps' ? 0 : role.startsWith('support') ? 1 : 2;
    return priority(a.combatRole) - priority(b.combatRole);
  });
  const cells = sim.grid.cells.flat().filter((cell) => cell.col < CONFIG.PLAYER_ZONE_COLS && !cell.blocked);
  for (const node of placementOrder) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const score = node.combatRole === 'ranged-dps'
        ? (cell.terrain === 'hill' ? 100 : 0) - cell.col * 4
        : node.combatRole.startsWith('support')
        ? (cell.terrain === 'forest' ? 24 : 0) - cell.col * 3
        : cell.col * 4;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    const cell = cells.splice(bestIndex, 1)[0];
    sim.addUnit(nodeToTemplate(node), 'player', cell.col, cell.row);
  }
  const enemyWave = generateWave(epoch, benchmarkWaves[epoch - 1], terrain);
  enemyWave.forEach((enemy) => sim.addUnit(enemy.scaled, 'enemy', enemy.col, enemy.row));
  sim.start();
  for (let tick = 0; tick < 3000 && sim.result === 'ongoing'; tick++) sim.update(0.1);
  if (sim.result !== 'ongoing') benchmarkResolved++;
  if (sim.result === 'player_win') benchmarkWins++;
}
console.log(`  Победы смешанного отряда в регулярных контрольных волнах: ${benchmarkWins}/8`);
check('репрезентативные бои всех 8 эпох завершились', benchmarkResolved === 8);
check(
  'смешанный отряд проходит ≥6 из 8 регулярных контрольных волн',
  benchmarkWins >= 6,
  `${benchmarkWins}/8`,
);

function plainGrid(): HexGrid {
  const map: Terrain[][] = Array.from(
    { length: CONFIG.GRID_ROWS },
    () => Array<Terrain>(CONFIG.GRID_COLS).fill('plain'),
  );
  return new HexGrid(
    CONFIG.GRID_COLS,
    CONFIG.GRID_ROWS,
    0,
    0,
    terrainSourceFromMap(map),
  );
}

console.log('\n=== Подключение special_ability к FSM ===');
const observed = new Set<SpecialAbilityType>();
for (const type of [...abilityTypes] as SpecialAbilityType[]) {
  const casterNode = abilities.find((node) => node.special_ability?.type === type)!;
  const tankNode = EVOLUTION_TREE_NODES.find(
    (node) => node.epoch === casterNode.epoch && node.combatRole === 'tank',
  )!;
  const allyNode = EVOLUTION_TREE_NODES.find(
    (node) => node.epoch === casterNode.epoch && node.combatRole === 'melee-dps',
  )!;
  const sim = new CombatSystem(plainGrid(), 9000 + casterNode.epoch * 17 + type.length);
  sim.addUnit(nodeToTemplate(casterNode), 'player', 1, 3);
  sim.addUnit(nodeToTemplate(allyNode), 'player', 1, 2, Math.round(allyNode.hp * 0.45));
  const durableTarget = {
    ...nodeToTemplate(tankNode),
    hp: tankNode.hp * 4,
    atk: 1,
    name: `Манекен: ${tankNode.name}`,
  };
  sim.addUnit(durableTarget, 'enemy', 8, 3);
  sim.start();
  for (let tick = 0; tick < 900 && sim.result === 'ongoing'; tick++) {
    sim.update(0.1);
    for (const event of sim.events) {
      if (event.type === 'ability') observed.add(event.ability);
    }
  }
}
for (const type of [...abilityTypes].sort()) {
  check(`${type} реально срабатывает в симуляции`, observed.has(type));
}

console.log('\n=== Быстрый баланс-чек линий ===');
const lineWins = new Map<EvolutionLine, number>(lines.map((line) => [line, 0]));
let unresolved = 0;
const unresolvedMatches: string[] = [];
for (let epoch = 1; epoch <= 8; epoch++) {
  const era = EVOLUTION_TREE_NODES.filter((node) => node.epoch === epoch);
  const balanced = [
    era.find((node) => node.combatRole === 'tank')!,
    era.find((node) => node.combatRole === 'melee-dps')!,
    era.find((node) => node.combatRole === 'ranged-dps')!,
    era.find((node) => node.combatRole === 'support-heal')!,
  ];
  for (const line of lines) {
    const specialists = era.filter((node) => node.line === line);
    const player = Array.from({ length: 4 }, (_, i) => specialists[i % specialists.length]);
    const sim = new CombatSystem(plainGrid(), 40000 + epoch * 101 + lines.indexOf(line));
    const playerSlots = [[0, 1], [0, 3], [1, 2], [1, 5]];
    const enemySlots = [[10, 1], [10, 3], [9, 2], [9, 5]];
    player.forEach((node, i) => sim.addUnit(nodeToTemplate(node), 'player', playerSlots[i][0], playerSlots[i][1]));
    balanced.forEach((node, i) => sim.addUnit(nodeToTemplate(node), 'enemy', enemySlots[i][0], enemySlots[i][1]));
    sim.start();
    for (let tick = 0; tick < 3000 && sim.result === 'ongoing'; tick++) sim.update(0.1);
    if (sim.result === 'player_win') lineWins.set(line, lineWins.get(line)! + 1);
    if (sim.result === 'ongoing') {
      unresolved++;
      unresolvedMatches.push(`${line}@${epoch}`);
    }
  }
}
console.log('  Победы моно-линий против сбалансированного отряда (из 8):', Object.fromEntries(lineWins));
check(
  'все 40 матчей завершились (включая overtime)',
  unresolved === 0,
  `${unresolved} зависло: ${unresolvedMatches.join(', ')}`,
);
check(
  'ни одна моно-линия не доминирует во всех 8 эпохах',
  [...lineWins.values()].every((wins) => wins < 8),
  JSON.stringify(Object.fromEntries(lineWins)),
);

console.log(`\nИТОГ ЭТАПА 4: ${pass} прошло, ${fail} провалено`);
if (fail > 0) process.exit(1);
