import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toast } from 'sonner';
import { Copy, GitCommitHorizontal, UserRoundSearch } from 'lucide-react';
import type { BlameHunk, FileBlame } from '@angkorgit/core';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Spinner,
  cn,
} from '@angkorgit/design-system';
import { Avatar } from '@/components/Avatar';
import { ipc } from '@/core/ipc';
import { useRepo } from '@/features/repository/store';
import { highlightLine, languageOf } from '@/shared/highlight';
import { formatDate, timeAgo } from '@/shared/utils';

const ROW_HEIGHT = 22;

export function BlameView({
  file,
  rev,
  onOpenCommit,
  onBlameAt,
  onResolvedRev,
}: {
  file: string;
  rev: string | null;
  onOpenCommit: (oid: string) => void;
  onBlameAt: (rev: string) => void;
  onResolvedRev: (oid: string) => void;
}) {
  const path = useRepo((s) => s.repo?.path ?? '');
  const [blame, setBlame] = useState<FileBlame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; hunk: BlameHunk } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const resolved = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!path) return;
    if (resolved.current !== undefined && resolved.current === rev) return;
    const mine = ++seq.current;
    setBlame(null);
    setError(null);
    ipc
      .fileBlame(path, file, rev)
      .then((result) => {
        if (seq.current !== mine) return;
        resolved.current = result.rev;
        setBlame(result);
        if (result.rev && result.rev !== rev) onResolvedRev(result.rev);
      })
      .catch((e) => {
        if (seq.current !== mine) return;
        resolved.current = undefined;
        setError((e as { message?: string }).message ?? String(e));
      });
  }, [path, file, rev, onResolvedRev]);

  const language = useMemo(() => languageOf(file), [file]);
  const hunkOfLine = useMemo(() => {
    const map: (BlameHunk | undefined)[] = [];
    for (const hunk of blame?.hunks ?? []) {
      for (let i = 0; i < hunk.lineCount; i++) map[hunk.startLine - 1 + i] = hunk;
    }
    return map;
  }, [blame]);
  const virtualizer = useVirtualizer({
    count: blame?.lines.length ?? 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 24,
  });

  if (error) {
    return (
      <div className="flex-1 p-6 text-sm text-danger" data-blame-pane>
        {error}
      </div>
    );
  }
  if (!blame) {
    return (
      <div className="flex flex-1 items-center justify-center" data-blame-pane>
        <Spinner className="size-5" />
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="min-h-0 min-w-0 flex-1 overflow-auto font-mono text-xs" data-blame-pane>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((item) => {
          const hunk = hunkOfLine[item.index];
          const first = hunk?.startLine === item.index + 1;
          const active = !!hunk && hovered === hunk.oid;
          return (
            <div
              key={item.index}
              data-blame-line={item.index + 1}
              className={cn(
                'absolute left-0 flex w-full items-stretch whitespace-pre',
                first && item.index > 0 && 'border-t border-border-subtle',
                active && 'bg-primary/5',
              )}
              style={{ top: item.start, height: ROW_HEIGHT }}
              onMouseEnter={() => setHovered(hunk?.oid ?? null)}
              onMouseLeave={() => setHovered(null)}
              onContextMenu={(e) => {
                if (!hunk) return;
                e.preventDefault();
                setMenu({ x: e.clientX, y: e.clientY, hunk });
              }}
            >
              <div className="flex w-72 shrink-0 items-center border-r border-border-subtle bg-surface/60 px-2">
                {first && hunk && (
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left font-sans disabled:cursor-default"
                    title={`${hunk.summary}\n${hunk.authorName} · ${formatDate(hunk.time)}`}
                    aria-label={hunk.committed ? `Open commit ${hunk.shortOid}` : 'Not committed yet'}
                    disabled={!hunk.committed}
                    onClick={() => onOpenCommit(hunk.oid)}
                  >
                    {hunk.committed ? (
                      <Avatar name={hunk.authorName} email={hunk.authorEmail} oid={hunk.oid} size={16} />
                    ) : (
                      <span className="size-4 shrink-0 rounded-full bg-primary/30" />
                    )}
                    <span className={cn('min-w-0 flex-1 truncate', hunk.committed ? 'text-foreground' : 'text-primary')}>
                      {hunk.authorName}
                    </span>
                    <span className="w-14 shrink-0 text-right text-faint">{hunk.committed ? timeAgo(hunk.time) : ''}</span>
                    <span className="w-14 shrink-0 font-mono text-faint">{hunk.committed ? hunk.shortOid : ''}</span>
                  </button>
                )}
              </div>
              <span className="w-12 shrink-0 select-none pr-2 text-right tabular-nums text-faint">{item.index + 1}</span>
              <span
                className="min-w-0 flex-1 overflow-hidden pl-2"
                dangerouslySetInnerHTML={{ __html: highlightLine(blame.lines[item.index], language) }}
              />
            </div>
          );
        })}
      </div>
      {menu && (
        <DropdownMenu open onOpenChange={(o) => !o && setMenu(null)}>
          <DropdownMenuTrigger asChild>
            <span style={{ position: 'fixed', left: menu.x, top: menu.y }} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="bottom">
            <DropdownMenuLabel className="max-w-64 truncate">{menu.hunk.summary}</DropdownMenuLabel>
            <DropdownMenuItem disabled={!menu.hunk.committed} onClick={() => onOpenCommit(menu.hunk.oid)}>
              <GitCommitHorizontal /> Open commit {menu.hunk.shortOid}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!menu.hunk.committed} onClick={() => onBlameAt(menu.hunk.oid)}>
              <UserRoundSearch /> Blame at this commit
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!menu.hunk.committed} onClick={() => onBlameAt(`${menu.hunk.oid}^`)}>
              <UserRoundSearch /> Blame before this commit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!menu.hunk.committed}
              onClick={() => {
                void navigator.clipboard.writeText(menu.hunk.oid);
                toast.success('Hash copied');
              }}
            >
              <Copy /> Copy hash
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
