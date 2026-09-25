/**
 * Формат сохранения усадьбы.
 *
 * Раньше сад писался «как есть»: каждый тайл — объект с пятью полями,
 * каждый предмет — объект с семью. Пустой сад занимал ~62 КБ. Четвёртая
 * версия пишет то же самое компактно: тайлы — строкой по три знака на
 * клетку (земля · уровень · флаги), предметы — рядами чисел под коротким
 * ключом. Экономия около восьми раз.
 *
 * Два железных правила этого файла:
 *
 * 1. Всё, что было сохранено раньше, обязано открываться. `parseSave`
 *    принимает и v3 (объекты с именованными полями), и v4 (упаковку),
 *    и возвращает одну и ту же нормальную форму.
 * 2. Мусор не проходит. Каждое поле проверяется по типу и диапазону;
 *    файл правильной длины, но с ерундой внутри, отвергается целиком,
 *    чтобы игрок получил прошлую копию, а не тихо испорченный сад.
 */

import { GRID } from '../core/iso';
import { ITEM_BY_ID } from './catalog';
import { GravelStyle, GroundId, PlacedObject, SaveData, Tile } from './types';

/** Версия формата, которую пишет текущая игра. */
export const SAVE_VERSION = 8;

/**
 * Земли в порядке их знака в упаковке. Порядок — часть формата:
 * новые земли дописываются в конец, переставлять нельзя.
 */
export const GROUND_IDS: readonly GroundId[] = [
  'moss',
  'grass',
  'gravel',
  'sand',
  'stone',
  'soil',
  'water',
  'tatami',
  'deck',
];

const G_CHARS = '012345678';
const L_CHARS = '01234567';
const F_CHARS = '01234567';
/** Допустимые уровни рельефа — с запасом против текущего -1..2. */
const LEVEL_MIN = -3;
const LEVEL_MAX = 4;
/** Позиции предметов: сад плюс небольшая кромка для привязок. */
const POS_MIN = -8;
const POS_MAX = GRID + 8;

function isInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && Math.floor(n) === n;
}

// ---- Тайл в число и обратно (тем же приёмом пользуется история) ----

/** Упаковать тайл: 4 бита земля, 3 бита уровень со сдвигом, 3 бита флаги. */
export function packTile(t: Tile): number {
  const g = Math.max(0, GROUND_IDS.indexOf(t.ground));
  const l = Math.min(Math.max(Math.round(t.level), LEVEL_MIN), LEVEL_MAX) - LEVEL_MIN;
  const f = (t.water ? 1 : 0) | (t.indoor ? 2 : 0) | (t.veranda ? 4 : 0);
  return g | (l << 4) | (f << 7);
}

export function unpackTile(n: number): Tile {
  const f = (n >> 7) & 7;
  return {
    ground: GROUND_IDS[n & 15] ?? 'moss',
    level: ((n >> 4) & 7) + LEVEL_MIN,
    water: !!(f & 1),
    indoor: !!(f & 2),
    veranda: !!(f & 4),
  };
}

// ---- Поле целиком: строка по три знака на клетку, 2028 знаков всего ----

export function packTiles(tiles: Tile[]): string {
  let out = '';
  for (const t of tiles) {
    const n = packTile(t);
    out += G_CHARS[n & 15] + L_CHARS[(n >> 4) & 7] + F_CHARS[(n >> 7) & 7];
  }
  return out;
}

function unpackTiles(s: string): Tile[] | null {
  if (s.length !== GRID * GRID * 3) return null;
  const tiles: Tile[] = new Array(GRID * GRID);
  let i = 0;
  for (let k = 0; k < tiles.length; k++) {
    const g = G_CHARS.indexOf(s[i]);
    const l = L_CHARS.indexOf(s[i + 1]);
    const f = F_CHARS.indexOf(s[i + 2]);
    if (g < 0 || l < 0 || f < 0) return null;
    tiles[k] = {
      ground: GROUND_IDS[g],
      level: l + LEVEL_MIN,
      water: !!(f & 1),
      indoor: !!(f & 2),
      veranda: !!(f & 4),
    };
    i += 3;
  }
  return tiles;
}

function parseLegacyTiles(arr: unknown[]): Tile[] | null {
  if (arr.length !== GRID * GRID) return null;
  const tiles: Tile[] = new Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    const t = arr[i];
    if (!t || typeof t !== 'object' || Array.isArray(t)) return null;
    const r = t as Record<string, unknown>;
    if (typeof r.ground !== 'string' || !GROUND_IDS.includes(r.ground as GroundId)) return null;
    if (!isInt(r.level) || r.level < LEVEL_MIN || r.level > LEVEL_MAX) return null;
    if (typeof r.water !== 'boolean' || typeof r.indoor !== 'boolean' || typeof r.veranda !== 'boolean') {
      return null;
    }
    tiles[i] = { ground: r.ground as GroundId, level: r.level, water: r.water, indoor: r.indoor, veranda: r.veranda };
  }
  return tiles;
}

// ---- Предметы ----

/** Упакованный предмет: [id, тип, tx, ty, посажен мс, поворот, сид].
 * Восьмой знак — необязательный: 1 у посаженных саженцем (растут по часам).
 * Старые сохранения семи знаков остаются верными: без знака дерево взрослое. */
type PackedObject = [number, string, number, number, number, number, number, number?];

function packObject(o: PlacedObject): PackedObject {
  const row: PackedObject = [o.id, o.type, o.tx, o.ty, Math.round(o.planted), o.rot & 3, o.seed >>> 0];
  if (o.young) row.push(1);
  return row;
}

function validSpot(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= POS_MIN && n <= POS_MAX;
}

/** Общие проверки полей — чтобы упакованный и старый вид судить одинаково. */
function checkFields(
  id: unknown,
  type: unknown,
  tx: unknown,
  ty: unknown,
  planted: unknown,
  rot: unknown,
  seed: unknown,
): id is number {
  if (!isInt(id) || id < 1) return false;
  if (typeof type !== 'string' || !ITEM_BY_ID.has(type)) return false;
  if (!validSpot(tx) || !validSpot(ty)) return false;
  if (typeof planted !== 'number' || !Number.isFinite(planted) || planted < 0) return false;
  if (!isInt(rot) || rot < 0 || rot > 3) return false;
  if (!isInt(seed) || seed < 0 || seed > 0xffffffff) return false;
  return true;
}

function unpackObject(raw: unknown[]): PlacedObject | null {
  const [id, type, tx, ty, planted, rot, seed, young] = raw;
  if ((raw.length !== 7 && raw.length !== 8) || !checkFields(id, type, tx, ty, planted, rot, seed)) return null;
  if (raw.length === 8 && young !== 1) return null;
  return {
    id,
    type: type as string,
    tx: tx as number,
    ty: ty as number,
    planted: planted as number,
    rot: rot as number,
    seed: seed as number,
    ...(raw.length === 8 ? { young: 1 as const } : {}),
  };
}

function parseLegacyObject(raw: Record<string, unknown>): PlacedObject | null {
  const { id, type, tx, ty, planted, rot, seed } = raw;
  if (!checkFields(id, type, tx, ty, planted, rot, seed)) return null;
  return {
    id,
    type: type as string,
    tx: tx as number,
    ty: ty as number,
    planted: planted as number,
    rot: rot as number,
    seed: seed as number,
    ...(raw.young === 1 ? { young: 1 as const } : {}),
  };
}

function parseStringList(raw: unknown, max: number): string[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > max) return null;
  const out: string[] = [];
  for (const s of raw) {
    if (typeof s !== 'string' || s.length > 80) return null;
    out.push(s);
  }
  return out;
}

/**
 * Летопись в сохранении — [событие, метка времени, ?snap]. Старые сады
 * жили без неё: отсутствие поля значит пустую летопись, а не ошибку.
 * snap — dataURL Polaroid 160px, может отсутствовать.
 */
function parseChronicle(raw: unknown): { id: string; at: number; snap?: string }[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || raw.length > 200) return null;
  const out: { id: string; at: number; snap?: string }[] = [];
  for (const e of raw) {
    if (!Array.isArray(e) || (e.length !== 2 && e.length !== 3)) return null;
    const [id, at, snap] = e as any[];
    if (typeof id !== 'string' || id.length === 0 || id.length > 40) return null;
    if (!isInt(at) || at < 0 || at > 4e12) return null;
    if (snap !== undefined) {
      if (typeof snap !== 'string' || snap.length > 60000) return null;
      if (!snap.startsWith('data:image/')) return null;
      out.push({ id, at, snap });
    } else {
      out.push({ id, at });
    }
  }
  return out;
}

// ---- Две стороны формата ----

/** Сериализовать в компактную форму v4+. */
export function serializeSave(d: SaveData): string {
  return JSON.stringify({
    v: SAVE_VERSION,
    t: packTiles(d.tiles),
    o: d.objects.map(packObject),
    n: d.nextId,
    m: d.milestones,
    s: d.seasons ?? [],
    e: d.seen,
    g: d.grow ?? null,
    b: d.born,
    c: (d.chronicle ?? []).map((e) =>
      (e as any).snap ? [e.id, Math.round(e.at), (e as any).snap] : [e.id, Math.round(e.at)],
    ),
    u: d.unlocked ?? null,
    f: d.fresh ?? null,
    gs: d.gravelStyle ?? null,
    tr: d.tileRake ?? null,
  });
}

/**
 * Принять разобранное сохранение любой прошлой версии и вернуть
 * нормальную форму — или null, если данные битые. Форму определяет
 * само содержимое: строка тайлов — v4, массив объектов — v3.
 * Номер версии служит только защитой от будущего.
 */
/** Режим роста из упаковки: целиком пригодный или null. */
function parseGrow(raw: unknown): SaveData['grow'] {
  if (raw === undefined || raw === null) return null;
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Record<string, unknown>;
  const r = g.rect as Record<string, unknown> | undefined;
  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  if (!r || !num(r.x) || !num(r.y) || !num(r.w) || !num(r.h)) return null;
  if (r.w < 1 || r.h < 1 || r.x < 0 || r.y < 0 || r.x + r.w > 64 || r.y + r.h > 64) return null;
  if (!num(g.seed) || !num(g.bank) || !num(g.tick) || !num(g.progress) || !num(g.stage)) return null;
  let clock: NonNullable<SaveData['grow']>['clock'];
  if (g.clock !== undefined) {
    if (!g.clock || typeof g.clock !== 'object') return null;
    const c = g.clock as Record<string, unknown>;
    if (
      !num(c.epoch) ||
      c.epoch < 0 ||
      c.epoch > 8.64e15 ||
      !num(c.month) ||
      c.month < 1200 ||
      c.month > 1_200_000 ||
      !num(c.solar) ||
      c.solar < 0 ||
      c.solar >= 1
    )
      return null;
    clock = { epoch: c.epoch, month: c.month, solar: c.solar };
  }
  return {
    rect: { x: Math.floor(r.x), y: Math.floor(r.y), w: Math.floor(r.w), h: Math.floor(r.h) },
    seed: Math.floor(g.seed),
    bank: Math.max(0, Math.floor(g.bank)),
    tick: g.tick,
    progress: Math.max(0, Math.floor(g.progress)),
    stage: Math.max(0, Math.floor(g.stage)),
    choosing: Boolean(g.choosing),
    ...(clock ? { clock } : {}),
  };
}

export function parseSave(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const d = raw as Record<string, unknown>;

  const version = d.v ?? d.version;
  if (version !== undefined && (!isInt(version) || version < 1 || version > SAVE_VERSION)) return null;

  let tiles: Tile[] | null = null;
  const rt = d.t ?? d.tiles;
  if (typeof rt === 'string') tiles = unpackTiles(rt);
  else if (Array.isArray(rt)) tiles = parseLegacyTiles(rt);
  if (!tiles) return null;

  const ro = d.o ?? d.objects ?? [];
  if (!Array.isArray(ro)) return null;
  const objects: PlacedObject[] = [];
  const ids = new Set<number>();
  for (const e of ro) {
    let o: PlacedObject | null = null;
    if (Array.isArray(e)) o = unpackObject(e);
    else if (e && typeof e === 'object') o = parseLegacyObject(e as Record<string, unknown>);
    if (!o || ids.has(o.id)) return null;
    ids.add(o.id);
    objects.push(o);
  }

  let nextId = 1;
  for (const o of objects) nextId = Math.max(nextId, o.id + 1);
  const nextIdRaw = d.n ?? d.nextId;
  if (nextIdRaw !== undefined) {
    if (!isInt(nextIdRaw) || nextIdRaw < 1) return null;
    nextId = Math.max(nextId, nextIdRaw);
  }

  const milestones = parseStringList(d.m ?? d.milestones, 400);
  const seasons = parseStringList(d.s ?? d.seasons, 16);
  const seen = parseStringList(d.e ?? d.seen, 200);
  const chronicle = parseChronicle(d.c ?? d.chronicle);
  if (!milestones || !seasons || !seen || !chronicle) return null;

  const rawGrow = d.g !== undefined ? d.g : d.grow;
  const grow = parseGrow(rawGrow);
  if (rawGrow !== undefined && rawGrow !== null && !grow) return null;

  const rawGs = d.gs ?? d.gravelStyle;
  const gravelStyle =
    typeof rawGs === 'string' && ['waves', 'ripples', 'straight', 'swirl'].includes(rawGs)
      ? (rawGs as GravelStyle)
      : undefined;

  const rawTr = d.tr ?? d.tileRake;
  let tileRake: Record<number, number> | undefined;
  if (rawTr && typeof rawTr === 'object' && !Array.isArray(rawTr)) {
    tileRake = {};
    for (const [k, v] of Object.entries(rawTr as Record<string, unknown>)) {
      const idx = Number(k);
      const val = Number(v);
      if (isInt(idx) && idx >= 0 && idx < GRID * GRID && isInt(val) && val >= 0 && val <= 8) {
        tileRake[idx] = val;
      }
    }
  }

  // Открытия каталога: отсутствие списка — старое сохранение (мигрирует мир)
  const hasUnlocks = d.u !== undefined || d.unlocked !== undefined;
  const unlocked = parseStringList(d.u ?? d.unlocked, 400);
  const fresh = parseStringList(d.f ?? d.fresh, 400);
  if (!unlocked || !fresh) return null;

  return {
    version: SAVE_VERSION,
    tiles,
    objects,
    nextId,
    milestones,
    seasons,
    seen,
    chronicle,
    grow,
    gravelStyle,
    tileRake,
    unlocked: hasUnlocks ? unlocked : undefined,
    fresh: hasUnlocks ? fresh : undefined,
    born: typeof d.b === 'number' ? d.b : undefined,
  };
}
