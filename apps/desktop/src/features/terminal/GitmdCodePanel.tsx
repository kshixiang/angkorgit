import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Check, Circle, CircleAlert, Clock3, Copy, Eraser, Send, Settings2, ShieldCheck, Square, User, X, XCircle } from 'lucide-react';
import { Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Hint, Spinner, Textarea } from '@gitmd/design-system';
import { toast } from 'sonner';
import { ipc, listen, type GitmdAgentMessage, type GitmdAgentStreamEvent, type GitmdAgentTask, type GitmdAgentTaskStatus, type GitmdAgentUsage } from '@/core/ipc';
import { useSettings } from '@/features/settings/store';
import { useUi } from '@/features/ui/store';
import { useUiText } from '@/shared/i18n';
import { GitmdCodeText, GitmdFileLink } from './GitmdCodeText';
import {
  memoryNoteFromInput,
  normalizeSlashCommand,
  persistentMemoryFromInput,
  shellCommandFromInput,
  slashCommandSuggestions,
  type GitmdCodeSlashCommand,
} from './gitmdCodeInput';
import {
  detectGitOperation,
  gitOperationOptions,
  parseGitOperationRules,
  serializeGitOperationRules,
  upsertGitOperationRule,
  type GitOperationKind,
  type GitOperationOption,
} from './gitOperationRules';
import { sumGitmdAgentUsage } from './gitmdCodeUsage';

interface AgentSession {
  messages: GitmdAgentMessage[];
  draft: string;
  memories: string[];
}

interface RulePromptState {
  prompt: string;
  operation: GitOperationKind;
}

function GitOperationRulePrompt({
  request,
  language,
  onClose,
  onSubmit,
}: {
  request: RulePromptState | null;
  language: 'english' | 'chinese';
  onClose: () => void;
  onSubmit: (option: GitOperationOption, remember: boolean) => void;
}) {
  const [selected, setSelected] = useState<string>('');
  const [remember, setRemember] = useState(true);
  const options = request ? gitOperationOptions(request.operation) : [];

  useEffect(() => {
    setSelected(options.find((option) => option.recommended)?.value ?? options[0]?.value ?? '');
    setRemember(true);
  }, [request?.operation]);

  const selectedOption = options.find((option) => option.value === selected);
  const operationLabel = request?.operation ?? '';
  const title = language === 'chinese' ? `为 ${operationLabel} 选择处理规则` : `Choose a ${operationLabel} rule`;
  const description = language === 'chinese'
    ? '当前仓库还没有这类操作的规则。可以只用于本次，也可以记住到仓库规则文件。'
    : 'This repository has no rule for this operation yet. Use it once or remember it in the repository rules file.';

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="max-h-64 overflow-y-auto pr-1" role="radiogroup" aria-label={title}>
          <div className="flex flex-col gap-1.5">
            {options.map((option, index) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected === option.value}
                autoFocus={index === 0}
                className={`flex items-start gap-3 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${selected === option.value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/60 hover:bg-surface-raised'}`}
                onClick={() => setSelected(option.value)}
              >
                <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${selected === option.value ? 'border-primary' : 'border-muted'}`}>
                  {selected === option.value && <span className="size-2 rounded-full bg-primary" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    {option.label}
                    {option.recommended && <span className="text-[10px] font-normal text-primary">{language === 'chinese' ? '推荐' : 'Recommended'}</span>}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">{option.description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-muted">
          <Checkbox checked={remember} onCheckedChange={(value) => setRemember(value === true)} />
          {language === 'chinese' ? '记住此规则（本仓库以后使用）' : 'Remember this rule for this repository'}
        </label>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{language === 'chinese' ? '跳过' : 'Skip'}</Button>
          <Button disabled={!selectedOption} onClick={() => selectedOption && onSubmit(selectedOption, remember)}>
            {remember ? (language === 'chinese' ? '记住并继续' : 'Remember and continue') : (language === 'chinese' ? '本次使用' : 'Use once')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const sessions = new Map<string, AgentSession>();

function sessionFor(repoPath: string): AgentSession {
  const existing = sessions.get(repoPath);
  if (existing) return existing;
  const session = { messages: [], draft: '', memories: [] };
  sessions.set(repoPath, session);
  return session;
}

function errorText(error: unknown): string {
  return (error as { message?: string } | null)?.message ?? String(error);
}

function formatMessageTime(createdAt: number, language: 'english' | 'chinese'): string {
  return new Intl.DateTimeFormat(language === 'chinese' ? 'zh-CN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(createdAt));
}

function formatUsage(usage: GitmdAgentUsage, language: 'english' | 'chinese'): string {
  const format = new Intl.NumberFormat(language === 'chinese' ? 'zh-CN' : 'en-US');
  if (language === 'chinese') {
    return `输入 ${format.format(usage.inputTokens)} · 输出 ${format.format(usage.outputTokens)} · 总计 ${format.format(usage.totalTokens)} tokens`;
  }
  return `Input ${format.format(usage.inputTokens)} · Output ${format.format(usage.outputTokens)} · Total ${format.format(usage.totalTokens)} tokens`;
}

function formatSessionTotal(usage: GitmdAgentUsage, language: 'english' | 'chinese'): string {
  const total = new Intl.NumberFormat(language === 'chinese' ? 'zh-CN' : 'en-US').format(usage.totalTokens);
  return language === 'chinese' ? `会话 ${total} tokens` : `Session ${total} tokens`;
}

function TaskStatusIcon({ status }: { status: GitmdAgentTaskStatus }) {
  if (status === 'completed') return <Check className="size-3.5 text-success" />;
  if (status === 'running') return <Spinner className="size-3.5 text-primary" />;
  if (status === 'failed') return <CircleAlert className="size-3.5 text-danger" />;
  if (status === 'cancelled') return <XCircle className="size-3.5 text-faint" />;
  return <Circle className="size-3.5 text-faint" />;
}

export function GitmdCodePanel({ repoPath, onClose }: { repoPath: string; onClose: () => void }) {
  const stored = sessionFor(repoPath);
  const settings = useSettings((state) => state.gitmdCode);
  const language = useSettings((state) => state.uiLanguage);
  const t = useUiText();
  const [messages, setMessages] = useState<GitmdAgentMessage[]>(stored.messages);
  const [draft, setDraft] = useState(stored.draft);
  const [memories, setMemories] = useState(stored.memories);
  const [selectedCommand, setSelectedCommand] = useState(0);
  const [allowChanges, setAllowChanges] = useState(false);
  const [operationRules, setOperationRules] = useState(() => new Map<GitOperationKind, { operation: GitOperationKind; choice: string }>());
  const [rulePrompt, setRulePrompt] = useState<RulePromptState | null>(null);
  const [review, setReview] = useState<{ changes: Array<{ path: string; status: string }>; diff: string | null } | null>(null);
  const [repoFiles, setRepoFiles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeRequestRef = useRef<string | null>(null);
  const streamQueuesRef = useRef(new Map<string, string>());
  const streamReceivedRef = useRef(new Map<string, string>());
  const streamFinalRef = useRef(new Map<string, string>());
  const ruleOverrideRef = useRef<{ operation: GitOperationKind; choice: string } | null>(null);
  const knownFiles = useMemo(
    () => new Set([...repoFiles, ...(review?.changes.map((change) => change.path) ?? [])]),
    [repoFiles, review],
  );
  const sessionUsage = useMemo(() => sumGitmdAgentUsage(messages), [messages]);

  useEffect(() => {
    let disposed = false;
    void ipc.repoFiles(repoPath).then((files) => {
      if (!disposed) setRepoFiles(files);
    }).catch(() => {
      if (!disposed) setRepoFiles([]);
    });
    return () => {
      disposed = true;
    };
  }, [repoPath]);

  useEffect(() => {
    let disposed = false;
    void ipc.readFile(repoPath, '.gitmd/git-rules.md').then((content) => {
      if (!disposed) setOperationRules(parseGitOperationRules(content));
    }).catch(() => {
      if (!disposed) setOperationRules(new Map());
    });
    return () => {
      disposed = true;
    };
  }, [repoPath]);

  useEffect(() => () => {
    const requestId = activeRequestRef.current;
    activeRequestRef.current = null;
    streamQueuesRef.current.clear();
    streamReceivedRef.current.clear();
    streamFinalRef.current.clear();
    if (requestId) void ipc.gitmdAgentCancel(requestId);
  }, []);

  useEffect(() => {
    stored.messages = messages;
  }, [messages, stored]);

  useEffect(() => {
    stored.draft = draft;
  }, [draft, stored]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = '0px';
    input.style.height = `${Math.min(input.scrollHeight, 128)}px`;
  }, [draft]);

  useEffect(() => {
    stored.memories = memories;
  }, [memories, stored]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [messages, busy]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const requestId = activeRequestRef.current;
      if (!requestId) return;
      const queued = streamQueuesRef.current.get(requestId) ?? '';
      if (!queued) return;
      const chunkSize = queued.length > 240 ? 24 : queued.length > 80 ? 12 : 4;
      const chunk = queued.slice(0, chunkSize);
      streamQueuesRef.current.set(requestId, queued.slice(chunk.length));
      setMessages((current) => current.map((message) => message.id === requestId
        ? { ...message, content: message.content + chunk }
        : message));
    }, 24);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen('gitmd-agent-stream', (payload) => {
      if (disposed || !payload || typeof payload !== 'object') return;
      const event = payload as GitmdAgentStreamEvent;
      if (!event.requestId || event.requestId !== activeRequestRef.current) return;
      setMessages((current) => current.map((message) => {
        if (message.id !== event.requestId) return message;
        const tasks = [...(message.tasks ?? [])];
        if (event.type === 'taskStarted') {
          const analysis = tasks.findIndex((task) => task.id === 'analysis');
          if (analysis >= 0) tasks[analysis] = { ...tasks[analysis], status: 'completed' };
          const existing = tasks.findIndex((task) => task.id === event.taskId);
          if (existing >= 0) tasks[existing] = { ...tasks[existing], label: event.label, status: 'running' };
          else tasks.push({ id: event.taskId, label: event.label, status: 'running' });
          return { ...message, tasks };
        }
        if (event.type === 'taskCompleted') {
          const existing = tasks.findIndex((task) => task.id === event.taskId);
          if (existing >= 0) tasks[existing] = { ...tasks[existing], status: 'completed' };
          return { ...message, tasks };
        }
        if (streamFinalRef.current.has(event.requestId)) return message;
        const received = streamReceivedRef.current.get(event.requestId) ?? '';
        streamReceivedRef.current.set(event.requestId, received + event.delta);
        const queued = streamQueuesRef.current.get(event.requestId) ?? '';
        streamQueuesRef.current.set(event.requestId, queued + event.delta);
        const analysis = tasks.findIndex((task) => task.id === 'analysis');
        if (analysis >= 0) tasks[analysis] = { ...tasks[analysis], status: 'completed' };
        if (!tasks.some((task) => task.id === 'response')) {
          tasks.push({ id: 'response', label: t('Generate response'), status: 'running' });
        }
        return { ...message, tasks };
      }));
    }).then((cleanup) => {
      if (disposed) cleanup();
      else unlisten = cleanup;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [t]);

  const clear = () => {
    streamQueuesRef.current.clear();
    streamReceivedRef.current.clear();
    streamFinalRef.current.clear();
    stored.messages = [];
    stored.draft = '';
    stored.memories = [];
    setMessages([]);
    setDraft('');
    setMemories([]);
    setAllowChanges(false);
    setReview(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const addLocalExchange = (prompt: string, content: string) => {
    const now = Date.now();
    setMessages((current) => [
      ...current,
      { role: 'user', content: prompt, createdAt: now },
      { role: 'assistant', content, createdAt: now },
    ]);
  };

  const send = async () => {
    const prompt = draft.trim();
    if (!prompt || busy) return;

    const command = normalizeSlashCommand(prompt);
    if (command?.local === 'clear') {
      clear();
      return;
    }
    if (command?.local === 'help') {
      addLocalExchange(prompt, language === 'chinese'
        ? '`/status` 查看工作区，`/review` 检查当前改动，`/diff` 解释差异；以 `!` 开头运行仓库内 Shell 命令，`#` 保存本次备注，`# remember:` 保存长期记忆。'
        : '`/status` inspects the worktree, `/review` reviews changes, and `/diff` explains the current diff. Start with `!` for a repository shell command, `#` for a session note, or `# remember:` for persistent memory.');
      setDraft('');
      return;
    }
    if (command?.name === '/model') {
      useUi.getState().openDialog('settings', { section: 'ai' });
      setDraft('');
      return;
    }
    if (prompt.toLowerCase() === '/memory' || prompt.toLowerCase().startsWith('/memory ')) {
      const argument = prompt.slice('/memory'.length).trim().toLowerCase();
      if (argument === 'clear repo' || argument === 'clear repository' || argument === 'clear global' || argument === 'clear user') {
        const scope = argument.endsWith('global') || argument.endsWith('user') ? 'user' : 'repository';
        await ipc.gitmdMemoryClear(repoPath, scope);
        addLocalExchange(prompt, language === 'chinese'
          ? `已清除${scope === 'user' ? '用户级' : '仓库级'}长期记忆。`
          : `Cleared ${scope === 'user' ? 'user' : 'repository'} persistent memory.`);
      } else {
        const files = await ipc.gitmdMemoryRead(repoPath);
        const format = (label: string, content: string) => content.trim() ? `${label}\n${content.trim()}` : `${label}\n(empty)`;
        addLocalExchange(prompt, [
          format(language === 'chinese' ? '用户级记忆' : 'User memory', files.user),
          format(language === 'chinese' ? '仓库级记忆' : 'Repository memory', files.repository),
        ].join('\n\n'));
      }
      setDraft('');
      return;
    }
    const persistentMemory = persistentMemoryFromInput(prompt);
    if (persistentMemory) {
      try {
        await ipc.gitmdMemoryAdd(repoPath, persistentMemory.scope, persistentMemory.content);
        addLocalExchange(prompt, language === 'chinese'
          ? `已保存${persistentMemory.scope === 'user' ? '用户级' : '仓库级'}长期记忆。`
          : `Saved ${persistentMemory.scope === 'user' ? 'user' : 'repository'} persistent memory.`);
      } catch (error) {
        addLocalExchange(prompt, language === 'chinese'
          ? `长期记忆保存失败：${errorText(error)}`
          : `Could not save persistent memory: ${errorText(error)}`);
      }
      setDraft('');
      return;
    }
    const memoryNote = memoryNoteFromInput(prompt);
    if (memoryNote) {
      setMemories((current) => [...current, memoryNote]);
      addLocalExchange(prompt, language === 'chinese' ? `已记住本次会话备注：${memoryNote}` : `Saved a session note: ${memoryNote}`);
      setDraft('');
      return;
    }
    const shellCommand = shellCommandFromInput(prompt);
    if (prompt.trim().startsWith('!') && !shellCommand) return;
    if (!settings.apiKey.trim() || !settings.model.trim()) {
      useUi.getState().openDialog('settings', { section: 'ai' });
      return;
    }
    const operation = shellCommand ? null : detectGitOperation(prompt);
    const existingRule = operation ? operationRules.get(operation) : undefined;
    const override = ruleOverrideRef.current;
    if (operation && (!existingRule || existingRule.choice === 'ask') && override?.operation !== operation) {
      setRulePrompt({ prompt, operation });
      return;
    }
    const selectedPolicy = override?.operation === operation ? override.choice : existingRule?.choice;
    ruleOverrideRef.current = null;
    const history = settings.freshContextEachTurn
      ? []
      : messages.filter((message) => !message.content.startsWith('[Error] '));
    const policyInstruction = operation && selectedPolicy
      ? `\n\nGitMD Code operation rule for ${operation}: use policy "${selectedPolicy}". Follow it unless it would violate safety protections or the user's explicit request.`
      : '';
    const effectivePrompt = shellCommand
      ? `Analyze the output of the shell command that was executed before this AI turn. Explain the result and suggest the next repository action only when useful.`
      : memories.length > 0
        ? `${prompt}\n\nSession notes:\n${memories.map((note) => `- ${note}`).join('\n')}${policyInstruction}`
        : `${command?.prompt ?? prompt}${policyInstruction}`;
    const effectiveAllowChanges = allowChanges || Boolean(shellCommand);
    const requestId = crypto.randomUUID();
    streamQueuesRef.current.set(requestId, '');
    streamReceivedRef.current.set(requestId, '');
    const userMessage: GitmdAgentMessage = { role: 'user', content: prompt, createdAt: Date.now() };
    const assistantMessage: GitmdAgentMessage = {
      id: requestId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      tasks: [{ id: 'analysis', label: t('Analyze request'), status: 'running' }],
    };
    setMessages([...messages, userMessage, assistantMessage]);
    setDraft('');
    activeRequestRef.current = requestId;
    setBusy(true);
    try {
      await ipc.aiKeySet('gitmd-code', settings.apiKey);
      const response = await ipc.gitmdAgentChat({
        requestId,
        repoPath,
        baseUrl: settings.baseUrl.trim(),
        model: settings.model.trim(),
        history,
        prompt: effectivePrompt,
        shellCommand,
        allowChanges: effectiveAllowChanges,
        language,
        responseStyle: useSettings.getState().aiStyle.responseStyle,
      });
      if (activeRequestRef.current !== requestId) return;
      streamFinalRef.current.set(requestId, response.content);
      const received = streamReceivedRef.current.get(requestId) ?? '';
      const missing = response.content.startsWith(received)
        ? response.content.slice(received.length)
        : response.content;
      if (missing) {
        const queued = streamQueuesRef.current.get(requestId) ?? '';
        streamQueuesRef.current.set(requestId, queued + missing);
      }
      setMessages((current) => current.map((message) => {
        if (message.id !== requestId) return message;
        const tasks = (message.tasks ?? []).map((task) => task.status === 'running' && task.id !== 'response'
          ? { ...task, status: 'completed' as const }
          : task);
        if (missing && !tasks.some((task) => task.id === 'response')) {
          tasks.push({ id: 'response', label: t('Generate response'), status: 'running' });
        } else if (missing) {
          const responseTask = tasks.findIndex((task) => task.id === 'response');
          if (responseTask >= 0) tasks[responseTask] = { ...tasks[responseTask], status: 'running' };
        }
        return { ...message, tasks };
      }));
      await new Promise<void>((resolve) => {
        const waitForQueue = () => {
          if (activeRequestRef.current !== requestId || !(streamQueuesRef.current.get(requestId) ?? '')) {
            resolve();
            return;
          }
          window.setTimeout(waitForQueue, 24);
        };
        waitForQueue();
      });
      if (activeRequestRef.current !== requestId) return;
      setMessages((current) => current.map((message) => message.id === requestId
        ? {
             ...message,
             content: response.content,
             usage: response.usage,
             tasks: (message.tasks ?? []).map((task) => ({ ...task, status: 'completed' as const })),
          }
        : message));
      if (response.changes?.length || response.diff) {
        setReview({ changes: response.changes ?? [], diff: response.diff ?? null });
        setRepoFiles((files) => [
          ...new Set([...files, ...(response.changes ?? []).map((change) => change.path)]),
        ]);
      } else {
        setReview(null);
      }
    } catch (error) {
      if (activeRequestRef.current !== requestId) return;
      setMessages((current) => current.map((message) => message.id === requestId
        ? {
            ...message,
            content: message.content || `[Error] ${errorText(error)}`,
            tasks: (message.tasks ?? []).map((task) => task.status === 'running' ? { ...task, status: 'failed' as const } : task),
          }
        : message));
    } finally {
      if (activeRequestRef.current === requestId) {
        activeRequestRef.current = null;
        streamQueuesRef.current.delete(requestId);
        streamReceivedRef.current.delete(requestId);
        streamFinalRef.current.delete(requestId);
        setBusy(false);
        setAllowChanges(false);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    }
  };

  const continueFromRulePrompt = async (option: GitOperationOption, remember: boolean) => {
    const request = rulePrompt;
    if (!request) return;
    const nextRules = upsertGitOperationRule(operationRules, request.operation, option.value);
    if (remember) {
      try {
        await ipc.writeFile(repoPath, '.gitmd/git-rules.md', serializeGitOperationRules(nextRules));
        setOperationRules(nextRules);
        toast.success(language === 'chinese' ? '已记住此仓库的 Git 规则' : 'Git rule saved for this repository');
      } catch (error) {
        toast.error(language === 'chinese' ? `规则保存失败：${errorText(error)}` : `Could not save the rule: ${errorText(error)}`);
      }
    }
    ruleOverrideRef.current = { operation: request.operation, choice: option.value };
    setRulePrompt(null);
    void send();
  };

  const skipRulePrompt = () => {
    const request = rulePrompt;
    if (!request) return;
    setRulePrompt(null);
    setDraft('');
    addLocalExchange(
      request.prompt,
      language === 'chinese'
        ? `已跳过 ${request.operation} 规则选择，本次未执行操作。`
        : `Skipped the ${request.operation} rule selection; nothing was run.`,
    );
  };

  const suggestions = slashCommandSuggestions(draft);
  const chooseSuggestion = (suggestion: GitmdCodeSlashCommand) => {
    setDraft(`${suggestion.name} `);
    setSelectedCommand(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const stop = () => {
    const requestId = activeRequestRef.current;
    if (!requestId) return;
    activeRequestRef.current = null;
    streamQueuesRef.current.delete(requestId);
    streamReceivedRef.current.delete(requestId);
    streamFinalRef.current.delete(requestId);
    setBusy(false);
    setAllowChanges(false);
    setMessages((current) => current.map((message) => message.id === requestId
      ? { ...message, tasks: (message.tasks ?? []).map((task) => task.status === 'running' ? { ...task, status: 'cancelled' as const } : task) }
      : message));
    void ipc.gitmdAgentCancel(requestId);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <>
      <GitOperationRulePrompt
        request={rulePrompt}
        language={language}
        onClose={skipRulePrompt}
        onSubmit={continueFromRulePrompt}
      />
      <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border-subtle px-3">
        <Bot className="size-3.5 text-primary" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">GitMD Code</span>
        <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-faint">{repoPath}</span>
        {sessionUsage && (
          <span
            className="shrink-0 text-[10px] text-faint"
            title={formatUsage(sessionUsage, language)}
          >
            {formatSessionTotal(sessionUsage, language)}
          </span>
        )}
        <Hint label={t('New conversation')}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('New conversation')}
            disabled={busy || messages.length === 0}
            onClick={clear}
          >
            <Eraser className="size-3" />
          </Button>
        </Hint>
        <Hint label={t('GitMD Code settings')}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('GitMD Code settings')}
            onClick={() => useUi.getState().openDialog('settings', { section: 'ai' })}
          >
            <Settings2 className="size-3" />
          </Button>
        </Hint>
        <Hint label={t('Close GitMD Code')}>
          <Button variant="ghost" size="icon-sm" aria-label={t('Close GitMD Code')} onClick={onClose}>
            <X className="size-3" />
          </Button>
        </Hint>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 && !busy ? (
          <div className="flex h-full items-center justify-center text-xs text-faint">
            {t('Ask about this repository')}
          </div>
        ) : (
          <div className="flex w-full flex-col gap-3">
            {messages.map((message, index) => (
              <div
                key={message.id ?? `${message.role}-${index}`}
                className={
                  message.role === 'user'
                    ? 'ml-auto flex max-w-[85%] gap-2 rounded-md bg-surface-raised px-3 py-2 text-xs text-foreground'
                    : 'flex max-w-full gap-2 px-1 py-1 text-xs leading-5 text-muted'
                }
              >
                {message.role === 'user' ? <User className="mt-0.5 size-3.5 shrink-0 text-faint" /> : <Bot className="mt-0.5 size-3.5 shrink-0 text-primary" />}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex h-5 items-center gap-1.5 text-[10px] text-faint">
                    <Clock3 className="size-3" />
                    <time dateTime={new Date(message.createdAt || Date.now()).toISOString()} title={new Date(message.createdAt || Date.now()).toLocaleString()}>
                      {formatMessageTime(message.createdAt || Date.now(), language)}
                    </time>
                    {message.role === 'assistant' && message.content && (
                      <Hint label={language === 'chinese' ? '复制回复' : 'Copy response'}>
                        <button
                          type="button"
                          className="ml-auto inline-flex size-5 items-center justify-center rounded text-faint hover:bg-surface-raised hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                          aria-label={language === 'chinese' ? '复制回复' : 'Copy response'}
                          onClick={() => {
                            void navigator.clipboard.writeText(message.content);
                            toast.success(language === 'chinese' ? '回复已复制' : 'Response copied');
                          }}
                        >
                          <Copy className="size-3" />
                        </button>
                      </Hint>
                    )}
                  </div>
                  {message.tasks && message.tasks.length > 0 && (
                    <div className="mb-2 border-l border-border-subtle pl-2">
                      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-faint">{t('Task progress')}</div>
                      <ol className="flex flex-col gap-1">
                        {message.tasks.map((task: GitmdAgentTask) => (
                          <li key={task.id} className="flex items-center gap-1.5 text-[11px] text-muted">
                            <TaskStatusIcon status={task.status} />
                            <span className={task.status === 'completed' ? 'text-muted' : task.status === 'running' ? 'text-foreground' : undefined}>{task.label}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {message.content && (
                    <GitmdCodeText
                      text={message.content}
                      repoPath={repoPath}
                      knownFiles={knownFiles}
                      className={message.content.startsWith('[Error] ') ? 'text-danger' : undefined}
                    />
                  )}
                  {message.role === 'assistant' && message.usage && (
                    <div className="mt-1 text-[10px] text-faint">
                      {formatUsage(message.usage, language)}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {review && (
              <details className="rounded-md border border-border-subtle bg-surface-raised/60 px-3 py-2 text-xs" open>
                <summary className="cursor-pointer font-medium text-foreground">
                  {language === 'chinese' ? '变更审阅' : 'Review changes'} ({review.changes.length})
                </summary>
                <div className="mt-2 flex flex-col gap-2">
                  {review.changes.length > 0 && (
                    <ul className="flex flex-col gap-1 font-mono text-[11px] text-muted">
                      {review.changes.map((change) => (
                        <li key={`${change.status}-${change.path}`} className="flex min-w-0 items-center gap-2">
                          <span className="mr-2 text-primary">{change.status}</span>
                          <GitmdFileLink
                            displayPath={change.path}
                            path={change.path}
                            className="min-w-0"
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                  {review.diff && (
                    <div className="relative">
                      <Hint label={language === 'chinese' ? '复制差异' : 'Copy diff'}>
                        <button
                          type="button"
                          className="absolute right-1 top-1 inline-flex size-6 items-center justify-center rounded bg-surface-raised text-faint hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                          aria-label={language === 'chinese' ? '复制差异' : 'Copy diff'}
                          onClick={() => {
                            void navigator.clipboard.writeText(review.diff ?? '');
                            toast.success(language === 'chinese' ? '差异已复制' : 'Diff copied');
                          }}
                        >
                          <Copy className="size-3" />
                        </button>
                      </Hint>
                      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded border border-border-subtle bg-background p-2 pr-9 font-mono text-[10px] leading-4 text-muted">
                        {review.diff}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border-subtle px-3 pb-2 pt-2">
        <div className="w-full border border-border-subtle bg-surface-raised px-3 pb-2 pt-1.5 font-mono transition-[border-color,box-shadow] focus-within:border-primary/70 focus-within:shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]">
          <div className="flex min-h-[36px] items-start gap-2 pt-2">
            <span className="select-none text-base leading-5 text-primary">›</span>
            <Textarea
              ref={inputRef}
              value={draft}
              autoFocus
              rows={1}
              placeholder={t('Ask GitMD Code')}
              className="max-h-32 min-h-[24px] flex-1 resize-none overflow-y-auto border-0 bg-transparent p-0 text-[13px] leading-5 shadow-none focus-visible:ring-0"
              onChange={(event) => {
                setDraft(event.target.value);
                setSelectedCommand(0);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Tab' && event.shiftKey) {
                  event.preventDefault();
                  setAllowChanges((current) => !current);
                  return;
                }
                if (suggestions.length > 0 && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
                  event.preventDefault();
                  setSelectedCommand((current) => event.key === 'ArrowDown'
                    ? (current + 1) % suggestions.length
                    : (current - 1 + suggestions.length) % suggestions.length);
                  return;
                }
                const exactCommand = suggestions.some((suggestion) => suggestion.name === draft.trim().toLowerCase());
                if (suggestions.length > 0 && (event.key === 'Tab' || (event.key === 'Enter' && !event.shiftKey && !exactCommand)) && !/\s/.test(draft.trim())) {
                  event.preventDefault();
                  chooseSuggestion(suggestions[selectedCommand] ?? suggestions[0]);
                  return;
                }
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
            />
          </div>
          {suggestions.length > 0 && (
            <div className="mt-1 overflow-hidden rounded border border-border-subtle bg-background shadow-lg" role="listbox" aria-label="GitMD Code commands">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.name}
                  type="button"
                  role="option"
                  aria-selected={index === selectedCommand}
                  className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-[11px] ${index === selectedCommand ? 'bg-primary/10 text-foreground' : 'text-muted hover:bg-surface-raised'}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => chooseSuggestion(suggestion)}
                >
                  <span className="font-mono text-primary">{suggestion.name}</span>
                  <span>{suggestion.description}</span>
                </button>
              ))}
            </div>
          )}
          <div className="mt-1 flex min-h-6 items-center gap-2 text-[10px] text-faint">
            <span className="text-primary">●</span>
            <span>{allowChanges ? 'manual' : 'readonly'} mode</span>
            <span>·</span>
            <span>{busy ? 'working' : 'ready'}</span>
            <span>·</span>
            <button
              type="button"
              aria-pressed={allowChanges}
              className={`inline-flex h-6 items-center gap-1.5 rounded-md px-1 text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary ${allowChanges ? 'text-primary' : 'text-muted hover:text-foreground'}`}
              onClick={() => setAllowChanges((current) => !current)}
            >
              <ShieldCheck className="size-3.5" />
              {allowChanges ? t('Allow changes this turn') : (language === 'chinese' ? '只读模式' : 'Read-only mode')}
            </button>
            <span>· Shift+Tab {language === 'chinese' ? '切换模式' : 'to toggle'}</span>
            {draft.trim().startsWith('!') && <span className="text-[10px] text-warning">Shell command</span>}
            {draft.trim().startsWith('#') && <span className="text-[10px] text-primary">Session note</span>}
            {memories.length > 0 && !draft.trim().startsWith('#') && (
              <span className="text-[10px] text-faint">
                {language === 'chinese' ? `${memories.length} 条会话备注` : `${memories.length} session note${memories.length === 1 ? '' : 's'}`}
              </span>
            )}
            <Hint label={busy ? t('Stop GitMD Code') : t('Send message')}>
              <Button
                size="icon-sm"
                className="ml-auto shrink-0 rounded-full"
                variant={busy ? 'danger' : 'default'}
                aria-label={busy ? t('Stop GitMD Code') : t('Send message')}
                disabled={!busy && !draft.trim()}
                onClick={busy ? stop : () => void send()}
              >
                {busy ? <Square className="size-3 fill-current" /> : <Send className="size-3.5" />}
              </Button>
            </Hint>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
