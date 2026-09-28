import { describe, expect, it } from 'vitest';
import {
  filterGitmdCodeOutput,
  updateRuntimeErrorHint,
} from '../../apps/desktop/src/features/terminal/gitmdCodeOutput';
import {
  classifyGitmdCodeReference,
  parseGitmdCodeOutputParts,
} from '../../apps/desktop/src/features/terminal/gitmdCodeReferences';
import { parseGitmdCodeTable } from '../../apps/desktop/src/features/terminal/gitmdCodeMarkdown';

describe('GitMD Code terminal output', () => {
  it('filters product names split across chunks', () => {
    let carry = '';
    let output = '';
    for (const chunk of ['Clau', 'de Code by Anth', 'ropic uses clau', 'de']) {
      const filtered = filterGitmdCodeOutput(carry, chunk);
      output += filtered.output;
      carry = filtered.carry;
    }
    const flushed = filterGitmdCodeOutput(carry, '', true);

    expect(output + flushed.output).toBe('GitMD Code by GitMD AI uses gitmd');
  });

  it('recognizes errors split across chunks', () => {
    const first = updateRuntimeErrorHint('', 'connection ref');
    const second = updateRuntimeErrorHint(first.carry, 'used by gateway');

    expect(first.hint).toBeNull();
    expect(second.hint).toBe('接口地址无法访问');
  });
});

describe('GitMD Code output references', () => {
  const files = new Set(['src/app/App.tsx', 'README.md', 'docs/guide with spaces.md']);

  it('recognizes repository files with line and column locations', () => {
    expect(classifyGitmdCodeReference('src/app/App.tsx:42:7', 'C:\\work\\repo', files)).toEqual({
      kind: 'file',
      path: 'src/app/App.tsx',
      line: 42,
      column: 7,
    });
    expect(
      classifyGitmdCodeReference('C:\\work\\repo\\README.md:12', 'C:\\work\\repo', files),
    ).toEqual({ kind: 'file', path: 'README.md', line: 12, column: undefined });
  });

  it('only treats known repository paths as files', () => {
    expect(classifyGitmdCodeReference('src/app/Missing.tsx', '/work/repo', files)).toBeNull();
    expect(classifyGitmdCodeReference('src/app/App.tsx', '/work/repo', files)).toEqual({
      kind: 'file',
      path: 'src/app/App.tsx',
      line: undefined,
      column: undefined,
    });
  });

  it('recognizes commit hashes and URLs', () => {
    expect(classifyGitmdCodeReference('a1b2c3d', '/work/repo', files)).toEqual({
      kind: 'commit',
      value: 'a1b2c3d',
    });
    expect(classifyGitmdCodeReference('https://example.com/pr/12', '/work/repo', files)).toEqual({
      kind: 'url',
      value: 'https://example.com/pr/12',
    });
  });

  it('finds interactive references in plain output without losing text', () => {
    const parts = parseGitmdCodeOutputParts(
      'Open src/app/App.tsx:8 from a1b2c3d.',
      '/work/repo',
      files,
    );
    expect(parts.map((part) => part.text).join('')).toBe(
      'Open src/app/App.tsx:8 from a1b2c3d.',
    );
    expect(parts.filter((part) => part.reference).map((part) => part.reference?.kind)).toEqual([
      'file',
      'commit',
    ]);
  });

  it('finds known root-level files in plain output', () => {
    const parts = parseGitmdCodeOutputParts('See README.md for details.', '/work/repo', files);
    expect(parts.find((part) => part.reference)?.reference).toEqual({
      kind: 'file',
      path: 'README.md',
      line: undefined,
      column: undefined,
    });
  });
});

describe('GitMD Code Markdown tables', () => {
  it('parses GFM tables with alignment and returns the next unconsumed line', () => {
    expect(parseGitmdCodeTable([
      '| 项 | 内容 |',
      '|:---|---:|',
      '| 状态 | 修改 |',
      '',
      '后续说明',
    ], 0)).toEqual({
      header: ['项', '内容'],
      alignments: ['left', 'right'],
      rows: [['状态', '修改']],
      nextLine: 3,
    });
  });

  it('does not interpret a pipe line without a separator as a table', () => {
    expect(parseGitmdCodeTable(['| 普通文本 |', '下一行'], 0)).toBeNull();
  });
});
