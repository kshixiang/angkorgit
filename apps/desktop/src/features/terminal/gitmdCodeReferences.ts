export type GitmdCodeReference =
  | { kind: 'commit'; value: string }
  | { kind: 'file'; path: string; line?: number; column?: number }
  | { kind: 'url'; value: string };

export interface GitmdCodeOutputPart {
  text: string;
  reference?: GitmdCodeReference;
}

const COMMIT_PATTERN = /^[0-9a-f]{7,40}$/i;
const URL_PATTERN = /^https?:\/\/[^\s]+$/i;
const OUTPUT_TOKEN_PATTERN = /https?:\/\/[^\s<>()]+|(?:\.?\.?[\\/])?(?:[\w@.+()-]+[\\/])+[\w@.+() -]+(?::\d+(?::\d+)?)?|[\w@+()-]+\.[\w.-]+(?::\d+(?::\d+)?)?|\b[0-9a-f]{7,40}\b/gi;

function normalizePath(value: string): string {
  return value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '');
}

function fileCandidates(value: string): Array<{ path: string; line?: number; column?: number }> {
  const normalized = normalizePath(value);
  const lineAndColumn = normalized.match(/^(.*):(\d+):(\d+)$/);
  if (lineAndColumn) {
    return [
      {
        path: lineAndColumn[1],
        line: Number(lineAndColumn[2]),
        column: Number(lineAndColumn[3]),
      },
      { path: normalized },
    ];
  }
  const line = normalized.match(/^(.*):(\d+)$/);
  if (!line) return [{ path: normalized }];
  return [
    {
      path: line[1],
      line: Number(line[2]),
    },
    { path: normalized },
  ];
}

function repositoryRelativePath(path: string, repoPath: string): string {
  const normalizedPath = normalizePath(path);
  const normalizedRepo = normalizePath(repoPath);
  if (normalizedPath.toLowerCase().startsWith(`${normalizedRepo.toLowerCase()}/`)) {
    return normalizedPath.slice(normalizedRepo.length + 1);
  }
  return normalizedPath;
}

export function classifyGitmdCodeReference(
  value: string,
  repoPath: string,
  knownFiles: ReadonlySet<string>,
): GitmdCodeReference | null {
  const trimmed = value.trim();
  if (COMMIT_PATTERN.test(trimmed)) return { kind: 'commit', value: trimmed };
  if (URL_PATTERN.test(trimmed)) return { kind: 'url', value: trimmed };

  const filesByNormalizedPath = new Map(
    [...knownFiles].map((path) => [normalizePath(path).toLowerCase(), path]),
  );
  for (const candidate of fileCandidates(trimmed)) {
    const relative = repositoryRelativePath(candidate.path, repoPath);
    const knownPath = filesByNormalizedPath.get(relative.toLowerCase());
    if (knownPath) {
      return {
        kind: 'file',
        path: knownPath,
        line: candidate.line,
        column: candidate.column,
      };
    }
  }
  return null;
}

export function parseGitmdCodeOutputParts(
  text: string,
  repoPath: string,
  knownFiles: ReadonlySet<string>,
): GitmdCodeOutputPart[] {
  const parts: GitmdCodeOutputPart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(OUTPUT_TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ text: text.slice(cursor, index) });
    const token = match[0];
    const reference = classifyGitmdCodeReference(token, repoPath, knownFiles);
    parts.push(reference ? { text: token, reference } : { text: token });
    cursor = index + token.length;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}
