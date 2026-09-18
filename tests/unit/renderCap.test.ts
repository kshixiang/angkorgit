import { describe, expect, it } from 'vitest';
import { MAX_RENDERED_LINE, clipRenderedLine } from '@angkorgit/core';

describe('clipRenderedLine', () => {
  it('leaves ordinary lines untouched', () => {
    expect(clipRenderedLine('SELECT 1;')).toEqual({ text: 'SELECT 1;', hidden: 0 });
  });

  it('keeps a line exactly at the cap whole', () => {
    const line = 'x'.repeat(MAX_RENDERED_LINE);
    expect(clipRenderedLine(line)).toEqual({ text: line, hidden: 0 });
  });

  it('clips a minified line to the cap and counts what it dropped', () => {
    const line = 'a'.repeat(MAX_RENDERED_LINE) + 'b'.repeat(337);
    const clipped = clipRenderedLine(line);
    expect(clipped.text).toHaveLength(MAX_RENDERED_LINE);
    expect(clipped.text.endsWith('a')).toBe(true);
    expect(clipped.hidden).toBe(337);
  });

  it('honours a custom cap', () => {
    expect(clipRenderedLine('abcdef', 4)).toEqual({ text: 'abcd', hidden: 2 });
  });
});
