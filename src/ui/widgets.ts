import Phaser from 'phaser';
import { COLORS } from './theme';

export interface ButtonOptions {
  color?: number;
  fontSize?: number;
  depth?: number;
  /** Дополнительная кликабельная зона вокруг видимой кнопки. */
  hitPadding?: number;
  /** Минимальная высота touch-target независимо от высоты фона. */
  minHitHeight?: number;
}

type ButtonVisualState = 'idle' | 'hover' | 'pressed' | 'disabled';

function shiftColor(color: number, amount: number): number {
  const r = Math.max(0, Math.min(255, ((color >> 16) & 0xff) + amount));
  const g = Math.max(0, Math.min(255, ((color >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (color & 0xff) + amount));
  return (r << 16) | (g << 8) | b;
}

function paintButton(
  container: Phaser.GameObjects.Container,
  state: ButtonVisualState,
): void {
  const bg = container.getByName('bg') as Phaser.GameObjects.Rectangle;
  const label = container.getByName('label') as Phaser.GameObjects.Text;
  const base = (container.getData('bgColor') as number) ?? 0x334155;

  switch (state) {
    case 'hover':
      bg.setFillStyle(shiftColor(base, 24));
      bg.setStrokeStyle(3, 0x94a3b8, 1);
      bg.setScale(1.012);
      label.setAlpha(1).setScale(1.012);
      break;
    case 'pressed':
      bg.setFillStyle(shiftColor(base, -18));
      bg.setStrokeStyle(3, COLORS.accent, 1);
      bg.setScale(0.985);
      label.setAlpha(1).setScale(0.985);
      break;
    case 'disabled':
      bg.setFillStyle(0x273244);
      bg.setStrokeStyle(2, 0x1f2937, 0.85);
      bg.setScale(1);
      label.setAlpha(0.42).setScale(1);
      break;
    default:
      bg.setFillStyle(base);
      bg.setStrokeStyle(2, COLORS.panelEdge, 1);
      bg.setScale(1);
      label.setAlpha(1).setScale(1);
      break;
  }
}

/**
 * Переиспользуемая кнопка с увеличенным touch-target.
 *
 * Важно: интерактивным является прозрачный Rectangle с автоматическим hit-area
 * Phaser (координаты 0..width/height). Старый ручной Rectangle(-w/2..w/2)
 * покрывал только четверть видимой кнопки, из-за чего клики часто «терялись».
 */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  opts: ButtonOptions = {},
): Phaser.GameObjects.Container {
  const color = opts.color ?? 0x334155;
  const hitPadding = opts.hitPadding ?? 6;
  const hitWidth = w + hitPadding * 2;
  const hitHeight = Math.max(h + hitPadding * 2, opts.minHitHeight ?? 48);

  // Отдельная почти прозрачная форма даёт большой и предсказуемый hit-area,
  // не меняя визуальный размер и раскладку кнопок.
  const hit = scene.add
    .rectangle(0, 0, hitWidth, hitHeight, 0xffffff, 0.001)
    .setName('hit');
  const bg = scene.add
    .rectangle(0, 0, w, h, color)
    .setStrokeStyle(2, COLORS.panelEdge)
    .setName('bg');
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: 'Arial, sans-serif',
      fontSize: `${opts.fontSize ?? 15}px`,
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
    })
    .setOrigin(0.5)
    .setName('label');

  const container = scene.add
    .container(x, y, [hit, bg, text])
    .setDepth(opts.depth ?? 10);
  container.setData('bgColor', color);
  container.setData('bgW', w);
  container.setData('bgH', h);
  container.setData('enabled', true);
  container.setData('pressed', false);

  // Для Rectangle авто-hit-area Phaser корректно учитывает displayOrigin.
  hit.setInteractive({ useHandCursor: true });
  hit.on('pointerover', () => {
    if (container.getData('enabled')) paintButton(container, 'hover');
  });
  hit.on('pointerout', () => {
    container.setData('pressed', false);
    paintButton(container, container.getData('enabled') ? 'idle' : 'disabled');
  });
  hit.on('pointerdown', () => {
    if (!container.getData('enabled')) return;
    container.setData('pressed', true);
    paintButton(container, 'pressed');
  });
  hit.on('pointerup', () => {
    if (!container.getData('enabled')) return;
    const wasPressed = !!container.getData('pressed');
    container.setData('pressed', false);
    // Сначала даём мгновенный визуальный отклик, затем запускаем переход/действие.
    paintButton(container, 'hover');
    if (wasPressed) onClick();
  });

  return container;
}

/** Включить/выключить кнопку, сохраняя её родной цвет и увеличенный hit-area. */
export function setButtonEnabled(
  container: Phaser.GameObjects.Container,
  enabled: boolean,
): void {
  const hit = container.getByName('hit') as Phaser.GameObjects.Rectangle;
  container.setData('enabled', enabled);
  container.setData('pressed', false);

  if (enabled) {
    if (hit.input) hit.input.enabled = true;
    else hit.setInteractive({ useHandCursor: true });
    paintButton(container, 'idle');
  } else {
    hit.disableInteractive();
    paintButton(container, 'disabled');
  }
}

export function setButtonLabel(
  container: Phaser.GameObjects.Container,
  label: string,
): void {
  (container.getByName('label') as Phaser.GameObjects.Text).setText(label);
}

export function formatHP(cur: number, max: number): string {
  return `${Math.max(0, Math.ceil(cur))}/${max}`;
}
