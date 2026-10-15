const vendored = [
  '.agents/',
  '.cursor/skills/',
  '.cursor/agents/',
  '.github/skills/',
  '.codex/',
];

function owned(files) {
  return files.filter((file) => {
    const path = file.replaceAll('\\', '/');
    return !vendored.some(
      (prefix) => path.includes(`/${prefix}`) || path.startsWith(prefix),
    );
  });
}

function run(commands) {
  return (files) => {
    const kept = owned(files);
    if (kept.length === 0) return [];
    const list = kept.map((file) => `'${file}'`).join(' ');
    return commands.map((command) => `${command} ${list}`);
  };
}

export default {
  '*.{js,mjs,cjs,ts,tsx}': run(['eslint --fix', 'prettier --write']),
  '*.{json,jsonc,md,yml,yaml,css}': run(['prettier --write']),
};
