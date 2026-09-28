import { beforeEach, describe, expect, it } from 'vitest';
import { useUi } from '../../apps/desktop/src/features/ui/store';

describe('UI diff navigation', () => {
  beforeEach(() => {
    useUi.setState({
      centerDiff: null,
      centerEditor: null,
      centerFileHistory: null,
      fileHistoryPreset: null,
      sidebarHiddenForDiff: false,
    });
  });

  it('makes a newly opened diff replace editor and file-history views', () => {
    useUi.setState({
      centerEditor: 'src/editor.ts',
      centerFileHistory: 'src/history.ts',
      fileHistoryPreset: { pane: 'blame', rev: 'HEAD' },
    });

    useUi.getState().openCenterDiff({ path: 'src/changed.ts', staged: false, keepOpen: true });

    expect(useUi.getState()).toMatchObject({
      centerDiff: { path: 'src/changed.ts', staged: false, keepOpen: true },
      centerEditor: null,
      centerFileHistory: null,
      fileHistoryPreset: null,
      sidebarHiddenForDiff: true,
    });
  });

  it('requests focus for the graph commit search field', () => {
    const before = useUi.getState().graphSearchFocusSeq;

    useUi.getState().focusGraphSearch();

    expect(useUi.getState().graphSearchFocusSeq).toBe(before + 1);
  });
});
