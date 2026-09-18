use crate::error::{AppError, AppResult};

const KEYRING_SERVICE: &str = "GitMD";
const LEGACY_KEYRING_SERVICE: &str = "AngKorGit";

fn entry_for(service: &str, provider: &str) -> AppResult<keyring::Entry> {
    let provider = provider.trim().to_lowercase();
    if provider.is_empty() {
        return Err(AppError::other("provider is required"));
    }
    keyring::Entry::new(service, &format!("ai:{provider}"))
        .map_err(|e| AppError::other(format!("keychain unavailable: {e}")))
}

fn entry(provider: &str) -> AppResult<keyring::Entry> {
    entry_for(KEYRING_SERVICE, provider)
}

pub fn get(provider: &str) -> AppResult<Option<String>> {
    match entry(provider)?.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => {
            match entry_for(LEGACY_KEYRING_SERVICE, provider)?.get_password() {
                Ok(key) => {
                    if entry(provider)?.set_password(&key).is_ok() {
                        let _ = entry_for(LEGACY_KEYRING_SERVICE, provider)?.delete_credential();
                    }
                    Ok(Some(key))
                }
                Err(keyring::Error::NoEntry) => Ok(None),
                Err(e) => Err(AppError::other(format!(
                    "could not read key from keychain: {e}"
                ))),
            }
        }
        Err(e) => Err(AppError::other(format!(
            "could not read key from keychain: {e}"
        ))),
    }
}

pub fn set(provider: &str, key: &str) -> AppResult<()> {
    let key = key.trim();
    if key.is_empty() {
        return delete(provider);
    }
    entry(provider)?
        .set_password(key)
        .map_err(|e| AppError::other(format!("could not store key in keychain: {e}")))
}

pub fn delete(provider: &str) -> AppResult<()> {
    match entry(provider)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(AppError::other(format!(
            "could not delete key from keychain: {e}"
        ))),
    }?;
    match entry_for(LEGACY_KEYRING_SERVICE, provider)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(AppError::other(format!(
            "could not delete legacy key from keychain: {e}"
        ))),
    }
}
