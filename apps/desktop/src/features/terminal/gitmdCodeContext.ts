import type { GitmdAgentUiContext } from '@/core/ipc';

interface RepositorySnapshot {
  headBranch: string | null;
  headOid: string | null;
  state: string;
}

interface UiSnapshot {
  conflictFile: string | null;
  centerDiff: {
    path: string;
    staged?: boolean;
    oid?: string;
    oldPath?: string | null;
  } | null;
  centerFileHistory: string | null;
  fileHistoryPreset: { pane: 'blame'; rev: string | null } | null;
  centerEditor: string | null;
  selectedFile: { path: string; staged: boolean } | null;
}

export function buildGitmdAgentUiContext(
  repo: RepositorySnapshot | null,
  ui: UiSnapshot,
  selectedOid: string | null,
): GitmdAgentUiContext {
  const base = {
    headBranch: repo?.headBranch ?? null,
    headOid: repo?.headOid ?? null,
    repoState: repo?.state ?? 'unknown',
    selectedOid,
    path: null,
    staged: null,
    oid: null,
    oldPath: null,
    rev: null,
  };

  if (ui.conflictFile) {
    return { ...base, view: 'conflict', path: ui.conflictFile };
  }
  if (ui.centerDiff) {
    const target = ui.centerDiff;
    return {
      ...base,
      view: target.oid ? 'commitDiff' : 'diff',
      path: target.path,
      staged: target.oid ? null : target.staged === true,
      oid: target.oid ?? null,
      oldPath: target.oldPath ?? null,
    };
  }
  if (ui.centerFileHistory) {
    const isBlame = ui.fileHistoryPreset?.pane === 'blame';
    return {
      ...base,
      view: isBlame ? 'blame' : 'fileHistory',
      path: ui.centerFileHistory,
      rev: isBlame ? ui.fileHistoryPreset?.rev ?? null : null,
    };
  }
  if (ui.centerEditor) return { ...base, view: 'editor', path: ui.centerEditor };
  if (ui.selectedFile) {
    return {
      ...base,
      view: 'workingCopy',
      path: ui.selectedFile.path,
      staged: ui.selectedFile.staged,
    };
  }
  if (selectedOid) return { ...base, view: 'commit', oid: selectedOid };
  return { ...base, view: 'repository' };
}
