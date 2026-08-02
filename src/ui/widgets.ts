import Phaser from 'phaser';
import { COLORS } from './theme';

export interface ButtonOptions {
  color?: number;
  fontSize?: number;
  depth?: number;
}

/** Переиспользуемая кнопка (контейнер с фоном и текстом). */
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
    })
    .setOrigin(0.5)
    .setName('label');
  const container = scene.add.container(x, y, [bg, text]).setDepth(opts.depth ?? 10);
  container.setData('bgColor', color);
  container.setData('bgW', w);
  container.setData('bgH', h);

  bg.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
  const hover = Phaser.Display.Color.IntegerToColor(0x475569);
  bg.on('pointerover', () => bg.setFillStyle(0x475569));
  bg.on('pointerout', () => bg.setFillStyle(container.getData('bgColor') as number));
  bg.on('pointerup', onClick);
  void hover;
  return container;
}

/** Включить/выключить кнопку, сохраняя её «родной» цвет. */
export function setButtonEnabled(container: Phaser.GameObjects.Container, enabled: boolean): void {
  const bg = container.getByName('bg') as Phaser.GameObjects.Rectangle;
  const label = container.getByName('label') as Phaser.GameObjects.Text;
  const color = (container.getData('bgColor') as number) ?? 0x1f6feb;
  bg.setFillStyle(enabled ? color : 0x334155);
  bg.setStrokeStyle(2, enabled ? COLORS.panelEdge : 0x1f2937);
  label.setAlpha(enabled ? 1 : 0.45);
  if (enabled) bg.setInteractive();
  else bg.disableInteractive();
}

export function setButtonLabel(container: Phaser.GameObjects.Container, label: string): void {
  (container.getByName('label') as Phaser.GameObjects.Text).setText(label);
}

export function formatHP(cur: number, max: number): string {
  return `${Math.max(0, Math.ceil(cur))}/${max}`;
}
