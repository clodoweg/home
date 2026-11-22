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

// WARNING: known debt, not an allowance. Functions above the cognitive complexity threshold (15)
// when sonarjs was adopted (November 2026): each file keeps its worst score as a ceiling, so it
// cannot get worse. Lower or remove an entry when its file is refactored; never raise one.
const COGNITIVE_COMPLEXITY_BASELINE = {
  'src/components/ui/TimelineChart.tsx': 19,
  'src/components/widgets/AlarmWidget.tsx': 22,
  'src/components/widgets/ArloWidget.tsx': 22,
  'src/components/widgets/ElectricityWidget.tsx': 24,
  'src/components/widgets/TemperatureWidget.tsx': 17,
  'src/components/widgets/WashingMachineWidget.tsx': 44,
  'src/components/widgets/petkit/FountainWidget.tsx': 39,
  'src/components/widgets/spa/SpaControls.tsx': 17,
  'src/components/widgets/washing-machine/labels.ts': 37,
  'src/hooks/useHAHistory.ts': 23,
  'src/lib/printer.ts': 31,
  'src/screens/DashboardScreen.tsx': 22,
  'src/screens/HomeSummaryTiles.tsx': 37,
  'src/screens/history/EnergyHistory.tsx': 20,
  'src/services/client.ts': 29,
};

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
    rules: {
      // Nested ternaries are the house style in JSX.
      'sonarjs/no-nested-conditional': 'off',
      // `TODO: [action]` is required by .claude/rules/code-comments.md.
      'sonarjs/todo-tag': 'off',
      // Event handlers inline in JSX nest naturally; nested template literals stay short here.
      'sonarjs/no-nested-functions': 'off',
      'sonarjs/no-nested-template-literals': 'off',
      // `void promise` marks a deliberately unawaited call.
      'sonarjs/void-use': 'off',
    },
  },
  ...Object.entries(COGNITIVE_COMPLEXITY_BASELINE).map(([file, ceiling]) => ({
    files: [file],
    rules: { 'sonarjs/cognitive-complexity': ['error', ceiling] },
  })),
  {
    // Fake hosts, plain-http fixtures, exact expected numbers and assertions made in helpers are
    // what tests are for.
    files: ['**/*.test.{ts,tsx}', 'src/test/**', 'e2e/**'],
    rules: {
      'sonarjs/assertions-in-tests': 'off',
      'sonarjs/no-clear-text-protocols': 'off',
      'sonarjs/no-floating-point-equality': 'off',
      'sonarjs/no-hardcoded-ip': 'off',
    },
  },
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
