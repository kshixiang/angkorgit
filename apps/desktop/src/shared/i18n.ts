import { useCallback } from 'react';
import { useSettings } from '@/features/settings/store';

export type UiLanguage = 'english' | 'chinese';

const ZH: Record<string, string> = {
  Settings: '设置',
  Appearance: '外观',
  'Theme, accent color, zoom and motion': '主题、强调色、缩放和动画',
  Git: 'Git',
  'Auto fetch, pull requests, identity and profiles': '自动 Fetch、Pull Request、身份和配置档案',
  Authentication: '认证',
  'AI Assistant': 'AI 助手',
  'GitMD Code': 'GitMD Code',
  'Open GitMD Code': '打开 GitMD Code',
  'GitMD Code settings': 'GitMD Code 设置',
  'New conversation': '新建对话',
  'Close GitMD Code': '关闭 GitMD Code',
  'Ask about this repository': '询问有关此仓库的问题',
  'Ask GitMD Code': '询问 GitMD Code',
  'Ask AI': '询问 AI',
  'Ask about the attached files': '询问已关联的文件',
  'Attached files': '关联文件',
  'Remove attached file': '移除关联文件',
  'Allow changes this turn': '允许本轮修改',
  'Read-only mode': '只读模式',
  'Keep edit mode': '保持修改模式',
  'Edit this turn': '仅本次修改',
  'Send as read-only': '仍以只读发送',
  'This request needs edit mode': '当前是只读模式。这条内容需要修改仓库，要切换到修改模式吗？',
  'Edit mode stays on until you switch it off.': '保持修改模式后，之后的消息会直接修改，直到你切回只读。',
  'Send message': '发送消息',
  'Stop GitMD Code': '停止 GitMD Code',
  'Working...': '处理中…',
  'Analyze request': '分析请求',
  'Generate response': '生成回复',
  'Task progress': '任务进度',
  Model: '模型',
  optional: '可选',
  'GitMD Code and message style': 'GitMD Code 和消息样式',
  Shortcuts: '快捷键',
  'Keyboard reference': '键盘快捷键参考',
  'Interface language': '界面语言',
  Chinese: '中文',
  English: 'English',
  Theme: '主题',
  'Accent color': '强调色',
  Zoom: '缩放',
  'Reduce motion': '减少动画',
  'Minimize animations across the app': '减少应用中的动画效果',
  Changes: '变更',
  Staged: '已暂存',
  Conflicts: '冲突',
  Resolve: '解决',
  'Stage all': '全部暂存',
  'Stage selected files': '暂存选中的文件',
  'Unstage all': '全部取消暂存',
  'Working tree clean.': '工作区干净。',
  'Nothing staged yet.': '尚未暂存文件。',
  'No changes match the filter.': '没有符合筛选条件的变更。',
  'No staged files match the filter.': '没有已暂存文件符合筛选。',
  'Changed files': '已变更文件',
  'Filter changed files…': '筛选已变更文件…',
  Pull: '拉取',
  Push: '推送',
  'Force push': '强制推送',
  'Push with tags': '推送并包含标签',
  'Fetch tags': '获取标签',
  'Create branch': '创建分支',
  'Create tag': '创建标签',
  'Stash changes': '贮藏变更',
  'Pop latest stash': '恢复最近的贮藏',
  'Command palette': '命令面板',
  Terminal: '终端',
  Refresh: '刷新',
  Clean: '干净',
  'Create Pull Request': '创建拉取请求',
  'UI zoom': '界面缩放',
  'Check for updates': '检查更新',
  'Everyday Git, made delightful.': '让日常 Git 更轻松。',
  'Open repository': '打开仓库',
  'Browse for a local folder': '浏览本地文件夹',
  'Clone repository': '克隆仓库',
  'From a remote URL': '从远程 URL 获取',
  'Recent repositories': '最近的仓库',
  'Search recent repositories': '搜索最近的仓库',
  Open: '打开',
  Clone: '克隆',
  'No repositories match': '没有匹配的仓库',
  'folder missing': '文件夹不存在',
  'Copy path': '复制路径',
  'Remove from recents': '从最近记录中移除',
  'Back to repositories': '返回仓库列表',
  Home: '首页',
  'Show sidebar': '显示侧栏',
  'Hide sidebar': '隐藏侧栏',
  Fetch: '获取',
  Inspector: '检查器',
  'Working copy': '工作区',
  'Branches and refs': '分支和引用',
  'Filter refs…': '筛选引用…',
  Branches: '分支',
  Worktrees: '工作树',
  Remotes: '远程',
  Tags: '标签',
  Stashes: '贮藏',
  'Commit history': '提交历史',
  'Search commits…': '搜索提交…',
  'Filter author…': '筛选作者…',
  'Commit not found': '未找到提交',
  'Show in graph': '在图谱中显示',
  'Lane color band': '泳道色带',
  'Branch / tag': '分支 / 标签',
  Message: '消息',
  'Branches and tags': '分支和标签',
  'Commit message': '提交说明',
  Author: '作者',
  Hash: '哈希',
  Date: '日期',
  'Language used throughout the app.': '应用的显示语言。',

  'Cancel': '取消',

  'Confirm': '确认',

  'Close': '关闭',

  'Delete': '删除',

  'Copy': '复制',

  'Apply': '应用',

  'Clear': '清除',

  'Save': '保存',

  'Create': '创建',

  'Rename': '重命名',

  'Retry': '重试',

  'Install': '安装',

  'Uninstall': '卸载',

  'Off': '关闭',

  'Name': '名称',

  'Email': '邮箱',

  'URL': 'URL',

  'Host': '主机',

  'Token': '令牌',

  'Provider': '服务商',

  'Accounts': '账户',

  'Label': '标签',

  'Branch': '分支',

  'Folder': '文件夹',

  'Title': '标题',

  'Graph': '图谱',

  'Commits': '提交',

  'Diff': '差异',

  'Blame': '追溯',

  'Profile': '配置档案',

  'Repositories': '仓库',

  'Submodules': '子模块',

  'Worktree': '工作树',

  'Account': '账户',

  'Password': '密码',

  'Pop': '弹出',

  'Amend': '修订',

  'Stash': '贮藏',

  'HEAD': 'HEAD',

  'Draft': '草稿',

  'Loading…': '加载中…',

  'Writing…': '撰写中…',

  'default': '默认',

  'remote': '远程',

  'unsaved': '未保存',

  'current': '当前',

  'incoming': '传入',

  'Result': '结果',

  'Reset': '重置',

  'Leave': '离开',

  'Use': '使用',

  'Clone repository…': '克隆仓库…',

  'Open repository…': '打开仓库…',

  'Create branch…': '创建分支…',

  'Create tag…': '创建标签…',

  'Stash changes…': '贮藏变更…',

  'File history…': '文件历史…',

  'Blame…': '追溯…',

  'New worktree…': '新建工作树…',

  'Rename…': '重命名…',

  'No results.': '没有结果。',

  'Loading files…': '正在加载文件…',

  'Could not list files.': '无法列出文件。',

  'Pull with rebase': '拉取并变基',

  'Continue rebase': '继续变基',

  'Abort rebase': '中止变基',

  'Abort merge': '中止合并',

  'Clear repository state': '清除仓库状态',

  'Toggle terminal': '切换终端',

  'Collapse sidebar sections': '折叠侧栏分组',

  'Zoom in': '放大',

  'Zoom out': '缩小',

  'Install command line tool': '安装命令行工具',

  'Switch repository': '切换仓库',

  'Undo': '撤销',

  'Redo': '重做',

  'Pull options': '拉取选项',

  'Push options': '推送选项',

  'Editor options': '编辑器选项',

  'Open another repository': '打开另一个仓库',

  'No repositories yet': '还没有仓库',

  'This folder no longer exists. Remove it from recents or open it from its new location.': '此文件夹已不存在。请从最近记录中移除，或从新位置打开。',

  'Path copied': '路径已复制',

  'URL copied': 'URL 已复制',

  'Name copied': '名称已复制',

  'Hash copied': '哈希已复制',

  'Commit hash copied': '提交哈希已复制',

  'Copied': '已复制',

  'Could not copy': '无法复制',

  'Line copied': '已复制该行',

  'Public key copied — paste it into your host': '公钥已复制，请粘贴到你的托管平台',

  'Command line tool removed': '命令行工具已移除',

  'Git identity saved': 'Git 身份已保存',

  'Repository cloned': '仓库已克隆',

  'Patch saved': '补丁已保存',

  'Commit amended': '提交已修订',

  'Rebase aborted': '变基已中止',

  'State cleared': '状态已清除',

  'Interactive rebase done': '交互式变基已完成',

  'No refs match the filter.': '没有引用符合筛选。',

  'No worktrees match the filter.': '没有工作树符合筛选。',

  'Click to retry': '点击重试',

  'New worktree': '新建工作树',

  'Add remote': '添加远程',

  'New tag': '新建标签',

  'Open as repository': '作为仓库打开',

  'Update (checkout recorded commit)': '更新（检出记录的提交）',

  'Checkout': '检出',

  'Open in browser': '在浏览器中打开',

  'Copy URL': '复制 URL',

  'Checkout (detached)': '检出（分离 HEAD）',

  'Push to remote': '推送到远程',

  'Forget missing worktree': '忘记缺失的工作树',

  'Remove worktree…': '移除工作树…',

  'Edit remote…': '编辑远程…',

  'Remove remote…': '移除远程…',

  'Open in new worktree…': '在新工作树中打开…',

  'Merge into current': '合并到当前分支',

  'Fast-forward current to this': '将当前分支快进到此',

  'Rebase current onto this': '将当前分支变基到此',

  'Create branch here…': '在此创建分支…',

  'Moves the branch pointer without creating a merge commit': '移动分支指针，不创建合并提交',

  'Main worktree': '主工作树',

  'Locked': '已锁定',

  'Folder missing': '文件夹缺失',

  'Uncommitted changes': '未提交的变更',

  'Collapse all sections': '折叠所有分组',

  'New branch': '新建分支',

  'Forget worktrees whose folder is gone': '忘记文件夹已消失的工作树',

  'Prune missing worktrees': '清理缺失的工作树',

  'Two branches, two folders': '两个分支，两个文件夹',

  'Fix a bug or run an agent beside your work. No stashing.': '在当前工作旁边修 bug 或运行助手，无需贮藏。',

  'Refresh pull requests': '刷新拉取请求',

  'Create pull request': '创建拉取请求',

  'No remotes': '没有远程',

  'This repository lives only on this machine. Add a remote to push, pull and open pull requests.': '这个仓库只在本机。添加远程后才能推送、拉取和创建拉取请求。',

  'No tags yet': '还没有标签',

  'Mark releases and milestones so they stand out in the graph.': '标记版本和里程碑，让它们在图谱中更显眼。',

  'New stash': '新建贮藏',

  'Nothing stashed': '没有贮藏',

  'Set changes aside without committing, then pop them back later.': '先把变更放在一边，不必提交，之后再弹回来。',

  'Stash actions': '贮藏操作',

  'Unstage file': '取消暂存文件',

  'Discard changes…': '丢弃变更…',

  'Stage file': '暂存文件',

  'Stash this file…': '贮藏此文件…',

  'Edit file': '编辑文件',

  'File history': '文件历史',

  'Open in external app': '用外部程序打开',

  'Copy absolute path': '复制绝对路径',

  'Delete file…': '删除文件…',

  'Discard all changes in folder…': '丢弃文件夹中的全部变更…',

  'Stash folder…': '贮藏文件夹…',

  'Create patch from changes in directory…': '从目录变更创建补丁…',

  'Open folder': '打开文件夹',

  'Create a file in this folder': '在此文件夹中创建文件',

  'Amend last commit…': '修订上一次提交…',

  'AI review': 'AI 审查',

  'Discard all changes': '丢弃全部变更',

  'Discard all staged changes': '丢弃全部已暂存变更',

  'Resize commit box': '调整提交框大小',

  'Drag to resize · double-click to reset': '拖动调整大小，双击重置',

  'Stop the review': '停止审查',

  'Stop the AI review': '停止 AI 审查',

  'Open review in full view': '在完整视图中打开审查',

  'Open AI review in full view': '在完整视图中打开 AI 审查',

  'Dismiss review': '关闭审查',

  'Dismiss AI review': '关闭 AI 审查',

  'Commit summary': '提交摘要',

  'Summary length (50 recommended, 72 max)': '摘要长度（建议 50，最多 72）',

  'Commit description': '提交说明',

  'Review staged changes with AI before committing': '提交前用 AI 审查已暂存的变更',

  'Reset the working copy to the state before the merge started': '把工作区恢复到合并开始前的状态',

  'Generate message with GitMD Code': '用 GitMD Code 生成说明',

  'Stop generating': '停止生成',

  'Generate a description with AI': '用 AI 生成描述',

  'Copy full hash': '复制完整哈希',

  'Apply stash (keep it)': '应用贮藏（保留）',

  'Pop stash': '弹出贮藏',

  'Drop stash…': '丢弃贮藏…',

  'Merge into current branch': '合并到当前分支',

  'Fast-forward current branch to this': '将当前分支快进到此',

  'Rebase current branch onto this': '将当前分支变基到此',

  'Copy name': '复制名称',

  'Checkout commit (detached)': '检出提交（分离 HEAD）',

  'Create tag here…': '在此创建标签…',

  'New worktree from here…': '从此处新建工作树…',

  'Cherry-pick onto current branch…': '拣选到当前分支…',

  'Revert commit': '还原提交',

  'Interactively rebase onto here…': '在此开始交互式变基…',

  'Reset here (soft)': '重置到此处（soft）',

  'Reset here (mixed)': '重置到此处（mixed）',

  'Reset here (hard)': '重置到此处（hard）',

  'Previous match (Shift+Enter)': '上一个匹配（Shift+Enter）',

  'Previous match': '上一个匹配',

  'Next match (Enter)': '下一个匹配（Enter）',

  'Next match': '下一个匹配',

  'Clear branch filter': '清除分支筛选',

  'Graph display': '图谱显示',

  'Graph display options': '图谱显示选项',

  'Clear filters': '清除筛选',

  'Back to graph': '返回图谱',

  'Previous change': '上一处变更',

  'Next change': '下一处变更',

  'Previous file': '上一个文件',

  'Next file': '下一个文件',

  'Unstage hunk': '取消暂存此块',

  'Stage hunk': '暂存此块',

  'No diff to show — the change may already be staged or resolved.': '没有可显示的差异。变更可能已经暂存或已解决。',

  'Unstage this line': '取消暂存此行',

  'Stage this line': '暂存此行',

  'Discard this line…': '丢弃此行…',

  'Copy line': '复制此行',

  'Select all': '全选',

  'Close diff': '关闭差异',

  'Inline diff': '行内差异',

  'Side-by-side diff': '并排差异',

  'Toggle word diff': '切换单词差异',

  'Toggle line wrapping': '切换自动换行',

  'Toggle whole file view': '切换整个文件视图',

  'Word diff on': '单词差异：开',

  'Word diff off': '单词差异：关',

  'Lines wrapped — click for horizontal scroll': '已自动换行，点击改为横向滚动',

  'Wrap long lines': '长行自动换行',

  'Whole file shown — click for changes only': '正在显示整个文件，点击只看变更',

  'Show whole file': '显示整个文件',

  'Before': '之前',

  'After': '之后',

  'Image contents unavailable': '无法显示图片内容',

  'Binary file — no text diff': '二进制文件，没有文本差异',

  'No changes': '没有变更',

  'Change overview — click to jump, drag to scroll': '变更概览：点击跳转，拖动滚动',

  'Find in diff…': '在差异中查找…',

  'Match case': '区分大小写',

  'Previous match (⇧↩)': '上一个匹配（⇧↩）',

  'Next match (↩)': '下一个匹配（↩）',

  'Close search': '关闭搜索',

  'Close editor': '关闭编辑器',

  'Close file history': '关闭文件历史',

  'Close terminal': '关闭终端',

  'Diff view': '差异视图',

  'Blame view': '追溯视图',

  'Open this commit in the graph with all its files': '在图谱中打开此提交及其全部文件',

  'Open commit with all its files': '打开提交及其全部文件',

  'No commits touch this file on the current branch.': '当前分支上没有提交改过这个文件。',

  'The file as it is on disk right now': '磁盘上现在的文件内容',

  'Blame at this commit': '追溯到此提交',

  'Blame before this commit': '追溯到此提交之前',

  'Copy hash': '复制哈希',

  'Flat list': '平铺列表',

  'Flat file list': '平铺文件列表',

  'Folder tree': '文件夹树',

  'Back to working copy': '返回工作区',

  'Hide file filter': '隐藏文件筛选',

  'Filter files': '筛选文件',

  'Filter files…': '筛选文件…',

  'No files match the filter.': '没有文件符合筛选。',

  'Commit files': '提交中的文件',

  'Show this commit': '显示此提交',

  'Explain with AI': '用 AI 解释',

  'Stop explaining': '停止解释',

  'AI explanation': 'AI 解释',

  'Open explanation in full view': '在完整视图中打开解释',

  'Open AI explanation in full view': '在完整视图中打开 AI 解释',

  'Copy commit hash': '复制提交哈希',

  'This is a stash. Tick files to apply only those to the working copy.': '这是一个贮藏。勾选文件后，只会把这些文件应用到工作区。',

  'Apply this file to the working copy': '把此文件应用到工作区',

  'Something went wrong': '出了点问题',

  'Clear filter': '清除筛选',

  'Sign out': '退出登录',

  'Enter verification code': '输入验证码',

  'Enter code': '输入验证码',

  'Resend verification code': '重新发送验证码',

  'Back to sign in': '返回登录',

  'Display name': '显示名称',

  'Create account': '创建账户',

  'Forgot password?': '忘记密码？',

  'Into repository': '目标仓库',

  'Target repository': '目标仓库',

  'Target branch': '目标分支',

  'Description (optional)': '描述（可选）',

  'Create as draft': '创建为草稿',

  'Loading members…': '正在加载成员…',

  'Resolve conflicts': '解决冲突',

  'Write the result and mark the file resolved': '写入结果并标记文件已解决',

  'edited by hand': '已手动编辑',

  'markers remain': '仍有冲突标记',

  'Discard the hand edit and rebuild from the checkboxes': '放弃手动编辑，按勾选重新生成',

  'Discard the hand edit for this conflict': '放弃此冲突的手动编辑',

  'Hand-edited result for this conflict': '此冲突的手动编辑结果',

  'Unresolved conflict — click to edit the result, or pick lines above': '未解决的冲突。点击编辑结果，或在上方选择行。',

  'Explain this conflict with AI': '用 AI 解释此冲突',

  'Previous conflicted file': '上一个冲突文件',

  'Next conflicted file': '下一个冲突文件',

  'Take all lines from side A': '采用 A 侧的全部行',

  'Take all lines from side B': '采用 B 侧的全部行',

  'Previous conflict (↑)': '上一个冲突（↑）',

  'Previous conflict': '上一个冲突',

  'Next conflict (↓)': '下一个冲突（↓）',

  'Next conflict': '下一个冲突',

  'Edit the whole result by hand': '手动编辑整个结果',

  'Edit output by hand': '手动编辑输出',

  'Discard the hand-written result and rebuild from the checkboxes': '放弃手写结果，按勾选重新生成',

  'Reset manual edits': '重置手动编辑',

  'Clear every pick and start over': '清除所有选择并重新开始',

  'Resolved file content (editable)': '已解决的文件内容（可编辑）',

  'GitMD Code commands': 'GitMD Code 命令',

  'Shell command': 'Shell 命令',

  'Session note': '会话备注',

  'Open file diff in GitMD': '在 GitMD 中打开文件差异',

  'Open link': '打开链接',

  'Search commit in GitMD': '在 GitMD 中搜索提交',

  'Copy code': '复制代码',

  'Copy code block': '复制代码块',

  'Copy response': '复制回复',

  'Existing branch': '已有分支',

  'Branch name': '分支名称',

  'Every branch is already checked out somewhere.': '每个分支都已经在某处检出。',

  'Branches already open in a worktree are not listed; git allows one folder per branch.': '已在工作树中打开的分支不会列出。Git 允许每个分支只对应一个文件夹。',

  'Created next to the repository by default. The folder must not exist yet.': '默认创建在仓库旁边。该文件夹必须尚不存在。',

  'Open it in a new tab': '在新标签页中打开',

  'Choose a branch': '选择分支',

  'Browse for a parent folder': '浏览父文件夹',

  'Interactive rebase': '交互式变基',

  'No commits to rebase above this point.': '此位置之上没有可变基的提交。',

  'Rebase plan': '变基计划',

  'Drag to reorder': '拖动以调整顺序',

  'Combined message (optional)': '合并后的说明（可选）',

  'Could not check (offline?)': '无法检查（是否离线？）',

  'Token missing from the keychain': '钥匙串中没有令牌',

  'Not verified': '未验证',

  'Token expired or revoked': '令牌已过期或已撤销',

  'Token expired': '令牌已过期',

  'Add account': '添加账户',

  'Could not load accounts.': '无法加载账户。',

  'Reconnect': '重新连接',

  'Reconnect with a new token…': '用新令牌重新连接…',

  'Remove account…': '移除账户…',

  'Paste the token': '粘贴令牌',

  'Other host': '其他主机',

  'GitLab (self-hosted)': 'GitLab（自建）',

  'SSH': 'SSH',

  'Use the SSH agent': '使用 SSH agent',

  'Private key': '私钥',

  'Browse for a key': '浏览密钥',

  'Browse for a private key': '浏览私钥',

  'Show public key': '显示公钥',

  'Generate a key': '生成密钥',

  'Copy public key': '复制公钥',

  'System credential helper': '系统凭据助手',

  'API Key': 'API Key',

  'Base URL': 'Base URL',

  'Start each turn with fresh context': '每轮使用全新上下文',

  'Do not send earlier messages to the model. This saves tokens while user and Git rules are still included every turn.': '不发送之前的问答，可显著减少 token；用户规则和 Git 规则仍会每轮注入。',

  'Commit message style': '提交说明样式',

  'Your convention, in plain words': '用自己的话描述约定',

  'Add rule': '添加规则',

  'Remove rule': '移除规则',

  'Branch matches': '分支匹配',

  'Message starts with': '说明开头',

  'messages get no prefix, no rule matches': '没有规则匹配，说明不加前缀',

  'Clone destination': '克隆位置',

  'Choose folder': '选择文件夹',

  'Not set — the dialog asks for a folder each time': '未设置。每次克隆都会询问文件夹',

  'Command line tool': '命令行工具',

  'External editor': '外部编辑器',

  'Scan again': '重新扫描',

  'No editor found': '未找到编辑器',

  'In use': '使用中',

  'AI review conventions': 'AI 审查约定',

  'Reset zoom': '重置缩放',

  'Auto fetch': '自动获取',

  'Every minute': '每分钟',

  'Every 5 minutes': '每 5 分钟',

  'Every 15 minutes': '每 15 分钟',

  'Pull requests': '拉取请求',

  'Identity for this repository': '此仓库的身份',

  'Global identity': '全局身份',

  'Save identity': '保存身份',

  'Profiles': '配置档案',

  'No profiles yet': '还没有配置档案',

  'New profile': '新建配置档案',

  'Add profile': '添加配置档案',

  'In use here': '此处使用中',

  'Use for this repo': '用于此仓库',

  'Use as global identity': '用作全局身份',

  'Remove profile…': '移除配置档案…',

  'Linked accounts': '关联的账户',

  'Tried first for their host': '访问对应主机时优先使用',

  'Link hosting accounts to the profile after adding it.': '添加后，可以把托管账户关联到这个配置档案。',

  'AI response language': 'AI 回复语言',

  'AI response detail': 'AI 回复详细程度',

  'Keyboard shortcuts': '键盘快捷键',

  'Concise': '简洁',

  'Balanced': '均衡',

  'Detailed': '详细',

  'Conventional commits': '约定式提交',

  'Plain summary': '普通摘要',

  'Custom instructions': '自定义说明',

  'Lead with the answer. Use only the key facts and next step.': '先给结论，只保留关键事实和下一步。',

  'Give the answer with the necessary context, evidence and next step.': '给出结论，并带上必要的上下文、依据和下一步。',

  'Include background, reasoning, steps, trade-offs and risks when useful.': '在有帮助时补充背景、推理、步骤、取舍和风险。',

  'type(scope): summary — feat, fix, refactor…': 'type(scope): 摘要 — feat、fix、refactor…',

  'Imperative one-liner, no type prefix': '一句祈使句，不加类型前缀',

  'Describe your team convention in your own words': '用自己的话描述团队约定',

  'GitMD Dark': 'GitMD 深色',

  'GitMD Light': 'GitMD 浅色',

  'GitMD Dusk': 'GitMD 暮色',

  'GitMD Dawn': 'GitMD 晨光',

  'Temple Gold': '寺庙金',

  'Jade': '翡翠',

  'Sapphire': '蓝宝石',

  'Lotus': '莲花',

  'Crimson': '绯红',

  'modified': '已修改',

  'added': '已添加',

  'deleted': '已删除',

  'renamed': '已重命名',

  'Rebase in progress': '正在变基',

  'Merge in progress': '正在合并',

  'Cherry-pick in progress': '正在拣选',

  'Revert in progress': '正在还原',

  'Bisect in progress': '正在二分查找',

  'Abort rebase?': '中止变基？',

  'This rewinds the branch to where it was before the rebase started. Commits made during the rebase are discarded.': '分支会回到变基开始前的位置。变基期间产生的提交会被丢弃。',

  'Clear state': '清除状态',

  'Discard': '丢弃',

  'Discard all': '全部丢弃',

  'Discard changes?': '丢弃变更？',

  'Every unstaged change will be reverted and untracked files will be deleted. This cannot be undone — not even with ⌘Z.': '所有未暂存的变更都会被还原，未跟踪文件会被删除。此操作无法撤销，⌘Z 也不行。',

  'Every staged file goes back to the last commit, unstaged edits to those files included, and new files are deleted. This cannot be undone — not even with ⌘Z.': '所有已暂存文件都会回到上一次提交，其中未暂存的修改也会一起还原，新文件会被删除。此操作无法撤销，⌘Z 也不行。',

  'Delete file?': '删除文件？',

  'Replace hand edits?': '替换手动编辑？',

  'Replace': '替换',

  'Leave this file unresolved?': '让这个文件保持未解决？',

  'Nothing is written until you mark the file resolved. The lines you picked and edited here will be lost.': '在你标记文件已解决之前不会写入任何内容。这里选择和编辑过的行会丢失。',

  'Discard the hand-written result?': '丢弃手写结果？',

  'The result goes back to the lines picked from A and B.': '结果会回到从 A 和 B 选择的行。',

  'Discard hand-edited result?': '丢弃手动编辑的结果？',

  'This conflict goes back to the lines picked from A and B, or to unresolved.': '此冲突会回到从 A 和 B 选择的行，或者回到未解决状态。',

  'Discard this line?': '丢弃此行？',

  'The change on this line will be reverted in your working tree (modified lines are restored to their original text). This cannot be undone.': '工作区里这一行的变更会被还原（修改过的行会恢复成原来的文本）。此操作无法撤销。',

  'Discard line': '丢弃此行',

  'Discard unsaved changes?': '丢弃未保存的变更？',

  'This file has unsaved edits. Close without saving?': '这个文件有未保存的编辑。不保存就关闭？',

  'Close without saving': '不保存并关闭',

  'Reset branch to its remote?': '把分支重置到远程？',

  'Drop this stash?': '丢弃这个贮藏？',

  'The stashed changes are deleted and cannot be recovered.': '贮藏的变更会被删除，且无法恢复。',

  'Drop stash': '丢弃贮藏',

  'Hard reset': '硬重置',

  'Remove account': '移除账户',

  'Remove profile': '移除配置档案',

  'Remove remote': '移除远程',

  'Remove worktree': '移除工作树',

  'Delete changes and remove': '删除变更并移除',

  'Used for git@… remotes; https:// remotes use the accounts above instead.': '用于 git@… 远程；https:// 远程改用上面的账户。',

  'Tried before any key file, and the only way a passphrase-protected key can work.': '会在任何密钥文件之前尝试，也是有口令的密钥唯一可用的方式。',

  'After your accounts, fall back to credentials saved by git or another client. Turn off to test the accounts on their own.': '在你的账户之后，回退到 Git 或其他客户端保存的凭据。关掉它，就可以单独测试这些账户。',

  'The folder the clone dialog starts from. The last folder you cloned into is remembered here automatically.': '克隆对话框一开始所在的文件夹。上次克隆到的位置会自动记在这里。',

  'Open or clone a repository from the terminal as gitmd or the short gmd. Run gmd --help for the full usage.': '在终端里用 gitmd 或简写 gmd 打开或克隆仓库。运行 gmd --help 查看完整用法。',

  'Open the repository or a file in an editor installed on this machine, from the toolbar, the palette and the file menus.': '从工具栏、命令面板和文件菜单，用本机已安装的编辑器打开仓库或文件。',

  "Install your editor's command line launcher (VS Code calls it the shell command) and scan again.": '安装编辑器的命令行启动器（VS Code 称之为 shell command），然后重新扫描。',

  'What the AI reviewer pays attention to when it reviews staged changes. Applies to every repository.': 'AI 审查已暂存变更时会关注的内容。对所有仓库生效。',

  'Language used for commit messages, diff explanations, reviews and other AI responses.': '提交说明、差异解释、审查和其他 AI 回复所使用的语言。',

  'Controls how much context GitMD AI includes in answers across Git tasks and explanations.': '控制 GitMD AI 在 Git 任务和解释中给出多少上下文。',

  'Popular editor palettes — surfaces and syntax colors follow the theme.': '常见编辑器配色。界面和语法颜色会跟随主题。',

  'Buttons, highlights and focus follow your accent. Graph and diff colors keep their meaning.': '按钮、高亮和焦点使用你的强调色。图谱和差异的颜色仍表示原来的含义。',

  "Fetch from the first remote in the background so teammates' commits show up by themselves. Failures stay silent.": '在后台从第一个远程获取，让同事的提交自己出现。失败时不提示。',

  'Show the pull requests section in the sidebar, loaded through your connected account.': '在侧栏显示拉取请求，并通过已连接的账户加载。',

  'The name and email written on commits made here. Saved to this repository, so it wins over your global git config.': '写在此仓库提交上的名字和邮箱。保存在这个仓库中，因此优先于全局 Git 配置。',

  'The name and email written on commits when a repository has no identity of its own.': '仓库自己没有身份时，写在提交上的名字和邮箱。',

  'Work and personal identities, each with the hosting accounts linked to it. A repository is assigned to one profile the first time you commit or push, and that choice stays with the repository.': '工作和私人身份，各自关联托管账户。仓库在第一次提交或推送时会指定一个配置档案，之后就一直使用它。',

  'Add Work and Personal once, then every repository picks the right name, email and account.': '先添加工作和私人身份，之后每个仓库都会选对名字、邮箱和账户。',

  'Choose an SSH private key': '选择 SSH 私钥',

  'Choose the default clone folder': '选择默认克隆文件夹',

  'Pull with merge': '拉取并合并',

  'Clear state, keep everything as is': '清除状态，保留现有内容',

  'Continue failed': '继续失败',

  'Abort failed': '中止失败',

  'Clear failed': '清除失败',

  'Save failed': '保存失败',

  'Apply failed': '应用失败',

  'Clone failed': '克隆失败',

  'Could not install': '无法安装',

  'Could not uninstall': '无法卸载',

  'Could not open': '无法打开',

  'Could not load commit': '无法加载提交',

  'File history failed': '文件历史加载失败',

  'Could not load diff': '无法加载差异',

  'Interactive rebase failed': '交互式变基失败',

  'Merge failed': '合并失败',

  'Rebase failed': '变基失败',

  'Discard failed': '丢弃失败',

  'Discard all failed': '全部丢弃失败',

  'Create patch failed': '创建补丁失败',

  'AI request failed': 'AI 请求失败',

  'GitMD Code request failed': 'GitMD Code 请求失败',

  'Connect failed': '连接失败',

  'Remove failed': '移除失败',

  'Checkout after creating': '创建后检出',

  'Include untracked files': '包含未跟踪文件',

  'Tag message (optional)': '标签说明（可选）',

  'Stash message (optional)': '贮藏说明（可选）',

  'Branch (optional)': '分支（可选）',

  'Destination folder': '目标文件夹',

  'Browse destination': '浏览目标位置',

  'Actions': '操作',

  'Repository state': '仓库状态',

  'Repository': '仓库',

  'Checkout branch': '检出分支',

  'Switch worktree': '切换工作树',

  'View': '视图',

  'Toggle sidebar': '切换侧栏',

  'Undo / redo operation': '撤销 / 重做操作',

  'Refresh repository': '刷新仓库',

  'Commit staged changes': '提交已暂存的变更',

  'Previous / next commit': '上一个 / 下一个提交',

  'First / last commit': '第一个 / 最后一个提交',

  'Open the commit’s files / back to the graph': '打开提交中的文件 / 返回图谱',

  'Previous / next file (file list)': '上一个 / 下一个文件（文件列表）',

  'Search commits / find in diff': '搜索提交 / 在差异中查找',

  'Previous match (find in diff)': '上一个匹配（在差异中查找）',

  'Select / copy diff side': '选择 / 复制差异一侧',

  'Save (file editor)': '保存（文件编辑器）',

  'Zoom in / out / reset': '放大 / 缩小 / 重置',

  'Previous / next change (diff)': '上一处 / 下一处变更（差异）',

  'Previous / next file (diff)': '上一个 / 下一个文件（差异）',

  'Close diff view': '关闭差异视图',

  'Description — what changed and why  ·  ⌘⏎ to commit': '说明：改了什么、为什么改  ·  ⌘⏎ 提交',

  'Branch prefix rules': '分支前缀规则',

  'first match wins, applied by GitMD itself': '第一个匹配生效，由 GitMD 自己添加',

  'No rules. Add one to prefix messages by branch, for example': '还没有规则。可以按分支给说明加前缀，例如',

  'On': '在',

  'messages start with': '说明以它开头',

  'also gmd': '以及 gmd',

  'Welcome': '欢迎',

  'Sign in': '登录',

  'Create file': '创建文件',

  'Rename branch': '重命名分支',

  'Enter a file name without a path.': '请输入不含路径的文件名。',

  'Configure GitMD Code in Settings first': '请先在设置中配置 GitMD Code',

  'Configure an AI provider in Settings first': '请先在设置中配置 AI',

  'GitMD Code returned an empty commit message': 'GitMD Code 返回了空的提交说明',

  'The staged changes have no reviewable text diff': '已暂存的变更没有可审查的文本差异',

  'The AI provider returned an empty review — try again or check the model in Settings': 'AI 返回了空的审查结果。请重试，或检查设置中的模型',

  'The staged changes changed during the review — run it again': '审查期间已暂存的变更发生了变化，请重新运行',

  'Stage some changes first': '请先暂存一些变更',

  'Absolute path copied': '绝对路径已复制',

  'Could not open the file': '无法打开文件',

  'Could not reveal the file': '无法在文件管理器中显示文件',

  'Pop latest stash (nothing stashed)': '恢复最近的贮藏（目前没有贮藏）',

  'Open in editor (none detected, see Settings → Git)': '用编辑器打开（未检测到，请查看 设置 → Git）',

  'Pull (merge)': '拉取（合并）',

  'Pull (rebase)': '拉取（变基）',

  'Push (force)': '推送（强制）',

  'Rebase continued': '变基已继续',

  'GitMD hit an unexpected error. Your repositories are safe — this only affects the interface. Restarting usually fixes it; if it keeps happening, please report the details below.': 'GitMD 遇到了意外错误。仓库是安全的，这只影响界面。通常重新打开就能恢复；如果反复出现，请把下面的详情发给我们。',
  'Restart interface': '重新打开界面',
  'Copy error details': '复制错误详情',

};

export function translate(key: string, language: UiLanguage): string {
  return language === 'chinese' ? (ZH[key] ?? key) : key;
}

export function useUiText(): (key: string) => string {
  const language = useSettings((state) => state.uiLanguage);
  return useCallback((key: string) => translate(key, language), [language]);
}
