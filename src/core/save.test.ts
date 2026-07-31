/**
 * Тесты сейв-системы: roundtrip сериализации, повреждённые данные,
 * кап офлайн-дохода 8 часов (GDD §3.5).
 */

import { describe, expect, it } from 'vitest';
import {
  computeOfflineMs,
  createInitialState,
  isValidState,
  loadState,
  saveState,
  OFFLINE_CAP_HOURS,
  OFFLINE_CAP_MS,
} from './save';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

describe('сейв-система', () => {
  it('создаёт валидное начальное состояние', () => {
    const s = createInitialState(1_000);
    expect(s.gold).toBe(0);
    expect(s.servants).toEqual([]);
    expect(s.raid.kingdomId).toBeNull();
    expect(s.lastSavedAt).toBe(1_000);
  });

  it('круговорот сохранить → загрузить сохраняет состояние', () => {
    const storage = memoryStorage();
    const state = createInitialState(100);
    state.gold = 777;
    state.servants = [{ id: 'gnome-prospector', count: 3 }];
    saveState(state, storage);

    const loaded = loadState(storage);
    expect(loaded).not.toBeNull();
    expect(loaded!.gold).toBe(777);
    expect(loaded!.servants).toEqual([{ id: 'gnome-prospector', count: 3 }]);
  });

  it('повреждённые данные возвращают null вместо краха', () => {
    const storage = memoryStorage();
    storage.setItem('dragon-raids-save-v1', '{не-json');
    expect(loadState(storage)).toBeNull();

    storage.setItem('dragon-raids-save-v1', JSON.stringify({ gold: 'не-число' }));
    expect(loadState(storage)).toBeNull();
  });

  it('isValidState отклоняет неполные объекты', () => {
    expect(isValidState(null)).toBe(false);
    expect(isValidState({ gold: 5 })).toBe(false);
    expect(isValidState(createInitialState())).toBe(true);
  });

  it('офлайн-время ограничено капом 8 часов', () => {
    const now = 10_000_000_000;
    // 100 часов «вне игры» — засчитываем только кап.
    const offline = computeOfflineMs(now - 100 * 3_600_000, now);
    expect(offline).toBe(OFFLINE_CAP_MS);
    expect(offline / 3_600_000).toBe(OFFLINE_CAP_HOURS);
  });

  it('офлайн-время не засчитывает будущее или 0', () => {
    expect(computeOfflineMs(10_000, 9_000)).toBe(0);
    expect(computeOfflineMs(10_000, 10_000)).toBe(0);
  });

  it('короткая отлучка засчитывается полностью', () => {
    const minutes = 5 * 60_000;
    expect(computeOfflineMs(10_000, 10_000 + minutes)).toBe(minutes);
  });
});
