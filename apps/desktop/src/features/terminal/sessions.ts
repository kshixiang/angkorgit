import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import { ipc } from '@/core/ipc';
import type { TerminalMode } from '@/features/ui/store';

export interface TerminalSession {
  terminal: Terminal;
  fit: FitAddon;
  container: HTMLDivElement;
  termId: number | null;
  unlisteners: Array<() => void>;
  killed: boolean;
  exited: boolean;
  brandCarry: string;
  errorCarry: string;
  errorHintShown: boolean;
}

export const sessions = new Map<string, TerminalSession>();

export const terminalSessionKey = (path: string, mode: TerminalMode): string => `${mode}:${path}`;

export function killTerminalSession(path: string, mode?: TerminalMode): void {
  const modes: TerminalMode[] = mode ? [mode] : ['shell', 'gitmd-code'];
  for (const candidate of modes) {
    const key = terminalSessionKey(path, candidate);
    const session = sessions.get(key);
    if (!session) continue;
    sessions.delete(key);
    session.killed = true;
    session.unlisteners.forEach((fn) => fn());
    if (session.termId !== null) void ipc.termKill(session.termId);
    session.terminal.dispose();
    session.container.remove();
  }
}
