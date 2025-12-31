// @ts-check

import { defineConfig } from 'eslint/config';
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import perfectionist from 'eslint-plugin-perfectionist';
import unicorn from 'eslint-plugin-unicorn';
import vitest from '@vitest/eslint-plugin';

export default defineConfig(
  eslint.configs.recommended,
  tseslint.configs.recommended,
  // @ts-ignore
  perfectionist.configs['recommended-natural'],
  unicorn.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      'unicorn/filename-case': 'off',
      'unicorn/no-array-reduce': 'off',
      'unicorn/no-null': 'off',
      'perfectionist/sort-union-types': 'off',
    },
  },
  {
    files: ['**/*.test.ts'],
    ...vitest.configs.recommended,
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: false,
      },
    },
    rules: {
      'perfectionist/sort-objects': 'off',
      'perfectionist/sort-classes': 'off',
      'unicorn/no-useless-undefined': 'off',
      'perfectionist/sort-object-types': 'off',
    },
  }
);
