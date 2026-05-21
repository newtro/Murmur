// ESLint v9 flat config.
// Replaces the legacy .eslintrc that broke when the project upgraded to ESLint
// v9 and never re-installed @typescript-eslint. Scoped to type-checking-light
// rules that match what the codebase ALREADY conforms to — turning on the
// recommended sets project-wide would surface hundreds of pre-existing issues.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '.vite/**',
      'out/**',
      'dist/**',
      'resources/**',
      'scripts/**',
      '**/*.config.js',
      '**/*.config.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // React 17+ JSX transform — `import React` no longer required
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // Codebase uses `any` in several IPC/legacy spots; warn so it shows up
      // in reviews but don't fail the lint run.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // CommonJS requires are needed for the platform-specific libnut load.
      '@typescript-eslint/no-require-imports': 'off',
      // Used widely for overlay-state callbacks.
      'react/display-name': 'off',
    },
  },
  // Test files: allow no-explicit-any (vitest mocks).
  {
    files: ['src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  }
);
