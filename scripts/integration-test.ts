/**
 * Интеграционный тест Этапа 2: полный путь ростер → волна → бой → последствия.
 * Воспроизводит логику BattleScene без Phaser и проверяет детерминизм и
 * консистентность кампании после боя.
 */
import { CONFIG } from '../src/config';
import { buildTerrainMap, terrainSeedForWave, terrainSourceFromMap } from '../src/data/boardLayout';
import { findNode } from '../src/data/evolution-tree';
import { generateWave } from '../src/data/waves';
import { CombatSystem } from '../src/systems/CombatSystem';
import { HexGrid } from '../src/systems/HexGrid';
import { Campaign } from '../src/meta/Campaign';
import { isDeployable, rosterToTemplate } from '../src/meta/RosterUnit';

const store = new Map<string, string>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra = ''): void {
  if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name} ${extra}`); }
}

interface PlayResult {
  result: 'player_win' | 'enemy_win' | 'ongoing';
  uidToRoster: Map<number, string>;
  sim: CombatSystem;
}

function playWave(campaign: Campaign): PlayResult {
  const terrain = buildTerrainMap(
    CONFIG.GRID_COLS,
    CONFIG.GRID_ROWS,
    terrainSeedForWave(campaign.wave),
  );
  const grid = new HexGrid(
    CONFIG.GRID_COLS,
    CONFIG.GRID_ROWS,
    0,
    0,
    terrainSourceFromMap(terrain),
  );
  const sim = new CombatSystem(grid, CONFIG.SEED);
  const uidToRoster = new Map<number, string>();
  const positions: [number, number][] = [
    [0, 1],
    [0, 3],
    [1, 2],
    [2, 3],
    [2, 5],
    [1, 5],
  ];
  campaign.roster.filter(isDeployable).slice(0, 6).forEach((ru, i) => {
    const [col, row] = positions[i];
    const u = sim.addUnit(rosterToTemplate(ru), 'player', col, row, ru.currentHp);
    uidToRoster.set(u.uid, ru.id);
  });
  for (const we of generateWave(campaign.worldEpochScore(), campaign.wave, terrain)) {
    sim.addUnit(we.scaled, 'enemy', we.col, we.row);
  }
  sim.start();
  for (let i = 0; i < 8000; i++) {
    sim.update(0.1);
    if (sim.result !== 'ongoing') break;
  }
  return { result: sim.result, uidToRoster, sim };
}

Campaign.clearSave();
const c = Campaign.newGame();
const waveBefore = c.wave;
const curBefore = c.currency;

console.log('=== Интеграция: одна волна ===');
const r1 = playWave(c);
check('бой завершился (не ongoing)', r1.result !== 'ongoing', `result=${r1.result}`);

// Детерминизм: новый прогон с теми же вводными даёт тот же исход.
const c2 = Campaign.newGame();
const r2 = playWave(c2);
check('результат детерминирован', r1.result === r2.result, `${r1.result} vs ${r2.result}`);

if (r1.result === 'player_win') {
  const report = [...r1.uidToRoster].map(([uid, rid]) => {
    const u = r1.sim.units.find((x) => x.uid === uid);
    return { rosterId: rid, endHp: u ? u.hp : 0, survived: !!u?.alive };
  });
  c.applyVictory(report);
  c.save();
  check('после победы волна +1', c.wave === waveBefore + 1);
  check('после победы валюта выросла', c.currency > curBefore);
  check('HP ростера консистентен (≤ maxHp)', c.roster.every((u) => u.currentHp <= u.maxHp));
} else {
  c.applyDefeat();
  check('после поражения волна та же', c.wave === waveBefore);
  check('после поражения валюта та же', c.currency === curBefore);
}

console.log('\n=== Тест системы эволюции ===');
const testCampaign = Campaign.newGame();
testCampaign.currency = 200; // дадим достаточно золота

// Найдём юнита "mammoth" (Siege, Осада), у него простая прямая эволюция: mammoth -> bronze_ballista -> iron_catapult
const mammothRu = testCampaign.roster.find(u => u.templateId === 'mammoth');
if (mammothRu) {
  check('изначальная эпоха мамонта = 1', mammothRu.epochIndex === 1);
  check('опыт мамонта вначале = 0', mammothRu.battleExperience === 0);
  
  // Добавим опыта
  mammothRu.battleExperience = 2; // порог для 1 эпохи = 1 * 2 = 2
  
  // Попробуем эволюционировать мамонта в баллисту
  const res = testCampaign.evolveUnit(mammothRu.id, 'bronze_ballista');
  check('успешная эволюция мамонта в баллисту', res.ok, res.reason);
  check('после эволюции эпоха мамонта = 2', mammothRu.epochIndex === 2);
  check('опыт сбросился в 0', mammothRu.battleExperience === 0);
  const ballista = findNode('bronze_ballista')!;
  check('имя обновилось', mammothRu.name === ballista.name);
  check(
    'HP обновилось под рассчитанные статы',
    mammothRu.maxHp === ballista.hp && mammothRu.currentHp === ballista.hp,
  );
  check('валюта списалась (200 - 45 = 155)', testCampaign.currency === 155);
} else {
  // Если в стартовом ростере мамонта нет, наймём его вручную для теста
  testCampaign.currency = 200;
  const hireRes = testCampaign.hire('mammoth');
  const freshMammoth = testCampaign.roster.find(u => u.templateId === 'mammoth');
  if (freshMammoth) {
    freshMammoth.battleExperience = 2;
    const res = testCampaign.evolveUnit(freshMammoth.id, 'bronze_ballista');
    check('успешная эволюция нанятого мамонта в баллисту', res.ok, res.reason);
    check('после эволюции эпоха = 2', freshMammoth.epochIndex === 2);
  }
}

// Тест ветвления: guardian (Infantry, Племенной Страж) -> bronze_swordsman или bronze_phalanx
const guardianRu = testCampaign.roster.find(u => u.templateId === 'guardian');
if (guardianRu) {
  guardianRu.battleExperience = 2;
  
  // Попробуем неверную цель эволюции
  const badEvolve = testCampaign.evolveUnit(guardianRu.id, 'bronze_ballista');
  check('нельзя эволюционировать в чужую ветку', !badEvolve.ok);
  
  // Эволюция в бронзового мечника
  const goodEvolve = testCampaign.evolveUnit(guardianRu.id, 'bronze_swordsman');
  check('успешная эволюция стража в мечника', goodEvolve.ok, goodEvolve.reason);
  check('после эволюции эпоха = 2', guardianRu.epochIndex === 2);
  check('имя обновилось в Микенский Мечник', guardianRu.name === 'Микенский Мечник');
}

// Проверим рассчёт мировой эпохи
const avgScore = testCampaign.worldEpochScore();
const manualAverage = testCampaign.roster.reduce((sum, u) => sum + u.epochIndex, 0) / testCampaign.roster.length;
check('мировая эпоха рассчитывается корректно', Math.abs(avgScore - manualAverage) < 0.0001);

console.log(`\nИТОГ: ${pass} прошло, ${fail} провалено`);
if (fail > 0) process.exit(1);
