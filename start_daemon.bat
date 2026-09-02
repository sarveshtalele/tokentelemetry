@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Virtual environment not found. Run install_windows.ps1 first.
  exit /b 1
)
.venv\Scripts\python.exe -m telemetry.daemon
