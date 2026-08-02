import type { Team } from '../entities/types';

/** Цветовая палитра отрисовки (только UI). */
export const TEAM_COLORS: Record<Team, { body: number; edge: number; glow: number }> = {
  player: { body: 0x3b82f6, edge: 0x1e3a8a, glow: 0x60a5fa },
  enemy: { body: 0xef4444, edge: 0x7f1d1d, glow: 0xfca5a5 },
};

export const COLORS = {
  bg: 0x10131a,
  panel: 0x1b212f,
  panelEdge: 0x2c3447,
  text: 0xe5e7eb,
  textDim: 0x9aa3b2,
  accent: 0x38bdf8,
  valid: 0x22c55e,
  invalid: 0xef4444,
  hover: 0xffffff,
  hpHigh: 0x22c55e,
  hpMid: 0xeab308,
  hpLow: 0xef4444,
  playerZone: 0x3b82f6,
  enemyZone: 0xef4444,
};
