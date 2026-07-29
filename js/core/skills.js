/**
 * skills.js — навыки: опыт, уровни, рост от применения.
 * Формула из balance.js → SKILLS (закомментирована там же).
 */

import { SKILLS } from '../data/balance.js';

/** level = floor(sqrt(xp / xpPerLevel)), кап maxLevel. Чистая функция формулы. */
export function skillLevelFromXp(xp, xpPerLevel = SKILLS.xpPerLevel, maxLevel = SKILLS.maxLevel) {
  const level = Math.floor(Math.sqrt(xp / xpPerLevel));
  return Math.min(maxLevel, Math.max(0, level));
}

/**
 * Добавить опыт навыку. Возвращает true, если поднялся уровень
 * (UI покажет «⬆️ Навык вырос!»). Мутирует state.
 */
export function addSkillXp(state, skillKey, amount = SKILLS.list[skillKey].xpPerUse) {
  const skill = state.skills[skillKey];
  if (!skill) return false;
  skill.xp += amount;
  const newLevel = skillLevelFromXp(skill.xp);
  if (newLevel > skill.level) {
    skill.level = newLevel;
    return true;
  }
  return false;
}
