export type GitOperationKind =
  | 'pull'
  | 'fetch'
  | 'push'
  | 'merge'
  | 'rebase'
  | 'cherry-pick'
  | 'stash'
  | 'reset'
  | 'checkout';

export interface GitOperationRule {
  operation: GitOperationKind;
  choice: string;
}

export interface GitOperationOption {
  value: string;
  label: string;
  description: string;
  recommended?: boolean;
}

const OPERATIONS: GitOperationKind[] = [
  'pull',
  'fetch',
  'push',
  'merge',
  'rebase',
  'cherry-pick',
  'stash',
  'reset',
  'checkout',
];

const OPTION_MAP: Record<GitOperationKind, GitOperationOption[]> = {
  pull: [
    { value: 'repository', label: '遵循仓库配置', description: '使用仓库的 pull.rebase 设置。', recommended: true },
    { value: 'merge', label: '始终使用 Merge', description: '保留分叉历史，必要时创建 merge commit。' },
    { value: 'rebase', label: '始终使用 Rebase', description: '将本地提交变基到远端最新提交上。' },
    { value: 'ask', label: '每次询问', description: '每次 Pull 都让我选择。' },
  ],
  fetch: [
    { value: 'plain', label: '只 Fetch', description: '只更新远端跟踪分支。', recommended: true },
    { value: 'prune', label: 'Fetch 并清理远端分支', description: '同时清理远端已删除的跟踪分支。' },
    { value: 'tags-prune', label: 'Fetch Tags 并清理', description: '获取 Tags，并清理远端已删除的跟踪分支。' },
    { value: 'ask', label: '每次询问', description: '每次 Fetch 都让我选择。' },
  ],
  push: [
    { value: 'safe', label: '普通 Push', description: '拒绝非快进，不改写远端历史。', recommended: true },
    { value: 'upstream', label: '首次 Push 时设置 Upstream', description: '首次推送当前分支时建立远端跟踪关系。' },
    { value: 'ask', label: '每次询问', description: '每次 Push 都让我选择。' },
  ],
  merge: [
    { value: 'fast-forward', label: '允许快进，否则创建 Merge Commit', description: '保留 Git 的默认合并行为。', recommended: true },
    { value: 'no-ff', label: '始终创建 Merge Commit', description: '即使可以快进也保留一次合并节点。' },
    { value: 'ask', label: '每次询问', description: '每次 Merge 都让我选择。' },
  ],
  rebase: [
    { value: 'continue-safe', label: '冲突时暂停', description: '遇到冲突只暂停并交给我处理。', recommended: true },
    { value: 'ask', label: '每次询问', description: '每次 Rebase 都先让我确认。' },
  ],
  'cherry-pick': [
    { value: 'record-origin', label: '记录来源提交', description: '追加 cherry-pick -x 来源标记。', recommended: true },
    { value: 'plain', label: '不记录来源', description: '只应用提交内容。' },
    { value: 'ask', label: '每次询问', description: '每次 Cherry-pick 都让我选择。' },
  ],
  stash: [
    { value: 'apply-first', label: '优先 Apply', description: '恢复修改但保留 Stash，确认后再删除。', recommended: true },
    { value: 'pop', label: '直接 Pop', description: '恢复修改并删除对应 Stash。' },
    { value: 'ask', label: '每次询问', description: '每次 Stash 操作都让我选择。' },
  ],
  reset: [
    { value: 'revert-first', label: '优先 Revert', description: '用新提交撤销改动，保留共享历史。', recommended: true },
    { value: 'soft', label: 'Reset Soft', description: '移动 HEAD，保留暂存区和工作区。' },
    { value: 'mixed', label: 'Reset Mixed', description: '移动 HEAD，保留工作区但取消暂存。' },
    { value: 'ask', label: '每次询问', description: '每次 Reset 都让我确认。' },
  ],
  checkout: [
    { value: 'safe-switch', label: '只安全切换', description: '有未提交修改会暂停，不自动 Stash。', recommended: true },
    { value: 'ask', label: '每次询问', description: '每次切换分支都让我确认。' },
  ],
};

export function gitOperationOptions(operation: GitOperationKind): GitOperationOption[] {
  return OPTION_MAP[operation];
}

export function detectGitOperation(input: string): GitOperationKind | null {
  const value = input.toLocaleLowerCase();
  const patterns: Array<[GitOperationKind, RegExp]> = [
    ['cherry-pick', /cherry[ -]?pick|拣选|挑选提交/],
    ['checkout', /checkout|switch branch|切换分支|切换到分支/],
    ['rebase', /rebase|变基/],
    ['merge', /merge|合并/],
    ['pull', /\bpull\b|拉取|拉最新|同步远端/],
    ['fetch', /\bfetch\b|抓取远端|获取远端/],
    ['push', /\bpush\b|推送/],
    ['stash', /\bstash\b|暂存修改|保存修改/],
    ['reset', /\breset\b|重置提交|重置分支/],
  ];
  return patterns.find(([, pattern]) => pattern.test(value))?.[0] ?? null;
}

export function parseGitOperationRules(content: string): Map<GitOperationKind, GitOperationRule> {
  const rules = new Map<GitOperationKind, GitOperationRule>();
  const sectionPattern = /^##\s+([a-z-]+)\s*\r?\n([\s\S]*?)(?=^##\s+|(?![\s\S]))/gim;
  let match: RegExpExecArray | null;
  while ((match = sectionPattern.exec(content)) !== null) {
    const operation = match[1].toLocaleLowerCase() as GitOperationKind;
    if (!OPERATIONS.includes(operation)) continue;
    const choice = match[2].match(/^[-*]\s+(?:default|choice|策略)\s*:\s*([^\s#]+)/im)?.[1];
    if (choice) rules.set(operation, { operation, choice });
  }
  return rules;
}

export function serializeGitOperationRules(rules: Map<GitOperationKind, GitOperationRule>): string {
  const sections = [...rules.values()]
    .sort((a, b) => OPERATIONS.indexOf(a.operation) - OPERATIONS.indexOf(b.operation))
    .map((rule) => `## ${rule.operation}\n- default: ${rule.choice}\n`)
    .join('\n');
  return `# GitMD Code Git Operation Rules\n\n<!-- Managed by GitMD Code. You can edit these rules directly. -->\n<!-- Safety protections for destructive operations cannot be disabled here. -->\n\n${sections}`;
}

export function upsertGitOperationRule(
  rules: Map<GitOperationKind, GitOperationRule>,
  operation: GitOperationKind,
  choice: string,
): Map<GitOperationKind, GitOperationRule> {
  const next = new Map(rules);
  next.set(operation, { operation, choice });
  return next;
}
