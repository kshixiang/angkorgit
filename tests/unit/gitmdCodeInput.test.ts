import { describe, expect, it } from 'vitest';
import {
  memoryNoteFromInput,
  normalizeSlashCommand,
  persistentMemoryFromInput,
  shellCommandFromInput,
  slashCommandSuggestions,
} from '../../apps/desktop/src/features/terminal/gitmdCodeInput';

describe('GitMD Code input commands', () => {
  it('suggests Claude-style slash commands', () => {
    expect(slashCommandSuggestions('/re').map((command) => command.name)).toEqual(['/review']);
  });

  it('normalizes slash commands', () => {
    expect(normalizeSlashCommand('/status')).toMatchObject({ name: '/status' });
    expect(normalizeSlashCommand('/unknown')).toBeNull();
  });

  it('extracts shell commands and memory notes', () => {
    expect(shellCommandFromInput('! pnpm test')).toBe('pnpm test');
    expect(memoryNoteFromInput('# use pnpm')).toBe('use pnpm');
    expect(shellCommandFromInput('hello')).toBeNull();
  });

  it('parses persistent repository and user memory notes', () => {
    expect(persistentMemoryFromInput('# remember: use pnpm')).toEqual({
      scope: 'repository',
      content: 'use pnpm',
    });
    expect(persistentMemoryFromInput('# remember global: prefers concise answers')).toEqual({
      scope: 'user',
      content: 'prefers concise answers',
    });
    expect(persistentMemoryFromInput('# temporary note')).toBeNull();
  });
});
