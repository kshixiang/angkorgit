import { describe, expect, it } from 'vitest';
import {
  detectGitOperation,
  parseGitOperationRules,
  serializeGitOperationRules,
  upsertGitOperationRule,
} from '../../apps/desktop/src/features/terminal/gitOperationRules';

describe('git operation rules', () => {
  it('detects common English and Chinese operation requests', () => {
    expect(detectGitOperation('pull the latest changes')).toBe('pull');
    expect(detectGitOperation('把当前分支变基到 main')).toBe('rebase');
    expect(detectGitOperation('推送当前分支')).toBe('push');
  });

  it('round trips remembered choices in the editable markdown format', () => {
    const rules = upsertGitOperationRule(new Map(), 'pull', 'rebase');
    const parsed = parseGitOperationRules(serializeGitOperationRules(rules));
    expect(parsed.get('pull')).toEqual({ operation: 'pull', choice: 'rebase' });
  });
});
