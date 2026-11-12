export const AGENTS_FILE_NAME = 'AGENTS.md';
export const SECTION_START = '<!-- dotrun:start -->';
export const SECTION_END = '<!-- dotrun:end -->';
const SECTION_HEADING = '## Start command (`.run`)';
const NEW_FILE_HEADING = '# Agent instructions';

export function stripFrontmatter(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n[\s\S]*?\n---\n/);
  return (match ? normalized.slice(match[0].length) : normalized).trim();
}

export function buildSection(ruleBody: string): string {
  return `${SECTION_START}\n${SECTION_HEADING}\n\n${ruleBody.trim()}\n${SECTION_END}`;
}

export function hasAgentsSection(text: string | undefined): boolean {
  return !!text && text.includes(SECTION_START);
}

export function upsertAgentsSection(existing: string | undefined, ruleBody: string): string {
  const section = buildSection(ruleBody);
  if (!existing || existing.trim().length === 0) {
    return `${NEW_FILE_HEADING}\n\n${section}\n`;
  }

  const start = existing.indexOf(SECTION_START);
  const end = existing.indexOf(SECTION_END);
  if (start !== -1 && end > start) {
    return existing.slice(0, start) + section + existing.slice(end + SECTION_END.length);
  }

  return `${existing.trimEnd()}\n\n${section}\n`;
}
