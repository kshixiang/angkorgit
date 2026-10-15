import { describe, expect, it } from 'vitest';
import {
  cycleGitmdChangeMode,
  gitmdChangeModeAfterTurn,
  inputNeedsRepositoryChanges,
  isReadOnlyChangeBlocked,
  memoryNoteFromInput,
  normalizeSlashCommand,
  persistentMemoryFromInput,
  READ_ONLY_CHANGE_MARKER,
  shellCommandFromInput,
  shouldAskToSwitchChangeMode,
  slashCommandSuggestions,
  withoutReadOnlyChangeMarker,
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

  it('asks to switch only when a read-only prompt needs repository changes', () => {
    expect(inputNeedsRepositoryChanges('帮我把登录改成异步')).toBe(true);
    expect(inputNeedsRepositoryChanges('commit these changes')).toBe(true);
    expect(inputNeedsRepositoryChanges('解释并修复这个 bug')).toBe(true);
    expect(inputNeedsRepositoryChanges('解释这个 diff')).toBe(false);
    expect(inputNeedsRepositoryChanges('why did this commit fail?')).toBe(false);
    expect(inputNeedsRepositoryChanges('帮我看看这个 commit')).toBe(false);
    expect(inputNeedsRepositoryChanges('/review')).toBe(false);
    expect(inputNeedsRepositoryChanges('! pnpm test')).toBe(false);
    expect(shouldAskToSwitchChangeMode('fix the test', 'readonly', null)).toBe(true);
    expect(shouldAskToSwitchChangeMode('fix the test', 'keep', null)).toBe(false);
    expect(shouldAskToSwitchChangeMode('fix the test', 'readonly', 'readonly')).toBe(false);
  });

  it('keeps edit mode across turns and can cycle back to read-only', () => {
    expect(cycleGitmdChangeMode('readonly')).toBe('once');
    expect(cycleGitmdChangeMode('once')).toBe('keep');
    expect(cycleGitmdChangeMode('keep')).toBe('readonly');
    expect(gitmdChangeModeAfterTurn('once')).toBe('readonly');
    expect(gitmdChangeModeAfterTurn('keep')).toBe('keep');
    const blocked = READ_ONLY_CHANGE_MARKER + ' 当前处于只读模式，无法修改仓库。';
    expect(isReadOnlyChangeBlocked(blocked)).toBe(true);
    expect(withoutReadOnlyChangeMarker(blocked)).toBe('当前处于只读模式，无法修改仓库。');
  });
});
