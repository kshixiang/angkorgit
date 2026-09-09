import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { toast } from 'sonner';
import { AlertTriangle, Archive, Copy, ExternalLink, FolderOpen, History, Maximize2, Minus, Pencil, Plus, SearchCheck, Sparkles, Trash2, Undo2, X } from 'lucide-react';
import type { FileStatus } from '@angkorgit/core';
import { aiCapabilities, buildStagedReviewSignature, filterFiles, hashText, PROJECT_REVIEW_FILE, joinCommitMessage, splitCommitMessage } from '@angkorgit/core';
import {
  Badge,
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
  Logo,
  Spinner,
  Textarea,
  cn,
} from '@angkorgit/design-system';
import { ipc } from '@/core/ipc';
import { useRepo } from '@/features/repository/store';
import { useGraph } from '@/features/graph/store';
import { focusRequests, useUi } from '@/features/ui/store';
import { aiConfigured, getAiProvider } from '@/features/ai/client';
import { AiText } from '@/features/ai/AiText';
import { AiResultDialog } from '@/features/ai/AiResultDialog';
import { useAiWork } from '@/features/ai/workStore';
import { useSettings } from '@/features/settings/store';
import { ensureRepoProfile } from '@/features/settings/profiles';
import { useUndo } from '@/features/history/undoStore';
import { abortMergeFlow } from '@/features/repository/merge';
import { useCommitDraft } from './draftStore';
import { confirmDialog } from '@/components/confirm';
import { FileFilterInput } from '@/components/FileFilterInput';
import { FileTree, treeIndent as sharedTreeIndent, FileTreeFoldButton, INITIAL_FOLD, nextFold, type FileTreeFold, type FileTreeFoldState } from '@/components/FileTree';
import { basename, dirname } from '@/shared/utils';

function statusBadge(kind: string | null) {
  switch (kind) {
    case 'new':
    case 'untracked':
      return <Badge tone="success">A</Badge>;
    case 'modified':
      return <Badge tone="info">M</Badge>;
    case 'deleted':
      return <Badge tone="danger">D</Badge>;
    case 'renamed':
      return <Badge tone="primary">R</Badge>;
    case 'conflicted':
      return <Badge tone="danger">!</Badge>;
    default:
      return null;
  }
}

const FileRow = memo(function FileRow({
  file,
  staged,
  selected,
  onClick,
  onPrimary,
  onDiscard,
  onContextMenu,
  indent,
  treeMode,
}: {
  file: FileStatus;
  staged: boolean;
  selected: boolean;
  onClick: (file: FileStatus, staged: boolean, event: React.MouseEvent) => void;
  onPrimary: (file: FileStatus, staged: boolean) => void;
  onDiscard?: (file: FileStatus) => void;
  onContextMenu?: (event: React.MouseEvent, file: FileStatus, staged: boolean) => void;
  indent?: number;
  treeMode?: boolean;
}) {
  const kind = staged ? file.staged : file.unstaged;
  const conflicted = file.unstaged === 'conflicted';
  const row = (
      <div
        data-selected-file-row={selected || undefined}
        title={treeMode ? file.path : undefined}
        className={cn(
          'group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors',
          selected ? 'bg-primary/10' : 'hover:bg-surface-raised',
        )}
        style={indent !== undefined ? { paddingLeft: indent } : undefined}
        onClick={(e) => onClick(file, staged, e)}
        onContextMenu={onContextMenu ? (e) => onContextMenu(e, file, staged) : undefined}
      >
        <Checkbox
          checked={staged}
          aria-label={staged ? `Unstage ${file.path}` : `Stage ${file.path}`}
          onCheckedChange={() => onPrimary(file, staged)}
          onClick={(e) => e.stopPropagation()}
        />
        {statusBadge(conflicted && !staged ? 'conflicted' : kind)}
        <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
          <span className="max-w-full shrink-0 truncate text-foreground">{basename(file.path)}</span>
          {!treeMode && dirname(file.path) && (
            <span className="min-w-0 flex-1 truncate text-faint">{dirname(file.path)}</span>
          )}
        </span>
        {onDiscard && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Discard ${file.path}`}
            className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onDiscard(file);
            }}
          >
            <Trash2 className="size-3 text-danger" />
          </Button>
        )}
      </div>
  );
  if (treeMode) return row;
  return (
    <Hint label={file.path} side="left" className="max-w-[34rem] font-mono">
      {row}
    </Hint>
  );
});

const fileStatusPath = (file: FileStatus) => file.path;

export const commitShortcut = { current: null as (() => void) | null };
const COMMIT_BOX_MIN = 72;
const COMMIT_BOX_AUTO_MAX = 260;
const COMMIT_BOX_MAX = 600;

const REVIEW_WAIT_MESSAGES = [
  'Reading your staged changes…',
  'Thinking through edge cases…',
  'Hunting for bugs…',
  'Checking your conventions…',
  'Looking for missing tests…',
  'Polishing the feedback…',
];

const UNSTAGED_ROW_HEIGHT = 36;
const STAGED_ROW_HEIGHT = 30;

function VirtualFileList({
  files,
  scrollRef,
  rowHeight,
  renderRow,
}: {
  files: FileStatus[];
  scrollRef: React.RefObject<HTMLDivElement>;
  rowHeight: (file: FileStatus) => number;
  renderRow: (file: FileStatus) => React.ReactNode;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el) setScrollMargin((prev) => (prev === el.offsetTop ? prev : el.offsetTop));
  });
  const virtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => rowHeight(files[index]),
    getItemKey: (index) => files[index].path,
    overscan: 12,
    scrollMargin,
  });
  const sizeSignature = useMemo(
    () => files.map((file) => rowHeight(file)).join(','),
    [files, rowHeight],
  );
  useEffect(() => {
    virtualizer.measure();
  }, [virtualizer, sizeSignature]);
  return (
    <div ref={listRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((item) => (
        <div
          key={item.key}
          className="absolute left-0 w-full"
          style={{ top: 0, height: item.size, transform: `translateY(${item.start - scrollMargin}px)` }}
        >
          {renderRow(files[item.index])}
        </div>
      ))}
    </div>
  );
}

export function WorkingCopyPanel() {
  const repo = useRepo((s) => s.repo);
  const status = useRepo((s) => s.status);
  const conflicts = useRepo((s) => s.conflicts);
  const submodules = useRepo((s) => s.submodules);
  const refreshStatus = useRepo((s) => s.refreshStatus);
  const reloadGraph = useGraph((s) => s.reload);
  const selectedFile = useUi((s) => s.selectedFile);
  const selectFile = useUi((s) => s.selectFile);
  const openCenterDiff = useUi((s) => s.openCenterDiff);
  const openEditor = useUi((s) => s.openEditor);
  const openConflict = useUi((s) => s.openConflict);
  const fileTree = useUi((s) => s.fileTree);
  const path = repo?.path ?? '';
  const message = useCommitDraft((s) => (path ? (s.drafts[path] ?? '') : ''));
  const amend = useCommitDraft((s) => !!path && s.amendFor === path);
  const setMessage = (text: string) => useCommitDraft.getState().setDraft(path, text);
  const { summary, body } = splitCommitMessage(message);
  const setSummary = (text: string) => setMessage(joinCommitMessage(text, body));
  const setBody = (text: string) => setMessage(joinCommitMessage(summary, text));
  const summaryRef = useRef<HTMLInputElement>(null);
  const [unstagedFold, setUnstagedFold] = useState<FileTreeFold>(INITIAL_FOLD);
  const [unstagedFoldState, setUnstagedFoldState] = useState<FileTreeFoldState | null>(null);
  const [stagedFold, setStagedFold] = useState<FileTreeFold>(INITIAL_FOLD);
  const [stagedFoldState, setStagedFoldState] = useState<FileTreeFoldState | null>(null);
  const commitBoxHeight = useUi((s) => s.commitBoxHeight);
  const [resizing, setResizing] = useState(false);
  const startResize = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const el = messageRef.current;
    if (!el) return;
    const startY = event.clientY;
    const startHeight = el.getBoundingClientRect().height;
    setResizing(true);
    const onMove = (e: MouseEvent) => {
      const next = Math.round(Math.min(COMMIT_BOX_MAX, Math.max(COMMIT_BOX_MIN, startHeight + (startY - e.clientY))));
      useUi.getState().setCommitBoxHeight(next);
    };
    const onUp = () => {
      setResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  const setAmend = (value: boolean) => useCommitDraft.getState().setAmend(path, value);
  const [committing, setCommitting] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const aiRunRef = useRef(0);
  const [reviewExpanded, setReviewExpanded] = useState(false);
  const [waitIndex, setWaitIndex] = useState(0);
  const [fileMenu, setFileMenu] = useState<{ x: number; y: number; file: FileStatus; staged: boolean } | null>(null);
  const [folderMenu, setFolderMenu] = useState<{ x: number; y: number; path: string; staged: boolean } | null>(null);
  const [multi, setMulti] = useState<{ staged: boolean; paths: string[] } | null>(null);
  const messageRef = useRef<HTMLTextAreaElement | null>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);

  const applyBoxHeight = (el: HTMLTextAreaElement, fixed: number | null) => {
    if (fixed !== null) {
      el.style.height = `${fixed}px`;
      return;
    }
    el.style.height = 'auto';
    el.style.height = `${Math.max(COMMIT_BOX_MIN, Math.min(el.scrollHeight, COMMIT_BOX_AUTO_MAX))}px`;
  };
  const boxHeightRef = useRef(commitBoxHeight);
  boxHeightRef.current = commitBoxHeight;
  const attachMessageBox = (el: HTMLTextAreaElement | null) => {
    messageRef.current = el;
    if (el) applyBoxHeight(el, boxHeightRef.current);
  };
  useEffect(() => {
    const el = messageRef.current;
    if (el) applyBoxHeight(el, commitBoxHeight);
  }, [body, commitBoxHeight]);

  useEffect(() => {
    if (!path || useCommitDraft.getState().drafts[path]) return;
    let cancelled = false;
    void ipc
      .mergeMessage(path)
      .then((mergeMsg) => {
        if (cancelled || !mergeMsg) return;
        if (useCommitDraft.getState().drafts[path]) return;
        useCommitDraft.getState().setDraft(path, mergeMsg);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [path, status]);

  const files = useMemo(() => status?.files ?? [], [status]);
  const conflictedPaths = useMemo(() => new Set(conflicts), [conflicts]);
  const [fileQuery, setFileQuery] = useState('');
  const fileFilterOpen = useUi((s) => s.fileFilterOpen);
  const fileFilterFocusSeq = useUi((s) => s.fileFilterFocusSeq);
  useEffect(() => {
    if (!fileFilterOpen) setFileQuery('');
  }, [fileFilterOpen]);
  const filtering = fileQuery.trim().length > 0;
  const allStaged = useMemo(() => files.filter((f) => f.staged), [files]);
  const allUnstaged = useMemo(
    () => files.filter((f) => f.unstaged && !conflictedPaths.has(f.path)),
    [files, conflictedPaths],
  );
  const stagedFiles = useMemo(() => filterFiles(allStaged, fileStatusPath, fileQuery), [allStaged, fileQuery]);
  const unstagedFiles = useMemo(
    () => filterFiles(allUnstaged, fileStatusPath, fileQuery),
    [allUnstaged, fileQuery],
  );
  const stagedSignature = useMemo(() => buildStagedReviewSignature(files), [files]);
  const review = useAiWork((s) => (path ? (s.reviews[path] ?? null) : null));
  const reviewBusy = useAiWork((s) => (path ? !!s.reviewBusy[path] : false));
  const reviewCurrent = review !== null && review.stagedSignature === stagedSignature;

  useEffect(() => {
    if (path && review && review.stagedSignature !== stagedSignature) {
      useAiWork.getState().setReview(path, null);
    }
  }, [review, path, stagedSignature]);

  useEffect(() => {
    if (!reviewCurrent) setReviewExpanded(false);
  }, [reviewCurrent]);

  useEffect(() => {
    if (!reviewBusy) return;
    setWaitIndex(Math.floor(Math.random() * REVIEW_WAIT_MESSAGES.length));
    const timer = setInterval(() => setWaitIndex((i) => i + 1), 6000);
    return () => clearInterval(timer);
  }, [reviewBusy]);

  useEffect(() => {
    if (!reviewCurrent || !review) return;
    let cancelled = false;
    void ipc
      .stagedPatch(path)
      .then((patch) => {
        if (cancelled || useRepo.getState().repo?.path !== path) return;
        if (hashText(patch) !== review.patchHash) useAiWork.getState().setReview(path, null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [reviewCurrent, review, path, status]);

  useEffect(() => {
    setMulti(null);
    setFileQuery('');
  }, [path]);

  useEffect(() => {
    if (!multi || !status) return;
    const present = new Set(
      status.files
        .filter((f) => (multi.staged ? f.staged : f.unstaged && f.unstaged !== 'conflicted'))
        .map((f) => f.path),
    );
    const kept = multi.paths.filter((p) => present.has(p));
    if (kept.length === multi.paths.length) return;
    setMulti(kept.length > 1 ? { staged: multi.staged, paths: kept } : null);
  }, [status, multi]);

  const showDiff = useCallback(
    (file: FileStatus, staged: boolean) => {
      selectFile({ path: file.path, staged });
      openCenterDiff({ path: file.path, staged });
    },
    [selectFile, openCenterDiff],
  );

  const isSubmodule = (file: string) => submodules.some((s) => s.path === file);

  const discardOne = useCallback(
    async (file: string, staged = false) => {
      try {
        const clean = staged ? await ipc.discardStagedFile(path, file) : await ipc.discardFile(path, file);
        await refreshStatus();
        if (!clean) {
          toast.error(
            useRepo.getState().submodules.some((s) => s.path === file)
              ? `"${file}" is a submodule — open it as its own repository to discard the changes inside it.`
              : `Could not discard "${file}" — the change is still present.`,
          );
        }
      } catch (error) {
        toast.error(`Discard failed: ${(error as { message?: string }).message ?? error}`);
      }
    },
    [path, refreshStatus],
  );

  const discardEverything = async () => {
    const before = allUnstaged.length;
    try {
      const remaining = await ipc.discardAll(path);
      await refreshStatus();
      if (remaining.length > 0) {
        const submoduleCount = remaining.filter(isSubmodule).length;
        const listed = remaining.slice(0, 3).join(', ') + (remaining.length > 3 ? ` +${remaining.length - 3} more` : '');
        toast.error(
          submoduleCount > 0
            ? `${remaining.length} change${remaining.length === 1 ? '' : 's'} could not be discarded (${listed}). Submodule changes must be discarded inside the submodule repository.`
            : `${remaining.length} change${remaining.length === 1 ? '' : 's'} could not be discarded: ${listed}`,
        );
      } else if (before > 0) {
        toast.success(`Discarded ${before} change${before === 1 ? '' : 's'}`);
      }
    } catch (error) {
      toast.error(`Discard all failed: ${(error as { message?: string }).message ?? error}`);
    }
  };

  const run = useCallback(
    async (op: () => Promise<unknown>, errorLabel: string) => {
      try {
        await op();
        await refreshStatus();
      } catch (error) {
        toast.error(`${errorLabel}: ${(error as { message?: string }).message ?? error}`);
      }
    },
    [refreshStatus],
  );

  const stageMany = (paths: string[], staged: boolean) =>
    run(
      () => Promise.all(paths.map((file) => (staged ? ipc.unstageFile(path, file) : ipc.stageFile(path, file)))),
      staged ? 'Unstage failed' : 'Stage failed',
    );

  const discardMany = async (paths: string[], staged: boolean) => {
    const leftovers: string[] = [];
    try {
      for (const file of paths) {
        const clean = staged ? await ipc.discardStagedFile(path, file) : await ipc.discardFile(path, file);
        if (!clean) leftovers.push(file);
      }
    } catch (error) {
      toast.error(`Discard failed: ${(error as { message?: string }).message ?? error}`);
    }
    await refreshStatus();
    if (leftovers.length > 0) {
      const listed = leftovers.slice(0, 3).join(', ') + (leftovers.length > 3 ? ` +${leftovers.length - 3} more` : '');
      toast.error(
        leftovers.some(isSubmodule)
          ? `${leftovers.length} change${leftovers.length === 1 ? '' : 's'} could not be discarded (${listed}). Submodule changes must be discarded inside the submodule repository.`
          : `${leftovers.length} change${leftovers.length === 1 ? '' : 's'} could not be discarded: ${listed}`,
      );
    } else {
      toast.success(`Discarded ${paths.length} change${paths.length === 1 ? '' : 's'}`);
    }
  };

  const requestDiscardMany = (paths: string[], staged: boolean) => {
    void confirmDialog({
      title: `Discard changes in ${paths.length} files?`,
      description: staged
        ? 'These files go back to the last commit — staged and unstaged changes alike. New files are deleted. This cannot be undone.'
        : 'All changes in these files will be reverted. Untracked files among them are deleted. This cannot be undone.',
      confirmLabel: 'Discard',
      destructive: true,
    }).then((ok) => {
      if (ok) void discardMany(paths, staged);
    });
  };

  const requestDiscardFolder = (folder: string, staged: boolean) => {
    const source = staged ? allStaged : allUnstaged;
    const paths = source.filter((file) => file.path.startsWith(`${folder}/`)).map((file) => file.path);
    if (paths.length === 0) return;
    void confirmDialog({
      title: `Discard all ${paths.length} change${paths.length === 1 ? '' : 's'} in ${folder}?`,
      description: staged
        ? 'These files go back to the last commit — staged and unstaged changes alike. New files are deleted. This cannot be undone.'
        : 'All changes in this folder will be reverted. Untracked files among them are deleted. This cannot be undone.',
      path: folder,
      confirmLabel: 'Discard all',
      destructive: true,
    }).then((ok) => {
      if (ok) void discardMany(paths, staged);
    });
  };

  const discardAllStaged = async () => {
    const before = allStaged.length;
    try {
      const remaining = await ipc.discardStagedAll(path);
      await refreshStatus();
      if (remaining.length > 0) {
        const listed = remaining.slice(0, 3).join(', ') + (remaining.length > 3 ? ` +${remaining.length - 3} more` : '');
        toast.error(`${remaining.length} staged change${remaining.length === 1 ? '' : 's'} could not be discarded: ${listed}`);
      } else if (before > 0) {
        toast.success(`Discarded ${before} staged change${before === 1 ? '' : 's'}`);
      }
    } catch (error) {
      toast.error(`Discard failed: ${(error as { message?: string }).message ?? error}`);
    }
  };

  const toggleStage = useCallback(
    (file: FileStatus, staged: boolean) => {
      void run(
        () => (staged ? ipc.unstageFile(path, file.path) : ipc.stageFile(path, file.path)),
        staged ? 'Unstage failed' : 'Stage failed',
      );
    },
    [run, path],
  );

  const openFileMenu = useCallback((event: React.MouseEvent, file: FileStatus, staged: boolean) => {
    event.preventDefault();
    setFolderMenu(null);
    setFileMenu({ x: event.clientX, y: event.clientY, file, staged });
  }, []);

  const openFolderMenu = useCallback((event: React.MouseEvent, folder: { path: string }, staged: boolean) => {
    event.preventDefault();
    setFileMenu(null);
    setFolderMenu({ x: event.clientX, y: event.clientY, path: folder.path, staged });
  }, []);

  const requestDiscard = useCallback(
    (file: FileStatus, staged = false) => {
      void confirmDialog({
        title: 'Discard changes?',
        description: staged
          ? file.staged === 'new'
            ? 'This file is new — discarding removes it from the index and deletes the file. This cannot be undone.'
            : 'The file goes back to the last commit — its staged and unstaged changes are both reverted. This cannot be undone.'
          : file.unstaged === 'untracked'
            ? 'This file is new — discarding reverts it and deletes the file. This cannot be undone.'
            : 'All changes in this file will be reverted. This cannot be undone.',
        path: file.path,
        confirmLabel: 'Discard',
        destructive: true,
      }).then((ok) => {
        if (ok) void discardOne(file.path, staged);
      });
    },
    [discardOne],
  );

  const requestDiscardStaged = useCallback((file: FileStatus) => requestDiscard(file, true), [requestDiscard]);

  const generateMessage = async () => {
    if (aiBusy) {
      aiRunRef.current += 1;
      setAiBusy(false);
      return;
    }
    if (!aiConfigured()) {
      toast.info('Configure an AI provider in Settings first');
      return;
    }
    if (stagedFiles.length === 0) {
      toast.info('Stage some changes first');
      return;
    }
    const run = ++aiRunRef.current;
    const stillRunning = () => aiRunRef.current === run;
    setAiBusy(true);
    try {
      const patch = await ipc.stagedPatch(path);
      if (!stillRunning()) return;
      const generated = await aiCapabilities.generateCommitMessage(getAiProvider(), patch, {
        style: useSettings.getState().aiStyle.commit,
        branch: status?.branch ?? null,
        language: useSettings.getState().aiCommitLanguage,
      });
      if (!stillRunning()) return;
      setMessage(generated);
    } catch (error) {
      if (stillRunning()) {
        toast.error(`AI request failed: ${(error as { message?: string } | null)?.message ?? String(error)}`);
      }
    } finally {
      if (stillRunning()) setAiBusy(false);
    }
  };

  const reviewStaged = async () => {
    if (!aiConfigured()) {
      toast.info('Configure an AI provider in Settings first');
      return;
    }
    if (stagedFiles.length === 0) {
      toast.info('Stage some changes first');
      return;
    }
    const target = path;
    const signature = stagedSignature;
    const run = useAiWork.getState().startReview(target);
    const stillRunning = () => useAiWork.getState().isReviewRun(target, run);
    try {
      const patch = await ipc.stagedPatch(target);
      if (!stillRunning()) return;
      if (!patch.trim()) {
        toast.info('The staged changes have no reviewable text diff');
        return;
      }
      const projectInstructions = await ipc.readFile(target, PROJECT_REVIEW_FILE).catch((error) => {
        if (stillRunning() && (error as { code?: string } | null)?.code !== 'not_found') {
          toast.warning(`Could not read ${PROJECT_REVIEW_FILE} — reviewing without project conventions`);
        }
        return '';
      });
      const text = await aiCapabilities.reviewStagedChanges(getAiProvider(), patch, {
        instructions: useSettings.getState().aiStyle.review.instructions,
        projectInstructions,
      });
      if (!stillRunning()) return;
      if (!text) {
        toast.error('The AI provider returned an empty review — try again or check the model in Settings');
        return;
      }
      const state = useRepo.getState();
      if (state.repo?.path !== target) return;
      if (buildStagedReviewSignature(state.status?.files ?? []) !== signature) {
        toast.info('The staged changes changed during the review — run it again');
        return;
      }
      useAiWork
        .getState()
        .setReview(target, { stagedSignature: signature, patchHash: hashText(patch), text });
    } catch (error) {
      if (stillRunning()) {
        toast.error(`AI request failed: ${(error as { message?: string } | null)?.message ?? String(error)}`);
      }
    } finally {
      useAiWork.getState().endReview(target, run);
    }
  };

  const stopReview = () => {
    if (path) useAiWork.getState().stopReview(path);
  };

  const committingRef = useRef(false);

  const commit = async () => {
    if (!summary.trim() && !amend) return;
    if (committingRef.current) return;
    committingRef.current = true;
    setCommitting(true);
    try {
      await ensureRepoProfile(path);
      if (amend) {
        await ipc.amend(path, message.trim() ? message.trim() : null);
        toast.success('Commit amended');
      } else {
        const summary = message.trim().split('\n')[0].slice(0, 50);
        await useUndo.getState().tracked({
          path,
          kind: 'commit',
          label: `commit "${summary}"`,
          action: () => ipc.commit(path, message.trim()),
        });
        toast.success('Committed');
      }
      setMessage('');
      setAmend(false);
      useAiWork.getState().setReview(path, null);
      await refreshStatus();
      await reloadGraph(path);
    } catch (error) {
      toast.error(`Commit failed: ${(error as { message?: string }).message ?? error}`);
    } finally {
      committingRef.current = false;
      setCommitting(false);
    }
  };

  useEffect(() => {
    commitShortcut.current = () => void commit();
    return () => {
      commitShortcut.current = null;
    };
  });

  const unstagedRowHeight = useCallback(() => UNSTAGED_ROW_HEIGHT, []);
  const stagedRowHeight = useCallback(() => STAGED_ROW_HEIGHT, []);

  const visibleOrder = useMemo(
    () => [
      ...unstagedFiles.map((file) => ({ file, staged: false })),
      ...stagedFiles.map((file) => ({ file, staged: true })),
    ],
    [unstagedFiles, stagedFiles],
  );

  const onRowClick = useCallback(
    (file: FileStatus, staged: boolean, event: React.MouseEvent) => {
      const side = visibleOrder.filter((e) => e.staged === staged).map((e) => e.file.path);
      if (event.shiftKey) {
        const anchor = useUi.getState().selectedFile;
        const from = anchor && anchor.staged === staged ? side.indexOf(anchor.path) : -1;
        const to = side.indexOf(file.path);
        if (from < 0 || to < 0) {
          showDiff(file, staged);
          return;
        }
        const [a, b] = from < to ? [from, to] : [to, from];
        const paths = side.slice(a, b + 1);
        setMulti(paths.length > 1 ? { staged, paths } : null);
        return;
      }
      if (event.metaKey || event.ctrlKey) {
        const anchor = useUi.getState().selectedFile;
        const base =
          multi && multi.staged === staged
            ? multi.paths
            : anchor && anchor.staged === staged && anchor.path !== file.path
              ? [anchor.path]
              : [];
        const paths = base.includes(file.path) ? base.filter((p) => p !== file.path) : [...base, file.path];
        setMulti(paths.length > 1 ? { staged, paths } : null);
        if (paths.length === 1) selectFile({ path: paths[0], staged });
        return;
      }
      setMulti(null);
      showDiff(file, staged);
    },
    [visibleOrder, multi, showDiff, selectFile],
  );

  const multiPaths = useMemo(() => new Set(multi?.paths ?? []), [multi]);
  const inMulti = (file: FileStatus, staged: boolean) => !!multi && multi.staged === staged && multiPaths.has(file.path);
  const menuMulti =
    fileMenu && multi && multi.paths.length > 1 && inMulti(fileMenu.file, fileMenu.staged) ? multi : null;

  const moveFileSelection = (direction: 1 | -1) => {
    if (visibleOrder.length === 0) return;
    const current = useUi.getState().selectedFile;
    const index = current
      ? visibleOrder.findIndex((e) => e.file.path === current.path && e.staged === current.staged)
      : -1;
    const nextIndex =
      index < 0 ? (direction === 1 ? 0 : visibleOrder.length - 1) : index + direction;
    const next = visibleOrder[nextIndex];
    if (!next) return;
    selectFile({ path: next.file.path, staged: next.staged });
    requestAnimationFrame(() => {
      listScrollRef.current
        ?.querySelector('[data-selected-file-row]')
        ?.scrollIntoView({ block: 'nearest' });
    });
  };

  const inspectorFocusSeq = useUi((s) => s.inspectorFocusSeq);
  useEffect(() => {
    if (inspectorFocusSeq === focusRequests.inspectorConsumed) return;
    focusRequests.inspectorConsumed = inspectorFocusSeq;
    listScrollRef.current?.focus();
    if (!useUi.getState().selectedFile && visibleOrder[0]) showDiff(visibleOrder[0].file, visibleOrder[0].staged);
  }, [inspectorFocusSeq, visibleOrder, showDiff]);

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      useUi.getState().closeCenterDiff();
      useUi.getState().focusGraph();
      return;
    }
    if (e.key === 'ArrowRight') {
      const current = useUi.getState().selectedFile;
      const entry = current
        ? visibleOrder.find((x) => x.file.path === current.path && x.staged === current.staged)
        : visibleOrder[0];
      if (!entry) return;
      e.preventDefault();
      e.stopPropagation();
      showDiff(entry.file, entry.staged);
      return;
    }
    if (e.key === 'Escape' && multi) {
      e.preventDefault();
      e.stopPropagation();
      setMulti(null);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      moveFileSelection(1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      moveFileSelection(-1);
      return;
    }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const current = useUi.getState().selectedFile;
    if (!current) return;
    const entry = visibleOrder.find(
      (x) => x.file.path === current.path && x.staged === current.staged,
    );
    if (!entry) return;
    e.preventDefault();
    if (e.key === 'Enter') {
      if (conflictedPaths.has(entry.file.path) && !entry.staged) openConflict(entry.file.path);
      else showDiff(entry.file, entry.staged);
    } else {
      toggleStage(entry.file, entry.staged);
    }
  };

  const treeIndent = (depth?: number) =>
    fileTree && depth !== undefined ? sharedTreeIndent(depth) : undefined;

  const renderUnstaged = (file: FileStatus, depth?: number) => (
    <FileRow
      key={`u-${file.path}`}
      file={file}
      staged={false}
      treeMode={fileTree}
      indent={treeIndent(depth)}
      selected={(selectedFile?.path === file.path && !selectedFile.staged) || inMulti(file, false)}
      onClick={onRowClick}
      onPrimary={toggleStage}
      onContextMenu={openFileMenu}
      onDiscard={requestDiscard}
    />
  );

  const renderStaged = (file: FileStatus, depth?: number) => (
    <FileRow
      key={`s-${file.path}`}
      file={file}
      staged
      treeMode={fileTree}
      indent={treeIndent(depth)}
      selected={(selectedFile?.path === file.path && selectedFile.staged) || inMulti(file, true)}
      onClick={onRowClick}
      onPrimary={toggleStage}
      onContextMenu={openFileMenu}
      onDiscard={requestDiscardStaged}
    />
  );

  const countLabel = (shown: number, total: number) =>
    filtering ? (
      <span className="text-faint">
        {shown} <span className="font-normal normal-case tracking-normal">of {total}</span>
      </span>
    ) : (
      <span className="text-faint">{total}</span>
    );

  return (
    <div className="flex h-full flex-col">
      {status !== null && fileFilterOpen && (
        <div className="shrink-0 px-2 pt-2">
          <FileFilterInput
            value={fileQuery}
            onChange={setFileQuery}
            onClose={() => useUi.getState().setFileFilterOpen(false)}
            focusSeq={fileFilterFocusSeq}
            placeholder="Filter changed files…"
          />
        </div>
      )}
      <div
        ref={listScrollRef}
        tabIndex={0}
        aria-label="Changed files"
        onKeyDown={onListKeyDown}
        className="relative min-h-0 flex-1 overflow-y-auto p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
      >
        {status === null ? (
          <div className="flex h-full items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : (
        <>
        {conflicts.length > 0 && (
          <>
            <div className="mb-1 flex items-center justify-between px-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-danger">
                <AlertTriangle className="size-3.5" />
                Conflicts <span className="font-normal text-faint">{conflicts.length}</span>
              </span>
              <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={() => openConflict(conflicts[0])}>
                Resolve
              </Button>
            </div>
            <p className="mb-1 px-2 text-[11px] text-faint">
              Resolve each file, then commit to finish the {repo?.state === 'merge' ? 'merge' : repo?.state === 'rebase' ? 'rebase' : 'operation'}.
            </p>
            <div className="mb-3 flex flex-col">
              {conflicts.map((file) => (
                <button
                  key={`c-${file}`}
                  type="button"
                  className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-danger/10"
                  onClick={() => openConflict(file)}
                >
                  <Badge tone="danger" className="w-5 shrink-0 justify-center px-0 font-mono">!</Badge>
                  <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                    <span className="max-w-full shrink-0 truncate font-medium text-foreground">{basename(file)}</span>
                    {dirname(file) && <span className="min-w-0 flex-1 truncate text-[11px] text-faint">{dirname(file)}</span>}
                  </span>
                  <span className="shrink-0 text-[11px] text-danger opacity-0 transition-opacity group-hover:opacity-100">Resolve</span>
                </button>
              ))}
            </div>
          </>
        )}
        <div className="mb-1 flex items-center justify-between px-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            Changes {countLabel(unstagedFiles.length, allUnstaged.length)}
          </span>
          {allUnstaged.length > 0 && (
            <span className="flex items-center">
              {fileTree && (
                <FileTreeFoldButton
                  state={unstagedFoldState}
                  onFold={(mode) => setUnstagedFold((f) => nextFold(f, mode))}
                />
              )}
              <Button variant="ghost" size="sm" onClick={() => void run(() => ipc.stageAll(path), 'Stage all failed')}>
                <Plus className="size-3" /> Stage all
              </Button>
              <Hint label="Discard all changes">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Discard all changes"
                  className="text-muted hover:text-danger"
                  onClick={() => {
                    void confirmDialog({
                      title: `Discard all ${allUnstaged.length} change${allUnstaged.length === 1 ? '' : 's'}?`,
                      description:
                        'Every unstaged change will be reverted and untracked files will be deleted. This cannot be undone — not even with ⌘Z.',
                      confirmLabel: 'Discard all',
                      destructive: true,
                    }).then((ok) => {
                      if (ok) void discardEverything();
                    });
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </Hint>
            </span>
          )}
        </div>
        {unstagedFiles.length === 0 && (
          <p className="px-2 pb-2 text-xs text-faint">
            {filtering && allUnstaged.length > 0 ? 'No changes match the filter.' : 'Working tree clean.'}
          </p>
        )}
        {fileTree ? (
          <FileTree
            items={unstagedFiles}
            pathOf={fileStatusPath}
            renderFile={renderUnstaged}
            fold={unstagedFold}
            onFoldState={setUnstagedFoldState}
            onFolderContextMenu={(event, folder) => openFolderMenu(event, folder, false)}
          />
        ) : (
          <VirtualFileList
            files={unstagedFiles}
            scrollRef={listScrollRef}
            rowHeight={unstagedRowHeight}
            renderRow={renderUnstaged}
          />
        )}
        <div className="mb-1 mt-3 flex items-center justify-between px-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            Staged {countLabel(stagedFiles.length, allStaged.length)}
          </span>
          {allStaged.length > 0 && (
            <span className="flex items-center">
              {fileTree && (
                <FileTreeFoldButton
                  state={stagedFoldState}
                  onFold={(mode) => setStagedFold((f) => nextFold(f, mode))}
                />
              )}
              <Button variant="ghost" size="sm" onClick={() => void run(() => ipc.unstageAll(path), 'Unstage all failed')}>
                <Minus className="size-3" /> Unstage all
              </Button>
              <Hint label="Discard all staged changes">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Discard all staged changes"
                  className="text-muted hover:text-danger"
                  onClick={() => {
                    void confirmDialog({
                      title: `Discard all ${allStaged.length} staged change${allStaged.length === 1 ? '' : 's'}?`,
                      description:
                        'Every staged file goes back to the last commit, unstaged edits to those files included, and new files are deleted. This cannot be undone — not even with ⌘Z.',
                      confirmLabel: 'Discard all',
                      destructive: true,
                    }).then((ok) => {
                      if (ok) void discardAllStaged();
                    });
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </Hint>
            </span>
          )}
        </div>
        {stagedFiles.length === 0 && (
          <p className="px-2 pb-2 text-xs text-faint">
            {filtering && allStaged.length > 0 ? 'No staged files match the filter.' : 'Nothing staged yet.'}
          </p>
        )}
        {fileTree ? (
          <FileTree
            items={stagedFiles}
            pathOf={fileStatusPath}
            renderFile={renderStaged}
            fold={stagedFold}
            onFoldState={setStagedFoldState}
            onFolderContextMenu={(event, folder) => openFolderMenu(event, folder, true)}
          />
        ) : (
          <VirtualFileList
            files={stagedFiles}
            scrollRef={listScrollRef}
            rowHeight={stagedRowHeight}
            renderRow={renderStaged}
          />
        )}
        </>
        )}
      </div>

      {fileMenu && (
        <DropdownMenu open onOpenChange={(o) => !o && setFileMenu(null)}>
          <DropdownMenuTrigger asChild>
            <span style={{ position: 'fixed', left: fileMenu.x, top: fileMenu.y }} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="bottom">
            {menuMulti ? (
              <>
                <DropdownMenuLabel>{menuMulti.paths.length} files selected</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => void stageMany(menuMulti.paths, menuMulti.staged)}>
                  {menuMulti.staged ? <Minus /> : <Plus />}
                  {menuMulti.staged ? `Unstage ${menuMulti.paths.length} files` : `Stage ${menuMulti.paths.length} files`}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => useUi.getState().openDialog('createStash', { paths: menuMulti.paths })}
                >
                  <Archive /> Stash {menuMulti.paths.length} files…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onClick={() => requestDiscardMany(menuMulti.paths, menuMulti.staged)}>
                  <Trash2 /> Discard changes in {menuMulti.paths.length} files…
                </DropdownMenuItem>
              </>
            ) : (
            <>
            <DropdownMenuLabel className="max-w-64 truncate font-mono">{fileMenu.file.path}</DropdownMenuLabel>
            {fileMenu.staged ? (
              <>
                <DropdownMenuItem
                  onClick={() => void run(() => ipc.unstageFile(path, fileMenu.file.path), 'Unstage failed')}
                >
                  <Minus /> Unstage file
                </DropdownMenuItem>
                <DropdownMenuItem destructive onClick={() => requestDiscard(fileMenu.file, true)}>
                  <Trash2 /> Discard changes…
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem
                  onClick={() => void run(() => ipc.stageFile(path, fileMenu.file.path), 'Stage failed')}
                >
                  <Plus /> Stage file
                </DropdownMenuItem>
                <DropdownMenuItem destructive onClick={() => requestDiscard(fileMenu.file)}>
                  <Trash2 /> Discard changes…
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem
              onClick={() => useUi.getState().openDialog('createStash', { paths: [fileMenu.file.path] })}
            >
              <Archive /> Stash this file…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openEditor(fileMenu.file.path)}>
              <Pencil /> Edit file
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => useUi.getState().openFileHistory(fileMenu.file.path)}>
              <History /> File history
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                void ipc
                  .openPath(`${path}/${fileMenu.file.path}`)
                  .catch((error) =>
                    toast.error(
                      `Could not open the file: ${(error as { message?: string }).message ?? error}`,
                    ),
                  )
              }
            >
              <ExternalLink /> Open in external app
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                void ipc
                  .revealPath(`${path}/${fileMenu.file.path}`)
                  .catch((error) =>
                    toast.error(
                      `Could not reveal the file: ${(error as { message?: string }).message ?? error}`,
                    ),
                  )
              }
            >
              <FolderOpen /> Show in Finder
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                void navigator.clipboard.writeText(fileMenu.file.path);
                toast.success('Path copied');
              }}
            >
              <Copy /> Copy path
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              destructive
              onClick={() => {
                const file = fileMenu.file;
                void confirmDialog({
                  title: 'Delete file?',
                  description:
                    file.unstaged === 'untracked'
                      ? 'The file is untracked — deleting it cannot be undone.'
                      : 'The file will be removed from your working tree. It can be restored with Discard (the deletion shows as a change).',
                  path: file.path,
                  confirmLabel: 'Delete',
                  destructive: true,
                }).then((ok) => {
                  if (ok) void run(() => ipc.deleteFile(path, file.path), 'Delete failed');
                });
              }}
            >
              <Trash2 /> Delete file…
            </DropdownMenuItem>
            </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {folderMenu && (
        <DropdownMenu open onOpenChange={(open) => !open && setFolderMenu(null)}>
          <DropdownMenuTrigger asChild>
            <span style={{ position: 'fixed', left: folderMenu.x, top: folderMenu.y }} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="bottom">
            <DropdownMenuLabel className="max-w-64 truncate font-mono">{folderMenu.path}</DropdownMenuLabel>
            <DropdownMenuItem
              destructive
              onClick={() => requestDiscardFolder(folderMenu.path, folderMenu.staged)}
            >
              <Trash2 /> Discard all…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {status === null ? null : files.length === 0 && !amend && repo?.state !== 'merge' ? (
        <div className="shrink-0 border-t border-border-subtle px-3 py-2">
          <Button variant="ghost" size="sm" className="text-muted" onClick={() => setAmend(true)}>
            <Undo2 className="size-3" /> Amend last commit…
          </Button>
        </div>
      ) : (
        <div className="relative shrink-0 border-t border-border-subtle p-3">
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize commit box"
            title="Drag to resize · double-click to reset"
            onMouseDown={startResize}
            onDoubleClick={() => useUi.getState().setCommitBoxHeight(null)}
            className={cn(
              'group/handle absolute -top-1 left-0 right-0 z-10 flex h-2 cursor-row-resize items-center justify-center',
            )}
          >
            <span
              className={cn(
                'h-0.5 w-10 rounded-full transition-colors',
                resizing ? 'bg-primary' : 'bg-transparent group-hover/handle:bg-primary/60',
              )}
            />
          </div>
          {reviewBusy && (
            <div className="mb-2 rounded-md border border-primary/30 bg-primary/5 text-xs leading-relaxed">
              <div className="flex items-center justify-between pl-3 pr-1.5 pt-1.5">
                <span className="flex items-center gap-1.5 font-medium text-primary">
                  <SearchCheck className="size-3.5" /> AI review
                </span>
                <Hint label="Stop the review">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Stop the AI review"
                    onClick={stopReview}
                  >
                    <X className="size-3" />
                  </Button>
                </Hint>
              </div>
              <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-1.5 text-muted">
                <Logo size={18} animated="loop" className="logo-draw-loop shrink-0" />
                <span key={waitIndex} className="animate-fade-in">
                  {REVIEW_WAIT_MESSAGES[waitIndex % REVIEW_WAIT_MESSAGES.length]}
                </span>
              </div>
            </div>
          )}
          {!reviewBusy && review && reviewCurrent && (
            <div className="mb-2 rounded-md border border-primary/30 bg-primary/5 text-xs leading-relaxed">
              <div className="flex items-center justify-between pl-3 pr-1.5 pt-1.5">
                <span className="flex items-center gap-1.5 font-medium text-primary">
                  <SearchCheck className="size-3.5" /> AI review
                </span>
                <span className="flex items-center">
                  <Hint label="Open review in full view">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Open AI review in full view"
                      onClick={() => setReviewExpanded(true)}
                    >
                      <Maximize2 className="size-3" />
                    </Button>
                  </Hint>
                  <Hint label="Dismiss review">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Dismiss AI review"
                      onClick={() => useAiWork.getState().setReview(path, null)}
                    >
                      <X className="size-3" />
                    </Button>
                  </Hint>
                </span>
              </div>
              <div className="max-h-56 overflow-y-auto px-3 pb-2.5 pt-1">
                <AiText text={review.text} />
              </div>
            </div>
          )}
          <div
            className={cn(
              'rounded-md border border-border bg-surface shadow-sm transition-colors',
              'focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/60',
            )}
          >
            <div className="relative flex items-center">
              <input
                ref={summaryRef}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
                    e.preventDefault();
                    messageRef.current?.focus();
                  }
                }}
                placeholder={amend ? 'New summary (leave empty to keep current)' : 'Summary'}
                aria-label="Commit summary"
                spellCheck
                className={cn(
                  'h-9 min-w-0 flex-1 bg-transparent pl-3 text-sm font-medium text-foreground outline-none',
                  'placeholder:font-normal placeholder:text-faint',
                  summary.length > 50 ? 'pr-24' : 'pr-9',
                )}
              />
              {summary.length > 50 && (
                <span
                  className={cn(
                    'pointer-events-none absolute right-9 font-mono text-[10px] tabular-nums',
                    summary.length > 72 ? 'text-danger' : 'text-faint',
                  )}
                  title="Summary length (50 recommended, 72 max)"
                >
                  {summary.length}/72
                </span>
              )}
              <Hint label={aiBusy ? 'Stop generating' : 'Generate message with AI'}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={aiBusy ? 'Stop generating the commit message' : 'Generate commit message with AI'}
                  className="absolute right-1.5"
                  disabled={reviewBusy}
                  onClick={() => void generateMessage()}
                >
                  {aiBusy ? (
                    <Logo size={14} animated="loop" className="logo-draw-loop" />
                  ) : (
                    <Sparkles className="size-3.5 text-primary" />
                  )}
                </Button>
              </Hint>
            </div>
            <div className="mx-3 h-px bg-border-subtle" />
            <Textarea
              ref={attachMessageBox}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && body.length === 0) {
                  e.preventDefault();
                  summaryRef.current?.focus();
                }
              }}
              placeholder="Description — what changed and why  ·  ⌘⏎ to commit"
              aria-label="Commit description"
              className={cn(
                'min-h-[72px] resize-none rounded-none border-0 bg-transparent px-3 py-2 text-xs leading-relaxed text-foreground shadow-none focus-visible:ring-0 focus-visible:border-0',
                commitBoxHeight === null ? 'max-h-[260px]' : 'max-h-[600px] overflow-y-auto',
              )}
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
            <label className="mr-auto flex cursor-pointer items-center gap-1.5 text-xs text-muted">
              <Checkbox checked={amend} onCheckedChange={(v) => setAmend(v === true)} />
              <Undo2 className="size-3" /> Amend
            </label>
            <Hint label="Review staged changes with AI before committing">
              <Button
                variant="outline"
                size="sm"
                disabled={reviewBusy || committing || aiBusy}
                onClick={() => void reviewStaged()}
              >
                {reviewBusy ? (
                  <Logo size={14} animated="loop" className="logo-draw-loop" />
                ) : (
                  <SearchCheck className="size-3 text-primary" />
                )}
                Review
              </Button>
            </Hint>
            {repo?.state === 'merge' && (
              <Hint label="Reset the working copy to the state before the merge started">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-danger hover:text-danger"
                  onClick={() => void abortMergeFlow(path)}
                >
                  Abort merge
                </Button>
              </Hint>
            )}
            <Button
              size="sm"
              disabled={
                committing ||
                (!summary.trim() && !amend) ||
                (stagedFiles.length === 0 && !amend && repo?.state !== 'merge')
              }
              onClick={() => void commit()}
            >
              {committing && <Spinner className="text-primary-foreground" />}
              {amend ? 'Amend commit' : `Commit${stagedFiles.length > 0 ? ` ${stagedFiles.length} file${stagedFiles.length === 1 ? '' : 's'}` : ''}`}
            </Button>
          </div>
        </div>
      )}

      <AiResultDialog
        open={reviewExpanded && !!review && reviewCurrent}
        onOpenChange={(open) => !open && setReviewExpanded(false)}
        title="AI review"
        icon={<SearchCheck className="size-4 text-primary" />}
        text={review?.text ?? ''}
      />
    </div>
  );
}
