import { describe, expect, it } from 'vitest';
import { buildFileTree } from '../../apps/desktop/src/components/FileTree';

describe('buildFileTree', () => {
  it('stores exactly the listed file paths beneath each folder', () => {
    const tree = buildFileTree(
      [
        { path: 'src/visible.ts' },
        { path: 'src/nested/visible-too.ts' },
        { path: 'docs/readme.md' },
      ],
      (file) => file.path,
    );

    const src = tree.folders.find((folder) => folder.path === 'src');
    expect(src?.filePaths).toEqual(['src/visible.ts', 'src/nested/visible-too.ts']);
    expect(src?.count).toBe(2);
    expect(src?.filePaths).not.toContain('src/hidden-by-filter.ts');
  });
});
