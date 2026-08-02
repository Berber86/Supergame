/**
 * Headless-скрипт симуляции прохождения кампании для проверки баланса.
 * Имитирует действия среднего игрока: найм, лечение, эволюцию и авто-расстановку,
 * затем проводит бои в CombatSystem и выводит детальный лог прохождения.
 */
import { CONFIG } from '../src/config';
import { buildTerrainMap, terrainSeedForWave, terrainSourceFromMap } from '../src/data/boardLayout';
import { findNode, getEvolutionThreshold } from '../src/data/evolution-tree';
import { generateWave } from '../src/data/waves';
import { STONE_AGE_UNITS } from '../src/data/units';
import { CombatSystem } from '../src/systems/CombatSystem';
import { HexGrid } from '../src/systems/HexGrid';
import { Campaign } from '../src/meta/Campaign';
import { isDeployable, isWounded, isDowned, rosterToTemplate } from '../src/meta/RosterUnit';

// Эмуляция LocalStorage
const store = new Map<string, string>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};

function runSimulation(runId: number) {
  console.log(`\n================== ЗАПУСК СИМУЛЯЦИИ #${runId} ==================`);
  Campaign.clearSave();
  const campaign = Campaign.newGame();
  
  let waveCount = 1;
  const maxWaves = 40;
  let consecutiveDefeats = 0;
  const maxConsecutiveDefeats = 3;

  while (waveCount <= maxWaves && consecutiveDefeats < maxConsecutiveDefeats) {
    const goldBefore = campaign.currency;
    const worldScore = campaign.worldEpochScore();

    // 1. НАЙМ
    while (campaign.freeSlots() > 0 && campaign.currency >= 80) { // Игрок держит резерв на лечение
      // Нанимаем случайного юнита I эпохи
      const randomTpl = STONE_AGE_UNITS[Math.floor(Math.random() * STONE_AGE_UNITS.length)];
      campaign.hire(randomTpl.id);
    }

    // 2. ЛЕЧЕНИЕ
    // Сортируем раненых по приоритету (сражённые в первую очередь, затем сильно раненые)
    const woundedUnits = campaign.roster
      .filter(u => isWounded(u) || isDowned(u))
      .sort((a, b) => (a.currentHp / a.maxHp) - (b.currentHp / b.maxHp));

    for (const ru of woundedUnits) {
      const cost = campaign.healCost(ru);
      if (campaign.currency >= cost) {
        campaign.heal(ru.id);
      }
    }

    // 3. ЭВОЛЮЦИЯ
    for (const ru of campaign.roster) {
      const node = findNode(ru.templateId);
      if (!node || node.nextNodes.length === 0) continue;
      const threshold = getEvolutionThreshold(ru.epochIndex);
      if (ru.battleExperience >= threshold) {
        // Находим доступную эволюцию
        const nextId = node.nextNodes[0]; // берём первую ветку для простоты ИИ
        const nextNode = findNode(nextId);
        if (nextNode && campaign.currency >= nextNode.evolutionCost) {
          campaign.evolveUnit(ru.id, nextId);
        }
      }
    }

    // 4. ДЕПЛОЙ (Выбираем до 8 лучших здоровых юнитов)
    const healthyDeployable = campaign.roster
      .filter(isDeployable)
      .sort((a, b) => b.epochIndex - a.epochIndex || b.currentHp - a.currentHp);

    const deployCount = Math.min(healthyDeployable.length, 8);
    const deployUnits = healthyDeployable.slice(0, deployCount);

    if (deployUnits.length < 4) {
      console.log(`[Волна ${waveCount}] Поражение: Недостаточно живых юнитов для деплоя (${deployUnits.length}/4)`);
      consecutiveDefeats = maxConsecutiveDefeats;
      break;
    }

    // 5. ЗАПУСК СИМУЛЯЦИИ БОЯ
    const terrain = buildTerrainMap(
      CONFIG.GRID_COLS,
      CONFIG.GRID_ROWS,
      terrainSeedForWave(waveCount),
    );
    const grid = new HexGrid(
      CONFIG.GRID_COLS,
      CONFIG.GRID_ROWS,
      0,
      0,
      terrainSourceFromMap(terrain),
    );
    const sim = new CombatSystem(grid, CONFIG.SEED + waveCount * 17);
    const uidToRoster = new Map<number, string>();

    // Размещаем игрока на первых столбцах
    deployUnits.forEach((ru, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2) + 1;
      const u = sim.addUnit(rosterToTemplate(ru), 'player', col, row, ru.currentHp);
      uidToRoster.set(u.uid, ru.id);
    });

    // Размещаем врагов
    const enemyWave = generateWave(worldScore, waveCount, terrain);
    for (const we of enemyWave) {
      sim.addUnit(we.scaled, 'enemy', we.col, we.row);
    }

    sim.start();
    for (let t = 0; t < 6000; t++) {
      sim.update(0.1);
      if (sim.result !== 'ongoing') break;
    }

    // Обработка исхода боя
    if (sim.result === 'player_win') {
      consecutiveDefeats = 0;
      const report = [...uidToRoster].map(([uid, rid]) => {
        const u = sim.units.find((x) => x.uid === uid);
        return { rosterId: rid, endHp: u ? u.hp : 0, survived: !!u?.alive };
      });
      const victory = campaign.applyVictory(report);
      console.log(
        `[Волна ${waveCount}] ПОБЕДА! Эра отряда: ${worldScore.toFixed(2)} | Ростер: ${campaign.roster.length} | Золото: ${goldBefore} -> ${campaign.currency} (+${victory.income})`
      );
      waveCount++;
    } else {
      consecutiveDefeats++;
      campaign.applyDefeat();
      console.log(
        `[Волна ${waveCount}] ПОРАЖЕНИЕ (${consecutiveDefeats}/${maxConsecutiveDefeats}). Золото: ${campaign.currency}`
      );
    }
  }

  console.log(`\nИтог симуляции #${runId}: пройдено волн: ${waveCount - 1}`);
  return waveCount - 1;
}

// Запустим 5 независимых прогонов, чтобы собрать среднюю статистику
const runs = 5;
const results: number[] = [];
for (let i = 1; i <= runs; i++) {
  results.push(runSimulation(i));
}

const averageWave = results.reduce((a, b) => a + b, 0) / runs;
console.log(`\n=== СТАТИСТИКА БАЛАНСА ===`);
console.log(`Пройденные волны по прогонам: ${results.join(', ')}`);
console.log(`Средняя глубина прохождения: ${averageWave.toFixed(1)} волн`);

if (averageWave >= 15 && averageWave <= 39) {
  console.log('✓ Кривая сложности хорошо сбалансирована. Игрок доходит до середины/конца игры, сталкиваясь с возрастающим вызовом.');
} else if (averageWave < 15) {
  console.log('⚠ Сложность слишком высокая! Игрок слишком быстро терпит поражение. Рекомендуется увеличить доходы или уменьшить scaling врагов.');
} else {
  console.log('⚠ Игра слишком простая! Игрок легко проходит до конца. Рекомендуется усилить scaling врагов.');
}
