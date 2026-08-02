/**
 * Интеграционный тест Этапа 2: полный путь ростер → волна → бой → последствия.
 * Воспроизводит логику BattleScene без Phaser и проверяет детерминизм и
 * консистентность кампании после боя.
 */
import { CONFIG } from '../src/config';
import { buildTerrainMap, terrainSourceFromMap } from '../src/data/boardLayout';
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
  const grid = new HexGrid(
    CONFIG.GRID_COLS,
    CONFIG.GRID_ROWS,
    0,
    0,
    terrainSourceFromMap(buildTerrainMap(CONFIG.GRID_COLS, CONFIG.GRID_ROWS, CONFIG.TERRAIN_SEED)),
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
  for (const we of generateWave(campaign.wave)) sim.addUnit(we.scaled, 'enemy', we.col, we.row);
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

console.log(`\nИТОГ: ${pass} прошло, ${fail} провалено`);
if (fail > 0) process.exit(1);
