import { describe, expect, it } from 'vitest';
import { buildGitmdAgentUiContext } from '../../apps/desktop/src/features/terminal/gitmdCodeContext';

const repo = { headBranch: 'main', headOid: 'abc123', state: 'clean' };
const emptyUi = {
  conflictFile: null,
  centerDiff: null,
  centerFileHistory: null,
  fileHistoryPreset: null,
  centerEditor: null,
  selectedFile: null,
};

describe('buildGitmdAgentUiContext', () => {
  it('captures the selected working-copy diff without including diff content', () => {
    const context = buildGitmdAgentUiContext(
      repo,
      { ...emptyUi, centerDiff: { path: 'src/app.ts', staged: true } },
      null,
    );

    expect(context).toEqual({
      view: 'diff',
      headBranch: 'main',
      headOid: 'abc123',
      repoState: 'clean',
      selectedOid: null,
      path: 'src/app.ts',
      staged: true,
      oid: null,
      oldPath: null,
      rev: null,
    });
  });

  it('captures commit-diff and conflict targets ahead of other selections', () => {
    expect(buildGitmdAgentUiContext(
      repo,
      { ...emptyUi, centerDiff: { path: 'src/app.ts', oid: 'def456', oldPath: 'src/old.ts' } },
      'abc123',
    )).toMatchObject({ view: 'commitDiff', path: 'src/app.ts', oid: 'def456', oldPath: 'src/old.ts' });

    expect(buildGitmdAgentUiContext(
      repo,
      { ...emptyUi, conflictFile: 'src/conflict.ts', selectedFile: { path: 'src/other.ts', staged: false } },
      null,
    )).toMatchObject({ view: 'conflict', path: 'src/conflict.ts' });
  });

  it('uses selected commit or repository context when no file view is open', () => {
    expect(buildGitmdAgentUiContext(repo, emptyUi, 'abc123')).toMatchObject({
      view: 'commit',
      selectedOid: 'abc123',
      oid: 'abc123',
    });
    expect(buildGitmdAgentUiContext(null, emptyUi, null)).toMatchObject({
      view: 'repository',
      repoState: 'unknown',
      headBranch: null,
      headOid: null,
    });
  });
});
