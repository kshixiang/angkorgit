import { describe, expect, it } from 'vitest';
import { fileFilterTerms, filterFiles, matchesFileFilter } from '@gitmd/core';

const files = [
  'src/features/graph/CommitGraph.tsx',
  'src/core/ipc.ts',
  'docs/Architecture.md',
  'src/data/palette-seed.sql',
];

describe('file filter', () => {
  it('returns everything for an empty or whitespace query', () => {
    expect(filterFiles(files, (f) => f, '')).toEqual(files);
    expect(filterFiles(files, (f) => f, '   ')).toEqual(files);
  });

  it('matches case-insensitively anywhere in the path', () => {
    expect(filterFiles(files, (f) => f, 'GRAPH')).toEqual(['src/features/graph/CommitGraph.tsx']);
    expect(filterFiles(files, (f) => f, 'docs/')).toEqual(['docs/Architecture.md']);
  });

  it('requires every space-separated term', () => {
    expect(fileFilterTerms('  src  .ts ')).toEqual(['src', '.ts']);
    expect(filterFiles(files, (f) => f, 'src .ts')).toEqual([
      'src/features/graph/CommitGraph.tsx',
      'src/core/ipc.ts',
    ]);
    expect(matchesFileFilter('docs/Architecture.md', ['docs', 'zzz'])).toBe(false);
  });
});
