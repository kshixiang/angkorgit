@echo off
setlocal
cd /d "%~dp0.."
call pnpm tauri:dev
if errorlevel 1 pause
