import Phaser from 'phaser';
import { ROLE_INFO } from '../data/units';
import type { Role, Team } from '../entities/types';
import { COLORS, TEAM_COLORS } from './theme';

export interface UnitViewOptions {
  name: string;
  role: Role;
  team: Team;
  radius?: number;
  hpWidth?: number;
  showState?: boolean;
  epochIndex?: number;
  line?: string;
}

/**
 * Представление юнита для отрисовки (Phaser-контейнер) + ссылки на меняющиеся
 * части (полоска HP, бейдж состояния). Отделено от логики: сцена лишь читает
 * модель и вызывает setHp / setStateText.
 */
export interface UnitView {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Shape;
  hpFill: Phaser.GameObjects.Rectangle;
  stateLabel: Phaser.GameObjects.Text;
  radius: number;
}

const ROMAN_NUMERALS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

const EPOCH_COLORS: Record<number, number> = {
  1: 0x475569, // Stone Age: Slate
  2: 0xb45309, // Bronze Age: Bronze/Amber
  3: 0x64748b, // Iron Age: Steel/Slate
  4: 0x10b981, // Epoch 4: Emerald
  5: 0x06b6d4, // Epoch 5: Cyan
  6: 0x3b82f6, // Epoch 6: Blue
  7: 0x8b5cf6, // Epoch 7: Purple
  8: 0xf59e0b, // Epoch 8: Gold
};

export function createUnitView(
  scene: Phaser.Scene,
  opts: UnitViewOptions,
): UnitView {
  const radius = opts.radius ?? 17;
  const hpWidth = opts.hpWidth ?? 36;
  const team = TEAM_COLORS[opts.team];
  const role = ROLE_INFO[opts.role];
  const epochIndex = opts.epochIndex ?? 1;
  const line = opts.line ?? 'Infantry';

  const epochColor = EPOCH_COLORS[epochIndex] ?? 0x475569;
  const strokeThickness = epochIndex >= 7 ? 4 : epochIndex >= 4 ? 3 : 2;

  // Тень.
  const shadow = scene.add
    .ellipse(0, radius * 0.7, radius * 1.7, radius * 0.6, 0x000000, 0.3)
    .setDepth(-1);

  // Тело (форма по линии, цвет по команде, обводка по эпохе)
  let body: Phaser.GameObjects.Shape;

  if (line === 'Ranged') {
    // Triangle pointing up
    body = scene.add.triangle(
      0,
      0,
      0,
      -radius,
      -radius * 1.1,
      radius * 0.8,
      radius * 1.1,
      radius * 0.8,
      team.body
    );
    body.setStrokeStyle(strokeThickness, epochColor);
  } else if (line === 'Cavalry') {
    // Diamond
    body = scene.add.polygon(
      0,
      0,
      [0, -radius * 1.1, radius * 1.1, 0, 0, radius * 1.1, -radius * 1.1, 0],
      team.body
    );
    body.setStrokeStyle(strokeThickness, epochColor);
  } else if (line === 'Siege') {
    // Rectangle/Square
    body = scene.add.rectangle(
      0,
      0,
      radius * 1.8,
      radius * 1.8,
      team.body
    );
    body.setStrokeStyle(strokeThickness, epochColor);
  } else if (line === 'Support') {
    // Octagon
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4 + Math.PI / 8;
      pts.push(radius * 1.05 * Math.cos(angle), radius * 1.05 * Math.sin(angle));
    }
    body = scene.add.polygon(0, 0, pts, team.body);
    body.setStrokeStyle(strokeThickness, epochColor);
  } else {
    // Infantry (Circle)
    body = scene.add.circle(0, 0, radius, team.body);
    body.setStrokeStyle(strokeThickness, epochColor);
  }

  // Эмблема роли (цвет роли).
  const emblem = scene.add.circle(0, 0, radius * 0.62, role.color, 0.9);

  // Силуэт роли вместо буквы.
  const letter = createSilhouetteGraphics(scene, opts.role, radius);

  // Полоска HP.
  const hpBg = scene.add
    .rectangle(0, -radius - 9, hpWidth + 2, 5, 0x000000, 0.6)
    .setOrigin(0.5);
  const hpFill = scene.add
    .rectangle(-hpWidth / 2, -radius - 9, hpWidth, 3, COLORS.hpHigh)
    .setOrigin(0, 0.5);

  // Подпись роли + римская цифра эпохи.
  const roman = ROMAN_NUMERALS[epochIndex] ?? epochIndex.toString();
  const roleLabel = scene.add
    .text(0, radius + 8, `${role.label} [${roman}]`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      color: '#e5e7eb',
    })
    .setOrigin(0.5);

  // Бейдж состояния FSM (скрыт по умолчанию).
  const stateLabel = scene.add
    .text(0, -radius - 18, '', {
      fontFamily: 'Consolas, monospace',
      fontSize: '9px',
      color: '#9aa3b2',
    })
    .setOrigin(0.5);
  stateLabel.setVisible(!!opts.showState);

  const container = scene.add.container(0, 0, [
    shadow,
    body,
    emblem,
    letter,
    hpBg,
    hpFill,
    roleLabel,
    stateLabel,
  ]);
  container.setDepth(10);

  return { container, body, hpFill, stateLabel, radius };
}

/** Обновить полоску HP по отношению 0..1. */
export function setHpRatio(view: UnitView, ratio: number): void {
  const r = Phaser.Math.Clamp(ratio, 0, 1);
  view.hpFill.scaleX = r;
  const color =
    r > 0.5 ? COLORS.hpHigh : r > 0.25 ? COLORS.hpMid : COLORS.hpLow;
  view.hpFill.setFillStyle(color);
}

const STATE_LABEL: Record<string, string> = {
  IDLE: 'ожидание',
  ENGAGE: 'сближение',
  ATTACK: 'атака',
  CHASE: 'погоня',
  REPOSITION: 'перепозиция',
  RETREAT: 'отступление',
  ABILITY: 'способность',
  STUNNED: 'оглушён',
  DEAD: 'пал',
};

export function setStateText(view: UnitView, state: string): void {
  view.stateLabel.setText(STATE_LABEL[state] ?? state);
}

export function createSilhouetteGraphics(
  scene: Phaser.Scene,
  roleName: Role,
  radius: number,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.lineStyle(1.5, 0x111318, 1);
  g.fillStyle(0x111318, 1);

  const size = radius * 0.72;

  if (roleName === 'tank') {
    // Highly detailed Heater Shield with Split Face & Rivets
    g.beginPath();
    g.moveTo(-size * 0.6, -size * 0.6);
    g.lineTo(size * 0.6, -size * 0.6);
    g.lineTo(size * 0.6, 0);
    g.lineTo(0, size * 0.85);
    g.lineTo(-size * 0.6, 0);
    g.closePath();
    g.fillPath();
    g.strokePath();

    // Right-side color division/shading
    g.fillStyle(0xffffff, 0.15);
    g.beginPath();
    g.moveTo(0, -size * 0.6);
    g.lineTo(size * 0.6, -size * 0.6);
    g.lineTo(size * 0.6, 0);
    g.lineTo(0, size * 0.85);
    g.closePath();
    g.fillPath();

    // Inner shield lines
    g.lineStyle(1, 0x111318, 1);
    g.beginPath();
    g.moveTo(-size * 0.35, -size * 0.4);
    g.lineTo(size * 0.35, -size * 0.4);
    g.lineTo(size * 0.35, 0);
    g.lineTo(0, size * 0.6);
    g.lineTo(-size * 0.35, 0);
    g.closePath();
    g.strokePath();

    // Metal rivets
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(-size * 0.42, -size * 0.45, 1.5);
    g.fillCircle(size * 0.42, -size * 0.45, 1.5);
    g.fillCircle(-size * 0.42, 0, 1.5);
    g.fillCircle(size * 0.42, 0, 1.5);
    g.fillCircle(0, size * 0.65, 1.5);
  } else if (roleName === 'melee') {
    // Beautiful detailed Broadsword with Fuller & Pommel Core
    // Blade
    g.beginPath();
    g.moveTo(-size * 0.12, size * 0.15);
    g.lineTo(-size * 0.12, -size * 0.85);
    g.lineTo(0, -size * 1.05);
    g.lineTo(size * 0.12, -size * 0.85);
    g.lineTo(size * 0.12, size * 0.15);
    g.closePath();
    g.fillPath();
    g.strokePath();

    // Blade fuller
    g.lineStyle(1, 0xffffff, 0.35);
    g.beginPath();
    g.moveTo(0, size * 0.1);
    g.lineTo(0, -size * 0.8);
    g.strokePath();

    // Crossguard
    g.fillStyle(0x111318, 1);
    g.lineStyle(1.5, 0x111318, 1);
    g.beginPath();
    g.moveTo(-size * 0.45, size * 0.12);
    g.lineTo(size * 0.45, size * 0.12);
    g.lineTo(size * 0.38, size * 0.24);
    g.lineTo(-size * 0.38, size * 0.24);
    g.closePath();
    g.fillPath();
    g.strokePath();

    // Hilt wrapping
    g.fillRect(-size * 0.08, size * 0.24, size * 0.16, size * 0.45);
    g.lineStyle(1, 0xffffff, 0.25);
    g.beginPath();
    g.moveTo(-size * 0.08, size * 0.35); g.lineTo(size * 0.08, size * 0.41);
    g.moveTo(-size * 0.08, size * 0.48); g.lineTo(size * 0.08, size * 0.54);
    g.strokePath();

    // Pommel gem
    g.fillStyle(0x111318, 1);
    g.fillCircle(0, size * 0.76, size * 0.18);
    g.strokeCircle(0, size * 0.76, size * 0.18);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(0, size * 0.76, size * 0.07);
  } else if (roleName === 'ranged') {
    // Heavy Compound Reticle and crosshairs
    g.lineStyle(1.5, 0x111318, 1);
    g.strokeCircle(0, 0, size * 0.75);
    g.strokeCircle(0, 0, size * 0.45);
    g.strokeCircle(0, 0, size * 0.18);
    g.beginPath();
    g.moveTo(-size * 0.95, 0); g.lineTo(size * 0.95, 0);
    g.moveTo(0, -size * 0.95); g.lineTo(0, size * 0.95);
    
    // Axis ticks
    g.moveTo(-size * 0.6, -3); g.lineTo(-size * 0.6, 3);
    g.moveTo(size * 0.6, -3); g.lineTo(size * 0.6, 3);
    g.moveTo(-3, -size * 0.6); g.lineTo(3, -size * 0.6);
    g.moveTo(-3, size * 0.6); g.lineTo(3, size * 0.6);
    g.strokePath();
  } else if (roleName === 'cavalry') {
    // Stylized Armor-plated Knight Horse with visor slot
    g.beginPath();
    g.moveTo(size * 0.25, size * 0.65);
    g.lineTo(size * 0.2, -size * 0.1);
    g.lineTo(size * 0.25, -size * 0.5);
    g.lineTo(size * 0.1, -size * 0.65);
    g.lineTo(0, -size * 0.4);
    g.lineTo(-size * 0.15, -size * 0.52);
    g.lineTo(-size * 0.65, -size * 0.15);
    g.lineTo(-size * 0.55, size * 0.1);
    g.lineTo(-size * 0.25, size * 0.12);
    g.lineTo(-size * 0.4, size * 0.65);
    g.closePath();
    g.fillPath();
    g.strokePath();

    // Visor eye glowing slot
    g.lineStyle(1.5, 0xffffff, 0.7);
    g.beginPath();
    g.moveTo(-size * 0.25, -size * 0.12);
    g.lineTo(-size * 0.1, -size * 0.08);
    g.strokePath();

    // Mane hair lines
    g.lineStyle(1, 0xffffff, 0.25);
    g.beginPath();
    g.moveTo(size * 0.1, 0); g.lineTo(size * 0.21, size * 0.15);
    g.moveTo(size * 0.12, size * 0.25); g.lineTo(size * 0.23, size * 0.4);
    g.strokePath();
  } else if (roleName === 'support') {
    // Healing/Greek Cross with inner glow lines
    g.beginPath();
    const w = size * 0.38;
    g.moveTo(-w/2, -size * 0.9);
    g.lineTo(w/2, -size * 0.9);
    g.lineTo(w/2, -w/2);
    g.lineTo(size * 0.9, -w/2);
    g.lineTo(size * 0.9, w/2);
    g.lineTo(w/2, w/2);
    g.lineTo(w/2, size * 0.9);
    g.lineTo(-w/2, size * 0.9);
    g.lineTo(-w/2, w/2);
    g.lineTo(-size * 0.9, w/2);
    g.lineTo(-size * 0.9, -w/2);
    g.lineTo(-w/2, -w/2);
    g.closePath();
    g.fillPath();
    g.strokePath();

    // Central inner cross glow line
    g.lineStyle(1.2, 0xffffff, 0.5);
    g.beginPath();
    g.moveTo(0, -size * 0.7);
    g.lineTo(0, size * 0.7);
    g.moveTo(-size * 0.7, 0);
    g.lineTo(size * 0.7, 0);
    g.strokePath();
  } else if (roleName === 'heavy') {
    // Fortified Bastion Tower with Gothic pointed arch portcullis gate
    g.beginPath();
    g.moveTo(-size * 0.6, -size * 0.7);
    g.lineTo(-size * 0.6, size * 0.8);
    g.lineTo(size * 0.6, size * 0.8);
    g.lineTo(size * 0.6, -size * 0.7);
    // Crenellations
    g.lineTo(size * 0.32, -size * 0.7);
    g.lineTo(size * 0.32, -size * 0.38);
    g.lineTo(size * 0.1, -size * 0.38);
    g.lineTo(size * 0.1, -size * 0.7);
    g.lineTo(-size * 0.1, -size * 0.7);
    g.lineTo(-size * 0.1, -size * 0.38);
    g.lineTo(-size * 0.32, -size * 0.38);
    g.lineTo(-size * 0.32, -size * 0.7);
    g.closePath();
    g.fillPath();
    g.strokePath();

    // Pointed Gothic Portcullis Gate
    g.fillStyle(0x0a0c10, 0.85);
    g.beginPath();
    g.moveTo(-size * 0.22, size * 0.8);
    g.lineTo(-size * 0.22, size * 0.3);
    g.lineTo(0, size * 0.1);
    g.lineTo(size * 0.22, size * 0.3);
    g.lineTo(size * 0.22, size * 0.8);
    g.closePath();
    g.fillPath();
    
    // Gate portcullis grids
    g.lineStyle(1, 0xffffff, 0.3);
    g.beginPath();
    g.moveTo(-size * 0.11, size * 0.8); g.lineTo(-size * 0.11, size * 0.2);
    g.moveTo(size * 0.11, size * 0.8); g.lineTo(size * 0.11, size * 0.2);
    g.moveTo(-size * 0.22, size * 0.45); g.lineTo(size * 0.22, size * 0.45);
    g.moveTo(-size * 0.22, size * 0.62); g.lineTo(size * 0.22, size * 0.62);
    g.strokePath();
  }

  return g;
}
