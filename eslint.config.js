import { config } from './packages/eslint-config/base.js';

export default [
  ...config,
  {
    ignores: [
      'apps/**',
      'packages/**',
      'design-reference/**',
      '.agents/**',
      '.cursor/**',
      '.github/skills/**',
      '.codex/**',
      '.next/**',
      '.turbo/**',
      '.husky/**',
    ],
  },
  {
    files: ['*.js', '*.mjs', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        URL: 'readonly',
      },
    },
  },
];
