export type CommitStylePreset = 'conventional' | 'plain' | 'custom';

export type AiResponseStyle = 'concise' | 'balanced' | 'detailed';

export const DEFAULT_AI_RESPONSE_STYLE: AiResponseStyle = 'balanced';

export const AI_RESPONSE_STYLE_PRESETS: Record<AiResponseStyle, { label: string; description: string }> = {
  concise: {
    label: 'Concise',
    description: 'Lead with the answer. Use only the key facts and next step.',
  },
  balanced: {
    label: 'Balanced',
    description: 'Give the answer with the necessary context, evidence and next step.',
  },
  detailed: {
    label: 'Detailed',
    description: 'Include background, reasoning, steps, trade-offs and risks when useful.',
  },
};

export function aiResponseStyleInstruction(style: AiResponseStyle = DEFAULT_AI_RESPONSE_STYLE): string {
  switch (style) {
    case 'concise':
      return 'Prefer concise answers: lead with the conclusion, use at most 3 short bullets when useful, and omit background that does not change the next action.';
    case 'detailed':
      return 'Prefer detailed answers: include relevant context, reasoning, implementation steps, trade-offs, and risks, while staying focused on the repository task.';
    default:
      return 'Prefer balanced answers: give the conclusion first, then the key evidence and next action. Add context only when it helps the user decide or act.';
  }
}

export interface CommitPrefixRule {
  pattern: string;
  prefix: string;
}

export interface CommitStyle {
  preset: CommitStylePreset;
  instructions: string;
  prefixRules: CommitPrefixRule[];
}

export interface ReviewStyle {
  instructions: string;
}

export interface AiStyleConfig {
  commit: CommitStyle;
  review: ReviewStyle;
  responseStyle: AiResponseStyle;
}

export const DEFAULT_COMMIT_STYLE: CommitStyle = {
  preset: 'conventional',
  instructions: '',
  prefixRules: [],
};

export const DEFAULT_REVIEW_STYLE: ReviewStyle = {
  instructions: '',
};

export const DEFAULT_AI_STYLE: AiStyleConfig = {
  commit: DEFAULT_COMMIT_STYLE,
  review: DEFAULT_REVIEW_STYLE,
  responseStyle: DEFAULT_AI_RESPONSE_STYLE,
};

export const PROJECT_REVIEW_FILE = '.gitmd/review.md';
export const LEGACY_PROJECT_REVIEW_FILE = '.angkorgit/review.md';

export const COMMIT_STYLE_PRESETS: Record<CommitStylePreset, { label: string; description: string }> = {
  conventional: {
    label: 'Conventional commits',
    description: 'type(scope): summary — feat, fix, refactor…',
  },
  plain: {
    label: 'Plain summary',
    description: 'Imperative one-liner, no type prefix',
  },
  custom: {
    label: 'Custom instructions',
    description: 'Describe your team convention in your own words',
  },
};

const TICKET_PATTERN = /[A-Za-z][A-Za-z0-9]+-\d+/;

function branchMatches(pattern: string, branch: string): boolean {
  const escaped = pattern
    .trim()
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(branch);
}

function expandPrefixTokens(prefix: string, branch: string): string | null {
  const suffix = branch.includes('/') ? branch.slice(branch.lastIndexOf('/') + 1) : branch;
  const ticket = branch.match(TICKET_PATTERN)?.[0] ?? null;
  if (prefix.includes('{ticket}') && !ticket) return null;
  return prefix
    .replace(/\{branch\}/g, () => branch)
    .replace(/\{suffix\}/g, () => suffix)
    .replace(/\{ticket\}/g, () => ticket ?? '');
}

export function resolveCommitPrefix(rules: CommitPrefixRule[], branch: string | null): string | null {
  if (!branch) return null;
  for (const rule of rules) {
    const pattern = rule.pattern.trim();
    const prefix = rule.prefix.trim();
    if (!pattern || !prefix) continue;
    if (!branchMatches(pattern, branch)) continue;
    const expanded = expandPrefixTokens(prefix, branch);
    if (expanded !== null) return expanded;
  }
  return null;
}

export function ensureCommitPrefix(message: string, prefix: string): string {
  const trimmed = message.trimStart();
  if (trimmed.startsWith(prefix)) return message;
  return `${prefix} ${trimmed}`;
}

const CONVENTIONAL_INSTRUCTIONS =
  'Write a conventional-commit style message. First line: type(scope): summary under 72 chars.';
const PLAIN_INSTRUCTIONS =
  'Write a plain commit message. First line: an imperative summary under 72 chars with no type prefix.';

export function commitStyleInstructions(style: CommitStyle, prefix: string | null): string {
  const base =
    style.preset === 'custom' && style.instructions.trim()
      ? style.instructions.trim()
      : style.preset === 'plain'
        ? PLAIN_INSTRUCTIONS
        : CONVENTIONAL_INSTRUCTIONS;
  const prefixLine = prefix
    ? ` Start the first line with exactly "${prefix} " and add no other type prefix.`
    : '';
  return `${base}${prefixLine} Then a blank line and a short body only if the change needs explanation. Output the message only, no fencing.`;
}
