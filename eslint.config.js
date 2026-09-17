// Линт бережливый: формат отдан Prettier, сюда — только ловушки смысла.
// Пороги оставляет за собой tsc (noUnusedLocals/Parameters).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'tools/_split/**', 'dist-ssr/**', '*.config.js'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-debugger': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-constant-condition': 'warn',
      // Типами ведает tsc; дублирующий линт здесь только шумит
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      // any разрешены осознанно в точках крепления к canvas/DOM-стабам
      '@typescript-eslint/no-explicit-any': 'off',
      // Комментарии-обоснования по-русски — норма проекта
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
);
