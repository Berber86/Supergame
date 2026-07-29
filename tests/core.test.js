/**
 * core.test.js — тесты игрового ядра (сессия 4):
 * детерминизм RNG, течение времени, распад, сон/мороз, rebirth, сейв.
 * Всё через явные сиды — случайности здесь не место, только Питер.
 */

import { describe, it, expect } from 'vitest';
import { nextRandom, makeRoller } from '../js/core/rng.js';
import { createGame, newLife, pushLog, SAVE_VERSION } from '../js/core/state.js';
import { advanceHours, sleep } from '../js/core/time.js';
import { travelTo, beg } from '../js/core/actions.js';
import { skillLevelFromXp, addSkillXp } from '../js/core/skills.js';
import { serialize, deserialize, isValidStateShape } from '../js/core/persist.js';
import { findWeather } from '../js/core/lookups.js';
import { DECAY, START, LIVING, BEGGING, NIGHT_RISK, TIME as TIMEC } from '../js/data/balance.js';

/** Создать игру с нейтральным небом (облачно, множитель тепла ×1). */
function newGame(seed = 42) {
  const s = createGame(seed);
  s.weatherId = 'cloud';
  return s;
}

describe('rng.js — детерминизм', () => {
  it('одинаковый сид → одинаковая последовательность', () => {
    const a = makeRoller(123);
    const b = makeRoller(123);
    for (let i = 0; i < 100; i += 1) {
      expect(a.roll()).toBe(b.roll());
    }
  });

  it('разные сиды → разные последовательности', () => {
    const a = makeRoller(1);
    const b = makeRoller(2);
    const seqA = Array.from({ length: 10 }, () => a.roll());
    const seqB = Array.from({ length: 10 }, () => b.roll());
    expect(seqA).not.toEqual(seqB);
  });

  it('nextRandom чистая: из одного состояния — одно значение', () => {
    const r1 = nextRandom(777);
    const r2 = nextRandom(777);
    expect(r1.value).toBe(r2.value);
    expect(r1.state).toBe(r2.state);
  });

  it('значения в [0,1), int() в диапазоне, weighted не падает', () => {
    const r = makeRoller(9);
    for (let i = 0; i < 1000; i += 1) {
      const v = r.roll();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    const r2 = makeRoller(9);
    for (let i = 0; i < 100; i += 1) {
      const idx = r2.int(5);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(5);
      const entry = r2.weighted([{ id: 'x', weight: 0 }, { id: 'y', weight: 10 }]);
      expect(entry.id).toBe('y');
    }
  });
});

describe('state.js — создание игры', () => {
  it('стартовое состояние корректно и детерминировано по сиду', () => {
    const s1 = createGame(42);
    const s2 = createGame(42);
    expect(s1.weatherId).toBe(s2.weatherId);
    expect(findWeather(s1.weatherId)).toBeDefined();
    expect(s1.day).toBe(1);
    expect(s1.hour).toBe(TIMEC.START_HOUR);
    expect(s1.districtId).toBe('nochlezhka');
    expect(s1.status).toBe('alive');
    expect(s1.money).toBe(START.money);
    expect(s1.log.length).toBeGreaterThan(0);
  });
});

describe('time.js — распад и смерть', () => {
  it('за N часов статы падают согласно DECAY (облачно = ×1 к теплу)', () => {
    const s = newGame();
    advanceHours(s, 4, []);
    expect(s.stats.satiety).toBeCloseTo(START.satiety + DECAY.satietyPerHour * 4, 5);
    expect(s.stats.warmth).toBeCloseTo(START.warmth + DECAY.warmthPerHour * 4, 5);
    expect(s.hour).toBe(TIMEC.START_HOUR + 4);
  });

  it('при сытости 0 тает здоровье и наступает смерть', () => {
    const s = newGame();
    s.stats.satiety = 0;
    s.stats.health = 5;
    advanceHours(s, 10, []);
    expect(s.status).toBe('dead');
    expect(s.deathCause).toContain('Голод');
  });

  it('переход через полночь = вынужденный сон и новый день', () => {
    const s = newGame();
    s.hour = 22;
    advanceHours(s, 3, []);
    expect(s.day).toBe(2);
    expect(s.hour).toBe(TIMEC.START_HOUR + 1); // 22→23, полночь→сон→8:00, ещё час→9:00
  });

  it('энергия на нуле → отключился и проспал до утра', () => {
    const s = newGame();
    s.stats.energy = 0.5;
    const events = advanceHours(s, 1, []);
    expect(events.some((e) => e.includes('Силы кончились'))).toBe(true);
    expect(s.day).toBe(2);
  });

  it('сон на ночлежке: деньги списаны, энергия по качеству', () => {
    const s = newGame();
    s.money = 500;
    s.stats.energy = 20;
    const nochlezhka = LIVING.shelter.find((x) => x.id === 'nochlezhka');
    const events = sleep(s, 'nochlezhka', []);
    expect(s.money).toBe(500 - nochlezhka.price);
    expect(s.stats.energy).toBeCloseTo(LIVING.energyFromSleep * nochlezhka.quality, 5);
    expect(events.some((e) => e.includes('День 2'))).toBe(true);
  });

  it('если на ночлежку не хватило — бесплатная лавка', () => {
    const s = newGame();
    s.money = 10;
    const events = sleep(s, 'nochlezhka', []);
    expect(s.money).toBe(10); // ничего не списали
    expect(events.some((e) => e.includes('не хватило'))).toBe(true);
  });
});

describe('time.js — морозная лавка (выбор человека: жёстко)', () => {
  /** Найти сид, где сон в мороз убивает, и сид, где выживаешь. */
  function findSeed(predicate) {
    for (let seed = 1; seed < 500; seed += 1) {
      const s = newGame(seed);
      s.weatherId = 'frost';
      sleep(s, 'lavka', []);
      if (predicate(s)) return seed;
    }
    return null;
  }

  it('есть сиды со смертью и выживанием, и обход детерминирован', () => {
    const deathSeed = findSeed((s) => s.status === 'dead');
    const aliveSeed = findSeed((s) => s.status === 'alive');
    expect(deathSeed).not.toBeNull();
    expect(aliveSeed).not.toBeNull();

    // Тот же сид — тот же исход повторно.
    const again = newGame(deathSeed);
    again.weatherId = 'frost';
    sleep(again, 'lavka', []);
    expect(again.status).toBe('dead');
    expect(again.deathCause).toContain('Морозная ночь');
  });

  it('вероятность смерти близка к NIGHT_RISK (~20%) на большой выборке', () => {
    let deaths = 0;
    const N = 400;
    for (let seed = 1; seed <= N; seed += 1) {
      const s = newGame(seed * 7);
      s.weatherId = 'frost';
      sleep(s, 'lavka', []);
      if (s.status === 'dead') deaths += 1;
    }
    expect(deaths / N).toBeGreaterThan(NIGHT_RISK.lavkaFrostDeathChance - 0.06);
    expect(deaths / N).toBeLessThan(NIGHT_RISK.lavkaFrostDeathChance + 0.06);
  });

  it('в мороз можно выспаться на ночлежке — безопасно', () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const s = newGame(seed);
      s.weatherId = 'frost';
      s.money = 500;
      sleep(s, 'nochlezhka', []);
      expect(s.status).toBe('alive');
    }
  });

  it('ночная кража на лавке уносит предмет и пишется в события', () => {
    // Ищем сид, где кража случается (погода не морозная — иначе смерть мешает).
    for (let seed = 1; seed < 500; seed += 1) {
      const s = newGame(seed);
      s.weatherId = 'cloud';
      s.inventory.push({ itemId: 'molotok_slesarnyy', qty: 1 });
      const events = sleep(s, 'lavka', []);
      if (events.some((e) => e.includes('стащили'))) {
        expect(s.inventory.length).toBe(0);
        return;
      }
    }
    throw new Error('сид с кражей не найден — NIGHT_RISK сломан?');
  });
});

describe('actions.js — переходы и попрошайничество', () => {
  it('переход стоит часы по матрице и энергию', () => {
    const s = newGame();
    travelTo(s, 'nevsky', []);
    expect(s.districtId).toBe('nevsky');
    expect(s.hour).toBe(TIMEC.START_HOUR + 1); // ночлежка → невский = 1 ч
    expect(s.stats.energy).toBeCloseTo(START.energy - 4 - Math.abs(DECAY.energyPerHour), 5);
  });

  it('переход в неизвестный/текущий район — игнор', () => {
    const s = newGame();
    travelTo(s, 'neptun', []);
    travelTo(s, 'nochlezhka', []);
    expect(s.districtId).toBe('nochlezhka');
    expect(s.hour).toBe(TIMEC.START_HOUR);
  });

  it('попрошайничество: +40 ₽ за час, без событий на отруб', () => {
    const s = newGame();
    const events = beg(s, []);
    expect(s.money).toBe(START.money + BEGGING.income);
    expect(s.hour).toBe(TIMEC.START_HOUR + BEGGING.hours);
    expect(s.earnedThisLife).toBe(BEGGING.income);
    expect(events.some((e) => e.includes('шапкой'))).toBe(true);
  });

  it('мёртвые не ходят и не просят', () => {
    const s = newGame();
    s.status = 'dead';
    beg(s, []);
    travelTo(s, 'nevsky', []);
    expect(s.money).toBe(START.money);
    expect(s.districtId).toBe('nochlezhka');
  });
});

describe('state.js — новая жизнь (мягкий рогалик)', () => {
  it('навыки переживают смерть, деньги и ноша — нет', () => {
    const s = newGame();
    addSkillXp(s, 'search', 50); // level 2
    s.money = 777;
    s.inventory.push({ itemId: 'metall_lom', qty: 2 });
    s.status = 'dead';

    newLife(s, []);

    expect(s.status).toBe('alive');
    expect(s.lives).toBe(2);
    expect(s.skills.search.level).toBe(2);
    expect(s.money).toBe(50);
    expect(s.inventory.length).toBe(0);
    expect(s.day).toBe(1);
    expect(s.legacyBonus).toBeCloseTo(0.05, 10);
  });

  it('наследие репутации растёт по жизням и упирается в кап', () => {
    const s = newGame();
    for (let i = 0; i < 10; i += 1) newLife(s, []);
    expect(s.legacyBonus).toBeLessThanOrEqual(0.25);
    expect(s.lives).toBe(11);
  });

  it('журнал капнут и не раздувается бесконечно', () => {
    const s = newGame();
    for (let i = 0; i < 200; i += 1) pushLog(s, `запись ${i}`);
    expect(s.log.length).toBeLessThanOrEqual(80);
  });
});

describe('skills.js — формула уровней', () => {
  it('level = floor(sqrt(xp/10)): 0→0, 10→1, 40→2, 90→3', () => {
    expect(skillLevelFromXp(0)).toBe(0);
    expect(skillLevelFromXp(9)).toBe(0);
    expect(skillLevelFromXp(10)).toBe(1);
    expect(skillLevelFromXp(40)).toBe(2);
    expect(skillLevelFromXp(90)).toBe(3);
    expect(skillLevelFromXp(10000)).toBe(10); // кап
  });

  it('addSkillXp сообщает о поднятии уровня', () => {
    const s = newGame();
    expect(addSkillXp(s, 'search', 5)).toBe(false);
    expect(addSkillXp(s, 'search', 5)).toBe(true); // 10 xp → level 1
    expect(s.skills.search.level).toBe(1);
  });
});

describe('persist.js — сериализация', () => {
  it('сейв = чистый JSON, round-trip без потерь', () => {
    const s = newGame(7);
    beg(s, []);
    const restored = deserialize(serialize(s));
    expect(restored).toEqual(s);
  });

  it('deserialize отбраковывает мусор и чужие форматы', () => {
    expect(deserialize('not json')).toBeNull();
    expect(deserialize('{"hello":"world"}')).toBeNull();
    expect(deserialize(JSON.stringify({ saveVersion: SAVE_VERSION + 99 }))).toBeNull();
    expect(isValidStateShape(newGame())).toBe(true);
  });
});
