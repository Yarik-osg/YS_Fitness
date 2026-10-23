import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { resolveAffectedBase } from './run-affected-tests.mjs';

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function initRepo() {
  const cwd = mkdtempSync(join(tmpdir(), 'affected-base-'));
  git(cwd, ['init', '-b', 'main']);
  git(cwd, ['config', 'user.email', 'dev@example.com']);
  git(cwd, ['config', 'user.name', 'Dev']);
  return cwd;
}

function commit(cwd, message) {
  git(cwd, ['commit', '--allow-empty', '-m', message]);
  return git(cwd, ['rev-parse', 'HEAD']);
}

function runner(cwd) {
  return (args) => {
    try {
      const stdout = execFileSync('git', args, {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { status: 0, stdout };
    } catch (error) {
      return {
        status: error.status ?? 1,
        stdout: error.stdout?.toString() ?? '',
      };
    }
  };
}

test('uses the merge base with origin/main when it shares history with HEAD', () => {
  const cwd = initRepo();
  try {
    const base = commit(cwd, 'base');
    git(cwd, ['branch', 'origin/main']);
    git(cwd, ['checkout', '-b', 'feature']);
    commit(cwd, 'feature');
    assert.equal(resolveAffectedBase(runner(cwd)), base);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('uses the merge base with local main when origin/main is absent', () => {
  const cwd = initRepo();
  try {
    const base = commit(cwd, 'base');
    git(cwd, ['checkout', '-b', 'feature']);
    commit(cwd, 'feature');
    assert.equal(resolveAffectedBase(runner(cwd)), base);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('does not filter against the branch that is already HEAD', () => {
  const cwd = initRepo();
  try {
    commit(cwd, 'base');
    assert.equal(resolveAffectedBase(runner(cwd)), null);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('skips an unrelated origin/main and uses main', () => {
  const cwd = initRepo();
  try {
    const base = commit(cwd, 'base');
    git(cwd, ['checkout', '--orphan', 'unrelated']);
    git(cwd, ['commit', '--allow-empty', '-m', 'other']);
    git(cwd, ['branch', '-M', 'origin/main']);
    git(cwd, ['checkout', 'main']);
    git(cwd, ['checkout', '-b', 'feature']);
    commit(cwd, 'feature');
    assert.equal(resolveAffectedBase(runner(cwd)), base);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('uses the shared ancestor when origin/main and HEAD have diverged', () => {
  const cwd = initRepo();
  try {
    const ancestor = commit(cwd, 'ancestor');
    git(cwd, ['branch', 'origin/main']);
    git(cwd, ['checkout', 'origin/main']);
    commit(cwd, 'remote');
    git(cwd, ['checkout', 'main']);
    git(cwd, ['checkout', '-b', 'feature']);
    const feature = commit(cwd, 'feature');
    const base = resolveAffectedBase(runner(cwd));
    assert.equal(base, ancestor);
    assert.notEqual(base, feature);
    assert.notEqual(base, git(cwd, ['rev-parse', 'origin/main']));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
