/**
 * Миражи — особая кнопка зовёт живность прямо в сад: бабочек, светлячков,
 * лягушек и всех остальных, даже зимой. Мираж живёт десять минут реального
 * времени и тает сам — сад ничего не теряет и не считает.
 */

/** Сколько живёт мираж: десять минут реального времени. */
export const MIRAGE_MS = 10 * 60 * 1000;

export type MirageKind =
  | 'butterfly'
  | 'firefly'
  | 'moth'
  | 'bee'
  | 'dragonfly'
  | 'frog'
  | 'bird'
  | 'owl'
  | 'squirrel'
  | 'hedgehog'
  | 'mouse'
  | 'lizard'
  | 'turtle'
  | 'heron'
  | 'deer'
  | 'cat';

export interface MirageDef {
  id: MirageKind;
  name: string;
  hint: string;
}

/** Список для особой панели: тот же свиток, что у построек. */
export const MIRAGES: MirageDef[] = [
  { id: 'butterfly', name: 'Бабочка', hint: 'кружит над цветами даже в стужу' },
  { id: 'firefly', name: 'Светлячок', hint: 'тихий огонёк в любой час' },
  { id: 'moth', name: 'Мотылёк', hint: 'бархатный спутник света' },
  { id: 'bee', name: 'Пчела', hint: 'собирает там, где пахнет' },
  { id: 'dragonfly', name: 'Стрекоза', hint: 'патруль над самой водой' },
  { id: 'frog', name: 'Лягушка', hint: 'песня у кромки воды' },
  { id: 'bird', name: 'Птица', hint: 'сядет там, где тихо' },
  { id: 'owl', name: 'Сова', hint: 'глядит поверх сада' },
  { id: 'squirrel', name: 'Белка', hint: 'прыжок за прыжком' },
  { id: 'hedgehog', name: 'Ёжик', hint: 'шуршит в низких травах' },
  { id: 'mouse', name: 'Мышь', hint: 'маленький след в большом саду' },
  { id: 'lizard', name: 'Ящерица', hint: 'греется на тёплом камне' },
  { id: 'turtle', name: 'Черепаха', hint: 'никуда не спешит' },
  { id: 'heron', name: 'Цапля', hint: 'терпение на длинных ногах' },
  { id: 'deer', name: 'Олень', hint: 'гость из-за тумана' },
  { id: 'cat', name: 'Кот', hint: 'пришёл, увидел, задремал' },
];

/** Живёт ли ещё мираж: отметка — стена реального времени. */
export function mirageAlive(mirage: number | undefined, wall: number): boolean {
  return typeof mirage === 'number' && mirage > wall;
}
