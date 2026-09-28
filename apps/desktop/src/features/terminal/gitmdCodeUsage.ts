import type { GitmdAgentMessage, GitmdAgentUsage } from '@/core/ipc';

export function sumGitmdAgentUsage(messages: readonly GitmdAgentMessage[]): GitmdAgentUsage | null {
  const usage = messages.reduce<GitmdAgentUsage>((total, message) => {
    if (message.role !== 'assistant' || !message.usage) return total;
    return {
      inputTokens: total.inputTokens + message.usage.inputTokens,
      outputTokens: total.outputTokens + message.usage.outputTokens,
      totalTokens: total.totalTokens + message.usage.totalTokens,
    };
  }, { inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  return usage.totalTokens > 0 || usage.inputTokens > 0 || usage.outputTokens > 0 ? usage : null;
}
