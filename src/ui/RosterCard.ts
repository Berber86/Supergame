import Phaser from 'phaser';
import { ROLE_INFO } from '../data/units';
import type { RosterUnit } from '../meta/RosterUnit';
import { COLORS, TEAM_COLORS } from './theme';

export interface CardStyle {
  w?: number;
  h?: number;
  selected?: boolean;
}

/**
 * Карточка ростер-юнита: фигура (цвет команды + эмблема роли), имя/роль,
 * статы, полоска и значение HP, опыт, статус (ранен/сражён).
 * Возвращает контейнер (позиция — левый-верхний угол) + ссылки для тонов.
 */
export function drawRosterCard(
  scene: Phaser.Scene,
  ru: RosterUnit,
  x: number,
  y: number,
  style: CardStyle = {},
): { container: Phaser.GameObjects.Container; bg: Phaser.GameObjects.Rectangle; hpFill: Phaser.GameObjects.Rectangle } {
  const w = style.w ?? 300;
  const h = style.h ?? 150;
  const ratio = Phaser.Math.Clamp(ru.currentHp / ru.maxHp, 0, 1);
  const downed = ru.currentHp <= 0;
  const wounded = ru.currentHp < ru.maxHp && !downed;
  const team = TEAM_COLORS.player;

  const container = scene.add.container(x, y, []).setDepth(5);

  const bgFill = downed ? 0x2a1f24 : wounded ? 0x2a2a1f : COLORS.panel;
  const bg = scene.add.rectangle(w / 2, h / 2, w, h, bgFill, 0.96).setStrokeStyle(
    style.selected ? 4 : 2,
    style.selected ? COLORS.accent : COLORS.panelEdge,
  );

  // Фигура.
  const fx = 46;
  const fy = h / 2 - 4;
  const r = 22;
  const body = scene.add.circle(fx, fy, r, team.body).setAlpha(downed ? 0.5 : 1);
  body.setStrokeStyle(2, team.edge);
  const role = ROLE_INFO[ru.role];
  const emblem = scene.add.circle(fx, fy, r * 0.62, role.color, 0.92);
  const letter = scene.add
    .text(fx, fy, role.letter, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#0b0e14',
    })
    .setOrigin(0.5);

  // Тексты.
  const tx = 86;
  const name = scene.add
    .text(tx, 12, ru.name, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#e5e7eb',
    })
    .setOrigin(0, 0);
  const roleLine = scene.add
    .text(tx, 33, role.label, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#9aa3b2',
    })
    .setOrigin(0, 0);
  const stats = scene.add
    .text(tx, 52, `ATK ${ru.atk}   DEF ${ru.def}   RNG ${ru.range}   SPD ${ru.move}`, {
      fontFamily: 'Consolas, monospace',
      fontSize: '11px',
      color: '#cbd5e1',
    })
    .setOrigin(0, 0);

  // Полоска HP.
  const barW = w - tx - 14;
  const barX = tx;
  const barY = 78;
  const hpBg = scene.add.rectangle(barX + barW / 2, barY, barW, 8, 0x000000, 0.5).setOrigin(0.5);
  const hpColor = downed ? 0x6b7280 : ratio > 0.5 ? COLORS.hpHigh : ratio > 0.25 ? COLORS.hpMid : COLORS.hpLow;
  const hpFill = scene.add.rectangle(barX, barY, barW * ratio, 6, hpColor).setOrigin(0, 0.5);
  const hpText = scene.add
    .text(tx, 86, `HP ${Math.max(0, Math.ceil(ru.currentHp))}/${ru.maxHp}`, {
      fontFamily: 'Consolas, monospace',
      fontSize: '11px',
      color: '#cbd5e1',
    })
    .setOrigin(0, 0);

  const xp = scene.add
    .text(tx, 104, `Опыт: ${ru.battleExperience}`, {
      fontFamily: 'Consolas, monospace',
      fontSize: '11px',
      color: '#9aa3b2',
    })
    .setOrigin(0, 0);

  // Статус-бейдж.
  let badge: Phaser.GameObjects.Text | null = null;
  if (downed) {
    badge = scene.add
      .text(w - 10, 12, 'СРАЖЁН', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#fca5a5',
      })
      .setOrigin(1, 0);
  } else if (wounded) {
    badge = scene.add
      .text(w - 10, 12, 'РАНЕН', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#fde047',
      })
      .setOrigin(1, 0);
  }

  container.add([bg, body, emblem, letter, name, roleLine, stats, hpBg, hpFill, hpText, xp]);
  if (badge) container.add(badge);

  return { container, bg, hpFill };
}
