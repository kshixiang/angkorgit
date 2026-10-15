# GitMD Code 接口清单与 AI 暴露建议

本文整理桌面端当前的 UI 调用接口、Tauri 命令和 GitMD Code 工具，回答一个问题：哪些能力适合注册给 GitMD Code 调用，应该以什么安全边界暴露。

## 结论先行

- 前端 `apps/desktop/src/core/ipc.ts` 是 UI 的调用层，当前包含 133 个方法；Tauri `commands.rs` 是这些方法对应的原生入口。
- 不应把 `ipc` 方法或所有 Tauri command 原样注册给模型。它们包含凭据、系统路径、终端进程、任意 HTTP 和任意命令等高权限能力。
- GitMD Code 已经有 40 个结构化工具：17 个只读/导航工具，23 个在 `allow_changes=true` 时才挂载的变更工具。优先继续扩展这层，而不是让模型直接调用 IPC。
- 推荐给 AI 的接口分成三层：
  1. **只读自动执行**：状态、差异、历史、文件检索、冲突读取、UI 定位。
  2. **用户已授权后执行**：写文件、暂存、提交、分支和常规同步操作。
  3. **每次明确确认或不开放**：丢弃/删除、硬重置、强制推送、凭据、密钥、任意 Shell/HTTP、安装卸载。

## 现有调用链

```text
React UI / Zustand store
        |
        v
apps/desktop/src/core/ipc.ts
        |
        v
Tauri invoke(command, args)
        |
        v
apps/desktop/src-tauri/src/commands.rs
        |
        v
packages/core + src-tauri/core/*
```

GitMD Code 的对话入口是 `gitmd_agent_chat`。它在 `src-tauri/src/gitmd_agent.rs` 中创建结构化工具，并通过 `allow_changes` 决定是否挂载变更工具。UI 导航则通过 `gitmd-ui-*` 事件回到 React 层处理。

## UI / IPC 全量清单

下表按 `ipc` 方法归类。`建议` 是针对“注册给 GitMD Code”的建议，不代表当前已经注册。

| 用户场景 | UI/IPC 方法 | 建议 |
| --- | --- | --- |
| 仓库打开与状态 | `openRepository`, `repoInfo`, `refFingerprint`, `initRepository`, `cloneRepository`, `status`, `stateCleanup`, `recentRepositories`, `removeRecent` | `repoInfo`/`status` 只读可用；`openRepository`、`cloneRepository`、`initRepository` 属于应用导航或外部路径操作，不直接开放；其余为 UI 生命周期/最近记录 |
| Git 配置 | `configGet`, `configSet` | `configGet` 仅限当前仓库且白名单 key；`configSet` 不直接开放，避免修改全局配置 |
| 文件与工作区读取 | `readFile`, `pathsExist`, `repoFiles` | 推荐；必须限制为当前仓库相对路径，并限制文件大小 |
| 文件写入与删除 | `writeFile`, `deleteFile`, `ignoreFiles`, `exportFilesPatch`, `openPath`, `revealPath` | `writeFile` 可映射到现有 `write_file`；`ignoreFiles` 可在确认后开放；`deleteFile` 每次确认；`exportFilesPatch` 更适合 UI 命令，不必给模型；`openPath`/`revealPath` 只属于 UI 系统集成 |
| 暂存区 | `stageFile`, `stageFiles`, `stageAll`, `unstageFile`, `unstageFiles`, `unstageAll`, `stageHunk`, `unstageHunk`, `stageLine`, `unstageLine` | 用现有 `stage_files`、`unstage_files`、`update_hunk` 等高层工具；不要同时暴露全部低层变体 |
| 丢弃修改 | `discardFile`, `discardAll`, `discardStagedFile`, `discardStagedAll`, `discardLine` | 高风险；只允许显式用户请求，工具描述中必须列出将丢失的路径，并在执行前确认 |
| 提交 | `commit`, `amend`, `revert` | 已有 `commit_changes`、`amend_commit`、`revert_commit`；提交消息和目标提交必须是显式参数 |
| 历史查询 | `history`, `historyPosition`, `historySearch`, `commitInfo`, `fileHistory`, `fileBlame` | 推荐；现有 `git_log`、`search_commits`、`inspect_commit`、`blame_file` 已覆盖大部分能力 |
| 分支读取与切换 | `branches`, `checkout`, `checkoutDetached` | `branches` 只读推荐；切换分支使用现有 `switch_branch`，切换前检查未提交修改；`checkoutDetached` 不直接开放 |
| 分支管理 | `createBranch`, `deleteBranch`, `renameBranch` | 现有 `manage_branch` 可承载创建/重命名；删除分支要求确认，远端分支删除默认禁止 |
| 合并、变基、拣选、重置 | `merge`, `mergeAbort`, `mergeMessage`, `mergeCanFastForward`, `rebase`, `rebaseContinue`, `rebaseAbort`, `rebaseCommits`, `rebaseInteractive`, `cherryPick`, `cherryPickMany`, `reset` | 使用现有 `merge`、`rebase`、`cherry_pick`、`reset`；`mergeCanFastForward`/`rebaseCommits` 可作为执行前检查；硬重置必须单独确认 |
| 远程读取 | `remotes` | 推荐作为只读工具或并入 `list_work_state` |
| 远程配置 | `remoteAdd`, `remoteEdit`, `remoteRemove` | 不直接开放；会改变仓库连接目标，且可能导致凭据发送到错误主机 |
| 远程同步 | `fetch`, `pull`, `push`, `pullBranch`, `pushTag`, `prCheckout` | 现有 `sync_remote` 覆盖常规 Fetch/Pull/Push；Force Push、推送 Tag、PR checkout 必须显式确认；`prCheckout` 还涉及网络和分支切换 |
| Stash | `stashes`, `stashCreate`, `stashApply`, `stashPop`, `stashDrop`, `stashFiles`, `stashRestoreFiles` | 现有 `manage_stash`；默认 Apply 而不是 Pop，Drop 需确认 |
| Tag | `tags`, `tagCreate`, `tagDelete` | 现有 `manage_tag`；创建可在用户授权后执行，删除和覆盖远程 Tag 不开放 |
| Submodule | `submodules`, `submoduleUpdate` | `submodules` 可只读开放；更新会执行网络和代码变更，建议暂不注册，或单独确认 |
| Worktree | `worktrees`, `worktreeAdd`, `worktreeRemove`, `worktreePrune` | 现有 `manage_worktree`；新增可授权，Remove/Prune/Force 必须确认 |
| Diff | `diffFile`, `diffCommit`, `commitFiles`, `commitFileDiff`, `stagedPatch` | 推荐；现有 `git_diff`、`open_file_diff`、`inspect_commit` 已覆盖常用路径 |
| 冲突 | `conflicts`, `conflictRead`, `conflictResolve` | `conflicts`/`conflictRead` 推荐；`conflictResolve` 仅在用户允许修改时开放，并返回变更摘要 |
| 终端与 GitMD Code | `termCreate`, `gitmdCodeCreate`, `gitmdAgentChat`, `gitmdAgentCancel`, `termWrite`, `termResize`, `termKill` | 这是 UI/agent 编排层，不应作为 GitMD Code 的子工具再次暴露，避免递归代理和进程控制 |
| 文件监听 | `watchRepo`, `watchStop` | UI 生命周期，不开放 |
| GitMD Memory | `gitmdMemoryRead`, `gitmdMemoryAdd`, `gitmdMemoryClear` | `gitmdMemoryRead` 可作为受限上下文读取；Add/Clear 只能通过明确的记忆指令或设置 UI，不作为通用工具 |
| 凭据与 SSH | `credentialStore`, `setCredentialPrefs`, `sshPublicKey`, `sshKeyGenerate` | 不开放；包含密码、私钥路径和密钥生成能力 |
| 托管平台账户 | `accountList`, `accountAdd`, `accountRemove`, `accountSetDefault`, `accountCheck` | 只读 `accountList` 可在明确的账户任务中使用；Token 写入、删除、设默认不开放 |
| 登录会话 | `authSessionGet`, `authSessionSet`, `authSessionRemove` | 不开放；属于应用认证状态 |
| AI 密钥与 CLI | `aiKeyGet`, `aiKeySet`, `aiKeyDelete`, `aiCliDetect`, `aiCliRun` | `aiCliDetect` 仅设置页使用；密钥和 `aiCliRun` 不开放，防止密钥泄露或代理套娃 |
| HTTP / Forge | `httpRequest`, `forgeRequest` | 不开放原始 HTTP；如需 PR 能力，应新增固定 schema 的 `list_pull_requests`/`create_pull_request`，并单独授权 |
| CLI / 编辑器 | `cliPendingOpen`, `cliStatus`, `cliInstall`, `cliUninstall`, `editorsDetect`, `editorOpen` | 应用集成和系统副作用，不开放 |

IPC 之外的 UI 辅助接口还有 `listen`、`openExternal`、`appVersion`、`pickDirectory`、`pickFile`、`saveFile`，以及 `useUi` 中的面板、对话框、文件历史、Blame、Diff、终端和 Tab 状态动作。这些动作不应作为通用 Git 工具暴露；GitMD Code 只需要通过已有 UI 工具发出“打开文件 / Diff / 历史 / Blame / 冲突 / 提交定位”请求。

## 当前已注册给 GitMD Code 的工具

实现位置：`apps/desktop/src-tauri/src/gitmd_agent.rs` 的 agent builder。

### 只读与 UI 导航（自动可用）

`git_status`, `git_diff`, `open_file_diff`, `open_file`, `open_file_history`, `open_blame`, `show_commit`, `open_conflict`, `git_log`, `list_files`, `read_file`, `search_files`, `inspect_commit`, `search_commits`, `blame_file`, `list_refs`, `list_work_state`, `read_conflict`。

其中 `open_*`/`show_commit` 是 UI 导航，不改变 Git 状态；它们通过 `gitmd-ui-open-diff` 和 `gitmd-ui-action` 事件回到 `App.tsx`，并且会检查目标仓库是否是当前打开的仓库。

### 变更工具（仅 `allow_changes=true`）

`write_file`, `stage_files`, `commit_changes`, `switch_branch`, `unstage_files`, `update_hunk`, `discard_changes`, `amend_commit`, `revert_commit`, `manage_branch`, `sync_remote`, `merge`, `rebase`, `cherry_pick`, `reset`, `manage_stash`, `manage_tag`, `manage_worktree`, `resolve_conflict`, `ignore_files`, `delete_file`, `run_git_command`, `run_shell_command`。

这里的 `run_git_command` 和 `run_shell_command` 是最大风险点。它们虽然受当前仓库根目录和 agent scope 约束，但仍然是通用执行面，不应作为默认能力；建议后续按白名单拆掉，或改成每次确认。

## 建议新增或调整的 AI 接口

### P0：先补只读聚合能力

1. `get_repository_snapshot`：一次返回 `repoInfo + status + branches + remotes + conflicts + worktrees`，减少模型为回答一个状态问题而调用多次。
2. `list_stashes`、`list_tags`、`list_submodules`：如果 `list_work_state` 没有完整返回这些信息，应增加明确的只读工具。
3. `preview_operation`：对 Pull/Merge/Rebase/Reset/Push 返回将要影响的分支、提交、文件和风险，不执行操作。

### P1：将低层写操作收敛为领域工具

1. `apply_patch`：替代模型直接拼接多次 `write_file`，输入为受限 patch，返回文件清单和失败原因。
2. `stage_paths` / `unstage_paths`：统一文件数组参数，避免暴露 file/hunk/line 三套接口。
3. `commit_changes`：保留现有工具，但增加 `expected_head` 和变更摘要校验，防止模型基于过期状态提交。
4. `sync_remote`：默认禁止 `force`，将 remote、branch、mode、tags、prune 明确结构化；执行前返回预览。

### P2：谨慎开放的产品能力

1. `create_pull_request`：只通过 GitHub/GitLab/Bitbucket provider 的固定 schema，禁止让模型调用 `httpRequest`。
2. `open_repository`：如果未来需要让 agent 切换仓库，应限制为最近仓库或用户已选路径，并在 UI 中提示，不允许任意路径。
3. `run_git_command` / `run_shell_command`：默认关闭；若保留，必须有命令白名单、超时、输出上限、无网络/无仓库外路径策略和每次确认。

## 注册规则（实现时必须满足）

- 工具参数使用仓库相对路径；拒绝绝对路径、`..`、仓库外符号链接和超大文件。
- 每个写工具都要有明确的 `allow_changes` 门槛；破坏性操作还要有单次确认，不能只依赖仓库规则文件。
- 写操作返回结构化结果：`status`、实际影响的路径/提交/分支、冲突列表和可回滚建议，而不是只返回字符串。
- 执行前优先调用只读检查（状态、当前 HEAD、目标分支、是否有冲突）；执行时校验 `expected_head`，避免过期上下文覆盖新改动。
- UI 导航工具只接受当前打开仓库，不能让模型通过事件打开任意本机路径。
- 凭据、Token、API Key、SSH 私钥、账户会话和原始 HTTP 永不进入模型工具 schema 或工具输出。
- 事件流中的 `taskStarted/taskCompleted/textDelta` 只用于 UI 展示，不作为模型可调用工具。
- 工具描述必须明确副作用和确认要求；优先使用结构化领域工具，不要让模型自己拼接 Git/Shell 命令。

## 参考实现位置

- UI IPC 封装：`apps/desktop/src/core/ipc.ts`
- Tauri command 注册：`apps/desktop/src-tauri/src/lib.rs`
- Tauri command 实现：`apps/desktop/src-tauri/src/commands.rs`
- GitMD Code 工具与安全边界：`apps/desktop/src-tauri/src/gitmd_agent.rs`
- UI 事件处理：`apps/desktop/src/app/App.tsx`
- UI 状态动作：`apps/desktop/src/features/ui/store.ts`
- Git 操作策略：`apps/desktop/src/features/terminal/gitOperationRules.ts`

## 实施计划：GitMD Code 上下文辅助

### 目标

Git 操作仍由用户在 GitMD UI 中发起和控制。GitMD Code 作为伴随式 AI 助手，自动获知用户当前操作、选中的仓库/提交/文件 Diff 和操作结果，提供解释、风险提示、摘要及下一步建议。只有用户明确要求 AI 执行修改时，才进入受控的 Agent 变更流程。

Pull、Merge、Rebase、Commit 等操作仍使用现有 UI 按钮、对话框和确认逻辑；GitMD Code 面板负责显示相关操作进度、输出解释和最终结果。目标不是让 AI 模拟用户点击，也不是移除终端面板，而是避免 AI 缺少用户正在看的上下文。

### 非目标

- 不由 Agent 自动接管或代替用户发起常规 Git 操作。
- 不通过 DOM 自动化或模拟点击来控制 UI。
- 不把所有 IPC/Tauri 命令暴露给模型。
- 不要求所有 Git 操作都必须经过 AI；AI 不可用时现有 UI 工作流必须照常工作。
- 不把 GitMD Code 终端面板等同于系统 Shell；面板仍是 AI 对话和必要命令的交互入口。

### 目标交互

1. 用户点击 Pull：现有 Pull 流程照常执行；GitMD Code 收到操作开始、所选远程/分支、策略和结果，并在面板中显示简洁状态。失败或冲突时，AI 可结合结果解释原因和可选处理方式。
2. 用户点击某个文件 Diff：GitMD Code 记录当前仓库、文件路径、工作区/暂存区状态、关联提交及最近 Git 操作等上下文；用户提问或触发分析时，先通过只读工具获取该文件的精确 Diff 和必要关联数据，再交给模型分析。用户不必复制 Diff 或重新描述背景。
3. 用户打开提交、冲突、分支或 Stash 视图：当前视图成为 AI 上下文的一部分；AI 默认只分析和建议，不自行改变 Git 状态。
4. 用户明确提出“帮我修改/暂存/提交”等请求：Agent 才生成具体变更预览，并遵循现有授权和确认边界。

### 阶段总览

| 阶段 | 重点 | 依赖 | 交付结果 | 状态 |
| --- | --- | --- | --- | --- |
| 0 | 产品边界与上下文协议 | 无 | 用户发起操作、AI 订阅上下文的类型和权限规则 | [ ] 未开始 |
| 1 | 当前 UI 上下文桥接 | 0 | 当前仓库/视图/选中对象可供 Agent 使用，并区分状态同步与模型触发 | [~] 进行中 |
| 2 | Diff 与提交上下文 | 1 | 点击 Diff/提交即获得对应数据，回答可跳回引用对象 | [~] 进行中 |
| 3 | Git 操作生命周期 | 1 | 带因果关联的 Pull 等操作参数、进度和结果进入 AI 面板 | [~] 进行中 |
| 4 | AI 辅助解释和建议 | 2、3 | 分离操作记录、AI 分析与终端输出；失败时解释但不擅自重试 | [ ] 未开始 |
| 5 | 用户明确授权的 Agent 修改 | 0-4 | 可选的修改预览、确认和执行后 Diff | [ ] 未开始 |
| 6 | 覆盖和质量保证 | 1-5 | 各主要 UI 操作均有上下文回归测试 | [ ] 未开始 |

### 阶段 0：产品边界与上下文协议

- [ ] `C0-01` 定义 `GitContextSnapshot`：仓库路径/名称、HEAD、当前分支、工作区状态、当前视图、选中提交/文件/冲突、时间戳。
- [ ] `C0-02` 定义 `GitOperationEvent`：全链路操作 ID、类型、发起来源、用户选择的意图/策略摘要、开始/结束时间、状态、结果摘要、错误和受影响对象；事件可关联到后续打开的文件/提交视图。
- [ ] `C0-03` 将“用户发起的操作”和“Agent 发起的操作”明确标记来源；第一阶段只观测并解释用户操作。
- [ ] `C0-04` 为上下文设定最小化和隐私规则：默认只发送当前对象所需数据，不把凭据、Token、密钥、认证会话送入模型。
- [ ] `C0-05` 定义上下文过期策略：仓库切换、HEAD 改变或选中对象改变后更新快照，旧结果不得冒充当前状态。
- [ ] `C0-06` 区分上下文注入和对话历史：快照是结构化、可替换的当前状态，不应无限追加进聊天历史。
- [ ] `C0-07` 定义工具优先原则：优先调用本地、只读、结构化工具取得事实，再让模型分析工具结果；限制每类任务的工具范围、调用次数和上下文 Token 预算。

**完成标准：** 类型可以区分仓库状态、当前 UI 选择、用户操作事件和 Agent 操作；安全规则明确限定数据范围及上下文有效期。

### 阶段 1：当前 UI 上下文桥接

- [x] `C1-01` 从 `useRepo`、`useUi` 和 Commit Graph 汇总当前仓库、分支、视图、选中文件/提交/冲突，提供统一只读上下文接口。
- [x] `C1-02` 用户切换仓库、分支、Tab、视图或选中对象时，更新 GitMD Code 当前上下文。
- [ ] `C1-03` 明确区分“上下文更新”和“请求模型分析”：选中对象变化默认只同步上下文，不自动调用模型；由用户提问/点击分析动作触发，少数高价值事件的主动分析由单独策略控制。
- [x] `C1-04` 在 Agent 请求中携带结构化快照，而不是仅依靠 prompt 中拼接自然语言描述。
- [ ] `C1-05` 处理仓库关闭、切换和面板重开，确保不会把上一个仓库的数据留给当前会话。
- [ ] `C1-06` 在 GitMD Code 面板明确显示当前关联上下文，允许用户查看和清除；仓库切换时立即替换旧快照。

**完成标准：** 用户切换到另一仓库或视图后，Agent 请求使用新的上下文；不需要用户手工告诉 AI 当前打开了什么。

### 阶段 2：Diff 与提交上下文

- [x] `C2-01` 用户选中工作区/暂存区文件 Diff 时，记录仓库、文件路径、暂存状态和工作区状态，并保留获取精确 Diff 所需的对象引用；未触发分析前不额外将完整 Diff 发给模型。
- [x] `C2-02` 用户查看 Commit Diff 时，采集提交 OID、父提交、提交消息、变更文件和当前文件 Diff。
- [ ] `C2-03` 打开文件历史或 Blame 时，采集文件路径、目标 revision 和当前定位行（若有）。
- [ ] `C2-04` 点击冲突文件时，采集冲突阶段、冲突文件内容和冲突块摘要；默认不上传无关文件。
- [x] `C2-05` 在 GitMD Code 面板显示当前关联对象，例如“正在查看 `src/foo.ts` 的工作区 Diff”，并允许用户针对它提问。
- [ ] `C2-06` Diff 太大时按预算截断或摘要，并明确告诉模型和用户数据被截断；不得静默丢掉关键部分。
- [ ] `C2-07` AI 回答中的文件、提交、冲突引用使用结构化目标；用户点击引用可跳转到对应 Diff、提交详情或冲突解决器。
- [x] `C2-08` 用户请求分析后，按当前对象调用只读工具（如 `diff_file`、`diff_commit_file`、`history_file`、`file_blame`、`conflict_read`）获取原始事实，再将结果交给模型；不得把整仓库文件或历史无差别塞进请求。
- [x] `C2-09` 对工具结果做字段筛选、去重和预算控制：优先传当前文件/提交/冲突所需内容，保留路径、OID、状态和截断标记等可核验来源信息。

**完成标准：** 用户点开一个文件 Diff 后可以直接问“这段改动有什么风险”；系统先调用对应只读工具取回当前文件 Diff，再让 AI 分析，并能引用当前文件和 Diff，而不是泛化的仓库状态。

### 阶段 3：Git 操作生命周期

- [ ] `C3-01` 在现有 `ipc` 操作入口或统一操作服务记录 Pull/Fetch/Push/Commit/Merge/Rebase/Checkout 等开始事件。
- [ ] `C3-02` 操作事件携带 UI 实际选择的远程、分支、同步策略、是否 prune/tags 等非敏感参数。
- [ ] `C3-03` 操作完成后记录结果：成功状态、更新前后 HEAD、ahead/behind 变化、冲突、受影响文件和错误类别。
- [ ] `C3-04` 对长操作提供进度事件；取消、失败和冲突暂停均有明确终态。
- [ ] `C3-05` 将事件推送至 GitMD Code 面板，形成可折叠的操作记录；不要求模型调用工具来重放这次操作。
- [ ] `C3-06` Pull/Merge/Rebase 失败或产生冲突时，将实际错误和仓库状态快照一并提供给 AI 分析。
- [ ] `C3-07` 从 UI 操作入口贯穿传递 `operationId`，关联开始、进度、完成、错误及随后查看的 Diff；并在每个事件上校验 repoPath、HEAD 和时间戳，过期事件标为历史记录。
- [ ] `C3-08` 记录用户实际选择的操作意图和参数（例如 Pull 的 remote、branch、merge/rebase 策略），让 AI 解释真实发生的操作，而不是根据命令名猜测。

**完成标准：** 用户点击 Pull 后，面板能够显示本次 Pull 的参数摘要和结果；若失败，用户可以直接追问，AI 不需要猜测刚才执行了什么。

### 阶段 4：AI 辅助解释和建议

- [ ] `C4-01` 为当前 Diff 提供“解释改动 / 风险检查 / 生成测试建议”等上下文动作。
- [ ] `C4-02` 为 Pull/Push/Merge/Rebase 结果提供摘要和失败解释，不自动重试或改变策略。
- [ ] `C4-03` 操作完成后只在高价值场景主动提示，例如冲突、非快进、提交数变化或明显失败；普通成功不打断用户。
- [ ] `C4-04` 回答中关联可导航目标：文件 Diff、提交、冲突文件或分支；复用现有 UI action 事件。
- [ ] `C4-05` 明确标注观察事实、AI 推断和建议，避免把推断描述成 Git 操作实际结果。
- [ ] `C4-06` 用户可以清除当前上下文/会话，避免之前仓库内容残留在后续提问中。
- [ ] `C4-07` 操作记录、AI 分析和原始终端/Shell 输出分开展示和标识；保留必要的终端入口，但不把原始命令输出混成 Git 操作事实或 AI 结论。
- [ ] `C4-08` 对 Pull 等操作失败，只解释错误、给出可选方案并链接到相关 UI；未经用户明确选择不自动重试、不切换策略、不继续执行。
- [ ] `C4-09` 定义操作记录与上下文的保留/清理范围，提供按会话清除入口；切仓库后不把前一个仓库内容带入新请求。
- [x] `C4-10` 实现“先取证、后分析”流程：根据当前对象选择有限的只读工具，等待工具完成并校验结果后，再发起模型分析；简单、确定的问题可直接基于已存在的操作结果，不重复采集。
- [ ] `C4-11` 对需要多步调查的问题采用渐进式取数：先取状态/摘要，发现具体目标后再取文件 Diff、提交详情或 Blame；只有首轮结果不足以回答时才追加工具调用，避免多轮模型工具调用和大上下文。
- [ ] `C4-12` 在面板中区分工具取回的事实和模型结论，并可查看本次分析使用了哪些数据源；模型请求只带本轮必要结果，不重复注入整段历史或旧 Diff。

**完成标准：** AI 分析前先取得必要的只读工具结果，再结合刚发生的操作和当前可见 Diff 作答；未经用户明确请求不会调用变更工具，也不会把无关仓库内容送入模型。

### 阶段 5：用户明确授权的 Agent 修改

- [ ] `C5-01` 只有用户明确提出修改或执行请求时，才开放本轮对应的 Agent 变更能力。
- [ ] `C5-02` Agent 修改文件后自动刷新并打开相关 Diff，AI 说明修改了什么，用户可在现有界面检查。
- [ ] `C5-03` 暂存、提交、分支、远程同步等仍复用已有领域操作和确认 UI，不通过 Shell 绕开 UI 规则。
- [ ] `C5-04` 提交等不可轻易撤销的动作展示明确预览，并校验执行前的 HEAD/工作区状态未变化。
- [ ] `C5-05` 丢弃、删除、Hard Reset、Force Push 等每次单独确认；仓库规则文件不得取消确认要求。
- [ ] `C5-06` 默认关闭通用 `run_git_command`/`run_shell_command`；确需使用时展示命令、原因、工作目录并要求用户确认。

**完成标准：** 用户可以选择让 AI 代办，但用户主动操作仍是默认路径；Agent 的每个写入和 Git 副作用可见、可审查、可取消或有明确结果。

### 阶段 6：覆盖和质量保证

- [ ] `C6-01` 为上下文快照和事件 schema 增加 Rust/TypeScript 单元测试及序列化兼容测试。
- [ ] `C6-02` 覆盖切仓库、切分支、选 Diff、选 Commit、开冲突、关闭面板等上下文更新与清理场景。
- [ ] `C6-03` 覆盖 Pull 成功、无更新、网络失败、认证失败、冲突和取消的事件顺序。
- [ ] `C6-04` 增加端到端流程：点击文件 Diff 后提问，验证 Agent 收到正确文件和 Diff 上下文。
- [ ] `C6-05` 增加端到端流程：点击 Pull 后看到操作摘要/结果，并可追问错误原因。
- [ ] `C6-06` 验证 AI 服务不可用时，所有现有 Git UI 操作均不受影响。
- [ ] `C6-07` 更新用户文档，说明 AI 上下文包含哪些当前仓库信息、如何清除，以及哪些请求会让 Agent 执行修改。
- [ ] `C6-08` 覆盖快速切仓库/连续操作/迟到事件/HEAD 变化等竞态，验证旧操作结果不会覆盖或污染当前上下文。
- [ ] `C6-09` 验证 AI 引用点击能准确跳转，并验证操作记录、模型回答与终端原始输出在 UI 中可区分。
- [ ] `C6-10` 验证会话清除、仓库切换和面板重开后的上下文保留策略符合隐私约定。
- [ ] `C6-11` 覆盖工具先于模型的调用顺序、工具失败/超时/空结果、过期结果拒绝和渐进追加取数策略。
- [ ] `C6-12` 为代表性任务记录上下文 Token 预算，验证单文件 Diff 分析、Pull 失败解释和提交审查不会携带无关仓库内容。

**完成标准：** 主流 UI 操作都能更新正确上下文；Git 操作不依赖 AI 在线；Agent 不会因过期上下文误读仓库或自动执行用户未授权的变更。

### 当前实现记录

- 已完成首批垂直切片：上下文随 UI 选择更新、GitMD Code 面板显示当前上下文、请求时获取有界只读证据；提交 Diff 另附提交信息、父提交和变更文件清单。
- 已开始 Git 操作生命周期：Fetch/Pull/Push 记录开始与成功/失败结果，并在面板显示；用户可主动把单条记录带入提问。Commit/Merge/Rebase/Checkout、HEAD 前后状态、进度和竞态关联仍未覆盖。
- 尚未完成：C1-06 的独立上下文清除/查看控件，C2-03 的 Blame 定位行、C2-04 的冲突 stage/冲突块摘要，以及 C3 的全操作覆盖和 operationId 全链路关联。

### 后续跟进规则

- 每完成一个任务，将对应 `[ ]` 改为 `[x]`，并在任务后补充 PR 或提交链接。
- 若上下文协议或隐私边界改变，先更新阶段 0，再同步实现和测试。
- 每个阶段完成时补充至少一个用户可见验收场景，确保上下文真正到达 AI 并改善交互。
- 新增 Agent 工具时，区分“提供上下文的只读能力”和“执行变更的能力”，并更新前面的接口清单。
