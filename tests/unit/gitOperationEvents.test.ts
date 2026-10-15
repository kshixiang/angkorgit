import { describe, expect, it } from 'vitest';
import {
  clearObservedGitOperations,
  getObservedGitOperations,
  observeGitOperation,
  subscribeObservedGitOperations,
} from '../../apps/desktop/src/core/gitOperationEvents';

describe('observed Git operation events', () => {
  it('publishes start and completion without changing the operation result', async () => {
    const repoPath = '/repo/success';
    clearObservedGitOperations(repoPath);
    const updates: string[] = [];
    const unsubscribe = subscribeObservedGitOperations((path, operations) => {
      if (path === repoPath) updates.push(operations.at(-1)?.status ?? 'cleared');
    });

    const result = await observeGitOperation(
      repoPath,
      'pull',
      'Pull origin (merge)',
      async () => ({ message: 'Already up to date' }),
      (value) => value.message,
    );

    unsubscribe();
    expect(result.message).toBe('Already up to date');
    expect(updates).toEqual(['running', 'succeeded']);
    expect(getObservedGitOperations(repoPath)).toMatchObject([
      { kind: 'pull', status: 'succeeded', summary: 'Pull origin (merge)', result: 'Already up to date', error: null },
    ]);
  });

  it('records a bounded failure message and rethrows the original error', async () => {
    const repoPath = '/repo/failure';
    clearObservedGitOperations(repoPath);
    const error = new Error('remote https://user:secret@example.com/repo.git rejected the request');

    await expect(observeGitOperation(
      repoPath,
      'push',
      'Push main to origin',
      async () => { throw error; },
      () => '',
    )).rejects.toBe(error);

    const [operation] = getObservedGitOperations(repoPath);
    expect(operation.status).toBe('failed');
    expect(operation.error).toContain('https://[redacted]@example.com');
    expect(operation.error).not.toContain('secret');
    expect(operation.finishedAt).not.toBeNull();
  });
});
