/**
 * equipment.test.js — снаряжение (сессия 9).
 * Приспособление из находок и покупка у Тещи Петровны (выбор человека 1B),
 * «надел — навсегда» (замена = тряпки), эффекты на риск обыска / тепло / вес,
 * рост 💪 Выносливости от работы. Данные — целостность слотов.
 */

import { describe, it, expect } from 'vitest';
import { createGame, death, newLife } from '../js/core/state.js';
import { addItem, capacityKg } from '../js/core/inventory.js';
import { advanceHours } from '../js/core/time.js';
import { dig, digRiskChance, digModeDef, travelTo } from '../js/core/actions.js';
import {
  slotForItem, equipFromInventory, buyEquipment,
  digRiskEquipMult, warmthDecayEquipMult, carryBonusEquipKg, equipmentSourceLabel,
} from '../js/core/equipment.js';
import { EQUIPMENT_SLOTS } from '../js/data/equipment.js';
import { findDistrict, findItem } from '../js/core/lookups.js';

/** Положить предмет и вернуть индекс записи (или умереть пытаясь). */
function give(state, itemId, opts = {}) {
  const res = addItem(state, itemId, opts);
  if (!res.fit) throw new Error(`ноша не вместила ${itemId}`);
  return state.inventory.indexOf(res.entry);
}

describe('данные снаряжения целостны', () => {
  it('fromItems ссылаются на реальные очевидные предметы', () => {
    for (const def of Object.values(EQUIPMENT_SLOTS)) {
      for (const itemId of def.fromItems) {
        const item = findItem(itemId);
        expect(item, itemId).toBeTruthy();
        expect(item.kind).toBe('obvious'); // из бака достаём зримую вещь, не лотерею
      }
      expect(def.shop.price).toBeGreaterThan(0);
    }
  });
});

describe('🧤 приспособление из находок (надел — навсегда)', () => {
  it('рабочие перчатки: из стопки ушла РОВНО одна, слот занят', () => {
    const s = createGame(51);
    give(s, 'perchatki_rabochie', { qty: 2 });
    equipFromInventory(s, 0);
    expect(s.equipment.gloves).toBe('perchatki_rabochie');
    expect(s.inventory[0].qty).toBe(1); // вторая пара осталась в ноше
    expect(digRiskEquipMult(s)).toBe(0.75);
  });

  it('приспособление бесплатно и мгновенно (это решение, не действие)', () => {
    const s = createGame(51);
    give(s, 'kurtka_rybaka');
    equipFromInventory(s, 0);
    expect(s.hour).toBe(8);
    expect(s.money).toBe(60);
    expect(s.equipment.jacket).toBe('kurtka_rybaka');
    expect(s.inventory).toHaveLength(0);
  });

  it('перчатки реально режут риск обыска ровно в 0.75 раза', () => {
    const withOut = createGame(52);
    const withGloves = createGame(52);
    withGloves.equipment.gloves = 'perchatki_rabochie';
    const district = findDistrict('petrogradka');
    const mode = digModeDef(withOut);
    const bare = digRiskChance(withOut, district, mode);
    const gloved = digRiskChance(withGloves, district, mode);
    expect(gloved / bare).toBeCloseTo(0.75, 5);
  });

  it('не всякое приспособить можно: металлолом не одевается', () => {
    const s = createGame(51);
    give(s, 'metall_lom');
    const events = equipFromInventory(s, 0);
    expect(events).toHaveLength(0);
    expect(s.equipment.gloves).toBeNull();
    expect(s.inventory).toHaveLength(1);
    expect(slotForItem('metall_lom')).toBeNull();
    expect(slotForItem('perchatki_rabochie')).toBe('gloves');
    expect(slotForItem('kurtka_rybaka')).toBe('jacket');
  });

  it('повторное надевание в тот же слот: прежнее — на тряпки', () => {
    const s = createGame(51);
    s.equipment.gloves = 'perchatki_veterok'; // купленные были
    give(s, 'perchatki_rabochie');
    const events = equipFromInventory(s, 0);
    expect(s.equipment.gloves).toBe('perchatki_rabochie'); // замещено находкой
    expect(s.inventory).toHaveLength(0);
    expect(events.join(' ')).toContain('тряпки');
  });

  it('мёртвые не одеваются', () => {
    const s = createGame(51);
    give(s, 'perchatki_rabochie');
    s.status = 'dead';
    expect(equipFromInventory(s, 0)).toHaveLength(0);
    expect(s.equipment.gloves).toBeNull();
  });
});

describe('🧰 Теща Петровна (покупка)', () => {
  it('перчатки «Ветерок»: −100 ₽, час примерки, слот занят', () => {
    const s = createGame(53);
    s.money = 200;
    buyEquipment(s, 'gloves');
    expect(s.money).toBe(100);
    expect(s.hour).toBe(9);
    expect(s.equipment.gloves).toBe('perchatki_veterok');
    expect(digRiskEquipMult(s)).toBe(0.75);
  });

  it('не по карману — Петровна посмотрела сквозь тебя, времени не потрачено', () => {
    const s = createGame(53);
    s.money = 50;
    const events = buyEquipment(s, 'gloves');
    expect(s.money).toBe(50);
    expect(s.hour).toBe(8);
    expect(s.equipment.gloves).toBeNull();
    expect(events.join(' ')).toContain('сквозь');
  });

  it('занятый слот второй раз не продаётся', () => {
    const s = createGame(53);
    s.money = 500;
    s.equipment.gloves = 'perchatki_veterok';
    const events = buyEquipment(s, 'gloves');
    expect(events).toHaveLength(0);
    expect(s.money).toBe(500);
  });

  it('🛒 тележка: +15 кг к ноше — помойная логистика крепчает', () => {
    const s = createGame(53);
    expect(carryBonusEquipKg(s)).toBe(0);
    s.money = 600;
    buyEquipment(s, 'cart');
    expect(s.equipment.cart).toBe('telezhka_ashan');
    expect(capacityKg(s)).toBe(20); // 5 базовых + 15 тележки, 💪-0
    expect(carryBonusEquipKg(s)).toBe(15);
  });
});

describe('🧥 куртка против Невы', () => {
  it('тепло тает на 25% медленнее (та же погода, тот же сид)', () => {
    const cold = createGame(54);
    const dight = createGame(54);
    dight.equipment.jacket = 'kurtka_rybaka';
    const w0 = cold.stats.warmth;
    advanceHours(cold, 4);
    advanceHours(dight, 4);
    const bareLoss = w0 - cold.stats.warmth;
    const clothedLoss = w0 - dight.stats.warmth;
    expect(clothedLoss / bareLoss).toBeCloseTo(0.75, 5);
    expect(warmthDecayEquipMult(cold)).toBe(1);
    expect(warmthDecayEquipMult(dight)).toBe(0.75);
  });
});

describe('подписи и смерть', () => {
  it('equipmentSourceLabel: находка, покупка, пустота', () => {
    expect(equipmentSourceLabel('gloves', 'perchatki_rabochie')).toBe('🧤 Рабочие перчатки');
    expect(equipmentSourceLabel('gloves', 'perchatki_veterok')).toBe('🧤 Перчатки «Ветерок»');
    expect(equipmentSourceLabel('gloves', null)).toBe('пусто');
  });

  it('снаряжение — про эту жизнь: newLife раздевает', () => {
    const s = createGame(55);
    s.equipment.gloves = 'perchatki_rabochie';
    death(s, 'Проверка мягкого рогалика.');
    newLife(s);
    expect(s.equipment.gloves).toBeNull();
    expect(s.equipment.jacket).toBeNull();
    expect(s.equipment.cart).toBeNull();
  });
});

describe('💪 выносливость растёт от работы (сессия 9)', () => {
  it('рытьё бака — +1 опыт 💪', () => {
    const s = createGame(56);
    s.districtId = 'petrogradka';
    expect(s.skills.stamina.xp).toBe(0);
    dig(s, 0);
    expect(s.skills.stamina.xp).toBe(1);
  });

  it('пеший переход — +1 опыт 💪', () => {
    const s = createGame(56);
    travelTo(s, 'kupchino');
    expect(s.skills.stamina.xp).toBe(1);
  });
});
