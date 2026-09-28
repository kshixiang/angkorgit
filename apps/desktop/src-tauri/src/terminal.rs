use std::collections::HashMap;
use std::io::{Read, Write};
#[cfg(target_os = "windows")]
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};

use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::error::{AppError, AppResult};

struct PtySession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    killer: Box<dyn ChildKiller + Send + Sync>,
}

#[derive(Default)]
pub struct TerminalSessions {
    sessions: Mutex<HashMap<u32, PtySession>>,
    next_id: AtomicU32,
}

#[derive(Default)]
pub struct TerminalState(Arc<TerminalSessions>);

impl TerminalState {
    pub fn sessions(&self) -> Arc<TerminalSessions> {
        Arc::clone(&self.0)
    }
}

#[derive(Serialize, Clone)]
struct TermData {
    id: u32,
    data: String,
}

#[derive(Serialize, Clone)]
struct TermExit {
    id: u32,
}

#[cfg(target_os = "windows")]
fn git_bash_path() -> Option<PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(root) = std::env::var("GIT_INSTALL_ROOT") {
        candidates.push(PathBuf::from(root).join("bin/bash.exe"));
    }
    for variable in ["ProgramFiles", "ProgramW6432", "LocalAppData"] {
        if let Ok(root) = std::env::var(variable) {
            let root = PathBuf::from(root);
            let git_root = if variable == "LocalAppData" {
                root.join("Programs/Git")
            } else {
                root.join("Git")
            };
            candidates.push(git_root.join("bin/bash.exe"));
        }
    }
    if let Ok(path) = std::env::var("PATH") {
        candidates.extend(std::env::split_paths(&path).map(|entry| entry.join("bash.exe")));
    }

    candidates.into_iter().find(|path| is_file(path))
}

#[cfg(target_os = "windows")]
fn is_file(path: &Path) -> bool {
    path.is_file()
}

fn default_shell() -> CommandBuilder {
    #[cfg(target_os = "windows")]
    {
        let bash = git_bash_path();
        let mut cmd = CommandBuilder::new(
            bash.clone()
                .unwrap_or_else(|| PathBuf::from("powershell.exe")),
        );
        if bash.is_some() {
            cmd.args(["--login", "-i"]);
            cmd.env("CHERE_INVOKING", "1");
            cmd.env("TERM", "xterm-256color");
        }
        cmd
    }
    #[cfg(not(target_os = "windows"))]
    {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        let mut cmd = CommandBuilder::new(shell);
        cmd.env("TERM", "xterm-256color");
        cmd
    }
}

fn gitmd_code_command(
    engine: &Path,
    api_key: &str,
    base_url: &str,
    model: &str,
    language: &str,
) -> CommandBuilder {
    #[cfg(target_os = "windows")]
    let mut cmd = {
        let is_script = engine
            .extension()
            .and_then(|value| value.to_str())
            .is_some_and(|value| {
                value.eq_ignore_ascii_case("cmd") || value.eq_ignore_ascii_case("bat")
            });
        if is_script {
            let mut command = CommandBuilder::new("cmd.exe");
            command.args(["/D", "/C"]);
            command.arg(engine);
            command
        } else {
            CommandBuilder::new(engine)
        }
    };
    #[cfg(not(target_os = "windows"))]
    let mut cmd = CommandBuilder::new(engine);

    cmd.args(["--model", model, "--append-system-prompt"]);
    cmd.arg(if language == "chinese" {
        "Respond in Simplified Chinese. Keep Git commands, file paths, branch names, code, and API names unchanged."
    } else {
        "Respond in English. Keep Git commands, file paths, branch names, code, and API names unchanged."
    });
    cmd.env("ANTHROPIC_API_KEY", api_key);
    if !base_url.is_empty() {
        cmd.env("ANTHROPIC_BASE_URL", base_url);
    }
    cmd.env("TERM", "xterm-256color");
    cmd.env("PATH", crate::ai_cli::search_path(engine.parent()));
    cmd
}

pub fn create(
    app: &AppHandle,
    state: &Arc<TerminalSessions>,
    cwd: &str,
    cols: u16,
    rows: u16,
) -> AppResult<u32> {
    create_command(app, state, cwd, cols, rows, default_shell())
}

#[allow(clippy::too_many_arguments)]
pub fn create_gitmd_code(
    app: &AppHandle,
    state: &Arc<TerminalSessions>,
    cwd: &str,
    cols: u16,
    rows: u16,
    base_url: &str,
    model: &str,
    language: &str,
) -> AppResult<u32> {
    let chinese = language == "chinese";
    let cwd_path = Path::new(cwd);
    if !cwd_path.is_dir() {
        return Err(AppError::other(if chinese {
            "当前仓库路径不可用"
        } else {
            "The current repository path is unavailable."
        }));
    }
    let model = model.trim();
    if model.is_empty() {
        return Err(AppError::other(if chinese {
            "请先在设置中填写模型名"
        } else {
            "Enter a model name in Settings first."
        }));
    }
    if !model.chars().all(|value| {
        value.is_ascii_alphanumeric() || matches!(value, '-' | '_' | '.' | ':' | '/' | '@')
    }) {
        return Err(AppError::other(if chinese {
            "模型名包含不支持的字符"
        } else {
            "The model name contains unsupported characters."
        }));
    }
    let base_url = base_url.trim();
    if !base_url.is_empty() {
        let url = reqwest::Url::parse(base_url).map_err(|_| {
            AppError::other(if chinese {
                "接口地址格式无效"
            } else {
                "The endpoint URL is invalid."
            })
        })?;
        if !matches!(url.scheme(), "http" | "https") {
            return Err(AppError::other(if chinese {
                "接口地址必须使用 http 或 https"
            } else {
                "The endpoint URL must use http or https."
            }));
        }
    }
    let api_key = crate::core::ai_keys::get("gitmd-code")?
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| {
            AppError::other(if chinese {
                "请先在设置中填写 API Key"
            } else {
                "Enter an API key in Settings first."
            })
        })?;
    let engine = crate::ai_cli::locate("claude").ok_or_else(|| {
        AppError::other(if chinese {
            "未找到 GitMD Code 引擎，请先安装"
        } else {
            "GitMD Code engine was not found. Install it first."
        })
    })?;
    let command = gitmd_code_command(&engine, &api_key, base_url, model, language);
    create_command(app, state, cwd, cols, rows, command)
}

fn create_command(
    app: &AppHandle,
    state: &Arc<TerminalSessions>,
    cwd: &str,
    cols: u16,
    rows: u16,
    mut cmd: CommandBuilder,
) -> AppResult<u32> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| AppError::other(format!("failed to open pty: {e}")))?;

    cmd.cwd(cwd);
    let mut child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| AppError::other(format!("failed to spawn shell: {e}")))?;
    let killer = child.clone_killer();

    let id = state.next_id.fetch_add(1, Ordering::SeqCst) + 1;

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| AppError::other(format!("failed to clone pty reader: {e}")))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| AppError::other(format!("failed to take pty writer: {e}")))?;

    state.sessions.lock().unwrap().insert(
        id,
        PtySession {
            writer,
            master: pair.master,
            killer,
        },
    );

    let app_handle = app.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_handle.emit("term-data", TermData { id, data });
                }
            }
        }
    });

    let exit_app = app.clone();
    let exit_sessions = Arc::clone(state);
    std::thread::spawn(move || {
        let _ = child.wait();
        exit_sessions.sessions.lock().unwrap().remove(&id);
        let _ = exit_app.emit("term-exit", TermExit { id });
    });

    Ok(id)
}

pub fn write(state: &TerminalSessions, id: u32, data: &str) -> AppResult<()> {
    let mut sessions = state.sessions.lock().unwrap();
    let session = sessions
        .get_mut(&id)
        .ok_or_else(|| AppError::other("terminal session not found"))?;
    session
        .writer
        .write_all(data.as_bytes())
        .map_err(AppError::from)?;
    session.writer.flush().ok();
    Ok(())
}

pub fn resize(state: &TerminalSessions, id: u32, cols: u16, rows: u16) -> AppResult<()> {
    let sessions = state.sessions.lock().unwrap();
    let session = sessions
        .get(&id)
        .ok_or_else(|| AppError::other("terminal session not found"))?;
    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| AppError::other(format!("resize failed: {e}")))?;
    Ok(())
}

pub fn kill(state: &TerminalSessions, id: u32) -> AppResult<()> {
    if let Some(mut session) = state.sessions.lock().unwrap().remove(&id) {
        session.killer.kill().ok();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    #[cfg(target_os = "windows")]
    #[test]
    fn finds_git_bash_from_path() {
        let path = super::git_bash_path();
        if let Ok(git_root) = std::env::var("GIT_INSTALL_ROOT") {
            assert!(path.is_some_and(|value| value.starts_with(git_root)));
        }
    }
}
