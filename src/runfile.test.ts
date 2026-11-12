import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { parseRunCommand } from './runfile';

test('returns a single-line command unchanged', () => {
  assert.equal(parseRunCommand('uv sync && uv run python -m backend\n'), 'uv sync && uv run python -m backend');
});

test('ignores full-line comments and blank lines', () => {
  const text = '# api server\n\n  npm run app  \n\n# trailing note\n';
  assert.equal(parseRunCommand(text), 'npm run app');
});

test('joins multiple command lines with &&', () => {
  assert.equal(parseRunCommand('npm install\r\nnpm run dev\r\n'), 'npm install && npm run dev');
});

test('keeps inline content exactly as written', () => {
  assert.equal(parseRunCommand('./run.sh --port 8080 # local'), './run.sh --port 8080 # local');
});

test('treats a shebang as a comment', () => {
  assert.equal(parseRunCommand('#!/bin/sh\n./run.sh'), './run.sh');
});

test('returns undefined for empty or comment-only files', () => {
  assert.equal(parseRunCommand(''), undefined);
  assert.equal(parseRunCommand('   \n\n'), undefined);
  assert.equal(parseRunCommand('# nothing yet\n'), undefined);
});
