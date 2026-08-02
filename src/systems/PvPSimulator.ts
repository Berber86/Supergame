/**
 * @file PvPSimulator.ts
 * @description Чистая архитектурная надстройка под PvP.
 * Выносит боевую симуляцию в изолированную чистую функцию/модуль,
 * не зависящую от Phaser-рендера и того, кто управляет составами (игрок или AI).
 */

import { CONFIG } from '../config';
import { buildTerrainMap, terrainSourceFromMap } from '../data/boardLayout';
import type { UnitTemplate } from '../data/units';
import { HexGrid } from './HexGrid';
import { CombatSystem, type SimResult } from './CombatSystem';

/**
 * Описание юнита в составе для симуляции PvP.
 * Полностью сериализуемо в JSON для отправки по сети.
 */
export interface PvPUnitEntry {
  /** Уникальный ID юнита в базе/ростере игрока */
  id: string;
  /** Полные характеристики юнита в момент боя */
  template: UnitTemplate;
  /** Позиция на гекс-сетке */
  col: number;
  row: number;
  /** Текущее здоровье перед боем */
  currentHp: number;
}

/**
 * Результат PvP симуляции, включающий итоговый результат и
 * полную запись событий для детерминированного реплея на клиенте.
 */
export interface PvPSimulationResult {
  /** Исход боя с точки зрения Squad A (Team 1) */
  result: SimResult;
  /** Общее количество логических тиков */
  totalTicks: number;
  /** Список выживших юнитов в Squad A с их оставшимся HP */
  survivorsA: { id: string; hp: number }[];
  /** Список выживших юнитов в Squad B с их оставшимся HP */
  survivorsB: { id: string; hp: number }[];
}

/**
 * Изолированная ЧИСТАЯ функция симуляции боя для PvP.
 * Не зависит от Phaser-рендера. Принимает два состава и seed ГСЧ.
 * Может запускаться как на клиенте, так и на Node.js сервере.
 * 
 * @param squadA Состав первого игрока (Team 'player')
 * @param squadB Состав второго игрока (Team 'enemy')
 * @param seed Общий seed для детерминированного ГСЧ
 * @returns Итоговые результаты боя
 */
export function simulatePvPCombat(
  squadA: PvPUnitEntry[],
  squadB: PvPUnitEntry[],
  seed: number = CONFIG.SEED
): PvPSimulationResult {
  // 1. Создаем карту рельефа на основе seed'а боя (или фиксированного seed'а арены)
  const terrainSeed = seed + 42; // производный seed для рельефа
  const terrainMap = buildTerrainMap(CONFIG.GRID_COLS, CONFIG.GRID_ROWS, terrainSeed);
  const grid = new HexGrid(
    CONFIG.GRID_COLS,
    CONFIG.GRID_ROWS,
    0,
    0,
    terrainSourceFromMap(terrainMap),
  );

  // 2. Инициализируем систему симуляции
  const sim = new CombatSystem(grid, seed);

  // Карта сопоставления динамических UID симулятора с исходными ID ростера
  const uidToRosterId = new Map<number, string>();

  // 3. Заполняем состав Squad A (выступает за 'player')
  for (const entry of squadA) {
    const u = sim.addUnit(entry.template, 'player', entry.col, entry.row, entry.currentHp);
    uidToRosterId.set(u.uid, entry.id);
  }

  // 4. Заполняем состав Squad B (выступает за 'enemy')
  for (const entry of squadB) {
    const u = sim.addUnit(entry.template, 'enemy', entry.col, entry.row, entry.currentHp);
    uidToRosterId.set(u.uid, entry.id);
  }

  // 5. Запуск боя
  sim.start();

  // 6. Шаг симуляции (фиксированный шаг 0.1 сек) до завершения или тайм-аута (макс. 8000 тиков)
  let ticks = 0;
  const maxTicks = 8000;
  
  while (sim.result === 'ongoing' && ticks < maxTicks) {
    sim.update(0.1);
    ticks++;
  }

  // 7. Сбор итогового состояния выживших
  const survivorsA: { id: string; hp: number }[] = [];
  const survivorsB: { id: string; hp: number }[] = [];

  for (const unit of sim.units) {
    const originalId = uidToRosterId.get(unit.uid);
    if (!originalId) continue;

    if (unit.alive && unit.hp > 0) {
      if (unit.team === 'player') {
        survivorsA.push({ id: originalId, hp: unit.hp });
      } else {
        survivorsB.push({ id: originalId, hp: unit.hp });
      }
    }
  }

  return {
    result: sim.result,
    totalTicks: sim.tickNumber,
    survivorsA,
    survivorsB,
  };
}

/**
 * ============================================================================
 *   ИНСТРУКЦИЯ И РУКОВОДСТВО ПО ПОДКЛЮЧЕНИЮ НАСТОЯЩЕГО PvP (ДЛЯ ПОРТФОЛИО)
 * ============================================================================
 * 
 * Проектируемая архитектура "The Long Line" идеально готова к добавлению PvP:
 * 
 * 1. СЕРИАЛИЗАЦИЯ И ОБМЕН ДАННЫМИ:
 *    - Каждый игрок на этапе расстановки формирует свой состав.
 *    - Перед стартом боя этот состав сериализуется в JSON-массив из объектов PvPUnitEntry:
 *      [
 *        { "id": "ru1", "template": { "id": "knight_errant", "hp": 150, ... }, "col": 0, "row": 2, "currentHp": 150 },
 *        ...
 *      ]
 *    - С помощью WebSocket, Socket.io или REST API игроки обмениваются составами через бэкенд.
 *    - На бэкенде генерируется случайное число (SEED), которое отправляется обоим игрокам.
 * 
 * 2. ДЕТЕРМИНИРОВАННОЕ ВЫПОЛНЕНИЕ (КЛИЕНТ-СЕРВЕР / P2P):
 *    Благодаря тому, что вся логика боя (включая криты, промахи и выбор целей) завязана
 *    на наш псевдослучайный генератор (RNG) с фиксированным SEED, симуляция
 *    является абсолютно детерминированной.
 *    - Вариант "Серверный авторитет" (Рекомендуемый для защиты от читов):
 *      Сервер (Node.js бэкенд) импортирует данный модульPvPSimulator и выполняет
 *      функцию simulatePvPCombat(squadA, squadB, seed). Полученный результат сохраняется,
 *      начисляются награды, и результаты отправляются клиентам.
 *    - Вариант "Синхронный клиентский расчет":
 *      Оба клиента запускают симуляцию локально с одинаковым SEED и составами.
 *      Они получают абсолютно одинаковый результат кадр в кадр, что позволяет избежать
 *      сетевого лага в процессе боя.
 * 
 * 3. ВИЗУАЛИЗАЦИЯ И РЕПЛЕЙ:
 *    - Во время симуляции CombatSystem собирает массив событий (SimEvent[]): движения,
 *      атаки, нанесение урона, каст способностей.
 *    - Клиент может "вычитывать" эти события и отрисовывать их в Phaser-сцене BattleScene,
 *      воспроизводя бой плавно и красиво для пользователя.
 */
