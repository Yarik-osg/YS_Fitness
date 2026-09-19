export default {
  '*.{js,mjs,cjs,ts,tsx}': ['eslint --fix', 'prettier --write'],
  '*.{json,jsonc,md,yml,yaml,css}': ['prettier --write'],
};
