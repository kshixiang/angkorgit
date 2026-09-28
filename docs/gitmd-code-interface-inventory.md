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
