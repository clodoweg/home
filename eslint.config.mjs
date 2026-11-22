/** ESLint — flat config of the front (ESLint 10), on the model of home-back's. */
import js from '@eslint/js';
import eslintReact from '@eslint-react/eslint-plugin';
import betterTailwindcss from 'eslint-plugin-better-tailwindcss';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import reactHooks from 'eslint-plugin-react-hooks';
import sonarjs from 'eslint-plugin-sonarjs';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    'node_modules/**',
    'dist/**',
    'dist-e2e/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
  ]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    ...eslintReact.configs['recommended-typescript'],
  },
  reactHooks.configs.flat.recommended,
  sonarjs.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // Rules of Hooks and React Compiler checks come from react-hooks (above): the @eslint-react
      // copies would report the same spots twice, under names the existing disables don't match.
      '@eslint-react/error-boundaries': 'off',
      '@eslint-react/exhaustive-deps': 'off',
      '@eslint-react/purity': 'off',
      '@eslint-react/rules-of-hooks': 'off',
      '@eslint-react/set-state-in-effect': 'off',
      '@eslint-react/set-state-in-render': 'off',
      '@eslint-react/static-components': 'off',
      '@eslint-react/unsupported-syntax': 'off',
      '@eslint-react/use-memo': 'off',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    ...betterTailwindcss.configs.correctness,
    settings: {
      'better-tailwindcss': { entryPoint: 'global.css', cwd: import.meta.dirname },
    },
  },
  {
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Node scripts and tool configs
    files: ['scripts/**/*.mjs', '*.config.{mjs,mts,ts,cjs,js}', 'e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  // Last: Prettier formats, and turns off the stylistic rules it would fight with.
  prettierRecommended,
]);
