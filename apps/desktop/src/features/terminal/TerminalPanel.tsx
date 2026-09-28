import { useEffect, useRef, useState } from 'react';
import { ClipboardPaste, Copy, Eraser, TextSelect, X } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
} from '@gitmd/design-system';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { ipc, isTauri, listen } from '@/core/ipc';
import { useRepo } from '@/features/repository/store';
import { useSettings } from '@/features/settings/store';
import { useUi, type TerminalMode } from '@/features/ui/store';
import { killTerminalSession, sessions, terminalSessionKey, type TerminalSession } from './sessions';
import { terminalThemeFromTokens } from './theme';
import { filterGitmdCodeOutput, updateRuntimeErrorHint } from './gitmdCodeOutput';
import { GitmdCodePanel } from './GitmdCodePanel';

function newSession(): TerminalSession {
  const container = document.createElement('div');
  container.style.width = '100%';
  container.style.height = '100%';
  const terminal = new Terminal({
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    cursorBlink: true,
    scrollback: 5000,
    theme: terminalThemeFromTokens(),
  });
  const fit = new FitAddon();
  terminal.loadAddon(fit);
  return {
    terminal,
    fit,
    container,
    termId: null,
    unlisteners: [],
    killed: false,
    exited: false,
    brandCarry: '',
    errorCarry: '',
    errorHintShown: false,
  };
}

function spawnTerminal(session: TerminalSession, repoPath: string, mode: TerminalMode): void {
  const { terminal } = session;
  const language = useSettings.getState().uiLanguage;
  if (!isTauri()) {
    terminal.writeln(
      mode === 'gitmd-code'
        ? language === 'chinese'
          ? 'GitMD Code 演示 — PTY 仅在桌面应用中可用。'
          : 'GitMD Code demo - PTY available in the desktop app.'
        : language === 'chinese'
          ? 'GitMD 终端演示 — PTY 仅在桌面应用中可用。'
          : 'GitMD demo terminal - PTY available in the desktop app.',
    );
    terminal.write(mode === 'gitmd-code' ? 'gitmd > ' : '$ ');
    terminal.onData((data) => {
      if (data === '\r') terminal.write(mode === 'gitmd-code' ? '\r\ngitmd > ' : '\r\n$ ');
      else if (data === '\x7f') terminal.write('\b \b');
      else terminal.write(data);
    });
    return;
  }
  void (async () => {
    const pendingData: Array<{ id: number; data: string }> = [];
    const pendingExitIds: number[] = [];
    let id: number | null = null;
    const writeData = (data: string) => {
      const filtered = mode === 'gitmd-code'
        ? filterGitmdCodeOutput(session.brandCarry, data)
        : { output: data, carry: '' };
      session.brandCarry = filtered.carry;
      if (filtered.output) terminal.write(filtered.output);
      if (mode === 'gitmd-code' && !session.errorHintShown) {
        const runtimeError = updateRuntimeErrorHint(session.errorCarry, data);
        session.errorCarry = runtimeError.carry;
        if (runtimeError.hint) {
          session.errorHintShown = true;
          terminal.writeln(`\r\n[GitMD Code: ${language === 'chinese' ? runtimeError.hint : runtimeError.englishHint}]`);
        }
      }
    };
    const markExited = () => {
      session.exited = true;
      if (mode === 'gitmd-code') {
        const tail = filterGitmdCodeOutput(session.brandCarry, '', true);
        session.brandCarry = tail.carry;
        if (tail.output) terminal.write(tail.output);
        terminal.writeln(`\r\n[${language === 'chinese' ? 'GitMD Code 已退出' : 'GitMD Code exited'}]`);
      } else {
        terminal.writeln('\r\n[process exited]');
      }
    };
    try {
      const dataUnlisten = await listen('term-data', (payload) => {
        const event = payload as { id: number; data: string };
        if (id === null) pendingData.push(event);
        else if (event.id === id) writeData(event.data);
      });
      session.unlisteners.push(dataUnlisten);
      const exitUnlisten = await listen('term-exit', (payload) => {
        const event = payload as { id: number };
        if (id === null) pendingExitIds.push(event.id);
        else if (event.id === id) markExited();
      });
      session.unlisteners.push(exitUnlisten);
      const settings = useSettings.getState().gitmdCode;
      if (mode === 'gitmd-code') {
        await ipc.aiKeySet('gitmd-code', settings.apiKey);
      }
      id = mode === 'gitmd-code'
        ? await ipc.gitmdCodeCreate(
            repoPath,
            terminal.cols,
            terminal.rows,
            settings.baseUrl.trim(),
            settings.model.trim(),
            language,
          )
        : await ipc.termCreate(repoPath, terminal.cols, terminal.rows);
      if (session.killed) {
        void ipc.termKill(id);
        return;
      }
      const sessionId = id;
      session.termId = sessionId;
      for (const event of pendingData) {
        if (event.id === sessionId) writeData(event.data);
      }
      if (pendingExitIds.includes(sessionId)) markExited();
      terminal.onData((data) => void ipc.termWrite(sessionId, data));
      terminal.onResize(({ cols, rows }) => void ipc.termResize(sessionId, cols, rows));
    } catch (error) {
      if (session.killed) return;
      session.unlisteners.splice(0).forEach((unlisten) => unlisten());
      session.exited = true;
      terminal.writeln(
        mode === 'gitmd-code'
          ? `\r\n[${language === 'chinese' ? 'GitMD Code 启动失败' : 'GitMD Code failed to start'}: ${(error as { message?: string }).message ?? error}]`
          : `\r\n[could not start shell: ${(error as { message?: string }).message ?? error}]`,
      );
    }
  })();
}

export function TerminalPanel() {
  const repoPath = useRepo((s) => s.repo?.path ?? null);
  const toggleTerminal = useUi((s) => s.toggleTerminal);
  const toggleGitmdCode = useUi((s) => s.toggleGitmdCode);
  const mode = useUi((s) => s.terminalMode);
  const theme = useSettings((s) => s.theme);
  const accent = useSettings((s) => s.accent);
  const hostRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; hasSelection: boolean } | null>(null);

  const key = repoPath ? terminalSessionKey(repoPath, mode) : null;
  const current = () => (key ? sessions.get(key) : undefined);
  const copySelection = () => {
    const text = current()?.terminal.getSelection() ?? '';
    if (text) void navigator.clipboard.writeText(text);
  };
  const paste = async () => {
    const session = current();
    if (!session) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text) session.terminal.paste(text);
    } finally {
      session.terminal.focus();
    }
  };
  const selectAll = () => current()?.terminal.selectAll();
  const clear = () => {
    const session = current();
    if (!session) return;
    session.terminal.clear();
    session.terminal.focus();
  };

  useEffect(() => {
    const next = terminalThemeFromTokens();
    for (const session of sessions.values()) session.terminal.options.theme = next;
  }, [theme, accent]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !repoPath || mode === 'gitmd-code') return;

    const sessionKey = terminalSessionKey(repoPath, mode);
    let session = sessions.get(sessionKey);
    if (session?.exited) {
      killTerminalSession(repoPath, mode);
      session = undefined;
    }
    const fresh = !session;
    if (!session) {
      session = newSession();
      sessions.set(sessionKey, session);
    }
    host.appendChild(session.container);
    if (fresh) {
      session.terminal.open(session.container);
      session.fit.fit();
      spawnTerminal(session, repoPath, mode);
    } else {
      session.terminal.options.theme = terminalThemeFromTokens();
      session.fit.fit();
      session.terminal.focus();
    }

    const attached = session;
    const observer = new ResizeObserver(() => attached.fit.fit());
    observer.observe(host);

    return () => {
      observer.disconnect();
      attached.container.remove();
    };
  }, [repoPath, mode]);

  const close = () => {
    if (repoPath && mode === 'gitmd-code') killTerminalSession(repoPath, mode);
    if (mode === 'gitmd-code') toggleGitmdCode();
    else toggleTerminal();
  };

  if (mode === 'gitmd-code' && repoPath) {
    return <GitmdCodePanel repoPath={repoPath} onClose={close} />;
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-7 shrink-0 items-center border-b border-border-subtle px-3">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
          {mode === 'gitmd-code' ? 'GitMD Code' : 'Terminal'}
        </span>
        <span className="ml-2 min-w-0 flex-1 truncate font-mono text-[10px] text-faint">{repoPath}</span>
        <Hint label="Close terminal">
          <Button variant="ghost" size="icon-sm" className="ml-auto shrink-0" aria-label="Close terminal" onClick={close}>
            <X className="size-3" />
          </Button>
        </Hint>
      </div>
      <div
        ref={hostRef}
        className="terminal-host min-h-0 flex-1"
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY, hasSelection: current()?.terminal.hasSelection() ?? false });
        }}
      />
      {menu && (
        <DropdownMenu open onOpenChange={(o) => !o && setMenu(null)}>
          <DropdownMenuTrigger asChild>
            <span style={{ position: 'fixed', left: menu.x, top: menu.y }} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="bottom" onCloseAutoFocus={(e) => e.preventDefault()}>
            <DropdownMenuItem disabled={!menu.hasSelection} onSelect={copySelection}>
              <Copy /> Copy
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void paste()}>
              <ClipboardPaste /> Paste
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={selectAll}>
              <TextSelect /> Select all
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={clear}>
              <Eraser /> Clear terminal
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
