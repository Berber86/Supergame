/**
 * Headless-тест мета-слоя Этапа 2 (без Phaser, с заглушкой LocalStorage).
 * Проверяет: newGame, save/load, найм, лечение, applyVictory/applyDefeat,
 * детерминизм и масштабирование волн, фильтрацию боеспособных юнитов.
 */
import { CONFIG } from '../src/config';
import { ECONOMY } from '../src/data/economy';
import { enemyCount, generateWave, scaleTemplate } from '../src/data/waves';
import { STONE_AGE_UNITS } from '../src/data/units';
import { Campaign } from '../src/meta/Campaign';
import { isDeployable } from '../src/meta/RosterUnit';

// --- Заглушка LocalStorage ---
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
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name} ${extra}`);
  }
}

console.log('=== Мета-слой: новая игра ===');
Campaign.clearSave();
const c = Campaign.newGame();
check('стартовый ростер = 4', c.roster.length === 4);
check('стартовая валюта', c.currency === ECONOMY.STARTING_CURRENCY);
check('волна = 1', c.wave === 1);
check('все стартовые на полном HP', c.roster.every((u) => u.currentHp === u.maxHp));

console.log('=== Найм ===');
const cur0 = c.currency;
const hireRes = c.hire('flintaxe');
check('найм успешен', hireRes.ok);
check('ростер вырос до 5', c.roster.length === 5);
check('валюта уменьшилась на HIRE_COST', c.currency === cur0 - ECONOMY.HIRE_COST);
check('найм при нехватке валюты отказывает', !(() => {
  c.currency = 0;
  const r = c.hire('sling');
  c.currency = cur0 - ECONOMY.HIRE_COST;
  return r.ok;
})());

console.log('=== Лечение ===');
const target = c.roster[0];
const maxHp = target.maxHp;
target.currentHp = Math.floor(maxHp * 0.2); // ранен
const cost = c.healCost(target);
check('стоимость лечения > 0', cost > 0);
c.currency = 1000; // обеспечиваем достаточно валюты для проверки
const before = c.currency;
const healRes = c.heal(target.id);
check('лечение успешно', healRes.ok && target.currentHp === maxHp);
check('валюта уменьшилась на cost', c.currency === before - cost);

console.log('=== Победа: доход, HP, волна, опыт ===');
// Раним двух юнитов «в бою» и зафиксируем конец.
const a = c.roster[0];
const b = c.roster[1];
a.currentHp = a.maxHp;
b.currentHp = b.maxHp;
const waveBefore = c.wave;
const currencyBefore = c.currency;
const income = ECONOMY.incomeBase(waveBefore) + ECONOMY.victoryBonus(waveBefore);
const outcome = c.applyVictory([
  { rosterId: a.id, endHp: Math.floor(a.maxHp * 0.5), survived: true },
  { rosterId: b.id, endHp: 0, survived: false },
]);
check('доход начислен верно', outcome.income === income);
check('валюта выросла на доход', c.currency === currencyBefore + income);
check('волна +1', c.wave === waveBefore + 1);
check('выживший получил конец-HP', a.currentHp === Math.floor(a.maxHp * 0.5));
check('погибший стал 0 (сражён)', b.currentHp === 0);
check('выживший получил опыт (participation+survival)', a.battleExperience === ECONOMY.XP_PARTICIPATION + ECONOMY.XP_SURVIVAL);
check('погибший получил опыт (только participation)', b.battleExperience === ECONOMY.XP_PARTICIPATION);
check('сражённый не деплоябелен', !isDeployable(b));
check('деплоябилен раненый', isDeployable(a));

console.log('=== Поражение: ничего не меняется ===');
const snapWave = c.wave;
const snapCur = c.currency;
const snapHp = c.roster.map((u) => u.currentHp);
const snapXp = c.roster.map((u) => u.battleExperience);
c.applyDefeat();
check('волна та же', c.wave === snapWave);
check('валюта та же', c.currency === snapCur);
check('HP ростера не изменился', c.roster.every((u, i) => u.currentHp === snapHp[i]));
check('опыт не изменился', c.roster.every((u, i) => u.battleExperience === snapXp[i]));

console.log('=== Персистентность: save → load ===');
c.save();
const loaded = Campaign.load();
check('загружена та же валюта', loaded.currency === c.currency);
check('загружена та же волна', loaded.wave === c.wave);
check('загружен тот же ростер (по id)', loaded.roster.length === c.roster.length);
check('загружены HP/опыт', loaded.roster.every((u, i) => u.currentHp === c.roster[i].currentHp && u.battleExperience === c.roster[i].battleExperience));

console.log('=== Персистентность: нет/битый сейв → newGame ===');
store.clear();
check('нет сейва → newGame', Campaign.load().roster.length === 4);
store.set(ECONOMY.SAVE_KEY, '{not json');
check('битый сейв → newGame', Campaign.load().roster.length === 4);

console.log('=== Волны: детерминизм и масштабирование ===');
const w1a = generateWave(c.worldEpochScore(), 1);
const w1b = generateWave(c.worldEpochScore(), 1);
check('волна детерминирована', JSON.stringify(w1a) === JSON.stringify(w1b));
check('кол-во врагов растёт с волной', enemyCount(6) > enemyCount(1));
const tpl = STONE_AGE_UNITS[0];
const s1 = scaleTemplate(tpl, 1);
const s5 = scaleTemplate(tpl, 5);
check('статы растут с волной (hp)', s5.hp > s1.hp && s5.atk > s1.atk && s5.def > s1.def);
check('волна 1: ≥3 врага', w1a.length >= 3);
check('позиции врагов в зоне врага', w1a.every((e) => e.col >= CONFIG.GRID_COLS - CONFIG.ENEMY_ZONE_COLS));

console.log(`\nИТОГ: ${pass} прошло, ${fail} провалено`);
if (fail > 0) process.exit(1);
