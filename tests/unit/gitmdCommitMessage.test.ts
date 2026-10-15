import { describe, expect, it } from 'vitest';
import { DEFAULT_COMMIT_STYLE } from '@gitmd/core';
import {
  buildGitmdCommitMessagePrompt,
  commitMessageFromGitmdCode,
} from '../../apps/desktop/src/features/commit/gitmdCommitMessage';

describe('gitmd commit message handoff', () => {
  it('asks GitMD Code for a message without creating a commit', () => {
    const prompt = buildGitmdCommitMessagePrompt({
      style: {
        ...DEFAULT_COMMIT_STYLE,
        prefixRules: [{ pattern: 'feature/*', prefix: '[{ticket}]' }],
      },
      branch: 'feature/ABC-12-login',
      language: 'chinese',
      stagedCount: 14,
    });

    expect(prompt).toContain('Do not modify files');
    expect(prompt).toContain('or create a commit');
    expect(prompt).toContain('first 12');
    expect(prompt).toContain('[ABC-12]');
    expect(prompt).toContain('Simplified Chinese');
    expect(prompt).toContain('Output the message only');
  });

  it('keeps the model message and applies a missing prefix', () => {
    expect(commitMessageFromGitmdCode('```text\nfix: redirect login\n\nRestore the return path.\n```', null)).toBe(
      'fix: redirect login\n\nRestore the return path.',
    );
    expect(commitMessageFromGitmdCode('redirect login', '[ABC-12]')).toBe('[ABC-12] redirect login');
    expect(commitMessageFromGitmdCode('  [ABC-12] already prefixed  ', '[ABC-12]')).toBe('[ABC-12] already prefixed');
    expect(commitMessageFromGitmdCode('```\n```', null)).toBe('');
  });
});
