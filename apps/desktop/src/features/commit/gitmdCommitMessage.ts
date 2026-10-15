import {
  commitStyleInstructions,
  ensureCommitPrefix,
  resolveCommitPrefix,
  type CommitStyle,
} from '@gitmd/core';

export function buildGitmdCommitMessagePrompt(input: {
  style: CommitStyle;
  branch: string | null;
  language: 'english' | 'chinese';
  stagedCount: number;
}): string {
  const prefix = resolveCommitPrefix(input.style.prefixRules, input.branch);
  const language =
    input.language === 'chinese'
      ? ' Write the commit message in Simplified Chinese.'
      : ' Write the commit message in English.';
  const coverage =
    input.stagedCount > 12
      ? `There are ${input.stagedCount} staged files. The attached context includes only the first 12, so inspect the remaining staged diff before answering.`
      : 'Inspect the staged diff before answering.';
  return [
    'Draft a commit message for the currently staged changes.',
    `${coverage} Do not modify files, stage anything else, or create a commit.`,
    `${commitStyleInstructions(input.style, prefix)}${language}`,
  ].join('\n\n');
}

export function commitMessageFromGitmdCode(content: string, prefix: string | null): string {
  let text = content.replace(/\r\n/g, '\n').trim();
  const fenced = text.match(/```[a-z]*\n([\s\S]*?)```/i);
  if (fenced?.[1]?.trim()) text = fenced[1].trim();
  else text = text.replace(/^```[a-z]*\n?|```$/g, '').trim();
  if (!text) return '';
  return prefix ? ensureCommitPrefix(text, prefix) : text;
}
