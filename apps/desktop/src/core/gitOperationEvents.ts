export type ObservedGitOperationKind = 'fetch' | 'pull' | 'push';
export type ObservedGitOperationStatus = 'running' | 'succeeded' | 'failed';

export interface ObservedGitOperation {
  id: string;
  repoPath: string;
  kind: ObservedGitOperationKind;
  status: ObservedGitOperationStatus;
  summary: string;
  result: string | null;
  startedAt: number;
  finishedAt: number | null;
  error: string | null;
}

const MAX_OPERATIONS_PER_REPOSITORY = 12;
const operationsByRepository = new Map<string, ObservedGitOperation[]>();
const listeners = new Set<(repoPath: string, operations: ObservedGitOperation[]) => void>();

function publish(repoPath: string, operation: ObservedGitOperation): void {
  const current = operationsByRepository.get(repoPath) ?? [];
  const next = current.some((item) => item.id === operation.id)
    ? current.map((item) => item.id === operation.id ? operation : item)
    : [...current, operation].slice(-MAX_OPERATIONS_PER_REPOSITORY);
  operationsByRepository.set(repoPath, next);
  for (const listener of listeners) {
    try {
      listener(repoPath, next);
    } catch {
      continue;
    }
  }
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/(https?:\/\/)[^\s/@]+@/gi, '$1[redacted]@')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 1200);
}

function safeSummary(summary: string): string {
  return summary
    .replace(/(https?:\/\/)[^\s/@]+@/gi, '$1[redacted]@')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, 1200);
}

export function getObservedGitOperations(repoPath: string): ObservedGitOperation[] {
  return operationsByRepository.get(repoPath) ?? [];
}

export function clearObservedGitOperations(repoPath: string): void {
  operationsByRepository.delete(repoPath);
  for (const listener of listeners) {
    try {
      listener(repoPath, []);
    } catch {
      continue;
    }
  }
}

export function subscribeObservedGitOperations(
  listener: (repoPath: string, operations: ObservedGitOperation[]) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function observeGitOperation<T>(
  repoPath: string,
  kind: ObservedGitOperationKind,
  summary: string,
  run: () => Promise<T>,
  resultSummary: (result: T) => string,
): Promise<T> {
  const operation: ObservedGitOperation = {
    id: crypto.randomUUID(),
    repoPath,
    kind,
    status: 'running',
    summary: safeSummary(summary),
    result: null,
    startedAt: Date.now(),
    finishedAt: null,
    error: null,
  };
  publish(repoPath, operation);
  try {
    const result = await run();
    publish(repoPath, {
      ...operation,
      status: 'succeeded',
      result: safeSummary(resultSummary(result) || summary),
      finishedAt: Date.now(),
    });
    return result;
  } catch (error) {
    publish(repoPath, {
      ...operation,
      status: 'failed',
      finishedAt: Date.now(),
      error: safeError(error),
    });
    throw error;
  }
}
