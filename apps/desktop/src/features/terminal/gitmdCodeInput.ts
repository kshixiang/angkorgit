export interface GitmdCodeSlashCommand {
  name: string;
  description: string;
  prompt?: string;
  local?: 'help' | 'clear';
}

export const GITMD_CODE_SLASH_COMMANDS: GitmdCodeSlashCommand[] = [
  { name: '/help', description: 'Show GitMD Code commands', local: 'help' },
  { name: '/clear', description: 'Start a fresh conversation', local: 'clear' },
  { name: '/status', description: 'Inspect the current worktree', prompt: 'Show the current repository status and summarize any staged, unstaged, or untracked changes.' },
  { name: '/review', description: 'Review the current worktree', prompt: 'Review the current worktree for bugs, regressions, and missing tests. Do not modify files.' },
  { name: '/diff', description: 'Explain the current diff', prompt: 'Inspect the current diff and explain the important changes and risks. Do not modify files.' },
  { name: '/model', description: 'Open GitMD Code model settings' },
  { name: '/memory', description: 'View or manage persistent memory' },
];

export function slashCommandSuggestions(value: string): GitmdCodeSlashCommand[] {
  if (!value.startsWith('/')) return [];
  const query = value.split(/\s/, 1)[0].toLowerCase();
  return GITMD_CODE_SLASH_COMMANDS.filter((command) => command.name.startsWith(query));
}

export function normalizeSlashCommand(value: string): GitmdCodeSlashCommand | null {
  const command = value.trim().split(/\s/, 1)[0].toLowerCase();
  return GITMD_CODE_SLASH_COMMANDS.find((item) => item.name === command) ?? null;
}

export function shellCommandFromInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith('!')) return null;
  const command = trimmed.slice(1).trim();
  return command || null;
}

export function memoryNoteFromInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith('#')) return null;
  const note = trimmed.slice(1).trim();
  return note || null;
}

export type PersistentMemoryScope = 'repository' | 'user';

export function persistentMemoryFromInput(
  value: string,
): { scope: PersistentMemoryScope; content: string } | null {
  const match = value.trim().match(/^#\s*remember(?:\s+(global|user|repo|repository))?\s*:\s*(.+)$/is);
  if (!match?.[2]?.trim()) return null;
  const scope = match[1]?.toLowerCase();
  return {
    scope: scope === 'global' || scope === 'user' ? 'user' : 'repository',
    content: match[2].replace(/\s+/g, ' ').trim(),
  };
}


export type GitmdChangeMode = 'readonly' | 'once' | 'keep';

export const READ_ONLY_CHANGE_MARKER = 'GITMD_CODE_READ_ONLY';

const CHANGE_INTENT = /(?:修改|改一下|改下|改成|改掉|修复|修正|修一下|实现|重构|提交|暂存|取消暂存|推送|拉取|合并|变基|重置|切换分支|删除文件|删掉|写入|创建文件|新建文件|解决冲突|丢弃|撤销|加上|替换成|amend\b|stage\b|unstage\b|\bcommit\b|\bpush\b|\bpull\b|\bmerge\b|\brebase\b|\breset\b|\bcheckout\b|\bstash\b|\bfix\b|\bchange\b|\bedit\b|\bupdate\b|\bimplement\b|\brefactor\b|\bwrite\b|\bapply\b|\bdelete\b|\badd\b)/i;
const READ_ONLY_REQUEST = /(?:不要修改|不要改|别改|do not (?:modify|change|edit)|don't (?:modify|change|edit)|read-only|只分析|仅分析|只解释|只是看看|just (?:explain|review|look))/i;
const QUESTION_START = /^(?:请)?(?:解释|说明|分析|总结|看看|查看|为什么|为何|怎么|如何|what|why|how|explain|describe|summarize|review|inspect|show|compare)\b/i;
const LOOK_ONLY = /(?:看看|查看|解释|说明|分析|总结|为什么|为何|怎么|如何|\bwhat\b|\bwhy\b|\bhow\b|\bexplain\b|\bdescribe\b|\bshow\b|\breview\b|\binspect\b)/i;
const DIRECT_CHANGE = /(?:修改|改一下|改下|改成|改掉|修复|修正|修一下|实现|重构|提交|写入|创建文件|新建文件|删除文件|删掉|解决冲突|丢弃|撤销|替换成|\bfix\b|\bchange\b|\bedit\b|\bimplement\b|\brefactor\b|\bwrite\b|\bdelete\b)/i;
const FOLLOW_UP_CHANGE = /(?:然后|并且|并|and then|also)\s*(?:修改|修复|修一下|提交|fix|change|edit|commit|implement)/i;

export function inputNeedsRepositoryChanges(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('!') || trimmed.startsWith('#') || trimmed.startsWith('/')) return false;
  if (READ_ONLY_REQUEST.test(trimmed) || !CHANGE_INTENT.test(trimmed)) return false;
  if (LOOK_ONLY.test(trimmed) && !FOLLOW_UP_CHANGE.test(trimmed) && !DIRECT_CHANGE.test(trimmed)) return false;
  if (QUESTION_START.test(trimmed) && !FOLLOW_UP_CHANGE.test(trimmed)) return false;
  if (/[?？]\s*$/.test(trimmed) && !/(?:帮我|请把|请帮|请修改|请修复|please\s+(?:fix|change|edit|update|commit|implement)|(?:fix|change|edit|update|commit|implement)\s+(?:this|the|it))/i.test(trimmed)) {
    return false;
  }
  return true;
}

export function shouldAskToSwitchChangeMode(
  value: string,
  mode: GitmdChangeMode,
  explicitMode: GitmdChangeMode | null,
): boolean {
  if (explicitMode !== null || mode !== 'readonly') return false;
  return inputNeedsRepositoryChanges(value);
}

export function cycleGitmdChangeMode(mode: GitmdChangeMode): GitmdChangeMode {
  if (mode === 'readonly') return 'once';
  if (mode === 'once') return 'keep';
  return 'readonly';
}

export function gitmdChangeModeAfterTurn(mode: GitmdChangeMode): GitmdChangeMode {
  return mode === 'once' ? 'readonly' : mode;
}

export function isReadOnlyChangeBlocked(message: string): boolean {
  return message.includes(READ_ONLY_CHANGE_MARKER);
}

export function withoutReadOnlyChangeMarker(message: string): string {
  return message.replaceAll(READ_ONLY_CHANGE_MARKER, '').replace(/\s{2,}/g, ' ').trim();
}
