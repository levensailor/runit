import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SECTION_END,
  SECTION_START,
  hasAgentsSection,
  stripFrontmatter,
  upsertAgentsSection,
} from './agentsRule';

const repoRoot = join(__dirname, '..');
const body = 'Keep a `.run` file.';

test('Copilot instructions and Cursor plugin rule share the same body', () => {
  const copilot = stripFrontmatter(readFileSync(join(repoRoot, 'prompts', 'dotrun.instructions.md'), 'utf8'));
  const cursor = stripFrontmatter(readFileSync(join(repoRoot, 'rules', 'dotrun.mdc'), 'utf8'));
  assert.ok(copilot.length > 0);
  assert.equal(copilot, cursor);
});

test('stripFrontmatter removes YAML header and surrounding whitespace', () => {
  assert.equal(stripFrontmatter('---\nname: x\n---\n\nHello\n'), 'Hello');
  assert.equal(stripFrontmatter('No header\n'), 'No header');
});

test('creates a new AGENTS.md when none exists', () => {
  const result = upsertAgentsSection(undefined, body);
  assert.match(result, /^# Agent instructions\n\n<!-- dotrun:start -->/);
  assert.ok(result.includes(body));
  assert.ok(result.endsWith(`${SECTION_END}\n`));
});

test('appends to existing content without touching it', () => {
  const existing = '# Project\n\nUse pnpm.\n';
  const result = upsertAgentsSection(existing, body);
  assert.ok(result.startsWith('# Project\n\nUse pnpm.\n\n<!-- dotrun:start -->'));
  assert.equal(result.split(SECTION_START).length, 2);
});

test('replaces an existing section in place', () => {
  const existing = `# Project\n\n${SECTION_START}\nold text\n${SECTION_END}\n\n## Other\n`;
  const result = upsertAgentsSection(existing, body);
  assert.ok(!result.includes('old text'));
  assert.ok(result.includes(body));
  assert.ok(result.endsWith('\n\n## Other\n'));
  assert.equal(result.split(SECTION_START).length, 2);
});

test('hasAgentsSection detects the marker', () => {
  assert.equal(hasAgentsSection(undefined), false);
  assert.equal(hasAgentsSection('# Project'), false);
  assert.equal(hasAgentsSection(`x\n${SECTION_START}\ny`), true);
});
