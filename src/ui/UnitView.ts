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
}

/**
 * Представление юнита для отрисовки (Phaser-контейнер) + ссылки на меняющиеся
 * части (полоска HP, бейдж состояния). Отделено от логики: сцена лишь читает
 * модель и вызывает setHp / setStateText.
 */
export interface UnitView {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Arc;
  hpFill: Phaser.GameObjects.Rectangle;
  stateLabel: Phaser.GameObjects.Text;
  radius: number;
}

export function createUnitView(
  scene: Phaser.Scene,
  opts: UnitViewOptions,
): UnitView {
  const radius = opts.radius ?? 17;
  const hpWidth = opts.hpWidth ?? 36;
  const team = TEAM_COLORS[opts.team];
  const role = ROLE_INFO[opts.role];

  // Тень.
  const shadow = scene.add
    .ellipse(0, radius * 0.7, radius * 1.7, radius * 0.6, 0x000000, 0.3)
    .setDepth(-1);

  // Тело (цвет команды) + обводка.
  const body = scene.add.circle(0, 0, radius, team.body);
  body.setStrokeStyle(2, team.edge);

  // Эмблема роли (цвет роли).
  const emblem = scene.add.circle(0, 0, radius * 0.62, role.color, 0.9);

  // Буква роли.
  const letter = scene.add
    .text(0, 0, role.letter, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      color: '#0b0e14',
      fontStyle: 'bold',
    })
    .setOrigin(0.5);

  // Полоска HP.
  const hpBg = scene.add
    .rectangle(0, -radius - 9, hpWidth + 2, 5, 0x000000, 0.6)
    .setOrigin(0.5);
  const hpFill = scene.add
    .rectangle(-hpWidth / 2, -radius - 9, hpWidth, 3, COLORS.hpHigh)
    .setOrigin(0, 0.5);

  // Подпись роли.
  const roleLabel = scene.add
    .text(0, radius + 8, role.label, {
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
  DEAD: 'пал',
};

export function setStateText(view: UnitView, state: string): void {
  view.stateLabel.setText(STATE_LABEL[state] ?? state);
}
