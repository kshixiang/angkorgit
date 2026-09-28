import { describe, expect, it } from 'vitest';
import { sumGitmdAgentUsage } from '../../apps/desktop/src/features/terminal/gitmdCodeUsage';

describe('sumGitmdAgentUsage', () => {
  it('returns null when no message includes usage', () => {
    expect(sumGitmdAgentUsage([
      { role: 'user', content: 'status', createdAt: 1 },
      { role: 'assistant', content: 'ok', createdAt: 2 },
    ])).toBeNull();
  });

  it('adds usage from assistant replies and ignores other messages', () => {
    expect(sumGitmdAgentUsage([
      { role: 'user', content: 'status', createdAt: 1, usage: { inputTokens: 100, outputTokens: 10, totalTokens: 110 } },
      { role: 'assistant', content: 'first', createdAt: 2, usage: { inputTokens: 200, outputTokens: 20, totalTokens: 220 } },
      { role: 'assistant', content: 'second', createdAt: 3, usage: { inputTokens: 300, outputTokens: 30, totalTokens: 330 } },
    ])).toEqual({ inputTokens: 500, outputTokens: 50, totalTokens: 550 });
  });

  it('does not infer usage when providers report only zero values', () => {
    expect(sumGitmdAgentUsage([
      { role: 'assistant', content: 'provider did not report usage', createdAt: 1, usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } },
    ])).toBeNull();
  });
});
