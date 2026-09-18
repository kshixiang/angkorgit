import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Check, GitBranch, GitPullRequest, Pencil, RefreshCw, Sparkles, ZoomIn } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Hint,
  cn,
} from '@angkorgit/design-system';
import { appVersion, openExternal } from '@/core/ipc';
import { useForge } from '@/features/forge/store';
import { useRepo } from '@/features/repository/store';
import { useSettings } from '@/features/settings/store';
import { useUi } from '@/features/ui/store';
import { capCount, currentPullRequestUrl, timeAgo } from '@/shared/utils';
import { forgeNoun, pickForgeRemote } from '@angkorgit/core';
import { useUiText } from '@/shared/i18n';
import { AI_PROVIDER_PRESETS, CLI_AGENTS } from '@angkorgit/core';

const ZOOM_LEVELS = [50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200];

export function StatusBar() {
  const repo = useRepo((s) => s.repo);
  const status = useRepo((s) => s.status);
  const remotes = useRepo((s) => s.remotes);
  const lastFetchAt = useRepo((s) => s.lastFetchAt);
  const autoFetchMinutes = useSettings((s) => s.autoFetchMinutes);
  const [, tickClock] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tickClock((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const zoom = useSettings((s) => s.zoom);
  const setZoom = useSettings((s) => s.setZoom);
  const ai = useSettings((s) => s.ai);
  const aiStatus = useSettings((s) => s.aiStatus);
  const aiConfigured =
    ai.provider === 'cli'
      ? !!ai.cliAgent
      : ai.provider === 'ollama' || ai.provider === 'lmstudio'
        ? !!ai.model
        : !!ai.apiKey && !!ai.model;
  const aiName =
    ai.provider === 'cli'
      ? ai.cliAgent
        ? CLI_AGENTS[ai.cliAgent].label
        : ''
      : AI_PROVIDER_PRESETS[ai.provider].label;
  const aiLabel = aiConfigured ? aiName : 'Set up AI';
  const aiHint = !aiConfigured
    ? 'No AI provider is set up yet. Click to choose one in Settings.'
    : aiStatus === 'ok'
      ? `${aiName} answered the last connection test. Click to open the AI settings.`
      : aiStatus === 'fail'
        ? `${aiName} did not answer the last connection test. Click to open the AI settings.`
        : aiStatus === 'stale'
          ? `The AI settings changed since ${aiName} was last tested. Click to open them and run Test connection again.`
          : `${aiName} is set up. Its connection has not been tested yet — click to open the AI settings and run Test connection.`;
  const [version, setVersion] = useState('');
  const t = useUiText();

  useEffect(() => {
    void appVersion().then(setVersion);
  }, []);

  const branches = useRepo((s) => s.branches);
  const changes = status?.files.length ?? 0;
  const branch = repo?.isDetached ? `detached @ ${repo.headOid?.slice(0, 8) ?? '?'}` : repo?.headBranch;
  const headUpstream = branches.find((b) => !b.isRemote && b.isHead)?.upstream ?? null;
  const prUrl = currentPullRequestUrl(repo, pickForgeRemote(remotes, headUpstream)?.url);
  const forgeRepoPath = useForge((s) => s.repoPath);
  const forgeRemote = useForge((s) => s.remote);
  const forgeAccount = useForge((s) => s.hasAccount);
  const openDialog = useUi((s) => s.openDialog);
  const forgeCurrent = forgeRepoPath !== null && forgeRepoPath === repo?.path;
  const createInApp = forgeCurrent && !!forgeRemote && forgeAccount;
  const prNoun = forgeNoun(forgeCurrent ? forgeRemote?.kind : null);

  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-border-subtle bg-surface px-3 text-[11px] text-muted">
      <span className="flex min-w-0 items-center gap-1.5">
        <GitBranch className="size-3 shrink-0" />
        <span className="max-w-56 truncate font-mono">{branch ?? '—'}</span>
      </span>
      {status && (status.ahead > 0 || status.behind > 0) && (
        <span className="flex items-center gap-1.5">
          {status.ahead > 0 && (
            <Hint label={`${status.ahead} commit${status.ahead === 1 ? '' : 's'} to push`}>
              <span className="flex items-center gap-0.5 text-success">
                <ArrowUp className="size-3" />
                {capCount(status.ahead)}
              </span>
            </Hint>
          )}
          {status.behind > 0 && (
            <Hint label={`${status.behind} commit${status.behind === 1 ? '' : 's'} to pull`}>
              <span className="flex items-center gap-0.5 text-info">
                <ArrowDown className="size-3" />
                {capCount(status.behind)}
              </span>
            </Hint>
          )}
        </span>
      )}
      {lastFetchAt !== null && (
        <Hint
          label={`Last fetched at ${new Date(lastFetchAt).toLocaleTimeString()}. ${
            autoFetchMinutes
              ? `Fetches run when you switch to this tab, when the window gets focus and every ${autoFetchMinutes} min.`
              : 'Auto fetch is off in Settings → Git.'
          }`}
        >
          <span className="flex items-center gap-1 text-faint" data-last-fetch>
            <RefreshCw className="size-3" />
            Fetched {timeAgo(lastFetchAt / 1000)}
          </span>
        </Hint>
      )}
      <span className={cn('flex items-center gap-1.5', changes > 0 && 'text-primary')}>
        {changes > 0 ? <Pencil className="size-3" /> : <Check className="size-3 text-success" />}
        {changes > 0 ? `${changes} ${t('Changes').toLowerCase()}` : t('Clean')}
      </span>
      {prUrl && (
        <Hint
          label={
            createInApp
              ? `Create a ${prNoun} for ${repo?.headBranch} without leaving GitMD`
              : `Open a pre-filled pull request page for ${repo?.headBranch}`
          }
        >
          <button
            type="button"
            className="flex items-center gap-1 rounded px-1 hover:bg-surface-raised hover:text-foreground"
            onClick={() =>
              createInApp ? openDialog('createPullRequest') : void openExternal(prUrl)
            }
          >
            <GitPullRequest className="size-3" />
            Create {prNoun}
          </button>
        </Hint>
      )}

      <span className="flex-1" />

      <Hint label={aiHint}>
        <button
          type="button"
          className="flex items-center gap-1 rounded px-1 hover:bg-surface-raised hover:text-foreground"
          aria-label={aiLabel}
          data-ai-status={aiConfigured ? aiStatus : 'unconfigured'}
          onClick={() => openDialog('settings', { section: 'ai' })}
        >
          <Sparkles
            className={cn(
              'size-3',
              aiConfigured && aiStatus === 'ok'
                ? 'text-success'
                : aiConfigured && aiStatus === 'fail'
                  ? 'text-danger'
                  : 'text-faint',
            )}
          />
          {aiLabel}
        </button>
      </Hint>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 rounded px-1 hover:bg-surface-raised hover:text-foreground"
            aria-label="UI zoom"
          >
            <ZoomIn className="size-3" />
            {Math.round(zoom * 100)}%
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top">
          {ZOOM_LEVELS.map((level) => (
            <DropdownMenuItem key={level} onClick={() => setZoom(level / 100)}>
              <Check className={cn('size-3.5', Math.round(zoom * 100) !== level && 'invisible')} />
              {level}%
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Hint label="Check for updates">
        <button
          type="button"
          className="rounded px-1 hover:bg-surface-raised hover:text-foreground"
          onClick={() => {
            toast.loading('Checking for updates…', { id: 'updater' });
            void import('@/features/updater/check')
              .then(({ checkForUpdates }) => checkForUpdates({ silent: false }))
              .finally(() => toast.dismiss('updater'));
          }}
        >
          {version ? `v${version}` : 'GitMD'}
        </button>
      </Hint>
    </footer>
  );
}
