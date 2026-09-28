---
name: windows-build-test
description: Build and smoke-check the current GitMD Windows x64 application as an unsigned NSIS installer and report the generated executable paths and hashes.
metadata:
  short-description: Build an unsigned Windows test installer
---

# Windows build test

Use this skill when the user wants a Windows test build, an `.exe`, or an unsigned installer for the current GitMD worktree.

Run the bundled script from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .agents/skills/windows-build-test/scripts/build_windows.ps1
```

The script performs the relevant desktop type check, Vitest suite, Rust `cargo check`, and a production Tauri build. It creates an unsigned x64 NSIS installer and keeps updater signing artifacts disabled for this test build. It does not publish, sign, upload, install, or modify application configuration.

Useful options:

```powershell
# Skip tests when iterating only on packaging
powershell -ExecutionPolicy Bypass -File .agents/skills/windows-build-test/scripts/build_windows.ps1 -SkipTests

# Skip the TypeScript check when it was already run in the same worktree
powershell -ExecutionPolicy Bypass -File .agents/skills/windows-build-test/scripts/build_windows.ps1 -SkipTypecheck
```

After a successful run, report the installer and portable executable as clickable absolute paths, include their sizes and SHA-256 values, and distinguish build warnings from failures. If any check or packaging step fails, stop and report the failing command and its relevant output instead of presenting stale artifacts as a successful build.
