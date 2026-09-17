/**
 * Тихая память практики.
 *
 * Живёт отдельным ключом, вне сохранений усадеб: медитирует человек, а не
 * сад, и у каждого из нескольких садов практика одна (принцип 8 не тронут —
 * формат SaveData не меняется). Никаких серий и очков: только то, что
 * действительно случилось — какие уроки прожиты, сколько сеансов, сколько
 * всего минут тишины.
 *
 * Битый или чужой JSON не роняет игру: читается то, что читается, остальное
 * начинается с чистого листа.
 */

const KEY = 'usadba.practice.v1';

export interface PracticeProgress {
  version: 1;
  /** Прожитые уроки (id). */
  lessons: string[];
  /** Число завершённых сеансов по практикам (id -> сколько раз). */
  sessions: Record<string, number>;
  /** Сколько всего минут тишины, округлённо. */
  minutes: number;
  /** Когда сидели последний раз. */
  last: number;
  /** Осторожная строка показана один раз. */
  careSeen: boolean;
}

const EMPTY: PracticeProgress = { version: 1, lessons: [], sessions: {}, minutes: 0, last: 0, careSeen: false };

export function loadProgress(): PracticeProgress {
  let p: PracticeProgress = { ...EMPTY, lessons: [], sessions: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<PracticeProgress>;
      if (d && typeof d === 'object') {
        p = {
          version: 1,
          lessons: Array.isArray(d.lessons) ? d.lessons.filter((x) => typeof x === 'string') : [],
          sessions:
            d.sessions && typeof d.sessions === 'object'
              ? Object.fromEntries(
                  Object.entries(d.sessions as Record<string, unknown>)
                    .filter(([, v]) => typeof v === 'number')
                    .map(([k, v]) => [k, Math.max(0, Math.min(100000, Number(v)))]),
                )
              : {},
          minutes: typeof d.minutes === 'number' && d.minutes >= 0 ? Math.min(1000000, Math.round(d.minutes)) : 0,
          last: typeof d.last === 'number' ? d.last : 0,
          careSeen: !!d.careSeen,
        };
      }
    }
  } catch {
    /* приватный режим или битый ключ — начинаем с чистого листа */
  }
  return p;
}

export function saveProgress(p: PracticeProgress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* тишина */
  }
}

/** Завершённый сеанс: память, а не счёт. Досрочный выход — тоже сеанс. */
export function noteSession(practiceId: string, minutes: number, lessonId?: string): PracticeProgress {
  const p = loadProgress();
  p.sessions[practiceId] = (p.sessions[practiceId] ?? 0) + 1;
  p.minutes += minutes;
  p.last = Date.now();
  if (lessonId && !p.lessons.includes(lessonId)) p.lessons.push(lessonId);
  saveProgress(p);
  return p;
}

export function markCareSeen(): PracticeProgress {
  const p = loadProgress();
  if (!p.careSeen) {
    p.careSeen = true;
    saveProgress(p);
  }
  return p;
}
