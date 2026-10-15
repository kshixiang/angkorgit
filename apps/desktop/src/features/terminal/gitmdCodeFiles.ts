export interface GitmdCodeFileRef {
  path: string;
  staged: boolean;
  oid?: string;
  oldPath?: string | null;
}

export const MAX_GITMD_CODE_FILES = 12;

export function normalizedGitmdCodeFile(file: GitmdCodeFileRef): GitmdCodeFileRef | null {
  const path = file.path.trim();
  if (!path) return null;
  const oid = file.oid?.trim();
  if (oid) {
    const oldPath = file.oldPath?.trim();
    return oldPath ? { path, staged: false, oid, oldPath } : { path, staged: false, oid };
  }
  return { path, staged: file.staged === true };
}

export function gitmdCodeFileKey(file: GitmdCodeFileRef): string {
  if (file.oid) return `commit:${file.oid}:${file.path}`;
  return `${file.staged ? 'staged' : 'unstaged'}:${file.path}`;
}

export function gitmdCodeFileName(path: string): string {
  const name = path.split(/[\\/]/).filter(Boolean).pop();
  return name || path;
}

export function mergeGitmdCodeFiles(
  current: readonly GitmdCodeFileRef[],
  incoming: readonly GitmdCodeFileRef[],
): GitmdCodeFileRef[] {
  const seen = new Set<string>();
  const next: GitmdCodeFileRef[] = [];
  for (const file of [...current, ...incoming]) {
    const normalized = normalizedGitmdCodeFile(file);
    if (!normalized) continue;
    const key = gitmdCodeFileKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(normalized);
    if (next.length >= MAX_GITMD_CODE_FILES) break;
  }
  return next;
}

function attachedFileLine(file: GitmdCodeFileRef): string {
  if (file.oid) return `- ${file.path} (commit ${file.oid})`;
  if (file.staged) return `- ${file.path} (staged)`;
  return `- ${file.path}`;
}

export function attachedFilesPrompt(files: readonly GitmdCodeFileRef[], question: string): string {
  const trimmed = question.trim();
  if (files.length === 0) return trimmed;
  const association = ['Attached files:', ...files.map(attachedFileLine)].join('\n');
  return trimmed ? `${association}\n\n${trimmed}` : association;
}

export function normalizeGitmdCodeFiles(value: {
  files?: readonly GitmdCodeFileRef[] | null;
  path?: string | null;
  staged?: boolean | null;
} | null): GitmdCodeFileRef[] {
  if (!value) return [];
  if (value.files && value.files.length > 0) return mergeGitmdCodeFiles([], value.files);
  if (value.path?.trim()) return [{ path: value.path.trim(), staged: value.staged === true }];
  return [];
}
