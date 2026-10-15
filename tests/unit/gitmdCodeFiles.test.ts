import { describe, expect, it } from 'vitest';
import {
  attachedFilesPrompt,
  mergeGitmdCodeFiles,
  normalizeGitmdCodeFiles,
} from '../../apps/desktop/src/features/terminal/gitmdCodeFiles';

describe('gitmd code file associations', () => {
  it('keeps staged and unstaged copies and drops duplicates', () => {
    const files = mergeGitmdCodeFiles(
      [{ path: 'src/app.ts', staged: false }],
      [
        { path: ' src/app.ts ', staged: false },
        { path: 'src/app.ts', staged: true },
        { path: '   ', staged: false },
      ],
    );

    expect(files).toEqual([
      { path: 'src/app.ts', staged: false },
      { path: 'src/app.ts', staged: true },
    ]);
  });

  it('associates files without replacing the user question', () => {
    expect(attachedFilesPrompt(
      [{ path: 'src/app.ts', staged: true }],
      '  这个改动会不会影响提交？  ',
    )).toBe('Attached files:\n- src/app.ts (staged)\n\n这个改动会不会影响提交？');
    expect(attachedFilesPrompt([{ path: 'README.md', staged: false }], '')).toBe('Attached files:\n- README.md');
    expect(attachedFilesPrompt([], '只看状态')).toBe('只看状态');
  });

  it('keeps a commit file separate from the working copy', () => {
    expect(mergeGitmdCodeFiles(
      [{ path: 'src/app.ts', staged: false }],
      [{ path: ' src/app.ts ', staged: true, oid: 'abcdef1234567', oldPath: ' src/old.ts ' }],
    )).toEqual([
      { path: 'src/app.ts', staged: false },
      { path: 'src/app.ts', staged: false, oid: 'abcdef1234567', oldPath: 'src/old.ts' },
    ]);
  });

  it('labels a commit attachment with its revision', () => {
    expect(attachedFilesPrompt(
      [{ path: 'src/app.ts', staged: false, oid: 'abcdef1234567' }],
      '  解释这次提交里的改动  ',
    )).toBe('Attached files:\n- src/app.ts (commit abcdef1234567)\n\n解释这次提交里的改动');
  });

  it('accepts the previous single-file prompt shape as a file association', () => {
    expect(normalizeGitmdCodeFiles({
      path: 'src/legacy.ts',
      staged: true,
      files: [],
    })).toEqual([{ path: 'src/legacy.ts', staged: true }]);
  });
});
