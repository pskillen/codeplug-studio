import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['src/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'core must not import React' },
            { name: 'react-dom', message: 'core must not import React' },
            { name: 'react-router-dom', message: 'core must not import React Router' },
          ],
          patterns: [
            {
              group: ['@app/*', '@integrations/*', '**/app/*', '**/integrations/*'],
              message: 'core must not import app or integrations layers',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/integrations/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'integrations must not import React' },
            { name: 'react-dom', message: 'integrations must not import React' },
          ],
          patterns: [
            {
              group: ['@app/*', '**/app/*'],
              message: 'integrations must not import app layer',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@core/import-export/formats/*', '**/core/import-export/formats/*'],
              message: 'app must use services, not format adapters directly',
            },
          ],
        },
      ],
    },
  },
);
