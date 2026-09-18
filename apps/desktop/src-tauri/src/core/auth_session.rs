use crate::error::{AppError, AppResult};

const KEYRING_SERVICE: &str = "GitMD";
const KEYRING_USER: &str = "auth-session";
const CHUNK_USER_PREFIX: &str = "auth-session-chunk-";
const CHUNK_MARKER: &str = "gitmd-chunks-v1:";
const CHUNK_BYTES: usize = 1_000;

fn entry_for(user: &str) -> AppResult<keyring::Entry> {
    keyring::Entry::new(KEYRING_SERVICE, user)
        .map_err(|e| AppError::other(format!("keychain unavailable: {e}")))
}

fn entry() -> AppResult<keyring::Entry> {
    entry_for(KEYRING_USER)
}

fn chunk_entry(index: usize) -> AppResult<keyring::Entry> {
    entry_for(&format!("{CHUNK_USER_PREFIX}{index}"))
}

fn chunk_count(value: &str) -> Option<usize> {
    value.strip_prefix(CHUNK_MARKER)?.parse().ok()
}

fn split_chunks(value: &str) -> Vec<&str> {
    let mut chunks = Vec::new();
    let mut start = 0;
    while start < value.len() {
        let mut end = (start + CHUNK_BYTES).min(value.len());
        while !value.is_char_boundary(end) {
            end -= 1;
        }
        chunks.push(&value[start..end]);
        start = end;
    }
    chunks
}

pub fn get() -> AppResult<Option<String>> {
    match entry()?.get_password() {
        Ok(value) => {
            let Some(count) = chunk_count(&value) else {
                return Ok(Some(value));
            };
            let mut session = String::new();
            for index in 0..count {
                let chunk = chunk_entry(index)?.get_password().map_err(|e| {
                    AppError::other(format!("could not read auth session chunk {index}: {e}"))
                })?;
                session.push_str(&chunk);
            }
            Ok(Some(session))
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(AppError::other(format!("could not read auth session: {e}"))),
    }
}

pub fn set(value: &str) -> AppResult<()> {
    if value.trim().is_empty() {
        return remove();
    }
    let previous_count = entry()
        .ok()
        .and_then(|item| item.get_password().ok())
        .and_then(|stored| chunk_count(&stored))
        .unwrap_or(0);
    let chunks = split_chunks(value);
    for (index, chunk) in chunks.iter().enumerate() {
        chunk_entry(index)?.set_password(chunk).map_err(|e| {
            AppError::other(format!("could not store auth session chunk {index}: {e}"))
        })?;
    }
    entry()?
        .set_password(&format!("{CHUNK_MARKER}{}", chunks.len()))
        .map_err(|e| AppError::other(format!("could not store auth session metadata: {e}")))?;
    for index in chunks.len()..previous_count {
        match chunk_entry(index)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => {}
            Err(e) => {
                return Err(AppError::other(format!(
                    "could not remove stale auth session chunk {index}: {e}"
                )))
            }
        }
    }
    Ok(())
}

pub fn remove() -> AppResult<()> {
    let count = entry()
        .ok()
        .and_then(|item| item.get_password().ok())
        .and_then(|value| chunk_count(&value))
        .unwrap_or(0);
    for index in 0..count {
        match chunk_entry(index)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => {}
            Err(e) => {
                return Err(AppError::other(format!(
                    "could not remove auth session chunk {index}: {e}"
                )))
            }
        }
    }
    match entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(AppError::other(format!(
            "could not remove auth session: {e}"
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_utf8_sessions_without_breaking_characters() {
        let value = format!("{}用户", "a".repeat(CHUNK_BYTES - 1));
        let chunks = split_chunks(&value);
        assert_eq!(chunks.concat(), value);
        assert!(chunks.iter().all(|chunk| chunk.len() <= CHUNK_BYTES));
    }
}
