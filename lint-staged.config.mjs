export default {
  '*.{js,mjs,cjs,ts,tsx}': [
    'eslint --fix --max-warnings 0',
    'prettier --write',
  ],
  '*.{json,jsonc,md,yml,yaml,css}': ['prettier --write'],
};
