/** Каталог предметов. Всё открывается через Вехи Мастерства — органично, через действия игрока. */

import { GroundId, ObjKind } from './types';

export interface CatalogItem {
  id: string;
  name: string;
  hint: string;
  kind: ObjKind;
  /** Размер в тайлах (многоклеточные объекты). */
  w: number;
  h: number;
  /** Шаг сетки при размещении: 1 или 0.25 (четверть-тайлы). */
  step: 1 | 0.5 | 0.25;
  /** Дни реального времени до взрослой формы (0 = сразу готов). */
  growDays: number;
  /** Можно ставить на воду. */
  onWater?: boolean;
  /** Требует воду под собой (мост, лотос). */
  needsWater?: boolean;
  /** Можно вращать. */
  rotatable?: boolean;
  tab: string;
}

export interface TerrainBrush {
  id: string;
  name: string;
  hint: string;
  kind: 'ground' | 'water' | 'hill' | 'lower' | 'floor';
  ground?: GroundId;
  /** Размер модульного блока. */
  w: number;
  h: number;
  tab: string;
}

export interface CatalogTab {
  id: string;
  name: string;
  icon: string;
  /** Веха, открывающая вкладку. null = открыта с начала. */
  requires: string | null;
}

export const TABS: CatalogTab[] = [
  { id: 'ground', name: 'Земля', icon: 'ground', requires: null },
  { id: 'water', name: 'Вода', icon: 'water', requires: null },
  { id: 'relief', name: 'Рельеф', icon: 'hill', requires: null },
  { id: 'trees', name: 'Деревья', icon: 'tree', requires: null },
  { id: 'stones', name: 'Камни', icon: 'rock', requires: null },
  { id: 'micro', name: 'Мелочи', icon: 'micro', requires: null },
  { id: 'pond', name: 'Пруд', icon: 'lotus', requires: 'first_pond' },
  { id: 'light', name: 'Свет', icon: 'lantern', requires: 'first_evening' },
  { id: 'house', name: 'Усадьба', icon: 'house', requires: 'first_deck' },
  { id: 'cat', name: 'Коту', icon: 'cat', requires: 'first_cat' },
];

export const TERRAIN_BRUSHES: TerrainBrush[] = [
  { id: 'g_moss', name: 'Мох', hint: 'мягкий ковёр под ногами', kind: 'ground', ground: 'moss', w: 1, h: 1, tab: 'ground' },
  { id: 'g_grass', name: 'Трава', hint: 'светлая полевая трава', kind: 'ground', ground: 'grass', w: 1, h: 1, tab: 'ground' },
  { id: 'g_gravel', name: 'Гравий', hint: 'расчёсанный сад камней', kind: 'ground', ground: 'gravel', w: 1, h: 1, tab: 'ground' },
  { id: 'g_sand', name: 'Песок', hint: 'тёплый светлый песок', kind: 'ground', ground: 'sand', w: 1, h: 1, tab: 'ground' },
  { id: 'g_stone', name: 'Камень', hint: 'плитка дорожки', kind: 'ground', ground: 'stone', w: 1, h: 1, tab: 'ground' },
  { id: 'g_soil', name: 'Земля', hint: 'влажная тёмная почва', kind: 'ground', ground: 'soil', w: 1, h: 1, tab: 'ground' },

  { id: 'w_pond2', name: 'Заводь 2×2', hint: 'маленькое зеркало воды', kind: 'water', w: 2, h: 2, tab: 'water' },
  { id: 'w_pond4', name: 'Пруд 4×4', hint: 'глубокий покой', kind: 'water', w: 4, h: 4, tab: 'water' },
  { id: 'w_stream', name: 'Ручей 1×3', hint: 'вода, что течёт', kind: 'water', w: 1, h: 3, tab: 'water' },
  { id: 'w_fill', name: 'Осушить', hint: 'вернуть землю', kind: 'ground', ground: 'moss', w: 1, h: 1, tab: 'water' },

  { id: 'h_hill3', name: 'Холм 3×3', hint: 'мягкое возвышение', kind: 'hill', w: 3, h: 3, tab: 'relief' },
  { id: 'h_hill2', name: 'Пригорок 2×2', hint: 'едва заметный подъём', kind: 'hill', w: 2, h: 2, tab: 'relief' },
  { id: 'h_low', name: 'Ложбина 3×3', hint: 'опустить землю', kind: 'lower', w: 3, h: 3, tab: 'relief' },
  { id: 'f_deck', name: 'Веранда', hint: 'тёплые доски энгава', kind: 'floor', ground: 'deck', w: 1, h: 1, tab: 'relief' },
  { id: 'f_tatami', name: 'Татами', hint: 'комната усадьбы', kind: 'floor', ground: 'tatami', w: 1, h: 1, tab: 'relief' },
];

export const ITEMS: CatalogItem[] = [
  // Деревья
  { id: 'sakura', name: 'Сакура', hint: 'неделя до цветения', kind: 'tree', w: 1, h: 1, step: 0.5, growDays: 7, tab: 'trees' },
  { id: 'maple', name: 'Клён момидзи', hint: 'осенью горит багрянцем', kind: 'tree', w: 1, h: 1, step: 0.5, growDays: 7, tab: 'trees' },
  { id: 'pine', name: 'Сосна', hint: 'вечная зелень', kind: 'tree', w: 1, h: 1, step: 0.5, growDays: 9, tab: 'trees' },
  { id: 'bamboo', name: 'Бамбук', hint: 'растёт быстро', kind: 'tree', w: 1, h: 1, step: 0.25, growDays: 2, tab: 'trees' },
  { id: 'willow', name: 'Ива', hint: 'клонится к воде', kind: 'tree', w: 1, h: 1, step: 0.5, growDays: 8, tab: 'trees' },
  { id: 'ginkgo', name: 'Гинкго', hint: 'золотые веера', kind: 'tree', w: 1, h: 1, step: 0.5, growDays: 8, tab: 'trees' },
  { id: 'azalea', name: 'Азалия', hint: 'круглый цветущий куст', kind: 'shrub', w: 1, h: 1, step: 0.25, growDays: 3, tab: 'trees' },
  { id: 'hedge', name: 'Стриженый куст', hint: 'облако из листвы', kind: 'shrub', w: 1, h: 1, step: 0.25, growDays: 3, tab: 'trees' },

  // Камни
  { id: 'rock_big', name: 'Валун 2×2', hint: 'сердце сада камней', kind: 'rock', w: 2, h: 2, step: 0.5, growDays: 0, rotatable: true, tab: 'stones' },
  { id: 'rock_mid', name: 'Камень', hint: 'приятная асимметрия', kind: 'rock', w: 1, h: 1, step: 0.25, growDays: 0, rotatable: true, tab: 'stones' },
  { id: 'rock_trio', name: 'Триада 1×3', hint: 'три камня-брата', kind: 'rock', w: 1, h: 3, step: 0.5, growDays: 0, rotatable: true, tab: 'stones' },
  { id: 'step_stone', name: 'Шаговый камень', hint: 'тропа по мху', kind: 'micro', w: 1, h: 1, step: 0.25, growDays: 0, tab: 'stones' },

  // Мелочи (четверть-тайлы)
  { id: 'moss_clump', name: 'Подушка мха', hint: 'четверть клетки', kind: 'micro', w: 1, h: 1, step: 0.25, growDays: 0, tab: 'micro' },
  { id: 'pebbles', name: 'Галька', hint: 'рассыпать горстью', kind: 'micro', w: 1, h: 1, step: 0.25, growDays: 0, tab: 'micro' },
  { id: 'lily', name: 'Ландыши', hint: 'белые колокольчики', kind: 'flower', w: 1, h: 1, step: 0.25, growDays: 1, tab: 'micro' },
  { id: 'iris', name: 'Ирисы', hint: 'любят влажный берег', kind: 'flower', w: 1, h: 1, step: 0.25, growDays: 1, tab: 'micro' },
  { id: 'fern', name: 'Папоротник', hint: 'тень и прохлада', kind: 'flower', w: 1, h: 1, step: 0.25, growDays: 1, tab: 'micro' },
  { id: 'grass_tuft', name: 'Пучок травы', hint: 'колышется на ветру', kind: 'micro', w: 1, h: 1, step: 0.25, growDays: 0, tab: 'micro' },

  // Пруд (открывается после первой воды)
  { id: 'lotus', name: 'Лотос', hint: 'раскрывается днём', kind: 'flower', w: 1, h: 1, step: 0.25, growDays: 2, needsWater: true, onWater: true, tab: 'pond' },
  { id: 'lilypad', name: 'Кувшинки', hint: 'зелёные блюдца', kind: 'micro', w: 1, h: 1, step: 0.25, growDays: 1, needsWater: true, onWater: true, tab: 'pond' },
  { id: 'bridge', name: 'Мостик 1×3', hint: 'изогнутая дуга', kind: 'bridge', w: 1, h: 3, step: 1, growDays: 0, rotatable: true, onWater: true, tab: 'pond' },
  { id: 'koi', name: 'Карпы кои', hint: 'ходят кругами', kind: 'creature', w: 1, h: 1, step: 0.5, growDays: 0, needsWater: true, onWater: true, tab: 'pond' },
  { id: 'shishi', name: 'Сиси-одоси', hint: 'стучит бамбуком', kind: 'deco', w: 1, h: 1, step: 0.5, growDays: 0, tab: 'pond' },

  // Свет
  { id: 'lantern_stone', name: 'Каменный фонарь', hint: 'тёплый огонёк', kind: 'lantern', w: 1, h: 1, step: 0.5, growDays: 0, tab: 'light' },
  { id: 'lantern_paper', name: 'Бумажный фонарь', hint: 'качается на ветру', kind: 'lantern', w: 1, h: 1, step: 0.5, growDays: 0, tab: 'light' },
  { id: 'lantern_path', name: 'Тропный фонарик', hint: 'низкий свет у земли', kind: 'lantern', w: 1, h: 1, step: 0.25, growDays: 0, tab: 'light' },
  { id: 'brazier', name: 'Жаровня', hint: 'живой огонь', kind: 'lantern', w: 1, h: 1, step: 0.5, growDays: 0, tab: 'light' },

  // Усадьба
  { id: 'pavilion', name: 'Беседка 2×2', hint: 'крыша над головой', kind: 'pavilion', w: 2, h: 2, step: 1, growDays: 0, rotatable: true, tab: 'house' },
  { id: 'shoji', name: 'Сёдзи', hint: 'раздвижная стена', kind: 'deco', w: 1, h: 1, step: 1, growDays: 0, rotatable: true, tab: 'house' },
  { id: 'torii', name: 'Тории 1×1', hint: 'ворота', kind: 'deco', w: 1, h: 1, step: 0.5, growDays: 0, rotatable: true, tab: 'house' },
  { id: 'table', name: 'Столик', hint: 'чай остывает', kind: 'deco', w: 1, h: 1, step: 0.5, growDays: 0, tab: 'house' },
  { id: 'tsukubai', name: 'Цукубаи', hint: 'чаша с водой', kind: 'deco', w: 1, h: 1, step: 0.5, growDays: 0, tab: 'house' },
  { id: 'wind_chime', name: 'Фурин', hint: 'звенит в тишине', kind: 'deco', w: 1, h: 1, step: 0.5, growDays: 0, tab: 'house' },

  // Коту
  { id: 'cat', name: 'Кот', hint: 'приходит сам', kind: 'creature', w: 1, h: 1, step: 0.5, growDays: 0, tab: 'cat' },
  { id: 'cushion', name: 'Подушка дзабутон', hint: 'место для сна', kind: 'deco', w: 1, h: 1, step: 0.5, growDays: 0, tab: 'cat' },
  { id: 'bowl', name: 'Миска', hint: 'на всякий случай', kind: 'micro', w: 1, h: 1, step: 0.25, growDays: 0, tab: 'cat' },
];

export const ITEM_BY_ID = new Map(ITEMS.map((i) => [i.id, i]));
export const BRUSH_BY_ID = new Map(TERRAIN_BRUSHES.map((b) => [b.id, b]));

/** Вехи мастерства. */
export interface Milestone {
  id: string;
  title: string;
  text: string;
  unlocks: string;
}

export const MILESTONES: Record<string, Milestone> = {
  first_pond: {
    id: 'first_pond',
    title: 'Вода найдена',
    text: 'Вы выкопали первый пруд. Лотосы и мостики теперь ваши.',
    unlocks: 'Пруд',
  },
  first_evening: {
    id: 'first_evening',
    title: 'Сумерки',
    text: 'Сад встретил вечер. Пора зажечь фонари.',
    unlocks: 'Свет',
  },
  first_deck: {
    id: 'first_deck',
    title: 'Порог дома',
    text: 'Доски веранды легли на землю. Усадьба начинается.',
    unlocks: 'Усадьба',
  },
  first_cat: {
    id: 'first_cat',
    title: 'Гость',
    text: 'Кот пришёл сам и остался. Ему нужны подушки и миски.',
    unlocks: 'Коту',
  },
  grove: {
    id: 'grove',
    title: 'Роща',
    text: 'Двенадцать деревьев шумят на ветру.',
    unlocks: 'Тишина',
  },
};
