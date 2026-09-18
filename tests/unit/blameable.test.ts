import { describe, expect, it } from 'vitest';
import { hasCommittedHistory } from '@angkorgit/core';

describe('hasCommittedHistory', () => {
  it('is true for tracked files whatever their change kind', () => {
    expect(hasCommittedHistory({ staged: null, unstaged: 'modified' })).toBe(true);
    expect(hasCommittedHistory({ staged: 'modified', unstaged: 'modified' })).toBe(true);
    expect(hasCommittedHistory({ staged: 'deleted', unstaged: null })).toBe(true);
    expect(hasCommittedHistory({ staged: 'renamed', unstaged: null })).toBe(true);
    expect(hasCommittedHistory({ staged: null, unstaged: null })).toBe(true);
  });

  it('is false for files no commit has seen yet', () => {
    expect(hasCommittedHistory({ staged: null, unstaged: 'untracked' })).toBe(false);
    expect(hasCommittedHistory({ staged: 'new', unstaged: null })).toBe(false);
    expect(hasCommittedHistory({ staged: 'new', unstaged: 'modified' })).toBe(false);
  });
});
