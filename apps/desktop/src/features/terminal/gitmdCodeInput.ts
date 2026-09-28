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
